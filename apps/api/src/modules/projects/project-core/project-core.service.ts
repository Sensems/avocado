import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { User, ProjectRole, FrameworkType } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs/promises';
import { randomBytes } from 'crypto';

@Injectable()
export class ProjectCoreService {
  /** 密钥文件存储目录 */
  private readonly privateKeysDir = path.join(process.cwd(), 'private-keys');

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async create(createDto: CreateProjectDto, user: User, file?: Express.Multer.File) {
    // 先做一次友好检查；并发场景下真正兜底的是数据库唯一约束
    const existing = await this.prisma.project.findFirst({ where: { name: createDto.name } });
    if (existing) {
      throw new ConflictException('项目名称已存在');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // 创建项目
        // 用户要求：新建项目时自动生成 webhookSecret
        const generatedWebhookSecret = randomBytes(16).toString('hex');

        let project = await tx.project.create({
          data: {
            name: createDto.name,
            appId: createDto.appId ?? null,
            repoUrl: createDto.repositoryUrl,
            gitCredentialId: createDto.gitCredentialId as string,
            framework: createDto.framework ?? FrameworkType.native,
            webhookSecret: generatedWebhookSecret,
            // 以下两项此前被遗漏：前端表单能填、DTO 能收，但创建时被静默丢弃，
            // 导致「填了产物路径却不生效」，原生/uni-app 项目首次构建必然找不到目录
            distPath: createDto.distPath ?? null,
            buildCommand: createDto.buildCommand ?? null,
            defaultBranch: createDto.defaultBranch ?? null,
          },
        });

        // 若上传了密钥文件，保存到磁盘并更新记录
        if (file) {
          await fs.mkdir(this.privateKeysDir, { recursive: true });
          const keyFilePath = path.join(this.privateKeysDir, `${project.id}.key`);
          await fs.writeFile(keyFilePath, file.buffer);

          // 更新结果要回传给调用方，否则接口响应里 privateKeyPath 永远是 null
          project = await tx.project.update({
            where: { id: project.id },
            data: { privateKeyPath: keyFilePath },
          });
        }

        // 将创建者指定为维护者
        await tx.projectMember.create({
          data: {
            projectId: project.id,
            userId: user.id,
            role: ProjectRole.maintainer,
          },
        });

        // 关联 IM 机器人（中间表，替代原先的 JSON 数组）
        if (createDto.imRobotIds?.length) {
          const validRobots = await tx.imRobot.findMany({
            where: { id: { in: createDto.imRobotIds } },
            select: { id: true },
          });
          if (validRobots.length > 0) {
            await tx.projectImRobot.createMany({
              data: validRobots.map((robot) => ({ projectId: project.id, robotId: robot.id })),
              skipDuplicates: true,
            });
          }
        }

        return project;
      });
    } catch (e: unknown) {
      // P2002 = 唯一约束冲突（两个请求同时通过上面的 findFirst 检查时由 DB 兜底）
      if (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002') {
        throw new ConflictException('项目名称已存在');
      }
      throw e;
    }
  }

  async findAll(user: User, page: number = 1, limit: number = 15) {
    const skip = (page - 1) * limit;

    // 超级管理员可见所有项目，其他用户只可见其所属的项目
    if (user.isSuperAdmin) {
      const [items, total] = await Promise.all([
        this.prisma.project.findMany({
          where: { deletedAt: null },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: { buildTasks: { orderBy: { createdAt: 'desc' }, take: 1 } },
        }),
        this.prisma.project.count({ where: { deletedAt: null } }),
      ]);
      const mappedItems = items.map((p) => ({ ...p, lastBuild: p.buildTasks[0] || null }));
      return { items: mappedItems, total };
    } else {
      const [memberships, total] = await Promise.all([
        this.prisma.projectMember.findMany({
          where: { userId: user.id, project: { deletedAt: null } },
          include: {
            project: {
              include: { buildTasks: { orderBy: { createdAt: 'desc' }, take: 1 } },
            },
          },
          orderBy: { project: { createdAt: 'desc' } },
          skip,
          take: limit,
        }),
        this.prisma.projectMember.count({
          where: { userId: user.id, project: { deletedAt: null } },
        }),
      ]);
      const items = memberships.map((m) => ({
        ...m.project,
        lastBuild: m.project.buildTasks[0] || null,
        myRole: m.role,
      }));
      return { items, total };
    }
  }

  async findOne(id: string) {
    // 用 findFirst 而非 findUnique：需要额外过滤软删除标记
    const project = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, status: true },
            },
          },
        },
        gitCredential: {
          select: { id: true, name: true, type: true },
        },
        imRobots: {
          select: { robotId: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    // 由后端拼接完整的 webhookUrl，避免前端硬编码路径
    const apiBaseUrl = this.configService.get<string>('API_BASE_URL', '');
    const webhookUrl = `${apiBaseUrl}/api/build-tasks/webhook/${project.id}`;

    // 对外仍然暴露 imRobotIds 数组，前端无需感知中间表的存在
    const { imRobots, ...rest } = project;
    return { ...rest, imRobotIds: imRobots.map((r) => r.robotId), webhookUrl };
  }

  async update(id: string, updateDto: UpdateProjectDto, file?: Express.Multer.File) {
    const project = await this.findOne(id); // 检查是否存在

    // 如果上传了新的密钥文件，保存并更新路径
    let privateKeyPath = project.privateKeyPath;
    if (file) {
      await fs.mkdir(this.privateKeysDir, { recursive: true });
      const keyFilePath = path.join(this.privateKeysDir, `${project.id}.key`);
      await fs.writeFile(keyFilePath, file.buffer);
      privateKeyPath = keyFilePath;
    }

    const data: Record<string, unknown> = {
      name: updateDto.name,
      repoUrl: updateDto.repositoryUrl,
      gitCredentialId: updateDto.gitCredentialId as string,
      framework: updateDto.framework as FrameworkType,
      distPath: updateDto.distPath,
      buildCommand: updateDto.buildCommand,
      retentionCount: updateDto.retentionCount,
      webhookSecret: updateDto.webhookSecret,
      historyEnabled: updateDto.historyEnabled,
      privateKeyPath,
    };

    // appId / defaultBranch 不能用 `?? null` 直接写：
    // 前端只改「构建命令」时不会带这两个字段，undefined 被转成 null 就会把已有配置清空。
    // 只有显式传了值（哪怕是空串）才更新，未传则保持原值。
    if (updateDto.appId !== undefined) {
      data.appId = updateDto.appId || null;
    }
    if (updateDto.defaultBranch !== undefined) {
      data.defaultBranch = updateDto.defaultBranch || null;
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data,
    });

    // 机器人关联采用「整体替换」语义：传了数组就重写，没传则保持不变
    if (updateDto.imRobotIds !== undefined) {
      const robotIds = updateDto.imRobotIds;
      await this.prisma.$transaction(async (tx) => {
        await tx.projectImRobot.deleteMany({ where: { projectId: id } });
        if (robotIds.length > 0) {
          const validRobots = await tx.imRobot.findMany({
            where: { id: { in: robotIds } },
            select: { id: true },
          });
          if (validRobots.length > 0) {
            await tx.projectImRobot.createMany({
              data: validRobots.map((robot) => ({ projectId: id, robotId: robot.id })),
              skipDuplicates: true,
            });
          }
        }
      });
    }

    return updated;
  }

  async remove(id: string) {
    const project = await this.findOne(id); // 检查是否存在（已排除软删除的）

    // 软删除：物理删除会级联清空全部构建历史与审计链路。
    // 同时改写 name 释放唯一约束，否则同名项目永远无法重建。
    const suffix = `__deleted_${Date.now()}`;
    const freedName = project.name.slice(0, Math.max(1, 100 - suffix.length)) + suffix;

    await this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date(), name: freedName },
    });

    return { success: true };
  }

  // --- 项目成员管理 ---

  async addMember(projectId: string, dto: AddProjectMemberDto) {
    await this.findOne(projectId);

    const existingUser = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!existingUser) throw new NotFoundException('用户不存在');

    const existingMembership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: dto.userId },
      },
    });

    if (existingMembership) {
      throw new ConflictException('该用户已是该项目的成员');
    }

    return await this.prisma.projectMember.create({
      data: {
        projectId,
        userId: dto.userId,
        role: dto.role,
      },
    });
  }

  async removeMember(projectId: string, userId: string) {
    const membership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
    });

    if (!membership) throw new NotFoundException('未找到成员关系');

    await this.prisma.projectMember.delete({
      where: {
        projectId_userId: { projectId, userId },
      },
    });
    return { success: true };
  }

  async updateMemberRole(projectId: string, userId: string, role: ProjectRole) {
    const membership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
    });

    if (!membership) throw new NotFoundException('未找到成员关系');

    return await this.prisma.projectMember.update({
      where: {
        projectId_userId: { projectId, userId },
      },
      data: { role },
    });
  }
}

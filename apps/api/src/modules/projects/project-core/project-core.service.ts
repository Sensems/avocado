import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { User, ProjectRole, Prisma, FrameworkType } from '@prisma/client';
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
    // 检查项目名称是否存在
    const existing = await this.prisma.project.findFirst({ where: { name: createDto.name } });
    if (existing) {
      throw new ConflictException('项目名称已存在');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 创建项目
      // 用户要求：新建项目时自动生成 webhookSecret
      const generatedWebhookSecret = randomBytes(16).toString('hex');

      const project = await tx.project.create({
        data: {
          name: createDto.name,
          appId: createDto.appId ?? null,
          repoUrl: createDto.repositoryUrl,
          gitCredentialId: createDto.gitCredentialId as string,
          imRobotIds: createDto.imRobotIds ? createDto.imRobotIds : Prisma.DbNull,
          framework: createDto.framework ?? FrameworkType.native,
          webhookSecret: generatedWebhookSecret,
        },
      });

      // 若上传了密钥文件，保存到磁盘并更新记录
      if (file) {
        await fs.mkdir(this.privateKeysDir, { recursive: true });
        const keyFilePath = path.join(this.privateKeysDir, `${project.id}.key`);
        await fs.writeFile(keyFilePath, file.buffer);

        await tx.project.update({
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

      return project;
    });
  }

  async findAll(user: User, page: number = 1, limit: number = 15) {
    const skip = (page - 1) * limit;

    // 超级管理员可见所有项目，其他用户只可见其所属的项目
    if (user.isSuperAdmin) {
      const [items, total] = await Promise.all([
        this.prisma.project.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: { buildTasks: { orderBy: { createdAt: 'desc' }, take: 1 } },
        }),
        this.prisma.project.count(),
      ]);
      const mappedItems = items.map((p) => ({ ...p, lastBuild: p.buildTasks[0] || null }));
      return { items: mappedItems, total };
    } else {
      const [memberships, total] = await Promise.all([
        this.prisma.projectMember.findMany({
          where: { userId: user.id },
          include: { 
            project: {
              include: { buildTasks: { orderBy: { createdAt: 'desc' }, take: 1 } }
            } 
          },
          orderBy: { project: { createdAt: 'desc' } },
          skip,
          take: limit,
        }),
        this.prisma.projectMember.count({
          where: { userId: user.id },
        }),
      ]);
      const items = memberships.map((m) => ({ ...m.project, lastBuild: m.project.buildTasks[0] || null, myRole: m.role }));
      return { items, total };
    }
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
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
      },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    // 由后端拼接完整的 webhookUrl，避免前端硬编码路径
    const apiBaseUrl = this.configService.get<string>('API_BASE_URL', '');
    const webhookUrl = `${apiBaseUrl}/api/build-tasks/webhook/${project.id}`;

    return { ...project, webhookUrl };
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

    return this.prisma.project.update({
      where: { id },
      data: {
        name: updateDto.name,
        appId: updateDto.appId ?? null,
        repoUrl: updateDto.repositoryUrl,
        gitCredentialId: updateDto.gitCredentialId as string,
        imRobotIds: updateDto.imRobotIds ? updateDto.imRobotIds : Prisma.DbNull,
        framework: updateDto.framework as FrameworkType,
        distPath: updateDto.distPath,
        buildCommand: updateDto.buildCommand,
        defaultBranch: updateDto.defaultBranch ?? null,
        retentionCount: updateDto.retentionCount,
        webhookSecret: updateDto.webhookSecret,
        privateKeyPath,
      } as any,
    });
  }

  async remove(id: string) {
    await this.findOne(id); // 检查是否存在
    await this.prisma.project.delete({ where: { id } });
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

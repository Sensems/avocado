import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { User, ProjectRole, Prisma, FrameworkType } from '@prisma/client';

@Injectable()
export class ProjectCoreService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateProjectDto, user: User) {
    // 检查项目名称是否存在
    const existing = await this.prisma.project.findFirst({ where: { name: createDto.name } });
    if (existing) {
      throw new ConflictException('项目名称已存在');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 创建项目
      const project = await tx.project.create({
        data: {
          name: createDto.name,
          appId: createDto.appId ?? null,
          repoUrl: createDto.repositoryUrl,
          gitCredentialId: createDto.gitCredentialId as string, // 假设已经过验证或使用默认值
          privateKey: createDto.privateKey ?? null,
          imRobotIds: createDto.imRobotIds ? createDto.imRobotIds : Prisma.DbNull,
          framework: createDto.framework ?? FrameworkType.native,
        },
      });

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

  async findAll(user: User) {
    // 超级管理员可见所有项目，其他用户只可见其所属的项目
    if (user.isSuperAdmin) {
      return await this.prisma.project.findMany({
        orderBy: { createdAt: 'desc' },
      });
    } else {
      const memberships = await this.prisma.projectMember.findMany({
        where: { userId: user.id },
        include: { project: true },
        orderBy: { project: { createdAt: 'desc' } },
      });
      return memberships.map((m) => ({ ...m.project, myRole: m.role }));
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

    return project;
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

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { User, ProjectRole, Prisma, FrameworkType } from '@prisma/client';

@Injectable()
export class ProjectCoreService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateProjectDto, user: User) {
    // Check if project name exists
    const existing = await this.prisma.project.findFirst({ where: { name: createDto.name } });
    if (existing) {
      throw new ConflictException('Project name already exists');
    }

    return await this.prisma.$transaction(async (tx) => {
      // Create the project
      const project = await tx.project.create({
        data: {
          name: createDto.name,
          appId: createDto.appId ?? null,
          repoUrl: createDto.repositoryUrl,
          gitCredentialId: createDto.gitCredentialId as string, // Assuming it's validated or defaults
          privateKey: createDto.privateKey ?? null,
          imRobotIds: createDto.imRobotIds ? createDto.imRobotIds : Prisma.DbNull,
          framework: createDto.framework ?? FrameworkType.native,
        },
      });

      // Assign the creator as the maintainer
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
    // SuperAdmins see all projects, others only see projects they are members of
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
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async remove(id: string) {
    await this.findOne(id); // Check existence
    await this.prisma.project.delete({ where: { id } });
    return { success: true };
  }

  // --- Project Member Management ---

  async addMember(projectId: string, dto: AddProjectMemberDto) {
    await this.findOne(projectId);

    const existingUser = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!existingUser) throw new NotFoundException('User not found');

    const existingMembership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: dto.userId },
      },
    });

    if (existingMembership) {
      throw new ConflictException('User is already a member of this project');
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

    if (!membership) throw new NotFoundException('Membership not found');

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

    if (!membership) throw new NotFoundException('Membership not found');

    return await this.prisma.projectMember.update({
      where: {
        projectId_userId: { projectId, userId },
      },
      data: { role },
    });
  }
}

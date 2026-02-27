/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { User, ProjectRole } from '@prisma/client';
import { Request } from 'express';

export const REQUIRE_PROJECT_ROLES_KEY = 'requireProjectRoles';
export const RequireProjectRoles = (...roles: ProjectRole[]) =>
  Reflector.createDecorator<ProjectRole[]>({ key: REQUIRE_PROJECT_ROLES_KEY }).apply(null, [roles]);

@Injectable()
export class ProjectGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<ProjectRole[]>(
      REQUIRE_PROJECT_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No project roles required
    }

    const request = context.switchToHttp().getRequest<Request>();

    const user: User = (request as any).user;

    const projectId =
      (request.params as any)?.projectId ||
      request.body?.projectId ||
      (request.query as any)?.projectId;

    if (!user) {
      throw new ForbiddenException('User authentication required');
    }

    if (user.isSuperAdmin) {
      return true; // Super Admins bypass project role checks
    }

    if (!projectId) {
      throw new ForbiddenException('Project ID is required to verify access');
    }

    const member = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: user.id,
      },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this project');
    }

    if (!requiredRoles.includes(member.role)) {
      throw new ForbiddenException(`Requires one of the follow roles: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}

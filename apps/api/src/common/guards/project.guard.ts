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
      return true; // 不需要项目角色
    }

    const request = context.switchToHttp().getRequest<Request>();

    const user: User = (request as any).user;

    const projectId =
      (request.params as any)?.projectId ||
      request.body?.projectId ||
      (request.query as any)?.projectId;

    if (!user) {
      throw new ForbiddenException('需要用户认证');
    }

    if (user.isSuperAdmin) {
      return true; // 超级管理员跳过项目角色检查
    }

    if (!projectId) {
      throw new ForbiddenException('需要项目 ID 来验证访问权限');
    }

    const member = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: user.id,
      },
    });

    if (!member) {
      throw new ForbiddenException('您不是该项目的成员');
    }

    if (!requiredRoles.includes(member.role)) {
      throw new ForbiddenException(`需要以下角色之一: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}

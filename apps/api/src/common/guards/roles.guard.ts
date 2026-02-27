import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_SUPER_ADMIN_KEY } from '../decorators/roles.decorator';
import { User } from '@prisma/client';
import { Request } from 'express';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requireSuperAdmin = this.reflector.getAllAndOverride<boolean>(REQUIRE_SUPER_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requireSuperAdmin) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = (request as any).user as User;

    if (!user) {
      throw new ForbiddenException('User object missing in request, make sure AuthGuard is active');
    }

    if (user.isSuperAdmin) {
      return true;
    }

    throw new ForbiddenException('Super Admin privileges required');
  }
}

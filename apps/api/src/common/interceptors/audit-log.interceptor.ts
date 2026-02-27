/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();

    const { method, url, body, ip } = request as any;

    const user = (request as any).user;

    // Do not block the request for audit logging. We log after it completes or just log the intent.

    return next.handle().pipe(
      tap(() => {
        if (user && method !== 'GET') {
          // Typically audit mutative actions
          this.prisma.auditLog
            .create({
              data: {
                userId: user.id as string,
                action: `${method} ${url}`,
                targetId: url,
                changes: body ? (JSON.stringify(body) as any) : null,
                ipAddress: ip,
              },
            })
            .catch((error) => {
              console.error('Failed to write audit log', error);
            });
        }
      }),
    );
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  async findAll(page: number = 1, limit: number = 15, userId?: string, action?: string) {
    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: Record<string, any> = {};
    if (userId) {
      where.userId = userId;
    }
    if (action) {
      where.action = { contains: action, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({
        where,
      }),
    ]);

    // 格式化返回数据，兼容前端接口所需的 username、resource 字段
    const formattedItems = items.map((item) => ({
      ...item,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      username: (item as any).user?.username,
      resource: item.targetId ?? null,
    }));

    return { items: formattedItems, total };
  }
}

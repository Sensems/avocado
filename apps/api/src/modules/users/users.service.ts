import { Injectable, OnModuleInit, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from '@prisma/client';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.initSuperAdmin();
  }

  private async initSuperAdmin() {
    const adminCount = await this.prisma.user.count({
      where: { isSuperAdmin: true },
    });
    if (adminCount === 0) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await this.prisma.user.create({
        data: {
          username: 'admin',
          passwordHash,
          isSuperAdmin: true,
        },
      });
      console.log('默认超级管理员已创建，用户名: admin，密码: admin123');
    }
  }

  async create(createUserDto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { username: createUserDto.username },
    });
    if (existing) {
      throw new ConflictException('用户名已存在');
    }
    const passwordHash = await bcrypt.hash(createUserDto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        username: createUserDto.username,
        passwordHash,
        isSuperAdmin: createUserDto.isSuperAdmin || false,
      },
      select: { id: true, username: true, isSuperAdmin: true, status: true, createdAt: true },
    });
    return user;
  }

  async findByUsername(username: string): Promise<User | null> {
    return await this.prisma.user.findUnique({ where: { username } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return user;
  }

  async updateStatus(id: string, status: 'active' | 'disabled') {
    return await this.prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, username: true, status: true },
    });
  }

  async resetPassword(id: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash },
      select: { id: true, username: true },
    });
  }

  async findAll(page: number = 1, limit: number = 15) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        select: { id: true, username: true, isSuperAdmin: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);
    return { items, total };
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const data: any = { ...updateUserDto };

    // 如果存在同名用户，需要避免冲突
    if (data.username && data.username !== user.username) {
      const existing = await this.prisma.user.findUnique({ where: { username: data.username } });
      if (existing) {
        throw new ConflictException('用户名已存在');
      }
    }

    if (data.password) {
      data.passwordHash = await bcrypt.hash(data.password, 10);
      delete data.password;
    }

    return await this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, username: true, isSuperAdmin: true, status: true, createdAt: true },
    });
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    if (user.isSuperAdmin) {
      throw new ConflictException('无法删除超级管理员');
    }

    // 用户被 audit_logs / project_members / build_tasks / git_credentials /
    // im_robots 等多处外键引用（RESTRICT），只要有历史痕迹就物理删不掉。
    // 与其让数据库抛 P2003 变 500，不如查清关联、引导用户改用「禁用」。
    const [
      auditCount,
      memberCount,
      taskCount,
      credentialCount,
      robotCount,
    ] = await Promise.all([
      this.prisma.auditLog.count({ where: { userId: id } }),
      this.prisma.projectMember.count({ where: { userId: id } }),
      this.prisma.buildTask.count({ where: { triggerUserId: id } }),
      this.prisma.gitCredential.count({ where: { createdById: id } }),
      this.prisma.imRobot.count({ where: { createdById: id } }),
    ]);

    if (auditCount + memberCount + taskCount + credentialCount + robotCount > 0) {
      throw new ConflictException(
        `该用户存在 ${auditCount + memberCount + taskCount + credentialCount + robotCount} 条关联记录，无法删除；请改用「禁用」使其无法登录`,
      );
    }

    return await this.prisma.user.delete({
      where: { id },
    });
  }
}

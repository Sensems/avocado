import { Injectable, OnModuleInit, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
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
      console.log('Default super admin created username: admin, password: admin123');
    }
  }

  async create(createUserDto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { username: createUserDto.username },
    });
    if (existing) {
      throw new ConflictException('Username already exists');
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
      throw new NotFoundException('User not found');
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

  async findAll() {
    return await this.prisma.user.findMany({
      select: { id: true, username: true, isSuperAdmin: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}

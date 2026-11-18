import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateGitCredentialDto } from './dto/create-git-credential.dto';
import { UpdateGitCredentialDto } from './dto/update-git-credential.dto';
import { encrypt, decrypt } from '../../../common/utils/crypto.util';
import { User } from '@prisma/client';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  buildGitAuthContext,
  buildNoAuthContext,
  listBranchesWithContext,
} from '../../../common/utils/git-auth.helper';

const execFileAsync = promisify(execFile);

@Injectable()
export class GitCredentialsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateGitCredentialDto, user: User) {
    const encryptedSecret = encrypt(createDto.secret);

    return await this.prisma.gitCredential.create({
      data: {
        name: createDto.name,
        type: createDto.type,
        username: createDto.username,
        secret: encryptedSecret,
        createdById: user.id,
      },
      select: {
        id: true,
        name: true,
        type: true,
        username: true,
        createdAt: true,
        createdById: true,
      },
    });
  }

  async findAll(page: number = 1, limit: number = 15) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.gitCredential.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          type: true,
          username: true,
          createdAt: true,
          createdById: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.gitCredential.count(),
    ]);
    return { items, total };
  }

  async update(id: string, updateDto: UpdateGitCredentialDto) {
    const existing = await this.prisma.gitCredential.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('凭证不存在');

    const data: Record<string, unknown> = {};
    if (updateDto.name !== undefined) data.name = updateDto.name;
    if (updateDto.type !== undefined) data.type = updateDto.type;
    if (updateDto.username !== undefined) data.username = updateDto.username;
    // 仅在 secret 非空时才覆盖加密存储的密钥
    if (updateDto.secret) data.secret = encrypt(updateDto.secret);

    return await this.prisma.gitCredential.update({
      where: { id },
      data,
      select: { id: true, name: true, type: true, username: true, createdAt: true },
    });
  }

  async remove(id: string) {
    const credential = await this.prisma.gitCredential.findUnique({ where: { id } });
    if (!credential) throw new NotFoundException('凭证不存在');

    // 外键 RESTRICT：被项目引用的凭证不能物理删除，否则项目会悬空。
    // 与其让数据库抛 P2003 变成 500，不如先查清楚，给一个能指导用户行动的提示。
    const refCount = await this.prisma.project.count({
      where: { gitCredentialId: id, deletedAt: null },
    });
    if (refCount > 0) {
      throw new ConflictException(
        `该凭证正被 ${refCount} 个项目使用，请先解绑这些项目再删除`,
      );
    }

    await this.prisma.gitCredential.delete({ where: { id } });
    return { success: true };
  }

  async findDecryptedSecret(id: string): Promise<string> {
    const credential = await this.prisma.gitCredential.findUnique({ where: { id } });
    if (!credential) throw new NotFoundException('凭证不存在');

    return decrypt(credential.secret);
  }

  async testConnection(id: string, testUrl: string) {
    const credential = await this.prisma.gitCredential.findUnique({ where: { id } });
    if (!credential) throw new NotFoundException('凭证不存在');

    // 先试一次匿名访问。公开仓库不需要凭证，服务器也不会校验随请求发来的凭据，
    // 直接返回「连接成功」会让用户以为填的 PAT 是对的——直到私有仓库上才炸。
    const anonCtx = buildNoAuthContext();
    try {
      const { stdout } = await execFileAsync('git', ['ls-remote', testUrl], {
        env: anonCtx.env,
        timeout: 30_000,
      });
      return {
        success: true,
        message: '仓库可匿名访问，本次测试未验证凭证有效性',
        details: String(stdout).split('\n')[0],
        anonymous: true,
      };
    } catch {
      // 匿名失败说明确实需要认证，继续用凭证试
    } finally {
      await anonCtx.cleanup();
    }

    const plainSecret = decrypt(credential.secret);
    const ctx = await buildGitAuthContext(
      { type: credential.type, username: credential.username, plainSecret },
      testUrl,
    );

    try {
      const { stdout } = await execFileAsync('git', [...ctx.extraArgs, 'ls-remote', testUrl], {
        env: ctx.env,
        timeout: 30_000,
      });
      return {
        success: true,
        message: '凭证有效，连接成功',
        details: String(stdout).split('\n')[0],
        anonymous: false,
      };
    } catch (error) {
      const msg = (error as Error).message ?? String(error);
      const sanitized = msg.replace(/https?:\/\/[^@\s]+@/g, 'https://***@');
      throw new BadRequestException(`连接测试失败: ${sanitized}`);
    } finally {
      await ctx.cleanup();
    }
  }

  /**
   * 通过凭证调用 git ls-remote 获取远程仓库的所有分支名
   * 支持 SSH / HTTPS (PAT + 密码) / GitHub / GitLab / Gitee 多平台
   */
  async listRemoteBranches(repoUrl: string, credentialId?: string): Promise<string[]> {
    let ctx = buildNoAuthContext();

    try {
      if (credentialId) {
        const credential = await this.prisma.gitCredential.findUnique({
          where: { id: credentialId },
        });
        if (!credential) throw new NotFoundException('凭证不存在');

        ctx = await buildGitAuthContext(
          {
            type: credential.type,
            username: credential.username,
            plainSecret: decrypt(credential.secret),
          },
          repoUrl,
        );
      }

      return await listBranchesWithContext(repoUrl, ctx);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      const msg = (error as Error).message ?? String(error);
      const sanitized = msg.replace(/https?:\/\/[^@\s]+@/g, 'https://***@');
      throw new BadRequestException(`获取分支失败: ${sanitized}`);
    } finally {
      await ctx.cleanup();
    }
  }
}

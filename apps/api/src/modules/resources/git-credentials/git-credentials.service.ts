import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateGitCredentialDto } from './dto/create-git-credential.dto';
import { UpdateGitCredentialDto } from './dto/update-git-credential.dto';
import { encrypt, decrypt } from '../../../common/utils/crypto.util';
import { User } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  buildGitAuthContext,
  buildNoAuthContext,
  listBranchesWithContext,
} from '../../../common/utils/git-auth.helper';

const execAsync = promisify(exec);

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

    const plainSecret = decrypt(credential.secret);
    const ctx = await buildGitAuthContext(
      { type: credential.type, username: credential.username, plainSecret },
      testUrl,
    );

    try {
      const { stdout } = await execAsync(`git ${ctx.extraArgs} ls-remote ${testUrl}`, {
        env: ctx.env,
        timeout: 30_000,
      });
      return { success: true, message: '连接成功', details: stdout.split('\n')[0] };
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

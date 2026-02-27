import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateGitCredentialDto } from './dto/create-git-credential.dto';
import { encrypt, decrypt } from '../../../common/utils/crypto.util';
import { User, GitCredentialType } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFile, unlink } from 'fs/promises';

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

  async findAll() {
    return await this.prisma.gitCredential.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        username: true,
        createdAt: true,
        createdById: true,
      },
      orderBy: { createdAt: 'desc' },
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
    /**
     * 在真实的 CI/CD 场景中，我们会将 SSH 密钥写入临时文件，
     * 使用 `GIT_SSH_COMMAND` 运行 `git ls-remote`，然后删除该文件。
     * 如果是 HTTPS，则在 URL 中附加 username:token。
     */
    const credential = await this.prisma.gitCredential.findUnique({ where: { id } });
    if (!credential) throw new NotFoundException('凭证不存在');

    const plainSecret = decrypt(credential.secret);

    if (credential.type === GitCredentialType.ssh) {
      const keyPath = join(tmpdir(), `id_rsa_test_${Date.now()}`);
      try {
        await writeFile(keyPath, plainSecret, { mode: 0o600 });
        const { stdout } = await execAsync(
          `GIT_SSH_COMMAND="ssh -i ${keyPath} -o StrictHostKeyChecking=no" git ls-remote ${testUrl}`,
        );
        return { success: true, message: '连接成功', details: stdout.split('\n')[0] };
      } catch (error) {
        throw new BadRequestException(`SSH 测试失败: ${(error as Error).message}`);
      } finally {
        await unlink(keyPath).catch(() => {});
      }
    } else {
      // HTTPS 方式
      const urlWithCreds = testUrl.replace(
        'https://',
        `https://${credential.username}:${plainSecret}@`,
      );
      try {
        // 运行 git ls-remote 进行验证
        const { stdout } = await execAsync(`git ls-remote ${urlWithCreds}`);
        return { success: true, message: '连接成功', details: stdout.split('\n')[0] };
      } catch (error) {
        throw new BadRequestException(`HTTPS 测试失败: ${(error as Error).message}`);
      }
    }
  }
}

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
    if (!credential) throw new NotFoundException('Credential not found');

    await this.prisma.gitCredential.delete({ where: { id } });
    return { success: true };
  }

  async findDecryptedSecret(id: string): Promise<string> {
    const credential = await this.prisma.gitCredential.findUnique({ where: { id } });
    if (!credential) throw new NotFoundException('Credential not found');

    return decrypt(credential.secret);
  }

  async testConnection(id: string, testUrl: string) {
    /**
     * In a real CI/CD scenario, we'll write the SSH key to a temp file,
     * use `GIT_SSH_COMMAND` to run `git ls-remote`, then delete the file.
     * Or if HTTPS, use username:token attached to URL.
     */
    const credential = await this.prisma.gitCredential.findUnique({ where: { id } });
    if (!credential) throw new NotFoundException('Credential not found');

    const plainSecret = decrypt(credential.secret);

    if (credential.type === GitCredentialType.ssh) {
      const keyPath = join(tmpdir(), `id_rsa_test_${Date.now()}`);
      try {
        await writeFile(keyPath, plainSecret, { mode: 0o600 });
        const { stdout } = await execAsync(
          `GIT_SSH_COMMAND="ssh -i ${keyPath} -o StrictHostKeyChecking=no" git ls-remote ${testUrl}`,
        );
        return { success: true, message: 'Connection successful', details: stdout.split('\n')[0] };
      } catch (error) {
        throw new BadRequestException(`SSH Test Failed: ${(error as Error).message}`);
      } finally {
        await unlink(keyPath).catch(() => {});
      }
    } else {
      // HTTPS
      const urlWithCreds = testUrl.replace(
        'https://',
        `https://${credential.username}:${plainSecret}@`,
      );
      try {
        // Run git ls-remote to verify
        const { stdout } = await execAsync(`git ls-remote ${urlWithCreds}`);
        return { success: true, message: 'Connection successful', details: stdout.split('\n')[0] };
      } catch (error) {
        throw new BadRequestException(`HTTPS Test Failed: ${(error as Error).message}`);
      }
    }
  }
}

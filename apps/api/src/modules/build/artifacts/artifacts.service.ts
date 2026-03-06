import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsExtra from 'fs-extra';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { TaskStatus } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createWriteStream } from 'fs';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const archiver = require('archiver') as (format: string, options?: object) => any;

@Injectable()
export class ArtifactsService {
  private readonly logger = new Logger(ArtifactsService.name);
  private readonly storageBaseDir = path.join(process.cwd(), 'public', 'storage');
  private readonly artifactsDir = path.join(process.cwd(), 'public', 'storage', 'artifacts');

  constructor(private readonly prisma: PrismaService) {
    this.initStorageDir().catch((err: unknown) => {
      const error = err as Error;
      this.logger.error(`Failed to initialize storage dir: ${error.message}`);
    });
  }

  private async initStorageDir() {
    try {
      await fs.mkdir(this.storageBaseDir, { recursive: true });
      await fs.mkdir(this.artifactsDir, { recursive: true });
    } catch {
      // ignore EEXIST - directory already exists
    }
  }

  /**
   * 将目录打包为 ZIP，返回存储路径（相对 /storage 开头）
   */
  async archiveDirectory(sourceDir: string, taskId: string): Promise<string> {
    await fsExtra.ensureDir(this.artifactsDir);
    const zipFileName = `artifact-${taskId}.zip`;
    const zipFilePath = path.join(this.artifactsDir, zipFileName);

    return new Promise((resolve, reject) => {
      const output = createWriteStream(zipFilePath);

      const archive = archiver('zip', { zlib: { level: 6 } });

      output.on('close', () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        this.logger.log(`产物打包完成: ${zipFilePath} (${archive.pointer()} bytes)`);
        resolve(`/storage/artifacts/${zipFileName}`);
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      archive.on('error', (err: Error) => reject(err));

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      archive.pipe(output);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      archive.directory(sourceDir, false);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      void archive.finalize();
    });
  }

  /**
   * 生成包含下载链接或预览链接的 Data URI 二维码
   */
  async generateQrCode(url: string): Promise<string> {
    try {
      return await QRCode.toDataURL(url);
    } catch (err) {
      this.logger.error('生成二维码失败', err);
      return '';
    }
  }

  /**
   * 将上传的产物关联到已完成的构建任务
   */
  async saveArtifact(taskId: string, artifactTempPath: string, previewUrl: string) {
    const task = await this.prisma.buildTask.findUnique({
      where: { id: BigInt(taskId) },
    });

    if (!task) {
      throw new Error('任务不存在');
    }

    // 真实的场景下，将 `artifactTempPath` 移动到 S3 bucket 或永久存储目录
    const destinationPath = path.join(this.storageBaseDir, `artifact-${taskId}.zip`);
    try {
      // 模拟移动
      await fs.rename(artifactTempPath, destinationPath);
    } catch {
      this.logger.warn(`模拟移动产物 ${taskId} 文件失败（可能不存在）`);
    }

    const qrcodeDataUri = await this.generateQrCode(previewUrl);

    return this.prisma.buildTask.update({
      where: { id: BigInt(taskId) },
      data: {
        status: TaskStatus.success,
        artifactPath: `/storage/artifact-${taskId}.zip`,
        qrcodePath: qrcodeDataUri, // 直接存储 data URI
      },
    });
  }

  /**
   * 立即对单个项目执行保留策略（构建成功后立即调用）
   */
  async enforceRetention(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, retentionCount: true, name: true },
    });

    if (!project || !project.retentionCount || project.retentionCount <= 0) return;

    await this.cleanupProjectArtifacts(project.id, project.retentionCount, project.name);
  }

  /**
   * 清理单个项目超出保留策略的产物
   */
  private async cleanupProjectArtifacts(
    projectId: string,
    retentionCount: number,
    projectName: string,
  ): Promise<void> {
    const tasks = await this.prisma.buildTask.findMany({
      where: {
        projectId,
        status: TaskStatus.success,
        artifactPath: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (tasks.length <= retentionCount) return;

    const tasksToDelete = tasks.slice(retentionCount);
    for (const task of tasksToDelete) {
      if (task.artifactPath) {
        const fileName = path.basename(task.artifactPath);
        // 尝试在 artifacts 子目录中找，也向上找 storageBaseDir
        const absolutePaths = [
          path.join(this.artifactsDir, fileName),
          path.join(this.storageBaseDir, fileName),
        ];
        for (const absolutePath of absolutePaths) {
          try {
            await fs.unlink(absolutePath);
            this.logger.log(`已删除产物文件: ${absolutePath}`);
            break;
          } catch (err) {
            const e = err as Error & { code?: string };
            if (e.code !== 'ENOENT') {
              this.logger.error(`删除产物文件失败 ${absolutePath}: ${e.message}`);
            }
          }
        }

        await this.prisma.buildTask.update({
          where: { id: task.id },
          data: {
            artifactPath: null,
            logPath: task.logPath
              ? task.logPath + '\n[SYSTEM] 产物因保留策略而被删除。'
              : '[SYSTEM] 产物因保留策略而被删除。',
          },
        });
      }
    }
    this.logger.log(`为项目 ${projectName} 清理了 ${tasksToDelete.length} 个产物`);
  }

  /**
   * 每天凌晨 3 点运行，清理超出项目保留策略的缓存产物
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldArtifacts() {
    this.logger.log('执行夜间产物清理定时任务...');
    const projects = await this.prisma.project.findMany({
      select: { id: true, retentionCount: true, name: true },
    });

    for (const project of projects) {
      if (!project.retentionCount || project.retentionCount <= 0) {
        continue;
      }
      await this.cleanupProjectArtifacts(project.id, project.retentionCount, project.name);
    }
    this.logger.log('夜间产物清理完成。');
  }
}

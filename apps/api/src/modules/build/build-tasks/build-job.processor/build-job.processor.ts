/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, DelayedError } from 'bullmq';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { BUILD_QUEUE_NAME, BuildJobData } from '../interfaces/build-job.interface';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { RobotPoolService } from '../../robot-pool/robot-pool.service';
import { BuildNotifier } from '../build-notifier.service';
import { ArtifactsService } from '../../artifacts/artifacts.service';
import { TaskStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import { decrypt } from '../../../../common/utils/crypto.util';
import { buildSignedPath } from '../../../../common/utils/signed-url.helper';
import AdmZip from 'adm-zip';
import { MiniprogramUploader } from '../miniprogram-uploader.service';
import { BuildRunner } from '../build-runner.service';

/** 用户取消任务时抛出的内部信号：跳过后续步骤，且不算构建失败 */
class TaskCanceledError extends Error {
  constructor() {
    super('TASK_CANCELED');
    this.name = 'TaskCanceledError';
  }
}

@Processor(BUILD_QUEUE_NAME, { concurrency: 3 })
export class BuildJobProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(BuildJobProcessor.name);

  /**
   * 构建日志目录。
   * 刻意不放在 public 下——日志包含仓库地址、分支、依赖安装输出等敏感信息，
   * 直接静态暴露时可被按自增 taskId 遍历，必须通过鉴权接口读取。
   */
  private readonly logDir = path.join(process.cwd(), 'var', 'logs');

  /** 上次检查依赖缓存体积的时间戳，避免每次构建都递归统计 */
  private lastCachePruneAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly robotPoolService: RobotPoolService,
    private readonly eventEmitter: EventEmitter2,
    private readonly artifactsService: ArtifactsService,
    private readonly notifier: BuildNotifier,
    private readonly uploader: MiniprogramUploader,
    private readonly runner: BuildRunner,
  ) {
    super();
  }

  async process(job: Job<BuildJobData, any, string>): Promise<any> {
    const data = job.data;

    // 历史版本快速上传走独立分支
    if (data.triggerType === 'reupload') {
      return this.processReupload(job);
    }

    const { taskId, projectId, branch, version, buildDesc: desc } = data;
    this.logger.log(
      `[Job ${job.id ?? 'unknown'}] 为任务 ID 开始构建执行: ${taskId} (项目: ${projectId})`,
    );

    // 1. 幂等保护：只有 pending 任务才允许执行。
    //    BullMQ 是 at-least-once，重投时任务可能已是 running / success / canceled，
    //    必须在这里短路，否则会重复上传微信、重复发通知。
    const task = await this.prisma.buildTask.findUnique({ where: { id: BigInt(taskId) } });
    if (!task) {
      this.logger.warn(`在数据库中找不到任务 ${taskId}，跳过该任务。`);
      return;
    }

    if (task.status !== TaskStatus.pending) {
      this.logger.warn(`任务 ${taskId} 当前状态为 ${task.status}，非 pending，跳过执行。`);
      return;
    }

    // 2. 获取项目详情以获取仓库 URL、构建命令和凭证
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { gitCredential: true, imRobots: { select: { robotId: true } } },
    });

    if (!project) {
      await this.markFailed(taskId, '项目配置缺失或已删除。');
      return;
    }

    // 3. 从 Redis 池获取一个机器人 ID
    // 如果没有可用的机器人 ID，我们在 BullMQ 中延迟任务稍后重试
    const robotId = await this.robotPoolService.acquireRobotId();
    if (robotId === null) {
      this.logger.warn(`[Job ${job.id ?? 'unknown'}] 没有可用的机器人 ID。延迟任务 ${taskId}。`);
      // 等待提示走日志通道，不再塞进 logPath（那个字段只存日志文件名）
      this.emitLog(taskId, '[SYSTEM] 暂无可用机器人，10 秒后自动重试');
      // 移回延迟队列，10 秒后重新调度。
      // 必须抛 DelayedError，BullMQ 才会把它当作「延迟」而不是「失败」，
      // 否则会消耗 attempts 并计入失败统计。
      await job.moveToDelayed(Date.now() + 10000, job.token);
      throw new DelayedError();
    }

    this.logger.log(`[Job ${job.id ?? 'unknown'}] 为任务 ${taskId} 获取了机器人 ID: ${robotId}`);

    try {
      // 4. 乐观锁抢占：把 pending 改成 running。
      //    count === 0 说明已被别的 worker 接管（或已被取消），直接放弃，finally 会归还 robot。
      const claimed = await this.prisma.buildTask.updateMany({
        where: { id: BigInt(taskId), status: TaskStatus.pending },
        data: { status: TaskStatus.running, robotId: robotId },
      });
      if (claimed.count === 0) {
        this.logger.warn(`任务 ${taskId} 已被其他 worker 抢占或已取消，放弃执行。`);
        return;
      }

      // 5. 构建执行逻辑
      this.logger.log(
        `[Job ${job.id ?? 'unknown'}] 正在对分支进行克隆和构建: ${branch}, 版本: ${version ?? 'N/A'}...`,
      );

      const logDest = path.join(this.logDir, `build-${taskId}.log`);
      await fs.ensureDir(this.logDir);
      await fs.remove(logDest).catch(() => {});

      this.emitLog(taskId, `开始构建分支 ${branch}...`);

      // 发送构建开始通知
      const triggerLabel = data.triggerType === 'webhook' ? 'Git Webhook' : '手动触发';
      const startContent = [
        `分支: ${branch}`,
        `版本: ${version ?? '未指定'}`,
        `触发方式: ${triggerLabel}`,
        data.commitMessage ? `提交内容: ${data.commitMessage}` : null,
        data.commitAuthor ? `提交者: ${data.commitAuthor}` : null,
        data.triggerUserName ? `操作人: ${data.triggerUserName}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      await this.notifier.notify(
        project.imRobots.map((r) => r.robotId),
        `🚀 开始构建: ${project.name}`,
        startContent,
      );

      // 使用系统临时目录，避免 pnpm 向上查找 monorepo 的 pnpm-workspace.yaml 导致破坏 API 的 node_modules
      const workspaceDir = path.join(os.tmpdir(), 'avocado-builds', taskId);
      await fs.emptyDir(workspaceDir);

      try {
        await this.assertNotCanceled(taskId);
        this.emitLog(taskId, `[1/4] 正在克隆仓库 ${project.repoUrl}...`);

        // 克隆、凭证注入与清理都封装在 BuildRunner 里
        const commitHash = await this.runner.cloneRepo({
          repoUrl: project.repoUrl,
          branch,
          workspaceDir,
          credential: project.gitCredential
            ? {
                name: project.gitCredential.name,
                type: project.gitCredential.type,
                username: project.gitCredential.username,
                plainSecret: decrypt(project.gitCredential.secret),
              }
            : null,
          onLog: (message) => this.emitLog(taskId, message),
        });

        // 记录本次构建对应的 commit，否则构建记录无法追溯到具体代码
        if (commitHash) {
          await this.prisma.buildTask.update({
            where: { id: BigInt(taskId) },
            data: { commitHash },
          });
          this.emitLog(taskId, `当前提交: ${commitHash.slice(0, 8)}`);
        }

        this.emitLog(taskId, `[2/4] 正在安装依赖项...`);
        await this.runner.installDependencies(workspaceDir, (message) =>
          this.emitLog(taskId, message),
        );

        await this.assertNotCanceled(taskId);
        this.emitLog(taskId, `[3/4] 运行构建命令（如果有的话）...`);
        await this.runner.runBuild({
          workspaceDir,
          buildCommand: project.buildCommand ?? null,
          framework: project.framework,
          onLog: (message) => this.emitLog(taskId, message),
        });

        await this.assertNotCanceled(taskId);
        this.emitLog(taskId, `[4/4] 正在通过 miniprogram-ci 上传到微信...`);
        const appId = project.appId;
        if (!appId) {
          throw new Error('项目缺少微信 AppID 配置。');
        }

        const projectPath = project.distPath
          ? path.join(workspaceDir, project.distPath)
          : workspaceDir;

        let privateKeyPath = path.join(workspaceDir, `private.${appId}.key`);

        // 优先使用数据库中保存的密钥文件路径
        if (project.privateKeyPath && (await fs.pathExists(project.privateKeyPath))) {
          privateKeyPath = project.privateKeyPath;
        } else {
          // 退回使用工作区中的密钥文件
          if (!(await fs.pathExists(privateKeyPath))) {
            privateKeyPath = path.join(workspaceDir, `private.key`);
          }
          if (!(await fs.pathExists(privateKeyPath))) {
            this.emitLog(
              taskId,
              `[WARN] 在 ${privateKeyPath} 没有找到小程序上传的私钥。上传可能会失败。`,
            );
          }
        }

        const qrcodeFileName = `qrcode-${taskId}.jpg`;
        const qrcodeDest = path.join(process.cwd(), 'public', 'storage', qrcodeFileName);
        await fs.ensureDir(path.join(process.cwd(), 'public', 'storage'));

        await this.uploader.uploadAndPreview(
          {
            appId,
            projectPath,
            privateKeyPath,
            version: version || '1.0.0',
            desc: desc || '自动化的 CI 构建',
            robotId,
            onLog: (message) => this.emitLog(taskId, message),
          },
          qrcodeDest,
        );

        // 将二维码图片转为 base64 推送到前端终端
        const qrcodeBase64 = await fs.readFile(qrcodeDest, { encoding: 'base64' });
        this.eventEmitter.emit('build.qrcode', {
          taskId,
          base64: `data:image/jpeg;base64,${qrcodeBase64}`,
        });
        this.emitLog(taskId, `[CI] 体验版二维码已生成，请在终端中查看。`);

        // 若开启历史版本，打包产物 ZIP
        let savedArtifactPath: string | undefined;
        if ((project as any).historyEnabled) {
          this.emitLog(taskId, `[历史版本] 正在打包产物为 ZIP...`);
          try {
            savedArtifactPath = await this.artifactsService.archiveDirectory(projectPath, taskId);
            this.emitLog(taskId, `[历史版本] 产物已保存: ${savedArtifactPath}`);
          } catch (e) {
            this.emitLog(
              taskId,
              `[历史版本] 打包产物失败（不影响构建结果）: ${(e as Error).message}`,
            );
          }
        }

        // 记录包体积（必须在清理工作区之前统计）
        const packageSize = await this.runner.dirSize(projectPath);
        this.emitLog(taskId, `[INFO] 产物大小: ${(packageSize / 1024).toFixed(1)} KB`);

        // 清理工作区
        await fs.remove(workspaceDir);

        this.logger.log(`[Job ${job.id ?? 'unknown'}] 构建成功完成！`);
        this.emitLog(taskId, `流程完全结束。正在验证产物...`);

        // 只在仍为 running 时写入成功，防止把用户已取消的任务覆盖成 success
        await this.prisma.buildTask.updateMany({
          where: { id: BigInt(taskId), status: TaskStatus.running },
          data: {
            status: TaskStatus.success,
            qrcodePath: `/storage/${qrcodeFileName}`,
            logPath: `build-${taskId}.log`,
            packageSize,
            ...(savedArtifactPath ? { artifactPath: savedArtifactPath } : {}),
          } as any,
        });

        // 如果开启历史版本，立即清理超出保留策略的旧产物
        if ((project as any).historyEnabled && savedArtifactPath) {
          await this.artifactsService.enforceRetention(project.id);
        }

        // 通知广播（包含体验版二维码图片）
        const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
        const qrcodeUrl = `${baseUrl}${buildSignedPath(`/storage/${qrcodeFileName}`)}`;

        await this.notifier.notify(
          project.imRobots.map((r) => r.robotId),
          `✅ 构建成功: ${project.name}`,
          `分支: ${branch}\n版本: ${version}`,
          qrcodeUrl,
          qrcodeUrl,
        );
      } catch (e: unknown) {
        // 在失败时清理
        await fs.remove(workspaceDir).catch(() => {});
        const execError = e as Error & { stderr?: string; stdout?: string };
        const detail = execError.stderr || execError.stdout || execError.message;
        this.emitLog(taskId, `[ERROR] ${detail}`);
        throw new Error(`执行失败: ${detail}`);
      }
    } catch (error) {
      // 用户主动取消不是失败，不要走 markFailed，也不要发失败通知
      if (error instanceof TaskCanceledError) {
        this.emitLog(taskId, '任务已被用户取消，停止执行。');
        this.logger.warn(`[Job ${job.id ?? 'unknown'}] 任务 ${taskId} 已被取消，停止执行`);
        return;
      }

      const err = error as Error;
      this.logger.error(`[Job ${job.id ?? 'unknown'}] 构建失败: ${err.message}`);
      this.emitLog(taskId, `[ERROR] 构建失败: ${err.message}`);
      await this.markFailed(taskId, err.message);

      const p = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: { imRobots: { select: { robotId: true } } },
      });
      if (p) {
        await this.notifier.notify(
          p.imRobots.map((r) => r.robotId),
          `❌ 构建失败: ${p.name}`,
          `原因: ${err.message}`,
        );
      }
    } finally {
      // 6. 务必将机器人 ID 释放回池中
      if (robotId !== null) {
        await this.robotPoolService.releaseRobotId(robotId);
        this.logger.log(`[Job ${job.id ?? 'unknown'}] 释放了机器人 ID: ${robotId}`);
      }
    }
  }

  /**
   * 历史版本快速上传处理：解压已有产物 -> miniprogram-ci 上传 -> 生成二维码 -> 通知
   */
  private async processReupload(job: Job<BuildJobData, any, string>): Promise<void> {
    const data = job.data;
    const { taskId, projectId, sourceArtifactTaskId, version, buildDesc: desc } = data;

    this.logger.log(`[Reupload Job] 任务 ${taskId} 开始历史版本上传`);

    const task = await this.prisma.buildTask.findUnique({ where: { id: BigInt(taskId) } });
    if (!task || task.status === TaskStatus.canceled) return;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { gitCredential: true, imRobots: { select: { robotId: true } } },
    });
    if (!project) {
      await this.markFailed(taskId, '项目配置缺失或已删除。');
      return;
    }

    // 获取源任务产物路径
    const sourceTask = await this.prisma.buildTask.findUnique({
      where: { id: BigInt(sourceArtifactTaskId!) },
    });
    if (!sourceTask?.artifactPath) {
      await this.markFailed(taskId, '源历史版本产物不存在或已被清理。');
      return;
    }

    const robotId = await this.robotPoolService.acquireRobotId();
    if (robotId === null) {
      await job.moveToDelayed(Date.now() + 10000, job.token);
      throw new DelayedError();
    }

    await fs.ensureDir(this.logDir);

    try {
      await this.prisma.buildTask.update({
        where: { id: BigInt(taskId) },
        data: { status: TaskStatus.running, robotId },
      });

      await this.notifier.notify(
        project.imRobots.map((r) => r.robotId),
        `🔄 历史版本上传开始: ${project.name}`,
        `版本: ${version ?? '未指定'}\n触发人: ${data.triggerUserName ?? '未知'}`,
      );

      // 解压产物 ZIP 到临时目录
      const zipFileName = path.basename(sourceTask.artifactPath);
      const zipAbsPath = path.join(
        process.cwd(),
        'public',
        sourceTask.artifactPath.replace(/^\/storage/, 'storage'),
      );
      if (!(await fs.pathExists(zipAbsPath))) {
        throw new Error(`产物 ZIP 文件不存在: ${zipAbsPath}`);
      }

      const workspaceDir = path.join(os.tmpdir(), 'avocado-reupload', taskId);
      await fs.emptyDir(workspaceDir);

      this.emitLog(taskId, `[1/3] 正在解压历史产物 ${zipFileName}...`);
      await new Promise<void>((resolve, reject) => {
        try {
          const zip = new AdmZip(zipAbsPath);
          zip.extractAllToAsync(workspaceDir, true, false, (error) => {
            if (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            } else {
              resolve();
            }
          });
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
      this.emitLog(taskId, `解压完成。`);

      const appId = project.appId;
      if (!appId) throw new Error('项目缺少微信 AppID 配置。');

      let privateKeyPath = path.join(workspaceDir, `private.${appId}.key`);
      if (project.privateKeyPath && (await fs.pathExists(project.privateKeyPath))) {
        privateKeyPath = project.privateKeyPath;
      }

      this.emitLog(taskId, `[2/3] 正在通过 miniprogram-ci 上传到微信...`);
      const qrcodeFileName = `qrcode-${taskId}.jpg`;
      const qrcodeDest = path.join(process.cwd(), 'public', 'storage', qrcodeFileName);
      await fs.ensureDir(path.join(process.cwd(), 'public', 'storage'));

      await this.uploader.uploadAndPreview(
        {
          appId,
          projectPath: workspaceDir,
          privateKeyPath,
          version: version || '1.0.0',
          desc: desc || '历史版本快速上传',
          robotId,
          onLog: (message) => this.emitLog(taskId, message),
        },
        qrcodeDest,
      );
      this.emitLog(taskId, `[3/3] 二维码已生成。`);

      const qrcodeBase64 = await fs.readFile(qrcodeDest, { encoding: 'base64' });
      this.eventEmitter.emit('build.qrcode', {
        taskId,
        base64: `data:image/jpeg;base64,${qrcodeBase64}`,
      });
      this.emitLog(taskId, `[CI] 体验版二维码已生成，请在终端中查看。`);

      await fs.remove(workspaceDir);

      await this.prisma.buildTask.update({
        where: { id: BigInt(taskId) },
        data: {
          status: TaskStatus.success,
          qrcodePath: `/storage/${qrcodeFileName}`,
          logPath: `build-${taskId}.log`,
        },
      });

      const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
      const qrcodeUrl = `${baseUrl}${buildSignedPath(`/storage/${qrcodeFileName}`)}`;
      await this.notifier.notify(
        project.imRobots.map((r) => r.robotId),
        `✅ 历史版本上传成功: ${project.name}`,
        `版本: ${version}\n触发人: ${data.triggerUserName ?? '未知'}`,
        qrcodeUrl,
        qrcodeUrl,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(`[Reupload] 历史版本上传失败: ${err.message}`);
      this.emitLog(taskId, `[ERROR] 上传失败: ${err.message}`);
      await this.markFailed(taskId, err.message);
      const p = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: { imRobots: { select: { robotId: true } } },
      });
      if (p) {
        await this.notifier.notify(
          p.imRobots.map((r) => r.robotId),
          `❌ 历史版本上传失败: ${p.name}`,
          `原因: ${err.message}`,
        );
      }
    } finally {
      if (robotId !== null) {
        await this.robotPoolService.releaseRobotId(robotId);
      }
    }
  }

  /**
   * 关键节点校验任务是否已被用户取消。
   * 取消无法中断已发出的 ci.upload，但可以阻止后续步骤继续推进。
   */
  private async assertNotCanceled(taskId: string): Promise<void> {
    const current = await this.prisma.buildTask.findUnique({
      where: { id: BigInt(taskId) },
      select: { status: true },
    });
    if (current?.status === TaskStatus.canceled) {
      throw new TaskCanceledError();
    }
  }

  private async markFailed(taskId: string, reason: string) {
    this.emitLog(taskId, `[SYSTEM ERROR] ${reason}`);
    // 只在 pending/running 时标记失败，避免把用户已取消的任务覆盖成 failed。
    // 失败原因写入独立字段，logPath 只保留日志路径，避免前端把它当 URL 用坏。
    await this.prisma.buildTask.updateMany({
      where: {
        id: BigInt(taskId),
        status: { in: [TaskStatus.pending, TaskStatus.running] },
      },
      data: {
        status: TaskStatus.failed,
        failReason: reason.slice(0, 2000),
        logPath: `build-${taskId}.log`,
      },
    });
  }

  async onApplicationBootstrap() {
    await this.pruneOrphanWorkspaces();
  }

  /**
   * 清理进程崩溃后残留在系统临时目录里的构建工作区（保留 24 小时内）
   */
  private async pruneOrphanWorkspaces(): Promise<void> {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const dirs = [
      path.join(os.tmpdir(), 'avocado-builds'),
      path.join(os.tmpdir(), 'avocado-reupload'),
    ];

    for (const dir of dirs) {
      try {
        if (!(await fs.pathExists(dir))) continue;
        const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
        let removed = 0;
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          const stat = await fs.stat(full).catch(() => null);
          if (stat && stat.mtimeMs < cutoff) {
            await fs.remove(full).catch(() => {});
            removed += 1;
          }
        }
        if (removed > 0) {
          this.logger.log(`清理残留构建工作区 ${removed} 个: ${dir}`);
        }
      } catch {
        // 清理失败不应阻塞启动
      }
    }
  }

  /**
   * 每天清理过期日志与二维码，避免磁盘占用随构建次数线性增长。
   * 产物 ZIP 由 artifacts.enforceRetention 按项目 retentionCount 控制。
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanupOldArtifacts(): Promise<void> {
    const LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
    const QRCODE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let logCount = 0;
    let qrCount = 0;

    const logFiles = await fs.readdir(this.logDir).catch(() => [] as string[]);
    for (const name of logFiles) {
      const full = path.join(this.logDir, name);
      const stat = await fs.stat(full).catch(() => null);
      if (stat && now - stat.mtimeMs > LOG_RETENTION_MS) {
        await fs.remove(full).catch(() => {});
        logCount += 1;
      }
    }

    const qrDir = path.join(process.cwd(), 'public', 'storage');
    const qrFiles = await fs.readdir(qrDir).catch(() => [] as string[]);
    for (const name of qrFiles) {
      if (!name.startsWith('qrcode-')) continue;
      const full = path.join(qrDir, name);
      const stat = await fs.stat(full).catch(() => null);
      if (stat && now - stat.mtimeMs > QRCODE_RETENTION_MS) {
        await fs.remove(full).catch(() => {});
        qrCount += 1;
      }
    }

    if (logCount > 0 || qrCount > 0) {
      this.logger.log(`清理过期文件：日志 ${logCount} 个，二维码 ${qrCount} 个`);
    }
  }

  private emitLog(taskId: string, chunk: string) {
    this.eventEmitter.emit('build.log', { taskId, logChunk: chunk });
    const logDest = path.join(this.logDir, `build-${taskId}.log`);
    // 目录可能在任务刚开始时还不在，这里自行保证
    fs.ensureDir(this.logDir)
      .then(() => fs.appendFile(logDest, chunk + '\n'))
      .catch(() => {});
  }
}

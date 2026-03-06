/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { BUILD_QUEUE_NAME, BuildJobData } from '../interfaces/build-job.interface';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { RobotPoolService } from '../../robot-pool/robot-pool.service';
import { ImRobotsService } from '../../../resources/im-robots/im-robots.service';
import { ArtifactsService } from '../../artifacts/artifacts.service';
import { TaskStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import * as crypto from 'crypto';
import axios from 'axios';
import {
  buildGitAuthContext,
  buildNoAuthContext,
  type GitAuthContext,
} from '../../../../common/utils/git-auth.helper';
import { decrypt } from '../../../../common/utils/crypto.util';
import AdmZip from 'adm-zip';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as ci from 'miniprogram-ci';

@Processor(BUILD_QUEUE_NAME)
export class BuildJobProcessor extends WorkerHost {
  private readonly logger = new Logger(BuildJobProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly robotPoolService: RobotPoolService,
    private readonly eventEmitter: EventEmitter2,
    private readonly imRobotsService: ImRobotsService,
    private readonly artifactsService: ArtifactsService,
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

    // 1. 在数据库中再次检查任务状态（可能已被取消）
    const task = await this.prisma.buildTask.findUnique({ where: { id: BigInt(taskId) } });
    if (!task) {
      this.logger.warn(`在数据库中找不到任务 ${taskId}，跳过该任务。`);
      return;
    }

    if (task.status === TaskStatus.canceled || task.status === TaskStatus.failed) {
      this.logger.warn(`任务 ${taskId} 已经是 ${task.status} 状态。中止。`);
      return;
    }

    // 2. 获取项目详情以获取仓库 URL、构建命令和凭证
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { gitCredential: true },
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
      await this.prisma.buildTask.update({
        where: { id: BigInt(taskId) },
        data: { logPath: '正在等待可用的机器人 ID...' },
      });
      // 将此作业移回延迟状态，10 秒后重试
      await job.moveToDelayed(Date.now() + 10000, job.token);
      // 抛出错误也有助于 bullmq 知道它还没有 "完成"，但抛出可能会触发失败计数。
      // 最直接的实现无失败重试的原生方式是延迟 + 抛出特殊的错误，或者如果配置了重试则抛出正常的错误。
      throw new Error('没有可用的机器人，排队等待重试');
    }

    this.logger.log(`[Job ${job.id ?? 'unknown'}] 为任务 ${taskId} 获取了机器人 ID: ${robotId}`);

    try {
      // 4. 将任务标记为 RUNNING(运行中) 并分配机器人 ID
      await this.prisma.buildTask.update({
        where: { id: BigInt(taskId) },
        data: { status: TaskStatus.running, robotId: robotId },
      });

      // 5. 构建执行逻辑
      this.logger.log(
        `[Job ${job.id ?? 'unknown'}] 正在对分支进行克隆和构建: ${branch}, 版本: ${version ?? 'N/A'}...`,
      );

      const logDir = path.join(process.cwd(), 'public', 'storage', 'logs');
      const logDest = path.join(logDir, `build-${taskId}.log`);
      await fs.ensureDir(logDir);
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

      await this.notifyRobots(
        project.imRobotIds as string[] | null,
        `🚀 开始构建: ${project.name}`,
        startContent,
      );

      // 使用系统临时目录，避免 pnpm 向上查找 monorepo 的 pnpm-workspace.yaml 导致破坏 API 的 node_modules
      const workspaceDir = path.join(os.tmpdir(), 'avocado-builds', taskId);
      await fs.emptyDir(workspaceDir);

      try {
        this.emitLog(taskId, `[1/4] 正在克隆仓库 ${project.repoUrl}...`);

        // 构建 git 认证上下文（支持私有仓库 SSH / HTTPS PAT / 密码）
        let gitAuth: GitAuthContext = buildNoAuthContext();
        if (project.gitCredential) {
          try {
            gitAuth = await buildGitAuthContext(
              {
                type: project.gitCredential.type,
                username: project.gitCredential.username,
                plainSecret: decrypt(project.gitCredential.secret),
              },
              project.repoUrl,
            );
            this.emitLog(taskId, `已加载 Git 凭证: ${project.gitCredential.name}`);
          } catch (e) {
            this.emitLog(
              taskId,
              `[WARN] 加载 Git 凭证失败，将尝试匿名克隆: ${(e as Error).message}`,
            );
          }
        }

        try {
          // git clone 使用认证上下文（私有仓库需要凭证，公开仓库无凭证也可）
          await this.runCommand(
            `git ${gitAuth.extraArgs} clone --depth 50 -b ${branch} ${project.repoUrl} .`,
            workspaceDir,
            taskId,
            gitAuth.env,
          );
          this.emitLog(taskId, `克隆成功。`);
        } finally {
          // 必须在克隆完成后清理临时凭证文件
          await gitAuth.cleanup();
        }

        this.emitLog(taskId, `[2/4] 正在安装依赖项...`);
        if (await fs.pathExists(path.join(workspaceDir, 'package.json'))) {
          const installCmd = await this.detectInstallCommand(workspaceDir);
          this.emitLog(taskId, `使用命令: ${installCmd}`);
          await this.runCommand(installCmd, workspaceDir, taskId);
          this.emitLog(taskId, `依赖安装完成。`);
        } else {
          this.emitLog(taskId, `未找到 package.json，跳过依赖安装。`);
        }

        this.emitLog(taskId, `[3/4] 运行构建命令（如果有的话）...`);
        if (project.framework === 'uniapp') {
          if (!project.buildCommand) {
            throw new Error('UniApp 项目需要构建命令 (例如 npm run build:mp-weixin)');
          }
          this.emitLog(taskId, `执行 UniApp 构建命令: ${project.buildCommand}`);
          await this.runCommand(project.buildCommand, workspaceDir, taskId);
          this.emitLog(taskId, `构建命令完成。`);
        } else if (project.buildCommand) {
          await this.runCommand(project.buildCommand, workspaceDir, taskId);
          this.emitLog(taskId, `构建命令完成。`);
        }

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

        const mpProject = new ci.Project({
          appid: appId,
          type: 'miniProgram',
          projectPath: projectPath,
          privateKeyPath: privateKeyPath,
          ignores: ['node_modules/**/*'],
        });

        try {
          await ci.upload({
            project: mpProject,
            version: version || '1.0.0',
            desc: desc || '自动化的 CI 构建',
            setting: { es6: true, minify: true },
            onProgressUpdate: (task: any) => {
              this.emitLog(taskId, `[CI] ${JSON.stringify(task)}...`);
            },
          });

          this.emitLog(taskId, `成功上传到微信！`);

          // 生成体验版二维码
          this.emitLog(taskId, `[CI] 正在生成体验版二维码...`);

          await ci.preview({
            project: mpProject,
            version: version || '1.0.0',
            desc: desc || '自动化的 CI 构建',
            setting: { es6: true, minify: true },
            qrcodeFormat: 'image',
            qrcodeOutputDest: qrcodeDest,
            onProgressUpdate: (task: any) => {
              if (task._status === 'doing') {
                this.emitLog(taskId, `[CI] ${task._msg}...`);
              } else if (task._status === 'done') {
                this.emitLog(taskId, `[CI] ✔ ${task._msg}`);
              }
            },
          });
        } finally {
          // 清理 miniprogram-ci 生成的恶心哈希缓存目录
          // 代码参考 miniprogram-ci 的 createSummer.js:
          // ensureCacheDir() {
          //   const e = path_1.default.join("", (0,tools_1.generateMD5)(this.project.projectPath + "|summer"));
          //   return (0,tools_1.mkdirSync)(e), e;
          // }
          try {
            const cacheDirHash = crypto
              .createHash('md5')
              .update(projectPath + '|summer')
              .digest('hex');

            const cacheDirPath = path.join(process.cwd(), cacheDirHash);
            if (await fs.pathExists(cacheDirPath)) {
              await fs.remove(cacheDirPath);
            }
          } catch (e) {
            this.emitLog(
              taskId,
              `[WARN] 清理 miniprogram-ci 缓存目录失败: ${(e as Error).message}`,
            );
          }
        }

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

        // 清理工作区
        await fs.remove(workspaceDir);

        this.logger.log(`[Job ${job.id ?? 'unknown'}] 构建成功完成！`);
        this.emitLog(taskId, `流程完全结束。正在验证产物...`);

        await this.prisma.buildTask.update({
          where: { id: BigInt(taskId) },
          data: {
            status: TaskStatus.success,
            qrcodePath: `/storage/${qrcodeFileName}`,
            logPath: `/storage/logs/build-${taskId}.log`,
            ...(savedArtifactPath ? { artifactPath: savedArtifactPath } : {}),
          } as any,
        });

        // 如果开启历史版本，立即清理超出保留策略的旧产物
        if ((project as any).historyEnabled && savedArtifactPath) {
          await this.artifactsService.enforceRetention(project.id);
        }

        // 通知广播（包含体验版二维码图片）
        const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
        const qrcodeUrl = `${baseUrl}/storage/${qrcodeFileName}`;

        await this.notifyRobots(
          project.imRobotIds as string[] | null,
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
      const err = error as Error;
      this.logger.error(`[Job ${job.id ?? 'unknown'}] 构建失败: ${err.message}`);
      this.emitLog(taskId, `[ERROR] 构建失败: ${err.message}`);
      await this.markFailed(taskId, err.message);

      const p = await this.prisma.project.findUnique({ where: { id: projectId } });
      if (p) {
        await this.notifyRobots(
          p.imRobotIds as string[] | null,
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
      include: { gitCredential: true },
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
      throw new Error('没有可用的机器人，排队等待重试');
    }

    const logDir = path.join(process.cwd(), 'public', 'storage', 'logs');
    await fs.ensureDir(logDir);

    try {
      await this.prisma.buildTask.update({
        where: { id: BigInt(taskId) },
        data: { status: TaskStatus.running, robotId },
      });

      await this.notifyRobots(
        project.imRobotIds as string[] | null,
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

      const mpProject = new ci.Project({
        appid: appId,
        type: 'miniProgram',
        projectPath: workspaceDir,
        privateKeyPath,
        ignores: ['node_modules/**/*'],
      });

      this.emitLog(taskId, `[2/3] 正在通过 miniprogram-ci 上传到微信...`);
      await ci.upload({
        project: mpProject,
        version: version || '1.0.0',
        desc: desc || '历史版本快速上传',
        setting: { es6: true, minify: true },
        onProgressUpdate: (t: any) => {
          this.emitLog(taskId, `[CI] ${JSON.stringify(t)}...`);
        },
      });
      this.emitLog(taskId, `成功上传到微信！`);

      this.emitLog(taskId, `[3/3] 正在生成体验版二维码...`);
      const qrcodeFileName = `qrcode-${taskId}.jpg`;
      const qrcodeDest = path.join(process.cwd(), 'public', 'storage', qrcodeFileName);
      await fs.ensureDir(path.join(process.cwd(), 'public', 'storage'));

      await ci.preview({
        project: mpProject,
        version: version || '1.0.0',
        desc: desc || '历史版本快速上传',
        setting: { es6: true, minify: true },
        qrcodeFormat: 'image',
        qrcodeOutputDest: qrcodeDest,
        onProgressUpdate: (t: any) => {
          if (t._status === 'done') this.emitLog(taskId, `[CI] ✔ ${t._msg}`);
        },
      });

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
          logPath: `/storage/logs/build-${taskId}.log`,
        },
      });

      const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
      const qrcodeUrl = `${baseUrl}/storage/${qrcodeFileName}`;
      await this.notifyRobots(
        project.imRobotIds as string[] | null,
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
      const p = await this.prisma.project.findUnique({ where: { id: projectId } });
      if (p) {
        await this.notifyRobots(
          p.imRobotIds as string[] | null,
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

  private async markFailed(taskId: string, reason: string) {
    await this.prisma.buildTask.update({
      where: { id: BigInt(taskId) },
      data: {
        status: TaskStatus.failed,
        logPath: `/storage/logs/build-${taskId}.log\n[SYSTEM ERROR]: ${reason}`,
      },
    });
  }

  private emitLog(taskId: string, chunk: string) {
    this.eventEmitter.emit('build.log', { taskId, logChunk: chunk });
    const logDest = path.join(process.cwd(), 'public', 'storage', 'logs', `build-${taskId}.log`);
    fs.appendFile(logDest, chunk + '\n').catch(() => {});
  }

  private async notifyRobots(
    robotIds: string[] | null,
    title: string,
    content: string,
    linkUrl?: string,
    imageUrl?: string,
  ) {
    if (!robotIds || !Array.isArray(robotIds) || robotIds.length === 0) return;

    const robots = await this.prisma.imRobot.findMany({
      where: { id: { in: robotIds } },
    });

    for (const robot of robots) {
      try {
        const { finalUrl, payload } = this.imRobotsService.buildWebhookMessage(
          robot,
          title,
          content,
          linkUrl,
          imageUrl,
        );

        await axios.post(finalUrl, payload);
      } catch (error) {
        this.logger.error(`Failed to notify robot ${robot.name}: ${(error as Error).message}`);
      }
    }
  }

  /**
   * 根据 lock 文件、packageManager 字段、preinstall 脚本自动检测包管理器
   */
  private async detectInstallCommand(workspaceDir: string): Promise<string> {
    // 1. 优先检查 lock 文件
    if (await fs.pathExists(path.join(workspaceDir, 'pnpm-lock.yaml'))) {
      return 'pnpm install --no-frozen-lockfile';
    }
    if (await fs.pathExists(path.join(workspaceDir, 'yarn.lock'))) {
      return 'yarn install';
    }

    // 2. 读取 package.json 检查 packageManager 字段和 preinstall 脚本
    try {
      const pkgJson = (await fs.readJson(path.join(workspaceDir, 'package.json'))) as {
        packageManager?: string;
        scripts?: { preinstall?: string };
      };
      const packageManager = pkgJson.packageManager;
      const preinstall = pkgJson.scripts?.preinstall;

      if (packageManager?.startsWith('pnpm') || preinstall?.includes('only-allow pnpm')) {
        return 'pnpm install --no-frozen-lockfile';
      }
      if (packageManager?.startsWith('yarn') || preinstall?.includes('only-allow yarn')) {
        return 'yarn install';
      }
    } catch {
      // package.json 解析失败则忽略
    }

    // 3. 默认 npm
    return 'npm install --legacy-peer-deps --force';
  }

  /**
   * 使用 spawn 执行 shell 命令，实时流式推送 stdout/stderr 日志
   * @param command  要执行的命令字符串
   * @param cwd      工作目录
   * @param taskId   构建任务 ID（用于日志推送）
   * @param extraEnv 额外注入的环境变量（用于 git 认证等场景）
   */
  private runCommand(
    command: string,
    cwd: string,
    taskId: string,
    extraEnv?: NodeJS.ProcessEnv,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, {
        cwd,
        shell: true,
        env: { ...process.env, CI: 'true', ...extraEnv },
      });

      let lastStderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().trim().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            this.emitLog(taskId, line);
          }
        }
      });

      child.stderr?.on('data', (data: Buffer) => {
        const text = data.toString().trim();
        lastStderr = text;
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            this.emitLog(taskId, `[stderr] ${line}`);
          }
        }
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(lastStderr || `命令退出码: ${code}`));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });

      // 10 分钟超时
      setTimeout(
        () => {
          child.kill();
          reject(new Error('命令执行超时 (10 分钟)'));
        },
        10 * 60 * 1000,
      );
    });
  }
}

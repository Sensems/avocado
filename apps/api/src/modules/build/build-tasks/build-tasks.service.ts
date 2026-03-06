import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { TriggerBuildDto } from './dto/trigger-build.dto';
import { User, TaskStatus } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import * as crypto from 'crypto';
import { Queue } from 'bullmq';
import { BUILD_QUEUE_NAME, BuildJobData } from './interfaces/build-job.interface';
import { RobotPoolService } from '../robot-pool/robot-pool.service';

@Injectable()
export class BuildTasksService {
  private readonly logger = new Logger(BuildTasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(BUILD_QUEUE_NAME) private buildQueue: Queue,
    private readonly robotPoolService: RobotPoolService,
  ) {}

  /**
   * 从前端 UI 手动触发构建
   */
  async triggerBuild(dto: TriggerBuildDto, user: User) {
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException('项目不存在');

    // 如果未提供，则自动生成版本号（例如 YYYYMMDDHHmmss）
    const version = dto.version || this.generateAutoVersion();

    const task = await this.prisma.buildTask.create({
      data: {
        projectId: dto.projectId,
        version: version,
        branch: dto.branch,
        desc: dto.buildDesc || '手动 UI 触发',
        status: TaskStatus.pending,
        triggerUserId: user.id,
      } as any, // Cast to any because TS server cache hasn't caught up with Prisma DB push
    });

    this.logger.log(`为项目 ${project.name} 创建了新的构建任务 ${task.id}`);

    // 推送到 BullMQ
    const jobData: BuildJobData = {
      taskId: task.id.toString(),
      projectId: task.projectId,
      branch: (task as any).branch,
      version: task.version || undefined,
      buildDesc: (task as any).desc || '',
      triggeredById: user.id,
      triggerType: 'manual',
      triggerUserName: user.username,
    };

    await this.buildQueue.add('execute-build', jobData, {
      jobId: `build-${task.id.toString()}`,
      removeOnComplete: true, // 保持 redis 清洁，我们依赖 Postgres 来记录历史
      removeOnFail: false,
    });

    return task;
  }

  /**
   * 处理来自 Git 的 Webhook（例如 GitHub/GitLab 推送到分支）
   */
  async handleWebhook(projectId: string, payload: any, headers: Record<string, string>) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { members: { orderBy: { createdAt: 'asc' }, take: 1 } },
    });
    if (!project) throw new NotFoundException('项目不存在');

    // Webhook Secret 校验逻辑
    // @ts-ignore (webhookSecret is newly added to Prisma schema)
    const secret = project.webhookSecret as string | null | undefined;
    if (secret) {
      const gitlabToken = headers['x-gitlab-token'];
      const giteeToken = headers['x-gitee-token'] || headers['x-gitee-ping'];
      const githubSignature = headers['x-hub-signature-256'];

      let isValid = false;

      if (gitlabToken && gitlabToken === secret) {
        isValid = true;
      } else if (giteeToken && giteeToken === secret) {
        isValid = true;
      } else if (githubSignature) {
        // GitHub uses HMAC hex digest
        const hmac = crypto.createHmac('sha256', secret);
        const digest = 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');
        if (crypto.timingSafeEqual(Buffer.from(githubSignature), Buffer.from(digest))) {
          isValid = true;
        }
      }

      if (!isValid) {
        this.logger.warn(`Webhook 签名校验失败: 项目 ${project.name} (${projectId})`);
        throw new UnauthorizedException('Webhook 签名校验失败');
      }
    }

    // 从 payload 中提取分支依赖于 git 平台（目前假设通用的 refs/heads/xxx）
    let branch = 'main';
    if (payload.ref && typeof payload.ref === 'string') {
      branch = payload.ref.replace('refs/heads/', '');
    }

    // 仅当推送分支与项目默认分支匹配时才触发构建
    const targetBranch = (project as any).defaultBranch || 'main';
    if (branch !== targetBranch) {
      this.logger.log(
        `跳过分支 ${branch} 的推送，仅 ${targetBranch} 会触发构建 (项目: ${project.name})`,
      );
      return {
        success: false,
        message: `分支 ${branch} 不匹配默认构建分支 ${targetBranch}，已忽略`,
      };
    }

    // 基于历史构建版本号自增 patch 位，而非使用时间戳
    const version = await this.getNextSemver(project.id);
    const commitMessage: string =
      payload.head_commit?.message || payload.commits?.[0]?.message || 'Webhook 触发';
    const commitAuthor: string = payload.head_commit?.author?.name || payload.user_name || '未知';

    const task = await this.prisma.buildTask.create({
      data: {
        projectId: project.id,
        version: version,
        branch: branch,
        desc: `[Webhook] ${commitMessage}`,
        status: TaskStatus.pending,
        triggerUserId: project.members?.[0]?.userId || 'SYSTEM', // 更好的后备方案
      } as any,
    });

    const jobData: BuildJobData = {
      taskId: task.id.toString(),
      projectId: task.projectId,
      branch: (task as any).branch,
      version: task.version || undefined,
      buildDesc: (task as any).desc || '',
      triggerType: 'webhook',
      commitMessage,
      commitAuthor,
    };

    await this.buildQueue.add('execute-build', jobData, {
      jobId: `build-webhook-${task.id.toString()}`,
      removeOnComplete: true,
      removeOnFail: false,
    });

    return { success: true, taskId: task.id.toString(), message: '已接受 Webhook 构建' };
  }

  /**
   * 获取项目的构建历史记录
   */
  async getTasksByProject(projectId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.buildTask.findMany({
        where: { projectId },
        include: { triggerUser: { select: { id: true, username: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.buildTask.count({
        where: { projectId },
      }),
    ]);
    return { items, total };
  }

  /**
   * 取消等待中或正在运行的构建
   */
  async cancelTask(taskId: string) {
    const task = await this.prisma.buildTask.findUnique({ where: { id: BigInt(taskId) } });
    if (!task) throw new NotFoundException('任务不存在');

    if (task.status === TaskStatus.success || task.status === TaskStatus.failed) {
      throw new BadRequestException(`无法取消状态已经是 ${task.status} 的任务`);
    }

    // 尝试从队列中移除（如果尚未开始）
    const job = await this.buildQueue.getJob(`build-${task.id.toString()}`);
    if (job && (await job.isActive()) === false) {
      await job.remove();
    }

    // 更新数据库状态
    const updated = await this.prisma.buildTask.update({
      where: { id: BigInt(taskId) },
      data: { status: TaskStatus.failed, logPath: '构建被用户取消' },
    });

    // 如果它绑定了机器人 ID，我们必须强制释放它
    if (task.robotId) {
      this.logger.log(`由于任务 ${task.id} 被取消，强制释放机器人 ID ${task.robotId}`);
      await this.robotPoolService.releaseRobotId(task.robotId);
    }

    return updated;
  }

  /**
   * 删除构建任务
   */
  async deleteTask(taskId: string) {
    const task = await this.prisma.buildTask.findUnique({ where: { id: BigInt(taskId) } });
    if (!task) throw new NotFoundException('任务不存在');

    // 尝试从队列中移除（如果尚未开始）
    const job = await this.buildQueue.getJob(`build-${task.id.toString()}`);
    if (job && (await job.isActive()) === false) {
      await job.remove();
    }

    // 如果它绑定了机器人 ID，释放它
    if (task.robotId) {
      this.logger.log(`由于任务 ${task.id} 被删除，释放机器人 ID ${task.robotId}`);
      await this.robotPoolService.releaseRobotId(task.robotId);
    }

    // 从数据库中删除
    await this.prisma.buildTask.delete({
      where: { id: BigInt(taskId) },
    });

    return { success: true };
  }

  /**
   * 从历史版本产物快速重新上传到微信小程序
   */
  async reuploadFromHistory(sourceTaskId: string, user: User) {
    const sourceTask = await this.prisma.buildTask.findUnique({
      where: { id: BigInt(sourceTaskId) },
      include: { project: true },
    });

    if (!sourceTask) throw new NotFoundException('构建任务不存在');
    if (!sourceTask.artifactPath) {
      throw new BadRequestException('该版本没有保存的产物，无法进行快速上传');
    }

    // @ts-ignore (historyEnabled is newly added)
    if (!(sourceTask.project as any).historyEnabled) {
      throw new BadRequestException('该项目未开启历史版本功能');
    }

    // 创建一个新的追踪任务
    const newTask = await this.prisma.buildTask.create({
      data: {
        projectId: sourceTask.projectId,
        version: sourceTask.version,
        branch: (sourceTask as any).branch || 'main',
        desc: `[历史版本上传] 来自构建 #${sourceTaskId}`,
        status: TaskStatus.pending,
        triggerUserId: user.id,
      } as any,
    });

    const jobData: BuildJobData = {
      taskId: newTask.id.toString(),
      projectId: sourceTask.projectId,
      branch: (sourceTask as any).branch || 'main',
      version: sourceTask.version || undefined,
      buildDesc: `历史版本快速上传（来自 #${sourceTaskId}）`,
      triggeredById: user.id,
      triggerType: 'reupload',
      triggerUserName: user.username,
      sourceArtifactTaskId: sourceTaskId,
    };

    await this.buildQueue.add('execute-build', jobData, {
      jobId: `reupload-${newTask.id.toString()}`,
      removeOnComplete: true,
      removeOnFail: false,
    });

    this.logger.log(`为历史版本 ${sourceTaskId} 创建了重新上传任务 ${newTask.id}`);

    return newTask;
  }

  private generateAutoVersion(): string {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  }

  /**
   * 查询项目最近一条 semver 格式版本号，patch 位 +1。
   * 无匹配记录时返回 1.0.0。
   */
  private async getNextSemver(projectId: string): Promise<string> {
    const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;

    // 取最近 20 条构建记录，从中找到最新的 semver 版本号
    const recentTasks = await this.prisma.buildTask.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { version: true },
    });

    for (const task of recentTasks) {
      if (task.version && SEMVER_REGEX.test(task.version)) {
        const parts = task.version.split('.');
        const patch = parseInt(parts[2], 10);
        return `${parts[0]}.${parts[1]}.${patch + 1}`;
      }
    }

    return '1.0.0';
  }
}

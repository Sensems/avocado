import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs-extra';
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

    // 版本号唯一性：同一项目内已用过的版本号不再允许重复上传，
    // 微信侧也会拒绝，但等它报错时构建已经跑完一轮了
    if (dto.version) {
      const duplicated = await this.prisma.buildTask.findFirst({
        where: { projectId: dto.projectId, version: dto.version, status: TaskStatus.success },
        select: { id: true },
      });
      if (duplicated) {
        throw new ConflictException(`版本号 ${dto.version} 已存在成功的构建记录，请更换版本号`);
      }
    }

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
   * 读取构建日志全文。
   * 日志文件存放在 var/logs（不在 public 下），必须经过此方法做权限校验，
   * 否则可以按自增 taskId 遍历拿到所有项目的构建日志。
   */
  async readLog(taskId: string, user: User) {
    if (!/^\d+$/.test(taskId)) {
      throw new BadRequestException('非法的任务 ID');
    }

    const task = await this.prisma.buildTask.findUnique({
      where: { id: BigInt(taskId) },
      select: { projectId: true },
    });
    if (!task) throw new NotFoundException('任务不存在');

    // 超管可读全部；普通用户必须是该项目成员
    if (!user.isSuperAdmin) {
      const member = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: task.projectId, userId: user.id } },
      });
      if (!member) throw new ForbiddenException('无权访问该构建日志');
    }

    const logFile = path.join(process.cwd(), 'var', 'logs', `build-${taskId}.log`);
    if (!(await fs.pathExists(logFile))) {
      return { content: '', exists: false };
    }

    const content = await fs.readFile(logFile, 'utf-8');
    return { content, exists: true };
  }

  /**
   * 取消等待中或正在运行的构建
   */
  async cancelTask(taskId: string) {
    const task = await this.prisma.buildTask.findUnique({ where: { id: BigInt(taskId) } });
    if (!task) throw new NotFoundException('任务不存在');

    if (
      task.status === TaskStatus.success ||
      task.status === TaskStatus.failed ||
      task.status === TaskStatus.canceled
    ) {
      throw new BadRequestException(`无法取消状态已经是 ${task.status} 的任务`);
    }

    // 尚未开始的任务直接从队列移除；已激活的交给 worker 在下一个检查点自行中止
    const job = await this.buildQueue.getJob(`build-${task.id.toString()}`);
    if (job && (await job.isActive()) === false) {
      await job.remove();
    }

    // 标记为 canceled（而不是 failed），worker 检测到后会停止推进。
    // 这里刻意不释放 robotId：由 worker 的 finally 统一归还，
    // 两边都释放会导致同一编号被两个任务同时使用。
    const updated = await this.prisma.buildTask.update({
      where: { id: BigInt(taskId) },
      data: {
        status: TaskStatus.canceled,
        // 仅作为「该任务存在日志」的标记，前端据此决定是否展示日志入口
        logPath: `/storage/logs/build-${taskId}.log`,
      },
    });

    return updated;
  }

  /**
   * 删除构建任务
   */
  async deleteTask(taskId: string) {
    const task = await this.prisma.buildTask.findUnique({ where: { id: BigInt(taskId) } });
    if (!task) throw new NotFoundException('任务不存在');

    // running 的任务不能直接删：worker 仍在执行，删掉记录后它无处回写状态，
    // 也会让机器人池无法通过数据库反推哪些编号真正被占用
    if (task.status === TaskStatus.running) {
      throw new BadRequestException('任务正在运行，请先取消后再删除');
    }

    const job = await this.buildQueue.getJob(`build-${task.id.toString()}`);
    if (job && (await job.isActive()) === false) {
      await job.remove();
    }

    await this.prisma.buildTask.delete({
      where: { id: BigInt(taskId) },
    });

    // 顺带清理该任务产生的外围文件，避免磁盘无限增长
    await this.cleanupTaskFiles(taskId);

    return { success: true };
  }

  /**
   * 清理任务关联的日志与二维码文件
   */
  private async cleanupTaskFiles(taskId: string): Promise<void> {
    const base = process.cwd();
    const files = [
      path.join(base, 'var', 'logs', `build-${taskId}.log`),
      path.join(base, 'public', 'storage', `qrcode-${taskId}.jpg`),
    ];
    await Promise.all(files.map((f) => fs.remove(f).catch(() => {})));
  }

  /**
   * 按原参数重新构建（失败重试）。
   * 新建一条任务记录而不是复用原记录，保证构建历史完整可追溯。
   */
  async retryTask(taskId: string, user: User) {
    if (!/^\d+$/.test(taskId)) throw new BadRequestException('非法的任务 ID');

    const source = await this.prisma.buildTask.findUnique({
      where: { id: BigInt(taskId) },
      select: { projectId: true, branch: true, status: true },
    });
    if (!source) throw new NotFoundException('任务不存在');

    if (source.status === TaskStatus.running || source.status === TaskStatus.pending) {
      throw new BadRequestException('任务尚未结束，无需重试');
    }

    // 版本号留空由 triggerBuild 自动生成，避免与原版本号冲突
    return this.triggerBuild(
      {
        projectId: source.projectId,
        branch: source.branch,
        buildDesc: `重试自 #${taskId}`,
      },
      user,
    );
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

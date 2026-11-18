import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';

/** 微信小程序允许的上传机器人编号范围 */
const MAX_ROBOTS = 30;

/** 超过该时长仍停留在 running 的任务，视为进程崩溃遗留的僵死任务 */
const STALE_TASK_MINUTES = 30;

@Injectable()
export class RobotPoolService implements OnModuleInit {
  private readonly logger = new Logger(RobotPoolService.name);
  private redisClient!: Redis;
  private readonly POOL_KEY = 'avocado:robot_pool:available';
  private readonly MAX_ROBOTS = MAX_ROBOTS;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    this.redisClient = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD', '') || undefined,
    });

    await this.reconcileFromDatabase();
  }

  /**
   * 以数据库为唯一真相源重建机器人池。
   *
   * Redis 只是缓存：进程崩溃时通过 SPOP 取走的 ID 不会自动归还，
   * 旧实现在 key 存在时跳过初始化，导致池子漏光后永久无法构建。
   * 因此每次启动都必须用 DB 中 running 任务反推哪些 ID 真正被占用。
   */
  async reconcileFromDatabase(): Promise<void> {
    // 1. 回收僵死任务：进程崩了，状态永远停在 running
    const staleAt = new Date(Date.now() - STALE_TASK_MINUTES * 60 * 1000);
    const stale = await this.prisma.buildTask.updateMany({
      where: { status: TaskStatus.running, updatedAt: { lt: staleAt } },
      data: { status: TaskStatus.failed },
    });
    if (stale.count > 0) {
      this.logger.warn(
        `回收僵死构建任务 ${stale.count} 个（超过 ${STALE_TASK_MINUTES} 分钟无状态更新）`,
      );
    }

    // 2. 统计仍真实占用中的 robotId
    const running = await this.prisma.buildTask.findMany({
      where: { status: TaskStatus.running, robotId: { not: null } },
      select: { robotId: true },
    });
    const occupied = new Set(running.map((t) => t.robotId as number));

    // 3. 全量重建池子
    const available: number[] = [];
    for (let id = 1; id <= this.MAX_ROBOTS; id++) {
      if (!occupied.has(id)) available.push(id);
    }

    await this.redisClient.del(this.POOL_KEY);
    if (available.length > 0) {
      await this.redisClient.sadd(this.POOL_KEY, ...available);
    }

    this.logger.log(
      `机器人池已重建：可用 ${available.length}/${this.MAX_ROBOTS}，占用 ${occupied.size}`,
    );
  }

  /**
   * 从池中原子取走一个空闲 ID，取不到返回 null。
   */
  async acquireRobotId(): Promise<number | null> {
    const idStr = await this.redisClient.spop(this.POOL_KEY);
    if (!idStr) {
      return null;
    }
    this.logger.debug(`获取到机器人 ID: ${idStr}`);
    return parseInt(idStr, 10);
  }

  /**
   * 归还 ID。只有真正的持有者（worker 的 finally）才应调用。
   * 重复归还本身是幂等的，但会让两个任务同时使用同一编号，因此会记录告警。
   */
  async releaseRobotId(id: number): Promise<void> {
    if (!Number.isInteger(id) || id < 1 || id > this.MAX_ROBOTS) {
      this.logger.warn(`试图释放无效的机器人 ID: ${id}`);
      return;
    }

    const added = await this.redisClient.sadd(this.POOL_KEY, id);
    if (added === 0) {
      this.logger.warn(`机器人 ID ${id} 已在池中，疑似重复释放`);
    } else {
      this.logger.debug(`成功将机器人 ID: ${id} 释放回池中`);
    }
  }

  async getAvailableCount(): Promise<number> {
    return this.redisClient.scard(this.POOL_KEY);
  }
}

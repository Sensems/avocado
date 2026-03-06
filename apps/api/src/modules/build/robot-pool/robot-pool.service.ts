import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RobotPoolService implements OnModuleInit {
  private readonly logger = new Logger(RobotPoolService.name);
  private redisClient!: Redis;
  private readonly POOL_KEY = 'avocado:robot_pool:available';
  private readonly MAX_ROBOTS = 30;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.redisClient = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
    });

    await this.initializePool();
  }

  private async initializePool() {
    // 检查连通池是否已存在
    const exists = await this.redisClient.exists(this.POOL_KEY);
    if (!exists) {
      // 微信小程序机器人 ID 为 1 到 30
      const robotIds = Array.from({ length: this.MAX_ROBOTS }, (_, i) => i + 1);
      await this.redisClient.sadd(this.POOL_KEY, ...robotIds);
      this.logger.log(`使用 ${this.MAX_ROBOTS} 个 ID 初始化 IM 机器人池`);
    } else {
      const activeCount = await this.redisClient.scard(this.POOL_KEY);
      this.logger.log(
        `IM 机器人池已存在，拥有 ${this.MAX_ROBOTS} 个 ID，目前 ${activeCount} 个可用`,
      );
    }
  }

  /**
   * 从机器人池获取一个空闲 ID。
   * 如果暂无可用的机器人则返回 null。
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
   * 构建完成或结束后，将机器人 ID 释放回池中。
   */
  async releaseRobotId(id: number): Promise<void> {
    if (id < 1 || id > this.MAX_ROBOTS) {
      this.logger.warn(`试图释放无效的机器人 ID: ${id}`);
      return;
    }

    // 将其添加回集合
    await this.redisClient.sadd(this.POOL_KEY, id);
    this.logger.debug(`成功将机器人 ID: ${id} 释放回池中`);
  }

  /**
   * 获取当前可用的机器人总数。
   */
  async getAvailableCount(): Promise<number> {
    return this.redisClient.scard(this.POOL_KEY);
  }
}

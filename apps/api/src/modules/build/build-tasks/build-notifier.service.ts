import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ImRobotsService } from '../../resources/im-robots/im-robots.service';

/**
 * 构建通知发送器。
 *
 * 从 BuildJobProcessor 抽离出来的原因：通知是纯粹的副作用，
 * 与构建执行无关，而且它本身有独立的失败模式（webhook 超时、平台差异性）。
 */
@Injectable()
export class BuildNotifier {
  private readonly logger = new Logger(BuildNotifier.name);

  /** 单条 webhook 的超时时间，避免一个挂掉的机器人拖住整条构建链 */
  private static readonly WEBHOOK_TIMEOUT_MS = 5000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly imRobotsService: ImRobotsService,
  ) {}

  /**
   * 向指定机器人并发发送通知。
   * 任何单个机器人失败只记日志，不影响构建主流程。
   */
  async notify(
    robotIds: string[] | null | undefined,
    title: string,
    content: string,
    linkUrl?: string,
    imageUrl?: string,
  ): Promise<void> {
    if (!robotIds || !Array.isArray(robotIds) || robotIds.length === 0) return;

    const robots = await this.prisma.imRobot.findMany({
      where: { id: { in: robotIds } },
    });

    await Promise.allSettled(
      robots.map(async (robot) => {
        try {
          const { finalUrl, payload } = this.imRobotsService.buildWebhookMessage(
            robot,
            title,
            content,
            linkUrl,
            imageUrl,
          );
          await axios.post(finalUrl, payload, {
            timeout: BuildNotifier.WEBHOOK_TIMEOUT_MS,
          });
        } catch (error) {
          this.logger.error(`发送通知失败 [${robot.name}]: ${(error as Error).message}`);
        }
      }),
    );
  }
}

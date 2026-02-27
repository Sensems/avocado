/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateImRobotDto } from './dto/create-im-robot.dto';
import { encrypt, decrypt } from '../../../common/utils/crypto.util';
import { User, ImPlatform, ImRobot } from '@prisma/client';
import axios from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class ImRobotsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateImRobotDto, user: User) {
    const data: any = {
      name: createDto.name,
      platform: createDto.platform,
      webhookUrl: createDto.webhookUrl,
      createdById: user.id,
    };

    if (createDto.secretToken) {
      data.secretToken = encrypt(createDto.secretToken);
    }

    return await this.prisma.imRobot.create({
      data,
      select: {
        id: true,
        name: true,
        platform: true,
        webhookUrl: true, // webhookURL 通常以明文形式保存，但 secretToken 已隐藏
        createdAt: true,
        createdById: true,
      },
    });
  }

  async findAll() {
    return await this.prisma.imRobot.findMany({
      select: {
        id: true,
        name: true,
        platform: true,
        webhookUrl: true,
        createdAt: true,
        createdById: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string) {
    const robot = await this.prisma.imRobot.findUnique({ where: { id } });
    if (!robot) throw new NotFoundException('找不到 IM 机器人');

    await this.prisma.imRobot.delete({ where: { id } });
    return { success: true };
  }

  buildWebhookMessage(
    robot: ImRobot,
    title: string,
    content: string,
    linkUrl?: string,
  ): { finalUrl: string; payload: Record<string, any> } {
    let timestamp: string | number = '';
    let sign = '';
    let finalUrl = robot.webhookUrl;
    const plainToken = robot.secretToken ? decrypt(robot.secretToken) : null;

    if (robot.platform === ImPlatform.dingtalk && plainToken) {
      timestamp = Date.now();
      const stringToSign = `${timestamp}\n${plainToken}`;
      const hash = crypto.createHmac('sha256', plainToken).update(stringToSign).digest('base64');
      sign = encodeURIComponent(hash);
      finalUrl = `${finalUrl}&timestamp=${timestamp}&sign=${sign}`;
    } else if (robot.platform === ImPlatform.feishu && plainToken) {
      timestamp = Math.floor(Date.now() / 1000);
      const stringToSign = `${timestamp}\n${plainToken}`;
      const hash = crypto.createHmac('sha256', stringToSign).update('').digest('base64');
      sign = hash;
    }

    const payload = this.buildPlatformPayload(
      robot.platform,
      title,
      content,
      linkUrl,
      sign,
      timestamp,
    );
    return { finalUrl, payload };
  }

  private buildPlatformPayload(
    platform: ImPlatform,
    title: string,
    content: string,
    linkUrl?: string,
    sign?: string,
    timestamp?: string | number,
  ): Record<string, any> {
    const fullText = linkUrl ? `${content}\n[查看详情](${linkUrl})` : content;
    switch (platform) {
      case ImPlatform.wecom:
        return { msgtype: 'markdown', markdown: { content: `**${title}**\n${fullText}` } };
      case ImPlatform.dingtalk:
        return {
          msgtype: 'markdown',
          markdown: { title: title, text: `### ${title}\n${fullText}` },
        };
      case ImPlatform.feishu: {
        const contentArray: any[] = [[{ tag: 'text', text: content }]];
        if (linkUrl) {
          contentArray.push([{ tag: 'a', text: '查看二维码/详情', href: linkUrl }]);
        }

        const feishuBody: any = {
          msg_type: 'post',
          content: {
            post: {
              zh_cn: {
                title: title,
                content: contentArray,
              },
            },
          },
        };
        if (sign && timestamp) {
          feishuBody.sign = sign;
          feishuBody.timestamp = String(timestamp);
        }
        return feishuBody;
      }
      default: {
        return { text: fullText };
      }
    }
  }

  async testConnection(id: string) {
    const robot = await this.prisma.imRobot.findUnique({ where: { id } });
    if (!robot) throw new NotFoundException('找不到 IM 机器人');

    try {
      const { finalUrl, payload } = this.buildWebhookMessage(
        robot,
        'Avocado CI/CD',
        '连接测试成功 🥑',
      );
      await axios.post(finalUrl, payload);
      return { success: true, message: '测试消息发送成功' };
    } catch (error) {
      throw new BadRequestException(`测试消息发送失败: ${(error as Error).message}`);
    }
  }
}

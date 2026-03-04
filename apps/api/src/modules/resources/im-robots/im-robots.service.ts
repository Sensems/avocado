/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateImRobotDto } from './dto/create-im-robot.dto';
import { UpdateImRobotDto } from './dto/update-im-robot.dto';
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

  async findAll(page: number = 1, limit: number = 15) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.imRobot.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          platform: true,
          webhookUrl: true,
          createdAt: true,
          createdById: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.imRobot.count(),
    ]);
    return { items, total };
  }

  async update(id: string, updateDto: UpdateImRobotDto) {
    const existing = await this.prisma.imRobot.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('找不到 IM 机器人');

    const data: Record<string, unknown> = {};
    if (updateDto.name !== undefined) data.name = updateDto.name;
    if (updateDto.platform !== undefined) data.platform = updateDto.platform;
    if (updateDto.webhookUrl !== undefined) data.webhookUrl = updateDto.webhookUrl;
    // 前端发的字段名是 secret，留空则不覆盖原 secretToken
    if (updateDto.secret) data.secretToken = encrypt(updateDto.secret);

    return await this.prisma.imRobot.update({
      where: { id },
      data,
      select: { id: true, name: true, platform: true, webhookUrl: true, createdAt: true },
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
    imageUrl?: string,
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
      imageUrl,
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
    imageUrl?: string,
  ): Record<string, any> {
    const fullText = linkUrl ? `${content}\n[查看详情](${linkUrl})` : content;
    const imageMarkdown = imageUrl ? `\n![体验版二维码](${imageUrl})` : '';
    switch (platform) {
      case ImPlatform.wecom:
        if (imageUrl) {
          // 企业微信使用 news 卡片消息以展示图片
          return {
            msgtype: 'news',
            news: {
              articles: [
                {
                  title: title,
                  description: content,
                  url: linkUrl || imageUrl,
                  picurl: imageUrl,
                },
              ],
            },
          };
        }
        return { msgtype: 'markdown', markdown: { content: `**${title}**\n${fullText}` } };
      case ImPlatform.dingtalk:
        return {
          msgtype: 'markdown',
          markdown: {
            title: title,
            text: `### ${title}\n${fullText}${imageMarkdown}`,
          },
        };
      case ImPlatform.feishu: {
        const contentArray: any[] = [[{ tag: 'text', text: content }]];
        if (imageUrl) {
          contentArray.push([{ tag: 'a', text: '📱 查看体验版二维码', href: imageUrl }]);
        } else if (linkUrl) {
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

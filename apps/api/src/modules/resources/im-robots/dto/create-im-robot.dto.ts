import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { ImPlatform } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateImRobotDto {
  @ApiProperty({ description: '机器人的自定义名称', example: 'Frontend CI Dev Bot' })
  @IsString({ message: '名称必须是字符串' })
  @IsNotEmpty({ message: '名称不能为空' })
  @MaxLength(100, { message: '名称不能超过100个字符' })
  name!: string;

  @ApiProperty({ enum: ImPlatform, description: '消息平台（wecom, dingtalk, feishu）' })
  @IsEnum(ImPlatform, { message: '消息平台无效' })
  @IsNotEmpty({ message: '消息平台不能为空' })
  platform!: ImPlatform;

  @ApiProperty({
    description: '发送消息的 webhook URL',
    example: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...',
  })
  @IsUrl({ require_tld: false }, { message: '必须是有效的 URL' }) // false 是因为可能使用 IP 或内部网络
  @IsNotEmpty({ message: 'webhook URL 不能为空' })
  webhookUrl!: string;

  @ApiPropertyOptional({
    description: '可选的签名安全 token，经过 AES 加密存储',
    example: 'SECxxxxxxxxxxxxxxxxxxx',
  })
  @IsString({ message: 'secret token 必须是字符串' })
  @IsOptional()
  @MaxLength(255, { message: 'secret token 不能超过255个字符' })
  secretToken?: string;
}

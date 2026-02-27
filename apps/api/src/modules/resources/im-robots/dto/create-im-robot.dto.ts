import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { ImPlatform } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateImRobotDto {
  @ApiProperty({ description: 'The custom name for this robot', example: 'Frontend CI Dev Bot' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: ImPlatform, description: 'Platform (wecom, dingtalk, feishu)' })
  @IsEnum(ImPlatform)
  @IsNotEmpty()
  platform!: ImPlatform;

  @ApiProperty({
    description: 'The webhook URL to send messages to',
    example: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...',
  })
  @IsUrl({ require_tld: false }) // false because IP or internal network might be used
  @IsNotEmpty()
  webhookUrl!: string;

  @ApiPropertyOptional({
    description: 'Optional secret token for signatures, stored AES encrypted',
    example: 'SECxxxxxxxxxxxxxxxxxxx',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  secretToken?: string;
}

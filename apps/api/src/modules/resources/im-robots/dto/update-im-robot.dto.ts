import { IsEnum, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { ImPlatform } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateImRobotDto {
  @ApiPropertyOptional({ description: '机器人名称' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: ImPlatform })
  @IsEnum(ImPlatform)
  @IsOptional()
  platform?: ImPlatform;

  @ApiPropertyOptional({ description: 'Webhook URL' })
  @IsUrl({ require_tld: false })
  @IsOptional()
  webhookUrl?: string;

  @ApiPropertyOptional({ description: '签名密钥，留空则不更新（前端字段名 secret）' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  secret?: string;
}

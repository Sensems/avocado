import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsUUID,
  IsArray,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FrameworkType } from '@prisma/client';

export class CreateProjectDto {
  @ApiProperty({ description: '项目名称', example: 'Avocado Frontend' })
  @IsString({ message: '名称必须是字符串' })
  @IsNotEmpty({ message: '名称不能为空' })
  @MaxLength(100, { message: '名称不能超过100个字符' })
  name!: string;

  @ApiPropertyOptional({ description: '小程序 App ID', example: 'wx1234567890abcdef' })
  @IsString({ message: 'App ID 必须是字符串' })
  @IsOptional()
  @MaxLength(50, { message: 'App ID 不能超过50个字符' })
  appId?: string;

  @ApiProperty({ description: 'Git 仓库地址', example: 'git@github.com:my/repo.git' })
  @IsString({ message: '仓库地址必须是字符串' })
  @IsNotEmpty({ message: '仓库地址不能为空' })
  repositoryUrl!: string;

  @ApiPropertyOptional({ description: '关联到此项目的 Git 凭证 ID' })
  @IsUUID('all', { message: 'Git 凭证 ID 必须是有效的 UUID' })
  @IsOptional()
  gitCredentialId?: string;

  @ApiPropertyOptional({ description: '用于接收构建通知的 IM 机器人 ID 数组' })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return Array.isArray(value) ? value : [value];
  })
  @IsArray({ message: 'IM 机器人 ID 必须是数组' })
  @IsUUID('all', { each: true, message: 'IM 机器人 ID 必须是有效的 UUID' })
  @IsOptional()
  imRobotIds?: string[];

  @ApiPropertyOptional({
    description: '构建命令（UniApp 项目必填）',
    example: 'npm run build:mp-weixin',
  })
  @IsString({ message: '构建命令必须是字符串' })
  @IsOptional()
  @MaxLength(255, { message: '构建命令不能超过255个字符' })
  buildCommand?: string;

  @ApiPropertyOptional({
    description: '构建产物目录（UniApp 项目必填）',
    example: 'dist/build/mp-weixin',
  })
  @IsString({ message: '产物目录必须是字符串' })
  @IsOptional()
  @MaxLength(255, { message: '产物目录不能超过255个字符' })
  distPath?: string;

  @ApiPropertyOptional({
    description: '框架类型',
    enum: FrameworkType,
    default: FrameworkType.native,
  })
  @IsEnum(FrameworkType, { message: '框架类型无效' })
  @IsOptional()
  framework?: FrameworkType;

  @ApiPropertyOptional({ description: 'Webhook 密钥', example: 'my-secret-123' })
  @IsString({ message: 'Webhook 密钥必须是字符串' })
  @IsOptional()
  @MaxLength(255, { message: 'Webhook 密钥不能超过255个字符' })
  webhookSecret?: string;
}

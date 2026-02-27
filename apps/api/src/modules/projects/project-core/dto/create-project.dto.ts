import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsUUID,
  IsArray,
  IsEnum,
} from 'class-validator';
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

  @ApiPropertyOptional({
    description: '用于微信小程序上传的私钥内容',
    example: '-----BEGIN RSA PRIVATE KEY-----\n...',
  })
  @IsString({ message: '私钥必须是字符串' })
  @IsOptional()
  privateKey?: string;

  @ApiPropertyOptional({ description: '用于接收构建通知的 IM 机器人 ID 数组' })
  @IsArray({ message: 'IM 机器人 ID 必须是数组' })
  @IsUUID('all', { each: true, message: 'IM 机器人 ID 必须是有效的 UUID' })
  @IsOptional()
  imRobotIds?: string[];

  @ApiPropertyOptional({
    description: '框架类型',
    enum: FrameworkType,
    default: FrameworkType.native,
  })
  @IsEnum(FrameworkType, { message: '框架类型无效' })
  @IsOptional()
  framework?: FrameworkType;
}

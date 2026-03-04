import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { GitCredentialType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGitCredentialDto {
  @ApiProperty({
    description: '凭证名称（用于引用）',
    example: 'My Personal SSH Key',
  })
  @IsString({ message: '名称必须是字符串' })
  @IsNotEmpty({ message: '名称不能为空' })
  @MaxLength(100, { message: '名称不能超过100个字符' })
  name!: string;

  @ApiProperty({ enum: GitCredentialType, description: '凭证类型（ssh / https / pat）' })
  @IsEnum(GitCredentialType, { message: '凭证类型无效' })
  @IsNotEmpty({ message: '凭证类型不能为空' })
  type!: GitCredentialType;

  @ApiPropertyOptional({
    description: 'HTTPS 用户名，SSH 不需要',
    example: 'git-user',
  })
  @IsString({ message: '用户名必须是字符串' })
  @IsOptional()
  @MaxLength(100, { message: '用户名不能超过100个字符' })
  username?: string;

  @ApiProperty({
    description: '实际的密钥内容（私钥或密码/Token）',
    example: '-----BEGIN OPENSSH PRIVATE KEY-----...',
  })
  @IsString({ message: '密钥内容必须是字符串' })
  @IsNotEmpty({ message: '密钥内容不能为空' })
  secret!: string;
}

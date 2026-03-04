import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { GitCredentialType } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateGitCredentialDto {
  @ApiPropertyOptional({ description: '凭证名称' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: GitCredentialType, description: '凭证类型（ssh / https / pat）' })
  @IsEnum(GitCredentialType)
  @IsOptional()
  type?: GitCredentialType;

  @ApiPropertyOptional({ description: 'HTTPS 用户名' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  username?: string;

  @ApiPropertyOptional({ description: '私钥或密码/Token，留空则不更新' })
  @IsString()
  @IsOptional()
  secret?: string;
}

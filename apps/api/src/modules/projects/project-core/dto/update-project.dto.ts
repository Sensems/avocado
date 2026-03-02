import { PartialType } from '@nestjs/swagger';
import { CreateProjectDto } from './create-project.dto';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  distPath?: string;
  buildCommand?: string;

  @ApiPropertyOptional({ description: '默认构建分支', example: 'main' })
  @IsString({ message: '默认分支必须是字符串' })
  @IsOptional()
  @MaxLength(100, { message: '分支名不能超过100个字符' })
  defaultBranch?: string;

  @ApiPropertyOptional({ description: '构建历史保留条数', example: 10 })
  @IsOptional()
  retentionCount?: number;
}


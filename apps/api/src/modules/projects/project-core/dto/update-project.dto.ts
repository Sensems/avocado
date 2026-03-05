import { PartialType } from '@nestjs/swagger';
import { CreateProjectDto } from './create-project.dto';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
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
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  })
  retentionCount?: number;

  @ApiPropertyOptional({ description: '是否开启历史版本功能', example: true })
  @IsBoolean({ message: 'historyEnabled 必须是布尔值' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  historyEnabled?: boolean;
}

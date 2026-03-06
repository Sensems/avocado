import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TriggerBuildDto {
  @ApiProperty({ description: '要构建的项目 UUID' })
  @IsString({ message: '项目 UUID 必须是字符串' })
  @IsNotEmpty({ message: '项目 UUID 不能为空' })
  projectId!: string;

  @ApiProperty({ description: '要检出的分支或 Git 标签', default: 'main' })
  @IsString({ message: '分支名必须是字符串' })
  @IsNotEmpty({ message: '分支名不能为空' })
  branch!: string;

  @ApiProperty({ description: '可选的显式版本号（例如，1.0.5）' })
  @IsString({ message: '版本号必须是字符串' })
  @IsOptional()
  version?: string;

  @ApiProperty({ description: '可选的显式构建描述' })
  @IsString({ message: '构建描述必须是字符串' })
  @IsOptional()
  buildDesc?: string;
}

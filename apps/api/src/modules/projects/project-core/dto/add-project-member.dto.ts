import { IsEnum, IsString, IsNotEmpty } from 'class-validator';
import { ProjectRole } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class AddProjectMemberDto {
  @ApiProperty({ description: '要添加到项目的用户 ID' })
  @IsString({ message: '用户 ID 必须是字符串' })
  @IsNotEmpty({ message: '用户 ID 不能为空' })
  userId!: string;

  @ApiProperty({ enum: ProjectRole, description: '在此项目中分配给该用户的角色' })
  @IsEnum(ProjectRole, { message: '角色无效' })
  @IsNotEmpty({ message: '角色不能为空' })
  role!: ProjectRole;
}

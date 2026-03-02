import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ description: '用户 ID' })
  id!: string;

  @ApiProperty({ description: '用户名' })
  username!: string;

  @ApiProperty({ description: '是否为超级管理员' })
  isSuperAdmin!: boolean;

  @ApiProperty({ description: '状态：active 或 disabled' })
  status!: string;

  @ApiProperty({ description: '创建时间' })
  createdAt!: Date;
}

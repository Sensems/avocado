import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({ description: '用户名', required: false })
  username?: string;

  @ApiProperty({ description: '密码', required: false })
  password?: string;

  @ApiProperty({ description: '是否为超级管理员', required: false })
  isSuperAdmin?: boolean;

  @ApiProperty({ description: '状态：active 或 disabled', required: false })
  status?: string;
}

import { IsString, IsNotEmpty, MinLength, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: '用户名', example: 'newuser' })
  @IsString({ message: '用户名必须是字符串' })
  @IsNotEmpty({ message: '用户名不能为空' })
  username!: string;

  @ApiProperty({ description: '密码', example: '123456' })
  @IsString({ message: '密码必须是字符串' })
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(6, { message: '密码长度至少为 6 个字符' })
  password!: string;

  @ApiPropertyOptional({ description: '是否为超级管理员', default: false })
  @IsBoolean({ message: 'isSuperAdmin 必须是布尔值' })
  @IsOptional()
  isSuperAdmin?: boolean;
}

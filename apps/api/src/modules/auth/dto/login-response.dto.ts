import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({ description: '访问令牌 JWT' })
  access_token!: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

export class PaginatedUserResponseDto {
  @ApiProperty({ description: '数据列表', type: [UserResponseDto] })
  items!: UserResponseDto[];

  @ApiProperty({ description: '总数' })
  total!: number;
}

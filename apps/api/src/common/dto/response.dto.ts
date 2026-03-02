import { ApiProperty, ApiHideProperty } from '@nestjs/swagger';

export class ResponseDto<T> {
  @ApiProperty({ description: '状态码', example: 200 })
  code!: number;

  @ApiProperty({ description: '响应消息', example: '操作成功' })
  message!: string;

  @ApiHideProperty()
  data!: T;
}

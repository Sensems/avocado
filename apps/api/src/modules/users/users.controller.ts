import { Controller, Get, Post, Body, Param, Put, Query, Delete } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ApiResultResponse } from '../../common/decorators/api-result.decorator';
import { UserResponseDto } from './dto/user-response.dto';
import { PaginatedUserResponseDto } from './dto/paginated-user-response.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: '创建新用户' })
  @ApiResultResponse(UserResponseDto)
  create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(createUserDto) as any;
  }

  @Get()
  @ApiOperation({ summary: '获取所有用户列表（分页）' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码，默认 1' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量，默认 15' })
  @ApiResultResponse(PaginatedUserResponseDto)
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedUserResponseDto> {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 15;
    return this.usersService.findAll(pageNumber, limitNumber) as any;
  }

  @Get(':id')
  @ApiOperation({ summary: '根据 ID 查找用户' })
  @ApiResultResponse(UserResponseDto)
  findOne(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.findById(id) as any;
  }

  @Put(':id/status')
  @ApiOperation({ summary: '更新用户状态 (启用/禁用)' })
  @ApiResultResponse(UserResponseDto)
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: 'active' | 'disabled',
  ): Promise<UserResponseDto> {
    return this.usersService.updateStatus(id, status) as any;
  }

  @Put(':id')
  @ApiOperation({ summary: '更新用户信息' })
  @ApiResultResponse(UserResponseDto)
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, updateUserDto) as any;
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除用户' })
  @ApiResultResponse(UserResponseDto)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id) as any;
  }
}

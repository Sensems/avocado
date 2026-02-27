import { Controller, Get, Post, Body, Param, Delete, Request, UseGuards } from '@nestjs/common';
import { ImRobotsService } from './im-robots.service';
import { CreateImRobotDto } from './dto/create-im-robot.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { User } from '@prisma/client';
import type { Request as ExpressRequest } from 'express';

@ApiTags('IM Robots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('im-robots')
export class ImRobotsController {
  constructor(private readonly imRobotsService: ImRobotsService) {}

  @Post()
  @ApiOperation({ summary: '添加新的 IM 机器人（webhook 和可选密钥）' })
  create(@Body() createDto: CreateImRobotDto, @Request() req: ExpressRequest) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = (req as any).user as User;
    return this.imRobotsService.create(createDto, user);
  }

  @Get()
  @ApiOperation({ summary: '获取所有 IM 机器人列表' })
  findAll() {
    return this.imRobotsService.findAll();
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除 IM 机器人配置' })
  remove(@Param('id') id: string) {
    return this.imRobotsService.remove(id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: '发送测试消息以验证 IM 机器人连通性' })
  testConnection(@Param('id') id: string) {
    return this.imRobotsService.testConnection(id);
  }
}

import { ApiResultResponse } from '../../../common/decorators/api-result.decorator';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  Request,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ImRobotsService } from './im-robots.service';
import { CreateImRobotDto } from './dto/create-im-robot.dto';
import { UpdateImRobotDto } from './dto/update-im-robot.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { RequireSuperAdmin } from '../../../common/decorators/roles.decorator';
import { User } from '@prisma/client';
import type { Request as ExpressRequest } from 'express';

@ApiTags('IM Robots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('im-robots')
export class ImRobotsController {
  constructor(private readonly imRobotsService: ImRobotsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @RequireSuperAdmin()
  @ApiOperation({ summary: '添加新的 IM 机器人（webhook 和可选密钥）' })
  @ApiResultResponse()
  create(@Body() createDto: CreateImRobotDto, @Request() req: ExpressRequest) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = (req as any).user as User;
    return this.imRobotsService.create(createDto, user);
  }

  @Get()
  @ApiOperation({ summary: '获取所有 IM 机器人列表（分页）' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码，默认 1' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量，默认 15' })
  @ApiResultResponse()
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 15;
    return this.imRobotsService.findAll(pageNumber, limitNumber);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @RequireSuperAdmin()
  @ApiOperation({ summary: '更新 IM 机器人（secret 留空则不修改）' })
  @ApiResultResponse()
  update(@Param('id') id: string, @Body() updateDto: UpdateImRobotDto) {
    return this.imRobotsService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @RequireSuperAdmin()
  @ApiOperation({ summary: '删除 IM 机器人配置' })
  @ApiResultResponse()
  remove(@Param('id') id: string) {
    return this.imRobotsService.remove(id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: '发送测试消息以验证 IM 机器人连通性' })
  @ApiResultResponse()
  testConnection(@Param('id') id: string) {
    return this.imRobotsService.testConnection(id);
  }
}

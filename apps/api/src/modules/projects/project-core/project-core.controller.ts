import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Request,
  Put,
} from '@nestjs/common';
import { ProjectCoreService } from './project-core.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ProjectGuard } from '../../../common/guards/project.guard';
import { User, ProjectRole } from '@prisma/client';
import type { Request as ExpressRequest } from 'express';

@ApiTags('Projects Core')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectCoreController {
  constructor(private readonly projectCoreService: ProjectCoreService) {}

  @Post()
  @ApiOperation({ summary: '创建新项目（将创建者指定为维护者）' })
  create(@Body() createDto: CreateProjectDto, @Request() req: ExpressRequest) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = (req as any).user as User;
    return this.projectCoreService.create(createDto, user);
  }

  @Get()
  @ApiOperation({ summary: '获取项目列表（超级管理员可见所有，其他可见已加入）' })
  findAll(@Request() req: ExpressRequest) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = (req as any).user as User;
    return this.projectCoreService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取项目详情（包含成员和设置）' })
  findOne(@Param('id') id: string) {
    return this.projectCoreService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(ProjectGuard) // Re-uses our dynamic ProjectGuard mechanism
  @ApiOperation({ summary: '删除项目（需要维护者角色）' })
  remove(@Param('id') id: string) {
    return this.projectCoreService.remove(id);
  }

  // --- 成员管理 ---

  @Post(':id/members')
  @UseGuards(ProjectGuard)
  @ApiOperation({ summary: '将用户添加到项目并指定角色（需要维护者）' })
  addMember(@Param('id') id: string, @Body() dto: AddProjectMemberDto) {
    return this.projectCoreService.addMember(id, dto);
  }

  @Put(':id/members/:userId')
  @UseGuards(ProjectGuard)
  @ApiOperation({ summary: '修改项目成员角色（需要维护者）' })
  updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body('role') role: ProjectRole,
  ) {
    return this.projectCoreService.updateMemberRole(id, userId, role);
  }

  @Delete(':id/members/:userId')
  @UseGuards(ProjectGuard)
  @ApiOperation({ summary: '移除项目成员（需要维护者）' })
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.projectCoreService.removeMember(id, userId);
  }
}

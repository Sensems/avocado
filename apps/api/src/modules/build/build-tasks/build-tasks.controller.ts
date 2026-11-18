import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  Headers,
  Delete,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiHeader, ApiTags } from '@nestjs/swagger';
import { User, ProjectRole } from '@prisma/client';
import type { Request as ExpressRequest } from 'express';

import { BuildTasksService } from './build-tasks.service';
import { TriggerBuildDto } from './dto/trigger-build.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ProjectGuard, RequireProjectRoles } from '../../../common/guards/project.guard';
import { ApiResultResponse } from '../../../common/decorators/api-result.decorator';

/** 可读：项目所有成员 */
const READ_ROLES = [ProjectRole.maintainer, ProjectRole.developer, ProjectRole.guest] as const;
/** 可操作构建：维护者与开发者 */
const BUILD_ROLES = [ProjectRole.maintainer, ProjectRole.developer] as const;

@ApiTags('Build Tasks')
@Controller('build-tasks')
export class BuildTasksController {
  constructor(private readonly buildTasksService: BuildTasksService) {}

  // ----------------------------------------------------
  // 认证的 UI 接口
  // ----------------------------------------------------

  @Post('trigger')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, ProjectGuard)
  @RequireProjectRoles(...BUILD_ROLES)
  @ApiOperation({ summary: '从前端面板手动触发构建' })
  @ApiResultResponse()
  triggerBuild(@Body() dto: TriggerBuildDto, @Request() req: ExpressRequest) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = (req as any).user as User;
    return this.buildTasksService.triggerBuild(dto, user);
  }

  @Get('project/:projectId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, ProjectGuard)
  @RequireProjectRoles(...READ_ROLES)
  @ApiOperation({ summary: '获取项目的构建历史记录（分页）' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码，默认 1' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量，默认 20' })
  @ApiResultResponse()
  getProjectTasks(
    @Param('projectId') projectId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 20;
    return this.buildTasksService.getTasksByProject(projectId, pageNumber, limitNumber);
  }

  @Get(':taskId/log')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, ProjectGuard)
  @RequireProjectRoles(...READ_ROLES)
  @ApiOperation({ summary: '读取构建日志全文（需项目成员权限）' })
  @ApiResultResponse()
  readLog(@Param('taskId') taskId: string, @Request() req: ExpressRequest) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = (req as any).user as User;
    return this.buildTasksService.readLog(taskId, user);
  }

  @Post(':taskId/cancel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, ProjectGuard)
  @RequireProjectRoles(...BUILD_ROLES)
  @ApiOperation({ summary: '取消等待中或正在运行的构建任务' })
  @ApiResultResponse()
  cancelTask(@Param('taskId') taskId: string) {
    return this.buildTasksService.cancelTask(taskId);
  }

  @Delete(':taskId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, ProjectGuard)
  @RequireProjectRoles(...BUILD_ROLES)
  @ApiOperation({ summary: '删除构建记录' })
  @ApiResultResponse()
  deleteTask(@Param('taskId') taskId: string) {
    return this.buildTasksService.deleteTask(taskId);
  }

  @Post(':taskId/retry')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, ProjectGuard)
  @RequireProjectRoles(...BUILD_ROLES)
  @ApiOperation({ summary: '按原参数重新构建（失败重试）' })
  @ApiResultResponse()
  retryTask(@Param('taskId') taskId: string, @Request() req: ExpressRequest) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = (req as any).user as User;
    return this.buildTasksService.retryTask(taskId, user);
  }

  @Post(':taskId/reupload')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, ProjectGuard)
  @RequireProjectRoles(...BUILD_ROLES)
  @ApiOperation({ summary: '从历史版本产物快速重新上传到微信小程序' })
  @ApiResultResponse()
  reuploadFromHistory(@Param('taskId') taskId: string, @Request() req: ExpressRequest) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = (req as any).user as User;
    return this.buildTasksService.reuploadFromHistory(taskId, user);
  }

  // ----------------------------------------------------
  // 未经认证的 Webhook 接口
  // ----------------------------------------------------

  @Post('webhook/:projectId')
  @ApiOperation({ summary: 'Git 代码托管平台的 Webhook 入口 (GitHub/GitLab/Gitee)' })
  @ApiHeader({ name: 'x-gitlab-token', description: 'GitLab Secret Token', required: false })
  @ApiHeader({ name: 'x-hub-signature-256', description: 'GitHub Signature', required: false })
  @ApiHeader({ name: 'x-gitee-token', description: 'Gitee Password/Token', required: false })
  handleWebhook(
    @Param('projectId') projectId: string,
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
  ) {
    return this.buildTasksService.handleWebhook(projectId, payload, headers);
  }
}

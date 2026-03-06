import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  Sse,
  Headers,
  Delete,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiHeader, ApiTags } from '@nestjs/swagger';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { fromEvent, Observable, timer } from 'rxjs';
import { filter, map, takeUntil } from 'rxjs/operators';
import { User } from '@prisma/client';
import type { Request as ExpressRequest } from 'express';

import { BuildTasksService } from './build-tasks.service';
import { TriggerBuildDto } from './dto/trigger-build.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ProjectGuard } from '../../../common/guards/project.guard';
import { ApiResultResponse } from '../../../common/decorators/api-result.decorator';

export interface BuildLogPayload {
  taskId: string;
  logChunk: string;
}

@ApiTags('Build Tasks')
@Controller('build-tasks')
export class BuildTasksController {
  constructor(
    private readonly buildTasksService: BuildTasksService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ----------------------------------------------------
  // 认证的 UI 接口
  // ----------------------------------------------------

  @Post('trigger')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard) // Requires login
  @ApiOperation({ summary: '从前端面板手动触发构建' })
  @ApiResultResponse()
  triggerBuild(@Body() dto: TriggerBuildDto, @Request() req: ExpressRequest) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = (req as any).user as User;
    return this.buildTasksService.triggerBuild(dto, user);
  }

  /**
   * SSE 实时日志流端点
   * 客户端通过 EventSource 连接此接口，实时接收构建日志
   * 30 分钟后自动断开（防止连接无限挂起）
   */
  @Sse(':taskId/logs')
  @ApiOperation({ summary: '通过 SSE 实时查看构建日志（无需 WebSocket）' })
  @ApiResultResponse()
  streamLogs(@Param('taskId') taskId: string): Observable<MessageEvent> {
    const timeout$ = timer(30 * 60 * 1000); // 30 分钟超时

    return fromEvent<BuildLogPayload>(this.eventEmitter, 'build.log').pipe(
      filter((payload) => payload.taskId === taskId),
      map(
        (payload) =>
          ({
            data: {
              taskId: payload.taskId,
              log: payload.logChunk,
              timestamp: new Date().toISOString(),
            },
          }) as MessageEvent,
      ),
      takeUntil(timeout$),
    );
  }

  @Get('project/:projectId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, ProjectGuard) // Standard RBAC checking
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

  @Post(':taskId/cancel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '取消等待中或正在运行的构建任务' })
  @ApiResultResponse()
  cancelTask(@Param('taskId') taskId: string) {
    return this.buildTasksService.cancelTask(taskId);
  }

  @Delete(':taskId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '删除构建记录' })
  @ApiResultResponse()
  deleteTask(@Param('taskId') taskId: string) {
    return this.buildTasksService.deleteTask(taskId);
  }

  @Post(':taskId/reupload')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
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

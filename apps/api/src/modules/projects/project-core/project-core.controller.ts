import { ApiResultResponse } from '../../../common/decorators/api-result.decorator';
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
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProjectCoreService } from './project-core.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
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
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '创建项目，可选上传私钥文件',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '项目名称' },
        appId: { type: 'string', description: '小程序 App ID' },
        repositoryUrl: { type: 'string', description: 'Git 仓库地址' },
        gitCredentialId: { type: 'string', description: 'Git 凭证 ID' },
        imRobotIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IM 机器人 ID 数组',
        },
        framework: { type: 'string', enum: ['native', 'uniapp'], description: '框架类型' },
        privateKeyFile: {
          type: 'string',
          format: 'binary',
          description: '微信小程序上传密钥文件 (.key)',
        },
      },
      required: ['name', 'repositoryUrl'],
    },
  })
  @UseInterceptors(FileInterceptor('privateKeyFile'))
  create(
    @Body() createDto: CreateProjectDto,
    @Request() req: ExpressRequest,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 }), // 10KB 足够密钥文件
        ],
        fileIsRequired: false,
      }),
    )
    file?: Express.Multer.File,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = (req as any).user as User;
    return this.projectCoreService.create(createDto, user, file);
  }

  @Get()
  @ApiOperation({ summary: '获取项目列表（分页，超级管理员可见所有，其他可见已加入）' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码，默认 1' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量，默认 15' })
  @ApiResultResponse()

  findAll(
    @Request() req: ExpressRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = (req as any).user as User;
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 15;
    return this.projectCoreService.findAll(user, pageNumber, limitNumber);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取项目详情（包含成员和设置）' })
  @ApiResultResponse()

  findOne(@Param('id') id: string) {
    return this.projectCoreService.findOne(id);
  }

  @Put(':id')
  @UseGuards(ProjectGuard)
  @ApiOperation({ summary: '更新项目设置（需要维护者）' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(FileInterceptor('privateKeyFile'))
  @ApiResultResponse()
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateProjectDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 })],
        fileIsRequired: false,
      }),
    )
    file?: Express.Multer.File,
  ) {
    return this.projectCoreService.update(id, updateDto, file);
  }

  @Delete(':id')
  @UseGuards(ProjectGuard) // Re-uses our dynamic ProjectGuard mechanism
  @ApiOperation({ summary: '删除项目（需要维护者角色）' })
  @ApiResultResponse()

  remove(@Param('id') id: string) {
    return this.projectCoreService.remove(id);
  }

  // --- 成员管理 ---

  @Post(':id/members')
  @UseGuards(ProjectGuard)
  @ApiOperation({ summary: '将用户添加到项目并指定角色（需要维护者）' })
  @ApiResultResponse()

  addMember(@Param('id') id: string, @Body() dto: AddProjectMemberDto) {
    return this.projectCoreService.addMember(id, dto);
  }

  @Put(':id/members/:userId')
  @UseGuards(ProjectGuard)
  @ApiOperation({ summary: '修改项目成员角色（需要维护者）' })
  @ApiResultResponse()

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
  @ApiResultResponse()

  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.projectCoreService.removeMember(id, userId);
  }
}

import { ApiResultResponse } from '../../../common/decorators/api-result.decorator';
import { Controller, Get, Post, Body, Param, Delete, Patch, Request, UseGuards, Query } from '@nestjs/common';
import { GitCredentialsService } from './git-credentials.service';
import { CreateGitCredentialDto } from './dto/create-git-credential.dto';
import { UpdateGitCredentialDto } from './dto/update-git-credential.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { RequireSuperAdmin } from '../../../common/decorators/roles.decorator';
import { User } from '@prisma/client';
import type { Request as ExpressRequest } from 'express';

@ApiTags('Git Credentials')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('git-credentials')
export class GitCredentialsController {
  constructor(private readonly gitCredentialsService: GitCredentialsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @RequireSuperAdmin()
  @ApiOperation({ summary: '添加新的 Git 凭证（通过 AES 安全存储）' })
  @ApiResultResponse()

  create(@Body() createDto: CreateGitCredentialDto, @Request() req: ExpressRequest) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = (req as any).user as User;
    return this.gitCredentialsService.create(createDto, user);
  }

  @Get()
  @ApiOperation({ summary: '获取所有可用的 Git 凭证列表（分页，密钥已混淆）' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码，默认 1' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页数量，默认 15' })
  @ApiResultResponse()

  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 15;
    return this.gitCredentialsService.findAll(pageNumber, limitNumber);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @RequireSuperAdmin()
  @ApiOperation({ summary: '更新 Git 凭证（secret 留空则不修改）' })
  @ApiResultResponse()
  update(@Param('id') id: string, @Body() updateDto: UpdateGitCredentialDto) {
    return this.gitCredentialsService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @RequireSuperAdmin()
  @ApiOperation({ summary: '删除 Git 凭证' })
  @ApiResultResponse()

  remove(@Param('id') id: string) {
    return this.gitCredentialsService.remove(id);
  }

  @Post('list-branches')
  @ApiOperation({ summary: '从远程仓库获取分支列表（支持 SSH 和 HTTPS 凭证）' })
  @ApiResultResponse()
  @ApiBody({
    schema: {
      type: 'object',
      required: ['repoUrl'],
      properties: {
        repoUrl: { type: 'string', example: 'https://github.com/my/repo.git' },
        credentialId: { type: 'string', description: '可选的 Git 凭证 ID' },
      },
    },
  })
  listBranches(
    @Body('repoUrl') repoUrl: string,
    @Body('credentialId') credentialId?: string,
  ) {
    return this.gitCredentialsService.listRemoteBranches(repoUrl, credentialId);
  }

  @Post(':id/test')
  @ApiOperation({ summary: '通过 git ls-remote 测试凭证连通性' })
  @ApiResultResponse()

  @ApiBody({
    schema: {
      type: 'object',
      properties: { url: { type: 'string', example: 'https://github.com/my/repo.git' } },
    },
  })
  testConnection(@Param('id') id: string, @Body('url') url: string) {
    return this.gitCredentialsService.testConnection(id, url);
  }
}

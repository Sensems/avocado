import { Controller, Get, Post, Body, Param, Delete, Request, UseGuards } from '@nestjs/common';
import { GitCredentialsService } from './git-credentials.service';
import { CreateGitCredentialDto } from './dto/create-git-credential.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { User } from '@prisma/client';
import type { Request as ExpressRequest } from 'express';

@ApiTags('Git Credentials')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('git-credentials')
export class GitCredentialsController {
  constructor(private readonly gitCredentialsService: GitCredentialsService) {}

  @Post()
  @ApiOperation({ summary: '添加新的 Git 凭证（通过 AES 安全存储）' })
  create(@Body() createDto: CreateGitCredentialDto, @Request() req: ExpressRequest) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = (req as any).user as User;
    return this.gitCredentialsService.create(createDto, user);
  }

  @Get()
  @ApiOperation({ summary: '获取所有可用的 Git 凭证列表（密钥已混淆）' })
  findAll() {
    return this.gitCredentialsService.findAll();
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除 Git 凭证' })
  remove(@Param('id') id: string) {
    return this.gitCredentialsService.remove(id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: '通过 git ls-remote 测试凭证连通性' })
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

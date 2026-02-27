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
  @ApiOperation({ summary: 'Add a new Git credential (stored securely via AES)' })
  create(@Body() createDto: CreateGitCredentialDto, @Request() req: ExpressRequest) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = (req as any).user as User;
    return this.gitCredentialsService.create(createDto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List all available Git credentials (secrets obfuscated)' })
  findAll() {
    return this.gitCredentialsService.findAll();
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a Git credential' })
  remove(@Param('id') id: string) {
    return this.gitCredentialsService.remove(id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test credential connectivity via git ls-remote' })
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

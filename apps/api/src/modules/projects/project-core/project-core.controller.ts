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
  @ApiOperation({ summary: 'Create a new project (assigns creator as maintainer)' })
  create(@Body() createDto: CreateProjectDto, @Request() req: ExpressRequest) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = (req as any).user as User;
    return this.projectCoreService.create(createDto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List projects (SuperAdmin sees all, others see joined)' })
  findAll(@Request() req: ExpressRequest) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = (req as any).user as User;
    return this.projectCoreService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project details including members and settings' })
  findOne(@Param('id') id: string) {
    return this.projectCoreService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(ProjectGuard) // Re-uses our dynamic ProjectGuard mechanism
  @ApiOperation({ summary: 'Delete project (Requires Maintainer role)' })
  remove(@Param('id') id: string) {
    return this.projectCoreService.remove(id);
  }

  // --- Member Management ---

  @Post(':id/members')
  @UseGuards(ProjectGuard)
  @ApiOperation({ summary: 'Add a user to the project with a specific role (Requires Maintainer)' })
  addMember(@Param('id') id: string, @Body() dto: AddProjectMemberDto) {
    return this.projectCoreService.addMember(id, dto);
  }

  @Put(':id/members/:userId')
  @UseGuards(ProjectGuard)
  @ApiOperation({ summary: 'Change the role of an existing project member (Requires Maintainer)' })
  updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body('role') role: ProjectRole,
  ) {
    return this.projectCoreService.updateMemberRole(id, userId, role);
  }

  @Delete(':id/members/:userId')
  @UseGuards(ProjectGuard)
  @ApiOperation({ summary: 'Remove a user from the project (Requires Maintainer)' })
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.projectCoreService.removeMember(id, userId);
  }
}

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
  @ApiOperation({ summary: 'Add a new IM Robot (webhook & optional secret)' })
  create(@Body() createDto: CreateImRobotDto, @Request() req: ExpressRequest) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = (req as any).user as User;
    return this.imRobotsService.create(createDto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List all IM Robots' })
  findAll() {
    return this.imRobotsService.findAll();
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an IM Robot config' })
  remove(@Param('id') id: string) {
    return this.imRobotsService.remove(id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Send a test message to the specified IM Robot platform' })
  testConnection(@Param('id') id: string) {
    return this.imRobotsService.testConnection(id);
  }
}

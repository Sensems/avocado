import { Module } from '@nestjs/common';
import { ProjectCoreController } from './project-core.controller';
import { ProjectCoreService } from './project-core.service';
import { PrismaModule } from '../../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectCoreController],
  providers: [ProjectCoreService],
})
export class ProjectCoreModule {}

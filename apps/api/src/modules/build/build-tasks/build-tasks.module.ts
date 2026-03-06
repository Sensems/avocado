import { Module } from '@nestjs/common';
import { BuildTasksController } from './build-tasks.controller';
import { BuildTasksService } from './build-tasks.service';
import { BuildJobProcessor } from './build-job.processor/build-job.processor';
import { PrismaModule } from '../../../common/prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';
import { BUILD_QUEUE_NAME } from './interfaces/build-job.interface';
import { RobotPoolModule } from '../robot-pool/robot-pool.module';
import { ImRobotsModule } from '../../resources/im-robots/im-robots.module';
import { ArtifactsModule } from '../artifacts/artifacts.module';

@Module({
  imports: [
    PrismaModule,
    RobotPoolModule,
    ImRobotsModule,
    ArtifactsModule,
    BullModule.registerQueue({
      name: BUILD_QUEUE_NAME,
    }),
  ],
  controllers: [BuildTasksController],
  providers: [BuildTasksService, BuildJobProcessor],
  exports: [BuildTasksService],
})
export class BuildTasksModule {}

import { Module } from '@nestjs/common';
import { BuildTasksController } from './build-tasks.controller';
import { BuildTasksService } from './build-tasks.service';
import { BuildNotifier } from './build-notifier.service';
import { MiniprogramUploader } from './miniprogram-uploader.service';
import { BuildRunner } from './build-runner.service';
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
      defaultJobOptions: {
        // 失败重试两次并指数退避；构建本身幂等，重试是安全的
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        // 成功任务的 job 保留 1 小时便于排查，详细历史以 Postgres 为准
        removeOnComplete: { age: 3600, count: 100 },
        removeOnFail: { age: 24 * 3600, count: 200 },
      },
    }),
  ],
  controllers: [BuildTasksController],
  providers: [
    BuildTasksService,
    BuildJobProcessor,
    BuildNotifier,
    MiniprogramUploader,
    BuildRunner,
  ],
  exports: [BuildTasksService],
})
export class BuildTasksModule {}

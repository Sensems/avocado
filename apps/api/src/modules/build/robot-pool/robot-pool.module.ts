import { Module } from '@nestjs/common';
import { RobotPoolService } from './robot-pool.service';

@Module({
  providers: [RobotPoolService],
  exports: [RobotPoolService],
})
export class RobotPoolModule {}

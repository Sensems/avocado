import { Module } from '@nestjs/common';
import { ImRobotsController } from './im-robots.controller';
import { ImRobotsService } from './im-robots.service';
import { PrismaModule } from '../../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ImRobotsController],
  providers: [ImRobotsService],
  exports: [ImRobotsService],
})
export class ImRobotsModule {}

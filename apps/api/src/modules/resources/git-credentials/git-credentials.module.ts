import { Module } from '@nestjs/common';
import { GitCredentialsController } from './git-credentials.controller';
import { GitCredentialsService } from './git-credentials.service';
import { PrismaModule } from '../../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GitCredentialsController],
  providers: [GitCredentialsService],
})
export class GitCredentialsModule {}

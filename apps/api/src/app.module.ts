import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './common/prisma/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { GitCredentialsModule } from './modules/resources/git-credentials/git-credentials.module';
import { ImRobotsModule } from './modules/resources/im-robots/im-robots.module';
import { ProjectCoreModule } from './modules/projects/project-core/project-core.module';
import { RobotPoolModule } from './modules/build/robot-pool/robot-pool.module';
import { BuildTasksModule } from './modules/build/build-tasks/build-tasks.module';
import { WsModule } from './modules/ws/ws.module';
import { ArtifactsModule } from './modules/build/artifacts/artifacts.module';
import { AuditLogsModule } from './modules/resources/audit-logs/audit-logs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD', ''),
        },
      }),
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    GitCredentialsModule,
    ImRobotsModule,
    ProjectCoreModule,
    RobotPoolModule,
    BuildTasksModule,
    WsModule,
    ArtifactsModule,
    AuditLogsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}

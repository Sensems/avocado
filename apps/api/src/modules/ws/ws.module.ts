import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WsGateway } from './ws.gateway';

@Module({
  imports: [
    // 与 AuthModule 使用同一套 secret 配置，用于校验握手阶段的 JWT
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'avocado-secret-key-default'),
      }),
    }),
  ],
  providers: [WsGateway],
})
export class WsModule {}

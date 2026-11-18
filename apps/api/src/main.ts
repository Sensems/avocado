import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join, basename } from 'path';
import type { Request, Response, NextFunction } from 'express';
import { verifySignedPath } from './common/utils/signed-url.helper';

// BigInt 无法被 JSON.stringify 序列化，需全局添加 toJSON 方法
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
/* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 二维码走签名 URL：IM 机器人需要免鉴权访问，但任务 ID 是自增的、可被遍历，
  // 因此要求路径携带 HMAC 签名与过期时间（缺签名直接 403）。
  app.use('/storage', (req: Request, res: Response, next: NextFunction) => {
    const filename = basename(req.path);
    if (!/^qrcode-\d+\.jpg$/.test(filename)) {
      next();
      return;
    }

    const exp = Number(req.query.exp);
    const sig = String(req.query.sig ?? '');
    if (!verifySignedPath(`/storage/${filename}`, exp, sig)) {
      res.status(403).json({ code: 403, message: '链接已失效或签名无效', data: null });
      return;
    }
    next();
  });

  // 静态文件服务：将 public 目录下的文件直接提供访问
  // 编译后 __dirname = dist/src，需向上两级到项目根目录
  app.useStaticAssets(join(__dirname, '..', '..', 'public'));

  app.setGlobalPrefix('api');
  app.enableCors();

  // Global Pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global Interceptors & Filters
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // WebSocket Redis Adapter
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // Swagger 配置
  const config = new DocumentBuilder()
    .setTitle('Avocado CI/CD API')
    .setDescription('小程序私有化 CI/CD 后端 API 文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs/swagger.json',
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((err) => {
  console.error(err);
});

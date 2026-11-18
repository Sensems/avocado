import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException ? exception.message : '内部服务器错误';

    // 非 HttpException（未预期的错误）必须记录完整堆栈，否则线上只能看到一句"内部服务器错误"
    if (!(exception instanceof HttpException)) {
      const detail =
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception);
      this.logger.error(`Unhandled exception on ${request.method} ${request.url}`, detail);
    }

    // 提取 class-validator 的验证错误（如果有）
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;

    let errorDetails: string | string[] | null = null;
    if (
      exceptionResponse &&
      typeof exceptionResponse === 'object' &&
      'message' in exceptionResponse
    ) {
      errorDetails = (exceptionResponse as Record<string, unknown>).message as string | string[];
    }

    response.status(status).json({
      code: status,
      message,
      data: null,
      errorDetails,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

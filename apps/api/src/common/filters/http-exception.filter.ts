import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException ? exception.message : '内部服务器错误';

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

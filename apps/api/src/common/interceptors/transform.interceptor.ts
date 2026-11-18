import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  code: number;
  message: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map((data: any) => {
        // 跟随真实 HTTP 状态码：POST 默认返回 201，如果 body 里恒写 200，
        // 客户端按 body.code 判断时会和 HTTP 状态自相矛盾。
        const res = context.switchToHttp().getResponse<{ statusCode?: number }>();
        return {
          code: res?.statusCode ?? 200,
          message: '操作成功',
          data: data as T,
        };
      }),
    );
  }
}

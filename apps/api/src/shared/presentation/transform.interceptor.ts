import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { map, type Observable } from 'rxjs';

export interface ISuccessEnvelope<T> {
  status_code: number;
  success: true;
  message: string;
  data: T;
}

const DEFAULT_MESSAGE_BY_STATUS: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
};

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ISuccessEnvelope<T> | T>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ISuccessEnvelope<T> | T> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        const status = response.statusCode ?? 200;

        if (status === 204) {
          return data;
        }

        return {
          status_code: status,
          success: true,
          message: DEFAULT_MESSAGE_BY_STATUS[status] ?? 'OK',
          data: (data ?? {}) as T,
        };
      }),
    );
  }
}

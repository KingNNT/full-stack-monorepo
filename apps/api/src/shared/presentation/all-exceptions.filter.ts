import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ClsServiceManager } from 'nestjs-cls';
import { CLS_REQUEST_ID } from '../infrastructure/cls/cls.constants';

const DEFAULT_CODE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
};

type ExceptionBody = {
  message?: string | string[];
  error?: string;
  errorCode?: string;
  code?: string;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const { message, errorCode } = this.extractMessageAndCode(
      exception,
      status,
    );

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error('Unhandled exception', exception as Error);
    }

    const traceId = this.safeGetTraceId();

    response.status(status).json({
      status_code: status,
      success: false,
      message,
      error: errorCode,
      ...(traceId ? { errorTraceId: traceId } : {}),
    });
  }

  private extractMessageAndCode(
    exception: unknown,
    status: number,
  ): { message: string; errorCode: string } {
    const fallbackCode = DEFAULT_CODE_BY_STATUS[status] ?? 'HTTP_ERROR';

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return { message: res, errorCode: fallbackCode };
      }
      const body = res as ExceptionBody;
      const explicitCode = body.errorCode ?? body.code;
      const message = Array.isArray(body.message)
        ? body.message.join(', ')
        : (body.message ?? exception.message);
      return {
        message,
        errorCode: explicitCode ?? fallbackCode,
      };
    }

    return { message: 'Internal server error', errorCode: fallbackCode };
  }

  private safeGetTraceId(): string | undefined {
    try {
      const cls = ClsServiceManager.getClsService();
      return cls.get<string>(CLS_REQUEST_ID);
    } catch {
      return undefined;
    }
  }
}

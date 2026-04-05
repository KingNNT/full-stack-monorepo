import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { context, trace } from '@opentelemetry/api';
import { ClsService } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';
import { CLS_REQUEST_ID, CLS_USER_ID } from '../cls/cls.constants';

@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService, ClsService],
      useFactory: (config: ConfigService, cls: ClsService) => {
        const isDev = config.get('NODE_ENV') !== 'production';
        const level = config.get('LOG_LEVEL') ?? (isDev ? 'debug' : 'info');

        return {
          pinoHttp: {
            level,
            genReqId: (req: IncomingMessage) => {
              const id =
                (req.headers['x-request-id'] as string) ?? randomUUID();
              if (cls.isActive()) {
                cls.set(CLS_REQUEST_ID, id);
              }
              return id;
            },
            mixin: () => {
              const otelCtx = trace.getSpan(context.active())?.spanContext();
              const fields: Record<string, string> = {};

              if (otelCtx?.traceId) {
                fields.traceId = otelCtx.traceId;
                fields.spanId = otelCtx.spanId;
              }

              if (cls.isActive()) {
                const userId = cls.get(CLS_USER_ID);
                if (userId) fields.userId = userId;
              }

              return fields;
            },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.body.password',
                'req.body.passwordHash',
                'req.body.accessToken',
                'req.body.refreshToken',
              ],
              censor: '[REDACTED]',
            },
            serializers: {
              req: (req: {
                method: string;
                url: string;
                headers: Record<string, string>;
              }) => ({
                method: req.method,
                url: req.url,
                host: req.headers?.host,
                'user-agent': req.headers?.['user-agent'],
              }),
              res: (res: { statusCode: number }) => ({
                statusCode: res.statusCode,
              }),
            },
            ...(isDev
              ? {
                  transport: {
                    target: 'pino-pretty',
                    options: { colorize: true, singleLine: true },
                  },
                }
              : {}),
          },
        };
      },
    }),
  ],
})
export class AppLoggerModule {}

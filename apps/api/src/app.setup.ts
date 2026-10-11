import {
  ClassSerializerInterceptor,
  type INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { ClsUserInterceptor } from './shared/infrastructure/cls/cls-user.interceptor';
import { AllExceptionsFilter } from './shared/presentation/all-exceptions.filter';
import { TransformInterceptor } from './shared/presentation/transform.interceptor';

// Routing and request pipeline shared by main.ts and the e2e test app, so
// tests exercise the same URLs, envelopes and error format as production.
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api', {
    exclude: ['health', 'readiness', 'metrics'],
  });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  const cls = app.get(ClsService);
  app.useGlobalInterceptors(
    new ClsUserInterceptor(cls),
    new ClassSerializerInterceptor(app.get(Reflector)),
    new TransformInterceptor(),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
}

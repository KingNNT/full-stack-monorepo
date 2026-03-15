import {
  ClassSerializerInterceptor,
  type INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { AppModule } from '../../src/app.module';
import { DrizzleService } from '../../src/shared/infrastructure/database/drizzle.service';
import * as schema from '../../src/shared/infrastructure/database/schema/index';

let testSql: postgres.Sql | null = null;

export async function createTestApp(
  envOverrides: Record<string, string>,
): Promise<INestApplication> {
  // Ensure NODE_ENV=test so ConfigModule loads .env.test
  process.env.NODE_ENV = 'test';

  // Silence pino logs in tests unless explicitly configured
  process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';

  // Set env vars so ConfigService picks them up (e.g. dynamic DATABASE_URL from TestContainers)
  for (const [key, value] of Object.entries(envOverrides)) {
    process.env[key] = value;
  }

  // Create a Drizzle instance pointing to the test DB
  testSql = postgres(envOverrides.DATABASE_URL);
  const testDb = drizzle(testSql, { schema });

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(DrizzleService)
    .useValue({
      db: testDb,
      transaction: <T>(fn: (tx: any) => Promise<T>): Promise<T> =>
        testDb.transaction(fn),
      onModuleInit: () => {},
      onModuleDestroy: async () => {
        await testSql?.end();
        testSql = null;
      },
    })
    .compile();

  const app = moduleRef.createNestApplication();

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();
  return app;
}

export async function closeTestConnection(): Promise<void> {
  if (testSql) {
    await testSql.end();
    testSql = null;
  }
}

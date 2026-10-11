import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import {
  type IMailSender,
  MAIL_SENDER_TOKEN,
} from '../../src/shared/application/ports/mail.interface';
import { DrizzleService } from '../../src/shared/infrastructure/database/drizzle.service';
import * as schema from '../../src/shared/infrastructure/database/schema/index';

let testSql: postgres.Sql | null = null;

export async function createTestApp(
  envOverrides: Record<string, string>,
  options: { mailSender?: IMailSender } = {},
): Promise<INestApplication> {
  // Ensure NODE_ENV=test so ConfigModule loads .env.test
  process.env.NODE_ENV = 'test';

  // Silence pino logs in tests unless explicitly configured
  process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';

  // Disable throttling for e2e tests (sequential calls would otherwise exhaust limits)
  process.env.THROTTLE_DISABLED = 'true';

  // Set env vars so ConfigService picks them up (e.g. dynamic DATABASE_URL from TestContainers)
  for (const [key, value] of Object.entries(envOverrides)) {
    process.env[key] = value;
  }

  // Create a Drizzle instance pointing to the test DB
  testSql = postgres(envOverrides.DATABASE_URL);
  const testDb = drizzle(testSql, { schema });

  let builder = Test.createTestingModule({
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
    });
  if (options.mailSender) {
    builder = builder
      .overrideProvider(MAIL_SENDER_TOKEN)
      .useValue(options.mailSender);
  }
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication();

  configureApp(app);

  await app.init();
  return app;
}

export async function closeTestConnection(): Promise<void> {
  if (testSql) {
    await testSql.end();
    testSql = null;
  }
}

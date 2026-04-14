import type { INestApplication } from '@nestjs/common';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { authCredentialsTable } from '../../../src/shared/infrastructure/database/schema/auth-credentials.table';
import {
  cleanDatabase,
  disconnectDrizzle,
  setupDrizzleForTests,
  type TestDrizzleDb,
} from '../../helpers/drizzle-test-utils';
import { createTestApp } from '../../helpers/test-app-factory';
import { startPostgresContainer } from '../../helpers/testcontainers-setup';

describe('POST /auth/login (e2e)', () => {
  let app: INestApplication<App>;
  let pgContainer: StartedPostgreSqlContainer;
  let db: TestDrizzleDb;

  const testUser = {
    email: 'logintest@example.com',
    username: 'logintest',
    password: 'securePass123',
  };

  beforeAll(async () => {
    pgContainer = await startPostgresContainer();

    const dbUrl = pgContainer.getConnectionUri();
    db = await setupDrizzleForTests(dbUrl);

    app = await createTestApp({
      DATABASE_URL: dbUrl,
    });
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await disconnectDrizzle();
    await pgContainer?.stop();
  });

  beforeEach(async () => {
    await cleanDatabase(db);
    // Register a test user before each login test
    await request(app.getHttpServer()).post('/auth/register').send(testUser);
  });

  it('200 — login with email', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      identifier: testUser.email,
      password: testUser.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.access_token).toBeDefined();
    expect(res.body.data.refresh_token).toBeDefined();
    expect(typeof res.body.data.access_token).toBe('string');
    expect(typeof res.body.data.refresh_token).toBe('string');
  });

  it('200 — login with username', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      identifier: testUser.username,
      password: testUser.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.access_token).toBeDefined();
    expect(res.body.data.refresh_token).toBeDefined();
  });

  it('returns valid JWT tokens', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      identifier: testUser.email,
      password: testUser.password,
    });

    // JWT tokens have 3 parts separated by dots
    expect(res.body.data.access_token.split('.')).toHaveLength(3);
    expect(res.body.data.refresh_token.split('.')).toHaveLength(3);
  });

  it('401 — wrong password', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      identifier: testUser.email,
      password: 'wrongPassword',
    });

    expect(res.status).toBe(401);
  });

  it('401 — non-existent user', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      identifier: 'nobody@example.com',
      password: 'somePassword',
    });

    expect(res.status).toBe(401);
  });

  it('400 — missing fields', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      identifier: testUser.email,
    });

    expect(res.status).toBe(400);
  });

  it('updates lastLoginAt timestamp', async () => {
    await request(app.getHttpServer()).post('/auth/login').send({
      identifier: testUser.email,
      password: testUser.password,
    });

    // Query credentials to check lastLoginAt
    const results = await db
      .select()
      .from(authCredentialsTable)
      .where(eq(authCredentialsTable.email, testUser.email));
    const cred = results[0];
    expect(cred.lastLoginAt).toBeDefined();
    expect(cred.lastLoginAt).not.toBeNull();
  });
});

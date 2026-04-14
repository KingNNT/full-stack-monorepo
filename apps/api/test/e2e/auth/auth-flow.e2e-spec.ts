import type { INestApplication } from '@nestjs/common';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  cleanDatabase,
  disconnectDrizzle,
  setupDrizzleForTests,
  type TestDrizzleDb,
} from '../../helpers/drizzle-test-utils';
import { createTestApp } from '../../helpers/test-app-factory';
import { startPostgresContainer } from '../../helpers/testcontainers-setup';

describe('Auth flow (e2e)', () => {
  let app: INestApplication<App>;
  let pgContainer: StartedPostgreSqlContainer;
  let db: TestDrizzleDb;

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
  });

  it('register then login with email', async () => {
    // Register
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'flow@example.com',
        username: 'flowuser',
        password: 'securePass123',
      });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.data.user_id).toBeDefined();

    // Login with email
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        identifier: 'flow@example.com',
        password: 'securePass123',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.access_token).toBeDefined();
    expect(loginRes.body.data.refresh_token).toBeDefined();
  });

  it('register then login with username', async () => {
    // Register
    await request(app.getHttpServer()).post('/auth/register').send({
      email: 'flow2@example.com',
      username: 'flow2user',
      password: 'securePass123',
    });

    // Login with username
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        identifier: 'flow2user',
        password: 'securePass123',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.access_token).toBeDefined();
  });

  it('register then login with email then login with username', async () => {
    await request(app.getHttpServer()).post('/auth/register').send({
      email: 'multi@example.com',
      username: 'multiuser',
      password: 'securePass123',
    });

    // Login via email
    const loginEmail = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        identifier: 'multi@example.com',
        password: 'securePass123',
      });
    expect(loginEmail.status).toBe(200);

    // Login via username
    const loginUsername = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        identifier: 'multiuser',
        password: 'securePass123',
      });
    expect(loginUsername.status).toBe(200);

    // Both should return valid tokens
    expect(loginEmail.body.data.access_token).toBeDefined();
    expect(loginUsername.body.data.access_token).toBeDefined();
  });
});

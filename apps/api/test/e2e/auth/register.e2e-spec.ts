import type { INestApplication } from '@nestjs/common';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { authCredentialsTable } from '../../../src/shared/infrastructure/database/schema/auth-credentials.table';
import { usersTable } from '../../../src/shared/infrastructure/database/schema/users.table';
import {
  cleanDatabase,
  disconnectDrizzle,
  setupDrizzleForTests,
  type TestDrizzleDb,
} from '../../helpers/drizzle-test-utils';
import { createTestApp } from '../../helpers/test-app-factory';
import { startPostgresContainer } from '../../helpers/testcontainers-setup';

describe('POST /auth/register (e2e)', () => {
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

  it('201 — registers with valid data', async () => {
    const res = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'newuser@example.com',
      username: 'newuser',
      password: 'securePass123',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user_id).toBeDefined();
    expect(typeof res.body.data.user_id).toBe('string');
  });

  it('user is stored in users table', async () => {
    const res = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'dbcheck@example.com',
      username: 'dbcheck',
      password: 'securePass123',
    });

    const results = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, res.body.data.user_id));
    const user = results[0];
    expect(user).toBeDefined();
    expect(user.email).toBe('dbcheck@example.com');
  });

  it('credentials are stored in auth_credentials table', async () => {
    const res = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'credcheck@example.com',
      username: 'credcheck',
      password: 'securePass123',
    });

    const results = await db
      .select()
      .from(authCredentialsTable)
      .where(eq(authCredentialsTable.userId, res.body.data.user_id));
    const cred = results[0];
    expect(cred).toBeDefined();
    expect(cred.email).toBe('credcheck@example.com');
    expect(cred.passwordHash).toMatch(/^\$2[ab]\$/);
  });

  it('400 — rejects invalid email', async () => {
    const res = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'not-an-email',
      username: 'validuser',
      password: 'securePass123',
    });

    expect(res.status).toBe(400);
  });

  it('400 — rejects short password', async () => {
    const res = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'test@example.com',
      username: 'testuser',
      password: 'short',
    });

    expect(res.status).toBe(400);
  });

  it('400 — rejects missing fields', async () => {
    const res = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'test@example.com',
    });

    expect(res.status).toBe(400);
  });

  it('400 — rejects extra fields (forbidNonWhitelisted)', async () => {
    const res = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'test@example.com',
      username: 'testuser',
      password: 'securePass123',
      extraField: 'not-allowed',
    });

    expect(res.status).toBe(400);
  });

  it('error on duplicate email', async () => {
    await request(app.getHttpServer()).post('/auth/register').send({
      email: 'dup@example.com',
      username: 'first',
      password: 'securePass123',
    });

    const res = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'dup@example.com',
      username: 'second',
      password: 'securePass123',
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('error on duplicate username', async () => {
    await request(app.getHttpServer()).post('/auth/register').send({
      email: 'first@example.com',
      username: 'sameuser',
      password: 'securePass123',
    });

    const res = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'second@example.com',
      username: 'sameuser',
      password: 'securePass123',
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

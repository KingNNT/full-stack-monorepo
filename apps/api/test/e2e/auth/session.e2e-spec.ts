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

describe('Sessions: refresh and revocation (e2e)', () => {
  let app: INestApplication<App>;
  let pgContainer: StartedPostgreSqlContainer;
  let db: TestDrizzleDb;

  const user = {
    email: 'session@example.com',
    username: 'sessionuser',
    password: 'securePass123',
  };

  async function login(password = user.password) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: user.email, password });
    return res.body.data as { access_token: string; refresh_token: string };
  }

  beforeAll(async () => {
    pgContainer = await startPostgresContainer();
    const dbUrl = pgContainer.getConnectionUri();
    db = await setupDrizzleForTests(dbUrl);
    app = await createTestApp({ DATABASE_URL: dbUrl });
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await disconnectDrizzle();
    await pgContainer?.stop();
  });

  beforeEach(async () => {
    await cleanDatabase(db);
    await request(app.getHttpServer()).post('/api/v1/auth/register').send(user);
  });

  it('refresh returns a pair that works on protected routes', async () => {
    const { refresh_token } = await login();

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Authorization', `Bearer ${refresh_token}`);

    expect(res.status).toBe(200);
    const profile = await request(app.getHttpServer())
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${res.body.data.access_token}`);
    expect(profile.status).toBe(200);
  });

  it('rejects an access token on /auth/refresh and a refresh token on protected routes', async () => {
    const { access_token, refresh_token } = await login();

    const refreshWithAccess = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Authorization', `Bearer ${access_token}`);
    const profileWithRefresh = await request(app.getHttpServer())
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${refresh_token}`);

    expect(refreshWithAccess.status).toBe(401);
    expect(profileWithRefresh.status).toBe(401);
  });

  it('changing the password revokes the refresh tokens of other sessions', async () => {
    const other = await login();
    const current = await login();

    await request(app.getHttpServer())
      .post('/api/v1/users/change-password')
      .set('Authorization', `Bearer ${current.access_token}`)
      .send({ old_password: user.password, new_password: 'anotherPass42' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Authorization', `Bearer ${other.refresh_token}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('SESSION_REVOKED');
  });
});

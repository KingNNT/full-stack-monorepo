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

describe('Users profile + change-password (e2e)', () => {
  let app: INestApplication<App>;
  let pgContainer: StartedPostgreSqlContainer;
  let db: TestDrizzleDb;

  const initialUser = {
    email: 'profile@example.com',
    username: 'profileuser',
    password: 'securePass123',
  };

  let userId: string;
  let accessToken: string;
  let currentPassword = initialUser.password;

  beforeAll(async () => {
    pgContainer = await startPostgresContainer();
    const dbUrl = pgContainer.getConnectionUri();
    db = await setupDrizzleForTests(dbUrl);
    app = await createTestApp({ DATABASE_URL: dbUrl });

    await cleanDatabase(db);

    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send(initialUser);
    userId = reg.body.data.user_id as string;

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: initialUser.email, password: initialUser.password });
    accessToken = login.body.data.access_token as string;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await disconnectDrizzle();
    await pgContainer?.stop();
  });

  describe('GET /users/profile', () => {
    it('200 — returns current user profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        user_id: userId,
        email: initialUser.email,
        is_active: true,
      });
      expect(typeof res.body.data.username).toBe('string');
    });

    it('401 — no token', async () => {
      const res = await request(app.getHttpServer()).get('/users/profile');
      expect(res.status).toBe(401);
    });

    it('401 — invalid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', 'Bearer not-a-real-token');
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /users/profile', () => {
    it('400 — invalid username (too short)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ username: 'ab' });

      expect(res.status).toBe(400);
    });

    it('401 — no token', async () => {
      const res = await request(app.getHttpServer())
        .patch('/users/profile')
        .send({ username: 'whatever' });
      expect(res.status).toBe(401);
    });

    it('200 — updates username and syncs to auth_credentials', async () => {
      const newUsername = 'renamed';

      const res = await request(app.getHttpServer())
        .patch('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ username: newUsername });

      expect(res.status).toBe(200);
      expect(res.body.data.username).toBe(newUsername);

      // Allow async event handler to flush
      await new Promise((r) => setTimeout(r, 200));

      const rows = await db
        .select()
        .from(authCredentialsTable)
        .where(eq(authCredentialsTable.email, initialUser.email));
      expect(rows[0].username).toBe(newUsername);
    });
  });

  describe('POST /users/change-password', () => {
    it('400 — new password too short', async () => {
      const res = await request(app.getHttpServer())
        .post('/users/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ old_password: currentPassword, new_password: 'short' });

      expect(res.status).toBe(400);
    });

    it('401 — wrong current password', async () => {
      const res = await request(app.getHttpServer())
        .post('/users/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          old_password: 'wrongOldPass',
          new_password: 'brandNewPass99',
        });

      expect(res.status).toBe(401);
    });

    it('401 — no token', async () => {
      const res = await request(app.getHttpServer())
        .post('/users/change-password')
        .send({
          old_password: currentPassword,
          new_password: 'brandNewPass99',
        });
      expect(res.status).toBe(401);
    });

    it('204 — changes password (verified via DB hash mutation)', async () => {
      const newPassword = 'brandNewPass99';

      const beforeRows = await db
        .select()
        .from(authCredentialsTable)
        .where(eq(authCredentialsTable.email, initialUser.email));
      const oldHash = beforeRows[0].passwordHash;

      const res = await request(app.getHttpServer())
        .post('/users/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ old_password: currentPassword, new_password: newPassword });

      expect(res.status).toBe(204);

      const afterRows = await db
        .select()
        .from(authCredentialsTable)
        .where(eq(authCredentialsTable.email, initialUser.email));
      expect(afterRows[0].passwordHash).not.toBe(oldHash);

      currentPassword = newPassword;
    });
  });
});

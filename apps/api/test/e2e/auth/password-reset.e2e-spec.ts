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
import { MailCapture, tokenFrom } from '../../helpers/mail-capture';
import { createTestApp } from '../../helpers/test-app-factory';
import { startPostgresContainer } from '../../helpers/testcontainers-setup';

describe('Forgot / reset password (e2e)', () => {
  let app: INestApplication<App>;
  let pgContainer: StartedPostgreSqlContainer;
  let db: TestDrizzleDb;
  const mail = new MailCapture();
  const user = {
    email: 'forgetful@example.com',
    username: 'forgetful',
    password: 'originalPass1',
  };

  const flush = () => new Promise((r) => setTimeout(r, 200));
  const server = () => app.getHttpServer();

  async function requestReset(email = user.email, locale = 'en') {
    const res = await request(server())
      .post('/api/v1/auth/forgot-password')
      .send({ email, locale });
    await flush();
    return res;
  }

  beforeAll(async () => {
    pgContainer = await startPostgresContainer();
    const dbUrl = pgContainer.getConnectionUri();
    db = await setupDrizzleForTests(dbUrl);
    app = await createTestApp(
      { DATABASE_URL: dbUrl, WEB_APP_URL: 'https://app.test' },
      { mailSender: mail },
    );
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await disconnectDrizzle();
    await pgContainer?.stop();
  });

  beforeEach(async () => {
    await cleanDatabase(db);
    mail.clear();
    await request(server()).post('/api/v1/auth/register').send(user);
  });

  it('answers 202 with an empty body for known and unknown emails alike', async () => {
    const known = await requestReset();
    const unknown = await requestReset('nobody@example.com');

    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(known.body.data).toEqual({});
    expect(unknown.body).toEqual(known.body);
    expect(mail.messages.map((m) => m.to)).toEqual([user.email]);
  });

  it('sends the link in the requested locale', async () => {
    await requestReset(user.email, 'vi');

    const message = mail.lastTo(user.email);
    expect(message?.subject).toBe('Đặt lại mật khẩu');
    expect(message?.text).toContain(
      'https://app.test/vi/reset-password?token=',
    );
  });

  it('rejects an unsupported locale', async () => {
    const res = await request(server())
      .post('/api/v1/auth/forgot-password')
      .send({ email: user.email, locale: 'fr' });

    expect(res.status).toBe(400);
  });

  it('resets the password once, revokes sessions and notifies', async () => {
    const login = await request(server())
      .post('/api/v1/auth/login')
      .send({ identifier: user.email, password: user.password });
    await requestReset();
    const token = tokenFrom(mail.lastTo(user.email)!);

    const reset = await request(server())
      .post('/api/v1/auth/reset-password')
      .send({ token, new_password: 'freshPass123' });
    await flush();

    expect(reset.status).toBe(200);
    expect(reset.body.data).toEqual({});

    const oldPassword = await request(server())
      .post('/api/v1/auth/login')
      .send({ identifier: user.email, password: user.password });
    const newPassword = await request(server())
      .post('/api/v1/auth/login')
      .send({ identifier: user.email, password: 'freshPass123' });
    const oldSession = await request(server())
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${login.body.data.access_token}`);
    const oldRefresh = await request(server())
      .post('/api/v1/auth/refresh')
      .set('Authorization', `Bearer ${login.body.data.refresh_token}`);
    const reuse = await request(server())
      .post('/api/v1/auth/reset-password')
      .send({ token, new_password: 'anotherPass1' });

    expect(oldPassword.status).toBe(401);
    expect(newPassword.status).toBe(200);
    expect(oldSession.status).toBe(401);
    expect(oldRefresh.status).toBe(401);
    expect(oldRefresh.body.error).toBe('SESSION_REVOKED');
    expect(reuse.status).toBe(400);
    expect(reuse.body.error).toBe('INVALID_RESET_TOKEN');
    expect(mail.lastTo(user.email)?.subject).toBe('Your password was changed');
  });

  it('rejects a made-up token and a weak password', async () => {
    const bogus = await request(server())
      .post('/api/v1/auth/reset-password')
      .send({ token: 'not-a-real-token', new_password: 'freshPass123' });
    const weak = await request(server())
      .post('/api/v1/auth/reset-password')
      .send({ token: 'not-a-real-token', new_password: 'short' });

    expect(bogus.status).toBe(400);
    expect(bogus.body.error).toBe('INVALID_RESET_TOKEN');
    expect(weak.status).toBe(400);
  });

  it('does not issue a second link within the cooldown', async () => {
    await requestReset();
    await requestReset();

    expect(mail.messages).toHaveLength(1);
  });
});

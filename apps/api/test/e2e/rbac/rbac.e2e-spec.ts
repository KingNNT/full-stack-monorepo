import type { INestApplication } from '@nestjs/common';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  authCredentialsTable,
  modelHasPermissionsTable,
  modelHasRolesTable,
  permissionsTable,
  roleHasPermissionsTable,
  rolesTable,
} from '../../../src/shared/infrastructure/database/schema/index';
import {
  cleanDatabase,
  disconnectDrizzle,
  setupDrizzleForTests,
  type TestDrizzleDb,
} from '../../helpers/drizzle-test-utils';
import { createTestApp } from '../../helpers/test-app-factory';
import { startPostgresContainer } from '../../helpers/testcontainers-setup';

describe('RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let pgContainer: StartedPostgreSqlContainer;
  let db: TestDrizzleDb;
  let accessToken: string;

  const testUser = {
    email: 'admin@example.com',
    username: 'admin',
    password: 'securePass123',
  };

  async function cleanRbacTables() {
    await db.delete(modelHasPermissionsTable);
    await db.delete(modelHasRolesTable);
    await db.delete(roleHasPermissionsTable);
    await db.delete(permissionsTable);
    await db.delete(rolesTable);
  }

  async function seedSuperAdmin() {
    await request(app.getHttpServer()).post('/auth/register').send(testUser);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        identifier: testUser.email,
        password: testUser.password,
      });
    accessToken = loginRes.body.access_token;

    const [role] = await db
      .insert(rolesTable)
      .values({
        name: 'super-admin',
        description: 'Super Administrator',
      })
      .returning();

    const [cred] = await db
      .select()
      .from(authCredentialsTable)
      .where(eq(authCredentialsTable.email, testUser.email));

    await db.insert(modelHasRolesTable).values({
      modelType: 'user',
      modelId: cred.userId,
      roleId: role.id,
    });
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
    await cleanRbacTables();
    await cleanDatabase(db);
    await seedSuperAdmin();
  });

  // ── Roles CRUD ──────────────────────────────────

  describe('Roles CRUD', () => {
    it('POST /rbac/roles — creates a role', async () => {
      const res = await request(app.getHttpServer())
        .post('/rbac/roles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'editor',
          description: 'Content editor',
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('editor');
      expect(res.body.description).toBe('Content editor');
      expect(res.body.id).toBeDefined();
    });

    it('GET /rbac/roles — lists roles', async () => {
      const res = await request(app.getHttpServer())
        .get('/rbac/roles')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /rbac/roles/:id — gets role with permissions', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/rbac/roles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'viewer',
          description: 'Read-only viewer',
        });

      const roleId = createRes.body.id;

      const res = await request(app.getHttpServer())
        .get(`/rbac/roles/${roleId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('viewer');
      expect(Array.isArray(res.body.permissions)).toBe(true);
    });

    it('PATCH /rbac/roles/:id — updates role', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/rbac/roles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'old-name',
          description: 'Original',
        });

      const roleId = createRes.body.id;

      const res = await request(app.getHttpServer())
        .patch(`/rbac/roles/${roleId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'new-name' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('new-name');
    });

    it('DELETE /rbac/roles/:id — soft deletes', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/rbac/roles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'disposable',
          description: 'To be deleted',
        });

      const roleId = createRes.body.id;

      const res = await request(app.getHttpServer())
        .delete(`/rbac/roles/${roleId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(204);
    });
  });

  // ── Permissions CRUD ────────────────────────────

  describe('Permissions CRUD', () => {
    it('POST /rbac/permissions — creates a permission', async () => {
      const res = await request(app.getHttpServer())
        .post('/rbac/permissions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'posts.create' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('posts.create');
      expect(res.body.id).toBeDefined();
    });

    it('GET /rbac/permissions — lists permissions', async () => {
      await request(app.getHttpServer())
        .post('/rbac/permissions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'posts.read' });

      const res = await request(app.getHttpServer())
        .get('/rbac/permissions')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Permission Guard ────────────────────────────

  describe('Permission Guard', () => {
    it('403 — user without permission is denied', async () => {
      const secondUser = {
        email: 'norole@example.com',
        username: 'norole',
        password: 'securePass123',
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(secondUser);

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          identifier: secondUser.email,
          password: secondUser.password,
        });

      const noRoleToken = loginRes.body.access_token;

      const res = await request(app.getHttpServer())
        .get('/rbac/roles')
        .set('Authorization', `Bearer ${noRoleToken}`);

      expect(res.status).toBe(403);
    });

    it('200 — super-admin bypasses permission check', async () => {
      const res = await request(app.getHttpServer())
        .get('/rbac/roles')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
    });
  });

  // ── Assignments ─────────────────────────────────

  describe('Assignments', () => {
    it('POST /rbac/assign/role — assigns role to user', async () => {
      const secondUser = {
        email: 'assignee@example.com',
        username: 'assignee',
        password: 'securePass123',
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(secondUser);

      const createRoleRes = await request(app.getHttpServer())
        .post('/rbac/roles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'member',
          description: 'Regular member',
        });

      const roleId = createRoleRes.body.id;

      const [cred] = await db
        .select()
        .from(authCredentialsTable)
        .where(eq(authCredentialsTable.email, secondUser.email));

      const res = await request(app.getHttpServer())
        .post('/rbac/assign/role')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          model_type: 'user',
          model_id: cred.userId,
          role_id: roleId,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Role assigned');
    });

    it('GET /rbac/model/:modelType/:modelId/roles — gets model roles', async () => {
      const secondUser = {
        email: 'roled@example.com',
        username: 'roled',
        password: 'securePass123',
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(secondUser);

      const createRoleRes = await request(app.getHttpServer())
        .post('/rbac/roles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'moderator',
          description: 'Moderator role',
        });

      const roleId = createRoleRes.body.id;

      const [cred] = await db
        .select()
        .from(authCredentialsTable)
        .where(eq(authCredentialsTable.email, secondUser.email));

      await request(app.getHttpServer())
        .post('/rbac/assign/role')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          model_type: 'user',
          model_id: cred.userId,
          role_id: roleId,
        });

      const res = await request(app.getHttpServer())
        .get(`/rbac/model/user/${cred.userId}/roles`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(
        res.body.some((r: { name: string }) => r.name === 'moderator'),
      ).toBe(true);
    });
  });
});

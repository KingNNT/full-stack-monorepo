import { randomUUID } from 'node:crypto';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RbacRepository } from '../../../src/modules/rbac/infrastructure/persistence/rbac.repository';
import { AuditableTableService } from '../../../src/shared/infrastructure/database/auditable-table.service';
import type { DrizzleService } from '../../../src/shared/infrastructure/database/drizzle.service';
import {
  modelHasPermissionsTable,
  modelHasRolesTable,
  permissionsTable,
  roleHasPermissionsTable,
  rolesTable,
} from '../../../src/shared/infrastructure/database/schema/index';
import {
  disconnectDrizzle,
  setupDrizzleForTests,
  type TestDrizzleDb,
} from '../../helpers/drizzle-test-utils';
import { startPostgresContainer } from '../../helpers/testcontainers-setup';

describe('RbacRepository (integration)', () => {
  let pgContainer: StartedPostgreSqlContainer;
  let db: TestDrizzleDb;
  let repo: RbacRepository;

  beforeAll(async () => {
    pgContainer = await startPostgresContainer();
    const dbUrl = pgContainer.getConnectionUri();
    db = await setupDrizzleForTests(dbUrl);

    const drizzleService = {
      db,
      transaction: <T>(fn: (tx: any) => Promise<T>): Promise<T> =>
        db.transaction(fn),
    } as DrizzleService;
    const clsService = {
      isActive: () => false,
      get: () => null,
    } as any;
    const auditableService = new AuditableTableService(
      drizzleService,
      clsService,
    );

    repo = new RbacRepository(drizzleService, auditableService);
  }, 120_000);

  afterAll(async () => {
    await disconnectDrizzle();
    await pgContainer?.stop();
  });

  beforeEach(async () => {
    await db.delete(modelHasPermissionsTable);
    await db.delete(modelHasRolesTable);
    await db.delete(roleHasPermissionsTable);
    await db.delete(permissionsTable);
    await db.delete(rolesTable);
  });

  // ── Roles ───────────────────────────────────

  it('should create and find a role', async () => {
    const role = await repo.createRole('admin', 'Administrator');

    const found = await repo.findRoleById(role.id);

    expect(found).not.toBeNull();
    expect(found?.name).toBe('admin');
    expect(found?.description).toBe('Administrator');
  });

  it('should find role by name', async () => {
    const role = await repo.createRole('editor', 'Content editor');

    const found = await repo.findRoleByName('editor');

    expect(found).not.toBeNull();
    expect(found?.id).toBe(role.id);
  });

  it('should list all roles', async () => {
    await repo.createRole('role-a');
    await repo.createRole('role-b');

    const roles = await repo.findAllRoles();

    expect(roles).toHaveLength(2);
  });

  it('should update a role', async () => {
    const role = await repo.createRole('old-name');

    await repo.updateRole(role.id, { name: 'new-name' });

    const found = await repo.findRoleById(role.id);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('new-name');
  });

  it('should soft delete a role', async () => {
    const role = await repo.createRole('to-delete');

    await repo.softDeleteRole(role.id);

    const found = await repo.findRoleById(role.id);
    expect(found).toBeNull();
  });

  // ── Permissions ─────────────────────────────

  it('should create and find a permission', async () => {
    const perm = await repo.createPermission('users.read', 'Read users');

    const found = await repo.findPermissionById(perm.id);

    expect(found).not.toBeNull();
    expect(found?.name).toBe('users.read');
    expect(found?.description).toBe('Read users');
  });

  // ── Role <-> Permission ─────────────────────

  it('should sync permissions to role', async () => {
    const role = await repo.createRole('viewer');
    const p1 = await repo.createPermission('articles.read');
    const p2 = await repo.createPermission('articles.list');

    await repo.syncPermissionsToRole(role.id, [p1.id, p2.id]);

    const perms = await repo.findPermissionsByRoleId(role.id);
    expect(perms).toHaveLength(2);
    const names = perms.map((p) => p.name).sort();
    expect(names).toEqual(['articles.list', 'articles.read']);
  });

  it('should replace permissions on re-sync', async () => {
    const role = await repo.createRole('editor');
    const p1 = await repo.createPermission('perm.a');
    const p2 = await repo.createPermission('perm.b');
    const p3 = await repo.createPermission('perm.c');

    await repo.syncPermissionsToRole(role.id, [p1.id, p2.id]);
    await repo.syncPermissionsToRole(role.id, [p3.id]);

    const perms = await repo.findPermissionsByRoleId(role.id);
    expect(perms).toHaveLength(1);
    expect(perms[0].name).toBe('perm.c');
  });

  // ── Model <-> Role ──────────────────────────

  it('should assign and find roles for a model', async () => {
    const role = await repo.createRole('member');
    const modelId = randomUUID();

    await repo.assignRoleToModel('user', modelId, role.id);

    const roles = await repo.findRolesByModel('user', modelId);
    expect(roles).toHaveLength(1);
    expect(roles[0].name).toBe('member');
  });

  it('should check modelHasRole', async () => {
    const role = await repo.createRole('super-admin');
    const modelId = randomUUID();
    await repo.assignRoleToModel('user', modelId, role.id);

    const hasSuper = await repo.modelHasRole('user', modelId, 'super-admin');
    const hasEditor = await repo.modelHasRole('user', modelId, 'editor');

    expect(hasSuper).toBe(true);
    expect(hasEditor).toBe(false);
  });

  it('should revoke role from model', async () => {
    const role = await repo.createRole('temp-role');
    const modelId = randomUUID();
    await repo.assignRoleToModel('user', modelId, role.id);

    await repo.revokeRoleFromModel('user', modelId, role.id);

    const roles = await repo.findRolesByModel('user', modelId);
    expect(roles).toHaveLength(0);
  });

  // ── Permission Resolution ───────────────────

  it('should resolve from roles and direct assignments', async () => {
    const role = await repo.createRole('staff');
    const p1 = await repo.createPermission('reports.view');
    const p2 = await repo.createPermission('reports.export');
    const p3 = await repo.createPermission('dashboard.view');
    await repo.syncPermissionsToRole(role.id, [p1.id, p2.id]);

    const modelId = randomUUID();
    await repo.assignRoleToModel('user', modelId, role.id);
    await repo.assignPermissionToModel('user', modelId, p3.id);

    const resolved = await repo.resolveModelPermissions('user', modelId);
    expect(resolved).toHaveLength(3);
    const names = resolved.map((p) => p.name).sort();
    expect(names).toEqual(['dashboard.view', 'reports.export', 'reports.view']);
  });

  it('should deduplicate permissions from multiple sources', async () => {
    const role = await repo.createRole('manager');
    const shared = await repo.createPermission('shared.perm');
    await repo.syncPermissionsToRole(role.id, [shared.id]);

    const modelId = randomUUID();
    await repo.assignRoleToModel('user', modelId, role.id);
    await repo.assignPermissionToModel('user', modelId, shared.id);

    const resolved = await repo.resolveModelPermissions('user', modelId);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].name).toBe('shared.perm');
  });
});

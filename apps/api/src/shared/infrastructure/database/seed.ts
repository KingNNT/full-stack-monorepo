import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

const DEFAULT_USERS = [
  {
    email: 'admin@example.com',
    username: 'admin',
    password: 'admin123456',
  },
];

const PERMISSIONS = [
  // Roles management
  { name: 'roles.create', description: 'Create roles' },
  { name: 'roles.read', description: 'View roles' },
  { name: 'roles.update', description: 'Update roles' },
  { name: 'roles.delete', description: 'Delete roles' },
  {
    name: 'roles.assign-permissions',
    description: 'Assign permissions to roles',
  },
  // Permissions management
  { name: 'permissions.create', description: 'Create permissions' },
  { name: 'permissions.read', description: 'View permissions' },
  { name: 'permissions.update', description: 'Update permissions' },
  { name: 'permissions.delete', description: 'Delete permissions' },
  // RBAC assignments
  { name: 'rbac.assign-role', description: 'Assign roles to models' },
  { name: 'rbac.revoke-role', description: 'Revoke roles from models' },
  {
    name: 'rbac.assign-permission',
    description: 'Assign direct permissions',
  },
  {
    name: 'rbac.revoke-permission',
    description: 'Revoke direct permissions',
  },
  {
    name: 'rbac.read',
    description: 'View model roles and permissions',
  },
  // Users
  { name: 'users.create', description: 'Create users' },
  { name: 'users.read', description: 'View users' },
  { name: 'users.update', description: 'Update users' },
  { name: 'users.delete', description: 'Delete users' },
];

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const sql = postgres(url);
  const db = drizzle(sql, { schema });

  console.log('Seeding RBAC data...');

  // 1. Upsert permissions
  for (const perm of PERMISSIONS) {
    const existing = await db
      .select()
      .from(schema.permissionsTable)
      .where(eq(schema.permissionsTable.name, perm.name))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(schema.permissionsTable).values(perm);
      console.log(`  Created permission: ${perm.name}`);
    } else {
      console.log(`  Permission exists: ${perm.name}`);
    }
  }

  // 2. Upsert super-admin role
  let superAdminRole = await db
    .select()
    .from(schema.rolesTable)
    .where(eq(schema.rolesTable.name, 'super-admin'))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!superAdminRole) {
    [superAdminRole] = await db
      .insert(schema.rolesTable)
      .values({
        name: 'super-admin',
        description: 'Super Administrator',
      })
      .returning();
    console.log('  Created role: super-admin');
  } else {
    console.log('  Role exists: super-admin');
  }

  // 3. Sync all permissions to super-admin
  const allPermissions = await db.select().from(schema.permissionsTable);
  await db
    .delete(schema.roleHasPermissionsTable)
    .where(eq(schema.roleHasPermissionsTable.roleId, superAdminRole.id));
  if (allPermissions.length > 0) {
    await db.insert(schema.roleHasPermissionsTable).values(
      allPermissions.map((p) => ({
        roleId: superAdminRole.id,
        permissionId: p.id,
      })),
    );
  }
  console.log(`  Synced ${allPermissions.length} permissions to super-admin`);

  // 4. Register default users via API (ensures event sourcing + password hashing)
  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:8000';
  for (const user of DEFAULT_USERS) {
    const existing = await db
      .select()
      .from(schema.authCredentialsTable)
      .where(eq(schema.authCredentialsTable.email, user.email))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  User exists: ${user.email}`);
      continue;
    }

    const res = await fetch(`${apiBaseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Failed to register ${user.email} (HTTP ${res.status}): ${body}`,
      );
    }
    console.log(`  Created user: ${user.email} / ${user.password}`);
  }

  // 5. Assign super-admin role to all seeded users
  for (const user of DEFAULT_USERS) {
    const row = await db
      .select()
      .from(schema.usersTable)
      .where(eq(schema.usersTable.email, user.email))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!row) continue;

    await db
      .insert(schema.modelHasRolesTable)
      .values({
        modelType: 'user',
        modelId: row.id,
        roleId: superAdminRole.id,
      })
      .onConflictDoNothing();
    console.log(`  Assigned super-admin to user: ${row.email}`);
  }

  console.log('Seed complete.');
  await sql.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

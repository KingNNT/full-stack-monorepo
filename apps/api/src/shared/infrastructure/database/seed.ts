import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

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

  // 4. Assign super-admin to first user (if exists)
  const firstUser = await db
    .select()
    .from(schema.usersTable)
    .limit(1)
    .then((r) => r[0] ?? null);

  if (firstUser) {
    await db
      .insert(schema.modelHasRolesTable)
      .values({
        modelType: 'user',
        modelId: firstUser.id,
        roleId: superAdminRole.id,
      })
      .onConflictDoNothing();
    console.log(`  Assigned super-admin to user: ${firstUser.email}`);
  } else {
    console.log('  No users found — skip super-admin assignment');
  }

  console.log('Seed complete.');
  await sql.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

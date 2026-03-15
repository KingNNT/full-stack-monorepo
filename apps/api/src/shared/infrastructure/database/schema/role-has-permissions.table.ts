import { pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { permissionsTable } from './permissions.table';
import { rolesTable } from './roles.table';

export const roleHasPermissionsTable = pgTable(
  'role_has_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => rolesTable.id),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissionsTable.id),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'date',
    })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

export type RoleHasPermissionRow = typeof roleHasPermissionsTable.$inferSelect;
export type NewRoleHasPermissionRow =
  typeof roleHasPermissionsTable.$inferInsert;

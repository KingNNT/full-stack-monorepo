import { boolean, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { auditColumns } from './columns.helpers';

export const permissionsTable = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: varchar('description', { length: 255 }),
  isActive: boolean('is_active').notNull().default(true),
  ...auditColumns,
});

export type PermissionRow = typeof permissionsTable.$inferSelect;
export type NewPermissionRow = typeof permissionsTable.$inferInsert;

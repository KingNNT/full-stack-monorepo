import { boolean, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { auditColumns } from './columns.helpers';

export const rolesTable = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  description: varchar('description', { length: 255 }),
  isActive: boolean('is_active').notNull().default(true),
  ...auditColumns,
});

export type RoleRow = typeof rolesTable.$inferSelect;
export type NewRoleRow = typeof rolesTable.$inferInsert;

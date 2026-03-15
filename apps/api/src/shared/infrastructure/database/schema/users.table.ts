import { boolean, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { auditColumns } from './columns.helpers';

export const usersTable = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 30 }).notNull().unique(),
  isActive: boolean('is_active').notNull().default(true),
  ...auditColumns,
});

export type UserRow = typeof usersTable.$inferSelect;
export type NewUserRow = typeof usersTable.$inferInsert;

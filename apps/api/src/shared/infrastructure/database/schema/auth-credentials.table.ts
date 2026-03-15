import {
  boolean,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { auditColumns } from './columns.helpers';

export const authCredentialsTable = pgTable('auth_credentials', {
  userId: uuid('user_id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 30 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true, mode: 'date' }),
  ...auditColumns,
});

export type AuthCredentialRow = typeof authCredentialsTable.$inferSelect;
export type NewAuthCredentialRow = typeof authCredentialsTable.$inferInsert;

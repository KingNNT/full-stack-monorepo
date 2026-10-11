import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { authCredentialsTable } from './auth-credentials.table';
import { auditColumns } from './columns.helpers';

export const passwordResetTokensTable = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authCredentialsTable.userId),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true, mode: 'date' }),
    ...auditColumns,
  },
  (t) => [index('password_reset_tokens_user_id_idx').on(t.userId)],
);

export type PasswordResetTokenRow =
  typeof passwordResetTokensTable.$inferSelect;

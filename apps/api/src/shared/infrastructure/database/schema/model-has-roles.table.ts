import {
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { rolesTable } from './roles.table';

export const modelHasRolesTable = pgTable(
  'model_has_roles',
  {
    modelType: varchar('model_type', { length: 50 }).notNull(),
    // Polymorphic: no FK — integrity enforced at app layer
    modelId: uuid('model_id').notNull(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => rolesTable.id),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'date',
    })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.modelType, t.modelId, t.roleId] })],
);

export type ModelHasRoleRow = typeof modelHasRolesTable.$inferSelect;
export type NewModelHasRoleRow = typeof modelHasRolesTable.$inferInsert;

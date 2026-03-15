import {
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { permissionsTable } from './permissions.table';

export const modelHasPermissionsTable = pgTable(
  'model_has_permissions',
  {
    modelType: varchar('model_type', { length: 50 }).notNull(),
    // Polymorphic: no FK — integrity enforced at app layer
    modelId: uuid('model_id').notNull(),
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
  (t) => [primaryKey({ columns: [t.modelType, t.modelId, t.permissionId] })],
);

export type ModelHasPermissionRow =
  typeof modelHasPermissionsTable.$inferSelect;
export type NewModelHasPermissionRow =
  typeof modelHasPermissionsTable.$inferInsert;

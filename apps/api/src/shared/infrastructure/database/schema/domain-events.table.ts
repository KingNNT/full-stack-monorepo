import {
  bigint,
  index,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const domainEventsTable = pgTable(
  'domain_events',
  {
    id: uuid('id').primaryKey(),
    streamId: varchar('stream_id', { length: 255 }).notNull(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
    version: bigint('version', { mode: 'bigint' }).notNull(),
    occurredAt: timestamp('occurred_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
  },
  (t) => [
    unique('domain_events_stream_id_version_key').on(t.streamId, t.version),
    index('domain_events_stream_id_idx').on(t.streamId),
  ],
);

export type DomainEventRow = typeof domainEventsTable.$inferSelect;
export type NewDomainEventRow = typeof domainEventsTable.$inferInsert;

import { Injectable } from '@nestjs/common';
import { asc, desc, eq } from 'drizzle-orm';
import type { DomainEventBase } from '../../domain/domain-event.base';
import { DrizzleService } from '../database/drizzle.service';
import { domainEventsTable } from '../database/schema/domain-events.table';

export interface StoredEventData {
  eventType: string;
  eventId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface EventSerializer {
  serialize(event: DomainEventBase): StoredEventData;
  deserialize(data: StoredEventData): DomainEventBase | null;
}

export interface AppendResult {
  nextExpectedRevision: bigint;
}

export class ConcurrencyError extends Error {
  constructor(
    streamId: string,
    expectedRevision: bigint | 'no_stream' | 'any',
    actualRevision: bigint | null,
  ) {
    super(
      `Concurrency conflict on stream "${streamId}": expected revision ${String(expectedRevision)}, actual ${actualRevision === null ? 'no_stream' : String(actualRevision)}`,
    );
    this.name = 'ConcurrencyError';
  }
}

@Injectable()
export class EventStoreService {
  constructor(private readonly drizzle: DrizzleService) {}

  async appendToStream(
    streamId: string,
    events: ReadonlyArray<DomainEventBase>,
    expectedRevision: bigint | 'no_stream' | 'any',
    serializer: EventSerializer,
  ): Promise<AppendResult> {
    return this.drizzle.transaction(async (tx) => {
      // Get the current max version for this stream
      const latest = await tx
        .select({ version: domainEventsTable.version })
        .from(domainEventsTable)
        .where(eq(domainEventsTable.streamId, streamId))
        .orderBy(desc(domainEventsTable.version))
        .limit(1);

      const currentRevision = latest[0]?.version ?? null;

      // Validate expected revision
      if (expectedRevision === 'no_stream') {
        if (currentRevision !== null) {
          throw new ConcurrencyError(
            streamId,
            expectedRevision,
            currentRevision,
          );
        }
      } else if (expectedRevision !== 'any') {
        if (currentRevision === null || currentRevision !== expectedRevision) {
          throw new ConcurrencyError(
            streamId,
            expectedRevision,
            currentRevision,
          );
        }
      }

      const startVersion = currentRevision !== null ? currentRevision + 1n : 0n;

      const rows = events.map((event, index) => {
        const stored = serializer.serialize(event);
        return {
          id: stored.eventId,
          streamId,
          eventType: stored.eventType,
          payload: stored.payload,
          version: startVersion + BigInt(index),
          occurredAt: new Date(stored.occurredAt),
        };
      });

      try {
        await tx.insert(domainEventsTable).values(rows);
      } catch (err: unknown) {
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: string }).code === '23505'
        ) {
          throw new ConcurrencyError(
            streamId,
            expectedRevision,
            currentRevision,
          );
        }
        throw err;
      }

      const nextExpectedRevision = startVersion + BigInt(events.length) - 1n;
      return { nextExpectedRevision };
    });
  }

  async readStream(
    streamId: string,
    serializer: EventSerializer,
  ): Promise<DomainEventBase[]> {
    const rows = await this.drizzle.db
      .select()
      .from(domainEventsTable)
      .where(eq(domainEventsTable.streamId, streamId))
      .orderBy(asc(domainEventsTable.version));

    const events: DomainEventBase[] = [];
    for (const row of rows) {
      const domainEvent = serializer.deserialize({
        eventType: row.eventType,
        eventId: row.id,
        occurredAt: row.occurredAt.toISOString(),
        payload: row.payload as Record<string, unknown>,
      });
      // Skip unknown event types (forward compatibility)
      if (domainEvent) {
        events.push(domainEvent);
      }
    }

    return events;
  }
}

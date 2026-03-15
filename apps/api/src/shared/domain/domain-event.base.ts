import { randomUUID } from 'node:crypto';

export abstract class DomainEventBase {
  readonly eventId: string;
  readonly occurredAt: Date;
  abstract readonly eventType: string;

  constructor(options?: { eventId?: string; occurredAt?: Date }) {
    this.eventId = options?.eventId ?? randomUUID();
    this.occurredAt = options?.occurredAt ?? new Date();
  }
}

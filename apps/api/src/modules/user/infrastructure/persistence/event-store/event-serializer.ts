import { Injectable, Logger } from '@nestjs/common';
import type { DomainEventBase } from '../../../../../shared/domain/domain-event.base';
import type {
  EventSerializer as IEventSerializer,
  StoredEventData,
} from '../../../../../shared/infrastructure/event-store/event-store.service';
import { UserCreatedEvent } from '../../../domain/events/user-created.event';
import { UserProfileUpdatedEvent } from '../../../domain/events/user-profile-updated.event';

@Injectable()
export class UserEventSerializer implements IEventSerializer {
  private readonly logger = new Logger(UserEventSerializer.name);

  serialize(event: DomainEventBase): StoredEventData {
    return {
      eventType: event.eventType,
      eventId: event.eventId,
      occurredAt: event.occurredAt.toISOString(),
      payload: this.extractPayload(event),
    };
  }

  deserialize(data: StoredEventData): DomainEventBase | null {
    const options = {
      eventId: data.eventId,
      occurredAt: new Date(data.occurredAt),
    };

    switch (data.eventType) {
      case 'UserCreated':
        return new UserCreatedEvent(
          {
            userId: data.payload.userId as string,
            email: data.payload.email as string,
            username: data.payload.username as string,
            createdAt: new Date(data.payload.createdAt as string),
          },
          options,
        );
      case 'UserProfileUpdated':
        return new UserProfileUpdatedEvent(
          {
            userId: data.payload.userId as string,
            username: data.payload.username as string,
            updatedAt: new Date(data.payload.updatedAt as string),
          },
          options,
        );
      default:
        this.logger.warn(`Unknown event type "${data.eventType}" — skipping`);
        return null;
    }
  }

  private extractPayload(event: DomainEventBase): Record<string, unknown> {
    if ('payload' in event) {
      return { ...(event as any).payload };
    }
    throw new Error(`Unknown event type: ${event.eventType}`);
  }
}

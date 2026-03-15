import { Logger } from '@nestjs/common';
import { EventBus, EventsHandler, type IEventHandler } from '@nestjs/cqrs';
import { UserRegisteredIntegrationEvent } from '../../../../shared/events/integration/user-registered.integration-event';
import { UserCreatedEvent } from '../../domain/events/user-created.event';

@EventsHandler(UserCreatedEvent)
export class UserCreatedDomainHandler
  implements IEventHandler<UserCreatedEvent>
{
  private readonly logger = new Logger(UserCreatedDomainHandler.name);

  constructor(private readonly eventBus: EventBus) {}

  handle(event: UserCreatedEvent): void {
    this.logger.log(
      `User ${event.payload.userId} created (${event.payload.email})`,
    );

    // Publish integration event for cross-context communication
    this.eventBus.publish(
      new UserRegisteredIntegrationEvent(
        event.payload.userId,
        event.payload.email,
        event.payload.username,
      ),
    );
  }
}

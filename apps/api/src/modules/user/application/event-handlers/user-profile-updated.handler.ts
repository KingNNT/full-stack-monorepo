import { Logger } from '@nestjs/common';
import { EventBus, EventsHandler, type IEventHandler } from '@nestjs/cqrs';
import { UserProfileUpdatedIntegrationEvent } from '../../../../shared/events/integration/user-profile-updated.integration-event';
import { UserProfileUpdatedEvent } from '../../domain/events/user-profile-updated.event';

@EventsHandler(UserProfileUpdatedEvent)
export class UserProfileUpdatedDomainHandler
  implements IEventHandler<UserProfileUpdatedEvent>
{
  private readonly logger = new Logger(UserProfileUpdatedDomainHandler.name);

  constructor(private readonly eventBus: EventBus) {}

  handle(event: UserProfileUpdatedEvent): void {
    this.logger.log(`User ${event.payload.userId} profile updated`);

    this.eventBus.publish(
      new UserProfileUpdatedIntegrationEvent(
        event.payload.userId,
        event.payload.username,
      ),
    );
  }
}

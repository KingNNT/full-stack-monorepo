import { DomainEventBase } from '../../../../shared/domain/domain-event.base';

export interface UserProfileUpdatedPayload {
  userId: string;
  username: string;
  updatedAt: Date;
}

export class UserProfileUpdatedEvent extends DomainEventBase {
  readonly eventType = 'UserProfileUpdated';

  constructor(
    public readonly payload: UserProfileUpdatedPayload,
    options?: { eventId?: string; occurredAt?: Date },
  ) {
    super(options);
  }
}

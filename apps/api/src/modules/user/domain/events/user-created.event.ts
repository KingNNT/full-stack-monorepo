import { DomainEventBase } from '../../../../shared/domain/domain-event.base';

export interface UserCreatedPayload {
  userId: string;
  email: string;
  username: string;
  createdAt: Date;
}

export class UserCreatedEvent extends DomainEventBase {
  readonly eventType = 'UserCreated';

  constructor(
    public readonly payload: UserCreatedPayload,
    options?: { eventId?: string; occurredAt?: Date },
  ) {
    super(options);
  }
}

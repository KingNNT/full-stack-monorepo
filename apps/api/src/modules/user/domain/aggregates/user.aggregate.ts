import { AggregateRootBase } from '../../../../shared/domain/aggregate-root.base';
import type { DomainEventBase } from '../../../../shared/domain/domain-event.base';
import { UserCreatedEvent } from '../events/user-created.event';
import { Email } from '../value-objects/email.vo';
import { UserId } from '../value-objects/user-id.vo';
import { Username } from '../value-objects/username.vo';

export class UserAggregate extends AggregateRootBase {
  private _id!: UserId;
  private _email!: Email;
  private _username!: Username;
  private _isActive!: boolean;

  get aggregateId(): string {
    return this._id.value;
  }

  get id(): UserId {
    return this._id;
  }

  get email(): Email {
    return this._email;
  }

  get username(): Username {
    return this._username;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  // Factory: create new user
  static create(params: { email: string; username: string }): UserAggregate {
    const aggregate = new UserAggregate();
    const userId = UserId.create();

    // Validate and normalize inputs before emitting event
    const email = Email.create(params.email);
    const username = Username.create(params.username);

    aggregate.apply(
      new UserCreatedEvent({
        userId: userId.value,
        email: email.value,
        username: username.value,
        createdAt: new Date(),
      }),
    );

    return aggregate;
  }

  // Factory: reconstitute from stored events
  static reconstitute(events: DomainEventBase[]): UserAggregate {
    const aggregate = new UserAggregate();
    for (const event of events) {
      aggregate.applyEvent(event);
      aggregate.version++;
    }
    return aggregate;
  }

  // Event application (state mutation only)
  protected applyEvent(event: DomainEventBase): void {
    if (event instanceof UserCreatedEvent) {
      this.applyUserCreated(event);
    }
  }

  private applyUserCreated(event: UserCreatedEvent): void {
    this._id = UserId.fromString(event.payload.userId);
    this._email = Email.create(event.payload.email);
    this._username = Username.create(event.payload.username);
    this._isActive = true;
  }
}

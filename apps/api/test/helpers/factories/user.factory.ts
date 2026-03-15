import { randomUUID } from 'node:crypto';
import { UserAggregate } from '../../../src/modules/user/domain/aggregates/user.aggregate';
import { UserCreatedEvent } from '../../../src/modules/user/domain/events/user-created.event';

export function createUserAggregate(
  overrides: { email?: string; username?: string } = {},
): UserAggregate {
  return UserAggregate.create({
    email: overrides.email ?? 'test@example.com',
    username: overrides.username ?? 'testuser',
  });
}

export function createUserCreatedEvent(
  overrides: Partial<{
    userId: string;
    email: string;
    username: string;
    createdAt: Date;
  }> = {},
): UserCreatedEvent {
  return new UserCreatedEvent({
    userId: overrides.userId ?? randomUUID(),
    email: overrides.email ?? 'test@example.com',
    username: overrides.username ?? 'testuser',
    createdAt: overrides.createdAt ?? new Date(),
  });
}

import { UserCreatedEvent } from '../events/user-created.event';
import { UserAggregate } from './user.aggregate';

describe('UserAggregate', () => {
  describe('create()', () => {
    it('creates aggregate with correct state', () => {
      const user = UserAggregate.create({
        email: 'test@example.com',
        username: 'testuser',
      });

      expect(user.email.value).toBe('test@example.com');
      expect(user.username.value).toBe('testuser');
      expect(user.isActive).toBe(true);
      expect(user.aggregateId).toBeDefined();
    });

    it('produces a UserCreatedEvent', () => {
      const user = UserAggregate.create({
        email: 'test@example.com',
        username: 'testuser',
      });

      const events = user.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(UserCreatedEvent);

      const event = events[0] as UserCreatedEvent;
      expect(event.eventType).toBe('UserCreated');
      expect(event.payload.email).toBe('test@example.com');
      expect(event.payload.username).toBe('testuser');
      expect(event.payload.userId).toBe(user.aggregateId);
    });

    it('has initial version -1', () => {
      const user = UserAggregate.create({
        email: 'test@example.com',
        username: 'testuser',
      });

      expect(user.version).toBe(-1);
    });

    it('rejects invalid email', () => {
      expect(() =>
        UserAggregate.create({ email: 'invalid', username: 'testuser' }),
      ).toThrow('Invalid email format');
    });

    it('rejects invalid username', () => {
      expect(() =>
        UserAggregate.create({ email: 'test@example.com', username: 'ab' }),
      ).toThrow('Invalid username');
    });
  });

  describe('reconstitute()', () => {
    it('rebuilds aggregate from events', () => {
      const event = new UserCreatedEvent({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        email: 'test@example.com',
        username: 'testuser',
        createdAt: new Date(),
      });

      const user = UserAggregate.reconstitute([event]);

      expect(user.aggregateId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(user.email.value).toBe('test@example.com');
      expect(user.username.value).toBe('testuser');
      expect(user.isActive).toBe(true);
    });

    it('sets version based on event count', () => {
      const event = new UserCreatedEvent({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        email: 'test@example.com',
        username: 'testuser',
        createdAt: new Date(),
      });

      const user = UserAggregate.reconstitute([event]);

      // version increments per event: starts at -1, +1 = 0
      expect(user.version).toBe(0);
    });

    it('has no uncommitted events', () => {
      const event = new UserCreatedEvent({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        email: 'test@example.com',
        username: 'testuser',
        createdAt: new Date(),
      });

      const user = UserAggregate.reconstitute([event]);

      expect(user.getUncommittedEvents()).toHaveLength(0);
    });
  });
});

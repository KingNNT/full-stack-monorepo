import { UserCreatedEvent } from '../../../domain/events/user-created.event';
import { UserEventSerializer } from './event-serializer';

describe('UserEventSerializer', () => {
  let serializer: UserEventSerializer;

  beforeEach(() => {
    serializer = new UserEventSerializer();
  });

  describe('serialize()', () => {
    it('serializes UserCreatedEvent', () => {
      const createdAt = new Date('2024-01-01T00:00:00Z');
      const event = new UserCreatedEvent(
        {
          userId: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
          createdAt,
        },
        {
          eventId: 'event-123',
          occurredAt: createdAt,
        },
      );

      const stored = serializer.serialize(event);

      expect(stored.eventType).toBe('UserCreated');
      expect(stored.eventId).toBe('event-123');
      expect(stored.occurredAt).toBe(createdAt.toISOString());
      expect(stored.payload).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        createdAt,
      });
    });
  });

  describe('deserialize()', () => {
    it('deserializes UserCreated event type', () => {
      const stored = {
        eventType: 'UserCreated',
        eventId: 'event-123',
        occurredAt: '2024-01-01T00:00:00.000Z',
        payload: {
          userId: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      };

      const event = serializer.deserialize(stored);

      expect(event).toBeInstanceOf(UserCreatedEvent);
      const userCreated = event as UserCreatedEvent;
      expect(userCreated.eventType).toBe('UserCreated');
      expect(userCreated.eventId).toBe('event-123');
      expect(userCreated.occurredAt).toEqual(
        new Date('2024-01-01T00:00:00.000Z'),
      );
      expect(userCreated.payload.userId).toBe('user-123');
      expect(userCreated.payload.email).toBe('test@example.com');
      expect(userCreated.payload.username).toBe('testuser');
    });

    it('returns null for unknown event type (forward compatibility)', () => {
      const stored = {
        eventType: 'UnknownEvent',
        eventId: 'event-456',
        occurredAt: '2024-01-01T00:00:00.000Z',
        payload: { some: 'data' },
      };

      const event = serializer.deserialize(stored);

      expect(event).toBeNull();
    });
  });

  describe('round-trip', () => {
    it('serialize then deserialize preserves event data', () => {
      const createdAt = new Date('2024-06-15T10:30:00Z');
      const original = new UserCreatedEvent(
        {
          userId: 'user-789',
          email: 'roundtrip@example.com',
          username: 'roundtrip',
          createdAt,
        },
        {
          eventId: 'evt-round',
          occurredAt: createdAt,
        },
      );

      const stored = serializer.serialize(original);
      const deserialized = serializer.deserialize(stored) as UserCreatedEvent;

      expect(deserialized).toBeInstanceOf(UserCreatedEvent);
      expect(deserialized.eventId).toBe(original.eventId);
      expect(deserialized.eventType).toBe(original.eventType);
      expect(deserialized.payload.userId).toBe(original.payload.userId);
      expect(deserialized.payload.email).toBe(original.payload.email);
      expect(deserialized.payload.username).toBe(original.payload.username);
    });
  });
});

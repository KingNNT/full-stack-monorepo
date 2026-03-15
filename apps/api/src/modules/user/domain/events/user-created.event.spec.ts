import { UserCreatedEvent } from './user-created.event';

describe('UserCreatedEvent', () => {
  const payload = {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    username: 'testuser',
    createdAt: new Date('2024-01-01T00:00:00Z'),
  };

  it('has eventType "UserCreated"', () => {
    const event = new UserCreatedEvent(payload);

    expect(event.eventType).toBe('UserCreated');
  });

  it('stores payload', () => {
    const event = new UserCreatedEvent(payload);

    expect(event.payload).toEqual(payload);
  });

  it('auto-generates eventId and occurredAt', () => {
    const event = new UserCreatedEvent(payload);

    expect(event.eventId).toBeDefined();
    expect(event.occurredAt).toBeInstanceOf(Date);
  });

  it('accepts custom eventId and occurredAt', () => {
    const customId = '661e8400-e29b-41d4-a716-446655440000';
    const customDate = new Date('2025-06-01T12:00:00Z');

    const event = new UserCreatedEvent(payload, {
      eventId: customId,
      occurredAt: customDate,
    });

    expect(event.eventId).toBe(customId);
    expect(event.occurredAt).toBe(customDate);
  });
});

import { DomainEventBase } from './domain-event.base';

class TestEvent extends DomainEventBase {
  readonly eventType = 'TestEvent';
}

describe('DomainEventBase', () => {
  it('auto-generates eventId as UUID', () => {
    const event = new TestEvent();

    expect(event.eventId).toBeDefined();
    expect(event.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('auto-generates occurredAt as current date', () => {
    const before = new Date();
    const event = new TestEvent();
    const after = new Date();

    expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('accepts custom eventId and occurredAt overrides', () => {
    const customId = '550e8400-e29b-41d4-a716-446655440000';
    const customDate = new Date('2024-01-01T00:00:00Z');

    const event = new TestEvent({ eventId: customId, occurredAt: customDate });

    expect(event.eventId).toBe(customId);
    expect(event.occurredAt).toBe(customDate);
  });

  it('uses provided eventId but auto-generates occurredAt', () => {
    const customId = '550e8400-e29b-41d4-a716-446655440000';
    const event = new TestEvent({ eventId: customId });

    expect(event.eventId).toBe(customId);
    expect(event.occurredAt).toBeInstanceOf(Date);
  });

  it('generates unique eventIds for different instances', () => {
    const event1 = new TestEvent();
    const event2 = new TestEvent();

    expect(event1.eventId).not.toBe(event2.eventId);
  });
});

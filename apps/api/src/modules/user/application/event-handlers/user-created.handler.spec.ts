import { createMockEventBus } from '../../../../../test/helpers/mocks/event-bus.mock';
import { UserRegisteredIntegrationEvent } from '../../../../shared/events/integration/user-registered.integration-event';
import { UserCreatedEvent } from '../../domain/events/user-created.event';
import { UserCreatedDomainHandler } from './user-created.handler';

describe('UserCreatedDomainHandler', () => {
  let handler: UserCreatedDomainHandler;
  let mockEventBus: jest.Mocked<
    Pick<import('@nestjs/cqrs').EventBus, 'publish'>
  >;

  beforeEach(() => {
    mockEventBus = createMockEventBus();
    handler = new UserCreatedDomainHandler(mockEventBus as any);
  });

  it('publishes UserRegisteredIntegrationEvent', () => {
    const event = new UserCreatedEvent({
      userId: 'user-123',
      email: 'test@example.com',
      username: 'testuser',
      createdAt: new Date(),
    });

    handler.handle(event);

    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    const published = mockEventBus.publish.mock.calls[0][0];
    expect(published).toBeInstanceOf(UserRegisteredIntegrationEvent);
  });

  it('publishes integration event with correct data', () => {
    const event = new UserCreatedEvent({
      userId: 'user-456',
      email: 'alice@example.com',
      username: 'alice',
      createdAt: new Date(),
    });

    handler.handle(event);

    const published = mockEventBus.publish.mock
      .calls[0][0] as UserRegisteredIntegrationEvent;
    expect(published.userId).toBe('user-456');
    expect(published.email).toBe('alice@example.com');
    expect(published.username).toBe('alice');
  });
});

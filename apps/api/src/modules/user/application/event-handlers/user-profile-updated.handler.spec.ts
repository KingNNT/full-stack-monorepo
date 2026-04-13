import { createMockEventBus } from '../../../../../test/helpers/mocks/event-bus.mock';
import { UserProfileUpdatedIntegrationEvent } from '../../../../shared/events/integration/user-profile-updated.integration-event';
import { UserProfileUpdatedEvent } from '../../domain/events/user-profile-updated.event';
import { UserProfileUpdatedDomainHandler } from './user-profile-updated.handler';

describe('UserProfileUpdatedDomainHandler', () => {
  it('publishes UserProfileUpdatedIntegrationEvent', () => {
    const mockEventBus = createMockEventBus();
    const handler = new UserProfileUpdatedDomainHandler(mockEventBus as any);

    handler.handle(
      new UserProfileUpdatedEvent({
        userId: 'user-1',
        username: 'newname',
        updatedAt: new Date(),
      }),
    );

    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    const published = mockEventBus.publish.mock
      .calls[0][0] as UserProfileUpdatedIntegrationEvent;
    expect(published).toBeInstanceOf(UserProfileUpdatedIntegrationEvent);
    expect(published.userId).toBe('user-1');
    expect(published.username).toBe('newname');
  });
});

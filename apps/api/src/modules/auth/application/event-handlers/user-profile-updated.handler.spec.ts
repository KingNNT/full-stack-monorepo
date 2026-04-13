import { createMockAuthCredentialsRepository } from '../../../../../test/helpers/mocks/auth-credentials.mock';
import { UserProfileUpdatedIntegrationEvent } from '../../../../shared/events/integration/user-profile-updated.integration-event';
import { AuthUserProfileUpdatedHandler } from './user-profile-updated.handler';

describe('AuthUserProfileUpdatedHandler', () => {
  it('updates auth_credentials username', async () => {
    const mockCredentials = createMockAuthCredentialsRepository();
    const handler = new AuthUserProfileUpdatedHandler(mockCredentials);

    await handler.handle(
      new UserProfileUpdatedIntegrationEvent('user-1', 'newname'),
    );

    expect(mockCredentials.updateUsername).toHaveBeenCalledWith(
      'user-1',
      'newname',
    );
  });
});

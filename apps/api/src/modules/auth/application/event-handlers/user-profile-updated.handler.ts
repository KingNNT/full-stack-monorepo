import { Inject, Logger } from '@nestjs/common';
import { EventsHandler, type IEventHandler } from '@nestjs/cqrs';
import { UserProfileUpdatedIntegrationEvent } from '../../../../shared/events/integration/user-profile-updated.integration-event';
import {
  AUTH_CREDENTIALS_REPOSITORY_TOKEN,
  type IAuthCredentialsRepository,
} from '../ports/auth-credentials.repository.interface';

@EventsHandler(UserProfileUpdatedIntegrationEvent)
export class AuthUserProfileUpdatedHandler
  implements IEventHandler<UserProfileUpdatedIntegrationEvent>
{
  private readonly logger = new Logger(AuthUserProfileUpdatedHandler.name);

  constructor(
    @Inject(AUTH_CREDENTIALS_REPOSITORY_TOKEN)
    private readonly credentialsRepo: IAuthCredentialsRepository,
  ) {}

  async handle(event: UserProfileUpdatedIntegrationEvent): Promise<void> {
    await this.credentialsRepo.updateUsername(event.userId, event.username);
    this.logger.debug(
      `Synced username for user ${event.userId} to auth credentials`,
    );
  }
}

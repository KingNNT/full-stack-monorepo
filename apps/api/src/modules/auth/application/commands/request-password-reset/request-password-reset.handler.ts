import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, EventBus, type ICommandHandler } from '@nestjs/cqrs';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import { PasswordResetRequestedEvent } from '../../../domain/events/password-reset-requested.event';
import {
  AUTH_CREDENTIALS_REPOSITORY_TOKEN,
  type IAuthCredentialsRepository,
} from '../../ports/auth-credentials.repository.interface';
import {
  type IPasswordResetTokenRepository,
  PASSWORD_RESET_TOKEN_REPOSITORY_TOKEN,
} from '../../ports/password-reset-token.repository.interface';
import {
  type IResetTokenGenerator,
  RESET_TOKEN_GENERATOR_TOKEN,
} from '../../ports/reset-token-generator.interface';
import { RequestPasswordResetCommand } from './request-password-reset.command';

export const RESET_COOLDOWN_MS = 60_000;
export const RESET_HOURLY_LIMIT = 5;
const HOUR_MS = 60 * 60_000;

// Every outcome returns normally so the endpoint never reveals which emails exist
@CommandHandler(RequestPasswordResetCommand)
export class RequestPasswordResetHandler
  implements ICommandHandler<RequestPasswordResetCommand, void>
{
  constructor(
    @InjectPinoLogger(RequestPasswordResetHandler.name)
    private readonly logger: PinoLogger,
    @Inject(AUTH_CREDENTIALS_REPOSITORY_TOKEN)
    private readonly credentialsRepo: IAuthCredentialsRepository,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY_TOKEN)
    private readonly resetTokens: IPasswordResetTokenRepository,
    @Inject(RESET_TOKEN_GENERATOR_TOKEN)
    private readonly tokenGenerator: IResetTokenGenerator,
    private readonly eventBus: EventBus,
    private readonly config: ConfigService,
  ) {}

  async execute(command: RequestPasswordResetCommand): Promise<void> {
    const email = command.email.trim().toLowerCase();
    const credential = await this.credentialsRepo.findByEmailOrUsername(email);

    if (!credential || credential.email !== email) {
      this.logger.info({ reason: 'not_found' }, 'Password reset skipped');
      return;
    }
    if (!credential.isActive) {
      this.logger.info(
        { userId: credential.userId, reason: 'inactive' },
        'Password reset skipped',
      );
      return;
    }

    const now = Date.now();
    const stats = await this.resetTokens.statsForUser(
      credential.userId,
      new Date(now - HOUR_MS),
    );
    const inCooldown =
      stats.latestCreatedAt !== null &&
      now - stats.latestCreatedAt.getTime() < RESET_COOLDOWN_MS;
    if (inCooldown || stats.issuedSince >= RESET_HOURLY_LIMIT) {
      this.logger.warn(
        {
          userId: credential.userId,
          reason: inCooldown ? 'cooldown' : 'hourly_limit',
        },
        'Password reset skipped',
      );
      return;
    }

    const ttlMinutes = Number(
      this.config.get('PASSWORD_RESET_TTL_MINUTES', '30'),
    );
    const { raw, hash } = this.tokenGenerator.generate();
    await this.resetTokens.issue(
      credential.userId,
      hash,
      new Date(now + ttlMinutes * 60_000),
    );

    this.eventBus.publish(
      new PasswordResetRequestedEvent(
        credential.userId,
        credential.email,
        raw,
        command.locale,
      ),
    );
    this.logger.info({ userId: credential.userId }, 'Password reset issued');
  }
}

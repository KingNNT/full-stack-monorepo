import { Inject } from '@nestjs/common';
import { CommandHandler, EventBus, type ICommandHandler } from '@nestjs/cqrs';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import { InvalidResetTokenError } from '../../../domain/errors/invalid-reset-token.error';
import { WeakPasswordError } from '../../../domain/errors/weak-password.error';
import { PasswordChangedEvent } from '../../../domain/events/password-changed.event';
import {
  type IPasswordHasher,
  PASSWORD_HASHER_TOKEN,
} from '../../ports/password-hasher.interface';
import {
  type IPasswordResetTokenRepository,
  PASSWORD_RESET_TOKEN_REPOSITORY_TOKEN,
} from '../../ports/password-reset-token.repository.interface';
import {
  type IResetTokenGenerator,
  RESET_TOKEN_GENERATOR_TOKEN,
} from '../../ports/reset-token-generator.interface';
import { ResetPasswordCommand } from './reset-password.command';

@CommandHandler(ResetPasswordCommand)
export class ResetPasswordHandler
  implements ICommandHandler<ResetPasswordCommand, void>
{
  constructor(
    @InjectPinoLogger(ResetPasswordHandler.name)
    private readonly logger: PinoLogger,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY_TOKEN)
    private readonly resetTokens: IPasswordResetTokenRepository,
    @Inject(RESET_TOKEN_GENERATOR_TOKEN)
    private readonly tokenGenerator: IResetTokenGenerator,
    @Inject(PASSWORD_HASHER_TOKEN)
    private readonly passwordHasher: IPasswordHasher,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    const length = command.newPassword?.length ?? 0;
    if (length < 8 || length > 128) {
      throw new WeakPasswordError('Password must be 8-128 characters');
    }

    // Hash outside the transaction: bcrypt is slow and must not hold row locks
    const newHash = await this.passwordHasher.hash(command.newPassword);
    const redeemed = await this.resetTokens.redeem(
      this.tokenGenerator.hash(command.token),
      newHash,
    );
    if (!redeemed) {
      this.logger.warn({ reason: 'invalid_token' }, 'Password reset failed');
      throw new InvalidResetTokenError();
    }

    this.eventBus.publish(
      new PasswordChangedEvent(
        redeemed.userId,
        redeemed.email,
        command.locale,
        'reset',
      ),
    );
    this.logger.info({ userId: redeemed.userId }, 'Password reset completed');
  }
}

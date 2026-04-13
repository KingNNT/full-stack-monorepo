import {
  Inject,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import { WeakPasswordError } from '../../../domain/errors/weak-password.error';
import {
  AUTH_CREDENTIALS_REPOSITORY_TOKEN,
  type IAuthCredentialsRepository,
} from '../../ports/auth-credentials.repository.interface';
import {
  type IPasswordHasher,
  PASSWORD_HASHER_TOKEN,
} from '../../ports/password-hasher.interface';
import { ChangePasswordCommand } from './change-password.command';

@CommandHandler(ChangePasswordCommand)
export class ChangePasswordHandler
  implements ICommandHandler<ChangePasswordCommand, void>
{
  constructor(
    @InjectPinoLogger(ChangePasswordHandler.name)
    private readonly logger: PinoLogger,
    @Inject(AUTH_CREDENTIALS_REPOSITORY_TOKEN)
    private readonly credentialsRepo: IAuthCredentialsRepository,
    @Inject(PASSWORD_HASHER_TOKEN)
    private readonly passwordHasher: IPasswordHasher,
  ) {}

  async execute(command: ChangePasswordCommand): Promise<void> {
    this.logger.info({ userId: command.userId }, 'Change password attempt');

    if (!command.newPassword || command.newPassword.length < 8) {
      throw new WeakPasswordError('Password must be at least 8 characters');
    }

    if (command.newPassword === command.oldPassword) {
      throw new WeakPasswordError(
        'New password must be different from current password',
      );
    }

    const credential = await this.credentialsRepo.findByUserId(command.userId);
    if (!credential) {
      throw new NotFoundException('User not found');
    }

    const isValid = await this.passwordHasher.verify(
      command.oldPassword,
      credential.passwordHash,
    );
    if (!isValid) {
      this.logger.warn(
        { userId: command.userId, reason: 'bad_old_password' },
        'Change password failed',
      );
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newHash = await this.passwordHasher.hash(command.newPassword);
    await this.credentialsRepo.updatePasswordHash(command.userId, newHash);

    this.logger.info({ userId: command.userId }, 'Password changed');
  }
}

import { ConflictException, Inject } from '@nestjs/common';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import { CreateUserCommand } from '../../../../user/application/commands/create-user/create-user.command';
import type { CreateUserResult } from '../../../../user/application/commands/create-user/create-user.result';
import { WeakPasswordError } from '../../../domain/errors/weak-password.error';
import {
  AUTH_CREDENTIALS_REPOSITORY_TOKEN,
  type IAuthCredentialsRepository,
} from '../../ports/auth-credentials.repository.interface';
import {
  type IPasswordHasher,
  PASSWORD_HASHER_TOKEN,
} from '../../ports/password-hasher.interface';
import { RegisterCommand } from './register.command';
import type { RegisterResult } from './register.result';

@CommandHandler(RegisterCommand)
export class RegisterHandler
  implements ICommandHandler<RegisterCommand, RegisterResult>
{
  constructor(
    @InjectPinoLogger(RegisterHandler.name)
    private readonly logger: PinoLogger,
    @Inject(PASSWORD_HASHER_TOKEN)
    private readonly passwordHasher: IPasswordHasher,
    @Inject(AUTH_CREDENTIALS_REPOSITORY_TOKEN)
    private readonly credentialsRepo: IAuthCredentialsRepository,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: RegisterCommand): Promise<RegisterResult> {
    this.logger.info(
      { email: command.email, username: command.username },
      'Registration attempt',
    );

    if (!command.password || command.password.length < 8) {
      this.logger.warn(
        { email: command.email },
        'Registration failed: password validation',
      );
      throw new WeakPasswordError('Password must be at least 8 characters');
    }

    // Pre-check: reject duplicates BEFORE writing to event store
    const existingByEmail = await this.credentialsRepo.findByEmailOrUsername(
      command.email,
    );
    if (existingByEmail) {
      this.logger.warn(
        { email: command.email },
        'Registration failed: duplicate email or username',
      );
      throw new ConflictException({
        message: 'Email or username already in use',
        errorCode: 'EMAIL_OR_USERNAME_EXISTS',
      });
    }
    const existingByUsername = await this.credentialsRepo.findByEmailOrUsername(
      command.username,
    );
    if (existingByUsername) {
      this.logger.warn(
        { username: command.username },
        'Registration failed: duplicate email or username',
      );
      throw new ConflictException({
        message: 'Email or username already in use',
        errorCode: 'EMAIL_OR_USERNAME_EXISTS',
      });
    }

    // Hash password (Auth's concern)
    const passwordHash = await this.passwordHasher.hash(command.password);

    // Dispatch to User context via CommandBus
    const result = await this.commandBus.execute<
      CreateUserCommand,
      CreateUserResult
    >(new CreateUserCommand(command.email, command.username));

    // Store credentials in Auth's own table
    await this.credentialsRepo.create(
      result.userId,
      command.email,
      command.username,
      passwordHash,
    );

    this.logger.info({ userId: result.userId }, 'Registration successful');

    return { userId: result.userId };
  }
}

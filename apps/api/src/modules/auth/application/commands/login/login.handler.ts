import { Inject, UnauthorizedException } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import {
  AUTH_CREDENTIALS_REPOSITORY_TOKEN,
  type IAuthCredentialsRepository,
} from '../../ports/auth-credentials.repository.interface';
import {
  type IPasswordHasher,
  PASSWORD_HASHER_TOKEN,
} from '../../ports/password-hasher.interface';
import {
  type ITokenService,
  TOKEN_SERVICE_TOKEN,
  type TokenPair,
} from '../../ports/token.service.interface';
import { LoginCommand } from './login.command';

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand, TokenPair> {
  constructor(
    @InjectPinoLogger(LoginHandler.name)
    private readonly logger: PinoLogger,
    @Inject(TOKEN_SERVICE_TOKEN)
    private readonly tokenService: ITokenService,
    @Inject(AUTH_CREDENTIALS_REPOSITORY_TOKEN)
    private readonly credentialsRepo: IAuthCredentialsRepository,
    @Inject(PASSWORD_HASHER_TOKEN)
    private readonly passwordHasher: IPasswordHasher,
  ) {}

  async execute(command: LoginCommand): Promise<TokenPair> {
    this.logger.info({ identifier: command.identifier }, 'Login attempt');

    // 1. Lookup credentials from Auth's own table
    const credential = await this.credentialsRepo.findByEmailOrUsername(
      command.identifier,
    );
    if (!credential) {
      this.logger.warn(
        { identifier: command.identifier, reason: 'not_found' },
        'Login failed',
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2. Check account status
    if (!credential.isActive) {
      this.logger.warn(
        { userId: credential.userId, reason: 'inactive' },
        'Login failed',
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    // 3. Verify password
    const isValid = await this.passwordHasher.verify(
      command.password,
      credential.passwordHash,
    );
    if (!isValid) {
      this.logger.warn(
        { userId: credential.userId, reason: 'bad_password' },
        'Login failed',
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    // 4. Update last login timestamp
    await this.credentialsRepo.updateLastLogin(credential.userId, new Date());

    // 5. Generate JWT tokens
    const tokens = await this.tokenService.generateTokenPair(credential.userId);

    this.logger.info({ userId: credential.userId }, 'Login successful');

    return tokens;
  }
}

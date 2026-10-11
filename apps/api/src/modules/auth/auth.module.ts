import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
// Application handlers
import { ChangePasswordHandler } from './application/commands/change-password/change-password.handler';
import { LoginHandler } from './application/commands/login/login.handler';
import { RefreshTokenHandler } from './application/commands/refresh-token/refresh-token.handler';
import { RegisterHandler } from './application/commands/register/register.handler';
import { RequestPasswordResetHandler } from './application/commands/request-password-reset/request-password-reset.handler';
import { ResetPasswordHandler } from './application/commands/reset-password/reset-password.handler';
import { SendPasswordChangedEmailHandler } from './application/event-handlers/send-password-changed-email.handler';
import { SendPasswordResetEmailHandler } from './application/event-handlers/send-password-reset-email.handler';
import { AuthUserProfileUpdatedHandler } from './application/event-handlers/user-profile-updated.handler';
import { AUTH_CREDENTIALS_REPOSITORY_TOKEN } from './application/ports/auth-credentials.repository.interface';
import { PASSWORD_HASHER_TOKEN } from './application/ports/password-hasher.interface';
import { PASSWORD_RESET_TOKEN_REPOSITORY_TOKEN } from './application/ports/password-reset-token.repository.interface';
import { RESET_TOKEN_GENERATOR_TOKEN } from './application/ports/reset-token-generator.interface';
// Application port tokens
import { TOKEN_SERVICE_TOKEN } from './application/ports/token.service.interface';
import { BcryptPasswordHasher } from './infrastructure/auth/bcrypt-password-hasher';
import { CryptoResetTokenGenerator } from './infrastructure/auth/crypto-reset-token-generator';
import { JwtStrategy } from './infrastructure/auth/jwt.strategy';
import { JwtRefreshStrategy } from './infrastructure/auth/jwt-refresh.strategy';
// Infrastructure
import { TokenServiceImpl } from './infrastructure/auth/token.service.impl';
import { TokenVersionValidator } from './infrastructure/auth/token-version.validator';
import { AuthCredentialsRepository } from './infrastructure/persistence/auth-credentials.repository';
import { PasswordResetTokenRepository } from './infrastructure/persistence/password-reset-token.repository';

// Presentation
import { AuthController } from './presentation/controllers/auth.controller';

const CommandHandlers = [
  LoginHandler,
  RegisterHandler,
  ChangePasswordHandler,
  RefreshTokenHandler,
  RequestPasswordResetHandler,
  ResetPasswordHandler,
];
const EventHandlers = [
  AuthUserProfileUpdatedHandler,
  SendPasswordResetEmailHandler,
  SendPasswordChangedEmailHandler,
];

@Module({
  imports: [CqrsModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  exports: [PassportModule, AUTH_CREDENTIALS_REPOSITORY_TOKEN],
  providers: [
    // Infrastructure services
    TokenServiceImpl,
    BcryptPasswordHasher,
    JwtStrategy,
    JwtRefreshStrategy,
    TokenVersionValidator,
    AuthCredentialsRepository,
    CryptoResetTokenGenerator,
    PasswordResetTokenRepository,

    // Port -> Adapter bindings
    {
      provide: TOKEN_SERVICE_TOKEN,
      useExisting: TokenServiceImpl,
    },
    {
      provide: PASSWORD_HASHER_TOKEN,
      useExisting: BcryptPasswordHasher,
    },
    {
      provide: AUTH_CREDENTIALS_REPOSITORY_TOKEN,
      useExisting: AuthCredentialsRepository,
    },
    {
      provide: RESET_TOKEN_GENERATOR_TOKEN,
      useExisting: CryptoResetTokenGenerator,
    },
    {
      provide: PASSWORD_RESET_TOKEN_REPOSITORY_TOKEN,
      useExisting: PasswordResetTokenRepository,
    },

    // CQRS handlers
    ...CommandHandlers,
    ...EventHandlers,
  ],
})
export class AuthModule {}

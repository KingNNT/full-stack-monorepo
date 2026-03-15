import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
// Application handlers
import { LoginHandler } from './application/commands/login/login.handler';
import { RegisterHandler } from './application/commands/register/register.handler';
import { AUTH_CREDENTIALS_REPOSITORY_TOKEN } from './application/ports/auth-credentials.repository.interface';
import { PASSWORD_HASHER_TOKEN } from './application/ports/password-hasher.interface';
// Application port tokens
import { TOKEN_SERVICE_TOKEN } from './application/ports/token.service.interface';
import { BcryptPasswordHasher } from './infrastructure/auth/bcrypt-password-hasher';
import { JwtStrategy } from './infrastructure/auth/jwt.strategy';
import { JwtRefreshStrategy } from './infrastructure/auth/jwt-refresh.strategy';
// Infrastructure
import { TokenServiceImpl } from './infrastructure/auth/token.service.impl';
import { AuthCredentialsRepository } from './infrastructure/persistence/auth-credentials.repository';

// Presentation
import { AuthController } from './presentation/controllers/auth.controller';

const CommandHandlers = [LoginHandler, RegisterHandler];

@Module({
  imports: [CqrsModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    // Infrastructure services
    TokenServiceImpl,
    BcryptPasswordHasher,
    JwtStrategy,
    JwtRefreshStrategy,
    AuthCredentialsRepository,

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

    // CQRS handlers
    ...CommandHandlers,
  ],
})
export class AuthModule {}

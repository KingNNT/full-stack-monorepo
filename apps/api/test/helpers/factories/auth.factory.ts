import { randomUUID } from 'node:crypto';
import { LoginCommand } from '../../../src/modules/auth/application/commands/login/login.command';
import { RegisterCommand } from '../../../src/modules/auth/application/commands/register/register.command';
import type { AuthCredentialRecord } from '../../../src/modules/auth/application/ports/auth-credentials.repository.interface';
import type { TokenPair } from '../../../src/modules/auth/application/ports/token.service.interface';

export function createAuthCredentialRecord(
  overrides: Partial<AuthCredentialRecord> = {},
): AuthCredentialRecord {
  return {
    userId: overrides.userId ?? randomUUID(),
    email: overrides.email ?? 'test@example.com',
    username: overrides.username ?? 'testuser',
    passwordHash: overrides.passwordHash ?? '$2b$12$hashedpassword',
    isActive: overrides.isActive ?? true,
  };
}

export function createRegisterCommand(
  overrides: Partial<{
    email: string;
    username: string;
    password: string;
  }> = {},
): RegisterCommand {
  return new RegisterCommand(
    overrides.email ?? 'test@example.com',
    overrides.username ?? 'testuser',
    overrides.password ?? 'securePassword123',
  );
}

export function createLoginCommand(
  overrides: Partial<{
    identifier: string;
    password: string;
  }> = {},
): LoginCommand {
  return new LoginCommand(
    overrides.identifier ?? 'test@example.com',
    overrides.password ?? 'securePassword123',
  );
}

export function createTokenPair(overrides: Partial<TokenPair> = {}): TokenPair {
  return {
    accessToken: overrides.accessToken ?? 'mock-access-token',
    refreshToken: overrides.refreshToken ?? 'mock-refresh-token',
  };
}

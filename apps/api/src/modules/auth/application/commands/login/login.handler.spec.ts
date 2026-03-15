import { UnauthorizedException } from '@nestjs/common';
import { createAuthCredentialRecord } from '../../../../../../test/helpers/factories/auth.factory';
import { createMockAuthCredentialsRepository } from '../../../../../../test/helpers/mocks/auth-credentials.mock';
import { createMockPinoLogger } from '../../../../../../test/helpers/mocks/logger.mock';
import { createMockPasswordHasher } from '../../../../../../test/helpers/mocks/password-hasher.mock';
import { createMockTokenService } from '../../../../../../test/helpers/mocks/token-service.mock';
import type { IAuthCredentialsRepository } from '../../ports/auth-credentials.repository.interface';
import type { IPasswordHasher } from '../../ports/password-hasher.interface';
import type { ITokenService } from '../../ports/token.service.interface';
import { LoginCommand } from './login.command';
import { LoginHandler } from './login.handler';

describe('LoginHandler', () => {
  let handler: LoginHandler;
  let mockTokenService: jest.Mocked<ITokenService>;
  let mockCredentials: jest.Mocked<IAuthCredentialsRepository>;
  let mockHasher: jest.Mocked<IPasswordHasher>;

  beforeEach(() => {
    const mockLogger = createMockPinoLogger();
    mockTokenService = createMockTokenService();
    mockCredentials = createMockAuthCredentialsRepository();
    mockHasher = createMockPasswordHasher();

    handler = new LoginHandler(
      mockLogger as any,
      mockTokenService,
      mockCredentials,
      mockHasher,
    );
  });

  describe('success flow', () => {
    it('returns token pair on valid login', async () => {
      const credential = createAuthCredentialRecord();
      mockCredentials.findByEmailOrUsername.mockResolvedValue(credential);
      mockHasher.verify.mockResolvedValue(true);

      const command = new LoginCommand('test@example.com', 'securePassword123');
      const result = await handler.execute(command);

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
    });

    it('looks up credentials by identifier', async () => {
      const credential = createAuthCredentialRecord();
      mockCredentials.findByEmailOrUsername.mockResolvedValue(credential);

      const command = new LoginCommand('testuser', 'securePassword123');
      await handler.execute(command);

      expect(mockCredentials.findByEmailOrUsername).toHaveBeenCalledWith(
        'testuser',
      );
    });

    it('verifies password against stored hash', async () => {
      const credential = createAuthCredentialRecord({
        passwordHash: '$2b$12$stored',
      });
      mockCredentials.findByEmailOrUsername.mockResolvedValue(credential);

      const command = new LoginCommand('test@example.com', 'myPassword');
      await handler.execute(command);

      expect(mockHasher.verify).toHaveBeenCalledWith(
        'myPassword',
        '$2b$12$stored',
      );
    });

    it('updates lastLogin timestamp', async () => {
      const credential = createAuthCredentialRecord({ userId: 'user-123' });
      mockCredentials.findByEmailOrUsername.mockResolvedValue(credential);

      const command = new LoginCommand('test@example.com', 'securePassword123');
      await handler.execute(command);

      expect(mockCredentials.updateLastLogin).toHaveBeenCalledWith(
        'user-123',
        expect.any(Date),
      );
    });

    it('generates tokens with correct userId', async () => {
      const credential = createAuthCredentialRecord({ userId: 'user-789' });
      mockCredentials.findByEmailOrUsername.mockResolvedValue(credential);

      const command = new LoginCommand('test@example.com', 'securePassword123');
      await handler.execute(command);

      expect(mockTokenService.generateTokenPair).toHaveBeenCalledWith(
        'user-789',
      );
    });
  });

  describe('failure cases (all return identical 401)', () => {
    it('throws 401 when credentials not found', async () => {
      mockCredentials.findByEmailOrUsername.mockResolvedValue(null);

      const command = new LoginCommand('unknown@example.com', 'password');

      await expect(handler.execute(command)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(handler.execute(command)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('throws 401 when account is inactive', async () => {
      const credential = createAuthCredentialRecord({ isActive: false });
      mockCredentials.findByEmailOrUsername.mockResolvedValue(credential);

      const command = new LoginCommand('test@example.com', 'securePassword123');

      await expect(handler.execute(command)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(handler.execute(command)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('throws 401 when password is wrong', async () => {
      const credential = createAuthCredentialRecord();
      mockCredentials.findByEmailOrUsername.mockResolvedValue(credential);
      mockHasher.verify.mockResolvedValue(false);

      const command = new LoginCommand('test@example.com', 'wrongPassword');

      await expect(handler.execute(command)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(handler.execute(command)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('does not update lastLogin on failure', async () => {
      mockCredentials.findByEmailOrUsername.mockResolvedValue(null);

      const command = new LoginCommand('unknown@example.com', 'password');

      await expect(handler.execute(command)).rejects.toThrow();
      expect(mockCredentials.updateLastLogin).not.toHaveBeenCalled();
    });

    it('does not generate tokens on failure', async () => {
      mockCredentials.findByEmailOrUsername.mockResolvedValue(null);

      const command = new LoginCommand('unknown@example.com', 'password');

      await expect(handler.execute(command)).rejects.toThrow();
      expect(mockTokenService.generateTokenPair).not.toHaveBeenCalled();
    });
  });
});

import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createAuthCredentialRecord } from '../../../../../../test/helpers/factories/auth.factory';
import { createMockAuthCredentialsRepository } from '../../../../../../test/helpers/mocks/auth-credentials.mock';
import { createMockEventBus } from '../../../../../../test/helpers/mocks/event-bus.mock';
import { createMockPinoLogger } from '../../../../../../test/helpers/mocks/logger.mock';
import { createMockPasswordHasher } from '../../../../../../test/helpers/mocks/password-hasher.mock';
import { createMockPasswordResetTokenRepository } from '../../../../../../test/helpers/mocks/password-reset-token.mock';
import { createMockTokenService } from '../../../../../../test/helpers/mocks/token-service.mock';
import { WeakPasswordError } from '../../../domain/errors/weak-password.error';
import { PasswordChangedEvent } from '../../../domain/events/password-changed.event';
import type { IAuthCredentialsRepository } from '../../ports/auth-credentials.repository.interface';
import type { IPasswordHasher } from '../../ports/password-hasher.interface';
import type { IPasswordResetTokenRepository } from '../../ports/password-reset-token.repository.interface';
import type { ITokenService } from '../../ports/token.service.interface';
import { ChangePasswordCommand } from './change-password.command';
import { ChangePasswordHandler } from './change-password.handler';

describe('ChangePasswordHandler', () => {
  let handler: ChangePasswordHandler;
  let mockCredentials: jest.Mocked<IAuthCredentialsRepository>;
  let mockResetTokens: jest.Mocked<IPasswordResetTokenRepository>;
  let mockHasher: jest.Mocked<IPasswordHasher>;
  let mockTokenService: jest.Mocked<ITokenService>;
  let mockEventBus: ReturnType<typeof createMockEventBus>;

  beforeEach(() => {
    mockCredentials = createMockAuthCredentialsRepository();
    mockResetTokens = createMockPasswordResetTokenRepository();
    mockHasher = createMockPasswordHasher();
    mockTokenService = createMockTokenService();
    mockEventBus = createMockEventBus();

    handler = new ChangePasswordHandler(
      createMockPinoLogger() as any,
      mockCredentials,
      mockResetTokens,
      mockHasher,
      mockTokenService,
      mockEventBus as any,
    );
  });

  it('stores the new hash, revokes sessions and returns a pair for the new version', async () => {
    mockCredentials.findByUserId.mockResolvedValue(
      createAuthCredentialRecord({ userId: 'user-1' }),
    );
    mockHasher.verify.mockResolvedValue(true);
    mockHasher.hash.mockResolvedValue('new-hash');
    mockCredentials.updatePasswordAndRevokeSessions.mockResolvedValue(5);

    const result = await handler.execute(
      new ChangePasswordCommand('user-1', 'oldPass1', 'newPassword1'),
    );

    expect(
      mockCredentials.updatePasswordAndRevokeSessions,
    ).toHaveBeenCalledWith('user-1', 'new-hash');
    expect(mockTokenService.generateTokenPair).toHaveBeenCalledWith(
      'user-1',
      5,
    );
    expect(result.accessToken).toBe('mock-access-token');
  });

  it('invalidates pending reset links after the password is updated', async () => {
    mockCredentials.findByUserId.mockResolvedValue(
      createAuthCredentialRecord({ userId: 'user-1' }),
    );
    mockHasher.verify.mockResolvedValue(true);

    await handler.execute(
      new ChangePasswordCommand('user-1', 'oldPass1', 'newPassword1'),
    );

    expect(mockResetTokens.supersedeAllForUser).toHaveBeenCalledWith('user-1');
    expect(
      mockCredentials.updatePasswordAndRevokeSessions.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      mockResetTokens.supersedeAllForUser.mock.invocationCallOrder[0],
    );
  });

  it('publishes PasswordChangedEvent with the request locale', async () => {
    mockCredentials.findByUserId.mockResolvedValue(
      createAuthCredentialRecord({ userId: 'user-1', email: 'a@example.com' }),
    );

    await handler.execute(
      new ChangePasswordCommand('user-1', 'oldPass1', 'newPassword1', 'vi'),
    );

    const event = mockEventBus.publish.mock.calls[0][0] as PasswordChangedEvent;
    expect(event).toBeInstanceOf(PasswordChangedEvent);
    expect(event).toMatchObject({
      userId: 'user-1',
      email: 'a@example.com',
      locale: 'vi',
      method: 'change',
    });
  });

  it('throws WeakPasswordError when new password too short', async () => {
    await expect(
      handler.execute(new ChangePasswordCommand('user-1', 'oldPass1', 'short')),
    ).rejects.toThrow(WeakPasswordError);
    expect(
      mockCredentials.updatePasswordAndRevokeSessions,
    ).not.toHaveBeenCalled();
  });

  it('rejects when new password equals old password', async () => {
    await expect(
      handler.execute(
        new ChangePasswordCommand('user-1', 'samePass1', 'samePass1'),
      ),
    ).rejects.toThrow(WeakPasswordError);
  });

  it('throws NotFoundException when user has no credentials', async () => {
    mockCredentials.findByUserId.mockResolvedValue(null);

    await expect(
      handler.execute(
        new ChangePasswordCommand('missing', 'oldPass1', 'newPass12'),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws UnauthorizedException when old password is wrong', async () => {
    mockCredentials.findByUserId.mockResolvedValue(
      createAuthCredentialRecord({ userId: 'user-1' }),
    );
    mockHasher.verify.mockResolvedValue(false);

    await expect(
      handler.execute(
        new ChangePasswordCommand('user-1', 'wrongOld', 'newPassword1'),
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(
      mockCredentials.updatePasswordAndRevokeSessions,
    ).not.toHaveBeenCalled();
    expect(mockResetTokens.supersedeAllForUser).not.toHaveBeenCalled();
  });

  it('does not update password on verification failure', async () => {
    mockCredentials.findByUserId.mockResolvedValue(
      createAuthCredentialRecord(),
    );
    mockHasher.verify.mockResolvedValue(false);

    await expect(
      handler.execute(
        new ChangePasswordCommand('user-1', 'wrong', 'newPassword1'),
      ),
    ).rejects.toThrow();
    expect(mockHasher.hash).not.toHaveBeenCalled();
  });
});

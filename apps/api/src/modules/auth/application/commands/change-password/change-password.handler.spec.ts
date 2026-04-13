import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createAuthCredentialRecord } from '../../../../../../test/helpers/factories/auth.factory';
import { createMockAuthCredentialsRepository } from '../../../../../../test/helpers/mocks/auth-credentials.mock';
import { createMockPinoLogger } from '../../../../../../test/helpers/mocks/logger.mock';
import { createMockPasswordHasher } from '../../../../../../test/helpers/mocks/password-hasher.mock';
import { WeakPasswordError } from '../../../domain/errors/weak-password.error';
import type { IAuthCredentialsRepository } from '../../ports/auth-credentials.repository.interface';
import type { IPasswordHasher } from '../../ports/password-hasher.interface';
import { ChangePasswordCommand } from './change-password.command';
import { ChangePasswordHandler } from './change-password.handler';

describe('ChangePasswordHandler', () => {
  let handler: ChangePasswordHandler;
  let mockCredentials: jest.Mocked<IAuthCredentialsRepository>;
  let mockHasher: jest.Mocked<IPasswordHasher>;

  beforeEach(() => {
    mockCredentials = createMockAuthCredentialsRepository();
    mockHasher = createMockPasswordHasher();

    handler = new ChangePasswordHandler(
      createMockPinoLogger() as any,
      mockCredentials,
      mockHasher,
    );
  });

  it('hashes new password and updates credentials', async () => {
    mockCredentials.findByUserId.mockResolvedValue(
      createAuthCredentialRecord({ userId: 'user-1' }),
    );
    mockHasher.verify.mockResolvedValue(true);
    mockHasher.hash.mockResolvedValue('new-hash');

    await handler.execute(
      new ChangePasswordCommand('user-1', 'oldPass1', 'newPassword1'),
    );

    expect(mockHasher.hash).toHaveBeenCalledWith('newPassword1');
    expect(mockCredentials.updatePasswordHash).toHaveBeenCalledWith(
      'user-1',
      'new-hash',
    );
  });

  it('throws WeakPasswordError when new password too short', async () => {
    await expect(
      handler.execute(new ChangePasswordCommand('user-1', 'oldPass1', 'short')),
    ).rejects.toThrow(WeakPasswordError);
    expect(mockCredentials.updatePasswordHash).not.toHaveBeenCalled();
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
    expect(mockCredentials.updatePasswordHash).not.toHaveBeenCalled();
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

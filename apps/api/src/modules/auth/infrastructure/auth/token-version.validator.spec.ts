import { createAuthCredentialRecord } from '../../../../../test/helpers/factories/auth.factory';
import { createMockAuthCredentialsRepository } from '../../../../../test/helpers/mocks/auth-credentials.mock';
import { SessionRevokedError } from '../../domain/errors/session-revoked.error';
import { TokenVersionValidator } from './token-version.validator';

describe('TokenVersionValidator', () => {
  const repo = createMockAuthCredentialsRepository();
  const validator = new TokenVersionValidator(repo);

  beforeEach(() => jest.clearAllMocks());

  it('accepts a token whose tv matches the current version', async () => {
    repo.findByUserId.mockResolvedValue(
      createAuthCredentialRecord({ userId: 'u1', tokenVersion: 2 }),
    );

    await expect(validator.validate({ sub: 'u1', tv: 2 })).resolves.toEqual({
      sub: 'u1',
      tv: 2,
    });
  });

  it('rejects a token with an older tv', async () => {
    repo.findByUserId.mockResolvedValue(
      createAuthCredentialRecord({ userId: 'u1', tokenVersion: 3 }),
    );

    await expect(validator.validate({ sub: 'u1', tv: 2 })).rejects.toThrow(
      SessionRevokedError,
    );
  });

  it('rejects a legacy token without tv', async () => {
    repo.findByUserId.mockResolvedValue(
      createAuthCredentialRecord({ userId: 'u1', tokenVersion: 0 }),
    );

    await expect(validator.validate({ sub: 'u1' })).rejects.toThrow(
      SessionRevokedError,
    );
  });

  it('rejects an inactive user', async () => {
    repo.findByUserId.mockResolvedValue(
      createAuthCredentialRecord({ userId: 'u1', isActive: false }),
    );

    await expect(validator.validate({ sub: 'u1', tv: 0 })).rejects.toThrow(
      SessionRevokedError,
    );
  });

  it('rejects an unknown user and a missing sub', async () => {
    repo.findByUserId.mockResolvedValue(null);

    await expect(validator.validate({ sub: 'gone', tv: 0 })).rejects.toThrow(
      SessionRevokedError,
    );
    await expect(validator.validate({ tv: 0 })).rejects.toThrow(
      SessionRevokedError,
    );
  });
});

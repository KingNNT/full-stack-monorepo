import type { IPasswordResetTokenRepository } from '../../../src/modules/auth/application/ports/password-reset-token.repository.interface';

export function createMockPasswordResetTokenRepository(): jest.Mocked<IPasswordResetTokenRepository> {
  return {
    statsForUser: jest
      .fn()
      .mockResolvedValue({ issuedSince: 0, latestCreatedAt: null }),
    issue: jest.fn().mockResolvedValue(undefined),
    redeem: jest.fn().mockResolvedValue(null),
  };
}

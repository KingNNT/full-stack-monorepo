import type { ITokenService } from '../../../src/modules/auth/application/ports/token.service.interface';

export function createMockTokenService(): jest.Mocked<ITokenService> {
  return {
    generateTokenPair: jest.fn().mockResolvedValue({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    }),
    verifyAccessToken: jest.fn().mockResolvedValue({ sub: 'user-id' }),
    verifyRefreshToken: jest.fn().mockResolvedValue({ sub: 'user-id' }),
  };
}

import type { IAuthCredentialsRepository } from '../../../src/modules/auth/application/ports/auth-credentials.repository.interface';

export function createMockAuthCredentialsRepository(): jest.Mocked<IAuthCredentialsRepository> {
  return {
    findByEmailOrUsername: jest.fn().mockResolvedValue(null),
    findByUserId: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(undefined),
    updateLastLogin: jest.fn().mockResolvedValue(undefined),
    updateUsername: jest.fn().mockResolvedValue(undefined),
    updatePasswordHash: jest.fn().mockResolvedValue(undefined),
  };
}

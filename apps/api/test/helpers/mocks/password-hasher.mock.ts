import type { IPasswordHasher } from '../../../src/modules/auth/application/ports/password-hasher.interface';

export function createMockPasswordHasher(): jest.Mocked<IPasswordHasher> {
  return {
    hash: jest.fn().mockResolvedValue('hashed-password'),
    verify: jest.fn().mockResolvedValue(true),
  };
}

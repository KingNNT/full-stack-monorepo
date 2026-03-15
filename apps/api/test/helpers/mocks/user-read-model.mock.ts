import type { IUserReadModelRepository } from '../../../src/modules/user/application/ports/user-read-model.repository.interface';

export function createMockUserReadModelRepository(): jest.Mocked<IUserReadModelRepository> {
  return {
    applyProjection: jest.fn().mockResolvedValue(undefined),
  };
}

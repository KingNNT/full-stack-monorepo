import type { IUnitOfWork } from '../../../src/shared/application/unit-of-work.interface';

export function createMockUnitOfWork(): jest.Mocked<IUnitOfWork> {
  return {
    commit: jest.fn().mockResolvedValue(undefined),
  };
}

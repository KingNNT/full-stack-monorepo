import type { EventBus } from '@nestjs/cqrs';

export function createMockEventBus(): jest.Mocked<Pick<EventBus, 'publish'>> {
  return {
    publish: jest.fn(),
  };
}

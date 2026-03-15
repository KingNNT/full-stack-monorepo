import type { CommandBus } from '@nestjs/cqrs';

export function createMockCommandBus(): jest.Mocked<
  Pick<CommandBus, 'execute'>
> {
  return {
    execute: jest.fn(),
  };
}

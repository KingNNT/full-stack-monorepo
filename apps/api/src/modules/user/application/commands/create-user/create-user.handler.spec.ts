import { createMockUnitOfWork } from '../../../../../../test/helpers/mocks/unit-of-work.mock';
import type { IUnitOfWork } from '../../../../../shared/application/unit-of-work.interface';
import { CreateUserCommand } from './create-user.command';
import { CreateUserHandler } from './create-user.handler';

describe('CreateUserHandler', () => {
  let handler: CreateUserHandler;
  let mockUoW: jest.Mocked<IUnitOfWork>;

  beforeEach(() => {
    mockUoW = createMockUnitOfWork();
    handler = new CreateUserHandler(mockUoW);
  });

  it('creates a user aggregate and commits via UoW', async () => {
    const command = new CreateUserCommand('test@example.com', 'testuser');

    await handler.execute(command);

    expect(mockUoW.commit).toHaveBeenCalledTimes(1);
    const aggregate = mockUoW.commit.mock.calls[0][0];
    expect(aggregate.aggregateId).toBeDefined();
  });

  it('returns userId', async () => {
    const command = new CreateUserCommand('test@example.com', 'testuser');

    const result = await handler.execute(command);

    expect(result.userId).toBeDefined();
    expect(typeof result.userId).toBe('string');
  });

  it('returned userId matches what was committed', async () => {
    const command = new CreateUserCommand('test@example.com', 'testuser');

    const result = await handler.execute(command);

    const committedAggregate = mockUoW.commit.mock.calls[0][0];
    expect(result.userId).toBe(committedAggregate.aggregateId);
  });
});

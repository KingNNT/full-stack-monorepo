import { ConflictException, NotFoundException } from '@nestjs/common';
import { createUserAggregate } from '../../../../../../test/helpers/factories/user.factory';
import { createMockPinoLogger } from '../../../../../../test/helpers/mocks/logger.mock';
import { createMockUnitOfWork } from '../../../../../../test/helpers/mocks/unit-of-work.mock';
import type { IUnitOfWork } from '../../../../../shared/application/unit-of-work.interface';
import type { UserAggregate } from '../../../domain/aggregates/user.aggregate';
import { UserProfileUpdatedEvent } from '../../../domain/events/user-profile-updated.event';
import type { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { UpdateProfileCommand } from './update-profile.command';
import { UpdateProfileHandler } from './update-profile.handler';

describe('UpdateProfileHandler', () => {
  let handler: UpdateProfileHandler;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockUow: jest.Mocked<IUnitOfWork>;

  beforeEach(() => {
    mockUserRepo = { findById: jest.fn() };
    mockUow = createMockUnitOfWork();

    handler = new UpdateProfileHandler(
      createMockPinoLogger() as any,
      mockUserRepo,
      mockUow,
    );
  });

  it('updates username and commits via UoW', async () => {
    const aggregate = createUserAggregate({ username: 'oldname' });
    aggregate.clearUncommittedEvents();
    mockUserRepo.findById.mockResolvedValue(aggregate);

    const result = await handler.execute(
      new UpdateProfileCommand(aggregate.aggregateId, 'newname'),
    );

    expect(result.username).toBe('newname');
    expect(aggregate.username.value).toBe('newname');
    expect(mockUow.commit).toHaveBeenCalledWith(aggregate);
  });

  it('emits UserProfileUpdatedEvent on aggregate before commit', async () => {
    const aggregate = createUserAggregate({ username: 'oldname' });
    aggregate.clearUncommittedEvents();
    mockUserRepo.findById.mockResolvedValue(aggregate);

    let snapshot: ReadonlyArray<unknown> = [];
    mockUow.commit.mockImplementation(async (agg: UserAggregate) => {
      snapshot = agg.getUncommittedEvents();
    });

    await handler.execute(
      new UpdateProfileCommand(aggregate.aggregateId, 'newname'),
    );

    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]).toBeInstanceOf(UserProfileUpdatedEvent);
  });

  it('throws NotFoundException when aggregate is missing', async () => {
    mockUserRepo.findById.mockResolvedValue(null);

    await expect(
      handler.execute(
        new UpdateProfileCommand(
          '00000000-0000-0000-0000-000000000000',
          'newname',
        ),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('translates DB unique violation into ConflictException', async () => {
    const aggregate = createUserAggregate({ username: 'oldname' });
    aggregate.clearUncommittedEvents();
    mockUserRepo.findById.mockResolvedValue(aggregate);
    mockUow.commit.mockRejectedValue(
      new Error(
        'duplicate key value violates unique constraint "users_username_unique"',
      ),
    );

    await expect(
      handler.execute(
        new UpdateProfileCommand(aggregate.aggregateId, 'newname'),
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('rethrows non-conflict errors', async () => {
    const aggregate = createUserAggregate({ username: 'oldname' });
    aggregate.clearUncommittedEvents();
    mockUserRepo.findById.mockResolvedValue(aggregate);
    mockUow.commit.mockRejectedValue(new Error('boom'));

    await expect(
      handler.execute(
        new UpdateProfileCommand(aggregate.aggregateId, 'newname'),
      ),
    ).rejects.toThrow('boom');
  });
});

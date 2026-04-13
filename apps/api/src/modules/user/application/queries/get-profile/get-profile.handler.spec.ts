import { NotFoundException } from '@nestjs/common';
import { createMockUserReadModelRepository } from '../../../../../../test/helpers/mocks/user-read-model.mock';
import type { IUserReadModelRepository } from '../../ports/user-read-model.repository.interface';
import { GetProfileHandler } from './get-profile.handler';
import { GetProfileQuery } from './get-profile.query';

describe('GetProfileHandler', () => {
  let handler: GetProfileHandler;
  let mockReadModel: jest.Mocked<IUserReadModelRepository>;

  beforeEach(() => {
    mockReadModel = createMockUserReadModelRepository();
    handler = new GetProfileHandler(mockReadModel);
  });

  it('returns profile when user exists', async () => {
    mockReadModel.findById.mockResolvedValue({
      id: 'user-1',
      email: 'a@b.com',
      username: 'alice',
      isActive: true,
    });

    const result = await handler.execute(new GetProfileQuery('user-1'));

    expect(result).toEqual({
      userId: 'user-1',
      email: 'a@b.com',
      username: 'alice',
      isActive: true,
    });
    expect(mockReadModel.findById).toHaveBeenCalledWith('user-1');
  });

  it('throws NotFoundException when user does not exist', async () => {
    mockReadModel.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new GetProfileQuery('missing')),
    ).rejects.toThrow(NotFoundException);
  });
});

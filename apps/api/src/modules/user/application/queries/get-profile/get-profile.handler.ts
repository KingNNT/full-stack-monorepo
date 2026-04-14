import { Inject, NotFoundException } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  type IUserReadModelRepository,
  USER_READ_MODEL_REPOSITORY_TOKEN,
} from '../../ports/user-read-model.repository.interface';
import { GetProfileQuery } from './get-profile.query';
import type { GetProfileResult } from './get-profile.result';

@QueryHandler(GetProfileQuery)
export class GetProfileHandler
  implements IQueryHandler<GetProfileQuery, GetProfileResult>
{
  constructor(
    @Inject(USER_READ_MODEL_REPOSITORY_TOKEN)
    private readonly readModelRepo: IUserReadModelRepository,
  ) {}

  async execute(query: GetProfileQuery): Promise<GetProfileResult> {
    const record = await this.readModelRepo.findById(query.userId);
    if (!record) {
      throw new NotFoundException({
        message: 'User not found',
        errorCode: 'USER_NOT_FOUND',
      });
    }

    return {
      userId: record.id,
      email: record.email,
      username: record.username,
      isActive: record.isActive,
    };
  }
}

import type { UserAggregate } from '../aggregates/user.aggregate';
import type { UserId } from '../value-objects/user-id.vo';

export const USER_REPOSITORY_TOKEN = Symbol('IUserRepository');

export interface IUserRepository {
  findById(id: UserId): Promise<UserAggregate | null>;
}

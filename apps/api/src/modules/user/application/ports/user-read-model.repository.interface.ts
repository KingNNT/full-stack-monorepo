import type { DomainEventBase } from '../../../../shared/domain/domain-event.base';

export const USER_READ_MODEL_REPOSITORY_TOKEN = Symbol(
  'IUserReadModelRepository',
);

export interface UserReadRecord {
  id: string;
  email: string;
  username: string;
  isActive: boolean;
}

export interface IUserReadModelRepository {
  applyProjection(events: ReadonlyArray<DomainEventBase>): Promise<void>;
  findById(userId: string): Promise<UserReadRecord | null>;
}

import { Injectable } from '@nestjs/common';
import { EventStoreService } from '../../../../../shared/infrastructure/event-store/event-store.service';
import { UserAggregate } from '../../../domain/aggregates/user.aggregate';
import type { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import type { UserId } from '../../../domain/value-objects/user-id.vo';
import { UserEventSerializer } from './event-serializer';

@Injectable()
export class UserEventStoreRepository implements IUserRepository {
  constructor(
    private readonly eventStore: EventStoreService,
    private readonly serializer: UserEventSerializer,
  ) {}

  private streamId(userId: UserId): string {
    return `user-${userId.value}`;
  }

  async findById(id: UserId): Promise<UserAggregate | null> {
    const events = await this.eventStore.readStream(
      this.streamId(id),
      this.serializer,
    );
    if (events.length === 0) return null;
    return UserAggregate.reconstitute(events);
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import type { IUnitOfWork } from '../../../../shared/application/unit-of-work.interface';
import type { AggregateRootBase } from '../../../../shared/domain/aggregate-root.base';
import { EventStoreService } from '../../../../shared/infrastructure/event-store/event-store.service';
import {
  type IUserReadModelRepository,
  USER_READ_MODEL_REPOSITORY_TOKEN,
} from '../../application/ports/user-read-model.repository.interface';
import { UserEventSerializer } from '../persistence/event-store/event-serializer';

@Injectable()
export class UserUnitOfWork implements IUnitOfWork {
  private readonly logger = new Logger(UserUnitOfWork.name);

  constructor(
    private readonly eventStore: EventStoreService,
    private readonly serializer: UserEventSerializer,
    @Inject(USER_READ_MODEL_REPOSITORY_TOKEN)
    private readonly readModelRepo: IUserReadModelRepository,
    private readonly eventBus: EventBus,
  ) {}

  async commit(aggregate: AggregateRootBase): Promise<void> {
    const uncommittedEvents = aggregate.getUncommittedEvents();
    if (uncommittedEvents.length === 0) return;

    const streamId = `user-${aggregate.aggregateId}`;

    // Optimistic concurrency
    const expectedRevision =
      aggregate.version === -1
        ? ('no_stream' as const)
        : BigInt(aggregate.version);

    // Step 1: Append to event store (source of truth)
    const appendResult = await this.eventStore.appendToStream(
      streamId,
      uncommittedEvents,
      expectedRevision,
      this.serializer,
    );
    this.logger.debug(
      `Appended ${uncommittedEvents.length} event(s) to ${streamId}`,
    );

    // Step 2: Update aggregate version to match event store
    aggregate.version = Number(appendResult.nextExpectedRevision);

    // Step 3: Update read model projection (best-effort)
    try {
      await this.readModelRepo.applyProjection(uncommittedEvents);
      this.logger.debug('Read model projection updated');
    } catch (err) {
      this.logger.error(
        'Read model projection failed — events are in the domain_events table, ' +
          'projection will need to be rebuilt',
        err instanceof Error ? err.message : String(err),
      );
    }

    // Step 4: Clear processed events
    aggregate.clearUncommittedEvents();

    // Step 5: Publish to NestJS event bus for async side-effects
    for (const event of uncommittedEvents) {
      this.eventBus.publish(event);
    }
  }
}

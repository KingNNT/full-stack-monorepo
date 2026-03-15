import { randomUUID } from 'node:crypto';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { UserAggregate } from '../../../src/modules/user/domain/aggregates/user.aggregate';
import { UserId } from '../../../src/modules/user/domain/value-objects/user-id.vo';
import { UserEventSerializer } from '../../../src/modules/user/infrastructure/persistence/event-store/event-serializer';
import { UserEventStoreRepository } from '../../../src/modules/user/infrastructure/persistence/event-store/user-event-store.repository';
import type { DrizzleService } from '../../../src/shared/infrastructure/database/drizzle.service';
import { EventStoreService } from '../../../src/shared/infrastructure/event-store/event-store.service';
import {
  cleanDatabase,
  disconnectDrizzle,
  setupDrizzleForTests,
  type TestDrizzleDb,
} from '../../helpers/drizzle-test-utils';
import { startPostgresContainer } from '../../helpers/testcontainers-setup';

describe('UserEventStoreRepository (integration)', () => {
  let pgContainer: StartedPostgreSqlContainer;
  let db: TestDrizzleDb;
  let eventStoreService: EventStoreService;
  let serializer: UserEventSerializer;
  let repository: UserEventStoreRepository;

  beforeAll(async () => {
    pgContainer = await startPostgresContainer();
    db = await setupDrizzleForTests(pgContainer.getConnectionUri());

    const drizzleServiceMock = {
      db,
      transaction: <T>(fn: (tx: any) => Promise<T>): Promise<T> =>
        db.transaction(fn),
    } as DrizzleService;

    eventStoreService = new EventStoreService(drizzleServiceMock);
    serializer = new UserEventSerializer();
    repository = new UserEventStoreRepository(eventStoreService, serializer);
  }, 60_000);

  afterAll(async () => {
    await disconnectDrizzle();
    await pgContainer.stop();
  });

  beforeEach(async () => {
    await cleanDatabase(db);
  });

  it('findById() returns null for non-existent stream', async () => {
    const id = UserId.create();

    const result = await repository.findById(id);

    expect(result).toBeNull();
  });

  it('returns reconstituted aggregate after events are appended', async () => {
    // Create an aggregate with events
    const user = UserAggregate.create({
      email: `integ-${randomUUID().slice(0, 8)}@example.com`,
      username: `user${randomUUID().slice(0, 8)}`,
    });

    // Append events to stream
    const streamId = `user-${user.aggregateId}`;
    await eventStoreService.appendToStream(
      streamId,
      user.getUncommittedEvents(),
      'no_stream',
      serializer,
    );

    // Read back via repository
    const userId = UserId.fromString(user.aggregateId);
    const reconstituted = await repository.findById(userId);

    expect(reconstituted).not.toBeNull();
    expect(reconstituted?.aggregateId).toBe(user.aggregateId);
    expect(reconstituted?.email.value).toBe(user.email.value);
    expect(reconstituted?.username.value).toBe(user.username.value);
    expect(reconstituted?.isActive).toBe(true);
  });
});

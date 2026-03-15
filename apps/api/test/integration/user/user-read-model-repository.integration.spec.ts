import { randomUUID } from 'node:crypto';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { eq } from 'drizzle-orm';
import { UserCreatedEvent } from '../../../src/modules/user/domain/events/user-created.event';
import { UserReadModelRepository } from '../../../src/modules/user/infrastructure/persistence/read-model/user-read-model.repository';
import { AuditableTableService } from '../../../src/shared/infrastructure/database/auditable-table.service';
import type { DrizzleService } from '../../../src/shared/infrastructure/database/drizzle.service';
import { usersTable } from '../../../src/shared/infrastructure/database/schema/users.table';
import {
  cleanDatabase,
  disconnectDrizzle,
  setupDrizzleForTests,
  type TestDrizzleDb,
} from '../../helpers/drizzle-test-utils';
import { startPostgresContainer } from '../../helpers/testcontainers-setup';

describe('UserReadModelRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let db: TestDrizzleDb;
  let repository: UserReadModelRepository;

  beforeAll(async () => {
    container = await startPostgresContainer();
    db = await setupDrizzleForTests(container.getConnectionUri());

    const mockCls = { isActive: () => false, get: () => null } as any;
    const drizzleServiceMock = {
      db,
      transaction: <T>(fn: (tx: any) => Promise<T>): Promise<T> =>
        db.transaction(fn),
    } as DrizzleService;
    const auditService = new AuditableTableService(drizzleServiceMock, mockCls);
    repository = new UserReadModelRepository(auditService);
  }, 60_000);

  afterAll(async () => {
    await disconnectDrizzle();
    await container.stop();
  });

  beforeEach(async () => {
    await cleanDatabase(db);
  });

  it('applyProjection() inserts a row into users table for UserCreatedEvent', async () => {
    const userId = randomUUID();
    const createdAt = new Date();
    const event = new UserCreatedEvent({
      userId,
      email: 'test@example.com',
      username: 'testuser',
      createdAt,
    });

    await repository.applyProjection([event]);

    const results = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    const user = results[0];
    expect(user).toBeDefined();
    expect(user.email).toBe('test@example.com');
    expect(user.username).toBe('testuser');
    expect(user.isActive).toBe(true);
  });

  it('throws on duplicate email', async () => {
    const createdAt = new Date();
    const event1 = new UserCreatedEvent({
      userId: randomUUID(),
      email: 'dup@example.com',
      username: 'user1',
      createdAt,
    });
    const event2 = new UserCreatedEvent({
      userId: randomUUID(),
      email: 'dup@example.com',
      username: 'user2',
      createdAt,
    });

    await repository.applyProjection([event1]);

    await expect(repository.applyProjection([event2])).rejects.toThrow();
  });

  it('throws on duplicate username', async () => {
    const createdAt = new Date();
    const event1 = new UserCreatedEvent({
      userId: randomUUID(),
      email: 'a@example.com',
      username: 'sameuser',
      createdAt,
    });
    const event2 = new UserCreatedEvent({
      userId: randomUUID(),
      email: 'b@example.com',
      username: 'sameuser',
      createdAt,
    });

    await repository.applyProjection([event1]);

    await expect(repository.applyProjection([event2])).rejects.toThrow();
  });
});

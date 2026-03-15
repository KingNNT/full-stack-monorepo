import { randomUUID } from 'node:crypto';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { eq } from 'drizzle-orm';
import { AuthCredentialsRepository } from '../../../src/modules/auth/infrastructure/persistence/auth-credentials.repository';
import { AuditableTableService } from '../../../src/shared/infrastructure/database/auditable-table.service';
import type { DrizzleService } from '../../../src/shared/infrastructure/database/drizzle.service';
import { authCredentialsTable } from '../../../src/shared/infrastructure/database/schema/auth-credentials.table';
import {
  cleanDatabase,
  disconnectDrizzle,
  setupDrizzleForTests,
  type TestDrizzleDb,
} from '../../helpers/drizzle-test-utils';
import { startPostgresContainer } from '../../helpers/testcontainers-setup';

describe('AuthCredentialsRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let db: TestDrizzleDb;
  let repository: AuthCredentialsRepository;

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
    repository = new AuthCredentialsRepository(
      drizzleServiceMock,
      auditService,
    );
  }, 60_000);

  afterAll(async () => {
    await disconnectDrizzle();
    await container.stop();
  });

  beforeEach(async () => {
    await cleanDatabase(db);
  });

  it('create() inserts a credential record', async () => {
    const userId = randomUUID();

    await repository.create(
      userId,
      'test@example.com',
      'testuser',
      '$2b$12$hash',
    );

    const results = await db
      .select()
      .from(authCredentialsTable)
      .where(eq(authCredentialsTable.userId, userId));
    const record = results[0];
    expect(record).toBeDefined();
    expect(record.email).toBe('test@example.com');
    expect(record.username).toBe('testuser');
    expect(record.passwordHash).toBe('$2b$12$hash');
    expect(record.isActive).toBe(true);
  });

  it('findByEmailOrUsername() finds by email (case-insensitive)', async () => {
    const userId = randomUUID();
    await repository.create(
      userId,
      'alice@example.com',
      'alice',
      '$2b$12$hash',
    );

    const result = await repository.findByEmailOrUsername('alice@example.com');

    expect(result).toBeDefined();
    expect(result?.userId).toBe(userId);
    expect(result?.email).toBe('alice@example.com');
  });

  it('findByEmailOrUsername() finds by username', async () => {
    const userId = randomUUID();
    await repository.create(
      userId,
      'bob@example.com',
      'bobuser',
      '$2b$12$hash',
    );

    const result = await repository.findByEmailOrUsername('bobuser');

    expect(result).toBeDefined();
    expect(result?.userId).toBe(userId);
    expect(result?.username).toBe('bobuser');
  });

  it('findByEmailOrUsername() returns null for non-existent user', async () => {
    const result = await repository.findByEmailOrUsername(
      'nonexistent@example.com',
    );

    expect(result).toBeNull();
  });

  it('updateLastLogin() sets lastLoginAt', async () => {
    const userId = randomUUID();
    await repository.create(
      userId,
      'test@example.com',
      'testuser',
      '$2b$12$hash',
    );

    const loginAt = new Date('2024-06-01T12:00:00Z');
    await repository.updateLastLogin(userId, loginAt);

    const results = await db
      .select()
      .from(authCredentialsTable)
      .where(eq(authCredentialsTable.userId, userId));
    const record = results[0];
    expect(record.lastLoginAt).toEqual(loginAt);
  });

  it('throws on duplicate email', async () => {
    await repository.create(
      randomUUID(),
      'dup@example.com',
      'user1',
      '$2b$12$hash',
    );

    await expect(
      repository.create(
        randomUUID(),
        'dup@example.com',
        'user2',
        '$2b$12$hash',
      ),
    ).rejects.toThrow();
  });

  it('throws on duplicate username', async () => {
    await repository.create(
      randomUUID(),
      'a@example.com',
      'sameuser',
      '$2b$12$hash',
    );

    await expect(
      repository.create(
        randomUUID(),
        'b@example.com',
        'sameuser',
        '$2b$12$hash',
      ),
    ).rejects.toThrow();
  });
});

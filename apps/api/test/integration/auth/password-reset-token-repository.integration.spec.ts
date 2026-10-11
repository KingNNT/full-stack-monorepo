import { randomUUID } from 'node:crypto';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { and, eq, isNull } from 'drizzle-orm';
import { AuthCredentialsRepository } from '../../../src/modules/auth/infrastructure/persistence/auth-credentials.repository';
import { PasswordResetTokenRepository } from '../../../src/modules/auth/infrastructure/persistence/password-reset-token.repository';
import { AuditableTableService } from '../../../src/shared/infrastructure/database/auditable-table.service';
import type { DrizzleService } from '../../../src/shared/infrastructure/database/drizzle.service';
import { passwordResetTokensTable } from '../../../src/shared/infrastructure/database/schema/password-reset-tokens.table';
import {
  cleanDatabase,
  disconnectDrizzle,
  setupDrizzleForTests,
  type TestDrizzleDb,
} from '../../helpers/drizzle-test-utils';
import { startPostgresContainer } from '../../helpers/testcontainers-setup';

describe('PasswordResetTokenRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let db: TestDrizzleDb;
  let repo: PasswordResetTokenRepository;
  let credentials: AuthCredentialsRepository;
  let userId: string;

  const inMinutes = (m: number) => new Date(Date.now() + m * 60_000);

  beforeAll(async () => {
    container = await startPostgresContainer();
    db = await setupDrizzleForTests(container.getConnectionUri());
    const cls = { isActive: () => false, get: () => null } as any;
    const drizzle = {
      db,
      transaction: <T>(fn: (tx: any) => Promise<T>): Promise<T> =>
        db.transaction(fn),
    } as DrizzleService;
    const audit = new AuditableTableService(drizzle, cls);
    repo = new PasswordResetTokenRepository(drizzle, audit);
    credentials = new AuthCredentialsRepository(drizzle, audit);
  }, 60_000);

  afterAll(async () => {
    await disconnectDrizzle();
    await container.stop();
  });

  beforeEach(async () => {
    await cleanDatabase(db);
    userId = randomUUID();
    await credentials.create(
      userId,
      'reset@example.com',
      'resetuser',
      'old-hash',
    );
  });

  it('issue() supersedes earlier unused tokens', async () => {
    await repo.issue(userId, 'hash-a', inMinutes(30));
    await repo.issue(userId, 'hash-b', inMinutes(30));

    expect(await repo.redeem('hash-a', 'new-hash')).toBeNull();
    expect(await repo.redeem('hash-b', 'new-hash')).toEqual({
      userId,
      email: 'reset@example.com',
    });
  });

  it('redeem() updates the password, bumps token_version and is single-use', async () => {
    await repo.issue(userId, 'hash-a', inMinutes(30));

    await repo.redeem('hash-a', 'new-hash');

    const record = await credentials.findByUserId(userId);
    expect(record?.passwordHash).toBe('new-hash');
    expect(record?.tokenVersion).toBe(1);
    expect(await repo.redeem('hash-a', 'newer-hash')).toBeNull();
  });

  it('redeem() rejects expired tokens and leaves the password alone', async () => {
    await repo.issue(userId, 'hash-a', inMinutes(-1));

    expect(await repo.redeem('hash-a', 'new-hash')).toBeNull();
    expect((await credentials.findByUserId(userId))?.passwordHash).toBe(
      'old-hash',
    );
  });

  it('only one of two concurrent redeems succeeds', async () => {
    await repo.issue(userId, 'hash-a', inMinutes(30));

    const results = await Promise.all([
      repo.redeem('hash-a', 'pw-1'),
      repo.redeem('hash-a', 'pw-2'),
    ]);

    expect(results.filter((r) => r !== null)).toHaveLength(1);
    expect((await credentials.findByUserId(userId))?.tokenVersion).toBe(1);
  });

  it('statsForUser() counts tokens since a point in time', async () => {
    await repo.issue(userId, 'hash-a', inMinutes(30));
    await repo.issue(userId, 'hash-b', inMinutes(30));

    const stats = await repo.statsForUser(
      userId,
      new Date(Date.now() - 60_000),
    );
    const none = await repo.statsForUser(userId, inMinutes(1));

    expect(stats.issuedSince).toBe(2);
    expect(stats.latestCreatedAt).toBeInstanceOf(Date);
    expect(none.issuedSince).toBe(0);
  });

  it('stores only the hash', async () => {
    await repo.issue(userId, 'hash-a', inMinutes(30));

    const rows = await db
      .select()
      .from(passwordResetTokensTable)
      .where(eq(passwordResetTokensTable.userId, userId));
    expect(rows[0].tokenHash).toBe('hash-a');
  });

  it('concurrent issue() calls leave exactly one unused token', async () => {
    await Promise.all([
      repo.issue(userId, 'hash-a', inMinutes(30)),
      repo.issue(userId, 'hash-b', inMinutes(30)),
    ]);

    const unused = await db
      .select()
      .from(passwordResetTokensTable)
      .where(
        and(
          eq(passwordResetTokensTable.userId, userId),
          isNull(passwordResetTokensTable.usedAt),
        ),
      );
    expect(unused).toHaveLength(1);
  });

  it("redeem() supersedes the user's other unused tokens", async () => {
    await repo.issue(userId, 'hash-a', inMinutes(30));
    await db
      .insert(passwordResetTokensTable)
      .values({ userId, tokenHash: 'hash-other', expiresAt: inMinutes(30) });

    expect(await repo.redeem('hash-a', 'new-hash')).not.toBeNull();
    expect(await repo.redeem('hash-other', 'newer-hash')).toBeNull();
  });

  it('concurrent issue() and redeem() for one user do not deadlock', async () => {
    await repo.issue(userId, 'hash-a', inMinutes(30));

    const results = await Promise.allSettled([
      repo.issue(userId, 'hash-b', inMinutes(30)),
      repo.redeem('hash-a', 'new-hash'),
    ]);

    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
  });
});

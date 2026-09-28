import { resolve } from 'node:path';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import postgres from 'postgres';
import { runMigrations } from '../../../src/shared/infrastructure/database/migrate';
import { startPostgresContainer } from '../../helpers/testcontainers-setup';

const MIGRATIONS_FOLDER = resolve(__dirname, '../../../drizzle/migrations');

const EXPECTED_TABLES = [
  'auth_credentials',
  'domain_events',
  'model_has_permissions',
  'model_has_roles',
  'permissions',
  'role_has_permissions',
  'roles',
  'users',
];

describe('runMigrations (integration)', () => {
  let pgContainer: StartedPostgreSqlContainer;
  let dbUrl: string;
  let sql: postgres.Sql;

  beforeAll(async () => {
    pgContainer = await startPostgresContainer();
    dbUrl = pgContainer.getConnectionUri();
    sql = postgres(dbUrl, { max: 1, onnotice: () => {} });
  }, 120_000);

  afterAll(async () => {
    await sql?.end();
    await pgContainer?.stop();
  });

  async function publicTables(): Promise<string[]> {
    const rows = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name
    `;
    return rows.map((r) => r.table_name);
  }

  async function appliedMigrationCount(): Promise<number> {
    const [row] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations
    `;
    return row.count;
  }

  it('should create all tables on a fresh database', async () => {
    await runMigrations(dbUrl, MIGRATIONS_FOLDER);

    expect(await publicTables()).toEqual(
      expect.arrayContaining(EXPECTED_TABLES),
    );
    expect(await appliedMigrationCount()).toBeGreaterThan(0);
  });

  it('should be a no-op when run again', async () => {
    const before = await appliedMigrationCount();

    await runMigrations(dbUrl, MIGRATIONS_FOLDER);

    expect(await appliedMigrationCount()).toBe(before);
  });

  it('should serialize concurrent runs via the advisory lock', async () => {
    const before = await appliedMigrationCount();

    await Promise.all([
      runMigrations(dbUrl, MIGRATIONS_FOLDER),
      runMigrations(dbUrl, MIGRATIONS_FOLDER),
    ]);

    expect(await appliedMigrationCount()).toBe(before);
  });

  it('should reject when the migrations folder is missing', async () => {
    await expect(
      runMigrations(dbUrl, resolve(__dirname, 'does-not-exist')),
    ).rejects.toThrow();
  });
});

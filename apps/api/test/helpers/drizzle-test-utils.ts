import { execSync } from 'node:child_process';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { authCredentialsTable } from '../../src/shared/infrastructure/database/schema/auth-credentials.table';
import { domainEventsTable } from '../../src/shared/infrastructure/database/schema/domain-events.table';
import * as schema from '../../src/shared/infrastructure/database/schema/index';
import { usersTable } from '../../src/shared/infrastructure/database/schema/users.table';

export type TestDrizzleDb = PostgresJsDatabase<typeof schema>;

let sql: postgres.Sql;
let db: TestDrizzleDb;

export async function setupDrizzleForTests(
  databaseUrl: string,
): Promise<TestDrizzleDb> {
  // Close previous connection if setup is called again (e.g. multiple suites in --runInBand)
  if (sql) {
    await sql.end();
  }

  // Run migrations against the test database
  execSync('bunx drizzle-kit migrate', {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    stdio: 'pipe',
  });

  sql = postgres(databaseUrl);
  db = drizzle(sql, { schema });

  return db;
}

export async function cleanDatabase(client?: TestDrizzleDb): Promise<void> {
  const target = client ?? db;
  // Delete in dependency-safe order (auth_credentials may reference users)
  await target.delete(authCredentialsTable);
  await target.delete(usersTable);
  await target.delete(domainEventsTable);
}

export async function disconnectDrizzle(): Promise<void> {
  if (sql) {
    await sql.end();
  }
}

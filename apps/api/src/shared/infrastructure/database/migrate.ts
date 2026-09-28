import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

// Arbitrary fixed key so concurrent pods serialize on the same lock.
export const MIGRATION_LOCK_KEY = 7_214_903_518_562_041n;

export function resolveMigrationsFolder(): string {
  return (
    process.env.MIGRATIONS_FOLDER ??
    resolve(process.cwd(), 'drizzle/migrations')
  );
}

export async function runMigrations(
  databaseUrl: string,
  migrationsFolder: string = resolveMigrationsFolder(),
): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await sql`SELECT pg_advisory_lock(${MIGRATION_LOCK_KEY.toString()}::bigint)`;
    try {
      await migrate(drizzle(sql), { migrationsFolder });
    } finally {
      await sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK_KEY.toString()}::bigint)`;
    }
  } finally {
    await sql.end();
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('[migrate] failed: DATABASE_URL is not set');
    process.exit(1);
  }

  const migrationsFolder = resolveMigrationsFolder();
  console.log(`[migrate] applying migrations from ${migrationsFolder}`);
  try {
    await runMigrations(databaseUrl, migrationsFolder);
    console.log('[migrate] migrations applied successfully');
  } catch (err) {
    console.error('[migrate] failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  void main();
}

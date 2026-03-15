import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

let postgresContainer: StartedPostgreSqlContainer;

export async function startPostgresContainer(): Promise<StartedPostgreSqlContainer> {
  if (postgresContainer) return postgresContainer;

  postgresContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('test_db')
    .withUsername('test')
    .withPassword('test')
    .start();

  return postgresContainer;
}

export function getPostgresConnectionString(): string {
  return postgresContainer.getConnectionUri();
}

export async function stopContainers(): Promise<void> {
  await postgresContainer?.stop();
}

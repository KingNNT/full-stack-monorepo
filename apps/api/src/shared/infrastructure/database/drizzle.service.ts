import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

export type DrizzleClient = PostgresJsDatabase<typeof schema>;
export type DrizzleTransaction = Parameters<
  Parameters<DrizzleClient['transaction']>[0]
>[0];

@Injectable()
export class DrizzleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DrizzleService.name);
  private sql!: postgres.Sql;
  private _db!: DrizzleClient;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.getOrThrow<string>('DATABASE_URL');
    this.sql = postgres(url);
    this._db = drizzle(this.sql, { schema });
    this.logger.log('Drizzle connected to PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.sql.end();
  }

  get db(): DrizzleClient {
    return this._db;
  }

  async transaction<T>(fn: (tx: DrizzleTransaction) => Promise<T>): Promise<T> {
    return this._db.transaction(fn);
  }
}

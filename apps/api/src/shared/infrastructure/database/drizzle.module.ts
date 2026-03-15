import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditableTableService } from './auditable-table.service';
import { DrizzleService } from './drizzle.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [DrizzleService, AuditableTableService],
  exports: [DrizzleService, AuditableTableService],
})
export class DrizzleModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { UserModule } from './modules/user/user.module';
import { AppClsModule } from './shared/infrastructure/cls/cls.module';
import { DrizzleModule } from './shared/infrastructure/database/drizzle.module';
import { EventStoreModule } from './shared/infrastructure/event-store/event-store.module';
import { AppLoggerModule } from './shared/infrastructure/logger/logger.module';
import { HealthController } from './shared/presentation/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'test' ? ['.env.test', '.env'] : '.env',
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60000, limit: 30 }],
    }),
    AppClsModule,
    AppLoggerModule,
    DrizzleModule,
    EventStoreModule,
    UserModule,
    AuthModule,
    RbacModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

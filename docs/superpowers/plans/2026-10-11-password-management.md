# Password Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Session revocation with token refresh, an SES-backed mail subsystem, forgot/reset password, and web UI for change/forgot/reset password.

**Architecture:** A `token_version` on `auth_credentials` is signed into every JWT as `tv` and checked by both Passport strategies; bumping it revokes sessions. Mail goes through an application port (`IMailService`) implemented over a transport port (`IMailSender`, SES or SMTP/Mailpit) and is sent from CQRS event handlers after the response. Reset tokens are random, stored as SHA-256 hashes, and redeemed atomically in one transaction that also changes the password and bumps `token_version`.

**Tech Stack:** NestJS 11 + CQRS + Drizzle (PostgreSQL 16), Jest + TestContainers, `@aws-sdk/client-sesv2`, `nodemailer`, Mailpit; Next.js 16 + NextAuth v5 + next-intl + react-hook-form/zod, Vitest, Playwright; Terraform (AWS provider 5.x), Helm.

**Spec:** `docs/superpowers/specs/2026-10-11-password-management-design.md`

**Git:** do not commit, branch or push. The user handles git; each task ends with a verification step instead of a commit.

## Global Constraints

- pnpm only (`pnpm`, `pnpm exec`, `pnpm dlx`); never npm/npx/yarn.
- Never modify, print or commit `apps/<app>/.env*`. New variables go in `apps/<app>/.env.example`.
- API style: Biome single quotes, 2-space indent, 80 columns, `import type` for type-only imports. Web style: double quotes, tabs, 100 columns.
- Wire casing: request/response bodies `snake_case`; TypeScript internals `camelCase`. Response DTOs use `@Exclude()` + `@Expose({ name })`.
- Every API response is wrapped by `TransformInterceptor`; `data` is never `null` (use `{}`).
- Every new table uses `auditColumns` and soft delete; queries filter `isNull(table.deletedAt)`.
- Application/domain code never imports infrastructure; depend on ports bound with Symbol tokens.
- Password rules: 8–128 characters (same as register).
- Locales: `en` | `vi`, default `en`.
- Reset token TTL: `PASSWORD_RESET_TTL_MINUTES`, default `30`.
- Forgot-password per-account limits: no new token within 60 s of the last one; at most 5 per rolling hour.
- IP throttles: forgot-password 3/min, reset-password 5/min (unless `THROTTLE_DISABLED=true`).
- Error codes: `SESSION_REVOKED` (401), `INVALID_CURRENT_PASSWORD` (401), `WEAK_PASSWORD` (400), `INVALID_RESET_TOKEN` (400).
- Logs carry `userId`, never email addresses, raw tokens or passwords.
- API commands: run from `apps/api` with `pnpm exec jest …`; e2e/integration need Docker running.

## Review Focus

1. **Reset token redeemed twice concurrently** — two simultaneous `reset-password` calls with the same token must yield exactly one success; the second gets `INVALID_RESET_TOKEN`. Pinned in Task 11 (repository integration test, `Promise.all` double redeem).
2. **Email case and whitespace on forgot-password** — `"  Alice@Example.COM "` must find `alice@example.com`. Pinned in Task 12 (handler normalizes before lookup).
3. **Tokens issued before the deploy (no `tv` claim)** — must be rejected with `SESSION_REVOKED`, not crash on `undefined !== 0`. Pinned in Task 3.
4. **Locale outside `en`/`vi` from a hand-crafted request** — DTO rejects it with 400; templates fall back to `en` for anything unexpected. Pinned in Task 8 (template fallback) and Task 15 (DTO validation e2e).
5. **Refresh token used as an access token (and vice versa)** — secrets differ, so `/users/profile` with a refresh token and `/auth/refresh` with an access token both return 401. Pinned in Task 6.

---

## File Map

API (`apps/api`):

| File | Responsibility |
|---|---|
| `src/shared/infrastructure/database/schema/auth-credentials.table.ts` | + `tokenVersion` column |
| `src/shared/infrastructure/database/schema/password-reset-tokens.table.ts` | new table |
| `drizzle/migrations/0002_*.sql`, `0003_*.sql` | generated migrations |
| `src/modules/auth/application/ports/auth-credentials.repository.interface.ts` | + `tokenVersion`, `updatePasswordAndRevokeSessions` |
| `src/modules/auth/application/ports/token.service.interface.ts` | `tv` claim, new signature |
| `src/modules/auth/application/ports/password-reset-token.repository.interface.ts` | reset token persistence port |
| `src/modules/auth/application/ports/reset-token-generator.interface.ts` | token generation port |
| `src/modules/auth/application/commands/refresh-token/*` | refresh command + handler |
| `src/modules/auth/application/commands/request-password-reset/*` | forgot-password command + handler |
| `src/modules/auth/application/commands/reset-password/*` | reset command + handler |
| `src/modules/auth/application/commands/change-password/*` | returns token pair, bumps version, publishes event |
| `src/modules/auth/application/event-handlers/send-password-reset-email.handler.ts` | mail on reset request |
| `src/modules/auth/application/event-handlers/send-password-changed-email.handler.ts` | mail on password change |
| `src/modules/auth/domain/events/password-reset-requested.event.ts`, `password-changed.event.ts` | events |
| `src/modules/auth/domain/errors/invalid-reset-token.error.ts`, `session-revoked.error.ts` | errors |
| `src/modules/auth/infrastructure/auth/jwt.strategy.ts`, `jwt-refresh.strategy.ts` | `tv` validation |
| `src/modules/auth/infrastructure/auth/token-version.validator.ts` | shared validation used by both strategies |
| `src/modules/auth/infrastructure/auth/crypto-reset-token-generator.ts` | `IResetTokenGenerator` impl |
| `src/modules/auth/infrastructure/persistence/password-reset-token.repository.ts` | reset token repo |
| `src/modules/auth/presentation/controllers/auth.controller.ts` | refresh, forgot, reset endpoints |
| `src/modules/auth/presentation/dtos/*` | new request DTOs, `TokenPairResponseDto` |
| `src/modules/user/presentation/controllers/users.controller.ts`, `dtos/change-password.request.dto.ts` | 200 + token pair, `locale` |
| `src/shared/application/ports/mail.interface.ts` | `IMailSender`, `IMailService`, template types |
| `src/shared/infrastructure/mail/*` | adapters, templates, `MailService`, `MailModule` |
| `src/shared/infrastructure/logger/logger.module.ts` | redact paths |
| `src/app.module.ts` | import `MailModule` |
| `test/helpers/mocks/*`, `test/helpers/drizzle-test-utils.ts`, `test/helpers/mail-capture.ts` | mocks, cleanup, in-memory mail sender |

Web (`apps/web/src`):

| File | Responsibility |
|---|---|
| `utils/jwt.ts` | decode `exp` from a JWT |
| `services/next-auth.ts`, `types/next-auth.d.ts` | refresh, `error`, `trigger: update`, `unstable_update` export |
| `proxy.ts` | treat `RefreshFailed` as signed out |
| `apis/base-http-client.ts` | sign out on `SESSION_REVOKED` in the browser |
| `apis/auth-api.ts`, `apis/user-api.ts`, `types/auth.d.ts`, `types/user.d.ts` | new endpoints |
| `services/auth.service.ts` | `refresh`, `forgotPassword`, `resetPassword`, `changePassword` |
| `constants/error-codes.ts`, `constants/routes.ts` | codes, `/reset-password` |
| `app/api/v1/auth/{forgot-password,reset-password}/route.ts`, `app/api/v1/users/change-password/route.ts` | route handlers |
| `components/auth/{forgot-password-form,reset-password-form,login-banner}.tsx`, `components/settings/change-password-form.tsx` | forms |
| `app/[locale]/(unauthenticated)/{forgot-password,reset-password}/page.tsx`, `app/[locale]/(authenticated)/settings/security/page.tsx` | pages |
| `components/auth/login-form.tsx`, `components/layout/private-sidebar.tsx` | link, banner, menu |
| `langs/en.json`, `langs/vi.json` | strings |
| `e2e/tests/auth/password-reset.spec.ts`, `e2e/utils/mailpit.ts` | Playwright |

Infra: `docker-compose.yml`, `docker-compose.override.yml`, `mise/tasks/local/docker/up/api`, `infra/terraform/modules/ses/*`, `infra/terraform/modules/iam/*`, `infra/terraform/modules/codebuild/*`, `infra/terraform/envs/{staging,prod}/*`, `infra/codebuild/buildspec-helm-deploy.yml`, `infra/helm/api/values-*.yaml`, `infra/scripts/localstack-init.sh`, `docs/infrastructure.md`, `README.md`, `docs/AGENT_INSTALL.md`.

---

# Phase 1 — Session revocation and refresh

### Task 1: `token_version` column and repository support

**Files:**
- Modify: `apps/api/src/shared/infrastructure/database/schema/auth-credentials.table.ts`
- Create: `apps/api/drizzle/migrations/0002_*.sql` (generated)
- Modify: `apps/api/src/modules/auth/application/ports/auth-credentials.repository.interface.ts`
- Modify: `apps/api/src/modules/auth/infrastructure/persistence/auth-credentials.repository.ts`
- Modify: `apps/api/test/helpers/mocks/auth-credentials.mock.ts`, `apps/api/test/helpers/factories/auth.factory.ts`
- Test: `apps/api/test/integration/auth/auth-credentials-repository.integration.spec.ts`

**Interfaces:**
- Produces: `AuthCredentialRecord.tokenVersion: number`; `IAuthCredentialsRepository.updatePasswordAndRevokeSessions(userId: string, passwordHash: string): Promise<number>` (returns the new `token_version`).

- [ ] **Step 1: Write the failing integration test**

Append to `test/integration/auth/auth-credentials-repository.integration.spec.ts` inside the top-level `describe`:

```typescript
  it('new credentials start at token_version 0', async () => {
    const userId = randomUUID();
    await repository.create(userId, 'tv@example.com', 'tvuser', 'hash-1');

    const record = await repository.findByUserId(userId);

    expect(record?.tokenVersion).toBe(0);
  });

  it('updatePasswordAndRevokeSessions() replaces the hash and bumps token_version', async () => {
    const userId = randomUUID();
    await repository.create(userId, 'bump@example.com', 'bumpuser', 'hash-1');

    const first = await repository.updatePasswordAndRevokeSessions(userId, 'hash-2');
    const second = await repository.updatePasswordAndRevokeSessions(userId, 'hash-3');

    expect(first).toBe(1);
    expect(second).toBe(2);
    const record = await repository.findByUserId(userId);
    expect(record?.passwordHash).toBe('hash-3');
    expect(record?.tokenVersion).toBe(2);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && pnpm exec jest --config ./test/integration/jest-integration.json test/integration/auth/auth-credentials-repository.integration.spec.ts`
Expected: FAIL — TypeScript error `Property 'updatePasswordAndRevokeSessions' does not exist` / `tokenVersion` undefined.

- [ ] **Step 3: Add the column**

In `auth-credentials.table.ts`, add `integer` to the `drizzle-orm/pg-core` import and the column after `isActive`:

```typescript
  tokenVersion: integer('token_version').notNull().default(0),
```

- [ ] **Step 4: Generate the migration**

Run: `cd apps/api && pnpm exec drizzle-kit generate --name add_token_version`
Expected: a new `drizzle/migrations/0002_add_token_version.sql` containing
`ALTER TABLE "auth_credentials" ADD COLUMN "token_version" integer DEFAULT 0 NOT NULL;`

- [ ] **Step 5: Extend the port**

In `auth-credentials.repository.interface.ts`, add to `AuthCredentialRecord`:

```typescript
  tokenVersion: number;
```

and to `IAuthCredentialsRepository`:

```typescript
  /** Sets a new password hash and revokes every session; returns the new token version. */
  updatePasswordAndRevokeSessions(
    userId: string,
    passwordHash: string,
  ): Promise<number>;
```

- [ ] **Step 6: Implement in the repository**

In `auth-credentials.repository.ts`:
- add `sql` to the `drizzle-orm` import;
- add `tokenVersion: authCredentialsTable.tokenVersion,` to the `select({...})` of both `findByEmailOrUsername` and `findByUserId`;
- add the method:

```typescript
  async updatePasswordAndRevokeSessions(
    userId: string,
    passwordHash: string,
  ): Promise<number> {
    const rows = await this.drizzle.db
      .update(authCredentialsTable)
      .set({
        passwordHash,
        tokenVersion: sql`${authCredentialsTable.tokenVersion} + 1`,
      })
      .where(
        and(
          eq(authCredentialsTable.userId, userId),
          isNull(authCredentialsTable.deletedAt),
        ),
      )
      .returning({ tokenVersion: authCredentialsTable.tokenVersion });

    if (rows.length === 0) {
      throw new Error(`No credentials for user ${userId}`);
    }
    return rows[0].tokenVersion;
  }
```

- [ ] **Step 7: Update the mock and factory**

`test/helpers/mocks/auth-credentials.mock.ts` — add:

```typescript
    updatePasswordAndRevokeSessions: jest.fn().mockResolvedValue(1),
```

`test/helpers/factories/auth.factory.ts` — in `createAuthCredentialRecord` add:

```typescript
    tokenVersion: overrides.tokenVersion ?? 0,
```

- [ ] **Step 8: Run the integration test and typecheck**

Run: `cd apps/api && pnpm exec jest --config ./test/integration/jest-integration.json test/integration/auth/auth-credentials-repository.integration.spec.ts && pnpm typecheck`
Expected: PASS; typecheck clean.

---

### Task 2: Sign `tv` into tokens

**Files:**
- Modify: `apps/api/src/modules/auth/application/ports/token.service.interface.ts`
- Modify: `apps/api/src/modules/auth/infrastructure/auth/token.service.impl.ts`
- Modify: `apps/api/src/modules/auth/application/commands/login/login.handler.ts`
- Test: `apps/api/test/integration/auth/token-service.integration.spec.ts`, `apps/api/src/modules/auth/application/commands/login/login.handler.spec.ts`
- Modify: `apps/api/test/helpers/mocks/token-service.mock.ts`

**Interfaces:**
- Consumes: `AuthCredentialRecord.tokenVersion` (Task 1).
- Produces: `JwtPayload { sub: string; tv: number; iat?: number; exp?: number }`; `ITokenService.generateTokenPair(userId: string, tokenVersion: number): Promise<TokenPair>`.

- [ ] **Step 1: Write failing tests**

In `test/integration/auth/token-service.integration.spec.ts`, change every `generateTokenPair('<id>')` call to pass a version, then add a test:

Run: `cd apps/api && sed -i '' -E "s/generateTokenPair\('([^']+)'\)/generateTokenPair('\1', 0)/g" test/integration/auth/token-service.integration.spec.ts`

```typescript
  it('signs the token version into both tokens', async () => {
    const pair = await tokenService.generateTokenPair('user-123', 7);

    const access = await tokenService.verifyAccessToken(pair.accessToken);
    const refresh = await tokenService.verifyRefreshToken(pair.refreshToken);

    expect(access.tv).toBe(7);
    expect(refresh.tv).toBe(7);
  });
```

In `login.handler.spec.ts`, inside `describe('success flow')` add:

```typescript
    it('signs the credential token version into the tokens', async () => {
      const credential = createAuthCredentialRecord({ tokenVersion: 3 });
      mockCredentials.findByEmailOrUsername.mockResolvedValue(credential);
      mockHasher.verify.mockResolvedValue(true);

      await handler.execute(
        new LoginCommand('test@example.com', 'securePassword123'),
      );

      expect(mockTokenService.generateTokenPair).toHaveBeenCalledWith(
        credential.userId,
        3,
      );
    });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd apps/api && pnpm exec jest src/modules/auth/application/commands/login && pnpm exec jest --config ./test/integration/jest-integration.json test/integration/auth/token-service.integration.spec.ts`
Expected: FAIL — `generateTokenPair` called with one argument; `tv` undefined.

- [ ] **Step 3: Implement**

`token.service.interface.ts`:

```typescript
export interface JwtPayload {
  sub: string;
  /** auth_credentials.token_version at issue time; a mismatch means revoked. */
  tv: number;
  iat?: number;
  exp?: number;
}

export interface ITokenService {
  generateTokenPair(userId: string, tokenVersion: number): Promise<TokenPair>;
  verifyAccessToken(token: string): Promise<JwtPayload>;
  verifyRefreshToken(token: string): Promise<JwtPayload>;
}
```

`token.service.impl.ts`:

```typescript
  async generateTokenPair(
    userId: string,
    tokenVersion: number,
  ): Promise<TokenPair> {
    const payload: JwtPayload = { sub: userId, tv: tokenVersion };
```

(rest of the method unchanged).

`login.handler.ts` step 5:

```typescript
    const tokens = await this.tokenService.generateTokenPair(
      credential.userId,
      credential.tokenVersion,
    );
```

`test/helpers/mocks/token-service.mock.ts`: change both verify mocks to resolve `{ sub: 'user-id', tv: 0 }`.

- [ ] **Step 4: Run tests and typecheck**

Run: `cd apps/api && pnpm exec jest src/modules/auth && pnpm exec jest --config ./test/integration/jest-integration.json test/integration/auth/token-service.integration.spec.ts && pnpm typecheck`
Expected: PASS. Fix any other `generateTokenPair` caller the typecheck reports (there are none besides `LoginHandler` today).

---

### Task 3: Reject revoked tokens in both strategies

**Files:**
- Create: `apps/api/src/modules/auth/domain/errors/session-revoked.error.ts`
- Create: `apps/api/src/modules/auth/infrastructure/auth/token-version.validator.ts`
- Modify: `apps/api/src/modules/auth/infrastructure/auth/jwt.strategy.ts`, `jwt-refresh.strategy.ts`
- Modify: `apps/api/src/modules/auth/auth.module.ts`
- Test: `apps/api/src/modules/auth/infrastructure/auth/token-version.validator.spec.ts`

**Interfaces:**
- Consumes: `IAuthCredentialsRepository.findByUserId`, `JwtPayload.tv`.
- Produces: `SessionRevokedError` (401, `SESSION_REVOKED`); `TokenVersionValidator.validate(payload: Partial<JwtPayload>): Promise<JwtPayload>`.

- [ ] **Step 1: Write the failing test**

`token-version.validator.spec.ts`:

```typescript
import { createAuthCredentialRecord } from '../../../../../test/helpers/factories/auth.factory';
import { createMockAuthCredentialsRepository } from '../../../../../test/helpers/mocks/auth-credentials.mock';
import { SessionRevokedError } from '../../domain/errors/session-revoked.error';
import { TokenVersionValidator } from './token-version.validator';

describe('TokenVersionValidator', () => {
  const repo = createMockAuthCredentialsRepository();
  const validator = new TokenVersionValidator(repo);

  beforeEach(() => jest.clearAllMocks());

  it('accepts a token whose tv matches the current version', async () => {
    repo.findByUserId.mockResolvedValue(
      createAuthCredentialRecord({ userId: 'u1', tokenVersion: 2 }),
    );

    await expect(validator.validate({ sub: 'u1', tv: 2 })).resolves.toEqual({
      sub: 'u1',
      tv: 2,
    });
  });

  it('rejects a token with an older tv', async () => {
    repo.findByUserId.mockResolvedValue(
      createAuthCredentialRecord({ userId: 'u1', tokenVersion: 3 }),
    );

    await expect(validator.validate({ sub: 'u1', tv: 2 })).rejects.toThrow(
      SessionRevokedError,
    );
  });

  it('rejects a legacy token without tv', async () => {
    repo.findByUserId.mockResolvedValue(
      createAuthCredentialRecord({ userId: 'u1', tokenVersion: 0 }),
    );

    await expect(validator.validate({ sub: 'u1' })).rejects.toThrow(
      SessionRevokedError,
    );
  });

  it('rejects an inactive user', async () => {
    repo.findByUserId.mockResolvedValue(
      createAuthCredentialRecord({ userId: 'u1', isActive: false }),
    );

    await expect(validator.validate({ sub: 'u1', tv: 0 })).rejects.toThrow(
      SessionRevokedError,
    );
  });

  it('rejects an unknown user and a missing sub', async () => {
    repo.findByUserId.mockResolvedValue(null);

    await expect(validator.validate({ sub: 'gone', tv: 0 })).rejects.toThrow(
      SessionRevokedError,
    );
    await expect(validator.validate({ tv: 0 })).rejects.toThrow(
      SessionRevokedError,
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && pnpm exec jest src/modules/auth/infrastructure/auth/token-version.validator.spec.ts`
Expected: FAIL — cannot find module `./token-version.validator`.

- [ ] **Step 3: Implement**

`domain/errors/session-revoked.error.ts`:

```typescript
import { UnauthorizedException } from '@nestjs/common';

export class SessionRevokedError extends UnauthorizedException {
  constructor() {
    super({ message: 'Session is no longer valid', errorCode: 'SESSION_REVOKED' });
    this.name = 'SessionRevokedError';
  }
}
```

`infrastructure/auth/token-version.validator.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import {
  AUTH_CREDENTIALS_REPOSITORY_TOKEN,
  type IAuthCredentialsRepository,
} from '../../application/ports/auth-credentials.repository.interface';
import type { JwtPayload } from '../../application/ports/token.service.interface';
import { SessionRevokedError } from '../../domain/errors/session-revoked.error';

@Injectable()
export class TokenVersionValidator {
  constructor(
    @Inject(AUTH_CREDENTIALS_REPOSITORY_TOKEN)
    private readonly credentialsRepo: IAuthCredentialsRepository,
  ) {}

  async validate(payload: Partial<JwtPayload>): Promise<JwtPayload> {
    if (!payload.sub || typeof payload.tv !== 'number') {
      throw new SessionRevokedError();
    }
    const credential = await this.credentialsRepo.findByUserId(payload.sub);
    if (
      !credential ||
      !credential.isActive ||
      credential.tokenVersion !== payload.tv
    ) {
      throw new SessionRevokedError();
    }
    return payload as JwtPayload;
  }
}
```

`jwt.strategy.ts` (and the same change in `jwt-refresh.strategy.ts`, keeping its `'jwt-refresh'` name and `JWT_REFRESH_SECRET`):

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload } from '../../application/ports/token.service.interface';
import { TokenVersionValidator } from './token-version.validator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly tokenVersion: TokenVersionValidator,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: Partial<JwtPayload>): Promise<JwtPayload> {
    return this.tokenVersion.validate(payload);
  }
}
```

`auth.module.ts`: import `TokenVersionValidator` and add it to `providers` next to the strategies.

- [ ] **Step 4: Run tests**

Run: `cd apps/api && pnpm exec jest src/modules/auth && pnpm typecheck`
Expected: PASS.

---

### Task 4: `POST /api/v1/auth/refresh`

**Files:**
- Create: `apps/api/src/modules/auth/application/commands/refresh-token/refresh-token.command.ts`, `refresh-token.handler.ts`, `refresh-token.handler.spec.ts`
- Create: `apps/api/src/modules/auth/presentation/dtos/token-pair.response.dto.ts`
- Modify: `apps/api/src/modules/auth/presentation/controllers/auth.controller.ts`, `auth.controller.spec.ts`
- Modify: `apps/api/src/modules/auth/auth.module.ts`

**Interfaces:**
- Consumes: `JwtRefreshGuard`, `CurrentUser` decorator (`src/modules/user/presentation/decorators/current-user.decorator.ts`), `ITokenService.generateTokenPair(userId, tokenVersion)`.
- Produces: `RefreshTokenCommand(userId: string, tokenVersion: number)` → `TokenPair`; `TokenPairResponseDto { accessToken; refreshToken }` serialized as `access_token`/`refresh_token`; `TokenPairResponseDto.from(pair: TokenPair)`.

- [ ] **Step 1: Write failing tests**

`refresh-token.handler.spec.ts`:

```typescript
import { createMockTokenService } from '../../../../../../test/helpers/mocks/token-service.mock';
import { RefreshTokenCommand } from './refresh-token.command';
import { RefreshTokenHandler } from './refresh-token.handler';

describe('RefreshTokenHandler', () => {
  it('issues a new pair for the validated user and version', async () => {
    const tokenService = createMockTokenService();
    const handler = new RefreshTokenHandler(tokenService);

    const result = await handler.execute(new RefreshTokenCommand('u1', 4));

    expect(tokenService.generateTokenPair).toHaveBeenCalledWith('u1', 4);
    expect(result).toEqual({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    });
  });
});
```

Add to `auth.controller.spec.ts`:

```typescript
  describe('refresh()', () => {
    it('dispatches RefreshTokenCommand with the token claims', async () => {
      mockCommandBus.execute.mockResolvedValue({
        accessToken: 'a2',
        refreshToken: 'r2',
      });

      const result = await controller.refresh({ sub: 'u1', tv: 2 });

      const dispatched = mockCommandBus.execute.mock
        .calls[0][0] as RefreshTokenCommand;
      expect(dispatched).toBeInstanceOf(RefreshTokenCommand);
      expect(dispatched).toMatchObject({ userId: 'u1', tokenVersion: 2 });
      expect(result).toBeInstanceOf(TokenPairResponseDto);
      expect(result.accessToken).toBe('a2');
    });
  });
```

with imports `RefreshTokenCommand` from `'../../application/commands/refresh-token/refresh-token.command'` and `TokenPairResponseDto` from `'../dtos/token-pair.response.dto'`.

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/api && pnpm exec jest src/modules/auth`
Expected: FAIL — modules not found / `controller.refresh` is not a function.

- [ ] **Step 3: Implement**

`refresh-token.command.ts`:

```typescript
export class RefreshTokenCommand {
  constructor(
    public readonly userId: string,
    public readonly tokenVersion: number,
  ) {}
}
```

`refresh-token.handler.ts`:

```typescript
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  type ITokenService,
  TOKEN_SERVICE_TOKEN,
  type TokenPair,
} from '../../ports/token.service.interface';
import { RefreshTokenCommand } from './refresh-token.command';

// The refresh strategy has already verified the signature and token version.
@CommandHandler(RefreshTokenCommand)
export class RefreshTokenHandler
  implements ICommandHandler<RefreshTokenCommand, TokenPair>
{
  constructor(
    @Inject(TOKEN_SERVICE_TOKEN)
    private readonly tokenService: ITokenService,
  ) {}

  execute(command: RefreshTokenCommand): Promise<TokenPair> {
    return this.tokenService.generateTokenPair(
      command.userId,
      command.tokenVersion,
    );
  }
}
```

`token-pair.response.dto.ts`:

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import type { TokenPair } from '../../application/ports/token.service.interface';

@Exclude()
export class TokenPairResponseDto {
  @Expose({ name: 'access_token' })
  @ApiProperty({ name: 'access_token', description: 'JWT access token' })
  accessToken!: string;

  @Expose({ name: 'refresh_token' })
  @ApiProperty({ name: 'refresh_token', description: 'JWT refresh token' })
  refreshToken!: string;

  static from(pair: TokenPair): TokenPairResponseDto {
    const dto = new TokenPairResponseDto();
    dto.accessToken = pair.accessToken;
    dto.refreshToken = pair.refreshToken;
    return dto;
  }
}
```

`auth.controller.ts` — add imports (`UseGuards`, `JwtRefreshGuard`, `CurrentUser`, `JwtPayload` type, `RefreshTokenCommand`, `TokenPair` type, `TokenPairResponseDto`, `ApiBearerAuth`) and the method:

```typescript
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  @ApiResponse({ status: 200, type: TokenPairResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or revoked session' })
  async refresh(@CurrentUser() user: JwtPayload): Promise<TokenPairResponseDto> {
    const pair = await this.commandBus.execute<RefreshTokenCommand, TokenPair>(
      new RefreshTokenCommand(user.sub, user.tv),
    );
    return TokenPairResponseDto.from(pair);
  }
```

`auth.module.ts`: add `RefreshTokenHandler` to `CommandHandlers`.

- [ ] **Step 4: Run tests and lint**

Run: `cd apps/api && pnpm exec jest src/modules/auth && pnpm typecheck && pnpm lint`
Expected: PASS.

---

### Task 5: Change password revokes other sessions and returns a new pair

**Files:**
- Create: `apps/api/src/modules/auth/domain/events/password-changed.event.ts`
- Create: `apps/api/src/shared/domain/locale.ts`
- Modify: `apps/api/src/modules/auth/application/commands/change-password/change-password.command.ts`, `change-password.handler.ts`, `change-password.handler.spec.ts`
- Modify: `apps/api/src/modules/user/presentation/controllers/users.controller.ts`
- Modify: `apps/api/src/modules/user/presentation/dtos/change-password.request.dto.ts`

**Interfaces:**
- Consumes: `updatePasswordAndRevokeSessions` (Task 1), `generateTokenPair(userId, tokenVersion)` (Task 2), `TokenPairResponseDto` (Task 4).
- Produces:
  - `SUPPORTED_LOCALES = ['en', 'vi'] as const`, `type Locale`, `toLocale(value?: string): Locale` in `src/shared/domain/locale.ts`;
  - `ChangePasswordCommand(userId, oldPassword, newPassword, locale: Locale = 'en')` → `TokenPair`;
  - `PasswordChangedEvent(userId: string, email: string, locale: Locale, method: 'change' | 'reset')`.

- [ ] **Step 1: Write failing tests**

Replace the `beforeEach` and first test in `change-password.handler.spec.ts`, and add the event test:

```typescript
  let mockTokenService: jest.Mocked<ITokenService>;
  let mockEventBus: ReturnType<typeof createMockEventBus>;

  beforeEach(() => {
    mockCredentials = createMockAuthCredentialsRepository();
    mockHasher = createMockPasswordHasher();
    mockTokenService = createMockTokenService();
    mockEventBus = createMockEventBus();

    handler = new ChangePasswordHandler(
      createMockPinoLogger() as any,
      mockCredentials,
      mockHasher,
      mockTokenService,
      mockEventBus as any,
    );
  });

  it('stores the new hash, revokes sessions and returns a pair for the new version', async () => {
    mockCredentials.findByUserId.mockResolvedValue(
      createAuthCredentialRecord({ userId: 'user-1' }),
    );
    mockHasher.verify.mockResolvedValue(true);
    mockHasher.hash.mockResolvedValue('new-hash');
    mockCredentials.updatePasswordAndRevokeSessions.mockResolvedValue(5);

    const result = await handler.execute(
      new ChangePasswordCommand('user-1', 'oldPass1', 'newPassword1'),
    );

    expect(mockCredentials.updatePasswordAndRevokeSessions).toHaveBeenCalledWith(
      'user-1',
      'new-hash',
    );
    expect(mockTokenService.generateTokenPair).toHaveBeenCalledWith('user-1', 5);
    expect(result.accessToken).toBe('mock-access-token');
  });

  it('publishes PasswordChangedEvent with the request locale', async () => {
    mockCredentials.findByUserId.mockResolvedValue(
      createAuthCredentialRecord({ userId: 'user-1', email: 'a@example.com' }),
    );

    await handler.execute(
      new ChangePasswordCommand('user-1', 'oldPass1', 'newPassword1', 'vi'),
    );

    const event = mockEventBus.publish.mock.calls[0][0] as PasswordChangedEvent;
    expect(event).toBeInstanceOf(PasswordChangedEvent);
    expect(event).toMatchObject({
      userId: 'user-1',
      email: 'a@example.com',
      locale: 'vi',
      method: 'change',
    });
  });
```

Imports to add: `createMockTokenService`, `createMockEventBus`, `ITokenService` type, `PasswordChangedEvent` from `'../../../domain/events/password-changed.event'`. In the remaining tests replace `updatePasswordHash` with `updatePasswordAndRevokeSessions`.

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/api && pnpm exec jest src/modules/auth/application/commands/change-password`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/shared/domain/locale.ts`:

```typescript
export const SUPPORTED_LOCALES = ['en', 'vi'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function toLocale(value?: string): Locale {
  return SUPPORTED_LOCALES.includes(value as Locale) ? (value as Locale) : 'en';
}
```

`password-changed.event.ts`:

```typescript
import type { Locale } from '../../../../shared/domain/locale';

export class PasswordChangedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly locale: Locale,
    public readonly method: 'change' | 'reset',
  ) {}
}
```

`change-password.command.ts`:

```typescript
import type { Locale } from '../../../../../shared/domain/locale';

export class ChangePasswordCommand {
  constructor(
    public readonly userId: string,
    public readonly oldPassword: string,
    public readonly newPassword: string,
    public readonly locale: Locale = 'en',
  ) {}
}
```

`change-password.handler.ts` — implement `ICommandHandler<ChangePasswordCommand, TokenPair>`; add constructor params:

```typescript
    @Inject(TOKEN_SERVICE_TOKEN)
    private readonly tokenService: ITokenService,
    private readonly eventBus: EventBus,
```

(`EventBus` from `@nestjs/cqrs`) and replace the tail of `execute` (from `const newHash`) with:

```typescript
    const newHash = await this.passwordHasher.hash(command.newPassword);
    const tokenVersion =
      await this.credentialsRepo.updatePasswordAndRevokeSessions(
        command.userId,
        newHash,
      );
    const tokens = await this.tokenService.generateTokenPair(
      command.userId,
      tokenVersion,
    );

    this.eventBus.publish(
      new PasswordChangedEvent(
        command.userId,
        credential.email,
        command.locale,
        'change',
      ),
    );
    this.logger.info({ userId: command.userId }, 'Password changed');

    return tokens;
```

`change-password.request.dto.ts` — add:

```typescript
  @ApiProperty({ required: false, enum: SUPPORTED_LOCALES, default: 'en' })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: Locale;
```

(imports: `IsIn`, `IsOptional` from `class-validator`; `SUPPORTED_LOCALES`, `type Locale` from `'../../../../shared/domain/locale'`).

`users.controller.ts` — replace the `changePassword` method:

```typescript
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change current user password; revokes every other session',
  })
  @ApiResponse({ status: 200, type: TokenPairResponseDto })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordRequestDto,
  ): Promise<TokenPairResponseDto> {
    const pair = await this.commandBus.execute<ChangePasswordCommand, TokenPair>(
      new ChangePasswordCommand(
        user.sub,
        dto.old_password,
        dto.new_password,
        dto.locale ?? 'en',
      ),
    );
    return TokenPairResponseDto.from(pair);
  }
```

(imports: `TokenPair` type from the token service port, `TokenPairResponseDto` from `'../../../auth/presentation/dtos/token-pair.response.dto'`).

- [ ] **Step 4: Run unit tests**

Run: `cd apps/api && pnpm exec jest && pnpm typecheck && pnpm lint`
Expected: PASS.

---

### Task 6: E2E coverage for revocation and refresh

**Files:**
- Modify: `apps/api/test/e2e/users/profile.e2e-spec.ts`
- Create: `apps/api/test/e2e/auth/session.e2e-spec.ts`

**Interfaces:**
- Consumes: endpoints from Tasks 3–5.

- [ ] **Step 1: Update the existing change-password e2e**

In `profile.e2e-spec.ts`, replace the `'204 — changes password …'` test with:

```typescript
    it('200 — changes password, returns a working pair, revokes the old token', async () => {
      const newPassword = 'brandNewPass99';
      const oldToken = accessToken;

      const res = await request(app.getHttpServer())
        .post('/api/v1/users/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ old_password: currentPassword, new_password: newPassword });

      expect(res.status).toBe(200);
      expect(typeof res.body.data.access_token).toBe('string');
      expect(typeof res.body.data.refresh_token).toBe('string');

      const revoked = await request(app.getHttpServer())
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${oldToken}`);
      expect(revoked.status).toBe(401);
      expect(revoked.body.error).toBe('SESSION_REVOKED');

      accessToken = res.body.data.access_token as string;
      const fresh = await request(app.getHttpServer())
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(fresh.status).toBe(200);

      currentPassword = newPassword;
    });
```

- [ ] **Step 2: Write the session e2e**

`test/e2e/auth/session.e2e-spec.ts`:

```typescript
import type { INestApplication } from '@nestjs/common';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  cleanDatabase,
  disconnectDrizzle,
  setupDrizzleForTests,
  type TestDrizzleDb,
} from '../../helpers/drizzle-test-utils';
import { createTestApp } from '../../helpers/test-app-factory';
import { startPostgresContainer } from '../../helpers/testcontainers-setup';

describe('Sessions: refresh and revocation (e2e)', () => {
  let app: INestApplication<App>;
  let pgContainer: StartedPostgreSqlContainer;
  let db: TestDrizzleDb;

  const user = {
    email: 'session@example.com',
    username: 'sessionuser',
    password: 'securePass123',
  };

  async function login(password = user.password) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: user.email, password });
    return res.body.data as { access_token: string; refresh_token: string };
  }

  beforeAll(async () => {
    pgContainer = await startPostgresContainer();
    const dbUrl = pgContainer.getConnectionUri();
    db = await setupDrizzleForTests(dbUrl);
    app = await createTestApp({ DATABASE_URL: dbUrl });
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await disconnectDrizzle();
    await pgContainer?.stop();
  });

  beforeEach(async () => {
    await cleanDatabase(db);
    await request(app.getHttpServer()).post('/api/v1/auth/register').send(user);
  });

  it('refresh returns a pair that works on protected routes', async () => {
    const { refresh_token } = await login();

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Authorization', `Bearer ${refresh_token}`);

    expect(res.status).toBe(200);
    const profile = await request(app.getHttpServer())
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${res.body.data.access_token}`);
    expect(profile.status).toBe(200);
  });

  it('rejects an access token on /auth/refresh and a refresh token on protected routes', async () => {
    const { access_token, refresh_token } = await login();

    const refreshWithAccess = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Authorization', `Bearer ${access_token}`);
    const profileWithRefresh = await request(app.getHttpServer())
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${refresh_token}`);

    expect(refreshWithAccess.status).toBe(401);
    expect(profileWithRefresh.status).toBe(401);
  });

  it('changing the password revokes the refresh tokens of other sessions', async () => {
    const other = await login();
    const current = await login();

    await request(app.getHttpServer())
      .post('/api/v1/users/change-password')
      .set('Authorization', `Bearer ${current.access_token}`)
      .send({ old_password: user.password, new_password: 'anotherPass42' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Authorization', `Bearer ${other.refresh_token}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('SESSION_REVOKED');
  });
});
```

- [ ] **Step 3: Run e2e**

Run: `cd apps/api && pnpm exec jest --config ./test/jest-e2e.json --runInBand`
Expected: all suites PASS.

---

### Task 7: Web auto-refresh and revoked-session handling

**Files:**
- Create: `apps/web/src/utils/jwt.ts`, `apps/web/src/utils/jwt.test.ts`
- Modify: `apps/web/src/apis/auth-api.ts`, `apps/web/src/services/auth.service.ts`, `apps/web/src/services/auth.service.test.ts`
- Modify: `apps/web/src/services/next-auth.ts`, `apps/web/src/services/next-auth.test.ts`, `apps/web/src/types/next-auth.d.ts`
- Modify: `apps/web/src/proxy.ts`
- Modify: `apps/web/src/apis/base-http-client.ts`
- Modify: `apps/web/src/components/auth/login-form.tsx`, `apps/web/src/langs/en.json`, `apps/web/src/langs/vi.json`

**Interfaces:**
- Consumes: `POST /api/v1/auth/refresh` (Task 4).
- Produces:
  - `getJwtExpiry(token: string): number | null` (ms since epoch);
  - `authApi.refresh(refreshToken: string): Promise<ILoginData>`;
  - `authService.refresh(refreshToken: string): Promise<ILoginData>`;
  - JWT fields `accessTokenExpires?: number`, `error?: "RefreshFailed"`; `Session.error?: "RefreshFailed"`;
  - `export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth(authConfig)`;
  - jwt callback accepts `trigger === "update"` with `session.apiTokens: ILoginData`.

- [ ] **Step 1: Write failing tests**

`utils/jwt.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { getJwtExpiry } from "./jwt";

const encode = (payload: object) =>
	`h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;

describe("getJwtExpiry", () => {
	it("returns exp in milliseconds", () => {
		expect(getJwtExpiry(encode({ exp: 1_700_000_000 }))).toBe(1_700_000_000_000);
	});

	it("returns null for malformed tokens or a missing exp", () => {
		expect(getJwtExpiry("not-a-jwt")).toBeNull();
		expect(getJwtExpiry(encode({ sub: "1" }))).toBeNull();
	});
});
```

In `next-auth.test.ts`, change the auth service mock to
`vi.mock("@/services/auth.service", () => ({ authService: { login: vi.fn(), refresh: mockRefresh } }));`
with `const mockRefresh = vi.hoisted(() => vi.fn());` at the top, change `SIGNED_IN_USER.accessToken` to a token built by the same `encode` helper (`encode({ exp: 4_102_444_800 })`, year 2100), make the existing `jwt` assertions `await` the callback, and add:

```typescript
	it("refreshes the API tokens when the access token is about to expire", async () => {
		const fresh = encode({ exp: 4_102_444_800 });
		mockRefresh.mockResolvedValue({ access_token: fresh, refresh_token: "refresh-2" });

		const token = await authConfig.callbacks.jwt({
			token: { accessToken: "old", refreshToken: "refresh-1", accessTokenExpires: Date.now() + 10_000 },
		} as TJwtParams);

		expect(mockRefresh).toHaveBeenCalledWith("refresh-1");
		expect(token).toMatchObject({ accessToken: fresh, refreshToken: "refresh-2" });
		expect(token.error).toBeUndefined();
	});

	it("marks the session as failed and drops the tokens when refresh is rejected", async () => {
		mockRefresh.mockRejectedValue(new Error("401"));

		const token = await authConfig.callbacks.jwt({
			token: { accessToken: "old", refreshToken: "refresh-1", accessTokenExpires: Date.now() - 1 },
		} as TJwtParams);

		expect(token).toMatchObject({ error: "RefreshFailed" });
		expect(token.accessToken).toBeUndefined();
		expect(token.refreshToken).toBeUndefined();
	});

	it("does not retry refresh once it has failed", async () => {
		mockRefresh.mockClear();

		await authConfig.callbacks.jwt({ token: { error: "RefreshFailed" } } as TJwtParams);

		expect(mockRefresh).not.toHaveBeenCalled();
	});

	it("replaces the API tokens on a server-side session update", async () => {
		const fresh = encode({ exp: 4_102_444_800 });

		const token = await authConfig.callbacks.jwt({
			token: { accessToken: "old", refreshToken: "old-r" },
			trigger: "update",
			session: { apiTokens: { access_token: fresh, refresh_token: "new-r" } },
		} as unknown as TJwtParams);

		expect(token).toMatchObject({ accessToken: fresh, refreshToken: "new-r" });
		expect(token.accessTokenExpires).toBe(4_102_444_800_000);
	});

	it("exposes the refresh failure on the session", () => {
		const session = authConfig.callbacks.session({
			session: { user: {}, expires: "" } as Session,
			token: { error: "RefreshFailed" },
		} as unknown as TSessionParams) as Session;

		expect(session.error).toBe("RefreshFailed");
	});
```

(define `encode` as in `jwt.test.ts` at the top of the file.)

In `auth.service.test.ts`, add `refresh: (...args: unknown[]) => mockRefresh(...args)` to the `authApi` mock (`const mockRefresh = vi.fn();`) and:

```typescript
describe("AuthService.refresh", () => {
	it("returns the new pair from the API", async () => {
		mockRefresh.mockResolvedValue(TOKENS);
		await expect(new AuthService().refresh("refresh")).resolves.toEqual(TOKENS);
		expect(mockRefresh).toHaveBeenCalledWith("refresh");
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/web && pnpm exec vitest run src/utils/jwt.test.ts src/services`
Expected: FAIL.

- [ ] **Step 3: Implement**

`utils/jwt.ts`:

```typescript
/**
 * Reads the `exp` claim of a JWT without verifying it (the API verifies tokens).
 * @returns Expiry in milliseconds since epoch, or null when it cannot be read
 */
export function getJwtExpiry(token: string): number | null {
	const payload = token.split(".")[1];
	if (!payload) return null;
	try {
		const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
			exp?: unknown;
		};
		return typeof exp === "number" ? exp * 1000 : null;
	} catch {
		return null;
	}
}
```

`apis/auth-api.ts` — add:

```typescript
	/**
	 * Exchange a refresh token for a new token pair
	 */
	async refresh(refreshToken: string): Promise<ILoginData> {
		return this.post<ILoginData>(this.buildUrl("/refresh"), undefined, {
			headers: { Authorization: `Bearer ${refreshToken}` },
		});
	}
```

Check `BaseHttpClient.post`'s signature first (`grep -n "protected async post" src/apis/base-http-client.ts`); if it is `post<T>(url, json?, options?)` the call above is correct, otherwise pass `{ headers }` in the shape it takes.

`services/auth.service.ts` — add:

```typescript
	/**
	 * Exchanges a refresh token for a new API token pair
	 * @throws {HttpStatusError} 401 when the session is revoked or expired
	 */
	async refresh(refreshToken: string): Promise<ILoginData> {
		return authApi.refresh(refreshToken);
	}
```

(import `ILoginData` from `@/types/auth`).

`types/next-auth.d.ts` — add `error?: "RefreshFailed";` to `Session` and a JWT augmentation:

```typescript
declare module "next-auth/jwt" {
	interface JWT {
		accessTokenExpires?: number;
		error?: "RefreshFailed";
	}
}
```

`services/next-auth.ts` — replace the `jwt` and `session` callbacks and the export:

```typescript
		async jwt({ token, user, trigger, session }) {
			// `user` is only set on sign-in: keep the API tokens in the encrypted JWT cookie
			if (user) {
				token.id = user.id;
				token.username = user.username;
				token.accessToken = user.accessToken;
				token.refreshToken = user.refreshToken;
				token.accessTokenExpires = user.accessToken
					? (getJwtExpiry(user.accessToken) ?? undefined)
					: undefined;
				return token;
			}

			// Server-side unstable_update() after a password change hands over the new pair
			const apiTokens = (session as { apiTokens?: ILoginData } | undefined)?.apiTokens;
			if (trigger === "update" && apiTokens) {
				return withApiTokens(token, apiTokens);
			}

			if (token.error || !token.refreshToken) {
				return token;
			}
			if (token.accessTokenExpires && Date.now() < token.accessTokenExpires - REFRESH_MARGIN_MS) {
				return token;
			}

			try {
				return withApiTokens(token, await authService.refresh(token.refreshToken as string));
			} catch {
				// Revoked or expired session: drop the tokens so nothing retries with them
				return {
					...token,
					accessToken: undefined,
					refreshToken: undefined,
					accessTokenExpires: undefined,
					error: "RefreshFailed" as const,
				};
			}
		},
		session({ session, token }) {
			// Expose what the API client needs; the refresh token stays server-side
			session.accessToken = token.accessToken as string | undefined;
			session.error = token.error;
			if (typeof token.id === "string") {
				session.user.id = token.id;
			}
			if (typeof token.username === "string") {
				session.user.username = token.username;
			}
			return session;
		},
```

with, above `authConfig`:

```typescript
// Refresh a minute early so a request never leaves with an access token that expires in flight
const REFRESH_MARGIN_MS = 60_000;

const withApiTokens = (token: JWT, tokens: ILoginData): JWT => ({
	...token,
	accessToken: tokens.access_token,
	refreshToken: tokens.refresh_token,
	accessTokenExpires: getJwtExpiry(tokens.access_token) ?? undefined,
	error: undefined,
});
```

imports: `import type { JWT } from "next-auth/jwt";`, `import type { ILoginData } from "@/types/auth";`, `import { getJwtExpiry } from "@/utils/jwt";`, and

```typescript
export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth(authConfig);
```

`proxy.ts` — replace `const isLoggedIn = !!request.auth?.user;` with:

```typescript
	// A failed refresh leaves a cookie without usable API tokens: treat it as signed out
	const sessionExpired = request.auth?.error === "RefreshFailed";
	const isLoggedIn = !!request.auth?.user && !sessionExpired;
```

and in the private-route redirect add `if (sessionExpired) loginUrl.searchParams.set("reason", "session_expired");` before `return NextResponse.redirect(loginUrl);`.

`apis/base-http-client.ts` — in the `afterResponse` hook, before `throw new HttpStatusError(...)`:

```typescript
							// The API revoked this session (password changed or reset elsewhere)
							if (
								typeof window !== "undefined" &&
								response.status === 401 &&
								(errorData as { error?: string }).error === "SESSION_REVOKED"
							) {
								const locale = window.location.pathname.split("/")[1] || "en";
								await signOut({ callbackUrl: `/${locale}/login?reason=session_expired` });
							}
```

(import `signOut` alongside `getSession` from `next-auth/react`.)

`components/auth/login-form.tsx` — render a banner from `?reason=` above the form fields. Add inside `<CardContent>` before `<Form>`:

```tsx
				{reason && LOGIN_REASONS.includes(reason as TLoginReason) && (
					<div
						role="status"
						className="mb-4 rounded-md bg-muted p-3 text-muted-foreground text-sm"
					>
						{t(`reasons.${reason}`)}
					</div>
				)}
```

with, near the top of the component, `const reason = searchParams.get("reason");` and at module level:

```tsx
const LOGIN_REASONS = ["session_expired", "password_reset"] as const;
type TLoginReason = (typeof LOGIN_REASONS)[number];
```

`langs/en.json` → `pages.login.reasons`:

```json
"reasons": {
	"session_expired": "Your session has ended. Please sign in again.",
	"password_reset": "Your password has been reset. Sign in with your new password."
}
```

`langs/vi.json` → `pages.login.reasons`:

```json
"reasons": {
	"session_expired": "Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.",
	"password_reset": "Mật khẩu đã được đặt lại. Hãy đăng nhập bằng mật khẩu mới."
}
```

- [ ] **Step 4: Run tests, lint, typecheck**

Run: `cd apps/web && pnpm exec vitest run && pnpm lint && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Manual check**

With `mise run local:docker:up:api` and `pnpm dev:web`, sign in at `http://localhost:3000/en/login`; in another terminal bump the version to simulate a revocation:
`docker compose exec -T postgres psql -U postgres -d fullstack_monorepo_dev -c "update auth_credentials set token_version = token_version + 1 where email = 'admin@example.com';"`.
Wait for the access token to near expiry (or set `JWT_ACCESS_EXPIRES_IN=2m` in your own local shell environment when starting the API) and reload `/en/dashboard`.
Expected: redirect to `/en/login?reason=session_expired` with the banner.

---

# Phase 2 — Mail infrastructure

### Task 8: Mail ports and templates

**Files:**
- Create: `apps/api/src/shared/application/ports/mail.interface.ts`
- Create: `apps/api/src/shared/infrastructure/mail/templates/escape-html.ts`
- Create: `apps/api/src/shared/infrastructure/mail/templates/layout.ts`
- Create: `apps/api/src/shared/infrastructure/mail/templates/password-reset.ts`
- Create: `apps/api/src/shared/infrastructure/mail/templates/password-changed.ts`
- Create: `apps/api/src/shared/infrastructure/mail/templates/index.ts`
- Test: `apps/api/src/shared/infrastructure/mail/templates/templates.spec.ts`

**Interfaces:**
- Consumes: `Locale`, `toLocale` (Task 5).
- Produces (`mail.interface.ts`):

```typescript
import type { Locale } from '../../domain/locale';

export const MAIL_SENDER_TOKEN = Symbol('IMailSender');
export const MAIL_SERVICE_TOKEN = Symbol('IMailService');

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Transport: delivers an already-rendered message (SES, SMTP). */
export interface IMailSender {
  send(message: MailMessage): Promise<void>;
}

export interface MailTemplateParams {
  'password-reset': { resetUrl: string; ttlMinutes: number };
  'password-changed': {
    method: 'change' | 'reset';
    forgotPasswordUrl: string;
  };
}

export type MailTemplateName = keyof MailTemplateParams;

/** Renders a template in the given locale and sends it. */
export interface IMailService {
  sendTemplate<T extends MailTemplateName>(
    to: string,
    template: T,
    locale: Locale,
    params: MailTemplateParams[T],
  ): Promise<void>;
}
```

- `renderTemplate<T extends MailTemplateName>(template: T, locale: string, params: MailTemplateParams[T]): RenderedMail` from `templates/index.ts`, where `RenderedMail = Omit<MailMessage, 'to'>`.

- [ ] **Step 1: Write the failing test**

`templates.spec.ts`:

```typescript
import { renderTemplate } from './index';

describe('mail templates', () => {
  it('renders the reset email in Vietnamese with the link and expiry', () => {
    const mail = renderTemplate('password-reset', 'vi', {
      resetUrl: 'https://app.example.com/vi/reset-password?token=abc',
      ttlMinutes: 30,
    });

    expect(mail.subject).toBe('Đặt lại mật khẩu');
    expect(mail.html).toContain(
      'href="https://app.example.com/vi/reset-password?token=abc"',
    );
    expect(mail.text).toContain('30');
  });

  it('falls back to English for an unknown locale', () => {
    const mail = renderTemplate('password-reset', 'fr', {
      resetUrl: 'https://x.test/r',
      ttlMinutes: 30,
    });

    expect(mail.subject).toBe('Reset your password');
  });

  it('escapes interpolated values in HTML', () => {
    const mail = renderTemplate('password-reset', 'en', {
      resetUrl: 'https://x.test/r?a=1&b="><script>',
      ttlMinutes: 30,
    });

    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&amp;b=&quot;&gt;&lt;script&gt;');
  });

  it('words the changed email by method', () => {
    const changed = renderTemplate('password-changed', 'en', {
      method: 'change',
      forgotPasswordUrl: 'https://x.test/en/forgot-password',
    });
    const reset = renderTemplate('password-changed', 'en', {
      method: 'reset',
      forgotPasswordUrl: 'https://x.test/en/forgot-password',
    });

    expect(changed.text).toContain('changed');
    expect(reset.text).toContain('reset');
    expect(changed.html).toContain('https://x.test/en/forgot-password');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/api && pnpm exec jest src/shared/infrastructure/mail`
Expected: FAIL — cannot find module `./index`.

- [ ] **Step 3: Implement**

`escape-html.ts`:

```typescript
const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ENTITIES[char]);
}
```

`layout.ts`:

```typescript
import { escapeHtml } from './escape-html';

/** Minimal inline-styled wrapper; every argument is escaped here. */
export function htmlLayout(options: {
  heading: string;
  paragraphs: string[];
  action?: { label: string; url: string };
}): string {
  const paragraphs = options.paragraphs
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p)}</p>`)
    .join('');
  const action = options.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(options.action.url)}" style="background:#0f766e;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">${escapeHtml(options.action.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1f2937;max-width:560px;margin:0 auto;padding:24px"><h1 style="font-size:20px">${escapeHtml(options.heading)}</h1>${paragraphs}${action}</body></html>`;
}
```

`password-reset.ts`:

```typescript
import type { MailTemplateParams } from '../../../application/ports/mail.interface';
import type { Locale } from '../../../domain/locale';
import { htmlLayout } from './layout';
import type { RenderedMail } from './index';

const COPY = {
  en: {
    subject: 'Reset your password',
    intro: 'We received a request to reset the password for your account.',
    expiry: (m: number) => `This link expires in ${m} minutes and works once.`,
    ignore: 'If you did not ask for this, ignore this email; your password stays the same.',
    action: 'Reset password',
  },
  vi: {
    subject: 'Đặt lại mật khẩu',
    intro: 'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.',
    expiry: (m: number) => `Link có hiệu lực trong ${m} phút và chỉ dùng được một lần.`,
    ignore: 'Nếu bạn không yêu cầu, hãy bỏ qua email này; mật khẩu của bạn không đổi.',
    action: 'Đặt lại mật khẩu',
  },
} satisfies Record<Locale, unknown>;

export function passwordReset(
  locale: Locale,
  params: MailTemplateParams['password-reset'],
): RenderedMail {
  const c = COPY[locale];
  const lines = [c.intro, c.expiry(params.ttlMinutes), c.ignore];
  return {
    subject: c.subject,
    html: htmlLayout({
      heading: c.subject,
      paragraphs: lines,
      action: { label: c.action, url: params.resetUrl },
    }),
    text: [c.intro, '', params.resetUrl, '', c.expiry(params.ttlMinutes), c.ignore].join('\n'),
  };
}
```

`password-changed.ts`:

```typescript
import type { MailTemplateParams } from '../../../application/ports/mail.interface';
import type { Locale } from '../../../domain/locale';
import { htmlLayout } from './layout';
import type { RenderedMail } from './index';

const COPY = {
  en: {
    subject: 'Your password was changed',
    body: {
      change: 'The password for your account was just changed.',
      reset: 'The password for your account was just reset using a reset link.',
    },
    notYou: 'If this was not you, reset your password now and review your account.',
    action: 'Reset password',
  },
  vi: {
    subject: 'Mật khẩu của bạn đã được thay đổi',
    body: {
      change: 'Mật khẩu tài khoản của bạn vừa được thay đổi (changed).',
      reset: 'Mật khẩu tài khoản của bạn vừa được đặt lại qua link (reset).',
    },
    notYou: 'Nếu không phải bạn, hãy đặt lại mật khẩu ngay và kiểm tra tài khoản.',
    action: 'Đặt lại mật khẩu',
  },
} satisfies Record<Locale, unknown>;

export function passwordChanged(
  locale: Locale,
  params: MailTemplateParams['password-changed'],
): RenderedMail {
  const c = COPY[locale];
  const body = c.body[params.method];
  return {
    subject: c.subject,
    html: htmlLayout({
      heading: c.subject,
      paragraphs: [body, c.notYou],
      action: { label: c.action, url: params.forgotPasswordUrl },
    }),
    text: [body, '', c.notYou, params.forgotPasswordUrl].join('\n'),
  };
}
```

`templates/index.ts`:

```typescript
import type {
  MailMessage,
  MailTemplateName,
  MailTemplateParams,
} from '../../../application/ports/mail.interface';
import { type Locale, toLocale } from '../../../domain/locale';
import { passwordChanged } from './password-changed';
import { passwordReset } from './password-reset';

export type RenderedMail = Omit<MailMessage, 'to'>;

const RENDERERS: {
  [T in MailTemplateName]: (
    locale: Locale,
    params: MailTemplateParams[T],
  ) => RenderedMail;
} = {
  'password-reset': passwordReset,
  'password-changed': passwordChanged,
};

export function renderTemplate<T extends MailTemplateName>(
  template: T,
  locale: string,
  params: MailTemplateParams[T],
): RenderedMail {
  return RENDERERS[template](toLocale(locale), params);
}
```

- [ ] **Step 4: Run tests and lint**

Run: `cd apps/api && pnpm exec jest src/shared/infrastructure/mail && pnpm lint && pnpm typecheck`
Expected: PASS. Run `pnpm exec biome check --write src/shared` if the formatter reflows long string lines.

---

### Task 9: Mail adapters, `MailService`, `MailModule`, Mailpit

**Files:**
- Modify: `apps/api/package.json` (dependencies)
- Create: `apps/api/src/shared/infrastructure/mail/smtp-mail-sender.ts`
- Create: `apps/api/src/shared/infrastructure/mail/ses-mail-sender.ts`
- Create: `apps/api/src/shared/infrastructure/mail/mail.service.ts`, `mail.service.spec.ts`
- Create: `apps/api/src/shared/infrastructure/mail/mail.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/.env.example`
- Create: `apps/api/test/helpers/mailpit-setup.ts`
- Test: `apps/api/test/integration/mail/smtp-mail-sender.integration.spec.ts`
- Modify: `docker-compose.yml`, `docker-compose.override.yml`, `mise/tasks/local/docker/up/api`, `README.md`, `docs/AGENT_INSTALL.md`

**Interfaces:**
- Consumes: ports and `renderTemplate` (Task 8).
- Produces: `MailModule` (global) exporting `MAIL_SENDER_TOKEN` and `MAIL_SERVICE_TOKEN`; `MailService implements IMailService`; `SmtpMailSender(options: { host: string; port: number; from: string })`; `SesMailSender(options: { region?: string; from: string; configurationSet?: string })`.

- [ ] **Step 1: Add dependencies**

Run: `cd apps/api && pnpm add @aws-sdk/client-sesv2 nodemailer && pnpm add -D @types/nodemailer`
Expected: `package.json` and root `pnpm-lock.yaml` updated.

- [ ] **Step 2: Write failing tests**

`mail.service.spec.ts`:

```typescript
import type { IMailSender } from '../../application/ports/mail.interface';
import { MailService } from './mail.service';

describe('MailService', () => {
  it('renders the template and sends it to the recipient', async () => {
    const sender: jest.Mocked<IMailSender> = { send: jest.fn() };
    const service = new MailService(sender);

    await service.sendTemplate('a@example.com', 'password-reset', 'en', {
      resetUrl: 'https://x.test/r',
      ttlMinutes: 30,
    });

    expect(sender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'a@example.com',
        subject: 'Reset your password',
      }),
    );
  });
});
```

`test/helpers/mailpit-setup.ts`:

```typescript
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';

export const MAILPIT_IMAGE = 'axllent/mailpit:v1.27';

export async function startMailpit(): Promise<StartedTestContainer> {
  return new GenericContainer(MAILPIT_IMAGE)
    .withExposedPorts(1025, 8025)
    .withWaitStrategy(Wait.forHttp('/livez', 8025))
    .start();
}

export async function listMessages(
  mailpit: StartedTestContainer,
): Promise<Array<{ ID: string; Subject: string; To: Array<{ Address: string }> }>> {
  const url = `http://${mailpit.getHost()}:${mailpit.getMappedPort(8025)}/api/v1/messages`;
  const res = await fetch(url);
  const body = (await res.json()) as {
    messages: Array<{ ID: string; Subject: string; To: Array<{ Address: string }> }>;
  };
  return body.messages;
}
```

Verify the tag exists before relying on it: `docker pull axllent/mailpit:v1.27`. If it does not, use the newest `v1.x` tag from `docker search`/Docker Hub that is at least two weeks old, and use the same tag in `docker-compose.yml` below.

`test/integration/mail/smtp-mail-sender.integration.spec.ts`:

```typescript
import type { StartedTestContainer } from 'testcontainers';
import { SmtpMailSender } from '../../../src/shared/infrastructure/mail/smtp-mail-sender';
import { listMessages, startMailpit } from '../../helpers/mailpit-setup';

describe('SmtpMailSender (integration)', () => {
  let mailpit: StartedTestContainer;

  beforeAll(async () => {
    mailpit = await startMailpit();
  }, 60_000);

  afterAll(async () => {
    await mailpit?.stop();
  });

  it('delivers a message to Mailpit', async () => {
    const sender = new SmtpMailSender({
      host: mailpit.getHost(),
      port: mailpit.getMappedPort(1025),
      from: 'App <no-reply@localhost>',
    });

    await sender.send({
      to: 'someone@example.com',
      subject: 'Hello from the test',
      html: '<p>hi</p>',
      text: 'hi',
    });

    const messages = await listMessages(mailpit);
    expect(messages[0].Subject).toBe('Hello from the test');
    expect(messages[0].To[0].Address).toBe('someone@example.com');
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `cd apps/api && pnpm exec jest src/shared/infrastructure/mail/mail.service.spec.ts && pnpm exec jest --config ./test/integration/jest-integration.json test/integration/mail`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement**

`smtp-mail-sender.ts`:

```typescript
import { createTransport, type Transporter } from 'nodemailer';
import type {
  IMailSender,
  MailMessage,
} from '../../application/ports/mail.interface';

export class SmtpMailSender implements IMailSender {
  private readonly transport: Transporter;

  constructor(private readonly options: { host: string; port: number; from: string }) {
    // Mailpit and similar dev servers: no TLS, no auth
    this.transport = createTransport({
      host: options.host,
      port: options.port,
      secure: false,
      ignoreTLS: true,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({ from: this.options.from, ...message });
  }
}
```

`ses-mail-sender.ts`:

```typescript
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type {
  IMailSender,
  MailMessage,
} from '../../application/ports/mail.interface';

export class SesMailSender implements IMailSender {
  // Credentials and AWS_ENDPOINT_URL come from the SDK default chain (IRSA on EKS)
  private readonly client: SESv2Client;

  constructor(
    private readonly options: {
      region?: string;
      from: string;
      configurationSet?: string;
    },
  ) {
    this.client = new SESv2Client({ region: options.region });
  }

  async send(message: MailMessage): Promise<void> {
    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.options.from,
        Destination: { ToAddresses: [message.to] },
        ConfigurationSetName: this.options.configurationSet,
        Content: {
          Simple: {
            Subject: { Data: message.subject, Charset: 'UTF-8' },
            Body: {
              Html: { Data: message.html, Charset: 'UTF-8' },
              Text: { Data: message.text, Charset: 'UTF-8' },
            },
          },
        },
      }),
    );
  }
}
```

`mail.service.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import {
  type IMailSender,
  type IMailService,
  MAIL_SENDER_TOKEN,
  type MailTemplateName,
  type MailTemplateParams,
} from '../../application/ports/mail.interface';
import type { Locale } from '../../domain/locale';
import { renderTemplate } from './templates';

@Injectable()
export class MailService implements IMailService {
  constructor(@Inject(MAIL_SENDER_TOKEN) private readonly sender: IMailSender) {}

  async sendTemplate<T extends MailTemplateName>(
    to: string,
    template: T,
    locale: Locale,
    params: MailTemplateParams[T],
  ): Promise<void> {
    await this.sender.send({ to, ...renderTemplate(template, locale, params) });
  }
}
```

`mail.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type IMailSender,
  MAIL_SENDER_TOKEN,
  MAIL_SERVICE_TOKEN,
} from '../../application/ports/mail.interface';
import { MailService } from './mail.service';
import { SesMailSender } from './ses-mail-sender';
import { SmtpMailSender } from './smtp-mail-sender';

@Global()
@Module({
  providers: [
    {
      provide: MAIL_SENDER_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService): IMailSender => {
        const from = config.get<string>('MAIL_FROM', 'App <no-reply@localhost>');
        if (config.get<string>('MAIL_TRANSPORT', 'smtp') === 'ses') {
          return new SesMailSender({
            region: config.get<string>('AWS_REGION'),
            from,
            configurationSet: config.get<string>('SES_CONFIGURATION_SET'),
          });
        }
        return new SmtpMailSender({
          host: config.get<string>('SMTP_HOST', 'localhost'),
          port: Number(config.get<string>('SMTP_PORT', '1025')),
          from,
        });
      },
    },
    MailService,
    { provide: MAIL_SERVICE_TOKEN, useExisting: MailService },
  ],
  exports: [MAIL_SENDER_TOKEN, MAIL_SERVICE_TOKEN],
})
export class MailModule {}
```

`app.module.ts`: import `MailModule` from `'./shared/infrastructure/mail/mail.module'` and add it after `MetricsModule`.

`apps/api/.env.example` — append:

```
MAIL_TRANSPORT=smtp
MAIL_FROM="FullStack Monorepo <no-reply@localhost>"
SMTP_HOST=localhost
SMTP_PORT=1025
WEB_APP_URL=http://localhost:3000
PASSWORD_RESET_TTL_MINUTES=30
# SES (MAIL_TRANSPORT=ses): AWS_REGION, SES_CONFIGURATION_SET; credentials from the AWS default chain
```

- [ ] **Step 5: Add Mailpit to Compose**

`docker-compose.yml` — new service (use the tag verified in Step 2):

```yaml
  mailpit:
    image: axllent/mailpit:v1.27
```

and replace the `api` service's `environment` and `depends_on` blocks with:

```yaml
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-password}@postgres:5432/${POSTGRES_DB:-fullstack_monorepo_dev}
      # Inside the network the api always listens on 8000; the host port is
      # API_PORT from the shell (see the override file).
      API_PORT: 8000
      # No collector runs in this stack; export OTEL_SDK_DISABLED=false and
      # point OTEL_EXPORTER_OTLP_ENDPOINT at one to send telemetry.
      OTEL_SDK_DISABLED: ${OTEL_SDK_DISABLED:-true}
      SMTP_HOST: mailpit
      SMTP_PORT: 1025
    depends_on:
      postgres:
        condition: service_healthy
      mailpit:
        condition: service_started
```

(keep the existing `healthcheck` block unchanged; compare with the current file before editing, since earlier work may have added keys).

`docker-compose.override.yml` — new service block:

```yaml
  mailpit:
    ports:
      - "1025:1025"
      - "8025:8025"
```

`mise/tasks/local/docker/up/api`: change the service list to `postgres api mailpit`, and the description to `"Build & start api + postgres + mailpit"`.

`README.md` and `docs/AGENT_INSTALL.md` §B Step 4: add one line — "Outgoing email is captured by Mailpit: http://localhost:8025".

- [ ] **Step 6: Run tests and the stack**

Run: `cd apps/api && pnpm exec jest src/shared && pnpm exec jest --config ./test/integration/jest-integration.json test/integration/mail && pnpm lint && pnpm typecheck`
Expected: PASS.

Run: `mise run local:docker:up:api && curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8025/livez`
Expected: `200`.

---

### Task 10: SES infrastructure (Terraform, IRSA, Helm, LocalStack)

**Files:**
- Create: `infra/terraform/modules/ses/main.tf`, `variables.tf`, `outputs.tf`
- Modify: `infra/terraform/modules/iam/main.tf`, `variables.tf`
- Modify: `infra/terraform/modules/codebuild/main.tf`, `variables.tf`
- Modify: `infra/terraform/envs/staging/main.tf`, `variables.tf`, `terraform.tfvars`; same for `envs/prod`
- Modify: `infra/codebuild/buildspec-helm-deploy.yml`
- Modify: `infra/helm/api/values-staging.yaml`, `values-prod.yaml`, `values-dev.yaml`
- Modify: `infra/scripts/localstack-init.sh`
- Modify: `docs/infrastructure.md`

**Interfaces:**
- Produces: module `ses` outputs `identity_arn`, `configuration_set_name`, `configuration_set_arn`; `iam` variables `ses_identity_arns: list(string)`, `ses_configuration_set_arn: string`, `ses_from_address: string`; codebuild variable `app_pod_role_arn: string` → env `APP_POD_ROLE_ARN`.

- [ ] **Step 1: Write the module**

`modules/ses/variables.tf`:

```hcl
variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "domain_name" {
  description = "Sending domain"
  type        = string
}

variable "zone_id" {
  description = "Route53 zone that holds the domain's records"
  type        = string
}

variable "dmarc_report_email" {
  description = "Mailbox that receives DMARC aggregate reports"
  type        = string
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
```

`modules/ses/main.tf`:

```hcl
resource "aws_sesv2_configuration_set" "main" {
  configuration_set_name = "${var.project_name}-${var.environment}"

  reputation_options {
    reputation_metrics_enabled = true
  }

  suppression_options {
    suppressed_reasons = ["BOUNCE", "COMPLAINT"]
  }

  tags = var.tags
}

resource "aws_sesv2_email_identity" "domain" {
  email_identity         = var.domain_name
  configuration_set_name = aws_sesv2_configuration_set.main.configuration_set_name
  tags                   = var.tags
}

resource "aws_route53_record" "dkim" {
  count = 3

  zone_id = var.zone_id
  name    = "${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 1800
  records = ["${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}

resource "aws_sesv2_email_identity_mail_from_attributes" "domain" {
  email_identity         = aws_sesv2_email_identity.domain.email_identity
  mail_from_domain       = "mail.${var.domain_name}"
  behavior_on_mx_failure = "USE_DEFAULT_VALUE"
}

data "aws_region" "current" {}

resource "aws_route53_record" "mail_from_mx" {
  zone_id = var.zone_id
  name    = "mail.${var.domain_name}"
  type    = "MX"
  ttl     = 1800
  records = ["10 feedback-smtp.${data.aws_region.current.name}.amazonses.com"]
}

resource "aws_route53_record" "mail_from_spf" {
  zone_id = var.zone_id
  name    = "mail.${var.domain_name}"
  type    = "TXT"
  ttl     = 1800
  records = ["v=spf1 include:amazonses.com ~all"]
}

resource "aws_route53_record" "dmarc" {
  zone_id = var.zone_id
  name    = "_dmarc.${var.domain_name}"
  type    = "TXT"
  ttl     = 1800
  records = ["v=DMARC1; p=none; rua=mailto:${var.dmarc_report_email}"]
}
```

`modules/ses/outputs.tf`:

```hcl
output "identity_arn" {
  description = "SES domain identity ARN"
  value       = aws_sesv2_email_identity.domain.arn
}

output "configuration_set_name" {
  description = "SES configuration set name"
  value       = aws_sesv2_configuration_set.main.configuration_set_name
}

output "configuration_set_arn" {
  description = "SES configuration set ARN"
  value       = aws_sesv2_configuration_set.main.arn
}
```

- [ ] **Step 2: IAM policy for app pods**

`modules/iam/variables.tf` — append:

```hcl
variable "ses_identity_arns" {
  description = "SES identities the app pods may send from (empty disables the policy)"
  type        = list(string)
  default     = []
}

variable "ses_configuration_set_arn" {
  description = "SES configuration set used by the app pods"
  type        = string
  default     = ""
}

variable "ses_from_address" {
  description = "Only sender address the app pods may use"
  type        = string
  default     = ""
}
```

`modules/iam/main.tf` — append after `app_pod_s3`:

```hcl
data "aws_iam_policy_document" "app_pod_ses" {
  count = length(var.ses_identity_arns) > 0 ? 1 : 0

  statement {
    actions   = ["ses:SendEmail", "ses:SendRawEmail"]
    resources = concat(var.ses_identity_arns, [var.ses_configuration_set_arn])

    condition {
      test     = "StringEquals"
      variable = "ses:FromAddress"
      values   = [var.ses_from_address]
    }
  }
}

resource "aws_iam_role_policy" "app_pod_ses" {
  count = length(var.ses_identity_arns) > 0 && var.eks_oidc_provider_arn != "" ? 1 : 0

  name   = "${var.project_name}-${var.environment}-app-pod-ses"
  role   = aws_iam_role.app_pod[0].id
  policy = data.aws_iam_policy_document.app_pod_ses[0].json
}
```

- [ ] **Step 3: Pass the pod role to the deploy build**

`modules/codebuild/variables.tf` — append:

```hcl
variable "app_pod_role_arn" {
  description = "IRSA role ARN annotated on the api service account"
  type        = string
  default     = ""
}
```

`modules/codebuild/main.tf` — in the Helm deploy project's `environment` block (the one around line 152 that sets `LB_CONTROLLER_ROLE_ARN` next to `secret_env_vars`), add:

```hcl
    environment_variable {
      name  = "APP_POD_ROLE_ARN"
      value = var.app_pod_role_arn
    }
```

`infra/codebuild/buildspec-helm-deploy.yml`, `helm upgrade --install api …` — add after the `image.tag` line:

```yaml
          --set-string "serviceAccount.annotations.eks\.amazonaws\.com/role-arn=${APP_POD_ROLE_ARN}" \
```

- [ ] **Step 4: Wire the environments**

For both `envs/staging` and `envs/prod`:

`variables.tf` — append:

```hcl
variable "dmarc_report_email" {
  description = "Mailbox for DMARC aggregate reports"
  type        = string
}
```

`terraform.tfvars` — append `dmarc_report_email = "dmarc@example.com"` (same placeholder style as the existing `domain_name = "example.com"`; the real value is set per deployment).

`main.tf` — add after `module "route53"`:

```hcl
module "ses" {
  source = "../../modules/ses"

  project_name       = var.project_name
  environment        = var.environment
  domain_name        = var.domain_name
  zone_id            = module.route53.zone_id
  dmarc_report_email = var.dmarc_report_email
  tags               = local.common_tags
}
```

in `module "iam"` add:

```hcl
  ses_identity_arns         = [module.ses.identity_arn]
  ses_configuration_set_arn = module.ses.configuration_set_arn
  ses_from_address          = "no-reply@${var.domain_name}"
```

in `module "codebuild"` add `app_pod_role_arn = module.iam.app_pod_role_arn`.

- [ ] **Step 5: Helm values**

`values-staging.yaml` `env:` (use the file's existing example domain):

```yaml
  MAIL_TRANSPORT: ses
  MAIL_FROM: "FullStack Monorepo <no-reply@staging.example.com>"
  SES_CONFIGURATION_SET: fullstack-monorepo-staging
  AWS_REGION: ap-southeast-1
  WEB_APP_URL: https://staging.example.com
```

`values-prod.yaml` `env:`:

```yaml
  MAIL_TRANSPORT: ses
  MAIL_FROM: "FullStack Monorepo <no-reply@example.com>"
  SES_CONFIGURATION_SET: fullstack-monorepo-prod
  AWS_REGION: ap-southeast-1
  WEB_APP_URL: https://example.com
```

Check `infra/terraform/envs/staging/terraform.tfvars` for the staging `domain_name`; `MAIL_FROM` must use that domain because the IAM condition pins `no-reply@<domain_name>`.

`values-dev.yaml` `env:`:

```yaml
  MAIL_TRANSPORT: ses
  MAIL_FROM: "FullStack Monorepo <no-reply@example.com>"
  AWS_REGION: us-east-1
  AWS_ENDPOINT_URL: http://host.docker.internal:4566
  WEB_APP_URL: http://localhost:3000
```

and `secrets:` add `AWS_ACCESS_KEY_ID: test` and `AWS_SECRET_ACCESS_KEY: test` (LocalStack dummy credentials).

- [ ] **Step 6: LocalStack**

`infra/scripts/localstack-init.sh` — add `ses` to `-e SERVICES=…`, and after LocalStack is healthy:

```bash
aws --endpoint-url "$LOCALSTACK_ENDPOINT" --region us-east-1 sesv2 create-email-identity \
  --email-identity example.com >/dev/null 2>&1 || true
```

- [ ] **Step 7: Document**

`docs/infrastructure.md` — add a section "Email (SES)":

```markdown
## Email (SES)

`infra/terraform/modules/ses` creates the domain identity (Easy DKIM), the
custom MAIL FROM domain `mail.<domain>`, SPF and DMARC (`p=none`) records in
the Route53 zone, and a configuration set with bounce/complaint suppression.
API pods send through IRSA (`app_pod` role, `ses:FromAddress` pinned to
`no-reply@<domain>`).

Manual steps per region and environment:

1. Request SES production access (Console → SES → Account dashboard). Until
   then SES delivers only to verified addresses.
2. If the domain's DNS is not hosted on Route53, copy the DKIM, MAIL FROM and
   DMARC records from `terraform output` into your DNS provider.
3. Watch bounce and complaint rates on the SES account dashboard; there is no
   alerting yet. Raise DMARC to `p=quarantine` once reports are clean.

Locally, mail goes to Mailpit (`http://localhost:8025`); in the kind cluster
it goes to LocalStack (`GET http://localhost:4566/_aws/ses`).
```

- [ ] **Step 8: Validate**

Run: `cd infra/terraform/envs/staging && terraform init -backend=false -input=false >/dev/null && terraform validate` and the same in `envs/prod`.
Expected: `Success! The configuration is valid.`

Run: `helm lint infra/helm/api -f infra/helm/api/values-staging.yaml && helm lint infra/helm/api -f infra/helm/api/values-dev.yaml`
Expected: `1 chart(s) linted, 0 chart(s) failed`.

If `terraform` is not installed, run it through mise (`mise exec terraform -- terraform validate`) or report the step as not run.

---

# Phase 3 — Forgot / reset password API

### Task 11: `password_reset_tokens` table and repository

**Files:**
- Create: `apps/api/src/shared/infrastructure/database/schema/password-reset-tokens.table.ts`
- Modify: `apps/api/src/shared/infrastructure/database/schema/index.ts`
- Create: `apps/api/drizzle/migrations/0003_*.sql` (generated)
- Create: `apps/api/src/modules/auth/application/ports/password-reset-token.repository.interface.ts`
- Create: `apps/api/src/modules/auth/infrastructure/persistence/password-reset-token.repository.ts`
- Modify: `apps/api/test/helpers/drizzle-test-utils.ts`
- Create: `apps/api/test/helpers/mocks/password-reset-token.mock.ts`
- Test: `apps/api/test/integration/auth/password-reset-token-repository.integration.spec.ts`

**Interfaces:**
- Produces:

```typescript
export const PASSWORD_RESET_TOKEN_REPOSITORY_TOKEN = Symbol(
  'IPasswordResetTokenRepository',
);

export interface ResetTokenStats {
  issuedSince: number;
  latestCreatedAt: Date | null;
}

export interface RedeemedReset {
  userId: string;
  email: string;
}

export interface IPasswordResetTokenRepository {
  /** Tokens issued for the user since `since`, and the newest creation time. */
  statsForUser(userId: string, since: Date): Promise<ResetTokenStats>;
  /** Supersedes the user's unused tokens and stores the new one, atomically. */
  issue(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  /**
   * Atomically claims a valid token, stores the new password hash, bumps
   * token_version and supersedes the user's other tokens.
   * Returns null when the token is unknown, expired or already used.
   */
  redeem(tokenHash: string, newPasswordHash: string): Promise<RedeemedReset | null>;
}
```

- [ ] **Step 1: Write the failing integration test**

`test/integration/auth/password-reset-token-repository.integration.spec.ts`:

```typescript
import { randomUUID } from 'node:crypto';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { eq } from 'drizzle-orm';
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
    await credentials.create(userId, 'reset@example.com', 'resetuser', 'old-hash');
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
    expect((await credentials.findByUserId(userId))?.passwordHash).toBe('old-hash');
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

    const stats = await repo.statsForUser(userId, new Date(Date.now() - 60_000));
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
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/api && pnpm exec jest --config ./test/integration/jest-integration.json test/integration/auth/password-reset-token-repository.integration.spec.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Schema and migration**

`password-reset-tokens.table.ts`:

```typescript
import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { authCredentialsTable } from './auth-credentials.table';
import { auditColumns } from './columns.helpers';

export const passwordResetTokensTable = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authCredentialsTable.userId),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true, mode: 'date' }),
    ...auditColumns,
  },
  (t) => [index('password_reset_tokens_user_id_idx').on(t.userId)],
);

export type PasswordResetTokenRow = typeof passwordResetTokensTable.$inferSelect;
```

`schema/index.ts` — add:

```typescript
export {
  type PasswordResetTokenRow,
  passwordResetTokensTable,
} from './password-reset-tokens.table';
```

Run: `cd apps/api && pnpm exec drizzle-kit generate --name add_password_reset_tokens`
Expected: `drizzle/migrations/0003_add_password_reset_tokens.sql` creating the table, the FK, the unique constraint and the index.

`test/helpers/drizzle-test-utils.ts` — import the table and delete it first in `cleanDatabase`:

```typescript
  await target.delete(passwordResetTokensTable);
  await target.delete(authCredentialsTable);
```

- [ ] **Step 4: Port and repository**

Create `password-reset-token.repository.interface.ts` with the exact content from **Interfaces** above.

`password-reset-token.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { and, count, eq, gt, gte, isNull, max, ne, sql } from 'drizzle-orm';
import { AuditableTableService } from '../../../../shared/infrastructure/database/auditable-table.service';
import { DrizzleService } from '../../../../shared/infrastructure/database/drizzle.service';
import { authCredentialsTable } from '../../../../shared/infrastructure/database/schema/auth-credentials.table';
import { passwordResetTokensTable as tokens } from '../../../../shared/infrastructure/database/schema/password-reset-tokens.table';
import type {
  IPasswordResetTokenRepository,
  RedeemedReset,
  ResetTokenStats,
} from '../../application/ports/password-reset-token.repository.interface';

@Injectable()
export class PasswordResetTokenRepository
  implements IPasswordResetTokenRepository
{
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly audit: AuditableTableService,
  ) {}

  async statsForUser(userId: string, since: Date): Promise<ResetTokenStats> {
    const [row] = await this.drizzle.db
      .select({ issued: count(), latest: max(tokens.createdAt) })
      .from(tokens)
      .where(
        and(
          eq(tokens.userId, userId),
          gte(tokens.createdAt, since),
          isNull(tokens.deletedAt),
        ),
      );
    return { issuedSince: Number(row.issued), latestCreatedAt: row.latest ?? null };
  }

  async issue(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.drizzle.transaction(async (tx) => {
      await this.audit.update(
        tokens,
        and(
          eq(tokens.userId, userId),
          isNull(tokens.usedAt),
          isNull(tokens.deletedAt),
        )!,
        { usedAt: new Date() },
        tx,
      );
      await this.audit.insert(tokens, { userId, tokenHash, expiresAt }, tx);
    });
  }

  async redeem(
    tokenHash: string,
    newPasswordHash: string,
  ): Promise<RedeemedReset | null> {
    return this.drizzle.transaction(async (tx) => {
      const now = new Date();
      // Conditional UPDATE claims the token: a concurrent redeem finds used_at set
      const [claimed] = await tx
        .update(tokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(tokens.tokenHash, tokenHash),
            isNull(tokens.usedAt),
            gt(tokens.expiresAt, now),
            isNull(tokens.deletedAt),
          ),
        )
        .returning({ id: tokens.id, userId: tokens.userId });
      if (!claimed) return null;

      const [credential] = await tx
        .update(authCredentialsTable)
        .set({
          passwordHash: newPasswordHash,
          tokenVersion: sql`${authCredentialsTable.tokenVersion} + 1`,
        })
        .where(
          and(
            eq(authCredentialsTable.userId, claimed.userId),
            isNull(authCredentialsTable.deletedAt),
          ),
        )
        .returning({ email: authCredentialsTable.email });
      if (!credential) return null;

      await tx
        .update(tokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(tokens.userId, claimed.userId),
            ne(tokens.id, claimed.id),
            isNull(tokens.usedAt),
          ),
        );

      return { userId: claimed.userId, email: credential.email };
    });
  }
}
```

If `credential` is missing the transaction returns `null` after claiming the token; that only happens for a soft-deleted user and leaves the token used, which is the desired outcome.

`test/helpers/mocks/password-reset-token.mock.ts`:

```typescript
import type { IPasswordResetTokenRepository } from '../../../src/modules/auth/application/ports/password-reset-token.repository.interface';

export function createMockPasswordResetTokenRepository(): jest.Mocked<IPasswordResetTokenRepository> {
  return {
    statsForUser: jest
      .fn()
      .mockResolvedValue({ issuedSince: 0, latestCreatedAt: null }),
    issue: jest.fn().mockResolvedValue(undefined),
    redeem: jest.fn().mockResolvedValue(null),
  };
}
```

- [ ] **Step 5: Run the integration suite**

Run: `cd apps/api && pnpm exec jest --config ./test/integration/jest-integration.json && pnpm typecheck && pnpm lint`
Expected: PASS (including the existing migrate integration test with the two new migrations).

---

### Task 12: Reset token generator and forgot-password command

**Files:**
- Create: `apps/api/src/modules/auth/application/ports/reset-token-generator.interface.ts`
- Create: `apps/api/src/modules/auth/infrastructure/auth/crypto-reset-token-generator.ts`, `crypto-reset-token-generator.spec.ts`
- Create: `apps/api/src/modules/auth/domain/events/password-reset-requested.event.ts`
- Create: `apps/api/src/modules/auth/application/commands/request-password-reset/request-password-reset.command.ts`, `request-password-reset.handler.ts`, `request-password-reset.handler.spec.ts`
- Modify: `apps/api/src/modules/auth/auth.module.ts`

**Interfaces:**
- Consumes: `IPasswordResetTokenRepository` (Task 11), `IAuthCredentialsRepository.findByEmailOrUsername`, `Locale`.
- Produces:
  - `RESET_TOKEN_GENERATOR_TOKEN`; `IResetTokenGenerator { generate(): { raw: string; hash: string }; hash(raw: string): string }`;
  - `RequestPasswordResetCommand(email: string, locale: Locale)` → `void`;
  - `PasswordResetRequestedEvent(userId: string, email: string, rawToken: string, locale: Locale)`;
  - exported constants `RESET_COOLDOWN_MS = 60_000`, `RESET_HOURLY_LIMIT = 5` from the handler file.

- [ ] **Step 1: Write failing tests**

`crypto-reset-token-generator.spec.ts`:

```typescript
import { CryptoResetTokenGenerator } from './crypto-reset-token-generator';

describe('CryptoResetTokenGenerator', () => {
  const generator = new CryptoResetTokenGenerator();

  it('generates a url-safe 32-byte token and its sha256 hex hash', () => {
    const { raw, hash } = generator.generate();

    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(generator.hash(raw)).toBe(hash);
  });

  it('never repeats', () => {
    expect(generator.generate().raw).not.toBe(generator.generate().raw);
  });
});
```

`request-password-reset.handler.spec.ts`:

```typescript
import { createAuthCredentialRecord } from '../../../../../../test/helpers/factories/auth.factory';
import { createMockAuthCredentialsRepository } from '../../../../../../test/helpers/mocks/auth-credentials.mock';
import { createMockEventBus } from '../../../../../../test/helpers/mocks/event-bus.mock';
import { createMockPinoLogger } from '../../../../../../test/helpers/mocks/logger.mock';
import { createMockPasswordResetTokenRepository } from '../../../../../../test/helpers/mocks/password-reset-token.mock';
import { PasswordResetRequestedEvent } from '../../../domain/events/password-reset-requested.event';
import { RequestPasswordResetCommand } from './request-password-reset.command';
import { RequestPasswordResetHandler } from './request-password-reset.handler';

describe('RequestPasswordResetHandler', () => {
  const credentials = createMockAuthCredentialsRepository();
  const resetTokens = createMockPasswordResetTokenRepository();
  const eventBus = createMockEventBus();
  const generator = {
    generate: jest.fn().mockReturnValue({ raw: 'raw-token', hash: 'token-hash' }),
    hash: jest.fn(),
  };
  const config = { get: jest.fn().mockReturnValue('30') };
  const handler = new RequestPasswordResetHandler(
    createMockPinoLogger() as any,
    credentials,
    resetTokens,
    generator,
    eventBus as any,
    config as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    credentials.findByEmailOrUsername.mockResolvedValue(
      createAuthCredentialRecord({ userId: 'u1', email: 'alice@example.com' }),
    );
    resetTokens.statsForUser.mockResolvedValue({
      issuedSince: 0,
      latestCreatedAt: null,
    });
  });

  it('normalizes the email before the lookup', async () => {
    await handler.execute(
      new RequestPasswordResetCommand('  Alice@Example.COM ', 'en'),
    );

    expect(credentials.findByEmailOrUsername).toHaveBeenCalledWith(
      'alice@example.com',
    );
  });

  it('issues a token that expires after the TTL and publishes the raw token', async () => {
    const before = Date.now();

    await handler.execute(new RequestPasswordResetCommand('alice@example.com', 'vi'));

    const [userId, hash, expiresAt] = resetTokens.issue.mock.calls[0];
    expect(userId).toBe('u1');
    expect(hash).toBe('token-hash');
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 30 * 60_000);
    const event = eventBus.publish.mock.calls[0][0] as PasswordResetRequestedEvent;
    expect(event).toBeInstanceOf(PasswordResetRequestedEvent);
    expect(event).toMatchObject({
      userId: 'u1',
      email: 'alice@example.com',
      rawToken: 'raw-token',
      locale: 'vi',
    });
  });

  it.each([
    ['unknown email', () => credentials.findByEmailOrUsername.mockResolvedValue(null)],
    [
      'inactive account',
      () =>
        credentials.findByEmailOrUsername.mockResolvedValue(
          createAuthCredentialRecord({ isActive: false }),
        ),
    ],
    [
      'a token issued in the last minute',
      () =>
        resetTokens.statsForUser.mockResolvedValue({
          issuedSince: 1,
          latestCreatedAt: new Date(Date.now() - 10_000),
        }),
    ],
    [
      'five tokens in the last hour',
      () =>
        resetTokens.statsForUser.mockResolvedValue({
          issuedSince: 5,
          latestCreatedAt: new Date(Date.now() - 30 * 60_000),
        }),
    ],
  ])('silently does nothing for %s', async (_case, arrange) => {
    arrange();

    await expect(
      handler.execute(new RequestPasswordResetCommand('alice@example.com', 'en')),
    ).resolves.toBeUndefined();

    expect(resetTokens.issue).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('only looks up by email, never by username', async () => {
    credentials.findByEmailOrUsername.mockResolvedValue(
      createAuthCredentialRecord({ email: 'other@example.com', username: 'alice' }),
    );

    await handler.execute(new RequestPasswordResetCommand('alice', 'en'));

    expect(resetTokens.issue).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/api && pnpm exec jest src/modules/auth`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`reset-token-generator.interface.ts`:

```typescript
export const RESET_TOKEN_GENERATOR_TOKEN = Symbol('IResetTokenGenerator');

export interface IResetTokenGenerator {
  /** A new random token and the hash that is stored. */
  generate(): { raw: string; hash: string };
  hash(raw: string): string;
}
```

`crypto-reset-token-generator.ts`:

```typescript
import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { IResetTokenGenerator } from '../../application/ports/reset-token-generator.interface';

@Injectable()
export class CryptoResetTokenGenerator implements IResetTokenGenerator {
  generate(): { raw: string; hash: string } {
    const raw = randomBytes(32).toString('base64url');
    return { raw, hash: this.hash(raw) };
  }

  // High-entropy token, looked up by hash: SHA-256 is enough, no bcrypt needed
  hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
```

`password-reset-requested.event.ts`:

```typescript
import type { Locale } from '../../../../shared/domain/locale';

/** Carries the raw token to the mail handler only; never persisted or logged. */
export class PasswordResetRequestedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly rawToken: string,
    public readonly locale: Locale,
  ) {}
}
```

`request-password-reset.command.ts`:

```typescript
import type { Locale } from '../../../../../shared/domain/locale';

export class RequestPasswordResetCommand {
  constructor(
    public readonly email: string,
    public readonly locale: Locale,
  ) {}
}
```

`request-password-reset.handler.ts`:

```typescript
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, EventBus, type ICommandHandler } from '@nestjs/cqrs';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import { PasswordResetRequestedEvent } from '../../../domain/events/password-reset-requested.event';
import {
  AUTH_CREDENTIALS_REPOSITORY_TOKEN,
  type IAuthCredentialsRepository,
} from '../../ports/auth-credentials.repository.interface';
import {
  type IPasswordResetTokenRepository,
  PASSWORD_RESET_TOKEN_REPOSITORY_TOKEN,
} from '../../ports/password-reset-token.repository.interface';
import {
  type IResetTokenGenerator,
  RESET_TOKEN_GENERATOR_TOKEN,
} from '../../ports/reset-token-generator.interface';
import { RequestPasswordResetCommand } from './request-password-reset.command';

export const RESET_COOLDOWN_MS = 60_000;
export const RESET_HOURLY_LIMIT = 5;
const HOUR_MS = 60 * 60_000;

// Every outcome returns normally so the endpoint never reveals which emails exist
@CommandHandler(RequestPasswordResetCommand)
export class RequestPasswordResetHandler
  implements ICommandHandler<RequestPasswordResetCommand, void>
{
  constructor(
    @InjectPinoLogger(RequestPasswordResetHandler.name)
    private readonly logger: PinoLogger,
    @Inject(AUTH_CREDENTIALS_REPOSITORY_TOKEN)
    private readonly credentialsRepo: IAuthCredentialsRepository,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY_TOKEN)
    private readonly resetTokens: IPasswordResetTokenRepository,
    @Inject(RESET_TOKEN_GENERATOR_TOKEN)
    private readonly tokenGenerator: IResetTokenGenerator,
    private readonly eventBus: EventBus,
    private readonly config: ConfigService,
  ) {}

  async execute(command: RequestPasswordResetCommand): Promise<void> {
    const email = command.email.trim().toLowerCase();
    const credential = await this.credentialsRepo.findByEmailOrUsername(email);

    if (!credential || credential.email !== email) {
      this.logger.info({ reason: 'not_found' }, 'Password reset skipped');
      return;
    }
    if (!credential.isActive) {
      this.logger.info(
        { userId: credential.userId, reason: 'inactive' },
        'Password reset skipped',
      );
      return;
    }

    const now = Date.now();
    const stats = await this.resetTokens.statsForUser(
      credential.userId,
      new Date(now - HOUR_MS),
    );
    const inCooldown =
      stats.latestCreatedAt !== null &&
      now - stats.latestCreatedAt.getTime() < RESET_COOLDOWN_MS;
    if (inCooldown || stats.issuedSince >= RESET_HOURLY_LIMIT) {
      this.logger.warn(
        { userId: credential.userId, reason: inCooldown ? 'cooldown' : 'hourly_limit' },
        'Password reset skipped',
      );
      return;
    }

    const ttlMinutes = Number(this.config.get('PASSWORD_RESET_TTL_MINUTES', '30'));
    const { raw, hash } = this.tokenGenerator.generate();
    await this.resetTokens.issue(
      credential.userId,
      hash,
      new Date(now + ttlMinutes * 60_000),
    );

    this.eventBus.publish(
      new PasswordResetRequestedEvent(
        credential.userId,
        credential.email,
        raw,
        command.locale,
      ),
    );
    this.logger.info({ userId: credential.userId }, 'Password reset issued');
  }
}
```

`auth.module.ts` — add to `providers`: `CryptoResetTokenGenerator`, `PasswordResetTokenRepository`, `{ provide: RESET_TOKEN_GENERATOR_TOKEN, useExisting: CryptoResetTokenGenerator }`, `{ provide: PASSWORD_RESET_TOKEN_REPOSITORY_TOKEN, useExisting: PasswordResetTokenRepository }`; add `RequestPasswordResetHandler` to `CommandHandlers`.

- [ ] **Step 4: Run tests**

Run: `cd apps/api && pnpm exec jest src/modules/auth && pnpm typecheck && pnpm lint`
Expected: PASS.

---

### Task 13: Reset-password command

**Files:**
- Create: `apps/api/src/modules/auth/domain/errors/invalid-reset-token.error.ts`
- Create: `apps/api/src/modules/auth/application/commands/reset-password/reset-password.command.ts`, `reset-password.handler.ts`, `reset-password.handler.spec.ts`
- Modify: `apps/api/src/modules/auth/auth.module.ts`

**Interfaces:**
- Consumes: `IResetTokenGenerator.hash`, `IPasswordResetTokenRepository.redeem`, `IPasswordHasher.hash`, `PasswordChangedEvent`, `WeakPasswordError`.
- Produces: `ResetPasswordCommand(token: string, newPassword: string, locale: Locale)` → `void`; `InvalidResetTokenError` (400, `INVALID_RESET_TOKEN`).

- [ ] **Step 1: Write the failing test**

`reset-password.handler.spec.ts`:

```typescript
import { createMockEventBus } from '../../../../../../test/helpers/mocks/event-bus.mock';
import { createMockPinoLogger } from '../../../../../../test/helpers/mocks/logger.mock';
import { createMockPasswordHasher } from '../../../../../../test/helpers/mocks/password-hasher.mock';
import { createMockPasswordResetTokenRepository } from '../../../../../../test/helpers/mocks/password-reset-token.mock';
import { InvalidResetTokenError } from '../../../domain/errors/invalid-reset-token.error';
import { WeakPasswordError } from '../../../domain/errors/weak-password.error';
import { PasswordChangedEvent } from '../../../domain/events/password-changed.event';
import { ResetPasswordCommand } from './reset-password.command';
import { ResetPasswordHandler } from './reset-password.handler';

describe('ResetPasswordHandler', () => {
  const resetTokens = createMockPasswordResetTokenRepository();
  const hasher = createMockPasswordHasher();
  const eventBus = createMockEventBus();
  const generator = { generate: jest.fn(), hash: jest.fn().mockReturnValue('token-hash') };
  const handler = new ResetPasswordHandler(
    createMockPinoLogger() as any,
    resetTokens,
    generator,
    hasher,
    eventBus as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('redeems the hashed token with the new password hash and publishes the event', async () => {
    hasher.hash.mockResolvedValue('new-hash');
    resetTokens.redeem.mockResolvedValue({ userId: 'u1', email: 'a@example.com' });

    await handler.execute(new ResetPasswordCommand('raw', 'newPassword1', 'vi'));

    expect(generator.hash).toHaveBeenCalledWith('raw');
    expect(resetTokens.redeem).toHaveBeenCalledWith('token-hash', 'new-hash');
    const event = eventBus.publish.mock.calls[0][0] as PasswordChangedEvent;
    expect(event).toBeInstanceOf(PasswordChangedEvent);
    expect(event).toMatchObject({
      userId: 'u1',
      email: 'a@example.com',
      locale: 'vi',
      method: 'reset',
    });
  });

  it('throws InvalidResetTokenError when the token cannot be redeemed', async () => {
    resetTokens.redeem.mockResolvedValue(null);

    await expect(
      handler.execute(new ResetPasswordCommand('raw', 'newPassword1', 'en')),
    ).rejects.toThrow(InvalidResetTokenError);
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it.each(['short', 'x'.repeat(129)])(
    'rejects password %# before touching the token',
    async (password) => {
      await expect(
        handler.execute(new ResetPasswordCommand('raw', password, 'en')),
      ).rejects.toThrow(WeakPasswordError);
      expect(resetTokens.redeem).not.toHaveBeenCalled();
    },
  );
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/api && pnpm exec jest src/modules/auth/application/commands/reset-password`
Expected: FAIL.

- [ ] **Step 3: Implement**

`invalid-reset-token.error.ts`:

```typescript
import { BadRequestException } from '@nestjs/common';

// One error for unknown, expired and used tokens: callers learn nothing more
export class InvalidResetTokenError extends BadRequestException {
  constructor() {
    super({
      message: 'Reset link is invalid or has expired',
      errorCode: 'INVALID_RESET_TOKEN',
    });
    this.name = 'InvalidResetTokenError';
  }
}
```

`reset-password.command.ts`:

```typescript
import type { Locale } from '../../../../../shared/domain/locale';

export class ResetPasswordCommand {
  constructor(
    public readonly token: string,
    public readonly newPassword: string,
    public readonly locale: Locale,
  ) {}
}
```

`reset-password.handler.ts`:

```typescript
import { Inject } from '@nestjs/common';
import { CommandHandler, EventBus, type ICommandHandler } from '@nestjs/cqrs';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import { InvalidResetTokenError } from '../../../domain/errors/invalid-reset-token.error';
import { WeakPasswordError } from '../../../domain/errors/weak-password.error';
import { PasswordChangedEvent } from '../../../domain/events/password-changed.event';
import {
  type IPasswordHasher,
  PASSWORD_HASHER_TOKEN,
} from '../../ports/password-hasher.interface';
import {
  type IPasswordResetTokenRepository,
  PASSWORD_RESET_TOKEN_REPOSITORY_TOKEN,
} from '../../ports/password-reset-token.repository.interface';
import {
  type IResetTokenGenerator,
  RESET_TOKEN_GENERATOR_TOKEN,
} from '../../ports/reset-token-generator.interface';
import { ResetPasswordCommand } from './reset-password.command';

@CommandHandler(ResetPasswordCommand)
export class ResetPasswordHandler
  implements ICommandHandler<ResetPasswordCommand, void>
{
  constructor(
    @InjectPinoLogger(ResetPasswordHandler.name)
    private readonly logger: PinoLogger,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY_TOKEN)
    private readonly resetTokens: IPasswordResetTokenRepository,
    @Inject(RESET_TOKEN_GENERATOR_TOKEN)
    private readonly tokenGenerator: IResetTokenGenerator,
    @Inject(PASSWORD_HASHER_TOKEN)
    private readonly passwordHasher: IPasswordHasher,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    const length = command.newPassword?.length ?? 0;
    if (length < 8 || length > 128) {
      throw new WeakPasswordError('Password must be 8-128 characters');
    }

    // Hash outside the transaction: bcrypt is slow and must not hold row locks
    const newHash = await this.passwordHasher.hash(command.newPassword);
    const redeemed = await this.resetTokens.redeem(
      this.tokenGenerator.hash(command.token),
      newHash,
    );
    if (!redeemed) {
      this.logger.warn({ reason: 'invalid_token' }, 'Password reset failed');
      throw new InvalidResetTokenError();
    }

    this.eventBus.publish(
      new PasswordChangedEvent(
        redeemed.userId,
        redeemed.email,
        command.locale,
        'reset',
      ),
    );
    this.logger.info({ userId: redeemed.userId }, 'Password reset completed');
  }
}
```

`auth.module.ts` — add `ResetPasswordHandler` to `CommandHandlers`.

- [ ] **Step 4: Run tests**

Run: `cd apps/api && pnpm exec jest src/modules/auth && pnpm typecheck && pnpm lint`
Expected: PASS.

---

### Task 14: Mail event handlers

**Files:**
- Create: `apps/api/src/modules/auth/application/event-handlers/send-password-reset-email.handler.ts`, `.spec.ts`
- Create: `apps/api/src/modules/auth/application/event-handlers/send-password-changed-email.handler.ts`, `.spec.ts`
- Modify: `apps/api/src/modules/auth/auth.module.ts`

**Interfaces:**
- Consumes: `IMailService`, `MAIL_SERVICE_TOKEN` (Task 8–9), `MetricsService.counter` (existing global), events from Tasks 5 and 12.
- Produces: `SendPasswordResetEmailHandler`, `SendPasswordChangedEmailHandler`; counter `mail_send_failures_total` with attribute `template`.

- [ ] **Step 1: Write failing tests**

`send-password-reset-email.handler.spec.ts`:

```typescript
import { createMockPinoLogger } from '../../../../../test/helpers/mocks/logger.mock';
import { PasswordResetRequestedEvent } from '../../domain/events/password-reset-requested.event';
import { SendPasswordResetEmailHandler } from './send-password-reset-email.handler';

describe('SendPasswordResetEmailHandler', () => {
  const mail = { sendTemplate: jest.fn() };
  const failures = { add: jest.fn() };
  const metrics = { counter: jest.fn().mockReturnValue(failures) };
  const logger = createMockPinoLogger();
  const config = {
    get: jest.fn((key: string, fallback?: string) =>
      ({ WEB_APP_URL: 'https://app.test', PASSWORD_RESET_TTL_MINUTES: '30' })[key] ?? fallback,
    ),
  };
  const handler = new SendPasswordResetEmailHandler(
    logger as any,
    mail,
    metrics as any,
    config as any,
  );
  const event = new PasswordResetRequestedEvent('u1', 'a@example.com', 'raw+/tok', 'vi');

  beforeEach(() => jest.clearAllMocks());

  it('sends the reset template with a locale-prefixed, encoded link', async () => {
    await handler.handle(event);

    expect(mail.sendTemplate).toHaveBeenCalledWith('a@example.com', 'password-reset', 'vi', {
      resetUrl: 'https://app.test/vi/reset-password?token=raw%2B%2Ftok',
      ttlMinutes: 30,
    });
  });

  it('logs and counts failures without throwing or leaking the email', async () => {
    mail.sendTemplate.mockRejectedValue(new Error('SES down'));

    await expect(handler.handle(event)).resolves.toBeUndefined();

    expect(failures.add).toHaveBeenCalledWith(1, { template: 'password-reset' });
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('a@example.com');
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('raw+/tok');
  });
});
```

`send-password-changed-email.handler.spec.ts`:

```typescript
import { createMockPinoLogger } from '../../../../../test/helpers/mocks/logger.mock';
import { PasswordChangedEvent } from '../../domain/events/password-changed.event';
import { SendPasswordChangedEmailHandler } from './send-password-changed-email.handler';

describe('SendPasswordChangedEmailHandler', () => {
  const mail = { sendTemplate: jest.fn() };
  const failures = { add: jest.fn() };
  const metrics = { counter: jest.fn().mockReturnValue(failures) };
  const config = { get: jest.fn().mockReturnValue('https://app.test') };
  const handler = new SendPasswordChangedEmailHandler(
    createMockPinoLogger() as any,
    mail,
    metrics as any,
    config as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('sends the changed template with the method and forgot-password link', async () => {
    await handler.handle(new PasswordChangedEvent('u1', 'a@example.com', 'en', 'reset'));

    expect(mail.sendTemplate).toHaveBeenCalledWith('a@example.com', 'password-changed', 'en', {
      method: 'reset',
      forgotPasswordUrl: 'https://app.test/en/forgot-password',
    });
  });

  it('swallows failures', async () => {
    mail.sendTemplate.mockRejectedValue(new Error('down'));

    await expect(
      handler.handle(new PasswordChangedEvent('u1', 'a@example.com', 'en', 'change')),
    ).resolves.toBeUndefined();
    expect(failures.add).toHaveBeenCalledWith(1, { template: 'password-changed' });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/api && pnpm exec jest src/modules/auth/application/event-handlers`
Expected: FAIL.

- [ ] **Step 3: Implement**

`send-password-reset-email.handler.ts`:

```typescript
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventsHandler, type IEventHandler } from '@nestjs/cqrs';
import type { Counter } from '@opentelemetry/api';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import {
  type IMailService,
  MAIL_SERVICE_TOKEN,
} from '../../../../shared/application/ports/mail.interface';
import { MetricsService } from '../../../../shared/infrastructure/metrics/metrics.service';
import { PasswordResetRequestedEvent } from '../../domain/events/password-reset-requested.event';

@EventsHandler(PasswordResetRequestedEvent)
export class SendPasswordResetEmailHandler
  implements IEventHandler<PasswordResetRequestedEvent>
{
  private readonly failures: Counter;

  constructor(
    @InjectPinoLogger(SendPasswordResetEmailHandler.name)
    private readonly logger: PinoLogger,
    @Inject(MAIL_SERVICE_TOKEN)
    private readonly mail: IMailService,
    metrics: MetricsService,
    private readonly config: ConfigService,
  ) {
    this.failures = metrics.counter(
      'mail_send_failures_total',
      'Emails that could not be handed to the mail transport',
    );
  }

  async handle(event: PasswordResetRequestedEvent): Promise<void> {
    const webAppUrl = this.config.get<string>('WEB_APP_URL', 'http://localhost:3000');
    const resetUrl = `${webAppUrl}/${event.locale}/reset-password?token=${encodeURIComponent(event.rawToken)}`;
    try {
      await this.mail.sendTemplate(event.email, 'password-reset', event.locale, {
        resetUrl,
        ttlMinutes: Number(this.config.get('PASSWORD_RESET_TTL_MINUTES', '30')),
      });
    } catch (err) {
      this.failures.add(1, { template: 'password-reset' });
      this.logger.error(
        { userId: event.userId, template: 'password-reset', err: (err as Error).message },
        'Failed to send email',
      );
    }
  }
}
```

The `MetricsService` import is infrastructure-from-application, which the repo already tolerates for metrics (`MetricsService` is the documented injectable for custom metrics in `apps/api/AGENTS.md`). Keep it.

`send-password-changed-email.handler.ts`: same structure, `@EventsHandler(PasswordChangedEvent)`, and:

```typescript
  async handle(event: PasswordChangedEvent): Promise<void> {
    const webAppUrl = this.config.get<string>('WEB_APP_URL', 'http://localhost:3000');
    try {
      await this.mail.sendTemplate(event.email, 'password-changed', event.locale, {
        method: event.method,
        forgotPasswordUrl: `${webAppUrl}/${event.locale}/forgot-password`,
      });
    } catch (err) {
      this.failures.add(1, { template: 'password-changed' });
      this.logger.error(
        { userId: event.userId, template: 'password-changed', err: (err as Error).message },
        'Failed to send email',
      );
    }
  }
```

`auth.module.ts` — add both handlers to `EventHandlers`.

- [ ] **Step 4: Run tests**

Run: `cd apps/api && pnpm exec jest && pnpm typecheck && pnpm lint`
Expected: PASS.

---

### Task 15: Forgot/reset endpoints, redaction and e2e

**Files:**
- Create: `apps/api/src/modules/auth/presentation/dtos/forgot-password.request.dto.ts`, `reset-password.request.dto.ts`
- Modify: `apps/api/src/modules/auth/presentation/controllers/auth.controller.ts`, `auth.controller.spec.ts`
- Modify: `apps/api/src/shared/infrastructure/logger/logger.module.ts`
- Create: `apps/api/test/helpers/mail-capture.ts`
- Modify: `apps/api/test/helpers/test-app-factory.ts`
- Create: `apps/api/test/e2e/auth/password-reset.e2e-spec.ts`

**Interfaces:**
- Consumes: commands from Tasks 12–13, `MAIL_SENDER_TOKEN`.
- Produces: `POST /api/v1/auth/forgot-password` (202, `data: {}`), `POST /api/v1/auth/reset-password` (200, `data: {}`); `MailCapture implements IMailSender { messages: MailMessage[]; clear(): void; lastTo(email: string): MailMessage | undefined }`; `createTestApp(envOverrides, options?: { mailSender?: IMailSender })`.

- [ ] **Step 1: Write the failing e2e**

`test/helpers/mail-capture.ts`:

```typescript
import type {
  IMailSender,
  MailMessage,
} from '../../src/shared/application/ports/mail.interface';

export class MailCapture implements IMailSender {
  readonly messages: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.messages.push(message);
  }

  clear(): void {
    this.messages.length = 0;
  }

  lastTo(email: string): MailMessage | undefined {
    return [...this.messages].reverse().find((m) => m.to === email);
  }
}

export function tokenFrom(message: MailMessage): string {
  const match = /reset-password\?token=([^\s"&]+)/.exec(message.text);
  if (!match) throw new Error('No reset link in message');
  return decodeURIComponent(match[1]);
}
```

`test/helpers/test-app-factory.ts` — replace `createTestApp` so a suite can swap the mail transport:

```typescript
export async function createTestApp(
  envOverrides: Record<string, string>,
  options: { mailSender?: IMailSender } = {},
): Promise<INestApplication> {
  // Ensure NODE_ENV=test so ConfigModule loads .env.test
  process.env.NODE_ENV = 'test';

  // Silence pino logs in tests unless explicitly configured
  process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';

  // Disable throttling for e2e tests (sequential calls would otherwise exhaust limits)
  process.env.THROTTLE_DISABLED = 'true';

  // Set env vars so ConfigService picks them up (e.g. dynamic DATABASE_URL from TestContainers)
  for (const [key, value] of Object.entries(envOverrides)) {
    process.env[key] = value;
  }

  // Create a Drizzle instance pointing to the test DB
  testSql = postgres(envOverrides.DATABASE_URL);
  const testDb = drizzle(testSql, { schema });

  let builder = Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(DrizzleService)
    .useValue({
      db: testDb,
      transaction: <T>(fn: (tx: any) => Promise<T>): Promise<T> =>
        testDb.transaction(fn),
      onModuleInit: () => {},
      onModuleDestroy: async () => {
        await testSql?.end();
        testSql = null;
      },
    });
  if (options.mailSender) {
    builder = builder
      .overrideProvider(MAIL_SENDER_TOKEN)
      .useValue(options.mailSender);
  }
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication();

  configureApp(app);

  await app.init();
  return app;
}
```

(import `IMailSender`, `MAIL_SENDER_TOKEN` from `'../../src/shared/application/ports/mail.interface'`). Without an override the default `SmtpMailSender` would try `localhost:1025`; that only produces logged failures, but pass a `MailCapture` in every suite that triggers mail.

`test/e2e/auth/password-reset.e2e-spec.ts`:

```typescript
import type { INestApplication } from '@nestjs/common';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  cleanDatabase,
  disconnectDrizzle,
  setupDrizzleForTests,
  type TestDrizzleDb,
} from '../../helpers/drizzle-test-utils';
import { MailCapture, tokenFrom } from '../../helpers/mail-capture';
import { createTestApp } from '../../helpers/test-app-factory';
import { startPostgresContainer } from '../../helpers/testcontainers-setup';

describe('Forgot / reset password (e2e)', () => {
  let app: INestApplication<App>;
  let pgContainer: StartedPostgreSqlContainer;
  let db: TestDrizzleDb;
  const mail = new MailCapture();
  const user = {
    email: 'forgetful@example.com',
    username: 'forgetful',
    password: 'originalPass1',
  };

  const flush = () => new Promise((r) => setTimeout(r, 200));
  const server = () => app.getHttpServer();

  async function requestReset(email = user.email, locale = 'en') {
    const res = await request(server())
      .post('/api/v1/auth/forgot-password')
      .send({ email, locale });
    await flush();
    return res;
  }

  beforeAll(async () => {
    pgContainer = await startPostgresContainer();
    const dbUrl = pgContainer.getConnectionUri();
    db = await setupDrizzleForTests(dbUrl);
    app = await createTestApp(
      { DATABASE_URL: dbUrl, WEB_APP_URL: 'https://app.test' },
      { mailSender: mail },
    );
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await disconnectDrizzle();
    await pgContainer?.stop();
  });

  beforeEach(async () => {
    await cleanDatabase(db);
    mail.clear();
    await request(server()).post('/api/v1/auth/register').send(user);
  });

  it('answers 202 with an empty body for known and unknown emails alike', async () => {
    const known = await requestReset();
    const unknown = await requestReset('nobody@example.com');

    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(known.body.data).toEqual({});
    expect(unknown.body).toEqual(known.body);
    expect(mail.messages.map((m) => m.to)).toEqual([user.email]);
  });

  it('sends the link in the requested locale', async () => {
    await requestReset(user.email, 'vi');

    const message = mail.lastTo(user.email);
    expect(message?.subject).toBe('Đặt lại mật khẩu');
    expect(message?.text).toContain('https://app.test/vi/reset-password?token=');
  });

  it('rejects an unsupported locale', async () => {
    const res = await request(server())
      .post('/api/v1/auth/forgot-password')
      .send({ email: user.email, locale: 'fr' });

    expect(res.status).toBe(400);
  });

  it('resets the password once, revokes sessions and notifies', async () => {
    const login = await request(server())
      .post('/api/v1/auth/login')
      .send({ identifier: user.email, password: user.password });
    await requestReset();
    const token = tokenFrom(mail.lastTo(user.email)!);

    const reset = await request(server())
      .post('/api/v1/auth/reset-password')
      .send({ token, new_password: 'freshPass123' });
    await flush();

    expect(reset.status).toBe(200);
    expect(reset.body.data).toEqual({});

    const oldPassword = await request(server())
      .post('/api/v1/auth/login')
      .send({ identifier: user.email, password: user.password });
    const newPassword = await request(server())
      .post('/api/v1/auth/login')
      .send({ identifier: user.email, password: 'freshPass123' });
    const oldSession = await request(server())
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${login.body.data.access_token}`);
    const reuse = await request(server())
      .post('/api/v1/auth/reset-password')
      .send({ token, new_password: 'anotherPass1' });

    expect(oldPassword.status).toBe(401);
    expect(newPassword.status).toBe(200);
    expect(oldSession.status).toBe(401);
    expect(reuse.status).toBe(400);
    expect(reuse.body.error).toBe('INVALID_RESET_TOKEN');
    expect(mail.lastTo(user.email)?.subject).toBe('Your password was changed');
  });

  it('rejects a made-up token and a weak password', async () => {
    const bogus = await request(server())
      .post('/api/v1/auth/reset-password')
      .send({ token: 'not-a-real-token', new_password: 'freshPass123' });
    const weak = await request(server())
      .post('/api/v1/auth/reset-password')
      .send({ token: 'not-a-real-token', new_password: 'short' });

    expect(bogus.status).toBe(400);
    expect(bogus.body.error).toBe('INVALID_RESET_TOKEN');
    expect(weak.status).toBe(400);
  });

  it('does not issue a second link within the cooldown', async () => {
    await requestReset();
    await requestReset();

    expect(mail.messages).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/api && pnpm exec jest --config ./test/jest-e2e.json --runInBand test/e2e/auth/password-reset.e2e-spec.ts`
Expected: FAIL — 404 on `/api/v1/auth/forgot-password`.

- [ ] **Step 3: DTOs**

`forgot-password.request.dto.ts`:

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, MaxLength } from 'class-validator';
import {
  type Locale,
  SUPPORTED_LOCALES,
} from '../../../../shared/domain/locale';

export class ForgotPasswordRequestDto {
  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ required: false, enum: SUPPORTED_LOCALES, default: 'en' })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: Locale;
}
```

`reset-password.request.dto.ts`:

```typescript
import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  type Locale,
  SUPPORTED_LOCALES,
} from '../../../../shared/domain/locale';

export class ResetPasswordRequestDto {
  @ApiProperty({ description: 'Token from the reset link' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token!: string;

  // Length is enforced by the handler so it can answer WEAK_PASSWORD
  @ApiProperty({ description: 'New password (8-128 characters)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  new_password!: string;

  @ApiProperty({ required: false, enum: SUPPORTED_LOCALES, default: 'en' })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: Locale;
}
```

- [ ] **Step 4: Controller**

Add to `AuthController`:

```typescript
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { ttl: 60000, limit: THROTTLE_OFF ? 100_000 : 3 } })
  @ApiOperation({
    summary: 'Email a password reset link; always 202 so emails are not disclosed',
  })
  @ApiResponse({ status: 202 })
  async forgotPassword(
    @Body() dto: ForgotPasswordRequestDto,
  ): Promise<Record<string, never>> {
    await this.commandBus.execute(
      new RequestPasswordResetCommand(dto.email, dto.locale ?? 'en'),
    );
    return {};
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: THROTTLE_OFF ? 100_000 : 5 } })
  @ApiOperation({ summary: 'Set a new password with a reset token' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 400, description: 'INVALID_RESET_TOKEN or WEAK_PASSWORD' })
  async resetPassword(
    @Body() dto: ResetPasswordRequestDto,
  ): Promise<Record<string, never>> {
    await this.commandBus.execute(
      new ResetPasswordCommand(dto.token, dto.new_password, dto.locale ?? 'en'),
    );
    return {};
  }
```

At module level, replace the inline check in the class `@Throttle` with a shared constant and use it there too:

```typescript
const THROTTLE_OFF = process.env.THROTTLE_DISABLED === 'true';
```

Add controller unit tests to `auth.controller.spec.ts`:

```typescript
  describe('forgotPassword()', () => {
    it('dispatches RequestPasswordResetCommand and returns an empty object', async () => {
      const result = await controller.forgotPassword({ email: 'a@example.com' });

      const dispatched = mockCommandBus.execute.mock.calls[0][0];
      expect(dispatched).toBeInstanceOf(RequestPasswordResetCommand);
      expect(dispatched).toMatchObject({ email: 'a@example.com', locale: 'en' });
      expect(result).toEqual({});
    });
  });

  describe('resetPassword()', () => {
    it('dispatches ResetPasswordCommand', async () => {
      await controller.resetPassword({ token: 't', new_password: 'newPassword1', locale: 'vi' });

      expect(mockCommandBus.execute.mock.calls[0][0]).toMatchObject({
        token: 't',
        newPassword: 'newPassword1',
        locale: 'vi',
      });
    });
  });
```

- [ ] **Step 5: Redaction**

In `logger.module.ts` `redact.paths`, add:

```typescript
                'req.body.token',
                'req.body.new_password',
                'req.body.old_password',
```

- [ ] **Step 6: Run everything**

Run: `cd apps/api && pnpm exec jest && pnpm exec jest --config ./test/jest-e2e.json --runInBand && pnpm typecheck && pnpm lint`
Expected: PASS.

Manual: `mise run local:docker:up:api`, then
`curl -s -X POST localhost:8000/api/v1/auth/forgot-password -H 'content-type: application/json' -d '{"email":"admin@example.com","locale":"vi"}'`
Expected: `{"status_code":202,…,"data":{}}` and a Vietnamese email at `http://localhost:8025`.

---

# Phase 4 — Web UI

### Task 16: Web API client, service, error codes and route handlers

**Files:**
- Modify: `apps/web/src/types/auth.d.ts`, `apps/web/src/types/user.d.ts`
- Modify: `apps/web/src/apis/auth-api.ts`, `apps/web/src/apis/user-api.ts`
- Modify: `apps/web/src/services/auth.service.ts`, `apps/web/src/services/auth.service.test.ts`
- Modify: `apps/web/src/constants/error-codes.ts`, `apps/web/src/constants/routes.ts`, `apps/web/src/utils/routes.test.ts`
- Create: `apps/web/src/app/api/v1/auth/forgot-password/route.ts`, `apps/web/src/app/api/v1/auth/reset-password/route.ts`, `apps/web/src/app/api/v1/users/change-password/route.ts`
- Create: `apps/web/src/app/api/v1/password-routes.test.ts`

**Interfaces:**
- Consumes: API endpoints from Tasks 5 and 15; `auth`, `unstable_update` (Task 7).
- Produces:
  - types `IForgotPasswordRequest { email: string; locale: TLocale }`, `IResetPasswordRequest { token: string; new_password: string; locale: TLocale }`, `IChangePasswordRequest { old_password; new_password; locale?: TLocale }`;
  - `authApi.forgotPassword(data)`, `authApi.resetPassword(data)` → `Promise<Record<string, never>>`;
  - `userApi.changePassword(data: IChangePasswordRequest, options?: Omit<FetchOptions, "json">): Promise<ILoginData>`;
  - `authService.forgotPassword(email, locale)`, `authService.resetPassword(token, password, locale)`, `authService.changePassword(accessToken, oldPassword, newPassword, locale): Promise<ILoginData>`;
  - `AUTH_ERROR_CODES.INVALID_RESET_TOKEN | INVALID_CURRENT_PASSWORD | WEAK_PASSWORD | SESSION_REVOKED`;
  - web routes `POST /api/v1/auth/forgot-password` (200 `{}`), `POST /api/v1/auth/reset-password` (200 `{}`), `POST /api/v1/users/change-password` (200 `{}`; session updated server-side).

- [ ] **Step 1: Write failing tests**

Add to `auth.service.test.ts` (extend the `@/apis` mock with `forgotPassword`, `resetPassword` on `authApi` and `changePassword` on `userApi`, each delegating to a `vi.fn()`):

```typescript
describe("AuthService password flows", () => {
	const service = new AuthService();

	it("forwards a normalized email and locale for forgot-password", async () => {
		mockForgotPassword.mockResolvedValue({});
		await service.forgotPassword("  Alice@Example.com ", "vi");
		expect(mockForgotPassword).toHaveBeenCalledWith({ email: "alice@example.com", locale: "vi" });
	});

	it("rejects an invalid email before calling the API", async () => {
		await expectToThrow(service.forgotPassword("nope", "en"), "InvalidEmailException");
		expect(mockForgotPassword).not.toHaveBeenCalled();
	});

	it("rejects a short password on reset before calling the API", async () => {
		await expectToThrow(service.resetPassword("t", "short", "en"), "InvalidPasswordException");
		expect(mockResetPassword).not.toHaveBeenCalled();
	});

	it("changes the password with the caller's access token and returns the new pair", async () => {
		mockChangePassword.mockResolvedValue(TOKENS);

		await expect(service.changePassword("access", "oldPass12", "newPass12", "en")).resolves.toEqual(
			TOKENS,
		);
		expect(mockChangePassword).toHaveBeenCalledWith(
			{ old_password: "oldPass12", new_password: "newPass12", locale: "en" },
			{ headers: { Authorization: "Bearer access" } },
		);
	});
});
```

Add a `beforeEach(() => vi.clearAllMocks())` to that describe block if the file does not reset mocks globally.

`app/api/v1/password-routes.test.ts`:

```typescript
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	forgotPassword: vi.fn(),
	resetPassword: vi.fn(),
	changePassword: vi.fn(),
	auth: vi.fn(),
	unstableUpdate: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/utils/logger", () => ({ default: { error: vi.fn() } }));
vi.mock("@/services/auth.service", () => ({ authService: mocks }));
vi.mock("@/services/next-auth", () => ({
	auth: mocks.auth,
	unstable_update: mocks.unstableUpdate,
}));

const forgot = await import("./auth/forgot-password/route");
const reset = await import("./auth/reset-password/route");
const change = await import("./users/change-password/route");

const post = (url: string, body: unknown) =>
	new Request(`http://localhost${url}`, {
		method: "POST",
		body: JSON.stringify(body),
		headers: { "content-type": "application/json" },
	});

describe("password route handlers", () => {
	beforeEach(() => vi.clearAllMocks());

	it("forgot-password forwards email and locale and returns an empty object", async () => {
		const res = await forgot.POST(post("/api/v1/auth/forgot-password", { email: "a@b.co", locale: "vi" }) as never);

		expect(mocks.forgotPassword).toHaveBeenCalledWith("a@b.co", "vi");
		expect(res.status).toBe(200);
		expect((await res.json()).data).toEqual({});
	});

	it("reset-password forwards token, password and locale", async () => {
		await reset.POST(
			post("/api/v1/auth/reset-password", { token: "t", password: "newPass12", locale: "en" }) as never,
		);

		expect(mocks.resetPassword).toHaveBeenCalledWith("t", "newPass12", "en");
	});

	it("change-password requires a session", async () => {
		mocks.auth.mockResolvedValue(null);

		const res = await change.POST(post("/api/v1/users/change-password", {}) as never);

		expect(res.status).toBe(401);
		expect(mocks.changePassword).not.toHaveBeenCalled();
	});

	it("change-password stores the new pair in the session and does not return it", async () => {
		mocks.auth.mockResolvedValue({ accessToken: "access" });
		mocks.changePassword.mockResolvedValue({ access_token: "a2", refresh_token: "r2" });

		const res = await change.POST(
			post("/api/v1/users/change-password", {
				old_password: "oldPass12",
				new_password: "newPass12",
				locale: "en",
			}) as never,
		);

		expect(mocks.changePassword).toHaveBeenCalledWith("access", "oldPass12", "newPass12", "en");
		expect(mocks.unstableUpdate).toHaveBeenCalledWith({
			apiTokens: { access_token: "a2", refresh_token: "r2" },
		});
		const body = await res.json();
		expect(JSON.stringify(body)).not.toContain("a2");
	});

	it("unknown locales fall back to en", async () => {
		await forgot.POST(post("/api/v1/auth/forgot-password", { email: "a@b.co", locale: "fr" }) as never);

		expect(mocks.forgotPassword).toHaveBeenCalledWith("a@b.co", "en");
	});
});
```

`utils/routes.test.ts` — add `expect(isPrivateRoute("/reset-password")).toBe(false);` and `expect(isPrivateRoute("/settings/security")).toBe(true);`.

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/web && pnpm exec vitest run src/services src/app src/utils`
Expected: FAIL.

- [ ] **Step 3: Implement**

`types/auth.d.ts` — append:

```typescript
export interface IForgotPasswordRequest {
	email: string;
	locale: TLocale;
}

export interface IResetPasswordRequest {
	token: string;
	new_password: string;
	locale: TLocale;
}
```

(import `type { TLocale } from "@/i18n/config"`). In `types/user.d.ts`, add `locale?: TLocale;` to `IChangePasswordRequest`.

`apis/auth-api.ts` — add:

```typescript
	/** Request a reset link; the API answers the same for unknown emails */
	async forgotPassword(data: IForgotPasswordRequest): Promise<Record<string, never>> {
		return this.post<Record<string, never>>(this.buildUrl("/forgot-password"), data);
	}

	/** Set a new password with the token from the reset link */
	async resetPassword(data: IResetPasswordRequest): Promise<Record<string, never>> {
		return this.post<Record<string, never>>(this.buildUrl("/reset-password"), data);
	}
```

`apis/user-api.ts` — replace `changePassword`:

```typescript
	/**
	 * Change the current user's password
	 * @returns A new token pair; every other session is revoked
	 */
	async changePassword(
		data: IChangePasswordRequest,
		options?: Omit<FetchOptions, "json">,
	): Promise<ILoginData> {
		return this.post<ILoginData>(this.buildUrl("/change-password"), data, options);
	}
```

(Match the argument order of `BaseHttpClient.post` as checked in Task 7.)

`services/auth.service.ts` — add:

```typescript
	/**
	 * Requests a password reset email
	 * @throws {InvalidEmailException} If the email format is invalid
	 */
	async forgotPassword(email: string, locale: TLocale): Promise<void> {
		const normalized = email.trim().toLowerCase();
		if (!this.validateEmailFormat(normalized)) {
			throw new InvalidEmailException("Invalid email format");
		}
		await authApi.forgotPassword({ email: normalized, locale });
	}

	/**
	 * Sets a new password with a reset token
	 * @throws {InvalidPasswordException} If the password is too short
	 * @throws {HttpStatusError} 400 INVALID_RESET_TOKEN, forwarded by the route handler
	 */
	async resetPassword(token: string, password: string, locale: TLocale): Promise<void> {
		if (!this.validatePasswordFormat(password)) {
			throw new InvalidPasswordException("Password must be at least 8 characters");
		}
		await authApi.resetPassword({ token, new_password: password, locale });
	}

	/**
	 * Changes the password of the signed-in user
	 * @returns The new API token pair for the current session
	 */
	async changePassword(
		accessToken: string,
		oldPassword: string,
		newPassword: string,
		locale: TLocale,
	): Promise<ILoginData> {
		if (!this.validatePasswordFormat(newPassword)) {
			throw new InvalidPasswordException("Password must be at least 8 characters");
		}
		return userApi.changePassword(
			{ old_password: oldPassword, new_password: newPassword, locale },
			{ headers: { Authorization: `Bearer ${accessToken}` } },
		);
	}
```

`constants/error-codes.ts` — add to `AUTH_ERROR_CODES` and `AUTH_SERVICE_ERROR_CODES`:

```typescript
	INVALID_RESET_TOKEN: "INVALID_RESET_TOKEN",
	INVALID_CURRENT_PASSWORD: "INVALID_CURRENT_PASSWORD",
	WEAK_PASSWORD: "WEAK_PASSWORD",
	SESSION_REVOKED: "SESSION_REVOKED",
```

(in `AUTH_SERVICE_ERROR_CODES` reference `AUTH_ERROR_CODES.<KEY>` like the existing entries) and to `AUTH_ERROR_MESSAGE_IDS`:

```typescript
	[AUTH_ERROR_CODES.INVALID_RESET_TOKEN]: "pages.resetPassword.invalidToken",
	[AUTH_ERROR_CODES.INVALID_CURRENT_PASSWORD]: "pages.settingsSecurity.invalidCurrentPassword",
	[AUTH_ERROR_CODES.WEAK_PASSWORD]: "pages.login.validation.passwordMinLength",
	[AUTH_ERROR_CODES.SESSION_REVOKED]: "pages.login.reasons.session_expired",
```

`constants/routes.ts` — add `"/reset-password",` to `PUBLIC_ROUTES`.

Route handlers. Shared locale helper at the top of each file:

`app/api/v1/auth/forgot-password/route.ts`:

```typescript
import { defaultLocale, locales, type TLocale } from "@/i18n/config";
import { authService } from "@/services/auth.service";
import { _200, createApiRoute } from "@/utils/api-routes";

const toLocale = (value: unknown): TLocale =>
	locales.includes(value as TLocale) ? (value as TLocale) : defaultLocale;

export const POST = createApiRoute(async (request) => {
	const { email, locale } = await request.json();
	await authService.forgotPassword(String(email ?? ""), toLocale(locale));
	// Same answer whether or not the account exists
	return _200({}, "If the email is registered, a reset link has been sent");
});
```

Move `toLocale` into `apps/web/src/i18n/config.ts` as an export instead of repeating it:

```typescript
export const toLocale = (value: unknown): TLocale =>
	locales.includes(value as TLocale) ? (value as TLocale) : defaultLocale;
```

and import it from `@/i18n/config` in all three handlers.

`app/api/v1/auth/reset-password/route.ts`:

```typescript
import { toLocale } from "@/i18n/config";
import { authService } from "@/services/auth.service";
import { _200, createApiRoute } from "@/utils/api-routes";

export const POST = createApiRoute(async (request) => {
	const { token, password, locale } = await request.json();
	await authService.resetPassword(String(token ?? ""), String(password ?? ""), toLocale(locale));
	return _200({}, "Password has been reset");
});
```

`app/api/v1/users/change-password/route.ts`:

```typescript
import { toLocale } from "@/i18n/config";
import { authService } from "@/services/auth.service";
import { auth, unstable_update } from "@/services/next-auth";
import { _200, _401, createApiRoute } from "@/utils/api-routes";

export const POST = createApiRoute(async (request) => {
	const session = await auth();
	if (!session?.accessToken) {
		return _401();
	}

	const { old_password, new_password, locale } = await request.json();
	const tokens = await authService.changePassword(
		session.accessToken,
		String(old_password ?? ""),
		String(new_password ?? ""),
		toLocale(locale),
	);

	// Keep this browser signed in: the API revoked every token issued before
	await unstable_update({ apiTokens: tokens } as never);
	return _200({}, "Password changed");
});
```

The `as never` is needed because `unstable_update` is typed with `Partial<Session>`; add `apiTokens?: ILoginData` to the `Session` augmentation in `types/next-auth.d.ts` instead and drop the cast if that type-checks.

- [ ] **Step 4: Run tests, lint, typecheck**

Run: `cd apps/web && pnpm exec vitest run && pnpm lint && pnpm typecheck`
Expected: PASS.

---

### Task 17: Forgot-password and reset-password pages

**Files:**
- Create: `apps/web/src/components/auth/forgot-password-form.tsx`, `forgot-password-form.test.tsx`
- Create: `apps/web/src/components/auth/reset-password-form.tsx`, `reset-password-form.test.tsx`
- Create: `apps/web/src/app/[locale]/(unauthenticated)/forgot-password/page.tsx`
- Create: `apps/web/src/app/[locale]/(unauthenticated)/reset-password/page.tsx`
- Modify: `apps/web/src/components/auth/login-form.tsx`
- Modify: `apps/web/src/langs/en.json`, `apps/web/src/langs/vi.json`

**Interfaces:**
- Consumes: `authApi.forgotPassword`, `authApi.resetPassword` (Task 16; in the browser these hit the same-origin route handlers), `HttpStatusError`.
- Produces: `ForgotPasswordForm`, `ResetPasswordForm({ token }: { token: string | null })`; i18n namespaces `pages.forgotPassword`, `pages.resetPassword`.

Note on the browser path: the forms call `authApi.forgotPassword` / `authApi.resetPassword`. In the browser `API_BASE_URL` is empty, so these resolve to the web route handlers (`/api/v1/auth/...`), which use the field names those handlers read: forgot sends `{ email, locale }`; reset must send `{ token, password, locale }`. Because `authApi.resetPassword` sends `new_password` (the API's name), the reset form posts with `fetch` to the route handler instead of `authApi`, matching the handler's `password` field. Keep that split explicit in the code comment.

- [ ] **Step 1: Write failing component tests**

`forgot-password-form.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordForm } from "./forgot-password-form";

const mockForgot = vi.fn();
vi.mock("@/apis", () => ({
	authApi: { forgotPassword: (...args: unknown[]) => mockForgot(...args) },
	HttpStatusError: class extends Error {},
}));

describe("ForgotPasswordForm", () => {
	beforeEach(() => mockForgot.mockReset());

	it("shows the neutral confirmation after submitting", async () => {
		mockForgot.mockResolvedValue({});
		render(<ForgotPasswordForm />);

		fireEvent.change(screen.getByLabelText("email"), { target: { value: "a@b.co" } });
		fireEvent.click(screen.getByRole("button", { name: "submit" }));

		await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("sent"));
		expect(mockForgot).toHaveBeenCalledWith({ email: "a@b.co", locale: "en" });
	});

	it("shows the same confirmation when the request fails", async () => {
		mockForgot.mockRejectedValue(new Error("boom"));
		render(<ForgotPasswordForm />);

		fireEvent.change(screen.getByLabelText("email"), { target: { value: "a@b.co" } });
		fireEvent.click(screen.getByRole("button", { name: "submit" }));

		await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("sent"));
	});

	it("validates the email", async () => {
		render(<ForgotPasswordForm />);

		fireEvent.change(screen.getByLabelText("email"), { target: { value: "nope" } });
		fireEvent.click(screen.getByRole("button", { name: "submit" }));

		await waitFor(() => expect(screen.getByText("validation.invalidEmail")).toBeInTheDocument());
		expect(mockForgot).not.toHaveBeenCalled();
	});
});
```

(The global next-intl mock returns keys, so `"email"`, `"submit"`, `"sent"` are the translation keys used below.)

`reset-password-form.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResetPasswordForm } from "./reset-password-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const fill = (password: string, confirm = password) => {
	fireEvent.change(screen.getByLabelText("password"), { target: { value: password } });
	fireEvent.change(screen.getByLabelText("confirmPassword"), { target: { value: confirm } });
	fireEvent.click(screen.getByRole("button", { name: "submit" }));
};

describe("ResetPasswordForm", () => {
	afterEach(() => vi.restoreAllMocks());

	it("posts token and password, then goes to login with a banner", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
		render(<ResetPasswordForm token="tok" />);

		fill("newPass123");

		await waitFor(() => expect(push).toHaveBeenCalledWith("/en/login?reason=password_reset"));
		expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
			token: "tok",
			password: "newPass123",
			locale: "en",
		});
	});

	it("explains an invalid or expired link", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ error: "INVALID_RESET_TOKEN" }), { status: 400 }),
		);
		render(<ResetPasswordForm token="tok" />);

		fill("newPass123");

		await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("invalidToken"));
	});

	it("requires matching passwords", async () => {
		render(<ResetPasswordForm token="tok" />);

		fill("newPass123", "different1");

		await waitFor(() =>
			expect(screen.getByText("validation.passwordsNotMatch")).toBeInTheDocument(),
		);
	});

	it("shows the invalid-link message without a token", () => {
		render(<ResetPasswordForm token={null} />);

		expect(screen.getByRole("alert")).toHaveTextContent("invalidToken");
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/web && pnpm exec vitest run src/components/auth`
Expected: FAIL.

- [ ] **Step 3: Implement the forms**

`forgot-password-form.tsx`:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { authApi } from "@/apis";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { TLocale } from "@/i18n/config";

const RESEND_COOLDOWN_S = 60;

export const ForgotPasswordForm = () => {
	const locale = useLocale() as TLocale;
	const t = useTranslations("pages.forgotPassword");
	const [sent, setSent] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [cooldown, setCooldown] = useState(0);

	useEffect(() => {
		if (cooldown <= 0) return;
		const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
		return () => clearTimeout(timer);
	}, [cooldown]);

	const schema = z.object({ email: z.string().email(t("validation.invalidEmail")) });
	type TFormData = z.infer<typeof schema>;
	const form = useForm<TFormData>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

	const onSubmit = async (data: TFormData) => {
		setIsLoading(true);
		try {
			await authApi.forgotPassword({ email: data.email, locale });
		} catch {
			// Same message either way: never reveal whether the account exists
		} finally {
			setSent(true);
			setCooldown(RESEND_COOLDOWN_S);
			setIsLoading(false);
		}
	};

	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>{t("title")}</CardTitle>
				<CardDescription>{t("description")}</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("email")}</FormLabel>
									<FormControl>
										<Input type="email" autoComplete="email" disabled={isLoading} {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						{sent && (
							<div role="status" className="rounded-md bg-muted p-3 text-muted-foreground text-sm">
								{t("sent")}
							</div>
						)}

						<Button type="submit" className="w-full" disabled={isLoading || cooldown > 0}>
							{cooldown > 0 ? t("resendIn", { seconds: cooldown }) : t("submit")}
						</Button>

						<div className="text-center text-muted-foreground text-sm">
							<Link href={`/${locale}/login`} className="text-primary hover:underline">
								{t("backToLogin")}
							</Link>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
};
```

`reset-password-form.tsx`:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { PasswordInput } from "@/components/common/password-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { AUTH_ERROR_CODES } from "@/constants";

interface IResetPasswordFormProps {
	token: string | null;
}

export const ResetPasswordForm = ({ token }: IResetPasswordFormProps) => {
	const router = useRouter();
	const locale = useLocale();
	const t = useTranslations("pages.resetPassword");
	const [error, setError] = useState(token ? "" : t("invalidToken"));
	const [isLoading, setIsLoading] = useState(false);

	const schema = z
		.object({
			password: z
				.string()
				.min(8, t("validation.passwordMinLength"))
				.max(128, t("validation.passwordMaxLength")),
			confirmPassword: z.string(),
		})
		.refine((d) => d.password === d.confirmPassword, {
			message: t("validation.passwordsNotMatch"),
			path: ["confirmPassword"],
		});
	type TFormData = z.infer<typeof schema>;
	const form = useForm<TFormData>({
		resolver: zodResolver(schema),
		defaultValues: { password: "", confirmPassword: "" },
	});

	const onSubmit = async (data: TFormData) => {
		if (!token) return;
		setIsLoading(true);
		setError("");
		try {
			// Posts to the web route handler, whose body uses `password`
			const res = await fetch("/api/v1/auth/reset-password", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ token, password: data.password, locale }),
			});
			if (res.ok) {
				router.push(`/${locale}/login?reason=password_reset`);
				return;
			}
			const body = (await res.json().catch(() => ({}))) as { error?: string };
			setError(
				body.error === AUTH_ERROR_CODES.INVALID_RESET_TOKEN ? t("invalidToken") : t("generalError"),
			);
		} catch {
			setError(t("generalError"));
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>{t("title")}</CardTitle>
				<CardDescription>{t("description")}</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="password"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("password")}</FormLabel>
									<FormControl>
										<PasswordInput autoComplete="new-password" disabled={isLoading || !token} {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="confirmPassword"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("confirmPassword")}</FormLabel>
									<FormControl>
										<PasswordInput autoComplete="new-password" disabled={isLoading || !token} {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						{error && (
							<div role="alert" className="rounded-md bg-red-50 p-3 text-red-500 text-sm dark:bg-red-950">
								{error}{" "}
								<Link href={`/${locale}/forgot-password`} className="underline">
									{t("requestNew")}
								</Link>
							</div>
						)}

						<Button type="submit" className="w-full" disabled={isLoading || !token}>
							{isLoading ? t("submitting") : t("submit")}
						</Button>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
};
```

Check that `PasswordInput` forwards `id`/`aria` props so `getByLabelText` works (`src/components/common/password-input.tsx`); `FormControl` supplies the `id`.

- [ ] **Step 4: Pages**

`app/[locale]/(unauthenticated)/forgot-password/page.tsx`:

```tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import type { ILocalePageProps } from "@/types/page";

export async function generateMetadata({ params }: ILocalePageProps): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "pages.forgotPassword" });

	return {
		title: t("title"),
		description: t("description"),
		alternates: {
			canonical: `/${locale}/forgot-password`,
			languages: { en: "/en/forgot-password", vi: "/vi/forgot-password" },
		},
	};
}

const ForgotPasswordPage = () => (
	<div className="flex min-h-screen items-center justify-center p-4">
		<ForgotPasswordForm />
	</div>
);

export default ForgotPasswordPage;
```

`app/[locale]/(unauthenticated)/reset-password/page.tsx`:

```tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import type { ILocalePageProps } from "@/types/page";

export async function generateMetadata({ params }: ILocalePageProps): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "pages.resetPassword" });

	return {
		title: t("title"),
		description: t("description"),
		// The URL carries a secret token: keep it out of Referer headers and indexes
		referrer: "no-referrer",
		robots: { index: false, follow: false },
	};
}

interface IResetPasswordPageProps extends ILocalePageProps {
	searchParams: Promise<{ token?: string }>;
}

const ResetPasswordPage = async ({ searchParams }: IResetPasswordPageProps) => {
	const { token } = await searchParams;
	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<ResetPasswordForm token={token ?? null} />
		</div>
	);
};

export default ResetPasswordPage;
```

Check `types/page.d.ts`: if `ILocalePageProps` already declares `searchParams`, use it instead of extending.

- [ ] **Step 5: Login link**

In `login-form.tsx`, after the password `FormField`:

```tsx
						<div className="text-right text-sm">
							<Link href={`/${locale}/forgot-password`} className="text-primary hover:underline">
								{t("forgotPassword")}
							</Link>
						</div>
```

- [ ] **Step 6: Strings**

`langs/en.json`: add `pages.login.forgotPassword: "Forgot password?"` and:

```json
"forgotPassword": {
	"title": "Forgot password",
	"description": "Enter your email and we will send you a link to reset your password.",
	"email": "Email",
	"submit": "Send reset link",
	"resendIn": "Resend in {seconds}s",
	"sent": "If an account exists for that email, a reset link has been sent. Check your inbox.",
	"backToLogin": "Back to sign in",
	"validation": { "invalidEmail": "Invalid email address" }
},
"resetPassword": {
	"title": "Set a new password",
	"description": "Choose a new password for your account.",
	"password": "New password",
	"confirmPassword": "Confirm new password",
	"submit": "Reset password",
	"submitting": "Resetting...",
	"invalidToken": "This reset link is invalid or has expired.",
	"requestNew": "Request a new link",
	"generalError": "An error occurred. Please try again.",
	"validation": {
		"passwordMinLength": "Password must be at least 8 characters",
		"passwordMaxLength": "Password must be at most 128 characters",
		"passwordsNotMatch": "Passwords do not match"
	}
}
```

`langs/vi.json`: `pages.login.forgotPassword: "Quên mật khẩu?"` and:

```json
"forgotPassword": {
	"title": "Quên mật khẩu",
	"description": "Nhập email, chúng tôi sẽ gửi link để đặt lại mật khẩu.",
	"email": "Email",
	"submit": "Gửi link đặt lại",
	"resendIn": "Gửi lại sau {seconds}s",
	"sent": "Nếu email này có tài khoản, chúng tôi đã gửi link đặt lại. Hãy kiểm tra hộp thư.",
	"backToLogin": "Quay lại đăng nhập",
	"validation": { "invalidEmail": "Email không hợp lệ" }
},
"resetPassword": {
	"title": "Đặt mật khẩu mới",
	"description": "Chọn mật khẩu mới cho tài khoản của bạn.",
	"password": "Mật khẩu mới",
	"confirmPassword": "Xác nhận mật khẩu mới",
	"submit": "Đặt lại mật khẩu",
	"submitting": "Đang đặt lại...",
	"invalidToken": "Link đặt lại không hợp lệ hoặc đã hết hạn.",
	"requestNew": "Yêu cầu link mới",
	"generalError": "Đã có lỗi xảy ra. Vui lòng thử lại.",
	"validation": {
		"passwordMinLength": "Mật khẩu phải có ít nhất 8 ký tự",
		"passwordMaxLength": "Mật khẩu tối đa 128 ký tự",
		"passwordsNotMatch": "Mật khẩu không khớp"
	}
}
```

- [ ] **Step 7: Run tests, lint, typecheck, build**

Run: `cd apps/web && pnpm exec vitest run && pnpm lint && pnpm typecheck && pnpm build`
Expected: PASS; build lists `/[locale]/forgot-password` and `/[locale]/reset-password`.

---

### Task 18: Settings → Security (change password)

**Files:**
- Create: `apps/web/src/components/settings/change-password-form.tsx`, `change-password-form.test.tsx`
- Create: `apps/web/src/app/[locale]/(authenticated)/settings/security/page.tsx`
- Modify: `apps/web/src/components/layout/private-sidebar.tsx`
- Modify: `apps/web/src/langs/en.json`, `apps/web/src/langs/vi.json`

**Interfaces:**
- Consumes: web route `POST /api/v1/users/change-password` (Task 16), `useSession().update` from `next-auth/react` (re-reads the server-updated cookie).
- Produces: `ChangePasswordForm`; namespace `pages.settingsSecurity`.

- [ ] **Step 1: Write the failing test**

`change-password-form.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChangePasswordForm } from "./change-password-form";

const update = vi.fn();
vi.mock("next-auth/react", () => ({ useSession: () => ({ update }) }));

const submit = (current: string, next: string, confirm = next) => {
	fireEvent.change(screen.getByLabelText("currentPassword"), { target: { value: current } });
	fireEvent.change(screen.getByLabelText("newPassword"), { target: { value: next } });
	fireEvent.change(screen.getByLabelText("confirmPassword"), { target: { value: confirm } });
	fireEvent.click(screen.getByRole("button", { name: "submit" }));
};

describe("ChangePasswordForm", () => {
	afterEach(() => vi.restoreAllMocks());

	it("changes the password, refreshes the session and confirms", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
		render(<ChangePasswordForm />);

		submit("oldPass123", "newPass123");

		await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("success"));
		expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
			old_password: "oldPass123",
			new_password: "newPass123",
			locale: "en",
		});
		expect(update).toHaveBeenCalled();
	});

	it("reports a wrong current password", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ error: "INVALID_CURRENT_PASSWORD" }), { status: 401 }),
		);
		render(<ChangePasswordForm />);

		submit("wrongPass1", "newPass123");

		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent("invalidCurrentPassword"),
		);
	});

	it("rejects a new password equal to the current one", async () => {
		render(<ChangePasswordForm />);

		submit("samePass123", "samePass123");

		await waitFor(() =>
			expect(screen.getByText("validation.sameAsCurrent")).toBeInTheDocument(),
		);
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/web && pnpm exec vitest run src/components/settings`
Expected: FAIL.

- [ ] **Step 3: Implement**

`change-password-form.tsx`:

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { PasswordInput } from "@/components/common/password-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { AUTH_ERROR_CODES } from "@/constants";

export const ChangePasswordForm = () => {
	const locale = useLocale();
	const t = useTranslations("pages.settingsSecurity");
	const { update } = useSession();
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);
	const [isLoading, setIsLoading] = useState(false);

	const schema = z
		.object({
			currentPassword: z.string().min(1, t("validation.required")),
			newPassword: z
				.string()
				.min(8, t("validation.passwordMinLength"))
				.max(128, t("validation.passwordMaxLength")),
			confirmPassword: z.string(),
		})
		.refine((d) => d.newPassword === d.confirmPassword, {
			message: t("validation.passwordsNotMatch"),
			path: ["confirmPassword"],
		})
		.refine((d) => d.newPassword !== d.currentPassword, {
			message: t("validation.sameAsCurrent"),
			path: ["newPassword"],
		});
	type TFormData = z.infer<typeof schema>;
	const form = useForm<TFormData>({
		resolver: zodResolver(schema),
		defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
	});

	const onSubmit = async (data: TFormData) => {
		setIsLoading(true);
		setError("");
		setSuccess(false);
		try {
			const res = await fetch("/api/v1/users/change-password", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					old_password: data.currentPassword,
					new_password: data.newPassword,
					locale,
				}),
			});
			if (res.ok) {
				// The route handler stored the new tokens in the cookie; reload them client-side
				await update();
				form.reset();
				setSuccess(true);
				return;
			}
			const body = (await res.json().catch(() => ({}))) as { error?: string };
			setError(
				body.error === AUTH_ERROR_CODES.INVALID_CURRENT_PASSWORD
					? t("invalidCurrentPassword")
					: t("generalError"),
			);
		} catch {
			setError(t("generalError"));
		} finally {
			setIsLoading(false);
		}
	};

	const field = (name: keyof TFormData, autoComplete: string) => (
		<FormField
			control={form.control}
			name={name}
			render={({ field: input }) => (
				<FormItem>
					<FormLabel>{t(name)}</FormLabel>
					<FormControl>
						<PasswordInput autoComplete={autoComplete} disabled={isLoading} {...input} />
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>
	);

	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>{t("title")}</CardTitle>
				<CardDescription>{t("description")}</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						{field("currentPassword", "current-password")}
						{field("newPassword", "new-password")}
						{field("confirmPassword", "new-password")}

						{error && (
							<div role="alert" className="rounded-md bg-red-50 p-3 text-red-500 text-sm dark:bg-red-950">
								{error}
							</div>
						)}
						{success && (
							<div role="status" className="rounded-md bg-muted p-3 text-muted-foreground text-sm">
								{t("success")}
							</div>
						)}

						<Button type="submit" className="w-full" disabled={isLoading}>
							{isLoading ? t("submitting") : t("submit")}
						</Button>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
};
```

`useSession` needs a `SessionProvider` above it. Check `src/components/providers/`; if the authenticated layout does not wrap children in `SessionProvider`, wrap `ChangePasswordForm` in the page with `<SessionProvider>` from `next-auth/react`.

`app/[locale]/(authenticated)/settings/security/page.tsx`:

```tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import type { ILocalePageProps } from "@/types/page";

export async function generateMetadata({ params }: ILocalePageProps): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "pages.settingsSecurity" });
	return { title: t("title"), robots: { index: false, follow: false } };
}

const SecuritySettingsPage = () => (
	<div className="p-4 md:p-8">
		<ChangePasswordForm />
	</div>
);

export default SecuritySettingsPage;
```

`private-sidebar.tsx`: change the settings item `href` to `` `/${locale}/settings/security` ``.

Strings — `langs/en.json` `pages.settingsSecurity`:

```json
"settingsSecurity": {
	"title": "Security",
	"description": "Change your password. Other devices will be signed out.",
	"currentPassword": "Current password",
	"newPassword": "New password",
	"confirmPassword": "Confirm new password",
	"submit": "Change password",
	"submitting": "Saving...",
	"success": "Password changed. Other sessions have been signed out.",
	"invalidCurrentPassword": "Current password is incorrect.",
	"generalError": "An error occurred. Please try again.",
	"validation": {
		"required": "Required",
		"passwordMinLength": "Password must be at least 8 characters",
		"passwordMaxLength": "Password must be at most 128 characters",
		"passwordsNotMatch": "Passwords do not match",
		"sameAsCurrent": "New password must differ from the current one"
	}
}
```

`langs/vi.json`:

```json
"settingsSecurity": {
	"title": "Bảo mật",
	"description": "Đổi mật khẩu. Các thiết bị khác sẽ bị đăng xuất.",
	"currentPassword": "Mật khẩu hiện tại",
	"newPassword": "Mật khẩu mới",
	"confirmPassword": "Xác nhận mật khẩu mới",
	"submit": "Đổi mật khẩu",
	"submitting": "Đang lưu...",
	"success": "Đã đổi mật khẩu. Các phiên khác đã bị đăng xuất.",
	"invalidCurrentPassword": "Mật khẩu hiện tại không đúng.",
	"generalError": "Đã có lỗi xảy ra. Vui lòng thử lại.",
	"validation": {
		"required": "Bắt buộc",
		"passwordMinLength": "Mật khẩu phải có ít nhất 8 ký tự",
		"passwordMaxLength": "Mật khẩu tối đa 128 ký tự",
		"passwordsNotMatch": "Mật khẩu không khớp",
		"sameAsCurrent": "Mật khẩu mới phải khác mật khẩu hiện tại"
	}
}
```

- [ ] **Step 4: Run tests, lint, typecheck, build**

Run: `cd apps/web && pnpm exec vitest run && pnpm lint && pnpm typecheck && pnpm build`
Expected: PASS.

---

### Task 19: Playwright end-to-end flows

**Files:**
- Create: `apps/web/e2e/utils/mailpit.ts`
- Create: `apps/web/e2e/tests/auth/password-reset.spec.ts`

**Interfaces:**
- Consumes: the Docker stack (api + postgres + mailpit) from `mise run local:docker:up:api`, web pages from Tasks 17–18.

- [ ] **Step 1: Write the tests**

`e2e/utils/mailpit.ts`:

```typescript
import type { APIRequestContext } from "@playwright/test";

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";

/** Polls Mailpit for the newest message to `email` and returns its reset token. */
export async function waitForResetToken(request: APIRequestContext, email: string): Promise<string> {
	for (let attempt = 0; attempt < 20; attempt++) {
		const list = await request.get(`${MAILPIT_URL}/api/v1/search`, {
			params: { query: `to:${email} subject:"Reset your password"` },
		});
		const { messages } = (await list.json()) as { messages: Array<{ ID: string }> };
		if (messages.length > 0) {
			const message = await request.get(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`);
			const { Text } = (await message.json()) as { Text: string };
			const match = /reset-password\?token=([^\s&]+)/.exec(Text);
			if (match) return decodeURIComponent(match[1]);
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	throw new Error(`No reset email for ${email}`);
}
```

`e2e/tests/auth/password-reset.spec.ts`:

```typescript
import { expect, test } from "@playwright/test";
import { LoginPage } from "../../pages/LoginPage";
import { waitForResetToken } from "../../utils/mailpit";

const API_URL = process.env.API_BASE_URL ?? "http://localhost:8000";

test.describe("Password management", () => {
	let user: { email: string; username: string; password: string };

	test.beforeEach(async ({ request }) => {
		const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
		user = { email: `pw-${id}@example.com`, username: `pw_${id}`, password: "originalPass1" };
		const res = await request.post(`${API_URL}/api/v1/auth/register`, { data: user });
		expect(res.ok()).toBeTruthy();
	});

	test("forgot password → email link → reset → sign in with the new password", async ({
		page,
		request,
	}) => {
		await page.goto("/en/login");
		await page.getByRole("link", { name: "Forgot password?" }).click();
		await page.getByLabel("Email").fill(user.email);
		await page.getByRole("button", { name: "Send reset link" }).click();
		await expect(page.getByRole("status")).toContainText("reset link has been sent");

		const token = await waitForResetToken(request, user.email);
		await page.goto(`/en/reset-password?token=${encodeURIComponent(token)}`);
		await page.getByLabel("New password", { exact: true }).fill("brandNewPass1");
		await page.getByLabel("Confirm new password").fill("brandNewPass1");
		await page.getByRole("button", { name: "Reset password" }).click();

		await page.waitForURL("**/login?reason=password_reset");
		await expect(page.getByRole("status")).toContainText("password has been reset");

		const login = new LoginPage(page);
		await login.login(user.email, "brandNewPass1");
		await page.waitForURL("**/dashboard");
	});

	test("a used reset link is rejected", async ({ page, request }) => {
		await request.post(`${API_URL}/api/v1/auth/forgot-password`, {
			data: { email: user.email, locale: "en" },
		});
		const token = await waitForResetToken(request, user.email);
		await request.post(`${API_URL}/api/v1/auth/reset-password`, {
			data: { token, new_password: "firstReset123" },
		});

		await page.goto(`/en/reset-password?token=${encodeURIComponent(token)}`);
		await page.getByLabel("New password", { exact: true }).fill("secondReset12");
		await page.getByLabel("Confirm new password").fill("secondReset12");
		await page.getByRole("button", { name: "Reset password" }).click();

		await expect(page.getByRole("alert")).toContainText("invalid or has expired");
	});

	test("change password keeps the session and the new password works", async ({ page }) => {
		const login = new LoginPage(page);
		await login.goto();
		await login.login(user.email, user.password);
		await page.waitForURL("**/dashboard");

		await page.goto("/en/settings/security");
		await page.getByLabel("Current password").fill(user.password);
		await page.getByLabel("New password", { exact: true }).fill("changedPass12");
		await page.getByLabel("Confirm new password").fill("changedPass12");
		await page.getByRole("button", { name: "Change password" }).click();
		await expect(page.getByRole("status")).toContainText("Password changed");

		await page.goto("/en/dashboard");
		await expect(page).toHaveURL(/\/en\/dashboard/);
	});
});
```

`LoginPage.passwordInput` uses `getByLabel("Password")`; the login page has only one password field, so it still matches after Task 17. If the "Forgot password?" link makes the label match ambiguous, change `LoginPage` to `getByLabel("Password", { exact: true })`.

- [ ] **Step 2: Run against the stack**

Run:

```bash
mise run local:docker:up:api
cd apps/web && pnpm exec playwright test e2e/tests/auth
```

Expected: all tests PASS (the existing login tests included). Port 3333 must be free; the Playwright config starts `pnpm dev --port 3333` with `NODE_ENV=test`, which reads `apps/web/.env.test` (`API_BASE_URL` → `http://localhost:8000`).

If the reset email contains `http://localhost:3000/...` links, that is expected — the test extracts only the token.

---

### Task 20: Full verification

**Files:** none.

- [ ] **Step 1: Whole-repo checks**

Run: `pnpm nx run-many -t lint typecheck test build --skip-nx-cache`
Expected: all targets succeed for both projects.

- [ ] **Step 2: API integration and e2e**

Run: `cd apps/api && pnpm test:integration && pnpm test:e2e`
Expected: PASS.

- [ ] **Step 3: Production images**

Run: `docker compose -f docker-compose.yml up --build -d --wait && docker compose -f docker-compose.yml exec -T api wget -qO- http://127.0.0.1:8000/v1/health && docker compose -f docker-compose.yml down`
Expected: health `{"status":"ok"}` inside the envelope; the migrations folder in the image contains `0002` and `0003`.

- [ ] **Step 4: Spec walk-through**

Open the spec and tick each Goal against the running dev stack:
forgot → Mailpit email (en and vi) → reset → old sessions rejected; change password in Settings → Security keeps the session; leaving the dashboard idle past `JWT_ACCESS_EXPIRES_IN` keeps working (auto-refresh).
Report anything that does not match.

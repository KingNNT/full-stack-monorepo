---
paths:
  - "apps/api/**/*.ts"
---

# API Security

## JWT Authentication

- **Access token**: short-lived, secret `JWT_ACCESS_SECRET` — used for API authorization
- **Refresh token**: long-lived, secret `JWT_REFRESH_SECRET` — used only to obtain new access tokens
- Each token type has its own Passport strategy (`JwtStrategy`, `JwtRefreshStrategy`) with separate secrets — an access token must never validate as a refresh token
- Token expiry configurable via `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN`
- Extract from `Authorization: Bearer <token>` header only — never from query params or cookies

## Input Validation — Dual Layer

1. **DTO layer** (presentation): class-validator decorators — `@IsEmail()`, `@MinLength()`, `@MaxLength()`, `@IsNotEmpty()`
2. **Domain layer**: value object `create()` methods — validate format, normalize data
3. **Global ValidationPipe**: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` — strips unknown fields

Both layers must validate independently. DTOs catch malformed requests early; domain objects enforce business invariants.

## Password Security

- Bcrypt with `SALT_ROUNDS = 12`
- Interface: `IPasswordHasher` with `hash()` and `verify()` — abstracted behind DI token
- Hash stored in `auth_credentials` table, separate from user aggregate
- Constraints: min 8, max 128 characters (validated in DTO)

## Auth Error Messages Must Be Vague

- Login failures: always return `"Invalid credentials"` — never reveal whether email or password was wrong
- Log the actual reason server-side: `reason: 'not_found' | 'inactive' | 'bad_password'`
- Reject inactive accounts with the same vague message

## HTTP Status Codes

| Status | Usage                                           |
| ------ | ----------------------------------------------- |
| 400    | Validation failures (malformed input)           |
| 401    | Authentication failures (bad credentials, expired token) |
| 409    | Business conflicts (duplicate email/username)   |

Never return 500 for expected business errors — map to appropriate 4xx codes.

## Audit Trail

- Every table includes: `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `deletedAt`, `deletedBy`
- `AuditableTableService` auto-injects user ID from CLS (request context)
- `ClsUserInterceptor` extracts JWT `sub` claim → stores in CLS at request start
- Never bypass the auditable service — all mutations must be audited

## Soft Deletes

- Use `deletedAt` timestamp — never hard-delete user data
- All repository queries must include `isNull(table.deletedAt)` in WHERE clauses

## Duplicate Prevention

- Check for existing email AND username before registration — separate checks
- Database unique constraints on `auth_credentials.email` and `auth_credentials.username` as backup
- Application-level check first (better error messages), DB constraint as safety net

## Concurrency Control

- Event store uses optimistic locking — check expected version before appending events
- `ConcurrencyError` thrown on version mismatch — handlers should not retry automatically
- Read model projection failures are logged but non-blocking (eventual consistency)

## Environment & Secrets

- All secrets via environment variables — never hardcoded
- `.env.example` documents required variables — keep updated when adding new ones
- Test environments: override with test-specific values — never use production secrets in tests

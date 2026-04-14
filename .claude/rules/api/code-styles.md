---
paths:
  - "apps/api/**/*.ts"
---

# API Code Styles

## Package Manager

- **pnpm only** — never use npm, npx, or yarn. Use `pnpm` / `pnpm exec` / `pnpm dlx` instead.

## Formatting

- Single quotes, 2-space indentation, 80-char line width (see `apps/api/biome.json`)
- Use `import type` for type-only imports

## Naming

| Concept            | Pattern                          | Example                              |
| ------------------ | -------------------------------- | ------------------------------------ |
| Controller         | `{Domain}Controller`             | `AuthController`                     |
| Command            | `{Action}Command`                | `RegisterCommand`, `LoginCommand`    |
| Command Handler    | `{Action}Handler`                | `RegisterHandler`                    |
| Repository         | `{Entity}Repository`             | `AuthCredentialsRepository`          |
| Service impl       | `{Name}Impl` or `{Tech}{Name}`  | `TokenServiceImpl`, `BcryptPasswordHasher` |
| Value Object       | Simple noun, `.vo.ts` suffix     | `Email`, `UserId`, `Username`        |
| Aggregate          | `{Entity}Aggregate`              | `UserAggregate`                      |
| Domain Event       | `{Entity}{Action}Event`          | `UserCreatedEvent`                   |
| Integration Event  | `{Entity}{Action}IntegrationEvent` | `UserRegisteredIntegrationEvent`   |
| DTO (request)      | `{Action}RequestDto`             | `LoginRequestDto`                    |
| DTO (response)     | `{Action}ResponseDto`            | `LoginResponseDto`                   |
| Guard              | `Jwt{Type}Guard`                 | `JwtAuthGuard`, `JwtRefreshGuard`    |
| DI Token           | `{NAME}_TOKEN` symbol            | `PASSWORD_HASHER_TOKEN`              |

## File Naming

- Source: `kebab-case` — `auth-credentials.repository.ts`, `user.aggregate.ts`, `email.vo.ts`
- Unit tests: co-located as `{name}.spec.ts`
- Integration tests: `test/integration/{domain}/{name}.integration.spec.ts`
- E2E tests: `test/e2e/{domain}/{endpoint}.e2e-spec.ts`

## DDD Layering

Every domain module follows this structure — do not flatten or merge layers:

```
src/modules/{domain}/
  ├── application/       # Commands, queries, handlers — orchestration only
  ├── domain/            # Aggregates, value objects, events, repository interfaces (ports)
  ├── infrastructure/    # Repository implementations, external service adapters
  └── presentation/      # Controllers, DTOs, guards
```

Cross-cutting concerns live in `src/shared/` with the same layering.

## Dependency Injection

- Define interfaces (ports) in `domain/` or `application/ports/`
- Create Symbol tokens: `export const FOO_TOKEN = Symbol('IFoo')`
- Bind in module with `{ provide: FOO_TOKEN, useExisting: FooImpl }`
- Inject via `@Inject(FOO_TOKEN)`
- Never import infrastructure directly from application or domain layers

## Commands & Handlers

- Commands are plain readonly POJOs — no decorators, no validation logic
- Handlers implement `ICommandHandler<Command, Result>` with a single `execute()` method
- Handler flow: validate preconditions → call domain services → create/load aggregates → persist via UnitOfWork
- Return simple result interfaces, not DTOs — controllers transform results to DTOs

## Aggregates & Value Objects

- Aggregates use static `create()` for new instances and `reconstitute(events)` for rebuilding from event store
- Value objects use static `create()` with validation, freeze props in constructor
- Domain events are applied via `apply(event)` on aggregates — never mutate state directly
- Test aggregates by asserting `getUncommittedEvents()` after state transitions

## Controllers

- One controller per bounded context, one method per endpoint
- Flow: receive DTO → execute command via `CommandBus` → transform result to response DTO
- Use `@ApiTags()`, `@ApiOperation()`, `@ApiResponse()` for Swagger documentation
- `@ApiTags()` values must use title-case display names — capitalize each segment and keep acronyms uppercase (e.g. `Auth`, `RBAC`, `RBAC / Roles`, `RBAC / Permissions`). The tag is a human-facing section header in Swagger UI and must not mirror the lowercase route prefix.
- Response DTOs use `@Exclude()` / `@Expose({ name: 'snake_case' })` for field transformation

## Request Payload Casing

| Location                      | Casing       | Example                                |
| ----------------------------- | ------------ | -------------------------------------- |
| URL query params (`@Query()`) | `kebab-case` | `?page-size=20&sort-by=created-at`     |
| Request body (`@Body()`)      | `snake_case` | `{ "old_password": "...", "new_password": "..." }` |
| Path params                   | `kebab-case` | `/users/:user-id/roles`                |

- Multi-word body fields MUST be `snake_case` — matches the response envelope (`ISuccessResponse<T>` contract) so FE sees a single case convention over the wire.
- Query params MUST be `kebab-case` — reserve `snake_case` for JSON payloads only; keep URLs URL-idiomatic.
- Single-word fields (`email`, `password`, `name`) are unambiguous — no transform needed either way.
- In TypeScript DTOs, declare the property with the wire name directly (e.g. `old_password!: string`) rather than relying on class-transformer aliasing on input DTOs — keeps validators readable.

## Response Format

All API responses (success and error) MUST be wrapped in a consistent envelope. Controllers return bare DTOs — a global `TransformInterceptor` wraps successes, and `AllExceptionsFilter` formats errors. Never wrap manually inside a controller.

### Success envelope

```json
{
  "status_code": 200,
  "success": true,
  "message": "OK",
  "data": { /* DTO or list payload */ }
}
```

- Fields are `snake_case` — matches the FE `ISuccessResponse<T>` contract
- `status_code` mirrors the HTTP status
- `message` is a short human-readable summary (default `"OK"` / `"Created"`) — localize on the FE, not here
- `data` holds the DTO; never `null` on success (use `{}` or an empty list instead)

### Error envelope

```json
{
  "status_code": 400,
  "success": false,
  "message": "Email is required",
  "error": "VALIDATION_ERROR"
}
```

- `error` is a stable `UPPER_SNAKE_CASE` code the FE maps to i18n messages — never change casually
- Map domain exceptions to 4xx codes; only unexpected failures become 500
- Include `errorTraceId` when available (from CLS / request context) for debugging

### List format

List endpoints return `items` plus a `meta` block inside `data`:

```json
{
  "status_code": 200,
  "success": true,
  "message": "OK",
  "data": {
    "items": [ /* DTOs */ ],
    "meta": {
      "page": 1,
      "page_size": 20,
      "total_items": 137,
      "total_pages": 7,
      "has_next": true,
      "has_previous": false
    }
  }
}
```

- Default `page=1`, `page_size=20` in the response (cap `page_size` at 100)
- Query params (kebab-case): `?page=`, `?page-size=`, `?sort=field:asc|desc`, `?filter[field]=value` — note the response envelope mirrors these as `page_size`, etc.
- Always return `items` (even empty `[]`) and `meta` — never omit the keys
- Cursor-based pagination: include `cursor` / `next_cursor` inside `meta` instead of page fields; document which mode the endpoint uses in its `@ApiResponse()`

## Database (Drizzle)

- Schema definitions in `src/shared/infrastructure/database/schema/`
- Every table includes audit columns: `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `deletedAt`, `deletedBy`
- Soft deletes: always filter `isNull(table.deletedAt)` in repository queries
- Email fields: store as `.toLowerCase().trim()`

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
- Response DTOs use `@Exclude()` / `@Expose({ name: 'snake_case' })` for field transformation

## Database (Drizzle)

- Schema definitions in `src/shared/infrastructure/database/schema/`
- Every table includes audit columns: `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `deletedAt`, `deletedBy`
- Soft deletes: always filter `isNull(table.deletedAt)` in repository queries
- Email fields: store as `.toLowerCase().trim()`

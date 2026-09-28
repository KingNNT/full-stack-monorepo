---
paths:
  - "apps/api/**/*.spec.ts"
  - "apps/api/**/*.ts"
  - "apps/api/test/**"
---

# API Testing (Jest)

## Test Types & Location

| Type        | Location                                          | Naming                        |
| ----------- | ------------------------------------------------- | ----------------------------- |
| Unit        | Co-located in `src/` next to source               | `{name}.spec.ts`              |
| Integration | `test/integration/{domain}/`                      | `{name}.integration.spec.ts`  |
| E2E         | `test/e2e/{domain}/`                              | `{endpoint}.e2e-spec.ts`      |

## Unit Tests

Test domain logic in isolation — aggregates, value objects, handlers.

**Aggregates**: create via `create()` or `reconstitute()`, call methods, assert via `getUncommittedEvents()`:

```typescript
it('should emit UserCreatedEvent on create', () => {
  const aggregate = UserAggregate.create({ ... });
  const events = aggregate.getUncommittedEvents();
  expect(events).toHaveLength(1);
  expect(events[0]).toBeInstanceOf(UserCreatedEvent);
});
```

**Value Objects**: test validation in `create()` — valid inputs return instances, invalid inputs throw:

```typescript
it('should reject invalid email', () => {
  expect(() => Email.create('not-an-email')).toThrow();
});
```

**Handlers**: mock all dependencies using factories from `test/helpers/mocks/`:

```typescript
const mockPasswordHasher = createMockPasswordHasher();
const mockCommandBus = createMockCommandBus();
// Inject mocks, call execute(), assert interactions
```

## Mock Factories

- Location: `test/helpers/mocks/{name}.mock.ts`
- Return `jest.Mocked<IInterface>` types
- Use `jest.fn()` for all methods — configure per-test with `.mockResolvedValue()` / `.mockRejectedValue()`
- Name pattern: `createMock{Name}()` — e.g., `createMockPasswordHasher()`, `createMockCommandBus()`

## Test Data Factories

- Location: `test/helpers/factories/{entity}.factory.ts`
- Use overrides pattern with defaults:

```typescript
export function createUserAggregate(overrides?: Partial<UserProps>) {
  return UserAggregate.create({
    email: overrides?.email ?? 'test@example.com',
    username: overrides?.username ?? 'testuser',
    ...overrides,
  });
}
```

## Integration Tests (TestContainers)

Real PostgreSQL via TestContainers — no mocking the database.

```typescript
// beforeAll: start PostgreSQL container, create Drizzle instance, instantiate repository
const container = new PostgreSqlContainer('postgres:16-alpine')
  .withDatabase('test_db')
  .withUsername('test')
  .withPassword('test');

// beforeEach: clean database
await cleanDatabase(db);

// afterAll: stop container
await container.stop();
```

- Use singleton container pattern — check if already running before starting
- Query the database directly with Drizzle to assert side effects
- Always clean database in `beforeEach`, not `afterEach`

## E2E Tests

Full NestJS app via `test-app-factory` with real HTTP calls.

```typescript
const app = await createTestApp();
await request(app.getHttpServer())
  .post('/auth/login')
  .send({ email, password })
  .expect(200);
```

- Seed test data via API requests in `beforeEach`
- Override environment variables (DATABASE_URL, JWT secrets) — never use real secrets
- Assert both HTTP response shape and database side effects

## General Rules

- One assertion concept per test (multiple `expect` calls fine if they assert one logical thing)
- Test names describe behavior: `it('should reject invalid email')` not `it('test email validation')`
- When adding a new domain module, create the corresponding test helper factories before writing tests

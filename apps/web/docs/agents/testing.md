---
paths:
  - "apps/web/**/*.test.ts"
  - "apps/web/**/*.test.tsx"
  - "apps/web/**/*.spec.ts"
  - "apps/web/**/*.ts"
  - "apps/web/**/*.tsx"
  - "apps/web/tests/**"
  - "apps/web/e2e/**"
---

# Web Testing (Vitest + Playwright)

## Test Types & Location

| Type        | Location                            | Naming           | Runner         |
| ----------- | ----------------------------------- | ---------------- | -------------- |
| Unit        | Co-located in `src/`                | `{name}.test.tsx`| Vitest (jsdom) |
| Integration | `tests/integration/`                | `{name}.test.ts` | Vitest (node)  |
| E2E         | `e2e/tests/{domain}/`              | `{name}.spec.ts` | Playwright     |

## Unit Tests

Use `renderWithProviders()` from `tests/helpers/test-utils.tsx` — wraps components with mocked providers (next-intl, next-auth, next/navigation).

```typescript
import { renderWithProviders } from "@/tests/helpers/test-utils";

it("renders password input", () => {
  renderWithProviders(<PasswordInput placeholder="Enter password" />);
  expect(screen.getByPlaceholderText("Enter password")).toHaveAttribute("type", "password");
});
```

**User interactions**: always use `userEvent.setup()`, not `fireEvent`:

```typescript
const user = userEvent.setup();
await user.click(screen.getByRole("button"));
```

## Mock Factories

- Location: `tests/helpers/mocks/{library}.ts`
- Pattern: `create{Library}Mocks()` returns `{ mockFn, factory }` for `vi.mock()`
- NextAuth: `createNextAuthMocks()` — supports overrides for session status, user, signIn result
- next-intl: returns `useTranslations` that echoes the key
- next/navigation: returns router with `vi.fn()` methods

## Service Tests

- Assert exceptions by `error.name` — not `instanceof`
- Reason: `Object.setPrototypeOf` in custom exceptions breaks `instanceof` across module boundaries
- Use a custom `expectToThrow()` helper if needed

## E2E Tests (Playwright)

**Page Object pattern** — every page gets a class in `e2e/pages/`:

```typescript
export class LoginPage {
  readonly emailInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.emailInput = page.getByLabel("Email");
    this.submitButton = page.getByRole("button", { name: /sign in/i });
  }

  async goto(locale = "en") {
    await this.page.goto(`/${locale}/login`);
  }

  async login(email: string, password: string) { ... }
}
```

- Use semantic locators: `getByRole()`, `getByLabel()`, `getByText()` — avoid CSS selectors
- Screenshots on failure, trace on first retry (configured in `playwright.config.ts`)
- Test both happy path and auth redirects (unauthenticated → login with callback URL)

## General Rules

- One assertion concept per test
- Test names describe behavior: `it("should reject invalid email")` not `it("test email validation")`
- When adding new components, create mock factories before writing tests

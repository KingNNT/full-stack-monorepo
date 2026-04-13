---
paths:
  - "apps/web/**/*.ts"
  - "apps/web/**/*.tsx"
---

# Web Code Styles

## Package Manager

- **pnpm only** — never use npm, npx, or yarn. Use `pnpm` / `pnpm exec` / `pnpm dlx` instead.

## Formatting

- Double quotes, tab indentation, 100-char line width (see `apps/web/biome.json`)
- TailwindCSS directives recognized in CSS
- Use `import type` for type-only imports

## Naming

| Concept          | Pattern                 | Example                          |
| ---------------- | ----------------------- | -------------------------------- |
| Type             | `T` prefix              | `TUser`, `TLoginRequest`         |
| Interface        | `I` prefix              | `IUser`, `ILoginRequest`         |
| Component        | PascalCase with suffix  | `HomeView`, `RegisterForm`       |
| API client       | camelCase singleton     | `authApi`, `userApi`             |
| Service          | camelCase singleton     | `authService`                    |
| Store            | `use{Name}Store`        | `useAppStore`                    |
| Exception        | `{Name}Exception`       | `AuthException`, `NetworkError`  |
| Constants        | UPPER_SNAKE_CASE        | `AUTH_ERROR_CODES`, `PRIVATE_ROUTES` |

## File Naming

- Components: `kebab-case.tsx` — `login-form.tsx`, `home-view.tsx`
- Tests: `{name}.test.tsx` or `{name}.test.ts` (not `.spec.ts`)
- Type definitions: `{name}.d.ts` in `src/types/`
- Barrel exports (`index.ts`) for public APIs in `apis/`, `exceptions/`, `services/`

## Component Organization

- Pages under `src/app/[locale]/` — server components by default
- Route groups: `(authenticated)/` for protected, `(unauthenticated)/` for public
- Components by feature: `src/components/{auth|layout|dashboard|home|common}/`
- UI primitives (shadcn/ui): `src/components/ui/` — Radix wrappers, do not modify directly
- Mark interactive components with `"use client"` — keep it as narrow as possible

## Import Paths

- Always use `@/*` alias (maps to `src/*`) — never use relative `../../` paths
- Group: standard library → third-party → `@/` aliases

## Forms

- Schema-first: define Zod schema → `useForm()` + `zodResolver()` → `FormField` + `FormControl`
- Validation messages use i18n keys via `t()` from `useTranslations()`
- Error display: catch API errors in `onSubmit`, map to user-facing messages

## API Response Format

All BE responses use a consistent envelope — `BaseHttpClient.request()` unwraps it. API clients in `src/apis/` should type the inner payload only; never include the envelope in public return types.

### Success envelope

```ts
interface ISuccessResponse<TData> {
  status_code: number;
  success: true;
  message: string;
  data: TData;
}
```

- `BaseHttpClient` strips the envelope and returns `data` directly to callers
- Field names are `snake_case` from the wire — keep FE types matching (`access_token`, `user_id`, etc.), do NOT camelCase them at the boundary

### Error envelope

```ts
interface IErrorResponse<TErrorCode> {
  status_code: number;
  success: false;
  message: string;
  error?: TErrorCode;
}
```

- Caught in the `afterResponse` hook and thrown as `HttpStatusError` with `statusCode` + parsed body
- Map `error` codes (e.g. `INVALID_CREDENTIALS`, `EMAIL_EXISTS`) to i18n keys via a lookup table — never surface raw codes to users
- Fall back to a generic i18n message when the code is unknown

### List format

List endpoints return `data: { items, meta }`:

```ts
interface IListMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

interface IListData<T> {
  items: T[];
  meta: IListMeta;
}

type IListResponse<T> = ISuccessResponse<IListData<T>>;
```

- API client methods return `IListData<T>` (already unwrapped), not the raw envelope
- Query params: `?page=`, `?page_size=`, `?sort=field:asc|desc`, `?filter[field]=value` — build via `URLSearchParams`
- `items` and `meta` are always present (empty `[]` when no results) — never guard with `?.`
- Cursor mode: `meta` carries `cursor` / `next_cursor` instead of page fields — check the endpoint's type

## State Management

- Zustand stores with `devtools` + `persist` middleware stack
- Store files in `src/libs/stores/`
- Include a `reset()` action in every store

## i18n

- All user-facing strings go through `next-intl` — no hardcoded text
- Translation files in `src/langs/{locale}.json`
- Use `useTranslations(namespace)` in client components, `getTranslations(namespace)` in server components

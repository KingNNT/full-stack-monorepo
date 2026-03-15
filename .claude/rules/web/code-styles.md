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

## State Management

- Zustand stores with `devtools` + `persist` middleware stack
- Store files in `src/libs/stores/`
- Include a `reset()` action in every store

## i18n

- All user-facing strings go through `next-intl` — no hardcoded text
- Translation files in `src/langs/{locale}.json`
- Use `useTranslations(namespace)` in client components, `getTranslations(namespace)` in server components

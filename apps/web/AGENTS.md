<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# apps/web — Next.js 16 web app

Extends the root [`AGENTS.md`](../../AGENTS.md); its hard rules apply here. The
`nextjs-agent-rules` block above is managed by `next dev` — leave it intact and
edit only outside the markers.

## Detail docs — read the matching one before writing code

| When you are… | Read |
|---|---|
| Writing or changing any `.ts`/`.tsx` (naming, components, imports, forms, state, i18n) | [`docs/agents/code-styles.md`](docs/agents/code-styles.md) |
| Touching auth, route protection, validation, the API client, env vars | [`docs/agents/security.md`](docs/agents/security.md) |
| Writing or fixing tests | [`docs/agents/testing.md`](docs/agents/testing.md) |

## Commands

Run from `apps/web` (or `pnpm nx run web:<target>` from the root):

```bash
pnpm test                  # Vitest — unit (co-located) + integration (tests/integration)
pnpm test:e2e              # Playwright (e2e/)
pnpm dev:web               # from root; port 3000
pnpm storybook:web         # from root
```

## Layout — App Router + next-intl

```
src/
  ├── app/[locale]/              # App Router, every route is locale-prefixed
  │   ├── (unauthenticated)/     # public: home, login, register
  │   └── (authenticated)/       # protected: dashboard
  ├── apis/                      # API client layer (Ky)
  ├── components/                # React components (shadcn/ui pattern)
  ├── configs/ constants/ enums/ types/ utils/
  ├── exceptions/                # custom error classes
  ├── i18n/                      # next-intl config
  ├── langs/                     # translations (en, vi)
  ├── libs/intl/                 # Intl polyfill & helpers
  ├── libs/stores/               # Zustand stores
  ├── services/                  # auth service, NextAuth config
  └── proxy.ts                   # request proxy (locale + route protection)
```

Stack: React 19, TailwindCSS v4, NextAuth v5 (beta), Radix UI + shadcn/ui, Zod,
React Hook Form, Storybook. Server components by default.

## Style

Biome (`apps/web/biome.json`): double quotes, tab indent, 100-char lines,
`import type` for type-only imports.

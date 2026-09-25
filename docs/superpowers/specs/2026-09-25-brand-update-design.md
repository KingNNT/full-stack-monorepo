# Brand Update Design — FullStack Monorepo

**Date:** 2026-09-25
**Status:** Approved (pre-implementation)
**Branch:** `develop`
**Author:** Agent collaboration with @KingNNT

---

## Context

The repo is a Next.js 16 + NestJS 11 starter template currently exported under the
branding name `"KingNNT.org"` (leftover from the build host). A new brand identity
was produced off-repo (`SynologyDrive-shared/temp/fullstack-monorepo-brand/`) under
the canonical name `"FullStack Monorepo"` with a teal/charcoal/white palette. This
spec describes how to integrate those assets into the `apps/web` workspace end-to-end
so the template ships with a self-contained identity.

**Audience:** contributors and downstream users forking the template.

---

## Goals

1. Replace all surfaced brand surface area (favicon chain, OG image, page metadata) with the
   provided brand assets.
2. Set the canonical identity (`title`, `description`, `openGraph`, `twitter`) to
   `"FullStack Monorepo"` consistently.
3. Insert the wordmark logo into both authenticated and unauthenticated headers, theme-aware.
4. Add a hero section to the unauthenticated landing page (`/`) with logo + tagline +
   intro paragraph + 2 CTAs + an illustration.
5. Rebrand the Tailwind/shadcn theme tokens to a teal/charcoal/white palette so the
   rest of the UI harmonises with the new brand.

## Non-goals

- Migrating `apps/api` (NestJS) — the API has no branding surface to update.
- Translating brand text in `en.json` / `vi.json` (kept as-is until next sprint).
- Generating new screenshots or marketing assets.
- Vectorising the brand into SVG — the brand assets are raster PNG/ICO only, per the brand
  README. Re-generation is left to a future batch.
- Fixing the pre-existing `apps/web` build break on `/_global-error` prerender
  (see Risks §C).

---

## Decisions (recap of brainstorm)

| # | Topic | Decision |
|---|---|---|
| 1 | Scope | **D — Toàn diện** (icons + identity + logos in-app + full theme rebrand) |
| 2 | Canonical brand name | α — `title: "FullStack Monorepo"`, `description: "FullStack Monorepo — A foundation for your next project."` |
| 3 | Logo placement | e — header in both `(unauthenticated)` and `(authenticated)` layouts + landing-page hero |
| 4 | Theme rebrand | α — replace ALL Tailwind/shadcn tokens with teal/charcoal/white palette |
| 5 | Hero content | c — Logo + tagline + 60–100-word paragraph + 2 buttons (Sign In + GitHub) + lucide illustration |
| 6 | CTA targets | Primary "Sign In" → `/{locale}/login`; secondary "Star on GitHub" → `https://github.com/KingNNT/full-stack-monorepo` (no UTM tracking) |
| 7 | Palette | iii — cyan-500 `#06b6d4` / zinc-900 `#18181b` / zinc-50 `#fafafa` / zinc-400 `#a1a1aa` |
| 8 | Asset location | β — `apps/web/public/*` with metadata declaration in `layout.tsx` |
| 9 | Logo dark/light | a — theme-aware swap via Tailwind `dark:` classes; `next-themes` already configured |

---

## Asset pipeline

### Source files

`/Users/kingnnt/Library/CloudStorage/SynologyDrive-shared/temp/fullstack-monorepo-brand/`

### Destination

`apps/web/public/`

```
apps/web/public/
├── favicon.ico                  # multi-size: 16/32/48
├── favicon-16.png               # explicit small
├── favicon-32.png
├── favicon-48.png
├── apple-touch-icon.png         # 180×180
├── app-icon-192.png             # PWA / Android (192×192)
├── app-icon-512.png             # PWA / Android (512×512)
├── og-image.png                 # 1200×630 link-share image
├── logo-light.png               # 2172×724, dark text on light bg
├── logo-dark.png                # 2172×724, white text on charcoal bg
└── app-icon-1024.png            # iOS App Store (kept for future use)
```

> `app-master.png` (1254×1254) and `og-master.png` (1730×909) are NOT copied —
> they're higher-resolution masters kept at the source. `favicon-{16,32,48}.png`
> are also kept explicit so browsers/devtools can fetch the correctly-sized asset.

---

## Metadata (`apps/web/src/app/layout.tsx`)

```ts
export const metadata: Metadata = {
  title: "FullStack Monorepo",
  description: "FullStack Monorepo — A foundation for your next project.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ),
  applicationName: "FullStack Monorepo",
  generator: "Next.js",
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon.ico",    sizes: "any" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "FullStack Monorepo",
    description: "FullStack Monorepo — A foundation for your next project.",
    url: "/",
    siteName: "FullStack Monorepo",
    images: [
      { url: "/og-image.png", width: 1200, height: 630, alt: "FullStack Monorepo" },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FullStack Monorepo",
    description: "FullStack Monorepo — A foundation for your next project.",
    images: ["/og-image.png"],
  },
};
```

> Locale-specific layouts (`apps/web/src/app/[locale]/layout.tsx`) keep only the
> existing `generateMetadata` for `alternates.languages`. Title/description are NOT
> repeated to avoid conflicts.

---

## Theme rebrand (`apps/web/src/app/globals.css`)

Replace all CSS variables under `:root` and `.dark`:

| Token | Light (default) | Dark (`.dark`) |
|---|---|---|
| `--background` | `#fafafa` (zinc-50) | `#18181b` (zinc-900) |
| `--foreground` | `#18181b` (zinc-900) | `#fafafa` (zinc-50) |
| `--card` | `#ffffff` | `#27272a` (zinc-800) |
| `--card-foreground` | `#18181b` | `#fafafa` |
| `--popover` | `#ffffff` | `#27272a` |
| `--popover-foreground` | `#18181b` | `#fafafa` |
| `--primary` | `#06b6d4` (cyan-500) | `#22d3ee` (cyan-400) |
| `--primary-foreground` | `#ffffff` | `#0e7490` (cyan-700) |
| `--secondary` | `#f4f4f5` (zinc-100) | `#27272a` (zinc-800) |
| `--secondary-foreground` | `#18181b` | `#fafafa` |
| `--muted` | `#f4f4f5` | `#27272a` |
| `--muted-foreground` | `#71717a` (zinc-500) | `#a1a1aa` (zinc-400) |
| `--accent` | `#06b6d4` | `#22d3ee` |
| `--accent-foreground` | `#ffffff` | `#0e7490` |
| `--destructive` | `#ef4444` (red-500) | `#ef4444` |
| `--destructive-foreground` | `#ffffff` | `#ffffff` |
| `--border` | `#e4e4e7` (zinc-200) | `#3f3f46` (zinc-700) |
| `--input` | `#e4e4e7` | `#3f3f46` |
| `--ring` | `#06b6d4` | `#22d3ee` |
| `--radius` | `0.5rem` (unchanged) | — |

> Cyan-500 has ~3.5:1 contrast on white which fails WCAG AA for body text < 18pt.
> Body text continues to use `--foreground` (zinc-900) which has ≥ 15:1. Cyan is
> reserved for buttons/links/focus rings where large-element AA threshold (3:1) applies.

---

## Components

### `<Logo />` — `apps/web/src/components/brand/logo.tsx`

```tsx
import Image from "next/image";

interface ILogoProps {
  /** Logo preset. "wordmark" = full logo chữ (used in headers + hero). */
  variant?: "wordmark";
  /** Render height in px; width auto-derived from 2172:724 aspect ≈ 3:1. */
  height?: number;
  /** Pass true for LCP image (above-the-fold hero). */
  priority?: boolean;
  /** Container className. */
  className?: string;
  /** Accessibility alt text. */
  alt?: string;
}

export const Logo = ({
  height = 32,
  priority = false,
  className,
  alt = "FullStack Monorepo",
}: ILogoProps) => {
  const width = Math.round(height * (2172 / 724));
  return (
    <span className={className} aria-label={alt}>
      <Image
        src="/logo-light.png"
        alt=""
        width={width}
        height={height}
        priority={priority}
        className="block dark:hidden"
      />
      <Image
        src="/logo-dark.png"
        alt=""
        width={width}
        height={height}
        priority={priority}
        className="hidden dark:block"
      />
    </span>
  );
};
```

Notes:
- `next/image` for built-in responsive + lazy-loading.
- Tailwind `dark:` swaps which image renders. `next-themes` toggles `.dark` on `<html>`.
- `<span aria-label>` is the single accessible unit because the raster logo carries no text.

### Header integration

Pattern: `<Logo />` at top-left of nav, wrapped in `<Link href="/">`.

```tsx
// apps/web/src/app/[locale]/(unauthenticated)/layout.tsx (illustrative)
<header className="border-b">
  <nav className="container flex h-16 items-center gap-6">
    <Link href="/" aria-label="FullStack Monorepo home">
      <Logo height={28} />
    </Link>
    {/* existing locale switcher / theme toggle / nav items */}
  </nav>
</header>
```

Auth layout: logo is placed in `<PrivateHeader />` (top header bar that already sits
next to the menu toggle on mobile and to nav items on desktop). `<PrivateSidebar />`
(left-rail on `lg:`+) also gets the same `<Logo />` at its top so brand is visible at
all viewport sizes. Both replacements target the existing `<h1>{tNav("title")}</h1>`
placeholders.

### Hero — `apps/web/src/components/marketing/hero.tsx`

Vertical stack, centered, on `apps/web/src/app/[locale]/(unauthenticated)/home/page.tsx`:

```
       ┌─────────────────────────┐
       │       <Logo />          │   height = 96
       └─────────────────────────┘

       FULLSTACK STARTER TEMPLATE        ← eyebrow (text-xs uppercase tracking-widest text-muted-foreground)
       FullStack Monorepo                ← H1 (text-5xl md:text-6xl font-bold tracking-tight)
   A foundation for your next project.   ← subtitle (text-xl text-muted-foreground)

   The FullStack Monorepo template       ← paragraph (~70 words, max-w-prose text-base text-muted-foreground)
   combines a production-ready NestJS…   

        ┌─────────┐  ┌──────────────┐
        │ Sign In │  │ Star on GitHub│   ← 2 buttons
        └─────────┘  └──────────────┘

           ┌──────────────────────────┐
           │  <Layers /> icon         │   ← lucide-react, aria-hidden, decorative
           │  "modular blocks"        │
           └──────────────────────────┘
```

**Buttons:**
- Primary `<Button>` "Sign In" → `<Link href={\`/\${locale}/login\`}>`.
- Secondary `<Button variant="outline">` with lucide `<Github />` icon + "Star on GitHub"
  → `<a target="_blank" rel="noreferrer" href="https://github.com/KingNNT/full-stack-monorepo">`.

**Intro paragraph (draft — 70 words, subject to user copy review at implementation):**

> The FullStack Monorepo template brings a production-ready NestJS API and Next.js web
> application into one workspace. Shared tooling, type-safe contracts, and a single
> dependency tree keep your team shipping instead of wiring. Use it as a starting point
> for your next project — or fork it to learn a modern full-stack setup.

**Illustration:** `lucide-react` `<Layers />` (fallback `<Boxes />` if not exported)
inside an `aria-hidden="true"` decorative wrapper, static (no animation).

---

## Files to change

### New

- `apps/web/src/components/brand/logo.tsx`
- `apps/web/src/components/marketing/hero.tsx`
- `apps/web/.storybook/stories/logo.stories.tsx` (or wherever Storybook stories live)
- `apps/web/.storybook/stories/hero.stories.tsx`
- `apps/web/public/*` (11 PNG/ICO files copied from brand folder)
- `docs/BRAND.md` (asset inventory + regeneration recipes)

### Modified

- `apps/web/src/app/layout.tsx` — replace `metadata`, keep structure
- `apps/web/src/app/[locale]/layout.tsx` — remove title/description if duplicated
- `apps/web/src/app/[locale]/(unauthenticated)/layout.tsx` — add `<Logo />` to header
- `apps/web/src/app/[locale]/(authenticated)/layout.tsx` — add `<Logo />` to header
  (or sidebar, depending on current structure)
- `apps/web/src/app/[locale]/(unauthenticated)/home/page.tsx` — render `<Hero />`
- `apps/web/src/app/globals.css` — replace CSS variables per palette table

### Auto-touched (do NOT commit)

- `apps/web/next-env.d.ts` — regenerated by `next build`; keep out of commits.

---

## Verification

| Check | Command / action | Pass criteria |
|---|---|---|
| Lint | `pnpm lint` | 0 errors (32 warnings baseline preserved) |
| Typecheck | `pnpm typecheck` | both projects exit 0 |
| Web unit tests | `pnpm test` in `apps/web` | 48/48 still pass |
| API unit tests | `pnpm test` in `apps/api` | 124/124 still pass |
| API integration tests | `cd apps/api && pnpm test:integration` | 46/46 still pass |
| Storybook render | `pnpm storybook:web` | Logo + Hero stories render; theme toggle swaps logo |
| OG metadata | `curl localhost:3000 \| grep og:image` | URL = `/og-image.png`, title = "FullStack Monorepo" |
| Favicon chain | DevTools Network filter `favicon` | browser fetches `favicon.ico` + size-matched `favicon-{16,32,48}.png` |
| Theme swap | toggle theme → DOM swap | `logo-light.png` ⇄ `logo-dark.png` |
| Visual smoke | open `/`, `/login`, `/register`, `/dashboard` | logo present, hero renders, no layout shift |
| Accessibility | Lighthouse + axe DevTools | aria-label set, AA contrast on body text |

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| **Pre-existing `apps/web` build break** on `/_global-error` prerender (HEAD shows `/_not-found` `useState` error). Unrelated to this work — verify via typecheck/lint/test/storybook build, NOT `pnpm build`. | High | Verification matrix excludes `pnpm build`; if asked, flag it as pre-existing tech debt. |
| Color contrast — cyan-500 on near-white fails AA for body < 18pt. | Medium | Body text uses `--foreground` (zinc-900 ≥ 15:1); cyan reserved for buttons/links/focus where 3:1 threshold applies. |
| `metadataBase` requires absolute URL — `NEXT_PUBLIC_APP_URL` may not be set. | Low | Fallback to `http://localhost:3000` in `metadataBase`. Document in `.env.example` if needed. |
| `next/image` with local `/public/` — no `remotePatterns` needed. | None | N/A |
| Logo is raster; re-coloring requires re-export from masters. | Low | Document ImageMagick recipe in `docs/BRAND.md`. |
| Storybook 10.x may not wrap stories in `<ThemeProvider>`. | Medium | Add decorator in `.storybook/preview.tsx` if theme swap story is desired. |
| `lucide-react` 0.555 may not export `<Layers />` cleanly. | Low | Fallback `<Boxes />` or static SVG. Verify at implementation. |

---

## Commit plan

> ⚠️ AGENTS.md forbids auto-committing code without explicit request. The agent
> will NOT commit. The user invokes the `commit` skill after reviewing each step.

Suggested Conventional Commits (6 sequenced changes, or merged):

```
1. chore(brand): add brand assets to apps/web/public
2. chore(theme): rebrand tailwind tokens to teal/charcoal/white
3. chore(web): update root metadata (title/description/og/icons)
4. feat(web): add Logo component (theme-aware) + Storybook story
5. feat(web): integrate Logo in (unauth)/(auth) headers
6. feat(web): add Hero to landing page (+ Storybook story)
```

Single commit alternative:

```
chore(brand): integrate FullStack Monorepo identity (assets, theme, logos, hero)
```

---

## Out of scope (next batches)

- `install.sh` — mention brand folder in install script.
- Translating hero copy into `vi.json` / `en.json`.
- README screenshot refresh.
- SVG re-export of the mark.
- Pre-existing `apps/web` build break on `/_global-error` / `/_not-found` prerender.
- `@types/helmet` deprecation removal.
- OpenTelemetry version realignment (`0.214.0` SDK vs `0.72.0`/`0.80.0` instruments).
- 38 major-version dependency upgrades in batch 2/3.

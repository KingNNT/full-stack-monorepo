# Brand — FullStack Monorepo

This template ships with a self-contained brand identity.

## Asset inventory

All raster assets are committed under `apps/web/public/`. None are vector.

| File | Size | Where used |
|---|---|---|
| `favicon.ico` | multi (16/32/48) | `<link rel="icon">` legacy fallback |
| `favicon-16.png` | 16×16 | explicit small favicon |
| `favicon-32.png` | 32×32 | explicit medium favicon |
| `favicon-48.png` | 48×48 | explicit large favicon |
| `apple-touch-icon.png` | 180×180 | `<link rel="apple-touch-icon">` |
| `app-icon-192.png` | 192×192 | (reserved) PWA / Android |
| `app-icon-512.png` | 512×512 | (reserved) PWA / Android |
| `app-icon-1024.png` | 1024×1024 | (reserved) iOS App Store |
| `logo-light.png` | 2172×724 | Light theme wordmark (dark text on light bg) |
| `logo-dark.png` | 2172×724 | Dark theme wordmark (white text on charcoal bg) |
| `og-image.png` | 1200×630 | Open Graph link preview |

## Color tokens (Tailwind v4 CSS variables)

| Token | Light | Dark |
|---|---|---|
| `--background` | `#fafafa` | `#18181b` |
| `--foreground` | `#18181b` | `#fafafa` |
| `--primary` | `#06b6d4` | `#22d3ee` |
| `--ring` | `#06b6d4` | `#22d3ee` |
| `--border` | `#e4e4e7` | `#3f3f46` |

(See `apps/web/src/app/globals.css` for the full palette — `:root` and `.dark` blocks.)

## Regenerating assets

The brand folder at `/Users/kingnnt/Library/CloudStorage/SynologyDrive-shared/temp/fullstack-monorepo-brand/` is the source of truth. To regenerate a specific size from `app-master.png`:

```bash
# Example: 192×192 from master
magick app-master.png -resize 192x192 app-icon-192.png
```

To assemble a multi-size .ico:

```bash
magick favicon-16.png favicon-32.png favicon-48.png favicon.ico
```

When the brand changes (e.g., colour or wordmark), re-export from the master
PNG and commit the updated files. Do NOT modify the PNGs in place — they are
generated outputs.

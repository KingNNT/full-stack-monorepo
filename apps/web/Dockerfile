FROM node:24-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/

RUN cat <<'EOF' > pnpm-workspace.yaml
packages:
  - apps/web
EOF
RUN pnpm install --frozen-lockfile --filter @inviduality/web...

WORKDIR /app/apps/web
COPY apps/web/ .

# Create a standalone tsconfig for Docker (no extends to root)
RUN cat <<'TSEOF' > tsconfig.json
{
  "compilerOptions": {
    "target": "es2022",
    "lib": ["es2022"],
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "composite": false,
    "emitDeclarationOnly": false,
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "incremental": true,
    "noEmit": true,
    "allowJs": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "paths": {
      "@/*": ["./src/*"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": ["src", "next-env.d.ts", "next.config.ts"],
  "exclude": ["node_modules", "dist", ".next", ".storybook", "**/*.stories.tsx"]
}
TSEOF

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm exec next build

FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]

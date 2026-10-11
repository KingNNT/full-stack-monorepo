FROM node:lts-alpine AS dev

WORKDIR /app

RUN npm install -g pnpm@11

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile --filter @fullstack-monorepo-app/web...

# Compose mounts an anonymous volume here and runs the container as the host
# user, so the volume (seeded from this directory) must be writable by any UID.
RUN mkdir -p /app/apps/web/.next && chmod 777 /app/apps/web/.next

WORKDIR /app/apps/web

# The repo is bind-mounted over /app in dev, so pnpm's pre-script dependency
# check sees a different store, fails without a TTY, and drops .pnpm-store/
# into the host checkout. Dependencies are baked into the image instead.
ENV pnpm_config_verify_deps_before_run=false
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["pnpm", "dev"]

FROM node:lts-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@11

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile --filter @fullstack-monorepo-app/web...

WORKDIR /app/apps/web
COPY apps/web/ .

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

FROM node:lts-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]

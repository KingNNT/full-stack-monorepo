FROM node:lts-alpine AS dev

WORKDIR /app

RUN npm install -g pnpm@11

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile --filter @fullstack-monorepo-app/api...

# Compose Watch keeps this copy in sync with the host (docker-compose.override.yml)
COPY apps/api/ ./apps/api/

WORKDIR /app/apps/api

EXPOSE 8000

CMD ["pnpm", "dev"]

FROM node:lts-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@11

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile --filter @fullstack-monorepo-app/api...

WORKDIR /app/apps/api
COPY apps/api/ .

RUN pnpm build

# Use pnpm deploy for a self-contained production directory
RUN pnpm --filter @fullstack-monorepo-app/api deploy --legacy --prod /app/deploy

FROM node:lts-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/deploy/dist ./dist
COPY --from=builder /app/apps/api/drizzle ./drizzle
COPY --from=builder /app/deploy/node_modules ./node_modules
COPY --from=builder /app/deploy/package.json ./

RUN addgroup --system --gid 1001 nestjs
RUN adduser --system --uid 1001 nestjs

USER nestjs

EXPOSE 8000

CMD ["node", "--require", "./dist/src/instrumentation.js", "dist/src/main"]

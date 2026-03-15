FROM node:24-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/

RUN cat <<'EOF' > pnpm-workspace.yaml
packages:
  - apps/api
EOF
RUN pnpm install --frozen-lockfile --filter @inviduality/api...

WORKDIR /app/apps/api
COPY apps/api/ .

# Create a standalone tsconfig.build for Docker (no extends chain to root)
RUN cat <<'TSEOF' > tsconfig.json
{
  "compilerOptions": {
    "target": "es2022",
    "lib": ["es2022"],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
TSEOF
RUN cat <<'TSEOF' > tsconfig.build.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "declaration": false
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "test", "**/*.spec.ts"]
}
TSEOF

RUN pnpm exec nest build

# Use pnpm deploy for a self-contained production directory
RUN pnpm --filter @inviduality/api deploy --legacy --prod /app/deploy

FROM node:24-alpine AS runner

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

CMD ["node", "dist/main.js"]

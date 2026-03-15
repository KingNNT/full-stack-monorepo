# Stage 1: Dependencies
FROM node:24.12.0-alpine AS deps

LABEL maintainer="KingNNT"

WORKDIR /app

# Install yarn (stable = v4)
RUN corepack enable && corepack prepare yarn@stable --activate

# Copy package files and Yarn configuration
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn

# Install production dependencies
RUN yarn install --immutable --production

# Stage 2: Builder
FROM node:24.12.0-alpine AS builder

WORKDIR /app

# Install yarn (stable = v4)
RUN corepack enable && corepack prepare yarn@stable --activate

# Copy package files and Yarn configuration
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn

# Install all dependencies
RUN yarn install --immutable

# Copy source code
COPY . .

# Build the application
ENV NEXT_TELEMETRY_DISABLED=1
RUN yarn build

# Stage 3: Runner
FROM node:24.12.0-alpine AS runner

LABEL maintainer="KingNNT"

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install yarn
RUN corepack enable && corepack prepare yarn@stable --activate

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy dependencies and built files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["yarn", "start"]

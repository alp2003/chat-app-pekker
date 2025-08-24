FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN corepack enable pnpm

# Copy the root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./
COPY tsconfig.json ./
COPY tsconfig.base.json ./

# Copy workspace package files
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json

# Install dependencies with shamefully-hoist to flatten node_modules
RUN pnpm install --frozen-lockfile --shamefully-hoist

# Allow build scripts for necessary packages
RUN pnpm rebuild @prisma/client prisma argon2 reflect-metadata

FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN corepack enable pnpm

# Copy installed dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Copy source code
COPY . .

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build the application
RUN pnpm run build --filter=api

FROM node:20-alpine AS runner

# Install pnpm
RUN corepack enable pnpm

ENV NODE_ENV=production

# Create the proper monorepo directory structure
# Working from root so node_modules can be found from all locations
WORKDIR /app

# Copy node_modules at root level for proper resolution
COPY --from=builder /app/node_modules ./node_modules

# Copy shared package to maintain the relative path structure  
COPY --from=builder /app/packages ./packages

# Copy workspace files (needed for proper module resolution)
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Set up the API in its proper location
WORKDIR /app/apps/api

# Copy built application files
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./package.json

# Copy and setup entrypoint script
COPY --from=builder /app/apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3001
CMD ["./docker-entrypoint.sh"]
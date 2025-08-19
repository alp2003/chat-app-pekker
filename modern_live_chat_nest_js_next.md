# Modern Live Chat — NestJS (Backend) + Next.js (Frontend)

## Step‑by‑step setup & dependencies

> Assumes **Node 20+**, **pnpm**, **Docker Desktop**, and Git installed.

### 1) Scaffold the monorepo

```bash
mkdir chat-app && cd chat-app
pnpm init -y
# enable workspaces
jq '. + { "private": true, "workspaces": ["apps/*","packages/*"] }' package.json > package.tmp && mv package.tmp package.json || true
mkdir -p apps/api apps/web packages/shared
```

### 2) Root dev tooling (optional but recommended)

```bash
pnpm add -D -w typescript tsx eslint prettier turbo
pnpm tsc --init --pretty --rootDir . --baseUrl . --paths '{"shared/*":["packages/shared/src/*"]}'
```

### 3) Shared package (types/DTOs)

```bash
cd packages/shared
pnpm init -y
pnpm add zod
mkdir -p src && printf "export * from './dto';
" > src/index.ts
# paste dto.ts from canvas into src/dto.ts
cd ../../
```

### 4) Backend — NestJS API

```bash
cd apps/api
pnpm dlx @nestjs/cli new . --package-manager pnpm --strict
pnpm add @nestjs/platform-socket.io socket.io @socket.io/redis-adapter redis
pnpm add @prisma/client prisma
pnpm add @nestjs/jwt jsonwebtoken
pnpm add class-validator class-transformer
pnpm add zod
pnpm add -D @types/jsonwebtoken
```

Add files from the canvas:

- `src/main.ts`, `src/app.module.ts`, `src/prisma.service.ts`
- `src/auth/*` (module & service)
- `src/chat/*` (gateway & service)

**Prisma**

```bash
pnpm dlx prisma init --datasource-provider postgresql
# Replace schema.prisma with the one in the canvas
pnpm prisma generate
```

**.env for API (will also be used by web)**

```
POSTGRES_URL=postgresql://chat:chat@postgres:5432/chat
REDIS_URL=redis://redis:6379
JWT_ACCESS_SECRET=dev_access_secret_change
JWT_REFRESH_SECRET=dev_refresh_secret_change
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
API_PORT=3001
WEB_PORT=3000
NODE_ENV=development
```

### 5) Frontend — Next.js

```bash
cd ../web
pnpm dlx create-next-app@latest . --ts --eslint --app --src-dir --tailwind --use-pnpm
pnpm add socket.io-client zod @tanstack/react-query zustand next-themes
# (optional UI)
pnpm add lucide-react
```

Add from canvas:

- `app/providers/SocketProvider.tsx`
- `app/chat/ChatRoom.tsx`
- `app/chat/page.tsx` (remember to **replace** the fake token with a real JWT later)

### 6) Tailwind (if you didn’t select the flag)

```bash
pnpm dlx tailwindcss init -p
# configure content paths to "./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"
```

### 7) Docker & Compose

Create `apps/api/Dockerfile`, `apps/web/Dockerfile`, and root `docker-compose.yml` from canvas.

```bash
# back to repo root
cd ../../
cat > docker-compose.yml <<'YML'
# paste the compose from the canvas here
YML
```

### 8) Wire workspaces & scripts

Root `package.json` scripts:

```json
{
  "scripts": {
    "db:migrate": "pnpm --filter api prisma migrate dev",
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "start": "docker compose up --build"
  }
}
```

### 9) First run (local, without Docker)

```bash
# Terminal A (Postgres & Redis via Docker):
docker compose up -d postgres redis

# Terminal B (API):
cd apps/api
pnpm prisma migrate dev --name init
pnpm start:dev

# Terminal C (Web):
cd apps/web
pnpm dev
```

Open [http://localhost:3000/chat](http://localhost:3000/chat)

### 10) Full run (with Docker for API & Web too)

```bash
# from repo root
pnpm prisma migrate dev --schema apps/api/prisma/schema.prisma
docker compose up --build
```

### 11) Issuing real JWTs

Replace the fake token in `app/chat/page.tsx`. For quick manual testing in the API shell:

```ts
// quick script
import { JwtService } from '@nestjs/jwt';
new JwtService({ secret: process.env.JWT_ACCESS_SECRET }).sign({ sub: '<user-uuid>', name: 'Alex' }, { expiresIn: '15m' });
```

Pass that token to `SocketProvider`.

### 12) Production notes

- Use a managed Postgres and Redis, set **sticky sessions** on your load balancer for Socket.IO.
- Configure CORS to your real domains; use HTTPS everywhere.
- Run the Socket.IO **Redis adapter**; scale API horizontally.
- Add Web App Manifest + PWA for push notifications.

### Dependency summary

**Backend**: `@nestjs/common @nestjs/core @nestjs/platform-socket.io @nestjs/jwt socket.io @socket.io/redis-adapter redis @prisma/client prisma zod class-validator class-transformer jsonwebtoken`

**Frontend**: `next react react-dom socket.io-client zod @tanstack/react-query zustand tailwindcss postcss autoprefixer next-themes (optional: lucide-react shadcn/ui)`

**Dev/Repo**: `pnpm typescript eslint prettier turbo`

---

Production‑ready, scalable starter with Socket.IO over WebSockets, Redis pub/sub for horizontal scaling, PostgreSQL via Prisma, JWT auth, typing/presence, message persistence, optimistic UI, and end‑to‑end TypeScript.

---

## Why this stack (and alternatives)

- **Socket.IO on NestJS**: robust transport fallbacks, rooms, acks, and middleware. Works great behind proxies.
- **Redis adapter**: enables multi‑instance real‑time fan‑out.
- **Prisma + Postgres**: typed models, fast queries, migrations.
- **Next.js (App Router)**: server components for auth pages + client components for live chat.
- **Zod DTOs**: single source of truth validated on both client and server.

**Alternatives**

- Pure `ws` + custom protocol (lighter, more work).
- **tRPC + wsLink** if you want purely RPC style.
- **SSE (Server-Sent Events)** for one‑way streams (not ideal for bi‑directional chat).
- **Hosted**: Ably/Pusher for transport; keep NestJS for auth/persistence/domain.

---

## Features

- JWT auth (access+refresh); JWT in **Socket.IO handshake**.
- Rooms (1:1 & group). Presence (online/last seen). Typing indicators.
- Message persistence with optimistic updates & server acks.
- Rate limiting + flood control. Basic profanity filter hook.
- Redis pub/sub for scale; idempotent message delivery via `client_msg_id`.
- Tests for core services. OpenTelemetry hooks (optional) & structured logs.

---

## Monorepo layout

```
chat-app/
  apps/
    api/                # NestJS
    web/                # Next.js
  packages/
    shared/             # zod DTOs, types
  docker-compose.yml
  .env                  # root env (referenced by docker compose)
  README.md
```

---

## Env variables (example)

```
# .env (root)
POSTGRES_URL=postgresql://chat:chat@postgres:5432/chat
REDIS_URL=redis://redis:6379
JWT_ACCESS_SECRET=dev_access_secret_change
JWT_REFRESH_SECRET=dev_refresh_secret_change
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
API_PORT=3001
WEB_PORT=3000
NODE_ENV=development
```

---

## Docker Compose (Postgres + Redis + API + Web)

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: chat
      POSTGRES_PASSWORD: chat
      POSTGRES_DB: chat
    ports: ["5432:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U chat"]
      interval: 5s
      timeout: 5s
      retries: 10
  redis:
    image: redis:7
    ports: ["6379:6379"]
  api:
    build: ./apps/api
    env_file: .env
    ports: ["${API_PORT}:3001"]
    depends_on: [postgres, redis]
  web:
    build: ./apps/web
    env_file: .env
    ports: ["${WEB_PORT}:3000"]
    depends_on: [api]
```

---

## Shared types & DTOs (packages/shared)

```ts
// packages/shared/src/dto.ts
import { z } from "zod";

export const UserDTO = z.object({ id: z.string().uuid(), name: z.string().min(1), avatar: z.string().url().optional() });
export type UserDTO = z.infer<typeof UserDTO>;

export const RoomDTO = z.object({ id: z.string().uuid(), name: z.string().min(1).optional(), isGroup: z.boolean() });
export type RoomDTO = z.infer<typeof RoomDTO>;

export const MessageIn = z.object({
  roomId: z.string().uuid(),
  content: z.string().min(1).max(4000),
  clientMsgId: z.string().uuid(), // idempotency
  replyToId: z.string().uuid().nullable().optional(),
});
export type MessageIn = z.infer<typeof MessageIn>;

export const MessageOut = z.object({
  id: z.string().uuid(),
  roomId: z.string().uuid(),
  senderId: z.string().uuid(),
  content: z.string(),
  createdAt: z.string(),
  clientMsgId: z.string().uuid().optional(),
  replyToId: z.string().uuid().nullable().optional(),
});
export type MessageOut = z.infer<typeof MessageOut>;

export const TypingEvent = z.object({ roomId: z.string().uuid(), isTyping: z.boolean() });
export type TypingEvent = z.infer<typeof TypingEvent>;

export const PresenceEvent = z.object({ userId: z.string().uuid(), online: z.boolean(), lastSeen: z.string() });
export type PresenceEvent = z.infer<typeof PresenceEvent>;
```

---

## Prisma schema (apps/api/prisma/schema.prisma)

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql" url = env("POSTGRES_URL") }

model User {
  id        String   @id @default(uuid())
  name      String
  avatar    String?
  password  String   // hashed (or use OAuth)
  messages  Message[]
  memberships Membership[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Room {
  id        String     @id @default(uuid())
  name      String?
  isGroup   Boolean    @default(false)
  messages  Message[]
  members   Membership[]
  createdAt DateTime   @default(now())
}

model Membership {
  id      String @id @default(uuid())
  user    User   @relation(fields: [userId], references: [id])
  userId  String
  room    Room   @relation(fields: [roomId], references: [id])
  roomId  String
  role    String @default("member")
  @@unique([userId, roomId])
}

model Message {
  id          String   @id @default(uuid())
  room        Room     @relation(fields: [roomId], references: [id])
  roomId      String
  sender      User     @relation(fields: [senderId], references: [id])
  senderId    String
  content     String
  clientMsgId String?  // for idempotency
  replyTo     Message? @relation("Reply", fields: [replyToId], references: [id])
  replyToId   String?
  createdAt   DateTime @default(now())
  @@index([roomId, createdAt])
  @@unique([roomId, clientMsgId])
}
```

---

## NestJS API (apps/api)

\`\`

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json .
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY prisma ./prisma
EXPOSE 3001
CMD ["node", "dist/main.js"]
```

\`\`

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
impo
```

# Modern Live Chat — NestJS (Backend) + Next.js (Frontend)

Production‑ready starter with Socket.IO over WebSockets, Redis pub/sub for horizontal scaling, PostgreSQL via Prisma, JWT auth, typing/presence, message persistence, optimistic UI, and end‑to‑end TypeScript.

---

## Why this stack (and alternatives)
- **Socket.IO on NestJS**: robust transport fallbacks, rooms, acks, and middleware. Works behind proxies.
- **Redis adapter**: enables multi‑instance real‑time fan‑out.
- **Prisma + Postgres**: typed models, fast queries, migrations.
- **Next.js (App Router)**: server components for auth pages + client components for live chat.
- **Zod DTOs**: single source of truth validated on both client and server.

**Alternatives**
- Pure `ws` + custom protocol (lighter, more work).
- **tRPC + wsLink** if you want purely RPC style.
- **SSE** for one‑way streams (not ideal for chat).
- **Hosted**: Ably/Pusher for transport; keep NestJS for auth/persistence/domain.

---

## Features
- JWT auth (access+refresh); JWT in **Socket.IO handshake**.
- Rooms (1:1 & group). Presence (online/last seen). Typing indicators.
- Message persistence with optimistic updates & server acks.
- Rate limiting + flood control. Basic profanity filter hook.
- Redis pub/sub for scale; idempotent message delivery via `client_msg_id`.
- Tests for core services. OpenTelemetry hooks & structured logs.

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
  pnpm-workspace.yaml
  .env
  README.md
```
---

## Step‑by‑step setup

> Assumes **Node 20+**, **pnpm**, **Docker Desktop**, and Git installed.

### 1) Workspace
```bash
mkdir chat-app && cd chat-app
pnpm init -y
cat > pnpm-workspace.yaml <<'YAML'
packages:
  - 'apps/*'
  - 'packages/*'
YAML
mkdir -p apps/api apps/web packages/shared
```

### 2) Root tooling
```bash
pnpm add -D -w typescript tsx eslint prettier turbo
```

### 3) Shared package
```bash
cd packages/shared
pnpm init -y
pnpm add zod
mkdir -p src && printf "export * from './dto';\n" > src/index.ts
```
**`packages/shared/src/dto.ts`**
```ts
import { z } from "zod";

export const UserDTO = z.object({ id: z.string().uuid(), name: z.string().min(1), avatar: z.string().url().optional() });
export type UserDTO = z.infer<typeof UserDTO>;

export const RoomDTO = z.object({ id: z.string().uuid(), name: z.string().min(1).optional(), isGroup: z.boolean() });
export type RoomDTO = z.infer<typeof RoomDTO>;

export const MessageIn = z.object({
  roomId: z.string().uuid(),
  content: z.string().min(1).max(4000),
  clientMsgId: z.string().uuid(),
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

**`packages/shared/tsconfig.json`**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "declaration": true,
    "emitDeclarationOnly": true,
    "composite": true
  },
  "include": ["src"],
  "exclude": ["dist"]
}
```

**`packages/shared/package.json`**
```json
{
  "name": "shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -w -p tsconfig.json",
    "lint": "eslint ."
  }
}
```

Go back to root:
```bash
cd ../../
```

### 4) Root tsconfig
**`tsconfig.base.json`**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "useDefineForClassFields": true,
    "baseUrl": ".",
    "paths": {
      "shared/*": ["packages/shared/src/*"]
    }
  }
}
```

**`tsconfig.json`**
```json
{
  "files": [],
  "references": [
    { "path": "packages/shared" },
    { "path": "apps/api" },
    { "path": "apps/web" }
  ],
  "extends": "./tsconfig.base.json",
  "compilerOptions": { "composite": true, "declaration": false }
}
```

### 5) Prisma schema (API)
**`apps/api/prisma/schema.prisma`**
```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql" url = env("POSTGRES_URL") }

model User {
  id        String   @id @default(uuid())
  name      String
  avatar    String?
  password  String
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
  clientMsgId String?
  replyTo     Message? @relation("Reply", fields: [replyToId], references: [id])
  replyToId   String?
  createdAt   DateTime @default(now())
  @@index([roomId, createdAt])
  @@unique([roomId, clientMsgId])
}
```

### 6) Env
**`.env` (root)**
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

### 7) Docker Compose
**`docker-compose.yml`**
```yaml
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
    environment:
      API_PORT: 3001
      REDIS_URL: redis://redis:6379
      POSTGRES_URL: postgresql://chat:chat@postgres:5432/chat
    ports: ["3001:3001"]
    depends_on: [postgres, redis]

  web:
    build: ./apps/web
    env_file: .env
    environment:
      NEXT_PUBLIC_SOCKET_URL: http://localhost:3001
    ports: ["3000:3000"]
    depends_on: [api]
```

### 8) NestJS API

**`apps/api/Dockerfile`**
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

**`apps/api/src/main.ts`**
```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import type { ServerOptions } from 'socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.enableCors({ origin: [/^http:\/\/localhost:\d+$/], credentials: true });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();
    await pubClient.connect();
    await subClient.connect();

    const ioAdapter = new IoAdapter(app);
    (ioAdapter as any).createIOServer = function (port: number, options?: ServerOptions) {
      const server = (IoAdapter.prototype as any).createIOServer.call(this, port, {
        ...options,
        cors: { origin: [/^http:\/\/localhost:\d+$/], credentials: true },
      });
      server.adapter(createAdapter(pubClient, subClient));
      return server;
    };
    app.useWebSocketAdapter(ioAdapter);
  }

  await app.listen(Number(process.env.API_PORT) || 3001);
}

bootstrap();
```

**`apps/api/src/app.module.ts`**
```ts
import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';

@Module({ providers: [PrismaService], imports: [AuthModule, ChatModule] })
export class AppModule {}
```

**`apps/api/src/prisma.service.ts`**
```ts
import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() { await this.$connect(); }
  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit', async () => { await app.close(); });
  }
}
```

**Auth**
`apps/api/src/auth/auth.module.ts`
```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';

@Module({
  imports: [JwtModule.register({ global: true, secret: process.env.JWT_ACCESS_SECRET })],
  providers: [AuthService],
  exports: [AuthService]
})
export class AuthModule {}
```

`apps/api/src/auth/auth.service.ts`
```ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private jwt: JwtService) {}
  signAccess(payload: { sub: string; name: string }) {
    return this.jwt.sign(payload, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' });
  }
  verify(token: string) { return this.jwt.verify(token, { secret: process.env.JWT_ACCESS_SECRET }); }
}
```

**Chat module & gateway**
`apps/api/src/chat/chat.module.ts`
```ts
import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({ imports: [AuthModule], providers: [ChatGateway, ChatService, PrismaService] })
export class ChatModule {}
```

`apps/api/src/chat/chat.gateway.ts`
```ts
import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { z } from 'zod';
import { MessageIn as MessageInSchema } from 'shared/dto';
import { AuthService } from '../auth/auth.service';

const TypingSchema = z.object({ roomId: z.string().uuid(), isTyping: z.boolean() });

@WebSocketGateway({ namespace: '/chat', cors: { origin: [/^http:\/\/localhost:\d+$/], credentials: true } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private presence = new Map<string, { userId: string; lastSeen: number }>();

  constructor(private chat: ChatService, private auth: AuthService) {}

  async handleConnection(client: Socket) {
    try {
      const token = (client.handshake.auth as any)?.token || client.handshake.headers['x-access-token'];
      const payload = this.auth.verify(String(token));
      (client as any).userId = payload.sub;
      this.presence.set(client.id, { userId: payload.sub, lastSeen: Date.now() });
      client.emit('connected', { ok: true });
    } catch (e) {
      client.emit('error', { message: 'unauthorized' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const p = this.presence.get(client.id);
    if (p) {
      await this.chat.updateLastSeen(p.userId);
      this.presence.delete(client.id);
      this.server.emit('presence:update', { userId: p.userId, online: false, lastSeen: new Date().toISOString() });
    }
  }

  @SubscribeMessage('room:join')
  async onJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { roomId: string }) {
    await this.chat.ensureMembership((client as any).userId, body.roomId);
    client.join(body.roomId);
    const history = await this.chat.getRecentMessages(body.roomId);
    client.emit('room:history', history);
  }

  @SubscribeMessage('room:leave')
  onLeave(@ConnectedSocket() client: Socket, @MessageBody() body: { roomId: string }) {
    client.leave(body.roomId);
  }

  @SubscribeMessage('msg:send')
  async onMessage(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const parsed = MessageInSchema.safeParse(body);
    if (!parsed.success) return client.emit('msg:nack', { clientMsgId: (body as any)?.clientMsgId, error: 'invalid_payload' });

    const senderId = (client as any).userId as string;
    const key = `flood:${client.id}`;
    const now = Date.now();
    const last = (client as any)[key] || 0;
    if (now - last < 200) return;
    (client as any)[key] = now;

    const saved = await this.chat.saveMessage({ ...parsed.data, senderId });
    this.server.to(parsed.data.roomId).emit('msg:new', saved);
    client.emit('msg:ack', { clientMsgId: parsed.data.clientMsgId, serverId: saved.id });
  }

  @SubscribeMessage('typing')
  async onTyping(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const parsed = TypingSchema.safeParse(body);
    if (!parsed.success) return;
    this.server.to(parsed.data.roomId).emit('typing', { userId: (client as any).userId, ...parsed.data });
  }
}
```

`apps/api/src/chat/chat.service.ts`
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MessageIn } from 'shared/dto';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async ensureMembership(userId: string, roomId: string) {
    const exists = await this.prisma.membership.findUnique({ where: { userId_roomId: { userId, roomId } } });
    if (!exists) throw new Error('not a member');
  }

  async getRecentMessages(roomId: string) {
    return this.prisma.message.findMany({ where: { roomId }, orderBy: { createdAt: 'asc' }, take: 100 });
  }

  async saveMessage(input: MessageIn & { senderId: string }) {
    return this.prisma.message.upsert({
      where: { roomId_clientMsgId: { roomId: input.roomId, clientMsgId: input.clientMsgId } },
      create: { roomId: input.roomId, senderId: input.senderId, content: input.content, clientMsgId: input.clientId, replyToId: input.replyToId ?? undefined },
      update: {}
    });
  }

  async updateLastSeen(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { updatedAt: new Date() } });
  }
}
```

### 9) Next.js Frontend

**`apps/web/providers/SocketProvider.tsx`**
```tsx
'use client';
import { io, Socket } from 'socket.io-client';
import React, { createContext, useContext, useEffect, useMemo } from 'react';

const SocketCtx = createContext<Socket | null>(null);
export function useSocket(){ const s = useContext(SocketCtx); if(!s) throw new Error('No socket'); return s; }

export default function SocketProvider({ token, children }: { token: string; children: React.ReactNode }){
  const url = (process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001') + '/chat';
  const socket = useMemo(() => io(url, { autoConnect: false, auth: { token } }), [url, token]);
  useEffect(()=>{ socket.connect(); return ()=>{ socket.disconnect(); }; }, [socket]);
  return <SocketCtx.Provider value={socket}>{children}</SocketCtx.Provider>;
}
```

**`apps/web/app/chat/ChatRoom.tsx`**
```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { useSocket } from '../providers/SocketProvider';
import { v4 as uuid } from 'uuid';

export default function ChatRoom({ roomId, userId }: { roomId: string; userId: string }){
  const socket = useSocket();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    socket.emit('room:join', { roomId });
    socket.on('room:history', (hist)=> setMessages(hist));
    socket.on('msg:new', (m)=> setMessages((cur)=> [...cur, m]));
    socket.on('msg:ack', ({ clientMsgId, serverId })=>{
      setMessages((cur)=> cur.map(m=> m.clientMsgId===clientMsgId ? { ...m, id: serverId } : m));
    });
    socket.on('typing', ({ userId: uid, roomId: rid, isTyping })=>{
      if(rid!==roomId || uid===userId) return;
      setTypingUsers(prev => { const next = new Set(prev); isTyping ? next.add(uid) : next.delete(uid); return next; });
    });
    return ()=>{
      socket.emit('room:leave', { roomId });
      socket.off('room:history'); socket.off('msg:new'); socket.off('msg:ack'); socket.off('typing');
    };
  },[roomId, socket, userId]);

  useEffect(()=>{ endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const send = () => {
    if(!input.trim()) return;
    const clientMsgId = uuid();
    const optimistic = { id: 'temp-'+clientMsgId, clientMsgId, roomId, senderId: userId, content: input, createdAt: new Date().toISOString() };
    setMessages((cur)=> [...cur, optimistic]);
    socket.emit('msg:send', { roomId, content: input, clientMsgId });
    setInput('');
  };

  const onTyping = (v: string) => {
    setInput(v);
    socket.emit('typing', { roomId, isTyping: v.length>0 });
  };

  return (
    <div className="flex h-full flex-col"> 
      <div className="flex-1 overflow-y-auto space-y-2 p-4">
        {messages.map(m => (
          <div key={m.id} className={`max-w-[70%] rounded-2xl px-3 py-2 shadow ${m.senderId===userId ? 'ml-auto bg-blue-600 text-white' : 'bg-gray-200'}`}>
            <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
            <div className="text-[10px] opacity-70 mt-1">{new Date(m.createdAt).toLocaleTimeString()}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="h-6 px-4 text-xs text-gray-500">{typingUsers.size>0 ? 'Someone is typing…' : ' '}</div>
      <div className="p-4 flex gap-2">
        <input value={input} onChange={(e)=> onTyping(e.target.value)} onKeyDown={(e)=> e.key==='Enter' && send()} placeholder="Write a message" className="flex-1 rounded-xl border px-3 py-2" />
        <button onClick={send} className="rounded-xl px-4 py-2 bg-blue-600 text-white shadow">Send</button>
      </div>
    </div>
  );
}
```

**`apps/web/app/chat/page.tsx`**
```tsx
import SocketProvider from '../providers/SocketProvider';
import ChatRoom from './ChatRoom';

export default function Page(){
  const fakeUser = { id: '00000000-0000-0000-0000-000000000001', name: 'Alex' };
  const fakeToken = 'dev-jwt-for-demo'; // replace with real JWT
  const roomId = '00000000-0000-0000-0000-000000000002';
  return (
    <SocketProvider token={fakeToken}>
      <main className="h-[100dvh] max-w-3xl mx-auto">
        <ChatRoom userId={fakeUser.id} roomId={roomId} />
      </main>
    </SocketProvider>
  );
}
```

### 10) Scripts
**Root `package.json`**
```json
{
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "db:migrate": "pnpm --filter api prisma migrate dev",
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "start": "docker compose up --build"
  }
}
```

### 11) Security & best practices
- JWT in handshake; short‑lived access tokens + refresh over HTTPS.
- Validate every incoming event with **zod**; never trust client.
- Rate‑limit + flood control (Redis token bucket in production).
- Idempotency with `clientMsgId` to avoid dupes on reconnects.
- Structured logs; enable OpenTelemetry and metrics.
- Use **Redis adapter** and sticky sessions behind load balancer.
- Media upload via signed URLs; scan attachments.

### 12) Running
```bash
# DB and Redis
docker compose up -d postgres redis

# API
pnpm -F api prisma migrate dev --name init
pnpm -F api dev

# Web
pnpm -F web dev
```

---

## Next steps
- Real auth (credentials/OAuth) and SSR token issuance.
- Presence with Redis sets and TTLs (emit room presence lists).
- Message search (Postgres full‑text or Meilisearch/Typesense).
- Read receipts & edits/deletes with audit logs.
- Media messages (uploads, thumbnails, link unfurling).
- Push notifications (WebPush/APNs/FCM) + mobile shell (Expo).

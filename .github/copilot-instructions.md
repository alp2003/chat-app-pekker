# Chat App - AI Coding Agent Instructions

## Architecture Overview

This is a real-time chat application built with **Turborepo monorepo** structure:
- `apps/api` - NestJS backend with WebSocket gateway, Prisma ORM, Redis caching, structured logging
- `apps/web` - Next.js frontend with Zustand state management, Socket.IO client, Jest/Playwright testing
- `packages/shared` - Shared TypeScript types and Zod schemas for type-safe API contracts

## Critical Developer Workflows

### Development Setup
```bash
pnpm dev          # Runs both frontend/backend in parallel via Turbo
pnpm start        # Docker Compose production build (postgres + redis + api + web)
```

### Database Operations  
```bash
pnpm db:migrate           # Run Prisma migrations
pnpm db:migrate:status    # Check migration status  
pnpm --filter api prisma studio  # Database GUI
```

### Testing & Quality Assurance
```bash
pnpm test:unit           # Jest unit tests (frontend components)
pnpm test:e2e           # Playwright E2E tests  
pnpm test:integration   # NestJS integration tests
pnpm ci:all             # Complete CI pipeline (typecheck, lint, test, build, audit, db)
```

### Debugging
```bash
# VSCode debugging configured for NestJS backend
# Launch config: "Debug API (NestJS)" or "Attach to NestJS" (port 9229)
```

## Project-Specific Patterns

### 1. **BFF Pattern with Next.js API Routes**
- **Most API calls**: `/api/chat/*`, `/api/users/*` → Next.js BFF (`apps/web/src/app/api/[...path]/route.ts`) → Backend `http://localhost:3001`
- **Auth routes handled separately**: `/api/auth/*` → Direct Next.js routes (`apps/web/src/app/api/auth/*/route.ts`) → Backend
- **WebSocket connections bypass BFF** and connect directly to backend
- **Cookie forwarding**: BFF manually forwards HTTP-only auth cookies to backend
- **Route exclusion logic**: BFF returns 404 for `/api/auth/*` to avoid conflicts with dedicated auth handlers

### 2. **Enterprise-Grade Error Handling**
- **Validation-first approach**: Always validate users exist before operations (see `AI_RULES.md`)
- **No automatic user creation**: Strict validation with descriptive error messages
- **Custom Zod validation pipe**: `ZodBody<T>` for type-safe request validation
- **Structured exceptions**: `BadRequestException`, `NotFoundException` with specific error codes

### 3. **State Management Architecture**
- **Zustand store** (`apps/web/src/stores/chatStore.ts`) handles all chat state (1100+ lines)
- **Socket.IO integration** - WebSocket events directly update Zustand store via event handlers
- **Optimistic updates** for messages with `clientMsgId` for acknowledgment flow
- **Auto-room joining**: Users automatically join WebSocket rooms when conversations are created

### 4. **Caching & Performance Strategy**
- **Redis multi-layer caching** with TTL-based invalidation (`CacheService`)
- **PrismaOptimizer** for keyset pagination and optimized database queries
- **Cache patterns**: `conversations:{userId}`, `messages:{roomId}:page:{n}`
- **Selective caching**: Only cache result sets ≤5000 items (3-minute TTL)

### 5. **Logging & Observability**
- **Structured logging** with Pino (backend) and custom Logger (frontend) 
- **Correlation IDs**: Request tracking with `requestId` and `correlationId`
- **Emoji-prefixed debug logs**: `🔵` (messages), `📫` (unread), `🚀` (socket), `🗑️` (cache)
- **Environment-controlled**: `LOG_LEVEL`, `NEXT_PUBLIC_VERBOSE_LOGS` for granular control

## Integration Points

### WebSocket Communication
- **Backend Gateway**: `apps/api/src/chat/chat.gateway.ts` with Socket.IO
- **Frontend Manager**: `apps/web/src/providers/SocketProvider.tsx` with connection management
- **Event Types**: `msg:new`, `msg:ack`, `room:join`, `conversation:created`, `reaction:update`
- **Authentication**: JWT validation on WebSocket connect with cookie-based tokens

### Real-time Message Flow
1. User sends message → Optimistic update in Zustand → WebSocket emit `msg:send`
2. Backend validates → Saves to DB → Broadcasts `msg:new` to room members  
3. Recipients auto-join rooms via `conversation:created` event handler
4. Unread count logic in `chatStore._incrementUnreadCount()` with timing safeguards
5. Message acknowledgment via `msg:ack` removes pending status

### Authentication Architecture
- **JWT + refresh token pattern** with HTTP-only cookies
- **Auto-refresh middleware**: `apps/web/src/middleware.ts` with fallback logic
- **Token refresh wrapper**: `TokenRefreshWrapper.tsx` for UI loading states
- **Session management**: Prisma sessions with user-agent tracking and auto-expiry

## Key Files for Understanding

- `apps/web/src/stores/chatStore.ts` (1100+ lines) - Central state management with WebSocket integration
- `apps/api/src/chat/chat.service.ts` (590+ lines) - Core business logic (needs refactoring per best practices)
- `apps/api/src/common/prisma/prisma-optimizer.ts` - Database query optimization patterns
- `apps/web/src/lib/api.ts` - HTTP client with auto-refresh and global state management
- `packages/shared/src/dto.ts` - Type-safe API contracts with Zod validation schemas

## Testing Patterns

### Frontend Testing
- **Jest + React Testing Library** for component unit tests
- **Playwright** for E2E browser testing with multiple browser support
- **Mock patterns**: Next.js functions mocked in `__tests__` directories
- **Coverage exclusions**: App directory, types, and routing files excluded

### Backend Testing  
- **NestJS Testing Module** with dependency injection mocking
- **Supertest** for HTTP endpoint testing
- **Mock PrismaService**: Database mocking for isolated unit tests
- **Health checks**: Database connectivity validation in test environment

## Code Quality & Standards

### Development Guardrails (per `AI_RULES.md`)
- **🚫 No public API contract changes** without explicit approval
- **🚫 No database schema changes** in feature PRs
- **✅ Minimal diff policy** - surgical changes only, no whole-file rewrites
- **🛡️ Risk management** - feature flags for experimental changes

### Code Style
- **Prettier configuration**: Single quotes, trailing commas, 80-char width
- **ESLint**: TypeScript-recommended rules with custom overrides
- **Import organization**: Absolute imports with `@/` path mapping

## Environment & Configuration

### Required Environment Variables
```bash
# Backend (.env)
JWT_ACCESS_SECRET=<16+ chars>    # JWT signing key
JWT_REFRESH_SECRET=<16+ chars>   # Refresh token signing
DATABASE_URL=postgresql://...    # Postgres connection
REDIS_URL=redis://localhost:6379 # Redis cache

# Frontend  
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001  # WebSocket endpoint
NEXT_PUBLIC_VERBOSE_LOGS=true                 # Debug logging
```

### Docker Development
- **Multi-service setup**: Postgres, Redis, API, Web via `docker-compose.yml`
- **Health checks**: Database connectivity validation
- **Port mapping**: API (3001), Web (3000), Postgres (5432), Redis (6379)

## Common Pitfalls & Solutions

1. **Socket Connection Timing** - Always verify socket connection before emitting events
2. **Room Auto-joining** - New conversation participants must auto-join WebSocket rooms via `conversation:created`
3. **Cache Invalidation** - Always invalidate relevant caches after DB mutations using `CacheService` methods
4. **Message Status Flow** - Handle optimistic updates, pending states, and acknowledgment responses properly
5. **Unread Count Logic** - Only increment for non-active conversations, clear on room selection
6. **Token Refresh Race Conditions** - Use singleton refresh logic to prevent multiple simultaneous refresh attempts
7. **Prisma Transaction Timeouts** - Use `PrismaOptimizer.executeTransaction()` with appropriate timeout configs

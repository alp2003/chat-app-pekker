# Cache and Rate Limiting Configuration

## Environment Variables

### Core Redis Configuration

| Variable         | Description                   | Default     | Example                |
| ---------------- | ----------------------------- | ----------- | ---------------------- |
| `REDIS_HOST`     | Redis server hostname         | `localhost` | `redis.example.com`    |
| `REDIS_PORT`     | Redis server port             | `6379`      | `6380`                 |
| `REDIS_PASSWORD` | Redis authentication password | -           | `your-secure-password` |

### Feature Flags

| Variable        | Description                                           | Default | Values                        |
| --------------- | ----------------------------------------------------- | ------- | ----------------------------- |
| `CACHE_TICKETS` | Enable/disable read-through caching for GET endpoints | `0`     | `0` (disabled), `1` (enabled) |

## Cache Configuration

### Read-Through Caching

When `CACHE_TICKETS=1`, the following GET endpoints are cached:

1. **GET /chat/conversations**
   - Cache Key: `conversations:user:{userId}`
   - TTL: 60 seconds with 10% jitter
   - Automatically invalidated on new messages or room changes

2. **GET /chat/messages**
   - Cache Key: `messages:room:{roomId}:user:{userId}`
   - TTL: 30 seconds with 20% jitter
   - Includes query parameters in key

3. **GET /users/search** (example)
   - Cache Key: `users:search:{query}`
   - TTL: 120 seconds with 15% jitter

### Cache Key Patterns

- `:userId` - Replaced with authenticated user ID
- `:path` - Replaced with request path
- `:method` - Replaced with HTTP method
- Query parameters are automatically appended

### TTL and Jitter

- **TTL**: Time To Live in seconds
- **Jitter**: Percentage variance to prevent cache stampede
  - Example: 60s TTL with 20% jitter = 48-72 seconds actual TTL

## Rate Limiting Configuration

### Default Rate Limits

| Endpoint              | Pattern    | Window | Limit | Description                           |
| --------------------- | ---------- | ------ | ----- | ------------------------------------- |
| `POST /chat/dm/start` | User-based | 60s    | 10    | DM creation per user per minute       |
| `POST /chat/groups`   | User-based | 300s   | 5     | Group creation per user per 5 minutes |
| `POST /auth/login`    | IP-based   | 300s   | 10    | Login attempts per IP per 5 minutes   |
| `POST /auth/register` | IP-based   | 3600s  | 5     | Registration attempts per IP per hour |

### Rate Limiting Headers

When rate limiting is active, the following headers are included in responses:

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1672531200
```

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

### Rate Limit Keys

- **User-based**: `rate_limit:user:{userId}`
- **IP-based**: `rate_limit:ip:{ipAddress}`
- **Custom**: Defined per endpoint

## Docker Configuration

### Redis Container

```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    environment:
      - REDIS_PASSWORD=${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    command: redis-server --requirepass ${REDIS_PASSWORD}

volumes:
  redis_data:
```

### Environment File

```bash
# .env
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password
CACHE_TICKETS=1
```

## Testing Configuration

### In-Memory Mock

For testing, an in-memory Redis mock is provided:

```typescript
import { RedisMock } from './common/cache/__mocks__/redis.mock';

// Jest automatically uses the mock when importing 'ioredis'
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => new RedisMock());
});
```

### Test Environment Variables

```bash
# .env.test
REDIS_HOST=localhost
REDIS_PORT=6379
CACHE_TICKETS=1
# No password needed for testing
```

## Performance Considerations

### Cache Hit Rates

Monitor cache effectiveness:

- Aim for >80% hit rate on frequently accessed data
- Monitor cache miss patterns for optimization opportunities

### Memory Usage

- Redis memory usage scales with cache size
- Consider eviction policies for production:
  - `allkeys-lru`: Evict least recently used keys
  - `volatile-ttl`: Evict keys with shortest TTL

### Rate Limiting Overhead

- Sliding window rate limiting uses sorted sets
- Memory usage: ~100-200 bytes per rate limit entry
- Automatic cleanup of expired entries

## Monitoring and Observability

### Structured Logging

Cache operations are logged with structured data:

```json
{
  "level": "info",
  "service": "CacheHelper",
  "message": "Cache hit",
  "key": "conversations:user:123",
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

### Metrics to Monitor

1. **Cache Performance**
   - Hit rate percentage
   - Average response time with/without cache
   - Cache eviction rate

2. **Rate Limiting**
   - Requests blocked per endpoint
   - Top rate-limited users/IPs
   - Rate limit effectiveness

3. **Redis Health**
   - Connection status
   - Memory usage
   - Command latency

## Production Deployment

### Redis High Availability

```yaml
# Redis Cluster or Sentinel setup
services:
  redis-primary:
    image: redis:7-alpine
    volumes:
      - ./redis.conf:/etc/redis/redis.conf
    command: redis-server /etc/redis/redis.conf

  redis-replica:
    image: redis:7-alpine
    command: redis-server --slaveof redis-primary 6379
```

### Security Considerations

1. **Network Security**
   - Use private networks for Redis connections
   - Enable TLS for Redis connections in production

2. **Authentication**
   - Always set `REDIS_PASSWORD` in production
   - Rotate Redis passwords regularly

3. **Access Control**
   - Limit Redis commands using ACL (Access Control Lists)
   - Monitor for suspicious access patterns

### Scaling Considerations

1. **Horizontal Scaling**
   - Use Redis Cluster for distributed caching
   - Shard rate limiting keys across multiple Redis instances

2. **Vertical Scaling**
   - Monitor Redis memory usage
   - Adjust max memory and eviction policies

3. **Backup and Recovery**
   - Enable Redis persistence (RDB/AOF)
   - Regular backups for rate limiting data

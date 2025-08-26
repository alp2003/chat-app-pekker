import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.API_PORT ?? '3001', 10),
  redisUrl: process.env.REDIS_URL,
  databaseUrl: process.env.DATABASE_URL,
  socketOrigin: process.env.NEXT_PUBLIC_SOCKET_URL,
  
  // Cache TTL configuration (in seconds)
  cache: {
    defaultTtl: parseInt(process.env.CACHE_DEFAULT_TTL ?? '900', 10), // 15 minutes
    userTtl: parseInt(process.env.CACHE_USER_TTL ?? '1800', 10), // 30 minutes
    conversationsTtl: parseInt(process.env.CACHE_CONVERSATIONS_TTL ?? '900', 10), // 15 minutes
    messagesTtl: parseInt(process.env.CACHE_MESSAGES_TTL ?? '600', 10), // 10 minutes
    sessionTtl: parseInt(process.env.CACHE_SESSION_TTL ?? '3300', 10), // 55 minutes
  },
}));

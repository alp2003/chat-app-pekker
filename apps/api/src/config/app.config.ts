import * as path from 'path';
import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.API_PORT ?? '3001', 10),
  redisUrl: process.env.REDIS_URL,
  databaseUrl: process.env.DATABASE_URL,
  socketOrigin: process.env.NEXT_PUBLIC_SOCKET_URL,
}));

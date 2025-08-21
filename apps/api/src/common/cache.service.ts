import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType | undefined;
  private readonly defaultTtl = 300; // 5 minutes
  private invalidationQueue = new Map<string, NodeJS.Timeout>();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('app.redisUrl');
    if (redisUrl) {
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 1000),
          connectTimeout: 10000,
        },
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
      });

      this.client.on('connect', () => {
        console.log('✅ Redis cache client connected');
      });

      await this.client.connect();
    } else {
      console.warn('⚠️ Redis URL not configured - cache service disabled');
    }
  }

  async onModuleDestroy() {
    // Clear all pending invalidation timers
    for (const timeout of this.invalidationQueue.values()) {
      clearTimeout(timeout);
    }
    this.invalidationQueue.clear();

    if (this.client) {
      await this.client.quit();
    }
  }

  private isEnabled(): boolean {
    return this.client?.isReady === true;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isEnabled() || !this.client) return null;

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    ttl: number = this.defaultTtl,
  ): Promise<boolean> {
    if (!this.isEnabled() || !this.client) return false;

    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
      console.log(`📝 Cached data for key: ${key} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      console.error('Redis set error:', error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isEnabled() || !this.client) return false;

    try {
      await this.client.del(key);
      console.log(`🗑️ Deleted cache for key: ${key}`);
      return true;
    } catch (error) {
      console.error('Redis del error:', error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isEnabled() || !this.client) return false;

    try {
      return (await this.client.exists(key)) === 1;
    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  }

  // User-specific cache methods
  getUserCacheKey(userId: string): string {
    return `user:${userId}`;
  }

  getConversationsCacheKey(userId: string): string {
    return `conversations:${userId}`;
  }

  getMessagesCacheKey(conversationId: string, page: number = 0): string {
    return `messages:${conversationId}:page:${page}`;
  }

  async cacheUser(
    userId: string,
    userData: any,
    ttl: number = 600,
  ): Promise<boolean> {
    return this.set(this.getUserCacheKey(userId), userData, ttl);
  }

  async getCachedUser(userId: string): Promise<any | null> {
    return this.get(this.getUserCacheKey(userId));
  }

  async invalidateUser(userId: string): Promise<boolean> {
    return this.del(this.getUserCacheKey(userId));
  }

  async cacheConversations(
    userId: string,
    conversations: any[],
    ttl: number = 300,
  ): Promise<boolean> {
    return this.set(this.getConversationsCacheKey(userId), conversations, ttl);
  }

  async getCachedConversations(userId: string): Promise<any[] | null> {
    return this.get(this.getConversationsCacheKey(userId));
  }

  async invalidateConversations(userId: string): Promise<boolean> {
    const key = `conversations:${userId}`;

    // Debounce rapid invalidations for the same key
    if (this.invalidationQueue.has(key)) {
      clearTimeout(this.invalidationQueue.get(key)!);
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(async () => {
        this.invalidationQueue.delete(key);
        const result = await this.del(this.getConversationsCacheKey(userId));
        resolve(result);
      }, 100); // 100ms debounce

      this.invalidationQueue.set(key, timeout);
    });
  }

  async cacheMessages(
    conversationId: string,
    messages: any[],
    page: number = 0,
    ttl: number = 180,
  ): Promise<boolean> {
    return this.set(
      this.getMessagesCacheKey(conversationId, page),
      messages,
      ttl,
    );
  }

  async getCachedMessages(
    conversationId: string,
    page: number = 0,
  ): Promise<any[] | null> {
    return this.get(this.getMessagesCacheKey(conversationId, page));
  }

  async invalidateMessages(conversationId: string): Promise<boolean> {
    const key = `messages:${conversationId}`;

    // Debounce rapid invalidations for the same conversation
    if (this.invalidationQueue.has(key)) {
      clearTimeout(this.invalidationQueue.get(key)!);
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(async () => {
        this.invalidationQueue.delete(key);

        // Invalidate all pages for this conversation
        const pattern = `messages:${conversationId}:page:*`;
        if (!this.isEnabled() || !this.client) {
          resolve(false);
          return;
        }

        try {
          const keys = await this.client.keys(pattern);
          if (keys.length > 0) {
            await this.client.del(keys);
            console.log(
              `🗑️ Invalidated ${keys.length} message cache entries for conversation: ${conversationId}`,
            );
          }
          resolve(true);
        } catch (error) {
          console.error('Redis invalidateMessages error:', error);
          resolve(false);
        }
      }, 100); // 100ms debounce

      this.invalidationQueue.set(key, timeout);
    });
  }
}

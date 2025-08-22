import { EventEmitter } from 'events';

/**
 * In-memory Redis mock for testing
 */
export class RedisMock extends EventEmitter {
  private store: Map<string, any> = new Map();
  private expiry: Map<string, NodeJS.Timeout> = new Map();
  private sortedSets: Map<string, Map<string, number>> = new Map();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async set(key: string, value: string): Promise<'OK'> {
    this.store.set(key, value);
    return 'OK';
  }

  async setex(key: string, ttl: number, value: string): Promise<'OK'> {
    this.store.set(key, value);
    
    // Clear existing timeout
    const existingTimeout = this.expiry.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Set expiration
    const timeout = setTimeout(() => {
      this.store.delete(key);
      this.expiry.delete(key);
    }, ttl * 1000);
    
    this.expiry.set(key, timeout);
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.has(key)) {
        this.store.delete(key);
        count++;
      }
      // Clear timeout
      const timeout = this.expiry.get(key);
      if (timeout) {
        clearTimeout(timeout);
        this.expiry.delete(key);
      }
    }
    return count;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
    return Array.from(this.store.keys()).filter(key => regex.test(key));
  }

  async expire(key: string, ttl: number): Promise<number> {
    if (!this.store.has(key)) return 0;
    
    // Clear existing timeout
    const existingTimeout = this.expiry.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Set new expiration
    const timeout = setTimeout(() => {
      this.store.delete(key);
      this.expiry.delete(key);
    }, ttl * 1000);
    
    this.expiry.set(key, timeout);
    return 1;
  }

  // Sorted sets operations for rate limiting
  async zadd(key: string, score: number, member: string): Promise<number> {
    if (!this.sortedSets.has(key)) {
      this.sortedSets.set(key, new Map());
    }
    const set = this.sortedSets.get(key)!;
    const isNew = !set.has(member);
    set.set(member, score);
    return isNew ? 1 : 0;
  }

  async zremrangebyscore(key: string, min: number, max: number): Promise<number> {
    const set = this.sortedSets.get(key);
    if (!set) return 0;
    
    let count = 0;
    for (const [member, score] of set.entries()) {
      if (score >= min && score <= max) {
        set.delete(member);
        count++;
      }
    }
    
    if (set.size === 0) {
      this.sortedSets.delete(key);
    }
    
    return count;
  }

  async zcard(key: string): Promise<number> {
    const set = this.sortedSets.get(key);
    return set ? set.size : 0;
  }

  async zrange(key: string, start: number, stop: number, ...args: string[]): Promise<string[]> {
    const set = this.sortedSets.get(key);
    if (!set) return [];
    
    const withScores = args.includes('WITHSCORES');
    const entries = Array.from(set.entries()).sort((a, b) => a[1] - b[1]);
    const sliced = entries.slice(start, stop + 1);
    
    if (withScores) {
      return sliced.flatMap(([member, score]) => [member, score.toString()]);
    }
    
    return sliced.map(([member]) => member);
  }

  // Pipeline operations
  pipeline() {
    const commands: Array<() => Promise<any>> = [];
    
    const pipeline = {
      zremrangebyscore: (key: string, min: number, max: number) => {
        commands.push(() => this.zremrangebyscore(key, min, max));
        return pipeline;
      },
      zcard: (key: string) => {
        commands.push(() => this.zcard(key));
        return pipeline;
      },
      expire: (key: string, ttl: number) => {
        commands.push(() => this.expire(key, ttl));
        return pipeline;
      },
      exec: async () => {
        const results = [];
        for (const command of commands) {
          try {
            const result = await command();
            results.push([null, result]);
          } catch (error) {
            results.push([error, null]);
          }
        }
        return results;
      }
    };
    
    return pipeline;
  }

  // Connection methods
  async connect(): Promise<void> {
    this.emit('connect');
  }

  async disconnect(): Promise<void> {
    // Clear all timeouts
    for (const timeout of this.expiry.values()) {
      clearTimeout(timeout);
    }
    this.expiry.clear();
    this.store.clear();
    this.sortedSets.clear();
    this.emit('close');
  }

  // Test utilities
  clear(): void {
    this.store.clear();
    this.sortedSets.clear();
    for (const timeout of this.expiry.values()) {
      clearTimeout(timeout);
    }
    this.expiry.clear();
  }

  size(): number {
    return this.store.size;
  }
}

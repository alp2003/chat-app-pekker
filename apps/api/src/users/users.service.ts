import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CacheService } from '../common/cache.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getMe({ userId }: { userId: string }) {
    // Try cache first
    const cached = await this.cache.getCachedUser(userId);
    if (cached) {
      console.log(`📖 Cache hit for user: ${userId}`);
      return cached;
    }

    console.log(`💾 Cache miss for user: ${userId} - querying database`);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, displayName: true, avatar: true },
    });

    if (user) {
      // Cache for 10 minutes
      await this.cache.cacheUser(userId, user, 600);
    }

    return user;
  }

  async searchUsers({ query, _me }: { _me: string; query: string }) {
    // For search results, we could implement caching too, but it's less beneficial
    // since search queries are more dynamic
    const users = await this.prisma.user.findMany({
      where: { username: { startsWith: query } },
      take: 10,
      select: { id: true, username: true, displayName: true, avatar: true },
    });

    return users.filter((u) => u.id !== _me);
  }
}

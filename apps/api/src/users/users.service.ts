import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CacheService } from '../common/cache.service';
import { PrismaOptimizer } from '../common/prisma/prisma-optimizer';

type UserProfile = {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getMe({ userId }: { userId: string }): Promise<UserProfile> {
    // Try cache first
    const cached = await this.cache.getCachedUser(userId);
    if (cached) {
      console.log(`📖 Cache hit for user: ${userId}`);
      return cached as UserProfile;
    }

    console.log(`💾 Cache miss for user: ${userId} - querying database`);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PrismaOptimizer.selects.user.profile, // Optimized select
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    if (user) {
      // Cache with improved TTL strategy - 30 minutes for user data
      await this.cache.cacheUser(userId, user);
    }

    return user;
  }

  async searchUsers({ query, _me }: { _me: string; query: string }) {
    // For search results, we could implement caching too, but it's less beneficial
    // since search queries are more dynamic
    const users = await this.prisma.user.findMany({
      where: {
        username: { startsWith: query },
        NOT: { id: _me }, // Exclude self in query rather than filtering after
      },
      take: 10,
      select: PrismaOptimizer.selects.user.profile, // Optimized select
      orderBy: { username: 'asc' }, // Deterministic ordering
    });

    return users;
  }
}

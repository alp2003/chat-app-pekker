import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe({ userId }: { userId: string }) {
    return await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, displayName: true, avatar: true },
    });
  }

  async searchUsers({ query, _me }: { _me: string; query: string }) {
    const users = await this.prisma.user.findMany({
      where: { username: { startsWith: query } },
      take: 10,
      select: { id: true, username: true, displayName: true, avatar: true },
    });

    return users.filter((u) => u.id !== _me);
  }
}

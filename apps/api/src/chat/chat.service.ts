import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MessageIn } from 'shared/dto';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- USERS ----------
  /**
   * Your User model requires name & password.
   * For OAuth/dev users, we set safe placeholders.
   * Real signup should create a proper password or null this column if you later allow it.
   */
  async ensureUser(userId: string, username?: string) {
    const fallback = username ?? `User-${userId.slice(0, 8)}`;
    await this.prisma.user.upsert({
      where: { id: userId },
      update: username ? { username } : {},
      create: { id: userId, username: fallback, passwordHash: '!' },
    });
  }

  async updateLastSeen(userId: string) {
    // Be tolerant: create if missing to avoid P2025
    await this.prisma.user.upsert({
      where: { id: userId },
      update: { updatedAt: new Date() }, // will refresh @updatedAt anyway
      create: {
        id: userId,
        username: `User-${userId.slice(0, 8)}`,
        passwordHash: '!',
      },
    });
  }

  // ---------- ROOMS / MEMBERS ----------
  async ensureRoom(roomId: string) {
    await this.prisma.room.upsert({
      where: { id: roomId },
      update: {},
      create: { id: roomId, isGroup: false },
    });
  }

  async createRoom({ name, isGroup }: { name?: string; isGroup?: boolean }) {
    try {
      return await this.prisma.room.create({
        data: { name, isGroup: !!isGroup },
      });
    } catch (err: any) {
      // Throw a real HTTP/WebSocket exception (not ExceptionsHandler)
      throw new InternalServerErrorException(
        err?.message || 'Failed to create room',
      );
    }
  }

  async isMember(userId: string, roomId: string) {
    const exists = await this.prisma.membership.findUnique({
      where: { userId_roomId: { userId, roomId } },
      select: { id: true },
    });
    return !!exists;
  }

  async addMember(userId: string, roomId: string, role: string = 'member') {
    // Satisfy FK first

    await this.ensureUser(userId);
    await this.prisma.membership.upsert({
      where: { userId_roomId: { userId, roomId } },
      update: {},
      create: { userId, roomId, role },
    });
  }

  async addMembers(roomId: string, userIds: string[]) {
    if (!userIds.length) return [];

    // FK-safe: create missing users, then memberships
    await this.prisma.$transaction(async (tx) => {
      await tx.user.createMany({
        data: userIds.map((id) => ({
          id,
          username: `User-${id.slice(0, 8)}`,
          passwordHash: '!',
        })),
        skipDuplicates: true,
      });
      await tx.membership.createMany({
        data: userIds.map((userId) => ({ userId, roomId, role: 'member' })),
        skipDuplicates: true,
      });
    });

    return await this.prisma.membership.findMany({ where: { roomId } });
  }

  async listConversations(userId: string) {
    const rooms = await this.prisma.room.findMany({
      where: { members: { some: { userId } } },
      select: {
        id: true,
        name: true,
        isGroup: true,
        members: {
          select: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, createdAt: true, senderId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rooms.map((r) => {
      const members = r.members.map((m) => ({
        id: m.user.id,
        username: m.user.username,
        displayName: m.user.displayName,
        avatar: m.user.avatar,
        online: false, // fill from presence if you track it
      }));

      // For DM, label as the "other" member; for group keep r.name
      const other = !r.isGroup
        ? members.find((m) => m.id !== userId)
        : undefined;

      return {
        id: r.id,
        name: r.isGroup
          ? (r.name ?? 'Group')
          : (other?.displayName ?? other?.username ?? 'Chat'),
        avatar: r.isGroup ? null : (other?.avatar ?? null),
        last: r.messages[0]?.content ?? null,
        unread: 0,
        online: !r.isGroup ? (other?.online ?? false) : false,
        members, // 👈 include members
      } as const;
    });
  }
  // ---------- MESSAGES ----------
  async getMessages(
    userId: string,
    roomId: string,
    opts: { cursor?: string; limit?: number },
  ) {
    // optional: verify membership
    const member = await this.prisma.membership.findUnique({
      where: { userId_roomId: { userId, roomId } },
      select: { id: true },
    });
    if (!member) return [];

    const take = Math.min(Math.max(opts.limit ?? 40, 1), 100);
    const msgs = await this.prisma.message.findMany({
      where: { roomId },
      orderBy: { createdAt: 'asc' },
      take,
      select: {
        id: true,
        roomId: true,
        senderId: true,
        content: true,
        createdAt: true,
        replyToId: true,
      },
    });

    return msgs.map((m) => ({
      id: m.id,
      roomId: m.roomId,
      userId: m.senderId, // frontend expects userId
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      replyToId: m.replyToId,
    }));
  }

  async saveMessage(input: {
    roomId: string;
    senderId: string;
    content?: string;
    clientMsgId?: string | null;
    replyToId?: string | null;
  }) {
    await this.ensureUser(input.senderId);

    const data = {
      roomId: input.roomId,
      senderId: input.senderId,
      content: input.content ?? '', // content is required by schema
      clientMsgId: input.clientMsgId ?? null,
      replyToId: input.replyToId ?? null,
    };

    if (input.clientMsgId) {
      return await this.prisma.message.upsert({
        where: {
          roomId_clientMsgId: {
            roomId: input.roomId,
            clientMsgId: input.clientMsgId!,
          },
        },
        update: {},
        create: data,
      });
    }
    return await this.prisma.message.create({ data });
  }

  async getOrCreateDmByUsername(meId: string, otherUsername: string) {
    const other = await this.prisma.user.findUnique({
      where: { username: otherUsername.toLowerCase().trim() },
      select: { id: true },
    });
    if (!other) throw new NotFoundException('user_not_found');
    if (other.id === meId) throw new BadRequestException('self_dm_not_allowed');

    // try to find existing 2-member non-group room
    const existing = await this.prisma.room.findFirst({
      where: {
        isGroup: false,
        members: { some: { userId: meId } },
        AND: { members: { some: { userId: other.id } } },
      },
      select: { id: true },
    });
    if (existing) return existing;

    // create new room with 2 memberships
    const room = await this.prisma.room.create({ data: { isGroup: false } });
    await this.prisma.membership.createMany({
      data: [
        { roomId: room.id, userId: meId, role: 'member' },
        { roomId: room.id, userId: other.id, role: 'member' },
      ],
      skipDuplicates: true,
    });
    return { id: room.id };
  }

  // apps/api/src/chat/chat.service.ts (ensure this exists)
  async createGroup(ownerId: string, name: string, memberIds: string[]) {
    const room = await this.prisma.room.create({
      data: { isGroup: true, name },
    });
    await this.prisma.membership.createMany({
      data: memberIds.map((u) => ({
        roomId: room.id,
        userId: u,
        role: 'member',
      })),
      skipDuplicates: true,
    });
    return room;
  }

  async getRecentMessages(roomId: string, opts?: { cursor?: string }) {
    // you can extend to do cursor-based pagination later
    return this.prisma.message.findMany({
      where: { roomId },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }
}

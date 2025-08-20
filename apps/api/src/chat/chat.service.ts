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
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: {
        room: {
          include: {
            members: {
              include: { user: { select: { id: true, username: true } } },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { content: true, createdAt: true, senderId: true },
            },
          },
        },
      },
    });

    const conversations = memberships.map((m) => {
      const room = m.room;
      let name = room.name || 'Unnamed Room';
      let avatar: string | null = null;

      // for DMs, use the other user's name
      if (!room.isGroup && room.members.length === 2) {
        const otherMember = room.members.find((mem) => mem.userId !== userId);
        if (otherMember) {
          name = otherMember.user.username;
          // avatar = otherMember.user.avatar; // if you have avatars
        }
      }

      const lastMsg = room.messages[0];

      return {
        id: room.id,
        name,
        avatar,
        last: lastMsg?.content || null,
        members: room.members.map((mem) => ({
          id: mem.user.id,
          username: mem.user.username,
        })),
      };
    });

    return conversations;
  }
  // ---------- MESSAGES ----------
  async getMessages(userId: string, roomId: string, opts?: { limit?: number }) {
    const take = Math.min(Math.max(opts?.limit ?? 3000, 1), 5000);

    // Get the most recent messages first (desc), then reverse to show oldest first
    const messages = await this.prisma.message.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        sender: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    // Reverse to get chronological order (oldest first)
    // Transform the data to match frontend expectations
    return messages.reverse().map((msg) => ({
      id: msg.id,
      roomId: msg.roomId,
      userId: msg.senderId, // ← Map senderId to userId for frontend
      content: msg.content,
      createdAt: msg.createdAt.toISOString(),
      clientMsgId: msg.clientMsgId,
      replyToId: msg.replyToId,
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

    let saved;
    if (input.clientMsgId) {
      saved = await this.prisma.message.upsert({
        where: {
          roomId_clientMsgId: {
            roomId: input.roomId,
            clientMsgId: input.clientMsgId!,
          },
        },
        update: {},
        create: data,
      });
    } else {
      saved = await this.prisma.message.create({ data });
    }

    // Transform to match frontend expectations
    return {
      id: saved.id,
      roomId: saved.roomId,
      userId: saved.senderId, // ← Map senderId to userId for frontend
      content: saved.content,
      createdAt: saved.createdAt.toISOString(),
      clientMsgId: saved.clientMsgId,
      replyToId: saved.replyToId,
    };
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
      take: 3000,
    });
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CacheService } from '../common/cache.service';
import { PrismaOptimizer } from '../common/prisma/prisma-optimizer';
import type {
  Conversation,
  ChatMessage,
  MessageReaction,
  ConversationMember,
} from './chat.types';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ---------- USER VALIDATION ----------
  /**
   * Validates that a user exists in the database
   * @throws Error if user doesn't exist
   */
  async validateUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new BadRequestException(
        `User ${userId} not found. User must be registered through AuthService first.`,
      );
    }
  }

  /**
   * Validates that multiple users exist in the database
   * @throws Error if any user doesn't exist
   */
  async validateUsersExist(userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;

    const existingUsers = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true },
    });

    const existingIds = new Set(existingUsers.map((u) => u.id));
    const missingUsers = userIds.filter((id) => !existingIds.has(id));

    if (missingUsers.length > 0) {
      throw new BadRequestException(
        `Users not found: ${missingUsers.join(', ')}. All users must be registered through AuthService first.`,
      );
    }
  }

  /**
   * Updates user's last seen timestamp.
   * Only works for existing users - no fallback creation.
   */
  async updateLastSeen(userId: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { updatedAt: new Date() },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        // Record not found
        throw new BadRequestException(
          `Cannot update last seen for user ${userId}: User not found. User must be registered first.`,
        );
      }
      throw error;
    }
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
    } catch (err: unknown) {
      // Throw a real HTTP/WebSocket exception (not ExceptionsHandler)
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to create room';
      throw new InternalServerErrorException(errorMessage);
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
    // Validate user exists - no automatic creation
    await this.validateUserExists(userId);

    await this.prisma.membership.upsert({
      where: { userId_roomId: { userId, roomId } },
      update: {},
      create: { userId, roomId, role },
    });
  }

  async addMembers(roomId: string, userIds: string[]) {
    if (!userIds.length) return [];

    // Validate all users exist first - no automatic creation
    await this.validateUsersExist(userIds);

    // Create memberships for existing users
    await this.prisma.membership.createMany({
      data: userIds.map((userId) => ({ userId, roomId, role: 'member' })),
      skipDuplicates: true,
    });

    return await this.prisma.membership.findMany({
      where: { roomId },
      select: PrismaOptimizer.selects.membership.withUser, // Optimized select
      orderBy: { role: 'asc' }, // Owners first, then members
    });
  }

  async listConversations(userId: string): Promise<Conversation[]> {
    // Try cache first
    const cached = await this.cache.getCachedConversations(userId);
    if (cached) {
      console.log(`📖 Cache hit for conversations: ${userId}`);
      return cached as Conversation[];
    }

    console.log(
      `💾 Cache miss for conversations: ${userId} - querying database`,
    );

    // Optimized query with narrow selects and minimal includes
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      select: {
        id: true,
        role: true,
        room: {
          select: {
            id: true,
            name: true,
            isGroup: true,
            members: {
              select: {
                user: {
                  select: PrismaOptimizer.selects.user.minimal, // Optimized
                },
              },
              take: 50, // Limit to prevent N+1 issues with large groups
            },
            messages: {
              select: PrismaOptimizer.selects.message.minimal, // Optimized
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { room: { messages: { _count: 'desc' } } }, // Order by activity
    });

    const conversations = memberships.map((m) => {
      const room = m.room;
      let name = room.name || 'Unnamed Room';
      const avatar: string | null = null;

      // for DMs, use the other user's name
      if (!room.isGroup && room.members.length === 2) {
        const otherMember = room.members.find((mem) => mem.user.id !== userId);
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
        isGroup: room.isGroup,
        last: lastMsg?.content || null,
        members: room.members.map((mem) => ({
          id: mem.user.id,
          username: mem.user.username,
        })),
      };
    });

    // Cache for 5 minutes
    await this.cache.cacheConversations(userId, conversations, 300);

    return conversations;
  }
  // ---------- MESSAGES ----------
  async getMessages(
    userId: string,
    roomId: string,
    opts?: { limit?: number },
  ): Promise<ChatMessage[]> {
    const take = Math.min(Math.max(opts?.limit ?? 3000, 1), 5000);
    const page = 0; // For now we only support page 0, but this could be extended for pagination

    // Try cache first (for smaller result sets)
    if (take <= 5000) {
      // Only cache reasonably sized result sets
      const cached = await this.cache.getCachedMessages(roomId, page);
      if (cached) {
        console.log(`📖 Cache hit for messages: ${roomId} (limit: ${take})`);
        return (cached as ChatMessage[]).slice(0, take); // Return only requested amount
      }
    }

    console.log(
      `💾 Cache miss for messages: ${roomId} (limit: ${take}) - querying database`,
    );

    // Get the most recent messages first (desc), then reverse to show oldest first
    // Use optimized select with sender info
    const messages = await this.prisma.message.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take,
      select: PrismaOptimizer.selects.message.withSender, // Optimized select
    });

    // Reverse to get chronological order (oldest first)
    // Transform the data to match frontend expectations
    const transformedMessages = await Promise.all(
      messages.reverse().map(async (msg) => {
        // Get reactions for this message separately
        const reactions = await this.getMessageReactions(msg.id);

        return {
          id: msg.id,
          roomId: msg.roomId,
          userId: msg.senderId, // ← Map senderId to userId for frontend
          content: msg.content,
          createdAt: msg.createdAt.toISOString(),
          clientMsgId: msg.clientMsgId,
          replyToId: msg.replyToId,
          reactions,
        };
      }),
    );

    // Cache for smaller result sets (3 minutes)
    if (take <= 5000) {
      await this.cache.cacheMessages(roomId, transformedMessages, page, 180);
    }

    return transformedMessages;
  }

  async saveMessage(input: {
    roomId: string;
    senderId: string;
    content?: string;
    clientMsgId?: string | null;
    replyToId?: string | null;
  }) {
    // Validate sender exists - no automatic user creation
    await this.validateUserExists(input.senderId);

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
            clientMsgId: input.clientMsgId,
          },
        },
        update: {},
        create: data,
      });
    } else {
      saved = await this.prisma.message.create({ data });
    }

    // Transform to match frontend expectations
    const transformedMessage = {
      id: saved.id,
      roomId: saved.roomId,
      userId: saved.senderId, // ← Map senderId to userId for frontend
      content: saved.content,
      createdAt: saved.createdAt.toISOString(),
      clientMsgId: saved.clientMsgId,
      replyToId: saved.replyToId,
    };

    // Invalidate caches since we have new message
    await Promise.all([
      // Invalidate messages cache for this room
      this.cache.invalidateMessages(saved.roomId),
      // Invalidate conversations cache for all members (since last message changed)
      this.invalidateConversationsForRoom(saved.roomId),
    ]);

    return transformedMessage;
  }

  async getOrCreateDmByUsername(meId: string, otherUsername: string) {
    const other = await this.prisma.user.findUnique({
      where: { username: otherUsername.toLowerCase().trim() },
      select: { id: true },
    });
    if (!other) throw new NotFoundException('user_not_found');
    if (other.id === meId) throw new BadRequestException('self_dm_not_allowed');

    // try to find existing 2-member non-group room with optimized query
    const existing = await this.prisma.room.findFirst({
      where: {
        isGroup: false,
        members: {
          every: { userId: { in: [meId, other.id] } },
          some: { userId: meId },
        },
      },
      select: { id: true },
    });
    if (existing)
      return { id: existing.id, otherUserId: other.id, isNew: false };

    // Create room and memberships in a transaction
    const result = await PrismaOptimizer.executeTransaction(
      this.prisma,
      async (tx) => {
        const room = await tx.room.create({
          data: { isGroup: false },
          select: { id: true },
        });

        await tx.membership.createMany({
          data: [
            { roomId: room.id, userId: meId, role: 'member' },
            { roomId: room.id, userId: other.id, role: 'member' },
          ],
          skipDuplicates: true,
        });

        return { id: room.id };
      },
    );

    return { id: result.id, otherUserId: other.id, isNew: true };
  }

  // apps/api/src/chat/chat.service.ts (ensure this exists)
  async createGroup(ownerId: string, name: string, memberIds: string[]) {
    // Create group and memberships in a transaction with timeout
    return PrismaOptimizer.executeTransaction(
      this.prisma,
      async (tx) => {
        const room = await tx.room.create({
          data: { isGroup: true, name },
          select: PrismaOptimizer.selects.room.minimal, // Optimized select
        });

        // Add owner and members
        const allMemberIds = Array.from(new Set([ownerId, ...memberIds])); // Deduplicate
        await tx.membership.createMany({
          data: allMemberIds.map((userId, index) => ({
            roomId: room.id,
            userId,
            role: index === 0 ? 'owner' : 'member', // First is owner
          })),
          skipDuplicates: true,
        });

        return room;
      },
      15000, // Longer timeout for group creation
    );
  }

  async getRecentMessages(
    roomId: string,
    paginationOptions?: { cursor?: string; take?: number },
  ) {
    const { cursor, take = 50 } = paginationOptions || {};

    // Use keyset pagination for efficient large dataset handling
    return PrismaOptimizer.keysetPaginate(
      (args) =>
        this.prisma.message.findMany({
          where: {
            roomId,
            ...(args.where || {}), // Include cursor condition
          },
          select: PrismaOptimizer.selects.message.withSender,
          orderBy: args.orderBy,
          take: args.take,
          cursor: args.cursor,
        }),
      { cursor, take },
    );
  }

  // Helper method to invalidate conversations cache for all members of a room
  private async invalidateConversationsForRoom(roomId: string) {
    try {
      // Get all members of the room
      const members = await this.prisma.membership.findMany({
        where: { roomId },
        select: { userId: true },
      });

      // Invalidate conversations cache for each member
      const invalidationPromises = members.map((member) =>
        this.cache.invalidateConversations(member.userId),
      );

      await Promise.all(invalidationPromises);
      console.log(
        `🗑️ Invalidated conversations cache for ${members.length} room members`,
      );
    } catch (error) {
      console.error('Error invalidating conversations cache:', error);
    }
  }

  // ---------- REACTIONS ----------
  async reactToMessage(input: {
    messageId: string;
    userId: string;
    emoji: string;
  }) {
    const { messageId, userId, emoji } = input;

    // Check if message exists and get room info for authorization
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, roomId: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Check if user is a member of the room (optimized query)
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_roomId: {
          userId,
          roomId: message.roomId,
        },
      },
      select: { id: true }, // Minimal select for authorization check
    });

    if (!membership) {
      throw new ForbiddenException('User is not a member of this room');
    }

    // Handle reaction in a transaction to avoid race conditions
    const result = await PrismaOptimizer.executeTransaction(
      this.prisma,
      async (tx) => {
        // Check if user already has this exact reaction
        const existingReaction = await tx.reaction.findUnique({
          where: { messageId_userId: { messageId, userId } },
          select: { id: true, emoji: true },
        });

        if (existingReaction?.emoji === emoji) {
          // Same emoji - remove reaction (toggle off)
          await tx.reaction.delete({
            where: { messageId_userId: { messageId, userId } },
          });
          return { action: 'removed' };
        } else {
          // Different emoji or no existing reaction - upsert
          await tx.reaction.upsert({
            where: { messageId_userId: { messageId, userId } },
            create: {
              messageId,
              userId,
              emoji,
            },
            update: {
              emoji,
            },
          });
          return { action: 'added' };
        }
      },
    );

    // Get updated reactions and invalidate cache
    const allReactions = await this.getMessageReactions(messageId);
    await this.cache.invalidateMessages(message.roomId);

    return {
      messageId,
      action: result.action,
      reactions: allReactions,
    };
  }

  async getMessageReactions(messageId: string) {
    const reactions = await this.prisma.reaction.findMany({
      where: { messageId },
      select: {
        id: true,
        emoji: true,
        user: {
          select: PrismaOptimizer.selects.user.minimal, // Optimized select
        },
      },
      orderBy: [
        { emoji: 'asc' }, // Group by emoji
        { createdAt: 'asc' }, // Then by creation time
      ],
    });

    // Group reactions by emoji
    const groupedReactions: Record<
      string,
      {
        emoji: string;
        by: string[];
        count: number;
      }
    > = {};

    for (const reaction of reactions) {
      if (!groupedReactions[reaction.emoji]) {
        groupedReactions[reaction.emoji] = {
          emoji: reaction.emoji,
          by: [],
          count: 0,
        };
      }
      groupedReactions[reaction.emoji]!.by.push(reaction.user.id);
      groupedReactions[reaction.emoji]!.count++;
    }

    return Object.values(groupedReactions);
  }

  /**
   * Invalidate conversations cache for a specific user
   */
  async invalidateConversationsCache(userId: string): Promise<void> {
    await this.cache.invalidateConversations(userId);
  }

  /**
   * Immediately invalidate conversations cache for critical operations like new conversation creation
   */
  async invalidateConversationsCacheImmediate(userId: string): Promise<void> {
    await this.cache.invalidateConversationsImmediate(userId);
  }
}

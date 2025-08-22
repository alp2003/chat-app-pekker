import { PrismaClient } from '@prisma/client';

// Transaction timeout configuration
export const TRANSACTION_TIMEOUT = 10000; // 10 seconds
export const INTERACTIVE_TRANSACTION_TIMEOUT = 30000; // 30 seconds for complex operations

// Keyset pagination helper for efficient cursor-based pagination
export interface KeysetPaginationOptions {
  cursor?: string;
  take?: number;
  direction?: 'forward' | 'backward';
}

export interface KeysetPaginationResult<T> {
  data: T[];
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextCursor?: string;
  prevCursor?: string;
}

export class PrismaOptimizer {
  /**
   * Efficient cursor-based pagination using keyset pagination
   * More efficient than offset-based pagination for large datasets
   */
  static async keysetPaginate<T extends { id: string; createdAt: Date }>(
    query: (args: any) => Promise<T[]>,
    options: KeysetPaginationOptions = {},
  ): Promise<KeysetPaginationResult<T>> {
    const { cursor, take = 20, direction = 'forward' } = options;
    const limit = Math.min(take + 1, 100); // +1 to check if there's a next page, max 100

    const orderBy = direction === 'forward' ? 'asc' : 'desc';
    const cursorCondition = cursor
      ? direction === 'forward'
        ? { gt: cursor }
        : { lt: cursor }
      : undefined;

    const results = await query({
      take: limit,
      cursor: cursor ? { id: cursor } : undefined,
      where: cursor ? { id: cursorCondition } : undefined,
      orderBy: [
        { createdAt: orderBy },
        { id: orderBy }, // Secondary sort for deterministic results
      ],
    });

    const hasNextPage = results.length > take;
    const data = hasNextPage ? results.slice(0, -1) : results;
    
    const nextCursor = hasNextPage && data.length > 0 ? data[data.length - 1]?.id : undefined;
    const prevCursor = data.length > 0 ? data[0]?.id : undefined;

    return {
      data,
      hasNextPage,
      hasPrevPage: !!cursor,
      nextCursor,
      prevCursor,
    };
  }

  /**
   * Execute multiple operations in a transaction with timeout
   */
  static async executeTransaction<T>(
    prisma: PrismaClient,
    operations: (tx: any) => Promise<T>,
    timeout: number = TRANSACTION_TIMEOUT,
  ): Promise<T> {
    return prisma.$transaction(operations, {
      timeout,
      isolationLevel: 'ReadCommitted', // Good balance of consistency and performance
    });
  }

  /**
   * Optimized select fields for common queries
   */
  static readonly selects = {
    user: {
      minimal: { id: true, username: true },
      profile: { id: true, username: true, displayName: true, avatar: true },
      auth: { id: true, username: true, displayName: true, passwordHash: true },
    },
    message: {
      minimal: { id: true, content: true, createdAt: true, senderId: true },
      withSender: {
        id: true,
        roomId: true, // Add roomId
        content: true,
        createdAt: true,
        clientMsgId: true,
        replyToId: true,
        senderId: true,
        sender: { select: { id: true, username: true } },
      },
    },
    room: {
      minimal: { id: true, name: true, isGroup: true },
      withLastMessage: {
        id: true,
        name: true,
        isGroup: true,
        messages: {
          select: { content: true, createdAt: true, senderId: true },
          orderBy: { createdAt: 'desc' as const },
          take: 1,
        },
      },
    },
    membership: {
      minimal: { id: true, userId: true, roomId: true, role: true },
      withUser: {
        id: true,
        userId: true,
        roomId: true,
        role: true,
        user: { select: { id: true, username: true } },
      },
    },
  } as const;
}

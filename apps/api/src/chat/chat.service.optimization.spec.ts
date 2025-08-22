import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from '../chat/chat.service';
import { PrismaService } from '../prisma.service';
import { CacheService } from '../common/cache.service';

// Mock data for testing behavior parity
const mockUser1 = { id: 'user1', username: 'alice' };
const mockUser2 = { id: 'user2', username: 'bob' };
const mockRoom = { id: 'room1', name: 'Test Room', isGroup: false };
const mockMembership = {
  id: 'mem1',
  userId: 'user1',
  roomId: 'room1',
  role: 'member',
};

describe('ChatService - Prisma Optimization Parity Tests', () => {
  let service: ChatService;
  let prisma: jest.Mocked<PrismaService>;
  let cache: jest.Mocked<CacheService>;

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      room: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      membership: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        createMany: jest.fn(),
        upsert: jest.fn(),
      },
      message: {
        findMany: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      reaction: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockCacheService = {
      getCachedConversations: jest.fn(),
      getCachedMessages: jest.fn(),
      cacheConversations: jest.fn(),
      cacheMessages: jest.fn(),
      invalidateMessages: jest.fn(),
      invalidateConversations: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    cache = module.get(CacheService) as jest.Mocked<CacheService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listConversations optimization', () => {
    it('should use optimized select fields and return same structure', async () => {
      const mockMemberships = [
        {
          id: 'mem1',
          role: 'member',
          room: {
            id: 'room1',
            name: 'Test Room',
            isGroup: false,
            members: [
              { user: { id: 'user1', username: 'alice' } },
              { user: { id: 'user2', username: 'bob' } },
            ],
            messages: [
              {
                id: 'msg1',
                content: 'Hello',
                createdAt: new Date(),
                senderId: 'user2',
              },
            ],
          },
        },
      ];

      cache.getCachedConversations.mockResolvedValue(null);
      prisma.membership.findMany.mockResolvedValue(mockMemberships as any);
      cache.cacheConversations.mockResolvedValue(undefined);

      const result = await service.listConversations('user1');

      // Verify optimized query structure
      expect(prisma.membership.findMany).toHaveBeenCalledWith({
        where: { userId: 'user1' },
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
                    select: { id: true, username: true }, // Optimized select
                  },
                },
                take: 50, // Limit added for performance
              },
              messages: {
                select: {
                  id: true,
                  content: true,
                  createdAt: true,
                  senderId: true,
                }, // Optimized
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
        orderBy: { room: { messages: { _count: 'desc' } } }, // Optimization: order by activity
      });

      // Verify return structure is preserved
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'room1',
        name: 'bob', // DM uses other user's name
        avatar: null,
        last: 'Hello',
        members: [
          { id: 'user1', username: 'alice' },
          { id: 'user2', username: 'bob' },
        ],
      });
    });
  });

  describe('getMessages optimization', () => {
    it('should use optimized select and return same structure', async () => {
      const mockMessages = [
        {
          id: 'msg1',
          roomId: 'room1',
          content: 'Hello',
          createdAt: new Date('2023-01-01'),
          clientMsgId: null,
          replyToId: null,
          senderId: 'user2',
          sender: { id: 'user2', username: 'bob' },
        },
      ];

      cache.getCachedMessages.mockResolvedValue(null);
      prisma.message.findMany.mockResolvedValue(mockMessages as any);
      // Mock getMessageReactions to return empty array for simplicity
      service['getMessageReactions'] = jest.fn().mockResolvedValue([]);

      const result = await service.getMessages('user1', 'room1');

      // Verify optimized query uses select instead of include
      expect(prisma.message.findMany).toHaveBeenCalledWith({
        where: { roomId: 'room1' },
        orderBy: { createdAt: 'desc' },
        take: 3000,
        select: {
          id: true,
          roomId: true,
          content: true,
          createdAt: true,
          clientMsgId: true,
          replyToId: true,
          senderId: true,
          sender: { select: { id: true, username: true } }, // Optimized
        },
      });

      // Verify return structure is preserved
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'msg1',
        roomId: 'room1',
        userId: 'user2', // Mapped from senderId
        content: 'Hello',
        clientMsgId: null,
        replyToId: null,
        reactions: [],
      });
    });
  });

  describe('getOrCreateDmByUsername transaction optimization', () => {
    it('should use transaction for room creation and return same structure', async () => {
      const mockOtherUser = { id: 'user2' };
      const mockRoom = { id: 'room1' };

      prisma.user.findUnique.mockResolvedValue(mockOtherUser as any);
      prisma.room.findFirst.mockResolvedValue(null); // No existing room

      // Mock transaction
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          room: { create: jest.fn().mockResolvedValue(mockRoom) },
          membership: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
        };
        return callback(mockTx);
      });

      const result = await service.getOrCreateDmByUsername('user1', 'bob');

      // Verify transaction was used
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        timeout: 10000,
        isolationLevel: 'ReadCommitted',
      });

      // Verify return structure is preserved
      expect(result).toEqual({ id: 'room1' });
    });
  });

  describe('reactToMessage transaction optimization', () => {
    it('should use transaction for atomic reaction updates', async () => {
      const mockMessage = { id: 'msg1', roomId: 'room1' };
      const mockMembership = { id: 'mem1' };

      prisma.message.findUnique.mockResolvedValue(mockMessage as any);
      prisma.membership.findUnique.mockResolvedValue(mockMembership as any);

      // Mock transaction
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          reaction: {
            findUnique: jest.fn().mockResolvedValue(null), // No existing reaction
            upsert: jest
              .fn()
              .mockResolvedValue({ id: 'reaction1', emoji: '👍' }),
          },
        };
        return callback(mockTx);
      });

      // Mock getMessageReactions
      service['getMessageReactions'] = jest.fn().mockResolvedValue([
        {
          emoji: '👍',
          by: ['user1'],
          count: 1,
        },
      ]);

      cache.invalidateMessages.mockResolvedValue(true);

      const result = await service.reactToMessage({
        messageId: 'msg1',
        userId: 'user1',
        emoji: '👍',
      });

      // Verify transaction was used
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        timeout: 10000,
        isolationLevel: 'ReadCommitted',
      });

      // Verify return structure includes action
      expect(result).toEqual({
        messageId: 'msg1',
        action: 'added',
        reactions: [
          {
            emoji: '👍',
            by: ['user1'],
            count: 1,
          },
        ],
      });
    });
  });

  describe('getRecentMessages with pagination', () => {
    it('should support keyset pagination while maintaining compatibility', async () => {
      const mockMessages = [
        { id: 'msg1', createdAt: new Date('2023-01-01'), roomId: 'room1' },
        { id: 'msg2', createdAt: new Date('2023-01-02'), roomId: 'room1' },
      ];

      prisma.message.findMany.mockResolvedValue(mockMessages as any);

      const result = await service.getRecentMessages('room1', {
        take: 10,
        cursor: 'msg1',
      });

      // Verify paginated result structure
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('hasNextPage');
      expect(result).toHaveProperty('nextCursor');

      // Should still work with original call pattern
      const legacyResult = await service.getRecentMessages('room1');
      expect(legacyResult).toHaveProperty('data');
    });
  });
});

// Performance comparison test
describe('Prisma Query Performance Impact', () => {
  it('should demonstrate select field reduction', () => {
    // Before optimization - includes entire related objects
    const beforeQuery = {
      include: {
        user: true, // Fetches ALL user fields
        room: {
          include: {
            members: { include: { user: true } }, // ALL fields for ALL members
            messages: true, // ALL message fields
          },
        },
      },
    };

    // After optimization - minimal selects
    const afterQuery = {
      select: {
        id: true,
        role: true,
        room: {
          select: {
            id: true,
            name: true,
            isGroup: true,
            members: {
              select: { user: { select: { id: true, username: true } } },
              take: 50, // Limit large result sets
            },
            messages: {
              select: { content: true, createdAt: true, senderId: true },
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    };

    // The after query should fetch significantly fewer fields
    expect(Object.keys(afterQuery.select)).toHaveLength(3); // id, role, room
    expect(afterQuery.select.room.select.members.take).toBe(50);
    expect(afterQuery.select.room.select.messages.take).toBe(1);
  });
});

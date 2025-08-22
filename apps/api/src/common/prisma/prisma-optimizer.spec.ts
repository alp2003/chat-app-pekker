import { PrismaOptimizer } from './prisma-optimizer';

describe('PrismaOptimizer', () => {
  describe('keysetPaginate', () => {
    it('should handle forward pagination correctly', async () => {
      const mockData = [
        { id: '1', createdAt: new Date('2023-01-01'), content: 'msg1' },
        { id: '2', createdAt: new Date('2023-01-02'), content: 'msg2' },
        { id: '3', createdAt: new Date('2023-01-03'), content: 'msg3' },
      ];

      const mockQuery = jest.fn().mockResolvedValue(mockData);

      const result = await PrismaOptimizer.keysetPaginate(mockQuery, {
        take: 2,
        direction: 'forward',
      });

      expect(result.data).toHaveLength(2);
      expect(result.hasNextPage).toBe(true);
      expect(result.nextCursor).toBe('2');
      expect(mockQuery).toHaveBeenCalledWith({
        take: 3, // take + 1
        cursor: undefined,
        where: undefined,
        orderBy: [
          { createdAt: 'asc' },
          { id: 'asc' },
        ],
      });
    });

    it('should handle cursor-based pagination', async () => {
      const mockData = [
        { id: '3', createdAt: new Date('2023-01-03'), content: 'msg3' },
        { id: '4', createdAt: new Date('2023-01-04'), content: 'msg4' },
      ];

      const mockQuery = jest.fn().mockResolvedValue(mockData);

      const result = await PrismaOptimizer.keysetPaginate(mockQuery, {
        cursor: '2',
        take: 2,
        direction: 'forward',
      });

      expect(result.data).toHaveLength(2);
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPrevPage).toBe(true);
      expect(result.prevCursor).toBe('3');
      expect(mockQuery).toHaveBeenCalledWith({
        take: 3,
        cursor: { id: '2' },
        where: { id: { gt: '2' } },
        orderBy: [
          { createdAt: 'asc' },
          { id: 'asc' },
        ],
      });
    });

    it('should handle backward pagination', async () => {
      const mockData = [
        { id: '1', createdAt: new Date('2023-01-01'), content: 'msg1' },
      ];

      const mockQuery = jest.fn().mockResolvedValue(mockData);

      const result = await PrismaOptimizer.keysetPaginate(mockQuery, {
        cursor: '3',
        take: 2,
        direction: 'backward',
      });

      expect(result.data).toHaveLength(1);
      expect(result.hasNextPage).toBe(false);
      expect(mockQuery).toHaveBeenCalledWith({
        take: 3,
        cursor: { id: '3' },
        where: { id: { lt: '3' } },
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
      });
    });
  });

  describe('executeTransaction', () => {
    it('should execute transaction with default timeout', async () => {
      const mockPrisma = {
        $transaction: jest.fn().mockResolvedValue('result'),
      } as any;

      const mockOperations = jest.fn().mockResolvedValue('result');

      const result = await PrismaOptimizer.executeTransaction(
        mockPrisma,
        mockOperations,
      );

      expect(result).toBe('result');
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(mockOperations, {
        timeout: 10000,
        isolationLevel: 'ReadCommitted',
      });
    });

    it('should execute transaction with custom timeout', async () => {
      const mockPrisma = {
        $transaction: jest.fn().mockResolvedValue('result'),
      } as any;

      const mockOperations = jest.fn().mockResolvedValue('success');

      await PrismaOptimizer.executeTransaction(
        mockPrisma,
        mockOperations,
        15000
      );

      expect(mockPrisma.$transaction).toHaveBeenCalledWith(mockOperations, {
        timeout: 15000,
        isolationLevel: 'ReadCommitted',
      });
    });
  });

  describe('selects', () => {
    it('should provide optimized select objects', () => {
      expect(PrismaOptimizer.selects.user.minimal).toEqual({
        id: true,
        username: true,
      });

      expect(PrismaOptimizer.selects.user.profile).toEqual({
        id: true,
        username: true,
        displayName: true,
        avatar: true,
      });

      expect(PrismaOptimizer.selects.message.withSender).toHaveProperty('sender');
      expect(PrismaOptimizer.selects.message.withSender.sender).toEqual({
        select: { id: true, username: true },
      });
    });
  });
});

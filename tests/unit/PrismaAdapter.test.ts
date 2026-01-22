/**
 * PrismaAdapter 单元测试
 * 
 * 测试 PrismaAdapter 的所有方法，包括：
 * - 类型映射
 * - 事务上下文处理
 * - 错误转换
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaAdapter } from '../../src/adapters/PrismaAdapter';
import { UserNotFoundError } from '../../src/core/errors';

// Mock PrismaClient
const mockPrismaClient = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn()
  },
  transaction: {
    create: vi.fn(),
    findMany: vi.fn()
  },
  auditLog: {
    create: vi.fn()
  },
  idempotencyRecord: {
    findUnique: vi.fn(),
    create: vi.fn()
  }
};

describe('PrismaAdapter', () => {
  let adapter: PrismaAdapter;

  beforeEach(() => {
    // 重置所有 mock
    vi.clearAllMocks();
    
    // 创建适配器实例
    adapter = new PrismaAdapter(mockPrismaClient as any);
  });

  describe('getUserById', () => {
    it('应该返回用户对象', async () => {
      const mockUser = {
        id: 'user-123',
        credits: 100,
        membershipTier: 'premium',
        membershipExpiresAt: new Date('2025-12-31'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15')
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

      const result = await adapter.getUserById('user-123');

      expect(result).toEqual(mockUser);
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' }
      });
    });

    it('应该在用户不存在时返回 null', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const result = await adapter.getUserById('nonexistent');

      expect(result).toBeNull();
    });

    it('应该使用事务上下文', async () => {
      const mockTxn = { user: { findUnique: vi.fn().mockResolvedValue(null) } };

      await adapter.getUserById('user-123', mockTxn);

      expect(mockTxn.user.findUnique).toHaveBeenCalled();
      expect(mockPrismaClient.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('updateUserCredits', () => {
    it('应该更新用户积分并返回更新后的用户', async () => {
      const mockUser = {
        id: 'user-123',
        credits: 90,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15')
      };

      mockPrismaClient.user.update.mockResolvedValue(mockUser);

      const result = await adapter.updateUserCredits('user-123', -10);

      expect(result).toEqual(mockUser);
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          credits: { increment: -10 }
        }
      });
    });

    it('应该在用户不存在时抛出 UserNotFoundError', async () => {
      const prismaError = {
        code: 'P2025',
        message: 'Record not found'
      };

      mockPrismaClient.user.update.mockRejectedValue(prismaError);

      await expect(
        adapter.updateUserCredits('nonexistent', -10)
      ).rejects.toThrow(UserNotFoundError);
    });

    it('应该使用事务上下文', async () => {
      const mockTxn = {
        user: {
          update: vi.fn().mockResolvedValue({
            id: 'user-123',
            credits: 90,
            membershipTier: null,
            membershipExpiresAt: null,
            createdAt: new Date(),
            updatedAt: new Date()
          })
        }
      };

      await adapter.updateUserCredits('user-123', -10, mockTxn);

      expect(mockTxn.user.update).toHaveBeenCalled();
      expect(mockPrismaClient.user.update).not.toHaveBeenCalled();
    });
  });

  describe('createTransaction', () => {
    it('应该创建交易记录', async () => {
      const transactionInput = {
        userId: 'user-123',
        action: 'generate-post',
        amount: -10,
        balanceBefore: 100,
        balanceAfter: 90,
        metadata: { postId: 'post-456' }
      };

      const mockCreated = {
        id: 'txn-789',
        ...transactionInput,
        createdAt: new Date('2024-01-15')
      };

      mockPrismaClient.transaction.create.mockResolvedValue(mockCreated);

      const result = await adapter.createTransaction(transactionInput);

      expect(result).toEqual(mockCreated);
      expect(mockPrismaClient.transaction.create).toHaveBeenCalledWith({
        data: transactionInput
      });
    });

    it('应该处理没有 metadata 的情况', async () => {
      const transactionInput = {
        userId: 'user-123',
        action: 'generate-post',
        amount: -10,
        balanceBefore: 100,
        balanceAfter: 90
      };

      const mockCreated = {
        id: 'txn-789',
        ...transactionInput,
        metadata: {},
        createdAt: new Date('2024-01-15')
      };

      mockPrismaClient.transaction.create.mockResolvedValue(mockCreated);

      await adapter.createTransaction(transactionInput);

      expect(mockPrismaClient.transaction.create).toHaveBeenCalledWith({
        data: {
          ...transactionInput,
          metadata: {}
        }
      });
    });
  });

  describe('createAuditLog', () => {
    it('应该创建审计日志', async () => {
      const logInput = {
        userId: 'user-123',
        action: 'charge',
        status: 'success' as const,
        metadata: { cost: 10 }
      };

      const mockCreated = {
        id: 'log-456',
        ...logInput,
        errorMessage: null,
        createdAt: new Date('2024-01-15')
      };

      mockPrismaClient.auditLog.create.mockResolvedValue(mockCreated);

      const result = await adapter.createAuditLog(logInput);

      expect(result.id).toBe('log-456');
      expect(result.status).toBe('success');
      expect(mockPrismaClient.auditLog.create).toHaveBeenCalledWith({
        data: {
          ...logInput,
          errorMessage: undefined
        }
      });
    });

    it('应该处理带有错误消息的失败日志', async () => {
      const logInput = {
        userId: 'user-123',
        action: 'charge',
        status: 'failed' as const,
        metadata: {},
        errorMessage: 'Insufficient credits'
      };

      const mockCreated = {
        id: 'log-456',
        ...logInput,
        createdAt: new Date('2024-01-15')
      };

      mockPrismaClient.auditLog.create.mockResolvedValue(mockCreated);

      const result = await adapter.createAuditLog(logInput);

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('Insufficient credits');
    });
  });

  describe('getIdempotencyRecord', () => {
    it('应该返回未过期的幂等记录', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const mockRecord = {
        key: 'idempotency-key-123',
        result: { success: true, transactionId: 'txn-456' },
        createdAt: new Date('2024-01-15'),
        expiresAt: futureDate
      };

      mockPrismaClient.idempotencyRecord.findUnique.mockResolvedValue(mockRecord);

      const result = await adapter.getIdempotencyRecord('idempotency-key-123');

      expect(result).toEqual(mockRecord);
    });

    it('应该在记录过期时返回 null', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const mockRecord = {
        key: 'idempotency-key-123',
        result: { success: true },
        createdAt: new Date('2024-01-15'),
        expiresAt: pastDate
      };

      mockPrismaClient.idempotencyRecord.findUnique.mockResolvedValue(mockRecord);

      const result = await adapter.getIdempotencyRecord('idempotency-key-123');

      expect(result).toBeNull();
    });

    it('应该在记录不存在时返回 null', async () => {
      mockPrismaClient.idempotencyRecord.findUnique.mockResolvedValue(null);

      const result = await adapter.getIdempotencyRecord('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createIdempotencyRecord', () => {
    it('应该创建幂等记录', async () => {
      const recordInput = {
        key: 'idempotency-key-123',
        result: { success: true, transactionId: 'txn-456' },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      const mockCreated = {
        ...recordInput,
        createdAt: new Date('2024-01-15')
      };

      mockPrismaClient.idempotencyRecord.create.mockResolvedValue(mockCreated);

      const result = await adapter.createIdempotencyRecord(recordInput);

      expect(result).toEqual(mockCreated);
      expect(mockPrismaClient.idempotencyRecord.create).toHaveBeenCalledWith({
        data: recordInput
      });
    });
  });

  describe('getTransactions', () => {
    it('应该返回用户的交易历史', async () => {
      const mockTransactions = [
        {
          id: 'txn-1',
          userId: 'user-123',
          action: 'generate-post',
          amount: -10,
          balanceBefore: 100,
          balanceAfter: 90,
          metadata: {},
          createdAt: new Date('2024-01-15')
        },
        {
          id: 'txn-2',
          userId: 'user-123',
          action: 'grant',
          amount: 50,
          balanceBefore: 50,
          balanceAfter: 100,
          metadata: {},
          createdAt: new Date('2024-01-10')
        }
      ];

      mockPrismaClient.transaction.findMany.mockResolvedValue(mockTransactions);

      const result = await adapter.getTransactions('user-123');

      expect(result).toEqual(mockTransactions);
      expect(mockPrismaClient.transaction.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: undefined,
        skip: undefined
      });
    });

    it('应该支持分页', async () => {
      mockPrismaClient.transaction.findMany.mockResolvedValue([]);

      await adapter.getTransactions('user-123', { limit: 10, offset: 20 });

      expect(mockPrismaClient.transaction.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 20
      });
    });

    it('应该支持日期范围过滤', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      mockPrismaClient.transaction.findMany.mockResolvedValue([]);

      await adapter.getTransactions('user-123', { startDate, endDate });

      expect(mockPrismaClient.transaction.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { createdAt: 'desc' },
        take: undefined,
        skip: undefined
      });
    });

    it('应该支持操作类型过滤', async () => {
      mockPrismaClient.transaction.findMany.mockResolvedValue([]);

      await adapter.getTransactions('user-123', { action: 'generate-post' });

      expect(mockPrismaClient.transaction.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          action: 'generate-post'
        },
        orderBy: { createdAt: 'desc' },
        take: undefined,
        skip: undefined
      });
    });

    it('应该支持组合过滤条件', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      mockPrismaClient.transaction.findMany.mockResolvedValue([]);

      await adapter.getTransactions('user-123', {
        limit: 10,
        offset: 0,
        startDate,
        endDate,
        action: 'generate-post'
      });

      expect(mockPrismaClient.transaction.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          createdAt: {
            gte: startDate,
            lte: endDate
          },
          action: 'generate-post'
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 0
      });
    });
  });

  describe('错误处理', () => {
    it('应该处理 Prisma 唯一约束冲突错误', async () => {
      const prismaError = {
        code: 'P2002',
        meta: { target: ['key'] },
        message: 'Unique constraint failed'
      };

      mockPrismaClient.idempotencyRecord.create.mockRejectedValue(prismaError);

      await expect(
        adapter.createIdempotencyRecord({
          key: 'duplicate-key',
          result: {},
          expiresAt: new Date()
        })
      ).rejects.toThrow(/Unique constraint violation/);
    });

    it('应该处理 Prisma 外键约束错误', async () => {
      const prismaError = {
        code: 'P2003',
        message: 'Foreign key constraint failed'
      };

      mockPrismaClient.transaction.create.mockRejectedValue(prismaError);

      await expect(
        adapter.createTransaction({
          userId: 'nonexistent-user',
          action: 'test',
          amount: -10,
          balanceBefore: 100,
          balanceAfter: 90
        })
      ).rejects.toThrow(/Foreign key constraint violation/);
    });

    it('应该处理通用 Prisma 错误', async () => {
      const prismaError = {
        code: 'P9999',
        message: 'Unknown Prisma error'
      };

      mockPrismaClient.user.findUnique.mockRejectedValue(prismaError);

      await expect(
        adapter.getUserById('user-123')
      ).rejects.toThrow(/Prisma error/);
    });

    it('应该处理非 Prisma 错误', async () => {
      const genericError = new Error('Network error');

      mockPrismaClient.user.findUnique.mockRejectedValue(genericError);

      await expect(
        adapter.getUserById('user-123')
      ).rejects.toThrow(/Database error/);
    });
  });
});

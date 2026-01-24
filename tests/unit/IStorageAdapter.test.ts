/**
 * IStorageAdapter 接口单元测试
 * 
 * 测试存储适配器接口的方法签名和契约
 * 特别关注会员等级管理相关的方法
 */

import { describe, it, expect } from 'vitest';
import { IStorageAdapter } from '../../src/adapters/IStorageAdapter';
import { User } from '../../src/core/types';

describe('IStorageAdapter Interface', () => {
  describe('updateUserMembership method signature', () => {
    it('should have updateUserMembership method defined in interface', () => {
      // 验证接口定义了 updateUserMembership 方法
      // 这是一个编译时检查，如果接口没有这个方法，TypeScript 会报错
      
      const mockAdapter: IStorageAdapter = {
        getUserById: async () => null,
        updateUserCredits: async () => ({} as User),
        createTransaction: async () => ({} as any),
        createAuditLog: async () => ({} as any),
        getIdempotencyRecord: async () => null,
        createIdempotencyRecord: async () => ({} as any),
        getTransactions: async () => [],
        updateUserMembership: async () => ({} as User)
      };

      expect(mockAdapter.updateUserMembership).toBeDefined();
      expect(typeof mockAdapter.updateUserMembership).toBe('function');
    });

    it('should accept required parameters: userId, membershipTier, credits', async () => {
      // 验证方法接受必需的参数
      const mockAdapter: IStorageAdapter = {
        getUserById: async () => null,
        updateUserCredits: async () => ({} as User),
        createTransaction: async () => ({} as any),
        createAuditLog: async () => ({} as any),
        getIdempotencyRecord: async () => null,
        createIdempotencyRecord: async () => ({} as any),
        getTransactions: async () => [],
        updateUserMembership: async (
          userId: string,
          membershipTier: string,
          credits: number
        ) => {
          expect(typeof userId).toBe('string');
          expect(typeof membershipTier).toBe('string');
          expect(typeof credits).toBe('number');
          return {} as User;
        }
      };

      await mockAdapter.updateUserMembership('user-123', 'pro', 1000);
    });

    it('should accept optional membershipExpiresAt parameter', async () => {
      // 验证方法接受可选的 membershipExpiresAt 参数
      const mockAdapter: IStorageAdapter = {
        getUserById: async () => null,
        updateUserCredits: async () => ({} as User),
        createTransaction: async () => ({} as any),
        createAuditLog: async () => ({} as any),
        getIdempotencyRecord: async () => null,
        createIdempotencyRecord: async () => ({} as any),
        getTransactions: async () => [],
        updateUserMembership: async (
          userId: string,
          membershipTier: string,
          credits: number,
          membershipExpiresAt?: Date | null
        ) => {
          // 验证参数类型
          if (membershipExpiresAt !== undefined) {
            expect(
              membershipExpiresAt === null || membershipExpiresAt instanceof Date
            ).toBe(true);
          }
          return {} as User;
        }
      };

      // 测试不提供 membershipExpiresAt
      await mockAdapter.updateUserMembership('user-123', 'pro', 1000);

      // 测试提供 Date 对象
      await mockAdapter.updateUserMembership(
        'user-123',
        'pro',
        1000,
        new Date('2025-12-31')
      );

      // 测试提供 null
      await mockAdapter.updateUserMembership('user-123', 'pro', 1000, null);
    });

    it('should accept optional txn parameter', async () => {
      // 验证方法接受可选的事务上下文参数
      const mockAdapter: IStorageAdapter = {
        getUserById: async () => null,
        updateUserCredits: async () => ({} as User),
        createTransaction: async () => ({} as any),
        createAuditLog: async () => ({} as any),
        getIdempotencyRecord: async () => null,
        createIdempotencyRecord: async () => ({} as any),
        getTransactions: async () => [],
        updateUserMembership: async (
          userId: string,
          membershipTier: string,
          credits: number,
          membershipExpiresAt?: Date | null,
          txn?: any
        ) => {
          // 验证 txn 参数可以是任意类型
          if (txn !== undefined) {
            expect(txn).toBeDefined();
          }
          return {} as User;
        }
      };

      // 测试不提供 txn
      await mockAdapter.updateUserMembership('user-123', 'pro', 1000);

      // 测试提供 txn
      const mockTxn = { id: 'mock-transaction' };
      await mockAdapter.updateUserMembership(
        'user-123',
        'pro',
        1000,
        undefined,
        mockTxn
      );
    });

    it('should return a Promise<User>', async () => {
      // 验证方法返回 Promise<User>
      const mockUser: User = {
        id: 'user-123',
        credits: 1000,
        membershipTier: 'pro',
        membershipExpiresAt: new Date('2025-12-31'),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockAdapter: IStorageAdapter = {
        getUserById: async () => null,
        updateUserCredits: async () => ({} as User),
        createTransaction: async () => ({} as any),
        createAuditLog: async () => ({} as any),
        getIdempotencyRecord: async () => null,
        createIdempotencyRecord: async () => ({} as any),
        getTransactions: async () => [],
        updateUserMembership: async () => mockUser
      };

      const result = await mockAdapter.updateUserMembership(
        'user-123',
        'pro',
        1000
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('user-123');
      expect(result.credits).toBe(1000);
      expect(result.membershipTier).toBe('pro');
      expect(result.membershipExpiresAt).toBeInstanceOf(Date);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should support all parameter combinations', async () => {
      // 验证方法支持所有参数组合
      const mockUser: User = {
        id: 'user-123',
        credits: 1000,
        membershipTier: 'pro',
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockAdapter: IStorageAdapter = {
        getUserById: async () => null,
        updateUserCredits: async () => ({} as User),
        createTransaction: async () => ({} as any),
        createAuditLog: async () => ({} as any),
        getIdempotencyRecord: async () => null,
        createIdempotencyRecord: async () => ({} as any),
        getTransactions: async () => [],
        updateUserMembership: async () => mockUser
      };

      // 只有必需参数
      await expect(
        mockAdapter.updateUserMembership('user-123', 'pro', 1000)
      ).resolves.toBeDefined();

      // 必需参数 + membershipExpiresAt (Date)
      await expect(
        mockAdapter.updateUserMembership(
          'user-123',
          'pro',
          1000,
          new Date('2025-12-31')
        )
      ).resolves.toBeDefined();

      // 必需参数 + membershipExpiresAt (null)
      await expect(
        mockAdapter.updateUserMembership('user-123', 'pro', 1000, null)
      ).resolves.toBeDefined();

      // 必需参数 + membershipExpiresAt + txn
      await expect(
        mockAdapter.updateUserMembership(
          'user-123',
          'pro',
          1000,
          new Date('2025-12-31'),
          { id: 'txn' }
        )
      ).resolves.toBeDefined();

      // 必需参数 + undefined + txn
      await expect(
        mockAdapter.updateUserMembership(
          'user-123',
          'pro',
          1000,
          undefined,
          { id: 'txn' }
        )
      ).resolves.toBeDefined();
    });
  });

  describe('Interface contract requirements', () => {
    it('should define updateUserMembership to update membership tier (Requirement 8.1)', () => {
      // **验证需求 8.1**: Storage_Adapter SHALL 提供更新用户会员等级的方法
      
      // 这个测试验证接口定义了更新会员等级的能力
      const mockAdapter: IStorageAdapter = {
        getUserById: async () => null,
        updateUserCredits: async () => ({} as User),
        createTransaction: async () => ({} as any),
        createAuditLog: async () => ({} as any),
        getIdempotencyRecord: async () => null,
        createIdempotencyRecord: async () => ({} as any),
        getTransactions: async () => [],
        updateUserMembership: async (
          userId: string,
          membershipTier: string,
          credits: number
        ) => {
          // 验证可以更新会员等级
          return {
            id: userId,
            credits,
            membershipTier, // 关键：返回更新后的会员等级
            membershipExpiresAt: null,
            createdAt: new Date(),
            updatedAt: new Date()
          };
        }
      };

      expect(mockAdapter.updateUserMembership).toBeDefined();
    });

    it('should define updateUserMembership to update membership expiration time (Requirement 8.2)', () => {
      // **验证需求 8.2**: Storage_Adapter SHALL 提供更新用户会员到期时间的方法
      
      // 这个测试验证接口定义了更新会员到期时间的能力
      const mockAdapter: IStorageAdapter = {
        getUserById: async () => null,
        updateUserCredits: async () => ({} as User),
        createTransaction: async () => ({} as any),
        createAuditLog: async () => ({} as any),
        getIdempotencyRecord: async () => null,
        createIdempotencyRecord: async () => ({} as any),
        getTransactions: async () => [],
        updateUserMembership: async (
          userId: string,
          membershipTier: string,
          credits: number,
          membershipExpiresAt?: Date | null
        ) => {
          // 验证可以更新会员到期时间
          return {
            id: userId,
            credits,
            membershipTier,
            membershipExpiresAt: membershipExpiresAt ?? null, // 关键：返回更新后的到期时间
            createdAt: new Date(),
            updatedAt: new Date()
          };
        }
      };

      expect(mockAdapter.updateUserMembership).toBeDefined();
    });
  });

  describe('Type safety', () => {
    it('should enforce correct parameter types at compile time', () => {
      // 这个测试验证 TypeScript 类型系统强制执行正确的参数类型
      // 如果参数类型不正确，TypeScript 编译器会报错
      
      const mockAdapter: IStorageAdapter = {
        getUserById: async () => null,
        updateUserCredits: async () => ({} as User),
        createTransaction: async () => ({} as any),
        createAuditLog: async () => ({} as any),
        getIdempotencyRecord: async () => null,
        createIdempotencyRecord: async () => ({} as any),
        getTransactions: async () => [],
        updateUserMembership: async (
          userId: string,
          membershipTier: string,
          credits: number,
          membershipExpiresAt?: Date | null,
          txn?: any
        ) => ({} as User)
      };

      // 这些调用应该通过类型检查
      expect(() => {
        mockAdapter.updateUserMembership('user-123', 'pro', 1000);
        mockAdapter.updateUserMembership('user-123', 'pro', 1000, new Date());
        mockAdapter.updateUserMembership('user-123', 'pro', 1000, null);
        mockAdapter.updateUserMembership('user-123', 'pro', 1000, undefined, {});
      }).not.toThrow();
    });

    it('should enforce User return type at compile time', async () => {
      // 验证返回类型必须是 User
      const mockUser: User = {
        id: 'user-123',
        credits: 1000,
        membershipTier: 'pro',
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockAdapter: IStorageAdapter = {
        getUserById: async () => null,
        updateUserCredits: async () => ({} as User),
        createTransaction: async () => ({} as any),
        createAuditLog: async () => ({} as any),
        getIdempotencyRecord: async () => null,
        createIdempotencyRecord: async () => ({} as any),
        getTransactions: async () => [],
        updateUserMembership: async () => mockUser
      };

      const result = await mockAdapter.updateUserMembership(
        'user-123',
        'pro',
        1000
      );

      // 验证返回的对象具有 User 接口的所有必需属性
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('credits');
      expect(result).toHaveProperty('membershipTier');
      expect(result).toHaveProperty('membershipExpiresAt');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
    });
  });
});

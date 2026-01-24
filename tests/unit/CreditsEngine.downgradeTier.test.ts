/**
 * CreditsEngine.downgradeTier 单元测试
 * 
 * 测试会员降级功能的核心逻辑
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CreditsEngine } from '../../src/core/CreditsEngine';
import { MockAdapter } from '../../src/adapters/MockAdapter';
import {
  UserNotFoundError,
  UndefinedTierError,
  InvalidTierChangeError
} from '../../src/core/errors';
import type { CreditsConfig, User } from '../../src/core/types';

describe('CreditsEngine.downgradeTier', () => {
  let adapter: MockAdapter;
  let engine: CreditsEngine;
  let config: CreditsConfig;

  beforeEach(() => {
    // 创建测试配置
    config = {
      costs: {
        'test-action': { default: 10 }
      },
      membership: {
        tiers: {
          free: 0,
          basic: 1,
          pro: 2,
          premium: 3
        },
        requirements: {
          'test-action': null
        },
        creditsCaps: {
          free: 100,
          basic: 500,
          pro: 2000,
          premium: 10000
        }
      },
      retry: {
        enabled: false,
        maxAttempts: 1,
        initialDelay: 0,
        maxDelay: 0,
        backoffMultiplier: 1
      },
      idempotency: {
        enabled: true,
        ttl: 86400
      },
      audit: {
        enabled: true
      }
    };

    adapter = new MockAdapter();
    engine = new CreditsEngine({
      storage: adapter,
      config
    });
  });

  describe('Successful Downgrade', () => {
    it('should downgrade user from premium to pro tier', async () => {
      // 创建一个 premium 用户
      const user: User = {
        id: 'user-1',
        credits: 8000,
        membershipTier: 'premium',
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await adapter.createUser(user);

      // 执行降级
      const result = await engine.downgradeTier({
        userId: 'user-1',
        targetTier: 'pro'
      });

      // 验证结果
      expect(result.success).toBe(true);
      expect(result.oldTier).toBe('premium');
      expect(result.newTier).toBe('pro');
      expect(result.oldCredits).toBe(8000);
      expect(result.newCredits).toBe(2000); // pro tier cap
      expect(result.creditsDelta).toBe(-6000);
      expect(result.transactionId).toBeDefined();

      // 验证用户状态已更新
      const updatedUser = await adapter.getUserById('user-1');
      expect(updatedUser?.membershipTier).toBe('pro');
      expect(updatedUser?.credits).toBe(2000);
    });

    it('should downgrade user from pro to free tier', async () => {
      // 创建一个 pro 用户
      const user: User = {
        id: 'user-2',
        credits: 1500,
        membershipTier: 'pro',
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await adapter.createUser(user);

      // 执行降级
      const result = await engine.downgradeTier({
        userId: 'user-2',
        targetTier: 'free'
      });

      // 验证结果
      expect(result.success).toBe(true);
      expect(result.oldTier).toBe('pro');
      expect(result.newTier).toBe('free');
      expect(result.oldCredits).toBe(1500);
      expect(result.newCredits).toBe(100); // free tier cap
      expect(result.creditsDelta).toBe(-1400);

      // 验证用户状态已更新
      const updatedUser = await adapter.getUserById('user-2');
      expect(updatedUser?.membershipTier).toBe('free');
      expect(updatedUser?.credits).toBe(100);
    });

    it('should downgrade user from basic to free tier', async () => {
      // 创建一个 basic 用户
      const user: User = {
        id: 'user-3',
        credits: 400,
        membershipTier: 'basic',
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await adapter.createUser(user);

      // 执行降级
      const result = await engine.downgradeTier({
        userId: 'user-3',
        targetTier: 'free'
      });

      // 验证结果
      expect(result.success).toBe(true);
      expect(result.oldTier).toBe('basic');
      expect(result.newTier).toBe('free');
      expect(result.oldCredits).toBe(400);
      expect(result.newCredits).toBe(100);
      expect(result.creditsDelta).toBe(-300);

      // 验证用户状态已更新
      const updatedUser = await adapter.getUserById('user-3');
      expect(updatedUser?.membershipTier).toBe('free');
      expect(updatedUser?.credits).toBe(100);
    });

    it('should create transaction record with correct metadata', async () => {
      // 创建用户
      const user: User = {
        id: 'user-4',
        credits: 5000,
        membershipTier: 'premium',
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await adapter.createUser(user);

      // 执行降级
      await engine.downgradeTier({
        userId: 'user-4',
        targetTier: 'basic',
        metadata: { reason: 'subscription-expired' }
      });

      // 获取交易记录
      const transactions = await adapter.getTransactions('user-4');
      expect(transactions).toHaveLength(1);

      const transaction = transactions[0];
      expect(transaction.action).toBe('tier-downgrade');
      expect(transaction.amount).toBe(-4500); // 500 - 5000
      expect(transaction.balanceBefore).toBe(5000);
      expect(transaction.balanceAfter).toBe(500);
      expect(transaction.metadata.oldTier).toBe('premium');
      expect(transaction.metadata.newTier).toBe('basic');
      expect(transaction.metadata.reason).toBe('subscription-expired');
    });

    it('should create audit log when audit is enabled', async () => {
      // 创建用户
      const user: User = {
        id: 'user-5',
        credits: 2000,
        membershipTier: 'pro',
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await adapter.createUser(user);

      // 执行降级
      await engine.downgradeTier({
        userId: 'user-5',
        targetTier: 'free'
      });

      // 获取审计日志
      const auditLogs = adapter.getAuditLogs();
      expect(auditLogs.length).toBeGreaterThan(0);

      const downgradeLog = auditLogs.find(
        log => log.action === 'downgradeTier' && log.userId === 'user-5'
      );
      expect(downgradeLog).toBeDefined();
      expect(downgradeLog?.status).toBe('success');
      expect(downgradeLog?.metadata.oldTier).toBe('pro');
      expect(downgradeLog?.metadata.newTier).toBe('free');
    });
  });

  describe('Membership Expiration Clearing', () => {
    it('should clear membershipExpiresAt when clearExpiration is true', async () => {
      const existingExpiresAt = new Date('2025-12-31');

      // 创建用户
      const user: User = {
        id: 'user-6',
        credits: 5000,
        membershipTier: 'premium',
        membershipExpiresAt: existingExpiresAt,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await adapter.createUser(user);

      // 执行降级并清除到期时间
      await engine.downgradeTier({
        userId: 'user-6',
        targetTier: 'free',
        clearExpiration: true
      });

      // 验证到期时间已清除
      const updatedUser = await adapter.getUserById('user-6');
      expect(updatedUser?.membershipExpiresAt).toBeNull();
    });

    it('should preserve membershipExpiresAt when clearExpiration is false', async () => {
      const existingExpiresAt = new Date('2025-12-31');

      // 创建用户
      const user: User = {
        id: 'user-7',
        credits: 5000,
        membershipTier: 'premium',
        membershipExpiresAt: existingExpiresAt,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await adapter.createUser(user);

      // 执行降级但不清除到期时间
      await engine.downgradeTier({
        userId: 'user-7',
        targetTier: 'pro',
        clearExpiration: false
      });

      // 验证到期时间保持不变
      const updatedUser = await adapter.getUserById('user-7');
      expect(updatedUser?.membershipExpiresAt).toEqual(existingExpiresAt);
    });

    it('should preserve membershipExpiresAt when clearExpiration is not provided', async () => {
      const existingExpiresAt = new Date('2025-12-31');

      // 创建用户
      const user: User = {
        id: 'user-8',
        credits: 5000,
        membershipTier: 'premium',
        membershipExpiresAt: existingExpiresAt,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await adapter.createUser(user);

      // 执行降级（不提供 clearExpiration 参数）
      await engine.downgradeTier({
        userId: 'user-8',
        targetTier: 'pro'
      });

      // 验证到期时间保持不变
      const updatedUser = await adapter.getUserById('user-8');
      expect(updatedUser?.membershipExpiresAt).toEqual(existingExpiresAt);
    });
  });

  describe('Error Handling', () => {
    it('should throw UserNotFoundError when user does not exist', async () => {
      await expect(
        engine.downgradeTier({
          userId: 'non-existent-user',
          targetTier: 'free'
        })
      ).rejects.toThrow(UserNotFoundError);
    });

    it('should throw UndefinedTierError when target tier is not defined', async () => {
      // 创建用户
      const user: User = {
        id: 'user-9',
        credits: 5000,
        membershipTier: 'premium',
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await adapter.createUser(user);

      await expect(
        engine.downgradeTier({
          userId: 'user-9',
          targetTier: 'platinum' // 未定义的等级
        })
      ).rejects.toThrow(UndefinedTierError);
    });

    it('should throw InvalidTierChangeError when target tier is not lower', async () => {
      // 创建用户
      const user: User = {
        id: 'user-10',
        credits: 1000,
        membershipTier: 'pro',
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await adapter.createUser(user);

      // 尝试"降级"到相同等级
      await expect(
        engine.downgradeTier({
          userId: 'user-10',
          targetTier: 'pro'
        })
      ).rejects.toThrow(InvalidTierChangeError);
    });

    it('should throw InvalidTierChangeError when target tier is higher', async () => {
      // 创建用户
      const user: User = {
        id: 'user-11',
        credits: 200,
        membershipTier: 'basic',
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await adapter.createUser(user);

      // 尝试"降级"到更高等级
      await expect(
        engine.downgradeTier({
          userId: 'user-11',
          targetTier: 'premium'
        })
      ).rejects.toThrow(InvalidTierChangeError);
    });

    it('should create audit log on failure', async () => {
      // 尝试降级不存在的用户
      await expect(
        engine.downgradeTier({
          userId: 'non-existent',
          targetTier: 'free'
        })
      ).rejects.toThrow(UserNotFoundError);

      // 验证审计日志已创建
      const auditLogs = adapter.getAuditLogs();
      expect(auditLogs.length).toBeGreaterThan(0);

      const failedLog = auditLogs.find(
        log => log.action === 'downgradeTier' && log.status === 'failed' && log.userId === 'non-existent'
      );
      expect(failedLog).toBeDefined();
      expect(failedLog?.errorMessage).toContain('not found');
    });
  });

  describe('Idempotency', () => {
    it('should return cached result for duplicate idempotency key', async () => {
      // 创建用户
      const user: User = {
        id: 'user-12',
        credits: 5000,
        membershipTier: 'premium',
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await adapter.createUser(user);

      const idempotencyKey = 'downgrade-key-123';

      // 第一次调用
      const result1 = await engine.downgradeTier({
        userId: 'user-12',
        targetTier: 'free',
        idempotencyKey
      });

      // 第二次调用（使用相同的幂等键）
      const result2 = await engine.downgradeTier({
        userId: 'user-12',
        targetTier: 'free',
        idempotencyKey
      });

      // 验证返回相同的结果
      expect(result2).toEqual(result1);

      // 验证只创建了一条交易记录
      const transactions = await adapter.getTransactions('user-12');
      expect(transactions).toHaveLength(1);
    });
  });

  describe('Transaction Support', () => {
    it('should support transaction context', async () => {
      // 创建用户
      const user: User = {
        id: 'user-13',
        credits: 5000,
        membershipTier: 'premium',
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await adapter.createUser(user);

      // 在事务中执行降级
      const txn = {}; // MockAdapter 不需要真实的事务对象
      await engine.downgradeTier({
        userId: 'user-13',
        targetTier: 'basic',
        txn
      });

      // 验证用户已降级
      const updatedUser = await adapter.getUserById('user-13');
      expect(updatedUser?.membershipTier).toBe('basic');
      expect(updatedUser?.credits).toBe(500);
    });
  });
});

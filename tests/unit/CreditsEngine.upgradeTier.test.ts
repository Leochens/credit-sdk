/**
 * CreditsEngine.upgradeTier 单元测试
 * 
 * 测试会员升级功能的核心逻辑
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

describe('CreditsEngine.upgradeTier', () => {
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

  describe('Successful Upgrade', () => {
    it('should upgrade user from free to basic tier', async () => {
      // 创建一个 free 用户
      const user: User = {
        id: 'user-1',
        credits: 50,
        membershipTier: 'free',
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await adapter.createUser(user);

      // 执行升级
      const result = await engine.upgradeTier({
        userId: 'user-1',
        targetTier: 'basic'
      });

      // 验证结果
      expect(result.success).toBe(true);
      expect(result.oldTier).toBe('free');
      expect(result.newTier).toBe('basic');
      expect(result.oldCredits).toBe(50);
      expect(result.newCredits).toBe(500); // basic tier cap
      expect(result.creditsDelta).toBe(450);
      expect(result.transactionId).toBeDefined();

      // 验证用户状态已更新
      const updatedUser = await adapter.getUserById('user-1');
      expect(updatedUser?.membershipTier).toBe('basic');
      expect(updatedUser?.credits).toBe(500);
    });

    it('should upgrade user from basic to premium tier', async () => {
      // 创建一个 basic 用户
      const user: User = {
        id: 'user-2',
        credits: 300,
        membershipTier: 'basic',
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await adapter.createUser(user);

      // 执行升级
      const result = await engine.upgradeTier({
        userId: 'user-2',
        targetTier: 'premium'
      });

      // 验证结果
      expect(result.success).toBe(true);
      expect(result.oldTier).toBe('basic');
      expect(result.newTier).toBe('premium');
      expect(result.oldCredits).toBe(300);
      expect(result.newCredits).toBe(10000); // premium tier cap
      expect(result.creditsDelta).toBe(9700);

      // 验证用户状态已更新
      const updatedUser = await adapter.getUserById('user-2');
      expect(updatedUser?.membershipTier).toBe('premium');
      expect(updatedUser?.credits).toBe(10000);
    });

    it('should upgrade user from null tier to basic tier', async () => {
      // 创建一个没有会员等级的用户
      const user: User = {
        id: 'user-3',
        credits: 25,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await adapter.createUser(user);

      // 执行升级
      const result = await engine.upgradeTier({
        userId: 'user-3',
        targetTier: 'basic'
      });

      // 验证结果
      expect(result.success).toBe(true);
      expect(result.oldTier).toBe(null);
      expect(result.newTier).toBe('basic');
      expect(result.oldCredits).toBe(25);
      expect(result.newCredits).toBe(500);
      expect(result.creditsDelta).toBe(475);

      // 验证用户状态已更新
      const updatedUser = await adapter.getUserById('user-3');
      expect(updatedUser?.membershipTier).toBe('basic');
      expect(updatedUser?.credits).toBe(500);
    });

    it('should create transaction record with correct metadata', async () => {
      // 创建用户
      const user: User = {
        id: 'user-4',
        credits: 100,
        membershipTier: 'free',
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await adapter.createUser(user);

      // 执行升级
      const result = await engine.upgradeTier({
        userId: 'user-4',
        targetTier: 'pro',
        metadata: { reason: 'promotion' }
      });

      // 获取交易记录
      const transactions = await adapter.getTransactions('user-4');
      expect(transactions).toHaveLength(1);

      const transaction = transactions[0];
      expect(transaction.action).toBe('tier-upgrade');
      expect(transaction.amount).toBe(1900); // 2000 - 100
      expect(transaction.balanceBefore).toBe(100);
      expect(transaction.balanceAfter).toBe(2000);
      expect(transaction.metadata.oldTier).toBe('free');
      expect(transaction.metadata.newTier).toBe('pro');
      expect(transaction.metadata.reason).toBe('promotion');
    });

    it('should create audit log when audit is enabled', async () => {
      // 创建用户
      const user: User = {
        id: 'user-5',
        credits: 100,
        membershipTier: 'free',
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await adapter.createUser(user);

      // 执行升级
      await engine.upgradeTier({
        userId: 'user-5',
        targetTier: 'basic'
      });

      // 获取审计日志
      const auditLogs = adapter.getAuditLogs();
      expect(auditLogs.length).toBeGreaterThan(0);

      const upgradeLog = auditLogs.find(
        log => log.action === 'upgradeTier' && log.userId === 'user-5'
      );
      expect(upgradeLog).toBeDefined();
      expect(upgradeLog?.status).toBe('success');
      expect(upgradeLog?.metadata.oldTier).toBe('free');
      expect(upgradeLog?.metadata.newTier).toBe('basic');
    });

    it('should update membershipExpiresAt when provided', async () => {
      // 创建用户
      const user: User = {
        id: 'user-6',
        credits: 100,
        membershipTier: 'free',
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await adapter.createUser(user);

      const expiresAt = new Date('2025-12-31');

      // 执行升级
      await engine.upgradeTier({
        userId: 'user-6',
        targetTier: 'premium',
        membershipExpiresAt: expiresAt
      });

      // 验证到期时间已更新
      const updatedUser = await adapter.getUserById('user-6');
      expect(updatedUser?.membershipExpiresAt).toEqual(expiresAt);
    });

    it('should preserve membershipExpiresAt when not provided', async () => {
      const existingExpiresAt = new Date('2025-06-30');

      // 创建用户
      const user: User = {
        id: 'user-7',
        credits: 100,
        membershipTier: 'basic',
        membershipExpiresAt: existingExpiresAt,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await adapter.createUser(user);

      // 执行升级（不提供 membershipExpiresAt）
      await engine.upgradeTier({
        userId: 'user-7',
        targetTier: 'pro'
      });

      // 验证到期时间保持不变
      const updatedUser = await adapter.getUserById('user-7');
      expect(updatedUser?.membershipExpiresAt).toEqual(existingExpiresAt);
    });
  });

  describe('Error Handling', () => {
    it('should throw UserNotFoundError when user does not exist', async () => {
      await expect(
        engine.upgradeTier({
          userId: 'non-existent-user',
          targetTier: 'basic'
        })
      ).rejects.toThrow(UserNotFoundError);
    });

    it('should throw UndefinedTierError when target tier is not defined', async () => {
      // 创建用户
      const user: User = {
        id: 'user-8',
        credits: 100,
        membershipTier: 'free',
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await adapter.createUser(user);

      await expect(
        engine.upgradeTier({
          userId: 'user-8',
          targetTier: 'platinum' // 未定义的等级
        })
      ).rejects.toThrow(UndefinedTierError);
    });

    it('should throw InvalidTierChangeError when target tier is not higher', async () => {
      // 创建用户
      const user: User = {
        id: 'user-9',
        credits: 1000,
        membershipTier: 'pro',
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await adapter.createUser(user);

      // 尝试"升级"到相同等级
      await expect(
        engine.upgradeTier({
          userId: 'user-9',
          targetTier: 'pro'
        })
      ).rejects.toThrow(InvalidTierChangeError);
    });

    it('should throw InvalidTierChangeError when target tier is lower', async () => {
      // 创建用户
      const user: User = {
        id: 'user-10',
        credits: 5000,
        membershipTier: 'premium',
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await adapter.createUser(user);

      // 尝试"升级"到更低等级
      await expect(
        engine.upgradeTier({
          userId: 'user-10',
          targetTier: 'basic'
        })
      ).rejects.toThrow(InvalidTierChangeError);
    });

    it('should create audit log on failure', async () => {
      // 尝试升级不存在的用户
      await expect(
        engine.upgradeTier({
          userId: 'non-existent',
          targetTier: 'basic'
        })
      ).rejects.toThrow(UserNotFoundError);

      // 验证审计日志已创建
      const auditLogs = adapter.getAuditLogs();
      expect(auditLogs.length).toBeGreaterThan(0);

      const failedLog = auditLogs.find(
        log => log.action === 'upgradeTier' && log.status === 'failed' && log.userId === 'non-existent'
      );
      expect(failedLog).toBeDefined();
      expect(failedLog?.errorMessage).toContain('not found');
    });
  });

  describe('Idempotency', () => {
    it('should return cached result for duplicate idempotency key', async () => {
      // 创建用户
      const user: User = {
        id: 'user-11',
        credits: 100,
        membershipTier: 'free',
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await adapter.createUser(user);

      const idempotencyKey = 'upgrade-key-123';

      // 第一次调用
      const result1 = await engine.upgradeTier({
        userId: 'user-11',
        targetTier: 'basic',
        idempotencyKey
      });

      // 第二次调用（使用相同的幂等键）
      const result2 = await engine.upgradeTier({
        userId: 'user-11',
        targetTier: 'basic',
        idempotencyKey
      });

      // 验证返回相同的结果
      expect(result2).toEqual(result1);

      // 验证只创建了一条交易记录
      const transactions = await adapter.getTransactions('user-11');
      expect(transactions).toHaveLength(1);
    });
  });

  describe('Transaction Support', () => {
    it('should support transaction context', async () => {
      // 创建用户
      const user: User = {
        id: 'user-12',
        credits: 100,
        membershipTier: 'free',
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await adapter.createUser(user);

      // 在事务中执行升级
      const txn = {}; // MockAdapter 不需要真实的事务对象
      await engine.upgradeTier({
        userId: 'user-12',
        targetTier: 'basic',
        txn
      });

      // 验证用户已升级
      const updatedUser = await adapter.getUserById('user-12');
      expect(updatedUser?.membershipTier).toBe('basic');
      expect(updatedUser?.credits).toBe(500);
    });
  });
});

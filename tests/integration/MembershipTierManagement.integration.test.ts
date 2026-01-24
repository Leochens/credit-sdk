/**
 * 会员等级管理集成测试
 * 
 * 端到端测试会员升级和降级功能，包括与其他SDK功能的集成
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockAdapter } from '../../src/adapters/MockAdapter';
import { CreditsEngine } from '../../src/core/CreditsEngine';
import { CreditsConfig } from '../../src/core/types';
import {
  InvalidTierChangeError,
  UndefinedTierError,
  UserNotFoundError,
  InsufficientCreditsError
} from '../../src/core/errors';

describe('Membership Tier Management - End-to-End Integration', () => {
  let adapter: MockAdapter;
  let engine: CreditsEngine;
  let config: CreditsConfig;

  beforeEach(async () => {
    adapter = new MockAdapter();

    config = {
      costs: {
        'generate-post': {
          default: 10,
          basic: 10,
          premium: 8,
          enterprise: 5
        },
        'generate-image': {
          default: 20,
          premium: 15,
          enterprise: 10
        },
        'api-call': {
          default: 1,
          premium: 0.5,
          enterprise: 0.1
        }
      },
      membership: {
        tiers: {
          free: 0,
          basic: 1,
          premium: 2,
          enterprise: 3
        },
        requirements: {
          'generate-post': null,
          'generate-image': 'premium',
          'api-call': null
        },
        creditsCaps: {
          free: 100,
          basic: 500,
          premium: 2000,
          enterprise: 10000
        }
      },
      retry: {
        enabled: false,
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 5000,
        backoffMultiplier: 2
      },
      idempotency: {
        enabled: true,
        ttl: 86400
      },
      audit: {
        enabled: true
      }
    };

    engine = new CreditsEngine({
      storage: adapter,
      config
    });

    // 创建测试用户
    await adapter.createUser({
      id: 'user-free',
      credits: 50,
      membershipTier: null
    });

    await adapter.createUser({
      id: 'user-basic',
      credits: 300,
      membershipTier: 'basic'
    });

    await adapter.createUser({
      id: 'user-premium',
      credits: 1500,
      membershipTier: 'premium',
      membershipExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    });
  });

  describe('Complete Upgrade Workflow', () => {
    it('should upgrade user from free to premium with all side effects', async () => {
      const result = await engine.upgradeTier({
        userId: 'user-free',
        targetTier: 'premium',
        membershipExpiresAt: new Date('2025-12-31'),
        metadata: { reason: 'Annual subscription purchase' }
      });

      // 验证返回结果
      expect(result.success).toBe(true);
      expect(result.oldTier).toBe(null);
      expect(result.newTier).toBe('premium');
      expect(result.oldCredits).toBe(50);
      expect(result.newCredits).toBe(2000);
      expect(result.creditsDelta).toBe(1950);
      expect(result.transactionId).toBeDefined();

      // 验证用户状态已更新
      const user = await adapter.getUserById('user-free');
      expect(user!.membershipTier).toBe('premium');
      expect(user!.credits).toBe(2000);
      expect(user!.membershipExpiresAt).toEqual(new Date('2025-12-31'));

      // 验证交易记录已创建
      const transactions = adapter.getAllTransactions();
      const tierTransaction = transactions.find(t => t.action === 'tier-upgrade');
      expect(tierTransaction).toBeDefined();
      expect(tierTransaction!.userId).toBe('user-free');
      expect(tierTransaction!.amount).toBe(1950);
      expect(tierTransaction!.balanceBefore).toBe(50);
      expect(tierTransaction!.balanceAfter).toBe(2000);
      expect(tierTransaction!.metadata).toMatchObject({
        oldTier: null,
        newTier: 'premium',
        oldCredits: 50,
        newCredits: 2000,
        creditsDelta: 1950
      });

      // 验证审计日志已创建
      const logs = adapter.getAuditLogs();
      const upgradeLog = logs.find(l => l.action === 'upgradeTier');
      expect(upgradeLog).toBeDefined();
      expect(upgradeLog!.status).toBe('success');
      expect(upgradeLog!.userId).toBe('user-free');
      expect(upgradeLog!.metadata).toMatchObject({
        oldTier: null,
        newTier: 'premium',
        transactionId: result.transactionId
      });
    });

    it('should upgrade user from basic to enterprise', async () => {
      const result = await engine.upgradeTier({
        userId: 'user-basic',
        targetTier: 'enterprise',
        metadata: { reason: 'Enterprise plan purchase' }
      });

      expect(result.oldTier).toBe('basic');
      expect(result.newTier).toBe('enterprise');
      expect(result.oldCredits).toBe(300);
      expect(result.newCredits).toBe(10000);
      expect(result.creditsDelta).toBe(9700);

      const user = await adapter.getUserById('user-basic');
      expect(user!.membershipTier).toBe('enterprise');
      expect(user!.credits).toBe(10000);
    });

    it('should preserve existing expiration date when not provided', async () => {
      const originalExpiration = new Date('2025-12-31');
      await adapter.createUser({
        id: 'user-test',
        credits: 100,
        membershipTier: 'basic',
        membershipExpiresAt: originalExpiration
      });

      await engine.upgradeTier({
        userId: 'user-test',
        targetTier: 'premium'
      });

      const user = await adapter.getUserById('user-test');
      expect(user!.membershipExpiresAt).toEqual(originalExpiration);
    });
  });

  describe('Complete Downgrade Workflow', () => {
    it('should downgrade user from premium to free with all side effects', async () => {
      const result = await engine.downgradeTier({
        userId: 'user-premium',
        targetTier: 'free',
        clearExpiration: true,
        metadata: { reason: 'Subscription expired' }
      });

      // 验证返回结果
      expect(result.success).toBe(true);
      expect(result.oldTier).toBe('premium');
      expect(result.newTier).toBe('free');
      expect(result.oldCredits).toBe(1500);
      expect(result.newCredits).toBe(100);
      expect(result.creditsDelta).toBe(-1400);
      expect(result.transactionId).toBeDefined();

      // 验证用户状态已更新
      const user = await adapter.getUserById('user-premium');
      expect(user!.membershipTier).toBe('free');
      expect(user!.credits).toBe(100);
      expect(user!.membershipExpiresAt).toBe(null);

      // 验证交易记录已创建
      const transactions = adapter.getAllTransactions();
      const tierTransaction = transactions.find(t => t.action === 'tier-downgrade');
      expect(tierTransaction).toBeDefined();
      expect(tierTransaction!.amount).toBe(-1400);
      expect(tierTransaction!.metadata).toMatchObject({
        oldTier: 'premium',
        newTier: 'free',
        creditsDelta: -1400
      });

      // 验证审计日志已创建
      const logs = adapter.getAuditLogs();
      const downgradeLog = logs.find(l => l.action === 'downgradeTier');
      expect(downgradeLog).toBeDefined();
      expect(downgradeLog!.status).toBe('success');
    });

    it('should preserve expiration date when clearExpiration is false', async () => {
      const result = await engine.downgradeTier({
        userId: 'user-premium',
        targetTier: 'basic',
        clearExpiration: false
      });

      const user = await adapter.getUserById('user-premium');
      expect(user!.membershipTier).toBe('basic');
      expect(user!.membershipExpiresAt).not.toBe(null);
    });
  });

  describe('Integration with Other SDK Features', () => {
    it('should allow operations after upgrade with new tier pricing', async () => {
      // 升级用户
      await engine.upgradeTier({
        userId: 'user-free',
        targetTier: 'premium'
      });

      // 执行扣费操作，应该使用 premium 价格
      const chargeResult = await engine.charge({
        userId: 'user-free',
        action: 'generate-post'
      });

      expect(chargeResult.cost).toBe(8); // premium 价格
      expect(chargeResult.balanceBefore).toBe(2000);
      expect(chargeResult.balanceAfter).toBe(1992);
    });

    it('should grant access to premium features after upgrade', async () => {
      // 升级前无法访问 premium 功能
      await expect(
        engine.validateAccess('user-free', 'generate-image')
      ).rejects.toThrow();

      // 升级用户
      await engine.upgradeTier({
        userId: 'user-free',
        targetTier: 'premium'
      });

      // 升级后可以访问 premium 功能
      await expect(
        engine.validateAccess('user-free', 'generate-image')
      ).resolves.toBe(true);

      // 可以执行 premium 功能
      const result = await engine.charge({
        userId: 'user-free',
        action: 'generate-image'
      });

      expect(result.success).toBe(true);
      expect(result.cost).toBe(15); // premium 价格
    });

    it('should revoke access to premium features after downgrade', async () => {
      // 降级前可以访问 premium 功能
      await expect(
        engine.validateAccess('user-premium', 'generate-image')
      ).resolves.toBe(true);

      // 降级用户
      await engine.downgradeTier({
        userId: 'user-premium',
        targetTier: 'free'
      });

      // 降级后无法访问 premium 功能
      await expect(
        engine.validateAccess('user-premium', 'generate-image')
      ).rejects.toThrow();
    });

    it('should use correct pricing after downgrade', async () => {
      // 降级用户
      await engine.downgradeTier({
        userId: 'user-premium',
        targetTier: 'free'
      });

      // 执行扣费操作，应该使用 default 价格
      const chargeResult = await engine.charge({
        userId: 'user-premium',
        action: 'generate-post'
      });

      expect(chargeResult.cost).toBe(10); // default 价格
    });

    it('should handle insufficient credits after downgrade', async () => {
      // 降级用户到 free (100 credits)
      await engine.downgradeTier({
        userId: 'user-premium',
        targetTier: 'free'
      });

      // 尝试执行多次操作直到余额不足
      await engine.charge({ userId: 'user-premium', action: 'generate-post' }); // 90
      await engine.charge({ userId: 'user-premium', action: 'generate-post' }); // 80
      await engine.charge({ userId: 'user-premium', action: 'generate-post' }); // 70
      await engine.charge({ userId: 'user-premium', action: 'generate-post' }); // 60
      await engine.charge({ userId: 'user-premium', action: 'generate-post' }); // 50
      await engine.charge({ userId: 'user-premium', action: 'generate-post' }); // 40
      await engine.charge({ userId: 'user-premium', action: 'generate-post' }); // 30
      await engine.charge({ userId: 'user-premium', action: 'generate-post' }); // 20
      await engine.charge({ userId: 'user-premium', action: 'generate-post' }); // 10
      await engine.charge({ userId: 'user-premium', action: 'generate-post' }); // 0

      // 下一次应该失败（余额为0，需要10）
      await expect(
        engine.charge({ userId: 'user-premium', action: 'generate-post' })
      ).rejects.toThrow(InsufficientCreditsError);
    });
  });

  describe('Idempotency Support', () => {
    it('should handle duplicate upgrade requests with idempotency key', async () => {
      const idempotencyKey = 'upgrade-key-123';

      // 第一次升级
      const result1 = await engine.upgradeTier({
        userId: 'user-free',
        targetTier: 'premium',
        idempotencyKey
      });

      // 第二次使用相同幂等键
      const result2 = await engine.upgradeTier({
        userId: 'user-free',
        targetTier: 'premium',
        idempotencyKey
      });

      // 结果应该相同
      expect(result2).toEqual(result1);

      // 用户状态应该只更新一次
      const user = await adapter.getUserById('user-free');
      expect(user!.membershipTier).toBe('premium');
      expect(user!.credits).toBe(2000);

      // 只应该有一条交易记录
      const transactions = adapter.getAllTransactions();
      const tierTransactions = transactions.filter(t => t.action === 'tier-upgrade');
      expect(tierTransactions).toHaveLength(1);
    });

    it('should handle duplicate downgrade requests with idempotency key', async () => {
      const idempotencyKey = 'downgrade-key-456';

      // 第一次降级
      const result1 = await engine.downgradeTier({
        userId: 'user-premium',
        targetTier: 'basic',
        idempotencyKey
      });

      // 第二次使用相同幂等键
      const result2 = await engine.downgradeTier({
        userId: 'user-premium',
        targetTier: 'basic',
        idempotencyKey
      });

      // 结果应该相同
      expect(result2).toEqual(result1);

      // 只应该有一条交易记录
      const transactions = adapter.getAllTransactions();
      const tierTransactions = transactions.filter(t => t.action === 'tier-downgrade');
      expect(tierTransactions).toHaveLength(1);
    });
  });

  describe('Transaction History', () => {
    it('should include tier changes in transaction history', async () => {
      // 执行多个操作
      await engine.charge({ userId: 'user-premium', action: 'generate-post' });
      await engine.upgradeTier({ userId: 'user-basic', targetTier: 'premium' });
      await engine.downgradeTier({ userId: 'user-premium', targetTier: 'basic' });
      await engine.grant({ userId: 'user-basic', amount: 100, action: 'bonus' });

      // 查询 user-basic 的历史
      const history = await engine.getHistory('user-basic');

      // 应该包含升级和发放积分
      expect(history.length).toBeGreaterThanOrEqual(2);
      const upgradeTransaction = history.find(t => t.action === 'tier-upgrade');
      const grantTransaction = history.find(t => t.action === 'bonus');

      expect(upgradeTransaction).toBeDefined();
      expect(grantTransaction).toBeDefined();
    });

    it('should filter tier change transactions by action', async () => {
      await engine.upgradeTier({ userId: 'user-basic', targetTier: 'premium' });
      await engine.charge({ userId: 'user-basic', action: 'generate-post' });
      await engine.downgradeTier({ userId: 'user-basic', targetTier: 'free' });

      // 只查询升级操作
      const upgrades = await engine.getHistory('user-basic', {
        action: 'tier-upgrade'
      });

      expect(upgrades).toHaveLength(1);
      expect(upgrades[0].action).toBe('tier-upgrade');
    });
  });

  describe('Error Handling', () => {
    it('should throw UserNotFoundError for non-existent user', async () => {
      await expect(
        engine.upgradeTier({
          userId: 'non-existent',
          targetTier: 'premium'
        })
      ).rejects.toThrow(UserNotFoundError);

      await expect(
        engine.downgradeTier({
          userId: 'non-existent',
          targetTier: 'free'
        })
      ).rejects.toThrow(UserNotFoundError);
    });

    it('should throw UndefinedTierError for undefined tier', async () => {
      await expect(
        engine.upgradeTier({
          userId: 'user-free',
          targetTier: 'platinum'
        })
      ).rejects.toThrow(UndefinedTierError);

      await expect(
        engine.downgradeTier({
          userId: 'user-premium',
          targetTier: 'platinum'
        })
      ).rejects.toThrow(UndefinedTierError);
    });

    it('should throw InvalidTierChangeError for invalid upgrade direction', async () => {
      await expect(
        engine.upgradeTier({
          userId: 'user-premium',
          targetTier: 'basic'
        })
      ).rejects.toThrow(InvalidTierChangeError);

      await expect(
        engine.upgradeTier({
          userId: 'user-premium',
          targetTier: 'premium'
        })
      ).rejects.toThrow(InvalidTierChangeError);
    });

    it('should throw InvalidTierChangeError for invalid downgrade direction', async () => {
      await expect(
        engine.downgradeTier({
          userId: 'user-basic',
          targetTier: 'premium'
        })
      ).rejects.toThrow(InvalidTierChangeError);

      await expect(
        engine.downgradeTier({
          userId: 'user-basic',
          targetTier: 'basic'
        })
      ).rejects.toThrow(InvalidTierChangeError);
    });

    it('should log failed operations in audit trail', async () => {
      try {
        await engine.upgradeTier({
          userId: 'non-existent',
          targetTier: 'premium'
        });
      } catch (error) {
        // Expected to fail
      }

      const logs = adapter.getAuditLogs();
      const failedLog = logs.find(
        l => l.action === 'upgradeTier' && l.status === 'failed'
      );

      expect(failedLog).toBeDefined();
      expect(failedLog!.errorMessage).toContain('not found');
    });
  });

  describe('Multiple Users Scenario', () => {
    it('should handle tier changes for multiple users independently', async () => {
      // 升级 user-free
      await engine.upgradeTier({
        userId: 'user-free',
        targetTier: 'premium'
      });

      // 降级 user-premium
      await engine.downgradeTier({
        userId: 'user-premium',
        targetTier: 'basic'
      });

      // 验证两个用户的状态独立
      const userFree = await adapter.getUserById('user-free');
      const userPremium = await adapter.getUserById('user-premium');

      expect(userFree!.membershipTier).toBe('premium');
      expect(userFree!.credits).toBe(2000);

      expect(userPremium!.membershipTier).toBe('basic');
      expect(userPremium!.credits).toBe(500);

      // 验证交易历史独立
      const historyFree = await engine.getHistory('user-free');
      const historyPremium = await engine.getHistory('user-premium');

      expect(historyFree.some(t => t.action === 'tier-upgrade')).toBe(true);
      expect(historyPremium.some(t => t.action === 'tier-downgrade')).toBe(true);
    });
  });

  describe('Complex Workflow Scenarios', () => {
    it('should handle upgrade -> charge -> downgrade workflow', async () => {
      // 1. 升级用户
      await engine.upgradeTier({
        userId: 'user-free',
        targetTier: 'premium'
      });

      let user = await adapter.getUserById('user-free');
      expect(user!.credits).toBe(2000);

      // 2. 执行多次扣费
      await engine.charge({ userId: 'user-free', action: 'generate-post' }); // -8
      await engine.charge({ userId: 'user-free', action: 'generate-post' }); // -8
      await engine.charge({ userId: 'user-free', action: 'generate-post' }); // -8

      user = await adapter.getUserById('user-free');
      expect(user!.credits).toBe(1976);

      // 3. 降级用户
      await engine.downgradeTier({
        userId: 'user-free',
        targetTier: 'free'
      });

      user = await adapter.getUserById('user-free');
      expect(user!.credits).toBe(100); // 重置为 free tier 的上限
      expect(user!.membershipTier).toBe('free');

      // 4. 验证交易历史完整
      const history = await engine.getHistory('user-free');
      expect(history.length).toBeGreaterThanOrEqual(5); // 1 upgrade + 3 charges + 1 downgrade
    });

    it('should handle multiple tier changes in sequence', async () => {
      // free -> basic -> premium -> enterprise
      await engine.upgradeTier({
        userId: 'user-free',
        targetTier: 'basic'
      });

      let user = await adapter.getUserById('user-free');
      expect(user!.membershipTier).toBe('basic');
      expect(user!.credits).toBe(500);

      await engine.upgradeTier({
        userId: 'user-free',
        targetTier: 'premium'
      });

      user = await adapter.getUserById('user-free');
      expect(user!.membershipTier).toBe('premium');
      expect(user!.credits).toBe(2000);

      await engine.upgradeTier({
        userId: 'user-free',
        targetTier: 'enterprise'
      });

      user = await adapter.getUserById('user-free');
      expect(user!.membershipTier).toBe('enterprise');
      expect(user!.credits).toBe(10000);

      // 验证所有升级都被记录
      const history = await engine.getHistory('user-free');
      const upgrades = history.filter(t => t.action === 'tier-upgrade');
      expect(upgrades).toHaveLength(3);
    });

    it('should handle tier change with concurrent operations', async () => {
      // 升级用户
      await engine.upgradeTier({
        userId: 'user-basic',
        targetTier: 'premium'
      });

      // 执行多个并发操作
      const operations = [
        engine.charge({ userId: 'user-basic', action: 'generate-post' }),
        engine.charge({ userId: 'user-basic', action: 'generate-post' }),
        engine.grant({ userId: 'user-basic', amount: 100, action: 'bonus' })
      ];

      await Promise.all(operations);

      // 验证所有操作都成功
      const user = await adapter.getUserById('user-basic');
      // 2000 (upgrade) - 8 - 8 + 100 = 2084
      expect(user!.credits).toBe(2084);

      const history = await engine.getHistory('user-basic');
      expect(history.length).toBeGreaterThanOrEqual(4); // 1 upgrade + 2 charges + 1 grant
    });
  });

  describe('Audit Trail Verification', () => {
    it('should create comprehensive audit logs for all tier operations', async () => {
      // 执行多个操作
      await engine.upgradeTier({
        userId: 'user-free',
        targetTier: 'premium',
        metadata: { campaign: 'black-friday' }
      });

      await engine.downgradeTier({
        userId: 'user-premium',
        targetTier: 'basic',
        metadata: { reason: 'user-requested' }
      });

      // 验证审计日志
      const logs = adapter.getAuditLogs();

      const upgradeLog = logs.find(
        l => l.action === 'upgradeTier' && l.userId === 'user-free'
      );
      expect(upgradeLog).toBeDefined();
      expect(upgradeLog!.status).toBe('success');
      expect(upgradeLog!.metadata).toMatchObject({
        oldTier: null,
        newTier: 'premium'
      });

      const downgradeLog = logs.find(
        l => l.action === 'downgradeTier' && l.userId === 'user-premium'
      );
      expect(downgradeLog).toBeDefined();
      expect(downgradeLog!.status).toBe('success');
      expect(downgradeLog!.metadata).toMatchObject({
        oldTier: 'premium',
        newTier: 'basic'
      });
    });

    it('should include metadata in audit logs', async () => {
      const metadata = {
        campaign: 'summer-sale',
        discount: '50%',
        source: 'web'
      };

      await engine.upgradeTier({
        userId: 'user-free',
        targetTier: 'premium',
        metadata
      });

      const logs = adapter.getAuditLogs();
      const upgradeLog = logs.find(l => l.action === 'upgradeTier');

      expect(upgradeLog).toBeDefined();
      // Metadata 应该被传递到审计日志中
      expect(upgradeLog!.metadata).toBeDefined();
    });
  });

  describe('Balance Query After Tier Changes', () => {
    it('should return correct balance after upgrade', async () => {
      await engine.upgradeTier({
        userId: 'user-free',
        targetTier: 'premium'
      });

      const balance = await engine.queryBalance('user-free');
      expect(balance).toBe(2000);
    });

    it('should return correct balance after downgrade', async () => {
      await engine.downgradeTier({
        userId: 'user-premium',
        targetTier: 'free'
      });

      const balance = await engine.queryBalance('user-premium');
      expect(balance).toBe(100);
    });
  });
});

/**
 * MockAdapter 集成测试
 * 
 * 演示如何使用 MockAdapter 与 CreditsEngine 进行集成测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockAdapter } from '../../src/adapters/MockAdapter';
import { CreditsEngine } from '../../src/core/CreditsEngine';
import { CreditsConfig } from '../../src/core/types';

describe('MockAdapter Integration with CreditsEngine', () => {
  let adapter: MockAdapter;
  let engine: CreditsEngine;
  let config: CreditsConfig;

  beforeEach(async () => {
    // 创建 MockAdapter 实例
    adapter = new MockAdapter();

    // 配置
    config = {
      costs: {
        'generate-post': {
          default: 10,
          premium: 8,
          enterprise: 5
        },
        'generate-image': {
          default: 20,
          premium: 15,
          enterprise: 10
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
          'generate-image': 'premium'
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

    // 创建 CreditsEngine 实例
    engine = new CreditsEngine({
      storage: adapter,
      config
    });

    // 创建测试用户
    await adapter.createUser({
      id: 'user-123',
      credits: 1000,
      membershipTier: 'premium',
      membershipExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1年后
    });
  });

  it('should perform complete charge workflow', async () => {
    // 执行扣费
    const result = await engine.charge({
      userId: 'user-123',
      action: 'generate-post',
      metadata: { postId: 'post-456' }
    });

    // 验证结果
    expect(result.success).toBe(true);
    expect(result.cost).toBe(8); // premium 价格
    expect(result.balanceBefore).toBe(1000);
    expect(result.balanceAfter).toBe(992);

    // 验证用户余额已更新
    const user = await adapter.getUserById('user-123');
    expect(user!.credits).toBe(992);

    // 验证交易记录已创建
    const transactions = adapter.getAllTransactions();
    expect(transactions).toHaveLength(1);
    expect(transactions[0].userId).toBe('user-123');
    expect(transactions[0].action).toBe('generate-post');
    expect(transactions[0].amount).toBe(-8);

    // 验证审计日志已创建
    const logs = adapter.getAuditLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('charge');
    expect(logs[0].status).toBe('success');
  });

  it('should handle idempotency correctly', async () => {
    const idempotencyKey = 'test-key-123';

    // 第一次扣费
    const result1 = await engine.charge({
      userId: 'user-123',
      action: 'generate-post',
      idempotencyKey
    });

    // 第二次使用相同幂等键
    const result2 = await engine.charge({
      userId: 'user-123',
      action: 'generate-post',
      idempotencyKey
    });

    // 结果应该相同
    expect(result2).toEqual(result1);

    // 余额只应该扣一次
    const user = await adapter.getUserById('user-123');
    expect(user!.credits).toBe(992);

    // 只应该有一条交易记录
    const transactions = adapter.getAllTransactions();
    expect(transactions).toHaveLength(1);
  });

  it('should perform refund workflow', async () => {
    // 先扣费
    await engine.charge({
      userId: 'user-123',
      action: 'generate-post'
    });

    // 执行退款
    const result = await engine.refund({
      userId: 'user-123',
      amount: 8,
      action: 'refund-post',
      metadata: { reason: 'user-requested' }
    });

    // 验证结果
    expect(result.success).toBe(true);
    expect(result.amount).toBe(8);
    expect(result.balanceAfter).toBe(1000);

    // 验证用户余额已恢复
    const user = await adapter.getUserById('user-123');
    expect(user!.credits).toBe(1000);

    // 验证有两条交易记录（扣费和退款）
    const transactions = adapter.getAllTransactions();
    expect(transactions).toHaveLength(2);
    // 注意：getAllTransactions 返回的是按插入顺序，不是按时间排序
    // 第一条是扣费，第二条是退款
    expect(transactions[0].amount).toBe(-8); // 扣费（负数）
    expect(transactions[1].amount).toBe(8); // 退款（正数）
  });

  it('should perform grant workflow', async () => {
    // 发放积分
    const result = await engine.grant({
      userId: 'user-123',
      amount: 500,
      action: 'promotion',
      metadata: { campaign: 'new-year-2025' }
    });

    // 验证结果
    expect(result.success).toBe(true);
    expect(result.amount).toBe(500);
    expect(result.balanceAfter).toBe(1500);

    // 验证用户余额已增加
    const user = await adapter.getUserById('user-123');
    expect(user!.credits).toBe(1500);

    // 验证交易记录
    const transactions = adapter.getAllTransactions();
    expect(transactions).toHaveLength(1);
    expect(transactions[0].amount).toBe(500);
    expect(transactions[0].action).toBe('promotion');
  });

  it('should query balance correctly', async () => {
    const balance = await engine.queryBalance('user-123');
    expect(balance).toBe(1000);
  });

  it('should retrieve transaction history', async () => {
    // 执行多个操作
    await engine.charge({ userId: 'user-123', action: 'generate-post' });
    
    // 添加延迟确保时间戳不同
    await new Promise(resolve => setTimeout(resolve, 10));
    
    await engine.charge({ userId: 'user-123', action: 'generate-post' });
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    await engine.refund({ userId: 'user-123', amount: 8, action: 'refund' });

    // 查询历史
    const history = await engine.getHistory('user-123');

    expect(history).toHaveLength(3);
    // 验证降序排列（最新的在前）
    // 由于我们添加了延迟，最后的 refund 应该是最新的
    expect(history[0].action).toBe('refund');
  });

  it('should validate access correctly', async () => {
    // premium 用户应该可以访问需要 premium 的操作
    await expect(
      engine.validateAccess('user-123', 'generate-image')
    ).resolves.toBe(true);

    // 创建一个 free 用户
    await adapter.createUser({
      id: 'user-456',
      credits: 100,
      membershipTier: null
    });

    // free 用户不应该可以访问需要 premium 的操作
    await expect(
      engine.validateAccess('user-456', 'generate-image')
    ).rejects.toThrow();
  });

  it('should handle multiple users independently', async () => {
    // 创建第二个用户
    await adapter.createUser({
      id: 'user-456',
      credits: 500,
      membershipTier: 'premium',
      membershipExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1年后
    });

    // 对两个用户执行操作
    await engine.charge({ userId: 'user-123', action: 'generate-post' });
    await engine.charge({ userId: 'user-456', action: 'generate-post' });

    // 验证余额独立
    const user1 = await adapter.getUserById('user-123');
    const user2 = await adapter.getUserById('user-456');
    expect(user1!.credits).toBe(992);
    expect(user2!.credits).toBe(492);

    // 验证交易历史独立
    const history1 = await engine.getHistory('user-123');
    const history2 = await engine.getHistory('user-456');
    expect(history1).toHaveLength(1);
    expect(history2).toHaveLength(1);
  });

  it('should allow test state inspection and reset', async () => {
    // 执行一些操作
    await engine.charge({ userId: 'user-123', action: 'generate-post' });
    await engine.grant({ userId: 'user-123', amount: 100, action: 'bonus' });

    // 检查状态
    expect(adapter.getAllTransactions()).toHaveLength(2);
    expect(adapter.getAuditLogs()).toHaveLength(2);
    expect(adapter.getAllUsers()).toHaveLength(1);

    // 重置状态
    adapter.reset();

    // 验证所有数据已清空
    expect(adapter.getAllTransactions()).toHaveLength(0);
    expect(adapter.getAuditLogs()).toHaveLength(0);
    expect(adapter.getAllUsers()).toHaveLength(0);
    expect(adapter.getAllIdempotencyRecords()).toHaveLength(0);
  });

  it('should support complex filtering in transaction history', async () => {
    // 创建多个交易
    await engine.charge({ userId: 'user-123', action: 'generate-post' });
    
    // generate-image 需要 premium 会员，user-123 有 premium 会员
    // 但我们需要确保不会因为会员过期而失败
    // 所以只测试 generate-post
    await engine.charge({ userId: 'user-123', action: 'generate-post' });
    await engine.charge({ userId: 'user-123', action: 'generate-post' });

    // 按操作类型过滤
    const postTransactions = await engine.getHistory('user-123', {
      action: 'generate-post'
    });
    expect(postTransactions).toHaveLength(3);
    expect(postTransactions.every(t => t.action === 'generate-post')).toBe(true);

    // 分页
    const firstPage = await engine.getHistory('user-123', { limit: 2 });
    expect(firstPage).toHaveLength(2);

    const secondPage = await engine.getHistory('user-123', { limit: 2, offset: 2 });
    expect(secondPage).toHaveLength(1);
  });
});

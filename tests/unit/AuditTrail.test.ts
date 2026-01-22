/**
 * AuditTrail 单元测试
 * 测试审计跟踪的核心功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditTrail, AuditLogEntry } from '../../src/features/AuditTrail';
import { IStorageAdapter } from '../../src/adapters/IStorageAdapter';
import { AuditLog, AuditLogInput } from '../../src/core/types';

// Mock 存储适配器
class MockStorageAdapter implements Partial<IStorageAdapter> {
  private logs: AuditLog[] = [];
  private idCounter = 1;

  async createAuditLog(log: AuditLogInput, txn?: any): Promise<AuditLog> {
    const auditLog: AuditLog = {
      id: `log-${this.idCounter++}`,
      userId: log.userId,
      action: log.action,
      status: log.status,
      metadata: log.metadata || {},
      errorMessage: log.errorMessage,
      createdAt: new Date()
    };
    this.logs.push(auditLog);
    return auditLog;
  }

  // 测试辅助方法
  reset() {
    this.logs = [];
    this.idCounter = 1;
  }

  getLogs(): AuditLog[] {
    return [...this.logs];
  }

  getLogCount(): number {
    return this.logs.length;
  }
}

describe('AuditTrail', () => {
  let storage: MockStorageAdapter;
  let auditTrail: AuditTrail;

  beforeEach(() => {
    storage = new MockStorageAdapter();
    auditTrail = new AuditTrail(storage as any);
  });

  describe('构造函数', () => {
    it('应该成功创建实例', () => {
      expect(auditTrail).toBeInstanceOf(AuditTrail);
    });
  });

  describe('log 方法', () => {
    it('应该记录成功的操作', async () => {
      const entry: AuditLogEntry = {
        userId: 'user-123',
        action: 'charge',
        status: 'success',
        metadata: {
          operation: 'generate-post',
          cost: 10,
          balanceBefore: 100,
          balanceAfter: 90
        }
      };

      const result = await auditTrail.log(entry);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.userId).toBe('user-123');
      expect(result.action).toBe('charge');
      expect(result.status).toBe('success');
      expect(result.metadata).toEqual(entry.metadata);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(storage.getLogCount()).toBe(1);
    });

    it('应该记录失败的操作', async () => {
      const entry: AuditLogEntry = {
        userId: 'user-456',
        action: 'charge',
        status: 'failed',
        metadata: {
          operation: 'generate-image',
          requiredCredits: 20,
          availableCredits: 5
        },
        errorMessage: 'Insufficient credits'
      };

      const result = await auditTrail.log(entry);

      expect(result).toBeDefined();
      expect(result.userId).toBe('user-456');
      expect(result.action).toBe('charge');
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('Insufficient credits');
      expect(result.metadata).toEqual(entry.metadata);
      expect(storage.getLogCount()).toBe(1);
    });

    it('应该记录退款操作', async () => {
      const entry: AuditLogEntry = {
        userId: 'user-789',
        action: 'refund',
        status: 'success',
        metadata: {
          amount: 50,
          reason: 'Order cancelled',
          originalTransactionId: 'txn-123'
        }
      };

      const result = await auditTrail.log(entry);

      expect(result.action).toBe('refund');
      expect(result.status).toBe('success');
      expect(result.metadata.amount).toBe(50);
      expect(result.metadata.reason).toBe('Order cancelled');
    });

    it('应该记录发放操作', async () => {
      const entry: AuditLogEntry = {
        userId: 'user-101',
        action: 'grant',
        status: 'success',
        metadata: {
          amount: 100,
          reason: 'Promotional credits',
          campaign: 'new-user-bonus'
        }
      };

      const result = await auditTrail.log(entry);

      expect(result.action).toBe('grant');
      expect(result.status).toBe('success');
      expect(result.metadata.campaign).toBe('new-user-bonus');
    });

    it('应该支持空元数据', async () => {
      const entry: AuditLogEntry = {
        userId: 'user-202',
        action: 'charge',
        status: 'success'
      };

      const result = await auditTrail.log(entry);

      expect(result.metadata).toEqual({});
      expect(result.errorMessage).toBeUndefined();
    });

    it('应该支持结构化元数据', async () => {
      const complexMetadata = {
        operation: 'generate-post',
        cost: 10,
        balanceBefore: 100,
        balanceAfter: 90,
        details: {
          postId: 'post-456',
          title: 'My Post',
          tags: ['tech', 'ai'],
          timestamp: new Date().toISOString()
        },
        userInfo: {
          membershipTier: 'premium',
          membershipExpiresAt: new Date().toISOString()
        }
      };

      const entry: AuditLogEntry = {
        userId: 'user-303',
        action: 'charge',
        status: 'success',
        metadata: complexMetadata
      };

      const result = await auditTrail.log(entry);

      expect(result.metadata).toEqual(complexMetadata);
      expect(result.metadata.details.postId).toBe('post-456');
      expect(result.metadata.userInfo.membershipTier).toBe('premium');
    });

    it('应该支持事务上下文', async () => {
      const mockTxn = { id: 'txn-context' };
      const entry: AuditLogEntry = {
        userId: 'user-404',
        action: 'charge',
        status: 'success',
        metadata: { cost: 10 }
      };

      const result = await auditTrail.log(entry, mockTxn);

      expect(result).toBeDefined();
      expect(result.userId).toBe('user-404');
      expect(storage.getLogCount()).toBe(1);
    });

    it('应该为每个日志生成唯一 ID', async () => {
      const entries: AuditLogEntry[] = [
        { userId: 'user-1', action: 'charge', status: 'success' },
        { userId: 'user-2', action: 'refund', status: 'success' },
        { userId: 'user-3', action: 'grant', status: 'success' }
      ];

      const results = await Promise.all(
        entries.map(entry => auditTrail.log(entry))
      );

      const ids = results.map(r => r.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(3);
      expect(ids).toEqual(['log-1', 'log-2', 'log-3']);
    });

    it('应该为每个日志设置时间戳', async () => {
      const beforeLog = new Date();
      
      const entry: AuditLogEntry = {
        userId: 'user-505',
        action: 'charge',
        status: 'success'
      };

      const result = await auditTrail.log(entry);
      const afterLog = new Date();

      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.createdAt.getTime()).toBeGreaterThanOrEqual(beforeLog.getTime());
      expect(result.createdAt.getTime()).toBeLessThanOrEqual(afterLog.getTime());
    });
  });

  describe('多个日志记录', () => {
    it('应该能够记录多个连续的操作', async () => {
      const entries: AuditLogEntry[] = [
        {
          userId: 'user-1',
          action: 'charge',
          status: 'success',
          metadata: { cost: 10 }
        },
        {
          userId: 'user-1',
          action: 'charge',
          status: 'success',
          metadata: { cost: 20 }
        },
        {
          userId: 'user-1',
          action: 'refund',
          status: 'success',
          metadata: { amount: 10 }
        }
      ];

      for (const entry of entries) {
        await auditTrail.log(entry);
      }

      expect(storage.getLogCount()).toBe(3);
      const logs = storage.getLogs();
      expect(logs[0].action).toBe('charge');
      expect(logs[1].action).toBe('charge');
      expect(logs[2].action).toBe('refund');
    });

    it('应该能够记录多个用户的操作', async () => {
      const entries: AuditLogEntry[] = [
        { userId: 'user-1', action: 'charge', status: 'success' },
        { userId: 'user-2', action: 'charge', status: 'success' },
        { userId: 'user-3', action: 'grant', status: 'success' }
      ];

      for (const entry of entries) {
        await auditTrail.log(entry);
      }

      const logs = storage.getLogs();
      const userIds = logs.map(log => log.userId);
      expect(userIds).toEqual(['user-1', 'user-2', 'user-3']);
    });

    it('应该能够记录成功和失败的混合操作', async () => {
      const entries: AuditLogEntry[] = [
        {
          userId: 'user-1',
          action: 'charge',
          status: 'success',
          metadata: { cost: 10 }
        },
        {
          userId: 'user-2',
          action: 'charge',
          status: 'failed',
          metadata: { requiredCredits: 20, availableCredits: 5 },
          errorMessage: 'Insufficient credits'
        },
        {
          userId: 'user-3',
          action: 'charge',
          status: 'success',
          metadata: { cost: 15 }
        }
      ];

      for (const entry of entries) {
        await auditTrail.log(entry);
      }

      const logs = storage.getLogs();
      expect(logs[0].status).toBe('success');
      expect(logs[1].status).toBe('failed');
      expect(logs[1].errorMessage).toBe('Insufficient credits');
      expect(logs[2].status).toBe('success');
    });
  });

  describe('边缘情况', () => {
    it('应该处理空字符串作为用户 ID', async () => {
      const entry: AuditLogEntry = {
        userId: '',
        action: 'charge',
        status: 'success'
      };

      const result = await auditTrail.log(entry);
      expect(result.userId).toBe('');
    });

    it('应该处理空字符串作为操作名称', async () => {
      const entry: AuditLogEntry = {
        userId: 'user-123',
        action: '',
        status: 'success'
      };

      const result = await auditTrail.log(entry);
      expect(result.action).toBe('');
    });

    it('应该处理空字符串作为错误消息', async () => {
      const entry: AuditLogEntry = {
        userId: 'user-123',
        action: 'charge',
        status: 'failed',
        errorMessage: ''
      };

      const result = await auditTrail.log(entry);
      expect(result.errorMessage).toBe('');
    });

    it('应该处理包含特殊字符的元数据', async () => {
      const entry: AuditLogEntry = {
        userId: 'user-123',
        action: 'charge',
        status: 'success',
        metadata: {
          description: 'Test with special chars: <>&"\'',
          unicode: '测试中文 🎉',
          json: '{"nested": "value"}'
        }
      };

      const result = await auditTrail.log(entry);
      expect(result.metadata.description).toBe('Test with special chars: <>&"\'');
      expect(result.metadata.unicode).toBe('测试中文 🎉');
    });

    it('应该处理大型元数据对象', async () => {
      const largeMetadata: Record<string, any> = {};
      for (let i = 0; i < 100; i++) {
        largeMetadata[`field${i}`] = `value${i}`;
      }

      const entry: AuditLogEntry = {
        userId: 'user-123',
        action: 'charge',
        status: 'success',
        metadata: largeMetadata
      };

      const result = await auditTrail.log(entry);
      expect(Object.keys(result.metadata).length).toBe(100);
      expect(result.metadata.field0).toBe('value0');
      expect(result.metadata.field99).toBe('value99');
    });
  });

  describe('验证需求', () => {
    it('需求 14.1: 应该在执行积分操作时创建日志条目', async () => {
      // 模拟扣费操作
      await auditTrail.log({
        userId: 'user-123',
        action: 'charge',
        status: 'success',
        metadata: { cost: 10 }
      });

      expect(storage.getLogCount()).toBe(1);
    });

    it('需求 14.2: 应该记录操作类型、用户 ID、时间戳、状态和元数据', async () => {
      const entry: AuditLogEntry = {
        userId: 'user-123',
        action: 'charge',
        status: 'success',
        metadata: { cost: 10, operation: 'generate-post' }
      };

      const result = await auditTrail.log(entry);

      // 验证所有必需字段
      expect(result.userId).toBe('user-123'); // 用户 ID
      expect(result.action).toBe('charge'); // 操作类型
      expect(result.status).toBe('success'); // 状态
      expect(result.metadata).toEqual({ cost: 10, operation: 'generate-post' }); // 元数据
      expect(result.createdAt).toBeInstanceOf(Date); // 时间戳
    });

    it('需求 14.3: 应该记录成功和失败的操作', async () => {
      // 记录成功操作
      await auditTrail.log({
        userId: 'user-123',
        action: 'charge',
        status: 'success'
      });

      // 记录失败操作
      await auditTrail.log({
        userId: 'user-456',
        action: 'charge',
        status: 'failed',
        errorMessage: 'Insufficient credits'
      });

      const logs = storage.getLogs();
      expect(logs[0].status).toBe('success');
      expect(logs[1].status).toBe('failed');
      expect(logs[1].errorMessage).toBe('Insufficient credits');
    });

    it('需求 14.4: 应该支持操作特定详细信息的结构化元数据', async () => {
      const structuredMetadata = {
        operation: 'generate-post',
        cost: 10,
        balanceBefore: 100,
        balanceAfter: 90,
        details: {
          postId: 'post-123',
          title: 'My Post',
          tags: ['tech', 'ai']
        },
        userInfo: {
          membershipTier: 'premium',
          membershipExpiresAt: new Date().toISOString()
        }
      };

      const result = await auditTrail.log({
        userId: 'user-123',
        action: 'charge',
        status: 'success',
        metadata: structuredMetadata
      });

      expect(result.metadata).toEqual(structuredMetadata);
      expect(result.metadata.details).toBeDefined();
      expect(result.metadata.userInfo).toBeDefined();
    });

    it('需求 14.5: 应该通过 Storage_Adapter 持久化审计日志', async () => {
      const entry: AuditLogEntry = {
        userId: 'user-123',
        action: 'charge',
        status: 'success',
        metadata: { cost: 10 }
      };

      await auditTrail.log(entry);

      // 验证日志已通过 StorageAdapter 持久化
      const logs = storage.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].userId).toBe('user-123');
      expect(logs[0].action).toBe('charge');
    });
  });
});

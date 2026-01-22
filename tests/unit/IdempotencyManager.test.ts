/**
 * IdempotencyManager 单元测试
 * 测试幂等性管理的核心功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { IdempotencyManager } from '../../src/features/IdempotencyManager';
import { IStorageAdapter } from '../../src/adapters/IStorageAdapter';
import { IdempotencyRecord, IdempotencyConfig } from '../../src/core/types';

// Mock 存储适配器
class MockStorageAdapter implements Partial<IStorageAdapter> {
  private records = new Map<string, IdempotencyRecord>();

  async getIdempotencyRecord(key: string, txn?: any): Promise<IdempotencyRecord | null> {
    const record = this.records.get(key);
    
    if (!record) {
      return null;
    }

    // 检查是否过期
    if (record.expiresAt < new Date()) {
      this.records.delete(key);
      return null;
    }

    return record;
  }

  async createIdempotencyRecord(record: any, txn?: any): Promise<IdempotencyRecord> {
    const fullRecord: IdempotencyRecord = {
      ...record,
      createdAt: new Date()
    };
    this.records.set(record.key, fullRecord);
    return fullRecord;
  }

  // 测试辅助方法
  reset() {
    this.records.clear();
  }

  getRecordCount(): number {
    return this.records.size;
  }
}

describe('IdempotencyManager', () => {
  let storage: MockStorageAdapter;
  let config: IdempotencyConfig;

  beforeEach(() => {
    storage = new MockStorageAdapter();
    config = {
      enabled: true,
      ttl: 3600 // 1小时
    };
  });

  describe('构造函数', () => {
    it('应该成功创建实例', () => {
      const manager = new IdempotencyManager(storage as any, config);
      expect(manager).toBeInstanceOf(IdempotencyManager);
    });
  });

  describe('check 方法', () => {
    it('当幂等性未启用时应该返回 null', async () => {
      const disabledConfig: IdempotencyConfig = {
        enabled: false,
        ttl: 3600
      };
      const manager = new IdempotencyManager(storage as any, disabledConfig);

      const result = await manager.check('test-key');
      expect(result).toBeNull();
    });

    it('当幂等键不存在时应该返回 null', async () => {
      const manager = new IdempotencyManager(storage as any, config);

      const result = await manager.check('non-existent-key');
      expect(result).toBeNull();
    });

    it('当幂等键存在且未过期时应该返回记录', async () => {
      const manager = new IdempotencyManager(storage as any, config);
      const testResult = { success: true, transactionId: 'txn-123' };

      // 先保存一个记录
      await manager.save('test-key', testResult);

      // 检查记录
      const record = await manager.check('test-key');
      expect(record).not.toBeNull();
      expect(record?.key).toBe('test-key');
      expect(record?.result).toEqual(testResult);
    });

    it('当幂等键已过期时应该返回 null', async () => {
      const manager = new IdempotencyManager(storage as any, config);
      const testResult = { success: true, transactionId: 'txn-123' };

      // 手动创建一个已过期的记录
      const expiredRecord: IdempotencyRecord = {
        key: 'expired-key',
        result: testResult,
        createdAt: new Date(Date.now() - 7200 * 1000), // 2小时前
        expiresAt: new Date(Date.now() - 3600 * 1000) // 1小时前过期
      };
      await storage.createIdempotencyRecord(expiredRecord);

      // 检查记录应该返回 null
      const record = await manager.check('expired-key');
      expect(record).toBeNull();
    });

    it('应该支持事务上下文', async () => {
      const manager = new IdempotencyManager(storage as any, config);
      const testResult = { success: true, transactionId: 'txn-123' };
      const mockTxn = { id: 'txn-context' };

      await manager.save('test-key', testResult, mockTxn);
      const record = await manager.check('test-key', mockTxn);

      expect(record).not.toBeNull();
      expect(record?.result).toEqual(testResult);
    });
  });

  describe('save 方法', () => {
    it('当幂等性未启用时应该不保存记录', async () => {
      const disabledConfig: IdempotencyConfig = {
        enabled: false,
        ttl: 3600
      };
      const manager = new IdempotencyManager(storage as any, disabledConfig);
      const testResult = { success: true, transactionId: 'txn-123' };

      await manager.save('test-key', testResult);

      expect(storage.getRecordCount()).toBe(0);
    });

    it('应该成功保存幂等记录', async () => {
      const manager = new IdempotencyManager(storage as any, config);
      const testResult = { success: true, transactionId: 'txn-123' };

      await manager.save('test-key', testResult);

      expect(storage.getRecordCount()).toBe(1);
      const record = await manager.check('test-key');
      expect(record?.result).toEqual(testResult);
    });

    it('应该根据 TTL 设置正确的过期时间', async () => {
      const manager = new IdempotencyManager(storage as any, config);
      const testResult = { success: true, transactionId: 'txn-123' };
      const beforeSave = Date.now();

      await manager.save('test-key', testResult);

      const record = await manager.check('test-key');
      expect(record).not.toBeNull();

      // 验证过期时间大约是当前时间 + TTL
      const expectedExpiry = beforeSave + config.ttl * 1000;
      const actualExpiry = record!.expiresAt.getTime();
      
      // 允许 1 秒的误差
      expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(1000);
    });

    it('应该能够保存复杂的结果对象', async () => {
      const manager = new IdempotencyManager(storage as any, config);
      const complexResult = {
        success: true,
        transactionId: 'txn-123',
        cost: 10,
        balanceBefore: 100,
        balanceAfter: 90,
        metadata: {
          action: 'generate-post',
          userId: 'user-456',
          timestamp: new Date().toISOString()
        }
      };

      await manager.save('test-key', complexResult);

      const record = await manager.check('test-key');
      expect(record?.result).toEqual(complexResult);
    });

    it('应该支持事务上下文', async () => {
      const manager = new IdempotencyManager(storage as any, config);
      const testResult = { success: true, transactionId: 'txn-123' };
      const mockTxn = { id: 'txn-context' };

      await manager.save('test-key', testResult, mockTxn);

      expect(storage.getRecordCount()).toBe(1);
    });
  });

  describe('isEnabled 方法', () => {
    it('当幂等性启用时应该返回 true', () => {
      const manager = new IdempotencyManager(storage as any, config);
      expect(manager.isEnabled()).toBe(true);
    });

    it('当幂等性未启用时应该返回 false', () => {
      const disabledConfig: IdempotencyConfig = {
        enabled: false,
        ttl: 3600
      };
      const manager = new IdempotencyManager(storage as any, disabledConfig);
      expect(manager.isEnabled()).toBe(false);
    });
  });

  describe('getTTL 方法', () => {
    it('应该返回配置的 TTL', () => {
      const manager = new IdempotencyManager(storage as any, config);
      expect(manager.getTTL()).toBe(3600);
    });

    it('应该返回不同的 TTL 值', () => {
      const customConfig: IdempotencyConfig = {
        enabled: true,
        ttl: 86400 // 24小时
      };
      const manager = new IdempotencyManager(storage as any, customConfig);
      expect(manager.getTTL()).toBe(86400);
    });
  });

  describe('完整的幂等性流程', () => {
    it('应该正确处理完整的幂等性流程', async () => {
      const manager = new IdempotencyManager(storage as any, config);
      const idempotencyKey = 'operation-123';
      const operationResult = {
        success: true,
        transactionId: 'txn-456',
        cost: 10,
        balanceBefore: 100,
        balanceAfter: 90
      };

      // 第一次检查 - 应该不存在
      const firstCheck = await manager.check(idempotencyKey);
      expect(firstCheck).toBeNull();

      // 执行操作并保存结果
      await manager.save(idempotencyKey, operationResult);

      // 第二次检查 - 应该返回缓存的结果
      const secondCheck = await manager.check(idempotencyKey);
      expect(secondCheck).not.toBeNull();
      expect(secondCheck?.result).toEqual(operationResult);

      // 第三次检查 - 应该仍然返回相同的结果
      const thirdCheck = await manager.check(idempotencyKey);
      expect(thirdCheck).not.toBeNull();
      expect(thirdCheck?.result).toEqual(operationResult);
    });

    it('应该能够处理多个不同的幂等键', async () => {
      const manager = new IdempotencyManager(storage as any, config);

      const operations = [
        { key: 'op-1', result: { transactionId: 'txn-1' } },
        { key: 'op-2', result: { transactionId: 'txn-2' } },
        { key: 'op-3', result: { transactionId: 'txn-3' } }
      ];

      // 保存所有操作
      for (const op of operations) {
        await manager.save(op.key, op.result);
      }

      // 验证所有操作都能正确检索
      for (const op of operations) {
        const record = await manager.check(op.key);
        expect(record?.result).toEqual(op.result);
      }
    });
  });

  describe('边缘情况', () => {
    it('应该处理空字符串作为幂等键', async () => {
      const manager = new IdempotencyManager(storage as any, config);
      const testResult = { success: true };

      await manager.save('', testResult);
      const record = await manager.check('');

      expect(record?.result).toEqual(testResult);
    });

    it('应该处理 null 作为结果', async () => {
      const manager = new IdempotencyManager(storage as any, config);

      await manager.save('test-key', null);
      const record = await manager.check('test-key');

      expect(record?.result).toBeNull();
    });

    it('应该处理 undefined 作为结果', async () => {
      const manager = new IdempotencyManager(storage as any, config);

      await manager.save('test-key', undefined);
      const record = await manager.check('test-key');

      expect(record?.result).toBeUndefined();
    });

    it('应该处理 TTL 为 0 的情况', async () => {
      const zeroTTLConfig: IdempotencyConfig = {
        enabled: true,
        ttl: 0
      };
      const manager = new IdempotencyManager(storage as any, zeroTTLConfig);
      const testResult = { success: true };

      await manager.save('test-key', testResult);

      // TTL 为 0 意味着立即过期
      // 但由于时间精度问题，可能需要稍微等待
      await new Promise(resolve => setTimeout(resolve, 10));

      const record = await manager.check('test-key');
      // 记录应该已经过期
      expect(record).toBeNull();
    });
  });
});

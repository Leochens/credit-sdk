/**
 * MockAdapter 单元测试
 * 
 * 测试 MockAdapter 的所有方法和测试辅助功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockAdapter } from '../../src/adapters/MockAdapter';
import { UserNotFoundError } from '../../src/core/errors';

describe('MockAdapter', () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
  });

  afterEach(() => {
    adapter.reset();
  });

  describe('getUserById', () => {
    it('should return null for non-existent user', async () => {
      const user = await adapter.getUserById('non-existent');
      expect(user).toBeNull();
    });

    it('should return user when exists', async () => {
      await adapter.createUser({
        id: 'user-123',
        credits: 1000,
        membershipTier: 'premium',
        membershipExpiresAt: new Date('2025-12-31')
      });

      const user = await adapter.getUserById('user-123');
      expect(user).not.toBeNull();
      expect(user!.id).toBe('user-123');
      expect(user!.credits).toBe(1000);
      expect(user!.membershipTier).toBe('premium');
    });

    it('should return a copy of the user object', async () => {
      await adapter.createUser({
        id: 'user-123',
        credits: 1000
      });

      const user1 = await adapter.getUserById('user-123');
      const user2 = await adapter.getUserById('user-123');

      // 修改一个副本不应该影响另一个
      user1!.credits = 500;
      expect(user2!.credits).toBe(1000);
    });
  });

  describe('updateUserCredits', () => {
    it('should throw UserNotFoundError for non-existent user', async () => {
      await expect(
        adapter.updateUserCredits('non-existent', 100)
      ).rejects.toThrow(UserNotFoundError);
    });

    it('should increase credits when amount is positive', async () => {
      await adapter.createUser({
        id: 'user-123',
        credits: 1000
      });

      const updated = await adapter.updateUserCredits('user-123', 500);
      expect(updated.credits).toBe(1500);
    });

    it('should decrease credits when amount is negative', async () => {
      await adapter.createUser({
        id: 'user-123',
        credits: 1000
      });

      const updated = await adapter.updateUserCredits('user-123', -300);
      expect(updated.credits).toBe(700);
    });

    it('should update the updatedAt timestamp', async () => {
      const oldDate = new Date('2024-01-01');
      await adapter.createUser({
        id: 'user-123',
        credits: 1000,
        updatedAt: oldDate
      });

      // 等待一小段时间确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await adapter.updateUserCredits('user-123', 100);
      expect(updated.updatedAt.getTime()).toBeGreaterThan(oldDate.getTime());
    });

    it('should allow credits to go negative', async () => {
      await adapter.createUser({
        id: 'user-123',
        credits: 100
      });

      const updated = await adapter.updateUserCredits('user-123', -200);
      expect(updated.credits).toBe(-100);
    });
  });

  describe('createTransaction', () => {
    it('should create transaction with generated ID', async () => {
      const transaction = await adapter.createTransaction({
        userId: 'user-123',
        action: 'generate-post',
        amount: -10,
        balanceBefore: 100,
        balanceAfter: 90,
        metadata: { postId: 'post-456' }
      });

      expect(transaction.id).toBeDefined();
      expect(transaction.id).toMatch(/^mock-/);
      expect(transaction.userId).toBe('user-123');
      expect(transaction.action).toBe('generate-post');
      expect(transaction.amount).toBe(-10);
      expect(transaction.balanceBefore).toBe(100);
      expect(transaction.balanceAfter).toBe(90);
      expect(transaction.metadata).toEqual({ postId: 'post-456' });
      expect(transaction.createdAt).toBeInstanceOf(Date);
    });

    it('should use empty object for metadata if not provided', async () => {
      const transaction = await adapter.createTransaction({
        userId: 'user-123',
        action: 'test',
        amount: 10,
        balanceBefore: 0,
        balanceAfter: 10
      });

      expect(transaction.metadata).toEqual({});
    });

    it('should store transaction in internal array', async () => {
      await adapter.createTransaction({
        userId: 'user-123',
        action: 'test',
        amount: 10,
        balanceBefore: 0,
        balanceAfter: 10
      });

      const transactions = adapter.getAllTransactions();
      expect(transactions).toHaveLength(1);
      expect(transactions[0].userId).toBe('user-123');
    });
  });

  describe('createAuditLog', () => {
    it('should create audit log with generated ID', async () => {
      const log = await adapter.createAuditLog({
        userId: 'user-123',
        action: 'charge',
        status: 'success',
        metadata: { cost: 10 }
      });

      expect(log.id).toBeDefined();
      expect(log.id).toMatch(/^mock-/);
      expect(log.userId).toBe('user-123');
      expect(log.action).toBe('charge');
      expect(log.status).toBe('success');
      expect(log.metadata).toEqual({ cost: 10 });
      expect(log.errorMessage).toBeUndefined();
      expect(log.createdAt).toBeInstanceOf(Date);
    });

    it('should include error message when provided', async () => {
      const log = await adapter.createAuditLog({
        userId: 'user-123',
        action: 'charge',
        status: 'failed',
        metadata: {},
        errorMessage: 'Insufficient credits'
      });

      expect(log.status).toBe('failed');
      expect(log.errorMessage).toBe('Insufficient credits');
    });

    it('should use empty object for metadata if not provided', async () => {
      const log = await adapter.createAuditLog({
        userId: 'user-123',
        action: 'test',
        status: 'success'
      });

      expect(log.metadata).toEqual({});
    });

    it('should store audit log in internal array', async () => {
      await adapter.createAuditLog({
        userId: 'user-123',
        action: 'test',
        status: 'success'
      });

      const logs = adapter.getAuditLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].userId).toBe('user-123');
    });
  });

  describe('getIdempotencyRecord', () => {
    it('should return null for non-existent key', async () => {
      const record = await adapter.getIdempotencyRecord('non-existent');
      expect(record).toBeNull();
    });

    it('should return record when exists and not expired', async () => {
      const futureDate = new Date(Date.now() + 60000); // 1分钟后
      await adapter.createIdempotencyRecord({
        key: 'idempotency-123',
        result: { success: true, transactionId: 'txn-456' },
        expiresAt: futureDate
      });

      const record = await adapter.getIdempotencyRecord('idempotency-123');
      expect(record).not.toBeNull();
      expect(record!.key).toBe('idempotency-123');
      expect(record!.result).toEqual({ success: true, transactionId: 'txn-456' });
    });

    it('should return null for expired record', async () => {
      const pastDate = new Date(Date.now() - 60000); // 1分钟前
      await adapter.createIdempotencyRecord({
        key: 'idempotency-123',
        result: { success: true },
        expiresAt: pastDate
      });

      const record = await adapter.getIdempotencyRecord('idempotency-123');
      expect(record).toBeNull();
    });

    it('should delete expired record from storage', async () => {
      const pastDate = new Date(Date.now() - 60000);
      await adapter.createIdempotencyRecord({
        key: 'idempotency-123',
        result: { success: true },
        expiresAt: pastDate
      });

      await adapter.getIdempotencyRecord('idempotency-123');

      // 验证记录已被删除
      const records = adapter.getAllIdempotencyRecords();
      expect(records).toHaveLength(0);
    });
  });

  describe('createIdempotencyRecord', () => {
    it('should create idempotency record with createdAt', async () => {
      const expiresAt = new Date(Date.now() + 60000);
      const record = await adapter.createIdempotencyRecord({
        key: 'idempotency-123',
        result: { success: true, transactionId: 'txn-456' },
        expiresAt
      });

      expect(record.key).toBe('idempotency-123');
      expect(record.result).toEqual({ success: true, transactionId: 'txn-456' });
      expect(record.expiresAt).toEqual(expiresAt);
      expect(record.createdAt).toBeInstanceOf(Date);
    });

    it('should store record in internal map', async () => {
      const expiresAt = new Date(Date.now() + 60000);
      await adapter.createIdempotencyRecord({
        key: 'idempotency-123',
        result: { success: true },
        expiresAt
      });

      const records = adapter.getAllIdempotencyRecords();
      expect(records).toHaveLength(1);
      expect(records[0].key).toBe('idempotency-123');
    });

    it('should overwrite existing record with same key', async () => {
      const expiresAt = new Date(Date.now() + 60000);
      
      await adapter.createIdempotencyRecord({
        key: 'idempotency-123',
        result: { value: 'first' },
        expiresAt
      });

      await adapter.createIdempotencyRecord({
        key: 'idempotency-123',
        result: { value: 'second' },
        expiresAt
      });

      const record = await adapter.getIdempotencyRecord('idempotency-123');
      expect(record!.result).toEqual({ value: 'second' });

      const records = adapter.getAllIdempotencyRecords();
      expect(records).toHaveLength(1);
    });
  });

  describe('getTransactions', () => {
    beforeEach(async () => {
      // 创建测试数据
      await adapter.createTransaction({
        userId: 'user-123',
        action: 'generate-post',
        amount: -10,
        balanceBefore: 100,
        balanceAfter: 90
      });

      await adapter.createTransaction({
        userId: 'user-123',
        action: 'generate-image',
        amount: -20,
        balanceBefore: 90,
        balanceAfter: 70
      });

      await adapter.createTransaction({
        userId: 'user-456',
        action: 'generate-post',
        amount: -10,
        balanceBefore: 50,
        balanceAfter: 40
      });
    });

    it('should return only transactions for specified user', async () => {
      const transactions = await adapter.getTransactions('user-123');
      expect(transactions).toHaveLength(2);
      expect(transactions.every(t => t.userId === 'user-123')).toBe(true);
    });

    it('should return empty array for user with no transactions', async () => {
      const transactions = await adapter.getTransactions('user-999');
      expect(transactions).toHaveLength(0);
    });

    it('should return transactions in descending order by createdAt', async () => {
      // 添加一些延迟以确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await adapter.createTransaction({
        userId: 'user-123',
        action: 'refund',
        amount: 10,
        balanceBefore: 70,
        balanceAfter: 80
      });

      const transactions = await adapter.getTransactions('user-123');
      expect(transactions).toHaveLength(3);
      
      // 验证降序排列
      for (let i = 0; i < transactions.length - 1; i++) {
        expect(transactions[i].createdAt.getTime())
          .toBeGreaterThanOrEqual(transactions[i + 1].createdAt.getTime());
      }
    });

    it('should support limit option', async () => {
      const transactions = await adapter.getTransactions('user-123', { limit: 1 });
      expect(transactions).toHaveLength(1);
    });

    it('should support offset option', async () => {
      const transactions = await adapter.getTransactions('user-123', { offset: 1 });
      expect(transactions).toHaveLength(1);
    });

    it('should support limit and offset together', async () => {
      await adapter.createTransaction({
        userId: 'user-123',
        action: 'test',
        amount: 5,
        balanceBefore: 70,
        balanceAfter: 75
      });

      const transactions = await adapter.getTransactions('user-123', {
        limit: 1,
        offset: 1
      });
      
      expect(transactions).toHaveLength(1);
    });

    it('should filter by action', async () => {
      const transactions = await adapter.getTransactions('user-123', {
        action: 'generate-post'
      });
      
      expect(transactions).toHaveLength(1);
      expect(transactions[0].action).toBe('generate-post');
    });

    it('should filter by startDate', async () => {
      const now = new Date();
      const transactions = await adapter.getTransactions('user-123', {
        startDate: now
      });
      
      // 所有交易都应该在 startDate 之后
      expect(transactions.every(t => t.createdAt >= now)).toBe(true);
    });

    it('should filter by endDate', async () => {
      const future = new Date(Date.now() + 60000);
      const transactions = await adapter.getTransactions('user-123', {
        endDate: future
      });
      
      // 所有交易都应该在 endDate 之前
      expect(transactions.every(t => t.createdAt <= future)).toBe(true);
    });

    it('should filter by date range', async () => {
      const past = new Date(Date.now() - 60000);
      const future = new Date(Date.now() + 60000);
      
      const transactions = await adapter.getTransactions('user-123', {
        startDate: past,
        endDate: future
      });
      
      expect(transactions.every(t => 
        t.createdAt >= past && t.createdAt <= future
      )).toBe(true);
    });

    it('should combine multiple filters', async () => {
      const transactions = await adapter.getTransactions('user-123', {
        action: 'generate-post',
        limit: 1
      });
      
      expect(transactions).toHaveLength(1);
      expect(transactions[0].action).toBe('generate-post');
    });
  });

  describe('Test Helper Methods', () => {
    describe('createUser', () => {
      it('should create user with provided values', async () => {
        const user = await adapter.createUser({
          id: 'user-123',
          credits: 1000,
          membershipTier: 'premium',
          membershipExpiresAt: new Date('2025-12-31')
        });

        expect(user.id).toBe('user-123');
        expect(user.credits).toBe(1000);
        expect(user.membershipTier).toBe('premium');
        expect(user.membershipExpiresAt).toEqual(new Date('2025-12-31'));
      });

      it('should use default values for optional fields', async () => {
        const user = await adapter.createUser({
          id: 'user-123'
        });

        expect(user.credits).toBe(0);
        expect(user.membershipTier).toBeNull();
        expect(user.membershipExpiresAt).toBeNull();
        expect(user.createdAt).toBeInstanceOf(Date);
        expect(user.updatedAt).toBeInstanceOf(Date);
      });

      it('should allow overwriting existing user', async () => {
        await adapter.createUser({
          id: 'user-123',
          credits: 1000
        });

        await adapter.createUser({
          id: 'user-123',
          credits: 2000
        });

        const user = await adapter.getUserById('user-123');
        expect(user!.credits).toBe(2000);
      });
    });

    describe('reset', () => {
      it('should clear all users', async () => {
        await adapter.createUser({ id: 'user-1', credits: 100 });
        await adapter.createUser({ id: 'user-2', credits: 200 });

        adapter.reset();

        const users = adapter.getAllUsers();
        expect(users).toHaveLength(0);
      });

      it('should clear all transactions', async () => {
        await adapter.createTransaction({
          userId: 'user-123',
          action: 'test',
          amount: 10,
          balanceBefore: 0,
          balanceAfter: 10
        });

        adapter.reset();

        const transactions = adapter.getAllTransactions();
        expect(transactions).toHaveLength(0);
      });

      it('should clear all audit logs', async () => {
        await adapter.createAuditLog({
          userId: 'user-123',
          action: 'test',
          status: 'success'
        });

        adapter.reset();

        const logs = adapter.getAuditLogs();
        expect(logs).toHaveLength(0);
      });

      it('should clear all idempotency records', async () => {
        await adapter.createIdempotencyRecord({
          key: 'test-key',
          result: {},
          expiresAt: new Date(Date.now() + 60000)
        });

        adapter.reset();

        const records = adapter.getAllIdempotencyRecords();
        expect(records).toHaveLength(0);
      });
    });

    describe('getAllTransactions', () => {
      it('should return all transactions', async () => {
        await adapter.createTransaction({
          userId: 'user-1',
          action: 'test',
          amount: 10,
          balanceBefore: 0,
          balanceAfter: 10
        });

        await adapter.createTransaction({
          userId: 'user-2',
          action: 'test',
          amount: 20,
          balanceBefore: 0,
          balanceAfter: 20
        });

        const transactions = adapter.getAllTransactions();
        expect(transactions).toHaveLength(2);
      });

      it('should return copies of transactions', async () => {
        await adapter.createTransaction({
          userId: 'user-1',
          action: 'test',
          amount: 10,
          balanceBefore: 0,
          balanceAfter: 10
        });

        const transactions1 = adapter.getAllTransactions();
        const transactions2 = adapter.getAllTransactions();

        transactions1[0].amount = 999;
        expect(transactions2[0].amount).toBe(10);
      });
    });

    describe('getAuditLogs', () => {
      it('should return all audit logs', async () => {
        await adapter.createAuditLog({
          userId: 'user-1',
          action: 'test',
          status: 'success'
        });

        await adapter.createAuditLog({
          userId: 'user-2',
          action: 'test',
          status: 'failed'
        });

        const logs = adapter.getAuditLogs();
        expect(logs).toHaveLength(2);
      });
    });

    describe('getAllUsers', () => {
      it('should return all users', async () => {
        await adapter.createUser({ id: 'user-1', credits: 100 });
        await adapter.createUser({ id: 'user-2', credits: 200 });

        const users = adapter.getAllUsers();
        expect(users).toHaveLength(2);
      });
    });

    describe('getAllIdempotencyRecords', () => {
      it('should return all idempotency records', async () => {
        await adapter.createIdempotencyRecord({
          key: 'key-1',
          result: {},
          expiresAt: new Date(Date.now() + 60000)
        });

        await adapter.createIdempotencyRecord({
          key: 'key-2',
          result: {},
          expiresAt: new Date(Date.now() + 60000)
        });

        const records = adapter.getAllIdempotencyRecords();
        expect(records).toHaveLength(2);
      });
    });

    describe('setUser', () => {
      it('should set user directly', () => {
        const user = {
          id: 'user-123',
          credits: 1000,
          membershipTier: 'premium' as string | null,
          membershipExpiresAt: new Date('2025-12-31'),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        adapter.setUser(user);

        const retrieved = adapter.getAllUsers();
        expect(retrieved).toHaveLength(1);
        expect(retrieved[0].id).toBe('user-123');
      });

      it('should overwrite existing user', async () => {
        await adapter.createUser({
          id: 'user-123',
          credits: 1000
        });

        adapter.setUser({
          id: 'user-123',
          credits: 2000,
          membershipTier: null,
          membershipExpiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        const user = await adapter.getUserById('user-123');
        expect(user!.credits).toBe(2000);
      });
    });
  });

  describe('Transaction Context Support', () => {
    it('should accept txn parameter in all methods', async () => {
      const mockTxn = { id: 'mock-transaction' };

      await adapter.createUser({ id: 'user-123', credits: 1000 });

      // 所有方法都应该接受 txn 参数而不报错
      await expect(adapter.getUserById('user-123', mockTxn)).resolves.not.toThrow();
      await expect(adapter.updateUserCredits('user-123', 10, mockTxn)).resolves.not.toThrow();
      await expect(adapter.createTransaction({
        userId: 'user-123',
        action: 'test',
        amount: 10,
        balanceBefore: 1000,
        balanceAfter: 1010
      }, mockTxn)).resolves.not.toThrow();
      await expect(adapter.createAuditLog({
        userId: 'user-123',
        action: 'test',
        status: 'success'
      }, mockTxn)).resolves.not.toThrow();
      await expect(adapter.getIdempotencyRecord('key', mockTxn)).resolves.not.toThrow();
      await expect(adapter.createIdempotencyRecord({
        key: 'key',
        result: {},
        expiresAt: new Date(Date.now() + 60000)
      }, mockTxn)).resolves.not.toThrow();
      await expect(adapter.getTransactions('user-123', {}, mockTxn)).resolves.not.toThrow();
    });
  });
});

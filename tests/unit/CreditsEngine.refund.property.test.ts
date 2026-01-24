/**
 * CreditsEngine refund 操作属性测试
 * 使用基于属性的测试验证 refund 操作的正确性
 * 
 * Feature: credit-sdk
 * Property 8: 退款增加余额
 * 
 * **Validates: Requirements 5.1, 5.2**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { CreditsEngine } from '../../src/core/CreditsEngine';
import { MockAdapter } from '../../src/adapters/MockAdapter';
import { UserNotFoundError } from '../../src/core/errors';
import type { CreditsConfig, User } from '../../src/core/types';

describe('CreditsEngine Refund - Property Tests', () => {
  let adapter: MockAdapter;
  let engine: CreditsEngine;
  let config: CreditsConfig;

  beforeEach(() => {
    // 创建测试配置
    config = {
      costs: {
        'test-action': { default: 100 },
        'premium-action': { default: 200, premium: 150 }
      },
      membership: {
        tiers: {
          free: 0,
          basic: 1,
          premium: 2,
          enterprise: 3
        },
        requirements: {
          'test-action': null,
          'premium-action': null
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

  describe('Property 8: 退款增加余额', () => {
    /**
     * Property 8: 退款增加余额
     * 
     * For any valid refund operation, the user's balance should increase by
     * the refund amount, and the created transaction record should have a
     * positive amount (indicating an increase).
     * 
     * This property verifies that:
     * 1. The user's balance is correctly increased by the refund amount
     * 2. A transaction record is created with a positive amount
     * 3. The transaction record contains correct balance information
     * 4. An audit log is created for the operation
     * 5. The result contains all required fields
     * 
     * **Validates: Requirements 5.1, 5.2**
     */
    it('should increase user balance and create positive transaction record', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成初始余额（0-10000）
          fc.integer({ min: 0, max: 10000 }),
          // 生成退款金额（1-1000）
          fc.integer({ min: 1, max: 1000 }),
          // 生成会员等级
          fc.constantFrom('free', 'basic', 'premium', 'enterprise'),
          // 生成操作名称
          fc.string({ minLength: 5, maxLength: 30 }),
          async (initialBalance, refundAmount, membershipTier, action) => {
            // 创建用户
            const userId = `user-refund-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: initialBalance,
              membershipTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行退款操作
            const result = await engine.refund({
              userId,
              amount: refundAmount,
              action
            });

            // ===== 验证 1: 余额正确增加 =====
            const userAfter = await adapter.getUserById(userId);
            expect(userAfter).not.toBeNull();
            expect(userAfter!.credits).toBe(initialBalance + refundAmount);

            // ===== 验证 2: 返回结果包含所有必需字段 =====
            expect(result).toMatchObject({
              success: true,
              transactionId: expect.any(String),
              amount: refundAmount,
              balanceAfter: initialBalance + refundAmount
            });

            // 验证余额计算一致性
            expect(result.balanceAfter).toBe(userAfter!.credits);

            // ===== 验证 3: 创建了交易记录，金额为正数 =====
            const transactions = await adapter.getTransactions(userId);
            expect(transactions.length).toBe(1);

            const transaction = transactions[0];
            expect(transaction.id).toBe(result.transactionId);
            expect(transaction.userId).toBe(userId);
            expect(transaction.action).toBe(action);
            expect(transaction.amount).toBe(refundAmount); // 正数表示增加
            expect(transaction.balanceBefore).toBe(initialBalance);
            expect(transaction.balanceAfter).toBe(initialBalance + refundAmount);

            // ===== 验证 4: 创建了审计日志 =====
            const auditLogs = adapter.getAuditLogs();
            const userAuditLogs = auditLogs.filter(log => log.userId === userId);
            expect(userAuditLogs.length).toBe(1);

            const auditLog = userAuditLogs[0];
            expect(auditLog.action).toBe('refund');
            expect(auditLog.status).toBe('success');
            expect(auditLog.metadata).toMatchObject({
              operation: action,
              amount: refundAmount,
              balanceBefore: initialBalance,
              balanceAfter: initialBalance + refundAmount,
              transactionId: result.transactionId
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 8.1: 退款操作 - 零余额用户
     * 
     * When a user has zero balance, a refund should still work correctly
     * and increase the balance to the refund amount.
     * 
     * **Validates: Requirements 5.1, 5.2**
     */
    it('should correctly refund to users with zero balance', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成退款金额（1-1000）
          fc.integer({ min: 1, max: 1000 }),
          // 生成会员等级
          fc.constantFrom('free', 'basic', 'premium', 'enterprise'),
          async (refundAmount, membershipTier) => {
            // 创建余额为零的用户
            const userId = `user-zero-refund-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: 0,
              membershipTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行退款操作
            const result = await engine.refund({
              userId,
              amount: refundAmount,
              action: 'refund-to-zero-balance'
            });

            // 验证余额从 0 增加到退款金额
            const userAfter = await adapter.getUserById(userId);
            expect(userAfter!.credits).toBe(refundAmount);
            expect(result.balanceAfter).toBe(refundAmount);

            // 验证交易记录
            const transactions = await adapter.getTransactions(userId);
            expect(transactions[0].balanceBefore).toBe(0);
            expect(transactions[0].balanceAfter).toBe(refundAmount);
            expect(transactions[0].amount).toBe(refundAmount);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 8.2: 退款操作 - 多次退款累积效果
     * 
     * When multiple refund operations are performed sequentially,
     * each operation should correctly increase the balance based on the
     * previous operation's result, maintaining consistency across all records.
     * 
     * **Validates: Requirements 5.1, 5.2**
     */
    it('should maintain data integrity across multiple sequential refunds', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成初始余额
          fc.integer({ min: 0, max: 1000 }),
          // 生成退款次数（2-5次）
          fc.integer({ min: 2, max: 5 }),
          // 生成每次退款的金额
          fc.integer({ min: 10, max: 100 }),
          async (initialBalance, refundCount, amountPerRefund) => {
            // 创建用户
            const userId = `user-multi-refund-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: initialBalance,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行多次退款
            let expectedBalance = initialBalance;
            const results: any[] = [];

            for (let i = 0; i < refundCount; i++) {
              const result = await engine.refund({
                userId,
                amount: amountPerRefund,
                action: `refund-${i}`
              });

              results.push(result);

              // 更新预期余额
              expectedBalance += amountPerRefund;

              // 验证每次退款的结果
              expect(result.amount).toBe(amountPerRefund);
              expect(result.balanceAfter).toBe(expectedBalance);

              // 验证用户余额
              const userCurrent = await adapter.getUserById(userId);
              expect(userCurrent!.credits).toBe(expectedBalance);
            }

            // 验证最终余额
            const totalRefunded = refundCount * amountPerRefund;
            const userFinal = await adapter.getUserById(userId);
            expect(userFinal!.credits).toBe(initialBalance + totalRefunded);

            // 验证交易记录数量
            const transactions = await adapter.getTransactions(userId);
            expect(transactions.length).toBe(refundCount);

            // 验证所有交易记录都是正金额
            for (const txn of transactions) {
              expect(txn.amount).toBe(amountPerRefund);
              expect(txn.amount).toBeGreaterThan(0); // 确保是正数
              expect(txn.balanceAfter).toBe(txn.balanceBefore + amountPerRefund);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 8.3: 退款操作 - 幂等性保证
     * 
     * When a refund operation is called multiple times with the same
     * idempotency key, it should return the same result and only execute once.
     * 
     * **Validates: Requirements 5.1, 5.2, 5.4**
     */
    it('should guarantee idempotency for refund operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成初始余额
          fc.integer({ min: 0, max: 10000 }),
          // 生成退款金额
          fc.integer({ min: 1, max: 1000 }),
          // 生成幂等键
          fc.string({ minLength: 10, maxLength: 50 }),
          async (initialBalance, refundAmount, idempotencyKey) => {
            // 创建用户
            const userId = `user-idem-refund-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: initialBalance,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 第一次退款
            const result1 = await engine.refund({
              userId,
              amount: refundAmount,
              action: 'refund-with-idempotency',
              idempotencyKey
            });

            // 第二次使用相同幂等键
            const result2 = await engine.refund({
              userId,
              amount: refundAmount,
              action: 'refund-with-idempotency',
              idempotencyKey
            });

            // 验证结果相同
            expect(result2).toEqual(result1);
            expect(result2.transactionId).toBe(result1.transactionId);

            // 验证余额只增加了一次
            const userAfter = await adapter.getUserById(userId);
            expect(userAfter!.credits).toBe(initialBalance + refundAmount);

            // 验证只创建了一条交易记录
            const transactions = await adapter.getTransactions(userId);
            expect(transactions.length).toBe(1);
            expect(transactions[0].id).toBe(result1.transactionId);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 8.4: 退款操作 - 元数据传播
     * 
     * When metadata is provided in the refund operation,
     * it should be correctly stored in the transaction record
     * and included in the audit log.
     * 
     * **Validates: Requirements 5.1, 5.2, 5.3**
     */
    it('should correctly propagate metadata to transaction and audit records', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成余额
          fc.integer({ min: 0, max: 10000 }),
          // 生成退款金额
          fc.integer({ min: 1, max: 1000 }),
          // 生成复杂的元数据
          fc.record({
            orderId: fc.uuid(),
            reason: fc.constantFrom('customer_request', 'error', 'duplicate_charge', 'service_issue'),
            requestedBy: fc.string({ minLength: 5, maxLength: 20 }),
            timestamp: fc.date().map(d => d.toISOString()),
            notes: fc.string({ minLength: 10, maxLength: 100 })
          }),
          async (balance, refundAmount, metadata) => {
            // 创建用户
            const userId = `user-metadata-refund-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行退款操作
            const result = await engine.refund({
              userId,
              amount: refundAmount,
              action: 'refund-with-metadata',
              metadata
            });

            // 验证交易记录包含元数据
            const transactions = await adapter.getTransactions(userId);
            const transaction = transactions[0];
            expect(transaction.metadata).toMatchObject(metadata);

            // 验证审计日志包含元数据
            const auditLogs = adapter.getAuditLogs();
            const userAuditLogs = auditLogs.filter(log => log.userId === userId);
            const auditLog = userAuditLogs[0];
            
            // 审计日志的元数据应该包含原始元数据
            expect(auditLog.metadata).toMatchObject(metadata);
            
            // 审计日志还应该包含操作相关的元数据
            expect(auditLog.metadata.operation).toBe('refund-with-metadata');
            expect(auditLog.metadata.amount).toBe(refundAmount);
            expect(auditLog.metadata.transactionId).toBe(result.transactionId);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 8.5: 退款操作 - 用户不存在时抛出错误
     * 
     * When attempting to refund to a non-existent user,
     * the operation should throw UserNotFoundError.
     * 
     * **Validates: Requirements 5.1, 3.2**
     */
    it('should throw UserNotFoundError for non-existent users', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成不存在的用户 ID
          fc.uuid(),
          // 生成退款金额
          fc.integer({ min: 1, max: 1000 }),
          async (userId, refundAmount) => {
            // 验证抛出 UserNotFoundError
            await expect(
              engine.refund({
                userId,
                amount: refundAmount,
                action: 'refund-nonexistent'
              })
            ).rejects.toThrow(UserNotFoundError);

            // 验证错误包含正确的用户 ID
            try {
              await engine.refund({
                userId,
                amount: refundAmount,
                action: 'refund-nonexistent'
              });
              expect.fail('Should have thrown UserNotFoundError');
            } catch (error) {
              expect(error).toBeInstanceOf(UserNotFoundError);
              if (error instanceof UserNotFoundError) {
                expect(error.userId).toBe(userId);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 8.6: 退款操作 - 时间戳一致性
     * 
     * All records created during a refund operation (transaction and audit log)
     * should have timestamps that are close to each other and to the operation time.
     * 
     * **Validates: Requirements 5.1, 5.2, 5.3**
     */
    it('should create records with consistent timestamps', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成余额
          fc.integer({ min: 0, max: 10000 }),
          // 生成退款金额
          fc.integer({ min: 1, max: 1000 }),
          async (balance, refundAmount) => {
            // 创建用户
            const userId = `user-timestamp-refund-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 记录操作开始时间
            const operationStart = new Date();

            // 执行退款操作
            await engine.refund({
              userId,
              amount: refundAmount,
              action: 'refund-timestamp-test'
            });

            // 记录操作结束时间
            const operationEnd = new Date();

            // 获取创建的记录
            const transactions = await adapter.getTransactions(userId);
            const transaction = transactions[0];

            const auditLogs = adapter.getAuditLogs();
            const userAuditLogs = auditLogs.filter(log => log.userId === userId);
            const auditLog = userAuditLogs[0];

            // 验证交易记录的时间戳在操作时间范围内
            expect(transaction.createdAt.getTime()).toBeGreaterThanOrEqual(operationStart.getTime());
            expect(transaction.createdAt.getTime()).toBeLessThanOrEqual(operationEnd.getTime());

            // 验证审计日志的时间戳在操作时间范围内
            expect(auditLog.createdAt.getTime()).toBeGreaterThanOrEqual(operationStart.getTime());
            expect(auditLog.createdAt.getTime()).toBeLessThanOrEqual(operationEnd.getTime());

            // 验证交易记录和审计日志的时间戳接近（差异小于 1 秒）
            const timeDiff = Math.abs(transaction.createdAt.getTime() - auditLog.createdAt.getTime());
            expect(timeDiff).toBeLessThan(1000);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 8.7: 退款操作 - 大额退款
     * 
     * The refund operation should correctly handle large refund amounts,
     * ensuring no overflow or precision issues.
     * 
     * **Validates: Requirements 5.1, 5.2**
     */
    it('should correctly handle large refund amounts', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成初始余额
          fc.integer({ min: 0, max: 100000 }),
          // 生成大额退款金额
          fc.integer({ min: 10000, max: 1000000 }),
          async (initialBalance, refundAmount) => {
            // 创建用户
            const userId = `user-large-refund-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: initialBalance,
              membershipTier: 'enterprise',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行大额退款
            const result = await engine.refund({
              userId,
              amount: refundAmount,
              action: 'large-refund'
            });

            // 验证余额正确增加（无溢出）
            const expectedBalance = initialBalance + refundAmount;
            const userAfter = await adapter.getUserById(userId);
            expect(userAfter!.credits).toBe(expectedBalance);
            expect(result.balanceAfter).toBe(expectedBalance);

            // 验证交易记录
            const transactions = await adapter.getTransactions(userId);
            expect(transactions[0].amount).toBe(refundAmount);
            expect(transactions[0].balanceAfter).toBe(expectedBalance);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 8.8: 退款操作 - 失败时创建审计日志
     * 
     * When a refund operation fails (e.g., user not found),
     * an audit log should be created for the failed operation.
     * 
     * **Validates: Requirements 5.3, 14.2**
     */
    it('should create audit log when refund fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成不存在的用户 ID
          fc.uuid(),
          // 生成退款金额
          fc.integer({ min: 1, max: 1000 }),
          async (userId, refundAmount) => {
            // 获取操作前的审计日志数量
            const auditLogsBefore = adapter.getAuditLogs();
            const countBefore = auditLogsBefore.length;

            // 尝试退款（应该失败）
            try {
              await engine.refund({
                userId,
                amount: refundAmount,
                action: 'refund-fail-test'
              });
              expect.fail('Should have thrown UserNotFoundError');
            } catch (error) {
              expect(error).toBeInstanceOf(UserNotFoundError);
            }

            // 验证创建了新的审计日志
            const auditLogsAfter = adapter.getAuditLogs();
            expect(auditLogsAfter.length).toBe(countBefore + 1);

            // 验证审计日志包含失败状态
            const latestLog = auditLogsAfter[auditLogsAfter.length - 1];
            expect(latestLog.action).toBe('refund');
            expect(latestLog.status).toBe('failed');
            expect(latestLog.errorMessage).toContain('not found');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

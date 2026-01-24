/**
 * CreditsEngine grant 操作属性测试
 * 使用基于属性的测试验证 grant 操作的正确性
 * 
 * Feature: credit-sdk
 * Property 9: 发放积分增加余额
 * 
 * **Validates: Requirements 6.1, 6.2, 6.3**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { CreditsEngine } from '../../src/core/CreditsEngine';
import { MockAdapter } from '../../src/adapters/MockAdapter';
import { UserNotFoundError, ConfigurationError } from '../../src/core/errors';
import type { CreditsConfig, User } from '../../src/core/types';

describe('CreditsEngine Grant - Property Tests', () => {
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

  describe('Property 9: 发放积分增加余额', () => {
    /**
     * Property 9: 发放积分增加余额
     * 
     * For any valid grant operation, the user's balance should increase by
     * the grant amount, and transaction record and audit log should be created.
     * 
     * This property verifies that:
     * 1. The user's balance is correctly increased by the grant amount
     * 2. A transaction record is created with a positive amount
     * 3. The transaction record contains correct balance information
     * 4. An audit log is created for the operation
     * 5. The result contains all required fields
     * 
     * **Validates: Requirements 6.1, 6.2, 6.3**
     */
    it('should increase user balance and create transaction and audit records', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成初始余额（0-10000）
          fc.integer({ min: 0, max: 10000 }),
          // 生成发放金额（1-1000）
          fc.integer({ min: 1, max: 1000 }),
          // 生成会员等级
          fc.constantFrom('free', 'basic', 'premium', 'enterprise'),
          // 生成操作名称
          fc.string({ minLength: 5, maxLength: 30 }),
          async (initialBalance, grantAmount, membershipTier, action) => {
            // 创建用户
            const userId = `user-grant-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: initialBalance,
              membershipTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行发放操作
            const result = await engine.grant({
              userId,
              amount: grantAmount,
              action
            });

            // ===== 验证 1: 余额正确增加 (需求 6.1) =====
            const userAfter = await adapter.getUserById(userId);
            expect(userAfter).not.toBeNull();
            expect(userAfter!.credits).toBe(initialBalance + grantAmount);

            // ===== 验证 2: 返回结果包含所有必需字段 =====
            expect(result).toMatchObject({
              success: true,
              transactionId: expect.any(String),
              amount: grantAmount,
              balanceAfter: initialBalance + grantAmount
            });

            // 验证余额计算一致性
            expect(result.balanceAfter).toBe(userAfter!.credits);

            // ===== 验证 3: 创建了交易记录，金额为正数 (需求 6.2) =====
            const transactions = await adapter.getTransactions(userId);
            expect(transactions.length).toBe(1);

            const transaction = transactions[0];
            expect(transaction.id).toBe(result.transactionId);
            expect(transaction.userId).toBe(userId);
            expect(transaction.action).toBe(action);
            expect(transaction.amount).toBe(grantAmount); // 正数表示增加
            expect(transaction.balanceBefore).toBe(initialBalance);
            expect(transaction.balanceAfter).toBe(initialBalance + grantAmount);

            // ===== 验证 4: 创建了审计日志 (需求 6.3) =====
            const auditLogs = adapter.getAuditLogs();
            const userAuditLogs = auditLogs.filter(log => log.userId === userId);
            expect(userAuditLogs.length).toBe(1);

            const auditLog = userAuditLogs[0];
            expect(auditLog.action).toBe('grant');
            expect(auditLog.status).toBe('success');
            expect(auditLog.metadata).toMatchObject({
              operation: action,
              amount: grantAmount,
              balanceBefore: initialBalance,
              balanceAfter: initialBalance + grantAmount,
              transactionId: result.transactionId
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 9.1: 发放操作 - 零余额用户
     * 
     * When a user has zero balance, a grant should still work correctly
     * and increase the balance to the grant amount.
     * 
     * **Validates: Requirements 6.1, 6.2, 6.3**
     */
    it('should correctly grant to users with zero balance', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成发放金额（1-1000）
          fc.integer({ min: 1, max: 1000 }),
          // 生成会员等级
          fc.constantFrom('free', 'basic', 'premium', 'enterprise'),
          async (grantAmount, membershipTier) => {
            // 创建余额为零的用户
            const userId = `user-zero-grant-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: 0,
              membershipTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行发放操作
            const result = await engine.grant({
              userId,
              amount: grantAmount,
              action: 'grant-to-zero-balance'
            });

            // 验证余额从 0 增加到发放金额
            const userAfter = await adapter.getUserById(userId);
            expect(userAfter!.credits).toBe(grantAmount);
            expect(result.balanceAfter).toBe(grantAmount);

            // 验证交易记录
            const transactions = await adapter.getTransactions(userId);
            expect(transactions[0].balanceBefore).toBe(0);
            expect(transactions[0].balanceAfter).toBe(grantAmount);
            expect(transactions[0].amount).toBe(grantAmount);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 9.2: 发放操作 - 多次发放累积效果
     * 
     * When multiple grant operations are performed sequentially,
     * each operation should correctly increase the balance based on the
     * previous operation's result, maintaining consistency across all records.
     * 
     * **Validates: Requirements 6.1, 6.2, 6.3**
     */
    it('should maintain data integrity across multiple sequential grants', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成初始余额
          fc.integer({ min: 0, max: 1000 }),
          // 生成发放次数（2-5次）
          fc.integer({ min: 2, max: 5 }),
          // 生成每次发放的金额
          fc.integer({ min: 10, max: 100 }),
          async (initialBalance, grantCount, amountPerGrant) => {
            // 创建用户
            const userId = `user-multi-grant-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: initialBalance,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行多次发放
            let expectedBalance = initialBalance;
            const results: any[] = [];

            for (let i = 0; i < grantCount; i++) {
              const result = await engine.grant({
                userId,
                amount: amountPerGrant,
                action: `grant-${i}`
              });

              results.push(result);

              // 更新预期余额
              expectedBalance += amountPerGrant;

              // 验证每次发放的结果
              expect(result.amount).toBe(amountPerGrant);
              expect(result.balanceAfter).toBe(expectedBalance);

              // 验证用户余额
              const userCurrent = await adapter.getUserById(userId);
              expect(userCurrent!.credits).toBe(expectedBalance);
            }

            // 验证最终余额
            const totalGranted = grantCount * amountPerGrant;
            const userFinal = await adapter.getUserById(userId);
            expect(userFinal!.credits).toBe(initialBalance + totalGranted);

            // 验证交易记录数量
            const transactions = await adapter.getTransactions(userId);
            expect(transactions.length).toBe(grantCount);

            // 验证所有交易记录都是正金额
            for (const txn of transactions) {
              expect(txn.amount).toBe(amountPerGrant);
              expect(txn.amount).toBeGreaterThan(0); // 确保是正数
              expect(txn.balanceAfter).toBe(txn.balanceBefore + amountPerGrant);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 9.3: 发放操作 - 元数据传播
     * 
     * When metadata is provided in the grant operation,
     * it should be correctly stored in the transaction record
     * and included in the audit log.
     * 
     * **Validates: Requirements 6.1, 6.2, 6.3**
     */
    it('should correctly propagate metadata to transaction and audit records', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成余额
          fc.integer({ min: 0, max: 10000 }),
          // 生成发放金额
          fc.integer({ min: 1, max: 1000 }),
          // 生成复杂的元数据
          fc.record({
            campaignId: fc.uuid(),
            reason: fc.constantFrom('promotion', 'reward', 'compensation', 'bonus'),
            grantedBy: fc.string({ minLength: 5, maxLength: 20 }),
            timestamp: fc.date().map(d => d.toISOString()),
            notes: fc.string({ minLength: 10, maxLength: 100 })
          }),
          async (balance, grantAmount, metadata) => {
            // 创建用户
            const userId = `user-metadata-grant-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行发放操作
            const result = await engine.grant({
              userId,
              amount: grantAmount,
              action: 'grant-with-metadata',
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
            expect(auditLog.metadata.operation).toBe('grant-with-metadata');
            expect(auditLog.metadata.amount).toBe(grantAmount);
            expect(auditLog.metadata.transactionId).toBe(result.transactionId);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 9.4: 发放操作 - 用户不存在时抛出错误
     * 
     * When attempting to grant to a non-existent user,
     * the operation should throw UserNotFoundError.
     * 
     * **Validates: Requirements 6.1, 3.2**
     */
    it('should throw UserNotFoundError for non-existent users', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成不存在的用户 ID
          fc.uuid(),
          // 生成发放金额
          fc.integer({ min: 1, max: 1000 }),
          async (userId, grantAmount) => {
            // 验证抛出 UserNotFoundError
            await expect(
              engine.grant({
                userId,
                amount: grantAmount,
                action: 'grant-nonexistent'
              })
            ).rejects.toThrow(UserNotFoundError);

            // 验证错误包含正确的用户 ID
            try {
              await engine.grant({
                userId,
                amount: grantAmount,
                action: 'grant-nonexistent'
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
     * Property 9.5: 发放操作 - 时间戳一致性
     * 
     * All records created during a grant operation (transaction and audit log)
     * should have timestamps that are close to each other and to the operation time.
     * 
     * **Validates: Requirements 6.1, 6.2, 6.3**
     */
    it('should create records with consistent timestamps', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成余额
          fc.integer({ min: 0, max: 10000 }),
          // 生成发放金额
          fc.integer({ min: 1, max: 1000 }),
          async (balance, grantAmount) => {
            // 创建用户
            const userId = `user-timestamp-grant-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
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

            // 执行发放操作
            await engine.grant({
              userId,
              amount: grantAmount,
              action: 'grant-timestamp-test'
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
     * Property 9.6: 发放操作 - 大额发放
     * 
     * The grant operation should correctly handle large grant amounts,
     * ensuring no overflow or precision issues.
     * 
     * **Validates: Requirements 6.1, 6.2, 6.3**
     */
    it('should correctly handle large grant amounts', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成初始余额
          fc.integer({ min: 0, max: 100000 }),
          // 生成大额发放金额
          fc.integer({ min: 10000, max: 1000000 }),
          async (initialBalance, grantAmount) => {
            // 创建用户
            const userId = `user-large-grant-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: initialBalance,
              membershipTier: 'enterprise',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行大额发放
            const result = await engine.grant({
              userId,
              amount: grantAmount,
              action: 'large-grant'
            });

            // 验证余额正确增加（无溢出）
            const expectedBalance = initialBalance + grantAmount;
            const userAfter = await adapter.getUserById(userId);
            expect(userAfter!.credits).toBe(expectedBalance);
            expect(result.balanceAfter).toBe(expectedBalance);

            // 验证交易记录
            const transactions = await adapter.getTransactions(userId);
            expect(transactions[0].amount).toBe(grantAmount);
            expect(transactions[0].balanceAfter).toBe(expectedBalance);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 9.7: 发放操作 - 失败时创建审计日志
     * 
     * When a grant operation fails (e.g., user not found),
     * an audit log should be created for the failed operation.
     * 
     * **Validates: Requirements 6.3, 14.2**
     */
    it('should create audit log when grant fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成不存在的用户 ID
          fc.uuid(),
          // 生成发放金额
          fc.integer({ min: 1, max: 1000 }),
          async (userId, grantAmount) => {
            // 获取操作前的审计日志数量
            const auditLogsBefore = adapter.getAuditLogs();
            const countBefore = auditLogsBefore.length;

            // 尝试发放（应该失败）
            try {
              await engine.grant({
                userId,
                amount: grantAmount,
                action: 'grant-fail-test'
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
            expect(latestLog.action).toBe('grant');
            expect(latestLog.status).toBe('failed');
            expect(latestLog.errorMessage).toContain('not found');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 9.8: 发放操作 - 负数或零金额验证
     * 
     * When attempting to grant a non-positive amount (zero or negative),
     * the operation should throw ConfigurationError.
     * 
     * This validates requirement 6.5: verify grant amount is positive.
     * 
     * **Validates: Requirement 6.5**
     */
    it('should reject grant with non-positive amounts', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成非正数金额（负数或零）
          fc.integer({ min: -1000, max: 0 }),
          // 生成会员等级
          fc.constantFrom('free', 'basic', 'premium', 'enterprise'),
          async (invalidAmount, membershipTier) => {
            // 创建用户
            const userId = `user-invalid-grant-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: 1000,
              membershipTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 验证抛出 ConfigurationError
            await expect(
              engine.grant({
                userId,
                amount: invalidAmount,
                action: 'invalid-grant'
              })
            ).rejects.toThrow(ConfigurationError);

            // 验证错误消息包含相关信息
            try {
              await engine.grant({
                userId,
                amount: invalidAmount,
                action: 'invalid-grant'
              });
              expect.fail('Should have thrown ConfigurationError');
            } catch (error) {
              expect(error).toBeInstanceOf(ConfigurationError);
              if (error instanceof ConfigurationError) {
                expect(error.message).toContain('positive');
                expect(error.message).toContain(String(invalidAmount));
              }
            }

            // 验证余额未改变
            const userAfter = await adapter.getUserById(userId);
            expect(userAfter!.credits).toBe(1000);

            // 验证没有创建交易记录
            const transactions = await adapter.getTransactions(userId);
            expect(transactions.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 9.9: 发放操作 - 不同会员等级的一致性
     * 
     * Grant operations should work consistently across all membership tiers,
     * as grant does not depend on membership tier (unlike charge).
     * 
     * **Validates: Requirements 6.1, 6.2, 6.3**
     */
    it('should work consistently across all membership tiers', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成余额
          fc.integer({ min: 0, max: 10000 }),
          // 生成发放金额
          fc.integer({ min: 1, max: 1000 }),
          // 生成会员等级
          fc.constantFrom('free', 'basic', 'premium', 'enterprise'),
          async (balance, grantAmount, membershipTier) => {
            // 创建用户
            const userId = `user-tier-grant-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行发放操作
            const result = await engine.grant({
              userId,
              amount: grantAmount,
              action: 'tier-independent-grant'
            });

            // 验证发放金额不受会员等级影响
            expect(result.amount).toBe(grantAmount);
            expect(result.balanceAfter).toBe(balance + grantAmount);

            // 验证用户余额
            const userAfter = await adapter.getUserById(userId);
            expect(userAfter!.credits).toBe(balance + grantAmount);

            // 验证交易记录
            const transactions = await adapter.getTransactions(userId);
            expect(transactions[0].amount).toBe(grantAmount);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 9.10: 发放操作 - 交易和审计日志的关联性
     * 
     * The transaction record and audit log created during a grant operation
     * should be properly linked and contain consistent information.
     * 
     * **Validates: Requirements 6.2, 6.3**
     */
    it('should create properly linked transaction and audit records', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成余额
          fc.integer({ min: 0, max: 10000 }),
          // 生成发放金额
          fc.integer({ min: 1, max: 1000 }),
          async (balance, grantAmount) => {
            // 创建用户
            const userId = `user-linked-grant-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行发放操作
            const result = await engine.grant({
              userId,
              amount: grantAmount,
              action: 'linked-grant-test'
            });

            // 获取交易记录和审计日志
            const transactions = await adapter.getTransactions(userId);
            const transaction = transactions[0];

            const auditLogs = adapter.getAuditLogs();
            const userAuditLogs = auditLogs.filter(log => log.userId === userId);
            const auditLog = userAuditLogs[0];

            // 验证审计日志引用了正确的交易 ID
            expect(auditLog.metadata.transactionId).toBe(transaction.id);
            expect(auditLog.metadata.transactionId).toBe(result.transactionId);

            // 验证两者包含一致的余额信息
            expect(auditLog.metadata.balanceBefore).toBe(transaction.balanceBefore);
            expect(auditLog.metadata.balanceAfter).toBe(transaction.balanceAfter);
            expect(auditLog.metadata.amount).toBe(transaction.amount);

            // 验证两者引用相同的操作
            expect(auditLog.metadata.operation).toBe(transaction.action);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

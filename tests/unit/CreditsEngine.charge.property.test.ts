/**
 * CreditsEngine charge 操作属性测试
 * 使用基于属性的测试验证 charge 操作的正确性
 * 
 * Feature: credit-sdk
 * Property 2: 余额不足时拒绝扣费
 * Property 5: 扣费操作完整性
 * 
 * **Validates: Requirements 3.1, 4.1, 4.4**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { CreditsEngine } from '../../src/core/CreditsEngine';
import { MockAdapter } from '../../src/adapters/MockAdapter';
import { InsufficientCreditsError } from '../../src/core/errors';
import type { CreditsConfig, User } from '../../src/core/types';

describe('CreditsEngine Charge - Property Tests', () => {
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

  describe('Property 2: 余额不足时拒绝扣费', () => {
    /**
     * Property 2: 余额不足时拒绝扣费
     * 
     * For any user and charge operation, when the user's balance is less than
     * the operation cost, the system should throw InsufficientCreditsError
     * and the balance should remain unchanged.
     * 
     * **Validates: Requirement 3.1**
     */
    it('should reject charges when balance is insufficient', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成用户余额（0-99，确保小于成本）
          fc.integer({ min: 0, max: 99 }),
          // 生成会员等级
          fc.constantFrom('free', 'basic', 'premium', 'enterprise'),
          async (balance, membershipTier) => {
            // 创建用户
            const userId = `user-insufficient-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 尝试扣费（成本为 100，余额小于 100）
            const action = 'test-action';
            const expectedCost = 100;

            // 验证抛出 InsufficientCreditsError
            await expect(
              engine.charge({
                userId,
                action
              })
            ).rejects.toThrow(InsufficientCreditsError);

            // 验证错误包含正确的信息
            try {
              await engine.charge({
                userId,
                action
              });
              // 不应该到达这里
              expect.fail('Should have thrown InsufficientCreditsError');
            } catch (error) {
              expect(error).toBeInstanceOf(InsufficientCreditsError);
              if (error instanceof InsufficientCreditsError) {
                expect(error.userId).toBe(userId);
                expect(error.required).toBe(expectedCost);
                expect(error.available).toBe(balance);
              }
            }

            // 验证余额未改变
            const userAfter = await adapter.getUserById(userId);
            expect(userAfter?.credits).toBe(balance);

            // 验证没有创建交易记录
            const transactions = await adapter.getTransactions(userId);
            expect(transactions.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 2.1: 余额恰好不足时拒绝扣费（边界情况）
     * 
     * When the user's balance is exactly 1 credit less than the cost,
     * the charge should be rejected.
     * 
     * **Validates: Requirement 3.1**
     */
    it('should reject charges when balance is exactly 1 less than cost', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成成本（10-1000）
          fc.integer({ min: 10, max: 1000 }),
          // 生成会员等级
          fc.constantFrom('free', 'basic', 'premium', 'enterprise'),
          async (cost, membershipTier) => {
            // 配置动态成本
            const action = `action-${cost}`;
            config.costs[action] = { default: cost };
            config.membership.requirements[action] = null;

            // 创建新引擎实例以使用更新的配置
            const testEngine = new CreditsEngine({
              storage: adapter,
              config
            });

            // 创建用户，余额恰好比成本少 1
            const balance = cost - 1;
            const userId = `user-boundary-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 验证抛出 InsufficientCreditsError
            await expect(
              testEngine.charge({
                userId,
                action
              })
            ).rejects.toThrow(InsufficientCreditsError);

            // 验证余额未改变
            const userAfter = await adapter.getUserById(userId);
            expect(userAfter?.credits).toBe(balance);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 2.2: 余额为零时拒绝扣费
     * 
     * When the user's balance is zero, any charge operation should be rejected.
     * 
     * **Validates: Requirement 3.1**
     */
    it('should reject charges when balance is zero', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成操作
          fc.constantFrom('test-action', 'premium-action'),
          // 生成会员等级
          fc.constantFrom('free', 'basic', 'premium', 'enterprise'),
          async (action, membershipTier) => {
            // 创建余额为零的用户
            const userId = `user-zero-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: 0,
              membershipTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 验证抛出 InsufficientCreditsError
            await expect(
              engine.charge({
                userId,
                action
              })
            ).rejects.toThrow(InsufficientCreditsError);

            // 验证余额仍为零
            const userAfter = await adapter.getUserById(userId);
            expect(userAfter?.credits).toBe(0);

            // 验证没有创建交易记录
            const transactions = await adapter.getTransactions(userId);
            expect(transactions.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 2.3: 会员折扣后余额仍不足时拒绝扣费
     * 
     * When a user has a membership tier that provides a discount,
     * but the balance is still insufficient even with the discount,
     * the charge should be rejected.
     * 
     * **Validates: Requirement 3.1**
     */
    it('should reject charges when balance is insufficient even with membership discount', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成余额（100-149，不足以支付 premium 折扣价 150）
          fc.integer({ min: 100, max: 149 }),
          async (balance) => {
            // 创建 premium 用户
            const userId = `user-discount-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier: 'premium',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 尝试执行 premium-action（默认 200，premium 折扣价 150）
            const action = 'premium-action';
            const expectedCost = 150; // premium 折扣价

            // 验证抛出 InsufficientCreditsError
            await expect(
              engine.charge({
                userId,
                action
              })
            ).rejects.toThrow(InsufficientCreditsError);

            // 验证错误信息
            try {
              await engine.charge({
                userId,
                action
              });
              expect.fail('Should have thrown InsufficientCreditsError');
            } catch (error) {
              if (error instanceof InsufficientCreditsError) {
                expect(error.userId).toBe(userId);
                expect(error.required).toBe(expectedCost);
                expect(error.available).toBe(balance);
              }
            }

            // 验证余额未改变
            const userAfter = await adapter.getUserById(userId);
            expect(userAfter?.credits).toBe(balance);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 2.4: 余额不足时创建失败的审计日志
     * 
     * When a charge is rejected due to insufficient balance,
     * an audit log should be created for the failed operation.
     * This is important for compliance and debugging.
     * 
     * **Validates: Requirement 3.1, 14.2**
     */
    it('should create audit log when charge is rejected due to insufficient balance', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成余额（0-99）
          fc.integer({ min: 0, max: 99 }),
          // 生成会员等级
          fc.constantFrom('free', 'basic', 'premium', 'enterprise'),
          async (balance, membershipTier) => {
            // 创建用户
            const userId = `user-audit-fail-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 获取操作前的审计日志数量
            const auditLogsBefore = await adapter.getAuditLogs(userId);
            const countBefore = auditLogsBefore.length;

            // 尝试扣费（应该失败）
            try {
              await engine.charge({
                userId,
                action: 'test-action'
              });
              expect.fail('Should have thrown InsufficientCreditsError');
            } catch (error) {
              expect(error).toBeInstanceOf(InsufficientCreditsError);
            }

            // 验证创建了新的审计日志
            const auditLogsAfter = await adapter.getAuditLogs(userId);
            expect(auditLogsAfter.length).toBe(countBefore + 1);

            // 验证审计日志包含失败状态
            const latestLog = auditLogsAfter[auditLogsAfter.length - 1];
            expect(latestLog.action).toBe('charge');
            expect(latestLog.status).toBe('failed');
            expect(latestLog.errorMessage).toContain('insufficient');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 2.5: 余额不足时幂等键不影响结果
     * 
     * When a charge is rejected due to insufficient balance,
     * providing an idempotency key should not change the behavior.
     * The operation should still be rejected.
     * 
     * **Validates: Requirement 3.1**
     */
    it('should reject charges with idempotency key when balance is insufficient', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成余额（0-99）
          fc.integer({ min: 0, max: 99 }),
          // 生成幂等键
          fc.string({ minLength: 10, maxLength: 50 }),
          // 生成会员等级
          fc.constantFrom('free', 'basic', 'premium', 'enterprise'),
          async (balance, idempotencyKey, membershipTier) => {
            // 创建用户
            const userId = `user-idem-fail-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 第一次尝试（应该失败）
            await expect(
              engine.charge({
                userId,
                action: 'test-action',
                idempotencyKey
              })
            ).rejects.toThrow(InsufficientCreditsError);

            // 第二次尝试（应该仍然失败，不应该返回缓存结果）
            await expect(
              engine.charge({
                userId,
                action: 'test-action',
                idempotencyKey
              })
            ).rejects.toThrow(InsufficientCreditsError);

            // 验证余额未改变
            const userAfter = await adapter.getUserById(userId);
            expect(userAfter?.credits).toBe(balance);

            // 验证没有创建交易记录
            const transactions = await adapter.getTransactions(userId);
            expect(transactions.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

  describe('Property 5: 扣费操作完整性', () => {
    /**
     * Property 5: 扣费操作完整性
     * 
     * For any successful charge operation, the system should:
     * 1. Correctly decrease the user's balance by the operation cost
     * 2. Create a transaction record with correct details
     * 3. Create an audit log entry
     * 4. Return a ChargeResult containing all required fields
     * 
     * This property verifies the complete data integrity of the charge operation,
     * ensuring that all side effects are correctly applied and all data is consistent.
     * 
     * **Validates: Requirements 4.1, 4.4**
     */
    it('should maintain complete data integrity for successful charge operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成初始余额（确保足够支付）
          fc.integer({ min: 100, max: 10000 }),
          // 生成成本（确保小于余额）
          fc.integer({ min: 10, max: 99 }),
          // 生成会员等级
          fc.constantFrom('free', 'basic', 'premium', 'enterprise'),
          // 生成元数据
          fc.record({
            requestId: fc.uuid(),
            source: fc.constantFrom('web', 'mobile', 'api'),
            timestamp: fc.date().map(d => d.toISOString())
          }),
          async (balance, cost, membershipTier, metadata) => {
            // 配置动态成本
            const action = `action-${cost}`;
            config.costs[action] = { default: cost };
            config.membership.requirements[action] = null;

            // 创建新引擎实例以使用更新的配置
            const testEngine = new CreditsEngine({
              storage: adapter,
              config
            });

            // 创建用户
            const userId = `user-integrity-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 获取操作前的状态
            const transactionsBefore = await adapter.getTransactions(userId);
            const auditLogsBefore = adapter.getAuditLogs();
            const transactionsCountBefore = transactionsBefore.length;
            const auditLogsCountBefore = auditLogsBefore.length;

            // 执行扣费操作
            const result = await testEngine.charge({
              userId,
              action,
              metadata
            });

            // ===== 验证 1: 余额正确减少 =====
            const userAfter = await adapter.getUserById(userId);
            expect(userAfter).not.toBeNull();
            expect(userAfter!.credits).toBe(balance - cost);

            // ===== 验证 2: 返回结果包含所有必需字段 =====
            expect(result).toMatchObject({
              success: true,
              transactionId: expect.any(String),
              cost: cost,
              balanceBefore: balance,
              balanceAfter: balance - cost
            });

            // 验证余额计算一致性
            expect(result.balanceAfter).toBe(result.balanceBefore - result.cost);
            expect(result.balanceAfter).toBe(userAfter!.credits);

            // ===== 验证 3: 创建了交易记录 =====
            const transactionsAfter = await adapter.getTransactions(userId);
            expect(transactionsAfter.length).toBe(transactionsCountBefore + 1);

            // 获取最新的交易记录
            const latestTransaction = transactionsAfter[0]; // getTransactions 返回降序排列
            expect(latestTransaction).toBeDefined();
            expect(latestTransaction.id).toBe(result.transactionId);
            expect(latestTransaction.userId).toBe(userId);
            expect(latestTransaction.action).toBe(action);
            expect(latestTransaction.amount).toBe(-cost); // 负数表示扣费
            expect(latestTransaction.balanceBefore).toBe(balance);
            expect(latestTransaction.balanceAfter).toBe(balance - cost);
            expect(latestTransaction.metadata).toMatchObject(metadata);

            // ===== 验证 4: 创建了审计日志 =====
            const auditLogsAfter = adapter.getAuditLogs();
            expect(auditLogsAfter.length).toBe(auditLogsCountBefore + 1);

            // 获取最新的审计日志
            const latestAuditLog = auditLogsAfter[auditLogsAfter.length - 1];
            expect(latestAuditLog).toBeDefined();
            expect(latestAuditLog.userId).toBe(userId);
            expect(latestAuditLog.action).toBe('charge');
            expect(latestAuditLog.status).toBe('success');
            expect(latestAuditLog.metadata).toMatchObject({
              operation: action,
              cost: cost,
              balanceBefore: balance,
              balanceAfter: balance - cost,
              transactionId: result.transactionId
            });

            // ===== 验证 5: 数据一致性 =====
            // 交易记录和审计日志应该引用相同的操作
            expect(latestAuditLog.metadata.transactionId).toBe(latestTransaction.id);
            
            // 所有余额计算应该一致
            expect(latestTransaction.balanceBefore).toBe(result.balanceBefore);
            expect(latestTransaction.balanceAfter).toBe(result.balanceAfter);
            expect(latestAuditLog.metadata.balanceBefore).toBe(result.balanceBefore);
            expect(latestAuditLog.metadata.balanceAfter).toBe(result.balanceAfter);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 5.1: 扣费操作完整性 - 会员折扣场景
     * 
     * When a user has a membership tier that provides a discount,
     * the charge operation should correctly apply the discounted cost
     * and maintain data integrity with the discounted amount.
     * 
     * **Validates: Requirements 4.1, 4.4, 10.2**
     */
    it('should maintain data integrity with membership discounts', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成初始余额（确保足够支付折扣价）
          fc.integer({ min: 200, max: 10000 }),
          async (balance) => {
            // 使用 premium-action（默认 200，premium 折扣价 150）
            const action = 'premium-action';
            const userId = `user-discount-integrity-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            
            // 创建 premium 用户
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier: 'premium',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行扣费操作
            const result = await engine.charge({
              userId,
              action
            });

            // 验证使用了折扣价格
            const expectedCost = 150; // premium 折扣价
            expect(result.cost).toBe(expectedCost);

            // 验证余额正确减少
            const userAfter = await adapter.getUserById(userId);
            expect(userAfter!.credits).toBe(balance - expectedCost);

            // 验证交易记录使用折扣价
            const transactions = await adapter.getTransactions(userId);
            const latestTransaction = transactions[0];
            expect(latestTransaction.amount).toBe(-expectedCost);
            expect(latestTransaction.balanceBefore).toBe(balance);
            expect(latestTransaction.balanceAfter).toBe(balance - expectedCost);

            // 验证审计日志记录折扣价
            const auditLogs = adapter.getAuditLogs();
            const latestAuditLog = auditLogs[auditLogs.length - 1];
            expect(latestAuditLog.metadata.cost).toBe(expectedCost);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 5.2: 扣费操作完整性 - 多次扣费累积效果
     * 
     * When multiple charge operations are performed sequentially,
     * each operation should correctly update the balance based on the
     * previous operation's result, maintaining consistency across all records.
     * 
     * **Validates: Requirements 4.1, 4.4**
     */
    it('should maintain data integrity across multiple sequential charges', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成初始余额
          fc.integer({ min: 1000, max: 10000 }),
          // 生成扣费次数（2-5次）
          fc.integer({ min: 2, max: 5 }),
          // 生成每次扣费的成本
          fc.integer({ min: 10, max: 50 }),
          async (initialBalance, chargeCount, costPerCharge) => {
            // 确保余额足够支付所有扣费
            const totalCost = chargeCount * costPerCharge;
            if (initialBalance < totalCost) {
              return; // 跳过这个测试用例
            }

            // 配置动态成本
            const action = `action-${costPerCharge}`;
            config.costs[action] = { default: costPerCharge };
            config.membership.requirements[action] = null;

            // 创建新引擎实例
            const testEngine = new CreditsEngine({
              storage: adapter,
              config
            });

            // 创建用户
            const userId = `user-multi-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: initialBalance,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行多次扣费
            let expectedBalance = initialBalance;
            const results: any[] = [];

            for (let i = 0; i < chargeCount; i++) {
              const result = await testEngine.charge({
                userId,
                action
              });

              results.push(result);

              // 验证每次扣费的结果
              expect(result.balanceBefore).toBe(expectedBalance);
              expect(result.cost).toBe(costPerCharge);
              expect(result.balanceAfter).toBe(expectedBalance - costPerCharge);

              // 更新预期余额
              expectedBalance -= costPerCharge;

              // 验证用户余额
              const userCurrent = await adapter.getUserById(userId);
              expect(userCurrent!.credits).toBe(expectedBalance);
            }

            // 验证最终余额
            const userFinal = await adapter.getUserById(userId);
            expect(userFinal!.credits).toBe(initialBalance - totalCost);

            // 验证交易记录数量
            const transactions = await adapter.getTransactions(userId);
            expect(transactions.length).toBe(chargeCount);

            // 验证交易记录的余额链
            for (let i = 0; i < transactions.length; i++) {
              const txn = transactions[transactions.length - 1 - i]; // 从最早的开始
              const expectedBalanceBefore = initialBalance - (i * costPerCharge);
              const expectedBalanceAfter = expectedBalanceBefore - costPerCharge;

              expect(txn.balanceBefore).toBe(expectedBalanceBefore);
              expect(txn.balanceAfter).toBe(expectedBalanceAfter);
              expect(txn.amount).toBe(-costPerCharge);
            }

            // 验证审计日志数量
            const auditLogs = adapter.getAuditLogs();
            const userAuditLogs = auditLogs.filter(log => log.userId === userId);
            expect(userAuditLogs.length).toBe(chargeCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 5.3: 扣费操作完整性 - 元数据传播
     * 
     * When metadata is provided in the charge operation,
     * it should be correctly stored in the transaction record
     * and included in the audit log.
     * 
     * **Validates: Requirements 4.1, 4.4, 14.4**
     */
    it('should correctly propagate metadata to transaction and audit records', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成余额
          fc.integer({ min: 100, max: 10000 }),
          // 生成复杂的元数据
          fc.record({
            requestId: fc.uuid(),
            userId: fc.string({ minLength: 5, maxLength: 20 }),
            source: fc.constantFrom('web', 'mobile', 'api', 'cli'),
            ipAddress: fc.ipV4(),
            userAgent: fc.string({ minLength: 10, maxLength: 50 }),
            timestamp: fc.date().map(d => d.toISOString()),
            nested: fc.record({
              key1: fc.string(),
              key2: fc.integer(),
              key3: fc.boolean()
            })
          }),
          async (balance, metadata) => {
            // 创建用户
            const userId = `user-metadata-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行扣费操作
            const result = await engine.charge({
              userId,
              action: 'test-action',
              metadata
            });

            // 验证交易记录包含元数据
            const transactions = await adapter.getTransactions(userId);
            const latestTransaction = transactions[0];
            expect(latestTransaction.metadata).toMatchObject(metadata);

            // 验证审计日志包含元数据
            const auditLogs = adapter.getAuditLogs();
            const latestAuditLog = auditLogs[auditLogs.length - 1];
            
            // 审计日志的元数据应该包含原始元数据
            expect(latestAuditLog.metadata).toMatchObject(metadata);
            
            // 审计日志还应该包含操作相关的元数据
            expect(latestAuditLog.metadata.operation).toBe('test-action');
            expect(latestAuditLog.metadata.cost).toBe(100);
            expect(latestAuditLog.metadata.transactionId).toBe(result.transactionId);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 5.4: 扣费操作完整性 - 时间戳一致性
     * 
     * All records created during a charge operation (transaction and audit log)
     * should have timestamps that are close to each other and to the operation time.
     * 
     * **Validates: Requirements 4.1, 4.4**
     */
    it('should create records with consistent timestamps', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成余额
          fc.integer({ min: 100, max: 10000 }),
          async (balance) => {
            // 创建用户
            const userId = `user-timestamp-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
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

            // 执行扣费操作
            await engine.charge({
              userId,
              action: 'test-action'
            });

            // 记录操作结束时间
            const operationEnd = new Date();

            // 获取创建的记录
            const transactions = await adapter.getTransactions(userId);
            const latestTransaction = transactions[0];

            const auditLogs = adapter.getAuditLogs();
            const latestAuditLog = auditLogs[auditLogs.length - 1];

            // 验证交易记录的时间戳在操作时间范围内
            expect(latestTransaction.createdAt.getTime()).toBeGreaterThanOrEqual(operationStart.getTime());
            expect(latestTransaction.createdAt.getTime()).toBeLessThanOrEqual(operationEnd.getTime());

            // 验证审计日志的时间戳在操作时间范围内
            expect(latestAuditLog.createdAt.getTime()).toBeGreaterThanOrEqual(operationStart.getTime());
            expect(latestAuditLog.createdAt.getTime()).toBeLessThanOrEqual(operationEnd.getTime());

            // 验证交易记录和审计日志的时间戳非常接近（应该在同一秒内）
            const timeDiff = Math.abs(
              latestTransaction.createdAt.getTime() - latestAuditLog.createdAt.getTime()
            );
            expect(timeDiff).toBeLessThan(1000); // 小于 1 秒
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

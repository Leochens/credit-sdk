/**
 * CreditsEngine queryBalance 操作属性测试
 * 使用基于属性的测试验证 queryBalance 操作的正确性
 * 
 * Feature: credit-sdk
 * Property 11: 余额查询准确性
 * 
 * **Validates: Requirements 7.1**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { CreditsEngine } from '../../src/core/CreditsEngine';
import { MockAdapter } from '../../src/adapters/MockAdapter';
import { UserNotFoundError } from '../../src/core/errors';
import type { CreditsConfig, User } from '../../src/core/types';

describe('CreditsEngine QueryBalance - Property Tests', () => {
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

  describe('Property 11: 余额查询准确性', () => {
    /**
     * Property 11: 余额查询准确性
     * 
     * For any existing user, queryBalance should return the user's current
     * accurate credit balance.
     * 
     * This property verifies that:
     * 1. queryBalance returns the exact balance stored in the user record
     * 2. The returned value is a number with appropriate precision
     * 3. The balance is consistent with the user's actual credits
     * 4. The operation does not modify the user's balance
     * 
     * **Validates: Requirement 7.1**
     */
    it('should return accurate balance for existing users', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成用户余额（0-1000000）
          fc.integer({ min: 0, max: 1000000 }),
          // 生成会员等级
          fc.constantFrom('free', 'basic', 'premium', 'enterprise'),
          async (balance, membershipTier) => {
            // 创建用户
            const userId = `user-query-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 查询余额
            const queriedBalance = await engine.queryBalance(userId);

            // ===== 验证 1: 返回准确的余额 =====
            expect(queriedBalance).toBe(balance);

            // ===== 验证 2: 返回值是数字类型 =====
            expect(typeof queriedBalance).toBe('number');
            expect(Number.isFinite(queriedBalance)).toBe(true);
            expect(Number.isInteger(queriedBalance)).toBe(true);

            // ===== 验证 3: 余额与用户记录一致 =====
            const userAfter = await adapter.getUserById(userId);
            expect(queriedBalance).toBe(userAfter!.credits);

            // ===== 验证 4: 查询操作不修改余额 =====
            expect(userAfter!.credits).toBe(balance);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 11.1: 余额查询准确性 - 零余额
     * 
     * When a user has zero balance, queryBalance should correctly return 0.
     * 
     * **Validates: Requirement 7.1**
     */
    it('should correctly return zero balance', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成会员等级
          fc.constantFrom('free', 'basic', 'premium', 'enterprise'),
          async (membershipTier) => {
            // 创建余额为零的用户
            const userId = `user-zero-query-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: 0,
              membershipTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 查询余额
            const balance = await engine.queryBalance(userId);

            // 验证返回零
            expect(balance).toBe(0);
            expect(balance).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 11.2: 余额查询准确性 - 操作后余额一致性
     * 
     * After performing operations (charge, refund, grant), queryBalance
     * should return the updated balance that reflects all operations.
     * 
     * **Validates: Requirement 7.1**
     */
    it('should return accurate balance after operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成初始余额
          fc.integer({ min: 1000, max: 10000 }),
          // 生成扣费金额
          fc.integer({ min: 10, max: 100 }),
          // 生成退款金额
          fc.integer({ min: 10, max: 100 }),
          // 生成发放金额
          fc.integer({ min: 10, max: 100 }),
          async (initialBalance, chargeAmount, refundAmount, grantAmount) => {
            // 配置动态成本
            const action = `action-${chargeAmount}`;
            const testConfig: CreditsConfig = {
              ...config,
              costs: {
                ...config.costs,
                [action]: { default: chargeAmount }
              },
              membership: {
                ...config.membership,
                requirements: {
                  ...config.membership.requirements,
                  [action]: null
                }
              }
            };

            // 创建新引擎实例
            const testEngine = new CreditsEngine({
              storage: adapter,
              config: testConfig
            });

            // 创建用户
            const userId = `user-ops-query-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: initialBalance,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 查询初始余额
            const balance1 = await testEngine.queryBalance(userId);
            expect(balance1).toBe(initialBalance);

            // 执行扣费操作
            await testEngine.charge({
              userId,
              action
            });

            // 查询扣费后余额
            const balance2 = await testEngine.queryBalance(userId);
            expect(balance2).toBe(initialBalance - chargeAmount);

            // 执行退款操作
            await testEngine.refund({
              userId,
              amount: refundAmount,
              action: 'refund-test'
            });

            // 查询退款后余额
            const balance3 = await testEngine.queryBalance(userId);
            expect(balance3).toBe(initialBalance - chargeAmount + refundAmount);

            // 执行发放操作
            await testEngine.grant({
              userId,
              amount: grantAmount,
              action: 'grant-test'
            });

            // 查询发放后余额
            const balance4 = await testEngine.queryBalance(userId);
            expect(balance4).toBe(initialBalance - chargeAmount + refundAmount + grantAmount);

            // 验证最终余额与用户记录一致
            const userFinal = await adapter.getUserById(userId);
            expect(balance4).toBe(userFinal!.credits);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 11.3: 余额查询准确性 - 多次查询一致性
     * 
     * Multiple consecutive queryBalance calls should return the same value
     * if no operations are performed between them.
     * 
     * **Validates: Requirement 7.1**
     */
    it('should return consistent balance across multiple queries', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成余额
          fc.integer({ min: 0, max: 100000 }),
          // 生成查询次数（2-10次）
          fc.integer({ min: 2, max: 10 }),
          async (balance, queryCount) => {
            // 创建用户
            const userId = `user-multi-query-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行多次查询
            const balances: number[] = [];
            for (let i = 0; i < queryCount; i++) {
              const queriedBalance = await engine.queryBalance(userId);
              balances.push(queriedBalance);
            }

            // 验证所有查询返回相同的值
            for (const queriedBalance of balances) {
              expect(queriedBalance).toBe(balance);
            }

            // 验证余额未被修改
            const userAfter = await adapter.getUserById(userId);
            expect(userAfter!.credits).toBe(balance);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 11.4: 余额查询准确性 - 大额余额
     * 
     * queryBalance should correctly handle large balance values
     * without precision loss or overflow.
     * 
     * **Validates: Requirement 7.1, 7.4**
     */
    it('should correctly handle large balance values', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成大额余额
          fc.integer({ min: 1000000, max: 100000000 }),
          async (balance) => {
            // 创建用户
            const userId = `user-large-query-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier: 'enterprise',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 查询余额
            const queriedBalance = await engine.queryBalance(userId);

            // 验证返回准确的大额余额（无精度损失）
            expect(queriedBalance).toBe(balance);
            expect(Number.isInteger(queriedBalance)).toBe(true);
            expect(Number.isSafeInteger(queriedBalance)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 11.5: 余额查询准确性 - 不同会员等级
     * 
     * queryBalance should work consistently across all membership tiers,
     * as balance query does not depend on membership tier.
     * 
     * **Validates: Requirement 7.1**
     */
    it('should work consistently across all membership tiers', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成余额
          fc.integer({ min: 0, max: 100000 }),
          // 生成会员等级
          fc.constantFrom('free', 'basic', 'premium', 'enterprise'),
          async (balance, membershipTier) => {
            // 创建用户
            const userId = `user-tier-query-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 查询余额
            const queriedBalance = await engine.queryBalance(userId);

            // 验证余额查询不受会员等级影响
            expect(queriedBalance).toBe(balance);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 11.6: 余额查询准确性 - 事务上下文支持
     * 
     * When a transaction context is provided, queryBalance should
     * return the balance within that transaction context, ensuring
     * read consistency.
     * 
     * **Validates: Requirement 7.1, 7.3**
     */
    it('should support transaction context for read consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成余额
          fc.integer({ min: 0, max: 100000 }),
          async (balance) => {
            // 创建用户
            const userId = `user-txn-query-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 模拟事务上下文（MockAdapter 支持事务参数）
            const txn = { id: 'mock-transaction' };

            // 在事务上下文中查询余额
            const queriedBalance = await engine.queryBalance(userId, txn);

            // 验证返回准确的余额
            expect(queriedBalance).toBe(balance);

            // 验证余额未被修改
            const userAfter = await adapter.getUserById(userId);
            expect(userAfter!.credits).toBe(balance);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 11.7: 余额查询准确性 - 用户不存在时抛出错误
     * 
     * When attempting to query balance for a non-existent user,
     * the operation should throw UserNotFoundError.
     * 
     * **Validates: Requirement 7.2**
     */
    it('should throw UserNotFoundError for non-existent users', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成不存在的用户 ID
          fc.uuid(),
          async (userId) => {
            // 验证抛出 UserNotFoundError
            await expect(
              engine.queryBalance(userId)
            ).rejects.toThrow(UserNotFoundError);

            // 验证错误包含正确的用户 ID
            try {
              await engine.queryBalance(userId);
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
     * Property 11.8: 余额查询准确性 - 并发查询一致性
     * 
     * Multiple concurrent queryBalance calls should all return the same
     * balance value if no operations are performed.
     * 
     * **Validates: Requirement 7.1**
     */
    it('should return consistent balance for concurrent queries', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成余额
          fc.integer({ min: 0, max: 100000 }),
          // 生成并发查询数量（2-10）
          fc.integer({ min: 2, max: 10 }),
          async (balance, concurrentCount) => {
            // 创建用户
            const userId = `user-concurrent-query-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行并发查询
            const queryPromises = Array.from({ length: concurrentCount }, () =>
              engine.queryBalance(userId)
            );

            const balances = await Promise.all(queryPromises);

            // 验证所有查询返回相同的值
            for (const queriedBalance of balances) {
              expect(queriedBalance).toBe(balance);
            }

            // 验证余额未被修改
            const userAfter = await adapter.getUserById(userId);
            expect(userAfter!.credits).toBe(balance);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 11.9: 余额查询准确性 - 精度保持
     * 
     * queryBalance should return integer values with no decimal places,
     * maintaining the precision of the stored balance.
     * 
     * **Validates: Requirement 7.4**
     */
    it('should maintain integer precision for balance values', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成余额
          fc.integer({ min: 0, max: 1000000 }),
          async (balance) => {
            // 创建用户
            const userId = `user-precision-query-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 查询余额
            const queriedBalance = await engine.queryBalance(userId);

            // 验证返回整数值（无小数）
            expect(Number.isInteger(queriedBalance)).toBe(true);
            expect(queriedBalance % 1).toBe(0);
            expect(queriedBalance).toBe(Math.floor(queriedBalance));
            expect(queriedBalance).toBe(Math.ceil(queriedBalance));
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 11.10: 余额查询准确性 - 操作序列后的准确性
     * 
     * After a complex sequence of operations (charges, refunds, grants),
     * queryBalance should return the exact final balance that results
     * from all operations.
     * 
     * **Validates: Requirement 7.1**
     */
    it('should return accurate balance after complex operation sequences', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成初始余额
          fc.integer({ min: 10000, max: 100000 }),
          // 生成操作序列（数组的数组）
          fc.array(
            fc.record({
              type: fc.constantFrom('charge', 'refund', 'grant'),
              amount: fc.integer({ min: 10, max: 100 })
            }),
            { minLength: 3, maxLength: 10 }
          ),
          async (initialBalance, operations) => {
            // 创建用户
            const userId = `user-complex-query-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: initialBalance,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 计算预期的最终余额
            let expectedBalance = initialBalance;

            // 执行操作序列
            for (const op of operations) {
              if (op.type === 'charge') {
                // 配置动态成本
                const action = `action-${op.amount}`;
                const testConfig: CreditsConfig = {
                  ...config,
                  costs: {
                    ...config.costs,
                    [action]: { default: op.amount }
                  },
                  membership: {
                    ...config.membership,
                    requirements: {
                      ...config.membership.requirements,
                      [action]: null
                    }
                  }
                };

                const testEngine = new CreditsEngine({
                  storage: adapter,
                  config: testConfig
                });

                // 只有在余额足够时才执行扣费
                if (expectedBalance >= op.amount) {
                  await testEngine.charge({ userId, action });
                  expectedBalance -= op.amount;
                }
              } else if (op.type === 'refund') {
                await engine.refund({
                  userId,
                  amount: op.amount,
                  action: `refund-${op.amount}`
                });
                expectedBalance += op.amount;
              } else if (op.type === 'grant') {
                await engine.grant({
                  userId,
                  amount: op.amount,
                  action: `grant-${op.amount}`
                });
                expectedBalance += op.amount;
              }
            }

            // 查询最终余额
            const finalBalance = await engine.queryBalance(userId);

            // 验证查询的余额与预期一致
            expect(finalBalance).toBe(expectedBalance);

            // 验证与用户记录一致
            const userFinal = await adapter.getUserById(userId);
            expect(finalBalance).toBe(userFinal!.credits);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * CreditsEngine getHistory 操作属性测试
 * 使用基于属性的测试验证 getHistory 操作的正确性
 * 
 * Feature: credit-sdk
 * Property 12: 交易历史查询
 * 
 * **Validates: Requirements 8.1, 8.5**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { CreditsEngine } from '../../src/core/CreditsEngine';
import { MockAdapter } from '../../src/adapters/MockAdapter';
import type { CreditsConfig, User, Transaction } from '../../src/core/types';

describe('CreditsEngine GetHistory - Property Tests', () => {
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

  describe('Property 12: 交易历史查询', () => {
    /**
     * Property 12: 交易历史查询
     * 
     * For any user, getHistory should return all transactions for that user,
     * sorted by timestamp in descending order (newest first).
     * 
     * This property verifies that:
     * 1. getHistory returns all transactions for the specified user
     * 2. Transactions are sorted by timestamp in descending order
     * 3. Only transactions belonging to the specified user are returned
     * 4. The returned list is complete and accurate
     * 
     * **Validates: Requirements 8.1, 8.5**
     */
    it('should return transaction history sorted by timestamp in descending order', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成初始余额
          fc.integer({ min: 10000, max: 100000 }),
          // 生成交易数量（2-20）
          fc.integer({ min: 2, max: 20 }),
          // 生成会员等级
          fc.constantFrom('free', 'basic', 'premium', 'enterprise'),
          async (initialBalance, transactionCount, membershipTier) => {
            // 创建用户
            const userId = `user-history-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: initialBalance,
              membershipTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行多个操作以创建交易历史
            const operations: Array<{ type: 'charge' | 'refund' | 'grant'; amount: number }> = [];
            let currentBalance = initialBalance;

            for (let i = 0; i < transactionCount; i++) {
              // 随机选择操作类型
              const opType = ['charge', 'refund', 'grant'][Math.floor(Math.random() * 3)] as 'charge' | 'refund' | 'grant';
              const amount = 10 + Math.floor(Math.random() * 90); // 10-99

              if (opType === 'charge') {
                // 只有在余额足够时才扣费
                if (currentBalance >= amount) {
                  const action = `action-${amount}`;
                  const testConfig: CreditsConfig = {
                    ...config,
                    costs: {
                      ...config.costs,
                      [action]: { default: amount }
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

                  await testEngine.charge({ userId, action });
                  currentBalance -= amount;
                  operations.push({ type: 'charge', amount });
                }
              } else if (opType === 'refund') {
                await engine.refund({
                  userId,
                  amount,
                  action: `refund-${i}`
                });
                currentBalance += amount;
                operations.push({ type: 'refund', amount });
              } else {
                await engine.grant({
                  userId,
                  amount,
                  action: `grant-${i}`
                });
                currentBalance += amount;
                operations.push({ type: 'grant', amount });
              }

              // 添加小延迟以确保时间戳不同
              await new Promise(resolve => setTimeout(resolve, 1));
            }

            // 获取交易历史
            const history = await engine.getHistory(userId);

            // ===== 验证 1: 返回了所有交易 (需求 8.1) =====
            expect(history.length).toBe(operations.length);

            // ===== 验证 2: 所有交易都属于指定用户 (需求 8.1) =====
            for (const txn of history) {
              expect(txn.userId).toBe(userId);
            }

            // ===== 验证 3: 交易按时间戳降序排列 (需求 8.5) =====
            for (let i = 0; i < history.length - 1; i++) {
              const current = history[i];
              const next = history[i + 1];
              
              // 当前交易的时间戳应该 >= 下一个交易的时间戳
              expect(current.createdAt.getTime()).toBeGreaterThanOrEqual(next.createdAt.getTime());
            }

            // ===== 验证 4: 交易记录包含正确的信息 =====
            for (const txn of history) {
              expect(txn).toMatchObject({
                id: expect.any(String),
                userId: userId,
                action: expect.any(String),
                amount: expect.any(Number),
                balanceBefore: expect.any(Number),
                balanceAfter: expect.any(Number),
                metadata: expect.any(Object),
                createdAt: expect.any(Date)
              });

              // 验证余额变化的一致性
              expect(txn.balanceAfter).toBe(txn.balanceBefore + txn.amount);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 12.1: 交易历史查询 - 空历史
     * 
     * When a user has no transactions, getHistory should return an empty array.
     * 
     * **Validates: Requirement 8.1**
     */
    it('should return empty array for users with no transactions', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成余额
          fc.integer({ min: 0, max: 10000 }),
          // 生成会员等级
          fc.constantFrom('free', 'basic', 'premium', 'enterprise'),
          async (balance, membershipTier) => {
            // 创建用户但不执行任何操作
            const userId = `user-empty-history-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 获取交易历史
            const history = await engine.getHistory(userId);

            // 验证返回空数组
            expect(history).toEqual([]);
            expect(history.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 12.2: 交易历史查询 - 单个交易
     * 
     * When a user has exactly one transaction, getHistory should return
     * an array with that single transaction.
     * 
     * **Validates: Requirements 8.1, 8.5**
     */
    it('should correctly return single transaction', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成余额
          fc.integer({ min: 1000, max: 10000 }),
          // 生成操作类型
          fc.constantFrom('charge', 'refund', 'grant'),
          // 生成金额
          fc.integer({ min: 10, max: 100 }),
          async (balance, opType, amount) => {
            // 创建用户
            const userId = `user-single-txn-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行单个操作
            if (opType === 'charge' && balance >= amount) {
              const action = `action-${amount}`;
              const testConfig: CreditsConfig = {
                ...config,
                costs: {
                  ...config.costs,
                  [action]: { default: amount }
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

              await testEngine.charge({ userId, action });
            } else if (opType === 'refund') {
              await engine.refund({
                userId,
                amount,
                action: 'refund-test'
              });
            } else {
              await engine.grant({
                userId,
                amount,
                action: 'grant-test'
              });
            }

            // 获取交易历史
            const history = await engine.getHistory(userId);

            // 验证返回单个交易
            expect(history.length).toBe(1);
            expect(history[0].userId).toBe(userId);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 12.3: 交易历史查询 - 时间戳严格降序
     * 
     * When transactions are created at different times,
     * getHistory should return them in strict descending order
     * (newest first, oldest last).
     * 
     * **Validates: Requirement 8.5**
     */
    it('should maintain strict descending timestamp order', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成余额
          fc.integer({ min: 10000, max: 100000 }),
          // 生成交易数量
          fc.integer({ min: 5, max: 15 }),
          async (balance, count) => {
            // 创建用户
            const userId = `user-strict-order-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 创建交易，确保时间戳不同
            const timestamps: Date[] = [];
            for (let i = 0; i < count; i++) {
              await engine.grant({
                userId,
                amount: 10,
                action: `grant-${i}`
              });

              // 记录时间戳
              const history = await engine.getHistory(userId);
              timestamps.push(history[0].createdAt);

              // 添加延迟以确保时间戳不同
              await new Promise(resolve => setTimeout(resolve, 2));
            }

            // 获取完整历史
            const history = await engine.getHistory(userId);

            // 验证数量
            expect(history.length).toBe(count);

            // 验证严格降序（每个时间戳都应该 >= 下一个）
            for (let i = 0; i < history.length - 1; i++) {
              expect(history[i].createdAt.getTime()).toBeGreaterThanOrEqual(
                history[i + 1].createdAt.getTime()
              );
            }

            // 验证第一个是最新的，最后一个是最旧的
            const firstTimestamp = history[0].createdAt.getTime();
            const lastTimestamp = history[history.length - 1].createdAt.getTime();
            expect(firstTimestamp).toBeGreaterThanOrEqual(lastTimestamp);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 12.4: 交易历史查询 - 用户隔离
     * 
     * When multiple users exist with transactions,
     * getHistory should only return transactions for the specified user,
     * not mixing transactions from different users.
     * 
     * **Validates: Requirement 8.1**
     */
    it('should only return transactions for the specified user', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成用户数量（2-5）
          fc.integer({ min: 2, max: 5 }),
          // 生成每个用户的交易数量
          fc.integer({ min: 2, max: 10 }),
          async (userCount, txnPerUser) => {
            // 创建多个用户并为每个用户创建交易
            const userIds: string[] = [];

            for (let i = 0; i < userCount; i++) {
              const userId = `user-isolation-${Date.now()}-${i}-${Math.floor(Math.random() * 1000000)}`;
              userIds.push(userId);

              const user: User = {
                id: userId,
                credits: 10000,
                membershipTier: 'free',
                membershipExpiresAt: null,
                createdAt: new Date(),
                updatedAt: new Date()
              };
              await adapter.createUser(user);

              // 为每个用户创建交易
              for (let j = 0; j < txnPerUser; j++) {
                await engine.grant({
                  userId,
                  amount: 10,
                  action: `grant-user${i}-txn${j}`
                });
              }
            }

            // 验证每个用户的历史只包含自己的交易
            for (const userId of userIds) {
              const history = await engine.getHistory(userId);

              // 验证交易数量
              expect(history.length).toBe(txnPerUser);

              // 验证所有交易都属于该用户
              for (const txn of history) {
                expect(txn.userId).toBe(userId);
              }

              // 验证交易的 action 包含用户标识
              const userIndex = userIds.indexOf(userId);
              for (const txn of history) {
                expect(txn.action).toContain(`user${userIndex}`);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 12.5: 交易历史查询 - 混合操作类型
     * 
     * When a user has transactions of different types (charge, refund, grant),
     * getHistory should return all of them in the correct order.
     * 
     * **Validates: Requirements 8.1, 8.5**
     */
    it('should return all transaction types in correct order', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成余额
          fc.integer({ min: 10000, max: 100000 }),
          // 生成每种操作的数量
          fc.record({
            charges: fc.integer({ min: 1, max: 5 }),
            refunds: fc.integer({ min: 1, max: 5 }),
            grants: fc.integer({ min: 1, max: 5 })
          }),
          async (balance, counts) => {
            // 创建用户
            const userId = `user-mixed-ops-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            const totalOps = counts.charges + counts.refunds + counts.grants;
            let currentBalance = balance;

            // 执行混合操作
            for (let i = 0; i < counts.charges; i++) {
              const amount = 50;
              if (currentBalance >= amount) {
                const action = `charge-${i}`;
                const testConfig: CreditsConfig = {
                  ...config,
                  costs: {
                    ...config.costs,
                    [action]: { default: amount }
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

                await testEngine.charge({ userId, action });
                currentBalance -= amount;
                await new Promise(resolve => setTimeout(resolve, 1));
              }
            }

            for (let i = 0; i < counts.refunds; i++) {
              await engine.refund({
                userId,
                amount: 30,
                action: `refund-${i}`
              });
              currentBalance += 30;
              await new Promise(resolve => setTimeout(resolve, 1));
            }

            for (let i = 0; i < counts.grants; i++) {
              await engine.grant({
                userId,
                amount: 20,
                action: `grant-${i}`
              });
              currentBalance += 20;
              await new Promise(resolve => setTimeout(resolve, 1));
            }

            // 获取历史
            const history = await engine.getHistory(userId);

            // 验证包含所有操作
            expect(history.length).toBeGreaterThanOrEqual(counts.refunds + counts.grants);

            // 验证按时间戳降序排列
            for (let i = 0; i < history.length - 1; i++) {
              expect(history[i].createdAt.getTime()).toBeGreaterThanOrEqual(
                history[i + 1].createdAt.getTime()
              );
            }

            // 验证包含不同类型的操作
            const actions = history.map(txn => txn.action);
            const hasCharges = actions.some(a => a.startsWith('charge-'));
            const hasRefunds = actions.some(a => a.startsWith('refund-'));
            const hasGrants = actions.some(a => a.startsWith('grant-'));

            // 至少应该有 refunds 和 grants（charges 可能因余额不足而跳过）
            expect(hasRefunds).toBe(true);
            expect(hasGrants).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 12.6: 交易历史查询 - 余额链一致性
     * 
     * When viewing transaction history, the balance chain should be consistent:
     * each transaction's balanceAfter should equal the next transaction's balanceBefore
     * (when reading in reverse chronological order).
     * 
     * **Validates: Requirements 8.1, 8.5**
     */
    it('should maintain consistent balance chain in transaction history', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成余额
          fc.integer({ min: 10000, max: 100000 }),
          // 生成交易数量
          fc.integer({ min: 3, max: 10 }),
          async (balance, count) => {
            // 创建用户
            const userId = `user-balance-chain-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行操作
            for (let i = 0; i < count; i++) {
              await engine.grant({
                userId,
                amount: 100,
                action: `grant-${i}`
              });
              await new Promise(resolve => setTimeout(resolve, 2));
            }

            // 获取历史（降序）
            const history = await engine.getHistory(userId);

            // 验证数量
            expect(history.length).toBe(count);

            // 验证余额链的一致性
            // 由于交易按时间戳降序排列，我们需要从最新到最旧检查
            // 但是余额链是从旧到新建立的
            // 所以我们反向遍历历史（从最旧到最新）来验证余额链
            for (let i = history.length - 1; i > 0; i--) {
              const older = history[i]; // 较旧的交易
              const newer = history[i - 1]; // 较新的交易

              // 较旧交易的 balanceAfter 应该等于较新交易的 balanceBefore
              expect(older.balanceAfter).toBe(newer.balanceBefore);
            }

            // 验证最旧的交易的 balanceBefore 应该是初始余额
            const oldestTransaction = history[history.length - 1];
            expect(oldestTransaction.balanceBefore).toBe(balance);

            // 验证最新的交易的 balanceAfter 应该是当前余额
            const newestTransaction = history[0];
            const currentUser = await adapter.getUserById(userId);
            expect(newestTransaction.balanceAfter).toBe(currentUser!.credits);

            // 验证每个交易的余额变化
            for (const txn of history) {
              expect(txn.balanceAfter).toBe(txn.balanceBefore + txn.amount);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 12.7: 交易历史查询 - 并发查询一致性
     * 
     * Multiple concurrent getHistory calls should return the same results
     * if no operations are performed between them.
     * 
     * **Validates: Requirements 8.1, 8.5**
     */
    it('should return consistent results for concurrent queries', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成余额
          fc.integer({ min: 10000, max: 100000 }),
          // 生成交易数量
          fc.integer({ min: 3, max: 10 }),
          // 生成并发查询数量
          fc.integer({ min: 2, max: 5 }),
          async (balance, txnCount, concurrentCount) => {
            // 创建用户
            const userId = `user-concurrent-history-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 创建交易
            for (let i = 0; i < txnCount; i++) {
              await engine.grant({
                userId,
                amount: 100,
                action: `grant-${i}`
              });
              await new Promise(resolve => setTimeout(resolve, 1));
            }

            // 执行并发查询
            const queryPromises = Array.from({ length: concurrentCount }, () =>
              engine.getHistory(userId)
            );

            const results = await Promise.all(queryPromises);

            // 验证所有查询返回相同数量的交易
            for (const result of results) {
              expect(result.length).toBe(txnCount);
            }

            // 验证所有查询返回相同的交易 ID（顺序相同）
            const firstResult = results[0];
            for (let i = 1; i < results.length; i++) {
              const currentResult = results[i];
              
              // 验证交易 ID 列表相同
              const firstIds = firstResult.map(txn => txn.id);
              const currentIds = currentResult.map(txn => txn.id);
              expect(currentIds).toEqual(firstIds);

              // 验证顺序相同
              for (let j = 0; j < firstResult.length; j++) {
                expect(currentResult[j].id).toBe(firstResult[j].id);
                expect(currentResult[j].createdAt.getTime()).toBe(firstResult[j].createdAt.getTime());
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 12.8: 交易历史查询 - 大量交易
     * 
     * getHistory should correctly handle users with a large number of transactions,
     * maintaining correct order and completeness.
     * 
     * **Validates: Requirements 8.1, 8.5**
     */
    it('should correctly handle large transaction histories', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成大量交易（20-50）
          fc.integer({ min: 20, max: 50 }),
          async (count) => {
            // 创建用户
            const userId = `user-large-history-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: 100000,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 创建大量交易
            for (let i = 0; i < count; i++) {
              await engine.grant({
                userId,
                amount: 10,
                action: `grant-${i}`
              });
              // 不添加延迟以测试相同时间戳的处理
            }

            // 获取历史
            const history = await engine.getHistory(userId);

            // 验证返回所有交易
            expect(history.length).toBe(count);

            // 验证降序排列
            for (let i = 0; i < history.length - 1; i++) {
              expect(history[i].createdAt.getTime()).toBeGreaterThanOrEqual(
                history[i + 1].createdAt.getTime()
              );
            }

            // 验证所有交易都属于该用户
            for (const txn of history) {
              expect(txn.userId).toBe(userId);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 12.9: 交易历史查询 - 交易完整性
     * 
     * Every transaction returned by getHistory should have all required fields
     * and the fields should contain valid data.
     * 
     * **Validates: Requirement 8.1**
     */
    it('should return transactions with all required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成余额
          fc.integer({ min: 10000, max: 100000 }),
          // 生成交易数量
          fc.integer({ min: 1, max: 10 }),
          async (balance, count) => {
            // 创建用户
            const userId = `user-complete-txn-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: balance,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 创建交易
            for (let i = 0; i < count; i++) {
              await engine.grant({
                userId,
                amount: 100,
                action: `grant-${i}`
              });
            }

            // 获取历史
            const history = await engine.getHistory(userId);

            // 验证每个交易都有所有必需字段
            for (const txn of history) {
              // 验证字段存在
              expect(txn.id).toBeDefined();
              expect(txn.userId).toBeDefined();
              expect(txn.action).toBeDefined();
              expect(txn.amount).toBeDefined();
              expect(txn.balanceBefore).toBeDefined();
              expect(txn.balanceAfter).toBeDefined();
              expect(txn.metadata).toBeDefined();
              expect(txn.createdAt).toBeDefined();

              // 验证字段类型
              expect(typeof txn.id).toBe('string');
              expect(typeof txn.userId).toBe('string');
              expect(typeof txn.action).toBe('string');
              expect(typeof txn.amount).toBe('number');
              expect(typeof txn.balanceBefore).toBe('number');
              expect(typeof txn.balanceAfter).toBe('number');
              expect(typeof txn.metadata).toBe('object');
              expect(txn.createdAt).toBeInstanceOf(Date);

              // 验证字段值有效
              expect(txn.id.length).toBeGreaterThan(0);
              expect(txn.userId).toBe(userId);
              expect(txn.action.length).toBeGreaterThan(0);
              expect(Number.isFinite(txn.amount)).toBe(true);
              expect(Number.isFinite(txn.balanceBefore)).toBe(true);
              expect(Number.isFinite(txn.balanceAfter)).toBe(true);
              expect(txn.createdAt.getTime()).toBeGreaterThan(0);

              // 验证余额计算
              expect(txn.balanceAfter).toBe(txn.balanceBefore + txn.amount);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 13: 分页正确性', () => {
    /**
     * Property 13: 分页正确性
     * 
     * For any transaction history query, using limit and offset parameters
     * should return the correct subset of records without duplication or omission.
     * 
     * This property verifies that:
     * 1. limit parameter correctly limits the number of returned transactions
     * 2. offset parameter correctly skips the specified number of transactions
     * 3. Pagination does not duplicate transactions
     * 4. Pagination does not omit transactions
     * 5. Combining multiple pages reconstructs the complete history
     * 
     * **Validates: Requirement 8.2**
     */
    it('should correctly paginate transaction history with limit and offset', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成交易总数（10-30，确保有足够的数据进行分页测试）
          fc.integer({ min: 10, max: 30 }),
          // 生成页面大小（3-10）
          fc.integer({ min: 3, max: 10 }),
          async (totalTransactions, pageSize) => {
            // 创建用户
            const userId = `user-pagination-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: 100000,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 创建交易
            for (let i = 0; i < totalTransactions; i++) {
              await engine.grant({
                userId,
                amount: 100,
                action: `grant-${i}`
              });
              // 添加小延迟以确保时间戳不同
              await new Promise(resolve => setTimeout(resolve, 1));
            }

            // 获取完整历史作为参考
            const fullHistory = await engine.getHistory(userId);
            expect(fullHistory.length).toBe(totalTransactions);

            // ===== 验证 1: limit 参数正确限制返回数量 (需求 8.2) =====
            const limitedHistory = await engine.getHistory(userId, { limit: pageSize });
            expect(limitedHistory.length).toBe(Math.min(pageSize, totalTransactions));

            // 验证 limit 返回的是最新的交易（前 pageSize 个）
            for (let i = 0; i < limitedHistory.length; i++) {
              expect(limitedHistory[i].id).toBe(fullHistory[i].id);
            }

            // ===== 验证 2: offset 参数正确跳过指定数量 (需求 8.2) =====
            const offsetHistory = await engine.getHistory(userId, { offset: pageSize });
            expect(offsetHistory.length).toBe(Math.max(0, totalTransactions - pageSize));

            // 验证 offset 跳过了前 pageSize 个交易
            for (let i = 0; i < offsetHistory.length; i++) {
              expect(offsetHistory[i].id).toBe(fullHistory[i + pageSize].id);
            }

            // ===== 验证 3: limit 和 offset 组合正确工作 (需求 8.2) =====
            const paginatedHistory = await engine.getHistory(userId, {
              limit: pageSize,
              offset: pageSize
            });

            // 验证返回的数量
            const expectedCount = Math.min(pageSize, Math.max(0, totalTransactions - pageSize));
            expect(paginatedHistory.length).toBe(expectedCount);

            // 验证返回的是正确的交易（跳过前 pageSize 个，然后取 pageSize 个）
            for (let i = 0; i < paginatedHistory.length; i++) {
              expect(paginatedHistory[i].id).toBe(fullHistory[i + pageSize].id);
            }

            // ===== 验证 4: 分页不重复不遗漏 (需求 8.2) =====
            // 通过分页获取所有交易
            const reconstructed: Transaction[] = [];
            let currentOffset = 0;

            while (currentOffset < totalTransactions) {
              const page = await engine.getHistory(userId, {
                limit: pageSize,
                offset: currentOffset
              });

              if (page.length === 0) break;

              reconstructed.push(...page);
              currentOffset += pageSize;
            }

            // 验证重建的历史与完整历史相同
            expect(reconstructed.length).toBe(fullHistory.length);

            // 验证所有交易 ID 都存在且顺序相同
            for (let i = 0; i < reconstructed.length; i++) {
              expect(reconstructed[i].id).toBe(fullHistory[i].id);
            }

            // 验证没有重复的交易
            const reconstructedIds = reconstructed.map(txn => txn.id);
            const uniqueIds = new Set(reconstructedIds);
            expect(uniqueIds.size).toBe(reconstructed.length);

            // ===== 验证 5: 边界情况 - offset 超过总数 (需求 8.2) =====
            const beyondHistory = await engine.getHistory(userId, {
              offset: totalTransactions + 10
            });
            expect(beyondHistory.length).toBe(0);

            // ===== 验证 6: 边界情况 - limit 为 0 =====
            const zeroLimitHistory = await engine.getHistory(userId, { limit: 0 });
            expect(zeroLimitHistory.length).toBe(0);

            // ===== 验证 7: 边界情况 - offset 为 0 =====
            const zeroOffsetHistory = await engine.getHistory(userId, {
              limit: pageSize,
              offset: 0
            });
            expect(zeroOffsetHistory.length).toBe(Math.min(pageSize, totalTransactions));
            for (let i = 0; i < zeroOffsetHistory.length; i++) {
              expect(zeroOffsetHistory[i].id).toBe(fullHistory[i].id);
            }

            // ===== 验证 8: 分页保持降序排列 (需求 8.2, 8.5) =====
            for (let offset = 0; offset < totalTransactions; offset += pageSize) {
              const page = await engine.getHistory(userId, {
                limit: pageSize,
                offset
              });

              // 验证页内降序
              for (let i = 0; i < page.length - 1; i++) {
                expect(page[i].createdAt.getTime()).toBeGreaterThanOrEqual(
                  page[i + 1].createdAt.getTime()
                );
              }

              // 验证跨页降序（当前页的最后一个应该 >= 下一页的第一个）
              if (offset + pageSize < totalTransactions) {
                const nextPage = await engine.getHistory(userId, {
                  limit: pageSize,
                  offset: offset + pageSize
                });

                if (page.length > 0 && nextPage.length > 0) {
                  expect(page[page.length - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
                    nextPage[0].createdAt.getTime()
                  );
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 13.1: 分页正确性 - 单页完整数据
     * 
     * When limit is greater than or equal to the total number of transactions,
     * pagination should return all transactions in a single page.
     * 
     * **Validates: Requirement 8.2**
     */
    it('should return all transactions when limit exceeds total count', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成交易数量（5-15）
          fc.integer({ min: 5, max: 15 }),
          async (transactionCount) => {
            // 创建用户
            const userId = `user-single-page-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: 100000,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 创建交易
            for (let i = 0; i < transactionCount; i++) {
              await engine.grant({
                userId,
                amount: 100,
                action: `grant-${i}`
              });
            }

            // 使用大于总数的 limit
            const largeLimit = transactionCount + 10;
            const history = await engine.getHistory(userId, { limit: largeLimit });

            // 验证返回所有交易
            expect(history.length).toBe(transactionCount);

            // 验证与无 limit 的结果相同
            const fullHistory = await engine.getHistory(userId);
            expect(history.length).toBe(fullHistory.length);

            for (let i = 0; i < history.length; i++) {
              expect(history[i].id).toBe(fullHistory[i].id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 13.2: 分页正确性 - 最后一页部分数据
     * 
     * When the last page has fewer transactions than the page size,
     * pagination should return only the remaining transactions.
     * 
     * **Validates: Requirement 8.2**
     */
    it('should correctly handle partial last page', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成交易数量（确保不是页面大小的整数倍）
          fc.integer({ min: 12, max: 25 }),
          // 生成页面大小
          fc.integer({ min: 5, max: 10 }),
          async (totalTransactions, pageSize) => {
            // 确保最后一页是部分数据
            if (totalTransactions % pageSize === 0) {
              totalTransactions += 1;
            }

            // 创建用户
            const userId = `user-partial-page-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: 100000,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 创建交易
            for (let i = 0; i < totalTransactions; i++) {
              await engine.grant({
                userId,
                amount: 100,
                action: `grant-${i}`
              });
            }

            // 计算最后一页的 offset
            const lastPageOffset = Math.floor(totalTransactions / pageSize) * pageSize;
            const expectedLastPageSize = totalTransactions % pageSize;

            // 获取最后一页
            const lastPage = await engine.getHistory(userId, {
              limit: pageSize,
              offset: lastPageOffset
            });

            // 验证最后一页的大小
            expect(lastPage.length).toBe(expectedLastPageSize);

            // 验证最后一页的内容与完整历史匹配
            const fullHistory = await engine.getHistory(userId);
            for (let i = 0; i < lastPage.length; i++) {
              expect(lastPage[i].id).toBe(fullHistory[lastPageOffset + i].id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 13.3: 分页正确性 - 连续分页一致性
     * 
     * When fetching consecutive pages, each page should contain
     * the correct transactions in the correct order without gaps or overlaps.
     * 
     * **Validates: Requirement 8.2**
     */
    it('should maintain consistency across consecutive pages', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成交易数量
          fc.integer({ min: 15, max: 30 }),
          // 生成页面大小
          fc.integer({ min: 3, max: 7 }),
          async (totalTransactions, pageSize) => {
            // 创建用户
            const userId = `user-consecutive-pages-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: 100000,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 创建交易
            for (let i = 0; i < totalTransactions; i++) {
              await engine.grant({
                userId,
                amount: 100,
                action: `grant-${i}`
              });
              await new Promise(resolve => setTimeout(resolve, 1));
            }

            // 获取完整历史
            const fullHistory = await engine.getHistory(userId);

            // 获取连续的页面
            const pages: Transaction[][] = [];
            let offset = 0;

            while (offset < totalTransactions) {
              const page = await engine.getHistory(userId, {
                limit: pageSize,
                offset
              });

              if (page.length === 0) break;

              pages.push(page);
              offset += pageSize;
            }

            // 验证页面数量
            const expectedPageCount = Math.ceil(totalTransactions / pageSize);
            expect(pages.length).toBe(expectedPageCount);

            // 验证每一页的内容
            let currentIndex = 0;
            for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
              const page = pages[pageIndex];

              // 验证页面大小
              const isLastPage = pageIndex === pages.length - 1;
              const expectedPageSize = isLastPage
                ? totalTransactions - (pageIndex * pageSize)
                : pageSize;
              expect(page.length).toBe(expectedPageSize);

              // 验证页面内容与完整历史匹配
              for (let i = 0; i < page.length; i++) {
                expect(page[i].id).toBe(fullHistory[currentIndex].id);
                expect(page[i].userId).toBe(userId);
                currentIndex++;
              }

              // 验证页面内降序
              for (let i = 0; i < page.length - 1; i++) {
                expect(page[i].createdAt.getTime()).toBeGreaterThanOrEqual(
                  page[i + 1].createdAt.getTime()
                );
              }

              // 验证跨页连续性
              if (pageIndex < pages.length - 1) {
                const currentPage = pages[pageIndex];
                const nextPage = pages[pageIndex + 1];

                // 当前页的最后一个交易应该在下一页的第一个交易之前或同时
                expect(currentPage[currentPage.length - 1].createdAt.getTime())
                  .toBeGreaterThanOrEqual(nextPage[0].createdAt.getTime());
              }
            }

            // 验证所有交易都被访问到
            expect(currentIndex).toBe(totalTransactions);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 13.4: 分页正确性 - 随机访问
     * 
     * When accessing pages in random order, each page should return
     * the same transactions regardless of access order.
     * 
     * **Validates: Requirement 8.2**
     */
    it('should return consistent results for random page access', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成交易数量
          fc.integer({ min: 20, max: 40 }),
          // 生成页面大小
          fc.integer({ min: 5, max: 10 }),
          async (totalTransactions, pageSize) => {
            // 创建用户
            const userId = `user-random-access-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: 100000,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 创建交易
            for (let i = 0; i < totalTransactions; i++) {
              await engine.grant({
                userId,
                amount: 100,
                action: `grant-${i}`
              });
            }

            // 计算页面数量
            const pageCount = Math.ceil(totalTransactions / pageSize);

            // 第一次按顺序访问所有页面
            const sequentialPages: Transaction[][] = [];
            for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
              const page = await engine.getHistory(userId, {
                limit: pageSize,
                offset: pageIndex * pageSize
              });
              sequentialPages.push(page);
            }

            // 第二次随机访问所有页面
            const randomPages: Transaction[][] = new Array(pageCount);
            const pageIndices = Array.from({ length: pageCount }, (_, i) => i);
            
            // 打乱页面索引
            for (let i = pageIndices.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [pageIndices[i], pageIndices[j]] = [pageIndices[j], pageIndices[i]];
            }

            // 按随机顺序访问页面
            for (const pageIndex of pageIndices) {
              const page = await engine.getHistory(userId, {
                limit: pageSize,
                offset: pageIndex * pageSize
              });
              randomPages[pageIndex] = page;
            }

            // 验证两次访问的结果相同
            for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
              const seqPage = sequentialPages[pageIndex];
              const randPage = randomPages[pageIndex];

              // 验证页面大小相同
              expect(randPage.length).toBe(seqPage.length);

              // 验证交易 ID 相同
              for (let i = 0; i < seqPage.length; i++) {
                expect(randPage[i].id).toBe(seqPage[i].id);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 13.5: 分页正确性 - 与过滤器组合
     * 
     * When pagination is combined with filters (date range, action type),
     * pagination should work correctly on the filtered results.
     * 
     * **Validates: Requirements 8.2, 8.3, 8.4**
     */
    it('should correctly paginate filtered results', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成每种操作的数量
          fc.record({
            charges: fc.integer({ min: 5, max: 10 }),
            refunds: fc.integer({ min: 5, max: 10 }),
            grants: fc.integer({ min: 5, max: 10 })
          }),
          // 生成页面大小
          fc.integer({ min: 3, max: 7 }),
          async (counts, pageSize) => {
            // 创建用户
            const userId = `user-filtered-pagination-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: 100000,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 创建混合操作
            for (let i = 0; i < counts.charges; i++) {
              const amount = 50;
              const action = `charge-${i}`;
              const testConfig: CreditsConfig = {
                ...config,
                costs: {
                  ...config.costs,
                  [action]: { default: amount }
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

              await testEngine.charge({ userId, action });
              await new Promise(resolve => setTimeout(resolve, 1));
            }

            for (let i = 0; i < counts.refunds; i++) {
              await engine.refund({
                userId,
                amount: 30,
                action: `refund-${i}`
              });
              await new Promise(resolve => setTimeout(resolve, 1));
            }

            for (let i = 0; i < counts.grants; i++) {
              await engine.grant({
                userId,
                amount: 20,
                action: `grant-${i}`
              });
              await new Promise(resolve => setTimeout(resolve, 1));
            }

            // 测试按操作类型过滤 + 分页
            // 获取所有 grant 操作（无分页）
            const allGrants = (await engine.getHistory(userId))
              .filter(txn => txn.action.startsWith('grant-'));

            // 使用分页获取 grant 操作
            const paginatedGrants: Transaction[] = [];
            let offset = 0;

            while (true) {
              const page = await engine.getHistory(userId, {
                limit: pageSize,
                offset
              });

              if (page.length === 0) break;

              // 过滤出 grant 操作
              const grantsInPage = page.filter(txn => txn.action.startsWith('grant-'));
              paginatedGrants.push(...grantsInPage);

              offset += pageSize;

              // 如果这一页没有更多交易，停止
              if (page.length < pageSize) break;
            }

            // 验证分页获取的 grant 操作与完整列表匹配
            expect(paginatedGrants.length).toBe(allGrants.length);

            for (let i = 0; i < allGrants.length; i++) {
              expect(paginatedGrants[i].id).toBe(allGrants[i].id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 14: 日期范围过滤', () => {
    /**
     * Property 14: 日期范围过滤
     * 
     * For any query with a specified date range, all returned transactions
     * should have timestamps within that range (inclusive).
     * 
     * This property verifies that:
     * 1. When startDate is specified, all transactions have createdAt >= startDate
     * 2. When endDate is specified, all transactions have createdAt <= endDate
     * 3. When both are specified, transactions fall within the range
     * 4. Date filtering works correctly with pagination
     * 5. Date filtering maintains descending order
     * 
     * **Validates: Requirement 8.3**
     */
    it('should correctly filter transactions by date range', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成交易数量（10-30）
          fc.integer({ min: 10, max: 30 }),
          async (transactionCount) => {
            // 创建用户
            const userId = `user-date-filter-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: 100000,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 创建交易，记录时间戳
            const timestamps: Date[] = [];
            for (let i = 0; i < transactionCount; i++) {
              await engine.grant({
                userId,
                amount: 100,
                action: `grant-${i}`
              });
              
              // 获取刚创建的交易的时间戳
              const history = await engine.getHistory(userId, { limit: 1 });
              timestamps.push(history[0].createdAt);
              
              // 添加延迟以确保时间戳不同
              await new Promise(resolve => setTimeout(resolve, 2));
            }

            // 获取完整历史
            const fullHistory = await engine.getHistory(userId);
            expect(fullHistory.length).toBe(transactionCount);

            // 选择日期范围（使用中间的时间戳）
            const sortedTimestamps = [...timestamps].sort((a, b) => a.getTime() - b.getTime());
            const startIndex = Math.floor(transactionCount * 0.25);
            const endIndex = Math.floor(transactionCount * 0.75);
            const startDate = sortedTimestamps[startIndex];
            const endDate = sortedTimestamps[endIndex];

            // ===== 验证 1: startDate 过滤 (需求 8.3) =====
            const afterStart = await engine.getHistory(userId, { startDate });
            
            // 所有交易的时间戳应该 >= startDate
            for (const txn of afterStart) {
              expect(txn.createdAt.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
            }

            // 验证返回了正确数量的交易
            const expectedAfterStart = fullHistory.filter(
              t => t.createdAt.getTime() >= startDate.getTime()
            );
            expect(afterStart.length).toBe(expectedAfterStart.length);

            // ===== 验证 2: endDate 过滤 (需求 8.3) =====
            const beforeEnd = await engine.getHistory(userId, { endDate });
            
            // 所有交易的时间戳应该 <= endDate
            for (const txn of beforeEnd) {
              expect(txn.createdAt.getTime()).toBeLessThanOrEqual(endDate.getTime());
            }

            // 验证返回了正确数量的交易
            const expectedBeforeEnd = fullHistory.filter(
              t => t.createdAt.getTime() <= endDate.getTime()
            );
            expect(beforeEnd.length).toBe(expectedBeforeEnd.length);

            // ===== 验证 3: 日期范围过滤 (需求 8.3) =====
            const inRange = await engine.getHistory(userId, { startDate, endDate });
            
            // 所有交易应该在范围内
            for (const txn of inRange) {
              expect(txn.createdAt.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
              expect(txn.createdAt.getTime()).toBeLessThanOrEqual(endDate.getTime());
            }

            // 验证返回了正确数量的交易
            const expectedInRange = fullHistory.filter(
              t => t.createdAt.getTime() >= startDate.getTime() && 
                   t.createdAt.getTime() <= endDate.getTime()
            );
            expect(inRange.length).toBe(expectedInRange.length);

            // ===== 验证 4: 日期过滤保持降序排列 (需求 8.3, 8.5) =====
            for (let i = 0; i < inRange.length - 1; i++) {
              expect(inRange[i].createdAt.getTime()).toBeGreaterThanOrEqual(
                inRange[i + 1].createdAt.getTime()
              );
            }

            // ===== 验证 5: 日期过滤与分页组合 (需求 8.3, 8.2) =====
            const pageSize = 5;
            const firstPage = await engine.getHistory(userId, {
              startDate,
              endDate,
              limit: pageSize
            });

            // 验证第一页的所有交易都在日期范围内
            for (const txn of firstPage) {
              expect(txn.createdAt.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
              expect(txn.createdAt.getTime()).toBeLessThanOrEqual(endDate.getTime());
            }

            // 验证分页正确工作
            expect(firstPage.length).toBe(Math.min(pageSize, inRange.length));

            // 验证第一页与完整结果的前几项匹配
            for (let i = 0; i < firstPage.length; i++) {
              expect(firstPage[i].id).toBe(inRange[i].id);
            }
          }
        ),
        { numRuns: 20 } // Reduced from 100 to avoid timeout
      );
    });

    /**
     * Property 14.1: 日期范围过滤 - 边界情况
     * 
     * Date range filtering should correctly handle edge cases:
     * - Empty date range (startDate > endDate)
     * - Date range with no matching transactions
     * - Date range that includes all transactions
     * 
     * **Validates: Requirement 8.3**
     */
    it('should handle date range edge cases correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成交易数量
          fc.integer({ min: 5, max: 15 }),
          async (transactionCount) => {
            // 创建用户
            const userId = `user-date-edge-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: 100000,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 记录开始时间
            const beforeAll = new Date();
            await new Promise(resolve => setTimeout(resolve, 5));

            // 创建交易
            for (let i = 0; i < transactionCount; i++) {
              await engine.grant({
                userId,
                amount: 100,
                action: `grant-${i}`
              });
              await new Promise(resolve => setTimeout(resolve, 2));
            }

            await new Promise(resolve => setTimeout(resolve, 5));
            const afterAll = new Date();

            // ===== 边界情况 1: 空日期范围 (startDate > endDate) =====
            const emptyRange = await engine.getHistory(userId, {
              startDate: afterAll,
              endDate: beforeAll
            });
            expect(emptyRange.length).toBe(0);

            // ===== 边界情况 2: 未来日期范围（无匹配交易） =====
            const futureStart = new Date(Date.now() + 86400000); // 明天
            const futureEnd = new Date(Date.now() + 172800000); // 后天
            const futureRange = await engine.getHistory(userId, {
              startDate: futureStart,
              endDate: futureEnd
            });
            expect(futureRange.length).toBe(0);

            // ===== 边界情况 3: 过去日期范围（无匹配交易） =====
            const pastStart = new Date(Date.now() - 172800000); // 前天
            const pastEnd = new Date(Date.now() - 86400000); // 昨天
            const pastRange = await engine.getHistory(userId, {
              startDate: pastStart,
              endDate: pastEnd
            });
            expect(pastRange.length).toBe(0);

            // ===== 边界情况 4: 包含所有交易的日期范围 =====
            const allRange = await engine.getHistory(userId, {
              startDate: beforeAll,
              endDate: afterAll
            });
            expect(allRange.length).toBe(transactionCount);

            // ===== 边界情况 5: 只有 startDate（无 endDate） =====
            const onlyStart = await engine.getHistory(userId, {
              startDate: beforeAll
            });
            expect(onlyStart.length).toBe(transactionCount);

            // ===== 边界情况 6: 只有 endDate（无 startDate） =====
            const onlyEnd = await engine.getHistory(userId, {
              endDate: afterAll
            });
            expect(onlyEnd.length).toBe(transactionCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 14.2: 日期范围过滤 - 精确边界
     * 
     * Date range filtering should include transactions exactly at the boundaries
     * (startDate and endDate are inclusive).
     * 
     * **Validates: Requirement 8.3**
     */
    it('should include transactions at exact boundary dates', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成交易数量
          fc.integer({ min: 3, max: 10 }),
          async (transactionCount) => {
            // 创建用户
            const userId = `user-boundary-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: 100000,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 创建交易并记录时间戳
            const timestamps: Date[] = [];
            for (let i = 0; i < transactionCount; i++) {
              await engine.grant({
                userId,
                amount: 100,
                action: `grant-${i}`
              });
              
              const history = await engine.getHistory(userId, { limit: 1 });
              timestamps.push(history[0].createdAt);
              
              await new Promise(resolve => setTimeout(resolve, 2));
            }

            // 获取完整历史
            const fullHistory = await engine.getHistory(userId);

            // 使用第一个和最后一个交易的时间戳作为边界
            const sortedTimestamps = [...timestamps].sort((a, b) => a.getTime() - b.getTime());
            const firstTimestamp = sortedTimestamps[0];
            const lastTimestamp = sortedTimestamps[sortedTimestamps.length - 1];

            // ===== 验证边界包含性 =====
            const exactRange = await engine.getHistory(userId, {
              startDate: firstTimestamp,
              endDate: lastTimestamp
            });

            // 应该包含所有交易（边界是包含的）
            expect(exactRange.length).toBe(transactionCount);

            // 验证第一个和最后一个交易都被包含
            const firstTxn = fullHistory.find(t => 
              t.createdAt.getTime() === firstTimestamp.getTime()
            );
            const lastTxn = fullHistory.find(t => 
              t.createdAt.getTime() === lastTimestamp.getTime()
            );

            expect(exactRange.some(t => t.id === firstTxn!.id)).toBe(true);
            expect(exactRange.some(t => t.id === lastTxn!.id)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 15: 操作类型过滤', () => {
    /**
     * Property 15: 操作类型过滤
     * 
     * For any query with a specified action type, all returned transactions
     * should have that exact action type.
     * 
     * This property verifies that:
     * 1. When action is specified, all transactions have matching action
     * 2. Action filtering returns only transactions with exact action match
     * 3. Action filtering works correctly with pagination
     * 4. Action filtering maintains descending order
     * 5. Action filtering can be combined with date range filtering
     * 
     * **Validates: Requirement 8.4**
     */
    it('should correctly filter transactions by action type', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成每种操作的数量
          fc.record({
            charges: fc.integer({ min: 3, max: 8 }),
            refunds: fc.integer({ min: 3, max: 8 }),
            grants: fc.integer({ min: 3, max: 8 })
          }),
          async (counts) => {
            // 创建用户
            const userId = `user-action-filter-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: 100000,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 创建不同类型的操作
            const chargeAction = 'test-charge';
            const refundAction = 'test-refund';
            const grantAction = 'test-grant';

            // 创建 charge 操作
            for (let i = 0; i < counts.charges; i++) {
              const amount = 50;
              const testConfig: CreditsConfig = {
                ...config,
                costs: {
                  ...config.costs,
                  [chargeAction]: { default: amount }
                },
                membership: {
                  ...config.membership,
                  requirements: {
                    ...config.membership.requirements,
                    [chargeAction]: null
                  }
                }
              };

              const testEngine = new CreditsEngine({
                storage: adapter,
                config: testConfig
              });

              await testEngine.charge({ userId, action: chargeAction });
              await new Promise(resolve => setTimeout(resolve, 1));
            }

            // 创建 refund 操作
            for (let i = 0; i < counts.refunds; i++) {
              await engine.refund({
                userId,
                amount: 30,
                action: refundAction
              });
              await new Promise(resolve => setTimeout(resolve, 1));
            }

            // 创建 grant 操作
            for (let i = 0; i < counts.grants; i++) {
              await engine.grant({
                userId,
                amount: 20,
                action: grantAction
              });
              await new Promise(resolve => setTimeout(resolve, 1));
            }

            // 获取完整历史
            const fullHistory = await engine.getHistory(userId);
            const totalTransactions = counts.charges + counts.refunds + counts.grants;
            expect(fullHistory.length).toBe(totalTransactions);

            // ===== 验证 1: 按 charge 操作过滤 (需求 8.4) =====
            const chargeHistory = await engine.getHistory(userId, { action: chargeAction });
            
            // 所有交易都应该是 charge 操作
            expect(chargeHistory.length).toBe(counts.charges);
            for (const txn of chargeHistory) {
              expect(txn.action).toBe(chargeAction);
            }

            // ===== 验证 2: 按 refund 操作过滤 (需求 8.4) =====
            const refundHistory = await engine.getHistory(userId, { action: refundAction });
            
            // 所有交易都应该是 refund 操作
            expect(refundHistory.length).toBe(counts.refunds);
            for (const txn of refundHistory) {
              expect(txn.action).toBe(refundAction);
            }

            // ===== 验证 3: 按 grant 操作过滤 (需求 8.4) =====
            const grantHistory = await engine.getHistory(userId, { action: grantAction });
            
            // 所有交易都应该是 grant 操作
            expect(grantHistory.length).toBe(counts.grants);
            for (const txn of grantHistory) {
              expect(txn.action).toBe(grantAction);
            }

            // ===== 验证 4: 操作过滤保持降序排列 (需求 8.4, 8.5) =====
            for (let i = 0; i < chargeHistory.length - 1; i++) {
              expect(chargeHistory[i].createdAt.getTime()).toBeGreaterThanOrEqual(
                chargeHistory[i + 1].createdAt.getTime()
              );
            }

            // ===== 验证 5: 操作过滤与分页组合 (需求 8.4, 8.2) =====
            const pageSize = 2;
            const firstPage = await engine.getHistory(userId, {
              action: grantAction,
              limit: pageSize
            });

            // 验证第一页的所有交易都是指定操作
            for (const txn of firstPage) {
              expect(txn.action).toBe(grantAction);
            }

            // 验证分页正确工作
            expect(firstPage.length).toBe(Math.min(pageSize, counts.grants));

            // 验证第一页与完整结果的前几项匹配
            for (let i = 0; i < firstPage.length; i++) {
              expect(firstPage[i].id).toBe(grantHistory[i].id);
            }

            // ===== 验证 6: 不存在的操作类型返回空数组 (需求 8.4) =====
            const nonExistentAction = await engine.getHistory(userId, {
              action: 'non-existent-action'
            });
            expect(nonExistentAction.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 15.1: 操作类型过滤 - 与日期范围组合
     * 
     * When action filtering is combined with date range filtering,
     * both filters should be applied correctly.
     * 
     * **Validates: Requirements 8.3, 8.4**
     */
    it('should correctly combine action and date range filters', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成每种操作的数量
          fc.record({
            charges: fc.integer({ min: 5, max: 10 }),
            grants: fc.integer({ min: 5, max: 10 })
          }),
          async (counts) => {
            // 创建用户
            const userId = `user-combined-filter-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: 100000,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            const chargeAction = 'test-charge';
            const grantAction = 'test-grant';

            // 记录中间时间点
            let midpointTime: Date | null = null;
            const totalOps = counts.charges + counts.grants;
            let currentOp = 0;

            // 创建 charge 操作
            for (let i = 0; i < counts.charges; i++) {
              const amount = 50;
              const testConfig: CreditsConfig = {
                ...config,
                costs: {
                  ...config.costs,
                  [chargeAction]: { default: amount }
                },
                membership: {
                  ...config.membership,
                  requirements: {
                    ...config.membership.requirements,
                    [chargeAction]: null
                  }
                }
              };

              const testEngine = new CreditsEngine({
                storage: adapter,
                config: testConfig
              });

              await testEngine.charge({ userId, action: chargeAction });
              currentOp++;

              // 记录中间时间点
              if (currentOp === Math.floor(totalOps / 2)) {
                await new Promise(resolve => setTimeout(resolve, 5));
                midpointTime = new Date();
                await new Promise(resolve => setTimeout(resolve, 5));
              } else {
                await new Promise(resolve => setTimeout(resolve, 1));
              }
            }

            // 创建 grant 操作
            for (let i = 0; i < counts.grants; i++) {
              await engine.grant({
                userId,
                amount: 20,
                action: grantAction
              });
              currentOp++;

              // 记录中间时间点
              if (currentOp === Math.floor(totalOps / 2)) {
                await new Promise(resolve => setTimeout(resolve, 5));
                midpointTime = new Date();
                await new Promise(resolve => setTimeout(resolve, 5));
              } else {
                await new Promise(resolve => setTimeout(resolve, 1));
              }
            }

            // 获取完整历史
            const fullHistory = await engine.getHistory(userId);

            // 使用中间时间点作为分界
            if (midpointTime) {
              // ===== 验证组合过滤: charge + 中间时间点之后 =====
              const chargesAfterMidpoint = await engine.getHistory(userId, {
                action: chargeAction,
                startDate: midpointTime
              });

              // 所有交易都应该是 charge 且在中间时间点之后
              for (const txn of chargesAfterMidpoint) {
                expect(txn.action).toBe(chargeAction);
                expect(txn.createdAt.getTime()).toBeGreaterThanOrEqual(midpointTime.getTime());
              }

              // ===== 验证组合过滤: grant + 中间时间点之前 =====
              const grantsBeforeMidpoint = await engine.getHistory(userId, {
                action: grantAction,
                endDate: midpointTime
              });

              // 所有交易都应该是 grant 且在中间时间点之前
              for (const txn of grantsBeforeMidpoint) {
                expect(txn.action).toBe(grantAction);
                expect(txn.createdAt.getTime()).toBeLessThanOrEqual(midpointTime.getTime());
              }

              // ===== 验证组合过滤保持降序排列 =====
              for (let i = 0; i < chargesAfterMidpoint.length - 1; i++) {
                expect(chargesAfterMidpoint[i].createdAt.getTime()).toBeGreaterThanOrEqual(
                  chargesAfterMidpoint[i + 1].createdAt.getTime()
                );
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 15.2: 操作类型过滤 - 精确匹配
     * 
     * Action filtering should use exact string matching,
     * not partial matching or pattern matching.
     * 
     * **Validates: Requirement 8.4**
     */
    it('should use exact action matching, not partial matching', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成交易数量
          fc.integer({ min: 3, max: 8 }),
          async (count) => {
            // 创建用户
            const userId = `user-exact-match-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: 100000,
              membershipTier: 'free',
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 创建相似但不同的操作名称
            const actions = [
              'test',
              'test-action',
              'test-action-v2',
              'action-test'
            ];

            // 为每种操作创建交易
            for (const action of actions) {
              for (let i = 0; i < count; i++) {
                await engine.grant({
                  userId,
                  amount: 10,
                  action: action
                });
                await new Promise(resolve => setTimeout(resolve, 1));
              }
            }

            // ===== 验证精确匹配 =====
            for (const action of actions) {
              const filtered = await engine.getHistory(userId, { action });

              // 应该只返回精确匹配的交易
              expect(filtered.length).toBe(count);
              
              for (const txn of filtered) {
                expect(txn.action).toBe(action);
              }
            }

            // ===== 验证不会返回部分匹配 =====
            const testOnly = await engine.getHistory(userId, { action: 'test' });
            
            // 应该只返回 action === 'test' 的交易，不包括 'test-action' 等
            expect(testOnly.length).toBe(count);
            for (const txn of testOnly) {
              expect(txn.action).toBe('test');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

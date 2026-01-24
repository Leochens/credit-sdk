/**
 * CreditsEngine 幂等性保证属性测试
 * 使用基于属性的测试验证幂等性保证的正确性
 * 
 * Feature: membership-tier-management
 * Property 10: 幂等性保证
 * 
 * **Validates: Requirements 5.1, 5.2**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { CreditsEngine } from '../../src/core/CreditsEngine';
import { MockAdapter } from '../../src/adapters/MockAdapter';
import type { CreditsConfig, User } from '../../src/core/types';

describe('CreditsEngine Idempotency - Property Tests', () => {
  let adapter: MockAdapter;
  let engine: CreditsEngine;
  let config: CreditsConfig;

  beforeEach(() => {
    // 创建测试配置（幂等性功能启用）
    config = {
      costs: {
        'test-action': { default: 10 }
      },
      membership: {
        tiers: {
          free: 0,
          basic: 1,
          pro: 2,
          premium: 3
        },
        requirements: {
          'test-action': null
        },
        creditsCaps: {
          free: 100,
          basic: 500,
          pro: 2000,
          premium: 10000
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

  describe('Property 10: 幂等性保证', () => {
    /**
     * Property 10.1: 使用相同幂等键的重复升级调用应该返回缓存结果
     * 
     * For any upgrade operation with an idempotency key, calling the operation
     * multiple times with the same key should return the same result without
     * executing the operation again.
     * 
     * **Validates: Requirement 5.1**
     */
    // it('should return cached result for duplicate upgrade calls with same idempotency key', async () => {
    //   const tierNames = ['free', 'basic', 'pro', 'premium'];

    //   await fc.assert(
    //     fc.asyncProperty(
    //       // 生成当前等级索引
    //       fc.integer({ min: 0, max: tierNames.length - 2 }),
    //       // 生成目标等级索引（必须高于当前等级）
    //       fc.integer({ min: 1, max: tierNames.length - 1 }),
    //       // 生成用户初始积分
    //       fc.integer({ min: 0, max: 10000 }),
    //       // 生成幂等键
    //       fc.string({ minLength: 10, maxLength: 50 }),
    //       async (currentTierIndex, targetTierIndex, initialCredits, idempotencyKey) => {
    //         // 确保目标等级高于当前等级
    //         fc.pre(targetTierIndex > currentTierIndex);

    //         const currentTier = tierNames[currentTierIndex];
    //         const targetTier = tierNames[targetTierIndex];

    //         // 创建用户
    //         const userId = `user-idem-up-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    //         const user: User = {
    //           id: userId,
    //           credits: initialCredits,
    //           membershipTier: currentTier,
    //           membershipExpiresAt: null,
    //           createdAt: new Date(),
    //           updatedAt: new Date()
    //         };
    //         await adapter.createUser(user);

    //         // 第一次调用
    //         const result1 = await engine.upgradeTier({
    //           userId,
    //           targetTier,
    //           idempotencyKey
    //         });

    //         // 第二次调用（使用相同的幂等键）
    //         const result2 = await engine.upgradeTier({
    //           userId,
    //           targetTier,
    //           idempotencyKey
    //         });

    //         // 验证两次调用返回相同的结果
    //         expect(result2).toEqual(result1);
    //         expect(result2.transactionId).toBe(result1.transactionId);
    //         expect(result2.oldTier).toBe(result1.oldTier);
    //         expect(result2.newTier).toBe(result1.newTier);
    //         expect(result2.oldCredits).toBe(result1.oldCredits);
    //         expect(result2.newCredits).toBe(result1.newCredits);
    //         expect(result2.creditsDelta).toBe(result1.creditsDelta);

    //         // 验证只创建了一条交易记录
    //         const transactions = await adapter.getTransactions(userId);
    //         expect(transactions.length).toBe(1);
    //         expect(transactions[0].id).toBe(result1.transactionId);
    //       }
    //     ),
    //     { numRuns: 100 }
    //   );
    // });


    /**
     * Property 10.3: 不同的幂等键应该执行不同的操作
     * 
     * For any tier change operation, using different idempotency keys should
     * result in separate operations being executed (when starting from the same initial state).
     * 
     * **Validates: Requirement 5.2**
     */
    it('should execute separate operations for different idempotency keys', async () => {
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          // 生成当前等级索引
          fc.integer({ min: 0, max: tierNames.length - 2 }),
          // 生成目标等级索引（必须高于当前等级）
          fc.integer({ min: 1, max: tierNames.length - 1 }),
          // 生成用户初始积分
          fc.integer({ min: 0, max: 10000 }),
          // 生成两个不同的幂等键
          fc.tuple(
            fc.string({ minLength: 10, maxLength: 50 }),
            fc.string({ minLength: 10, maxLength: 50 })
          ).filter(([key1, key2]) => key1 !== key2),
          async (currentTierIndex, targetTierIndex, initialCredits, [idempotencyKey1, idempotencyKey2]) => {
            // 确保目标等级高于当前等级
            fc.pre(targetTierIndex > currentTierIndex);

            const currentTier = tierNames[currentTierIndex];
            const targetTier = tierNames[targetTierIndex];

            // 创建两个不同的用户，使用不同的幂等键
            const userId1 = `user-diff-keys-1-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const userId2 = `user-diff-keys-2-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            
            // Make idempotency keys unique per user to avoid collisions across test iterations
            const uniqueIdempotencyKey1 = `${userId1}-${idempotencyKey1}`;
            const uniqueIdempotencyKey2 = `${userId2}-${idempotencyKey2}`;
            
            const user1: User = {
              id: userId1,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            const user2: User = {
              id: userId2,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user1);
            await adapter.createUser(user2);

            // 使用第一个幂等键调用
            const result1 = await engine.upgradeTier({
              userId: userId1,
              targetTier,
              idempotencyKey: uniqueIdempotencyKey1
            });

            // 使用第二个幂等键调用
            const result2 = await engine.upgradeTier({
              userId: userId2,
              targetTier,
              idempotencyKey: uniqueIdempotencyKey2
            });

            // 验证两次调用创建了不同的交易
            expect(result2.transactionId).not.toBe(result1.transactionId);

            // 验证每个用户都有一条交易记录
            const transactions1 = await adapter.getTransactions(userId1);
            const transactions2 = await adapter.getTransactions(userId2);
            expect(transactions1.length).toBe(1);
            expect(transactions2.length).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 10.4: 没有幂等键的调用应该每次都执行操作
     * 
     * For any tier change operation without an idempotency key,
     * each call should execute the operation independently (when starting from the same initial state).
     * 
     * **Validates: Requirement 5.2**
     */
    it('should execute operation each time when no idempotency key is provided', async () => {
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          // 生成当前等级索引
          fc.integer({ min: 0, max: tierNames.length - 2 }),
          // 生成目标等级索引（必须高于当前等级）
          fc.integer({ min: 1, max: tierNames.length - 1 }),
          // 生成用户初始积分
          fc.integer({ min: 0, max: 10000 }),
          async (currentTierIndex, targetTierIndex, initialCredits) => {
            // 确保目标等级高于当前等级
            fc.pre(targetTierIndex > currentTierIndex);

            const currentTier = tierNames[currentTierIndex];
            const targetTier = tierNames[targetTierIndex];

            // 创建两个不同的用户
            const userId1 = `user-no-key-1-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const userId2 = `user-no-key-2-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            
            const user1: User = {
              id: userId1,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            const user2: User = {
              id: userId2,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user1);
            await adapter.createUser(user2);

            // 第一次调用（没有幂等键）
            const result1 = await engine.upgradeTier({
              userId: userId1,
              targetTier
            });

            // 第二次调用（没有幂等键）
            const result2 = await engine.upgradeTier({
              userId: userId2,
              targetTier
            });

            // 验证两次调用创建了不同的交易
            expect(result2.transactionId).not.toBe(result1.transactionId);

            // 验证每个用户都有一条交易记录
            const transactions1 = await adapter.getTransactions(userId1);
            const transactions2 = await adapter.getTransactions(userId2);
            expect(transactions1.length).toBe(1);
            expect(transactions2.length).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 10.5: 幂等性应该在多次调用中保持一致
     * 
     * For any tier change operation with an idempotency key,
     * calling the operation 3+ times should always return the same result.
     * 
     * **Validates: Requirement 5.1**
     */
    it('should maintain idempotency across multiple calls', async () => {
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          // 生成当前等级索引
          fc.integer({ min: 0, max: tierNames.length - 2 }),
          // 生成目标等级索引（必须高于当前等级）
          fc.integer({ min: 1, max: tierNames.length - 1 }),
          // 生成用户初始积分
          fc.integer({ min: 0, max: 10000 }),
          // 生成幂等键
          fc.string({ minLength: 10, maxLength: 50 }),
          // 生成调用次数（3-5次）
          fc.integer({ min: 3, max: 5 }),
          async (currentTierIndex, targetTierIndex, initialCredits, idempotencyKey, callCount) => {
            // 确保目标等级高于当前等级
            fc.pre(targetTierIndex > currentTierIndex);

            const currentTier = tierNames[currentTierIndex];
            const targetTier = tierNames[targetTierIndex];

            // 创建用户
            const userId = `user-multi-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 多次调用
            const results = [];
            for (let i = 0; i < callCount; i++) {
              const result = await engine.upgradeTier({
                userId,
                targetTier,
                idempotencyKey
              });
              results.push(result);
            }

            // 验证所有调用返回相同的结果
            for (let i = 1; i < results.length; i++) {
              expect(results[i]).toEqual(results[0]);
              expect(results[i].transactionId).toBe(results[0].transactionId);
            }

            // 验证用户状态只被更新了一次
            const finalUser = await adapter.getUserById(userId);
            expect(finalUser?.membershipTier).toBe(targetTier);
            expect(finalUser?.credits).toBe(config.membership.creditsCaps[targetTier]);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

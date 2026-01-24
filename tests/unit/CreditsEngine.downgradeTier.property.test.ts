/**
 * CreditsEngine.downgradeTier 属性测试
 * 使用基于属性的测试验证降级功能的通用正确性属性
 * 
 * Feature: membership-tier-management
 * Property 1: 等级变更方向验证（降级部分）
 * 
 * **Validates: Requirements 2.1, 2.7**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { CreditsEngine } from '../../src/core/CreditsEngine';
import { MockAdapter } from '../../src/adapters/MockAdapter';
import {
  InvalidTierChangeError,
  UndefinedTierError,
  UserNotFoundError
} from '../../src/core/errors';
import type { CreditsConfig, User } from '../../src/core/types';

describe('CreditsEngine.downgradeTier - Property Tests', () => {
  let adapter: MockAdapter;
  let engine: CreditsEngine;
  let config: CreditsConfig;

  beforeEach(() => {
    // 创建测试配置
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

  describe('Property 1: 等级变更方向验证（降级部分）', () => {
    /**
     * Property 1.1: 降级操作应该只在目标等级低于当前等级时成功
     * 
     * For any user with a current tier and any target tier that is lower,
     * the downgrade operation should succeed.
     * 
     * **Validates: Requirement 2.1**
     */
    it('should succeed when target tier is lower than current tier', async () => {
      // 定义等级列表（按等级从低到高）
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          // 生成当前等级索引（1-3，不包括最低等级）
          fc.integer({ min: 1, max: tierNames.length - 1 }),
          // 生成目标等级索引（必须低于当前等级）
          fc.integer({ min: 0, max: tierNames.length - 2 }),
          // 生成用户初始积分
          fc.integer({ min: 0, max: 10000 }),
          async (currentTierIndex, targetTierIndex, initialCredits) => {
            // 确保目标等级低于当前等级
            fc.pre(targetTierIndex < currentTierIndex);

            const currentTier = tierNames[currentTierIndex];
            const targetTier = tierNames[targetTierIndex];

            // 创建用户
            const userId = `user-${currentTierIndex}-${targetTierIndex}-${initialCredits}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行降级
            const result = await engine.downgradeTier({
              userId,
              targetTier
            });

            // 验证降级成功
            expect(result.success).toBe(true);
            expect(result.oldTier).toBe(currentTier);
            expect(result.newTier).toBe(targetTier);
            expect(result.newCredits).toBe(config.membership.creditsCaps[targetTier]);

            // 验证用户状态已更新
            const updatedUser = await adapter.getUserById(userId);
            expect(updatedUser?.membershipTier).toBe(targetTier);
            expect(updatedUser?.credits).toBe(config.membership.creditsCaps[targetTier]);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 1.2: 降级操作应该在目标等级等于当前等级时失败
     * 
     * For any user with a current tier, attempting to "downgrade" to the same tier
     * should throw InvalidTierChangeError.
     * 
     * **Validates: Requirement 2.7**
     */
    it('should throw InvalidTierChangeError when target tier equals current tier', async () => {
      // 定义等级列表
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          // 生成等级索引
          fc.integer({ min: 0, max: tierNames.length - 1 }),
          // 生成用户初始积分
          fc.integer({ min: 0, max: 10000 }),
          async (tierIndex, initialCredits) => {
            const tier = tierNames[tierIndex];

            // 创建用户
            const userId = `user-same-${tierIndex}-${initialCredits}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: tier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 尝试"降级"到相同等级
            await expect(
              engine.downgradeTier({
                userId,
                targetTier: tier
              })
            ).rejects.toThrow(InvalidTierChangeError);

            // 验证错误消息包含正确的信息
            try {
              await engine.downgradeTier({
                userId,
                targetTier: tier
              });
            } catch (error) {
              expect(error).toBeInstanceOf(InvalidTierChangeError);
              if (error instanceof InvalidTierChangeError) {
                expect(error.message).toContain('Target tier must be lower than current tier');
                expect(error.userId).toBe(userId);
                expect(error.currentTier).toBe(tier);
                expect(error.targetTier).toBe(tier);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 1.3: 降级操作应该在目标等级高于当前等级时失败
     * 
     * For any user with a current tier, attempting to "downgrade" to a higher tier
     * should throw InvalidTierChangeError.
     * 
     * **Validates: Requirement 2.7**
     */
    it('should throw InvalidTierChangeError when target tier is higher than current tier', async () => {
      // 定义等级列表
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          // 生成当前等级索引（0-2，不包括最高等级）
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

            // 创建用户
            const userId = `user-higher-${currentTierIndex}-${targetTierIndex}-${initialCredits}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 尝试"降级"到更高等级
            await expect(
              engine.downgradeTier({
                userId,
                targetTier
              })
            ).rejects.toThrow(InvalidTierChangeError);

            // 验证错误消息包含正确的信息
            try {
              await engine.downgradeTier({
                userId,
                targetTier
              });
            } catch (error) {
              expect(error).toBeInstanceOf(InvalidTierChangeError);
              if (error instanceof InvalidTierChangeError) {
                expect(error.message).toContain('Target tier must be lower than current tier');
                expect(error.userId).toBe(userId);
                expect(error.currentTier).toBe(currentTier);
                expect(error.targetTier).toBe(targetTier);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 1.4: 从任何定义的等级降级到 null 应该失败
     * 
     * For any user with a defined membership tier, attempting to downgrade to null
     * should throw InvalidTierChangeError (null is not a valid target tier).
     * 
     * **Validates: Requirement 2.7**
     */
    it('should throw error when attempting to downgrade to null tier', async () => {
      // 定义等级列表
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          // 生成当前等级索引
          fc.integer({ min: 0, max: tierNames.length - 1 }),
          // 生成用户初始积分
          fc.integer({ min: 0, max: 10000 }),
          async (currentTierIndex, initialCredits) => {
            const currentTier = tierNames[currentTierIndex];

            // 创建用户
            const userId = `user-to-null-${currentTierIndex}-${initialCredits}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 尝试降级到 null（应该抛出错误，因为 null 不在配置中）
            await expect(
              engine.downgradeTier({
                userId,
                targetTier: null as any
              })
            ).rejects.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: 等级字段更新（降级部分）', () => {
    /**
     * Property 2: 等级字段更新
     * 
     * For any successful downgrade operation, the user's membershipTier field
     * should be updated to the target tier.
     * 
     * **Validates: Requirement 2.2**
     */
    it('should update user membershipTier field to target tier', async () => {
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: tierNames.length - 1 }),
          fc.integer({ min: 0, max: tierNames.length - 2 }),
          fc.integer({ min: 0, max: 10000 }),
          async (currentTierIndex, targetTierIndex, initialCredits) => {
            fc.pre(targetTierIndex < currentTierIndex);

            const currentTier = tierNames[currentTierIndex];
            const targetTier = tierNames[targetTierIndex];

            const userId = `user-tier-update-${currentTierIndex}-${targetTierIndex}-${initialCredits}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // Execute downgrade
            const result = await engine.downgradeTier({
              userId,
              targetTier
            });

            // Verify the result contains the correct tier information
            expect(result.oldTier).toBe(currentTier);
            expect(result.newTier).toBe(targetTier);

            // Verify the user's membershipTier field is updated
            const updatedUser = await adapter.getUserById(userId);
            expect(updatedUser).not.toBeNull();
            expect(updatedUser?.membershipTier).toBe(targetTier);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 2.1: 降级操作不应该改变用户的其他属性（除了等级、积分和可选的到期时间）
     * 
     * For any successful downgrade operation, only the membershipTier, credits,
     * and optionally membershipExpiresAt should change. Other user properties
     * should remain unchanged.
     * 
     * **Validates: Requirement 2.2**
     */
    it('should only change tier, credits, and optionally expiration date', async () => {
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: tierNames.length - 1 }),
          fc.integer({ min: 0, max: tierNames.length - 2 }),
          fc.integer({ min: 0, max: 10000 }),
          async (currentTierIndex, targetTierIndex, initialCredits) => {
            fc.pre(targetTierIndex < currentTierIndex);

            const currentTier = tierNames[currentTierIndex];
            const targetTier = tierNames[targetTierIndex];

            // 创建用户
            const userId = `user-props-${currentTierIndex}-${targetTierIndex}-${initialCredits}`;
            const createdAt = new Date('2024-01-01');
            const expiresAt = new Date('2025-01-01');
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: expiresAt,
              createdAt,
              updatedAt: new Date('2024-01-02')
            };
            await adapter.createUser(user);

            // 执行降级（不清除到期时间）
            await engine.downgradeTier({
              userId,
              targetTier,
              clearExpiration: false
            });

            // 获取更新后的用户
            const updatedUser = await adapter.getUserById(userId);

            // 验证只有等级和积分改变
            expect(updatedUser?.id).toBe(userId);
            expect(updatedUser?.membershipTier).toBe(targetTier);
            expect(updatedUser?.credits).toBe(config.membership.creditsCaps[targetTier]);
            expect(updatedUser?.createdAt).toEqual(createdAt);
            // membershipExpiresAt 应该保持不变
            expect(updatedUser?.membershipExpiresAt).toEqual(expiresAt);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: 积分上限应用（降级部分）', () => {
    /**
     * Property 3: 积分上限应用
     * 
     * For any successful downgrade operation, the user's credits should be set
     * to the credits cap defined for the target tier in the configuration.
     * 
     * **Validates: Requirement 2.3**
     */
    it('should set user credits to target tier credits cap', async () => {
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: tierNames.length - 1 }),
          fc.integer({ min: 0, max: tierNames.length - 2 }),
          fc.integer({ min: 0, max: 10000 }),
          async (currentTierIndex, targetTierIndex, initialCredits) => {
            fc.pre(targetTierIndex < currentTierIndex);

            const currentTier = tierNames[currentTierIndex];
            const targetTier = tierNames[targetTierIndex];
            const expectedCredits = config.membership.creditsCaps[targetTier];

            const userId = `user-credits-cap-${currentTierIndex}-${targetTierIndex}-${initialCredits}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // Execute downgrade
            const result = await engine.downgradeTier({
              userId,
              targetTier
            });

            // Verify the result contains the correct credits information
            expect(result.oldCredits).toBe(initialCredits);
            expect(result.newCredits).toBe(expectedCredits);
            expect(result.creditsDelta).toBe(expectedCredits - initialCredits);

            // Verify the user's credits are set to the target tier's cap
            const updatedUser = await adapter.getUserById(userId);
            expect(updatedUser).not.toBeNull();
            expect(updatedUser?.credits).toBe(expectedCredits);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 3.1: 积分上限应用与初始积分无关
     * 
     * For any successful downgrade operation, regardless of the user's initial
     * credits (whether higher or lower than the target cap), the final credits
     * should always be the target tier's credits cap.
     * 
     * **Validates: Requirement 2.3**
     */
    it('should apply credits cap regardless of initial credits', async () => {
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: tierNames.length - 1 }),
          fc.integer({ min: 0, max: tierNames.length - 2 }),
          // Generate initial credits that could be higher or lower than any cap
          fc.integer({ min: 0, max: 20000 }),
          async (currentTierIndex, targetTierIndex, initialCredits) => {
            fc.pre(targetTierIndex < currentTierIndex);

            const currentTier = tierNames[currentTierIndex];
            const targetTier = tierNames[targetTierIndex];
            const expectedCredits = config.membership.creditsCaps[targetTier];

            const userId = `user-credits-any-${currentTierIndex}-${targetTierIndex}-${initialCredits}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // Execute downgrade
            await engine.downgradeTier({
              userId,
              targetTier
            });

            // Verify the user's credits are exactly the target tier's cap
            const updatedUser = await adapter.getUserById(userId);
            expect(updatedUser).not.toBeNull();
            expect(updatedUser?.credits).toBe(expectedCredits);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 3.2: 降级通常会导致积分减少
     * 
     * For most downgrade operations (when initial credits are higher than target cap),
     * the credits delta should be negative, representing a loss of credits.
     * 
     * **Validates: Requirement 2.3**
     */
    it('should typically result in negative credits delta', async () => {
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: tierNames.length - 1 }),
          fc.integer({ min: 0, max: tierNames.length - 2 }),
          async (currentTierIndex, targetTierIndex) => {
            fc.pre(targetTierIndex < currentTierIndex);

            const currentTier = tierNames[currentTierIndex];
            const targetTier = tierNames[targetTierIndex];
            const targetCap = config.membership.creditsCaps[targetTier];
            
            // Set initial credits higher than target cap
            const initialCredits = targetCap + 1000;

            const userId = `user-neg-delta-${currentTierIndex}-${targetTierIndex}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // Execute downgrade
            const result = await engine.downgradeTier({
              userId,
              targetTier
            });

            // Verify negative credits delta
            expect(result.creditsDelta).toBe(targetCap - initialCredits);
            expect(result.creditsDelta).toBeLessThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4: 交易记录创建（降级部分）', () => {
    /**
     * Property 4: 交易记录创建
     * 
     * For any successful downgrade operation, the system should create a
     * transaction record that documents the credits change and tier change details.
     * 
     * **Validates: Requirement 2.4**
     */
    it('should create transaction record for downgrade operation', async () => {
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: tierNames.length - 1 }),
          fc.integer({ min: 0, max: tierNames.length - 2 }),
          fc.integer({ min: 0, max: 10000 }),
          async (currentTierIndex, targetTierIndex, initialCredits) => {
            fc.pre(targetTierIndex < currentTierIndex);

            const currentTier = tierNames[currentTierIndex];
            const targetTier = tierNames[targetTierIndex];
            const expectedCredits = config.membership.creditsCaps[targetTier];

            const userId = `user-txn-${currentTierIndex}-${targetTierIndex}-${initialCredits}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // Execute downgrade
            const result = await engine.downgradeTier({
              userId,
              targetTier
            });

            // Verify a transaction ID is returned
            expect(result.transactionId).toBeDefined();
            expect(typeof result.transactionId).toBe('string');
            expect(result.transactionId.length).toBeGreaterThan(0);

            // Verify the transaction record exists
            const transactions = await adapter.getTransactions(userId);
            const downgradeTransaction = transactions.find(
              txn => txn.id === result.transactionId
            );

            expect(downgradeTransaction).toBeDefined();
            expect(downgradeTransaction?.userId).toBe(userId);
            expect(downgradeTransaction?.action).toBe('tier-downgrade');
            expect(downgradeTransaction?.amount).toBe(expectedCredits - initialCredits);
            expect(downgradeTransaction?.balanceBefore).toBe(initialCredits);
            expect(downgradeTransaction?.balanceAfter).toBe(expectedCredits);

            // Verify transaction metadata contains tier change details
            expect(downgradeTransaction?.metadata).toBeDefined();
            expect(downgradeTransaction?.metadata?.oldTier).toBe(currentTier);
            expect(downgradeTransaction?.metadata?.newTier).toBe(targetTier);
            expect(downgradeTransaction?.metadata?.oldCredits).toBe(initialCredits);
            expect(downgradeTransaction?.metadata?.newCredits).toBe(expectedCredits);
            expect(downgradeTransaction?.metadata?.creditsDelta).toBe(expectedCredits - initialCredits);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 4.1: 交易记录应该正确记录积分变动
     * 
     * The transaction record should accurately reflect the credits change,
     * whether positive or negative.
     * 
     * **Validates: Requirement 2.4**
     */
    it('should accurately record credits change in transaction', async () => {
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: tierNames.length - 1 }),
          fc.integer({ min: 0, max: tierNames.length - 2 }),
          fc.integer({ min: 0, max: 20000 }),
          async (currentTierIndex, targetTierIndex, initialCredits) => {
            fc.pre(targetTierIndex < currentTierIndex);

            const currentTier = tierNames[currentTierIndex];
            const targetTier = tierNames[targetTierIndex];
            const expectedCredits = config.membership.creditsCaps[targetTier];
            const expectedDelta = expectedCredits - initialCredits;

            const userId = `user-txn-delta-${currentTierIndex}-${targetTierIndex}-${initialCredits}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // Execute downgrade
            const result = await engine.downgradeTier({
              userId,
              targetTier
            });

            // Verify transaction amount matches expected delta
            const transactions = await adapter.getTransactions(userId);
            const downgradeTransaction = transactions.find(
              txn => txn.id === result.transactionId
            );

            expect(downgradeTransaction?.amount).toBe(expectedDelta);
            expect(downgradeTransaction?.balanceBefore).toBe(initialCredits);
            expect(downgradeTransaction?.balanceAfter).toBe(expectedCredits);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 6: 未定义等级错误处理（降级部分）', () => {
    /**
     * Property 6: 未定义等级错误处理
     * 
     * For any target tier that is not defined in the configuration,
     * the downgrade operation should throw UndefinedTierError.
     * 
     * **Validates: Requirement 2.6**
     */
    it('should throw UndefinedTierError for undefined target tier', async () => {
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: tierNames.length - 1 }),
          fc.string({ minLength: 1, maxLength: 20 }).filter(
            name => !tierNames.includes(name) && 
                    name.trim().length > 0 &&
                    !['constructor', 'prototype', '__proto__', 'valueOf', 'toString', 'hasOwnProperty'].includes(name)
          ),
          fc.integer({ min: 0, max: 10000 }),
          async (currentTierIndex, undefinedTier, initialCredits) => {
            const currentTier = tierNames[currentTierIndex];

            const userId = `user-undef-${currentTierIndex}-${undefinedTier}-${initialCredits}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // Attempt to downgrade to undefined tier
            await expect(
              engine.downgradeTier({
                userId,
                targetTier: undefinedTier
              })
            ).rejects.toThrow(UndefinedTierError);

            // Verify error details
            try {
              await engine.downgradeTier({
                userId,
                targetTier: undefinedTier
              });
            } catch (error) {
              expect(error).toBeInstanceOf(UndefinedTierError);
              if (error instanceof UndefinedTierError) {
                expect(error.tier).toBe(undefinedTier);
                expect(error.message).toContain(undefinedTier);
                expect(error.message).toContain('not defined');
              }
            }

            // Verify user state is unchanged
            const unchangedUser = await adapter.getUserById(userId);
            expect(unchangedUser?.membershipTier).toBe(currentTier);
            expect(unchangedUser?.credits).toBe(initialCredits);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 6.1: 未定义等级错误应该在等级方向验证之前抛出
     * 
     * When attempting to downgrade to an undefined tier, UndefinedTierError
     * should be thrown before checking if the tier is lower than current tier.
     * 
     * **Validates: Requirement 2.6**
     */
    it('should throw UndefinedTierError before tier direction validation', async () => {
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: tierNames.length - 1 }),
          fc.string({ minLength: 1, maxLength: 20 }).filter(
            name => !tierNames.includes(name) && 
                    name.trim().length > 0 &&
                    !['constructor', 'prototype', '__proto__', 'valueOf', 'toString', 'hasOwnProperty'].includes(name)
          ),
          fc.integer({ min: 0, max: 10000 }),
          async (currentTierIndex, undefinedTier, initialCredits) => {
            const currentTier = tierNames[currentTierIndex];

            const userId = `user-undef-order-${currentTierIndex}-${undefinedTier}-${initialCredits}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // Attempt to downgrade to undefined tier
            // Should throw UndefinedTierError, not InvalidTierChangeError
            await expect(
              engine.downgradeTier({
                userId,
                targetTier: undefinedTier
              })
            ).rejects.toThrow(UndefinedTierError);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 7: 用户不存在错误处理（降级部分）', () => {
    /**
     * Property 7: 用户不存在错误处理
     * 
     * For any non-existent user ID, the downgrade operation should throw
     * UserNotFoundError.
     * 
     * **Validates: Requirement 2.8**
     */
    it('should throw UserNotFoundError for non-existent user', async () => {
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 0, max: tierNames.length - 1 }),
          async (nonExistentUserId, targetTierIndex) => {
            const targetTier = tierNames[targetTierIndex];

            // Ensure user does not exist
            const existingUser = await adapter.getUserById(nonExistentUserId);
            fc.pre(existingUser === null);

            // Attempt to downgrade non-existent user
            await expect(
              engine.downgradeTier({
                userId: nonExistentUserId,
                targetTier
              })
            ).rejects.toThrow(UserNotFoundError);

            // Verify error details
            try {
              await engine.downgradeTier({
                userId: nonExistentUserId,
                targetTier
              });
            } catch (error) {
              expect(error).toBeInstanceOf(UserNotFoundError);
              if (error instanceof UserNotFoundError) {
                expect(error.userId).toBe(nonExistentUserId);
                expect(error.message).toContain('not found');
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 7.1: 用户不存在错误应该在任何等级验证之前抛出
     * 
     * When a user does not exist, UserNotFoundError should be thrown
     * regardless of whether the target tier is valid or not.
     * 
     * **Validates: Requirement 2.8**
     */
    it('should throw UserNotFoundError before tier validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }),
          async (nonExistentUserId, anyTier) => {
            // Ensure user does not exist
            const existingUser = await adapter.getUserById(nonExistentUserId);
            fc.pre(existingUser === null);

            // Attempt to downgrade with any tier (valid or invalid)
            await expect(
              engine.downgradeTier({
                userId: nonExistentUserId,
                targetTier: anyTier
              })
            ).rejects.toThrow(UserNotFoundError);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 7.2: 用户不存在错误应该优先于所有其他验证错误
     * 
     * UserNotFoundError should be the first error thrown, even if there are
     * other validation issues (undefined tier, invalid direction, etc.).
     * 
     * **Validates: Requirement 2.8**
     */
    it('should throw UserNotFoundError as the first validation error', async () => {
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }).filter(
            name => !tierNames.includes(name) && 
                    name.trim().length > 0 &&
                    !['constructor', 'prototype', '__proto__', 'valueOf', 'toString', 'hasOwnProperty'].includes(name)
          ),
          async (nonExistentUserId, undefinedTier) => {
            // Ensure user does not exist
            const existingUser = await adapter.getUserById(nonExistentUserId);
            fc.pre(existingUser === null);

            // Attempt to downgrade non-existent user to undefined tier
            // Should throw UserNotFoundError, not UndefinedTierError
            await expect(
              engine.downgradeTier({
                userId: nonExistentUserId,
                targetTier: undefinedTier
              })
            ).rejects.toThrow(UserNotFoundError);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

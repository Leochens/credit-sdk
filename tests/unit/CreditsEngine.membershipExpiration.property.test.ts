/**
 * CreditsEngine 会员到期时间管理属性测试
 * 使用基于属性的测试验证会员到期时间管理的正确性
 * 
 * Feature: membership-tier-management
 * Property 11: 会员到期时间管理
 * 
 * **Validates: Requirements 6.1, 6.2, 6.3**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { CreditsEngine } from '../../src/core/CreditsEngine';
import { MockAdapter } from '../../src/adapters/MockAdapter';
import type { CreditsConfig, User } from '../../src/core/types';

describe('CreditsEngine Membership Expiration - Property Tests', () => {
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

  describe('Property 11: 会员到期时间管理', () => {
    /**
     * Property 11.1: 升级时提供到期时间应该更新用户的到期时间字段
     * 
     * For any successful upgrade operation where membershipExpiresAt is provided,
     * the user's membershipExpiresAt field should be updated to the provided value.
     * 
     * **Validates: Requirement 6.1**
     */
    it('should update membershipExpiresAt when provided during upgrade', async () => {
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          // 生成当前等级索引
          fc.integer({ min: 0, max: tierNames.length - 2 }),
          // 生成目标等级索引（必须高于当前等级）
          fc.integer({ min: 1, max: tierNames.length - 1 }),
          // 生成用户初始积分
          fc.integer({ min: 0, max: 10000 }),
          // 生成到期时间（未来的日期）
          fc.date({ min: new Date(), max: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) }),
          async (currentTierIndex, targetTierIndex, initialCredits, expiresAt) => {
            // 确保目标等级高于当前等级
            fc.pre(targetTierIndex > currentTierIndex);

            const currentTier = tierNames[currentTierIndex];
            const targetTier = tierNames[targetTierIndex];

            // 创建用户（初始没有到期时间）
            const userId = `user-exp-${currentTierIndex}-${targetTierIndex}-${initialCredits}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行升级并提供到期时间
            await engine.upgradeTier({
              userId,
              targetTier,
              membershipExpiresAt: expiresAt
            });

            // 验证用户的到期时间已更新
            const updatedUser = await adapter.getUserById(userId);
            expect(updatedUser).not.toBeNull();
            expect(updatedUser?.membershipExpiresAt).toEqual(expiresAt);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 11.2: 升级时未提供到期时间应该保持现有到期时间不变
     * 
     * For any successful upgrade operation where membershipExpiresAt is not provided,
     * the user's existing membershipExpiresAt field should remain unchanged.
     * 
     * **Validates: Requirement 6.2**
     */
    it('should preserve existing membershipExpiresAt when not provided during upgrade', async () => {
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          // 生成当前等级索引
          fc.integer({ min: 0, max: tierNames.length - 2 }),
          // 生成目标等级索引（必须高于当前等级）
          fc.integer({ min: 1, max: tierNames.length - 1 }),
          // 生成用户初始积分
          fc.integer({ min: 0, max: 10000 }),
          // 生成现有到期时间（可能是 null 或未来的日期）
          fc.option(
            fc.date({ min: new Date(), max: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) }),
            { nil: null }
          ),
          async (currentTierIndex, targetTierIndex, initialCredits, existingExpiresAt) => {
            // 确保目标等级高于当前等级
            fc.pre(targetTierIndex > currentTierIndex);

            const currentTier = tierNames[currentTierIndex];
            const targetTier = tierNames[targetTierIndex];

            // 创建用户（带有现有到期时间）
            const userId = `user-preserve-${currentTierIndex}-${targetTierIndex}-${initialCredits}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: existingExpiresAt,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行升级但不提供到期时间
            await engine.upgradeTier({
              userId,
              targetTier
              // membershipExpiresAt 未提供
            });

            // 验证用户的到期时间保持不变
            const updatedUser = await adapter.getUserById(userId);
            expect(updatedUser).not.toBeNull();
            expect(updatedUser?.membershipExpiresAt).toEqual(existingExpiresAt);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 11.3: 升级时可以将到期时间从有值更新为 null
     * 
     * For any successful upgrade operation where membershipExpiresAt is explicitly
     * set to null, the user's membershipExpiresAt should be cleared.
     * 
     * **Validates: Requirement 6.1**
     */
    it('should clear membershipExpiresAt when explicitly set to null during upgrade', async () => {
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          // 生成当前等级索引
          fc.integer({ min: 0, max: tierNames.length - 2 }),
          // 生成目标等级索引（必须高于当前等级）
          fc.integer({ min: 1, max: tierNames.length - 1 }),
          // 生成用户初始积分
          fc.integer({ min: 0, max: 10000 }),
          // 生成现有到期时间（未来的日期）
          fc.date({ min: new Date(), max: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) }),
          async (currentTierIndex, targetTierIndex, initialCredits, existingExpiresAt) => {
            // 确保目标等级高于当前等级
            fc.pre(targetTierIndex > currentTierIndex);

            const currentTier = tierNames[currentTierIndex];
            const targetTier = tierNames[targetTierIndex];

            // 创建用户（带有现有到期时间）
            const userId = `user-clear-${currentTierIndex}-${targetTierIndex}-${initialCredits}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: existingExpiresAt,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行升级并显式设置到期时间为 null
            await engine.upgradeTier({
              userId,
              targetTier,
              membershipExpiresAt: null
            });

            // 验证用户的到期时间已被清除
            const updatedUser = await adapter.getUserById(userId);
            expect(updatedUser).not.toBeNull();
            expect(updatedUser?.membershipExpiresAt).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 11.4: 降级时 clearExpiration=true 应该清除到期时间
     * 
     * For any successful downgrade operation where clearExpiration is true,
     * the user's membershipExpiresAt field should be set to null.
     * 
     * **Validates: Requirement 6.3**
     */
    it('should clear membershipExpiresAt when clearExpiration is true during downgrade', async () => {
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          // 生成当前等级索引（1-3，不包括最低等级）
          fc.integer({ min: 1, max: tierNames.length - 1 }),
          // 生成目标等级索引（必须低于当前等级）
          fc.integer({ min: 0, max: tierNames.length - 2 }),
          // 生成用户初始积分
          fc.integer({ min: 0, max: 10000 }),
          // 生成现有到期时间（可能是 null 或未来的日期）
          fc.option(
            fc.date({ min: new Date(), max: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) }),
            { nil: null }
          ),
          async (currentTierIndex, targetTierIndex, initialCredits, existingExpiresAt) => {
            // 确保目标等级低于当前等级
            fc.pre(targetTierIndex < currentTierIndex);

            const currentTier = tierNames[currentTierIndex];
            const targetTier = tierNames[targetTierIndex];

            // 创建用户（带有现有到期时间）
            const userId = `user-clear-down-${currentTierIndex}-${targetTierIndex}-${initialCredits}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: existingExpiresAt,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行降级并设置 clearExpiration=true
            await engine.downgradeTier({
              userId,
              targetTier,
              clearExpiration: true
            });

            // 验证用户的到期时间已被清除
            const updatedUser = await adapter.getUserById(userId);
            expect(updatedUser).not.toBeNull();
            expect(updatedUser?.membershipExpiresAt).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 11.5: 降级时 clearExpiration=false 应该保持到期时间不变
     * 
     * For any successful downgrade operation where clearExpiration is false or not provided,
     * the user's membershipExpiresAt field should remain unchanged.
     * 
     * **Validates: Requirement 6.3**
     */
    it('should preserve membershipExpiresAt when clearExpiration is false during downgrade', async () => {
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          // 生成当前等级索引（1-3，不包括最低等级）
          fc.integer({ min: 1, max: tierNames.length - 1 }),
          // 生成目标等级索引（必须低于当前等级）
          fc.integer({ min: 0, max: tierNames.length - 2 }),
          // 生成用户初始积分
          fc.integer({ min: 0, max: 10000 }),
          // 生成现有到期时间（可能是 null 或未来的日期）
          fc.option(
            fc.date({ min: new Date(), max: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) }),
            { nil: null }
          ),
          // 生成 clearExpiration 参数（false 或 undefined）
          fc.constantFrom(false, undefined),
          async (currentTierIndex, targetTierIndex, initialCredits, existingExpiresAt, clearExpiration) => {
            // 确保目标等级低于当前等级
            fc.pre(targetTierIndex < currentTierIndex);

            const currentTier = tierNames[currentTierIndex];
            const targetTier = tierNames[targetTierIndex];

            // 创建用户（带有现有到期时间）
            const userId = `user-preserve-down-${currentTierIndex}-${targetTierIndex}-${initialCredits}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: existingExpiresAt,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行降级并设置 clearExpiration
            await engine.downgradeTier({
              userId,
              targetTier,
              clearExpiration
            });

            // 验证用户的到期时间保持不变
            const updatedUser = await adapter.getUserById(userId);
            expect(updatedUser).not.toBeNull();
            expect(updatedUser?.membershipExpiresAt).toEqual(existingExpiresAt);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 11.6: 升级时可以更新到期时间为任意未来日期
     * 
     * For any successful upgrade operation, membershipExpiresAt can be set to
     * any future date, and the system should accept it.
     * 
     * **Validates: Requirement 6.1**
     */
    it('should accept any future date as membershipExpiresAt during upgrade', async () => {
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          // 生成当前等级索引
          fc.integer({ min: 0, max: tierNames.length - 2 }),
          // 生成目标等级索引（必须高于当前等级）
          fc.integer({ min: 1, max: tierNames.length - 1 }),
          // 生成用户初始积分
          fc.integer({ min: 0, max: 10000 }),
          // 生成任意未来日期（从现在到10年后）
          fc.date({ 
            min: new Date(), 
            max: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000) 
          }),
          async (currentTierIndex, targetTierIndex, initialCredits, futureDate) => {
            // 确保目标等级高于当前等级
            fc.pre(targetTierIndex > currentTierIndex);

            const currentTier = tierNames[currentTierIndex];
            const targetTier = tierNames[targetTierIndex];

            // 创建用户
            const userId = `user-future-${currentTierIndex}-${targetTierIndex}-${initialCredits}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行升级并提供未来日期
            await engine.upgradeTier({
              userId,
              targetTier,
              membershipExpiresAt: futureDate
            });

            // 验证用户的到期时间已设置为提供的日期
            const updatedUser = await adapter.getUserById(userId);
            expect(updatedUser).not.toBeNull();
            expect(updatedUser?.membershipExpiresAt).toEqual(futureDate);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 11.7: 升级时可以更新到期时间为过去的日期（系统不验证日期有效性）
     * 
     * The system should accept any date value for membershipExpiresAt,
     * including past dates. Date validation is the responsibility of the caller.
     * 
     * **Validates: Requirement 6.1**
     */
    it('should accept past dates as membershipExpiresAt (no date validation)', async () => {
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          // 生成当前等级索引
          fc.integer({ min: 0, max: tierNames.length - 2 }),
          // 生成目标等级索引（必须高于当前等级）
          fc.integer({ min: 1, max: tierNames.length - 1 }),
          // 生成用户初始积分
          fc.integer({ min: 0, max: 10000 }),
          // 生成过去的日期
          fc.date({ 
            min: new Date('2020-01-01'), 
            max: new Date(Date.now() - 24 * 60 * 60 * 1000) // 至少1天前
          }),
          async (currentTierIndex, targetTierIndex, initialCredits, pastDate) => {
            // 确保目标等级高于当前等级
            fc.pre(targetTierIndex > currentTierIndex);

            const currentTier = tierNames[currentTierIndex];
            const targetTier = tierNames[targetTierIndex];

            // 创建用户
            const userId = `user-past-${currentTierIndex}-${targetTierIndex}-${initialCredits}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行升级并提供过去的日期
            await engine.upgradeTier({
              userId,
              targetTier,
              membershipExpiresAt: pastDate
            });

            // 验证用户的到期时间已设置为提供的日期（即使是过去的）
            const updatedUser = await adapter.getUserById(userId);
            expect(updatedUser).not.toBeNull();
            expect(updatedUser?.membershipExpiresAt).toEqual(pastDate);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

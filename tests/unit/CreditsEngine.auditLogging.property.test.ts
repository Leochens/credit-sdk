/**
 * CreditsEngine 审计日志记录属性测试
 * 使用基于属性的测试验证审计日志记录的正确性
 * 
 * Feature: membership-tier-management
 * Property 5: 审计日志记录
 * 
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { CreditsEngine } from '../../src/core/CreditsEngine';
import { MockAdapter } from '../../src/adapters/MockAdapter';
import type { CreditsConfig, User } from '../../src/core/types';

describe('CreditsEngine Audit Logging - Property Tests', () => {
  let adapter: MockAdapter;
  let engine: CreditsEngine;
  let config: CreditsConfig;

  beforeEach(() => {
    // 创建测试配置（审计功能启用）
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

  describe('Property 5: 审计日志记录', () => {
    /**
     * Property 5.1: 成功的升级操作应该创建审计日志
     * 
     * For any successful upgrade operation, when audit is enabled,
     * the system should create an audit log with operation details.
     * 
     * **Validates: Requirement 7.1, 7.4**
     */
    it('should create audit log for successful upgrade operation', async () => {
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

            // 创建用户
            const userId = `user-audit-up-${currentTierIndex}-${targetTierIndex}-${initialCredits}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行升级
            const result = await engine.upgradeTier({
              userId,
              targetTier
            });

            // 验证审计日志已创建
            const auditLogs = adapter.getAuditLogs();
            const upgradeLog = auditLogs.find(
              log => log.userId === userId && log.action === 'upgradeTier' && log.metadata?.transactionId === result.transactionId
            );

            expect(upgradeLog).toBeDefined();
            expect(upgradeLog?.userId).toBe(userId);
            expect(upgradeLog?.action).toBe('upgradeTier');
            expect(upgradeLog?.status).toBe('success');

            // 验证审计日志包含旧等级、新等级、积分变动和操作时间
            expect(upgradeLog?.metadata).toBeDefined();
            expect(upgradeLog?.metadata?.oldTier).toBe(currentTier);
            expect(upgradeLog?.metadata?.newTier).toBe(targetTier);
            expect(upgradeLog?.metadata?.oldCredits).toBe(initialCredits);
            expect(upgradeLog?.metadata?.newCredits).toBe(config.membership.creditsCaps[targetTier]);
            expect(upgradeLog?.metadata?.creditsDelta).toBe(
              config.membership.creditsCaps[targetTier] - initialCredits
            );
            expect(upgradeLog?.metadata?.transactionId).toBe(result.transactionId);
            expect(upgradeLog?.createdAt).toBeInstanceOf(Date);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 5.2: 成功的降级操作应该创建审计日志
     * 
     * For any successful downgrade operation, when audit is enabled,
     * the system should create an audit log with operation details.
     * 
     * **Validates: Requirement 7.2, 7.4**
     */
    it('should create audit log for successful downgrade operation', async () => {
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
            const userId = `user-audit-down-${currentTierIndex}-${targetTierIndex}-${initialCredits}`;
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

            // 验证审计日志已创建
            const auditLogs = adapter.getAuditLogs();
            const downgradeLog = auditLogs.find(
              log => log.userId === userId && log.action === 'downgradeTier' && log.metadata?.transactionId === result.transactionId
            );

            expect(downgradeLog).toBeDefined();
            expect(downgradeLog?.userId).toBe(userId);
            expect(downgradeLog?.action).toBe('downgradeTier');
            expect(downgradeLog?.status).toBe('success');

            // 验证审计日志包含旧等级、新等级、积分变动和操作时间
            expect(downgradeLog?.metadata).toBeDefined();
            expect(downgradeLog?.metadata?.oldTier).toBe(currentTier);
            expect(downgradeLog?.metadata?.newTier).toBe(targetTier);
            expect(downgradeLog?.metadata?.oldCredits).toBe(initialCredits);
            expect(downgradeLog?.metadata?.newCredits).toBe(config.membership.creditsCaps[targetTier]);
            expect(downgradeLog?.metadata?.creditsDelta).toBe(
              config.membership.creditsCaps[targetTier] - initialCredits
            );
            expect(downgradeLog?.metadata?.transactionId).toBe(result.transactionId);
            expect(downgradeLog?.createdAt).toBeInstanceOf(Date);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 5.3: 失败的升级操作应该创建包含错误信息的审计日志
     * 
     * For any failed upgrade operation, when audit is enabled,
     * the system should create an audit log with error information.
     * 
     * **Validates: Requirement 7.3, 7.4**
     */
    it('should create audit log with error info for failed upgrade operation', async () => {
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          // 生成当前等级索引
          fc.integer({ min: 0, max: tierNames.length - 1 }),
          // 生成未定义的等级名称
          fc.string({ minLength: 1, maxLength: 20 }).filter(
            name => !tierNames.includes(name) && 
                    name.trim().length > 0 &&
                    !['constructor', 'prototype', '__proto__', 'valueOf', 'toString', 'hasOwnProperty'].includes(name)
          ),
          // 生成用户初始积分
          fc.integer({ min: 0, max: 10000 }),
          async (currentTierIndex, undefinedTier, initialCredits) => {
            const currentTier = tierNames[currentTierIndex];

            // 创建用户
            const userId = `user-audit-fail-${currentTierIndex}-${undefinedTier}-${initialCredits}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 尝试升级到未定义的等级（应该失败）
            try {
              await engine.upgradeTier({
                userId,
                targetTier: undefinedTier
              });
              // 如果没有抛出错误，测试失败
              expect.fail('Expected upgradeTier to throw an error');
            } catch (error) {
              // 预期会抛出错误
            }

            // 验证审计日志已创建并包含错误信息
            const auditLogs = adapter.getAuditLogs();
            const failureLog = auditLogs.find(
              log => log.userId === userId && log.action === 'upgradeTier' && log.status === 'failed'
            );

            expect(failureLog).toBeDefined();
            expect(failureLog?.userId).toBe(userId);
            expect(failureLog?.action).toBe('upgradeTier');
            expect(failureLog?.status).toBe('failed');
            expect(failureLog?.metadata?.error).toBeDefined();
            expect(failureLog?.metadata?.targetTier).toBe(undefinedTier);
            expect(failureLog?.createdAt).toBeInstanceOf(Date);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 5.4: 失败的降级操作应该创建包含错误信息的审计日志
     * 
     * For any failed downgrade operation, when audit is enabled,
     * the system should create an audit log with error information.
     * 
     * **Validates: Requirement 7.3, 7.4**
     */
    it('should create audit log with error info for failed downgrade operation', async () => {
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          // 生成当前等级索引
          fc.integer({ min: 0, max: tierNames.length - 1 }),
          // 生成未定义的等级名称
          fc.string({ minLength: 1, maxLength: 20 }).filter(
            name => !tierNames.includes(name) && 
                    name.trim().length > 0 &&
                    !['constructor', 'prototype', '__proto__', 'valueOf', 'toString', 'hasOwnProperty'].includes(name)
          ),
          // 生成用户初始积分
          fc.integer({ min: 0, max: 10000 }),
          async (currentTierIndex, undefinedTier, initialCredits) => {
            const currentTier = tierNames[currentTierIndex];

            // 创建用户
            const userId = `user-audit-fail-down-${currentTierIndex}-${undefinedTier}-${initialCredits}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 尝试降级到未定义的等级（应该失败）
            try {
              await engine.downgradeTier({
                userId,
                targetTier: undefinedTier
              });
              // 如果没有抛出错误，测试失败
              expect.fail('Expected downgradeTier to throw an error');
            } catch (error) {
              // 预期会抛出错误
            }

            // 验证审计日志已创建并包含错误信息
            const auditLogs = adapter.getAuditLogs();
            const failureLog = auditLogs.find(
              log => log.userId === userId && log.action === 'downgradeTier' && log.status === 'failed'
            );

            expect(failureLog).toBeDefined();
            expect(failureLog?.userId).toBe(userId);
            expect(failureLog?.action).toBe('downgradeTier');
            expect(failureLog?.status).toBe('failed');
            expect(failureLog?.metadata?.error).toBeDefined();
            expect(failureLog?.metadata?.targetTier).toBe(undefinedTier);
            expect(failureLog?.createdAt).toBeInstanceOf(Date);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 5.5: 审计功能禁用时不应该创建审计日志
     * 
     * For any tier change operation, when audit is disabled,
     * the system should not create audit logs.
     * 
     * **Validates: Requirement 7.5**
     */
    it('should not create audit logs when audit is disabled', async () => {
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      // 创建禁用审计的配置
      const configWithoutAudit: CreditsConfig = {
        ...config,
        audit: {
          enabled: false
        }
      };

      const adapterNoAudit = new MockAdapter();
      const engineNoAudit = new CreditsEngine({
        storage: adapterNoAudit,
        config: configWithoutAudit
      });

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

            // 创建用户
            const userId = `user-no-audit-${currentTierIndex}-${targetTierIndex}-${initialCredits}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapterNoAudit.createUser(user);

            // 执行升级
            await engineNoAudit.upgradeTier({
              userId,
              targetTier
            });

            // 验证没有创建审计日志
            const auditLogs = adapterNoAudit.getAuditLogs();
            expect(auditLogs.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 5.6: 审计日志应该记录操作时间戳
     * 
     * For any tier change operation with audit enabled,
     * the audit log should include a timestamp of when the operation occurred.
     * 
     * **Validates: Requirement 7.4**
     */
    it('should record timestamp in audit logs', async () => {
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

            // 创建用户
            const userId = `user-timestamp-${currentTierIndex}-${targetTierIndex}-${initialCredits}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 记录操作前的时间
            const beforeTime = new Date();

            // 执行升级
            const result = await engine.upgradeTier({
              userId,
              targetTier
            });

            // 记录操作后的时间
            const afterTime = new Date();

            // 验证审计日志包含时间戳
            const auditLogs = adapter.getAuditLogs();
            const upgradeLog = auditLogs.find(
              log => log.userId === userId && log.action === 'upgradeTier' && log.metadata?.transactionId === result.transactionId
            );

            expect(upgradeLog).toBeDefined();
            expect(upgradeLog?.createdAt).toBeInstanceOf(Date);
            
            // 验证时间戳在合理范围内
            const logTime = upgradeLog!.createdAt;
            expect(logTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
            expect(logTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 5.7: 审计日志应该包含所有必需的元数据字段
     * 
     * For any successful tier change operation with audit enabled,
     * the audit log should contain all required metadata fields:
     * oldTier, newTier, oldCredits, newCredits, creditsDelta, transactionId.
     * 
     * **Validates: Requirement 7.4**
     */
    it('should include all required metadata fields in audit logs', async () => {
      const tierNames = ['free', 'basic', 'pro', 'premium'];

      await fc.assert(
        fc.asyncProperty(
          // 生成当前等级索引
          fc.integer({ min: 0, max: tierNames.length - 2 }),
          // 生成目标等级索引（必须高于当前等级）
          fc.integer({ min: 1, max: tierNames.length - 1 }),
          // 生成用户初始积分
          fc.integer({ min: 0, max: 10000 }),
          // 生成操作类型（升级或降级）
          fc.constantFrom('upgrade', 'downgrade'),
          async (currentTierIndex, targetTierIndex, initialCredits, operationType) => {
            // 根据操作类型调整等级索引
            let actualCurrentIndex = currentTierIndex;
            let actualTargetIndex = targetTierIndex;
            
            if (operationType === 'downgrade') {
              // 对于降级，交换索引
              actualCurrentIndex = targetTierIndex;
              actualTargetIndex = currentTierIndex;
            }

            // 确保等级关系正确
            fc.pre(
              (operationType === 'upgrade' && actualTargetIndex > actualCurrentIndex) ||
              (operationType === 'downgrade' && actualTargetIndex < actualCurrentIndex)
            );

            const currentTier = tierNames[actualCurrentIndex];
            const targetTier = tierNames[actualTargetIndex];

            // 创建用户
            const userId = `user-metadata-${operationType}-${actualCurrentIndex}-${actualTargetIndex}-${initialCredits}`;
            const user: User = {
              id: userId,
              credits: initialCredits,
              membershipTier: currentTier,
              membershipExpiresAt: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            await adapter.createUser(user);

            // 执行操作
            const result = operationType === 'upgrade'
              ? await engine.upgradeTier({ userId, targetTier })
              : await engine.downgradeTier({ userId, targetTier });

            // 验证审计日志包含所有必需字段
            const auditLogs = adapter.getAuditLogs();
            const operationLog = auditLogs.find(
              log => log.userId === userId && log.metadata?.transactionId === result.transactionId
            );

            expect(operationLog).toBeDefined();
            expect(operationLog?.metadata).toBeDefined();

            // 验证所有必需的元数据字段
            const metadata = operationLog!.metadata!;
            expect(metadata.oldTier).toBe(currentTier);
            expect(metadata.newTier).toBe(targetTier);
            expect(metadata.oldCredits).toBe(initialCredits);
            expect(metadata.newCredits).toBe(config.membership.creditsCaps[targetTier]);
            expect(metadata.creditsDelta).toBe(
              config.membership.creditsCaps[targetTier] - initialCredits
            );
            expect(metadata.transactionId).toBe(result.transactionId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * Task 5.4 Integration Test: CreditsEngine集成测试
 * 
 * 综合测试CreditsEngine与DynamicCostFormula的集成，验证：
 * - 带variables的charge调用
 * - 不带variables的charge调用
 * - 元数据记录的完整性
 * - 审计日志记录
 * - 错误处理流程
 * 
 * 验证需求: 2.1, 2.2, 2.3, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CreditsEngine } from '../../src/core/CreditsEngine';
import { MockAdapter } from '../../src/adapters/MockAdapter';
import { MissingVariableError, FormulaEvaluationError } from '../../src/core/errors';
import type { CreditsConfig } from '../../src/core/types';

describe('Task 5.4: CreditsEngine Integration Tests', () => {
  let engine: CreditsEngine;
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
    
    const config: CreditsConfig = {
      costs: {
        // 固定成本（向后兼容）
        'generate-image': {
          default: 20,
          premium: 15,
          enterprise: 10
        },
        // 动态公式 - 单变量
        'ai-completion': {
          default: '{token} * 0.001 + 10',
          premium: '{token} * 0.0008 + 8',
          enterprise: '{token} * 0.0005 + 5'
        },
        // 动态公式 - 多变量
        'video-processing': {
          default: '{duration} * 2 + {resolution} * 0.5',
          premium: '({duration} * 2 + {resolution} * 0.5) * 0.8'
        },
        // 动态公式 - 可能导致除零
        'data-processing': {
          default: '{amount} / {count}'
        },
        // 混合配置 - default是数字，tier是公式
        'hybrid-action': {
          default: 50,
          premium: '{value} * 0.5'
        }
      },
      membership: {
        tiers: {
          free: 0,
          premium: 1,
          enterprise: 2
        },
        requirements: {
          'generate-image': null,
          'ai-completion': null,
          'video-processing': null,
          'data-processing': null,
          'hybrid-action': null
        },
        creditsCaps: {
          free: 100,
          premium: 1000,
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
        enabled: false,
        ttl: 0
      },
      audit: {
        enabled: true // 启用审计日志以测试审计功能
      }
    };

    engine = new CreditsEngine({
      storage: adapter,
      config
    });
  });

  describe('Requirement 2.1 & 2.2: Charge with Variables', () => {
    it('should charge using dynamic formula with single variable', async () => {
      const user = await adapter.createUser({ 
        id: 'user-1', 
        credits: 1000, 
        membershipTier: null 
      });

      const result = await engine.charge({
        userId: user.id,
        action: 'ai-completion',
        variables: { token: 3500 }
      });

      expect(result.success).toBe(true);
      // 3500 * 0.001 + 10 = 13.5
      expect(result.cost).toBe(13.5);
      expect(result.balanceBefore).toBe(1000);
      expect(result.balanceAfter).toBe(986.5);
    });

    it('should charge using dynamic formula with multiple variables', async () => {
      const user = await adapter.createUser({ 
        id: 'user-2', 
        credits: 2000, 
        membershipTier: null 
      });

      const result = await engine.charge({
        userId: user.id,
        action: 'video-processing',
        variables: { 
          duration: 120, 
          resolution: 1920 
        }
      });

      expect(result.success).toBe(true);
      // 120 * 2 + 1920 * 0.5 = 240 + 960 = 1200
      expect(result.cost).toBe(1200);
      expect(result.balanceAfter).toBe(800);
    });

    it('should use tier-specific formula with variables', async () => {
      const user = await adapter.createUser({ 
        id: 'user-3', 
        credits: 1000, 
        membershipTier: 'premium' 
      });

      const result = await engine.charge({
        userId: user.id,
        action: 'ai-completion',
        variables: { token: 3500 }
      });

      expect(result.success).toBe(true);
      // 3500 * 0.0008 + 8 = 10.8
      expect(result.cost).toBe(10.8);
      expect(result.balanceAfter).toBe(989.2);
    });

    it('should round cost to 2 decimal places', async () => {
      const user = await adapter.createUser({ 
        id: 'user-4', 
        credits: 1000, 
        membershipTier: null 
      });

      const result = await engine.charge({
        userId: user.id,
        action: 'ai-completion',
        variables: { token: 3333 } // 3333 * 0.001 + 10 = 13.333
      });

      expect(result.success).toBe(true);
      expect(result.cost).toBe(13.33); // rounded to 2 decimals
    });
  });

  describe('Requirement 2.3: Charge without Variables (Fallback)', () => {
    it('should use default fixed cost when no variables provided for fixed cost action', async () => {
      const user = await adapter.createUser({ 
        id: 'user-5', 
        credits: 1000, 
        membershipTier: null 
      });

      const result = await engine.charge({
        userId: user.id,
        action: 'generate-image'
        // no variables provided
      });

      expect(result.success).toBe(true);
      expect(result.cost).toBe(20); // default fixed cost
      expect(result.balanceAfter).toBe(980);
    });

    it('should throw error when variables not provided for dynamic formula', async () => {
      const user = await adapter.createUser({ 
        id: 'user-6', 
        credits: 1000, 
        membershipTier: null 
      });

      // 动态公式需要variables，不提供应该抛出错误
      await expect(
        engine.charge({
          userId: user.id,
          action: 'ai-completion'
          // no variables provided
        })
      ).rejects.toThrow(MissingVariableError);
    });

    it('should use default fixed cost when variables not provided for hybrid action', async () => {
      const user = await adapter.createUser({ 
        id: 'user-7', 
        credits: 1000, 
        membershipTier: null 
      });

      // hybrid-action的default是数字50
      const result = await engine.charge({
        userId: user.id,
        action: 'hybrid-action'
        // no variables provided
      });

      expect(result.success).toBe(true);
      expect(result.cost).toBe(50); // default fixed cost
      expect(result.balanceAfter).toBe(950);
    });
  });

  describe('Requirements 6.1-6.4: Metadata Recording Completeness', () => {
    it('should record complete calculation details in metadata for dynamic cost', async () => {
      const user = await adapter.createUser({ 
        id: 'user-8', 
        credits: 1000, 
        membershipTier: null 
      });

      await engine.charge({
        userId: user.id,
        action: 'ai-completion',
        variables: { token: 3500 }
      });

      const transactions = await adapter.getTransactions(user.id);
      expect(transactions).toHaveLength(1);
      
      // 验证需求 6.1-6.4: 元数据包含完整的计算详情
      expect(transactions[0].metadata.dynamicCost).toEqual({
        formula: '{token} * 0.001 + 10',
        variables: { token: 3500 },
        rawCost: 13.5,
        finalCost: 13.5
      });
    });

    it('should record rawCost and finalCost correctly when rounding occurs', async () => {
      const user = await adapter.createUser({ 
        id: 'user-9', 
        credits: 1000, 
        membershipTier: null 
      });

      await engine.charge({
        userId: user.id,
        action: 'ai-completion',
        variables: { token: 3456 } // 3456 * 0.001 + 10 = 13.456
      });

      const transactions = await adapter.getTransactions(user.id);
      
      // rawCost应该是未四舍五入的值
      expect(transactions[0].metadata.dynamicCost.rawCost).toBe(13.456);
      
      // finalCost应该是四舍五入后的值
      expect(transactions[0].metadata.dynamicCost.finalCost).toBe(13.46);
      
      // 实际扣费金额应该等于finalCost
      expect(transactions[0].amount).toBe(-13.46);
    });

    it('should record tier-specific formula in metadata', async () => {
      const user = await adapter.createUser({ 
        id: 'user-10', 
        credits: 1000, 
        membershipTier: 'premium' 
      });

      await engine.charge({
        userId: user.id,
        action: 'ai-completion',
        variables: { token: 3500 }
      });

      const transactions = await adapter.getTransactions(user.id);
      
      // 应该使用premium等级的公式
      expect(transactions[0].metadata.dynamicCost.formula).toBe('{token} * 0.0008 + 8');
      expect(transactions[0].metadata.dynamicCost.finalCost).toBe(10.8);
    });

    it('should record multiple variables in metadata', async () => {
      const user = await adapter.createUser({ 
        id: 'user-11', 
        credits: 2000, 
        membershipTier: null 
      });

      await engine.charge({
        userId: user.id,
        action: 'video-processing',
        variables: { 
          duration: 120, 
          resolution: 1920 
        }
      });

      const transactions = await adapter.getTransactions(user.id);
      
      expect(transactions[0].metadata.dynamicCost).toEqual({
        formula: '{duration} * 2 + {resolution} * 0.5',
        variables: { duration: 120, resolution: 1920 },
        rawCost: 1200,
        finalCost: 1200
      });
    });

    it('should preserve user-provided metadata alongside dynamicCost', async () => {
      const user = await adapter.createUser({ 
        id: 'user-12', 
        credits: 1000, 
        membershipTier: null 
      });

      await engine.charge({
        userId: user.id,
        action: 'ai-completion',
        variables: { token: 3500 },
        metadata: { 
          requestId: 'req-123',
          clientVersion: '1.0.0'
        }
      });

      const transactions = await adapter.getTransactions(user.id);
      
      // 用户提供的metadata应该被保留
      expect(transactions[0].metadata.requestId).toBe('req-123');
      expect(transactions[0].metadata.clientVersion).toBe('1.0.0');
      
      // dynamicCost应该被添加
      expect(transactions[0].metadata.dynamicCost).toBeDefined();
      expect(transactions[0].metadata.dynamicCost.formula).toBe('{token} * 0.001 + 10');
    });
  });

  describe('Requirement 6.5: No dynamicCost Field for Fixed Cost', () => {
    it('should NOT add dynamicCost field for fixed cost actions', async () => {
      const user = await adapter.createUser({ 
        id: 'user-13', 
        credits: 1000, 
        membershipTier: null 
      });

      await engine.charge({
        userId: user.id,
        action: 'generate-image'
      });

      const transactions = await adapter.getTransactions(user.id);
      
      // 验证需求 6.5: 只在使用动态公式时添加dynamicCost字段
      expect(transactions[0].metadata).not.toHaveProperty('dynamicCost');
    });

    it('should NOT add dynamicCost field for tier-specific fixed cost', async () => {
      const user = await adapter.createUser({ 
        id: 'user-14', 
        credits: 1000, 
        membershipTier: 'premium' 
      });

      await engine.charge({
        userId: user.id,
        action: 'generate-image'
      });

      const transactions = await adapter.getTransactions(user.id);
      
      // 即使是会员等级，如果是固定成本，也不应该有dynamicCost字段
      expect(transactions[0].metadata).not.toHaveProperty('dynamicCost');
    });
  });

  describe('Requirement 5.5: Audit Log Recording', () => {
    it('should create audit log for successful charge with dynamic formula', async () => {
      const user = await adapter.createUser({ 
        id: 'user-15', 
        credits: 1000, 
        membershipTier: null 
      });

      await engine.charge({
        userId: user.id,
        action: 'ai-completion',
        variables: { token: 3500 },
        metadata: { requestId: 'req-123' }
      });

      const auditLogs = await adapter.getAuditLogs(user.id);
      expect(auditLogs).toHaveLength(1);
      
      const log = auditLogs[0];
      expect(log.action).toBe('charge');
      expect(log.status).toBe('success');
      expect(log.metadata.operation).toBe('ai-completion');
      expect(log.metadata.cost).toBe(13.5);
      expect(log.metadata.requestId).toBe('req-123');
    });

    it('should create audit log for MissingVariableError', async () => {
      const user = await adapter.createUser({ 
        id: 'user-16', 
        credits: 1000, 
        membershipTier: null 
      });

      try {
        await engine.charge({
          userId: user.id,
          action: 'ai-completion',
          variables: {},
          metadata: { requestId: 'req-456' }
        });
        expect.fail('Should have thrown MissingVariableError');
      } catch (error) {
        expect(error).toBeInstanceOf(MissingVariableError);
      }

      // 验证需求 5.5: 记录公式计算错误到审计日志
      const auditLogs = await adapter.getAuditLogs(user.id);
      expect(auditLogs).toHaveLength(1);
      
      const log = auditLogs[0];
      expect(log.action).toBe('charge');
      expect(log.status).toBe('failed');
      expect(log.errorMessage).toBeDefined();
      
      // 验证审计日志包含详细的错误信息
      expect(log.metadata.errorType).toBe('MissingVariableError');
      expect(log.metadata.errorCode).toBe('MISSING_VARIABLE');
      expect(log.metadata.formula).toBe('{token} * 0.001 + 10');
      expect(log.metadata.missingVariable).toBe('token');
      expect(log.metadata.providedVariables).toEqual([]);
      expect(log.metadata.variables).toEqual({});
      
      // 用户提供的metadata应该被保留
      expect(log.metadata.requestId).toBe('req-456');
    });

    it('should create audit log for FormulaEvaluationError (division by zero)', async () => {
      const user = await adapter.createUser({ 
        id: 'user-17', 
        credits: 1000, 
        membershipTier: null 
      });

      try {
        await engine.charge({
          userId: user.id,
          action: 'data-processing',
          variables: { amount: 100, count: 0 },
          metadata: { requestId: 'req-789' }
        });
        expect.fail('Should have thrown FormulaEvaluationError');
      } catch (error) {
        expect(error).toBeInstanceOf(FormulaEvaluationError);
      }

      const auditLogs = await adapter.getAuditLogs(user.id);
      expect(auditLogs).toHaveLength(1);
      
      const log = auditLogs[0];
      expect(log.action).toBe('charge');
      expect(log.status).toBe('failed');
      expect(log.errorMessage).toBeDefined();
      
      // 验证审计日志包含详细的错误信息
      expect(log.metadata.errorType).toBe('FormulaEvaluationError');
      expect(log.metadata.errorCode).toBe('FORMULA_EVALUATION_ERROR');
      expect(log.metadata.formula).toBe('{amount} / {count}');
      expect(log.metadata.variables).toEqual({ amount: 100, count: 0 });
      expect(log.metadata.cause).toBeDefined();
      
      // 用户提供的metadata应该被保留
      expect(log.metadata.requestId).toBe('req-789');
    });

    it('should create audit log for FormulaEvaluationError (NaN)', async () => {
      const user = await adapter.createUser({ 
        id: 'user-18', 
        credits: 1000, 
        membershipTier: null 
      });

      try {
        await engine.charge({
          userId: user.id,
          action: 'ai-completion',
          variables: { token: NaN }
        });
        expect.fail('Should have thrown FormulaEvaluationError');
      } catch (error) {
        expect(error).toBeInstanceOf(FormulaEvaluationError);
      }

      const auditLogs = await adapter.getAuditLogs(user.id);
      expect(auditLogs).toHaveLength(1);
      
      const log = auditLogs[0];
      expect(log.metadata.errorType).toBe('FormulaEvaluationError');
      expect(log.metadata.formula).toBe('{token} * 0.001 + 10');
      expect(log.metadata.cause).toContain('NaN');
    });

    it('should preserve operation context in audit log for formula errors', async () => {
      const user = await adapter.createUser({ 
        id: 'user-19', 
        credits: 1000, 
        membershipTier: null 
      });

      try {
        await engine.charge({
          userId: user.id,
          action: 'video-processing',
          variables: { duration: 120 }, // 缺少resolution
          metadata: { 
            requestId: 'req-999',
            clientVersion: '2.0.0',
            source: 'api'
          }
        });
        expect.fail('Should have thrown MissingVariableError');
      } catch (error) {
        expect(error).toBeInstanceOf(MissingVariableError);
      }

      const auditLogs = await adapter.getAuditLogs(user.id);
      expect(auditLogs).toHaveLength(1);
      
      const log = auditLogs[0];
      
      // 验证操作上下文被保留
      expect(log.metadata.operation).toBe('video-processing');
      expect(log.metadata.requestId).toBe('req-999');
      expect(log.metadata.clientVersion).toBe('2.0.0');
      expect(log.metadata.source).toBe('api');
      
      // 验证错误详情被添加
      expect(log.metadata.errorType).toBe('MissingVariableError');
      expect(log.metadata.formula).toBeDefined();
      expect(log.metadata.missingVariable).toBeDefined();
    });
  });

  describe('Error Handling Flow', () => {
    it('should not deduct credits when MissingVariableError occurs', async () => {
      const user = await adapter.createUser({ 
        id: 'user-20', 
        credits: 1000, 
        membershipTier: null 
      });

      const initialBalance = user.credits;

      try {
        await engine.charge({
          userId: user.id,
          action: 'ai-completion',
          variables: {}
        });
        expect.fail('Should have thrown MissingVariableError');
      } catch (error) {
        expect(error).toBeInstanceOf(MissingVariableError);
      }

      // 验证余额未被扣除
      const updatedUser = await adapter.getUserById(user.id);
      expect(updatedUser?.credits).toBe(initialBalance);
    });

    it('should not deduct credits when FormulaEvaluationError occurs', async () => {
      const user = await adapter.createUser({ 
        id: 'user-21', 
        credits: 1000, 
        membershipTier: null 
      });

      const initialBalance = user.credits;

      try {
        await engine.charge({
          userId: user.id,
          action: 'data-processing',
          variables: { amount: 100, count: 0 }
        });
        expect.fail('Should have thrown FormulaEvaluationError');
      } catch (error) {
        expect(error).toBeInstanceOf(FormulaEvaluationError);
      }

      // 验证余额未被扣除
      const updatedUser = await adapter.getUserById(user.id);
      expect(updatedUser?.credits).toBe(initialBalance);
    });

    it('should not create transaction record when formula error occurs', async () => {
      const user = await adapter.createUser({ 
        id: 'user-22', 
        credits: 1000, 
        membershipTier: null 
      });

      try {
        await engine.charge({
          userId: user.id,
          action: 'ai-completion',
          variables: {}
        });
        expect.fail('Should have thrown MissingVariableError');
      } catch (error) {
        expect(error).toBeInstanceOf(MissingVariableError);
      }

      // 验证没有创建交易记录
      const transactions = await adapter.getTransactions(user.id);
      expect(transactions).toHaveLength(0);
    });

    it('should throw error with context for missing variables', async () => {
      const user = await adapter.createUser({ 
        id: 'user-23', 
        credits: 1000, 
        membershipTier: null 
      });

      try {
        await engine.charge({
          userId: user.id,
          action: 'video-processing',
          variables: { duration: 120 } // 缺少resolution
        });
        expect.fail('Should have thrown MissingVariableError');
      } catch (error) {
        expect(error).toBeInstanceOf(MissingVariableError);
        const err = error as MissingVariableError;
        
        // 验证错误包含有用的上下文信息
        expect(err.formula).toBe('{duration} * 2 + {resolution} * 0.5');
        expect(err.missingVariable).toBe('resolution');
        expect(err.providedVariables).toContain('duration');
        expect(err.message).toContain('resolution');
        expect(err.message).toContain('duration');
      }
    });

    it('should throw error with context for division by zero', async () => {
      const user = await adapter.createUser({ 
        id: 'user-24', 
        credits: 1000, 
        membershipTier: null 
      });

      try {
        await engine.charge({
          userId: user.id,
          action: 'data-processing',
          variables: { amount: 100, count: 0 }
        });
        expect.fail('Should have thrown FormulaEvaluationError');
      } catch (error) {
        expect(error).toBeInstanceOf(FormulaEvaluationError);
        const err = error as FormulaEvaluationError;
        
        // 验证错误包含有用的上下文信息
        expect(err.formula).toBe('{amount} / {count}');
        expect(err.variables).toEqual({ amount: 100, count: 0 });
        expect(err.cause).toBeDefined();
        expect(err.message).toContain('{amount} / {count}');
      }
    });
  });

  describe('Integration with Other Features', () => {
    it('should work correctly with different membership tiers', async () => {
      const freeUser = await adapter.createUser({ 
        id: 'user-25', 
        credits: 1000, 
        membershipTier: null 
      });
      const premiumUser = await adapter.createUser({ 
        id: 'user-26', 
        credits: 1000, 
        membershipTier: 'premium' 
      });
      const enterpriseUser = await adapter.createUser({ 
        id: 'user-27', 
        credits: 1000, 
        membershipTier: 'enterprise' 
      });

      const freeResult = await engine.charge({
        userId: freeUser.id,
        action: 'ai-completion',
        variables: { token: 1000 }
      });

      const premiumResult = await engine.charge({
        userId: premiumUser.id,
        action: 'ai-completion',
        variables: { token: 1000 }
      });

      const enterpriseResult = await engine.charge({
        userId: enterpriseUser.id,
        action: 'ai-completion',
        variables: { token: 1000 }
      });

      // 1000 * 0.001 + 10 = 11
      expect(freeResult.cost).toBe(11);
      // 1000 * 0.0008 + 8 = 8.8
      expect(premiumResult.cost).toBe(8.8);
      // 1000 * 0.0005 + 5 = 5.5
      expect(enterpriseResult.cost).toBe(5.5);
    });

    it('should handle zero variable values correctly', async () => {
      const user = await adapter.createUser({ 
        id: 'user-28', 
        credits: 1000, 
        membershipTier: null 
      });

      const result = await engine.charge({
        userId: user.id,
        action: 'ai-completion',
        variables: { token: 0 } // 0 * 0.001 + 10 = 10
      });

      expect(result.success).toBe(true);
      expect(result.cost).toBe(10);
      
      const transactions = await adapter.getTransactions(user.id);
      expect(transactions[0].metadata.dynamicCost.variables).toEqual({ token: 0 });
    });

    it('should handle large variable values correctly', async () => {
      const user = await adapter.createUser({ 
        id: 'user-29', 
        credits: 10000, 
        membershipTier: null 
      });

      const result = await engine.charge({
        userId: user.id,
        action: 'ai-completion',
        variables: { token: 1000000 } // 1000000 * 0.001 + 10 = 1010
      });

      expect(result.success).toBe(true);
      expect(result.cost).toBe(1010);
      
      const transactions = await adapter.getTransactions(user.id);
      expect(transactions[0].metadata.dynamicCost.variables).toEqual({ token: 1000000 });
    });

    it('should handle complex formulas with parentheses', async () => {
      const user = await adapter.createUser({ 
        id: 'user-30', 
        credits: 2000, 
        membershipTier: 'premium' 
      });

      const result = await engine.charge({
        userId: user.id,
        action: 'video-processing',
        variables: { 
          duration: 120, 
          resolution: 1920 
        }
      });

      expect(result.success).toBe(true);
      // (120 * 2 + 1920 * 0.5) * 0.8 = (240 + 960) * 0.8 = 1200 * 0.8 = 960
      expect(result.cost).toBe(960);
    });

    it('should handle insufficient credits error with dynamic formula', async () => {
      const user = await adapter.createUser({ 
        id: 'user-31', 
        credits: 10, 
        membershipTier: null 
      });

      await expect(
        engine.charge({
          userId: user.id,
          action: 'ai-completion',
          variables: { token: 3500 } // cost would be 13.5
        })
      ).rejects.toThrow('insufficient credits');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small costs correctly', async () => {
      const user = await adapter.createUser({ 
        id: 'user-32', 
        credits: 1000, 
        membershipTier: null 
      });

      const result = await engine.charge({
        userId: user.id,
        action: 'ai-completion',
        variables: { token: 1 } // 1 * 0.001 + 10 = 10.001
      });

      expect(result.success).toBe(true);
      expect(result.cost).toBe(10); // rounded to 10.00
    });

    it('should handle costs that round up', async () => {
      const user = await adapter.createUser({ 
        id: 'user-33', 
        credits: 1000, 
        membershipTier: null 
      });

      const result = await engine.charge({
        userId: user.id,
        action: 'ai-completion',
        variables: { token: 3456 } // 3456 * 0.001 + 10 = 13.456 -> 13.46
      });

      expect(result.success).toBe(true);
      expect(result.cost).toBe(13.46);
    });

    it('should handle costs that round down', async () => {
      const user = await adapter.createUser({ 
        id: 'user-34', 
        credits: 1000, 
        membershipTier: null 
      });

      const result = await engine.charge({
        userId: user.id,
        action: 'ai-completion',
        variables: { token: 3453 } // 3453 * 0.001 + 10 = 13.453 -> 13.45
      });

      expect(result.success).toBe(true);
      expect(result.cost).toBe(13.45);
    });
  });
});

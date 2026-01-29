/**
 * Task 5.3 Integration Test: 增强错误处理和审计日志
 * 
 * 验证需求:
 * - 5.1: 捕获MissingVariableError
 * - 5.2: 捕获FormulaEvaluationError（除零错误）
 * - 5.3: 捕获FormulaEvaluationError（其他运算错误）
 * - 5.4: 错误消息包含有用的上下文信息
 * - 5.5: 记录公式计算错误到审计日志
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CreditsEngine } from '../../src/core/CreditsEngine';
import { MockAdapter } from '../../src/adapters/MockAdapter';
import { MissingVariableError, FormulaEvaluationError } from '../../src/core/errors';
import type { CreditsConfig } from '../../src/core/types';

describe('Task 5.3: 增强错误处理和审计日志', () => {
  let engine: CreditsEngine;
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
    
    const config: CreditsConfig = {
      costs: {
        // 动态公式 - 需要token变量
        'ai-completion': {
          default: '{token} * 0.001 + 10'
        },
        // 动态公式 - 可能导致除零
        'data-processing': {
          default: '{amount} / {count}'
        },
        // 动态公式 - 多变量
        'video-processing': {
          default: '{duration} * 2 + {resolution} * 0.5'
        }
      },
      membership: {
        tiers: {
          free: 0,
          premium: 1
        },
        requirements: {
          'ai-completion': null,
          'data-processing': null,
          'video-processing': null
        },
        creditsCaps: {
          free: 100,
          premium: 1000
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
        enabled: true // 启用审计日志
      }
    };

    engine = new CreditsEngine({
      storage: adapter,
      config
    });
  });

  describe('Requirement 5.1: Catch MissingVariableError', () => {
    it('should throw MissingVariableError when required variable is not provided', async () => {
      const user = await adapter.createUser({ 
        id: 'user-1', 
        credits: 1000, 
        membershipTier: null 
      });

      // 验证需求 5.1: 捕获MissingVariableError
      await expect(
        engine.charge({
          userId: user.id,
          action: 'ai-completion',
          variables: {} // 缺少token变量
        })
      ).rejects.toThrow(MissingVariableError);
    });

    it('should throw MissingVariableError when some variables are missing', async () => {
      const user = await adapter.createUser({ 
        id: 'user-2', 
        credits: 1000, 
        membershipTier: null 
      });

      await expect(
        engine.charge({
          userId: user.id,
          action: 'video-processing',
          variables: { duration: 120 } // 缺少resolution变量
        })
      ).rejects.toThrow(MissingVariableError);
    });

    it('should throw MissingVariableError when no variables provided for dynamic formula', async () => {
      const user = await adapter.createUser({ 
        id: 'user-3', 
        credits: 1000, 
        membershipTier: null 
      });

      await expect(
        engine.charge({
          userId: user.id,
          action: 'ai-completion'
          // 完全没有提供variables参数
        })
      ).rejects.toThrow(MissingVariableError);
    });
  });

  describe('Requirement 5.2: Catch FormulaEvaluationError (Division by Zero)', () => {
    it('should throw FormulaEvaluationError for division by zero', async () => {
      const user = await adapter.createUser({ 
        id: 'user-4', 
        credits: 1000, 
        membershipTier: null 
      });

      // 验证需求 5.2: 捕获除零错误
      await expect(
        engine.charge({
          userId: user.id,
          action: 'data-processing',
          variables: { amount: 100, count: 0 } // 除零
        })
      ).rejects.toThrow(FormulaEvaluationError);
    });
  });

  describe('Requirement 5.3: Catch FormulaEvaluationError (Other Errors)', () => {
    it('should throw FormulaEvaluationError for NaN variable values', async () => {
      const user = await adapter.createUser({ 
        id: 'user-5', 
        credits: 1000, 
        membershipTier: null 
      });

      // 验证需求 5.3: 捕获其他运算错误
      await expect(
        engine.charge({
          userId: user.id,
          action: 'ai-completion',
          variables: { token: NaN } // NaN值
        })
      ).rejects.toThrow(FormulaEvaluationError);
    });

    it('should throw FormulaEvaluationError for Infinity variable values', async () => {
      const user = await adapter.createUser({ 
        id: 'user-6', 
        credits: 1000, 
        membershipTier: null 
      });

      await expect(
        engine.charge({
          userId: user.id,
          action: 'ai-completion',
          variables: { token: Infinity } // Infinity值
        })
      ).rejects.toThrow(FormulaEvaluationError);
    });
  });

  describe('Requirement 5.4: Error Messages with Context', () => {
    it('should include formula, missing variable, and provided variables in MissingVariableError', async () => {
      const user = await adapter.createUser({ 
        id: 'user-7', 
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
        
        // 验证需求 5.4: 错误消息包含有用的上下文信息
        expect(err.formula).toBe('{duration} * 2 + {resolution} * 0.5');
        expect(err.missingVariable).toBe('resolution');
        expect(err.providedVariables).toContain('duration');
        expect(err.message).toContain('resolution');
        expect(err.message).toContain('duration');
      }
    });

    it('should include formula, variables, and cause in FormulaEvaluationError', async () => {
      const user = await adapter.createUser({ 
        id: 'user-8', 
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
        
        // 验证需求 5.4: 错误消息包含有用的上下文信息
        expect(err.formula).toBe('{amount} / {count}');
        expect(err.variables).toEqual({ amount: 100, count: 0 });
        expect(err.cause).toBeDefined();
        expect(err.message).toContain('{amount} / {count}');
        expect(err.message).toContain('100');
        expect(err.message).toContain('0');
      }
    });
  });

  describe('Requirement 5.5: Audit Log for Formula Errors', () => {
    it('should create audit log entry for MissingVariableError', async () => {
      const user = await adapter.createUser({ 
        id: 'user-9', 
        credits: 1000, 
        membershipTier: null 
      });

      try {
        await engine.charge({
          userId: user.id,
          action: 'ai-completion',
          variables: {},
          metadata: { requestId: 'req-123' }
        });
        expect.fail('Should have thrown MissingVariableError');
      } catch (error) {
        // 错误应该被抛出
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
      expect(log.metadata.requestId).toBe('req-123');
    });

    it('should create audit log entry for FormulaEvaluationError (division by zero)', async () => {
      const user = await adapter.createUser({ 
        id: 'user-10', 
        credits: 1000, 
        membershipTier: null 
      });

      try {
        await engine.charge({
          userId: user.id,
          action: 'data-processing',
          variables: { amount: 100, count: 0 },
          metadata: { requestId: 'req-456' }
        });
        expect.fail('Should have thrown FormulaEvaluationError');
      } catch (error) {
        expect(error).toBeInstanceOf(FormulaEvaluationError);
      }

      // 验证需求 5.5: 记录公式计算错误到审计日志
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
      expect(log.metadata.requestId).toBe('req-456');
    });

    it('should create audit log entry for FormulaEvaluationError (NaN)', async () => {
      const user = await adapter.createUser({ 
        id: 'user-11', 
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
        id: 'user-12', 
        credits: 1000, 
        membershipTier: null 
      });

      try {
        await engine.charge({
          userId: user.id,
          action: 'video-processing',
          variables: { duration: 120 }, // 缺少resolution
          metadata: { 
            requestId: 'req-789',
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
      expect(log.metadata.requestId).toBe('req-789');
      expect(log.metadata.clientVersion).toBe('2.0.0');
      expect(log.metadata.source).toBe('api');
      
      // 验证错误详情被添加
      expect(log.metadata.errorType).toBe('MissingVariableError');
      expect(log.metadata.formula).toBeDefined();
      expect(log.metadata.missingVariable).toBeDefined();
    });
  });

  describe('Error Handling Does Not Affect User Balance', () => {
    it('should not deduct credits when MissingVariableError occurs', async () => {
      const user = await adapter.createUser({ 
        id: 'user-13', 
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
        id: 'user-14', 
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
        id: 'user-15', 
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
  });

  describe('Audit Log Disabled', () => {
    it('should not create audit log when audit is disabled', async () => {
      // 创建一个禁用审计日志的引擎
      const configWithoutAudit: CreditsConfig = {
        costs: {
          'ai-completion': {
            default: '{token} * 0.001 + 10'
          }
        },
        membership: {
          tiers: { free: 0 },
          requirements: { 'ai-completion': null },
          creditsCaps: { free: 100 }
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
          enabled: false // 禁用审计日志
        }
      };

      const engineWithoutAudit = new CreditsEngine({
        storage: adapter,
        config: configWithoutAudit
      });

      const user = await adapter.createUser({ 
        id: 'user-16', 
        credits: 1000, 
        membershipTier: null 
      });

      try {
        await engineWithoutAudit.charge({
          userId: user.id,
          action: 'ai-completion',
          variables: {}
        });
        expect.fail('Should have thrown MissingVariableError');
      } catch (error) {
        expect(error).toBeInstanceOf(MissingVariableError);
      }

      // 验证没有创建审计日志
      const auditLogs = await adapter.getAuditLogs(user.id);
      expect(auditLogs).toHaveLength(0);
    });
  });
});

/**
 * Task 5.2 Integration Test: charge方法支持variables并记录计算详情到metadata
 * 
 * 验证需求:
 * - 2.1: charge方法接受variables参数
 * - 2.2: 将variables传递给costFormula.calculate()
 * - 6.1: 在交易记录的metadata中保存使用的公式
 * - 6.2: 在metadata中保存所有输入变量的名称和值
 * - 6.3: 在metadata中保存计算得出的原始成本值（未四舍五入）
 * - 6.4: 在metadata中保存最终使用的成本值（四舍五入后）
 * - 6.5: 只在使用动态公式时添加dynamicCost字段
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CreditsEngine } from '../../src/core/CreditsEngine';
import { MockAdapter } from '../../src/adapters/MockAdapter';
import type { CreditsConfig } from '../../src/core/types';

describe('Task 5.2: charge方法支持variables并记录计算详情', () => {
  let engine: CreditsEngine;
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
    
    const config: CreditsConfig = {
      costs: {
        // 固定成本（向后兼容）
        'generate-image': {
          default: 20,
          premium: 15
        },
        // 动态公式
        'ai-completion': {
          default: '{token} * 0.001 + 10',
          premium: '{token} * 0.0008 + 8'
        },
        // 多变量公式
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
          'generate-image': null,
          'ai-completion': null,
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
        enabled: false
      }
    };

    engine = new CreditsEngine({
      storage: adapter,
      config
    });
  });

  describe('Variables Parameter Support', () => {
    it('should accept variables parameter in charge method', async () => {
      const user = await adapter.createUser({ 
        id: 'user-1', 
        credits: 1000, 
        membershipTier: null 
      });

      // 验证需求 2.1: charge方法接受variables参数
      const result = await engine.charge({
        userId: user.id,
        action: 'ai-completion',
        variables: { token: 3500 }
      });

      expect(result.success).toBe(true);
      expect(result.cost).toBe(13.5); // 3500 * 0.001 + 10 = 13.5
    });

    it('should pass variables to costFormula.calculate()', async () => {
      const user = await adapter.createUser({ 
        id: 'user-2', 
        credits: 1000, 
        membershipTier: null 
      });

      // 验证需求 2.2: 将variables传递给costFormula.calculate()
      const result = await engine.charge({
        userId: user.id,
        action: 'ai-completion',
        variables: { token: 5000 }
      });

      // 如果variables正确传递，成本应该是 5000 * 0.001 + 10 = 15
      expect(result.cost).toBe(15);
    });
  });

  describe('Calculation Details in Metadata - Dynamic Formula', () => {
    it('should record formula in metadata for dynamic cost', async () => {
      const user = await adapter.createUser({ 
        id: 'user-3', 
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
      
      // 验证需求 6.1: 在metadata中保存使用的公式
      expect(transactions[0].metadata).toHaveProperty('dynamicCost');
      expect(transactions[0].metadata.dynamicCost).toHaveProperty('formula');
      expect(transactions[0].metadata.dynamicCost.formula).toBe('{token} * 0.001 + 10');
    });

    it('should record variables in metadata for dynamic cost', async () => {
      const user = await adapter.createUser({ 
        id: 'user-4', 
        credits: 1000, 
        membershipTier: null 
      });

      await engine.charge({
        userId: user.id,
        action: 'ai-completion',
        variables: { token: 3500 }
      });

      const transactions = await adapter.getTransactions(user.id);
      
      // 验证需求 6.2: 在metadata中保存所有输入变量的名称和值
      expect(transactions[0].metadata.dynamicCost).toHaveProperty('variables');
      expect(transactions[0].metadata.dynamicCost.variables).toEqual({ token: 3500 });
    });

    it('should record rawCost in metadata for dynamic cost', async () => {
      const user = await adapter.createUser({ 
        id: 'user-5', 
        credits: 1000, 
        membershipTier: null 
      });

      await engine.charge({
        userId: user.id,
        action: 'ai-completion',
        variables: { token: 3333 } // 3333 * 0.001 + 10 = 13.333
      });

      const transactions = await adapter.getTransactions(user.id);
      
      // 验证需求 6.3: 在metadata中保存计算得出的原始成本值（未四舍五入）
      expect(transactions[0].metadata.dynamicCost).toHaveProperty('rawCost');
      expect(transactions[0].metadata.dynamicCost.rawCost).toBe(13.333);
    });

    it('should record finalCost in metadata for dynamic cost', async () => {
      const user = await adapter.createUser({ 
        id: 'user-6', 
        credits: 1000, 
        membershipTier: null 
      });

      await engine.charge({
        userId: user.id,
        action: 'ai-completion',
        variables: { token: 3333 } // 3333 * 0.001 + 10 = 13.333 -> 13.33
      });

      const transactions = await adapter.getTransactions(user.id);
      
      // 验证需求 6.4: 在metadata中保存最终使用的成本值（四舍五入后）
      expect(transactions[0].metadata.dynamicCost).toHaveProperty('finalCost');
      expect(transactions[0].metadata.dynamicCost.finalCost).toBe(13.33);
    });

    it('should record complete calculation details for dynamic cost', async () => {
      const user = await adapter.createUser({ 
        id: 'user-7', 
        credits: 1000, 
        membershipTier: null 
      });

      await engine.charge({
        userId: user.id,
        action: 'ai-completion',
        variables: { token: 3500 }
      });

      const transactions = await adapter.getTransactions(user.id);
      
      // 验证所有计算详情字段都存在
      expect(transactions[0].metadata.dynamicCost).toEqual({
        formula: '{token} * 0.001 + 10',
        variables: { token: 3500 },
        rawCost: 13.5,
        finalCost: 13.5
      });
    });

    it('should record calculation details for multiple variables', async () => {
      const user = await adapter.createUser({ 
        id: 'user-8', 
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

    it('should record tier-specific formula in metadata', async () => {
      const user = await adapter.createUser({ 
        id: 'user-9', 
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
  });

  describe('No dynamicCost Field for Fixed Cost', () => {
    it('should NOT add dynamicCost field for fixed cost', async () => {
      const user = await adapter.createUser({ 
        id: 'user-10', 
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
        id: 'user-11', 
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

  describe('Metadata Preservation', () => {
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
    });

    it('should preserve user-provided metadata for fixed cost', async () => {
      const user = await adapter.createUser({ 
        id: 'user-13', 
        credits: 1000, 
        membershipTier: null 
      });

      await engine.charge({
        userId: user.id,
        action: 'generate-image',
        metadata: { 
          requestId: 'req-456'
        }
      });

      const transactions = await adapter.getTransactions(user.id);
      
      // 用户提供的metadata应该被保留
      expect(transactions[0].metadata.requestId).toBe('req-456');
      
      // 不应该有dynamicCost字段
      expect(transactions[0].metadata.dynamicCost).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rounding correctly in metadata', async () => {
      const user = await adapter.createUser({ 
        id: 'user-14', 
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

    it('should handle zero cost in metadata', async () => {
      const user = await adapter.createUser({ 
        id: 'user-15', 
        credits: 1000, 
        membershipTier: null 
      });

      await engine.charge({
        userId: user.id,
        action: 'ai-completion',
        variables: { token: 0 } // 0 * 0.001 + 10 = 10
      });

      const transactions = await adapter.getTransactions(user.id);
      
      expect(transactions[0].metadata.dynamicCost.variables).toEqual({ token: 0 });
      expect(transactions[0].metadata.dynamicCost.rawCost).toBe(10);
      expect(transactions[0].metadata.dynamicCost.finalCost).toBe(10);
    });

    it('should handle large numbers in metadata', async () => {
      const user = await adapter.createUser({ 
        id: 'user-16', 
        credits: 10000, 
        membershipTier: null 
      });

      await engine.charge({
        userId: user.id,
        action: 'ai-completion',
        variables: { token: 1000000 } // 1000000 * 0.001 + 10 = 1010
      });

      const transactions = await adapter.getTransactions(user.id);
      
      expect(transactions[0].metadata.dynamicCost.variables).toEqual({ token: 1000000 });
      expect(transactions[0].metadata.dynamicCost.rawCost).toBe(1010);
      expect(transactions[0].metadata.dynamicCost.finalCost).toBe(1010);
    });
  });
});

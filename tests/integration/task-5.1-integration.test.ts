/**
 * Task 5.1 Integration Test: CreditsEngine使用DynamicCostFormula
 * 
 * 验证CreditsEngine的charge方法能够正确使用DynamicCostFormula
 * 并支持variables参数进行动态成本计算
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CreditsEngine } from '../../src/core/CreditsEngine';
import { MockAdapter } from '../../src/adapters/MockAdapter';
import type { CreditsConfig } from '../../src/core/types';

describe('Task 5.1: CreditsEngine Integration with DynamicCostFormula', () => {
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
        // 动态公式
        'ai-completion': {
          default: '{token} * 0.001 + 10',
          premium: '{token} * 0.0008 + 8',
          enterprise: '{token} * 0.0005 + 5'
        },
        // 复杂公式
        'video-processing': {
          default: '{duration} * 2 + {resolution} * 0.5',
          premium: '({duration} * 2 + {resolution} * 0.5) * 0.8'
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
          'video-processing': null
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
        enabled: false
      }
    };

    engine = new CreditsEngine({
      storage: adapter,
      config
    });
  });

  describe('Fixed Cost (Backward Compatibility)', () => {
    it('should charge fixed cost without variables', async () => {
      const user = await adapter.createUser({ id: 'user-1', credits: 1000, membershipTier: null });

      const result = await engine.charge({
        userId: user.id,
        action: 'generate-image'
      });

      expect(result.success).toBe(true);
      expect(result.cost).toBe(20); // default cost
      expect(result.balanceBefore).toBe(1000);
      expect(result.balanceAfter).toBe(980);
    });

    it('should charge tier-specific fixed cost', async () => {
      const user = await adapter.createUser({ id: 'user-2', credits: 1000, membershipTier: 'premium' });

      const result = await engine.charge({
        userId: user.id,
        action: 'generate-image'
      });

      expect(result.success).toBe(true);
      expect(result.cost).toBe(15); // premium cost
      expect(result.balanceAfter).toBe(985);
    });
  });

  describe('Dynamic Formula with Variables', () => {
    it('should charge using dynamic formula with variables', async () => {
      const user = await adapter.createUser({ id: 'user-3', credits: 1000, membershipTier: null });

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

    it('should use tier-specific formula with variables', async () => {
      const user = await adapter.createUser({ id: 'user-4', credits: 1000, membershipTier: 'premium' });

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

    it('should handle multiple variables', async () => {
      const user = await adapter.createUser({ id: 'user-5', credits: 2000, membershipTier: null });

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

    it('should round cost to 2 decimal places', async () => {
      const user = await adapter.createUser({ id: 'user-6', credits: 1000, membershipTier: null });

      const result = await engine.charge({
        userId: user.id,
        action: 'ai-completion',
        variables: { token: 3333 } // 3333 * 0.001 + 10 = 13.333
      });

      expect(result.success).toBe(true);
      expect(result.cost).toBe(13.33); // rounded to 2 decimals
    });
  });

  describe('Fallback Mechanism', () => {
    it('should use default value when variables not provided and default is number', async () => {
      // This test would require a config where default is a number
      // but tier-specific is a formula - not in our current config
      // So we'll skip this for now
    });
  });

  describe('Error Handling', () => {
    it('should throw error when required variables are missing', async () => {
      const user = await adapter.createUser({ id: 'user-7', credits: 1000, membershipTier: null });

      await expect(
        engine.charge({
          userId: user.id,
          action: 'ai-completion'
          // variables not provided
        })
      ).rejects.toThrow();
    });

    it('should throw error for insufficient credits', async () => {
      const user = await adapter.createUser({ id: 'user-8', credits: 10, membershipTier: null }); // only 10 credits

      await expect(
        engine.charge({
          userId: user.id,
          action: 'ai-completion',
          variables: { token: 3500 } // cost would be 13.5
        })
      ).rejects.toThrow('insufficient credits');
    });
  });

  describe('Transaction Recording', () => {
    it('should create transaction record with correct amount', async () => {
      const user = await adapter.createUser({ id: 'user-9', credits: 1000, membershipTier: null });

      const result = await engine.charge({
        userId: user.id,
        action: 'ai-completion',
        variables: { token: 3500 }
      });

      const transactions = await adapter.getTransactions(user.id);
      expect(transactions).toHaveLength(1);
      expect(transactions[0].amount).toBe(-13.5); // negative for charge
      expect(transactions[0].action).toBe('ai-completion');
    });
  });

  describe('Integration with Other Features', () => {
    it('should work with metadata', async () => {
      const user = await adapter.createUser({ id: 'user-10', credits: 1000, membershipTier: null });

      const result = await engine.charge({
        userId: user.id,
        action: 'ai-completion',
        variables: { token: 3500 },
        metadata: { requestId: 'req-123' }
      });

      expect(result.success).toBe(true);
      
      const transactions = await adapter.getTransactions(user.id);
      // User-provided metadata should be preserved
      expect(transactions[0].metadata.requestId).toBe('req-123');
      // Dynamic cost details should also be added
      expect(transactions[0].metadata.dynamicCost).toBeDefined();
      expect(transactions[0].metadata.dynamicCost.formula).toBe('{token} * 0.001 + 10');
      expect(transactions[0].metadata.dynamicCost.variables).toEqual({ token: 3500 });
    });

    it('should work with different membership tiers', async () => {
      const freeUser = await adapter.createUser({ id: 'user-11', credits: 1000, membershipTier: null });
      const premiumUser = await adapter.createUser({ id: 'user-12', credits: 1000, membershipTier: 'premium' });
      const enterpriseUser = await adapter.createUser({ id: 'user-13', credits: 1000, membershipTier: 'enterprise' });

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
  });
});

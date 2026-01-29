/**
 * Task 3 Verification Tests: 扩展类型定义
 * 
 * 验证以下类型定义是否正确添加:
 * 1. DynamicCostConfig 类型
 * 2. CalculationDetails 接口
 * 3. ChargeParams 接口中的 variables 字段
 */

import { describe, it, expect } from 'vitest';
import type { 
  DynamicCostConfig, 
  CalculationDetails, 
  ChargeParams 
} from '../../src/core/types';

describe('Task 3: 扩展类型定义 - Type Verification', () => {
  describe('DynamicCostConfig Type', () => {
    it('should accept fixed cost configuration (backward compatible)', () => {
      const config: DynamicCostConfig = {
        'generate-image': {
          default: 20,
          premium: 15,
          enterprise: 10
        }
      };

      expect(config['generate-image'].default).toBe(20);
      expect(config['generate-image'].premium).toBe(15);
      expect(config['generate-image'].enterprise).toBe(10);
    });

    it('should accept dynamic formula configuration', () => {
      const config: DynamicCostConfig = {
        'ai-completion': {
          default: '{token} * 0.001 + 10',
          premium: '{token} * 0.0008 + 8',
          enterprise: '{token} * 0.0005 + 5'
        }
      };

      expect(config['ai-completion'].default).toBe('{token} * 0.001 + 10');
      expect(config['ai-completion'].premium).toBe('{token} * 0.0008 + 8');
      expect(config['ai-completion'].enterprise).toBe('{token} * 0.0005 + 5');
    });

    it('should accept mixed configuration (fixed and dynamic)', () => {
      const config: DynamicCostConfig = {
        'generate-image': {
          default: 20,
          premium: 15
        },
        'ai-completion': {
          default: '{token} * 0.001 + 10',
          premium: '{token} * 0.0008 + 8'
        },
        'video-processing': {
          default: '{duration} * 2 + {resolution} * 0.5',
          premium: '({duration} * 2 + {resolution} * 0.5) * 0.8'
        }
      };

      expect(typeof config['generate-image'].default).toBe('number');
      expect(typeof config['ai-completion'].default).toBe('string');
      expect(typeof config['video-processing'].default).toBe('string');
    });
  });

  describe('CalculationDetails Interface', () => {
    it('should accept calculation details for dynamic formula', () => {
      const details: CalculationDetails = {
        formula: '{token} * 0.001 + 10',
        variables: { token: 3500 },
        rawCost: 13.5,
        finalCost: 13.5,
        isDynamic: true
      };

      expect(details.formula).toBe('{token} * 0.001 + 10');
      expect(details.variables).toEqual({ token: 3500 });
      expect(details.rawCost).toBe(13.5);
      expect(details.finalCost).toBe(13.5);
      expect(details.isDynamic).toBe(true);
    });

    it('should accept calculation details for fixed cost', () => {
      const details: CalculationDetails = {
        rawCost: 20,
        finalCost: 20,
        isDynamic: false
      };

      expect(details.formula).toBeUndefined();
      expect(details.variables).toBeUndefined();
      expect(details.rawCost).toBe(20);
      expect(details.finalCost).toBe(20);
      expect(details.isDynamic).toBe(false);
    });

    it('should accept calculation details with multiple variables', () => {
      const details: CalculationDetails = {
        formula: '{duration} * 2 + {resolution} * 0.5',
        variables: { 
          duration: 120, 
          resolution: 1920 
        },
        rawCost: 1200,
        finalCost: 1200,
        isDynamic: true
      };

      expect(details.variables).toEqual({ 
        duration: 120, 
        resolution: 1920 
      });
    });
  });

  describe('ChargeParams Interface - variables field', () => {
    it('should accept charge params without variables (backward compatible)', () => {
      const params: ChargeParams = {
        userId: 'user-123',
        action: 'generate-image'
      };

      expect(params.userId).toBe('user-123');
      expect(params.action).toBe('generate-image');
      expect(params.variables).toBeUndefined();
    });

    it('should accept charge params with variables', () => {
      const params: ChargeParams = {
        userId: 'user-123',
        action: 'ai-completion',
        variables: { token: 3500 }
      };

      expect(params.userId).toBe('user-123');
      expect(params.action).toBe('ai-completion');
      expect(params.variables).toEqual({ token: 3500 });
    });

    it('should accept charge params with multiple variables', () => {
      const params: ChargeParams = {
        userId: 'user-123',
        action: 'video-processing',
        variables: { 
          duration: 120, 
          resolution: 1920 
        }
      };

      expect(params.variables).toEqual({ 
        duration: 120, 
        resolution: 1920 
      });
    });

    it('should accept charge params with all optional fields', () => {
      const params: ChargeParams = {
        userId: 'user-123',
        action: 'ai-completion',
        idempotencyKey: 'key-123',
        metadata: { requestId: 'req-456' },
        variables: { token: 3500 }
      };

      expect(params.idempotencyKey).toBe('key-123');
      expect(params.metadata).toEqual({ requestId: 'req-456' });
      expect(params.variables).toEqual({ token: 3500 });
    });
  });

  describe('Type Compatibility', () => {
    it('should allow DynamicCostConfig to be used where CostConfig is expected', () => {
      // This test verifies that DynamicCostConfig is a superset of CostConfig
      const dynamicConfig: DynamicCostConfig = {
        'test-action': {
          default: 100,
          premium: 80
        }
      };

      // Should be able to access properties like CostConfig
      expect(dynamicConfig['test-action'].default).toBeDefined();
      expect(typeof dynamicConfig['test-action'].default === 'number' || 
             typeof dynamicConfig['test-action'].default === 'string').toBe(true);
    });

    it('should allow variables to be Record<string, number>', () => {
      const variables: Record<string, number> = {
        token: 3500,
        duration: 120,
        resolution: 1920
      };

      const params: ChargeParams = {
        userId: 'user-123',
        action: 'test',
        variables
      };

      expect(params.variables).toBe(variables);
    });
  });
});

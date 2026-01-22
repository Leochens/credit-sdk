/**
 * CostFormula 单元测试
 * 测试成本计算逻辑的各种场景
 */

import { describe, it, expect } from 'vitest';
import { CostFormula } from '../../src/features/CostFormula';
import { UndefinedActionError } from '../../src/core/errors';
import { CostConfig } from '../../src/core/types';

describe('CostFormula', () => {
  // 测试用的成本配置
  const costConfig: CostConfig = {
    'generate-post': {
      default: 10,
      premium: 8,
      enterprise: 5,
    },
    'generate-image': {
      default: 20,
      premium: 15,
      enterprise: 10,
    },
    'analyze-text': {
      default: 5,
      // 没有会员等级定价
    },
  };

  describe('calculate', () => {
    it('should return default cost when membershipTier is null', () => {
      const formula = new CostFormula(costConfig);
      
      expect(formula.calculate('generate-post', null)).toBe(10);
      expect(formula.calculate('generate-image', null)).toBe(20);
      expect(formula.calculate('analyze-text', null)).toBe(5);
    });

    it('should return tier-specific cost when membershipTier is defined', () => {
      const formula = new CostFormula(costConfig);
      
      expect(formula.calculate('generate-post', 'premium')).toBe(8);
      expect(formula.calculate('generate-post', 'enterprise')).toBe(5);
      expect(formula.calculate('generate-image', 'premium')).toBe(15);
      expect(formula.calculate('generate-image', 'enterprise')).toBe(10);
    });

    it('should return default cost when membershipTier is not defined in config', () => {
      const formula = new CostFormula(costConfig);
      
      // 'analyze-text' 没有会员等级定价
      expect(formula.calculate('analyze-text', 'premium')).toBe(5);
      expect(formula.calculate('analyze-text', 'enterprise')).toBe(5);
      
      // 使用未定义的会员等级
      expect(formula.calculate('generate-post', 'unknown-tier')).toBe(10);
    });

    it('should throw UndefinedActionError when action is not in config', () => {
      const formula = new CostFormula(costConfig);
      
      expect(() => {
        formula.calculate('undefined-action', null);
      }).toThrow(UndefinedActionError);
      
      expect(() => {
        formula.calculate('undefined-action', 'premium');
      }).toThrow(UndefinedActionError);
    });

    it('should throw UndefinedActionError with correct action name', () => {
      const formula = new CostFormula(costConfig);
      
      try {
        formula.calculate('unknown-action', null);
        expect.fail('Should have thrown UndefinedActionError');
      } catch (error) {
        expect(error).toBeInstanceOf(UndefinedActionError);
        expect((error as UndefinedActionError).action).toBe('unknown-action');
        expect((error as UndefinedActionError).code).toBe('UNDEFINED_ACTION');
      }
    });

    it('should handle empty cost config', () => {
      const emptyConfig: CostConfig = {};
      const formula = new CostFormula(emptyConfig);
      
      expect(() => {
        formula.calculate('any-action', null);
      }).toThrow(UndefinedActionError);
    });

    it('should handle cost config with only default values', () => {
      const simpleConfig: CostConfig = {
        'simple-action': {
          default: 100,
        },
      };
      const formula = new CostFormula(simpleConfig);
      
      expect(formula.calculate('simple-action', null)).toBe(100);
      expect(formula.calculate('simple-action', 'premium')).toBe(100);
      expect(formula.calculate('simple-action', 'any-tier')).toBe(100);
    });

    it('should handle zero cost', () => {
      const zeroConfig: CostConfig = {
        'free-action': {
          default: 0,
          premium: 0,
        },
      };
      const formula = new CostFormula(zeroConfig);
      
      expect(formula.calculate('free-action', null)).toBe(0);
      expect(formula.calculate('free-action', 'premium')).toBe(0);
    });

    it('should handle multiple tier levels correctly', () => {
      const multiTierConfig: CostConfig = {
        'multi-tier-action': {
          default: 100,
          basic: 90,
          premium: 70,
          enterprise: 50,
          vip: 30,
        },
      };
      const formula = new CostFormula(multiTierConfig);
      
      expect(formula.calculate('multi-tier-action', null)).toBe(100);
      expect(formula.calculate('multi-tier-action', 'basic')).toBe(90);
      expect(formula.calculate('multi-tier-action', 'premium')).toBe(70);
      expect(formula.calculate('multi-tier-action', 'enterprise')).toBe(50);
      expect(formula.calculate('multi-tier-action', 'vip')).toBe(30);
    });
  });
});

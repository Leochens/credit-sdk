/**
 * DynamicCostFormula 单元测试
 * 测试动态成本计算类的基础功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DynamicCostFormula } from '../../src/features/DynamicCostFormula';
import { DynamicCostConfig } from '../../src/core/types';
import { UndefinedActionError, ConfigurationError } from '../../src/core/errors';

describe('DynamicCostFormula', () => {
  describe('构造函数和初始化', () => {
    it('should create instance with valid config', () => {
      const config: DynamicCostConfig = {
        'test-action': {
          default: 10,
          premium: 8
        }
      };

      const formula = new DynamicCostFormula(config);
      expect(formula).toBeInstanceOf(DynamicCostFormula);
    });

    it('should validate all formulas during construction', () => {
      const config: DynamicCostConfig = {
        'test-action': {
          default: '{token} * 0.001 + 10',
          premium: '{token} * 0.0008 + 8'
        }
      };

      const formula = new DynamicCostFormula(config);
      expect(formula).toBeInstanceOf(DynamicCostFormula);
    });

    it('should throw error for invalid formula syntax', () => {
      const config: DynamicCostConfig = {
        'test-action': {
          default: '{token * 0.001', // 缺少右括号
          premium: 8
        }
      };

      expect(() => new DynamicCostFormula(config)).toThrow();
    });

    it('should throw error for invalid variable name', () => {
      const config: DynamicCostConfig = {
        'test-action': {
          default: '{token-count} * 0.001', // 变量名包含连字符
          premium: 8
        }
      };

      expect(() => new DynamicCostFormula(config)).toThrow();
    });

    it('should accept mixed config (fixed costs and formulas)', () => {
      const config: DynamicCostConfig = {
        'fixed-action': {
          default: 20,
          premium: 15
        },
        'dynamic-action': {
          default: '{token} * 0.001 + 10',
          premium: '{token} * 0.0008 + 8'
        }
      };

      const formula = new DynamicCostFormula(config);
      expect(formula).toBeInstanceOf(DynamicCostFormula);
    });
  });

  describe('calculate - 固定成本', () => {
    let formula: DynamicCostFormula;

    beforeEach(() => {
      const config: DynamicCostConfig = {
        'generate-image': {
          default: 20,
          premium: 15,
          enterprise: 10
        }
      };
      formula = new DynamicCostFormula(config);
    });

    it('should return default cost when no membership tier', () => {
      const cost = formula.calculate('generate-image', null);
      expect(cost).toBe(20);
    });

    it('should return tier-specific cost when tier exists', () => {
      const cost = formula.calculate('generate-image', 'premium');
      expect(cost).toBe(15);
    });

    it('should return default cost when tier not defined', () => {
      const cost = formula.calculate('generate-image', 'unknown-tier');
      expect(cost).toBe(20);
    });

    it('should throw UndefinedActionError for undefined action', () => {
      expect(() => formula.calculate('undefined-action', null)).toThrow(UndefinedActionError);
    });
  });

  describe('calculate - 动态公式', () => {
    let formula: DynamicCostFormula;

    beforeEach(() => {
      const config: DynamicCostConfig = {
        'ai-completion': {
          default: '{token} * 0.001 + 10',
          premium: '{token} * 0.0008 + 8',
          enterprise: '{token} * 0.0005 + 5'
        }
      };
      formula = new DynamicCostFormula(config);
    });

    it('should calculate cost using formula with variables', () => {
      const cost = formula.calculate('ai-completion', null, { token: 3500 });
      expect(cost).toBe(13.5);
    });

    it('should use tier-specific formula', () => {
      const cost = formula.calculate('ai-completion', 'premium', { token: 3500 });
      expect(cost).toBe(10.8);
    });

    it('should round to 2 decimal places', () => {
      const cost = formula.calculate('ai-completion', null, { token: 3333 });
      // 3333 * 0.001 + 10 = 13.333
      expect(cost).toBe(13.33);
    });

    it('should return 0 for negative results', () => {
      const config: DynamicCostConfig = {
        'test-action': {
          default: '{value} - 100'
        }
      };
      const formula = new DynamicCostFormula(config);
      const cost = formula.calculate('test-action', null, { value: 50 });
      expect(cost).toBe(0);
    });
  });

  describe('calculate - 回退机制', () => {
    it('should use default value when variables not provided and default is number', () => {
      const config: DynamicCostConfig = {
        'test-action': {
          default: 10,
          premium: '{token} * 0.001'
        }
      };
      const formula = new DynamicCostFormula(config);
      
      // 当使用premium tier但未提供variables时，应该回退到default值
      const cost = formula.calculate('test-action', 'premium');
      expect(cost).toBe(10);
    });

    it('should throw error when variables not provided and default is also formula', () => {
      const config: DynamicCostConfig = {
        'test-action': {
          default: '{token} * 0.001',
          premium: '{token} * 0.0008'
        }
      };
      const formula = new DynamicCostFormula(config);
      
      // 当default也是公式且未提供variables时，应该抛出错误
      expect(() => formula.calculate('test-action', null)).toThrow();
    });
  });

  describe('getCalculationDetails', () => {
    let formula: DynamicCostFormula;

    beforeEach(() => {
      const config: DynamicCostConfig = {
        'fixed-action': {
          default: 20,
          premium: 15
        },
        'dynamic-action': {
          default: '{token} * 0.001 + 10',
          premium: '{token} * 0.0008 + 8'
        }
      };
      formula = new DynamicCostFormula(config);
    });

    it('should return details for fixed cost', () => {
      const details = formula.getCalculationDetails('fixed-action', null);
      
      expect(details.isDynamic).toBe(false);
      expect(details.rawCost).toBe(20);
      expect(details.finalCost).toBe(20);
      expect(details.formula).toBeUndefined();
      expect(details.variables).toBeUndefined();
    });

    it('should return details for dynamic formula', () => {
      const details = formula.getCalculationDetails('dynamic-action', null, { token: 3500 });
      
      expect(details.isDynamic).toBe(true);
      expect(details.formula).toBe('{token} * 0.001 + 10');
      expect(details.variables).toEqual({ token: 3500 });
      expect(details.rawCost).toBe(13.5);
      expect(details.finalCost).toBe(13.5);
    });

    it('should return details with tier-specific formula', () => {
      const details = formula.getCalculationDetails('dynamic-action', 'premium', { token: 3500 });
      
      expect(details.isDynamic).toBe(true);
      expect(details.formula).toBe('{token} * 0.0008 + 8');
      expect(details.variables).toEqual({ token: 3500 });
      expect(details.rawCost).toBe(10.8);
      expect(details.finalCost).toBe(10.8);
    });
  });

  describe('isDynamic', () => {
    let formula: DynamicCostFormula;

    beforeEach(() => {
      const config: DynamicCostConfig = {
        'fixed-action': {
          default: 20,
          premium: 15
        },
        'dynamic-action': {
          default: '{token} * 0.001 + 10',
          premium: 15 // premium tier 使用固定成本
        }
      };
      formula = new DynamicCostFormula(config);
    });

    it('should return false for fixed cost', () => {
      expect(formula.isDynamic('fixed-action', null)).toBe(false);
      expect(formula.isDynamic('fixed-action', 'premium')).toBe(false);
    });

    it('should return true for dynamic formula', () => {
      expect(formula.isDynamic('dynamic-action', null)).toBe(true);
    });

    it('should return false when tier uses fixed cost even if default is dynamic', () => {
      expect(formula.isDynamic('dynamic-action', 'premium')).toBe(false);
    });

    it('should throw UndefinedActionError for undefined action', () => {
      expect(() => formula.isDynamic('undefined-action', null)).toThrow(UndefinedActionError);
    });
  });

  describe('公式缓存', () => {
    it('should cache parsed formulas', () => {
      const config: DynamicCostConfig = {
        'test-action': {
          default: '{token} * 0.001 + 10'
        }
      };
      const formula = new DynamicCostFormula(config);
      
      // 第一次计算
      const cost1 = formula.calculate('test-action', null, { token: 1000 });
      expect(cost1).toBe(11);
      
      // 第二次计算应该使用缓存的公式
      const cost2 = formula.calculate('test-action', null, { token: 2000 });
      expect(cost2).toBe(12);
    });
  });

  describe('复杂公式场景', () => {
    it('should handle complex formulas with multiple variables', () => {
      const config: DynamicCostConfig = {
        'video-processing': {
          default: '{duration} * 2 + {resolution} * 0.5'
        }
      };
      const formula = new DynamicCostFormula(config);
      
      const cost = formula.calculate('video-processing', null, {
        duration: 120,
        resolution: 1080
      });
      
      // 120 * 2 + 1080 * 0.5 = 240 + 540 = 780
      expect(cost).toBe(780);
    });

    it('should handle formulas with parentheses', () => {
      const config: DynamicCostConfig = {
        'test-action': {
          default: '({duration} * 2 + {resolution} * 0.5) * 0.8'
        }
      };
      const formula = new DynamicCostFormula(config);
      
      const cost = formula.calculate('test-action', null, {
        duration: 100,
        resolution: 1000
      });
      
      // (100 * 2 + 1000 * 0.5) * 0.8 = (200 + 500) * 0.8 = 700 * 0.8 = 560
      expect(cost).toBe(560);
    });

    it('should handle ternary operator in formulas', () => {
      const config: DynamicCostConfig = {
        'data-analysis': {
          default: '{rows} <= 1000 ? {rows} * 0.1 : 100 + ({rows} - 1000) * 0.05'
        }
      };
      const formula = new DynamicCostFormula(config);
      
      // 小于1000行
      const cost1 = formula.calculate('data-analysis', null, { rows: 500 });
      expect(cost1).toBe(50);
      
      // 大于1000行
      const cost2 = formula.calculate('data-analysis', null, { rows: 2000 });
      expect(cost2).toBe(150);
    });
  });
});

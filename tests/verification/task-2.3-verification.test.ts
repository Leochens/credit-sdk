/**
 * Task 2.3 Verification Test
 * 验证公式计算功能是否满足所有要求
 * 
 * Requirements:
 * - 实现 evaluate() 方法：将变量值代入公式计算结果
 * - 处理缺少变量的情况，抛出MissingVariableError
 * - 处理除零错误，抛出FormulaEvaluationError
 * - 处理其他运算错误，抛出FormulaEvaluationError
 * - Requirements: 2.2, 5.1, 5.2, 5.3
 */

import { describe, it, expect } from 'vitest';
import { FormulaParser } from '../../src/features/FormulaParser';
import { MissingVariableError, FormulaEvaluationError } from '../../src/core/errors';

describe('Task 2.3: Formula Calculation Verification', () => {
  describe('Requirement 2.2: evaluate() method implementation', () => {
    it('should correctly substitute variables and calculate results', () => {
      const parser = new FormulaParser();
      
      // Simple substitution
      const result1 = parser.evaluate('{token} * 0.001 + 10', { token: 3500 });
      expect(result1).toBe(13.5);
      
      // Multiple variables
      const result2 = parser.evaluate('{token} * 0.001 + {duration} * 0.5', {
        token: 1000,
        duration: 20
      });
      expect(result2).toBe(11);
      
      // Complex expression
      const result3 = parser.evaluate('({width} * {height}) / 1000', {
        width: 1920,
        height: 1080
      });
      expect(result3).toBe(2073.6);
    });

    it('should handle all basic mathematical operators', () => {
      const parser = new FormulaParser();
      
      expect(parser.evaluate('{a} + {b}', { a: 10, b: 5 })).toBe(15);
      expect(parser.evaluate('{a} - {b}', { a: 10, b: 5 })).toBe(5);
      expect(parser.evaluate('{a} * {b}', { a: 10, b: 5 })).toBe(50);
      expect(parser.evaluate('{a} / {b}', { a: 10, b: 5 })).toBe(2);
    });

    it('should respect operator precedence', () => {
      const parser = new FormulaParser();
      
      // Multiplication before addition
      expect(parser.evaluate('{a} + {b} * {c}', { a: 10, b: 5, c: 2 })).toBe(20);
      
      // Parentheses override precedence
      expect(parser.evaluate('({a} + {b}) * {c}', { a: 10, b: 5, c: 2 })).toBe(30);
    });
  });

  describe('Requirement 5.1: Missing variable error handling', () => {
    it('should throw MissingVariableError when required variable is not provided', () => {
      const parser = new FormulaParser();
      
      expect(() => {
        parser.evaluate('{token} * 0.5', {});
      }).toThrow(MissingVariableError);
      
      expect(() => {
        parser.evaluate('{token} + {duration}', { token: 100 });
      }).toThrow(MissingVariableError);
    });

    it('should include formula, missing variable, and provided variables in error', () => {
      const parser = new FormulaParser();
      const formula = '{token} * 0.001 + {duration}';
      
      try {
        parser.evaluate(formula, { token: 1000 });
        expect.fail('Should have thrown MissingVariableError');
      } catch (error) {
        expect(error).toBeInstanceOf(MissingVariableError);
        const err = error as MissingVariableError;
        
        // Verify error contains all required information
        expect(err.formula).toBe(formula);
        expect(err.missingVariable).toBe('duration');
        expect(err.providedVariables).toEqual(['token']);
        expect(err.code).toBe('MISSING_VARIABLE');
        expect(err.message).toContain('duration');
        expect(err.message).toContain('token');
      }
    });

    it('should detect missing variables even when some are provided', () => {
      const parser = new FormulaParser();
      
      expect(() => {
        parser.evaluate('{a} + {b} + {c}', { a: 1, c: 3 });
      }).toThrow(MissingVariableError);
    });
  });

  describe('Requirement 5.2: Division by zero error handling', () => {
    it('should throw FormulaEvaluationError for division by zero', () => {
      const parser = new FormulaParser();
      
      expect(() => {
        parser.evaluate('{amount} / {count}', { amount: 100, count: 0 });
      }).toThrow(FormulaEvaluationError);
    });

    it('should include formula and variables in division by zero error', () => {
      const parser = new FormulaParser();
      const formula = '{amount} / {count}';
      const variables = { amount: 100, count: 0 };
      
      try {
        parser.evaluate(formula, variables);
        expect.fail('Should have thrown FormulaEvaluationError');
      } catch (error) {
        expect(error).toBeInstanceOf(FormulaEvaluationError);
        const err = error as FormulaEvaluationError;
        
        expect(err.formula).toBe(formula);
        expect(err.variables).toEqual(variables);
        expect(err.code).toBe('FORMULA_EVALUATION_ERROR');
        expect(err.message).toContain('Infinity');
      }
    });

    it('should detect division by zero in complex expressions', () => {
      const parser = new FormulaParser();
      
      expect(() => {
        parser.evaluate('({a} + {b}) / ({c} - {d})', { a: 10, b: 5, c: 3, d: 3 });
      }).toThrow(FormulaEvaluationError);
    });
  });

  describe('Requirement 5.3: Other calculation error handling', () => {
    it('should throw FormulaEvaluationError for NaN results', () => {
      const parser = new FormulaParser();
      
      expect(() => {
        parser.evaluate('{value} * 0.5', { value: NaN });
      }).toThrow(FormulaEvaluationError);
    });

    it('should throw FormulaEvaluationError for invalid variable values', () => {
      const parser = new FormulaParser();
      
      // NaN value
      expect(() => {
        parser.evaluate('{token} * 0.5', { token: NaN });
      }).toThrow(FormulaEvaluationError);
    });

    it('should include error cause in FormulaEvaluationError', () => {
      const parser = new FormulaParser();
      const formula = '{value} * 0.5';
      const variables = { value: NaN };
      
      try {
        parser.evaluate(formula, variables);
        expect.fail('Should have thrown FormulaEvaluationError');
      } catch (error) {
        expect(error).toBeInstanceOf(FormulaEvaluationError);
        const err = error as FormulaEvaluationError;
        
        expect(err.formula).toBe(formula);
        expect(err.variables).toEqual(variables);
        expect(err.cause).toBeTruthy();
        expect(err.code).toBe('FORMULA_EVALUATION_ERROR');
      }
    });
  });

  describe('Edge cases and robustness', () => {
    it('should handle zero values correctly (not as division by zero)', () => {
      const parser = new FormulaParser();
      
      // Zero as a value is valid
      expect(parser.evaluate('{token} * 0.5', { token: 0 })).toBe(0);
      expect(parser.evaluate('{token} + 10', { token: 0 })).toBe(10);
      
      // Only division BY zero should throw
      expect(() => {
        parser.evaluate('{zero} / {value}', { zero: 0, value: 10 });
      }).not.toThrow();
      expect(parser.evaluate('{zero} / {value}', { zero: 0, value: 10 })).toBe(0);
    });

    it('should handle negative results correctly', () => {
      const parser = new FormulaParser();
      
      expect(parser.evaluate('{a} - {b}', { a: 5, b: 10 })).toBe(-5);
      expect(parser.evaluate('{value} * -1', { value: 10 })).toBe(-10);
    });

    it('should handle very large numbers', () => {
      const parser = new FormulaParser();
      
      const result = parser.evaluate('{a} * {b}', { a: 1000000, b: 1000 });
      expect(result).toBe(1000000000);
    });

    it('should handle very small decimal numbers', () => {
      const parser = new FormulaParser();
      
      const result = parser.evaluate('{token} * 0.0001', { token: 5000 });
      expect(result).toBe(0.5);
    });

    it('should handle formulas with repeated variable usage', () => {
      const parser = new FormulaParser();
      
      expect(parser.evaluate('{x} + {x} + {x}', { x: 5 })).toBe(15);
      expect(parser.evaluate('{x} * {x}', { x: 4 })).toBe(16);
    });
  });

  describe('Integration with parse() method', () => {
    it('should work correctly when using parse() then compute()', () => {
      const parser = new FormulaParser();
      const parsed = parser.parse('{token} * 0.001 + 10');
      
      // Should produce same results as evaluate()
      expect(parsed.compute({ token: 3500 })).toBe(13.5);
      expect(parser.evaluate('{token} * 0.001 + 10', { token: 3500 })).toBe(13.5);
    });

    it('should throw same errors whether using evaluate() or parse().compute()', () => {
      const parser = new FormulaParser();
      const formula = '{token} * 0.5';
      const parsed = parser.parse(formula);
      
      // Both should throw MissingVariableError
      expect(() => parser.evaluate(formula, {})).toThrow(MissingVariableError);
      expect(() => parsed.compute({})).toThrow(MissingVariableError);
    });
  });
});

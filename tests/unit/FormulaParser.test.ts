/**
 * FormulaParser 单元测试
 * 测试公式解析、验证和计算的各种场景
 */

import { describe, it, expect } from 'vitest';
import { FormulaParser } from '../../src/features/FormulaParser';
import { ConfigurationError, MissingVariableError, FormulaEvaluationError } from '../../src/core/errors';

describe('FormulaParser', () => {
  describe('validate', () => {
    it('should accept valid formulas with basic operators', () => {
      const parser = new FormulaParser();
      
      expect(() => parser.validate('{token} * 0.5')).not.toThrow();
      expect(() => parser.validate('{token} + 10')).not.toThrow();
      expect(() => parser.validate('{token} - 5')).not.toThrow();
      expect(() => parser.validate('{token} / 2')).not.toThrow();
      expect(() => parser.validate('{token} * 0.001 + 10')).not.toThrow();
    });

    it('should accept formulas with parentheses', () => {
      const parser = new FormulaParser();
      
      expect(() => parser.validate('({token} + 10) * 2')).not.toThrow();
      expect(() => parser.validate('{token} * (0.5 + 0.3)')).not.toThrow();
      expect(() => parser.validate('((({token} + 1) * 2) - 3)')).not.toThrow();
    });

    it('should accept formulas with multiple variables', () => {
      const parser = new FormulaParser();
      
      expect(() => parser.validate('{token} * 0.5 + {duration}')).not.toThrow();
      expect(() => parser.validate('{width} * {height} * 0.001')).not.toThrow();
      expect(() => parser.validate('{a} + {b} - {c} * {d}')).not.toThrow();
    });

    it('should accept formulas with valid variable names', () => {
      const parser = new FormulaParser();
      
      expect(() => parser.validate('{token}')).not.toThrow();
      expect(() => parser.validate('{token_count}')).not.toThrow();
      expect(() => parser.validate('{token123}')).not.toThrow();
      expect(() => parser.validate('{tokenCount}')).not.toThrow();
      expect(() => parser.validate('{TOKEN}')).not.toThrow();
      expect(() => parser.validate('{t}')).not.toThrow(); // single letter
    });

    it('should accept formulas with ternary operators', () => {
      const parser = new FormulaParser();
      
      expect(() => parser.validate('{rows} < 1000 ? {rows} * 0.1 : 100')).not.toThrow();
      expect(() => parser.validate('{token} > 5000 ? 50 : {token} * 0.01')).not.toThrow();
    });

    it('should reject empty formulas', () => {
      const parser = new FormulaParser();
      
      expect(() => parser.validate('')).toThrow(ConfigurationError);
      expect(() => parser.validate('   ')).toThrow(ConfigurationError);
    });

    it('should reject formulas with mismatched parentheses', () => {
      const parser = new FormulaParser();
      
      expect(() => parser.validate('{token} * (0.5 + 0.3')).toThrow(ConfigurationError);
      expect(() => parser.validate('{token} * 0.5 + 0.3)')).toThrow(ConfigurationError);
      expect(() => parser.validate('({token} * 0.5')).toThrow(ConfigurationError);
      expect(() => parser.validate('{token}) * 0.5')).toThrow(ConfigurationError);
    });

    it('should reject formulas with mismatched braces', () => {
      const parser = new FormulaParser();
      
      expect(() => parser.validate('{token * 0.5')).toThrow(ConfigurationError);
      expect(() => parser.validate('token} * 0.5')).toThrow(ConfigurationError);
      expect(() => parser.validate('{{token} * 0.5')).toThrow(ConfigurationError);
    });

    it('should reject formulas with invalid variable names', () => {
      const parser = new FormulaParser();
      
      // Variable names starting with numbers
      expect(() => parser.validate('{123token} * 0.5')).toThrow(ConfigurationError);
      
      // Variable names starting with underscore
      expect(() => parser.validate('{_token} * 0.5')).toThrow(ConfigurationError);
      
      // Variable names with hyphens
      expect(() => parser.validate('{token-count} * 0.5')).toThrow(ConfigurationError);
      
      // Variable names with special characters
      expect(() => parser.validate('{token@count} * 0.5')).toThrow(ConfigurationError);
      expect(() => parser.validate('{token$} * 0.5')).toThrow(ConfigurationError);
      
      // Empty variable names
      expect(() => parser.validate('{} * 0.5')).toThrow(ConfigurationError);
      expect(() => parser.validate('{   } * 0.5')).toThrow(ConfigurationError);
    });

    it('should reject formulas with invalid syntax', () => {
      const parser = new FormulaParser();
      
      expect(() => parser.validate('{token} * * 0.5')).toThrow(ConfigurationError);
      expect(() => parser.validate('{token} 0.5')).toThrow(ConfigurationError); // missing operator
    });
  });

  describe('extractVariables', () => {
    it('should extract single variable', () => {
      const parser = new FormulaParser();
      
      expect(parser.extractVariables('{token}')).toEqual(['token']);
      expect(parser.extractVariables('{token} * 0.5')).toEqual(['token']);
      expect(parser.extractVariables('10 + {duration}')).toEqual(['duration']);
    });

    it('should extract multiple variables', () => {
      const parser = new FormulaParser();
      
      const vars1 = parser.extractVariables('{token} * 0.5 + {duration}');
      expect(vars1).toHaveLength(2);
      expect(vars1).toContain('token');
      expect(vars1).toContain('duration');
      
      const vars2 = parser.extractVariables('{width} * {height} * {depth}');
      expect(vars2).toHaveLength(3);
      expect(vars2).toContain('width');
      expect(vars2).toContain('height');
      expect(vars2).toContain('depth');
    });

    it('should deduplicate repeated variables', () => {
      const parser = new FormulaParser();
      
      expect(parser.extractVariables('{token} + {token} * 2')).toEqual(['token']);
      expect(parser.extractVariables('{a} + {b} + {a} + {b}')).toHaveLength(2);
    });

    it('should return empty array for formulas without variables', () => {
      const parser = new FormulaParser();
      
      expect(parser.extractVariables('100')).toEqual([]);
      expect(parser.extractVariables('10 + 20 * 30')).toEqual([]);
      expect(parser.extractVariables('(5 + 3) * 2')).toEqual([]);
    });

    it('should handle complex formulas', () => {
      const parser = new FormulaParser();
      
      const vars = parser.extractVariables(
        '({token} * 0.001 + {duration} * 0.5) * {multiplier}'
      );
      expect(vars).toHaveLength(3);
      expect(vars).toContain('token');
      expect(vars).toContain('duration');
      expect(vars).toContain('multiplier');
    });
  });

  describe('parse', () => {
    it('should parse valid formula and return ParsedFormula object', () => {
      const parser = new FormulaParser();
      
      const parsed = parser.parse('{token} * 0.5');
      
      expect(parsed.raw).toBe('{token} * 0.5');
      expect(parsed.variables).toEqual(['token']);
      expect(typeof parsed.compute).toBe('function');
    });

    it('should parse formula with multiple variables', () => {
      const parser = new FormulaParser();
      
      const parsed = parser.parse('{token} * 0.001 + {duration} * 0.5');
      
      expect(parsed.raw).toBe('{token} * 0.001 + {duration} * 0.5');
      expect(parsed.variables).toHaveLength(2);
      expect(parsed.variables).toContain('token');
      expect(parsed.variables).toContain('duration');
    });

    it('should throw ConfigurationError for invalid formula', () => {
      const parser = new FormulaParser();
      
      expect(() => parser.parse('{token * 0.5')).toThrow(ConfigurationError);
      expect(() => parser.parse('{token-count} * 0.5')).toThrow(ConfigurationError);
    });
  });

  describe('evaluate', () => {
    it('should calculate simple formulas correctly', () => {
      const parser = new FormulaParser();
      
      expect(parser.evaluate('{token} * 0.5', { token: 100 })).toBe(50);
      expect(parser.evaluate('{token} + 10', { token: 5 })).toBe(15);
      expect(parser.evaluate('{token} - 5', { token: 20 })).toBe(15);
      expect(parser.evaluate('{token} / 2', { token: 100 })).toBe(50);
    });

    it('should calculate formulas with multiple variables', () => {
      const parser = new FormulaParser();
      
      expect(parser.evaluate('{token} * 0.001 + {duration}', {
        token: 3500,
        duration: 10
      })).toBe(13.5);
      
      expect(parser.evaluate('{width} * {height}', {
        width: 1920,
        height: 1080
      })).toBe(2073600);
    });

    it('should calculate formulas with parentheses', () => {
      const parser = new FormulaParser();
      
      expect(parser.evaluate('({token} + 10) * 2', { token: 5 })).toBe(30);
      expect(parser.evaluate('{token} * (0.5 + 0.3)', { token: 100 })).toBe(80);
    });

    it('should calculate formulas with decimal numbers', () => {
      const parser = new FormulaParser();
      
      expect(parser.evaluate('{token} * 0.001', { token: 3500 })).toBe(3.5);
      expect(parser.evaluate('{value} * 1.5', { value: 10 })).toBeCloseTo(15, 10);
    });

    it('should handle ternary operators', () => {
      const parser = new FormulaParser();
      
      expect(parser.evaluate('{rows} < 1000 ? {rows} * 0.1 : 100', { rows: 500 })).toBe(50);
      expect(parser.evaluate('{rows} < 1000 ? {rows} * 0.1 : 100', { rows: 2000 })).toBe(100);
    });

    it('should throw MissingVariableError when variable is missing', () => {
      const parser = new FormulaParser();
      
      expect(() => {
        parser.evaluate('{token} * 0.5', {});
      }).toThrow(MissingVariableError);
      
      expect(() => {
        parser.evaluate('{token} + {duration}', { token: 100 });
      }).toThrow(MissingVariableError);
    });

    it('should throw MissingVariableError with correct details', () => {
      const parser = new FormulaParser();
      
      try {
        parser.evaluate('{token} * 0.5', { duration: 10 });
        expect.fail('Should have thrown MissingVariableError');
      } catch (error) {
        expect(error).toBeInstanceOf(MissingVariableError);
        const err = error as MissingVariableError;
        expect(err.formula).toBe('{token} * 0.5');
        expect(err.missingVariable).toBe('token');
        expect(err.providedVariables).toEqual(['duration']);
        expect(err.code).toBe('MISSING_VARIABLE');
      }
    });

    it('should throw FormulaEvaluationError for division by zero', () => {
      const parser = new FormulaParser();
      
      expect(() => {
        parser.evaluate('{amount} / {count}', { amount: 100, count: 0 });
      }).toThrow(FormulaEvaluationError);
    });

    it('should throw FormulaEvaluationError for invalid variable values', () => {
      const parser = new FormulaParser();
      
      expect(() => {
        parser.evaluate('{token} * 0.5', { token: NaN });
      }).toThrow(FormulaEvaluationError);
    });

    it('should handle zero values correctly', () => {
      const parser = new FormulaParser();
      
      expect(parser.evaluate('{token} * 0.5', { token: 0 })).toBe(0);
      expect(parser.evaluate('{token} + 10', { token: 0 })).toBe(10);
    });

    it('should handle negative values correctly', () => {
      const parser = new FormulaParser();
      
      expect(parser.evaluate('{token} * 0.5', { token: -100 })).toBe(-50);
      expect(parser.evaluate('{token} + 10', { token: -5 })).toBe(5);
    });

    it('should handle large numbers correctly', () => {
      const parser = new FormulaParser();
      
      expect(parser.evaluate('{token} * 0.001', { token: 1000000 })).toBe(1000);
      expect(parser.evaluate('{a} + {b}', { a: 999999, b: 1 })).toBe(1000000);
    });
  });

  describe('compute function from parse', () => {
    it('should compute correctly using parsed formula', () => {
      const parser = new FormulaParser();
      const parsed = parser.parse('{token} * 0.001 + 10');
      
      expect(parsed.compute({ token: 3500 })).toBe(13.5);
      expect(parsed.compute({ token: 1000 })).toBe(11);
      expect(parsed.compute({ token: 0 })).toBe(10);
    });

    it('should throw MissingVariableError when using compute with missing variables', () => {
      const parser = new FormulaParser();
      const parsed = parser.parse('{token} * 0.5');
      
      expect(() => {
        parsed.compute({});
      }).toThrow(MissingVariableError);
    });

    it('should be reusable for multiple calculations', () => {
      const parser = new FormulaParser();
      const parsed = parser.parse('{width} * {height} * 0.001');
      
      expect(parsed.compute({ width: 1920, height: 1080 })).toBe(2073.6);
      expect(parsed.compute({ width: 1280, height: 720 })).toBe(921.6);
      expect(parsed.compute({ width: 640, height: 480 })).toBe(307.2);
    });
  });

  describe('edge cases', () => {
    it('should handle formula with only a constant', () => {
      const parser = new FormulaParser();
      
      expect(parser.evaluate('100', {})).toBe(100);
      expect(parser.evaluate('3.14', {})).toBe(3.14);
    });

    it('should handle formula with same variable multiple times', () => {
      const parser = new FormulaParser();
      
      expect(parser.evaluate('{x} + {x} + {x}', { x: 5 })).toBe(15);
      expect(parser.evaluate('{x} * {x}', { x: 4 })).toBe(16);
    });

    it('should handle complex nested expressions', () => {
      const parser = new FormulaParser();
      
      const result = parser.evaluate(
        '(({token} * 0.001) + ({duration} * 0.5)) * {multiplier}',
        { token: 1000, duration: 10, multiplier: 2 }
      );
      expect(result).toBe(12);
    });
  });
});

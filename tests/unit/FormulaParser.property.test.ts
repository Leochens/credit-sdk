/**
 * FormulaParser 属性测试
 * 使用 fast-check 进行基于属性的测试
 * 
 * Feature: dynamic-cost-formula
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { FormulaParser } from '../../src/features/FormulaParser';
import { MissingVariableError, FormulaEvaluationError } from '../../src/core/errors';

describe('FormulaParser - Property-Based Tests', () => {
  /**
   * Property 1: 公式解析正确性
   * 
   * **Validates: Requirements 1.2, 1.3, 1.4, 3.4**
   * 
   * For any valid formula with variables and any valid variable values,
   * the parser should correctly evaluate the formula and produce the same
   * result as manual calculation.
   * 
   * This property tests:
   * - Variable placeholder support ({variableName}) - Requirement 1.2
   * - Basic math operators (+, -, *, /) - Requirement 1.3
   * - Parentheses for operation precedence - Requirement 1.4
   * - Number constants (integers and decimals) - Requirement 3.4
   */
  describe('Property 1: 公式解析正确性', () => {
    it('should correctly evaluate single variable formulas with multiplication', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100000 }),
          fc.double({ min: 0.0001, max: 10, noNaN: true }),
          (variableValue, multiplier) => {
            const formula = `{token} * ${multiplier}`;
            const parser = new FormulaParser();
            
            const result = parser.evaluate(formula, { token: variableValue });
            const expected = variableValue * multiplier;
            
            // Use toBeCloseTo for floating point comparison
            expect(result).toBeCloseTo(expected, 10);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly evaluate single variable formulas with addition', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100000 }),
          fc.double({ min: 0, max: 1000, noNaN: true }),
          (variableValue, constant) => {
            const formula = `{token} + ${constant}`;
            const parser = new FormulaParser();
            
            const result = parser.evaluate(formula, { token: variableValue });
            const expected = variableValue + constant;
            
            expect(result).toBeCloseTo(expected, 10);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly evaluate formulas with multiple operations', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100000 }),
          fc.double({ min: 0.0001, max: 1, noNaN: true }),
          fc.double({ min: 0, max: 100, noNaN: true }),
          (token, multiplier, constant) => {
            const formula = `{token} * ${multiplier} + ${constant}`;
            const parser = new FormulaParser();
            
            const result = parser.evaluate(formula, { token });
            const expected = token * multiplier + constant;
            
            expect(result).toBeCloseTo(expected, 10);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly evaluate formulas with two variables', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100000 }),
          fc.integer({ min: 0, max: 3600 }),
          fc.double({ min: 0.0001, max: 1, noNaN: true }),
          fc.double({ min: 0.0001, max: 1, noNaN: true }),
          (token, duration, tokenRate, durationRate) => {
            const formula = `{token} * ${tokenRate} + {duration} * ${durationRate}`;
            const parser = new FormulaParser();
            
            const result = parser.evaluate(formula, { token, duration });
            const expected = token * tokenRate + duration * durationRate;
            
            expect(result).toBeCloseTo(expected, 10);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly evaluate formulas with parentheses', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }),
          fc.double({ min: 0, max: 100, noNaN: true }),
          fc.double({ min: 1, max: 5, noNaN: true }),
          (token, constant, multiplier) => {
            const formula = `({token} + ${constant}) * ${multiplier}`;
            const parser = new FormulaParser();
            
            const result = parser.evaluate(formula, { token });
            const expected = (token + constant) * multiplier;
            
            expect(result).toBeCloseTo(expected, 10);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly evaluate formulas with subtraction', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 100000 }),
          fc.double({ min: 0, max: 100, noNaN: true }),
          (token, constant) => {
            const formula = `{token} - ${constant}`;
            const parser = new FormulaParser();
            
            const result = parser.evaluate(formula, { token });
            const expected = token - constant;
            
            expect(result).toBeCloseTo(expected, 10);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly evaluate formulas with division', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100000 }),
          fc.double({ min: 1, max: 100, noNaN: true }), // Avoid division by zero
          (token, divisor) => {
            const formula = `{token} / ${divisor}`;
            const parser = new FormulaParser();
            
            const result = parser.evaluate(formula, { token });
            const expected = token / divisor;
            
            expect(result).toBeCloseTo(expected, 10);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly evaluate complex formulas with multiple variables and operations', () => {
      fc.assert(
        fc.property(
          fc.record({
            token: fc.integer({ min: 0, max: 100000 }),
            duration: fc.integer({ min: 0, max: 3600 }),
            multiplier: fc.double({ min: 0.5, max: 2, noNaN: true })
          }),
          (variables) => {
            const formula = '({token} * 0.001 + {duration} * 0.5) * {multiplier}';
            const parser = new FormulaParser();
            
            const result = parser.evaluate(formula, variables);
            const expected = (variables.token * 0.001 + variables.duration * 0.5) * variables.multiplier;
            
            expect(result).toBeCloseTo(expected, 10);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly extract all variables from formulas', () => {
      fc.assert(
        fc.property(
          fc.record({
            var1: fc.integer({ min: 0, max: 1000 }),
            var2: fc.integer({ min: 0, max: 1000 }),
            var3: fc.integer({ min: 0, max: 1000 })
          }),
          (variables) => {
            const formula = '{var1} + {var2} * {var3}';
            const parser = new FormulaParser();
            
            const extractedVars = parser.extractVariables(formula);
            
            // Should extract all three variables
            expect(extractedVars).toHaveLength(3);
            expect(extractedVars).toContain('var1');
            expect(extractedVars).toContain('var2');
            expect(extractedVars).toContain('var3');
            
            // Should be able to evaluate with these variables
            const result = parser.evaluate(formula, variables);
            const expected = variables.var1 + variables.var2 * variables.var3;
            expect(result).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle formulas with repeated variables correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000 }),
          (value) => {
            const formula = '{x} + {x} * 2 + {x} / 2';
            const parser = new FormulaParser();
            
            // Should extract only one unique variable
            const extractedVars = parser.extractVariables(formula);
            expect(extractedVars).toEqual(['x']);
            
            // Should evaluate correctly
            const result = parser.evaluate(formula, { x: value });
            const expected = value + value * 2 + value / 2;
            expect(result).toBeCloseTo(expected, 10);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle formulas with decimal constants correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100000 }),
          (token) => {
            const formula = '{token} * 0.001 + 10.5';
            const parser = new FormulaParser();
            
            const result = parser.evaluate(formula, { token });
            const expected = token * 0.001 + 10.5;
            
            expect(result).toBeCloseTo(expected, 10);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle zero values correctly', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 100, noNaN: true }),
          (constant) => {
            const formula = `{token} + ${constant}`;
            const parser = new FormulaParser();
            
            const result = parser.evaluate(formula, { token: 0 });
            const expected = 0 + constant;
            
            expect(result).toBeCloseTo(expected, 10);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle negative results correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 101, max: 1000 }),
          (smallValue, largeValue) => {
            const formula = `{value} - ${largeValue}`;
            const parser = new FormulaParser();
            
            const result = parser.evaluate(formula, { value: smallValue });
            const expected = smallValue - largeValue;
            
            expect(result).toBeCloseTo(expected, 10);
            expect(result).toBeLessThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly evaluate formulas with order of operations', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          (a, b, c) => {
            // Test that multiplication happens before addition
            const formula = '{a} + {b} * {c}';
            const parser = new FormulaParser();
            
            const result = parser.evaluate(formula, { a, b, c });
            const expected = a + b * c; // b * c should be evaluated first
            
            expect(result).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly evaluate formulas with nested parentheses', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          (a, b, c) => {
            const formula = '(({a} + {b}) * {c})';
            const parser = new FormulaParser();
            
            const result = parser.evaluate(formula, { a, b, c });
            const expected = ((a + b) * c);
            
            expect(result).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property tests for error handling
   * These ensure the parser correctly handles edge cases and errors
   */
  describe('Error Handling Properties', () => {
    it('should throw MissingVariableError when required variables are not provided', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100000 }),
          (value) => {
            const formula = '{token} + {duration}';
            const parser = new FormulaParser();
            
            // Only provide one of the two required variables
            expect(() => {
              parser.evaluate(formula, { token: value });
            }).toThrow(MissingVariableError);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should throw FormulaEvaluationError for division by zero', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100000 }),
          (numerator) => {
            const formula = '{numerator} / {denominator}';
            const parser = new FormulaParser();
            
            expect(() => {
              parser.evaluate(formula, { numerator, denominator: 0 });
            }).toThrow(FormulaEvaluationError);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should throw FormulaEvaluationError for NaN variable values', () => {
      fc.assert(
        fc.property(
          fc.constant(NaN),
          (nanValue) => {
            const formula = '{value} * 2';
            const parser = new FormulaParser();
            
            expect(() => {
              parser.evaluate(formula, { value: nanValue });
            }).toThrow(FormulaEvaluationError);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property tests for parse and compute functions
   * These ensure the parsed formula can be reused correctly
   */
  describe('Parse and Compute Properties', () => {
    it('should produce reusable compute functions that give consistent results', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 10000 }), { minLength: 3, maxLength: 10 }),
          (tokenValues) => {
            const formula = '{token} * 0.001 + 10';
            const parser = new FormulaParser();
            const parsed = parser.parse(formula);
            
            // Compute multiple times with different values
            for (const token of tokenValues) {
              const result = parsed.compute({ token });
              const expected = token * 0.001 + 10;
              expect(result).toBeCloseTo(expected, 10);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should extract correct variables from parsed formulas', () => {
      fc.assert(
        fc.property(
          fc.record({
            a: fc.integer({ min: 0, max: 1000 }),
            b: fc.integer({ min: 0, max: 1000 })
          }),
          (variables) => {
            const formula = '{a} * 2 + {b} * 3';
            const parser = new FormulaParser();
            const parsed = parser.parse(formula);
            
            // Check extracted variables
            expect(parsed.variables).toHaveLength(2);
            expect(parsed.variables).toContain('a');
            expect(parsed.variables).toContain('b');
            
            // Check computation
            const result = parsed.compute(variables);
            const expected = variables.a * 2 + variables.b * 3;
            expect(result).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

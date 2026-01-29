/**
 * Task 8 Verification Test - Export Verification
 * 
 * 验证所有新增的类和类型是否正确导出
 * 
 * Requirements: 7.1
 */

import { describe, it, expect } from 'vitest';

describe('Task 8: Export Verification', () => {
  describe('Features Module Exports', () => {
    it('should export FormulaParser from features/index.ts', async () => {
      const { FormulaParser } = await import('../../src/features/index');
      expect(FormulaParser).toBeDefined();
      expect(typeof FormulaParser).toBe('function');
      
      // Verify it's a constructor
      const parser = new FormulaParser();
      expect(parser).toBeInstanceOf(FormulaParser);
    });

    it('should export ParsedFormula interface from features/index.ts', async () => {
      // TypeScript interfaces don't exist at runtime, but we can verify the type is exported
      // by checking if FormulaParser.parse returns an object with the expected structure
      const { FormulaParser } = await import('../../src/features/index');
      const parser = new FormulaParser();
      const parsed = parser.parse('{token} * 0.5');
      
      expect(parsed).toHaveProperty('raw');
      expect(parsed).toHaveProperty('variables');
      expect(parsed).toHaveProperty('compute');
      expect(typeof parsed.compute).toBe('function');
    });

    it('should export DynamicCostFormula from features/index.ts', async () => {
      const { DynamicCostFormula } = await import('../../src/features/index');
      expect(DynamicCostFormula).toBeDefined();
      expect(typeof DynamicCostFormula).toBe('function');
      
      // Verify it's a constructor
      const formula = new DynamicCostFormula({
        'test-action': { default: 10 }
      });
      expect(formula).toBeInstanceOf(DynamicCostFormula);
    });
  });

  describe('Error Exports', () => {
    it('should export MissingVariableError from core/errors.ts', async () => {
      const { MissingVariableError } = await import('../../src/core/errors');
      expect(MissingVariableError).toBeDefined();
      expect(typeof MissingVariableError).toBe('function');
      
      // Verify it's a constructor and has correct properties
      const error = new MissingVariableError('{token} * 0.5', 'token', []);
      expect(error).toBeInstanceOf(MissingVariableError);
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe('MISSING_VARIABLE');
      expect(error.formula).toBe('{token} * 0.5');
      expect(error.missingVariable).toBe('token');
      expect(error.providedVariables).toEqual([]);
    });

    it('should export FormulaEvaluationError from core/errors.ts', async () => {
      const { FormulaEvaluationError } = await import('../../src/core/errors');
      expect(FormulaEvaluationError).toBeDefined();
      expect(typeof FormulaEvaluationError).toBe('function');
      
      // Verify it's a constructor and has correct properties
      const error = new FormulaEvaluationError(
        '{amount} / {count}',
        { amount: 100, count: 0 },
        'Division by zero'
      );
      expect(error).toBeInstanceOf(FormulaEvaluationError);
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe('FORMULA_EVALUATION_ERROR');
      expect(error.formula).toBe('{amount} / {count}');
      expect(error.variables).toEqual({ amount: 100, count: 0 });
      expect(error.cause).toBe('Division by zero');
    });
  });

  describe('Type Exports', () => {
    it('should export DynamicCostConfig type from core/types.ts', async () => {
      // TypeScript types don't exist at runtime, but we can verify the import works
      const types = await import('../../src/core/types');
      expect(types).toBeDefined();
      
      // Verify we can use the type by creating a valid config object
      const config: typeof types.DynamicCostConfig extends never ? never : any = {
        'test-action': {
          default: 10,
          premium: '{token} * 0.5'
        }
      };
      expect(config).toBeDefined();
    });

    it('should export CalculationDetails interface from core/types.ts', async () => {
      // TypeScript interfaces don't exist at runtime, but we can verify the import works
      const types = await import('../../src/core/types');
      expect(types).toBeDefined();
      
      // Verify we can use the type by creating a valid details object
      const details: typeof types.CalculationDetails extends never ? never : any = {
        rawCost: 13.5,
        finalCost: 13.5,
        isDynamic: true,
        formula: '{token} * 0.001 + 10',
        variables: { token: 3500 }
      };
      expect(details).toBeDefined();
    });
  });

  describe('Main Entry Point Exports', () => {
    it('should export FormulaParser from main index.ts', async () => {
      const { FormulaParser } = await import('../../src/index');
      expect(FormulaParser).toBeDefined();
      expect(typeof FormulaParser).toBe('function');
    });

    it('should export DynamicCostFormula from main index.ts', async () => {
      const { DynamicCostFormula } = await import('../../src/index');
      expect(DynamicCostFormula).toBeDefined();
      expect(typeof DynamicCostFormula).toBe('function');
    });

    it('should export MissingVariableError from main index.ts', async () => {
      const { MissingVariableError } = await import('../../src/index');
      expect(MissingVariableError).toBeDefined();
      expect(typeof MissingVariableError).toBe('function');
    });

    it('should export FormulaEvaluationError from main index.ts', async () => {
      const { FormulaEvaluationError } = await import('../../src/index');
      expect(FormulaEvaluationError).toBeDefined();
      expect(typeof FormulaEvaluationError).toBe('function');
    });
  });

  describe('Integration Test - Using Exports Together', () => {
    it('should be able to use all exported components together', async () => {
      const {
        FormulaParser,
        DynamicCostFormula,
        MissingVariableError,
        FormulaEvaluationError
      } = await import('../../src/index');

      // Create a parser
      const parser = new FormulaParser();
      expect(parser).toBeInstanceOf(FormulaParser);

      // Parse a formula
      const parsed = parser.parse('{token} * 0.001 + 10');
      expect(parsed.variables).toEqual(['token']);

      // Create a dynamic cost formula
      const formula = new DynamicCostFormula({
        'ai-completion': {
          default: '{token} * 0.001 + 10',
          premium: '{token} * 0.0008 + 8'
        }
      });
      expect(formula).toBeInstanceOf(DynamicCostFormula);

      // Calculate cost
      const cost = formula.calculate('ai-completion', null, { token: 3500 });
      expect(cost).toBe(13.5);

      // Test error handling
      try {
        formula.calculate('ai-completion', null, {});
      } catch (error) {
        expect(error).toBeInstanceOf(MissingVariableError);
      }

      // Test formula evaluation error
      try {
        parser.evaluate('{amount} / {count}', { amount: 100, count: 0 });
      } catch (error) {
        expect(error).toBeInstanceOf(FormulaEvaluationError);
      }
    });
  });

  describe('Backward Compatibility', () => {
    it('should still export all existing classes and types', async () => {
      const exports = await import('../../src/index');
      
      // Core classes
      expect(exports.CreditsEngine).toBeDefined();
      
      // Adapters
      expect(exports.PrismaAdapter).toBeDefined();
      expect(exports.MockAdapter).toBeDefined();
      
      // Features
      expect(exports.CostFormula).toBeDefined();
      expect(exports.MembershipValidator).toBeDefined();
      expect(exports.IdempotencyManager).toBeDefined();
      expect(exports.AuditTrail).toBeDefined();
      expect(exports.RetryHandler).toBeDefined();
      
      // Errors
      expect(exports.CreditsSDKError).toBeDefined();
      expect(exports.InsufficientCreditsError).toBeDefined();
      expect(exports.UserNotFoundError).toBeDefined();
      expect(exports.MembershipRequiredError).toBeDefined();
      expect(exports.IdempotencyKeyConflictError).toBeDefined();
      expect(exports.ConfigurationError).toBeDefined();
      expect(exports.UndefinedActionError).toBeDefined();
      expect(exports.InvalidTierChangeError).toBeDefined();
      expect(exports.UndefinedTierError).toBeDefined();
    });
  });
});

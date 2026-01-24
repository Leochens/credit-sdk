/**
 * CreditsEngine 配置验证属性测试
 * 使用基于属性的测试验证配置验证逻辑
 * 
 * Feature: membership-tier-management
 * Property 8: 配置验证
 * 
 * **Validates: Requirements 3.2, 3.3, 3.4**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { CreditsEngine } from '../../src/core/CreditsEngine';
import { IStorageAdapter } from '../../src/adapters/IStorageAdapter';
import { ILogAdapter } from '../../src/adapters/ILogAdapter';
import { CreditsConfig } from '../../src/core/types';
import { ConfigurationError } from '../../src/core/errors';

// Mock Storage Adapter
class MockStorageAdapter implements IStorageAdapter {
  async getUserById(userId: string, txn?: any): Promise<any> {
    return null;
  }
  async updateUserCredits(userId: string, amount: number, txn?: any): Promise<any> {
    throw new Error('Not implemented');
  }
  async createTransaction(transaction: any, txn?: any): Promise<any> {
    throw new Error('Not implemented');
  }
  async createAuditLog(log: any, txn?: any): Promise<any> {
    throw new Error('Not implemented');
  }
  async getIdempotencyRecord(key: string, txn?: any): Promise<any> {
    return null;
  }
  async createIdempotencyRecord(record: any, txn?: any): Promise<any> {
    throw new Error('Not implemented');
  }
  async getTransactions(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
      action?: string;
    },
    txn?: any
  ): Promise<any[]> {
    return [];
  }
  async updateUserMembership(
    userId: string,
    membershipTier: string,
    credits: number,
    membershipExpiresAt?: Date | null,
    txn?: any
  ): Promise<any> {
    throw new Error('Not implemented');
  }
}

// Mock Logger
class MockLogger implements ILogAdapter {
  logs: Array<{ level: string; message: string; context?: any }> = [];

  debug(message: string, context?: any) {
    this.logs.push({ level: 'debug', message, context });
  }
  info(message: string, context?: any) {
    this.logs.push({ level: 'info', message, context });
  }
  warn(message: string, context?: any) {
    this.logs.push({ level: 'warn', message, context });
  }
  error(message: string, context?: any) {
    this.logs.push({ level: 'error', message, context });
  }
}

// Base valid configuration
const baseValidConfig: CreditsConfig = {
  costs: {
    'generate-post': {
      default: 10,
      premium: 8
    }
  },
  membership: {
    tiers: {
      free: 0,
      premium: 1
    },
    requirements: {
      'generate-post': null
    },
    creditsCaps: {
      free: 100,
      premium: 1000
    }
  },
  retry: {
    enabled: true,
    maxAttempts: 3,
    initialDelay: 100,
    maxDelay: 5000,
    backoffMultiplier: 2
  },
  idempotency: {
    enabled: true,
    ttl: 86400
  },
  audit: {
    enabled: true
  }
};

describe('CreditsEngine Configuration Validation - Property Tests', () => {
  let storage: IStorageAdapter;
  let logger: ILogAdapter;

  beforeEach(() => {
    storage = new MockStorageAdapter();
    logger = new MockLogger();
  });

  describe('Property 8: Configuration Validation', () => {
    /**
     * Property 8.1: Missing creditsCaps should always throw ConfigurationError
     * 
     * For any valid configuration, if creditsCaps is missing or not an object,
     * the system should throw a ConfigurationError.
     * 
     * **Validates: Requirement 3.2**
     */
    it('should throw ConfigurationError when creditsCaps is missing or invalid', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary tier configurations
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.integer({ min: 0, max: 10 })
          ).filter(dict => Object.keys(dict).length > 0),
          (tiers) => {
            // Test with missing creditsCaps
            const configWithoutCaps = {
              ...baseValidConfig,
              membership: {
                tiers,
                requirements: {},
                creditsCaps: undefined as any
              }
            };

            expect(() => {
              new CreditsEngine({ storage, config: configWithoutCaps });
            }).toThrow(ConfigurationError);

            expect(() => {
              new CreditsEngine({ storage, config: configWithoutCaps });
            }).toThrow('Membership configuration must include creditsCaps');

            // Test with null creditsCaps
            const configWithNullCaps = {
              ...baseValidConfig,
              membership: {
                tiers,
                requirements: {},
                creditsCaps: null as any
              }
            };

            expect(() => {
              new CreditsEngine({ storage, config: configWithNullCaps });
            }).toThrow(ConfigurationError);

            // Test with non-object creditsCaps
            const configWithInvalidCaps = {
              ...baseValidConfig,
              membership: {
                tiers,
                requirements: {},
                creditsCaps: 'invalid' as any
              }
            };

            expect(() => {
              new CreditsEngine({ storage, config: configWithInvalidCaps });
            }).toThrow(ConfigurationError);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 8.2: Missing credits cap for any tier should throw ConfigurationError
     * 
     * For any configuration where at least one tier is missing its credits cap,
     * the system should throw a ConfigurationError with a message indicating
     * which tier is missing.
     * 
     * **Validates: Requirement 3.2**
     */
    it('should throw ConfigurationError when any tier is missing its credits cap', () => {
      fc.assert(
        fc.property(
          // Generate a list of tier names (at least 2), filtering out special property names
          fc.array(
            fc.string({ minLength: 1, maxLength: 20 }),
            { minLength: 2, maxLength: 10 }
          )
            .map(arr => [...new Set(arr)])
            .filter(arr => {
              // Filter out special property names like __proto__, constructor, etc.
              const filtered = arr.filter(name => 
                name !== '__proto__' && 
                name !== 'constructor' && 
                name !== 'prototype' &&
                name !== 'toString' &&
                name !== 'valueOf'
              );
              return filtered.length >= 2;
            })
            .map(arr => arr.filter(name => 
              name !== '__proto__' && 
              name !== 'constructor' && 
              name !== 'prototype' &&
              name !== 'toString' &&
              name !== 'valueOf'
            )),
          (tierNames) => {
            // Create tiers object
            const tiers: Record<string, number> = {};
            tierNames.forEach((name, index) => {
              tiers[name] = index;
            });

            // Create creditsCaps missing at least one tier
            const creditsCaps: Record<string, number> = {};
            // Only add caps for all tiers except the last one
            for (let i = 0; i < tierNames.length - 1; i++) {
              creditsCaps[tierNames[i]] = (i + 1) * 100;
            }

            const invalidConfig = {
              ...baseValidConfig,
              membership: {
                tiers,
                requirements: {},
                creditsCaps
              }
            };

            expect(() => {
              new CreditsEngine({ storage, config: invalidConfig });
            }).toThrow(ConfigurationError);

            expect(() => {
              new CreditsEngine({ storage, config: invalidConfig });
            }).toThrow(`Missing credits cap for tier '${tierNames[tierNames.length - 1]}'`);
          }
        ),
        { numRuns: 100 }
      );
    });


    /**
     * Property 8.4: Non-numeric credits cap should throw ConfigurationError
     * 
     * For any configuration where at least one tier has a non-numeric credits cap,
     * the system should throw a ConfigurationError.
     * 
     * **Validates: Requirement 3.3, 3.4**
     */
    it('should throw ConfigurationError when any credits cap is not a number', () => {
      fc.assert(
        fc.property(
          // Generate tier names
          fc.array(
            fc.string({ minLength: 1, maxLength: 20 }),
            { minLength: 1, maxLength: 5 }
          ).map(arr => [...new Set(arr)]).filter(arr => arr.length >= 1),
          // Generate a non-numeric value
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.string(),
            fc.boolean(),
            fc.object()
          ),
          (tierNames, invalidValue) => {
            // Create tiers object
            const tiers: Record<string, number> = {};
            tierNames.forEach((name, index) => {
              tiers[name] = index;
            });

            // Create creditsCaps with one invalid value
            const creditsCaps: Record<string, any> = {};
            tierNames.forEach((name, index) => {
              // Make the first tier have the invalid value
              creditsCaps[name] = index === 0 ? invalidValue : (index + 1) * 100;
            });

            const invalidConfig = {
              ...baseValidConfig,
              membership: {
                tiers,
                requirements: {},
                creditsCaps
              }
            };

            expect(() => {
              new CreditsEngine({ storage, config: invalidConfig });
            }).toThrow(ConfigurationError);

            expect(() => {
              new CreditsEngine({ storage, config: invalidConfig });
            }).toThrow(`Credits cap for tier '${tierNames[0]}' must be a non-negative number`);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 8.5: Valid configuration with all tiers having non-negative caps should succeed
     * 
     * For any configuration where all tiers have valid non-negative numeric credits caps,
     * the CreditsEngine should initialize successfully.
     * 
     * **Validates: Requirement 3.2, 3.3, 3.4**
     */
    it('should successfully initialize when all tiers have valid non-negative credits caps', () => {
      fc.assert(
        fc.property(
          // Generate tier names
          fc.array(
            fc.string({ minLength: 1, maxLength: 20 }),
            { minLength: 1, maxLength: 5 }
          ).map(arr => [...new Set(arr)]).filter(arr => arr.length >= 1),
          // Generate non-negative caps
          fc.array(
            fc.integer({ min: 0, max: 100000 }),
            { minLength: 1, maxLength: 5 }
          ),
          (tierNames, caps) => {
            // Ensure we have the same number of caps as tiers
            const adjustedCaps = caps.slice(0, tierNames.length);
            while (adjustedCaps.length < tierNames.length) {
              adjustedCaps.push(100);
            }

            // Create tiers object
            const tiers: Record<string, number> = {};
            tierNames.forEach((name, index) => {
              tiers[name] = index;
            });

            // Create creditsCaps with all valid values
            const creditsCaps: Record<string, number> = {};
            tierNames.forEach((name, index) => {
              creditsCaps[name] = adjustedCaps[index];
            });

            const validConfig = {
              ...baseValidConfig,
              membership: {
                tiers,
                requirements: {},
                creditsCaps
              }
            };

            // Should not throw
            const engine = new CreditsEngine({ storage, config: validConfig });
            expect(engine).toBeInstanceOf(CreditsEngine);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 8.6: Zero credits cap should be valid
     * 
     * For any configuration where a tier has a credits cap of 0,
     * the system should accept it as valid (0 is non-negative).
     * 
     * **Validates: Requirement 3.3, 3.4**
     */
    it('should accept zero as a valid credits cap', () => {
      fc.assert(
        fc.property(
          // Generate tier names
          fc.array(
            fc.string({ minLength: 1, maxLength: 20 }),
            { minLength: 1, maxLength: 5 }
          ).map(arr => [...new Set(arr)]).filter(arr => arr.length >= 1),
          (tierNames) => {
            // Create tiers object
            const tiers: Record<string, number> = {};
            tierNames.forEach((name, index) => {
              tiers[name] = index;
            });

            // Create creditsCaps with all zeros
            const creditsCaps: Record<string, number> = {};
            tierNames.forEach((name) => {
              creditsCaps[name] = 0;
            });

            const validConfig = {
              ...baseValidConfig,
              membership: {
                tiers,
                requirements: {},
                creditsCaps
              }
            };

            // Should not throw
            const engine = new CreditsEngine({ storage, config: validConfig });
            expect(engine).toBeInstanceOf(CreditsEngine);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 8.7: Extra credits caps (not in tiers) should be allowed
     * 
     * For any configuration where creditsCaps contains entries for tiers
     * that don't exist in the tiers object, the system should still accept it
     * (extra caps are harmless).
     * 
     * **Validates: Requirement 3.2**
     */
    it('should allow extra credits caps that are not in tiers', () => {
      fc.assert(
        fc.property(
          // Generate tier names
          fc.array(
            fc.string({ minLength: 1, maxLength: 20 }),
            { minLength: 1, maxLength: 5 }
          ).map(arr => [...new Set(arr)]).filter(arr => arr.length >= 1),
          // Generate extra tier names
          fc.array(
            fc.string({ minLength: 1, maxLength: 20 }),
            { minLength: 1, maxLength: 3 }
          ).map(arr => [...new Set(arr)]),
          (tierNames, extraTierNames) => {
            // Create tiers object
            const tiers: Record<string, number> = {};
            tierNames.forEach((name, index) => {
              tiers[name] = index;
            });

            // Create creditsCaps with all required tiers plus extras
            const creditsCaps: Record<string, number> = {};
            tierNames.forEach((name, index) => {
              creditsCaps[name] = (index + 1) * 100;
            });
            extraTierNames.forEach((name, index) => {
              // Only add if not already in tiers
              if (!(name in tiers)) {
                creditsCaps[name] = (index + 1) * 50;
              }
            });

            const validConfig = {
              ...baseValidConfig,
              membership: {
                tiers,
                requirements: {},
                creditsCaps
              }
            };

            // Should not throw
            const engine = new CreditsEngine({ storage, config: validConfig });
            expect(engine).toBeInstanceOf(CreditsEngine);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

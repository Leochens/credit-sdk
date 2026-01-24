/**
 * CreditsEngine 单元测试
 * 测试 CreditsEngine 构造函数和配置验证
 * 
 * 验证需求: 17.1-17.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
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

// Valid configuration for testing
const validConfig: CreditsConfig = {
  costs: {
    'generate-post': {
      default: 10,
      premium: 8,
      enterprise: 5
    },
    'generate-image': {
      default: 20,
      premium: 15,
      enterprise: 10
    }
  },
  membership: {
    tiers: {
      free: 0,
      basic: 1,
      premium: 2,
      enterprise: 3
    },
    requirements: {
      'generate-post': null,
      'generate-image': 'premium'
    },
    creditsCaps: {
      free: 100,
      basic: 500,
      premium: 2000,
      enterprise: 10000
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

describe('CreditsEngine Constructor', () => {
  let storage: MockStorageAdapter;

  beforeEach(() => {
    storage = new MockStorageAdapter();
  });

  describe('Successful Initialization', () => {
    it('should initialize with valid storage and config', () => {
      const engine = new CreditsEngine({
        storage,
        config: validConfig
      });

      expect(engine).toBeInstanceOf(CreditsEngine);
    });

    it('should initialize with custom logger', () => {
      const logger = new MockLogger();
      
      const engine = new CreditsEngine({
        storage,
        config: validConfig,
        logger
      });

      expect(engine).toBeInstanceOf(CreditsEngine);
      
      // Verify logger was used
      expect(logger.logs.length).toBeGreaterThan(0);
      expect(logger.logs.some(log => log.message.includes('initialized'))).toBe(true);
    });

    it('should use default ConsoleLogger when no logger provided', () => {
      // Should not throw
      const engine = new CreditsEngine({
        storage,
        config: validConfig
      });

      expect(engine).toBeInstanceOf(CreditsEngine);
    });

    it('should log initialization of all feature modules', () => {
      const logger = new MockLogger();
      
      new CreditsEngine({
        storage,
        config: validConfig,
        logger
      });

      // Check that all feature modules were logged
      const messages = logger.logs.map(log => log.message);
      expect(messages.some(m => m.includes('CostFormula'))).toBe(true);
      expect(messages.some(m => m.includes('MembershipValidator'))).toBe(true);
      expect(messages.some(m => m.includes('IdempotencyManager'))).toBe(true);
      expect(messages.some(m => m.includes('AuditTrail'))).toBe(true);
      expect(messages.some(m => m.includes('RetryHandler'))).toBe(true);
      expect(messages.some(m => m.includes('CreditsEngine initialized successfully'))).toBe(true);
    });
  });

  describe('Configuration Validation - Required Parameters', () => {
    it('should throw ConfigurationError when storage is missing', () => {
      expect(() => {
        new CreditsEngine({
          storage: null as any,
          config: validConfig
        });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({
          storage: null as any,
          config: validConfig
        });
      }).toThrow('Storage adapter is required');
    });

    it('should throw ConfigurationError when config is missing', () => {
      expect(() => {
        new CreditsEngine({
          storage,
          config: null as any
        });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({
          storage,
          config: null as any
        });
      }).toThrow('Configuration is required');
    });
  });

  describe('Configuration Validation - Costs', () => {
    it('should throw ConfigurationError when costs is missing', () => {
      const invalidConfig = { ...validConfig, costs: undefined as any };
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow('Configuration must include costs object');
    });

    it('should throw ConfigurationError when action has no default cost', () => {
      const invalidConfig = {
        ...validConfig,
        costs: {
          'generate-post': {
            premium: 8
          } as any
        }
      };
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow("must have a default cost");
    });

    it('should throw ConfigurationError when default cost is negative', () => {
      const invalidConfig = {
        ...validConfig,
        costs: {
          'generate-post': {
            default: -10,
            premium: 8
          }
        }
      };
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow('default cost must be non-negative');
    });
  });

  describe('Configuration Validation - Membership', () => {
    it('should throw ConfigurationError when membership is missing', () => {
      const invalidConfig = { ...validConfig, membership: undefined as any };
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow('Configuration must include membership object');
    });

    it('should throw ConfigurationError when membership.tiers is missing', () => {
      const invalidConfig = {
        ...validConfig,
        membership: {
          ...validConfig.membership,
          tiers: undefined as any
        }
      };
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow('Membership configuration must include tiers');
    });

    it('should throw ConfigurationError when membership.requirements is missing', () => {
      const invalidConfig = {
        ...validConfig,
        membership: {
          ...validConfig.membership,
          requirements: undefined as any
        }
      };
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow('Membership configuration must include requirements');
    });

    it('should throw ConfigurationError when tier level is not numeric', () => {
      const invalidConfig = {
        ...validConfig,
        membership: {
          ...validConfig.membership,
          tiers: {
            free: 'zero' as any
          }
        }
      };
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow('must have a numeric level');
    });

    it('should throw ConfigurationError when tier level is negative', () => {
      const invalidConfig = {
        ...validConfig,
        membership: {
          ...validConfig.membership,
          tiers: {
            free: -1
          }
        }
      };
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow('level must be non-negative');
    });
  });

  describe('Configuration Validation - Credits Caps', () => {
    it('should throw ConfigurationError when creditsCaps is missing', () => {
      const invalidConfig = {
        ...validConfig,
        membership: {
          ...validConfig.membership,
          creditsCaps: undefined as any
        }
      };
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow('Membership configuration must include creditsCaps');
    });

    it('should throw ConfigurationError when a tier is missing its credits cap', () => {
      const invalidConfig = {
        ...validConfig,
        membership: {
          ...validConfig.membership,
          creditsCaps: {
            free: 100,
            basic: 500,
            premium: 2000
            // enterprise is missing
          }
        }
      };
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow("Missing credits cap for tier 'enterprise'");
    });

    it('should throw ConfigurationError when credits cap is not a number', () => {
      const invalidConfig = {
        ...validConfig,
        membership: {
          ...validConfig.membership,
          creditsCaps: {
            free: 100,
            basic: 500,
            premium: '2000' as any,
            enterprise: 10000
          }
        }
      };
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow("Credits cap for tier 'premium' must be a non-negative number");
    });

    it('should throw ConfigurationError when credits cap is negative', () => {
      const invalidConfig = {
        ...validConfig,
        membership: {
          ...validConfig.membership,
          creditsCaps: {
            free: 100,
            basic: -500,
            premium: 2000,
            enterprise: 10000
          }
        }
      };
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow("Credits cap for tier 'basic' must be a non-negative number");
    });

    it('should accept valid creditsCaps configuration', () => {
      const validConfigWithCaps = {
        ...validConfig,
        membership: {
          ...validConfig.membership,
          creditsCaps: {
            free: 0,
            basic: 100,
            premium: 1000,
            enterprise: 10000
          }
        }
      };
      
      const engine = new CreditsEngine({
        storage,
        config: validConfigWithCaps
      });

      expect(engine).toBeInstanceOf(CreditsEngine);
    });
  });

  describe('Configuration Validation - Retry', () => {
    it('should throw ConfigurationError when retry is missing', () => {
      const invalidConfig = { ...validConfig, retry: undefined as any };
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow('Configuration must include retry object');
    });

    it('should throw ConfigurationError when retry.enabled is missing', () => {
      const invalidConfig = {
        ...validConfig,
        retry: {
          ...validConfig.retry,
          enabled: undefined as any
        }
      };
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow("Retry configuration must include 'enabled'");
    });

    it('should throw ConfigurationError when retry.maxAttempts is less than 1', () => {
      const invalidConfig = {
        ...validConfig,
        retry: {
          ...validConfig.retry,
          maxAttempts: 0
        }
      };
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow('Retry maxAttempts must be at least 1');
    });

    it('should throw ConfigurationError when retry.initialDelay is negative', () => {
      const invalidConfig = {
        ...validConfig,
        retry: {
          ...validConfig.retry,
          initialDelay: -100
        }
      };
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow('Retry initialDelay must be non-negative');
    });

    it('should throw ConfigurationError when retry.maxDelay < initialDelay', () => {
      const invalidConfig = {
        ...validConfig,
        retry: {
          ...validConfig.retry,
          initialDelay: 1000,
          maxDelay: 500
        }
      };
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow('Retry maxDelay must be >= initialDelay');
    });

    it('should throw ConfigurationError when retry.backoffMultiplier < 1', () => {
      const invalidConfig = {
        ...validConfig,
        retry: {
          ...validConfig.retry,
          backoffMultiplier: 0.5
        }
      };
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow('Retry backoffMultiplier must be >= 1');
    });
  });

  describe('Configuration Validation - Idempotency', () => {
    it('should throw ConfigurationError when idempotency is missing', () => {
      const invalidConfig = { ...validConfig, idempotency: undefined as any };
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow('Configuration must include idempotency object');
    });

    it('should throw ConfigurationError when idempotency.enabled is missing', () => {
      const invalidConfig = {
        ...validConfig,
        idempotency: {
          ...validConfig.idempotency,
          enabled: undefined as any
        }
      };
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow('Idempotency configuration must include enabled');
    });

    it('should throw ConfigurationError when idempotency.ttl is missing', () => {
      const invalidConfig = {
        ...validConfig,
        idempotency: {
          ...validConfig.idempotency,
          ttl: undefined as any
        }
      };
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow('Idempotency configuration must include ttl');
    });

    it('should throw ConfigurationError when idempotency.ttl is negative', () => {
      const invalidConfig = {
        ...validConfig,
        idempotency: {
          ...validConfig.idempotency,
          ttl: -100
        }
      };
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow('Idempotency ttl must be non-negative');
    });
  });

  describe('Configuration Validation - Audit', () => {
    it('should throw ConfigurationError when audit is missing', () => {
      const invalidConfig = { ...validConfig, audit: undefined as any };
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow('Configuration must include audit object');
    });

    it('should throw ConfigurationError when audit.enabled is missing', () => {
      const invalidConfig = {
        ...validConfig,
        audit: {
          enabled: undefined as any
        }
      };
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow(ConfigurationError);
      
      expect(() => {
        new CreditsEngine({ storage, config: invalidConfig });
      }).toThrow('Audit configuration must include enabled');
    });
  });

  describe('Edge Cases', () => {
    it('should accept config with empty costs object', () => {
      const configWithEmptyCosts = {
        ...validConfig,
        costs: {}
      };
      
      // Should not throw - empty costs is valid (though not useful)
      const engine = new CreditsEngine({
        storage,
        config: configWithEmptyCosts
      });

      expect(engine).toBeInstanceOf(CreditsEngine);
    });

    it('should accept config with disabled features', () => {
      const configWithDisabledFeatures = {
        ...validConfig,
        retry: {
          ...validConfig.retry,
          enabled: false
        },
        idempotency: {
          ...validConfig.idempotency,
          enabled: false
        },
        audit: {
          enabled: false
        }
      };
      
      const engine = new CreditsEngine({
        storage,
        config: configWithDisabledFeatures
      });

      expect(engine).toBeInstanceOf(CreditsEngine);
    });

    it('should accept config with zero TTL for idempotency', () => {
      const configWithZeroTTL = {
        ...validConfig,
        idempotency: {
          enabled: true,
          ttl: 0
        }
      };
      
      const engine = new CreditsEngine({
        storage,
        config: configWithZeroTTL
      });

      expect(engine).toBeInstanceOf(CreditsEngine);
    });

    it('should accept config with backoffMultiplier of 1', () => {
      const configWithBackoff1 = {
        ...validConfig,
        retry: {
          ...validConfig.retry,
          backoffMultiplier: 1
        }
      };
      
      const engine = new CreditsEngine({
        storage,
        config: configWithBackoff1
      });

      expect(engine).toBeInstanceOf(CreditsEngine);
    });
  });
});

describe('CreditsEngine charge method', () => {
  let storage: MockStorageAdapter;
  let logger: MockLogger;
  let engine: CreditsEngine;

  beforeEach(() => {
    storage = new MockStorageAdapter();
    logger = new MockLogger();
    engine = new CreditsEngine({
      storage,
      config: validConfig,
      logger
    });
  });

  describe('Successful charge operations', () => {
    it('should successfully charge a user with sufficient credits', async () => {
      // Setup: User with 100 credits
      const user = {
        id: 'user-123',
        credits: 100,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const transaction = {
        id: 'txn-123',
        userId: 'user-123',
        action: 'generate-post',
        amount: -10,
        balanceBefore: 100,
        balanceAfter: 90,
        metadata: {},
        createdAt: new Date()
      };

      const auditLog = {
        id: 'audit-123',
        userId: 'user-123',
        action: 'charge',
        status: 'success' as const,
        metadata: {},
        createdAt: new Date()
      };

      // Mock storage methods
      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => ({ ...user, credits: 90 });
      storage.createTransaction = async () => transaction;
      storage.createAuditLog = async () => auditLog;

      // Execute
      const result = await engine.charge({
        userId: 'user-123',
        action: 'generate-post'
      });

      // Verify
      expect(result).toEqual({
        success: true,
        transactionId: 'txn-123',
        cost: 10,
        balanceBefore: 100,
        balanceAfter: 90
      });
    });

    it('should apply membership tier pricing', async () => {
      // Setup: Premium user
      const user = {
        id: 'user-123',
        credits: 100,
        membershipTier: 'premium',
        membershipExpiresAt: new Date(Date.now() + 86400000), // Tomorrow
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const transaction = {
        id: 'txn-123',
        userId: 'user-123',
        action: 'generate-post',
        amount: -8, // Premium price
        balanceBefore: 100,
        balanceAfter: 92,
        metadata: {},
        createdAt: new Date()
      };

      const auditLog = {
        id: 'audit-123',
        userId: 'user-123',
        action: 'charge',
        status: 'success' as const,
        metadata: {},
        createdAt: new Date()
      };

      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => ({ ...user, credits: 92 });
      storage.createTransaction = async () => transaction;
      storage.createAuditLog = async () => auditLog;

      // Execute
      const result = await engine.charge({
        userId: 'user-123',
        action: 'generate-post'
      });

      // Verify premium pricing was applied
      expect(result.cost).toBe(8);
      expect(result.balanceAfter).toBe(92);
    });

    it('should include metadata in transaction and audit log', async () => {
      const user = {
        id: 'user-123',
        credits: 100,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      let capturedTransactionMetadata: any;
      let capturedAuditMetadata: any;

      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => ({ ...user, credits: 90 });
      storage.createTransaction = async (input) => {
        capturedTransactionMetadata = input.metadata;
        return {
          id: 'txn-123',
          userId: input.userId,
          action: input.action,
          amount: input.amount,
          balanceBefore: input.balanceBefore,
          balanceAfter: input.balanceAfter,
          metadata: input.metadata || {},
          createdAt: new Date()
        };
      };
      storage.createAuditLog = async (input) => {
        capturedAuditMetadata = input.metadata;
        return {
          id: 'audit-123',
          userId: input.userId,
          action: input.action,
          status: input.status,
          metadata: input.metadata || {},
          createdAt: new Date()
        };
      };

      // Execute with custom metadata
      await engine.charge({
        userId: 'user-123',
        action: 'generate-post',
        metadata: {
          requestId: 'req-456',
          source: 'api'
        }
      });

      // Verify metadata was passed through
      expect(capturedTransactionMetadata).toEqual({
        requestId: 'req-456',
        source: 'api'
      });

      expect(capturedAuditMetadata).toMatchObject({
        requestId: 'req-456',
        source: 'api'
      });
    });
  });

  describe('Idempotency', () => {
    it('should return cached result for duplicate idempotency key', async () => {
      const cachedResult = {
        success: true,
        transactionId: 'txn-original',
        cost: 10,
        balanceBefore: 100,
        balanceAfter: 90
      };

      // Mock idempotency record exists
      storage.getIdempotencyRecord = async () => ({
        key: 'idempotency-key-123',
        result: cachedResult,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000)
      });

      // Execute with idempotency key
      const result = await engine.charge({
        userId: 'user-123',
        action: 'generate-post',
        idempotencyKey: 'idempotency-key-123'
      });

      // Verify cached result was returned
      expect(result).toEqual(cachedResult);
      expect(result.transactionId).toBe('txn-original');
    });

    it('should save idempotency record after successful charge', async () => {
      const user = {
        id: 'user-123',
        credits: 100,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      let savedIdempotencyRecord: any;

      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => ({ ...user, credits: 90 });
      storage.createTransaction = async () => ({
        id: 'txn-123',
        userId: 'user-123',
        action: 'generate-post',
        amount: -10,
        balanceBefore: 100,
        balanceAfter: 90,
        metadata: {},
        createdAt: new Date()
      });
      storage.createAuditLog = async () => ({
        id: 'audit-123',
        userId: 'user-123',
        action: 'charge',
        status: 'success' as const,
        metadata: {},
        createdAt: new Date()
      });
      storage.getIdempotencyRecord = async () => null;
      storage.createIdempotencyRecord = async (record) => {
        savedIdempotencyRecord = record;
        return {
          ...record,
          createdAt: new Date()
        };
      };

      // Execute with idempotency key
      await engine.charge({
        userId: 'user-123',
        action: 'generate-post',
        idempotencyKey: 'idempotency-key-123'
      });

      // Verify idempotency record was saved
      expect(savedIdempotencyRecord).toBeDefined();
      expect(savedIdempotencyRecord.key).toBe('idempotency-key-123');
      expect(savedIdempotencyRecord.result).toMatchObject({
        success: true,
        transactionId: 'txn-123',
        cost: 10
      });
    });
  });

  describe('Error handling - User not found', () => {
    it('should throw UserNotFoundError when user does not exist', async () => {
      storage.getUserById = async () => null;

      await expect(
        engine.charge({
          userId: 'nonexistent-user',
          action: 'generate-post'
        })
      ).rejects.toThrow('User nonexistent-user not found');
    });

    it('should create audit log for user not found error', async () => {
      let auditLogCreated = false;

      storage.getUserById = async () => null;
      storage.createAuditLog = async (input) => {
        auditLogCreated = true;
        expect(input.status).toBe('failed');
        expect(input.errorMessage).toContain('not found');
        return {
          id: 'audit-123',
          userId: input.userId,
          action: input.action,
          status: input.status,
          metadata: input.metadata || {},
          createdAt: new Date()
        };
      };

      await expect(
        engine.charge({
          userId: 'nonexistent-user',
          action: 'generate-post'
        })
      ).rejects.toThrow();

      expect(auditLogCreated).toBe(true);
    });
  });

  describe('Error handling - Insufficient credits', () => {
    it('should throw InsufficientCreditsError when balance is too low', async () => {
      const user = {
        id: 'user-123',
        credits: 5, // Less than required 10
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      storage.getUserById = async () => user;

      await expect(
        engine.charge({
          userId: 'user-123',
          action: 'generate-post'
        })
      ).rejects.toThrow('User user-123 has insufficient credits. Required: 10, Available: 5');
    });

    it('should create audit log for insufficient credits error', async () => {
      const user = {
        id: 'user-123',
        credits: 5,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      let auditLogCreated = false;

      storage.getUserById = async () => user;
      storage.createAuditLog = async (input) => {
        auditLogCreated = true;
        expect(input.status).toBe('failed');
        expect(input.errorMessage).toContain('insufficient credits');
        return {
          id: 'audit-123',
          userId: input.userId,
          action: input.action,
          status: input.status,
          metadata: input.metadata || {},
          createdAt: new Date()
        };
      };

      await expect(
        engine.charge({
          userId: 'user-123',
          action: 'generate-post'
        })
      ).rejects.toThrow();

      expect(auditLogCreated).toBe(true);
    });
  });

  describe('Error handling - Membership required', () => {
    it('should throw MembershipRequiredError when user lacks required tier', async () => {
      const user = {
        id: 'user-123',
        credits: 100,
        membershipTier: 'basic', // Requires premium
        membershipExpiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      storage.getUserById = async () => user;

      await expect(
        engine.charge({
          userId: 'user-123',
          action: 'generate-image' // Requires premium
        })
      ).rejects.toThrow('User user-123 requires premium membership, but has basic');
    });

    it('should throw MembershipRequiredError when membership is expired', async () => {
      const user = {
        id: 'user-123',
        credits: 100,
        membershipTier: 'premium',
        membershipExpiresAt: new Date(Date.now() - 86400000), // Yesterday
        createdAt: new Date(),
        updatedAt: new Date()
      };

      storage.getUserById = async () => user;

      await expect(
        engine.charge({
          userId: 'user-123',
          action: 'generate-image' // Requires premium
        })
      ).rejects.toThrow('User user-123 requires premium membership, but has none');
    });

    it('should create audit log for membership error', async () => {
      const user = {
        id: 'user-123',
        credits: 100,
        membershipTier: 'basic',
        membershipExpiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      let auditLogCreated = false;

      storage.getUserById = async () => user;
      storage.createAuditLog = async (input) => {
        auditLogCreated = true;
        expect(input.status).toBe('failed');
        expect(input.errorMessage).toContain('membership');
        return {
          id: 'audit-123',
          userId: input.userId,
          action: input.action,
          status: input.status,
          metadata: input.metadata || {},
          createdAt: new Date()
        };
      };

      await expect(
        engine.charge({
          userId: 'user-123',
          action: 'generate-image'
        })
      ).rejects.toThrow();

      expect(auditLogCreated).toBe(true);
    });
  });

  describe('Transaction context support', () => {
    it('should pass transaction context to all storage operations', async () => {
      const user = {
        id: 'user-123',
        credits: 100,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockTxn = { id: 'transaction-context' };
      const txnCalls: string[] = [];

      storage.getUserById = async (userId, txn) => {
        if (txn === mockTxn) txnCalls.push('getUserById');
        return user;
      };
      storage.updateUserCredits = async (userId, amount, txn) => {
        if (txn === mockTxn) txnCalls.push('updateUserCredits');
        return { ...user, credits: 90 };
      };
      storage.createTransaction = async (input, txn) => {
        if (txn === mockTxn) txnCalls.push('createTransaction');
        return {
          id: 'txn-123',
          userId: input.userId,
          action: input.action,
          amount: input.amount,
          balanceBefore: input.balanceBefore,
          balanceAfter: input.balanceAfter,
          metadata: input.metadata || {},
          createdAt: new Date()
        };
      };
      storage.createAuditLog = async (input, txn) => {
        if (txn === mockTxn) txnCalls.push('createAuditLog');
        return {
          id: 'audit-123',
          userId: input.userId,
          action: input.action,
          status: input.status,
          metadata: input.metadata || {},
          createdAt: new Date()
        };
      };
      storage.getIdempotencyRecord = async (key, txn) => {
        if (txn === mockTxn) txnCalls.push('getIdempotencyRecord');
        return null;
      };
      storage.createIdempotencyRecord = async (record, txn) => {
        if (txn === mockTxn) txnCalls.push('createIdempotencyRecord');
        return {
          ...record,
          createdAt: new Date()
        };
      };

      // Execute with transaction context
      await engine.charge({
        userId: 'user-123',
        action: 'generate-post',
        idempotencyKey: 'key-123',
        txn: mockTxn
      });

      // Verify all operations received the transaction context
      expect(txnCalls).toContain('getUserById');
      expect(txnCalls).toContain('updateUserCredits');
      expect(txnCalls).toContain('createTransaction');
      expect(txnCalls).toContain('createAuditLog');
      expect(txnCalls).toContain('getIdempotencyRecord');
      expect(txnCalls).toContain('createIdempotencyRecord');
    });
  });

  describe('Audit logging', () => {
    it('should not create audit log when audit is disabled', async () => {
      const configWithoutAudit = {
        ...validConfig,
        audit: { enabled: false }
      };

      const engineWithoutAudit = new CreditsEngine({
        storage,
        config: configWithoutAudit,
        logger
      });

      const user = {
        id: 'user-123',
        credits: 100,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      let auditLogCalled = false;

      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => ({ ...user, credits: 90 });
      storage.createTransaction = async () => ({
        id: 'txn-123',
        userId: 'user-123',
        action: 'generate-post',
        amount: -10,
        balanceBefore: 100,
        balanceAfter: 90,
        metadata: {},
        createdAt: new Date()
      });
      storage.createAuditLog = async () => {
        auditLogCalled = true;
        throw new Error('Audit log should not be called');
      };

      await engineWithoutAudit.charge({
        userId: 'user-123',
        action: 'generate-post'
      });

      expect(auditLogCalled).toBe(false);
    });
  });

  describe('Logging', () => {
    it('should log all major steps of charge operation', async () => {
      const user = {
        id: 'user-123',
        credits: 100,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => ({ ...user, credits: 90 });
      storage.createTransaction = async () => ({
        id: 'txn-123',
        userId: 'user-123',
        action: 'generate-post',
        amount: -10,
        balanceBefore: 100,
        balanceAfter: 90,
        metadata: {},
        createdAt: new Date()
      });
      storage.createAuditLog = async () => ({
        id: 'audit-123',
        userId: 'user-123',
        action: 'charge',
        status: 'success' as const,
        metadata: {},
        createdAt: new Date()
      });

      logger.logs = []; // Clear initialization logs

      await engine.charge({
        userId: 'user-123',
        action: 'generate-post'
      });

      const messages = logger.logs.map(log => log.message);
      
      expect(messages.some(m => m.includes('Starting charge operation'))).toBe(true);
      expect(messages.some(m => m.includes('Fetching user'))).toBe(true);
      expect(messages.some(m => m.includes('User found'))).toBe(true);
      expect(messages.some(m => m.includes('Calculating cost'))).toBe(true);
      expect(messages.some(m => m.includes('Balance check passed'))).toBe(true);
      expect(messages.some(m => m.includes('Updating user balance'))).toBe(true);
      expect(messages.some(m => m.includes('Creating transaction record'))).toBe(true);
      expect(messages.some(m => m.includes('Charge operation completed successfully'))).toBe(true);
    });
  });
});

describe('CreditsEngine refund method', () => {
  let storage: MockStorageAdapter;
  let logger: MockLogger;
  let engine: CreditsEngine;

  beforeEach(() => {
    storage = new MockStorageAdapter();
    logger = new MockLogger();
    engine = new CreditsEngine({
      storage,
      config: validConfig,
      logger
    });
  });

  describe('Successful refund operations', () => {
    it('should successfully refund credits to a user', async () => {
      // Setup: User with 50 credits
      const user = {
        id: 'user-123',
        credits: 50,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const transaction = {
        id: 'txn-refund-123',
        userId: 'user-123',
        action: 'refund-order-456',
        amount: 100, // Positive amount for refund
        balanceBefore: 50,
        balanceAfter: 150,
        metadata: {},
        createdAt: new Date()
      };

      const auditLog = {
        id: 'audit-refund-123',
        userId: 'user-123',
        action: 'refund',
        status: 'success' as const,
        metadata: {},
        createdAt: new Date()
      };

      // Mock storage methods
      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => ({ ...user, credits: 150 });
      storage.createTransaction = async () => transaction;
      storage.createAuditLog = async () => auditLog;

      // Execute
      const result = await engine.refund({
        userId: 'user-123',
        amount: 100,
        action: 'refund-order-456'
      });

      // Verify
      expect(result).toEqual({
        success: true,
        transactionId: 'txn-refund-123',
        amount: 100,
        balanceAfter: 150
      });
    });

    it('should create transaction record with positive amount', async () => {
      const user = {
        id: 'user-123',
        credits: 50,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      let capturedTransactionAmount: number | undefined;

      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => ({ ...user, credits: 150 });
      storage.createTransaction = async (input) => {
        capturedTransactionAmount = input.amount;
        return {
          id: 'txn-refund-123',
          userId: input.userId,
          action: input.action,
          amount: input.amount,
          balanceBefore: input.balanceBefore,
          balanceAfter: input.balanceAfter,
          metadata: input.metadata || {},
          createdAt: new Date()
        };
      };
      storage.createAuditLog = async () => ({
        id: 'audit-refund-123',
        userId: 'user-123',
        action: 'refund',
        status: 'success' as const,
        metadata: {},
        createdAt: new Date()
      });

      // Execute
      await engine.refund({
        userId: 'user-123',
        amount: 100,
        action: 'refund-order-456'
      });

      // Verify transaction amount is positive
      expect(capturedTransactionAmount).toBe(100);
      expect(capturedTransactionAmount).toBeGreaterThan(0);
    });

    it('should include metadata in transaction and audit log', async () => {
      const user = {
        id: 'user-123',
        credits: 50,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      let capturedTransactionMetadata: any;
      let capturedAuditMetadata: any;

      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => ({ ...user, credits: 150 });
      storage.createTransaction = async (input) => {
        capturedTransactionMetadata = input.metadata;
        return {
          id: 'txn-refund-123',
          userId: input.userId,
          action: input.action,
          amount: input.amount,
          balanceBefore: input.balanceBefore,
          balanceAfter: input.balanceAfter,
          metadata: input.metadata || {},
          createdAt: new Date()
        };
      };
      storage.createAuditLog = async (input) => {
        capturedAuditMetadata = input.metadata;
        return {
          id: 'audit-refund-123',
          userId: input.userId,
          action: input.action,
          status: input.status,
          metadata: input.metadata || {},
          createdAt: new Date()
        };
      };

      // Execute with custom metadata
      await engine.refund({
        userId: 'user-123',
        amount: 100,
        action: 'refund-order-456',
        metadata: {
          orderId: 'order-456',
          reason: 'customer-request'
        }
      });

      // Verify metadata was passed through
      expect(capturedTransactionMetadata).toEqual({
        orderId: 'order-456',
        reason: 'customer-request'
      });

      expect(capturedAuditMetadata).toMatchObject({
        orderId: 'order-456',
        reason: 'customer-request'
      });
    });

    it('should correctly update balance from before to after', async () => {
      const user = {
        id: 'user-123',
        credits: 75,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      let capturedBalanceBefore: number | undefined;
      let capturedBalanceAfter: number | undefined;

      storage.getUserById = async () => user;
      storage.updateUserCredits = async (userId, amount) => {
        return { ...user, credits: user.credits + amount };
      };
      storage.createTransaction = async (input) => {
        capturedBalanceBefore = input.balanceBefore;
        capturedBalanceAfter = input.balanceAfter;
        return {
          id: 'txn-refund-123',
          userId: input.userId,
          action: input.action,
          amount: input.amount,
          balanceBefore: input.balanceBefore,
          balanceAfter: input.balanceAfter,
          metadata: input.metadata || {},
          createdAt: new Date()
        };
      };
      storage.createAuditLog = async () => ({
        id: 'audit-refund-123',
        userId: 'user-123',
        action: 'refund',
        status: 'success' as const,
        metadata: {},
        createdAt: new Date()
      });

      // Execute
      await engine.refund({
        userId: 'user-123',
        amount: 25,
        action: 'refund-order-456'
      });

      // Verify balance calculation
      expect(capturedBalanceBefore).toBe(75);
      expect(capturedBalanceAfter).toBe(100);
    });
  });

  describe('Idempotency', () => {
    it('should return cached result for duplicate idempotency key', async () => {
      const cachedResult = {
        success: true,
        transactionId: 'txn-refund-original',
        amount: 100,
        balanceAfter: 150
      };

      // Mock idempotency record exists
      storage.getIdempotencyRecord = async () => ({
        key: 'refund-idempotency-key-123',
        result: cachedResult,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000)
      });

      // Execute with idempotency key
      const result = await engine.refund({
        userId: 'user-123',
        amount: 100,
        action: 'refund-order-456',
        idempotencyKey: 'refund-idempotency-key-123'
      });

      // Verify cached result was returned
      expect(result).toEqual(cachedResult);
      expect(result.transactionId).toBe('txn-refund-original');
    });

    it('should save idempotency record after successful refund', async () => {
      const user = {
        id: 'user-123',
        credits: 50,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      let savedIdempotencyRecord: any;

      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => ({ ...user, credits: 150 });
      storage.createTransaction = async () => ({
        id: 'txn-refund-123',
        userId: 'user-123',
        action: 'refund-order-456',
        amount: 100,
        balanceBefore: 50,
        balanceAfter: 150,
        metadata: {},
        createdAt: new Date()
      });
      storage.createAuditLog = async () => ({
        id: 'audit-refund-123',
        userId: 'user-123',
        action: 'refund',
        status: 'success' as const,
        metadata: {},
        createdAt: new Date()
      });
      storage.getIdempotencyRecord = async () => null;
      storage.createIdempotencyRecord = async (record) => {
        savedIdempotencyRecord = record;
        return {
          ...record,
          createdAt: new Date()
        };
      };

      // Execute with idempotency key
      await engine.refund({
        userId: 'user-123',
        amount: 100,
        action: 'refund-order-456',
        idempotencyKey: 'refund-idempotency-key-123'
      });

      // Verify idempotency record was saved
      expect(savedIdempotencyRecord).toBeDefined();
      expect(savedIdempotencyRecord.key).toBe('refund-idempotency-key-123');
      expect(savedIdempotencyRecord.result).toMatchObject({
        success: true,
        transactionId: 'txn-refund-123',
        amount: 100
      });
    });

    it('should not save idempotency record when key is not provided', async () => {
      const user = {
        id: 'user-123',
        credits: 50,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      let idempotencyRecordSaved = false;

      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => ({ ...user, credits: 150 });
      storage.createTransaction = async () => ({
        id: 'txn-refund-123',
        userId: 'user-123',
        action: 'refund-order-456',
        amount: 100,
        balanceBefore: 50,
        balanceAfter: 150,
        metadata: {},
        createdAt: new Date()
      });
      storage.createAuditLog = async () => ({
        id: 'audit-refund-123',
        userId: 'user-123',
        action: 'refund',
        status: 'success' as const,
        metadata: {},
        createdAt: new Date()
      });
      storage.createIdempotencyRecord = async () => {
        idempotencyRecordSaved = true;
        throw new Error('Should not be called');
      };

      // Execute without idempotency key
      await engine.refund({
        userId: 'user-123',
        amount: 100,
        action: 'refund-order-456'
      });

      // Verify idempotency record was not saved
      expect(idempotencyRecordSaved).toBe(false);
    });
  });

  describe('Error handling - User not found', () => {
    it('should throw UserNotFoundError when user does not exist', async () => {
      storage.getUserById = async () => null;

      await expect(
        engine.refund({
          userId: 'nonexistent-user',
          amount: 100,
          action: 'refund-order-456'
        })
      ).rejects.toThrow('User nonexistent-user not found');
    });

    it('should create audit log for user not found error', async () => {
      let auditLogCreated = false;

      storage.getUserById = async () => null;
      storage.createAuditLog = async (input) => {
        auditLogCreated = true;
        expect(input.status).toBe('failed');
        expect(input.action).toBe('refund');
        expect(input.errorMessage).toContain('not found');
        return {
          id: 'audit-refund-123',
          userId: input.userId,
          action: input.action,
          status: input.status,
          metadata: input.metadata || {},
          createdAt: new Date()
        };
      };

      await expect(
        engine.refund({
          userId: 'nonexistent-user',
          amount: 100,
          action: 'refund-order-456'
        })
      ).rejects.toThrow();

      expect(auditLogCreated).toBe(true);
    });
  });

  describe('Transaction context support', () => {
    it('should pass transaction context to all storage operations', async () => {
      const user = {
        id: 'user-123',
        credits: 50,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockTxn = { id: 'transaction-context' };
      const txnCalls: string[] = [];

      storage.getUserById = async (userId, txn) => {
        if (txn === mockTxn) txnCalls.push('getUserById');
        return user;
      };
      storage.updateUserCredits = async (userId, amount, txn) => {
        if (txn === mockTxn) txnCalls.push('updateUserCredits');
        return { ...user, credits: 150 };
      };
      storage.createTransaction = async (input, txn) => {
        if (txn === mockTxn) txnCalls.push('createTransaction');
        return {
          id: 'txn-refund-123',
          userId: input.userId,
          action: input.action,
          amount: input.amount,
          balanceBefore: input.balanceBefore,
          balanceAfter: input.balanceAfter,
          metadata: input.metadata || {},
          createdAt: new Date()
        };
      };
      storage.createAuditLog = async (input, txn) => {
        if (txn === mockTxn) txnCalls.push('createAuditLog');
        return {
          id: 'audit-refund-123',
          userId: input.userId,
          action: input.action,
          status: input.status,
          metadata: input.metadata || {},
          createdAt: new Date()
        };
      };
      storage.getIdempotencyRecord = async (key, txn) => {
        if (txn === mockTxn) txnCalls.push('getIdempotencyRecord');
        return null;
      };
      storage.createIdempotencyRecord = async (record, txn) => {
        if (txn === mockTxn) txnCalls.push('createIdempotencyRecord');
        return {
          ...record,
          createdAt: new Date()
        };
      };

      // Execute with transaction context
      await engine.refund({
        userId: 'user-123',
        amount: 100,
        action: 'refund-order-456',
        idempotencyKey: 'refund-key-123',
        txn: mockTxn
      });

      // Verify all operations received the transaction context
      expect(txnCalls).toContain('getUserById');
      expect(txnCalls).toContain('updateUserCredits');
      expect(txnCalls).toContain('createTransaction');
      expect(txnCalls).toContain('createAuditLog');
      expect(txnCalls).toContain('getIdempotencyRecord');
      expect(txnCalls).toContain('createIdempotencyRecord');
    });
  });

  describe('Audit logging', () => {
    it('should create audit log with correct action type', async () => {
      const user = {
        id: 'user-123',
        credits: 50,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      let capturedAuditAction: string | undefined;

      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => ({ ...user, credits: 150 });
      storage.createTransaction = async () => ({
        id: 'txn-refund-123',
        userId: 'user-123',
        action: 'refund-order-456',
        amount: 100,
        balanceBefore: 50,
        balanceAfter: 150,
        metadata: {},
        createdAt: new Date()
      });
      storage.createAuditLog = async (input) => {
        capturedAuditAction = input.action;
        return {
          id: 'audit-refund-123',
          userId: input.userId,
          action: input.action,
          status: input.status,
          metadata: input.metadata || {},
          createdAt: new Date()
        };
      };

      await engine.refund({
        userId: 'user-123',
        amount: 100,
        action: 'refund-order-456'
      });

      // Verify audit log action is 'refund'
      expect(capturedAuditAction).toBe('refund');
    });

    it('should not create audit log when audit is disabled', async () => {
      const configWithoutAudit = {
        ...validConfig,
        audit: { enabled: false }
      };

      const engineWithoutAudit = new CreditsEngine({
        storage,
        config: configWithoutAudit,
        logger
      });

      const user = {
        id: 'user-123',
        credits: 50,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      let auditLogCalled = false;

      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => ({ ...user, credits: 150 });
      storage.createTransaction = async () => ({
        id: 'txn-refund-123',
        userId: 'user-123',
        action: 'refund-order-456',
        amount: 100,
        balanceBefore: 50,
        balanceAfter: 150,
        metadata: {},
        createdAt: new Date()
      });
      storage.createAuditLog = async () => {
        auditLogCalled = true;
        throw new Error('Audit log should not be called');
      };

      await engineWithoutAudit.refund({
        userId: 'user-123',
        amount: 100,
        action: 'refund-order-456'
      });

      expect(auditLogCalled).toBe(false);
    });

    it('should include operation details in audit metadata', async () => {
      const user = {
        id: 'user-123',
        credits: 50,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      let capturedAuditMetadata: any;

      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => ({ ...user, credits: 150 });
      storage.createTransaction = async () => ({
        id: 'txn-refund-123',
        userId: 'user-123',
        action: 'refund-order-456',
        amount: 100,
        balanceBefore: 50,
        balanceAfter: 150,
        metadata: {},
        createdAt: new Date()
      });
      storage.createAuditLog = async (input) => {
        capturedAuditMetadata = input.metadata;
        return {
          id: 'audit-refund-123',
          userId: input.userId,
          action: input.action,
          status: input.status,
          metadata: input.metadata || {},
          createdAt: new Date()
        };
      };

      await engine.refund({
        userId: 'user-123',
        amount: 100,
        action: 'refund-order-456'
      });

      // Verify audit metadata includes operation details
      expect(capturedAuditMetadata).toMatchObject({
        operation: 'refund-order-456',
        amount: 100,
        balanceBefore: 50,
        balanceAfter: 150,
        transactionId: 'txn-refund-123'
      });
    });
  });

  describe('Logging', () => {
    it('should log all major steps of refund operation', async () => {
      const user = {
        id: 'user-123',
        credits: 50,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => ({ ...user, credits: 150 });
      storage.createTransaction = async () => ({
        id: 'txn-refund-123',
        userId: 'user-123',
        action: 'refund-order-456',
        amount: 100,
        balanceBefore: 50,
        balanceAfter: 150,
        metadata: {},
        createdAt: new Date()
      });
      storage.createAuditLog = async () => ({
        id: 'audit-refund-123',
        userId: 'user-123',
        action: 'refund',
        status: 'success' as const,
        metadata: {},
        createdAt: new Date()
      });

      logger.logs = []; // Clear initialization logs

      await engine.refund({
        userId: 'user-123',
        amount: 100,
        action: 'refund-order-456'
      });

      const messages = logger.logs.map(log => log.message);
      
      expect(messages.some(m => m.includes('Starting refund operation'))).toBe(true);
      expect(messages.some(m => m.includes('Fetching user'))).toBe(true);
      expect(messages.some(m => m.includes('User found'))).toBe(true);
      expect(messages.some(m => m.includes('Updating user balance'))).toBe(true);
      expect(messages.some(m => m.includes('Creating transaction record'))).toBe(true);
      expect(messages.some(m => m.includes('Refund operation completed successfully'))).toBe(true);
    });

    it('should log error when refund fails', async () => {
      storage.getUserById = async () => null;
      storage.createAuditLog = async () => ({
        id: 'audit-refund-123',
        userId: 'nonexistent-user',
        action: 'refund',
        status: 'failed' as const,
        metadata: {},
        createdAt: new Date()
      });

      logger.logs = []; // Clear initialization logs

      await expect(
        engine.refund({
          userId: 'nonexistent-user',
          amount: 100,
          action: 'refund-order-456'
        })
      ).rejects.toThrow();

      const messages = logger.logs.map(log => log.message);
      
      expect(messages.some(m => m.includes('Refund operation failed'))).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle refund with zero amount', async () => {
      const user = {
        id: 'user-123',
        credits: 50,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => user; // No change
      storage.createTransaction = async () => ({
        id: 'txn-refund-123',
        userId: 'user-123',
        action: 'refund-order-456',
        amount: 0,
        balanceBefore: 50,
        balanceAfter: 50,
        metadata: {},
        createdAt: new Date()
      });
      storage.createAuditLog = async () => ({
        id: 'audit-refund-123',
        userId: 'user-123',
        action: 'refund',
        status: 'success' as const,
        metadata: {},
        createdAt: new Date()
      });

      const result = await engine.refund({
        userId: 'user-123',
        amount: 0,
        action: 'refund-order-456'
      });

      expect(result.amount).toBe(0);
      expect(result.balanceAfter).toBe(50);
    });

    it('should handle large refund amounts', async () => {
      const user = {
        id: 'user-123',
        credits: 100,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const largeAmount = 1000000;

      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => ({ ...user, credits: 100 + largeAmount });
      storage.createTransaction = async () => ({
        id: 'txn-refund-123',
        userId: 'user-123',
        action: 'refund-order-456',
        amount: largeAmount,
        balanceBefore: 100,
        balanceAfter: 100 + largeAmount,
        metadata: {},
        createdAt: new Date()
      });
      storage.createAuditLog = async () => ({
        id: 'audit-refund-123',
        userId: 'user-123',
        action: 'refund',
        status: 'success' as const,
        metadata: {},
        createdAt: new Date()
      });

      const result = await engine.refund({
        userId: 'user-123',
        amount: largeAmount,
        action: 'refund-order-456'
      });

      expect(result.amount).toBe(largeAmount);
      expect(result.balanceAfter).toBe(100 + largeAmount);
    });
  });
});

describe('CreditsEngine grant method', () => {
  let storage: MockStorageAdapter;
  let logger: MockLogger;
  let engine: CreditsEngine;

  beforeEach(() => {
    storage = new MockStorageAdapter();
    logger = new MockLogger();
    engine = new CreditsEngine({
      storage,
      config: validConfig,
      logger
    });
  });

  describe('Successful grant operations', () => {
    it('should successfully grant credits to a user', async () => {
      const user = {
        id: 'user-123',
        credits: 50,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => ({ ...user, credits: 150 });
      storage.createTransaction = async () => ({
        id: 'txn-grant-123',
        userId: 'user-123',
        action: 'promotion-bonus',
        amount: 100,
        balanceBefore: 50,
        balanceAfter: 150,
        metadata: {},
        createdAt: new Date()
      });
      storage.createAuditLog = async () => ({
        id: 'audit-grant-123',
        userId: 'user-123',
        action: 'grant',
        status: 'success' as const,
        metadata: {},
        createdAt: new Date()
      });

      const result = await engine.grant({
        userId: 'user-123',
        amount: 100,
        action: 'promotion-bonus'
      });

      expect(result).toEqual({
        success: true,
        transactionId: 'txn-grant-123',
        amount: 100,
        balanceAfter: 150
      });
    });

    it('should create transaction record with positive amount', async () => {
      const user = {
        id: 'user-123',
        credits: 50,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      let capturedTransaction: any;

      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => ({ ...user, credits: 150 });
      storage.createTransaction = async (input) => {
        capturedTransaction = input;
        return {
          id: 'txn-grant-123',
          userId: input.userId,
          action: input.action,
          amount: input.amount,
          balanceBefore: input.balanceBefore,
          balanceAfter: input.balanceAfter,
          metadata: input.metadata || {},
          createdAt: new Date()
        };
      };
      storage.createAuditLog = async () => ({
        id: 'audit-grant-123',
        userId: 'user-123',
        action: 'grant',
        status: 'success' as const,
        metadata: {},
        createdAt: new Date()
      });

      await engine.grant({
        userId: 'user-123',
        amount: 100,
        action: 'promotion-bonus'
      });

      // Verify transaction has positive amount
      expect(capturedTransaction.amount).toBe(100);
      expect(capturedTransaction.balanceBefore).toBe(50);
      expect(capturedTransaction.balanceAfter).toBe(150);
    });

    it('should create audit log for successful grant', async () => {
      const user = {
        id: 'user-123',
        credits: 50,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      let capturedAuditLog: any;

      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => ({ ...user, credits: 150 });
      storage.createTransaction = async () => ({
        id: 'txn-grant-123',
        userId: 'user-123',
        action: 'promotion-bonus',
        amount: 100,
        balanceBefore: 50,
        balanceAfter: 150,
        metadata: {},
        createdAt: new Date()
      });
      storage.createAuditLog = async (input) => {
        capturedAuditLog = input;
        return {
          id: 'audit-grant-123',
          userId: input.userId,
          action: input.action,
          status: input.status,
          metadata: input.metadata || {},
          createdAt: new Date()
        };
      };

      await engine.grant({
        userId: 'user-123',
        amount: 100,
        action: 'promotion-bonus'
      });

      // Verify audit log
      expect(capturedAuditLog.userId).toBe('user-123');
      expect(capturedAuditLog.action).toBe('grant');
      expect(capturedAuditLog.status).toBe('success');
      expect(capturedAuditLog.metadata).toMatchObject({
        operation: 'promotion-bonus',
        amount: 100,
        balanceBefore: 50,
        balanceAfter: 150
      });
    });

    it('should include metadata in transaction and audit log', async () => {
      const user = {
        id: 'user-123',
        credits: 50,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      let capturedTransactionMetadata: any;
      let capturedAuditMetadata: any;

      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => ({ ...user, credits: 150 });
      storage.createTransaction = async (input) => {
        capturedTransactionMetadata = input.metadata;
        return {
          id: 'txn-grant-123',
          userId: input.userId,
          action: input.action,
          amount: input.amount,
          balanceBefore: input.balanceBefore,
          balanceAfter: input.balanceAfter,
          metadata: input.metadata || {},
          createdAt: new Date()
        };
      };
      storage.createAuditLog = async (input) => {
        capturedAuditMetadata = input.metadata;
        return {
          id: 'audit-grant-123',
          userId: input.userId,
          action: input.action,
          status: input.status,
          metadata: input.metadata || {},
          createdAt: new Date()
        };
      };

      await engine.grant({
        userId: 'user-123',
        amount: 100,
        action: 'promotion-bonus',
        metadata: {
          campaignId: 'campaign-789',
          source: 'marketing'
        }
      });

      // Verify metadata was passed through
      expect(capturedTransactionMetadata).toEqual({
        campaignId: 'campaign-789',
        source: 'marketing'
      });

      expect(capturedAuditMetadata).toMatchObject({
        campaignId: 'campaign-789',
        source: 'marketing'
      });
    });
  });

  describe('Transaction context support', () => {
    it('should pass transaction context to storage methods', async () => {
      const user = {
        id: 'user-123',
        credits: 50,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockTxn = { id: 'txn-context' };
      let getUserTxn: any;
      let updateCreditsTxn: any;
      let createTransactionTxn: any;
      let createAuditLogTxn: any;

      storage.getUserById = async (userId, txn) => {
        getUserTxn = txn;
        return user;
      };
      storage.updateUserCredits = async (userId, amount, txn) => {
        updateCreditsTxn = txn;
        return { ...user, credits: 150 };
      };
      storage.createTransaction = async (input, txn) => {
        createTransactionTxn = txn;
        return {
          id: 'txn-grant-123',
          userId: input.userId,
          action: input.action,
          amount: input.amount,
          balanceBefore: input.balanceBefore,
          balanceAfter: input.balanceAfter,
          metadata: input.metadata || {},
          createdAt: new Date()
        };
      };
      storage.createAuditLog = async (input, txn) => {
        createAuditLogTxn = txn;
        return {
          id: 'audit-grant-123',
          userId: input.userId,
          action: input.action,
          status: input.status,
          metadata: input.metadata || {},
          createdAt: new Date()
        };
      };

      await engine.grant({
        userId: 'user-123',
        amount: 100,
        action: 'promotion-bonus',
        txn: mockTxn
      });

      // Verify transaction context was passed to all storage methods
      expect(getUserTxn).toBe(mockTxn);
      expect(updateCreditsTxn).toBe(mockTxn);
      expect(createTransactionTxn).toBe(mockTxn);
      expect(createAuditLogTxn).toBe(mockTxn);
    });
  });

  describe('Error handling - Amount validation', () => {
    it('should throw ConfigurationError when amount is zero', async () => {
      await expect(
        engine.grant({
          userId: 'user-123',
          amount: 0,
          action: 'promotion-bonus'
        })
      ).rejects.toThrow(ConfigurationError);

      await expect(
        engine.grant({
          userId: 'user-123',
          amount: 0,
          action: 'promotion-bonus'
        })
      ).rejects.toThrow('Grant amount must be positive, got 0');
    });

    it('should throw ConfigurationError when amount is negative', async () => {
      await expect(
        engine.grant({
          userId: 'user-123',
          amount: -100,
          action: 'promotion-bonus'
        })
      ).rejects.toThrow(ConfigurationError);

      await expect(
        engine.grant({
          userId: 'user-123',
          amount: -100,
          action: 'promotion-bonus'
        })
      ).rejects.toThrow('Grant amount must be positive, got -100');
    });

    it('should create audit log for invalid amount error', async () => {
      let auditLogCreated = false;

      storage.createAuditLog = async (input) => {
        auditLogCreated = true;
        expect(input.status).toBe('failed');
        expect(input.errorMessage).toContain('Grant amount must be positive');
        return {
          id: 'audit-grant-123',
          userId: input.userId,
          action: input.action,
          status: input.status,
          metadata: input.metadata || {},
          createdAt: new Date()
        };
      };

      await expect(
        engine.grant({
          userId: 'user-123',
          amount: -100,
          action: 'promotion-bonus'
        })
      ).rejects.toThrow();

      expect(auditLogCreated).toBe(true);
    });
  });

  describe('Error handling - User not found', () => {
    it('should throw UserNotFoundError when user does not exist', async () => {
      storage.getUserById = async () => null;

      await expect(
        engine.grant({
          userId: 'nonexistent-user',
          amount: 100,
          action: 'promotion-bonus'
        })
      ).rejects.toThrow('User nonexistent-user not found');
    });

    it('should create audit log for user not found error', async () => {
      let auditLogCreated = false;

      storage.getUserById = async () => null;
      storage.createAuditLog = async (input) => {
        auditLogCreated = true;
        expect(input.status).toBe('failed');
        expect(input.errorMessage).toContain('not found');
        return {
          id: 'audit-grant-123',
          userId: input.userId,
          action: input.action,
          status: input.status,
          metadata: input.metadata || {},
          createdAt: new Date()
        };
      };

      await expect(
        engine.grant({
          userId: 'nonexistent-user',
          amount: 100,
          action: 'promotion-bonus'
        })
      ).rejects.toThrow();

      expect(auditLogCreated).toBe(true);
    });
  });

  describe('Audit disabled', () => {
    it('should not create audit log when audit is disabled', async () => {
      const configWithoutAudit = {
        ...validConfig,
        audit: {
          enabled: false
        }
      };

      const engineWithoutAudit = new CreditsEngine({
        storage,
        config: configWithoutAudit,
        logger
      });

      const user = {
        id: 'user-123',
        credits: 50,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      let auditLogCalled = false;

      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => ({ ...user, credits: 150 });
      storage.createTransaction = async () => ({
        id: 'txn-grant-123',
        userId: 'user-123',
        action: 'promotion-bonus',
        amount: 100,
        balanceBefore: 50,
        balanceAfter: 150,
        metadata: {},
        createdAt: new Date()
      });
      storage.createAuditLog = async () => {
        auditLogCalled = true;
        return {
          id: 'audit-grant-123',
          userId: 'user-123',
          action: 'grant',
          status: 'success' as const,
          metadata: {},
          createdAt: new Date()
        };
      };

      await engineWithoutAudit.grant({
        userId: 'user-123',
        amount: 100,
        action: 'promotion-bonus'
      });

      expect(auditLogCalled).toBe(false);
    });
  });

  describe('Logging', () => {
    it('should log grant operation steps', async () => {
      const user = {
        id: 'user-123',
        credits: 50,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => ({ ...user, credits: 150 });
      storage.createTransaction = async () => ({
        id: 'txn-grant-123',
        userId: 'user-123',
        action: 'promotion-bonus',
        amount: 100,
        balanceBefore: 50,
        balanceAfter: 150,
        metadata: {},
        createdAt: new Date()
      });
      storage.createAuditLog = async () => ({
        id: 'audit-grant-123',
        userId: 'user-123',
        action: 'grant',
        status: 'success' as const,
        metadata: {},
        createdAt: new Date()
      });

      logger.logs = []; // Clear initialization logs

      await engine.grant({
        userId: 'user-123',
        amount: 100,
        action: 'promotion-bonus'
      });

      const messages = logger.logs.map(log => log.message);
      
      expect(messages.some(m => m.includes('Starting grant operation'))).toBe(true);
      expect(messages.some(m => m.includes('Amount validation passed'))).toBe(true);
      expect(messages.some(m => m.includes('Fetching user'))).toBe(true);
      expect(messages.some(m => m.includes('User found'))).toBe(true);
      expect(messages.some(m => m.includes('Updating user balance'))).toBe(true);
      expect(messages.some(m => m.includes('Creating transaction record'))).toBe(true);
      expect(messages.some(m => m.includes('Grant operation completed successfully'))).toBe(true);
    });

    it('should log error when grant fails', async () => {
      storage.getUserById = async () => null;
      storage.createAuditLog = async () => ({
        id: 'audit-grant-123',
        userId: 'nonexistent-user',
        action: 'grant',
        status: 'failed' as const,
        metadata: {},
        createdAt: new Date()
      });

      logger.logs = []; // Clear initialization logs

      await expect(
        engine.grant({
          userId: 'nonexistent-user',
          amount: 100,
          action: 'promotion-bonus'
        })
      ).rejects.toThrow();

      const messages = logger.logs.map(log => log.message);
      
      expect(messages.some(m => m.includes('Grant operation failed'))).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle grant with very small positive amount', async () => {
      const user = {
        id: 'user-123',
        credits: 50,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => ({ ...user, credits: 50.01 });
      storage.createTransaction = async () => ({
        id: 'txn-grant-123',
        userId: 'user-123',
        action: 'promotion-bonus',
        amount: 0.01,
        balanceBefore: 50,
        balanceAfter: 50.01,
        metadata: {},
        createdAt: new Date()
      });
      storage.createAuditLog = async () => ({
        id: 'audit-grant-123',
        userId: 'user-123',
        action: 'grant',
        status: 'success' as const,
        metadata: {},
        createdAt: new Date()
      });

      const result = await engine.grant({
        userId: 'user-123',
        amount: 0.01,
        action: 'promotion-bonus'
      });

      expect(result.amount).toBe(0.01);
      expect(result.balanceAfter).toBe(50.01);
    });

    it('should handle large grant amounts', async () => {
      const user = {
        id: 'user-123',
        credits: 100,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const largeAmount = 1000000;

      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => ({ ...user, credits: 100 + largeAmount });
      storage.createTransaction = async () => ({
        id: 'txn-grant-123',
        userId: 'user-123',
        action: 'promotion-bonus',
        amount: largeAmount,
        balanceBefore: 100,
        balanceAfter: 100 + largeAmount,
        metadata: {},
        createdAt: new Date()
      });
      storage.createAuditLog = async () => ({
        id: 'audit-grant-123',
        userId: 'user-123',
        action: 'grant',
        status: 'success' as const,
        metadata: {},
        createdAt: new Date()
      });

      const result = await engine.grant({
        userId: 'user-123',
        amount: largeAmount,
        action: 'promotion-bonus'
      });

      expect(result.amount).toBe(largeAmount);
      expect(result.balanceAfter).toBe(100 + largeAmount);
    });

    it('should handle grant to user with zero balance', async () => {
      const user = {
        id: 'user-123',
        credits: 0,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      storage.getUserById = async () => user;
      storage.updateUserCredits = async () => ({ ...user, credits: 100 });
      storage.createTransaction = async () => ({
        id: 'txn-grant-123',
        userId: 'user-123',
        action: 'promotion-bonus',
        amount: 100,
        balanceBefore: 0,
        balanceAfter: 100,
        metadata: {},
        createdAt: new Date()
      });
      storage.createAuditLog = async () => ({
        id: 'audit-grant-123',
        userId: 'user-123',
        action: 'grant',
        status: 'success' as const,
        metadata: {},
        createdAt: new Date()
      });

      const result = await engine.grant({
        userId: 'user-123',
        amount: 100,
        action: 'promotion-bonus'
      });

      expect(result.balanceAfter).toBe(100);
    });
  });
});

describe('CreditsEngine queryBalance method', () => {
  let storage: MockStorageAdapter;
  let logger: MockLogger;
  let engine: CreditsEngine;

  beforeEach(() => {
    storage = new MockStorageAdapter();
    logger = new MockLogger();
    engine = new CreditsEngine({
      storage,
      config: validConfig,
      logger
    });
  });

  describe('Successful balance queries', () => {
    it('should return current balance for existing user', async () => {
      // Setup: User with 100 credits
      const user = {
        id: 'user-123',
        credits: 100,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      storage.getUserById = async () => user;

      // Execute
      const balance = await engine.queryBalance('user-123');

      // Verify
      expect(balance).toBe(100);
      expect(typeof balance).toBe('number');
    });

    it('should return zero balance for user with no credits', async () => {
      const user = {
        id: 'user-123',
        credits: 0,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      storage.getUserById = async () => user;

      const balance = await engine.queryBalance('user-123');

      expect(balance).toBe(0);
    });

    it('should return balance with decimal precision', async () => {
      const user = {
        id: 'user-123',
        credits: 123.45,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      storage.getUserById = async () => user;

      const balance = await engine.queryBalance('user-123');

      expect(balance).toBe(123.45);
    });

    it('should return large balance values correctly', async () => {
      const user = {
        id: 'user-123',
        credits: 1000000,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      storage.getUserById = async () => user;

      const balance = await engine.queryBalance('user-123');

      expect(balance).toBe(1000000);
    });

    it('should log query operation', async () => {
      const user = {
        id: 'user-123',
        credits: 100,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      storage.getUserById = async () => user;

      await engine.queryBalance('user-123');

      // Verify logging
      const infoLogs = logger.logs.filter(log => log.level === 'info');
      expect(infoLogs.some(log => log.message.includes('queryBalance'))).toBe(true);
      expect(infoLogs.some(log => log.message.includes('completed successfully'))).toBe(true);
    });
  });

  describe('Transaction context support', () => {
    it('should support transaction context for read consistency', async () => {
      const user = {
        id: 'user-123',
        credits: 100,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      let txnPassed: any;

      storage.getUserById = async (userId, txn) => {
        txnPassed = txn;
        return user;
      };

      const mockTxn = { id: 'transaction-context' };

      // Execute with transaction context
      const balance = await engine.queryBalance('user-123', mockTxn);

      // Verify transaction was passed through
      expect(balance).toBe(100);
      expect(txnPassed).toBe(mockTxn);
    });

    it('should work without transaction context', async () => {
      const user = {
        id: 'user-123',
        credits: 100,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      storage.getUserById = async () => user;

      // Execute without transaction context
      const balance = await engine.queryBalance('user-123');

      expect(balance).toBe(100);
    });

    it('should log transaction context presence', async () => {
      const user = {
        id: 'user-123',
        credits: 100,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      storage.getUserById = async () => user;

      const mockTxn = { id: 'transaction-context' };

      await engine.queryBalance('user-123', mockTxn);

      // Verify transaction context was logged
      const infoLogs = logger.logs.filter(log => log.level === 'info');
      const startLog = infoLogs.find(log => log.message.includes('Starting queryBalance'));
      expect(startLog?.context?.hasTransaction).toBe(true);
    });
  });

  describe('Error handling - User not found', () => {
    it('should throw UserNotFoundError when user does not exist', async () => {
      storage.getUserById = async () => null;

      await expect(
        engine.queryBalance('nonexistent-user')
      ).rejects.toThrow('User nonexistent-user not found');
    });

    it('should throw UserNotFoundError with correct error type', async () => {
      storage.getUserById = async () => null;

      try {
        await engine.queryBalance('nonexistent-user');
        expect.fail('Should have thrown UserNotFoundError');
      } catch (error: any) {
        expect(error.name).toBe('UserNotFoundError');
        expect(error.code).toBe('USER_NOT_FOUND');
        expect(error.userId).toBe('nonexistent-user');
      }
    });

    it('should log warning when user not found', async () => {
      storage.getUserById = async () => null;

      try {
        await engine.queryBalance('nonexistent-user');
      } catch (error) {
        // Expected error
      }

      // Verify warning was logged
      const warnLogs = logger.logs.filter(log => log.level === 'warn');
      expect(warnLogs.some(log => log.message.includes('User not found'))).toBe(true);
    });

    it('should log error when query fails', async () => {
      storage.getUserById = async () => null;

      try {
        await engine.queryBalance('nonexistent-user');
      } catch (error) {
        // Expected error
      }

      // Verify error was logged
      const errorLogs = logger.logs.filter(log => log.level === 'error');
      expect(errorLogs.some(log => log.message.includes('QueryBalance operation failed'))).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle negative balance (if allowed by system)', async () => {
      const user = {
        id: 'user-123',
        credits: -50,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      storage.getUserById = async () => user;

      const balance = await engine.queryBalance('user-123');

      expect(balance).toBe(-50);
    });

    it('should handle very small decimal values', async () => {
      const user = {
        id: 'user-123',
        credits: 0.001,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      storage.getUserById = async () => user;

      const balance = await engine.queryBalance('user-123');

      expect(balance).toBe(0.001);
    });

    it('should handle user with membership tier', async () => {
      const user = {
        id: 'user-123',
        credits: 100,
        membershipTier: 'premium',
        membershipExpiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      storage.getUserById = async () => user;

      const balance = await engine.queryBalance('user-123');

      // Balance should be returned regardless of membership
      expect(balance).toBe(100);
    });

    it('should handle user with expired membership', async () => {
      const user = {
        id: 'user-123',
        credits: 100,
        membershipTier: 'premium',
        membershipExpiresAt: new Date(Date.now() - 86400000), // Yesterday
        createdAt: new Date(),
        updatedAt: new Date()
      };

      storage.getUserById = async () => user;

      const balance = await engine.queryBalance('user-123');

      // Balance should be returned regardless of membership status
      expect(balance).toBe(100);
    });
  });

  describe('Multiple queries', () => {
    it('should return consistent results for multiple queries', async () => {
      const user = {
        id: 'user-123',
        credits: 100,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      storage.getUserById = async () => user;

      // Execute multiple queries
      const balance1 = await engine.queryBalance('user-123');
      const balance2 = await engine.queryBalance('user-123');
      const balance3 = await engine.queryBalance('user-123');

      // All should return the same value
      expect(balance1).toBe(100);
      expect(balance2).toBe(100);
      expect(balance3).toBe(100);
    });

    it('should query different users independently', async () => {
      const user1 = {
        id: 'user-1',
        credits: 100,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const user2 = {
        id: 'user-2',
        credits: 200,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      storage.getUserById = async (userId) => {
        if (userId === 'user-1') return user1;
        if (userId === 'user-2') return user2;
        return null;
      };

      // Query different users
      const balance1 = await engine.queryBalance('user-1');
      const balance2 = await engine.queryBalance('user-2');

      // Each should return their own balance
      expect(balance1).toBe(100);
      expect(balance2).toBe(200);
    });
  });

  describe('Integration with other operations', () => {
    it('should reflect balance after charge operation', async () => {
      const user = {
        id: 'user-123',
        credits: 100,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      let currentBalance = 100;

      storage.getUserById = async () => ({ ...user, credits: currentBalance });
      storage.updateUserCredits = async (userId, amount) => {
        currentBalance += amount;
        return { ...user, credits: currentBalance };
      };
      storage.createTransaction = async () => ({
        id: 'txn-123',
        userId: 'user-123',
        action: 'generate-post',
        amount: -10,
        balanceBefore: 100,
        balanceAfter: 90,
        metadata: {},
        createdAt: new Date()
      });
      storage.createAuditLog = async () => ({
        id: 'audit-123',
        userId: 'user-123',
        action: 'charge',
        status: 'success' as const,
        metadata: {},
        createdAt: new Date()
      });

      // Query initial balance
      const initialBalance = await engine.queryBalance('user-123');
      expect(initialBalance).toBe(100);

      // Perform charge
      await engine.charge({
        userId: 'user-123',
        action: 'generate-post'
      });

      // Query balance after charge
      const finalBalance = await engine.queryBalance('user-123');
      expect(finalBalance).toBe(90);
    });

    it('should reflect balance after grant operation', async () => {
      const user = {
        id: 'user-123',
        credits: 100,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      let currentBalance = 100;

      storage.getUserById = async () => ({ ...user, credits: currentBalance });
      storage.updateUserCredits = async (userId, amount) => {
        currentBalance += amount;
        return { ...user, credits: currentBalance };
      };
      storage.createTransaction = async () => ({
        id: 'txn-123',
        userId: 'user-123',
        action: 'promotion-bonus',
        amount: 50,
        balanceBefore: 100,
        balanceAfter: 150,
        metadata: {},
        createdAt: new Date()
      });
      storage.createAuditLog = async () => ({
        id: 'audit-123',
        userId: 'user-123',
        action: 'grant',
        status: 'success' as const,
        metadata: {},
        createdAt: new Date()
      });

      // Query initial balance
      const initialBalance = await engine.queryBalance('user-123');
      expect(initialBalance).toBe(100);

      // Perform grant
      await engine.grant({
        userId: 'user-123',
        amount: 50,
        action: 'promotion-bonus'
      });

      // Query balance after grant
      const finalBalance = await engine.queryBalance('user-123');
      expect(finalBalance).toBe(150);
    });
  });
});


describe('CreditsEngine getHistory method', () => {
  let storage: MockStorageAdapter;
  let logger: MockLogger;
  let engine: CreditsEngine;

  beforeEach(() => {
    storage = new MockStorageAdapter();
    logger = new MockLogger();
    engine = new CreditsEngine({
      storage,
      config: validConfig,
      logger
    });
  });

  describe('Basic functionality', () => {
    it('should return transaction history for a user', async () => {
      const transactions = [
        {
          id: 'txn-1',
          userId: 'user-123',
          action: 'generate-post',
          amount: -10,
          balanceBefore: 100,
          balanceAfter: 90,
          metadata: {},
          createdAt: new Date('2024-01-03')
        },
        {
          id: 'txn-2',
          userId: 'user-123',
          action: 'generate-image',
          amount: -20,
          balanceBefore: 90,
          balanceAfter: 70,
          metadata: {},
          createdAt: new Date('2024-01-02')
        },
        {
          id: 'txn-3',
          userId: 'user-123',
          action: 'refund',
          amount: 10,
          balanceBefore: 70,
          balanceAfter: 80,
          metadata: {},
          createdAt: new Date('2024-01-01')
        }
      ];

      storage.getTransactions = async () => transactions;

      const result = await engine.getHistory('user-123');

      expect(result).toEqual(transactions);
      expect(result.length).toBe(3);
    });

    it('should return empty array when user has no transactions', async () => {
      storage.getTransactions = async () => [];

      const result = await engine.getHistory('user-123');

      expect(result).toEqual([]);
      expect(result.length).toBe(0);
    });
  });

  describe('Pagination', () => {
    it('should support limit parameter', async () => {
      let capturedOptions: any;

      storage.getTransactions = async (userId, options) => {
        capturedOptions = options;
        return [];
      };

      await engine.getHistory('user-123', { limit: 10 });

      expect(capturedOptions).toBeDefined();
      expect(capturedOptions.limit).toBe(10);
    });

    it('should support offset parameter', async () => {
      let capturedOptions: any;

      storage.getTransactions = async (userId, options) => {
        capturedOptions = options;
        return [];
      };

      await engine.getHistory('user-123', { offset: 20 });

      expect(capturedOptions).toBeDefined();
      expect(capturedOptions.offset).toBe(20);
    });

    it('should support both limit and offset for pagination', async () => {
      let capturedOptions: any;

      storage.getTransactions = async (userId, options) => {
        capturedOptions = options;
        return [];
      };

      await engine.getHistory('user-123', { limit: 50, offset: 100 });

      expect(capturedOptions).toBeDefined();
      expect(capturedOptions.limit).toBe(50);
      expect(capturedOptions.offset).toBe(100);
    });
  });

  describe('Date range filtering', () => {
    it('should support startDate filter', async () => {
      let capturedOptions: any;
      const startDate = new Date('2024-01-01');

      storage.getTransactions = async (userId, options) => {
        capturedOptions = options;
        return [];
      };

      await engine.getHistory('user-123', { startDate });

      expect(capturedOptions).toBeDefined();
      expect(capturedOptions.startDate).toEqual(startDate);
    });

    it('should support endDate filter', async () => {
      let capturedOptions: any;
      const endDate = new Date('2024-12-31');

      storage.getTransactions = async (userId, options) => {
        capturedOptions = options;
        return [];
      };

      await engine.getHistory('user-123', { endDate });

      expect(capturedOptions).toBeDefined();
      expect(capturedOptions.endDate).toEqual(endDate);
    });

    it('should support both startDate and endDate for date range', async () => {
      let capturedOptions: any;
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      storage.getTransactions = async (userId, options) => {
        capturedOptions = options;
        return [];
      };

      await engine.getHistory('user-123', { startDate, endDate });

      expect(capturedOptions).toBeDefined();
      expect(capturedOptions.startDate).toEqual(startDate);
      expect(capturedOptions.endDate).toEqual(endDate);
    });
  });

  describe('Action type filtering', () => {
    it('should support action filter', async () => {
      let capturedOptions: any;

      storage.getTransactions = async (userId, options) => {
        capturedOptions = options;
        return [];
      };

      await engine.getHistory('user-123', { action: 'generate-post' });

      expect(capturedOptions).toBeDefined();
      expect(capturedOptions.action).toBe('generate-post');
    });

    it('should filter transactions by action type', async () => {
      const allTransactions = [
        {
          id: 'txn-1',
          userId: 'user-123',
          action: 'generate-post',
          amount: -10,
          balanceBefore: 100,
          balanceAfter: 90,
          metadata: {},
          createdAt: new Date('2024-01-03')
        },
        {
          id: 'txn-2',
          userId: 'user-123',
          action: 'generate-image',
          amount: -20,
          balanceBefore: 90,
          balanceAfter: 70,
          metadata: {},
          createdAt: new Date('2024-01-02')
        }
      ];

      storage.getTransactions = async (userId, options) => {
        // Simulate filtering by action
        if (options?.action) {
          return allTransactions.filter(t => t.action === options.action);
        }
        return allTransactions;
      };

      const result = await engine.getHistory('user-123', { action: 'generate-post' });

      expect(result.length).toBe(1);
      expect(result[0].action).toBe('generate-post');
    });
  });

  describe('Combined filters', () => {
    it('should support combining all filter options', async () => {
      let capturedOptions: any;
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      storage.getTransactions = async (userId, options) => {
        capturedOptions = options;
        return [];
      };

      await engine.getHistory('user-123', {
        limit: 20,
        offset: 10,
        startDate,
        endDate,
        action: 'generate-post'
      });

      expect(capturedOptions).toBeDefined();
      expect(capturedOptions.limit).toBe(20);
      expect(capturedOptions.offset).toBe(10);
      expect(capturedOptions.startDate).toEqual(startDate);
      expect(capturedOptions.endDate).toEqual(endDate);
      expect(capturedOptions.action).toBe('generate-post');
    });
  });

  describe('Transaction context support', () => {
    it('should support transaction context', async () => {
      let capturedTxn: any;
      const mockTxn = { id: 'txn-context' };

      storage.getTransactions = async (userId, options, txn) => {
        capturedTxn = txn;
        return [];
      };

      await engine.getHistory('user-123', { txn: mockTxn });

      expect(capturedTxn).toEqual(mockTxn);
    });
  });

  describe('Descending order requirement', () => {
    it('should return transactions in descending timestamp order', async () => {
      const transactions = [
        {
          id: 'txn-1',
          userId: 'user-123',
          action: 'generate-post',
          amount: -10,
          balanceBefore: 100,
          balanceAfter: 90,
          metadata: {},
          createdAt: new Date('2024-01-03T10:00:00Z')
        },
        {
          id: 'txn-2',
          userId: 'user-123',
          action: 'generate-image',
          amount: -20,
          balanceBefore: 90,
          balanceAfter: 70,
          metadata: {},
          createdAt: new Date('2024-01-02T10:00:00Z')
        },
        {
          id: 'txn-3',
          userId: 'user-123',
          action: 'refund',
          amount: 10,
          balanceBefore: 70,
          balanceAfter: 80,
          metadata: {},
          createdAt: new Date('2024-01-01T10:00:00Z')
        }
      ];

      storage.getTransactions = async () => transactions;

      const result = await engine.getHistory('user-123');

      // Verify descending order (newest first)
      expect(result[0].createdAt.getTime()).toBeGreaterThan(result[1].createdAt.getTime());
      expect(result[1].createdAt.getTime()).toBeGreaterThan(result[2].createdAt.getTime());
    });
  });

  describe('Logging', () => {
    it('should log getHistory operation start and completion', async () => {
      storage.getTransactions = async () => [];

      await engine.getHistory('user-123', { limit: 10 });

      const infoLogs = logger.logs.filter(log => log.level === 'info');
      expect(infoLogs.some(log => log.message.includes('Starting getHistory'))).toBe(true);
      expect(infoLogs.some(log => log.message.includes('GetHistory operation completed'))).toBe(true);
    });

    it('should log error when operation fails', async () => {
      storage.getTransactions = async () => {
        throw new Error('Database error');
      };

      await expect(
        engine.getHistory('user-123')
      ).rejects.toThrow('Database error');

      const errorLogs = logger.logs.filter(log => log.level === 'error');
      expect(errorLogs.some(log => log.message.includes('GetHistory operation failed'))).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined options', async () => {
      storage.getTransactions = async () => [];

      const result = await engine.getHistory('user-123');

      expect(result).toEqual([]);
    });

    it('should handle empty options object', async () => {
      storage.getTransactions = async () => [];

      const result = await engine.getHistory('user-123', {});

      expect(result).toEqual([]);
    });

    it('should pass through storage adapter errors', async () => {
      storage.getTransactions = async () => {
        throw new Error('Storage error');
      };

      await expect(
        engine.getHistory('user-123')
      ).rejects.toThrow('Storage error');
    });
  });
});

describe('CreditsEngine validateAccess method', () => {
  let storage: MockStorageAdapter;
  let logger: MockLogger;
  let engine: CreditsEngine;

  beforeEach(() => {
    storage = new MockStorageAdapter();
    logger = new MockLogger();
    engine = new CreditsEngine({
      storage,
      config: validConfig,
      logger
    });
  });

  describe('Successful access validation', () => {
    it('should return true when user has sufficient membership tier', async () => {
      // Setup: User with premium membership
      storage.getUserById = async (userId: string) => ({
        id: userId,
        credits: 100,
        membershipTier: 'premium',
        membershipExpiresAt: new Date(Date.now() + 86400000), // Expires tomorrow
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const result = await engine.validateAccess('user-123', 'generate-image');

      expect(result).toBe(true);
      expect(logger.logs.some(log => 
        log.level === 'info' && log.message.includes('Access granted')
      )).toBe(true);
    });

    it('should return true when action requires no membership', async () => {
      // Setup: User with no membership
      storage.getUserById = async (userId: string) => ({
        id: userId,
        credits: 100,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // 'generate-post' requires no membership in validConfig
      const result = await engine.validateAccess('user-123', 'generate-post');

      expect(result).toBe(true);
      expect(logger.logs.some(log => 
        log.level === 'info' && log.message.includes('no membership required')
      )).toBe(true);
    });

    it('should return true when user has higher tier than required', async () => {
      // Setup: User with enterprise membership
      storage.getUserById = async (userId: string) => ({
        id: userId,
        credits: 100,
        membershipTier: 'enterprise',
        membershipExpiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // 'generate-image' requires premium, user has enterprise
      const result = await engine.validateAccess('user-123', 'generate-image');

      expect(result).toBe(true);
    });

    it('should log all validation steps', async () => {
      storage.getUserById = async (userId: string) => ({
        id: userId,
        credits: 100,
        membershipTier: 'premium',
        membershipExpiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await engine.validateAccess('user-123', 'generate-image');

      expect(logger.logs.some(log => log.message.includes('Validating access'))).toBe(true);
      expect(logger.logs.some(log => log.message.includes('Fetching user'))).toBe(true);
      expect(logger.logs.some(log => log.message.includes('Checking membership requirement'))).toBe(true);
      expect(logger.logs.some(log => log.message.includes('Access granted'))).toBe(true);
    });
  });

  describe('Error handling - User not found', () => {
    it('should throw UserNotFoundError when user does not exist', async () => {
      storage.getUserById = async () => null;
      storage.createAuditLog = async (log: any) => ({
        id: 'audit-1',
        ...log,
        createdAt: new Date()
      });

      await expect(
        engine.validateAccess('nonexistent-user', 'generate-image')
      ).rejects.toThrow('User nonexistent-user not found');
    });

    it('should log warning when user not found', async () => {
      storage.getUserById = async () => null;

      try {
        await engine.validateAccess('nonexistent-user', 'generate-image');
      } catch (error) {
        // Expected error
      }

      expect(logger.logs.some(log => 
        log.level === 'warn' && log.message.includes('User not found')
      )).toBe(true);
    });

    it('should create audit log when user not found', async () => {
      storage.getUserById = async () => null;
      const auditLogs: any[] = [];
      storage.createAuditLog = async (log: any) => {
        auditLogs.push(log);
        return { id: 'audit-1', ...log, createdAt: new Date() };
      };

      try {
        await engine.validateAccess('nonexistent-user', 'generate-image');
      } catch (error) {
        // Expected error
      }

      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].action).toBe('validateAccess');
      expect(auditLogs[0].status).toBe('failed');
      expect(auditLogs[0].userId).toBe('nonexistent-user');
    });
  });

  describe('Error handling - Membership required', () => {
    it('should throw MembershipRequiredError when user lacks required tier', async () => {
      // Setup: User with basic membership
      storage.getUserById = async (userId: string) => ({
        id: userId,
        credits: 100,
        membershipTier: 'basic',
        membershipExpiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      storage.createAuditLog = async (log: any) => ({
        id: 'audit-1',
        ...log,
        createdAt: new Date()
      });

      // 'generate-image' requires premium
      await expect(
        engine.validateAccess('user-123', 'generate-image')
      ).rejects.toThrow('User user-123 requires premium membership, but has basic');
    });

    it('should throw MembershipRequiredError when user has no membership', async () => {
      // Setup: User with no membership
      storage.getUserById = async (userId: string) => ({
        id: userId,
        credits: 100,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      storage.createAuditLog = async (log: any) => ({
        id: 'audit-1',
        ...log,
        createdAt: new Date()
      });

      // 'generate-image' requires premium
      await expect(
        engine.validateAccess('user-123', 'generate-image')
      ).rejects.toThrow('User user-123 requires premium membership, but has none');
    });

    it('should throw MembershipRequiredError when membership is expired', async () => {
      // Setup: User with expired premium membership
      storage.getUserById = async (userId: string) => ({
        id: userId,
        credits: 100,
        membershipTier: 'premium',
        membershipExpiresAt: new Date(Date.now() - 86400000), // Expired yesterday
        createdAt: new Date(),
        updatedAt: new Date()
      });
      storage.createAuditLog = async (log: any) => ({
        id: 'audit-1',
        ...log,
        createdAt: new Date()
      });

      // 'generate-image' requires premium
      await expect(
        engine.validateAccess('user-123', 'generate-image')
      ).rejects.toThrow('User user-123 requires premium membership, but has none');
    });

    it('should log warning when membership validation fails', async () => {
      storage.getUserById = async (userId: string) => ({
        id: userId,
        credits: 100,
        membershipTier: 'basic',
        membershipExpiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      try {
        await engine.validateAccess('user-123', 'generate-image');
      } catch (error) {
        // Expected error
      }

      expect(logger.logs.some(log => 
        log.level === 'warn' && log.message.includes('Access denied')
      )).toBe(true);
    });

    it('should create audit log when membership validation fails', async () => {
      storage.getUserById = async (userId: string) => ({
        id: userId,
        credits: 100,
        membershipTier: 'basic',
        membershipExpiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const auditLogs: any[] = [];
      storage.createAuditLog = async (log: any) => {
        auditLogs.push(log);
        return { id: 'audit-1', ...log, createdAt: new Date() };
      };

      try {
        await engine.validateAccess('user-123', 'generate-image');
      } catch (error) {
        // Expected error
      }

      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].action).toBe('validateAccess');
      expect(auditLogs[0].status).toBe('failed');
      expect(auditLogs[0].metadata.targetAction).toBe('generate-image');
    });
  });

  describe('Transaction context support', () => {
    it('should pass transaction context to storage operations', async () => {
      const txn = { id: 'txn-123' };
      let capturedTxn: any;

      storage.getUserById = async (userId: string, txnParam?: any) => {
        capturedTxn = txnParam;
        return {
          id: userId,
          credits: 100,
          membershipTier: 'premium',
          membershipExpiresAt: new Date(Date.now() + 86400000),
          createdAt: new Date(),
          updatedAt: new Date()
        };
      };

      await engine.validateAccess('user-123', 'generate-image', txn);

      expect(capturedTxn).toBe(txn);
    });

    it('should pass transaction context to audit log', async () => {
      const txn = { id: 'txn-123' };
      let capturedTxn: any;

      storage.getUserById = async () => null;
      storage.createAuditLog = async (log: any, txnParam?: any) => {
        capturedTxn = txnParam;
        return { id: 'audit-1', ...log, createdAt: new Date() };
      };

      try {
        await engine.validateAccess('user-123', 'generate-image', txn);
      } catch (error) {
        // Expected error
      }

      expect(capturedTxn).toBe(txn);
    });
  });

  describe('Audit logging', () => {
    it('should not create audit log when audit is disabled', async () => {
      const disabledAuditConfig = {
        ...validConfig,
        audit: { enabled: false }
      };

      const engineWithDisabledAudit = new CreditsEngine({
        storage,
        config: disabledAuditConfig,
        logger
      });

      storage.getUserById = async () => null;
      
      let auditLogCalled = false;
      storage.createAuditLog = async () => {
        auditLogCalled = true;
        return { id: 'audit-1', userId: 'user-123', action: 'validateAccess', status: 'failed', metadata: {}, createdAt: new Date() };
      };

      try {
        await engineWithDisabledAudit.validateAccess('user-123', 'generate-image');
      } catch (error) {
        // Expected error
      }

      expect(auditLogCalled).toBe(false);
    });

    it('should include error details in audit log', async () => {
      storage.getUserById = async (userId: string) => ({
        id: userId,
        credits: 100,
        membershipTier: 'basic',
        membershipExpiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const auditLogs: any[] = [];
      storage.createAuditLog = async (log: any) => {
        auditLogs.push(log);
        return { id: 'audit-1', ...log, createdAt: new Date() };
      };

      try {
        await engine.validateAccess('user-123', 'generate-image');
      } catch (error) {
        // Expected error
      }

      expect(auditLogs[0].errorMessage).toContain('requires premium membership');
      expect(auditLogs[0].metadata.error).toContain('requires premium membership');
    });
  });

  describe('Edge cases', () => {
    it('should handle action not in requirements config', async () => {
      storage.getUserById = async (userId: string) => ({
        id: userId,
        credits: 100,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Action not in config should default to no membership required
      const result = await engine.validateAccess('user-123', 'unknown-action');

      expect(result).toBe(true);
    });

    it('should handle user with permanent membership (null expiresAt)', async () => {
      storage.getUserById = async (userId: string) => ({
        id: userId,
        credits: 100,
        membershipTier: 'premium',
        membershipExpiresAt: null, // Permanent membership
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const result = await engine.validateAccess('user-123', 'generate-image');

      expect(result).toBe(true);
    });

    it('should handle exact tier match', async () => {
      storage.getUserById = async (userId: string) => ({
        id: userId,
        credits: 100,
        membershipTier: 'premium',
        membershipExpiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // User has exactly the required tier
      const result = await engine.validateAccess('user-123', 'generate-image');

      expect(result).toBe(true);
    });

    it('should handle membership expiring at exact current time', async () => {
      storage.getUserById = async (userId: string) => ({
        id: userId,
        credits: 100,
        membershipTier: 'premium',
        membershipExpiresAt: new Date(Date.now() - 1), // Just expired
        createdAt: new Date(),
        updatedAt: new Date()
      });
      storage.createAuditLog = async (log: any) => ({
        id: 'audit-1',
        ...log,
        createdAt: new Date()
      });

      await expect(
        engine.validateAccess('user-123', 'generate-image')
      ).rejects.toThrow('requires premium membership');
    });
  });

  describe('Logging', () => {
    it('should log user details during validation', async () => {
      storage.getUserById = async (userId: string) => ({
        id: userId,
        credits: 100,
        membershipTier: 'premium',
        membershipExpiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await engine.validateAccess('user-123', 'generate-image');

      expect(logger.logs.some(log => 
        log.level === 'debug' && 
        log.message.includes('User found') &&
        log.context?.membershipTier === 'premium'
      )).toBe(true);
    });

    it('should log membership requirement check', async () => {
      storage.getUserById = async (userId: string) => ({
        id: userId,
        credits: 100,
        membershipTier: 'premium',
        membershipExpiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await engine.validateAccess('user-123', 'generate-image');

      expect(logger.logs.some(log => 
        log.level === 'debug' && 
        log.message.includes('Checking membership requirement') &&
        log.context?.requiredTier === 'premium'
      )).toBe(true);
    });

    it('should log validation result details', async () => {
      storage.getUserById = async (userId: string) => ({
        id: userId,
        credits: 100,
        membershipTier: 'basic',
        membershipExpiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      try {
        await engine.validateAccess('user-123', 'generate-image');
      } catch (error) {
        // Expected error
      }

      expect(logger.logs.some(log => 
        log.level === 'warn' && 
        log.message.includes('Access denied') &&
        log.context?.reason
      )).toBe(true);
    });
  });
});

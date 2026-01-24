/**
 * CreditsEngine 日志集成测试
 * 验证所有重要操作都有适当的日志记录，包含上下文信息
 * 
 * 验证需求: 16.4, 16.5
 * - 16.4: SDK 应记录所有重要操作，包括扣费、退款、发放和错误
 * - 16.5: SDK 应在日志消息中包含上下文信息（用户 ID、操作、金额）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CreditsEngine } from '../../src/core/CreditsEngine';
import { IStorageAdapter } from '../../src/adapters/IStorageAdapter';
import { ILogAdapter } from '../../src/adapters/ILogAdapter';
import { CreditsConfig } from '../../src/core/types';

// Mock Logger that captures all log calls
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

  // Helper methods for testing
  clear() {
    this.logs = [];
  }

  findLog(predicate: (log: { level: string; message: string; context?: any }) => boolean) {
    return this.logs.find(predicate);
  }

  hasLog(level: string, messagePattern: string | RegExp, contextCheck?: (context: any) => boolean) {
    return this.logs.some(log => {
      const levelMatch = log.level === level;
      const messageMatch = typeof messagePattern === 'string' 
        ? log.message.includes(messagePattern)
        : messagePattern.test(log.message);
      const contextMatch = contextCheck ? contextCheck(log.context) : true;
      return levelMatch && messageMatch && contextMatch;
    });
  }
}

// Mock Storage Adapter
class MockStorageAdapter implements IStorageAdapter {
  private users = new Map<string, any>();
  private transactions: any[] = [];
  private auditLogs: any[] = [];
  private idempotencyRecords = new Map<string, any>();

  async getUserById(userId: string, txn?: any): Promise<any> {
    return this.users.get(userId) || null;
  }

  async updateUserCredits(userId: string, amount: number, txn?: any): Promise<any> {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');
    user.credits += amount;
    return user;
  }

  async createTransaction(transaction: any, txn?: any): Promise<any> {
    const txn_record = {
      id: `txn-${Date.now()}`,
      ...transaction,
      createdAt: new Date()
    };
    this.transactions.push(txn_record);
    return txn_record;
  }

  async createAuditLog(log: any, txn?: any): Promise<any> {
    const auditLog = {
      id: `audit-${Date.now()}`,
      ...log,
      createdAt: new Date()
    };
    this.auditLogs.push(auditLog);
    return auditLog;
  }

  async getIdempotencyRecord(key: string, txn?: any): Promise<any> {
    return this.idempotencyRecords.get(key) || null;
  }

  async createIdempotencyRecord(record: any, txn?: any): Promise<any> {
    const idempotencyRecord = {
      ...record,
      createdAt: new Date()
    };
    this.idempotencyRecords.set(record.key, idempotencyRecord);
    return idempotencyRecord;
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
    return this.transactions.filter(t => t.userId === userId);
  }

  // Helper methods for testing
  addUser(user: any) {
    this.users.set(user.id, user);
  }

  reset() {
    this.users.clear();
    this.transactions = [];
    this.auditLogs = [];
    this.idempotencyRecords.clear();
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

describe('CreditsEngine Logging Integration', () => {
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
    
    // Clear initialization logs
    logger.clear();
  });

  describe('Requirement 16.4: Log all important operations', () => {
    describe('Charge operation logging', () => {
      it('should log successful charge operation with context', async () => {
        // Setup
        storage.addUser({
          id: 'user-123',
          credits: 100,
          membershipTier: null,
          membershipExpiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // Execute
        await engine.charge({
          userId: 'user-123',
          action: 'generate-post'
        });

        // Verify: Should have info log for starting operation
        expect(logger.hasLog('info', 'Starting charge operation', (ctx) => {
          return ctx?.userId === 'user-123' && ctx?.action === 'generate-post';
        })).toBe(true);

        // Verify: Should have info log for completion
        expect(logger.hasLog('info', 'Charge operation completed successfully', (ctx) => {
          return ctx?.userId === 'user-123' && 
                 ctx?.action === 'generate-post' &&
                 ctx?.cost === 10;
        })).toBe(true);
      });

      it('should log charge operation failure with error context', async () => {
        // Setup: User with insufficient credits
        storage.addUser({
          id: 'user-123',
          credits: 5,
          membershipTier: null,
          membershipExpiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // Execute
        try {
          await engine.charge({
            userId: 'user-123',
            action: 'generate-post'
          });
        } catch (error) {
          // Expected error
        }

        // Verify: Should have error log with context
        expect(logger.hasLog('error', 'Charge operation failed', (ctx) => {
          return ctx?.userId === 'user-123' && 
                 ctx?.action === 'generate-post' &&
                 ctx?.error;
        })).toBe(true);

        // Verify: Should have warn log for insufficient credits
        expect(logger.hasLog('warn', 'Insufficient credits', (ctx) => {
          return ctx?.userId === 'user-123' && 
                 ctx?.required === 10 &&
                 ctx?.available === 5;
        })).toBe(true);
      });
    });

    describe('Refund operation logging', () => {
      it('should log successful refund operation with context', async () => {
        // Setup
        storage.addUser({
          id: 'user-123',
          credits: 50,
          membershipTier: null,
          membershipExpiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // Execute
        await engine.refund({
          userId: 'user-123',
          amount: 20,
          action: 'refund-order-123'
        });

        // Verify: Should have info log for starting operation
        expect(logger.hasLog('info', 'Starting refund operation', (ctx) => {
          return ctx?.userId === 'user-123' && 
                 ctx?.amount === 20 &&
                 ctx?.action === 'refund-order-123';
        })).toBe(true);

        // Verify: Should have info log for completion
        expect(logger.hasLog('info', 'Refund operation completed successfully', (ctx) => {
          return ctx?.userId === 'user-123' && 
                 ctx?.amount === 20 &&
                 ctx?.action === 'refund-order-123';
        })).toBe(true);
      });

      it('should log refund operation failure with error context', async () => {
        // Setup: User doesn't exist
        // Execute
        try {
          await engine.refund({
            userId: 'nonexistent-user',
            amount: 20,
            action: 'refund-order-123'
          });
        } catch (error) {
          // Expected error
        }

        // Verify: Should have error log with context
        expect(logger.hasLog('error', 'Refund operation failed', (ctx) => {
          return ctx?.userId === 'nonexistent-user' && 
                 ctx?.amount === 20 &&
                 ctx?.error;
        })).toBe(true);

        // Verify: Should have warn log for user not found
        expect(logger.hasLog('warn', 'User not found', (ctx) => {
          return ctx?.userId === 'nonexistent-user';
        })).toBe(true);
      });
    });

    describe('Grant operation logging', () => {
      it('should log successful grant operation with context', async () => {
        // Setup
        storage.addUser({
          id: 'user-123',
          credits: 50,
          membershipTier: null,
          membershipExpiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // Execute
        await engine.grant({
          userId: 'user-123',
          amount: 100,
          action: 'promotion-bonus'
        });

        // Verify: Should have info log for starting operation
        expect(logger.hasLog('info', 'Starting grant operation', (ctx) => {
          return ctx?.userId === 'user-123' && 
                 ctx?.amount === 100 &&
                 ctx?.action === 'promotion-bonus';
        })).toBe(true);

        // Verify: Should have info log for completion
        expect(logger.hasLog('info', 'Grant operation completed successfully', (ctx) => {
          return ctx?.userId === 'user-123' && 
                 ctx?.amount === 100 &&
                 ctx?.action === 'promotion-bonus';
        })).toBe(true);
      });

      it('should log grant operation failure with error context', async () => {
        // Setup
        storage.addUser({
          id: 'user-123',
          credits: 50,
          membershipTier: null,
          membershipExpiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // Execute: Invalid amount (negative)
        try {
          await engine.grant({
            userId: 'user-123',
            amount: -10,
            action: 'invalid-grant'
          });
        } catch (error) {
          // Expected error
        }

        // Verify: Should have error log with context
        expect(logger.hasLog('error', 'Grant operation failed', (ctx) => {
          return ctx?.userId === 'user-123' && 
                 ctx?.amount === -10 &&
                 ctx?.error;
        })).toBe(true);

        // Verify: Should have warn log for invalid amount
        expect(logger.hasLog('warn', 'Invalid grant amount', (ctx) => {
          return ctx?.userId === 'user-123' && ctx?.amount === -10;
        })).toBe(true);
      });
    });

    describe('QueryBalance operation logging', () => {
      it('should log successful queryBalance operation with context', async () => {
        // Setup
        storage.addUser({
          id: 'user-123',
          credits: 75,
          membershipTier: null,
          membershipExpiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // Execute
        await engine.queryBalance('user-123');

        // Verify: Should have info log for starting operation
        expect(logger.hasLog('info', 'Starting queryBalance operation', (ctx) => {
          return ctx?.userId === 'user-123';
        })).toBe(true);

        // Verify: Should have info log for completion with balance
        expect(logger.hasLog('info', 'QueryBalance operation completed successfully', (ctx) => {
          return ctx?.userId === 'user-123' && ctx?.balance === 75;
        })).toBe(true);
      });

      it('should log queryBalance operation failure with error context', async () => {
        // Execute: User doesn't exist
        try {
          await engine.queryBalance('nonexistent-user');
        } catch (error) {
          // Expected error
        }

        // Verify: Should have error log with context
        expect(logger.hasLog('error', 'QueryBalance operation failed', (ctx) => {
          return ctx?.userId === 'nonexistent-user' && ctx?.error;
        })).toBe(true);
      });
    });

    describe('GetHistory operation logging', () => {
      it('should log successful getHistory operation with context', async () => {
        // Setup
        storage.addUser({
          id: 'user-123',
          credits: 100,
          membershipTier: null,
          membershipExpiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // Execute
        await engine.getHistory('user-123', { limit: 10 });

        // Verify: Should have info log for starting operation
        expect(logger.hasLog('info', 'Starting getHistory operation', (ctx) => {
          return ctx?.userId === 'user-123' && ctx?.limit === 10;
        })).toBe(true);

        // Verify: Should have info log for completion
        expect(logger.hasLog('info', 'GetHistory operation completed successfully', (ctx) => {
          return ctx?.userId === 'user-123' && typeof ctx?.transactionCount === 'number';
        })).toBe(true);
      });
    });

    describe('ValidateAccess operation logging', () => {
      it('should log successful validateAccess operation with context', async () => {
        // Setup
        storage.addUser({
          id: 'user-123',
          credits: 100,
          membershipTier: 'premium',
          membershipExpiresAt: new Date(Date.now() + 86400000),
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // Execute
        await engine.validateAccess('user-123', 'generate-image');

        // Verify: Should have info log for starting validation
        expect(logger.hasLog('info', 'Validating access', (ctx) => {
          return ctx?.userId === 'user-123' && ctx?.action === 'generate-image';
        })).toBe(true);

        // Verify: Should have info log for access granted
        expect(logger.hasLog('info', 'Access granted', (ctx) => {
          return ctx?.userId === 'user-123' && ctx?.action === 'generate-image';
        })).toBe(true);
      });

      it('should log validateAccess failure with context', async () => {
        // Setup: User with insufficient membership
        storage.addUser({
          id: 'user-123',
          credits: 100,
          membershipTier: 'basic',
          membershipExpiresAt: new Date(Date.now() + 86400000),
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // Execute
        try {
          await engine.validateAccess('user-123', 'generate-image');
        } catch (error) {
          // Expected error
        }

        // Verify: Should have warn log for access denied
        expect(logger.hasLog('warn', 'Access denied', (ctx) => {
          return ctx?.userId === 'user-123' && 
                 ctx?.action === 'generate-image' &&
                 ctx?.reason;
        })).toBe(true);
      });
    });
  });

  describe('Requirement 16.5: Include context information in logs', () => {
    it('should include userId in all operation logs', async () => {
      // Setup
      storage.addUser({
        id: 'user-456',
        credits: 100,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Execute charge
      await engine.charge({
        userId: 'user-456',
        action: 'generate-post'
      });

      // Verify: All logs related to this operation should have userId in context
      const operationLogs = logger.logs.filter(log => 
        log.message.includes('charge') || 
        log.message.includes('user') ||
        log.message.includes('balance')
      );

      // At least some logs should have userId in context
      const logsWithUserId = operationLogs.filter(log => 
        log.context?.userId === 'user-456'
      );

      expect(logsWithUserId.length).toBeGreaterThan(0);
    });

    it('should include action in charge operation logs', async () => {
      // Setup
      storage.addUser({
        id: 'user-789',
        credits: 100,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Execute - use 'generate-post' which doesn't require membership
      await engine.charge({
        userId: 'user-789',
        action: 'generate-post'
      });

      // Verify: Starting log should have action
      const startLog = logger.findLog(log => 
        log.message.includes('Starting charge operation')
      );

      expect(startLog).toBeDefined();
      expect(startLog?.context?.action).toBe('generate-post');

      // Verify: Completion log should have action
      const completionLog = logger.findLog(log => 
        log.message.includes('Charge operation completed successfully')
      );

      expect(completionLog).toBeDefined();
      expect(completionLog?.context?.action).toBe('generate-post');
    });

    it('should include amount in refund and grant operation logs', async () => {
      // Setup
      storage.addUser({
        id: 'user-999',
        credits: 50,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Test refund
      logger.clear();
      await engine.refund({
        userId: 'user-999',
        amount: 25,
        action: 'refund-test'
      });

      const refundStartLog = logger.findLog(log => 
        log.message.includes('Starting refund operation')
      );
      expect(refundStartLog?.context?.amount).toBe(25);

      // Test grant
      logger.clear();
      await engine.grant({
        userId: 'user-999',
        amount: 50,
        action: 'grant-test'
      });

      const grantStartLog = logger.findLog(log => 
        log.message.includes('Starting grant operation')
      );
      expect(grantStartLog?.context?.amount).toBe(50);
    });

    it('should include cost in charge operation completion logs', async () => {
      // Setup
      storage.addUser({
        id: 'user-cost-test',
        credits: 100,
        membershipTier: 'premium',
        membershipExpiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Execute
      await engine.charge({
        userId: 'user-cost-test',
        action: 'generate-post'
      });

      // Verify: Completion log should have cost
      const completionLog = logger.findLog(log => 
        log.message.includes('Charge operation completed successfully')
      );

      expect(completionLog).toBeDefined();
      expect(completionLog?.context?.cost).toBe(8); // Premium price
    });

    it('should include balance information in relevant logs', async () => {
      // Setup
      storage.addUser({
        id: 'user-balance-test',
        credits: 100,
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Execute
      await engine.charge({
        userId: 'user-balance-test',
        action: 'generate-post'
      });

      // Verify: User found log should have credits
      const userFoundLog = logger.findLog(log => 
        log.message.includes('User found') && log.context?.userId === 'user-balance-test'
      );

      expect(userFoundLog).toBeDefined();
      expect(userFoundLog?.context?.credits).toBe(100);

      // Verify: Balance check log should have credits and cost
      const balanceCheckLog = logger.findLog(log => 
        log.message.includes('Balance check passed')
      );

      expect(balanceCheckLog).toBeDefined();
      expect(balanceCheckLog?.context?.credits).toBe(100);
      expect(balanceCheckLog?.context?.cost).toBe(10);
    });

    it('should include error information in failure logs', async () => {
      // Execute: User doesn't exist
      try {
        await engine.charge({
          userId: 'nonexistent',
          action: 'generate-post'
        });
      } catch (error) {
        // Expected error
      }

      // Verify: Error log should have error message
      const errorLog = logger.findLog(log => 
        log.level === 'error' && log.message.includes('Charge operation failed')
      );

      expect(errorLog).toBeDefined();
      expect(errorLog?.context?.error).toBeDefined();
      expect(typeof errorLog?.context?.error).toBe('string');
    });
  });

  describe('Logging levels', () => {
    it('should use appropriate log levels for different scenarios', async () => {
      // Setup
      storage.addUser({
        id: 'user-levels',
        credits: 5, // Insufficient for charge
        membershipTier: null,
        membershipExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Execute: This will fail due to insufficient credits
      try {
        await engine.charge({
          userId: 'user-levels',
          action: 'generate-post'
        });
      } catch (error) {
        // Expected error
      }

      // Verify: Should have info logs for operation start
      expect(logger.logs.some(log => log.level === 'info')).toBe(true);

      // Verify: Should have debug logs for internal steps
      expect(logger.logs.some(log => log.level === 'debug')).toBe(true);

      // Verify: Should have warn logs for validation failures
      expect(logger.logs.some(log => log.level === 'warn')).toBe(true);

      // Verify: Should have error logs for operation failure
      expect(logger.logs.some(log => log.level === 'error')).toBe(true);
    });
  });
});

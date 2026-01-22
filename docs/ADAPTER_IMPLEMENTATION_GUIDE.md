# Storage Adapter Implementation Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Understanding the IStorageAdapter Interface](#understanding-the-istorageadapter-interface)
3. [Step-by-Step Implementation Guide](#step-by-step-implementation-guide)
4. [Transaction Handling](#transaction-handling)
5. [Error Handling](#error-handling)
6. [Testing Your Adapter](#testing-your-adapter)
7. [Best Practices](#best-practices)
8. [Common Pitfalls](#common-pitfalls)
9. [Database-Specific Examples](#database-specific-examples)

---

## Introduction

The credit-sdk uses an adapter pattern to decouple the core business logic from specific database implementations. This allows you to integrate the SDK with any database system (SQL, NoSQL, or even custom storage solutions) without being locked into a specific ORM.

### What is a Storage Adapter?

A storage adapter is a class that implements the `IStorageAdapter` interface, providing the SDK with methods to:
- Read and update user data
- Create transaction records
- Create audit logs
- Manage idempotency records
- Query transaction history

### Why Implement a Custom Adapter?

You might want to implement a custom adapter if:
- You're using a database system other than Prisma
- You have existing database infrastructure you want to integrate with
- You need custom data transformation or validation logic
- You want to add caching, monitoring, or other middleware

---

## Understanding the IStorageAdapter Interface

The `IStorageAdapter` interface defines 6 core methods that your adapter must implement:

```typescript
interface IStorageAdapter {
  getUserById(userId: string, txn?: any): Promise<User | null>;
  updateUserCredits(userId: string, amount: number, txn?: any): Promise<User>;
  createTransaction(transaction: TransactionInput, txn?: any): Promise<Transaction>;
  createAuditLog(log: AuditLogInput, txn?: any): Promise<AuditLog>;
  getIdempotencyRecord(key: string, txn?: any): Promise<IdempotencyRecord | null>;
  createIdempotencyRecord(record: IdempotencyRecordInput, txn?: any): Promise<IdempotencyRecord>;
  getTransactions(userId: string, options?: {...}, txn?: any): Promise<Transaction[]>;
}
```

### Key Concepts

1. **Transaction Context (`txn`)**: All methods accept an optional transaction context parameter
2. **Type Safety**: All inputs and outputs use strongly-typed TypeScript interfaces
3. **Null Handling**: Methods that query data return `null` when records don't exist
4. **Error Propagation**: Methods should throw appropriate errors when operations fail


---

## Step-by-Step Implementation Guide

### Step 1: Set Up Your Project Structure

Create a new file for your adapter:

```
src/adapters/
├── IStorageAdapter.ts       # Interface definition (provided by SDK)
├── PrismaAdapter.ts          # Reference implementation
├── MockAdapter.ts            # Test implementation
└── YourCustomAdapter.ts      # Your implementation
```

### Step 2: Import Required Types

```typescript
import { IStorageAdapter } from './IStorageAdapter';
import {
  User,
  Transaction,
  TransactionInput,
  AuditLog,
  AuditLogInput,
  IdempotencyRecord,
  IdempotencyRecordInput
} from '../core/types';
import { UserNotFoundError } from '../core/errors';
```

### Step 3: Create Your Adapter Class

```typescript
export class YourCustomAdapter implements IStorageAdapter {
  constructor(private dbClient: YourDatabaseClient) {
    // Initialize your database client
  }

  // Implement all required methods...
}
```

### Step 4: Implement getUserById

This method retrieves a user by their ID.

**Requirements:**
- Return `null` if the user doesn't exist (don't throw an error)
- Support transaction context if provided
- Map your database model to the SDK's `User` type

**Example Implementation:**

```typescript
async getUserById(userId: string, txn?: any): Promise<User | null> {
  const client = this.getClient(txn);
  
  try {
    const user = await client.users.findOne({ id: userId });
    
    if (!user) {
      return null;
    }
    
    // Map your database model to SDK User type
    return {
      id: user.id,
      credits: user.credits,
      membershipTier: user.membershipTier,
      membershipExpiresAt: user.membershipExpiresAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  } catch (error) {
    throw this.handleDatabaseError(error, 'getUserById');
  }
}
```

**Common Mistakes:**
- ❌ Throwing an error when user doesn't exist
- ❌ Not handling the transaction context
- ❌ Returning database-specific types instead of SDK types


### Step 5: Implement updateUserCredits

This method updates a user's credit balance by a specified amount.

**Requirements:**
- Throw `UserNotFoundError` if the user doesn't exist
- Support both positive (add) and negative (subtract) amounts
- Use atomic operations to prevent race conditions
- Return the updated user object

**Example Implementation:**

```typescript
async updateUserCredits(userId: string, amount: number, txn?: any): Promise<User> {
  const client = this.getClient(txn);
  
  try {
    // Use atomic increment/decrement operation
    const user = await client.users.updateOne(
      { id: userId },
      { $inc: { credits: amount } },
      { returnDocument: 'after' }
    );
    
    if (!user) {
      throw new UserNotFoundError(userId);
    }
    
    return {
      id: user.id,
      credits: user.credits,
      membershipTier: user.membershipTier,
      membershipExpiresAt: user.membershipExpiresAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      throw error;
    }
    throw this.handleDatabaseError(error, 'updateUserCredits');
  }
}
```

**Important Notes:**
- Use atomic operations (`$inc`, `INCREMENT`, etc.) to avoid race conditions
- Don't read-then-write; use database-level atomic updates
- Always throw `UserNotFoundError` for missing users

### Step 6: Implement createTransaction

This method creates a transaction record.

**Requirements:**
- Generate a unique ID for the transaction
- Set the `createdAt` timestamp
- Store metadata as a JSON object
- Return the created transaction with all fields

**Example Implementation:**

```typescript
async createTransaction(transaction: TransactionInput, txn?: any): Promise<Transaction> {
  const client = this.getClient(txn);
  
  try {
    const created = await client.transactions.insertOne({
      id: this.generateId(), // or let database generate
      userId: transaction.userId,
      action: transaction.action,
      amount: transaction.amount,
      balanceBefore: transaction.balanceBefore,
      balanceAfter: transaction.balanceAfter,
      metadata: transaction.metadata || {},
      createdAt: new Date()
    });
    
    return {
      id: created.id,
      userId: created.userId,
      action: created.action,
      amount: created.amount,
      balanceBefore: created.balanceBefore,
      balanceAfter: created.balanceAfter,
      metadata: created.metadata,
      createdAt: created.createdAt
    };
  } catch (error) {
    throw this.handleDatabaseError(error, 'createTransaction');
  }
}
```


### Step 7: Implement createAuditLog

This method creates an audit log entry.

**Requirements:**
- Generate a unique ID
- Set the `createdAt` timestamp
- Handle optional `errorMessage` field
- Store metadata as JSON

**Example Implementation:**

```typescript
async createAuditLog(log: AuditLogInput, txn?: any): Promise<AuditLog> {
  const client = this.getClient(txn);
  
  try {
    const created = await client.auditLogs.insertOne({
      id: this.generateId(),
      userId: log.userId,
      action: log.action,
      status: log.status,
      metadata: log.metadata || {},
      errorMessage: log.errorMessage || null,
      createdAt: new Date()
    });
    
    return {
      id: created.id,
      userId: created.userId,
      action: created.action,
      status: created.status,
      metadata: created.metadata,
      errorMessage: created.errorMessage || undefined,
      createdAt: created.createdAt
    };
  } catch (error) {
    throw this.handleDatabaseError(error, 'createAuditLog');
  }
}
```

### Step 8: Implement Idempotency Methods

These methods manage idempotency records to prevent duplicate operations.

**getIdempotencyRecord Requirements:**
- Return `null` if record doesn't exist
- Return `null` if record is expired
- Optionally clean up expired records

**Example Implementation:**

```typescript
async getIdempotencyRecord(key: string, txn?: any): Promise<IdempotencyRecord | null> {
  const client = this.getClient(txn);
  
  try {
    const record = await client.idempotencyRecords.findOne({ key });
    
    if (!record) {
      return null;
    }
    
    // Check if expired
    if (record.expiresAt < new Date()) {
      // Optional: delete expired record
      await client.idempotencyRecords.deleteOne({ key });
      return null;
    }
    
    return {
      key: record.key,
      result: record.result,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt
    };
  } catch (error) {
    throw this.handleDatabaseError(error, 'getIdempotencyRecord');
  }
}

async createIdempotencyRecord(record: IdempotencyRecordInput, txn?: any): Promise<IdempotencyRecord> {
  const client = this.getClient(txn);
  
  try {
    const created = await client.idempotencyRecords.insertOne({
      key: record.key,
      result: record.result,
      createdAt: new Date(),
      expiresAt: record.expiresAt
    });
    
    return {
      key: created.key,
      result: created.result,
      createdAt: created.createdAt,
      expiresAt: created.expiresAt
    };
  } catch (error) {
    throw this.handleDatabaseError(error, 'createIdempotencyRecord');
  }
}
```


### Step 9: Implement getTransactions

This method queries transaction history with filtering and pagination.

**Requirements:**
- Filter by userId
- Sort by createdAt in descending order (newest first)
- Support pagination (limit, offset)
- Support date range filtering (startDate, endDate)
- Support action type filtering

**Example Implementation:**

```typescript
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
): Promise<Transaction[]> {
  const client = this.getClient(txn);
  
  try {
    // Build query filter
    const filter: any = { userId };
    
    // Add date range filter
    if (options?.startDate || options?.endDate) {
      filter.createdAt = {};
      if (options.startDate) {
        filter.createdAt.$gte = options.startDate;
      }
      if (options.endDate) {
        filter.createdAt.$lte = options.endDate;
      }
    }
    
    // Add action filter
    if (options?.action) {
      filter.action = options.action;
    }
    
    // Execute query with sorting and pagination
    const transactions = await client.transactions
      .find(filter)
      .sort({ createdAt: -1 }) // Descending order
      .skip(options?.offset || 0)
      .limit(options?.limit || 100)
      .toArray();
    
    // Map to SDK Transaction type
    return transactions.map(t => ({
      id: t.id,
      userId: t.userId,
      action: t.action,
      amount: t.amount,
      balanceBefore: t.balanceBefore,
      balanceAfter: t.balanceAfter,
      metadata: t.metadata,
      createdAt: t.createdAt
    }));
  } catch (error) {
    throw this.handleDatabaseError(error, 'getTransactions');
  }
}
```

**Important Notes:**
- Always sort by `createdAt` in descending order
- Apply filters before pagination
- Set a reasonable default limit to prevent large queries


---

## Transaction Handling

Transaction support is critical for maintaining data consistency. The SDK passes an optional `txn` parameter to all adapter methods.

### Understanding Transaction Context

The `txn` parameter is intentionally typed as `any` because different databases have different transaction types:
- Prisma: `Prisma.TransactionClient`
- MongoDB: `ClientSession`
- PostgreSQL: `PoolClient`
- MySQL: `Connection`

### Implementing Transaction Support

**Pattern 1: Helper Method (Recommended)**

```typescript
export class YourAdapter implements IStorageAdapter {
  constructor(private dbClient: YourDatabaseClient) {}
  
  /**
   * Get the appropriate database client
   * If transaction context is provided, use it; otherwise use default client
   */
  private getClient(txn?: any): YourDatabaseClient {
    return txn || this.dbClient;
  }
  
  async getUserById(userId: string, txn?: any): Promise<User | null> {
    const client = this.getClient(txn);
    // Use client for all operations...
  }
}
```

**Pattern 2: Conditional Logic**

```typescript
async updateUserCredits(userId: string, amount: number, txn?: any): Promise<User> {
  if (txn) {
    // Use transaction client
    return await txn.users.update({ id: userId }, { $inc: { credits: amount } });
  } else {
    // Use default client
    return await this.dbClient.users.update({ id: userId }, { $inc: { credits: amount } });
  }
}
```

### Transaction Usage Example

Here's how the SDK uses transactions:

```typescript
// Without transaction (auto-commit)
const result = await engine.charge({
  userId: 'user-123',
  action: 'generate-post'
});

// With transaction (manual control)
await prisma.$transaction(async (txn) => {
  // All operations use the same transaction
  const result = await engine.charge({
    userId: 'user-123',
    action: 'generate-post',
    txn
  });
  
  // Other operations in the same transaction
  await someOtherOperation(txn);
});
```

### Testing Transaction Behavior

```typescript
describe('Transaction Support', () => {
  it('should execute all operations in the same transaction', async () => {
    const adapter = new YourAdapter(dbClient);
    
    await dbClient.startTransaction(async (txn) => {
      // Get user
      const user = await adapter.getUserById('user-123', txn);
      
      // Update credits
      await adapter.updateUserCredits('user-123', -10, txn);
      
      // Create transaction record
      await adapter.createTransaction({
        userId: 'user-123',
        action: 'test',
        amount: -10,
        balanceBefore: user!.credits,
        balanceAfter: user!.credits - 10
      }, txn);
      
      // All operations should be in the same transaction
    });
  });
});
```


---

## Error Handling

Proper error handling is essential for a robust adapter implementation.

### Error Handling Strategy

1. **Preserve SDK Errors**: If an error is already a SDK error (like `UserNotFoundError`), re-throw it
2. **Convert Database Errors**: Transform database-specific errors into meaningful SDK errors
3. **Add Context**: Include operation name and relevant details in error messages
4. **Don't Swallow Errors**: Always propagate errors up the stack

### Implementing Error Handler

```typescript
export class YourAdapter implements IStorageAdapter {
  /**
   * Handle database errors and convert to SDK errors
   */
  private handleDatabaseError(error: any, operation: string): Error {
    // If already a SDK error, return as-is
    if (error instanceof UserNotFoundError) {
      return error;
    }
    
    // Check for database-specific error codes
    if (error.code === 'ER_DUP_ENTRY') {
      return new Error(`Duplicate entry in ${operation}`);
    }
    
    if (error.code === 'ER_NO_REFERENCED_ROW') {
      return new Error(`Foreign key constraint violation in ${operation}`);
    }
    
    // Generic database error
    return new Error(`Database error in ${operation}: ${error.message || 'Unknown error'}`);
  }
}
```

### Database-Specific Error Codes

**PostgreSQL:**
```typescript
private handlePostgresError(error: any, operation: string): Error {
  switch (error.code) {
    case '23505': // unique_violation
      return new Error(`Unique constraint violation in ${operation}`);
    case '23503': // foreign_key_violation
      return new Error(`Foreign key constraint violation in ${operation}`);
    case '23502': // not_null_violation
      return new Error(`Not null constraint violation in ${operation}`);
    default:
      return new Error(`PostgreSQL error in ${operation}: ${error.message}`);
  }
}
```

**MongoDB:**
```typescript
private handleMongoError(error: any, operation: string): Error {
  if (error.code === 11000) {
    return new Error(`Duplicate key error in ${operation}`);
  }
  
  if (error.name === 'MongoNetworkError') {
    return new Error(`Network error in ${operation}: ${error.message}`);
  }
  
  return new Error(`MongoDB error in ${operation}: ${error.message}`);
}
```

**MySQL:**
```typescript
private handleMySQLError(error: any, operation: string): Error {
  switch (error.code) {
    case 'ER_DUP_ENTRY':
      return new Error(`Duplicate entry in ${operation}`);
    case 'ER_NO_REFERENCED_ROW':
      return new Error(`Foreign key constraint violation in ${operation}`);
    case 'ER_ROW_IS_REFERENCED':
      return new Error(`Cannot delete referenced row in ${operation}`);
    default:
      return new Error(`MySQL error in ${operation}: ${error.message}`);
  }
}
```

### Error Handling Best Practices

1. **Always catch and handle errors** in every method
2. **Preserve error context** by including operation name
3. **Don't expose internal details** to end users
4. **Log errors** for debugging (but don't log sensitive data)
5. **Test error paths** to ensure proper error handling


---

## Testing Your Adapter

Thorough testing is crucial to ensure your adapter works correctly with the SDK.

### Unit Testing Strategy

Create comprehensive unit tests for each adapter method:

```typescript
import { YourAdapter } from './YourAdapter';
import { UserNotFoundError } from '../core/errors';

describe('YourAdapter', () => {
  let adapter: YourAdapter;
  let dbClient: YourDatabaseClient;
  
  beforeEach(() => {
    dbClient = createTestDatabaseClient();
    adapter = new YourAdapter(dbClient);
  });
  
  afterEach(async () => {
    await cleanupDatabase(dbClient);
  });
  
  describe('getUserById', () => {
    it('should return user when exists', async () => {
      // Setup
      await dbClient.users.insertOne({
        id: 'user-123',
        credits: 1000,
        membershipTier: 'premium',
        membershipExpiresAt: new Date('2025-12-31'),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Execute
      const user = await adapter.getUserById('user-123');
      
      // Assert
      expect(user).not.toBeNull();
      expect(user!.id).toBe('user-123');
      expect(user!.credits).toBe(1000);
      expect(user!.membershipTier).toBe('premium');
    });
    
    it('should return null when user does not exist', async () => {
      const user = await adapter.getUserById('nonexistent');
      expect(user).toBeNull();
    });
    
    it('should work with transaction context', async () => {
      await dbClient.transaction(async (txn) => {
        await dbClient.users.insertOne({
          id: 'user-123',
          credits: 1000
        }, txn);
        
        const user = await adapter.getUserById('user-123', txn);
        expect(user).not.toBeNull();
      });
    });
  });
  
  describe('updateUserCredits', () => {
    it('should update credits correctly', async () => {
      // Setup
      await dbClient.users.insertOne({
        id: 'user-123',
        credits: 1000
      });
      
      // Execute
      const updated = await adapter.updateUserCredits('user-123', -100);
      
      // Assert
      expect(updated.credits).toBe(900);
    });
    
    it('should throw UserNotFoundError when user does not exist', async () => {
      await expect(
        adapter.updateUserCredits('nonexistent', -100)
      ).rejects.toThrow(UserNotFoundError);
    });
    
    it('should handle positive amounts', async () => {
      await dbClient.users.insertOne({
        id: 'user-123',
        credits: 1000
      });
      
      const updated = await adapter.updateUserCredits('user-123', 500);
      expect(updated.credits).toBe(1500);
    });
  });
  
  describe('createTransaction', () => {
    it('should create transaction with all fields', async () => {
      const transaction = await adapter.createTransaction({
        userId: 'user-123',
        action: 'generate-post',
        amount: -10,
        balanceBefore: 1000,
        balanceAfter: 990,
        metadata: { postId: 'post-456' }
      });
      
      expect(transaction.id).toBeDefined();
      expect(transaction.userId).toBe('user-123');
      expect(transaction.action).toBe('generate-post');
      expect(transaction.amount).toBe(-10);
      expect(transaction.metadata.postId).toBe('post-456');
      expect(transaction.createdAt).toBeInstanceOf(Date);
    });
  });
  
  describe('getTransactions', () => {
    it('should return transactions in descending order', async () => {
      // Create multiple transactions
      await adapter.createTransaction({
        userId: 'user-123',
        action: 'action1',
        amount: -10,
        balanceBefore: 1000,
        balanceAfter: 990
      });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await adapter.createTransaction({
        userId: 'user-123',
        action: 'action2',
        amount: -20,
        balanceBefore: 990,
        balanceAfter: 970
      });
      
      const transactions = await adapter.getTransactions('user-123');
      
      expect(transactions).toHaveLength(2);
      expect(transactions[0].action).toBe('action2'); // Most recent first
      expect(transactions[1].action).toBe('action1');
    });
    
    it('should support pagination', async () => {
      // Create 5 transactions
      for (let i = 0; i < 5; i++) {
        await adapter.createTransaction({
          userId: 'user-123',
          action: `action${i}`,
          amount: -10,
          balanceBefore: 1000,
          balanceAfter: 990
        });
      }
      
      const page1 = await adapter.getTransactions('user-123', { limit: 2, offset: 0 });
      const page2 = await adapter.getTransactions('user-123', { limit: 2, offset: 2 });
      
      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].id).not.toBe(page2[0].id);
    });
  });
});
```


### Integration Testing

Test your adapter with the actual CreditsEngine:

```typescript
import { CreditsEngine } from '../core/CreditsEngine';
import { YourAdapter } from './YourAdapter';

describe('YourAdapter Integration', () => {
  let adapter: YourAdapter;
  let engine: CreditsEngine;
  
  beforeEach(async () => {
    adapter = new YourAdapter(dbClient);
    
    // Create test user
    await adapter.createUser({
      id: 'user-123',
      credits: 1000,
      membershipTier: 'premium',
      membershipExpiresAt: new Date('2025-12-31')
    });
    
    engine = new CreditsEngine({
      storage: adapter,
      config: {
        costs: {
          'generate-post': { default: 10, premium: 8 }
        },
        membership: {
          tiers: { free: 0, premium: 1 },
          requirements: {}
        },
        retry: { enabled: false, maxAttempts: 3, initialDelay: 100, maxDelay: 5000, backoffMultiplier: 2 },
        idempotency: { enabled: true, ttl: 86400 },
        audit: { enabled: true }
      }
    });
  });
  
  it('should complete full charge flow', async () => {
    const result = await engine.charge({
      userId: 'user-123',
      action: 'generate-post'
    });
    
    expect(result.success).toBe(true);
    expect(result.cost).toBe(8); // Premium pricing
    expect(result.balanceAfter).toBe(992);
    
    // Verify transaction was created
    const transactions = await adapter.getTransactions('user-123');
    expect(transactions).toHaveLength(1);
    expect(transactions[0].amount).toBe(-8);
    
    // Verify audit log was created
    const auditLogs = await adapter.getAuditLogs();
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].status).toBe('success');
  });
  
  it('should handle transaction rollback on error', async () => {
    // This test requires transaction support
    await dbClient.transaction(async (txn) => {
      try {
        await engine.charge({
          userId: 'nonexistent',
          action: 'generate-post',
          txn
        });
      } catch (error) {
        // Error expected
      }
      
      // Verify no records were created
      const transactions = await adapter.getTransactions('user-123', {}, txn);
      expect(transactions).toHaveLength(0);
    });
  });
});
```

### Testing Checklist

- [ ] All methods return correct types
- [ ] Null handling works correctly
- [ ] Errors are thrown appropriately
- [ ] Transaction context is respected
- [ ] Date filtering works correctly
- [ ] Pagination works correctly
- [ ] Sorting is in descending order
- [ ] Metadata is stored and retrieved correctly
- [ ] Idempotency expiration works
- [ ] Atomic operations prevent race conditions


---

## Best Practices

### 1. Use Atomic Operations

Always use database-level atomic operations for credit updates:

```typescript
// ✅ GOOD: Atomic operation
async updateUserCredits(userId: string, amount: number, txn?: any): Promise<User> {
  return await client.users.update(
    { id: userId },
    { $inc: { credits: amount } }
  );
}

// ❌ BAD: Read-then-write (race condition)
async updateUserCredits(userId: string, amount: number, txn?: any): Promise<User> {
  const user = await client.users.findOne({ id: userId });
  user.credits += amount;
  return await client.users.update({ id: userId }, user);
}
```

### 2. Return Copies, Not References

Return copies of objects to prevent external modifications:

```typescript
// ✅ GOOD: Return a copy
async getUserById(userId: string, txn?: any): Promise<User | null> {
  const user = this.users.get(userId);
  return user ? { ...user } : null;
}

// ❌ BAD: Return reference (can be modified externally)
async getUserById(userId: string, txn?: any): Promise<User | null> {
  return this.users.get(userId) || null;
}
```

### 3. Handle Null vs Undefined Consistently

Use `null` for missing data, `undefined` for optional fields:

```typescript
// ✅ GOOD: Consistent null handling
async getUserById(userId: string, txn?: any): Promise<User | null> {
  const user = await client.users.findOne({ id: userId });
  return user || null; // Return null, not undefined
}

return {
  errorMessage: log.errorMessage || undefined // Optional field
};
```

### 4. Validate Input Data

Add validation to catch errors early:

```typescript
async updateUserCredits(userId: string, amount: number, txn?: any): Promise<User> {
  if (!userId) {
    throw new Error('userId is required');
  }
  
  if (typeof amount !== 'number' || isNaN(amount)) {
    throw new Error('amount must be a valid number');
  }
  
  // Proceed with update...
}
```

### 5. Use Indexes for Performance

Ensure your database has appropriate indexes:

```sql
-- User lookups
CREATE INDEX idx_users_id ON users(id);

-- Transaction queries
CREATE INDEX idx_transactions_user_created ON transactions(userId, createdAt DESC);
CREATE INDEX idx_transactions_action ON transactions(action);

-- Idempotency lookups
CREATE INDEX idx_idempotency_key ON idempotency_records(key);
CREATE INDEX idx_idempotency_expires ON idempotency_records(expiresAt);

-- Audit log queries
CREATE INDEX idx_audit_user_created ON audit_logs(userId, createdAt DESC);
```

### 6. Implement Connection Pooling

Use connection pooling for better performance:

```typescript
export class YourAdapter implements IStorageAdapter {
  private pool: ConnectionPool;
  
  constructor(config: DatabaseConfig) {
    this.pool = createConnectionPool({
      host: config.host,
      port: config.port,
      database: config.database,
      min: 2,
      max: 10,
      idleTimeoutMillis: 30000
    });
  }
  
  async getUserById(userId: string, txn?: any): Promise<User | null> {
    const client = txn || await this.pool.connect();
    try {
      // Use client...
    } finally {
      if (!txn) {
        client.release();
      }
    }
  }
}
```

### 7. Add Logging and Monitoring

Log important operations for debugging:

```typescript
async updateUserCredits(userId: string, amount: number, txn?: any): Promise<User> {
  this.logger.debug('Updating user credits', { userId, amount });
  
  try {
    const user = await this.doUpdate(userId, amount, txn);
    this.logger.info('Credits updated successfully', { userId, newBalance: user.credits });
    return user;
  } catch (error) {
    this.logger.error('Failed to update credits', { userId, amount, error });
    throw error;
  }
}
```

### 8. Handle Timezones Correctly

Always use UTC for timestamps:

```typescript
async createTransaction(transaction: TransactionInput, txn?: any): Promise<Transaction> {
  return await client.transactions.insertOne({
    ...transaction,
    createdAt: new Date() // JavaScript Date is always UTC internally
  });
}
```

### 9. Clean Up Expired Records

Implement cleanup for expired idempotency records:

```typescript
async cleanupExpiredRecords(): Promise<number> {
  const result = await this.client.idempotencyRecords.deleteMany({
    expiresAt: { $lt: new Date() }
  });
  
  return result.deletedCount;
}

// Run periodically
setInterval(() => {
  adapter.cleanupExpiredRecords();
}, 60 * 60 * 1000); // Every hour
```

### 10. Document Your Adapter

Add comprehensive documentation:

```typescript
/**
 * MongoDB Storage Adapter
 * 
 * Implements IStorageAdapter for MongoDB databases.
 * 
 * Features:
 * - Full transaction support via MongoDB sessions
 * - Automatic index creation
 * - Connection pooling
 * - Retry logic for transient errors
 * 
 * @example
 * ```typescript
 * const client = new MongoClient(uri);
 * await client.connect();
 * 
 * const adapter = new MongoDBAdapter(client.db('myapp'));
 * const engine = new CreditsEngine({ storage: adapter, config });
 * ```
 */
export class MongoDBAdapter implements IStorageAdapter {
  // Implementation...
}
```


---

## Common Pitfalls

### Pitfall 1: Not Handling Transaction Context

**Problem:**
```typescript
// ❌ BAD: Ignoring transaction context
async getUserById(userId: string, txn?: any): Promise<User | null> {
  return await this.dbClient.users.findOne({ id: userId });
}
```

**Solution:**
```typescript
// ✅ GOOD: Respecting transaction context
async getUserById(userId: string, txn?: any): Promise<User | null> {
  const client = txn || this.dbClient;
  return await client.users.findOne({ id: userId });
}
```

### Pitfall 2: Race Conditions in Credit Updates

**Problem:**
```typescript
// ❌ BAD: Read-then-write creates race condition
async updateUserCredits(userId: string, amount: number, txn?: any): Promise<User> {
  const user = await this.getUserById(userId, txn);
  user.credits += amount;
  return await this.saveUser(user, txn);
}
```

**Solution:**
```typescript
// ✅ GOOD: Atomic update operation
async updateUserCredits(userId: string, amount: number, txn?: any): Promise<User> {
  return await client.users.update(
    { id: userId },
    { $inc: { credits: amount } }
  );
}
```

### Pitfall 3: Throwing Errors for Missing Users in getUserById

**Problem:**
```typescript
// ❌ BAD: Throwing error when user not found
async getUserById(userId: string, txn?: any): Promise<User | null> {
  const user = await client.users.findOne({ id: userId });
  if (!user) {
    throw new UserNotFoundError(userId);
  }
  return user;
}
```

**Solution:**
```typescript
// ✅ GOOD: Returning null for missing users
async getUserById(userId: string, txn?: any): Promise<User | null> {
  const user = await client.users.findOne({ id: userId });
  return user || null;
}
```

### Pitfall 4: Not Checking Idempotency Expiration

**Problem:**
```typescript
// ❌ BAD: Not checking expiration
async getIdempotencyRecord(key: string, txn?: any): Promise<IdempotencyRecord | null> {
  return await client.idempotencyRecords.findOne({ key });
}
```

**Solution:**
```typescript
// ✅ GOOD: Checking expiration
async getIdempotencyRecord(key: string, txn?: any): Promise<IdempotencyRecord | null> {
  const record = await client.idempotencyRecords.findOne({ key });
  
  if (record && record.expiresAt < new Date()) {
    return null; // Expired
  }
  
  return record;
}
```

### Pitfall 5: Wrong Sort Order for Transactions

**Problem:**
```typescript
// ❌ BAD: Ascending order (oldest first)
async getTransactions(userId: string, options?: any, txn?: any): Promise<Transaction[]> {
  return await client.transactions
    .find({ userId })
    .sort({ createdAt: 1 }) // Wrong direction!
    .toArray();
}
```

**Solution:**
```typescript
// ✅ GOOD: Descending order (newest first)
async getTransactions(userId: string, options?: any, txn?: any): Promise<Transaction[]> {
  return await client.transactions
    .find({ userId })
    .sort({ createdAt: -1 }) // Correct direction
    .toArray();
}
```

### Pitfall 6: Not Mapping Database Types to SDK Types

**Problem:**
```typescript
// ❌ BAD: Returning database-specific types
async getUserById(userId: string, txn?: any): Promise<User | null> {
  return await client.users.findOne({ id: userId });
  // Returns database model with extra fields
}
```

**Solution:**
```typescript
// ✅ GOOD: Mapping to SDK types
async getUserById(userId: string, txn?: any): Promise<User | null> {
  const dbUser = await client.users.findOne({ id: userId });
  
  if (!dbUser) return null;
  
  return {
    id: dbUser.id,
    credits: dbUser.credits,
    membershipTier: dbUser.membershipTier,
    membershipExpiresAt: dbUser.membershipExpiresAt,
    createdAt: dbUser.createdAt,
    updatedAt: dbUser.updatedAt
  };
}
```

### Pitfall 7: Not Handling Metadata Correctly

**Problem:**
```typescript
// ❌ BAD: Not providing default empty object
async createTransaction(transaction: TransactionInput, txn?: any): Promise<Transaction> {
  return await client.transactions.insertOne({
    ...transaction,
    metadata: transaction.metadata // Could be undefined
  });
}
```

**Solution:**
```typescript
// ✅ GOOD: Providing default empty object
async createTransaction(transaction: TransactionInput, txn?: any): Promise<Transaction> {
  return await client.transactions.insertOne({
    ...transaction,
    metadata: transaction.metadata || {}
  });
}
```

### Pitfall 8: Swallowing Errors

**Problem:**
```typescript
// ❌ BAD: Catching and ignoring errors
async updateUserCredits(userId: string, amount: number, txn?: any): Promise<User> {
  try {
    return await client.users.update({ id: userId }, { $inc: { credits: amount } });
  } catch (error) {
    console.error('Error updating credits', error);
    return null; // Wrong! Should throw
  }
}
```

**Solution:**
```typescript
// ✅ GOOD: Propagating errors
async updateUserCredits(userId: string, amount: number, txn?: any): Promise<User> {
  try {
    return await client.users.update({ id: userId }, { $inc: { credits: amount } });
  } catch (error) {
    throw this.handleDatabaseError(error, 'updateUserCredits');
  }
}
```

### Pitfall 9: Not Testing Edge Cases

**Problem:**
- Only testing happy paths
- Not testing error conditions
- Not testing boundary values

**Solution:**
```typescript
describe('Edge Cases', () => {
  it('should handle zero amount updates', async () => {
    const user = await adapter.updateUserCredits('user-123', 0);
    expect(user.credits).toBe(1000); // Unchanged
  });
  
  it('should handle negative balances', async () => {
    await adapter.createUser({ id: 'user-123', credits: 10 });
    const user = await adapter.updateUserCredits('user-123', -20);
    expect(user.credits).toBe(-10); // Allowed
  });
  
  it('should handle very large amounts', async () => {
    const user = await adapter.updateUserCredits('user-123', 1000000000);
    expect(user.credits).toBe(1000001000);
  });
});
```

### Pitfall 10: Not Considering Performance

**Problem:**
- No indexes on frequently queried fields
- Loading all transactions without pagination
- Not using connection pooling

**Solution:**
- Add database indexes
- Always use pagination with reasonable defaults
- Implement connection pooling
- Monitor query performance


---

## Database-Specific Examples

### MongoDB Adapter

Complete MongoDB adapter implementation:

```typescript
import { MongoClient, Db, ClientSession } from 'mongodb';
import { IStorageAdapter } from './IStorageAdapter';
import {
  User,
  Transaction,
  TransactionInput,
  AuditLog,
  AuditLogInput,
  IdempotencyRecord,
  IdempotencyRecordInput
} from '../core/types';
import { UserNotFoundError } from '../core/errors';

export class MongoDBAdapter implements IStorageAdapter {
  constructor(private db: Db) {}

  private getSession(txn?: any): ClientSession | undefined {
    return txn as ClientSession | undefined;
  }

  async getUserById(userId: string, txn?: any): Promise<User | null> {
    const session = this.getSession(txn);
    const user = await this.db.collection('users').findOne(
      { _id: userId },
      { session }
    );

    if (!user) return null;

    return {
      id: user._id,
      credits: user.credits,
      membershipTier: user.membershipTier || null,
      membershipExpiresAt: user.membershipExpiresAt || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  async updateUserCredits(userId: string, amount: number, txn?: any): Promise<User> {
    const session = this.getSession(txn);
    
    const result = await this.db.collection('users').findOneAndUpdate(
      { _id: userId },
      { 
        $inc: { credits: amount },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after', session }
    );

    if (!result.value) {
      throw new UserNotFoundError(userId);
    }

    return {
      id: result.value._id,
      credits: result.value.credits,
      membershipTier: result.value.membershipTier || null,
      membershipExpiresAt: result.value.membershipExpiresAt || null,
      createdAt: result.value.createdAt,
      updatedAt: result.value.updatedAt
    };
  }

  async createTransaction(transaction: TransactionInput, txn?: any): Promise<Transaction> {
    const session = this.getSession(txn);
    
    const doc = {
      _id: new ObjectId(),
      userId: transaction.userId,
      action: transaction.action,
      amount: transaction.amount,
      balanceBefore: transaction.balanceBefore,
      balanceAfter: transaction.balanceAfter,
      metadata: transaction.metadata || {},
      createdAt: new Date()
    };

    await this.db.collection('transactions').insertOne(doc, { session });

    return {
      id: doc._id.toString(),
      userId: doc.userId,
      action: doc.action,
      amount: doc.amount,
      balanceBefore: doc.balanceBefore,
      balanceAfter: doc.balanceAfter,
      metadata: doc.metadata,
      createdAt: doc.createdAt
    };
  }

  async createAuditLog(log: AuditLogInput, txn?: any): Promise<AuditLog> {
    const session = this.getSession(txn);
    
    const doc = {
      _id: new ObjectId(),
      userId: log.userId,
      action: log.action,
      status: log.status,
      metadata: log.metadata || {},
      errorMessage: log.errorMessage || null,
      createdAt: new Date()
    };

    await this.db.collection('auditLogs').insertOne(doc, { session });

    return {
      id: doc._id.toString(),
      userId: doc.userId,
      action: doc.action,
      status: doc.status,
      metadata: doc.metadata,
      errorMessage: doc.errorMessage || undefined,
      createdAt: doc.createdAt
    };
  }

  async getIdempotencyRecord(key: string, txn?: any): Promise<IdempotencyRecord | null> {
    const session = this.getSession(txn);
    
    const record = await this.db.collection('idempotencyRecords').findOne(
      { _id: key },
      { session }
    );

    if (!record) return null;

    // Check expiration
    if (record.expiresAt < new Date()) {
      // Clean up expired record
      await this.db.collection('idempotencyRecords').deleteOne(
        { _id: key },
        { session }
      );
      return null;
    }

    return {
      key: record._id,
      result: record.result,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt
    };
  }

  async createIdempotencyRecord(record: IdempotencyRecordInput, txn?: any): Promise<IdempotencyRecord> {
    const session = this.getSession(txn);
    
    const doc = {
      _id: record.key,
      result: record.result,
      createdAt: new Date(),
      expiresAt: record.expiresAt
    };

    await this.db.collection('idempotencyRecords').insertOne(doc, { session });

    return {
      key: doc._id,
      result: doc.result,
      createdAt: doc.createdAt,
      expiresAt: doc.expiresAt
    };
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
  ): Promise<Transaction[]> {
    const session = this.getSession(txn);
    
    const filter: any = { userId };

    if (options?.startDate || options?.endDate) {
      filter.createdAt = {};
      if (options.startDate) filter.createdAt.$gte = options.startDate;
      if (options.endDate) filter.createdAt.$lte = options.endDate;
    }

    if (options?.action) {
      filter.action = options.action;
    }

    const cursor = this.db.collection('transactions')
      .find(filter, { session })
      .sort({ createdAt: -1 });

    if (options?.offset) cursor.skip(options.offset);
    if (options?.limit) cursor.limit(options.limit);

    const docs = await cursor.toArray();

    return docs.map(doc => ({
      id: doc._id.toString(),
      userId: doc.userId,
      action: doc.action,
      amount: doc.amount,
      balanceBefore: doc.balanceBefore,
      balanceAfter: doc.balanceAfter,
      metadata: doc.metadata,
      createdAt: doc.createdAt
    }));
  }
}

// Usage example
const client = new MongoClient('mongodb://localhost:27017');
await client.connect();
const db = client.db('myapp');

const adapter = new MongoDBAdapter(db);

// Create indexes
await db.collection('users').createIndex({ _id: 1 });
await db.collection('transactions').createIndex({ userId: 1, createdAt: -1 });
await db.collection('idempotencyRecords').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```


### Redis Adapter (with PostgreSQL for persistence)

Redis adapter for caching with PostgreSQL fallback:

```typescript
import Redis from 'ioredis';
import { Pool } from 'pg';
import { IStorageAdapter } from './IStorageAdapter';
import { User, Transaction, /* ... */ } from '../core/types';
import { UserNotFoundError } from '../core/errors';

/**
 * Hybrid Redis + PostgreSQL Adapter
 * 
 * Uses Redis for caching user data and PostgreSQL for persistent storage.
 * This provides fast reads while maintaining data durability.
 */
export class RedisPostgresAdapter implements IStorageAdapter {
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private redis: Redis,
    private pg: Pool
  ) {}

  private getCacheKey(type: string, id: string): string {
    return `credit-sdk:${type}:${id}`;
  }

  async getUserById(userId: string, txn?: any): Promise<User | null> {
    // Try cache first
    const cached = await this.redis.get(this.getCacheKey('user', userId));
    if (cached) {
      return JSON.parse(cached);
    }

    // Fallback to database
    const client = txn || this.pg;
    const result = await client.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user: User = {
      id: result.rows[0].id,
      credits: result.rows[0].credits,
      membershipTier: result.rows[0].membership_tier,
      membershipExpiresAt: result.rows[0].membership_expires_at,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    };

    // Cache for future reads
    await this.redis.setex(
      this.getCacheKey('user', userId),
      this.CACHE_TTL,
      JSON.stringify(user)
    );

    return user;
  }

  async updateUserCredits(userId: string, amount: number, txn?: any): Promise<User> {
    const client = txn || this.pg;
    
    const result = await client.query(
      `UPDATE users 
       SET credits = credits + $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [amount, userId]
    );

    if (result.rows.length === 0) {
      throw new UserNotFoundError(userId);
    }

    const user: User = {
      id: result.rows[0].id,
      credits: result.rows[0].credits,
      membershipTier: result.rows[0].membership_tier,
      membershipExpiresAt: result.rows[0].membership_expires_at,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    };

    // Invalidate cache
    await this.redis.del(this.getCacheKey('user', userId));

    return user;
  }

  async createTransaction(transaction: TransactionInput, txn?: any): Promise<Transaction> {
    const client = txn || this.pg;
    
    const result = await client.query(
      `INSERT INTO transactions 
       (user_id, action, amount, balance_before, balance_after, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [
        transaction.userId,
        transaction.action,
        transaction.amount,
        transaction.balanceBefore,
        transaction.balanceAfter,
        JSON.stringify(transaction.metadata || {})
      ]
    );

    return {
      id: result.rows[0].id,
      userId: result.rows[0].user_id,
      action: result.rows[0].action,
      amount: result.rows[0].amount,
      balanceBefore: result.rows[0].balance_before,
      balanceAfter: result.rows[0].balance_after,
      metadata: result.rows[0].metadata,
      createdAt: result.rows[0].created_at
    };
  }

  async createAuditLog(log: AuditLogInput, txn?: any): Promise<AuditLog> {
    const client = txn || this.pg;
    
    const result = await client.query(
      `INSERT INTO audit_logs 
       (user_id, action, status, metadata, error_message, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [
        log.userId,
        log.action,
        log.status,
        JSON.stringify(log.metadata || {}),
        log.errorMessage || null
      ]
    );

    return {
      id: result.rows[0].id,
      userId: result.rows[0].user_id,
      action: result.rows[0].action,
      status: result.rows[0].status,
      metadata: result.rows[0].metadata,
      errorMessage: result.rows[0].error_message || undefined,
      createdAt: result.rows[0].created_at
    };
  }

  async getIdempotencyRecord(key: string, txn?: any): Promise<IdempotencyRecord | null> {
    // Use Redis for idempotency (fast lookups)
    const cached = await this.redis.get(this.getCacheKey('idempotency', key));
    
    if (!cached) {
      return null;
    }

    return JSON.parse(cached);
  }

  async createIdempotencyRecord(record: IdempotencyRecordInput, txn?: any): Promise<IdempotencyRecord> {
    const created: IdempotencyRecord = {
      key: record.key,
      result: record.result,
      createdAt: new Date(),
      expiresAt: record.expiresAt
    };

    // Store in Redis with TTL
    const ttlSeconds = Math.floor((record.expiresAt.getTime() - Date.now()) / 1000);
    
    await this.redis.setex(
      this.getCacheKey('idempotency', record.key),
      ttlSeconds,
      JSON.stringify(created)
    );

    return created;
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
  ): Promise<Transaction[]> {
    const client = txn || this.pg;
    
    let query = 'SELECT * FROM transactions WHERE user_id = $1';
    const params: any[] = [userId];
    let paramIndex = 2;

    if (options?.startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(options.startDate);
      paramIndex++;
    }

    if (options?.endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(options.endDate);
      paramIndex++;
    }

    if (options?.action) {
      query += ` AND action = $${paramIndex}`;
      params.push(options.action);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';

    if (options?.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(options.limit);
      paramIndex++;
    }

    if (options?.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(options.offset);
    }

    const result = await client.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      action: row.action,
      amount: row.amount,
      balanceBefore: row.balance_before,
      balanceAfter: row.balance_after,
      metadata: row.metadata,
      createdAt: row.created_at
    }));
  }
}

// Usage example
const redis = new Redis({
  host: 'localhost',
  port: 6379
});

const pg = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'myapp',
  user: 'postgres',
  password: 'password'
});

const adapter = new RedisPostgresAdapter(redis, pg);
```


### Supabase Adapter

Adapter for Supabase (PostgreSQL with REST API):

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IStorageAdapter } from './IStorageAdapter';
import { User, Transaction, /* ... */ } from '../core/types';
import { UserNotFoundError } from '../core/errors';

export class SupabaseAdapter implements IStorageAdapter {
  constructor(private supabase: SupabaseClient) {}

  async getUserById(userId: string, txn?: any): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      throw new Error(`Supabase error in getUserById: ${error.message}`);
    }

    return {
      id: data.id,
      credits: data.credits,
      membershipTier: data.membership_tier,
      membershipExpiresAt: data.membership_expires_at ? new Date(data.membership_expires_at) : null,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  async updateUserCredits(userId: string, amount: number, txn?: any): Promise<User> {
    // Supabase doesn't support increment directly, use RPC
    const { data, error } = await this.supabase
      .rpc('update_user_credits', {
        p_user_id: userId,
        p_amount: amount
      });

    if (error) {
      if (error.message.includes('not found')) {
        throw new UserNotFoundError(userId);
      }
      throw new Error(`Supabase error in updateUserCredits: ${error.message}`);
    }

    return {
      id: data.id,
      credits: data.credits,
      membershipTier: data.membership_tier,
      membershipExpiresAt: data.membership_expires_at ? new Date(data.membership_expires_at) : null,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  async createTransaction(transaction: TransactionInput, txn?: any): Promise<Transaction> {
    const { data, error } = await this.supabase
      .from('transactions')
      .insert({
        user_id: transaction.userId,
        action: transaction.action,
        amount: transaction.amount,
        balance_before: transaction.balanceBefore,
        balance_after: transaction.balanceAfter,
        metadata: transaction.metadata || {}
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Supabase error in createTransaction: ${error.message}`);
    }

    return {
      id: data.id,
      userId: data.user_id,
      action: data.action,
      amount: data.amount,
      balanceBefore: data.balance_before,
      balanceAfter: data.balance_after,
      metadata: data.metadata,
      createdAt: new Date(data.created_at)
    };
  }

  async createAuditLog(log: AuditLogInput, txn?: any): Promise<AuditLog> {
    const { data, error } = await this.supabase
      .from('audit_logs')
      .insert({
        user_id: log.userId,
        action: log.action,
        status: log.status,
        metadata: log.metadata || {},
        error_message: log.errorMessage || null
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Supabase error in createAuditLog: ${error.message}`);
    }

    return {
      id: data.id,
      userId: data.user_id,
      action: data.action,
      status: data.status,
      metadata: data.metadata,
      errorMessage: data.error_message || undefined,
      createdAt: new Date(data.created_at)
    };
  }

  async getIdempotencyRecord(key: string, txn?: any): Promise<IdempotencyRecord | null> {
    const { data, error } = await this.supabase
      .from('idempotency_records')
      .select('*')
      .eq('key', key)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Supabase error in getIdempotencyRecord: ${error.message}`);
    }

    // Check expiration
    const expiresAt = new Date(data.expires_at);
    if (expiresAt < new Date()) {
      return null;
    }

    return {
      key: data.key,
      result: data.result,
      createdAt: new Date(data.created_at),
      expiresAt
    };
  }

  async createIdempotencyRecord(record: IdempotencyRecordInput, txn?: any): Promise<IdempotencyRecord> {
    const { data, error } = await this.supabase
      .from('idempotency_records')
      .insert({
        key: record.key,
        result: record.result,
        expires_at: record.expiresAt.toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Supabase error in createIdempotencyRecord: ${error.message}`);
    }

    return {
      key: data.key,
      result: data.result,
      createdAt: new Date(data.created_at),
      expiresAt: new Date(data.expires_at)
    };
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
  ): Promise<Transaction[]> {
    let query = this.supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }

    if (options?.endDate) {
      query = query.lte('created_at', options.endDate.toISOString());
    }

    if (options?.action) {
      query = query.eq('action', options.action);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Supabase error in getTransactions: ${error.message}`);
    }

    return data.map(row => ({
      id: row.id,
      userId: row.user_id,
      action: row.action,
      amount: row.amount,
      balanceBefore: row.balance_before,
      balanceAfter: row.balance_after,
      metadata: row.metadata,
      createdAt: new Date(row.created_at)
    }));
  }
}

// Required PostgreSQL function for atomic updates
/*
CREATE OR REPLACE FUNCTION update_user_credits(p_user_id TEXT, p_amount INTEGER)
RETURNS TABLE (
  id TEXT,
  credits INTEGER,
  membership_tier TEXT,
  membership_expires_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  UPDATE users
  SET credits = credits + p_amount,
      updated_at = NOW()
  WHERE users.id = p_user_id
  RETURNING users.*;
END;
$$ LANGUAGE plpgsql;
*/

// Usage example
const supabase = createClient(
  'https://your-project.supabase.co',
  'your-anon-key'
);

const adapter = new SupabaseAdapter(supabase);
```


---

## Conclusion

Implementing a custom storage adapter for credit-sdk is straightforward if you follow these guidelines:

### Quick Checklist

- [ ] Implement all 7 required methods from `IStorageAdapter`
- [ ] Handle transaction context properly (use `txn` parameter)
- [ ] Use atomic operations for credit updates
- [ ] Return `null` for missing records (don't throw in `getUserById`)
- [ ] Throw `UserNotFoundError` when updating non-existent users
- [ ] Check idempotency record expiration
- [ ] Sort transactions in descending order by `createdAt`
- [ ] Map database types to SDK types
- [ ] Handle errors appropriately
- [ ] Write comprehensive tests

### Key Takeaways

1. **Transaction Support is Critical**: Always respect the `txn` parameter to maintain data consistency
2. **Atomic Operations Prevent Race Conditions**: Use database-level atomic updates for credits
3. **Type Mapping is Important**: Always map your database models to SDK types
4. **Error Handling Matters**: Convert database errors to meaningful SDK errors
5. **Test Thoroughly**: Test all methods, edge cases, and error conditions

### Getting Help

If you encounter issues:

1. Review the reference implementations:
   - `PrismaAdapter.ts` - Full-featured SQL adapter
   - `MockAdapter.ts` - Simple in-memory adapter

2. Check the interface definition:
   - `IStorageAdapter.ts` - Complete method signatures and documentation

3. Run the test suite:
   ```bash
   npm test
   ```

4. Enable debug logging:
   ```typescript
   const engine = new CreditsEngine({
     storage: adapter,
     config,
     logger: new ConsoleLogger() // Enable logging
   });
   ```

### Additional Resources

- [Prisma Adapter Source](../src/adapters/PrismaAdapter.ts)
- [Mock Adapter Source](../src/adapters/MockAdapter.ts)
- [Interface Definition](../src/adapters/IStorageAdapter.ts)
- [Type Definitions](../src/core/types.ts)
- [Error Classes](../src/core/errors.ts)

---

**Happy coding!** 🚀

If you build an adapter for a database system not covered here, consider contributing it back to the project!


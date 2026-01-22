# Adapters

This directory contains storage and logging adapters for the credit-sdk.

## IStorageAdapter

The `IStorageAdapter` interface defines the contract for all storage implementations. It provides methods for:

- User management (getUserById, updateUserCredits)
- Transaction recording (createTransaction, getTransactions)
- Audit logging (createAuditLog)
- Idempotency management (getIdempotencyRecord, createIdempotencyRecord)

All methods support optional transaction context for atomic operations.

## PrismaAdapter

The `PrismaAdapter` is a reference implementation of `IStorageAdapter` using Prisma ORM.

### Features

- ✅ Full implementation of all IStorageAdapter methods
- ✅ Transaction context support
- ✅ Type mapping between Prisma models and SDK types
- ✅ Error conversion from Prisma errors to SDK errors
- ✅ Automatic expiration handling for idempotency records

### Usage

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaAdapter, CreditsEngine } from 'credit-sdk';

// Initialize Prisma client
const prisma = new PrismaClient();

// Create adapter
const adapter = new PrismaAdapter(prisma);

// Use with CreditsEngine
const engine = new CreditsEngine({
  storage: adapter,
  config: {
    // ... your config
  }
});

// Basic usage (without transaction)
const user = await adapter.getUserById('user-123');
await adapter.updateUserCredits('user-123', -10);

// With transaction
await prisma.$transaction(async (txn) => {
  const user = await adapter.getUserById('user-123', txn);
  await adapter.updateUserCredits('user-123', -10, txn);
  await adapter.createTransaction({
    userId: 'user-123',
    action: 'charge',
    amount: -10,
    balanceBefore: user.credits,
    balanceAfter: user.credits - 10
  }, txn);
});
```

### Database Schema

The PrismaAdapter requires the following Prisma schema:

```prisma
model User {
  id                  String    @id @default(cuid())
  credits             Int       @default(0)
  membershipTier      String?
  membershipExpiresAt DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  transactions        Transaction[]
  auditLogs           AuditLog[]
}

model Transaction {
  id            String   @id @default(cuid())
  userId        String
  action        String
  amount        Int
  balanceBefore Int
  balanceAfter  Int
  metadata      Json     @default("{}")
  createdAt     DateTime @default(now())
  
  user          User     @relation(fields: [userId], references: [id])
  
  @@index([userId, createdAt])
}

model AuditLog {
  id           String   @id @default(cuid())
  userId       String
  action       String
  status       String
  metadata     Json     @default("{}")
  errorMessage String?
  createdAt    DateTime @default(now())
  
  user         User     @relation(fields: [userId], references: [id])
  
  @@index([userId, createdAt])
}

model IdempotencyRecord {
  key       String   @id
  result    Json
  createdAt DateTime @default(now())
  expiresAt DateTime
  
  @@index([expiresAt])
}
```

### Error Handling

The PrismaAdapter converts Prisma-specific errors to SDK errors:

- `P2025` (Record not found) → `UserNotFoundError` (for user operations)
- `P2002` (Unique constraint violation) → Generic error with details
- `P2003` (Foreign key constraint violation) → Generic error
- Other Prisma errors → Wrapped in generic error with context

### Transaction Support

The adapter supports Prisma's transaction API:

```typescript
// Interactive transactions
await prisma.$transaction(async (txn) => {
  // All operations use the same transaction
  const user = await adapter.getUserById('user-123', txn);
  await adapter.updateUserCredits('user-123', -10, txn);
});

// Sequential operations (auto-commit)
await prisma.$transaction([
  prisma.user.update({ where: { id: 'user-123' }, data: { credits: { increment: -10 } } }),
  prisma.transaction.create({ data: { /* ... */ } })
]);
```

## ILogAdapter

The `ILogAdapter` interface defines the contract for logging implementations.

### ConsoleLogger

A simple console-based logger implementation:

```typescript
import { ConsoleLogger } from 'credit-sdk';

const logger = new ConsoleLogger();
logger.info('Operation completed', { userId: 'user-123', cost: 10 });
```

## Creating Custom Adapters

To create a custom storage adapter:

1. Implement the `IStorageAdapter` interface
2. Handle transaction context appropriately
3. Map your database types to SDK types
4. Convert database-specific errors to SDK errors

Example:

```typescript
import { IStorageAdapter, User, Transaction, /* ... */ } from 'credit-sdk';

export class MyCustomAdapter implements IStorageAdapter {
  constructor(private db: MyDatabase) {}
  
  async getUserById(userId: string, txn?: any): Promise<User | null> {
    const client = txn || this.db;
    const user = await client.users.findOne({ id: userId });
    
    if (!user) return null;
    
    // Map to SDK User type
    return {
      id: user.id,
      credits: user.credits,
      membershipTier: user.membership_tier,
      membershipExpiresAt: user.membership_expires_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };
  }
  
  // Implement other methods...
}
```

## Best Practices

1. **Always support transaction context**: Check if `txn` is provided and use it instead of the default client
2. **Map types correctly**: Ensure your database types match SDK type expectations
3. **Handle errors gracefully**: Convert database-specific errors to meaningful SDK errors
4. **Test thoroughly**: Write unit tests for all adapter methods
5. **Document your adapter**: Provide clear usage examples and schema requirements

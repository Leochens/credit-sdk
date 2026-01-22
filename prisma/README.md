# Prisma Schema for Credit SDK

This directory contains the Prisma schema definition for the Credit SDK reference implementation.

## Models

### User
Represents a user in the system with their credit balance and membership information.

**Fields:**
- `id`: Unique identifier (CUID)
- `credits`: Current credit balance (default: 0)
- `membershipTier`: Optional membership tier (e.g., 'free', 'basic', 'premium', 'enterprise')
- `membershipExpiresAt`: Optional membership expiration date
- `createdAt`: Timestamp when user was created
- `updatedAt`: Timestamp when user was last updated

### Transaction
Records all credit transactions (charges, refunds, grants).

**Fields:**
- `id`: Unique identifier (CUID)
- `userId`: Reference to the user
- `action`: Name of the operation (e.g., 'generate-post', 'generate-image')
- `amount`: Amount of credits changed (negative for charges, positive for refunds/grants)
- `balanceBefore`: User's balance before the transaction
- `balanceAfter`: User's balance after the transaction
- `metadata`: Additional data stored as JSON
- `createdAt`: Timestamp when transaction was created

**Indexes:**
- `(userId, createdAt)`: For efficient transaction history queries

### AuditLog
Tracks all operations for compliance and debugging.

**Fields:**
- `id`: Unique identifier (CUID)
- `userId`: Reference to the user
- `action`: Name of the operation
- `status`: Operation status ('success' or 'failed')
- `metadata`: Additional context stored as JSON
- `errorMessage`: Optional error message if operation failed
- `createdAt`: Timestamp when log was created

**Indexes:**
- `(userId, createdAt)`: For efficient audit log queries

### IdempotencyRecord
Stores idempotency keys to prevent duplicate operations.

**Fields:**
- `key`: Unique idempotency key (primary key)
- `result`: Cached operation result stored as JSON
- `createdAt`: Timestamp when record was created
- `expiresAt`: Timestamp when record expires

**Indexes:**
- `expiresAt`: For efficient cleanup of expired records

## Setup

1. Install dependencies:
```bash
npm install prisma @prisma/client
```

2. Configure your database connection in `prisma.config.ts` (Prisma 7+) or set the `DATABASE_URL` environment variable (Prisma 6 and below).

3. Generate the Prisma Client:
```bash
npx prisma generate
```

4. Run migrations to create the database schema:
```bash
npx prisma migrate dev --name init
```

## Usage with Credit SDK

The Prisma schema is used by the `PrismaAdapter` class to implement the `IStorageAdapter` interface. See the adapter implementation in `src/adapters/PrismaAdapter.ts`.

Example:
```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaAdapter } from './adapters/PrismaAdapter';
import { CreditsEngine } from './core/CreditsEngine';

const prisma = new PrismaClient();
const adapter = new PrismaAdapter(prisma);
const engine = new CreditsEngine({
  storage: adapter,
  config: {
    // your configuration
  }
});
```

## Database Support

The schema is configured for PostgreSQL by default, but Prisma supports multiple databases:
- PostgreSQL
- MySQL
- SQLite
- SQL Server
- MongoDB
- CockroachDB

To use a different database, change the `provider` in the `datasource` block.

# Database Setup Guide

Complete guide to setting up databases for the Credit SDK.

## Table of Contents

- [Prisma Setup](#prisma-setup)
- [Supported Databases](#supported-databases)
- [Schema Reference](#schema-reference)
- [Migrations](#migrations)
- [Database Optimization](#database-optimization)

## Prisma Setup

### 1. Install Dependencies

```bash
npm install prisma @prisma/client
npm install -D prisma
```

### 2. Initialize Prisma

```bash
npx prisma init
```

This creates:
- `prisma/schema.prisma` - Database schema
- `.env` - Environment variables

### 3. Configure Database URL

Edit `.env`:

```env
# PostgreSQL
DATABASE_URL="postgresql://user:password@localhost:5432/mydb"

# MySQL
DATABASE_URL="mysql://user:password@localhost:3306/mydb"

# SQLite
DATABASE_URL="file:./dev.db"
```

### 4. Copy Schema

Copy the schema from `prisma/schema.prisma` in this repository, or use the schema below.

### 5. Run Migrations

```bash
# Create and apply migration
npx prisma migrate dev --name init

# Generate Prisma Client
npx prisma generate
```

### 6. Verify Setup

```bash
# Open Prisma Studio to view data
npx prisma studio
```

## Supported Databases

The Prisma adapter supports all Prisma-compatible databases:

### PostgreSQL (Recommended)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Connection String:**
```
postgresql://user:password@localhost:5432/database?schema=public
```

**Features:**
- ✅ Full transaction support
- ✅ JSON/JSONB support
- ✅ Excellent performance
- ✅ Production-ready

### MySQL

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

**Connection String:**
```
mysql://user:password@localhost:3306/database
```

**Features:**
- ✅ Full transaction support
- ✅ JSON support
- ✅ Good performance
- ✅ Production-ready

### SQLite

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

**Connection String:**
```
file:./dev.db
```

**Features:**
- ✅ Zero configuration
- ✅ Perfect for development
- ⚠️ Limited concurrency
- ❌ Not recommended for production

### SQL Server

```prisma
datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}
```

**Connection String:**
```
sqlserver://localhost:1433;database=mydb;user=sa;password=password;encrypt=true
```

### MongoDB

```prisma
datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}
```

**Connection String:**
```
mongodb://user:password@localhost:27017/database
```

**Note:** Requires MongoDB 4.2+

### CockroachDB

```prisma
datasource db {
  provider = "cockroachdb"
  url      = env("DATABASE_URL")
}
```

**Connection String:**
```
postgresql://user:password@localhost:26257/database?sslmode=require
```

## Schema Reference

### Complete Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"  // or mysql, sqlite, etc.
  url      = env("DATABASE_URL")
}

model User {
  id                  String    @id @default(cuid())
  credits             Int       @default(0)
  membershipTier      String?
  membershipExpiresAt DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  transactions        Transaction[]
  auditLogs           AuditLog[]
  
  @@index([membershipTier])
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
  
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId, createdAt(sort: Desc)])
  @@index([action])
}

model AuditLog {
  id           String   @id @default(cuid())
  userId       String
  action       String
  status       String
  metadata     Json     @default("{}")
  errorMessage String?
  createdAt    DateTime @default(now())
  
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId, createdAt(sort: Desc)])
  @@index([status])
}

model IdempotencyRecord {
  key       String   @id
  result    Json
  createdAt DateTime @default(now())
  expiresAt DateTime
  
  @@index([expiresAt])
}
```

### Field Descriptions

#### User Model

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `id` | String | Unique user identifier | Yes |
| `credits` | Int | Current credit balance | Yes |
| `membershipTier` | String? | User's membership tier | No |
| `membershipExpiresAt` | DateTime? | Membership expiration date | No |
| `createdAt` | DateTime | User creation timestamp | Yes |
| `updatedAt` | DateTime | Last update timestamp | Yes |

#### Transaction Model

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `id` | String | Unique transaction ID | Yes |
| `userId` | String | User who performed transaction | Yes |
| `action` | String | Action name (e.g., 'generate-post') | Yes |
| `amount` | Int | Credit amount (negative for charges) | Yes |
| `balanceBefore` | Int | Balance before transaction | Yes |
| `balanceAfter` | Int | Balance after transaction | Yes |
| `metadata` | Json | Additional transaction data | No |
| `createdAt` | DateTime | Transaction timestamp | Yes |

#### AuditLog Model

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `id` | String | Unique log ID | Yes |
| `userId` | String | User who performed action | Yes |
| `action` | String | Action name | Yes |
| `status` | String | 'success' or 'failed' | Yes |
| `metadata` | Json | Additional log data | No |
| `errorMessage` | String? | Error message if failed | No |
| `createdAt` | DateTime | Log timestamp | Yes |

#### IdempotencyRecord Model

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `key` | String | Unique idempotency key | Yes |
| `result` | Json | Cached operation result | Yes |
| `createdAt` | DateTime | Record creation timestamp | Yes |
| `expiresAt` | DateTime | Record expiration timestamp | Yes |

## Migrations

### Creating Migrations

```bash
# Create a new migration
npx prisma migrate dev --name add_credits_system

# Apply migrations in production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

### Migration Best Practices

1. **Always backup before migrating production**
2. **Test migrations in staging first**
3. **Use descriptive migration names**
4. **Review generated SQL before applying**
5. **Run migrations during low-traffic periods**

### Example Migration: Add Credits to Existing Users

```sql
-- migrations/20240101000000_init_credits/migration.sql

-- Add credits column with default value
ALTER TABLE "User" ADD COLUMN "credits" INTEGER NOT NULL DEFAULT 0;

-- Initialize credits for existing users
UPDATE "User" SET "credits" = 100 WHERE "credits" = 0;

-- Add membership columns
ALTER TABLE "User" ADD COLUMN "membershipTier" TEXT;
ALTER TABLE "User" ADD COLUMN "membershipExpiresAt" TIMESTAMP;

-- Create index for membership queries
CREATE INDEX "User_membershipTier_idx" ON "User"("membershipTier");
```

### Rollback Strategy

```bash
# View migration history
npx prisma migrate status

# Rollback last migration (manual)
# 1. Identify migration to rollback
# 2. Create new migration that reverses changes
npx prisma migrate dev --name rollback_credits_system
```

## Database Optimization

### Indexes

The schema includes optimized indexes for common queries:

```prisma
// User lookups by membership
@@index([membershipTier])

// Transaction history queries
@@index([userId, createdAt(sort: Desc)])

// Action-based filtering
@@index([action])

// Audit log queries
@@index([userId, createdAt(sort: Desc)])
@@index([status])

// Idempotency cleanup
@@index([expiresAt])
```

### Query Optimization Tips

1. **Use indexes for frequent queries**
   ```typescript
   // Optimized: Uses index
   const transactions = await prisma.transaction.findMany({
     where: { userId: 'user-123' },
     orderBy: { createdAt: 'desc' },
     take: 10
   });
   ```

2. **Limit result sets**
   ```typescript
   // Always use take/limit
   const transactions = await prisma.transaction.findMany({
     take: 100,
     skip: 0
   });
   ```

3. **Select only needed fields**
   ```typescript
   // Only select what you need
   const user = await prisma.user.findUnique({
     where: { id: 'user-123' },
     select: { credits: true, membershipTier: true }
   });
   ```

4. **Use transactions for consistency**
   ```typescript
   await prisma.$transaction(async (tx) => {
     await tx.user.update({ /* ... */ });
     await tx.transaction.create({ /* ... */ });
   });
   ```

### Connection Pooling

```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Connection pool settings
  // Add to connection string: ?connection_limit=10&pool_timeout=20
}
```

**Recommended Pool Sizes:**
- Development: 5-10 connections
- Production: 10-20 connections per instance
- High traffic: 20-50 connections per instance

### Cleanup Jobs

#### Expired Idempotency Records

```typescript
// cleanup.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupExpiredIdempotency() {
  const result = await prisma.idempotencyRecord.deleteMany({
    where: {
      expiresAt: {
        lt: new Date()
      }
    }
  });
  
  console.log(`Deleted ${result.count} expired records`);
}

// Run daily
setInterval(cleanupExpiredIdempotency, 24 * 60 * 60 * 1000);
```

#### Archive Old Transactions

```typescript
async function archiveOldTransactions() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  // Move to archive table
  const oldTransactions = await prisma.transaction.findMany({
    where: {
      createdAt: {
        lt: sixMonthsAgo
      }
    }
  });
  
  // Archive logic here
  
  // Delete from main table
  await prisma.transaction.deleteMany({
    where: {
      createdAt: {
        lt: sixMonthsAgo
      }
    }
  });
}
```

### Monitoring

```typescript
// Monitor slow queries
prisma.$on('query', (e) => {
  if (e.duration > 1000) {
    console.warn('Slow query detected:', {
      query: e.query,
      duration: e.duration,
      params: e.params
    });
  }
});
```

### Backup Strategy

1. **Automated Backups**
   - Daily full backups
   - Hourly incremental backups
   - Retain for 30 days

2. **Backup Verification**
   - Test restore monthly
   - Verify data integrity
   - Document restore procedures

3. **Disaster Recovery**
   - Off-site backup storage
   - Multi-region replication
   - Recovery time objective (RTO): < 1 hour
   - Recovery point objective (RPO): < 15 minutes

## Troubleshooting

### Common Issues

#### Connection Errors

```bash
# Check connection
npx prisma db pull

# Test connection
npx prisma studio
```

#### Migration Conflicts

```bash
# Reset development database
npx prisma migrate reset

# Resolve conflicts manually
npx prisma migrate resolve --applied "migration_name"
```

#### Performance Issues

```typescript
// Enable query logging
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error']
});

// Analyze slow queries
// Add indexes as needed
```

### Getting Help

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Discord](https://discord.gg/prisma)
- [GitHub Issues](https://github.com/Leochens/credit-sdk/issues)

# Integrating Credit SDK with Existing Database

This guide provides detailed examples for integrating the Credit SDK with your existing database schema.

## Table of Contents

- [Overview](#overview)
- [Integration Approaches](#integration-approaches)
- [Real-World Examples](#real-world-examples)
- [Migration Scripts](#migration-scripts)
- [Troubleshooting](#troubleshooting)

## Overview

The Credit SDK is designed with flexibility in mind. You don't need to rebuild your entire database schema to use it. The adapter pattern allows you to integrate with any existing database structure.

### What You Need

The SDK requires access to these data points:

**User Data:**
- User ID (string)
- Credits balance (number)
- Membership tier (string, optional)
- Membership expiration (date, optional)

**Transaction History:**
- Transaction records (can use SDK's default table)

**Audit Logs:**
- Operation logs (can use SDK's default table)

**Idempotency:**
- Idempotency records (can use SDK's default table)

## Integration Approaches

### Approach 1: Extend Existing User Table

**Best for:** New projects or when you have control over the schema

**Pros:**
- ✅ Simple and straightforward
- ✅ All user data in one place
- ✅ No additional joins needed
- ✅ Works with PrismaAdapter out of the box

**Cons:**
- ❌ Requires schema modification
- ❌ May need migration for existing users

**Example:**

```typescript
// Before: Your existing schema
model User {
  id        String   @id
  email     String   @unique
  name      String
  password  String
  role      String
}

// After: Add SDK fields
model User {
  id                  String    @id
  email               String    @unique
  name                String
  password            String
  role                String
  
  // SDK fields
  credits             Int       @default(0)
  membershipTier      String?
  membershipExpiresAt DateTime?
  
  // SDK relations
  transactions        Transaction[]
  auditLogs           AuditLog[]
}
```

### Approach 2: Custom Adapter with Field Mapping

**Best for:** Production systems where schema changes are difficult

**Pros:**
- ✅ No schema changes required
- ✅ Works with any field names
- ✅ Can map complex logic
- ✅ Gradual migration possible

**Cons:**
- ❌ Requires custom adapter implementation
- ❌ More code to maintain

**Example:**

```typescript
import { IStorageAdapter, User } from 'credit-sdk';

export class LegacyDatabaseAdapter implements IStorageAdapter {
  constructor(private db: any) {}
  
  async getUserById(userId: string, txn?: any): Promise<User | null> {
    // Your existing table might be called 'accounts' with different field names
    const account = await this.db.accounts.findOne({ 
      accountId: userId 
    });
    
    if (!account) return null;
    
    // Map your fields to SDK format
    return {
      id: account.accountId,
      credits: account.tokenBalance || 0,  // Your field: tokenBalance
      membershipTier: this.mapSubscriptionToTier(account.subscription),
      membershipExpiresAt: account.subscriptionEndDate,
      createdAt: account.registeredAt,
      updatedAt: account.lastModified
    };
  }
  
  private mapSubscriptionToTier(subscription: string): string | null {
    // Map your subscription types to SDK tiers
    const mapping: Record<string, string> = {
      'FREE_PLAN': 'free',
      'PRO_PLAN': 'premium',
      'BUSINESS_PLAN': 'enterprise'
    };
    return mapping[subscription] || null;
  }
  
  async updateUserCredits(userId: string, amount: number, txn?: any): Promise<User> {
    const account = await this.db.accounts.update({
      where: { accountId: userId },
      data: {
        tokenBalance: { increment: amount }  // Your field name
      }
    });
    
    return {
      id: account.accountId,
      credits: account.tokenBalance,
      membershipTier: this.mapSubscriptionToTier(account.subscription),
      membershipExpiresAt: account.subscriptionEndDate,
      createdAt: account.registeredAt,
      updatedAt: account.lastModified
    };
  }
  
  // Implement other methods...
}
```

### Approach 3: Separate Credits Table

**Best for:** Microservices or when you want complete separation

**Pros:**
- ✅ Complete separation of concerns
- ✅ Easy to add/remove
- ✅ No impact on existing user table
- ✅ Can be in a different database

**Cons:**
- ❌ Requires additional join for user data
- ❌ Slightly more complex queries

**Example:**

```prisma
// Your existing user table (unchanged)
model User {
  id       String   @id
  email    String   @unique
  name     String
  
  credits  UserCredits?  // Optional relation
}

// New separate credits table
model UserCredits {
  userId              String    @id
  credits             Int       @default(0)
  membershipTier      String?
  membershipExpiresAt DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  user                User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions        Transaction[]
  auditLogs           AuditLog[]
}
```

## Real-World Examples

### Example 1: E-commerce Platform

**Scenario:** You have an e-commerce platform with existing users and want to add a credits system for promotional campaigns.

**Existing Schema:**
```prisma
model Customer {
  id            String   @id
  email         String   @unique
  firstName     String
  lastName      String
  loyaltyPoints Int      @default(0)
  tier          String   @default("bronze")  // bronze, silver, gold
  orders        Order[]
}
```

**Solution:** Map loyalty points to credits

```typescript
export class EcommerceAdapter implements IStorageAdapter {
  constructor(private prisma: PrismaClient) {}
  
  async getUserById(userId: string, txn?: any): Promise<User | null> {
    const client = txn || this.prisma;
    const customer = await client.customer.findUnique({
      where: { id: userId }
    });
    
    if (!customer) return null;
    
    return {
      id: customer.id,
      credits: customer.loyaltyPoints,  // Use existing loyalty points
      membershipTier: customer.tier,     // Use existing tier
      membershipExpiresAt: null,         // No expiration in this system
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt
    };
  }
  
  async updateUserCredits(userId: string, amount: number, txn?: any): Promise<User> {
    const client = txn || this.prisma;
    const customer = await client.customer.update({
      where: { id: userId },
      data: {
        loyaltyPoints: { increment: amount }
      }
    });
    
    return {
      id: customer.id,
      credits: customer.loyaltyPoints,
      membershipTier: customer.tier,
      membershipExpiresAt: null,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt
    };
  }
  
  // ... implement other methods using SDK's default tables
}

// Usage
const adapter = new EcommerceAdapter(prisma);
const engine = new CreditsEngine({
  storage: adapter,
  config: {
    costs: {
      'redeem-discount': { bronze: 100, silver: 80, gold: 50 },
      'free-shipping': { bronze: 200, silver: 150, gold: 100 }
    },
    membership: {
      tiers: { bronze: 0, silver: 1, gold: 2 },
      requirements: {
        'redeem-discount': null,
        'free-shipping': 'silver'
      }
    }
  }
});
```

### Example 2: SaaS Platform with Stripe

**Scenario:** SaaS platform using Stripe for subscriptions, want to add usage-based credits.

**Existing Schema:**
```prisma
model User {
  id                String   @id
  email             String   @unique
  stripeCustomerId  String?
  stripeSubscriptionId String?
  plan              String   @default("free")  // free, pro, enterprise
  planExpiresAt     DateTime?
}
```

**Solution:** Add credits field and use existing plan structure

```sql
-- Migration: Add credits field
ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 0;
```

```prisma
model User {
  id                   String    @id
  email                String    @unique
  stripeCustomerId     String?
  stripeSubscriptionId String?
  plan                 String    @default("free")
  planExpiresAt        DateTime?
  credits              Int       @default(0)  // New field
  
  transactions         Transaction[]
  auditLogs            AuditLog[]
}
```

```typescript
// Use PrismaAdapter with field mapping
const adapter = new PrismaAdapter(prisma);
const engine = new CreditsEngine({
  storage: adapter,
  config: {
    costs: {
      'api-call': { free: 10, pro: 5, enterprise: 1 },
      'export-data': { free: 100, pro: 50, enterprise: 10 }
    },
    membership: {
      tiers: { free: 0, pro: 1, enterprise: 2 },
      requirements: {
        'api-call': null,
        'export-data': 'pro'
      }
    }
  }
});

// Webhook handler for Stripe subscription updates
async function handleStripeWebhook(event: Stripe.Event) {
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object;
    
    // Update user plan
    await prisma.user.update({
      where: { stripeCustomerId: subscription.customer },
      data: {
        plan: subscription.items.data[0].price.lookup_key,
        planExpiresAt: new Date(subscription.current_period_end * 1000)
      }
    });
    
    // Grant monthly credits based on plan
    const creditsToGrant = {
      'free': 100,
      'pro': 1000,
      'enterprise': 10000
    };
    
    await engine.grant({
      userId: user.id,
      amount: creditsToGrant[subscription.items.data[0].price.lookup_key],
      action: 'monthly-grant'
    });
  }
}
```

### Example 3: Multi-tenant Application

**Scenario:** Multi-tenant SaaS where each organization has credits, not individual users.

**Existing Schema:**
```prisma
model Organization {
  id        String   @id
  name      String
  plan      String
  users     User[]
}

model User {
  id             String   @id
  email          String   @unique
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
}
```

**Solution:** Add credits at organization level

```sql
ALTER TABLE organizations ADD COLUMN credits INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN membership_tier VARCHAR(50);
ALTER TABLE organizations ADD COLUMN membership_expires_at TIMESTAMP;
```

```typescript
export class OrganizationAdapter implements IStorageAdapter {
  constructor(private prisma: PrismaClient) {}
  
  async getUserById(userId: string, txn?: any): Promise<User | null> {
    const client = txn || this.prisma;
    
    // Get user's organization
    const user = await client.user.findUnique({
      where: { id: userId },
      include: { organization: true }
    });
    
    if (!user || !user.organization) return null;
    
    // Return organization's credits as "user" credits
    return {
      id: user.organization.id,  // Use org ID
      credits: user.organization.credits,
      membershipTier: user.organization.membershipTier,
      membershipExpiresAt: user.organization.membershipExpiresAt,
      createdAt: user.organization.createdAt,
      updatedAt: user.organization.updatedAt
    };
  }
  
  async updateUserCredits(userId: string, amount: number, txn?: any): Promise<User> {
    const client = txn || this.prisma;
    
    // Get user's organization
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { organizationId: true }
    });
    
    if (!user) throw new Error('User not found');
    
    // Update organization credits
    const org = await client.organization.update({
      where: { id: user.organizationId },
      data: {
        credits: { increment: amount }
      }
    });
    
    return {
      id: org.id,
      credits: org.credits,
      membershipTier: org.membershipTier,
      membershipExpiresAt: org.membershipExpiresAt,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt
    };
  }
  
  // ... implement other methods
}
```

## Migration Scripts

### PostgreSQL Migration

```sql
-- Step 1: Add credits columns to existing user table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS membership_tier VARCHAR(50),
  ADD COLUMN IF NOT EXISTS membership_expires_at TIMESTAMP;

-- Step 2: Initialize credits for existing users
UPDATE users 
SET credits = 100 
WHERE credits = 0;

-- Step 3: Create SDK tables
CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(255) NOT NULL,
  action VARCHAR(255) NOT NULL,
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_created 
ON transactions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(255) NOT NULL,
  action VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created 
ON audit_logs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS idempotency_records (
  key VARCHAR(255) PRIMARY KEY,
  result JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires 
ON idempotency_records(expires_at);

-- Step 4: Create cleanup job for expired idempotency records
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_records()
RETURNS void AS $$
BEGIN
  DELETE FROM idempotency_records WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Optional: Schedule cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-idempotency', '0 * * * *', 'SELECT cleanup_expired_idempotency_records()');
```

### MySQL Migration

```sql
-- Step 1: Add credits columns
ALTER TABLE users 
  ADD COLUMN credits INT DEFAULT 0,
  ADD COLUMN membership_tier VARCHAR(50),
  ADD COLUMN membership_expires_at DATETIME;

-- Step 2: Initialize credits
UPDATE users 
SET credits = 100 
WHERE credits = 0;

-- Step 3: Create SDK tables
CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  action VARCHAR(255) NOT NULL,
  amount INT NOT NULL,
  balance_before INT NOT NULL,
  balance_after INT NOT NULL,
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_transactions_user_created (user_id, created_at DESC)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  action VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  metadata JSON,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_audit_logs_user_created (user_id, created_at DESC)
);

CREATE TABLE IF NOT EXISTS idempotency_records (
  `key` VARCHAR(255) PRIMARY KEY,
  result JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  INDEX idx_idempotency_expires (expires_at)
);
```

### Prisma Migration

```bash
# Step 1: Update your schema.prisma file
# (Add the SDK models as shown in the examples above)

# Step 2: Create migration
npx prisma migrate dev --name add_credits_system

# Step 3: Generate Prisma Client
npx prisma generate

# Step 4: Initialize credits for existing users (optional)
npx prisma db execute --file ./scripts/init-credits.sql
```

## Troubleshooting

### Issue: "User not found" errors

**Cause:** SDK is looking for users that don't have credits records yet.

**Solution:** Auto-create credits records in your adapter:

```typescript
async getUserById(userId: string, txn?: any): Promise<User | null> {
  const client = txn || this.prisma;
  
  let user = await client.user.findUnique({ where: { id: userId } });
  
  if (!user) return null;
  
  // Auto-initialize credits if null
  if (user.credits === null) {
    user = await client.user.update({
      where: { id: userId },
      data: { credits: 0 }
    });
  }
  
  return {
    id: user.id,
    credits: user.credits,
    membershipTier: user.membershipTier,
    membershipExpiresAt: user.membershipExpiresAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}
```

### Issue: Transaction rollback not working

**Cause:** Not passing transaction context correctly.

**Solution:** Ensure you pass `txn` parameter through all adapter methods:

```typescript
await prisma.$transaction(async (tx) => {
  // ✅ Correct: Pass tx to all operations
  await engine.charge({ userId, action, txn: tx });
  await prisma.post.create({ data: {...}, txn: tx });
  
  // ❌ Wrong: Missing txn parameter
  await engine.charge({ userId, action });  // Won't be in transaction!
});
```

### Issue: Performance problems with large transaction history

**Cause:** Missing database indexes.

**Solution:** Add indexes on frequently queried columns:

```sql
-- Add composite index for user + date queries
CREATE INDEX idx_transactions_user_date ON transactions(user_id, created_at DESC);

-- Add index for action filtering
CREATE INDEX idx_transactions_action ON transactions(action);

-- Add partial index for recent transactions (PostgreSQL)
CREATE INDEX idx_transactions_recent ON transactions(created_at DESC) 
WHERE created_at > NOW() - INTERVAL '30 days';
```

### Issue: Idempotency records growing too large

**Cause:** Old records not being cleaned up.

**Solution:** Set up automatic cleanup:

```typescript
// Cleanup job (run daily)
async function cleanupExpiredIdempotency() {
  await prisma.idempotencyRecord.deleteMany({
    where: {
      expiresAt: {
        lt: new Date()
      }
    }
  });
}

// Schedule with your job runner (e.g., node-cron)
cron.schedule('0 0 * * *', cleanupExpiredIdempotency);
```

## Best Practices

1. **Always backup before migration** - Test in development first
2. **Use transactions** - Wrap credit operations in database transactions
3. **Add indexes** - Index userId and createdAt columns for performance
4. **Monitor queries** - Use query logging to identify slow operations
5. **Set up cleanup jobs** - Regularly clean up expired idempotency records
6. **Handle edge cases** - Auto-initialize credits for new users
7. **Test rollback scenarios** - Ensure transaction rollback works correctly
8. **Document field mappings** - Keep clear documentation of how your fields map to SDK fields

## Need Help?

If you encounter issues not covered here:

1. Check the [main README](../README.md) for general documentation
2. Review the [Adapter Implementation Guide](./ADAPTER_IMPLEMENTATION_GUIDE.md)
3. Open an issue on [GitHub](https://github.com/Leochens/credit-sdk/issues)

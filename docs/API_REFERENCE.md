# API Reference

Complete API documentation for the Credit SDK.

## Table of Contents

- [CreditsEngine](#creditsengine)
- [Error Types](#error-types)
- [Type Definitions](#type-definitions)

## CreditsEngine

The main service class that coordinates all credit operations.

### Constructor

```typescript
new CreditsEngine(options: CreditsEngineOptions)
```

**Options:**
- `storage`: IStorageAdapter - Storage adapter implementation
- `config`: CreditsConfig - SDK configuration
- `logger?`: ILogAdapter - Optional custom logger (defaults to console)

**Example:**

```typescript
import { CreditsEngine, PrismaAdapter } from 'credit-sdk';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const adapter = new PrismaAdapter(prisma);

const engine = new CreditsEngine({
  storage: adapter,
  config: {
    costs: {
      'generate-post': { default: 10, premium: 8, enterprise: 5 }
    },
    membership: {
      tiers: { free: 0, premium: 1, enterprise: 2 },
      requirements: {
        'generate-post': null
      }
    }
  }
});
```

### Methods

#### charge(params: ChargeParams): Promise<ChargeResult>

Deduct credits from a user's balance.

**Parameters:**
- `userId`: string - User ID
- `action`: string - Operation name
- `idempotencyKey?`: string - Optional idempotency key
- `metadata?`: object - Optional metadata
- `txn?`: any - Optional transaction context

**Returns:** ChargeResult with transaction details

**Throws:**
- `InsufficientCreditsError` - User has insufficient credits
- `UserNotFoundError` - User does not exist
- `MembershipRequiredError` - User lacks required membership

**Example:**

```typescript
const result = await engine.charge({
  userId: 'user-123',
  action: 'generate-post',
  idempotencyKey: 'unique-request-id',
  metadata: { postId: 'post-456' }
});

console.log(`Charged ${result.cost} credits`);
console.log(`New balance: ${result.balanceAfter}`);
```

#### refund(params: RefundParams): Promise<RefundResult>

Return credits to a user's balance.

**Parameters:**
- `userId`: string - User ID
- `amount`: number - Refund amount
- `action`: string - Operation name for logging
- `idempotencyKey?`: string - Optional idempotency key
- `metadata?`: object - Optional metadata
- `txn?`: any - Optional transaction context

**Returns:** RefundResult with transaction details

**Example:**

```typescript
const result = await engine.refund({
  userId: 'user-123',
  amount: 10,
  action: 'refund-post',
  metadata: { reason: 'User cancelled' }
});
```

#### grant(params: GrantParams): Promise<GrantResult>

Grant credits to a user (promotions, rewards).

**Parameters:**
- `userId`: string - User ID
- `amount`: number - Grant amount (must be positive)
- `action`: string - Operation name for logging
- `idempotencyKey?`: string - Optional idempotency key
- `metadata?`: object - Optional metadata
- `txn?`: any - Optional transaction context

**Returns:** GrantResult with transaction details

**Example:**

```typescript
const result = await engine.grant({
  userId: 'user-123',
  amount: 50,
  action: 'signup-bonus',
  metadata: { campaign: 'new-user-2024' }
});
```

#### queryBalance(userId: string, txn?: any): Promise<number>

Query a user's current credit balance.

**Parameters:**
- `userId`: string - User ID
- `txn?`: any - Optional transaction context

**Returns:** Current credit balance

**Example:**

```typescript
const balance = await engine.queryBalance('user-123');
console.log(`User has ${balance} credits`);
```

#### getHistory(userId: string, options?: HistoryOptions): Promise<Transaction[]>

Retrieve user's transaction history.

**Parameters:**
- `userId`: string - User ID
- `options?`: HistoryOptions - Query options
  - `limit?`: number - Maximum records to return
  - `offset?`: number - Pagination offset
  - `startDate?`: Date - Filter by start date
  - `endDate?`: Date - Filter by end date
  - `action?`: string - Filter by action type
  - `txn?`: any - Optional transaction context

**Returns:** Array of transactions, sorted by date descending

**Example:**

```typescript
// Get last 10 transactions
const history = await engine.getHistory('user-123', {
  limit: 10,
  offset: 0
});

// Filter by date range
const history = await engine.getHistory('user-123', {
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31')
});

// Filter by action
const history = await engine.getHistory('user-123', {
  action: 'generate-post'
});
```

#### validateAccess(userId: string, action: string, txn?: any): Promise<boolean>

Validate if a user has permission to perform an action.

**Parameters:**
- `userId`: string - User ID
- `action`: string - Action to validate
- `txn?`: any - Optional transaction context

**Returns:** true if user has access

**Throws:**
- `MembershipRequiredError` - User lacks required membership

**Example:**

```typescript
try {
  const hasAccess = await engine.validateAccess('user-123', 'generate-image');
  if (hasAccess) {
    // Proceed with operation
  }
} catch (error) {
  if (error instanceof MembershipRequiredError) {
    console.log(`Requires ${error.required} membership`);
  }
}
```

#### upgradeTier(params: UpgradeTierParams): Promise<TierChangeResult>

Upgrade a user's membership tier and set credits to the target tier's cap.

**Parameters:**
- `userId`: string - User ID
- `targetTier`: string - Target membership tier
- `membershipExpiresAt?`: Date | null - Optional membership expiration date
- `idempotencyKey?`: string - Optional idempotency key
- `metadata?`: object - Optional metadata
- `txn?`: any - Optional transaction context

**Returns:** TierChangeResult with tier change details

**Throws:**
- `UserNotFoundError` - User does not exist
- `UndefinedTierError` - Target tier is not defined in configuration
- `InvalidTierChangeError` - Target tier is not higher than current tier

**Example:**

```typescript
const result = await engine.upgradeTier({
  userId: 'user-123',
  targetTier: 'premium',
  membershipExpiresAt: new Date('2025-12-31'),
  metadata: { reason: 'Annual subscription purchase' }
});

console.log(`Upgraded from ${result.oldTier} to ${result.newTier}`);
console.log(`Credits changed from ${result.oldCredits} to ${result.newCredits}`);
console.log(`Credit delta: ${result.creditsDelta}`);
```

#### downgradeTier(params: DowngradeTierParams): Promise<TierChangeResult>

Downgrade a user's membership tier and set credits to the target tier's cap.

**Parameters:**
- `userId`: string - User ID
- `targetTier`: string - Target membership tier
- `clearExpiration?`: boolean - Whether to clear membership expiration date (default: false)
- `idempotencyKey?`: string - Optional idempotency key
- `metadata?`: object - Optional metadata
- `txn?`: any - Optional transaction context

**Returns:** TierChangeResult with tier change details

**Throws:**
- `UserNotFoundError` - User does not exist
- `UndefinedTierError` - Target tier is not defined in configuration
- `InvalidTierChangeError` - Target tier is not lower than current tier

**Example:**

```typescript
const result = await engine.downgradeTier({
  userId: 'user-123',
  targetTier: 'free',
  clearExpiration: true,
  metadata: { reason: 'Subscription expired' }
});

console.log(`Downgraded from ${result.oldTier} to ${result.newTier}`);
console.log(`Credits adjusted from ${result.oldCredits} to ${result.newCredits}`);
```

## Error Types

All errors extend `CreditsSDKError` and include a `code` property.

### InsufficientCreditsError

Thrown when user has insufficient credits for an operation.

**Properties:**
- `userId`: string
- `required`: number - Required amount
- `available`: number - Available amount
- `code`: 'INSUFFICIENT_CREDITS'

**Example:**

```typescript
try {
  await engine.charge({ userId, action });
} catch (error) {
  if (error instanceof InsufficientCreditsError) {
    console.log(`Need ${error.required} credits, but only have ${error.available}`);
  }
}
```

### UserNotFoundError

Thrown when user ID does not exist.

**Properties:**
- `userId`: string
- `code`: 'USER_NOT_FOUND'

### MembershipRequiredError

Thrown when user lacks required membership tier.

**Properties:**
- `userId`: string
- `required`: string - Required tier
- `current`: string | null - Current tier
- `code`: 'MEMBERSHIP_REQUIRED'

### ConfigurationError

Thrown when SDK configuration is invalid.

**Properties:**
- `code`: 'CONFIGURATION_ERROR'

### UndefinedActionError

Thrown when action has no defined cost.

**Properties:**
- `action`: string
- `code`: 'UNDEFINED_ACTION'

### InvalidTierChangeError

Thrown when attempting an invalid tier change (e.g., upgrading to a lower tier).

**Properties:**
- `userId`: string
- `currentTier`: string | null - Current tier
- `targetTier`: string - Target tier
- `reason`: string - Reason for invalidity
- `code`: 'INVALID_TIER_CHANGE'

**Example:**

```typescript
try {
  await engine.upgradeTier({ userId, targetTier: 'free' });
} catch (error) {
  if (error instanceof InvalidTierChangeError) {
    console.log(`Cannot change from ${error.currentTier} to ${error.targetTier}: ${error.reason}`);
  }
}
```

### UndefinedTierError

Thrown when a tier is not defined in the configuration.

**Properties:**
- `tier`: string - The undefined tier
- `code`: 'UNDEFINED_TIER'

**Example:**

```typescript
try {
  await engine.upgradeTier({ userId, targetTier: 'platinum' });
} catch (error) {
  if (error instanceof UndefinedTierError) {
    console.log(`Tier '${error.tier}' is not configured`);
  }
}
```

## Type Definitions

### ChargeParams

```typescript
interface ChargeParams {
  userId: string;
  action: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
  txn?: any;
}
```

### ChargeResult

```typescript
interface ChargeResult {
  success: boolean;
  transactionId: string;
  userId: string;
  action: string;
  cost: number;
  balanceBefore: number;
  balanceAfter: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}
```

### RefundParams

```typescript
interface RefundParams {
  userId: string;
  amount: number;
  action: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
  txn?: any;
}
```

### GrantParams

```typescript
interface GrantParams {
  userId: string;
  amount: number;
  action: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
  txn?: any;
}
```

### HistoryOptions

```typescript
interface HistoryOptions {
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
  action?: string;
  txn?: any;
}
```

### Transaction

```typescript
interface Transaction {
  id: string;
  userId: string;
  action: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  metadata: Record<string, any>;
  createdAt: Date;
}
```

### User

```typescript
interface User {
  id: string;
  credits: number;
  membershipTier: string | null;
  membershipExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### CreditsConfig

```typescript
interface CreditsConfig {
  costs: {
    [action: string]: {
      default: number;
      [tier: string]: number;
    };
  };
  membership?: {
    tiers: {
      [tierName: string]: number;
    };
    requirements: {
      [action: string]: string | null;
    };
    creditsCaps: {
      [tier: string]: number;
    };
  };
  retry?: {
    enabled: boolean;
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };
  idempotency?: {
    enabled: boolean;
    ttl: number;
  };
  audit?: {
    enabled: boolean;
  };
}
```

### UpgradeTierParams

```typescript
interface UpgradeTierParams {
  userId: string;
  targetTier: string;
  membershipExpiresAt?: Date | null;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
  txn?: any;
}
```

### DowngradeTierParams

```typescript
interface DowngradeTierParams {
  userId: string;
  targetTier: string;
  clearExpiration?: boolean;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
  txn?: any;
}
```

### TierChangeResult

```typescript
interface TierChangeResult {
  success: true;
  transactionId: string;
  oldTier: string | null;
  newTier: string;
  oldCredits: number;
  newCredits: number;
  creditsDelta: number;
}
```


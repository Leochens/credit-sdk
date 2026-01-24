# Configuration Guide

Complete guide to configuring the Credit SDK.

## Table of Contents

- [Cost Configuration](#cost-configuration)
- [Membership Configuration](#membership-configuration)
- [Retry Configuration](#retry-configuration)
- [Idempotency Configuration](#idempotency-configuration)
- [Audit Configuration](#audit-configuration)
- [Complete Example](#complete-example)

## Cost Configuration

Define credit costs for different operations and membership tiers.

### Basic Cost Configuration

```typescript
costs: {
  'generate-post': {
    default: 10      // Cost for users without membership
  }
}
```

### Tiered Pricing

```typescript
costs: {
  'generate-post': {
    default: 10,      // Default cost for non-members
    basic: 10,        // Basic tier cost
    premium: 8,       // Premium tier gets 20% discount
    enterprise: 5     // Enterprise tier gets 50% discount
  },
  'generate-image': {
    default: 20,
    premium: 15,
    enterprise: 10
  },
  'api-call': {
    default: 1,
    premium: 0.5,
    enterprise: 0.1
  }
}
```

### Dynamic Pricing Strategy

You can implement different pricing strategies:

**Volume Discounts:**
```typescript
costs: {
  'api-call-small': { default: 1, premium: 0.8, enterprise: 0.5 },
  'api-call-medium': { default: 5, premium: 4, enterprise: 2 },
  'api-call-large': { default: 20, premium: 15, enterprise: 8 }
}
```

**Feature-Based Pricing:**
```typescript
costs: {
  'basic-feature': { default: 5, premium: 5, enterprise: 5 },
  'advanced-feature': { default: 50, premium: 30, enterprise: 10 },
  'premium-feature': { premium: 20, enterprise: 10 }  // Not available to default tier
}
```

## Membership Configuration

Define membership tiers, access requirements, and credit caps.

### Tier Hierarchy

```typescript
membership: {
  // Tier hierarchy (higher number = higher tier)
  tiers: {
    free: 0,
    basic: 1,
    premium: 2,
    enterprise: 3
  }
}
```

**Rules:**
- Tier values must be numbers
- Higher numbers represent higher tiers
- Users with higher tiers can access features requiring lower tiers

### Credit Caps

Each membership tier can have a maximum credit balance (credit cap). When a user is upgraded or downgraded, their credits are automatically set to the new tier's cap.

```typescript
membership: {
  tiers: {
    free: 0,
    basic: 1,
    premium: 2,
    enterprise: 3
  },
  creditsCaps: {
    free: 100,        // Free users get 100 credits
    basic: 500,       // Basic users get 500 credits
    premium: 2000,    // Premium users get 2000 credits
    enterprise: 10000 // Enterprise users get 10000 credits
  }
}
```

**Rules:**
- Every tier defined in `tiers` must have a corresponding entry in `creditsCaps`
- Credit caps must be non-negative numbers
- Credit caps are applied automatically during tier upgrades and downgrades

**Example Use Cases:**

**Generous Free Tier:**
```typescript
creditsCaps: {
  free: 1000,
  premium: 5000,
  enterprise: 50000
}
```

**Strict Free Tier:**
```typescript
creditsCaps: {
  free: 50,
  premium: 1000,
  enterprise: 10000
}
```

**Equal Starting Point:**
```typescript
creditsCaps: {
  free: 100,
  basic: 100,    // Same as free, but different pricing
  premium: 500,
  enterprise: 2000
}
```

### Access Requirements

```typescript
membership: {
  tiers: {
    free: 0,
    basic: 1,
    premium: 2,
    enterprise: 3
  },
  requirements: {
    'generate-post': null,        // Available to all users
    'generate-image': 'premium',  // Requires premium or higher
    'api-access': 'enterprise',   // Requires enterprise
    'export-data': 'basic'        // Requires basic or higher
  }
}
```

**Rules:**
- `null` means available to all users
- String value specifies minimum required tier
- Users with higher tiers automatically have access

### Example: SaaS Platform

```typescript
membership: {
  tiers: {
    free: 0,
    starter: 1,
    professional: 2,
    business: 3,
    enterprise: 4
  },
  creditsCaps: {
    free: 100,
    starter: 500,
    professional: 2000,
    business: 5000,
    enterprise: 20000
  },
  requirements: {
    // Free tier features
    'basic-search': null,
    'view-dashboard': null,
    
    // Starter tier features
    'export-csv': 'starter',
    'api-access': 'starter',
    
    // Professional tier features
    'advanced-analytics': 'professional',
    'custom-reports': 'professional',
    
    // Business tier features
    'team-collaboration': 'business',
    'priority-support': 'business',
    
    // Enterprise tier features
    'sso-integration': 'enterprise',
    'dedicated-support': 'enterprise'
  }
}
```

### Tier Management Operations

The SDK provides methods to upgrade and downgrade user membership tiers:

**Upgrading a User:**
```typescript
const result = await engine.upgradeTier({
  userId: 'user-123',
  targetTier: 'premium',
  membershipExpiresAt: new Date('2025-12-31'),
  metadata: { reason: 'Annual subscription' }
});

// User's tier is now 'premium'
// User's credits are now set to creditsCaps.premium (2000)
```

**Downgrading a User:**
```typescript
const result = await engine.downgradeTier({
  userId: 'user-123',
  targetTier: 'free',
  clearExpiration: true,
  metadata: { reason: 'Subscription expired' }
});

// User's tier is now 'free'
// User's credits are now set to creditsCaps.free (100)
// membershipExpiresAt is cleared
```

**Key Behaviors:**
- Credits are automatically set to the target tier's cap
- Excess credits are lost on downgrade
- Membership expiration can be set on upgrade
- Membership expiration can be cleared on downgrade
- All operations are logged in audit trail
- Operations support idempotency keys
- Operations can be executed within transactions

## Retry Configuration

Configure automatic retry behavior for transient failures.

### Basic Retry Configuration

```typescript
retry: {
  enabled: true,
  maxAttempts: 3,
  initialDelay: 100,
  maxDelay: 5000,
  backoffMultiplier: 2
}
```

### Configuration Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `enabled` | boolean | Enable/disable retry mechanism | `true` |
| `maxAttempts` | number | Maximum number of retry attempts | `3` |
| `initialDelay` | number | Initial delay in milliseconds | `100` |
| `maxDelay` | number | Maximum delay in milliseconds | `5000` |
| `backoffMultiplier` | number | Exponential backoff multiplier | `2` |

### Retry Behavior

With the default configuration:
- **Attempt 1**: Immediate
- **Attempt 2**: Wait 100ms (initialDelay)
- **Attempt 3**: Wait 200ms (100ms × 2)
- **Attempt 4**: Wait 400ms (200ms × 2)

The delay is capped at `maxDelay`.

### Recommended Configurations

**Aggressive Retry (Low Latency):**
```typescript
retry: {
  enabled: true,
  maxAttempts: 5,
  initialDelay: 50,
  maxDelay: 1000,
  backoffMultiplier: 1.5
}
```

**Conservative Retry (High Reliability):**
```typescript
retry: {
  enabled: true,
  maxAttempts: 3,
  initialDelay: 200,
  maxDelay: 10000,
  backoffMultiplier: 3
}
```

**Disable Retry:**
```typescript
retry: {
  enabled: false
}
```

## Idempotency Configuration

Configure idempotency behavior to prevent duplicate operations.

### Basic Idempotency Configuration

```typescript
idempotency: {
  enabled: true,
  ttl: 86400  // 24 hours in seconds
}
```

### Configuration Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `enabled` | boolean | Enable/disable idempotency | `true` |
| `ttl` | number | Record retention time in seconds | `86400` |

### TTL Recommendations

**Short-lived Operations (API calls):**
```typescript
idempotency: {
  enabled: true,
  ttl: 3600  // 1 hour
}
```

**Standard Operations (Payments, Credits):**
```typescript
idempotency: {
  enabled: true,
  ttl: 86400  // 24 hours
}
```

**Long-lived Operations (Subscriptions):**
```typescript
idempotency: {
  enabled: true,
  ttl: 604800  // 7 days
}
```

**Disable Idempotency:**
```typescript
idempotency: {
  enabled: false
}
```

### How Idempotency Works

1. Client provides an `idempotencyKey` with the request
2. SDK checks if this key was used before (within TTL)
3. If found, returns the cached result
4. If not found, processes the request and caches the result

**Example:**

```typescript
// First request
const result1 = await engine.charge({
  userId: 'user-123',
  action: 'generate-post',
  idempotencyKey: 'unique-key-123'
});
// Processes normally, charges credits

// Duplicate request (within TTL)
const result2 = await engine.charge({
  userId: 'user-123',
  action: 'generate-post',
  idempotencyKey: 'unique-key-123'
});
// Returns cached result, does NOT charge credits again
```

## Audit Configuration

Configure audit logging for compliance and debugging.

### Basic Audit Configuration

```typescript
audit: {
  enabled: true
}
```

### Configuration Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `enabled` | boolean | Enable/disable audit logging | `true` |

### What Gets Logged

When audit is enabled, the SDK logs:
- All charge operations (success and failure)
- All refund operations
- All grant operations
- User ID and action
- Operation status
- Error messages (if failed)
- Metadata
- Timestamp

### Audit Log Structure

```typescript
interface AuditLog {
  id: string;
  userId: string;
  action: string;
  status: 'success' | 'failed';
  metadata: Record<string, any>;
  errorMessage?: string;
  createdAt: Date;
}
```

### Querying Audit Logs

```typescript
// Get audit logs for a user
const logs = await adapter.getAuditLogs('user-123', {
  limit: 100,
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31')
});
```

## Complete Example

Here's a complete configuration for a typical SaaS platform:

```typescript
import { CreditsEngine, PrismaAdapter } from 'credit-sdk';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const adapter = new PrismaAdapter(prisma);

const engine = new CreditsEngine({
  storage: adapter,
  config: {
    // Cost configuration
    costs: {
      // Content generation
      'generate-post': { 
        default: 10, 
        starter: 10, 
        professional: 8, 
        enterprise: 5 
      },
      'generate-image': { 
        default: 20, 
        starter: 20, 
        professional: 15, 
        enterprise: 10 
      },
      
      // API calls
      'api-call': { 
        default: 1, 
        starter: 1, 
        professional: 0.5, 
        enterprise: 0.1 
      },
      
      // Data export
      'export-csv': { 
        starter: 5, 
        professional: 3, 
        enterprise: 1 
      },
      'export-pdf': { 
        professional: 10, 
        enterprise: 5 
      },
      
      // Advanced features
      'custom-report': { 
        professional: 50, 
        enterprise: 25 
      },
      'ai-analysis': { 
        professional: 100, 
        enterprise: 50 
      }
    },
    
    // Membership configuration
    membership: {
      tiers: {
        free: 0,
        starter: 1,
        professional: 2,
        enterprise: 3
      },
      creditsCaps: {
        free: 100,
        starter: 500,
        professional: 2000,
        enterprise: 10000
      },
      requirements: {
        // Free tier
        'generate-post': null,
        'api-call': null,
        
        // Starter tier
        'generate-image': 'starter',
        'export-csv': 'starter',
        
        // Professional tier
        'export-pdf': 'professional',
        'custom-report': 'professional',
        'ai-analysis': 'professional',
        
        // Enterprise tier
        'priority-support': 'enterprise',
        'dedicated-account': 'enterprise'
      }
    },
    
    // Retry configuration
    retry: {
      enabled: true,
      maxAttempts: 3,
      initialDelay: 100,
      maxDelay: 5000,
      backoffMultiplier: 2
    },
    
    // Idempotency configuration
    idempotency: {
      enabled: true,
      ttl: 86400  // 24 hours
    },
    
    // Audit configuration
    audit: {
      enabled: true
    }
  }
});

export default engine;
```

## Environment-Specific Configuration

### Development

```typescript
config: {
  costs: { /* ... */ },
  membership: { /* ... */ },
  retry: {
    enabled: true,
    maxAttempts: 2,  // Faster feedback
    initialDelay: 50,
    maxDelay: 1000,
    backoffMultiplier: 2
  },
  idempotency: {
    enabled: true,
    ttl: 3600  // Shorter TTL for testing
  },
  audit: {
    enabled: true  // Always log in development
  }
}
```

### Production

```typescript
config: {
  costs: { /* ... */ },
  membership: { /* ... */ },
  retry: {
    enabled: true,
    maxAttempts: 3,
    initialDelay: 100,
    maxDelay: 5000,
    backoffMultiplier: 2
  },
  idempotency: {
    enabled: true,
    ttl: 86400  // 24 hours
  },
  audit: {
    enabled: true  // Critical for compliance
  }
}
```

### Testing

```typescript
config: {
  costs: { /* ... */ },
  membership: { /* ... */ },
  retry: {
    enabled: false  // Disable for predictable tests
  },
  idempotency: {
    enabled: false  // Disable for test isolation
  },
  audit: {
    enabled: false  // Reduce noise in tests
  }
}
```

## Best Practices

1. **Cost Configuration**
   - Start with simple pricing, add tiers as needed
   - Use consistent discount percentages across tiers
   - Document pricing strategy in comments

2. **Membership Configuration**
   - Keep tier hierarchy simple and logical
   - Use descriptive tier names
   - Document access requirements clearly

3. **Retry Configuration**
   - Enable retry in production
   - Adjust based on your database latency
   - Monitor retry rates to detect issues

4. **Idempotency Configuration**
   - Always enable in production
   - Set TTL based on operation type
   - Clean up expired records regularly

5. **Audit Configuration**
   - Always enable in production
   - Use for compliance and debugging
   - Archive old logs periodically

6. **Environment Variables**
   - Store configuration in environment variables
   - Use different configs for dev/staging/prod
   - Never commit sensitive configuration

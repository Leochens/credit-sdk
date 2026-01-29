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

### 动态成本公式

SDK 支持动态成本公式，可以根据实际资源消耗（如 AI token、处理时间、数据量等）计算费用。

**基础动态公式：**
```typescript
costs: {
  'ai-completion': {
    default: '{token} * 0.001 + 10',      // 每 token 0.001 积分 + 10 基础费用
    premium: '{token} * 0.0008 + 8',      // 会员折扣
    enterprise: '{token} * 0.0005 + 5'
  }
}
```

**多变量公式：**
```typescript
costs: {
  'video-processing': {
    default: '{duration} * 2 + {resolution} * 0.5',
    premium: '({duration} * 2 + {resolution} * 0.5) * 0.8'  // 20% 折扣
  }
}
```

**阶梯定价公式：**
```typescript
costs: {
  'data-analysis': {
    // 前 1000 行：每行 0.1 积分
    // 额外行数：每行 0.05 积分
    default: '{rows} <= 1000 ? {rows} * 0.1 : 100 + ({rows} - 1000) * 0.05',
    premium: '{rows} <= 1000 ? {rows} * 0.08 : 80 + ({rows} - 1000) * 0.04'
  }
}
```

**混合配置（固定 + 动态）：**
```typescript
costs: {
  // 固定成本（传统方式）
  'generate-image': { 
    default: 20, 
    premium: 15, 
    enterprise: 10 
  },
  
  // 动态公式
  'ai-completion': {
    default: '{token} * 0.001 + 10',
    premium: '{token} * 0.0008 + 8'
  }
}
```

**支持的运算符：**
- 算术运算：`+`, `-`, `*`, `/`
- 比较运算：`<`, `>`, `<=`, `>=`, `==`, `!=`
- 三元运算：`condition ? valueIfTrue : valueIfFalse`
- 括号：`(`, `)` 用于控制优先级

**变量命名规则：**
- 必须以字母开头
- 可以包含字母、数字和下划线
- 格式：`{variableName}`

**使用动态公式：**
```typescript
// 使用变量计费
const result = await engine.charge({
  userId: 'user-123',
  action: 'ai-completion',
  variables: {
    token: 3500  // 使用了 3500 个 token
  }
});
// 成本: 3500 * 0.001 + 10 = 13.5 积分
```

**回退机制：**
```typescript
costs: {
  'ai-completion': {
    default: 10,  // 回退值（数字）
    premium: '{token} * 0.0008 + 8'  // 公式
  }
}

// 不提供变量 - 使用回退值
await engine.charge({
  userId: 'user-123',
  action: 'ai-completion'
  // 未提供变量，使用 10 积分
});

// 提供变量 - 使用公式
await engine.charge({
  userId: 'user-123',
  action: 'ai-completion',
  variables: { token: 1000 }
  // 使用公式: 1000 * 0.0008 + 8 = 8.8 积分
});
```

**交易元数据：**

动态成本计算会自动记录在交易元数据中：

```typescript
const result = await engine.charge({
  userId: 'user-123',
  action: 'ai-completion',
  variables: { token: 3500 }
});

// 交易记录包含：
// {
//   metadata: {
//     dynamicCost: {
//       formula: '{token} * 0.001 + 10',
//       variables: { token: 3500 },
//       rawCost: 13.5,
//       finalCost: 13.5
//     }
//   }
// }
```

**错误处理：**

```typescript
import { MissingVariableError, FormulaEvaluationError } from 'credit-sdk';

try {
  await engine.charge({
    userId: 'user-123',
    action: 'ai-completion',
    variables: { token: 1000 }
  });
} catch (error) {
  if (error instanceof MissingVariableError) {
    // 公式需要的变量未提供
    console.error('缺少变量:', error.missingVariable);
  } else if (error instanceof FormulaEvaluationError) {
    // 公式计算错误（如除零）
    console.error('公式错误:', error.cause);
  }
}
```

### 静态定价策略

您也可以实现不同的静态定价策略：

**批量折扣：**
```typescript
costs: {
  'api-call-small': { default: 1, premium: 0.8, enterprise: 0.5 },
  'api-call-medium': { default: 5, premium: 4, enterprise: 2 },
  'api-call-large': { default: 20, premium: 15, enterprise: 8 }
}
```

**基于功能的定价：**
```typescript
costs: {
  'basic-feature': { default: 5, premium: 5, enterprise: 5 },
  'advanced-feature': { default: 50, premium: 30, enterprise: 10 },
  'premium-feature': { premium: 20, enterprise: 10 }  // 默认等级不可用
}
```

## Membership Configuration

Define membership tiers and access requirements.

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

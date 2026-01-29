# credit-sdk

[English](#english) | [中文](#中文)

---

<a name="english"></a>

# Credit SDK - Universal SaaS Credits Management System

A decoupled, transaction-aware credits management SDK for subscription-based SaaS platforms. Built with an adapter-first architecture to avoid ORM lock-in while maintaining transaction integrity and reliability.

## ✨ Features

- 🔌 **Adapter Pattern**: Integrate with any database system without ORM lock-in
- 🔄 **Transaction Passthrough**: Embed SDK operations within larger business transactions
- 🔒 **Idempotency**: Automatic prevention of duplicate charges
- 👥 **Membership Management**: Tier-based pricing and access control
- 📝 **Audit Trail**: Complete operation logging for compliance and debugging
- 🔁 **Auto Retry**: Intelligent retry mechanism for transient failures
- 📊 **TypeScript**: Full type safety with excellent IDE support
- ⚡ **Zero Dependencies**: Core has no runtime dependencies (adapters optional)

## 📦 Installation

```bash
npm install credit-sdk
```

If using Prisma adapter:
```bash
npm install credit-sdk @prisma/client
```

## 🚀 Quick Start

```typescript
import { CreditsEngine, PrismaAdapter } from 'credit-sdk';
import { PrismaClient } from '@prisma/client';

// Initialize
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
        'generate-post': null  // Available to all
      }
    }
  }
});

// Charge credits
const result = await engine.charge({
  userId: 'user-123',
  action: 'generate-post'
});

console.log(`Charged ${result.cost} credits. New balance: ${result.balanceAfter}`);
```

## 📚 Core Operations

```typescript
// Charge credits
await engine.charge({
  userId: 'user-123',
  action: 'generate-post',
  idempotencyKey: 'unique-key',
  metadata: { postId: 'post-456' }
});

// Refund credits
await engine.refund({
  userId: 'user-123',
  amount: 10,
  action: 'refund-post'
});

// Grant credits (promotions, rewards)
await engine.grant({
  userId: 'user-123',
  amount: 50,
  action: 'signup-bonus'
});

// Query balance
const balance = await engine.queryBalance('user-123');

// Get transaction history
const history = await engine.getHistory('user-123', {
  limit: 10,
  offset: 0
});

// Validate access
const hasAccess = await engine.validateAccess('user-123', 'premium-feature');
```

## � Dynamic Cost Formula

The SDK supports dynamic cost formulas that calculate charges based on actual resource consumption (e.g., AI tokens, processing time).

### Basic Configuration

```typescript
const engine = new CreditsEngine({
  storage: adapter,
  config: {
    costs: {
      // Fixed cost (traditional)
      'generate-image': { 
        default: 20, 
        premium: 15 
      },
      
      // Dynamic formula based on tokens
      'ai-completion': {
        default: '{token} * 0.001 + 10',      // 0.001 credits per token + 10 base fee
        premium: '{token} * 0.0008 + 8',      // Member discount
        enterprise: '{token} * 0.0005 + 5'
      },
      
      // Multi-variable formula
      'video-processing': {
        default: '{duration} * 2 + {resolution} * 0.5',
        premium: '({duration} * 2 + {resolution} * 0.5) * 0.8'  // 20% discount
      }
    }
  }
});
```

### Usage Examples

#### Token-Based Billing (AI Services)

```typescript
// Charge based on actual token usage
const result = await engine.charge({
  userId: 'user-123',
  action: 'ai-completion',
  variables: {
    token: 3500  // Used 3500 tokens
  }
});
// Cost: 3500 * 0.001 + 10 = 13.5 credits
```

#### Duration-Based Billing

```typescript
// Charge based on processing time
const result = await engine.charge({
  userId: 'user-123',
  action: 'video-processing',
  variables: {
    duration: 120,    // 120 seconds
    resolution: 1080  // 1080p
  }
});
// Cost: 120 * 2 + 1080 * 0.5 = 780 credits
```

#### Tiered Pricing

```typescript
const engine = new CreditsEngine({
  storage: adapter,
  config: {
    costs: {
      'data-analysis': {
        // First 1000 rows: 0.1 credits each
        // Additional rows: 0.05 credits each
        default: '{rows} <= 1000 ? {rows} * 0.1 : 100 + ({rows} - 1000) * 0.05'
      }
    }
  }
});

// Small dataset
await engine.charge({
  userId: 'user-123',
  action: 'data-analysis',
  variables: { rows: 500 }
});
// Cost: 500 * 0.1 = 50 credits

// Large dataset
await engine.charge({
  userId: 'user-123',
  action: 'data-analysis',
  variables: { rows: 2000 }
});
// Cost: 100 + (2000 - 1000) * 0.05 = 150 credits
```

### Fallback Mechanism

If variables are not provided, the system uses the default value (if it's a number):

```typescript
const engine = new CreditsEngine({
  storage: adapter,
  config: {
    costs: {
      'ai-completion': {
        default: 10,  // Fallback value
        premium: '{token} * 0.0008 + 8'
      }
    }
  }
});

// Without variables - uses fallback
await engine.charge({
  userId: 'user-123',
  action: 'ai-completion'
  // No variables provided
});
// Cost: 10 credits (fallback)

// With variables - uses formula
await engine.charge({
  userId: 'user-123',
  action: 'ai-completion',
  variables: { token: 1000 }
});
// Cost: 1000 * 0.0008 + 8 = 8.8 credits
```

### Transaction Metadata

Dynamic cost calculations are automatically recorded in transaction metadata:

```typescript
const result = await engine.charge({
  userId: 'user-123',
  action: 'ai-completion',
  variables: { token: 3500 }
});

// Transaction record includes:
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

### Supported Operators

- **Arithmetic**: `+`, `-`, `*`, `/`
- **Parentheses**: `(`, `)` for precedence
- **Comparison**: `<`, `>`, `<=`, `>=`, `==`, `!=`
- **Ternary**: `condition ? valueIfTrue : valueIfFalse`

### Variable Naming Rules

- Must start with a letter
- Can contain letters, numbers, and underscores
- Format: `{variableName}`

### Error Handling

```typescript
try {
  await engine.charge({
    userId: 'user-123',
    action: 'ai-completion',
    variables: { token: 1000 }
  });
} catch (error) {
  if (error instanceof MissingVariableError) {
    // Formula requires a variable that wasn't provided
    console.error('Missing variable:', error.missingVariable);
  } else if (error instanceof FormulaEvaluationError) {
    // Error during formula calculation (e.g., division by zero)
    console.error('Formula error:', error.cause);
  }
}
```

## 🔄 Transaction Support

```typescript
// Using Prisma transactions
await prisma.$transaction(async (tx) => {
  // Charge credits within transaction
  const result = await engine.charge({
    userId: 'user-123',
    action: 'generate-post',
    txn: tx  // Pass transaction context
  });
  
  // Other database operations in same transaction
  await tx.post.create({
    data: {
      userId: 'user-123',
      content: 'Generated content',
      creditsUsed: result.cost
    }
  });
  
  // If any operation fails, entire transaction rolls back
});
```

## 📖 Documentation

### 📚 Online Documentation
- **[View Documentation](https://Leochens.github.io/credit-sdk/)** - Beautiful online docs powered by Docsify

### Core Documentation
- [API Reference](docs/API_REFERENCE.md) - Complete API documentation
- [Configuration Guide](docs/CONFIGURATION.md) - Detailed configuration options
- [Database Setup](docs/DATABASE_SETUP.md) - Database setup and migrations

### Integration Guides
- [Integration Examples](docs/INTEGRATION_EXAMPLES.md) - Next.js, Express.js, and more
- [Existing Database Integration](docs/EXISTING_DATABASE_INTEGRATION.md) - Integrate with your existing database
- [Adapter Implementation Guide](docs/ADAPTER_IMPLEMENTATION_GUIDE.md) - Create custom adapters

### Testing & Development
- [Testing Guide](docs/TESTING.md) - Unit, integration, and property-based testing

## 🔌 Quick Integration Examples

### Next.js Server Actions

```typescript
'use server';

import { engine } from '@/lib/credits';

export async function generatePost(userId: string) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const chargeResult = await engine.charge({
        userId,
        action: 'generate-post',
        txn: tx
      });
      
      const post = await generateAIPost();
      const savedPost = await tx.post.create({ data: { ...post } });
      
      return { success: true, post: savedPost, creditsUsed: chargeResult.cost };
    });
    
    return result;
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return { success: false, error: 'Insufficient credits' };
    }
    return { success: false, error: 'Failed to generate post' };
  }
}
```

### Express.js API

```typescript
import express from 'express';
import { engine } from './config/credits';

const app = express();

app.post('/api/charge', async (req, res) => {
  try {
    const { userId, action } = req.body;
    const result = await engine.charge({ userId, action });
    res.json(result);
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      res.status(402).json({ error: 'Insufficient credits' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.listen(3000);
```

## 🗄️ Database Setup

### Quick Setup with Prisma

```bash
# Install dependencies
npm install prisma @prisma/client

# Initialize Prisma
npx prisma init

# Copy schema from prisma/schema.prisma in this repo

# Run migrations
npx prisma migrate dev --name init

# Generate Prisma Client
npx prisma generate
```

See [Database Setup Guide](docs/DATABASE_SETUP.md) for detailed instructions.

## 🧪 Testing

```typescript
import { CreditsEngine, MockAdapter } from 'credit-sdk';

describe('Credit Tests', () => {
  let engine: CreditsEngine;
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
    engine = new CreditsEngine({ storage: adapter, config });
  });

  it('should charge credits', async () => {
    await adapter.createUser({
      id: 'test-user',
      credits: 100,
      membershipTier: 'premium'
    });

    const result = await engine.charge({
      userId: 'test-user',
      action: 'generate-post'
    });

    expect(result.success).toBe(true);
    expect(result.balanceAfter).toBe(92); // 100 - 8 (premium price)
  });
});
```

See [Testing Guide](docs/TESTING.md) for comprehensive testing examples.

## 📖 Architecture

```
┌─────────────────────────────────────────────────┐
│              Application Layer                   │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│            CreditsEngine                         │
│  (Orchestrates all credit operations)            │
└─────────────────┬───────────────────────────────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
┌───────▼──┐ ┌───▼────┐ ┌─▼────────┐
│ Features │ │Adapter │ │  Logger  │
│ Modules  │ │  (DB)  │ │          │
└──────────┘ └────────┘ └──────────┘
```

### Design Principles

1. **Adapter Pattern**: Decouple storage layer from business logic
2. **Transaction Awareness**: Support embedding operations in larger transactions
3. **Idempotency**: Prevent duplicate charges automatically
4. **Type Safety**: Full TypeScript support with strict mode
5. **Zero Dependencies**: Core has no runtime dependencies

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/Leochens/credit-sdk.git
cd credit-sdk
npm install
npm test
npm run build
```

### Local Development

To use this SDK in another local project for testing:

```bash
# In credit-sdk directory
npm run build
npm link

# In your project directory
npm link credit-sdk
```

See [Local Development Guide](LOCAL_DEVELOPMENT.md) for detailed instructions.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🔗 Links

- [API Reference](docs/API_REFERENCE.md)
- [Configuration Guide](docs/CONFIGURATION.md)
- [Integration Examples](docs/INTEGRATION_EXAMPLES.md)
- [Testing Guide](docs/TESTING.md)
- [Database Setup](docs/DATABASE_SETUP.md)
- [Existing Database Integration](docs/EXISTING_DATABASE_INTEGRATION.md)
- [Adapter Implementation Guide](docs/ADAPTER_IMPLEMENTATION_GUIDE.md)
- [Issue Tracker](https://github.com/Leochens/credit-sdk/issues)
- [Changelog](CHANGELOG.md)

---

<a name="中文"></a>

# Credit SDK - 通用 SaaS 积分管理系统

为基于订阅的 SaaS 平台提供解耦的、事务感知的积分管理 SDK。采用适配器优先架构，避免 ORM 锁定，同时保持事务完整性和可靠性。

## ✨ 特性

- 🔌 **适配器模式**: 支持任何数据库系统，不锁定特定 ORM
- 🔄 **事务透传**: 将 SDK 操作嵌入到更大的业务事务中
- 🔒 **幂等性**: 自动防止重复扣费
- 👥 **会员管理**: 基于会员等级的定价和权限控制
- 📝 **审计日志**: 完整的操作记录用于合规和调试
- 🔁 **自动重试**: 对瞬态故障的智能重试机制
- 📊 **TypeScript**: 完整的类型安全和 IDE 支持
- ⚡ **零依赖**: 核心无运行时依赖（适配器可选）

## 📦 安装

```bash
npm install credit-sdk
```

如果使用 Prisma 适配器：
```bash
npm install credit-sdk @prisma/client
```

## 🚀 快速开始

```typescript
import { CreditsEngine, PrismaAdapter } from 'credit-sdk';
import { PrismaClient } from '@prisma/client';

// 初始化
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
        'generate-post': null  // 所有人可用
      }
    }
  }
});

// 扣费
const result = await engine.charge({
  userId: 'user-123',
  action: 'generate-post'
});

console.log(`扣费 ${result.cost} 积分。新余额: ${result.balanceAfter}`);
```

## 📚 核心操作

```typescript
// 扣费
await engine.charge({
  userId: 'user-123',
  action: 'generate-post',
  idempotencyKey: 'unique-key',
  metadata: { postId: 'post-456' }
});

// 退款
await engine.refund({
  userId: 'user-123',
  amount: 10,
  action: 'refund-post'
});

// 发放积分（促销、奖励）
await engine.grant({
  userId: 'user-123',
  amount: 50,
  action: 'signup-bonus'
});

// 查询余额
const balance = await engine.queryBalance('user-123');

// 获取交易历史
const history = await engine.getHistory('user-123', {
  limit: 10,
  offset: 0
});

// 验证访问权限
const hasAccess = await engine.validateAccess('user-123', 'premium-feature');
```

## � 动态成本公式

SDK 支持动态成本公式，可以根据实际资源消耗（如 AI token、处理时间等）计算费用。

### 基础配置

```typescript
const engine = new CreditsEngine({
  storage: adapter,
  config: {
    costs: {
      // 固定成本（传统方式）
      'generate-image': { 
        default: 20, 
        premium: 15 
      },
      
      // 基于 token 的动态公式
      'ai-completion': {
        default: '{token} * 0.001 + 10',      // 每 token 0.001 积分 + 10 基础费用
        premium: '{token} * 0.0008 + 8',      // 会员折扣
        enterprise: '{token} * 0.0005 + 5'
      },
      
      // 多变量公式
      'video-processing': {
        default: '{duration} * 2 + {resolution} * 0.5',
        premium: '({duration} * 2 + {resolution} * 0.5) * 0.8'  // 20% 折扣
      }
    }
  }
});
```

### 使用示例

#### 基于 Token 的计费（AI 服务）

```typescript
// 根据实际 token 使用量计费
const result = await engine.charge({
  userId: 'user-123',
  action: 'ai-completion',
  variables: {
    token: 3500  // 使用了 3500 个 token
  }
});
// 成本: 3500 * 0.001 + 10 = 13.5 积分
```

#### 基于时长的计费

```typescript
// 根据处理时间计费
const result = await engine.charge({
  userId: 'user-123',
  action: 'video-processing',
  variables: {
    duration: 120,    // 120 秒
    resolution: 1080  // 1080p
  }
});
// 成本: 120 * 2 + 1080 * 0.5 = 780 积分
```

#### 阶梯定价

```typescript
const engine = new CreditsEngine({
  storage: adapter,
  config: {
    costs: {
      'data-analysis': {
        // 前 1000 行：每行 0.1 积分
        // 额外行数：每行 0.05 积分
        default: '{rows} <= 1000 ? {rows} * 0.1 : 100 + ({rows} - 1000) * 0.05'
      }
    }
  }
});

// 小数据集
await engine.charge({
  userId: 'user-123',
  action: 'data-analysis',
  variables: { rows: 500 }
});
// 成本: 500 * 0.1 = 50 积分

// 大数据集
await engine.charge({
  userId: 'user-123',
  action: 'data-analysis',
  variables: { rows: 2000 }
});
// 成本: 100 + (2000 - 1000) * 0.05 = 150 积分
```

### 回退机制

如果未提供变量，系统会使用默认值（如果默认值是数字）：

```typescript
const engine = new CreditsEngine({
  storage: adapter,
  config: {
    costs: {
      'ai-completion': {
        default: 10,  // 回退值
        premium: '{token} * 0.0008 + 8'
      }
    }
  }
});

// 不提供变量 - 使用回退值
await engine.charge({
  userId: 'user-123',
  action: 'ai-completion'
  // 未提供变量
});
// 成本: 10 积分（回退值）

// 提供变量 - 使用公式
await engine.charge({
  userId: 'user-123',
  action: 'ai-completion',
  variables: { token: 1000 }
});
// 成本: 1000 * 0.0008 + 8 = 8.8 积分
```

### 交易元数据

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

### 支持的运算符

- **算术运算**: `+`, `-`, `*`, `/`
- **括号**: `(`, `)` 用于控制优先级
- **比较运算**: `<`, `>`, `<=`, `>=`, `==`, `!=`
- **三元运算**: `condition ? valueIfTrue : valueIfFalse`

### 变量命名规则

- 必须以字母开头
- 可以包含字母、数字和下划线
- 格式: `{variableName}`

### 错误处理

```typescript
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

## 🔄 事务支持

```typescript
// 使用 Prisma 事务
await prisma.$transaction(async (tx) => {
  // 在事务中扣费
  const result = await engine.charge({
    userId: 'user-123',
    action: 'generate-post',
    txn: tx  // 传递事务上下文
  });
  
  // 在同一事务中执行其他数据库操作
  await tx.post.create({
    data: {
      userId: 'user-123',
      content: '生成的内容',
      creditsUsed: result.cost
    }
  });
  
  // 如果任何操作失败，整个事务回滚
});
```

## 📖 文档

### 核心文档
- [API 参考](docs/API_REFERENCE.md) - 完整的 API 文档
- [配置指南](docs/CONFIGURATION.md) - 详细的配置选项
- [数据库设置](docs/DATABASE_SETUP.md) - 数据库设置和迁移

### 集成指南
- [集成示例](docs/INTEGRATION_EXAMPLES.md) - Next.js、Express.js 等
- [现有数据库集成](docs/EXISTING_DATABASE_INTEGRATION.md) - 与现有数据库集成
- [适配器实现指南](docs/ADAPTER_IMPLEMENTATION_GUIDE.md) - 创建自定义适配器

### 测试与开发
- [测试指南](docs/TESTING.md) - 单元测试、集成测试和基于属性的测试

## 🔌 快速集成示例

### Next.js Server Actions

```typescript
'use server';

import { engine } from '@/lib/credits';

export async function generatePost(userId: string) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const chargeResult = await engine.charge({
        userId,
        action: 'generate-post',
        txn: tx
      });
      
      const post = await generateAIPost();
      const savedPost = await tx.post.create({ data: { ...post } });
      
      return { success: true, post: savedPost, creditsUsed: chargeResult.cost };
    });
    
    return result;
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return { success: false, error: '积分不足' };
    }
    return { success: false, error: '生成文章失败' };
  }
}
```

### Express.js API

```typescript
import express from 'express';
import { engine } from './config/credits';

const app = express();

app.post('/api/charge', async (req, res) => {
  try {
    const { userId, action } = req.body;
    const result = await engine.charge({ userId, action });
    res.json(result);
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      res.status(402).json({ error: '积分不足' });
    } else {
      res.status(500).json({ error: '内部服务器错误' });
    }
  }
});

app.listen(3000);
```

## 🗄️ 数据库设置

### 使用 Prisma 快速设置

```bash
# 安装依赖
npm install prisma @prisma/client

# 初始化 Prisma
npx prisma init

# 从本仓库复制 prisma/schema.prisma 中的 schema

# 运行迁移
npx prisma migrate dev --name init

# 生成 Prisma Client
npx prisma generate
```

详细说明请参阅[数据库设置指南](docs/DATABASE_SETUP.md)。

## 🧪 测试

```typescript
import { CreditsEngine, MockAdapter } from 'credit-sdk';

describe('积分测试', () => {
  let engine: CreditsEngine;
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
    engine = new CreditsEngine({ storage: adapter, config });
  });

  it('应该扣费', async () => {
    await adapter.createUser({
      id: 'test-user',
      credits: 100,
      membershipTier: 'premium'
    });

    const result = await engine.charge({
      userId: 'test-user',
      action: 'generate-post'
    });

    expect(result.success).toBe(true);
    expect(result.balanceAfter).toBe(92); // 100 - 8（高级会员价格）
  });
});
```

完整的测试示例请参阅[测试指南](docs/TESTING.md)。

## 📖 架构

```
┌─────────────────────────────────────────────────┐
│              应用层                              │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│            CreditsEngine                         │
│  （协调所有积分操作）                             │
└─────────────────┬───────────────────────────────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
┌───────▼──┐ ┌───▼────┐ ┌─▼────────┐
│ 特性模块 │ │ 适配器 │ │ 日志记录 │
│          │ │ (数据库)│ │          │
└──────────┘ └────────┘ └──────────┘
```

### 设计原则

1. **适配器模式**: 将存储层与业务逻辑解耦
2. **事务感知**: 支持将操作嵌入到更大的事务中
3. **幂等性**: 自动防止重复扣费
4. **类型安全**: 完整的 TypeScript 支持，启用严格模式
5. **零依赖**: 核心无运行时依赖

## 🤝 贡献

欢迎贡献！详情请参阅我们的[贡献指南](CONTRIBUTING.md)。

### 开发设置

```bash
git clone https://github.com/Leochens/credit-sdk.git
cd credit-sdk
npm install
npm test
npm run build
```

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🔗 链接

- [API 参考](docs/API_REFERENCE.md)
- [配置指南](docs/CONFIGURATION.md)
- [集成示例](docs/INTEGRATION_EXAMPLES.md)
- [测试指南](docs/TESTING.md)
- [数据库设置](docs/DATABASE_SETUP.md)
- [现有数据库集成](docs/EXISTING_DATABASE_INTEGRATION.md)
- [适配器实现指南](docs/ADAPTER_IMPLEMENTATION_GUIDE.md)
- [问题跟踪](https://github.com/Leochens/credit-sdk/issues)
- [更新日志](CHANGELOG.md)

---

Made with ❤️ for the SaaS community

# Credit SDK

> A decoupled, transaction-aware credits management SDK for subscription-based SaaS platforms.

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

### Core Documentation
- [API Reference](/API_REFERENCE.md) - Complete API documentation
- [Configuration Guide](/CONFIGURATION.md) - Detailed configuration options
- [Database Setup](/DATABASE_SETUP.md) - Database setup and migrations

### Integration Guides
- [Integration Examples](/INTEGRATION_EXAMPLES.md) - Next.js, Express.js, and more
- [Existing Database Integration](/EXISTING_DATABASE_INTEGRATION.md) - Integrate with your existing database
- [Adapter Implementation Guide](/ADAPTER_IMPLEMENTATION_GUIDE.md) - Create custom adapters

### Testing & Development
- [Testing Guide](/TESTING.md) - Unit, integration, and property-based testing
- [Contributing](/CONTRIBUTING.md) - How to contribute

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

See [Database Setup Guide](/DATABASE_SETUP.md) for detailed instructions.

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

See [Testing Guide](/TESTING.md) for comprehensive testing examples.

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

Contributions are welcome! Please see our [Contributing Guide](/CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/Leochens/credit-sdk.git
cd credit-sdk
npm install
npm test
npm run build
```

## 📄 License

MIT License - see [LICENSE](https://github.com/Leochens/credit-sdk/blob/main/LICENSE) file for details

## 🔗 Links

- [GitHub Repository](https://github.com/Leochens/credit-sdk)
- [NPM Package](https://www.npmjs.com/package/credit-sdk)
- [Issue Tracker](https://github.com/Leochens/credit-sdk/issues)
- [Changelog](https://github.com/Leochens/credit-sdk/blob/main/CHANGELOG.md)

---

Made with ❤️ for the SaaS community

# Testing Guide

Complete guide to testing applications using the Credit SDK.

## Table of Contents

- [Running Tests](#running-tests)
- [Using MockAdapter](#using-mockadapter)
- [Unit Testing](#unit-testing)
- [Integration Testing](#integration-testing)
- [Property-Based Testing](#property-based-testing)
- [Testing Best Practices](#testing-best-practices)

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- path/to/test.test.ts
```

### Test Configuration

```typescript
// vitest.config.ts or jest.config.js
export default {
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
};
```

## Using MockAdapter

The SDK provides a `MockAdapter` for testing without a real database.

### Basic Setup

```typescript
import { CreditsEngine, MockAdapter } from 'credit-sdk';
import { describe, it, expect, beforeEach } from 'vitest';

describe('Credit Operations', () => {
  let engine: CreditsEngine;
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
    engine = new CreditsEngine({
      storage: adapter,
      config: {
        costs: {
          'generate-post': { default: 10, premium: 8 }
        },
        membership: {
          tiers: { free: 0, premium: 1 },
          requirements: {
            'generate-post': null
          }
        }
      }
    });
  });

  it('should charge credits', async () => {
    // Create test user
    await adapter.createUser({
      id: 'test-user',
      credits: 100,
      membershipTier: 'premium'
    });

    // Test charge operation
    const result = await engine.charge({
      userId: 'test-user',
      action: 'generate-post'
    });

    expect(result.success).toBe(true);
    expect(result.cost).toBe(8); // Premium price
    expect(result.balanceAfter).toBe(92); // 100 - 8
  });
});
```

### MockAdapter API

```typescript
// Create a user
await adapter.createUser({
  id: 'user-123',
  credits: 100,
  membershipTier: 'premium',
  membershipExpiresAt: new Date('2025-12-31')
});

// Get user
const user = await adapter.getUserById('user-123');

// Update credits
const updated = await adapter.updateUserCredits('user-123', -10);

// Create transaction
const transaction = await adapter.createTransaction({
  userId: 'user-123',
  action: 'generate-post',
  amount: -10,
  balanceBefore: 100,
  balanceAfter: 90
});

// Get transactions
const transactions = await adapter.getTransactions('user-123', {
  limit: 10,
  offset: 0
});

// Clear all data (useful for test cleanup)
adapter.clear();
```

## Unit Testing

### Testing Charge Operations

```typescript
describe('Charge Operations', () => {
  let engine: CreditsEngine;
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
    engine = new CreditsEngine({ storage: adapter, config });
  });

  it('should charge correct amount', async () => {
    await adapter.createUser({
      id: 'user-1',
      credits: 100
    });

    const result = await engine.charge({
      userId: 'user-1',
      action: 'generate-post'
    });

    expect(result.cost).toBe(10);
    expect(result.balanceAfter).toBe(90);
  });

  it('should throw error on insufficient credits', async () => {
    await adapter.createUser({
      id: 'user-1',
      credits: 5
    });

    await expect(
      engine.charge({
        userId: 'user-1',
        action: 'generate-post'
      })
    ).rejects.toThrow(InsufficientCreditsError);
  });

  it('should apply membership discount', async () => {
    await adapter.createUser({
      id: 'user-1',
      credits: 100,
      membershipTier: 'premium'
    });

    const result = await engine.charge({
      userId: 'user-1',
      action: 'generate-post'
    });

    expect(result.cost).toBe(8); // Premium discount
  });
});
```

### Testing Refund Operations

```typescript
describe('Refund Operations', () => {
  it('should refund credits', async () => {
    await adapter.createUser({
      id: 'user-1',
      credits: 90
    });

    const result = await engine.refund({
      userId: 'user-1',
      amount: 10,
      action: 'refund-post'
    });

    expect(result.balanceAfter).toBe(100);
  });

  it('should record refund transaction', async () => {
    await adapter.createUser({
      id: 'user-1',
      credits: 90
    });

    await engine.refund({
      userId: 'user-1',
      amount: 10,
      action: 'refund-post'
    });

    const transactions = await engine.getHistory('user-1');
    expect(transactions).toHaveLength(1);
    expect(transactions[0].action).toBe('refund-post');
    expect(transactions[0].amount).toBe(10);
  });
});
```

### Testing Idempotency

```typescript
describe('Idempotency', () => {
  it('should prevent duplicate charges', async () => {
    await adapter.createUser({
      id: 'user-1',
      credits: 100
    });

    const idempotencyKey = 'unique-key-123';

    // First charge
    const result1 = await engine.charge({
      userId: 'user-1',
      action: 'generate-post',
      idempotencyKey
    });

    // Duplicate charge (should return cached result)
    const result2 = await engine.charge({
      userId: 'user-1',
      action: 'generate-post',
      idempotencyKey
    });

    expect(result1.transactionId).toBe(result2.transactionId);
    
    // Balance should only be charged once
    const balance = await engine.queryBalance('user-1');
    expect(balance).toBe(90); // 100 - 10, not 80
  });
});
```

### Testing Membership Validation

```typescript
describe('Membership Validation', () => {
  it('should allow access with correct membership', async () => {
    await adapter.createUser({
      id: 'user-1',
      credits: 100,
      membershipTier: 'premium'
    });

    const hasAccess = await engine.validateAccess('user-1', 'premium-feature');
    expect(hasAccess).toBe(true);
  });

  it('should deny access without required membership', async () => {
    await adapter.createUser({
      id: 'user-1',
      credits: 100,
      membershipTier: 'free'
    });

    await expect(
      engine.validateAccess('user-1', 'premium-feature')
    ).rejects.toThrow(MembershipRequiredError);
  });

  it('should allow higher tiers to access lower tier features', async () => {
    await adapter.createUser({
      id: 'user-1',
      credits: 100,
      membershipTier: 'enterprise'
    });

    const hasAccess = await engine.validateAccess('user-1', 'premium-feature');
    expect(hasAccess).toBe(true);
  });
});
```

## Integration Testing

### Testing with Real Database

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaAdapter, CreditsEngine } from 'credit-sdk';

describe('Integration Tests', () => {
  let prisma: PrismaClient;
  let engine: CreditsEngine;

  beforeAll(async () => {
    prisma = new PrismaClient();
    const adapter = new PrismaAdapter(prisma);
    engine = new CreditsEngine({ storage: adapter, config });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up database
    await prisma.transaction.deleteMany();
    await prisma.user.deleteMany();
  });

  it('should charge credits in real database', async () => {
    // Create user
    await prisma.user.create({
      data: {
        id: 'test-user',
        credits: 100
      }
    });

    // Charge credits
    const result = await engine.charge({
      userId: 'test-user',
      action: 'generate-post'
    });

    // Verify in database
    const user = await prisma.user.findUnique({
      where: { id: 'test-user' }
    });

    expect(user?.credits).toBe(90);
  });
});
```

### Testing Transactions

```typescript
describe('Transaction Tests', () => {
  it('should rollback on failure', async () => {
    await prisma.user.create({
      data: {
        id: 'test-user',
        credits: 100
      }
    });

    try {
      await prisma.$transaction(async (tx) => {
        // Charge credits
        await engine.charge({
          userId: 'test-user',
          action: 'generate-post',
          txn: tx
        });

        // Simulate failure
        throw new Error('Simulated failure');
      });
    } catch (error) {
      // Expected to fail
    }

    // Verify credits were not deducted
    const user = await prisma.user.findUnique({
      where: { id: 'test-user' }
    });

    expect(user?.credits).toBe(100); // Unchanged
  });
});
```

## Property-Based Testing

Property-based testing verifies that your code satisfies universal properties across many inputs.

### Setup

```bash
npm install --save-dev fast-check
```

### Basic Property Tests

```typescript
import fc from 'fast-check';

describe('Property-Based Tests', () => {
  it('should never allow negative balance', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          initialBalance: fc.nat(1000),
          chargeCost: fc.nat(2000)
        }),
        async ({ initialBalance, chargeCost }) => {
          await adapter.createUser({
            id: 'test-user',
            credits: initialBalance
          });

          if (chargeCost > initialBalance) {
            // Should throw error
            await expect(
              engine.charge({
                userId: 'test-user',
                action: 'test-action'
              })
            ).rejects.toThrow(InsufficientCreditsError);
          } else {
            // Should succeed
            const result = await engine.charge({
              userId: 'test-user',
              action: 'test-action'
            });
            
            expect(result.balanceAfter).toBeGreaterThanOrEqual(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('balance should always equal initial + sum of transactions', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          initialBalance: fc.nat(1000),
          operations: fc.array(
            fc.record({
              type: fc.constantFrom('charge', 'refund', 'grant'),
              amount: fc.nat(100)
            }),
            { maxLength: 10 }
          )
        }),
        async ({ initialBalance, operations }) => {
          await adapter.createUser({
            id: 'test-user',
            credits: initialBalance
          });

          let expectedBalance = initialBalance;

          for (const op of operations) {
            try {
              if (op.type === 'charge') {
                if (expectedBalance >= op.amount) {
                  await engine.charge({
                    userId: 'test-user',
                    action: 'test-action'
                  });
                  expectedBalance -= op.amount;
                }
              } else if (op.type === 'refund') {
                await engine.refund({
                  userId: 'test-user',
                  amount: op.amount,
                  action: 'test-refund'
                });
                expectedBalance += op.amount;
              } else if (op.type === 'grant') {
                await engine.grant({
                  userId: 'test-user',
                  amount: op.amount,
                  action: 'test-grant'
                });
                expectedBalance += op.amount;
              }
            } catch (error) {
              // Ignore insufficient credits errors
            }
          }

          const actualBalance = await engine.queryBalance('test-user');
          expect(actualBalance).toBe(expectedBalance);
        }
      ),
      { numRuns: 50 }
    );
  });
});
```

### Advanced Property Tests

```typescript
describe('Advanced Property Tests', () => {
  it('idempotency should prevent duplicate charges', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          balance: fc.nat(1000),
          duplicates: fc.nat({ max: 5 })
        }),
        async ({ balance, duplicates }) => {
          await adapter.createUser({
            id: 'test-user',
            credits: balance
          });

          const idempotencyKey = 'test-key';
          let firstResult;

          // Perform same operation multiple times
          for (let i = 0; i <= duplicates; i++) {
            const result = await engine.charge({
              userId: 'test-user',
              action: 'test-action',
              idempotencyKey
            });

            if (i === 0) {
              firstResult = result;
            } else {
              // All subsequent calls should return same result
              expect(result.transactionId).toBe(firstResult.transactionId);
            }
          }

          // Balance should only be charged once
          const finalBalance = await engine.queryBalance('test-user');
          expect(finalBalance).toBe(balance - firstResult.cost);
        }
      ),
      { numRuns: 50 }
    );
  });
});
```

## Testing Best Practices

### 1. Isolate Tests

```typescript
describe('Isolated Tests', () => {
  let adapter: MockAdapter;
  let engine: CreditsEngine;

  beforeEach(() => {
    // Create fresh instances for each test
    adapter = new MockAdapter();
    engine = new CreditsEngine({ storage: adapter, config });
  });

  afterEach(() => {
    // Clean up
    adapter.clear();
  });
});
```

### 2. Use Descriptive Test Names

```typescript
// ❌ Bad
it('test 1', async () => { /* ... */ });

// ✅ Good
it('should charge correct amount for premium users', async () => { /* ... */ });
it('should throw InsufficientCreditsError when balance is too low', async () => { /* ... */ });
```

### 3. Test Edge Cases

```typescript
describe('Edge Cases', () => {
  it('should handle zero balance', async () => {
    await adapter.createUser({
      id: 'user-1',
      credits: 0
    });

    await expect(
      engine.charge({ userId: 'user-1', action: 'test' })
    ).rejects.toThrow(InsufficientCreditsError);
  });

  it('should handle exact balance match', async () => {
    await adapter.createUser({
      id: 'user-1',
      credits: 10
    });

    const result = await engine.charge({
      userId: 'user-1',
      action: 'generate-post'
    });

    expect(result.balanceAfter).toBe(0);
  });

  it('should handle very large balances', async () => {
    await adapter.createUser({
      id: 'user-1',
      credits: Number.MAX_SAFE_INTEGER
    });

    const result = await engine.charge({
      userId: 'user-1',
      action: 'generate-post'
    });

    expect(result.success).toBe(true);
  });
});
```

### 4. Test Error Scenarios

```typescript
describe('Error Scenarios', () => {
  it('should handle non-existent user', async () => {
    await expect(
      engine.charge({ userId: 'non-existent', action: 'test' })
    ).rejects.toThrow(UserNotFoundError);
  });

  it('should handle undefined action', async () => {
    await adapter.createUser({
      id: 'user-1',
      credits: 100
    });

    await expect(
      engine.charge({ userId: 'user-1', action: 'undefined-action' })
    ).rejects.toThrow(UndefinedActionError);
  });
});
```

### 5. Use Test Fixtures

```typescript
// test/fixtures.ts
export const testUsers = {
  freeUser: {
    id: 'free-user',
    credits: 100,
    membershipTier: 'free'
  },
  premiumUser: {
    id: 'premium-user',
    credits: 1000,
    membershipTier: 'premium'
  },
  enterpriseUser: {
    id: 'enterprise-user',
    credits: 10000,
    membershipTier: 'enterprise'
  }
};

// test/credits.test.ts
import { testUsers } from './fixtures';

describe('With Fixtures', () => {
  it('should charge premium user correctly', async () => {
    await adapter.createUser(testUsers.premiumUser);
    
    const result = await engine.charge({
      userId: testUsers.premiumUser.id,
      action: 'generate-post'
    });

    expect(result.cost).toBe(8); // Premium price
  });
});
```

### 6. Mock External Dependencies

```typescript
// Mock external API
vi.mock('./openai', () => ({
  generatePost: vi.fn().mockResolvedValue({ content: 'Generated post' })
}));

describe('With Mocked Dependencies', () => {
  it('should charge credits after successful generation', async () => {
    await adapter.createUser({
      id: 'user-1',
      credits: 100
    });

    const result = await generatePostWithCredits('user-1');

    expect(result.success).toBe(true);
    expect(result.creditsUsed).toBe(10);
  });
});
```

### 7. Test Concurrent Operations

```typescript
describe('Concurrent Operations', () => {
  it('should handle concurrent charges correctly', async () => {
    await adapter.createUser({
      id: 'user-1',
      credits: 100
    });

    // Perform 5 concurrent charges
    const promises = Array(5).fill(null).map(() =>
      engine.charge({
        userId: 'user-1',
        action: 'generate-post'
      })
    );

    const results = await Promise.all(promises);

    // All should succeed
    results.forEach(result => {
      expect(result.success).toBe(true);
    });

    // Final balance should be correct
    const balance = await engine.queryBalance('user-1');
    expect(balance).toBe(50); // 100 - (10 × 5)
  });
});
```

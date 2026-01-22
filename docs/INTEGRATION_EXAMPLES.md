# Integration Examples

Real-world integration examples for the Credit SDK.

## Table of Contents

- [Next.js with Server Actions](#nextjs-with-server-actions)
- [Express.js REST API](#expressjs-rest-api)
- [Custom Storage Adapter](#custom-storage-adapter)
- [Custom Logger](#custom-logger)
- [Error Handling Patterns](#error-handling-patterns)

## Next.js with Server Actions

### Basic Integration

```typescript
// app/actions/credits.ts
'use server';

import { CreditsEngine, PrismaAdapter, InsufficientCreditsError } from 'credit-sdk';
import { prisma } from '@/lib/prisma';

const adapter = new PrismaAdapter(prisma);
const engine = new CreditsEngine({ storage: adapter, config });

export async function generatePost(userId: string) {
  try {
    // Use Prisma transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Charge credits within transaction
      const chargeResult = await engine.charge({
        userId,
        action: 'generate-post',
        idempotencyKey: `generate-post-${Date.now()}`,
        txn: tx  // Pass transaction context
      });
      
      // Generate post (if this fails, transaction rolls back)
      const post = await generateAIPost();
      
      // Save post in same transaction
      const savedPost = await tx.post.create({
        data: {
          userId,
          content: post.content,
          creditsUsed: chargeResult.cost
        }
      });
      
      return { 
        success: true, 
        post: savedPost, 
        creditsUsed: chargeResult.cost 
      };
    });
    
    return result;
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return { success: false, error: 'Insufficient credits' };
    }
    // If AI generation fails, transaction is rolled back automatically
    // Credits are NOT deducted because the entire transaction is rolled back
    return { success: false, error: 'Failed to generate post' };
  }
}
```

### Manual Refund Pattern

```typescript
export async function generatePostWithManualRefund(userId: string) {
  const idempotencyKey = `generate-post-${Date.now()}`;
  
  try {
    // 1. Charge credits first
    const chargeResult = await engine.charge({
      userId,
      action: 'generate-post',
      idempotencyKey
    });
    
    try {
      // 2. Generate post (may fail)
      const post = await generateAIPost();
      
      // 3. Save post to database
      const savedPost = await prisma.post.create({
        data: {
          userId,
          content: post.content,
          creditsUsed: chargeResult.cost
        }
      });
      
      return { success: true, post: savedPost, creditsUsed: chargeResult.cost };
    } catch (generationError) {
      // If generation fails, refund the credits
      await engine.refund({
        userId,
        amount: chargeResult.cost,
        action: 'refund-failed-generation',
        idempotencyKey: `refund-${idempotencyKey}`,
        metadata: { 
          originalAction: 'generate-post',
          reason: 'Generation failed',
          error: generationError.message 
        }
      });
      
      return { success: false, error: 'Failed to generate post, credits refunded' };
    }
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return { success: false, error: 'Insufficient credits' };
    }
    throw error;
  }
}
```

### Generate First, Charge Later Pattern

```typescript
export async function generatePostWithExternalAPI(userId: string) {
  try {
    // 1. Check balance first (optional but recommended)
    const balance = await engine.queryBalance(userId);
    if (balance < 10) {  // Estimated cost
      return { success: false, error: 'Insufficient credits' };
    }
    
    // 2. Call external API first (may fail)
    const post = await callOpenAI(prompt);
    
    // 3. Charge only after successful generation
    const result = await engine.charge({
      userId,
      action: 'generate-post',
      idempotencyKey: `generate-post-${Date.now()}`,
      metadata: { postId: post.id }
    });
    
    return { success: true, post, creditsUsed: result.cost };
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return { success: false, error: 'Insufficient credits' };
    }
    // No refund needed - we haven't charged yet
    return { success: false, error: 'Failed to generate post' };
  }
}
```

### React Component Integration

```typescript
// app/components/GeneratePostButton.tsx
'use client';

import { useState } from 'react';
import { generatePost } from '@/app/actions/credits';

export function GeneratePostButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await generatePost(userId);
      
      if (result.success) {
        // Show success message
        alert(`Post generated! Used ${result.creditsUsed} credits`);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleGenerate} disabled={loading}>
        {loading ? 'Generating...' : 'Generate Post'}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
```

## Express.js REST API

### Basic Setup

```typescript
// server.ts
import express from 'express';
import { CreditsEngine, PrismaAdapter, InsufficientCreditsError } from 'credit-sdk';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
const adapter = new PrismaAdapter(prisma);
const engine = new CreditsEngine({ storage: adapter, config });

app.use(express.json());

// Charge credits
app.post('/api/charge', async (req, res) => {
  try {
    const { userId, action, metadata } = req.body;
    
    const result = await engine.charge({
      userId,
      action,
      idempotencyKey: req.headers['idempotency-key'] as string,
      metadata
    });
    
    res.json(result);
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      res.status(402).json({ 
        error: 'Insufficient credits', 
        details: {
          required: error.required,
          available: error.available
        }
      });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Get balance
app.get('/api/balance/:userId', async (req, res) => {
  try {
    const balance = await engine.queryBalance(req.params.userId);
    res.json({ balance });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get transaction history
app.get('/api/transactions/:userId', async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;
    
    const transactions = await engine.getHistory(req.params.userId, {
      limit: Number(limit),
      offset: Number(offset)
    });
    
    res.json({ transactions });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refund credits
app.post('/api/refund', async (req, res) => {
  try {
    const { userId, amount, action, metadata } = req.body;
    
    const result = await engine.refund({
      userId,
      amount,
      action,
      metadata
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Middleware for Credit Checking

```typescript
// middleware/checkCredits.ts
import { Request, Response, NextFunction } from 'express';
import { engine } from '../config/credits';

export async function checkCredits(action: string, estimatedCost: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id; // Assuming auth middleware sets req.user
      
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const balance = await engine.queryBalance(userId);
      
      if (balance < estimatedCost) {
        return res.status(402).json({ 
          error: 'Insufficient credits',
          required: estimatedCost,
          available: balance
        });
      }
      
      next();
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// Usage
app.post('/api/generate', 
  checkCredits('generate-post', 10),
  async (req, res) => {
    // Handle generation
  }
);
```

## Custom Storage Adapter

### MongoDB Adapter Example

```typescript
import { IStorageAdapter, User, Transaction, AuditLog } from 'credit-sdk';
import { MongoClient, Db } from 'mongodb';

export class MongoAdapter implements IStorageAdapter {
  private db: Db;

  constructor(client: MongoClient, dbName: string) {
    this.db = client.db(dbName);
  }

  async getUserById(userId: string, txn?: any): Promise<User | null> {
    const user = await this.db.collection('users').findOne({ _id: userId });
    
    if (!user) return null;
    
    return {
      id: user._id,
      credits: user.credits || 0,
      membershipTier: user.membershipTier || null,
      membershipExpiresAt: user.membershipExpiresAt || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  async updateUserCredits(userId: string, amount: number, txn?: any): Promise<User> {
    const result = await this.db.collection('users').findOneAndUpdate(
      { _id: userId },
      { 
        $inc: { credits: amount },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      throw new Error(`User ${userId} not found`);
    }

    return {
      id: result.value._id,
      credits: result.value.credits,
      membershipTier: result.value.membershipTier || null,
      membershipExpiresAt: result.value.membershipExpiresAt || null,
      createdAt: result.value.createdAt,
      updatedAt: result.value.updatedAt
    };
  }

  async createTransaction(transaction: TransactionInput, txn?: any): Promise<Transaction> {
    const doc = {
      userId: transaction.userId,
      action: transaction.action,
      amount: transaction.amount,
      balanceBefore: transaction.balanceBefore,
      balanceAfter: transaction.balanceAfter,
      metadata: transaction.metadata || {},
      createdAt: new Date()
    };

    const result = await this.db.collection('transactions').insertOne(doc);

    return {
      id: result.insertedId.toString(),
      ...doc
    };
  }

  async createAuditLog(log: AuditLogInput, txn?: any): Promise<AuditLog> {
    const doc = {
      userId: log.userId,
      action: log.action,
      status: log.status,
      metadata: log.metadata || {},
      errorMessage: log.errorMessage || null,
      createdAt: new Date()
    };

    const result = await this.db.collection('auditLogs').insertOne(doc);

    return {
      id: result.insertedId.toString(),
      ...doc
    };
  }

  async getIdempotencyRecord(key: string, txn?: any): Promise<IdempotencyRecord | null> {
    const record = await this.db.collection('idempotencyRecords').findOne({ 
      key,
      expiresAt: { $gt: new Date() }
    });

    if (!record) return null;

    return {
      key: record.key,
      result: record.result,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt
    };
  }

  async createIdempotencyRecord(record: IdempotencyRecordInput, txn?: any): Promise<IdempotencyRecord> {
    const doc = {
      key: record.key,
      result: record.result,
      createdAt: new Date(),
      expiresAt: record.expiresAt
    };

    await this.db.collection('idempotencyRecords').insertOne(doc);

    return doc;
  }

  async getTransactions(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
      action?: string;
    },
    txn?: any
  ): Promise<Transaction[]> {
    const query: any = { userId };

    if (options?.startDate || options?.endDate) {
      query.createdAt = {};
      if (options.startDate) query.createdAt.$gte = options.startDate;
      if (options.endDate) query.createdAt.$lte = options.endDate;
    }

    if (options?.action) {
      query.action = options.action;
    }

    const transactions = await this.db
      .collection('transactions')
      .find(query)
      .sort({ createdAt: -1 })
      .skip(options?.offset || 0)
      .limit(options?.limit || 10)
      .toArray();

    return transactions.map(t => ({
      id: t._id.toString(),
      userId: t.userId,
      action: t.action,
      amount: t.amount,
      balanceBefore: t.balanceBefore,
      balanceAfter: t.balanceAfter,
      metadata: t.metadata,
      createdAt: t.createdAt
    }));
  }
}
```

## Custom Logger

### Winston Logger Example

```typescript
import { ILogAdapter } from 'credit-sdk';
import winston from 'winston';

export class WinstonLogger implements ILogAdapter {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({ 
          filename: 'logs/error.log', 
          level: 'error' 
        }),
        new winston.transports.File({ 
          filename: 'logs/combined.log' 
        })
      ]
    });
  }

  debug(message: string, context?: any): void {
    this.logger.debug(message, context);
  }

  info(message: string, context?: any): void {
    this.logger.info(message, context);
  }

  warn(message: string, context?: any): void {
    this.logger.warn(message, context);
  }

  error(message: string, context?: any): void {
    this.logger.error(message, context);
  }
}

// Usage
const engine = new CreditsEngine({
  storage: adapter,
  config,
  logger: new WinstonLogger()
});
```

### Pino Logger Example

```typescript
import { ILogAdapter } from 'credit-sdk';
import pino from 'pino';

export class PinoLogger implements ILogAdapter {
  private logger: pino.Logger;

  constructor() {
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true
        }
      }
    });
  }

  debug(message: string, context?: any): void {
    this.logger.debug(context, message);
  }

  info(message: string, context?: any): void {
    this.logger.info(context, message);
  }

  warn(message: string, context?: any): void {
    this.logger.warn(context, message);
  }

  error(message: string, context?: any): void {
    this.logger.error(context, message);
  }
}
```

## Error Handling Patterns

### Comprehensive Error Handling

```typescript
import {
  InsufficientCreditsError,
  UserNotFoundError,
  MembershipRequiredError,
  UndefinedActionError,
  ConfigurationError
} from 'credit-sdk';

async function handleCreditOperation(userId: string, action: string) {
  try {
    const result = await engine.charge({ userId, action });
    return { success: true, data: result };
  } catch (error) {
    // Handle specific SDK errors
    if (error instanceof InsufficientCreditsError) {
      return {
        success: false,
        error: 'INSUFFICIENT_CREDITS',
        message: `Need ${error.required} credits, but only have ${error.available}`,
        required: error.required,
        available: error.available
      };
    }

    if (error instanceof UserNotFoundError) {
      return {
        success: false,
        error: 'USER_NOT_FOUND',
        message: `User ${error.userId} does not exist`
      };
    }

    if (error instanceof MembershipRequiredError) {
      return {
        success: false,
        error: 'MEMBERSHIP_REQUIRED',
        message: `This action requires ${error.required} membership`,
        required: error.required,
        current: error.current
      };
    }

    if (error instanceof UndefinedActionError) {
      return {
        success: false,
        error: 'UNDEFINED_ACTION',
        message: `Action ${error.action} is not configured`
      };
    }

    if (error instanceof ConfigurationError) {
      return {
        success: false,
        error: 'CONFIGURATION_ERROR',
        message: 'SDK configuration is invalid'
      };
    }

    // Handle unexpected errors
    console.error('Unexpected error:', error);
    return {
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    };
  }
}
```

### Retry with Exponential Backoff

```typescript
async function chargeWithRetry(
  userId: string,
  action: string,
  maxRetries = 3
) {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await engine.charge({ userId, action });
    } catch (error) {
      lastError = error as Error;

      // Don't retry on user errors
      if (
        error instanceof InsufficientCreditsError ||
        error instanceof UserNotFoundError ||
        error instanceof MembershipRequiredError
      ) {
        throw error;
      }

      // Wait before retrying
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
```

### Graceful Degradation

```typescript
async function generateWithFallback(userId: string) {
  try {
    // Try to charge credits
    await engine.charge({ userId, action: 'generate-post' });
    
    // Generate with AI
    return await generateWithAI();
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      // Fallback to basic generation
      console.log('Insufficient credits, using basic generation');
      return await generateBasic();
    }
    
    throw error;
  }
}
```

# Credit SDK

> 一个解耦的、感知事务的积分管理 SDK，专为基于订阅的 SaaS 平台设计。

## ✨ 特性

- 🔌 **适配器模式**：集成任何数据库系统，无 ORM 锁定
- 🔄 **事务传递**：将 SDK 操作嵌入到更大的业务事务中
- 🔒 **幂等性**：自动防止重复扣费
- 👥 **会员管理**：基于层级的定价和访问控制
- 📝 **审计日志**：完整的操作记录，用于合规和调试
- 🔁 **自动重试**：针对瞬时故障的智能重试机制
- 📊 **TypeScript**：全类型安全，拥有出色的 IDE 支持
- ⚡ **零依赖**：核心无运行时依赖（适配器可选）

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
        'generate-post': null  // 所有用户可用
      }
    }
  }
});

// 扣除积分
const result = await engine.charge({
  userId: 'user-123',
  action: 'generate-post'
});

console.log(`Charged ${result.cost} credits. New balance: ${result.balanceAfter}`);
```

## 📚 核心操作

```typescript
// 扣除积分
await engine.charge({
  userId: 'user-123',
  action: 'generate-post',
  idempotencyKey: 'unique-key',
  metadata: { postId: 'post-456' }
});

// 退还积分
await engine.refund({
  userId: 'user-123',
  amount: 10,
  action: 'refund-post'
});

// 赠送积分（促销、奖励）
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

// 验证权限
const hasAccess = await engine.validateAccess('user-123', 'premium-feature');
```

## 🔄 事务支持

```typescript
// 使用 Prisma 事务
await prisma.$transaction(async (tx) => {
  // 在事务中扣除积分
  const result = await engine.charge({
    userId: 'user-123',
    action: 'generate-post',
    txn: tx  // 传递事务上下文
  });
  
  // 同一事务中的其他数据库操作
  await tx.post.create({
    data: {
      userId: 'user-123',
      content: 'Generated content',
      creditsUsed: result.cost
    }
  });
  
  // 如果任何操作失败，整个事务回滚
});
```

## 📖 文档

### 核心文档
- [API 参考](/zh-cn/API_REFERENCE.md) - 完整的 API 文档
- [配置指南](/zh-cn/CONFIGURATION.md) - 详细的配置选项
- [数据库设置](/zh-cn/DATABASE_SETUP.md) - 数据库设置和迁移

### 集成指南
- [集成示例](/zh-cn/INTEGRATION_EXAMPLES.md) - Next.js, Express.js 等
- [现有数据库集成](/zh-cn/EXISTING_DATABASE_INTEGRATION.md) - 集成到现有数据库
- [适配器实现指南](/zh-cn/ADAPTER_IMPLEMENTATION_GUIDE.md) - 创建自定义适配器

### 测试与开发
- [测试指南](/zh-cn/TESTING.md) - 单元测试、集成测试和基于属性的测试
- [贡献指南](/zh-cn/CONTRIBUTING.md) - 如何贡献代码

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

# 从本仓库复制 schema 到 prisma/schema.prisma

# 运行迁移
npx prisma migrate dev --name init

# 生成 Prisma Client
npx prisma generate
```

查看 [数据库设置指南](/zh-cn/DATABASE_SETUP.md) 获取详细说明。

## 🧪 测试

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

查看 [测试指南](/zh-cn/TESTING.md) 获取全面的测试示例。

## 📖 架构

```
┌─────────────────────────────────────────────────┐
│              Application Layer                   │
│                (应用层)                          │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│            CreditsEngine                         │
│       (负责编排所有积分操作)                      │
└─────────────────┬───────────────────────────────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
┌───────▼──┐ ┌───▼────┐ ┌─▼────────┐
│ Features │ │Adapter │ │  Logger  │
│ 模块      │ │(数据库) │ │          │
└──────────┘ └────────┘ └──────────┘
```

### 设计原则

1. **适配器模式**：将存储层与业务逻辑解耦
2. **事务感知**：支持嵌入到更大的事务中
3. **幂等性**：自动防止重复扣费
4. **类型安全**：全 TypeScript 支持，严格模式
5. **零依赖**：核心无运行时依赖

## 🤝 贡献

欢迎贡献！详情请查看我们的 [贡献指南](/zh-cn/CONTRIBUTING.md)。

### 开发设置

```bash
git clone https://github.com/Leochens/credit-sdk.git
cd credit-sdk
npm install
npm test
npm run build
```

## 📄 许可证

MIT License - 详情见 [LICENSE](https://github.com/Leochens/credit-sdk/blob/main/LICENSE) 文件

## 🔗 链接

- [GitHub 仓库](https://github.com/Leochens/credit-sdk)
- [NPM 包](https://www.npmjs.com/package/credit-sdk)
- [Issue 追踪](https://github.com/Leochens/credit-sdk/issues)
- [更新日志](https://github.com/Leochens/credit-sdk/blob/main/CHANGELOG.md)

---

Made with ❤️ for the SaaS community

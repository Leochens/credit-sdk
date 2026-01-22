# MockAdapter

MockAdapter 是 `IStorageAdapter` 接口的内存实现，专门用于测试场景。它使用 JavaScript 的 Map 和 Array 来模拟数据库操作，无需真实的数据库连接。

## 特性

- ✅ **内存存储**: 使用 Map 和 Array 存储所有数据
- ✅ **完整实现**: 实现了 IStorageAdapter 的所有方法
- ✅ **事务支持**: 接受事务上下文参数（虽然在内存中不需要）
- ✅ **测试辅助方法**: 提供额外的方法用于测试断言和状态管理
- ✅ **数据隔离**: 每个方法返回数据副本，避免外部修改

## 基本用法

```typescript
import { MockAdapter } from 'credit-sdk';
import { CreditsEngine } from 'credit-sdk';

// 创建 MockAdapter 实例
const adapter = new MockAdapter();

// 创建测试用户
await adapter.createUser({
  id: 'user-123',
  credits: 1000,
  membershipTier: 'premium',
  membershipExpiresAt: new Date('2025-12-31')
});

// 使用 MockAdapter 创建 CreditsEngine
const engine = new CreditsEngine({
  storage: adapter,
  config: yourConfig
});

// 执行操作
await engine.charge({
  userId: 'user-123',
  action: 'generate-post'
});

// 检查状态
const transactions = adapter.getAllTransactions();
const logs = adapter.getAuditLogs();
const users = adapter.getAllUsers();

// 清理状态
adapter.reset();
```

## IStorageAdapter 方法

MockAdapter 实现了所有 IStorageAdapter 接口方法：

### getUserById(userId, txn?)
获取用户信息。

```typescript
const user = await adapter.getUserById('user-123');
if (user) {
  console.log(`User has ${user.credits} credits`);
}
```

### updateUserCredits(userId, amount, txn?)
更新用户积分余额。

```typescript
// 扣除 10 积分
await adapter.updateUserCredits('user-123', -10);

// 增加 50 积分
await adapter.updateUserCredits('user-123', 50);
```

### createTransaction(transaction, txn?)
创建交易记录。

```typescript
const transaction = await adapter.createTransaction({
  userId: 'user-123',
  action: 'generate-post',
  amount: -10,
  balanceBefore: 100,
  balanceAfter: 90,
  metadata: { postId: 'post-456' }
});
```

### createAuditLog(log, txn?)
创建审计日志。

```typescript
const log = await adapter.createAuditLog({
  userId: 'user-123',
  action: 'charge',
  status: 'success',
  metadata: { cost: 10 }
});
```

### getIdempotencyRecord(key, txn?)
获取幂等性记录。

```typescript
const record = await adapter.getIdempotencyRecord('idempotency-key-123');
if (record) {
  // 返回缓存的结果
  return record.result;
}
```

### createIdempotencyRecord(record, txn?)
创建幂等性记录。

```typescript
await adapter.createIdempotencyRecord({
  key: 'idempotency-key-123',
  result: { success: true, transactionId: 'txn-456' },
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时后过期
});
```

### getTransactions(userId, options?, txn?)
获取用户的交易历史。

```typescript
// 获取最近 10 条交易
const transactions = await adapter.getTransactions('user-123', { limit: 10 });

// 分页查询
const transactions = await adapter.getTransactions('user-123', { 
  limit: 20, 
  offset: 40 
});

// 按日期范围过滤
const transactions = await adapter.getTransactions('user-123', {
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31')
});

// 按操作类型过滤
const transactions = await adapter.getTransactions('user-123', {
  action: 'generate-post'
});
```

## 测试辅助方法

MockAdapter 提供了额外的方法来简化测试：

### createUser(user)
创建测试用户（不是 IStorageAdapter 接口的一部分）。

```typescript
await adapter.createUser({
  id: 'user-123',
  credits: 1000,
  membershipTier: 'premium',
  membershipExpiresAt: new Date('2025-12-31')
});

// 使用默认值
await adapter.createUser({
  id: 'user-456'
  // credits 默认为 0
  // membershipTier 默认为 null
});
```

### reset()
清空所有存储，用于测试之间的清理。

```typescript
afterEach(() => {
  adapter.reset();
});
```

### getAllTransactions()
获取所有交易记录（不限用户）。

```typescript
const transactions = adapter.getAllTransactions();
expect(transactions).toHaveLength(3);
```

### getAuditLogs()
获取所有审计日志。

```typescript
const logs = adapter.getAuditLogs();
expect(logs).toHaveLength(2);
expect(logs[0].status).toBe('success');
```

### getAllUsers()
获取所有用户。

```typescript
const users = adapter.getAllUsers();
expect(users).toHaveLength(1);
```

### getAllIdempotencyRecords()
获取所有幂等性记录。

```typescript
const records = adapter.getAllIdempotencyRecords();
expect(records).toHaveLength(1);
```

### setUser(user)
直接设置用户对象。

```typescript
adapter.setUser({
  id: 'user-123',
  credits: 500,
  membershipTier: 'premium',
  membershipExpiresAt: new Date('2025-12-31'),
  createdAt: new Date(),
  updatedAt: new Date()
});
```

## 测试示例

### 单元测试

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MockAdapter } from 'credit-sdk';

describe('My Feature', () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
  });

  afterEach(() => {
    adapter.reset();
  });

  it('should create transaction', async () => {
    await adapter.createUser({ id: 'user-123', credits: 100 });
    
    const transaction = await adapter.createTransaction({
      userId: 'user-123',
      action: 'test',
      amount: -10,
      balanceBefore: 100,
      balanceAfter: 90
    });

    expect(transaction.id).toBeDefined();
    expect(transaction.amount).toBe(-10);
  });
});
```

### 集成测试

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MockAdapter, CreditsEngine } from 'credit-sdk';

describe('CreditsEngine Integration', () => {
  let adapter: MockAdapter;
  let engine: CreditsEngine;

  beforeEach(() => {
    adapter = new MockAdapter();
    engine = new CreditsEngine({
      storage: adapter,
      config: myConfig
    });
  });

  it('should perform complete workflow', async () => {
    await adapter.createUser({
      id: 'user-123',
      credits: 1000
    });

    // 执行扣费
    const result = await engine.charge({
      userId: 'user-123',
      action: 'generate-post'
    });

    // 验证结果
    expect(result.success).toBe(true);

    // 验证状态
    const user = await adapter.getUserById('user-123');
    expect(user!.credits).toBeLessThan(1000);

    const transactions = adapter.getAllTransactions();
    expect(transactions).toHaveLength(1);

    const logs = adapter.getAuditLogs();
    expect(logs).toHaveLength(1);
  });
});
```

## 与 PrismaAdapter 的区别

| 特性 | MockAdapter | PrismaAdapter |
|------|-------------|---------------|
| 存储 | 内存 (Map/Array) | 数据库 (Prisma) |
| 持久化 | 否 | 是 |
| 事务支持 | 模拟 | 真实 |
| 性能 | 极快 | 取决于数据库 |
| 用途 | 测试 | 生产环境 |
| 测试辅助方法 | 有 | 无 |

## 注意事项

1. **不持久化**: MockAdapter 的数据只存在于内存中，进程重启后会丢失
2. **无真实事务**: 虽然接受 `txn` 参数，但不执行真实的数据库事务
3. **仅用于测试**: 不应该在生产环境中使用
4. **数据副本**: 所有方法返回数据副本，避免外部修改影响内部状态
5. **ID 生成**: 使用简单的计数器生成 ID，格式为 `mock-{timestamp}-{counter}`

## 最佳实践

1. **使用 reset()**: 在每个测试后调用 `reset()` 清理状态
2. **使用 createUser()**: 使用辅助方法创建测试用户，而不是直接操作内部存储
3. **检查状态**: 使用 `getAllTransactions()` 等方法验证操作结果
4. **隔离测试**: 每个测试应该独立，不依赖其他测试的状态
5. **模拟真实场景**: 尽量模拟真实的使用场景，包括错误情况

## 相关文档

- [IStorageAdapter 接口](./IStorageAdapter.ts)
- [PrismaAdapter 参考实现](./PrismaAdapter.ts)
- [CreditsEngine 文档](../core/CreditsEngine.ts)

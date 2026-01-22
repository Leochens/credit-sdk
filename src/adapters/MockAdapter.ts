/**
 * Mock 存储适配器
 * IStorageAdapter 接口的内存实现，用于测试
 * 
 * 这个适配器使用内存存储（Maps 和 Arrays）来模拟数据库操作。
 * 它提供了测试辅助方法来检查和重置状态。
 */

import { IStorageAdapter } from './IStorageAdapter';
import {
  User,
  Transaction,
  TransactionInput,
  AuditLog,
  AuditLogInput,
  IdempotencyRecord,
  IdempotencyRecordInput
} from '../core/types';
import { UserNotFoundError } from '../core/errors';

/**
 * 生成唯一 ID
 * 使用简单的计数器生成唯一标识符
 */
let idCounter = 0;
function generateId(): string {
  return `mock-${Date.now()}-${++idCounter}`;
}

/**
 * Mock 适配器类
 * 
 * 使用内存存储实现所有 IStorageAdapter 方法。
 * 支持事务模拟（通过传递事务上下文对象）。
 * 提供测试辅助方法用于验证和重置状态。
 * 
 * @example
 * ```typescript
 * const adapter = new MockAdapter();
 * 
 * // 创建测试用户
 * await adapter.createUser({
 *   id: 'user-123',
 *   credits: 1000,
 *   membershipTier: 'premium',
 *   membershipExpiresAt: new Date('2025-12-31')
 * });
 * 
 * // 使用适配器
 * const user = await adapter.getUserById('user-123');
 * await adapter.updateUserCredits('user-123', -10);
 * 
 * // 检查状态
 * const transactions = adapter.getTransactions();
 * const auditLogs = adapter.getAuditLogs();
 * 
 * // 重置状态
 * adapter.reset();
 * ```
 */
export class MockAdapter implements IStorageAdapter {
  /** 用户存储 */
  private users = new Map<string, User>();
  
  /** 交易记录存储 */
  private transactions: Transaction[] = [];
  
  /** 审计日志存储 */
  private auditLogs: AuditLog[] = [];
  
  /** 幂等性记录存储 */
  private idempotencyRecords = new Map<string, IdempotencyRecord>();

  /**
   * 根据用户 ID 获取用户信息
   * 
   * @param userId - 用户唯一标识符
   * @param _txn - 可选的事务上下文（在 MockAdapter 中不使用，但保持接口一致）
   * @returns 用户对象，如果不存在则返回 null
   */
  async getUserById(userId: string, _txn?: any): Promise<User | null> {
    const user = this.users.get(userId);
    return user ? { ...user } : null; // 返回副本以避免外部修改
  }

  /**
   * 更新用户积分余额
   * 
   * @param userId - 用户唯一标识符
   * @param amount - 变更金额 (正数为增加，负数为减少)
   * @param _txn - 可选的事务上下文
   * @returns 更新后的用户对象
   * @throws UserNotFoundError 如果用户不存在
   */
  async updateUserCredits(userId: string, amount: number, _txn?: any): Promise<User> {
    const user = this.users.get(userId);
    
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    // 更新积分和更新时间
    user.credits += amount;
    user.updatedAt = new Date();

    return { ...user }; // 返回副本
  }

  /**
   * 创建交易记录
   * 
   * @param transaction - 交易数据
   * @param _txn - 可选的事务上下文
   * @returns 创建的交易记录 (包含生成的 ID 和时间戳)
   */
  async createTransaction(transaction: TransactionInput, _txn?: any): Promise<Transaction> {
    const created: Transaction = {
      id: generateId(),
      userId: transaction.userId,
      action: transaction.action,
      amount: transaction.amount,
      balanceBefore: transaction.balanceBefore,
      balanceAfter: transaction.balanceAfter,
      metadata: transaction.metadata || {},
      createdAt: new Date()
    };

    this.transactions.push(created);
    return { ...created }; // 返回副本
  }

  /**
   * 创建审计日志
   * 
   * @param log - 日志数据
   * @param _txn - 可选的事务上下文
   * @returns 创建的审计日志 (包含生成的 ID 和时间戳)
   */
  async createAuditLog(log: AuditLogInput, _txn?: any): Promise<AuditLog> {
    const created: AuditLog = {
      id: generateId(),
      userId: log.userId,
      action: log.action,
      status: log.status,
      metadata: log.metadata || {},
      errorMessage: log.errorMessage,
      createdAt: new Date()
    };

    this.auditLogs.push(created);
    return { ...created }; // 返回副本
  }

  /**
   * 获取幂等性记录
   * 
   * @param key - 幂等键
   * @param _txn - 可选的事务上下文
   * @returns 幂等性记录，如果不存在或已过期则返回 null
   */
  async getIdempotencyRecord(key: string, _txn?: any): Promise<IdempotencyRecord | null> {
    const record = this.idempotencyRecords.get(key);

    if (!record) {
      return null;
    }

    // 检查是否过期
    if (record.expiresAt < new Date()) {
      // 记录已过期，删除并返回 null
      this.idempotencyRecords.delete(key);
      return null;
    }

    return { ...record }; // 返回副本
  }

  /**
   * 创建幂等性记录
   * 
   * @param record - 幂等性记录数据
   * @param _txn - 可选的事务上下文
   * @returns 创建的幂等性记录 (包含创建时间)
   */
  async createIdempotencyRecord(record: IdempotencyRecordInput, _txn?: any): Promise<IdempotencyRecord> {
    const created: IdempotencyRecord = {
      key: record.key,
      result: record.result,
      createdAt: new Date(),
      expiresAt: record.expiresAt
    };

    this.idempotencyRecords.set(record.key, created);
    return { ...created }; // 返回副本
  }

  /**
   * 获取用户的交易历史
   * 
   * @param userId - 用户唯一标识符
   * @param options - 查询选项 (分页、过滤等)
   * @param _txn - 可选的事务上下文
   * @returns 交易记录列表，按时间戳降序排列
   */
  async getTransactions(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
      action?: string;
    },
    _txn?: any
  ): Promise<Transaction[]> {
    // 过滤用户的交易
    let filtered = this.transactions.filter(t => t.userId === userId);

    // 应用日期范围过滤
    if (options?.startDate) {
      filtered = filtered.filter(t => t.createdAt >= options.startDate!);
    }
    if (options?.endDate) {
      filtered = filtered.filter(t => t.createdAt <= options.endDate!);
    }

    // 应用操作类型过滤
    if (options?.action) {
      filtered = filtered.filter(t => t.action === options.action);
    }

    // 按时间戳降序排序
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // 应用分页
    const offset = options?.offset || 0;
    const limit = options?.limit;
    
    if (limit !== undefined) {
      filtered = filtered.slice(offset, offset + limit);
    } else if (offset > 0) {
      filtered = filtered.slice(offset);
    }

    // 返回副本
    return filtered.map(t => ({ ...t }));
  }

  // ==================== 测试辅助方法 ====================

  /**
   * 创建用户（测试辅助方法）
   * 
   * 这个方法不是 IStorageAdapter 接口的一部分，
   * 但对于测试设置非常有用。
   * 
   * @param user - 用户数据（可以是部分数据，会填充默认值）
   * @returns 创建的用户对象
   * 
   * @example
   * ```typescript
   * const user = await adapter.createUser({
   *   id: 'user-123',
   *   credits: 1000
   * });
   * ```
   */
  async createUser(user: Partial<User> & { id: string }): Promise<User> {
    const now = new Date();
    const created: User = {
      id: user.id,
      credits: user.credits ?? 0,
      membershipTier: user.membershipTier ?? null,
      membershipExpiresAt: user.membershipExpiresAt ?? null,
      createdAt: user.createdAt ?? now,
      updatedAt: user.updatedAt ?? now
    };

    this.users.set(created.id, created);
    return { ...created };
  }

  /**
   * 重置所有存储（测试辅助方法）
   * 
   * 清空所有内存存储，用于测试之间的清理。
   * 
   * @example
   * ```typescript
   * afterEach(() => {
   *   adapter.reset();
   * });
   * ```
   */
  reset(): void {
    this.users.clear();
    this.transactions = [];
    this.auditLogs = [];
    this.idempotencyRecords.clear();
    idCounter = 0; // 重置 ID 计数器
  }

  /**
   * 获取所有交易记录（测试辅助方法）
   * 
   * 返回所有交易记录的副本，用于测试断言。
   * 
   * @returns 所有交易记录的数组
   * 
   * @example
   * ```typescript
   * const transactions = adapter.getAllTransactions();
   * expect(transactions).toHaveLength(3);
   * ```
   */
  getAllTransactions(): Transaction[] {
    return this.transactions.map(t => ({ ...t }));
  }

  /**
   * 获取所有审计日志（测试辅助方法）
   * 
   * 返回所有审计日志的副本，用于测试断言。
   * 
   * @returns 所有审计日志的数组
   * 
   * @example
   * ```typescript
   * const logs = adapter.getAuditLogs();
   * expect(logs).toHaveLength(2);
   * expect(logs[0].status).toBe('success');
   * ```
   */
  getAuditLogs(): AuditLog[] {
    return this.auditLogs.map(l => ({ ...l }));
  }

  /**
   * 获取所有用户（测试辅助方法）
   * 
   * 返回所有用户的副本，用于测试断言。
   * 
   * @returns 所有用户的数组
   * 
   * @example
   * ```typescript
   * const users = adapter.getAllUsers();
   * expect(users).toHaveLength(1);
   * ```
   */
  getAllUsers(): User[] {
    return Array.from(this.users.values()).map(u => ({ ...u }));
  }

  /**
   * 获取所有幂等性记录（测试辅助方法）
   * 
   * 返回所有幂等性记录的副本，用于测试断言。
   * 
   * @returns 所有幂等性记录的数组
   * 
   * @example
   * ```typescript
   * const records = adapter.getAllIdempotencyRecords();
   * expect(records).toHaveLength(1);
   * ```
   */
  getAllIdempotencyRecords(): IdempotencyRecord[] {
    return Array.from(this.idempotencyRecords.values()).map(r => ({ ...r }));
  }

  /**
   * 设置用户（测试辅助方法）
   * 
   * 直接设置用户对象，用于测试设置。
   * 与 createUser 类似，但会覆盖已存在的用户。
   * 
   * @param user - 完整的用户对象
   * 
   * @example
   * ```typescript
   * adapter.setUser({
   *   id: 'user-123',
   *   credits: 500,
   *   membershipTier: 'premium',
   *   membershipExpiresAt: new Date('2025-12-31'),
   *   createdAt: new Date(),
   *   updatedAt: new Date()
   * });
   * ```
   */
  setUser(user: User): void {
    this.users.set(user.id, { ...user });
  }
}

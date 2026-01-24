/**
 * 存储适配器接口
 * 定义所有数据库操作的抽象接口
 * 
 * 这个接口是 SDK 与数据库交互的唯一方式，允许用户使用任何数据库系统
 * 而不被锁定在特定的 ORM 中。
 */

import {
  User,
  Transaction,
  TransactionInput,
  AuditLog,
  AuditLogInput,
  IdempotencyRecord,
  IdempotencyRecordInput
} from '../core/types';

/**
 * 存储适配器接口
 * 
 * 所有方法都接受可选的事务上下文参数 (txn)，用于支持事务透传。
 * 当提供事务上下文时，所有操作应该在该事务范围内执行。
 */
export interface IStorageAdapter {
  /**
   * 根据用户 ID 获取用户信息
   * 
   * @param userId - 用户唯一标识符
   * @param txn - 可选的事务上下文，用于在事务中执行查询
   * @returns 用户对象，如果不存在则返回 null
   * 
   * @example
   * const user = await adapter.getUserById('user-123');
   * if (user) {
   *   console.log(`User has ${user.credits} credits`);
   * }
   */
  getUserById(userId: string, txn?: any): Promise<User | null>;

  /**
   * 更新用户积分余额
   * 
   * @param userId - 用户唯一标识符
   * @param amount - 变更金额 (正数为增加，负数为减少)
   * @param txn - 可选的事务上下文
   * @returns 更新后的用户对象
   * @throws 如果用户不存在应该抛出错误
   * 
   * @example
   * // 扣除 10 积分
   * const user = await adapter.updateUserCredits('user-123', -10);
   * 
   * // 增加 50 积分
   * const user = await adapter.updateUserCredits('user-123', 50);
   */
  updateUserCredits(userId: string, amount: number, txn?: any): Promise<User>;

  /**
   * 创建交易记录
   * 
   * @param transaction - 交易数据
   * @param txn - 可选的事务上下文
   * @returns 创建的交易记录 (包含生成的 ID 和时间戳)
   * 
   * @example
   * const transaction = await adapter.createTransaction({
   *   userId: 'user-123',
   *   action: 'generate-post',
   *   amount: -10,
   *   balanceBefore: 100,
   *   balanceAfter: 90,
   *   metadata: { postId: 'post-456' }
   * });
   */
  createTransaction(transaction: TransactionInput, txn?: any): Promise<Transaction>;

  /**
   * 创建审计日志
   * 
   * @param log - 日志数据
   * @param txn - 可选的事务上下文
   * @returns 创建的审计日志 (包含生成的 ID 和时间戳)
   * 
   * @example
   * const auditLog = await adapter.createAuditLog({
   *   userId: 'user-123',
   *   action: 'charge',
   *   status: 'success',
   *   metadata: { cost: 10, action: 'generate-post' }
   * });
   */
  createAuditLog(log: AuditLogInput, txn?: any): Promise<AuditLog>;

  /**
   * 获取幂等性记录
   * 
   * @param key - 幂等键
   * @param txn - 可选的事务上下文
   * @returns 幂等性记录，如果不存在或已过期则返回 null
   * 
   * 实现注意事项：
   * - 应该检查记录是否过期 (expiresAt < now)
   * - 如果过期，应该返回 null (可选：删除过期记录)
   * 
   * @example
   * const record = await adapter.getIdempotencyRecord('idempotency-key-123');
   * if (record) {
   *   // 返回缓存的结果
   *   return record.result;
   * }
   */
  getIdempotencyRecord(key: string, txn?: any): Promise<IdempotencyRecord | null>;

  /**
   * 创建幂等性记录
   * 
   * @param record - 幂等性记录数据
   * @param txn - 可选的事务上下文
   * @returns 创建的幂等性记录 (包含创建时间)
   * 
   * @example
   * const record = await adapter.createIdempotencyRecord({
   *   key: 'idempotency-key-123',
   *   result: { success: true, transactionId: 'txn-456' },
   *   expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时后过期
   * });
   */
  createIdempotencyRecord(record: IdempotencyRecordInput, txn?: any): Promise<IdempotencyRecord>;

  /**
   * 获取用户的交易历史
   * 
   * @param userId - 用户唯一标识符
   * @param options - 查询选项 (分页、过滤等)
   * @param txn - 可选的事务上下文
   * @returns 交易记录列表，按时间戳降序排列
   * 
   * 实现注意事项：
   * - 必须按 createdAt 降序排序
   * - 支持 limit 和 offset 分页
   * - 支持日期范围过滤 (startDate, endDate)
   * - 支持操作类型过滤 (action)
   * 
   * @example
   * // 获取最近 10 条交易
   * const transactions = await adapter.getTransactions('user-123', { limit: 10 });
   * 
   * // 分页查询
   * const transactions = await adapter.getTransactions('user-123', { 
   *   limit: 20, 
   *   offset: 40 
   * });
   * 
   * // 按日期范围过滤
   * const transactions = await adapter.getTransactions('user-123', {
   *   startDate: new Date('2024-01-01'),
   *   endDate: new Date('2024-12-31')
   * });
   * 
   * // 按操作类型过滤
   * const transactions = await adapter.getTransactions('user-123', {
   *   action: 'generate-post'
   * });
   */
  getTransactions(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
      action?: string;
    },
    txn?: any
  ): Promise<Transaction[]>;

  /**
   * 更新用户会员等级和积分
   * 
   * 此方法在单个原子操作中同时更新用户的会员等级、积分余额和会员到期时间。
   * 这确保了数据一致性，防止部分更新导致的数据不一致问题。
   * 
   * @param userId - 用户唯一标识符
   * @param membershipTier - 新的会员等级
   * @param credits - 新的积分余额
   * @param membershipExpiresAt - 会员到期时间（可选）
   *   - 如果提供 Date 对象，则更新到期时间为该值
   *   - 如果提供 null，则清除到期时间（设置为 null）
   *   - 如果不提供（undefined），则保持现有到期时间不变
   * @param txn - 可选的事务上下文，用于在事务中执行更新
   * @returns 更新后的用户对象
   * @throws 如果用户不存在应该抛出错误
   * 
   * 实现注意事项：
   * - 必须在单个原子操作中更新所有字段，确保数据一致性
   * - 必须更新 updatedAt 时间戳
   * - 如果用户不存在，必须抛出错误（不应创建新用户）
   * - 支持事务上下文，确保可以与其他操作组合成原子事务
   * - membershipExpiresAt 参数的处理：
   *   - undefined: 不修改现有值
   *   - null: 清除到期时间
   *   - Date: 设置为指定日期
   * 
   * @example
   * // 升级用户到 pro 等级，设置积分为 1000，并设置到期时间
   * const user = await adapter.updateUserMembership(
   *   'user-123',
   *   'pro',
   *   1000,
   *   new Date('2025-12-31')
   * );
   * 
   * @example
   * // 降级用户到 free 等级，设置积分为 100，清除到期时间
   * const user = await adapter.updateUserMembership(
   *   'user-123',
   *   'free',
   *   100,
   *   null
   * );
   * 
   * @example
   * // 更新等级和积分，但保持现有到期时间不变
   * const user = await adapter.updateUserMembership(
   *   'user-123',
   *   'premium',
   *   10000
   * );
   * 
   * @example
   * // 在事务中更新会员信息
   * const txn = await prisma.$transaction(async (tx) => {
   *   const user = await adapter.updateUserMembership(
   *     'user-123',
   *     'pro',
   *     1000,
   *     new Date('2025-12-31'),
   *     tx
   *   );
   *   // 其他事务操作...
   *   return user;
   * });
   */
  updateUserMembership(
    userId: string,
    membershipTier: string,
    credits: number,
    membershipExpiresAt?: Date | null,
    txn?: any
  ): Promise<User>;
}

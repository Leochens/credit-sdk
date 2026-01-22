/**
 * IdempotencyManager - 幂等性管理模块
 * 防止重复操作，通过幂等键缓存操作结果
 */

import { IStorageAdapter } from '../adapters/IStorageAdapter';
import { IdempotencyRecord, IdempotencyConfig } from '../core/types';

/**
 * 幂等性管理器类
 * 负责检查和保存幂等性记录，防止重复操作
 * 
 * 核心功能：
 * - 检查幂等键是否已存在
 * - 返回缓存的操作结果
 * - 保存新的幂等记录
 * - 自动处理 TTL 过期
 * 
 * @example
 * ```typescript
 * const config = {
 *   enabled: true,
 *   ttl: 86400 // 24小时
 * };
 * 
 * const manager = new IdempotencyManager(storageAdapter, config);
 * 
 * // 检查幂等键
 * const existing = await manager.check('idempotency-key-123');
 * if (existing) {
 *   // 返回缓存的结果
 *   return existing.result;
 * }
 * 
 * // 执行操作...
 * const result = await performOperation();
 * 
 * // 保存幂等记录
 * await manager.save('idempotency-key-123', result);
 * ```
 */
export class IdempotencyManager {
  /**
   * 创建一个新的 IdempotencyManager 实例
   * @param storage - 存储适配器
   * @param config - 幂等性配置
   */
  constructor(
    private storage: IStorageAdapter,
    private config: IdempotencyConfig
  ) {}

  /**
   * 检查幂等键是否存在
   * 
   * 检查逻辑：
   * 1. 如果幂等性未启用，返回 null
   * 2. 通过存储适配器查询幂等记录
   * 3. 存储适配器会自动处理过期检查
   * 4. 返回已存在的记录或 null
   * 
   * @param key - 幂等键
   * @param txn - 可选的事务上下文
   * @returns 已存在的幂等记录，如果不存在或已过期则返回 null
   * 
   * @example
   * ```typescript
   * // 检查幂等键
   * const record = await manager.check('idempotency-key-123');
   * 
   * if (record) {
   *   console.log('Operation already executed');
   *   console.log('Cached result:', record.result);
   *   return record.result;
   * }
   * 
   * // 在事务中检查
   * const recordInTxn = await manager.check('idempotency-key-456', txn);
   * ```
   */
  async check(key: string, txn?: any): Promise<IdempotencyRecord | null> {
    // 如果幂等性未启用，直接返回 null
    if (!this.config.enabled) {
      return null;
    }

    // 通过存储适配器查询幂等记录
    // 存储适配器负责检查过期时间
    const record = await this.storage.getIdempotencyRecord(key, txn);

    return record;
  }

  /**
   * 保存幂等记录
   * 
   * 保存逻辑：
   * 1. 如果幂等性未启用，直接返回
   * 2. 计算过期时间（当前时间 + TTL）
   * 3. 通过存储适配器创建幂等记录
   * 
   * @param key - 幂等键
   * @param result - 操作结果（将被缓存）
   * @param txn - 可选的事务上下文
   * 
   * @example
   * ```typescript
   * // 保存操作结果
   * const result = {
   *   success: true,
   *   transactionId: 'txn-123',
   *   cost: 10,
   *   balanceBefore: 100,
   *   balanceAfter: 90
   * };
   * 
   * await manager.save('idempotency-key-123', result);
   * 
   * // 在事务中保存
   * await manager.save('idempotency-key-456', result, txn);
   * ```
   */
  async save(key: string, result: any, txn?: any): Promise<void> {
    // 如果幂等性未启用，直接返回
    if (!this.config.enabled) {
      return;
    }

    // 计算过期时间（当前时间 + TTL 秒）
    const expiresAt = new Date(Date.now() + this.config.ttl * 1000);

    // 通过存储适配器创建幂等记录
    await this.storage.createIdempotencyRecord(
      {
        key,
        result,
        expiresAt
      },
      txn
    );
  }

  /**
   * 检查幂等性是否启用
   * 
   * @returns 幂等性是否启用
   * 
   * @example
   * ```typescript
   * if (manager.isEnabled()) {
   *   // 执行幂等性检查
   * }
   * ```
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * 获取配置的 TTL（秒）
   * 
   * @returns TTL 秒数
   * 
   * @example
   * ```typescript
   * const ttl = manager.getTTL();
   * console.log(`Records expire after ${ttl} seconds`);
   * ```
   */
  getTTL(): number {
    return this.config.ttl;
  }
}

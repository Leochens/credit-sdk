/**
 * 审计跟踪模块
 * 负责记录所有系统操作用于审计和调试
 * 
 * 验证需求: 14.1-14.5
 */

import { IStorageAdapter } from '../adapters/IStorageAdapter';
import { AuditLogInput, AuditLog } from '../core/types';

/**
 * 审计日志条目
 * 用于传递给 log 方法的参数
 */
export interface AuditLogEntry {
  /** 用户 ID */
  userId: string;
  /** 操作类型 (如 'charge', 'refund', 'grant') */
  action: string;
  /** 操作状态 */
  status: 'success' | 'failed';
  /** 结构化元数据 (操作详情、错误信息等) */
  metadata?: Record<string, any>;
  /** 错误消息 (仅在失败时) */
  errorMessage?: string;
}

/**
 * 审计跟踪类
 * 
 * 负责记录所有积分操作的审计日志，包括：
 * - 操作类型 (charge, refund, grant)
 * - 用户 ID
 * - 时间戳
 * - 操作状态 (success, failed)
 * - 结构化元数据 (操作详情、错误信息等)
 * 
 * 所有日志通过 StorageAdapter 持久化到数据库。
 * 
 * @example
 * const auditTrail = new AuditTrail(storageAdapter);
 * 
 * // 记录成功的扣费操作
 * await auditTrail.log({
 *   userId: 'user-123',
 *   action: 'charge',
 *   status: 'success',
 *   metadata: {
 *     operation: 'generate-post',
 *     cost: 10,
 *     balanceBefore: 100,
 *     balanceAfter: 90
 *   }
 * });
 * 
 * // 记录失败的操作
 * await auditTrail.log({
 *   userId: 'user-456',
 *   action: 'charge',
 *   status: 'failed',
 *   metadata: {
 *     operation: 'generate-image',
 *     requiredCredits: 20,
 *     availableCredits: 5
 *   },
 *   errorMessage: 'Insufficient credits'
 * });
 */
export class AuditTrail {
  /**
   * 创建审计跟踪实例
   * 
   * @param storage - 存储适配器，用于持久化审计日志
   */
  constructor(private storage: IStorageAdapter) {}

  /**
   * 记录操作日志
   * 
   * 创建审计日志条目并通过 StorageAdapter 持久化。
   * 支持结构化元数据，可以包含任意操作相关的详细信息。
   * 
   * @param entry - 日志条目数据
   * @param txn - 可选的事务上下文，用于在事务中记录日志
   * @returns 创建的审计日志记录
   * 
   * @example
   * // 在事务中记录日志
   * await prisma.$transaction(async (tx) => {
   *   // ... 执行操作 ...
   *   await auditTrail.log({
   *     userId: 'user-123',
   *     action: 'charge',
   *     status: 'success',
   *     metadata: { cost: 10 }
   *   }, tx);
   * });
   * 
   * 验证需求:
   * - 14.1: 执行任何积分操作时创建日志条目
   * - 14.2: 记录操作类型、用户 ID、时间戳、状态和元数据
   * - 14.3: 记录成功和失败的操作
   * - 14.4: 支持操作特定详细信息的结构化元数据
   * - 14.5: 通过 Storage_Adapter 持久化审计日志
   */
  async log(entry: AuditLogEntry, txn?: any): Promise<AuditLog> {
    // 构建审计日志输入
    const logInput: AuditLogInput = {
      userId: entry.userId,
      action: entry.action,
      status: entry.status,
      metadata: entry.metadata || {},
      errorMessage: entry.errorMessage
    };

    // 通过 StorageAdapter 持久化日志
    return await this.storage.createAuditLog(logInput, txn);
  }
}

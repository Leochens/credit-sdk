/**
 * Prisma 存储适配器
 * IStorageAdapter 接口的 Prisma 参考实现
 * 
 * 这个适配器展示了如何将 SDK 与 Prisma ORM 集成。
 * 它处理事务上下文、类型映射和错误转换。
 */

import { PrismaClient } from '@prisma/client';
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
 * Prisma 适配器类
 * 
 * 实现所有 IStorageAdapter 方法，支持事务透传。
 * 当提供事务上下文时，使用该事务执行所有操作；
 * 否则直接使用 PrismaClient 实例。
 * 
 * @example
 * ```typescript
 * const prisma = new PrismaClient();
 * const adapter = new PrismaAdapter(prisma);
 * 
 * // 不使用事务
 * const user = await adapter.getUserById('user-123');
 * 
 * // 使用事务
 * await prisma.$transaction(async (txn) => {
 *   const user = await adapter.getUserById('user-123', txn);
 *   await adapter.updateUserCredits('user-123', -10, txn);
 * });
 * ```
 */
export class PrismaAdapter implements IStorageAdapter {
  /**
   * 创建一个新的 PrismaAdapter
   * @param prisma - PrismaClient 实例
   */
  constructor(private prisma: PrismaClient) {}

  /**
   * 获取 Prisma 客户端
   * 如果提供了事务上下文，使用事务客户端；否则使用默认客户端
   * 
   * @param txn - 可选的事务上下文
   * @returns Prisma 客户端实例
   */
  private getClient(txn?: any) {
    return txn || this.prisma;
  }

  /**
   * 根据用户 ID 获取用户信息
   * 
   * @param userId - 用户唯一标识符
   * @param txn - 可选的事务上下文
   * @returns 用户对象，如果不存在则返回 null
   */
  async getUserById(userId: string, txn?: any): Promise<User | null> {
    const client = this.getClient(txn);
    
    try {
      const user = await client.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return null;
      }

      // 将 Prisma 模型映射到 SDK User 类型
      return {
        id: user.id,
        credits: user.credits,
        membershipTier: user.membershipTier,
        membershipExpiresAt: user.membershipExpiresAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };
    } catch (error) {
      // 转换 Prisma 错误为 SDK 错误
      throw this.handlePrismaError(error, 'getUserById');
    }
  }

  /**
   * 更新用户积分余额
   * 
   * @param userId - 用户唯一标识符
   * @param amount - 变更金额 (正数为增加，负数为减少)
   * @param txn - 可选的事务上下文
   * @returns 更新后的用户对象
   * @throws UserNotFoundError 如果用户不存在
   */
  async updateUserCredits(userId: string, amount: number, txn?: any): Promise<User> {
    const client = this.getClient(txn);
    
    try {
      const user = await client.user.update({
        where: { id: userId },
        data: {
          credits: { increment: amount }
        }
      });

      // 将 Prisma 模型映射到 SDK User 类型
      return {
        id: user.id,
        credits: user.credits,
        membershipTier: user.membershipTier,
        membershipExpiresAt: user.membershipExpiresAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };
    } catch (error: any) {
      // 处理用户不存在的情况
      if (error.code === 'P2025') {
        throw new UserNotFoundError(userId);
      }
      
      // 转换其他 Prisma 错误
      throw this.handlePrismaError(error, 'updateUserCredits');
    }
  }

  /**
   * 创建交易记录
   * 
   * @param transaction - 交易数据
   * @param txn - 可选的事务上下文
   * @returns 创建的交易记录 (包含生成的 ID 和时间戳)
   */
  async createTransaction(transaction: TransactionInput, txn?: any): Promise<Transaction> {
    const client = this.getClient(txn);
    
    try {
      const created = await client.transaction.create({
        data: {
          userId: transaction.userId,
          action: transaction.action,
          amount: transaction.amount,
          balanceBefore: transaction.balanceBefore,
          balanceAfter: transaction.balanceAfter,
          metadata: transaction.metadata || {}
        }
      });

      // 将 Prisma 模型映射到 SDK Transaction 类型
      return {
        id: created.id,
        userId: created.userId,
        action: created.action,
        amount: created.amount,
        balanceBefore: created.balanceBefore,
        balanceAfter: created.balanceAfter,
        metadata: created.metadata as Record<string, any>,
        createdAt: created.createdAt
      };
    } catch (error) {
      throw this.handlePrismaError(error, 'createTransaction');
    }
  }

  /**
   * 创建审计日志
   * 
   * @param log - 日志数据
   * @param txn - 可选的事务上下文
   * @returns 创建的审计日志 (包含生成的 ID 和时间戳)
   */
  async createAuditLog(log: AuditLogInput, txn?: any): Promise<AuditLog> {
    const client = this.getClient(txn);
    
    try {
      const created = await client.auditLog.create({
        data: {
          userId: log.userId,
          action: log.action,
          status: log.status,
          metadata: log.metadata || {},
          errorMessage: log.errorMessage
        }
      });

      // 将 Prisma 模型映射到 SDK AuditLog 类型
      return {
        id: created.id,
        userId: created.userId,
        action: created.action,
        status: created.status as 'success' | 'failed',
        metadata: created.metadata as Record<string, any>,
        errorMessage: created.errorMessage || undefined,
        createdAt: created.createdAt
      };
    } catch (error) {
      throw this.handlePrismaError(error, 'createAuditLog');
    }
  }

  /**
   * 获取幂等性记录
   * 
   * @param key - 幂等键
   * @param txn - 可选的事务上下文
   * @returns 幂等性记录，如果不存在或已过期则返回 null
   */
  async getIdempotencyRecord(key: string, txn?: any): Promise<IdempotencyRecord | null> {
    const client = this.getClient(txn);
    
    try {
      const record = await client.idempotencyRecord.findUnique({
        where: { key }
      });

      if (!record) {
        return null;
      }

      // 检查是否过期
      if (record.expiresAt < new Date()) {
        // 记录已过期，返回 null
        // 注意: 可以选择在这里删除过期记录，但为了简单起见我们只返回 null
        return null;
      }

      // 将 Prisma 模型映射到 SDK IdempotencyRecord 类型
      return {
        key: record.key,
        result: record.result,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt
      };
    } catch (error) {
      throw this.handlePrismaError(error, 'getIdempotencyRecord');
    }
  }

  /**
   * 创建幂等性记录
   * 
   * @param record - 幂等性记录数据
   * @param txn - 可选的事务上下文
   * @returns 创建的幂等性记录 (包含创建时间)
   */
  async createIdempotencyRecord(record: IdempotencyRecordInput, txn?: any): Promise<IdempotencyRecord> {
    const client = this.getClient(txn);
    
    try {
      const created = await client.idempotencyRecord.create({
        data: {
          key: record.key,
          result: record.result,
          expiresAt: record.expiresAt
        }
      });

      // 将 Prisma 模型映射到 SDK IdempotencyRecord 类型
      return {
        key: created.key,
        result: created.result,
        createdAt: created.createdAt,
        expiresAt: created.expiresAt
      };
    } catch (error) {
      throw this.handlePrismaError(error, 'createIdempotencyRecord');
    }
  }

  /**
   * 获取用户的交易历史
   * 
   * @param userId - 用户唯一标识符
   * @param options - 查询选项 (分页、过滤等)
   * @param txn - 可选的事务上下文
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
    txn?: any
  ): Promise<Transaction[]> {
    const client = this.getClient(txn);
    
    try {
      // 构建查询条件
      const where: any = {
        userId
      };

      // 添加日期范围过滤
      if (options?.startDate || options?.endDate) {
        where.createdAt = {};
        if (options.startDate) {
          where.createdAt.gte = options.startDate;
        }
        if (options.endDate) {
          where.createdAt.lte = options.endDate;
        }
      }

      // 添加操作类型过滤
      if (options?.action) {
        where.action = options.action;
      }

      const transactions = await client.transaction.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        },
        take: options?.limit,
        skip: options?.offset
      });

      // 将 Prisma 模型映射到 SDK Transaction 类型
      return transactions.map((t: any) => ({
        id: t.id,
        userId: t.userId,
        action: t.action,
        amount: t.amount,
        balanceBefore: t.balanceBefore,
        balanceAfter: t.balanceAfter,
        metadata: t.metadata as Record<string, any>,
        createdAt: t.createdAt
      }));
    } catch (error) {
      throw this.handlePrismaError(error, 'getTransactions');
    }
  }

  /**
   * 处理 Prisma 错误并转换为 SDK 错误
   * 
   * @param error - Prisma 错误对象
   * @param operation - 操作名称 (用于错误消息)
   * @returns SDK 错误
   */
  private handlePrismaError(error: any, operation: string): Error {
    // 如果已经是 SDK 错误（CreditsSDKError 及其子类），直接返回
    if (error instanceof Error && error.constructor.name.includes('CreditsSDKError')) {
      return error;
    }

    // Prisma 特定错误代码
    // P2025: Record not found
    // P2002: Unique constraint violation
    // P2003: Foreign key constraint violation
    
    if (error.code) {
      switch (error.code) {
        case 'P2025':
          return new Error(`Record not found in ${operation}`);
        case 'P2002':
          return new Error(`Unique constraint violation in ${operation}: ${error.meta?.target || 'unknown field'}`);
        case 'P2003':
          return new Error(`Foreign key constraint violation in ${operation}`);
        default:
          return new Error(`Prisma error in ${operation}: ${error.message}`);
      }
    }

    // 通用错误
    return new Error(`Database error in ${operation}: ${error.message || 'Unknown error'}`);
  }
}

/**
 * RetryHandler - 重试处理模块
 * 为瞬态故障提供自动重试逻辑和指数退避
 */

import { RetryConfig } from '../core/types';
import { ILogAdapter } from '../adapters/ILogAdapter';

/**
 * 重试选项类型
 * 用于配置单个操作的重试行为
 */
export interface RetryOptions {
  /** 最大重试次数 */
  maxAttempts?: number;
  /** 初始延迟（毫秒） */
  initialDelay?: number;
  /** 最大延迟（毫秒） */
  maxDelay?: number;
  /** 退避倍数 */
  backoffMultiplier?: number;
  /** 可重试的错误类型（错误名称或错误代码） */
  retryableErrors?: string[];
}

/**
 * 默认可重试的错误类型
 * 这些通常是瞬态错误，重试可能会成功
 */
const DEFAULT_RETRYABLE_ERRORS = [
  // 网络错误
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ENETUNREACH',
  
  // 数据库错误
  'ER_LOCK_WAIT_TIMEOUT',
  'ER_LOCK_DEADLOCK',
  'SQLITE_BUSY',
  'SQLITE_LOCKED',
  
  // Prisma 错误
  'P2024', // Timed out fetching a new connection from the connection pool
  'P2034', // Transaction failed due to a write conflict or a deadlock
  
  // HTTP 错误状态码
  '408', // Request Timeout
  '429', // Too Many Requests
  '500', // Internal Server Error
  '502', // Bad Gateway
  '503', // Service Unavailable
  '504', // Gateway Timeout
];

/**
 * 重试处理器类
 * 负责执行带重试逻辑的操作，支持指数退避
 * 
 * @example
 * ```typescript
 * const retryConfig = {
 *   enabled: true,
 *   maxAttempts: 3,
 *   initialDelay: 100,
 *   maxDelay: 5000,
 *   backoffMultiplier: 2
 * };
 * 
 * const handler = new RetryHandler(retryConfig, logger);
 * 
 * const result = await handler.execute(
 *   async () => {
 *     return await someOperation();
 *   },
 *   { maxAttempts: 5 }
 * );
 * ```
 */
export class RetryHandler {
  private readonly config: Required<RetryConfig>;
  
  /**
   * 创建一个新的 RetryHandler 实例
   * @param retryConfig - 重试配置对象
   * @param logger - 日志适配器（可选）
   */
  constructor(
    retryConfig: RetryConfig,
    private logger?: ILogAdapter
  ) {
    // 确保配置完整
    this.config = {
      enabled: retryConfig.enabled,
      maxAttempts: retryConfig.maxAttempts,
      initialDelay: retryConfig.initialDelay,
      maxDelay: retryConfig.maxDelay,
      backoffMultiplier: retryConfig.backoffMultiplier
    };
  }

  /**
   * 执行带重试的操作
   * 
   * 执行逻辑：
   * 1. 如果重试未启用，直接执行操作
   * 2. 尝试执行操作
   * 3. 如果成功，返回结果
   * 4. 如果失败且错误可重试，等待后重试
   * 5. 使用指数退避计算延迟时间
   * 6. 如果超过最大重试次数，抛出原始错误
   * 
   * @param operation - 要执行的操作（返回 Promise 的函数）
   * @param options - 重试选项（可选，覆盖默认配置）
   * @returns 操作结果
   * @throws 如果所有重试都失败，抛出最后一次的错误
   * 
   * @example
   * ```typescript
   * // 使用默认配置
   * const result = await handler.execute(async () => {
   *   return await fetchData();
   * });
   * 
   * // 自定义重试选项
   * const result = await handler.execute(
   *   async () => await fetchData(),
   *   { maxAttempts: 5, initialDelay: 200 }
   * );
   * 
   * // 指定可重试的错误
   * const result = await handler.execute(
   *   async () => await fetchData(),
   *   { retryableErrors: ['ECONNRESET', 'ETIMEDOUT'] }
   * );
   * ```
   */
  async execute<T>(
    operation: () => Promise<T>,
    options?: RetryOptions
  ): Promise<T> {
    // 如果重试未启用，直接执行操作
    if (!this.config.enabled) {
      return await operation();
    }

    // 合并配置和选项
    const maxAttempts = options?.maxAttempts ?? this.config.maxAttempts;
    const initialDelay = options?.initialDelay ?? this.config.initialDelay;
    const maxDelay = options?.maxDelay ?? this.config.maxDelay;
    const backoffMultiplier = options?.backoffMultiplier ?? this.config.backoffMultiplier;
    const retryableErrors = options?.retryableErrors ?? DEFAULT_RETRYABLE_ERRORS;

    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;

      try {
        // 尝试执行操作
        const result = await operation();
        
        // 如果之前有重试，记录成功日志
        if (attempt > 1) {
          this.logger?.info('Operation succeeded after retry', {
            attempt,
            totalAttempts: maxAttempts
          });
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;

        // 检查是否是可重试的错误
        const isRetryable = this.isRetryableError(error, retryableErrors);

        // 如果不可重试或已达到最大重试次数，抛出错误
        if (!isRetryable || attempt >= maxAttempts) {
          if (!isRetryable) {
            this.logger?.warn('Error is not retryable', {
              error: this.getErrorInfo(error),
              attempt,
              maxAttempts
            });
          } else {
            this.logger?.error('Max retry attempts reached', {
              error: this.getErrorInfo(error),
              attempt,
              maxAttempts
            });
          }
          throw error;
        }

        // 计算延迟时间（指数退避）
        const delay = this.calculateDelay(
          attempt,
          initialDelay,
          maxDelay,
          backoffMultiplier
        );

        // 记录重试日志
        this.logger?.warn('Operation failed, retrying', {
          error: this.getErrorInfo(error),
          attempt,
          maxAttempts,
          nextRetryIn: delay
        });

        // 等待后重试
        await this.sleep(delay);
      }
    }

    // 理论上不应该到达这里，但为了类型安全
    throw lastError || new Error('Operation failed after all retries');
  }

  /**
   * 检查错误是否可重试
   * 
   * 检查逻辑：
   * 1. 检查错误的 name 属性
   * 2. 检查错误的 code 属性
   * 3. 检查错误消息中是否包含可重试的错误标识
   * 
   * @param error - 错误对象
   * @param retryableErrors - 可重试的错误类型列表
   * @returns 是否可重试
   * 
   * @example
   * ```typescript
   * const error = new Error('Connection timeout');
   * error.code = 'ETIMEDOUT';
   * 
   * handler.isRetryableError(error, ['ETIMEDOUT']); // true
   * handler.isRetryableError(error, ['ECONNRESET']); // false
   * ```
   */
  private isRetryableError(error: any, retryableErrors: string[]): boolean {
    if (!error) {
      return false;
    }

    // 检查错误名称
    if (error.name && retryableErrors.includes(error.name)) {
      return true;
    }

    // 检查错误代码
    if (error.code && retryableErrors.includes(error.code)) {
      return true;
    }

    // 检查错误消息
    if (error.message) {
      const message = error.message.toLowerCase();
      for (const retryableError of retryableErrors) {
        if (message.includes(retryableError.toLowerCase())) {
          return true;
        }
      }
    }

    // 检查 HTTP 状态码
    if (error.statusCode && retryableErrors.includes(String(error.statusCode))) {
      return true;
    }

    return false;
  }

  /**
   * 计算重试延迟时间（指数退避）
   * 
   * 计算公式：delay = min(initialDelay * (backoffMultiplier ^ (attempt - 1)), maxDelay)
   * 
   * @param attempt - 当前尝试次数（从 1 开始）
   * @param initialDelay - 初始延迟（毫秒）
   * @param maxDelay - 最大延迟（毫秒）
   * @param backoffMultiplier - 退避倍数
   * @returns 延迟时间（毫秒）
   * 
   * @example
   * ```typescript
   * // 初始延迟 100ms，倍数 2，最大 5000ms
   * handler.calculateDelay(1, 100, 5000, 2); // 100
   * handler.calculateDelay(2, 100, 5000, 2); // 200
   * handler.calculateDelay(3, 100, 5000, 2); // 400
   * handler.calculateDelay(4, 100, 5000, 2); // 800
   * handler.calculateDelay(10, 100, 5000, 2); // 5000 (达到最大值)
   * ```
   */
  private calculateDelay(
    attempt: number,
    initialDelay: number,
    maxDelay: number,
    backoffMultiplier: number
  ): number {
    // 计算指数退避延迟
    // attempt - 1 是因为第一次重试（attempt = 2）应该使用 initialDelay
    const exponentialDelay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);
    
    // 确保不超过最大延迟
    return Math.min(exponentialDelay, maxDelay);
  }

  /**
   * 睡眠指定时间
   * 
   * @param ms - 睡眠时间（毫秒）
   * @returns Promise，在指定时间后 resolve
   * 
   * @example
   * ```typescript
   * await handler.sleep(1000); // 等待 1 秒
   * ```
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取错误信息用于日志记录
   * 
   * @param error - 错误对象
   * @returns 错误信息对象
   */
  private getErrorInfo(error: any): Record<string, any> {
    return {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      statusCode: error?.statusCode
    };
  }
}

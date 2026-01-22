/**
 * 日志适配器接口
 * 定义日志记录的抽象接口
 * 
 * 这个接口允许用户将 SDK 与现有的日志基础设施集成，
 * 或使用默认的 console 日志实现。
 */

/**
 * 日志适配器接口
 * 
 * 提供四个标准日志级别：debug, info, warn, error
 * 每个方法都接受消息和可选的上下文对象
 */
export interface ILogAdapter {
  /**
   * 记录调试信息
   * 用于详细的调试输出
   * 
   * @param message - 日志消息
   * @param context - 可选的上下文信息 (如用户 ID、操作详情等)
   * 
   * @example
   * logger.debug('Checking idempotency key', { key: 'idempotency-123' });
   */
  debug(message: string, context?: any): void;

  /**
   * 记录一般信息
   * 用于记录正常的操作流程
   * 
   * @param message - 日志消息
   * @param context - 可选的上下文信息
   * 
   * @example
   * logger.info('Charge completed successfully', {
   *   userId: 'user-123',
   *   action: 'generate-post',
   *   cost: 10
   * });
   */
  info(message: string, context?: any): void;

  /**
   * 记录警告信息
   * 用于记录潜在问题或异常情况
   * 
   * @param message - 日志消息
   * @param context - 可选的上下文信息
   * 
   * @example
   * logger.warn('User membership expired', {
   *   userId: 'user-123',
   *   expiresAt: new Date()
   * });
   */
  warn(message: string, context?: any): void;

  /**
   * 记录错误信息
   * 用于记录错误和失败
   * 
   * @param message - 日志消息
   * @param context - 可选的上下文信息 (通常包含错误对象)
   * 
   * @example
   * logger.error('Charge failed', {
   *   userId: 'user-123',
   *   error: error.message,
   *   stack: error.stack
   * });
   */
  error(message: string, context?: any): void;
}

/**
 * 默认的 Console 日志实现
 * 使用标准的 console 方法进行日志记录
 */
export class ConsoleLogger implements ILogAdapter {
  debug(message: string, context?: any): void {
    if (context) {
      console.debug(message, context);
    } else {
      console.debug(message);
    }
  }

  info(message: string, context?: any): void {
    if (context) {
      console.info(message, context);
    } else {
      console.info(message);
    }
  }

  warn(message: string, context?: any): void {
    if (context) {
      console.warn(message, context);
    } else {
      console.warn(message);
    }
  }

  error(message: string, context?: any): void {
    if (context) {
      console.error(message, context);
    } else {
      console.error(message);
    }
  }
}

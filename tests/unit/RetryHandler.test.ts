/**
 * RetryHandler 单元测试
 * 测试重试逻辑、指数退避和错误识别
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RetryHandler } from '../../src/features/RetryHandler';
import { RetryConfig } from '../../src/core/types';
import { ILogAdapter } from '../../src/adapters/ILogAdapter';

// Mock logger
class MockLogger implements ILogAdapter {
  logs: Array<{ level: string; message: string; context?: any }> = [];

  debug(message: string, context?: any): void {
    this.logs.push({ level: 'debug', message, context });
  }

  info(message: string, context?: any): void {
    this.logs.push({ level: 'info', message, context });
  }

  warn(message: string, context?: any): void {
    this.logs.push({ level: 'warn', message, context });
  }

  error(message: string, context?: any): void {
    this.logs.push({ level: 'error', message, context });
  }

  reset(): void {
    this.logs = [];
  }
}

describe('RetryHandler', () => {
  let retryConfig: RetryConfig;
  let mockLogger: MockLogger;

  beforeEach(() => {
    retryConfig = {
      enabled: true,
      maxAttempts: 3,
      initialDelay: 100,
      maxDelay: 5000,
      backoffMultiplier: 2
    };
    mockLogger = new MockLogger();
  });

  describe('基本功能', () => {
    it('应该在操作成功时返回结果', async () => {
      const handler = new RetryHandler(retryConfig, mockLogger);
      const result = await handler.execute(async () => 'success');
      
      expect(result).toBe('success');
    });

    it('应该在重试未启用时直接执行操作', async () => {
      const disabledConfig = { ...retryConfig, enabled: false };
      const handler = new RetryHandler(disabledConfig, mockLogger);
      
      let attempts = 0;
      const operation = async () => {
        attempts++;
        throw new Error('Test error');
      };

      await expect(handler.execute(operation)).rejects.toThrow('Test error');
      expect(attempts).toBe(1);
    });

    it('应该在操作失败且不可重试时立即抛出错误', async () => {
      const handler = new RetryHandler(retryConfig, mockLogger);
      
      let attempts = 0;
      const operation = async () => {
        attempts++;
        const error = new Error('Non-retryable error');
        (error as any).code = 'NON_RETRYABLE';
        throw error;
      };

      await expect(handler.execute(operation, { retryableErrors: ['ETIMEDOUT'] }))
        .rejects.toThrow('Non-retryable error');
      
      expect(attempts).toBe(1);
    });
  });

  describe('重试逻辑', () => {
    it('应该在瞬态错误时自动重试', async () => {
      const handler = new RetryHandler(retryConfig, mockLogger);
      
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          const error = new Error('Timeout');
          (error as any).code = 'ETIMEDOUT';
          throw error;
        }
        return 'success';
      };

      const result = await handler.execute(operation);
      
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('应该在达到最大重试次数后抛出错误', async () => {
      const handler = new RetryHandler(retryConfig, mockLogger);
      
      let attempts = 0;
      const operation = async () => {
        attempts++;
        const error = new Error('Persistent error');
        (error as any).code = 'ETIMEDOUT';
        throw error;
      };

      await expect(handler.execute(operation)).rejects.toThrow('Persistent error');
      expect(attempts).toBe(3); // maxAttempts
    });

    it('应该支持自定义最大重试次数', async () => {
      const handler = new RetryHandler(retryConfig, mockLogger);
      
      let attempts = 0;
      const operation = async () => {
        attempts++;
        const error = new Error('Error');
        (error as any).code = 'ETIMEDOUT';
        throw error;
      };

      await expect(handler.execute(operation, { maxAttempts: 5 }))
        .rejects.toThrow('Error');
      
      expect(attempts).toBe(5);
    });
  });

  describe('指数退避', () => {
    it('应该在重试之间实施指数退避', async () => {
      const handler = new RetryHandler(retryConfig, mockLogger);
      
      const delays: number[] = [];
      let attempts = 0;
      let lastTime = Date.now();
      
      const operation = async () => {
        attempts++;
        if (attempts > 1) {
          const currentTime = Date.now();
          delays.push(currentTime - lastTime);
          lastTime = currentTime;
        } else {
          lastTime = Date.now();
        }
        
        if (attempts < 4) {
          const error = new Error('Error');
          (error as any).code = 'ETIMEDOUT';
          throw error;
        }
        return 'success';
      };

      await handler.execute(operation, { maxAttempts: 4 });
      
      // 验证延迟递增（允许一些误差）
      expect(delays.length).toBe(3);
      expect(delays[0]).toBeGreaterThanOrEqual(90); // ~100ms
      expect(delays[1]).toBeGreaterThanOrEqual(190); // ~200ms
      expect(delays[2]).toBeGreaterThanOrEqual(390); // ~400ms
    });

    it('应该限制延迟不超过最大值', async () => {
      const handler = new RetryHandler({
        ...retryConfig,
        initialDelay: 100,
        maxDelay: 500,
        maxAttempts: 5
      }, mockLogger);
      
      const delays: number[] = [];
      let attempts = 0;
      let lastTime = Date.now();
      
      const operation = async () => {
        attempts++;
        if (attempts > 1) {
          const currentTime = Date.now();
          delays.push(currentTime - lastTime);
          lastTime = currentTime;
        } else {
          lastTime = Date.now();
        }
        
        const error = new Error('Error');
        (error as any).code = 'ETIMEDOUT';
        throw error;
      };

      await expect(handler.execute(operation)).rejects.toThrow();
      
      // 所有延迟都不应超过 maxDelay
      delays.forEach(delay => {
        expect(delay).toBeLessThanOrEqual(600); // 允许一些误差
      });
    });
  });

  describe('可重试错误识别', () => {
    it('应该识别错误代码', async () => {
      const handler = new RetryHandler(retryConfig, mockLogger);
      
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 2) {
          const error = new Error('Connection reset');
          (error as any).code = 'ECONNRESET';
          throw error;
        }
        return 'success';
      };

      const result = await handler.execute(operation);
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('应该识别错误名称', async () => {
      const handler = new RetryHandler(retryConfig, mockLogger);
      
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 2) {
          const error = new Error('Timeout');
          error.name = 'ETIMEDOUT';
          throw error;
        }
        return 'success';
      };

      const result = await handler.execute(operation);
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('应该识别 HTTP 状态码', async () => {
      const handler = new RetryHandler(retryConfig, mockLogger);
      
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 2) {
          const error = new Error('Service unavailable');
          (error as any).statusCode = 503;
          throw error;
        }
        return 'success';
      };

      const result = await handler.execute(operation);
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('应该支持自定义可重试错误列表', async () => {
      const handler = new RetryHandler(retryConfig, mockLogger);
      
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 2) {
          const error = new Error('Custom error');
          (error as any).code = 'CUSTOM_ERROR';
          throw error;
        }
        return 'success';
      };

      const result = await handler.execute(operation, {
        retryableErrors: ['CUSTOM_ERROR']
      });
      
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('应该识别 Prisma 错误代码', async () => {
      const handler = new RetryHandler(retryConfig, mockLogger);
      
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 2) {
          const error = new Error('Connection pool timeout');
          (error as any).code = 'P2024';
          throw error;
        }
        return 'success';
      };

      const result = await handler.execute(operation);
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });
  });

  describe('日志记录', () => {
    it('应该记录重试日志', async () => {
      const handler = new RetryHandler(retryConfig, mockLogger);
      
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          const error = new Error('Error');
          (error as any).code = 'ETIMEDOUT';
          throw error;
        }
        return 'success';
      };

      await handler.execute(operation);
      
      // 应该有 2 次重试警告日志
      const warnLogs = mockLogger.logs.filter(log => log.level === 'warn');
      expect(warnLogs.length).toBeGreaterThanOrEqual(2);
    });

    it('应该记录成功重试后的日志', async () => {
      const handler = new RetryHandler(retryConfig, mockLogger);
      
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 2) {
          const error = new Error('Error');
          (error as any).code = 'ETIMEDOUT';
          throw error;
        }
        return 'success';
      };

      await handler.execute(operation);
      
      // 应该有成功日志
      const infoLogs = mockLogger.logs.filter(log => log.level === 'info');
      expect(infoLogs.length).toBeGreaterThan(0);
      expect(infoLogs[0].message).toContain('succeeded after retry');
    });

    it('应该记录不可重试错误的日志', async () => {
      const handler = new RetryHandler(retryConfig, mockLogger);
      
      const operation = async () => {
        const error = new Error('Non-retryable');
        (error as any).code = 'NON_RETRYABLE';
        throw error;
      };

      await expect(handler.execute(operation, { retryableErrors: ['ETIMEDOUT'] }))
        .rejects.toThrow();
      
      const warnLogs = mockLogger.logs.filter(log => 
        log.level === 'warn' && log.message.includes('not retryable')
      );
      expect(warnLogs.length).toBeGreaterThan(0);
    });

    it('应该记录达到最大重试次数的日志', async () => {
      const handler = new RetryHandler(retryConfig, mockLogger);
      
      const operation = async () => {
        const error = new Error('Persistent error');
        (error as any).code = 'ETIMEDOUT';
        throw error;
      };

      await expect(handler.execute(operation)).rejects.toThrow();
      
      const errorLogs = mockLogger.logs.filter(log => 
        log.level === 'error' && log.message.includes('Max retry')
      );
      expect(errorLogs.length).toBeGreaterThan(0);
    });
  });

  describe('边缘情况', () => {
    it('应该处理返回 Promise 的操作', async () => {
      const handler = new RetryHandler(retryConfig, mockLogger);
      
      const result = await handler.execute(() => Promise.resolve(42));
      expect(result).toBe(42);
    });

    it('应该处理抛出非 Error 对象的操作', async () => {
      const handler = new RetryHandler(retryConfig, mockLogger);
      
      const operation = async () => {
        throw 'string error';
      };

      await expect(handler.execute(operation)).rejects.toBe('string error');
    });

    it('应该处理 maxAttempts 为 1 的情况', async () => {
      const handler = new RetryHandler(retryConfig, mockLogger);
      
      let attempts = 0;
      const operation = async () => {
        attempts++;
        const error = new Error('Error');
        (error as any).code = 'ETIMEDOUT';
        throw error;
      };

      await expect(handler.execute(operation, { maxAttempts: 1 }))
        .rejects.toThrow();
      
      expect(attempts).toBe(1);
    });

    it('应该处理 initialDelay 为 0 的情况', async () => {
      const handler = new RetryHandler({
        ...retryConfig,
        initialDelay: 0
      }, mockLogger);
      
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 2) {
          const error = new Error('Error');
          (error as any).code = 'ETIMEDOUT';
          throw error;
        }
        return 'success';
      };

      const result = await handler.execute(operation);
      expect(result).toBe('success');
    });
  });

  describe('配置覆盖', () => {
    it('应该允许操作级别的配置覆盖', async () => {
      const handler = new RetryHandler(retryConfig, mockLogger);
      
      let attempts = 0;
      const operation = async () => {
        attempts++;
        const error = new Error('Error');
        (error as any).code = 'ETIMEDOUT';
        throw error;
      };

      await expect(handler.execute(operation, {
        maxAttempts: 2,
        initialDelay: 50,
        maxDelay: 1000,
        backoffMultiplier: 3
      })).rejects.toThrow();
      
      expect(attempts).toBe(2);
    });

    it('应该在未提供选项时使用默认配置', async () => {
      const handler = new RetryHandler(retryConfig, mockLogger);
      
      let attempts = 0;
      const operation = async () => {
        attempts++;
        const error = new Error('Error');
        (error as any).code = 'ETIMEDOUT';
        throw error;
      };

      await expect(handler.execute(operation)).rejects.toThrow();
      expect(attempts).toBe(retryConfig.maxAttempts);
    });
  });
});

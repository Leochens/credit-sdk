/**
 * ConsoleLogger 单元测试
 * 验证 ConsoleLogger 正确实现 ILogAdapter 接口并使用 console 方法
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConsoleLogger, ILogAdapter } from '../../src/adapters/ILogAdapter';

describe('ConsoleLogger', () => {
  let logger: ConsoleLogger;
  let consoleDebugSpy: any;
  let consoleInfoSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    logger = new ConsoleLogger();
    
    // Spy on console methods
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console methods
    vi.restoreAllMocks();
  });

  describe('Interface Implementation', () => {
    it('should implement ILogAdapter interface', () => {
      // Verify all required methods exist
      expect(logger).toHaveProperty('debug');
      expect(logger).toHaveProperty('info');
      expect(logger).toHaveProperty('warn');
      expect(logger).toHaveProperty('error');
      
      // Verify methods are functions
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });
  });

  describe('debug method', () => {
    it('should call console.debug with message only', () => {
      const message = 'Debug message';
      logger.debug(message);
      
      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
      expect(consoleDebugSpy).toHaveBeenCalledWith(message);
    });

    it('should call console.debug with message and context', () => {
      const message = 'Debug message';
      const context = { userId: 'user-123', action: 'test' };
      logger.debug(message, context);
      
      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
      expect(consoleDebugSpy).toHaveBeenCalledWith(message, context);
    });
  });

  describe('info method', () => {
    it('should call console.info with message only', () => {
      const message = 'Info message';
      logger.info(message);
      
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      expect(consoleInfoSpy).toHaveBeenCalledWith(message);
    });

    it('should call console.info with message and context', () => {
      const message = 'Info message';
      const context = { userId: 'user-123', cost: 10 };
      logger.info(message, context);
      
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      expect(consoleInfoSpy).toHaveBeenCalledWith(message, context);
    });
  });

  describe('warn method', () => {
    it('should call console.warn with message only', () => {
      const message = 'Warning message';
      logger.warn(message);
      
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(message);
    });

    it('should call console.warn with message and context', () => {
      const message = 'Warning message';
      const context = { userId: 'user-123', issue: 'membership expired' };
      logger.warn(message, context);
      
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(message, context);
    });
  });

  describe('error method', () => {
    it('should call console.error with message only', () => {
      const message = 'Error message';
      logger.error(message);
      
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(message);
    });

    it('should call console.error with message and context', () => {
      const message = 'Error message';
      const context = { userId: 'user-123', error: 'Insufficient credits' };
      logger.error(message, context);
      
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(message, context);
    });
  });

  describe('Requirement 16.2 Validation', () => {
    it('should use console methods as default logging mechanism', () => {
      // Test all log levels to ensure console is used
      logger.debug('debug test');
      logger.info('info test');
      logger.warn('warn test');
      logger.error('error test');
      
      // Verify all console methods were called
      expect(consoleDebugSpy).toHaveBeenCalledWith('debug test');
      expect(consoleInfoSpy).toHaveBeenCalledWith('info test');
      expect(consoleWarnSpy).toHaveBeenCalledWith('warn test');
      expect(consoleErrorSpy).toHaveBeenCalledWith('error test');
    });

    it('should handle context information correctly', () => {
      const context = {
        userId: 'user-123',
        action: 'generate-post',
        amount: 10
      };
      
      logger.info('Operation completed', context);
      
      expect(consoleInfoSpy).toHaveBeenCalledWith('Operation completed', context);
    });
  });
});

/**
 * 错误类单元测试
 * 验证所有错误类的正确行为
 */

import { describe, it, expect } from 'vitest';
import {
  CreditsSDKError,
  InsufficientCreditsError,
  UserNotFoundError,
  MembershipRequiredError,
  IdempotencyKeyConflictError,
  ConfigurationError,
  UndefinedActionError,
} from '../../src/core/errors';

describe('CreditsSDKError', () => {
  it('should create error with correct message and code', () => {
    const error = new CreditsSDKError('Test error', 'TEST_CODE');
    
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('CreditsSDKError');
  });

  it('should be instance of Error', () => {
    const error = new CreditsSDKError('Test error', 'TEST_CODE');
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CreditsSDKError);
  });

  it('should have correct prototype chain', () => {
    const error = new CreditsSDKError('Test error', 'TEST_CODE');
    
    expect(Object.getPrototypeOf(error)).toBe(CreditsSDKError.prototype);
  });
});

describe('InsufficientCreditsError', () => {
  it('should create error with correct message format', () => {
    const error = new InsufficientCreditsError('user123', 100, 50);
    
    expect(error.message).toBe('User user123 has insufficient credits. Required: 100, Available: 50');
  });

  it('should have correct error code', () => {
    const error = new InsufficientCreditsError('user123', 100, 50);
    
    expect(error.code).toBe('INSUFFICIENT_CREDITS');
  });

  it('should have correct name', () => {
    const error = new InsufficientCreditsError('user123', 100, 50);
    
    expect(error.name).toBe('InsufficientCreditsError');
  });

  it('should store userId, required, and available properties', () => {
    const error = new InsufficientCreditsError('user123', 100, 50);
    
    expect(error.userId).toBe('user123');
    expect(error.required).toBe(100);
    expect(error.available).toBe(50);
  });

  it('should be instance of CreditsSDKError and Error', () => {
    const error = new InsufficientCreditsError('user123', 100, 50);
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CreditsSDKError);
    expect(error).toBeInstanceOf(InsufficientCreditsError);
  });

  it('should handle zero values correctly', () => {
    const error = new InsufficientCreditsError('user456', 10, 0);
    
    expect(error.message).toBe('User user456 has insufficient credits. Required: 10, Available: 0');
    expect(error.required).toBe(10);
    expect(error.available).toBe(0);
  });
});

describe('UserNotFoundError', () => {
  it('should create error with correct message format', () => {
    const error = new UserNotFoundError('user123');
    
    expect(error.message).toBe('User user123 not found');
  });

  it('should have correct error code', () => {
    const error = new UserNotFoundError('user123');
    
    expect(error.code).toBe('USER_NOT_FOUND');
  });

  it('should have correct name', () => {
    const error = new UserNotFoundError('user123');
    
    expect(error.name).toBe('UserNotFoundError');
  });

  it('should store userId property', () => {
    const error = new UserNotFoundError('user123');
    
    expect(error.userId).toBe('user123');
  });

  it('should be instance of CreditsSDKError and Error', () => {
    const error = new UserNotFoundError('user123');
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CreditsSDKError);
    expect(error).toBeInstanceOf(UserNotFoundError);
  });
});

describe('MembershipRequiredError', () => {
  it('should create error with correct message format when user has membership', () => {
    const error = new MembershipRequiredError('user123', 'premium', 'basic');
    
    expect(error.message).toBe('User user123 requires premium membership, but has basic');
  });

  it('should create error with correct message format when user has no membership', () => {
    const error = new MembershipRequiredError('user123', 'premium', null);
    
    expect(error.message).toBe('User user123 requires premium membership, but has none');
  });

  it('should have correct error code', () => {
    const error = new MembershipRequiredError('user123', 'premium', 'basic');
    
    expect(error.code).toBe('MEMBERSHIP_REQUIRED');
  });

  it('should have correct name', () => {
    const error = new MembershipRequiredError('user123', 'premium', 'basic');
    
    expect(error.name).toBe('MembershipRequiredError');
  });

  it('should store userId, required, and current properties', () => {
    const error = new MembershipRequiredError('user123', 'premium', 'basic');
    
    expect(error.userId).toBe('user123');
    expect(error.required).toBe('premium');
    expect(error.current).toBe('basic');
  });

  it('should handle null current membership', () => {
    const error = new MembershipRequiredError('user456', 'enterprise', null);
    
    expect(error.current).toBeNull();
    expect(error.message).toContain('but has none');
  });

  it('should be instance of CreditsSDKError and Error', () => {
    const error = new MembershipRequiredError('user123', 'premium', 'basic');
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CreditsSDKError);
    expect(error).toBeInstanceOf(MembershipRequiredError);
  });
});

describe('IdempotencyKeyConflictError', () => {
  it('should create error with correct message format', () => {
    const error = new IdempotencyKeyConflictError('key123', { id: 'txn456' });
    
    expect(error.message).toBe('Idempotency key key123 already exists');
  });

  it('should have correct error code', () => {
    const error = new IdempotencyKeyConflictError('key123', { id: 'txn456' });
    
    expect(error.code).toBe('IDEMPOTENCY_KEY_CONFLICT');
  });

  it('should have correct name', () => {
    const error = new IdempotencyKeyConflictError('key123', { id: 'txn456' });
    
    expect(error.name).toBe('IdempotencyKeyConflictError');
  });

  it('should store key and existingTransaction properties', () => {
    const transaction = { id: 'txn456', amount: 100 };
    const error = new IdempotencyKeyConflictError('key123', transaction);
    
    expect(error.key).toBe('key123');
    expect(error.existingTransaction).toEqual(transaction);
  });

  it('should be instance of CreditsSDKError and Error', () => {
    const error = new IdempotencyKeyConflictError('key123', { id: 'txn456' });
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CreditsSDKError);
    expect(error).toBeInstanceOf(IdempotencyKeyConflictError);
  });
});

describe('ConfigurationError', () => {
  it('should create error with custom message', () => {
    const message = 'Cost configuration is missing';
    const error = new ConfigurationError(message);
    
    expect(error.message).toBe(message);
  });

  it('should have correct error code', () => {
    const error = new ConfigurationError('Test config error');
    
    expect(error.code).toBe('CONFIGURATION_ERROR');
  });

  it('should have correct name', () => {
    const error = new ConfigurationError('Test config error');
    
    expect(error.name).toBe('ConfigurationError');
  });

  it('should be instance of CreditsSDKError and Error', () => {
    const error = new ConfigurationError('Test config error');
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CreditsSDKError);
    expect(error).toBeInstanceOf(ConfigurationError);
  });

  it('should handle various configuration error messages', () => {
    const messages = [
      'Missing storage adapter',
      'Invalid retry configuration',
      'Cost configuration is missing for action: generate-post',
    ];

    messages.forEach(msg => {
      const error = new ConfigurationError(msg);
      expect(error.message).toBe(msg);
    });
  });
});

describe('UndefinedActionError', () => {
  it('should create error with correct message format', () => {
    const error = new UndefinedActionError('unknown-action');
    
    expect(error.message).toBe('Action unknown-action has no defined cost');
  });

  it('should have correct error code', () => {
    const error = new UndefinedActionError('unknown-action');
    
    expect(error.code).toBe('UNDEFINED_ACTION');
  });

  it('should have correct name', () => {
    const error = new UndefinedActionError('unknown-action');
    
    expect(error.name).toBe('UndefinedActionError');
  });

  it('should store action property', () => {
    const error = new UndefinedActionError('unknown-action');
    
    expect(error.action).toBe('unknown-action');
  });

  it('should be instance of CreditsSDKError and Error', () => {
    const error = new UndefinedActionError('unknown-action');
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CreditsSDKError);
    expect(error).toBeInstanceOf(UndefinedActionError);
  });

  it('should handle various action names', () => {
    const actions = ['generate-post', 'generate-image', 'analyze-text'];

    actions.forEach(action => {
      const error = new UndefinedActionError(action);
      expect(error.action).toBe(action);
      expect(error.message).toContain(action);
    });
  });
});

describe('Error inheritance and type checking', () => {
  it('should allow catching specific error types', () => {
    const throwInsufficientCredits = () => {
      throw new InsufficientCreditsError('user123', 100, 50);
    };

    expect(throwInsufficientCredits).toThrow(InsufficientCreditsError);
    expect(throwInsufficientCredits).toThrow(CreditsSDKError);
    expect(throwInsufficientCredits).toThrow(Error);
  });

  it('should allow catching base CreditsSDKError for all SDK errors', () => {
    const errors = [
      new InsufficientCreditsError('user123', 100, 50),
      new UserNotFoundError('user123'),
      new MembershipRequiredError('user123', 'premium', 'basic'),
      new IdempotencyKeyConflictError('key123', {}),
      new ConfigurationError('Test error'),
      new UndefinedActionError('unknown-action'),
    ];

    errors.forEach(error => {
      expect(error).toBeInstanceOf(CreditsSDKError);
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBeDefined();
      expect(error.message).toBeDefined();
    });
  });

  it('should distinguish between different error types', () => {
    const insufficientError = new InsufficientCreditsError('user123', 100, 50);
    const notFoundError = new UserNotFoundError('user123');

    expect(insufficientError).toBeInstanceOf(InsufficientCreditsError);
    expect(insufficientError).not.toBeInstanceOf(UserNotFoundError);

    expect(notFoundError).toBeInstanceOf(UserNotFoundError);
    expect(notFoundError).not.toBeInstanceOf(InsufficientCreditsError);
  });
});

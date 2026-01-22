/**
 * MembershipValidator 单元测试
 * 测试会员验证逻辑的各种场景
 */

import { describe, it, expect } from 'vitest';
import { MembershipValidator } from '../../src/features/MembershipValidator';
import { User, MembershipConfig } from '../../src/core/types';

describe('MembershipValidator', () => {
  // 测试用的会员配置
  const membershipConfig: MembershipConfig = {
    tiers: {
      free: 0,
      basic: 1,
      premium: 2,
      enterprise: 3,
    },
    requirements: {
      'generate-post': 'basic',
      'generate-image': 'premium',
      'advanced-analytics': 'enterprise',
      'free-action': null,
    },
  };

  // 辅助函数：创建测试用户
  const createUser = (
    membershipTier: string | null,
    membershipExpiresAt: Date | null
  ): User => ({
    id: 'test-user',
    credits: 1000,
    membershipTier,
    membershipExpiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  describe('validate', () => {
    it('should pass validation when user has sufficient membership tier', () => {
      const validator = new MembershipValidator(membershipConfig);
      const user = createUser('premium', null);

      const result = validator.validate(user, 'basic');

      expect(result.valid).toBe(true);
      expect(result.currentTier).toBe('premium');
      expect(result.requiredTier).toBe('basic');
      expect(result.isExpired).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    it('should pass validation when user has exact required tier', () => {
      const validator = new MembershipValidator(membershipConfig);
      const user = createUser('premium', null);

      const result = validator.validate(user, 'premium');

      expect(result.valid).toBe(true);
      expect(result.currentTier).toBe('premium');
      expect(result.requiredTier).toBe('premium');
      expect(result.isExpired).toBe(false);
    });

    it('should fail validation when user has insufficient membership tier', () => {
      const validator = new MembershipValidator(membershipConfig);
      const user = createUser('basic', null);

      const result = validator.validate(user, 'premium');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Insufficient membership tier');
      expect(result.currentTier).toBe('basic');
      expect(result.requiredTier).toBe('premium');
      expect(result.isExpired).toBe(false);
    });

    it('should fail validation when user has no membership', () => {
      const validator = new MembershipValidator(membershipConfig);
      const user = createUser(null, null);

      const result = validator.validate(user, 'premium');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('No active membership');
      expect(result.currentTier).toBe(null);
      expect(result.requiredTier).toBe('premium');
      expect(result.isExpired).toBe(false);
    });

    it('should pass validation when no membership is required', () => {
      const validator = new MembershipValidator(membershipConfig);
      const user = createUser(null, null);

      const result = validator.validate(user, null);

      expect(result.valid).toBe(true);
      expect(result.currentTier).toBe(null);
      expect(result.requiredTier).toBe(null);
      expect(result.isExpired).toBe(false);
    });

    it('should pass validation when user has membership and none is required', () => {
      const validator = new MembershipValidator(membershipConfig);
      const user = createUser('premium', null);

      const result = validator.validate(user, null);

      expect(result.valid).toBe(true);
      expect(result.currentTier).toBe('premium');
      expect(result.requiredTier).toBe(null);
      expect(result.isExpired).toBe(false);
    });

    it('should fail validation when membership is expired', () => {
      const validator = new MembershipValidator(membershipConfig);
      const pastDate = new Date('2020-01-01');
      const user = createUser('premium', pastDate);

      const result = validator.validate(user, 'premium');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Membership expired');
      expect(result.currentTier).toBe(null);
      expect(result.requiredTier).toBe('premium');
      expect(result.isExpired).toBe(true);
    });

    it('should treat expired membership as no membership', () => {
      const validator = new MembershipValidator(membershipConfig);
      const pastDate = new Date('2020-01-01');
      const user = createUser('enterprise', pastDate);

      const result = validator.validate(user, 'basic');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Membership expired');
      expect(result.currentTier).toBe(null);
      expect(result.isExpired).toBe(true);
    });

    it('should pass validation when membership has not expired', () => {
      const validator = new MembershipValidator(membershipConfig);
      const futureDate = new Date('2030-12-31');
      const user = createUser('premium', futureDate);

      const result = validator.validate(user, 'premium');

      expect(result.valid).toBe(true);
      expect(result.currentTier).toBe('premium');
      expect(result.isExpired).toBe(false);
    });

    it('should fail validation when required tier is not in configuration', () => {
      const validator = new MembershipValidator(membershipConfig);
      const user = createUser('premium', null);

      const result = validator.validate(user, 'unknown-tier');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Required tier 'unknown-tier' not defined in configuration");
      expect(result.currentTier).toBe('premium');
      expect(result.requiredTier).toBe('unknown-tier');
    });

    it('should fail validation when current tier is not in configuration', () => {
      const validator = new MembershipValidator(membershipConfig);
      const user = createUser('unknown-tier', null);

      const result = validator.validate(user, 'premium');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Current tier 'unknown-tier' not defined in configuration");
      expect(result.currentTier).toBe('unknown-tier');
      expect(result.requiredTier).toBe('premium');
    });

    it('should validate tier hierarchy correctly', () => {
      const validator = new MembershipValidator(membershipConfig);

      // free (0) < basic (1)
      const freeUser = createUser('free', null);
      expect(validator.validate(freeUser, 'basic').valid).toBe(false);

      // basic (1) < premium (2)
      const basicUser = createUser('basic', null);
      expect(validator.validate(basicUser, 'premium').valid).toBe(false);

      // premium (2) < enterprise (3)
      const premiumUser = createUser('premium', null);
      expect(validator.validate(premiumUser, 'enterprise').valid).toBe(false);

      // enterprise (3) >= all others
      const enterpriseUser = createUser('enterprise', null);
      expect(validator.validate(enterpriseUser, 'free').valid).toBe(true);
      expect(validator.validate(enterpriseUser, 'basic').valid).toBe(true);
      expect(validator.validate(enterpriseUser, 'premium').valid).toBe(true);
      expect(validator.validate(enterpriseUser, 'enterprise').valid).toBe(true);
    });

    it('should handle edge case: expired membership with null required tier', () => {
      const validator = new MembershipValidator(membershipConfig);
      const pastDate = new Date('2020-01-01');
      const user = createUser('premium', pastDate);

      const result = validator.validate(user, null);

      expect(result.valid).toBe(true);
      expect(result.currentTier).toBe(null);
      expect(result.requiredTier).toBe(null);
      expect(result.isExpired).toBe(true);
    });
  });

  describe('isExpired', () => {
    it('should return false when expiresAt is null', () => {
      const validator = new MembershipValidator(membershipConfig);

      expect(validator.isExpired(null)).toBe(false);
    });

    it('should return true when expiresAt is in the past', () => {
      const validator = new MembershipValidator(membershipConfig);
      const pastDate = new Date('2020-01-01');

      expect(validator.isExpired(pastDate)).toBe(true);
    });

    it('should return false when expiresAt is in the future', () => {
      const validator = new MembershipValidator(membershipConfig);
      const futureDate = new Date('2030-12-31');

      expect(validator.isExpired(futureDate)).toBe(false);
    });

    it('should return true when expiresAt is exactly now (edge case)', () => {
      const validator = new MembershipValidator(membershipConfig);
      // Create a date slightly in the past to ensure it's expired
      const now = new Date(Date.now() - 1000);

      expect(validator.isExpired(now)).toBe(true);
    });

    it('should handle dates very close to current time', () => {
      const validator = new MembershipValidator(membershipConfig);
      
      // 1 second in the past
      const justPast = new Date(Date.now() - 1000);
      expect(validator.isExpired(justPast)).toBe(true);

      // 1 second in the future
      const justFuture = new Date(Date.now() + 1000);
      expect(validator.isExpired(justFuture)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty tier hierarchy', () => {
      const emptyConfig: MembershipConfig = {
        tiers: {},
        requirements: {},
      };
      const validator = new MembershipValidator(emptyConfig);
      const user = createUser('premium', null);

      const result = validator.validate(user, 'premium');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not defined in configuration');
    });

    it('should handle tier with level 0', () => {
      const validator = new MembershipValidator(membershipConfig);
      const freeUser = createUser('free', null);

      // free tier (level 0) should be valid for operations requiring free
      const result = validator.validate(freeUser, 'free');
      expect(result.valid).toBe(true);
    });

    it('should handle multiple validations on same user', () => {
      const validator = new MembershipValidator(membershipConfig);
      const user = createUser('premium', null);

      // Multiple validations should be consistent
      const result1 = validator.validate(user, 'basic');
      const result2 = validator.validate(user, 'basic');
      const result3 = validator.validate(user, 'enterprise');

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
      expect(result3.valid).toBe(false);
    });

    it('should not mutate user object during validation', () => {
      const validator = new MembershipValidator(membershipConfig);
      const user = createUser('premium', null);
      const originalTier = user.membershipTier;
      const originalExpiry = user.membershipExpiresAt;

      validator.validate(user, 'basic');

      expect(user.membershipTier).toBe(originalTier);
      expect(user.membershipExpiresAt).toBe(originalExpiry);
    });
  });
});

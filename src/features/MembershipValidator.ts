/**
 * MembershipValidator - 会员验证模块
 * 验证用户会员等级和过期状态
 */

import { User, MembershipConfig } from '../core/types';

/**
 * 验证结果类型
 * 包含验证是否通过以及失败原因
 */
export interface ValidationResult {
  /** 验证是否通过 */
  valid: boolean;
  /** 失败原因 (仅在验证失败时) */
  reason?: string;
  /** 用户当前等级 */
  currentTier: string | null;
  /** 所需等级 */
  requiredTier: string | null;
  /** 会员是否已过期 */
  isExpired: boolean;
}

/**
 * 会员验证器类
 * 负责验证用户会员资格和权限
 * 
 * @example
 * ```typescript
 * const membershipConfig = {
 *   tiers: {
 *     free: 0,
 *     basic: 1,
 *     premium: 2,
 *     enterprise: 3
 *   },
 *   requirements: {
 *     'generate-post': 'basic',
 *     'generate-image': 'premium'
 *   }
 * };
 * 
 * const validator = new MembershipValidator(membershipConfig);
 * const result = validator.validate(user, 'premium');
 * if (!result.valid) {
 *   console.log(result.reason);
 * }
 * ```
 */
export class MembershipValidator {
  /**
   * 创建一个新的 MembershipValidator 实例
   * @param membershipConfig - 会员配置对象
   */
  constructor(private membershipConfig: MembershipConfig) {}

  /**
   * 验证用户会员资格
   * 
   * 验证逻辑：
   * 1. 检查会员是否过期
   * 2. 如果过期，将用户视为无会员
   * 3. 如果不需要会员（requiredTier 为 null），验证通过
   * 4. 比较用户等级和所需等级的层次结构
   * 
   * @param user - 用户对象
   * @param requiredTier - 所需会员等级 (null 表示不需要会员)
   * @returns 验证结果
   * 
   * @example
   * ```typescript
   * // 验证通过
   * const result1 = validator.validate(premiumUser, 'basic');
   * // { valid: true, currentTier: 'premium', requiredTier: 'basic', isExpired: false }
   * 
   * // 验证失败 - 等级不足
   * const result2 = validator.validate(basicUser, 'premium');
   * // { valid: false, reason: 'Insufficient membership tier', currentTier: 'basic', requiredTier: 'premium', isExpired: false }
   * 
   * // 验证失败 - 会员过期
   * const result3 = validator.validate(expiredUser, 'premium');
   * // { valid: false, reason: 'Membership expired', currentTier: null, requiredTier: 'premium', isExpired: true }
   * ```
   */
  validate(user: User, requiredTier: string | null): ValidationResult {
    // 检查会员是否过期
    const expired = this.isExpired(user.membershipExpiresAt);
    
    // 确定用户的有效会员等级（过期则视为无会员）
    const effectiveTier = expired ? null : user.membershipTier;

    // 如果不需要会员，验证通过
    if (requiredTier === null) {
      return {
        valid: true,
        currentTier: effectiveTier,
        requiredTier: null,
        isExpired: expired
      };
    }

    // 如果会员已过期
    if (expired && user.membershipTier !== null) {
      return {
        valid: false,
        reason: 'Membership expired',
        currentTier: null,
        requiredTier,
        isExpired: true
      };
    }

    // 如果用户没有会员
    if (effectiveTier === null) {
      return {
        valid: false,
        reason: 'No active membership',
        currentTier: null,
        requiredTier,
        isExpired: expired
      };
    }

    // 比较等级层次
    const currentLevel = this.membershipConfig.tiers[effectiveTier];
    const requiredLevel = this.membershipConfig.tiers[requiredTier];

    // 如果所需等级未在配置中定义
    if (requiredLevel === undefined) {
      return {
        valid: false,
        reason: `Required tier '${requiredTier}' not defined in configuration`,
        currentTier: effectiveTier,
        requiredTier,
        isExpired: expired
      };
    }

    // 如果当前等级未在配置中定义
    if (currentLevel === undefined) {
      return {
        valid: false,
        reason: `Current tier '${effectiveTier}' not defined in configuration`,
        currentTier: effectiveTier,
        requiredTier,
        isExpired: expired
      };
    }

    // 检查等级是否足够
    if (currentLevel < requiredLevel) {
      return {
        valid: false,
        reason: 'Insufficient membership tier',
        currentTier: effectiveTier,
        requiredTier,
        isExpired: expired
      };
    }

    // 验证通过
    return {
      valid: true,
      currentTier: effectiveTier,
      requiredTier,
      isExpired: expired
    };
  }

  /**
   * 检查会员是否过期
   * 
   * @param expiresAt - 过期时间 (null 表示永久会员或无会员)
   * @returns 是否过期
   * 
   * @example
   * ```typescript
   * // 已过期
   * validator.isExpired(new Date('2020-01-01')); // true
   * 
   * // 未过期
   * validator.isExpired(new Date('2030-01-01')); // false
   * 
   * // 永久会员或无会员
   * validator.isExpired(null); // false
   * ```
   */
  isExpired(expiresAt: Date | null): boolean {
    // null 表示永久会员或无会员，不算过期
    if (expiresAt === null) {
      return false;
    }

    // 比较当前时间和过期时间
    return new Date() > expiresAt;
  }
}

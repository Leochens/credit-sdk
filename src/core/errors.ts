/**
 * 错误类定义
 * 定义 SDK 中使用的所有错误类型
 */

/**
 * SDK 基础错误类
 * 所有 SDK 特定错误的基类
 */
export class CreditsSDKError extends Error {
  /**
   * 创建一个新的 CreditsSDKError
   * @param message - 错误消息
   * @param code - 错误代码
   */
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'CreditsSDKError';
    // 确保原型链正确设置 (TypeScript 继承 Error 的已知问题)
    Object.setPrototypeOf(this, CreditsSDKError.prototype);
  }
}

/**
 * 余额不足错误
 * 当用户积分不足以执行操作时抛出
 * 
 * @example
 * ```typescript
 * throw new InsufficientCreditsError('user123', 100, 50);
 * // Error: User user123 has insufficient credits. Required: 100, Available: 50
 * ```
 */
export class InsufficientCreditsError extends CreditsSDKError {
  /**
   * 创建一个新的 InsufficientCreditsError
   * @param userId - 用户 ID
   * @param required - 所需积分数量
   * @param available - 当前可用积分数量
   */
  constructor(
    public userId: string,
    public required: number,
    public available: number
  ) {
    super(
      `User ${userId} has insufficient credits. Required: ${required}, Available: ${available}`,
      'INSUFFICIENT_CREDITS'
    );
    this.name = 'InsufficientCreditsError';
    Object.setPrototypeOf(this, InsufficientCreditsError.prototype);
  }
}

/**
 * 用户不存在错误
 * 当尝试操作不存在的用户时抛出
 * 
 * @example
 * ```typescript
 * throw new UserNotFoundError('user123');
 * // Error: User user123 not found
 * ```
 */
export class UserNotFoundError extends CreditsSDKError {
  /**
   * 创建一个新的 UserNotFoundError
   * @param userId - 用户 ID
   */
  constructor(public userId: string) {
    super(`User ${userId} not found`, 'USER_NOT_FOUND');
    this.name = 'UserNotFoundError';
    Object.setPrototypeOf(this, UserNotFoundError.prototype);
  }
}

/**
 * 会员权限不足错误
 * 当用户缺少操作所需的会员资格时抛出
 * 
 * @example
 * ```typescript
 * throw new MembershipRequiredError('user123', 'premium', 'basic');
 * // Error: User user123 requires premium membership, but has basic
 * ```
 */
export class MembershipRequiredError extends CreditsSDKError {
  /**
   * 创建一个新的 MembershipRequiredError
   * @param userId - 用户 ID
   * @param required - 所需会员等级
   * @param current - 当前会员等级 (null 表示无会员)
   */
  constructor(
    public userId: string,
    public required: string,
    public current: string | null
  ) {
    super(
      `User ${userId} requires ${required} membership, but has ${current || 'none'}`,
      'MEMBERSHIP_REQUIRED'
    );
    this.name = 'MembershipRequiredError';
    Object.setPrototypeOf(this, MembershipRequiredError.prototype);
  }
}

/**
 * 幂等键冲突错误
 * 当检测到幂等键冲突时抛出
 * 
 * 注意: 根据设计文档，在正常流程中不应该抛出此错误，
 * 而是应该返回缓存的结果。此错误主要用于异常情况。
 * 
 * @example
 * ```typescript
 * throw new IdempotencyKeyConflictError('key123', existingTransaction);
 * // Error: Idempotency key key123 already exists
 * ```
 */
export class IdempotencyKeyConflictError extends CreditsSDKError {
  /**
   * 创建一个新的 IdempotencyKeyConflictError
   * @param key - 幂等键
   * @param existingTransaction - 已存在的交易详情
   */
  constructor(
    public key: string,
    public existingTransaction: any
  ) {
    super(
      `Idempotency key ${key} already exists`,
      'IDEMPOTENCY_KEY_CONFLICT'
    );
    this.name = 'IdempotencyKeyConflictError';
    Object.setPrototypeOf(this, IdempotencyKeyConflictError.prototype);
  }
}

/**
 * 配置错误
 * 当 SDK 配置无效或缺失时抛出
 * 
 * @example
 * ```typescript
 * throw new ConfigurationError('Cost configuration is missing for action: generate-post');
 * // Error: Cost configuration is missing for action: generate-post
 * ```
 */
export class ConfigurationError extends CreditsSDKError {
  /**
   * 创建一个新的 ConfigurationError
   * @param message - 错误消息
   */
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR');
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * 操作未定义错误
 * 当尝试执行未在配置中定义成本的操作时抛出
 * 
 * @example
 * ```typescript
 * throw new UndefinedActionError('unknown-action');
 * // Error: Action unknown-action has no defined cost
 * ```
 */
export class UndefinedActionError extends CreditsSDKError {
  /**
   * 创建一个新的 UndefinedActionError
   * @param action - 操作名称
   */
  constructor(public action: string) {
    super(`Action ${action} has no defined cost`, 'UNDEFINED_ACTION');
    this.name = 'UndefinedActionError';
    Object.setPrototypeOf(this, UndefinedActionError.prototype);
  }
}

/**
 * 无效等级变更错误
 * 当尝试进行无效的等级变更时抛出
 * 
 * @example
 * ```typescript
 * throw new InvalidTierChangeError('user123', 'pro', 'premium', 'Target tier must be higher than current tier for upgrade');
 * // Error: Invalid tier change for user user123: Target tier must be higher than current tier for upgrade. Current tier: pro, Target tier: premium
 * ```
 */
export class InvalidTierChangeError extends CreditsSDKError {
  /**
   * 创建一个新的 InvalidTierChangeError
   * @param userId - 用户 ID
   * @param currentTier - 当前会员等级 (null 表示无会员)
   * @param targetTier - 目标会员等级
   * @param reason - 错误原因
   */
  constructor(
    public userId: string,
    public currentTier: string | null,
    public targetTier: string,
    public reason: string
  ) {
    super(
      `Invalid tier change for user ${userId}: ${reason}. ` +
      `Current tier: ${currentTier || 'none'}, Target tier: ${targetTier}`,
      'INVALID_TIER_CHANGE'
    );
    this.name = 'InvalidTierChangeError';
    Object.setPrototypeOf(this, InvalidTierChangeError.prototype);
  }
}

/**
 * 未定义等级错误
 * 当等级未在配置中定义时抛出
 * 
 * @example
 * ```typescript
 * throw new UndefinedTierError('platinum');
 * // Error: Tier 'platinum' is not defined in configuration
 * ```
 */
export class UndefinedTierError extends CreditsSDKError {
  /**
   * 创建一个新的 UndefinedTierError
   * @param tier - 等级名称
   */
  constructor(public tier: string) {
    super(`Tier '${tier}' is not defined in configuration`, 'UNDEFINED_TIER');
    this.name = 'UndefinedTierError';
    Object.setPrototypeOf(this, UndefinedTierError.prototype);
  }
}

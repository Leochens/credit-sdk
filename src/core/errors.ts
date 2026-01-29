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

/**
 * 缺少变量错误
 * 当公式计算时缺少必需的变量时抛出
 * 
 * ## 使用场景
 * 
 * 当使用动态成本公式时，如果公式需要某个变量但在计算时未提供该变量，
 * 系统会抛出此错误。这有助于开发者快速定位问题。
 * 
 * ## 错误信息
 * 
 * 错误消息包含以下信息：
 * - 完整的公式字符串
 * - 缺少的变量名
 * - 已提供的变量列表
 * 
 * ## 示例
 * 
 * ### 基础示例
 * ```typescript
 * const formula = new DynamicCostFormula({
 *   'ai-completion': {
 *     default: '{token} * 0.001 + 10'
 *   }
 * });
 * 
 * try {
 *   // 忘记提供 token 变量
 *   formula.calculate('ai-completion', null, {});
 * } catch (error) {
 *   if (error instanceof MissingVariableError) {
 *     console.error(error.message);
 *     // "Formula '{token} * 0.001 + 10' requires variable 'token', but only [] were provided"
 *     
 *     console.log(error.formula); // '{token} * 0.001 + 10'
 *     console.log(error.missingVariable); // 'token'
 *     console.log(error.providedVariables); // []
 *     console.log(error.code); // 'MISSING_VARIABLE'
 *   }
 * }
 * ```
 * 
 * ### 多变量场景
 * ```typescript
 * const formula = new DynamicCostFormula({
 *   'video-processing': {
 *     default: '{duration} * 2 + {resolution} * 0.5'
 *   }
 * });
 * 
 * try {
 *   // 只提供了 duration，缺少 resolution
 *   formula.calculate('video-processing', null, { duration: 120 });
 * } catch (error) {
 *   if (error instanceof MissingVariableError) {
 *     console.error(error.message);
 *     // "Formula '{duration} * 2 + {resolution} * 0.5' requires variable 'resolution', 
 *     //  but only [duration] were provided"
 *     
 *     console.log(error.missingVariable); // 'resolution'
 *     console.log(error.providedVariables); // ['duration']
 *   }
 * }
 * ```
 * 
 * ## 如何避免
 * 
 * 1. **确保提供所有必需变量**：
 * ```typescript
 * // ✅ 正确：提供所有变量
 * formula.calculate('ai-completion', null, { token: 3500 });
 * ```
 * 
 * 2. **使用 extractVariables 检查需要哪些变量**：
 * ```typescript
 * const parser = new FormulaParser();
 * const variables = parser.extractVariables('{token} * 0.001 + 10');
 * console.log(variables); // ['token']
 * 
 * // 确保提供所有变量
 * const variableValues = { token: 3500 };
 * formula.calculate('ai-completion', null, variableValues);
 * ```
 * 
 * 3. **配置回退值**：
 * ```typescript
 * const config: DynamicCostConfig = {
 *   'ai-completion': {
 *     default: 10,  // 固定回退值
 *     premium: '{token} * 0.0008 + 8'
 *   }
 * };
 * 
 * // 如果未提供 variables，会使用 default 值 10
 * formula.calculate('ai-completion', 'premium'); // 返回 10
 * ```
 * 
 * @see {@link FormulaParser} 公式解析器
 * @see {@link DynamicCostFormula} 动态成本计算类
 * @see {@link FormulaEvaluationError} 公式计算错误
 */
export class MissingVariableError extends CreditsSDKError {
  /**
   * 创建一个新的 MissingVariableError
   * @param formula - 公式字符串
   * @param missingVariable - 缺少的变量名
   * @param providedVariables - 已提供的变量名列表
   */
  constructor(
    public formula: string,
    public missingVariable: string,
    public providedVariables: string[]
  ) {
    super(
      `Formula '${formula}' requires variable '${missingVariable}', but only [${providedVariables.join(', ')}] were provided`,
      'MISSING_VARIABLE'
    );
    this.name = 'MissingVariableError';
    Object.setPrototypeOf(this, MissingVariableError.prototype);
  }
}

/**
 * 公式计算错误
 * 当公式计算过程中发生错误时抛出（如除零、无效运算等）
 * 
 * ## 使用场景
 * 
 * 此错误在以下情况下抛出：
 * - **除零错误**：公式中的除法运算导致除以零
 * - **无效结果**：计算结果为 NaN（非数字）
 * - **无穷大**：计算结果为 Infinity 或 -Infinity
 * - **其他运算错误**：JavaScript 表达式执行失败
 * 
 * ## 错误信息
 * 
 * 错误消息包含以下信息：
 * - 完整的公式字符串
 * - 提供的所有变量及其值
 * - 具体的错误原因
 * 
 * ## 示例
 * 
 * ### 除零错误
 * ```typescript
 * const formula = new DynamicCostFormula({
 *   'data-processing': {
 *     default: '{amount} / {count}'
 *   }
 * });
 * 
 * try {
 *   // count 为 0，导致除零
 *   formula.calculate('data-processing', null, { amount: 100, count: 0 });
 * } catch (error) {
 *   if (error instanceof FormulaEvaluationError) {
 *     console.error(error.message);
 *     // "Failed to evaluate formula '{amount} / {count}' with variables 
 *     //  {"amount":100,"count":0}: Formula evaluation resulted in Infinity 
 *     //  (possible division by zero)"
 *     
 *     console.log(error.formula); // '{amount} / {count}'
 *     console.log(error.variables); // { amount: 100, count: 0 }
 *     console.log(error.cause); // 'Formula evaluation resulted in Infinity...'
 *     console.log(error.code); // 'FORMULA_EVALUATION_ERROR'
 *   }
 * }
 * ```
 * 
 * ### NaN 结果
 * ```typescript
 * const parser = new FormulaParser();
 * 
 * try {
 *   // 某些运算可能导致 NaN
 *   parser.evaluate('{value} * {multiplier}', { value: NaN, multiplier: 2 });
 * } catch (error) {
 *   if (error instanceof FormulaEvaluationError) {
 *     console.error(error.message);
 *     // "Failed to evaluate formula... Formula evaluation resulted in NaN"
 *     
 *     console.log(error.cause); // 'Formula evaluation resulted in NaN'
 *   }
 * }
 * ```
 * 
 * ### 无效变量值
 * ```typescript
 * const parser = new FormulaParser();
 * 
 * try {
 *   // 变量值不是有效数字
 *   parser.evaluate('{token} * 0.001', { token: 'invalid' as any });
 * } catch (error) {
 *   if (error instanceof FormulaEvaluationError) {
 *     console.error(error.message);
 *     // "Failed to evaluate formula... Variable 'token' has invalid value: invalid"
 *     
 *     console.log(error.cause); // "Variable 'token' has invalid value: invalid"
 *   }
 * }
 * ```
 * 
 * ## 如何避免
 * 
 * ### 1. 验证变量值
 * ```typescript
 * function safeCalculate(
 *   formula: DynamicCostFormula,
 *   action: string,
 *   variables: Record<string, number>
 * ): number {
 *   // 验证所有变量值都是有效数字
 *   for (const [key, value] of Object.entries(variables)) {
 *     if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
 *       throw new Error(`Invalid variable value for ${key}: ${value}`);
 *     }
 *   }
 *   
 *   return formula.calculate(action, null, variables);
 * }
 * ```
 * 
 * ### 2. 防止除零
 * ```typescript
 * // ❌ 不安全：可能除零
 * const config1: DynamicCostConfig = {
 *   'data-processing': {
 *     default: '{amount} / {count}'
 *   }
 * };
 * 
 * // ✅ 安全：使用条件表达式防止除零
 * const config2: DynamicCostConfig = {
 *   'data-processing': {
 *     default: '{count} > 0 ? {amount} / {count} : 0'
 *   }
 * };
 * ```
 * 
 * ### 3. 使用 try-catch 处理错误
 * ```typescript
 * async function chargeWithErrorHandling(
 *   engine: CreditsEngine,
 *   userId: string,
 *   action: string,
 *   variables: Record<string, number>
 * ) {
 *   try {
 *     return await engine.charge({ userId, action, variables });
 *   } catch (error) {
 *     if (error instanceof FormulaEvaluationError) {
 *       // 记录错误到日志系统
 *       console.error('Formula evaluation failed:', {
 *         formula: error.formula,
 *         variables: error.variables,
 *         cause: error.cause
 *       });
 *       
 *       // 使用回退值或重新抛出错误
 *       throw new Error('Unable to calculate cost. Please contact support.');
 *     }
 *     throw error;
 *   }
 * }
 * ```
 * 
 * ### 4. 测试公式
 * ```typescript
 * // 在部署前测试公式的各种边界情况
 * function testFormula(formula: string, testCases: Array<Record<string, number>>) {
 *   const parser = new FormulaParser();
 *   
 *   for (const variables of testCases) {
 *     try {
 *       const result = parser.evaluate(formula, variables);
 *       console.log(`✅ ${JSON.stringify(variables)} => ${result}`);
 *     } catch (error) {
 *       console.error(`❌ ${JSON.stringify(variables)} => ${error.message}`);
 *     }
 *   }
 * }
 * 
 * // 测试除法公式
 * testFormula('{amount} / {count}', [
 *   { amount: 100, count: 10 },  // ✅ 正常
 *   { amount: 100, count: 0 },   // ❌ 除零
 *   { amount: 100, count: -5 }   // ✅ 负数除法
 * ]);
 * ```
 * 
 * ## 审计日志
 * 
 * 当此错误发生时，CreditsEngine 会自动记录到审计日志：
 * ```typescript
 * {
 *   type: 'formula_evaluation_error',
 *   userId: 'user-123',
 *   action: 'data-processing',
 *   formula: '{amount} / {count}',
 *   variables: { amount: 100, count: 0 },
 *   error: 'Formula evaluation resulted in Infinity (possible division by zero)',
 *   timestamp: '2024-01-15T10:30:00Z'
 * }
 * ```
 * 
 * @see {@link FormulaParser} 公式解析器
 * @see {@link DynamicCostFormula} 动态成本计算类
 * @see {@link MissingVariableError} 缺少变量错误
 */
export class FormulaEvaluationError extends CreditsSDKError {
  /**
   * 创建一个新的 FormulaEvaluationError
   * @param formula - 公式字符串
   * @param variables - 变量值映射
   * @param cause - 错误原因
   */
  constructor(
    public formula: string,
    public variables: Record<string, number>,
    public cause: string
  ) {
    super(
      `Failed to evaluate formula '${formula}' with variables ${JSON.stringify(variables)}: ${cause}`,
      'FORMULA_EVALUATION_ERROR'
    );
    this.name = 'FormulaEvaluationError';
    Object.setPrototypeOf(this, FormulaEvaluationError.prototype);
  }
}

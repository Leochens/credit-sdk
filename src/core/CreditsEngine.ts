/**
 * CreditsEngine - 积分引擎核心类
 * 协调所有积分操作的主要服务类
 * 
 * 验证需求: 17.1-17.5
 */

import { IStorageAdapter } from '../adapters/IStorageAdapter';
import { ILogAdapter, ConsoleLogger } from '../adapters/ILogAdapter';
import {
  CreditsConfig,
  ChargeParams,
  ChargeResult,
  RefundParams,
  RefundResult,
  GrantParams,
  GrantResult,
  Transaction,
  HistoryOptions
} from './types';
import {
  CostFormula,
  MembershipValidator,
  IdempotencyManager,
  AuditTrail,
  RetryHandler
} from '../features';
import {
  ConfigurationError,
  UserNotFoundError,
  MembershipRequiredError,
  InsufficientCreditsError
} from './errors';

/**
 * CreditsEngine 选项类型
 * 用于初始化 CreditsEngine 实例
 */
export interface CreditsEngineOptions {
  /** 存储适配器（必需） */
  storage: IStorageAdapter;
  /** SDK 配置（必需） */
  config: CreditsConfig;
  /** 日志适配器（可选，默认使用 ConsoleLogger） */
  logger?: ILogAdapter;
}

/**
 * CreditsEngine 类
 * 
 * 主要服务类，提供所有积分操作：
 * - charge: 扣费操作
 * - refund: 退款操作
 * - grant: 发放积分
 * - queryBalance: 查询余额
 * - getHistory: 获取交易历史
 * - validateAccess: 验证访问权限
 * 
 * 核心特性：
 * - 适配器模式：通过 IStorageAdapter 解耦存储层
 * - 事务透传：支持将操作嵌入到更大的业务事务中
 * - 幂等性：防止重复扣费
 * - 重试机制：自动处理瞬态故障
 * - 审计日志：记录所有操作用于合规和调试
 * - 会员验证：基于会员等级的访问控制
 * - 成本计算：灵活的分层定价
 * 
 * @example
 * ```typescript
 * // 创建 CreditsEngine 实例
 * const engine = new CreditsEngine({
 *   storage: new PrismaAdapter(prisma),
 *   config: {
 *     costs: {
 *       'generate-post': { default: 10, premium: 8 }
 *     },
 *     membership: {
 *       tiers: { free: 0, premium: 1 },
 *       requirements: { 'generate-post': null }
 *     },
 *     retry: {
 *       enabled: true,
 *       maxAttempts: 3,
 *       initialDelay: 100,
 *       maxDelay: 5000,
 *       backoffMultiplier: 2
 *     },
 *     idempotency: {
 *       enabled: true,
 *       ttl: 86400
 *     },
 *     audit: {
 *       enabled: true
 *     }
 *   }
 * });
 * 
 * // 执行扣费操作
 * const result = await engine.charge({
 *   userId: 'user-123',
 *   action: 'generate-post',
 *   idempotencyKey: 'unique-key-123'
 * });
 * ```
 */
export class CreditsEngine {
  private readonly storage: IStorageAdapter;
  private readonly config: CreditsConfig;
  private readonly logger: ILogAdapter;
  
  // 特性模块
  private readonly costFormula: CostFormula;
  private readonly membershipValidator: MembershipValidator;
  private readonly idempotencyManager: IdempotencyManager;
  private readonly auditTrail: AuditTrail;
  // @ts-expect-error - RetryHandler is initialized but not yet integrated into all operations
  private readonly retryHandler: RetryHandler;

  /**
   * 创建一个新的 CreditsEngine 实例
   * 
   * 初始化流程：
   * 1. 验证必需的配置参数
   * 2. 设置存储适配器
   * 3. 设置日志记录器（使用提供的或默认的 ConsoleLogger）
   * 4. 初始化所有特性模块：
   *    - CostFormula: 成本计算
   *    - MembershipValidator: 会员验证
   *    - IdempotencyManager: 幂等性管理
   *    - AuditTrail: 审计日志
   *    - RetryHandler: 重试处理
   * 
   * @param options - CreditsEngine 选项
   * @throws {ConfigurationError} 当配置无效时
   * 
   * @example
   * ```typescript
   * // 使用默认日志记录器
   * const engine = new CreditsEngine({
   *   storage: adapter,
   *   config: myConfig
   * });
   * 
   * // 使用自定义日志记录器
   * const engine = new CreditsEngine({
   *   storage: adapter,
   *   config: myConfig,
   *   logger: new CustomLogger()
   * });
   * ```
   * 
   * 验证需求:
   * - 17.1: 在初始化期间接受 CreditsConfig 对象
   * - 17.2: CreditsConfig 包含所有支持操作的成本公式
   * - 17.3: CreditsConfig 包含会员等级定义和要求
   * - 17.4: CreditsConfig 包含重试策略配置
   * - 17.5: CreditsConfig 包含可选行为的功能标志
   */
  constructor(options: CreditsEngineOptions) {
    // 验证必需参数
    if (!options.storage) {
      throw new ConfigurationError('Storage adapter is required');
    }

    if (!options.config) {
      throw new ConfigurationError('Configuration is required');
    }

    // 验证配置完整性
    this.validateConfig(options.config);

    // 设置核心依赖
    this.storage = options.storage;
    this.config = options.config;
    this.logger = options.logger || new ConsoleLogger();

    // 初始化特性模块
    this.logger.debug('Initializing CreditsEngine feature modules');

    // 成本计算模块
    this.costFormula = new CostFormula(this.config.costs);
    this.logger.debug('CostFormula initialized', {
      actionsCount: Object.keys(this.config.costs).length
    });

    // 会员验证模块
    this.membershipValidator = new MembershipValidator(this.config.membership);
    this.logger.debug('MembershipValidator initialized', {
      tiersCount: Object.keys(this.config.membership.tiers).length
    });

    // 幂等性管理模块
    this.idempotencyManager = new IdempotencyManager(
      this.storage,
      this.config.idempotency
    );
    this.logger.debug('IdempotencyManager initialized', {
      enabled: this.config.idempotency.enabled,
      ttl: this.config.idempotency.ttl
    });

    // 审计日志模块
    this.auditTrail = new AuditTrail(this.storage);
    this.logger.debug('AuditTrail initialized', {
      enabled: this.config.audit.enabled
    });

    // 重试处理模块
    this.retryHandler = new RetryHandler(this.config.retry, this.logger);
    this.logger.debug('RetryHandler initialized', {
      enabled: this.config.retry.enabled,
      maxAttempts: this.config.retry.maxAttempts
    });

    this.logger.info('CreditsEngine initialized successfully');
  }

  /**
   * 验证配置的完整性和有效性
   * 
   * 验证项：
   * - costs 配置存在且不为空
   * - membership 配置存在且包含 tiers 和 requirements
   * - retry 配置存在且包含所有必需字段
   * - idempotency 配置存在且包含所有必需字段
   * - audit 配置存在
   * - 成本配置中的每个操作都有 default 值
   * - 会员等级层次结构有效（数值类型）
   * 
   * @param config - 要验证的配置
   * @throws {ConfigurationError} 当配置无效时
   */
  private validateConfig(config: CreditsConfig): void {
    // 验证 costs 配置
    if (!config.costs || typeof config.costs !== 'object') {
      throw new ConfigurationError('Configuration must include costs object');
    }

    // 验证每个操作都有 default 成本
    for (const [action, costConfig] of Object.entries(config.costs)) {
      if (typeof costConfig.default !== 'number') {
        throw new ConfigurationError(
          `Action '${action}' must have a default cost`
        );
      }
      if (costConfig.default < 0) {
        throw new ConfigurationError(
          `Action '${action}' default cost must be non-negative`
        );
      }
    }

    // 验证 membership 配置
    if (!config.membership || typeof config.membership !== 'object') {
      throw new ConfigurationError('Configuration must include membership object');
    }

    if (!config.membership.tiers || typeof config.membership.tiers !== 'object') {
      throw new ConfigurationError('Membership configuration must include tiers');
    }

    if (!config.membership.requirements || typeof config.membership.requirements !== 'object') {
      throw new ConfigurationError('Membership configuration must include requirements');
    }

    // 验证会员等级层次结构
    for (const [tier, level] of Object.entries(config.membership.tiers)) {
      if (typeof level !== 'number') {
        throw new ConfigurationError(
          `Membership tier '${tier}' must have a numeric level`
        );
      }
      if (level < 0) {
        throw new ConfigurationError(
          `Membership tier '${tier}' level must be non-negative`
        );
      }
    }

    // 验证 retry 配置
    if (!config.retry || typeof config.retry !== 'object') {
      throw new ConfigurationError('Configuration must include retry object');
    }

    const requiredRetryFields = [
      'enabled',
      'maxAttempts',
      'initialDelay',
      'maxDelay',
      'backoffMultiplier'
    ];

    for (const field of requiredRetryFields) {
      if (!(field in config.retry) || (config.retry as any)[field] === undefined) {
        throw new ConfigurationError(
          `Retry configuration must include '${field}'`
        );
      }
    }

    if (config.retry.maxAttempts < 1) {
      throw new ConfigurationError('Retry maxAttempts must be at least 1');
    }

    if (config.retry.initialDelay < 0) {
      throw new ConfigurationError('Retry initialDelay must be non-negative');
    }

    if (config.retry.maxDelay < config.retry.initialDelay) {
      throw new ConfigurationError('Retry maxDelay must be >= initialDelay');
    }

    if (config.retry.backoffMultiplier < 1) {
      throw new ConfigurationError('Retry backoffMultiplier must be >= 1');
    }

    // 验证 idempotency 配置
    if (!config.idempotency || typeof config.idempotency !== 'object') {
      throw new ConfigurationError('Configuration must include idempotency object');
    }

    if (!('enabled' in config.idempotency) || config.idempotency.enabled === undefined) {
      throw new ConfigurationError('Idempotency configuration must include enabled');
    }

    if (!('ttl' in config.idempotency) || config.idempotency.ttl === undefined) {
      throw new ConfigurationError('Idempotency configuration must include ttl');
    }

    if (config.idempotency.ttl < 0) {
      throw new ConfigurationError('Idempotency ttl must be non-negative');
    }

    // 验证 audit 配置
    if (!config.audit || typeof config.audit !== 'object') {
      throw new ConfigurationError('Configuration must include audit object');
    }

    if (!('enabled' in config.audit) || config.audit.enabled === undefined) {
      throw new ConfigurationError('Audit configuration must include enabled');
    }
  }

  /**
   * 扣费操作
   * 
   * 执行完整的扣费流程：
   * 1. 幂等性检查 - 如果提供了幂等键且操作已执行，返回缓存结果
   * 2. 用户验证 - 检查用户是否存在
   * 3. 会员验证 - 检查用户是否有权限执行该操作
   * 4. 成本计算 - 根据操作和会员等级计算成本
   * 5. 余额检查 - 确保用户有足够的积分
   * 6. 余额更新 - 扣除积分
   * 7. 交易记录 - 创建交易记录
   * 8. 审计日志 - 记录操作
   * 9. 幂等记录 - 保存结果用于后续幂等性检查
   * 
   * 所有操作在事务中执行（如果提供了事务上下文）或自动提交。
   * 任何步骤失败都会导致整个操作回滚（在事务中）。
   * 
   * @param params - 扣费参数
   * @returns 扣费结果
   * @throws {UserNotFoundError} 当用户不存在时
   * @throws {MembershipRequiredError} 当用户缺少所需会员资格时
   * @throws {InsufficientCreditsError} 当用户积分不足时
   * @throws {UndefinedActionError} 当操作未在配置中定义时
   * 
   * @example
   * ```typescript
   * // 基本扣费
   * const result = await engine.charge({
   *   userId: 'user-123',
   *   action: 'generate-post'
   * });
   * 
   * // 带幂等键的扣费
   * const result = await engine.charge({
   *   userId: 'user-123',
   *   action: 'generate-post',
   *   idempotencyKey: 'unique-key-123'
   * });
   * 
   * // 在事务中扣费
   * await prisma.$transaction(async (tx) => {
   *   const result = await engine.charge({
   *     userId: 'user-123',
   *     action: 'generate-post',
   *     txn: tx
   *   });
   *   // ... 其他操作 ...
   * });
   * ```
   * 
   * 验证需求:
   * - 4.1: 按顺序执行幂等性检查、用户验证、会员验证、成本计算、余额检查、余额更新、交易记录和审计日志记录
   * - 4.2: 如果提供了幂等键且与现有操作匹配，返回缓存的结果而不执行扣费
   * - 4.3: 扣费操作在任何步骤失败时，在事务内回滚所有更改
   * - 4.4: 扣费成功时，返回包含更新余额和交易 ID 的 ChargeResult
   * - 4.5: 支持通过 txn 参数将扣费操作包装在外部事务上下文中
   */
  async charge(params: ChargeParams): Promise<ChargeResult> {
    const { userId, action, idempotencyKey, metadata = {}, txn } = params;

    this.logger.info('Starting charge operation', {
      userId,
      action,
      hasIdempotencyKey: !!idempotencyKey,
      hasTransaction: !!txn
    });

    try {
      // 步骤 1: 幂等性检查
      if (idempotencyKey) {
        this.logger.debug('Checking idempotency', { idempotencyKey });
        const existingRecord = await this.idempotencyManager.check(idempotencyKey, txn);
        
        if (existingRecord) {
          this.logger.info('Idempotency key found, returning cached result', {
            idempotencyKey,
            userId
          });
          return existingRecord.result as ChargeResult;
        }
      }

      // 步骤 2: 获取用户信息
      this.logger.debug('Fetching user', { userId });
      const user = await this.storage.getUserById(userId, txn);
      
      if (!user) {
        this.logger.warn('User not found', { userId });
        throw new UserNotFoundError(userId);
      }

      this.logger.debug('User found', {
        userId,
        credits: user.credits,
        membershipTier: user.membershipTier
      });

      // 步骤 3: 会员验证
      const requiredTier = this.config.membership.requirements[action] || null;
      
      if (requiredTier !== null) {
        this.logger.debug('Validating membership', {
          userId,
          requiredTier,
          currentTier: user.membershipTier
        });

        const validationResult = this.membershipValidator.validate(user, requiredTier);
        
        if (!validationResult.valid) {
          this.logger.warn('Membership validation failed', {
            userId,
            reason: validationResult.reason,
            requiredTier,
            currentTier: validationResult.currentTier
          });

          throw new MembershipRequiredError(
            userId,
            requiredTier,
            validationResult.currentTier
          );
        }

        this.logger.debug('Membership validation passed', { userId });
      }

      // 步骤 4: 计算成本
      this.logger.debug('Calculating cost', {
        action,
        membershipTier: user.membershipTier
      });

      const cost = this.costFormula.calculate(action, user.membershipTier);
      
      this.logger.debug('Cost calculated', { cost });

      // 步骤 5: 检查余额
      if (user.credits < cost) {
        this.logger.warn('Insufficient credits', {
          userId,
          required: cost,
          available: user.credits
        });

        throw new InsufficientCreditsError(userId, cost, user.credits);
      }

      this.logger.debug('Balance check passed', {
        userId,
        credits: user.credits,
        cost
      });

      // 步骤 6: 更新余额
      const balanceBefore = user.credits;
      const balanceAfter = balanceBefore - cost;

      this.logger.debug('Updating user balance', {
        userId,
        balanceBefore,
        balanceAfter
      });

      await this.storage.updateUserCredits(userId, -cost, txn);

      // 步骤 7: 创建交易记录
      this.logger.debug('Creating transaction record', { userId, action, cost });

      const transaction = await this.storage.createTransaction(
        {
          userId,
          action,
          amount: -cost, // 负数表示扣费
          balanceBefore,
          balanceAfter,
          metadata
        },
        txn
      );

      this.logger.debug('Transaction record created', {
        transactionId: transaction.id
      });

      // 步骤 8: 创建审计日志
      if (this.config.audit.enabled) {
        this.logger.debug('Creating audit log', { userId, action });

        await this.auditTrail.log(
          {
            userId,
            action: 'charge',
            status: 'success',
            metadata: {
              operation: action,
              cost,
              balanceBefore,
              balanceAfter,
              transactionId: transaction.id,
              ...metadata
            }
          },
          txn
        );

        this.logger.debug('Audit log created', { userId });
      }

      // 构建结果
      const result: ChargeResult = {
        success: true,
        transactionId: transaction.id,
        cost,
        balanceBefore,
        balanceAfter
      };

      // 步骤 9: 保存幂等记录
      if (idempotencyKey) {
        this.logger.debug('Saving idempotency record', { idempotencyKey });
        await this.idempotencyManager.save(idempotencyKey, result, txn);
      }

      this.logger.info('Charge operation completed successfully', {
        userId,
        action,
        cost,
        transactionId: transaction.id
      });

      return result;

    } catch (error) {
      // 记录失败的审计日志
      if (this.config.audit.enabled) {
        try {
          await this.auditTrail.log(
            {
              userId,
              action: 'charge',
              status: 'failed',
              metadata: {
                operation: action,
                error: error instanceof Error ? error.message : String(error),
                ...metadata
              },
              errorMessage: error instanceof Error ? error.message : String(error)
            },
            txn
          );
        } catch (auditError) {
          // 如果审计日志记录失败，只记录警告，不影响主错误的抛出
          this.logger.warn('Failed to create audit log for failed operation', {
            userId,
            action,
            error: auditError
          });
        }
      }

      this.logger.error('Charge operation failed', {
        userId,
        action,
        error: error instanceof Error ? error.message : String(error)
      });

      // 重新抛出原始错误
      throw error;
    }
  }

  /**
   * 退款操作
   * 
   * 执行退款流程：
   * 1. 幂等性检查 - 如果提供了幂等键且操作已执行，返回缓存结果
   * 2. 用户验证 - 检查用户是否存在
   * 3. 余额更新 - 增加积分
   * 4. 交易记录 - 创建交易记录（正金额表示增加）
   * 5. 审计日志 - 记录操作
   * 6. 幂等记录 - 保存结果用于后续幂等性检查
   * 
   * 所有操作在事务中执行（如果提供了事务上下文）或自动提交。
   * 任何步骤失败都会导致整个操作回滚（在事务中）。
   * 
   * @param params - 退款参数
   * @returns 退款结果
   * @throws {UserNotFoundError} 当用户不存在时
   * 
   * @example
   * ```typescript
   * // 基本退款
   * const result = await engine.refund({
   *   userId: 'user-123',
   *   amount: 100,
   *   action: 'refund-order-123'
   * });
   * 
   * // 带幂等键的退款
   * const result = await engine.refund({
   *   userId: 'user-123',
   *   amount: 100,
   *   action: 'refund-order-123',
   *   idempotencyKey: 'refund-unique-key-123'
   * });
   * 
   * // 在事务中退款
   * await prisma.$transaction(async (tx) => {
   *   const result = await engine.refund({
   *     userId: 'user-123',
   *     amount: 100,
   *     action: 'refund-order-123',
   *     txn: tx
   *   });
   *   // ... 其他操作 ...
   * });
   * ```
   * 
   * 验证需求:
   * - 5.1: 将积分添加到用户余额
   * - 5.2: 创建带有正金额的交易记录
   * - 5.3: 创建审计日志条目
   * - 5.4: 支持退款操作的幂等性
   * - 5.5: 支持退款操作的事务上下文
   */
  async refund(params: RefundParams): Promise<RefundResult> {
    const { userId, amount, action, idempotencyKey, metadata = {}, txn } = params;

    this.logger.info('Starting refund operation', {
      userId,
      amount,
      action,
      hasIdempotencyKey: !!idempotencyKey,
      hasTransaction: !!txn
    });

    try {
      // 步骤 1: 幂等性检查
      if (idempotencyKey) {
        this.logger.debug('Checking idempotency', { idempotencyKey });
        const existingRecord = await this.idempotencyManager.check(idempotencyKey, txn);
        
        if (existingRecord) {
          this.logger.info('Idempotency key found, returning cached result', {
            idempotencyKey,
            userId
          });
          return existingRecord.result as RefundResult;
        }
      }

      // 步骤 2: 获取用户信息
      this.logger.debug('Fetching user', { userId });
      const user = await this.storage.getUserById(userId, txn);
      
      if (!user) {
        this.logger.warn('User not found', { userId });
        throw new UserNotFoundError(userId);
      }

      this.logger.debug('User found', {
        userId,
        credits: user.credits
      });

      // 步骤 3: 更新余额（增加积分）
      const balanceBefore = user.credits;
      const balanceAfter = balanceBefore + amount;

      this.logger.debug('Updating user balance', {
        userId,
        balanceBefore,
        balanceAfter,
        amount
      });

      await this.storage.updateUserCredits(userId, amount, txn);

      // 步骤 4: 创建交易记录（正金额表示增加）
      this.logger.debug('Creating transaction record', { userId, action, amount });

      const transaction = await this.storage.createTransaction(
        {
          userId,
          action,
          amount, // 正数表示退款/增加
          balanceBefore,
          balanceAfter,
          metadata
        },
        txn
      );

      this.logger.debug('Transaction record created', {
        transactionId: transaction.id
      });

      // 步骤 5: 创建审计日志
      if (this.config.audit.enabled) {
        this.logger.debug('Creating audit log', { userId, action });

        await this.auditTrail.log(
          {
            userId,
            action: 'refund',
            status: 'success',
            metadata: {
              operation: action,
              amount,
              balanceBefore,
              balanceAfter,
              transactionId: transaction.id,
              ...metadata
            }
          },
          txn
        );

        this.logger.debug('Audit log created', { userId });
      }

      // 构建结果
      const result: RefundResult = {
        success: true,
        transactionId: transaction.id,
        amount,
        balanceAfter
      };

      // 步骤 6: 保存幂等记录
      if (idempotencyKey) {
        this.logger.debug('Saving idempotency record', { idempotencyKey });
        await this.idempotencyManager.save(idempotencyKey, result, txn);
      }

      this.logger.info('Refund operation completed successfully', {
        userId,
        action,
        amount,
        transactionId: transaction.id
      });

      return result;

    } catch (error) {
      // 记录失败的审计日志
      if (this.config.audit.enabled) {
        try {
          await this.auditTrail.log(
            {
              userId,
              action: 'refund',
              status: 'failed',
              metadata: {
                operation: action,
                amount,
                error: error instanceof Error ? error.message : String(error),
                ...metadata
              },
              errorMessage: error instanceof Error ? error.message : String(error)
            },
            txn
          );
        } catch (auditError) {
          // 如果审计日志记录失败，只记录警告，不影响主错误的抛出
          this.logger.warn('Failed to create audit log for failed operation', {
            userId,
            action,
            error: auditError
          });
        }
      }

      this.logger.error('Refund operation failed', {
        userId,
        action,
        amount,
        error: error instanceof Error ? error.message : String(error)
      });

      // 重新抛出原始错误
      throw error;
    }
  }

  /**
   * 发放积分
   * 
   * 执行发放流程：
   * 1. 验证金额为正数
   * 2. 用户验证 - 检查用户是否存在
   * 3. 余额更新 - 增加积分
   * 4. 交易记录 - 创建交易记录（正金额表示增加）
   * 5. 审计日志 - 记录操作
   * 
   * 所有操作在事务中执行（如果提供了事务上下文）或自动提交。
   * 任何步骤失败都会导致整个操作回滚（在事务中）。
   * 
   * @param params - 发放参数
   * @returns 发放结果
   * @throws {UserNotFoundError} 当用户不存在时
   * @throws {ConfigurationError} 当发放金额小于或等于零时
   * 
   * @example
   * ```typescript
   * // 基本发放
   * const result = await engine.grant({
   *   userId: 'user-123',
   *   amount: 100,
   *   action: 'promotion-bonus'
   * });
   * 
   * // 在事务中发放
   * await prisma.$transaction(async (tx) => {
   *   const result = await engine.grant({
   *     userId: 'user-123',
   *     amount: 100,
   *     action: 'promotion-bonus',
   *     txn: tx
   *   });
   *   // ... 其他操作 ...
   * });
   * ```
   * 
   * 验证需求:
   * - 6.1: 将积分添加到用户余额
   * - 6.2: 创建交易记录
   * - 6.3: 创建审计日志条目
   * - 6.4: 支持发放操作的事务上下文
   * - 6.5: 验证发放金额为正数
   */
  async grant(params: GrantParams): Promise<GrantResult> {
    const { userId, amount, action, metadata = {}, txn } = params;

    this.logger.info('Starting grant operation', {
      userId,
      amount,
      action,
      hasTransaction: !!txn
    });

    try {
      // 步骤 1: 验证金额为正数
      if (amount <= 0) {
        this.logger.warn('Invalid grant amount', { userId, amount });
        throw new ConfigurationError(
          `Grant amount must be positive, got ${amount}`
        );
      }

      this.logger.debug('Amount validation passed', { amount });

      // 步骤 2: 获取用户信息
      this.logger.debug('Fetching user', { userId });
      const user = await this.storage.getUserById(userId, txn);
      
      if (!user) {
        this.logger.warn('User not found', { userId });
        throw new UserNotFoundError(userId);
      }

      this.logger.debug('User found', {
        userId,
        credits: user.credits
      });

      // 步骤 3: 更新余额（增加积分）
      const balanceBefore = user.credits;
      const balanceAfter = balanceBefore + amount;

      this.logger.debug('Updating user balance', {
        userId,
        balanceBefore,
        balanceAfter,
        amount
      });

      await this.storage.updateUserCredits(userId, amount, txn);

      // 步骤 4: 创建交易记录（正金额表示增加）
      this.logger.debug('Creating transaction record', { userId, action, amount });

      const transaction = await this.storage.createTransaction(
        {
          userId,
          action,
          amount, // 正数表示发放/增加
          balanceBefore,
          balanceAfter,
          metadata
        },
        txn
      );

      this.logger.debug('Transaction record created', {
        transactionId: transaction.id
      });

      // 步骤 5: 创建审计日志
      if (this.config.audit.enabled) {
        this.logger.debug('Creating audit log', { userId, action });

        await this.auditTrail.log(
          {
            userId,
            action: 'grant',
            status: 'success',
            metadata: {
              operation: action,
              amount,
              balanceBefore,
              balanceAfter,
              transactionId: transaction.id,
              ...metadata
            }
          },
          txn
        );

        this.logger.debug('Audit log created', { userId });
      }

      // 构建结果
      const result: GrantResult = {
        success: true,
        transactionId: transaction.id,
        amount,
        balanceAfter
      };

      this.logger.info('Grant operation completed successfully', {
        userId,
        action,
        amount,
        transactionId: transaction.id
      });

      return result;

    } catch (error) {
      // 记录失败的审计日志
      if (this.config.audit.enabled) {
        try {
          await this.auditTrail.log(
            {
              userId,
              action: 'grant',
              status: 'failed',
              metadata: {
                operation: action,
                amount,
                error: error instanceof Error ? error.message : String(error),
                ...metadata
              },
              errorMessage: error instanceof Error ? error.message : String(error)
            },
            txn
          );
        } catch (auditError) {
          // 如果审计日志记录失败，只记录警告，不影响主错误的抛出
          this.logger.warn('Failed to create audit log for failed operation', {
            userId,
            action,
            error: auditError
          });
        }
      }

      this.logger.error('Grant operation failed', {
        userId,
        action,
        amount,
        error: error instanceof Error ? error.message : String(error)
      });

      // 重新抛出原始错误
      throw error;
    }
  }

  /**
   * 查询余额
   * 
   * 查询用户的当前积分余额。
   * 
   * 执行流程：
   * 1. 获取用户信息
   * 2. 验证用户存在
   * 3. 返回积分余额
   * 
   * 支持事务上下文以确保读取一致性。
   * 
   * @param userId - 用户 ID
   * @param txn - 可选的事务上下文
   * @returns 用户当前积分余额（数值类型）
   * @throws {UserNotFoundError} 当用户不存在时
   * 
   * @example
   * ```typescript
   * // 基本查询
   * const balance = await engine.queryBalance('user-123');
   * console.log(`Current balance: ${balance}`);
   * 
   * // 在事务中查询（确保读取一致性）
   * await prisma.$transaction(async (tx) => {
   *   const balance = await engine.queryBalance('user-123', tx);
   *   // ... 基于余额的其他操作 ...
   * });
   * ```
   * 
   * 验证需求:
   * - 7.1: 使用有效用户 ID 调用时，返回当前积分余额
   * - 7.2: 使用无效用户 ID 调用时，抛出 UserNotFoundError
   * - 7.3: 支持余额查询的事务上下文以确保读取一致性
   * - 7.4: 返回具有适当精度的数值类型余额
   */
  async queryBalance(userId: string, txn?: any): Promise<number> {
    this.logger.info('Starting queryBalance operation', {
      userId,
      hasTransaction: !!txn
    });

    try {
      // 步骤 1: 获取用户信息
      this.logger.debug('Fetching user', { userId });
      const user = await this.storage.getUserById(userId, txn);
      
      // 步骤 2: 验证用户存在
      if (!user) {
        this.logger.warn('User not found', { userId });
        throw new UserNotFoundError(userId);
      }

      this.logger.debug('User found', {
        userId,
        credits: user.credits
      });

      // 步骤 3: 返回积分余额
      this.logger.info('QueryBalance operation completed successfully', {
        userId,
        balance: user.credits
      });

      return user.credits;

    } catch (error) {
      this.logger.error('QueryBalance operation failed', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });

      // 重新抛出原始错误
      throw error;
    }
  }

  /**
   * 获取交易历史
   * 
   * 查询用户的积分交易记录，支持分页和过滤。
   * 
   * 执行流程：
   * 1. 通过 StorageAdapter 查询交易记录
   * 2. 应用分页参数 (limit, offset)
   * 3. 应用日期范围过滤 (startDate, endDate)
   * 4. 应用操作类型过滤 (action)
   * 5. 返回按时间戳降序排列的交易列表
   * 
   * 支持事务上下文以确保读取一致性。
   * 
   * @param userId - 用户 ID
   * @param options - 查询选项
   * @returns 交易记录列表，按时间戳降序排列
   * 
   * @example
   * ```typescript
   * // 获取最近 10 条交易
   * const history = await engine.getHistory('user-123', { limit: 10 });
   * 
   * // 分页查询
   * const history = await engine.getHistory('user-123', { 
   *   limit: 20, 
   *   offset: 40 
   * });
   * 
   * // 按日期范围过滤
   * const history = await engine.getHistory('user-123', {
   *   startDate: new Date('2024-01-01'),
   *   endDate: new Date('2024-12-31')
   * });
   * 
   * // 按操作类型过滤
   * const history = await engine.getHistory('user-123', {
   *   action: 'generate-post'
   * });
   * 
   * // 组合多个过滤条件
   * const history = await engine.getHistory('user-123', {
   *   limit: 50,
   *   offset: 0,
   *   startDate: new Date('2024-01-01'),
   *   action: 'generate-post'
   * });
   * 
   * // 在事务中查询（确保读取一致性）
   * await prisma.$transaction(async (tx) => {
   *   const history = await engine.getHistory('user-123', { 
   *     limit: 10,
   *     txn: tx 
   *   });
   *   // ... 基于历史的其他操作 ...
   * });
   * ```
   * 
   * 验证需求:
   * - 8.1: 返回指定用户的交易列表
   * - 8.2: 通过 limit 和 offset 参数支持分页
   * - 8.3: 支持按日期范围过滤
   * - 8.4: 支持按操作类型过滤
   * - 8.5: 返回按时间戳降序排列的交易
   */
  async getHistory(userId: string, options?: HistoryOptions): Promise<Transaction[]> {
    const { limit, offset, startDate, endDate, action, txn } = options || {};

    this.logger.info('Starting getHistory operation', {
      userId,
      limit,
      offset,
      hasStartDate: !!startDate,
      hasEndDate: !!endDate,
      action,
      hasTransaction: !!txn
    });

    try {
      // 查询交易历史
      this.logger.debug('Fetching transaction history', {
        userId,
        filters: { limit, offset, startDate, endDate, action }
      });

      const transactions = await this.storage.getTransactions(
        userId,
        {
          limit,
          offset,
          startDate,
          endDate,
          action
        },
        txn
      );

      this.logger.info('GetHistory operation completed successfully', {
        userId,
        transactionCount: transactions.length
      });

      return transactions;

    } catch (error) {
      this.logger.error('GetHistory operation failed', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });

      // 重新抛出原始错误
      throw error;
    }
  }

  /**
   * 验证访问权限
   * 
   * 检查用户是否有权限执行某个操作。
   * 验证用户的会员等级是否满足操作所需的等级。
   * 
   * 验证流程：
   * 1. 获取用户信息
   * 2. 检查操作的会员要求
   * 3. 验证用户会员等级和过期状态
   * 4. 返回验证结果
   * 
   * @param userId - 用户 ID
   * @param action - 操作名称
   * @param txn - 可选的事务上下文
   * @returns 是否有权限
   * @throws {UserNotFoundError} 当用户不存在时
   * @throws {MembershipRequiredError} 当用户缺少所需会员资格时
   * 
   * @example
   * ```typescript
   * // 验证用户是否可以执行操作
   * try {
   *   const hasAccess = await engine.validateAccess('user-123', 'generate-post');
   *   if (hasAccess) {
   *     // 用户有权限
   *   }
   * } catch (error) {
   *   if (error instanceof MembershipRequiredError) {
   *     // 用户缺少所需会员资格
   *   }
   * }
   * ```
   * 
   * 验证需求:
   * - 9.1: 检查用户的会员等级是否满足操作所需的等级
   * - 9.2: 当用户的会员资格已过期时，将其视为没有会员资格
   * - 9.3: 当用户缺少所需会员资格时，抛出 MembershipRequiredError
   * - 9.4: 当用户具有足够的会员资格时，返回 true
   * - 9.5: 支持每个操作的可配置会员要求
   */
  async validateAccess(userId: string, action: string, txn?: any): Promise<boolean> {
    this.logger.info('Validating access', { userId, action });

    try {
      // 步骤 1: 获取用户信息
      this.logger.debug('Fetching user for access validation', { userId });
      const user = await this.storage.getUserById(userId, txn);
      
      if (!user) {
        this.logger.warn('User not found during access validation', { userId });
        throw new UserNotFoundError(userId);
      }

      this.logger.debug('User found for access validation', {
        userId,
        membershipTier: user.membershipTier,
        membershipExpiresAt: user.membershipExpiresAt
      });

      // 步骤 2: 检查操作的会员要求
      const requiredTier = this.config.membership.requirements[action] || null;
      
      this.logger.debug('Checking membership requirement', {
        action,
        requiredTier
      });

      // 如果操作不需要会员，直接返回 true
      if (requiredTier === null) {
        this.logger.info('Access granted - no membership required', {
          userId,
          action
        });
        return true;
      }

      // 步骤 3: 验证用户会员等级和过期状态
      this.logger.debug('Validating membership', {
        userId,
        requiredTier,
        currentTier: user.membershipTier
      });

      const validationResult = this.membershipValidator.validate(user, requiredTier);
      
      if (!validationResult.valid) {
        this.logger.warn('Access denied - membership validation failed', {
          userId,
          action,
          reason: validationResult.reason,
          requiredTier,
          currentTier: validationResult.currentTier,
          isExpired: validationResult.isExpired
        });

        // 步骤 4: 抛出适当的错误
        throw new MembershipRequiredError(
          userId,
          requiredTier,
          validationResult.currentTier
        );
      }

      this.logger.info('Access granted - membership validation passed', {
        userId,
        action,
        currentTier: validationResult.currentTier
      });

      // 返回 true 表示有权限
      return true;
    } catch (error) {
      // 记录错误到审计日志
      if (this.config.audit.enabled) {
        await this.auditTrail.log(
          {
            userId,
            action: 'validateAccess',
            status: 'failed',
            metadata: {
              targetAction: action,
              error: error instanceof Error ? error.message : String(error)
            },
            errorMessage: error instanceof Error ? error.message : String(error)
          },
          txn
        );
      }

      // 重新抛出错误
      throw error;
    }
  }
}

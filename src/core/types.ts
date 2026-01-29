/**
 * 核心类型定义
 * 定义 SDK 中使用的所有核心数据类型
 */

/**
 * 用户类型
 * 表示系统中的用户及其积分信息
 */
export interface User {
  /** 用户唯一标识符 */
  id: string;
  /** 当前积分余额 */
  credits: number;
  /** 会员等级 (null 表示无会员) */
  membershipTier: string | null;
  /** 会员到期时间 (null 表示无会员或永久) */
  membershipExpiresAt: Date | null;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 交易记录类型
 * 记录所有积分变动的历史
 */
export interface Transaction {
  /** 交易唯一标识符 */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 操作名称 (如 'generate-post', 'generate-image') */
  action: string;
  /** 变更金额 (负数表示扣费，正数表示增加) */
  amount: number;
  /** 操作前余额 */
  balanceBefore: number;
  /** 操作后余额 */
  balanceAfter: number;
  /** 元数据 (存储操作相关的额外信息) */
  metadata: Record<string, any>;
  /** 创建时间 */
  createdAt: Date;
}

/**
 * 交易记录输入类型
 * 用于创建新的交易记录
 */
export interface TransactionInput {
  userId: string;
  action: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  metadata?: Record<string, any>;
}

/**
 * 审计日志类型
 * 记录所有系统操作用于审计和调试
 */
export interface AuditLog {
  /** 日志唯一标识符 */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 操作类型 */
  action: string;
  /** 操作状态 */
  status: 'success' | 'failed';
  /** 元数据 (操作详情) */
  metadata: Record<string, any>;
  /** 错误消息 (仅在失败时) */
  errorMessage?: string;
  /** 创建时间 */
  createdAt: Date;
}

/**
 * 审计日志输入类型
 * 用于创建新的审计日志
 */
export interface AuditLogInput {
  userId: string;
  action: string;
  status: 'success' | 'failed';
  metadata?: Record<string, any>;
  errorMessage?: string;
}

/**
 * 幂等性记录类型
 * 用于防止重复操作
 */
export interface IdempotencyRecord {
  /** 幂等键 */
  key: string;
  /** 缓存的操作结果 */
  result: any;
  /** 创建时间 */
  createdAt: Date;
  /** 过期时间 */
  expiresAt: Date;
}

/**
 * 幂等性记录输入类型
 * 用于创建新的幂等性记录
 */
export interface IdempotencyRecordInput {
  key: string;
  result: any;
  expiresAt: Date;
}

/**
 * 扣费参数类型
 * 用于调用 charge 方法
 */
export interface ChargeParams {
  /** 用户 ID */
  userId: string;
  /** 操作名称 */
  action: string;
  /** 幂等键 (可选，用于防止重复扣费) */
  idempotencyKey?: string;
  /** 元数据 (可选，存储额外信息) */
  metadata?: Record<string, any>;
  /** 事务上下文 (可选，用于事务透传) */
  txn?: any;
  /** 动态公式变量 (可选，用于动态成本计算) */
  variables?: Record<string, number>;
}

/**
 * 扣费结果类型
 * charge 方法的返回值
 */
export interface ChargeResult {
  /** 操作是否成功 */
  success: true;
  /** 交易 ID */
  transactionId: string;
  /** 扣费金额 */
  cost: number;
  /** 操作前余额 */
  balanceBefore: number;
  /** 操作后余额 */
  balanceAfter: number;
}

/**
 * 退款参数类型
 * 用于调用 refund 方法
 */
export interface RefundParams {
  /** 用户 ID */
  userId: string;
  /** 退款金额 */
  amount: number;
  /** 操作名称 (用于记录) */
  action: string;
  /** 幂等键 (可选) */
  idempotencyKey?: string;
  /** 元数据 (可选) */
  metadata?: Record<string, any>;
  /** 事务上下文 (可选) */
  txn?: any;
}

/**
 * 退款结果类型
 * refund 方法的返回值
 */
export interface RefundResult {
  /** 操作是否成功 */
  success: true;
  /** 交易 ID */
  transactionId: string;
  /** 退款金额 */
  amount: number;
  /** 操作后余额 */
  balanceAfter: number;
}

/**
 * 发放参数类型
 * 用于调用 grant 方法
 */
export interface GrantParams {
  /** 用户 ID */
  userId: string;
  /** 发放金额 */
  amount: number;
  /** 操作名称 (用于记录) */
  action: string;
  /** 幂等键 (可选) */
  idempotencyKey?: string;
  /** 元数据 (可选) */
  metadata?: Record<string, any>;
  /** 事务上下文 (可选) */
  txn?: any;
}

/**
 * 发放结果类型
 * grant 方法的返回值
 */
export interface GrantResult {
  /** 操作是否成功 */
  success: true;
  /** 交易 ID */
  transactionId: string;
  /** 发放金额 */
  amount: number;
  /** 操作后余额 */
  balanceAfter: number;
}

/**
 * 交易历史查询选项
 * 用于 getHistory 方法
 */
export interface HistoryOptions {
  /** 限制返回数量 */
  limit?: number;
  /** 偏移量 (用于分页) */
  offset?: number;
  /** 开始日期 (可选) */
  startDate?: Date;
  /** 结束日期 (可选) */
  endDate?: Date;
  /** 操作类型过滤 (可选) */
  action?: string;
  /** 事务上下文 (可选) */
  txn?: any;
}

/**
 * 成本配置类型
 * 定义每个操作的积分成本
 */
export interface CostConfig {
  [action: string]: {
    /** 默认成本 (无会员或未定义等级时使用) */
    default: number;
    /** 各会员等级的成本 */
    [tier: string]: number;
  };
}

/**
 * 动态成本公式配置
 * 扩展现有的 CostConfig，支持固定成本和动态公式字符串
 * 
 * ## 配置格式
 * 
 * 每个操作可以配置为：
 * - **固定成本**（数字）：向后兼容，直接返回该数字
 * - **动态公式**（字符串）：基于变量计算成本
 * 
 * ## 公式语法
 * 
 * ### 变量占位符
 * 使用 `{variableName}` 格式定义变量：
 * - 变量名必须以字母开头
 * - 只能包含字母、数字和下划线
 * - 区分大小写
 * 
 * ### 运算符
 * - 算术：`+`, `-`, `*`, `/`
 * - 括号：`(`, `)` 控制优先级
 * - 比较：`<`, `>`, `<=`, `>=`, `==`, `!=`
 * - 三元：`condition ? value1 : value2`
 * - 逻辑：`&&`, `||`, `!`
 * 
 * ## 配置示例
 * 
 * ### 1. 混合配置（固定 + 动态）
 * ```typescript
 * const config: DynamicCostConfig = {
 *   // 固定成本（向后兼容）
 *   'generate-image': {
 *     default: 20,
 *     premium: 15,
 *     enterprise: 10
 *   },
 *   
 *   // 动态公式 - Token 计费
 *   'ai-completion': {
 *     default: '{token} * 0.001 + 10',      // 每 token 0.001 credit + 10 基础费用
 *     premium: '{token} * 0.0008 + 8',      // 会员享受 20% 折扣
 *     enterprise: '{token} * 0.0005 + 5'    // 企业享受 50% 折扣
 *   }
 * };
 * ```
 * 
 * ### 2. 多变量公式
 * ```typescript
 * const config: DynamicCostConfig = {
 *   // 视频处理：基于时长（秒）和分辨率（像素）
 *   'video-processing': {
 *     default: '{duration} * 2 + {resolution} * 0.5',
 *     premium: '({duration} * 2 + {resolution} * 0.5) * 0.8'  // 20% 折扣
 *   },
 *   
 *   // 数据分析：基于行数和列数
 *   'data-analysis': {
 *     default: '{rows} * 0.01 + {columns} * 0.05',
 *     premium: '{rows} * 0.008 + {columns} * 0.04'
 *   }
 * };
 * ```
 * 
 * ### 3. 阶梯计费
 * ```typescript
 * const config: DynamicCostConfig = {
 *   // 小于 1000 行：每行 0.1 credit
 *   // 大于等于 1000 行：前 1000 行 100 credit，之后每行 0.05 credit
 *   'data-processing': {
 *     default: '{rows} < 1000 ? {rows} * 0.1 : 100 + ({rows} - 1000) * 0.05',
 *     premium: '{rows} < 1000 ? {rows} * 0.08 : 80 + ({rows} - 1000) * 0.04'
 *   },
 *   
 *   // 多级阶梯
 *   'storage': {
 *     default: '{size} <= 100 ? {size} * 0.1 : ' +
 *              '{size} <= 1000 ? 10 + ({size} - 100) * 0.05 : ' +
 *              '55 + ({size} - 1000) * 0.01'
 *   }
 * };
 * ```
 * 
 * ### 4. 条件计费
 * ```typescript
 * const config: DynamicCostConfig = {
 *   // 根据优先级调整价格
 *   'task-processing': {
 *     default: '{priority} == 1 ? {size} * 2 : {size} * 1',  // 高优先级双倍
 *     premium: '{priority} == 1 ? {size} * 1.5 : {size} * 0.8'
 *   },
 *   
 *   // 根据质量等级计费
 *   'image-generation': {
 *     default: '{quality} == "high" ? 30 : {quality} == "medium" ? 20 : 10'
 *   }
 * };
 * ```
 * 
 * ### 5. 复杂业务逻辑
 * ```typescript
 * const config: DynamicCostConfig = {
 *   // AI 模型调用：考虑模型类型、token 数量和是否流式
 *   'ai-inference': {
 *     default: '({modelSize} * 0.01 + {token} * 0.001) * ({streaming} ? 1.2 : 1)',
 *     premium: '({modelSize} * 0.008 + {token} * 0.0008) * ({streaming} ? 1.15 : 1)'
 *   },
 *   
 *   // 批量处理：数量越多单价越低
 *   'batch-processing': {
 *     default: '{count} * ({count} < 10 ? 1 : {count} < 100 ? 0.8 : 0.6)'
 *   }
 * };
 * ```
 * 
 * ### 6. 回退配置
 * ```typescript
 * const config: DynamicCostConfig = {
 *   // default 为固定值，作为回退
 *   'ai-completion': {
 *     default: 10,  // 当未提供 variables 时使用此值
 *     premium: '{token} * 0.0008 + 8',
 *     enterprise: '{token} * 0.0005 + 5'
 *   }
 * };
 * ```
 * 
 * ## 使用示例
 * 
 * ```typescript
 * import { CreditsEngine } from './core/CreditsEngine';
 * import { DynamicCostConfig } from './core/types';
 * 
 * const config: DynamicCostConfig = {
 *   'ai-completion': {
 *     default: '{token} * 0.001 + 10',
 *     premium: '{token} * 0.0008 + 8'
 *   }
 * };
 * 
 * const engine = new CreditsEngine({
 *   storage: myStorage,
 *   costs: config
 * });
 * 
 * // 扣费时传入变量
 * const result = await engine.charge({
 *   userId: 'user-123',
 *   action: 'ai-completion',
 *   variables: { token: 3500 }  // 实际消耗的 token 数量
 * });
 * 
 * console.log(result.cost); // 13.5
 * ```
 * 
 * ## 注意事项
 * 
 * ### 1. 初始化验证
 * 所有公式在系统初始化时会被验证，如果语法无效会抛出 ConfigurationError：
 * ```typescript
 * // ❌ 错误：括号不匹配
 * const badConfig: DynamicCostConfig = {
 *   'action': { default: '{token * 0.5' }
 * };
 * new DynamicCostFormula(badConfig); // 抛出 ConfigurationError
 * ```
 * 
 * ### 2. 变量命名
 * 变量名必须符合规范，否则初始化失败：
 * ```typescript
 * // ❌ 错误：变量名包含连字符
 * const badConfig: DynamicCostConfig = {
 *   'action': { default: '{token-count} * 0.5' }
 * };
 * 
 * // ✅ 正确：使用下划线
 * const goodConfig: DynamicCostConfig = {
 *   'action': { default: '{token_count} * 0.5' }
 * };
 * ```
 * 
 * ### 3. 负数处理
 * 如果公式计算结果为负数，自动设置为 0：
 * ```typescript
 * const config: DynamicCostConfig = {
 *   'refund': { default: '{amount} - {discount}' }
 * };
 * 
 * // 如果 discount > amount，结果为 0
 * formula.calculate('refund', null, { amount: 10, discount: 20 }); // 返回 0
 * ```
 * 
 * ### 4. 四舍五入
 * 所有成本自动四舍五入到 2 位小数：
 * ```typescript
 * formula.calculate('action', null, { token: 3333 }); // 13.33 (不是 13.333)
 * ```
 * 
 * ### 5. 会员等级优先级
 * 系统按以下顺序选择配置：
 * 1. 用户的会员等级配置（如果存在）
 * 2. default 配置
 * 
 * ```typescript
 * const config: DynamicCostConfig = {
 *   'action': {
 *     default: 10,
 *     premium: '{token} * 0.0008'
 *   }
 * };
 * 
 * // premium 用户使用公式
 * formula.calculate('action', 'premium', { token: 1000 }); // 0.8
 * 
 * // 无会员用户使用 default
 * formula.calculate('action', null); // 10
 * ```
 * 
 * @see {@link DynamicCostFormula} 动态成本计算类
 * @see {@link CostConfig} 固定成本配置（向后兼容）
 * @see {@link CalculationDetails} 计算详情接口
 */
export interface DynamicCostConfig {
  [action: string]: {
    /** 默认成本或公式 (无会员或未定义等级时使用) */
    default: number | string;
    /** 各会员等级的成本或公式 */
    [tier: string]: number | string;
  };
}

/**
 * 计算详情接口
 * 用于记录动态成本计算的详细信息到交易元数据
 * 
 * ## 用途
 * 
 * 此接口用于：
 * 1. **审计追踪**：记录成本计算的完整过程
 * 2. **问题排查**：当成本计算出现问题时，可以查看详细信息
 * 3. **数据分析**：分析用户的资源消耗模式
 * 4. **账单明细**：向用户展示详细的计费信息
 * 
 * ## 字段说明
 * 
 * ### formula (可选)
 * 使用的公式字符串，仅在使用动态公式时存在
 * - 固定成本：此字段为 undefined
 * - 动态公式：包含完整的公式字符串
 * 
 * ### variables (可选)
 * 输入的变量及其值，仅在使用动态公式时存在
 * - 固定成本：此字段为 undefined
 * - 动态公式：包含所有输入变量的键值对
 * 
 * ### rawCost
 * 原始计算结果（未四舍五入）
 * - 保留完整的计算精度
 * - 用于审计和验证
 * 
 * ### finalCost
 * 最终成本（四舍五入到 2 位小数）
 * - 实际扣除的积分数量
 * - 与交易记录中的 amount 字段一致
 * 
 * ### isDynamic
 * 是否使用了动态公式
 * - true：使用动态公式计算
 * - false：使用固定成本
 * 
 * ## 使用示例
 * 
 * ### 1. 获取计算详情
 * ```typescript
 * const formula = new DynamicCostFormula(config);
 * 
 * // 获取动态公式的计算详情
 * const details = formula.getCalculationDetails(
 *   'ai-completion',
 *   'premium',
 *   { token: 3500 }
 * );
 * 
 * console.log(details);
 * // {
 * //   formula: '{token} * 0.0008 + 8',
 * //   variables: { token: 3500 },
 * //   rawCost: 10.8,
 * //   finalCost: 10.8,
 * //   isDynamic: true
 * // }
 * ```
 * 
 * ### 2. 保存到交易元数据
 * ```typescript
 * const engine = new CreditsEngine({ storage, costs: config });
 * 
 * const result = await engine.charge({
 *   userId: 'user-123',
 *   action: 'ai-completion',
 *   variables: { token: 3500 },
 *   metadata: {
 *     requestId: 'req-456',
 *     model: 'gpt-4'
 *   }
 * });
 * 
 * // 交易记录自动包含计算详情
 * console.log(result.transaction.metadata);
 * // {
 * //   requestId: 'req-456',
 * //   model: 'gpt-4',
 * //   dynamicCost: {
 * //     formula: '{token} * 0.001 + 10',
 * //     variables: { token: 3500 },
 * //     rawCost: 13.5,
 * //     finalCost: 13.5,
 * //     isDynamic: true
 * //   }
 * // }
 * ```
 * 
 * ### 3. 固定成本的计算详情
 * ```typescript
 * const details = formula.getCalculationDetails('generate-image', 'premium');
 * 
 * console.log(details);
 * // {
 * //   rawCost: 15,
 * //   finalCost: 15,
 * //   isDynamic: false
 * //   // formula 和 variables 字段不存在
 * // }
 * ```
 * 
 * ### 4. 查询历史交易的计算详情
 * ```typescript
 * const transactions = await engine.getHistory({
 *   userId: 'user-123',
 *   action: 'ai-completion',
 *   limit: 10
 * });
 * 
 * for (const txn of transactions) {
 *   if (txn.metadata.dynamicCost) {
 *     const { formula, variables, finalCost } = txn.metadata.dynamicCost;
 *     console.log(`${txn.createdAt}: ${formula} with ${JSON.stringify(variables)} = ${finalCost}`);
 *   }
 * }
 * ```
 * 
 * ## 数据分析示例
 * 
 * ### 1. 统计平均 token 消耗
 * ```typescript
 * const transactions = await engine.getHistory({
 *   userId: 'user-123',
 *   action: 'ai-completion'
 * });
 * 
 * const tokenUsage = transactions
 *   .filter(txn => txn.metadata.dynamicCost?.variables?.token)
 *   .map(txn => txn.metadata.dynamicCost.variables.token);
 * 
 * const avgTokens = tokenUsage.reduce((a, b) => a + b, 0) / tokenUsage.length;
 * console.log(`Average token usage: ${avgTokens}`);
 * ```
 * 
 * ### 2. 验证计算正确性
 * ```typescript
 * const transaction = await storage.getTransaction(transactionId);
 * const details = transaction.metadata.dynamicCost;
 * 
 * if (details && details.isDynamic) {
 *   // 重新计算验证
 *   const parser = new FormulaParser();
 *   const recalculated = parser.evaluate(details.formula, details.variables);
 *   const rounded = Math.round(recalculated * 100) / 100;
 *   
 *   if (rounded !== details.finalCost) {
 *     console.error('Cost calculation mismatch!', {
 *       expected: details.finalCost,
 *       actual: rounded
 *     });
 *   }
 * }
 * ```
 * 
 * ### 3. 生成账单明细
 * ```typescript
 * function generateBillingDetails(transaction: Transaction): string {
 *   const details = transaction.metadata.dynamicCost;
 *   
 *   if (!details || !details.isDynamic) {
 *     return `Fixed cost: ${Math.abs(transaction.amount)} credits`;
 *   }
 *   
 *   const varStr = Object.entries(details.variables || {})
 *     .map(([key, value]) => `${key}=${value}`)
 *     .join(', ');
 *   
 *   return `
 *     Formula: ${details.formula}
 *     Variables: ${varStr}
 *     Raw cost: ${details.rawCost}
 *     Final cost: ${details.finalCost} credits
 *   `.trim();
 * }
 * 
 * const transaction = await storage.getTransaction(transactionId);
 * console.log(generateBillingDetails(transaction));
 * // Formula: {token} * 0.001 + 10
 * // Variables: token=3500
 * // Raw cost: 13.5
 * // Final cost: 13.5 credits
 * ```
 * 
 * ## 注意事项
 * 
 * ### 1. 仅动态公式包含 formula 和 variables
 * ```typescript
 * // 动态公式
 * const dynamicDetails = formula.getCalculationDetails('ai-completion', null, { token: 3500 });
 * console.log(dynamicDetails.formula); // '{token} * 0.001 + 10'
 * console.log(dynamicDetails.variables); // { token: 3500 }
 * 
 * // 固定成本
 * const fixedDetails = formula.getCalculationDetails('generate-image', 'premium');
 * console.log(fixedDetails.formula); // undefined
 * console.log(fixedDetails.variables); // undefined
 * ```
 * 
 * ### 2. rawCost 和 finalCost 可能不同
 * ```typescript
 * // 当需要四舍五入时
 * const details = formula.getCalculationDetails('action', null, { token: 3333 });
 * console.log(details.rawCost); // 13.333
 * console.log(details.finalCost); // 13.33
 * ```
 * 
 * ### 3. 负数成本处理
 * ```typescript
 * // 如果公式结果为负数，rawCost 和 finalCost 都为 0
 * const details = formula.getCalculationDetails('refund', null, { amount: 10, discount: 20 });
 * console.log(details.rawCost); // 0
 * console.log(details.finalCost); // 0
 * ```
 * 
 * @see {@link DynamicCostFormula} 动态成本计算类
 * @see {@link DynamicCostConfig} 动态成本配置
 * @see {@link Transaction} 交易记录类型
 */
export interface CalculationDetails {
  /** 使用的公式（如果是动态的） */
  formula?: string;
  /** 输入的变量 */
  variables?: Record<string, number>;
  /** 原始计算结果（未四舍五入） */
  rawCost: number;
  /** 最终成本（四舍五入后） */
  finalCost: number;
  /** 是否使用了动态公式 */
  isDynamic: boolean;
}

/**
 * 会员等级积分上限配置
 * 定义每个会员等级的积分上限
 */
export interface TierCreditsCapConfig {
  [tier: string]: number;
}

/**
 * 会员配置类型
 * 定义会员等级和权限要求
 */
export interface MembershipConfig {
  /** 会员等级层次结构 (数字越大等级越高) */
  tiers: {
    [tier: string]: number;
  };
  /** 操作所需的最低会员等级 */
  requirements: {
    [action: string]: string | null;
  };
  /** 每个等级的积分上限 */
  creditsCaps: TierCreditsCapConfig;
}

/**
 * 重试配置类型
 * 定义重试策略
 */
export interface RetryConfig {
  /** 是否启用重试 */
  enabled: boolean;
  /** 最大重试次数 */
  maxAttempts: number;
  /** 初始延迟 (毫秒) */
  initialDelay: number;
  /** 最大延迟 (毫秒) */
  maxDelay: number;
  /** 退避倍数 */
  backoffMultiplier: number;
}

/**
 * 幂等性配置类型
 * 定义幂等性行为
 */
export interface IdempotencyConfig {
  /** 是否启用幂等性 */
  enabled: boolean;
  /** 记录保留时间 (秒) */
  ttl: number;
}

/**
 * 审计配置类型
 * 定义审计日志行为
 */
export interface AuditConfig {
  /** 是否启用审计日志 */
  enabled: boolean;
}

/**
 * SDK 配置类型
 * 包含所有配置选项
 */
export interface CreditsConfig {
  /** 成本配置 (支持固定成本和动态公式) */
  costs: DynamicCostConfig;
  /** 会员配置 */
  membership: MembershipConfig;
  /** 重试配置 */
  retry: RetryConfig;
  /** 幂等性配置 */
  idempotency: IdempotencyConfig;
  /** 审计配置 */
  audit: AuditConfig;
}

/**
 * 升级会员等级参数
 * 用于调用 upgradeTier 方法
 */
export interface UpgradeTierParams {
  /** 用户 ID */
  userId: string;
  /** 目标会员等级 */
  targetTier: string;
  /** 会员到期时间（可选，null表示不更新） */
  membershipExpiresAt?: Date | null;
  /** 幂等键（可选，用于防止重复操作） */
  idempotencyKey?: string;
  /** 元数据（可选，存储额外信息） */
  metadata?: Record<string, any>;
  /** 事务上下文（可选，用于事务透传） */
  txn?: any;
}

/**
 * 降级会员等级参数
 * 用于调用 downgradeTier 方法
 */
export interface DowngradeTierParams {
  /** 用户 ID */
  userId: string;
  /** 目标会员等级 */
  targetTier: string;
  /** 是否清除会员到期时间（可选，默认false） */
  clearExpiration?: boolean;
  /** 幂等键（可选，用于防止重复操作） */
  idempotencyKey?: string;
  /** 元数据（可选，存储额外信息） */
  metadata?: Record<string, any>;
  /** 事务上下文（可选，用于事务透传） */
  txn?: any;
}

/**
 * 等级变更结果
 * upgradeTier 和 downgradeTier 方法的返回值
 */
export interface TierChangeResult {
  /** 操作是否成功 */
  success: true;
  /** 交易 ID */
  transactionId: string;
  /** 旧会员等级 */
  oldTier: string | null;
  /** 新会员等级 */
  newTier: string;
  /** 旧积分余额 */
  oldCredits: number;
  /** 新积分余额 */
  newCredits: number;
  /** 积分变动量 */
  creditsDelta: number;
}

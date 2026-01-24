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
  /** 成本配置 */
  costs: CostConfig;
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

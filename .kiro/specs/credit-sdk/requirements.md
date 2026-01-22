# 需求文档: credit-sdk

## 1. 简介

本文档规定了通用 SaaS 积分系统 SDK (credit-sdk) 的需求。该 SDK 为基于订阅的 SaaS 平台提供解耦的、事务感知的用户积分管理解决方案。核心设计原则是基于适配器的架构，避免 ORM 依赖，同时保持事务完整性和可靠性。

## 2. 术语表

- **Credits_Engine（积分引擎）**: 协调所有积分操作的核心服务类
- **Storage_Adapter（存储适配器）**: 处理所有数据库操作的接口实现
- **Transaction_Context（事务上下文）**: 通过操作传递的可选数据库事务对象
- **Idempotency_Key（幂等键）**: 用于防止重复扣费操作的唯一标识符
- **Membership_Tier（会员等级）**: 影响定价和权限的用户订阅级别
- **Audit_Log（审计日志）**: 用于合规和调试的所有系统操作记录
- **Charge_Operation（扣费操作）**: 从用户余额中扣除积分的过程
- **Cost_Formula（成本公式）**: 根据操作和会员等级确定积分成本的计算引擎

## 3. 需求

### 需求 1: 存储适配器接口

**用户故事:** 作为开发者，我希望将 SDK 与任何数据库系统集成，以便我可以使用现有基础设施而不被锁定在特定的 ORM 中。

#### 验收标准

1. THE Storage_Adapter SHALL 定义一个包含六个核心方法的接口：getUserById、updateUserCredits、createTransaction、createAuditLog、getIdempotencyRecord 和 createIdempotencyRecord
2. WHEN 调用任何 Storage_Adapter 方法时，THE Storage_Adapter SHALL 接受一个可选的事务上下文参数
3. WHEN 提供事务上下文时，THE Storage_Adapter SHALL 支持原子操作
4. THE Storage_Adapter SHALL 为所有输入和输出类型定义清晰的 TypeScript 接口
5. WHERE 提供事务上下文时，THE Storage_Adapter SHALL 在该事务范围内执行所有操作

### 需求 2: 核心类型系统

**用户故事:** 作为开发者，我希望所有 SDK 操作都有强类型接口，以便我可以在编译时捕获错误并拥有清晰的 API 契约。

#### 验收标准

1. THE SDK SHALL 定义包含 id、积分余额、会员等级和会员到期时间的 User 类型
2. THE SDK SHALL 定义包含 userId、操作名称、可选幂等键、可选元数据和可选事务上下文的 ChargeParams 类型
3. THE SDK SHALL 定义包含成功状态、剩余余额、交易 ID 和成本金额的 ChargeResult 类型
4. THE SDK SHALL 定义包含 id、userId、操作、金额、操作前后余额和时间戳的 Transaction 类型
5. THE SDK SHALL 定义包含 id、userId、操作、状态、元数据和时间戳的 AuditLog 类型
6. THE SDK SHALL 定义包含成本公式、会员规则、重试策略和功能标志的 CreditsConfig 类型

### 需求 3: 错误处理系统

**用户故事:** 作为开发者，我希望针对不同失败场景有特定的错误类型，以便我可以在应用程序中适当地处理错误。

#### 验收标准

1. WHEN 用户积分不足以执行操作时，THE Credits_Engine SHALL 抛出包含当前余额和所需金额的 InsufficientCreditsError
2. WHEN 用户 ID 在系统中不存在时，THE Credits_Engine SHALL 抛出包含尝试的用户 ID 的 UserNotFoundError
3. WHEN 用户缺少操作所需的会员资格时，THE Credits_Engine SHALL 抛出包含所需等级和当前等级的 MembershipRequiredError
4. WHEN 检测到幂等键冲突时，THE Credits_Engine SHALL 抛出包含现有交易详情的 IdempotencyKeyConflictError
5. THE SDK SHALL 导出所有错误类以供应用程序级错误处理使用

### 需求 4: 积分扣费操作

**用户故事:** 作为开发者，我希望通过自动验证和事务安全从用户扣除积分，以便我可以确保可靠的计费操作。

#### 验收标准

1. WHEN 使用有效参数调用 charge 时，THE Credits_Engine SHALL 按顺序执行幂等性检查、用户验证、会员验证、成本计算、余额检查、余额更新、交易记录和审计日志记录
2. IF 提供了幂等键且与现有操作匹配，THEN THE Credits_Engine SHALL 返回缓存的结果而不执行扣费
3. WHEN 扣费操作在任何步骤失败时，THE Credits_Engine SHALL 在事务内回滚所有更改
4. WHEN 扣费成功时，THE Credits_Engine SHALL 返回包含更新余额和交易 ID 的 ChargeResult
5. THE Credits_Engine SHALL 支持通过 txn 参数将扣费操作包装在外部事务上下文中

### 需求 5: 积分退款操作

**用户故事:** 作为开发者，我希望向用户退还积分，以便我可以优雅地处理取消和错误。

#### 验收标准

1. WHEN 使用有效参数调用 refund 时，THE Credits_Engine SHALL 将积分添加到用户余额
2. WHEN 处理退款时，THE Credits_Engine SHALL 创建带有负金额的交易记录
3. WHEN 处理退款时，THE Credits_Engine SHALL 创建审计日志条目
4. THE Credits_Engine SHALL 支持退款操作的幂等性
5. THE Credits_Engine SHALL 支持退款操作的事务上下文

### 需求 6: 积分发放操作

**用户故事:** 作为开发者，我希望为促销或奖励向用户发放积分，以便我可以实施营销活动。

#### 验收标准

1. WHEN 使用有效参数调用 grant 时，THE Credits_Engine SHALL 将积分添加到用户余额
2. WHEN 发放积分时，THE Credits_Engine SHALL 创建交易记录
3. WHEN 发放积分时，THE Credits_Engine SHALL 创建审计日志条目
4. THE Credits_Engine SHALL 支持发放操作的事务上下文
5. THE Credits_Engine SHALL 验证发放金额为正数

### 需求 7: 余额查询操作

**用户故事:** 作为开发者，我希望查询用户积分余额，以便我可以在 UI 中显示当前积分。

#### 验收标准

1. WHEN 使用有效用户 ID 调用 queryBalance 时，THE Credits_Engine SHALL 返回当前积分余额
2. WHEN 使用无效用户 ID 调用 queryBalance 时，THE Credits_Engine SHALL 抛出 UserNotFoundError
3. THE Credits_Engine SHALL 支持余额查询的事务上下文以确保读取一致性
4. THE Credits_Engine SHALL 返回具有适当精度的数值类型余额

### 需求 8: 交易历史查询

**用户故事:** 作为开发者，我希望检索带有过滤选项的用户交易历史，以便我可以显示积分使用报告。

#### 验收标准

1. WHEN 调用 getHistory 时，THE Credits_Engine SHALL 返回指定用户的交易列表
2. THE Credits_Engine SHALL 通过 limit 和 offset 参数支持分页
3. THE Credits_Engine SHALL 支持按日期范围过滤
4. THE Credits_Engine SHALL 支持按操作类型过滤
5. THE Credits_Engine SHALL 返回按时间戳降序排列的交易

### 需求 9: 访问验证

**用户故事:** 作为开发者，我希望在操作前验证用户权限，以便我可以强制执行基于会员的访问控制。

#### 验收标准

1. WHEN 调用 validateAccess 时，THE Credits_Engine SHALL 检查用户的会员等级是否满足操作所需的等级
2. WHEN 用户的会员资格已过期时，THE Credits_Engine SHALL 将其视为没有会员资格
3. WHEN 用户缺少所需会员资格时，THE Credits_Engine SHALL 抛出 MembershipRequiredError
4. WHEN 用户具有足够的会员资格时，THE Credits_Engine SHALL 返回 true
5. THE Credits_Engine SHALL 支持每个操作的可配置会员要求

### 需求 10: 成本计算公式

**用户故事:** 作为开发者，我希望基于操作和会员等级的灵活成本计算，以便我可以实施分层定价。

#### 验收标准

1. THE Cost_Formula SHALL 根据操作名称和会员等级计算积分成本
2. THE Cost_Formula SHALL 支持不同会员等级的不同定价
3. WHEN 未定义特定等级定价时，THE Cost_Formula SHALL 支持默认成本
4. THE Cost_Formula SHALL 返回数值成本值
5. WHEN 操作没有定义成本时，THE Cost_Formula SHALL 抛出错误

### 需求 11: 会员验证

**用户故事:** 作为开发者，我希望自动进行会员验证和到期检查，以便我可以强制执行订阅策略。

#### 验收标准

1. THE Membership_Validator SHALL 检查用户的会员等级是否满足最低要求
2. THE Membership_Validator SHALL 根据到期时间戳检查用户的会员资格是否已过期
3. WHEN 会员资格已过期时，THE Membership_Validator SHALL 将用户视为没有活动会员资格
4. THE Membership_Validator SHALL 支持可配置的会员等级层次结构
5. THE Membership_Validator SHALL 返回带有具体失败原因的验证结果

### 需求 12: 幂等性管理

**用户故事:** 作为开发者，我希望对扣费操作进行自动幂等性处理，以便我可以安全地重试失败的请求而不会重复扣费。

#### 验收标准

1. WHEN 提供幂等键时，THE Idempotency_Manager SHALL 检查具有该键的现有操作
2. WHEN 找到匹配的幂等键时，THE Idempotency_Manager SHALL 返回缓存的结果
3. WHEN 未找到匹配的键时，THE Idempotency_Manager SHALL 允许操作继续
4. WHEN 操作成功完成时，THE Idempotency_Manager SHALL 使用幂等键存储结果
5. THE Idempotency_Manager SHALL 支持幂等记录的可配置 TTL

### 需求 13: 重试处理

**用户故事:** 作为开发者，我希望对瞬态故障进行自动重试逻辑，以便我的应用程序对临时数据库问题具有弹性。

#### 验收标准

1. WHEN 数据库操作因瞬态错误失败时，THE Retry_Handler SHALL 自动重试操作
2. THE Retry_Handler SHALL 支持可配置的最大重试次数
3. THE Retry_Handler SHALL 在重试尝试之间实施指数退避
4. WHEN 超过最大重试次数时，THE Retry_Handler SHALL 抛出原始错误
5. THE Retry_Handler SHALL 仅重试安全重试的操作（幂等操作）

### 需求 14: 审计跟踪

**用户故事:** 作为开发者，我希望对所有操作进行全面的审计日志记录，以便我可以跟踪系统行为并调试问题。

#### 验收标准

1. WHEN 执行任何积分操作时，THE Audit_Trail SHALL 创建日志条目
2. THE Audit_Trail SHALL 记录操作类型、用户 ID、时间戳、状态和元数据
3. THE Audit_Trail SHALL 记录成功和失败的操作
4. THE Audit_Trail SHALL 支持操作特定详细信息的结构化元数据
5. THE Audit_Trail SHALL 通过 Storage_Adapter 持久化审计日志

### 需求 15: Prisma 参考适配器

**用户故事:** 作为开发者，我希望有一个 Prisma 的参考实现，以便我可以快速将 SDK 与基于 Prisma 的项目集成。

#### 验收标准

1. THE Prisma_Adapter SHALL 实现 Storage_Adapter 接口的所有六个方法
2. WHEN 提供事务上下文时，THE Prisma_Adapter SHALL 将其用于所有数据库操作
3. WHEN 未提供事务上下文时，THE Prisma_Adapter SHALL 直接执行操作
4. THE Prisma_Adapter SHALL 正确地将 SDK 类型映射到 Prisma 模式类型
5. THE Prisma_Adapter SHALL 处理 Prisma 特定的错误并将其转换为 SDK 错误类型

### 需求 16: 日志系统

**用户故事:** 作为开发者，我希望可插拔的日志支持，以便我可以将 SDK 与现有的日志基础设施集成。

#### 验收标准

1. THE SDK SHALL 定义一个包含 debug、info、warn 和 error 级别方法的 ILogAdapter 接口
2. WHEN 未提供自定义日志记录器时，THE SDK SHALL 使用 console 日志作为默认值
3. THE SDK SHALL 通过配置接受自定义日志记录器实现
4. THE SDK SHALL 记录所有重要操作，包括扣费、退款、发放和错误
5. THE SDK SHALL 在日志消息中包含上下文信息（用户 ID、操作、金额）

### 需求 17: 配置管理

**用户故事:** 作为开发者，我希望 SDK 有集中配置，以便我可以在不修改代码的情况下自定义行为。

#### 验收标准

1. THE Credits_Engine SHALL 在初始化期间接受 CreditsConfig 对象
2. THE CreditsConfig SHALL 包含所有支持操作的成本公式
3. THE CreditsConfig SHALL 包含会员等级定义和要求
4. THE CreditsConfig SHALL 包含重试策略配置
5. THE CreditsConfig SHALL 包含可选行为的功能标志

### 需求 18: TypeScript 严格模式合规

**用户故事:** 作为开发者，我希望 SDK 完全类型安全，以便我可以在编译时捕获错误。

#### 验收标准

1. THE SDK SHALL 在启用 TypeScript 严格模式的情况下成功编译
2. THE SDK SHALL 没有隐式 any 类型
3. THE SDK SHALL 正确处理 null 和 undefined 值
4. THE SDK SHALL 导出所有公共类型供消费者使用
5. THE SDK SHALL 为所有公共 API 包含 JSDoc 注释

### 需求 19: 测试支持

**用户故事:** 作为开发者，我希望有用于测试的模拟实现，以便我可以在没有真实数据库的情况下测试我的应用程序。

#### 验收标准

1. THE SDK SHALL 提供用于测试的 MockAdapter 实现
2. THE MockAdapter SHALL 使用内存存储实现所有 Storage_Adapter 方法
3. THE MockAdapter SHALL 支持事务模拟
4. THE MockAdapter SHALL 允许检查存储的数据以进行测试断言
5. THE SDK SHALL 包含演示正确使用的示例测试用例

### 需求 20: 集成示例

**用户故事:** 作为开发者，我希望有完整的集成示例，以便我可以快速了解如何在应用程序中使用 SDK。

#### 验收标准

1. THE SDK SHALL 提供带有 Server Actions 的 Next.js 集成示例
2. THE SDK SHALL 提供带有 REST 端点的 Express.js 集成示例
3. THE SDK SHALL 提供用于实现自定义适配器的适配器模板
4. THE SDK SHALL 包含常见场景的配置示例
5. THE SDK SHALL 用代码示例记录完整的扣费操作流程

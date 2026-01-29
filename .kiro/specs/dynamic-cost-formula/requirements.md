# Requirements Document

## Introduction

本文档定义了动态成本公式功能的需求。该功能扩展现有的CostFormula模块，支持基于实际消耗量（如AI服务的token数量）动态计算credit成本，而不是使用固定的成本值。这使得系统能够根据实际资源消耗进行精确计费，实现成本利润的精细化控制。

## Glossary

- **CostFormula**: 成本计算模块，负责根据操作和会员等级计算积分成本
- **DynamicCostFormula**: 动态成本计算模块，支持基于变量的成本计算公式
- **Variable**: 变量，表示动态成本公式中的可变参数（如token数量、处理时间等）
- **Formula**: 公式，定义如何根据变量计算成本的数学表达式
- **CreditsEngine**: 积分引擎核心类，协调所有积分操作
- **Token**: 令牌，AI服务中的计量单位，用于衡量文本处理量

## Requirements

### Requirement 1: 动态成本公式配置

**User Story:** 作为系统管理员，我希望能够配置基于变量的动态成本公式，以便根据实际资源消耗计算credit成本。

#### Acceptance Criteria

1. THE System SHALL支持在成本配置中定义动态公式，格式为字符串表达式
2. WHEN配置动态公式时，THE System SHALL支持使用变量占位符（如 `{token}`, `{duration}` 等）
3. THE System SHALL支持基本数学运算符：加法(+)、减法(-)、乘法(*)、除法(/)
4. THE System SHALL支持括号用于控制运算优先级
5. WHERE操作配置了动态公式，THE System SHALL同时保留default字段作为基础成本或回退值

### Requirement 2: 动态成本计算

**User Story:** 作为开发者，我希望在扣费时能够传入实际消耗的变量值，以便系统根据动态公式计算准确的成本。

#### Acceptance Criteria

1. WHEN调用charge方法时，THE System SHALL接受可选的variables参数，包含变量名和值的映射
2. WHEN操作配置了动态公式且提供了variables时，THE System SHALL使用公式计算成本
3. WHEN操作配置了动态公式但未提供variables时，THE System SHALL使用default值作为成本
4. WHEN操作未配置动态公式时，THE System SHALL使用现有的固定成本计算逻辑
5. THE System SHALL在计算后将最终成本四舍五入到小数点后2位

### Requirement 3: 公式解析和验证

**User Story:** 作为系统管理员，我希望系统能够验证动态公式的正确性，以便在配置错误时及时发现问题。

#### Acceptance Criteria

1. WHEN初始化配置时，THE System SHALL验证所有动态公式的语法正确性
2. IF动态公式包含无效的语法，THEN THE System SHALL抛出ConfigurationError
3. THE System SHALL验证公式中使用的变量名符合命名规范（字母、数字、下划线）
4. THE System SHALL支持公式中的数字常量（整数和小数）
5. IF公式计算结果为负数，THEN THE System SHALL将成本设置为0

### Requirement 4: 会员等级支持

**User Story:** 作为系统管理员，我希望动态公式能够支持不同会员等级的差异化定价，以便为不同等级用户提供不同的价格策略。

#### Acceptance Criteria

1. THE System SHALL支持为每个会员等级配置不同的动态公式
2. WHEN用户有会员等级且该等级配置了动态公式时，THE System SHALL使用该等级的公式
3. WHEN用户有会员等级但该等级未配置动态公式时，THE System SHALL使用default公式
4. WHEN用户无会员等级时，THE System SHALL使用default公式
5. THE System SHALL保持与现有固定成本配置的向后兼容性

### Requirement 5: 错误处理

**User Story:** 作为开发者，我希望系统能够妥善处理公式计算中的各种错误情况，以便提供清晰的错误信息。

#### Acceptance Criteria

1. IF公式计算时缺少必需的变量，THEN THE System SHALL抛出MissingVariableError
2. IF公式计算时发生除零错误，THEN THE System SHALL抛出FormulaEvaluationError
3. IF公式计算时发生其他运算错误，THEN THE System SHALL抛出FormulaEvaluationError
4. THE System SHALL在错误消息中包含具体的错误原因和相关上下文信息
5. THE System SHALL记录公式计算错误到审计日志

### Requirement 6: 交易记录增强

**User Story:** 作为系统管理员，我希望交易记录能够保存动态成本计算的详细信息，以便进行审计和分析。

#### Acceptance Criteria

1. WHEN使用动态公式计算成本时，THE System SHALL在交易记录的metadata中保存使用的公式
2. THE System SHALL在metadata中保存所有输入变量的名称和值
3. THE System SHALL在metadata中保存计算得出的原始成本值（未四舍五入）
4. THE System SHALL在metadata中保存最终使用的成本值（四舍五入后）
5. THE System SHALL保持与现有交易记录格式的兼容性

### Requirement 7: 配置示例和文档

**User Story:** 作为开发者，我希望有清晰的配置示例和文档，以便快速理解和使用动态成本公式功能。

#### Acceptance Criteria

1. THE System SHALL提供动态公式配置的TypeScript类型定义
2. THE System SHALL在代码注释中提供配置示例
3. THE System SHALL支持常见的使用场景（如token计费、时长计费、阶梯计费）
4. THE System SHALL在错误消息中提供有用的提示信息
5. THE System SHALL保持API的一致性和易用性

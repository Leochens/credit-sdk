# Design Document: Dynamic Cost Formula

## Overview

动态成本公式功能扩展了现有的CostFormula模块，支持基于变量的成本计算。该功能允许系统根据实际资源消耗（如AI服务的token数量、处理时间等）动态计算credit成本，而不是使用固定值。

核心设计理念：
- **向后兼容**：保持与现有固定成本配置的完全兼容
- **灵活性**：支持任意数学表达式和多个变量
- **安全性**：严格的公式验证和错误处理
- **可追溯性**：完整记录计算过程到交易元数据

## Architecture

### 组件关系

```
CreditsEngine
    ↓ (使用)
DynamicCostFormula (新增)
    ↓ (继承/扩展)
CostFormula (现有)
    ↓ (使用)
FormulaParser (新增)
```

### 数据流

1. **配置阶段**：
   - 系统初始化时，DynamicCostFormula验证所有公式语法
   - 解析公式，提取变量名，构建计算函数

2. **计算阶段**：
   - charge方法接收variables参数
   - DynamicCostFormula根据用户等级选择公式
   - 将variables代入公式计算成本
   - 四舍五入到2位小数
   - 返回成本值

3. **记录阶段**：
   - 将公式、变量、原始值、最终值保存到交易metadata
   - 记录到审计日志

## Components and Interfaces

### 1. FormulaParser (新增)

公式解析器，负责解析和验证公式字符串。

```typescript
/**
 * 公式解析器
 * 负责解析、验证和执行数学公式
 */
class FormulaParser {
  /**
   * 解析公式字符串
   * @param formula - 公式字符串，如 "{token} * 0.5 + 100"
   * @returns 解析后的公式对象
   * @throws ConfigurationError - 当公式语法无效时
   */
  parse(formula: string): ParsedFormula;

  /**
   * 验证公式语法
   * @param formula - 公式字符串
   * @throws ConfigurationError - 当公式语法无效时
   */
  validate(formula: string): void;

  /**
   * 提取公式中的变量名
   * @param formula - 公式字符串
   * @returns 变量名数组
   */
  extractVariables(formula: string): string[];

  /**
   * 计算公式值
   * @param formula - 公式字符串
   * @param variables - 变量值映射
   * @returns 计算结果
   * @throws MissingVariableError - 当缺少必需变量时
   * @throws FormulaEvaluationError - 当计算出错时
   */
  evaluate(formula: string, variables: Record<string, number>): number;
}

interface ParsedFormula {
  /** 原始公式字符串 */
  raw: string;
  /** 提取的变量名列表 */
  variables: string[];
  /** 编译后的计算函数 */
  compute: (variables: Record<string, number>) => number;
}
```

**实现策略**：
- 使用正则表达式解析变量占位符 `{variableName}`
- 支持的运算符：`+`, `-`, `*`, `/`, `(`, `)`
- 变量名规则：字母、数字、下划线，必须以字母开头
- 使用Function构造函数或eval（在安全的上下文中）执行计算
- 对所有输入进行严格验证，防止注入攻击

### 2. DynamicCostFormula (新增)

动态成本计算类，扩展CostFormula功能。

```typescript
/**
 * 动态成本公式配置
 * 扩展现有的CostConfig，支持公式字符串
 */
interface DynamicCostConfig {
  [action: string]: {
    /** 默认成本或公式 */
    default: number | string;
    /** 各会员等级的成本或公式 */
    [tier: string]: number | string;
  };
}

/**
 * 动态成本计算类
 * 支持基于变量的动态成本计算
 */
class DynamicCostFormula extends CostFormula {
  private parser: FormulaParser;
  private formulaCache: Map<string, ParsedFormula>;

  constructor(costConfig: DynamicCostConfig);

  /**
   * 计算成本（覆盖父类方法）
   * @param action - 操作名称
   * @param membershipTier - 会员等级
   * @param variables - 可选的变量值映射
   * @returns 计算的成本（四舍五入到2位小数）
   * @throws UndefinedActionError - 当操作未定义时
   * @throws MissingVariableError - 当缺少必需变量时
   * @throws FormulaEvaluationError - 当计算出错时
   */
  calculate(
    action: string,
    membershipTier: string | null,
    variables?: Record<string, number>
  ): number;

  /**
   * 获取计算详情（用于记录到metadata）
   * @param action - 操作名称
   * @param membershipTier - 会员等级
   * @param variables - 变量值映射
   * @returns 计算详情对象
   */
  getCalculationDetails(
    action: string,
    membershipTier: string | null,
    variables?: Record<string, number>
  ): CalculationDetails;

  /**
   * 检查操作是否使用动态公式
   * @param action - 操作名称
   * @param membershipTier - 会员等级
   * @returns 是否使用动态公式
   */
  isDynamic(action: string, membershipTier: string | null): boolean;
}

interface CalculationDetails {
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
```

**计算逻辑**：

1. 获取配置值（固定数字或公式字符串）
2. 判断是否为动态公式（字符串类型）
3. 如果是固定成本，直接返回
4. 如果是动态公式：
   - 检查是否提供了variables
   - 如果未提供，使用default值（如果default是数字）
   - 如果提供了，使用FormulaParser计算
   - 四舍五入到2位小数
   - 如果结果为负数，返回0

### 3. 错误类型 (新增)

```typescript
/**
 * 缺少变量错误
 * 当公式计算时缺少必需的变量时抛出
 */
class MissingVariableError extends Error {
  code = 'MISSING_VARIABLE';
  constructor(
    public formula: string,
    public missingVariable: string,
    public providedVariables: string[]
  );
}

/**
 * 公式计算错误
 * 当公式计算过程中发生错误时抛出
 */
class FormulaEvaluationError extends Error {
  code = 'FORMULA_EVALUATION_ERROR';
  constructor(
    public formula: string,
    public variables: Record<string, number>,
    public cause: string
  );
}
```

### 4. CreditsEngine 集成

修改CreditsEngine以支持动态成本：

```typescript
// 在 CreditsEngine 构造函数中
constructor(options: CreditsEngineOptions) {
  // ... 现有代码 ...
  
  // 使用 DynamicCostFormula 替代 CostFormula
  this.costFormula = new DynamicCostFormula(this.config.costs);
}

// 修改 ChargeParams 类型
interface ChargeParams {
  userId: string;
  action: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
  txn?: any;
  /** 动态公式变量（新增） */
  variables?: Record<string, number>;
}

// 在 charge 方法中
async charge(params: ChargeParams): Promise<ChargeResult> {
  const { userId, action, idempotencyKey, metadata = {}, txn, variables } = params;
  
  // ... 现有代码（用户验证、会员验证等）...
  
  // 计算成本（传入variables）
  const cost = this.costFormula.calculate(action, user.membershipTier, variables);
  
  // 获取计算详情
  const calculationDetails = this.costFormula.getCalculationDetails(
    action,
    user.membershipTier,
    variables
  );
  
  // ... 现有代码（余额检查、更新等）...
  
  // 创建交易记录时，将计算详情添加到metadata
  const transaction = await this.storage.createTransaction(
    {
      userId,
      action,
      amount: -cost,
      balanceBefore,
      balanceAfter,
      metadata: {
        ...metadata,
        // 添加动态成本计算详情
        ...(calculationDetails.isDynamic && {
          dynamicCost: {
            formula: calculationDetails.formula,
            variables: calculationDetails.variables,
            rawCost: calculationDetails.rawCost,
            finalCost: calculationDetails.finalCost
          }
        })
      }
    },
    txn
  );
  
  // ... 现有代码 ...
}
```

## Data Models

### 配置格式

```typescript
// 示例1：混合配置（固定成本 + 动态公式）
const config: DynamicCostConfig = {
  // 固定成本（向后兼容）
  'generate-image': {
    default: 20,
    premium: 15,
    enterprise: 10
  },
  
  // 动态公式
  'ai-completion': {
    default: '{token} * 0.001 + 10',  // 每token 0.001 credit + 10基础费用
    premium: '{token} * 0.0008 + 8',  // 会员折扣
    enterprise: '{token} * 0.0005 + 5'
  },
  
  // 复杂公式
  'video-processing': {
    default: '{duration} * 2 + {resolution} * 0.5',
    premium: '({duration} * 2 + {resolution} * 0.5) * 0.8'  // 20% 折扣
  },
  
  // 阶梯计费
  'data-analysis': {
    default: '{rows} < 1000 ? {rows} * 0.1 : 100 + ({rows} - 1000) * 0.05'
  }
};
```

### 交易元数据格式

```typescript
// 使用动态公式时的交易记录
{
  id: 'txn-123',
  userId: 'user-456',
  action: 'ai-completion',
  amount: -13.5,
  balanceBefore: 100,
  balanceAfter: 86.5,
  metadata: {
    // 用户自定义元数据
    requestId: 'req-789',
    
    // 动态成本计算详情（系统自动添加）
    dynamicCost: {
      formula: '{token} * 0.001 + 10',
      variables: {
        token: 3500
      },
      rawCost: 13.5,
      finalCost: 13.5
    }
  },
  createdAt: '2024-01-15T10:30:00Z'
}
```

## Correctness Properties

*属性是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的正式陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### Property 1: 公式解析正确性

*For any* 有效的公式字符串，解析后的变量列表应该包含公式中所有的变量占位符，且计算函数应该能够正确执行数学运算。

**Validates: Requirements 1.2, 1.3, 1.4, 3.4**

### Property 2: 配置验证完整性

*For any* 包含动态公式的配置，如果公式语法无效或变量名不符合规范，系统初始化时应该抛出ConfigurationError。

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 3: 动态成本计算正确性

*For any* 配置了动态公式的操作，当提供了所有必需变量时，计算结果应该等于手动计算的结果（四舍五入到2位小数）。

**Validates: Requirements 2.2, 2.5**

### Property 4: 回退机制正确性

*For any* 配置了动态公式的操作，当未提供variables参数时，应该使用default值作为成本（如果default是数字）。

**Validates: Requirements 2.3**

### Property 5: 会员等级公式选择

*For any* 用户和操作，系统应该根据用户的会员等级选择正确的公式：有等级且等级有公式时使用等级公式，否则使用default公式。

**Validates: Requirements 4.2, 4.3, 4.4**

### Property 6: 负数成本处理

*For any* 公式和变量组合，如果计算结果为负数，最终成本应该被设置为0。

**Validates: Requirements 3.5**

### Property 7: 缺少变量错误处理

*For any* 需要变量的公式，如果计算时缺少必需的变量，应该抛出MissingVariableError，且错误消息应该包含缺少的变量名。

**Validates: Requirements 5.1, 5.4**

### Property 8: 除零错误处理

*For any* 包含除法的公式，如果变量值导致除零，应该抛出FormulaEvaluationError。

**Validates: Requirements 5.2, 5.3**

### Property 9: 元数据记录完整性

*For any* 使用动态公式的扣费操作，交易记录的metadata应该包含公式、变量、原始成本和最终成本。

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

### Property 10: 向后兼容性

*For any* 使用固定成本配置的操作，系统行为应该与使用旧版CostFormula完全一致。

**Validates: Requirements 2.4, 4.5, 6.5**

### Property 11: 审计日志记录

*For any* 公式计算错误，系统应该创建审计日志记录，包含错误详情。

**Validates: Requirements 5.5**

## Error Handling

### 错误类型和场景

1. **ConfigurationError**
   - 场景：公式语法无效
   - 示例：`"{token * 0.5"` (缺少右括号)
   - 处理：系统初始化时抛出，阻止启动

2. **ConfigurationError**
   - 场景：变量名不符合规范
   - 示例：`"{token-count} * 0.5"` (包含连字符)
   - 处理：系统初始化时抛出，阻止启动

3. **MissingVariableError**
   - 场景：计算时缺少必需变量
   - 示例：公式需要`{token}`但variables中没有提供
   - 处理：抛出错误，包含缺少的变量名和已提供的变量列表

4. **FormulaEvaluationError**
   - 场景：除零错误
   - 示例：`{amount} / {count}`，count为0
   - 处理：抛出错误，包含公式和变量值

5. **FormulaEvaluationError**
   - 场景：其他运算错误
   - 示例：变量值为NaN或Infinity
   - 处理：抛出错误，包含详细的错误原因

### 错误恢复策略

- 配置错误：无法恢复，系统拒绝启动
- 运行时错误：
  - 记录到审计日志
  - 向调用者抛出错误
  - 不执行扣费操作
  - 保持用户余额不变

## Testing Strategy

### 单元测试

**FormulaParser测试**：
- 测试各种有效公式的解析
- 测试无效语法的拒绝
- 测试变量提取的正确性
- 测试计算结果的准确性
- 测试边界情况（空公式、只有常量等）

**DynamicCostFormula测试**：
- 测试固定成本的向后兼容性
- 测试动态公式的计算
- 测试会员等级的公式选择
- 测试回退机制
- 测试错误处理

**CreditsEngine集成测试**：
- 测试带variables的charge调用
- 测试不带variables的charge调用
- 测试元数据记录
- 测试审计日志

### 属性测试

使用fast-check库进行属性测试，每个测试至少100次迭代：

**Property 1: 公式解析正确性**
```typescript
fc.assert(
  fc.property(
    fc.record({
      token: fc.integer({ min: 0, max: 100000 }),
      duration: fc.integer({ min: 0, max: 3600 })
    }),
    (variables) => {
      const formula = '{token} * 0.001 + {duration} * 0.5';
      const parser = new FormulaParser();
      const result = parser.evaluate(formula, variables);
      const expected = variables.token * 0.001 + variables.duration * 0.5;
      expect(result).toBeCloseTo(expected, 10);
    }
  ),
  { numRuns: 100 }
);
```

**Property 3: 动态成本计算正确性**
```typescript
fc.assert(
  fc.property(
    fc.integer({ min: 0, max: 100000 }),
    (token) => {
      const formula = new DynamicCostFormula({
        'test-action': {
          default: '{token} * 0.001 + 10'
        }
      });
      const cost = formula.calculate('test-action', null, { token });
      const expected = Math.round((token * 0.001 + 10) * 100) / 100;
      expect(cost).toBe(expected);
    }
  ),
  { numRuns: 100 }
);
```

**Property 6: 负数成本处理**
```typescript
fc.assert(
  fc.property(
    fc.integer({ min: -1000, max: 0 }),
    (negativeValue) => {
      const formula = new DynamicCostFormula({
        'test-action': {
          default: '{value}'
        }
      });
      const cost = formula.calculate('test-action', null, { value: negativeValue });
      expect(cost).toBe(0);
    }
  ),
  { numRuns: 100 }
);
```

**Property 10: 向后兼容性**
```typescript
fc.assert(
  fc.property(
    fc.constantFrom('free', 'premium', 'enterprise'),
    fc.integer({ min: 0, max: 1000 }),
    (tier, credits) => {
      const config = {
        'test-action': {
          default: 100,
          premium: 80,
          enterprise: 50
        }
      };
      
      const oldFormula = new CostFormula(config);
      const newFormula = new DynamicCostFormula(config);
      
      const oldCost = oldFormula.calculate('test-action', tier);
      const newCost = newFormula.calculate('test-action', tier);
      
      expect(newCost).toBe(oldCost);
    }
  ),
  { numRuns: 100 }
);
```

### 测试配置

- 测试框架：Vitest
- 属性测试库：fast-check
- 最小迭代次数：100次/属性
- 标签格式：`Feature: dynamic-cost-formula, Property {number}: {description}`

### 示例场景测试

测试常见使用场景：

1. **Token计费场景**
   ```typescript
   it('should handle token-based billing', async () => {
     const config = {
       'ai-completion': {
         default: '{token} * 0.001 + 10'
       }
     };
     const engine = new CreditsEngine({ storage, config });
     const result = await engine.charge({
       userId: 'user-123',
       action: 'ai-completion',
       variables: { token: 3500 }
     });
     expect(result.cost).toBe(13.5);
   });
   ```

2. **时长计费场景**
   ```typescript
   it('should handle duration-based billing', async () => {
     const config = {
       'video-processing': {
         default: '{duration} * 2'
       }
     };
     const engine = new CreditsEngine({ storage, config });
     const result = await engine.charge({
       userId: 'user-123',
       action: 'video-processing',
       variables: { duration: 120 }
     });
     expect(result.cost).toBe(240);
   });
   ```

3. **阶梯计费场景**
   ```typescript
   it('should handle tiered billing', async () => {
     const config = {
       'data-analysis': {
         default: '{rows} <= 1000 ? {rows} * 0.1 : 100 + ({rows} - 1000) * 0.05'
       }
     };
     const engine = new CreditsEngine({ storage, config });
     
     // 小于1000行
     const result1 = await engine.charge({
       userId: 'user-123',
       action: 'data-analysis',
       variables: { rows: 500 }
     });
     expect(result1.cost).toBe(50);
     
     // 大于1000行
     const result2 = await engine.charge({
       userId: 'user-123',
       action: 'data-analysis',
       variables: { rows: 2000 }
     });
     expect(result2.cost).toBe(150);
   });
   ```

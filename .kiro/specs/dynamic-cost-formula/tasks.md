# Implementation Plan: Dynamic Cost Formula

## Overview

本实现计划将动态成本公式功能集成到现有的credits引擎系统中。实现将分为以下几个阶段：
1. 创建公式解析器
2. 扩展成本计算模块
3. 集成到CreditsEngine
4. 添加错误处理
5. 完善测试覆盖

所有实现使用TypeScript，保持与现有代码库的一致性。

## Tasks

- [x] 1. 创建错误类型定义
  - 在 `src/core/errors.ts` 中添加 `MissingVariableError` 和 `FormulaEvaluationError` 类
  - 两个错误类都应该继承自Error，包含code属性和详细的上下文信息
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 2. 实现FormulaParser类
  - [x] 2.1 创建FormulaParser基础结构
    - 在 `src/features/FormulaParser.ts` 创建FormulaParser类
    - 实现构造函数和基础属性
    - 定义ParsedFormula接口
    - _Requirements: 1.1, 1.2_

  - [x] 2.2 实现公式解析和验证
    - 实现 `parse()` 方法：解析公式字符串，提取变量，构建计算函数
    - 实现 `validate()` 方法：验证公式语法和变量名规范
    - 实现 `extractVariables()` 方法：提取公式中的所有变量占位符
    - 支持基本运算符：+, -, *, /, (, )
    - 支持变量占位符格式：`{variableName}`
    - 验证变量名规则：字母、数字、下划线，必须以字母开头
    - _Requirements: 1.2, 1.3, 1.4, 3.1, 3.3, 3.4_

  - [x] 2.3 实现公式计算
    - 实现 `evaluate()` 方法：将变量值代入公式计算结果
    - 处理缺少变量的情况，抛出MissingVariableError
    - 处理除零错误，抛出FormulaEvaluationError
    - 处理其他运算错误，抛出FormulaEvaluationError
    - _Requirements: 2.2, 5.1, 5.2, 5.3_

  - [x] 2.4 编写FormulaParser单元测试
    - 测试有效公式的解析
    - 测试无效语法的拒绝
    - 测试变量提取的正确性
    - 测试各种运算符组合
    - 测试边界情况（空公式、只有常量等）
    - _Requirements: 1.2, 1.3, 1.4, 3.1, 3.2, 3.3, 3.4_

  - [x] 2.5 编写FormulaParser属性测试
    - **Property 1: 公式解析正确性**
    - **Validates: Requirements 1.2, 1.3, 1.4, 3.4**
    - 生成随机变量值，验证计算结果与手动计算一致
    - _Requirements: 1.2, 1.3, 1.4, 3.4_

- [x] 3. 扩展类型定义
  - 在 `src/core/types.ts` 中添加 `DynamicCostConfig` 类型
  - 在 `src/core/types.ts` 中添加 `CalculationDetails` 接口
  - 在 `ChargeParams` 接口中添加可选的 `variables` 字段
  - _Requirements: 1.1, 2.1, 6.1, 6.2, 6.3, 6.4, 7.1_

- [ ] 4. 实现DynamicCostFormula类
  - [x] 4.1 创建DynamicCostFormula基础结构
    - 在 `src/features/DynamicCostFormula.ts` 创建类，继承自CostFormula
    - 初始化FormulaParser实例
    - 创建公式缓存Map
    - 在构造函数中验证所有公式
    - _Requirements: 1.1, 3.1, 3.2_

  - [x] 4.2 实现calculate方法
    - 覆盖父类的calculate方法，添加variables参数
    - 获取配置值（可能是数字或公式字符串）
    - 判断是否为动态公式（字符串类型）
    - 如果是固定成本，调用父类方法
    - 如果是动态公式且提供了variables，使用FormulaParser计算
    - 如果是动态公式但未提供variables，使用default值（如果是数字）
    - 四舍五入到2位小数
    - 如果结果为负数，返回0
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 3.5, 4.1, 4.2, 4.3, 4.4_

  - [x] 4.3 实现辅助方法
    - 实现 `getCalculationDetails()` 方法：返回计算详情对象
    - 实现 `isDynamic()` 方法：检查是否使用动态公式
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 4.4 编写DynamicCostFormula单元测试
    - 测试固定成本的向后兼容性
    - 测试动态公式的计算
    - 测试会员等级的公式选择
    - 测试回退机制（未提供variables时使用default）
    - 测试负数成本处理
    - 测试错误处理（缺少变量、除零等）
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 4.5 编写DynamicCostFormula属性测试
    - **Property 2: 配置验证完整性**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - **Property 3: 动态成本计算正确性**
    - **Validates: Requirements 2.2, 2.5**
    - **Property 4: 回退机制正确性**
    - **Validates: Requirements 2.3**
    - **Property 5: 会员等级公式选择**
    - **Validates: Requirements 4.2, 4.3, 4.4**
    - **Property 6: 负数成本处理**
    - **Validates: Requirements 3.5**
    - **Property 10: 向后兼容性**
    - **Validates: Requirements 2.4, 4.5, 6.5**
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.5, 4.2, 4.3, 4.4, 4.5, 6.5_

- [ ] 5. 集成到CreditsEngine
  - [x] 5.1 更新CreditsEngine使用DynamicCostFormula
    - 在 `src/core/CreditsEngine.ts` 中导入DynamicCostFormula
    - 修改构造函数，使用DynamicCostFormula替代CostFormula
    - 保持类型兼容性
    - _Requirements: 1.1, 2.1_

  - [x] 5.2 修改charge方法支持variables
    - 在charge方法中接受variables参数
    - 将variables传递给costFormula.calculate()
    - 获取计算详情（getCalculationDetails）
    - 在创建交易记录时，将计算详情添加到metadata
    - 只在使用动态公式时添加dynamicCost字段
    - _Requirements: 2.1, 2.2, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 5.3 增强错误处理和审计日志
    - 捕获MissingVariableError和FormulaEvaluationError
    - 记录公式计算错误到审计日志
    - 确保错误消息包含有用的上下文信息
    - _Requirements: 5.4, 5.5_

  - [x] 5.4 编写CreditsEngine集成测试
    - 测试带variables的charge调用
    - 测试不带variables的charge调用
    - 测试元数据记录的完整性
    - 测试审计日志记录
    - 测试错误处理流程
    - _Requirements: 2.1, 2.2, 2.3, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 5.5 编写CreditsEngine属性测试
    - **Property 7: 缺少变量错误处理**
    - **Validates: Requirements 5.1, 5.4**
    - **Property 8: 除零错误处理**
    - **Validates: Requirements 5.2, 5.3**
    - **Property 9: 元数据记录完整性**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
    - **Property 11: 审计日志记录**
    - **Validates: Requirements 5.5**
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4_

- [x] 6. Checkpoint - 确保所有测试通过
  - 运行所有单元测试和属性测试
  - 确保没有破坏现有功能
  - 如有问题，请向用户询问

- [ ] 7. 添加示例和文档
  - [x] 7.1 添加代码注释和JSDoc
    - 为所有新增的类和方法添加详细的JSDoc注释
    - 在注释中包含配置示例
    - 添加使用示例到类文档中
    - _Requirements: 7.2_

  - [ ]* 7.2 编写示例场景测试
    - 测试token计费场景
    - 测试时长计费场景
    - 测试阶梯计费场景
    - 测试多变量公式场景
    - _Requirements: 7.3_

- [x] 8. 更新导出
  - 在 `src/features/index.ts` 中导出FormulaParser和DynamicCostFormula
  - 在 `src/core/errors.ts` 中导出新的错误类型
  - 确保所有新类型在 `src/core/types.ts` 中正确导出
  - _Requirements: 7.1_

- [x] 9. Final checkpoint - 最终验证
  - 运行完整的测试套件
  - 验证所有属性测试通过（至少100次迭代）
  - 验证向后兼容性
  - 检查代码质量和文档完整性
  - 如有问题，请向用户询问

## Notes

- 所有测试使用Vitest框架
- 属性测试使用fast-check库，每个测试至少100次迭代
- 标记为 `*` 的任务是可选的测试任务，可以根据需要跳过以加快MVP开发
- 每个任务都引用了相关的需求编号，便于追溯
- 保持与现有代码风格的一致性
- 确保所有新功能都有完整的TypeScript类型定义

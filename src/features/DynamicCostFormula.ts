/**
 * DynamicCostFormula - 动态成本计算类
 * 支持基于变量的动态成本计算，扩展 CostFormula 功能
 * 
 * ## 核心功能
 * 
 * - ✅ **向后兼容**：完全支持固定成本配置
 * - 🧮 **动态公式**：支持基于变量的数学表达式
 * - 👥 **会员等级**：支持不同等级的差异化定价
 * - ✔️ **自动验证**：初始化时验证所有公式语法
 * - 📊 **审计追踪**：提供详细的计算信息用于审计
 * - 🔒 **安全计算**：自动处理负数、除零等边界情况
 * 
 * ## 配置示例
 * 
 * ### 1. 混合配置（固定成本 + 动态公式）
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
 * 
 * const formula = new DynamicCostFormula(config);
 * ```
 * 
 * ### 2. 多变量公式
 * ```typescript
 * const config: DynamicCostConfig = {
 *   // 视频处理：基于时长和分辨率
 *   'video-processing': {
 *     default: '{duration} * 2 + {resolution} * 0.5',
 *     premium: '({duration} * 2 + {resolution} * 0.5) * 0.8'  // 20% 折扣
 *   },
 *   
 *   // 数据分析：基于行数和列数
 *   'data-analysis': {
 *     default: '{rows} * 0.01 + {columns} * 0.05'
 *   }
 * };
 * ```
 * 
 * ### 3. 阶梯计费
 * ```typescript
 * const config: DynamicCostConfig = {
 *   // 小于 1000 行：每行 0.1 credit
 *   // 大于 1000 行：前 1000 行 100 credit，之后每行 0.05 credit
 *   'data-processing': {
 *     default: '{rows} <= 1000 ? {rows} * 0.1 : 100 + ({rows} - 1000) * 0.05',
 *     premium: '{rows} <= 1000 ? {rows} * 0.08 : 80 + ({rows} - 1000) * 0.04'
 *   }
 * };
 * ```
 * 
 * ### 4. 复杂业务逻辑
 * ```typescript
 * const config: DynamicCostConfig = {
 *   // 根据优先级和大小计算成本
 *   'task-processing': {
 *     default: '{priority} == 1 ? {size} * 2 : {size} * 1',  // 高优先级双倍价格
 *     premium: '{priority} == 1 ? {size} * 1.5 : {size} * 0.8'  // 会员折扣
 *   }
 * };
 * ```
 * 
 * ## 使用示例
 * 
 * ### 基础使用
 * ```typescript
 * const formula = new DynamicCostFormula(config);
 * 
 * // 1. 使用固定成本（向后兼容）
 * const cost1 = formula.calculate('generate-image', 'premium');
 * console.log(cost1); // 15
 * 
 * // 2. 使用动态公式
 * const cost2 = formula.calculate('ai-completion', null, { token: 3500 });
 * console.log(cost2); // 13.5 (3500 * 0.001 + 10)
 * 
 * // 3. 会员等级折扣
 * const cost3 = formula.calculate('ai-completion', 'premium', { token: 3500 });
 * console.log(cost3); // 10.8 (3500 * 0.0008 + 8)
 * ```
 * 
 * ### 获取计算详情（用于审计）
 * ```typescript
 * const details = formula.getCalculationDetails('ai-completion', null, { token: 3500 });
 * 
 * console.log(details);
 * // {
 * //   formula: '{token} * 0.001 + 10',
 * //   variables: { token: 3500 },
 * //   rawCost: 13.5,
 * //   finalCost: 13.5,
 * //   isDynamic: true
 * // }
 * 
 * // 将详情保存到交易记录的 metadata
 * const transaction = {
 *   userId: 'user-123',
 *   action: 'ai-completion',
 *   amount: -details.finalCost,
 *   metadata: {
 *     dynamicCost: details
 *   }
 * };
 * ```
 * 
 * ### 检查是否使用动态公式
 * ```typescript
 * const isDynamic1 = formula.isDynamic('generate-image', 'premium');
 * console.log(isDynamic1); // false (固定成本)
 * 
 * const isDynamic2 = formula.isDynamic('ai-completion', null);
 * console.log(isDynamic2); // true (动态公式)
 * ```
 * 
 * ### 回退机制
 * ```typescript
 * // 当未提供 variables 时，自动回退到 default 值（如果 default 是数字）
 * const config: DynamicCostConfig = {
 *   'ai-completion': {
 *     default: 10,  // 固定回退值
 *     premium: '{token} * 0.0008 + 8'
 *   }
 * };
 * 
 * const formula = new DynamicCostFormula(config);
 * 
 * // 未提供 variables，使用 default 值
 * const cost = formula.calculate('ai-completion', 'premium');
 * console.log(cost); // 10
 * ```
 * 
 * ## 错误处理
 * 
 * ### 初始化时的配置验证
 * ```typescript
 * try {
 *   const config: DynamicCostConfig = {
 *     'ai-completion': {
 *       default: '{token * 0.001'  // 括号不匹配
 *     }
 *   };
 *   new DynamicCostFormula(config);
 * } catch (error) {
 *   console.error(error.message);
 *   // "Invalid formula for action 'ai-completion' (default): Mismatched braces..."
 * }
 * ```
 * 
 * ### 运行时错误
 * ```typescript
 * const formula = new DynamicCostFormula(config);
 * 
 * // 缺少必需变量
 * try {
 *   formula.calculate('ai-completion', null, {}); // 缺少 token
 * } catch (error) {
 *   console.error(error.message);
 *   // "Formula '{token} * 0.001 + 10' requires variable 'token'..."
 * }
 * 
 * // 除零错误
 * try {
 *   formula.calculate('data-processing', null, { amount: 100, count: 0 });
 * } catch (error) {
 *   console.error(error.message);
 *   // "Failed to evaluate formula... resulted in Infinity..."
 * }
 * ```
 * 
 * ## 特殊行为
 * 
 * ### 负数成本处理
 * 如果公式计算结果为负数，自动设置为 0：
 * ```typescript
 * const config: DynamicCostConfig = {
 *   'refund': {
 *     default: '{amount} - {discount}'
 *   }
 * };
 * 
 * const formula = new DynamicCostFormula(config);
 * const cost = formula.calculate('refund', null, { amount: 10, discount: 20 });
 * console.log(cost); // 0 (而不是 -10)
 * ```
 * 
 * ### 四舍五入
 * 所有成本自动四舍五入到 2 位小数：
 * ```typescript
 * const cost = formula.calculate('ai-completion', null, { token: 3333 });
 * console.log(cost); // 13.33 (而不是 13.333)
 * ```
 * 
 * ## 集成到 CreditsEngine
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
 *   costs: config  // 使用动态成本配置
 * });
 * 
 * // 扣费时传入 variables
 * const result = await engine.charge({
 *   userId: 'user-123',
 *   action: 'ai-completion',
 *   variables: { token: 3500 }  // 传入实际消耗的 token 数量
 * });
 * 
 * console.log(result.cost); // 13.5
 * console.log(result.transaction.metadata.dynamicCost);
 * // {
 * //   formula: '{token} * 0.001 + 10',
 * //   variables: { token: 3500 },
 * //   rawCost: 13.5,
 * //   finalCost: 13.5
 * // }
 * ```
 * 
 * @see {@link FormulaParser} 公式解析器
 * @see {@link CostFormula} 基础成本计算类
 * @see {@link DynamicCostConfig} 动态成本配置类型
 * @see {@link CalculationDetails} 计算详情接口
 */

import { CostFormula } from './CostFormula';
import { FormulaParser, ParsedFormula } from './FormulaParser';
import { DynamicCostConfig, CalculationDetails } from '../core/types';
import { UndefinedActionError } from '../core/errors';

/**
 * 动态成本计算类
 * 扩展CostFormula，支持基于变量的动态成本计算
 */
export class DynamicCostFormula extends CostFormula {
  /** 公式解析器实例 */
  private parser: FormulaParser;
  
  /** 公式缓存Map，key为公式字符串，value为解析后的公式对象 */
  private formulaCache: Map<string, ParsedFormula>;
  
  /** 动态成本配置 */
  private dynamicCostConfig: DynamicCostConfig;

  /**
   * 创建一个新的 DynamicCostFormula 实例
   * 
   * 初始化过程：
   * 1. 调用父类构造函数
   * 2. 创建FormulaParser实例
   * 3. 初始化公式缓存
   * 4. 验证所有动态公式的语法
   * 
   * @param costConfig - 动态成本配置对象（支持固定成本和动态公式）
   * @throws {ConfigurationError} 当任何公式语法无效时
   * 
   * @example
   * ```typescript
   * const config: DynamicCostConfig = {
   *   'ai-completion': {
   *     default: '{token} * 0.001 + 10',
   *     premium: '{token} * 0.0008 + 8'
   *   }
   * };
   * 
   * const formula = new DynamicCostFormula(config);
   * ```
   */
  constructor(costConfig: DynamicCostConfig) {
    // 调用父类构造函数
    // 注意：父类期望 CostConfig，但 DynamicCostConfig 是兼容的
    super(costConfig as any);
    
    // 保存动态成本配置的引用
    this.dynamicCostConfig = costConfig;
    
    // 初始化FormulaParser实例
    this.parser = new FormulaParser();
    
    // 初始化公式缓存Map
    this.formulaCache = new Map<string, ParsedFormula>();
    
    // 验证所有公式
    this.validateAllFormulas();
  }

  /**
   * 验证配置中的所有动态公式
   * 在构造函数中调用，确保所有公式语法正确
   * 
   * @throws {ConfigurationError} 当任何公式语法无效时
   * @private
   */
  private validateAllFormulas(): void {
    // 遍历所有操作
    for (const action in this.dynamicCostConfig) {
      const actionConfig = this.dynamicCostConfig[action];
      
      // 遍历该操作的所有配置项（default + 各个会员等级）
      for (const key in actionConfig) {
        const value = actionConfig[key];
        
        // 如果是字符串，说明是动态公式，需要验证
        if (typeof value === 'string') {
          try {
            // 验证公式语法
            this.parser.validate(value);
            
            // 解析并缓存公式
            const parsed = this.parser.parse(value);
            this.formulaCache.set(value, parsed);
          } catch (error) {
            // 如果验证失败，抛出更详细的错误信息
            throw new Error(
              `Invalid formula for action '${action}' (${key}): ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        }
      }
    }
  }

  /**
   * 计算成本（覆盖父类方法）
   * 
   * 计算逻辑：
   * 1. 检查操作是否在配置中定义
   * 2. 根据会员等级获取配置值（可能是数字或公式字符串）
   * 3. 如果是固定成本（数字），直接返回
   * 4. 如果是动态公式（字符串）：
   *    - 如果提供了variables，使用公式计算
   *    - 如果未提供variables，使用default值（如果default是数字）
   * 5. 四舍五入到2位小数
   * 6. 如果结果为负数，返回0
   * 
   * @param action - 操作名称
   * @param membershipTier - 会员等级（null表示无会员）
   * @param variables - 可选的变量值映射（用于动态公式计算）
   * @returns 计算的成本（四舍五入到2位小数）
   * @throws {UndefinedActionError} 当操作未定义时
   * @throws {MissingVariableError} 当缺少必需变量时
   * @throws {FormulaEvaluationError} 当计算出错时
   * 
   * @example
   * ```typescript
   * // 固定成本
   * const cost1 = formula.calculate('generate-image', 'premium'); // 15
   * 
   * // 动态公式（提供variables）
   * const cost2 = formula.calculate('ai-completion', null, { token: 3500 }); // 13.5
   * 
   * // 动态公式（未提供variables，回退到default）
   * const cost3 = formula.calculate('ai-completion', null); // 使用default值
   * ```
   */
  calculate(
    action: string,
    membershipTier: string | null,
    variables?: Record<string, number>
  ): number {
    // 检查操作是否在配置中定义
    const actionConfig = this.dynamicCostConfig[action];
    
    if (!actionConfig) {
      throw new UndefinedActionError(action);
    }

    // 获取配置值（可能是数字或公式字符串）
    let configValue: number | string;
    
    // 如果有会员等级且该等级有特定定价，使用等级定价
    if (membershipTier && actionConfig[membershipTier] !== undefined) {
      configValue = actionConfig[membershipTier];
    } else {
      // 否则使用默认成本
      configValue = actionConfig.default;
    }

    // 如果是固定成本（数字），直接返回
    if (typeof configValue === 'number') {
      return configValue;
    }

    // 如果是动态公式（字符串）
    const formula = configValue;
    
    // 如果未提供variables，尝试使用default值
    if (!variables || Object.keys(variables).length === 0) {
      // 如果default是数字，使用它作为回退值
      if (typeof actionConfig.default === 'number') {
        return actionConfig.default;
      }
      
      // 如果default也是公式，则需要variables，这里会在evaluate时抛出MissingVariableError
    }

    // 使用FormulaParser计算
    // 从缓存中获取解析后的公式
    let parsed = this.formulaCache.get(formula);
    
    // 如果缓存中没有，解析并缓存
    if (!parsed) {
      parsed = this.parser.parse(formula);
      this.formulaCache.set(formula, parsed);
    }
    
    // 计算结果
    const rawCost = parsed.compute(variables || {});
    
    // 如果结果为负数，返回0
    if (rawCost < 0) {
      return 0;
    }
    
    // 四舍五入到2位小数
    const finalCost = Math.round(rawCost * 100) / 100;
    
    return finalCost;
  }

  /**
   * 获取计算详情（用于记录到metadata）
   * 
   * 返回详细的计算信息，包括：
   * - 使用的公式（如果是动态的）
   * - 输入的变量
   * - 原始计算结果（未四舍五入）
   * - 最终成本（四舍五入后）
   * - 是否使用了动态公式
   * 
   * @param action - 操作名称
   * @param membershipTier - 会员等级
   * @param variables - 变量值映射
   * @returns 计算详情对象
   * @throws {UndefinedActionError} 当操作未定义时
   * 
   * @example
   * ```typescript
   * const details = formula.getCalculationDetails('ai-completion', null, { token: 3500 });
   * console.log(details);
   * // {
   * //   formula: '{token} * 0.001 + 10',
   * //   variables: { token: 3500 },
   * //   rawCost: 13.5,
   * //   finalCost: 13.5,
   * //   isDynamic: true
   * // }
   * ```
   */
  getCalculationDetails(
    action: string,
    membershipTier: string | null,
    variables?: Record<string, number>
  ): CalculationDetails {
    // 检查操作是否在配置中定义
    const actionConfig = this.dynamicCostConfig[action];
    
    if (!actionConfig) {
      throw new UndefinedActionError(action);
    }

    // 获取配置值
    let configValue: number | string;
    
    if (membershipTier && actionConfig[membershipTier] !== undefined) {
      configValue = actionConfig[membershipTier];
    } else {
      configValue = actionConfig.default;
    }

    // 如果是固定成本
    if (typeof configValue === 'number') {
      return {
        rawCost: configValue,
        finalCost: configValue,
        isDynamic: false
      };
    }

    // 如果是动态公式
    const formula = configValue;
    
    // 计算成本
    let rawCost: number;
    
    if (!variables || Object.keys(variables).length === 0) {
      // 如果未提供variables，使用default值
      if (typeof actionConfig.default === 'number') {
        rawCost = actionConfig.default;
      } else {
        // 如果default也是公式，尝试计算（可能会抛出错误）
        const parsed = this.formulaCache.get(formula) || this.parser.parse(formula);
        rawCost = parsed.compute({});
      }
    } else {
      // 使用公式计算
      const parsed = this.formulaCache.get(formula) || this.parser.parse(formula);
      rawCost = parsed.compute(variables);
    }
    
    // 处理负数
    if (rawCost < 0) {
      rawCost = 0;
    }
    
    // 四舍五入
    const finalCost = Math.round(rawCost * 100) / 100;
    
    return {
      formula,
      variables,
      rawCost,
      finalCost,
      isDynamic: true
    };
  }

  /**
   * 检查操作是否使用动态公式
   * 
   * @param action - 操作名称
   * @param membershipTier - 会员等级
   * @returns 是否使用动态公式
   * @throws {UndefinedActionError} 当操作未定义时
   * 
   * @example
   * ```typescript
   * const isDynamic1 = formula.isDynamic('generate-image', 'premium'); // false
   * const isDynamic2 = formula.isDynamic('ai-completion', null); // true
   * ```
   */
  isDynamic(action: string, membershipTier: string | null): boolean {
    // 检查操作是否在配置中定义
    const actionConfig = this.dynamicCostConfig[action];
    
    if (!actionConfig) {
      throw new UndefinedActionError(action);
    }

    // 获取配置值
    let configValue: number | string;
    
    if (membershipTier && actionConfig[membershipTier] !== undefined) {
      configValue = actionConfig[membershipTier];
    } else {
      configValue = actionConfig.default;
    }

    // 如果是字符串，说明是动态公式
    return typeof configValue === 'string';
  }
}

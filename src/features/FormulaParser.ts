/**
 * FormulaParser - 公式解析器
 * 负责解析、验证和执行数学公式，支持动态成本计算
 * 
 * ## 支持的功能
 * 
 * ### 变量占位符
 * 使用 `{variableName}` 格式定义变量，变量名必须：
 * - 以字母开头
 * - 只包含字母、数字和下划线
 * - 区分大小写
 * 
 * ### 运算符
 * - 算术运算符：`+` (加), `-` (减), `*` (乘), `/` (除)
 * - 括号：`(` `)` 用于控制运算优先级
 * - 三元运算符：`condition ? value1 : value2` 用于条件计算
 * - 比较运算符：`<`, `>`, `<=`, `>=`, `==`, `!=`
 * 
 * ### 数字常量
 * - 整数：`10`, `100`, `1000`
 * - 小数：`0.5`, `0.001`, `3.14`
 * - 负数：`-10`, `-0.5`
 * 
 * ## 使用场景
 * 
 * ### 1. Token 计费
 * ```typescript
 * const parser = new FormulaParser();
 * 
 * // 基础 token 计费：每 token 0.001 credit + 10 基础费用
 * const cost1 = parser.evaluate('{token} * 0.001 + 10', { token: 3500 });
 * console.log(cost1); // 13.5
 * 
 * // 会员折扣：premium 用户享受 20% 折扣
 * const cost2 = parser.evaluate('({token} * 0.001 + 10) * 0.8', { token: 3500 });
 * console.log(cost2); // 10.8
 * ```
 * 
 * ### 2. 阶梯计费
 * ```typescript
 * // 小于 1000 行：每行 0.1 credit
 * // 大于 1000 行：前 1000 行 100 credit，之后每行 0.05 credit
 * const formula = '{rows} <= 1000 ? {rows} * 0.1 : 100 + ({rows} - 1000) * 0.05';
 * 
 * const cost1 = parser.evaluate(formula, { rows: 500 });
 * console.log(cost1); // 50
 * 
 * const cost2 = parser.evaluate(formula, { rows: 2000 });
 * console.log(cost2); // 150
 * ```
 * 
 * ### 3. 多变量计费
 * ```typescript
 * // 视频处理：基于时长和分辨率
 * const formula = '{duration} * 2 + {resolution} * 0.5';
 * const cost = parser.evaluate(formula, { duration: 120, resolution: 1080 });
 * console.log(cost); // 780
 * ```
 * 
 * ### 4. 公式验证
 * ```typescript
 * // 验证有效公式
 * parser.validate('{token} * 0.5'); // 通过
 * 
 * // 验证无效公式
 * try {
 *   parser.validate('{token * 0.5'); // 括号不匹配
 * } catch (error) {
 *   console.error(error.message); // "Mismatched braces: unclosed opening braces"
 * }
 * 
 * try {
 *   parser.validate('{token-count} * 0.5'); // 变量名包含连字符
 * } catch (error) {
 *   console.error(error.message); // "Invalid variable name 'token-count'..."
 * }
 * ```
 * 
 * ## 错误处理
 * 
 * ### ConfigurationError
 * 公式语法无效时抛出：
 * - 括号不匹配
 * - 变量名不符合规范
 * - 包含非法字符
 * 
 * ### MissingVariableError
 * 计算时缺少必需变量：
 * ```typescript
 * try {
 *   parser.evaluate('{token} * 0.001', {}); // 缺少 token 变量
 * } catch (error) {
 *   console.error(error.message);
 *   // "Formula '{token} * 0.001' requires variable 'token', but only [] were provided"
 * }
 * ```
 * 
 * ### FormulaEvaluationError
 * 计算过程中发生错误：
 * - 除零错误
 * - 结果为 NaN 或 Infinity
 * - 其他运算错误
 * 
 * ```typescript
 * try {
 *   parser.evaluate('{amount} / {count}', { amount: 100, count: 0 });
 * } catch (error) {
 *   console.error(error.message);
 *   // "Failed to evaluate formula... resulted in Infinity (possible division by zero)"
 * }
 * ```
 * 
 * @see {@link DynamicCostFormula} 用于集成到成本计算系统
 * @see {@link MissingVariableError} 缺少变量错误
 * @see {@link FormulaEvaluationError} 公式计算错误
 * @see {@link ConfigurationError} 配置错误
 */

import { ConfigurationError, MissingVariableError, FormulaEvaluationError } from '../core/errors';

/**
 * 解析后的公式对象
 * 包含原始公式、提取的变量和编译后的计算函数
 */
export interface ParsedFormula {
  /** 原始公式字符串 */
  raw: string;
  /** 提取的变量名列表 */
  variables: string[];
  /** 编译后的计算函数 */
  compute: (variables: Record<string, number>) => number;
}

/**
 * 公式解析器类
 * 负责解析、验证和执行数学公式
 */
export class FormulaParser {
  /**
   * 变量名正则表达式
   * 匹配字母开头，后跟字母、数字或下划线
   */
  private readonly VARIABLE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

  /**
   * 变量占位符正则表达式
   * 匹配 {variableName} 格式
   */
  private readonly VARIABLE_PLACEHOLDER_PATTERN = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;

  /**
   * 创建一个新的 FormulaParser 实例
   */
  constructor() {}

  /**
   * 解析公式字符串
   * 
   * 解析过程：
   * 1. 验证公式语法
   * 2. 提取所有变量名
   * 3. 构建计算函数
   * 
   * @param formula - 公式字符串，如 "{token} * 0.5 + 100"
   * @returns 解析后的公式对象
   * @throws {ConfigurationError} 当公式语法无效时
   * 
   * @example
   * ```typescript
   * const parser = new FormulaParser();
   * const parsed = parser.parse('{token} * 0.001 + {duration} * 0.5');
   * console.log(parsed.variables); // ['token', 'duration']
   * console.log(parsed.raw); // '{token} * 0.001 + {duration} * 0.5'
   * const result = parsed.compute({ token: 1000, duration: 60 });
   * console.log(result); // 31
   * ```
   */
  parse(formula: string): ParsedFormula {
    // 验证公式语法
    this.validate(formula);

    // 提取变量名
    const variables = this.extractVariables(formula);

    // 构建计算函数
    const compute = this.buildComputeFunction(formula, variables);

    return {
      raw: formula,
      variables,
      compute
    };
  }

  /**
   * 验证公式语法
   * 
   * 验证规则：
   * 1. 公式不能为空
   * 2. 括号必须匹配
   * 3. 变量名必须符合命名规范
   * 4. 不能包含非法字符
   * 
   * @param formula - 公式字符串
   * @throws {ConfigurationError} 当公式语法无效时
   * 
   * @example
   * ```typescript
   * parser.validate('{token} * 0.5'); // 通过
   * parser.validate('{token * 0.5'); // 抛出错误：括号不匹配
   * parser.validate('{token-count} * 0.5'); // 抛出错误：变量名包含连字符
   * ```
   */
  validate(formula: string): void {
    // 1. 检查公式不能为空
    if (!formula || formula.trim().length === 0) {
      throw new ConfigurationError('Formula cannot be empty');
    }

    // 2. 检查括号匹配
    let bracketCount = 0;
    let braceCount = 0;
    
    for (let i = 0; i < formula.length; i++) {
      const char = formula[i];
      if (char === '(') bracketCount++;
      if (char === ')') bracketCount--;
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      
      // 括号计数不能为负（右括号多于左括号）
      if (bracketCount < 0) {
        throw new ConfigurationError('Mismatched parentheses: too many closing parentheses');
      }
      if (braceCount < 0) {
        throw new ConfigurationError('Mismatched braces: too many closing braces');
      }
    }
    
    // 最终括号必须匹配
    if (bracketCount !== 0) {
      throw new ConfigurationError('Mismatched parentheses: unclosed opening parentheses');
    }
    if (braceCount !== 0) {
      throw new ConfigurationError('Mismatched braces: unclosed opening braces');
    }

    // 3. 验证变量名规范
    // 提取所有变量占位符
    const placeholderPattern = /\{([^}]*)\}/g;
    let match;
    
    while ((match = placeholderPattern.exec(formula)) !== null) {
      const variableName = match[1];
      
      // 检查变量名是否为空
      if (!variableName || variableName.trim().length === 0) {
        throw new ConfigurationError('Variable name cannot be empty');
      }
      
      // 检查变量名是否符合命名规范
      if (!this.VARIABLE_NAME_PATTERN.test(variableName)) {
        throw new ConfigurationError(
          `Invalid variable name '${variableName}': must start with a letter and contain only letters, numbers, and underscores`
        );
      }
    }

    // 4. 检查非法字符
    // 允许的字符：数字、字母、下划线、运算符、括号、空格、小数点
    const allowedPattern = /^[a-zA-Z0-9_+\-*/(){}.\s?:<>=!&|]*$/;
    if (!allowedPattern.test(formula)) {
      throw new ConfigurationError('Formula contains invalid characters');
    }

    // 5. 尝试构建一个测试性的JavaScript表达式来验证语法
    // 将变量占位符替换为有效的数字，然后尝试创建函数
    const testFormula = formula.replace(this.VARIABLE_PLACEHOLDER_PATTERN, '1');
    try {
      // 使用 Function 构造函数测试语法
      new Function(`return ${testFormula}`);
    } catch (error) {
      throw new ConfigurationError(
        `Invalid formula syntax: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 提取公式中的变量名
   * 
   * @param formula - 公式字符串
   * @returns 变量名数组（去重）
   * 
   * @example
   * ```typescript
   * const vars1 = parser.extractVariables('{token} * 0.5 + {duration}');
   * console.log(vars1); // ['token', 'duration']
   * 
   * const vars2 = parser.extractVariables('{token} + {token} * 2');
   * console.log(vars2); // ['token'] (去重)
   * ```
   */
  extractVariables(formula: string): string[] {
    const variables = new Set<string>();
    const pattern = new RegExp(this.VARIABLE_PLACEHOLDER_PATTERN);
    let match;
    
    // 重置正则表达式的 lastIndex
    pattern.lastIndex = 0;
    
    while ((match = pattern.exec(formula)) !== null) {
      if (match[1]) {
        variables.add(match[1]);
      }
    }
    
    return Array.from(variables);
  }

  /**
   * 计算公式值
   * 
   * @param formula - 公式字符串
   * @param variables - 变量值映射
   * @returns 计算结果
   * @throws {MissingVariableError} 当缺少必需变量时
   * @throws {FormulaEvaluationError} 当计算出错时
   * 
   * @example
   * ```typescript
   * const result1 = parser.evaluate('{token} * 0.001', { token: 3500 });
   * console.log(result1); // 3.5
   * 
   * // 缺少变量
   * parser.evaluate('{token} * 0.001', {}); // 抛出 MissingVariableError
   * 
   * // 除零错误
   * parser.evaluate('{amount} / {count}', { amount: 100, count: 0 }); // 抛出 FormulaEvaluationError
   * ```
   */
  evaluate(formula: string, variables: Record<string, number>): number {
    // 解析公式
    const parsed = this.parse(formula);
    
    // 使用编译后的计算函数执行计算
    return parsed.compute(variables);
  }

  /**
   * 构建计算函数
   * 将公式字符串编译为可执行的函数
   * 
   * @param formula - 公式字符串
   * @param variables - 变量名列表
   * @returns 计算函数
   * @private
   */
  private buildComputeFunction(
    formula: string,
    variables: string[]
  ): (variables: Record<string, number>) => number {
    return (variableValues: Record<string, number>) => {
      // 检查所有必需的变量是否都提供了
      const providedVariables = Object.keys(variableValues);
      for (const variable of variables) {
        if (!(variable in variableValues)) {
          throw new MissingVariableError(formula, variable, providedVariables);
        }
      }

      // 将公式中的变量占位符替换为实际值
      let jsExpression = formula;
      for (const variable of variables) {
        const value = variableValues[variable];
        
        // 验证变量值是有效的数字
        if (typeof value !== 'number' || isNaN(value)) {
          throw new FormulaEvaluationError(
            formula,
            variableValues,
            `Variable '${variable}' has invalid value: ${value}`
          );
        }
        
        // 替换变量占位符为实际值
        // 使用全局替换确保所有出现的变量都被替换
        const placeholder = `{${variable}}`;
        jsExpression = jsExpression.split(placeholder).join(String(value));
      }

      // 执行计算
      try {
        // 使用 Function 构造函数创建并执行表达式
        const computeFn = new Function(`return ${jsExpression}`);
        const result = computeFn();
        
        // 检查结果是否有效
        if (typeof result !== 'number') {
          throw new FormulaEvaluationError(
            formula,
            variableValues,
            `Formula evaluation did not return a number: ${result}`
          );
        }
        
        if (isNaN(result)) {
          throw new FormulaEvaluationError(
            formula,
            variableValues,
            'Formula evaluation resulted in NaN'
          );
        }
        
        if (!isFinite(result)) {
          throw new FormulaEvaluationError(
            formula,
            variableValues,
            'Formula evaluation resulted in Infinity (possible division by zero)'
          );
        }
        
        return result;
      } catch (error) {
        // 如果是我们自己抛出的错误，直接重新抛出
        if (error instanceof MissingVariableError || error instanceof FormulaEvaluationError) {
          throw error;
        }
        
        // 其他错误包装为 FormulaEvaluationError
        throw new FormulaEvaluationError(
          formula,
          variableValues,
          error instanceof Error ? error.message : String(error)
        );
      }
    };
  }
}

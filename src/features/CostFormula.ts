/**
 * CostFormula - 成本计算模块
 * 根据操作和会员等级计算积分成本
 */

import { CostConfig } from '../core/types';
import { UndefinedActionError } from '../core/errors';

/**
 * 成本计算公式类
 * 负责根据操作名称和用户会员等级计算积分成本
 * 
 * @example
 * ```typescript
 * const costConfig = {
 *   'generate-post': {
 *     default: 10,
 *     premium: 8,
 *     enterprise: 5
 *   }
 * };
 * 
 * const formula = new CostFormula(costConfig);
 * const cost = formula.calculate('generate-post', 'premium'); // 返回 8
 * const defaultCost = formula.calculate('generate-post', null); // 返回 10
 * ```
 */
export class CostFormula {
  /**
   * 创建一个新的 CostFormula 实例
   * @param costConfig - 成本配置对象
   */
  constructor(private costConfig: CostConfig) {}

  /**
   * 根据操作和会员等级计算成本
   * 
   * 计算逻辑：
   * 1. 检查操作是否在配置中定义
   * 2. 如果有会员等级且该等级有特定定价，使用等级定价
   * 3. 否则使用默认成本
   * 
   * @param action - 操作名称 (如 'generate-post', 'generate-image')
   * @param membershipTier - 会员等级 (null 表示无会员)
   * @returns 积分成本
   * @throws {UndefinedActionError} 当操作没有定义成本时
   * 
   * @example
   * ```typescript
   * // 使用会员等级定价
   * const cost1 = formula.calculate('generate-post', 'premium'); // 8
   * 
   * // 使用默认定价
   * const cost2 = formula.calculate('generate-post', null); // 10
   * const cost3 = formula.calculate('generate-post', 'unknown-tier'); // 10
   * 
   * // 抛出错误
   * formula.calculate('undefined-action', null); // 抛出 UndefinedActionError
   * ```
   */
  calculate(action: string, membershipTier: string | null): number {
    // 检查操作是否在配置中定义
    const actionConfig = this.costConfig[action];
    
    if (!actionConfig) {
      throw new UndefinedActionError(action);
    }

    // 如果有会员等级且该等级有特定定价，使用等级定价
    if (membershipTier && actionConfig[membershipTier] !== undefined) {
      return actionConfig[membershipTier];
    }

    // 否则使用默认成本
    return actionConfig.default;
  }
}

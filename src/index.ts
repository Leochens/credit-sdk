/**
 * credit-sdk - 通用 SaaS 积分系统 SDK
 * 
 * 提供解耦的、事务感知的用户积分管理解决方案。
 * 
 * ## 核心特性
 * 
 * - **适配器模式**: 通过 IStorageAdapter 解耦存储层，支持任何数据库
 * - **事务透传**: 支持将 SDK 操作嵌入到更大的业务事务中
 * - **幂等性**: 防止重复扣费操作
 * - **重试机制**: 自动处理瞬态故障
 * - **审计日志**: 记录所有操作用于合规和调试
 * - **会员验证**: 基于会员等级的访问控制
 * - **成本计算**: 灵活的分层定价
 * 
 * ## 快速开始
 * 
 * ```typescript
 * import { CreditsEngine, PrismaAdapter } from 'credit-sdk';
 * import { PrismaClient } from '@prisma/client';
 * 
 * const prisma = new PrismaClient();
 * const adapter = new PrismaAdapter(prisma);
 * 
 * const engine = new CreditsEngine({
 *   storage: adapter,
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
 * 
 * ## 主要组件
 * 
 * - **CreditsEngine**: 主要服务类，提供所有积分操作
 * - **IStorageAdapter**: 存储适配器接口，用于实现自定义数据库集成
 * - **PrismaAdapter**: Prisma 的参考实现
 * - **MockAdapter**: 用于测试的内存实现
 * - **ILogAdapter**: 日志适配器接口，用于集成自定义日志系统
 * 
 * @packageDocumentation
 */

// 导出核心类型
export * from './core/types';

// 导出错误类
export * from './core/errors';

// 导出 CreditsEngine
export { CreditsEngine, CreditsEngineOptions } from './core/CreditsEngine';

// 导出适配器接口
export * from './adapters/IStorageAdapter';
export * from './adapters/ILogAdapter';

// 导出 Prisma 适配器
export { PrismaAdapter } from './adapters/PrismaAdapter';

// 导出 Mock 适配器（用于测试）
export { MockAdapter } from './adapters/MockAdapter';

// 导出特性模块
export * from './features';

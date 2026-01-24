# 本地开发调试指南

本指南说明如何在本地开发环境中调试 Credit SDK，并在其他项目中使用本地版本。

## 📋 目录

- [方法一：npm link（推荐）](#方法一npm-link推荐)
- [方法二：npm install 本地路径](#方法二npm-install-本地路径)
- [方法三：使用 yalc](#方法三使用-yalc)
- [开发工作流](#开发工作流)
- [故障排除](#故障排除)

## 方法一：npm link（推荐）

`npm link` 创建一个符号链接，让你的其他项目可以使用本地开发版本的 SDK。

### 步骤 1: 在 SDK 项目中构建并链接

```bash
# 进入 credit-sdk 目录
cd /path/to/credit-sdk

# 安装依赖
npm install

# 构建项目
npm run build

# 创建全局链接
npm link
```

这会在全局 npm 目录创建一个指向当前项目的符号链接。

### 步骤 2: 在你的项目中使用链接

```bash
# 进入你的项目目录
cd /path/to/your-project

# 链接到本地的 credit-sdk
npm link credit-sdk
```

### 步骤 3: 开始开发

现在你的项目会使用本地的 credit-sdk！

```typescript
// your-project/src/index.ts
import { CreditsEngine, PrismaAdapter } from 'credit-sdk';

// 使用的是本地开发版本
const engine = new CreditsEngine({ storage: adapter, config });
```

### 步骤 4: 实时更新

每次修改 SDK 代码后，重新构建：

```bash
# 在 credit-sdk 目录
npm run build
```

你的项目会自动使用最新的构建版本！

### 取消链接

完成开发后，取消链接：

```bash
# 在你的项目中
npm unlink credit-sdk

# 安装正式版本
npm install credit-sdk

# 在 SDK 项目中（可选）
npm unlink -g credit-sdk
```

## 方法二：npm install 本地路径

直接安装本地路径，不需要全局链接。

### 步骤 1: 构建 SDK

```bash
# 在 credit-sdk 目录
cd /path/to/credit-sdk
npm install
npm run build
```

### 步骤 2: 在项目中安装本地路径

```bash
# 在你的项目中
cd /path/to/your-project

# 使用相对路径或绝对路径
npm install ../credit-sdk
# 或
npm install /absolute/path/to/credit-sdk
```

### 步骤 3: 更新

每次修改 SDK 后：

```bash
# 1. 在 SDK 目录构建
cd /path/to/credit-sdk
npm run build

# 2. 在项目中重新安装
cd /path/to/your-project
npm install ../credit-sdk
```

### 优点和缺点

**优点：**
- ✅ 不需要全局链接
- ✅ 更接近真实安装

**缺点：**
- ❌ 每次更新需要重新安装
- ❌ 不是实时链接

## 方法三：使用 yalc

`yalc` 是 `npm link` 的更好替代品，解决了很多 npm link 的问题。

### 安装 yalc

```bash
npm install -g yalc
```

### 步骤 1: 在 SDK 中发布到本地

```bash
# 在 credit-sdk 目录
cd /path/to/credit-sdk
npm install
npm run build

# 发布到本地 yalc 仓库
yalc publish
```

### 步骤 2: 在项目中添加

```bash
# 在你的项目中
cd /path/to/your-project

# 添加本地版本
yalc add credit-sdk
```

### 步骤 3: 更新

每次修改 SDK 后：

```bash
# 在 SDK 目录
cd /path/to/credit-sdk
npm run build
yalc push  # 自动推送到所有使用它的项目
```

### 清理

```bash
# 在你的项目中
yalc remove credit-sdk
npm install credit-sdk
```

### 优点

- ✅ 比 npm link 更可靠
- ✅ 支持多个项目同时使用
- ✅ 自动推送更新
- ✅ 不会污染全局 npm

## 开发工作流

### 推荐工作流（使用 npm link）

#### 1. 初始设置

```bash
# Terminal 1: SDK 项目
cd /path/to/credit-sdk
npm install
npm run build
npm link

# Terminal 2: 你的项目
cd /path/to/your-project
npm link credit-sdk
```

#### 2. 开发循环

```bash
# Terminal 1: SDK 项目 - 监听模式
cd /path/to/credit-sdk
npm run build -- --watch  # 如果支持 watch 模式

# 或者手动构建
npm run build
```

```bash
# Terminal 2: 你的项目 - 开发服务器
cd /path/to/your-project
npm run dev
```

#### 3. 测试流程

```bash
# 在 SDK 项目中测试
cd /path/to/credit-sdk
npm test

# 在你的项目中测试集成
cd /path/to/your-project
npm test
```

### 添加 Watch 模式

为了更方便的开发，可以添加 watch 模式到 package.json：

```json
{
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "dev": "tsc --watch",
    "test": "vitest --run",
    "test:watch": "vitest"
  }
}
```

然后使用：

```bash
# 在 SDK 项目中
npm run dev  # 自动监听文件变化并重新构建
```

## 实际示例

### 示例：在 Next.js 项目中使用本地 SDK

#### 1. 设置链接

```bash
# Terminal 1: SDK
cd ~/projects/credit-sdk
npm install
npm run build
npm link

# Terminal 2: Next.js 项目
cd ~/projects/my-nextjs-app
npm link credit-sdk
```

#### 2. 在 Next.js 中使用

```typescript
// app/lib/credits.ts
import { CreditsEngine, PrismaAdapter } from 'credit-sdk';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const adapter = new PrismaAdapter(prisma);

export const engine = new CreditsEngine({
  storage: adapter,
  config: {
    costs: {
      'generate-post': { default: 10, premium: 8 }
    }
  }
});
```

```typescript
// app/actions/credits.ts
'use server';

import { engine } from '@/lib/credits';

export async function chargeCredits(userId: string) {
  const result = await engine.charge({
    userId,
    action: 'generate-post'
  });
  
  return result;
}
```

#### 3. 开发

```bash
# Terminal 1: SDK - 监听模式
cd ~/projects/credit-sdk
npm run dev

# Terminal 2: Next.js - 开发服务器
cd ~/projects/my-nextjs-app
npm run dev
```

现在修改 SDK 代码，Next.js 会自动使用最新版本！

### 示例：调试 SDK 代码

#### 添加调试日志

```typescript
// credit-sdk/src/core/CreditsEngine.ts
export class CreditsEngine {
  async charge(params: ChargeParams): Promise<ChargeResult> {
    console.log('[DEBUG] Charging credits:', params);  // 添加调试日志
    
    // ... 原有代码
    
    console.log('[DEBUG] Charge result:', result);
    return result;
  }
}
```

#### 重新构建

```bash
cd ~/projects/credit-sdk
npm run build
```

#### 在项目中查看日志

```bash
cd ~/projects/my-nextjs-app
npm run dev

# 在浏览器或终端中查看调试日志
```

## 故障排除

### 问题 1: 修改 SDK 后项目没有更新

**原因**: 没有重新构建 SDK

**解决方案**:
```bash
cd /path/to/credit-sdk
npm run build
```

或使用 watch 模式：
```bash
npm run dev  # 如果配置了 watch 模式
```

### 问题 2: TypeScript 类型定义不更新

**原因**: TypeScript 缓存了旧的类型定义

**解决方案**:
```bash
# 在你的项目中
rm -rf node_modules/.cache
npm run dev
```

或重启 TypeScript 服务器（VS Code）：
- 按 `Cmd/Ctrl + Shift + P`
- 输入 "TypeScript: Restart TS Server"

### 问题 3: npm link 后出现依赖冲突

**原因**: SDK 和项目使用了不同版本的依赖

**解决方案 1**: 使用 peerDependencies

在 SDK 的 package.json 中：
```json
{
  "peerDependencies": {
    "@prisma/client": "^7.0.0"
  },
  "devDependencies": {
    "@prisma/client": "^7.3.0"
  }
}
```

**解决方案 2**: 使用项目的依赖

```bash
# 在 SDK 目录
rm -rf node_modules
npm install --legacy-peer-deps
```

### 问题 4: 找不到模块

**原因**: 构建输出目录不正确

**解决方案**: 检查 package.json 和 tsconfig.json

```json
// package.json
{
  "main": "dist/index.js",
  "types": "dist/index.d.ts"
}
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "outDir": "./dist",
    "declaration": true
  }
}
```

### 问题 5: 热重载不工作

**原因**: 需要配置 watch 模式

**解决方案**: 添加 watch 脚本

```json
{
  "scripts": {
    "dev": "tsc --watch"
  }
}
```

## 最佳实践

### 1. 使用 Watch 模式

```bash
# 在 SDK 项目中始终使用 watch 模式
npm run dev
```

### 2. 版本控制

在开发时，在 package.json 中标记版本：

```json
{
  "version": "1.0.0-dev"
}
```

### 3. 测试驱动开发

```bash
# Terminal 1: SDK 测试
cd /path/to/credit-sdk
npm run test:watch

# Terminal 2: SDK 构建
npm run dev

# Terminal 3: 项目开发
cd /path/to/your-project
npm run dev
```

### 4. 使用 Git 分支

```bash
# 为新功能创建分支
git checkout -b feature/new-feature

# 开发完成后
git checkout main
npm run build
npm link
```

### 5. 文档同步

在开发新功能时，同时更新文档：

```bash
# 修改代码
vim src/core/CreditsEngine.ts

# 更新文档
vim docs/API_REFERENCE.md

# 构建和测试
npm run build
npm test
```

## 快速参考

### npm link 命令

```bash
# 在 SDK 项目中
npm link                    # 创建全局链接
npm unlink -g credit-sdk   # 删除全局链接

# 在使用项目中
npm link credit-sdk        # 链接到本地 SDK
npm unlink credit-sdk      # 取消链接
```

### yalc 命令

```bash
# 在 SDK 项目中
yalc publish              # 发布到本地
yalc push                 # 推送更新到所有项目

# 在使用项目中
yalc add credit-sdk       # 添加本地版本
yalc update               # 更新到最新版本
yalc remove credit-sdk    # 移除本地版本
```

### 常用工作流

```bash
# 开始开发
cd credit-sdk && npm run dev &
cd your-project && npm run dev

# 运行测试
cd credit-sdk && npm test

# 构建发布
cd credit-sdk && npm run build && npm test
```

## 相关资源

- [npm link 文档](https://docs.npmjs.com/cli/v8/commands/npm-link)
- [yalc GitHub](https://github.com/wclr/yalc)
- [TypeScript Watch 模式](https://www.typescriptlang.org/docs/handbook/compiler-options.html)

---

现在你可以轻松地在本地开发和调试 Credit SDK 了！推荐使用 **npm link** 配合 **watch 模式**获得最佳开发体验。

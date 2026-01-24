# 🚀 本地开发快速开始

## 最快方式（3 步）

### 1️⃣ 在 SDK 项目中设置

```bash
cd credit-sdk
npm install
npm run build
npm link
```

### 2️⃣ 在你的项目中链接

```bash
cd your-project
npm link credit-sdk
```

### 3️⃣ 开始开发

```bash
# Terminal 1: SDK 项目 - 自动重新构建
cd credit-sdk
npm run dev

# Terminal 2: 你的项目 - 开发服务器
cd your-project
npm run dev
```

## 使用辅助脚本（更简单）

### macOS/Linux

```bash
# 在 SDK 项目中
chmod +x scripts/link-local.sh
./scripts/link-local.sh

# 完成后取消链接
./scripts/unlink-local.sh
```

### Windows

```bash
# 在 SDK 项目中
scripts\link-local.bat

# 完成后取消链接
scripts\unlink-local.bat
```

## 在你的项目中使用

```typescript
// 导入本地开发版本
import { CreditsEngine, PrismaAdapter } from 'credit-sdk';

const engine = new CreditsEngine({
  storage: adapter,
  config: {
    costs: {
      'generate-post': { default: 10 }
    }
  }
});

// 使用
const result = await engine.charge({
  userId: 'user-123',
  action: 'generate-post'
});
```

## 完成开发后

### 在你的项目中

```bash
# 取消链接
npm unlink credit-sdk

# 安装正式版本
npm install credit-sdk
```

### 在 SDK 项目中（可选）

```bash
# 删除全局链接
npm unlink -g credit-sdk
```

## 常见问题

### Q: 修改代码后没有更新？

**A:** 确保运行了 `npm run build` 或使用 `npm run dev` 监听模式

### Q: TypeScript 类型没有更新？

**A:** 重启 TypeScript 服务器（VS Code: Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"）

### Q: 出现依赖冲突？

**A:** 在 SDK 项目中运行 `npm install --legacy-peer-deps`

## 更多信息

详细指南请查看 [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)

---

**提示**: 使用 `npm run dev` 启用自动重新构建，无需手动运行 `npm run build`！

#!/bin/bash

# 本地开发链接脚本
# 用法: ./scripts/link-local.sh

set -e

echo "🔗 Setting up local development for Credit SDK..."
echo ""

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo "✅ Dependencies installed"
    echo ""
fi

# 构建项目
echo "🔨 Building project..."
npm run build
echo "✅ Build complete"
echo ""

# 创建全局链接
echo "🔗 Creating global npm link..."
npm link
echo "✅ Global link created"
echo ""

echo "✨ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Go to your project directory:"
echo "      cd /path/to/your-project"
echo ""
echo "   2. Link to this local SDK:"
echo "      npm link credit-sdk"
echo ""
echo "   3. Start development with watch mode:"
echo "      npm run dev"
echo ""
echo "   4. In your project, import and use:"
echo "      import { CreditsEngine } from 'credit-sdk';"
echo ""
echo "💡 Tip: Run 'npm run dev' to enable watch mode for automatic rebuilds"
echo ""

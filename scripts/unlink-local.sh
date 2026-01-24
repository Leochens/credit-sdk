#!/bin/bash

# 取消本地开发链接脚本
# 用法: ./scripts/unlink-local.sh

set -e

echo "🔓 Unlinking Credit SDK from global npm..."
echo ""

# 取消全局链接
npm unlink -g credit-sdk 2>/dev/null || echo "⚠️  No global link found (this is okay)"

echo ""
echo "✅ Unlink complete!"
echo ""
echo "📝 To unlink from your project:"
echo "   1. Go to your project directory:"
echo "      cd /path/to/your-project"
echo ""
echo "   2. Unlink credit-sdk:"
echo "      npm unlink credit-sdk"
echo ""
echo "   3. Install the published version:"
echo "      npm install credit-sdk"
echo ""

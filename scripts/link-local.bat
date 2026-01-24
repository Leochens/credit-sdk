@echo off
REM 本地开发链接脚本 (Windows)
REM 用法: scripts\link-local.bat

echo 🔗 Setting up local development for Credit SDK...
echo.

REM 检查是否在正确的目录
if not exist "package.json" (
    echo ❌ Error: package.json not found. Please run this script from the project root.
    exit /b 1
)

REM 检查是否已安装依赖
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install
    echo ✅ Dependencies installed
    echo.
)

REM 构建项目
echo 🔨 Building project...
call npm run build
echo ✅ Build complete
echo.

REM 创建全局链接
echo 🔗 Creating global npm link...
call npm link
echo ✅ Global link created
echo.

echo ✨ Setup complete!
echo.
echo 📝 Next steps:
echo    1. Go to your project directory:
echo       cd C:\path\to\your-project
echo.
echo    2. Link to this local SDK:
echo       npm link credit-sdk
echo.
echo    3. Start development with watch mode:
echo       npm run dev
echo.
echo    4. In your project, import and use:
echo       import { CreditsEngine } from 'credit-sdk';
echo.
echo 💡 Tip: Run 'npm run dev' to enable watch mode for automatic rebuilds
echo.

pause

@echo off
REM 取消本地开发链接脚本 (Windows)
REM 用法: scripts\unlink-local.bat

echo 🔓 Unlinking Credit SDK from global npm...
echo.

REM 取消全局链接
call npm unlink -g credit-sdk 2>nul || echo ⚠️  No global link found (this is okay)

echo.
echo ✅ Unlink complete!
echo.
echo 📝 To unlink from your project:
echo    1. Go to your project directory:
echo       cd C:\path\to\your-project
echo.
echo    2. Unlink credit-sdk:
echo       npm unlink credit-sdk
echo.
echo    3. Install the published version:
echo       npm install credit-sdk
echo.

pause

@echo off
:: PWA同步服务器启动脚本（Windows版）
:: 用于自动启动本地服务器和Ngrok进行内网穿透

echo =========================================
echo PWA同步服务器启动脚本
 echo =========================================
echo.

:: 检查Node.js是否安装
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 错误：未安装Node.js
    echo    请先安装Node.js：https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 检查npm是否安装
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 错误：未安装npm
    echo    请先安装npm：https://www.npmjs.com/get-npm
    echo.
    pause
    exit /b 1
)

:: 检查Ngrok是否安装
where ngrok >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 错误：未安装Ngrok
    echo    请先安装Ngrok：https://ngrok.com/download
    echo.
    pause
    exit /b 1
)

echo ✅ 环境检查通过

echo.
echo =========================================
echo 1. 安装依赖
 echo =========================================

:: 安装依赖
npm install express cors
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 错误：安装依赖失败
    echo.
    pause
    exit /b 1
)

echo ✅ 依赖安装完成

echo.
echo =========================================
echo 2. 启动本地服务器
 echo =========================================

:: 启动本地服务器
start "PWA-Sync-Server" cmd /k "node server.js"

echo ✅ 本地服务器已启动（端口3000）

:: 等待服务器启动
timeout /t 3 /nobreak >nul

echo.
echo =========================================
echo 3. 启动Ngrok进行内网穿透
 echo =========================================

:: 启动Ngrok
start "Ngrok" cmd /k "ngrok http 3000"

echo ✅ Ngrok已启动

:: 等待Ngrok生成URL
timeout /t 3 /nobreak >nul

echo.
echo =========================================
echo 4. 使用说明
 echo =========================================
echo.
echo 📋 操作步骤：
echo 1. 等待Ngrok窗口出现，复制生成的HTTPS URL
echo 2. 在手机PWA应用中打开设置
 echo 3. 粘贴HTTPS URL到服务器地址字段
 echo 4. 点击保存，应用将自动同步数据
echo.
echo 📌 注意事项：
echo - 请保持此脚本和Ngrok窗口打开
echo - 每次启动Ngrok会生成新的URL
echo - 需要将新URL重新配置到PWA应用
 echo - 建议每天同一时间启动此脚本
echo.
echo 🆘 帮助：
echo - 本地服务器地址：http://localhost:3000
echo - 健康检查：http://localhost:3000/ping
echo - 数据端点：http://localhost:3000/data
echo - 同步端点：http://localhost:3000/sync
echo.
echo =========================================
echo 启动完成！
echo =========================================
echo.
echo 请查看Ngrok窗口获取公网URL
echo.
pause

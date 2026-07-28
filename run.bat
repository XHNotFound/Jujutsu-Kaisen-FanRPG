@echo off
chcp 65001 >nul
title 咒术回战同人游戏 - 启动器

:: 1. 检查核心文件是否存在（防止朋友解压不完整）
if not exist "python_env\python.exe" (
    echo [错误] 找不到 python_env\python.exe！
    echo 请确保解压了完整的文件夹，不要只复制了 bat 文件。
    pause
    exit /b
)

if not exist "index.html" (
    echo [错误] 找不到 index.html！请确保 bat 文件和游戏文件在同一目录。
    pause
    exit /b
)

echo ==========================================
echo   咒术回战同人游戏 启动中...
echo   正在初始化本地服务器，请稍候...
echo ==========================================
echo.

:: 2. 自动打开默认浏览器访问游戏
start http://127.0.0.1:8080

:: 3. 启动 HTTP 服务器（前台运行，保留窗口以显示日志和防止意外关闭）
python_env\python.exe -m http.server 8080

:: 4. 服务器停止后的提示
echo.
echo ==========================================
echo   服务器已停止。
echo   如果是意外崩溃，请向上查看报错信息。
echo ==========================================
pause
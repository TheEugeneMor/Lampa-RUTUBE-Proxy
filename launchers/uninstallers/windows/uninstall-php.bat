@echo off
chcp 65001 >nul
setlocal

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "LAUNCHERS_DIR=%%~fI"
set "PHP_DIR=%LAUNCHERS_DIR%\windows\php"

echo Lampa RUTUBE Proxy
echo Удаление portable PHP для Windows
echo.

if not exist "%PHP_DIR%" (
    echo Локальная папка PHP не найдена:
    echo   %PHP_DIR%
    echo.
    echo Удалять нечего.
    echo.
    pause
    exit /b 0
)

echo Будет удалена только локальная папка PHP:
echo   %PHP_DIR%
echo.
echo Системный PHP и Microsoft Visual C++ Redistributable не удаляются.
echo.
choice /C YN /M "Удалить локальный PHP?"
if errorlevel 2 (
    echo.
    echo Отменено.
    pause
    exit /b 0
)

rmdir /s /q "%PHP_DIR%"
if exist "%PHP_DIR%" (
    echo.
    echo Не удалось удалить папку PHP. Закройте запущенный сервер и попробуйте еще раз.
    echo.
    pause
    exit /b 1
)

echo.
echo Локальный PHP удален.
echo.
pause

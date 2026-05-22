@echo off
chcp 65001 >nul
setlocal

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "PROJECT_ROOT=%%~fI"
set "SERVER_DIR=%PROJECT_ROOT%\server"
set "PORT=8787"
set "PHP_EXE="
set "PHP_INI="

cd /d "%PROJECT_ROOT%"

call :find_php

if not defined PHP_EXE (
    echo PHP не найден. Устанавливаю portable PHP в папку launchers\windows\php...
    echo.
    powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%setup-php.ps1"
    if errorlevel 1 (
        echo.
        echo Не удалось установить portable PHP.
        echo Проверьте подключение к интернету и запустите этот файл еще раз.
        echo.
        pause
        exit /b 1
    )

    set "PHP_EXE="
    set "PHP_INI="
    call :find_php
)

if not defined PHP_EXE (
    echo Установка PHP завершилась, но php.exe не найден.
    echo Ожидаемый файл:
    echo   %SCRIPT_DIR%php\php.exe
    echo.
    pause
    exit /b 1
)

goto :start_server

:find_php
if exist "%SCRIPT_DIR%php\php.exe" (
    set "PHP_EXE=%SCRIPT_DIR%php\php.exe"
    set "PHP_INI=%SCRIPT_DIR%php\php.ini"
) else (
    for /f "delims=" %%P in ('where php 2^>nul') do (
        if not defined PHP_EXE set "PHP_EXE=%%P"
    )
)
exit /b 0

:start_server
echo Lampa RUTUBE Proxy
echo Автор: Eugene Pchelnikov
echo Связь в Telegram: https://t.me/eugenemor
echo.
echo PHP: %PHP_EXE%
echo.
echo Запускаю сервер...
echo.
echo URL для подключения в Lampa:
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ips = @(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -ExpandProperty IPAddress); if ($ips.Count) { $ips | ForEach-Object { '  http://' + $_ + ':%PORT%/plugin.php' } } else { '  Не удалось найти локальный IP. Проверьте подключение к сети.' }"
echo.
echo Что нужно сделать:
echo 1. Откройте Lampa.
echo 2. Перейдите в настройки плагинов.
echo 3. Вставьте один из URL выше.
echo.
echo Если адресов несколько, обычно нужен тот, который начинается на 192.168, 10 или 172.
echo.
echo Важно: не закрывайте это окно, пока смотрите видео.
echo Чтобы остановить сервер, закройте окно или нажмите Ctrl+C.
echo.

if defined PHP_INI (
    "%PHP_EXE%" -c "%PHP_INI%" -S 0.0.0.0:%PORT% -t "%SERVER_DIR%" "%SERVER_DIR%\router.php" 2>nul
) else (
    "%PHP_EXE%" -S 0.0.0.0:%PORT% -t "%SERVER_DIR%" "%SERVER_DIR%\router.php" 2>nul
)

pause

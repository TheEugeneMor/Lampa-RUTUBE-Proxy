@echo off
chcp 866 >nul
setlocal

cd /d "%~dp0"
set "PORT=8787"
set "PHP_EXE="
set "PHP_INI="

call :find_php

if not defined PHP_EXE (
    echo PHP не найден. Сейчас установлю portable PHP в эту папку...
    echo.
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-php.ps1"
    if errorlevel 1 (
        echo.
        echo Не удалось установить portable PHP.
        echo Проверьте подключение к интернету и запустите start.bat еще раз.
        echo.
        pause
        exit /b 1
    )

    set "PHP_EXE="
    set "PHP_INI="
    call :find_php
)

if not defined PHP_EXE (
    echo Установка PHP завершилась, но файл php.exe не найден.
    echo Ожидался файл:
    echo   %~dp0php\php.exe
    echo.
    pause
    exit /b 1
)

goto :start_server

:find_php
if exist "%~dp0php\php.exe" (
    set "PHP_EXE=%~dp0php\php.exe"
    set "PHP_INI=%~dp0php\php.ini"
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
echo Запускаю сервер...
echo.
echo Адрес для добавления в Lampa:
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ips = @(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -ExpandProperty IPAddress); if ($ips.Count) { $ips | ForEach-Object { '  http://' + $_ + ':%PORT%/rutube-cors.js' } } else { '  Не удалось найти локальный IP. Проверьте подключение к сети.' }"
echo.
echo Что делать дальше:
echo 1. Откройте Lampa.
echo 2. Перейдите в настройки плагинов.
echo 3. Добавьте адрес выше.
echo.
echo Если адресов несколько, обычно нужен тот, который начинается на 192.168, 10 или 172.
echo.
echo ВАЖНО: не закрывайте это окно, пока смотрите видео.
echo Чтобы остановить сервер, закройте это окно или нажмите Ctrl+C.
echo.

if defined PHP_INI (
    "%PHP_EXE%" -c "%PHP_INI%" -S 0.0.0.0:%PORT% -t "%~dp0server" "%~dp0server\router.php" 2>nul
) else (
    "%PHP_EXE%" -S 0.0.0.0:%PORT% -t "%~dp0server" "%~dp0server\router.php" 2>nul
)

pause

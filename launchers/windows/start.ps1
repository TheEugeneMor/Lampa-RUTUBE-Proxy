$ErrorActionPreference = 'Stop'

trap {
    Write-Host
    Write-Host "Ошибка: $($_.Exception.Message)"
    Write-Host
    Read-Host 'Нажмите Enter, чтобы закрыть окно'
    exit 1
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir '..\..')
$serverDir = Join-Path $projectRoot 'server'
$port = 8787
$phpExe = $env:PHP_EXE
$phpIni = $null

function Find-Php {
    if ($phpExe -and (Test-Path $phpExe)) {
        return $phpExe
    }

    $portable = Join-Path $scriptDir 'php\php.exe'
    if (Test-Path $portable) {
        $script:phpIni = Join-Path $scriptDir 'php\php.ini'
        return $portable
    }

    $fromPath = Get-Command php -ErrorAction SilentlyContinue
    if ($fromPath) {
        return $fromPath.Source
    }

    return $null
}

function Get-PhpVersionId($path) {
    try {
        return [int](& $path -r 'echo PHP_VERSION_ID;' 2>$null)
    } catch {
        return 0
    }
}

function Install-PortablePhp {
    Write-Host 'PHP не найден или версия ниже 8.1. Устанавливаю portable PHP...'
    Write-Host
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $scriptDir 'setup-php.ps1')
    if ($LASTEXITCODE -ne 0) {
        throw 'Не удалось установить portable PHP.'
    }
}

Set-Location $projectRoot

$phpExe = Find-Php
if (-not $phpExe) {
    Install-PortablePhp
    $phpExe = Find-Php
}

if (-not $phpExe) {
    throw 'PHP не найден после установки.'
}

$versionId = Get-PhpVersionId $phpExe
if ($versionId -lt 80100) {
    Install-PortablePhp
    $phpExe = Find-Php
    $versionId = Get-PhpVersionId $phpExe
}

if (-not $phpExe -or $versionId -lt 80100) {
    throw 'PHP 8.1 или новее не найден.'
}

$missingExtensions = @()
foreach ($extension in @('curl', 'openssl')) {
    $modules = & $phpExe -m 2>$null
    if ($modules -notcontains $extension) {
        $missingExtensions += $extension
    }
}

Write-Host 'Lampa RUTUBE Proxy'
Write-Host 'Автор: Eugene Pchelnikov'
Write-Host 'Связь в Telegram: https://t.me/eugenemor'
Write-Host
Write-Host "PHP: $phpExe"
Write-Host

if ($missingExtensions.Count -gt 0) {
    Write-Host "Предупреждение: не найдены расширения PHP: $($missingExtensions -join ', ')"
    Write-Host 'Без них поиск или получение HLS-ссылок может работать некорректно.'
    Write-Host
}

Write-Host 'Запускаю сервер...'
Write-Host
Write-Host 'URL для подключения в Lampa:'

$ips = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
    Select-Object -ExpandProperty IPAddress

if ($ips) {
    foreach ($ip in $ips) {
        Write-Host "  http://$ip`:$port/rt.php"
    }
} else {
    Write-Host '  Не удалось найти локальный IP. Проверьте подключение к сети.'
}

Write-Host
Write-Host 'Что нужно сделать:'
Write-Host '1. Откройте Lampa.'
Write-Host '2. Перейдите в настройки плагинов.'
Write-Host '3. Вставьте один из URL выше.'
Write-Host
Write-Host 'Если адресов несколько, обычно нужен тот, который начинается на 192.168, 10 или 172.'
Write-Host
Write-Host 'Важно: не закрывайте это окно, пока смотрите видео.'
Write-Host 'Чтобы остановить сервер, закройте окно или нажмите Ctrl+C.'
Write-Host

if ($phpIni -and (Test-Path $phpIni)) {
    & $phpExe -c $phpIni -S "0.0.0.0:$port" -t $serverDir (Join-Path $serverDir 'router.php')
} else {
    & $phpExe -S "0.0.0.0:$port" -t $serverDir (Join-Path $serverDir 'router.php')
}

Write-Host
Write-Host 'Сервер остановился. Если это произошло сразу, проверьте сообщение об ошибке выше.'
Write-Host "Частая причина: порт $port уже занят другой программой."
Write-Host
Read-Host 'Нажмите Enter, чтобы закрыть окно'

$ErrorActionPreference = 'Stop'

Write-Host 'Lampa RUTUBE Proxy'
Write-Host 'Автор: Eugene Pchelnikov'
Write-Host 'Связь в Telegram: https://t.me/eugenemor'
Write-Host ''

$launcherDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$phpDir = Join-Path $launcherDir 'php'
$zipPath = Join-Path $env:TEMP 'lampa-rutube-php.zip'
$vcRedistPath = Join-Path $env:TEMP 'lampa-rutube-vc-redist-x64.exe'

function Ensure-VcRuntime {
    $system32 = Join-Path $env:WINDIR 'System32'
    $requiredDlls = @(
        'vcruntime140.dll',
        'vcruntime140_1.dll',
        'msvcp140.dll'
    )

    $missing = $requiredDlls | Where-Object { -not (Test-Path (Join-Path $system32 $_)) }

    if (-not $missing) {
        return
    }

    Write-Host 'Устанавливаю Microsoft Visual C++ Redistributable x64...'
    Invoke-WebRequest -UseBasicParsing -Uri 'https://aka.ms/vs/17/release/vc_redist.x64.exe' -OutFile $vcRedistPath
    $process = Start-Process -FilePath $vcRedistPath -ArgumentList '/install', '/quiet', '/norestart' -Wait -PassThru

    if ($process.ExitCode -ne 0 -and $process.ExitCode -ne 3010) {
        throw "Установщик Visual C++ Redistributable завершился с кодом $($process.ExitCode)."
    }

    Remove-Item -LiteralPath $vcRedistPath -Force -ErrorAction SilentlyContinue
}

if (Test-Path (Join-Path $phpDir 'php.exe')) {
    Write-Host "Portable PHP уже установлен: $phpDir"
    Ensure-VcRuntime
    exit 0
}

Ensure-VcRuntime

Write-Host 'Ищу последний официальный пакет PHP для Windows...'
$downloadPage = Invoke-WebRequest -UseBasicParsing -Uri 'https://windows.php.net/download/'
$matches = [regex]::Matches($downloadPage.Content, 'href="([^"]*php-8\.\d+\.\d+-nts-Win32-vs17-x64\.zip)"')
$zipUrl = $matches |
    ForEach-Object { $_.Groups[1].Value } |
    Select-Object -First 1

if (-not $zipUrl) {
    throw 'Не удалось найти ссылку на PHP x64 NTS ZIP на windows.php.net.'
}

if ($zipUrl -like '//*') {
    $zipUrl = 'https:' + $zipUrl
} elseif ($zipUrl -notmatch '^https?://') {
    $zipUrl = 'https://windows.php.net' + $zipUrl
}

Write-Host "Скачиваю $zipUrl"
Invoke-WebRequest -UseBasicParsing -Uri $zipUrl -OutFile $zipPath

if (Test-Path $phpDir) {
    Remove-Item -LiteralPath $phpDir -Recurse -Force
}

New-Item -ItemType Directory -Path $phpDir | Out-Null
Expand-Archive -LiteralPath $zipPath -DestinationPath $phpDir -Force
Remove-Item -LiteralPath $zipPath -Force

$ini = @"
extension_dir = "ext"
extension = curl
extension = openssl
allow_url_fopen = On
memory_limit = 256M
max_execution_time = 0
default_socket_timeout = 60
"@

Set-Content -LiteralPath (Join-Path $phpDir 'php.ini') -Value $ini -Encoding ASCII

& (Join-Path $phpDir 'php.exe') -c (Join-Path $phpDir 'php.ini') -v | Out-Null

if ($LASTEXITCODE -ne 0) {
    throw "Portable PHP установлен, но php.exe не запустился. Код: $LASTEXITCODE."
}

Write-Host "Portable PHP установлен: $phpDir"

<?php
declare(strict_types=1);

function status_base_url(): string
{
    $scheme = 'http';

    if (
        (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower((string)$_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https')
    ) {
        $scheme = 'https';
    }

    $host = (string)($_SERVER['HTTP_HOST'] ?? 'localhost:8787');
    $path = rtrim(str_replace('\\', '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/'))), '/');

    return $scheme . '://' . $host . ($path === '' ? '' : $path) . '/';
}

$baseUrl = status_base_url();
$pluginUrl = $baseUrl . 'rt.js';

header('Content-Type: text/html; charset=utf-8');
header('Access-Control-Allow-Origin: *');
?>
<!doctype html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Lampa RUTUBE Proxy</title>
    <style>
        body { margin: 0; font: 16px/1.5 Arial, sans-serif; color: #f4f4f5; background: #18181b; }
        main { max-width: 760px; margin: 0 auto; padding: 48px 24px; }
        h1 { margin: 0 0 16px; font-size: 30px; }
        p { margin: 0 0 18px; color: #d4d4d8; }
        a { color: #93c5fd; }
        code { display: block; padding: 14px 16px; margin: 12px 0 22px; overflow-wrap: anywhere; color: #fff; background: #27272a; border: 1px solid #3f3f46; border-radius: 6px; }
        .ok { color: #86efac; font-weight: 700; }
        .author { margin-top: 30px; padding-top: 18px; border-top: 1px solid #3f3f46; color: #a1a1aa; }
    </style>
</head>
<body>
<main>
    <h1>Lampa RUTUBE Proxy</h1>
    <p class="ok">Сервер запущен.</p>
    <p>Добавьте этот адрес как плагин в Lampa:</p>
    <code><?= htmlspecialchars($pluginUrl, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') ?></code>
    <p>Поиск и HLS-потоки будут проходить через эту машину и ее сеть.</p>
    <p class="author">Автор: Eugene Pchelnikov. Связь в Telegram: <a href="https://t.me/eugenemor">@eugenemor</a>.</p>
</main>
</body>
</html>

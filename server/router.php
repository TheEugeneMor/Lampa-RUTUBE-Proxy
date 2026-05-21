<?php
declare(strict_types=1);

$path = parse_url((string)($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
$path = '/' . ltrim((string)$path, '/');

$routes = [
    '/rt.js' => __DIR__ . '/plugin.php',
    '/rutube-cors.js' => __DIR__ . '/plugin.php',
    '/plugin.js' => __DIR__ . '/plugin.php',
    '/proxy.php' => __DIR__ . '/proxy.php',
    '/stream.php' => __DIR__ . '/stream.php',
    '/hls-proxy.m3u8' => __DIR__ . '/hls.php',
    '/hls.php' => __DIR__ . '/hls.php',
];

if (isset($routes[$path])) {
    require $routes[$path];
    return true;
}

if ($path === '/' || $path === '/index.html') {
    require __DIR__ . '/status.php';
    return true;
}

$file = __DIR__ . $path;

if (is_file($file)) {
    return false;
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo 'Not found';

return true;

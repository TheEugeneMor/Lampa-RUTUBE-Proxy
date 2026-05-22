<?php
declare(strict_types=1);

$route = trim((string)($_GET['route'] ?? ''));

if ($route === '') {
    require __DIR__ . '/status.php';
    exit;
}

define('LAMPA_ROUTE_ENTRY', true);

$routes = [
    'proxy' => __DIR__ . '/proxy.php',
    'stream' => __DIR__ . '/stream.php',
    'hls' => __DIR__ . '/hls.php',
];

if (isset($routes[$route])) {
    require $routes[$route];
    exit;
}

http_response_code(404);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
echo json_encode([
    'ok' => false,
    'error' => 'Route not found',
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

<?php
declare(strict_types=1);

$pluginFile = __DIR__ . '/rt.js';

header('Content-Type: application/javascript; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Range');
header('Cache-Control: no-cache, no-store, must-revalidate');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

if (!is_file($pluginFile)) {
    http_response_code(404);
    echo 'console.error("RUTUBE plugin file not found");';
    exit;
}

header('Content-Length: ' . filesize($pluginFile));
readfile($pluginFile);

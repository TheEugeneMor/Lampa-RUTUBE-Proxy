<?php
declare(strict_types=1);

header('Content-Type: application/javascript; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Range');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Content-Length: ' . filesize(__DIR__ . '/plugin.js'));

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

readfile(__DIR__ . '/plugin.js');

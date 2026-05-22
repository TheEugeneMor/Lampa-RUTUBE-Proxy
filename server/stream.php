<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-cache, no-store, must-revalidate');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$id = trim((string)($_GET['id'] ?? ''));

if ($id === '' || !preg_match('/^[a-f0-9]{32}$/i', $id)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid video id'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function rutube_stream_get(string $url): array
{
    if (!function_exists('curl_init')) {
        $context = stream_context_create([
            'http' => [
                'timeout' => 16,
                'header' => "Accept: application/json\r\nReferer: https://rutube.ru/video/" . rawurlencode($GLOBALS['id']) . "/\r\nUser-Agent: Mozilla/5.0 (compatible; LampaRutubePlugin/1.0)\r\n",
            ],
        ]);
        $body = @file_get_contents($url, false, $context);
        $code = 0;
        $headers = function_exists('http_get_last_response_headers') ? http_get_last_response_headers() : [];

        foreach ($headers as $header) {
            if (preg_match('/\s(\d{3})\s/', $header, $match)) {
                $code = (int)$match[1];
                break;
            }
        }

        return [$code, is_string($body) ? $body : '', $body === false ? 'Request failed' : ''];
    }

    $curl = curl_init($url);

    if ($curl === false) return [0, '', 'curl_init failed'];

    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 16,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'Referer: https://rutube.ru/video/' . rawurlencode($GLOBALS['id']) . '/',
            'User-Agent: Mozilla/5.0 (compatible; LampaRutubePlugin/1.0)',
        ],
    ]);

    $body = curl_exec($curl);
    $code = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $error = curl_error($curl);

    return [$code, is_string($body) ? $body : '', $error];
}

function base64url_encode_string(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function public_base_url(): string
{
    $scheme = 'http';

    if (
        (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower((string)$_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https')
    ) {
        $scheme = 'https';
    }

    $host = (string)($_SERVER['HTTP_HOST'] ?? '127.0.0.1');
    $path = rtrim(str_replace('\\', '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/'))), '/');

    return $scheme . '://' . $host . ($path === '' ? '' : $path) . '/';
}

$url = 'https://rutube.ru/api/play/options/' . rawurlencode($id) . '/?format=json';
[$code, $body, $requestError] = rutube_stream_get($url);
$data = json_decode($body, true);

if ($code < 200 || $code >= 300 || !is_array($data)) {
    http_response_code(502);
    echo json_encode([
        'ok' => false,
        'error' => $requestError !== '' ? $requestError : 'Rutube play options request failed',
        'status' => $code,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$allowed = (bool)($data['acl_access']['allowed'] ?? true);
$stream = (string)($data['video_balancer']['m3u8'] ?? $data['video_balancer']['default'] ?? '');

if (!$allowed || $stream === '') {
    http_response_code(404);
    echo json_encode([
        'ok' => false,
        'error' => (string)($data['acl_access']['err_text'] ?? 'Stream is not available'),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

echo json_encode([
    'ok' => true,
    'id' => $id,
    'url' => public_base_url() . 'hls.php?url=' . rawurlencode(base64url_encode_string($stream)),
    'source_url' => $stream,
    'type' => 'hls',
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

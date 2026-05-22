<?php
declare(strict_types=1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Range');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

function fail_hls(int $code, string $message): void
{
    http_response_code($code);
    header('Content-Type: text/plain; charset=utf-8');
    echo $message;
    exit;
}

function base64url_decode_string(string $value): string
{
    $value = strtr($value, '-_', '+/');
    $pad = strlen($value) % 4;

    if ($pad) $value .= str_repeat('=', 4 - $pad);

    $decoded = base64_decode($value, true);

    return is_string($decoded) ? $decoded : '';
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

function allowed_hls_url(string $url): bool
{
    $parts = parse_url($url);
    $host = strtolower((string)($parts['host'] ?? ''));
    $scheme = strtolower((string)($parts['scheme'] ?? ''));

    if ($scheme !== 'https') return false;

    return $host === 'bl.rutube.ru'
        || substr($host, -10) === '.rutube.ru'
        || substr($host, -10) === '.rtbcdn.ru';
}

function absolutize_url(string $base, string $path): string
{
    if (preg_match('#^https?://#i', $path)) return $path;

    $baseParts = parse_url($base);
    $scheme = (string)($baseParts['scheme'] ?? 'https');
    $host = (string)($baseParts['host'] ?? '');
    $basePath = (string)($baseParts['path'] ?? '/');

    if (strpos($path, '/') === 0) return $scheme . '://' . $host . $path;

    $dir = preg_replace('#/[^/]*$#', '/', $basePath);

    return $scheme . '://' . $host . $dir . $path;
}

function fetch_hls_url(string $url): array
{
    $headers = [
        'Accept: */*',
        'Referer: https://rutube.ru/',
        'User-Agent: Mozilla/5.0 (compatible; LampaRutubePlugin/1.0)',
    ];

    if (!empty($_SERVER['HTTP_RANGE'])) {
        $headers[] = 'Range: ' . $_SERVER['HTTP_RANGE'];
    }

    if (!function_exists('curl_init')) {
        $context = stream_context_create([
            'http' => [
                'timeout' => 60,
                'ignore_errors' => true,
                'header' => implode("\r\n", $headers) . "\r\n",
            ],
        ]);
        $body = @file_get_contents($url, false, $context);
        $code = 0;
        $contentType = '';
        $headers = function_exists('http_get_last_response_headers') ? http_get_last_response_headers() : [];

        foreach ($headers as $header) {
            if ($code === 0 && preg_match('/\s(\d{3})\s/', $header, $match)) {
                $code = (int)$match[1];
            }

            if (stripos($header, 'Content-Type:') === 0) {
                $contentType = trim(substr($header, 13));
            }
        }

        return [$code, is_string($body) ? $body : '', $contentType, $body === false ? 'Request failed' : ''];
    }

    $curl = curl_init($url);

    if ($curl === false) return [0, '', '', 'curl_init failed'];

    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_HEADER => true,
    ]);

    $response = curl_exec($curl);
    $code = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $contentType = (string)curl_getinfo($curl, CURLINFO_CONTENT_TYPE);
    $headerSize = (int)curl_getinfo($curl, CURLINFO_HEADER_SIZE);
    $error = curl_error($curl);

    if (!is_string($response)) return [$code, '', $contentType, $error];

    return [$code, substr($response, $headerSize), $contentType, $error];
}

function proxied_url(string $url): string
{
    $encoded = rawurlencode(base64url_encode_string($url));
    $marker = stripos((string)parse_url($url, PHP_URL_PATH), '.m3u8') !== false
        ? 'playlist=stream.m3u8'
        : 'segment=chunk.ts';

    return public_base_url() . 'hls.php?' . $marker . '&url=' . $encoded;
}

function rewrite_playlist(string $body, string $baseUrl): string
{
    $lines = preg_split("/(\r\n|\n|\r)/", $body);
    $result = [];

    foreach ($lines as $line) {
        $trim = trim((string)$line);

        if ($trim === '') {
            $result[] = $line;
            continue;
        }

        if (strpos($trim, '#') === 0) {
            $result[] = preg_replace_callback('/URI="([^"]+)"/', function (array $match) use ($baseUrl): string {
                $absolute = absolutize_url($baseUrl, $match[1]);

                if (!allowed_hls_url($absolute)) {
                    return $match[0];
                }

                return 'URI="' . proxied_url($absolute) . '"';
            }, $line);
            continue;
        }

        $absolute = absolutize_url($baseUrl, $trim);
        $result[] = allowed_hls_url($absolute) ? proxied_url($absolute) : $line;
    }

    return implode("\n", $result);
}

$url = base64url_decode_string((string)($_GET['url'] ?? ''));

if ($url === '' || !allowed_hls_url($url)) fail_hls(400, 'Invalid HLS URL');

[$code, $body, $contentType, $error] = fetch_hls_url($url);

if ($code < 200 || $code >= 300 || $body === '') {
    fail_hls(502, $error !== '' ? $error : 'HLS request failed');
}

$isPlaylist = stripos($contentType, 'mpegurl') !== false
    || stripos($url, '.m3u8') !== false
    || strncmp($body, '#EXTM3U', 7) === 0;

if ($isPlaylist) {
    $body = rewrite_playlist($body, $url);
    header('Content-Type: application/vnd.apple.mpegurl; charset=utf-8');
    header('Content-Length: ' . strlen($body));
    echo $body;
    exit;
}

header('Content-Type: ' . ($contentType !== '' ? $contentType : 'video/mp2t'));
header('Content-Length: ' . strlen($body));
echo $body;

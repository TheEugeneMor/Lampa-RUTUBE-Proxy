<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$query = trim((string)($_GET['q'] ?? ''));
$page = max(1, min(10, (int)($_GET['page'] ?? 1)));

if ($query === '') {
    echo json_encode([
        'ok' => false,
        'error' => 'Empty query',
        'results' => [],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function rutube_http_get(string $url): array
{
    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_TIMEOUT => 16,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => 0,
            CURLOPT_HTTPHEADER => [
                'Accept: application/json',
                'User-Agent: Mozilla/5.0 (compatible; LampaRutubePlugin/1.0)',
            ],
        ]);

        $body = curl_exec($curl);
        $code = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        $error = curl_error($curl);

        return [$code, is_string($body) ? $body : '', $error];
    }

    $context = stream_context_create([
        'http' => [
            'timeout' => 16,
            'header' => "Accept: application/json\r\nUser-Agent: Mozilla/5.0 (compatible; LampaRutubePlugin/1.0)\r\n",
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

function normalize_url(?string $url): string
{
    $url = trim((string)$url);

    if ($url === '') {
        return '';
    }

    if (strpos($url, '//') === 0) {
        return 'https:' . $url;
    }

    if (strpos($url, 'http://') === 0) {
        return 'https://' . substr($url, 7);
    }

    return $url;
}

function normalize_video(array $video): ?array
{
    $id = trim((string)($video['id'] ?? ''));

    if ($id === '') {
        return null;
    }

    $author = $video['author'] ?? [];
    $authorName = '';

    if (is_array($author)) {
        $authorName = (string)($author['name'] ?? $author['title'] ?? $author['username'] ?? '');
    }

    if ($authorName === '') {
        $authorName = (string)($video['aname'] ?? '');
    }

    return [
        'id' => $id,
        'title' => trim((string)($video['title'] ?? 'RUTUBE video')),
        'description' => trim(strip_tags((string)($video['description'] ?? ''))),
        'duration' => (int)($video['duration'] ?? 0),
        'views' => (int)($video['views'] ?? 0),
        'thumbnail' => normalize_url($video['thumbnail_url'] ?? $video['thumbnail'] ?? ''),
        'author' => trim($authorName),
        'created' => (string)($video['created_ts'] ?? ''),
        'url' => 'https://rutube.ru/video/' . $id . '/',
        'embed_url' => 'https://rutube.ru/play/embed/' . $id,
    ];
}

$url = 'https://rutube.ru/api/search/video/?order_by=rank&format=json&no_adult=checked'
    . '&query=' . rawurlencode($query)
    . '&page=' . $page;

[$code, $body, $requestError] = rutube_http_get($url);
$data = json_decode($body, true);

if ($code < 200 || $code >= 300 || !is_array($data)) {
    http_response_code(502);
    echo json_encode([
        'ok' => false,
        'error' => $requestError !== '' ? $requestError : 'Rutube API request failed',
        'status' => $code,
        'results' => [],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$results = [];

foreach (($data['results'] ?? []) as $video) {
    if (!is_array($video)) {
        continue;
    }

    $normalized = normalize_video($video);

    if ($normalized !== null) {
        $results[] = $normalized;
    }
}

echo json_encode([
    'ok' => true,
    'query' => $query,
    'page' => (int)($data['page'] ?? $page),
    'has_next' => (bool)($data['has_next'] ?? false),
    'results' => $results,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

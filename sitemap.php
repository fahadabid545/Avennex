<?php
// Serves /sitemap.xml from avennex.com. The live list of posts, roles,
// products and ideas comes from the API. When the API is asleep or down,
// the last good copy is served, and failing that the static page list.

$source = 'https://avennex.onrender.com/api/sitemap.xml';
$cacheFile = __DIR__ . '/sitemap-cache.xml';
$staticFile = __DIR__ . '/sitemap-static.xml';
$timeout = 10;

function fetch_sitemap($url, $timeout)
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => $timeout,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_HTTPHEADER => ['Accept: application/xml'],
        ]);
        $body = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        return ($body !== false && $status === 200) ? $body : null;
    }

    $context = stream_context_create(['http' => [
        'timeout' => $timeout,
        'ignore_errors' => true,
        'header' => "Accept: application/xml\r\n",
    ]]);
    $body = @file_get_contents($url, false, $context);
    if ($body === false || empty($http_response_header[0]) || strpos($http_response_header[0], ' 200') === false) {
        return null;
    }
    return $body;
}

// an error page or a half-sent body must never replace the good copy
function looks_like_sitemap($body)
{
    return is_string($body)
        && strpos(ltrim($body), '<?xml') === 0
        && strpos($body, '<urlset') !== false
        && strpos($body, '</urlset>') !== false;
}

$body = fetch_sitemap($source, $timeout);

if (looks_like_sitemap($body)) {
    if (is_writable(__DIR__) && (!file_exists($cacheFile) || is_writable($cacheFile))) {
        $tmp = $cacheFile . '.tmp';
        if (@file_put_contents($tmp, $body) === false || !@rename($tmp, $cacheFile)) {
            @unlink($tmp);
        }
    }
} elseif (is_readable($cacheFile) && looks_like_sitemap($cached = @file_get_contents($cacheFile))) {
    $body = $cached;
} elseif (is_readable($staticFile)) {
    $body = file_get_contents($staticFile);
} else {
    http_response_code(503);
    header('Retry-After: 600');
    exit;
}

header('Content-Type: application/xml; charset=UTF-8');
header('Cache-Control: public, max-age=3600');
echo $body;

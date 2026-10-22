<?php
// Serves the four detail pages with the tags of the item named in ?slug=, so
// crawlers and link previews see its real title, text and image. .htaccess
// routes the pages here only when a slug is present. Whenever the API is slow,
// down or answers oddly, the page goes out exactly as it sits on disk.

$pages = [
    'blog-post' => ['api' => 'blogs', 'type' => 'article', 'title' => 'title', 'desc' => ['meta_description', 'excerpt', 'content']],
    'job-post' => ['api' => 'jobs', 'type' => 'website', 'title' => 'title', 'desc' => ['description']],
    'product-detail' => ['api' => 'products', 'type' => 'website', 'title' => 'name', 'desc' => ['tagline', 'description']],
    'launchpad-detail' => ['api' => 'launchpad', 'type' => 'website', 'title' => 'title', 'desc' => ['tagline', 'description']],
];

$timeout = 2;
$cacheTtl = 300;
$errorTtl = 60;
$cacheDir = __DIR__ . '/.meta-cache';

$isStaging = strtolower($_SERVER['HTTP_HOST'] ?? '') === 'staging.avennex.com';
$site = $isStaging ? 'https://staging.avennex.com' : 'https://avennex.com';
$apiOrigin = $isStaging ? 'https://avennex-stagging.onrender.com' : 'https://avennex.onrender.com';
$defaultImage = $site . '/img/og-image.png';

function send_page($html, $status = 200)
{
    http_response_code($status);
    header('Content-Type: text/html; charset=UTF-8');
    echo $html;
    exit;
}

function send_not_found()
{
    $page = @file_get_contents(__DIR__ . '/404.html');
    send_page($page === false ? 'Not found' : $page, 404);
}

// returns [status, item]: 'ok' with the item, 'missing' on a 404, 'error' otherwise
function fetch_item($url, $timeout)
{
    $body = null;
    $code = 0;
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => $timeout,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
        ]);
        $body = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
    } else {
        $context = stream_context_create(['http' => [
            'timeout' => $timeout,
            'ignore_errors' => true,
            'follow_location' => 0,
            'header' => "Accept: application/json\r\n",
        ]]);
        $body = @file_get_contents($url, false, $context);
        if (!empty($http_response_header[0]) && preg_match('/\s(\d{3})\s?/', $http_response_header[0], $m)) {
            $code = (int) $m[1];
        }
    }
    if ($code === 404) {
        return ['missing', null];
    }
    if ($code !== 200 || !is_string($body)) {
        return ['error', null];
    }
    $item = json_decode($body, true);
    return is_array($item) ? ['ok', $item] : ['error', null];
}

function read_cache($file)
{
    $raw = @file_get_contents($file);
    $entry = $raw === false ? null : json_decode($raw, true);
    return is_array($entry) && isset($entry['status'], $entry['at']) ? $entry : null;
}

function write_cache($dir, $file, $entry)
{
    if (!is_dir($dir) && !@mkdir($dir, 0755)) {
        return;
    }
    if (!file_exists($dir . '/.htaccess')) {
        @file_put_contents($dir . '/.htaccess', "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Order Deny,Allow\n  Deny from all\n</IfModule>\n");
    }
    $tmp = $file . '.tmp';
    if (@file_put_contents($tmp, json_encode($entry)) === false || !@rename($tmp, $file)) {
        @unlink($tmp);
    }
}

function plain_text($value)
{
    $text = html_entity_decode(strip_tags((string) $value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = preg_replace('/!\[[^\]]*\]\([^)]*\)/u', '', $text);
    $text = preg_replace('/\[([^\]]*)\]\([^)]*\)/u', '$1', $text);
    $text = preg_replace('/[*_`#>~|]+/u', '', $text);
    return trim(preg_replace('/\s+/u', ' ', $text));
}

function trim_description($text, $limit = 155)
{
    if (mb_strlen($text, 'UTF-8') <= $limit) {
        return $text;
    }
    $cut = mb_substr($text, 0, $limit, 'UTF-8');
    $sentence = max(mb_strrpos($cut, '. ', 0, 'UTF-8'), mb_strrpos($cut, '! ', 0, 'UTF-8'), mb_strrpos($cut, '? ', 0, 'UTF-8'));
    if ($sentence !== false && $sentence >= 80) {
        return mb_substr($cut, 0, $sentence + 1, 'UTF-8');
    }
    $space = mb_strrpos($cut, ' ', 0, 'UTF-8');
    return rtrim(mb_substr($cut, 0, $space === false ? $limit : $space, 'UTF-8'), " ,.;:");
}

function absolute_image($path, $apiOrigin, $default)
{
    $path = trim((string) $path);
    if ($path === '' || in_array($path, ['undefined', 'null', '#'], true)) {
        return $default;
    }
    if (preg_match('#^https?://#i', $path)) {
        return $path;
    }
    if (strpos($path, '//') === 0) {
        return 'https:' . $path;
    }
    if (preg_match('#^[a-z][a-z0-9+.-]*:#i', $path)) {
        return $default;
    }
    return $apiOrigin . '/' . ltrim($path, '/');
}

function set_tag($html, $pattern, $tag)
{
    return preg_replace_callback($pattern, function () use ($tag) {
        return $tag;
    }, $html, 1);
}

function esc($value)
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

$page = (string) ($_GET['page'] ?? '');
if (!isset($pages[$page])) {
    send_not_found();
}
$config = $pages[$page];

$html = @file_get_contents(__DIR__ . '/' . $page . '.html');
if ($html === false) {
    send_not_found();
}

$slug = trim((string) ($_GET['slug'] ?? ''));
if ($slug === '' || strlen($slug) > 200 || !preg_match('/^[A-Za-z0-9._~-]+$/', $slug)) {
    send_page($html);
}

$cacheFile = $cacheDir . '/.' . md5($site . '|' . $page . '|' . $slug);
$entry = read_cache($cacheFile);
$ttl = $entry && $entry['status'] === 'error' ? $errorTtl : $cacheTtl;

if (!$entry || time() - $entry['at'] > $ttl) {
    [$status, $item] = fetch_item($apiOrigin . '/api/' . $config['api'] . '/' . rawurlencode($slug), $timeout);
    if ($status === 'error' && $entry && $entry['status'] !== 'error') {
        // keep serving the last good answer while the API is unreachable
        $entry['at'] = time() - $cacheTtl + $errorTtl;
    } else {
        $entry = ['status' => $status, 'item' => $item, 'at' => time()];
    }
    write_cache($cacheDir, $cacheFile, $entry);
}

if ($entry['status'] === 'missing') {
    send_not_found();
}
if ($entry['status'] !== 'ok' || !is_array($entry['item'])) {
    send_page($html);
}

$item = $entry['item'];
$name = plain_text($item[$config['title']] ?? '');
if ($name === '') {
    send_page($html);
}

$description = '';
foreach ($config['desc'] as $field) {
    $description = trim_description(plain_text($item[$field] ?? ''));
    if ($description !== '') {
        break;
    }
}

$title = esc($name . ' | Avennex');
$url = esc($site . '/' . $page . '.html?slug=' . rawurlencode($slug));
$image = esc(absolute_image($item['cover_image'] ?? '', $apiOrigin, $defaultImage));
$type = esc($config['type']);

$html = set_tag($html, '#<title>.*?</title>#s', "<title>$title</title>");
$html = set_tag($html, '#<link rel="canonical" href="[^"]*">#', "<link rel=\"canonical\" href=\"$url\">");
$html = set_tag($html, '#<meta property="og:title" content="[^"]*">#', "<meta property=\"og:title\" content=\"$title\">");
$html = set_tag($html, '#<meta property="og:image" content="[^"]*">#', "<meta property=\"og:image\" content=\"$image\">");
$html = set_tag($html, '#<meta property="og:url" content="[^"]*">#', "<meta property=\"og:url\" content=\"$url\">");
$html = set_tag($html, '#<meta property="og:type" content="[^"]*">#', "<meta property=\"og:type\" content=\"$type\">");
$html = set_tag($html, '#<meta name="twitter:card" content="[^"]*">#', '<meta name="twitter:card" content="summary_large_image">');
$html = set_tag($html, '#<meta name="twitter:title" content="[^"]*">#', "<meta name=\"twitter:title\" content=\"$title\">");
$html = set_tag($html, '#<meta name="twitter:image" content="[^"]*">#', "<meta name=\"twitter:image\" content=\"$image\">");
if ($description !== '') {
    $desc = esc($description);
    $html = set_tag($html, '#<meta name="description" content="[^"]*">#', "<meta name=\"description\" content=\"$desc\">");
    $html = set_tag($html, '#<meta property="og:description" content="[^"]*">#', "<meta property=\"og:description\" content=\"$desc\">");
    $html = set_tag($html, '#<meta name="twitter:description" content="[^"]*">#', "<meta name=\"twitter:description\" content=\"$desc\">");
}

send_page($html);

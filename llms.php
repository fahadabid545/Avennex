<?php
// Serves /llms.txt, a plain summary of the site for AI assistants and their
// crawlers, which mostly don't run the JavaScript that fills the pages. The
// live lists come from the API. When it is slow or down, the last good copy
// is served, and failing that the fixed part alone.

$isStaging = strtolower($_SERVER['HTTP_HOST'] ?? '') === 'staging.avennex.com';
$site = $isStaging ? 'https://staging.avennex.com' : 'https://avennex.com';
$api = ($isStaging ? 'https://avennex-stagging.onrender.com' : 'https://avennex.onrender.com') . '/api';
$cacheFile = __DIR__ . '/.llms-cache.txt';
$cacheTtl = 3600;
$timeout = 4;

$sections = [
    'products' => ['title' => 'Products', 'path' => '/products?limit=50', 'page' => 'product-detail', 'name' => 'name', 'desc' => ['tagline', 'description']],
    'launchpad' => ['title' => 'Launchpad', 'path' => '/launchpad?limit=50', 'page' => 'launchpad-detail', 'name' => 'title', 'desc' => ['tagline', 'description']],
    'blogs' => ['title' => 'Journal', 'path' => '/blogs?limit=50', 'page' => 'blog-post', 'name' => 'title', 'desc' => ['meta_description', 'excerpt']],
    'jobs' => ['title' => 'Open roles', 'path' => '/jobs?limit=50', 'page' => 'job-post', 'name' => 'title', 'desc' => ['location', 'type']],
    'faqs' => ['title' => 'FAQ', 'path' => '/faqs'],
];

function send_text($body)
{
    header('Content-Type: text/plain; charset=UTF-8');
    header('Cache-Control: public, max-age=3600');
    echo $body;
    exit;
}

function one_line($value, $limit = 200)
{
    $text = html_entity_decode(strip_tags((string) $value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = preg_replace('/!\[[^\]]*\]\([^)]*\)/u', '', $text);
    $text = preg_replace('/\[([^\]]*)\]\([^)]*\)/u', '$1', $text);
    $text = trim(preg_replace('/\s+/u', ' ', preg_replace('/[*_`#>~|]+/u', '', $text)));
    if (mb_strlen($text, 'UTF-8') > $limit) {
        $cut = mb_substr($text, 0, $limit, 'UTF-8');
        $space = mb_strrpos($cut, ' ', 0, 'UTF-8');
        $text = rtrim(mb_substr($cut, 0, $space === false ? $limit : $space, 'UTF-8'), " ,.;:");
    }
    return $text;
}

// all lists at once, so a slow API costs one timeout rather than five
function fetch_all($api, $sections, $timeout)
{
    if (!function_exists('curl_multi_init')) {
        return null;
    }
    $multi = curl_multi_init();
    $handles = [];
    foreach ($sections as $key => $section) {
        $ch = curl_init($api . $section['path']);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => $timeout,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
        ]);
        curl_multi_add_handle($multi, $ch);
        $handles[$key] = $ch;
    }
    do {
        $status = curl_multi_exec($multi, $running);
        if ($running) {
            curl_multi_select($multi, 1);
        }
    } while ($running && $status === CURLM_OK);

    $data = [];
    foreach ($handles as $key => $ch) {
        $body = curl_multi_getcontent($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_multi_remove_handle($multi, $ch);
        curl_close($ch);
        $rows = $code === 200 ? json_decode((string) $body, true) : null;
        if (!is_array($rows)) {
            return null;
        }
        $data[$key] = $rows;
    }
    curl_multi_close($multi);
    return $data;
}

$intro = "# Avennex\n\n"
    . "> Avennex builds custom software, AI integrations and workflow automation for startups and established businesses. "
    . "The team is remote first, based in Waterloo, Ontario, Canada, and has been shipping client work since 2022.\n\n"
    . "Contact: hello@avennex.com. LinkedIn: https://www.linkedin.com/company/avennex/\n\n"
    . "## Pages\n\n"
    . "- [Home]($site/): what Avennex builds and for whom\n"
    . "- [Services]($site/services.html): custom software, AI integration, workflow automation, apps, cloud and consulting\n"
    . "- [Products]($site/products.html): products in active development, with live progress and roadmaps\n"
    . "- [Launchpad]($site/launchpad.html): products about to launch, open for comments\n"
    . "- [Academy]($site/academy.html): free video lessons from real software, AI and automation projects\n"
    . "- [Journal]($site/blog.html): notes from the team on what worked, what didn't, and why\n"
    . "- [Careers]($site/careers.html): open roles on the team\n"
    . "- [About]($site/about.html): the company and the people behind it\n"
    . "- [Contact]($site/contact.html): replies within 24 hours on weekdays\n";

$cached = @file_get_contents($cacheFile);
if ($cached !== false && time() - (int) @filemtime($cacheFile) < $cacheTtl) {
    send_text($cached);
}

$data = fetch_all($api, $sections, $timeout);
if ($data === null) {
    send_text($cached !== false ? $cached : $intro);
}

$out = $intro;
foreach ($sections as $key => $section) {
    $rows = $data[$key];
    if (!$rows) {
        continue;
    }
    $out .= "\n## {$section['title']}\n\n";
    foreach ($rows as $row) {
        if ($key === 'faqs') {
            $out .= '- ' . one_line($row['question'] ?? '') . ' ' . one_line($row['answer'] ?? '', 400) . "\n";
            continue;
        }
        $slug = (string) ($row['slug'] ?? '');
        $name = one_line($row[$section['name']] ?? '');
        if ($slug === '' || $name === '') {
            continue;
        }
        $parts = [];
        foreach ($section['desc'] as $field) {
            $text = one_line($row[$field] ?? '');
            if ($text !== '') {
                $parts[] = $text;
                if ($key !== 'jobs') {
                    break;
                }
            }
        }
        $url = "$site/{$section['page']}.html?slug=" . rawurlencode($slug);
        $out .= "- [$name]($url)" . ($parts ? ': ' . implode(', ', $parts) : '') . "\n";
    }
}

$tmp = $cacheFile . '.tmp';
if (@file_put_contents($tmp, $out) === false || !@rename($tmp, $cacheFile)) {
    @unlink($tmp);
}
send_text($out);

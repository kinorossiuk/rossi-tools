<?php
declare(strict_types=1);

require __DIR__ . '/app/short-links.php';

header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-Robots-Tag: noindex, nofollow, noarchive');

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($method !== 'GET' && $method !== 'HEAD') {
    header('Allow: GET, HEAD');
    http_response_code(405);
    exit('Method Not Allowed');
}

try {
    $link = rossi_short_links_find((string) ($_GET['code'] ?? ''));
} catch (Throwable $error) {
    http_response_code(503);
    exit('Short URL service is temporarily unavailable.');
}
if ($link === null) {
    http_response_code(404);
    exit('Short URL not found.');
}
header('Location: ' . $link['url'], true, 302);
exit;

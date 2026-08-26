<?php
declare(strict_types=1);

require __DIR__ . '/app/auth.php';
require __DIR__ . '/app/short-links.php';

function rossi_short_links_respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=UTF-8');
    header('Cache-Control: no-store, private');
    $encoded = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    echo is_string($encoded) ? $encoded : '{"error":"응답을 만들 수 없습니다."}';
    exit;
}

$auth = rossi_auth_gate();
if (($auth['status'] ?? '') !== 'authenticated') {
    $authStatus = (string) ($auth['status'] ?? 'login');
    $status = $authStatus === 'blocked' ? 429 : ($authStatus === 'permanently-blocked' ? 403 : ($authStatus === 'login' ? 401 : 503));
    rossi_short_links_respond(['error' => '로그인이 필요하거나 세션이 만료되었습니다.'], $status);
}

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
try {
    if ($method === 'GET') {
        rossi_short_links_respond(['links' => rossi_short_links_list()]);
    }
    if ($method !== 'POST') {
        header('Allow: GET, POST');
        rossi_short_links_respond(['error' => '허용되지 않은 요청 방식입니다.'], 405);
    }
    $csrf = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($csrf === '' || !hash_equals((string) $auth['csrf'], $csrf)) {
        rossi_short_links_respond(['error' => '요청이 만료되었습니다. 페이지를 새로고침해 주세요.'], 403);
    }
    $body = file_get_contents('php://input');
    $request = is_string($body) ? json_decode($body, true) : null;
    if (!is_array($request)) {
        rossi_short_links_respond(['error' => '요청 형식이 올바르지 않습니다.'], 400);
    }
    $action = (string) ($request['action'] ?? '');
    if ($action === 'create') {
        $result = rossi_short_links_create((string) ($request['url'] ?? ''));
        rossi_short_links_respond($result, $result['created'] ? 201 : 200);
    }
    if ($action === 'delete') {
        if (!rossi_short_links_delete((string) ($request['code'] ?? ''))) {
            rossi_short_links_respond(['error' => '이미 삭제되었거나 존재하지 않는 단축 URL입니다.'], 404);
        }
        rossi_short_links_respond(['deleted' => true]);
    }
    rossi_short_links_respond(['error' => '지원하지 않는 작업입니다.'], 400);
} catch (InvalidArgumentException $error) {
    rossi_short_links_respond(['error' => $error->getMessage()], 422);
} catch (RuntimeException $error) {
    rossi_short_links_respond(['error' => $error->getMessage()], 503);
} catch (Throwable $error) {
    rossi_short_links_respond(['error' => '단축 URL 작업 중 오류가 발생했습니다.'], 500);
}

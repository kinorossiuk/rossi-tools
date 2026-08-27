<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

const ROSSI_SHORT_LINK_LIMIT = 5000;
const ROSSI_SHORT_URL_MAX_LENGTH = 4096;
const ROSSI_ISGD_API_URL = 'https://is.gd/create.php';

function rossi_short_links_paths(): array
{
    $directory = rossi_security_dir();
    return ['directory' => $directory, 'data' => $directory . '/short-links.json', 'lock' => $directory . '/short-links.lock'];
}

function rossi_short_links_prepare_directory(string $directory): void
{
    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('단축 URL 저장 공간을 만들 수 없습니다.');
    }
    @chmod($directory, 0700);
}

function rossi_short_links_open_lock(array $paths, int $operation)
{
    rossi_short_links_prepare_directory($paths['directory']);
    $handle = @fopen($paths['lock'], 'c+');
    if ($handle === false || !flock($handle, $operation)) {
        if (is_resource($handle)) {
            fclose($handle);
        }
        throw new RuntimeException('단축 URL 저장 공간을 잠글 수 없습니다.');
    }
    @chmod($paths['lock'], 0600);
    return $handle;
}

function rossi_short_links_close_lock($handle): void
{
    flock($handle, LOCK_UN);
    fclose($handle);
}

function rossi_short_links_read_unlocked(string $path): array
{
    if (!is_file($path)) {
        return [];
    }
    $contents = @file_get_contents($path);
    $decoded = $contents === false ? null : json_decode($contents, true);
    if (!is_array($decoded) || !isset($decoded['links']) || !is_array($decoded['links'])) {
        throw new RuntimeException('단축 URL 저장 데이터가 손상되었습니다.');
    }

    $links = [];
    foreach ($decoded['links'] as $storageKey => $link) {
        if (!is_string($storageKey) || !is_array($link)) {
            continue;
        }
        $provider = (string) ($link['provider'] ?? 'self');
        $url = (string) ($link['url'] ?? '');
        $createdAt = (string) ($link['created_at'] ?? '');
        if ($url === '' || $createdAt === '') {
            continue;
        }
        if ($provider === 'bitly' || $provider === 'isgd') {
            $id = (string) ($link['id'] ?? '');
            $shortUrl = (string) ($link['short_url'] ?? '');
            if ($id === '' || filter_var($shortUrl, FILTER_VALIDATE_URL) === false) {
                continue;
            }
            $links[$storageKey] = ['id' => $id, 'provider' => $provider, 'short_url' => $shortUrl, 'url' => $url, 'created_at' => $createdAt];
            continue;
        }

        // v1 자체 단축 주소는 이미 배포되었을 수 있으므로 이동 기능을 보존합니다.
        $code = (string) ($link['code'] ?? $storageKey);
        if (preg_match('/^[A-Za-z0-9_-]{4,32}$/D', $code)) {
            $links[$storageKey] = ['id' => $code, 'provider' => 'self', 'code' => $code, 'url' => $url, 'created_at' => $createdAt];
        }
    }
    return $links;
}

function rossi_short_links_write_unlocked(string $path, array $links): void
{
    $payload = json_encode(['version' => 2, 'links' => $links], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if (!is_string($payload)) {
        throw new RuntimeException('단축 URL 저장 데이터를 만들 수 없습니다.');
    }
    $temporaryPath = $path . '.tmp-' . bin2hex(random_bytes(6));
    if (@file_put_contents($temporaryPath, $payload . "\n") === false) {
        @unlink($temporaryPath);
        throw new RuntimeException('단축 URL을 저장할 수 없습니다.');
    }
    @chmod($temporaryPath, 0600);
    if (!@rename($temporaryPath, $path)) {
        @unlink($temporaryPath);
        throw new RuntimeException('단축 URL 저장을 완료할 수 없습니다.');
    }
    @chmod($path, 0600);
}

function rossi_short_links_sensitive_query_key(string $url): ?string
{
    $query = (string) (parse_url($url, PHP_URL_QUERY) ?? '');
    if ($query === '') {
        return null;
    }
    $blocked = ['token', 'accesstoken', 'refreshtoken', 'apikey', 'key', 'secret', 'password', 'passwd', 'pwd', 'session', 'sessionid', 'sid', 'authorization', 'auth', 'code'];
    foreach (explode('&', $query) as $part) {
        $key = rawurldecode(explode('=', $part, 2)[0]);
        $normalised = strtolower((string) preg_replace('/[^a-z0-9]/i', '', $key));
        if (in_array($normalised, $blocked, true)) {
            return $key;
        }
    }
    return null;
}

function rossi_short_links_normalise_url(string $value): string
{
    $url = trim($value);
    if ($url === '') {
        throw new InvalidArgumentException('압축할 URL을 입력해 주세요.');
    }
    if (strlen($url) > ROSSI_SHORT_URL_MAX_LENGTH) {
        throw new InvalidArgumentException('URL은 4,096자 이내로 입력해 주세요.');
    }
    if (preg_match('/[\x00-\x20\x7F]/', $url)) {
        throw new InvalidArgumentException('공백이나 제어 문자가 없는 URL을 입력해 주세요.');
    }
    if (!preg_match('/^[a-z][a-z0-9+.-]*:\/\//i', $url)) {
        $url = 'https://' . $url;
    }
    $parts = parse_url($url);
    $scheme = is_array($parts) ? strtolower((string) ($parts['scheme'] ?? '')) : '';
    $host = is_array($parts) ? (string) ($parts['host'] ?? '') : '';
    if (!in_array($scheme, ['http', 'https'], true) || $host === '' || filter_var($url, FILTER_VALIDATE_URL) === false) {
        throw new InvalidArgumentException('올바른 http 또는 https URL을 입력해 주세요.');
    }
    if (isset($parts['user']) || isset($parts['pass'])) {
        throw new InvalidArgumentException('아이디나 비밀번호가 포함된 URL은 압축할 수 없습니다.');
    }
    $sensitiveKey = rossi_short_links_sensitive_query_key($url);
    if ($sensitiveKey !== null) {
        throw new InvalidArgumentException('민감한 쿼리값(' . $sensitiveKey . ')이 포함된 URL은 단축 서비스로 전송할 수 없습니다.');
    }
    return $url;
}

function rossi_isgd_shorten(string $url): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('서버에 cURL이 없어 is.gd API를 호출할 수 없습니다.');
    }
    $curl = curl_init(ROSSI_ISGD_API_URL);
    if ($curl === false) {
        throw new RuntimeException('is.gd 연결을 시작할 수 없습니다.');
    }
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query(['format' => 'json', 'url' => $url], '', '&', PHP_QUERY_RFC3986),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
    ]);
    $response = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $error = curl_error($curl);
    curl_close($curl);
    $decoded = json_decode((string) $response, true);
    if ($response === false || !is_array($decoded) || $status < 200 || $status >= 300) {
        if (is_array($decoded) && (int) ($decoded['errorcode'] ?? 0) === 3) {
            throw new RuntimeException('is.gd 호출 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.');
        }
        throw new RuntimeException($error !== '' ? 'is.gd 연결에 실패했습니다.' : 'is.gd API가 요청을 처리하지 못했습니다. (HTTP ' . $status . ')');
    }
    if (isset($decoded['errorcode'])) {
        throw new RuntimeException('is.gd가 URL을 압축하지 못했습니다: ' . (string) ($decoded['errormessage'] ?? '입력 URL을 확인해 주세요.'));
    }
    return $decoded;
}

function rossi_short_links_list(): array
{
    $paths = rossi_short_links_paths();
    $lock = rossi_short_links_open_lock($paths, LOCK_SH);
    try {
        $links = array_values(rossi_short_links_read_unlocked($paths['data']));
    } finally {
        rossi_short_links_close_lock($lock);
    }
    usort($links, static function (array $left, array $right): int { return strcmp($right['created_at'], $left['created_at']); });
    return $links;
}

function rossi_short_links_find(string $code): ?array
{
    if (!preg_match('/^[A-Za-z0-9_-]{4,32}$/D', $code)) {
        return null;
    }
    foreach (rossi_short_links_list() as $link) {
        if (($link['provider'] ?? '') === 'self' && ($link['code'] ?? '') === $code) {
            return $link;
        }
    }
    return null;
}

function rossi_short_links_create(string $value): array
{
    $url = rossi_short_links_normalise_url($value);
    $paths = rossi_short_links_paths();
    $lock = rossi_short_links_open_lock($paths, LOCK_SH);
    try {
        $existing = rossi_short_links_read_unlocked($paths['data']);
        if (count($existing) >= ROSSI_SHORT_LINK_LIMIT) {
            throw new RuntimeException('저장 가능한 단축 URL 5,000개를 모두 사용했습니다. 기존 항목을 삭제해 주세요.');
        }
        foreach ($existing as $link) {
            if (in_array(($link['provider'] ?? ''), ['bitly', 'isgd'], true) && ($link['url'] ?? '') === $url) {
                return ['link' => $link, 'created' => false];
            }
        }
    } finally {
        rossi_short_links_close_lock($lock);
    }

    $isgd = rossi_isgd_shorten($url);
    $shortUrl = (string) ($isgd['shorturl'] ?? '');
    if (filter_var($shortUrl, FILTER_VALIDATE_URL) === false) {
        throw new RuntimeException('is.gd가 올바른 단축 URL을 반환하지 않았습니다.');
    }
    $id = $shortUrl;
    $link = ['id' => $id, 'provider' => 'isgd', 'short_url' => $shortUrl, 'url' => $url, 'created_at' => gmdate('c')];
    $lock = rossi_short_links_open_lock($paths, LOCK_EX);
    try {
        $links = rossi_short_links_read_unlocked($paths['data']);
        foreach ($links as $saved) {
            if (($saved['provider'] ?? '') === 'isgd' && ($saved['id'] ?? '') === $id) {
                return ['link' => $saved, 'created' => false];
            }
        }
        $links['isgd:' . hash('sha256', $id)] = $link;
        rossi_short_links_write_unlocked($paths['data'], $links);
    } finally {
        rossi_short_links_close_lock($lock);
    }
    return ['link' => $link, 'created' => true];
}

function rossi_short_links_delete(string $id): bool
{
    $paths = rossi_short_links_paths();
    $lock = rossi_short_links_open_lock($paths, LOCK_EX);
    try {
        $links = rossi_short_links_read_unlocked($paths['data']);
        $storageKey = null;
        $link = null;
        foreach ($links as $key => $candidate) {
            if (($candidate['id'] ?? '') === $id) {
                $storageKey = $key;
                $link = $candidate;
                break;
            }
        }
        if ($storageKey === null || !is_array($link)) {
            return false;
        }
        unset($links[$storageKey]);
        rossi_short_links_write_unlocked($paths['data'], $links);
        return true;
    } finally {
        rossi_short_links_close_lock($lock);
    }
}

<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

const ROSSI_SHORT_LINK_LIMIT = 5000;
const ROSSI_SHORT_CODE_LENGTH = 8;
const ROSSI_SHORT_URL_MAX_LENGTH = 4096;

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
        throw new InvalidArgumentException('민감한 쿼리값(' . $sensitiveKey . ')이 포함된 URL은 단축할 수 없습니다.');
    }
    return $url;
}

function rossi_short_links_generate_code(array $links): string
{
    $alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    $lastIndex = strlen($alphabet) - 1;
    for ($attempt = 0; $attempt < 64; $attempt++) {
        $code = '';
        for ($index = 0; $index < ROSSI_SHORT_CODE_LENGTH; $index++) {
            $code .= $alphabet[random_int(0, $lastIndex)];
        }
        $inUse = false;
        foreach ($links as $link) {
            if (($link['provider'] ?? '') === 'self' && ($link['code'] ?? '') === $code) {
                $inUse = true;
                break;
            }
        }
        if (!$inUse) {
            return $code;
        }
    }
    throw new RuntimeException('고유한 단축 코드를 만들 수 없습니다. 잠시 후 다시 시도해 주세요.');
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
    $lock = rossi_short_links_open_lock($paths, LOCK_EX);
    try {
        $links = rossi_short_links_read_unlocked($paths['data']);
        if (count($links) >= ROSSI_SHORT_LINK_LIMIT) {
            throw new RuntimeException('저장 가능한 단축 URL 5,000개를 모두 사용했습니다. 기존 항목을 삭제해 주세요.');
        }
        foreach ($links as $link) {
            if (($link['provider'] ?? '') === 'self' && ($link['url'] ?? '') === $url) {
                return ['link' => $link, 'created' => false];
            }
        }
        $code = rossi_short_links_generate_code($links);
        $link = ['id' => $code, 'provider' => 'self', 'code' => $code, 'url' => $url, 'created_at' => gmdate('c')];
        $links[$code] = $link;
        rossi_short_links_write_unlocked($paths['data'], $links);
        return ['link' => $link, 'created' => true];
    } finally {
        rossi_short_links_close_lock($lock);
    }
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

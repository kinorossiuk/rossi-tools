<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

const ROSSI_SHORT_LINK_LIMIT = 500;
const ROSSI_SHORT_CODE_LENGTH = 7;
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

function rossi_short_links_read_unlocked(string $path): array
{
    if (!is_file($path)) {
        return [];
    }
    $contents = @file_get_contents($path);
    if ($contents === false) {
        throw new RuntimeException('단축 URL 저장 공간을 읽을 수 없습니다.');
    }
    $decoded = json_decode($contents, true);
    if (!is_array($decoded) || !isset($decoded['links']) || !is_array($decoded['links'])) {
        throw new RuntimeException('단축 URL 저장 데이터가 손상되었습니다.');
    }

    $links = [];
    foreach ($decoded['links'] as $code => $link) {
        if (!is_string($code) || !preg_match('/^[A-Za-z0-9_-]{4,32}$/D', $code) || !is_array($link)) {
            continue;
        }
        $url = (string) ($link['url'] ?? '');
        $createdAt = (string) ($link['created_at'] ?? '');
        if ($url !== '' && $createdAt !== '') {
            $links[$code] = ['code' => $code, 'url' => $url, 'created_at' => $createdAt];
        }
    }
    return $links;
}

function rossi_short_links_write_unlocked(string $path, array $links): void
{
    $payload = json_encode(['version' => 1, 'links' => $links], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
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
        if (!isset($links[$code])) {
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
    $paths = rossi_short_links_paths();
    $lock = rossi_short_links_open_lock($paths, LOCK_SH);
    try {
        $links = rossi_short_links_read_unlocked($paths['data']);
        $link = $links[$code] ?? null;
    } finally {
        rossi_short_links_close_lock($lock);
    }
    return is_array($link) ? $link : null;
}

function rossi_short_links_create(string $value): array
{
    $url = rossi_short_links_normalise_url($value);
    $paths = rossi_short_links_paths();
    $lock = rossi_short_links_open_lock($paths, LOCK_EX);
    try {
        $links = rossi_short_links_read_unlocked($paths['data']);
        foreach ($links as $link) {
            if ($link['url'] === $url) {
                return ['link' => $link, 'created' => false];
            }
        }
        if (count($links) >= ROSSI_SHORT_LINK_LIMIT) {
            throw new RuntimeException('저장 가능한 단축 URL 500개를 모두 사용했습니다. 기존 항목을 삭제해 주세요.');
        }
        $code = rossi_short_links_generate_code($links);
        $link = ['code' => $code, 'url' => $url, 'created_at' => gmdate('c')];
        $links[$code] = $link;
        rossi_short_links_write_unlocked($paths['data'], $links);
        return ['link' => $link, 'created' => true];
    } finally {
        rossi_short_links_close_lock($lock);
    }
}

function rossi_short_links_delete(string $code): bool
{
    if (!preg_match('/^[A-Za-z0-9_-]{4,32}$/D', $code)) {
        throw new InvalidArgumentException('삭제할 단축 URL 코드가 올바르지 않습니다.');
    }
    $paths = rossi_short_links_paths();
    $lock = rossi_short_links_open_lock($paths, LOCK_EX);
    try {
        $links = rossi_short_links_read_unlocked($paths['data']);
        if (!isset($links[$code])) {
            return false;
        }
        unset($links[$code]);
        rossi_short_links_write_unlocked($paths['data'], $links);
        return true;
    } finally {
        rossi_short_links_close_lock($lock);
    }
}

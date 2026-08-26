<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit(1);
}

$stty = trim((string) shell_exec('stty -g'));
if ($stty === '') {
    fwrite(STDERR, "입력을 안전하게 숨길 수 없습니다. 터미널에서 다시 실행해 주세요.\n");
    exit(1);
}
fwrite(STDOUT, 'Bitly API 토큰: ');
shell_exec('stty -echo');
$token = rtrim((string) fgets(STDIN), "\r\n");
shell_exec('stty ' . escapeshellarg($stty));
fwrite(STDOUT, "\n");
if ($token === '' || preg_match('/\s/', $token) || strlen($token) > 512) {
    fwrite(STDERR, "Bitly API 토큰 형식을 확인해 주세요.\n");
    exit(1);
}

$home = getenv('HOME');
if (!is_string($home) || $home === '') {
    fwrite(STDERR, "HOME 경로를 확인할 수 없습니다.\n");
    exit(1);
}
$directory = rtrim($home, '/') . '/.rossi-tools';
if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
    fwrite(STDERR, "보안 설정 디렉터리를 만들 수 없습니다.\n");
    exit(1);
}
$contents = "<?php\nreturn " . var_export(['access_token' => $token], true) . ";\n";
$temporary = tempnam($directory, '.bitly-');
if ($temporary === false || file_put_contents($temporary, $contents, LOCK_EX) === false) {
    fwrite(STDERR, "Bitly 설정을 저장할 수 없습니다.\n");
    exit(1);
}
chmod($temporary, 0600);
if (!rename($temporary, $directory . '/bitly.php')) {
    @unlink($temporary);
    fwrite(STDERR, "Bitly 설정을 적용할 수 없습니다.\n");
    exit(1);
}
fwrite(STDOUT, "Bitly API 토큰을 웹 루트 밖 보안 설정에 저장했습니다.\n");

<?php
declare(strict_types=1);

$urlShortenerCssVersion = (string) (filemtime(__DIR__ . '/../static/url-shortener.css') ?: '1');
$urlShortenerJsVersion = (string) (filemtime(__DIR__ . '/../static/url-shortener.js') ?: '1');
$urlShortenerCsrf = htmlspecialchars((string) ($auth['csrf'] ?? ''), ENT_QUOTES, 'UTF-8');
?>
<link rel="stylesheet" href="/static/url-shortener.css?v=<?= htmlspecialchars($urlShortenerCssVersion, ENT_QUOTES, 'UTF-8') ?>">
<section class="tool-view url-shortener-tool" aria-labelledby="tool-title" data-url-shortener-tool data-csrf="<?= $urlShortenerCsrf ?>">
  <a class="back-link" href="/">← 모든 도구</a>
  <div class="tool-view-icon" aria-hidden="true">↗</div>
  <p class="kicker">UTILITY / URL SHORTENER</p><h1 id="tool-title">URL<br>압축기</h1>
  <p class="tool-intro">긴 URL을 입력하면 <strong>rossiuk.xyz/s/…</strong> 주소로 압축합니다. 생성된 주소는 바로 복사해 사용할 수 있습니다.</p>
  <section class="url-shortener-notice" aria-label="저장 및 공개 범위 안내"><div><strong>자체 도메인 발급</strong><span>원본 URL을 외부 단축 API로 전송하지 않습니다. rossiuk.xyz 주소로 바로 발급합니다.</span></div><div><strong>민감 URL 차단</strong><span>토큰·비밀번호·세션·인증 코드 쿼리값이 든 URL은 압축할 수 없습니다. 단축 주소는 공개 공유용입니다.</span></div></section>
  <form class="url-shortener-form" id="url-shortener-form" novalidate><label for="url-shortener-input">압축할 URL</label><div class="url-shortener-input-row"><input id="url-shortener-input" name="url" type="text" required maxlength="4096" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://example.com/very/long/url?with=query"><button class="primary" id="url-shortener-submit" type="submit">URL 압축</button></div><p class="url-shortener-help">http 또는 https 주소를 입력하세요. 프로토콜을 생략하면 https://를 자동으로 붙입니다.</p></form>
  <section class="url-shortener-result" id="url-shortener-result" aria-labelledby="url-shortener-result-title" hidden><p id="url-shortener-result-title">압축 완료</p><div class="url-shortener-result-row"><input id="url-shortener-output" type="text" readonly aria-label="생성된 단축 URL"><button class="primary" id="url-shortener-copy" type="button">복사</button></div><p class="url-shortener-destination" id="url-shortener-destination"></p></section>
  <p class="url-shortener-status" id="url-shortener-status" role="status" aria-live="polite">URL을 입력하고 압축 버튼을 눌러 주세요. 외부 API나 별도 토큰 설정은 필요하지 않습니다.</p>
  <p class="url-shortener-help">자체 단축 주소는 도구에서 삭제하면 더 이상 작동하지 않습니다.</p>
  <section class="url-shortener-list" aria-labelledby="url-shortener-list-title"><div class="url-shortener-list-head"><div><h2 id="url-shortener-list-title">저장된 단축 URL</h2><p id="url-shortener-count">불러오는 중…</p></div><button class="ghost" id="url-shortener-reload" type="button">새로고침</button></div><div id="url-shortener-items" aria-live="polite"></div></section>
</section>
<script src="/static/url-shortener.js?v=<?= htmlspecialchars($urlShortenerJsVersion, ENT_QUOTES, 'UTF-8') ?>" defer></script>

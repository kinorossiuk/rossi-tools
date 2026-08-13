<?php
declare(strict_types=1);
?>
<?php
$testDataCssVersion = (string) (filemtime(__DIR__ . '/../static/test-data.css') ?: '1');
$testDataJsVersion = (string) (filemtime(__DIR__ . '/../static/test-data.js') ?: '1');
?>
<link rel="stylesheet" href="/static/test-data.css?v=<?= htmlspecialchars($testDataCssVersion, ENT_QUOTES, 'UTF-8') ?>">
<section class="tool-view test-data-view" aria-labelledby="tool-title" data-test-data-tool>
  <a class="back-link" href="/">← 모든 도구</a>
  <div class="tool-view-icon" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M6 3h14l6 6v20H6V3Zm12 2.8V11h5.2L18 5.8ZM10 15h12v2H10v-2Zm0 5h12v2H10v-2Zm0 5h8v2h-8v-2Z"/></svg></div>
  <p class="kicker">LOCAL / TEST DATA</p>
  <h1 id="tool-title">테스트 데이터<br>생성기</h1>
  <p class="tool-intro">파일과 데이터는 브라우저에서만 만들고 바로 내려받습니다. 서버에 저장하거나 전송하지 않습니다.</p>

  <details class="work-notice"><summary>업무 사용 전 주의사항</summary><ul><li>업로드 검증에는 생성기의 더미 파일·더미 연락처만 사용하세요. 실제 고객정보, 임직원 연락처, 업무 문서를 넣지 마세요.</li><li>대용량 파일 생성과 다운로드는 회사 DLP, 저장공간 정책, 네트워크 사용량 제한에 영향을 줄 수 있습니다.</li><li>생성 파일은 승인된 테스트 환경에만 업로드하고, 보안 통제를 우회하거나 서비스 부하를 만들 목적으로 사용하지 마세요.</li></ul></details>

  <div class="test-tabs" role="tablist" aria-label="생성기 종류">
    <button class="is-active" type="button" role="tab" aria-selected="true" aria-controls="file-panel" id="file-tab" data-tab="file">용량별 파일</button>
    <button type="button" role="tab" aria-selected="false" aria-controls="message-panel" id="message-tab" data-tab="message">문자·이모지</button>
    <button type="button" role="tab" aria-selected="false" aria-controls="contact-panel" id="contact-tab" data-tab="contact">더미 연락처</button>
  </div>

  <section class="test-panel" id="file-panel" role="tabpanel" aria-labelledby="file-tab" data-panel="file">
    <form class="test-form" id="test-file-form">
      <label>파일 종류
        <select id="file-kind" name="kind">
          <option value="png">PNG 이미지</option>
          <option value="txt">TXT 문서</option>
          <option value="pdf">PDF 문서</option>
          <option value="docx">DOCX 문서</option>
          <option value="xlsx">XLSX 스프레드시트</option>
          <option value="mp4">MP4 동영상 (H.264)</option>
          <option value="webm">WebM 동영상</option>
        </select>
      </label>
      <label>목표 용량
        <div class="size-input"><input id="file-size" name="size" type="number" min="1" max="300" value="1" required inputmode="decimal"><select id="file-unit" name="unit"><option value="MiB">MiB</option><option value="MB">MB</option></select></div>
      </label>
      <label>파일명
        <input id="file-name" name="name" maxlength="60" value="test-file" required>
      </label>
      <label class="file-image-option">이미지 크기
        <select id="image-dimension" name="dimension"><option value="800x600">800 × 600</option><option value="1280x720">1280 × 720</option><option value="1920x1080">1920 × 1080</option></select>
      </label>
      <p class="test-hint" id="file-hint">PNG, TXT, PDF, DOCX, XLSX는 10가지 패턴 중 하나를 무작위로 선택해 목표 바이트에 맞춰 생성합니다.</p>
      <button class="primary" type="submit">파일 생성 및 다운로드</button>
      <p class="test-status" id="file-status" role="status" aria-live="polite">모든 파일은 최대 300 MiB까지 만들 수 있습니다. 큰 파일은 충분한 브라우저 메모리가 필요합니다.</p>
    </form>
  </section>

  <section class="test-panel" id="message-panel" role="tabpanel" aria-labelledby="message-tab" data-panel="message" hidden>
    <form class="test-form" id="test-message-form">
      <label>목표 화면 글자 수
        <div class="size-input"><input id="message-count" type="number" min="1" max="100000" value="500" required inputmode="numeric"><select id="message-preset"><option value="custom">직접 입력</option><option value="499">499자 이하</option><option value="500">정확히 500자</option><option value="501">501자 이상</option><option value="3999">3,999자 이하</option><option value="4000">정확히 4,000자</option><option value="4001">4,001자 이상</option><option value="10000">정확히 10,000자</option></select></div>
      </label>
      <label>앞에 붙일 문구 <input id="message-prefix" value="테스트 문자 "></label>
      <fieldset class="message-character-mix wide-field">
        <legend>문자 구성</legend>
        <div class="message-character-options">
          <label><input type="checkbox" value="korean" data-message-character checked> 한글</label>
          <label><input type="checkbox" value="english" data-message-character checked> 영문</label>
          <label><input type="checkbox" value="number" data-message-character checked> 숫자</label>
          <label><input type="checkbox" value="symbol" data-message-character checked> 특수문자</label>
          <label><input type="checkbox" value="emoji" data-message-character checked> 이모지</label>
        </div>
        <p class="test-hint">선택한 종류가 한쪽에 치우치지 않도록 고르게 섞어 정확한 화면 글자 수로 만듭니다.</p>
      </fieldset>
      <label class="wide-field">직접 입력 또는 생성 결과 <textarea id="message-output" rows="8" spellcheck="false" placeholder="글자 수를 확인할 내용을 입력하거나 아래에서 이모지를 넣으세요."></textarea></label>
      <div class="message-metrics wide-field" aria-label="입력 내용 통계">
        <div><span>화면 글자</span><strong id="message-graphemes">0</strong></div>
        <div><span>Unicode 코드 포인트</span><strong id="message-code-points">0</strong></div>
        <div><span>UTF-16 문자열 길이</span><strong id="message-code-units">0</strong></div>
        <div><span>UTF-8 바이트</span><strong id="message-bytes">0</strong></div>
      </div>
      <div class="test-actions wide-field"><button class="primary" type="submit">문자 만들기</button><button class="ghost" id="message-copy" type="button">복사</button><button class="ghost" id="message-qr" type="button" disabled>QR 새로고침</button><button class="ghost" id="message-clear" type="button">초기화</button></div>

      <section class="message-qr-output wide-field" id="message-qr-output" aria-labelledby="message-qr-title" hidden>
        <div class="message-qr-heading">
          <div><p class="kicker">SCAN / LOCAL</p><h2 id="message-qr-title">생성 문자 QR</h2></div>
          <span id="message-qr-bytes"></span>
        </div>
        <div class="message-qr-preview" id="message-qr-preview" aria-live="polite"><span>QR</span></div>
        <div class="message-qr-navigation" aria-label="분할 QR 이동">
          <button class="ghost" id="message-qr-previous" type="button">이전 QR</button>
          <strong id="message-qr-position">1 / 1</strong>
          <button class="ghost" id="message-qr-next" type="button">다음 QR</button>
        </div>
        <p class="test-hint" id="message-qr-help">휴대폰 카메라로 QR을 스캔하세요.</p>
      </section>

      <fieldset class="emoji-generator wide-field">
        <legend>기기 기본 이모지 테스트</legend>
        <div class="emoji-controls">
          <label>카테고리 <select id="emoji-category"><option value="all">전체</option><option value="single">단일 코드 포인트</option><option value="sequences">복합 이모지 (2개 이상)</option><option value="smileys">표정</option><option value="people">사람</option><option value="animals">동물·자연</option><option value="food">음식</option><option value="activity">활동</option><option value="travel">여행·장소</option><option value="objects">사물</option><option value="symbols">기호</option><option value="flags">국기</option></select></label>
          <label>검색 <input id="emoji-search" type="search" placeholder="이름 또는 키워드" autocomplete="off"></label>
          <label>무작위 개수 <input id="emoji-random-count" type="number" min="1" max="20" value="5" inputmode="numeric"></label>
          <button class="ghost" id="emoji-random" type="button">무작위로 넣기</button>
        </div>
        <p class="test-hint">이모지는 현재 기기와 브라우저의 기본 글꼴로 표시됩니다. 예: 👍🏽은 화면 1글자·코드 포인트 2개, 👨‍💻은 화면 1글자·코드 포인트 3개입니다.</p>
        <div class="emoji-grid" id="emoji-grid" aria-label="선택 가능한 기기 기본 이모지"></div>
        <p class="emoji-empty" id="emoji-empty" hidden>검색 조건에 맞는 이모지가 없습니다.</p>
      </fieldset>
      <p class="test-status" id="message-status" role="status" aria-live="polite">화면 글자, 코드 포인트, UTF-16 문자열 길이와 UTF-8 바이트를 실시간으로 계산합니다.</p>
    </form>
  </section>

  <section class="test-panel" id="contact-panel" role="tabpanel" aria-labelledby="contact-tab" data-panel="contact" hidden>
    <form class="test-form" id="test-contact-form">
      <label>생성 개수 <input id="contact-count" type="number" min="1" max="1000" value="10" required inputmode="numeric"></label>
      <label>국가
        <select id="contact-country">
          <option value="KR">대한민국 (+82)</option><option value="US">미국 (+1)</option><option value="CA">캐나다 (+1)</option><option value="GB">영국 (+44)</option><option value="JP">일본 (+81)</option><option value="AU">호주 (+61)</option><option value="SG">싱가포르 (+65)</option><option value="DE">독일 (+49)</option><option value="FR">프랑스 (+33)</option><option value="IN">인도 (+91)</option><option value="ID">인도네시아 (+62)</option><option value="TR">튀르키예 (+90)</option><option value="TM">투르크메니스탄 (+993)</option>
        </select>
      </label>
      <label>전화번호 시작값 <input id="contact-prefix" value="010" maxlength="5" required inputmode="numeric" autocomplete="off"><span id="contact-prefix-hint">대한민국 휴대전화 형식: 010</span></label>
      <label class="wide-field">미리보기</label>
      <div class="contact-preview wide-field" id="contact-preview" aria-live="polite"></div>
      <div class="test-actions"><button class="primary" type="submit">연락처 만들기</button><button class="ghost" id="contact-csv" type="button" disabled>CSV 다운로드</button></div>
      <p class="test-status" id="contact-status" role="status" aria-live="polite">국가별 국내 형식과 E.164 국제번호를 함께 생성합니다. 실제 발송에는 사용하지 마세요.</p>
    </form>
  </section>
</section>
<script defer src="/static/vendor/qrcode-generator.js"></script>
<script defer src="/static/test-data.js?v=<?= htmlspecialchars($testDataJsVersion, ENT_QUOTES, 'UTF-8') ?>"></script>

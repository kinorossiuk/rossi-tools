<?php
declare(strict_types=1);

$timerCssVersion = (string) (filemtime(__DIR__ . '/../static/timer.css') ?: '1');
$timerJsVersion = (string) (filemtime(__DIR__ . '/../static/timer.js') ?: '1');
?>
<link rel="stylesheet" href="/static/timer.css?v=<?= htmlspecialchars($timerCssVersion, ENT_QUOTES, 'UTF-8') ?>">
<section class="tool-view timer-tool" aria-labelledby="tool-title" data-timer-tool>
  <a class="back-link" href="/">← 모든 도구</a>
  <div class="tool-view-icon" aria-hidden="true">⏱</div>
  <p class="kicker">FOCUS / LOCAL TIMER</p>
  <h1 id="tool-title">집중<br>타이머</h1>
  <p class="tool-intro">현재 브라우저에서만 실행하는 타이머입니다. 종료 시 화면 강조, 소리, 허용된 경우 OS 알림으로 알려드립니다.</p>

  <section class="timer-display" aria-label="현재 타이머 상태">
    <p>현재 남은 시간</p>
    <output id="timer-remaining" aria-live="off">00:00:00</output>
    <span id="timer-target">시간을 설정하고 시작하세요.</span>
  </section>

  <div class="timer-controls">
    <div class="timer-duration"><label>시간 <input id="timer-hours" type="number" min="0" max="99" inputmode="numeric" value="0"></label><label>분 <input id="timer-minutes" type="number" min="0" max="59" inputmode="numeric" value="5"></label><label>초 <input id="timer-seconds" type="number" min="0" max="59" inputmode="numeric" value="0"></label></div>
    <div class="timer-adjust" role="group" aria-label="시간 조절"><button class="ghost" type="button" data-timer-adjust="-300" aria-label="5분 줄이기">−5분</button><button class="ghost" type="button" data-timer-adjust="-60" aria-label="1분 줄이기">−1분</button><button class="ghost" type="button" data-timer-adjust="60" aria-label="1분 늘리기">+1분</button><button class="ghost" type="button" data-timer-adjust="300" aria-label="5분 늘리기">+5분</button></div>
    <div class="timer-actions"><button class="primary" id="timer-start" type="button">시작</button><button class="ghost" id="timer-pause" type="button" disabled>일시정지</button><button class="ghost" id="timer-reset" type="button" disabled>초기화</button></div>
  </div>

  <section class="timer-options" aria-label="타이머 알림 설정">
    <div><strong>종료 소리</strong><span>타이머 종료 시 짧은 알림음을 재생합니다.</span><button class="ghost" id="timer-sound" type="button" aria-pressed="true">소리: 켜짐</button></div>
    <div><strong>OS 알림</strong><span id="timer-notification-copy">알림 권한을 허용하면 다른 앱을 보는 중에도 알려드립니다.</span><button class="ghost" id="timer-notification" type="button">알림 허용</button></div>
  </section>
  <p class="timer-notice">페이지·브라우저를 완전히 닫거나 기기가 절전 상태이면 알림이 지연되거나 울리지 않을 수 있습니다.</p>
  <p class="timer-status" id="timer-status" role="status" aria-live="polite">시간을 설정한 뒤 시작하세요.</p>
</section>
<script src="/static/timer.js?v=<?= htmlspecialchars($timerJsVersion, ENT_QUOTES, 'UTF-8') ?>" defer></script>

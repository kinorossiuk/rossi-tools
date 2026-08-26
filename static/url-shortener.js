(() => {
  'use strict';
  const root = document.querySelector('[data-url-shortener-tool]');
  if (!root) return;
  const endpoint = '/short-links.php';
  const csrf = root.dataset.csrf ?? '';
  const form = root.querySelector('#url-shortener-form');
  const input = root.querySelector('#url-shortener-input');
  const submit = root.querySelector('#url-shortener-submit');
  const result = root.querySelector('#url-shortener-result');
  const output = root.querySelector('#url-shortener-output');
  const destination = root.querySelector('#url-shortener-destination');
  const copyResult = root.querySelector('#url-shortener-copy');
  const status = root.querySelector('#url-shortener-status');
  const count = root.querySelector('#url-shortener-count');
  const reload = root.querySelector('#url-shortener-reload');
  const items = root.querySelector('#url-shortener-items');
  const dateFormatter = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const shortUrl = (code) => `${window.location.origin}/s/${code}`;
  const setStatus = (message, isError = false) => { status.textContent = message; status.classList.toggle('is-error', isError); };
  const copyText = async (value) => {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(value);
    const temporary = document.createElement('textarea'); temporary.value = value; temporary.setAttribute('readonly', ''); temporary.style.cssText = 'position:fixed;opacity:0'; document.body.append(temporary); temporary.select();
    const copied = document.execCommand('copy'); temporary.remove(); if (!copied) throw new Error('클립보드 복사를 지원하지 않는 브라우저입니다.');
  };
  const request = async (options = {}) => {
    const response = await fetch(endpoint, { credentials: 'same-origin', headers: options.body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : undefined, ...options });
    let payload; try { payload = await response.json(); } catch (_) { throw new Error('서버 응답을 확인할 수 없습니다.'); }
    if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : '요청을 처리하지 못했습니다.');
    return payload;
  };
  const showResult = (link, created) => {
    output.value = shortUrl(link.code); destination.textContent = `원본: ${link.url}`; result.hidden = false; output.focus(); output.select();
    setStatus(created ? 'URL을 압축했습니다. 복사 버튼으로 바로 사용할 수 있습니다.' : '같은 URL의 기존 단축 주소를 불러왔습니다.');
  };
  const makeButton = (label, className, handler) => { const button = document.createElement('button'); button.type = 'button'; button.className = className; button.textContent = label; button.addEventListener('click', handler); return button; };
  const render = (links) => {
    items.replaceChildren(); count.textContent = `${links.length.toLocaleString('ko-KR')}개 저장됨 · 최대 500개`;
    if (links.length === 0) { const empty = document.createElement('p'); empty.className = 'url-shortener-empty'; empty.textContent = '저장된 단축 URL이 없습니다.'; items.append(empty); return; }
    links.forEach((link) => {
      const compact = shortUrl(link.code); const article = document.createElement('article'); article.className = 'url-shortener-item'; const main = document.createElement('div'); main.className = 'url-shortener-item-main';
      const shortAnchor = document.createElement('a'); shortAnchor.className = 'url-shortener-item-short'; shortAnchor.href = compact; shortAnchor.target = '_blank'; shortAnchor.rel = 'noopener noreferrer'; shortAnchor.textContent = compact;
      const original = document.createElement('p'); original.className = 'url-shortener-item-url'; original.textContent = link.url;
      const created = document.createElement('time'); created.dateTime = link.created_at; created.textContent = `${dateFormatter.format(new Date(link.created_at))} 생성`; main.append(shortAnchor, original, created);
      const actions = document.createElement('div'); actions.className = 'url-shortener-item-actions';
      actions.append(makeButton('복사', 'ghost', async () => { try { await copyText(compact); setStatus('단축 URL을 클립보드에 복사했습니다.'); } catch (error) { setStatus(error instanceof Error ? error.message : '복사하지 못했습니다.', true); } }), makeButton('삭제', 'ghost url-shortener-delete', async (event) => {
        if (!window.confirm('이 단축 URL을 삭제할까요? 삭제하면 주소가 더 이상 작동하지 않습니다.')) return; const button = event.currentTarget; button.disabled = true;
        try { await request({ method: 'POST', body: JSON.stringify({ action: 'delete', code: link.code }) }); if (output.value === compact) result.hidden = true; setStatus('단축 URL을 삭제했습니다.'); await loadLinks(false); } catch (error) { button.disabled = false; setStatus(error instanceof Error ? error.message : '삭제하지 못했습니다.', true); }
      })); article.append(main, actions); items.append(article);
    });
  };
  const loadLinks = async (announce = true) => { reload.disabled = true; try { const payload = await request(); render(Array.isArray(payload.links) ? payload.links : []); if (announce) setStatus('저장된 단축 URL 목록을 불러왔습니다.'); } catch (error) { items.replaceChildren(); count.textContent = '목록을 불러오지 못함'; setStatus(error instanceof Error ? error.message : '목록을 불러오지 못했습니다.', true); } finally { reload.disabled = false; } };
  form.addEventListener('submit', async (event) => { event.preventDefault(); if (!input.value.trim()) { setStatus('압축할 URL을 입력해 주세요.', true); input.focus(); return; } submit.disabled = true; submit.textContent = '압축 중…'; try { const payload = await request({ method: 'POST', body: JSON.stringify({ action: 'create', url: input.value }) }); showResult(payload.link, payload.created === true); await loadLinks(false); } catch (error) { result.hidden = true; setStatus(error instanceof Error ? error.message : 'URL을 압축하지 못했습니다.', true); } finally { submit.disabled = false; submit.textContent = 'URL 압축'; } });
  copyResult.addEventListener('click', async () => { try { await copyText(output.value); copyResult.textContent = '복사됨'; setStatus('단축 URL을 클립보드에 복사했습니다.'); window.setTimeout(() => { copyResult.textContent = '복사'; }, 1400); } catch (error) { setStatus(error instanceof Error ? error.message : '복사하지 못했습니다.', true); } });
  reload.addEventListener('click', () => { loadLinks(); }); loadLinks(false);
})();

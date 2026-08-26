(() => {
  'use strict';
  const legacyStorageKey = 'rossi-tools-work-links-v1';
  const storageKey = 'rossi-tools-work-links-v2';
  const maxLinks = 100;
  const maxFilters = 30;
  const grid = document.querySelector('#work-link-grid');
  const filtersRoot = document.querySelector('#work-link-filters');
  const dialog = document.querySelector('#work-link-dialog');
  const form = document.querySelector('#work-link-form');
  const idInput = document.querySelector('#work-link-id');
  const nameInput = document.querySelector('#work-link-name');
  const urlInput = document.querySelector('#work-link-url');
  const filterInput = document.querySelector('#work-link-filter');
  const error = document.querySelector('#work-link-error');
  const deleteButton = document.querySelector('#delete-work-link');
  const summary = document.querySelector('#work-link-summary');
  const addFilterButton = document.querySelector('#add-work-filter');
  const editFilterButton = document.querySelector('#edit-work-filter');
  if (!grid || !filtersRoot || !dialog || !form || !idInput || !nameInput || !urlInput || !filterInput || !error || !deleteButton || !summary || !addFilterButton || !editFilterButton) return;

  const normaliseUrl = (value) => {
    const candidate = value.trim(); if (!candidate) return null;
    try { const url = new URL(candidate); return url.protocol === 'http:' || url.protocol === 'https:' ? url : null; } catch (_) { return null; }
  };
  const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const cleanName = (value, limit) => value.trim().replace(/\s+/g, ' ').slice(0, limit);
  const cleanLinks = (value, validFilterIds = new Set()) => Array.isArray(value) ? value.filter((link) => link && typeof link.id === 'string' && typeof link.name === 'string' && cleanName(link.name, 50) !== '' && typeof link.url === 'string' && normaliseUrl(link.url)).slice(0, maxLinks).map((link) => ({ id: link.id, name: cleanName(link.name, 50), url: normaliseUrl(link.url).href, favorite: link.favorite === true, filterId: typeof link.filterId === 'string' && validFilterIds.has(link.filterId) ? link.filterId : '' })) : [];
  const readState = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
      if (saved && typeof saved === 'object' && Array.isArray(saved.filters) && Array.isArray(saved.links)) {
        const filters = saved.filters.filter((filter) => filter && typeof filter.id === 'string' && typeof filter.name === 'string' && cleanName(filter.name, 30) !== '').slice(0, maxFilters).map((filter) => ({ id: filter.id, name: cleanName(filter.name, 30) }));
        return { filters, links: cleanLinks(saved.links, new Set(filters.map((filter) => filter.id))) };
      }
      return { filters: [], links: cleanLinks(JSON.parse(localStorage.getItem(legacyStorageKey) ?? '[]')) };
    } catch (_) { return { filters: [], links: [] }; }
  };
  let state = readState();
  let selectedFilterId = 'all';
  const writeState = () => { try { localStorage.setItem(storageKey, JSON.stringify({ version: 2, filters: state.filters, links: state.links })); return true; } catch (_) { error.textContent = '브라우저 저장소를 사용할 수 없습니다.'; return false; } };
  writeState();
  const selectedFilter = () => state.filters.find((filter) => filter.id === selectedFilterId) ?? null;
  const linksForSelection = () => selectedFilterId === 'all' ? state.links : state.links.filter((link) => link.filterId === selectedFilterId);
  const populateFilterOptions = (selected = '') => { filterInput.replaceChildren(); const none = document.createElement('option'); none.value = ''; none.textContent = '필터 없음'; filterInput.append(none); state.filters.forEach((filter) => { const option = document.createElement('option'); option.value = filter.id; option.textContent = filter.name; filterInput.append(option); }); filterInput.value = state.filters.some((filter) => filter.id === selected) ? selected : ''; };
  const renderFilters = () => {
    filtersRoot.replaceChildren(); [{ id: 'all', name: '전체' }, ...state.filters].forEach((filter) => { const button = document.createElement('button'); button.type = 'button'; button.className = 'work-link-filter'; button.textContent = filter.name; button.setAttribute('aria-pressed', String(selectedFilterId === filter.id)); button.addEventListener('click', () => { selectedFilterId = filter.id; render(); }); filtersRoot.append(button); });
    editFilterButton.hidden = selectedFilterId === 'all';
  };
  const render = () => {
    renderFilters(); grid.replaceChildren();
    const visibleLinks = linksForSelection().map((link, index) => ({ link, index })).sort((left, right) => Number(right.link.favorite) - Number(left.link.favorite) || left.index - right.index).map(({ link }) => link);
    const filter = selectedFilter(); summary.textContent = `${state.links.length} / ${maxLinks}개 · ${filter ? `${filter.name} 필터` : '전체'} · 현재 브라우저에 저장`;
    if (visibleLinks.length === 0) { const empty = document.createElement('div'); empty.className = 'work-link-empty'; empty.textContent = filter ? `“${filter.name}” 필터에 등록된 업무 도구가 없습니다.` : '등록된 업무 도구가 없습니다. “링크 등록”을 눌러 사내 도구를 추가해 주세요.'; grid.append(empty); return; }
    visibleLinks.forEach((link) => {
      const url = normaliseUrl(link.url); if (!url) return;
      const card = document.createElement('article'); card.className = 'work-link-card'; const top = document.createElement('div'); top.className = 'work-link-card-top'; const copy = document.createElement('div');
      const name = document.createElement('h3'); name.textContent = link.name; const host = document.createElement('p'); host.className = 'work-link-host'; host.textContent = url.host; const actions = document.createElement('div'); actions.className = 'work-link-card-actions';
      const favorite = document.createElement('button'); favorite.className = 'work-link-favorite'; favorite.type = 'button'; favorite.dataset.favoriteLinkId = link.id; favorite.textContent = link.favorite ? '★' : '☆'; favorite.setAttribute('aria-pressed', String(link.favorite)); favorite.setAttribute('aria-label', `${link.name} ${link.favorite ? '상단 고정 해제' : '상단에 고정'}`); favorite.title = link.favorite ? '상단 고정 해제' : '상단에 고정';
      const edit = document.createElement('button'); edit.className = 'work-link-edit'; edit.type = 'button'; edit.dataset.editLinkId = link.id; edit.textContent = '설정'; edit.setAttribute('aria-label', `${link.name} 링크 설정`); copy.append(name, host); actions.append(favorite, edit); top.append(copy, actions);
      const open = document.createElement('a'); open.className = 'work-link-open'; open.href = url.href; open.target = '_blank'; open.rel = 'noopener noreferrer'; const openText = document.createElement('span'); openText.textContent = '새 탭에서 열기'; const arrow = document.createElement('span'); arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '↗'; open.append(openText, arrow); card.append(top, open); grid.append(card);
    });
  };
  const openDialog = (link = null) => { form.reset(); error.textContent = ''; idInput.value = link?.id ?? ''; nameInput.value = link?.name ?? ''; urlInput.value = link?.url ?? ''; populateFilterOptions(link?.filterId ?? (selectedFilterId === 'all' ? '' : selectedFilterId)); deleteButton.hidden = !link; dialog.querySelector('#work-link-dialog-title').textContent = link ? '업무 도구 수정' : '업무 도구 등록'; dialog.showModal(); nameInput.focus(); };
  document.querySelector('#add-work-link')?.addEventListener('click', () => openDialog());
  document.querySelectorAll('[data-dialog-close]').forEach((button) => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  grid.addEventListener('click', (event) => { const favorite = event.target.closest('[data-favorite-link-id]'); if (favorite) { const link = state.links.find((item) => item.id === favorite.dataset.favoriteLinkId); if (!link) return; link.favorite = !link.favorite; if (!writeState()) link.favorite = !link.favorite; render(); return; } const edit = event.target.closest('[data-edit-link-id]'); if (!edit) return; const link = state.links.find((item) => item.id === edit.dataset.editLinkId); if (link) openDialog(link); });
  addFilterButton.addEventListener('click', () => { const value = window.prompt('새 필터 이름을 입력해 주세요. 예: 업무, 개발, 쇼핑'); if (value === null) return; const name = cleanName(value, 30); if (!name) return; if (state.filters.some((filter) => filter.name.toLocaleLowerCase('ko-KR') === name.toLocaleLowerCase('ko-KR'))) { window.alert('같은 이름의 필터가 이미 있습니다.'); return; } if (state.filters.length >= maxFilters) { window.alert(`필터는 최대 ${maxFilters}개까지 만들 수 있습니다.`); return; } const filter = { id: createId(), name }; state.filters.push(filter); if (!writeState()) { state.filters.pop(); return; } selectedFilterId = filter.id; render(); });
  editFilterButton.addEventListener('click', () => { const filter = selectedFilter(); if (!filter) return; const value = window.prompt('필터 이름을 수정하세요. 빈 값으로 저장하면 필터를 삭제합니다.', filter.name); if (value === null) return; const name = cleanName(value, 30); if (!name) { if (!window.confirm(`“${filter.name}” 필터를 삭제할까요? 링크는 삭제되지 않고 전체 목록에 남습니다.`)) return; state.links.forEach((link) => { if (link.filterId === filter.id) link.filterId = ''; }); state.filters = state.filters.filter((item) => item.id !== filter.id); selectedFilterId = 'all'; writeState(); render(); return; } if (state.filters.some((item) => item.id !== filter.id && item.name.toLocaleLowerCase('ko-KR') === name.toLocaleLowerCase('ko-KR'))) { window.alert('같은 이름의 필터가 이미 있습니다.'); return; } filter.name = name; if (writeState()) render(); });
  form.addEventListener('submit', (event) => { event.preventDefault(); const name = cleanName(nameInput.value, 50); const url = normaliseUrl(urlInput.value); if (!name) { error.textContent = '도구 이름을 입력해 주세요.'; nameInput.focus(); return; } if (!url) { error.textContent = 'http:// 또는 https://로 시작하는 올바른 주소를 입력해 주세요.'; urlInput.focus(); return; } if (!idInput.value && state.links.length >= maxLinks) { error.textContent = `업무 도구는 최대 ${maxLinks}개까지 등록할 수 있습니다.`; return; } const filterId = state.filters.some((filter) => filter.id === filterInput.value) ? filterInput.value : ''; const savedLink = { id: idInput.value || createId(), name, url: url.href, favorite: false, filterId }; const index = state.links.findIndex((link) => link.id === savedLink.id); if (index >= 0) state.links[index] = { ...savedLink, favorite: state.links[index].favorite }; else state.links.push(savedLink); if (!writeState()) return; render(); dialog.close(); });
  deleteButton.addEventListener('click', () => { const link = state.links.find((item) => item.id === idInput.value); if (!link || !window.confirm(`“${link.name}” 링크를 삭제할까요?`)) return; state.links = state.links.filter((item) => item.id !== link.id); if (!writeState()) return; render(); dialog.close(); });
  render();
})();

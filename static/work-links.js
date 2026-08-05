(() => {
  'use strict';

  const storageKey = 'rossi-tools-work-links-v1';
  const maxLinks = 100;
  const initialVisibleLinks = 12;
  const grid = document.querySelector('#work-link-grid');
  const dialog = document.querySelector('#work-link-dialog');
  const form = document.querySelector('#work-link-form');
  const idInput = document.querySelector('#work-link-id');
  const nameInput = document.querySelector('#work-link-name');
  const urlInput = document.querySelector('#work-link-url');
  const error = document.querySelector('#work-link-error');
  const deleteButton = document.querySelector('#delete-work-link');
  const summary = document.querySelector('#work-link-summary');
  const toggleButton = document.querySelector('#toggle-work-links');

  if (!grid || !dialog || !form || !idInput || !nameInput || !urlInput || !error
    || !deleteButton || !summary || !toggleButton) return;

  const normalizedUrl = (value) => {
    const candidate = value.trim();
    if (!candidate) return null;

    try {
      const url = new URL(candidate);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
    } catch (_) {
      return null;
    }
  };

  const readLinks = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      if (!Array.isArray(saved)) return [];

      return saved.filter((link) => {
        return link && typeof link.id === 'string' && typeof link.name === 'string'
          && link.name.trim() !== '' && typeof link.url === 'string' && normalizedUrl(link.url);
      }).slice(0, maxLinks).map((link) => ({
        id: link.id,
        name: link.name,
        url: link.url,
        favorite: link.favorite === true,
      }));
    } catch (_) {
      return [];
    }
  };

  let links = readLinks();
  let showAll = false;

  const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  const writeLinks = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(links));
      return true;
    } catch (_) {
      error.textContent = '브라우저 저장소를 사용할 수 없습니다.';
      return false;
    }
  };

  const render = () => {
    grid.replaceChildren();
    summary.textContent = `${links.length} / ${maxLinks}개 · 현재 브라우저에 저장`;
    toggleButton.hidden = links.length <= initialVisibleLinks;
    toggleButton.setAttribute('aria-expanded', String(showAll));
    toggleButton.textContent = showAll ? '접기' : `전체 보기 (${links.length})`;

    if (links.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'work-link-empty';
      empty.textContent = '등록된 업무 도구가 없습니다. “링크 등록”을 눌러 사내 도구를 추가해 주세요.';
      grid.append(empty);
      return;
    }

    const orderedLinks = links.map((link, index) => ({ link, index }))
      .sort((left, right) => Number(right.link.favorite) - Number(left.link.favorite) || left.index - right.index)
      .map(({ link }) => link);
    const visibleLinks = showAll ? orderedLinks : orderedLinks.slice(0, initialVisibleLinks);

    visibleLinks.forEach((link) => {
      const url = normalizedUrl(link.url);
      if (!url) return;

      const card = document.createElement('article');
      card.className = 'work-link-card';

      const top = document.createElement('div');
      top.className = 'work-link-card-top';
      const copy = document.createElement('div');
      const name = document.createElement('h3');
      name.textContent = link.name;
      const host = document.createElement('p');
      host.className = 'work-link-host';
      host.textContent = url.host;
      const actions = document.createElement('div');
      actions.className = 'work-link-card-actions';
      const favorite = document.createElement('button');
      favorite.className = 'work-link-favorite';
      favorite.type = 'button';
      favorite.dataset.favoriteLinkId = link.id;
      favorite.textContent = link.favorite ? '★' : '☆';
      favorite.setAttribute('aria-pressed', String(link.favorite));
      favorite.setAttribute('aria-label', `${link.name} ${link.favorite ? '상단 고정 해제' : '상단에 고정'}`);
      favorite.title = link.favorite ? '상단 고정 해제' : '상단에 고정';
      const edit = document.createElement('button');
      edit.className = 'work-link-edit';
      edit.type = 'button';
      edit.dataset.editLinkId = link.id;
      edit.textContent = '설정';
      edit.setAttribute('aria-label', `${link.name} 링크 설정`);
      copy.append(name, host);
      actions.append(favorite, edit);
      top.append(copy, actions);

      const open = document.createElement('a');
      open.className = 'work-link-open';
      open.href = url.href;
      open.target = '_blank';
      open.rel = 'noopener noreferrer';
      const openText = document.createElement('span');
      openText.textContent = '새 탭에서 열기';
      const arrow = document.createElement('span');
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '↗';
      open.append(openText, arrow);

      card.append(top, open);
      grid.append(card);
    });
  };

  const openDialog = (link = null) => {
    form.reset();
    error.textContent = '';
    idInput.value = link?.id ?? '';
    nameInput.value = link?.name ?? '';
    urlInput.value = link?.url ?? '';
    deleteButton.hidden = !link;
    dialog.querySelector('#work-link-dialog-title').textContent = link ? '업무 도구 수정' : '업무 도구 등록';
    dialog.showModal();
    nameInput.focus();
  };

  document.querySelector('#add-work-link')?.addEventListener('click', () => openDialog());
  toggleButton.addEventListener('click', () => {
    showAll = !showAll;
    render();
  });
  document.querySelectorAll('[data-dialog-close]').forEach((button) => {
    button.addEventListener('click', () => dialog.close());
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  grid.addEventListener('click', (event) => {
    const favorite = event.target.closest('[data-favorite-link-id]');
    if (favorite) {
      const link = links.find((item) => item.id === favorite.dataset.favoriteLinkId);
      if (!link) return;
      link.favorite = !link.favorite;
      if (!writeLinks()) link.favorite = !link.favorite;
      render();
      return;
    }

    const edit = event.target.closest('[data-edit-link-id]');
    if (!edit) return;
    const link = links.find((item) => item.id === edit.dataset.editLinkId);
    if (link) openDialog(link);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const url = normalizedUrl(urlInput.value);

    if (!name) {
      error.textContent = '도구 이름을 입력해 주세요.';
      nameInput.focus();
      return;
    }
    if (!url) {
      error.textContent = 'http:// 또는 https://로 시작하는 올바른 주소를 입력해 주세요.';
      urlInput.focus();
      return;
    }
    if (!idInput.value && links.length >= maxLinks) {
      error.textContent = `업무 도구는 최대 ${maxLinks}개까지 등록할 수 있습니다.`;
      return;
    }

    const savedLink = { id: idInput.value || createId(), name, url: url.href, favorite: false };
    const index = links.findIndex((link) => link.id === savedLink.id);
    if (index >= 0) links[index] = { ...savedLink, favorite: links[index].favorite };
    else {
      links.push(savedLink);
      showAll = links.length > initialVisibleLinks;
    }

    if (!writeLinks()) return;
    render();
    dialog.close();
  });

  deleteButton.addEventListener('click', () => {
    const link = links.find((item) => item.id === idInput.value);
    if (!link || !window.confirm(`“${link.name}” 링크를 삭제할까요?`)) return;
    links = links.filter((item) => item.id !== link.id);
    if (links.length <= initialVisibleLinks) showAll = false;
    if (!writeLinks()) return;
    render();
    dialog.close();
  });

  render();
})();

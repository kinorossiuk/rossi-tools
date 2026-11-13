(() => {
  'use strict';

  const root = document.querySelector('[data-test-data-tool]');
  const helpers = window.RossiTestData;
  if (!root || !helpers) return;

  const form = root.querySelector('#portrait-form');
  const preset = root.querySelector('#portrait-preset');
  const summary = root.querySelector('#portrait-summary');
  const preview = root.querySelector('#portrait-preview');
  const status = root.querySelector('#portrait-status');
  const generateButton = root.querySelector('#portrait-generate');
  const cancelButton = root.querySelector('#portrait-cancel');
  const downloadButton = root.querySelector('#portrait-download');
  const groupsButton = root.querySelector('#portrait-groups');
  const resetButton = root.querySelector('#portrait-reset');
  const groupsOutput = root.querySelector('#portrait-groups-output');
  const groupsList = root.querySelector('#portrait-groups-list');
  const imageSize = 512;
  const stateKey = 'rossi-test-data-portrait-groups-v2';
  const atlasUrl = '/static/portraits/fictional-adults-v1.png';
  const atlasColumns = 5;
  const atlasRows = 4;
  const sourceCount = atlasColumns * atlasRows;
  let portraitAtlas = null;
  const presets = {
    sample: { people: 3, perPerson: 5, label: '샘플 15장' },
    full: { people: 20, perPerson: 10, label: '전체 200장' },
  };
  let activeGeneration = null;
  let archive = null;
  let currentRecords = [];
  let previewUrls = [];

  const setStatus = (text, isError = false) => {
    status.textContent = text;
    status.classList.toggle('is-error', isError);
  };

  const randomUint32 = () => {
    if (window.crypto?.getRandomValues) {
      const values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      return values[0];
    }
    return Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
  };

  const seededRandom = (seed) => {
    let value = seed >>> 0;
    return () => {
      value = (value + 0x6d2b79f5) >>> 0;
      let mixed = value;
      mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 0x1_0000_0000;
    };
  };

  // These are mild augmentations of one source photo, not separate photo sessions.
  const createVariant = (identity, index) => {
    const random = seededRandom((identity.seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0);
    return {
      index,
      offsetX: Math.floor(-3 + random() * 7),
      offsetY: Math.floor(-3 + random() * 7),
      scale: 1.02 + random() * .03,
      rotation: (random() - .5) * .035,
      light: .96 + index * .008,
    };
  };

  const loadPortraitAtlas = async (signal) => {
    if (portraitAtlas) return portraitAtlas;
    const response = await fetch(atlasUrl, { signal });
    if (!response.ok) throw new Error('기본 인물 사진을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    const bitmap = await createImageBitmap(await response.blob());
    if (bitmap.width < atlasColumns * 128 || bitmap.height < atlasRows * 128 || Math.abs(bitmap.width / atlasColumns - bitmap.height / atlasRows) > 1) {
      bitmap.close();
      throw new Error('기본 인물 사진의 크기가 올바르지 않습니다.');
    }
    portraitAtlas = bitmap;
    return bitmap;
  };

  const readState = () => {
    let raw;
    try { raw = window.localStorage.getItem(stateKey); }
    catch (_) { throw new Error('파일명 중복 방지와 정답 그룹 보관에 브라우저 저장소가 필요합니다.'); }
    if (raw === null) return { version: 2, signatures: [], fileNames: [], lastBatch: null };
    try {
      const state = JSON.parse(raw);
      if (state?.version === 2 && Array.isArray(state.signatures) && Array.isArray(state.fileNames) && (state.lastBatch === null || typeof state.lastBatch === 'object')) return state;
    } catch (_) { /* The reset button is the recovery path for invalid state. */ }
    throw new Error('인물 생성 이력을 읽을 수 없습니다. 인물 생성 이력 초기화 후 다시 시도해 주세요.');
  };

  const writeState = (state) => {
    try { window.localStorage.setItem(stateKey, JSON.stringify(state)); }
    catch (_) { throw new Error('인물 생성 이력을 저장하지 못했습니다. 결과를 내려받을 수 없습니다.'); }
  };

  const randomFileName = (usedNames) => {
    let name;
    do {
      name = `${randomUint32().toString(36).padStart(7, '0')}-${randomUint32().toString(36).padStart(7, '0')}.jpg`;
    } while (usedNames.has(name));
    return name;
  };

  const makePlan = (config, state) => {
    const signatures = new Set(state.signatures);
    const fileNames = new Set(state.fileNames);
    // A fixed, bundled set: regenerating reuses identities instead of claiming new people.
    const identities = helpers.shuffled(Array.from({ length: sourceCount }, (_, source) => ({
      source,
      seed: randomUint32(),
      signature: `fictional-adults-v1:${source}`,
    }))).slice(0, config.people);
    identities.forEach((identity) => signatures.add(identity.signature));
    const records = [];
    identities.forEach((identity, person) => {
      for (let index = 0; index < config.perPerson; index += 1) {
        const name = randomFileName(fileNames);
        fileNames.add(name);
        records.push({ name, person, identity, variant: createVariant(identity, index) });
      }
    });
    return {
      records: helpers.shuffled(records),
      state: {
        version: 2,
        signatures: [...signatures],
        fileNames: [...fileNames],
        lastBatch: null,
      },
    };
  };

  const renderPortrait = (canvas, identity, variant) => {
    if (!portraitAtlas) throw new Error('기본 인물 사진을 먼저 불러와야 합니다.');
    canvas.width = imageSize;
    canvas.height = imageSize;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('이 브라우저는 JPG 인물 사진 생성에 필요한 Canvas를 지원하지 않습니다.');
    const cellWidth = portraitAtlas.width / atlasColumns;
    const cellHeight = portraitAtlas.height / atlasRows;
    const sourceX = (identity.source % atlasColumns) * cellWidth;
    const sourceY = Math.floor(identity.source / atlasColumns) * cellHeight;
    context.fillStyle = '#d7d7d7';
    context.fillRect(0, 0, imageSize, imageSize);
    context.save();
    context.translate(imageSize / 2 + variant.offsetX, imageSize / 2 + variant.offsetY);
    context.rotate(variant.rotation);
    context.scale(variant.scale, variant.scale);
    context.filter = `brightness(${variant.light})`;
    // Inset the crop to avoid pulling a neighboring identity across a cell edge.
    context.drawImage(portraitAtlas, sourceX + 2, sourceY + 2, cellWidth - 4, cellHeight - 4, -imageSize / 2, -imageSize / 2, imageSize, imageSize);
    context.restore();
  };

  const canvasToJpeg = (canvas) => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== 'image/jpeg') { reject(new Error('JPG 인코딩에 실패했습니다.')); return; }
      resolve(blob);
    }, 'image/jpeg', .9);
  });

  const nextFrame = () => new Promise((resolve) => window.setTimeout(resolve, 0));

  const clearPreview = () => {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    previewUrls = [];
    preview.replaceChildren();
  };

  const showEmptyPreview = () => {
    clearPreview();
    const empty = document.createElement('p');
    empty.textContent = '아직 생성한 인물 사진이 없습니다.';
    preview.append(empty);
  };

  const addPreviewCard = (container, source, name) => {
    const figure = document.createElement('figure');
    figure.className = 'portrait-card';
    const image = document.createElement('img');
    image.src = source;
    image.alt = 'AI로 생성한 실사 가상 인물 사진';
    const caption = document.createElement('figcaption');
    caption.textContent = name;
    figure.append(image, caption);
    container.append(figure);
  };

  const renderPreview = (records) => {
    clearPreview();
    records.slice(0, 30).forEach((record) => {
      const url = URL.createObjectURL(record.blob);
      previewUrls.push(url);
      addPreviewCard(preview, url, record.name);
    });
  };

  const thumbnailFor = (record) => {
    const source = document.createElement('canvas');
    renderPortrait(source, record.identity, record.variant);
    const thumbnail = document.createElement('canvas');
    thumbnail.width = 112;
    thumbnail.height = 112;
    thumbnail.getContext('2d').drawImage(source, 0, 0, 112, 112);
    return thumbnail.toDataURL('image/jpeg', .76);
  };

  const renderGroups = (records) => {
    groupsList.replaceChildren();
    const people = new Map();
    records.forEach((record) => { if (!people.has(record.person)) people.set(record.person, []); people.get(record.person).push(record); });
    [...people.entries()].sort(([left], [right]) => left - right).forEach(([person, items]) => {
      const group = document.createElement('section');
      group.className = 'portrait-group';
      const heading = document.createElement('h3');
      heading.textContent = `그룹 ${person + 1} · ${items.length}장`;
      const cards = document.createElement('div');
      cards.className = 'portrait-preview';
      items.forEach((item) => addPreviewCard(cards, thumbnailFor(item), item.name));
      group.append(heading, cards);
      groupsList.append(group);
    });
  };

  const renderSummary = (config) => {
    const total = config.people * config.perPerson;
    summary.replaceChildren();
    [['이번 생성', `${config.people}명 · ${total}장`], ['인물당 표본', `${config.perPerson}장`], ['기본 제공 인물', `${sourceCount}명 (재사용)`], ['이미지', '512 × 512 JPG']].forEach(([label, value]) => {
      const item = document.createElement('div');
      const itemLabel = document.createElement('span');
      itemLabel.textContent = label;
      const strong = document.createElement('strong');
      strong.textContent = value;
      item.append(itemLabel, strong);
      summary.append(item);
    });
  };

  const setBusy = (busy) => {
    generateButton.disabled = busy;
    preset.disabled = busy;
    cancelButton.disabled = !busy || !activeGeneration;
    resetButton.disabled = busy;
    downloadButton.disabled = busy || !archive;
    groupsButton.disabled = busy || currentRecords.length === 0;
  };

  const updatePresetButton = () => {
    const config = presets[preset.value] || presets.sample;
    generateButton.textContent = `${config.label} 만들기`;
  };

  const recordForStorage = (record) => ({ name: record.name, person: record.person, identity: record.identity, variant: record.variant });

  const generate = async () => {
    if (activeGeneration) return;
    const config = presets[preset.value] || presets.sample;
    let state;
    let plan;
    try { state = readState(); plan = makePlan(config, state); }
    catch (error) { setStatus(error instanceof Error ? error.message : '인물 사진 준비에 실패했습니다.', true); return; }
    activeGeneration = { cancelled: false, controller: new AbortController() };
    setBusy(true);
    groupsOutput.hidden = true;
    groupsButton.textContent = '정답 그룹 보기';
    const canvas = document.createElement('canvas');
    const generated = [];
    try {
      setStatus('기본 실사 인물 사진을 불러오는 중…');
      await loadPortraitAtlas(activeGeneration.controller.signal);
      for (let index = 0; index < plan.records.length; index += 1) {
        if (activeGeneration.cancelled) throw new Error('cancelled');
        const record = plan.records[index];
        renderPortrait(canvas, record.identity, record.variant);
        const blob = await canvasToJpeg(canvas);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) throw new Error('유효한 JPG 파일을 만들지 못했습니다.');
        generated.push({ ...record, blob, bytes });
        setStatus(`${config.label} 생성 중… ${index + 1} / ${plan.records.length}`);
        await nextFrame();
      }
      if (activeGeneration.cancelled) throw new Error('cancelled');
      const zipData = helpers.zip(generated.map((record) => ({ name: record.name, data: record.bytes })));
      const generatedArchive = new Blob([zipData], { type: 'application/zip' });
      const storedRecords = generated.map(recordForStorage);
      plan.state.lastBatch = { people: config.people, perPerson: config.perPerson, records: storedRecords };
      writeState(plan.state);
      archive = generatedArchive;
      currentRecords = generated;
      renderPreview(currentRecords);
      renderSummary(config);
      setStatus(`${config.label}의 JPG ${generated.length.toLocaleString('ko-KR')}장을 만들었습니다. 기본 제공 20명의 원본을 재사용한 변형 사진이며, ZIP에는 JPG만 들어 있습니다.`);
    } catch (error) {
      if (activeGeneration.cancelled || (error instanceof Error && error.message === 'cancelled')) setStatus('생성을 취소했습니다. 취소된 묶음은 저장하거나 내려받지 않습니다.');
      else setStatus(error instanceof Error ? error.message : '인물 사진을 만들지 못했습니다.', true);
    } finally {
      activeGeneration = null;
      setBusy(false);
    }
  };

  form.addEventListener('submit', (event) => { event.preventDefault(); generate(); });
  cancelButton.addEventListener('click', () => { if (activeGeneration) { activeGeneration.cancelled = true; activeGeneration.controller.abort(); cancelButton.disabled = true; setStatus('생성을 취소하고 있습니다…'); } });
  downloadButton.addEventListener('click', () => {
    if (!archive) return;
    helpers.download(archive, `portrait-grouping-${currentRecords.length}-jpg.zip`);
    setStatus('JPG만 포함된 ZIP 파일의 다운로드를 요청했습니다.');
  });
  groupsButton.addEventListener('click', async () => {
    if (activeGeneration || currentRecords.length === 0) return;
    if (!groupsOutput.hidden) {
      groupsOutput.hidden = true;
      groupsButton.textContent = '정답 그룹 보기';
      return;
    }
    setBusy(true);
    try {
      await loadPortraitAtlas();
      renderGroups(currentRecords);
      groupsOutput.hidden = false;
      groupsButton.textContent = '정답 그룹 숨기기';
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '정답 그룹을 표시하지 못했습니다.', true);
    } finally { setBusy(false); }
  });
  resetButton.addEventListener('click', () => {
    if (activeGeneration) return;
    try {
      window.localStorage.removeItem(stateKey);
      archive = null;
      currentRecords = [];
      showEmptyPreview();
      groupsOutput.hidden = true;
      groupsList.replaceChildren();
      groupsButton.textContent = '정답 그룹 보기';
      renderSummary(presets[preset.value] || presets.sample);
      setBusy(false);
      setStatus('파일명과 정답 그룹 이력을 초기화했습니다. 기본 제공 인물 20명은 그대로 재사용됩니다.');
    } catch (_) { setStatus('인물 생성 이력을 초기화하지 못했습니다.', true); }
  });
  preset.addEventListener('change', () => { updatePresetButton(); try { renderSummary(presets[preset.value] || presets.sample); } catch (_) { /* Generation reports storage errors. */ } });

  try {
    const state = readState();
    updatePresetButton();
    renderSummary(presets[preset.value] || presets.sample);
    if (state.lastBatch?.records?.length) {
      currentRecords = state.lastBatch.records;
      groupsButton.disabled = false;
      setStatus(`마지막 생성 묶음의 정답 그룹 ${currentRecords.length.toLocaleString('ko-KR')}장을 이 브라우저에서 확인할 수 있습니다.`);
    }
  } catch (error) { setStatus(error instanceof Error ? error.message : '인물 생성 이력을 읽을 수 없습니다.', true); }
})();

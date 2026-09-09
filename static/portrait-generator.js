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
  const stateKey = 'rossi-test-data-portrait-groups-v1';
  const presets = {
    sample: { people: 3, perPerson: 5, label: '샘플 15장' },
    full: { people: 20, perPerson: 10, label: '전체 200장' },
  };
  const skinTones = ['#f4c5a5', '#e2a27e', '#c9825c', '#9a5d3f', '#6f3e2a'];
  const hairColors = ['#201814', '#4a2b1d', '#8c5937', '#b98a56', '#303338'];
  const eyeColors = ['#39251d', '#665044', '#263748', '#4d6035'];
  const shirtColors = ['#4876a8', '#a85c63', '#578a6e', '#8d6bb1', '#b27a45', '#4c5d70'];
  const backgroundColors = [['#bfd8ef', '#e7f1f9'], ['#eed1c2', '#fae9df'], ['#d6e5c1', '#eef4df'], ['#d7c8ec', '#eee8f7'], ['#d6d8dc', '#f0f1f2']];
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

  const select = (values, random) => values[Math.floor(random() * values.length)];
  const rounded = (value) => Math.round(value * 10) / 10;

  const createIdentity = (seed) => {
    const random = seededRandom(seed);
    const identity = {
      seed,
      skin: select(skinTones, random),
      hair: select(hairColors, random),
      eye: select(eyeColors, random),
      faceWidth: Math.floor(121 + random() * 43),
      faceHeight: Math.floor(154 + random() * 42),
      jaw: rounded(.82 + random() * .24),
      eyeSpacing: Math.floor(37 + random() * 20),
      eyeWidth: Math.floor(21 + random() * 13),
      eyeHeight: Math.floor(9 + random() * 8),
      brow: Math.floor(-8 + random() * 17),
      noseWidth: Math.floor(17 + random() * 13),
      mouthWidth: Math.floor(35 + random() * 24),
      lip: Math.floor(2 + random() * 5),
      hairStyle: Math.floor(random() * 5),
      hairHeight: Math.floor(28 + random() * 45),
      earSize: Math.floor(20 + random() * 12),
    };
    identity.signature = [identity.skin, identity.hair, identity.eye, identity.faceWidth, identity.faceHeight, identity.jaw, identity.eyeSpacing, identity.eyeWidth, identity.eyeHeight, identity.brow, identity.noseWidth, identity.mouthWidth, identity.lip, identity.hairStyle, identity.hairHeight, identity.earSize].join('|');
    return identity;
  };

  const createVariant = (identity, index) => {
    const random = seededRandom((identity.seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0);
    return {
      index,
      shirt: select(shirtColors, random),
      background: Math.floor(random() * backgroundColors.length),
      expression: Math.floor(random() * 4),
      offsetX: Math.floor(-9 + random() * 19),
      offsetY: Math.floor(-5 + random() * 11),
      scale: rounded(.96 + random() * .08),
      light: rounded(.94 + random() * .12),
    };
  };

  const readState = () => {
    let raw;
    try { raw = window.localStorage.getItem(stateKey); }
    catch (_) { throw new Error('인물 중복을 막으려면 브라우저 저장소를 사용할 수 있어야 합니다.'); }
    if (raw === null) return { version: 1, signatures: [], fileNames: [], lastBatch: null };
    try {
      const state = JSON.parse(raw);
      if (state?.version === 1 && Array.isArray(state.signatures) && Array.isArray(state.fileNames) && (state.lastBatch === null || typeof state.lastBatch === 'object')) return state;
    } catch (_) { /* The reset button is the recovery path for invalid state. */ }
    throw new Error('인물 생성 이력을 읽을 수 없습니다. 인물 생성 이력 초기화 후 다시 시도해 주세요.');
  };

  const writeState = (state) => {
    try { window.localStorage.setItem(stateKey, JSON.stringify(state)); }
    catch (_) { throw new Error('인물 생성 이력을 저장하지 못했습니다. 중복을 막기 위해 결과를 만들지 않았습니다.'); }
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
    const identities = [];
    while (identities.length < config.people) {
      const identity = createIdentity(randomUint32());
      if (signatures.has(identity.signature)) continue;
      signatures.add(identity.signature);
      identities.push(identity);
    }
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
        version: 1,
        signatures: [...signatures],
        fileNames: [...fileNames],
        lastBatch: null,
      },
    };
  };

  const pathEllipse = (context, x, y, radiusX, radiusY, fill) => {
    context.beginPath();
    context.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
    context.fillStyle = fill;
    context.fill();
  };

  const renderPortrait = (canvas, identity, variant) => {
    canvas.width = imageSize;
    canvas.height = imageSize;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('이 브라우저는 JPG 인물 사진 생성에 필요한 Canvas를 지원하지 않습니다.');
    const [backgroundStart, backgroundEnd] = backgroundColors[variant.background];
    const gradient = context.createLinearGradient(0, 0, imageSize, imageSize);
    gradient.addColorStop(0, backgroundStart);
    gradient.addColorStop(1, backgroundEnd);
    context.fillStyle = gradient;
    context.fillRect(0, 0, imageSize, imageSize);
    context.globalAlpha = .15;
    pathEllipse(context, 75, 90, 105, 78, '#ffffff');
    pathEllipse(context, 445, 435, 150, 100, '#223041');
    context.globalAlpha = 1;
    context.save();
    context.translate(256 + variant.offsetX, 278 + variant.offsetY);
    context.scale(variant.scale, variant.scale);
    context.filter = `brightness(${variant.light})`;
    pathEllipse(context, 0, 218, 178, 100, variant.shirt);
    pathEllipse(context, 0, 163, 47, 65, identity.skin);
    pathEllipse(context, -identity.faceWidth + 7, -9, identity.earSize, identity.earSize * 1.22, identity.skin);
    pathEllipse(context, identity.faceWidth - 7, -9, identity.earSize, identity.earSize * 1.22, identity.skin);
    context.save();
    context.scale(1, identity.jaw);
    pathEllipse(context, 0, -4 / identity.jaw, identity.faceWidth, identity.faceHeight, identity.skin);
    context.restore();
    context.fillStyle = 'rgba(83,42,25,.12)';
    pathEllipse(context, identity.faceWidth * .52, 17, identity.faceWidth * .22, identity.faceHeight * .67, 'rgba(83,42,25,.10)');
    const leftEye = -identity.eyeSpacing;
    const rightEye = identity.eyeSpacing;
    context.strokeStyle = '#4a2e28';
    context.lineWidth = 8;
    context.lineCap = 'round';
    context.beginPath(); context.moveTo(leftEye - identity.eyeWidth, -45); context.quadraticCurveTo(leftEye, -56 + identity.brow, leftEye + identity.eyeWidth, -45); context.stroke();
    context.beginPath(); context.moveTo(rightEye - identity.eyeWidth, -45); context.quadraticCurveTo(rightEye, -56 - identity.brow, rightEye + identity.eyeWidth, -45); context.stroke();
    pathEllipse(context, leftEye, -20, identity.eyeWidth, identity.eyeHeight, '#fffdf9');
    pathEllipse(context, rightEye, -20, identity.eyeWidth, identity.eyeHeight, '#fffdf9');
    pathEllipse(context, leftEye, -20, Math.max(6, identity.eyeHeight - 1), Math.max(6, identity.eyeHeight - 1), identity.eye);
    pathEllipse(context, rightEye, -20, Math.max(6, identity.eyeHeight - 1), Math.max(6, identity.eyeHeight - 1), identity.eye);
    pathEllipse(context, leftEye - 2, -23, 2.8, 2.8, '#ffffff');
    pathEllipse(context, rightEye - 2, -23, 2.8, 2.8, '#ffffff');
    context.strokeStyle = 'rgba(98,53,35,.46)';
    context.lineWidth = 6;
    context.beginPath(); context.moveTo(0, -12); context.quadraticCurveTo(-identity.noseWidth, 24, 0, 31); context.quadraticCurveTo(identity.noseWidth, 31, identity.noseWidth * .6, 23); context.stroke();
    const mouthY = 73;
    const smile = [-4, 7, 0, 13][variant.expression];
    context.strokeStyle = '#8f3f48';
    context.lineWidth = identity.lip;
    context.beginPath(); context.moveTo(-identity.mouthWidth / 2, mouthY); context.quadraticCurveTo(0, mouthY + smile, identity.mouthWidth / 2, mouthY); context.stroke();
    context.fillStyle = identity.hair;
    if (identity.hairStyle === 0) {
      pathEllipse(context, 0, -identity.faceHeight + 14, identity.faceWidth + 8, identity.hairHeight, identity.hair);
      context.fillRect(-identity.faceWidth - 7, -identity.faceHeight + 12, 30, identity.hairHeight + 54);
    } else if (identity.hairStyle === 1) {
      pathEllipse(context, 0, -identity.faceHeight + 16, identity.faceWidth + 10, identity.hairHeight + 10, identity.hair);
      context.beginPath(); context.moveTo(-identity.faceWidth - 4, -identity.faceHeight + 26); context.lineTo(-identity.faceWidth - 12, 55); context.lineTo(-identity.faceWidth + 15, 46); context.closePath(); context.fill();
    } else if (identity.hairStyle === 2) {
      pathEllipse(context, 0, -identity.faceHeight + 8, identity.faceWidth + 18, identity.hairHeight + 22, identity.hair);
    } else if (identity.hairStyle === 3) {
      context.beginPath(); context.arc(0, -identity.faceHeight + 37, identity.faceWidth + 4, Math.PI, 0); context.lineTo(identity.faceWidth - 9, -identity.faceHeight + 74); context.lineTo(-identity.faceWidth + 9, -identity.faceHeight + 74); context.closePath(); context.fill();
    } else {
      pathEllipse(context, -identity.faceWidth * .35, -identity.faceHeight + 18, identity.faceWidth * .72, identity.hairHeight + 14, identity.hair);
      pathEllipse(context, identity.faceWidth * .36, -identity.faceHeight + 28, identity.faceWidth * .56, identity.hairHeight, identity.hair);
    }
    context.filter = 'none';
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
    image.alt = '가상 인물 사진';
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

  const renderSummary = (config, state) => {
    const total = config.people * config.perPerson;
    summary.replaceChildren();
    [['이번 생성', `${config.people}명 · ${total}장`], ['인물당 표본', `${config.perPerson}장`], ['누적 인물', `${state.signatures.length}명`], ['이미지', '512 × 512 JPG']].forEach(([label, value]) => {
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
    cancelButton.disabled = !busy;
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
    activeGeneration = { cancelled: false };
    setBusy(true);
    groupsOutput.hidden = true;
    const canvas = document.createElement('canvas');
    const generated = [];
    try {
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
      const zipData = helpers.zip(generated.map((record) => ({ name: record.name, data: record.bytes })));
      const generatedArchive = new Blob([zipData], { type: 'application/zip' });
      const storedRecords = generated.map(recordForStorage);
      plan.state.lastBatch = { people: config.people, perPerson: config.perPerson, records: storedRecords };
      writeState(plan.state);
      archive = generatedArchive;
      currentRecords = generated;
      renderPreview(currentRecords);
      renderSummary(config, plan.state);
      setStatus(`${config.label}의 JPG ${generated.length.toLocaleString('ko-KR')}장을 만들었습니다. ZIP에는 JPG만 들어 있습니다.`);
    } catch (error) {
      if (error instanceof Error && error.message === 'cancelled') setStatus('생성을 취소했습니다. 취소된 묶음은 저장하거나 내려받지 않습니다.');
      else setStatus(error instanceof Error ? error.message : '인물 사진을 만들지 못했습니다.', true);
    } finally {
      activeGeneration = null;
      setBusy(false);
    }
  };

  form.addEventListener('submit', (event) => { event.preventDefault(); generate(); });
  cancelButton.addEventListener('click', () => { if (activeGeneration) { activeGeneration.cancelled = true; cancelButton.disabled = true; setStatus('생성을 취소하고 있습니다…'); } });
  downloadButton.addEventListener('click', () => {
    if (!archive) return;
    helpers.download(archive, `portrait-grouping-${currentRecords.length}-jpg.zip`);
    setStatus('JPG만 포함된 ZIP 파일을 내려받았습니다.');
  });
  groupsButton.addEventListener('click', () => {
    if (currentRecords.length === 0) return;
    if (groupsOutput.hidden) { renderGroups(currentRecords); groupsOutput.hidden = false; groupsButton.textContent = '정답 그룹 숨기기'; }
    else { groupsOutput.hidden = true; groupsButton.textContent = '정답 그룹 보기'; }
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
      renderSummary(presets[preset.value] || presets.sample, readState());
      setBusy(false);
      setStatus('인물 생성 이력을 초기화했습니다. 이전 인물과 파일명이 다시 나올 수 있습니다.');
    } catch (_) { setStatus('인물 생성 이력을 초기화하지 못했습니다.', true); }
  });
  preset.addEventListener('change', () => { updatePresetButton(); try { renderSummary(presets[preset.value] || presets.sample, readState()); } catch (_) { /* Generation reports storage errors. */ } });

  try {
    const state = readState();
    updatePresetButton();
    renderSummary(presets[preset.value], state);
    if (state.lastBatch?.records?.length) {
      currentRecords = state.lastBatch.records;
      groupsButton.disabled = false;
      setStatus(`마지막 생성 묶음의 정답 그룹 ${currentRecords.length.toLocaleString('ko-KR')}장을 이 브라우저에서 확인할 수 있습니다.`);
    }
  } catch (error) { setStatus(error instanceof Error ? error.message : '인물 생성 이력을 읽을 수 없습니다.', true); }
})();

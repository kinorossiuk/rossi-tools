(() => {
  'use strict';

  const root = document.querySelector('[data-test-data-tool]');
  if (!root) return;

  const encoder = new TextEncoder();
  const tabs = root.querySelectorAll('[data-tab]');
  const panels = root.querySelectorAll('[data-panel]');
  const fileForm = root.querySelector('#test-file-form');
  const fileKind = root.querySelector('#file-kind');
  const fileSize = root.querySelector('#file-size');
  const fileUnit = root.querySelector('#file-unit');
  const fileName = root.querySelector('#file-name');
  const dimension = root.querySelector('#image-dimension');
  const imageOption = root.querySelector('.file-image-option');
  const fileHint = root.querySelector('#file-hint');
  const fileStatus = root.querySelector('#file-status');
  const messageForm = root.querySelector('#test-message-form');
  const messageCount = root.querySelector('#message-count');
  const messagePreset = root.querySelector('#message-preset');
  const messagePrefix = root.querySelector('#message-prefix');
  const messageOutput = root.querySelector('#message-output');
  const messageCopy = root.querySelector('#message-copy');
  const messageQrRefresh = root.querySelector('#message-qr');
  const messageClear = root.querySelector('#message-clear');
  const messageCharacterInputs = Array.from(root.querySelectorAll('[data-message-character]'));
  const messageGraphemes = root.querySelector('#message-graphemes');
  const messageCodePoints = root.querySelector('#message-code-points');
  const messageCodeUnits = root.querySelector('#message-code-units');
  const messageBytes = root.querySelector('#message-bytes');
  const messageStatus = root.querySelector('#message-status');
  const messageQrOutput = root.querySelector('#message-qr-output');
  const messageQrPreview = root.querySelector('#message-qr-preview');
  const messageQrBytes = root.querySelector('#message-qr-bytes');
  const messageQrPosition = root.querySelector('#message-qr-position');
  const messageQrPrevious = root.querySelector('#message-qr-previous');
  const messageQrNext = root.querySelector('#message-qr-next');
  const messageQrHelp = root.querySelector('#message-qr-help');
  const emojiCategory = root.querySelector('#emoji-category');
  const emojiSearch = root.querySelector('#emoji-search');
  const emojiRandomCount = root.querySelector('#emoji-random-count');
  const emojiRandom = root.querySelector('#emoji-random');
  const emojiGrid = root.querySelector('#emoji-grid');
  const emojiEmpty = root.querySelector('#emoji-empty');
  const contactForm = root.querySelector('#test-contact-form');
  const contactCount = root.querySelector('#contact-count');
  const contactCountry = root.querySelector('#contact-country');
  const contactPrefix = root.querySelector('#contact-prefix');
  const contactPrefixHint = root.querySelector('#contact-prefix-hint');
  const contactPreview = root.querySelector('#contact-preview');
  const contactCsv = root.querySelector('#contact-csv');
  const contactStatus = root.querySelector('#contact-status');
  const maxBytes = 300 * 1024 * 1024;
  const webmBitrate = 12_000_000;
  let contacts = [];
  let messageQrParts = [];
  let messageQrIndex = 0;

  const setStatus = (element, text, isError = false) => {
    element.textContent = text;
    element.classList.toggle('is-error', isError);
  };

  const formatBytes = (bytes) => bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(bytes % (1024 * 1024) === 0 ? 0 : 2)} MiB`
    : `${bytes.toLocaleString('ko-KR')} bytes`;

  const formatDuration = (seconds) => seconds >= 60
    ? `${Math.floor(seconds / 60)}분 ${seconds % 60}초`
    : `${seconds}초`;

  const webmDurationForTarget = (target) => Math.max(1, Math.ceil((target * 8) / webmBitrate));

  const safeName = (value, fallback) => {
    const cleaned = value.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/^\.+|\.+$/g, '');
    return cleaned || fallback;
  };

  const download = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const concat = (parts) => {
    const length = parts.reduce((total, part) => total + part.length, 0);
    const output = new Uint8Array(length);
    let offset = 0;
    parts.forEach((part) => { output.set(part, offset); offset += part.length; });
    return output;
  };

  const u16 = (value) => Uint8Array.of(value & 255, (value >>> 8) & 255);
  const u32 = (value) => Uint8Array.of(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255);
  const be32 = (value) => Uint8Array.of((value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255);
  const ascii = (value) => encoder.encode(value);

  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
      table[index] = value >>> 0;
    }
    return table;
  })();

  const crc32 = (data) => {
    let value = 0xffffffff;
    for (let index = 0; index < data.length; index += 1) value = (value >>> 8) ^ crcTable[(value ^ data[index]) & 255];
    return (value ^ 0xffffffff) >>> 0;
  };

  const zip = (entries) => {
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    entries.forEach(({ name, data }) => {
      const nameBytes = ascii(name);
      const checksum = crc32(data);
      const local = concat([ascii('PK\x03\x04'), u16(20), u16(0), u16(0), u16(0), u16(0), u32(checksum), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), nameBytes, data]);
      localParts.push(local);
      const central = concat([ascii('PK\x01\x02'), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(checksum), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes]);
      centralParts.push(central);
      offset += local.length;
    });
    const central = concat(centralParts);
    const ending = concat([ascii('PK\x05\x06'), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(central.length), u32(offset), u16(0)]);
    return concat([...localParts, central, ending]);
  };

  const paddedZip = (entries, target) => {
    const withEmptyPadding = [...entries, { name: 'padding.bin', data: new Uint8Array(0) }];
    const base = zip(withEmptyPadding);
    const padding = target - base.length;
    if (padding < 0) throw new Error(`선택한 용량이 문서 최소 크기(${formatBytes(base.length)})보다 작습니다.`);
    return zip([...entries, { name: 'padding.bin', data: new Uint8Array(padding) }]);
  };

  const xml = (value) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);

  const randomIndex = (length) => {
    if (window.crypto?.getRandomValues) {
      const value = new Uint32Array(1);
      window.crypto.getRandomValues(value);
      return value[0] % length;
    }
    return Math.floor(Math.random() * length);
  };

  const shuffled = (values) => {
    const output = [...values];
    for (let index = output.length - 1; index > 0; index -= 1) {
      const swapIndex = randomIndex(index + 1);
      [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
    }
    return output;
  };

  const patternQueues = new Map();
  const nextPatternIndex = (kind, fileName, length) => {
    const stateKey = `rossi-test-data-patterns-v1:${kind}:${fileName}`;
    let state = patternQueues.get(stateKey);
    if (!state) {
      try {
        const saved = JSON.parse(window.localStorage.getItem(stateKey) || 'null');
        if (saved && Array.isArray(saved.queue) && saved.queue.every((value) => Number.isInteger(value) && value >= 0 && value < length) && new Set(saved.queue).size === saved.queue.length && Number.isInteger(saved.last)) state = saved;
      } catch (_) { /* Storage can be unavailable in private or restricted browsing contexts. */ }
    }
    state ||= { queue: [], last: -1 };
    if (state.queue.length === 0) {
      state.queue = Array.from({ length }, (_, index) => index);
      for (let index = state.queue.length - 1; index > 0; index -= 1) {
        const swapIndex = randomIndex(index + 1);
        [state.queue[index], state.queue[swapIndex]] = [state.queue[swapIndex], state.queue[index]];
      }
      if (state.queue[0] === state.last && state.queue.length > 1) [state.queue[0], state.queue[1]] = [state.queue[1], state.queue[0]];
    }
    const selected = state.queue.shift();
    state.last = selected;
    patternQueues.set(stateKey, state);
    try { window.localStorage.setItem(stateKey, JSON.stringify(state)); } catch (_) { /* Keep the current-page queue when storage is unavailable. */ }
    return selected;
  };

  const documentPatterns = [
    { name: '요약 보고서', title: 'SUMMARY REPORT', subtitle: 'Upload validation overview', accent: 'D7FF5F', rows: [['Status', 'Ready'], ['Files', '128'], ['Owner', 'QA Team'], ['Updated', '2026-07-15']] },
    { name: '재고 목록', title: 'INVENTORY LIST', subtitle: 'Sample warehouse records', accent: '78DCE8', rows: [['Item', 'Quantity'], ['Keyboard', '42'], ['Monitor', '18'], ['Cable', '256']] },
    { name: '주문 내역', title: 'ORDER LEDGER', subtitle: 'Fictional transaction data', accent: 'FFB86C', rows: [['Order', 'Amount'], ['TEST-1001', '12500'], ['TEST-1002', '8800'], ['TEST-1003', '31700']] },
    { name: '일정표', title: 'PROJECT SCHEDULE', subtitle: 'Milestone test document', accent: 'BD93F9', rows: [['Phase', 'Date'], ['Planning', '2026-07-01'], ['Testing', '2026-07-15'], ['Release', '2026-07-31']] },
    { name: '점검표', title: 'QUALITY CHECKLIST', subtitle: 'Synthetic inspection results', accent: '50FA7B', rows: [['Check', 'Result'], ['File name', 'PASS'], ['MIME type', 'PASS'], ['Size limit', 'PASS']] },
    { name: '회의 기록', title: 'MEETING NOTES', subtitle: 'Generated discussion outline', accent: 'FF79C6', rows: [['Topic', 'Decision'], ['Scope', 'Approved'], ['Risk', 'Reviewed'], ['Next step', 'Retest']] },
    { name: '설문 결과', title: 'SURVEY RESULTS', subtitle: 'Anonymous sample responses', accent: '8BE9FD', rows: [['Choice', 'Votes'], ['Option A', '37'], ['Option B', '29'], ['Option C', '14']] },
    { name: '시스템 로그', title: 'SYSTEM LOG', subtitle: 'Non-production event sample', accent: 'F1FA8C', rows: [['Time', 'Event'], ['09:00:01', 'START'], ['09:00:03', 'UPLOAD'], ['09:00:04', 'SUCCESS']] },
    { name: '연락처 표', title: 'CONTACT DIRECTORY', subtitle: 'Fictional test identities', accent: 'FF8C78', rows: [['Name', 'Extension'], ['Test User A', '1001'], ['Test User B', '1002'], ['Test User C', '1003']] },
    { name: '월간 지표', title: 'MONTHLY METRICS', subtitle: 'Synthetic performance figures', accent: 'A4FFFF', rows: [['Metric', 'Value'], ['Uploads', '1,240'], ['Validated', '1,198'], ['Rejected', '42']] },
  ];

  const xlsxColumn = (index) => String.fromCharCode(65 + index);
  const xlsxRows = (pattern, generatedTitle) => [
    [generatedTitle, pattern.title],
    ...pattern.rows,
  ].map((row, rowIndex) => `<row r="${rowIndex + 1}"${rowIndex === 0 ? ' ht="28" customHeight="1"' : ''}>${row.map((value, columnIndex) => `<c r="${xlsxColumn(columnIndex)}${rowIndex + 1}" t="inlineStr" s="${rowIndex === 0 ? 1 : rowIndex === 1 ? 2 : 0}"><is><t>${xml(value)}</t></is></c>`).join('')}</row>`).join('');

  const makeXlsx = (target, pattern, generatedTitle) => paddedZip([
    { name: '[Content_Types].xml', data: ascii('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="bin" ContentType="application/octet-stream"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>') },
    { name: '_rels/.rels', data: ascii('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
    { name: 'xl/workbook.xml', data: ascii(`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(pattern.name)}" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
    { name: 'xl/_rels/workbook.xml.rels', data: ascii('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>') },
    { name: 'xl/styles.xml', data: ascii(`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="14"/><color rgb="FF111310"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF${pattern.accent}"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1"/></cellXfs></styleSheet>`) },
    { name: 'xl/worksheets/sheet1.xml', data: ascii(`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="24" customWidth="1"/><col min="2" max="2" width="34" customWidth="1"/></cols><sheetData>${xlsxRows(pattern, generatedTitle)}<row r="7"><c r="A7" t="inlineStr"><is><t>Target size</t></is></c><c r="B7" t="inlineStr"><is><t>${xml(formatBytes(target))}</t></is></c></row></sheetData></worksheet>`) },
  ], target);

  const docxParagraphs = (pattern) => pattern.rows.map(([label, value], index) => `<w:p><w:pPr><w:spacing w:before="${index === 0 ? 240 : 80}" w:after="80"/><w:shd w:fill="${index % 2 ? 'F2F2F2' : 'FFFFFF'}"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="${pattern.accent}"/></w:rPr><w:t>${xml(label)}: </w:t></w:r><w:r><w:t>${xml(value)}</w:t></w:r></w:p>`).join('');

  const makeDocx = (target, pattern, patternIndex, generatedTitle) => paddedZip([
    { name: '[Content_Types].xml', data: ascii('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="bin" ContentType="application/octet-stream"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>') },
    { name: '_rels/.rels', data: ascii('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>') },
    { name: 'word/document.xml', data: ascii(`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:jc w:val="${patternIndex % 2 ? 'left' : 'center'}"/><w:spacing w:after="180"/><w:shd w:fill="${pattern.accent}"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="34"/><w:color w:val="111310"/></w:rPr><w:t>${xml(generatedTitle)}</w:t></w:r></w:p><w:p><w:r><w:rPr><w:i/><w:color w:val="666666"/></w:rPr><w:t>${xml(pattern.title)} · ${xml(pattern.subtitle)}</w:t></w:r></w:p>${docxParagraphs(pattern)}<w:p><w:r><w:t>Target size: ${xml(formatBytes(target))}</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`) },
  ], target);

  const pdfEscape = (value) => value.replace(/[\\()]/g, '\\$&');
  const pdfPatternContent = (pattern, patternIndex, target, generatedTitle) => {
    const accent = [parseInt(pattern.accent.slice(0, 2), 16), parseInt(pattern.accent.slice(2, 4), 16), parseInt(pattern.accent.slice(4, 6), 16)].map((value) => (value / 255).toFixed(3));
    const shapes = [
      '54 700 487 90 re f', '54 700 18 90 re f', '54 760 487 30 re f', '54 700 487 8 re f',
      '54 700 m 541 790 l 541 700 l h f', '54 700 90 90 re f', '54 700 487 90 re S',
      '54 745 487 45 re f', '54 700 240 90 re f', '54 700 487 90 re f 66 712 463 66 re S',
    ];
    const rows = pattern.rows.map(([label, value], index) => `BT /F1 11 Tf 72 ${640 - index * 42} Td (${pdfEscape(label)}) Tj 180 0 Td (${pdfEscape(value)}) Tj ET`).join('\n');
    return `q ${accent.join(' ')} rg ${shapes[patternIndex]} Q\nBT /F1 20 Tf 72 748 Td (${pdfEscape(generatedTitle)}) Tj ET\nBT /F1 10 Tf 72 720 Td (${pdfEscape(pattern.title)} - ${pdfEscape(pattern.subtitle)}) Tj ET\n${rows}\nBT /F1 9 Tf 72 430 Td (Target size: ${pdfEscape(formatBytes(target))}) Tj ET\n`;
  };

  const buildPdf = (padding, pattern, patternIndex, target, generatedTitle) => {
    const pageContent = pdfPatternContent(pattern, patternIndex, target, generatedTitle);
    const objects = [
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n',
      `4 0 obj\n<< /Length ${encoder.encode(pageContent).length} >>\nstream\n${pageContent}endstream\nendobj\n`,
      '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
      `6 0 obj\n<< /Length ${padding} >>\nstream\n${'0'.repeat(padding)}\nendstream\nendobj\n`,
    ];
    let result = '%PDF-1.4\n%ROSSI\n';
    const offsets = [0];
    objects.forEach((object) => { offsets.push(result.length); result += object; });
    const xref = result.length;
    result += 'xref\n0 7\n0000000000 65535 f \n';
    offsets.slice(1).forEach((offset) => { result += `${String(offset).padStart(10, '0')} 00000 n \n`; });
    result += `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return encoder.encode(result);
  };

  const makePdf = (target, pattern, patternIndex, generatedTitle) => {
    let padding = Math.max(0, target - 800);
    for (let attempts = 0; attempts < 8; attempts += 1) {
      const output = buildPdf(padding, pattern, patternIndex, target, generatedTitle);
      const difference = target - output.length;
      if (difference === 0) return output;
      padding += difference;
    }
    throw new Error('PDF 크기를 맞추지 못했습니다. 다시 시도해 주세요.');
  };

  const textPatterns = [
    (pattern) => `${pattern.title}\n${pattern.subtitle}\n${pattern.rows.map((row) => row.join(': ')).join('\n')}\n`,
    (pattern) => `label,value\n${pattern.rows.map((row) => row.map((value) => `"${value}"`).join(',')).join('\n')}\n`,
    (pattern) => `${pattern.rows.map(([key, value]) => JSON.stringify({ key, value, test: true })).join('\n')}\n`,
    (pattern) => `${pattern.rows.map(([event, value], index) => `2026-07-15T09:00:0${index}Z INFO ${event.toUpperCase().replace(/ /g, '_')} value=${value}`).join('\n')}\n`,
    (pattern) => `[test-data]\n${pattern.rows.map(([key, value]) => `${key.toLowerCase().replace(/ /g, '_')}=${value}`).join('\n')}\n`,
    (pattern) => `${pattern.title}\n${'-'.repeat(48)}\n${pattern.rows.map(([key, value]) => `${key.padEnd(24)}${value.padStart(20)}`).join('\n')}\n`,
    (pattern) => `# ${pattern.title}\n\n${pattern.subtitle}\n\n${pattern.rows.map(([key, value]) => `- **${key}**: ${value}`).join('\n')}\n`,
    (pattern) => `category\tvalue\tvalid\n${pattern.rows.map(([key, value]) => `${key}\t${value}\tTRUE`).join('\n')}\n`,
    (pattern) => `<test-data title="${pattern.title}">\n${pattern.rows.map(([key, value]) => `  <item name="${key}">${value}</item>`).join('\n')}\n</test-data>\n`,
    (pattern) => `${pattern.title}\n${pattern.rows.map(([key, value], index) => `[${index % 2 ? ' ' : 'x'}] ${key} -- ${value}`).join('\n')}\n`,
  ];

  const makeText = (target, pattern, patternIndex, generatedTitle) => {
    const seed = encoder.encode(`${generatedTitle}\n${textPatterns[patternIndex](pattern)}`);
    const output = new Uint8Array(target);
    for (let offset = 0; offset < target; offset += seed.length) output.set(seed.subarray(0, Math.min(seed.length, target - offset)), offset);
    return output;
  };

  const pngChunk = (type, data) => {
    const typeBytes = ascii(type);
    return concat([be32(data.length), typeBytes, data, be32(crc32(concat([typeBytes, data])))]);
  };

  const drawPngPattern = (context, width, height, pattern, patternIndex) => {
    const accent = `#${pattern.accent}`;
    context.fillStyle = '#171a17';
    context.fillRect(0, 0, width, height);
    const block = Math.max(24, Math.floor(width / 16));
    if (patternIndex === 0) {
      for (let y = 0; y < height; y += block) for (let x = 0; x < width; x += block) {
        context.fillStyle = (Math.floor(x / block) + Math.floor(y / block)) % 2 ? accent : '#20241f';
        context.fillRect(x, y, block, block);
      }
    } else if (patternIndex === 1) {
      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, accent); gradient.addColorStop(1, '#111310');
      context.fillStyle = gradient; context.fillRect(0, 0, width, height);
    } else if (patternIndex === 2) {
      for (let x = -height; x < width; x += block * 2) {
        context.fillStyle = accent; context.fillRect(x, 0, block, height);
        context.save(); context.translate(x, 0); context.rotate(-Math.PI / 6); context.fillRect(0, 0, block, height * 2); context.restore();
      }
    } else if (patternIndex === 3) {
      for (let radius = Math.max(width, height); radius > 0; radius -= block) {
        context.beginPath(); context.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
        context.fillStyle = Math.floor(radius / block) % 2 ? accent : '#20241f'; context.fill();
      }
    } else if (patternIndex === 4) {
      context.strokeStyle = accent; context.lineWidth = Math.max(3, width / 240);
      for (let x = 0; x <= width; x += block) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
      for (let y = 0; y <= height; y += block) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
    } else if (patternIndex === 5) {
      for (let index = 0; index < 18; index += 1) {
        const radius = block * (.5 + (index % 4) * .3);
        context.beginPath(); context.arc((index * 97) % width, (index * 61) % height, radius, 0, Math.PI * 2);
        context.fillStyle = index % 2 ? accent : '#505650'; context.fill();
      }
    } else if (patternIndex === 6) {
      for (let y = 0; y < height; y += block) {
        context.fillStyle = Math.floor(y / block) % 2 ? accent : '#252925'; context.fillRect(0, y, width, block);
      }
    } else if (patternIndex === 7) {
      context.fillStyle = accent;
      context.beginPath(); context.moveTo(width / 2, height * .08); context.lineTo(width * .92, height * .88); context.lineTo(width * .08, height * .88); context.closePath(); context.fill();
      context.fillStyle = '#171a17'; context.beginPath(); context.moveTo(width / 2, height * .27); context.lineTo(width * .74, height * .75); context.lineTo(width * .26, height * .75); context.closePath(); context.fill();
    } else if (patternIndex === 8) {
      const gradient = context.createRadialGradient(width * .5, height * .5, block, width * .5, height * .5, width * .6);
      gradient.addColorStop(0, accent); gradient.addColorStop(.5, '#505650'); gradient.addColorStop(1, '#111310');
      context.fillStyle = gradient; context.fillRect(0, 0, width, height);
    } else {
      for (let y = 0; y < height; y += block) for (let x = 0; x < width; x += block) {
        context.fillStyle = ((x / block) ^ (y / block)) % 3 ? '#20241f' : accent; context.fillRect(x, y, block, block);
      }
    }
    context.fillStyle = 'rgba(12, 14, 12, .82)';
    context.fillRect(width * .055, height * .34, width * .89, height * .32);
  };

  const makePng = async (target, pattern, patternIndex, generatedTitle) => {
    const [width, height] = dimension.value.split('x').map(Number);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    drawPngPattern(context, width, height, pattern, patternIndex);
    context.fillStyle = `#${pattern.accent}`;
    context.font = `700 ${Math.max(22, Math.floor(width / 24))}px ui-monospace, monospace`;
    context.fillText(generatedTitle, Math.floor(width * .08), Math.floor(height * .48));
    context.fillStyle = '#f5f3eb';
    context.font = `500 ${Math.max(16, Math.floor(width / 32))}px system-ui`;
    context.fillText(`${pattern.title} · ${pattern.name} · ${formatBytes(target)}`, Math.floor(width * .08), Math.floor(height * .58));
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG 이미지를 만들지 못했습니다.');
    const base = new Uint8Array(await blob.arrayBuffer());
    const remaining = target - base.length;
    if (remaining < 20) throw new Error(`선택한 용량이 이미지 최소 크기(${formatBytes(base.length + 20)})보다 작습니다.`);
    const padding = new Uint8Array(remaining - 12);
    padding.set(ascii('padding\0'));
    return concat([base.subarray(0, base.length - 12), pngChunk('tEXt', padding), base.subarray(base.length - 12)]);
  };

  const makeWebm = async (target) => {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) throw new Error('이 브라우저는 WebM 동영상 생성을 지원하지 않습니다. Chrome 또는 Edge를 사용해 주세요.');
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const context = canvas.getContext('2d');
    const noise = context.createImageData(canvas.width, canvas.height);
    let noiseSeed = 0x12345678;
    const drawFrame = (frame) => {
      for (let index = 0; index < noise.data.length; index += 4) {
        noiseSeed = (noiseSeed * 1664525 + 1013904223) >>> 0;
        const shade = noiseSeed >>> 24;
        noise.data[index] = shade >> 2;
        noise.data[index + 1] = 40 + (shade >> 1);
        noise.data[index + 2] = 24 + (shade >> 3);
        noise.data[index + 3] = 255;
      }
      context.putImageData(noise, 0, 0);
      context.fillStyle = 'rgba(32, 36, 31, .82)'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#d7ff5f'; context.fillRect(0, 0, canvas.width, 72);
      context.fillStyle = '#111310'; context.font = '700 36px system-ui'; context.fillText('ROSSI TEST VIDEO', 42, 47);
      context.fillStyle = '#f5f3eb'; context.font = '500 24px system-ui'; context.fillText(formatBytes(target), 42, 150);
      context.fillStyle = '#a6aca1'; context.font = '500 16px ui-monospace, monospace'; context.fillText(`FRAME ${String(frame).padStart(3, '0')}`, 42, 205);
      context.fillStyle = frame % 2 ? '#ff8c78' : '#d7ff5f'; context.fillRect(42 + (frame % 12) * 42, 252, 30, 30);
    };
    const stream = canvas.captureStream(12);
    const mimeType = ['video/webm;codecs=vp8', 'video/webm'].find((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error('이 브라우저에서 지원하는 WebM 코덱을 찾지 못했습니다. Chrome 또는 Edge를 사용해 주세요.');
    const durationSeconds = webmDurationForTarget(target);
    const options = { mimeType, videoBitsPerSecond: webmBitrate };
    const chunks = [];
    const recorder = new MediaRecorder(stream, options);
    const stopped = new Promise((resolve, reject) => { recorder.onstop = resolve; recorder.onerror = () => reject(new Error('WebM 동영상 생성에 실패했습니다.')); });
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.start(1000);
    let frame = 0;
    drawFrame(frame);
    const frameTimer = window.setInterval(() => drawFrame(++frame), 80);
    await new Promise((resolve) => window.setTimeout(resolve, durationSeconds * 1000));
    window.clearInterval(frameTimer);
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    // Upload validators commonly accept the registered WebM MIME type only;
    // keep codec selection for recording but save the downloaded file as video/webm.
    return { blob: new Blob(chunks, { type: 'video/webm' }), durationSeconds };
  };

  const mp4SoundPatterns = ['440Hz 기준음', '880Hz 고음', '짧은 알림음', '긴 간격 비프음', '이중 화음', '상승 스윕', '교대 음계', '3음 아르페지오', '핑크 노이즈', '메트로놈'];

  const generatedKstTitle = () => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} KST`;
  };

  const mp4RecorderMimeTypes = () => {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream || !window.AudioContext) return [];
    return ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4']
      .filter((type) => MediaRecorder.isTypeSupported(type));
  };

  const fillSoundBuffer = (channel, sampleRate, patternIndex) => {
    let noiseSeed = 0x5f3759df;
    for (let index = 0; index < channel.length; index += 1) {
      const time = index / sampleRate;
      const endFade = Math.min(1, time * 30, (channel.length / sampleRate - time) * 30);
      let sample;
      if (patternIndex === 0) sample = Math.sin(2 * Math.PI * 440 * time) * .11;
      else if (patternIndex === 1) sample = Math.sin(2 * Math.PI * 880 * time) * .1;
      else if (patternIndex === 2) sample = Math.sin(2 * Math.PI * 660 * time) * (time % 1 < .18 ? .13 : 0);
      else if (patternIndex === 3) sample = Math.sin(2 * Math.PI * 520 * time) * (time % 2 < .55 ? .12 : 0);
      else if (patternIndex === 4) sample = (Math.sin(2 * Math.PI * 440 * time) + Math.sin(2 * Math.PI * 660 * time)) * .065;
      else if (patternIndex === 5) sample = Math.sin(2 * Math.PI * (280 * time + 55 * time * time)) * .1;
      else if (patternIndex === 6) sample = Math.sin(2 * Math.PI * (time % 1 < .5 ? 440 : 740) * time) * .1;
      else if (patternIndex === 7) sample = Math.sin(2 * Math.PI * [330, 440, 550][Math.floor((time % 1.5) / .5)] * time) * .1;
      else if (patternIndex === 8) { noiseSeed = (noiseSeed * 1664525 + 1013904223) >>> 0; sample = (((noiseSeed >>> 8) / 0x1000000) * 2 - 1) * .045; }
      else sample = Math.sin(2 * Math.PI * 1000 * time) * (time % .5 < .06 ? .12 : 0);
      channel[index] = sample * endFade;
    }
  };

  const recordMp4 = async (target, patternIndex, title, mimeType) => {
    const durationSeconds = 6;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const context = canvas.getContext('2d');
    const drawFrame = (frame) => {
      context.fillStyle = '#191c18'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#d7ff5f'; context.fillRect(0, 0, canvas.width, 72);
      context.fillStyle = '#111310'; context.font = '700 28px ui-monospace, monospace'; context.fillText(title, 38, 46);
      context.fillStyle = '#f5f3eb'; context.font = '600 22px system-ui'; context.fillText('GENERATED DATE / TIME', 42, 142);
      context.fillStyle = '#a6aca1'; context.font = '500 16px ui-monospace, monospace'; context.fillText(`${mp4SoundPatterns[patternIndex]} · FRAME ${String(frame).padStart(3, '0')}`, 42, 194);
      context.strokeStyle = '#363c33'; context.lineWidth = 1;
      for (let x = 42; x <= 588; x += 42) { context.beginPath(); context.moveTo(x, 226); context.lineTo(x, 310); context.stroke(); }
      context.fillStyle = frame % 2 ? '#ff8c78' : '#d7ff5f'; context.fillRect(42 + (frame % 13) * 42, 252, 30, 30);
    };

    const audioContext = new AudioContext({ sampleRate: 44100 });
    const audioDestination = audioContext.createMediaStreamDestination();
    const audioBuffer = audioContext.createBuffer(1, audioContext.sampleRate * durationSeconds, audioContext.sampleRate);
    fillSoundBuffer(audioBuffer.getChannelData(0), audioContext.sampleRate, patternIndex);
    const audioSource = audioContext.createBufferSource();
    audioSource.buffer = audioBuffer;
    audioSource.connect(audioDestination);
    const canvasStream = canvas.captureStream(12);
    const stream = new MediaStream([...canvasStream.getVideoTracks(), ...audioDestination.stream.getAudioTracks()]);
    const chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 300_000, audioBitsPerSecond: 48_000 });
    const stopped = new Promise((resolve, reject) => { recorder.onstop = resolve; recorder.onerror = () => reject(new Error('MP4 동영상 녹화에 실패했습니다.')); });
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    drawFrame(0);
    await audioContext.resume();
    recorder.start(1000);
    audioSource.start();
    let frame = 0;
    const frameTimer = window.setInterval(() => drawFrame(++frame), 80);
    await new Promise((resolve) => window.setTimeout(resolve, durationSeconds * 1000));
    window.clearInterval(frameTimer);
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    await audioContext.close();
    const output = new Uint8Array(await new Blob(chunks, { type: 'video/mp4' }).arrayBuffer());
    if (output.length === 0 || output.length + 8 > target) throw new Error('동적 MP4가 목표 용량보다 큽니다.');
    return output;
  };

  const paddedMp4 = (template, target) => {
    if (target < template.length + 8) throw new Error(`선택한 용량이 MP4 최소 크기(${formatBytes(template.length + 8)})보다 작습니다.`);
    const freeBoxSize = target - template.length;
    const header = concat([be32(freeBoxSize), ascii('free')]);
    const zeroChunk = new Uint8Array(Math.min(1024 * 1024, freeBoxSize - 8));
    const parts = [template, header];
    let remaining = freeBoxSize - 8;
    while (remaining > 0) {
      const length = Math.min(remaining, zeroChunk.length);
      parts.push(length === zeroChunk.length ? zeroChunk : zeroChunk.subarray(0, length));
      remaining -= length;
    }
    return new Blob(parts, { type: 'video/mp4' });
  };

  const makeMp4 = async (target, patternIndex, title) => {
    const mimeTypes = mp4RecorderMimeTypes();
    if (mimeTypes.length) {
      let lastError;
      // Some browsers advertise more than one MP4 codec profile but only record
      // reliably with one of them. Retry every supported profile once so changing
      // the requested size cannot silently switch back to a static template.
      for (const mimeType of [...mimeTypes, ...mimeTypes]) {
        try {
          const recorded = await recordMp4(target, patternIndex, title, mimeType);
          return { blob: paddedMp4(recorded, target), durationSeconds: 6, patternName: mp4SoundPatterns[patternIndex], title, dynamicTitle: true };
        } catch (error) {
          lastError = error;
          await new Promise((resolve) => window.setTimeout(resolve, 150));
        }
      }
      throw new Error(`동적 MP4 녹화에 실패했습니다. 브라우저를 새로고침한 뒤 다시 시도해 주세요.${lastError instanceof Error ? ` (${lastError.message})` : ''}`);
    }
    const response = await fetch(`/static/test-video-${patternIndex + 1}.mp4?v=1`, { cache: 'no-cache' });
    if (!response.ok) throw new Error('MP4 원본 영상을 불러오지 못했습니다. 다시 시도해 주세요.');
    const template = new Uint8Array(await response.arrayBuffer());
    return { blob: paddedMp4(template, target), durationSeconds: 6, patternName: mp4SoundPatterns[patternIndex], title, dynamicTitle: false };
  };

  const targetBytes = () => {
    const size = Number(fileSize.value);
    if (!Number.isFinite(size) || size < 1) throw new Error('용량은 1 이상으로 입력해 주세요.');
    const bytes = Math.round(size * (fileUnit.value === 'MiB' ? 1024 * 1024 : 1000 * 1000));
    if (bytes > maxBytes) throw new Error(`한 번에 최대 ${formatBytes(maxBytes)}까지만 만들 수 있습니다.`);
    return bytes;
  };

  const updateFileOptions = () => {
    const isImage = fileKind.value === 'png';
    const isVideo = fileKind.value === 'webm' || fileKind.value === 'mp4';
    imageOption.hidden = !isImage;
    fileSize.max = '300';
    fileHint.textContent = fileKind.value === 'mp4'
      ? '지원 브라우저에서는 생성 날짜·시간(KST)을 화면 제목으로 직접 녹화하고, 10가지 테스트 사운드 중 하나를 무작위로 넣습니다.'
      : isVideo
      ? '모바일 호환을 위해 실제 WebM을 녹화합니다. 목표 용량에 맞춰 영상 길이를 자동으로 정합니다. 실제 파일 크기는 목표에 가깝게 생성됩니다.'
      : 'PNG, TXT, PDF, DOCX, XLSX는 생성 날짜·시간(KST)을 제목으로 넣고, 파일명별로 중복 없는 10가지 테스트 패턴으로 만듭니다.';
  };

  tabs.forEach((tab) => tab.addEventListener('click', () => {
    tabs.forEach((item) => { const active = item === tab; item.classList.toggle('is-active', active); item.setAttribute('aria-selected', String(active)); });
    panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== tab.dataset.tab; });
  }));

  fileKind.addEventListener('change', updateFileOptions);
  updateFileOptions();

  fileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const target = targetBytes();
      const kind = fileKind.value;
      const button = fileForm.querySelector('button[type="submit"]');
      button.disabled = true;
      setStatus(fileStatus, kind === 'webm'
        ? `WebM을 실제 녹화 중입니다… 예상 길이 ${formatDuration(webmDurationForTarget(target))}`
        : kind === 'mp4'
          ? 'MP4를 생성하고 있습니다… 동적 녹화 지원 시 약 6초가 걸립니다.'
          : '파일을 생성하고 있습니다…');
      let data;
      let videoDurationSeconds;
      let generatedPatternName;
      let generatedVideoTitle;
      let hasDynamicVideoTitle = false;
      const patternFileName = safeName(fileName.value, 'test-file').toLowerCase();
      const patternIndex = nextPatternIndex(kind, patternFileName, documentPatterns.length);
      const pattern = documentPatterns[patternIndex];
      const generatedTitle = generatedKstTitle();
      if (kind === 'png') { data = await makePng(target, pattern, patternIndex, generatedTitle); generatedPatternName = pattern.name; }
      else if (kind === 'txt') { data = makeText(target, pattern, patternIndex, generatedTitle); generatedPatternName = pattern.name; }
      else if (kind === 'pdf') { data = makePdf(target, pattern, patternIndex, generatedTitle); generatedPatternName = pattern.name; }
      else if (kind === 'docx') { data = makeDocx(target, pattern, patternIndex, generatedTitle); generatedPatternName = pattern.name; }
      else if (kind === 'xlsx') { data = makeXlsx(target, pattern, generatedTitle); generatedPatternName = pattern.name; }
      else if (kind === 'mp4') {
        const mp4 = await makeMp4(target, patternIndex, generatedTitle);
        data = mp4.blob;
        videoDurationSeconds = mp4.durationSeconds;
        generatedPatternName = mp4.patternName;
        generatedVideoTitle = mp4.title;
        hasDynamicVideoTitle = mp4.dynamicTitle;
      }
      else {
        const webm = await makeWebm(target);
        data = webm.blob;
        videoDurationSeconds = webm.durationSeconds;
      }
      const dataLength = data instanceof Blob ? data.size : data.length;
      if (kind !== 'webm' && dataLength !== target) throw new Error(`목표 용량과 다릅니다 (${dataLength.toLocaleString('ko-KR')} bytes).`);
      const mime = { png: 'image/png', txt: 'text/plain;charset=utf-8', pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', webm: 'video/webm', mp4: 'video/mp4' }[kind];
      download(data instanceof Blob ? data : new Blob([data], { type: mime }), `${safeName(fileName.value, 'test-file')}.${kind}`);
      setStatus(fileStatus, kind === 'webm'
        ? `WebM 영상 ${formatBytes(data.size)}을 만들었습니다. 자동 지정 길이: ${formatDuration(videoDurationSeconds)} · 목표: ${formatBytes(target)}`
        : kind === 'mp4'
          ? `H.264/AAC MP4 영상 ${formatBytes(data.size)}을 만들었습니다. 사운드: ${generatedPatternName} · ${hasDynamicVideoTitle ? `화면 제목: ${generatedVideoTitle}` : '이 브라우저는 동적 MP4 제목을 지원하지 않아 기본 영상을 사용했습니다.'} · 길이: ${formatDuration(videoDurationSeconds)}`
        : `${kind.toUpperCase()} 파일 ${formatBytes(data.length)}을 만들었습니다. 생성 제목: ${generatedTitle} · 패턴: ${generatedPatternName} (파일명별 중복 없는 랜덤 10종)`);
      button.disabled = false;
    } catch (error) {
      setStatus(fileStatus, error instanceof Error ? error.message : '파일을 생성하지 못했습니다.', true);
      const button = fileForm.querySelector('button[type="submit"]');
      button.disabled = false;
    }
  });

  const graphemeSegmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('ko', { granularity: 'grapheme' })
    : null;
  const messageSegments = (value) => graphemeSegmenter
    ? Array.from(graphemeSegmenter.segment(value), ({ segment }) => segment)
    : Array.from(value);
  const messageLength = (value) => messageSegments(value).length;
  const messageStats = (value) => ({
    graphemes: messageLength(value),
    codePoints: Array.from(value).length,
    codeUnits: value.length,
    bytes: encoder.encode(value).length,
  });
  const updateMessageMetrics = () => {
    const stats = messageStats(messageOutput.value);
    messageGraphemes.textContent = stats.graphemes.toLocaleString('ko-KR');
    messageCodePoints.textContent = stats.codePoints.toLocaleString('ko-KR');
    messageCodeUnits.textContent = stats.codeUnits.toLocaleString('ko-KR');
    messageBytes.textContent = stats.bytes.toLocaleString('ko-KR');
    return stats;
  };
  const describeMessageStats = (stats) => `화면 ${stats.graphemes.toLocaleString('ko-KR')}자 · 코드 포인트 ${stats.codePoints.toLocaleString('ko-KR')}개 · UTF-16 ${stats.codeUnits.toLocaleString('ko-KR')} · UTF-8 ${stats.bytes.toLocaleString('ko-KR')} bytes`;

  const qrPayloadByteLimit = 2600;
  const qrContentByteLimit = qrPayloadByteLimit - 48;
  const qrQuietZone = 4;
  const qrSvgNamespace = 'http://www.w3.org/2000/svg';

  const clearMessageQr = () => {
    messageQrParts = [];
    messageQrIndex = 0;
    messageQrOutput.hidden = true;
    messageQrPreview.replaceChildren(Object.assign(document.createElement('span'), { textContent: 'QR' }));
  };

  const splitMessageForQr = (value) => {
    const parts = [];
    let part = [];
    let partBytes = 0;
    messageSegments(value).forEach((segment) => {
      const segmentBytes = encoder.encode(segment).length;
      if (part.length && partBytes + segmentBytes > qrContentByteLimit) {
        parts.push(part.join(''));
        part = [];
        partBytes = 0;
      }
      if (segmentBytes > qrContentByteLimit) throw new Error('QR 한 조각에 담을 수 없는 긴 결합 문자입니다. 해당 문자를 줄여 주세요.');
      part.push(segment);
      partBytes += segmentBytes;
    });
    if (part.length) parts.push(part.join(''));
    return parts;
  };

  const makeMessageQrSvg = (value, index, total) => {
    window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8'];
    const qr = window.qrcode(0, 'L');
    qr.addData(value, 'Byte');
    qr.make();
    const count = qr.getModuleCount();
    const totalModules = count + qrQuietZone * 2;
    const svg = document.createElementNS(qrSvgNamespace, 'svg');
    svg.setAttribute('xmlns', qrSvgNamespace);
    svg.setAttribute('viewBox', `0 0 ${totalModules} ${totalModules}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', total > 1 ? `생성 문자 QR ${index + 1}/${total}` : '생성 문자 QR');
    svg.setAttribute('shape-rendering', 'crispEdges');
    const background = document.createElementNS(qrSvgNamespace, 'rect');
    background.setAttribute('width', String(totalModules));
    background.setAttribute('height', String(totalModules));
    background.setAttribute('fill', '#ffffff');
    svg.append(background);
    let pathData = '';
    for (let row = 0; row < count; row += 1) {
      for (let column = 0; column < count; column += 1) {
        if (qr.isDark(row, column)) pathData += `M${column + qrQuietZone} ${row + qrQuietZone}h1v1h-1z`;
      }
    }
    const modules = document.createElementNS(qrSvgNamespace, 'path');
    modules.setAttribute('fill', '#111310');
    modules.setAttribute('d', pathData);
    svg.append(modules);
    return svg;
  };

  const showMessageQrPart = (index) => {
    if (messageQrParts.length === 0) return;
    messageQrIndex = Math.max(0, Math.min(index, messageQrParts.length - 1));
    const part = messageQrParts[messageQrIndex];
    const svg = makeMessageQrSvg(part, messageQrIndex, messageQrParts.length);
    messageQrPreview.replaceChildren(svg);
    messageQrPosition.textContent = `${(messageQrIndex + 1).toLocaleString('ko-KR')} / ${messageQrParts.length.toLocaleString('ko-KR')}`;
    messageQrBytes.textContent = `현재 QR · ${encoder.encode(part).length.toLocaleString('ko-KR')} bytes`;
    messageQrPrevious.disabled = messageQrIndex === 0;
    messageQrNext.disabled = messageQrIndex === messageQrParts.length - 1;
  };

  const prepareMessageQr = () => {
    const value = messageOutput.value;
    if (!value) throw new Error('먼저 문자를 만들어 주세요.');
    if (typeof window.qrcode !== 'function') throw new Error('QR 생성기를 불러오지 못했습니다. 페이지를 새로고침해 주세요.');
    const totalBytes = encoder.encode(value).length;
    const contents = totalBytes <= qrPayloadByteLimit ? [value] : splitMessageForQr(value);
    messageQrParts = contents.map((part, index) => contents.length === 1 ? part : `[ROSSI TEST ${index + 1}/${contents.length}]\n${part}`);
    messageQrIndex = 0;
    messageQrOutput.hidden = false;
    showMessageQrPart(0);
    messageQrHelp.textContent = messageQrParts.length === 1
      ? '휴대폰 카메라로 스캔하면 생성 문자를 바로 확인할 수 있습니다.'
      : `전체 문자를 ${messageQrParts.length.toLocaleString('ko-KR')}개로 나눴습니다. 각 스캔 결과의 [ROSSI TEST n/${messageQrParts.length}] 첫 줄을 빼고 번호순으로 이어 붙이세요.`;
    return messageQrParts.length;
  };

  const emojiGroups = {
    smileys: [
      ['😀', '활짝 웃는 얼굴', 'smile grin happy'], ['😃', '큰 눈으로 웃는 얼굴', 'smile happy'], ['😂', '기쁨의 눈물', 'laugh tears'], ['🥰', '하트와 웃는 얼굴', 'love heart'],
      ['😎', '선글라스 얼굴', 'cool sunglasses'], ['🤔', '생각하는 얼굴', 'thinking'], ['😭', '크게 우는 얼굴', 'cry sad'], ['😡', '화난 얼굴', 'angry'],
    ],
    people: [
      ['👋', '손 흔들기', 'wave hand'], ['👍', '좋아요', 'thumbs up like'], ['🙏', '모은 두 손', 'please thanks pray'], ['💪', '힘센 팔', 'strong muscle'],
      ['👏', '박수', 'clap'], ['🙌', '두 손 들기', 'celebrate hands'], ['👀', '눈', 'eyes look'], ['🧑', '사람', 'person'], ['👩', '여성', 'woman'], ['👨', '남성', 'man'],
    ],
    animals: [
      ['🐶', '강아지', 'dog puppy'], ['🐱', '고양이', 'cat'], ['🐻', '곰', 'bear'], ['🐼', '판다', 'panda'], ['🦊', '여우', 'fox'],
      ['🐸', '개구리', 'frog'], ['🐰', '토끼', 'rabbit'], ['🦁', '사자', 'lion'], ['🌸', '벚꽃', 'flower blossom'], ['🌈', '무지개', 'rainbow'],
    ],
    food: [
      ['🍎', '사과', 'apple fruit'], ['🍕', '피자', 'pizza'], ['🍔', '햄버거', 'burger'], ['🍜', '국수', 'noodle ramen'],
      ['🍣', '초밥', 'sushi'], ['☕', '커피', 'coffee'], ['🎂', '생일 케이크', 'birthday cake'], ['🥑', '아보카도', 'avocado'],
    ],
    activity: [
      ['⚽', '축구공', 'soccer football'], ['🏀', '농구공', 'basketball'], ['🎾', '테니스', 'tennis'], ['🎮', '게임', 'game controller'],
      ['🎨', '미술 팔레트', 'art palette'], ['🎵', '음표', 'music note'], ['🏆', '트로피', 'trophy'], ['🚴', '자전거 타는 사람', 'bicycle cycling'],
    ],
    travel: [
      ['🚗', '자동차', 'car'], ['🚕', '택시', 'taxi'], ['🚌', '버스', 'bus'], ['✈️', '비행기', 'airplane flight'],
      ['🚀', '로켓', 'rocket'], ['🏠', '집', 'house home'], ['🗺️', '세계 지도', 'world map'], ['🗼', '도쿄 타워', 'tower travel'],
    ],
    objects: [
      ['📱', '휴대전화', 'phone mobile'], ['💻', '노트북', 'computer laptop'], ['⌚', '손목시계', 'watch'], ['📷', '카메라', 'camera'],
      ['💡', '전구', 'idea light'], ['🔥', '불', 'fire'], ['🎁', '선물', 'gift'], ['📌', '압정', 'pin'],
    ],
    symbols: [
      ['❤️', '빨간 하트', 'red heart love'], ['💛', '노란 하트', 'yellow heart'], ['✅', '체크 표시', 'check done'], ['❌', '엑스 표시', 'cross wrong'],
      ['⚠️', '경고', 'warning'], ['⭐', '별', 'star'], ['✨', '반짝임', 'sparkles'], ['💯', '백 점', 'hundred score'],
    ],
    flags: [
      ['🇰🇷', '대한민국 국기', 'korea flag kr'], ['🇺🇸', '미국 국기', 'united states flag us'], ['🇯🇵', '일본 국기', 'japan flag jp'], ['🇬🇧', '영국 국기', 'united kingdom flag gb'],
      ['🇨🇦', '캐나다 국기', 'canada flag ca'], ['🇦🇺', '호주 국기', 'australia flag au'], ['🇫🇷', '프랑스 국기', 'france flag fr'], ['🇩🇪', '독일 국기', 'germany flag de'],
    ],
    sequences: [
      ['👍🏽', '좋아요: 갈색 피부', 'thumbs up skin tone two code points'], ['👋🏻', '손 흔들기: 밝은 피부', 'wave skin tone two code points'], ['🙏🏿', '모은 두 손: 어두운 피부', 'pray skin tone two code points'],
      ['👨‍💻', '남성 개발자', 'man technologist zwj three code points'], ['👩‍🔬', '여성 과학자', 'woman scientist zwj three code points'], ['🧑‍🚀', '우주비행사', 'astronaut zwj three code points'],
      ['👨‍👩‍👧‍👦', '가족', 'family zwj'], ['👩‍❤️‍👩', '하트가 있는 두 여성', 'couple love zwj'], ['🏳️‍🌈', '무지개 깃발', 'rainbow flag zwj'], ['🏴‍☠️', '해적 깃발', 'pirate flag zwj'],
    ],
  };
  const emojiItems = Object.entries(emojiGroups).flatMap(([category, items]) => items.map(([value, label, keywords]) => ({ category, value, label, keywords })));
  const filteredEmojiItems = () => {
    const query = emojiSearch.value.trim().toLocaleLowerCase('ko-KR');
    return emojiItems.filter((item) => {
      const codePointCount = Array.from(item.value).length;
      const matchesCategory = emojiCategory.value === 'all'
        || (emojiCategory.value === 'single' && codePointCount === 1)
        || (emojiCategory.value === 'sequences' && codePointCount > 1)
        || item.category === emojiCategory.value;
      return matchesCategory && (!query || `${item.label} ${item.keywords}`.toLocaleLowerCase('ko-KR').includes(query));
    });
  };
  const insertMessageText = (text) => {
    const start = messageOutput.selectionStart ?? messageOutput.value.length;
    const end = messageOutput.selectionEnd ?? start;
    messageOutput.setRangeText(text, start, end, 'end');
    const stats = updateMessageMetrics();
    clearMessageQr();
    messageQrRefresh.disabled = false;
    messageOutput.focus();
    return stats;
  };
  const renderEmojiGrid = () => {
    const items = filteredEmojiItems();
    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      const stats = messageStats(item.value);
      const button = document.createElement('button');
      const glyph = document.createElement('span');
      const count = document.createElement('small');
      button.type = 'button';
      button.className = 'emoji-option';
      glyph.textContent = item.value;
      glyph.setAttribute('aria-hidden', 'true');
      count.textContent = `CP ${stats.codePoints}`;
      count.setAttribute('aria-hidden', 'true');
      button.append(glyph, count);
      button.title = `${item.label} · 화면 ${stats.graphemes}자 · 코드 포인트 ${stats.codePoints}개 · UTF-16 ${stats.codeUnits}`;
      button.setAttribute('aria-label', button.title);
      button.addEventListener('click', () => {
        const updated = insertMessageText(item.value);
        setStatus(messageStatus, `${item.label} ${item.value}을(를) 넣었습니다. ${describeMessageStats(updated)}`);
      });
      fragment.append(button);
    });
    emojiGrid.replaceChildren(fragment);
    emojiEmpty.hidden = items.length !== 0;
  };

  const makeMessage = () => {
    const count = Number(messageCount.value);
    if (!Number.isInteger(count) || count < 1 || count > 100000) throw new Error('문자 수는 1~100,000자로 입력해 주세요.');
    const selectedTypes = messageCharacterInputs.filter((input) => input.checked).map((input) => input.value);
    if (selectedTypes.length === 0) throw new Error('문자 구성을 하나 이상 선택해 주세요.');
    const characterSets = {
      korean: messageSegments('가나다라마바사아자차카타파하테스트문자경계값'),
      english: messageSegments('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'),
      number: messageSegments('0123456789'),
      symbol: messageSegments('!@#$%^&*()-_=+[]{};:,.?/|~'),
      emoji: emojiItems.map((item) => item.value),
    };
    const output = messageSegments(messagePrefix.value);
    while (output.length < count) {
      shuffled(selectedTypes).forEach((type) => {
        if (output.length < count) {
          const characters = characterSets[type];
          output.push(characters[randomIndex(characters.length)]);
        }
      });
    }
    return output.slice(0, count).join('');
  };

  messagePreset.addEventListener('change', () => { if (messagePreset.value !== 'custom') messageCount.value = messagePreset.value; });
  messageCount.addEventListener('input', () => { messagePreset.value = ['499', '500', '501', '3999', '4000', '4001', '10000'].includes(messageCount.value) ? messageCount.value : 'custom'; });
  messageOutput.addEventListener('input', () => {
    const stats = updateMessageMetrics();
    clearMessageQr();
    messageQrRefresh.disabled = !messageOutput.value;
    setStatus(messageStatus, messageOutput.value ? describeMessageStats(stats) : '입력할 내용을 기다리고 있습니다.');
  });
  messageForm.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const value = makeMessage();
      messageOutput.value = value;
      const stats = updateMessageMetrics();
      messageQrRefresh.disabled = false;
      const qrCount = prepareMessageQr();
      setStatus(messageStatus, `선택한 문자 구성을 섞어 목표 화면 글자 수에 맞췄습니다. QR ${qrCount.toLocaleString('ko-KR')}개를 만들었습니다. ${describeMessageStats(stats)}`);
    } catch (error) { setStatus(messageStatus, error instanceof Error ? error.message : '문자를 만들지 못했습니다.', true); }
  });
  messageCopy.addEventListener('click', async () => {
    if (!messageOutput.value) { setStatus(messageStatus, '먼저 문자를 만들어 주세요.', true); return; }
    try { await navigator.clipboard.writeText(messageOutput.value); setStatus(messageStatus, '클립보드에 복사했습니다.'); }
    catch (_) { messageOutput.select(); document.execCommand('copy'); setStatus(messageStatus, '클립보드에 복사했습니다.'); }
  });
  messageQrRefresh.addEventListener('click', () => {
    try {
      const qrCount = prepareMessageQr();
      setStatus(messageStatus, `현재 입력 내용으로 QR ${qrCount.toLocaleString('ko-KR')}개를 만들었습니다.`);
    } catch (error) { setStatus(messageStatus, error instanceof Error ? error.message : 'QR을 만들지 못했습니다.', true); }
  });
  messageQrPrevious.addEventListener('click', () => showMessageQrPart(messageQrIndex - 1));
  messageQrNext.addEventListener('click', () => showMessageQrPart(messageQrIndex + 1));
  messageClear.addEventListener('click', () => {
    messageOutput.value = '';
    updateMessageMetrics();
    clearMessageQr();
    messageQrRefresh.disabled = true;
    messageOutput.focus();
    setStatus(messageStatus, '입력 내용을 초기화했습니다.');
  });
  emojiCategory.addEventListener('change', renderEmojiGrid);
  emojiSearch.addEventListener('input', renderEmojiGrid);
  emojiSearch.addEventListener('keydown', (event) => { if (event.key === 'Enter') event.preventDefault(); });
  emojiRandomCount.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); emojiRandom.click(); } });
  emojiRandom.addEventListener('click', () => {
    const count = Number(emojiRandomCount.value);
    const items = filteredEmojiItems();
    if (!Number.isInteger(count) || count < 1 || count > 20) { setStatus(messageStatus, '무작위 이모지 개수는 1~20개로 입력해 주세요.', true); emojiRandomCount.focus(); return; }
    if (items.length === 0) { setStatus(messageStatus, '현재 검색 조건에서 넣을 이모지가 없습니다.', true); emojiSearch.focus(); return; }
    const selected = [];
    let pool = [...items];
    while (selected.length < count) {
      if (pool.length === 0) pool = [...items];
      selected.push(pool.splice(randomIndex(pool.length), 1)[0].value);
    }
    const stats = insertMessageText(selected.join(''));
    setStatus(messageStatus, `기기 기본 이모지 ${count.toLocaleString('ko-KR')}개를 넣었습니다. ${describeMessageStats(stats)}`);
  });
  updateMessageMetrics();
  renderEmojiGrid();
  if (!graphemeSegmenter) setStatus(messageStatus, '이 브라우저는 화면 글자 분리를 지원하지 않아 코드 포인트 기준으로 대신 계산합니다.', true);

  const contactCountries = {
    KR: { label: '대한민국', callingCode: '82', defaultPrefix: '010', prefixPattern: /^010$/, prefixHint: '대한민국 휴대전화 형식: 010', nationalPattern: /^010\d{8}$/, names: ['김민준', '이서연', '박도윤', '최지우', '정하준', '강서윤'] },
    US: { label: '미국', callingCode: '1', defaultPrefix: '202', prefixPattern: /^[2-9]\d{2}$/, prefixHint: '미국 지역번호: 2~9로 시작하는 숫자 3자리 (예: 202)', nationalPattern: /^[2-9]\d{2}555\d{4}$/, names: ['Alex Morgan', 'Jordan Lee', 'Taylor Smith', 'Casey Brown', 'Riley Davis', 'Jamie Wilson'] },
    CA: { label: '캐나다', callingCode: '1', defaultPrefix: '416', prefixPattern: /^[2-9]\d{2}$/, prefixHint: '캐나다 지역번호: 2~9로 시작하는 숫자 3자리 (예: 416)', nationalPattern: /^[2-9]\d{2}555\d{4}$/, names: ['Avery Martin', 'Quinn Roy', 'Morgan Clark', 'Cameron Lewis', 'Rowan Scott', 'Parker Young'] },
    GB: { label: '영국', callingCode: '44', defaultPrefix: '07700', prefixPattern: /^07\d{3}$/, prefixHint: '영국 모바일 시작값: 07로 시작하는 숫자 5자리 (예: 07700)', nationalPattern: /^07\d{9}$/, names: ['Oliver Taylor', 'Amelia Jones', 'George Evans', 'Isla Thomas', 'Harry Walker', 'Mia Harris'] },
    JP: { label: '일본', callingCode: '81', defaultPrefix: '070', prefixPattern: /^0[789]0$/, prefixHint: '일본 모바일 시작값: 070, 080 또는 090', nationalPattern: /^0[789]0\d{8}$/, names: ['佐藤 太郎', '鈴木 花子', '高橋 翔', '田中 美咲', '伊藤 蓮', '渡辺 葵'] },
    AU: { label: '호주', callingCode: '61', defaultPrefix: '04', prefixPattern: /^04$/, prefixHint: '호주 모바일 시작값: 04', nationalPattern: /^04\d{8}$/, names: ['Noah Williams', 'Charlotte Brown', 'Jack Wilson', 'Olivia Taylor', 'Leo Anderson', 'Grace Thompson'] },
    SG: { label: '싱가포르', callingCode: '65', defaultPrefix: '8', prefixPattern: /^[89]$/, prefixHint: '싱가포르 모바일 시작값: 8 또는 9', nationalPattern: /^[89]\d{7}$/, names: ['Tan Wei Ming', 'Lim Jia Yi', 'Lee Jun Hao', 'Ng Hui Min', 'Ong Kai Wen', 'Goh Xin Yi'] },
    DE: { label: '독일', callingCode: '49', defaultPrefix: '0151', prefixPattern: /^01[567]\d$/, prefixHint: '독일 모바일 시작값: 015x, 016x 또는 017x', nationalPattern: /^01[567]\d{8}$/, names: ['Lukas Müller', 'Anna Schmidt', 'Jonas Fischer', 'Emma Weber', 'Leon Wagner', 'Mia Becker'] },
    FR: { label: '프랑스', callingCode: '33', defaultPrefix: '06', prefixPattern: /^0[67]$/, prefixHint: '프랑스 모바일 시작값: 06 또는 07', nationalPattern: /^0[67]\d{8}$/, names: ['Lucas Martin', 'Emma Bernard', 'Hugo Dubois', 'Léa Thomas', 'Louis Robert', 'Chloé Richard'] },
    IN: { label: '인도', callingCode: '91', defaultPrefix: '9', prefixPattern: /^[6-9]$/, prefixHint: '인도 모바일 시작값: 6, 7, 8 또는 9', nationalPattern: /^[6-9]\d{9}$/, names: ['Aarav Sharma', 'Ananya Patel', 'Vivaan Singh', 'Diya Gupta', 'Arjun Kumar', 'Isha Mehta'] },
    ID: { label: '인도네시아', callingCode: '62', defaultPrefix: '0812', prefixPattern: /^08[1-9]\d$/, prefixHint: '인도네시아 모바일 시작값: 081x~089x (예: 0812)', nationalPattern: /^08[1-9]\d{7,9}$/, names: ['Budi Santoso', 'Siti Aisyah', 'Andi Pratama', 'Dewi Lestari', 'Rizky Hidayat', 'Putri Maharani'] },
    TR: { label: '튀르키예', callingCode: '90', defaultPrefix: '0532', prefixPattern: /^05\d{2}$/, prefixHint: '튀르키예 모바일 시작값: 05로 시작하는 숫자 4자리 (예: 0532)', nationalPattern: /^05\d{9}$/, names: ['Ahmet Yılmaz', 'Ayşe Kaya', 'Mehmet Demir', 'Elif Şahin', 'Can Aydın', 'Zeynep Arslan'] },
    TM: { label: '투르크메니스탄', callingCode: '993', defaultPrefix: '72', prefixPattern: /^(6[1-5]|7[12])$/, prefixHint: '투르크메니스탄 모바일 시작값: 61~65, 71 또는 72 (예: 72)', nationalPattern: /^(6[1-5]|7[12])\d{6}$/, names: ['Aman Döwletov', 'Aşgabat Mämmedowa', 'Türkmenistanyň Berdiýew', 'Gülşat Orazowa', 'Serdar Annanýazow', 'Aýna Jumaýewa'] },
  };

  const serialDigits = (base, index, length) => String(base + index).padStart(length, '0').slice(-length);
  const buildCountryPhone = (countryCode, config, prefix, index) => {
    let nationalDigits;
    let phone;
    if (countryCode === 'KR' || countryCode === 'JP') {
      const serial = serialDigits(10_000_000, index, 8);
      nationalDigits = `${prefix}${serial}`;
      phone = `${prefix}-${serial.slice(0, 4)}-${serial.slice(4)}`;
    } else if (countryCode === 'US' || countryCode === 'CA') {
      const serial = serialDigits(1000, index, 4);
      nationalDigits = `${prefix}555${serial}`;
      phone = `(${prefix}) 555-${serial}`;
    } else if (countryCode === 'GB') {
      const serial = serialDigits(900_000, index, 6);
      nationalDigits = `${prefix}${serial}`;
      phone = `${prefix} ${serial.slice(0, 3)} ${serial.slice(3)}`;
    } else if (countryCode === 'AU') {
      const serial = serialDigits(91_570_000, index, 8);
      nationalDigits = `${prefix}${serial}`;
      phone = `${nationalDigits.slice(0, 4)} ${nationalDigits.slice(4, 7)} ${nationalDigits.slice(7)}`;
    } else if (countryCode === 'SG') {
      const serial = serialDigits(1_000_000, index, 7);
      nationalDigits = `${prefix}${serial}`;
      phone = `${nationalDigits.slice(0, 4)} ${nationalDigits.slice(4)}`;
    } else if (countryCode === 'DE') {
      const serial = serialDigits(1_000_000, index, 7);
      nationalDigits = `${prefix}${serial}`;
      phone = `${prefix} ${serial}`;
    } else if (countryCode === 'ID') {
      const serial = serialDigits(1_000_000, index, 7);
      nationalDigits = `${prefix}${serial}`;
      phone = `${prefix} ${serial.slice(0, 3)} ${serial.slice(3)}`;
    } else if (countryCode === 'FR') {
      const serial = serialDigits(10_000_000, index, 8);
      nationalDigits = `${prefix}${serial}`;
      phone = nationalDigits.match(/.{1,2}/g).join(' ');
    } else if (countryCode === 'TR') {
      const serial = serialDigits(1_000_000, index, 7);
      nationalDigits = `${prefix}${serial}`;
      phone = `${prefix} ${serial.slice(0, 3)} ${serial.slice(3)}`;
    } else if (countryCode === 'TM') {
      const serial = serialDigits(100_000, index, 6);
      nationalDigits = `${prefix}${serial}`;
      phone = `${prefix} ${serial.slice(0, 2)} ${serial.slice(2, 4)} ${serial.slice(4)}`;
    } else {
      const serial = serialDigits(100_000_000, index, 9);
      nationalDigits = `${prefix}${serial}`;
      phone = `${nationalDigits.slice(0, 5)} ${nationalDigits.slice(5)}`;
    }
    if (!config.nationalPattern.test(nationalDigits)) throw new Error(`${config.label} 전화번호 형식을 만들지 못했습니다.`);
    const e164 = `+${config.callingCode}${nationalDigits.startsWith('0') ? nationalDigits.slice(1) : nationalDigits}`;
    if (!/^\+[1-9]\d{7,14}$/.test(e164)) throw new Error('E.164 국제번호 형식을 만들지 못했습니다.');
    return { phone, e164 };
  };

  const selectedContactCountry = () => contactCountries[contactCountry.value] || contactCountries.KR;
  const validateContactPrefix = () => {
    const config = selectedContactCountry();
    const prefix = contactPrefix.value.trim();
    contactPrefix.setCustomValidity(config.prefixPattern.test(prefix) ? '' : config.prefixHint);
    return { config, prefix };
  };

  const updateContactCountry = () => {
    const config = selectedContactCountry();
    contactPrefix.value = config.defaultPrefix;
    contactPrefix.maxLength = Math.max(5, config.defaultPrefix.length);
    contactPrefix.placeholder = config.defaultPrefix;
    contactPrefixHint.textContent = config.prefixHint;
    validateContactPrefix();
    contactCsv.disabled = true;
    contacts = [];
    contactPreview.replaceChildren();
    setStatus(contactStatus, `${config.label} (+${config.callingCode}) 형식으로 국내 번호와 E.164 국제번호를 생성합니다.`);
  };

  const makeContacts = () => {
    const count = Number(contactCount.value);
    const countryCode = contactCountry.value;
    const { config, prefix } = validateContactPrefix();
    if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error('연락처 수는 1~1,000개로 입력해 주세요.');
    if (!config.prefixPattern.test(prefix)) throw new Error(config.prefixHint);
    return Array.from({ length: count }, (_, index) => {
      const number = buildCountryPhone(countryCode, config, prefix, index);
      return {
        country: `${config.label} (+${config.callingCode})`,
        name: config.names[index % config.names.length],
        phone: number.phone,
        e164: number.e164,
        email: `test.${countryCode.toLowerCase()}.${String(index + 1).padStart(4, '0')}@example.test`,
        company: `Test Company ${countryCode}-${(index % 12) + 1}`,
      };
    });
  };

  const showContacts = (items) => {
    contactPreview.replaceChildren();
    const table = document.createElement('table');
    const head = document.createElement('thead');
    const row = document.createElement('tr');
    ['국가', '이름', '국내 형식', 'E.164 국제번호', '이메일', '회사'].forEach((label) => { const cell = document.createElement('th'); cell.textContent = label; row.append(cell); });
    head.append(row); table.append(head);
    const body = document.createElement('tbody');
    items.slice(0, 50).forEach((item) => { const itemRow = document.createElement('tr'); [item.country, item.name, item.phone, item.e164, item.email, item.company].forEach((value) => { const cell = document.createElement('td'); cell.textContent = value; itemRow.append(cell); }); body.append(itemRow); });
    table.append(body); contactPreview.append(table);
  };

  contactCountry.addEventListener('change', updateContactCountry);
  contactPrefix.addEventListener('input', validateContactPrefix);
  updateContactCountry();
  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();
    try { contacts = makeContacts(); showContacts(contacts); contactCsv.disabled = false; setStatus(contactStatus, `${selectedContactCountry().label} 형식의 가상 연락처 ${contacts.length.toLocaleString('ko-KR')}개를 만들었습니다. 국내 형식과 E.164 번호를 검증했으며, 미리보기는 최대 50개입니다.`); }
    catch (error) { setStatus(contactStatus, error instanceof Error ? error.message : '연락처를 만들지 못했습니다.', true); }
  });
  contactCsv.addEventListener('click', () => {
    if (contacts.length === 0) return;
    const quote = (value) => `"${value.replace(/"/g, '""')}"`;
    const rows = [['국가', '이름', '국내 형식', 'E.164 국제번호', '이메일', '회사'], ...contacts.map((item) => [item.country, item.name, item.phone, item.e164, item.email, item.company])];
    download(new Blob(['\uFEFF', rows.map((row) => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'rossi-dummy-contacts.csv');
    setStatus(contactStatus, 'CSV 파일을 내려받았습니다.');
  });
})();

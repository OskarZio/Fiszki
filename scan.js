'use strict';
/* „Skan”: zdjęcia notatek / strony podręcznika / PDF → fiszki.
   1) AI (Claude) – najlepsza jakość, wymaga własnego klucza API (płatne za użycie).
   2) Bez AI – odczyt tekstu (OCR / tekst z PDF) trafia do „Listy”, gdzie poprawiasz i importujesz.
   3) Strona PDF lub zdjęcie jako „Obraz z lukami”. */

let SCAN = { files: [], cards: null, busy: '' };   // files: {name, type, data (dataURL), pages}
const AI_MODELS = [
  ['claude-opus-5-5', 'Claude Opus 5.5 – najlepsza jakość'],
  ['claude-sonnet-5-5', 'Claude Sonnet 5.5 – szybszy, tańszy'],
  ['claude-haiku-5-5', 'Claude Haiku 5.5 – najtańszy'],
];

const readDataUrl = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });

async function scanAddBlob(blob, name) {
  if (blob.type === 'application/pdf' || /\.pdf$/i.test(name || '')) {
    if (blob.size > 30e6) throw new Error('PDF jest za duży (max ok. 30 MB) – podziel go na części');
    SCAN.files.push({ name: name || 'dokument.pdf', type: 'pdf', data: await readDataUrl(blob) });
  } else {
    SCAN.files.push({ name: name || 'zdjęcie', type: 'image', data: await compressImage(blob, 1568) });
  }
  SCAN.cards = null;
}

async function getPdf(file) {
  await loadScript('vendor/pdf.min.js');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
  return pdfjsLib.getDocument({ data: dataUrlBytes(file.data) }).promise;
}
async function pdfPageImage(pdf, n, maxSide = 1600) {
  const page = await pdf.getPage(n);
  const v1 = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(3, maxSide / Math.max(v1.width, v1.height)) });
  const c = document.createElement('canvas'); c.width = viewport.width; c.height = viewport.height;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: g, viewport }).promise;
  return c.toDataURL('image/jpeg', 0.85);
}

// ------------------------------------------------------------ AI (Claude)
const CARD_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['cards'],
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['type', 'front', 'back', 'text', 'hint'],
        properties: {
          type: { type: 'string', enum: ['basic', 'cloze'] },
          front: { type: 'string' }, back: { type: 'string' }, text: { type: 'string' }, hint: { type: 'string' },
        },
      },
    },
  },
};

function aiPrompt(opts) {
  const style = { mix: 'Mieszaj fiszki typu pytanie–odpowiedź (basic) i zdania z lukami (cloze) – wybierz typ, który najlepiej pasuje do danego faktu.',
    basic: 'Twórz wyłącznie fiszki typu pytanie–odpowiedź (basic).', cloze: 'Twórz wyłącznie zdania z lukami (cloze).' }[opts.style];
  const count = opts.count === 'auto' ? 'Liczbę fiszek dobierz do ilości materiału – obejmij wszystkie ważne fakty.' : `Utwórz około ${opts.count} fiszek, wybierając najważniejsze fakty.`;
  return `Jesteś ekspertem od tworzenia fiszek do nauki metodą powtórek rozłożonych w czasie (jak w Anki). Na podstawie załączonych materiałów (zdjęcia notatek, strony podręcznika, schematy lub PDF) utwórz fiszki.

Zasady:
- Jedna fiszka = jeden fakt (zasada minimum informacji). Pytania jednoznaczne, odpowiedzi krótkie.
- Pisz w języku materiału (domyślnie po polsku); terminy łacińskie i fachowe zachowaj w oryginale.
- Opieraj się tylko na treści materiału – nie dopisuj faktów spoza niego.
- Gdy materiał to opisany rysunek/schemat (np. anatomia), zamieniaj podpisy w pytania typu „Jak nazywa się struktura…?”.
- Pole "hint": dla trudniejszych faktów krótkie, obrazowe skojarzenie lub mnemotechnika po polsku, która pomoże zapamiętać odpowiedź; w pozostałych przypadkach pusty tekst.
- Typ "basic": "front" = pytanie, "back" = odpowiedź, "text" = "".
- Typ "cloze": "text" = zdanie z lukami w składni Anki {{c1::odpowiedź}}; kolejne luki w tym samym zdaniu numeruj c2, c3… (każdy numer to osobna karta); "front" = "", "back" = "".
- ${style}
- ${count}${opts.extra ? `\n\nDodatkowe polecenia od ucznia: ${opts.extra}` : ''}`;
}

// 🤖 dostawca AI: Gemini (darmowy klucz z Google AI Studio) albo Claude (płatny); wybrany w Ustawieniach → AI
const aiProv = () => S.settings.aiProv === 'claude' ? (S.settings.aiKey ? 'claude' : S.settings.geminiKey ? 'gemini' : '') : (S.settings.geminiKey ? 'gemini' : S.settings.aiKey ? 'claude' : '');
const aiReady = () => !!aiProv();
const GEMINI_MODEL = 'gemini-2.5-flash';
// Gemini nie zna additionalProperties w schemacie – usuwamy je
const gSchema = o => Array.isArray(o) ? o.map(gSchema) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'additionalProperties').map(([k, v]) => [k, gSchema(v)])) : o;
async function geminiCall(parts, { json = null, maxTokens = 32000 } = {}) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': S.settings.geminiKey },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { maxOutputTokens: maxTokens, ...(json ? { responseMimeType: 'application/json', responseSchema: gSchema(json) } : {}) } }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 400 && /API key/i.test(j.error?.message || '') ? 'nieprawidłowy klucz Gemini' : r.status === 429 ? 'darmowy limit Gemini na teraz wyczerpany – spróbuj za chwilę' : r.status === 403 ? 'klucz Gemini nie ma dostępu (sprawdź go w AI Studio)' : j.error?.message || 'Gemini chwilowo niedostępne');
  const c = j.candidates?.[0]; if (!c) throw new Error(j.promptFeedback?.blockReason ? 'Gemini odmówiło przetworzenia tego materiału' : 'pusta odpowiedź Gemini');
  if (c.finishReason === 'MAX_TOKENS') throw new Error('za dużo materiału naraz – podziel go na mniejsze części');
  return (c.content?.parts || []).map(p => p.text || '').join('');
}
async function aiCardsGemini(files, opts, material) {
  const parts = files.map(f => ({ inline_data: { mime_type: f.type === 'pdf' ? 'application/pdf' : 'image/jpeg', data: f.data.split(',')[1] } }));
  if (material) parts.push({ text: 'Materiał do nauki (notatki ucznia):\n\n' + material });
  parts.push({ text: aiPrompt(opts) });
  SCAN.busy = '✨ Gemini tworzy fiszki…'; const el = $('#scan-busy'); if (el) el.textContent = SCAN.busy;
  const cards = JSON.parse(await geminiCall(parts, { json: CARD_SCHEMA })).cards || [];
  return cards.map(c => ({ type: c.type, front: c.front || '', back: c.back || '', text: c.text || '', hint: c.hint || '', on: true })).filter(c => c.type === 'cloze' ? /\{\{c\d+::/.test(c.text) : c.front.trim() && c.back.trim());
}
async function aiCards(files, opts, material = '') {
  if (aiProv() === 'gemini') return aiCardsGemini(files, opts, material);
  const key = S.settings.aiKey;
  if (!key) throw new Error('Dodaj klucz AI w Ustawieniach → AI (darmowy Gemini albo Claude)');
  const { default: Anthropic } = await import('./vendor/anthropic-sdk.mjs');
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
  const content = files.map(f => f.type === 'pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data.split(',')[1] } }
    : { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: f.data.split(',')[1] } });
  if (material) content.push({ type: 'text', text: 'Materiał do nauki (notatki ucznia):\n\n' + material });
  content.push({ type: 'text', text: aiPrompt(opts) });
  const model = S.settings.aiModel || 'claude-opus-5-5';
  const params = {
    model, max_tokens: 32000,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: CARD_SCHEMA } },
    messages: [{ role: 'user', content }],
  };
  if (!model.startsWith('claude-haiku')) Object.assign(params, { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
  const stream = client.beta.messages.stream(params);
  let chars = 0;
  stream.on('text', t => { chars += t.length; SCAN.busy = `✨ AI tworzy fiszki… (${Math.round(chars / 80)} gotowych)`; const el = $('#scan-busy'); if (el) el.textContent = SCAN.busy; });
  let msg;
  try { msg = await stream.finalMessage(); }
  catch (e) {
    const st = e.status;
    throw new Error(st === 401 ? 'nieprawidłowy klucz API' : st === 429 ? 'za dużo zapytań – spróbuj za chwilę' : st === 400 ? (e.error?.error?.message || e.message) : st >= 500 ? 'serwer AI chwilowo niedostępny' : e.message);
  }
  if (msg.stop_reason === 'refusal') throw new Error('AI odmówiło przetworzenia tego materiału');
  if (msg.stop_reason === 'max_tokens') throw new Error('za dużo materiału naraz – podziel go na mniejsze części');
  const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
  const cards = JSON.parse(text).cards || [];
  return cards.map(c => ({ ...c, on: true })).filter(c => c.type === 'cloze' ? /\{\{c\d+::/.test(c.text) : c.front.trim() && c.back.trim());
}

// ------------------------------------------------------------ Bez AI: OCR i tekst z PDF
let ocrWorker, ocrReport = () => {};
async function ocrImage(dataUrl, report) {
  ocrReport = report;
  await loadScript('vendor/tesseract.min.js');
  if (!ocrWorker) {
    report('🔤 Pobieram moduł OCR i słownik polski (tylko za pierwszym razem)…');
    ocrWorker = await Tesseract.createWorker(['pol', 'eng'], 1, {
      workerPath: new URL('vendor/tesseract-worker.min.js', location.href).href,
      logger: m => m.status === 'recognizing text' && ocrReport(`🔤 Odczytuję tekst… ${Math.round(m.progress * 100)}%`),
    });
  }
  const { data } = await ocrWorker.recognize(dataUrl);
  return data.text;
}
async function extractText(report) {
  const parts = [];
  for (const f of SCAN.files) {
    if (f.type === 'pdf') {
      const pdf = await getPdf(f);
      let text = '';
      for (let p = 1; p <= pdf.numPages; p++) {
        report(`📄 Czytam PDF – strona ${p}/${pdf.numPages}`);
        const tc = await (await pdf.getPage(p)).getTextContent();
        text += tc.items.map(it => it.str + (it.hasEOL ? '\n' : '')).join('') + '\n';
      }
      if (text.replace(/\s/g, '').length < 20 * pdf.numPages) { // skan bez warstwy tekstu → OCR
        text = '';
        for (let p = 1; p <= Math.min(pdf.numPages, 30); p++) { report(`🔤 OCR strony ${p}/${pdf.numPages}`); text += await ocrImage(await pdfPageImage(pdf, p, 2000), report) + '\n'; }
      }
      parts.push(text);
    } else parts.push(await ocrImage(f.data, report));
  }
  return parts.join('\n').split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(l => l.length > 1).join('\n');
}

// ------------------------------------------------------------ Widok
function formScan(D) {
  const hasKey = aiReady();
  const files = SCAN.files.map((f, i) => `<div class="note" style="cursor:default">
      ${f.type === 'image' ? `<img src="${f.data}" alt="">` : '<span style="font-size:32px">📄</span>'}
      <div class="t"><div>${esc(f.name)}</div></div><button class="danger sm" data-act="scan-del" data-i="${i}">✕</button></div>`).join('');
  const o = D.scanOpts || (D.scanOpts = { style: 'mix', count: 'auto', extra: '' });
  const opt = (k, v, l) => `<option value="${v}" ${o[k] === v ? 'selected' : ''}>${l}</option>`;
  let results = '';
  if (SCAN.cards) {
    const on = SCAN.cards.filter(c => c.on).length;
    results = `<div class="card"><div class="row nowrap"><h3 class="grow" style="margin:0">Propozycje (${SCAN.cards.length})</h3>
      <button class="sm" data-act="scan-toggle-all">${on === SCAN.cards.length ? 'Odznacz' : 'Zaznacz'} wszystkie</button></div>
      <p class="small muted">Popraw, co trzeba, odznacz zbędne i dodaj do talii.</p>
      ${SCAN.cards.map((c, i) => `<div class="card tight" style="${c.on ? '' : 'opacity:.45'}">
        <label class="check" style="margin:0 0 6px"><input type="checkbox" data-sc="${i}" data-f="on" ${c.on ? 'checked' : ''}> <span class="tag">${c.type === 'cloze' ? 'luki' : 'pytanie'}</span></label>
        ${c.type === 'cloze' ? `<textarea data-sc="${i}" data-f="text" rows="2">${esc(c.text)}</textarea>`
          : `<input data-sc="${i}" data-f="front" value="${esc(c.front)}" placeholder="Pytanie"><div style="height:6px"></div><input data-sc="${i}" data-f="back" value="${esc(c.back)}" placeholder="Odpowiedź">`}
        <div style="height:6px"></div><input data-sc="${i}" data-f="hint" value="${esc(c.hint)}" placeholder="💡 Skojarzenie (opcjonalnie)">
      </div>`).join('')}
      <button class="primary block" data-act="scan-save">➕ Dodaj zaznaczone (${on})</button></div>`;
  }
  return `
  <div class="dropzone">
    <p>📷 Zrób zdjęcie notatek albo strony podręcznika, wybierz zdjęcia lub PDF – zamienię je w fiszki.</p>
    <div class="row" style="justify-content:center"><button class="primary" data-act="scan-pick">📷 Zdjęcie / PDF</button>
      <button data-act="scan-paste">📋 Wklej</button></div>
  </div>
  ${files ? `<div class="card tight">${files}</div>` : ''}
  ${SCAN.busy ? `<div class="banner center" id="scan-busy">${esc(SCAN.busy)}</div>` : ''}
  ${SCAN.files.length && !SCAN.busy ? `
    <div class="card">
      <h3 style="margin-top:0">✨ Fiszki z AI</h3>
      ${hasKey ? `
        <div class="row nowrap"><label class="field grow"><span>Rodzaj</span><select data-scanopt="style">${opt('style', 'mix', 'Mieszane')}${opt('style', 'basic', 'Pytanie–odpowiedź')}${opt('style', 'cloze', 'Luki w zdaniach')}</select></label>
          <label class="field grow"><span>Ile</span><select data-scanopt="count">${opt('count', 'auto', 'Automatycznie')}${opt('count', '10', '~10')}${opt('count', '20', '~20')}${opt('count', '40', '~40')}</select></label></div>
        <label class="field"><span>Dodatkowe polecenia (opcjonalnie)</span><input data-scanopt="extra" value="${esc(o.extra)}" placeholder="np. tylko nazwy łacińskie mięśni; pomiń przypisy"></label>
        <button class="primary block" data-act="scan-ai">✨ Utwórz fiszki</button>`
        : `<p class="small muted">AI najlepiej rozumie notatki, tabele i schematy. Wystarczy <b>darmowy klucz Gemini</b> od Google (1 minuta, bez karty).</p>
        <button class="block" data-go="#/more" data-anchor="ai">🆓 Dodaj darmowy klucz AI</button>`}
    </div>
    <div class="card">
      <h3 style="margin-top:0">Bez AI</h3>
      <button class="block" data-act="scan-ocr">🔤 Odczytaj tekst → lista do poprawki</button>
      <p class="small muted">Tekst ze zdjęcia/PDF trafi do zakładki „Lista”. Popraw linie do formatu <code>pytanie - odpowiedź</code> i importuj.</p>
      <button class="block" data-act="scan-occl">🖼️ Użyj jako obraz z lukami</button>
      <p class="small muted">Np. rycina z atlasu anatomii – zasłonisz podpisy palcem.</p>
    </div>` : ''}
  ${results}`;
}
function mountScan() {
  $$('[data-scanopt]').forEach(el => el.addEventListener('input', () => { DRAFT.scanOpts[el.dataset.scanopt] = el.value; }));
  $$('[data-sc]').forEach(el => el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => {
    const c = SCAN.cards[+el.dataset.sc]; if (!c) return;
    if (el.dataset.f === 'on') { c.on = el.checked; render(); } else c[el.dataset.f] = el.value;
  }));
}
const scanBusy = msg => { SCAN.busy = msg; const el = $('#scan-busy'); if (el) el.textContent = msg; else render(); };

Object.assign(ACTIONS, {
  'scan-pick': async () => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*,application/pdf'; i.multiple = true; i.style.display = 'none';
    document.body.append(i);
    i.onchange = async () => {
      const fs = [...i.files]; i.remove();
      try { for (const f of fs) await scanAddBlob(f, f.name); } catch (e) { toast(e.message, 4000); }
      render();
    };
    i.click();
  },
  'scan-paste': async () => {
    try { await scanAddBlob(await clipboardImage(), 'wklejony obraz'); render(); } catch (e) { toast(e.message, 3500); }
  },
  'scan-del': el => { SCAN.files.splice(+el.dataset.i, 1); SCAN.cards = null; render(); },
  'scan-ai': async () => {
    scanBusy('✨ Wysyłam materiał do AI…');
    try {
      SCAN.cards = await aiCards(SCAN.files, DRAFT.scanOpts);
      if (!SCAN.cards.length) toast('AI nie znalazło faktów do fiszek', 3500);
    } catch (e) { console.error(e); toast('Błąd AI: ' + e.message, 5000); }
    SCAN.busy = ''; render();
  },
  'scan-ocr': async () => {
    scanBusy('🔤 Przygotowuję odczyt tekstu…');
    try {
      const text = await extractText(scanBusy);
      SCAN.busy = '';
      if (!text.trim()) { toast('Nie udało się odczytać tekstu', 3500); return render(); }
      DRAFT.type = 'bulk'; DRAFT.bulk = text; render(); toast('Popraw linie i naciśnij „Importuj”', 3500);
    } catch (e) { console.error(e); SCAN.busy = ''; render(); toast('Błąd odczytu: ' + e.message, 5000); }
  },
  'scan-occl': async () => {
    let f = SCAN.files.find(x => x.type === 'image') || SCAN.files[0];
    try {
      let dataUrl = f.data;
      if (f.type === 'pdf') {
        const pdf = await getPdf(f);
        let n = 1;
        if (pdf.numPages > 1) { n = +prompt(`Która strona PDF? (1–${pdf.numPages})`, '1'); if (!n) return; n = clamp(Math.round(n), 1, pdf.numPages); }
        scanBusy(`📄 Renderuję stronę ${n}…`);
        dataUrl = await pdfPageImage(pdf, n);
      }
      const id = await putImage(dataUrl);
      SCAN.busy = ''; DRAFT.type = 'occl'; DRAFT.imageId = id; DRAFT.boxes = []; render();
    } catch (e) { SCAN.busy = ''; render(); toast('Błąd: ' + e.message, 4000); }
  },
  'scan-toggle-all': () => { const all = SCAN.cards.every(c => c.on); SCAN.cards.forEach(c => { c.on = !all; }); render(); },
  'scan-save': () => {
    const sel = SCAN.cards.filter(c => c.on); if (!sel.length) return toast('Nic nie zaznaczono');
    const t0 = Date.now(), deckId = DRAFT.deckId;
    sel.forEach((c, i) => {
      const base = { deckId, created: t0 + i, hint: (c.hint || '').trim(), extra: '' };
      if (c.type === 'cloze') addNote({ ...base, type: 'cloze', text: c.text.trim() });
      else addNote({ ...base, type: 'basic', front: c.front.trim(), back: c.back.trim(), reverse: false });
    });
    S.settings.lastDeck = deckId; save(); emit('aiCards', sel.length); emit('cardsAdded', sel.length);
    SCAN = { files: [], cards: null, busy: '' };
    toast(`Dodano ${sel.length} ${plural(sel.length, 'fiszkę', 'fiszki', 'fiszek')} ✓`); go(`#/deck/${deckId}`);
  },
});

function aiSectionHTML() {
  const st = S.settings, prov = aiProv() || 'gemini';
  return `<div class="card"><h2 style="margin-top:0">✨ AI – fiszki ze zdjęć, PDF i notatek</h2>
    <div class="seg ai-prov" style="display:flex">${[['gemini', '🆓 Gemini (darmowe)'], ['claude', '💳 Claude (płatne)']].map(([k, l]) => `<button class="grow${(st.aiProv || 'gemini') === k ? ' on' : ''}" data-act="ai-prov" data-k="${k}">${l}</button>`).join('')}</div>
    ${(st.aiProv || 'gemini') === 'gemini' ? `
    <ol class="steps small"><li>Wejdź na <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> i zaloguj się kontem Google.</li>
      <li>Kliknij <b>„Create API key”</b> – za darmo, bez karty.</li><li>Skopiuj klucz i wklej go poniżej.</li></ol>
    <label class="field"><span>Klucz Gemini</span><input id="gemini-key" type="password" value="${esc(st.geminiKey || '')}" placeholder="AIza…" autocomplete="off"></label>
    <p class="small muted">Darmowy limit wystarcza na codzienną naukę jednej osoby. W darmowej wersji Google może używać przesłanych treści do ulepszania swoich modeli – nie wysyłaj danych prywatnych.</p>`
    : `<ol class="steps small"><li>Załóż konto na <a href="https://console.anthropic.com" target="_blank" rel="noopener">console.anthropic.com</a> i doładuj kilka dolarów (płacisz tylko za użycie).</li>
      <li>W „API Keys” utwórz klucz i wklej go poniżej.</li></ol>
    <label class="field"><span>Klucz API</span><input id="ai-key" type="password" value="${esc(st.aiKey)}" placeholder="sk-ant-…" autocomplete="off"></label>
    <label class="field"><span>Model</span><select id="ai-model">${AI_MODELS.map(([v, l]) => `<option value="${v}" ${st.aiModel === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`}
    <p class="small muted" style="margin-bottom:0">${aiReady() ? `✅ AI gotowe: <b>${prov === 'gemini' ? 'Gemini' : 'Claude'}</b>. ` : ''}Klucz zostaje tylko na tym urządzeniu (nie jest synchronizowany).</p></div>`;
}
function mountAiSettings() {
  $('#gemini-key')?.addEventListener('change', e => { S.settings.geminiKey = e.target.value.trim(); save(); render(); });
  $('#ai-key')?.addEventListener('change', e => { S.settings.aiKey = e.target.value.trim(); save(); });
  $('#ai-model')?.addEventListener('change', e => { S.settings.aiModel = e.target.value; save(); });
}

Object.assign(ACTIONS, { 'ai-prov': el => { S.settings.aiProv = el.dataset.k; save(); render(); } });

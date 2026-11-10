'use strict';
/* ✏️ Rysowanie fiszek (admin + testerzy z panelu admina): widzisz pytanie, rysujesz odpowiedź z pamięci,
   a potem porównujesz swój rysunek z obrazkiem z fiszki (obok siebie + przybliżona ocena podobieństwa kształtu).
   Biorą udział: zwykłe fiszki z obrazkiem na odpowiedzi (nowe pole w edytorze „Obrazek-odpowiedź”),
   fiszki odwrotne z obrazkiem na przodzie oraz obrazy z lukami (rysujesz cały obraz).
   Ocena własna: ✓ / ~ / ✗ – nietrafione wracają raz na koniec. To trening: nie zmienia terminów powtórek. */
const rysOn = () => typeof testOn === 'function' ? testOn('rys') : typeof IS_ADMIN !== 'undefined' && IS_ADMIN === true;
let RYS = null;

// elementy do rysowania: { key, q (HTML pytania), img (id obrazka-odpowiedzi), label }
function rysItems(deckId) {
  const out = [], seenOccl = new Set();
  for (const c of S.cards) {
    if (c.sus || (deckId !== 'all' && c.deckId !== deckId)) continue;
    const n = noteById(c.noteId); if (!n) continue;
    if (n.type === 'basic') {
      const fwd = c.ord !== 'r', img = fwd ? n.backImageId : n.imageId, txt = fwd ? n.front : n.back;
      if (!img || !IMG[img] || !(txt || '').trim()) continue;
      out.push({ key: c.id, q: `<div class="ctext">${fmt(txt)}</div>`, img, label: txt.trim(), ans: (fwd ? n.back : n.front) || '' });
    } else if (n.type === 'occl' && n.imageId && IMG[n.imageId] && !seenOccl.has(n.id)) {
      seenOccl.add(n.id);
      out.push({ key: 'o' + n.id, q: `<div class="ctext">${fmt(n.title || 'Narysuj cały obraz')}</div><div class="small muted">Zaznacz najważniejsze części: ${esc(n.boxes.map(b => b.label).filter(Boolean).slice(0, 8).join(', '))}</div>`, img: n.imageId, label: n.title || 'Obraz z lukami', ans: '' });
    }
  }
  return out;
}

// ---------- porównanie kształtu (przybliżone): maska „tuszu” obu obrazków → przycięcie do ramki → 32×32 → dopasowanie z tolerancją
const RYS_N = 32;
function rysLoad(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }
function rysMask(im) {
  const W = 96, H = 96, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  const k = Math.min(W / im.width, H / im.height), w = im.width * k, h = im.height * k; ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
  const d = ctx.getImageData(0, 0, W, H).data, L = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) L[i] = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2];
  // tusz = ciemne piksele albo wyraźne krawędzie (zdjęcia i kolorowe rysunki)
  const m = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, gx = L[i + 1] - L[i - 1], gy = L[i + W] - L[i - W];
    if (L[i] < 170 || Math.hypot(gx, gy) > 60) m[i] = 1;
  }
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y * W + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const out = new Uint8Array(RYS_N * RYS_N); if (x1 < 0) return out;
  const s = Math.max(x1 - x0 + 1, y1 - y0 + 1), ox = x0 - (s - (x1 - x0 + 1)) / 2, oy = y0 - (s - (y1 - y0 + 1)) / 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y * W + x]) {
    const u = Math.floor((x - ox) / s * RYS_N), v = Math.floor((y - oy) / s * RYS_N);
    if (u >= 0 && u < RYS_N && v >= 0 && v < RYS_N) out[v * RYS_N + u] = 1;
  }
  return out;
}
function rysDilate(m, r) {
  const o = new Uint8Array(m.length);
  for (let y = 0; y < RYS_N; y++) for (let x = 0; x < RYS_N; x++) if (m[y * RYS_N + x])
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const u = x + dx, v = y + dy; if (u >= 0 && u < RYS_N && v >= 0 && v < RYS_N) o[v * RYS_N + u] = 1; }
  return o;
}
async function rysCompare(drawUrl, refUrl) {
  const [a, b] = await Promise.all([rysLoad(drawUrl), rysLoad(refUrl)]).then(([x, y]) => [rysMask(x), rysMask(y)]);
  const na = a.reduce((s, v) => s + v, 0), nb = b.reduce((s, v) => s + v, 0); if (!na || !nb) return 0;
  const da = rysDilate(a, 2), db = rysDilate(b, 2);
  let pa = 0, pb = 0; for (let i = 0; i < a.length; i++) { if (a[i] && db[i]) pa++; if (b[i] && da[i]) pb++; }
  const prec = pa / na, rec = pb / nb, f = prec + rec ? 2 * prec * rec / (prec + rec) : 0;
  return Math.round(Math.min(1, f * 1.15) * 100);
}

// ---------- przebieg
function rysStart(deckId) {
  const items = shuffle(rysItems(deckId));
  if (!items.length) return toast('Brak fiszek do rysowania – dodaj „Obrazek-odpowiedź” w edytorze fiszki', 4500);
  RYS = { deckId, items: Object.fromEntries(items.map(x => [x.key, x])), queue: items.map(x => x.key), i: 0, retry: new Set(), ok: 0, half: 0, miss: 0, drawing: null, score: null, scores: [], done: false };
  render();
}
async function rysDraw() {
  const K = RYS; if (!K) return;
  const url = await openDrawPad(K.drawing || null, '✏️ Narysuj z pamięci', '✓ Porównaj');
  if (!url || RYS !== K) return;
  K.drawing = url; K.score = '…'; render();
  try { K.score = await rysCompare(url, IMG[K.items[K.queue[K.i]].img]); } catch { K.score = null; }
  if (RYS === K) render();
}
function rysHTML(deckId) {
  const K = RYS, d = deckId !== 'all' && deckById(deckId), back = `<button class="iconbtn" data-act="rys-quit" data-id="${deckId}" aria-label="Zakończ">✕</button>`;
  if (!K || K.deckId !== deckId) {
    const n = rysItems(deckId).length;
    return `<div class="row nowrap"><button class="iconbtn" data-go="${d ? '#/deck/' + d.id : '#/'}">‹</button><h1 class="grow" style="margin:0">✏️ Rysowanie fiszek</h1><span class="tag">${IS_ADMIN ? 'admin' : 'test'}</span></div>
    <div class="card"><p style="margin-top:0">Widzisz pytanie, <b>rysujesz odpowiedź z pamięci</b>, a potem porównujesz rysunek z obrazkiem z fiszki.</p>
      <p class="small muted">${d ? `Talia „${esc(d.name)}”` : 'Wszystkie talie'}: <b>${n}</b> ${plural(n, 'fiszka', 'fiszki', 'fiszek')} do rysowania.</p>
      <ul class="small muted"><li>Fiszki z <b>obrazkiem-odpowiedzią</b> (w edytorze fiszki: „🎨 Obrazek-odpowiedź”) – np. „Narysuj budowę serca”.</li><li>Fiszki odwrotne z obrazkiem na przodzie i obrazy z lukami (rysujesz cały obraz).</li><li>Ocena podobieństwa jest przybliżona – liczy się Twoja własna ocena. To trening: terminy powtórek się nie zmieniają.</li></ul>
      <button class="primary block" data-act="rys-start" data-id="${deckId}" ${n ? '' : 'disabled'} style="min-height:52px">▶ Zaczynamy</button></div>`;
  }
  if (K.done) {
    const avg = K.scores.length ? Math.round(K.scores.reduce((a, b) => a + b, 0) / K.scores.length) : null, total = K.ok + K.half + K.miss;
    return `<div class="card center"><div style="font-size:48px">🎨</div><h2>Koniec rysowania</h2>
      <p>✓ ${K.ok} · ~ ${K.half} · ✗ ${K.miss} <span class="muted">(z ${total})</span></p>${avg != null ? `<p class="small muted">Średnie podobieństwo kształtu: ${avg}%</p>` : ''}
      <div class="row"><button class="primary grow" data-act="rys-start" data-id="${deckId}">▶ Jeszcze raz</button><button class="grow" data-act="rys-quit" data-id="${deckId}">Wyjdź</button></div></div>`;
  }
  const it = K.items[K.queue[K.i]], total = K.queue.length, sc = K.score;
  const verdict = typeof sc === 'number' ? (sc >= 70 ? 'bardzo podobne' : sc >= 45 ? 'w miarę podobne' : sc >= 25 ? 'trochę podobne' : 'mało podobne') : '';
  return `<div class="studybar">${back}<div class="title">✏️ Rysowanie</div><small class="muted">${Math.min(K.i + 1, total)}/${total}</small></div>
    ${progress(K.i / total)}
    <p class="small muted center" style="margin:10px 0 6px">Narysuj z pamięci:</p>
    <div class="card flash qfit">${it.q}</div>
    ${K.drawing || K.peek ? `<div class="rys-cmp"><figure>${K.drawing ? `<img src="${K.drawing}" alt="Twój rysunek">` : '<div class="rys-empty">🙈</div>'}<figcaption>Twój rysunek</figcaption></figure><figure><img src="${IMG[it.img]}" alt="Obrazek z fiszki"><figcaption>Z fiszki${it.ans ? ': ' + esc(stripHtml(it.ans).slice(0, 40)) : ''}</figcaption></figure></div>
      <div class="rys-score">${sc === '…' ? 'Porównuję…' : !K.drawing ? '<span class="muted">Bez rysunku – zapamiętaj obrazek i spróbuj następnym razem</span>' : typeof sc === 'number' ? `<b>${sc}%</b> podobieństwa kształtu <span class="muted">· ${verdict} (ocena przybliżona)</span>` : '<span class="muted">Nie udało się porównać – oceń sam</span>'}</div>
      <p class="small muted center" style="margin:8px 0 4px">Jak Ci poszło?</p>
      <div class="row nowrap"><button class="grow skoj-no" data-act="rys-ans" data-v="0">✗ Nie</button><button class="grow" data-act="rys-ans" data-v="1">~ Częściowo</button><button class="primary grow" data-act="rys-ans" data-v="2">✓ Dobrze</button></div>
      <button class="ghost block" data-act="rys-draw" style="margin-top:6px">✏️ Popraw rysunek</button>`
    : `<button class="primary block" data-act="rys-draw" style="margin-top:12px;min-height:52px">✏️ Rysuj</button><button class="ghost block" data-act="rys-peek" style="margin-top:6px">🙈 Nie wiem – pokaż obrazek</button>`}`;
}
ROUTES.rys = parts => { const deckId = parts?.[1] || 'all';
  if (!rysOn()) return { tab: 'home', html: '<p class="muted center" style="padding:40px 0">Ten tryb jest jeszcze w testach.</p>' };
  return { tab: 'home', focus: !!RYS, html: rysHTML(deckId) };
};

// 🎨 edytor fiszki: obrazek-odpowiedź (narysuj albo z pliku) – tylko gdy tryb jest włączony dla tego konta
function rysBackImgHTML(D) {
  if (!rysOn()) return '';
  const src = D.backImageId && IMG[D.backImageId];
  return `<div class="field rys-back"><span>🎨 Obrazek-odpowiedź <span class="tag">${IS_ADMIN ? 'admin' : 'test'}</span> <small class="muted">– do rysowania z pamięci</small></span>
    ${src ? `<img src="${src}" alt="" style="max-height:110px;border-radius:8px;display:block;margin:4px 0">` : ''}
    <div class="row nowrap"><button type="button" class="sm" data-act="rys-bimg-draw">✏️ ${src ? 'Popraw' : 'Narysuj'}</button><button type="button" class="sm" data-act="rys-bimg-file">🖼️ Z pliku</button>${src ? '<button type="button" class="sm ghost" data-act="rys-bimg-del">🗑️</button>' : ''}</div></div>`;
}

// wejścia: strona talii i strona główna
const rysDeck0 = viewDeck;
viewDeck = function (id, q) { const html = rysDeck0(id, q); if (!rysOn()) return html; const n = rysItems(id).length;
  return html + `<div class="card row nowrap rys-cta" data-go="#/rys/${id}"><span style="font-size:26px">✏️</span><div class="grow"><b>Rysowanie fiszek <span class="tag">${IS_ADMIN ? 'admin' : 'test'}</span></b><div class="small muted">${n ? `${n} ${plural(n, 'fiszka', 'fiszki', 'fiszek')} do rysowania` : 'Dodaj fiszce „Obrazek-odpowiedź” w edytorze'}</div></div><span>›</span></div>`; };
const rysHome0 = homeExtrasHTML;
homeExtrasHTML = function () { const base = rysHome0(); if (!rysOn()) return base; const n = rysItems('all').length;
  return base + `<div class="card row nowrap rys-cta" data-go="#/rys/all"><span style="font-size:26px">✏️</span><div class="grow"><b>Rysowanie fiszek <span class="tag">${IS_ADMIN ? 'admin' : 'test'}</span></b><div class="small muted">${n ? `${n} ${plural(n, 'fiszka', 'fiszki', 'fiszek')} do rysowania we wszystkich taliach` : 'Narysuj odpowiedź z pamięci i porównaj z obrazkiem'}</div></div><span>›</span></div>`; };

Object.assign(ACTIONS, {
  'rys-start': el => rysStart(el.dataset.id || 'all'),
  'rys-draw': () => rysDraw(),
  'rys-peek': () => { const K = RYS; if (!K) return; K.score = null; K.peek = true; render(); },
  'rys-ans': el => { const K = RYS; if (!K) return; const key = K.queue[K.i], v = +el.dataset.v;
    if (!K.retry.has(key)) { if (v === 2) K.ok++; else if (v === 1) K.half++; else K.miss++; if (typeof K.score === 'number' && !K.peek) K.scores.push(K.score); }
    if (v < 2 && !K.retry.has(key)) { K.retry.add(key); K.queue.push(key); }   // raz jeszcze na koniec
    K.i++; K.drawing = null; K.score = null; K.peek = false; if (K.i >= K.queue.length) K.done = true; render(); },
  'rys-quit': el => { const id = el.dataset.id; RYS = null; go(id && id !== 'all' ? '#/deck/' + id : '#/'); },
  'rys-bimg-draw': async () => { const D = DRAFT; if (!D) return; const url = await openDrawPad(D.backImageId ? IMG[D.backImageId] : null, '🎨 Obrazek-odpowiedź', '✓ Zapisz'); if (!url || DRAFT !== D) return; D.backImageId = await putImage(url); render(); },
  'rys-bimg-file': async () => { const D = DRAFT; if (!D) return; const id = await getImage('file'); if (id && DRAFT === D) { D.backImageId = id; render(); } },
  'rys-bimg-del': () => { if (DRAFT) { DRAFT.backImageId = null; render(); } },
});

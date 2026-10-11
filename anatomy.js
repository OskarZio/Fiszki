'use strict';
/* Atlas – tryb nauki anatomii (i każdych innych rycin): dodajesz własne zdjęcie, zaznaczasz struktury pinezkami
   i wpisujesz ich nazwy. Potem trzy tryby:
   – Przegląd: stukasz w pinezki i odkrywasz nazwy,
   – Nazywanie: podświetla się struktura, wpisujesz (albo mówisz) jej nazwę,
   – Wskazywanie: widzisz nazwę, stukasz w obrazie, gdzie to jest.
   Z atlasu można też zrobić fiszki (z powtórkami). */

const atlasById = id => (S.atlases || []).find(a => a.id === id);
let AT = null;   // stan bieżącej sesji atlasu

ROUTES.atlas = parts => {
  if (!parts[1]) return atlasList();
  const a = atlasById(parts[1]);
  if (!a) return { html: '<p>Nie ma takiego atlasu. <a href="#/atlas">Wróć</a></p>', tab: 'topics' };
  if (!AT || AT.id !== a.id) AT = { id: a.id, mode: a.marks.length ? 'review' : 'edit', shown: new Set(), sel: null };
  const modes = [['review', '👁️ Przegląd'], ['name', '✍️ Nazwij'], ['point', '👆 Wskaż'], ['draw', '🎨 Rysuj'], ['edit', '✏️ Edycja']];
  const head = `<div class="row nowrap"><button class="iconbtn" data-act="atlas-back">‹</button><h1 class="grow" style="font-size:21px">🫀 ${esc(a.name)}</h1>
      <button class="iconbtn" data-act="atlas-rename" data-id="${a.id}">✏️</button><button class="iconbtn" data-act="atlas-del" data-id="${a.id}" title="Usuń rycinę">🗑️</button></div>
    <div class="atmodes">${modes.map(([m, l]) => { const [ic, ...t] = l.split(' '); return `<button class="${AT.mode === m ? 'on' : ''}" data-act="atlas-mode" data-m="${m}" ${!['edit', 'draw'].includes(m) && !a.marks.length ? 'disabled' : ''}><span>${ic}</span><small>${t.join(' ')}</small></button>`; }).join('')}</div>`;
  let body = '';
  if (AT.mode === 'edit') { onMount(() => mountAtlasEditor(a)); body = atlasEdit(a); }
  else if (AT.mode === 'review') body = atlasReview(a);
  else if (AT.mode === 'draw') body = atlasDraw(a);
  else body = atlasQuiz(a);
  return { tab: 'topics', focus: ['name', 'point', 'draw'].includes(AT.mode), html: head + body };
};

function atlasList() {
  const list = (S.atlases || []).map(a => `<div class="note"><span data-go="#/atlas/${a.id}">${IMG[a.imageId] ? `<img src="${IMG[a.imageId]}" alt="">` : '<span style="font-size:30px">🫀</span>'}</span>
    <div class="t" data-go="#/atlas/${a.id}"><div><b>${esc(a.name)}</b></div><div class="small muted">${a.marks.length} ${plural(a.marks.length, 'struktura', 'struktury', 'struktur')}${a.best != null ? ` · najlepszy wynik ${a.best}%` : ''}</div></div>
    <button class="iconbtn" data-act="atlas-del" data-id="${a.id}" title="Usuń rycinę" aria-label="Usuń rycinę">🗑️</button></div>`).join('');
  return { tab: 'topics', html: `<div class="row nowrap"><button class="iconbtn" data-go="#/topics">‹</button><h1 class="grow">🫀 Atlas</h1></div>
    <div class="card small muted" style="margin-top:0">Dodaj własną rycinę (np. ze skryptu, atlasu albo zdjęcie preparatu), zaznacz struktury i ucz się je nazywać i wskazywać.</div>
    <div class="card">${list || '<p class="muted">Nie masz jeszcze żadnej ryciny.</p>'}
      <div class="spacer"></div><div class="row"><button class="primary grow" data-act="atlas-new" data-src="file">🖼️ Dodaj zdjęcie</button><button class="grow" data-act="atlas-new" data-src="paste">📋 Wklej</button></div></div>` };
}

// ---------- Edycja: pinezki z nazwami
function atlasEdit(a) {
  return `<p class="small muted">Stuknij w obraz, aby zaznaczyć strukturę. Przeciągnij pinezkę, aby ją przesunąć.</p>
    <div class="editor-wrap"><div class="occl stage" id="stage"><img src="${IMG[a.imageId] || ''}" alt=""><div id="stage-boxes"></div></div></div>
    <div id="marklist"></div>
    <div class="spacer"></div>
    <div class="row"><button class="grow" data-act="atlas-cards" data-id="${a.id}" ${a.marks.length ? '' : 'disabled'}>🃏 Zrób fiszki z powtórkami</button>
      <button class="danger" data-act="atlas-del" data-id="${a.id}">Usuń atlas</button></div>`;
}
function mountAtlasEditor(a) {
  const stage = $('#stage'); if (!stage) return;
  const commit = () => { touch(a); save(); $$('[data-act=atlas-mode]').forEach(b => { if (!['edit', 'draw'].includes(b.dataset.m)) b.disabled = !a.marks.length; }); };
  const draw = () => { $('#stage-boxes').innerHTML = a.marks.map((m, i) => `<div class="pin${AT.sel === m.id ? ' sel' : ''}" data-id="${m.id}" style="left:${m.x * 100}%;top:${m.y * 100}%">${i + 1}</div>`).join(''); };
  const list = () => {
    $('#marklist').innerHTML = a.marks.length ? `<h3>Struktury (${a.marks.length})</h3>` + a.marks.map((m, i) => `
      <div class="boxrow${AT.sel === m.id ? ' sel' : ''}"><span class="num">${i + 1}</span>
        <input data-mark="${m.id}" data-f="name" value="${esc(m.name)}" placeholder="Nazwa (np. m. biceps brachii)">
        <input data-mark="${m.id}" data-f="hint" value="${esc(m.hint || '')}" placeholder="💡 Skojarzenie">
        <button class="danger sm" data-act="atlas-mark-del" data-id="${m.id}">✕</button></div>`).join('')
      : '<p class="muted small center">Brak struktur – stuknij w obraz.</p>';
    $$('[data-mark]').forEach(inp => inp.addEventListener('input', () => { const m = a.marks.find(x => x.id === inp.dataset.mark); if (m) { m[inp.dataset.f] = inp.value; commit(); } }));
  };
  const rel = e => { const r = stage.getBoundingClientRect(); return { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) }; };
  let drag = null;
  stage.addEventListener('pointerdown', e => {
    e.preventDefault();
    const hit = e.target.closest('.pin');
    if (hit) { drag = { m: a.marks.find(x => x.id === hit.dataset.id), moved: false }; AT.sel = drag.m.id; stage.setPointerCapture(e.pointerId); draw(); list(); }
    else { const p = rel(e), m = { id: uid(), x: p.x, y: p.y, name: '', hint: '' }; a.marks.push(m); AT.sel = m.id; commit(); draw(); list();
      setTimeout(() => $(`[data-mark="${m.id}"][data-f="name"]`)?.focus(), 30); }
  });
  stage.addEventListener('pointermove', e => { if (!drag) return; const p = rel(e); drag.m.x = p.x; drag.m.y = p.y; drag.moved = true; draw(); });
  const end = () => { if (drag?.moved) commit(); drag = null; };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
  draw(); list();
}

// ---------- Przegląd
function atlasReview(a) {
  const all = AT.shown.size === a.marks.length;
  return `<p class="small muted">Stuknij pinezkę, żeby zobaczyć nazwę.</p>
    <div class="atlas-view"><div class="occl"><img src="${IMG[a.imageId] || ''}" alt="">
      ${a.marks.map((m, i) => `<div class="pin${AT.shown.has(m.id) ? ' rev' : ''}" data-act="atlas-reveal" data-id="${m.id}" style="left:${m.x * 100}%;top:${m.y * 100}%">${i + 1}</div>
        ${AT.shown.has(m.id) ? `<div class="pinlabel" style="left:${m.x * 100}%;top:${m.y * 100}%">${esc(m.name || '?')}</div>` : ''}`).join('')}</div></div>
    <div class="row"><button class="grow" data-act="atlas-all">${all ? '🙈 Ukryj wszystkie' : '👁️ Pokaż wszystkie'}</button></div>
    <div class="card tight">${a.marks.map((m, i) => `<div class="kv"><span>${i + 1}.</span><span class="grow" style="margin-left:8px">${AT.shown.has(m.id) ? esc(m.name) : '<span class="muted">• • •</span>'}</span></div>`).join('')}</div>`;
}

// ---------- Quiz: nazywanie i wskazywanie
function startAtlasQuiz(a, mode) {
  AT.mode = mode; AT.q = shuffle(a.marks.filter(m => m.name.trim()).map(m => m.id)); AT.i = 0; AT.res = []; AT.ans = null; AT.tap = null; AT.t0 = Date.now();
}
function atlasQuiz(a) {
  if (!AT.q) startAtlasQuiz(a, AT.mode);
  if (!AT.q.length) return '<p class="muted">Nadaj strukturom nazwy w trybie Edycja.</p>';
  if (AT.i >= AT.q.length) {
    const ok = AT.res.filter(r => r.ok).length, pct = Math.round(ok / AT.q.length * 100);
    if (!AT.saved) { AT.saved = true; if (pct > (a.best ?? -1)) { a.best = pct; touch(a); } S.stats.atlasRuns = (S.stats.atlasRuns || 0) + 1; save(); }
    return `<div class="card center"><div class="score">${pct}%</div><p>${ok} / ${AT.q.length} poprawnie · ${fmtTime(Date.now() - AT.t0)}</p></div>
      <div class="card">${AT.res.map(r => { const m = a.marks.find(x => x.id === r.id); return `<div class="kv"><span>${r.ok ? '✅' : '❌'} ${esc(m?.name || '')}</span>${r.ok ? '' : `<small class="muted">${esc(r.given || '–')}</small>`}</div>`; }).join('')}</div>
      <div class="row"><button class="primary grow" data-act="atlas-again">🔁 Jeszcze raz</button>${AT.res.some(r => !r.ok) ? '<button class="grow" data-act="atlas-wrong">Powtórz błędne</button>' : ''}</div>`;
  }
  const m = a.marks.find(x => x.id === AT.q[AT.i]), idx = a.marks.indexOf(m);
  const prog = `<div class="row small muted"><span class="grow">${AT.i + 1} / ${AT.q.length}</span><span>✅ ${AT.res.filter(r => r.ok).length}</span></div>${progress(AT.i / AT.q.length, true)}`;
  if (AT.mode === 'name') {
    const answered = AT.ans != null;
    if (!answered) onMount(() => { const inp = $('#at-in'); inp.focus({ preventScroll: true }); inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ACTIONS['atlas-check'](); } }); });
    return prog + `<div class="atlas-view"><div class="occl"><img src="${IMG[a.imageId] || ''}" alt="">
        ${a.marks.map((x, i) => `<div class="pin ${x.id === m.id ? (answered ? 'rev' : 'target') : 'dim'}" style="left:${x.x * 100}%;top:${x.y * 100}%">${x.id === m.id && !answered ? '?' : i + 1}</div>`).join('')}</div></div>
      ${answered ? `<div class="card center"><div class="ansline">${esc(m.name)}</div>${AT.ans.ok ? '✅ Dobrze' : `❌ Twoja odpowiedź: <b>${esc(AT.ans.given || '–')}</b>`}
          ${!AT.ans.ok ? '<br><button class="ghost sm" data-act="atlas-override">To była dobra odpowiedź</button>' : ''}</div>
          <button class="primary block" data-act="atlas-next">Dalej ›</button>`
        : `${m.hint && AT.hint ? `<div class="hintbox">💡 ${esc(m.hint)}</div>` : ''}
          <div class="row nowrap"><input id="at-in" class="grow" placeholder="Nazwa struktury ${idx + 1}…" autocomplete="off" autocapitalize="off" spellcheck="false">
          ${window.SpeechRecognition || window.webkitSpeechRecognition ? '<button data-act="atlas-mic">🎤</button>' : ''}</div>
          <div class="spacer"></div><div class="row nowrap">${m.hint && !AT.hint ? '<button data-act="atlas-hint">💡</button>' : ''}<button class="grow" data-act="atlas-skip">Nie wiem</button><button class="primary grow" data-act="atlas-check">Sprawdź</button></div>`}`;
  }
  // wskazywanie
  const answered = AT.tap != null;
  onMount(() => {
    if (answered) return;
    const box = $('#at-stage');
    box.addEventListener('pointerdown', e => {
      const r = box.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      // trafienie = najbliższa pinezka to szukana struktura i jest blisko (≤ 8% szerokości)
      const dist = p => Math.hypot((p.x - x) * r.width, (p.y - y) * r.height) / r.width;
      const nearest = a.marks.reduce((b, p) => dist(p) < dist(b) ? p : b, a.marks[0]);
      const ok = nearest.id === m.id && dist(m) < 0.08;
      AT.tap = { x, y, ok }; AT.res.push({ id: m.id, ok, given: ok ? '' : (nearest.name || '?') }); render();
    });
  });
  return prog + `<div class="card center" style="margin-bottom:8px">Wskaż: <b style="font-size:20px">${esc(m.name)}</b></div>
    <div class="atlas-view"><div class="occl" id="at-stage" style="touch-action:none"><img src="${IMG[a.imageId] || ''}" alt="">
      ${answered ? `<div class="pin ${AT.tap.ok ? 'rev' : 'target'}" style="left:${m.x * 100}%;top:${m.y * 100}%">${idx + 1}</div>
        <div class="tapmark ${AT.tap.ok ? 'ok' : 'bad'}" style="left:${AT.tap.x * 100}%;top:${AT.tap.y * 100}%"></div>` : ''}</div></div>
    ${answered ? `<div class="center">${AT.tap.ok ? '✅ Dokładnie tu!' : '❌ Tutaj jest (czerwona pinezka)'}</div><div class="spacer"></div><button class="primary block" data-act="atlas-next">Dalej ›</button>` : '<p class="small muted center">Stuknij w obraz w miejscu tej struktury.</p>'}`;
}

Object.assign(ACTIONS, {
  'atlas-new': async el => {
    const id = await getImage(el.dataset.src); if (!id) return;
    const name = prompt('Nazwa ryciny (np. „Mięśnie kończyny górnej – przód”):', 'Rycina ' + ((S.atlases || []).length + 1)) || 'Rycina';
    const a = touch({ id: uid(), name: name.trim(), imageId: id, marks: [], created: Date.now() });
    S.atlases.push(a); save(); AT = null; go('#/atlas/' + a.id);
  },
  'atlas-back': () => { AT = null; go('#/atlas'); },
  'atlas-rename': el => { const a = atlasById(el.dataset.id); const n = prompt('Nazwa:', a.name); if (n?.trim()) { a.name = n.trim(); touch(a); save(); render(); } },
  'atlas-del': el => {
    const a = atlasById(el.dataset.id); if (!a || !confirm(`Usunąć rycinę „${a.name}”? Trafi do kosza (przywrócisz ją w Więcej → Bezpieczeństwo danych).`)) return;
    emit('deleting', 'atlas', { atlas: a });
    S.atlases = S.atlases.filter(x => x !== a); S.tomb[a.id] = Date.now(); save(); AT = null; toast('Rycina usunięta – jest w koszu'); go('#/atlas'); render();
  },
  'atlas-mode': el => { const a = atlasById(AT.id); AT.q = null; AT.saved = false; AT.mode = el.dataset.m; if (AT.mode === 'name' || AT.mode === 'point') startAtlasQuiz(a, AT.mode); render(); },
  'atlas-mark-del': el => { const a = atlasById(AT.id); a.marks = a.marks.filter(m => m.id !== el.dataset.id); touch(a); save(); render(); },
  'atlas-reveal': el => { AT.shown.has(el.dataset.id) ? AT.shown.delete(el.dataset.id) : AT.shown.add(el.dataset.id); render(); },
  'atlas-all': () => { const a = atlasById(AT.id); AT.shown = AT.shown.size === a.marks.length ? new Set() : new Set(a.marks.map(m => m.id)); render(); },
  'atlas-check': () => {
    const a = atlasById(AT.id), m = a.marks.find(x => x.id === AT.q[AT.i]), given = $('#at-in')?.value.trim() || '';
    const ok = checkAnswer(given, m.name) !== 'wrong'; AT.ans = { given, ok }; AT.res.push({ id: m.id, ok, given }); render();
  },
  'atlas-skip': () => { const m = AT.q[AT.i]; AT.ans = { given: '', ok: false }; AT.res.push({ id: m, ok: false, given: '' }); render(); },
  'atlas-override': () => { AT.ans.ok = true; AT.res[AT.res.length - 1].ok = true; render(); },
  'atlas-hint': () => { AT.hint = true; render(); },
  'atlas-next': () => { AT.i++; AT.ans = null; AT.tap = null; AT.hint = false; render(); },
  'atlas-again': () => { AT.saved = false; startAtlasQuiz(atlasById(AT.id), AT.mode); render(); },
  'atlas-wrong': () => { const wrong = AT.res.filter(r => !r.ok).map(r => r.id); AT.saved = true; AT.q = shuffle(wrong); AT.i = 0; AT.res = []; AT.ans = null; AT.tap = null; AT.t0 = Date.now(); render(); },
  'atlas-mic': () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
    const r = new SR(); r.lang = 'pl-PL'; r.maxAlternatives = 3;
    r.onresult = e => { const inp = $('#at-in'); if (inp) { inp.value = e.results[0][0].transcript; ACTIONS['atlas-check'](); } };
    r.onerror = e => toast('Mikrofon: ' + e.error); r.start(); toast('🎤 Mów…');
  },
  'atlas-cards': el => {
    const a = atlasById(el.dataset.id), marks = a.marks.filter(m => m.name.trim());
    if (!marks.length) return toast('Najpierw nadaj nazwy strukturom');
    const deck = S.decks.find(d => d.name === a.name) || newDeck(a.name);
    const fields = { type: 'occl', style: 'pin', imageId: a.imageId, hideAll: false, title: a.name, hint: '', extra: '', src: 'atlas-' + a.id,
      boxes: marks.map(m => ({ id: m.id, x: m.x, y: m.y, w: 0, h: 0, label: m.name.trim(), hint: (m.hint || '').trim() })) };
    const ex = S.notes.find(n => n.src === fields.src);
    if (ex) { Object.assign(ex, fields); touch(ex); syncCards(ex); } else addNote({ ...fields, deckId: deck.id });
    save(); toast(`Gotowe: ${marks.length} kart w talii „${ex ? deckById(ex.deckId)?.name : deck.name}”`, 3500);
  },
});

// ============================================================ Rysowanie z pamięci + porównanie z ryciną
const DRAW_COLORS = ['#111827', '#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#9333ea'];
const GRADES = [[1, '😕', 'Słabo'], [2, '🙂', 'Nieźle'], [3, '🤩', 'Bardzo dobrze']];
function atlasDraw(a) {
  const D = AT.draw || (AT.draw = { strokes: [], color: DRAW_COLORS[0], size: 4, erase: false, ghost: false, compare: false, opacity: .5, side: false });
  const hist = (a.draws || []).slice().reverse();
  if (D.compare) {
    return `<p class="small muted">Przesuń suwak, żeby nałożyć rycinę na swój rysunek.${a.marks.length ? ' Pinezki pokazują nazwy struktur.' : ''}</p>
      <div class="seg" style="display:flex;margin-bottom:8px"><button class="grow ${D.side ? '' : 'on'}" data-act="draw-side" data-v="0">Nałożenie</button><button class="grow ${D.side ? 'on' : ''}" data-act="draw-side" data-v="1">Obok siebie</button></div>
      ${D.side ? `<div class="sidebyside"><figure><img src="${D.png}" alt=""><figcaption>Twój rysunek</figcaption></figure><figure><img src="${IMG[a.imageId]}" alt=""><figcaption>Rycina</figcaption></figure></div>`
        : `<div class="cmp"><img src="${D.png}" alt=""><img class="ref" src="${IMG[a.imageId]}" alt="" style="opacity:${D.opacity}">
          ${a.marks.map((m, i) => `<div class="pinlabel small-l" style="left:${m.x * 100}%;top:${m.y * 100}%;opacity:${D.opacity}">${i + 1}. ${esc(m.name)}</div>`).join('')}</div>
          <input type="range" min="0" max="1" step="0.02" value="${D.opacity}" id="cmp-op" aria-label="Przezroczystość ryciny">
          <div class="row small muted"><span class="grow">tylko rysunek</span><span>tylko rycina</span></div>`}
      <h3>Jak Ci poszło?</h3>
      <div class="row nowrap">${GRADES.map(([g, e, l]) => `<button class="grow grade-self" data-act="draw-grade" data-g="${g}"><span>${e}</span><small>${l}</small></button>`).join('')}</div>
      <div class="spacer"></div><button class="block" data-act="draw-back">✏️ Wróć do rysunku</button>`;
  }
  onMount(() => mountDraw(a));
  return `<p class="small muted">Narysuj z pamięci strukturę z tej ryciny, a potem porównaj.</p>
    <div class="drawtools">${DRAW_COLORS.map(c => `<button class="dcol${!D.erase && D.color === c ? ' on' : ''}" style="background:${c}" data-act="draw-color" data-c="${c}"></button>`).join('')}
      <select id="draw-size">${[[2, 'cienki'], [4, 'średni'], [8, 'gruby'], [16, 'marker']].map(([v, l]) => `<option value="${v}" ${D.size === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button class="sm${D.erase ? ' primary' : ''}" data-act="draw-erase">🧽</button><button class="sm" data-act="draw-undo">↶</button><button class="sm" data-act="draw-clear">🗑️</button></div>
    <label class="check small"><input type="checkbox" id="draw-ghost" ${D.ghost ? 'checked' : ''}> Kalka – pokaż słabo rycinę pod spodem (łatwiejszy trening)</label>
    <div class="drawwrap"><img class="ghost${D.ghost ? '' : ' hidden'}" src="${IMG[a.imageId]}" alt=""><canvas id="draw-cv"></canvas></div>
    <button class="primary block" data-act="draw-compare" style="min-height:54px">🔍 Porównaj z ryciną</button>
    ${hist.length ? `<h3>Twoje próby (${hist.length})</h3><div class="gallery">${hist.map(d => `<figure>${IMG[d.imageId] ? `<img src="${IMG[d.imageId]}" alt="">` : ''}<figcaption>${GRADES.find(g => g[0] === d.grade)?.[1] || ''} ${new Date(d.t).toLocaleDateString('pl')}</figcaption></figure>`).join('')}</div>` : ''}`;
}
function mountDraw(a) {
  const D = AT.draw, cv = $('#draw-cv'); if (!cv) return;
  const wrap = cv.parentElement, ctx = cv.getContext('2d'), dpr = devicePixelRatio || 1;
  const im = new Image();
  im.onload = () => {
    const w = wrap.clientWidth, h = Math.round(w * im.naturalHeight / im.naturalWidth);
    cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.width = w * dpr; cv.height = h * dpr; wrap.style.height = h + 'px';
    D.w = w; D.h = h; redraw();
  };
  im.src = IMG[a.imageId];
  function redraw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, D.w, D.h);
    for (const s of D.strokes) {
      ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
      ctx.strokeStyle = s.color; ctx.lineWidth = s.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); s.pts.forEach(([x, y], i) => i ? ctx.lineTo(x * D.w, y * D.h) : ctx.moveTo(x * D.w, y * D.h));
      if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] * D.w + .1, s.pts[0][1] * D.h);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  D.redraw = redraw;
  let cur = null;
  const pos = e => { const r = cv.getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)]; };
  cv.addEventListener('pointerdown', e => { e.preventDefault(); cv.setPointerCapture(e.pointerId); cur = { color: D.color, size: D.erase ? D.size * 3 : D.size, erase: D.erase, pts: [pos(e)] }; D.strokes.push(cur); redraw(); });
  cv.addEventListener('pointermove', e => { if (!cur) return; cur.pts.push(pos(e)); redraw(); });
  const end = () => { cur = null; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  $('#draw-size').addEventListener('change', e => { D.size = +e.target.value; });
  $('#draw-ghost').addEventListener('change', e => { D.ghost = e.target.checked; $('.drawwrap .ghost').classList.toggle('hidden', !D.ghost); });
}
document.addEventListener('input', e => {
  if (e.target.id !== 'cmp-op' || !AT?.draw) return;
  AT.draw.opacity = +e.target.value;
  $$('.cmp .ref, .cmp .pinlabel').forEach(el => { el.style.opacity = AT.draw.opacity; });
});
function drawingPng() {
  // rysunek na białym tle (do porównania i zapisania)
  const D = AT.draw, src = $('#draw-cv'); const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(src, 0, 0);
  return c.toDataURL('image/jpeg', .85);
}
Object.assign(ACTIONS, {
  'draw-color': el => { AT.draw.color = el.dataset.c; AT.draw.erase = false; $$('.dcol').forEach(b => b.classList.toggle('on', b.dataset.c === el.dataset.c)); $('[data-act=draw-erase]')?.classList.remove('primary'); },
  'draw-erase': el => { AT.draw.erase = !AT.draw.erase; el.classList.toggle('primary', AT.draw.erase); },
  'draw-undo': () => { AT.draw.strokes.pop(); AT.draw.redraw?.(); },
  'draw-clear': () => { if (AT.draw.strokes.length && confirm('Wyczyścić rysunek?')) { AT.draw.strokes = []; AT.draw.redraw?.(); } },
  'draw-compare': () => { if (!AT.draw.strokes.length) return toast('Najpierw coś narysuj ✏️'); AT.draw.png = drawingPng(); AT.draw.compare = true; render(); scrollTo(0, 0); },
  'draw-back': () => { AT.draw.compare = false; render(); },
  'draw-side': el => { AT.draw.side = el.dataset.v === '1'; render(); },
  'draw-grade': async el => {
    const a = atlasById(AT.id), id = await putImage(AT.draw.png);
    a.draws = [...(a.draws || []), { id: uid(), t: Date.now(), grade: +el.dataset.g, imageId: id }].slice(-12);
    touch(a); S.stats.drawings = (S.stats.drawings || 0) + 1; save();
    AT.draw = null; toast('Zapisano próbę ✓ – narysuj jeszcze raz za jakiś czas'); render();
  },
});

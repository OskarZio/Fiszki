'use strict';
/* Trening pałacu pamięci – ćwiczysz konkretny pałac na kilka sposobów:
   🚶 kolejność stacji · 🎯 wskaż pinezkę na zdjęciu · 💡 skojarzenia (ABCD) · 📍 gdzie to było? · 🧠 spacer z pamięci.
   Stacje mogą być pokazywane jako zdjęcia albo słownie (nazwy). Najlepsze wyniki zapisują się przy pałacu. */

const PT_MODES = {
  order: { icon: '🚶', name: 'Kolejność stacji', desc: 'Stacje są pomieszane – ułóż trasę po kolei.' },
  pin: { icon: '🎯', name: 'Wskaż na zdjęciu', desc: 'Widzisz hasło – stuknij miejsce na zdjęciu, gdzie wbiłeś pinezkę.' },
  assoc: { icon: '💡', name: 'Skojarzenia', desc: 'Skojarzenie → co oznacza (albo odwrotnie). Cztery odpowiedzi do wyboru.' },
  where: { icon: '📍', name: 'Gdzie to było?', desc: 'Widzisz fakt – wskaż stację, na której go umieściłeś.' },
  recall: { icon: '🧠', name: 'Spacer z pamięci', desc: 'Stacja po stacji wpisujesz, co na niej leżało. Najtrudniejsze.' },
};
let PT = null;
const ptStations = p => p.stations.map((s, i) => ({ s, i, label: s.name?.trim() || `Miejsce ${i + 1}` }));
const ptPins = p => { const out = []; p.stations.forEach((s, i) => s.pins.forEach(pin => out.push({ s, i, pin, fact: (pin.fact || '').trim(), assoc: (pin.assoc || '').trim() }))); return out; };
// stacja jako kafelek: zdjęcie albo nazwa (gdy brak nazwy w trybie słownym – zdjęcie, żeby „Miejsce 3” nie zdradzało kolejności)
function ptTile(st, show, extra = '') {
  const named = !!st.s.name?.trim(), img = IMG[st.s.imageId];
  const asName = show === 'name' && named || !img;
  return `<button class="pt-tile${asName ? ' named' : ''}" ${extra}>${asName ? `<b>${esc(named ? st.label : '📷 (bez nazwy)')}</b>` : `<img src="${img}" alt="">`}</button>`;
}
function ptAvailable(p) {
  const pins = ptPins(p), facts = pins.filter(x => x.fact), both = pins.filter(x => x.fact && x.assoc);
  return {
    order: p.stations.length >= 2 ? '' : 'potrzeba min. 2 stacji',
    pin: pins.filter(x => x.fact || x.assoc).length && pins.some(x => IMG[x.s.imageId]) ? '' : 'potrzeba pinezek z opisem',
    assoc: both.length >= 2 ? '' : 'potrzeba min. 2 pinezek ze skojarzeniem i faktem',
    where: facts.length && p.stations.length >= 2 ? '' : 'potrzeba faktów na min. 2 stacjach',
    recall: facts.length ? '' : 'potrzeba pinezek z faktami',
  };
}
function ptStart(pid, mode) {
  const p = palaceById(pid); if (!p) return;
  const o = S.settings.ptrain = S.settings.ptrain || { show: 'photo', shuffle: false };
  const pins = ptPins(p);
  let items;
  if (mode === 'order') items = shuffle(ptStations(p));
  else if (mode === 'pin') items = pins.filter(x => (x.fact || x.assoc) && IMG[x.s.imageId]);
  else if (mode === 'assoc') items = pins.filter(x => x.fact && x.assoc).map(x => ({ ...x, rev: Math.random() < .5 }));
  else if (mode === 'where') items = pins.filter(x => x.fact);
  else items = ptStations(p).filter(st => st.s.pins.some(x => (x.fact || '').trim()));
  if (mode !== 'order' && mode !== 'recall' && o.shuffle) items = shuffle(items);
  PT = { pid, mode, items, i: 0, ok: 0, bad: 0, log: [], show: o.show, phase: 'run', t0: Date.now() };
  if (mode === 'assoc' || mode === 'where') ptMakeOptions();
  go('#/ptrain/' + pid);
}
function ptMakeOptions() {
  const p = palaceById(PT.pid), it = PT.items[PT.i]; if (!it) return;
  if (PT.mode === 'assoc') {
    const key = it.rev ? 'assoc' : 'fact', pool = [...new Set(ptPins(p).map(x => x[key]).filter(v => v && v !== it[key]))];
    PT.opts = shuffle([it[key], ...shuffle(pool).slice(0, 3)]);
  } else {
    const others = shuffle(ptStations(p).filter(st => st.i !== it.i)).slice(0, 3);
    PT.opts = shuffle([ptStations(p)[it.i], ...others]);
  }
  PT.picked = null;
}
function ptAnswer(ok, info) {
  if (ok) PT.ok++; else { PT.bad++; PT.log.push(info); }
  if (typeof tick === 'function') ok ? tick(1320, .08, .08) : tick(220, .15, .1);
}
function ptNext() {
  PT.i++; PT.tap = null; PT.checked = null;
  if (PT.i >= PT.items.length && PT.mode !== 'order') return ptFinish();
  if (PT.mode === 'assoc' || PT.mode === 'where') ptMakeOptions();
  render(); scrollTo(0, 0);
}
function ptFinish() {
  const p = palaceById(PT.pid), total = PT.mode === 'recall' ? PT.items.reduce((a, st) => a + st.s.pins.filter(x => (x.fact || '').trim()).length, 0) : PT.mode === 'order' ? PT.items.length : PT.items.length;
  const pct = PT.mode === 'order' ? Math.round(PT.items.length / (PT.items.length + PT.bad) * 100) : Math.round(PT.ok / Math.max(1, total) * 100);
  PT.phase = 'done'; PT.pct = pct; PT.ms = Date.now() - PT.t0;
  p.best = p.best || {}; PT.record = pct > (p.best[PT.mode] ?? -1); if (PT.record) { p.best[PT.mode] = pct; touch(p); }
  S.stats.palaceTrain = (S.stats.palaceTrain || 0) + 1; save();
  if (pct === 100) confetti(120); else if (pct >= 80) confetti(50);
  render(); scrollTo(0, 0);
}

ROUTES.ptrain = parts => {
  const p = palaceById(parts[1]); if (!p) return { html: '<p><a href="#/palaces">Wróć</a></p>' };
  const head = (title, right = '') => `<div class="studybar"><button class="iconbtn" data-act="pt-exit" data-id="${p.id}">✕</button><div class="title">${title}</div>${right}</div>`;
  // --- wybór trybu
  if (!PT || PT.pid !== p.id || PT.phase === 'setup') {
    const av = ptAvailable(p), o = S.settings.ptrain || { show: 'photo', shuffle: false }, best = p.best || {};
    return { focus: true, html: head(`🏛️ ${esc(p.name)}`) + `
      <p class="small muted">${p.stations.length} ${plural(p.stations.length, 'stacja', 'stacje', 'stacji')} · ${ptPins(p).length} ${plural(ptPins(p).length, 'pinezka', 'pinezki', 'pinezek')}. Wybierz, jak chcesz ćwiczyć:</p>
      <div class="pt-modes">${Object.entries(PT_MODES).map(([k, m]) => `<button class="pt-mode" data-act="pt-start" data-id="${p.id}" data-m="${k}" ${av[k] ? 'disabled' : ''}>
        <span>${m.icon}</span><b>${m.name}</b><small>${av[k] ? '🔒 ' + av[k] : m.desc}</small>${best[k] != null ? `<em>rekord ${best[k]}%</em>` : ''}</button>`).join('')}</div>
      <div class="card tight"><div class="small muted" style="margin-bottom:6px">Stacje pokazuj jako:</div>
        <div class="seg" style="display:flex"><button class="grow ${o.show !== 'name' ? 'on' : ''}" data-act="pt-opt" data-k="show" data-v="photo">🖼️ Zdjęcia</button><button class="grow ${o.show === 'name' ? 'on' : ''}" data-act="pt-opt" data-k="show" data-v="name">🔤 Słownie (nazwy)</button></div>
        <label class="check" style="margin-top:8px"><input type="checkbox" id="pt-shuffle" ${o.shuffle ? 'checked' : ''}> Losowa kolejność pytań (zamiast po trasie)</label></div>` };
  }
  // --- wynik
  if (PT.phase === 'done') {
    const m = PT_MODES[PT.mode];
    return { focus: true, html: head(`${m.icon} ${m.name}`) + `
      <div class="card center"><div class="score">${PT.pct}%</div><p>${PT.record ? '🏆 Nowy rekord!' : `Rekord: ${p.best?.[PT.mode] ?? PT.pct}%`} · czas ${Math.round(PT.ms / 1000)} s</p></div>
      ${PT.log.length ? `<div class="card"><h3 style="margin-top:0">Do poprawki</h3>${PT.log.map(l => `<div class="kv"><span>${l.q}</span><b class="c-rev">${l.a}</b></div>`).join('')}</div>` : '<p class="center">Bezbłędnie 💪</p>'}
      <div class="row"><button class="primary grow" data-act="pt-start" data-id="${p.id}" data-m="${PT.mode}">🔁 Jeszcze raz</button><button class="grow" data-act="pt-setup">Inny tryb</button></div>
      <div class="spacer"></div><button class="block ghost" data-go="#/walk/${p.id}">🚶 Spacer z podglądem</button>` };
  }
  const n = PT.items.length, it = PT.items[PT.i], m = PT_MODES[PT.mode];
  const bar = head(`${m.icon} ${m.name}`, `<span class="small muted">${Math.min(PT.i + 1, n)}/${n}</span>`) + progress(PT.i / n);
  // --- 🚶 kolejność stacji: stukaj po kolei
  if (PT.mode === 'order') {
    const placed = PT.i;
    return { focus: true, html: bar + `<p class="center">Stuknij stację <b>nr ${placed + 1}</b> na trasie${PT.bad ? ` · błędy: ${PT.bad}` : ''}</p>
      <div class="pt-grid">${PT.items.map((st, k) => { const done = st.done; return `<div class="pt-cell${done ? ' done' : ''}${PT.flash === k ? ' wrong' : ''}">${ptTile(st, PT.show, done ? 'disabled' : `data-act="pt-order" data-k="${k}"`)}${done ? `<i>${st.done}</i>` : ''}</div>`; }).join('')}</div>` };
  }
  // --- 🎯 wskaż pinezkę na zdjęciu
  if (PT.mode === 'pin') {
    const q = it.fact || it.assoc, other = it.fact && it.assoc ? it.assoc : '';
    return { focus: true, html: bar + `<div class="card center"><div class="qtitle">${esc(ptStations(palaceById(PT.pid))[it.i].label)}</div>
        <div class="pt-q">Gdzie jest: <b>${fmt(q)}</b>${PT.hint && other ? `<div class="hintbox">💡 ${fmt(other)}</div>` : ''}</div></div>
      <div class="pt-photo" id="pt-photo"><img src="${IMG[it.s.imageId]}" alt="">
        ${PT.tap ? `<span class="pt-mark you" style="left:${PT.tap.x * 100}%;top:${PT.tap.y * 100}%"></span><span class="pt-mark ok" style="left:${it.pin.x * 100}%;top:${it.pin.y * 100}%"></span>` : ''}</div>
      ${PT.tap ? `<p class="center">${PT.tap.ok ? '✅ Trafione!' : '❌ Pudło – zielony punkt to Twoja pinezka'}</p><button class="primary block" data-act="pt-next">Dalej ›</button>`
        : `<p class="small muted center">Stuknij w zdjęcie${other && !PT.hint ? ' · <button class="ghost sm" data-act="pt-hint">💡 podpowiedź</button>' : ''}</p>`}` };
  }
  // --- 💡 skojarzenia / 📍 gdzie to było
  if (PT.mode === 'assoc' || PT.mode === 'where') {
    const correct = PT.mode === 'assoc' ? it[it.rev ? 'assoc' : 'fact'] : null;
    const q = PT.mode === 'assoc' ? (it.rev ? `Jakie było skojarzenie dla: <b>${fmt(it.fact)}</b>?` : `Co oznacza skojarzenie: <b>${fmt(it.assoc)}</b>?`) : `Na której stacji było: <b>${fmt(it.fact)}</b>?`;
    const opts = PT.mode === 'assoc'
      ? `<div class="pt-opts">${PT.opts.map((o, k) => `<button class="${PT.picked != null ? (o === correct ? 'ok' : k === PT.picked ? 'bad' : '') : ''}" data-act="pt-pick" data-k="${k}" ${PT.picked != null ? 'disabled' : ''}>${fmt(o)}</button>`).join('')}</div>`
      : `<div class="pt-grid">${PT.opts.map((st, k) => `<div class="pt-cell${PT.picked != null ? (st.i === it.i ? ' done' : k === PT.picked ? ' wrong' : '') : ''}">${ptTile(st, PT.show, PT.picked != null ? 'disabled' : `data-act="pt-pick" data-k="${k}"`)}</div>`).join('')}</div>`;
    return { focus: true, html: bar + `<div class="card center"><div class="pt-q">${q}</div></div>${opts}
      ${PT.picked != null ? `<p class="center">${PT.lastOk ? '✅ Dobrze!' : '❌ Nie tym razem'}${PT.mode === 'where' && it.assoc ? ` · 💡 ${esc(it.assoc)}` : ''}</p><button class="primary block" data-act="pt-next">Dalej ›</button>` : ''}` };
  }
  // --- 🧠 spacer z pamięci: wpisz, co leżało na stacji
  const facts = it.s.pins.filter(x => (x.fact || '').trim());
  onMount(() => { const t = $('#pt-recall'); if (t && !PT.checked) t.focus({ preventScroll: true }); });
  return { focus: true, html: bar + `<div class="card center">${ptTile(it, PT.show, 'disabled')}<p class="small muted" style="margin-bottom:0">Stacja ${it.i + 1} · ${facts.length} ${plural(facts.length, 'rzecz', 'rzeczy', 'rzeczy')} do przypomnienia</p></div>
    ${PT.checked ? `<div class="card">${PT.checked.map(c => `<div class="kv"><span>${c.ok ? '✅' : '❌'} ${esc(c.fact)}</span><small class="muted">${esc(c.assoc || '')}</small></div>`).join('')}</div><button class="primary block" data-act="pt-next">${PT.i < n - 1 ? 'Następna stacja ›' : 'Wynik'}</button>`
      : `<textarea id="pt-recall" rows="4" placeholder="Każda rzecz w nowej linii…"></textarea><div class="spacer"></div><button class="primary block" data-act="pt-check">Sprawdź</button>`}` };
};

Object.assign(ACTIONS, {
  'pt-start': el => ptStart(el.dataset.id, el.dataset.m),
  'pt-setup': () => { PT.phase = 'setup'; render(); },
  'pt-exit': el => { PT = null; go('#/palace/' + el.dataset.id); },
  'pt-opt': el => { const o = S.settings.ptrain = S.settings.ptrain || {}; o[el.dataset.k] = el.dataset.v; save(); render(); },
  'pt-hint': () => { PT.hint = true; render(); },
  'pt-next': () => { PT.hint = false; ptNext(); },
  'pt-order': el => {
    const k = +el.dataset.k, st = PT.items[k];
    if (st.i === PT.i) { st.done = PT.i + 1; PT.i++; PT.flash = null; if (typeof tick === 'function') tick(1320, .06, .07); if (PT.i >= PT.items.length) return ptFinish(); }
    else { PT.bad++; PT.flash = k; const want = ptStations(palaceById(PT.pid))[PT.i]; if (!PT.log.some(l => l.n === PT.i)) PT.log.push({ n: PT.i, q: `Stacja ${PT.i + 1}`, a: esc(want.label) }); if (typeof tick === 'function') tick(220, .15, .1); }
    render();
  },
  'pt-pick': el => {
    const k = +el.dataset.k, it = PT.items[PT.i]; PT.picked = k;
    if (PT.mode === 'assoc') { const key = it.rev ? 'assoc' : 'fact'; PT.lastOk = PT.opts[k] === it[key]; ptAnswer(PT.lastOk, { q: esc(it.rev ? it.fact : it.assoc), a: esc(it[key]) }); }
    else { PT.lastOk = PT.opts[k].i === it.i; ptAnswer(PT.lastOk, { q: esc(it.fact), a: esc(ptStations(palaceById(PT.pid))[it.i].label) }); }
    render();
  },
  'pt-check': () => {
    const it = PT.items[PT.i], lines = ($('#pt-recall').value || '').split(/\n|,|;/).map(x => x.trim()).filter(Boolean);
    PT.checked = it.s.pins.filter(x => (x.fact || '').trim()).map(x => {
      const words = t => norm(t).split(/\s+/).filter(Boolean).sort().join(' ');   // „skokowa kość” = „kość skokowa”
      const ok = lines.some(l => checkAnswer(l, x.fact, 'normal') !== 'wrong' || checkAnswer(words(l), words(x.fact), 'normal') !== 'wrong');
      ptAnswer(ok, { q: `Stacja ${it.i + 1}`, a: esc(x.fact) }); return { ok, fact: x.fact, assoc: x.assoc };
    });
    render();
  },
});
// 🎯 stuknięcie w zdjęcie – trafienie, gdy blisko pinezki (≈10% krótszego boku)
document.addEventListener('click', e => {
  const box = e.target.closest?.('#pt-photo'); if (!box || !PT || PT.mode !== 'pin' || PT.tap) return;
  const img = box.querySelector('img'), r = img.getBoundingClientRect(), it = PT.items[PT.i];
  const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; if (x < 0 || x > 1 || y < 0 || y > 1) return;
  const d = Math.hypot((x - it.pin.x) * r.width, (y - it.pin.y) * r.height) / Math.min(r.width, r.height);
  PT.tap = { x, y, ok: d < .1 };
  ptAnswer(PT.tap.ok, { q: esc(it.fact || it.assoc), a: `stacja ${it.i + 1}` }); render();
});
document.addEventListener('change', e => { if (e.target.id === 'pt-shuffle') { (S.settings.ptrain = S.settings.ptrain || {}).shuffle = e.target.checked; save(); } });

ACTIONS['pt-open'] = el => { PT = { pid: el.dataset.id, phase: 'setup' }; go('#/ptrain/' + el.dataset.id); };
// Trening: lista pałaców z szybkim wejściem do treningu
const ptTrain0 = ROUTES.train;
ROUTES.train = (...a) => {
  const r = ptTrain0(...a); if (!r?.html || !S.palaces.length) return r;
  const list = S.palaces.map(p => { const best = Object.values(p.best || {}); return `<div class="deck"><div class="name" data-go="#/palace/${p.id}">🏛️ ${esc(p.name)}</div>
    <span class="small muted">${best.length ? `rekord ${Math.max(...best)}%` : `${p.stations.length} st.`}</span><button class="sm primary" data-act="pt-open" data-id="${p.id}">🎯 Trenuj</button></div>`; }).join('');
  return { ...r, html: r.html.replace('<button class="block" data-go="#/palaces">Otwórz pałace</button>', `${list}<div class="spacer"></div><button class="block" data-go="#/palaces">Otwórz pałace</button>`) };
};

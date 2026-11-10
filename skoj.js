'use strict';
/* 💡 Powtórka skojarzeń (tylko konto admina): trening na samych skojarzeniach z fiszek.
   Kierunek „skojarzenie → fiszka”: widzisz tylko skojarzenie i przypominasz sobie pytanie i odpowiedź.
   Kierunek „fiszka → skojarzenie”: widzisz pytanie i przypominasz sobie swoje skojarzenie.
   To trening – nie zmienia terminów powtórek. Nietrafione wracają raz jeszcze na koniec. */
const skojAdmin = () => typeof testOn === 'function' ? testOn('skoj') : typeof IS_ADMIN !== 'undefined' && IS_ADMIN === true;
let SKOJ = null;
const skojHasHint = n => n && n.type !== 'occl' && (String(n.hint || '').trim() || (n.hintImg && IMG[n.hintImg]));
const skojNotes = deckId => S.notes.filter(n => (deckId === 'all' || n.deckId === deckId) && skojHasHint(n) && S.cards.some(c => c.noteId === n.id && !c.sus));
const skojImg = n => n.hintImg && IMG[n.hintImg] ? `<img class="hint-img" src="${IMG[n.hintImg]}" alt="skojarzenie">` : '';
const skojHintHTML = n => `<div class="hintbox skoj-hint"><div class="hb-h"><span>💡 Skojarzenie</span></div>${String(n.hint || '').trim() ? `<div class="hb-t">${fmt(n.hint)}</div>` : ''}${skojImg(n)}</div>`;
const skojCardHTML = n => n.type === 'cloze'
  ? `<div class="ctext">${typeof clozeHTML === 'function' ? clozeHTML(n.text, 'c1', true) : esc(n.text)}</div>`
  : `${n.imageId && IMG[n.imageId] ? `<img class="cimg" src="${IMG[n.imageId]}" alt="">` : ''}<div class="ctext"><b>${fmt(n.front || '')}</b></div><hr><div class="ctext">${fmt(n.back || '')}</div>`;
const skojFront = n => n.type === 'cloze' ? `<div class="ctext">${typeof clozeHTML === 'function' ? clozeHTML(n.text, 'c1', false) : esc(n.text)}</div>`
  : `${n.imageId && IMG[n.imageId] ? `<img class="cimg" src="${IMG[n.imageId]}" alt="">` : ''}<div class="ctext">${fmt(n.front || '')}</div>`;

function skojStart(deckId, dir) {
  const ns = skojNotes(deckId); if (!ns.length) return toast('W tej talii nie ma fiszek ze skojarzeniami');
  SKOJ = { deckId, dir, queue: shuffle(ns.map(n => n.id)), i: 0, shown: false, ok: 0, miss: 0, retry: new Set(), done: false };
  go('#/skoj/' + deckId); render();
}
ROUTES.skoj = parts => {
  if (!skojAdmin()) return { tab: 'home', html: '<p class="muted center" style="padding:40px 0">Ten tryb jest jeszcze w testach.</p>' };
  const deckId = parts[1] || 'all', d = deckId === 'all' ? null : deckById(deckId), name = d ? d.name : 'Wszystkie talie';
  const K = SKOJ && SKOJ.deckId === deckId ? SKOJ : null, cnt = skojNotes(deckId).length;
  if (!K) return { tab: 'home', html: `<div class="row nowrap"><button class="iconbtn" data-go="${d ? '#/deck/' + d.id : '#/'}">‹</button><h1 class="grow" style="margin:0">💡 Powtórka skojarzeń</h1><span class="tag">admin</span></div>
    <div class="card"><p style="margin-top:0"><b>${esc(name)}</b> · ${cnt} ${plural(cnt, 'fiszka', 'fiszki', 'fiszek')} ze skojarzeniem</p>
      <p class="small muted">Trening – nie zmienia terminów powtórek. Fiszki, których nie pamiętasz, wrócą jeszcze raz na końcu.</p>
      ${cnt ? `<button class="primary block" data-act="skoj-go" data-id="${deckId}" data-dir="h2c" style="min-height:52px">💡 → 🃏 Skojarzenie → fiszka</button>
      <p class="small muted" style="margin:4px 0 12px">Widzisz samo skojarzenie – przypomnij sobie pytanie i odpowiedź.</p>
      <button class="block" data-act="skoj-go" data-id="${deckId}" data-dir="c2h" style="min-height:52px">🃏 → 💡 Fiszka → skojarzenie</button>
      <p class="small muted" style="margin:4px 0 0">Widzisz pytanie – przypomnij sobie swoje skojarzenie.</p>` : '<p class="muted">Dodaj skojarzenia do fiszek (💡 w trakcie nauki albo w edycji fiszki), żeby z nich ćwiczyć.</p>'}</div>` };
  if (K.done) return { tab: 'home', html: `<div class="card center"><div style="font-size:48px">💡</div><h2>Koniec powtórki skojarzeń</h2>
    <p>Pamiętałeś <b>${K.ok}</b> z ${K.ok + K.miss}${K.miss ? ` · do poprawy: ${K.miss}` : ''}</p>
    <div class="row"><button class="primary grow" data-act="skoj-go" data-id="${deckId}" data-dir="${K.dir}">🔁 Jeszcze raz</button><button class="grow" data-act="skoj-dir" data-id="${deckId}" data-dir="${K.dir === 'h2c' ? 'c2h' : 'h2c'}">⇄ Odwrotnie</button></div>
    <button class="ghost block" data-act="skoj-quit" data-id="${deckId}" style="margin-top:8px">Wyjdź</button></div>` };
  const n = noteById(K.queue[K.i]); if (!n) { K.i++; if (K.i >= K.queue.length) K.done = true; return ROUTES.skoj(parts); }
  const total = K.queue.length, prompt = K.dir === 'h2c' ? skojHintHTML(n) : `<div class="card flash qfit">${skojFront(n)}</div>`;
  const reveal = K.dir === 'h2c' ? `<div class="card flash qfit">${skojCardHTML(n)}</div>` : skojHintHTML(n);
  return { tab: 'home', focus: true, html: `<div class="studybar"><button class="iconbtn" data-act="skoj-quit" data-id="${deckId}" aria-label="Zakończ">✕</button><div class="title">💡 ${K.dir === 'h2c' ? 'Skojarzenie → fiszka' : 'Fiszka → skojarzenie'}</div><small class="muted">${Math.min(K.i + 1, total)}/${total}</small></div>
    ${progress(K.i / total)}
    <p class="small muted center" style="margin:10px 0 6px">${K.dir === 'h2c' ? 'Do jakiej fiszki jest to skojarzenie?' : 'Jakie masz skojarzenie do tej fiszki?'}</p>
    ${prompt}
    ${K.shown ? `<div class="skoj-rev">${reveal}</div><div class="row" style="margin-top:12px"><button class="grow skoj-no" data-act="skoj-ans" data-v="0">✗ Nie wiedziałem</button><button class="primary grow" data-act="skoj-ans" data-v="1">✓ Wiedziałem</button></div>`
      : `<button class="primary block" data-act="skoj-show" style="margin-top:12px;min-height:52px">Pokaż ${K.dir === 'h2c' ? 'fiszkę' : 'skojarzenie'}</button>`}` };
};
// wejścia: strona talii i strona główna (tylko admin)
const skojDeck0 = viewDeck;
viewDeck = function (id, q) { const html = skojDeck0(id, q); if (!skojAdmin()) return html; const n = skojNotes(id).length;
  return html + `<div class="card row nowrap skoj-cta" data-go="#/skoj/${id}"><span style="font-size:26px">💡</span><div class="grow"><b>Powtórka skojarzeń <span class="tag">admin</span></b><div class="small muted">${n} ${plural(n, 'fiszka', 'fiszki', 'fiszek')} ze skojarzeniem</div></div><span>›</span></div>`; };
const skojHome0 = homeExtrasHTML;
homeExtrasHTML = function () { const base = skojHome0(); if (!skojAdmin()) return base; const n = skojNotes('all').length; if (!n) return base;
  return base + `<div class="card row nowrap skoj-cta" data-go="#/skoj/all"><span style="font-size:26px">💡</span><div class="grow"><b>Powtórka skojarzeń <span class="tag">admin</span></b><div class="small muted">${n} ${plural(n, 'fiszka', 'fiszki', 'fiszek')} ze skojarzeniem we wszystkich taliach</div></div><span>›</span></div>`; };
Object.assign(ACTIONS, {
  'skoj-go': el => skojStart(el.dataset.id, el.dataset.dir || 'h2c'),
  'skoj-dir': el => skojStart(el.dataset.id, el.dataset.dir),
  'skoj-show': () => { if (SKOJ) { SKOJ.shown = true; render(); } },
  'skoj-ans': el => { const K = SKOJ; if (!K) return; const id = K.queue[K.i], ok = el.dataset.v === '1';
    if (!K.retry.has(id)) { ok ? K.ok++ : K.miss++; }
    if (!ok && !K.retry.has(id)) { K.retry.add(id); K.queue.push(id); }   // raz jeszcze na koniec
    K.i++; K.shown = false; if (K.i >= K.queue.length) K.done = true; render(); },
  'skoj-quit': el => { const id = el.dataset.id; SKOJ = null; go(id && id !== 'all' ? '#/deck/' + id : '#/'); },
});

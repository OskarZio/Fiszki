'use strict';
/* duo mode – tryb nauki we dwoje – WYŁĄCZNIE dla właściciela (IS_ADMIN); dla innych trasy #/duo* dają 404, brak linków w UI. Karty (rewards / forfeits) NIE leżą w kodzie ani w repozytorium:
   trzymane są tylko na urządzeniu (localStorage, bez synchronizacji) i trafiają tam wyłącznie z linku #/duo?d=… (treść
   skompresowana w części adresu po „#”, której przeglądarka nie wysyła do serwera), z pliku JSON albo z ręcznego dodania.
   Właściciel może dodatkowo pobrać karty z tabeli duo_cards (RLS tylko dla app_admins) i wygenerować z nich link.
   Rundy: 1 rozgrzewka · 2 „na ślepo” · 3 „va banque” (przed pytaniem wybór stawki) · 4 egzamin (5 najczęściej mylonych, zaliczenie od 4/5).
   Va banque: „bezpiecznie” = +1 i karty z puli rundy 2; „va banque” = +2 / −1 i karty z puli rundy 3 (najwyższa stawka). */
const duoOn = () => typeof IS_ADMIN !== 'undefined' && IS_ADMIN === true;
const duoAdmin = () => typeof IS_ADMIN !== 'undefined' && IS_ADMIN === true;
const DUO_ROUNDS = [['Rozgrzewka', 'pytanie → odpowiedź → pytający ocenia'], ['Na ślepo', 'jak rozgrzewka, inna pula kart'], ['Va banque', 'przed pytaniem wybierasz stawkę: bezpiecznie (+1) albo va banque (+2 / −1, najwyższa pula kart)'], ['Egzamin', '5 najczęściej mylonych fiszek, zaliczenie od 4/5']];
const DUO_EXAM_N = 5, DUO_EXAM_PASS = 4;
let DUO = null, DUO_CARDS = null, DUO_TICK = 0, DUO_ADM = { edit: null };
const duoPrefs = () => (S.stats.duoPrefs = S.stats.duoPrefs || { names: ['', ''], decks: ['', ''], mins: [10, 15, 15] });

// ---------- dane: karty tylko na tym urządzeniu
const DUO_KEY = 'duoCards';
function duoLoad() {
  if (DUO_CARDS) return DUO_CARDS;
  let list = []; try { list = JSON.parse(localStorage.getItem(DUO_KEY) || '[]'); } catch { /* */ }
  DUO_CARDS = { list: Array.isArray(list) ? list : [] }; return DUO_CARDS;
}
function duoPersist(list) { list = list.map(duoClean2).filter(x => x.content); DUO_CARDS = { list }; try { localStorage.setItem(DUO_KEY, JSON.stringify(list)); } catch { toast('Nie udało się zapisać kart na urządzeniu'); } }
const duoClean2 = (x, i) => ({ id: Number.isInteger(x.id) ? x.id : Date.now() % 1e9 + (i || 0), type: x.type === 'forfeit' ? 'forfeit' : 'reward', round: [1, 2, 3, 4].includes(+x.round) ? +x.round : null, content: String(x.content || '').trim().slice(0, 500), active: x.active !== false });
// link: #/duo?d=<deflate-raw + base64url z JSON kart> (format jak link do talii)
async function duoLink() { const min = duoList().map(c => [c.type === 'forfeit' ? 1 : 0, c.round || 0, c.content, c.active ? 1 : 0]); return location.origin + location.pathname + '#/duo?d=' + await packZip(JSON.stringify(min)); }
async function duoFromLink(z) {
  let arr; try { arr = JSON.parse(await packUnzip(z)); } catch { return toast('Ten link do kart jest uszkodzony albo niepełny', 4500); }
  if (!Array.isArray(arr) || !arr.length) return toast('Link nie zawiera kart');
  const list = arr.map((r, i) => Array.isArray(r) ? { id: i + 1, type: r[0] ? 'forfeit' : 'reward', round: r[1] || null, content: r[2], active: r[3] !== 0 } : { ...r, id: i + 1 });
  const has = duoList().length;
  if (!await askBox({ title: `Wczytać ${list.length} kart?`, intro: has ? `Zastąpią ${has} kart zapisanych na tym urządzeniu.` : 'Karty zapiszą się tylko na tym urządzeniu.', ok: 'Wczytaj' })) return go('#/duo');
  duoPersist(list); toast(`Wczytano ${list.length} kart`); go('#/duo');
}
const duoList = () => DUO_CARDS?.list || [];
// losowanie bez powtórek w sesji (pula się odnawia, gdy się wyczerpie)
function duoDraw(type, round) {
  const pool = duoList().filter(c => c.active && c.type === type && (type === 'reward' ? c.round === round : c.round == null || c.round === round));
  if (!pool.length) return null;
  const used = DUO.used[type] = DUO.used[type] || new Set();
  let fresh = pool.filter(c => !used.has(c.id)); if (!fresh.length) { pool.forEach(c => used.delete(c.id)); fresh = pool; }
  const c = fresh[Math.random() * fresh.length | 0]; used.add(c.id); return c;
}

// ---------- sesja
const duoDeckCards = id => S.cards.filter(c => c.deckId === id && !c.sus && cardView(c).ans.trim());
function duoStart(names, decks, mins) {
  // gracz A odpowiada z talii gracza B i odwrotnie
  const q = [shuffle(duoDeckCards(decks[1]).map(c => c.id)), shuffle(duoDeckCards(decks[0]).map(c => c.id))];
  if (q[0].length < DUO_EXAM_N || q[1].length < DUO_EXAM_N) return toast(`Każda talia potrzebuje min. ${DUO_EXAM_N} fiszek`);
  DUO = { names, decks, mins, q, round: 1, turn: 0, score: [0, 0], miss: {}, used: {}, phase: 'intro', step: null, paused: false, endAt: 0, left: 0, timeUp: false, exam: null, risky: [0, 0] };
  render();
}
function duoBeginRound() {
  const D = DUO; D.phase = 'play'; D.timeUp = false; D.turn = 0; D.paused = false;
  const m = D.mins[D.round - 1]; D.endAt = D.round <= 3 && m ? Date.now() + m * 60e3 : 0;
  if (D.round === 4) D.exam = { p: 0, i: 0, ok: 0, cards: [duoExamCards(0), duoExamCards(1)], done: [] };
  duoNext(); duoTimer();
}
function duoExamCards(p) {
  const ids = [...new Set(DUO.q[p])];
  return ids.sort((a, b) => (DUO.miss[b] || 0) - (DUO.miss[a] || 0) || Math.random() - .5).slice(0, DUO_EXAM_N);
}
function duoNext() {
  const D = DUO;
  if (D.timeUp && D.round <= 3) { D.phase = 'roundEnd'; return render(); }
  if (D.round <= 2) D.step = { k: 'q', id: D.q[D.turn][0], shown: false };
  else if (D.round === 3) D.step = { k: 'stake', id: D.q[D.turn][0] };
  else { const E = D.exam; if (E.i >= DUO_EXAM_N) return duoExamEnd(); D.step = { k: 'q', id: E.cards[E.p][E.i], shown: false }; }
  render();
}
function duoAnswer(ok) {
  const D = DUO, id = D.step.id, p = D.turn;
  if (D.round === 4) { const E = D.exam; if (ok) { E.ok++; D.score[E.p]++; } else D.miss[id] = (D.miss[id] || 0) + 1; E.i++; return duoNext(); }
  const qq = D.q[p], hi = D.round === 3 && D.step.hi; qq.shift(); qq.push(id);   // źle → na koniec kolejki (dobra też wraca na koniec, żeby pula się nie kończyła)
  if (ok) D.score[p] += hi ? 2 : 1; else { D.miss[id] = (D.miss[id] || 0) + 1; if (hi) D.score[p] = Math.max(0, D.score[p] - 1); }
  const pool = D.round === 3 ? (hi ? 3 : 2) : D.round;
  D.step = { k: 'card', ok, hi, card: duoDraw(ok ? 'reward' : 'forfeit', pool) }; render();
}
function duoStake(hi) { const D = DUO; if (hi) D.risky[D.turn]++; D.step = { k: 'q', id: D.step.id, shown: false, hi }; render(); }
function duoExamEnd() {
  const D = DUO, E = D.exam, pass = E.ok >= DUO_EXAM_PASS; E.done.push({ p: E.p, ok: E.ok, pass });
  D.step = { k: 'card', ok: pass, exam: E.ok, card: duoDraw(pass ? 'reward' : 'forfeit', 4) }; render();
}
function duoAfterCard() {
  const D = DUO;
  if (D.round === 4) { const E = D.exam; if (E.p === 0) { E.p = 1; E.i = 0; E.ok = 0; D.turn = 1; return duoNext(); } D.phase = 'end'; return render(); }
  D.turn = 1 - D.turn; duoNext();
}
// ---------- minutnik (bez przebudowy ekranu co sekundę)
const duoFmt = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
function duoTimer() {
  clearInterval(DUO_TICK);
  DUO_TICK = setInterval(() => {
    const D = DUO; if (!D || parseRoute().parts[0] !== 'duo') { clearInterval(DUO_TICK); return; }
    if (D.paused || D.phase !== 'play') return;
    const now = Date.now();
    if (D.endAt) { const el = document.getElementById('duo-t'); if (el) el.textContent = duoFmt(D.endAt - now); if (now >= D.endAt && !D.timeUp) { D.timeUp = true; const b = document.getElementById('duo-tu'); if (b) b.hidden = false; } }
  }, 250);
}
function duoPause() {
  const D = DUO, now = Date.now();
  if (!D.paused) { D.paused = true; D.pausedAt = now; }
  else { const dt = now - D.pausedAt; if (D.endAt) D.endAt += dt; D.paused = false; }
  render();
}

// ---------- widoki
function duoSetupHTML() {
  const P = duoPrefs(), ds = S.decks.filter(d => duoDeckCards(d.id).length >= DUO_EXAM_N), opt = sel => ds.map(d => `<option value="${d.id}"${d.id === sel ? ' selected' : ''}>${esc(d.name)}</option>`).join('');
  const n = duoList().filter(c => c.active), cnt = t => n.filter(c => c.type === t).length;
  return `<div class="row nowrap"><button class="iconbtn" data-go="#/boss">‹</button><h1 class="grow" style="margin:0">Duo</h1><button class="sm" data-go="#/duo/admin">Karty</button></div>
  <div class="card duo-setup">
    ${[0, 1].map(i => `<div class="duo-pl"><b>Gracz ${'AB'[i]}</b><label class="field"><span>Imię</span><input id="duo-n${i}" maxlength="20" value="${esc(P.names[i] || '')}" placeholder="Gracz ${'AB'[i]}"></label>
      <label class="field"><span>Talia gracza ${'AB'[i]} <small class="muted">(odpowiada z niej gracz ${'BA'[i]})</small></span><select id="duo-d${i}">${opt(P.decks[i])}</select></label></div>`).join('')}
    <p class="small muted" style="margin:4px 0">Minutnik rund (min):</p>
    <div class="duo-mins">${[0, 1, 2].map(i => `<label><small>${DUO_ROUNDS[i][0]}</small><input id="duo-m${i}" type="number" min="1" max="60" value="${P.mins[i]}"></label>`).join('')}<label><small>Egzamin</small><input value="–" disabled></label></div>
    <ol class="small duo-rules">${DUO_ROUNDS.map(r => `<li><b>${r[0]}</b> – ${r[1]}</li>`).join('')}</ol>
    ${duoList().length ? `<p class="small muted">Aktywne karty: ${cnt('reward')} rewards · ${cnt('forfeit')} forfeits</p>` : '<p class="small">Brak kart na tym urządzeniu – otwórz link z kartami albo dodaj je w „Karty”. Bez kart gra liczy tylko punkty.</p>'}
    <button class="primary block" data-act="duo-start" ${ds.length ? '' : 'disabled'}>▶ Start</button>
    ${ds.length ? '' : `<p class="small muted">Potrzebne talie z min. ${DUO_EXAM_N} fiszkami.</p>`}</div>`;
}
function duoCardHTML(st) {
  const c = st.card, D = DUO;
  return `<div class="duo-draw ${st.ok ? 'ok' : 'bad'}"><small>${st.exam != null ? `Egzamin: ${st.exam}/${DUO_EXAM_N} – ${st.ok ? 'zaliczony' : 'niezaliczony'}` : `${st.hi ? '🔥 va banque · ' : ''}${st.ok ? (st.hi ? 'Dobrze, +2' : 'Dobrze') : st.hi ? 'Źle, −1' : 'Źle'}`} · ${st.ok ? 'reward' : 'forfeit'}</small>
    <p class="duo-ct">${c ? esc(c.content) : 'Brak aktywnych kart w tej puli.'}</p>
    <div class="row nowrap"><button class="grow" data-act="duo-pass">Pas</button><button class="primary grow" data-act="duo-done">Dalej ›</button></div></div>`;
}
function duoPlayHTML() {
  const D = DUO, st = D.step, R = DUO_ROUNDS[D.round - 1], asker = D.names[1 - D.turn], ans = D.names[D.turn];
  const head = `<div class="duo-head"><button class="iconbtn" data-act="duo-quit" aria-label="Zakończ">✕</button><div class="grow"><b>Runda ${D.round}/4 · ${R[0]}</b><small class="muted">${D.names[0]} ${D.score[0]} : ${D.score[1]} ${D.names[1]}</small></div>
    ${D.endAt ? `<b class="duo-timer" id="duo-t">${duoFmt((D.paused ? D.pausedAt : Date.now()) > D.endAt ? 0 : D.endAt - (D.paused ? D.pausedAt : Date.now()))}</b>` : ''}<button class="sm" data-act="duo-pause">${D.paused ? '▶' : '⏸'}</button></div>
    <p class="small duo-tu" id="duo-tu" ${D.timeUp ? '' : 'hidden'}>Czas rundy minął – dokończ to pytanie.</p>`;
  if (D.paused) return head + '<div class="card center duo-paused"><h2>Pauza</h2><button class="primary" data-act="duo-pause">▶ Wznów</button></div>';
  if (st.k === 'card') return head + duoCardHTML(st);
  const c = cardById(st.id), v = c ? cardView(c) : null;
  if (st.k === 'stake') return head + `<div class="card duo-q duo-stake"><small>Odpowiada ${esc(ans)} · wybierz stawkę, zanim zobaczysz pytanie</small>
      <button class="duo-safe" data-act="duo-stake" data-v="0"><b>Bezpiecznie</b><small>+1 · łagodniejsza pula kart</small></button>
      <button class="duo-hi" data-act="duo-stake" data-v="1"><b>🔥 Va banque</b><small>+2 za dobrze, −1 za źle · najostrzejsza pula kart</small></button></div>`;
  return head + `<div class="card duo-q"><small>${D.round === 4 ? `Egzamin ${esc(ans)} · ${D.exam.i + 1}/${DUO_EXAM_N}` : `Pyta ${esc(asker)} · odpowiada ${esc(ans)}${st.hi ? ' · 🔥 va banque' : ''}`}</small>
    <div class="duo-qt">${v ? v.q : ''}</div>${st.shown && v ? `<hr><div class="duo-at">${v.b}</div>` : ''}
    ${st.shown ? `<div class="row nowrap"><button class="grow duo-bad" data-act="duo-ans" data-v="0">✗ Źle</button><button class="grow duo-ok" data-act="duo-ans" data-v="1">✓ Dobrze</button></div>`
      : `<button class="primary block" data-act="duo-show">Pokaż odpowiedź (dla pytającego)</button>`}</div>`;
}
function duoRoundEndHTML() {
  const D = DUO, nx = DUO_ROUNDS[D.round];
  return `<div class="card center duo-paused"><h2>Koniec rundy ${D.round}</h2><p>${esc(D.names[0])} ${D.score[0]} : ${D.score[1]} ${esc(D.names[1])}</p>
    ${nx ? `<p class="small muted">Dalej: <b>${nx[0]}</b> – ${nx[1]}</p><button class="primary block" data-act="duo-round">▶ Runda ${D.round + 1}</button>` : ''}<button class="block" data-act="duo-quit">Zakończ sesję</button></div>`;
}
function duoEndHTML() {
  const D = DUO, w = D.score[0] === D.score[1] ? null : D.score[0] > D.score[1] ? 0 : 1;
  return `<div class="card center duo-paused"><h2>Koniec sesji</h2><p class="duo-final">${esc(D.names[0])} <b>${D.score[0]}</b> : <b>${D.score[1]}</b> ${esc(D.names[1])}</p>
    <p>${w == null ? 'Remis!' : `Wygrywa ${esc(D.names[w])}`}</p>
    ${D.exam?.done.map(x => `<p class="small">Egzamin ${esc(D.names[x.p])}: ${x.ok}/${DUO_EXAM_N} ${x.pass ? '✓' : '✗'}</p>`).join('') || ''}
    ${D.risky[0] + D.risky[1] ? `<p class="small muted">Va banque: ${esc(D.names[0])} ${D.risky[0]}× · ${esc(D.names[1])} ${D.risky[1]}×</p>` : ''}
    <button class="primary block" data-act="duo-reset">Nowa sesja</button></div>`;
}
let DUO_LINK_SEEN = '';
ROUTES.duo = (parts = [], q) => {
  if (!duoOn()) return { tab: '', html: notFoundHTML() };     // nie-admin: identycznie jak nieistniejąca trasa
  duoLoad();
  const z = q?.get?.('d'); if (z && z !== DUO_LINK_SEEN) { DUO_LINK_SEEN = z; setTimeout(() => duoFromLink(z), 50); }
  if (parts[1] === 'admin') return { tab: 'arena', html: duoAdminHTML() };
  if (parts[1]) return { tab: '', html: notFoundHTML() };
  if (!DUO) return { tab: 'arena', html: duoSetupHTML() };
  if (DUO.phase === 'play' && !DUO_TICK) duoTimer();
  const body = DUO.phase === 'intro' ? `<div class="card center duo-paused"><h2>Runda ${DUO.round}: ${DUO_ROUNDS[DUO.round - 1][0]}</h2><p class="small muted">${DUO_ROUNDS[DUO.round - 1][1]}</p><button class="primary block" data-act="duo-round">▶ Zaczynamy</button></div>`
    : DUO.phase === 'roundEnd' ? duoRoundEndHTML() : DUO.phase === 'end' ? duoEndHTML() : duoPlayHTML();
  return { tab: 'arena', focus: true, html: `<div class="duo">${body}</div>` };
};

// ---------- panel kart (CRUD + import/eksport JSON)
function duoAdminHTML() {
  const L = DUO_CARDS, e = DUO_ADM.edit;
  const rows = (L?.list || []).map(c => `<div class="duo-row${c.active ? '' : ' off'}"><span class="tag">${c.type}</span><span class="tag">${c.round ? 'R' + c.round : 'każda'}</span>
    <span class="grow duo-rc">${esc(c.content)}</span><button class="sm" data-act="duo-tog" data-id="${c.id}">${c.active ? 'Wyłącz' : 'Włącz'}</button><button class="sm" data-act="duo-edit" data-id="${c.id}">✏️</button><button class="sm" data-act="duo-del" data-id="${c.id}">🗑️</button></div>`).join('');
  return `<div class="row nowrap"><button class="iconbtn" data-go="#/duo">‹</button><h1 class="grow" style="margin:0">Karty duo</h1></div>
  <div class="card duo-form"><b>${e ? 'Edycja karty #' + e.id : 'Nowa karta'}</b>
    <div class="row nowrap"><select id="duo-ft"><option value="reward"${e?.type === 'reward' ? ' selected' : ''}>reward</option><option value="forfeit"${e?.type === 'forfeit' ? ' selected' : ''}>forfeit</option></select>
      <select id="duo-fr"><option value="">każda runda</option>${[1, 2, 3, 4].map(r => `<option value="${r}"${e?.round === r ? ' selected' : ''}>runda ${r}</option>`).join('')}</select></div>
    <textarea id="duo-fc" rows="3" maxlength="500" placeholder="Treść karty">${esc(e?.content || '')}</textarea>
    <div class="row nowrap"><button class="primary grow" data-act="duo-save">${e ? 'Zapisz' : 'Dodaj'}</button>${e ? '<button class="grow" data-act="duo-cancel">Anuluj</button>' : ''}</div></div>
  <div class="row"><button class="sm" data-act="duo-link">🔗 Link do kart</button><button class="sm" data-act="duo-export">⬇️ Eksport JSON</button><button class="sm" data-act="duo-import">⬆️ Import JSON</button>${duoAdmin() ? '<button class="sm" data-act="duo-dbload">☁️ Pobierz z bazy</button>' : ''}${(L?.list || []).length ? '<button class="sm" data-act="duo-clear">🗑️ Usuń wszystkie</button>' : ''}</div>
  <p class="small muted">Karty są zapisane tylko na tym urządzeniu (nie synchronizują się). Link zawiera karty w adresie – udostępniaj go tylko komu chcesz.</p>
  <div class="card">${rows || '<p class="muted">Brak kart.</p>'}</div>`;
}
const duoClean = x => ({ type: x.type === 'forfeit' ? 'forfeit' : 'reward', round: [1, 2, 3, 4].includes(+x.round) ? +x.round : null, content: String(x.content || '').trim().slice(0, 500), active: x.active !== false });
function duoSet(list, ok) { duoPersist(list); if (ok) toast(ok); render(); }
Object.assign(ACTIONS, {
  'duo-start': () => {
    const P = duoPrefs();
    P.names = [0, 1].map(i => ($(`#duo-n${i}`).value || '').trim().slice(0, 20)); P.decks = [0, 1].map(i => $(`#duo-d${i}`).value); P.mins = [0, 1, 2].map(i => Math.max(1, Math.min(60, +$(`#duo-m${i}`).value || [10, 15, 15][i]))); save();
    duoStart(P.names.map((n, i) => n || 'Gracz ' + 'AB'[i]), P.decks, P.mins);
  },
  'duo-round': () => { const D = DUO; if (!D) return; if (D.phase === 'roundEnd') { D.round++; D.phase = 'intro'; return render(); } duoBeginRound(); },
  'duo-show': () => { if (DUO?.step) { DUO.step.shown = true; render(); } },
  'duo-ans': el => duoAnswer(el.dataset.v === '1'),
  'duo-stake': el => { if (DUO?.step?.k === 'stake') duoStake(el.dataset.v === '1'); },
  'duo-pass': () => { if (DUO?.step?.k === 'card') { DUO.step.card = null; duoAfterCard(); } },   // pas: pomija kartę bez kary
  'duo-done': () => duoAfterCard(),
  'duo-pause': () => DUO && duoPause(),
  'duo-quit': async () => { if (!DUO) return go('#/duo'); if (DUO.phase !== 'end' && !await askBox({ title: 'Zakończyć sesję?', ok: 'Zakończ', cancel: 'Graj dalej' })) return; DUO.phase = 'end'; clearInterval(DUO_TICK); DUO_TICK = 0; render(); },
  'duo-reset': () => { DUO = null; clearInterval(DUO_TICK); DUO_TICK = 0; render(); },
  'duo-save': async () => {
    const x = duoClean({ type: $('#duo-ft').value, round: $('#duo-fr').value, content: $('#duo-fc').value, active: DUO_ADM.edit ? DUO_ADM.edit.active : true });
    if (!x.content) return toast('Wpisz treść');
    const e = DUO_ADM.edit, list = duoList(); DUO_ADM.edit = null;
    duoSet(e ? list.map(c => c.id === e.id ? { ...c, ...x } : c) : [...list, { id: Math.max(0, ...list.map(c => c.id)) + 1, ...x }], e ? 'Zapisano' : 'Dodano');
  },
  'duo-edit': el => { DUO_ADM.edit = duoList().find(c => c.id === +el.dataset.id) || null; render(); window.scrollTo(0, 0); },
  'duo-cancel': () => { DUO_ADM.edit = null; render(); },
  'duo-tog': el => { const id = +el.dataset.id; duoSet(duoList().map(c => c.id === id ? { ...c, active: !c.active } : c)); },
  'duo-del': async el => { if (!await askBox({ title: 'Usunąć kartę?', ok: 'Usuń', danger: true })) return; const id = +el.dataset.id; duoSet(duoList().filter(c => c.id !== id), 'Usunięto'); },
  'duo-clear': async () => { if (!await askBox({ title: 'Usunąć wszystkie karty z tego urządzenia?', ok: 'Usuń', danger: true })) return; duoSet([], 'Usunięto'); },
  'duo-link': async () => { if (!duoList().length) return toast('Brak kart'); const url = await duoLink();
    try { await navigator.clipboard.writeText(url); toast('🔗 Link do kart skopiowany', 3000); } catch { prompt('Skopiuj link do kart:', url); } },
  'duo-dbload': async () => { if (!duoAdmin() || !(typeof cloudOn === 'function' && cloudOn())) return toast('Zaloguj się jako właściciel');
    const r = await SB.from('duo_cards').select('id,type,round,content,active').order('id'); if (r.error) return toast('Błąd: ' + r.error.message, 4000);
    if (!r.data?.length) return toast('Baza nie ma kart'); duoSet(r.data, `Pobrano ${r.data.length} kart z bazy`); },
  'duo-export': () => { if (!duoList().length) return toast('Brak kart'); download('duo_cards.json', JSON.stringify(duoList().map(({ id, type, round, content, active }) => ({ id, type, round, content, active })), null, 2), 'application/json'); },
  'duo-import': async () => {
    const f = await pickFile('.json,application/json'); if (!f) return;
    let arr; try { arr = JSON.parse(await f.text()); } catch { return toast('To nie jest poprawny plik JSON'); }
    if (!Array.isArray(arr)) return toast('Plik musi zawierać listę kart');
    const rows = arr.map(duoClean2).filter(x => x.content);
    if (!rows.length) return toast('Brak kart w pliku');
    if (!await askBox({ title: `Zaimportować ${rows.length} kart?`, intro: 'Zastąpią karty zapisane na tym urządzeniu.', ok: 'Importuj' })) return;
    duoSet(rows, `Zaimportowano ${rows.length}`);
  },
});
// wejście: kafelek w Przygodzie („Więcej trybów”)
const duoBoss0 = ROUTES.boss;
ROUTES.boss = (...a) => { const v = duoBoss0(...a); if (!v?.html || v.focus || !duoOn() || (a[0] && a[0][1])) return v;
  return { ...v, html: v.html.replace('<div class="card row nowrap coop-cta"', '<div class="card row nowrap duo-cta" data-go="#/duo"><span style="font-size:28px">💞</span><div class="grow"><b>Duo</b><div class="small muted">Nauka we dwoje · pytacie się nawzajem z talii</div></div><span>›</span></div><div class="card row nowrap coop-cta"') }; };
if (typeof ADV_TILES !== 'undefined') ADV_TILES = ADV_TILES + ', .duo-cta';
// wszystkie akcje trybu działają tylko dla właściciela
for (const k of Object.keys(ACTIONS)) if (k.startsWith('duo-')) { const f = ACTIONS[k]; ACTIONS[k] = (...a) => duoOn() ? f(...a) : undefined; }

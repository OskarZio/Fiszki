'use strict';
/* duo mode – tryb nauki we dwoje, WYŁĄCZNIE dla właściciela aplikacji (IS_ADMIN).
   Dla wszystkich innych trasy #/duo i #/duo/admin wyglądają jak każda nieistniejąca strona (404), a w UI nie ma do nich linków.
   Dane (duo cards: rewards / forfeits) leżą tylko w bazie – tabela duo_cards z RLS dostępną wyłącznie dla app_admins,
   więc nawet bezpośrednie zapytanie do API zwraca innym pustą listę. W kodzie nie ma żadnej treści kart.
   Rundy: 1 rozgrzewka · 2 „na ślepo” · 3 „wykładowca” (temat + 2 min, ocena 1–5) · 4 egzamin (5 najczęściej mylonych, zaliczenie od 4/5).
   Dobrze → losowa aktywna karta reward z bieżącej rundy; źle → forfeit (runda bieżąca albo każda), fiszka wraca na koniec kolejki. */
const duoOn = () => typeof IS_ADMIN !== 'undefined' && IS_ADMIN === true;
const DUO_ROUNDS = [['Rozgrzewka', 'pytanie → odpowiedź → pytający ocenia'], ['Na ślepo', 'jak rozgrzewka, inna pula kart'], ['Wykładowca', 'losowy temat, 2 minuty, słuchacz ocenia 1–5'], ['Egzamin', '5 najczęściej mylonych fiszek, zaliczenie od 4/5']];
const DUO_LECTURE_S = 120, DUO_EXAM_N = 5, DUO_EXAM_PASS = 4;
let DUO = null, DUO_CARDS = null, DUO_TICK = 0, DUO_ADM = { edit: null };
const duoPrefs = () => (S.stats.duoPrefs = S.stats.duoPrefs || { names: ['', ''], decks: ['', ''], mins: [10, 15, 15] });

// ---------- dane: duo_cards (Supabase, RLS tylko dla właściciela)
async function duoLoad(force) {
  if (DUO_CARDS && !force) return DUO_CARDS;
  if (!(typeof cloudOn === 'function' && cloudOn())) { DUO_CARDS = { err: 'Zaloguj się, żeby wczytać karty.' }; return DUO_CARDS; }
  const r = await SB.from('duo_cards').select('id,type,round,content,active').order('type').order('round', { nullsFirst: true }).order('id');
  DUO_CARDS = r.error ? { err: /relation|does not exist|schema cache/i.test(r.error.message || '') ? 'Wgraj nowy supabase.sql (Panel hosta → Aktualizacja bazy).' : 'Błąd: ' + r.error.message } : { list: r.data || [] };
  return DUO_CARDS;
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
  DUO = { names, decks, mins, q, round: 1, turn: 0, score: [0, 0], miss: {}, used: {}, phase: 'intro', step: null, paused: false, endAt: 0, left: 0, timeUp: false, lecture: null, exam: null };
  render();
}
function duoBeginRound() {
  const D = DUO; D.phase = 'play'; D.timeUp = false; D.turn = 0; D.paused = false;
  const m = D.mins[D.round - 1]; D.endAt = D.round <= 3 && m ? Date.now() + m * 60e3 : 0;
  if (D.round === 3) D.lecture = null;
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
  else if (D.round === 3) { const ids = D.q[D.turn], c = cardById(ids[Math.random() * ids.length | 0]); D.step = { k: 'lecture', id: c?.id, endAt: 0, rated: null }; }
  else { const E = D.exam; if (E.i >= DUO_EXAM_N) return duoExamEnd(); D.step = { k: 'q', id: E.cards[E.p][E.i], shown: false }; }
  render();
}
function duoAnswer(ok) {
  const D = DUO, id = D.step.id, p = D.turn;
  if (D.round === 4) { const E = D.exam; if (ok) { E.ok++; D.score[E.p]++; } else D.miss[id] = (D.miss[id] || 0) + 1; E.i++; return duoNext(); }
  const qq = D.q[p]; qq.shift();
  if (ok) { qq.push(id); D.score[p]++; } else { D.miss[id] = (D.miss[id] || 0) + 1; qq.push(id); }   // źle → na koniec kolejki (dobra też wraca na koniec, żeby pula się nie kończyła)
  D.step = { k: 'card', ok, card: duoDraw(ok ? 'reward' : 'forfeit', D.round) }; render();
}
function duoRate(n) {
  const D = DUO, ok = n >= 4; if (ok) D.score[D.turn]++;
  D.step = { k: 'card', ok, rate: n, card: duoDraw(ok ? 'reward' : 'forfeit', 3) }; render();
}
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
    const L = D.step?.k === 'lecture' && D.step.endAt; if (L) { const el = document.getElementById('duo-lt'); if (el) el.textContent = duoFmt(D.step.endAt - now); if (now >= D.step.endAt && !D.step.over) { D.step.over = true; render(); } }
  }, 250);
}
function duoPause() {
  const D = DUO, now = Date.now();
  if (!D.paused) { D.paused = true; D.pausedAt = now; }
  else { const dt = now - D.pausedAt; if (D.endAt) D.endAt += dt; if (D.step?.endAt) D.step.endAt += dt; D.paused = false; }
  render();
}

// ---------- widoki
function duoSetupHTML() {
  const P = duoPrefs(), ds = S.decks.filter(d => duoDeckCards(d.id).length >= DUO_EXAM_N), opt = sel => ds.map(d => `<option value="${d.id}"${d.id === sel ? ' selected' : ''}>${esc(d.name)}</option>`).join('');
  const n = duoList().filter(c => c.active), cnt = t => n.filter(c => c.type === t).length;
  return `<div class="row nowrap"><button class="iconbtn" data-go="#/host">‹</button><h1 class="grow" style="margin:0">Duo</h1><button class="sm" data-go="#/duo/admin">Karty</button></div>
  <div class="card duo-setup">
    ${[0, 1].map(i => `<div class="duo-pl"><b>Gracz ${'AB'[i]}</b><label class="field"><span>Imię</span><input id="duo-n${i}" maxlength="20" value="${esc(P.names[i] || '')}" placeholder="Gracz ${'AB'[i]}"></label>
      <label class="field"><span>Talia gracza ${'AB'[i]} <small class="muted">(odpowiada z niej gracz ${'BA'[i]})</small></span><select id="duo-d${i}">${opt(P.decks[i])}</select></label></div>`).join('')}
    <p class="small muted" style="margin:4px 0">Minutnik rund (min):</p>
    <div class="duo-mins">${[0, 1, 2].map(i => `<label><small>${DUO_ROUNDS[i][0]}</small><input id="duo-m${i}" type="number" min="1" max="60" value="${P.mins[i]}"></label>`).join('')}<label><small>Egzamin</small><input value="–" disabled></label></div>
    <ol class="small duo-rules">${DUO_ROUNDS.map(r => `<li><b>${r[0]}</b> – ${r[1]}</li>`).join('')}</ol>
    ${DUO_CARDS?.err ? `<p class="small" style="color:#dc2626">${esc(DUO_CARDS.err)}</p>` : `<p class="small muted">Aktywne karty: ${cnt('reward')} rewards · ${cnt('forfeit')} forfeits</p>`}
    <button class="primary block" data-act="duo-start" ${ds.length ? '' : 'disabled'}>▶ Start</button>
    ${ds.length ? '' : `<p class="small muted">Potrzebne talie z min. ${DUO_EXAM_N} fiszkami.</p>`}</div>`;
}
function duoCardHTML(st) {
  const c = st.card, D = DUO;
  return `<div class="duo-draw ${st.ok ? 'ok' : 'bad'}"><small>${st.exam != null ? `Egzamin: ${st.exam}/${DUO_EXAM_N} – ${st.ok ? 'zaliczony' : 'niezaliczony'}` : st.rate ? `Ocena: ${st.rate}/5` : st.ok ? 'Dobrze' : 'Źle'} · ${st.ok ? 'reward' : 'forfeit'}</small>
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
  if (st.k === 'lecture') {
    const topic = c ? (noteById(c.noteId)?.extra || '').trim() || stripHtml(v.q) : '—';
    return head + `<div class="card duo-q"><small>${esc(ans)} wykłada · ${esc(asker)} słucha</small><p class="duo-topic">${esc(topic)}</p>
      ${st.endAt ? `<b class="duo-lt" id="duo-lt">${duoFmt(st.endAt - Date.now())}</b>` : `<button class="primary block" data-act="duo-lec">▶ Start wykładu (2 min)</button>`}
      ${st.endAt ? `<p class="small muted">${esc(asker)}: oceń wykład</p><div class="duo-rate">${[1, 2, 3, 4, 5].map(n => `<button data-act="duo-rate" data-n="${n}">${n}</button>`).join('')}</div>` : ''}</div>`;
  }
  return head + `<div class="card duo-q"><small>${D.round === 4 ? `Egzamin ${esc(ans)} · ${D.exam.i + 1}/${DUO_EXAM_N}` : `Pyta ${esc(asker)} · odpowiada ${esc(ans)}`}</small>
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
    <button class="primary block" data-act="duo-reset">Nowa sesja</button></div>`;
}
ROUTES.duo = (parts = []) => {
  if (!duoOn()) return { tab: '', html: notFoundHTML() };     // nie-admin: identycznie jak nieistniejąca trasa
  if (parts[1] === 'admin') { if (!DUO_CARDS) duoLoad().then(render); return { tab: 'profile', html: duoAdminHTML() }; }
  if (parts[1]) return { tab: '', html: notFoundHTML() };
  if (!DUO_CARDS) duoLoad().then(render);
  if (!DUO) return { tab: 'profile', html: duoSetupHTML() };
  if (DUO.phase === 'play' && !DUO_TICK) duoTimer();
  const body = DUO.phase === 'intro' ? `<div class="card center duo-paused"><h2>Runda ${DUO.round}: ${DUO_ROUNDS[DUO.round - 1][0]}</h2><p class="small muted">${DUO_ROUNDS[DUO.round - 1][1]}</p><button class="primary block" data-act="duo-round">▶ Zaczynamy</button></div>`
    : DUO.phase === 'roundEnd' ? duoRoundEndHTML() : DUO.phase === 'end' ? duoEndHTML() : duoPlayHTML();
  return { tab: 'profile', focus: true, html: `<div class="duo">${body}</div>` };
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
  <div class="row"><button class="sm" data-act="duo-export">⬇️ Eksport JSON</button><button class="sm" data-act="duo-import">⬆️ Import JSON</button></div>
  <p class="small muted">Eksport zapisuje plik tylko na tym urządzeniu – trzymaj go w katalogu <code>private/</code> (poza repozytorium).</p>
  ${L?.err ? `<p class="small" style="color:#dc2626">${esc(L.err)}</p>` : !L ? '<p class="muted">Wczytuję…</p>' : `<div class="card">${rows || '<p class="muted">Brak kart.</p>'}</div>`}`;
}
const duoClean = x => ({ type: x.type === 'forfeit' ? 'forfeit' : 'reward', round: [1, 2, 3, 4].includes(+x.round) ? +x.round : null, content: String(x.content || '').trim().slice(0, 500), active: x.active !== false });
async function duoDb(q, ok) { const r = await q; if (r.error) { toast('Błąd: ' + r.error.message, 4000); return false; } if (ok) toast(ok); await duoLoad(true); render(); return true; }
Object.assign(ACTIONS, {
  'duo-start': () => {
    if (!duoOn()) return; const P = duoPrefs();
    P.names = [0, 1].map(i => ($(`#duo-n${i}`).value || '').trim().slice(0, 20)); P.decks = [0, 1].map(i => $(`#duo-d${i}`).value); P.mins = [0, 1, 2].map(i => Math.max(1, Math.min(60, +$(`#duo-m${i}`).value || [10, 15, 15][i]))); save();
    duoStart(P.names.map((n, i) => n || 'Gracz ' + 'AB'[i]), P.decks, P.mins);
  },
  'duo-round': () => { const D = DUO; if (!D) return; if (D.phase === 'roundEnd') { D.round++; D.phase = 'intro'; return render(); } duoBeginRound(); },
  'duo-show': () => { if (DUO?.step) { DUO.step.shown = true; render(); } },
  'duo-ans': el => duoAnswer(el.dataset.v === '1'),
  'duo-lec': () => { if (DUO?.step) { DUO.step.endAt = Date.now() + DUO_LECTURE_S * 1000; render(); } },
  'duo-rate': el => duoRate(+el.dataset.n),
  'duo-pass': () => { if (DUO?.step?.k === 'card') { DUO.step.card = null; duoAfterCard(); } },   // pas: pomija kartę bez kary
  'duo-done': () => duoAfterCard(),
  'duo-pause': () => DUO && duoPause(),
  'duo-quit': async () => { if (!DUO) return go('#/duo'); if (DUO.phase !== 'end' && !await askBox({ title: 'Zakończyć sesję?', ok: 'Zakończ', cancel: 'Graj dalej' })) return; DUO.phase = 'end'; clearInterval(DUO_TICK); DUO_TICK = 0; render(); },
  'duo-reset': () => { DUO = null; clearInterval(DUO_TICK); DUO_TICK = 0; render(); },
  'duo-save': async () => {
    if (!duoOn()) return; const x = duoClean({ type: $('#duo-ft').value, round: $('#duo-fr').value, content: $('#duo-fc').value, active: DUO_ADM.edit ? DUO_ADM.edit.active : true });
    if (!x.content) return toast('Wpisz treść');
    const e = DUO_ADM.edit; DUO_ADM.edit = null;
    await duoDb(e ? SB.from('duo_cards').update(x).eq('id', e.id) : SB.from('duo_cards').insert(x), e ? 'Zapisano' : 'Dodano');
  },
  'duo-edit': el => { DUO_ADM.edit = duoList().find(c => c.id === +el.dataset.id) || null; render(); window.scrollTo(0, 0); },
  'duo-cancel': () => { DUO_ADM.edit = null; render(); },
  'duo-tog': el => { const c = duoList().find(x => x.id === +el.dataset.id); if (c) duoDb(SB.from('duo_cards').update({ active: !c.active }).eq('id', c.id)); },
  'duo-del': async el => { if (!await askBox({ title: 'Usunąć kartę?', ok: 'Usuń', danger: true })) return; duoDb(SB.from('duo_cards').delete().eq('id', +el.dataset.id), 'Usunięto'); },
  'duo-export': () => { if (!duoList().length) return toast('Brak kart'); download('duo_cards.json', JSON.stringify(duoList().map(({ id, type, round, content, active }) => ({ id, type, round, content, active })), null, 2), 'application/json'); },
  'duo-import': async () => {
    if (!duoOn()) return; const f = await pickFile('.json,application/json'); if (!f) return;
    let arr; try { arr = JSON.parse(await f.text()); } catch { return toast('To nie jest poprawny plik JSON'); }
    if (!Array.isArray(arr)) return toast('Plik musi zawierać listę kart');
    const rows = arr.map(x => ({ ...(Number.isInteger(x.id) ? { id: x.id } : {}), ...duoClean(x) })).filter(x => x.content);
    if (!rows.length) return toast('Brak kart w pliku');
    if (!await askBox({ title: `Zaimportować ${rows.length} kart?`, intro: 'Karty z tym samym id zostaną nadpisane.', ok: 'Importuj' })) return;
    const withId = rows.filter(r => r.id), noId = rows.filter(r => !r.id);
    if (withId.length && !await duoDb(SB.from('duo_cards').upsert(withId, { onConflict: 'id' }))) return;
    if (noId.length) await duoDb(SB.from('duo_cards').insert(noId));
    toast(`Zaimportowano ${rows.length}`);
  },
});
// jedyny link do trybu: w Panelu hosta, tylko dla właściciela
const duoHost0 = ROUTES.host;
ROUTES.host = (...a) => { const v = duoHost0(...a); if (!v?.html || !duoOn()) return v;
  return { ...v, html: v.html + '<div class="card row nowrap" data-go="#/duo" style="cursor:pointer;gap:12px"><b class="grow">Duo</b><span class="small muted">tryb we dwoje · karty</span><span>›</span></div>' }; };

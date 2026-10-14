'use strict';
/* 🎤 Teleturniej (BETA) – w stylu Buzz! / Brain Show, z lobby jak w Kahoot.
   Tryby: 🤖 solo z botami · 👥 lobby z PIN-em (host prowadzi grę, gracze dołączają ze swoich telefonów).
   4 rundy: ⚡ Szybkie palce · 💰 Wszystko albo nic · 🦊 Złodziej punktów · 🏔️ Finał (pula maleje).
   W lobby host liczy punkty i rozsyła stan gry (bez poprawnej odpowiedzi do czasu odkrycia), gracze wysyłają tylko swoje odpowiedzi.
   Host / solo: tylko z panelu hosta (beta). Dołączyć PIN-em może każdy. */

const SHOW_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#06b6d4', '#f97316'];
const SHOW_ANS = ['#2563eb', '#f97316', '#16a34a', '#eab308'];   // kolory przycisków odpowiedzi jak w Buzz!
const SHOW_BOTS = [['Robo-Rysiek', '🤖'], ['Profesor Sowa', '🦉'], ['Lisica Lena', '🦊'], ['Mózg Marek', '🧠'], ['Kot Bonifacy', '🐱']];
const SHOW_LEVELS = { easy: { name: 'Łatwi', acc: .5, fast: 1.25 }, mid: { name: 'Średni', acc: .68, fast: 1 }, hard: { name: 'Trudni', acc: .85, fast: .75 } };
const SHOW_ROUNDS = [
  { k: 'speed', icon: '⚡', name: 'Szybkie palce', n: 5, sec: 10, desc: 'Poprawna odpowiedź: do 1000 pkt – im szybciej, tym więcej.' },
  { k: 'bet', icon: '💰', name: 'Wszystko albo nic', n: 4, sec: 12, desc: 'Przed pytaniem obstawiasz 100, 250 albo 500. Dobrze: zyskujesz, źle: tracisz.' },
  { k: 'steal', icon: '🦊', name: 'Złodziej punktów', n: 4, sec: 10, desc: 'Najszybszy z poprawną odpowiedzią kradnie 300 pkt liderowi. Błąd: −100.' },
  { k: 'final', icon: '🏔️', name: 'Finał: odliczanie', n: 5, sec: 10, desc: 'Pula spada z 1500. Pierwszy poprawny bierze pulę – błędna odpowiedź blokuje Cię na to pytanie.' },
];
const SHOW_MAX = 8, BET_SEC = 10;
const HOST_LINES = {
  ok: ['Brawo!', 'Ależ refleks!', 'Tak jest!', 'Mistrzowsko!', 'Publiczność szaleje!'],
  bad: ['Ojej…', 'Niestety nie!', 'Blisko, ale nie!', 'Ups!', 'Następnym razem!'],
  slow: ['Czas minął!', 'Za wolno!', 'Tik-tak… koniec!'],
};
const pick = a => a[Math.random() * a.length | 0];
let SHOW = null;
const isHostRole = () => SHOW && (SHOW.role === 'solo' || SHOW.role === 'host');
const showMe = () => SHOW.players.find(p => p.id === SHOW.myId) || {};

function showSfx(kind) {
  try {
    const ac = typeof fxCtxGet === 'function' ? fxCtxGet() : null; if (!ac || typeof FX === 'undefined') return;
    if (kind === 'ok') fxNotes(ac, [784, 1047], { step: .08, type: 'triangle', v: .12, last: .3 });
    else if (kind === 'bad') fxTone(ac, { f: 300, f2: 140, type: 'sawtooth', d: .35, v: .08 });
    else if (kind === 'buzz') fxTone(ac, { f: 220, type: 'square', d: .18, v: .08, trem: .8, tremF: 30 });
    else if (kind === 'round') FX.fanfare(ac);
    else if (kind === 'join') fxNotes(ac, [660, 880], { step: .07, type: 'sine', v: .1, last: .2 });
    else if (kind === 'tick') fxTone(ac, { f: 1200, d: .05, v: .06 });
  } catch { /* */ }
}
function showQuestions(deckId, need) {
  const pool = battleCards(deckId, 200, 'qa', true).filter(c => c.opts && c.opts.length >= 3);
  if (!pool.length) return [];
  const out = []; while (out.length < need) out.push(...shuffle(pool.map(c => ({ ...c, opts: shuffle([...c.opts]) }))));
  return out.slice(0, need);
}
const selfPlayer = id => ({ id, name: (S.profile.nick || 'Ty').slice(0, 20), av: S.profile.avatar || '🦊', color: SHOW_COLORS[0], score: 0, me: true });
function makeBots(n, level, used) {
  const lv = SHOW_LEVELS[level] || SHOW_LEVELS.mid;
  return shuffle([...SHOW_BOTS]).slice(0, n).map(([name, av], i) => ({ id: 'bot' + i, name, av, bot: true, color: SHOW_COLORS[(used + i) % SHOW_COLORS.length], score: 0,
    acc: Math.min(.95, lv.acc + (Math.random() - .5) * .14), fast: lv.fast * (.85 + Math.random() * .3) }));
}
function newGame(o, players) {
  const total = SHOW_ROUNDS.reduce((a, r) => a + r.n, 0), qs = showQuestions(o.deckId, total);
  if (qs.length < 3) { toast('W tej talii za mało fiszek tekstowych z różnymi odpowiedziami (min. 4).', 4500); return false; }
  players.forEach(p => { p.score = 0; delete p.bet; });
  Object.assign(SHOW, { deckId: o.deckId, players, qs, qi: 0, r: 0, rq: 0, phase: 'intro', log: [], ans: {}, locked: {}, gain: {}, host: '' });
  return true;
}
function showStartSolo(o) {
  SHOW = { role: 'solo', myId: 'me', timers: [] };
  if (!newGame(o, [selfPlayer('me'), ...makeBots(o.bots, o.level, 1)])) { SHOW = null; return; }
  go('#/show'); setTimeout(() => showSfx('round'), 200);
}
const showRound = () => SHOW_ROUNDS[SHOW.r];
const showClear = () => { (SHOW.timers || []).forEach(clearTimeout); SHOW.timers = []; cancelAnimationFrame(SHOW.raf); };
const later = (fn, ms) => SHOW.timers.push(setTimeout(() => { if (SHOW) fn(); }, ms));

// ---------- 👥 lobby (host)
const newPin = () => String(100000 + Math.random() * 900000 | 0);
function showOpenLobby(o) {
  const pin = newPin();
  SHOW = { role: 'host', myId: 'me', pin, timers: [], phase: 'lobby', players: [selfPlayer('me')], opts: o, bots: 0 };
  SHOW.ch = channel('fiszki-show-' + pin, showHostMsg);
  go('#/show'); render();
}
function showHostMsg(m) {
  if (!SHOW || SHOW.role !== 'host') return;
  const pid = 'p' + m.from;
  if (m.t === 'join') {
    let p = SHOW.players.find(x => x.id === pid);
    if (!p) {
      if (SHOW.phase !== 'lobby') return SHOW.ch.send({ t: 'full', to: m.from, why: 'Gra już trwa' });
      if (SHOW.players.filter(x => !x.bot).length >= SHOW_MAX) return SHOW.ch.send({ t: 'full', to: m.from, why: 'Lobby pełne' });
      p = { id: pid, name: String(m.name || 'Gracz').slice(0, 20), av: String(m.av || '🙂').slice(0, 4), color: SHOW_COLORS[SHOW.players.length % SHOW_COLORS.length], score: 0, remote: true };
      SHOW.players.push(p); showSfx('join'); toast(`${p.av} ${p.name} dołącza!`, 1800);
    }
    p.left = false; showRender(); return;
  }
  const p = SHOW.players.find(x => x.id === pid); if (!p) return;
  if (m.t === 'ans' && SHOW.phase === 'question' && m.qi === SHOW.qi) showTakeAnswer(p, +m.k, Math.max(0, Math.min(+m.ms || 0, showRound().sec * 1000)));
  if (m.t === 'bet' && SHOW.phase === 'bet' && [100, 250, 500].includes(+m.v)) { p.bet = +m.v; showBetCheck(); }
  if (m.t === 'bye') { p.left = true; showRender(); }
}
// stan gry dla graczy – bez poprawnej odpowiedzi, dopóki nie nastąpi odkrycie
function showSnapshot() {
  const ph = SHOW.phase, q = SHOW.qs?.[SHOW.qi], R = SHOW_ROUNDS[SHOW.r] || {}, rev = ph === 'reveal';
  return { t: 'state', phase: ph, pin: SHOW.pin, r: SHOW.r, rq: SHOW.rq, qi: SHOW.qi,
    players: SHOW.players.map(p => ({ id: p.id, name: p.name, av: p.av, color: p.color, score: p.score, bet: p.bet, bot: !!p.bot, left: !!p.left })),
    q: q && (ph === 'question' || rev) ? { q: q.q, opts: q.opts, ...(rev ? { a: q.a } : {}) } : null,
    left: ph === 'question' ? Math.max(0, R.sec * 1000 - (Date.now() - SHOW.t0)) : ph === 'bet' ? Math.max(0, SHOW.betEnd - Date.now()) : 0,
    ans: Object.fromEntries(Object.entries(SHOW.ans || {}).map(([id, a]) => [id, rev ? { k: a.k } : { done: 1 }])),
    locked: SHOW.locked, gain: rev ? SHOW.gain : {}, host: SHOW.host, stealInfo: rev ? SHOW.stealInfo : '', winner: rev ? SHOW.winner : null, pool: SHOW.pool };
}
function showRender() { render(); if (SHOW?.role === 'host' && SHOW.ch) SHOW.ch.send(showSnapshot()); }

// ---------- 👤 gracz (dołączanie PIN-em)
function showJoin(pin) {
  pin = String(pin || '').replace(/\D/g, '');
  if (pin.length !== 6) return toast('PIN ma 6 cyfr');
  if (SHOW?.ch) SHOW.ch.close();
  SHOW = { role: 'guest', pin, myId: 'p' + MY_ID, phase: 'joining', players: [], timers: [], log: [], qs: {} };
  SHOW.ch = channel('fiszki-show-' + pin, showGuestMsg);
  const hello = () => { if (SHOW?.role === 'guest' && SHOW.phase === 'joining') { SHOW.ch.send({ t: 'join', name: S.profile.nick || 'Gracz', av: S.profile.avatar || '🙂' }); SHOW.tries = (SHOW.tries || 0) + 1; if (SHOW.tries < 8) later(hello, 2500); else { SHOW.phase = 'nohost'; render(); } } };
  hello(); go('#/show'); render();
}
function showGuestMsg(m) {
  if (!SHOW || SHOW.role !== 'guest') return;
  if (m.t === 'full' && m.to === MY_ID) { toast(m.why || 'Nie można dołączyć', 4000); SHOW.phase = 'nohost'; return render(); }
  if (m.t !== 'state') return;
  const prev = SHOW.phase, prevQi = SHOW.qi;
  if (m.phase === 'question' && (prev !== 'question' || prevQi !== m.qi)) { SHOW.myK = null; SHOW.lastTick = 0; }
  const R = SHOW_ROUNDS[m.r] || SHOW_ROUNDS[0];
  Object.assign(SHOW, m, { qs: { [m.qi]: m.q }, t0: m.phase === 'question' ? Date.now() - (R.sec * 1000 - m.left) : SHOW.t0, betEnd: m.phase === 'bet' ? Date.now() + m.left : SHOW.betEnd });
  SHOW.players.forEach(p => { p.me = p.id === SHOW.myId; });
  if (m.phase === 'reveal' && prev !== 'reveal' && m.q) {
    const myK = m.ans[SHOW.myId]?.k ?? SHOW.myK, ok = myK != null && m.q.opts[myK] === m.q.a;
    showSfx(ok && (m.gain[SHOW.myId] || 0) > 0 ? 'ok' : 'bad'); if (!ok) SHOW.log.push({ q: m.q.q, a: m.q.a });
  }
  if ((m.phase === 'round' || m.phase === 'end') && prev !== m.phase) { showSfx('round'); if (m.phase === 'end' && SHOW.players.slice().sort((a, b) => b.score - a.score)[0]?.id === SHOW.myId) confetti(200); }
  if (m.phase === 'question' && m.ans && Object.keys(m.ans).length > Object.keys(SHOW._ansN || {}).length) showSfx('buzz');
  SHOW._ansN = m.ans;
  render(); if (m.phase === 'question') showTimerLoop();
}

// ---------- silnik gry (host / solo)
function showAsk() {
  const R = showRound(), q = SHOW.qs[SHOW.qi];
  SHOW.phase = 'question'; SHOW.ans = {}; SHOW.t0 = Date.now(); SHOW.locked = {}; SHOW.winner = null; SHOW.host = ''; SHOW.myK = null;
  for (const p of SHOW.players.filter(p => p.bot)) {
    const ok = Math.random() < p.acc, wrongs = q.opts.map((_, k) => k).filter(k => q.opts[k] !== q.a);
    const k = ok ? q.opts.indexOf(q.a) : pick(wrongs), ms = Math.min(R.sec * 1000 - 300, (1400 + Math.random() * 5200) * p.fast);
    later(() => showTakeAnswer(p, k, ms), ms);
  }
  later(() => showTimeout(), R.sec * 1000 + (SHOW.role === 'host' ? 600 : 0));   // mały zapas na opóźnienia sieci
  showRender(); showTimerLoop();
}
function showTimerLoop() {
  cancelAnimationFrame(SHOW.raf);
  const R = showRound(), tick = () => {
    if (!SHOW || SHOW.phase !== 'question') return;
    const left = Math.max(0, R.sec * 1000 - (Date.now() - SHOW.t0)), bar = $('#show-timer');
    if (bar) bar.style.width = (left / (R.sec * 1000) * 100) + '%';
    const pool = $('#show-pool'); if (pool) pool.textContent = showPool();
    const s = Math.ceil(left / 1000); if (s <= 3 && s !== SHOW.lastTick && s > 0) { SHOW.lastTick = s; showSfx('tick'); }
    SHOW.raf = requestAnimationFrame(tick);
  };
  SHOW.raf = requestAnimationFrame(tick);
}
const showPool = () => Math.max(100, Math.round((1500 - (Date.now() - SHOW.t0) / 10000 * 1400) / 50) * 50);
const activePlayers = () => SHOW.players.filter(p => !p.left);
function showTakeAnswer(p, k, ms) {
  if (SHOW.phase !== 'question' || SHOW.ans[p.id] || SHOW.locked[p.id]) return;
  const R = showRound(), q = SHOW.qs[SHOW.qi];
  if (R.k === 'final' && SHOW.winner) return;
  SHOW.ans[p.id] = { k, ms }; if (!p.me) showSfx('buzz');
  if (R.k === 'final') {
    if (q.opts[k] === q.a) { SHOW.winner = p.id; SHOW.pool = Math.max(100, Math.round((1500 - ms / 10000 * 1400) / 50) * 50); return showReveal(); }
    SHOW.locked[p.id] = 1; if (p.me) { showSfx('bad'); SHOW.host = 'Zablokowany! Czekamy na resztę…'; }
  }
  if (activePlayers().every(x => SHOW.ans[x.id])) return showReveal();
  showRender();
}
function showTimeout() { if (SHOW.phase === 'question') { SHOW.host = pick(HOST_LINES.slow); showReveal(); } }
function showReveal() {
  showClear();
  const R = showRound(), q = SHOW.qs[SHOW.qi], good = k => q.opts[k] === q.a, gain = {};
  if (R.k === 'speed') for (const p of SHOW.players) { const a = SHOW.ans[p.id]; gain[p.id] = a && good(a.k) ? Math.round(500 + 500 * (1 - a.ms / (R.sec * 1000))) : 0; }
  if (R.k === 'bet') for (const p of SHOW.players) { const a = SHOW.ans[p.id], bet = p.bet || 100; gain[p.id] = a ? (good(a.k) ? bet : -bet) : -bet; }
  if (R.k === 'steal') {
    for (const p of SHOW.players) { const a = SHOW.ans[p.id]; gain[p.id] = a && !good(a.k) ? -100 : 0; }
    const fastest = SHOW.players.filter(p => SHOW.ans[p.id] && good(SHOW.ans[p.id].k)).sort((x, y) => SHOW.ans[x.id].ms - SHOW.ans[y.id].ms)[0];
    if (fastest) {
      const leader = SHOW.players.filter(p => p !== fastest).sort((x, y) => y.score - x.score)[0];
      const amt = leader ? Math.min(300, Math.max(0, leader.score)) : 0; gain[fastest.id] += 300; if (leader) gain[leader.id] = (gain[leader.id] || 0) - amt;
      SHOW.stealInfo = `${fastest.name} kradnie ${amt || 300} pkt${amt ? ' od ' + leader.name : ''}!`;
    } else SHOW.stealInfo = '';
  }
  if (R.k === 'final') for (const p of SHOW.players) gain[p.id] = SHOW.winner === p.id ? SHOW.pool : 0;
  for (const p of SHOW.players) p.score = Math.max(0, p.score + (gain[p.id] || 0));
  SHOW.gain = gain; SHOW.phase = 'reveal';
  const mine = SHOW.ans[SHOW.myId];
  if (!SHOW.host) SHOW.host = mine && good(mine.k) ? pick(HOST_LINES.ok) : mine ? pick(HOST_LINES.bad) : pick(HOST_LINES.slow);
  showSfx(mine && good(mine.k) && (gain[SHOW.myId] || 0) > 0 ? 'ok' : 'bad');
  if (!(mine && good(mine.k))) SHOW.log.push({ q: q.q, a: q.a });
  showRender();
  later(showNext, SHOW.role === 'host' ? 3500 : 2800);
}
function showNext() {
  if (SHOW.phase !== 'reveal') return;
  SHOW.qi++; SHOW.rq++;
  if (SHOW.rq >= showRound().n) {
    SHOW.r++; SHOW.rq = 0;
    if (SHOW.r >= SHOW_ROUNDS.length || SHOW.qi >= SHOW.qs.length) {
      SHOW.phase = 'end'; showSfx('round');
      confetti(SHOW.players.slice().sort((a, b) => b.score - a.score)[0].me ? 220 : 60); return showRender();
    }
    SHOW.phase = 'round'; showSfx('round'); return showRender();
  }
  if (showRound().k === 'bet') return showBetPhase();
  showAsk();
}
function showBetPhase() {
  SHOW.phase = 'bet'; SHOW.betEnd = Date.now() + BET_SEC * 1000;
  SHOW.players.forEach(p => { p.bet = p.bot ? pick([100, 250, 250, 500]) : undefined; });
  if (SHOW.role === 'host') later(() => { if (SHOW.phase === 'bet') { SHOW.players.forEach(p => { if (!p.bet) p.bet = 100; }); showAsk(); } }, BET_SEC * 1000);
  showRender();
}
function showBetCheck() { if (SHOW.phase === 'bet' && activePlayers().every(p => p.bet)) { showClear(); showAsk(); } else showRender(); }

// ---------- widoki
function showBoard(compact) {
  const lead = Math.max(...SHOW.players.map(p => p.score));
  return `<div class="sh-board${compact ? ' compact' : ''}${SHOW.players.length > 4 ? ' many' : ''}">${SHOW.players.map(p => {
    const a = SHOW.ans?.[p.id], g = SHOW.phase === 'reveal' ? SHOW.gain?.[p.id] : null;
    return `<div class="sh-pl${p.me ? ' me' : ''}${p.score === lead && lead > 0 ? ' lead' : ''}${p.left ? ' left' : ''}" style="--pc:${p.color}">
      <span class="sh-av">${p.me && S.profile.avatarImg ? `<img src="${safeImg(S.profile.avatarImg)}" alt="">` : esc(p.av)}${SHOW.phase === 'question' && a ? '<i class="sh-buzz">🔔</i>' : ''}${SHOW.locked?.[p.id] ? '<i class="sh-buzz">🔒</i>' : ''}${SHOW.phase === 'bet' && p.bet && !p.me ? '<i class="sh-buzz">💰</i>' : ''}</span>
      <b class="nm">${esc(p.name)}</b><span class="sh-sc">${p.score}</span>${g ? `<em class="${g > 0 ? 'up' : 'down'}">${g > 0 ? '+' : ''}${g}</em>` : ''}</div>`; }).join('')}</div>`;
}
const chipList = () => `<div class="sh-chips">${SHOW.players.map(p => `<span class="sh-chip${p.left ? ' left' : ''}" style="--pc:${p.color}">${esc(p.av)} ${esc(p.name)}${p.me ? ' (Ty)' : ''}${p.bot ? ' 🤖' : ''}</span>`).join('')}</div>`;
ROUTES.show = (parts, q) => {
  const admin = typeof hostUnlocked === 'function' && hostUnlocked();
  const head = (t, r = '') => `<div class="studybar"><button class="iconbtn" data-act="show-exit">✕</button><div class="title">${t}</div>${r}</div>`;
  if (!SHOW && q?.get('pin')) { setTimeout(() => showJoin(q.get('pin')), 0); }
  // --- start: dołącz PIN-em / (admin) graj z botami albo stwórz lobby
  if (!SHOW) {
    const o = S.settings.show = S.settings.show || { bots: 3, level: 'mid' };
    return { focus: true, html: `<div class="sh-stage setup">${head('🎤 Teleturniej <small class="beta-tag">BETA</small>')}
      <div class="sh-logo">🎤<b>Fiszkowy Show</b><small>4 rundy · pytania ABCD · jak Buzz! i Kahoot</small></div>
      <div class="card"><h3 style="margin-top:0">🔑 Dołącz do gry</h3><p class="small muted" style="margin-top:0">Wpisz PIN, który widzi prowadzący.</p>
        <div class="row nowrap"><input id="sh-pin" class="grow sh-pin-in" inputmode="numeric" maxlength="6" placeholder="PIN" value="${esc(q?.get('pin') || '')}"><button class="primary" data-act="show-join">Dołącz</button></div></div>
      ${admin ? `<div class="card"><label class="field"><span>Talia z pytaniami</span><select id="sh-deck">${S.decks.map(d => `<option value="${d.id}" ${o.deckId === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></label>
        <div class="grid2"><label class="field"><span>Boty</span><select id="sh-bots">${[0, 1, 2, 3].map(n => `<option value="${n}" ${o.bots === n ? 'selected' : ''}>${n ? `${n} ${plural(n, 'bot', 'boty', 'botów')}` : 'bez botów'}</option>`).join('')}</select></label>
          <label class="field"><span>Poziom botów</span><select id="sh-level">${Object.entries(SHOW_LEVELS).map(([k, l]) => `<option value="${k}" ${o.level === k ? 'selected' : ''}>${l.name}</option>`).join('')}</select></label></div>
        <div class="row"><button class="primary grow big-btn" data-act="show-lobby">👥 Stwórz lobby</button><button class="grow big-btn" data-act="show-go">🤖 Graj z botami</button></div>
        <details class="small" style="margin-top:10px"><summary>Zasady rund</summary><div class="sh-rounds">${SHOW_ROUNDS.map((r, i) => `<div><span>${r.icon}</span><b>Runda ${i + 1}: ${r.name}</b><small>${r.desc}</small></div>`).join('')}</div></details>
        <p class="small muted center" style="margin-bottom:0">Wersja testowa – bez nagród w kryształach.</p></div>` : ''}</div>` };
  }
  const R = showRound() || SHOW_ROUNDS[0], guest = SHOW.role === 'guest';
  // --- dołączanie / brak hosta
  if (SHOW.phase === 'joining' || SHOW.phase === 'nohost') {
    return { focus: true, html: `<div class="sh-stage">${head('🎤 Fiszkowy Show')}
      <div class="sh-wait">${SHOW.phase === 'joining' ? '<div class="spinner"></div><p>Łączę z grą <b>' + esc(SHOW.pin) + '</b>…</p>' : '<p>😕 Nie znaleziono gry o PIN-ie <b>' + esc(SHOW.pin) + '</b> albo gra już trwa.</p><button class="primary" data-act="show-exit">Wróć</button>'}</div></div>` };
  }
  // --- lobby
  if (SHOW.phase === 'lobby') {
    const humans = SHOW.players.filter(p => !p.bot).length;
    return { focus: true, html: `<div class="sh-stage">${head('👥 Lobby')}
      ${guest ? `<div class="sh-host">🎉 Jesteś w grze! Czekamy, aż prowadzący zacznie…</div>`
        : `<div class="sh-pinbox"><small>PIN gry</small><b>${SHOW.pin.slice(0, 3)} ${SHOW.pin.slice(3)}</b><span>Wejdź w Fiszki → Arena → 🎤 Teleturniej i wpisz PIN</span>
          <button class="sm" data-act="show-share">📤 Wyślij zaproszenie</button></div>`}
      <h3 class="center">Gracze (${SHOW.players.length})</h3>${chipList()}
      ${guest ? '<div class="sh-wait"><div class="spinner"></div></div>' : `<div class="card"><div class="grid2"><label class="field"><span>Dodaj boty</span><select id="sh-lbots">${[0, 1, 2, 3].map(n => `<option value="${n}" ${SHOW.bots === n ? 'selected' : ''}>${n || 'bez botów'}</option>`).join('')}</select></label>
          <label class="field"><span>Poziom</span><select id="sh-llevel">${Object.entries(SHOW_LEVELS).map(([k, l]) => `<option value="${k}" ${SHOW.opts.level === k ? 'selected' : ''}>${l.name}</option>`).join('')}</select></label></div>
        <button class="primary block big-btn" data-act="show-lobby-start" ${humans + SHOW.bots < 2 ? 'disabled' : ''}>▶ Start (${humans + SHOW.bots} ${plural(humans + SHOW.bots, 'gracz', 'graczy', 'graczy')})</button>
        ${humans + SHOW.bots < 2 ? '<p class="small muted center" style="margin-bottom:0">Poczekaj na gracza albo dodaj bota.</p>' : ''}</div>`}</div>` };
  }
  // --- intro / zapowiedź rundy
  if (SHOW.phase === 'intro' || SHOW.phase === 'round') {
    return { focus: true, html: `<div class="sh-stage">${head('🎤 Fiszkowy Show')}
      ${SHOW.phase === 'intro' ? `<div class="sh-host">🎤 <b>Witamy w Fiszkowym Show!</b><br>Dziś grają: ${SHOW.players.map(p => `<span style="color:${p.color}">${esc(p.name)}</span>`).join(', ')}. Powodzenia!</div>` : showBoard()}
      <div class="sh-roundcard"><small>Runda ${SHOW.r + 1} z ${SHOW_ROUNDS.length}</small><span>${R.icon}</span><b>${R.name}</b><p>${R.desc}</p></div>
      ${guest ? '<p class="center small">Prowadzący zaraz zaczyna…</p>' : `<button class="primary block big-btn" data-act="show-round-go">${SHOW.phase === 'intro' ? '▶ Start' : '▶ Dalej'}</button>`}</div>` };
  }
  // --- zakład (runda 2)
  if (SHOW.phase === 'bet') {
    const me = showMe();
    return { focus: true, html: `<div class="sh-stage">${head(`${R.icon} ${R.name}`, `<span class="small">${SHOW.rq + 1}/${R.n}</span>`)}${showBoard(true)}
      <div class="sh-host">🎤 ${me.bet ? `Postawione: <b>${me.bet}</b>. Czekamy na resztę…` : `Ile stawiasz? Masz <b>${me.score || 0}</b> pkt.`}</div>
      <div class="sh-bets">${[100, 250, 500].map(v => `<button class="${me.bet === v ? 'on' : ''}" data-act="show-bet" data-v="${v}" ${me.bet ? 'disabled' : ''}><b>${v}</b><small>pkt</small></button>`).join('')}</div></div>` };
  }
  // --- koniec: podium
  if (SHOW.phase === 'end') {
    const rank = SHOW.players.slice().sort((a, b) => b.score - a.score), myPlace = rank.findIndex(p => p.id === SHOW.myId) + 1;
    const pod = [rank[1], rank[0], rank[2]].filter(Boolean);
    return { focus: true, html: `<div class="sh-stage">${head('🏆 Wyniki')}
      <div class="sh-host">🎤 ${myPlace === 1 ? 'Mamy zwycięzcę – to Ty! 🎉' : myPlace === 2 ? 'Srebro! Było blisko!' : myPlace === 3 ? 'Brąz – podium jest Twoje!' : 'Dzięki za grę – rewanż?'}</div>
      <div class="sh-podium">${pod.map(p => { const place = rank.indexOf(p) + 1; return `<div class="sh-step p${place}" style="--pc:${p.color}"><span class="sh-av">${esc(p.av)}</span><b class="nm">${esc(p.name)}</b><small>${p.score} pkt</small><div class="sh-block">${['🥇', '🥈', '🥉'][place - 1]}</div></div>`; }).join('')}</div>
      ${rank.slice(3).map((p, i) => `<p class="center small">${i + 4}. ${esc(p.name)} – ${p.score} pkt</p>`).join('')}
      ${SHOW.log.length ? `<details class="card"><summary><b>Do powtórki (${SHOW.log.length})</b></summary>${SHOW.log.slice(0, 15).map(l => `<div class="qwrong"><div class="small">${fmt(l.q)}</div><b class="c-rev">${fmt(l.a)}</b></div>`).join('')}</details>` : ''}
      <div class="row">${guest ? '<p class="small muted grow">Prowadzący może zacząć kolejną grę w tym samym lobby.</p>' : `<button class="primary grow" data-act="show-again">🔁 Jeszcze raz</button>`}<button class="grow" data-act="show-exit">Zakończ</button></div></div>` };
  }
  // --- pytanie / odkrycie odpowiedzi
  const qq = SHOW.qs[SHOW.qi]; if (!qq) return { focus: true, html: `<div class="sh-stage">${head('🎤')}<div class="sh-wait"><div class="spinner"></div></div></div>` };
  const rev = SHOW.phase === 'reveal', mine = SHOW.ans?.[SHOW.myId], myK = mine?.k ?? SHOW.myK, answered = !!mine || SHOW.myK != null || SHOW.locked?.[SHOW.myId];
  return { focus: true, html: `<div class="sh-stage">${head(`${R.icon} ${R.name}`, `<span class="small">${SHOW.rq + 1}/${R.n}</span>`)}
    ${showBoard(true)}
    ${R.k === 'final' && !rev ? `<div class="sh-pool">Pula: <b><span id="show-pool">${showPool()}</span></b></div>` : ''}
    ${R.k === 'bet' && !rev ? `<div class="sh-pool">Twój zakład: <b>${showMe().bet || 100}</b></div>` : ''}
    <div class="sh-q">${fmt(qq.q)}</div>
    <div class="sh-timer"><div id="show-timer" style="width:${rev ? 0 : Math.max(0, (R.sec * 1000 - (Date.now() - SHOW.t0)) / (R.sec * 10))}%"></div></div>
    <div class="sh-opts">${qq.opts.map((o, k) => {
      const ok = rev && o === qq.a, who = rev ? SHOW.players.filter(p => SHOW.ans[p.id]?.k === k) : [];
      const cls = rev ? (ok ? ' ok' : myK === k ? ' bad' : ' dim') : myK === k ? ' picked' : '';
      return `<button class="sh-opt${cls}" style="--ac:${SHOW_ANS[k]}" data-act="show-ans" data-k="${k}" ${rev || answered ? 'disabled' : ''}>
        <i>${'ABCD'[k]}</i><span>${fmt(o)}</span>${rev ? `<em>${who.map(p => `<u style="background:${p.color}" title="${esc(p.name)}"></u>`).join('')}</em>` : ''}</button>`; }).join('')}</div>
    ${rev ? `<div class="sh-host">🎤 ${esc(SHOW.host)}${SHOW.stealInfo && R.k === 'steal' ? `<br><small>${esc(SHOW.stealInfo)}</small>` : ''}${R.k === 'final' && SHOW.winner ? `<br><small>${esc(SHOW.players.find(p => p.id === SHOW.winner)?.name || '')} bierze ${SHOW.pool} pkt!</small>` : ''}</div>`
      : answered && !rev ? `<div class="sh-host">🎤 ${SHOW.locked?.[SHOW.myId] ? 'Zablokowany! Czekamy na resztę…' : 'Odpowiedź przyjęta – czekamy na resztę…'}</div>` : SHOW.host ? `<div class="sh-host">🎤 ${esc(SHOW.host)}</div>` : ''}</div>` };
};

Object.assign(ACTIONS, {
  'show-open': () => { if (SHOW?.ch) SHOW.ch.close(); SHOW = null; go('#/show'); },
  'show-join': () => { if (typeof fxUnlock === 'function') fxUnlock(); showJoin($('#sh-pin').value); },
  'show-go': () => {
    const o = S.settings.show = { deckId: $('#sh-deck').value, bots: Math.max(1, +$('#sh-bots').value), level: $('#sh-level').value }; save();
    if (typeof fxUnlock === 'function') fxUnlock();
    showStartSolo(o);
  },
  'show-lobby': () => {
    const o = S.settings.show = { deckId: $('#sh-deck').value, bots: +$('#sh-bots').value, level: $('#sh-level').value }; save();
    if (typeof fxUnlock === 'function') fxUnlock();
    showOpenLobby(o);
  },
  'show-share': async () => {
    const url = location.href.split('#')[0] + '#/show?pin=' + SHOW.pin, text = `🎤 Zagraj ze mną w Fiszkowy Show! PIN: ${SHOW.pin}`;
    if (navigator.share) { try { await navigator.share({ title: 'Fiszkowy Show', text, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(`${text}\n${url}`); toast('Skopiowano zaproszenie'); } catch { prompt('Skopiuj:', url); }
  },
  'show-lobby-start': () => {
    if (!SHOW || SHOW.role !== 'host') return;
    const bots = makeBots(SHOW.bots, SHOW.opts.level, SHOW.players.length);
    if (!newGame(SHOW.opts, [...SHOW.players.filter(p => !p.bot && !p.left), ...bots])) return;
    showSfx('round'); showRender();
  },
  'show-round-go': () => { if (!isHostRole()) return; if (showRound().k === 'bet') showBetPhase(); else showAsk(); },
  'show-bet': el => {
    const v = +el.dataset.v;
    if (SHOW.role === 'guest') { const me = showMe(); me.bet = v; SHOW.ch.send({ t: 'bet', v }); return render(); }
    showMe().bet = v; showBetCheck();
  },
  'show-ans': el => {
    const k = +el.dataset.k; if (SHOW.phase !== 'question') return;
    if (SHOW.role === 'guest') { if (SHOW.myK != null) return; SHOW.myK = k; SHOW.ch.send({ t: 'ans', k, ms: Date.now() - SHOW.t0, qi: SHOW.qi }); return render(); }
    showTakeAnswer(showMe(), k, Date.now() - SHOW.t0);
  },
  'show-again': () => {
    if (SHOW.role === 'host') { showClear(); SHOW.phase = 'lobby'; SHOW.players = SHOW.players.filter(p => !p.bot && !p.left); SHOW.players.forEach(p => { p.score = 0; }); return showRender(); }
    const o = S.settings.show; showClear(); SHOW = null; showStartSolo(o);
  },
  'show-exit': () => {
    if (SHOW) { showClear(); if (SHOW.ch) { if (SHOW.role === 'guest') SHOW.ch.send({ t: 'bye' }); else SHOW.ch.send({ t: 'state', phase: 'nohost', players: [], pin: SHOW.pin }); SHOW.ch.close(); } }
    SHOW = null; go(typeof hostUnlocked === 'function' && hostUnlocked() ? '#/host' : '#/battles');
  },
});
// lobby: zmiana liczby botów / poziomu
document.addEventListener('change', e => {
  if (!SHOW || SHOW.role !== 'host' || SHOW.phase !== 'lobby') return;
  if (e.target.id === 'sh-lbots') { SHOW.bots = +e.target.value; showRender(); }
  if (e.target.id === 'sh-llevel') { SHOW.opts.level = e.target.value; }
});
window.addEventListener('hashchange', () => {
  if (SHOW && parseRoute().parts[0] !== 'show') { showClear(); if (SHOW.ch) { if (SHOW.role === 'guest') SHOW.ch.send({ t: 'bye' }); SHOW.ch.close(); } SHOW = null; }
});
// Arena → Bitwy: karta „Dołącz do teleturnieju” dla wszystkich
const shBattles0 = ROUTES.battles;
ROUTES.battles = (...a) => {
  const r = shBattles0(...a); if (!r?.html) return r;
  const card = `<div class="card row nowrap sh-cta" data-go="#/show"><span style="font-size:34px">🎤</span><div class="grow"><b>Teleturniej <small class="beta-tag">BETA</small></b>
    <div class="small muted">Dołącz PIN-em do gry znajomego – jak w Kahoot</div></div><span style="font-size:22px">›</span></div>`;
  const i = r.html.indexOf('<details class="card rules"');
  return { ...r, html: i < 0 ? r.html + card : r.html.slice(0, i) + card + r.html.slice(i) };
};

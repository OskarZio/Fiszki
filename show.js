'use strict';
/* 🎤 Teleturniej – 4 rundy, pytania z bazy (kategorie wybierane co rundę) albo z własnej talii.
   Tryby: 🤖 solo z botami · 👥 lobby z PIN-em (host prowadzi grę, gracze dołączają ze swoich telefonów).
   4 rundy: ⚡ Szybkie palce · 💰 Wszystko albo nic · 🦊 Złodziej punktów · 🎯 Finał: pojedynek (jak w Brain Show –
   punkty stają się życiem, najszybszy strzela w rywala, obrażenia rosną, wygrywa ostatni żywy).
   W lobby host liczy punkty i rozsyła stan gry (bez poprawnej odpowiedzi do czasu odkrycia), gracze wysyłają tylko swoje odpowiedzi.
   Baza pytań (qbank.json) ładuje się dopiero przy wejściu w teleturniej. */

const SHOW_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#06b6d4', '#f97316'];
const SHOW_ANS = ['#2563eb', '#f97316', '#16a34a', '#eab308'];   // kolory przycisków odpowiedzi
const SHOW_BOTS = [['Robo-Rysiek', '🤖'], ['Profesor Sowa', '🦉'], ['Lisica Lena', '🦊'], ['Mózg Marek', '🧠'], ['Kot Bonifacy', '🐱']];
const SHOW_LEVELS = { easy: { name: 'Łatwi', acc: .5, fast: 1.25 }, mid: { name: 'Średni', acc: .68, fast: 1 }, hard: { name: 'Trudni', acc: .85, fast: .75 } };
const SHOW_ROUNDS = [
  { k: 'speed', icon: '⚡', name: 'Szybkie palce', n: 5, sec: 15, desc: 'Poprawna odpowiedź: do 1000 pkt – im szybciej, tym więcej.' },
  { k: 'bet', icon: '💰', name: 'Wszystko albo nic', n: 4, sec: 17, desc: 'Przed pytaniem obstawiasz 100, 250 albo 500. Dobrze: zyskujesz, źle: tracisz.' },
  { k: 'steal', icon: '🦊', name: 'Złodziej punktów', n: 4, sec: 15, desc: 'Najszybszy z poprawną odpowiedzią kradnie 300 pkt liderowi. Błąd: −100.' },
  { k: 'final', icon: '🎯', name: 'Finał: pojedynek', n: 30, sec: 15, desc: 'Punkty z rund 1–3 zamieniają się w życie ❤️ (100 + 1 za każde 100 pkt). Kto pierwszy odpowie dobrze, strzela w wybranego rywala. Przez pierwsze 4 pytania obrażenia są stałe, potem rosną z każdym pytaniem. Co 4. pytanie to mini-runda 🧛 Wampir: trafienie zabiera rywalowi ❤️ i leczy Ciebie. Błąd kosztuje 10 ❤️. Wygrywa ostatni, kto przeżyje!' },
];
const QB_CATS = [
  ['ogolna', '🧠', 'Wiedza ogólna'], ['geo', '🌍', 'Geografia'], ['hist', '🏛️', 'Historia'], ['polska', '🇵🇱', 'Polska'],
  ['nauka', '🔬', 'Nauka i kosmos'], ['tech', '💻', 'Technologia'], ['zwierzeta', '🐾', 'Zwierzęta i przyroda'], ['kuchnia', '🍕', 'Jedzenie i kuchnia'],
  ['rap', '🎤', 'Rap i hip-hop'], ['muzyka', '🎵', 'Muzyka'], ['film', '🎬', 'Film i seriale'], ['gry', '🎮', 'Gry i internet'],
  ['sport', '⚽', 'Sport'], ['lit', '📖', 'Literatura i język'], ['bajki', '🧸', 'Bajki i dzieciństwo'],
].map(([id, icon, name]) => ({ id, icon, name }));
const qbCat = id => QB_CATS.find(c => c.id === id) || { id, icon: '🎲', name: 'Mix' };
let QB = null;
async function loadQBank() {
  if (!QB) { try { QB = await (await fetch('qbank.json')).json(); } catch { QB = null; } }
  return QB;
}
// pytania z kategorii: najpierw te, których dawno nie było (pamięć ostatnich ~800 na urządzeniu)
function qbTake(cat, n, used) {
  let seen; try { seen = new Set(JSON.parse(localStorage.getItem('showSeen') || '[]')); } catch { seen = new Set(); }
  const ids = cat === 'mix' ? Object.keys(QB) : [cat], all = [];
  ids.forEach(c => (QB[c] || []).forEach((x, i) => all.push({ id: c + i, x })));
  const fresh = shuffle(all.filter(o => !used.has(o.id) && !seen.has(o.id))), old = shuffle(all.filter(o => !used.has(o.id) && seen.has(o.id)));
  const out = [...fresh, ...old].slice(0, n).map(({ id, x }) => { used.add(id); seen.add(id); return { id, q: x[0], a: x[1], opts: shuffle(x.slice(1, 5)), d: x[5] }; });
  try { localStorage.setItem('showSeen', JSON.stringify([...seen].slice(-800))); } catch { /* */ }
  return out;
}
const SHOW_MAX = 8, PICK_SEC = 12, BET_SEC = 10, AIM_SEC = 8, WRONG_HP = 10;
// finał: życie z punktów, obrażenia rosną z każdym pytaniem (+ premia do 50% za szybkość)
const finalHp = score => (SHOW?.hpBase || 100) + Math.round(score / 100);
// tempo finału: obrażenia stałe przez „calm” pytań, potem rosną o „step”; premia za szybkość do „bonus”
const SHOW_PACE = {
  soft: { name: 'Łagodne', base: 10, step: 5, calm: 6, bonus: .25 },
  normal: { name: 'Normalne', base: 15, step: 5, calm: 5, bonus: .3 },
  hard: { name: 'Ostre', base: 20, step: 10, calm: 4, bonus: .5 },
};
const pace = () => SHOW_PACE[SHOW?.pace] || SHOW_PACE.normal;
const finalBase = rq => pace().base + pace().step * Math.max(0, rq - pace().calm + 1);
const finalDmg = (rq, ms) => Math.round(finalBase(rq) * (1 + pace().bonus * Math.max(0, 1 - (ms || 0) / (showRound().sec * 1000))) / 5) * 5;
// mini-runda 🧛 Wampir: co 4. pytanie finału trafienie leczy strzelającego o zadane obrażenia
const isVamp = rq => SHOW?.vamp !== false && (rq + 1) % 4 === 0;
const isFinal = () => showRound()?.k === 'final';
const alive = p => !p.left && !(p.hp != null && p.hp <= 0);
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
    else if (kind === 'shot') { fxTone(ac, { f: 900, f2: 120, type: 'sawtooth', d: .25, v: .1 }); fxTone(ac, { f: 90, f2: 40, type: 'square', d: .35, v: .12, t: .08 }); }
    else if (kind === 'hurt') fxTone(ac, { f: 160, f2: 60, type: 'square', d: .5, v: .14, trem: .9, tremF: 22 });
    else if (kind === 'tick') fxTone(ac, { f: 1200, d: .05, v: .06 });
  } catch { /* */ }
}
function showQuestions(deckId, need) {
  const pool = battleCards(deckId, 200, 'qa', true).filter(c => c.opts && c.opts.length >= 3);
  if (!pool.length) return [];
  const out = []; while (out.length < need) out.push(...shuffle(pool.map(c => ({ ...c, opts: shuffle([...c.opts]) }))));
  return out.slice(0, need);
}
const selfPlayer = id => ({ id, name: (S.profile.nick || 'Ty').slice(0, 20), av: S.profile.avatar || '🦊', color: SHOW_COLORS[0], score: 0, me: true, gif: typeof myWinGif === 'function' ? myWinGif() : null });
function makeBots(n, level, used) {
  const lv = SHOW_LEVELS[level] || SHOW_LEVELS.mid;
  return shuffle([...SHOW_BOTS]).slice(0, n).map(([name, av], i) => ({ id: 'bot' + i, name, av, bot: true, color: SHOW_COLORS[(used + i) % SHOW_COLORS.length], score: 0,
    acc: Math.min(.95, lv.acc + (Math.random() - .5) * .14), fast: lv.fast * (.85 + Math.random() * .3) }));
}
function newGame(o, players) {
  const cat = o.src !== 'deck';
  if (cat && !QB) { toast('Nie udało się wczytać bazy pytań – sprawdź internet.', 4000); return false; }
  const c = showCfg(), rounds = buildRounds(c);
  if (!rounds.length) { toast('Włącz co najmniej jedną rundę w ustawieniach gry'); return false; }
  const total = rounds.reduce((a, r) => a + r.n, 0), qs = cat ? [] : showQuestions(o.deckId, total);
  if (!cat && qs.length < 3) { toast('W tej talii za mało fiszek tekstowych z różnymi odpowiedziami (min. 4).', 4500); return false; }
  players.forEach(p => { p.score = 0; delete p.bet; delete p.hp; delete p.out; });
  Object.assign(SHOW, { rounds, pace: c.pace, hpBase: c.hp, vamp: c.vamp, deckId: o.deckId, src: cat ? 'cat' : 'deck', used: new Set(), cat: null, catsDone: [], rewarded: false, players, qs, qi: 0, r: 0, rq: 0, phase: 'intro', log: [], ans: {}, locked: {}, gain: {}, host: '', hit: null, shooter: null, outN: 0 });
  if (rounds[0].k === 'final') players.forEach(p => { p.hp = finalHp(0); });   // sam finał: wszyscy z tym samym życiem
  return true;
}
function showStartSolo(o) {
  SHOW = { role: 'solo', myId: 'me', timers: [] };
  if (!newGame(o, [selfPlayer('me'), ...makeBots(o.bots, o.level, 1)])) { SHOW = null; return; }
  go('#/show'); setTimeout(() => showSfx('round'), 200);
}
const showRound = () => (SHOW.rounds || SHOW_ROUNDS)[SHOW.r];
// ustawienia gry (prowadzący): które rundy, ile pytań, czas, tempo finału, życie na start, wampir
const SHOW_CFG_DEF = { on: { speed: true, bet: true, steal: true, final: true }, n: { speed: 5, bet: 4, steal: 4 }, sec: 15, pace: 'normal', hp: 100, vamp: true };
const showCfg = () => { const c = S.settings.show.cfg || {}; return { ...SHOW_CFG_DEF, ...c, on: { ...SHOW_CFG_DEF.on, ...c.on }, n: { ...SHOW_CFG_DEF.n, ...c.n } }; };
function buildRounds(c) {
  const P = SHOW_PACE[c.pace] || SHOW_PACE.normal;
  return SHOW_ROUNDS.filter(r => c.on[r.k]).map(r => ({ ...r, n: r.k === 'final' ? 30 : c.n[r.k] || r.n, sec: c.sec + (r.k === 'bet' ? 2 : 0),
    desc: r.k !== 'final' ? r.desc : `Punkty zamieniają się w życie ❤️ (${c.hp} + 1 za każde 100 pkt). Kto pierwszy odpowie dobrze, strzela w rywala. Obrażenia: ${P.base} przez ${P.calm} pytań, potem +${P.step} z każdym pytaniem.${c.vamp ? ' Co 4. pytanie 🧛 Wampir: trafienie leczy Ciebie.' : ''} Błąd: −10 ❤️. Wygrywa ostatni żywy!` }));
}
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
      p = { id: pid, name: String(m.name || 'Gracz').slice(0, 20), av: String(m.av || '🙂').slice(0, 4), color: SHOW_COLORS[SHOW.players.length % SHOW_COLORS.length], score: 0, remote: true, gif: typeof m.gif === 'string' ? m.gif.slice(0, 40) : null };
      SHOW.players.push(p); showSfx('join'); toast(`${p.av} ${p.name} dołącza!`, 1800);
    }
    p.left = false; showRender(); return;
  }
  const p = SHOW.players.find(x => x.id === pid); if (!p) return;
  if (m.t === 'ans' && SHOW.phase === 'question' && m.qi === SHOW.qi) showTakeAnswer(p, +m.k, Math.max(0, Math.min(+m.ms || 0, showRound().sec * 1000)));
  if (m.t === 'bet' && SHOW.phase === 'bet' && [100, 250, 500].includes(+m.v)) { p.bet = +m.v; showBetCheck(); }
  if (m.t === 'shoot' && SHOW.phase === 'aim' && SHOW.shooter === pid) showShoot(m.id);
  if (m.t === 'pick' && SHOW.phase === 'pick' && SHOW.picker === pid) showPickCat(m.c);
  if (m.t === 'bye') { p.left = true; if (SHOW.phase === 'aim' && SHOW.shooter === pid) showShoot(); else showRender(); }
}
// stan gry dla graczy – bez poprawnej odpowiedzi, dopóki nie nastąpi odkrycie
function showSnapshot() {
  const ph = SHOW.phase, q = SHOW.qs?.[SHOW.qi], R = (SHOW.rounds || SHOW_ROUNDS)[SHOW.r] || {}, rev = ph === 'reveal' || ph === 'aim';
  return { t: 'state', phase: ph, pin: SHOW.pin, r: SHOW.r, rq: SHOW.rq, qi: SHOW.qi,
    players: SHOW.players.map(p => ({ id: p.id, name: p.name, av: p.av, color: p.color, score: p.score, bet: p.bet, bot: !!p.bot, left: !!p.left, hp: p.hp, out: p.out, gif: p.gif })),
    rounds: SHOW.rounds, pace: SHOW.pace, hpBase: SHOW.hpBase, vamp: SHOW.vamp, shooter: SHOW.shooter, hit: SHOW.hit, src: SHOW.src, cat: SHOW.cat, picker: SHOW.picker, catOpts: SHOW.catOpts, pickLeft: ph === 'pick' ? Math.max(0, SHOW.pickEnd - Date.now()) : 0, aimEnd: ph === 'aim' ? Math.max(0, SHOW.aimEnd - Date.now()) : 0,
    q: q && (ph === 'question' || rev || ph === 'aim') ? { q: q.q, opts: q.opts, ...(rev || ph === 'aim' ? { a: q.a } : {}) } : null,
    left: ph === 'question' ? Math.max(0, R.sec * 1000 - (Date.now() - SHOW.t0)) : ph === 'bet' ? Math.max(0, SHOW.betEnd - Date.now()) : 0,
    ans: Object.fromEntries(Object.entries(SHOW.ans || {}).map(([id, a]) => [id, rev ? { k: a.k } : { done: 1 }])),
    locked: SHOW.locked, gain: rev ? SHOW.gain : {}, host: SHOW.host, stealInfo: rev ? SHOW.stealInfo : '', winner: rev ? SHOW.winner : null, dmg: SHOW.dmg };
}
function showRender() { render(); if (SHOW?.role === 'host' && SHOW.ch) SHOW.ch.send(showSnapshot()); }

// ---------- 👤 gracz (dołączanie PIN-em)
function showJoin(pin) {
  pin = String(pin || '').replace(/\D/g, '');
  if (pin.length !== 6) return toast('PIN ma 6 cyfr');
  if (SHOW?.ch) SHOW.ch.close();
  SHOW = { role: 'guest', pin, myId: 'p' + MY_ID, phase: 'joining', players: [], timers: [], log: [], qs: {} };
  SHOW.ch = channel('fiszki-show-' + pin, showGuestMsg);
  const hello = () => { if (SHOW?.role === 'guest' && SHOW.phase === 'joining') { SHOW.ch.send({ t: 'join', name: S.profile.nick || 'Gracz', av: S.profile.avatar || '🙂', gif: typeof myWinGif === 'function' ? myWinGif() : null }); SHOW.tries = (SHOW.tries || 0) + 1; if (SHOW.tries < 8) later(hello, 2500); else { SHOW.phase = 'nohost'; render(); } } };
  hello(); go('#/show'); render();
}
function showGuestMsg(m) {
  if (!SHOW || SHOW.role !== 'guest') return;
  if (m.t === 'full' && m.to === MY_ID) { toast(m.why || 'Nie można dołączyć', 4000); SHOW.phase = 'nohost'; return render(); }
  if (m.t !== 'state') return;
  const prev = SHOW.phase, prevQi = SHOW.qi;
  if (m.phase === 'question' && (prev !== 'question' || prevQi !== m.qi)) { SHOW.myK = null; SHOW.lastTick = 0; }
  const RS = m.rounds || SHOW_ROUNDS, R = RS[m.r] || RS[0];
  Object.assign(SHOW, m, { qs: { [m.qi]: m.q }, t0: m.phase === 'question' ? Date.now() - (R.sec * 1000 - m.left) : SHOW.t0, aimEnd: Date.now() + (m.aimEnd || 0), pickEnd: Date.now() + (m.pickLeft || 0), betEnd: m.phase === 'bet' ? Date.now() + m.left : SHOW.betEnd });
  SHOW.players.forEach(p => { p.me = p.id === SHOW.myId; });
  if (m.phase === 'reveal' && prev !== 'reveal' && m.q) {
    const myK = m.ans[SHOW.myId]?.k ?? SHOW.myK, ok = myK != null && m.q.opts[myK] === m.q.a;
    showSfx(ok && (m.gain[SHOW.myId] || 0) > 0 ? 'ok' : 'bad'); if (!ok) SHOW.log.push({ q: m.q.q, a: m.q.a });
  }
  if (m.hit && m.hit.k !== SHOW._hitK) { SHOW._hitK = m.hit.k; showSfx(m.hit.to === SHOW.myId ? 'hurt' : 'shot'); }
  if ((m.phase === 'round' || m.phase === 'end') && prev !== m.phase) { showSfx('round'); if (m.phase === 'end') { if (showRanking()[0]?.id === SHOW.myId) confetti(200); SHOW.rewarded = false; showReward(); showWinGifAll(); } }
  if (m.phase === 'question' && m.ans && Object.keys(m.ans).length > Object.keys(SHOW._ansN || {}).length) showSfx('buzz');
  SHOW._ansN = m.ans;
  render(); if (m.phase === 'question') showTimerLoop();
}

// ---------- silnik gry (host / solo)
function showAsk() {
  const R = showRound(), q = SHOW.qs[SHOW.qi];
  SHOW.phase = 'question'; SHOW.ans = {}; SHOW.t0 = Date.now(); SHOW.locked = {}; SHOW.winner = null; SHOW.host = ''; SHOW.myK = null;
  SHOW.hit = null; SHOW.shooter = null;
  for (const p of SHOW.players.filter(p => p.bot && alive(p))) {
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
    const s = Math.ceil(left / 1000); if (s <= 3 && s !== SHOW.lastTick && s > 0) { SHOW.lastTick = s; showSfx('tick'); }
    SHOW.raf = requestAnimationFrame(tick);
  };
  SHOW.raf = requestAnimationFrame(tick);
}
const activePlayers = () => SHOW.players.filter(alive);
function showTakeAnswer(p, k, ms) {
  if (SHOW.phase !== 'question' || SHOW.ans[p.id] || SHOW.locked[p.id]) return;
  const R = showRound(), q = SHOW.qs[SHOW.qi];
  if (R.k === 'final' && (SHOW.winner || !alive(p))) return;
  SHOW.ans[p.id] = { k, ms }; if (!p.me) showSfx('buzz');
  if (R.k === 'final') {
    if (q.opts[k] === q.a) { SHOW.winner = p.id; SHOW.dmg = finalDmg(SHOW.rq, ms); return showReveal(); }
    SHOW.locked[p.id] = 1; if (p.me) { showSfx('bad'); SHOW.host = `Pudło! −${WRONG_HP} ❤️ i blokada na to pytanie…`; }
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
  if (R.k === 'final') {
    for (const p of SHOW.players) { const a = SHOW.ans[p.id]; if (a && !good(a.k)) { gain[p.id] = -WRONG_HP; hurt(p, WRONG_HP); } }
  } else for (const p of SHOW.players) p.score = Math.max(0, p.score + (gain[p.id] || 0));
  SHOW.gain = gain; SHOW.phase = 'reveal';
  const mine = SHOW.ans[SHOW.myId];
  if (!SHOW.host) SHOW.host = mine && good(mine.k) ? pick(HOST_LINES.ok) : mine ? pick(HOST_LINES.bad) : pick(HOST_LINES.slow);
  showSfx(mine && good(mine.k) && (gain[SHOW.myId] || 0) > 0 ? 'ok' : 'bad');
  if (!(mine && good(mine.k))) SHOW.log.push({ q: q.q, a: q.a });
  // finał: najszybszy poprawny celuje w rywala
  const shooter = R.k === 'final' && SHOW.players.find(p => p.id === SHOW.winner);
  if (shooter && alive(shooter) && activePlayers().length > 1) {
    SHOW.phase = 'aim'; SHOW.shooter = shooter.id; SHOW.aimEnd = Date.now() + AIM_SEC * 1000;
    SHOW.host = shooter.me ? `🎯 Twój strzał! Obrażenia: ${SHOW.dmg}${isVamp(SHOW.rq) ? ' (+ tyle samo ❤️ dla Ciebie)' : ''} – w kogo celujesz?` : `🎯 ${shooter.name} celuje… (${SHOW.dmg} obrażeń)`;
    if (shooter.bot) later(() => showShoot(botTarget(shooter)), 1300 + Math.random() * 900);
    later(() => showShoot(), AIM_SEC * 1000 + (SHOW.role === 'host' ? 600 : 0));
    return showRender();
  }
  showRender();
  later(showNext, SHOW.role === 'host' ? 3500 : 2800);
}
function hurt(p, n) {
  if (p.hp == null || p.hp <= 0) return;
  p.hp = Math.max(0, p.hp - n);
  if (p.hp <= 0) p.out = ++SHOW.outN;
}
function botTarget(me) {
  const foes = activePlayers().filter(p => p !== me);
  const ko = foes.filter(p => p.hp <= SHOW.dmg);
  return (ko.length && Math.random() < .6 ? pick(ko) : foes.sort((a, b) => b.hp - a.hp)[0])?.id;
}
// strzał (brak celu / czas minął = w tego, kto ma najwięcej życia)
function showShoot(id) {
  if (SHOW.phase !== 'aim') return;
  showClear();
  const from = SHOW.players.find(p => p.id === SHOW.shooter), foes = activePlayers().filter(p => p !== from);
  const to = foes.find(p => p.id === id) || foes.sort((a, b) => b.hp - a.hp)[0];
  if (to) {
    const taken = Math.min(SHOW.dmg, to.hp), vamp = isVamp(SHOW.rq) && from && alive(from);
    hurt(to, SHOW.dmg);
    let heal = 0;
    if (vamp) { heal = Math.max(0, Math.min(taken, finalHp(from.score) - from.hp)); from.hp += heal; }
    SHOW.hit = { k: SHOW.qi, from: from?.id, to: to.id, dmg: SHOW.dmg, ko: to.hp <= 0, heal };
    SHOW.gain = { ...SHOW.gain, [to.id]: (SHOW.gain[to.id] || 0) - SHOW.dmg, ...(heal ? { [from.id]: (SHOW.gain[from.id] || 0) + heal } : {}) };
    SHOW.host = vamp ? `🧛 ${from.name} wysysa ${to.name}: −${SHOW.dmg} ❤️${heal ? `, sam odzyskuje +${heal} ❤️` : ' (ma już pełne życie)'}${to.hp <= 0 ? ` – ${to.name} odpada! 💀` : ''}`
      : `💥 ${from?.name || '?'} trafia ${to.name}: −${SHOW.dmg} ❤️${to.hp <= 0 ? ` – ${to.name} odpada! 💀` : ''}`;
    showSfx(to.id === SHOW.myId ? 'hurt' : 'shot');
  }
  SHOW.phase = 'reveal'; SHOW.shooter = null;
  showRender();
  later(showNext, SHOW.role === 'host' ? 3200 : 2600);
}
function showFinishGame() {
  SHOW.phase = 'end'; showSfx('round'); showReward();
  confetti(showRanking()[0]?.me ? 220 : 60); showRender(); showWinGifAll();
}
// GIF zwycięzcy na ekranie każdego gracza (zwycięzca widzi swoją reakcję „wygrana”)
function showWinGifAll() {
  const w = showRanking()[0]; if (!w) return;
  setTimeout(() => {
    if (w.id === SHOW?.myId) { if (typeof showReaction === 'function') showReaction('win'); }
    else if (!w.bot && typeof showWinnerGif === 'function') showWinnerGif(w.gif, w.name);
  }, 900);
}
// kolejność: kto przetrwał finał (najwięcej ❤️), potem kto odpadł później, na końcu punkty
const showRanking = () => SHOW.players.slice().sort((a, b) =>
  ((b.hp ?? 0) > 0) - ((a.hp ?? 0) > 0) || (b.hp > 0 && a.hp > 0 ? b.hp - a.hp : 0) || (b.out || 0) - (a.out || 0) || b.score - a.score);
function showNext() {
  if (SHOW.phase !== 'reveal') return;
  SHOW.qi++; SHOW.rq++;
  if (isFinal() && (activePlayers().length <= 1 || SHOW.qi >= SHOW.qs.length)) return showFinishGame();
  if (SHOW.rq >= showRound().n) {
    SHOW.r++; SHOW.rq = 0;
    if (SHOW.r >= SHOW.rounds.length || (SHOW.src === 'deck' && SHOW.qi >= SHOW.qs.length)) return showFinishGame();
    if (isFinal()) SHOW.players.forEach(p => { p.hp = p.left ? 0 : finalHp(p.score); });
    SHOW.phase = 'round'; showSfx('round'); return showRender();
  }
  if (showRound().k === 'bet') return showBetPhase();
  showAsk();
}
// start rundy: w trybie kategorii najpierw wybór kategorii (wybiera gracz z najmniejszą liczbą punktów)
function showBeginRound() {
  if (SHOW.src === 'cat') return showPickPhase();
  if (showRound().k === 'bet') return showBetPhase();
  showAsk();
}
function showPickPhase() {
  const act = activePlayers(), low = Math.min(...act.map(p => p.score));
  const cands = act.filter(p => p.score === low), humans = cands.filter(p => !p.bot);
  const picker = SHOW.r === 0 ? (act.find(p => p.id === SHOW.myId) || act[0]) : pick(humans.length ? humans : cands);
  const left = QB_CATS.filter(c => QB[c.id]?.length && !SHOW.catsDone.includes(c.id));
  SHOW.catOpts = shuffle(left.length >= 4 ? left : QB_CATS.filter(c => QB[c.id]?.length)).slice(0, 4).map(c => c.id);
  Object.assign(SHOW, { phase: 'pick', picker: picker.id, pickEnd: Date.now() + PICK_SEC * 1000, host: '' });
  if (picker.bot) later(() => showPickCat(pick(SHOW.catOpts)), 1500 + Math.random() * 1200);
  later(() => showPickCat(pick(SHOW.catOpts)), PICK_SEC * 1000 + (SHOW.role === 'host' ? 600 : 0));
  showRender();
}
function showPickCat(id) {
  if (SHOW.phase !== 'pick') return;
  if (id !== 'mix' && !SHOW.catOpts.includes(id)) return;
  showClear();
  const R = showRound(), add = qbTake(id, R.n, SHOW.used);
  SHOW.qs.length = SHOW.qi; SHOW.qs.push(...add);
  SHOW.cat = id; if (id !== 'mix') SHOW.catsDone.push(id);
  const c = qbCat(id), who = SHOW.players.find(p => p.id === SHOW.picker);
  toast(`${c.icon} ${c.name}${who ? ' – wybiera ' + who.name : ''}`, 1800); showSfx('join');
  if (R.k === 'bet') return showBetPhase();
  showAsk();
}
// nagroda w kryształach za miejsce (gra z min. 1 rywalem), max 60 💎 dziennie
function showReward() {
  if (!SHOW || SHOW.rewarded || SHOW.phase !== 'end') return 0;
  SHOW.rewarded = true;
  const rank = showRanking(), place = rank.findIndex(p => p.id === SHOW.myId) + 1;
  if (rank.length < 2 || !place) return 0;
  const base = [0, 20, 12, 6][place] || 2, t0 = dayStart();
  const today = S.wallet.filter(w => w.why === 'show' && w.t >= t0).reduce((a, w) => a + w.n, 0), n = Math.max(0, Math.min(base, 60 - today));
  if (n) { S.wallet.push({ id: uid(), n, why: 'show', t: Date.now() }); save(); }
  SHOW.myReward = n; return n;
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
  const hpMode = SHOW.players.some(p => p.hp != null), maxHp = Math.max(1, ...SHOW.players.map(p => finalHp(p.score)));
  const lead = hpMode ? Math.max(...SHOW.players.map(p => p.hp)) : Math.max(...SHOW.players.map(p => p.score));
  return `<div class="sh-board${compact ? ' compact' : ''}${SHOW.players.length > 4 ? ' many' : ''}">${SHOW.players.map(p => {
    const a = SHOW.ans?.[p.id], g = SHOW.phase === 'reveal' ? SHOW.gain?.[p.id] : null;
    const hit = SHOW.hit && SHOW.phase === 'reveal' && SHOW.hit.to === p.id, dead = hpMode && p.hp <= 0;
    return `<div class="sh-pl${p.me ? ' me' : ''}${(hpMode ? p.hp : p.score) === lead && lead > 0 ? ' lead' : ''}${p.left || dead ? ' left' : ''}${hit ? ' hit' : ''}${SHOW.shooter === p.id ? ' aim' : ''}" style="--pc:${p.color}">
      <span class="sh-av">${p.me && S.profile.avatarImg ? `<img src="${safeImg(S.profile.avatarImg)}" alt="">` : esc(p.av)}${SHOW.phase === 'question' && a ? '<i class="sh-buzz">🔔</i>' : ''}${SHOW.locked?.[p.id] ? '<i class="sh-buzz">🔒</i>' : ''}${SHOW.phase === 'bet' && p.bet && !p.me ? '<i class="sh-buzz">💰</i>' : ''}</span>
      <b class="nm">${esc(p.name)}</b>${hpMode ? `<span class="sh-sc">${dead ? '💀' : '❤️ ' + p.hp}</span><span class="sh-hp"><i style="width:${Math.min(100, Math.max(0, p.hp) / maxHp * 100)}%"></i></span>` : `<span class="sh-sc">${p.score}</span>`}${g ? `<em class="${g > 0 ? 'up' : 'down'}">${g > 0 ? '+' : ''}${g}</em>` : ''}</div>`; }).join('')}</div>`;
}
const chipList = () => `<div class="sh-chips">${SHOW.players.map(p => `<span class="sh-chip${p.left ? ' left' : ''}" style="--pc:${p.color}">${esc(p.av)} ${esc(p.name)}${p.me ? ' (Ty)' : ''}${p.bot ? ' 🤖' : ''}</span>`).join('')}</div>`;
ROUTES.show = (parts, q) => {
  const head = (t, r = '') => `<div class="studybar"><button class="iconbtn" data-act="show-exit">✕</button><div class="title">${t}</div>${r}</div>`;
  if (!SHOW && q?.get('pin')) { setTimeout(() => showJoin(q.get('pin')), 0); }
  // --- start: dołącz PIN-em / graj z botami albo stwórz lobby
  if (!SHOW) {
    const o = S.settings.show = S.settings.show || { bots: 3, level: 'mid', src: 'cat' }, deck = o.src === 'deck';
    return { focus: true, html: `<div class="sh-stage setup">${head('🎤 Teleturniej')}
      <div class="sh-logo">🎤<b>Fiszkowy Show</b><small>${(n => `${n} ${plural(n, 'runda', 'rundy', 'rund')}`)(buildRounds(showCfg()).length)} · ${QB_CATS.length} kategorii · ze znajomymi albo z botami</small></div>
      <div class="card"><h3 style="margin-top:0">🔑 Dołącz do gry</h3><p class="small muted" style="margin-top:0">Wpisz PIN, który widzi prowadzący.</p>
        <div class="row nowrap"><input id="sh-pin" class="grow sh-pin-in" inputmode="numeric" maxlength="6" placeholder="PIN" value="${esc(q?.get('pin') || '')}"><button class="primary" data-act="show-join">Dołącz</button></div></div>
      <div class="card"><h3 style="margin-top:0">🎬 Nowa gra</h3>
        <div class="sh-src"><button class="${deck ? '' : 'on'}" data-act="show-src" data-v="cat"><span>🧠</span><b>Kategorie</b><small>Wiedza ogólna, rap, muzyka, sport…</small></button>
          <button class="${deck ? 'on' : ''}" data-act="show-src" data-v="deck"><span>📚</span><b>Moje fiszki</b><small>Pytania z wybranej talii</small></button></div>
        ${deck ? `<label class="field"><span>Talia z pytaniami</span><select id="sh-deck">${S.decks.map(d => `<option value="${d.id}" ${o.deckId === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></label>`
          : `<div class="sh-catlist">${QB_CATS.map(c => `<span>${c.icon} ${c.name}</span>`).join('')}</div><p class="small muted" style="margin:4px 0 10px">Przed każdą rundą gracz z najmniejszą liczbą punktów wybiera kategorię.</p>`}
        ${showCfgHTML()}
        <div class="grid2"><label class="field"><span>Boty</span><select id="sh-bots">${[0, 1, 2, 3].map(n => `<option value="${n}" ${o.bots === n ? 'selected' : ''}>${n ? `${n} ${plural(n, 'bot', 'boty', 'botów')}` : 'bez botów'}</option>`).join('')}</select></label>
          <label class="field"><span>Poziom botów</span><select id="sh-level">${Object.entries(SHOW_LEVELS).map(([k, l]) => `<option value="${k}" ${o.level === k ? 'selected' : ''}>${l.name}</option>`).join('')}</select></label></div>
        <div class="row"><button class="primary grow big-btn" data-act="show-lobby">👥 Stwórz lobby</button><button class="grow big-btn" data-act="show-go">🤖 Graj z botami</button></div>
        <details class="small" style="margin-top:10px"><summary>Zasady rund</summary><div class="sh-rounds">${buildRounds(showCfg()).map((r, i) => `<div><span>${r.icon}</span><b>Runda ${i + 1}: ${r.name}</b><small>${r.desc}</small></div>`).join('')}</div></details>
        <p class="small muted center" style="margin-bottom:0">💎 Za podium: 20 / 12 / 6 kryształów (max 60 dziennie)</p></div></div>` };
  }
  const R = (SHOW.rounds && showRound()) || SHOW_ROUNDS[0], guest = SHOW.role === 'guest';
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
      <div class="sh-roundcard"><small>Runda ${SHOW.r + 1} z ${(SHOW.rounds || SHOW_ROUNDS).length}</small><span>${R.icon}</span><b>${R.name}</b><p>${R.desc}</p></div>
      ${guest ? '<p class="center small">Prowadzący zaraz zaczyna…</p>' : `<button class="primary block big-btn" data-act="show-round-go">${SHOW.phase === 'intro' ? '▶ Start' : '▶ Dalej'}</button>`}</div>` };
  }
  // --- zakład (runda 2)
  if (SHOW.phase === 'bet') {
    const me = showMe();
    return { focus: true, html: `<div class="sh-stage">${head(`${R.icon} ${R.name}`, `<span class="small">${SHOW.rq + 1}/${R.n}</span>`)}${showBoard(true)}
      <div class="sh-host">🎤 ${me.bet ? `Postawione: <b>${me.bet}</b>. Czekamy na resztę…` : `Ile stawiasz? Masz <b>${me.score || 0}</b> pkt.`}</div>
      <div class="sh-bets">${[100, 250, 500].map(v => `<button class="${me.bet === v ? 'on' : ''}" data-act="show-bet" data-v="${v}" ${me.bet ? 'disabled' : ''}><b>${v}</b><small>pkt</small></button>`).join('')}</div></div>` };
  }
  // --- wybór kategorii
  if (SHOW.phase === 'pick') {
    const who = SHOW.players.find(p => p.id === SHOW.picker), mine = SHOW.picker === SHOW.myId, left = Math.max(0, SHOW.pickEnd - Date.now());
    return { focus: true, html: `<div class="sh-stage">${head(`${R.icon} Runda ${SHOW.r + 1}: ${R.name}`)}${showBoard(true)}
      <div class="sh-host">🎤 ${mine ? '<b>Wybierz kategorię</b> na tę rundę!' : `<b style="color:${who?.color}">${esc(who?.name || '…')}</b> wybiera kategorię…`}</div>
      <div class="sh-timer"><div class="sh-pickbar" style="animation-duration:${left}ms"></div></div>
      <div class="sh-cats${mine ? '' : ' wait'}">${(SHOW.catOpts || []).map(id => { const c = qbCat(id); return `<button data-act="show-pick" data-c="${id}" ${mine ? '' : 'disabled'}><span>${c.icon}</span><b>${c.name}</b></button>`; }).join('')}
        <button class="mix" data-act="show-pick" data-c="mix" ${mine ? '' : 'disabled'}><span>🎲</span><b>Mix wszystkiego</b></button></div>
      ${mine ? `<p class="center small muted">Brak wyboru w ${PICK_SEC} s = losowa kategoria</p>` : ''}</div>` };
  }
  // --- finał: celowanie
  if (SHOW.phase === 'aim') {
    const sh = SHOW.players.find(p => p.id === SHOW.shooter), mineShot = SHOW.shooter === SHOW.myId, qq = SHOW.qs[SHOW.qi];
    const foes = SHOW.players.filter(p => alive(p) && p.id !== SHOW.shooter);
    return { focus: true, html: `<div class="sh-stage">${head(`${R.icon} ${R.name}`, `<span class="small">💥 ${SHOW.dmg}</span>`)}${showBoard(true)}
      ${isVamp(SHOW.rq) ? '<div class="sh-vamp">🧛 Mini-runda Wampir: ile zabierzesz, tyle odzyskasz</div>' : ''}
      ${qq ? `<p class="center small muted" style="margin:6px 0">${fmt(qq.q)} → <b class="c-rev">${fmt(qq.a)}</b></p>` : ''}
      <div class="sh-host">🎤 ${mineShot ? `🎯 <b>Twój strzał!</b> W kogo celujesz? (−${SHOW.dmg} ❤️)` : `🎯 <b>${esc(sh?.name || '?')}</b> celuje… (−${SHOW.dmg} ❤️)`}</div>
      ${mineShot ? `<div class="sh-targets">${foes.map(p => `<button data-act="show-shoot" data-id="${esc(p.id)}" style="--pc:${p.color}"><span>${esc(p.av)}</span><b>${esc(p.name)}</b><small>❤️ ${p.hp}${p.hp <= SHOW.dmg ? ' · 💀 KO!' : ''}</small></button>`).join('')}</div>
        <p class="center small muted">Brak wyboru w ${AIM_SEC} s = strzał w tego, kto ma najwięcej ❤️</p>` : '<div class="sh-wait"><div class="sh-crosshair">🎯</div></div>'}</div>` };
  }
  // --- koniec: podium
  if (SHOW.phase === 'end') {
    const rank = showRanking(), myPlace = rank.findIndex(p => p.id === SHOW.myId) + 1;
    const pod = [rank[1], rank[0], rank[2]].filter(Boolean);
    return { focus: true, html: `<div class="sh-stage">${head('🏆 Wyniki')}
      <div class="sh-host">🎤 ${myPlace === 1 ? (rank[0].hp > 0 ? 'Ostatni na placu boju – wygrywasz! 🎉' : 'Mamy zwycięzcę – to Ty! 🎉') : myPlace === 2 ? 'Srebro! Było blisko!' : myPlace === 3 ? 'Brąz – podium jest Twoje!' : 'Dzięki za grę – rewanż?'}</div>
      <div class="sh-podium">${pod.map(p => { const place = rank.indexOf(p) + 1; return `<div class="sh-step p${place}" style="--pc:${p.color}"><span class="sh-av">${esc(p.av)}</span><b class="nm">${esc(p.name)}</b><small>${p.hp > 0 ? '❤️ ' + p.hp : (p.hp != null ? '💀 ' : '') + p.score + ' pkt'}</small><div class="sh-block">${['🥇', '🥈', '🥉'][place - 1]}</div></div>`; }).join('')}</div>
      ${SHOW.myReward ? `<p class="center sh-rew">+${SHOW.myReward} 💎 za ${myPlace}. miejsce</p>` : ''}
      ${rank.slice(3).map((p, i) => `<p class="center small">${i + 4}. ${esc(p.name)} – ${p.hp > 0 ? '❤️ ' + p.hp : '💀'} · ${p.score} pkt</p>`).join('')}
      ${SHOW.log.length ? `<details class="card"><summary><b>Do powtórki (${SHOW.log.length})</b></summary>${SHOW.log.slice(0, 15).map(l => `<div class="qwrong"><div class="small">${fmt(l.q)}</div><b class="c-rev">${fmt(l.a)}</b></div>`).join('')}</details>` : ''}
      <div class="row">${guest ? '<p class="small muted grow">Prowadzący może zacząć kolejną grę w tym samym lobby.</p>' : `<button class="primary grow" data-act="show-again">🔁 Jeszcze raz</button>`}<button class="grow" data-act="show-exit">Zakończ</button></div></div>` };
  }
  // --- pytanie / odkrycie odpowiedzi
  const qq = SHOW.qs[SHOW.qi]; if (!qq) return { focus: true, html: `<div class="sh-stage">${head('🎤')}<div class="sh-wait"><div class="spinner"></div></div></div>` };
  const rev = SHOW.phase === 'reveal', mine = SHOW.ans?.[SHOW.myId], myK = mine?.k ?? SHOW.myK, dead = R.k === 'final' && showMe().hp != null && showMe().hp <= 0, answered = !!mine || SHOW.myK != null || SHOW.locked?.[SHOW.myId] || dead;
  return { focus: true, html: `<div class="sh-stage">${head(`${R.icon} ${R.name}`, `<span class="small">${R.k === 'final' ? `#${SHOW.rq + 1}` : `${SHOW.rq + 1}/${R.n}`}</span>`)}
    ${showBoard(true)}
    ${R.k === 'final' && !rev ? `${isVamp(SHOW.rq) ? '<div class="sh-vamp">🧛 Mini-runda Wampir! Trafienie zabiera rywalowi ❤️ i leczy Ciebie</div>' : ''}
      <div class="sh-pool">💥 Obrażenia: <b>${finalBase(SHOW.rq)}–${finalDmg(SHOW.rq, 0)}</b> <small>${SHOW.rq < pace().calm - 1 ? `(rosną od pytania #${pace().calm + 1})` : '(rosną z każdym pytaniem · im szybciej, tym mocniej)'}</small></div>` : ''}
    ${R.k === 'bet' && !rev ? `<div class="sh-pool">Twój zakład: <b>${showMe().bet || 100}</b></div>` : ''}
    ${SHOW.src === 'cat' && SHOW.cat ? `<div class="sh-catchip">${qbCat(SHOW.cat).icon} ${qbCat(SHOW.cat).name}</div>` : ''}
    <div class="sh-q">${fmt(qq.q)}</div>
    <div class="sh-timer"><div id="show-timer" style="width:${rev ? 0 : Math.max(0, (R.sec * 1000 - (Date.now() - SHOW.t0)) / (R.sec * 10))}%"></div></div>
    <div class="sh-opts">${qq.opts.map((o, k) => {
      const ok = rev && o === qq.a, who = rev ? SHOW.players.filter(p => SHOW.ans[p.id]?.k === k) : [];
      const cls = rev ? (ok ? ' ok' : myK === k ? ' bad' : ' dim') : myK === k ? ' picked' : '';
      return `<button class="sh-opt${cls}" style="--ac:${SHOW_ANS[k]}" data-act="show-ans" data-k="${k}" ${rev || answered ? 'disabled' : ''}>
        <i>${'ABCD'[k]}</i><span>${fmt(o)}</span>${rev ? `<em>${who.map(p => `<u style="background:${p.color}" title="${esc(p.name)}"></u>`).join('')}</em>` : ''}</button>`; }).join('')}</div>
    ${rev ? `<div class="sh-host">🎤 ${esc(SHOW.host)}${SHOW.stealInfo && R.k === 'steal' ? `<br><small>${esc(SHOW.stealInfo)}</small>` : ''}</div>`
      : answered && !rev ? `<div class="sh-host">🎤 ${dead ? '💀 Odpadłeś – oglądasz finał do końca.' : SHOW.locked?.[SHOW.myId] ? `Pudło! −${WRONG_HP} ❤️ – czekamy na resztę…` : 'Odpowiedź przyjęta – czekamy na resztę…'}</div>` : SHOW.host ? `<div class="sh-host">🎤 ${esc(SHOW.host)}</div>` : ''}</div>` };
};

const showOpts = solo => ({ cfg: S.settings.show?.cfg, src: S.settings.show?.src === 'deck' ? 'deck' : 'cat', deckId: $('#sh-deck')?.value || S.settings.show?.deckId,
  bots: solo ? Math.max(1, +$('#sh-bots').value) : +$('#sh-bots').value, level: $('#sh-level').value });
Object.assign(ACTIONS, {
  'show-open': () => { if (SHOW?.ch) SHOW.ch.close(); SHOW = null; go('#/show'); },
  'show-join': () => { if (typeof fxUnlock === 'function') fxUnlock(); showJoin($('#sh-pin').value); },
  'show-go': async () => {
    const o = S.settings.show = showOpts(true); save();
    if (typeof fxUnlock === 'function') fxUnlock();
    if (o.src !== 'deck') await loadQBank();
    showStartSolo(o);
  },
  'show-lobby': async () => {
    const o = S.settings.show = showOpts(false); save();
    if (typeof fxUnlock === 'function') fxUnlock();
    if (o.src !== 'deck') await loadQBank();
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
  'show-round-go': () => { if (!isHostRole()) return; showBeginRound(); },
  'show-pick': el => {
    if (SHOW?.phase !== 'pick' || SHOW.picker !== SHOW.myId) return;
    if (SHOW.role === 'guest') { SHOW.ch.send({ t: 'pick', c: el.dataset.c }); SHOW.picker = null; return render(); }
    showPickCat(el.dataset.c);
  },
  'show-cfg-reset': () => { delete S.settings.show.cfg; save(); render(); const d = $('.sh-cfg'); if (d) d.open = true; },
  'show-src': el => { S.settings.show = { ...S.settings.show, src: el.dataset.v }; save(); render(); },
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
  'show-shoot': el => {
    if (SHOW?.phase !== 'aim' || SHOW.shooter !== SHOW.myId) return;
    if (SHOW.role === 'guest') { SHOW.ch.send({ t: 'shoot', id: el.dataset.id }); SHOW.host = 'Strzał oddany!'; SHOW.shooter = null; return render(); }
    showShoot(el.dataset.id);
  },
  'show-again': () => {
    if (SHOW.role === 'host') { showClear(); SHOW.phase = 'lobby'; SHOW.players = SHOW.players.filter(p => !p.bot && !p.left); SHOW.players.forEach(p => { p.score = 0; delete p.hp; delete p.out; }); return showRender(); }
    const o = S.settings.show; showClear(); SHOW = null; showStartSolo(o);
  },
  'show-exit': () => {
    if (SHOW) { showClear(); if (SHOW.ch) { if (SHOW.role === 'guest') SHOW.ch.send({ t: 'bye' }); else SHOW.ch.send({ t: 'state', phase: 'nohost', players: [], pin: SHOW.pin }); SHOW.ch.close(); } }
    SHOW = null; go('#/battles');
  },
});
function showCfgHTML() {
  const c = showCfg(), opt = (v, cur, label = v) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${label}</option>`;
  return `<details class="sh-cfg"><summary>⚙️ Ustawienia gry <small>(${buildRounds(c).length} rundy · ${c.sec} s · finał ${(SHOW_PACE[c.pace] || SHOW_PACE.normal).name.toLowerCase()})</small></summary>
    ${SHOW_ROUNDS.map(r => `<div class="sh-cfg-row"><label class="row nowrap grow"><input type="checkbox" data-shcfg="on.${r.k}" ${c.on[r.k] ? 'checked' : ''}><span>${r.icon} ${r.name}</span></label>
      ${r.k === 'final' ? '<small class="muted">do ostatniego żywego</small>' : `<select data-shcfg="n.${r.k}" ${c.on[r.k] ? '' : 'disabled'}>${[3, 4, 5, 6, 8, 10].map(n => opt(n, c.n[r.k], n + ' pyt.')).join('')}</select>`}</div>`).join('')}
    <div class="grid2"><label class="field"><span>Czas na odpowiedź</span><select data-shcfg="sec">${[10, 15, 20, 25, 30].map(v => opt(v, c.sec, v + ' s')).join('')}</select></label>
      <label class="field"><span>Tempo finału</span><select data-shcfg="pace" ${c.on.final ? '' : 'disabled'}>${Object.entries(SHOW_PACE).map(([k, p]) => opt(k, c.pace, `${p.name} (${p.base} → +${p.step})`)).join('')}</select></label>
      <label class="field"><span>Życie na start finału</span><select data-shcfg="hp" ${c.on.final ? '' : 'disabled'}>${[75, 100, 150, 200].map(v => opt(v, c.hp, v + ' ❤️')).join('')}</select></label>
      <label class="field"><span>🧛 Wampir co 4. pytanie</span><select data-shcfg="vamp" ${c.on.final ? '' : 'disabled'}>${opt('1', c.vamp ? '1' : '0', 'włączony')}${opt('0', c.vamp ? '1' : '0', 'wyłączony')}</select></label></div>
    <button class="sm ghost" data-act="show-cfg-reset">↺ Domyślne</button></details>`;
}
document.addEventListener('change', e => {
  const key = e.target.dataset?.shcfg; if (!key) return;
  const c = showCfg(), [a, b] = key.split('.'), v = e.target.type === 'checkbox' ? e.target.checked : a === 'pace' ? e.target.value : a === 'vamp' ? e.target.value === '1' : +e.target.value;
  if (b) c[a][b] = v; else c[a] = v;
  if (!Object.values(c.on).some(Boolean)) { toast('Musi zostać co najmniej jedna runda'); c.on[b] = true; }
  S.settings.show.cfg = c; save();
  const open = !!$('.sh-cfg')?.open; render(); if (open) { const d = $('.sh-cfg'); if (d) d.open = true; }
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
  const card = `<div class="card row nowrap sh-cta" data-go="#/show"><span style="font-size:34px">🎤</span><div class="grow"><b>Teleturniej</b>
    <div class="small muted">Wiedza ogólna, rap, muzyka, sport… Graj z botami albo ze znajomymi (PIN)</div></div><span style="font-size:22px">›</span></div>`;
  const i = r.html.indexOf('<details class="card rules"');
  return { ...r, html: i < 0 ? r.html + card : r.html.slice(0, i) + card + r.html.slice(i) };
};

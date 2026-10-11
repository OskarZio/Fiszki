'use strict';
/* Bitwy 1 na 1 w czasie rzeczywistym.
   - Tryb „Fiszki”: obaj dostają ten sam zestaw. Najpierw przeglądają fiszki jedna po drugiej (odwracając je),
     a gdy są gotowi – test z pamięci (wpisując albo mówiąc). Każda dobra odpowiedź zadaje przeciwnikowi obrażenia.
   - Tryb „Pamięć”: ten sam ciąg liczb/słów/obrazów u obu graczy (wspólne ziarno losowania), rozliczenie na końcu.
   - Gospodarz ustawia zasady: limity czasu (albo bez limitu), dokładność sprawdzania, kierunek, widoczność wyniku, sabotaże.
   Wiadomości idą przez publiczny przekaźnik ntfy.sh (losowy kanał pokoju).
   Każdy klient sam sprawdza odpowiedzi przeciwnika na podstawie własnej kopii zestawu – nie ufa wynikowi „z drugiej strony”. */

const RELAY = 'https://ntfy.sh';
const LOBBY = 'fiszki-lobby-v1';
const MY_ID = uid() + uid();
let B = null;            // bieżąca bitwa
// Bot: [nazwa, bazowa skuteczność (null = dopasowany do Ciebie), czas odpowiedzi w s]
const BOT_LEVELS = [['Dopasowany', null, [3, 8]], ['Łatwy', .4, [5, 11]], ['Średni', .58, [4, 9]], ['Trudny', .74, [3, 7]], ['Ekspert', .88, [2, 5]]];
function myBattleAccuracy() {
  const recent = S.battles.slice(-10).filter(b => b.n);
  return recent.length ? recent.reduce((a, b) => a + b.my / b.n, 0) / recent.length : .6;
}
function botParams(level) {
  const [name, base, speed] = BOT_LEVELS[level] || BOT_LEVELS[0];
  const acc = base ?? clamp(myBattleAccuracy() + (Math.random() - .5) * .16, .3, .9);
  return { name, acc, a: speed[0], b: speed[1] };
}
// Bot „zapomina” jak człowiek: im więcej materiału i im krócej się uczył, tym więcej błędów
function botCardChance(acc, n, learnMs, answerLen) {
  const load = 1 - Math.min(.35, Math.max(0, n - 5) * .012);
  const time = clamp(learnMs / (n * 7000), .55, 1.05);
  const len = answerLen > 25 ? .8 : answerLen > 12 ? .92 : 1;
  return clamp(acc * load * time * len, .05, .97);
}
function typo(s) {
  if (!s || s.length < 3 || Math.random() < .35) return Math.random() < .5 ? '' : 'nie wiem';
  const a = [...s], i = 1 + (Math.random() * (a.length - 2) | 0);
  Math.random() < .5 ? a.splice(i, 1) : ([a[i], a[i - 1]] = [a[i - 1], a[i]]);
  return a.join('').slice(0, Math.max(2, a.length - (Math.random() < .3 ? 3 : 0)));
}
// ============================================================ Elo
const ELO_START = 1000;
const myElo = () => ELO_START + S.battles.reduce((a, b) => a + (b.elo || 0), 0);
const ELO_TIERS = [[0, '🥉', 'Brąz'], [1000, '🥈', 'Srebro'], [1150, '🥇', 'Złoto'], [1300, '💠', 'Platyna'], [1450, '💎', 'Diament'], [1600, '👑', 'Mistrz']];
const eloTier = e => [...ELO_TIERS].reverse().find(t => e >= t[0]);
const eloHTML = e => { const t = eloTier(e); return `<span class="elo">${t[1]} ${e} <small>${t[2]}</small></span>`; };
function eloDelta(mine, theirs, won, games) {
  const exp = 1 / (1 + 10 ** ((theirs - mine) / 400)), score = won === 1 ? 1 : won === 0 ? .5 : 0;
  return Math.round((games < 10 ? 40 : 24) * (score - exp));
}
const MEM_DEFAULT = { numbers: [40, 60], words: [20, 60], images: [20, 60], cards: [26, 120] };
const SABOTAGE = {
  freeze: { icon: '❄️', name: 'Zamrożenie', desc: 'przeciwnik nic nie może zrobić przez 5 s', cost: 30 },
  fog: { icon: '🌫️', name: 'Mgła', desc: 'rozmywa pytanie przeciwnika na 7 s', cost: 20 },
  undo: { icon: '⏪', name: 'Cofnięcie', desc: 'ostatnia dobra odpowiedź przeciwnika przepada – musi ją odtworzyć jeszcze raz', cost: 50, cardsOnly: true },
  shield: { icon: '🛡️', name: 'Tarcza', desc: 'blokuje następny sabotaż przeciwnika', cost: 30, self: true },
};
const SAB_MAX = 3, SAB_COOLDOWN = 8000;
const BT_DEFAULTS = { n: 10, learnSec: 0, ansSec: 25, tol: 'normal', dir: 'qa', live: true, sab: true, memN: 0, memSec: 60 };
const btOpts = () => ({ ...BT_DEFAULTS, ...(memSettings().bt || {}) });

// ============================================================ Kanał komunikacji
function channel(topic, onMsg) {
  const handle = m => { if (!m || m.from === MY_ID) return; onMsg(m); };
  const chunks = {};
  const recv = m => {
    if (m.t !== 'chunk') return handle(m);
    const c = chunks[m.cid] || (chunks[m.cid] = []); c[m.i] = m.d;
    if (c.filter(x => x != null).length === m.n) { delete chunks[m.cid]; try { handle(JSON.parse(c.join(''))); } catch { /* */ } }
  };
  if (!window.BATTLE_LOCAL && typeof SB !== 'undefined' && SB) return sbChannel(topic, recv);   // Supabase Realtime, gdy podłączone
  if (window.BATTLE_LOCAL) {   // test lokalny: dwie karty przeglądarki
    const bc = new BroadcastChannel('fb-' + topic); bc.onmessage = e => recv(e.data);
    return { send: m => bc.postMessage({ ...m, from: MY_ID }), close: () => bc.close() };
  }
  const since = Math.floor(Date.now() / 1000) - 3;
  let es, closed = false;
  const open = () => {
    es = new EventSource(`${RELAY}/${topic}/sse?since=${since}`);
    es.onmessage = e => { try { const d = JSON.parse(e.data); if (d.event === 'message') recv(JSON.parse(d.message)); } catch { /* */ } };
    es.onerror = () => { if (!closed && es.readyState === 2) setTimeout(open, 2000); };
  };
  open();
  const post = m => fetch(`${RELAY}/${topic}`, { method: 'POST', body: JSON.stringify(m) }).catch(() => setTimeout(() => post(m), 1500));
  return {
    send: m => {
      const s = JSON.stringify({ ...m, from: MY_ID });
      if (s.length < 900) return post({ ...m, from: MY_ID });
      const cid = uid(), parts = s.match(/[\s\S]{1,900}/g);
      parts.forEach((d, i) => post({ t: 'chunk', cid, i, n: parts.length, d, from: MY_ID }));
    },
    close: () => { closed = true; es?.close(); },
  };
}
const me = () => ({ elo: myElo(), nick: S.profile.nick || 'Gracz', avatar: S.profile.avatar || '🦊', avatarImg: safeImg(S.profile.avatarImg), level: levelOf(xpTotal()), showcase: S.profile.showcase || [] });
const roomCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.random() * 32 | 0]).join('');
const rngFrom = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function seededShuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = rnd() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
function memItems(disc, n, seed) {
  const r = rngFrom(seed);
  if (disc === 'numbers') return Array.from({ length: n }, () => String(r() * 10 | 0));
  if (disc === 'words') return seededShuffle([...PL_WORDS], r).slice(0, n);
  if (disc === 'images') return seededShuffle([...EMOJI_POOL], r).slice(0, n);
  return seededShuffle([...DECK], r).slice(0, n);
}
const memNT = st => [st.n || MEM_DEFAULT[st.disc][0], st.memo ?? MEM_DEFAULT[st.disc][1]];
// Zestaw fiszek do bitwy – tylko tekst (bez obrazów), z kart talii
function battleCards(deckId, n, dir, abcd) {
  const out = [];
  for (const c of shuffle(S.cards.filter(c => c.deckId === deckId))) {
    const note = noteById(c.noteId); if (!note) continue;
    let q, a;
    if (note.type === 'basic') { if (c.ord === 'r') continue; q = note.front; a = note.back; }
    else if (note.type === 'cloze') { const v = cardView(c); q = clozePlainQ(note.text, c.ord); a = v.ans; }
    else continue;
    if (!q?.trim() || !a?.trim() || a.length > 80) continue;
    const flip = dir === 'aq' || (dir === 'mix' && Math.random() < .5 && note.type === 'basic');
    out.push(flip ? { q: a, a: q } : { q, a });
    if (out.length >= n) break;
  }
  if (abcd) addChoices(out, deckId, dir);
  return out;
}
// Quiz ABCD: 3 błędne odpowiedzi z innych fiszek tej talii (te same dla obu graczy – lecą w ustawieniach bitwy)
function addChoices(cards, deckId, dir = 'qa') {
  const pool = new Set(cards.map(c => c.a));
  for (const c of S.cards.filter(c => c.deckId === deckId)) {
    const note = noteById(c.noteId); if (!note) continue;
    if (note.type === 'basic') { for (const x of [dir !== 'aq' && note.back, dir !== 'qa' && note.front]) if (x && x.trim() && x.length <= 80) pool.add(x); }
    else if (note.type === 'cloze') { const v = cardView(c); if (v.ans?.trim() && v.ans.length <= 80) pool.add(v.ans); }
  }
  const all = [...pool], norm = x => String(x).trim().toLowerCase();
  for (const c of cards) {
    // podobna długość = trudniej zgadnąć po wyglądzie
    const wrong = shuffle(all.filter(x => norm(x) !== norm(c.a))).sort((x, y) => Math.abs(x.length - c.a.length) - Math.abs(y.length - c.a.length)).slice(0, 8);
    c.opts = shuffle([c.a, ...shuffle(wrong).slice(0, 3)]);
  }
}
const clozePlainQ = (text, ord) => text.replace(CLOZE_RE, (m, num, ans, hint) => num === ord ? `[${hint || '…'}]` : ans);
const judge = (given, correct) => !!given && (B.setup.opts?.abcd ? given === correct : checkAnswer(given, correct, B.setup.opts?.tol || 'normal') !== 'wrong');

// ============================================================ Start bitwy
function newBattle(o) {
  B && B.ch?.close();
  B = { id: uid(), phase: 'wait', myAns: [], oppAns: [], myBlur: 0, oppBlur: 0, opp: null, lastOpp: Date.now(), sabUsed: 0, sabLast: 0, li: 0, lflip: false, seen: new Set([0]), ...o };
  return B;
}
function hostRoom(setup) {
  const code = roomCode();
  newBattle({ role: 'host', code, setup, phase: 'wait' });
  B.ch = channel('fiszki-room-' + code, onRoomMsg);
  go('#/battle');
}
function joinRoom(code, fromMatch) {
  newBattle({ role: 'guest', code: code.toUpperCase(), phase: 'joining', fromMatch });
  B.ch = channel('fiszki-room-' + B.code, onRoomMsg);
  const hello = () => { if (B && B.phase === 'joining') { B.ch.send({ t: 'join', ...me() }); B.joinTries = (B.joinTries || 0) + 1; if (B.joinTries < 5) setTimeout(hello, 4000); } };
  hello(); go('#/battle');
}
function onRoomMsg(m) {
  if (!B) return;
  B.lastOpp = Date.now();
  if (B.role === 'host' && m.t === 'join') {
    if (B.opp && B.opp.id !== m.from) return B.ch.send({ t: 'full', to: m.from });
    if (B.opp) { if (B.phase === 'countdown') B.ch.send({ t: 'setup', to: m.from, setup: B.setup, host: me() }); return; }
    if (B.phase === 'seeking') stopSeek();
    B.opp = { id: m.from, nick: m.nick, avatar: m.avatar, avatarImg: m.avatarImg, level: m.level, showcase: m.showcase, elo: m.elo };
    B.ch.send({ t: 'setup', to: m.from, setup: B.setup, host: me() });
    startCountdown(); return;
  }
  if (m.to && m.to !== MY_ID) return;
  if (m.t === 'full') { toast('Pokój jest już zajęty'); if (B.fromMatch) return ACTIONS['bt-quick'](); return quitBattle(); }
  if (B.role === 'guest' && m.t === 'setup' && B.phase === 'joining') {
    B.setup = m.setup; B.opp = { id: m.from, ...m.host }; startCountdown(); return;
  }
  if (m.t === 'ready') { B.oppLearnMs = m.ms; B.oppReady = true; }
  if (m.t === 'ans' && B.setup?.mode === 'cards') {
    const it = B.setup.cards[m.i]; if (!it || B.oppAns.some(a => a.i === m.i)) return;
    const ok = judge(m.given, it.a);     // sprawdzamy sami
    B.oppAns.push({ i: m.i, given: m.given, ok, ms: m.ms });
    if (ok && B.setup.opts?.live !== false) hitFx('me');
  }
  if (m.t === 'unans') { const k = B.oppAns.findIndex(a => a.i === m.i); if (k >= 0) B.oppAns.splice(k, 1); toast('⏪ Cofnięcie zadziałało!'); }
  if (m.t === 'sab') receiveSabotage(m.k);
  if (m.t === 'sabblock') toast('🛡️ Przeciwnik zablokował sabotaż tarczą');
  if (m.t === 'sabnone') toast('⏪ Nie było czego cofnąć');
  if (m.t === 'mans') { B.oppMem = m.answers; B.oppRecallMs = m.ms; }
  if (m.t === 'done') { B.oppDone = true; B.oppTotalMs = m.total; }
  if (m.t === 'blur') { B.oppBlur++; toast(`⚠️ ${B.opp?.nick || 'Przeciwnik'} opuścił aplikację`, 2500); }
  if (m.t === 'st') stickerFx(m.k, B.opp?.nick, m.shiny);
  if (m.t === 'bye') { B.oppLeft = true; toast(`${B.opp?.nick || 'Przeciwnik'} opuścił bitwę`, 3000); }
  // rewanż: obie strony muszą się zgodzić; nowy zestaw przygotowuje gospodarz
  if (m.t === 'rm' && B.phase === 'end') { B.rmTheirs = true; toast(`🔁 ${B.opp?.nick || 'Przeciwnik'} chce rewanżu!`, 3500); maybeRematch(); }
  if (m.t === 'rs' && B.phase === 'end') return restartBattle(m.setup);
  maybeFinish(); renderBattle();
}
function startCountdown() {
  B.phase = 'countdown'; B.goAt = Date.now() + 3500; renderBattle();
  const t = setInterval(() => { if (!B || B.phase !== 'countdown') return clearInterval(t); if (Date.now() >= B.goAt) { clearInterval(t); beginLearn(); } }, 200);
}
function beginLearn() {
  const st = B.setup;
  B.phase = 'learn'; B.learnStart = Date.now();
  if (st.mode === 'mem') {
    const [n, t] = memNT(st);
    GAME = { d: st.disc, n, t, items: memItems(st.disc, n, st.seed), phase: 'memo', group: DISC[st.disc].group, pos: 0, start: Date.now(), loci: [], battle: true };
  } else B.learnLimit = (st.opts?.learnSec || 0) * 1000;
  if (B.role === 'bot') botPlay();
  go('#/battle'); renderBattle();
}
function beginRecall() {
  if (B.phase !== 'learn') return;
  B.myLearnMs = Date.now() - B.learnStart; B.phase = 'recall'; B.recallStart = Date.now();
  B.ch?.send({ t: 'ready', ms: B.myLearnMs });
  if (B.setup.mode === 'cards') { B.order = shuffle(B.setup.cards.map((_, i) => i)); B.cur = 0; B.cardStart = Date.now(); }
  renderBattle();
}
function submitAnswer(given) {
  if (B.phase !== 'recall' || B.setup.mode !== 'cards' || B.frozenUntil > Date.now()) return;
  const i = B.order[B.cur], it = B.setup.cards[i];
  const ok = judge(given, it.a);
  B.draft = null;
  B.myAns = B.myAns.filter(a => a.i !== i);
  B.myAns.push({ i, given, ok, ms: Date.now() - B.cardStart });
  B.ch?.send({ t: 'ans', i, given, ms: Date.now() - B.cardStart });
  if (ok) { hitFx('opp'); emit('battleHit'); } else floatText('✗ ' + it.a);
  B.cur++; B.cardStart = Date.now();
  if (B.cur >= B.order.length) myDone();
  renderBattle();
}
function myDone() {
  B.myDone = true; B.myTotalMs = Date.now() - B.learnStart; B.phase = 'waitopp';
  B.ch?.send({ t: 'done', total: B.myTotalMs });
  maybeFinish();
}
function maybeFinish() {
  if (!B || B.phase === 'end') return;
  const mem = B.setup?.mode === 'mem';
  const oppOk = B.oppDone && (!mem || B.oppMem);
  if (B.myDone && (oppOk || B.oppLeft)) finishBattle();
}
function scores() {
  if (B.setup.mode === 'mem') {
    const items = GAME?.items || memItems(B.setup.disc, memNT(B.setup)[0], B.setup.seed);
    const cnt = a => (a || []).reduce((s, v, i) => s + (v === items[i] ? 1 : 0), 0);
    return { my: cnt(B.myMem), opp: cnt(B.oppMem), n: items.length };
  }
  return { my: B.myAns.filter(a => a.ok).length, opp: B.oppAns.filter(a => a.ok).length, n: B.setup.cards.length };
}
function finishBattle() {
  const sc = scores();
  let won = sc.my > sc.opp ? 1 : sc.my < sc.opp ? -1 : 0;
  if (B.oppLeft && !B.oppDone) won = 1;
  if (won === 0 && B.myTotalMs && B.oppTotalMs) won = B.myTotalMs < B.oppTotalMs ? 1 : B.myTotalMs > B.oppTotalMs ? -1 : 0;
  B.phase = 'end'; B.result = { ...sc, won };
  const rec = { id: B.id, t: Date.now(), mode: B.setup.mode, disc: B.setup.disc, deck: B.setup.deckName, opp: B.opp?.nick, oppAvatar: B.opp?.avatar,
    my: sc.my, them: sc.opp, n: sc.n, won, abcd: !!B.setup.opts?.abcd, bot: B.role === 'bot', myMs: B.myTotalMs, oppMs: B.oppTotalMs, blur: B.myBlur };
  if (B.role !== 'bot' && Number.isFinite(B.opp?.elo)) { rec.oppElo = B.opp.elo; rec.elo = eloDelta(myElo(), clamp(B.opp.elo, 100, 3000), won, S.battles.filter(b => b.elo != null).length); }
  S.battles.push(rec);
  if (won === 1) {
    addItem('case', B.setup.mode === 'cards' && sc.n >= 10 && B.role !== 'bot' ? 'epic' : 'basic', 1, 'case-' + B.id);
    S.stats.battleWins = (S.stats.battleWins || 0) + 1;
    const streakNow = (() => { let n = 0; for (let i = S.battles.length - 1; i >= 0 && S.battles[i].won === 1; i--) n++; return n; })();
    S.stats.winStreak = Math.max(S.stats.winStreak || 0, streakNow);
    emit('battleWin', rec);
    setTimeout(() => celebrate('🏆 Zwycięstwo!', `+${battleReward(rec)} 💎 i darmowa skrzynka`), 300);
  } else if (won === 0) toast('🤝 Remis!'); else toast('💪 Tym razem przegrana – rewanż?', 3000);
  save(); B.ch?.send({ t: 'done', total: B.myTotalMs }); renderBattle();
}
function maybeRematch() {
  if (!(B.rmMine && B.rmTheirs) || B.role !== 'host') return renderBattle();
  const st = B.setup, o = st.opts || {};
  let fresh;
  if (st.mode === 'mem') fresh = { ...st, seed: Math.random() * 1e9 | 0 };
  else { const c = st.deckId && deckById(st.deckId) ? battleCards(st.deckId, st.cards.length, o.dir || 'qa', o.abcd) : []; fresh = { ...st, cards: c.length >= 3 ? c : shuffle([...st.cards]) }; }
  B.ch.send({ t: 'rs', setup: fresh });
  restartBattle(fresh);
}
// nowa runda na tym samym kanale, z tym samym przeciwnikiem
function restartBattle(setup) {
  const keep = { ch: B.ch, role: B.role, code: B.code, opp: B.opp, lobby: null };
  clearInterval(B.uiTimer); GAME = null;
  B = { id: uid(), phase: 'wait', myAns: [], oppAns: [], myBlur: 0, oppBlur: 0, lastOpp: Date.now(), sabUsed: 0, sabLast: 0, li: 0, lflip: false, seen: new Set([0]), ...keep, setup };
  toast('🔁 Rewanż! Powodzenia', 2000);
  startCountdown(); go('#/battle');
}
function quitBattle() {
  if (B) { if (B.phase !== 'end') B.ch?.send({ t: 'bye' }); B.ch?.close(); (B.botTimers || []).forEach(clearTimeout); clearInterval(B.uiTimer); }
  B = null; GAME = null; go('#/battles');
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'hidden' || !B || B.phase !== 'recall') return;
  B.myBlur++; B.ch?.send({ t: 'blur' });
  if (B.setup.mode === 'cards') { B.frozenUntil = 0; submitAnswer(''); toast('⚠️ Wyjście z aplikacji w trakcie odpowiedzi = pytanie stracone', 4000); }
});

// ============================================================ Sabotaże
function useSabotage(k) {
  const sb = SABOTAGE[k]; if (!B || !sb || !B.setup.opts?.sab) return;
  if (B.phase !== 'recall' && !(B.setup.mode === 'mem' && B.phase === 'learn')) return toast('Sabotaży używasz w trakcie walki');
  if (sb.cardsOnly && B.setup.mode !== 'cards') return;
  if (B.sabUsed >= SAB_MAX) return toast(`Limit ${SAB_MAX} sabotaży na bitwę`);
  if (Date.now() - B.sabLast < SAB_COOLDOWN) return toast('Chwilę… sabotaż się ładuje ⏳');
  if (!sb.self && B.oppDone) return toast('Przeciwnik już skończył');
  if (!spend(sb.cost, 'sab-' + k)) return;
  B.sabUsed++; B.sabLast = Date.now(); S.stats.sabUsed = (S.stats.sabUsed || 0) + 1; save();
  setTimeout(renderBattle, SAB_COOLDOWN + 100);
  if (sb.self) { B.shieldOn = true; toast('🛡️ Tarcza aktywna'); return renderBattle(); }
  floatText(`${sb.icon} ${sb.name}!`, true);
  if (B.role === 'bot') return botReceiveSabotage(k);
  B.ch?.send({ t: 'sab', k });
}
function receiveSabotage(k) {
  const sb = SABOTAGE[k]; if (!sb || B.phase === 'end') return;
  if (B.shieldOn) { B.shieldOn = false; B.ch?.send({ t: 'sabblock' }); toast(`🛡️ Tarcza zablokowała: ${sb.icon} ${sb.name}`); return; }
  if (k === 'freeze') { B.frozenUntil = Date.now() + 5000; setTimeout(renderBattle, 5100); }
  if (k === 'fog') { B.fogUntil = Date.now() + 7000; setTimeout(renderBattle, 7100); }
  if (k === 'undo') {
    const idx = [...B.myAns].reverse().findIndex(a => a.ok);
    if (idx < 0 || B.myDone) { B.ch?.send({ t: 'sabnone' }); return; }
    const a = B.myAns.splice(B.myAns.length - 1 - idx, 1)[0];
    B.order.push(a.i); B.ch?.send({ t: 'unans', i: a.i });
  }
  toast(`${sb.icon} ${B.opp?.nick || 'Przeciwnik'} użył: ${sb.name}!`, 3000);
  tick(160, .25, .15);
}

// ============================================================ Bot
function botAfter(ms, fn) { const t = setTimeout(() => { if (B && B.role === 'bot' && B.phase !== 'end') fn(); }, ms); (B.botTimers = B.botTimers || []).push(t); }
function botPlay() {
  const { acc, a, b } = B.botP;
  const st = B.setup;
  if (st.mode === 'mem') {
    const items = GAME.items, n = items.length;
    const want = (15 + n * 2.2 * (1.3 - acc)) * 1000, learn = GAME.t ? Math.min(GAME.t * 1000, want) : want;
    // pamięć: im dłuższy ciąg i krótszy czas, tym więcej pomyłek; błędy często „seriami” (zgubiony obraz = kilka elementów)
    const p = clamp(acc * (1 - Math.min(.5, n / 250)) * clamp(learn / (n * 2500), .5, 1.05), .05, .97);
    const ans = []; let lost = 0;
    items.forEach(x => { if (lost > 0) { lost--; ans.push(null); } else if (Math.random() < p) ans.push(x); else { ans.push(null); lost = Math.random() < .5 ? 1 + (Math.random() * 2 | 0) : 0; } });
    const rec = n * (700 + Math.random() * 600);
    botAfter(learn, () => { B.oppReady = true; B.oppLearnMs = learn; renderBattle(); });
    botAfter(learn + rec, () => { B.oppMem = ans; B.oppDone = true; B.oppTotalMs = learn + rec; maybeFinish(); renderBattle(); });
    return;
  }
  const n = st.cards.length, cap = (st.opts?.learnSec || 0) * 1000;
  const want = n * (5 + 7 * (1 - acc)) * 1000 * (0.8 + Math.random() * .4), learn = cap ? Math.min(cap, want) : want;
  B.bot = { queue: shuffle(st.cards.map((_, i) => i)), t: 0, acc, a, b, learn };
  botAfter(learn, () => { B.oppReady = true; B.oppLearnMs = learn; renderBattle(); botNext(); });
  if (st.opts?.sab && acc > .5) [learn + 9000, learn + 20000].slice(0, acc > .75 ? 2 : 1).forEach(t => botAfter(t + Math.random() * 6000, () => {
    if (B.phase === 'recall') { receiveSabotage(Math.random() < .5 ? 'freeze' : 'fog'); renderBattle(); } }));
}
function botNext() {
  const bt = B.bot; if (!bt.queue.length) { B.oppDone = true; B.oppTotalMs = Date.now() - B.learnStart; maybeFinish(); return renderBattle(); }
  const ansLimit = (B.setup.opts?.ansSec || 999) * 1000;
  const d = Math.min(ansLimit, (bt.a + Math.random() * (bt.b - bt.a)) * 1000 + (bt.frozen || 0)); bt.frozen = 0;
  botAfter(d, () => {
    const i = bt.queue.shift(), card = B.setup.cards[i];
    const ok = Math.random() < botCardChance(bt.acc, B.setup.cards.length, bt.learn, card.a.length);
    B.oppAns = B.oppAns.filter(x => x.i !== i);
    B.oppAns.push({ i, given: ok ? card.a : typo(card.a), ok, ms: d }); if (ok && B.setup.opts?.live !== false) hitFx('me');
    renderBattle(); botNext();
  });
}
function botReceiveSabotage(k) {
  const bt = B.bot;
  if (k === 'freeze' && bt) bt.frozen = 5000;
  if (k === 'undo' && bt) {
    const idx = [...B.oppAns].reverse().findIndex(a => a.ok);
    if (idx >= 0 && !B.oppDone) { const a = B.oppAns.splice(B.oppAns.length - 1 - idx, 1)[0]; bt.queue.push(a.i); toast('⏪ Cofnięcie zadziałało!'); }
    else toast('⏪ Nie było czego cofnąć');
  }
  renderBattle();
}

// ============================================================ Efekty bitwy
function hitFx(who) {
  const el = $(who === 'me' ? '#hp-me' : '#hp-opp'); if (!el) return;
  el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
  tick(who === 'me' ? 220 : 520, .08, .1);
}
function stickerFx(k, from, shiny) {
  const s = stickerById(k); if (!s) return;
  const el = document.createElement('div'); el.className = `stfly ${s.r}${shiny ? ' shiny' : ''}${S.settings.stickerAnim !== false ? ' anim st-' + s.id : ''}`; el.style.setProperty('--rc', RARITY[s.r].color);
  el.innerHTML = `<span>${s.e}</span><small>${esc(from || 'Ty')}: ${esc(s.name)}${shiny ? ' ✨' : ''}</small>`;
  document.body.append(el); setTimeout(() => el.remove(), 2600);
  if (s.r === 'legendary' || shiny) confetti(60);
}
let lastSticker = 0;

// ============================================================ Widoki
function hpBars() {
  const sc = B.setup ? scores() : { my: 0, opp: 0, n: 1 };
  const reveal = (B.setup?.mode !== 'mem' && B.setup?.opts?.live !== false) || B.phase === 'end';
  const myHp = 100 - (reveal ? sc.opp : 0) / sc.n * 100, oppHp = 100 - (reveal ? sc.my : 0) / sc.n * 100;
  const tug = clamp(50 + ((reveal ? sc.my - sc.opp : 0) / sc.n) * 50, 3, 97);
  const op = B.opp || { nick: '…', avatar: '❔' }, m = me();
  const state = (ready, done) => done ? '✅ skończył' : ready ? '⚔️ odpowiada' : ['learn', 'recall', 'waitopp'].includes(B.phase) ? '📖 uczy się' : '';
  const sc2 = ids => typeof showcaseHTML === 'function' ? `<span class="showcase">${showcaseHTML(ids)}</span>` : '';
  return `<div class="arena">
    <div class="fighter"><div class="row nowrap"><span class="av">${avatarHTML(m, 34)}</span>${sc2(m.showcase)}</div><b class="nm">${esc(m.nick)}${B.shieldOn ? ' 🛡️' : ''}</b><div class="hp" id="hp-me"><div style="width:${myHp}%"></div></div><small>${reveal ? Math.round(myHp) + ' HP · ' : ''}${state(B.phase !== 'learn', B.myDone)}</small></div>
    <div class="vs">VS</div>
    <div class="fighter r"><div class="row nowrap">${sc2(op.showcase)}<span class="av">${avatarHTML(op, 34)}</span></div><b class="nm">${esc(op.nick)}</b><div class="hp opp" id="hp-opp"><div style="width:${oppHp}%"></div></div><small>${reveal ? Math.round(oppHp) + ' HP · ' : ''}${state(B.oppReady, B.oppDone)}</small></div>
  </div><div class="tug"><div class="tugfill" style="width:${tug}%"></div><span class="knot" style="left:${tug}%">⚔️</span></div>
  ${reveal ? '' : '<p class="small muted center" style="margin-top:-8px">Wynik przeciwnika zobaczysz na końcu 🤫</p>'}`;
}
function stickerBar() {
  return `<div class="stbar">${ownedStickers().map(id => { const s = stickerById(id); return `<button class="${isShiny(id) ? 'shiny' : ''}" data-act="bt-sticker" data-k="${id}" style="--rc:${RARITY[s.r].color}">${s.e}</button>`; }).join('')}</div>`;
}
function sabotageBar() {
  if (!B.setup.opts?.sab) return '';
  const left = SAB_MAX - B.sabUsed, cool = Date.now() - B.sabLast < SAB_COOLDOWN;
  return `<div class="sabbar"><span class="small muted">Sabotaże (${left}) · 💎 ${coins()}</span><div class="row nowrap">${Object.entries(SABOTAGE).filter(([, s]) => !s.cardsOnly || B.setup.mode === 'cards').map(([k, s]) =>
    `<button class="sab" data-act="bt-sab" data-k="${k}" ${left <= 0 || cool || coins() < s.cost ? 'disabled' : ''} title="${esc(s.desc)}"><span>${s.icon}</span><small>${s.cost}💎</small></button>`).join('')}</div></div>`;
}
function overlays() {
  let o = '';
  if (B.frozenUntil > Date.now()) o += `<div class="freeze"><div>❄️<b>Zamrożony!</b><small>${Math.ceil((B.frozenUntil - Date.now()) / 1000)} s</small></div></div>`;
  return o;
}
function renderBattle() { if (parseRoute().parts[0] === 'battle') render(); }
let speech = null;
ROUTES.battle = () => {
  if (!B) return { html: `<p>Brak aktywnej bitwy. <a href="#/battles">Bitwy</a></p>` };
  const close = `<button class="iconbtn" data-act="bt-quit">✕</button>`;
  const o = B.setup?.opts || {};
  if (B.phase === 'wait') {
    const link = APP_URL() + '#/battles?join=' + B.code;
    return { focus: true, html: `<div class="studybar">${close}<div class="title">⚔️ Pokój bitwy</div></div>
      <div class="card center"><p>Podaj znajomemu kod:</p><div class="code">${B.code}</div>
      <p class="small muted">${B.setup.mode === 'cards' ? `${B.setup.opts?.abcd ? '🅰️ Quiz ABCD' : 'Fiszki'}: ${esc(B.setup.deckName)} · ${B.setup.cards.length} kart` : `Pamięć: ${DISC[B.setup.disc].name} · ${memNT(B.setup)[0]}`}</p>
      ${rulesHTML(B.setup)}
      <button class="primary block" data-act="bt-share" data-link="${esc(link)}">📤 Wyślij zaproszenie</button>
      <div class="spinner"></div><p class="small muted">Czekam na przeciwnika…</p></div>` };
  }
  if (B.phase === 'joining' || B.phase === 'seeking') {
    return { focus: true, html: `<div class="studybar">${close}<div class="title">⚔️ ${B.phase === 'seeking' ? 'Szukam przeciwnika' : 'Dołączam'}</div></div>
      <div class="card center"><div class="spinner"></div><p>${B.phase === 'seeking' ? 'Szukam gracza, który też chce walczyć…' : `Łączę z pokojem <b>${esc(B.code)}</b>…`}</p>
      ${B.phase === 'seeking' && Date.now() - B.seekStart > 25000 ? `<p class="small muted">Nikogo jeszcze nie ma.</p><button class="block" data-act="bt-bot-now">🤖 Zagraj z botem</button>` : ''}</div>` };
  }
  if (B.phase === 'countdown') {
    const el = Math.max(0, 3.5 - (B.goAt - Date.now()) / 1000).toFixed(2);
    return { focus: true, html: hpBars() + `<div class="getready"><b>Przygotuj się…</b><div class="readybar"><div style="animation-delay:-${el}s"></div></div></div><p class="center">${B.setup.mode === 'cards' ? `📖 Przejrzyj ${B.setup.cards.length} fiszek, potem ${B.setup.opts?.abcd ? 'quiz ABCD – liczą się poprawne odpowiedzi' : 'test z pamięci'}` : `🧠 ${DISC[B.setup.disc].name}: zapamiętaj i odtwórz`}</p>${rulesHTML(B.setup)}` };
  }
  const head = `<div class="studybar">${close}<div class="title">⚔️ Bitwa</div><b class="timer" id="btimer"></b></div>` + hpBars();
  if (B.setup.mode === 'mem' && (B.phase === 'learn' || B.phase === 'recall') && GAME?.battle) {
    onMount(mountGameTimer);
    const inner = GAME.phase === 'memo' ? gameMemo(GAME, DISC[GAME.d]) : gameRecall(GAME, DISC[GAME.d]);
    return { focus: true, html: `<div class="studybar">${close}<div class="title">⚔️ ${GAME.phase === 'memo' ? 'Zapamiętuj' : 'Odtwórz'}</div><b id="gtimer" class="timer"></b></div>${hpBars()}
      <div class="${B.fogUntil > Date.now() ? 'fog' : ''}">${inner}</div>${sabotageBar()}${stickerBar()}${overlays()}` };
  }
  if (B.phase === 'learn') {
    onMount(battleTimer);
    const cards = B.setup.cards, c = cards[B.li], seen = B.seen.size;
    return { focus: true, html: head + `<div class="row small muted"><span class="grow">Fiszka ${B.li + 1}/${cards.length} · obejrzane ${seen}/${cards.length}</span>${o.learnSec ? '' : '<span>bez limitu czasu</span>'}</div>
      ${progress(seen / cards.length, true)}
      <div class="card flash learncard" data-act="bt-flip">${B.lflip ? `<div class="ctext">${fmt(c.q)}</div><hr><div class="ctext"><b>${fmt(c.a)}</b></div>` : `<div class="ctext">${fmt(c.q)}</div><p class="small muted">stuknij, aby odwrócić</p>`}</div>
      <div class="row nowrap"><button class="grow" data-act="bt-lnav" data-d="-1" ${B.li ? '' : 'disabled'} style="min-height:52px">‹ Poprzednia</button>
        <button class="grow ${B.lflip ? 'primary' : ''}" data-act="${B.lflip ? 'bt-lnav' : 'bt-flip'}" data-d="1" style="min-height:52px">${B.lflip ? (B.li < cards.length - 1 ? 'Następna ›' : 'Od początku ↺') : 'Odwróć'}</button></div>
      <div class="answerbar"><button class="${seen === cards.length ? 'primary' : ''} block" data-act="bt-ready" style="min-height:56px">🧪 Przejdź do testu${seen < cards.length ? ` (obejrzane ${seen}/${cards.length})` : ''}</button></div>${stickerBar()}` };
  }
  if (B.phase === 'recall') {
    const i = B.order[B.cur], it = B.setup.cards[i];
    const frozen = B.frozenUntil > Date.now();
    onMount(() => {
      battleTimer();
      const inp = $('#bt-in'); if (!inp) return;
      // odświeżenie ekranu (np. trafienie przeciwnika) nie kasuje tego, co wpisujesz
      if (B.draft?.i === i) inp.value = B.draft.v;
      inp.addEventListener('input', () => { B.draft = { i, v: inp.value }; });
      if (!frozen) { inp.focus({ preventScroll: true }); inp.setSelectionRange(inp.value.length, inp.value.length); }
      inp.addEventListener('paste', e => { e.preventDefault(); toast('Wklejanie jest wyłączone w bitwie 😉'); });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitAnswer(inp.value.trim()); } });
    });
    const hasSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    return { focus: true, html: head + `<div class="row small muted"><span class="grow">Pytanie ${B.cur + 1}/${B.order.length}</span><span id="cardleft"></span></div>
      <div class="card flash${it.opts ? ' short' : ''}${B.fogUntil > Date.now() ? ' fog' : ''}"><div class="ctext">${fmt(it.q)}</div></div>
      ${it.opts ? `<div class="abcd">${it.opts.map((x, k) => `<button data-act="bt-abcd" data-k="${k}" ${frozen ? 'disabled' : ''}><b>${'ABCD'[k]}</b><span>${fmt(x)}</span></button>`).join('')}</div>
      <div class="spacer"></div><button class="block" data-act="bt-skip">Nie wiem</button>`
      : `<div class="row nowrap"><input id="bt-in" class="grow" placeholder="Odpowiedź…" autocomplete="off" autocapitalize="off" spellcheck="false" ${frozen ? 'disabled' : ''}>
        ${hasSpeech ? `<button data-act="bt-mic" class="${speech ? 'primary' : ''}" title="Powiedz odpowiedź">🎤</button>` : ''}</div>
      <div class="spacer"></div><div class="row nowrap"><button class="grow" data-act="bt-skip">Nie wiem</button><button class="primary grow" data-act="bt-submit">Odpowiedz ➤</button></div>`}
      ${sabotageBar()}${stickerBar()}${overlays()}` };
  }
  if (B.phase === 'waitopp') {
    return { focus: true, html: head + `<div class="card center"><div class="spinner"></div><p>Skończyłeś! Czekam, aż ${esc(B.opp?.nick || 'przeciwnik')} skończy…</p>
      ${Date.now() - B.lastOpp > 90000 && B.role !== 'bot' ? '<button class="block" data-act="bt-walkover">Przeciwnik nie odpowiada – zakończ (walkower)</button>' : ''}</div>${sabotageBar()}${stickerBar()}` };
  }
  // koniec
  if (B.review) {
    const R = B.review, c = R.list[R.i];
    if (!c) return { focus: true, html: `<div class="studybar"><button class="iconbtn" data-act="bt-rv-close">✕</button><div class="title">🔁 Moje błędy</div></div>
      <div class="card center"><div style="font-size:50px">✅</div><p>Przejrzane wszystkie błędy.</p><button class="primary block" data-act="bt-rv-close">Wróć do wyniku</button></div>` };
    return { focus: true, html: `<div class="studybar"><button class="iconbtn" data-act="bt-rv-close">✕</button><div class="title">🔁 Moje błędy</div><span class="small muted">${R.i + 1}/${R.list.length}</span></div>
      ${progress(R.i / R.list.length)}<div class="card flash"><div class="ctext">${fmt(c.q)}</div>${R.shown ? `<hr><div class="ctext"><b>${fmt(c.a)}</b></div>` : ''}</div>
      <div class="answerbar">${R.shown ? '<button class="primary block" data-act="bt-rv-next" style="min-height:56px">Dalej ›</button>' : '<button class="primary block" data-act="bt-rv-show" style="min-height:56px">Pokaż odpowiedź</button>'}</div>` };
  }
  const r = B.result, rec = S.battles.find(x => x.id === B.id);
  const caseKind = hasItem('case', 'epic') ? 'epic' : 'basic';
  return { focus: true, html: `<div class="studybar">${close}<div class="title">⚔️ Wynik</div></div>${hpBars()}
    <div class="card center result-${r.won}"><div style="font-size:60px">${r.won === 1 ? '🏆' : r.won === 0 ? '🤝' : '💪'}</div>
      <h2 style="margin:4px 0">${r.won === 1 ? 'Zwycięstwo!' : r.won === 0 ? 'Remis' : 'Porażka'}</h2>
      <p><b>${r.my}</b> : <b>${r.opp}</b> <span class="muted">(z ${r.n})</span></p>
      <p class="small muted">Twój czas: ${fmtTime(B.myTotalMs || 0)}${B.oppTotalMs ? ` · przeciwnik: ${fmtTime(B.oppTotalMs)}` : ''}${B.myBlur || B.oppBlur ? ` · wyjścia z aplikacji: Ty ${B.myBlur}, przeciwnik ${B.oppBlur}` : ''}</p>
      <p><b class="coins">+${rec ? battleReward(rec) : 0} 💎</b>${rec?.elo != null ? ` <b class="${rec.elo >= 0 ? 'c-rev' : 'c-lrn'}">${rec.elo >= 0 ? '+' : ''}${rec.elo} Elo</b> → ${eloHTML(myElo())}` : rec?.bot ? ' <span class="small muted">(bot – bez Elo)</span>' : ''}</p>
      ${r.won === 1 && hasItem('case', caseKind) ? `<button class="primary block" data-go="#/case/${caseKind}?free=1" style="min-height:56px">🎁 Otwórz darmową skrzynkę!</button><div class="spacer"></div>` : ''}
      ${B.role === 'bot' ? `<div class="row"><button class="primary grow" data-act="bt-rematch">🔁 Rewanż</button><button class="grow" data-act="bt-new-opp">🔎 Nowy przeciwnik</button></div>`
        : B.oppLeft ? `<p class="small muted">${esc(B.opp?.nick || 'Przeciwnik')} opuścił bitwę.</p><button class="primary block" data-act="bt-new-opp">🔎 Znajdź nowego przeciwnika</button>`
        : `<div class="row">${B.rmMine ? `<button class="grow" disabled>⏳ Czekam na zgodę ${esc(B.opp?.nick || '')}…</button>`
            : `<button class="primary grow${B.rmTheirs ? ' pulse' : ''}" data-act="bt-rm">${B.rmTheirs ? `✅ Przyjmij rewanż od ${esc(B.opp?.nick || '')}` : `🔁 Rewanż z ${esc(B.opp?.nick || 'tym graczem')}`}</button>`}
            <button class="grow" data-act="bt-new-opp">🔎 Nowy przeciwnik</button></div>`}
      <div class="spacer"></div><button class="ghost block" data-act="bt-quit">Zakończ</button></div>
    ${battleReviewHTML()}` };
};
// Analiza po bitwie: skuteczność obu graczy i pytanie po pytaniu – co kto odpowiedział
function battleReviewHTML() {
  const op = B.opp?.nick || 'Przeciwnik', m = me();
  const pct = (a, n) => n ? Math.round(a / n * 100) : 0;
  const avg = arr => arr.length ? arr.reduce((x, y) => x + (y.ms || 0), 0) / arr.length / 1000 : 0;
  const statRow = (label, mine, theirs) => `<div class="cmprow"><b>${mine}</b><span>${label}</span><b>${theirs}</b></div>`;
  if (B.setup.mode === 'mem') {
    const items = GAME?.items || memItems(B.setup.disc, memNT(B.setup)[0], B.setup.seed), D = DISC[B.setup.disc];
    const mine = B.myMem || [], theirs = B.oppMem || [], sc = scores();
    const cell = (v, x) => v === x ? `<span class="res ok">${D.tile(x)}</span>` : `<span class="res bad">${D.tile(x)}<small>${v != null ? D.tile(v) : '–'}</small></span>`;
    return `<div class="card"><h3 style="margin-top:0">📊 Analiza bitwy</h3>
      <div class="cmphead"><span>${avatarHTML(m, 24)} Ty</span><span></span><span>${esc(op)} ${avatarHTML(B.opp || {}, 24)}</span></div>
      ${statRow('skuteczność', pct(sc.my, sc.n) + '%', pct(sc.opp, sc.n) + '%')}
      ${statRow('poprawne', `${sc.my}/${sc.n}`, `${sc.opp}/${sc.n}`)}
      ${statRow('zapamiętywanie', fmtTime(B.myLearnMs || 0), B.oppLearnMs ? fmtTime(B.oppLearnMs) : '–')}
      <h4>Twoje odpowiedzi</h4><p class="small muted">Zielone – dobrze; czerwone – pod spodem to, co wpisałeś.</p><div class="results ${B.setup.disc}">${items.map((x, i) => cell(mine[i], x)).join('')}</div>
      <h4>Odpowiedzi: ${esc(op)}</h4><div class="results ${B.setup.disc}">${items.map((x, i) => cell(theirs[i], x)).join('')}</div></div>`;
  }
  const cards = B.setup.cards, n = cards.length;
  const myOk = B.myAns.filter(a => a.ok), opOk = B.oppAns.filter(a => a.ok);
  const both = cards.filter((_, i) => !B.myAns.find(a => a.i === i)?.ok && !B.oppAns.find(a => a.i === i)?.ok).length;
  const ans = (a, c) => !a ? '<span class="muted">—</span>' : a.ok
    ? `<span class="c-rev">✓ ${esc(a.given || c.a)}</span>` : `<span class="c-lrn">✗ ${esc(a.given || '(brak odpowiedzi)')}</span>`;
  const rows = cards.map((c, i) => { const a = B.myAns.find(x => x.i === i), b = B.oppAns.find(x => x.i === i);
    const cls = a?.ok ? (b?.ok ? '' : 'win') : (b?.ok ? 'lose' : 'both');
    return `<div class="qrev ${cls}"><div class="q">${i + 1}. ${esc(c.q)}</div><div class="a">✔ ${esc(c.a)}</div>
      <div class="two"><div><small>Ty${a?.ms ? ` · ${(a.ms / 1000).toFixed(1)} s` : ''}</small>${ans(a, c)}</div><div><small>${esc(op)}${b?.ms ? ` · ${(b.ms / 1000).toFixed(1)} s` : ''}</small>${ans(b, c)}</div></div></div>`; }).join('');
  const mistakes = cards.filter((_, i) => !B.myAns.find(a => a.i === i)?.ok);
  return `<div class="card"><h3 style="margin-top:0">📊 Analiza bitwy</h3>
    <div class="cmphead"><span>${avatarHTML(m, 24)} Ty</span><span></span><span>${esc(op)} ${avatarHTML(B.opp || {}, 24)}</span></div>
    ${statRow('skuteczność', pct(myOk.length, n) + '%', pct(opOk.length, n) + '%')}
    ${statRow('poprawne', `${myOk.length}/${n}`, `${opOk.length}/${n}`)}
    ${statRow('błędy', n - myOk.length, n - opOk.length)}
    ${statRow('śr. czas odp.', avg(B.myAns).toFixed(1) + ' s', B.oppAns.length ? avg(B.oppAns).toFixed(1) + ' s' : '–')}
    ${statRow('nauka', fmtTime(B.myLearnMs || 0), B.oppLearnMs ? fmtTime(B.oppLearnMs) : '–')}
    <div class="legend small muted"><span class="dot win"></span>tylko Ty dobrze <span class="dot lose"></span>tylko ${esc(op)} <span class="dot both"></span>oboje źle</div>
    ${rows}
    ${both ? `<p class="small muted">${both} ${plural(both, 'pytanie', 'pytania', 'pytań')} sprawiło trudność obojgu.</p>` : ''}
    ${mistakes.length ? `<button class="block" data-act="bt-cram-mistakes">🔁 Powtórz moje błędy (${mistakes.length})</button>` : '<p class="center c-rev"><b>Bezbłędnie! 🎯</b></p>'}</div>`;
}
function rulesHTML(st) {
  const o = st.opts || {};
  if (st.mode === 'mem') { const [n, t] = memNT(st); return `<p class="small muted">${n} elementów · ${t ? t + ' s na zapamiętanie' : 'bez limitu czasu'}${o.sab ? ' · sabotaże ✓' : ''}</p>`; }
  return `<p class="small muted">⏱ nauka: ${o.learnSec ? o.learnSec + ' s' : 'bez limitu'} · odpowiedź: ${o.ansSec ? o.ansSec + ' s' : 'bez limitu'} · sprawdzanie: ${{ strict: 'dokładne', normal: 'normalne', lenient: 'łagodne' }[o.tol] || 'normalne'}
    · wynik ${o.live === false ? 'ukryty do końca' : 'na żywo'} · sabotaże ${o.sab ? '✓' : '✗'}</p>`;
}
function battleTimer() {
  clearInterval(B.uiTimer);
  B.uiTimer = setInterval(() => {
    if (!B || (!$('#btimer') && !$('#cardleft'))) return clearInterval(B?.uiTimer);
    const o = B.setup.opts || {};
    if (B.phase === 'learn') {
      if (B.learnLimit) { const left = B.learnLimit - (Date.now() - B.learnStart); $('#btimer').textContent = fmtTime(Math.max(0, left)); if (left <= 0) beginRecall(); }
      else $('#btimer').textContent = fmtTime(Date.now() - B.learnStart);
    } else if (B.phase === 'recall') {
      if ($('#btimer')) $('#btimer').textContent = fmtTime(Date.now() - B.learnStart);
      if (B.frozenUntil > Date.now()) { B.cardStart += 300; const f = $('.freeze small'); if (f) f.textContent = Math.ceil((B.frozenUntil - Date.now()) / 1000) + ' s'; return; }
      if ($('.freeze')) renderBattle();
      if (o.ansSec) {
        const left = o.ansSec * 1000 - (Date.now() - B.cardStart);
        if ($('#cardleft')) $('#cardleft').textContent = `⏱ ${Math.ceil(Math.max(0, left) / 1000)} s`;
        if (left <= 0) submitAnswer($('#bt-in')?.value.trim() || '');
      }
    }
  }, 300);
}
// gra pamięciowa w bitwie: zakończenie memo i odtwarzania
on('gameRecallStart', () => { if (B && GAME?.battle) { B.myLearnMs = Date.now() - B.learnStart; B.ch?.send({ t: 'ready', ms: B.myLearnMs }); B.phase = 'recall'; } });
function battleMemFinish() {
  clearInterval(gameTimer);
  B.myMem = GAME.answer.map(v => GAME.d === 'numbers' ? v : v != null ? GAME.pool[v] : null);
  B.ch?.send({ t: 'mans', answers: B.myMem, ms: Date.now() - GAME.recallStart });
  myDone(); renderBattle();
}

// ============================================================ Ekran bitew (matchmaking + ustawienia)
ROUTES.battles = (parts, q) => {
  if (q.get('join')) { const code = q.get('join'); setTimeout(() => joinRoom(code), 30); }
  const bs = S.battles, w = bs.filter(b => b.won === 1).length, l = bs.filter(b => b.won === -1).length, d = bs.filter(b => b.won === 0).length;
  const heads = {}; bs.filter(b => !b.bot).forEach(b => { const h = heads[b.opp] || (heads[b.opp] = { w: 0, l: 0, d: 0, av: b.oppAvatar }); h[b.won === 1 ? 'w' : b.won === -1 ? 'l' : 'd']++; });
  const ms = memSettings(), o = btOpts(), mode = ms.btMode || 'cards';
  const sel = (id, list, cur) => `<select data-btopt="${id}">${list.map(([v, l]) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const memDisc = ms.btDisc || 'numbers';
  const deck = deckById(ms.btDeck) || S.decks[0];
  const summary = mode !== 'mem'
    ? `${mode === 'quiz' ? '🅰️ Quiz ABCD · ' : '📚 '}${esc(deck?.name || 'talia')} · ${o.n} fiszek · nauka ${o.learnSec ? o.learnSec / 60 + ' min' : '∞'} · odp. ${o.ansSec ? o.ansSec + ' s' : '∞'}${o.sab ? ' · sabotaże' : ''}`
    : `🧠 ${DISC[memDisc].name} · ${o.memN || MEM_DEFAULT[memDisc][0]} el. · ${o.memSec ? o.memSec + ' s' : 'bez limitu'}${o.sab ? ' · sabotaże' : ''}`;
  return { tab: 'train', html: `
  <div class="row nowrap"><h1 class="grow">⚔️ Bitwy</h1>${coinsHTML()}</div>
  <div class="row nowrap elo-row">${eloHTML(myElo())}<span class="grow"></span></div>
  <p class="small muted">🏆 ${w} · 🤝 ${d} · 💪 ${l}${bs.length ? ` · ${Math.round(w / bs.length * 100)}% wygranych` : ''}</p>
  <button class="primary block big-btn" data-act="bt-quick">⚡ Szybki mecz</button>
  <p class="small muted center" style="margin:4px 0 12px">losowy przeciwnik · pojedynek pamięci</p>
  <div class="card">
    <div class="row"><button class="primary grow" data-act="bt-host">👥 Wyzwij znajomego</button><button class="grow" data-act="bt-bot">🤖 Z botem</button></div>
    <div class="row nowrap" style="margin-top:10px"><input id="bt-code" class="grow" placeholder="Kod od znajomego" maxlength="6" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:2px"><button data-act="bt-join">Dołącz</button></div>
  </div>
  <details class="card rules"${ms.rulesOpen ? ' open' : ''}><summary><b>⚙️ Zasady bitwy</b><div class="small muted">${summary}</div></summary>
    <div class="seg" style="display:flex;margin-top:10px"><button class="grow ${mode === 'cards' ? 'on' : ''}" data-act="bt-mode" data-m="cards">📚 Fiszki</button><button class="grow ${mode === 'quiz' ? 'on' : ''}" data-act="bt-mode" data-m="quiz">🅰️ ABCD</button><button class="grow ${mode === 'mem' ? 'on' : ''}" data-act="bt-mode" data-m="mem">🧠 Pamięć</button></div>
    ${mode === 'quiz' ? '<p class="small muted" style="margin:8px 0 0">Każde pytanie ma 4 odpowiedzi do wyboru – wygrywa ten, kto ma więcej poprawnych (przy remisie: szybszy).</p>' : ''}
    ${mode !== 'mem' ? `
      <label class="field"><span>Talia</span><select id="bt-deck">${S.decks.map(dk => `<option value="${dk.id}" ${deck?.id === dk.id ? 'selected' : ''}>${esc(dk.name)}</option>`).join('')}</select></label>
      <div class="grid2">
        <label class="field"><span>Liczba fiszek</span><input type="number" inputmode="numeric" min="3" max="50" data-btopt="n" value="${o.n}"></label>
        <label class="field"><span>Kierunek</span>${sel('dir', [['qa', 'pytanie → odp.'], ['aq', 'odp. → pytanie'], ['mix', 'mieszany']], o.dir)}</label>
        <label class="field"><span>Czas na naukę</span>${sel('learnSec', [[0, 'bez limitu'], [60, '1 min'], [120, '2 min'], [180, '3 min'], [300, '5 min'], [600, '10 min']], o.learnSec)}</label>
        <label class="field"><span>Czas na odpowiedź</span>${sel('ansSec', [[0, 'bez limitu'], [10, '10 s'], [15, '15 s'], [25, '25 s'], [45, '45 s'], [60, '60 s']], o.ansSec)}</label>
        ${mode === 'quiz' ? '' : `<label class="field"><span>Sprawdzanie</span>${sel('tol', [['strict', 'dokładne'], ['normal', 'normalne'], ['lenient', 'łagodne']], o.tol)}</label>`}
        <label class="field"><span>Wynik rywala</span>${sel('live', [['1', 'na żywo'], ['0', 'ukryty do końca']], o.live ? '1' : '0')}</label>
      </div>`
      : `<div class="grid2">
        <label class="field"><span>Dyscyplina</span><select data-btopt="disc">${Object.keys(MEM_DEFAULT).map(k => `<option value="${k}" ${memDisc === k ? 'selected' : ''}>${DISC[k].icon} ${DISC[k].name}</option>`).join('')}</select></label>
        <label class="field"><span>Ile elementów</span><input type="number" inputmode="numeric" min="3" max="${MAX_ITEMS[memDisc]}" data-btopt="memN" value="${o.memN || MEM_DEFAULT[memDisc][0]}"></label>
        <label class="field"><span>Czas zapamiętywania</span>${sel('memSec', [[0, 'bez limitu'], [30, '30 s'], [60, '1 min'], [120, '2 min'], [180, '3 min'], [300, '5 min']], o.memSec)}</label>
      </div>`}
    <label class="field"><span>Poziom bota (bez wpływu na Elo)</span><select id="bt-botlvl">${BOT_LEVELS.map(([n, acc], i) => `<option value="${i}" ${(ms.botLevel ?? 0) === i ? 'selected' : ''}>${n}${acc ? ` (~${Math.round(acc * 100)}%)` : ` – jak Ty (~${Math.round(myBattleAccuracy() * 100)}%)`}</option>`).join('')}</select></label>
    <label class="check"><input type="checkbox" data-btopt="sab" ${o.sab ? 'checked' : ''}> Sabotaże za kryształy</label>
    ${o.sab ? `<div class="small muted">${Object.values(SABOTAGE).map(x => `${x.icon} ${x.name} (${x.cost}💎) – ${x.desc}`).join('<br>')}<br>Max ${SAB_MAX} na bitwę.</div>` : ''}
    <p class="small muted">Zasady ustala twórca pokoju. W teście nie da się wklejać, a wyjście z aplikacji kasuje bieżące pytanie.</p>
  </details>
  ${bs.length ? `<details class="card"><summary><b>📊 Historia</b> <span class="small muted">(${bs.length})</span></summary>
    ${Object.keys(heads).length ? `<h3>Bilans ze znajomymi</h3>${Object.entries(heads).map(([n, h]) => `<div class="kv"><span>${esc(h.av || '')} ${esc(n)}</span><b><span class="c-rev">${h.w}</span> : <span class="c-lrn">${h.l}</span>${h.d ? ` (${h.d} rem.)` : ''}</b></div>`).join('')}` : ''}
    <h3>Ostatnie bitwy</h3>${bs.slice(-10).reverse().map(b => `<div class="kv"><span>${b.won === 1 ? '🏆' : b.won === 0 ? '🤝' : '💪'} ${esc(b.oppAvatar || '')} ${esc(b.opp || 'Bot')} · ${b.mode === 'cards' ? (b.abcd ? '🅰️ ' : '') + esc(b.deck || 'fiszki') : DISC[b.disc]?.name}</span><b>${b.my}:${b.them}</b></div>`).join('')}</details>` : ''}
  <div class="row"><button class="grow sm" data-go="#/shop">🛒 Sklep</button><button class="grow sm" data-go="#/theme">🎨 Motywy</button></div>` };
};
document.addEventListener('toggle', e => { if (e.target.classList?.contains('rules')) { memSettings().rulesOpen = e.target.open; save(); } }, true);
document.addEventListener('change', e => {
  const k = e.target.dataset?.btopt; if (!k) return;
  const ms = memSettings(); ms.bt = ms.bt || {};
  if (k === 'disc') { ms.btDisc = e.target.value; ms.bt.memN = 0; }
  else if (k === 'sab') ms.bt.sab = e.target.checked;
  else if (k === 'live') ms.bt.live = e.target.value === '1';
  else if (['n', 'learnSec', 'ansSec', 'memN', 'memSec'].includes(k)) ms.bt[k] = Math.max(0, +e.target.value || 0);
  else ms.bt[k] = e.target.value;
  save(); if (k === 'disc') render();
});
document.addEventListener('change', e => { if (e.target.id === 'bt-deck') { memSettings().btDeck = e.target.value; save(); } });

// Matchmaking: każdy szukający publikuje „seek” w poczekalni; gracz z większym id dołącza do pokoju drugiego.
function quickMatch() {
  newBattle({ role: 'seeker', phase: 'seeking', seekStart: Date.now() });
  const disc = ['numbers', 'words', 'images'][Math.random() * 3 | 0];
  B.code = roomCode(); B.setup = { mode: 'mem', disc, seed: Math.random() * 1e9 | 0, opts: { sab: true } };
  B.ch = channel('fiszki-room-' + B.code, onRoomMsg);
  const lobby = channel(LOBBY, m => {
    if (!B || B.phase !== 'seeking' || m.t !== 'seek' || Date.now() - m.ts > 45000) return;
    if (MY_ID > m.from) { stopSeek(); B.ch.close(); B.lobby = null; joinRoom(m.room, true); }
  });
  B.lobby = lobby;
  const announce = () => { if (!B || B.phase !== 'seeking') return; lobby.send({ t: 'seek', room: B.code, ts: Date.now(), ...me() }); B.seekTimer = setTimeout(announce, 12000); };
  B.role = 'host'; announce(); B.phase = 'seeking';
  const refresh = setInterval(() => { if (!B || B.phase !== 'seeking') return clearInterval(refresh); renderBattle(); }, 5000);
  go('#/battle');
}
function stopSeek() { if (!B) return; clearTimeout(B.seekTimer); B.lobby?.close(); }
function startBot(setup, level) {
  const bp = botParams(level);
  newBattle({ role: 'bot', setup, botLevel: level, botP: bp, opp: { nick: `Bot ${bp.name.toLowerCase()}`, avatar: '🤖', level: Math.round(bp.acc * 20) } });
  startCountdown(); go('#/battle');
}
function friendSetup() {
  const ms = memSettings(), o = btOpts();
  if ((ms.btMode || 'cards') === 'mem') {
    const disc = ms.btDisc || 'numbers';
    return { mode: 'mem', disc, seed: Math.random() * 1e9 | 0, n: clamp(o.memN || MEM_DEFAULT[disc][0], 3, MAX_ITEMS[disc]), memo: o.memSec, opts: { sab: o.sab } };
  }
  const deckId = $('#bt-deck')?.value || (deckById(ms.btDeck) || S.decks[0])?.id;
  const abcd = ms.btMode === 'quiz';
  const cards = battleCards(deckId, clamp(o.n, 3, 50), o.dir, abcd);
  if (cards.length < 3) { toast('W tej talii jest za mało fiszek tekstowych (min. 3)'); return null; }
  if (abcd && cards.some(c => c.opts.length < 2)) { toast('Do quizu ABCD talia potrzebuje kilku różnych odpowiedzi'); return null; }
  return { mode: 'cards', deckId, deckName: deckById(deckId)?.name, cards, opts: { learnSec: o.learnSec, ansSec: o.ansSec, tol: o.tol, live: o.live, sab: o.sab, abcd } };
}

Object.assign(ACTIONS, {
  'bt-quick': () => quickMatch(),
  'bt-bot-now': () => { const st = B.setup; stopSeek(); B.ch?.close(); startBot(st, memSettings().botLevel ?? 0); },
  'bt-mode': el => { memSettings().btMode = el.dataset.m; save(); render(); },
  'bt-host': () => { const st = friendSetup(); if (st) hostRoom(st); },
  'bt-bot': () => { const st = friendSetup(); if (!st) return; const lv = $('#bt-botlvl') ? +$('#bt-botlvl').value : (memSettings().botLevel ?? 0); memSettings().botLevel = lv; save(); startBot(st, lv); },
  'bt-join': () => { const c = $('#bt-code').value.trim().toUpperCase(); if (c.length !== 6) return toast('Kod ma 6 znaków'); joinRoom(c); },
  'bt-quit': () => { if (B && B.phase !== 'end' && B.phase !== 'wait' && !confirm('Opuścić bitwę? Przeciwnik wygra walkowerem.')) return; quitBattle(); },
  'bt-ready': () => {
    const n = B.setup.cards?.length || 0;
    if (B.setup.mode === 'cards' && B.seen.size < n && !confirm(`Obejrzałeś ${B.seen.size} z ${n} fiszek. Przejść do testu?`)) return;
    beginRecall();
  },
  'bt-flip': () => { B.lflip = !B.lflip; render(); },
  'bt-lnav': el => { const n = B.setup.cards.length; B.li = (B.li + +el.dataset.d + n) % n; B.lflip = false; B.seen.add(B.li); render(); },
  'bt-submit': () => submitAnswer($('#bt-in').value.trim()),
  'bt-abcd': el => { const it = B?.setup?.cards[B.order[B.cur]]; if (it?.opts) submitAnswer(it.opts[+el.dataset.k]); },
  'bt-skip': () => submitAnswer(''),
  'bt-sab': el => { useSabotage(el.dataset.k); renderBattle(); },
  'bt-cram-mistakes': () => {
    // błędne fiszki z bitwy jako szybka nauka (bez harmonogramu): pytanie → odpowiedź
    const wrong = B.setup.cards.filter((_, i) => !B.myAns.find(a => a.i === i)?.ok);
    QUIZ = null; B.review = { list: shuffle([...wrong]), i: 0, shown: false }; render(); scrollTo(0, 0);
  },
  'bt-rv-show': () => { B.review.shown = true; render(); },
  'bt-rv-next': () => { B.review.i++; B.review.shown = false; render(); },
  'bt-rv-close': () => { B.review = null; render(); },
  'bt-rm': () => { if (!B || B.phase !== 'end') return; B.rmMine = true; B.ch?.send({ t: 'rm' }); maybeRematch(); renderBattle(); },
  'bt-new-opp': () => { const wasBot = B?.role === 'bot'; if (B) { if (B.phase !== 'end') B.ch?.send({ t: 'bye' }); else B.ch?.send({ t: 'bye' }); B.ch?.close(); (B.botTimers || []).forEach(clearTimeout); clearInterval(B.uiTimer); }
    B = null; GAME = null; void wasBot; quickMatch(); },
  'bt-walkover': () => { B.oppLeft = true; maybeFinish(); },
  'bt-rematch': () => { const st = B.setup; const lv = B.botLevel;
    const fresh = st.mode === 'mem' ? { ...st, seed: Math.random() * 1e9 | 0 } : { ...st, cards: shuffle([...st.cards]) }; startBot(fresh, lv); },
  'bt-share': async el => {
    const link = el.dataset.link, text = `⚔️ Wyzywam Cię na bitwę w Fiszkach! Kod: ${B.code}`;
    if (navigator.share) { try { await navigator.share({ title: 'Bitwa – Fiszki', text, url: link }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(`${text}\n${link}`); toast('Skopiowano zaproszenie'); } catch { prompt('Skopiuj:', link); }
  },
  'bt-sticker': el => {
    if (Date.now() - lastSticker < 2500) return; lastSticker = Date.now();
    const shiny = isShiny(el.dataset.k);
    B?.ch?.send({ t: 'st', k: el.dataset.k, shiny }); stickerFx(el.dataset.k, 'Ty', shiny);
    if (B?.role === 'bot' && Math.random() < .5) setTimeout(() => stickerFx(['wave', 'thumb', 'phew'][Math.random() * 3 | 0], B?.opp?.nick), 1200);
  },
  'bt-mic': () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
    if (speech) { speech.stop(); return; }
    speech = new SR(); speech.lang = 'pl-PL'; speech.interimResults = false; speech.maxAlternatives = 3;
    speech.onresult = e => { const alts = [...e.results[0]].map(r => r.transcript.trim()); const it = B.setup.cards[B.order[B.cur]];
      const best = alts.find(a => judge(a, it.a)) || alts[0]; const inp = $('#bt-in'); if (inp) inp.value = best; };
    speech.onend = () => { speech = null; renderBattle(); const v = $('#bt-in')?.value.trim(); if (v) submitAnswer(v); };
    speech.onerror = e => { toast('Mikrofon: ' + e.error); };
    speech.start(); render();
  },
});

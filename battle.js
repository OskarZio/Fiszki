'use strict';
/* Bitwy 1 na 1 w czasie rzeczywistym.
   - Tryb „Fiszki”: obaj uczą się tego samego zestawu; kto szybciej się nauczy, ten wcześniej zaczyna odtwarzać
     (wpisując albo mówiąc). Każda dobra odpowiedź zadaje przeciwnikowi obrażenia.
   - Tryb „Pamięć”: ten sam ciąg liczb/słów/obrazów u obu graczy (wspólne ziarno losowania), rozliczenie na końcu.
   Wiadomości idą przez publiczny przekaźnik ntfy.sh (losowy, trudny do zgadnięcia kanał pokoju).
   Każdy klient sam sprawdza odpowiedzi przeciwnika na podstawie własnej kopii zestawu – nie ufa wynikowi „z drugiej strony”. */

const RELAY = 'https://ntfy.sh';
const LOBBY = 'fiszki-lobby-v1';
const MY_ID = uid() + uid();
let B = null;            // bieżąca bitwa
const BOT_LEVELS = [['Łatwy', .55, [5, 10]], ['Średni', .75, [3, 7]], ['Trudny', .92, [2, 4.5]]];
const MEM_BATTLE = { numbers: [40, 60], words: [20, 60], images: [20, 60] };

// ============================================================ Kanał komunikacji
function channel(topic, onMsg) {
  const handle = m => { if (!m || m.from === MY_ID) return; onMsg(m); };
  const chunks = {};
  const recv = m => {
    if (m.t !== 'chunk') return handle(m);
    const c = chunks[m.cid] || (chunks[m.cid] = []); c[m.i] = m.d;
    if (c.filter(x => x != null).length === m.n) { delete chunks[m.cid]; try { handle(JSON.parse(c.join(''))); } catch { /* */ } }
  };
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
const me = () => ({ nick: S.profile.nick || 'Gracz', avatar: S.profile.avatar || '🦊', level: levelOf(xpTotal()) });
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
// Zestaw fiszek do bitwy – tylko tekst (bez obrazów), z kart talii
function battleCards(deckId, n) {
  const out = [];
  for (const c of shuffle(S.cards.filter(c => c.deckId === deckId))) {
    const note = noteById(c.noteId); if (!note) continue;
    if (note.type === 'basic') { const f = c.ord === 'r' ? note.back : note.front, b = c.ord === 'r' ? note.front : note.back; if (f.trim() && b.trim() && b.length < 80) out.push({ q: f, a: b }); }
    else if (note.type === 'cloze') { const v = cardView(c); if (v.ans && v.ans.length < 80) out.push({ q: clozePlainQ(note.text, c.ord), a: v.ans }); }
    if (out.length >= n) break;
  }
  return out;
}
const clozePlainQ = (text, ord) => text.replace(CLOZE_RE, (m, num, ans, hint) => num === ord ? `[${hint || '…'}]` : ans);

// ============================================================ Start bitwy
function newBattle(o) {
  B && B.ch?.close();
  B = { id: uid(), phase: 'wait', myAns: [], oppAns: [], myBlur: 0, oppBlur: 0, events: [], opp: null, lastOpp: Date.now(), ...o };
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
    B.opp = { id: m.from, nick: m.nick, avatar: m.avatar, level: m.level };
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
    const ok = !!m.given && checkAnswer(m.given, it.a) !== 'wrong';     // sprawdzamy sami
    B.oppAns.push({ i: m.i, given: m.given, ok, ms: m.ms });
    if (ok) hitFx('me');
  }
  if (m.t === 'mans') { B.oppMem = m.answers; B.oppRecallMs = m.ms; }
  if (m.t === 'done') { B.oppDone = true; B.oppTotalMs = m.total; }
  if (m.t === 'blur') { B.oppBlur++; toast(`⚠️ ${B.opp?.nick || 'Przeciwnik'} opuścił aplikację`, 2500); }
  if (m.t === 'st') stickerFx(m.k, B.opp?.nick);
  if (m.t === 'bye') { B.oppLeft = true; toast(`${B.opp?.nick || 'Przeciwnik'} opuścił bitwę`, 3000); }
  maybeFinish(); renderBattle();
}
function startCountdown() {
  B.phase = 'countdown'; B.goAt = Date.now() + 3500; renderBattle();
  const t = setInterval(() => { if (!B || B.phase !== 'countdown') return clearInterval(t); if (Date.now() >= B.goAt) { clearInterval(t); beginLearn(); } else renderBattle(); }, 250);
}
function beginLearn() {
  const st = B.setup;
  B.phase = 'learn'; B.learnStart = Date.now();
  if (st.mode === 'mem') {
    const [n, t] = MEM_BATTLE[st.disc];
    GAME = { d: st.disc, n, t, items: memItems(st.disc, n, st.seed), phase: 'memo', group: DISC[st.disc].group, pos: 0, start: Date.now(), loci: [], battle: true };
  } else B.learnLimit = clamp(st.cards.length * 12, 60, 240) * 1000;
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
  if (B.phase !== 'recall' || B.setup.mode !== 'cards') return;
  const i = B.order[B.cur], it = B.setup.cards[i];
  const ok = !!given && checkAnswer(given, it.a) !== 'wrong';
  B.myAns.push({ i, given, ok, ms: Date.now() - B.cardStart });
  B.ch?.send({ t: 'ans', i, given, ms: Date.now() - B.cardStart });
  if (ok) hitFx('opp'); else floatText('✗ ' + it.a);
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
    const items = GAME?.items || memItems(B.setup.disc, MEM_BATTLE[B.setup.disc][0], B.setup.seed);
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
    my: sc.my, them: sc.opp, n: sc.n, won, bot: B.role === 'bot', myMs: B.myTotalMs, oppMs: B.oppTotalMs, blur: B.myBlur };
  S.battles.push(rec);
  if (won === 1) {
    addItem('case', B.setup.mode === 'cards' && sc.n >= 10 && B.role !== 'bot' ? 'epic' : 'basic', 1, 'case-' + B.id);
    S.stats.battleWins = (S.stats.battleWins || 0) + 1;
    const streakNow = (() => { let n = 0; for (let i = S.battles.length - 1; i >= 0 && S.battles[i].won === 1; i--) n++; return n; })();
    S.stats.winStreak = Math.max(S.stats.winStreak || 0, streakNow);
    setTimeout(() => celebrate('🏆 Zwycięstwo!', `+${battleReward(rec)} 💎 i darmowa skrzynka`), 300);
  } else if (won === 0) toast('🤝 Remis!'); else toast('💪 Tym razem przegrana – rewanż?', 3000);
  save(); B.ch?.send({ t: 'done', total: B.myTotalMs }); renderBattle();
}
function quitBattle() {
  if (B) { if (B.phase !== 'end') B.ch?.send({ t: 'bye' }); B.ch?.close(); clearInterval(B.botTimer); }
  B = null; GAME = null; go('#/battles');
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'hidden' || !B || B.phase !== 'recall') return;
  B.myBlur++; B.ch?.send({ t: 'blur' });
  if (B.setup.mode === 'cards') { submitAnswer(''); toast('⚠️ Wyjście z aplikacji w trakcie odpowiedzi = pytanie stracone', 4000); }
});

// ============================================================ Bot
function botPlay() {
  const [, acc, [a, b]] = BOT_LEVELS[B.botLevel];
  const st = B.setup;
  if (st.mode === 'mem') {
    const n = MEM_BATTLE[st.disc][0], items = GAME.items;
    const learn = (30 + Math.random() * 25) * 1000;
    setTimeout(() => { if (!B) return; B.oppReady = true; B.oppLearnMs = learn; renderBattle(); }, learn);
    setTimeout(() => { if (!B) return; B.oppMem = items.map(x => Math.random() < acc ? x : null); B.oppDone = true; B.oppTotalMs = learn + n * 1500; maybeFinish(); renderBattle(); }, learn + n * 1500);
    return;
  }
  const n = st.cards.length, learn = clamp(n * (10 - acc * 6), 20, 200) * 1000 * (0.8 + Math.random() * .4);
  let t = learn, total = learn;
  setTimeout(() => { if (!B) return; B.oppReady = true; B.oppLearnMs = learn; renderBattle(); }, learn);
  shuffle(st.cards.map((_, i) => i)).forEach((i, k) => {
    const d = (a + Math.random() * (b - a)) * 1000; t += d; total = t;
    setTimeout(() => { if (!B || B.phase === 'end') return; const ok = Math.random() < acc; B.oppAns.push({ i, given: ok ? st.cards[i].a : '…', ok, ms: d }); if (ok) hitFx('me');
      if (k === n - 1) { B.oppDone = true; B.oppTotalMs = total; maybeFinish(); } renderBattle(); }, t);
  });
}

// ============================================================ Efekty bitwy
function hitFx(who) {
  const el = $(who === 'me' ? '#hp-me' : '#hp-opp'); if (!el) return;
  el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
  tick(who === 'me' ? 220 : 520, .08, .1);
}
function stickerFx(k, from) {
  const s = stickerById(k); if (!s) return;
  const el = document.createElement('div'); el.className = 'stfly'; el.style.setProperty('--rc', RARITY[s.r].color);
  el.innerHTML = `<span>${s.e}</span><small>${esc(from || 'Ty')}: ${esc(s.name)}</small>`;
  document.body.append(el); setTimeout(() => el.remove(), 2600);
}
let lastSticker = 0;

// ============================================================ Widoki
function hpBars() {
  const sc = B.setup ? scores() : { my: 0, opp: 0, n: 1 };
  const reveal = B.setup?.mode !== 'mem' || B.phase === 'end';
  const myHp = 100 - (reveal ? sc.opp : 0) / sc.n * 100, oppHp = 100 - (reveal ? sc.my : 0) / sc.n * 100;
  const tug = clamp(50 + ((reveal ? sc.my - sc.opp : 0) / sc.n) * 50, 3, 97);
  const op = B.opp || { nick: '…', avatar: '❔' }, m = me();
  const state = (ready, done) => done ? '✅ skończył' : ready ? '⚔️ odpowiada' : B.phase === 'learn' || B.phase === 'recall' || B.phase === 'waitopp' ? '📖 uczy się' : '';
  return `<div class="arena">
    <div class="fighter"><span class="av">${esc(m.avatar)}</span><b>${esc(m.nick)}</b><div class="hp" id="hp-me"><div style="width:${myHp}%"></div></div><small>${Math.round(myHp)} HP · ${state(B.phase !== 'learn', B.myDone)}</small></div>
    <div class="vs">VS</div>
    <div class="fighter r"><span class="av">${esc(op.avatar)}</span><b>${esc(op.nick)}</b><div class="hp opp" id="hp-opp"><div style="width:${oppHp}%"></div></div><small>${Math.round(oppHp)} HP · ${state(B.oppReady, B.oppDone)}</small></div>
  </div><div class="tug"><div class="tugfill" style="width:${tug}%"></div><span class="knot" style="left:${tug}%">⚔️</span></div>`;
}
function stickerBar() {
  return `<div class="stbar">${ownedStickers().map(id => { const s = stickerById(id); return `<button data-act="bt-sticker" data-k="${id}" style="--rc:${RARITY[s.r].color}">${s.e}</button>`; }).join('')}</div>`;
}
function renderBattle() { if (parseRoute().parts[0] === 'battle') render(); }
let speech = null;
ROUTES.battle = () => {
  if (!B) return { html: `<p>Brak aktywnej bitwy. <a href="#/battles">Bitwy</a></p>` };
  const close = `<button class="iconbtn" data-act="bt-quit">✕</button>`;
  if (B.phase === 'wait') {
    const link = APP_URL() + '#/battles?join=' + B.code;
    return { focus: true, html: `<div class="studybar">${close}<div class="title">⚔️ Pokój bitwy</div></div>
      <div class="card center"><p>Podaj znajomemu kod:</p><div class="code">${B.code}</div>
      <p class="small muted">${B.setup.mode === 'cards' ? `Fiszki: ${esc(B.setup.deckName)} · ${B.setup.cards.length} kart` : `Pamięć: ${DISC[B.setup.disc].name}`}</p>
      <button class="primary block" data-act="bt-share" data-link="${esc(link)}">📤 Wyślij zaproszenie</button>
      <div class="spinner"></div><p class="small muted">Czekam na przeciwnika…</p></div>` };
  }
  if (B.phase === 'joining' || B.phase === 'seeking') {
    return { focus: true, html: `<div class="studybar">${close}<div class="title">⚔️ ${B.phase === 'seeking' ? 'Szukam przeciwnika' : 'Dołączam'}</div></div>
      <div class="card center"><div class="spinner"></div><p>${B.phase === 'seeking' ? 'Szukam gracza, który też chce walczyć…' : `Łączę z pokojem <b>${esc(B.code)}</b>…`}</p>
      ${B.phase === 'seeking' && Date.now() - B.seekStart > 25000 ? `<p class="small muted">Nikogo jeszcze nie ma.</p><button class="block" data-act="bt-bot-now">🤖 Zagraj z botem</button>` : ''}</div>` };
  }
  if (B.phase === 'countdown') {
    const s = Math.max(1, Math.ceil((B.goAt - Date.now()) / 1000));
    return { focus: true, html: hpBars() + `<div class="countdown">${s}</div><p class="center">${B.setup.mode === 'cards' ? `📖 Naucz się ${B.setup.cards.length} fiszek, potem odtwórz je z pamięci` : `🧠 ${DISC[B.setup.disc].name}: zapamiętaj i odtwórz`}</p>` };
  }
  const head = `<div class="studybar">${close}<div class="title">⚔️ Bitwa</div><b class="timer" id="btimer"></b></div>` + hpBars();
  if (B.setup.mode === 'mem' && (B.phase === 'learn' || B.phase === 'recall') && GAME?.battle) {
    onMount(mountGameTimer);
    const inner = GAME.phase === 'memo' ? gameMemo(GAME, DISC[GAME.d]) : gameRecall(GAME, DISC[GAME.d]);
    return { focus: true, html: `<div class="studybar">${close}<div class="title">⚔️ ${GAME.phase === 'memo' ? 'Zapamiętuj' : 'Odtwórz'}</div><b id="gtimer" class="timer"></b></div>${hpBars()}${inner}${stickerBar()}` };
  }
  if (B.phase === 'learn') {
    onMount(battleTimer);
    return { focus: true, html: head + `<p class="small muted center">Ucz się! Gdy będziesz gotowy, zaczniesz odtwarzanie – liczy się też czas.</p>
      <div class="card">${B.setup.cards.map(c => `<div class="kv"><span class="grow">${fmt(c.q)}</span><b style="margin-left:10px;text-align:right">${fmt(c.a)}</b></div>`).join('')}</div>
      <div class="answerbar"><button class="primary block" data-act="bt-ready" style="min-height:56px">✅ Umiem – odtwarzam!</button></div>${stickerBar()}` };
  }
  if (B.phase === 'recall') {
    const i = B.order[B.cur], it = B.setup.cards[i];
    onMount(() => {
      battleTimer();
      const inp = $('#bt-in'); inp.focus({ preventScroll: true });
      inp.addEventListener('paste', e => { e.preventDefault(); toast('Wklejanie jest wyłączone w bitwie 😉'); });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitAnswer(inp.value.trim()); } });
    });
    const hasSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    return { focus: true, html: head + `<div class="row small muted"><span class="grow">Pytanie ${B.cur + 1}/${B.order.length}</span><span id="cardleft"></span></div>
      <div class="card flash"><div class="ctext">${fmt(it.q)}</div></div>
      <div class="row nowrap"><input id="bt-in" class="grow" placeholder="Odpowiedź…" autocomplete="off" autocapitalize="off" spellcheck="false">
        ${hasSpeech ? `<button data-act="bt-mic" class="${speech ? 'primary' : ''}" title="Powiedz odpowiedź">🎤</button>` : ''}</div>
      <div class="spacer"></div><div class="row nowrap"><button class="grow" data-act="bt-skip">Nie wiem</button><button class="primary grow" data-act="bt-submit">Odpowiedz ➤</button></div>
      ${stickerBar()}` };
  }
  if (B.phase === 'waitopp') {
    return { focus: true, html: head + `<div class="card center"><div class="spinner"></div><p>Skończyłeś! Czekam, aż ${esc(B.opp?.nick || 'przeciwnik')} skończy…</p>
      ${Date.now() - B.lastOpp > 90000 ? '<button class="block" data-act="bt-walkover">Przeciwnik nie odpowiada – zakończ (walkower)</button>' : ''}</div>${stickerBar()}` };
  }
  // koniec
  const r = B.result, rec = S.battles.find(x => x.id === B.id);
  const caseKind = hasItem('case', 'epic') ? 'epic' : 'basic';
  return { focus: true, html: `<div class="studybar">${close}<div class="title">⚔️ Wynik</div></div>${hpBars()}
    <div class="card center result-${r.won}"><div style="font-size:60px">${r.won === 1 ? '🏆' : r.won === 0 ? '🤝' : '💪'}</div>
      <h2 style="margin:4px 0">${r.won === 1 ? 'Zwycięstwo!' : r.won === 0 ? 'Remis' : 'Porażka'}</h2>
      <p><b>${r.my}</b> : <b>${r.opp}</b> <span class="muted">(z ${r.n})</span></p>
      <p class="small muted">Twój czas: ${fmtTime(B.myTotalMs || 0)}${B.oppTotalMs ? ` · przeciwnik: ${fmtTime(B.oppTotalMs)}` : ''}${B.myBlur || B.oppBlur ? ` · wyjścia z aplikacji: Ty ${B.myBlur}, przeciwnik ${B.oppBlur}` : ''}</p>
      <p><b class="coins">+${rec ? battleReward(rec) : 0} 💎</b></p>
      ${r.won === 1 && hasItem('case', caseKind) ? `<button class="primary block" data-go="#/case/${caseKind}?free=1" style="min-height:56px">🎁 Otwórz darmową skrzynkę!</button><div class="spacer"></div>` : ''}
      ${B.setup.mode === 'cards' ? `<details class="small"><summary>Odpowiedzi</summary>${B.setup.cards.map((c, i) => { const a = B.myAns.find(x => x.i === i);
        return `<div class="kv"><span class="grow">${esc(c.q)}</span><span class="${a?.ok ? 'c-rev' : 'c-lrn'}">${a?.ok ? '✓' : '✗'} ${esc(c.a)}</span></div>`; }).join('')}</details>` : ''}
      <div class="row"><button class="grow" data-act="bt-quit">Zakończ</button>${B.role === 'bot' ? `<button class="primary grow" data-act="bt-rematch">🔁 Rewanż</button>` : ''}</div></div>` };
};
function battleTimer() {
  clearInterval(B.uiTimer);
  B.uiTimer = setInterval(() => {
    if (!B || !$('#btimer') && !$('#cardleft')) return clearInterval(B?.uiTimer);
    if (B.phase === 'learn') {
      const left = B.learnLimit - (Date.now() - B.learnStart);
      if ($('#btimer')) $('#btimer').textContent = fmtTime(Math.max(0, left));
      if (left <= 0) beginRecall();
    } else if (B.phase === 'recall') {
      const left = 25000 - (Date.now() - B.cardStart);
      if ($('#btimer')) $('#btimer').textContent = fmtTime(Date.now() - B.learnStart);
      if ($('#cardleft')) $('#cardleft').textContent = `⏱ ${Math.ceil(Math.max(0, left) / 1000)} s`;
      if (left <= 0) submitAnswer($('#bt-in')?.value.trim() || '');
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

// ============================================================ Ekran bitew (matchmaking)
ROUTES.battles = (parts, q) => {
  if (q.get('join')) { const code = q.get('join'); setTimeout(() => joinRoom(code), 30); }
  const bs = S.battles, w = bs.filter(b => b.won === 1).length, l = bs.filter(b => b.won === -1).length, d = bs.filter(b => b.won === 0).length;
  const heads = {}; bs.filter(b => !b.bot).forEach(b => { const h = heads[b.opp] || (heads[b.opp] = { w: 0, l: 0, d: 0, av: b.oppAvatar }); h[b.won === 1 ? 'w' : b.won === -1 ? 'l' : 'd']++; });
  const ms = memSettings();
  return { tab: 'train', html: `
  <div class="row nowrap"><h1 class="grow">⚔️ Bitwy</h1>${coinsHTML()}</div>
  <div class="card hero-card"><div class="hero">
    <div class="stat"><b class="c-rev">${w}</b><small>wygrane</small></div><div class="stat"><b>${d}</b><small>remisy</small></div>
    <div class="stat"><b class="c-lrn">${l}</b><small>przegrane</small></div><div class="stat"><b>${bs.length ? Math.round(w / bs.length * 100) : 0}%</b><small>skuteczność</small></div></div></div>
  <button class="primary block big-btn" data-act="bt-quick">⚡ Szybki mecz – losowy przeciwnik</button>
  <p class="small muted center">Pojedynek pamięci (liczby, słowa albo obrazy) z kimkolwiek, kto akurat szuka gry.</p>
  <div class="card"><h2 style="margin-top:0">👥 Wyzwij znajomego</h2>
    <div class="seg" style="display:flex"><button class="grow ${(ms.btMode || 'cards') === 'cards' ? 'on' : ''}" data-act="bt-mode" data-m="cards">📚 Fiszki</button><button class="grow ${ms.btMode === 'mem' ? 'on' : ''}" data-act="bt-mode" data-m="mem">🧠 Pamięć</button></div>
    ${(ms.btMode || 'cards') === 'cards' ? `<div class="row nowrap"><label class="field grow"><span>Talia</span><select id="bt-deck">${S.decks.map(dk => `<option value="${dk.id}">${esc(dk.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Ile kart</span><select id="bt-n"><option>5</option><option selected>10</option><option>15</option><option>20</option></select></label></div>`
      : `<label class="field"><span>Dyscyplina</span><select id="bt-disc">${Object.keys(MEM_BATTLE).map(k => `<option value="${k}">${DISC[k].icon} ${DISC[k].name} (${MEM_BATTLE[k][0]})</option>`).join('')}</select></label>`}
    <div class="row"><button class="primary grow" data-act="bt-host">Utwórz pokój</button><button class="grow" data-act="bt-bot">🤖 Z botem</button></div>
    <label class="field"><span>Poziom bota</span><select id="bt-botlvl">${BOT_LEVELS.map(([n], i) => `<option value="${i}" ${(ms.botLevel ?? 1) === i ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <h3>Masz kod od znajomego?</h3>
    <div class="row nowrap"><input id="bt-code" class="grow" placeholder="np. K7M2QX" maxlength="6" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:3px"><button data-act="bt-join">Dołącz</button></div></div>
  <div class="row"><button class="grow" data-go="#/shop">🛒 Sklep i skrzynki</button><button class="grow" data-go="#/theme">🎨 Motywy</button></div>
  ${Object.keys(heads).length ? `<div class="card"><h3 style="margin-top:0">Bilans ze znajomymi</h3>${Object.entries(heads).map(([n, h]) => `<div class="kv"><span>${esc(h.av || '')} ${esc(n)}</span><b><span class="c-rev">${h.w}</span> : <span class="c-lrn">${h.l}</span>${h.d ? ` (${h.d} rem.)` : ''}</b></div>`).join('')}</div>` : ''}
  ${bs.length ? `<div class="card"><h3 style="margin-top:0">Ostatnie bitwy</h3>${bs.slice(-10).reverse().map(b => `<div class="kv"><span>${b.won === 1 ? '🏆' : b.won === 0 ? '🤝' : '💪'} ${esc(b.oppAvatar || '')} ${esc(b.opp || 'Bot')} · ${b.mode === 'cards' ? esc(b.deck || 'fiszki') : DISC[b.disc]?.name}</span><b>${b.my}:${b.them}</b></div>`).join('')}</div>` : ''}
  <p class="small muted">Uczciwa gra: w trakcie odtwarzania wklejanie jest wyłączone, wyjście z aplikacji kasuje bieżące pytanie i jest widoczne dla przeciwnika, a każdy telefon sam sprawdza odpowiedzi drugiej strony.</p>` };
};

// Matchmaking: każdy szukający publikuje „seek” w poczekalni; gracz z większym id dołącza do pokoju drugiego.
function quickMatch() {
  newBattle({ role: 'seeker', phase: 'seeking', seekStart: Date.now() });
  const disc = ['numbers', 'words', 'images'][Math.random() * 3 | 0];
  B.code = roomCode(); B.setup = { mode: 'mem', disc, seed: Math.random() * 1e9 | 0 };
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
  newBattle({ role: 'bot', setup, botLevel: level, opp: { nick: `Bot ${BOT_LEVELS[level][0].toLowerCase()}`, avatar: '🤖', level: [3, 8, 15][level] } });
  startCountdown(); go('#/battle');
}
function friendSetup() {
  const ms = memSettings();
  if ((ms.btMode || 'cards') === 'mem') return { mode: 'mem', disc: $('#bt-disc').value, seed: Math.random() * 1e9 | 0 };
  const deckId = $('#bt-deck')?.value, n = +$('#bt-n').value;
  const cards = battleCards(deckId, n);
  if (cards.length < 3) { toast('W tej talii jest za mało fiszek tekstowych (min. 3)'); return null; }
  return { mode: 'cards', deckName: deckById(deckId)?.name, cards };
}

Object.assign(ACTIONS, {
  'bt-quick': () => quickMatch(),
  'bt-bot-now': () => { const st = B.setup; stopSeek(); B.ch?.close(); startBot(st, memSettings().botLevel ?? 1); },
  'bt-mode': el => { memSettings().btMode = el.dataset.m; save(); render(); },
  'bt-host': () => { const st = friendSetup(); if (st) hostRoom(st); },
  'bt-bot': () => { const st = friendSetup(); if (!st) return; const lv = +$('#bt-botlvl').value; memSettings().botLevel = lv; save(); startBot(st, lv); },
  'bt-join': () => { const c = $('#bt-code').value.trim().toUpperCase(); if (c.length !== 6) return toast('Kod ma 6 znaków'); joinRoom(c); },
  'bt-quit': () => { if (B && B.phase !== 'end' && B.phase !== 'wait' && !confirm('Opuścić bitwę? Przeciwnik wygra walkowerem.')) return; quitBattle(); },
  'bt-ready': () => beginRecall(),
  'bt-submit': () => submitAnswer($('#bt-in').value.trim()),
  'bt-skip': () => submitAnswer(''),
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
    B?.ch?.send({ t: 'st', k: el.dataset.k }); stickerFx(el.dataset.k, 'Ty');
    if (B?.role === 'bot' && Math.random() < .5) setTimeout(() => stickerFx(['wave', 'thumb', 'phew'][Math.random() * 3 | 0], B?.opp?.nick), 1200);
  },
  'bt-mic': () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
    if (speech) { speech.stop(); return; }
    speech = new SR(); speech.lang = 'pl-PL'; speech.interimResults = false; speech.maxAlternatives = 3;
    speech.onresult = e => { const alts = [...e.results[0]].map(r => r.transcript.trim()); const it = B.setup.cards[B.order[B.cur]];
      const best = alts.find(a => checkAnswer(a, it.a) !== 'wrong') || alts[0]; const inp = $('#bt-in'); if (inp) inp.value = best; };
    speech.onend = () => { speech = null; renderBattle(); const v = $('#bt-in')?.value.trim(); if (v) submitAnswer(v); };
    speech.onerror = e => { toast('Mikrofon: ' + e.error); };
    speech.start(); render();
  },
});

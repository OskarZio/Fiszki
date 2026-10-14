'use strict';
/* 🎤 Teleturniej (BETA) – w stylu Buzz! / Brain Show. Ty + do 3 botów, pytania ABCD z Twojej talii, 4 rundy:
   ⚡ Szybkie palce (im szybciej, tym więcej) · 💰 Wszystko albo nic (zakład przed pytaniem) ·
   🦊 Złodziej punktów (najszybszy poprawny kradnie od lidera) · 🏔️ Finał (pula maleje – pierwszy poprawny bierze wszystko).
   Na razie dostępny z panelu hosta; bez nagród (beta). */

const SHOW_COLORS = [['#ef4444', 'Czerwony'], ['#3b82f6', 'Niebieski'], ['#22c55e', 'Zielony'], ['#eab308', 'Żółty']];
const SHOW_ANS = ['#2563eb', '#f97316', '#16a34a', '#eab308'];   // kolory przycisków odpowiedzi jak w Buzz!
const SHOW_BOTS = [['Robo-Rysiek', '🤖'], ['Profesor Sowa', '🦉'], ['Lisica Lena', '🦊'], ['Mózg Marek', '🧠'], ['Kot Bonifacy', '🐱']];
const SHOW_LEVELS = { easy: { name: 'Łatwi', acc: .5, fast: 1.25 }, mid: { name: 'Średni', acc: .68, fast: 1 }, hard: { name: 'Trudni', acc: .85, fast: .75 } };
const SHOW_ROUNDS = [
  { k: 'speed', icon: '⚡', name: 'Szybkie palce', n: 5, sec: 10, desc: 'Poprawna odpowiedź: do 1000 pkt – im szybciej, tym więcej.' },
  { k: 'bet', icon: '💰', name: 'Wszystko albo nic', n: 4, sec: 12, desc: 'Przed pytaniem obstawiasz 100, 250 albo 500. Dobrze: zyskujesz, źle: tracisz.' },
  { k: 'steal', icon: '🦊', name: 'Złodziej punktów', n: 4, sec: 10, desc: 'Najszybszy z poprawną odpowiedzią kradnie 300 pkt liderowi. Błąd: −100.' },
  { k: 'final', icon: '🏔️', name: 'Finał: odliczanie', n: 5, sec: 10, desc: 'Pula spada z 1500. Pierwszy poprawny bierze pulę – błędna odpowiedź blokuje Cię na to pytanie.' },
];
const HOST_LINES = {
  ok: ['Brawo!', 'Ależ refleks!', 'Tak jest!', 'Mistrzowsko!', 'Publiczność szaleje!'],
  bad: ['Ojej…', 'Niestety nie!', 'Blisko, ale nie!', 'Ups!', 'Następnym razem!'],
  slow: ['Czas minął!', 'Za wolno!', 'Tik-tak… koniec!'],
};
const pick = a => a[Math.random() * a.length | 0];
let SHOW = null;

function showSfx(kind) {
  try {
    const ac = typeof fxCtxGet === 'function' ? fxCtxGet() : null; if (!ac || typeof FX === 'undefined') return;
    if (kind === 'ok') fxNotes(ac, [784, 1047], { step: .08, type: 'triangle', v: .12, last: .3 });
    else if (kind === 'bad') fxTone(ac, { f: 300, f2: 140, type: 'sawtooth', d: .35, v: .08 });
    else if (kind === 'buzz') fxTone(ac, { f: 220, type: 'square', d: .18, v: .08, trem: .8, tremF: 30 });
    else if (kind === 'round') FX.fanfare(ac);
    else if (kind === 'tick') fxTone(ac, { f: 1200, d: .05, v: .06 });
  } catch { /* */ }
}
function showQuestions(deckId, need) {
  let pool = battleCards(deckId, 200, 'qa', true).filter(c => c.opts && c.opts.length >= 3);
  if (!pool.length) return [];
  const out = []; while (out.length < need) out.push(...shuffle(pool.map(c => ({ ...c, opts: shuffle([...c.opts]) }))));
  return out.slice(0, need);
}
function showStart(o) {
  const total = SHOW_ROUNDS.reduce((a, r) => a + r.n, 0), qs = showQuestions(o.deckId, total);
  if (qs.length < 3) return toast('W tej talii za mało fiszek tekstowych z różnymi odpowiedziami (min. 4).', 4500);
  const lv = SHOW_LEVELS[o.level] || SHOW_LEVELS.mid, bots = shuffle([...SHOW_BOTS]).slice(0, o.bots);
  const players = [{ id: 'me', name: S.profile.nick || 'Ty', av: S.profile.avatar || '🦊', img: safeImg(S.profile.avatarImg), color: SHOW_COLORS[0][0], score: 0, me: true },
    ...bots.map(([name, av], i) => ({ id: 'b' + i, name, av, color: SHOW_COLORS[i + 1][0], score: 0, acc: Math.min(.95, lv.acc + (Math.random() - .5) * .14), fast: lv.fast * (.85 + Math.random() * .3) }))];
  SHOW = { deckId: o.deckId, players, qs, qi: 0, r: 0, rq: 0, phase: 'intro', timers: [], log: [] };
  go('#/show'); setTimeout(() => showSfx('round'), 200);
}
const showRound = () => SHOW_ROUNDS[SHOW.r];
const showClear = () => { SHOW.timers.forEach(clearTimeout); SHOW.timers = []; cancelAnimationFrame(SHOW.raf); };
const later = (fn, ms) => SHOW.timers.push(setTimeout(() => { if (SHOW) fn(); }, ms));

function showAsk() {
  const R = showRound(), q = SHOW.qs[SHOW.qi];
  SHOW.phase = 'question'; SHOW.ans = {}; SHOW.t0 = Date.now(); SHOW.locked = {}; SHOW.winner = null; SHOW.host = '';
  // boty: kiedy i co odpowiedzą
  for (const p of SHOW.players.filter(p => !p.me)) {
    const ok = Math.random() < p.acc, wrongs = q.opts.map((_, k) => k).filter(k => q.opts[k] !== q.a);
    const k = ok ? q.opts.indexOf(q.a) : pick(wrongs), ms = Math.min(R.sec * 1000 - 300, (1400 + Math.random() * 5200) * p.fast);
    if (R.k === 'bet') p.bet = pick([100, 250, 250, 500]);
    later(() => showBotAnswer(p, k, ms), ms);
  }
  later(() => showTimeout(), R.sec * 1000);
  render(); showTimerLoop();
}
function showTimerLoop() {
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
function showBotAnswer(p, k, ms) {
  if (SHOW.phase !== 'question' || SHOW.ans[p.id]) return;
  const R = showRound();
  if (R.k === 'final' && SHOW.winner) return;
  SHOW.ans[p.id] = { k, ms }; showSfx('buzz');
  if (R.k === 'final') { if (SHOW.qs[SHOW.qi].opts[k] === SHOW.qs[SHOW.qi].a) { SHOW.winner = p.id; SHOW.pool = showPool(); return showReveal(); } SHOW.locked[p.id] = 1; }
  if (Object.keys(SHOW.ans).length === SHOW.players.length) return showReveal();
  render();
}
function showMyAnswer(k) {
  if (SHOW.phase !== 'question' || SHOW.ans.me) return;
  const R = showRound(), ms = Date.now() - SHOW.t0, q = SHOW.qs[SHOW.qi];
  SHOW.ans.me = { k, ms };
  if (R.k === 'final') {
    if (q.opts[k] === q.a) { SHOW.winner = 'me'; SHOW.pool = showPool(); return showReveal(); }
    SHOW.locked.me = 1; showSfx('bad'); SHOW.host = 'Zablokowany! Czekamy na resztę…';
  }
  if (Object.keys(SHOW.ans).length === SHOW.players.length) return showReveal();
  render();
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
      const amt = Math.min(300, Math.max(0, leader.score)); gain[fastest.id] += 300; gain[leader.id] = (gain[leader.id] || 0) - amt;
      SHOW.stealInfo = `${fastest.name} kradnie ${amt || 300} pkt${amt ? ' od ' + leader.name : ''}!`;
    } else SHOW.stealInfo = '';
  }
  if (R.k === 'final') for (const p of SHOW.players) gain[p.id] = SHOW.winner === p.id ? SHOW.pool : 0;
  for (const p of SHOW.players) p.score = Math.max(0, p.score + (gain[p.id] || 0));
  SHOW.gain = gain; SHOW.phase = 'reveal';
  const mine = SHOW.ans.me;
  if (!SHOW.host) SHOW.host = mine && good(mine.k) ? pick(HOST_LINES.ok) : mine ? pick(HOST_LINES.bad) : pick(HOST_LINES.slow);
  showSfx(mine && good(mine.k) && (gain.me || 0) > 0 ? 'ok' : 'bad');
  if (!(mine && good(mine.k))) SHOW.log.push({ q: q.q, a: q.a });
  render();
  later(showNext, 2800);
}
function showNext() {
  if (SHOW.phase !== 'reveal') return;
  SHOW.qi++; SHOW.rq++;
  if (SHOW.rq >= showRound().n) {
    SHOW.r++; SHOW.rq = 0;
    if (SHOW.r >= SHOW_ROUNDS.length || SHOW.qi >= SHOW.qs.length) { SHOW.phase = 'end'; showSfx('round'); confetti(SHOW.players.slice().sort((a, b) => b.score - a.score)[0].me ? 220 : 60); return render(); }
    SHOW.phase = 'round'; showSfx('round'); return render();
  }
  if (showRound().k === 'bet') { SHOW.phase = 'bet'; return render(); }
  showAsk();
}

// ---------- widoki
function showBoard(compact) {
  const lead = Math.max(...SHOW.players.map(p => p.score));
  return `<div class="sh-board${compact ? ' compact' : ''}">${SHOW.players.map(p => {
    const a = SHOW.ans?.[p.id], g = SHOW.phase === 'reveal' ? SHOW.gain?.[p.id] : null;
    return `<div class="sh-pl${p.me ? ' me' : ''}${p.score === lead && lead > 0 ? ' lead' : ''}" style="--pc:${p.color}">
      <span class="sh-av">${p.img ? `<img src="${p.img}" alt="">` : p.av}${SHOW.phase === 'question' && a ? '<i class="sh-buzz">🔔</i>' : ''}${SHOW.locked?.[p.id] ? '<i class="sh-buzz">🔒</i>' : ''}</span>
      <b class="nm">${esc(p.name)}</b><span class="sh-sc">${p.score}</span>${g ? `<em class="${g > 0 ? 'up' : 'down'}">${g > 0 ? '+' : ''}${g}</em>` : ''}</div>`; }).join('')}</div>`;
}
ROUTES.show = () => {
  if (!(typeof hostUnlocked === 'function' && hostUnlocked())) return { html: '<div class="card"><p>🎤 Teleturniej jest w becie – dostępny z panelu hosta.</p><a href="#/more">Wróć</a></div>' };
  const head = (t, r = '') => `<div class="studybar"><button class="iconbtn" data-act="show-exit">✕</button><div class="title">${t}</div>${r}</div>`;
  // --- ustawienia
  if (!SHOW) {
    const o = S.settings.show = S.settings.show || { bots: 3, level: 'mid' };
    return { focus: true, html: `<div class="sh-stage setup">${head('🎤 Teleturniej <small class="beta-tag">BETA</small>')}
      <div class="sh-logo">🎤<b>Fiszkowy Show</b><small>4 rundy · Ty kontra boty · pytania z Twojej talii</small></div>
      <div class="card"><label class="field"><span>Talia z pytaniami</span><select id="sh-deck">${S.decks.map(d => `<option value="${d.id}" ${o.deckId === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></label>
        <div class="grid2"><label class="field"><span>Przeciwnicy</span><select id="sh-bots">${[1, 2, 3].map(n => `<option value="${n}" ${o.bots === n ? 'selected' : ''}>${n} ${plural(n, 'bot', 'boty', 'botów')}</option>`).join('')}</select></label>
          <label class="field"><span>Poziom</span><select id="sh-level">${Object.entries(SHOW_LEVELS).map(([k, l]) => `<option value="${k}" ${o.level === k ? 'selected' : ''}>${l.name}</option>`).join('')}</select></label></div>
        <div class="sh-rounds">${SHOW_ROUNDS.map((r, i) => `<div><span>${r.icon}</span><b>Runda ${i + 1}: ${r.name}</b><small>${r.desc}</small></div>`).join('')}</div>
        <button class="primary block big-btn" data-act="show-go">🎬 Zaczynamy!</button>
        <p class="small muted center" style="margin-bottom:0">Wersja testowa – bez nagród w kryształach.</p></div></div>` };
  }
  const R = showRound();
  // --- intro / zapowiedź rundy
  if (SHOW.phase === 'intro' || SHOW.phase === 'round') {
    return { focus: true, html: `<div class="sh-stage">${head('🎤 Fiszkowy Show')}
      ${SHOW.phase === 'intro' ? `<div class="sh-host">🎤 <b>Witamy w Fiszkowym Show!</b><br>Dziś grają: ${SHOW.players.map(p => `<span style="color:${p.color}">${esc(p.name)}</span>`).join(', ')}. Powodzenia!</div>` : showBoard()}
      <div class="sh-roundcard"><small>Runda ${SHOW.r + 1} z ${SHOW_ROUNDS.length}</small><span>${R.icon}</span><b>${R.name}</b><p>${R.desc}</p></div>
      <button class="primary block big-btn" data-act="show-round-go">${SHOW.phase === 'intro' ? '▶ Start' : '▶ Dalej'}</button></div>` };
  }
  // --- zakład (runda 2)
  if (SHOW.phase === 'bet') {
    return { focus: true, html: `<div class="sh-stage">${head(`${R.icon} ${R.name}`, `<span class="small">${SHOW.rq + 1}/${R.n}</span>`)}${showBoard(true)}
      <div class="sh-host">🎤 Ile stawiasz? Masz <b>${SHOW.players[0].score}</b> pkt.</div>
      <div class="sh-bets">${[100, 250, 500].map(v => `<button data-act="show-bet" data-v="${v}"><b>${v}</b><small>pkt</small></button>`).join('')}</div></div>` };
  }
  // --- koniec: podium
  if (SHOW.phase === 'end') {
    const rank = SHOW.players.slice().sort((a, b) => b.score - a.score), myPlace = rank.findIndex(p => p.me) + 1;
    const pod = [rank[1], rank[0], rank[2]].filter(Boolean);
    return { focus: true, html: `<div class="sh-stage">${head('🏆 Wyniki')}
      <div class="sh-host">🎤 ${myPlace === 1 ? 'Mamy zwycięzcę – to Ty! 🎉' : myPlace === 2 ? 'Srebro! Było blisko!' : 'Dzięki za grę – rewanż?'}</div>
      <div class="sh-podium">${pod.map(p => { const place = rank.indexOf(p) + 1; return `<div class="sh-step p${place}" style="--pc:${p.color}"><span class="sh-av">${p.img ? `<img src="${p.img}" alt="">` : p.av}</span><b class="nm">${esc(p.name)}</b><small>${p.score} pkt</small><div class="sh-block">${['🥇', '🥈', '🥉'][place - 1]}</div></div>`; }).join('')}</div>
      ${rank[3] ? `<p class="center small">4. ${esc(rank[3].name)} – ${rank[3].score} pkt</p>` : ''}
      ${SHOW.log.length ? `<details class="card"><summary><b>Do powtórki (${SHOW.log.length})</b></summary>${SHOW.log.slice(0, 15).map(l => `<div class="qwrong"><div class="small">${fmt(l.q)}</div><b class="c-rev">${fmt(l.a)}</b></div>`).join('')}</details>` : ''}
      <div class="row"><button class="primary grow" data-act="show-again">🔁 Jeszcze raz</button><button class="grow" data-act="show-exit">Zakończ</button></div></div>` };
  }
  // --- pytanie / odkrycie odpowiedzi
  const q = SHOW.qs[SHOW.qi], rev = SHOW.phase === 'reveal', mine = SHOW.ans.me;
  return { focus: true, html: `<div class="sh-stage">${head(`${R.icon} ${R.name}`, `<span class="small">${SHOW.rq + 1}/${R.n}</span>`)}
    ${showBoard(true)}
    ${R.k === 'final' && !rev ? `<div class="sh-pool">Pula: <b id="sh-pool"><span id="show-pool">${showPool()}</span></b></div>` : ''}
    ${R.k === 'bet' && !rev ? `<div class="sh-pool">Twój zakład: <b>${SHOW.players[0].bet}</b></div>` : ''}
    <div class="sh-q">${fmt(q.q)}</div>
    <div class="sh-timer"><div id="show-timer" style="width:${rev ? 0 : Math.max(0, (R.sec * 1000 - (Date.now() - SHOW.t0)) / (R.sec * 10))}%"></div></div>
    <div class="sh-opts">${q.opts.map((o, k) => {
      const ok = o === q.a, who = SHOW.players.filter(p => SHOW.ans[p.id]?.k === k);
      const cls = rev ? (ok ? ' ok' : mine?.k === k ? ' bad' : ' dim') : mine?.k === k ? ' picked' : '';
      return `<button class="sh-opt${cls}" style="--ac:${SHOW_ANS[k]}" data-act="show-ans" data-k="${k}" ${rev || mine ? 'disabled' : ''}>
        <i>${'ABCD'[k]}</i><span>${fmt(o)}</span>${rev ? `<em>${who.map(p => `<u style="background:${p.color}" title="${esc(p.name)}"></u>`).join('')}</em>` : ''}</button>`; }).join('')}</div>
    ${rev ? `<div class="sh-host">🎤 ${esc(SHOW.host)}${SHOW.stealInfo && R.k === 'steal' ? `<br><small>${esc(SHOW.stealInfo)}</small>` : ''}${R.k === 'final' && SHOW.winner ? `<br><small>${esc(SHOW.players.find(p => p.id === SHOW.winner).name)} bierze ${SHOW.pool} pkt!</small>` : ''}</div>`
      : SHOW.host ? `<div class="sh-host">🎤 ${esc(SHOW.host)}</div>` : ''}</div>` };
};

Object.assign(ACTIONS, {
  'show-open': () => { SHOW = null; go('#/show'); },
  'show-go': () => {
    const o = S.settings.show = { deckId: $('#sh-deck').value, bots: +$('#sh-bots').value, level: $('#sh-level').value }; save();
    if (typeof fxUnlock === 'function') fxUnlock();
    showStart(o);
  },
  'show-round-go': () => { if (showRound().k === 'bet') { SHOW.phase = 'bet'; render(); } else showAsk(); },
  'show-bet': el => { SHOW.players[0].bet = +el.dataset.v; showAsk(); },
  'show-ans': el => showMyAnswer(+el.dataset.k),
  'show-again': () => { const o = S.settings.show; showClear(); SHOW = null; showStart(o); },
  'show-exit': () => { if (SHOW) showClear(); SHOW = null; go(typeof hostUnlocked === 'function' && hostUnlocked() ? '#/host' : '#/'); },
});
window.addEventListener('hashchange', () => { if (SHOW && parseRoute().parts[0] !== 'show') { showClear(); SHOW = null; } });

'use strict';
/* 🥊 Pojedynek 1 na 1: Twój bohater kontra bohater kolegi, na zmianę tury.
   W swojej turze wybierasz ruch (4 ruchy z PP + supercios postaci), a żeby się udał – odpowiadasz na fiszkę:
   rodzaj pytań ustawia Panel admina (✍️ wpisywanie – kto bliżej / ABCD / mieszane); przy wpisywaniu siła ciosu = celność odpowiedzi.
   Szybko = „super skuteczne!”, źle = „chybił!” i obaj widzą poprawną odpowiedź.
   Host wybiera talię, karty idą do kolegi (tylko tekst, na czas walki). Kanał jak w lobby hydry; jest też trening z botem.
   Oba telefony liczą to samo z tej samej kolejki wiadomości (atakujący wysyła gotowy wynik ruchu). */
// ⚖️ balans: dużo pytań (300 HP ≈ 12–15 trafień), poziom daje umiarkowaną przewagę (do +20% ❤️ i +15% obrażeń),
// a większą – seria dobrych odpowiedzi (do +30%). Ekwipunek z bossów się nie liczy; za to są przedmioty PvP (max 2 na walkę).
const DUEL_HP = 300, DUEL_ULT = 3;
const duelMaxHp = p => Math.round(DUEL_HP * (1 + Math.min(.2, (p.lv - 1) * .01)));
const duelLvMul = p => 1 + Math.min(.15, (p.lv - 1) * .0075);
const duelStreakMul = n => 1 + Math.min(.3, n * .06);
const PVP = { freeze: ['❄️', 'Lodowa bomba', 'rywal: następne pytanie ma o połowę mniej czasu („kto szybciej”: 3 s zamrożenia)'], elixir: ['🧪', 'Eliksir życia', '+20% ❤️ od razu'],
  regen: ['🌿', 'Regeneracja', '+4% ❤️ przez 4 kolejne tury'], mirror: ['🪞', 'Lustrzana tarcza', 'następny cios −50%, a 30% wraca do rywala'],
  lupa: ['🔍', 'Lupa', 'następne pytanie łatwiejsze: ABCD – znikają 2 złe odpowiedzi, wpisywanie – podpowiedź początku'], adren: ['⚡', 'Adrenalina', 'następne trafienie ×1,5'] };
const PVP_MAX = 2, PVP_W = { freeze: 3, elixir: 3, regen: 2, mirror: 2, lupa: 3, adren: 2 };
const pvpCount = () => Object.keys(PVP).reduce((a, k) => a + itemCount('pvp', k), 0);
const DMOVES = {
  atk: { n: 'Szybki atak', ic: '⚔️', pp: 99, q: 'abcd', dmg: 20, d: 'ABCD · 20 obrażeń' },
  power: { n: 'Mocny cios', ic: '💥', pp: 5, q: 'type', dmg: 34, d: 'wpisz · 34 obrażenia' },
  guard: { n: 'Garda', ic: '🛡️', pp: 4, q: 'tf', d: 'prawda/fałsz · −60% następnego ciosu' },
  heal: { n: 'Mikstura', ic: '💚', pp: 3, q: 'abcd', heal: .09, d: 'ABCD · +9% ❤️' },
};
const DQ_MS = { abcd: 15000, tf: 10000, type: 25000 };
const DBOT = [['Kot Bojowy', 'cat'], ['Żabson', 'frog'], ['Pieseł', 'dog'], ['Sowa Sesji', 'owl'], ['Lis Spryciarz', 'fox'], ['Chomik Turbo', 'hamster']];
let D = null, DUEL_DECK = '', DUEL_MODE = 'turn';   // turn = turowy, speed = kto szybciej
// ✍️ rodzaj pytań (Panel admina): type = tylko wpisywanie (liczy się, kto bliżej), abcd = tylko ABCD, mix = ABCD + prawda/fałsz + wpisz
const DUEL_QF = { type: '✍️ Wpisywanie – kto bliżej', abcd: '🔤 ABCD', mix: '🎲 Mieszane (ABCD, prawda/fałsz, wpisz)' };
const duelQf = () => DUEL_QF[S.settings.duelQ] ? S.settings.duelQ : 'type';
const duelKind = (d, k) => d.qf === 'type' ? 'type' : d.qf === 'abcd' ? 'abcd' : DMOVES[k].q;
const QF_WORD = { type: 'wpisz', abcd: 'ABCD', tf: 'prawda/fałsz' };
const duelMoveDesc = (d, k) => { const m = DMOVES[k]; return `${QF_WORD[duelKind(d, k)]} · ${m.dmg ? `${m.dmg} obrażeń` : m.heal ? `+${m.heal * 100}% ❤️` : '−60% następnego ciosu'}`; };
// celność wpisanej odpowiedzi 0–100: dokładnie = 100, literówka/sens = 60–95, źle = 0 (pudło)
function duelAcc(input, correct) {
  const v = checkAnswer(input, correct); if (v === 'ok') return 100; if (v === 'wrong') return 0;
  const x = norm(enExpand(input)), alts = [correct, String(correct).replace(/\([^)]*\)/g, ' '), ...String(correct).split(/[\/;|,]| lub | albo /)].map(a => norm(enExpand(a))).filter(Boolean);
  const sim = Math.max(0, ...alts.map(a => 1 - lev(x, a) / Math.max(a.length, x.length, 1)));
  return Math.round(60 + 35 * Math.max(0, Math.min(1, sim)));
}
const duelMe = () => { const h = hero(), st = heroStats(); return { nick: (S.profile.nick || 'Gracz').slice(0, 24), line: heroLine(h), form: heroForm(h), g: h.g === 'm' ? 'm' : 'w', lv: heroLv(), crit: Math.min(.1, +st.crit.toFixed(3)), ult: lineDef().ult[0] }; };
const sDuelP = p => p && typeof p === 'object' ? { nick: sStr(p.nick, 24) || 'Gracz', line: CHAR_LINES[p.line] ? p.line : 'cat', form: sInt(p.form, 0, 3), g: p.g === 'm' ? 'm' : 'w', lv: sInt(p.lv, 1, 99, 1), crit: sNum(p.crit, 0, .1, 0), ult: sStr(p.ult, 40) || '⚡ Supercios' } : null;
function sDuel(m) {
  if (!m || typeof m !== 'object' || typeof m.t !== 'string') return null;
  const o = { t: sStr(m.t, 10), from: sStr(m.from, 40) };
  if (m.p) o.p = sDuelP(m.p);
  if (m.set && Array.isArray(m.set.cards)) o.set = { name: sStr(m.set.name, 60), cards: m.set.cards.slice(0, 260).map(x => ({ q: sStr(x?.q, 300), a: sStr(x?.a, 300), o: sStr(x?.o, 8) })).filter(x => x.q && x.a) };
  for (const k of ['k', 'q', 'a', 'kind', 'mode', 'win', 'qf', 'hint']) if (m[k] != null) o[k] = sStr(m[k], 300);
  for (const k of ['dmg', 'heal']) if (m[k] != null) o[k] = sInt(m[k], 0, 500);
  for (const k of ['ms', 'i']) if (m[k] != null) o[k] = sInt(m[k], 0, 1e6);
  for (const k of ['acc', 'sc', 'osc']) if (m[k] != null) o[k] = sInt(m[k], 0, 100);
  if (Array.isArray(m.opts)) o.opts = m.opts.slice(0, 4).map(x => sStr(x, 300));
  for (const k of ['ok', 'fast', 'slow', 'crit', 'first']) if (m[k] != null) o[k] = !!m[k];
  return o;
}
const dSend = m => D?.ch?.send(m);
function duelOpen(code, host) {
  D?.ch?.close();
  D = { code, host, phase: 'lobby', me: duelMe(), opp: null, ch: null, seen: Date.now() };
  D.ch = channel('fiszki-duel-' + code, duelMsg);
  if (!host) { const hi = () => { if (D?.code === code && D.phase === 'lobby' && !D.opp) { dSend({ t: 'join', p: D.me }); D.tries = (D.tries || 0) + 1; if (D.tries < 10) setTimeout(hi, 2500); } }; hi(); }
  duelBeat();
}
function duelBeat() {
  const d = D; if (!d || d.bot) return; dSend({ t: 'ping' });
  if (d.phase === 'fight' && Date.now() - d.seen > 40000) { duelLog(`🚪 ${d.opp?.nick || 'Przeciwnik'} rozłączył się – wygrywasz walkowerem`); return duelEnd(true); }
  clearTimeout(d.beat); d.beat = setTimeout(duelBeat, 5000);
}
const duelDeckSet = id => { const d = deckById(id); return d && typeof coopSetPack === 'function' ? coopSetPack(d) : null; };
function duelBegin(set, first, mode, qf) {
  const d = D; d.phase = 'fight'; d.mode = mode === 'speed' ? 'speed' : 'turn'; d.qf = DUEL_QF[qf] ? qf : duelQf(); d.r = null; d.ri = 0; d.set = set; d.answers = [...new Set(set.cards.map(x => x.a))];
  d.max = { me: duelMaxHp(d.me), opp: duelMaxHp(d.opp) }; d.hp = { ...d.max }; d.streak = { me: 0, opp: 0 }; d.fz = { me: false, opp: false }; d.regen = { me: 0, opp: 0 }; d.mirror = { me: false, opp: false }; d.adren = { me: false, opp: false }; d.lupa = false; d.used = 0; d.bag = false; d.loot = null; d.pp = Object.fromEntries(Object.entries(DMOVES).map(([k, m]) => [k, m.pp])); d.ult = 0; d.guard = { me: false, opp: false };
  d.turn = first ? 'me' : 'opp'; d.log = []; d.q = null; d.ask = null; d.deck = shuffle(set.cards.map((_, i) => i)); d.di = 0; d.stats = { ok: 0, bad: 0 }; d.seen = Date.now();
  duelLog(`⚔️ ${d.me.nick} kontra ${d.opp.nick}! Talia: „${set.name}” · ${DUEL_QF[d.qf]}`);
  if (d.mode === 'speed') { d.turn = null; duelLog(d.qf === 'type' ? '✍️ Kto bliżej! Ta sama fiszka u obu – wpisz odpowiedź, celniejsza atakuje (remis – szybsza).' : '⚡ Kto szybciej! Ta sama fiszka u obu – pierwsza dobra odpowiedź atakuje.'); go('#/duel/fight'); render(); if (d.host) setTimeout(() => { if (D === d) duelRound(); }, 1500); return; }
  duelLog(d.turn === 'me' ? '👉 Zaczynasz – wybierz ruch!' : `⏳ Zaczyna ${d.opp.nick}…`);
  go('#/duel/fight'); render(); if (d.bot && d.turn === 'opp') duelBotTurn();
}
const duelLog = t => { if (D) { D.log.unshift(t); D.log = D.log.slice(0, 3); D.msgAt = Date.now(); } };
const duelCard = d => { const x = d.set.cards[d.deck[d.di++ % d.deck.length]]; if (d.di % d.deck.length === 0) d.deck = shuffle(d.deck); return x; };
// złe odpowiedzi z kart w tym samym kierunku (talia w obie strony: angielskie do angielskich, polskie do polskich)
const duelWrong = (d, x, n) => { const same = [...new Set(d.set.cards.filter(y => y.o === x.o).map(y => y.a))].filter(a => norm(a) !== norm(x.a)), pool = same.length >= n ? same : d.answers.filter(a => norm(a) !== norm(x.a)); return shuffle([...pool]).slice(0, n); };
function duelQuestion(k) {
  const d = D, x = duelCard(d), q = { k, kind: duelKind(d, k), card: x, at: Date.now() };
  if (q.kind === 'abcd') { q.opts = shuffle([x.a, ...duelWrong(d, x, d.lupa ? 1 : 3)]); if (d.lupa && q.opts.length > 1) { d.lupa = false; duelLog('🔍 Lupa: zostały 2 odpowiedzi'); } if (q.opts.length < 2) q.kind = 'type'; }
  if (q.kind === 'type' && d.lupa) { d.lupa = false; q.hint = duelHint(x.a); duelLog('🔍 Lupa: podpowiedź początku odpowiedzi'); }
  if (q.kind === 'tf') { q.truth = Math.random() < .5 || d.answers.length < 2; q.claim = q.truth ? x.a : duelWrong(d, x, 1)[0]; }
  return q;
}
// mój ruch: wybór → pytanie → wynik
function duelPick(k) {
  const d = D; if (!d || d.phase !== 'fight' || d.turn !== 'me' || d.q) return;
  if (k === 'ult') { if (d.ult < DUEL_ULT) return; d.ult = 0; return duelApply('me', { k: 'ult', ok: true, dmg: Math.round(40 * duelLvMul(d.me) * (d.adren.me ? 1.5 : 1)), crit: false, fast: false }); }
  if (!(d.pp[k] > 0)) return toast('Brak PP – wybierz inny ruch');
  d.pp[k]--; d.q = duelQuestion(k); d.q.lim = DQ_MS[d.q.kind] * (d.fz.me ? .5 : 1); if (d.fz.me) { d.fz.me = false; toast('❄️ Zamrożony – masz o połowę mniej czasu!', 2500); } dSend({ t: 'ask', k, kind: d.q.kind, q: d.q.card.q }); render();
  if (d.q.kind === 'type') setTimeout(() => document.getElementById('duel-in')?.focus(), 60);
}
function duelAnswer(ok, given, acc) {
  const d = D, q = d?.q; if (!q || q.done) return; q.done = true; q.ok = ok; q.given = given; q.acc = acc;
  const ms = Date.now() - q.at, lim = q.lim || DQ_MS[q.kind], mv = DMOVES[q.k], fast = ok && ms < lim * .35, slow = ok && ms > lim * .75, crit = ok && Math.random() < d.me.crit;
  const mul = (acc != null ? acc / 100 : 1) * (fast ? 1.3 : slow ? .8 : 1) * (crit ? 1.5 : 1) * duelLvMul(d.me) * duelStreakMul(d.streak.me) * (d.adren.me ? 1.5 : 1);
  const res = { k: q.k, ok, fast, slow, crit, dmg: ok && mv.dmg ? Math.round(mv.dmg * mul) : 0, heal: ok && mv.heal ? Math.round(d.max.me * mv.heal * (fast ? 1.2 : 1) * (acc != null ? acc / 100 : 1)) : 0, q: q.card.q, a: q.card.a, ...(ok && acc != null && acc < 100 ? { acc } : {}) };
  if (ok) { d.stats.ok++; d.ult = Math.min(DUEL_ULT, d.ult + 1); } else d.stats.bad++;
  render(); setTimeout(() => { if (D === d) { d.q = null; duelApply('me', res); } }, ok ? 650 : 1400);
}
// wspólne zastosowanie ruchu (mój po wysłaniu, przeciwnika po odebraniu) – oba telefony liczą to samo
function duelApply(who, r) {
  const d = D, me = who === 'me', att = me ? d.me : d.opp, def = me ? 'opp' : 'me', mv = DMOVES[r.k], name = r.k === 'ult' ? att.ult : `${mv.ic} ${mv.n}`;
  if (me) dSend({ t: 'move', ...r });
  if (!r.ok) duelLog(`❌ ${att.nick} użył ${name}… chybił! (${mShort(r.q, 40)} → ${mShort(r.a, 40)})`);
  else if (r.k === 'guard') { d.guard[who] = true; duelLog(`🛡️ ${att.nick} staje w gardzie!`); }
  else if (r.k === 'heal') { d.hp[who] = Math.min(d.max[who], d.hp[who] + r.heal); duelLog(`💚 ${att.nick} leczy się +${r.heal}!${r.fast ? ' Błyskawicznie!' : ''}`); d.fx = { who, k: 'heal', t: Date.now() }; }
  else {
    let dmg = r.dmg, back = 0; if (d.guard[def]) { dmg = Math.round(dmg * .4); d.guard[def] = false; }
    if (d.mirror[def]) { back = Math.round(dmg * .3); dmg = Math.round(dmg * .5); d.mirror[def] = false; d.hp[who] = Math.max(0, d.hp[who] - back); }
    d.hp[def] = Math.max(0, d.hp[def] - dmg); d.fx = { who: def, k: 'hit', n: dmg, crit: r.crit, t: Date.now() }; d.adren[who] = false;
    duelLog(`${name}! −${dmg}${r.acc ? ` · 🎯 celność ${r.acc}%` : ''}${r.crit ? ' · Cios krytyczny!' : ''}${r.fast ? ' · Błyskawicznie!' : r.slow ? ' · Za wolno, słabszy cios' : ''}${back ? ` · 🪞 odbite −${back}` : ''}${d.streak[who] >= 2 ? ` · 🔥 seria ${d.streak[who] + 1}` : ''}`);
  }
  if (r.k !== 'ult') d.streak[who] = r.ok ? d.streak[who] + 1 : 0;
  if (typeof bossSfx === 'function') bossSfx(r.ok ? 'hit' : 'hurt');
  if (d.hp.opp <= 0 || d.hp.me <= 0) return duelEnd(d.hp.opp <= 0 && (d.hp.me > 0 || me));
  duelPassTurn(me ? 'opp' : 'me');
}
// zmiana tury (+ regeneracja tego, kto zaczyna turę)
function duelPassTurn(to) {
  const d = D; d.turn = to; d.ask = null;
  if (d.regen[to] > 0) { const h = Math.round(d.max[to] * .04); d.hp[to] = Math.min(d.max[to], d.hp[to] + h); d.regen[to]--; duelLog(`🌿 ${(to === 'me' ? d.me : d.opp).nick} regeneruje się +${h}`); }
  save(); render();
  if (d.bot && d.turn === 'opp') duelBotTurn();
}
// 🎒 przedmioty PvP: używane w swojej turze (zabiera turę) albo w „kto szybciej” w dowolnej chwili
function duelItem(who, k) {
  const d = D, p = who === 'me' ? d.me : d.opp, other = who === 'me' ? 'opp' : 'me';
  if (k === 'freeze') d.fz[other] = true;
  if (k === 'elixir') { d.hp[who] = Math.min(d.max[who], d.hp[who] + Math.round(d.max[who] * .2)); d.fx = { who, k: 'heal', t: Date.now() }; }
  if (k === 'regen') d.regen[who] = 4;
  if (k === 'mirror') d.mirror[who] = true;
  if (k === 'lupa' && who === 'me') d.lupa = true;
  if (k === 'adren') d.adren[who] = true;
  duelLog(`🎒 ${p.nick} używa: ${PVP[k][0]} ${PVP[k][1]}!`);
}
function duelUseItem(k) {
  const d = D; if (!d || d.phase !== 'fight' || !PVP[k] || itemCount('pvp', k) < 1) return;
  if (d.used >= PVP_MAX) return toast(`Maksymalnie ${PVP_MAX} przedmioty na walkę`);
  if (d.mode === 'turn' && (d.turn !== 'me' || d.q)) return toast('Przedmiotu używasz w swojej turze');
  addItem('pvp', k, -1); d.used++; d.bag = false; dSend({ t: 'item', k }); duelItem('me', k); if (typeof bossSfx === 'function') bossSfx('chest');
  if (d.mode === 'turn') duelPassTurn('opp'); else { save(); render(); }
}
function duelEnd(won) {
  const d = D; if (!d || d.phase === 'end') return; d.phase = 'end'; d.won = won; clearTimeout(d.beat);
  d.xp = Math.round((won ? 40 : 15) + 3 * d.stats.ok); giveXP(d.xp, 'pojedynek'); d.gems = won && !d.bot ? 15 : won ? 5 : 0;
  if (d.gems) S.wallet.push({ id: 'duel-' + uid(), n: d.gems, why: 'duel', t: Date.now() });
  // 🎒 łup: przedmioty PvP – za wygraną z kolegą zawsze (czasem 2), z botem czasem, za porażkę z kolegą – na pocieszenie 30%
  const chance = won ? (d.bot ? .4 : 1) : (d.bot ? 0 : .3), n = Math.random() < chance ? (won && !d.bot && Math.random() < .3 ? 2 : 1) : 0, keys = Object.keys(PVP);
  d.loot = Array.from({ length: n }, () => { let r = Math.random() * keys.reduce((a, k) => a + PVP_W[k], 0); for (const k of keys) { if ((r -= PVP_W[k]) < 0) return k; } return keys[0]; });
  d.loot.forEach(k => addItem('pvp', k, 1));
  S.stats.duels = (S.stats.duels || 0) + 1; if (won) S.stats.duelWins = (S.stats.duelWins || 0) + 1; save();
  if (typeof bossSfx === 'function') bossSfx(won ? 'win' : 'lose'); if (won && typeof confetti === 'function') confetti(120); render();
}
function duelMsg(m0) {
  const m = sDuel(m0), d = D; if (!m || !d) return; d.seen = Date.now();
  if (m.t === 'join' && d.host && d.phase === 'lobby' && m.p) { d.opp = m.p; dSend({ t: 'lobby', p: d.me }); return render(); }
  if (m.t === 'lobby' && !d.host && m.p) { d.opp = m.p; return render(); }
  if (m.t === 'start' && !d.host && m.set?.cards.length) { if (!d.opp && m.p) d.opp = m.p; return duelBegin(m.set, !m.first, m.mode, m.qf); }
  if (d.phase !== 'fight') { if (m.t === 'rematch' && d.phase === 'end') { d.oppRematch = true; if (d.host && d.myRematch) duelStart(); render(); } return; }
  if (d.mode === 'speed') {
    if (m.t === 'round' && !d.host && (m.opts?.length || m.kind === 'type')) return duelRoundShow({ i: m.i, q: m.q, a: m.a, opts: m.opts || [], kind: m.kind === 'type' ? 'type' : 'abcd' });
    if (m.t === 'buzz' && d.host) return duelBuzz('opp', m.i, m.ok, m.ms, m.sc);
    if (m.t === 'rres' && !d.host && d.r?.i === m.i) return duelRoundRes(m);
  }
  if (m.t === 'item' && PVP[m.k]) { duelItem('opp', m.k); if (d.mode === 'turn' && d.turn === 'opp') return duelPassTurn('me'); return render(); }
  if (m.t === 'ask' && d.turn === 'opp') { d.ask = { k: m.k, kind: m.kind, q: m.q, at: Date.now(), lim: DQ_MS[m.kind] * (d.fz.opp ? .5 : 1) }; d.fz.opp = false; return render(); }
  if (m.t === 'move' && d.turn === 'opp' && (DMOVES[m.k] || m.k === 'ult')) return duelApply('opp', m);
  if (m.t === 'ff') { duelLog(`🏳️ ${d.opp.nick} się poddał`); return duelEnd(true); }
}
function duelStart() {
  const d = D; if (!d?.host || !d.opp) return;
  const set = duelDeckSet(DUEL_DECK); if (!set || set.cards.length < 4) return toast('Wybierz talię z co najmniej 4 fiszkami');
  d.myRematch = d.oppRematch = false; const first = Math.random() < .5;
  dSend({ t: 'start', set, first, p: d.me, mode: DUEL_MODE, qf: duelQf() }); duelBegin(set, first, DUEL_MODE, duelQf());
}
// 🤖 trening z botem
function duelBot() {
  const set = duelDeckSet(DUEL_DECK); if (!set || set.cards.length < 4) return toast('Wybierz talię z co najmniej 4 fiszkami');
  const [nick, line] = DBOT[Math.random() * DBOT.length | 0], lv = heroLv();
  D = { code: 'BOT', host: true, bot: true, phase: 'lobby', me: duelMe(), opp: { nick: `🤖 ${nick}`, line, form: Math.min(3, Math.floor(lv / 8)), g: 'w', lv, crit: .08, ult: LINES[line]?.ult?.[0] || '⚡ Supercios' } };
  duelBegin(set, true, DUEL_MODE, duelQf());
}
function duelBotTurn() {
  const d = D; setTimeout(() => {
    if (D !== d || d.phase !== 'fight' || d.turn !== 'opp') return;
    const opts = ['atk', 'atk', 'power', d.hp.opp < d.max.opp * .4 ? 'heal' : 'atk', d.hp.opp < d.max.opp * .55 ? 'guard' : 'power'].filter(x => d.botPP?.[x] !== 0), k = opts[Math.random() * opts.length | 0], x = duelCard(d);
    d.ask = { k, kind: duelKind(d, k), q: x.q, at: Date.now() }; render();
    setTimeout(() => { if (D !== d || d.phase !== 'fight') return; const ok = Math.random() < .66, fast = ok && Math.random() < .3, crit = ok && Math.random() < .08, mv = DMOVES[k], acc = ok && duelKind(d, k) === 'type' ? (Math.random() < .55 ? 100 : 62 + Math.round(Math.random() * 33)) : null;
      duelApply('opp', { k, ok, fast, slow: false, crit, ...(acc && acc < 100 ? { acc } : {}), dmg: ok && mv.dmg ? Math.round(mv.dmg * (acc ? acc / 100 : 1) * (fast ? 1.3 : 1) * (crit ? 1.5 : 1) * duelLvMul(d.opp) * duelStreakMul(d.streak.opp)) : 0, heal: ok && mv.heal ? Math.round(d.max.opp * mv.heal) : 0, q: x.q, a: x.a }); }, 2200 + Math.random() * 3000);
  }, 1100);
}
// ---------- timer pytania
setInterval(() => {
  const d = D; if (!d || d.phase !== 'fight' || parseRoute().parts[0] !== 'duel') return;
  const q = d.q, a = d.ask, el = document.querySelector('.dq-bar i');
  if (d.mode === 'speed') { if (d.r && !d.r.res && el) el.style.width = Math.max(0, 100 - (Date.now() - d.r.at) / speedMs(d.r) * 100) + '%'; return; }
  if (q && !q.done) { const f = (Date.now() - q.at) / (q.lim || DQ_MS[q.kind]); if (el) el.style.width = Math.max(0, 100 - f * 100) + '%'; if (f >= 1) duelAnswer(false, ''); }
  else if (a && el) el.style.width = Math.max(0, 100 - (Date.now() - a.at) / (a.lim || DQ_MS[a.kind]) * 100) + '%';
}, 200);
// ---------- widoki
const duelFig = (p, cls) => `<div class="hero-fig duel-fig ${cls} ln-${p.line}${typeof spriteVars === 'function' ? spriteVars(p.line, p.form) : ''}">${heroArt(p.line, p.form, p.g)}</div>`;
const duelBox = (p, hp, mine, guard, max = DUEL_HP, fx = '') => `<div class="dbox ${mine ? 'me' : 'op'}"><div class="dbox-h"><b>${esc(p.nick)}</b><small>Poz. ${p.lv}</small></div>
  <div class="dhp"><span>HP</span><div class="dhp-bar"><i class="${hp / max < .25 ? 'red' : hp / max < .5 ? 'yel' : ''}" style="width:${(hp / max * 100).toFixed(1)}%"></i></div></div>${mine ? `<div class="dhp-n">${hp} / ${max}</div>` : ''}${guard || fx ? `<em>${guard ? '🛡️ garda ' : ''}${fx}</em>` : ''}</div>`;
// stany na ramce: seria, zamrożenie, tarcza, regeneracja, adrenalina
const duelFx = (d, w) => [d.streak?.[w] >= 2 ? `🔥${d.streak[w]}` : '', d.fz?.[w] ? '❄️' : '', d.mirror?.[w] ? '🪞' : '', d.regen?.[w] ? '🌿' : '', d.adren?.[w] ? '⚡' : ''].filter(Boolean).join(' ');
function duelBagHTML(d, inline) {
  const own = Object.keys(PVP).filter(k => itemCount('pvp', k) > 0), left = PVP_MAX - (d.used || 0);
  if (!own.length) return inline ? '' : '<p class="small muted center" style="margin:8px 0 0">🎒 Plecak pusty – przedmioty PvP zdobywasz za pojedynki.</p>';
  return `<div class="dbag${inline ? ' inline' : ''}"><small>🎒 Przedmioty (${left > 0 ? `jeszcze ${left}` : 'limit wykorzystany'})${d.mode === 'turn' ? ' · użycie zabiera turę' : ''}</small><div class="dbag-row">${own.map(k => `<button data-act="duel-item" data-k="${k}" ${left > 0 ? '' : 'disabled'} title="${esc(PVP[k][1] + ': ' + PVP[k][2])}"><span>${PVP[k][0]}</span><b>${PVP[k][1]}</b><i>×${itemCount('pvp', k)}</i></button>`).join('')}</div></div>`;
}
function duelFightView() {
  const d = D, now = Date.now(), fx = d.fx && now - d.fx.t < 900 ? d.fx : null, q = d.q, a = d.ask;
  let panel;
  if (d.phase === 'fight' && d.mode === 'speed') panel = duelSpeedPanel(d);
  else if (d.phase === 'end') panel = `<div class="dtext"><b>${d.won ? `🏆 ${esc(d.opp.nick)} pokonany! Wygrywasz!` : `💀 ${esc(d.me.nick)} pada… Wygrywa ${esc(d.opp.nick)}.`}</b><small>+${d.xp} XP${d.gems ? ` · +${d.gems} 💎` : ''} · ${d.stats.ok} dobrych, ${d.stats.bad} błędów</small>${d.loot?.length ? `<div class="dloot">${crateImg('pvp', 'dloot-crate')}${d.loot.map(k => `<span title="${esc(PVP[k][2])}"><b>${PVP[k][0]}</b>${PVP[k][1]}</span>`).join('')}</div><small>🎒 Nowe przedmioty PvP!</small>` : ''}</div>
    <div class="row" style="margin-top:8px">${d.bot ? '<button class="primary grow" data-act="duel-bot">🔁 Jeszcze raz</button>' : `<button class="primary grow" data-act="duel-rematch" ${d.myRematch ? 'disabled' : ''}>${d.myRematch ? '⏳ Czekam…' : d.oppRematch ? '✅ Rewanż!' : '🔁 Rewanż'}</button>`}<button class="grow" data-act="duel-leave">Wyjdź</button></div>`;
  else if (q) {
    const v = q.card, done = q.done;
    let ctrl = '';
    if (q.kind === 'abcd') ctrl = `<div class="dmoves q">${q.opts.map((o, i) => `<button class="${done ? norm(o) === norm(v.a) ? 'right' : q.given === o ? 'wrong' : '' : ''}" data-act="duel-opt" data-i="${i}" ${done ? 'disabled' : ''}>${esc(o)}</button>`).join('')}</div>`;
    else if (q.kind === 'tf') ctrl = `<div class="claim">${esc(q.claim)}</div><div class="tf-btns"><button class="tf-yes" data-act="duel-tf" data-v="1" ${done ? 'disabled' : ''}>✓ Prawda</button><button class="tf-no" data-act="duel-tf" data-v="0" ${done ? 'disabled' : ''}>✗ Fałsz</button></div>`;
    else ctrl = done ? '' : `${q.hint ? `<p class="small muted center" style="margin:4px 0">🔍 Zaczyna się od: <b>${esc(q.hint)}</b></p>` : ''}<div class="type-row"><input id="duel-in" placeholder="Wpisz odpowiedź…" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go"><button class="primary type-go" data-act="duel-check">✓</button></div>`;
    panel = `<div class="dtext"><small>${DMOVES[q.k].ic} ${DMOVES[q.k].n} – odpowiedz, żeby trafić!</small><b>${esc(v.q)}</b>${done ? `<small class="${q.ok ? 'good' : 'bad'}">${q.ok ? `✓ Trafienie!${q.acc != null && q.acc < 100 ? ` 🎯 Celność ${q.acc}% · poprawnie: ${esc(v.a)}` : ''}` : `✗ Pudło! Poprawnie: ${esc(v.a)}`}</small>` : '<div class="dq-bar"><i></i></div>'}</div>${ctrl}`;
  } else if (d.turn === 'me') panel = `<div class="dtext"><b>Co zrobi ${esc(d.me.nick)}?</b>${d.log[0] ? `<small>${esc(d.log[0])}</small>` : ''}</div>
    <div class="dmoves">${Object.entries(DMOVES).map(([k, m]) => `<button data-act="duel-move" data-k="${k}" ${d.pp[k] > 0 ? '' : 'disabled'}><b>${m.ic} ${m.n}</b><small>${duelMoveDesc(d, k)}</small><i>PP ${m.pp > 50 ? '∞' : `${d.pp[k]}/${m.pp}`}</i></button>`).join('')}</div>
    <div class="row nowrap dult-row"><button class="dult${d.ult >= DUEL_ULT ? ' ready' : ''}" data-act="duel-move" data-k="ult" ${d.ult >= DUEL_ULT ? '' : 'disabled'}><b>⚡ ${esc(d.me.ult)}</b><small>${d.ult >= DUEL_ULT ? 'GOTOWY – mocny cios bez pytania!' : `ładowanie ${d.ult}/${DUEL_ULT} trafień`}</small></button><button class="dbag-btn${d.bag ? ' on' : ''}" data-act="duel-bag">🎒<small>${pvpCount()}</small></button></div>${d.bag ? duelBagHTML(d) : ''}`;
  else panel = `<div class="dtext">${a ? `<small>${esc(d.opp.nick)} używa ${DMOVES[a.k]?.ic || '⚡'} ${DMOVES[a.k]?.n || ''} i odpowiada na:</small><b>${esc(a.q)}</b><div class="dq-bar opp"><i></i></div><small class="muted">Też spróbuj odpowiedzieć w myślach 🧠</small>` : `<b>⏳ ${esc(d.opp.nick)} wybiera ruch…</b>`}${d.log[0] ? `<small>${esc(d.log[0])}</small>` : ''}</div>`;
  return { tab: 'arena', focus: true, html: `<div class="studybar"><button class="iconbtn" data-act="duel-ff">✕</button><div class="title">🥊 Pojedynek${d.bot ? ' z botem' : ''}</div><span class="small muted">${d.phase === 'end' ? 'koniec' : d.mode === 'speed' ? (d.qf === 'type' ? '✍️ kto bliżej' : '⚡ kto szybciej') : d.turn === 'me' ? 'Twoja tura' : 'tura rywala'}</span></div>
  <div class="darena${fx?.k === 'hit' ? ' shake-' + fx.who : ''}">
    ${duelBox(d.opp, d.hp.opp, false, d.guard.opp, d.max?.opp, duelFx(d, 'opp'))}<div class="dplat op">${duelFig(d.opp, 'op' + (fx?.who === 'opp' && fx.k === 'hit' ? ' hit' : '') + (d.phase === 'end' && d.won ? ' ko' : ''))}${fx?.who === 'opp' && fx.k === 'hit' ? `<b class="dmg${fx.crit ? ' crit' : ''}">−${fx.n}</b>` : ''}${fx?.who === 'opp' && fx.k === 'heal' ? '<b class="dmg heal">💚</b>' : ''}</div>
    <div class="dplat me">${duelFig(d.me, 'me' + (fx?.who === 'me' && fx.k === 'hit' ? ' hit' : '') + (d.phase === 'end' && !d.won ? ' ko' : ''))}${fx?.who === 'me' && fx.k === 'hit' ? `<b class="dmg${fx.crit ? ' crit' : ''}">−${fx.n}</b>` : ''}${fx?.who === 'me' && fx.k === 'heal' ? '<b class="dmg heal">💚</b>' : ''}</div>${duelBox(d.me, d.hp.me, true, d.guard.me, d.max?.me, duelFx(d, 'me'))}
  </div>
  <div class="dpanel">${panel}</div>` };
}
function duelLobbyView() {
  const d = D, decks = S.decks.filter(x => S.cards.some(c => c.deckId === x.id && fightable(c)));
  if (!DUEL_DECK || !deckById(DUEL_DECK)) DUEL_DECK = decks[0]?.id || '';
  const pick = `<select data-duel-deck="1" class="grow">${decks.map(x => `<option value="${x.id}" ${x.id === DUEL_DECK ? 'selected' : ''}>${esc(x.name)} (${S.cards.filter(c => c.deckId === x.id && fightable(c)).length})</option>`).join('')}</select>`;
  const head = `<div class="row nowrap"><button class="iconbtn" data-go="#/boss">‹</button><h1 class="grow" style="margin:0">🥊 Pojedynek</h1></div>`;
  if (d && !d.bot && d.phase === 'lobby') { const link = `${location.origin}${location.pathname}#/duel/${d.code}`;
    return { tab: 'arena', html: `${head}<div class="card center"><div class="small muted">Kod pojedynku</div><div class="coop-code">${esc(d.code)}</div><button class="sm" data-act="duel-share" data-link="${esc(link)}">📤 Wyślij koledze</button></div>
      <div class="card dvs">${duelFig(d.me, 'me')}<b class="vs">VS</b>${d.opp ? duelFig(d.opp, 'op') : '<div class="dwait">⏳</div>'}<div class="dvs-n"><b>${esc(d.me.nick)}</b><b>${d.opp ? esc(d.opp.nick) : 'czekam…'}</b></div></div>
      ${d.host ? `<div class="card"><h3 style="margin-top:0">Tryb</h3>${duelModeHTML()}<p class="small muted" style="margin:6px 0 0">Pytania: <b>${DUEL_QF[duelQf()]}</b> (Panel admina)</p><h3>Talia pojedynku</h3><div class="row nowrap">${pick}</div><p class="small muted" style="margin:6px 0 0">Kolega dostanie te fiszki na czas walki.</p></div><button class="primary block boss-go" data-act="duel-start" ${d.opp ? '' : 'disabled'}>⚔️ Walcz!</button>` : '<p class="center muted">Gospodarz wybiera talię i zaczyna…</p>'}
      <button class="ghost block" data-act="duel-leave">Wyjdź</button>` }; }
  return { tab: 'arena', html: `${head}
  <div class="card dintro"><div class="dvs">${duelFig(duelMe(), 'me')}<b class="vs">VS</b><div class="dwait">❓</div></div>
    <p style="margin:8px 0 4px"><b>Turowa walka 1 na 1</b> – Twój bohater kontra bohater kolegi.</p>
    <p class="small" style="margin:0 0 4px">Pytania: <b>${DUEL_QF[duelQf()]}</b> <span class="muted">(zmienisz w Ustawieniach → 🛠️ Panel admina)</span></p>
    <ul class="small" style="text-align:left;margin:0"><li>W swojej turze wybierasz ruch: ⚔️ atak, 💥 mocny cios, 🛡️ garda, 💚 mikstura (mają PP).</li><li>Żeby ruch się udał – odpowiadasz na fiszkę. ${duelQf() === 'abcd' ? '' : 'Przy wpisywaniu siła ciosu = <b>celność</b> (literówka = słabszy cios). '}Szybko = mocniej, źle = <b>pudło</b>.</li><li>3 trafienia ładują supercios Twojej postaci.</li><li><b>⚡ Kto szybciej:</b> ta sama fiszka u obu naraz – ${duelQf() === 'type' ? 'obaj wpisujecie, <b>bliższa odpowiedź</b> atakuje (remis – szybsza)' : 'pierwsza dobra odpowiedź atakuje, zła = blokada do końca rundy'}.</li></ul></div>
  <div class="card dpvp"><h3 style="margin-top:0">🎒 Przedmioty PvP <small class="muted">(${pvpCount()})</small></h3>${Object.keys(PVP).map(k => `<div class="row nowrap dpvp-it"><span>${PVP[k][0]}</span><div class="grow"><b>${PVP[k][1]}</b> <small class="muted">×${itemCount('pvp', k)}</small><div class="small muted">${PVP[k][2]}</div></div></div>`).join('')}
    <p class="small muted" style="margin:8px 0 0">Zdobywasz je za pojedynki (wygrana z kolegą = zawsze). Max ${PVP_MAX} na walkę. ⚖️ Wiedza wygrywa: seria dobrych odpowiedzi daje do +30%, poziom postaci do +20% ❤️ i +15% obrażeń, a ekwipunek z bossów się nie liczy.</p></div>
  <div class="card"><h3 style="margin-top:0">Tryb</h3>${duelModeHTML()}<h3>Talia</h3><div class="row nowrap">${pick || '<p class="muted">Dodaj fiszki, żeby walczyć.</p>'}</div></div>
  <button class="primary block boss-go" data-act="duel-host" ${decks.length ? '' : 'disabled'}>➕ Stwórz pojedynek</button>
  <div class="row nowrap" style="margin-top:10px"><input id="duel-code" class="grow" maxlength="6" placeholder="Kod od kolegi" autocapitalize="characters" autocomplete="off" value="${esc(DUEL_JOIN)}"><button data-act="duel-join">Dołącz</button></div>
  <button class="block" data-act="duel-bot" style="margin-top:10px" ${decks.length ? '' : 'disabled'}>🤖 Trening z botem</button>` };
}
let DUEL_JOIN = '';
ROUTES.duel = (parts = []) => {
  if (parts[1] && /^[A-Z0-9]{6}$/i.test(parts[1]) && !D) DUEL_JOIN = parts[1].toUpperCase();
  if (D && (D.phase === 'fight' || D.phase === 'end')) return duelFightView();
  return duelLobbyView();
};
HUB_OF.duel = 'arena';
if (Array.isArray(HUBS.arena) && !HUBS.arena.some(x => x[0] === 'duel')) HUBS.arena.splice(2, 0, ['duel', '🥊', 'Pojedynek']);
document.addEventListener('change', e => { if (e.target.dataset?.duelDeck) DUEL_DECK = e.target.value; });
document.addEventListener('keydown', e => { if (e.target.id === 'duel-in' && e.key === 'Enter') { e.preventDefault(); ACTIONS['duel-check'](); } });
Object.assign(ACTIONS, {
  'duel-host': () => { duelOpen(roomCode(), true); render(); },
  'duel-join': () => { const c = ($('#duel-code')?.value || '').trim().toUpperCase(); if (!/^[A-Z0-9]{6}$/.test(c)) return toast('Kod ma 6 znaków'); DUEL_JOIN = ''; duelOpen(c, false); render(); },
  'duel-start': () => duelStart(),
  'duel-mode': el => { DUEL_MODE = el.dataset.m; render(); },
  'duel-speed': el => duelSpeedPick(+el.dataset.i),
  'duel-bot': () => { D?.ch?.close(); duelBot(); },
  'duel-move': el => duelPick(el.dataset.k),
  'duel-bag': () => { if (D) { D.bag = !D.bag; render(); } },
  'duel-item': el => duelUseItem(el.dataset.k),
  'duel-opt': el => { const q = D?.q; if (!q || q.done) return; const o = q.opts[+el.dataset.i]; duelAnswer(norm(o) === norm(q.card.a), o); },
  'duel-tf': el => { const q = D?.q; if (!q || q.done) return; duelAnswer((el.dataset.v === '1') === q.truth, el.dataset.v); },
  'duel-check': () => { if (D?.mode === 'speed') return duelSpeedType(); const q = D?.q, v = ($('#duel-in')?.value || '').trim(); if (!q || q.done) return; if (!v) return toast('Wpisz odpowiedź'); const acc = duelAcc(v, q.card.a); duelAnswer(acc > 0, v, acc); },
  'duel-rematch': () => { const d = D; if (!d) return; d.myRematch = true; dSend({ t: 'rematch' }); if (d.host && d.oppRematch) duelStart(); render(); },
  'duel-ff': () => { const d = D; if (d?.phase === 'fight' && !confirm('Poddać się?')) return; if (d?.phase === 'fight') { dSend({ t: 'ff' }); duelLog('🏳️ Poddajesz się'); duelEnd(false); return; } ACTIONS['duel-leave'](); },
  'duel-leave': () => { D?.ch?.close(); clearTimeout(D?.beat); D = null; go('#/duel'); render(); },
  'duel-share': el => { const link = el.dataset.link, t = `🥊 Pojedynek w Fiszkach! Kod: ${D.code}`; if (navigator.share) navigator.share({ title: 'Fiszki – pojedynek', text: t, url: link }).catch(() => {}); else { navigator.clipboard?.writeText(`${t} ${link}`); toast('📋 Skopiowano'); } },
});
// pasek sekcji Przygody nad pojedynkiem (hub.js owija tylko trasy istniejące przy starcie)
const duelRoute0 = ROUTES.duel;
ROUTES.duel = (...a) => { const v = duelRoute0(...a); if (!v || v.focus || typeof hubNav !== 'function') return v; LAST_HUB.arena = 'duel';
  return { ...v, tab: 'arena', html: hubNav('arena', 'duel') + (typeof stripBack === 'function' ? stripBack(v.html) : v.html) }; };

// ⚡ tryb „Kto szybciej”: ta sama fiszka u obu naraz, pierwsza dobra odpowiedź atakuje. Gospodarz losuje fiszki i sędziuje
// (porównuje czas od pokazania pytania na każdym telefonie – opóźnienie internetu nie faworyzuje nikogo). Zła odpowiedź = blokada do końca rundy.
const SPEED_MS = 12000, SPEED_TYPE_MS = 22000, SPEED_DMG = 22;
const speedMs = r => r?.kind === 'type' ? SPEED_TYPE_MS : SPEED_MS;
const duelHint = a => { const t = String(a).trim(); return t.slice(0, Math.max(1, Math.min(3, Math.floor(t.length / 3)))) + '…'; };
const duelModeHTML = () => `<div class="seg duel-mode"><button class="${DUEL_MODE === 'turn' ? 'on' : ''}" data-act="duel-mode" data-m="turn"><b>🎯 Turowy</b><small>na zmianę, ruchy i przedmioty</small></button><button class="${DUEL_MODE === 'speed' ? 'on' : ''}" data-act="duel-mode" data-m="speed"><b>⚡ ${duelQf() === 'type' ? 'Kto bliżej' : 'Kto szybciej'}</b><small>ta sama fiszka naraz</small></button></div>`;
function duelRound() {
  const d = D; if (!d || d.phase !== 'fight' || d.mode !== 'speed' || !d.host) return;
  const x = duelCard(d), type = d.qf === 'type', r = { i: (d.ri || 0) + 1, q: x.q, a: x.a, kind: type ? 'type' : 'abcd', opts: type ? [] : shuffle([x.a, ...duelWrong(d, x, 3)]) }; d.ri = r.i;
  dSend({ t: 'round', ...r }); duelRoundShow(r);
  clearTimeout(d.rT); d.rT = setTimeout(() => duelResolve(r.i), speedMs(r) + 400);
  if (d.bot) { const ok = Math.random() < .68, ms = (type ? 4000 : 2200) + Math.random() * (type ? 9000 : 5800), sc = ok ? (Math.random() < .5 ? 100 : 62 + Math.round(Math.random() * 33)) : 0;
    setTimeout(() => { if (D === d && d.r?.i === r.i && !d.r.res) duelBuzz('opp', r.i, ok, ms, sc); }, ms); }
}
function duelRoundShow(r) {
  const d = D; d.r = { ...r, at: Date.now(), mine: null, buzz: [], res: null, hide: [] };
  if (d.fz.me) { d.r.lockUntil = d.r.at + 3000; d.fz.me = false; toast('❄️ Zamrożony na 3 s!', 2500); } d.fz.opp = false;
  if (d.lupa) { d.lupa = false; if (d.r.kind === 'type') d.r.hint = duelHint(d.r.a); else d.r.hide = d.r.opts.map((o, i) => i).filter(i => norm(d.r.opts[i]) !== norm(d.r.a)).slice(0, 2); }
  render(); if (d.r.kind === 'type') setTimeout(() => document.getElementById('duel-in')?.focus(), 60);
}
function duelSpeedPick(k) {
  const d = D, r = d?.r; if (!r || r.res || r.mine != null || r.hide?.includes(k)) return; if (r.lockUntil && Date.now() < r.lockUntil) return toast('❄️ Jeszcze zamrożony…'); r.mine = k;
  const ok = norm(r.opts[k]) === norm(r.a), ms = Date.now() - r.at; if (ok) d.stats.ok++; else d.stats.bad++;
  if (d.host) duelBuzz('me', r.i, ok, ms); else dSend({ t: 'buzz', i: r.i, ok, ms }); render();
}
// ✍️ kto bliżej: wpisana odpowiedź → celność liczona u siebie, gospodarz porównuje obie
function duelSpeedType() {
  const d = D, r = d?.r; if (!r || r.res || r.mine != null || r.kind !== 'type') return;
  if (r.lockUntil && Date.now() < r.lockUntil) return toast('❄️ Jeszcze zamrożony…');
  const v = ($('#duel-in')?.value || '').trim(); if (!v) return toast('Wpisz odpowiedź');
  const sc = duelAcc(v, r.a), ok = sc > 0, ms = Date.now() - r.at; r.mine = v; r.sc = sc; if (ok) d.stats.ok++; else d.stats.bad++;
  if (d.host) duelBuzz('me', r.i, ok, ms, sc); else dSend({ t: 'buzz', i: r.i, ok, ms, sc }); render();
}
function duelBuzz(who, i, ok, ms, sc) {
  const d = D, r = d?.r; if (!r || r.i !== i || r.res || r.buzz.some(b => b.who === who)) return;
  r.buzz.push({ who, ok, ms, sc: ok ? (r.kind === 'type' ? sc ?? 100 : 100) : 0 });
  // kto bliżej: czekamy na obie odpowiedzi; 100% nie da się przebić (remis wygrywa szybszy) – wtedy chwila na spóźniony sygnał i koniec rundy
  if (r.kind === 'type') { clearTimeout(d.rT2); if (r.buzz.length >= 2) duelResolve(i); else if (r.buzz.some(b => b.sc === 100)) d.rT2 = setTimeout(() => duelResolve(i), 400); return; }
  if (r.buzz.some(b => b.ok)) { clearTimeout(d.rT2); d.rT2 = setTimeout(() => duelResolve(i), r.buzz.length >= 2 ? 0 : 400); }   // chwila na spóźniony, ale szybszy sygnał rywala
  else if (r.buzz.length >= 2) duelResolve(i);
}
function duelResolve(i) {
  const d = D, r = d?.r; if (!r || r.i !== i || r.res) return; clearTimeout(d.rT); clearTimeout(d.rT2);
  const best = r.buzz.filter(b => b.ok).sort((a, b) => b.sc - a.sc || a.ms - b.ms)[0], other = best && r.buzz.find(b => b !== best);
  const res = best ? { win: best.who === 'me' ? 'host' : 'guest', ms: Math.round(best.ms), sc: best.sc, osc: other?.sc || 0, dmg: Math.round((r.kind === 'type' ? (30 * best.sc / 100) * (best.ms < 6000 ? 1.15 : 1) : best.ms < 3500 ? 30 : SPEED_DMG) * duelLvMul(d[best.who]) * duelStreakMul(d.streak[best.who]) * (d.adren[best.who] ? 1.5 : 1)) } : { win: 'none', ms: 0, dmg: 0 };
  dSend({ t: 'rres', i, ...res }); duelRoundRes(res);
}
function duelRoundRes(res) {
  const d = D, r = d?.r; if (!r || r.res) return; r.res = res;
  const who = res.win === 'host' || res.win === 'guest' ? ((res.win === 'host') === !!d.host ? 'me' : 'opp') : null;
  if (who) { const def = who === 'me' ? 'opp' : 'me'; let dmg = res.dmg, back = 0;
    if (d.mirror[def]) { back = Math.round(dmg * .3); dmg = Math.round(dmg * .5); d.mirror[def] = false; d.hp[who] = Math.max(0, d.hp[who] - back); }
    d.hp[def] = Math.max(0, d.hp[def] - dmg); d.fx = { who: def, k: 'hit', n: dmg, crit: res.dmg > SPEED_DMG * 1.3, t: Date.now() }; d.adren[who] = false; d.streak[who]++; d.streak[def] = 0;
    duelLog(`${r.kind === 'type' ? res.sc === 100 && !res.osc ? `✍️ ${(who === 'me' ? d.me : d.opp).nick} pierwszy wpisał dokładnie (🎯 100%)` : `✍️ ${(who === 'me' ? d.me : d.opp).nick} był bliżej (🎯 ${res.sc}%${res.osc ? ` vs ${res.osc}%` : ''}${res.sc === res.osc ? `, szybciej: ${(res.ms / 1000).toFixed(1).replace('.', ',')} s` : ''})` : `⚡ ${(who === 'me' ? d.me : d.opp).nick} był szybszy (${(res.ms / 1000).toFixed(1).replace('.', ',')} s)`}! −${dmg}${back ? ` · 🪞 odbite −${back}` : ''}${d.streak[who] >= 3 ? ` · 🔥 seria ${d.streak[who]}` : ''}`);
    if (typeof bossSfx === 'function') bossSfx(who === 'me' ? 'hit' : 'hurt'); }
  else { duelLog(`😶 Nikt nie trafił: ${mShort(r.q, 40)} → ${mShort(r.a, 40)}`); d.streak.me = d.streak.opp = 0; }
  for (const w of ['me', 'opp']) if (d.regen[w] > 0) { d.hp[w] = Math.min(d.max[w], d.hp[w] + Math.round(d.max[w] * .04)); d.regen[w]--; }
  render();
  if (d.hp.me <= 0 || d.hp.opp <= 0) return setTimeout(() => { if (D === d) duelEnd(d.hp.opp <= 0 && d.hp.me > 0 || (d.hp.opp <= 0 && who === 'me')); }, 900);
  if (d.host) setTimeout(() => { if (D === d && d.phase === 'fight') duelRound(); }, 2000);
}
function duelSpeedPanel(d) {
  const r = d.r; if (!r) return `<div class="dtext"><b>⚡ Kto szybciej – przygotuj się…</b><small>${esc(d.log[0] || '')}</small></div>`;
  const res = r.res, mineOk = r.mine != null && norm(r.opts[r.mine]) === norm(r.a);
  if (r.kind === 'type') {
    const st = res ? (res.win === 'none' ? `<small class="bad">Nikt nie trafił. Poprawnie: ${esc(r.a)}</small>` : `<small class="${(res.win === 'host') === !!d.host ? 'good' : 'bad'}">${esc(d.log[0] || '')}</small><small>Poprawnie: <b>${esc(r.a)}</b></small>`)
      : r.mine != null ? `<small class="${r.sc ? 'good' : 'bad'}">${r.sc ? `✓ 🎯 Celność ${r.sc}% – czekam na rywala…` : '✗ Pudło – czekam na rywala…'}</small>` : '<div class="dq-bar"><i></i></div>';
    return `<div class="dtext"><small>✍️ Runda ${r.i} – wpisz odpowiedź, bliższa atakuje!</small><b>${esc(r.q)}</b>${st}</div>
      ${!res && r.mine == null ? `${r.hint ? `<p class="small muted center" style="margin:4px 0">🔍 Zaczyna się od: <b>${esc(r.hint)}</b></p>` : ''}<div class="type-row"><input id="duel-in" placeholder="Wpisz odpowiedź…" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go"><button class="primary type-go" data-act="duel-check">✓</button></div>` : r.mine != null ? `<p class="small muted center" style="margin:4px 0">Twoja odpowiedź: <b>${esc(r.mine)}</b></p>` : ''}${duelBagHTML(d, true)}`;
  }
  const status = res ? (res.win === 'none' ? `<small class="bad">Nikt nie trafił. Poprawnie: ${esc(r.a)}</small>` : `<small class="${(res.win === 'host') === !!d.host ? 'good' : 'bad'}">${esc(d.log[0] || '')}</small>`)
    : r.mine != null ? (mineOk ? '<small class="good">✓ Dobrze! Czekam, kto był pierwszy…</small>' : '<small class="bad">✗ Źle – blokada do końca rundy</small>') : '<div class="dq-bar"><i></i></div>';
  return `<div class="dtext"><small>⚡ Runda ${r.i} – kto pierwszy odpowie dobrze, ten atakuje!</small><b>${esc(r.q)}</b>${status}</div>
    <div class="dmoves q">${r.opts.map((o, k) => { const right = norm(o) === norm(r.a); return `<button class="${res || r.mine != null ? (right && (res || r.mine === k) ? 'right' : r.mine === k ? 'wrong' : '') : ''}${r.hide?.includes(k) ? ' hid' : ''}" data-act="duel-speed" data-i="${k}" ${res || r.mine != null || r.hide?.includes(k) ? 'disabled' : ''}>${esc(o)}</button>`; }).join('')}</div>${duelBagHTML(d, true)}`;
}

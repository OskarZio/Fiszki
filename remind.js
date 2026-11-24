'use strict';
/* 🔔 Bossy-przypominajki: dodatkowi bossowie przy taliach, którzy pilnują, żebyś nie zapominał.
   0 👻 Upiór Zaległości – gdy w talii czekają zaległe powtórki; walczysz TYLKO nimi i każda odpowiedź to prawdziwa powtórka (harmonogram).
     Im dłużej odkładasz naukę (wiek najstarszej zaległej fiszki), tym jest DUŻO silniejszy: ❤️ i ciosy rosną z każdym dniem.
   1 💔 Pożeracz Błędów – raz w tygodniu na talię: fiszki, które najczęściej zapominasz. Wygrana = 🛡️ +25% ❤️ w następnej walce z bossem tej talii.
   2 ⏳ Zegarmistrz Egzaminu – gdy talia ma datę egzaminu: próby na 7, 3 i 1 dzień przed, coraz mniej czasu; wynik w % jak próbny egzamin.
   3 🌫️ Echo Pamięci – opanowane fiszki (odstęp ≥ 21 dni), których dawno nie widziałeś; ≥ 80% = 🔏 pieczęć „wiedza się trzyma”.
   4 🔔 Przypominajka dnia – codziennie 5 fiszek z talii, która najbardziej tego potrzebuje; nagroda rośnie z serią dni.
   Nagrody w 💎. Tylko Upiór zmienia harmonogram fiszek (pozostali to trening). Upiór trafia też do powiadomienia push (profil → funkcja reminders). */
const REM = [
  { k: 'ghost', bi: 32, ic: '👻', name: 'Upiór Zaległości', desc: 'Karmi się fiszkami, które odkładasz. Im dłużej czekasz, tym jest większy.' },
  { k: 'eater', bi: 21, ic: '💔', name: 'Pożeracz Błędów', desc: 'Poluje na fiszki, które najczęściej Ci uciekają.' },
  { k: 'clock', bi: 46, ic: '⏳', name: 'Zegarmistrz Egzaminu', desc: 'Odlicza dni do egzaminu. Z każdą próbą daje mniej czasu.' },
  { k: 'echo', bi: 20, ic: '🌫️', name: 'Echo Pamięci', desc: 'Sprawdza, czy dawno opanowana wiedza wciąż się trzyma.' },
  { k: 'daily', bi: 37, ic: '🔔', name: 'Chochlik Przypominajka', desc: 'Codziennie wpada na chwilę – 5 fiszek i po sprawie.' },
];
const REM_GHOST_MIN = 10, REM_EXAM = [7, 3, 1];
const remSt = () => (S.stats.rem = S.stats.rem || {});
const remDue = d => S.cards.filter(c => c.deckId === d.id && !c.sus && c.srs.state !== 'new' && c.srs.due <= Date.now() && fightable(c));
// 👻 wzrost: dni od najstarszej zaległości → bardzo szybko rośnie (3 dni ≈ ×2,3 · 7 dni ≈ ×5 · max ×8)
const remAge = cs => cs.length ? Math.max(0, Math.floor((Date.now() - Math.min(...cs.map(c => c.srs.due))) / DAY)) : 0;
const remGrow = days => Math.min(8, 1 + .3 * days + .04 * days * days);
const remLast = () => logMemo('remLast', () => { const m = {}; for (const l of S.log) if (!m[l.c] || l.t > m[l.c]) m[l.c] = l.t; return m; });
const remMiss = () => logMemo('remMiss', () => { const m = {}, since = Date.now() - 21 * DAY; for (const l of S.log) if (l.t >= since && l.g === 1) m[l.c] = (m[l.c] || 0) + 1; return m; });
function remDailyDeck() {
  let best = null, bn = 0;
  for (const d of S.decks) { if (d.paused) continue; const n = remDue(d).length * 3 + S.cards.filter(c => c.deckId === d.id && (c.srs.lapses || 0) > 0).length; if (n > bn && S.cards.filter(c => c.deckId === d.id && c.srs.state !== 'new' && fightable(c)).length >= 5) { bn = n; best = d; } }
  return best;
}
function remCards(t, d) {
  const now = Date.now(), base = S.cards.filter(c => c.deckId === d.id && !c.sus && fightable(c));
  if (t === 0) return remDue(d).sort((a, b) => a.srs.due - b.srs.due);
  if (t === 1) { const ms = remMiss(); return base.filter(c => (c.srs.lapses || 0) > 0 || ms[c.id]).sort((a, b) => ((b.srs.lapses || 0) + 2 * (ms[b.id] || 0)) - ((a.srs.lapses || 0) + 2 * (ms[a.id] || 0))); }
  if (t === 2) return shuffle(base.filter(c => c.srs.state !== 'new'));
  if (t === 3) { const L = remLast(); return base.filter(c => c.srs.ivl >= 21 && now - (L[c.id] || 0) >= 14 * DAY).sort((a, b) => (remLast()[a.id] || 0) - (remLast()[b.id] || 0)); }
  const due = remDue(d), rest = base.filter(c => c.srs.state !== 'new' && !due.includes(c)).sort((a, b) => (b.srs.lapses || 0) - (a.srs.lapses || 0));
  return [...due, ...rest];
}
// stan dostępności: { ok, why, info, len, diff, grow }
function remState(t, d) {
  const st = remSt(), cs = remCards(t, d);
  if (t === 0) { const days = remAge(cs), ok = cs.length >= REM_GHOST_MIN || (cs.length >= 5 && days >= 2);
    return { ok, cs, days, grow: remGrow(days), len: Math.min(30, cs.length), diff: Math.min(3, Math.floor(days / 4)),
      info: `${cs.length} ${plural(cs.length, 'zaległa fiszka', 'zaległe fiszki', 'zaległych fiszek')}${days ? ` · rośnie od ${days} ${plural(days, 'dnia', 'dni', 'dni')} · siła ×${String(remGrow(days).toFixed(1)).replace('.', ',')}` : ' · świeży'}` }; }
  if (t === 1) { const done = st.eat?.[d.id] === weekId(); return { ok: cs.length >= 5 && !done, cs, len: Math.min(15, cs.length), diff: 2, done, info: done ? 'pokonany w tym tygodniu' : `${Math.min(15, cs.length)} najczęściej zapominanych fiszek · raz w tygodniu` }; }
  if (t === 2) { const e = typeof examInfo === 'function' ? examInfo(d) : null; if (!e || e.past || e.daysLeft > 7 || e.daysLeft < 1) return { ok: false };
    const done = st.clock?.[d.id]?.[d.exam] || {}, stage = REM_EXAM.find(s => e.daysLeft <= s && done[s] == null);
    if (!stage) return { ok: false, info: 'wszystkie próby zrobione' };
    return { ok: cs.length >= 10, cs, stage, len: Math.min(25, cs.length), diff: { 7: 2, 3: 3, 1: 4 }[stage], info: `próba ${REM_EXAM.indexOf(stage) + 1}/3 · egzamin ${inDays(e.daysLeft)} · coraz mniej czasu` }; }
  if (t === 3) { const last = st.echo?.[d.id] || 0, cool = Date.now() - last < 14 * DAY; return { ok: cs.length >= 8 && !cool, cs, len: 10, diff: 2, info: cool ? 'wróci za ' + Math.ceil((last + 14 * DAY - Date.now()) / DAY) + ' dni' : `${cs.length} dawno niewidzianych opanowanych fiszek` }; }
  const day = dayKey(Date.now()), done = st.day?.d === day;
  return { ok: !done, cs, len: 5, diff: 1, done, info: done ? 'zrobione dziś – wróć jutro' : `5 fiszek · seria: ${st.day?.s || 0} ${plural(st.day?.s || 0, 'dzień', 'dni', 'dni')}` };
}
function remBoss(id, t) {
  t = +t || 0; const d = t === 4 ? (id === 'daily' ? remDailyDeck() : deckById(id)) : deckById(id); if (!d) return null;
  const R = REM[t], s = remState(t, d); if (!s.cs) return null;
  const bo = bossOf(R.bi);
  return { ...bo, kind: 'rem', id: t === 4 ? 'daily' : d.id, deckId: d.id, i: t, rt: t, cards: s.cs, len: s.len, stars: 0, diff: s.diff ?? 1, grow: s.grow || 1, noSrs: t !== 0, stage: s.stage,
    name: R.name, desc: R.desc, title: `${R.ic} ${R.name} · „${d.name}” – ${s.info}`, ok: !!s.ok, learned: s.cs.length, need: t === 0 ? REM_GHOST_MIN : t === 3 ? 8 : 5,
    lockMsg: s.info || 'Jeszcze nie teraz', repeat: false, pr: hero().pr || 0, seed: hashStr(d.id + t) % 100000, remInfo: s.info };
}
const remBossFor0 = bossFor;
bossFor = function (kind, id, i) { return kind === 'rem' ? remBoss(id, i) : remBossFor0(kind, id, i); };
// 👻 siła rośnie z czasem odkładania
const remParams0 = bossParams;
bossParams = function (b, mode) { const p = remParams0(b, mode); if (b.kind !== 'rem' || !(b.grow > 1)) return p;
  return { ...p, hp: Math.round(p.hp * (1 + (b.grow - 1) * .5)), atk: Math.round(p.atk * (1 + (b.grow - 1) * .2)), every: Math.max(2, p.every) }; };   // silny, ale do wygrania
// 💔 tarcza od Pożeracza: +25% ❤️ w następnej walce z bossem tej talii
const remBegin0 = bossBegin;
bossBegin = function (b, ...a) { remBegin0(b, ...a); const st = remSt(), B = BOSS;
  if (B && ['ch', 'fin'].includes(b.kind) && st.shield?.[b.id]) { B.meMax = Math.round(B.meMax * 1.25); B.me = B.meMax; delete st.shield[b.id]; B.log.unshift('🛡️ Tarcza Pożeracza Błędów: +25% ❤️ na tę walkę'); save(); render(); } };
const remEnd0 = bossEnd;
bossEnd = function (won, why) {
  const B = BOSS, b = B?.b, wasFight = B?.phase === 'fight'; remEnd0(won, why);
  if (!wasFight || b?.kind !== 'rem') return;
  const st = remSt(), t = b.rt, d = deckById(b.deckId), acc = B.ok + B.bad ? B.ok / (B.ok + B.bad) : 0, pct = Math.round(acc * 100); let gems = 0, extra = '';
  if (t === 2 && d?.exam) { const c = st.clock = st.clock || {}; ((c[d.id] = c[d.id] || {})[d.exam] = c[d.id][d.exam] || {})[b.stage] = pct;   // próba liczy się także przy porażce
    extra = `Próbny egzamin: <b>${pct}%</b>${pct >= 80 ? ' – 🎓 gotów na egzamin!' : pct >= 60 ? ' – blisko, powtórz trudne' : ' – jeszcze sporo do powtórki'}`; if (pct >= 80) st.ready = (st.ready || 0) + 1; }
  if (won) {
    if (t === 0) gems = Math.min(250, 20 + 12 * Math.max(0, Math.round((b.grow - 1) * 5)) + B.ok);
    if (t === 1) { gems = 30 + 2 * B.ok; (st.eat = st.eat || {})[b.deckId] = weekId(); (st.shield = st.shield || {})[b.deckId] = 1; extra = '🛡️ Tarcza: +25% ❤️ w następnej walce z bossem tej talii'; }
    if (t === 2) gems = 40 + (pct >= 80 ? 20 : 0);
    if (t === 3) { gems = 25; (st.echo = st.echo || {})[b.deckId] = Date.now(); if (pct >= 80) { (st.seal = st.seal || {})[b.deckId] = dayKey(Date.now()); extra = '🔏 Pieczęć pamięci: ta wiedza się trzyma!'; } }
    if (t === 4) { const day = dayKey(Date.now()), y = dayKey(Date.now() - DAY), s = st.day?.d === y ? (st.day.s || 0) + 1 : 1; st.day = { d: day, s }; gems = 10 + 2 * Math.min(10, s); extra = `🔥 Seria przypominajek: ${s} ${plural(s, 'dzień', 'dni', 'dni')}`; }
    gems = typeof crystN === 'function' ? crystN(gems) : gems;
    if (gems) S.wallet.push({ id: 'rem-' + uid(), n: gems, why: 'remind', t: Date.now() });
  }
  B.remMsg = (gems ? `+${gems} 💎` : '') + (extra ? (gems ? ' · ' : '') + extra : ''); save();
  if (B.remMsg) setTimeout(() => celebrate(`${REM[t].ic} ${REM[t].name}${won ? ' pokonany!' : ''}`, B.remMsg.replace(/<[^>]+>/g, '')), 900);
  render();
};
// ---------- Przygoda: sekcja „🔔 Przypominajki” nad taliami
// ---------- Przygoda: przypominajki stoją w ścieżce talii, obok zwykłych bossów – inna ramka i znaczek 🔔
const REM_SHORT = ['Zaległości', 'Błędy', 'Egzamin', 'Echo', 'Dziś'];
function remNodes(d) {
  const out = [], dd = (() => { try { return remDailyDeck(); } catch { return null; } })();
  for (const t of [0, 2, 1, 3, 4]) {
    if (t === 4 && dd?.id !== d.id) continue;
    let b = null; try { b = remBoss(t === 4 ? 'daily' : d.id, t); } catch (e) { console.warn(e); }
    if (b && (b.ok || (t === 4 && remSt().day?.d === dayKey(Date.now())))) out.push(b);
  }
  if (!out.length) return { html: '', n: 0, hot: false };
  const hot = out.some(b => b.rt === 0);
  const html = '<i class="mline rem-line"></i>' + out.map(b => { const g = b.rt === 0 && b.grow > 1;
    return `<button class="bnode rem-node rt-${b.rt}${b.ok ? '' : ' locked'}${g && b.grow >= 3 ? ' danger' : ''}" data-act="${b.ok ? 'boss-sel' : 'rem-info'}" data-kind="rem" data-id="${b.id}" data-i="${b.rt}" title="${esc(b.name)} – ${esc(b.remInfo)}">
      <i class="rem-bell">${REM[b.rt].ic}</i><span class="bn-art">${bossArt(b)}</span><small>${REM_SHORT[b.rt]}</small>
      <span class="rem-sub">${g ? `siła ×${String(b.grow.toFixed(1)).replace('.', ',')}` : b.rt === 2 ? `próba ${REM_EXAM.indexOf(b.stage) + 1}/3` : b.ok ? `${b.len} fiszek` : '✓ dziś'}</span></button>`; }).join('<i class="mline rem-line"></i>');
  return { html, n: out.filter(b => b.ok).length, hot };
}
ACTIONS['rem-info'] = el => { const b = bossFor('rem', el.dataset.id, +el.dataset.i); if (b) toast(`${REM[b.rt].ic} ${b.name}: ${b.remInfo}`, 3000); };
// 🔔 powiadomienie: profil niesie liczbę zaległości i wiek Upiora – funkcja serwera „reminders” wysyła wtedy tekst o Upiorze
if (typeof myProfile === 'function') { const remProf0 = myProfile; myProfile = function () { const p = remProf0();
  try { let due = 0, days = 0, ghosts = 0; for (const d of S.decks) { if (d.paused) continue; const cs = remDue(d); due += cs.length; const g = remState(0, d); if (g.ok) { ghosts++; days = Math.max(days, g.days); } }
    p.rem = { due, days, ghosts, daily: remSt().day?.s || 0 }; } catch { /* */ }
  return p; }; }

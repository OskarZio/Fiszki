'use strict';
/* 🃏 Kumulacja – tryb gry na fiszkach (tylko konto admina). Bieg przez 8 rund z rosnącym progiem punktów (+ tryb bez końca).
   Runda: ręka fiszek, wybierasz 1–3 i odpowiadasz (ABCD albo wpisywanie). Zagranie ma TYP (Pojedyncza, Dwójka, Trójka,
   Jedna talia, Przekrój, Ciężka trójka) z podstawą i mnożnikiem; podręczniki podnoszą poziom typu.
   Punkty = (podstawa typu + wartości dobrze zagranych fiszek) × mnożnik. Atuty liczą się po kolei od lewej
   (kolejność ma znaczenie), część rośnie w trakcie biegu. Pieczątki zostają na fiszkach do końca biegu.
   Rundy 3, 6 i 8 prowadzi Egzaminator z utrudnieniem. Zaległe fiszki liczą się jak powtórki. */
const kumAdmin = () => typeof IS_ADMIN !== 'undefined' && IS_ADMIN === true;
const KUM_TARGETS = [300, 500, 900, 1300, 2000, 3200, 4500, 7000];
const kumTarget = r => r <= KUM_TARGETS.length ? KUM_TARGETS[r - 1] : Math.round(KUM_TARGETS[KUM_TARGETS.length - 1] * Math.pow(1.6, r - KUM_TARGETS.length) / 100) * 100;
const KUM_BOSS_ROUNDS = [3, 6, 8];
const KUM_HAND = 5, KUM_MAX_PLAY = 3, KUM_ITEM_SLOTS = 2;
// typy zagrań: podstawa, mnożnik; każdy poziom +10 podstawy i +1 mnożnika
const KUM_TYPES = {
  single: { n: 'Pojedyncza', c: 10, m: 1 },
  pair:   { n: 'Dwójka', c: 20, m: 2 },
  triple: { n: 'Trójka', c: 30, m: 3 },
  same:   { n: 'Jedna talia', c: 45, m: 3 },
  mix:    { n: 'Przekrój', c: 45, m: 4 },
  hard:   { n: 'Ciężka trójka', c: 60, m: 4 },
};
// egzaminatorzy – utrudnienia rund 3, 6, 8
const KUM_BOSSES = {
  type:    { ic: '✍️', n: 'Pisemny', d: 'Tylko wpisywanie – bez ABCD' },
  nonew:   { ic: '🚫', n: 'Weteran', d: 'Nowe fiszki nie dają podstawy' },
  two:     { ic: '✌️', n: 'Skąpy', d: 'Najwyżej 2 fiszki na zagranie' },
  hand4:   { ic: '🤏', n: 'Ciasna ręka', d: 'Ręka ma tylko 4 fiszki' },
  discpay: { ic: '💸', n: 'Celnik', d: 'Każda wymiana kosztuje 1 monetę' },
  mute:    { ic: '🔇', n: 'Cisza', d: 'Pierwszy atut od lewej nie działa' },
};
// atuty: r – rzadkość (c zwykły, r rzadki, l legendarny), f – działanie na mnożnik / podstawę (liczone od lewej)
const KUM_J = {
  risk:   { ic: '🎲', r: 'c', n: 'Ryzykant', d: 'Nowe i trudne fiszki ×2 wartości', p: 5 },
  writer: { ic: '✍️', r: 'c', n: 'Pisarz', d: 'Wpisane odpowiedzi ×2 wartości (zamiast ×1,5)', p: 5 },
  miser:  { ic: '🪙', r: 'c', n: 'Skąpiec', d: '+1 moneta za każdą niewykorzystaną wymianę', p: 4 },
  banker: { ic: '🏦', r: 'c', n: 'Bankier', d: 'Odsetki do 10 monet zamiast 5', p: 5 },
  swap:   { ic: '🔄', r: 'c', n: 'Wymiennik', d: '+2 wymiany na rundę', p: 4 },
  quick:  { ic: '⚡', r: 'c', n: 'Szybkie palce', d: 'Dobra odpowiedź w < 5 s: +15 wartości', p: 5 },
  elder:  { ic: '🐘', r: 'c', n: 'Pamięć słonia', d: 'Utrwalone fiszki ×2 wartości', p: 5 },
  plus:   { ic: '➕', r: 'c', n: 'Plusik', d: '+4 do mnożnika', p: 4, f: (x) => { x.m += 4; return '+4'; } },
  sniper: { ic: '🏹', r: 'c', n: 'Snajper', d: 'Pojedyncza: ×3 mnożnik', p: 5, f: (x) => { if (x.type === 'single') { x.m *= 3; return '×3'; } } },
  roll:   { ic: '🔥', r: 'r', n: 'Rozpęd', d: '+1 mnożnik za każdą dobrą odpowiedź z rzędu (błąd zeruje)', p: 7, f: (x, K) => { if (K.streak) { x.m += K.streak; return '+' + K.streak; } } },
  second: { ic: '🛟', r: 'r', n: 'Druga szansa', d: 'Pierwszy błąd w rundzie liczy się jak dobra odpowiedź (połowa wartości)', p: 6 },
  spec:   { ic: '🎯', r: 'r', n: 'Specjalista', d: 'Jedna talia: +6 mnożnik', p: 6, f: (x) => { if (x.type === 'same') { x.m += 6; return '+6'; } } },
  extra:  { ic: '▶️', r: 'r', n: 'Dodatkowe zagranie', d: '+1 zagranie na rundę', p: 7 },
  hoard:  { ic: '💎', r: 'r', n: 'Kolekcjoner', d: '+8 podstawy za każdy posiadany atut', p: 6, f: (x, K) => { const v = 8 * K.jokers.length; x.c += v; return '+' + v + ' pkt'; } },
  grow:   { ic: '🌱', r: 'r', n: 'Ziarenko', d: 'Rośnie: +1 mnożnik na stałe po każdej wygranej rundzie', p: 6, grows: true, f: (x, K, j) => { if (j.v) { x.m += j.v; return '+' + j.v; } } },
  piggy:  { ic: '🐷', r: 'r', n: 'Skarbonka', d: 'Rośnie: +3 podstawy za każdą monetę wydaną w sklepie', p: 6, grows: true, f: (x, K, j) => { if (j.v) { x.c += 3 * j.v; return '+' + 3 * j.v + ' pkt'; } } },
  gold:   { ic: '👑', r: 'l', n: 'Złota rączka', d: 'Każde zagranie ×1,5 mnożnika', p: 9, f: (x) => { x.m *= 1.5; return '×1,5'; } },
  echo:   { ic: '🔁', r: 'l', n: 'Echo', d: 'Pierwsza fiszka w zagraniu liczy się podwójnie', p: 8 },
  prof:   { ic: '🎓', r: 'l', n: 'Profesor', d: 'Mnożnik ×(1 + 0,25 za każdy poziom typów zagrań)', p: 9, f: (x, K) => { const L = Object.values(K.levels).reduce((a, b) => a + b, 0); if (L) { const k = 1 + .25 * L; x.m *= k; return '×' + String(k).replace('.', ','); } } },
};
const KUM_RAR = { c: { n: 'zwykły', w: 70 }, r: { n: 'rzadki', w: 25 }, l: { n: 'legendarny', w: 5 } };
// pomoce (jednorazowe), podręczniki i pieczątki
const KUM_I = {
  half:   { ic: '✂️', n: '50/50', d: 'Usuwa 2 złe odpowiedzi z bieżącej fiszki', p: 2 },
  letter: { ic: '🔤', n: 'Pierwsza litera', d: 'Pokazuje początek odpowiedzi', p: 2 },
  disc:   { ic: '🃏', n: 'Dodatkowa wymiana', d: '+1 wymiana w tej rundzie', p: 2 },
  shield: { ic: '🛡️', n: 'Tarcza', d: 'Następny błąd liczy się jak dobra odpowiedź', p: 3 },
  st_gold:  { ic: '🟨', n: 'Złota pieczątka', d: 'Na fiszkę z ręki: +3 monety, gdy dobrze zagrana', p: 3, stamp: 'gold' },
  st_glass: { ic: '🔷', n: 'Szklana pieczątka', d: 'Na fiszkę z ręki: ×2 mnożnik zagrania, ale może pęknąć (1/4)', p: 4, stamp: 'glass' },
  st_stone: { ic: '🪨', n: 'Kamienna pieczątka', d: 'Na fiszkę z ręki: +50 wartości', p: 3, stamp: 'stone' },
};
for (const [k, T] of Object.entries(KUM_TYPES)) KUM_I['bk_' + k] = { ic: '📘', n: `Podręcznik: ${T.n}`, d: `Typ „${T.n}” +1 poziom (+10 podstawy, +1 mnożnik) na cały bieg`, p: 3, book: k };
const KUM_STAMPS = { gold: { ic: '🟨', n: 'złota' }, glass: { ic: '🔷', n: 'szklana' }, stone: { ic: '🪨', n: 'kamienna' } };
const KUM_KITS = {
  classic: { ic: '🎒', n: 'Klasyczny', d: '4 monety, bez niespodzianek' },
  nerd:    { ic: '🤓', n: 'Kujon', d: '+1 zagranie w każdej rundzie, ale 1 wymiana mniej' },
  gamble:  { ic: '🎰', n: 'Hazardzista', d: 'Start z 12 monetami, ale tylko 2 wymiany' },
  pen:     { ic: '🖋️', n: 'Pisarz', d: 'Start z atutem „Pisarz”' },
};
let KUM = null;
const kumJ = id => KUM?.jokers.find(j => j.id === id && !(KUM.boss === 'mute' && KUM.jokers[0] === j));
const kumHas = id => !!kumJ(id);
const kumIcon = s => `<span class="kum-ic">${s}</span>`;
const kumSell = j => Math.floor(KUM_J[j.id].p / 2) + (KUM_J[j.id].grows ? Math.floor((j.v || 0) / 2) : 0);

// ---------- pula fiszek
function kumPool(deckId) {
  const ok = c => !c.sus && (deckId === 'all' || c.deckId === deckId) && (() => { const a = cardView(c).ans; return a && a.trim() && a.length <= 200; })();
  const cs = S.cards.filter(ok), now = Date.now(), isDue = c => c.srs.state !== 'new' && c.srs.due <= now;
  return [...shuffle(cs.filter(isDue)), ...shuffle(cs.filter(c => !isDue(c)))].map(c => c.id);
}
const kumCard = id => S.cards.find(c => c.id === id);
function kumKind(c) {
  if (!c) return { k: 'mid', base: 10, t: '' };
  if (c.srs.state === 'new') return { k: 'new', base: 20, t: 'nowa' };
  if (isLearning(c) || (c.srs.lapses || 0) >= 2) return { k: 'hard', base: 25, t: 'trudna' };
  if ((c.srs.ivl || 0) >= 7) return { k: 'mature', base: 10, t: 'utrwalona' };
  return { k: 'mid', base: 15, t: '' };
}
const kumHandSize = () => KUM.boss === 'hand4' ? 4 : KUM_HAND;
const kumMaxPlay = () => KUM.boss === 'two' ? 2 : KUM_MAX_PLAY;
function kumDraw() {
  const K = KUM; while (K.hand.length < kumHandSize()) { if (!K.deck.length) K.deck = shuffle(K.all.filter(id => !K.hand.includes(id))); const id = K.deck.shift(); if (id == null) break; if (!K.hand.includes(id)) K.hand.push(id); }
}
// typ zagrania z listy fiszek (dla podglądu: wszystkie wybrane; do punktów: tylko dobrze odpowiedziane)
function kumTypeOf(ids) {
  const n = ids.length; if (!n) return null;
  const cs = ids.map(kumCard), decks = new Set(cs.map(c => c?.deckId)), kinds = cs.map(kumKind);
  if (n === 3 && kinds.every(k => k.k === 'new' || k.k === 'hard')) return 'hard';
  if (n === 3 && decks.size === 3) return 'mix';
  if (n >= 2 && decks.size === 1) return 'same';
  return n === 3 ? 'triple' : n === 2 ? 'pair' : 'single';
}
const kumTypeVal = t => { const T = KUM_TYPES[t], L = KUM.levels[t] || 0; return { c: T.c + 10 * L, m: T.m + L, L }; };
function kumStartRound() {
  const K = KUM, boss = KUM_BOSS_ROUNDS.includes(K.round) || (K.round > KUM_TARGETS.length && K.round % 2 === 0);
  K.boss = boss ? shuffle(Object.keys(KUM_BOSSES))[0] : null;
  K.score = 0; K.plays = 3 + (K.kit === 'nerd' ? 1 : 0) + (kumHas('extra') ? 1 : 0) - (K.round === KUM_TARGETS.length ? 1 : 0);
  K.disc = (K.kit === 'gamble' ? 2 : K.kit === 'nerd' ? 2 : 3) + (kumHas('swap') ? 2 : 0);
  K.usedSecond = false; K.sel = []; K.phase = 'pick'; K.hand = []; kumDraw();
}
function kumStart(deckId, kit) {
  const all = kumPool(deckId);
  if (all.length < 12) return toast('Za mało fiszek – potrzeba min. 12 (z krótką odpowiedzią)', 4000);
  KUM = { deckId, kit, all, deck: all.slice(), hand: [], round: 1, money: kit === 'gamble' ? 12 : 4, jokers: [], slots: 5, items: [], levels: {}, stamps: {}, streak: 0, total: 0, best: 0, spent: 0, shield: false, phase: 'pick', endless: false, slotBought: false };
  if (kit === 'pen') KUM.jokers.push({ id: 'writer' });
  kumStartRound(); render();
}
// ---------- odpowiadanie
function kumOpts(c) {
  const e = distractorEntry(c), pool = S.cards.filter(x => x.id !== c.id).slice(0, 2000).map(distractorEntry).filter(x => x.a && norm(x.a) !== norm(e.a));
  const wrong = pickDistractors(e, pool, 3); if (wrong.length < 3) return null;
  return shuffle([e.a, ...wrong]);
}
function kumPlay() {
  const K = KUM; if (!K.sel.length) return toast('Wybierz fiszki');
  K.q = K.sel.map(id => ({ id, res: null })); K.qi = 0; K.phase = 'answer'; kumAsk(); render();
}
function kumAsk() {
  const K = KUM, q = K.q[K.qi], c = kumCard(q.id);
  q.opts = K.boss === 'type' ? null : kumOpts(c); q.mode = q.opts ? 'abcd' : 'type'; q.at = Date.now(); q.hidden = []; q.letter = false;
}
function kumAnswer(ok, how, typedVerdict) {
  const K = KUM, q = K.q[K.qi], c = kumCard(q.id); if (!q || q.res) return;
  let good = ok, saved = false;
  if (!good && K.shield) { K.shield = false; good = true; saved = true; }
  else if (!good && kumHas('second') && !K.usedSecond) { K.usedSecond = true; good = true; saved = 'half'; }
  const now = Date.now(), ms = Math.min(60000, now - q.at);
  if (c && c.srs.due <= now && c.srs.state !== 'new') {   // zaległa fiszka = powtórka (jak w walce z bossem)
    const g = ok ? (how === 'type' && typedVerdict === 'close' ? 2 : 3) : 1;
    S.log.push({ id: uid(), c: c.id, d: c.deckId, t: now, g, n: 0, ms, m: how === 'type' ? 'type' : 'flip', kum: 1, ...(how === 'type' ? { v: typedVerdict } : {}) });
    c.srs = schedule(c.srs, g); touch(c); emit('review', c, g, false);
  } else (S.tlog = S.tlog || []).push({ id: uid(), t: now, d: c?.deckId, ms });
  q.res = { good, ok, saved, how, fast: ms < 5000 };
  if (good && !saved) K.streak++; else if (!good) K.streak = 0;
  save();
  setTimeout(() => { if (KUM !== K || K.phase !== 'answer') return; if (K.qi < K.q.length - 1) { K.qi++; kumAsk(); render(); } else kumScore(); }, 700);
  render();
}
// ---------- liczenie: typ zagrania → wartości fiszek → pieczątki → atuty od lewej
function kumScore() {
  const K = KUM, steps = [], goodQ = K.q.filter(q => q.res.good);
  const type = kumTypeOf(goodQ.map(q => q.id)), money0 = K.money;
  const x = { type, c: 0, m: 0 };
  if (type) { const tv = kumTypeVal(type); x.c = tv.c; x.m = tv.m; steps.push({ ic: '📘', t: `${KUM_TYPES[type].n}${tv.L ? ` (poz. ${tv.L + 1})` : ''}`, v: `${tv.c} × ${tv.m}` }); }
  let glass = false;
  K.q.forEach((q, i) => {
    const c = kumCard(q.id), kd = kumKind(c), st = K.stamps[q.id];
    if (!q.res.good) { steps.push({ ic: '✗', t: stripHtml(cardView(c).label || '').slice(0, 36), v: '0', bad: 1 }); return; }
    let b = K.boss === 'nonew' && kd.k === 'new' ? 0 : kd.base;
    if (kumHas('risk') && (kd.k === 'new' || kd.k === 'hard')) b *= 2;
    if (kumHas('elder') && kd.k === 'mature') b *= 2;
    if (q.res.how === 'type') b *= kumHas('writer') ? 2 : 1.5;
    if (kumHas('quick') && q.res.fast) b += 15;
    if (st === 'stone') b += 50;
    if (q.res.saved === 'half') b /= 2;
    if (kumHas('echo') && i === 0) b *= 2;
    b = Math.round(b); x.c += b;
    steps.push({ ic: st ? KUM_STAMPS[st].ic : '✓', t: stripHtml(cardView(c).label || '').slice(0, 36), v: '+' + b });
    if (st === 'gold') { K.money += 3; steps.push({ ic: '🟨', t: 'Złota pieczątka', v: '+3 🪙' }); }
    if (st === 'glass') { glass = true; if (Math.random() < .25) { delete K.stamps[q.id]; steps.push({ ic: '💥', t: 'Szklana pieczątka pękła', v: '' }); } }
  });
  if (type) {
    if (glass) { x.m *= 2; steps.push({ ic: '🔷', t: 'Szklana pieczątka', v: '×2' }); }
    K.jokers.forEach((j, idx) => { const J = KUM_J[j.id]; if (!J.f) return; if (K.boss === 'mute' && idx === 0) return steps.push({ ic: '🔇', t: J.n + ' – wyciszony', v: '' }); const r = J.f(x, K, j); if (r) steps.push({ ic: J.ic, t: J.n, v: r }); });
  }
  const mult = Math.round(x.m * 10) / 10, pts = type ? Math.round(x.c * mult) : 0;
  K.score += pts; K.total += pts; K.best = Math.max(K.best, pts); K.plays--;
  K.last = { chips: x.c, mult, pts, steps, good: goodQ.length, n: K.q.length, type, coins: K.money - money0 };
  K.hand = K.hand.filter(id => !K.sel.includes(id)); K.sel = []; kumDraw();
  K.phase = 'scored'; render();
}
function kumAfterPlay() {
  const K = KUM, target = kumTarget(K.round);
  if (K.score >= target) {
    const earn = 3 + K.plays + (kumHas('miser') ? K.disc : 0), interest = Math.min(kumHas('banker') ? 10 : 5, Math.floor(K.money / 5)), bossBonus = K.boss ? 3 : 0;
    K.money += earn + interest + bossBonus; K.won = { earn, interest, bossBonus };
    K.jokers.forEach(j => { if (j.id === 'grow') j.v = (j.v || 0) + 1; });
    if (K.round === KUM_TARGETS.length && !K.endless) { K.phase = 'victory'; return render(); }
    K.phase = 'shop'; K.shop = kumShopRoll(); K.rerolls = 0; return render();
  }
  if (K.plays <= 0) return kumEnd(false);
  K.phase = 'pick'; render();
}
// ---------- sklep
function kumRollJoker(except) {
  const roll = Math.random() * 100, r = roll < KUM_RAR.l.w ? 'l' : roll < KUM_RAR.l.w + KUM_RAR.r.w ? 'r' : 'c';
  let opts = Object.keys(KUM_J).filter(k => KUM_J[k].r === r && !except.has(k)); if (!opts.length) opts = Object.keys(KUM_J).filter(k => !except.has(k));
  return shuffle(opts)[0];
}
function kumShopRoll() {
  const K = KUM, taken = new Set(K.jokers.map(j => j.id)), js = [];
  for (let i = 0; i < 3; i++) { const k = kumRollJoker(new Set([...taken, ...js])); if (k) js.push(k); }
  const books = shuffle(Object.keys(KUM_I).filter(k => k.startsWith('bk_'))).slice(0, 1);
  const rest = shuffle(Object.keys(KUM_I).filter(k => !k.startsWith('bk_'))).slice(0, 2);
  return [...js.map(k => ({ t: 'j', k })), ...[...books, ...rest].map(k => ({ t: 'i', k }))];
}
function kumEnd(win) {
  const K = KUM, rounds = win ? K.round : K.round - 1;
  const gold = Math.min(600, rounds * 25 + (rounds >= KUM_TARGETS.length ? 150 : 0)), xp = Math.min(300, rounds * 15 + (rounds >= KUM_TARGETS.length ? 60 : 0));
  if (gold) S.wallet.push({ id: 'kum-' + uid(), n: gold, why: 'boss-kum', t: Date.now() });
  if (xp && typeof giveXP === 'function') giveXP(xp, 'kum');
  const st = S.stats.kum = S.stats.kum || { runs: 0, best: 0, bestPts: 0, wins: 0 };
  st.runs++; if (rounds >= KUM_TARGETS.length) st.wins++; st.best = Math.max(st.best, rounds); st.bestPts = Math.max(st.bestPts, K.total); st.bestPlay = Math.max(st.bestPlay || 0, K.best);
  save(); K.phase = 'end'; K.result = { win: rounds >= KUM_TARGETS.length, rounds, gold, xp }; render();
}

// ---------- widoki
function kumHead() {
  const K = KUM, t = kumTarget(K.round), B = K.boss && KUM_BOSSES[K.boss];
  return `<div class="kum-top"><button class="iconbtn" data-act="kum-quit" aria-label="Zakończ bieg">✕</button>
    <div class="grow"><b>Runda ${K.round}${K.round <= KUM_TARGETS.length ? '/' + KUM_TARGETS.length : ' · bez końca'}</b><div class="kum-prog"><i style="width:${Math.min(100, K.score / t * 100)}%"></i></div><small>${K.score.toLocaleString('pl')} / ${t.toLocaleString('pl')} pkt</small></div>
    <div class="kum-stats"><span title="Zagrania">▶ ${K.plays}</span><span title="Wymiany">🔄 ${K.disc}</span><span title="Monety">🪙 ${K.money}</span></div></div>
  ${B && !['shop', 'victory', 'end'].includes(K.phase) ? `<div class="kum-boss">${kumIcon(B.ic)}<div><b>Egzaminator: ${B.n}</b><small>${B.d}</small></div></div>` : ''}
  <div class="kum-jokers">${K.jokers.map((j, i) => { const J = KUM_J[j.id]; return `<button class="kum-j r-${J.r}${K.boss === 'mute' && i === 0 && K.phase !== 'shop' ? ' muted' : ''}" data-act="kum-info" data-k="${j.id}" title="${esc(J.n)}">${kumIcon(J.ic)}${J.grows && j.v ? `<i class="kum-jv">${j.id === 'grow' ? '+' + j.v : j.v}</i>` : ''}</button>`; }).join('')}${Array(Math.max(0, K.slots - K.jokers.length)).fill('<span class="kum-j empty"></span>').join('')}
    <span class="kum-sep"></span>${K.items.map((k, i) => `<button class="kum-j item" data-act="kum-use" data-i="${i}" title="${esc(KUM_I[k].n)} – użyj">${kumIcon(KUM_I[k].ic)}</button>`).join('')}${Array(Math.max(0, KUM_ITEM_SLOTS - K.items.length)).fill('<span class="kum-j empty item"></span>').join('')}</div>`;
}
function kumCardHTML(id, sel) {
  const c = kumCard(id), v = c && cardView(c), kd = kumKind(c), d = c && deckById(c.deckId), st = KUM.stamps[id];
  return `<button class="kum-card${sel ? ' on' : ''} k-${kd.k}${st ? ' st-' + st : ''}" data-act="kum-sel" data-id="${id}"><span class="kum-val">${KUM.boss === 'nonew' && kd.k === 'new' ? 0 : kd.base}</span>${st ? `<span class="kum-stamp" title="Pieczątka ${KUM_STAMPS[st].n}">${KUM_STAMPS[st].ic}</span>` : ''}<span class="kum-q">${esc(stripHtml(v?.label || '').slice(0, 90))}</span><small>${esc((d?.name || '').replace(/^🏫\s*/, '').slice(0, 22))}${kd.t ? ' · ' + kd.t : ''}</small></button>`;
}
function kumIntroHTML() {
  const st = S.stats.kum || {}, decks = S.decks.filter(d => S.cards.some(c => c.deckId === d.id && !c.sus)), kit = KUM_KIT_SEL;
  return `<div class="row nowrap"><button class="iconbtn" data-go="#/boss">‹</button><h1 class="grow" style="margin:0">🃏 Kumulacja</h1><span class="tag">admin</span></div>
  <div class="card kum-intro"><p style="margin-top:0"><b>8 rund z rosnącym progiem.</b> Wybierz 1–3 fiszki z ręki, odpowiedz i zbieraj <b>(podstawa + wartości fiszek) × mnożnik</b>.</p>
    <details class="small"><summary><b>Zasady w skrócie</b></summary><ul>
      <li><b>Typ zagrania</b> daje podstawę i mnożnik: Pojedyncza, Dwójka, Trójka, Jedna talia (2–3 z tej samej), Przekrój (3 różne talie), Ciężka trójka (3 nowe/trudne). Liczą się tylko dobrze odpowiedziane fiszki.</li>
      <li>Fiszki mają wartość: trudna 25, nowa 20, zwykła 15, utrwalona 10. Wpisanie zamiast ABCD: ×1,5.</li>
      <li><b>Atuty</b> liczą się po kolei od lewej – ustaw kolejność w sklepie (najpierw „+”, potem „×”). Niektóre rosną w trakcie biegu.</li>
      <li><b>Podręczniki</b> podnoszą poziom typu zagrania, <b>pieczątki</b> zostają na fiszce do końca biegu.</li>
      <li>Rundy 3, 6 i 8 prowadzi <b>Egzaminator</b> z utrudnieniem (+3 monety za wygraną).</li>
      <li>Zaległe fiszki liczą się jak powtórki.</li></ul></details>
    <label class="small muted">Z jakich fiszek?</label>
    <select id="kum-deck"><option value="all">Wszystkie talie</option>${decks.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select>
    <p class="small muted" style="margin:12px 0 6px">Plecak na start:</p>
    <div class="kum-kits">${Object.entries(KUM_KITS).map(([k, K]) => `<button class="kum-kit${kit === k ? ' on' : ''}" data-act="kum-kit" data-k="${k}">${kumIcon(K.ic)}<b>${K.n}</b><small>${K.d}</small></button>`).join('')}</div>
    <div class="spacer"></div><button class="primary block" data-act="kum-start" style="min-height:52px">▶ Zacznij bieg</button>
    ${st.runs ? `<p class="small muted center" style="margin:10px 0 0">Biegi: ${st.runs} · wygrane: ${st.wins || 0} · rekord: runda ${st.best} · ${(st.bestPts || 0).toLocaleString('pl')} pkt · najlepsze zagranie ${(st.bestPlay || 0).toLocaleString('pl')}</p>` : ''}</div>`;
}
let KUM_KIT_SEL = 'classic';
function kumPickHTML() {
  const K = KUM, t = kumTypeOf(K.sel), tv = t && kumTypeVal(t);
  return `${kumHead()}
  <div class="kum-preview">${t ? `<b>${KUM_TYPES[t].n}${tv.L ? ` · poz. ${tv.L + 1}` : ''}</b><span class="kum-chips sm">${tv.c}</span>×<span class="kum-mult sm">${tv.m}</span>` : `<span class="muted">Wybierz 1–${kumMaxPlay()} fiszki · wartość w rogu</span>`}</div>
  <div class="kum-hand">${K.hand.map(id => kumCardHTML(id, K.sel.includes(id))).join('')}</div>
  <div class="kum-actions"><button class="primary grow" data-act="kum-play" ${K.sel.length ? '' : 'disabled'}>▶ Zagraj (${K.sel.length})</button>
    <button class="grow" data-act="kum-disc" ${K.sel.length && K.disc > 0 ? '' : 'disabled'}>🔄 Wymień (${K.disc})${K.boss === 'discpay' ? ' · 1 🪙' : ''}</button></div>
  <details class="kum-levels small"><summary>📘 Poziomy typów zagrań</summary>${Object.entries(KUM_TYPES).map(([k, T]) => { const v = kumTypeVal(k); return `<div class="row nowrap"><span class="grow">${T.n}${v.L ? ` <b>poz. ${v.L + 1}</b>` : ''}</span><span>${v.c} × ${v.m}</span></div>`; }).join('')}</details>`;
}
function kumAnswerHTML() {
  const K = KUM, q = K.q[K.qi], c = kumCard(q.id), v = cardView(c), ans = v.ans;
  const opts = q.opts ? q.opts.map((o, i) => q.hidden.includes(i) ? '' : `<button class="abcd${q.res ? (norm(o) === norm(ans) ? ' right' : q.pick === i ? ' wrong' : '') : ''}" data-act="kum-opt" data-i="${i}" ${q.res ? 'disabled' : ''}><b>${'ABCD'[i]}</b> ${esc(o)}</button>`).join('') : '';
  return `${kumHead()}<div class="kum-qn">Fiszka ${K.qi + 1}/${K.q.length}${K.streak ? ` · 🔥 seria ${K.streak}` : ''}${K.shield ? ' · 🛡️ tarcza' : ''}${K.stamps[q.id] ? ' · ' + KUM_STAMPS[K.stamps[q.id]].ic : ''}</div>
  <div class="card flash qfit">${v.q}${q.letter ? `<div class="small muted" style="margin-top:8px">Zaczyna się na: <b>${esc(ans.trim().slice(0, 1).toUpperCase())}…</b></div>` : ''}</div>
  ${q.res ? `<div class="kum-res ${q.res.good ? 'ok' : 'bad'}">${q.res.saved === true ? '🛡️ Tarcza uratowała!' : q.res.saved === 'half' ? '🛟 Druga szansa – połowa wartości' : q.res.good ? '✓ Dobrze' : `✗ Odpowiedź: ${esc(ans)}`}</div>` : ''}
  ${q.mode === 'abcd' && !q.typing ? `<div class="abcd-grid">${opts}</div>${q.res ? '' : '<button class="ghost block" data-act="kum-type">✍️ Wpiszę odpowiedź (×1,5 wartości)</button>'}`
    : q.res ? '' : `<div class="row nowrap"><input id="kum-in" class="grow" placeholder="Wpisz odpowiedź…" autocomplete="off"><button class="primary" data-act="kum-send">✓</button></div>${q.opts ? '<button class="ghost block" data-act="kum-abcd">Wróć do ABCD</button>' : ''}`}`;
}
function kumScoredHTML() {
  const K = KUM, L = K.last, t = kumTarget(K.round);
  return `${kumHead()}<div class="card kum-score">
    <ul class="kum-steps">${L.steps.map((s, i) => `<li class="${s.bad ? 'bad' : ''}" style="animation-delay:${i * 120}ms"><span>${s.ic}</span><span class="grow">${esc(s.t)}</span><b>${esc(s.v)}</b></li>`).join('')}</ul>
    <div class="kum-eq" style="animation-delay:${L.steps.length * 120}ms">${L.type ? `<span class="kum-chips">${L.chips}</span><span class="kum-x">×</span><span class="kum-mult">${String(L.mult).replace('.', ',')}</span><span class="kum-x">=</span><b>${L.pts.toLocaleString('pl')}</b>` : '<b>0</b>'}</div>
    <p class="small muted center" style="margin:4px 0 10px">${L.good}/${L.n} dobrze${L.coins ? ` · +${L.coins} 🪙` : ''}</p>
    <button class="primary block" data-act="kum-next">${K.score >= t ? '🏁 Runda wygrana – dalej' : K.plays > 0 ? '▶ Następne zagranie' : 'Koniec zagrań…'}</button></div>`;
}
function kumShopHTML() {
  const K = KUM, rc = 2 + K.rerolls;
  return `${kumHead()}<div class="card kum-won"><b>🏁 Runda ${K.round} wygrana!</b> <span class="small muted">+${K.won.earn} 🪙 · odsetki +${K.won.interest}${K.won.bossBonus ? ` · egzaminator +${K.won.bossBonus}` : ''} 🪙</span></div>
  <h2 style="margin:10px 0 6px">🛒 Sklep</h2>
  <div class="kum-shop">${K.shop.map((o, i) => { const D = o.t === 'j' ? KUM_J[o.k] : KUM_I[o.k]; if (o.bought) return '<div class="kum-off sold">Kupione</div>';
    const full = o.t === 'j' ? K.jokers.length >= K.slots : K.items.length >= KUM_ITEM_SLOTS;
    return `<div class="kum-off ${o.t === 'j' ? 'j r-' + D.r : D.book ? 'b' : D.stamp ? 's' : 'i'}">${kumIcon(D.ic)}<b>${esc(D.n)}</b><small>${esc(D.d)}</small><button class="sm primary" data-act="kum-buy" data-i="${i}" ${K.money >= D.p && !full ? '' : 'disabled'}>${full ? 'Brak miejsca' : `Kup · ${D.p} 🪙`}</button><span class="kum-type">${o.t === 'j' ? 'atut ' + KUM_RAR[D.r].n : D.book ? 'podręcznik' : D.stamp ? 'pieczątka' : 'pomoc'}</span></div>`; }).join('')}
    ${!K.slotBought ? `<div class="kum-off i">${kumIcon('🧳')}<b>Większy plecak</b><small>+1 miejsce na atut (raz na bieg)</small><button class="sm primary" data-act="kum-slot" ${K.money >= 8 ? '' : 'disabled'}>Kup · 8 🪙</button><span class="kum-type">ulepszenie</span></div>` : ''}</div>
  ${K.jokers.length ? `<p class="small muted" style="margin:12px 0 4px">Twoje atuty – liczą się od lewej; przesuń ◀ ▶ albo sprzedaj:</p><div class="kum-owned">${K.jokers.map((j, i) => { const J = KUM_J[j.id];
    return `<div class="kum-own r-${J.r}">${kumIcon(J.ic)}<div class="grow"><b>${esc(J.n)}${J.grows && j.v ? ` · ${j.id === 'grow' ? '+' + j.v : j.v}` : ''}</b><small>${esc(J.d)}</small></div>
      <button class="sm ghost" data-act="kum-move" data-i="${i}" data-d="-1" ${i ? '' : 'disabled'} aria-label="W lewo">◀</button><button class="sm ghost" data-act="kum-move" data-i="${i}" data-d="1" ${i < K.jokers.length - 1 ? '' : 'disabled'} aria-label="W prawo">▶</button>
      <button class="sm" data-act="kum-sell" data-i="${i}">Sprzedaj +${kumSell(j)} 🪙</button></div>`; }).join('')}</div>` : ''}
  ${K.items.length ? `<div class="kum-owned" style="margin-top:6px">${K.items.map((k, i) => `<button class="sm ghost" data-act="kum-sellitem" data-i="${i}">${KUM_I[k].ic} ${esc(KUM_I[k].n)} · sprzedaj +1 🪙</button>`).join('')}</div>` : ''}
  <div class="kum-actions"><button class="grow" data-act="kum-reroll" ${K.money >= rc ? '' : 'disabled'}>🎲 Nowa oferta · ${rc} 🪙</button><button class="primary grow" data-act="kum-nextround">▶ Runda ${K.round + 1} · cel ${kumTarget(K.round + 1).toLocaleString('pl')}${KUM_BOSS_ROUNDS.includes(K.round + 1) ? ' · egzaminator' : ''}</button></div>`;
}
function kumVictoryHTML() {
  const K = KUM;
  return `<div class="card center kum-end"><div style="font-size:52px">🏆</div><h2>8 rund zaliczone!</h2><p>Łącznie <b>${K.total.toLocaleString('pl')}</b> pkt · najlepsze zagranie ${K.best.toLocaleString('pl')}</p>
    <p class="small muted">Możesz odebrać nagrodę teraz albo grać dalej w trybie bez końca (progi ×1,6 co rundę, nagroda rośnie).</p>
    <div class="kum-actions"><button class="primary grow" data-act="kum-endless">♾️ Graj dalej</button><button class="grow" data-act="kum-claim">🏆 Odbierz nagrodę</button></div></div>`;
}
function kumEndHTML() {
  const K = KUM, R = K.result;
  return `<div class="card center kum-end"><div style="font-size:52px">${R.win ? '🏆' : '💥'}</div><h2>${R.win ? `Bieg zakończony – ${R.rounds} ${plural(R.rounds, 'runda', 'rundy', 'rund')}` : `Koniec biegu w rundzie ${K.round}`}</h2>
    <p>Łącznie <b>${K.total.toLocaleString('pl')}</b> pkt · najlepsze zagranie ${K.best.toLocaleString('pl')}</p>
    <p class="small">Nagroda: <b>+${R.gold} 🪙 złota</b> · <b>+${R.xp} XP</b></p>
    <div class="kum-actions"><button class="primary grow" data-act="kum-again">▶ Jeszcze raz</button><button class="grow" data-act="kum-quit2">Wyjdź</button></div></div>`;
}
ROUTES.kumul = () => {
  if (!kumAdmin()) return { tab: 'arena', html: '<p class="muted center" style="padding:40px 0">Ten tryb jest jeszcze w testach.</p>' };
  if (!KUM) return { tab: 'arena', html: kumIntroHTML() };
  const K = KUM, html = { pick: kumPickHTML, answer: kumAnswerHTML, scored: kumScoredHTML, shop: kumShopHTML, victory: kumVictoryHTML, end: kumEndHTML }[K.phase]();
  if (K.phase === 'answer') onMount(() => { const i = $('#kum-in'); if (i) { i.focus(); i.onkeydown = e => { if (e.key === 'Enter') ACTIONS['kum-send'](); }; } });
  return { tab: 'arena', focus: true, html: `<div class="kum">${html}</div>` };
};
// wejście w zakładce Przygoda – tylko admin
const kumBoss0 = ROUTES.boss;
ROUTES.boss = (...a) => { const v = kumBoss0(...a); if (!v?.html || !kumAdmin() || (a[0] && a[0][1])) return v;
  return { ...v, html: v.html.replace('<div class="card row nowrap coop-cta"', `<div class="card row nowrap kum-cta" data-go="#/kumul"><span class="kum-cta-ic">🃏</span><div class="grow"><b>Kumulacja <span class="tag">admin</span></b><div class="small muted">8 rund · typy zagrań · atuty, pieczątki, egzaminatorzy${S.stats.kum?.best ? ` · rekord: runda ${S.stats.kum.best}` : ''}</div></div><span>›</span></div><div class="card row nowrap coop-cta"`) }; };

Object.assign(ACTIONS, {
  'kum-kit': el => { KUM_KIT_SEL = el.dataset.k; render(); },
  'kum-start': () => kumStart($('#kum-deck')?.value || 'all', KUM_KIT_SEL),
  'kum-sel': el => { const K = KUM, id = el.dataset.id; if (!K || K.phase !== 'pick') return;
    if (K.pendingStamp) { K.stamps[id] = K.pendingStamp; toast(`${KUM_STAMPS[K.pendingStamp].ic} Pieczątka ${KUM_STAMPS[K.pendingStamp].n} na fiszce`); K.pendingStamp = null; return render(); }
    const i = K.sel.indexOf(id); if (i >= 0) K.sel.splice(i, 1); else if (K.sel.length < kumMaxPlay()) K.sel.push(id); else return toast(`Maksymalnie ${kumMaxPlay()} fiszki na zagranie`); render(); },
  'kum-play': () => kumPlay(),
  'kum-disc': () => { const K = KUM; if (!K.sel.length || K.disc <= 0) return; if (K.boss === 'discpay') { if (K.money < 1) return toast('Wymiana kosztuje 1 monetę'); K.money--; }
    K.hand = K.hand.filter(id => !K.sel.includes(id)); K.sel = []; K.disc--; kumDraw(); render(); },
  'kum-opt': el => { const K = KUM, q = K?.q?.[K.qi]; if (!q || q.res) return; const i = +el.dataset.i; q.pick = i; kumAnswer(norm(q.opts[i]) === norm(cardView(kumCard(q.id)).ans), 'abcd'); },
  'kum-type': () => { const q = KUM?.q?.[KUM.qi]; if (q) { q.typing = true; q.mode = 'type'; render(); } },
  'kum-abcd': () => { const q = KUM?.q?.[KUM.qi]; if (q?.opts) { q.typing = false; q.mode = 'abcd'; render(); } },
  'kum-send': () => { const K = KUM, q = K?.q?.[K.qi]; if (!q || q.res) return; const t = $('#kum-in')?.value || ''; if (!t.trim()) return;
    const v = checkAnswer(t, cardView(kumCard(q.id)).ans); kumAnswer(v !== 'wrong', 'type', v); },
  'kum-next': () => kumAfterPlay(),
  'kum-buy': el => { const K = KUM, o = K.shop[+el.dataset.i]; if (!o || o.bought) return; const D = o.t === 'j' ? KUM_J[o.k] : KUM_I[o.k]; if (K.money < D.p) return;
    if (o.t === 'j') { if (K.jokers.length >= K.slots) return; K.jokers.push({ id: o.k }); } else { if (K.items.length >= KUM_ITEM_SLOTS) return; K.items.push(o.k); }
    K.money -= D.p; K.spent += D.p; K.jokers.forEach(j => { if (j.id === 'piggy') j.v = (j.v || 0) + D.p; }); o.bought = true; render(); },
  'kum-slot': () => { const K = KUM; if (K.slotBought || K.money < 8) return; K.money -= 8; K.slots++; K.slotBought = true; K.jokers.forEach(j => { if (j.id === 'piggy') j.v = (j.v || 0) + 8; }); render(); },
  'kum-move': el => { const K = KUM, i = +el.dataset.i, j = i + +el.dataset.d; if (j < 0 || j >= K.jokers.length) return; [K.jokers[i], K.jokers[j]] = [K.jokers[j], K.jokers[i]]; render(); },
  'kum-sell': el => { const K = KUM, i = +el.dataset.i, j = K.jokers[i]; if (!j) return; K.money += kumSell(j); K.jokers.splice(i, 1); render(); },
  'kum-sellitem': el => { const K = KUM, i = +el.dataset.i; if (K.items[i] == null) return; K.items.splice(i, 1); K.money += 1; render(); },
  'kum-reroll': () => { const K = KUM, rc = 2 + K.rerolls; if (K.money < rc) return; K.money -= rc; K.rerolls++; K.jokers.forEach(j => { if (j.id === 'piggy') j.v = (j.v || 0) + rc; }); K.shop = kumShopRoll(); render(); },
  'kum-nextround': () => { KUM.round++; kumStartRound(); render(); },
  'kum-endless': () => { const K = KUM; K.endless = true; K.phase = 'shop'; K.shop = kumShopRoll(); K.rerolls = 0; render(); },
  'kum-claim': () => kumEnd(true),
  'kum-use': el => { const K = KUM, i = +el.dataset.i, k = K.items[i]; if (!k) return; const D = KUM_I[k], q = K.phase === 'answer' ? K.q[K.qi] : null;
    if (k === 'half') { if (!q || q.res || !q.opts || q.mode !== 'abcd') return toast('Użyj podczas odpowiedzi ABCD'); const ans = cardView(kumCard(q.id)).ans; q.hidden = shuffle(q.opts.map((o, j) => j).filter(j => norm(q.opts[j]) !== norm(ans))).slice(0, 2); }
    else if (k === 'letter') { if (!q || q.res) return toast('Użyj podczas odpowiedzi'); q.letter = true; }
    else if (k === 'disc') { if (K.phase !== 'pick') return toast('Użyj przy wybieraniu fiszek'); K.disc++; }
    else if (k === 'shield') { if (K.shield) return toast('Tarcza już działa'); K.shield = true; }
    else if (D.book) { K.levels[D.book] = (K.levels[D.book] || 0) + 1; toast(`📘 ${KUM_TYPES[D.book].n} – poziom ${K.levels[D.book] + 1}`); K.items.splice(i, 1); return render(); }
    else if (D.stamp) { if (K.phase !== 'pick') return toast('Użyj przy wybieraniu fiszek – potem stuknij fiszkę'); K.pendingStamp = D.stamp; K.items.splice(i, 1); toast(`${D.ic} Stuknij fiszkę z ręki, na którą przybić pieczątkę`, 3500); return render(); }
    K.items.splice(i, 1); toast(`${D.ic} ${D.n}`); render(); },
  'kum-info': el => { const J = KUM_J[el.dataset.k]; if (J) toast(`${J.ic} ${J.n} (${KUM_RAR[J.r].n}): ${J.d}`, 4500); },
  'kum-quit': () => { if (!KUM) return go('#/boss'); askBox({ icon: '🃏', title: 'Zakończyć bieg?', intro: 'Dostaniesz nagrodę za ukończone rundy.', ok: 'Zakończ', cancel: 'Graj dalej', danger: true }).then(ok => { if (ok && KUM && KUM.phase !== 'end') kumEnd(KUM.round > KUM_TARGETS.length); }); },
  'kum-again': () => { const d = KUM?.deckId || 'all', kit = KUM?.kit || 'classic'; KUM = null; kumStart(d, kit); },
  'kum-quit2': () => { KUM = null; go('#/boss'); },
});

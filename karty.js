'use strict';
/* 🃏 Starcie talii – karciane pojedynki z komputerem (beta: admin + testerzy, cecha 'karty'). Bez znajomych.
   Plansza: 3 linie. Twoje jednostki stoją na dole, rywala na górze. Na koniec tury każda Twoja jednostka uderza w tę z naprzeciwka
   (obie zadają sobie obrażenia), a gdy linia rywala jest pusta – prosto w jego bohatera. Zagrana jednostka atakuje dopiero w następnej
   turze (chyba że jest Szybka). Energia ⚡ rośnie co turę (max 7). Raz na turę możesz odpowiedzieć na pytanie z własnych fiszek: dobrze = +1 ⚡.
   Karty to postacie z gry (posiadane postacie są złote: +1 ⚔️ +1 ❤️) i zaklęcia. Nagrody w 💎 za wygrane (dzienny limit).
   Poziomy rywala: Uczeń → Student → Profesor → Rektor (odblokowujesz wygraną na poprzednim). */
const krOn = () => typeof testOn === 'function' ? testOn('karty') : typeof IS_ADMIN !== 'undefined' && IS_ADMIN === true;
const KR_AB = { swift: ['⚡', 'Szybki', 'atakuje już w turze zagrania'], shield: ['🛡️', 'Tarcza', 'pierwszy cios nic mu nie robi'], thorns: ['🌵', 'Kolce', 'kto go uderzy, dostaje 1 obrażenie'],
  draw: ['📚', 'Notatki', 'po zagraniu dobierasz kartę'], rally: ['📣', 'Okrzyk', 'po zagraniu sąsiedzi +1 ⚔️'], burn: ['🔥', 'Ogień', 'po zagraniu rani wrogiego bohatera'], heal: ['💚', 'Opieka', 'po zagraniu leczy Twojego bohatera'] };
const KR_U = [
  { k: 'cat', n: 'Kot Wojak', c: 1, a: 2, h: 1, ab: 'swift' }, { k: 'hamster', n: 'Chomik Turbo', c: 1, a: 1, h: 2, ab: 'draw' },
  { k: 'frog', n: 'Żabson', c: 2, a: 2, h: 3, ab: 'thorns' }, { k: 'rabbit', n: 'Królik Skoczek', c: 2, a: 3, h: 2, ab: 'swift' },
  { k: 'dog', n: 'Pieseł', c: 3, a: 2, h: 5, ab: 'shield' }, { k: 'owl', n: 'Sowa Sesji', c: 3, a: 3, h: 3, ab: 'draw' },
  { k: 'fox', n: 'Lis Spryciarz', c: 4, a: 4, h: 3, ab: 'burn', v: 2 }, { k: 'beast', n: 'Stworek', c: 4, a: 3, h: 5, ab: 'rally' },
  { k: 'phoenix', n: 'Feniks', c: 5, a: 4, h: 5, ab: 'heal', v: 4 }, { k: 'dragon', n: 'Smok', c: 6, a: 6, h: 6, ab: 'burn', v: 3 },
];
const KR_S = {
  bolt: { n: 'Błyskawica', ic: '⚡', c: 2, d: '3 obrażenia jednostce rywala (albo bohaterowi, gdy linia pusta)', tgt: 'ai' },
  potion: { n: 'Mikstura', ic: '🧪', c: 1, d: 'leczy Twojego bohatera o 5' },
  notes: { n: 'Ściąga', ic: '📝', c: 1, d: 'dobierz 2 karty' },
  ward: { n: 'Osłona', ic: '🛡️', c: 1, d: 'Twoja jednostka: +2 ❤️ i tarcza', tgt: 'me' },
  comet: { n: 'Kometa', ic: '☄️', c: 5, d: '2 obrażenia każdej jednostce rywala' },
};
const KR_T = [
  { n: 'Uczeń', ic: '📘', hp: 16, ai: 0, gem: 10 }, { n: 'Student', ic: '🎓', hp: 22, ai: 1, gem: 20 },
  { n: 'Profesor', ic: '🧑‍🏫', hp: 28, ai: 2, gem: 35 }, { n: 'Rektor', ic: '👑', hp: 34, ai: 2, gem: 60, gold: true, en: 1 },
];
const KR_HP = 25, KR_EN = 7, KR_HAND = 7, KR_DAILY = 150;
let KR = null, KR_TIER = 0;
const krStats = () => (S.stats.karty = S.stats.karty || { wins: 0, losses: 0, top: 0 });
const krToday = () => { const st = krStats(), d = dayKey(Date.now()); if (st.day !== d) { st.day = d; st.gems = 0; } return st; };
const krImg = (k, f) => `<img class="kr-art" src="assets/pixel/${k}8-${f}.webp" alt="" draggable="false">`;
const krOwns = k => typeof ownsHero === 'function' && ownsHero(k);
function krDeck(gold) {
  const d = [];
  for (const u of KR_U) for (let i = 0; i < 2; i++) d.push({ t: 'u', k: u.k, g: gold === true || (gold === 'own' && krOwns(u.k)) });
  for (const [k, n] of [['bolt', 2], ['potion', 1], ['notes', 2], ['ward', 1], ['comet', 1]]) for (let i = 0; i < n; i++) d.push({ t: 's', k });
  return shuffle(d);
}
const krDef = c => c.t === 'u' ? KR_U.find(u => u.k === c.k) : KR_S[c.k];
const krCost = c => krDef(c).c;
function krUnit(c) { const u = krDef(c), g = c.g ? 1 : 0; return { k: u.k, n: u.n, a: u.a + g, h: u.h + g, max: u.h + g, ab: u.ab, v: u.v || 0, g: !!c.g, fresh: true, shield: u.ab === 'shield', id: uid() }; }
function krSide(hp, gold, en0) { return { hp, max: hp, en: 0, enMax: en0 || 0, hand: [], deck: krDeck(gold), lanes: [null, null, null] }; }
function krDraw(P, n = 1) { for (let i = 0; i < n; i++) { if (!P.deck.length) { P.hp -= 1; continue; } const c = P.deck.pop(); if (P.hand.length < KR_HAND) P.hand.push(c); } }
function krStart(t) {
  const T = KR_T[t];
  KR = { t, me: krSide(KR_HP, 'own'), ai: krSide(T.hp, T.gold, T.en || 0), turn: 'me', sel: null, log: 'Twoja tura – zagraj kartę na swoją linię.', pops: [], fx: null, asked: false, busy: false, res: null, n: 1 };
  krDraw(KR.me, 4); krDraw(KR.ai, 4);
  KR.me.enMax = 1; KR.me.en = 1;
  krStats(); save(); render();
}
const opp = s => s === 'me' ? 'ai' : 'me';
function krPop(side, where, txt, cls = '') { KR.pops.push({ side, where, txt, cls, t: Date.now() }); }
function krHurtHero(side, n) { const P = KR[side]; P.hp = Math.max(0, P.hp - n); krPop(side, 'hero', '−' + n, 'dmg'); }
function krHurtUnit(side, l, n, from) {
  const u = KR[side].lanes[l]; if (!u || n <= 0) return;
  if (u.shield) { u.shield = false; krPop(side, l, '🛡️', 'blk'); return; }
  u.h -= n; krPop(side, l, '−' + n, 'dmg');
  if (from && u.ab === 'thorns') { const a = KR[opp(side)].lanes[from.l]; if (a) { a.h -= 1; krPop(opp(side), from.l, '−1', 'dmg'); } }
}
function krClean() { for (const s of ['me', 'ai']) KR[s].lanes = KR[s].lanes.map(u => u && u.h > 0 ? u : null); }
// zagranie karty (gracz albo komputer); l = linia dla jednostki / cel zaklęcia
function krPlay(side, hi, l) {
  const P = KR[side], E = KR[opp(side)], c = P.hand[hi]; if (!c) return false;
  const cost = krCost(c); if (cost > P.en) return false;
  if (c.t === 'u') {
    if (l == null || P.lanes[l]) return false;
    const u = krUnit(c); P.lanes[l] = u;
    if (u.ab === 'draw') krDraw(P);
    if (u.ab === 'rally') for (const j of [l - 1, l + 1]) if (P.lanes[j]) { P.lanes[j].a += 1; krPop(side, j, '+1 ⚔️', 'buff'); }
    if (u.ab === 'burn') krHurtHero(opp(side), u.v);
    if (u.ab === 'heal') { P.hp = Math.min(P.max, P.hp + u.v); krPop(side, 'hero', '+' + u.v, 'heal'); }
    KR.fx = { k: 'summon', side, l, t: Date.now() };
  } else {
    const s = c.k;
    if (s === 'bolt') { if (l == null) return false; if (E.lanes[l]) krHurtUnit(opp(side), l, 3); else krHurtHero(opp(side), 3); KR.fx = { k: 'bolt', side: opp(side), l, t: Date.now() }; }
    else if (s === 'potion') { P.hp = Math.min(P.max, P.hp + 5); krPop(side, 'hero', '+5', 'heal'); }
    else if (s === 'notes') krDraw(P, 2);
    else if (s === 'ward') { const u = l != null && P.lanes[l]; if (!u) return false; u.h += 2; u.max += 2; u.shield = true; krPop(side, l, '+2 🛡️', 'buff'); }
    else if (s === 'comet') { for (let j = 0; j < 3; j++) krHurtUnit(opp(side), j, 2); KR.fx = { k: 'comet', side: opp(side), t: Date.now() }; }
  }
  P.en -= cost; P.hand.splice(hi, 1); krClean();
  return true;
}
const krSleep = ms => new Promise(r => setTimeout(r, ms));
async function krAttack(side) {
  const P = KR[side], E = KR[opp(side)];
  for (let l = 0; l < 3; l++) {
    const u = P.lanes[l]; if (!u || (u.fresh && u.ab !== 'swift') || u.h <= 0) continue;
    KR.fx = { k: 'atk', side, l, t: Date.now() };
    const d = E.lanes[l];
    if (d) { const back = d.a; krHurtUnit(opp(side), l, u.a, { l }); if (back > 0) krHurtUnit(side, l, back); }   // walka jednoczesna: obrońca oddaje cios
    else krHurtHero(opp(side), u.a);
    krClean(); render(); await krSleep(520);
    if (krCheck()) return true;
  }
  return false;
}
function krCheck() {
  if (KR.res) return true;
  if (KR.ai.hp <= 0 || KR.me.hp <= 0) { krFinish(KR.ai.hp <= 0 && KR.me.hp > 0); return true; }
  return false;
}
function krFinish(win) {
  const T = KR_T[KR.t], st = krToday(); let gems = 0;
  if (win) { st.wins++; st.top = Math.max(st.top || 0, KR.t + 1); gems = Math.max(0, Math.min(T.gem, KR_DAILY - (st.gems || 0))); st.gems = (st.gems || 0) + gems;
    if (gems) S.wallet.push({ id: 'kr-' + uid(), n: gems, why: 'karty', t: Date.now() }); st.streak = (st.streak || 0) + 1; }
  else { st.losses++; st.streak = 0; }
  KR.res = { win, gems, capped: win && gems < T.gem, unlocked: win && KR.t + 1 < KR_T.length && st.top === KR.t + 1 };
  KR.busy = false; save(); render();
  if (win && typeof confetti === 'function') confetti(90);
}
// 🤖 komputer: im wyższy poziom, tym rozsądniej wybiera linie i zaklęcia
function krAiStep() {
  const A = KR.ai, M = KR.me, lvl = KR_T[KR.t].ai;
  const can = A.hand.map((c, i) => ({ c, i, cost: krCost(c) })).filter(x => x.cost <= A.en);
  if (!can.length) return false;
  const pick = (arr, f) => lvl === 0 ? arr[Math.random() * arr.length | 0] : arr.sort(f)[0];
  for (const x of can.filter(x => x.c.t === 's')) {
    const k = x.c.k;
    if (k === 'potion' && A.hp <= A.max - 5 && (lvl === 0 || A.hp <= 14)) return krPlay('ai', x.i);
    if (k === 'notes' && A.hand.length <= 3) return krPlay('ai', x.i);
    if (k === 'comet' && M.lanes.filter(Boolean).length >= (lvl >= 2 ? 2 : 3)) return krPlay('ai', x.i);
    if (k === 'bolt') { const ls = [0, 1, 2].filter(l => M.lanes[l] && (lvl === 0 || M.lanes[l].h <= 3)).sort((a, b) => M.lanes[b].a - M.lanes[a].a);
      if (ls.length) return krPlay('ai', x.i, ls[0]); if (M.hp <= 3) return krPlay('ai', x.i, [0, 1, 2].find(l => !M.lanes[l]) ?? 0); }
    if (k === 'ward') { const ls = [0, 1, 2].filter(l => A.lanes[l]).sort((a, b) => A.lanes[b].a - A.lanes[a].a); if (ls.length && lvl >= 1) return krPlay('ai', x.i, ls[0]); }
  }
  const units = can.filter(x => x.c.t === 'u'), free = [0, 1, 2].filter(l => !A.lanes[l]);
  if (!units.length || !free.length) return false;
  const x = pick(units, (a, b) => b.cost - a.cost);
  const u = krDef(x.c);
  // linia: zablokuj najgroźniejszą jednostkę gracza, którą przeżyjesz; inaczej pusta linia gracza (bicie w bohatera)
  let l = free[Math.random() * free.length | 0];
  if (lvl >= 1) {
    const threat = free.filter(j => M.lanes[j]).sort((a, b) => M.lanes[b].a - M.lanes[a].a);
    const safe = threat.filter(j => M.lanes[j].a < u.h || u.ab === 'shield');
    l = safe[0] ?? (lvl >= 2 ? free.find(j => !M.lanes[j]) : threat[0]) ?? free[0];
  }
  return krPlay('ai', x.i, l);
}
async function krEndTurn() {
  if (!KR || KR.busy || KR.turn !== 'me' || KR.res) return;
  KR.busy = true; KR.sel = null; KR.q = null; KR.log = 'Twoje jednostki atakują…'; render(); await krSleep(250);
  if (await krAttack('me')) return;
  // tura komputera
  const A = KR.ai; KR.turn = 'ai'; A.enMax = Math.min(KR_EN, A.enMax + 1); A.en = A.enMax; krDraw(A); A.lanes.forEach(u => u && (u.fresh = false));
  KR.log = `${KR_T[KR.t].n} myśli…`; render(); await krSleep(600);
  for (let i = 0; i < 8 && krAiStep(); i++) { KR.log = `${KR_T[KR.t].n} zagrywa kartę`; render(); await krSleep(650); if (krCheck()) return; }
  KR.log = `Atakuje ${KR_T[KR.t].n}…`; render(); await krSleep(300);
  if (await krAttack('ai')) return;
  // znów Ty
  const M = KR.me; KR.turn = 'me'; KR.n++; M.enMax = Math.min(KR_EN, M.enMax + 1); M.en = M.enMax; krDraw(M); M.lanes.forEach(u => u && (u.fresh = false));
  KR.asked = false; KR.busy = false; KR.log = `Tura ${KR.n} · masz ${M.en} ⚡`; if (krCheck()) return; render();
}
// 💡 pytanie z Twoich fiszek: dobrze = +1 ⚡ (raz na turę)
function krQuestion() {
  const cards = shuffle(S.cards.filter(c => !c.sus && c.srs.state !== 'new')).slice(0, 60).concat(shuffle(S.cards.filter(c => !c.sus)).slice(0, 60));
  for (const c of cards) {
    const v = cardView(c), q = String(v.q || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!q || q.length > 160 || !v.ans || v.ans.length > 60 || /<img/.test(v.q)) continue;
    const e = distractorEntry(c), pool = S.cards.filter(x => x !== c && x.deckId === c.deckId).slice(0, 300).map(distractorEntry).filter(x => x.a && x.a.length <= 60 && norm(x.a) !== norm(e.a));
    const wrong = pickDistractors(e, pool, 3); if (wrong.length < 3) continue;
    return { q, a: e.a, opts: shuffle([e.a, ...wrong]) };
  }
  return null;
}
// ---------- widok
function krCardHTML(c, i, P) {
  const d = krDef(c), cost = d.c, off = cost > P.en || KR.busy || KR.turn !== 'me', sel = KR.sel === i;
  if (c.t === 'u') { const g = c.g ? 1 : 0, ab = KR_AB[d.ab];
    return `<button class="kc unit${c.g ? ' gold' : ''}${sel ? ' sel' : ''}${off ? ' off' : ''}" data-act="kr-sel" data-i="${i}"><i class="kc-cost">${cost}</i>${krImg(d.k, Math.min(3, Math.floor(cost / 2)))}<b>${esc(d.n)}</b><small>${ab[0]} ${ab[1]}${d.v ? ' ' + d.v : ''}</small><span class="kc-st"><em class="atk">${d.a + g}</em><em class="hp">${d.h + g}</em></span></button>`; }
  return `<button class="kc spell${sel ? ' sel' : ''}${off ? ' off' : ''}" data-act="kr-sel" data-i="${i}"><i class="kc-cost">${cost}</i><span class="kc-ic">${d.ic}</span><b>${esc(d.n)}</b><small>${esc(d.d)}</small></button>`;
}
function krSlotHTML(side, l) {
  const u = KR[side].lanes[l], fx = KR.fx, now = Date.now(), fresh = fx && now - fx.t < 700 && fx.side === side && (fx.l === l || fx.k === 'comet');
  const sel = KR.sel != null ? KR.me.hand[KR.sel] : null, sd = sel && krDef(sel);
  const target = sel && !KR.busy && ((sel.t === 'u' && side === 'me' && !u) || (sd.tgt === 'ai' && side === 'ai') || (sd.tgt === 'me' && side === 'me' && u));
  const pops = KR.pops.filter(p => p.side === side && p.where === l && now - p.t < 900).map(p => `<i class="kr-pop ${p.cls}" style="animation-delay:${-(now - p.t)}ms">${p.txt}</i>`).join('');
  const cls = fresh ? ` fx-${fx.k}` : '';
  if (!u) return `<div class="kr-slot empty${target ? ' tgt' : ''}${cls}" data-act="kr-slot" data-side="${side}" data-l="${l}">${pops}${target ? '<span>tu</span>' : ''}</div>`;
  const ab = KR_AB[u.ab], dmg = u.h < u.max;
  return `<div class="kr-slot${target ? ' tgt' : ''}${u.g ? ' gold' : ''}${u.fresh && u.ab !== 'swift' ? ' sleep' : ''}${cls}" data-act="kr-slot" data-side="${side}" data-l="${l}">
    ${krImg(u.k, Math.min(3, Math.floor(KR_U.find(x => x.k === u.k).c / 2)))}${u.ab === 'shield' ? '' : `<small class="kr-ab" title="${ab[1]}: ${ab[2]}">${ab[0]}</small>`}${u.shield ? '<i class="kr-sh">🛡️</i>' : ''}
    <span class="kc-st"><em class="atk">${u.a}</em><em class="hp${dmg ? ' low' : ''}">${u.h}</em></span>${pops}</div>`;
}
function krHeroHTML(side) {
  const P = KR[side], T = KR_T[KR.t], now = Date.now(), me = side === 'me';
  const pops = KR.pops.filter(p => p.side === side && p.where === 'hero' && now - p.t < 900).map(p => `<i class="kr-pop ${p.cls}" style="animation-delay:${-(now - p.t)}ms">${p.txt}</i>`).join('');
  const port = me ? krImg(heroLine(), Math.min(3, typeof heroForm === 'function' ? heroForm(hero(), hero().pr || 0) : 1)) : `<span class="kr-foe">${T.ic}</span>`;
  return `<div class="kr-hero ${side}${KR.turn === side && !KR.res ? ' turn' : ''}"><span class="kr-port">${port}</span><div class="grow"><b>${me ? 'Ty' : T.n}</b>
      <div class="kr-hp"><i style="width:${Math.max(0, 100 * P.hp / P.max)}%"></i><span>❤️ ${P.hp}/${P.max}</span></div></div>
    <div class="kr-en"><b>${P.en}</b><small>/${P.enMax} ⚡</small></div>${me ? '' : `<div class="kr-cnt" title="karty w ręce">🂠 ${P.hand.length}</div>`}${pops}</div>`;
}
function krBoardHTML() {
  const M = KR.me, sel = KR.sel != null ? M.hand[KR.sel] : null, sd = sel && krDef(sel);
  const hint = sel ? (sel.t === 'u' ? 'Stuknij pustą linię na dole' : sd.tgt === 'ai' ? 'Stuknij linię rywala (pusta = bohater)' : sd.tgt === 'me' ? 'Stuknij swoją jednostkę' : 'Stuknij kartę jeszcze raz, żeby rzucić') : KR.log;
  const q = KR.q;
  return `<div class="kr${KR.busy ? ' busy' : ''}" id="kr-root">
    <div class="kr-top"><button class="kr-x" data-act="kr-quit" aria-label="Wyjdź">✕</button>${krHeroHTML('ai')}</div>
    <div class="kr-lanes ai">${[0, 1, 2].map(l => krSlotHTML('ai', l)).join('')}</div>
    <div class="kr-mid"><span>${hint}</span></div>
    <div class="kr-lanes me">${[0, 1, 2].map(l => krSlotHTML('me', l)).join('')}</div>
    ${krHeroHTML('me')}
    <div class="kr-hand">${M.hand.map((c, i) => krCardHTML(c, i, M)).join('') || '<p class="small muted">Brak kart w ręce</p>'}</div>
    <div class="kr-act"><button class="kr-q" data-act="kr-q" ${KR.asked || KR.busy || KR.turn !== 'me' ? 'disabled' : ''}>💡 Pytanie <small>+1 ⚡</small></button><button class="kr-end" data-act="kr-end" ${KR.busy || KR.turn !== 'me' ? 'disabled' : ''}>Koniec tury ▶</button></div>
    ${q ? `<div class="kr-qov"><div class="kr-qbox"><small>💡 Pytanie z Twoich fiszek</small><p>${esc(q.q)}</p>${q.done != null ? `<p class="kr-qres ${q.done ? 'ok' : 'bad'}">${q.done ? '✓ Dobrze! +1 ⚡' : '✗ Poprawnie: ' + esc(q.a)}</p><button class="kr-end" data-act="kr-qclose">Dalej</button>`
      : q.opts.map((o, i) => `<button class="kr-opt" data-act="kr-ans" data-i="${i}">${esc(o)}</button>`).join('')}</div></div>` : ''}
    ${KR.res ? krEndHTML() : ''}</div>`;
}
function krEndHTML() {
  const R = KR.res, T = KR_T[KR.t], nx = KR_T[KR.t + 1];
  return `<div class="kr-qov end"><div class="kr-qbox"><span class="kr-big">${R.win ? '🏆' : '💀'}</span><h2>${R.win ? 'Wygrana!' : 'Przegrana'}</h2>
    <p>${R.win ? (R.gems ? `+${R.gems} 💎` : 'Dzienny limit kryształów z kart wyczerpany – grasz o rekord.') : `${T.n} był lepszy tym razem.`}${R.unlocked && nx ? `<br><b>Odblokowany rywal: ${nx.ic} ${nx.n}</b>` : ''}</p>
    <button class="kr-end" data-act="kr-again">${R.win && R.unlocked && nx ? `Graj z: ${nx.n}` : 'Jeszcze raz'}</button><button class="kr-q" data-act="kr-quit2">Wyjdź</button></div></div>`;
}
function krIntroHTML() {
  const st = krToday(), top = st.top || 0;
  return `<div class="row nowrap"><button class="iconbtn" data-go="#/boss">‹</button><h1 class="grow" style="margin:0">Starcie talii</h1><span class="tag">${IS_ADMIN ? 'admin · beta' : 'beta'}</span></div>
  <div class="kr-intro"><div class="kr-hero-art">${['cat', 'fox', 'dragon'].map((k, i) => `<span class="kc unit demo d${i}"><i class="kc-cost">${KR_U.find(u => u.k === k).c}</i>${krImg(k, 2)}</span>`).join('')}</div>
    <p>Pojedynek kart z komputerem – <b>bez znajomych</b>. Twoja talia to postacie z gry (te, które masz, są <b>złote: +1 ⚔️ +1 ❤️</b>) i zaklęcia. Wygrane dają <b>💎 kryształy</b>.</p>
    <details class="kr-rules"${st.wins + st.losses ? '' : ' open'}><summary><b>📖 Jak grać</b></summary><ul>
      <li>Plansza ma <b>3 linie</b>. Zagraj jednostkę na swoją linię (na dole), płacąc energią ⚡. Energia rośnie co turę, do 7.</li>
      <li>Na <b>koniec tury</b> każda Twoja jednostka uderza w tę naprzeciwko – obie zadają sobie obrażenia. Gdy linia rywala jest pusta, cios trafia w jego bohatera.</li>
      <li>Świeżo zagrana jednostka 💤 atakuje dopiero w następnej turze – chyba że jest ⚡ Szybka.</li>
      <li>Zdolności: ${Object.values(KR_AB).map(a => `${a[0]} <b>${a[1]}</b> – ${a[2]}`).join('; ')}.</li>
      <li><b>💡 Pytanie</b> (raz na turę): odpowiedz dobrze na fiszkę ze swoich talii, a dostaniesz +1 ⚡.</li>
      <li>Zbij bohatera rywala do 0 ❤️, zanim on zbije Twojego (masz ${KR_HP} ❤️).</li></ul></details>
    <h3 class="kr-h">Wybierz rywala</h3>
    <div class="kr-tiers">${KR_T.map((T, i) => { const lock = i > top; return `<button class="kr-tier${KR_TIER === i ? ' on' : ''}${lock ? ' lock' : ''}" data-act="kr-tier" data-t="${i}" ${lock ? 'disabled' : ''}><span>${lock ? '🔒' : T.ic}</span><b>${T.n}</b><small>❤️ ${T.hp} · +${T.gem} 💎</small></button>`; }).join('')}</div>
    <button class="kr-end big" data-act="kr-start">▶ Graj z: ${KR_T[KR_TIER].ic} ${KR_T[KR_TIER].n}</button>
    <p class="small muted center">Wygrane: ${st.wins} · przegrane: ${st.losses}${st.streak > 1 ? ` · seria: ${st.streak}` : ''} · 💎 z kart dziś: ${st.gems || 0}/${KR_DAILY}</p></div>`;
}
ROUTES.karty = () => {
  if (!krOn()) return { tab: 'arena', html: '<p class="muted center" style="padding:40px 0">Ten tryb jest jeszcze w testach.</p>' };
  if (!KR) return { tab: 'arena', html: krIntroHTML() };
  if (KR.pops.length) { const now = Date.now(); KR.pops = KR.pops.filter(p => now - p.t < 900); if (KR.pops.length) setTimeout(() => { if (KR && parseRoute().parts[0] === 'karty' && !KR.busy) render(); }, 950); }
  return { tab: 'arena', focus: true, html: krBoardHTML() };
};
// wejście w Przygodzie (kafelek w „Więcej trybów”)
const krBoss0 = ROUTES.boss;
ROUTES.boss = (...a) => { const v = krBoss0(...a); if (!v?.html || v.focus || !krOn() || (a[0] && a[0][1])) return v;
  return { ...v, html: v.html.replace('<div class="card row nowrap coop-cta"', `<div class="card row nowrap kart-cta" data-go="#/karty"><span class="kr-cta-ic">🎴</span><div class="grow"><b>Starcie talii <span class="tag">beta</span></b><div class="small muted">Pojedynki kart z komputerem · 💎</div></div><span>›</span></div><div class="card row nowrap coop-cta"`) }; };
if (typeof ADV_TILES !== 'undefined') ADV_TILES = ADV_TILES + ', .kart-cta';
Object.assign(ACTIONS, {
  'kr-tier': el => { KR_TIER = +el.dataset.t; render(); },
  'kr-start': () => krStart(KR_TIER),
  'kr-sel': el => {
    if (!KR || KR.busy || KR.turn !== 'me') return; const i = +el.dataset.i, c = KR.me.hand[i]; if (!c) return;
    if (krCost(c) > KR.me.en) { toast(`Za mało energii ⚡ (masz ${KR.me.en})`); return; }
    const d = krDef(c);
    if (KR.sel === i && c.t === 's' && !d.tgt) { krPlay('me', i); KR.sel = null; if (!krCheck()) render(); return; }
    KR.sel = KR.sel === i ? null : i; render();
  },
  'kr-slot': el => {
    if (!KR || KR.busy || KR.turn !== 'me') return; const side = el.dataset.side, l = +el.dataset.l;
    if (KR.sel == null) { const u = KR[side].lanes[l]; if (u) { const a = KR_AB[u.ab]; toast(`${u.n}: ⚔️ ${u.a} · ❤️ ${u.h} · ${a[0]} ${a[1]} – ${a[2]}${u.fresh && u.ab !== 'swift' ? ' · 💤 zaatakuje w następnej turze' : ''}`, 3500); } return; }
    const c = KR.me.hand[KR.sel], d = krDef(c);
    const ok = (c.t === 'u' && side === 'me') || (d.tgt === 'ai' && side === 'ai') || (d.tgt === 'me' && side === 'me');
    if (!ok || !krPlay('me', KR.sel, l)) return;
    KR.sel = null; if (!krCheck()) render();
  },
  'kr-end': () => krEndTurn(),
  'kr-q': () => { if (!KR || KR.asked || KR.busy || KR.turn !== 'me') return; const q = krQuestion(); if (!q) return toast('Za mało fiszek z krótką odpowiedzią na pytanie'); KR.asked = true; KR.q = q; KR.sel = null; render(); },
  'kr-ans': el => { const q = KR?.q; if (!q || q.done != null) return; q.done = q.opts[+el.dataset.i] === q.a; if (q.done) { KR.me.en += 1; krPop('me', 'hero', '+1 ⚡', 'buff'); } render(); },
  'kr-qclose': () => { if (KR) { KR.q = null; render(); } },
  'kr-again': () => { const t = KR?.res?.win && KR.res.unlocked ? Math.min(KR_T.length - 1, KR.t + 1) : KR?.t || 0; KR_TIER = t; krStart(t); },
  'kr-quit': async () => { if (!KR) return go('#/boss'); if (KR.res) { KR = null; return render(); }
    if (!await askBox({ icon: '🎴', title: 'Poddać pojedynek?', intro: 'Wyjście liczy się jako przegrana.', ok: 'Poddaję', cancel: 'Gram dalej' })) return; KR.me.hp = 0; krFinish(false); },
  'kr-quit2': () => { KR = null; render(); },
});

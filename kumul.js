'use strict';
/* 🃏 Kumulacja – tryb gry na fiszkach (tylko konto admina): bieg przez 8 rund z rosnącym progiem punktów.
   Runda: ręka 5 fiszek, wybierasz 1–3 i odpowiadasz (ABCD albo wpisywanie). Punkty zagrania = podstawa × mnożnik.
   Między rundami sklep: atuty (stałe ulepszenia na bieg) i pomoce (jednorazowe). Odpowiedzi na zaległe fiszki liczą się
   jak powtórki (jak w walce z bossem). Monety są tylko w biegu; na koniec złoto i XP zależne od wyniku. */
const kumAdmin = () => typeof IS_ADMIN !== 'undefined' && IS_ADMIN === true;
const KUM_TARGETS = [300, 500, 800, 1200, 1800, 2700, 4000, 6000];
const KUM_RULES = { 4: { t: 'Runda bez wymian', noDisc: true }, 8: { t: 'Finał: tylko 2 zagrania', plays: 2 } };
const KUM_HAND = 5, KUM_MAX_PLAY = 3, KUM_SLOTS = 5, KUM_ITEM_SLOTS = 2;
// atuty – stałe ulepszenia na cały bieg
const KUM_J = {
  risk:   { ic: '🎲', n: 'Ryzykant', d: 'Nowe i trudne fiszki dają ×3 podstawy', p: 6 },
  roll:   { ic: '🔥', n: 'Rozpęd', d: '+1 mnożnik za każdą dobrą odpowiedź z rzędu (błąd zeruje)', p: 7 },
  second: { ic: '🛟', n: 'Druga szansa', d: 'Pierwszy błąd w rundzie liczy się jak dobra odpowiedź (połowa punktów)', p: 5 },
  spec:   { ic: '🎯', n: 'Specjalista', d: 'Zagranie z jednej talii: +3 mnożnik', p: 5 },
  writer: { ic: '✍️', n: 'Pisarz', d: 'Wpisane odpowiedzi ×2 podstawy (zamiast ×1,5)', p: 6 },
  miser:  { ic: '🪙', n: 'Skąpiec', d: '+1 moneta za każdą niewykorzystaną wymianę', p: 4 },
  banker: { ic: '🏦', n: 'Bankier', d: 'Odsetki do 10 monet zamiast 5', p: 5 },
  full:   { ic: '🖐️', n: 'Pełna ręka', d: 'Zagranie 3 fiszek: +4 mnożnik', p: 6 },
  sniper: { ic: '🏹', n: 'Snajper', d: 'Zagranie 1 fiszki: ×4 mnożnik', p: 6 },
  hoard:  { ic: '💎', n: 'Kolekcjoner', d: '+5 podstawy do każdej fiszki za każdy posiadany atut', p: 7 },
  mine:   { ic: '⛏️', n: 'Kopalnia', d: '+2 monety po każdej wygranej rundzie', p: 4 },
  quick:  { ic: '⚡', n: 'Szybkie palce', d: 'Dobra odpowiedź w mniej niż 5 s: +15 podstawy', p: 5 },
  elder:  { ic: '🐘', n: 'Pamięć słonia', d: 'Fiszki dobrze utrwalone (powtórka co ≥ 7 dni) ×2 podstawy', p: 5 },
  swap:   { ic: '🔄', n: 'Wymiennik', d: '+2 wymiany na rundę', p: 4 },
  extra:  { ic: '➕', n: 'Dodatkowe zagranie', d: '+1 zagranie na rundę', p: 7 },
  gold:   { ic: '👑', n: 'Złota rączka', d: 'Każde zagranie ×1,5', p: 9 },
};
// pomoce – jednorazowe
const KUM_I = {
  half:   { ic: '✂️', n: '50/50', d: 'Usuwa 2 złe odpowiedzi z bieżącej fiszki', p: 2 },
  letter: { ic: '🔤', n: 'Pierwsza litera', d: 'Pokazuje początek odpowiedzi', p: 2 },
  disc:   { ic: '🃏', n: 'Dodatkowa wymiana', d: '+1 wymiana w tej rundzie', p: 2 },
  shield: { ic: '🛡️', n: 'Tarcza', d: 'Następny błąd liczy się jak dobra odpowiedź', p: 3 },
};
let KUM = null;
const kumHas = id => !!KUM?.jokers.includes(id);
const kumIcon = s => `<span class="kum-ic">${s}</span>`;

// ---------- pula fiszek: zaległe najpierw, potem reszta (bez wyłączonych, z odpowiedzią nadającą się do ABCD)
function kumPool(deckId) {
  const ok = c => !c.sus && (deckId === 'all' || c.deckId === deckId) && (() => { const a = cardView(c).ans; return a && a.trim() && a.length <= 200; })();
  const cs = S.cards.filter(ok), now = Date.now();
  const due = shuffle(cs.filter(c => c.srs.state !== 'new' && c.srs.due <= now)), rest = shuffle(cs.filter(c => !(c.srs.state !== 'new' && c.srs.due <= now)));
  return [...due, ...rest].map(c => c.id);
}
const kumCard = id => S.cards.find(c => c.id === id);
function kumKind(c) {   // trudność fiszki → podstawa punktów
  if (!c) return { k: 'mid', base: 10, t: '' };
  if (c.srs.state === 'new') return { k: 'new', base: 20, t: 'nowa' };
  if (isLearning(c) || (c.srs.lapses || 0) >= 2) return { k: 'hard', base: 25, t: 'trudna' };
  if ((c.srs.ivl || 0) >= 7) return { k: 'mature', base: 10, t: 'utrwalona' };
  return { k: 'mid', base: 15, t: '' };
}
function kumDraw() {
  const K = KUM; while (K.hand.length < KUM_HAND) { if (!K.deck.length) K.deck = shuffle(K.all.filter(id => !K.hand.includes(id))); const id = K.deck.shift(); if (id == null) break; if (!K.hand.includes(id)) K.hand.push(id); }
}
function kumStartRound() {
  const K = KUM, r = KUM_RULES[K.round] || {};
  K.score = 0; K.plays = (r.plays || 3) + (kumHas('extra') ? 1 : 0); K.disc = r.noDisc ? 0 : 3 + (kumHas('swap') ? 2 : 0);
  K.usedSecond = false; K.sel = []; K.phase = 'pick'; K.hand = []; kumDraw();
}
function kumStart(deckId) {
  const all = kumPool(deckId);
  if (all.length < 12) return toast('Za mało fiszek – potrzeba min. 12 (z krótką odpowiedzią)', 4000);
  KUM = { deckId, all, deck: all.slice(), hand: [], round: 1, money: 4, jokers: [], items: [], streak: 0, total: 0, best: 0, shield: false, phase: 'pick', log: [] };
  kumStartRound(); render();
}
// ---------- odpowiadanie na wybrane fiszki
function kumOpts(c) {
  const e = distractorEntry(c), pool = S.cards.filter(x => x.id !== c.id).slice(0, 2000).map(distractorEntry).filter(x => x.a && norm(x.a) !== norm(e.a));
  const wrong = pickDistractors(e, pool, 3); if (wrong.length < 3) return null;
  return shuffle([e.a, ...wrong]);
}
function kumPlay() {
  const K = KUM; if (!K.sel.length) return toast('Wybierz 1–3 fiszki');
  K.q = K.sel.map(id => ({ id, res: null })); K.qi = 0; K.phase = 'answer'; kumAsk(); render();
}
function kumAsk() {
  const K = KUM, q = K.q[K.qi], c = kumCard(q.id);
  q.opts = kumOpts(c); q.mode = q.opts ? 'abcd' : 'type'; q.at = Date.now(); q.hidden = []; q.letter = false;
}
function kumAnswer(ok, how, typedVerdict) {
  const K = KUM, q = K.q[K.qi], c = kumCard(q.id); if (!q || q.res) return;
  let good = ok, saved = false;
  if (!good && K.shield) { K.shield = false; good = true; saved = true; }
  else if (!good && kumHas('second') && !K.usedSecond) { K.usedSecond = true; good = true; saved = 'half'; }
  // powtórka: zaległa fiszka dostaje ocenę (jak w walce z bossem)
  const now = Date.now(), ms = Math.min(60000, now - q.at);
  if (c && c.srs.due <= now && c.srs.state !== 'new') {
    const g = ok ? (how === 'type' && typedVerdict === 'close' ? 2 : 3) : 1;
    S.log.push({ id: uid(), c: c.id, d: c.deckId, t: now, g, n: 0, ms, m: how === 'type' ? 'type' : 'flip', kum: 1, ...(how === 'type' ? { v: typedVerdict } : {}) });
    c.srs = schedule(c.srs, g); touch(c); emit('review', c, g, false);
  } else (S.tlog = S.tlog || []).push({ id: uid(), t: now, d: c?.deckId, ms });
  q.res = { good, ok, saved, how, fast: ms < 5000 };
  if (good && !saved) K.streak++; else if (!good) K.streak = 0;
  save();
  if (K.qi < K.q.length - 1) { setTimeout(() => { if (KUM === K && K.phase === 'answer') { K.qi++; kumAsk(); render(); } }, 650); }
  else setTimeout(() => { if (KUM === K) kumScore(); }, 650);
  render();
}
// ---------- liczenie zagrania: podstawa × mnożnik
function kumScore() {
  const K = KUM, lines = [];
  let chips = 0, mult = 1;
  for (const q of K.q) {
    const c = kumCard(q.id), kd = kumKind(c); if (!q.res.good) { lines.push(`✗ ${esc(cardView(c).label || '').slice(0, 40)} – 0`); continue; }
    let b = kd.base;
    if (kumHas('risk') && (kd.k === 'new' || kd.k === 'hard')) b *= 3;
    if (kumHas('elder') && kd.k === 'mature') b *= 2;
    if (q.res.how === 'type') b *= kumHas('writer') ? 2 : 1.5;
    if (kumHas('hoard')) b += 5 * K.jokers.length;
    if (kumHas('quick') && q.res.fast) b += 15;
    if (q.res.saved === 'half') b /= 2;
    b = Math.round(b); chips += b;
  }
  const good = K.q.filter(q => q.res.good).length, n = K.q.length;
  if (good) mult += good - 1;
  const decks = new Set(K.q.map(q => kumCard(q.id)?.deckId));
  if (good === n && n >= 2 && decks.size === 1) { mult += 2; lines.push('📚 Jedna talia: +2 mnożnik'); }
  if (kumHas('spec') && decks.size === 1 && good) { mult += 3; lines.push('🎯 Specjalista: +3'); }
  if (kumHas('full') && n === 3 && good) { mult += 4; lines.push('🖐️ Pełna ręka: +4'); }
  if (kumHas('roll') && good) { mult += K.streak; if (K.streak) lines.push(`🔥 Rozpęd: +${K.streak}`); }
  if (kumHas('sniper') && n === 1 && good) { mult *= 4; lines.push('🏹 Snajper: ×4'); }
  if (good === n && n === 3) { mult *= 1.5; lines.push('✨ Czyste zagranie 3 fiszek: ×1,5'); }
  if (kumHas('gold') && good) { mult *= 1.5; lines.push('👑 Złota rączka: ×1,5'); }
  mult = Math.round(mult * 10) / 10;
  const pts = Math.round(chips * mult);
  K.score += pts; K.total += pts; K.best = Math.max(K.best, pts); K.plays--;
  K.last = { chips, mult, pts, lines, good, n };
  K.hand = K.hand.filter(id => !K.sel.includes(id)); K.sel = []; kumDraw();
  K.phase = 'scored'; render();
}
function kumAfterPlay() {
  const K = KUM, target = KUM_TARGETS[K.round - 1];
  if (K.score >= target) {   // runda wygrana
    let earn = 3 + K.plays + (kumHas('miser') ? K.disc : 0) + (kumHas('mine') ? 2 : 0), interest = Math.min(kumHas('banker') ? 10 : 5, Math.floor(K.money / 5));
    K.money += earn + interest; K.won = { earn, interest };
    if (K.round >= KUM_TARGETS.length) return kumEnd(true);
    K.phase = 'shop'; K.shop = kumShopRoll(); K.rerolls = 0; return render();
  }
  if (K.plays <= 0) return kumEnd(false);
  K.phase = 'pick'; render();
}
// ---------- sklep
function kumShopRoll() {
  const js = shuffle(Object.keys(KUM_J).filter(k => !KUM.jokers.includes(k))).slice(0, 3), is = shuffle(Object.keys(KUM_I)).slice(0, 2);
  return [...js.map(k => ({ t: 'j', k })), ...is.map(k => ({ t: 'i', k }))];
}
function kumEnd(win) {
  const K = KUM, rounds = win ? KUM_TARGETS.length : K.round - 1;
  const gold = rounds * 25 + (win ? 150 : 0), xp = rounds * 15 + (win ? 60 : 0);
  if (gold) S.wallet.push({ id: 'kum-' + uid(), n: gold, why: 'boss-kum', t: Date.now() });
  if (xp && typeof giveXP === 'function') giveXP(xp, 'kum');
  const st = S.stats.kum = S.stats.kum || { runs: 0, best: 0, bestPts: 0, wins: 0 };
  st.runs++; if (win) st.wins++; st.best = Math.max(st.best, rounds); st.bestPts = Math.max(st.bestPts, K.total);
  save(); K.phase = 'end'; K.result = { win, rounds, gold, xp }; render();
}

// ---------- widoki
const kumHead = () => { const K = KUM, t = KUM_TARGETS[K.round - 1], r = KUM_RULES[K.round];
  return `<div class="kum-top"><button class="iconbtn" data-act="kum-quit" aria-label="Zakończ bieg">✕</button>
    <div class="grow"><b>Runda ${K.round}/${KUM_TARGETS.length}</b>${r ? ` <span class="kum-rule">${r.t}</span>` : ''}<div class="kum-prog"><i style="width:${Math.min(100, K.score / t * 100)}%"></i></div><small>${K.score.toLocaleString('pl')} / ${t.toLocaleString('pl')} pkt</small></div>
    <div class="kum-stats"><span title="Zagrania">▶ ${K.plays}</span><span title="Wymiany">🔄 ${K.disc}</span><span title="Monety">🪙 ${K.money}</span></div></div>
  <div class="kum-jokers">${K.jokers.map(k => `<button class="kum-j" data-act="kum-info" data-t="j" data-k="${k}" title="${esc(KUM_J[k].n)}">${kumIcon(KUM_J[k].ic)}</button>`).join('')}${Array(Math.max(0, KUM_SLOTS - K.jokers.length)).fill('<span class="kum-j empty"></span>').join('')}
    <span class="kum-sep"></span>${K.items.map((k, i) => `<button class="kum-j item" data-act="kum-use" data-i="${i}" title="${esc(KUM_I[k].n)} – użyj">${kumIcon(KUM_I[k].ic)}</button>`).join('')}${Array(Math.max(0, KUM_ITEM_SLOTS - K.items.length)).fill('<span class="kum-j empty item"></span>').join('')}</div>`; };
const kumCardHTML = (id, sel) => { const c = kumCard(id), v = c && cardView(c), kd = kumKind(c), d = c && deckById(c.deckId);
  return `<button class="kum-card${sel ? ' on' : ''} k-${kd.k}" data-act="kum-sel" data-id="${id}"><span class="kum-val">${kd.base}</span><span class="kum-q">${esc(stripHtml(v?.label || '').slice(0, 90))}</span><small>${esc((d?.name || '').replace(/^🏫\s*/, '').slice(0, 22))}${kd.t ? ' · ' + kd.t : ''}</small></button>`; };
function kumIntroHTML() {
  const st = S.stats.kum || {}, decks = S.decks.filter(d => S.cards.some(c => c.deckId === d.id && !c.sus));
  return `<div class="row nowrap"><button class="iconbtn" data-go="#/boss">‹</button><h1 class="grow" style="margin:0">🃏 Kumulacja</h1><span class="tag">admin</span></div>
  <div class="card kum-intro"><p style="margin-top:0"><b>8 rund, coraz wyższy próg punktów.</b> W rundzie masz ręce po 5 fiszek: wybierz 1–3, odpowiedz i zbieraj <b>podstawę × mnożnik</b>.</p>
    <ul class="small"><li>Trudne i nowe fiszki są warte więcej, utrwalone mniej.</li><li>Więcej dobrych odpowiedzi w zagraniu = większy mnożnik; jedna talia i komplet 3 fiszek dają premie.</li>
    <li>Wpisanie odpowiedzi zamiast ABCD: ×1,5 podstawy.</li><li>Między rundami sklep: <b>atuty</b> (na cały bieg) i <b>pomoce</b> (jednorazowe).</li><li>Zaległe fiszki liczą się jak powtórki.</li></ul>
    <label class="small muted">Z jakich fiszek?</label>
    <select id="kum-deck"><option value="all">Wszystkie talie</option>${decks.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select>
    <div class="spacer"></div><button class="primary block" data-act="kum-start" style="min-height:52px">▶ Zacznij bieg</button>
    ${st.runs ? `<p class="small muted center" style="margin:10px 0 0">Biegi: ${st.runs} · wygrane: ${st.wins || 0} · rekord: runda ${st.best} · ${(st.bestPts || 0).toLocaleString('pl')} pkt</p>` : ''}</div>`;
}
function kumPickHTML() {
  const K = KUM;
  return `${kumHead()}<p class="small muted center" style="margin:6px 0">Wybierz 1–${KUM_MAX_PLAY} fiszki do zagrania · wartość podstawy w rogu</p>
  <div class="kum-hand">${K.hand.map(id => kumCardHTML(id, K.sel.includes(id))).join('')}</div>
  <div class="kum-actions"><button class="primary grow" data-act="kum-play" ${K.sel.length ? '' : 'disabled'}>▶ Zagraj (${K.sel.length})</button>
    <button class="grow" data-act="kum-disc" ${K.sel.length && K.disc > 0 ? '' : 'disabled'}>🔄 Wymień (${K.disc})</button></div>`;
}
function kumAnswerHTML() {
  const K = KUM, q = K.q[K.qi], c = kumCard(q.id), v = cardView(c), ans = v.ans;
  const opts = q.opts ? q.opts.map((o, i) => q.hidden.includes(i) ? '' : `<button class="abcd${q.res ? (norm(o) === norm(ans) ? ' right' : q.pick === i ? ' wrong' : '') : ''}" data-act="kum-opt" data-i="${i}" ${q.res ? 'disabled' : ''}><b>${'ABCD'[i]}</b> ${esc(o)}</button>`).join('') : '';
  return `${kumHead()}<div class="kum-qn">Fiszka ${K.qi + 1}/${K.q.length}${K.streak ? ` · 🔥 seria ${K.streak}` : ''}${K.shield ? ' · 🛡️' : ''}</div>
  <div class="card flash qfit">${v.q}${q.letter ? `<div class="small muted" style="margin-top:8px">Zaczyna się na: <b>${esc(ans.trim().slice(0, 1).toUpperCase())}…</b></div>` : ''}</div>
  ${q.res ? `<div class="kum-res ${q.res.good ? 'ok' : 'bad'}">${q.res.saved === true ? '🛡️ Tarcza uratowała!' : q.res.saved === 'half' ? '🛟 Druga szansa – połowa punktów' : q.res.good ? '✓ Dobrze' : `✗ Odpowiedź: ${esc(ans)}`}</div>` : ''}
  ${q.mode === 'abcd' && !q.typing ? `<div class="abcd-grid">${opts}</div>${q.res ? '' : '<button class="ghost block" data-act="kum-type">✍️ Wpiszę odpowiedź (×1,5 punktów)</button>'}`
    : q.res ? '' : `<div class="row nowrap"><input id="kum-in" class="grow" placeholder="Wpisz odpowiedź…" autocomplete="off"><button class="primary" data-act="kum-send">✓</button></div>${q.opts ? '<button class="ghost block" data-act="kum-abcd">Wróć do ABCD</button>' : ''}`}`;
}
function kumScoredHTML() {
  const K = KUM, L = K.last, t = KUM_TARGETS[K.round - 1];
  return `${kumHead()}<div class="card kum-score"><div class="kum-eq"><span class="kum-chips">${L.chips}</span><span class="kum-x">×</span><span class="kum-mult">${String(L.mult).replace('.', ',')}</span><span class="kum-x">=</span><b>${L.pts.toLocaleString('pl')}</b></div>
    <p class="small muted center" style="margin:4px 0 8px">${L.good}/${L.n} dobrze</p>${L.lines.length ? `<ul class="small kum-lines">${L.lines.map(l => `<li>${l}</li>`).join('')}</ul>` : ''}
    <button class="primary block" data-act="kum-next">${K.score >= t ? '🏁 Runda wygrana – dalej' : K.plays > 0 ? '▶ Następne zagranie' : 'Koniec zagrań…'}</button></div>`;
}
function kumShopHTML() {
  const K = KUM, rc = 2 + K.rerolls;
  return `${kumHead()}<div class="card kum-won"><b>🏁 Runda ${K.round} wygrana!</b> <span class="small muted">+${K.won.earn} 🪙 · odsetki +${K.won.interest} 🪙</span></div>
  <h2 style="margin:10px 0 6px">🛒 Sklep</h2>
  <div class="kum-shop">${K.shop.map((o, i) => { const D = o.t === 'j' ? KUM_J[o.k] : KUM_I[o.k]; if (o.bought) return '<div class="kum-off sold">Kupione</div>';
    const full = o.t === 'j' ? K.jokers.length >= KUM_SLOTS : K.items.length >= KUM_ITEM_SLOTS;
    return `<div class="kum-off ${o.t === 'j' ? 'j' : 'i'}">${kumIcon(D.ic)}<b>${esc(D.n)}</b><small>${esc(D.d)}</small><button class="sm primary" data-act="kum-buy" data-i="${i}" ${K.money >= D.p && !full ? '' : 'disabled'}>${full ? 'Brak miejsca' : `Kup · ${D.p} 🪙`}</button><span class="kum-type">${o.t === 'j' ? 'atut' : 'pomoc'}</span></div>`; }).join('')}</div>
  ${K.jokers.length ? `<p class="small muted" style="margin:10px 0 4px">Twoje atuty (stuknij, żeby sprzedać za połowę ceny):</p><div class="kum-owned">${K.jokers.map(k => `<button class="sm" data-act="kum-sell" data-k="${k}">${KUM_J[k].ic} ${esc(KUM_J[k].n)} · +${Math.floor(KUM_J[k].p / 2)} 🪙</button>`).join('')}</div>` : ''}
  <div class="kum-actions"><button class="grow" data-act="kum-reroll" ${K.money >= rc ? '' : 'disabled'}>🎲 Nowa oferta · ${rc} 🪙</button><button class="primary grow" data-act="kum-nextround">▶ Runda ${K.round + 1} · cel ${KUM_TARGETS[K.round].toLocaleString('pl')}</button></div>`;
}
function kumEndHTML() {
  const K = KUM, R = K.result;
  return `<div class="card center kum-end"><div style="font-size:52px">${R.win ? '🏆' : '💥'}</div><h2>${R.win ? 'Bieg wygrany!' : `Koniec biegu w rundzie ${K.round}`}</h2>
    <p>Łącznie <b>${K.total.toLocaleString('pl')}</b> pkt · najlepsze zagranie ${K.best.toLocaleString('pl')}</p>
    <p class="small">Nagroda: <b>+${R.gold} 🪙 złota</b> · <b>+${R.xp} XP</b></p>
    <div class="kum-actions"><button class="primary grow" data-act="kum-again">▶ Jeszcze raz</button><button class="grow" data-act="kum-quit2">Wyjdź</button></div></div>`;
}
ROUTES.kumul = () => {
  if (!kumAdmin()) return { tab: 'arena', html: '<p class="muted center" style="padding:40px 0">Ten tryb jest jeszcze w testach.</p>' };
  if (!KUM) return { tab: 'arena', html: kumIntroHTML() };
  const K = KUM, html = K.phase === 'pick' ? kumPickHTML() : K.phase === 'answer' ? kumAnswerHTML() : K.phase === 'scored' ? kumScoredHTML() : K.phase === 'shop' ? kumShopHTML() : kumEndHTML();
  if (K.phase === 'answer') onMount(() => { const i = $('#kum-in'); if (i) { i.focus(); i.onkeydown = e => { if (e.key === 'Enter') ACTIONS['kum-send'](); }; } });
  return { tab: 'arena', focus: true, html: `<div class="kum">${html}</div>` };
};
// wejście w zakładce Przygoda – tylko admin
const kumBoss0 = ROUTES.boss;
ROUTES.boss = (...a) => { const v = kumBoss0(...a); if (!v?.html || !kumAdmin() || (a[0] && a[0][1])) return v;
  return { ...v, html: v.html.replace('<div class="card row nowrap coop-cta"', `<div class="card row nowrap kum-cta" data-go="#/kumul"><span class="kum-cta-ic">🃏</span><div class="grow"><b>Kumulacja <span class="tag">admin</span></b><div class="small muted">8 rund · podstawa × mnożnik · atuty ze sklepu${S.stats.kum?.best ? ` · rekord: runda ${S.stats.kum.best}` : ''}</div></div><span>›</span></div><div class="card row nowrap coop-cta"`) }; };

Object.assign(ACTIONS, {
  'kum-start': () => kumStart($('#kum-deck')?.value || 'all'),
  'kum-sel': el => { const K = KUM, id = el.dataset.id; if (!K || K.phase !== 'pick') return; const i = K.sel.indexOf(id);
    if (i >= 0) K.sel.splice(i, 1); else if (K.sel.length < KUM_MAX_PLAY) K.sel.push(id); else return toast(`Maksymalnie ${KUM_MAX_PLAY} fiszki na zagranie`); render(); },
  'kum-play': () => kumPlay(),
  'kum-disc': () => { const K = KUM; if (!K.sel.length || K.disc <= 0) return; K.hand = K.hand.filter(id => !K.sel.includes(id)); K.sel = []; K.disc--; kumDraw(); render(); },
  'kum-opt': el => { const K = KUM, q = K?.q?.[K.qi]; if (!q || q.res) return; const i = +el.dataset.i; q.pick = i; kumAnswer(norm(q.opts[i]) === norm(cardView(kumCard(q.id)).ans), 'abcd'); },
  'kum-type': () => { const q = KUM?.q?.[KUM.qi]; if (q) { q.typing = true; q.mode = 'type'; render(); } },
  'kum-abcd': () => { const q = KUM?.q?.[KUM.qi]; if (q?.opts) { q.typing = false; q.mode = 'abcd'; render(); } },
  'kum-send': () => { const K = KUM, q = K?.q?.[K.qi]; if (!q || q.res) return; const t = $('#kum-in')?.value || ''; if (!t.trim()) return;
    const v = checkAnswer(t, cardView(kumCard(q.id)).ans); kumAnswer(v !== 'wrong', 'type', v); },
  'kum-next': () => kumAfterPlay(),
  'kum-buy': el => { const K = KUM, o = K.shop[+el.dataset.i]; if (!o || o.bought) return; const D = o.t === 'j' ? KUM_J[o.k] : KUM_I[o.k]; if (K.money < D.p) return;
    if (o.t === 'j') { if (K.jokers.length >= KUM_SLOTS) return; K.jokers.push(o.k); } else { if (K.items.length >= KUM_ITEM_SLOTS) return; K.items.push(o.k); }
    K.money -= D.p; o.bought = true; render(); },
  'kum-sell': el => { const K = KUM, k = el.dataset.k; if (!K.jokers.includes(k)) return; K.jokers = K.jokers.filter(x => x !== k); K.money += Math.floor(KUM_J[k].p / 2); render(); },
  'kum-reroll': () => { const K = KUM, rc = 2 + K.rerolls; if (K.money < rc) return; K.money -= rc; K.rerolls++; K.shop = kumShopRoll(); render(); },
  'kum-nextround': () => { KUM.round++; kumStartRound(); render(); },
  'kum-use': el => { const K = KUM, i = +el.dataset.i, k = K.items[i]; if (!k) return; const q = K.phase === 'answer' ? K.q[K.qi] : null;
    if (k === 'half') { if (!q || q.res || !q.opts || q.mode !== 'abcd') return toast('Użyj podczas odpowiedzi ABCD'); const ans = cardView(kumCard(q.id)).ans; q.hidden = shuffle(q.opts.map((o, j) => j).filter(j => norm(q.opts[j]) !== norm(ans))).slice(0, 2); }
    else if (k === 'letter') { if (!q || q.res) return toast('Użyj podczas odpowiedzi'); q.letter = true; }
    else if (k === 'disc') { if (K.phase !== 'pick') return toast('Użyj przy wybieraniu fiszek'); K.disc++; }
    else if (k === 'shield') { if (K.shield) return toast('Tarcza już działa'); K.shield = true; }
    K.items.splice(i, 1); toast(`${KUM_I[k].ic} ${KUM_I[k].n}`); render(); },
  'kum-info': el => { const D = (el.dataset.t === 'j' ? KUM_J : KUM_I)[el.dataset.k]; if (D) toast(`${D.ic} ${D.n}: ${D.d}`, 4000); },
  'kum-quit': () => { if (!KUM) return go('#/boss'); askBox({ icon: '🃏', title: 'Zakończyć bieg?', intro: 'Dostaniesz nagrodę za ukończone rundy.', ok: 'Zakończ', cancel: 'Graj dalej', danger: true }).then(ok => { if (ok && KUM && KUM.phase !== 'end') kumEnd(false); }); },
  'kum-again': () => { const d = KUM?.deckId || 'all'; KUM = null; kumStart(d); },
  'kum-quit2': () => { KUM = null; go('#/boss'); },
});

'use strict';
/* ⚔️ Boss nauki: walka z potworem z użyciem fiszek, które już znasz.
   Dobra odpowiedź = obrażenia bossa (serie wzmacniają cios), zła = tracisz ❤️.
   To są prawdziwe powtórki: karty „do powtórki” są oceniane w harmonogramie (jak w zwykłej nauce), pozostałe liczą się jako trening.
   Nagrody: kryształy, pył gwiezdny ✨ (do hologramów), co 3. zwycięstwo złote jajo 👑 do inkubatora. */

const BOSSES = [
  { name: 'Prokrastynator', desc: 'Szepcze: „zrobisz to jutro”.' },
  { name: 'Krzywa Zapominania', desc: 'Zjada wszystko, czego nie powtórzysz.' },
  { name: 'Pan Rozkojarzony', desc: 'Kusi powiadomieniami i memami.' },
  { name: 'Kolokwiusz', desc: 'Strażnik pierwszego terminu.' },
  { name: 'Mgła o 3 w nocy', desc: 'Wymazuje pamięć przed egzaminem.' },
  { name: 'Lord Ściąga', desc: 'Nienawidzi uczciwej nauki.' },
  { name: 'Sesjozaur', desc: 'Budzi się raz na semestr.' },
  { name: 'Wielki Prowadzący', desc: 'Zadaje wyłącznie podchwytliwe pytania.' },
];
const BOSS_MIN = 5, BOSS_MAX = 20, BOSS_HP_ME = 100;
const bossLv = () => S.stats.bossLv || 0;
const bossOf = lv => { const b = BOSSES[lv % BOSSES.length]; return { ...b, lv, tier: Math.floor(lv / BOSSES.length) + 1, seed: 9001 + lv * 131 }; };
const bossArt = (b, cls = '') => `<div class="boss-art ${cls}">${creatureSVG(b.seed, b.tier > 1 ? 'mythic' : 'epic', { boss: true, label: b.name })}</div>`;
let BOSS = null, BOSS_PICK = { deck: 'all', mode: 'flip' };
try { Object.assign(BOSS_PICK, JSON.parse(localStorage.getItem('bossPick') || '{}')); } catch { /* */ }

// karty do walki: najpierw zaległe powtórki, potem najsłabsze z nauczonych
function bossPool(deck) {
  const now = Date.now(), cs = S.cards.filter(c => c.srs.state !== 'new' && (deck === 'all' || c.deckId === deck) && noteById(c.noteId));
  const due = shuffle(cs.filter(c => c.srs.due <= now)), rest = cs.filter(c => c.srs.due > now).sort((a, b) => (b.srs.lapses - a.srs.lapses) || (a.srs.ease - b.srs.ease));
  return { cards: [...due, ...shuffle(rest.slice(0, 40))].slice(0, BOSS_MAX), due: due.length, all: cs.length };
}
function bossStart() {
  const P = bossPool(BOSS_PICK.deck);
  if (P.cards.length < BOSS_MIN) return toast(`Do walki potrzebujesz min. ${BOSS_MIN} nauczonych fiszek – przerób najpierw nowe karty`, 4500);
  const b = bossOf(bossLv()), n = P.cards.length;
  const hp = Math.round(n * 10 * .75 * (1 + .15 * (b.tier - 1)));
  BOSS = { b, ids: P.cards.map(c => c.id), i: 0, hp, max: hp, me: BOSS_HP_ME, combo: 0, best: 0, ok: 0, bad: 0, hits: [], phase: 'fight', shown: false, mode: BOSS_PICK.mode, t0: Date.now(), shownAt: Date.now(), lostHp: 0 };
  go('#/boss'); render();
}
const bossCard = () => BOSS && S.cards.find(c => c.id === BOSS.ids[BOSS.i]);

// ocena: 1 = nie pamiętam, 2 = ledwo, 3 = dobrze, 4 = łatwo; prawdziwa powtórka dla zaległych kart
function bossGrade(g, typedOk) {
  const B = BOSS, c = bossCard(); if (!B || !c || B.phase !== 'fight') return;
  const now = Date.now(), ms = Math.min(60000, now - B.shownAt);
  if (c.srs.due <= now && c.srs.state !== 'new') {
    const entry = { id: uid(), c: c.id, d: c.deckId, t: now, g, n: 0, ms, m: B.mode === 'type' ? 'type' : 'flip', boss: 1, ...(B.mode === 'type' ? { v: typedOk ? 'ok' : g === 1 ? 'wrong' : 'close' } : {}) };
    c.srs = schedule(c.srs, g); touch(c); S.log.push(entry); emit('review', c, g, false);
  } else (S.tlog = S.tlog || []).push({ id: uid(), t: now, d: c.deckId, ms });
  const tierHit = 18 + 4 * (B.b.tier - 1);
  if (g >= 3) {
    B.combo++; B.best = Math.max(B.best, B.combo); B.ok++;
    const mult = (B.combo >= 6 ? 2 : B.combo >= 3 ? 1.5 : 1) * (B.mode === 'type' && typedOk ? 1.5 : 1) * (g === 4 ? 1.2 : 1);
    const dmg = Math.round(10 * mult); B.hp = Math.max(0, B.hp - dmg); B.fx = { k: 'boss', n: dmg, crit: mult >= 1.5, t: now };
  } else if (g === 2) { B.combo = 0; B.hp = Math.max(0, B.hp - 5); B.me -= 4; B.lostHp += 4; B.fx = { k: 'both', n: 5, t: now }; }
  else { B.combo = 0; B.bad++; B.me -= tierHit; B.lostHp += tierHit; B.fx = { k: 'me', n: tierHit, t: now }; B.missed = (B.missed || []).concat(c.id); }
  B.i++; B.shown = false; B.typed = null; B.verdict = null; B.shownAt = Date.now();
  save();
  if (B.hp <= 0) return bossEnd(true);
  if (B.me <= 0 || B.i >= B.ids.length) return bossEnd(false);
  bossSfx(g >= 3 ? 'hit' : 'hurt'); render();
}
function bossEnd(won) {
  const B = BOSS; B.phase = won ? 'won' : 'lost'; B.me = Math.max(0, B.me);
  const flawless = won && B.lostHp === 0, lv = B.b.lv, rw = { gems: 0, dust: 0, egg: 0 };
  if (won) {
    rw.gems = 40 + 10 * B.b.tier; rw.dust = (10 + 5 * B.b.tier) * (flawless ? 2 : 1);
    const id = 'boss-' + lv;
    if (!S.wallet.some(w => w.id === id)) S.wallet.push({ id, n: rw.gems, why: 'boss', t: Date.now() });
    addDust(rw.dust, 'boss-dust-' + lv);
    if ((lv + 1) % 3 === 0) { rw.egg = 1; addItem('egg', 'boss', 1, 'boss-egg-' + lv); }
    S.stats.bossLv = lv + 1; S.stats.bossWins = (S.stats.bossWins || 0) + 1; if (flawless) S.stats.bossFlawless = (S.stats.bossFlawless || 0) + 1;
    setTimeout(() => { celebrate(`⚔️ Pokonałeś: ${B.b.name}!`, `+${rw.gems} 💎 · +${rw.dust} ✨${rw.egg ? ' · 👑 złote jajo' : ''}${flawless ? ' · bez straty ❤️!' : ''}`); confetti(flawless ? 260 : 160); }, 900);
    bossSfx('win');
  } else { rw.dust = 3; addDust(3); bossSfx('lose'); }
  B.rw = rw; B.flawless = flawless; save();
  if (typeof checkAchievements === 'function') checkAchievements();
  render();
}
function bossSfx(k) {
  try {
    if (S.settings.sound === false) return;
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const seq = { hit: [[520, .06], [780, .08]], hurt: [[180, .14], [120, .16]], win: [[523, .12], [659, .12], [784, .12], [1046, .3]], lose: [[392, .2], [330, .2], [262, .4]] }[k] || [];
    let t = audioCtx.currentTime;
    for (const [f, d] of seq) { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = k === 'hurt' ? 'sawtooth' : 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + d); t += d * .9; }
  } catch { /* */ }
}

// ---------- widoki
const hpBar = (v, max, cls) => `<div class="hpbar ${cls}"><i style="width:${Math.max(0, v / max * 100).toFixed(1)}%"></i><span>${Math.max(0, Math.round(v))} / ${max}</span></div>`;
ROUTES.boss = () => {
  const B = BOSS;
  if (!B) {
    const b = bossOf(bossLv()), P = bossPool(BOSS_PICK.deck);
    return { tab: 'arena', html: `
    <div class="row nowrap"><button class="iconbtn" data-go="#/battles">‹</button><h1 class="grow" style="margin:0">⚔️ Boss nauki</h1>${coinsHTML()}</div>
    <div class="card center boss-lobby">
      <div class="boss-stage idle">${bossArt(b)}</div>
      <div class="boss-lv">Poziom ${b.lv + 1}${b.tier > 1 ? ` · ${'★'.repeat(Math.min(5, b.tier - 1))}` : ''}</div>
      <h2 style="margin:4px 0 2px">${esc(b.name)}</h2><p class="small muted" style="margin:0 0 14px">${esc(b.desc)}</p>
      <div class="boss-rules small">
        <div><b>✓ Pamiętasz</b><span>boss traci ❤️ · seria 3+ = cios ×1,5, 6+ = ×2</span></div>
        <div><b>✗ Nie pamiętasz</b><span>Ty tracisz ${18 + 4 * (b.tier - 1)} ❤️</span></div>
        <div><b>🏆 Wygrana</b><span>+${40 + 10 * b.tier} 💎 · +${10 + 5 * b.tier} ✨ pyłu${(b.lv + 1) % 3 === 0 ? ' · 👑 złote jajo' : ''} · bez straty ❤️ = pył ×2</span></div>
      </div>
      <label class="field"><span>Fiszki z</span><select data-boss-deck="1"><option value="all">Wszystkich talii</option>${S.decks.map(d => `<option value="${d.id}" ${BOSS_PICK.deck === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></label>
      <div class="seg boss-mode"><button class="${BOSS_PICK.mode === 'flip' ? 'on' : ''}" data-act="boss-mode" data-m="flip">🃏 Fiszki</button><button class="${BOSS_PICK.mode === 'type' ? 'on' : ''}" data-act="boss-mode" data-m="type">⌨️ Wpisz · ×1,5</button></div>
      <p class="small muted" style="margin:10px 0">${P.cards.length >= BOSS_MIN ? `Walka: <b>${P.cards.length}</b> fiszek${P.due ? ` · w tym <b>${Math.min(P.due, P.cards.length)}</b> zaległych powtórek (liczą się do harmonogramu)` : ' (trening – nic nie jest zaległe)'}` : `Masz ${P.all} nauczonych fiszek – potrzeba min. ${BOSS_MIN}.`}</p>
      <button class="primary block boss-go" data-act="boss-start" ${P.cards.length >= BOSS_MIN ? '' : 'disabled'}>⚔️ Walcz</button>
      <p class="small muted" style="margin:12px 0 0">Pokonani: <b>${S.stats.bossWins || 0}</b> · bez straty ❤️: <b>${S.stats.bossFlawless || 0}</b> · pył: <b>${dust()} ✨</b> · złote jaja: <b>${itemCount('egg', 'boss')}</b></p>
    </div>` };
  }
  if (B.phase !== 'fight') {
    const won = B.phase === 'won', rw = B.rw || {};
    return { tab: 'arena', focus: true, html: `
    <div class="card center boss-end ${won ? 'won' : 'lost'}">
      <div class="boss-stage ${won ? 'dead' : 'gloat'}">${bossArt(B.b)}${won ? '<div class="boss-boom"></div>' : ''}</div>
      <h2 style="margin:6px 0">${won ? `🏆 ${esc(B.b.name)} pokonany!` : `💀 ${esc(B.b.name)} wygrywa…`}</h2>
      <p class="small muted">${B.ok} dobrych · ${B.bad} błędów · najlepsza seria ${B.best}${won && B.flawless ? ' · <b>bez straty ❤️</b>' : ''}</p>
      <div class="boss-rw">${won ? `<span>+${rw.gems} 💎</span><span>+${rw.dust} ✨ pyłu</span>${rw.egg ? '<span>👑 złote jajo</span>' : ''}` : '<span>+3 ✨ pyłu na pocieszenie</span>'}</div>
      ${(B.missed || []).length ? `<p class="small" style="margin:12px 0 6px">Nie pamiętałeś: <b>${B.missed.length}</b> ${plural(B.missed.length, 'fiszka', 'fiszki', 'fiszek')} – powtórz je, póki są świeże.</p>
        <button class="block" data-act="boss-cram">🔁 Powtórz je teraz</button>` : ''}
      <div class="row" style="margin-top:10px"><button class="primary grow" data-act="boss-again">${won ? 'Następny boss ⚔️' : 'Spróbuj ponownie'}</button><button class="grow" data-act="boss-close">Zamknij</button></div>
    </div>` };
  }
  const c = bossCard(), v = c ? cardView(c) : { q: '', a: '' }, fx = B.fx && Date.now() - B.fx.t < 900 ? B.fx : null;
  const typedOK = B.mode === 'type' && v.ans && v.ans.length <= 120;
  return { tab: 'arena', focus: true, html: `
  <div class="studybar"><button class="iconbtn" data-act="boss-quit">✕</button><div class="title">⚔️ ${esc(B.b.name)}</div><span class="small muted">${B.i + 1}/${B.ids.length}</span></div>
  <div class="boss-fight">
    <div class="boss-stage${fx?.k === 'boss' || fx?.k === 'both' ? ' hit' : ''}${fx?.crit ? ' crit' : ''}">${bossArt(B.b)}${fx && fx.k !== 'me' ? `<b class="dmg${fx.crit ? ' crit' : ''}">−${fx.n}${fx.crit ? '!' : ''}</b>` : ''}</div>
    ${hpBar(B.hp, B.max, 'boss')}
    <div class="row nowrap boss-me${fx?.k === 'me' || fx?.k === 'both' ? ' hurt' : ''}"><span class="boss-heart">❤️</span>${hpBar(B.me, BOSS_HP_ME, 'me')}${B.combo >= 2 ? `<span class="combo">🔥 ${B.combo}</span>` : ''}</div>
  </div>
  <div class="card flash boss-q${fx?.k === 'me' ? ' shake' : ''}">${B.shown ? v.a : v.q}</div>
  ${B.shown ? `${B.verdict ? `<p class="center small ${B.verdict === 'wrong' ? 'bad' : 'good'}">${B.verdict === 'wrong' ? `✗ Poprawnie: <b>${esc(v.ans)}</b>` : B.verdict === 'close' ? '≈ Prawie – liczę jako „ledwo”' : '✓ Dobrze! Cios ×1,5'}</p>` : ''}
    <div class="boss-grades">${B.verdict ? `<button class="primary" data-act="boss-next">Dalej ›</button>` : `
      <button class="g1" data-act="boss-g" data-g="1">✗<small>Nie pamiętam</small></button><button class="g2" data-act="boss-g" data-g="2">≈<small>Ledwo</small></button>
      <button class="g3" data-act="boss-g" data-g="3">✓<small>Pamiętam</small></button><button class="g4" data-act="boss-g" data-g="4">⚡<small>Łatwo</small></button>`}</div>`
    : typedOK ? `<div class="row nowrap"><input id="boss-in" class="grow" placeholder="Wpisz odpowiedź…" autocomplete="off" autocapitalize="off"><button class="primary" data-act="boss-check">⚔️</button></div>
      <button class="ghost block small" data-act="boss-show" style="margin-top:6px">Nie wiem – pokaż</button>`
    : `<button class="primary block boss-go" data-act="boss-show">Pokaż odpowiedź</button>`}` };
};
// po wpisaniu: wynik od razu przelicza ocenę (ok → 3, prawie → 2, źle → 1)
function bossCheck() {
  const B = BOSS, c = bossCard(); if (!B || !c) return;
  const v = cardView(c), given = ($('#boss-in')?.value || '').trim(); if (!given) return toast('Wpisz odpowiedź albo stuknij „Nie wiem”');
  B.verdict = checkAnswer(given, v.ans); B.shown = true; B.pendingG = B.verdict === 'wrong' ? 1 : B.verdict === 'close' ? 2 : 3; render();
}
document.addEventListener('keydown', e => {
  if (parseRoute().parts[0] !== 'boss' || !BOSS || BOSS.phase !== 'fight') return;
  if (e.target.id === 'boss-in' && e.key === 'Enter') { e.preventDefault(); return bossCheck(); }
  if (e.target.tagName === 'INPUT') return;
  if (!BOSS.shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); BOSS.shown = true; render(); }
  else if (BOSS.shown && !BOSS.verdict && '1234'.includes(e.key)) bossGrade(+e.key);
  else if (BOSS.verdict && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); bossGrade(BOSS.pendingG, BOSS.verdict === 'ok'); }
});
document.addEventListener('change', e => { if (e.target.dataset?.bossDeck) { BOSS_PICK.deck = e.target.value; bossPickSave(); render(); } });
const bossPickSave = () => { try { localStorage.setItem('bossPick', JSON.stringify(BOSS_PICK)); } catch { /* */ } };
Object.assign(ACTIONS, {
  'boss-start': () => bossStart(),
  'boss-mode': el => { BOSS_PICK.mode = el.dataset.m; bossPickSave(); render(); },
  'boss-show': () => { if (BOSS) { BOSS.shown = true; render(); } },
  'boss-g': el => bossGrade(+el.dataset.g),
  'boss-check': () => bossCheck(),
  'boss-next': () => bossGrade(BOSS.pendingG, BOSS.verdict === 'ok'),
  'boss-quit': () => { if (confirm('Uciec z walki? Boss zostaje, a odpowiedzi do tej pory są zapisane.')) { BOSS = null; go('#/boss'); } },
  'boss-again': () => { BOSS = null; render(); },
  'boss-close': () => { BOSS = null; go('#/battles'); },
  'boss-cram': () => { const ids = BOSS.missed || [], d = S.cards.find(c => c.id === ids[0])?.deckId; BOSS = null; SESSION = null; if (d) go(`#/study/${d}/flip?cram=list&ids=${ids.join(',')}`); },
});
// karta w Arenie i na Starcie
function bossCardHTML() {
  const b = bossOf(bossLv()), due = S.cards.filter(c => c.srs.state !== 'new' && c.srs.due <= Date.now()).length;
  return `<div class="card row nowrap boss-home" data-go="#/boss"><span class="boss-home-ic">${bossArt(b)}</span><div class="grow"><b>⚔️ Boss: ${esc(b.name)}</b>
    <div class="small muted">Poziom ${b.lv + 1} · ${due ? `pokonaj go swoimi powtórkami (${due} zaległych)` : 'walcz fiszkami, które już znasz'}</div></div><span>›</span></div>`;
}
const bossBattles0 = ROUTES.battles;
ROUTES.battles = (...a) => { const v = bossBattles0(...a); if (!v?.html) return v; const i = v.html.indexOf('<div class="card'); return i < 0 ? v : { ...v, html: v.html.slice(0, i) + bossCardHTML() + v.html.slice(i) }; };
const bossHome0 = homeExtrasHTML;
homeExtrasHTML = function () { return (appMode() === 'full' ? bossCardHTML() : '') + bossHome0(); };

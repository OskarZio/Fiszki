'use strict';
/* Kryształy 💎, sklep, skrzynki z ruletką (losowanie naklejek), album naklejek i efekty zwycięstwa.
   Saldo jest liczone z historii (osiągnięcia, cele dzienne, gry, bitwy) + zapis wydatków – dzięki temu
   synchronizacja między urządzeniami nie gubi ani nie dubluje kryształów. */

const RARITY = {
  common: { name: 'Zwykła', color: '#3b82f6', sell: 10 },
  rare: { name: 'Rzadka', color: '#8b5cf6', sell: 30 },
  epic: { name: 'Epicka', color: '#ec4899', sell: 90 },
  legendary: { name: 'Legendarna', color: '#f59e0b', sell: 300 },
};
const ST = (id, e, name, r) => ({ id, e, name, r });
const STICKERS = [
  ST('thumb', '👍', 'Kciuk', 'common'), ST('cool', '😎', 'Luzak', 'common'), ST('nerd', '🤓', 'Kujon', 'common'), ST('books', '📚', 'Mól książkowy', 'common'),
  ST('coffee', '☕', 'Kawa', 'common'), ST('monkey', '🙈', 'Nie patrzę', 'common'), ST('sleepy', '😴', 'Śpioch', 'common'), ST('pizza', '🍕', 'Przerwa', 'common'),
  ST('turtle', '🐢', 'Żółwik', 'common'), ST('target', '🎯', 'Celnie', 'common'), ST('muscle', '💪', 'Siła', 'common'), ST('think', '🤔', 'Hmm…', 'common'),
  ST('phew', '😅', 'Uff', 'common'), ST('wave', '👋', 'Hej!', 'common'), ST('clap', '👏', 'Brawo', 'common'),
  ST('fire', '🔥', 'Ogień', 'rare'), ST('brain', '🧠', 'Mózgowiec', 'rare'), ST('zap', '⚡', 'Błyskawica', 'rare'), ST('rocket', '🚀', 'Rakieta', 'rare'),
  ST('owl', '🦉', 'Mądra sowa', 'rare'), ST('party', '🎉', 'Impreza', 'rare'), ST('angry', '😤', 'Nie odpuszczę', 'rare'), ST('mind', '🤯', 'Szok', 'rare'),
  ST('goat', '🐐', 'GOAT', 'rare'), ST('clover', '🍀', 'Fart', 'rare'),
  ST('crown', '👑', 'Król', 'epic'), ST('gem', '💎', 'Diament', 'epic'), ST('unicorn', '🦄', 'Jednorożec', 'epic'), ST('dragon', '🐉', 'Smok', 'epic'),
  ST('volcano', '🌋', 'Erupcja', 'epic'), ST('ninja', '🥷', 'Ninja', 'epic'), ST('wizard', '🧙', 'Czarodziej', 'epic'),
  ST('trophy', '🏆', 'Mistrz', 'legendary'), ST('comet', '☄️', 'Kometa', 'legendary'), ST('galaxy', '🌌', 'Galaktyka', 'legendary'), ST('trident', '🔱', 'Trójząb', 'legendary'),
];
const FREE_STICKERS = ['wave', 'thumb', 'phew'];
const stickerById = id => STICKERS.find(s => s.id === id);
// cele osiągnięć kolekcjonerskich = aktualna liczba naklejek
if (typeof ACHIEVEMENTS !== 'undefined') for (const [id, n] of [['album_full', STICKERS.length], ['legends_all', STICKERS.filter(x => x.r === 'legendary').length]]) { const a = ACHIEVEMENTS.find(x => x.id === id); if (a) a.goal = n; }
const CASES = {
  basic: { name: 'Skrzynka nauki', icon: '📦', price: 120, odds: { common: 70, rare: 22, epic: 6.5, legendary: 1.5 } },
  epic: { name: 'Skrzynka mistrza', icon: '🎁', price: 350, odds: { common: 38, rare: 36, epic: 20, legendary: 6 } },
  daily: { name: 'Codzienna skrzynka', icon: '🌞', price: 0, odds: { common: 45, rare: 33, epic: 16, legendary: 6 }, freeOnly: true },
  // GIF-y wgrywa host w panelu; skrzynka pokazuje się, gdy jest choć jeden
  gif: { name: 'Skrzynka z GIF-ami', icon: '🎞️', price: 250, odds: { common: 55, rare: 30, epic: 12, legendary: 3 }, gif: true },
};
// Komplet naklejek danej rzadkości = jednorazowa premia
const SET_BONUS = { common: 200, rare: 400, epic: 800, legendary: 2000 };
const setComplete = r => STICKERS.filter(s => s.r === r).every(s => hasItem('sticker', s.id) || hasItem('shiny', s.id));
const isShiny = id => hasItem('shiny', id);
const EFFECTS = [
  { id: 'classic', name: 'Konfetti', icon: '🎊', price: 0 },
  { id: 'stars', name: 'Gwiazdy', icon: '⭐', price: 150, chars: ['⭐', '✨', '🌟'] },
  { id: 'hearts', name: 'Serca', icon: '💖', price: 150, chars: ['💖', '💜', '💙'] },
  { id: 'gems', name: 'Deszcz diamentów', icon: '💎', price: 250, chars: ['💎', '💠'] },
  { id: 'fire', name: 'Płomienie', icon: '🔥', price: 250, chars: ['🔥', '💥'] },
  { id: 'brains', name: 'Mózgi', icon: '🧠', price: 300, chars: ['🧠', '⚡'] },
];

// ---------- saldo i ekwipunek
// Ochrona przed „przeklikiwaniem”: przewinięta fiszka (tryb Fiszki) jest warta 10× mniej niż odpowiedź
// wpisana albo wybrana w teście, a przewinięta szybciej niż w 1,5 s – nic. Stare wpisy (sprzed tej zmiany,
// bez pola m) liczą się po staremu, żeby nikomu nie zmalało saldo.
const FLIP_MIN_MS = 1500;
const studyPoints = l => !l.m ? 1 : l.m === 'flip' ? (l.ms >= FLIP_MIN_MS ? .1 : 0) : 1;                 // do celu dziennego
const studyGems = l => !l.m ? 0 : l.m === 'flip' ? (l.ms >= FLIP_MIN_MS ? .05 : 0) : ({ ok: .5, close: .3 }[l.v] ?? .1);   // 💎 za samą naukę
const QUIZ_GEM_CAP = 30;   // max 💎 dziennie z testów ABCD / pisemnych
function earnedCoins() {
  let c = Object.keys(S.ach).reduce((a, id) => a + (typeof achReward === 'function' ? achReward(id) : 30), 0);   // trudne osiągnięcia: 150
  const perDay = {}; let study = 0;
  for (const l of S.log) { const k = dayKey(l.t); perDay[k] = (perDay[k] || 0) + studyPoints(l); study += studyGems(l); }
  c += Object.values(perDay).filter(n => n >= (S.settings.goal || 50)).length * 20 + Math.floor(study);
  for (const g of S.games) if (!g.practice) c += Math.floor((g.correct || 0) / 4);
  for (const b of S.battles) c += battleReward(b);
  for (const r in SET_BONUS) if (setComplete(r)) c += SET_BONUS[r];
  return c;
}
function battleReward(b) { return b.bot ? ({ 1: 20, 0: 10, '-1': 5 }[b.won] || 0) : ({ 1: 50, 0: 25, '-1': 10 }[b.won] || 0); }
const coins = () => earnedCoins() + S.wallet.reduce((a, w) => a + w.n, 0);
function spend(n, why) {
  if (coins() < n) { toast(`Brakuje ${n - coins()} 💎`); return false; }
  S.wallet.push({ id: uid(), n: -n, why, t: Date.now() }); save(); return true;
}
const itemCount = (kind, key) => S.items.filter(i => i.kind === kind && i.key === key).reduce((a, i) => a + (i.q ?? 1), 0);
const hasItem = (kind, key) => itemCount(kind, key) > 0;
const addItem = (kind, key, q = 1, id = uid()) => { if (S.items.some(i => i.id === id)) return; S.items.push({ id, kind, key, q, t: Date.now() }); save(); };
const ownedStickers = () => [...new Set([...FREE_STICKERS, ...STICKERS.filter(s => hasItem('sticker', s.id) || hasItem('shiny', s.id)).map(s => s.id)])];
const stickerTile = (id, extra = '') => { const s = stickerById(id); if (!s) return ''; return `<span class="mini-st${isShiny(id) ? ' shiny' : ''}" style="--rc:${RARITY[s.r].color}" title="${esc(s.name)}"${extra}>${s.e}</span>`; };
const showcaseHTML = ids => (ids || []).filter(id => stickerById(id)).slice(0, 3).map(id => stickerTile(id)).join('');
const coinsHTML = () => `<span class="coins">💎 ${coins()}</span>`;

function rollRarity(odds) {
  let r = Math.random() * 100;
  for (const k of ['legendary', 'epic', 'rare', 'common']) { if (r < odds[k]) return k; r -= odds[k]; }
  return 'common';
}
const rollSticker = odds => { const r = rollRarity(odds), pool = STICKERS.filter(s => s.r === r); return pool[Math.random() * pool.length | 0]; };
// Poza naklejkami w skrzynce mogą wypaść kryształy (różne kwoty, rzadko „jackpot”) albo darmowe ponowne losowanie
const CASE_EXTRA = { gems: 20, respin: 7 };   // % szans
const GEM_PRIZES = { basic: [[20, 50], [50, 30], [100, 15], [300, 5]], epic: [[60, 50], [150, 30], [300, 15], [800, 5]], gif: [[40, 50], [100, 30], [200, 15], [500, 5]] };
const GIF_DUP = { common: 25, rare: 60, epic: 150, legendary: 400 };   // duplikat GIF-a zamienia się w kryształy
const gifCaseReady = () => typeof GIF_CASE !== 'undefined' && GIF_CASE.length > 0;
function rollGif(odds, force) {
  const have = r => GIF_CASE.some(g => (g.r || 'common') === r);
  let r = force && RARITY[force] && have(force) ? force : null;
  if (!r) { const o = Object.fromEntries(Object.entries(odds).filter(([x]) => have(x))), sum = Object.values(o).reduce((a, b) => a + b, 0);
    let y = Math.random() * sum; for (const [x, p] of Object.entries(o)) { if (y < p) { r = x; break; } y -= p; } r = r || Object.keys(o)[0]; }
  const pool = GIF_CASE.filter(g => (g.r || 'common') === r), g = pool[Math.random() * pool.length | 0];
  return { kind: 'gif', id: g.id, g, e: '🎞️', name: g.name || 'GIF', r };
}
function rollPrize(k, odds, force) {
  const x = Math.random() * 100;
  if (force === 'gems' || (!force && x < CASE_EXTRA.gems)) {
    const t = GEM_PRIZES[k] || GEM_PRIZES.basic; let y = Math.random() * 100;
    for (let i = 0; i < t.length; i++) { const [n, p] = t[i]; if (y < p || i === t.length - 1) return { kind: 'gems', id: 'gems' + n, n, e: '💎', name: `+${n} 💎`, r: ['common', 'rare', 'epic', 'legendary'][i] }; y -= p; }
  }
  if (force === 'respin' || (!force && x < CASE_EXTRA.gems + CASE_EXTRA.respin)) return { kind: 'respin', id: 'respin', e: '🔁', name: 'Jeszcze raz!', r: 'epic' };
  if (CASES[k]?.gif && gifCaseReady()) return rollGif(odds, force);
  return rollSticker(force && RARITY[force] ? { [force]: 100 } : odds);
}
const prizeTile = s => `<div class="tile${s.kind ? ' prize-' + s.kind : ''}" style="--rc:${RARITY[s.r].color}"><span>${s.kind === 'gif' ? gifImg(s.g) : s.e}</span><small>${esc(s.name)}</small></div>`;

// ---------- sklep
ROUTES.shop = () => {
  const freeKinds = Object.keys(CASES).filter(k => hasItem('case', k));
  const freeN = freeKinds.reduce((a, k) => a + itemCount('case', k), 0);
  const owned = STICKERS.filter(s => hasItem('sticker', s.id) || hasItem('shiny', s.id)).length;
  const showcase = S.profile.showcase || [];
  return { tab: 'train', html: `
  <div class="row nowrap"><button class="iconbtn" data-go="#/battles">‹</button><h1 class="grow">Sklep</h1>${coinsHTML()}</div>
  <details class="small muted shop-info"><summary>Skąd brać kryształy 💎?</summary>
    <p>Bitwy, osiągnięcia (30 💎, trudne 💀 150 💎), dni z celem dziennym (20 💎), zadania dnia, testy, gry pamięciowe – i skrzynki. 🌞 <b>Codzienna skrzynka</b> (lepsze szanse!) za ukończony zestaw fiszek albo cel dzienny.</p></details>
  ${freeN ? `<div class="banner row nowrap"><span class="grow">🎁 Masz <b>${freeN}</b> darmowe ${plural(freeN, 'skrzynkę', 'skrzynki', 'skrzynek')}: ${freeKinds.map(k => `${CASES[k].icon} ${CASES[k].name} ×${itemCount('case', k)}`).join(', ')}</span>
    <button class="primary sm" data-go="#/case/${freeKinds[0]}?free=1">Otwórz</button></div>` : ''}
  <div class="card"><h2 style="margin-top:0">Skrzynki z naklejkami</h2><div class="cases">${Object.entries(CASES).filter(([, c]) => !c.freeOnly && (!c.gif || gifCaseReady())).map(([k, c]) => `
    <div class="case ${k}"><div class="ci">${c.icon}</div><b>${c.name}</b>
      <div class="odds">${Object.entries(c.odds).map(([r, p]) => `<span style="color:${RARITY[r].color}">● ${RARITY[r].name} ${p}%</span>`).join('')}<span style="color:#0369a1">💎 do ${(GEM_PRIZES[k] || GEM_PRIZES.basic).at(-1)[0]} · 🔁 jeszcze raz</span></div>
      <button class="primary block" data-go="#/case/${k}">Otwórz · ${c.price} 💎</button></div>`).join('')}</div></div>
  <div class="card"><div class="row nowrap"><h2 class="grow" style="margin:0">Album naklejek</h2><span class="small muted">${owned}/${STICKERS.length}</span></div>
    <ul class="small muted perks"><li>Wysyłasz je przeciwnikowi w bitwie albo <b>podarujesz znajomemu</b> (💬 w rankingu). Stuknij naklejkę, żeby zobaczyć animację i usłyszeć jej dźwięk.</li>
      <li><b>3 duplikaty → złota wersja ✨</b> – błyszczy w albumie, profilu i bitwach.</li>
      <li>Wystaw do 3 naklejek w <b>gablocie</b> – widzą je znajomi w rankingu i przeciwnicy w bitwie.</li>
      <li>Komplet danej rzadkości daje premię: ${Object.entries(SET_BONUS).map(([r, v]) => `<span style="color:${RARITY[r].color}">${RARITY[r].name.toLowerCase()} +${v}💎${setComplete(r) ? ' ✓' : ''}</span>`).join(', ')}.</li></ul>
    <div class="row small showcase-row"><b class="grow">Gablota:</b><span class="showcase">${showcaseHTML(showcase) || '<span class="muted">pusta – stuknij ☆ przy naklejce</span>'}</span></div>
    <div class="album">${STICKERS.map(s => { const n = itemCount('sticker', s.id), sh = isShiny(s.id), have = n || sh, inSc = showcase.includes(s.id);
      return `<div class="stk ${s.r}${have ? '' : ' locked'}${sh ? ' shiny' : ''}" style="--rc:${RARITY[s.r].color}"><span${have ? ` data-act="st-preview" data-id="${s.id}" style="cursor:pointer" title="Stuknij – animacja i dźwięk"` : ''}>${have ? s.e : '❔'}</span><small>${have ? esc(s.name) + (sh ? ' ✨' : '') : RARITY[s.r].name}</small>
        ${have ? `<button class="sm ghost" data-act="showcase" data-id="${s.id}">${inSc ? '★ w gablocie' : '☆ do gabloty'}</button>` : ''}
        ${n >= 3 && !sh ? `<button class="sm primary" data-act="upgrade" data-id="${s.id}">✨ Ulepsz (3 szt.)</button>` : ''}
        ${n > 1 ? `<button class="sm ghost" data-act="sell-dup" data-id="${s.id}">×${n} · sprzedaj +${RARITY[s.r].sell}💎</button>` : ''}</div>`; }).join('')}</div></div>
  ${gifCaseReady() ? gifCollectionHTML() : ''}
  <div class="card"><h2 style="margin-top:0">Efekty zwycięstwa</h2><div class="effects">${EFFECTS.map(e => {
    const own = !e.price || hasItem('effect', e.id), on = (S.settings.effect || 'classic') === e.id;
    return `<button class="eff${on ? ' on' : ''}" data-act="effect" data-id="${e.id}"><span>${e.icon}</span><b>${e.name}</b><small>${on ? '✓ aktywny' : own ? 'wybierz' : e.price + ' 💎'}</small></button>`; }).join('')}</div></div>
  <div class="card"><h2 style="margin-top:0">Motywy premium</h2><div class="themes">${THEMES.filter(t => t.price).map(t => `<button class="theme" style="background:${t.bg};background-image:${t.image}" data-act="buy-theme" data-id="${t.id}">
    <span class="dot" style="background:${t.accent}"></span><b style="color:${lum(t.bg) < .18 ? '#fff' : '#1b1d29'}">${t.name}</b><small class="lock">${hasItem('theme', t.id) ? '✓ masz' : t.price + ' 💎'}</small></button>`).join('')}</div></div>` };
};

// ---------- otwieranie skrzynki (ruletka)
let SPIN = null;
ROUTES.case = (parts, q) => {
  const k = parts[1], c = CASES[k]; if (!c) return { html: '<a href="#/shop">Wróć</a>' };
  // tryb testowy (panel hosta): bez kosztu, nic nie trafia do albumu
  const test = q.get('test') && typeof hostUnlocked === 'function' && hostUnlocked() ? (RARITY[q.get('r')] || ['gems', 'respin'].includes(q.get('r')) ? q.get('r') : 'any') : '';
  const free = !test && q.get('free') && hasItem('case', k);
  if (!SPIN || SPIN.k !== k) SPIN = { k, phase: 'ready' };
  const tiles = (SPIN.strip || (SPIN.idle = SPIN.idle || Array.from({ length: 9 }, () => rollPrize(k, c.odds)))).map(prizeTile).join('');
  const won = SPIN.won;
  return { focus: true, html: `
  <div class="studybar"><button class="iconbtn" data-act="case-close">✕</button><div class="title">${c.icon} ${c.name}</div>${coinsHTML()}</div>
  <div class="roulette"><div class="marker"></div><div class="strip" id="strip">${tiles}</div></div>
  ${SPIN.phase === 'done' && won ? `<div class="card center reveal" style="--rc:${RARITY[won.r].color}">
      <div class="big-st${won.kind === 'gif' ? ' gifprize' : ''}">${won.kind === 'gif' ? gifImg(won.g) : won.e}</div><b style="font-size:22px">${won.kind === 'gems' ? `+${won.n} kryształów` : won.kind === 'respin' ? 'Losuj jeszcze raz!' : esc(won.name)}</b>
      <div style="color:${RARITY[won.r].color};font-weight:700">${won.kind === 'gems' ? (won.r === 'legendary' ? '💰 JACKPOT' : 'Kryształy') : won.kind === 'respin' ? 'Darmowe losowanie' : RARITY[won.r].name}</div>
      <p class="small muted">${SPIN.test ? '🧪 Tryb testowy – nic nie trafia na konto.' : won.kind === 'gems' ? 'Kryształy dodane do salda 💎' : won.kind === 'gif' ? (SPIN.dup ? `Masz już ten GIF – dostajesz +${GIF_DUP[won.r]} 💎.` : 'Nowy GIF w kolekcji! Ustaw go jako reakcję (Sklep → Moje GIF-y).') : won.kind === 'respin' ? 'Otwierasz tę skrzynkę jeszcze raz – za darmo!' : SPIN.dup ? `Duplikat – masz już ${itemCount('sticker', won.id)} szt. ${itemCount('sticker', won.id) >= 3 ? 'Możesz ją ulepszyć do złotej wersji ✨ w albumie!' : `Przy 3 sztukach ulepszysz ją do złotej ✨ (albo sprzedasz za ${RARITY[won.r].sell} 💎).`}` : 'Nowa naklejka w albumie! Wyślij ją w następnej bitwie.'}</p>
      <div class="row"><button class="primary grow${won.kind === 'respin' ? ' pulse' : ''}" data-act="case-again" data-k="${k}" data-test="${SPIN.test || ''}">${won.kind === 'respin' ? '🔁 Losuj jeszcze raz' : 'Otwórz kolejną'}</button><button class="grow" data-go="${SPIN.test ? '#/host' : '#/shop'}">${SPIN.test ? 'Panel hosta' : 'Album'}</button></div></div>`
    : `<div class="odds center"><span>💎 Kryształy ${CASE_EXTRA.gems}% (do ${(GEM_PRIZES[k] || GEM_PRIZES.basic).at(-1)[0]} 💎)</span> <span>🔁 Jeszcze raz ${CASE_EXTRA.respin}%</span><br>
       <small class="muted">Naklejki (${100 - CASE_EXTRA.gems - CASE_EXTRA.respin}%):</small> ${Object.entries(c.odds).map(([r, p]) => `<span style="color:${RARITY[r].color}">● ${RARITY[r].name} ${p}%</span>`).join(' ')}</div>
       <button class="primary block" data-act="case-spin" data-k="${k}" data-free="${free ? 1 : ''}" data-test="${test}" ${SPIN.phase === 'spinning' ? 'disabled' : ''} style="min-height:58px;font-size:18px">
       ${SPIN.phase === 'spinning' ? 'Losowanie…' : test ? '🧪 Otwórz testowo' : free ? '🎁 Otwórz za darmo' : c.freeOnly ? 'Brak skrzynki – ucz się codziennie 🌞' : `Otwórz za ${c.price} 💎`}</button>`}` };
};
let audioCtx;
function tick(freq = 1400, dur = .03, vol = .08) {
  if (S.settings.sound === false) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = freq; o.type = 'square';
    g.gain.setValueAtTime(vol, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + dur);
  } catch { /* brak dźwięku */ }
}
function spinCase(k, free, test) {
  const c = CASES[k];
  if (test) { /* pokaz: bez opłaty */ }
  else if (c.freeOnly && !free) return toast('Tę skrzynkę dostajesz za codzienną naukę');
  else if (free) { if (!hasItem('case', k)) return; addItem('case', k, -1); }
  else if (!spend(c.price, 'case-' + k)) return;
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch { /* */ }
  const sfx = typeof CASE_SFX !== 'undefined' ? CASE_SFX : null;
  if (sfx) { if (typeof fxUnlock === 'function') fxUnlock(); sfx.open(); }
  const won = rollPrize(k, c.odds, test && test !== 'any' ? test : null), WIN = 52;
  const strip = Array.from({ length: 60 }, (_, i) => i === WIN ? won : rollPrize(k, c.odds));
  SPIN = { k, phase: 'spinning', strip, won, dup: won.kind === 'gif' ? hasItem('gif', won.id) : !won.kind && hasItem('sticker', won.id), test };
  render();
  const el = $('#strip'), tile = el.firstElementChild.getBoundingClientRect().width + 8, box = el.parentElement.getBoundingClientRect().width;
  const target = WIN * tile + tile / 2 - box / 2 + (Math.random() - .5) * tile * .7;
  el.style.transition = 'none'; el.style.transform = 'translateX(0)';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.transition = 'transform 6.2s cubic-bezier(.06,.72,.12,1)'; el.style.transform = `translateX(${-target}px)`;
  }));
  let last = -1;
  const watch = () => {
    if (SPIN.phase !== 'spinning') return;
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform), idx = Math.floor((-m.m41 + box / 2) / tile);
    if (idx !== last) { last = idx; sfx ? sfx.tick(idx) : tick(1200 + Math.random() * 400); }
    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);
  setTimeout(() => {
    if (!test) {
      if (won.kind === 'gems') { S.wallet.push({ id: uid(), n: won.n, why: 'case-gems', t: Date.now() }); if (won.r === 'legendary') S.stats.jackpot = 1; }
      else if (won.kind === 'respin') addItem('case', k, 1, 'respin-' + uid());   // darmowa skrzynka tego samego rodzaju
      else if (won.kind === 'gif') { if (SPIN.dup) S.wallet.push({ id: uid(), n: GIF_DUP[won.r], why: 'gif-dup', t: Date.now() }); else addItem('gif', won.id); }
      else { addItem('sticker', won.id); if (won.r === 'legendary') S.stats.legendary = 1; }
      S.stats.cases = (S.stats.cases || 0) + 1;
    }
    SPIN.phase = 'done'; save(); render();
    const tr = $('#strip'); if (tr) { tr.style.transition = 'none'; tr.style.transform = `translateX(${-target}px)`; }
    if (sfx) sfx.reveal(won.r); else { tick(880, .15, .12); setTimeout(() => tick(1320, .25, .12), 120); }
    if (!won.kind && typeof playStickerSound === 'function') setTimeout(() => playStickerSound(won.id), won.r === 'legendary' ? 1700 : 900);
    if (won.kind === 'gems' && typeof FX !== 'undefined') setTimeout(() => { const ac = fxCtxGet(); if (ac) FX.sparkle(ac); }, 500);
    if (won.kind === 'respin') celebrate('🔁 Losuj jeszcze raz!', 'Darmowe ponowne otwarcie skrzynki');
    else if (won.kind === 'gems') { if (won.r === 'legendary' || won.r === 'epic') celebrate(`💎 +${won.n}!`, won.r === 'legendary' ? 'JACKPOT!' : 'Kryształy'); else confetti(50); }
    else if (won.r === 'legendary' || won.r === 'epic') celebrate(`${won.e} ${RARITY[won.r].name}!`, won.name); else confetti(50);
  }, 6400);
}

Object.assign(ACTIONS, {
  'case-spin': el => spinCase(el.dataset.k, !!el.dataset.free, el.dataset.test || ''),
  'case-again': el => { SPIN = null; const k = el.dataset.k, t = el.dataset.test;
    go(`#/case/${k}${t ? `?test=1${t !== 'any' ? '&r=' + t : ''}` : hasItem('case', k) ? '?free=1' : ''}`); render(); },
  'case-close': () => { if (SPIN?.phase === 'spinning') return; const t = SPIN?.test; SPIN = null; go(t ? '#/host' : '#/shop'); },
  upgrade: el => {
    const s = stickerById(el.dataset.id); if (itemCount('sticker', s.id) < 3) return;
    addItem('sticker', s.id, -3); addItem('shiny', s.id); S.stats.shiny = (S.stats.shiny || 0) + 1; save();
    celebrate(`✨ Złota naklejka: ${s.e} ${s.name}`, 'Błyszczy w albumie, profilu i bitwach'); render();
  },
  showcase: el => {
    const id = el.dataset.id, sc = S.profile.showcase || [];
    S.profile.showcase = sc.includes(id) ? sc.filter(x => x !== id) : [...sc, id].slice(-3);
    S.profile.mod = Date.now(); save(); render();
  },
  'sell-dup': el => {
    const s = stickerById(el.dataset.id); if (itemCount('sticker', s.id) < 2) return;
    addItem('sticker', s.id, -1); S.wallet.push({ id: uid(), n: RARITY[s.r].sell, why: 'sell-' + s.id, t: Date.now() }); save();
    toast(`Sprzedano ${s.e} za ${RARITY[s.r].sell} 💎`); render();
  },
  effect: el => {
    const e = EFFECTS.find(x => x.id === el.dataset.id);
    if (e.price && !hasItem('effect', e.id)) { if (!confirm(`Kupić efekt „${e.name}” za ${e.price} 💎?`) || !spend(e.price, 'effect-' + e.id)) return; addItem('effect', e.id); }
    S.settings.effect = e.id; save(); render(); confetti(90);
  },
  'buy-theme': el => {
    const t = THEMES.find(x => x.id === el.dataset.id);
    if (!hasItem('theme', t.id)) { if (!confirm(`Kupić motyw „${t.name}” za ${t.price} 💎?`) || !spend(t.price, 'theme-' + t.id)) return; addItem('theme', t.id); }
    S.settings.theme = { id: t.id, bg: t.bg, accent: t.accent, image: t.image }; applyTheme(); save(); render(); confetti(90);
  },
});

// ---------- Moje GIF-y (ze skrzynki z GIF-ami)
function gifCollectionHTML() {
  const own = GIF_CASE.filter(g => hasItem('gif', g.id)), cfg = S.settings.reactions || {};
  return `<div class="card"><div class="row nowrap"><h2 class="grow" style="margin:0">🎞️ Moje GIF-y</h2><span class="small muted">${own.length}/${GIF_CASE.length}</span></div>
    <p class="small muted">Wylosuj je w skrzynce z GIF-ami i ustaw jako reakcję: 🏆 po wygranej bitwie, ✅ po zestawie fiszek, 🎯 po celu dziennym.</p>
    <div class="gifgrid">${GIF_CASE.map(g => { const have = hasItem('gif', g.id), r = g.r || 'common';
      return `<div class="gifitem${have ? '' : ' locked'}" style="--rc:${RARITY[r].color}">${have ? gifImg(g) : '<div class="giflock">🔒</div>'}
        <small><b>${have ? esc(g.name || 'GIF') : '???'}</b> · <span style="color:${RARITY[r].color}">${RARITY[r].name}</span></small>
        ${have ? `<div class="row nowrap gifuse">${Object.keys(REACT_SLOTS).map(k => `<button class="sm${cfg[k]?.gid === g.id ? ' primary' : ''}" data-act="gif-use" data-id="${g.id}" data-k="${k}" title="${esc(REACT_SLOTS[k].name)}">${REACT_SLOTS[k].name.split(' ')[0]}</button>`).join('')}</div>` : ''}</div>`; }).join('')}</div></div>`;
}
Object.assign(ACTIONS, {
  'gif-use': async el => {
    const k = el.dataset.k, id = el.dataset.id, c = (S.settings.reactions = S.settings.reactions || {});
    c[k] = { ...(c[k] || {}) };
    if (c[k].gid === id) { delete c[k].gid; save(); render(); return toast('Przywrócono poprzednią reakcję'); }
    c[k].gid = id; c[k].on = true;
    if (RX[k]) { await DB.del('gif:' + k); URL.revokeObjectURL(RX[k].url); delete RX[k]; }   // własny plik zasłaniałby GIF z kolekcji
    save(); render(); showReaction(k, true);
  },
});

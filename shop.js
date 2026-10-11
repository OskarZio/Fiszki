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
const CASES = {
  basic: { name: 'Skrzynka nauki', icon: '📦', price: 120, odds: { common: 70, rare: 22, epic: 6.5, legendary: 1.5 } },
  epic: { name: 'Skrzynka mistrza', icon: '🎁', price: 350, odds: { common: 38, rare: 36, epic: 20, legendary: 6 } },
  daily: { name: 'Codzienna skrzynka', icon: '🌞', price: 0, odds: { common: 45, rare: 33, epic: 16, legendary: 6 }, freeOnly: true },
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
function earnedCoins() {
  let c = Object.keys(S.ach).length * 30;
  const perDay = {}; for (const l of S.log) { const k = dayKey(l.t); perDay[k] = (perDay[k] || 0) + 1; }
  c += Object.values(perDay).filter(n => n >= (S.settings.goal || 50)).length * 20;
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

// ---------- sklep
ROUTES.shop = () => {
  const freeKinds = Object.keys(CASES).filter(k => hasItem('case', k));
  const freeN = freeKinds.reduce((a, k) => a + itemCount('case', k), 0);
  const owned = STICKERS.filter(s => hasItem('sticker', s.id) || hasItem('shiny', s.id)).length;
  const showcase = S.profile.showcase || [];
  return { tab: 'train', html: `
  <div class="row nowrap"><button class="iconbtn" data-go="#/battles">‹</button><h1 class="grow">Sklep</h1>${coinsHTML()}</div>
  <p class="small muted" style="margin-top:-6px">Kryształy zdobywasz za bitwy, osiągnięcia (30 💎), dni z osiągniętym celem (20 💎) i gry pamięciowe.</p>
  ${freeN ? `<div class="banner row nowrap"><span class="grow">🎁 Masz <b>${freeN}</b> darmowe ${plural(freeN, 'skrzynkę', 'skrzynki', 'skrzynek')}: ${freeKinds.map(k => `${CASES[k].icon} ${CASES[k].name} ×${itemCount('case', k)}`).join(', ')}</span>
    <button class="primary sm" data-go="#/case/${freeKinds[0]}?free=1">Otwórz</button></div>` : ''}
  <p class="small muted">🌞 <b>Codzienna skrzynka</b> (lepsze szanse!) – za ukończenie jednego zestawu fiszek albo celu dziennego każdego dnia.</p>
  <div class="card"><h2 style="margin-top:0">Skrzynki z naklejkami</h2><div class="cases">${Object.entries(CASES).filter(([, c]) => !c.freeOnly).map(([k, c]) => `
    <div class="case ${k}"><div class="ci">${c.icon}</div><b>${c.name}</b>
      <div class="odds">${Object.entries(c.odds).map(([r, p]) => `<span style="color:${RARITY[r].color}">● ${RARITY[r].name} ${p}%</span>`).join('')}</div>
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
  const test = q.get('test') && typeof hostUnlocked === 'function' && hostUnlocked() ? (RARITY[q.get('r')] ? q.get('r') : 'any') : '';
  const free = !test && q.get('free') && hasItem('case', k);
  if (!SPIN || SPIN.k !== k) SPIN = { k, phase: 'ready' };
  const tiles = SPIN.strip ? SPIN.strip.map(s => `<div class="tile" style="--rc:${RARITY[s.r].color}"><span>${s.e}</span><small>${esc(s.name)}</small></div>`).join('')
    : Array.from({ length: 9 }, () => { const s = STICKERS[Math.random() * STICKERS.length | 0]; return `<div class="tile" style="--rc:${RARITY[s.r].color}"><span>${s.e}</span><small>${esc(s.name)}</small></div>`; }).join('');
  const won = SPIN.won;
  return { focus: true, html: `
  <div class="studybar"><button class="iconbtn" data-act="case-close">✕</button><div class="title">${c.icon} ${c.name}</div>${coinsHTML()}</div>
  <div class="roulette"><div class="marker"></div><div class="strip" id="strip">${tiles}</div></div>
  ${SPIN.phase === 'done' && won ? `<div class="card center reveal" style="--rc:${RARITY[won.r].color}">
      <div class="big-st">${won.e}</div><b style="font-size:22px">${esc(won.name)}</b><div style="color:${RARITY[won.r].color};font-weight:700">${RARITY[won.r].name}</div>
      <p class="small muted">${SPIN.test ? '🧪 Tryb testowy – naklejka nie trafia do albumu.' : SPIN.dup ? `Duplikat – masz już ${itemCount('sticker', won.id)} szt. ${itemCount('sticker', won.id) >= 3 ? 'Możesz ją ulepszyć do złotej wersji ✨ w albumie!' : `Przy 3 sztukach ulepszysz ją do złotej ✨ (albo sprzedasz za ${RARITY[won.r].sell} 💎).`}` : 'Nowa naklejka w albumie! Wyślij ją w następnej bitwie.'}</p>
      <div class="row"><button class="primary grow" data-act="case-again" data-k="${k}" data-test="${SPIN.test || ''}">Otwórz kolejną</button><button class="grow" data-go="${SPIN.test ? '#/host' : '#/shop'}">${SPIN.test ? 'Panel hosta' : 'Album'}</button></div></div>`
    : `<div class="odds center">${Object.entries(c.odds).map(([r, p]) => `<span style="color:${RARITY[r].color}">● ${RARITY[r].name} ${p}%</span>`).join(' ')}</div>
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
  const won = rollSticker(test && test !== 'any' ? { [test]: 100 } : c.odds), WIN = 52;
  const strip = Array.from({ length: 60 }, (_, i) => i === WIN ? won : rollSticker(c.odds));
  SPIN = { k, phase: 'spinning', strip, won, dup: hasItem('sticker', won.id), test };
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
      addItem('sticker', won.id); S.stats.cases = (S.stats.cases || 0) + 1;
      if (won.r === 'legendary') S.stats.legendary = 1;
    }
    SPIN.phase = 'done'; save(); render();
    const tr = $('#strip'); if (tr) { tr.style.transition = 'none'; tr.style.transform = `translateX(${-target}px)`; }
    if (sfx) sfx.reveal(won.r); else { tick(880, .15, .12); setTimeout(() => tick(1320, .25, .12), 120); }
    if (typeof playStickerSound === 'function') setTimeout(() => playStickerSound(won.id), won.r === 'legendary' ? 1700 : 900);
    if (won.r === 'legendary' || won.r === 'epic') celebrate(`${won.e} ${RARITY[won.r].name}!`, won.name); else confetti(50);
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

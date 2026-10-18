'use strict';
/* Motywacja: XP i poziomy, osiągnięcia (z konfetti), serie poprawnych odpowiedzi
   oraz ranking ze znajomymi publikowany przez prywatny GitHub Gist. */

// ============================================================ Awatar (emoji albo własne zdjęcie)
const safeImg = u => typeof u === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(u) && u.length < 60000 ? u : null;
function avatarHTML(p, size = 28) {
  const img = safeImg(p?.avatarImg);
  return img ? `<img class="avimg" src="${img}" alt="" style="width:${size}px;height:${size}px">` : `<span class="avemoji" style="font-size:${Math.round(size * .9)}px">${esc(p?.avatar || '🦊')}</span>`;
}
async function squareAvatar(blob, px = 128) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(img.naturalWidth, img.naturalHeight), c = document.createElement('canvas'); c.width = c.height = px;
    c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, px, px);
    return c.toDataURL('image/jpeg', .75);
  } finally { URL.revokeObjectURL(url); }
}

// ============================================================ XP i poziomy
function xpTotal() {
  let xp = 0;
  for (const l of S.log) xp += l.n ? 3 : l.g > 1 ? 2 : 1;
  for (const g of S.games) xp += Math.round((g.correct || 0) / 2);
  xp += Object.keys(S.ach).length * 25;
  for (const b of S.battles || []) xp += b.won === 1 ? 30 : 10;
  return xp;
}
const levelOf = xp => Math.floor((1 + Math.sqrt(1 + xp / 10)) / 2);   // próg poziomu n: 40·n·(n−1) XP
const levelStart = n => 40 * n * (n - 1);
const LEVEL_TITLES = ['Nowicjusz', 'Uczeń', 'Pilny uczeń', 'Bystrzak', 'Erudyta', 'Znawca', 'Ekspert', 'Mistrz pamięci', 'Wielki mistrz', 'Arcymistrz', 'Legenda'];
const levelTitle = n => LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor((n - 1) / 3))];

// ============================================================ Osiągnięcia
function achContext() {
  const perDay = {};
  for (const l of S.log) { const k = dayKey(l.t); perDay[k] = (perDay[k] || 0) + 1; }
  const days = Object.values(perDay), goal = S.settings.goal || 50;
  const best = d => Math.max(0, ...S.games.filter(g => g.d === d && g.correct === g.n && !g.practice).map(g => g.n));
  return {
    reviews: S.log.length, bestDay: Math.max(0, ...days), goalDays: days.filter(n => n >= goal).length, streak: streak(),
    cards: S.cards.length, mature: S.cards.filter(c => c.srs.ivl >= 21).length,
    palaces: S.palaces.length, pins: S.palaces.reduce((a, p) => a + p.stations.reduce((b, s) => b + s.pins.length, 0), 0),
    topics: S.topics.length, materials: S.topics.reduce((a, t) => a + t.items.length, 0),
    games: S.games.length, disciplines: new Set(S.games.map(g => g.d)).size,
    numbers: best('numbers'), words: best('words'), images: best('images'), pcards: best('cards'),
    major: Object.values(S.major.words || {}).filter(w => w && w.trim()).length,
    friends: S.friends.length, ...S.stats, ...hardContext(),
  };
}
// dane do trudnych osiągnięć (naklejki, bitwy, kryształy…) – liczone z historii, więc działają też wstecz
function hardContext() {
  const st = typeof STICKERS !== 'undefined' ? STICKERS : [], has = id => typeof hasItem === 'function' && (hasItem('sticker', id) || hasItem('shiny', id));
  const shiny = st.filter(x => typeof isShiny === 'function' && isShiny(x.id));
  const b = S.battles || [];
  return {
    stickersOwned: st.filter(x => has(x.id)).length,
    legendsOwned: st.filter(x => x.r === 'legendary' && has(x.id)).length,
    shinyCount: shiny.length, shinyLegend: shiny.some(x => x.r === 'legendary') ? 1 : 0,
    elo: typeof myElo === 'function' ? myElo() : 1000,
    perfectBattle: b.filter(x => x.mode === 'cards' && x.won === 1 && x.n >= 10 && x.my === x.n && !x.bot).length,
    perfectAbcd: b.filter(x => x.abcd && x.won === 1 && x.n >= 10 && x.my === x.n).length,
    typedOk: S.log.filter(l => l.m === 'type' && l.v === 'ok').length,
    questDays: (S.wallet || []).filter(w => /^q-.*-all$/.test(w.id)).length,
    gemsEarned: (typeof earnedCoins === 'function' ? earnedCoins() : 0) + (S.wallet || []).filter(w => w.n > 0).reduce((a, w) => a + w.n, 0),
    events: (S.events || []).length,
    others: Object.keys(S.ach).filter(k => k !== 'platinum').length,
  };
}
const A = (id, icon, name, desc, v, goal, hard) => ({ id, icon, name, desc, v, goal, hard: !!hard, reward: hard ? 150 : 30 });
const H = (id, icon, name, desc, v, goal) => A(id, icon, name, desc, v, goal, true);
const ACHIEVEMENTS = [
  A('first_review', '🌱', 'Pierwszy krok', 'Zrób pierwszą powtórkę', c => c.reviews, 1),
  A('rev_100', '💯', 'Setka', '100 powtórek', c => c.reviews, 100),
  A('rev_500', '📈', 'Pięćsetka', '500 powtórek', c => c.reviews, 500),
  A('rev_1000', '🏅', 'Tysiącznik', '1000 powtórek', c => c.reviews, 1000),
  A('rev_5000', '🏆', 'Maszyna do nauki', '5000 powtórek', c => c.reviews, 5000),
  A('rev_10000', '👑', 'Legenda', '10 000 powtórek', c => c.reviews, 10000),
  A('day_50', '⚡', 'Rozgrzewka', '50 powtórek jednego dnia', c => c.bestDay, 50),
  A('day_200', '🚀', 'Maraton', '200 powtórek jednego dnia', c => c.bestDay, 200),
  A('goal_1', '🎯', 'W punkt', 'Osiągnij cel dzienny', c => c.goalDays, 1),
  A('goal_7', '🏹', 'Snajper', 'Cel dzienny osiągnięty 7 razy', c => c.goalDays, 7),
  A('goal_30', '🎖️', 'Systematyczny', 'Cel dzienny osiągnięty 30 razy', c => c.goalDays, 30),
  A('streak_3', '🔥', 'Iskra', '3 dni nauki z rzędu', c => c.streak, 3),
  A('streak_7', '🔥', 'Tydzień ognia', '7 dni z rzędu', c => c.streak, 7),
  A('streak_30', '☄️', 'Miesiąc bez przerwy', '30 dni z rzędu', c => c.streak, 30),
  A('streak_100', '🌋', 'Nie do zatrzymania', '100 dni z rzędu', c => c.streak, 100),
  A('streak_365', '☀️', 'Cały rok', '365 dni z rzędu', c => c.streak, 365),
  A('combo_10', '✨', 'Na fali', '10 poprawnych odpowiedzi z rzędu', c => c.combo || 0, 10),
  A('combo_50', '💫', 'Perfekcjonista', '50 poprawnych z rzędu', c => c.combo || 0, 50),
  A('cards_10', '✏️', 'Twórca', 'Miej 10 fiszek', c => c.cards, 10),
  A('cards_100', '📦', 'Kolekcjoner', '100 fiszek', c => c.cards, 100),
  A('cards_1000', '🗄️', 'Biblioteka', '1000 fiszek', c => c.cards, 1000),
  A('mature_10', '🌳', 'Długa pamięć', '10 kart opanowanych (odstęp ≥ 21 dni)', c => c.mature, 10),
  A('mature_100', '🌲', 'Las wiedzy', '100 kart opanowanych', c => c.mature, 100),
  A('mature_500', '🏔️', 'Góra wiedzy', '500 kart opanowanych', c => c.mature, 500),
  A('early', '🌅', 'Ranny ptaszek', 'Powtórka przed 7:00', c => c.early || 0, 1),
  A('night', '🦉', 'Nocny marek', 'Powtórka po 23:00', c => c.night || 0, 1),
  A('quiz_perfect', '🧪', 'Bezbłędnie', 'Test na 100% (min. 10 pytań)', c => c.quizPerfect || 0, 1),
  A('palace_1', '🏰', 'Architekt', 'Zbuduj pierwszy pałac pamięci', c => c.palaces, 1),
  A('pins_20', '📍', 'Mapa skojarzeń', '20 pinezek w pałacach', c => c.pins, 20),
  A('topic_1', '📚', 'Porządek', 'Utwórz pierwszy temat', c => c.topics, 1),
  A('materials_10', '🗂️', 'Zbieracz wiedzy', '10 materiałów w tematach', c => c.materials, 10),
  A('anki', '🔁', 'Przeprowadzka', 'Zaimportuj talię z Anki', c => c.ankiImport || 0, 1),
  A('ai', '🤖', 'Z asystentem', 'Utwórz fiszki z AI', c => c.aiCards || 0, 1),
  A('game_1', '🎮', 'Gracz', 'Zagraj w grę pamięciową', c => c.games, 1),
  A('game_all', '🎲', 'Wszechstronny', 'Zagraj we wszystkie 4 dyscypliny', c => c.disciplines, 4),
  A('games_50', '🕹️', 'Trening czyni mistrza', '50 rozegranych gier', c => c.games, 50),
  A('numbers_20', '🔢', 'Liczby I', 'Bezbłędnie 20 cyfr', c => c.numbers, 20),
  A('numbers_40', '🔢', 'Liczby II', 'Bezbłędnie 40 cyfr', c => c.numbers, 40),
  A('numbers_80', '🧮', 'Liczby – liga', 'Bezbłędnie 80 cyfr', c => c.numbers, 80),
  A('words_25', '📝', 'Słowa', 'Bezbłędnie 25 słów', c => c.words, 25),
  A('images_30', '🖼️', 'Obrazy', 'Bezbłędnie 30 obrazów', c => c.images, 30),
  A('cards_52', '🃏', 'Cała talia', 'Bezbłędnie 52 karty', c => c.pcards, 52),
  A('major_100', '🔟', 'System liczbowy', 'Uzupełnij obrazy 00–99', c => c.major, 100),
  A('friend_1', '🤝', 'Razem raźniej', 'Dodaj znajomego do rankingu', c => c.friends, 1),
  A('rank_1', '🥇', 'Lider dnia', 'Bądź pierwszy w dziennym rankingu', c => c.rankFirst || 0, 1),
  A('battle_1', '⚔️', 'Pierwsza krew', 'Wygraj pierwszą bitwę', c => c.battleWins || 0, 1),
  A('battle_10', '🛡️', 'Wojownik', 'Wygraj 10 bitew', c => c.battleWins || 0, 10),
  A('battle_50', '🗡️', 'Gladiator', 'Wygraj 50 bitew', c => c.battleWins || 0, 50),
  A('winstreak_3', '🌪️', 'Passa', '3 wygrane bitwy z rzędu', c => c.winStreak || 0, 3),
  A('cases_10', '📦', 'Hazardzista wiedzy', 'Otwórz 10 skrzynek', c => c.cases || 0, 10),
  A('legendary', '🌟', 'Legenda w albumie', 'Wylosuj legendarną naklejkę', c => c.legendary || 0, 1),
  A('daily_7', '📅', 'Codzienny rytuał', 'Zdobądź 7 codziennych skrzynek', c => c.dailyCases || 0, 7),
  A('shiny_1', '✨', 'Błyszczy!', 'Ulepsz naklejkę do wersji złotej', c => c.shiny || 0, 1),
  A('saboteur', '🧊', 'Sabotażysta', 'Użyj 10 sabotaży w bitwach', c => c.sabUsed || 0, 10),
  // ---- 💀 trudne (po 150 💎)
  H('album_full', '🗂️', 'Komplet albumu', 'Zdobądź wszystkie naklejki', c => c.stickersOwned, typeof STICKERS !== 'undefined' ? STICKERS.length : 37),
  H('legends_all', '🌌', 'Panteon', 'Zdobądź wszystkie legendarne naklejki', c => c.legendsOwned, 4),
  H('shiny_10', '💛', 'Skarbiec', 'Miej 10 złotych naklejek', c => c.shinyCount, 10),
  H('shiny_legend', '👑', 'Złota legenda', 'Ulepsz legendarną naklejkę do złotej', c => c.shinyLegend, 1),
  H('cases_100', '🎰', 'Nałogowiec skrzynek', 'Otwórz 100 skrzynek', c => c.cases || 0, 100),
  H('jackpot', '💰', 'Jackpot!', 'Wylosuj najwyższą pulę kryształów w skrzynce', c => c.jackpot || 0, 1),
  H('gems_5000', '🤑', 'Krezus', 'Zarób łącznie 5000 💎', c => c.gemsEarned, 5000),
  H('battle_100', '🐉', 'Niezwyciężony', 'Wygraj 100 bitew', c => c.battleWins || 0, 100),
  H('winstreak_10', '⚡', 'Burza', '10 wygranych bitew z rzędu', c => c.winStreak || 0, 10),
  H('elo_1500', '🥇', 'Mistrz areny', 'Osiągnij 1500 Elo', c => c.elo, 1500),
  H('elo_2000', '💠', 'Arcymistrz', 'Osiągnij 2000 Elo', c => c.elo, 2000),
  H('perfect_battle', '🎯', 'Bez skazy', 'Wygraj bitwę z człowiekiem (min. 10 fiszek) bez żadnego błędu', c => c.perfectBattle, 1),
  H('perfect_abcd', '🅰️', 'Quiz idealny', 'Wygraj quiz ABCD (min. 10 pytań) bez błędu', c => c.perfectAbcd, 1),
  H('typed_1000', '⌨️', 'Pióro mistrza', '1000 poprawnie wpisanych odpowiedzi', c => c.typedOk, 1000),
  H('quests_30', '📋', 'Sumienny', 'Zalicz komplet zadań dnia 30 razy', c => c.questDays, 30),
  H('rev_25000', '🧬', 'Nieśmiertelna pamięć', '25 000 powtórek', c => c.reviews, 25000),
  H('day_500', '🏃', 'Ultramaraton', '500 powtórek jednego dnia', c => c.bestDay, 500),
  H('mature_1000', '📚', 'Encyklopedia', '1000 kart opanowanych', c => c.mature, 1000),
  H('streak_200', '🌞', 'Żelazna wola', '200 dni nauki z rzędu', c => c.streak, 200),
  H('numbers_160', '🧠', 'Liczby – mistrz świata', 'Bezbłędnie 160 cyfr', c => c.numbers, 160),
  H('gifts_10', '🎁', 'Hojne serce', 'Podaruj znajomym 10 naklejek', c => c.giftsSent || 0, 10),
];
// Platyna: wszystkie pozostałe osiągnięcia
ACHIEVEMENTS.push(H('platinum', '🏆', 'Platyna', 'Zdobądź wszystkie pozostałe osiągnięcia', c => c.others, ACHIEVEMENTS.length));
const achReward = id => ACHIEVEMENTS.find(a => a.id === id)?.reward || 30;

let achTimer, lastLevel = null;
function checkAchievements(quiet) {
  const ctx = achContext(), fresh = [];
  for (const a of ACHIEVEMENTS) if (!S.ach[a.id] && a.v(ctx) >= a.goal) { S.ach[a.id] = Date.now(); fresh.push(a); }
  const lvl = levelOf(xpTotal());
  const levelUp = lastLevel != null && lvl > lastLevel; lastLevel = lvl;
  if (fresh.length) { DB.set('state', S); }
  if (quiet) return;
  if (fresh.length === 1) celebrate(`${fresh[0].hard ? '💀 ' : ''}${fresh[0].icon} ${fresh[0].name}`, `${fresh[0].desc} · +${fresh[0].reward} 💎`);
  else if (fresh.length > 1) celebrate(`🏆 ${fresh.length} nowe osiągnięcia!`, fresh.map(a => a.icon + ' ' + a.name).join(' · '));
  else if (levelUp) celebrate(`⭐ Poziom ${lvl}!`, levelTitle(lvl));
}
on('save', () => { clearTimeout(achTimer); achTimer = setTimeout(() => checkAchievements(false), 600); });
on('start', () => { lastLevel = levelOf(xpTotal()); checkAchievements(false); });

// serie poprawnych odpowiedzi + „+XP” w trakcie nauki
let combo = 0;
on('review', (c, g, wasNew) => {
  const h = new Date().getHours();
  if (h < 7 && h >= 4) S.stats.early = 1;
  if (h >= 23 || h < 4) S.stats.night = 1;
  combo = g >= 3 ? combo + 1 : 0;
  S.stats.combo = Math.max(S.stats.combo || 0, combo);
  const xp = wasNew ? 3 : g > 1 ? 2 : 1;
  floatText(`+${xp} XP${combo >= 5 ? `  🔥×${combo}` : ''}`, combo >= 10 && combo % 10 === 0);
  // cel dzienny liczony w punktach nauki (przewijanie 10× mniej) – przekroczenie progu tą powtórką
  const goal = S.settings.goal || 50, pf = typeof studyPoints === 'function' ? studyPoints : () => 1;
  const pts = S.log.filter(l => l.t >= dayStart()).reduce((a, l) => a + pf(l), 0), last = S.log[S.log.length - 1];
  if (pts >= goal && pts - (last ? pf(last) : 1) < goal) { emit('goal'); setTimeout(() => celebrate('🎯 Cel dzienny osiągnięty!', `${goal} pkt nauki – świetna robota!`), 300); grantDailyCase(); }
});
on('sessionEnd', s => { combo = 0; if (!s.cram && s.done >= 5) grantDailyCase(); if (s.done >= 10) setTimeout(() => confetti(80), 200); });
// Codzienna skrzynka: raz dziennie za ukończony zestaw (sesję) albo cel dzienny
function grantDailyCase() {
  if (typeof addItem !== 'function') return;
  const id = 'daily-' + dayKey(Date.now());
  if (S.items.some(i => i.id === id)) return;
  addItem('case', 'daily', 1, id);
  S.stats.dailyCases = (S.stats.dailyCases || 0) + 1;
  setTimeout(() => celebrate('🎁 Codzienna skrzynka!', 'Za dzisiejszą naukę – otwórz ją w sklepie'), 1500);
}
on('quiz', (pct, total) => { if (pct === 100 && total >= 10) { S.stats.quizPerfect = 1; save(); } if (pct >= 90) confetti(60); });
on('ankiImport', () => { S.stats.ankiImport = 1; save(); });
on('aiCards', n => { S.stats.aiCards = (S.stats.aiCards || 0) + n; save(); });

// ============================================================ Efekty
const quiet = () => S.settings.minimal || !S.settings.anim;
function floatText(text, big) {
  if (quiet()) return;
  const el = document.createElement('div'); el.className = 'floatxp' + (big ? ' big' : ''); el.textContent = text;
  document.body.append(el); setTimeout(() => el.remove(), 1300);
}
function celebrate(title, sub) {
  emit('celebrate');
  if (S.settings.minimal) return;
  confetti(140);
  const el = document.createElement('div'); el.className = 'celebrate';
  el.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
  el.onclick = () => el.remove();
  document.body.append(el); setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 4200);
}
function confetti(n = 120) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || quiet()) return;
  const cv = $('#confetti'); if (!cv) return;
  const ctx = cv.getContext('2d'), W = cv.width = innerWidth * devicePixelRatio, H = cv.height = innerHeight * devicePixelRatio;
  const colors = ['#4f46e5', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];
  const eff = typeof EFFECTS !== 'undefined' && EFFECTS.find(e => e.id === S.settings.effect && e.chars);
  const ps = Array.from({ length: n }, () => ({ x: W / 2 + (Math.random() - .5) * W * .3, y: H * .35, vx: (Math.random() - .5) * 18 * devicePixelRatio,
    vy: (-Math.random() * 18 - 6) * devicePixelRatio, s: (4 + Math.random() * 6) * devicePixelRatio, r: Math.random() * 6, c: colors[Math.random() * colors.length | 0] }));
  cv.style.display = 'block'; const t0 = performance.now();
  (function frame(t) {
    ctx.clearRect(0, 0, W, H);
    for (const p of ps) { p.vy += .5 * devicePixelRatio; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += .1;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      if (eff) { ctx.font = `${p.s * 3}px serif`; ctx.fillText(p.ch || (p.ch = eff.chars[Math.random() * eff.chars.length | 0]), 0, 0); }
      else { ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); }
      ctx.restore(); }
    if (t - t0 < 2600) requestAnimationFrame(frame); else { ctx.clearRect(0, 0, W, H); cv.style.display = 'none'; }
  })(t0);
}

// ============================================================ Start: poziom, osiągnięcia, ranking
function homeExtrasHTML() {
  if (S.settings.minimal) return '';
  const xp = xpTotal(), lvl = levelOf(xp), a = levelStart(lvl), b = levelStart(lvl + 1);
  const got = Object.keys(S.ach).length;
  const mine = rankRows().find(r => r.me), pos = mine ? rankRows().sort((x, y) => y.today - x.today).indexOf(mine) + 1 : 0;
  return `<div class="card tight">
    <div class="row nowrap" style="gap:14px"><span class="lvl">${lvl}</span>
      <div class="grow"><div class="row small nowrap" style="margin-bottom:10px"><b class="grow nickrow" data-go="#/more" style="cursor:pointer">${avatarHTML(S.profile, 26)}<span class="nm nk">${esc(S.profile.nick || 'Ty')}</span><span class="nm lt">· ${levelTitle(lvl)}</span></b><span class="muted">${xp - a}/${b - a} XP</span></div>
      ${progress((xp - a) / (b - a), true)}</div></div>
    <div class="spacer"></div>
    <div class="row"><button class="sm grow primary" data-go="#/battles">⚔️ Bitwa</button><button class="sm grow" data-go="#/shop">💎 ${typeof coins === 'function' ? coins() : 0}</button></div>
    <div class="spacer"></div>
    <div class="row"><button class="sm grow" data-go="#/ach">🏆 Osiągnięcia ${got}/${ACHIEVEMENTS.length}</button>
      <button class="sm grow" data-go="#/rank">👥 Ranking${S.friends.length ? ` · ${pos ? pos + '. miejsce' : ''}` : ''}</button></div>
  </div>`;
}

ROUTES.ach = () => {
  const ctx = achContext(), got = ACHIEVEMENTS.filter(a => S.ach[a.id]);
  const xp = xpTotal(), lvl = levelOf(xp);
  return { tab: 'home', html: `
  <div class="row nowrap"><button class="iconbtn" data-go="#/">‹</button><h1 class="grow">Osiągnięcia</h1></div>
  <div class="card center"><div class="lvl big">${lvl}</div><b>${levelTitle(lvl)}</b><p class="small muted">${xp} XP · do poziomu ${lvl + 1}: ${levelStart(lvl + 1) - xp} XP</p>
    <p class="small muted">XP: 1 za powtórkę, 2 za poprawną, 3 za nową kartę, punkty z gier i 25 za każde osiągnięcie.</p>
    ${progress(got.length / ACHIEVEMENTS.length)}<p class="small">${got.length} z ${ACHIEVEMENTS.length} odblokowanych</p></div>
  ${[['', ACHIEVEMENTS.filter(a => !a.hard)], ['💀 Trudne osiągnięcia · po 150 💎', ACHIEVEMENTS.filter(a => a.hard)]].map(([title, list]) => `${title ? `<h2 style="margin:22px 0 4px">${title}</h2><p class="small muted" style="margin:0 0 10px">Zdobyte ${list.filter(a => S.ach[a.id]).length} z ${list.length}. Na prawdziwych kolekcjonerów i mistrzów.</p>` : ''}
  <div class="badges">${list.map(a => {
    const done = !!S.ach[a.id], cur = Math.min(a.goal, a.v(ctx));
    return `<div class="badge${done ? ' on' : ''}${a.hard ? ' hard' : ''}"><div class="bi">${a.icon}</div><b>${esc(a.name)}</b><small>${esc(a.desc)}</small>${a.hard ? '<small class="hardtag">💀 +150 💎</small>' : ''}
      ${done ? `<small class="c-rev">✓ ${new Date(S.ach[a.id]).toLocaleDateString('pl')}</small>` : a.goal > 1 ? `${progress(cur / a.goal, true)}<small>${cur}/${a.goal}</small>` : ''}</div>`;
  }).join('')}</div>`).join('')}` };
};

// ============================================================ Ranking
const PROFILE_DESC = 'Fiszki – profil do rankingu';
const APP_URL = () => location.href.split('#')[0];
let FRIEND_DATA = {}, publishAt = 0;

function myProfile() {
  const perDay = {}, perMin = {}; const since = addDays(dayStart(), -13);
  for (const l of S.log) if (l.t >= since) { const k = dayKey(l.t); perDay[k] = (perDay[k] || 0) + 1; perMin[k] = (perMin[k] || 0) + Math.min(60000, l.ms || 0) / MIN; }
  for (const l of S.tlog || []) if (l.t >= since) { const k = dayKey(l.t); perMin[k] = (perMin[k] || 0) + Math.min(60000, l.ms || 0) / MIN; }
  for (const k in perMin) perMin[k] = Math.round(perMin[k] * 10) / 10;
  const week = Object.entries(perDay).filter(([k]) => k >= dayKey(addDays(dayStart(), -6))).reduce((a, [, n]) => a + n, 0);
  const xp = xpTotal();
  const best = {}; for (const g of S.games) if (g.correct > (best[g.d] || 0)) best[g.d] = g.correct;
  return { app: 'fiszki-profil', v: 1, nick: S.profile.nick || 'Anonim', avatar: S.profile.avatar || '🦊', avatarImg: safeImg(S.profile.avatarImg), level: levelOf(xp), xp, elo: typeof myElo === 'function' ? myElo() : 1000,
    streak: streak(), day: dayKey(Date.now()), today: reviewsToday(), week, perDay, perMin, total: S.log.length, cards: S.cards.length,
    mature: S.cards.filter(c => c.srs.ivl >= 21).length, ach: Object.keys(S.ach).length, best, showcase: S.profile.showcase || [], updated: Date.now() };
}
async function publishProfile(force) {
  const cfg = S.settings.sync;
  if (!cfg.token || (!force && Date.now() - publishAt < 60e3)) return;
  publishAt = Date.now();
  const files = { 'fiszki-profil.json': { content: JSON.stringify(myProfile()) } };
  let id = cfg.profileId;
  if (!id) { const f = (await gh('/gists?per_page=100')).find(g => g.description === PROFILE_DESC); id = f?.id; }
  if (id) { try { await gh('/gists/' + id, { method: 'PATCH', body: JSON.stringify({ files }) }); } catch (e) { if (e.message !== '404') throw e; id = null; } }
  if (!id) id = (await gh('/gists', { method: 'POST', body: JSON.stringify({ description: PROFILE_DESC, public: false, files }) })).id;
  if (cfg.profileId !== id) { cfg.profileId = id; save(); }
  return id;
}
async function fetchProfile(id) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (S.settings.sync.token) headers.Authorization = 'Bearer ' + S.settings.sync.token;
  const r = await fetch('https://api.github.com/gists/' + encodeURIComponent(id), { headers });
  if (!r.ok) throw new Error(r.status === 404 ? 'nie znaleziono profilu' : 'GitHub ' + r.status);
  const f = (await r.json()).files['fiszki-profil.json'];
  if (!f) throw new Error('to nie jest profil Fiszek');
  const data = JSON.parse(await gistText(f));
  if (data.app !== 'fiszki-profil') throw new Error('to nie jest profil Fiszek');
  return data;
}
async function refreshFriends() {
  await Promise.all(S.friends.map(async f => {
    try { FRIEND_DATA[f.code] = { ...(await fetchProfile(f.code)), ok: true }; } catch (e) { FRIEND_DATA[f.code] = { ...(FRIEND_DATA[f.code] || {}), err: e.message }; }
  }));
  DB.set('friendsCache', FRIEND_DATA);
  const rows = rankRows().sort((x, y) => y.today - x.today);
  if (rows.length > 1 && rows[0].me && rows[0].today > 0 && !S.stats.rankFirst) { S.stats.rankFirst = 1; save(); }
}
on('start', async () => { FRIEND_DATA = (await DB.get('friendsCache')) || {}; });
on('synced', () => publishProfile(false).catch(e => console.warn('profil', e)));

function friendCode(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/friend\/([0-9a-f]{20,40})/i) || s.match(/gist\.github\.com\/(?:[^/]+\/)?([0-9a-f]{20,40})/i) || s.match(/^([0-9a-f]{20,40})$/i);
  return m ? m[1].toLowerCase() : null;
}
function rankRows() {
  const today = dayKey(Date.now()), weekFrom = dayKey(addDays(dayStart(), -6));
  const norm = p => {
    const per = p.perDay || {};
    const week = Object.entries(per).filter(([k]) => k >= weekFrom && k <= today).reduce((a, [, n]) => a + n, 0);
    const weekMin = Object.entries(p.perMin || {}).filter(([k]) => k >= weekFrom && k <= today).reduce((a, [, n]) => a + (+n || 0), 0);
    const lastDay = Object.keys(per).sort().pop();
    const streakAlive = p.day === today || lastDay === dayKey(addDays(dayStart(), -1)) || lastDay === today;
    return { weekMin, nick: p.nick, avatar: p.avatar, avatarImg: p.avatarImg, elo: +p.elo || 1000, today: p.day === today ? p.today : (per[today] || 0), week, streak: streakAlive ? p.streak : 0, level: p.level || 1, xp: p.xp || 0, total: p.total || 0, updated: p.updated, ach: p.ach || 0, showcase: p.showcase || [] };
  };
  const me = { ...norm(myProfile()), me: true };
  const rows = S.friends.map(f => FRIEND_DATA[f.code]?.app ? { ...norm(FRIEND_DATA[f.code]), id: f.id, err: FRIEND_DATA[f.code].err } : { nick: f.name || 'Znajomy', avatar: '❔', id: f.id, today: 0, week: 0, streak: 0, level: 0, xp: 0, err: FRIEND_DATA[f.code]?.err || 'brak danych' });
  return [me, ...rows];
}
let RANK_TAB = 'today', rankLoaded = 0;
ROUTES.rank = () => {
  const hasToken = !!S.settings.sync.token;
  if (hasToken && Date.now() - rankLoaded > 60e3) {
    rankLoaded = Date.now();
    Promise.all([publishProfile(true).catch(e => toast('Profil: ' + e.message, 3000)), refreshFriends()]).then(() => { if (parseRoute().parts[0] === 'rank') render(); });
  }
  const tabs = [['today', 'Dziś'], ['week', 'Tydzień'], ['time', '⏱ Czas'], ['streak', 'Seria'], ['xp', 'Poziom'], ['elo', 'Elo']];
  const val = r => RANK_TAB === 'time' ? `⏱ ${fmtDur((r.weekMin || 0) * MIN)} <small>w tym tyg.</small>` : RANK_TAB === 'today' ? `${r.today} <small>powt.</small>` : RANK_TAB === 'week' ? `${r.week} <small>powt.</small>` : RANK_TAB === 'streak' ? `🔥 ${r.streak}` : RANK_TAB === 'elo' ? eloHTML(r.elo || 1000) : `⭐ ${r.level} <small>${r.xp} XP</small>`;
  const key = r => RANK_TAB === 'xp' ? r.xp : RANK_TAB === 'elo' ? (r.elo || 1000) : RANK_TAB === 'time' ? r.weekMin || 0 : r[RANK_TAB];
  const rows = rankRows().sort((a, b) => key(b) - key(a));
  const medal = i => ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
  const maxToday = Math.max(1, ...rows.map(r => r.today));
  const code = S.settings.sync.profileId;
  return { tab: 'home', html: `
  <div class="row nowrap"><button class="iconbtn" data-go="#/">‹</button><h1 class="grow">Ranking</h1>${hasToken ? '<button class="iconbtn" data-act="rank-refresh">🔄</button>' : ''}</div>
  <div class="seg" style="display:flex">${tabs.map(([k, l]) => `<button class="grow ${RANK_TAB === k ? 'on' : ''}" data-act="rank-tab" data-k="${k}">${l}</button>`).join('')}</div>
  <div class="card">${rows.map((r, i) => `<div class="rankrow${r.me ? ' me' : ''}">
      <span class="medal">${medal(i)}</span><span class="av">${avatarHTML(r, 34)}</span>
      <div class="grow"><div class="row nowrap"><b class="grow nickrow"><span class="nm">${esc(r.nick)}</span>${r.me ? '<span>(Ty)</span>' : ''}${typeof showcaseHTML === 'function' ? `<span>${showcaseHTML(r.showcase)}</span>` : ''}</b><span>${val(r)}</span></div>
        ${RANK_TAB === 'today' ? progress(r.today / maxToday, true) : ''}
        <div class="small muted">${r.err ? '⚠️ ' + esc(r.err) : r.me ? `poziom ${r.level} · 🔥 ${r.streak} · ${r.total} powtórek łącznie` : `poziom ${r.level} · 🔥 ${r.streak} · aktualizacja ${ago(r.updated)}`}</div></div>
      ${r.me ? '' : `<button class="ghost sm" data-act="friend-del" data-id="${r.id}">✕</button>`}</div>`).join('')}
    ${S.friends.length ? '' : '<p class="muted small center">Dodaj znajomych, żeby się porównywać 💪</p>'}</div>
  <div class="card">
    <h3 style="margin-top:0">Twój profil</h3>
    <div class="row nowrap"><span class="av-big">${avatarHTML(S.profile, 56)}</span>
      <button class="sm" data-act="avatar-photo">📷 Zdjęcie</button>${S.profile.avatarImg ? '<button class="sm ghost" data-act="avatar-clear">Użyj emoji</button>' : ''}</div>
    <div class="spacer"></div>
    <div class="row nowrap"><input id="pr-avatar" value="${esc(S.profile.avatar)}" style="width:64px;text-align:center;font-size:24px" maxlength="4" title="Emoji (gdy nie masz zdjęcia)">
      <input id="pr-nick" class="grow" value="${esc(S.profile.nick)}" placeholder="Twój nick" maxlength="24"></div>
    ${hasToken ? `
      <div class="spacer"></div>
      <button class="primary block" data-act="invite" ${code ? '' : 'disabled'}>📤 Zaproś znajomego</button>
      <p class="small muted">${code ? `Twój kod: <code style="word-break:break-all">${code}</code>` : 'Tworzę Twój profil…'}</p>
      <h3>Dodaj znajomego</h3>
      <div class="row nowrap"><input id="friend-code" class="grow" placeholder="Wklej kod lub link od znajomego"><button data-act="friend-add">Dodaj</button></div>
      <p class="small muted">Ranking pokazuje tylko liczby (powtórki, serię, poziom) – Twoje fiszki pozostają prywatne. Znajomy też musi mieć aplikację i połączone konto GitHub.</p>`
    : `<p class="small muted">Ranking działa przez Twoje konto GitHub – to samo, którego używasz do synchronizacji telefonu i komputera. Dodaj token w zakładce Więcej, a potem wróć tutaj.</p>
      <button class="block" data-go="#/more">🔑 Połącz z GitHub</button>`}
  </div>` };
};
ROUTES.friend = parts => {
  const code = friendCode(parts[1]);
  if (code) setTimeout(() => addFriend(code), 50);
  return ROUTES.rank();
};
async function addFriend(code) {
  if (!code) return toast('Nieprawidłowy kod znajomego', 3000);
  if (code === S.settings.sync.profileId) return toast('To Twój własny kod 🙂');
  if (S.friends.some(f => f.code === code)) { toast('Ten znajomy już jest w rankingu'); return go('#/rank'); }
  try {
    const p = await fetchProfile(code);
    if (!confirm(`Dodać ${p.avatar} ${p.nick} (poziom ${p.level}) do rankingu?`)) return go('#/rank');
    S.friends.push(touch({ id: uid(), code, name: p.nick })); FRIEND_DATA[code] = { ...p, ok: true }; save();
    toast(`Dodano ${p.nick} ✓`); go('#/rank');
  } catch (e) { toast('Nie udało się dodać: ' + e.message, 4000); go('#/rank'); }
}
// Karta profilu (awatar ze zdjęcia lub emoji + nick) – na górze zakładki „Więcej”
function profileCardHTML() {
  onMount(mountRank);
  return `<div class="card"><h2 style="margin-top:0">👤 Profil</h2>
    <div class="row nowrap"><span class="av-big" data-act="avatar-photo" style="cursor:pointer">${avatarHTML(S.profile, 64)}</span>
      <div class="grow"><input id="pr-nick" value="${esc(S.profile.nick)}" placeholder="Twój nick" maxlength="24"></div></div>
    <div class="spacer"></div>
    <div class="row"><button class="primary sm" data-act="avatar-photo">📷 ${S.profile.avatarImg ? 'Zmień zdjęcie' : 'Dodaj zdjęcie'}</button>
      ${S.profile.avatarImg ? '<button class="sm ghost" data-act="avatar-clear">Usuń zdjęcie</button>' : ''}
      <span class="grow"></span><label class="small muted">emoji <input id="pr-avatar" value="${esc(S.profile.avatar)}" style="width:56px;text-align:center;font-size:20px;padding:6px" maxlength="4"></label></div>
    <p class="small muted">Awatar widać na stronie głównej, w rankingu i w bitwach. Zdjęcie jest przycinane do kwadratu.</p></div>`;
}
function mountRank() {
  const upd = () => { S.profile.nick = $('#pr-nick').value.trim(); S.profile.avatar = $('#pr-avatar').value.trim() || '🦊'; S.profile.mod = Date.now(); save(); publishAt = 0; };
  $('#pr-nick')?.addEventListener('change', upd); $('#pr-avatar')?.addEventListener('change', upd);
}
const _rankRoute = ROUTES.rank;
ROUTES.rank = (...a) => { onMount(mountRank); return _rankRoute(...a); };

Object.assign(ACTIONS, {
  'rank-tab': el => { RANK_TAB = el.dataset.k; render(); },
  'avatar-photo': async () => {
    const f = await pickFile('image/*'); if (!f) return;
    try { S.profile.avatarImg = await squareAvatar(f); S.profile.mod = Date.now(); publishAt = 0; save(); render(); toast('Zdjęcie profilowe ustawione ✓'); }
    catch { toast('Nie udało się wczytać zdjęcia'); }
  },
  'avatar-clear': () => { S.profile.avatarImg = null; S.profile.mod = Date.now(); publishAt = 0; save(); render(); },
  'rank-refresh': () => { rankLoaded = 0; toast('Odświeżam…'); render(); },
  'friend-add': () => addFriend(friendCode($('#friend-code').value)),
  'friend-del': el => {
    const f = S.friends.find(x => x.id === el.dataset.id);
    if (!confirm(`Usunąć ${f?.name || 'znajomego'} z rankingu?`)) return;
    S.friends = S.friends.filter(x => x.id !== el.dataset.id); S.tomb[el.dataset.id] = Date.now(); save(); render();
  },
  invite: async () => {
    const url = APP_URL() + '#/friend/' + S.settings.sync.profileId;
    const text = `Uczę się w Fiszkach 🧠 Dołącz i rywalizuj ze mną w rankingu! ${url}`;
    if (navigator.share) { try { await navigator.share({ title: 'Fiszki', text, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(text); toast('Skopiowano zaproszenie – wyślij je znajomemu'); } catch { prompt('Skopiuj i wyślij znajomemu:', url); }
  },
});

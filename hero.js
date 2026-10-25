'use strict';
/* 🧙 Bohater (RPG): poziom i doświadczenie, postacie z własną umiejętnością bierną, superciosem (ultem) i własnym drzewkiem,
   ekwipunek (broń, hełm na głowie, pancerz, talizman) z rzadkościami do mitycznych, mikstury i power-upy, boostery,
   serca (przegrana walka zabiera serce – odzyskasz je z czasem albo nauką), prestiż = ewolucja postaci.
   Doświadczenie: trochę z walk, więcej z nauki (nowe fiszki, cały rozdział, cała talia). */

const hashStr = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const HERO_MAX = 20;
const HERO_DEF = () => ({ xp: 0, sk: {}, eq: {}, forge: {}, look: 1 + (Math.random() * 1e6 | 0), line: 'cat', g: Math.random() < .5 ? 'w' : 'm', pr: 0, boost: {}, mod: 0, lives: { n: 3, t: Date.now() } });
function hero() {
  const h = S.hero = S.hero || HERO_DEF();
  // migracje: dawne płaskie drzewko (s1…m4) → drzewka postaci; hełm z pancerza → na głowę
  if (h.sk && Object.keys(h.sk).some(k => /^[stm]\d$/.test(k))) h.sk = {};
  if (h.eq?.a === 'a_helmet') { h.eq.h = 'h_helmet'; delete h.eq.a; }
  S.items.forEach(i => { if (i.kind === 'gear' && i.key === 'a_helmet') i.key = 'h_helmet'; });
  if (!h.lives) h.lives = { n: 3, t: Date.now() };
  return h;
}
const heroLvAt = xp => { let l = 1; const need = l => Math.round(60 * Math.pow(l, 1.7)); while (l < HERO_MAX && xp >= need(l)) { xp -= need(l); l++; } return { lv: l, cur: l >= HERO_MAX ? 1 : xp, need: l >= HERO_MAX ? 1 : need(l), max: l >= HERO_MAX }; };
const heroLv = () => heroLvAt(hero().xp).lv;
const PR_TITLES = ['Nowicjusz', 'Adept', 'Mistrz', 'Arcymistrz', 'Legenda', 'Mityczny', 'Nieśmiertelny'];

// ---------- 🎭 postacie: umiejętność bierna + supercios + drzewko (3 gałęzie × 4 węzły)
// efekty węzłów (sumują się): dmg %, crit %, hp, def %, dodge %, regen (❤️ za dobrą odp.), second (drugie życie), type/abcd (mnożnik trybu),
// steady („Ledwo” nie przerywa serii), alch (mikstury), loot (+przedmiot), ultFast (szybszy ult), ultPow %, time % (czas do namysłu),
// verify % (bonus za sprawdzian), vamp % (leczenie z obrażeń), first (pierwszy cios ×), exec % (boss < 25%), combo % (seria), xp %, gems %, ice (łatwiej rozbić lód), thorns % (odbicie)
const SKN = (id, name, desc, eff, v) => ({ id, name, desc, eff, v });
const LINES = {
  cat: { passive: ['🐾 Koci refleks', '10% szans na unik ataku', { dodge: 10 }], ult: ['😼 Dziewięć żyć', 'cios ×3 i leczy 30% ❤️'],
    tree: [['🗡️ Pazury', [SKN('c1', 'Ostre pazury', '+12% obrażeń', 'dmg', 12), SKN('c2', 'Skok na cel', 'pierwszy cios ×2', 'first', 2), SKN('c3', 'Krwawe drapnięcie', '+12% krytyka', 'crit', 12), SKN('c4', 'Dobicie', 'boss < 25% ❤️ → +50%', 'exec', 50)]],
      ['💤 Drzemka', [SKN('c5', 'Mruczenie', '+25 ❤️', 'hp', 25), SKN('c6', 'Kocia regeneracja', 'dobra odpowiedź leczy 3 ❤️', 'regen', 3), SKN('c7', 'Spadanie na 4 łapy', '−12% obrażeń', 'def', 12), SKN('c8', 'Dziewiąte życie', 'raz na walkę przeżyjesz z 1 ❤️', 'second', 1)]],
      ['✨ Ciekawość', [SKN('c9', 'Nadstawione uszy', '+30% czasu do namysłu', 'time', 30), SKN('c10', 'Kot uczony', 'sprawdzian bossa: bonus +50%', 'verify', 50), SKN('c11', 'Szybki ult', 'supercios ładuje się szybciej', 'ultFast', 1), SKN('c12', 'Kocia magia', 'supercios +40%', 'ultPow', 40)]]] },
  frog: { passive: ['👅 Długi język', 'wpisywanie: cios ×1,2 więcej', { type: .2 }], ult: ['🐸 Język-lasso', 'cios ×3,5, zrywa tarczę i leczy 15 ❤️'],
    tree: [['🌊 Staw', [SKN('f1', 'Śliska skóra', '+8% uniku', 'dodge', 8), SKN('f2', 'Kumkanie', '+20 ❤️', 'hp', 20), SKN('f3', 'Wilgoć', 'dobra odpowiedź leczy 2 ❤️', 'regen', 2), SKN('f4', 'Rechot odwetu', 'odbija 20% obrażeń', 'thorns', 20)]],
      ['⌨️ Słowa', [SKN('f5', 'Pisarz z bagien', 'wpisywanie: cios +25%', 'type', .25), SKN('f6', 'Literówka? Nie', '+10% krytyka', 'crit', 10), SKN('f7', 'Słownik', 'sprawdzian: bonus +60%', 'verify', 60), SKN('f8', 'Mistrz pióra', 'wpisywanie: cios +35%', 'type', .35)]],
      ['🪷 Skok', [SKN('f9', 'Daleki skok', '+15% obrażeń', 'dmg', 15), SKN('f10', 'Seria skoków', 'seria rośnie +50% szybciej', 'combo', 50), SKN('f11', 'Wielki skok', 'supercios ładuje się szybciej', 'ultFast', 1), SKN('f12', 'Żabi król', 'supercios +50%', 'ultPow', 50)]]] },
  dog: { passive: ['🦴 Wytrzymałość', '+25 ❤️ na start', { hp: 25 }], ult: ['🐶 Wierny kumpel', 'cios ×2,5 i blokuje 3 kolejne ataki'],
    tree: [['🛡️ Stróż', [SKN('d1', 'Gruba skóra', '+30 ❤️', 'hp', 30), SKN('d2', 'Szczek ostrzegawczy', '−15% obrażeń', 'def', 15), SKN('d3', 'Lizanie ran', 'dobra odpowiedź leczy 3 ❤️', 'regen', 3), SKN('d4', 'Nie poddam się', 'drugie życie raz na walkę', 'second', 1)]],
      ['🎾 Aport', [SKN('d5', 'Szybki aport', '+12% obrażeń', 'dmg', 12), SKN('d6', 'Węch', '+8% krytyka', 'crit', 8), SKN('d7', 'Spokój', '„Ledwo” nie przerywa serii', 'steady', 1), SKN('d8', 'Pogoń', 'seria rośnie +60% szybciej', 'combo', 60)]],
      ['🏅 Medal', [SKN('d9', 'Dobry piesek', '+15% doświadczenia', 'xp', 15), SKN('d10', 'Kopanie', '+1 przedmiot w skrzyni', 'loot', 1), SKN('d11', 'Merdanie', 'supercios ładuje się szybciej', 'ultFast', 1), SKN('d12', 'Najlepszy przyjaciel', 'supercios +40%', 'ultPow', 40)]]] },
  owl: { passive: ['🌙 Nocny marek', '+35% czasu do namysłu', { time: 35 }], ult: ['🦉 Nocna mądrość', 'cios ×2,5, boss traci 2 tury, lód i robaki znikają'],
    tree: [['📚 Wiedza', [SKN('o1', 'Oczytanie', '+12% obrażeń', 'dmg', 12), SKN('o2', 'Pewność', 'sprawdzian: bonus +80%', 'verify', 80), SKN('o3', 'Kujon', '+20% doświadczenia', 'xp', 20), SKN('o4', 'Profesor', 'boss < 25% ❤️ → +60%', 'exec', 60)]],
      ['🪶 Lot', [SKN('o5', 'Ciche skrzydła', '+10% uniku', 'dodge', 10), SKN('o6', 'Bystre oko', '+12% krytyka', 'crit', 12), SKN('o7', 'Wysoki lot', '+25% czasu do namysłu', 'time', 25), SKN('o8', 'Pióra', 'lód pęka 2× szybciej', 'ice', 1)]],
      ['🔮 Mądrość', [SKN('o9', 'Test ABCD', 'ABCD: cios ×0,7 zamiast ×0,5', 'abcd', .2), SKN('o10', 'Spokój nocy', '„Ledwo” nie przerywa serii', 'steady', 1), SKN('o11', 'Olśnienie', 'supercios ładuje się szybciej', 'ultFast', 1), SKN('o12', 'Sowa mędrczyni', 'supercios +50%', 'ultPow', 50)]]] },
  hamster: { passive: ['🌰 Chomikowanie', '+20% doświadczenia', { xp: 20 }], ult: ['🎡 Kołowrotek', '4 szybkie ciosy (razem ×3,6) i seria +3'],
    tree: [['🌻 Zapasy', [SKN('h1', 'Pełne policzki', '+20 ❤️', 'hp', 20), SKN('h2', 'Ziarenko', '+10% 💎 z walk', 'gems', 10), SKN('h3', 'Spiżarnia', '+1 przedmiot w skrzyni', 'loot', 1), SKN('h4', 'Skarbiec', '+20% 💎 z walk', 'gems', 20)]],
      ['🏃 Bieg', [SKN('h5', 'Truchcik', 'seria rośnie +50% szybciej', 'combo', 50), SKN('h6', 'Rozpęd', '+12% obrażeń', 'dmg', 12), SKN('h7', 'Zwinne łapki', '+8% uniku', 'dodge', 8), SKN('h8', 'Turbo', 'pierwszy cios ×2,5', 'first', 2.5)]],
      ['🧪 Alchemia', [SKN('h9', 'Kieszonkowiec', 'mikstury mocniejsze, +1 użycie', 'alch', 1), SKN('h10', 'Przekąska', 'dobra odpowiedź leczy 2 ❤️', 'regen', 2), SKN('h11', 'Chomiczy zapał', 'supercios ładuje się szybciej', 'ultFast', 1), SKN('h12', 'Wielki kołowrotek', 'supercios +50%', 'ultPow', 50)]]] },
  fox: { passive: ['🦊 Przebiegłość', '+8% krytyka', { crit: 8 }], ult: ['🔥 Lisi spryt', 'pewny krytyk ×4, usuwa przeszkadzajki i truciznę'],
    tree: [['🗡️ Zasadzka', [SKN('x1', 'Z ukrycia', 'pierwszy cios ×2,5', 'first', 2.5), SKN('x2', 'Ostry ząb', '+12% krytyka', 'crit', 12), SKN('x3', 'Szybkie łapy', '+12% obrażeń', 'dmg', 12), SKN('x4', 'Polowanie', 'boss < 25% ❤️ → +60%', 'exec', 60)]],
      ['🌲 Las', [SKN('x5', 'Ruda kita', '+10% uniku', 'dodge', 10), SKN('x6', 'Nora', '−12% obrażeń', 'def', 12), SKN('x7', 'Wampirzy kęs', '10% obrażeń wraca jako ❤️', 'vamp', 10), SKN('x8', 'Kontra', 'odbija 25% obrażeń', 'thorns', 25)]],
      ['🎲 Fortel', [SKN('x9', 'Chytry plan', '+1 przedmiot w skrzyni', 'loot', 1), SKN('x10', 'Pułapka', 'ABCD: cios ×0,7 zamiast ×0,5', 'abcd', .2), SKN('x11', 'Lisi ogień', 'supercios ładuje się szybciej', 'ultFast', 1), SKN('x12', 'Dziewięć ogonów', 'supercios +60%', 'ultPow', 60)]]] },
  beast: { passive: ['🐲 Dzikość', '+10% obrażeń', { dmg: 10 }], ult: ['💥 Ryk bestii', 'cios ×4,5 (kosztuje 10 ❤️)'],
    tree: [['💢 Furia', [SKN('b1', 'Kły', '+15% obrażeń', 'dmg', 15), SKN('b2', 'Szał', 'seria rośnie +60% szybciej', 'combo', 60), SKN('b3', 'Rozszarpanie', '+12% krytyka', 'crit', 12), SKN('b4', 'Rzeź', 'boss < 25% ❤️ → +70%', 'exec', 70)]],
      ['🪨 Łuska', [SKN('b5', 'Twarda łuska', '+30 ❤️', 'hp', 30), SKN('b6', 'Kolce', 'odbija 25% obrażeń', 'thorns', 25), SKN('b7', 'Krew bestii', '12% obrażeń wraca jako ❤️', 'vamp', 12), SKN('b8', 'Odrodzenie', 'drugie życie raz na walkę', 'second', 1)]],
      ['🌋 Pradawna moc', [SKN('b9', 'Instynkt', '+20% czasu do namysłu', 'time', 20), SKN('b10', 'Łowca', '+1 przedmiot w skrzyni', 'loot', 1), SKN('b11', 'Gniew', 'supercios ładuje się szybciej', 'ultFast', 1), SKN('b12', 'Kataklizm', 'supercios +50%', 'ultPow', 50)]]] },
};
// pozostałe postacie z heroes.js (gdyby doszły nowe) dostają drzewko kota
const CHAR_LINES = { ...Object.fromEntries(Object.entries(typeof CHARS !== 'undefined' ? CHARS : {}).map(([k, c]) => [k, { name: c.name, icon: c.icon, forms: c.forms, desc: c.desc, draw: true }])),
  beast: { name: 'Stworek', icon: '🐣', forms: ['Pisklę', 'Stworek', 'Bestia', 'Legenda'], desc: 'Losowy, jedyny taki potworek.' } };
const heroLine = (h = hero()) => CHAR_LINES[h.line] ? h.line : 'cat';
const lineDef = (l = heroLine()) => LINES[l] || LINES.cat;
const heroForm = (h = hero(), pr = h.pr || 0) => Math.min(3, pr);
const heroFormName = (h = hero()) => CHAR_LINES[heroLine(h)].forms[heroForm(h)];
const SK_REQ_LV = [1, 4, 8, 13];   // od którego poziomu można kupić 1., 2., 3., 4. węzeł gałęzi
const lineSk = (h = hero(), l = heroLine(h)) => (h.sk[l] = h.sk[l] || {});
const hasNode = id => !!lineSk()[id];
// suma efektu: węzły drzewka obecnej postaci + umiejętność bierna
function skVal(eff) {
  const L = lineDef(), own = lineSk();
  let v = L.passive[2][eff] || 0;
  for (const [, nodes] of L.tree) for (const n of nodes) if (own[n.id] && n.eff === eff) v += n.v;
  return v;
}
const hasSk = eff => skVal(eff) > 0;
const skPoints = () => heroLv() + (hero().pr || 0) - Object.keys(lineSk()).length;

// ---------- ⏱️ boostery: 30 min; w weekend „Podwójne XP” za darmo, co 3 dni darmowy booster do odebrania
const BOOSTS = { xp2: { name: 'Podwójne XP', desc: 'doświadczenie bohatera ×2', img: 'b_star', price: 150 }, gems2: { name: 'Podwójne kryształy', desc: '💎 z bossów i łupów ×2', img: 'b_gstar', price: 200 }, loot2: { name: 'Szczęście łupieżcy', desc: '+1 przedmiot w każdej skrzyni', img: 'b_swords', price: 200 } };
const BOOST_MS = 30 * 60000;
const isWeekend = () => [0, 6].includes(new Date().getDay());
const boostOn = k => (k === 'xp2' && isWeekend()) || (hero().boost?.[k] || 0) > Date.now();
const boostLeft = k => Math.max(0, (hero().boost?.[k] || 0) - Date.now());
const gemMul = () => boostOn('gems2') ? 2 : 1;
const xpMul = () => (boostOn('xp2') ? 2 : 1) * (1 + skVal('xp') / 100) * (1 + .1 * (hero().pr || 0));
function activateBoost(k) {
  if (itemCount('boost', k) < 1) return;
  const h = hero(); h.boost = h.boost || {}; addItem('boost', k, -1);
  h.boost[k] = Math.max(Date.now(), h.boost[k] || 0) + BOOST_MS; h.mod = Date.now(); save();
  toast(`⏱️ ${BOOSTS[k].name} aktywne przez ${Math.round(boostLeft(k) / 60000)} min`); render();
}
const boostChips = () => [isWeekend() ? '<span class="boost-chip">🎉 Weekend: podwójne XP</span>' : '',
  ...Object.keys(BOOSTS).filter(k => boostLeft(k) > 0).map(k => `<span class="boost-chip">${BOOSTS[k].name} · ${Math.ceil(boostLeft(k) / 60000)} min</span>`)].join('');
const FREE_BOOST_DAYS = 3;
const freeBoostKey = () => 'freeboost-' + Math.floor(Date.now() / (FREE_BOOST_DAYS * DAY));
const freeBoostReady = () => !S.items.some(i => i.id === freeBoostKey());
function claimFreeBoost() {
  if (!freeBoostReady()) return;
  const ks = Object.keys(BOOSTS), k = ks[Math.random() * ks.length | 0];
  addItem('boost', k, 1, freeBoostKey()); toast(`🎁 Darmowy booster: ${BOOSTS[k].name} – włącz, kiedy chcesz`); render();
}

// ---------- ❤️ serca: przegrana walka zabiera serce; 1 serce wraca co 2 h albo za 15 powtórek nauki
const LIVES_MAX = 3, LIFE_MS = 2 * HOUR, LIFE_REV = 15;
function lives() {
  const L = hero().lives;
  if (L.n >= LIVES_MAX) { L.t = Date.now(); return L; }
  const k = Math.floor((Date.now() - L.t) / LIFE_MS); if (k > 0) { L.n = Math.min(LIVES_MAX, L.n + k); L.t += k * LIFE_MS; }
  return L;
}
const livesHTML = () => { const L = lives(); return `<span class="lives" title="Serca: przegrana walka zabiera serce. Wracają co 2 h albo za ${LIFE_REV} powtórek.">${'❤️'.repeat(L.n)}${'🖤'.repeat(LIVES_MAX - L.n)}${L.n < LIVES_MAX ? `<small>+1 za ${fmtLeft(LIFE_MS - (Date.now() - L.t))}</small>` : ''}</span>`; };
const fmtLeft = ms => { const m = Math.max(1, Math.ceil(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
function loseLife() { const L = lives(); L.n = Math.max(0, L.n - 1); if (L.n === LIVES_MAX - 1) L.t = Date.now(); hero().mod = Date.now(); }

// ---------- 🎒 ekwipunek: broń, hełm (na głowie postaci), pancerz, talizman · rzadkości aż do mitycznych
const SLOT_NAME = { w: 'Broń', h: 'Hełm', a: 'Pancerz', c: 'Talizman' };
const GR = (slot, name, r, img, st, desc) => ({ slot, name, r, img, ...st, ...(desc ? { desc } : {}) });
const GEAR = {
  w_dagger: GR('w', 'Sztylet zakuwacza', 'common', 'g_dagger', { atk: 8 }), w_hammer: GR('w', 'Młotek wiedzy', 'common', 'g_hammer', { atk: 10 }),
  w_boomerang: GR('w', 'Bumerang powtórek', 'rare', 'g_boomerang', { atk: 14, crit: 5 }, 'wraca jak dobra powtórka'), w_wand: GR('w', 'Różdżka notatek', 'rare', 'g_wand', { atk: 16, crit: 4 }),
  w_pick: GR('w', 'Kilof wkuwania', 'rare', 'g_pick', { atk: 20 }), w_axe: GR('w', 'Topór sesji', 'epic', 'g_axe', { atk: 28 }),
  w_bow: GR('w', 'Łuk precyzji', 'epic', 'g_bow', { atk: 22, crit: 12 }), w_swords: GR('w', 'Miecze mistrza', 'epic', 'g_swords', { atk: 32 }),
  w_trident: GR('w', 'Trójząb Posejdona', 'legendary', 'trident', { atk: 42, crit: 8 }), w_orb: GR('w', 'Kula wiedzy', 'legendary', 'g_orb', { atk: 38, crit: 12 }),
  w_mecharm: GR('w', 'Mechaniczne ramię', 'legendary', 'g_mecharm', { atk: 48 }), w_volt: GR('w', 'Piorun Zeusa', 'mythic', 'g_volt', { atk: 60, crit: 15 }, 'mityczny – rażący krytyk'),
  w_comet: GR('w', 'Kometa egzaminacyjna', 'mythic', 'g_comet2', { atk: 70, crit: 8 }, 'mityczna – spada z nieba'),
  h_cap: GR('h', 'Czapka z daszkiem', 'common', 'g_cap', { hp: 10 }), h_helmet: GR('h', 'Hełm skupienia', 'common', 'g_helmet', { hp: 15 }),
  h_goggles: GR('h', 'Gogle laboranta', 'rare', 'g_goggles', { hp: 10, crit: 6 }), h_grad: GR('h', 'Biret absolwenta', 'rare', 'g_gradcap', { hp: 20, xp: 10 }, '+10% doświadczenia'),
  h_military: GR('h', 'Hełm wojownika', 'epic', 'g_mhelmet', { hp: 30, def: 8 }), h_tophat: GR('h', 'Cylinder iluzjonisty', 'epic', 'g_tophat', { hp: 15, dodge: 10 }),
  h_crown: GR('h', 'Korona wiedzy', 'legendary', 'g_crown', { hp: 35, crit: 8, xp: 10 }), h_dragon: GR('h', 'Hełm smoka', 'mythic', 'g_dragonf', { hp: 50, def: 12, dmg: 10 }, 'mityczny – zieje ogniem'),
  a_vest: GR('a', 'Kamizelka odblaskowa', 'common', 'g_vest', { hp: 15 }), a_shield: GR('a', 'Tarcza powtórek', 'rare', 'g_shield', { hp: 25, def: 8 }),
  a_labcoat: GR('a', 'Fartuch laboranta', 'rare', 'g_labcoat', { hp: 20, def: 5, time: 15 }, '+15% czasu do namysłu'), a_coat: GR('a', 'Płaszcz sesji', 'epic', 'g_coat', { hp: 40, def: 10 }),
  a_kimono: GR('a', 'Kimono mistrza', 'epic', 'g_kimono', { hp: 30, dodge: 8, def: 6 }), a_ring: GR('a', 'Pierścień pamięci', 'epic', 'g_ring', { hp: 35, def: 12 }),
  a_gem: GR('a', 'Kryształowy pancerz', 'legendary', 'g_gem', { hp: 60, def: 18 }), a_wings: GR('a', 'Skrzydła anioła', 'mythic', 'g_wing', { hp: 70, def: 15, dodge: 12 }, 'mityczne – unoszą ponad ataki'),
  c_key: GR('c', 'Złoty klucz', 'rare', 'g_key', { loot: 1 }, '+1 przedmiot w skrzyni'), c_amulet: GR('c', 'Amulet nazar', 'rare', 'g_amulet', { dodge: 10 }, '10% szans na unik'),
  c_scroll: GR('c', 'Zwój mędrca', 'epic', 'g_scroll', { xp: 25 }, '+25% doświadczenia'), c_hourglass: GR('c', 'Klepsydra', 'epic', 'g_hourglass', { time: 50 }, '+50% czasu do namysłu'),
  c_mirror: GR('c', 'Lustro odbicia', 'epic', 'g_mirror', { thorns: 25 }, 'odbija 25% obrażeń'), c_feather: GR('c', 'Pióro feniksa', 'legendary', 'g_feather', { second: 1, hp: 10 }, 'drugie życie raz na walkę'),
  c_star: GR('c', 'Gwiezdny talizman', 'legendary', 'g_sparkles', { crit: 10, combo: 2 }, 'start z serią 2, +10% krytyka'), c_dna: GR('c', 'Spirala DNA', 'legendary', 'g_dna', { ultFast: 1, xp: 15 }, 'szybszy supercios, +15% XP'),
  c_heart: GR('c', 'Płonące serce', 'mythic', 'g_heartfire', { vamp: 15, hp: 30, regen: 2 }, 'mityczne – 15% obrażeń leczy'),
};
const GEAR_PRICE = { common: 150, rare: 450, epic: 1200, legendary: 3500, mythic: 9000 };
const FORGE_MAX = 5;
const gearImg = (id, cls = '') => { const g = GEAR[id]; return g ? `<img class="gear-img ${cls}" src="assets/fluent/${g.img}.webp" alt="${esc(g.name)}" draggable="false">` : ''; };
const ownsGear = id => hasItem('gear', id);
const gearStats = g => [g.atk && `⚔️ +${g.atk}%`, g.hp && `❤️ +${g.hp}`, g.def && `🛡️ ${g.def}%`, g.crit && `🎯 +${g.crit}%`, g.dodge && `💨 ${g.dodge}%`, g.desc].filter(Boolean).join(' · ');

// ---------- 🧪 mikstury i power-upy (max 3 użycia na walkę)
const POTIONS = {
  heal: { name: 'Mikstura życia', c: '#ef4444', desc: '+40 ❤️', price: 40 }, power: { name: 'Mikstura siły', c: '#f59e0b', desc: '3 ciosy ×2', price: 60 },
  guard: { name: 'Eliksir tarczy', c: '#3b82f6', desc: 'blokuje następny atak', price: 50 }, bomb: { name: 'Mocny cios', img: 'g_bomb', desc: 'od razu cios ×3', price: 80 },
  hint: { name: 'Podpowiedź', img: 'g_cball', desc: 'ABCD: 50/50 · wpisz/fiszki: pierwsze litery', price: 40 }, time: { name: 'Stoper', img: 'g_stopwatch', desc: '5 pytań bez limitu czasu, bez lodu i robaków', price: 50 },
  phoenix: { name: 'Feniks', img: 'fire', desc: 'gdy padniesz – wstajesz z 50% ❤️', price: 150 },
};
const POT_MAX = 3;
const potionSVG = k => { const p = POTIONS[k]; if (p.img) return `<img class="gear-img potion" src="assets/fluent/${p.img}.webp" alt="">`; const c = p.c;
  return `<svg class="potion" viewBox="0 0 64 64"><path d="M24 6h16v6h-3v10c10 4 16 12 16 22 0 10-9 16-21 16S11 54 11 44c0-10 6-18 16-22V12h-3z" fill="#e0f2fe" stroke="#334155" stroke-width="3" stroke-linejoin="round"/><path d="M14 44c0-3 1-6 3-8h30c2 2 3 5 3 8 0 8-8 13-18 13S14 52 14 44z" fill="${c}"/><circle cx="25" cy="44" r="3" fill="#fff" opacity=".6"/><circle cx="36" cy="49" r="2" fill="#fff" opacity=".5"/><rect x="22" y="3" width="20" height="6" rx="2" fill="#a16207"/></svg>`; };
const potionN = k => itemCount('potion', k);

// ---------- 📊 statystyki bohatera
function heroStats() {
  const h = hero(), lv = heroLv(), pr = h.pr || 0, eq = Object.values(h.eq).map(id => GEAR[id]).filter(Boolean);
  const g = k => eq.reduce((a, x) => a + (x[k] || 0), 0), w = GEAR[h.eq.w], forge = (w && h.forge[h.eq.w]) || 0;
  const v = k => g(k) + skVal(k);
  return { lv, pr, line: heroLine(h), weapon: w, forge,
    hp: BOSS_ME_BASE + 4 * (lv - 1) + v('hp') + 10 * pr,
    atk: (1 + .02 * (lv - 1) + g('atk') / 100 + forge * .06 + .05 * pr) * (1 + v('dmg') / 100),
    crit: Math.min(.6, v('crit') / 100), def: Math.min(.5, v('def') / 100), dodge: Math.min(.4, v('dodge') / 100),
    regen: v('regen'), second: v('second') > 0, vamp: v('vamp') / 100, thorns: v('thorns') / 100, time: 1 + v('time') / 100,
    typeM: 1.5 + v('type'), abcdM: .5 + v('abcd'), steady: v('steady') > 0, alch: v('alch') > 0, loot: v('loot'),
    ultNeed: Math.max(3, 6 - v('ultFast')), ultPow: 1 + v('ultPow') / 100, verify: 1 + v('verify') / 100, first: Math.max(1, v('first')),
    exec: v('exec') / 100, combo: 1 + v('combo') / 100, combo0: g('combo'), ice: v('ice') > 0, gems: 1 + v('gems') / 100 };
}
const BOSS_ME_BASE = 100;

// ---------- 🖼️ postać z ekwipunkiem (hełm na głowie)
function heroSVG(cls = '', pr, h = hero()) {
  const { w, a, c } = h.eq, hd = h.eq.h, p = pr ?? (h.pr || 0), line = heroLine(h);
  const body = line === 'beast' ? creatureSVG(h.look, ['rare', 'epic', 'legendary', 'mythic'][Math.min(3, p)], { label: 'Bohater' }) : heroArt(line, heroForm(h, p), h.g === 'm' ? 'm' : 'w');
  return `<div class="hero-fig ${cls} pr-${Math.min(6, p)} ln-${line}">${p ? '<i class="hero-aura"></i>' : ''}${body}
    ${hd ? `<span class="hf-h">${gearImg(hd)}</span>` : ''}${w ? `<span class="hf-w">${gearImg(w)}</span>` : ''}${a ? `<span class="hf-a">${gearImg(a)}</span>` : ''}${c ? `<span class="hf-c">${gearImg(c)}</span>` : ''}</div>`;
}

// ---------- 📈 doświadczenie: z nauki (nowe fiszki, rozdział, cała talia) i z walk
function giveXP(n, why) {
  const before = heroLv(); hero().xp += Math.round(n); hero().mod = Date.now(); S.stats.heroLv = heroLv();
  if (heroLv() > before) setTimeout(() => celebrate(`⬆️ Bohater: poziom ${heroLv()}!`, `+1 punkt umiejętności${why ? ' · ' + why : ''}`), 400);
}
on('review', (c, g, wasNew) => {
  if (typeof BOSS !== 'undefined' && BOSS?.phase === 'fight') return;   // w walce XP liczy walka
  giveXP((wasNew ? 3 : 1) * xpMul());
  const L = lives(); if (L.n < LIVES_MAX) { L.rev = (L.rev || 0) + 1; if (L.rev >= LIFE_REV) { L.rev = 0; L.n++; toast('❤️ Odzyskane serce za naukę!'); } }
  if (!wasNew) return;
  const d = deckById(c.deckId); if (!d) return;
  const left = S.cards.filter(x => x.deckId === d.id && x.srs.state === 'new' && x.sus !== 'skip').length;
  const key = 'deckdone-' + d.id;
  if (!left && !S.wallet.some(w => w.id === key) && S.cards.filter(x => x.deckId === d.id).length >= 10) {
    S.wallet.push({ id: key, n: 50, why: 'deck-done', t: Date.now() }); giveXP(200 * xpMul());
    setTimeout(() => celebrate(`📚 Cała talia „${d.name}” nauczona!`, '+200 XP bohatera · +50 💎 · finałowy boss czeka'), 600);
  } else if (typeof chapterJustLearned === 'function') { const ch = chapterJustLearned(c); if (ch != null) { giveXP(40 * xpMul()); toast(`🔓 Rozdział ${ch + 1} nauczony – boss odblokowany! +40 XP`, 3500); } }
  save();
});

// ---------- 🌟 prestiż = ewolucja
let EVOLVE = null;
function heroPrestige() {
  const h = hero(); if (heroLv() < HERO_MAX) return toast(`Prestiż od ${HERO_MAX}. poziomu`);
  if (!confirm(`Prestiż ${(h.pr || 0) + 1}? Poziom wraca do 1, drzewka się zerują (punkty wrócą z poziomami), ekwipunek zostaje.\n\nStałe bonusy: +5% obrażeń, +10 ❤️, +10% doświadczenia. Bossowie też będą silniejsi.`)) return;
  EVOLVE = { from: h.pr || 0, t: Date.now() };
  h.pr = (h.pr || 0) + 1; h.xp = 0; h.sk = {}; h.mod = Date.now(); S.stats.prestige = Math.max(S.stats.prestige || 0, h.pr);
  addItem('boost', 'xp2', 1, 'prestige-' + h.pr); save(); render();
  setTimeout(() => { EVOLVE = null; celebrate(`🌟 Ewolucja! ${heroFormName()} · ${PR_TITLES[Math.min(6, h.pr)]}`, `Prestiż ${h.pr} · w nagrodę booster „Podwójne XP”`); confetti(260); render(); }, 2600);
}
const evolveHTML = () => EVOLVE ? `<div class="evolve-ov"><div class="evo-txt">Co?! Twój bohater ewoluuje!</div><div class="evo-stage"><div class="evo-old">${heroSVG('lg', EVOLVE.from)}</div><div class="evo-new">${heroSVG('lg')}</div></div></div>` : '';

// ---------- widoki
const heroBarHTML = () => { const L = heroLvAt(hero().xp), sp = skPoints();
  return `<div class="card hero-bar row nowrap" data-go="#/hero">${heroSVG('sm')}<div class="grow"><b>${heroFormName()} · poz. ${L.lv}${hero().pr ? ` · ★${hero().pr}` : ''}</b><div class="pbar"><i style="width:${(L.cur / L.need * 100).toFixed(1)}%"></i></div>
    <small class="muted">${sp ? `<b style="color:var(--accent)">${sp} ${plural(sp, 'punkt', 'punkty', 'punktów')} umiejętności do wydania!</b>` : 'postać · drzewko · ekwipunek'}</small></div>${livesHTML()}</div>`; };
let HERO_TAB = 'char';
ROUTES.hero = () => {
  const h = hero(), L = heroLvAt(h.xp), st = heroStats(), sp = skPoints(), pr = h.pr || 0, line = CHAR_LINES[heroLine(h)], ld = lineDef();
  const tabs = [['char', '🎭 Postać'], ['tree', `🌳 Drzewko${sp ? ` (${sp})` : ''}`], ['eq', '🎒 Ekwipunek'], ['shop', '🔨 Kowal']];
  const pane = {
    char: `<div class="card"><h2 style="margin-top:0">🎭 Wybierz postać</h2><p class="small muted" style="margin-top:0">Każda postać ma inną umiejętność, inny supercios i własne drzewko. Punkty są wspólne – zmiana postaci niczego nie zabiera.</p>
      <div class="seg gender-seg"><button class="${h.g !== 'm' ? 'on' : ''}" data-act="hero-g" data-g="w">Ona</button><button class="${h.g === 'm' ? 'on' : ''}" data-act="hero-g" data-g="m">On</button></div>
      <div class="char-grid">${Object.entries(CHAR_LINES).map(([k, l]) => { const d = lineDef(k); return `<button class="char${heroLine(h) === k ? ' on' : ''}" data-act="hero-line" data-k="${k}"><span class="char-cr">${k === 'beast' ? creatureSVG(h.look, 'rare') : heroArt(k, Math.min(3, pr), h.g === 'm' ? 'm' : 'w')}</span><b>${l.name}</b>
        <small><b>${d.passive[0]}</b> – ${d.passive[1]}</small><small><b>${d.ult[0]}</b> – ${d.ult[1]}</small></button>`; }).join('')}</div>
      ${h.line === 'beast' ? '<button class="sm ghost" data-act="hero-look">🎲 Wylosuj innego stworka</button>' : ''}</div>`,
    tree: `<div class="card"><div class="row nowrap"><h2 class="grow" style="margin:0">🌳 Drzewko: ${esc(line.name)}</h2><span class="sp-badge${sp ? ' on' : ''}">${sp} pkt</span></div>
      <p class="small muted">Węzły gałęzi odblokowują się na poziomach ${SK_REQ_LV.join(', ')}. 1 punkt za każdy poziom i prestiż.</p>
      <div class="skill-tree">${ld.tree.map(([bn, nodes]) => `<div class="sk-branch"><div class="sk-head">${bn}</div>${nodes.map((n, i) => { const got = hasNode(n.id), prev = i === 0 || hasNode(nodes[i - 1].id), lvOk = L.lv >= SK_REQ_LV[i], can = !got && prev && lvOk && sp > 0;
        return `<button class="sk${got ? ' got' : can ? ' can' : ''}" data-act="hero-sk" data-id="${n.id}" ${can ? '' : 'disabled'}><b>${n.name}</b><small>${n.desc}</small>${got ? '<i>✓</i>' : !lvOk ? `<i>🔒 poz. ${SK_REQ_LV[i]}</i>` : !prev ? '<i>🔒</i>' : ''}</button>`; }).join('<span class="sk-line"></span>')}</div>`).join('')}</div>
      ${Object.keys(lineSk()).length ? '<button class="sm ghost" data-act="hero-sk-reset" style="margin-top:10px">↺ Zresetuj drzewko (100 💎)</button>' : ''}</div>`,
    eq: `<div class="card"><h2 style="margin-top:0">🎒 Założone</h2>
      <div class="eq-slots">${['w', 'h', 'a', 'c'].map(s => { const id = h.eq[s], g = GEAR[id]; return `<div class="eq-slot" style="--rc:${g ? RARITY[g.r].color : '#94a3b8'}"><small>${SLOT_NAME[s]}</small>${g ? `${gearImg(id)}<b>${esc(g.name)}${(h.forge[id] || 0) ? ` +${h.forge[id]}` : ''}</b>` : '<span class="eq-empty">—</span>'}</div>`; }).join('')}</div>
      ${['w', 'h', 'a', 'c'].map(s => { const own = Object.keys(GEAR).filter(id => GEAR[id].slot === s && ownsGear(id)); if (!own.length) return '';
        return `<h3>${SLOT_NAME[s]}</h3><div class="gear-grid">${own.map(id => { const g = GEAR[id], on = h.eq[g.slot] === id, f = h.forge[id] || 0;
          return `<button class="gear r-${g.r}${on ? ' on' : ''}" style="--rc:${RARITY[g.r].color}" data-act="hero-eq" data-id="${id}">${gearImg(id)}<b>${esc(g.name)}${f ? ` +${f}` : ''}</b><small>${RARITY[g.r].name} · ${gearStats(g)}</small><i>${on ? '✓ założone' : 'załóż'}</i></button>`; }).join('')}</div>`; }).join('') || '<p class="small muted">Pokonuj bossów – przedmioty wypadają ze skrzyń. Duplikat ulepsza przedmiot o +1.</p>'}</div>`,
    shop: `<div class="card"><h2 style="margin-top:0">🔨 Kowal</h2>
      ${st.weapon ? `<div class="row nowrap forge"><span class="grow">Ulepsz <b>${esc(st.weapon.name)}</b> do +${st.forge + 1} (⚔️ +6%)</span><button class="primary sm" data-act="hero-forge" ${st.forge >= FORGE_MAX ? 'disabled' : ''}>${st.forge >= FORGE_MAX ? 'max' : (st.forge + 1) * 150 + ' 💎'}</button></div>` : '<p class="small muted">Załóż broń, żeby ją ulepszać.</p>'}
      <h3>🧪 Mikstury i power-upy</h3><div class="shop-grid">${Object.entries(POTIONS).map(([k, p]) => `<button class="shop-it" data-act="hero-buy-pot" data-k="${k}">${potionSVG(k)}<b>${p.name}</b><small>${p.desc} · masz ${potionN(k)}</small><i>${p.price} 💎</i></button>`).join('')}</div>
      <h3>⚔️ Przedmioty</h3><p class="small muted" style="margin-top:0">Legendarne i mityczne są drogie – częściej trafisz je w skrzyniach z trudnych bossów.</p>
      <div class="shop-grid">${Object.entries(GEAR).filter(([id]) => !ownsGear(id)).sort((x, y) => GEAR_PRICE[x[1].r] - GEAR_PRICE[y[1].r]).map(([id, g]) => `<button class="shop-it r-${g.r}" data-act="hero-buy-gear" data-id="${id}" style="--rc:${RARITY[g.r].color}">${gearImg(id)}<b>${esc(g.name)}</b><small>${RARITY[g.r].name} · ${gearStats(g)}</small><i>${GEAR_PRICE[g.r]} 💎</i></button>`).join('')}</div></div>
      <div class="card"><h2 style="margin-top:0">⏱️ Boostery</h2>${boostChips() ? `<div class="boost-row">${boostChips()}</div>` : ''}
      <p class="small muted" style="margin-top:0">Włączasz na 30 minut. W weekend podwójne XP jest za darmo, a co ${FREE_BOOST_DAYS} dni czeka darmowy booster.</p>
      ${freeBoostReady() ? '<button class="primary block" data-act="boost-free">🎁 Odbierz darmowy booster</button>' : ''}
      <div class="shop-grid">${Object.entries(BOOSTS).map(([k, x]) => `<div class="shop-it boost-it${boostOn(k) ? ' on' : ''}"><img class="gear-img" src="assets/fluent/${x.img}.webp" alt=""><b>${x.name}</b><small>${x.desc}</small>
        <div class="row nowrap" style="gap:4px">${itemCount('boost', k) ? `<button class="sm primary" data-act="boost-on" data-k="${k}">Włącz (${itemCount('boost', k)})</button>` : ''}<button class="sm" data-act="boost-buy" data-k="${k}">${x.price} 💎</button></div></div>`).join('')}</div></div>`,
  };
  return { tab: 'arena', html: `${evolveHTML()}
  <div class="row nowrap"><button class="iconbtn" data-go="#/boss">‹</button><h1 class="grow" style="margin:0">🧙 Bohater</h1>${coinsHTML()}</div>
  <div class="card center hero-card pr-card-${Math.min(6, pr)}">${heroSVG('lg')}
    <b style="font-size:20px">${esc(S.profile.nick || 'Bohater')} · poziom ${L.lv}${L.max ? ' (MAX)' : ''}</b>
    <div class="small"><b style="color:var(--accent)">${heroFormName()}</b> · ${PR_TITLES[Math.min(6, pr)]}${pr ? ` · prestiż ${'★'.repeat(Math.min(5, pr))}${pr > 5 ? '+' + (pr - 5) : ''}` : ''}</div>
    <div class="pbar" style="margin:8px 0 4px"><i style="width:${L.max ? 100 : (L.cur / L.need * 100).toFixed(1)}%"></i></div><small class="muted">${L.max ? 'Maksymalny poziom – czas na prestiż i ewolucję!' : `${Math.round(L.cur)} / ${Math.round(L.need)} XP do poziomu ${L.lv + 1} · XP zdobywasz głównie nauką`}</small>
    ${L.max ? '<button class="primary block prestige-btn" data-act="hero-prestige">🌟 Prestiż i ewolucja</button>' : ''}
    <div class="hero-stats"><span>❤️ <b>${st.hp}</b></span><span>⚔️ <b>×${st.atk.toFixed(2)}</b></span><span>🎯 <b>${Math.round(st.crit * 100)}%</b></span><span>🛡️ <b>${Math.round(st.def * 100)}%</b></span>${st.dodge ? `<span>💨 <b>${Math.round(st.dodge * 100)}%</b></span>` : ''}</div>
    <div class="hero-abil"><span><b>${ld.passive[0]}</b><small>${ld.passive[1]}</small></span><span><b>${ld.ult[0]}</b><small>supercios · ${st.ultNeed} dobre odpowiedzi</small></span></div>
    <div class="row nowrap" style="justify-content:center;margin-top:6px">${livesHTML()}</div>
    <div class="evo-chain">${[0, 1, 2, 3].map(i => `<span class="${i <= heroForm() ? 'on' : ''}" title="${line.forms[i]}">${heroSVG('xs', i)}<small>${line.forms[i]}</small></span>`).join('<i>›</i>')}</div></div>
  <div class="seg hero-tabs">${tabs.map(([k, l]) => `<button class="${HERO_TAB === k ? 'on' : ''}" data-act="hero-tab" data-k="${k}">${l}</button>`).join('')}</div>
  ${pane[HERO_TAB] || pane.char}` };
};
Object.assign(ACTIONS, {
  'hero-tab': el => { HERO_TAB = el.dataset.k; render(); },
  'hero-eq': el => { const g = GEAR[el.dataset.id], h = hero(); if (!g) return; h.eq[g.slot] = h.eq[g.slot] === el.dataset.id ? undefined : el.dataset.id; h.mod = Date.now(); save(); render(); },
  'hero-sk': el => { const h = hero(); if (skPoints() < 1) return; lineSk(h)[el.dataset.id] = 1; h.mod = Date.now(); S.stats.skills = Object.keys(lineSk(h)).length; if (lineDef().tree.some(([, ns]) => ns.every(n => lineSk(h)[n.id]))) S.stats.skillBranch = 1; save(); toast('🌳 Nowa umiejętność!'); render(); },
  'hero-sk-reset': () => { if (!confirm('Zresetować drzewko tej postaci za 100 💎? Punkty wrócą do rozdania.')) return; if (!spend(100, 'sk-reset')) return; hero().sk[heroLine()] = {}; hero().mod = Date.now(); save(); render(); },
  'hero-look': () => { const h = hero(); h.look = 1 + (Math.random() * 1e6 | 0); h.mod = Date.now(); save(); render(); },
  'hero-line': el => { const h = hero(); h.line = el.dataset.k; h.mod = Date.now(); save(); render(); },
  'hero-g': el => { const h = hero(); h.g = el.dataset.g; h.mod = Date.now(); save(); render(); },
  'hero-prestige': () => heroPrestige(),
  'boost-on': el => activateBoost(el.dataset.k),
  'boost-free': () => claimFreeBoost(),
  'boost-buy': el => { const k = el.dataset.k; if (!spend(BOOSTS[k].price, 'boost')) return; addItem('boost', k, 1); toast(`⏱️ ${BOOSTS[k].name} w ekwipunku – włącz, kiedy chcesz`); render(); },
  'hero-forge': () => { const h = hero(), w = h.eq.w, f = h.forge[w] || 0; if (!w || f >= FORGE_MAX) return; if (!spend((f + 1) * 150, 'forge')) return; h.forge[w] = f + 1; h.mod = Date.now(); save(); toast(`🔨 ${GEAR[w].name} +${f + 1}`); render(); },
  'hero-buy-pot': el => { const p = POTIONS[el.dataset.k]; if (!spend(p.price, 'potion')) return; addItem('potion', el.dataset.k, 1); toast(`🧪 ${p.name} w ekwipunku`); render(); },
  'hero-buy-gear': el => { const id = el.dataset.id, g = GEAR[id]; if (!g || ownsGear(id)) return; if (!confirm(`Kupić „${g.name}” (${RARITY[g.r].name}) za ${GEAR_PRICE[g.r]} 💎?`)) return; if (!spend(GEAR_PRICE[g.r], 'gear')) return; addItem('gear', id, 1); toast(`🎒 ${g.name}`); render(); },
});

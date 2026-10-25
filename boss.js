'use strict';
/* ⚔️ Bossowie i bohater (RPG).
   • Każda talia ma własnego bossa (od BOSS_REQ nauczonych fiszek). Pokonany wraca silniejszy jako kolejny etap –
     dłuższa walka, mocniejsze ataki i zdolności (leczenie, tarcza, mgła, szał). Walka = Twoje prawdziwe powtórki.
   • Tura: odpowiadasz (Twój cios), boss liczy do ataku (widzisz zapowiedź), zła odpowiedź = kontra bossa.
   • Bohater: poziom i doświadczenie z walk, punkty umiejętności (3 gałęzie), ekwipunek (broń, pancerz, talizman), mikstury,
     kowal (ulepszanie broni). Po wygranej – skrzynia z łupami (przedmioty, mikstury, kryształy, boostery, złote jaja). */

const BOSS_REQ = 15, BOSS_ME_BASE = 100;
const BOSS_NAMES = [['Prokrastynator', 'Szepcze: „zrobisz to jutro”.'], ['Krzywa Zapominania', 'Zjada wszystko, czego nie powtórzysz.'], ['Pan Rozkojarzony', 'Kusi powiadomieniami.'],
  ['Kolokwiusz', 'Strażnik pierwszego terminu.'], ['Mgła o 3 w nocy', 'Wymazuje pamięć przed egzaminem.'], ['Lord Ściąga', 'Nienawidzi uczciwej nauki.'], ['Sesjozaur', 'Budzi się raz na semestr.'], ['Wielki Prowadzący', 'Zadaje podchwytliwe pytania.']];
const BOSS_ABIL = { heal: ['💚', 'Regeneracja', 'leczy się'], shield: ['🛡️', 'Tarcza', 'osłabia Twój następny cios'], fog: ['🌫️', 'Mgła', 'zasłania pytanie'], rage: ['😡', 'Szał', 'poniżej połowy ❤️ bije mocniej'] };
const BOSS_MOVES = ['Cios zapomnienia', 'Fala prokrastynacji', 'Podchwytliwe pytanie', 'Pustka w głowie', 'Atak terminu', 'Wir notatek'];
const hashStr = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

// ---------- 🧙 bohater
const HERO_MAX = 20;   // maks. poziom – potem prestiż (ewolucja postaci, reset poziomu, stałe bonusy, trudniejsi bossowie, lepsze łupy)
const HERO_DEF = () => ({ xp: 0, sk: {}, eq: {}, forge: {}, look: 1 + (Math.random() * 1e6 | 0), line: 'cat', g: Math.random() < .5 ? 'w' : 'm', pr: 0, boost: {}, mod: 0 });
const hero = () => (S.hero = S.hero || HERO_DEF());
const heroLvAt = xp => { let l = 1; while (l < HERO_MAX && xp >= 80 * Math.pow(l, 1.5)) { xp -= 80 * Math.pow(l, 1.5); l++; } return { lv: l, cur: l >= HERO_MAX ? 1 : xp, need: l >= HERO_MAX ? 1 : 80 * Math.pow(l, 1.5), max: l >= HERO_MAX }; };
// 🧬 linie postaci: każdy prestiż = ewolucja do kolejnej formy (kobieta / mężczyzna); od 4. prestiżu – coraz mocniejsza aura
const CHAR_LINES = { ...Object.fromEntries(Object.entries(typeof CHARS !== 'undefined' ? CHARS : {}).map(([k, c]) => [k, { name: c.name, icon: c.icon, forms: c.forms, desc: c.desc, draw: true }])),
  beast: { name: 'Stworek', icon: '🐣', forms: ['Pisklę', 'Stworek', 'Bestia', 'Legenda'], desc: 'Losowy, jedyny taki potworek.' } };
const PR_TITLES = ['Nowicjusz', 'Adept', 'Mistrz', 'Arcymistrz', 'Legenda', 'Mityczny', 'Nieśmiertelny'];
const heroForm = (h = hero(), pr = h.pr || 0) => Math.min(3, pr);
const heroLine = (h = hero()) => CHAR_LINES[h.line] ? h.line : 'cat';
const heroFormName = (h = hero()) => CHAR_LINES[heroLine(h)].forms[heroForm(h)];
// ⏱️ boostery (jak w grach): ×2 doświadczenie, ×2 kryształy, szczęście łupieżcy (+1 przedmiot) – 30 minut od włączenia
const BOOSTS = { xp2: { name: 'Podwójne XP', desc: 'doświadczenie bohatera ×2', img: 'b_star', price: 120 }, gems2: { name: 'Podwójne kryształy', desc: '💎 z bossów, łupów i jajek ×2', img: 'b_gstar', price: 150 }, loot2: { name: 'Szczęście łupieżcy', desc: '+1 przedmiot w każdej skrzyni', img: 'b_swords', price: 150 } };
const BOOST_MS = 30 * 60000;
const boostOn = k => (hero().boost?.[k] || 0) > Date.now();
const boostLeft = k => Math.max(0, (hero().boost?.[k] || 0) - Date.now());
const gemMul = () => boostOn('gems2') ? 2 : 1;
function activateBoost(k) {
  if (itemCount('boost', k) < 1) return;
  const h = hero(); h.boost = h.boost || {}; addItem('boost', k, -1);
  h.boost[k] = Math.max(Date.now(), h.boost[k] || 0) + BOOST_MS; h.mod = Date.now(); save();
  toast(`⏱️ ${BOOSTS[k].name} aktywne przez ${Math.round(boostLeft(k) / 60000)} min`); render();
}
const boostChips = () => Object.keys(BOOSTS).filter(boostOn).map(k => `<span class="boost-chip">${BOOSTS[k].name} · ${Math.ceil(boostLeft(k) / 60000)} min</span>`).join('');
const heroLv = () => heroLvAt(hero().xp).lv;
const SKILLS = [
  { b: 'str', icon: '⚔️', name: 'Siła', nodes: [['s1', 'Mocny cios', '+15% obrażeń'], ['s2', 'Krytyk', '+10% szans na cios krytyczny (×2)'], ['s3', 'Szał', 'seria 6+ daje ×2,5 zamiast ×2'], ['s4', 'Egzekucja', 'boss poniżej 25% ❤️ → obrażenia ×1,5']] },
  { b: 'def', icon: '🛡️', name: 'Wytrwałość', nodes: [['t1', 'Twarda głowa', '+25 ❤️'], ['t2', 'Pancerz', '−15% obrażeń od bossa'], ['t3', 'Regeneracja', '„Łatwo” leczy 5 ❤️'], ['t4', 'Drugie życie', 'raz na walkę przeżyjesz z 1 ❤️']] },
  { b: 'mind', icon: '🧠', name: 'Mądrość', nodes: [['m1', 'Pisarz', 'wpisywanie: cios ×1,75 zamiast ×1,5'], ['m2', 'Opanowanie', '„Ledwo” nie przerywa serii'], ['m3', 'Alchemik', 'mikstury mocniejsze ×1,5 i +1 użycie'], ['m4', 'Łowca łupów', '+1 przedmiot w każdej skrzyni']] },
];
const SK_REQ_LV = [1, 3, 6, 10];   // od którego poziomu bohatera można kupić węzeł 1..4 w gałęzi
const hasSk = id => !!hero().sk[id];
const skPoints = () => heroLv() + (hero().pr || 0) - Object.keys(hero().sk).length;   // 1 na start + 1 za poziom + 1 za każdy prestiż
// ekwipunek (grafiki Fluent 3D)
const GEAR = {
  w_dagger: { slot: 'w', name: 'Sztylet zakuwacza', r: 'common', atk: 10, img: 'g_dagger' },
  w_wand: { slot: 'w', name: 'Różdżka notatek', r: 'rare', atk: 20, crit: 5, img: 'g_wand' },
  w_axe: { slot: 'w', name: 'Topór sesji', r: 'rare', atk: 30, img: 'g_axe' },
  w_bow: { slot: 'w', name: 'Łuk precyzji', r: 'epic', atk: 25, crit: 15, img: 'g_bow' },
  w_swords: { slot: 'w', name: 'Miecze mistrza', r: 'epic', atk: 45, img: 'g_swords' },
  w_orb: { slot: 'w', name: 'Kula wiedzy', r: 'legendary', atk: 60, crit: 10, img: 'g_orb' },
  a_helmet: { slot: 'a', name: 'Hełm skupienia', r: 'common', hp: 15, img: 'g_helmet' },
  a_shield: { slot: 'a', name: 'Tarcza powtórek', r: 'rare', hp: 25, def: 10, img: 'g_shield' },
  a_ring: { slot: 'a', name: 'Pierścień pamięci', r: 'epic', hp: 40, def: 15, img: 'g_ring' },
  a_gem: { slot: 'a', name: 'Kryształowy pancerz', r: 'legendary', hp: 60, def: 25, img: 'g_gem' },
  c_amulet: { slot: 'c', name: 'Amulet nazar', r: 'rare', dodge: 10, img: 'g_amulet', desc: '10% szans na unik ataku' },
  c_scroll: { slot: 'c', name: 'Zwój mędrca', r: 'epic', loot: 25, img: 'g_scroll', desc: '+25% doświadczenia' },
  c_star: { slot: 'c', name: 'Gwiezdny talizman', r: 'legendary', crit: 10, combo: 2, img: 'g_sparkles', desc: 'start z serią 2, +10% krytyka' },
};
const SLOT_NAME = { w: 'Broń', a: 'Pancerz', c: 'Talizman' };
const POTIONS = { heal: { name: 'Mikstura życia', c: '#ef4444', desc: '+40 ❤️', price: 40 }, power: { name: 'Mikstura siły', c: '#f59e0b', desc: '3 kolejne ciosy ×2', price: 60 }, guard: { name: 'Eliksir tarczy', c: '#3b82f6', desc: 'blokuje następny atak bossa', price: 50 } };
const SHOP_GEAR = { w_dagger: 150, a_helmet: 150, w_wand: 450, a_shield: 450 };
const gearImg = (id, cls = '') => { const g = GEAR[id]; return g ? `<img class="gear-img ${cls}" src="assets/fluent/${g.img}.webp" alt="${esc(g.name)}" draggable="false">` : ''; };
const potionSVG = k => { const c = POTIONS[k].c; return `<svg class="potion" viewBox="0 0 64 64"><path d="M24 6h16v6h-3v10c10 4 16 12 16 22 0 10-9 16-21 16S11 54 11 44c0-10 6-18 16-22V12h-3z" fill="#e0f2fe" stroke="#334155" stroke-width="3" stroke-linejoin="round"/><path d="M14 44c0-3 1-6 3-8h30c2 2 3 5 3 8 0 8-8 13-18 13S14 52 14 44z" fill="${c}"/><circle cx="25" cy="44" r="3" fill="#fff" opacity=".6"/><circle cx="36" cy="49" r="2" fill="#fff" opacity=".5"/><rect x="22" y="3" width="20" height="6" rx="2" fill="#a16207"/></svg>`; };
const ownsGear = id => hasItem('gear', id);
const potionN = k => itemCount('potion', k);
function heroStats() {
  const h = hero(), lv = heroLv(), eq = Object.values(h.eq).map(id => GEAR[id]).filter(Boolean), w = GEAR[h.eq.w], forge = h.forge[h.eq.w] || 0;
  const sum = k => eq.reduce((a, g) => a + (g[k] || 0), 0);
  const pr = h.pr || 0;
  return { lv, pr, hp: BOSS_ME_BASE + 5 * (lv - 1) + sum('hp') + (hasSk('t1') ? 25 : 0) + 10 * pr, atk: 1 + .02 * (lv - 1) + sum('atk') / 100 + forge * .06 + (hasSk('s1') ? .15 : 0) + .05 * pr,
    crit: (sum('crit') + (hasSk('s2') ? 10 : 0)) / 100, def: Math.min(.5, (sum('def') + (hasSk('t2') ? 15 : 0)) / 100), dodge: sum('dodge') / 100, loot: sum('loot') / 100 + .1 * pr, combo0: sum('combo'), weapon: w, forge };
}
function heroSVG(cls = '', pr) {
  const h = hero(), w = h.eq.w, a = h.eq.a, c = h.eq.c, p = pr ?? (h.pr || 0), line = heroLine(h);
  const body = line === 'beast' ? creatureSVG(h.look, ['rare', 'epic', 'legendary', 'mythic'][Math.min(3, p)], { label: 'Twój bohater' }) : heroArt(line, heroForm(h, p), h.g === 'm' ? 'm' : 'w');
  return `<div class="hero-fig ${cls} pr-${Math.min(6, p)}">${p ? '<i class="hero-aura"></i>' : ''}${body}
    ${w ? `<span class="hf-w">${gearImg(w)}</span>` : ''}${a ? `<span class="hf-a">${gearImg(a)}</span>` : ''}${c ? `<span class="hf-c">${gearImg(c)}</span>` : ''}</div>`;
}

// ---------- 🐉 boss talii
const deckLearned = d => S.cards.filter(c => c.deckId === d.id && c.srs.state !== 'new' && noteById(c.noteId)).length;
function deckBoss(d) {
  const st = d.boss?.stage || 0, seed = hashStr(d.id) % 100000 + st * 7919, [name, desc] = BOSS_NAMES[(hashStr(d.id) + st) % BOSS_NAMES.length];
  const learned = deckLearned(d), len = Math.max(8, Math.min(learned, 12 + 4 * st, 40));
  const abil = Object.keys(BOSS_ABIL).filter((_, i) => (seed >> i) & 1).slice(0, st >= 4 ? 3 : st >= 2 ? 2 : st >= 1 ? 1 : 0);
  if (st >= 1 && !abil.length) abil.push('shield');
  return { deck: d.id, stage: st, seed, name, desc, title: `Strażnik talii „${d.name}”`, lv: st + 1 + Math.floor(learned / 60), len, learned,
    hp: Math.round(len * 10 * (.8 + .12 * st)), atk: 12 + 3 * st, every: st >= 3 ? 2 : 3, abil };
}
// 🌍 bossowie świata: walczysz fiszkami ze WSZYSTKICH talii; więksi, groźniejsi, lepsze nagrody (co 2. etap booster)
const WORLD_REQ = 40;
const WORLD_BOSSES = [['Smok Sesji', 'Pożera całe semestry naraz.', 'w_dragon'], ['Ogr Zaległości', 'Rośnie z każdą odłożoną powtórką.', 'w_ogre'], ['Pajęczyca Rozproszeń', 'Oplata myśli powiadomieniami.', 'w_spider'],
  ['Kosmita Ściągawek', 'Przyleciał podejrzeć Twoje odpowiedzi.', 'w_alien'], ['Robot Wkuwacz', 'Zna tylko wkuwanie na pamięć.', 'w_robot'], ['Duch Zapomnienia', 'Przenika przez nieutrwaloną wiedzę.', 'w_ghost'], ['Ośmiornica Terminów', 'Osiem macek, osiem kolokwiów.', 'w_octo'], ['Kościej Egzaminator', 'Pytał już Twoich dziadków.', 'w_skull']];
const learnedAll = () => S.cards.filter(c => c.srs.state !== 'new' && noteById(c.noteId)).length;
function worldBoss() {
  const st = S.stats.worldStage || 0, [name, desc, img] = WORLD_BOSSES[st % WORLD_BOSSES.length], learned = learnedAll(), len = Math.max(15, Math.min(learned, 20 + 5 * st, 50));
  const abil = ['rage', ...Object.keys(BOSS_ABIL).filter(a => a !== 'rage').slice(0, Math.min(3, 1 + Math.floor(st / 2)))];
  return { deck: 'world', world: true, stage: st, seed: 777 + st * 31, img, name, desc, title: 'Boss świata – wszystkie talie', lv: st + 3, len, learned, hp: Math.round(len * 13 * (.8 + .12 * st)), atk: 16 + 4 * st, every: st >= 2 ? 2 : 3, abil };
}
const bossArt = (b, cls = '') => b.img ? `<div class="boss-art world ${cls}"><img src="assets/fluent/${b.img}.webp" alt="${esc(b.name)}" draggable="false"></div>`
  : `<div class="boss-art ${cls}">${creatureSVG(b.seed, b.stage >= 3 ? 'mythic' : 'epic', { boss: true, label: b.name })}</div>`;
// 💬 komentarze bossa w trakcie walki – zaczepne, śmieszne, czasem motywujące
const BOSS_TALK = {
  start: ['Ha! Kolejny student, który „uczył się wczoraj”.', 'Twoje fiszki są moje!', 'Zobaczmy, co zostało w tej głowie po imprezie.', 'Przygotowałem podchwytliwe pytania. Same podchwytliwe.', 'Ostatni, który przyszedł nieprzygotowany, do dziś pisze poprawkę.'],
  hit: ['Auć! Skąd to wiesz?!', 'Dobra, to akurat było łatwe.', 'Hmpf. Szczęściarz.', 'Kto Ci to podpowiedział?!', 'Ej, to bolało!'],
  crit: ['KRYTYK?! Kto Cię tego nauczył?!', 'Ała! Ty naprawdę powtarzałeś!', 'To nie fair, Ty masz FSRS!'],
  combo: ['Seria?! Przestań się uczyć regularnie!', 'Za dobrze Ci idzie… podejrzane.', 'Nie lubię ludzi, którzy robią powtórki codziennie.'],
  low: ['N-nie… jeszcze nie skończyłem!', 'Jeszcze jedno dobre słowo i mnie nie ma!', 'Dobra, dobra, przyznaję – coś umiesz.'],
  miss: ['HA! Na tyle Cię stać?', 'Pudło! Może jednak trzeba było powtórzyć?', 'Słabo Ci idzie… ale nie płacz, mam więcej pytań!', 'Tego nie było na slajdach? Było. Na każdym.', 'Brawo, prawie! Prawie robi różnicę.'],
  meLow: ['Jeszcze trochę i wracasz do zeszytu!', 'Słyszę już szelest poprawki…', 'Poddaj się, mikstury nie uratują wiedzy!'],
  attack: ['Przyjmij to: cios zapomnienia!', 'Masz! Termin się zbliża!', 'Mój ulubiony atak: pytanie spoza materiału!'],
  potion: ['Mikstura? Oszust!', 'Doping! Zgłaszam to dziekanowi!', 'Pij, pij… i tak nie pamiętasz definicji.'],
  bossDown: ['Nieeee! Wrócę… z większą liczbą fiszek!', 'Pokonałeś mnie… ale za tydzień przyjdzie mój starszy brat.', 'Dobra… zasłużyłeś. Ucz się dalej, bo wrócę.'],
  bossWins: ['Ha! Wróć, jak powtórzysz materiał!', 'Następnym razem mniej scrollowania, więcej fiszek!', 'Nie martw się – każda porażka to darmowa powtórka. Wróć silniejszy!'],
};
const bossSay = k => { if (!BOSS) return; const l = BOSS_TALK[k] || []; BOSS.say = { txt: l[Math.random() * l.length | 0], t: Date.now(), k }; };
let BOSS = null, BOSS_PICK = { mode: 'flip' };
try { Object.assign(BOSS_PICK, JSON.parse(localStorage.getItem('bossPick') || '{}')); } catch { /* */ }

function bossStart(deckId) {
  const world = deckId === 'world', d = world ? null : deckById(deckId); if (!world && !d) return;
  const b = world ? worldBoss() : deckBoss(d), req = world ? WORLD_REQ : BOSS_REQ;
  if (b.learned < req) return toast(`Ten boss budzi się przy ${req} nauczonych fiszkach – masz ${b.learned}`, 4000);
  const now = Date.now(), cs = S.cards.filter(c => (world || c.deckId === d.id) && c.srs.state !== 'new' && noteById(c.noteId));
  const due = shuffle(cs.filter(c => c.srs.due <= now)), rest = shuffle(cs.filter(c => c.srs.due > now)).sort((a, x) => (x.srs.lapses - a.srs.lapses));
  const ids = [...due, ...rest].slice(0, b.len).map(c => c.id), hs = heroStats();
  // skalowanie: silniejszy bohater = silniejszy boss (bohater dalej wygrywa szybciej, ale nigdy jednym ciosem)
  const scale = (.55 + .45 * hs.atk) * (1 + .15 * hs.pr), hp = Math.round(b.hp * scale);
  b.atkS = Math.round(b.atk * (.75 + .25 * hs.hp / 100) * (1 + .15 * hs.pr));
  BOSS = { b, ids, i: 0, hp, max: hp, me: hs.hp, meMax: hs.hp, hs, cap: Math.max(12, Math.round(hp * .15)), combo: hs.combo0, best: 0, ok: 0, bad: 0, phase: 'fight', shown: false, mode: BOSS_PICK.mode,
    shownAt: now, lostHp: 0, timer: b.every, move: pickMove(b), shield: false, fog: false, power: 0, guard: false, potUsed: 0, second: hasSk('t4'), log: [] };
  bossSay('start');
  go('#/boss/fight'); render();
}
const pickMove = b => { const opts = ['hit', ...b.abil.filter(a => a !== 'rage')]; const k = opts[Math.random() * opts.length | 0], atk = b.atkS || b.atk;
  return k === 'hit' ? { k, name: BOSS_MOVES[Math.random() * BOSS_MOVES.length | 0], dmg: atk + (Math.random() * 6 | 0) } : { k, name: BOSS_ABIL[k][1], dmg: k === 'heal' || k === 'shield' ? 0 : Math.round(atk * .5) }; };
const bossCard = () => BOSS && S.cards.find(c => c.id === BOSS.ids[BOSS.i]);
function hurtMe(n, label) {
  const B = BOSS; if (B.guard) { B.guard = false; B.fxMe = { k: 'block', t: Date.now() }; B.log.unshift(`🛡️ Zablokowałeś: ${label}`); return; }
  if (Math.random() < B.hs.dodge) { B.fxMe = { k: 'dodge', t: Date.now() }; B.log.unshift(`💨 Unik! ${label} chybia`); return; }
  const dmg = Math.round(n * (1 - B.hs.def) * (B.b.abil.includes('rage') && B.hp < B.max / 2 ? 1.4 : 1));
  B.me -= dmg; B.lostHp += dmg; B.fxMe = { k: 'hit', n: dmg, t: Date.now() }; B.log.unshift(`💥 ${label}: −${dmg} ❤️`);
  if (B.me <= 0 && B.second) { B.me = 1; B.second = false; B.log.unshift('✨ Drugie życie! Zostaje Ci 1 ❤️'); }
}
// ocena: 1 nie pamiętam, 2 ledwo, 3 pamiętam, 4 łatwo – zaległe karty idą do harmonogramu
function bossGrade(g, typedOk) {
  const B = BOSS, c = bossCard(); if (!B || !c || B.phase !== 'fight') return;
  const now = Date.now(), ms = Math.min(60000, now - B.shownAt);
  if (c.srs.due <= now && c.srs.state !== 'new') {
    const entry = { id: uid(), c: c.id, d: c.deckId, t: now, g, n: 0, ms, m: B.mode === 'type' ? 'type' : 'flip', boss: 1, ...(B.mode === 'type' ? { v: typedOk ? 'ok' : g === 1 ? 'wrong' : 'close' } : {}) };
    c.srs = schedule(c.srs, g); touch(c); S.log.push(entry); emit('review', c, g, false);
  } else (S.tlog = S.tlog || []).push({ id: uid(), t: now, d: c.deckId, ms });
  B.fx = null; B.fxMe = null; B.bossAct = null;
  if (g >= 3) {
    B.combo++; B.best = Math.max(B.best, B.combo); B.ok++;
    const comboM = B.combo >= 6 ? (hasSk('s3') ? 2.5 : 2) : B.combo >= 3 ? 1.5 : 1, typedM = B.mode === 'type' && typedOk ? (hasSk('m1') ? 1.75 : 1.5) : 1;
    const crit = Math.random() < B.hs.crit, exec = hasSk('s4') && B.hp < B.max * .25;
    let dmg = 10 * B.hs.atk * comboM * typedM * (g === 4 ? 1.2 : 1) * (crit ? 2 : 1) * (exec ? 1.5 : 1) * (B.power > 0 ? 2 : 1);
    if (B.power > 0) B.power--;
    if (B.shield) { dmg *= .5; B.shield = false; B.log.unshift('🛡️ Tarcza bossa osłabia cios'); }
    dmg = Math.min(B.cap * (crit ? 1.3 : 1), Math.round(dmg)) | 0; B.hp = Math.max(0, B.hp - dmg); B.fx = { k: 'boss', n: dmg, crit: crit || comboM >= 2, t: now };
    bossSay(crit ? 'crit' : B.combo >= 3 && B.combo % 3 === 0 ? 'combo' : B.hp < B.max * .3 ? 'low' : 'hit');
    if (g === 4 && hasSk('t3')) B.me = Math.min(B.meMax, B.me + 5);
  } else if (g === 2) { if (!hasSk('m2')) B.combo = 0; const d2 = Math.round(5 * B.hs.atk); B.hp = Math.max(0, B.hp - d2); B.fx = { k: 'boss', n: d2, t: now }; }
  else { B.combo = 0; B.bad++; B.missed = (B.missed || []).concat(c.id); hurtMe(Math.round(B.b.atkS * .8), 'Kontra bossa'); bossSay(B.me < B.meMax * .35 ? 'meLow' : 'miss'); }
  // tura bossa: odliczanie do zapowiedzianego ruchu
  if (B.hp > 0 && --B.timer <= 0) {
    const mv = B.move; B.bossAct = { k: mv.k, t: now };
    if (mv.k === 'hit') { hurtMe(mv.dmg, mv.name); bossSay('attack'); }
    else if (mv.k === 'heal') { const h = Math.round(B.max * .1); B.hp = Math.min(B.max, B.hp + h); B.log.unshift(`💚 ${B.b.name} leczy się +${h}`); }
    else if (mv.k === 'shield') { B.shield = true; B.log.unshift(`🛡️ ${B.b.name} stawia tarczę`); }
    else if (mv.k === 'fog') { B.fog = true; hurtMe(mv.dmg, 'Mgła'); }
    B.timer = B.b.every; B.move = pickMove(B.b);
  }
  B.i++; B.shown = false; B.typed = null; B.verdict = null; B.shownAt = Date.now(); B.log = B.log.slice(0, 4);
  save();
  if (B.hp <= 0) return bossEnd(true);
  if (B.me <= 0 || B.i >= B.ids.length) return bossEnd(false);
  bossSfx(g >= 3 ? 'hit' : 'hurt'); render();
  if (B.fog) setTimeout(() => { if (BOSS === B) { B.fog = false; render(); } }, 2500);
}
function usePotion(k) {
  const B = BOSS; if (!B || B.phase !== 'fight' || potionN(k) < 1) return;
  if (B.potUsed >= (hasSk('m3') ? 3 : 2)) return toast('Limit mikstur w tej walce');
  addItem('potion', k, -1); B.potUsed++; S.stats.potions = (S.stats.potions || 0) + 1;
  const m = hasSk('m3') ? 1.5 : 1;
  if (k === 'heal') { const h = Math.round(40 * m); B.me = Math.min(B.meMax, B.me + h); B.log.unshift(`🧪 +${h} ❤️`); }
  if (k === 'power') { B.power = Math.round(3 * m); B.log.unshift('🧪 Siła! Kolejne ciosy ×2'); }
  if (k === 'guard') { B.guard = true; B.log.unshift('🧪 Tarcza gotowa'); }
  B.fxMe = { k: 'potion', t: Date.now() }; bossSay('potion'); save(); render();
}
// ---------- skrzynia z łupami
function rollLoot(stage) {
  const odds = stage >= 5 ? { common: 10, rare: 35, epic: 38, legendary: 17 } : stage >= 3 ? { common: 25, rare: 40, epic: 28, legendary: 7 } : stage >= 1 ? { common: 45, rare: 38, epic: 15, legendary: 2 } : { common: 65, rare: 30, epic: 5, legendary: 0 };
  const x = Math.random() * 100;
  if (x < 35) { const r = rollRarity(odds), pool = Object.entries(GEAR).filter(([, g]) => g.r === r); const [id] = pool[Math.random() * pool.length | 0] || []; if (id) return { k: 'gear', id, r }; }
  if (x < 65) { const ks = Object.keys(POTIONS), k = ks[Math.random() * ks.length | 0]; return { k: 'potion', id: k, n: 1 + (stage >= 3 ? 1 : 0), r: 'rare' }; }
  if (x < 75) return { k: 'dust', n: 10 + 5 * stage, r: 'epic' };
  if (x < 85) { const ks = Object.keys(BOOSTS); return { k: 'boost', id: ks[Math.random() * ks.length | 0], r: 'epic' }; }
  return { k: 'gems', n: (30 + 15 * stage) * gemMul(), r: stage >= 3 ? 'legendary' : 'rare' };
}
function grantLoot(it, key) {
  if (it.k === 'gear') { if (ownsGear(it.id)) { it.dup = true; it.n = { common: 40, rare: 90, epic: 200, legendary: 500 }[it.r]; S.wallet.push({ id: key, n: it.n, why: 'loot-dup', t: Date.now() }); } else addItem('gear', it.id, 1, key); }
  if (it.k === 'potion') addItem('potion', it.id, it.n, key);
  if (it.k === 'dust') addDust(it.n, key);
  if (it.k === 'gems') S.wallet.push({ id: key, n: it.n, why: 'loot', t: Date.now() });
  if (it.k === 'egg') addItem('egg', 'boss', 1, key);
  if (it.k === 'boost') addItem('boost', it.id, 1, key);
}
const lootHTML = it => it.k === 'gear' ? `${gearImg(it.id)}<b>${esc(GEAR[it.id].name)}</b><small>${it.dup ? `masz już → +${it.n} 💎` : RARITY[it.r].name}</small>`
  : it.k === 'potion' ? `${potionSVG(it.id)}<b>${POTIONS[it.id].name}${it.n > 1 ? ' ×' + it.n : ''}</b><small>${POTIONS[it.id].desc}</small>`
  : it.k === 'boost' ? `<img class="gear-img" src="assets/fluent/${BOOSTS[it.id].img}.webp" alt=""><b>${BOOSTS[it.id].name}</b><small>30 min · ${BOOSTS[it.id].desc}</small>`
  : it.k === 'dust' ? `<span class="loot-big">💎</span><b>+${Math.round(it.n * DUST_RATE)}</b><small>kryształy</small>` : it.k === 'egg' ? `<span class="loot-big">👑</span><b>Złote jajo</b><small>do inkubatora</small>` : `<span class="loot-big">💎</span><b>+${it.n}</b><small>kryształy</small>`;
function bossEnd(won) {
  const B = BOSS, b = B.b, d = deckById(b.deck); B.phase = won ? 'won' : 'lost'; B.me = Math.max(0, B.me); bossSay(won ? 'bossDown' : 'bossWins');
  const flawless = won && B.lostHp === 0, hs = B.hs, key = `boss-${b.deck}-${b.stage}`;
  const xp = Math.round((B.ok * 6 + (won ? 60 + 30 * b.stage : 10)) * (1 + hs.loot) * (boostOn('xp2') ? 2 : 1) * (b.world ? 1.5 : 1));
  const lvBefore = heroLv(); hero().xp += xp; hero().mod = Date.now(); B.xp = xp;
  if (won) {
    const gems = (b.world ? 60 + 20 * b.stage : 30 + 15 * b.stage) * gemMul(); if (!S.wallet.some(w => w.id === key)) S.wallet.push({ id: key, n: gems, why: 'boss', t: Date.now() });
    const n = 1 + (b.stage >= 2 ? 1 : 0) + (b.stage >= 5 ? 1 : 0) + (hasSk('m4') ? 1 : 0) + (flawless ? 1 : 0) + (boostOn('loot2') ? 1 : 0) + (b.world ? 1 : 0);
    B.loot = Array.from({ length: n }, () => rollLoot(b.stage + 2 * hs.pr));
    if (b.world && b.stage % 2 === 1) B.loot.push({ k: 'boost', id: Object.keys(BOOSTS)[Math.random() * 3 | 0], r: 'epic' });
    if ((b.stage + 1) % 3 === 0) B.loot.push({ k: 'egg', r: 'legendary' });
    B.loot.forEach((it, i) => grantLoot(it, `${key}-l${i}-${uid()}`));
    if (B.loot.some(x => x.k === 'gear' && x.r === 'legendary' && !x.dup)) S.stats.lootLegend = 1;
    if (b.world) S.stats.worldStage = b.stage + 1; else { d.boss = { stage: b.stage + 1, wins: (d.boss?.wins || 0) + 1 }; touch(d); }
    S.stats.bossWins = (S.stats.bossWins || 0) + 1; S.stats.bossStageMax = Math.max(S.stats.bossStageMax || 0, b.stage + 1); if (flawless) S.stats.bossFlawless = (S.stats.bossFlawless || 0) + 1;
    B.gems = gems; B.flawless = flawless; bossSfx('win');
    setTimeout(() => bossSfx('chest'), 900);
  } else { addDust(3); bossSfx('lose'); }
  S.stats.heroLv = heroLv(); save();
  if (heroLv() > lvBefore) setTimeout(() => celebrate(`⬆️ Bohater: poziom ${heroLv()}!`, '+1 punkt umiejętności – otwórz drzewko'), 2600);
  if (typeof checkAchievements === 'function') checkAchievements();
  render();
}
function bossSfx(k) {
  try {
    if (S.settings.sound === false) return;
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const seq = { hit: [[520, .06], [780, .08]], hurt: [[180, .14], [120, .16]], win: [[523, .12], [659, .12], [784, .12], [1046, .3]], lose: [[392, .2], [330, .2], [262, .4]], chest: [[330, .08], [440, .08], [660, .2]] }[k] || [];
    let t = audioCtx.currentTime;
    for (const [f, dd] of seq) { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = k === 'hurt' ? 'sawtooth' : 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + dd); o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + dd); t += dd * .9; }
  } catch { /* */ }
}

// ---------- 🌟 prestiż = ewolucja
let EVOLVE = null;
function heroPrestige() {
  const h = hero(); if (heroLv() < HERO_MAX) return toast(`Prestiż od ${HERO_MAX}. poziomu`);
  if (!confirm(`Prestiż ${(h.pr || 0) + 1}? Poziom wraca do 1, punkty umiejętności się zerują (dostaniesz je z powrotem przy kolejnych poziomach), ekwipunek zostaje.\n\nStałe bonusy: +5% obrażeń, +10 ❤️, +10% doświadczenia, lepsze łupy. Bossowie też będą silniejsi.`)) return;
  EVOLVE = { from: h.pr || 0, t: Date.now() };
  h.pr = (h.pr || 0) + 1; h.xp = 0; h.sk = {}; h.mod = Date.now(); S.stats.prestige = Math.max(S.stats.prestige || 0, h.pr);
  addItem('boost', 'xp2', 1, 'prestige-' + h.pr); save(); render();
  setTimeout(() => { EVOLVE = null; celebrate(`🌟 Ewolucja! ${heroFormName()} · ${PR_TITLES[Math.min(6, h.pr)]}`, `Prestiż ${h.pr} · w nagrodę booster „Podwójne XP”`); confetti(260); render(); }, 2600);
}
const evolveHTML = () => EVOLVE ? `<div class="evolve-ov"><div class="evo-txt">Co?! Twój bohater ewoluuje!</div><div class="evo-stage"><div class="evo-old">${heroSVG('lg', EVOLVE.from)}</div><div class="evo-new">${heroSVG('lg')}</div></div></div>` : '';
// ---------- widoki
const hpBar = (v, max, cls) => `<div class="hpbar ${cls}"><i style="width:${Math.max(0, v / max * 100).toFixed(1)}%"></i><span>${Math.max(0, Math.round(v))} / ${max}</span></div>`;
const heroBarHTML = () => { const L = heroLvAt(hero().xp), sp = skPoints();
  return `<div class="card hero-bar row nowrap" data-go="#/hero">${heroSVG('sm')}<div class="grow"><b>${heroFormName()} · poz. ${L.lv}${hero().pr ? ` · ★${hero().pr}` : ''}</b><div class="pbar"><i style="width:${(L.cur / L.need * 100).toFixed(1)}%"></i></div>
    <small class="muted">${sp ? `<b style="color:var(--accent)">${sp} ${plural(sp, 'punkt', 'punkty', 'punktów')} umiejętności do wydania!</b>` : 'ekwipunek · drzewko · kowal'}</small></div><span>›</span></div>`; };
const chestSVG = () => `<svg viewBox="0 0 120 100"><defs><linearGradient id="chw" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#b45309"/><stop offset="1" stop-color="#78350f"/></linearGradient></defs>
  <g class="chest-lid"><path d="M14 40C14 18 34 10 60 10S106 18 106 40Z" fill="url(#chw)" stroke="#451a03" stroke-width="3"/><path d="M14 40H106" stroke="#fbbf24" stroke-width="5"/><path d="M54 12V40M66 12V40" stroke="#fbbf24" stroke-width="4"/></g>
  <rect x="14" y="40" width="92" height="50" rx="6" fill="url(#chw)" stroke="#451a03" stroke-width="3"/><path d="M54 40V90M66 40V90" stroke="#fbbf24" stroke-width="4"/><rect x="52" y="48" width="16" height="16" rx="3" fill="#fde047" stroke="#92400e" stroke-width="2.5"/></svg>`;
ROUTES.boss = parts => {
  if (parts[1] !== 'fight' || !BOSS) {
    // 🗺️ mapa bossów: region świata + region każdej talii; ścieżka etapów (pokonane ✓, obecny, kolejne ukryte)
    const regions = [{ id: 'world', name: '🌍 Świat – wszystkie talie', b: worldBoss(), req: WORLD_REQ }, ...S.decks.map(d => ({ id: d.id, name: d.name, b: deckBoss(d), req: BOSS_REQ }))]
      .sort((x, y) => (y.b.learned >= y.req) - (x.b.learned >= x.req));
    const node = (r, st) => { const cur = st === r.b.stage, done = st < r.b.stage, ok = r.b.learned >= r.req;
      const bb = r.id === 'world' ? { ...r.b, ...(() => { const [name, , img] = WORLD_BOSSES[st % WORLD_BOSSES.length]; return { name, img, stage: st }; })() } : { ...r.b, stage: st, seed: hashStr(r.id) % 100000 + st * 7919 };
      return `<div class="mnode${cur ? ' cur' : done ? ' done' : ' future'}${ok ? '' : ' sleep'}">${done || cur ? bossArt(bb) : '<span class="mq">?</span>'}<small>${done ? '✓' : 'Etap ' + (st + 1)}</small></div>`; };
    return { tab: 'arena', html: `
    <div class="row nowrap"><h1 class="grow" style="margin:0">🗺️ Mapa bossów</h1>${coinsHTML()}</div>
    ${heroBarHTML()}
    ${boostChips() ? `<div class="boost-row">${boostChips()}</div>` : ''}
    <div class="seg boss-mode"><button class="${BOSS_PICK.mode === 'flip' ? 'on' : ''}" data-act="boss-mode" data-m="flip">🃏 Fiszki</button><button class="${BOSS_PICK.mode === 'type' ? 'on' : ''}" data-act="boss-mode" data-m="type">⌨️ Wpisz · cios ×1,5</button></div>
    ${regions.map(r => { const b = r.b, ok = b.learned >= r.req, from = Math.max(0, b.stage - 2);
      return `<div class="card region${r.id === 'world' ? ' world' : ''}${ok ? '' : ' locked'}"><div class="row nowrap"><b class="grow">${esc(r.name)}</b><span class="small muted">${b.learned} nauczonych</span></div>
        <div class="mpath">${Array.from({ length: b.stage - from + 4 }, (_, i) => node(r, from + i)).join('<i class="mline"></i>')}</div>
        <div class="row nowrap region-cur"><div class="grow"><b>${esc(b.name)}</b> <span class="boss-lv">Etap ${b.stage + 1}</span><div class="small muted">${esc(b.desc)}</div>
          <div class="boss-tags">${ok ? `<span>❤️ ~${b.hp}</span><span>⚔️ ${b.atk}</span><span>🃏 ${b.len}</span>${b.abil.map(a => `<span title="${BOSS_ABIL[a][2]}">${BOSS_ABIL[a][0]} ${BOSS_ABIL[a][1]}</span>`).join('')}` : `<span>🔒 budzi się przy ${r.req} nauczonych fiszkach</span>`}</div></div>
          ${ok ? `<button class="primary" data-act="boss-start" data-id="${r.id}">⚔️ Walcz</button>` : ''}</div>
        ${ok ? '' : `<div class="pbar"><i style="width:${Math.min(100, b.learned / r.req * 100)}%"></i></div>`}</div>`; }).join('')}
    <p class="small muted center">Boss skaluje się do siły bohatera – mocniejszy bohater wygrywa szybciej, ale żaden boss nie pada od jednego ciosu.</p>` };
  }
  const B = BOSS, b = B.b;
  if (B.phase !== 'fight') {
    const won = B.phase === 'won';
    return { tab: 'arena', focus: true, html: `
    <div class="card center boss-end ${won ? 'won' : 'lost'}">
      <div class="boss-stage ${won ? 'dead' : 'gloat'}">${bossArt(b)}${won ? '<div class="boss-boom"></div>' : ''}</div>
      ${B.say?.txt ? `<div class="boss-say end">${esc(B.say.txt)}</div>` : ''}
      <h2 style="margin:6px 0">${won ? `🏆 ${esc(b.name)} pokonany!` : `💀 ${esc(b.name)} wygrywa…`}</h2>
      <p class="small muted">${B.ok} dobrych · ${B.bad} błędów · najlepsza seria ${B.best} · +${B.xp} XP bohatera${won && B.flawless ? ' · <b>bez straty ❤️</b>' : ''}</p>
      ${won ? `<div class="chest-wrap"><div class="chest">${chestSVG()}</div><div class="loot">${B.loot.map((it, i) => `<div class="loot-it" style="--d:${.9 + i * .25}s;--rc:${RARITY[it.r || 'rare'].color}">${lootHTML(it)}</div>`).join('')}</div></div>
        <p class="small">+${B.gems} 💎 za etap ${b.stage + 1}. Następny etap: dłuższa walka i mocniejsze ataki.</p>` : '<p class="small">+9 💎 na pocieszenie. Ulepsz bohatera albo kup mikstury i spróbuj znowu.</p>'}
      ${(B.missed || []).length ? `<button class="block" data-act="boss-cram">🔁 Powtórz ${B.missed.length} ${plural(B.missed.length, 'fiszkę', 'fiszki', 'fiszek')}, których nie pamiętałeś</button>` : ''}
      <div class="row" style="margin-top:10px"><button class="primary grow" data-act="boss-again">${won ? 'Następny etap ⚔️' : 'Spróbuj ponownie'}</button><button class="grow" data-go="#/boss">🗺️ Mapa</button><button class="grow" data-go="#/hero">🧙 Bohater</button></div>
    </div>` };
  }
  const c = bossCard(), v = c ? cardView(c) : { q: '', a: '' }, now = Date.now(), fx = B.fx && now - B.fx.t < 900 ? B.fx : null, fm = B.fxMe && now - B.fxMe.t < 900 ? B.fxMe : null, act = B.bossAct && now - B.bossAct.t < 900 ? B.bossAct : null;
  const typedOK = B.mode === 'type' && v.ans && v.ans.length <= 120, mv = B.move;
  return { tab: 'arena', focus: true, html: `
  <div class="studybar"><button class="iconbtn" data-act="boss-quit">✕</button><div class="title">${esc(b.name)} · etap ${b.stage + 1}</div><span class="small muted">${B.i + 1}/${B.ids.length}</span></div>
  <div class="boss-fight${fm?.k === 'hit' ? ' shake-screen' : ''}">
    ${B.say?.txt ? `<div class="boss-say" key="${B.say.t}">${esc(B.say.txt)}</div>` : ''}
    <div class="boss-top"><div class="boss-stage${fx ? ' hit' : ''}${fx?.crit ? ' crit' : ''}${act ? ' attack' : ''}">${bossArt(b)}${B.shield ? '<span class="boss-shield">🛡️</span>' : ''}${fx ? `<b class="dmg${fx.crit ? ' crit' : ''}">−${fx.n}${fx.crit ? '!' : ''}</b><i class="slash"></i>` : ''}</div>
      <div class="boss-intent${B.timer === 1 ? ' soon' : ''}">${mv.k === 'hit' ? '⚔️' : BOSS_ABIL[mv.k][0]} <b>${esc(mv.name)}</b>${mv.dmg ? ` −${mv.dmg}` : ''}<small>${B.timer === 1 ? 'w następnej turze!' : `za ${B.timer} tury`}</small></div></div>
    ${hpBar(B.hp, B.max, 'boss')}
    <div class="row nowrap boss-me${fm?.k === 'hit' ? ' hurt' : ''}">${heroSVG('xs')}${hpBar(B.me, B.meMax, 'me')}${B.combo >= 2 ? `<span class="combo">🔥 ${B.combo}</span>` : ''}${B.power ? `<span class="combo">💪 ${B.power}</span>` : ''}${B.guard ? '<span class="combo">🛡️</span>' : ''}</div>
    ${fm?.k === 'hit' ? `<b class="dmg me">−${fm.n}</b><i class="claw"></i>` : fm?.k === 'dodge' ? '<b class="dmg me dodge">Unik!</b>' : fm?.k === 'block' ? '<b class="dmg me dodge">Blok!</b>' : ''}
    ${B.log.length ? `<div class="boss-log">${B.log.slice(0, 2).map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
  </div>
  <div class="card flash boss-q${fm?.k === 'hit' ? ' shake' : ''}${B.fog && !B.shown ? ' fogged' : ''}">${B.shown ? v.a : v.q}</div>
  ${B.shown ? `${B.verdict ? `<p class="center small ${B.verdict === 'wrong' ? 'bad' : 'good'}">${B.verdict === 'wrong' ? `✗ Poprawnie: <b>${esc(v.ans)}</b>` : B.verdict === 'close' ? '≈ Prawie – liczę jako „ledwo”' : '✓ Dobrze! Mocny cios'}</p>` : ''}
    <div class="boss-grades">${B.verdict ? '<button class="primary" data-act="boss-next">Dalej ›</button>' : `
      <button class="g1" data-act="boss-g" data-g="1">✗<small>Nie pamiętam</small></button><button class="g2" data-act="boss-g" data-g="2">≈<small>Ledwo</small></button>
      <button class="g3" data-act="boss-g" data-g="3">✓<small>Pamiętam</small></button><button class="g4" data-act="boss-g" data-g="4">⚡<small>Łatwo</small></button>`}</div>`
    : typedOK ? `<div class="row nowrap"><input id="boss-in" class="grow" placeholder="Wpisz odpowiedź…" autocomplete="off" autocapitalize="off"><button class="primary" data-act="boss-check">⚔️</button></div>
      <button class="ghost block small" data-act="boss-show" style="margin-top:6px">Nie wiem – pokaż</button>`
    : '<button class="primary block boss-go" data-act="boss-show">Pokaż odpowiedź</button>'}
  <div class="pot-bar">${Object.keys(POTIONS).map(k => `<button data-act="boss-pot" data-k="${k}" ${potionN(k) ? '' : 'disabled'} title="${POTIONS[k].name}: ${POTIONS[k].desc}">${potionSVG(k)}<i>${potionN(k)}</i></button>`).join('')}</div>` };
};
// ---------- 🧙 ekran bohatera
ROUTES.hero = () => {
  const h = hero(), L = heroLvAt(h.xp), st = heroStats(), sp = skPoints(), owned = Object.keys(GEAR).filter(ownsGear), pr = h.pr || 0, line = CHAR_LINES[heroLine(h)];
  return { tab: 'arena', html: `${evolveHTML()}
  <div class="row nowrap"><button class="iconbtn" data-go="#/boss">‹</button><h1 class="grow" style="margin:0">🧙 Bohater</h1>${coinsHTML()}</div>
  <div class="card center hero-card pr-card-${Math.min(6, pr)}">${heroSVG('lg')}
    <b style="font-size:20px">${esc(S.profile.nick || 'Bohater')} · poziom ${L.lv}${L.max ? ' (MAX)' : ''}</b>
    <div class="small"><b style="color:var(--accent)">${heroFormName()}</b> · ${PR_TITLES[Math.min(6, pr)]}${pr ? ` · prestiż ${'★'.repeat(Math.min(5, pr))}${pr > 5 ? '+' + (pr - 5) : ''}` : ''}</div>
    <div class="pbar" style="margin:8px 0 4px"><i style="width:${L.max ? 100 : (L.cur / L.need * 100).toFixed(1)}%"></i></div><small class="muted">${L.max ? 'Maksymalny poziom – czas na prestiż i ewolucję!' : `${Math.round(L.cur)} / ${Math.round(L.need)} XP do poziomu ${L.lv + 1}`}</small>
    ${L.max ? '<button class="primary block prestige-btn" data-act="hero-prestige">🌟 Prestiż i ewolucja</button>' : ''}
    <div class="hero-stats"><span>❤️ <b>${st.hp}</b></span><span>⚔️ <b>×${st.atk.toFixed(2)}</b></span><span>🎯 <b>${Math.round(st.crit * 100)}%</b></span><span>🛡️ <b>${Math.round(st.def * 100)}%</b></span>${st.dodge ? `<span>💨 <b>${Math.round(st.dodge * 100)}%</b></span>` : ''}</div>
    <div class="evo-chain">${[0, 1, 2, 3].map(i => `<span class="${i <= heroForm() ? 'on' : ''}" title="${line.forms[i]}">${heroSVG('xs', i)}<small>${line.forms[i]}</small></span>`).join('<i>›</i>')}</div>
    <small class="muted">Każdy prestiż to ewolucja w kolejną formę – w pixelowych postaciach sprite rośnie i ma więcej detali. Od 4. prestiżu coraz mocniejsza aura.</small></div>
  <div class="card"><h2>🎭 Postać</h2>
    <div class="seg gender-seg"><button class="${h.g !== 'm' ? 'on' : ''}" data-act="hero-g" data-g="w">Ona</button><button class="${h.g === 'm' ? 'on' : ''}" data-act="hero-g" data-g="m">On</button></div>
    <div class="char-grid">${Object.entries(CHAR_LINES).map(([k, l]) => `<button class="char${heroLine(h) === k ? ' on' : ''}" data-act="hero-line" data-k="${k}"><span class="char-cr">${k === 'beast' ? creatureSVG(h.look, 'rare') : heroArt(k, Math.min(3, h.pr || 0), h.g === 'm' ? 'm' : 'w')}</span><b>${l.name}</b><small>${esc(l.desc || '')}</small><small class="char-forms">${l.forms.join(' → ')}</small></button>`).join('')}</div>
    ${h.line === 'beast' ? '<button class="sm ghost" data-act="hero-look">🎲 Wylosuj innego stworka</button>' : ''}</div>
  <div class="card"><h2>⏱️ Boostery</h2>
    ${boostChips() ? `<div class="boost-row">${boostChips()}</div>` : '<p class="small muted" style="margin-top:0">Włączasz na 30 minut – jak „podwójne XP” w grach. Wypadają ze skrzyń i z prestiżu, można je też kupić.</p>'}
    <div class="shop-grid">${Object.entries(BOOSTS).map(([k, x]) => `<div class="shop-it boost-it${boostOn(k) ? ' on' : ''}"><img class="gear-img" src="assets/fluent/${x.img}.webp" alt=""><b>${x.name}</b><small>${x.desc}</small>
      <div class="row nowrap" style="gap:4px">${itemCount('boost', k) ? `<button class="sm primary" data-act="boost-on" data-k="${k}">Włącz (${itemCount('boost', k)})</button>` : ''}<button class="sm" data-act="boost-buy" data-k="${k}">${x.price} 💎</button></div></div>`).join('')}</div></div>
  <div class="card"><h2>🎒 Ekwipunek</h2>
    <div class="eq-slots">${['w', 'a', 'c'].map(s => { const id = h.eq[s], g = GEAR[id]; return `<div class="eq-slot" style="--rc:${g ? RARITY[g.r].color : '#94a3b8'}"><small>${SLOT_NAME[s]}</small>${g ? `${gearImg(id)}<b>${esc(g.name)}${s === 'w' && st.forge ? ` +${st.forge}` : ''}</b>` : '<span class="eq-empty">—</span>'}</div>`; }).join('')}</div>
    ${owned.length ? `<div class="gear-grid">${owned.map(id => { const g = GEAR[id], on = h.eq[g.slot] === id; return `<button class="gear${on ? ' on' : ''}" style="--rc:${RARITY[g.r].color}" data-act="hero-eq" data-id="${id}">${gearImg(id)}<b>${esc(g.name)}</b><small>${[g.atk && `⚔️ +${g.atk}%`, g.hp && `❤️ +${g.hp}`, g.def && `🛡️ ${g.def}%`, g.crit && `🎯 +${g.crit}%`, g.desc].filter(Boolean).join(' · ')}</small><i>${on ? '✓ założone' : 'załóż'}</i></button>`; }).join('')}</div>` : '<p class="small muted">Pokonuj bossów – przedmioty wypadają ze skrzyń. Podstawowe kupisz u kowala.</p>'}</div>
  <div class="card"><div class="row nowrap"><h2 class="grow" style="margin:0">🌳 Drzewko umiejętności</h2><span class="sp-badge${sp ? ' on' : ''}">${sp} pkt</span></div>
    <div class="skill-tree">${SKILLS.map(br => `<div class="sk-branch"><div class="sk-head">${br.icon} ${br.name}</div>${br.nodes.map(([id, name, desc], i) => { const got = hasSk(id), prev = i === 0 || hasSk(br.nodes[i - 1][0]), lvOk = L.lv >= SK_REQ_LV[i], can = !got && prev && lvOk && sp > 0;
      return `<button class="sk${got ? ' got' : can ? ' can' : ''}" data-act="hero-sk" data-id="${id}" ${can ? '' : 'disabled'}><b>${name}</b><small>${desc}</small>${got ? '<i>✓</i>' : !lvOk ? `<i>🔒 poz. ${SK_REQ_LV[i]}</i>` : !prev ? '<i>🔒</i>' : ''}</button>`; }).join('<span class="sk-line"></span>')}</div>`).join('')}</div>
    <p class="small muted" style="margin-bottom:0">1 punkt za każdy poziom bohatera. Doświadczenie zdobywasz w walkach z bossami.</p></div>
  <div class="card"><h2>🔨 Kowal i alchemik</h2>
    ${st.weapon ? `<div class="row nowrap forge"><span class="grow">Ulepsz <b>${esc(st.weapon.name)}</b> do +${st.forge + 1} (⚔️ +6%)</span><button class="primary sm" data-act="hero-forge" ${st.forge >= 5 ? 'disabled' : ''}>${st.forge >= 5 ? 'max' : (st.forge + 1) * 120 + ' 💎'}</button></div>` : '<p class="small muted">Załóż broń, żeby ją ulepszać.</p>'}
    <div class="shop-grid">${Object.entries(POTIONS).map(([k, p]) => `<button class="shop-it" data-act="hero-buy-pot" data-k="${k}">${potionSVG(k)}<b>${p.name}</b><small>${p.desc} · masz ${potionN(k)}</small><i>${p.price} 💎</i></button>`).join('')}
      ${Object.entries(SHOP_GEAR).filter(([id]) => !ownsGear(id)).map(([id, price]) => `<button class="shop-it" data-act="hero-buy-gear" data-id="${id}" style="--rc:${RARITY[GEAR[id].r].color}">${gearImg(id)}<b>${esc(GEAR[id].name)}</b><small>${RARITY[GEAR[id].r].name}</small><i>${price} 💎</i></button>`).join('')}</div></div>` };
};
// po wpisaniu: wynik przelicza ocenę (ok → 3, prawie → 2, źle → 1)
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
const bossPickSave = () => { try { localStorage.setItem('bossPick', JSON.stringify(BOSS_PICK)); } catch { /* */ } };
Object.assign(ACTIONS, {
  'boss-start': el => bossStart(el.dataset.id),
  'boss-mode': el => { BOSS_PICK.mode = el.dataset.m; bossPickSave(); render(); },
  'boss-show': () => { if (BOSS) { BOSS.shown = true; render(); } },
  'boss-g': el => bossGrade(+el.dataset.g),
  'boss-check': () => bossCheck(),
  'boss-next': () => bossGrade(BOSS.pendingG, BOSS.verdict === 'ok'),
  'boss-pot': el => usePotion(el.dataset.k),
  'boss-quit': () => { if (confirm('Uciec z walki? Boss zostaje, a odpowiedzi do tej pory są zapisane.')) { BOSS = null; go('#/boss'); } },
  'boss-again': () => { const d = BOSS?.b.deck; BOSS = null; if (d) bossStart(d); else go('#/boss'); },
  'boss-cram': () => { const ids = BOSS.missed || [], d = BOSS.b.deck; BOSS = null; SESSION = null; go(`#/study/${d === 'world' ? 'all' : d}/flip?cram=list&ids=${ids.join(',')}`); },
  'hero-eq': el => { const g = GEAR[el.dataset.id], h = hero(); if (!g) return; h.eq[g.slot] = h.eq[g.slot] === el.dataset.id ? undefined : el.dataset.id; h.mod = Date.now(); save(); render(); },
  'hero-sk': el => { const h = hero(); if (skPoints() < 1) return; h.sk[el.dataset.id] = 1; h.mod = Date.now(); S.stats.skills = Object.keys(h.sk).length; if (SKILLS.some(b => b.nodes.every(([id]) => h.sk[id]))) S.stats.skillBranch = 1; save(); toast('🌳 Nowa umiejętność!'); render(); },
  'hero-look': () => { const h = hero(); h.look = 1 + (Math.random() * 1e6 | 0); h.mod = Date.now(); save(); render(); },
  'hero-line': el => { const h = hero(); h.line = el.dataset.k; h.mod = Date.now(); save(); render(); },
  'hero-g': el => { const h = hero(); h.g = el.dataset.g; h.mod = Date.now(); save(); render(); },
  'hero-prestige': () => heroPrestige(),
  'boost-on': el => activateBoost(el.dataset.k),
  'boost-buy': el => { const k = el.dataset.k; if (!spend(BOOSTS[k].price, 'boost')) return; addItem('boost', k, 1); toast(`⏱️ ${BOOSTS[k].name} w ekwipunku – włącz, kiedy chcesz`); render(); },
  'hero-forge': () => { const h = hero(), w = h.eq.w, f = h.forge[w] || 0; if (!w || f >= 5) return; if (!spend((f + 1) * 120, 'forge')) return; h.forge[w] = f + 1; h.mod = Date.now(); save(); toast(`🔨 ${GEAR[w].name} +${f + 1}`); render(); },
  'hero-buy-pot': el => { const p = POTIONS[el.dataset.k]; if (!spend(p.price, 'potion')) return; addItem('potion', el.dataset.k, 1); toast(`🧪 ${p.name} w ekwipunku`); render(); },
  'hero-buy-gear': el => { const id = el.dataset.id; if (ownsGear(id) || !spend(SHOP_GEAR[id], 'gear')) return; addItem('gear', id, 1); toast(`🎒 ${GEAR[id].name}`); render(); },
});
// Arena: zakładka „Bossowie”
if (typeof HUBS !== 'undefined' && !HUBS.arena.some(x => x[0] === 'boss')) { HUBS.arena.splice(1, 0, ['boss', '🐉', 'Bossowie']); HUB_OF.boss = 'arena'; HUB_OF.hero = 'arena'; }
// karta na Starcie: najbliższy boss
function bossHomeHTML() {
  const best = [...(learnedAll() >= WORLD_REQ ? [worldBoss()] : []), ...S.decks.map(d => deckBoss(d)).filter(b => b.learned >= BOSS_REQ)].sort((a, b) => a.stage - b.stage)[0];
  if (!best) return '';
  return `<div class="card row nowrap boss-home" data-go="#/boss"><span class="boss-home-ic">${bossArt(best)}</span><div class="grow"><b>🐉 ${esc(best.name)} · etap ${best.stage + 1}</b>
    <div class="small muted">${esc(best.title)} – pokonaj go powtórkami</div></div><span>›</span></div>`;
}
const bossHome0 = homeExtrasHTML;
homeExtrasHTML = function () { return (appMode() === 'full' ? bossHomeHTML() : '') + bossHome0(); };
// przełącznik sekcji Areny nad listą bossów (hub.js owija trasy przed załadowaniem tego pliku)
const bossRoute0 = ROUTES.boss;
ROUTES.boss = (...a) => { const v = bossRoute0(...a); return !v || v.focus ? v : { ...v, tab: 'arena', html: (typeof hubNav === 'function' ? hubNav('arena', 'boss') : '') + v.html }; };

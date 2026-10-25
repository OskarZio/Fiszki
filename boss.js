'use strict';
/* ⚔️ Bossowie i bohater (RPG).
   • Każda talia ma własnego bossa (od BOSS_REQ nauczonych fiszek). Pokonany wraca silniejszy jako kolejny etap –
     dłuższa walka, mocniejsze ataki i zdolności (leczenie, tarcza, mgła, szał). Walka = Twoje prawdziwe powtórki.
   • Tura: odpowiadasz (Twój cios), boss liczy do ataku (widzisz zapowiedź), zła odpowiedź = kontra bossa.
   • Bohater: poziom i doświadczenie z walk, punkty umiejętności (3 gałęzie), ekwipunek (broń, pancerz, talizman), mikstury,
     kowal (ulepszanie broni). Po wygranej – skrzynia z łupami (przedmioty, mikstury, pył ✨, kryształy, złote jaja). */

const BOSS_REQ = 15, BOSS_ME_BASE = 100;
const BOSS_NAMES = [['Prokrastynator', 'Szepcze: „zrobisz to jutro”.'], ['Krzywa Zapominania', 'Zjada wszystko, czego nie powtórzysz.'], ['Pan Rozkojarzony', 'Kusi powiadomieniami.'],
  ['Kolokwiusz', 'Strażnik pierwszego terminu.'], ['Mgła o 3 w nocy', 'Wymazuje pamięć przed egzaminem.'], ['Lord Ściąga', 'Nienawidzi uczciwej nauki.'], ['Sesjozaur', 'Budzi się raz na semestr.'], ['Wielki Prowadzący', 'Zadaje podchwytliwe pytania.']];
const BOSS_ABIL = { heal: ['💚', 'Regeneracja', 'leczy się'], shield: ['🛡️', 'Tarcza', 'osłabia Twój następny cios'], fog: ['🌫️', 'Mgła', 'zasłania pytanie'], rage: ['😡', 'Szał', 'poniżej połowy ❤️ bije mocniej'] };
const BOSS_MOVES = ['Cios zapomnienia', 'Fala prokrastynacji', 'Podchwytliwe pytanie', 'Pustka w głowie', 'Atak terminu', 'Wir notatek'];
const hashStr = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

// ---------- 🧙 bohater
const HERO_DEF = () => ({ xp: 0, sk: {}, eq: {}, forge: {}, look: 1 + (Math.random() * 1e6 | 0), mod: 0 });
const hero = () => (S.hero = S.hero || HERO_DEF());
const heroLvAt = xp => { let l = 1; while (xp >= 80 * Math.pow(l, 1.5)) { xp -= 80 * Math.pow(l, 1.5); l++; } return { lv: l, cur: xp, need: 80 * Math.pow(l, 1.5) }; };
const heroLv = () => heroLvAt(hero().xp).lv;
const SKILLS = [
  { b: 'str', icon: '⚔️', name: 'Siła', nodes: [['s1', 'Mocny cios', '+15% obrażeń'], ['s2', 'Krytyk', '+10% szans na cios krytyczny (×2)'], ['s3', 'Szał', 'seria 6+ daje ×2,5 zamiast ×2'], ['s4', 'Egzekucja', 'boss poniżej 25% ❤️ → obrażenia ×1,5']] },
  { b: 'def', icon: '🛡️', name: 'Wytrwałość', nodes: [['t1', 'Twarda głowa', '+25 ❤️'], ['t2', 'Pancerz', '−15% obrażeń od bossa'], ['t3', 'Regeneracja', '„Łatwo” leczy 5 ❤️'], ['t4', 'Drugie życie', 'raz na walkę przeżyjesz z 1 ❤️']] },
  { b: 'mind', icon: '🧠', name: 'Mądrość', nodes: [['m1', 'Pisarz', 'wpisywanie: cios ×1,75 zamiast ×1,5'], ['m2', 'Opanowanie', '„Ledwo” nie przerywa serii'], ['m3', 'Alchemik', 'mikstury mocniejsze ×1,5 i +1 użycie'], ['m4', 'Łowca łupów', '+1 przedmiot w każdej skrzyni']] },
];
const SK_REQ_LV = [1, 3, 6, 10];   // od którego poziomu bohatera można kupić węzeł 1..4 w gałęzi
const hasSk = id => !!hero().sk[id];
const skPoints = () => heroLv() - Object.keys(hero().sk).length;   // 1 punkt na start + 1 za każdy kolejny poziom
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
  return { lv, hp: BOSS_ME_BASE + 5 * (lv - 1) + sum('hp') + (hasSk('t1') ? 25 : 0), atk: 1 + .02 * (lv - 1) + sum('atk') / 100 + forge * .06 + (hasSk('s1') ? .15 : 0),
    crit: (sum('crit') + (hasSk('s2') ? 10 : 0)) / 100, def: (sum('def') + (hasSk('t2') ? 15 : 0)) / 100, dodge: sum('dodge') / 100, loot: sum('loot') / 100, combo0: sum('combo'), weapon: w, forge };
}
function heroSVG(cls = '') {
  const h = hero(), w = h.eq.w, a = h.eq.a, c = h.eq.c;
  return `<div class="hero-fig ${cls}">${creatureSVG(h.look, heroLv() >= 10 ? 'legendary' : heroLv() >= 5 ? 'epic' : 'rare', { label: 'Twój bohater' })}
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
const bossArt = (b, cls = '') => `<div class="boss-art ${cls}">${creatureSVG(b.seed, b.stage >= 3 ? 'mythic' : 'epic', { boss: true, label: b.name })}</div>`;
let BOSS = null, BOSS_PICK = { mode: 'flip' };
try { Object.assign(BOSS_PICK, JSON.parse(localStorage.getItem('bossPick') || '{}')); } catch { /* */ }

function bossStart(deckId) {
  const d = deckById(deckId); if (!d) return;
  const b = deckBoss(d);
  if (b.learned < BOSS_REQ) return toast(`Ten boss budzi się przy ${BOSS_REQ} nauczonych fiszkach – masz ${b.learned}`, 4000);
  const now = Date.now(), cs = S.cards.filter(c => c.deckId === d.id && c.srs.state !== 'new' && noteById(c.noteId));
  const due = shuffle(cs.filter(c => c.srs.due <= now)), rest = shuffle(cs.filter(c => c.srs.due > now)).sort((a, x) => (x.srs.lapses - a.srs.lapses));
  const ids = [...due, ...rest].slice(0, b.len).map(c => c.id), hs = heroStats();
  BOSS = { b, ids, i: 0, hp: b.hp, max: b.hp, me: hs.hp, meMax: hs.hp, hs, combo: hs.combo0, best: 0, ok: 0, bad: 0, phase: 'fight', shown: false, mode: BOSS_PICK.mode,
    shownAt: now, lostHp: 0, timer: b.every, move: pickMove(b), shield: false, fog: false, power: 0, guard: false, potUsed: 0, second: hasSk('t4'), log: [] };
  go('#/boss/fight'); render();
}
const pickMove = b => { const opts = ['hit', ...b.abil.filter(a => a !== 'rage')]; const k = opts[Math.random() * opts.length | 0];
  return k === 'hit' ? { k, name: BOSS_MOVES[Math.random() * BOSS_MOVES.length | 0], dmg: b.atk + (Math.random() * 6 | 0) } : { k, name: BOSS_ABIL[k][1], dmg: k === 'heal' || k === 'shield' ? 0 : Math.round(b.atk * .5) }; };
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
    dmg = Math.round(dmg); B.hp = Math.max(0, B.hp - dmg); B.fx = { k: 'boss', n: dmg, crit: crit || comboM >= 2, t: now };
    if (g === 4 && hasSk('t3')) B.me = Math.min(B.meMax, B.me + 5);
  } else if (g === 2) { if (!hasSk('m2')) B.combo = 0; const d2 = Math.round(5 * B.hs.atk); B.hp = Math.max(0, B.hp - d2); B.fx = { k: 'boss', n: d2, t: now }; }
  else { B.combo = 0; B.bad++; B.missed = (B.missed || []).concat(c.id); hurtMe(Math.round(B.b.atk * .8), 'Kontra bossa'); }
  // tura bossa: odliczanie do zapowiedzianego ruchu
  if (B.hp > 0 && --B.timer <= 0) {
    const mv = B.move; B.bossAct = { k: mv.k, t: now };
    if (mv.k === 'hit') hurtMe(mv.dmg, mv.name);
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
  B.fxMe = { k: 'potion', t: Date.now() }; save(); render();
}
// ---------- skrzynia z łupami
function rollLoot(stage) {
  const odds = stage >= 5 ? { common: 10, rare: 35, epic: 38, legendary: 17 } : stage >= 3 ? { common: 25, rare: 40, epic: 28, legendary: 7 } : stage >= 1 ? { common: 45, rare: 38, epic: 15, legendary: 2 } : { common: 65, rare: 30, epic: 5, legendary: 0 };
  const x = Math.random() * 100;
  if (x < 35) { const r = rollRarity(odds), pool = Object.entries(GEAR).filter(([, g]) => g.r === r); const [id] = pool[Math.random() * pool.length | 0] || []; if (id) return { k: 'gear', id, r }; }
  if (x < 65) { const ks = Object.keys(POTIONS), k = ks[Math.random() * ks.length | 0]; return { k: 'potion', id: k, n: 1 + (stage >= 3 ? 1 : 0), r: 'rare' }; }
  if (x < 85) return { k: 'dust', n: 10 + 5 * stage, r: 'epic' };
  return { k: 'gems', n: 30 + 15 * stage, r: stage >= 3 ? 'legendary' : 'rare' };
}
function grantLoot(it, key) {
  if (it.k === 'gear') { if (ownsGear(it.id)) { it.dup = true; it.n = { common: 40, rare: 90, epic: 200, legendary: 500 }[it.r]; S.wallet.push({ id: key, n: it.n, why: 'loot-dup', t: Date.now() }); } else addItem('gear', it.id, 1, key); }
  if (it.k === 'potion') addItem('potion', it.id, it.n, key);
  if (it.k === 'dust') addDust(it.n, key);
  if (it.k === 'gems') S.wallet.push({ id: key, n: it.n, why: 'loot', t: Date.now() });
  if (it.k === 'egg') addItem('egg', 'boss', 1, key);
}
const lootHTML = it => it.k === 'gear' ? `${gearImg(it.id)}<b>${esc(GEAR[it.id].name)}</b><small>${it.dup ? `masz już → +${it.n} 💎` : RARITY[it.r].name}</small>`
  : it.k === 'potion' ? `${potionSVG(it.id)}<b>${POTIONS[it.id].name}${it.n > 1 ? ' ×' + it.n : ''}</b><small>${POTIONS[it.id].desc}</small>`
  : it.k === 'dust' ? `<span class="loot-big">✨</span><b>+${it.n} pyłu</b><small>do hologramów</small>` : it.k === 'egg' ? `<span class="loot-big">👑</span><b>Złote jajo</b><small>do inkubatora</small>` : `<span class="loot-big">💎</span><b>+${it.n}</b><small>kryształy</small>`;
function bossEnd(won) {
  const B = BOSS, b = B.b, d = deckById(b.deck); B.phase = won ? 'won' : 'lost'; B.me = Math.max(0, B.me);
  const flawless = won && B.lostHp === 0, hs = B.hs, key = `boss-${b.deck}-${b.stage}`;
  const xp = Math.round((B.ok * 6 + (won ? 60 + 30 * b.stage : 10)) * (1 + hs.loot));
  const lvBefore = heroLv(); hero().xp += xp; hero().mod = Date.now(); B.xp = xp;
  if (won) {
    const gems = 30 + 15 * b.stage; if (!S.wallet.some(w => w.id === key)) S.wallet.push({ id: key, n: gems, why: 'boss', t: Date.now() });
    const n = 1 + (b.stage >= 2 ? 1 : 0) + (b.stage >= 5 ? 1 : 0) + (hasSk('m4') ? 1 : 0) + (flawless ? 1 : 0);
    B.loot = Array.from({ length: n }, () => rollLoot(b.stage));
    if ((b.stage + 1) % 3 === 0) B.loot.push({ k: 'egg', r: 'legendary' });
    B.loot.forEach((it, i) => grantLoot(it, `${key}-l${i}-${uid()}`));
    if (B.loot.some(x => x.k === 'gear' && x.r === 'legendary' && !x.dup)) S.stats.lootLegend = 1;
    d.boss = { stage: b.stage + 1, wins: (d.boss?.wins || 0) + 1 }; touch(d);
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

// ---------- widoki
const hpBar = (v, max, cls) => `<div class="hpbar ${cls}"><i style="width:${Math.max(0, v / max * 100).toFixed(1)}%"></i><span>${Math.max(0, Math.round(v))} / ${max}</span></div>`;
const heroBarHTML = () => { const L = heroLvAt(hero().xp), sp = skPoints();
  return `<div class="card hero-bar row nowrap" data-go="#/hero">${heroSVG('sm')}<div class="grow"><b>Twój bohater · poz. ${L.lv}</b><div class="pbar"><i style="width:${(L.cur / L.need * 100).toFixed(1)}%"></i></div>
    <small class="muted">${sp ? `<b style="color:var(--accent)">${sp} ${plural(sp, 'punkt', 'punkty', 'punktów')} umiejętności do wydania!</b>` : 'ekwipunek · drzewko · kowal'}</small></div><span>›</span></div>`; };
const chestSVG = () => `<svg viewBox="0 0 120 100"><defs><linearGradient id="chw" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#b45309"/><stop offset="1" stop-color="#78350f"/></linearGradient></defs>
  <g class="chest-lid"><path d="M14 40C14 18 34 10 60 10S106 18 106 40Z" fill="url(#chw)" stroke="#451a03" stroke-width="3"/><path d="M14 40H106" stroke="#fbbf24" stroke-width="5"/><path d="M54 12V40M66 12V40" stroke="#fbbf24" stroke-width="4"/></g>
  <rect x="14" y="40" width="92" height="50" rx="6" fill="url(#chw)" stroke="#451a03" stroke-width="3"/><path d="M54 40V90M66 40V90" stroke="#fbbf24" stroke-width="4"/><rect x="52" y="48" width="16" height="16" rx="3" fill="#fde047" stroke="#92400e" stroke-width="2.5"/></svg>`;
ROUTES.boss = parts => {
  if (parts[1] !== 'fight' || !BOSS) {
    const ds = S.decks.map(d => ({ d, b: deckBoss(d) })).sort((x, y) => (y.b.learned >= BOSS_REQ) - (x.b.learned >= BOSS_REQ) || y.b.learned - x.b.learned);
    return { tab: 'arena', html: `
    <div class="row nowrap"><h1 class="grow" style="margin:0">🐉 Bossowie</h1>${coinsHTML()}</div>
    ${heroBarHTML()}
    <p class="small muted">Każda talia ma swojego bossa. Walczysz fiszkami, które już znasz – zaległe powtórki liczą się do harmonogramu. Pokonany wraca silniejszy, a z każdego etapu wypada skrzynia z łupami.</p>
    <div class="seg boss-mode"><button class="${BOSS_PICK.mode === 'flip' ? 'on' : ''}" data-act="boss-mode" data-m="flip">🃏 Fiszki</button><button class="${BOSS_PICK.mode === 'type' ? 'on' : ''}" data-act="boss-mode" data-m="type">⌨️ Wpisz · cios ×1,5</button></div>
    <div class="boss-list">${ds.map(({ d, b }) => { const ok = b.learned >= BOSS_REQ;
      return `<div class="card boss-row${ok ? '' : ' locked'}"><div class="boss-row-art">${bossArt(b)}</div><div class="grow"><div class="row nowrap"><b class="grow">${esc(b.name)}</b><span class="boss-lv">Etap ${b.stage + 1}</span></div>
        <small class="muted">${esc(b.title)}</small>
        <div class="boss-tags">${ok ? `<span>❤️ ${b.hp}</span><span>⚔️ ${b.atk}</span><span>🃏 ${b.len}</span>${b.abil.map(a => `<span title="${BOSS_ABIL[a][2]}">${BOSS_ABIL[a][0]} ${BOSS_ABIL[a][1]}</span>`).join('')}` : `<span>🔒 budzi się przy ${BOSS_REQ} nauczonych fiszkach (masz ${b.learned})</span>`}</div>
        ${ok ? `<button class="primary block" data-act="boss-start" data-id="${d.id}">⚔️ Walcz</button>` : `<div class="pbar"><i style="width:${b.learned / BOSS_REQ * 100}%"></i></div>`}</div></div>`; }).join('') || '<p class="muted">Dodaj talię z fiszkami, żeby obudzić pierwszego bossa.</p>'}</div>` };
  }
  const B = BOSS, b = B.b;
  if (B.phase !== 'fight') {
    const won = B.phase === 'won';
    return { tab: 'arena', focus: true, html: `
    <div class="card center boss-end ${won ? 'won' : 'lost'}">
      <div class="boss-stage ${won ? 'dead' : 'gloat'}">${bossArt(b)}${won ? '<div class="boss-boom"></div>' : ''}</div>
      <h2 style="margin:6px 0">${won ? `🏆 ${esc(b.name)} pokonany!` : `💀 ${esc(b.name)} wygrywa…`}</h2>
      <p class="small muted">${B.ok} dobrych · ${B.bad} błędów · najlepsza seria ${B.best} · +${B.xp} XP bohatera${won && B.flawless ? ' · <b>bez straty ❤️</b>' : ''}</p>
      ${won ? `<div class="chest-wrap"><div class="chest">${chestSVG()}</div><div class="loot">${B.loot.map((it, i) => `<div class="loot-it" style="--d:${.9 + i * .25}s;--rc:${RARITY[it.r || 'rare'].color}">${lootHTML(it)}</div>`).join('')}</div></div>
        <p class="small">+${B.gems} 💎 za etap ${b.stage + 1}. Następny etap: dłuższa walka i mocniejsze ataki.</p>` : '<p class="small">+3 ✨ pyłu na pocieszenie. Ulepsz bohatera albo kup mikstury i spróbuj znowu.</p>'}
      ${(B.missed || []).length ? `<button class="block" data-act="boss-cram">🔁 Powtórz ${B.missed.length} ${plural(B.missed.length, 'fiszkę', 'fiszki', 'fiszek')}, których nie pamiętałeś</button>` : ''}
      <div class="row" style="margin-top:10px"><button class="primary grow" data-act="boss-again">${won ? 'Następny etap ⚔️' : 'Spróbuj ponownie'}</button><button class="grow" data-go="#/hero">🧙 Bohater</button></div>
    </div>` };
  }
  const c = bossCard(), v = c ? cardView(c) : { q: '', a: '' }, now = Date.now(), fx = B.fx && now - B.fx.t < 900 ? B.fx : null, fm = B.fxMe && now - B.fxMe.t < 900 ? B.fxMe : null, act = B.bossAct && now - B.bossAct.t < 900 ? B.bossAct : null;
  const typedOK = B.mode === 'type' && v.ans && v.ans.length <= 120, mv = B.move;
  return { tab: 'arena', focus: true, html: `
  <div class="studybar"><button class="iconbtn" data-act="boss-quit">✕</button><div class="title">${esc(b.name)} · etap ${b.stage + 1}</div><span class="small muted">${B.i + 1}/${B.ids.length}</span></div>
  <div class="boss-fight${fm?.k === 'hit' ? ' shake-screen' : ''}">
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
  const h = hero(), L = heroLvAt(h.xp), st = heroStats(), sp = skPoints(), owned = Object.keys(GEAR).filter(ownsGear);
  return { tab: 'arena', html: `
  <div class="row nowrap"><button class="iconbtn" data-go="#/boss">‹</button><h1 class="grow" style="margin:0">🧙 Bohater</h1>${coinsHTML()}</div>
  <div class="card center hero-card">${heroSVG('lg')}
    <b style="font-size:20px">${esc(S.profile.nick || 'Bohater')} · poziom ${L.lv}</b>
    <div class="pbar" style="margin:8px 0 4px"><i style="width:${(L.cur / L.need * 100).toFixed(1)}%"></i></div><small class="muted">${Math.round(L.cur)} / ${Math.round(L.need)} XP do poziomu ${L.lv + 1}</small>
    <div class="hero-stats"><span>❤️ <b>${st.hp}</b></span><span>⚔️ <b>×${st.atk.toFixed(2)}</b></span><span>🎯 <b>${Math.round(st.crit * 100)}%</b></span><span>🛡️ <b>${Math.round(st.def * 100)}%</b></span>${st.dodge ? `<span>💨 <b>${Math.round(st.dodge * 100)}%</b></span>` : ''}</div>
    <button class="sm ghost" data-act="hero-look">🎲 Zmień wygląd</button></div>
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
  'boss-cram': () => { const ids = BOSS.missed || [], d = BOSS.b.deck; BOSS = null; SESSION = null; go(`#/study/${d}/flip?cram=list&ids=${ids.join(',')}`); },
  'hero-eq': el => { const g = GEAR[el.dataset.id], h = hero(); if (!g) return; h.eq[g.slot] = h.eq[g.slot] === el.dataset.id ? undefined : el.dataset.id; h.mod = Date.now(); save(); render(); },
  'hero-sk': el => { const h = hero(); if (skPoints() < 1) return; h.sk[el.dataset.id] = 1; h.mod = Date.now(); S.stats.skills = Object.keys(h.sk).length; if (SKILLS.some(b => b.nodes.every(([id]) => h.sk[id]))) S.stats.skillBranch = 1; save(); toast('🌳 Nowa umiejętność!'); render(); },
  'hero-look': () => { const h = hero(); h.look = 1 + (Math.random() * 1e6 | 0); h.mod = Date.now(); save(); render(); },
  'hero-forge': () => { const h = hero(), w = h.eq.w, f = h.forge[w] || 0; if (!w || f >= 5) return; if (!spend((f + 1) * 120, 'forge')) return; h.forge[w] = f + 1; h.mod = Date.now(); save(); toast(`🔨 ${GEAR[w].name} +${f + 1}`); render(); },
  'hero-buy-pot': el => { const p = POTIONS[el.dataset.k]; if (!spend(p.price, 'potion')) return; addItem('potion', el.dataset.k, 1); toast(`🧪 ${p.name} w ekwipunku`); render(); },
  'hero-buy-gear': el => { const id = el.dataset.id; if (ownsGear(id) || !spend(SHOP_GEAR[id], 'gear')) return; addItem('gear', id, 1); toast(`🎒 ${GEAR[id].name}`); render(); },
});
// Arena: zakładka „Bossowie”
if (typeof HUBS !== 'undefined' && !HUBS.arena.some(x => x[0] === 'boss')) { HUBS.arena.splice(1, 0, ['boss', '🐉', 'Bossowie']); HUB_OF.boss = 'arena'; HUB_OF.hero = 'arena'; }
// karta na Starcie: najbliższy boss
function bossHomeHTML() {
  const best = S.decks.map(d => deckBoss(d)).filter(b => b.learned >= BOSS_REQ).sort((a, b) => a.stage - b.stage)[0];
  if (!best) return '';
  return `<div class="card row nowrap boss-home" data-go="#/boss"><span class="boss-home-ic">${bossArt(best)}</span><div class="grow"><b>🐉 ${esc(best.name)} · etap ${best.stage + 1}</b>
    <div class="small muted">${esc(best.title)} – pokonaj go powtórkami</div></div><span>›</span></div>`;
}
const bossHome0 = homeExtrasHTML;
homeExtrasHTML = function () { return (appMode() === 'full' ? bossHomeHTML() : '') + bossHome0(); };
// przełącznik sekcji Areny nad listą bossów (hub.js owija trasy przed załadowaniem tego pliku)
const bossRoute0 = ROUTES.boss;
ROUTES.boss = (...a) => { const v = bossRoute0(...a); return !v || v.focus ? v : { ...v, tab: 'arena', html: (typeof hubNav === 'function' ? hubNav('arena', 'boss') : '') + v.html }; };

'use strict';
/* 👑 Prestiż: rzeczy, które WIDAĆ przy Tobie wszędzie (ranking, czat, klasa, pojedynek) – nie leżą w albumie.
   Rodzaje: ramki awatara, tytuły, efekty nicku, efekty pojedynku (wejście i wygrana),
   dymki czatu i reakcje premium. Zdobywasz je ze Skrzynki prestiżu (rzadkości: zwykły → mityczny) albo tylko za wyczyn
   (tytuły i ramki osiągnięć – nie do wylosowania). Legendarny / mityczny drop = ogłoszenie dla wszystkich, a kto pierwszy
   w aplikacji go zdobędzie – dostaje na zawsze tytuł ✦ Odkrywca. Animacje wyłączysz w Wyglądzie („Animacje prestiżu”).
   Założone rzeczy idą w profilu (stats.cos) – inni widzą tylko identyfikatory z katalogu (sCos), nic więcej. */

const COS_R = {
  common: { n: 'Zwykły', c: '#94a3b8', w: 50, dup: 20 }, rare: { n: 'Rzadki', c: '#3b82f6', w: 30, dup: 50 },
  epic: { n: 'Epicki', c: '#a855f7', w: 14, dup: 120 }, legendary: { n: 'Legendarny', c: '#f59e0b', w: 5, dup: 400 },
  mythic: { n: 'Mityczny', c: '#ef4444', w: 1, dup: 1500 },
};
const COS_T = { frame: ['🖼️', 'Ramki awatara'], title: ['🏷️', 'Tytuły'], nick: ['✒️', 'Efekty nicku'], skin: ['🎀', 'Dodatki bohatera'],
  aura: ['✨', 'Aury'], fx: ['🎆', 'Efekty pojedynku'], bubble: ['💬', 'Dymki czatu'], react: ['💥', 'Reakcje premium'] };
const COS_T1 = { frame: 'ramka awatara', title: 'tytuł', nick: 'efekt nicku', skin: 'dodatek bohatera', aura: 'aura', fx: 'efekt pojedynku', bubble: 'dymek czatu', react: 'reakcja premium' };
const typedOk = () => S.log.filter(l => l.m === 'type' && l.v === 'ok').length;
const matureN = () => S.cards.filter(c => (c.srs?.ivl || 0) >= 21).length;
const bestStreak = () => Math.max(typeof streak === 'function' ? streak() : 0, S.stats.bestStreak || 0);
const COS = [
  // 🖼️ ramki
  { id: 'f_wood', t: 'frame', n: 'Drewniana', r: 'common' }, { id: 'f_silver', t: 'frame', n: 'Srebrna', r: 'rare' },
  { id: 'f_mint', t: 'frame', n: 'Miętowa', r: 'rare' }, { id: 'f_sakura', t: 'frame', n: 'Sakura', r: 'epic' },
  { id: 'f_neon', t: 'frame', n: 'Neonowa', r: 'epic' }, { id: 'f_gold', t: 'frame', n: 'Złota', r: 'legendary' },
  { id: 'f_fire', t: 'frame', n: 'Płonąca', r: 'legendary' }, { id: 'f_galaxy', t: 'frame', n: 'Galaktyczna', r: 'mythic' },
  { id: 'f_laur', t: 'frame', n: 'Laur mędrca', r: 'epic', feat: { d: '1000 dobrze wpisanych odpowiedzi', p: () => [typedOk(), 1000] } },
  { id: 'f_flame', t: 'frame', n: 'Wieczny płomień', r: 'legendary', feat: { d: 'Seria 60 dni nauki', p: () => [bestStreak(), 60] } },
  // 🏷️ tytuły
  { id: 't_mol', t: 'title', n: 'Mól książkowy', r: 'common' }, { id: 't_kawa', t: 'title', n: 'Na kofeinie', r: 'common' },
  { id: 't_sowa', t: 'title', n: 'Nocny Marek', r: 'rare' }, { id: 't_blysk', t: 'title', n: 'Błyskawica', r: 'rare' },
  { id: 't_mozg', t: 'title', n: 'Mózgowiec', r: 'epic' }, { id: 't_geniusz', t: 'title', n: 'Geniusz', r: 'epic' },
  { id: 't_legenda', t: 'title', n: 'Legenda', r: 'legendary' }, { id: 't_niesm', t: 'title', n: 'Nieśmiertelny', r: 'mythic' },
  { id: 't_pogromca', t: 'title', n: 'Pogromca Bossów', r: 'rare', feat: { d: '25 pokonanych bossów', p: () => [S.stats.bossWins || 0, 25] } },
  { id: 't_gladiator', t: 'title', n: 'Gladiator', r: 'epic', feat: { d: '20 wygranych pojedynków 1 na 1', p: () => [S.stats.duelWins || 0, 20] } },
  { id: 't_nieomylny', t: 'title', n: 'Nieomylny', r: 'epic', feat: { d: '50 dobrze wpisanych odpowiedzi z rzędu', p: () => [S.stats.bestT || 0, 50] } },
  { id: 't_pamiec', t: 'title', n: 'Mistrz Pamięci', r: 'epic', feat: { d: '200 fiszek zapamiętanych na 3 tygodnie', p: () => [matureN(), 200] } },
  { id: 't_niezlomny', t: 'title', n: 'Niezłomny', r: 'legendary', feat: { d: 'Seria 30 dni nauki', p: () => [bestStreak(), 30] } },
  { id: 't_odkrywca', t: 'title', n: '✦ Odkrywca', r: 'mythic', feat: { d: 'Jako pierwszy w całej aplikacji zdobądź legendarny albo mityczny przedmiot', p: () => [(S.profile.disc || []).length ? 1 : 0, 1], special: 1 } },
  // ✒️ nick
  { id: 'n_mint', t: 'nick', n: 'Miętowy', r: 'common' }, { id: 'n_ocean', t: 'nick', n: 'Oceaniczny', r: 'rare' },
  { id: 'n_candy', t: 'nick', n: 'Cukierkowy', r: 'rare' }, { id: 'n_gold', t: 'nick', n: 'Złoty', r: 'epic' },
  { id: 'n_neon', t: 'nick', n: 'Neon', r: 'epic' }, { id: 'n_fire', t: 'nick', n: 'Ognisty', r: 'legendary' },
  { id: 'n_rainbow', t: 'nick', n: 'Tęczowy', r: 'mythic' },
  // 🎀 słodkie dodatki bohatera
  { id: 's_bow', t: 'skin', n: 'Kokardka', r: 'common', e: '🎀' }, { id: 's_cherry', t: 'skin', n: 'Wisienki', r: 'common', e: '🍒' },
  { id: 's_flower', t: 'skin', n: 'Wianek z kwiatów', r: 'rare', e: '🌸' }, { id: 's_hearts', t: 'skin', n: 'Serduszkowe okularki', r: 'rare', e: '💕' },
  { id: 's_crown', t: 'skin', n: 'Mała korona', r: 'epic', e: '👑' }, { id: 's_pastel', t: 'skin', n: 'Pastelowy', r: 'epic', e: '🫧' },
  { id: 's_cloud', t: 'skin', n: 'Chmurkowy', r: 'legendary', e: '☁️' }, { id: 's_gold', t: 'skin', n: 'Złoty maluch', r: 'legendary', e: '⭐' },
  { id: 's_rainbow', t: 'skin', n: 'Tęczowy jednorożek', r: 'mythic', e: '🦄' },
  // ✨ aury
  { id: 'a_hearts', t: 'aura', n: 'Serduszka', r: 'rare', e: '💗' }, { id: 'a_sparkle', t: 'aura', n: 'Iskierki', r: 'rare', e: '✨' },
  { id: 'a_snow', t: 'aura', n: 'Śnieżynki', r: 'epic', e: '❄️' }, { id: 'a_petals', t: 'aura', n: 'Płatki wiśni', r: 'epic', e: '🌸' },
  { id: 'a_fire', t: 'aura', n: 'Płomienie', r: 'legendary', e: '🔥' }, { id: 'a_cosmic', t: 'aura', n: 'Kosmos', r: 'mythic', e: '⭐' },
  // 🎆 efekty pojedynku (wejście na arenę i wygrana)
  { id: 'x_hearts', t: 'fx', n: 'Deszcz serc', r: 'rare', e: '💖' }, { id: 'x_stars', t: 'fx', n: 'Spadające gwiazdy', r: 'rare', e: '⭐' },
  { id: 'x_confetti', t: 'fx', n: 'Konfetti', r: 'epic', e: '🎉' }, { id: 'x_thunder', t: 'fx', n: 'Piorun', r: 'epic', e: '⚡' },
  { id: 'x_rainbow', t: 'fx', n: 'Tęcza', r: 'legendary', e: '🌈' }, { id: 'x_nova', t: 'fx', n: 'Supernowa', r: 'mythic', e: '💥' },
  // 💬 dymki czatu
  { id: 'b_mint', t: 'bubble', n: 'Miętowy', r: 'common' }, { id: 'b_candy', t: 'bubble', n: 'Cukierkowy', r: 'rare' },
  { id: 'b_pixel', t: 'bubble', n: 'Pikselowy', r: 'rare' }, { id: 'b_holo', t: 'bubble', n: 'Holograficzny', r: 'epic' },
  { id: 'b_gold', t: 'bubble', n: 'Złoty', r: 'legendary' }, { id: 'b_galaxy', t: 'bubble', n: 'Galaktyczny', r: 'mythic' },
  // 💥 reakcje premium (wysyłasz na czacie – wielkie i animowane)
  { id: 'r_heart', t: 'react', n: 'Bijące serce', r: 'common', e: '❤️' }, { id: 'r_fire', t: 'react', n: 'Ogień', r: 'rare', e: '🔥' },
  { id: 'r_clap', t: 'react', n: 'Brawa', r: 'rare', e: '👏' }, { id: 'r_100', t: 'react', n: 'Wybuch 💯', r: 'epic', e: '💯' },
  { id: 'r_crown', t: 'react', n: 'Koronacja', r: 'legendary', e: '👑' }, { id: 'r_unicorn', t: 'react', n: 'Tęczowy jednorożec', r: 'mythic', e: '🦄' },
];
// nowe tytuły (odznaki 8-bit) i reakcje
COS.push(
  { id: 't_prymus', t: 'title', n: 'Prymus', r: 'common' }, { id: 't_magnes', t: 'title', n: 'Magnes na wiedzę', r: 'common' },
  { id: 't_gwiazda', t: 'title', n: 'Gwiazda klasy', r: 'rare' }, { id: 't_sprinter', t: 'title', n: 'Sprinter', r: 'rare' },
  { id: 't_alchemik', t: 'title', n: 'Alchemik', r: 'rare' }, { id: 't_ratownik', t: 'title', n: 'Ratownik', r: 'rare' },
  { id: 't_snajper', t: 'title', n: 'Snajper', r: 'epic' }, { id: 't_magister', t: 'title', n: 'Magister', r: 'epic' },
  { id: 't_smok', t: 'title', n: 'Pogromca Smoków', r: 'legendary' }, { id: 't_diament', t: 'title', n: 'Diamentowy umysł', r: 'legendary' },
  { id: 't_zar', t: 'title', n: 'Żar nauki', r: 'common' }, { id: 't_sto', t: 'title', n: 'Stuprocentowy', r: 'rare' },
  { id: 't_czas', t: 'title', n: 'Strażnik Czasu', r: 'rare' }, { id: 't_wrozbita', t: 'title', n: 'Jasnowidz', r: 'epic' },
  { id: 't_weteran', t: 'title', n: 'Weteran', r: 'epic' }, { id: 't_aniol', t: 'title', n: 'Anioł Stróż', r: 'epic' },
  { id: 't_skarb', t: 'title', n: 'Łowca Skarbów', r: 'legendary' }, { id: 't_krol', t: 'title', n: 'Władca Fiszek', r: 'mythic' },
  { id: 'r_potion', t: 'react', n: 'Eliksir', r: 'epic', e: '🧪' }, { id: 'r_diamond', t: 'react', n: 'Diament', r: 'legendary', e: '💎' });
// 👾 grafiki 8-bit zamiast zwykłych emotek (assets/px8: b_* – odznaki tytułów, e_* – reakcje, efekty, aury)
const COS_IMG = {
  t_mol: 'b_feather', t_kawa: 'b_potion', t_sowa: 'b_wing', t_blysk: 'b_bolt', t_mozg: 'b_brain', t_geniusz: 'b_atom', t_legenda: 'b_crown', t_niesm: 'b_heartcrown',
  t_pogromca: 'b_swords', t_gladiator: 'b_shield', t_nieomylny: 'b_target', t_pamiec: 'b_dna', t_niezlomny: 'b_fire', t_odkrywca: 'b_comet',
  t_prymus: 'b_scroll', t_magnes: 'b_magnet', t_gwiazda: 'b_sparkle', t_sprinter: 'b_stopwatch', t_alchemik: 'b_flasks', t_ratownik: 'b_medkit',
  t_snajper: 'b_bow', t_magister: 'b_gradcap', t_smok: 'b_dragon', t_diament: 'b_ring',
  t_zar: 'b_fire2', t_sto: 'b_hundred', t_czas: 'b_hourglass', t_wrozbita: 'b_orb', t_weteran: 'b_swords2', t_aniol: 'b_wing2', t_skarb: 'b_chest', t_krol: 'b_crown2',
  x_hearts: 'e_heartdark', x_stars: 'e_shootstar', x_confetti: 'e_popper', x_thunder: 'e_bolt', x_rainbow: 'e_rainbow', x_nova: 'e_nova',
  r_heart: 'e_heartbeat', r_fire: 'e_fire', r_clap: 'e_clap', r_100: 'e_hundred', r_crown: 'e_crown', r_unicorn: 'e_unicorn', r_potion: 'e_potion', r_diamond: 'e_diamond',
  a_hearts: 'e_heartbeat', a_sparkle: 'e_star', a_fire: 'e_fire', a_cosmic: 'e_atom',
};
for (const c of COS) if (COS_IMG[c.id]) c.img = `assets/px8/${COS_IMG[c.id]}.webp`;
const cosPic = (c, cls = '') => c.img ? `<img class="px8 ${cls}" src="${c.img}" alt="" draggable="false">` : `<span class="${cls}">${c.e || COS_T[c.t][0]}</span>`;
// 🎀 dodatki bohatera wycofane (będą skiny postaci) – zdjęte z katalogu; kto je miał, dostaje zwrot w 💎 (raz)
const COS_GONE = COS.filter(c => c.t === 'skin' || c.t === 'aura');
for (let i = COS.length - 1; i >= 0; i--) if (COS[i].t === 'skin' || COS[i].t === 'aura') COS.splice(i, 1);
delete COS_T.skin; delete COS_T.aura;
on('start', () => {
  let n = 0; for (const c of COS_GONE) { const k = itemCount('cos', c.id); if (k > 0) { addItem('cos', c.id, -k, 'cosgone-' + c.id); n += COS_R[c.r].dup; } }
  for (const t of ['skin', 'aura']) if (S.profile.cos?.[t]) { delete S.profile.cos[t]; S.profile.mod = Date.now(); }
  if (n) { S.wallet.push({ id: 'cosgone-refund-' + uid(), n, why: 'cos-refund', t: Date.now() }); setTimeout(() => toast(`🎀 Dodatki i aury bohatera wycofane – zwrot +${n} 💎`, 4500), 1500); }
  if (n || COS_GONE.length) save();
});
const COS_BY = Object.fromEntries(COS.map(c => [c.id, c]));
const cosById = id => COS_BY[id] || null;
const COS_CASE_PRICE = 350;
const cosOwned = id => { const c = cosById(id); if (!c) return false; return c.feat ? cosFeatDone(c) || hasItem('cos', id) : hasItem('cos', id); };
const cosFeatDone = c => { if (!c.feat) return false; if (c.feat.special) return (S.profile.disc || []).length > 0; const [a, b] = c.feat.p(); return a >= b; };
// 🔒 cudze profile: tylko identyfikatory z katalogu, każdy w swoim slocie
function sCos(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const out = {};
  for (const t of Object.keys(COS_T)) { const id = x[t]; if (typeof id === 'string' && COS_BY[id]?.t === t) out[t] = id; }
  return Object.keys(out).length ? out : null;
}
// moje założone (tylko rzeczy, które naprawdę mam)
const myCos = () => { const c = sCos(S.profile.cos) || {}; for (const t of Object.keys(c)) if (!cosOwned(c[t])) delete c[t]; return Object.keys(c).length ? c : null; };
const cosAnimOn = () => S.settings.cosAnim !== false && S.settings.anim !== false;
function applyCosAnim() { document.body?.classList.toggle('cos-still', !cosAnimOn()); }
on('start', applyCosAnim);

// ---------- wygląd: awatar w ramce, nick z efektem i tytułem, klasy figury bohatera, dymki
const cosOf = p => p === S.profile ? myCos() : sCos(p?.cos || p?.stats?.cos);
const cosAv0 = avatarHTML;
avatarHTML = function (p, size = 28) {
  const inner = cosAv0(p, size), f = cosOf(p)?.frame; if (!f) return inner;
  return `<span class="avf fr-${f} r-${COS_BY[f].r}" style="--avs:${size}px">${inner}</span>`;
};
function cosTitleHTML(c) { const t = c?.title && COS_BY[c.title]; return t ? `<small class="ttl r-${t.r}" style="--rc:${COS_R[t.r].c}">${t.img ? `<img class="px8 ttl-ic" src="${t.img}" alt="">` : ''}${esc(t.n)}</small>` : ''; }
function nickHTML(name, c, title = true) {
  c = c === S.profile.cos ? myCos() : sCos(c);
  const n = c?.nick ? `<span class="nkx nk-${c.nick}">${esc(name)}</span>` : esc(name);
  return n + (title ? cosTitleHTML(c) : '');
}
const cosFigCls = c => { c = sCos(c); return c ? `${c.skin ? ' cskin cs-' + c.skin : ''}${c.aura ? ' caura ca-' + c.aura : ''}` : ''; };
const cosFigAttr = c => { c = sCos(c); const s = c?.skin && COS_BY[c.skin], a = c?.aura && COS_BY[c.aura]; return `${s ? ` data-acc="${s.e}"` : ''}${a ? (a.img ? ` data-aura="" style="--aimg:url(${a.img})"` : ` data-aura="${a.e}"`) : ''}`; };
// bohater: własne dodatki i aura na każdej figurze własnego bohatera (pojedynek ma swoje)
const cosHero0 = heroSVG;
heroSVG = function (cls = '', pr, h) {
  // aury i dodatki widać tylko na ekranach profilu (Bohater, Prestiż, pasek bohatera) – w walkach (rozmiar xs) nie
  const own = (h === undefined || h === hero()) && !/\bxs\b/.test(cls); let html = cosHero0(cls, pr, h);
  if (!own) return html; const c = myCos(); if (!c?.skin && !c?.aura) return html;
  return html.replace('<div class="hero-fig ', `<div${cosFigAttr(c)} class="hero-fig${cosFigCls(c)} `);
};

// ---------- 💠 Skrzynka prestiżu
function cosRoll() {
  const pool = COS.filter(c => !c.feat), tot = Object.values(COS_R).reduce((a, r) => a + r.w, 0);
  let x = Math.random() * tot, rar = 'common';
  for (const [k, r] of Object.entries(COS_R)) { if ((x -= r.w) < 0) { rar = k; break; } }
  const list = pool.filter(c => c.r === rar); return list[Math.random() * list.length | 0];
}
let COS_OPEN = null;
function cosOpenCase() {
  if (COS_OPEN) return;
  if (!spend(COS_CASE_PRICE, 'cos-case')) return;
  const win = cosRoll(), strip = Array.from({ length: 34 }, (_, i) => i === 29 ? win : cosRoll());
  const dup = hasItem('cos', win.id);
  if (dup) S.wallet.push({ id: 'cosdup-' + uid(), n: COS_R[win.r].dup, why: 'cos-dup', t: Date.now() }); else addItem('cos', win.id, 1);
  S.stats.cosCases = (S.stats.cosCases || 0) + 1; save();
  COS_OPEN = { win, dup };
  const ov = document.createElement('div'); ov.className = 'cos-ov';
  ov.innerHTML = `<div class="cos-spin"><div class="cos-strip">${strip.map(c => `<div class="cos-tile r-${c.r}" style="--rc:${COS_R[c.r].c}">${cosIconHTML(c)}<small>${esc(c.n)}</small></div>`).join('')}</div><i class="cos-mark"></i></div>`;
  document.body.append(ov);
  const el = ov.querySelector('.cos-strip'), w = ov.querySelector('.cos-tile')?.offsetWidth || 110;
  const stop = 29 * (w + 10) - (ov.querySelector('.cos-spin').offsetWidth / 2 - w / 2) + (Math.random() * w * .5 - w * .25);
  const dur = cosAnimOn() ? 4200 : 300;
  requestAnimationFrame(() => { el.style.transition = `transform ${dur}ms cubic-bezier(.12,.75,.12,1)`; el.style.transform = `translateX(${-stop}px)`; });
  if (typeof bossSfx === 'function' && cosAnimOn()) { let t = 0; const tick = () => { if (t > dur - 600) return; try { bossSfx('tick'); } catch { /* */ } t += 140 + t / 18; setTimeout(tick, 140 + t / 18); }; tick(); }
  setTimeout(() => cosReveal(ov), dur + 250);
}
function cosReveal(ov) {
  const { win, dup } = COS_OPEN, R = COS_R[win.r], big = win.r === 'legendary' || win.r === 'mythic';
  ov.classList.add('rev', 'r-' + win.r); ov.style.setProperty('--rc', R.c);
  ov.innerHTML = `<div class="cos-rev card r-${win.r}">${big ? '<i class="cos-rays"></i>' : ''}
    <small class="cos-rar" style="color:${R.c}">${R.n.toUpperCase()} · ${COS_T1[win.t]}</small>
    <div class="cos-big">${cosPreviewHTML(win, 96)}</div><h2>${esc(win.n)}</h2>
    ${dup ? `<p class="small muted">Masz już ten przedmiot – zamieniony na <b>+${R.dup} 💎</b></p>` : `<p class="small muted">${big ? (S.settings.showGlobal ? '🔥 Wow! To prawdziwa rzadkość – wszyscy zobaczą ogłoszenie.' : '🔥 Wow! To prawdziwa rzadkość!') : 'Nowy przedmiot w Prestiżu.'}</p>`}
    <div class="row nowrap">${dup ? '' : `<button class="primary grow" data-act="cos-equip" data-id="${win.id}" data-close="1">Załóż</button>`}<button class="grow" data-act="cos-close">${dup ? 'OK' : 'Później'}</button></div>
    ${big && !dup && !S.settings.showGlobal ? `<button class="block cos-ann" data-act="cos-announce" data-id="${win.id}">📣 Ogłoś wszystkim (i sprawdź, czy jesteś pierwszy ✦)</button><p class="small muted" style="margin:4px 0 0">Wszyscy zalogowani zobaczą Twój nick i ten przedmiot.</p>` : ''}
    <button class="ghost block" data-act="cos-again">Jeszcze raz (${COS_CASE_PRICE} 💎)</button></div>`;
  if (typeof bossSfx === 'function') try { bossSfx(big ? 'win' : 'chest'); } catch { /* */ }
  if (big && typeof confetti === 'function') confetti(win.r === 'mythic' ? 260 : 160);
  if (big && !dup && S.settings.showGlobal) cosAnnounce(win);
  COS_OPEN = null; render();
}

// ---------- 📣 ogłoszenia i ✦ Odkrywca (Supabase: cos_drops, cos_firsts)
let COS_FEED = [], cosFeedAt = 0;
async function cosAnnounce(item) {
  if (!(typeof cloudOn === 'function' && cloudOn())) return toast('🔥 Zaloguj się, żeby inni zobaczyli Twój drop', 3500);
  const nick = (S.profile.nick || 'Gracz').slice(0, 24);
  let first = false;
  try { const f = await SB.from('cos_firsts').insert({ item: item.id, user_id: myId(), nick }); first = !f.error; } catch { /* stara baza */ }
  try { await SB.from('cos_drops').insert({ user_id: myId(), nick, item: item.id, rarity: item.r, first }); } catch { /* */ }
  if (first) {
    S.profile.disc = [...new Set([...(S.profile.disc || []), item.id])].slice(-20); S.profile.mod = Date.now(); save();
    setTimeout(() => { celebrate('✦ Jesteś PIERWSZY w całej aplikacji!', `Nikt wcześniej nie zdobył: ${item.n}. Tytuł „✦ Odkrywca” jest Twój na zawsze.`); if (typeof confetti === 'function') confetti(300); }, 1800);
  }
  cosFeedAt = 0; cosLoadFeed();
}
async function cosLoadFeed() {
  if (!(typeof cloudOn === 'function' && cloudOn()) || Date.now() - cosFeedAt < 60e3) return;
  cosFeedAt = Date.now();
  try {
    const r = await SB.from('cos_drops').select('id,user_id,nick,item,rarity,first,created_at').gte('created_at', new Date(Date.now() - 3 * DAY).toISOString()).order('created_at', { ascending: false }).limit(20);
    if (r.error) return;
    COS_FEED = (r.data || []).map(x => ({ id: sInt(x.id, 0, 1e15), me: x.user_id === myId(), nick: sStr(x.nick, 24) || 'Gracz', item: cosById(x.item), first: !!x.first, t: Date.parse(x.created_at) || 0 })).filter(x => x.item);
    const seen = S.stats.cosSeen || 0, fresh = COS_FEED.filter(x => x.id > seen && !x.me);
    if (fresh.length && seen) { const x = fresh[0]; toast(`🔥 ${x.nick} wylosował(a) ${COS_R[x.item.r].n.toLowerCase()}: ${x.item.n}!${x.first ? ' ✦ pierwszy w aplikacji!' : ''}`, 4500); }
    if (COS_FEED[0]) { S.stats.cosSeen = Math.max(seen, COS_FEED[0].id); }
    rerenderIf(['', 'rank', 'cos']);
  } catch { /* brak tabeli – stara baza */ }
}
on('start', () => setTimeout(cosLoadFeed, 2500));
setInterval(() => { if (document.visibilityState === 'visible') cosLoadFeed(); }, 120e3);
const cosFeedHTML = (n = 3) => COS_FEED.length ? `<div class="cos-feed">${COS_FEED.slice(0, n).map(x => `<div class="cos-fd r-${x.item.r}" style="--rc:${COS_R[x.item.r].c}">${cosIconHTML(x.item)}<span class="grow">🔥 <b>${esc(x.nick)}</b> wylosował(a) <b style="color:${COS_R[x.item.r].c}">${esc(x.item.n)}</b>${x.first ? ' <em>✦ pierwszy w aplikacji</em>' : ''}</span><small>${ago(x.t)}</small></div>`).join('')}</div>` : '';

// ---------- 🏅 przedmioty za wyczyn: odblokowanie i powiadomienie
function cosFeatCheck(quiet) {
  S.stats.bestStreak = bestStreak();
  const got = S.stats.cosFeat || (S.stats.cosFeat = {});
  for (const c of COS) if (c.feat && !got[c.id] && cosFeatDone(c)) { got[c.id] = Date.now(); if (!quiet) setTimeout(() => celebrate(`🏅 Zdobyto: ${c.n}`, `${COS_T[c.t][1]} · ${c.feat.d} – załóż w 👑 Prestiżu`), 900); }
}
on('start', () => cosFeatCheck(true));
on('review', () => cosFeatCheck(false));
// najlepsza seria wpisanych dobrze z rzędu (tytuł „Nieomylny”)
if (typeof proofGems === 'function') { const pg0 = proofGems; proofGems = (s, ...a) => { pg0(s, ...a); if (s?.tStreak > (S.stats.bestT || 0)) S.stats.bestT = s.tStreak; }; }

// ---------- ikonki i podglądy przedmiotów
function cosIconHTML(c) {
  if (c.t === 'frame') return `<span class="cos-ic"><span class="avf fr-${c.id} r-${c.r}" style="--avs:30px"><span class="avemoji" style="font-size:26px">🦊</span></span></span>`;
  if (c.img) return `<span class="cos-ic">${cosPic(c)}</span>`;
  if (c.t === 'title') return `<span class="cos-ic">🏷️</span>`;
  if (c.t === 'nick') return `<span class="cos-ic"><b class="nkx nk-${c.id}">Aa</b></span>`;
  if (c.t === 'bubble') return `<span class="cos-ic"><i class="bbl bb-${c.id}">Hej</i></span>`;
  return `<span class="cos-ic">${c.e || COS_T[c.t][0]}</span>`;
}
function cosPreviewHTML(c, size = 64) {
  const nick = S.profile.nick || 'Ty';
  if (c.t === 'frame') return `<span class="avf fr-${c.id} r-${c.r}" style="--avs:${size}px">${cosAv0(S.profile, size)}</span>`;
  if (c.t === 'title') return `<div>${c.img ? `<img class="px8 cos-badge" src="${c.img}" alt="">` : ''}<b>${esc(nick)}</b><br>${cosTitleHTML({ title: c.id })}</div>`;
  if (c.t === 'nick') return `<b class="nkx nk-${c.id}" style="font-size:${Math.round(size / 2.6)}px">${esc(nick)}</b>`;
  if (c.t === 'bubble') return `<div class="msg me bb-${c.id} cos-bprev"><div class="msg-t">Widzimy się na nauce? 📚</div></div>`;
  if (c.t === 'react') return `<div class="rx rx-${c.id}"><span>${cosPic(c)}</span></div>`;
  if (c.t === 'fx') return `<div class="cos-fxprev" data-fx="${c.id}">${cosPic(c)}</div>`;
  const cc = c.t === 'skin' ? { skin: c.id } : { aura: c.id };
  return `<div${cosFigAttr(cc)} class="hero-fig cos-fig${cosFigCls(cc)}">${heroArt(heroLine(), heroForm(), hero().g === 'm' ? 'm' : 'w')}</div>`;
}

// ---------- 🎆 efekty pojedynku: wejście na arenę i wygrana (deszcz emoji nad postacią)
function cosBurst(host, emoji, n = 18, big = false) {
  if (!host || !cosAnimOn()) return;
  const box = document.createElement('div'); box.className = 'cos-burst' + (big ? ' big' : '');
  for (let i = 0; i < n; i++) { const s = document.createElement('i'); if (/^assets\//.test(emoji)) { const im = document.createElement('img'); im.src = emoji; im.className = 'px8'; s.append(im); } else s.textContent = emoji; s.style.cssText = `--x:${(Math.random() * 100).toFixed(1)}%;--d:${(Math.random() * .7).toFixed(2)}s;--s:${(.7 + Math.random() * .8).toFixed(2)};--r:${(Math.random() * 120 - 60) | 0}deg`; box.append(s); }
  host.append(box); setTimeout(() => box.remove(), 2600);
}
function cosDuelIntro(d) {
  setTimeout(() => {
    const ar = document.querySelector('.darena'); if (!ar || !cosAnimOn()) return;
    const me = myCos()?.fx, op = sCos(d.opp?.cos)?.fx;
    if (me) { cosBurst(ar.querySelector('.dplat.me'), COS_BY[me].img || COS_BY[me].e, 16); ar.querySelector('.duel-fig.me')?.classList.add('cos-enter'); }
    if (op) setTimeout(() => { cosBurst(ar.querySelector('.dplat.op'), COS_BY[op].img || COS_BY[op].e, 16); ar.querySelector('.duel-fig.op')?.classList.add('cos-enter'); }, me ? 700 : 0);
  }, 200);
}
function cosDuelWin(d) {
  setTimeout(() => {
    const ar = document.querySelector('.darena'); if (!ar || !cosAnimOn()) return;
    const fx = d.won ? myCos()?.fx : sCos(d.opp?.cos)?.fx; if (!fx) return;
    cosBurst(ar, COS_BY[fx].img || COS_BY[fx].e, fx === 'x_nova' ? 40 : 28, true); ar.classList.add('cos-win-' + fx);
  }, 300);
}

// ---------- 💥 reakcje premium na czacie
function cosReactHTML(b) { const c = cosById(b.rx); return c?.t === 'react' ? `<div class="rx rx-${c.id} r-${c.r}" style="--rc:${COS_R[c.r].c}"><span>${cosPic(c)}</span><small>${esc(c.n)}</small></div>` : '💥'; }

// ---------- 👑 Garderoba prestiżu
let COS_TAB = 'frame';
function cosSlotHTML(c) {
  const own = cosOwned(c.id), on = myCos()?.[c.t] === c.id, R = COS_R[c.r], sc = (S.profile.showcase || []).includes(c.id);
  const prog = c.feat && !own && !c.feat.special ? c.feat.p() : null;
  return `<div class="cos-item r-${c.r}${own ? '' : ' locked'}${on ? ' on' : ''}" style="--rc:${R.c}">
    <div class="cos-prev">${cosPreviewHTML(c, 54)}</div>
    <b>${esc(c.n)}</b><small class="cos-rar" style="color:${R.c}">${R.n}${c.feat ? ' · 🏅 za wyczyn' : ''}</small>
    ${c.feat && !own ? `<small class="muted">${esc(c.feat.d)}${prog ? ` (${Math.min(prog[0], prog[1])}/${prog[1]})` : ''}</small>${prog ? progress(prog[0] / prog[1], true) : ''}` : ''}
    ${own ? `<div class="row nowrap cos-btns">${c.t === 'react' ? '<small class="muted grow">wysyłasz na czacie 😀</small>' : `<button class="sm grow${on ? '' : ' primary'}" data-act="cos-equip" data-id="${c.id}">${on ? 'Zdejmij' : 'Załóż'}</button>`}<button class="sm${sc ? ' primary' : ''}" data-act="cos-show" data-id="${c.id}" title="Gablota na profilu">${sc ? '★' : '☆'}</button></div>` : c.feat ? '' : '<small class="muted">🔒 ze Skrzynki prestiżu</small>'}
  </div>`;
}
ROUTES.cos = () => {
  const ownN = COS.filter(c => cosOwned(c.id)).length, c = myCos();
  return { tab: 'profile', html: `
  <div class="row nowrap"><h1 class="grow">👑 Prestiż</h1>${typeof coinsHTML === 'function' ? coinsHTML() : ''}</div>
  <div class="card cos-me center"><div class="cos-me-av">${avatarHTML(S.profile, 72)}</div><div class="cos-me-nick">${nickHTML(S.profile.nick || 'Ty', S.profile.cos)}</div>
    <div class="row nowrap" style="justify-content:center;gap:16px;margin-top:10px">${heroSVG('sm')}<div class="msg me${c?.bubble ? ' bb-' + c.bubble : ''} cos-bprev"><div class="msg-t">Tak widzą mnie inni ✨</div></div></div>
    <p class="small muted" style="margin:10px 0 0">Masz ${ownN}/${COS.length} przedmiotów · ramkę, nick i tytuł widać w rankingu, czacie, klasie i pojedynkach</p></div>
  <div class="card cos-case-card"><div class="row nowrap"><div class="cos-case-ic">${crateImg('prest', 'cos-crate')}</div><div class="grow"><b>Skrzynka prestiżu</b><div class="small muted">Ramki, tytuły, nicki, efekty, dymki, reakcje.
    ${Object.entries(COS_R).map(([k, r]) => `<span style="color:${r.c};font-weight:700">${r.n} ${((r.w / Object.values(COS_R).reduce((a, x) => a + x.w, 0)) * 100).toFixed(r.w < 2 ? 1 : 0)}%</span>`).join(' · ')}</div></div></div>
    <button class="primary block cos-buy" data-act="cos-open">Otwórz – ${COS_CASE_PRICE} 💎</button>
    <p class="small muted" style="margin:8px 0 0">Duplikat = kryształy (do ${COS_R.mythic.dup} 💎). Legendarny i mityczny drop możesz ogłosić wszystkim (automatycznie, jeśli jesteś w publicznym rankingu), a kto pierwszy w aplikacji go zdobędzie – dostaje tytuł ✦ Odkrywca.</p></div>
  ${COS_FEED.length ? `<div class="card"><h3 style="margin-top:0">🔥 Ostatnie rzadkie dropy</h3>${cosFeedHTML(6)}</div>` : ''}
  <div class="seg cos-tabs">${Object.entries(COS_T).map(([k, [i, n]]) => `<button class="${COS_TAB === k ? 'on' : ''}" data-act="cos-tab" data-k="${k}"><i>${i}</i><span>${n.split(' ')[0]}</span></button>`).join('')}</div>
  <div class="cos-grid">${COS.filter(x => x.t === COS_TAB).sort((a, b) => (cosOwned(b.id) - cosOwned(a.id)) || Object.keys(COS_R).indexOf(a.r) - Object.keys(COS_R).indexOf(b.r)).map(cosSlotHTML).join('')}</div>
  <div class="card small muted">☆ dodaje przedmiot do <b>gabloty</b> (max 3, razem z naklejkami) – widać ją przy nicku w rankingu i bitwach.
    ${COS_TAB === 'react' ? '<br>Reakcje wysyłasz na czacie: 😀 GIF → ✨ Reakcje premium.' : ''}${!cosAnimOn() ? '<br>Animacje prestiżu są wyłączone (Ustawienia → Wygląd).' : ''}</div>` };
};
HUB_OF.cos = 'profile';
if (Array.isArray(HUBS.profile) && !HUBS.profile.some(x => x[0] === 'cos')) HUBS.profile.splice(1, 0, ['cos', '👑', 'Prestiż']);
const cosRoute0 = ROUTES.cos;
ROUTES.cos = (...a) => { const v = cosRoute0(...a); if (typeof hubNav !== 'function') return v; LAST_HUB.profile = 'cos';
  return { ...v, html: hubNav('profile', 'cos') + (typeof stripBack === 'function' ? stripBack(v.html) : v.html) }; };

Object.assign(ACTIONS, {
  'cos-open': () => cosOpenCase(),
  'pp-cos': () => { if (typeof ppClose === 'function') ppClose(); go('#/cos'); },
  'cos-again': () => { document.querySelector('.cos-ov')?.remove(); cosOpenCase(); },
  'cos-announce': el => { const c = cosById(el.dataset.id); if (!c || !hasItem('cos', c.id)) return; el.disabled = true; el.textContent = '📣 Ogłoszono!'; cosAnnounce(c); },
  'cos-close': () => document.querySelector('.cos-ov')?.remove(),
  'cos-tab': el => { COS_TAB = el.dataset.k; render(); },
  'cos-equip': el => {
    const c = cosById(el.dataset.id); if (!c || !cosOwned(c.id)) return;
    const cur = { ...(S.profile.cos || {}) };
    if (cur[c.t] === c.id && !el.dataset.close) delete cur[c.t]; else cur[c.t] = c.id;
    S.profile.cos = cur; S.profile.mod = Date.now(); if (typeof publishAt !== 'undefined') publishAt = 0; save();
    if (el.dataset.close) document.querySelector('.cos-ov')?.remove();
    toast(cur[c.t] ? `✓ Założono: ${c.n}` : `Zdjęto: ${c.n}`, 1600); render();
  },
  'cos-show': el => {
    const id = el.dataset.id, sc = [...(S.profile.showcase || [])], i = sc.indexOf(id);
    if (i >= 0) sc.splice(i, 1); else { if (sc.length >= 3) sc.shift(); sc.push(id); }
    S.profile.showcase = sc; S.profile.mod = Date.now(); save(); render();
  },
  'cos-rx': async el => {
    const c = cosById(el.dataset.id); if (!c || !cosOwned(c.id) || typeof sendMsg !== 'function' || !CHAT?.fid) return;
    const r = await sendMsg(CHAT.fid, 'text', { rx: c.id }); if (r) { CHAT.pick = false; render(); }
  },
});

// ---------- podpięcie do reszty aplikacji
// sklep: karta Skrzynki prestiżu nad skrzynkami z naklejkami
const cosShop0 = ROUTES.shop;
ROUTES.shop = (...a) => { const v = cosShop0(...a); if (!v?.html) return v;
  const card = `<div class="card cos-case-card row nowrap" data-go="#/cos" style="cursor:pointer"><div class="cos-case-ic">${crateImg('prest', 'cos-crate')}</div><div class="grow"><b>Skrzynka prestiżu</b><div class="small muted">Rzeczy, które widać przy Tobie wszędzie: ramki, tytuły, efekty nicku, aury… Od zwykłych po mityczne.</div></div><span>›</span></div>`;
  return { ...v, html: v.html.replace('<div class="card case-groups">', card + '<div class="card case-groups">') }; };
// czat: dymki (moje i znajomego) + reakcje premium w wyborze emotek
const cosChat0 = ROUTES.chat;
ROUTES.chat = (...a) => {
  const v = cosChat0(...a); if (!v?.html) return v;
  const f = typeof friendById === 'function' ? friendById(a[0]?.[1]) : null, mine = myCos()?.bubble, theirs = sCos(f?.stats?.cos)?.bubble;
  let h = v.html;
  if (mine) h = h.replaceAll('<div class="msg me ', `<div class="msg me bb-${mine} `);
  if (theirs) h = h.replaceAll('<div class="msg them ', `<div class="msg them bb-${theirs} `);
  if (f) h = h.replace(`${esc(f.nick || 'Znajomy')}</h1>`, `${nickHTML(f.nick || 'Znajomy', f.stats?.cos)}</h1>`);
  const rx = COS.filter(c => c.t === 'react' && cosOwned(c.id));
  if (h.includes('class="emo-row"')) h = h.replace('<b class="small">🃏 Naklejki</b>', `<b class="small">✨ Reakcje premium</b>${rx.length ? `<div class="rx-row">${rx.map(c => `<button data-act="cos-rx" data-id="${c.id}" class="r-${c.r}" style="--rc:${COS_R[c.r].c}" title="${esc(c.n)}">${cosPic(c)}</button>`).join('')}</div>` : '<p class="small muted" style="margin:4px 0">Animowane reakcje zdobywasz w Skrzynce prestiżu (<a href="#/cos">👑 Prestiż</a>).</p>'}<b class="small">🃏 Naklejki</b>`);
  return { ...v, html: h };
};
// start: najnowsze rzadkie dropy
const cosHome0 = homeExtrasHTML;
homeExtrasHTML = function () { const h = cosHome0(); return COS_FEED.length && Date.now() - COS_FEED[0].t < DAY ? `<div class="card tight">${cosFeedHTML(2)}</div>` + h : h; };
// ustawienia wyglądu: wyłącznik animacji prestiżu
const cosPers0 = personalHTML;
personalHTML = function () { return cosPers0().replace(/<\/div>\s*$/, `<label class="check"><input type="checkbox" data-cosanim="1" ${S.settings.cosAnim !== false ? 'checked' : ''}> 👑 Animacje prestiżu (ramki, aury, efekty w pojedynku, losowanie)</label></div>`); };
document.addEventListener('change', e => { if (e.target.dataset?.cosanim) { S.settings.cosAnim = e.target.checked; applyCosAnim(); save(); } });

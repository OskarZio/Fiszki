'use strict';
/* 🗼 Wieża (hardcore) – jak wieża w Mortal Kombat: piętro za piętrem, coraz trudniejsi bossowie, ❤️ przechodzi dalej
   (po piętrze wraca część). Po każdym piętrze 1 z 3 błogosławieństw. Podwójne XP i 💎 dostajesz od razu za każde piętro.
   Śmierć albo ucieczka = GAME OVER: wspinaczka, piętro i błogosławieństwa przepadają – zostaje tylko rekord.
   Serca nie giną. Walczysz wszystkimi nauczonymi fiszkami. Co 5. piętro – strażnik (mocniejszy boss). */

// wybór trybu (ABCD ×0,5 · Fiszki · Wpisz ×1,5 · Mix) – ten sam co u bossów, zapamiętany
const towerModes = () => `<div class="mode-pick tower-modes">${Object.entries(MODES).map(([k, m]) => `<button class="${BOSS_PICK.mode === k ? 'on' : ''}" data-act="boss-mode" data-m="${k}"><span>${m.icon}</span><b>${m.name}</b><small>cios ${m.mul}</small></button>`).join('')}</div>`;
// ⚔️ broń wspinaczki: tryb wybrany przy wejściu zostaje do końca (game over → wybierasz od nowa)
const towerWeaponHTML = T => { const m = MODES[T.mode] || MODES.flip; return `<div class="tower-weapon">${m.icon} <b>Broń: ${m.name}</b><small>cios ${m.mul} · do końca wspinaczki</small></div>`; };
const TOWER_REQ = 30, TOWER_GUARD = 5;
// błogosławieństwa: [ikona, nazwa, opis, rzadkie?] – rzadkie (epickie) losują się rzadziej, ale są mocniejsze
const BLESS = {
  heal: ['❤️', 'Odpoczynek', 'leczy 50% ❤️'], dmg: ['⚔️', 'Ostrze', '+12% obrażeń'], crit: ['🎯', 'Oko sokoła', '+8% krytyka'],
  maxhp: ['🛡️', 'Hart ducha', '+25 ❤️ maks. i leczy 25'], dodge: ['💨', 'Cień', '+10% uniku'], time: ['⏳', 'Spokój', '+40% czasu na pytanie'],
  vamp: ['🧛', 'Krew wampira', '10% zadanych obrażeń wraca jako ❤️'], thorns: ['🌵', 'Kolczasta zbroja', 'odbijasz 25% obrażeń'],
  combo: ['🔥', 'Rozpęd', 'seria rośnie 2× szybciej'], guard: ['🔰', 'Tarcza na start', 'każde piętro zaczynasz z 2 blokami'],
  ult: ['⚡', 'Burza', 'supercios ładuje się o 2 odpowiedzi szybciej', 1], phoenix: ['🕊️', 'Feniks wieży', 'raz w wieży wstajesz z 40% ❤️', 1],
  gamble: ['🎲', 'Rzut kością', '50/50: pełne ❤️ albo −30% ❤️', 1], pact: ['💀', 'Pakt krwi', '+30% obrażeń, ale −30% ❤️', 1], gold: ['💰', 'Chciwość', 'od teraz +50% XP i 💎 za piętro'],
};
const FLOOR_HEAL = .35;   // po każdym piętrze wraca 35% ❤️
// TW_GK: ta sama wieża, ale z pytaniami z wiedzy ogólnej (gk.js) – osobna wspinaczka i rekord
let TW_GK = false;
const twKey = () => TW_GK ? 'gtower' : 'tower', twBestKey = () => TW_GK ? 'gtowerBest' : 'towerBest';
const tower = () => hero()[twKey()] || null;
const towerBest = () => S.stats[twBestKey()] || 0;
function towerBoss(T) {
  const f = T.floor, guard = f % TOWER_GUARD === 0, pool = guard ? FINAL_IDX : CHAPTER_IDX.concat(WORLD_IDX);
  const bo = bossOf(pool[(f * 7 + (T.seed || 0)) % pool.length]), { name, desc, img, persona } = bo;
  if (TW_GK) { const len = Math.min(16, 5 + f), cs = gkPick(T, len);
    return { kind: 'tower', id: 'gtower', i: f, gk: true, weak: null, name: guard ? `${name} – strażnik piętra` : name, desc, img, persona, seed: 777 + f * 131, diff: Math.min(4, Math.floor(f / 3)), stars: 0,
      cards: cs, ok: true, repeat: false, pr: hero().pr || 0, len, title: `🧠 Wieża wiedzy · piętro ${f}${guard ? ' · strażnik' : ''}`, final: guard }; }
  const cs = S.cards.filter(c => fightable(c) && c.srs.state !== 'new');
  return { kind: 'tower', id: 'tower', i: f, name: guard ? `${name} – strażnik piętra` : name, desc, img, persona, seed: 4242 + f * 131, diff: Math.min(4, Math.floor(f / 3)), stars: 0,
    cards: cs, ok: cs.length >= TOWER_REQ, repeat: false, pr: hero().pr || 0, len: Math.min(20, 6 + f), title: `🗼 Wieża · piętro ${f}${guard ? ' · strażnik' : ''}`, final: guard };
}
function towerFloor() {
  const T = tower(); if (!T) return;
  const b = towerBoss(T); if (!b.ok) return toast(`Wieża wymaga ${TOWER_REQ} nauczonych fiszek`);
  const hs = heroStats(), u = T.buff; hs.atk *= 1 + (u.dmg || 0); hs.crit = Math.min(.7, hs.crit + (u.crit || 0)); hs.hp += u.hp || 0;
  hs.dodge = Math.min(.5, hs.dodge + (u.dodge || 0)); hs.time *= 1 + (u.time || 0); hs.vamp += u.vamp || 0; hs.thorns += u.thorns || 0;
  hs.combo *= 1 + (u.combo || 0); hs.ultNeed = Math.max(2, hs.ultNeed - (u.ult || 0)); if (u.phoenix && !T.phoenixUsed) hs.second = true;
  if (!T.mode) T.mode = TW_GK ? 'abcd' : BOSS_PICK.mode;
  const p = bossParams(b, T.mode); p.hp = Math.round(p.hp * (1 + .06 * T.floor) * (TW_GK ? 1.7 : 1)); p.atk = Math.round(p.atk * (1 + .04 * T.floor));
  T.hp = Math.min(T.hp, hs.hp);
  bossBegin(b, { tower: true, hs, me: T.hp, meMax: hs.hp, guard: u.guard ? 2 : 0, mode: T.mode }, p);
  if (u.phoenix && !T.phoenixUsed) BOSS.second = true;
}
function towerStart() {
  if (!TW_GK && learnedAll() < TOWER_REQ) return toast(`🗼 Wieża otwiera się przy ${TOWER_REQ} nauczonych fiszkach (masz ${learnedAll()})`, 4000);
  if (!confirm(TW_GK ? '🧠 Wieża wiedzy – quiz z wiedzy ogólnej.\n\nPiętro za piętrem coraz trudniejsze pytania ABCD: geografia, historia, nauka, kultura, sport… Po piętrze wraca 35% ❤️.\n\nŚmierć albo ucieczka = GAME OVER. Wchodzisz?' : '🗼 Wieża – tryb hardcore.\n\nPiętro za piętrem, coraz trudniej. Po piętrze wraca tylko 35% ❤️. Za każde piętro podwójne XP i 💎.\n\nŚmierć albo ucieczka = GAME OVER – zaczynasz od parteru. Wchodzisz?')) return;
  const h = hero(); h[twKey()] = { floor: 1, used: [], mode: TW_GK ? 'abcd' : BOSS_PICK.mode, hp: heroStats().hp, bank: { xp: 0, gems: 0 }, buff: {}, seed: Math.random() * 1000 | 0, t: Date.now() }; h.mod = Date.now(); save();
  towerFloor();
}
function towerEnd(B, won) {
  TW_GK = !!B.b.gk;
  const h = hero(), T = h[twKey()]; if (!T) return;
  if (won) {
    const f = T.floor, xp = Math.round((B.ok * 3 + 30 + 15 * f) * (TW_GK ? 1 : 2) * xpMul()), gems = Math.round((8 + 4 * f) * gemMul());
    const m = 1 + (T.buff.gold || 0), gx = Math.round(xp * m), gg = Math.round(gems * m);
    giveXP(gx, 'wieża'); S.wallet.push({ id: 'tower-' + uid(), n: gg, why: 'tower', t: Date.now() });
    T.bank.xp += gx; T.bank.gems += gg; B.towerGain = { xp: gx, gems: gg };
    if (T.buff.phoenix && !B.second) T.phoenixUsed = true;
    B.towerHeal = Math.round(B.meMax * FLOOR_HEAL); T.hp = Math.min(B.meMax, Math.round(B.me + B.towerHeal)); T.floor = f + 1;
    S.stats[twBestKey()] = Math.max(towerBest(), f); S.stats.bossWins = (S.stats.bossWins || 0) + 1;
    // 3 do wyboru; rzadkie mają mniejszą szansę, jedno miejsce zawsze dla czegoś leczącego, gdy ❤️ < 50%
    const pool = shuffle(Object.keys(BLESS).filter(k => !(k === 'phoenix' && T.buff.phoenix) && (!BLESS[k][3] || Math.random() < .35)));
    T.pick = pool.slice(0, 3); if (T.hp < B.meMax / 2 && !T.pick.some(k => k === 'heal' || k === 'maxhp')) T.pick[2] = 'heal';
  } else {
    B.towerLost = { floor: T.floor, ...T.bank }; S.stats[twBestKey()] = Math.max(towerBest(), T.floor - 1); delete h[twKey()];
  }
  h.mod = Date.now();
}
function towerBless(k) {
  const T = tower(); if (!T?.pick?.includes(k)) return;
  const u = T.buff, mx = heroStats().hp + (u.hp || 0), add = (key, v) => { u[key] = (u[key] || 0) + v; };
  if (k === 'heal') T.hp = Math.min(mx, T.hp + Math.round(mx * .5));
  if (k === 'dmg') add('dmg', .12); if (k === 'crit') add('crit', .08); if (k === 'dodge') add('dodge', .1); if (k === 'time') add('time', .4);
  if (k === 'maxhp') { add('hp', 25); T.hp += 25; } if (k === 'vamp') add('vamp', .1); if (k === 'thorns') add('thorns', .25); if (k === 'combo') add('combo', 1);
  if (k === 'guard') u.guard = 1; if (k === 'ult') add('ult', 2); if (k === 'phoenix') u.phoenix = 1;
  if (k === 'gamble') { const win = Math.random() < .5; T.hp = win ? mx : Math.max(1, Math.round(T.hp * .7)); toast(win ? '🎲 Wygrana! Pełne ❤️' : '🎲 Pech… −30% ❤️', 3000); }
  if (k === 'pact') { add('dmg', .3); T.hp = Math.max(1, Math.round(T.hp * .7)); }
  if (k === 'gold') add('gold', .5);
  T.pick = null; T.last = k; hero().mod = Date.now(); save(); render();
}
// aktywne błogosławieństwa – krótko pod paskiem ❤️
const towerBuffsHTML = T => { const u = T.buff, L = [u.dmg && `⚔️ +${Math.round(u.dmg * 100)}%`, u.crit && `🎯 +${Math.round(u.crit * 100)}%`, u.dodge && `💨 ${Math.round(u.dodge * 100)}%`, u.vamp && `🧛 ${Math.round(u.vamp * 100)}%`,
  u.thorns && `🌵 ${Math.round(u.thorns * 100)}%`, u.combo && '🔥 rozpęd', u.guard && '🔰 2 bloki', u.ult && `⚡ −${u.ult}`, u.phoenix && (T.phoenixUsed ? '🕊️ zużyty' : '🕊️ feniks'), u.time && `⏳ +${Math.round(u.time * 100)}%`, u.hp && `🛡️ +${u.hp}`, u.gold && `💰 +${Math.round(u.gold * 100)}%`].filter(Boolean);
  return L.length ? `<div class="boss-tags" style="justify-content:center;margin:6px 0">${L.map(x => `<span>${x}</span>`).join('')}</div>` : ''; };
const towerCardHTML = () => { TW_GK = false; const T = tower();
  return `<div class="card row nowrap tower-cta" data-go="#/tower"><span class="tower-ic">🗼</span><div class="grow"><b>Wieża – hardcore</b><div class="small muted">${T ? `W trakcie: piętro ${T.floor} · zdobyte +${T.bank.xp} XP, +${T.bank.gems} 💎` : `Ile pięter przetrwasz? Rekord: ${towerBest() || '—'} · podwójne XP, śmierć = game over`}</div></div><span>›</span></div>`; };
function towerAfterView() {
  TW_GK = !!BOSS.b.gk;
  const B = BOSS, T = tower(), modes = () => TW_GK ? '' : towerModes();
  if (B.towerLost) { const L = B.towerLost;
    return { tab: 'arena', focus: true, html: `<div class="card center boss-end lost"><div class="boss-stage gloat">${bossArt(B.b)}</div>${B.say?.txt ? `<div class="boss-say end">${esc(B.say.txt)}</div>` : ''}
      <h2 class="game-over">GAME OVER</h2><p>Padłeś na piętrze <b>${L.floor}</b>. Wspinaczka i błogosławieństwa przepadają.</p><p class="small muted">Zdobyte w tej wspinaczce: +${L.xp} XP, +${L.gems} 💎 · rekord: piętro ${towerBest()}${L.floor - 1 >= towerBest() && L.floor > 1 ? ' 🏆 nowy rekord!' : ''}</p>
      ${modes()}<div class="row" style="margin-top:10px"><button class="primary grow" data-act="tower-start">${TW_GK ? '🧠' : '🗼'} Od nowa</button><button class="grow" data-act="boss-map">🗺️ Mapa</button></div></div>` };
  }
  const g = B.towerGain || { xp: 0, gems: 0 };
  return { tab: 'arena', focus: true, html: `<div class="card center boss-end won"><div class="boss-stage dead">${bossArt(B.b)}<div class="boss-boom"></div></div>
    <h2>${TW_GK ? '🧠' : '🗼'} Piętro ${T.floor - 1} zdobyte!</h2><p class="small">+${g.xp} XP, +${g.gems} 💎 · w tej wspinaczce razem <b>+${T.bank.xp} XP, +${T.bank.gems} 💎</b></p>
    <div class="tower-hp">${HP_BAR(T.hp, heroStats().hp + (T.buff.hp || 0), 'me')}</div><p class="small muted" style="margin:4px 0">❤️ +${B.towerHeal || 0} za ukończone piętro</p>${towerBuffsHTML(T)}
    ${T.pick ? `<h3>Wybierz błogosławieństwo</h3><div class="bless">${T.pick.map(k => `<button class="${BLESS[k][3] ? 'epic' : ''}" data-act="tower-bless" data-k="${k}">${BLESS[k][3] ? '<em>RZADKIE</em>' : ''}<span>${BLESS[k][0]}</span><b>${BLESS[k][1]}</b><small>${BLESS[k][2]}</small></button>`).join('')}</div>`
      : `${TW_GK ? '' : towerWeaponHTML(T)}<button class="primary block boss-go" data-act="tower-next" style="margin-top:10px">⚔️ Piętro ${T.floor}${T.floor % TOWER_GUARD === 0 ? ' – strażnik!' : ''}</button>`}</div>` };
}
ROUTES.tower = () => { TW_GK = false; const T = tower();
  return { tab: 'arena', html: `<div class="row nowrap"><button class="iconbtn" data-go="#/boss">‹</button><h1 class="grow" style="margin:0">🗼 Wieża – hardcore</h1>${coinsHTML()}</div>
  <div class="card center"><div style="font-size:64px">🗼</div><p style="margin:4px 0"><b>Ile pięter przetrwasz?</b> Każde piętro to trudniejszy boss, a ❤️ nie odnawia się między walkami.</p>
    <ul class="small" style="text-align:left"><li><b>×2 XP</b> i 💎 dostajesz od razu za każde piętro.</li><li>Po piętrze wraca 35% ❤️ i wybierasz 1 z 3 błogosławieństw.</li><li>Co ${TOWER_GUARD}. piętro – strażnik, mocniejszy boss.</li><li><b>Śmierć albo ucieczka = GAME OVER</b> – od nowa od parteru. Serca zostają.</li></ul>
    <p class="small muted">Rekord: piętro ${towerBest() || '—'} · walczysz wszystkimi nauczonymi fiszkami (${learnedAll()}/${TOWER_REQ})</p></div>
  ${T ? `<div class="card"><b>W trakcie: piętro ${T.floor}</b><div class="small muted">Zdobyte w tej wspinaczce: +${T.bank.xp} XP, +${T.bank.gems} 💎</div>${HP_BAR(T.hp, heroStats().hp + (T.buff.hp || 0), 'me')}${towerBuffsHTML(T)}
    ${towerWeaponHTML(T)}<button class="primary block" data-act="tower-next" style="margin-top:10px">⚔️ Walcz dalej</button></div>`
    : `<div class="card"><h3 style="margin-top:0">⚔️ Wybierz broń na całą wspinaczkę</h3>${towerModes()}<p class="small muted" style="margin:8px 0 0">Trybu nie zmienisz aż do końca – jak broń w rogaliku.</p></div><button class="primary block boss-go" data-act="tower-start" ${learnedAll() >= TOWER_REQ ? '' : 'disabled'}>🗼 Wejdź do wieży</button>`}` }; };
const twRoute0 = ROUTES.boss;
ROUTES.boss = (...a) => BOSS?.b?.kind === 'tower' && BOSS.phase !== 'fight' && a[0]?.[1] === 'fight' ? towerAfterView() : twRoute0(...a);
const twQuit0 = ACTIONS['boss-quit'];
ACTIONS['boss-quit'] = el => {
  if (BOSS?.b?.kind !== 'tower' || BOSS.phase !== 'fight') return twQuit0(el);
  if (!confirm('Ucieczka z wieży = GAME OVER. Na pewno?')) return;
  bossEnd(false, 'dead');
};
// mapa bossów: karta wieży nad taliami
const twMap0 = ROUTES.boss;
ROUTES.boss = (...a) => { const v = twMap0(...a); if (!v?.html || v.focus) return v; return { ...v, html: v.html.replace('<h2 class="bm-h">📚 Twoje talie', towerCardHTML() + '<h2 class="bm-h">📚 Twoje talie') }; };
Object.assign(ACTIONS, {
  'tower-start': () => { BOSS = null; towerStart(); },
  'tower-next': () => { BOSS = null; towerFloor(); },
  'tower-bless': el => towerBless(el.dataset.k),
});
HUB_OF.tower = 'arena';

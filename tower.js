'use strict';
/* 🗼 Wieża (hardcore) – jak wieża w Mortal Kombat: piętro za piętrem, coraz trudniejsi bossowie, ❤️ przechodzi dalej.
   Po każdym piętrze wybierasz 1 z 3 błogosławieństw. Nagrody (podwójne XP i 💎) zbierają się w skarbcu –
   zabierasz je tylko schodząc na punkcie kontrolnym (co 5 pięter). Śmierć albo ucieczka = cały skarbiec przepada.
   Serca nie giną – tu stawką jest skarbiec. Walczysz wszystkimi nauczonymi fiszkami. */

const TOWER_REQ = 30, TOWER_CHECK = 5;
const BLESS = {
  heal: ['❤️', 'Odpoczynek', '+40% ❤️'], dmg: ['⚔️', 'Ostrze', '+10% obrażeń do końca wieży'], crit: ['🎯', 'Oko sokoła', '+6% krytyka do końca wieży'],
  maxhp: ['🛡️', 'Hart ducha', '+20 ❤️ maks. i leczy 20'], potion: ['🧪', 'Zapas', 'losowa mikstura do ekwipunku'], bank: ['💰', 'Skarb', '+25% skarbca'],
  pact: ['💀', 'Pakt ryzyka', '+50% skarbca, ale −25% ❤️'],
};
const tower = () => hero().tower || null;
const towerBest = () => S.stats.towerBest || 0;
function towerBoss(T) {
  const f = T.floor, guard = f % TOWER_CHECK === 0, pool = guard ? [...FINAL_BOSSES, ...WORLD_BOSSES] : BOSS_NAMES;
  const pick = pool[(f * 7 + (T.seed || 0)) % pool.length], cs = S.cards.filter(c => fightable(c) && c.srs.state !== 'new');
  const [name, desc, x] = pick, img = typeof x === 'string' ? x : null, persona = typeof x === 'object' ? x : null;
  return { kind: 'tower', id: 'tower', i: f, name: guard ? `${name} – strażnik piętra` : name, desc, img, persona, seed: 4242 + f * 131, diff: Math.min(4, Math.floor(f / 3)), stars: 0,
    cards: cs, ok: cs.length >= TOWER_REQ, repeat: false, pr: hero().pr || 0, len: Math.min(20, 6 + f), title: `🗼 Wieża · piętro ${f}${guard ? ' · punkt kontrolny' : ''}`, final: guard };
}
function towerFloor() {
  const T = tower(); if (!T) return;
  const b = towerBoss(T); if (!b.ok) return toast(`Wieża wymaga ${TOWER_REQ} nauczonych fiszek`);
  const hs = heroStats(); hs.atk *= 1 + (T.buff.dmg || 0); hs.crit = Math.min(.7, hs.crit + (T.buff.crit || 0)); hs.hp += T.buff.hp || 0;
  const p = bossParams(b); p.hp = Math.round(p.hp * (1 + .06 * T.floor)); p.atk = Math.round(p.atk * (1 + .04 * T.floor));
  T.hp = Math.min(T.hp, hs.hp);
  bossBegin(b, { tower: true, hs, me: T.hp, meMax: hs.hp }, p);
}
function towerStart() {
  if (learnedAll() < TOWER_REQ) return toast(`🗼 Wieża otwiera się przy ${TOWER_REQ} nauczonych fiszkach (masz ${learnedAll()})`, 4000);
  if (!confirm('🗼 Wieża – tryb hardcore.\n\nPiętro za piętrem, ❤️ nie odnawia się między walkami. Nagrody (podwójne XP i 💎) zbierasz w skarbcu i zabierasz tylko na punkcie kontrolnym co 5 pięter.\n\nŚmierć albo ucieczka = cały skarbiec przepada. Wchodzisz?')) return;
  const h = hero(); h.tower = { floor: 1, hp: heroStats().hp, bank: { xp: 0, gems: 0 }, buff: {}, seed: Math.random() * 1000 | 0, t: Date.now() }; h.mod = Date.now(); save();
  towerFloor();
}
function towerEnd(B, won) {
  const h = hero(), T = h.tower; if (!T) return;
  if (won) {
    const f = T.floor, xp = Math.round((B.ok * 3 + 30 + 15 * f) * 2 * xpMul()), gems = Math.round((8 + 4 * f) * gemMul());
    T.bank.xp += xp; T.bank.gems += gems; B.towerGain = { xp, gems };
    T.hp = Math.min(B.meMax, Math.round(B.me + B.meMax * .1)); T.floor = f + 1;
    S.stats.towerBest = Math.max(towerBest(), f); S.stats.bossWins = (S.stats.bossWins || 0) + 1;
    const ks = shuffle(Object.keys(BLESS)); T.pick = ks.slice(0, 3);
  } else {
    B.towerLost = { floor: T.floor, ...T.bank }; S.stats.towerBest = Math.max(towerBest(), T.floor - 1); delete h.tower;
  }
  h.mod = Date.now();
}
function towerBless(k) {
  const T = tower(); if (!T?.pick?.includes(k)) return;
  const mx = heroStats().hp + (T.buff.hp || 0);
  if (k === 'heal') T.hp = Math.min(mx, T.hp + Math.round(mx * .4));
  if (k === 'dmg') T.buff.dmg = (T.buff.dmg || 0) + .1;
  if (k === 'crit') T.buff.crit = (T.buff.crit || 0) + .06;
  if (k === 'maxhp') { T.buff.hp = (T.buff.hp || 0) + 20; T.hp += 20; }
  if (k === 'potion') { const ps = Object.keys(POTIONS).filter(x => x !== 'phoenix'); addItem('potion', ps[Math.random() * ps.length | 0], 1); }
  if (k === 'bank') { T.bank.xp = Math.round(T.bank.xp * 1.25); T.bank.gems = Math.round(T.bank.gems * 1.25); }
  if (k === 'pact') { T.bank.xp = Math.round(T.bank.xp * 1.5); T.bank.gems = Math.round(T.bank.gems * 1.5); T.hp = Math.max(1, Math.round(T.hp * .75)); }
  T.pick = null; T.last = k; hero().mod = Date.now(); save(); render();
}
function towerCashOut() {
  const h = hero(), T = h.tower; if (!T || (T.floor - 1) % TOWER_CHECK !== 0 || T.floor < 2) return;
  if (!confirm(`Zejść z wieży i zabrać skarbiec: +${T.bank.xp} XP, +${T.bank.gems} 💎?`)) return;
  giveXP(T.bank.xp, 'wieża'); S.wallet.push({ id: 'tower-' + uid(), n: T.bank.gems, why: 'tower', t: Date.now() });
  toast(`🗼 Zszedłeś z piętra ${T.floor - 1} z łupem: +${T.bank.xp} XP, +${T.bank.gems} 💎`, 4000); confetti(150);
  delete h.tower; h.mod = Date.now(); BOSS = null; save(); go('#/tower'); render();
}
const towerCardHTML = () => { const T = tower();
  return `<div class="card row nowrap tower-cta" data-go="#/tower"><span class="tower-ic">🗼</span><div class="grow"><b>Wieża – hardcore</b><div class="small muted">${T ? `W trakcie: piętro ${T.floor} · skarbiec +${T.bank.xp} XP, +${T.bank.gems} 💎` : `Ile pięter przetrwasz? Rekord: ${towerBest() || '—'} · podwójne XP, ale śmierć zabiera wszystko`}</div></div><span>›</span></div>`; };
function towerAfterView() {
  const B = BOSS, T = tower();
  if (B.towerLost) { const L = B.towerLost;
    return { tab: 'arena', focus: true, html: `<div class="card center boss-end lost"><div class="boss-stage gloat">${bossArt(B.b)}</div>${B.say?.txt ? `<div class="boss-say end">${esc(B.say.txt)}</div>` : ''}
      <h2>💀 Wieża wygrała – piętro ${L.floor}</h2><p>Skarbiec przepada: <b>−${L.xp} XP</b> i <b>−${L.gems} 💎</b>.</p><p class="small muted">Twój rekord: piętro ${towerBest()}. Następnym razem zejdź na punkcie kontrolnym!</p>
      <div class="row"><button class="primary grow" data-act="tower-start">🗼 Od nowa</button><button class="grow" data-act="boss-map">🗺️ Mapa</button></div></div>` };
  }
  const check = T && (T.floor - 1) % TOWER_CHECK === 0, g = B.towerGain || { xp: 0, gems: 0 };
  return { tab: 'arena', focus: true, html: `<div class="card center boss-end won"><div class="boss-stage dead">${bossArt(B.b)}<div class="boss-boom"></div></div>
    <h2>🗼 Piętro ${T.floor - 1} zdobyte!</h2><p class="small">Do skarbca: +${g.xp} XP, +${g.gems} 💎 · razem <b>+${T.bank.xp} XP, +${T.bank.gems} 💎</b></p>
    <div class="tower-hp">${HP_BAR(T.hp, heroStats().hp + (T.buff.hp || 0), 'me')}</div>
    ${T.pick ? `<h3>Wybierz błogosławieństwo</h3><div class="bless">${T.pick.map(k => `<button data-act="tower-bless" data-k="${k}"><span>${BLESS[k][0]}</span><b>${BLESS[k][1]}</b><small>${BLESS[k][2]}</small></button>`).join('')}</div>`
      : `<div class="row" style="margin-top:10px"><button class="primary grow" data-act="tower-next">⚔️ Piętro ${T.floor}</button>${check ? `<button class="grow" data-act="tower-cash">💰 Zejdź z łupem</button>` : ''}</div>
      <p class="small muted">${check ? '✅ Punkt kontrolny – możesz bezpiecznie zejść z całym skarbcem.' : `Najbliższy punkt kontrolny: piętro ${Math.ceil((T.floor - 1) / TOWER_CHECK) * TOWER_CHECK || TOWER_CHECK}. Zejść można tylko tam.`}</p>`}</div>` };
}
ROUTES.tower = () => { const T = tower();
  return { tab: 'arena', html: `<div class="row nowrap"><button class="iconbtn" data-go="#/boss">‹</button><h1 class="grow" style="margin:0">🗼 Wieża – hardcore</h1>${coinsHTML()}</div>
  <div class="card center"><div style="font-size:64px">🗼</div><p style="margin:4px 0"><b>Ile pięter przetrwasz?</b> Każde piętro to trudniejszy boss, a ❤️ nie odnawia się między walkami.</p>
    <ul class="small" style="text-align:left"><li>Nagrody <b>×2 XP</b> i 💎 zbierają się w skarbcu.</li><li>Po każdym piętrze wybierasz 1 z 3 błogosławieństw.</li><li>Zabierasz skarbiec tylko na punkcie kontrolnym (co ${TOWER_CHECK} pięter).</li><li><b>Śmierć albo ucieczka = cały skarbiec przepada.</b> Serca zostają.</li></ul>
    <p class="small muted">Rekord: piętro ${towerBest() || '—'} · walczysz wszystkimi nauczonymi fiszkami (${learnedAll()}/${TOWER_REQ})</p></div>
  ${T ? `<div class="card"><b>W trakcie: piętro ${T.floor}</b><div class="small muted">Skarbiec: +${T.bank.xp} XP, +${T.bank.gems} 💎</div>${HP_BAR(T.hp, heroStats().hp + (T.buff.hp || 0), 'me')}
    <div class="row" style="margin-top:10px"><button class="primary grow" data-act="tower-next">⚔️ Walcz dalej</button>${(T.floor - 1) % TOWER_CHECK === 0 && T.floor > 1 ? '<button class="grow" data-act="tower-cash">💰 Zejdź z łupem</button>' : ''}</div></div>`
    : `<button class="primary block boss-go" data-act="tower-start" ${learnedAll() >= TOWER_REQ ? '' : 'disabled'}>🗼 Wejdź do wieży</button>`}` }; };
const twRoute0 = ROUTES.boss;
ROUTES.boss = (...a) => BOSS?.b?.kind === 'tower' && BOSS.phase !== 'fight' && a[0]?.[1] === 'fight' ? towerAfterView() : twRoute0(...a);
const twQuit0 = ACTIONS['boss-quit'];
ACTIONS['boss-quit'] = el => {
  if (BOSS?.b?.kind !== 'tower' || BOSS.phase !== 'fight') return twQuit0(el);
  if (!confirm('Ucieczka z wieży = przegrana. Cały skarbiec przepada. Na pewno?')) return;
  bossEnd(false, 'dead');
};
// mapa bossów: karta wieży nad taliami
const twMap0 = ROUTES.boss;
ROUTES.boss = (...a) => { const v = twMap0(...a); if (!v?.html || v.focus) return v; return { ...v, html: v.html.replace('<h2 class="bm-h">📚 Twoje talie', towerCardHTML() + '<h2 class="bm-h">📚 Twoje talie') }; };
Object.assign(ACTIONS, {
  'tower-start': () => { BOSS = null; towerStart(); },
  'tower-next': () => { BOSS = null; towerFloor(); },
  'tower-bless': el => towerBless(el.dataset.k),
  'tower-cash': () => towerCashOut(),
});
HUB_OF.tower = 'arena';

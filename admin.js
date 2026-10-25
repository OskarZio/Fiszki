'use strict';
/* 🛠️ Panel admina (na tym urządzeniu): włączanie i wyłączanie całych funkcji – do eksperymentów z prostszą aplikacją –
   oraz resety własnego postępu w grze (bohater, bossowie, naklejki, kryształy, osiągnięcia). Fiszek i nauki resety nie ruszają. */

const FEATURES = {
  boss: ['⚔️ Bossowie i bohater', ['boss', 'hero', 'coop'], 'walki z bossami, lobby, postać, ekwipunek'],
  battles: ['🥊 Bitwy 1 na 1', ['battles', 'battle', 'show'], 'pojedynki i teleturniej'],
  friends: ['👥 Znajomi i ranking', ['rank', 'inbox', 'chat', 'friend'], 'ranking, czat, znajomi'],
  shop: ['🛒 Sklep i skrzynki', ['shop'], 'kupowanie skrzynek z naklejkami'],
  inv: ['🎒 Kolekcja naklejek', ['inv'], 'album naklejek'],
  quests: ['📋 Wyzwania i osiągnięcia', ['quests', 'ach'], 'zadania dnia, osiągnięcia'],
  egg: ['🥚 Inkubator', ['egg'], 'sesje skupienia ze stworkami'],
  methods: ['📖 Metody nauki', ['methods', 'method', 'subject', 'mtrain'], 'poradniki i treningi metod'],
  train: ['🧠 Trening pamięci', ['train', 'game', 'major', 'palaces', 'palace', 'ptrain'], 'gry pamięciowe, system liczbowy, pałace'],
  calendar: ['📅 Terminarz', ['calendar'], 'plan nauki i terminy'],
  topics: ['📁 Kategorie i notatki', ['topics', 'topic', 'item'], 'kategorie talii, materiały, notatki'],
};
const featureOn = k => !(S?.settings?.off || {})[k];
const ROUTE_FEAT = Object.fromEntries(Object.entries(FEATURES).flatMap(([k, [, rs]]) => rs.map(r => [r, k])));
const routeOn = r => !ROUTE_FEAT[r] || featureOn(ROUTE_FEAT[r]);
// trasy wyłączonych funkcji pokazują krótką informację
for (const [r, k] of Object.entries(ROUTE_FEAT)) {
  const f0 = ROUTES[r]; if (typeof f0 !== 'function') continue;
  ROUTES[r] = (...a) => featureOn(k) ? f0(...a) : { tab: 'home', html: `<div class="card center"><div style="font-size:44px">🧪</div><h2>${FEATURES[k][0]} – wyłączone</h2>
    <p class="muted">Ta funkcja jest wyłączona w Panelu admina (Ustawienia → 🛠️ Panel admina).</p><button class="primary" data-act="feat-on" data-k="${k}">Włącz z powrotem</button> <button data-go="#/">Start</button></div>` };
}
// pasek sekcji bez wyłączonych pozycji
const admHub0 = hubNav;
hubNav = function (hub, cur) {
  const all = HUBS[hub]; if (!all) return '';
  HUBS[hub] = all.filter(([r]) => routeOn(r));
  try { return HUBS[hub].length > 1 ? admHub0(hub, cur) : ''; } finally { HUBS[hub] = all; }
};
// dolny pasek: zakładka znika, gdy nic w niej nie zostało; prowadzi do pierwszej włączonej sekcji
const admTabs0 = updateTabBadges;
updateTabBadges = function () {
  admTabs0();
  for (const tab of ['arena', 'friends', 'profile']) {
    const a = document.querySelector(`#tabs [data-tab=${tab}]`), hub = HUBS[tab]; if (!a || !hub) continue;
    const on = hub.filter(([r]) => routeOn(r));
    a.classList.toggle('feat-off', !on.length);
    if (on.length && !routeOn((a.getAttribute('href') || '').replace('#/', '').split(/[/?]/)[0])) a.href = '#/' + on[0][0];
  }
};
// karty na Starcie z wyłączonych funkcji
const admHome0 = homeExtrasHTML;
homeExtrasHTML = function () {
  let h = admHome0();
  const strip = cls => { h = h.replace(new RegExp(`<div class="card row nowrap ${cls}"[\\s\\S]*?<span>›</span></div>`, 'g'), ''); };
  if (!featureOn('egg')) strip('egg-home');
  if (!featureOn('methods')) strip('methods-home');
  if (!featureOn('boss')) strip('boss-home');
  return h;
};
const admHomeV0 = viewHome;
viewHome = function (...a) {
  let h = admHomeV0(...a);
  if (!featureOn('topics')) h = h.replace(/<button data-act="topic-new"[^>]*>[^<]*<\/button>/, '');
  return h;
};

// ---------- 🔄 resety własnego postępu w grze
const RESETS = {
  hero: ['🦸 Bohater', 'poziom, doświadczenie, drzewka, ekwipunek, mikstury, boostery, serca (postać i płeć zostają)', () => {
    const h = hero(), keep = { line: h.line, g: h.g, look: h.look }; S.hero = { ...HERO_DEF(), ...keep, mod: Date.now() };
    S.items = S.items.filter(i => !['gear', 'potion', 'boost'].includes(i.kind)); delete S.stats.heroLv; delete S.stats.prestige; delete S.stats.skills; delete S.stats.skillBranch; }],
  boss: ['🐉 Bossowie', 'pokonane rozdziały i finały, boss świata i kategorii', () => {
    S.decks.forEach(d => { if (d.boss) { delete d.boss; touch(d); } });
    for (const k of Object.keys(S.stats)) if (/^(cb_|chl_)/.test(k) || ['worldStage', 'bossWins', 'bossStageMax', 'bossFlawless', 'lootLegend'].includes(k)) delete S.stats[k]; }],
  stickers: ['🏷️ Naklejki i kolekcja', 'naklejki, błyszczące, holo, skrzynki, jaja', () => { S.items = S.items.filter(i => !['sticker', 'shiny', 'holo', 'case', 'egg', 'dust'].includes(i.kind)); }],
  ach: ['🏅 Osiągnięcia', 'wszystkie zdobyte osiągnięcia (mogą wpaść ponownie)', () => { S.ach = {}; }],
  gems: ['💎 Kryształy', 'saldo kryształów do zera', () => { const n = coins(); if (n) S.wallet.push({ id: uid(), n: -n, why: 'admin-reset', t: Date.now() }); }],
};
function adminHTML() {
  const off = S.settings.off || {};
  return `<details class="card admin-card"><summary><b>🛠️ Panel admina</b> <span class="small muted">· eksperymenty na tym urządzeniu</span></summary>
    <p class="small muted">Wyłącz, czego nie potrzebujesz – aplikacja zrobi się prostsza. Dane zostają, w każdej chwili włączysz z powrotem.</p>
    <div class="feat-list">${Object.entries(FEATURES).map(([k, [name, , desc]]) => `<label class="feat"><input type="checkbox" data-feat="${k}" ${off[k] ? '' : 'checked'}><span><b>${name}</b><small>${desc}</small></span></label>`).join('')}</div>
    <div class="row" style="margin-top:8px"><button class="sm" data-act="feat-simple">✨ Tryb prosty: tylko nauka</button><button class="sm ghost" data-act="feat-all">Włącz wszystko</button></div>
    <h3>🔄 Zacznij od nowa (gra)</h3><p class="small muted" style="margin-top:0">Fiszki, talie i historia nauki zostają nietknięte.</p>
    <div class="reset-list">${Object.entries(RESETS).map(([k, [name, desc]]) => `<div class="row nowrap"><span class="grow"><b>${name}</b><br><small class="muted">${desc}</small></span><button class="sm danger" data-act="adm-reset" data-k="${k}">Resetuj</button></div>`).join('')}
      <button class="danger block" data-act="adm-reset" data-k="all">🧨 Resetuj całą grę (wszystko powyżej)</button></div></details>`;
}
const admMore0 = viewMore;
viewMore = function (...a) { return admMore0(...a) + adminHTML(); };
document.addEventListener('change', e => {
  const k = e.target.dataset?.feat; if (!k) return;
  S.settings.off = S.settings.off || {}; if (e.target.checked) delete S.settings.off[k]; else S.settings.off[k] = 1; save(); updateTabBadges();
  toast(`${FEATURES[k][0]}: ${e.target.checked ? 'włączone' : 'wyłączone'}`, 1600);
});
Object.assign(ACTIONS, {
  'feat-on': el => { if (S.settings.off) delete S.settings.off[el.dataset.k]; save(); render(); },
  'feat-all': () => { S.settings.off = {}; save(); render(); toast('Wszystkie funkcje włączone'); },
  'feat-simple': () => { S.settings.off = Object.fromEntries(Object.keys(FEATURES).filter(k => !['methods', 'calendar', 'topics'].includes(k)).map(k => [k, 1])); save(); render(); toast('✨ Tryb prosty: nauka, metody, terminarz i kategorie'); },
  'adm-reset': el => {
    const k = el.dataset.k, list = k === 'all' ? Object.keys(RESETS) : [k];
    if (!confirm(`Zresetować: ${list.map(x => RESETS[x][0]).join(', ')}?\n\nTego nie da się cofnąć. Fiszki i nauka zostają.`)) return;
    list.forEach(x => RESETS[x][2]()); if (typeof BOSS !== 'undefined') BOSS = null;
    save(); toast('🔄 Zresetowano – zaczynasz od nowa'); render();
  },
});

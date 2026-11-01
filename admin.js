'use strict';
/* 🛠️ Panel admina (na tym urządzeniu): włączanie i wyłączanie całych funkcji – do eksperymentów z prostszą aplikacją –
   oraz resety własnego postępu w grze (bohater, bossowie, naklejki, kryształy, osiągnięcia). Fiszek i nauki resety nie ruszają. */

const FEATURES = {
  boss: ['⚔️ Bossowie i bohater', ['boss', 'hero', 'coop', 'tower'], 'walki z bossami, lobby, postać, ekwipunek'],
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
// 🌍 flagi globalne (Supabase app_flags) – ustawia tylko admin aplikacji, działają u wszystkich; kopia w localStorage na offline
let ADMIN_ERR = '';
let FLAGS = (() => { try { return JSON.parse(localStorage.getItem('appFlags') || '{}'); } catch { return {}; } })(), IS_ADMIN = false;
const featureOn = k => k !== 'methods' && !FLAGS[k];   // 📖 metody nauki usunięte z aplikacji
async function flagsLoad() {
  if (typeof SB === 'undefined' || !SB) return;
  try { const r = await SB.from('app_flags').select('k,off'); if (!r.error && Array.isArray(r.data)) { FLAGS = Object.fromEntries(r.data.filter(x => x.off && FEATURES[x.k]).map(x => [x.k, 1])); try { localStorage.setItem('appFlags', JSON.stringify(FLAGS)); } catch { /* */ } updateTabBadges(); render(); } } catch { /* */ }
  try { if (typeof cloudOn === 'function' && cloudOn()) {
    let a = await SB.rpc('am_admin'); if (a.error) a = await SB.rpc('claim_admin');   // starsza baza bez am_admin
    IS_ADMIN = a.data === true; ADMIN_ERR = a.error ? (a.error.message || 'błąd') : (IS_ADMIN ? '' : 'not-admin'); render(); }
    else ADMIN_ERR = 'not-logged'; } catch (e) { ADMIN_ERR = e.message || 'błąd'; }
}
on('start', () => setTimeout(flagsLoad, 1500));
setInterval(() => { if (document.visibilityState === 'visible') flagsLoad(); }, 10 * 60000);
async function setFlag(k, off) {
  if (!IS_ADMIN) return toast('Tylko admin aplikacji może zmieniać funkcje');
  try { const r = await SB.rpc('set_flag', { p_k: k, p_off: !!off }); if (r.error) throw r.error; if (off) FLAGS[k] = 1; else delete FLAGS[k];
    try { localStorage.setItem('appFlags', JSON.stringify(FLAGS)); } catch { /* */ } updateTabBadges(); render(); toast(`${FEATURES[k][0]}: ${off ? 'wyłączone' : 'włączone'} – dla wszystkich`, 2000); }
  catch (e) { toast(/function|schema/i.test(e.message || '') ? 'Wgraj nowy supabase.sql (Panel hosta)' : 'Nie udało się: ' + (e.message || e)); }
}
const ROUTE_FEAT = Object.fromEntries(Object.entries(FEATURES).flatMap(([k, [, rs]]) => rs.map(r => [r, k])));
const routeOn = r => !ROUTE_FEAT[r] || featureOn(ROUTE_FEAT[r]);
// trasy wyłączonych funkcji pokazują krótką informację
for (const [r, k] of Object.entries(ROUTE_FEAT)) {
  const f0 = ROUTES[r]; if (typeof f0 !== 'function') continue;
  ROUTES[r] = (...a) => featureOn(k) ? f0(...a) : { tab: 'home', html: `<div class="card center"><div style="font-size:44px">🧪</div><h2>${FEATURES[k][0]} – wyłączone</h2>
    <p class="muted">Ta funkcja jest chwilowo wyłączona przez administratora aplikacji.</p>${IS_ADMIN ? `<button class="primary" data-act="feat-on" data-k="${k}">Włącz z powrotem</button> ` : ''}<button data-go="#/">Start</button></div>` };
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
  if (!IS_ADMIN) return '';
  const off = FLAGS;
  return `<details class="card admin-card"><summary><b>🛠️ Panel admina</b> <span class="small muted">· cała aplikacja, wszyscy użytkownicy</span></summary>
    <p class="small muted">Wyłączona funkcja znika <b>u wszystkich</b> (po odświeżeniu aplikacji, najpóźniej po 10 minutach). Dane użytkowników zostają.</p>
    <div class="feat-list">${Object.entries(FEATURES).map(([k, [name, , desc]]) => `<label class="feat"><input type="checkbox" data-feat="${k}" ${off[k] ? '' : 'checked'}><span><b>${name}</b><small>${desc}</small></span></label>`).join('')}</div>
    <div class="row" style="margin-top:8px"><button class="sm" data-act="feat-simple">✨ Tryb prosty: tylko nauka</button><button class="sm ghost" data-act="feat-all">Włącz wszystko</button></div>
    <h3>🎨 Podgląd motywów premium</h3>
    <p class="small muted" style="margin-top:0">Za darmo, bez kupowania – podgląd trwa do „Zakończ” albo do ponownego otwarcia aplikacji.</p>
    <div class="themes">${THEMES.filter(t => t.price).map(t => `<button class="theme${THEME_PREVIEW?.id === t.id ? ' on' : ''}${t.fx ? ' th-fx' : ''}" style="background:${t.bg};background-image:${t.image || 'none'}${themeFxVars(t)}" data-act="theme-preview" data-id="${t.id}"><span class="dot" style="background:${t.accent}"></span><b style="color:${lum(t.bg) < .18 ? '#fff' : '#1b1d29'}">${t.name}</b><small class="lock">${themeOwned(t) ? '✓ masz' : '👀 podgląd'}</small></button>`).join('')}</div>
    <h3>🥊 Pojedynek 1 na 1 – pytania</h3>
    <label class="field"><span class="small muted">Gospodarz pojedynku ustala rodzaj pytań dla obu graczy (też trening z botem).</span>
      <select data-duelq="1">${Object.entries(DUEL_QF).map(([k, n]) => `<option value="${k}" ${duelQf() === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <p class="small muted" style="margin:4px 0 0">✍️ Wpisywanie: siła ciosu zależy od celności (dokładnie = 100%, literówka = słabszy cios). W „kto szybciej” obaj wpisują – bliższa odpowiedź atakuje.</p>
    <h3>🔄 Zacznij od nowa (gra)</h3><p class="small muted" style="margin-top:0">Fiszki, talie i historia nauki zostają nietknięte.</p>
    <div class="reset-list">${Object.entries(RESETS).map(([k, [name, desc]]) => `<div class="row nowrap"><span class="grow"><b>${name}</b><br><small class="muted">${desc}</small></span><button class="sm danger" data-act="adm-reset" data-k="${k}">Resetuj</button></div>`).join('')}
      <button class="danger block" data-act="adm-reset" data-k="all">🧨 Resetuj całą grę (wszystko powyżej)</button></div></details>`;
}
const admMore0 = viewMore;
viewMore = function (...a) { return admMore0(...a) + adminHTML(); };
document.addEventListener('change', e => {
  if (e.target.dataset?.duelq) { S.settings.duelQ = e.target.value; save(); return toast(`🥊 Pytania w pojedynku: ${DUEL_QF[e.target.value]}`, 2000); }
  const k = e.target.dataset?.feat; if (!k) return;
  setFlag(k, !e.target.checked);
});
// 👀 podgląd motywu premium: tylko w pamięci (nie zapisuje się, nie synchronizuje), pasek u dołu kończy podgląd
let THEME_PREVIEW = null;
const admTheme0 = currentTheme;
currentTheme = () => THEME_PREVIEW || admTheme0();
function themePreviewBar() {
  let el = document.querySelector('.tp-bar');
  if (!THEME_PREVIEW) return el?.remove();
  if (!el) { el = document.createElement('div'); el.className = 'tp-bar'; document.body.append(el); }
  const t = THEMES.find(x => x.id === THEME_PREVIEW.id);
  el.innerHTML = `<span class="grow">👀 Podgląd: <b>${esc(t?.name || '')}</b></span>${t && !themeOwned(t) ? `<button class="sm primary" data-act="theme-preview-buy">Kup ${t.price} 💎</button>` : ''}<button class="sm" data-act="theme-preview-end">Zakończ</button>`;
}
Object.assign(ACTIONS, {
  'theme-preview': el => { const t = THEMES.find(x => x.id === el.dataset.id); if (!t) return;
    THEME_PREVIEW = { id: t.id, bg: t.bg, accent: t.accent, image: t.image || null, ...(t.pixel ? { pixel: true } : {}) }; applyTheme(); themePreviewBar(); render(); toast(`👀 Podgląd: ${t.name}`, 1500); },
  'theme-preview-end': () => { THEME_PREVIEW = null; applyTheme(); themePreviewBar(); render(); },
  'theme-preview-buy': () => { THEME_PREVIEW = null; applyTheme(); themePreviewBar(); go('#/shop'); },
  'feat-on': el => setFlag(el.dataset.k, false),
  'feat-all': async () => { if (!confirm('Włączyć wszystkie funkcje dla wszystkich?')) return; for (const k of Object.keys(FLAGS)) await setFlag(k, false); },
  'feat-simple': async () => { if (!confirm('Tryb prosty dla WSZYSTKICH użytkowników (tylko nauka, metody, terminarz, kategorie)?')) return; for (const k of Object.keys(FEATURES).filter(k => !['methods', 'calendar', 'topics'].includes(k))) await setFlag(k, true); },
  'adm-reset': el => {
    const k = el.dataset.k, list = k === 'all' ? Object.keys(RESETS) : [k];
    if (!confirm(`Zresetować: ${list.map(x => RESETS[x][0]).join(', ')}?\n\nTego nie da się cofnąć. Fiszki i nauka zostają.`)) return;
    list.forEach(x => RESETS[x][2]()); if (typeof BOSS !== 'undefined') BOSS = null;
    save(); toast('🔄 Zresetowano – zaczynasz od nowa'); render();
  },
});
// wybór motywu w Wyglądzie kończy podgląd
for (const k of ['theme-pick', 'theme-color', 'buy-theme']) { const f0 = ACTIONS[k]; if (f0) ACTIONS[k] = (...a) => { if (THEME_PREVIEW) { THEME_PREVIEW = null; themePreviewBar(); } return f0(...a); }; }

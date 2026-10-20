'use strict';
/* Reakcje (GIF na ekranie): po wygranej bitwie, ukończeniu zestawu fiszek albo celu dziennego pokazuje się GIF.
   GIF-y zdobywa się WYŁĄCZNIE ze skrzynki z GIF-ami (ekwipunek 🎒) – nie da się wgrać własnego.
   Bez GIF-a z ekwipunku: GIF ustawiony przez hosta albo domyślny kot 🐈‍⬛.
   GIF „wygranej” widzą też przeciwnicy – po bitwie i w teleturnieju pokazuje się wszystkim graczom. */

const REACT_SLOTS = {
  win: { name: '🏆 Wygrana bitwa', caption: 'Wygrana! 🏆', def: true },
  session: { name: '✅ Ukończony zestaw fiszek', caption: 'Zestaw zrobiony! 🎉', def: true },
  goal: { name: '🎯 Cel dzienny osiągnięty', caption: 'Cel na dziś zaliczony! 🔥', def: false },
};
const REACT_DEFAULT = 'assets/reakcja-kot.webp';
let GLOBAL_RX = {};
let GIF_CASE = [];            // GIF-y do wylosowania w skrzynce (host wgrywa je w panelu) – [{ id, name, path, r, t }]
const GIFCASE_PREVIEW = {};   // podgląd świeżo wgranych (zanim GitHub Pages je opublikuje)
const gifById = id => GIF_CASE.find(g => g.id === id);
const gifSrcs = g => [GIFCASE_PREVIEW[g.id], g.path + '?v=' + (g.t || 0), rawUrl(g.path)].filter(Boolean);
const gifImg = (g, cls = '') => { const s = gifSrcs(g); return `<img class="${cls}" src="${esc(s[0])}" data-alt="${esc(JSON.stringify(s.slice(1)))}" alt="${esc(g.name || '')}" loading="lazy">`; };
// GIF z kolekcji ustawiony jako reakcja (jeśli nadal go masz)
const rxGif = k => { const id = S?.settings?.reactions?.[k]?.gid, g = id && gifById(id); return g && typeof hasItem === 'function' && hasItem('gif', id) ? g : null; };   // slot -> { path } – GIF-y ustawione przez hosta dla wszystkich (assets/global.json w repozytorium)
// kolejność: GIF z ekwipunku → GIF od hosta → domyślny kot
const GLOBAL_PREVIEW = {};   // podgląd od razu po wgraniu przez hosta (zanim GitHub Pages opublikuje plik)
const rxRepo = () => (typeof hostRepo === 'function' ? hostRepo() : 'OskarZio/aa');
const rawUrl = path => `https://raw.githubusercontent.com/${rxRepo()}/HEAD/${path}`;
// adresy GIF-a hosta: najpierw ze strony (GitHub Pages), a gdy się nie wczyta – prosto z repozytorium
const globalSrcs = k => GLOBAL_RX[k]?.path ? [GLOBAL_PREVIEW[k], GLOBAL_RX[k].path + '?v=' + (GLOBAL_RX[k].t || 0), rawUrl(GLOBAL_RX[k].path)].filter(Boolean) : [];
const rxSrcs = k => rxGif(k) ? [...gifSrcs(rxGif(k)), REACT_DEFAULT] : [...globalSrcs(k), REACT_DEFAULT];
const rxSrc = k => rxSrcs(k)[0];
const rxIsCat = k => !rxGif(k) && !GLOBAL_RX[k]?.path;
// <img> z listą zapasowych adresów (gdy pierwszy się nie wczyta, próbuje kolejnego)
function rxImg(k, cls = '') {
  const srcs = rxSrcs(k);
  return `<img class="${cls}${rxIsCat(k) ? ' rx-default' : ''}" src="${esc(srcs[0])}" data-alt="${esc(JSON.stringify(srcs.slice(1)))}" alt="">`;
}
// zapasowe adresy obrazków bez atrybutu onerror (zgodne z Content-Security-Policy)
document.addEventListener('error', e => { const t = e.target; if (t?.tagName === 'IMG' && t.dataset?.alt) rxFallback(t); }, true);
window.rxFallback = img => {
  const alt = JSON.parse(img.dataset.alt || '[]'); if (!alt.length) return;
  img.dataset.alt = JSON.stringify(alt.slice(1));
  if (alt[0] === REACT_DEFAULT) img.classList.add('rx-default');
  img.src = alt[0];
};
// 🔒 lista z pliku globalnego: tylko pliki z naszego folderu, bezpieczne id, znana rzadkość
const GIF_PATH_RE = /^assets\/(gifcase|global|reactions)\/[\w.-]+\.(gif|webp|png|jpe?g)$/i;
const cleanGifCase = list => (Array.isArray(list) ? list : []).filter(g => g && GIF_PATH_RE.test(g.path || '') && /^[\w-]{1,40}$/.test(g.id || ''))
  .map(g => ({ id: g.id, path: g.path, name: String(g.name || 'GIF').slice(0, 40), r: ['common', 'rare', 'epic', 'legendary'].includes(g.r) ? g.r : 'common', t: +g.t || 0 }));
const cleanGlobalRx = o => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([k, v]) => /^[\w-]{1,24}$/.test(k) && GIF_PATH_RE.test(v?.path || '')).map(([k, v]) => [k, { path: v.path, name: String(v.name || '').slice(0, 60), t: +v.t || 0 }]));
async function loadGlobalReactions() {
  // pobieramy listę ze strony i z repozytorium naraz – wygrywa nowsza
  const get = url => fetch(url, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
  const [a, b] = await Promise.all([get('assets/global.json?t=' + Date.now()), get(rawUrl('assets/global.json') + '?t=' + Date.now())]);
  const best = [a, b].filter(Boolean).sort((x, y) => (y.updated || 0) - (x.updated || 0))[0];
  if (best) { GLOBAL_RX = cleanGlobalRx(best.reactions); GIF_CASE = cleanGifCase(best.gifCase); if (typeof render === 'function' && ['shop', 'host', 'case', 'inv', 'chat', 'more'].includes(parseRoute().parts[0])) render(); }
}
on('start', loadGlobalReactions);

// sprzątanie po dawnych, własnoręcznie wgranych GIF-ach (już nieobsługiwane)
on('start', () => { for (const k of Object.keys(REACT_SLOTS)) DB.del('gif:' + k).catch(() => {}); });
const reactCfg = () => (S.settings.reactions = S.settings.reactions || {});
const reactOn = k => (reactCfg()[k]?.on ?? REACT_SLOTS[k].def);

function showReaction(k, test) {
  if (!test && !reactOn(k)) return;
  const cfg = reactCfg()[k] || {};
  rxOverlay(rxImg(k), esc(REACT_SLOTS[k].caption), cfg.dur);
}
// mój GIF wygranej (id z ekwipunku) – wysyłany innym graczom, żeby zobaczyli go, gdy wygram
const myWinGif = () => (reactOn('win') && rxGif('win')?.id) || null;
// GIF zwycięzcy na ekranie wszystkich graczy (gid z jego ekwipunku; nieznany / brak = domyślny)
function showWinnerGif(gid, name) {
  const g = gid && gifById(gid);
  const img = g ? gifImg(g) : `<img class="rx-default" src="${REACT_DEFAULT}" alt="">`;
  rxOverlay(img, `🏆 ${esc(name || 'Zwycięzca')} wygrywa!`, 4);
}
function rxOverlay(imgHTML, caption, dur) {
  document.querySelector('.reaction')?.remove();
  const el = document.createElement('div'); el.className = 'reaction';
  el.innerHTML = `<div class="rx-card">${imgHTML}<b>${caption}</b><small>stuknij, aby zamknąć</small></div>`;
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); };
  el.addEventListener('click', close);
  document.body.append(el);
  setTimeout(close, (dur || 3.5) * 1000);
}
on('battleWin', () => setTimeout(() => showReaction('win'), 400));
on('sessionEnd', s => { if (s.done > 0) setTimeout(() => showReaction('session'), 250); });
on('goal', () => setTimeout(() => showReaction('goal'), 600));

function reactionsSectionHTML() {
  const cfg = reactCfg();
  return `<div class="card"><h2 style="margin-top:0">🎬 Reakcje (GIF)</h2>
    <p class="small muted">Po wybranym zdarzeniu na ekranie pokaże się GIF. GIF-y zdobywasz tylko w 🎞️ skrzynce z GIF-ami i ustawiasz w 🎒 Ekwipunku. Twój GIF wygranej widzą też przeciwnicy.</p>
    ${Object.entries(REACT_SLOTS).map(([k, sl]) => { const c = cfg[k] || {}, g = rxGif(k);
      const note = g ? `<br><small class="muted">z ekwipunku: ${esc(g.name || 'GIF')}</small>` : GLOBAL_RX[k]?.path ? '<br><small class="muted">GIF od hosta</small>' : '<br><small class="muted">domyślny kot</small>';
      return `<div class="sndrow"><div class="row nowrap">${rxImg(k, 'rx-thumb')}<b class="grow">${sl.name}${note}</b>
          <label class="switch"><input type="checkbox" data-rx-on="${k}" ${reactOn(k) ? 'checked' : ''}><span></span></label></div>
        <div class="row nowrap"><button class="sm" data-act="rx-test" data-k="${k}">▶ Pokaż</button>
          <button class="sm" data-go="#/inv">🎒 Zmień w ekwipunku</button>
          <select data-rx-dur="${k}" style="width:auto;margin-left:auto">${[2, 3.5, 5, 8].map(d => `<option value="${d}" ${(c.dur || 3.5) === d ? 'selected' : ''}>${d} s</option>`).join('')}</select></div></div>`; }).join('')}
  </div>`;
}
document.addEventListener('change', e => {
  const on1 = e.target.dataset?.rxOn, dur = e.target.dataset?.rxDur, cfg = reactCfg();
  if (on1) { cfg[on1] = { ...(cfg[on1] || {}), on: e.target.checked }; save(); }
  if (dur) { cfg[dur] = { ...(cfg[dur] || {}), dur: +e.target.value }; save(); }
});
Object.assign(ACTIONS, {
  'rx-test': el => showReaction(el.dataset.k, true),
});

'use strict';
/* Reakcje (GIF na ekranie): po wygranej bitwie, ukończeniu zestawu fiszek albo celu dziennego pokazuje się
   wybrany GIF / obrazek. Każde zdarzenie ma własne ustawienie i własny plik (domyślnie kot 🐈‍⬛). */

const REACT_SLOTS = {
  win: { name: '🏆 Wygrana bitwa', caption: 'Wygrana! 🏆', def: true },
  session: { name: '✅ Ukończony zestaw fiszek', caption: 'Zestaw zrobiony! 🎉', def: true },
  goal: { name: '🎯 Cel dzienny osiągnięty', caption: 'Cel na dziś zaliczony! 🔥', def: false },
};
const REACT_DEFAULT = 'assets/reakcja-kot.webp';
const RX = {};   // slot -> { url, name } (własne pliki z IndexedDB)
let GLOBAL_RX = {};
let GIF_CASE = [];            // GIF-y do wylosowania w skrzynce (host wgrywa je w panelu) – [{ id, name, path, r, t }]
const GIFCASE_PREVIEW = {};   // podgląd świeżo wgranych (zanim GitHub Pages je opublikuje)
const gifById = id => GIF_CASE.find(g => g.id === id);
const gifSrcs = g => [GIFCASE_PREVIEW[g.id], g.path + '?v=' + (g.t || 0), rawUrl(g.path)].filter(Boolean);
const gifImg = (g, cls = '') => { const s = gifSrcs(g); return `<img class="${cls}" src="${s[0]}" data-alt="${esc(JSON.stringify(s.slice(1)))}" onerror="rxFallback(this)" alt="${esc(g.name || '')}" loading="lazy">`; };
// GIF z kolekcji ustawiony jako reakcja (jeśli nadal go masz)
const rxGif = k => { const id = S?.settings?.reactions?.[k]?.gid, g = id && gifById(id); return g && typeof hasItem === 'function' && hasItem('gif', id) ? g : null; };   // slot -> { path } – GIF-y ustawione przez hosta dla wszystkich (assets/global.json w repozytorium)
// kolejność: własny plik użytkownika → GIF od hosta → domyślny kot
const GLOBAL_PREVIEW = {};   // podgląd od razu po wgraniu przez hosta (zanim GitHub Pages opublikuje plik)
const rxRepo = () => (typeof hostRepo === 'function' ? hostRepo() : 'OskarZio/aa');
const rawUrl = path => `https://raw.githubusercontent.com/${rxRepo()}/HEAD/${path}`;
// adresy GIF-a hosta: najpierw ze strony (GitHub Pages), a gdy się nie wczyta – prosto z repozytorium
const globalSrcs = k => GLOBAL_RX[k]?.path ? [GLOBAL_PREVIEW[k], GLOBAL_RX[k].path + '?v=' + (GLOBAL_RX[k].t || 0), rawUrl(GLOBAL_RX[k].path)].filter(Boolean) : [];
const rxSrcs = k => RX[k]?.url ? [RX[k].url] : rxGif(k) ? [...gifSrcs(rxGif(k)), REACT_DEFAULT] : [...globalSrcs(k), REACT_DEFAULT];
const rxSrc = k => rxSrcs(k)[0];
const rxIsCat = k => !RX[k] && !rxGif(k) && !GLOBAL_RX[k]?.path;
// <img> z listą zapasowych adresów (gdy pierwszy się nie wczyta, próbuje kolejnego)
function rxImg(k, cls = '') {
  const srcs = rxSrcs(k);
  return `<img class="${cls}${rxIsCat(k) ? ' rx-default' : ''}" src="${srcs[0]}" data-alt="${esc(JSON.stringify(srcs.slice(1)))}" onerror="rxFallback(this)" alt="">`;
}
window.rxFallback = img => {
  const alt = JSON.parse(img.dataset.alt || '[]'); if (!alt.length) return;
  img.dataset.alt = JSON.stringify(alt.slice(1));
  if (alt[0] === REACT_DEFAULT) img.classList.add('rx-default');
  img.src = alt[0];
};
async function loadGlobalReactions() {
  // pobieramy listę ze strony i z repozytorium naraz – wygrywa nowsza
  const get = url => fetch(url, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
  const [a, b] = await Promise.all([get('assets/global.json?t=' + Date.now()), get(rawUrl('assets/global.json') + '?t=' + Date.now())]);
  const best = [a, b].filter(Boolean).sort((x, y) => (y.updated || 0) - (x.updated || 0))[0];
  if (best) { GLOBAL_RX = best.reactions || {}; GIF_CASE = Array.isArray(best.gifCase) ? best.gifCase : []; if (typeof render === 'function' && ['shop', 'host', 'case'].includes(parseRoute().parts[0])) render(); }
}
on('start', loadGlobalReactions);

on('start', async () => {
  for (const k of Object.keys(REACT_SLOTS)) {
    const f = await DB.get('gif:' + k).catch(() => null);
    if (f) RX[k] = { url: URL.createObjectURL(f), name: f.name || 'plik' };
  }
});
const reactCfg = () => (S.settings.reactions = S.settings.reactions || {});
const reactOn = k => (reactCfg()[k]?.on ?? REACT_SLOTS[k].def);

function showReaction(k, test) {
  if (!test && !reactOn(k)) return;
  const cfg = reactCfg()[k] || {}, custom = RX[k];
  document.querySelector('.reaction')?.remove();
  const el = document.createElement('div'); el.className = 'reaction';
  void custom;
  el.innerHTML = `<div class="rx-card">${rxImg(k)}<b>${esc(REACT_SLOTS[k].caption)}</b><small>stuknij, aby zamknąć</small></div>`;
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); };
  el.addEventListener('click', close);
  document.body.append(el);
  setTimeout(close, (cfg.dur || 3.5) * 1000);
}
on('battleWin', () => setTimeout(() => showReaction('win'), 400));
on('sessionEnd', s => { if (s.done > 0) setTimeout(() => showReaction('session'), 250); });
on('goal', () => setTimeout(() => showReaction('goal'), 600));

function reactionsSectionHTML() {
  const cfg = reactCfg();
  return `<div class="card"><h2 style="margin-top:0">🎬 Reakcje (GIF)</h2>
    <p class="small muted">Po wybranym zdarzeniu na ekranie pokaże się GIF. Wgraj własny (GIF, WebP, PNG, JPG) albo zostaw ${Object.keys(GLOBAL_RX).length ? 'GIF od hosta' : 'domyślnego kota'}. Własne pliki zostają na tym urządzeniu.</p>
    ${Object.entries(REACT_SLOTS).map(([k, sl]) => { const c = cfg[k] || {}, own = RX[k];
      const note = own ? (GLOBAL_RX[k]?.path ? '<br><small class="c-hard">Twój własny GIF – zasłania GIF od hosta</small>' : '<br><small class="muted">Twój własny GIF</small>')
        : GLOBAL_RX[k]?.path ? '<br><small class="muted">GIF od hosta</small>' : '<br><small class="muted">domyślny kot</small>';
      return `<div class="sndrow"><div class="row nowrap">${rxImg(k, 'rx-thumb')}<b class="grow">${sl.name}${note}</b>
          <label class="switch"><input type="checkbox" data-rx-on="${k}" ${reactOn(k) ? 'checked' : ''}><span></span></label></div>
        <div class="row nowrap"><button class="sm" data-act="rx-test" data-k="${k}">▶ Pokaż</button>
          <button class="sm" data-act="rx-pick" data-k="${k}">📁 ${own ? 'Zmień' : 'Wgraj własny'}</button>
          ${own ? `<button class="sm ghost" data-act="rx-reset" data-k="${k}">${GLOBAL_RX[k]?.path ? 'Użyj GIF-a hosta' : 'Domyślny'}</button>` : ''}
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
  'rx-pick': async el => {
    const k = el.dataset.k, f = await pickFile('image/gif,image/webp,image/png,image/jpeg,image/*'); if (!f) return;
    if (f.size > 12e6) return toast('Plik jest za duży (max 12 MB)');
    const file = new File([await f.arrayBuffer()], f.name, { type: f.type || 'image/gif' });
    await DB.set('gif:' + k, file);
    if (RX[k]) URL.revokeObjectURL(RX[k].url);
    RX[k] = { url: URL.createObjectURL(file), name: f.name };
    reactCfg()[k] = { ...(reactCfg()[k] || {}), on: true }; save(); render(); showReaction(k, true);
  },
  'rx-reset': async el => { const k = el.dataset.k; await DB.del('gif:' + k); if (RX[k]) URL.revokeObjectURL(RX[k].url); delete RX[k]; render(); },
});

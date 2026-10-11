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
  el.innerHTML = `<div class="rx-card"><img class="${custom ? '' : 'rx-default'}" src="${custom ? custom.url : REACT_DEFAULT}" alt=""><b>${esc(REACT_SLOTS[k].caption)}</b><small>stuknij, aby zamknąć</small></div>`;
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
    <p class="small muted">Po wybranym zdarzeniu na ekranie pokaże się GIF. Wgraj własny (GIF, WebP, PNG, JPG) albo zostaw domyślnego kota. Pliki zostają na tym urządzeniu.</p>
    ${Object.entries(REACT_SLOTS).map(([k, sl]) => { const c = cfg[k] || {}, own = RX[k];
      return `<div class="sndrow"><div class="row nowrap"><img class="rx-thumb" src="${own ? own.url : REACT_DEFAULT}" alt=""><b class="grow">${sl.name}</b>
          <label class="switch"><input type="checkbox" data-rx-on="${k}" ${reactOn(k) ? 'checked' : ''}><span></span></label></div>
        <div class="row nowrap"><button class="sm" data-act="rx-test" data-k="${k}">▶ Pokaż</button>
          <button class="sm" data-act="rx-pick" data-k="${k}">📁 ${own ? 'Zmień' : 'Wgraj własny'}</button>
          ${own ? `<button class="sm ghost" data-act="rx-reset" data-k="${k}">Domyślny</button>` : ''}
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

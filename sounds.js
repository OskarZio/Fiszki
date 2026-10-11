'use strict';
/* Własne dźwięki: wgrywasz plik (piosenkę albo krótki efekt), który odtworzy się przy wybranym zdarzeniu.
   Pliki zostają tylko na tym urządzeniu (IndexedDB) – nie są synchronizowane, bo bywają duże. */

const SOUND_SLOTS = {
  win: { name: '🏆 Wygrana bitwa', hint: 'np. ulubiona piosenka (odtwarza się do 30 s)', max: 30 },
  card: { name: '✅ Poprawna odpowiedź na fiszkę', hint: 'krótki efekt, 1–2 s', max: 3 },
  add: { name: '➕ Dodanie nowej fiszki', hint: 'krótki efekt', max: 3 },
  celebrate: { name: '🎉 Osiągnięcie / cel dzienny / skrzynka', hint: 'krótki fanfar', max: 10 },
};
const SND = {};          // slot -> { url, audio }
let sndUnlocked = false;

async function loadSounds() {
  for (const k of Object.keys(SOUND_SLOTS)) {
    const blob = await DB.get('snd:' + k).catch(() => null);
    if (blob) SND[k] = { url: URL.createObjectURL(blob), audio: null, name: blob.name || 'plik' };
  }
}
on('start', loadSounds);
const soundCfg = () => (S.settings.sounds = S.settings.sounds || {});   // { slot: { on, vol } }

// iOS pozwala grać dźwięk tylko po dotknięciu ekranu – „odblokowujemy” odtwarzacze przy pierwszym dotyku
document.addEventListener('pointerdown', () => {
  if (sndUnlocked) return; sndUnlocked = true;
  for (const s of Object.values(SND)) { const a = s.audio || (s.audio = new Audio(s.url)); a.muted = true; a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; }); }
}, { capture: true });

function playSound(k) {
  const s = SND[k], cfg = soundCfg()[k] || {};
  if (!s || cfg.on === false || S.settings.sound === false) return;
  const a = s.audio || (s.audio = new Audio(s.url));
  a.volume = clamp(cfg.vol ?? .8, 0, 1); a.currentTime = 0;
  a.play().catch(() => {});
  clearTimeout(s.stop); s.stop = setTimeout(() => { a.pause(); }, SOUND_SLOTS[k].max * 1000);
}
on('battleWin', () => playSound('win'));
on('review', (c, g) => { if (g >= 3) playSound('card'); });
on('battleHit', () => playSound('card'));
on('cardsAdded', () => playSound('add'));
on('celebrate', () => playSound('celebrate'));

function soundsSectionHTML() {
  const cfg = soundCfg();
  return `<div class="card"><h2 style="margin-top:0">🔊 Własne dźwięki</h2>
    <p class="small muted">Wgraj plik dźwiękowy (mp3, m4a, wav) – np. piosenkę na wygraną. Każdy dźwięk włączasz osobno. Pliki zostają tylko na tym urządzeniu.</p>
    ${Object.entries(SOUND_SLOTS).map(([k, sl]) => { const s = SND[k], c = cfg[k] || {};
      return `<div class="sndrow"><div class="row nowrap"><b class="grow">${sl.name}</b>
        ${s ? `<label class="switch"><input type="checkbox" data-snd-on="${k}" ${c.on === false ? '' : 'checked'}><span></span></label>` : ''}</div>
        <div class="small muted">${s ? `🎵 ${esc(s.name)}` : sl.hint}</div>
        <div class="row nowrap">${s ? `<button class="sm" data-act="snd-play" data-k="${k}">▶ Odtwórz</button>
          <input type="range" min="0" max="1" step="0.05" value="${c.vol ?? .8}" data-snd-vol="${k}" class="grow" aria-label="Głośność">
          <button class="sm danger" data-act="snd-del" data-k="${k}">Usuń</button>` : `<button class="sm" data-act="snd-pick" data-k="${k}">📁 Wgraj dźwięk</button>`}</div></div>`; }).join('')}
  </div>`;
}
document.addEventListener('change', e => {
  const on1 = e.target.dataset?.sndOn, vol = e.target.dataset?.sndVol, cfg = soundCfg();
  if (on1) { cfg[on1] = { ...(cfg[on1] || {}), on: e.target.checked }; save(); }
  if (vol) { cfg[vol] = { ...(cfg[vol] || {}), vol: +e.target.value }; save(); playSound(vol); }
});
Object.assign(ACTIONS, {
  'snd-pick': async el => {
    const k = el.dataset.k, f = await pickFile('audio/*,.mp3,.m4a,.wav,.aac,.ogg'); if (!f) return;
    if (f.size > 15e6) return toast('Plik jest za duży (max 15 MB)');
    const blob = new File([await f.arrayBuffer()], f.name, { type: f.type || 'audio/mpeg' });
    await DB.set('snd:' + k, blob);
    if (SND[k]) URL.revokeObjectURL(SND[k].url);
    SND[k] = { url: URL.createObjectURL(blob), audio: null, name: f.name };
    soundCfg()[k] = { ...(soundCfg()[k] || {}), on: true }; save(); render(); playSound(k);
  },
  'snd-play': el => playSound(el.dataset.k),
  'snd-del': async el => { const k = el.dataset.k; await DB.del('snd:' + k); if (SND[k]) { SND[k].audio?.pause(); URL.revokeObjectURL(SND[k].url); } delete SND[k]; render(); },
});

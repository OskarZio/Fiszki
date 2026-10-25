'use strict';
/* 🧮 FSRS (Free Spaced Repetition Scheduler, wersja 4.5 – domyślne parametry z open-spaced-repetition).
   Model pamięci: trudność D (1–10), stabilność S (dni, po których szansa przypomnienia spada do 90%) i przypominalność R.
   Odstęp dobieramy tak, żeby w dniu powtórki szansa przypomnienia = Twoja docelowa retencja (np. 90%).
   Kroki nauki nowych kart (1 min, 10 min) zostają jak w klasycznym algorytmie; FSRS liczy odstępy kart „w powtórkach”.
   Włączenie: Ustawienia → 🎯 Nauka → Algorytm. Stary algorytm (SM-2) zostaje jako opcja. */

const FS_W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const FS_DECAY = -0.5, FS_FACTOR = 19 / 81;
const fsOn = () => S?.settings?.algo === 'fsrs';
const fsRet = () => Math.min(.97, Math.max(.75, +S?.settings?.retention || .9));
const fsClampD = d => Math.min(10, Math.max(1, d));
const fsR = (t, s) => Math.pow(1 + FS_FACTOR * t / Math.max(.01, s), FS_DECAY);                 // przypominalność po t dniach
const fsIvlRaw = (s, r = fsRet()) => s / FS_FACTOR * (Math.pow(r, 1 / FS_DECAY) - 1);           // dni do spadku do r
const fsD0 = g => fsClampD(FS_W[4] - (g - 3) * FS_W[5]);
const fsNextD = (d, g) => fsClampD(FS_W[7] * fsD0(4) + (1 - FS_W[7]) * (d - FS_W[6] * (g - 3)));
const fsRecall = (d, s, r, g) => s * (Math.exp(FS_W[8]) * (11 - d) * Math.pow(s, -FS_W[9]) * (Math.exp(FS_W[10] * (1 - r)) - 1) * (g === 2 ? FS_W[15] : 1) * (g === 4 ? FS_W[16] : 1) + 1);
const fsForget = (d, s, r) => Math.min(s, FS_W[11] * Math.pow(d, -FS_W[12]) * (Math.pow(s + 1, FS_W[13]) - 1) * Math.exp(FS_W[14] * (1 - r)));
// karta z klasycznego algorytmu → przybliżony stan FSRS (odstęp ≈ stabilność, łatwość → trudność)
function fsFrom(srs) {
  if (!srs || srs.state === 'new') return null;
  return { s: Math.max(.5, srs.ivl || 1), d: fsClampD(10 - ((srs.ease || 2.5) - 1.3) * 4.2), last: Math.max(0, (srs.due || Date.now()) - (srs.ivl || 1) * DAY) };
}
const sm2Schedule = schedule;
schedule = function (srs, g, now = Date.now(), fuzzy = true) {
  if (!fsOn()) return sm2Schedule(srs, g, now, fuzzy);
  const prev = srs, out = sm2Schedule(srs, g, now, fuzzy), wasReview = prev.state === 'review';
  let fs = prev.fs ? { ...prev.fs } : fsFrom(prev);
  if (wasReview && fs) {
    const t = Math.max(0, (now - (fs.last || now)) / DAY), r = fsR(t, fs.s);
    fs.s = g === 1 ? fsForget(fs.d, fs.s, r) : fsRecall(fs.d, fs.s, r, g);
    fs.d = fsNextD(fs.d, g); fs.last = now;
  } else if (!fs) fs = { s: FS_W[g - 1], d: fsD0(g), last: now };       // pierwsza ocena nowej karty
  else fs.last = now;
  out.fs = fs;
  if (out.state === 'review') {
    const maxIvl = S?.settings?.maxIvl || 36500;
    let ivl = fsIvlRaw(fs.s);
    if (fuzzy && ivl >= 3) ivl *= .95 + Math.random() * .1;
    ivl = Math.max(1, Math.min(maxIvl, Math.round(ivl)));
    if (wasReview && g >= 3) ivl = Math.max(ivl, (prev.ivl || 0) + (g === 4 ? 2 : 1));   // dobra odpowiedź nigdy nie skraca odstępu
    out.ivl = ivl; out.due = addDays(dayStart(now), ivl);
  }
  return out;
};

// ---------- prognoza: ile powtórek i minut dziennie przy danej retencji (symulacja 30 dni)
function avgSecPerCard() {
  const ms = S.log.slice(-500).map(l => l.ms).filter(x => x > 0).sort((a, b) => a - b);
  return ms.length ? Math.max(3, Math.min(40, ms[ms.length >> 1] / 1000)) : 8;
}
function fsForecast(r, days = 30) {
  const now = Date.now(), today = dayStart(now), per = new Array(days).fill(0);
  let seed = 12345; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const c of S.cards) {
    if (c.srs.state === 'new') continue;
    let fs = c.srs.fs ? { ...c.srs.fs } : fsFrom(c.srs); if (!fs) continue;
    let day = Math.max(0, Math.floor((dayStart(Math.max(c.srs.due, now)) - today) / DAY));
    while (day < days) {
      per[day]++;
      const ok = rnd() < r;
      fs.s = ok ? fsRecall(fs.d, fs.s, r, 3) : fsForget(fs.d, fs.s, r); fs.d = fsNextD(fs.d, ok ? 3 : 1);
      day += ok ? Math.max(1, Math.round(fsIvlRaw(fs.s, r))) : 1;
    }
  }
  const avg = per.reduce((a, b) => a + b, 0) / days, sec = avgSecPerCard();
  return { perDay: avg, min: avg * sec / 60, peak: Math.max(...per) };
}
function fsSettingsHTML() {
  const st = S.settings, on = fsOn(), r = fsRet();
  const rows = on ? [.8, .85, .9, .95].map(x => { const f = fsForecast(x); return `<tr class="${Math.abs(x - r) < .001 ? 'on' : ''}"><td>${Math.round(x * 100)}%</td><td>${Math.round(f.perDay)}</td><td>${f.min < 1 ? "< 1" : Math.round(f.min)} min</td></tr>`; }).join('') : '';
  return `<div class="card fsrs-card"><h2 style="margin-top:0">🧮 Algorytm powtórek</h2>
    <div class="seg algo-seg"><button class="${on ? '' : 'on'}" data-act="algo" data-k="sm2">Klasyczny (SM-2)</button><button class="${on ? 'on' : ''}" data-act="algo" data-k="fsrs">FSRS ✨ zalecany</button></div>
    <p class="small muted">${on ? 'FSRS uczy się, jak szybko zapominasz każdą fiszkę, i planuje powtórkę dokładnie wtedy, gdy szansa przypomnienia spada do wybranego poziomu. Zwykle daje <b>tę samą pamięć przy mniejszej liczbie powtórek</b>.' : 'Klasyczny algorytm z Anki (stałe mnożniki). Włącz FSRS, żeby ustawić, ile procent chcesz pamiętać, i zobaczyć prognozę czasu.'}</p>
    ${on ? `<label class="field"><span>Ile chcesz pamiętać w dniu powtórki: <b id="ret-val">${Math.round(r * 100)}%</b></span>
      <input type="range" min="80" max="95" step="1" value="${Math.round(r * 100)}" id="set-ret"></label>
      <table class="fs-table"><thead><tr><th>Retencja</th><th>Powtórek / dzień</th><th>Czas / dzień</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="small muted" style="margin-bottom:0">Prognoza na 30 dni dla Twoich obecnych fiszek (bez nowych). Badania: 85–90% to najlepszy kompromis; przed egzaminem możesz podnieść do 95% – tryb egzaminu i tak powtórzy wszystko dzień przed.</p>` : ''}</div>`;
}
const fsMore0 = viewMore;
viewMore = function () {
  const h = fsMore0(), mark = '<div class="card"><h2 style="margin-top:0">🎯 Nauka</h2>';
  return h.includes(mark) ? h.replace(mark, fsSettingsHTML() + mark) : h + fsSettingsHTML();
};
Object.assign(ACTIONS, {
  algo: el => { S.settings.algo = el.dataset.k; save(); toast(el.dataset.k === 'fsrs' ? '🧮 FSRS włączony – kolejne powtórki planuje nowy algorytm' : 'Klasyczny algorytm SM-2'); render(); },
});
document.addEventListener('input', e => { if (e.target.id === 'set-ret') { const v = +e.target.value; $('#ret-val').textContent = v + '%'; } });
document.addEventListener('change', e => { if (e.target.id === 'set-ret') { S.settings.retention = +e.target.value / 100; save(); render(); } });

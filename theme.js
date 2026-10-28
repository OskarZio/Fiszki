'use strict';
/* Wygląd: motywy kolorystyczne (gotowe, z paletą i HEX) oraz wykresy skuteczności w statystykach. */

// ============================================================ Kolory
const hexRgb = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgbHex = (r, g, b) => '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const x = hexRgb(a), y = hexRgb(b); return rgbHex(...x.map((v, i) => v + (y[i] - v) * t)); };
const lum = h => { const [r, g, b] = hexRgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
function hueShift(hex, deg) {
  let [r, g, b] = hexRgb(hex).map(v => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  h = (h + deg + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [R, G, B] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbHex((R + m) * 255, (G + m) * 255, (B + m) * 255);
}
const validHex = h => /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(h).trim());
const normHex = h => { h = String(h).trim(); if (!h.startsWith('#')) h = '#' + h; if (h.length === 4) h = '#' + [...h.slice(1)].map(c => c + c).join(''); return h.toLowerCase(); };

// Gotowe motywy; „premium” odblokowuje się w sklepie za kryształy
const THEMES = [
  { id: 'auto', name: 'Systemowy', bg: null, accent: '#4f46e5' },
  { id: 'ocean', name: 'Ocean', bg: '#e0f2fe', accent: '#0284c7' },
  { id: 'mint', name: 'Mięta', bg: '#e6fbf2', accent: '#059669' },
  { id: 'peach', name: 'Brzoskwinia', bg: '#fff1e6', accent: '#ea580c' },
  { id: 'lavender', name: 'Lawenda', bg: '#f3e8ff', accent: '#9333ea' },
  { id: 'rose', name: 'Róż', bg: '#fdf2f8', accent: '#db2777' },
  { id: 'sun', name: 'Słońce', bg: '#fefce8', accent: '#ca8a04' },
  { id: 'night', name: 'Noc', bg: '#0f1117', accent: '#818cf8' },
  { id: 'graphite', name: 'Grafit', bg: '#18181b', accent: '#22d3ee' },
  { id: 'forest', name: 'Las', bg: '#0b1f17', accent: '#34d399' },
  { id: 'aurora', name: 'Zorza', bg: '#0b1026', accent: '#5eead4', image: 'radial-gradient(1200px 600px at 10% -10%, #1e3a8a55, transparent), radial-gradient(900px 500px at 110% 10%, #10b98155, transparent), radial-gradient(900px 700px at 50% 120%, #a855f744, transparent)', price: 250 },
  { id: 'sunset', name: 'Zachód słońca', bg: '#fff4ed', accent: '#e11d48', image: 'linear-gradient(160deg, #fff7ed 0%, #ffe4e6 45%, #ede9fe 100%)', price: 250 },
  { id: 'galaxy', name: 'Galaktyka', bg: '#0a0614', accent: '#f0abfc', image: 'radial-gradient(800px 500px at 80% 0%, #7c3aed55, transparent), radial-gradient(700px 500px at 0% 100%, #db277744, transparent)', price: 400 },
  { id: 'gold', name: 'Złoto', bg: '#17130a', accent: '#fbbf24', image: 'linear-gradient(160deg, #1c1608, #0f0c05 60%, #2a1f06)', price: 600 },
  // 👾 8-bit: cała aplikacja w pikselach – paleta Sweetie-16, pikselowa czcionka, kanciaste ramki z fazką, przyciski jak w starych grach
  { id: 'pixel', name: '👾 8-bit', bg: '#1a1c2c', accent: '#41a6f6', image: 'repeating-conic-gradient(#1a1c2c 0 25%, #1d2033 0 50%) 0 0 / 8px 8px', price: 900, pixel: true },
];
const BG_SWATCHES = ['#f5f6fb', '#ffffff', '#f8fafc', '#e0f2fe', '#e6fbf2', '#ecfccb', '#fefce8', '#fff1e6', '#ffe4e6', '#fdf2f8', '#f3e8ff', '#ede9fe',
  '#0f1117', '#18181b', '#111827', '#0b1f17', '#0c1a2b', '#1e1b4b', '#2a0f1f', '#1c1917', '#000000', '#3f3f46', '#134e4a', '#4c1d95'];
const ACCENT_SWATCHES = ['#4f46e5', '#2563eb', '#0284c7', '#0891b2', '#0d9488', '#059669', '#16a34a', '#65a30d', '#ca8a04', '#ea580c', '#dc2626', '#e11d48',
  '#db2777', '#c026d3', '#9333ea', '#7c3aed', '#818cf8', '#22d3ee', '#34d399', '#fbbf24', '#f472b6', '#a3e635', '#fb7185', '#f97316'];

const themeOwned = t => !t.price || (typeof hasItem === 'function' && hasItem('theme', t.id));
function currentTheme() { return S.settings.theme || { id: 'auto' }; }
function applyTheme() {
  try { applyAppIcon(); } catch { /* jeszcze brak stanu */ }
  const th = currentTheme(), root = document.documentElement.style;
  document.body?.classList.toggle('px-theme', th.id === 'pixel' || !!th.pixel);
  const vars = ['--bg', '--bg-image', '--card', '--card2', '--text', '--muted', '--line', '--accent', '--accent2', '--accent-soft', '--shadow'];
  if (!th.bg) {
    vars.forEach(v => root.removeProperty(v));
    const a = th.accent && th.accent !== '#4f46e5' ? th.accent : null;
    if (a) { root.setProperty('--accent', a); root.setProperty('--accent2', hueShift(a, 40)); }
    else root.setProperty('--accent2', '#9333ea');
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', a || '#4f46e5');
    return;
  }
  const bg = th.bg, accent = th.accent || '#4f46e5', dark = lum(bg) < 0.18;
  const text = dark ? '#eef0f6' : '#1b1d29';
  const set = {
    '--bg': bg, '--bg-image': th.image || 'none',
    '--card': dark ? mix(bg, '#ffffff', .07) : mix(bg, '#ffffff', .78),
    '--card2': dark ? mix(bg, '#ffffff', .13) : mix(bg, '#000000', .045),
    '--text': text, '--muted': mix(text, bg, .42), '--line': mix(text, bg, .86),
    '--accent': accent, '--accent2': hueShift(accent, 40), '--accent-soft': mix(accent, bg, dark ? .78 : .84),
    '--shadow': dark ? '0 1px 3px rgba(0,0,0,.5)' : '0 1px 3px rgba(20,20,50,.08), 0 4px 16px rgba(20,20,50,.05)',
  };
  if (th.id === 'pixel' || th.pixel) Object.assign(set, { '--card': '#262b44', '--card2': '#333c57', '--text': '#f4f4f4', '--muted': '#94b0c2', '--line': '#566c86', '--accent': '#41a6f6', '--accent2': '#3b5dc9', '--accent-soft': '#29366f', '--shadow': '4px 4px 0 #0d0e17' });
  for (const [k, v] of Object.entries(set)) root.setProperty(k, v);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', bg);
}
// Personalizacja wyglądu fiszek i interfejsu
const FONTS = { system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', serif: 'Georgia, "Times New Roman", serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", -apple-system, sans-serif', mono: 'ui-monospace, "SF Mono", Menlo, monospace' };
const RADII = { square: ['6px', '6px'], soft: ['16px', '12px'], round: ['26px', '22px'] };
function applyPersonal() {
  const st = S.settings, r = document.documentElement.style, b = document.body.classList;
  r.setProperty('--card-fs', st.cardSize || 1); r.setProperty('--card-font', FONTS[st.cardFont] || FONTS.system);
  r.setProperty('--card-align', st.cardAlign === 'left' ? 'left' : 'center');
  const [rc, rb] = RADII[st.radius] || RADII.soft; r.setProperty('--r', rc); r.setProperty('--rb', rb);
  b.toggle('compact', !!st.compact); b.toggle('nolabels', st.tabLabels === false);
}
function setTheme(patch) { S.settings.theme = { ...currentTheme(), ...patch }; applyTheme(); save(); }
on('start', applyTheme);
applyTheme.early = () => { try { if (S) applyTheme(); } catch { /* jeszcze brak stanu */ } };

function personalHTML() {
  const st = S.settings;
  const sel = (k, list) => `<select data-pers="${k}">${list.map(([v, l]) => `<option value="${v}" ${String(st[k]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const chk = (k, l, def = true) => `<label class="check"><input type="checkbox" data-pers="${k}" ${(st[k] ?? def) ? 'checked' : ''}> ${l}</label>`;
  return `<div class="card"><h3 style="margin-top:0">Personalizacja</h3>
    <div class="grid2">
      <label class="field"><span>Tekst na fiszkach</span>${sel('cardSize', [[0.85, 'mały'], [1, 'normalny'], [1.2, 'duży'], [1.45, 'bardzo duży']])}</label>
      <label class="field"><span>Czcionka fiszek</span>${sel('cardFont', [['system', 'systemowa'], ['serif', 'szeryfowa'], ['rounded', 'zaokrąglona'], ['mono', 'maszynowa']])}</label>
      <label class="field"><span>Wyrównanie</span>${sel('cardAlign', [['center', 'do środka'], ['left', 'do lewej']])}</label>
      <label class="field"><span>Narożniki</span>${sel('radius', [['square', 'ostre'], ['soft', 'łagodne'], ['round', 'okrągłe']])}</label>
      <label class="field"><span>Przyciski ocen</span>${sel('grade2', [['false', '4 (jak Anki)'], ['true', '2 (pamiętam / nie)']])}</label>
    </div>
    ${chk('gradients', 'Kolory gradientowe (wyłącz dla jednolitych kolorów)')}
    ${chk('showIvl', 'Pokazuj odstęp na przyciskach ocen')}
    ${chk('tts', 'Czytaj fiszki na głos (🔊)', false)}
    ${chk('compact', 'Kompaktowy układ (mniej odstępów)', false)}
    ${chk('tabLabels', 'Podpisy pod ikonami w dolnym pasku')}
    ${chk('anim', 'Animacje i konfetti')}
    <label class="field"><span>Wygląd bohatera</span>${sel('heroStyle', [['pixel', '👾 8-bit (pixel art)'], ['smooth', '✨ Gładcy (rysowani)']])}</label>
    <label class="field"><span>Wygląd naklejek</span>${sel('stStyle', [['svg', '🏷️ Naklejki (własne)'], ['3d', '🧸 Ilustracje 3D'], ['emoji', '😀 Zwykłe emoji']])}</label>
    ${chk('emojiIcons', 'Ikony zamiast emotek w menu i przyciskach')}
    ${chk('stickerAnim', 'Animowane naklejki')}
    ${chk('stickerSound', 'Dźwięki naklejek (np. koza 🐐)')}
    ${chk('sound', 'Dźwięki')}
    ${chk('loginRewards', '🎁 Nagroda dnia przy wejściu (okienko na start)')}
  </div>`;
}
document.addEventListener('change', e => {
  const k = e.target.dataset?.pers; if (!k) return;
  const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  S.settings[k] = k === 'cardSize' ? +v : k === 'grade2' ? v === 'true' : v;
  save(); render();
});
ROUTES.theme = () => {
  const th = currentTheme();
  onMount(() => {
    const bind = (pick, hex, key) => {
      $(pick)?.addEventListener('input', e => { $(hex).value = e.target.value; setTheme({ id: 'custom', bg: key === 'bg' ? e.target.value : (th.bg || '#f5f6fb'), [key]: e.target.value, image: null }); });
      $(hex)?.addEventListener('change', e => {
        if (!validHex(e.target.value)) return toast('Wpisz kolor w formacie #RRGGBB');
        const v = normHex(e.target.value); $(pick).value = v;
        setTheme({ id: 'custom', bg: key === 'bg' ? v : (currentTheme().bg || '#f5f6fb'), [key]: v, image: null }); render();
      });
    };
    bind('#bg-pick', '#bg-hex', 'bg'); bind('#ac-pick', '#ac-hex', 'accent');
  });
  const sw = (list, key) => list.map(c => `<button class="swatch${(key === 'bg' ? th.bg : th.accent) === c ? ' on' : ''}" style="background:${c}" data-act="theme-color" data-k="${key}" data-c="${c}" aria-label="${c}"></button>`).join('');
  return { tab: 'more', html: `
  <div class="row nowrap"><button class="iconbtn" data-go="#/more">‹</button><h1 class="grow">Wygląd</h1></div>
  ${personalHTML()}
  ${appIconHTML()}
  <div class="card"><h3 style="margin-top:0">Motywy</h3><div class="themes">${THEMES.map(t => {
    const owned = themeOwned(t), on = th.id === t.id;
    const bg = t.bg ? `background:${t.bg};background-image:${t.image || 'none'}` : 'background:linear-gradient(135deg,#f5f6fb 50%,#0f1117 50%)';
    return `<button class="theme${on ? ' on' : ''}" style="${bg}" data-act="theme-pick" data-id="${t.id}">
      <span class="dot" style="background:${t.accent}"></span><b style="color:${t.bg && lum(t.bg) < .18 ? '#fff' : '#1b1d29'}">${t.name}</b>
      ${owned ? '' : `<small class="lock">🔒 ${t.price} 💎</small>`}</button>`;
  }).join('')}</div></div>
  <div class="card"><h3 style="margin-top:0">Tło aplikacji</h3><div class="swatches">${sw(BG_SWATCHES, 'bg')}</div>
    <div class="row nowrap"><input type="color" id="bg-pick" value="${th.bg || '#f5f6fb'}" class="cpick"><input id="bg-hex" value="${th.bg || '#f5f6fb'}" placeholder="#RRGGBB" maxlength="7" class="grow" autocapitalize="off"></div></div>
  <div class="card"><h3 style="margin-top:0">Kolor akcentu</h3><div class="swatches">${sw(ACCENT_SWATCHES, 'accent')}</div>
    <div class="row nowrap"><input type="color" id="ac-pick" value="${th.accent || '#4f46e5'}" class="cpick"><input id="ac-hex" value="${th.accent || '#4f46e5'}" placeholder="#RRGGBB" maxlength="7" class="grow" autocapitalize="off"></div></div>
  <div class="card"><h3 style="margin-top:0">Podgląd</h3>
    <button class="primary block">Przycisk</button><div class="spacer"></div>${progress(.62)}<div class="spacer"></div>
    <div class="row"><span class="tag">etykieta</span><span class="muted small">tekst pomocniczy</span></div></div>
  <button class="block" data-act="theme-pick" data-id="auto">↺ Przywróć systemowy (jasny/ciemny automatycznie)</button>` };
};

// ============================================================ Ikona aplikacji (ekran początkowy iPhone'a)
// Domyślna jest czerwona (icons/apple-touch-icon.png). Inny kolor podmienia <link rel="apple-touch-icon"> i favicon –
// Safari bierze ikonę w chwili „Do ekranu początkowego”, więc po zmianie trzeba aplikację usunąć z ekranu i dodać ponownie.
const APP_ICONS = [['red', 'Czerwona'], ['blue', 'Niebieska'], ['purple', 'Fioletowa'], ['green', 'Zielona'], ['orange', 'Pomarańczowa'],
  ['cyan', 'Turkusowa'], ['pink', 'Różowa'], ['ice', 'Lodowa'], ['violet', 'Indygo']];
const appIconOf = () => APP_ICONS.some(([c]) => c === S?.settings?.appIcon) ? S.settings.appIcon : 'red';
function applyAppIcon() {
  const c = appIconOf(), touch = (c === 'red' ? 'icons/apple-touch-icon.png' : `icons/alt/${c}-180.png`) + '?v=2';   // ?v – iOS nie bierze starej ikony z pamięci
  document.querySelectorAll('link[rel="apple-touch-icon"]').forEach(l => { if (l.getAttribute('href') !== touch) l.setAttribute('href', touch); });
  const fav = (c === 'red' ? 'icons/favicon-64.png' : `icons/alt/${c}-180.png`) + '?v=2';
  document.querySelectorAll('link[rel="icon"]').forEach(l => { if (l.getAttribute('href') !== fav) l.setAttribute('href', fav); });
}
function appIconHTML() {
  const cur = appIconOf();
  return `<div class="card"><h3 style="margin-top:0">Ikona aplikacji</h3>
    <div class="appicons">${APP_ICONS.map(([c, n]) => `<button class="appicon${c === cur ? ' on' : ''}" data-act="app-icon" data-c="${c}" aria-label="${n}" title="${n}"><img src="icons/alt/${c}-180.png" alt="" width="56" height="56" loading="lazy"></button>`).join('')}</div>
    <p class="muted small" style="margin:10px 0 0">📱 iPhone: po zmianie usuń Fiszki z ekranu początkowego i dodaj ponownie (Safari → Udostępnij → „Do ekranu początkowego”). Dane zostają.</p></div>`;
}

Object.assign(ACTIONS, {
  'app-icon': el => {
    const c = el.dataset.c; if (!APP_ICONS.some(([x]) => x === c)) return;
    S.settings.appIcon = c; applyAppIcon(); save(); render();
    toast('Ikona ustawiona – na iPhonie dodaj aplikację ponownie do ekranu początkowego');
  },
  'theme-pick': el => {
    const t = THEMES.find(x => x.id === el.dataset.id); if (!t) return;
    if (!themeOwned(t)) { if (confirm(`Motyw „${t.name}” kosztuje ${t.price} 💎. Przejść do sklepu?`)) go('#/shop'); return; }
    S.settings.theme = { id: t.id, bg: t.bg, accent: t.accent, image: t.image || null, ...(t.pixel ? { pixel: true } : {}) }; applyTheme(); save(); render();
  },
  'theme-color': el => {
    const th = currentTheme(), k = el.dataset.k;
    setTheme({ id: 'custom', bg: k === 'bg' ? el.dataset.c : (th.bg || (matchMedia('(prefers-color-scheme: dark)').matches ? '#0f1117' : '#f5f6fb')), [k]: el.dataset.c, image: null }); render();
  },
});

// ============================================================ Wykresy w statystykach
let CHART_RANGE = 30;
function dailySeries(days) {
  const today = dayStart(), from = addDays(today, -(days - 1)), byDay = {};
  for (let i = S.log.length - 1; i >= 0 && S.log[i].t >= from; i--) {
    const l = S.log[i], k = dayKey(l.t), d = byDay[k] || (byDay[k] = { n: 0, ok: 0 });
    d.n++; if (l.g > 1) d.ok++;
  }
  return Array.from({ length: days }, (_, i) => { const t = addDays(from, i), k = dayKey(t), d = byDay[k] || { n: 0, ok: 0 };
    return { t, k, n: d.n, acc: d.n ? Math.round(d.ok / d.n * 100) : null }; });
}
function statsChartsHTML() {
  onMount(drawCharts);
  const s = dailySeries(CHART_RANGE), withData = s.filter(d => d.n);
  const tot = withData.reduce((a, d) => a + d.n, 0), ok = withData.reduce((a, d) => a + d.n * d.acc / 100, 0);
  const avg = tot ? Math.round(ok / tot * 100) : 0;
  const half = Math.floor(s.length / 2), part = arr => { const n = arr.reduce((a, d) => a + d.n, 0); return n ? arr.reduce((a, d) => a + d.n * (d.acc || 0) / 100, 0) / n * 100 : null; };
  const p1 = part(s.slice(0, half)), p2 = part(s.slice(half)), delta = p1 != null && p2 != null ? Math.round(p2 - p1) : null;
  return `<div class="card"><div class="chart-head"><h2>📈 Skuteczność</h2>
    <div class="seg">${[7, 30, 90].map(d => `<button class="${CHART_RANGE === d ? 'on' : ''}" data-act="chart-range" data-d="${d}">${d} dni</button>`).join('')}</div></div>
    <div class="kpis"><div><b>${avg}%</b><small>średnio</small></div><div><b class="${delta > 0 ? 'c-rev' : delta < 0 ? 'c-lrn' : ''}">${delta == null ? '–' : (delta > 0 ? '▲ +' : delta < 0 ? '▼ ' : '') + delta + ' pp'}</b><small>zmiana<br>(2. vs 1. połowa)</small></div><div><b>${tot}</b><small>powtórek</small></div></div>
    <div class="chart" id="chart-acc" aria-label="Skuteczność dzienna w procentach"></div>
    <h3 style="margin:14px 0 4px">Powtórki dziennie</h3>
    <div class="chart" id="chart-rev" aria-label="Liczba powtórek dziennie"></div>
    <details class="small"><summary>Tabela</summary><table class="preview"><tr><td><b>Dzień</b></td><td><b>Powtórki</b></td><td><b>Skuteczność</b></td></tr>
      ${withData.slice().reverse().map(d => `<tr><td>${d.k}</td><td>${d.n}</td><td>${d.acc}%</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Brak danych</td></tr>'}</table></details>
  </div>`;
}
function drawCharts() {
  const s = dailySeries(CHART_RANGE);
  const css = getComputedStyle(document.documentElement);
  const C = { accent: css.getPropertyValue('--accent').trim() || '#4f46e5', accent2: css.getPropertyValue('--accent2').trim() || '#9333ea',
    muted: css.getPropertyValue('--muted').trim(), line: css.getPropertyValue('--line').trim(), card: css.getPropertyValue('--card').trim() || '#fff' };
  const fmtDay = t => new Date(t).toLocaleDateString('pl', { day: 'numeric', month: 'short' });
  const draw = (el, kind) => {
    if (!el) return;
    const W = el.clientWidth || 320, H = kind === 'acc' ? 180 : 120, L = 34, R = 10, T = 12, B = 22, iw = W - L - R, ih = H - T - B;
    const x = i => L + (s.length === 1 ? iw / 2 : i * iw / (s.length - 1));
    const maxN = Math.max(5, ...s.map(d => d.n)), niceMax = Math.ceil(maxN / 5) * 5;
    const y = v => T + ih - (kind === 'acc' ? v / 100 : v / niceMax) * ih;
    const ticks = kind === 'acc' ? [0, 50, 100] : [0, niceMax / 2, niceMax];
    let g = ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${C.line}" stroke-width="1"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="${C.muted}">${Math.round(v)}${kind === 'acc' ? '%' : ''}</text>`).join('');
    const lbl = [0, Math.floor((s.length - 1) / 2), s.length - 1].map(i => `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === s.length - 1 ? 'end' : 'middle'}" font-size="11" fill="${C.muted}">${fmtDay(s[i].t)}</text>`).join('');
    if (kind === 'acc') {
      const segs = []; let cur = [];
      s.forEach((d, i) => { if (d.acc == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push([x(i), y(d.acc)]); });
      if (cur.length) segs.push(cur);
      const area = segs.filter(sg => sg.length > 1).map(sg => `<path d="M${sg[0][0]},${y(0)} ${sg.map(p => `L${p[0]},${p[1]}`).join(' ')} L${sg[sg.length - 1][0]},${y(0)} Z" fill="url(#accgrad)"/>`).join('');
      const lines = segs.map(sg => `<path d="M${sg.map(p => p.join(',')).join(' L')}" fill="none" stroke="${C.accent}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
      const dots = s.length <= 31 ? s.map((d, i) => d.acc == null ? '' : `<circle cx="${x(i)}" cy="${y(d.acc)}" r="4" fill="${C.accent}" stroke="${C.card}" stroke-width="2"/>`).join('') : '';
      g += `<defs><linearGradient id="accgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.accent}" stop-opacity=".28"/><stop offset="1" stop-color="${C.accent2}" stop-opacity="0"/></linearGradient></defs>${area}${lines}${dots}`;
    } else {
      const bw = Math.max(2, iw / s.length - 2);
      g += s.map((d, i) => d.n ? `<path d="M${x(i) - bw / 2},${y(0)} V${y(d.n) + Math.min(4, bw / 2)} q0,-${Math.min(4, bw / 2)} ${Math.min(4, bw / 2)},-${Math.min(4, bw / 2)} H${x(i) + bw / 2 - Math.min(4, bw / 2)} q${Math.min(4, bw / 2)},0 ${Math.min(4, bw / 2)},${Math.min(4, bw / 2)} V${y(0)} Z" fill="${C.accent}" opacity=".85"/>` : '').join('');
    }
    el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">${g}${lbl}<line class="xh" x1="0" x2="0" y1="${T}" y2="${T + ih}" stroke="${C.muted}" stroke-dasharray="3 3" visibility="hidden"/></svg><div class="tip hidden"></div>`;
    const svg = el.querySelector('svg'), tip = el.querySelector('.tip'), xh = el.querySelector('.xh');
    const show = ev => {
      const r = svg.getBoundingClientRect(), px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      const i = clamp(Math.round((px - L) / (iw / Math.max(1, s.length - 1))), 0, s.length - 1), d = s[i];
      xh.setAttribute('x1', x(i)); xh.setAttribute('x2', x(i)); xh.setAttribute('visibility', 'visible');
      tip.innerHTML = `<b>${fmtDay(d.t)}</b><br>${kind === 'acc' ? (d.acc == null ? 'brak powtórek' : `skuteczność ${d.acc}% · ${d.n} powt.`) : `${d.n} powtórek`}`;
      tip.classList.remove('hidden'); tip.style.left = clamp(x(i) - 70, 0, W - 140) + 'px';
    };
    const hide = () => { tip.classList.add('hidden'); xh.setAttribute('visibility', 'hidden'); };
    svg.addEventListener('pointermove', show); svg.addEventListener('pointerdown', show); svg.addEventListener('pointerleave', hide);
  };
  draw($('#chart-acc'), 'acc'); draw($('#chart-rev'), 'rev');
}
window.addEventListener('resize', () => { if ($('#chart-acc')) drawCharts(); });
Object.assign(ACTIONS, { 'chart-range': el => { CHART_RANGE = +el.dataset.d; render(); } });

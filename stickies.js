'use strict';
/* Karteczki-przypominajki (żółte „post-it”) na ekranie startowym.
   Można ustawić termin, kolor, odhaczyć – i zapisać wszystkie jako obraz na tapetę / ekran blokady telefonu. */

const STICKY_COLORS = { y: '#fde68a', p: '#fbcfe8', g: '#bbf7d0', b: '#bfdbfe', o: '#fed7aa' };
const stickyById = id => S.stickies.find(x => x.id === id);
// kolor: jeden z gotowych albo własny (#rrggbb); tekst ciemny lub jasny – zależnie od tła
const stickyColor = s => STICKY_COLORS[s.color] || (/^#[0-9a-f]{6}$/i.test(s.color || '') ? s.color : STICKY_COLORS.y);
const stickyInk = s => { try { return lum(stickyColor(s)) < .28 ? '#f8fafc' : '#1f2937'; } catch { return '#1f2937'; } };
const stickyVars = (s, rot) => `--sc:${stickyColor(s)};--ink:${stickyInk(s)};--rot:${rot}deg`;
// komputer (szeroki ekran + mysz): karteczki można przypiąć w dowolnym miejscu ekranu głównego
const stickyDesk = () => matchMedia('(min-width: 900px) and (pointer: fine)').matches;
const activeStickies = () => S.stickies.filter(x => !x.done).sort((a, b) => (a.due || 9e15) - (b.due || 9e15) || a.created - b.created);
function dueLabel(t) {
  if (!t) return '';
  const d = Math.round((dayStart(t) - dayStart()) / DAY);
  return d < 0 ? `⚠️ ${-d} ${plural(-d, 'dzień', 'dni', 'dni')} temu` : d === 0 ? '⏰ dziś' : d === 1 ? 'jutro' : new Date(t).toLocaleDateString('pl', { day: 'numeric', month: 'short' });
}
function stickiesHTML() {
  const all = activeStickies(), desk = stickyDesk();
  const list = desk ? all.filter(x => !x.pin) : all, pinned = desk ? all.filter(x => x.pin) : [];
  const due = s => s.due ? `<span class="due${s.due < dayStart() ? ' late' : ''}">${dueLabel(s.due)}</span>` : '';
  const card = (s, i) => `<div class="sticky" style="${stickyVars(s, [-2, 1.5, -1, 2.2, -1.6][i % 5])}">
        <div class="stxt" data-go="#/sticky/${s.id}">${fmt(s.text)}</div>
        <div class="row nowrap small">${due(s)}<span class="grow"></span>
          ${desk ? `<button class="ghost sm" data-act="sticky-pin" data-id="${s.id}" title="Przypnij w dowolnym miejscu ekranu">📍</button>` : ''}
          <button class="ghost sm" data-act="sticky-done" data-id="${s.id}" title="Zrobione">✓</button></div></div>`;
  const free = s => `<div class="sticky free" data-id="${s.id}" style="${stickyVars(s, 0)};left:${(s.pin.x * 100).toFixed(2)}vw;top:${(s.pin.y * 100).toFixed(2)}vh">
        <div class="grip" title="Przeciągnij, żeby przesunąć">⠿</div>
        <div class="stxt" data-go="#/sticky/${s.id}">${fmt(s.text)}</div>
        <div class="row nowrap small">${due(s)}<span class="grow"></span>
          <button class="ghost sm" data-act="sticky-unpin" data-id="${s.id}" title="Odepnij (wróć do listy)">↩</button>
          <button class="ghost sm" data-act="sticky-done" data-id="${s.id}" title="Zrobione">✓</button></div></div>`;
  if (pinned.length) onMount(mountStickyDrag);
  return `<div class="stickies-wrap"><div class="row nowrap"><b class="grow">📌 Karteczki</b>
      ${all.length ? '<button class="sm ghost" data-act="sticky-wall">🖼️ Tapeta</button>' : ''}<button class="sm" data-act="sticky-new">➕</button></div>
    ${list.length ? `<div class="stickies">${list.map(card).join('')}</div>`
    : pinned.length ? '<p class="small muted" style="margin:4px 0 0">Wszystkie karteczki są przypięte na ekranie – przeciągaj je za ⠿.</p>'
    : `<p class="small muted" style="margin:4px 0 0">Przyklej sobie przypomnienie – np. „powtórzyć nerwy czaszkowe przed piątkiem”.${desk ? ' Na komputerze możesz je przypiąć w dowolnym miejscu (📍).' : ''}</p>`}</div>
    ${pinned.length ? `<div class="sticky-layer">${pinned.map(free).join('')}</div>` : ''}`;
}
// przeciąganie przypiętych karteczek (pozycja w % okna – pasuje do każdego rozmiaru)
function mountStickyDrag() {
  document.querySelectorAll('.sticky.free .grip').forEach(g => g.addEventListener('pointerdown', e => {
    const el = g.closest('.sticky.free'), s = stickyById(el.dataset.id); if (!s) return;
    e.preventDefault(); g.setPointerCapture(e.pointerId); el.classList.add('dragging');
    const r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    const move = ev => {
      const x = clamp(ev.clientX - dx, 0, innerWidth - r.width), y = clamp(ev.clientY - dy, 0, innerHeight - 40);
      el.style.left = x + 'px'; el.style.top = y + 'px';
    };
    const up = () => {
      g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up);
      el.classList.remove('dragging');
      const nr = el.getBoundingClientRect();
      s.pin = { x: +(nr.left / innerWidth).toFixed(4), y: +(nr.top / innerHeight).toFixed(4) }; touch(s); save();
    };
    g.addEventListener('pointermove', move); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
  }));
}
ROUTES.sticky = parts => {
  const s = stickyById(parts[1]);
  if (!s) return { html: '<p><a href="#/">Wróć</a></p>' };
  onMount(() => {
    const ta = $('#st-text'); ta.focus();
    ta.addEventListener('input', () => { s.text = ta.value; touch(s); save(); });
    const col = $('#st-color');
    col.addEventListener('input', () => { s.color = col.value; $('#st-big').setAttribute('style', stickyVars(s, 0)); col.parentElement.style.background = col.value; });
    col.addEventListener('change', () => { s.color = col.value; touch(s); save(); render(); });
    $('#st-due').addEventListener('change', e => { s.due = e.target.value ? new Date(e.target.value + 'T09:00').getTime() : null; touch(s); save(); });
  });
  const dueVal = s.due ? new Date(s.due).toISOString().slice(0, 10) : '';
  return { tab: 'home', html: `<div class="row nowrap"><button class="iconbtn" data-go="#/">‹</button><h1 class="grow">Karteczka</h1></div>
    <div class="sticky big" id="st-big" style="${stickyVars(s, 0)}"><textarea id="st-text" rows="6" placeholder="Co mam zapamiętać / zrobić?">${esc(s.text)}</textarea></div>
    <div class="row">${Object.entries(STICKY_COLORS).map(([k, c]) => `<button class="swatch${s.color === k ? ' on' : ''}" style="background:${c};width:44px" data-act="sticky-color" data-id="${s.id}" data-c="${k}"></button>`).join('')}
      <label class="swatch custom-col${STICKY_COLORS[s.color] ? '' : ' on'}" title="Własny kolor" style="background:${STICKY_COLORS[s.color] ? 'conic-gradient(#f87171,#facc15,#4ade80,#60a5fa,#c084fc,#f87171)' : stickyColor(s)}">
        <input type="color" id="st-color" value="${stickyColor(s)}"></label></div>
    <p class="small muted" style="margin:4px 0 0">🎨 Ostatnie pole to dowolny własny kolor.${stickyDesk() ? ' Na ekranie głównym możesz przypiąć karteczkę w dowolnym miejscu (📍).' : ''}</p>
    <label class="field"><span>Termin (opcjonalnie)</span><input type="date" id="st-due" value="${dueVal}"></label>
    <div class="row"><button class="primary grow" data-go="#/">Gotowe</button><button class="danger" data-act="sticky-del" data-id="${s.id}">Usuń</button></div>` };
};

// Tapeta: wszystkie karteczki jako obraz (do ustawienia jako tło / ekran blokady)
async function stickyWallpaper() {
  const W = 1170, H = 2532, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#1e1b4b'); bg.addColorStop(1, '#0f172a');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const list = activeStickies().slice(0, 8), cols = 2, pad = 70, nw = (W - pad * 3) / 2, nh = 440, top = 820;  // zostawiamy miejsce na zegar
  g.textBaseline = 'top';
  list.forEach((s, i) => {
    const x = pad + (i % cols) * (nw + pad), y = top + Math.floor(i / cols) * (nh + 60);
    g.save(); g.translate(x + nw / 2, y + nh / 2); g.rotate([-2, 1.5, -1, 2.2][i % 4] * Math.PI / 180); g.translate(-nw / 2, -nh / 2);
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 30; g.shadowOffsetY = 14;
    g.fillStyle = stickyColor(s); g.fillRect(0, 0, nw, nh); g.shadowColor = 'transparent';
    g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, 0, nw, 46);
    g.fillStyle = stickyInk(s); g.font = '600 46px -apple-system, Segoe UI, sans-serif';
    const words = s.text.replace(/\n/g, ' \n ').split(' '); let line = '', ly = 76;
    for (const w of words) {
      if (w === '\n' || g.measureText(line + w).width > nw - 60) { g.fillText(line, 30, ly); ly += 58; line = w === '\n' ? '' : w + ' '; if (ly > nh - 110) break; }
      else line += w + ' ';
    }
    if (ly <= nh - 110) g.fillText(line, 30, ly);
    if (s.due) { g.font = '700 38px -apple-system, sans-serif'; g.fillStyle = s.due < dayStart() ? '#b91c1c' : '#92400e'; g.fillText(dueLabel(s.due), 30, nh - 70); }
    g.restore();
  });
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  await shareOrDownload(blob, 'karteczki-tapeta.png');
  toast('Zapisz obraz i ustaw jako tapetę lub ekran blokady (Zdjęcia → Udostępnij → Użyj jako tapety)', 5000);
}

Object.assign(ACTIONS, {
  'sticky-new': () => { const s = touch({ id: uid(), text: '', color: 'y', due: null, done: false, created: Date.now() }); S.stickies.push(s); save(); go('#/sticky/' + s.id); },
  'sticky-done': el => { const s = stickyById(el.dataset.id); if (s) { s.done = true; touch(s); save(); render(); toast('✓ Odhaczone'); } },
  'sticky-del': el => { S.stickies = S.stickies.filter(x => x.id !== el.dataset.id); S.tomb[el.dataset.id] = Date.now(); save(); go('#/'); },
  'sticky-color': el => { const s = stickyById(el.dataset.id); s.color = el.dataset.c; touch(s); save(); render(); },
  'sticky-wall': () => stickyWallpaper(),
  'sticky-pin': el => {
    const s = stickyById(el.dataset.id); if (!s) return;
    const n = S.stickies.filter(x => x.pin && !x.done).length;   // kolejne lądują obok siebie po prawej
    s.pin = { x: clamp(.74 - (n % 3) * .05, .02, .85), y: clamp(.12 + (n % 5) * .1, .02, .8) }; touch(s); save(); render();
    toast('Przypięte 📍 – przeciągnij za ⠿ w dowolne miejsce');
  },
  'sticky-unpin': el => { const s = stickyById(el.dataset.id); if (s) { delete s.pin; touch(s); save(); render(); } },
});
// puste karteczki nie zostają po wyjściu z edycji
window.addEventListener('hashchange', () => {
  if (!S || parseRoute().parts[0] === 'sticky') return;
  const empty = S.stickies.filter(x => !x.text.trim());
  if (empty.length) { empty.forEach(x => { S.tomb[x.id] = Date.now(); }); S.stickies = S.stickies.filter(x => x.text.trim()); save(); }
});

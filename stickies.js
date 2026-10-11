'use strict';
/* Karteczki-przypominajki (żółte „post-it”) na ekranie startowym.
   Można ustawić termin, kolor, odhaczyć – i zapisać wszystkie jako obraz na tapetę / ekran blokady telefonu. */

const STICKY_COLORS = { y: '#fde68a', p: '#fbcfe8', g: '#bbf7d0', b: '#bfdbfe', o: '#fed7aa' };
const stickyById = id => S.stickies.find(x => x.id === id);
const activeStickies = () => S.stickies.filter(x => !x.done).sort((a, b) => (a.due || 9e15) - (b.due || 9e15) || a.created - b.created);
function dueLabel(t) {
  if (!t) return '';
  const d = Math.round((dayStart(t) - dayStart()) / DAY);
  return d < 0 ? `⚠️ ${-d} ${plural(-d, 'dzień', 'dni', 'dni')} temu` : d === 0 ? '⏰ dziś' : d === 1 ? 'jutro' : new Date(t).toLocaleDateString('pl', { day: 'numeric', month: 'short' });
}
function stickiesHTML() {
  const list = activeStickies();
  return `<div class="stickies-wrap"><div class="row nowrap"><b class="grow">📌 Karteczki</b>
      ${list.length ? '<button class="sm ghost" data-act="sticky-wall">🖼️ Tapeta</button>' : ''}<button class="sm" data-act="sticky-new">➕</button></div>
    ${list.length ? `<div class="stickies">${list.map((s, i) => `<div class="sticky" style="--sc:${STICKY_COLORS[s.color] || STICKY_COLORS.y};--rot:${[-2, 1.5, -1, 2.2, -1.6][i % 5]}deg">
        <div class="stxt" data-go="#/sticky/${s.id}">${fmt(s.text)}</div>
        <div class="row nowrap small">${s.due ? `<span class="due${s.due < dayStart() ? ' late' : ''}">${dueLabel(s.due)}</span>` : ''}<span class="grow"></span>
          <button class="ghost sm" data-act="sticky-done" data-id="${s.id}" title="Zrobione">✓</button></div></div>`).join('')}</div>`
    : '<p class="small muted" style="margin:4px 0 0">Przyklej sobie przypomnienie – np. „powtórzyć nerwy czaszkowe przed piątkiem”.</p>'}</div>`;
}
ROUTES.sticky = parts => {
  const s = stickyById(parts[1]);
  if (!s) return { html: '<p><a href="#/">Wróć</a></p>' };
  onMount(() => {
    const ta = $('#st-text'); ta.focus();
    ta.addEventListener('input', () => { s.text = ta.value; touch(s); save(); });
    $('#st-due').addEventListener('change', e => { s.due = e.target.value ? new Date(e.target.value + 'T09:00').getTime() : null; touch(s); save(); });
  });
  const dueVal = s.due ? new Date(s.due).toISOString().slice(0, 10) : '';
  return { tab: 'home', html: `<div class="row nowrap"><button class="iconbtn" data-go="#/">‹</button><h1 class="grow">Karteczka</h1></div>
    <div class="sticky big" style="--sc:${STICKY_COLORS[s.color]};--rot:0deg"><textarea id="st-text" rows="6" placeholder="Co mam zapamiętać / zrobić?">${esc(s.text)}</textarea></div>
    <div class="row">${Object.entries(STICKY_COLORS).map(([k, c]) => `<button class="swatch${s.color === k ? ' on' : ''}" style="background:${c};width:44px" data-act="sticky-color" data-id="${s.id}" data-c="${k}"></button>`).join('')}</div>
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
    g.fillStyle = STICKY_COLORS[s.color] || STICKY_COLORS.y; g.fillRect(0, 0, nw, nh); g.shadowColor = 'transparent';
    g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, 0, nw, 46);
    g.fillStyle = '#1f2937'; g.font = '600 46px -apple-system, Segoe UI, sans-serif';
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
});
// puste karteczki nie zostają po wyjściu z edycji
window.addEventListener('hashchange', () => {
  if (!S || parseRoute().parts[0] === 'sticky') return;
  const empty = S.stickies.filter(x => !x.text.trim());
  if (empty.length) { empty.forEach(x => { S.tomb[x.id] = Date.now(); }); S.stickies = S.stickies.filter(x => x.text.trim()); save(); }
});

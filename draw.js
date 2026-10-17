'use strict';
/* ✏️ Szkicownik: rysowanie palcem / rysikiem / myszką (skojarzenie jako obrazek).
   openDrawPad(dataUrl?) → Promise<dataUrl | null>. Białe tło, kolory, grubość, gumka, cofnij, wyczyść. */

const PAD_COLORS = ['#111827', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#ffffff'];
const PAD_SIZES = [3, 6, 12, 22];

function openDrawPad(start) {
  return new Promise(resolve => {
    document.querySelector('.draw-ov')?.remove();
    const ov = document.createElement('div'); ov.className = 'draw-ov';
    ov.innerHTML = `<div class="draw-box">
      <div class="row nowrap draw-top"><b class="grow">✏️ Narysuj skojarzenie</b>
        <button class="sm" data-d="undo" title="Cofnij">↶</button><button class="sm" data-d="clear" title="Wyczyść">🗑️</button></div>
      <div class="draw-wrap"><canvas></canvas></div>
      <div class="draw-tools">
        <div class="draw-colors">${PAD_COLORS.map((c, i) => `<button data-c="${c}" class="${i ? '' : 'on'}" style="--c:${c}" title="${c === '#ffffff' ? 'gumka (biały)' : c}"></button>`).join('')}</div>
        <div class="draw-sizes">${PAD_SIZES.map((s, i) => `<button data-s="${s}" class="${i === 1 ? 'on' : ''}"><i style="width:${Math.min(22, s + 2)}px;height:${Math.min(22, s + 2)}px"></i></button>`).join('')}</div>
      </div>
      <div class="row nowrap"><button class="grow" data-d="cancel">Anuluj</button><button class="primary grow" data-d="ok">✓ Zapisz rysunek</button></div></div>`;
    document.body.append(ov);
    const cv = ov.querySelector('canvas'), ctx = cv.getContext('2d'), wrap = ov.querySelector('.draw-wrap');
    // płótno 4:3, w pikselach urządzenia (ostre linie na Retinie)
    const W = Math.min(wrap.clientWidth, 720), H = Math.round(W * .75), dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.scale(dpr, dpr); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const blank = () => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); };
    blank();
    const hist = [];
    const snap = () => { hist.push(ctx.getImageData(0, 0, cv.width, cv.height)); if (hist.length > 30) hist.shift(); };
    if (start) { const im = new Image(); im.onload = () => { ctx.drawImage(im, 0, 0, W, H); }; im.src = start; }
    let color = PAD_COLORS[0], size = PAD_SIZES[1], drawing = false, last = null, dirty = false;
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener('pointerdown', e => {
      e.preventDefault(); cv.setPointerCapture(e.pointerId); snap(); drawing = true; dirty = true; last = pos(e);
      ctx.beginPath(); ctx.fillStyle = color; ctx.arc(last.x, last.y, size / 2, 0, Math.PI * 2); ctx.fill();
    });
    cv.addEventListener('pointermove', e => {
      if (!drawing) return; e.preventDefault();
      const pts = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      ctx.strokeStyle = color; ctx.lineWidth = size * (e.pointerType === 'pen' && e.pressure ? .5 + e.pressure : 1);
      for (const pe of pts) { const p = pos(pe); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; }
    });
    const end = () => { drawing = false; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    const close = v => { ov.remove(); resolve(v); };
    ov.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) { if (e.target === ov) close(null); return; }
      if (b.dataset.c) { color = b.dataset.c; ov.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === b)); }
      if (b.dataset.s) { size = +b.dataset.s; ov.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('on', x === b)); }
      const d = b.dataset.d;
      if (d === 'undo' && hist.length) ctx.putImageData(hist.pop(), 0, 0);
      if (d === 'clear') { snap(); blank(); }
      if (d === 'cancel') close(null);
      if (d === 'ok') close(dirty || start ? cv.toDataURL('image/jpeg', .9) : null);
    });
  });
}

'use strict';
/* ⌨️ Klawiatura na telefonie (iOS/Android): gdy wysuwa się klawiatura, aplikacja wie, ile miejsca zostało
   (visualViewport), dodaje klasę body.kb-open i zmienną --kb (wysokość klawiatury). Karty się wtedy kurczą,
   dolny pasek i pływające przyciski chowają, a aktywne pole przewija się nad klawiaturę – w każdym ekranie
   (nauka „Wpisz”, boss, mentor, czat, wyszukiwanie, edycja). */
(function kbWatch() {
  const vv = window.visualViewport; if (!vv) return;
  const isField = el => el && el.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]), textarea, [contenteditable="true"]');
  let raf = 0, open = false;
  const reveal = () => {
    const el = document.activeElement; if (!open || !isField(el)) return;
    const r = el.getBoundingClientRect(), top = vv.offsetTop + 8, bottom = vv.offsetTop + vv.height - 12;
    // pole + przycisk obok/pod nim mają być widoczne nad klawiaturą
    const box = el.closest('.type-row, .gc-form, .row.nowrap, .hint-edit') || el, b = box.getBoundingClientRect();
    if (b.bottom > bottom || r.top < top) window.scrollBy({ top: b.bottom > bottom ? b.bottom - bottom + 6 : r.top - top - 6, behavior: 'smooth' });
  };
  const update = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      const now = kb > 120 && isField(document.activeElement);
      document.documentElement.style.setProperty('--kb', (now ? kb : 0) + 'px');
      document.documentElement.style.setProperty('--vvh', Math.round(vv.height) + 'px');
      if (now !== open) { open = now; document.body.classList.toggle('kb-open', now); }
      if (now) setTimeout(reveal, 60);
    });
  };
  vv.addEventListener('resize', update); vv.addEventListener('scroll', update);
  document.addEventListener('focusin', e => { if (isField(e.target)) { setTimeout(update, 50); setTimeout(update, 350); } });
  document.addEventListener('focusout', () => setTimeout(update, 120));
})();

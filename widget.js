'use strict';
/* 📲 Skróty na ekran: iPhone (aplikacja Skróty → widżet na ekranie początkowym), Android/komputer (przytrzymaj ikonę).
   Każdy skrót to zwykły link do konkretnego miejsca w aplikacji. */
const WIDGET_LINKS = [
  ['▶️', 'Ucz się fiszek', '#/study/all/flip'],
  ['⌨️', 'Wpisywanie', '#/study/all/type'],
  ['⭐', 'Oznaczone', '#/study/all/flip?cram=star'],
  ['➕', 'Dodaj fiszkę', '#/add'],
  ['⚔️', 'Bitwa', '#/battles'],
  ['🎤', 'Teleturniej', '#/show'],
  ['📉', 'Słabe punkty', '#/weak'],
];
const appBase = () => location.origin + location.pathname;
ROUTES.widget = () => {
  const due = deckCounts('all').total;
  return { tab: 'profile', html: `<div class="row nowrap"><button class="iconbtn" data-go="#/more">‹</button><h1 class="grow">📲 Skróty na ekran</h1></div>
    <div class="card"><b>Teraz do powtórki: ${due}</b><p class="small muted" style="margin-bottom:0">Liczbę powtórek na ikonie włączysz w Ustawieniach → Przypomnienia („Pokazuj liczbę na ikonie”).</p></div>
    <div class="card"><h2 style="margin-top:0">🍎 iPhone – widżet z przyciskami</h2>
      <ol class="steps small">
        <li>Skopiuj link wybranego skrótu poniżej (📋).</li>
        <li>Otwórz aplikację <b>Skróty</b> → <b>+</b> → <b>Dodaj czynność</b> → wyszukaj <b>„Otwórz URL”</b> i wklej link.</li>
        <li>Nazwij skrót (np. „Ucz się”) i wybierz ikonę.</li>
        <li>Na ekranie początkowym przytrzymaj puste miejsce → <b>Edytuj → Dodaj widżet → Skróty</b> – masz widżet z przyciskami do Fiszek. Albo w skrócie: <b>Udostępnij → Do ekranu początkowego</b>.</li>
      </ol></div>
    <div class="card"><h2 style="margin-top:0">🔗 Linki skrótów</h2>
      ${WIDGET_LINKS.map(([i, n, h]) => `<div class="row nowrap wlink"><span class="wl-i">${i}</span><b class="grow">${n}</b>
        <button class="sm" data-act="widget-copy" data-h="${h}">📋 Kopiuj</button><button class="sm ghost" data-go="${h}">Otwórz</button></div>`).join('')}</div>
    <div class="card"><h2 style="margin-top:0">🤖 Android i 💻 komputer</h2>
      <p class="small muted" style="margin:0">Po zainstalowaniu aplikacji przytrzymaj jej ikonę (Android) albo kliknij prawym przyciskiem (Windows/Mac) – pojawią się skróty: Ucz się, Wpisywanie, Dodaj, Bitwa. Możesz je przeciągnąć na ekran.</p></div>` };
};
Object.assign(ACTIONS, {
  'widget-copy': async el => {
    const url = appBase() + el.dataset.h;
    try { await navigator.clipboard.writeText(url); toast('Skopiowano link skrótu ✓'); } catch { prompt('Skopiuj link:', url); }
  },
});

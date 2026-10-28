'use strict';
/* 👋 Pierwsze uruchomienie: 4 krótkie strony – czym jest aplikacja, jak się uczyć, po co konto, prywatność i zgody (RODO).
   Każda strona ma „Więcej szczegółów” (rozwijane), a „Pomiń” zamyka wszystko. Zgody zapisują się od razu:
   akceptacja Regulaminu i Polityki (potrzebna do konta – formularz rejestracji ma ją wtedy zaznaczoną) i publiczny ranking
   (opcjonalny, domyślnie wyłączony). Instrukcję można otworzyć ponownie w Ustawieniach. */
let WL = null;
const WL_MODES = [['full', '🎮', 'Pełny', 'nauka jako gra: bohater, bossowie, pojedynki, skrzynki, ranking'], ['minimal', '🧘', 'Skupienie', 'fiszki, materiały i metody – bez grywalizacji'], ['zen', '🎯', 'Pełne skupienie', 'tylko nauka: zero liczników i dodatków']];
const wlReqIdx = () => WL_PAGES.findIndex(p => p.req);   // { i: strona, acc: chce konto po zakończeniu }
const WL_PAGES = [
  { ic: '👋', t: 'Cześć! To są Fiszki', body: () => `
    <ul class="wl-pts"><li>🃏 Uczysz się z fiszek, a aplikacja sama pilnuje, <b>kiedy co powtórzyć</b> – tuż zanim zapomnisz.</li>
      <li>⏱️ Wystarczy <b>10–15 minut dziennie</b>.</li>
      <li>🎮 Za naukę rozwijasz bohatera, walczysz z bossami i zbierasz 💎.</li></ul>`,
    more: `<p><b>Jak to działa?</b> Po każdej fiszce oceniasz, czy pamiętasz. „Nie pamiętam” wraca za chwilę, „Dobrze” – za kilka dni, a potem coraz rzadziej (powtórki rozłożone w czasie, algorytm FSRS). Dzięki temu pamiętasz na długo, zamiast wkuwać wszystko naraz.</p>
      <p>Na ekranie <b>Start</b> widzisz, ile kart czeka na dziś. Gdy licznik dojdzie do zera – na dziś koniec.</p>` },
  { ic: '🎨', t: 'Wybierz wygląd', body: () => { const cur = currentTheme().id === 'pixel' ? 'pixel' : 'classic';
    return `<p class="center small muted" style="margin:0 0 10px">Stuknij – od razu zobaczysz podgląd. Zmienisz to kiedy chcesz (Ustawienia → Wygląd).</p>
    <div class="wl-looks">
      <button class="wl-look classic${cur === 'classic' ? ' on' : ''}" data-act="wl-look" data-l="classic"><span class="wl-mock"><i class="m-h">Fiszki</i><i class="m-card">kość udowa</i><i class="m-btn">Ucz się</i></span><b>✨ Klasyczny</b><small>gładki, nowoczesny</small></button>
      <button class="wl-look pixel${cur === 'pixel' ? ' on' : ''}" data-act="wl-look" data-l="pixel"><span class="wl-mock"><i class="m-h">Fiszki</i><i class="m-card">kość udowa</i><i class="m-btn">Ucz się</i></span><b>👾 8-bit</b><small>jak w starych grach</small></button>
    </div><p class="center small muted" style="margin:10px 0 0">Oba za darmo. W sklepie są też motywy premium z animowanymi gradientami ✨</p>`; },
    more: `<p>Klasyczny dopasowuje się do trybu jasnego / ciemnego telefonu. 8-bit zmienia całą aplikację: pikselową czcionkę, kanciaste przyciski i paletę jak z konsoli. Motywy premium (Zorza, Galaktyka, Neon, Lawa, Złoto, Hologram…) mają płynące tło, świecące karty i tęczowe przyciski – kupisz je za kryształy w Sklepie.</p>` },
  { ic: '🎯', t: 'Jak chcesz się uczyć?', req: true, body: () => `
    <p class="center small" style="margin:0 0 10px"><b>Ważne – wybierz tryb.</b> Od niego zależy, co widzisz w aplikacji. Zmienisz go w każdej chwili jednym stuknięciem (Ty → Tryb).</p>
    <div class="wl-modes">${WL_MODES.map(([m, ic, n, d]) => `<button class="wl-mode${S.stats.modeChosen && appMode() === m ? ' on' : ''}" data-act="wl-mode" data-m="${m}"><span>${ic}</span><div><b>${n}</b><small>${d}</small></div></button>`).join('')}</div>
    ${S.stats.modeChosen ? '' : '<p class="center small muted" style="margin:8px 0 0">👆 Stuknij jeden tryb, żeby przejść dalej</p>'}`,
    more: `<p><b>🎮 Pełny</b> – wszystko: bohater, bossowie, pojedynki, skrzynki, ranking, prestiż. Nauka jest grą.</p>
      <p><b>🧘 Skupienie</b> – fiszki, materiały, metody nauki i pałace pamięci, bez grywalizacji (bez skrzynek, bitew, liczników nagród). Dobre na sesję przed kolokwium.</p>
      <p><b>🎯 Pełne skupienie</b> – tylko nauka: zero liczników, statystyk i dodatków. Otwierasz i od razu powtarzasz.</p>
      <p>Dane i postęp są te same w każdym trybie – zmiana niczego nie kasuje.</p>` },
  { ic: '📚', t: 'Jak się uczyć', body: () => `
    <ol class="wl-pts"><li><b>Dodaj talię:</b> ➕ i wpisz fiszki albo wklej je z Quizleta / Anki.</li>
      <li><b>Ucz się:</b> „Fiszki” – odkrywasz odpowiedź i oceniasz, albo <b>„Wpisz”</b> – piszesz odpowiedź (lepiej zapamiętujesz i dostajesz więcej 💎).</li>
      <li><b>Oceniaj szczerze</b> – wtedy powtórki wypadają we właściwym momencie.</li></ol>`,
    more: `<p><b>Skąd 💎?</b> Najwięcej za udowodnioną wiedzę: wpisana dobra odpowiedź = 1 💎, 🔥 10 dobrze z rzędu = +5 💎, ukończony zestaw (wpisywanie ×2), testy ABCD i pisemne, karta zapamiętana na 3 tygodnie = +3 💎. Przeklikiwanie bez myślenia nie daje prawie nic.</p>
      <p><b>Przygoda:</b> bossowie, wieża i pojedynki 1 na 1 pytają z Twoich fiszek – im lepiej umiesz, tym mocniej bijesz.</p>
      <p><b>📱 Na telefonie:</b> dodaj aplikację do ekranu początkowego (Safari → Udostępnij → „Do ekranu początkowego”). Działa wtedy jak zwykła aplikacja, także bez internetu.</p>` },
  { ic: '☁️', t: 'Warto założyć konto', body: () => `
    <ul class="wl-pts"><li>💾 <b>Kopia fiszek w chmurze</b> – nie stracisz ich przy zmianie telefonu ani po wyczyszczeniu Safari.</li>
      <li>🔄 Ten sam postęp na telefonie i komputerze.</li>
      <li>👥 Znajomi, czat, ranking, klasy i pojedynki 1 na 1.</li></ul>
    <p class="small muted">Bez konta wszystko działa, ale dane są <b>tylko na tym urządzeniu</b>.</p>
    ${typeof SB_USER !== 'undefined' && SB_USER ? '<p class="wl-ok">✓ Jesteś już zalogowany/a</p>' : `<button class="block${WL.acc ? ' primary' : ''}" data-act="wl-acc">${WL.acc ? '✓ Po zakończeniu przejdę do konta' : '🔑 Chcę założyć konto / zalogować się'}</button>`}`,
    more: `<p><b>Co widzą inni?</b> Znajomi – Twój nick, awatar i statystyki nauki. Adresu e-mail nie widzi nikt. Fiszki widzisz tylko Ty, chyba że sam/a udostępnisz talię znajomemu albo klasie.</p>
      <p>Konto zakładasz e-mailem i hasłem (min. 10 znaków, litery i cyfry). Konto mogą mieć osoby od 16 lat (młodsze – za zgodą rodzica lub opiekuna).</p>` },
  { ic: '🔒', t: 'Prywatność i zgody', body: () => `
    <ul class="wl-pts"><li>🚫 Bez reklam, plików cookie i śledzenia.</li>
      <li>📲 Bez konta dane są tylko na Twoim urządzeniu.</li>
      <li>🗑️ W każdej chwili pobierzesz swoje dane albo usuniesz konto (Profil → Prywatność i dane).</li></ul>
    <label class="check wl-chk"><input type="checkbox" data-wl="consent" ${typeof consentOk === 'function' && consentOk() ? 'checked' : ''}><span>Mam ukończone 16 lat (albo zgodę rodzica/opiekuna) i akceptuję <a href="#/terms" data-act="wl-doc" data-d="terms">Regulamin</a> oraz <a href="#/privacy" data-act="wl-doc" data-d="privacy">Politykę prywatności</a>. <small class="muted">Potrzebne do założenia konta.</small></span></label>
    <label class="check wl-chk"><input type="checkbox" data-wl="global" ${S.settings.showGlobal ? 'checked' : ''}><span>🌍 Pokazuj mnie w <b>publicznym rankingu</b> (nick, awatar, statystyki). <small class="muted">Opcjonalne, domyślnie wyłączone – znajomi widzą Cię zawsze. Zmienisz w każdej chwili w Rankingu.</small></span></label>`,
    more: `<p>Administratorem danych jest osoba prowadząca aplikację (kontakt w Polityce prywatności). Dane konta służą tylko do działania aplikacji: logowania, kopii, znajomych i rankingu. Masz prawo do dostępu do danych, ich poprawienia, usunięcia, przeniesienia i wycofania zgody na ranking; możesz też złożyć skargę do Prezesa UODO.</p>
      <div class="wl-docs">${typeof POLICY_HTML === 'function' ? `<details><summary>📄 Pełna Polityka prywatności</summary><div class="legal">${POLICY_HTML()}</div></details>` : ''}${typeof TERMS_HTML === 'function' ? `<details><summary>📄 Pełny Regulamin</summary><div class="legal">${TERMS_HTML()}</div></details>` : ''}</div>` },
];
const welcomeOpen = () => !!document.querySelector('.wl-overlay');
function welcomeHTML() {
  const i = WL.i, p = WL_PAGES[i], last = WL.solo || i === WL_PAGES.length - 1, block = p.req && !S.stats.modeChosen;
  return `<div class="wl-box card" role="dialog" aria-label="${esc(p.t)}">
    <div class="wl-top"><span class="wl-dots">${WL.solo ? '<b class="small">Nowość</b>' : WL_PAGES.map((_, k) => `<i class="${k === i ? 'on' : k < i ? 'done' : ''}"></i>`).join('')}</span>${block || WL.solo ? '' : '<button class="ghost sm" data-act="wl-skip">Pomiń</button>'}</div>
    <div class="wl-body"><div class="wl-ic">${p.ic}</div><h2>${p.t}</h2>${p.body()}
      <details class="wl-more"><summary>Więcej szczegółów</summary>${p.more}</details></div>
    <div class="row nowrap wl-nav">${i && !WL.solo ? '<button data-act="wl-prev">‹ Wstecz</button>' : ''}<button class="primary grow" data-act="${last ? 'wl-done' : 'wl-next'}" ${block ? 'disabled' : ''}>${WL.solo ? 'Gotowe ✓' : last ? 'Zaczynamy! 🚀' : 'Dalej ›'}</button></div></div>`;
}
function showWelcome(i = 0, solo = false) {
  WL = { i, acc: WL?.acc || false, solo: solo || WL?.solo || false };
  let el = document.querySelector('.wl-overlay');
  if (!el) { el = document.createElement('div'); el.className = 'wl-overlay'; document.body.append(el); }
  el.innerHTML = welcomeHTML(); el.querySelector('.wl-body')?.scrollTo?.(0, 0);
}
function closeWelcome() {
  document.querySelector('.wl-overlay')?.remove();
  S.stats.welcomed = Date.now(); save();
  const acc = WL?.acc; WL = null;
  if (acc && !(typeof SB_USER !== 'undefined' && SB_USER)) { go(typeof appMode === 'function' && appMode() !== 'full' ? '#/more' : '#/me'); setTimeout(() => document.querySelector('#acc-email, .acc-card, [data-act="acc-login"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 400); }
  else if (typeof maybeShowDaily === 'function') setTimeout(maybeShowDaily, 900);
}
on('start', () => {
  if (S.stats.welcomed) return;
  // dotychczasowi użytkownicy znają aplikację – nie zaczepiamy ich (instrukcja jest w Ustawieniach)
  if (S.log.length > 30 || (S.settings.lastSync && S.cards.length)) { S.stats.welcomed = 1; return save(); }
  setTimeout(() => { if (!S.stats.welcomed) { document.querySelector('.dr-overlay')?.remove(); showWelcome(0); } }, 300);
});
// dotychczasowi użytkownicy: raz pokazujemy sam wybór trybu (to ważne – zmienia całą aplikację)
on('start', () => { if (S.stats.welcomed && !S.stats.modeChosen) setTimeout(() => { if (!welcomeOpen()) { document.querySelector('.dr-overlay')?.remove(); showWelcome(wlReqIdx(), true); } }, 900); });
// nagroda dnia nie przykrywa instrukcji
if (typeof maybeShowDaily === 'function') { const wlDaily0 = maybeShowDaily; maybeShowDaily = (...a) => welcomeOpen() || !S?.stats?.welcomed ? undefined : wlDaily0(...a); }
document.addEventListener('change', e => {
  const k = e.target.dataset?.wl; if (!k) return;
  if (k === 'consent') { if (e.target.checked) { S.stats.consentVer = POLICY_VERSION; S.stats.consentAt = Date.now(); } else { delete S.stats.consentVer; delete S.stats.consentAt; } }
  if (k === 'global') { S.settings.showGlobal = e.target.checked; delete S.settings.hideGlobal; if (typeof cloudOn === 'function' && cloudOn() && typeof publishCloudProfile === 'function') publishCloudProfile().catch(() => {}); }
  save();
});
Object.assign(ACTIONS, {
  'wl-next': () => { if (WL_PAGES[WL.i]?.req && !S.stats.modeChosen) return; showWelcome(Math.min(WL_PAGES.length - 1, WL.i + 1)); },
  'wl-mode': el => { const m = el.dataset.m; S.settings.mode = m; S.settings.minimal = m !== 'full'; S.stats.modeChosen = Date.now(); save(); render(); showWelcome(WL.i);
    toast({ full: '🎮 Tryb pełny', minimal: '🧘 Tryb skupienia', zen: '🎯 Pełne skupienie – tylko nauka' }[m], 1500); },
  'wl-prev': () => showWelcome(Math.max(0, WL.i - 1)),
  'wl-skip': () => { if (!S.stats.modeChosen && WL.i < wlReqIdx()) return showWelcome(wlReqIdx()); closeWelcome(); },
  'wl-done': () => { if (!S.stats.modeChosen) return showWelcome(wlReqIdx()); closeWelcome(); },
  'wl-look': el => {
    const t = el.dataset.l === 'pixel' ? THEMES.find(x => x.id === 'pixel') : null;
    if (typeof THEME_PREVIEW !== 'undefined') THEME_PREVIEW = null;
    S.settings.theme = t ? { id: t.id, bg: t.bg, accent: t.accent, image: t.image, pixel: true } : { id: 'auto' };
    applyTheme(); save(); render(); showWelcome(WL.i);
  },
  'wl-acc': () => { WL.acc = !WL.acc; showWelcome(WL.i); },
  'wl-open': () => showWelcome(0),
  // linki do dokumentów w instrukcji: rozwijamy pełny tekst zamiast wychodzić z okna
  'wl-doc': (el, e) => { e?.preventDefault?.(); const d = document.querySelector('.wl-more'); if (d) { d.open = true; const det = [...d.querySelectorAll('.wl-docs details')][el.dataset.d === 'terms' ? 1 : 0]; if (det) { det.open = true; det.scrollIntoView({ block: 'start', behavior: 'smooth' }); } } },
});
// 🎯 szybki przełącznik trybu (profil, okienko profilu, ustawienia)
const modeSwitchHTML = () => `<div class="mode-sw"><small>Tryb aplikacji</small><div class="seg">${WL_MODES.map(([m, ic, n]) => `<button class="${appMode() === m ? 'on' : ''}" data-act="set-mode" data-m="${m}"><i>${ic}</i><span>${n}</span></button>`).join('')}</div></div>`;
// Ustawienia: ponowne otwarcie instrukcji
const wlMore0 = viewMore;
viewMore = function (...a) { return wlMore0(...a) + '<div class="card"><button class="block" data-act="wl-open">📘 Instrukcja, konto i zgody</button></div>'; };
// zmiana trybu gdziekolwiek = tryb wybrany świadomie; okienko profilu odświeża się od razu
{ const sm0 = ACTIONS['set-mode']; ACTIONS['set-mode'] = (el, ...a) => { S.stats.modeChosen = Date.now(); sm0(el, ...a); if (el.dataset.m !== 'full' && parseRoute().parts[0] === 'me') go('#/more'); if (document.querySelector('.pp-overlay') && typeof showProfilePop === 'function') showProfilePop(); }; }
// 🎯 mini kółko na stronie głównej: stuknij → rozwijają się 3 tryby → stuknij tryb i gotowe
let MODE_FAB_OPEN = false;
function modeFab() {
  let el = document.getElementById('mode-fab');
  const show = S && (parseRoute().parts[0] || '') === '' && !welcomeOpen();
  if (!show) { el?.remove(); MODE_FAB_OPEN = false; return; }
  if (!el) { el = document.createElement('div'); el.id = 'mode-fab'; document.body.append(el); }
  const cur = WL_MODES.find(([m]) => m === appMode()) || WL_MODES[0];
  el.className = MODE_FAB_OPEN ? 'open' : '';
  el.innerHTML = `${MODE_FAB_OPEN ? WL_MODES.filter(([m]) => m !== cur[0]).map(([m, ic, n]) => `<button class="mf-opt" data-act="mode-fab-set" data-m="${m}"><span>${ic}</span><b>${n}</b></button>`).join('') : ''}
    <button class="mf-main" data-act="mode-fab" title="Tryb: ${cur[2]}" aria-label="Zmień tryb (teraz: ${cur[2]})">${MODE_FAB_OPEN ? '✕' : cur[1]}</button>`;
}
{ const r0 = render; render = (...a) => { const v = r0(...a); try { modeFab(); } catch { /* */ } return v; }; }
window.addEventListener('hashchange', () => setTimeout(modeFab, 0));
document.addEventListener('click', e => { if (MODE_FAB_OPEN && e.target.isConnected && !e.target.closest('#mode-fab')) { MODE_FAB_OPEN = false; modeFab(); } });
Object.assign(ACTIONS, {
  'mode-fab': () => { MODE_FAB_OPEN = !MODE_FAB_OPEN; modeFab(); },
  'mode-fab-set': el => { MODE_FAB_OPEN = false; ACTIONS['set-mode'](el); modeFab(); },
});

'use strict';
/* 📲 Instalacja jak aplikacja (bez App Store): na iPhonie w Safari – baner z instrukcją „Udostępnij → Do ekranu początkowego”,
   na Androidzie / komputerze – prawdziwy przycisk „Zainstaluj” (beforeinstallprompt). Po instalacji baner znika. */
const isInstalled = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOSDev = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let INSTALL_EV = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); INSTALL_EV = e; if (!parseRoute().parts[0]) render(); });
addEventListener('appinstalled', () => { INSTALL_EV = null; toast('📲 Fiszki zainstalowane!'); });
const installHidden = () => { try { return +localStorage.getItem('installHide') > Date.now(); } catch { return false; } };
function installBannerHTML() {
  if (isInstalled() || installHidden() || (!isIOSDev() && !INSTALL_EV)) return '';
  return `<div class="card row nowrap install-cta"><img src="icons/icon-192.png" alt="" class="install-ic"><div class="grow"><b>📲 Zainstaluj Fiszki${isIOSDev() ? ' na iPhonie' : ''}</b>
    <div class="small muted">Ikona na ekranie, pełny ekran, działa bez internetu – bez App Store.</div></div>
    <div class="install-btns"><button class="sm primary" data-act="install-go">${isIOSDev() ? 'Jak?' : 'Zainstaluj'}</button><button class="iconbtn" data-act="install-hide" title="Ukryj" aria-label="Ukryj">✕</button></div></div>`;
}
function installSheet() {
  document.querySelector('.dmenu-ov')?.remove();
  const ov = document.createElement('div'); ov.className = 'dmenu-ov';
  ov.innerHTML = `<div class="dmenu install-sheet" role="dialog"><b class="dmenu-t">📲 Fiszki na ekranie iPhone'a</b>
    <ol class="install-steps"><li>Stuknij <b>Udostępnij</b> <span class="ish">⬆️</span> na dole Safari${/CriOS|EdgiOS/.test(navigator.userAgent) ? ' (w Chrome: przy pasku adresu)' : ''}.</li>
      <li>Przewiń w dół i wybierz <b>Do ekranu początkowego</b> <span class="ish">➕</span>.</li><li>Stuknij <b>Dodaj</b> – gotowe!</li></ol>
    <small class="muted">Dane zostają na telefonie i Safari ich nie czyści. Znajomym wyślij link: <b>${esc(location.origin + location.pathname.replace(/[^/]*$/, ''))}pobierz.html</b></small>
    <button data-act="install-share">📤 Wyślij link znajomemu</button><button class="ghost" data-act="dmenu-close">Zamknij</button></div>`;
  ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-act]')) setTimeout(() => ov.remove()); });
  document.body.append(ov);
}
Object.assign(ACTIONS, {
  'install-go': () => { if (INSTALL_EV) { INSTALL_EV.prompt(); INSTALL_EV.userChoice?.finally(() => { INSTALL_EV = null; render(); }); } else installSheet(); },
  'install-hide': () => { try { localStorage.setItem('installHide', Date.now() + 14 * DAY); } catch { /* */ } render(); },
  'install-share': () => { const url = location.origin + location.pathname.replace(/[^/]*$/, '') + 'pobierz.html', text = 'Ucz się ze mną w Fiszkach – za darmo, działa jak aplikacja:';
    if (navigator.share) navigator.share({ title: 'Fiszki', text, url }).catch(() => {}); else { navigator.clipboard?.writeText(`${text} ${url}`); toast('📋 Skopiowano link'); } },
});
const instHome0 = homeExtrasHTML;
homeExtrasHTML = function () { return installBannerHTML() + instHome0(); };

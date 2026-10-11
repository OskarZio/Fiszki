'use strict';
/* Układ aplikacji (pełny tryb): 5 zakładek jak w aplikacjach na iOS.
   🏠 Start – tylko nauka · ➕ Dodaj · 📚 Tematy · ⚔️ Arena (bitwy, ranking, znajomi, trening) · 👤 Profil (ja, zadania, sklep, osiągnięcia).
   Arena i Profil mają u góry przełącznik sekcji – wszystko z jednego miejsca, bez szukania. Ustawienia: ⚙️ w Profilu. */

const HUBS = {
  arena: [['battles', '⚔️', 'Bitwy'], ['rank', '🏆', 'Ranking'], ['inbox', '💬', 'Znajomi'], ['train', '🧠', 'Trening']],
  profile: [['me', '👤', 'Ja'], ['quests', '📋', 'Zadania'], ['shop', '💎', 'Sklep'], ['ach', '🏅', 'Osiągnięcia']],
};
const HUB_OF = { chat: 'arena', battle: 'arena', calendar: 'home' };
for (const [h, list] of Object.entries(HUBS)) for (const [r] of list) HUB_OF[r] = h;
const LAST_HUB = { arena: 'battles', profile: 'me' };

// liczniki: Arena = nowe wiadomości + wyzwania, Profil = zadania do odebrania
const arenaBadge = () => typeof cloudOn === 'function' && cloudOn() && typeof unreadMsgs === 'function' ? unreadMsgs().length : 0;
const profileBadge = () => typeof questState === 'function' ? questState().claimable : 0;
const segBadge = r => { const n = r === 'inbox' ? arenaBadge() : r === 'quests' ? profileBadge() : 0; return n ? `<i class="unread">${n}</i>` : ''; };

function hubNav(hub, cur) {
  return `<nav class="hubnav">${HUBS[hub].map(([r, i, l]) => `<a href="#/${r}" class="${r === cur ? 'on' : ''}"><span>${i}</span>${l}${segBadge(r)}</a>`).join('')}</nav>`;
}
// w sekcjach huba nie potrzeba „‹ wstecz” na Start
const stripBack = html => html.replace(/<button class="iconbtn" data-go="#\/(?:battles)?">‹<\/button>/, '');

// ---------- 👤 Ja
ROUTES.me = () => {
  const xp = xpTotal(), lvl = levelOf(xp), a = levelStart(lvl), b = levelStart(lvl + 1);
  const got = Object.keys(S.ach).length, elo = typeof myElo === 'function' ? myElo() : 1000;
  const wins = (S.battles || []).filter(x => x.won === 1).length;
  const tile = (go, icon, val, label) => `<button class="mtile" data-go="${go}"><span>${icon}</span><b>${val}</b><small>${label}</small></button>`;
  return { tab: 'profile', html: `
  <div class="row nowrap"><h1 class="grow">Profil</h1><button class="iconbtn" data-go="#/more" title="Ustawienia">⚙️</button></div>
  <div class="card me-head"><div class="row nowrap" style="gap:14px">
      <span class="av-big" data-act="avatar-photo" style="cursor:pointer">${avatarHTML(S.profile, 64)}</span>
      <div class="grow" style="min-width:0"><b class="nm" style="display:block;font-size:22px">${esc(S.profile.nick || 'Ty')}</b>
        <div class="small muted">Poziom ${lvl} · ${levelTitle(lvl)}</div>
        <div class="row small nowrap" style="margin-top:6px"><div class="grow">${progress((xp - a) / (b - a), true)}</div><span class="muted">${xp - a}/${b - a} XP</span></div></div></div></div>
  <div class="mtiles">
    ${tile('#/shop', '💎', typeof coins === 'function' ? coins() : 0, 'kryształy')}
    ${tile('#/more', '🔥', streak(), plural(streak(), 'dzień', 'dni', 'dni') + ' z rzędu')}
    ${tile('#/battles', '⚔️', elo, `Elo · ${wins} ${plural(wins, 'wygrana', 'wygrane', 'wygranych')}`)}
    ${tile('#/ach', '🏅', `${got}/${ACHIEVEMENTS.length}`, 'osiągnięcia')}
  </div>
  <div class="card list-links">
    <a class="lnk" href="#/calendar"><span>📅</span><b class="grow">Terminarz</b><small class="muted">${typeof upcoming === 'function' ? upcoming().length || '' : ''}</small><i>›</i></a>
    <a class="lnk" href="#/quests"><span>📋</span><b class="grow">Zadania dnia</b>${segBadge('quests')}<i>›</i></a>
    <a class="lnk" href="#/shop"><span>🎁</span><b class="grow">Skrzynki i album naklejek</b><i>›</i></a>
    <a class="lnk" href="#/more"><span>⚙️</span><b class="grow">Ustawienia, motyw, dźwięki, kopie</b><i>›</i></a></div>
  ${typeof accountCardHTML === 'function' ? accountCardHTML() : ''}
  ${typeof profileCardHTML === 'function' ? profileCardHTML() : ''}` };
};

// owinięcie tras: przełącznik sekcji u góry + właściwa zakładka na dole
for (const r of Object.keys(HUB_OF)) {
  const orig = ROUTES[r]; if (!orig) continue;
  ROUTES[r] = (...args) => {
    const v = orig(...args); if (!v || typeof v.html !== 'string') return v;
    const hub = HUB_OF[r];
    if (v.focus || !HUBS[hub] || !HUBS[hub].some(([x]) => x === r)) return { ...v, tab: v.focus ? v.tab : hub };
    LAST_HUB[hub] = r;
    let html = stripBack(v.html);
    if (r === 'train') html = html.replace(/<div class="card hero-card battle-cta"[\s\S]*?›<\/span><\/div><\/div>/, '');   // bitwy są obok
    return { ...v, tab: hub, html: hubNav(hub, r) + html };
  };
}

// Start: zamiast karty z poziomem i przyciskami – mały znaczek profilu w nagłówku; reszta jest w Arenie i Profilu
function homeChipHTML() {
  if (appMode() !== 'full') return '';
  const lvl = levelOf(xpTotal()), n = profileBadge();
  return `<button class="hdrchip" data-go="#/me">${avatarHTML(S.profile, 22)}<b>${lvl}</b><span>💎 ${typeof coins === 'function' ? coins() : 0}</span>${n ? '<i class="dot"></i>' : ''}</button>`;
}
homeExtrasHTML = () => appMode() === 'full' && typeof calHomeCardHTML === 'function' ? calHomeCardHTML() : '';

// po każdym odświeżeniu: liczniki na zakładkach, Arena wraca do ostatniej sekcji, Ustawienia podświetlają Profil
function updateTabBadges() {
  const set = (tab, n) => {
    const a = document.querySelector(`#tabs [data-tab=${tab}]`); if (!a) return;
    let bd = a.querySelector('.tabbadge');
    if (n) { if (!bd) { bd = document.createElement('i'); bd.className = 'unread tabbadge'; a.append(bd); } bd.textContent = n; } else bd?.remove();
  };
  set('arena', arenaBadge()); set('profile', profileBadge());   // wyzwania to też wiadomości – liczą się raz
  const ar = document.querySelector('#tabs [data-tab=arena]'); if (ar) ar.href = '#/' + LAST_HUB.arena;
  const pr = document.querySelector('#tabs [data-tab=profile]'); if (pr) pr.href = '#/' + LAST_HUB.profile;
  const r = parseRoute().parts[0];
  if (r === 'more' && appMode() === 'full') $$('#tabs a').forEach(x => x.classList.toggle('active', x.dataset.tab === 'profile'));
}
const hubRender0 = render;
render = function (...a) { const out = hubRender0.apply(this, a); try { updateTabBadges(); } catch (e) { console.warn(e); } return out; };
if (typeof updateMsgBadge === 'function') { const um0 = updateMsgBadge; updateMsgBadge = function () { um0(); try { updateTabBadges(); } catch { /* */ } }; }

'use strict';
/* 🧭 Prostszy układ (tryb pełny): 4 zakładki zamiast 5 i mniej podzakładek.
   🏠 Nauka: Talie · Notatki · Terminarz · Dodaj   ⚔️ Przygoda: Bossowie · Bitwy · Gry
   👥 Znajomi: Ranking · Czat                       👤 Ty: Profil · Wyzwania · Sklep · Kolekcja
   Start pokazuje tylko to, co ważne dziś (nauka, boss, inkubator, metoda dnia); reszta jest w zakładkach.
   Cofnięcie do poprzedniego układu: gałąź „backup-przed-ukladem” w repozytorium. */

HUBS.home = [['', '📚', 'Talie'], ['topics', '📝', 'Notatki'], ['calendar', '📅', 'Terminarz'], ['add', '➕', 'Dodaj']];
HUBS.arena = [['boss', '🐉', 'Bossowie'], ['battles', '⚔️', 'Bitwy'], ['train', '🧠', 'Gry']];
HUBS.friends = [['rank', '🏆', 'Ranking'], ['inbox', '💬', 'Czat']];
HUBS.profile = [['me', '👤', 'Profil'], ['quests', '📋', 'Wyzwania'], ['shop', '💎', 'Sklep'], ['inv', '🎒', 'Kolekcja']];
Object.assign(HUB_OF, { '': 'home', topics: 'home', calendar: 'home', add: 'home', boss: 'arena', hero: 'arena', battles: 'arena', train: 'arena', battle: 'arena', show: 'arena',
  rank: 'friends', inbox: 'friends', chat: 'friends', friend: 'friends', me: 'profile', quests: 'profile', shop: 'profile', inv: 'profile', ach: 'profile' });
LAST_HUB.home = ''; LAST_HUB.friends = 'rank'; LAST_HUB.arena = 'boss';
const fullLayout = () => appMode() === 'full';
const navFor = (hub, r) => fullLayout() ? hubNav(hub, r) : '';

// trasy spoza listy owiniętej w hub.js: Start, Notatki, Dodaj (Terminarz jest już owinięty)
const lyHome0 = viewHome;
viewHome = function (...a) { return navFor('home', '') + lyHome0(...a); };
const lyAdd0 = viewAdd;
viewAdd = function (editId, ...a) { const h = lyAdd0(editId, ...a); return editId ? h : navFor('home', 'add') + h
  + `<div class="card row nowrap add-more"><span class="grow small muted">Szybkie przypomnienie zamiast fiszki?</span><button class="sm" data-act="sticky-new">📌 Karteczka</button></div>`; };
const lyTopics0 = ROUTES.topics;
ROUTES.topics = (...a) => { const v = lyTopics0(...a); return !v?.html || v.focus ? v : { ...v, tab: fullLayout() ? 'home' : v.tab, html: navFor('home', 'topics') + stripBack(v.html) }; };
// Wyzwania = zadania dnia + skrót do osiągnięć
const lyQuests0 = ROUTES.quests;
ROUTES.quests = (...a) => { const v = lyQuests0(...a); if (!v?.html || !fullLayout()) return v;
  const got = Object.keys(S.ach).length;
  return { ...v, html: v.html + `<div class="card row nowrap ach-cta" data-go="#/ach"><span style="font-size:30px">🏅</span><div class="grow"><b>Osiągnięcia</b><div class="small muted">${got}/${ACHIEVEMENTS.length} zdobytych · nagrody do 2000 💎</div></div><span>›</span></div>` }; };

// Start: tylko to, co ważne dziś
shortcutsHTML = () => '';
if (typeof calHomeCardHTML === 'function') calHomeCardHTML = () => '';
const lyStickies0 = typeof stickiesHTML === 'function' ? stickiesHTML : null;
if (lyStickies0) stickiesHTML = () => (typeof activeStickies === 'function' && activeStickies().length) ? lyStickies0() : '';
const lyExtras0 = homeExtrasHTML;
homeExtrasHTML = function () {
  let h = lyExtras0();
  if (fullLayout()) h = h.replace(/<button class="block quest-cta"[^>]*>[\s\S]*?<\/button>/g, '');   // zwykłe przypomnienia znikają, zostają tylko te z czymś do odebrania / nowe wiadomości
  return h;
};

// dolny pasek: liczniki i podświetlenie (np. talia, inkubator i metody nauki to „Nauka”)
const LY_HOME_ROUTES = ['', 'deck', 'study', 'add', 'edit', 'topics', 'topic', 'item', 'calendar', 'import', 'egg', 'methods', 'method', 'subject', 'mtrain', 'weak', 'quiz', 'sticky'];
updateTabBadges = function () {
  const set = (tab, n) => {
    const a = document.querySelector(`#tabs [data-tab=${tab}]`); if (!a) return;
    let bd = a.querySelector('.tabbadge');
    if (n) { if (!bd) { bd = document.createElement('i'); bd.className = 'unread tabbadge'; a.append(bd); } bd.textContent = n; } else bd?.remove();
  };
  set('friends', arenaBadge()); set('profile', profileBadge());
  for (const [tab, hub] of [['arena', 'arena'], ['friends', 'friends'], ['profile', 'profile']]) { const a = document.querySelector(`#tabs [data-tab=${tab}]`); if (a) a.href = '#/' + (LAST_HUB[hub] || ''); }
  const r = parseRoute().parts[0] || '';
  if (!fullLayout()) return;
  const tab = r === 'more' ? 'profile' : LY_HOME_ROUTES.includes(r) ? 'home' : HUB_OF[r] || null;
  if (tab) $$('#tabs a').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
};

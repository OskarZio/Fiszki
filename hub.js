'use strict';
/* Układ aplikacji (pełny tryb): 5 zakładek jak w aplikacjach na iOS.
   🏠 Start – tylko nauka · ➕ Dodaj · 📚 Tematy · ⚔️ Arena (bitwy, ranking, znajomi, trening) · 👤 Profil (ja, zadania, sklep, osiągnięcia).
   Arena i Profil mają u góry przełącznik sekcji – wszystko z jednego miejsca, bez szukania. Ustawienia: ⚙️ w Profilu. */

const HUBS = {
  arena: [['battles', '⚔️', 'Bitwy'], ['rank', '🏆', 'Ranking'], ['inbox', '💬', 'Znajomi'], ['train', '🧠', 'Trening']],
  profile: [['me', '👤', 'Ja'], ['quests', '📋', 'Zadania'], ['shop', '💎', 'Sklep'], ['inv', '🎒', 'Ekwipunek'], ['ach', '🏅', 'Osiągnięcia']],
};
const HUB_OF = { chat: 'arena', battle: 'arena', calendar: 'home' };
for (const [h, list] of Object.entries(HUBS)) for (const [r] of list) HUB_OF[r] = h;
const LAST_HUB = { arena: 'battles', profile: 'me' };

// liczniki: Arena = nowe wiadomości + wyzwania, Profil = zadania do odebrania
const arenaBadge = () => typeof cloudOn === 'function' && cloudOn() && typeof unreadMsgs === 'function' ? unreadMsgs().length : 0;
const profileBadge = () => (typeof questState === 'function' ? questState().claimable : 0) + (typeof dailyOn === 'function' && dailyOn() && !loginState().claimed ? 1 : 0);
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
  <div class="card me-head"><div class="row nowrap" style="gap:14px;margin-bottom:12px">
      <button class="pp-av sm-av" data-act="pp-open" title="Profil i awatar">${avatarHTML(S.profile, 60)}<i>✏️</i></button>
      <div class="grow" style="min-width:0"><b class="nm" style="display:block;font-size:22px">${esc(S.profile.nick || 'Ty')}</b>
        <div class="small muted">stuknij awatar, żeby go zmienić</div></div></div>
    ${xpCardHTML()}</div>
  <div class="mtiles">
    ${tile('#/shop', '💎', typeof coins === 'function' ? coins() : 0, 'kryształy')}
    ${tile('#/more', '🔥', streak(), plural(streak(), 'dzień', 'dni', 'dni') + ' z rzędu')}
    ${tile('#/battles', '⚔️', elo, `Elo · ${wins} ${plural(wins, 'wygrana', 'wygrane', 'wygranych')}`)}
    ${tile('#/ach', '🏅', `${got}/${ACHIEVEMENTS.length}`, 'osiągnięcia')}
  </div>
  <div class="card list-links">
    ${typeof dailyOn === 'function' && dailyOn() ? `<a class="lnk" href="#/me" data-act="dr-open"><span>🎁</span><b class="grow">Nagroda dnia</b>${loginState().claimed ? `<small class="muted">dzień ${loginState().n}/7 ✓</small>` : '<i class="unread">1</i>'}<i>›</i></a>` : ''}
    <a class="lnk" href="#/calendar"><span>📅</span><b class="grow">Terminarz</b><small class="muted">${typeof upcoming === 'function' ? upcoming().length || '' : ''}</small><i>›</i></a>
    <a class="lnk" href="#/quests"><span>📋</span><b class="grow">Zadania dnia</b>${segBadge('quests')}<i>›</i></a>
    <a class="lnk" href="#/shop"><span>🎁</span><b class="grow">Skrzynki i album naklejek</b><i>›</i></a>
    <a class="lnk" href="#/more" data-anchor="anki"><span>🔁</span><b class="grow">Import / eksport Anki</b><i>›</i></a>
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
  return `<button class="hdrchip" data-act="pp-open">${avatarHTML(S.profile, 22)}<b>${lvl}</b><span>💎 ${typeof coins === 'function' ? coins() : 0}</span>${n ? '<i class="dot"></i>' : ''}</button>`;
}
// ⚡ Skróty na Starcie – zwijane, z wyborem, co ma się w nich pokazywać
const SHORTCUTS = {
  quick: { icon: '⚡', name: 'Szybki mecz', act: 'bt-quick' },
  battles: { icon: '⚔️', name: 'Bitwy', go: '#/battles', sub: () => typeof myElo === 'function' ? `${myElo()} Elo` : '' },
  train: { icon: '🧠', name: 'Trening pamięci', go: '#/train' },
  numbers: { icon: '🔢', name: 'Liczby', go: '#/game/numbers' },
  words: { icon: '📝', name: 'Słowa', go: '#/game/words' },
  images: { icon: '🖼️', name: 'Obrazy', go: '#/game/images' },
  cards: { icon: '🃏', name: 'Karty', go: '#/game/cards' },
  palaces: { icon: '🏛️', name: 'Pałace pamięci', go: '#/palaces' },
  rank: { icon: '🏆', name: 'Ranking', go: '#/rank' },
  inbox: { icon: '💬', name: 'Znajomi', go: '#/inbox', badge: () => arenaBadge() },
  quests: { icon: '📋', name: 'Zadania', go: '#/quests', badge: () => profileBadge() },
  shop: { icon: '💎', name: 'Sklep', go: '#/shop', sub: () => typeof coins === 'function' ? `${coins()} 💎` : '' },
  calendar: { icon: '📅', name: 'Terminarz', go: '#/calendar' },
};
let SC_EDIT = false;
const myShortcuts = () => (S.settings.shortcuts || ['battles', 'train']).filter(k => SHORTCUTS[k]);
function shortcutsHTML() {
  const list = myShortcuts(), open = S.settings.shortcutsOpen !== false;
  const btn = k => { const x = SHORTCUTS[k], n = x.badge?.() || 0, sub = x.sub?.() || '';
    return `<button class="sc" ${x.act ? `data-act="${x.act}"` : `data-go="${x.go}"`}><span>${x.icon}</span><b>${x.name}</b>${sub ? `<small>${esc(sub)}</small>` : ''}${n ? `<i class="unread">${n}</i>` : ''}</button>`; };
  return `<details class="card tight shortcuts" id="shortcuts"${open ? ' open' : ''}><summary><b>⚡ Skróty</b><span class="small muted">${open ? '' : list.map(k => SHORTCUTS[k].icon).join(' ')}</span>
      <button class="sm ghost" data-act="sc-edit">${SC_EDIT ? 'Gotowe' : '✏️'}</button></summary>
    ${SC_EDIT ? `<p class="small muted" style="margin:6px 0">Stuknij, żeby dodać albo usunąć skrót:</p>
      <div class="sc-pick">${Object.entries(SHORTCUTS).map(([k, x]) => `<button class="${list.includes(k) ? 'on' : ''}" data-act="sc-toggle" data-k="${k}">${x.icon} ${x.name}</button>`).join('')}</div>`
      : list.length ? `<div class="scgrid">${list.map(btn).join('')}</div>` : '<p class="small muted">Brak skrótów – dodaj je przyciskiem ✏️.</p>'}</details>`;
}
Object.assign(ACTIONS, {
  'sc-edit': (el, e) => { e?.stopPropagation?.(); SC_EDIT = !SC_EDIT; S.settings.shortcutsOpen = true; save(); render(); },
  'sc-toggle': el => { const k = el.dataset.k, l = myShortcuts(); S.settings.shortcuts = l.includes(k) ? l.filter(x => x !== k) : [...l, k]; save(); render(); },
});
// zapamiętaj zwinięcie / rozwinięcie
document.addEventListener('toggle', e => { if (e.target.id === 'shortcuts' && S.settings.shortcutsOpen !== e.target.open) { S.settings.shortcutsOpen = e.target.open; save(); const sp = e.target.querySelector('summary .small'); if (sp) sp.textContent = e.target.open ? '' : myShortcuts().map(k => SHORTCUTS[k].icon).join(' '); } }, true);
homeExtrasHTML = () => appMode() === 'full' ? shortcutsHTML() + (typeof calHomeCardHTML === 'function' ? calHomeCardHTML() : '') : '';

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

// płynne wejście ekranu – tylko przy zmianie strony (nie przy każdym odświeżeniu)
window.addEventListener('hashchange', () => { const v = $('#view'); if (!v || S?.settings?.anim === false) return; v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); setTimeout(() => v.classList.remove('enter'), 450); });
// linki z kotwicą (np. Profil → „Import / eksport Anki”) przewijają do sekcji po otwarciu strony
document.addEventListener('click', e => { const a = e.target.closest?.('a[data-anchor]'); if (a) setTimeout(() => document.getElementById(a.dataset.anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120); });

// ---------- ⭐ Doświadczenie (XP) i okienko profilu
const AVATAR_EMOJI = ['🦊', '🐼', '🐱', '🐶', '🦁', '🐯', '🐸', '🐵', '🐨', '🐧', '🦉', '🦄', '🐙', '🐲', '🦋', '🐢', '🧠', '🚀', '😎', '🤓', '👻', '🤖', '🔥', '⭐'];
function xpToday() {
  const t0 = dayStart(); let xp = 0;
  for (const l of S.log) if (l.t >= t0) xp += l.n ? 3 : l.g > 1 ? 2 : 1;
  for (const g of S.games) if ((g.t || 0) >= t0) xp += Math.round((g.correct || 0) / 2);
  for (const b of S.battles || []) if ((b.t || 0) >= t0) xp += b.won === 1 ? 30 : 10;
  for (const k in S.ach) if (S.ach[k] >= t0) xp += 25;
  return xp;
}
function xpInfo() {
  const xp = xpTotal(), lvl = levelOf(xp), a = levelStart(lvl), b = levelStart(lvl + 1);
  const nextTitleLvl = (Math.floor((lvl - 1) / 3) + 1) * 3 + 1;   // tytuł zmienia się co 3 poziomy
  return { xp, lvl, cur: xp - a, need: b - a, left: b - xp, pct: (xp - a) / (b - a), title: levelTitle(lvl), nextTitle: levelTitle(nextTitleLvl), nextTitleLvl, today: xpToday() };
}
function xpCardHTML(compact) {
  const x = xpInfo();
  return `<div class="xpcard${compact ? ' compact' : ''}">
    <div class="row nowrap" style="gap:12px"><span class="lvl big">${x.lvl}</span>
      <div class="grow" style="min-width:0"><b class="nm" style="display:block;font-size:17px">Poziom ${x.lvl} · ${x.title}</b>
        <div class="small muted">${x.xp} XP łącznie${x.today ? ` · <span class="c-rev">+${x.today} dziś</span>` : ''}</div></div></div>
    <div class="xpbar"><div style="width:${Math.max(3, x.pct * 100)}%"></div><span>${x.cur} / ${x.need} XP</span></div>
    <div class="row nowrap small"><span class="grow">Do poziomu <b>${x.lvl + 1}</b> brakuje <b>${x.left} XP</b></span>${x.nextTitle !== x.title ? `<span class="muted">„${x.nextTitle}” od ${x.nextTitleLvl}</span>` : ''}</div>
    ${compact ? '' : `<details class="small muted xpinfo"><summary>Skąd brać XP?</summary>
      <ul class="perks"><li>Powtórka: <b>1 XP</b>, poprawna: <b>2 XP</b>, nowa karta: <b>3 XP</b></li>
        <li>Gry pamięciowe: <b>1 XP</b> za każde 2 poprawne</li><li>Bitwa: wygrana <b>30 XP</b>, każda inna <b>10 XP</b></li><li>Osiągnięcie: <b>25 XP</b></li></ul></details>`}</div>`;
}
function profilePopHTML() {
  const x = xpInfo(), elo = typeof myElo === 'function' ? myElo() : 1000, p = S.profile;
  return `<div class="pp-box card">
    <button class="iconbtn pp-x" data-act="pp-close">✕</button>
    <div class="center"><button class="pp-av" data-act="pp-photo" title="Zmień zdjęcie">${avatarHTML(p, 84)}<i>📷</i></button>
      <h2 class="nm" style="margin:8px 0 0">${esc(p.nick || 'Ty')}</h2></div>
    ${xpCardHTML(true)}
    <div class="pp-stats"><div><b>💎 ${typeof coins === 'function' ? coins() : 0}</b><small>kryształy</small></div><div><b>🔥 ${streak()}</b><small>seria</small></div>
      <div><b>⚔️ ${elo}</b><small>Elo</small></div><div><b>🏅 ${Object.keys(S.ach).length}</b><small>osiągnięcia</small></div></div>
    <div class="small muted" style="margin:12px 0 6px">Zmień awatar:</div>
    <div class="pp-emojis">${AVATAR_EMOJI.map(e => `<button class="${!p.avatarImg && p.avatar === e ? 'on' : ''}" data-act="pp-emoji" data-e="${e}">${e}</button>`).join('')}</div>
    <div class="row" style="margin-top:10px"><button class="grow" data-act="pp-photo">📷 Własne zdjęcie</button>${p.avatarImg ? '<button class="grow" data-act="pp-photo-del">Usuń zdjęcie</button>' : ''}</div>
    <div class="spacer"></div><button class="primary block" data-act="pp-goto">👤 Otwórz profil</button></div>`;
}
// okienko bez przewijania: tło stoi w miejscu, a zawartość mieści się na ekranie
const ppClose = () => { document.querySelector('.pp-overlay')?.remove(); document.documentElement.classList.remove('noscroll'); };
function showProfilePop() {
  let el = document.querySelector('.pp-overlay');
  if (!el) {
    el = document.createElement('div'); el.className = 'dr-overlay pp-overlay';
    el.addEventListener('click', e => { if (e.target === el) ppClose(); });
    el.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    document.body.append(el); document.documentElement.classList.add('noscroll');
  }
  el.innerHTML = profilePopHTML();
}
const ppTouch = () => { S.profile.mod = Date.now(); if (typeof publishAt !== 'undefined') publishAt = 0; save(); render(); if (document.querySelector('.pp-overlay')) showProfilePop(); };
Object.assign(ACTIONS, {
  'pp-open': () => showProfilePop(),
  'pp-close': () => ppClose(),
  'pp-goto': () => { ppClose(); go('#/me'); },
  'pp-emoji': el => { S.profile.imgMod = Date.now(); S.profile.avatar = el.dataset.e; S.profile.avatarImg = null; ppTouch(); toast(`Awatar: ${el.dataset.e} ✓`); },
  'pp-photo': async () => {
    const f = await pickFile('image/*'); if (!f) return;
    try { S.profile.avatarImg = await squareAvatar(f); S.profile.imgMod = Date.now(); ppTouch(); toast('Zdjęcie profilowe ustawione ✓'); } catch { toast('Nie udało się wczytać zdjęcia'); }
  },
  'pp-photo-del': () => { S.profile.avatarImg = null; S.profile.imgMod = Date.now(); ppTouch(); },
});

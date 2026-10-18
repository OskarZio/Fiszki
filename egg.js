'use strict';
/* 🥚 Inkubator naklejek (jak Forest): wybierasz czas skupienia, jajko rośnie, a po czasie wykluwa się naklejka.
   Wyjście z aplikacji na dłużej niż EGG_GRACE = jajko pęka (chyba że uratuje je 🛡️ tarcza).
   Tryby: 📚 nauka – czas leci tylko podczas nauki (fiszki, testy, gry, bitwy) i aktywności,
          📵 telefon odłożony – czas leci cały czas, ekran nie gaśnie (Wake Lock), wyjście = pęknięcie.
   Trwająca sesja żyje w localStorage (jedno urządzenie), wynik trafia do S.eggs (synchronizowane). */

const EGG_GRACE = 10000, EGG_IDLE = 90000, EGG_POMO = 25 * 60000, EGG_BREAK = 5 * 60000, SHIELD_PRICE = 60;
const EGG_TIERS = [
  { min: 15, odds: { common: 75, rare: 25 }, gems: 10, color: '#f8fafc', spot: '#cbd5e1' },
  { min: 25, odds: { common: 55, rare: 33, epic: 10, legendary: 2 }, gems: 20, color: '#dbeafe', spot: '#60a5fa' },
  { min: 45, odds: { common: 40, rare: 35, epic: 19, legendary: 6 }, gems: 35, color: '#dcfce7', spot: '#22c55e' },
  { min: 60, odds: { common: 28, rare: 36, epic: 26, legendary: 10 }, gems: 50, color: '#ede9fe', spot: '#8b5cf6' },
  { min: 90, odds: { common: 15, rare: 35, epic: 33, legendary: 17 }, gems: 100, mythic: 1, color: '#fef3c7', spot: '#f59e0b' },
  { min: 120, odds: { common: 10, rare: 30, epic: 35, legendary: 25 }, gems: 150, mythic: 2, color: '#fee2e2', spot: '#dc2626' },
];
const EGG_EXCL = 50;   // % szans, że wykluje się naklejka dostępna tylko z inkubatora
const EGG_STUDY_ROUTES = ['study', 'quiz', 'game', 'battle', 'weak', 'walk', 'ptrain', 'show', 'station', 'atlas'];
const eggTier = min => EGG_TIERS.find(t => t.min === min) || EGG_TIERS[1];
const eggs = () => (S.eggs = S.eggs || []);

// ---------- trwająca sesja
const eggRun = () => { try { return JSON.parse(localStorage.getItem('eggRun') || 'null'); } catch { return null; } };
const eggSave = E => { try { E ? localStorage.setItem('eggRun', JSON.stringify(E)) : localStorage.removeItem('eggRun'); } catch { /* */ } };
let EGG_LAST = null, EGG_PICK = { min: 25, mode: 'study', pomo: false }, eggInput = Date.now();
try { Object.assign(EGG_PICK, JSON.parse(localStorage.getItem('eggPick') || '{}')); } catch { /* */ }
['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, () => { eggInput = Date.now(); }, { passive: true, capture: true }));

const eggLeft = E => Math.max(0, E.min * 60000 - E.prog);
const eggInBreak = E => E.breakUntil && Date.now() < E.breakUntil;
function eggGrowing(E) {
  if (document.hidden || eggInBreak(E)) return false;
  if (E.mode === 'phone') return true;
  return EGG_STUDY_ROUTES.includes(parseRoute().parts[0] || '') && Date.now() - eggInput < EGG_IDLE;
}
const eggStatus = E => eggInBreak(E) ? '☕ Przerwa – możesz odejść od telefonu' : eggGrowing(E) ? '🌱 Jajko rośnie' : E.mode === 'study' ? (EGG_STUDY_ROUTES.includes(parseRoute().parts[0] || '') ? '⏸ Wstrzymane – brak aktywności' : '⏸ Wstrzymane – ucz się, żeby rosło') : '⏸ Wstrzymane';

// 🛡️ tarcze: 1 darmowa dziennie + kupione
const todayN = () => Math.floor(dayStart() / DAY);
const freeShield = () => (S.stats.shieldDay || 0) < todayN();
const shieldCount = () => (freeShield() ? 1 : 0) + itemCount('shield', 'shield');
function useShield() {
  if (freeShield()) { S.stats.shieldDay = todayN(); save(); return true; }
  if (itemCount('shield', 'shield') > 0) { addItem('shield', 'shield', -1); return true; }
  return false;
}

function eggStart() {
  if (eggRun()) return;
  const E = { id: uid(), min: EGG_PICK.min, mode: EGG_PICK.mode, pomo: EGG_PICK.pomo && EGG_PICK.min >= 45, start: Date.now(), last: Date.now(), prog: 0, pomoN: 0, breakUntil: 0, hiddenAt: 0, saved: 0 };
  eggSave(E); EGG_LAST = null; eggInput = Date.now(); eggWake(E);
  toast(E.mode === 'phone' ? '📵 Odłóż telefon ekranem w dół – nie wychodź z aplikacji' : '📚 Ucz się – jajko rośnie podczas nauki', 3500);
  if (E.mode === 'study') go('#/'); else render();
}
function eggFinish(E, ok, why) {
  const now = Date.now(), rec = { id: E.id, t: E.start, end: now, min: E.min, mode: E.mode, ok: ok ? 1 : 0, ms: Math.round(E.prog), ...(why ? { why } : {}) };
  if (ok) {
    const p = eggPrize(E.min);
    rec.st = p.id; rec.gems = eggTier(E.min).gems;
    addItem('sticker', p.id, 1, 'egg-' + E.id);
    if (!S.wallet.some(w => w.id === 'egg-' + E.id)) S.wallet.push({ id: 'egg-' + E.id, n: rec.gems, why: 'egg', t: now });
  }
  if (!eggs().some(x => x.id === rec.id)) eggs().push(rec);
  eggSave(null); eggUnwake(); save(); EGG_LAST = rec;
  if (ok) { const s = stickerById(rec.st); celebrate(`🐣 Wykluło się: ${s.e} ${s.name}!`, `${RARITY[s.r].name} · +${rec.gems} 💎 za ${E.min} min skupienia`); confetti(s.r === 'legendary' || s.r === 'mythic' ? 220 : 120); if (typeof CASE_SFX !== 'undefined') try { CASE_SFX.reveal(s.r === 'mythic' ? 'legendary' : s.r); } catch { /* */ } }
  else toast(why === 'left' ? '💥 Jajko pękło – wyszedłeś z aplikacji' : '💥 Jajko porzucone', 4000);
  if (typeof checkAchievements === 'function') checkAchievements();
  if (parseRoute().parts[0] === 'egg' || !ok) go('#/egg'); else render();
}
function eggPrize(min) {
  const t = eggTier(min);
  if (t.mythic && Math.random() * 100 < t.mythic) return STICKERS.find(s => s.r === 'mythic');
  const r = rollRarity(t.odds), excl = STICKERS.filter(s => s.hatch && s.r === r), norm = STICKERS.filter(s => !s.hatch && s.r === r);
  const pool = excl.length && (Math.random() * 100 < EGG_EXCL || !norm.length) ? excl : norm;
  return pool[Math.random() * pool.length | 0];
}

// ---------- zegar (co sekundę) + wyjście z aplikacji
function eggTick() {
  const E = eggRun(); if (!E) return eggChip(null);
  const now = Date.now(), dt = Math.min(5000, Math.max(0, now - E.last)); E.last = now;
  if (E.breakUntil && now >= E.breakUntil) { E.breakUntil = 0; toast('☕ Koniec przerwy – wracamy do skupienia!'); }
  if (eggGrowing(E)) E.prog += dt;
  if (E.pomo && !E.breakUntil) { const n = Math.floor(E.prog / EGG_POMO); if (n > E.pomoN) { E.pomoN = n; if (eggLeft(E) > EGG_BREAK) { E.breakUntil = now + EGG_BREAK; toast('☕ 25 minut! 5 minut przerwy – możesz wyjść z aplikacji', 4000); } } }
  if (eggLeft(E) <= 0) return eggFinish(E, true);
  eggSave(E); eggChip(E); eggPaint(E);
}
function eggBack(E, away) {
  E.hiddenAt = 0; E.last = Date.now();
  if (away > EGG_GRACE && !eggInBreak(E)) {
    if (useShield()) { E.saved++; eggSave(E); setTimeout(() => toast(`🛡️ Tarcza uratowała jajko! Zostało tarcz: ${shieldCount()}`, 4500), 300); }
    else return eggFinish(E, false, 'left');
  } else if (away > 2000 && !eggInBreak(E)) setTimeout(() => toast('😮‍💨 Uff, zdążyłeś! Nie wychodź z aplikacji, bo jajko pęknie'), 300);
  eggSave(E); eggWake(E); render();
}
document.addEventListener('visibilitychange', () => {
  const E = eggRun(); if (!E) return;
  if (document.hidden) { E.hiddenAt = Date.now(); eggSave(E); }
  else eggBack(E, Date.now() - (E.hiddenAt || E.last));
});
addEventListener('hashchange', () => setTimeout(() => eggChip(eggRun()), 0));
addEventListener('pagehide', () => { const E = eggRun(); if (E && !E.hiddenAt) { E.hiddenAt = Date.now(); eggSave(E); } });
on('start', () => {
  const E = eggRun();
  if (E) { const away = Date.now() - (E.hiddenAt || E.last); if (away > EGG_GRACE) eggBack(E, away); else eggWake(E); }
  setInterval(eggTick, 1000);
});

// 📵 ekran nie gaśnie w trybie „telefon odłożony”
let eggLock = null;
async function eggWake(E) { if (E?.mode !== 'phone' || eggLock || !navigator.wakeLock) return; try { eggLock = await navigator.wakeLock.request('screen'); eggLock.addEventListener('release', () => { eggLock = null; }); } catch { /* */ } }
function eggUnwake() { try { eggLock?.release(); } catch { /* */ } eggLock = null; }

// ---------- jajko (SVG z pęknięciami)
function eggSVG(min, prog = 0, broken = false) {
  const t = eggTier(min), st = broken ? 4 : prog < .25 ? 0 : prog < .5 ? 1 : prog < .8 ? 2 : 3;
  const cracks = ['M38 70 l8 7 l-6 6 l9 8', 'M78 58 l-7 9 l7 5 l-5 9 l6 6', 'M30 104 l10 -4 l4 8 l9 -6 l6 7 l9 -5', 'M60 20 l-4 12 l7 6 l-5 10 l6 7'];
  const egg = 'M60 8C92 8 112 66 112 100C112 132 90 152 60 152S8 132 8 100C8 66 28 8 60 8Z';
  if (broken) return `<svg class="egg-svg broken" viewBox="0 0 120 160"><g fill="${t.color}" stroke="#94a3b8" stroke-width="2.5">
    <path d="M8 104C8 132 30 152 60 152S112 132 112 104L98 96L86 108L72 94L60 108L47 95L34 108L21 96Z"/><path d="M22 70L32 82L44 70L56 84L66 72" transform="translate(-6 -22) rotate(-24 40 60)" fill="none"/>
    <path d="M60 8C80 8 96 30 104 58L90 66L80 54L68 66L56 54L44 66L33 56L18 64C26 32 42 8 60 8Z" transform="translate(-4 -10) rotate(-16 60 40)"/></g></svg>`;
  return `<svg class="egg-svg st${st}" viewBox="0 0 120 160"><defs><radialGradient id="eg${min}" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="${t.color}"/><stop offset="1" stop-color="${t.spot}" stop-opacity=".55"/></radialGradient></defs>
    <path d="${egg}" fill="url(#eg${min})" stroke="${t.spot}" stroke-opacity=".6" stroke-width="2"/>
    <g fill="${t.spot}" opacity=".45"><circle cx="42" cy="56" r="6"/><circle cx="80" cy="88" r="8"/><circle cx="50" cy="118" r="5"/><circle cx="86" cy="44" r="4"/></g>
    <g fill="none" stroke="#475569" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${cracks.slice(0, st).map(d => `<path d="${d}"/>`).join('')}</g></svg>`;
}
const eggClock = ms => { const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
// aktualizacja widoku bez pełnego render (co sekundę)
function eggPaint(E) {
  const box = document.querySelector('.egg-run'); if (!box) return;
  const p = Math.min(1, E.prog / (E.min * 60000));
  box.querySelector('.egg-time').textContent = eggClock(eggLeft(E));
  box.querySelector('.egg-status').textContent = eggStatus(E);
  box.querySelector('.egg-ring').style.setProperty('--p', (p * 100).toFixed(2));
  box.querySelector('.egg-wrap').classList.toggle('grow', eggGrowing(E));
  box.querySelector('.egg-wrap').classList.toggle('late', p > .8);
  const st = p < .25 ? 0 : p < .5 ? 1 : p < .8 ? 2 : 3, svg = box.querySelector('.egg-svg');
  if (svg && !svg.classList.contains('st' + st)) box.querySelector('.egg-wrap').innerHTML = eggSVG(E.min, p);
  const br = box.querySelector('.egg-break'); if (br) br.hidden = !eggInBreak(E);
}
// mała plakietka z czasem na innych ekranach (w pasku nauki albo w rogu)
function eggChip(E) {
  let el = document.getElementById('egg-chip');
  if (!E || parseRoute().parts[0] === 'egg') { el?.remove(); return; }
  const bar = document.querySelector('.studybar');
  if (!el) { el = document.createElement('a'); el.id = 'egg-chip'; el.href = '#/egg'; }
  const want = bar || document.body;
  if (el.parentNode !== want) { if (bar) bar.insertBefore(el, bar.lastElementChild); else document.body.append(el); }
  el.className = (bar ? 'in-bar' : 'floating') + (eggGrowing(E) ? ' grow' : '');
  el.innerHTML = `🥚 ${eggClock(eggLeft(E))}${eggGrowing(E) ? '' : eggInBreak(E) ? ' ☕' : ' ⏸'}`;
}

// ---------- widok
ROUTES.egg = () => {
  const E = eggRun();
  if (E) {
    const p = Math.min(1, E.prog / (E.min * 60000));
    return { tab: 'home', focus: E.mode === 'phone', html: `
    <div class="studybar"><button class="iconbtn" data-go="#/">‹</button><div class="title">🥚 Inkubator · ${E.min} min</div><span class="small muted">🛡️ ${shieldCount()}</span></div>
    <div class="card center egg-run">
      <div class="egg-ring" style="--p:${(p * 100).toFixed(2)}"><div class="egg-wrap${eggGrowing(E) ? ' grow' : ''}${p > .8 ? ' late' : ''}">${eggSVG(E.min, p)}</div></div>
      <div class="egg-time">${eggClock(eggLeft(E))}</div>
      <div class="egg-status small">${eggStatus(E)}</div>
      <div class="egg-break small" ${eggInBreak(E) ? '' : 'hidden'}><button class="sm" data-act="egg-skipbreak">Pomiń przerwę</button></div>
      ${E.mode === 'study' ? '<button class="primary block" data-go="#/">📚 Ucz się – jajko rośnie podczas nauki</button>' : '<p class="small muted">📵 Odłóż telefon ekranem w dół. Ekran nie zgaśnie – nie blokuj go i nie wychodź z aplikacji.</p>'}
      <p class="small muted" style="margin:10px 0 4px">Wyjście z aplikacji na dłużej niż ${EGG_GRACE / 1000} s = jajko pęka 💥${shieldCount() ? ` (🛡️ tarcza uratuje je ${shieldCount()}×)` : ''}.</p>
      <button class="ghost sm" data-act="egg-quit">Poddaj się</button>
    </div>` };
  }
  const t = eggTier(EGG_PICK.min), list = eggs(), ok = list.filter(x => x.ok);
  const ws = typeof weekStart === 'function' ? weekStart() : addDays(dayStart(), -6);
  const week = list.filter(x => x.t >= ws), wOk = week.filter(x => x.ok);
  const pct = r => t.mythic ? t.odds[r] * (100 - t.mythic) / 100 : t.odds[r];
  const last = EGG_LAST, ls = last?.st && stickerById(last.st);
  return { tab: 'home', html: `
  <div class="row nowrap"><button class="iconbtn" data-go="#/">‹</button><h1 class="grow" style="margin:0">🥚 Inkubator</h1>${coinsHTML()}</div>
  ${last ? `<div class="card center egg-result ${last.ok ? 'ok' : 'bad'}">${last.ok && ls ? `<div class="egg-hatch"><span style="--rc:${RARITY[ls.r].color}">${stE(ls)}</span></div><b style="font-size:20px">${esc(ls.name)}</b>
      <div style="color:${RARITY[ls.r].color};font-weight:700">${RARITY[ls.r].name}${ls.hatch ? ' · 🥚 tylko z inkubatora' : ''}</div><p class="small muted">+${last.gems} 💎 · ${last.min} min skupienia. Naklejka jest w albumie.</p>`
      : `<div class="egg-wrap">${eggSVG(last.min, 0, true)}</div><b>Jajko pękło 💥</b><p class="small muted">${last.why === 'left' ? 'Wyszedłeś z aplikacji na dłużej niż ' + EGG_GRACE / 1000 + ' s.' : 'Sesja przerwana.'} Następnym razem się uda!</p>`}</div>` : ''}
  <div class="card">
    <p class="small muted" style="margin-top:0">Skup się na nauce, a z jajka wykluje się naklejka. <b>Im dłużej, tym rzadsza.</b> Wyjście z aplikacji rozbija jajko 💥</p>
    <div class="egg-pick">${EGG_TIERS.map(x => `<button class="${x.min === EGG_PICK.min ? 'on' : ''}" data-act="egg-min" data-m="${x.min}"><span class="mini-egg">${eggSVG(x.min)}</span><b>${x.min >= 60 ? x.min / 60 + ' h' : x.min + ' min'}</b><small>+${x.gems} 💎</small></button>`).join('')}</div>
    <div class="odds center egg-odds">${Object.keys(t.odds).map(r => `<span style="color:${RARITY[r].color}">● ${RARITY[r].name} ${pctFmt(pct(r))}</span>`).join(' ')}${t.mythic ? ` <span style="color:${RARITY.mythic.color};font-weight:700">🔴 Mityczna ${pctFmt(t.mythic)}</span>` : ''}
      <br><small class="muted">Połowa wykluć to naklejki 🥚 dostępne tylko z inkubatora</small></div>
    <div class="seg egg-mode"><button class="${EGG_PICK.mode === 'study' ? 'on' : ''}" data-act="egg-mode" data-m="study">📚 Nauka w aplikacji</button><button class="${EGG_PICK.mode === 'phone' ? 'on' : ''}" data-act="egg-mode" data-m="phone">📵 Telefon odłożony</button></div>
    <p class="small muted" style="margin:6px 0">${EGG_PICK.mode === 'study' ? 'Czas leci tylko, gdy uczysz się w aplikacji (fiszki, testy, gry, bitwy). Liczy się do czasu nauki w rankingu.' : 'Uczysz się z zeszytu albo książki. Telefon leży ekranem w dół, ekran nie gaśnie, czas leci cały czas.'}</p>
    ${EGG_PICK.min >= 45 ? `<label class="row nowrap small" style="gap:8px;margin:6px 0"><input type="checkbox" data-act="egg-pomo" ${EGG_PICK.pomo ? 'checked' : ''}> ☕ Przerwy pomodoro (co 25 min – 5 min, wtedy można wyjść)</label>` : ''}
    <button class="primary block" data-act="egg-start" style="min-height:56px;font-size:18px">🥚 Zacznij · ${EGG_PICK.min} min</button>
    <div class="row nowrap small" style="margin-top:10px"><span class="grow">🛡️ Tarcze: <b>${shieldCount()}</b> <span class="muted">(1 darmowa dziennie, ratuje jajko po wyjściu)</span></span><button class="sm" data-act="egg-shield">+1 · ${SHIELD_PRICE} 💎</button></div>
  </div>
  <div class="card"><h2 style="margin-top:0">🪺 Twoje gniazdo</h2>
    <div class="time-kpis">${[['wyklute', ok.length], ['ten tydzień', wOk.length], ['skupienie (tydz.)', fmtDur(wOk.reduce((a, x) => a + x.min * 60000, 0))], ['pęknięte', list.length - ok.length]].map(([l, v]) => `<div><b>${v}</b><small>${l}</small></div>`).join('')}</div>
    ${eggCalHTML()}
    ${ok.length ? `<div class="egg-nest">${ok.slice(-60).reverse().map(x => { const s = stickerById(x.st); return s ? `<span style="--rc:${RARITY[s.r].color}" title="${esc(s.name)} · ${x.min} min · ${new Date(x.end).toLocaleDateString('pl-PL')}">${stE(s)}</span>` : ''; }).join('')}</div>` : '<p class="small muted center">Tu pojawią się Twoje wyklute naklejki 🐣</p>'}
  </div>
  <div class="card"><h2 style="margin-top:0">🥚 Naklejki z inkubatora</h2><div class="egg-nest excl">${STICKERS.filter(s => s.hatch).map(s => { const have = hasItem('sticker', s.id) || hasItem('shiny', s.id); return `<span class="${have ? '' : 'locked'}" style="--rc:${RARITY[s.r].color}" title="${have ? esc(s.name) : RARITY[s.r].name}">${have ? stE(s) : '❔'}</span>`; }).join('')}</div>
    <p class="small muted" style="margin:6px 0 0">Nie ma ich w skrzynkach – tylko z jajek.</p></div>` };
};
// kalendarz: ostatnie 5 tygodni, w każdym dniu wyklute naklejki i pęknięcia
function eggCalHTML() {
  const today = dayStart(), first = addDays(today, -34), by = {};
  for (const x of eggs()) if (x.end >= first) (by[dayKey(x.end)] = by[dayKey(x.end)] || []).push(x);
  const days = Array.from({ length: 35 }, (_, i) => addDays(first, i));
  return `<div class="egg-cal">${['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'].map(d => `<b>${d}</b>`).join('')}${Array.from({ length: (new Date(first).getDay() + 6) % 7 }, () => '<i></i>').join('')}${days.map(d => {
    const l = by[dayKey(d)] || [], ok = l.filter(x => x.ok), bad = l.length - ok.length;
    return `<div class="${d === today ? 'today' : ''}${ok.length ? ' has' : ''}" title="${new Date(d).toLocaleDateString('pl-PL')}: ${ok.length} wyklutych${bad ? `, ${bad} pękniętych` : ''}"><small>${new Date(d).getDate()}</small><span>${ok.slice(0, 2).map(x => stE(stickerById(x.st))).join('')}${ok.length > 2 ? `<em>+${ok.length - 2}</em>` : ''}${bad ? '<em class="bad">💥</em>' : ''}</span></div>`;
  }).join('')}</div>`;
}
// karta na Starcie
function eggHomeHTML() {
  const E = eggRun();
  if (E) return `<div class="card row nowrap egg-home" data-go="#/egg"><span class="egg-home-ic">${eggSVG(E.min, E.prog / (E.min * 60000))}</span><div class="grow"><b>Jajko się wysiaduje · ${eggClock(eggLeft(E))}</b><div class="small muted">${eggStatus(E)}</div></div><span>›</span></div>`;
  return `<div class="card row nowrap egg-home" data-go="#/egg"><span class="egg-home-ic">${eggSVG(EGG_PICK.min)}</span><div class="grow"><b>🥚 Inkubator naklejek</b><div class="small muted">Skup się ${EGG_PICK.min} min i wykluj naklejkę. Wyjście z aplikacji rozbija jajko!</div></div><span>›</span></div>`;
}
const eggHome0 = homeExtrasHTML;
homeExtrasHTML = function () { return eggHomeHTML() + eggHome0(); };

const eggPickSave = () => { try { localStorage.setItem('eggPick', JSON.stringify(EGG_PICK)); } catch { /* */ } };
Object.assign(ACTIONS, {
  'egg-min': el => { EGG_PICK.min = +el.dataset.m; EGG_LAST = null; eggPickSave(); render(); },
  'egg-mode': el => { EGG_PICK.mode = el.dataset.m; eggPickSave(); render(); },
  'egg-pomo': el => { EGG_PICK.pomo = el.checked; eggPickSave(); },
  'egg-start': () => eggStart(),
  'egg-quit': () => { const E = eggRun(); if (E && confirm('Poddać się? Jajko pęknie i nic się nie wykluje.')) eggFinish(E, false, 'quit'); },
  'egg-skipbreak': () => { const E = eggRun(); if (E) { E.breakUntil = 0; eggSave(E); render(); } },
  'egg-shield': () => { if (spend(SHIELD_PRICE, 'shield')) { addItem('shield', 'shield', 1); toast('🛡️ +1 tarcza'); render(); } },
});

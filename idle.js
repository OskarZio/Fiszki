'use strict';
/* 🏛️ Akademia – gra beta typu idle / budowanie (admin + testerzy z panelu admina, cecha 'idle').
   Budujesz miasteczko nauki: budynki produkują 📜 wiedzę co sekundę, także gdy aplikacja jest zamknięta (do 8 h, z ulepszeniami dłużej).
   Nauka napędza grę: każda powtórka fiszki dziś = +1% produkcji (max +100%), a 🎓 stypendium dnia (złoto) wymaga 10 powtórek.
   Kamienie milowe (poz. 10, 25, 50, 100…) podwajają budynek, ulepszenia działają na całe miasto, a 📜 Dyplomy (reset) dają stały bonus.
   Stan w S.stats.idle (synchronizuje się). Licznik odświeża się własnym zegarem – bez przebudowy całego ekranu. */
const akOn = () => typeof testOn === 'function' ? testOn('idle') : typeof IS_ADMIN !== 'undefined' && IS_ADMIN === true;
const AK_B = [
  { id: 'desk', ic: '🪑', n: 'Ławka ucznia', d: 'Pierwsze notatki przy świecy', c: 12, p: .4, col: '#a16207' },
  { id: 'lib', ic: '📚', n: 'Biblioteka', d: 'Półki pełne podręczników', c: 140, p: 3, col: '#2563eb' },
  { id: 'lab', ic: '🧪', n: 'Laboratorium', d: 'Eksperymenty dają nowe odkrycia', c: 1500, p: 16, col: '#16a34a' },
  { id: 'garden', ic: '🌿', n: 'Ogród botaniczny', d: 'Żywe atlasy roślin', c: 16000, p: 85, col: '#059669' },
  { id: 'obs', ic: '🔭', n: 'Obserwatorium', d: 'Mapy gwiazd i komet', c: 175000, p: 460, col: '#7c3aed' },
  { id: 'aula', ic: '🏛️', n: 'Aula', d: 'Wykłady dla tłumów', c: 2e6, p: 2600, col: '#b91c1c' },
  { id: 'tower', ic: '🗼', n: 'Wieża mędrców', d: 'Najstarsze księgi świata', c: 2.4e7, p: 15000, col: '#0f766e' },
  { id: 'planet', ic: '🪐', n: 'Planetarium', d: 'Kosmos pod kopułą', c: 3e8, p: 90000, col: '#4338ca' },
  { id: 'rocket', ic: '🚀', n: 'Akademia kosmiczna', d: 'Nauka poza orbitą', c: 4e9, p: 560000, col: '#db2777' },
];
const AK_U = [
  { id: 'coffee', ic: '☕', n: 'Kawa', d: 'Stuknięcie w szkołę ×3', c: 60 },
  { id: 'marker', ic: '🖍️', n: 'Kolorowe zakreślacze', d: 'Ławki i biblioteki ×2', c: 2500 },
  { id: 'bookmark', ic: '🔖', n: 'Zakładki', d: 'Produkcja offline do 12 h', c: 9000 },
  { id: 'notes', ic: '🗂️', n: 'Fiszki w każdej sali', d: 'Całe miasto ×1,5', c: 120000 },
  { id: 'plan', ic: '📅', n: 'Plan zajęć', d: 'Produkcja offline do 24 h', c: 3e6 },
  { id: 'grant', ic: '💼', n: 'Grant badawczy', d: 'Całe miasto ×2', c: 6e7 },
  { id: 'wifi', ic: '📡', n: 'Szybki internet', d: 'Stuknięcie = 10% produkcji na sekundę', c: 8e8 },
  { id: 'nobel', ic: '🏅', n: 'Nagroda Nobla', d: 'Całe miasto ×3', c: 2e10 },
];
const AK_MILES = [10, 25, 50, 100, 150, 200, 300];
const AK_STIPEND_REV = 10;
const ak = () => { const I = S.stats.idle = S.stats.idle || {}; I.b = I.b || {}; I.u = I.u || {}; if (I.w == null) { I.w = 0; I.tot = 0; I.all = 0; I.dip = 0; I.t = Date.now(); } return I; };
function akFmt(x) {
  x = Math.floor(x); if (x < 1e4) return x.toLocaleString('pl');
  const u = [[1e15, 'bld'], [1e12, 'bln'], [1e9, 'mld'], [1e6, 'mln'], [1e3, 'tys.']];
  for (const [v, s] of u) if (x >= v) return (x / v).toLocaleString('pl', { maximumFractionDigits: x / v < 100 ? 2 : 1 }) + ' ' + s;
  return String(x);
}
const akRevToday = () => logMemo('akrev', () => S.log.filter(l => l.t >= dayStart()).length);
const akBoost = () => Math.min(100, akRevToday());
const akBuildMult = (b, lv) => 2 ** AK_MILES.filter(m => lv >= m).length * ((b.id === 'desk' || b.id === 'lib') && ak().u.marker ? 2 : 1);
function akCityMult() { const I = ak(); return (I.u.notes ? 1.5 : 1) * (I.u.grant ? 2 : 1) * (I.u.nobel ? 3 : 1) * (1 + .1 * (I.dip || 0)) * (1 + akBoost() / 100); }
const akBProd = b => { const lv = ak().b[b.id] || 0; return lv * b.p * akBuildMult(b, lv); };
const akRate = () => AK_B.reduce((a, b) => a + akBProd(b), 0) * akCityMult();
const akCost = (b, lv) => Math.ceil(b.c * 1.15 ** lv);
function akCostN(b, n) { const lv = ak().b[b.id] || 0; let s = 0; for (let i = 0; i < n; i++) s += akCost(b, lv + i); return s; }
function akMaxN(b) { const I = ak(), lv = I.b[b.id] || 0; let n = 0, s = 0; while (n < 500) { const c = akCost(b, lv + n); if (s + c > I.w) break; s += c; n++; } return n; }
const akClick = () => { const I = ak(), base = 1 + akRate() * (I.u.wifi ? .1 : .02); return base * (I.u.coffee ? 3 : 1); };
const akOfflineCap = () => (ak().u.plan ? 24 : ak().u.bookmark ? 12 : 8) * 3600;
const akLevels = () => Object.values(ak().b).reduce((a, x) => a + x, 0);
const akDipFor = all => Math.floor(Math.sqrt(all / 1e7));
function akGain(sec) { const I = ak(), g = akRate() * sec; I.w += g; I.tot += g; I.all = (I.all || 0) + g; return g; }
// produkcja od ostatniej wizyty (z limitem offline)
function akCatchUp() {
  const I = ak(), now = Date.now(), sec = Math.max(0, Math.min(akOfflineCap(), (now - (I.t || now)) / 1000)); I.t = now;
  return sec > 30 ? { sec, g: akGain(sec) } : (akGain(sec), null);
}
let AK_TIMER = 0, AK_BUY = 1, AK_SAVE = 0;
function akTick() {
  if (parseRoute().parts[0] !== 'akad' || !document.getElementById('ak-root')) { clearInterval(AK_TIMER); AK_TIMER = 0; akSync(); return; }
  if (document.hidden) return;
  const I = ak(), now = Date.now(); akGain(Math.min(5, (now - I.t) / 1000)); I.t = now;
  akPaint();
  if (now - AK_SAVE > 15000) { AK_SAVE = now; save(); }
}
const akSync = () => { const I = S.stats.idle; if (I) { I.t = Date.now(); save(); } };
document.addEventListener('visibilitychange', () => { if (!S?.stats?.idle) return; if (document.hidden) akSync(); else if (parseRoute().parts[0] === 'akad') { const r = akCatchUp(); if (r) akWelcome(r); } });
// lekkie odświeżenie: liczniki i dostępność przycisków bez render()
function akPaint() {
  const I = ak(), $w = document.getElementById('ak-w'); if (!$w) return;
  $w.textContent = akFmt(I.w);
  for (const el of document.querySelectorAll('[data-ak-cost]')) el.classList.toggle('can', I.w >= +el.dataset.akCost);
  const dp = document.getElementById('ak-dip'); if (dp) dp.textContent = Math.max(0, akDipFor(I.all) - (I.dip || 0));
}
function akWelcome(r) { toast(`🏛️ Pod Twoją nieobecność (${r.sec >= 3600 ? Math.floor(r.sec / 3600) + ' h ' : ''}${Math.floor(r.sec % 3600 / 60)} min) Akademia wyprodukowała ${akFmt(r.g)} 📜`, 4000); }
function akSceneHTML() {
  const I = ak(), h = new Date().getHours(), night = h < 6 || h >= 20, eve = !night && h >= 17;
  const town = AK_B.filter(b => I.b[b.id]).map((b, i) => { const lv = I.b[b.id], sz = Math.min(46, 22 + Math.log2(lv + 1) * 4);
    return `<span class="ak-house" style="--sz:${sz}px;--d:${i * .37}s" title="${esc(b.n)} · poz. ${lv}">${b.ic}</span>`; }).join('');
  return `<div class="ak-scene${night ? ' night' : eve ? ' eve' : ''}"><i class="ak-sun"></i><i class="ak-cloud c1"></i><i class="ak-cloud c2"></i>
    <div class="ak-count"><b id="ak-w">${akFmt(I.w)}</b><span>📜 wiedzy · <b>+${akFmt(akRate())}</b>/s</span></div>
    <div class="ak-town">${town || '<span class="ak-empty">Kup pierwszy budynek ↓</span>'}</div>
    <button class="ak-school" data-act="ak-tap" aria-label="Stuknij, żeby zdobyć wiedzę">🏫<small>+${akFmt(akClick())}</small></button><div class="ak-ground"></div></div>`;
}
function akBuildingsHTML() {
  const I = ak(); let hidden = 0;
  return AK_B.map(b => {
    const lv = I.b[b.id] || 0;
    if (!lv && I.tot < b.c * .4 && (I.all || 0) < b.c) { if (hidden++) return ''; return `<div class="ak-b lock"><span class="ak-bic">❔</span><div class="grow"><b>???</b><small>Odkryjesz przy ${akFmt(b.c * .4)} 📜</small></div></div>`; }
    const n = AK_BUY === 'max' ? Math.max(1, akMaxN(b)) : AK_BUY, cost = akCostN(b, n), next = AK_MILES.find(m => m > lv);
    const each = b.p * akBuildMult(b, Math.max(1, lv)) * akCityMult();
    return `<div class="ak-b" style="--bc:${b.col}"><span class="ak-bic">${b.ic}</span><div class="grow"><b>${esc(b.n)} <em>poz. ${lv}</em></b>
      <small>${lv ? `daje ${akFmt(akBProd(b) * akCityMult())}/s · ` : ''}+${akFmt(each)}/s za poziom</small>
      ${next ? `<span class="ak-mile"><i style="width:${Math.round(100 * (lv - (AK_MILES[AK_MILES.indexOf(next) - 1] || 0)) / (next - (AK_MILES[AK_MILES.indexOf(next) - 1] || 0)))}%"></i></span><small class="muted">poz. ${next}: produkcja ×2</small>` : ''}</div>
      <button class="ak-buy" data-act="ak-buy" data-id="${b.id}" data-n="${n}" data-ak-cost="${cost}">${n > 1 ? `×${n}<br>` : ''}${akFmt(cost)} 📜</button></div>`;
  }).join('');
}
function akUpgradesHTML() {
  const I = ak(), list = AK_U.filter(u => !I.u[u.id] && (I.all || 0) >= u.c * .2).slice(0, 3);
  if (!list.length) return '';
  return `<h3 class="ak-h">✨ Ulepszenia</h3><div class="ak-ups">${list.map(u => `<button class="ak-up" data-act="ak-up" data-id="${u.id}" data-ak-cost="${u.c}"><span>${u.ic}</span><b>${esc(u.n)}</b><small>${esc(u.d)}</small><em>${akFmt(u.c)} 📜</em></button>`).join('')}</div>`;
}
function akMetaHTML() {
  const I = ak(), rev = akRevToday(), boost = akBoost(), day = dayKey(Date.now()), got = I.stip === day, lvls = akLevels(), stip = Math.min(40, 8 + 4 * Math.floor(lvls / 15));
  const dipNow = Math.max(0, akDipFor(I.all || 0) - (I.dip || 0));
  return `<div class="ak-boost"><div class="row nowrap" style="gap:10px"><span style="font-size:26px">📖</span><div class="grow"><b>Natchnienie z nauki: +${boost}%</b><small>Każda powtórka fiszki dziś = +1% produkcji (max +100%). Dziś: ${rev}.</small></div>${boost < 100 ? '<button class="sm primary" data-go="#/study/all/flip">Ucz się</button>' : ''}</div>
      <div class="ak-bbar"><i style="width:${boost}%"></i></div></div>
    <div class="ak-stip"><span style="font-size:26px">🎓</span><div class="grow"><b>Stypendium dnia: ${stip} 🪙</b><small>${got ? 'Odebrane – wróć jutro.' : rev >= AK_STIPEND_REV ? 'Gotowe do odebrania!' : `Powtórz ${AK_STIPEND_REV - rev} ${plural(AK_STIPEND_REV - rev, 'fiszkę', 'fiszki', 'fiszek')}, żeby odblokować.`} Rośnie z poziomami budynków.</small></div>
      ${got ? '<span class="small muted">✓</span>' : `<button class="sm${rev >= AK_STIPEND_REV ? ' primary' : ''}" data-act="ak-stip" ${rev >= AK_STIPEND_REV ? '' : 'disabled'}>Odbierz</button>`}</div>
    ${(I.all || 0) >= 1e7 ? `<div class="ak-dip"><span style="font-size:26px">📜</span><div class="grow"><b>Dyplomy: ${I.dip || 0}</b> <small>(+${10 * (I.dip || 0)}% produkcji)</small><small>Obrona dyplomu zeruje budynki, ulepszenia i wiedzę, ale każdy nowy dyplom to na stałe +10%. Teraz zdobędziesz: <b id="ak-dip">${dipNow}</b>.</small></div>
      <button class="sm" data-act="ak-dip" ${dipNow ? '' : 'disabled'}>Obroń</button></div>` : ''}`;
}
ROUTES.akad = () => {
  if (!akOn()) return { tab: 'arena', html: '<p class="muted center" style="padding:40px 0">Ten tryb jest jeszcze w testach.</p>' };
  const first = !S.stats.idle; ak();
  onMount(() => {
    const r = akCatchUp(); if (r) akWelcome(r);
    if (!AK_TIMER) AK_TIMER = setInterval(akTick, 250);
    akPaint();
  });
  return { tab: 'arena', html: `<div id="ak-root" class="ak"><div class="row nowrap"><button class="iconbtn" data-go="#/boss">‹</button><h1 class="grow" style="margin:0">Akademia</h1><span class="tag">${IS_ADMIN ? 'admin · beta' : 'beta'}</span></div>
    ${first ? '<p class="small muted ak-intro">Zbuduj miasteczko nauki. Stukaj w szkołę, kupuj budynki – produkują wiedzę same, nawet gdy aplikacja jest zamknięta. Nauka fiszek przyspiesza całe miasto.</p>' : ''}
    ${akSceneHTML()}
    ${akMetaHTML()}
    ${akUpgradesHTML()}
    <div class="row nowrap ak-hrow"><h3 class="ak-h grow">🏗️ Budynki</h3><div class="seg ak-seg">${[1, 10, 'max'].map(n => `<button class="${AK_BUY === n ? 'on' : ''}" data-act="ak-mode" data-n="${n}">${n === 'max' ? 'max' : '×' + n}</button>`).join('')}</div></div>
    <div class="ak-list">${akBuildingsHTML()}</div>
    <p class="small muted center">Wiedza nie zamienia się w kryształy – za to stypendium dnia daje złoto. Gra jest w becie: liczby mogą się jeszcze zmienić.</p></div>` };
};
// zakładka Przygoda: wejście do Akademii + mniej kart – dodatkowe tryby jako kafelki „Więcej trybów” (nic nie znika)
const akBoss0 = ROUTES.boss;
ROUTES.boss = (...a) => {
  const v = akBoss0(...a); if (!v?.html || v.focus || (a[0] && a[0][1])) return v;
  const cta = akOn() ? `<div class="card row nowrap idle-cta" data-go="#/akad"><span class="ak-cta-ic">🏛️</span><div class="grow"><b>Akademia <span class="tag">beta</span></b><div class="small muted">Buduj miasteczko nauki${S.stats.idle ? ` · ${akFmt(akRate())} 📜/s` : ''}</div></div><span>›</span></div>` : '';
  return cta ? { ...v, html: v.html.replace('<div class="card row nowrap coop-cta"', cta + '<div class="card row nowrap coop-cta"') } : v;
};
Object.assign(ACTIONS, {
  'ak-tap': el => { const g = akClick(), I = ak(); I.w += g; I.tot += g; I.all = (I.all || 0) + g; I.taps = (I.taps || 0) + 1; akPaint();
    const f = document.createElement('i'); f.className = 'ak-pop'; f.textContent = '+' + akFmt(g); f.style.left = (35 + Math.random() * 30) + '%'; el.parentElement.append(f); setTimeout(() => f.remove(), 900);
    el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); },
  'ak-buy': el => { const b = AK_B.find(x => x.id === el.dataset.id), I = ak(); if (!b) return; const n = +el.dataset.n || 1, c = akCostN(b, n); if (I.w < c) return toast('Za mało wiedzy 📜');
    const lv0 = I.b[b.id] || 0; I.w -= c; I.b[b.id] = lv0 + n; const m = AK_MILES.find(x => lv0 < x && lv0 + n >= x); if (m) toast(`🎉 ${b.n}: poziom ${m} – produkcja ×2!`); save(); render(); },
  'ak-up': el => { const u = AK_U.find(x => x.id === el.dataset.id), I = ak(); if (!u || I.u[u.id]) return; if (I.w < u.c) return toast('Za mało wiedzy 📜'); I.w -= u.c; I.u[u.id] = 1; toast(`${u.ic} ${u.n}: ${u.d}`); save(); render(); },
  'ak-mode': el => { AK_BUY = el.dataset.n === 'max' ? 'max' : +el.dataset.n; render(); },
  'ak-stip': () => { const I = ak(), day = dayKey(Date.now()); if (I.stip === day || akRevToday() < AK_STIPEND_REV) return; I.stip = day;
    const n = Math.min(40, 8 + 4 * Math.floor(akLevels() / 15)); if (!S.wallet.some(w => w.id === 'ak-' + day)) S.wallet.push({ id: 'ak-' + day, n, why: 'idle', t: Date.now() }); save(); toast(`🎓 Stypendium: +${n} 🪙`); render(); },
  'ak-dip': async () => { const I = ak(), n = akDipFor(I.all || 0) - (I.dip || 0); if (n <= 0) return;
    if (!await askBox({ icon: '📜', title: `Obrona dyplomu: +${n}`, intro: 'Budynki, ulepszenia i wiedza wrócą do zera. W zamian każdy dyplom daje na stałe +10% produkcji.', ok: 'Bronię!' })) return;
    I.dip = (I.dip || 0) + n; I.w = 0; I.tot = 0; I.b = {}; I.u = {}; save(); if (typeof confetti === 'function') confetti(120); render(); },
});
if (typeof GOLD_WHY !== 'undefined') GOLD_WHY.add('idle');

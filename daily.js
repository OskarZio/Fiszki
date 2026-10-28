'use strict';
/* Nagroda za codzienne wejście (jak w grach): 7-dniowy cykl, po dniu 7 od nowa. Każdy tydzień ma inny zestaw nagród.
   Przerwa (dzień bez wejścia) zeruje serię – zaczynasz od dnia 1. Okienko pokazuje się przy pierwszym wejściu danego dnia.
   Odebrane dni leżą w S.logins (łączone między urządzeniami po id), nagrody mają id dnia – nic się nie dubluje. */

const LOGIN_WEEKS = [
  { name: 'Tydzień skrzynek', days: [{ t: 'case', k: 'daily' }, { t: 'gems', n: 20 }, { t: 'sticker', r: 'common' }, { t: 'gems', n: 40 }, { t: 'case', k: 'basic' }, { t: 'gems', n: 60 }, { t: 'case', k: 'epic' }] },
  { name: 'Tydzień kryształów', days: [{ t: 'gems', n: 15 }, { t: 'gems', n: 25 }, { t: 'case', k: 'daily' }, { t: 'gems', n: 40 }, { t: 'sticker', r: 'rare' }, { t: 'gems', n: 70 }, { t: 'gems', n: 200 }] },
  { name: 'Tydzień kolekcjonera', days: [{ t: 'sticker', r: 'common' }, { t: 'gems', n: 20 }, { t: 'sticker', r: 'common' }, { t: 'case', k: 'basic' }, { t: 'sticker', r: 'rare' }, { t: 'gems', n: 50 }, { t: 'sticker', r: 'epic' }] },
  { name: 'Tydzień szczęściarza', days: [{ t: 'gems', n: 20 }, { t: 'case', k: 'daily' }, { t: 'gems', n: 30 }, { t: 'case', k: 'daily' }, { t: 'gems', n: 50 }, { t: 'case', k: 'basic' }, { t: 'sticker', r: 'legendary' }] },
];
const dailyOn = () => S.settings.loginRewards !== false && appMode() === 'full';
const weekNo = () => Math.floor((dayStart() - new Date(2024, 0, 1).getTime()) / (7 * DAY));   // 1.01.2024 to poniedziałek
const loginWeek = () => LOGIN_WEEKS[((weekNo() % LOGIN_WEEKS.length) + LOGIN_WEEKS.length) % LOGIN_WEEKS.length];
const todayKey = () => dayKey(Date.now());
const yKey = () => dayKey(addDays(dayStart(), -1));
const lastLogin = () => (S.logins || []).slice().sort((a, b) => a.day < b.day ? -1 : 1).pop();
// stan cyklu: który dzień dziś, czy już odebrany, czy seria przepadła
function loginState() {
  const last = lastLogin(), today = todayKey();
  if (last?.day === today) return { claimed: true, n: last.n, last };
  if (last?.day === yKey()) return { claimed: false, n: last.n % 7 + 1, last };
  return { claimed: false, n: 1, last, broken: !!last && last.n > 1 };
}
function rewardInfo(r) {
  if (r.t === 'gems') return { icon: '💎', label: `+${r.n}`, name: `${r.n} kryształów` };
  if (r.t === 'case') return { icon: typeof crateImg === 'function' ? crateImg(r.k, 'inline') : CASES[r.k]?.icon || '🎁', label: r.k === 'epic' ? 'Mistrza' : r.k === 'basic' ? 'Nauki' : 'Skrzynka', name: CASES[r.k]?.name || 'Skrzynka' };
  return { icon: '🃏', label: RARITY[r.r].name, name: `Naklejka: ${RARITY[r.r].name.toLowerCase()}`, color: RARITY[r.r].color };
}
function claimLogin() {
  const st = loginState(); if (st.claimed) return null;
  const day = todayKey(), r = loginWeek().days[st.n - 1], id = 'login-' + day;
  let got = rewardInfo(r);
  if (r.t === 'gems') { if (!S.wallet.some(w => w.id === id)) S.wallet.push({ id, n: r.n, why: 'login', t: Date.now() }); }
  else if (r.t === 'case') addItem('case', r.k, 1, id);
  else { const s = rollSticker({ [r.r]: 100 }); addItem('sticker', s.id, 1, id); got = { ...got, icon: s.e, name: `${s.name} (${RARITY[s.r].name.toLowerCase()})`, sticker: s.id }; }
  S.logins = S.logins || []; if (!S.logins.some(x => x.id === 'L' + day)) S.logins.push({ id: 'L' + day, day, n: st.n, t: Date.now() });
  S.stats.loginBest = Math.max(S.stats.loginBest || 0, st.n); save();
  return { ...got, n: st.n };
}

// ---------- okienko
function dailyModalHTML(got) {
  const st = loginState(), wk = loginWeek(), cur = st.claimed ? st.n : st.n;
  const tiles = wk.days.map((r, i) => {
    const d = i + 1, info = rewardInfo(r), done = d < cur || (d === cur && st.claimed), now = d === cur && !st.claimed;
    return `<div class="dr-tile${done ? ' done' : ''}${now ? ' now' : ''}${d === 7 ? ' big' : ''}" style="${info.color ? `--rc:${info.color}` : ''}">
      <small>Dzień ${d}</small><span>${info.icon}</span><b>${info.label}</b>${done ? '<i>✓</i>' : ''}</div>`;
  }).join('');
  return `<div class="dr-box card">
    <div class="dr-head"><div class="dr-gift">🎁</div><h2>Nagroda dnia</h2>
      <p class="small muted">${wk.name} · ${st.claimed ? `odebrano dzień ${st.n}/7` : `dzień ${st.n} z 7`}</p>
      ${st.broken && !st.claimed ? '<p class="dr-warn">💔 Seria przerwana – zaczynasz od dnia 1. Wpadaj codziennie, żeby dojść do dnia 7!</p>' : ''}</div>
    <div class="dr-grid">${tiles}</div>
    ${got ? `<div class="dr-got"><span>${got.icon}</span><b>${esc(got.name)}</b><small>${got.n < 7 ? `Jutro: dzień ${got.n + 1} – ${esc(rewardInfo(wk.days[got.n]).name)}` : 'Komplet tygodnia! Jutro nowy cykl 🎉'}</small></div>
      <button class="primary block" data-act="dr-close">Super! 🙌</button>`
      : st.claimed ? `<p class="center small muted">Już odebrane – wróć jutro po dzień ${st.n % 7 + 1}.</p><button class="block" data-act="dr-close">Zamknij</button>`
      : `<button class="primary block dr-claim pulse" data-act="dr-claim">Odbierz: ${esc(rewardInfo(wk.days[st.n - 1]).name)}</button><button class="ghost block" data-act="dr-close">Później</button>`}
    <p class="center small muted" style="margin:8px 0 0">Przerwa w wejściach zeruje serię · wyłączysz to w Ustawieniach</p></div>`;
}
function showDaily(got) {
  let el = document.querySelector('.dr-overlay');
  if (!el) { el = document.createElement('div'); el.className = 'dr-overlay'; el.addEventListener('click', e => { if (e.target === el) el.remove(); }); document.body.append(el); }
  el.innerHTML = dailyModalHTML(got);
}
function maybeShowDaily() {
  if (!S || !dailyOn() || loginState().claimed || document.querySelector('.dr-overlay')) return;
  const r = parseRoute().parts[0]; if (['study', 'quiz', 'battle', 'case', 'walk', 'ptrain', 'game'].includes(r)) return;   // nie przerywaj nauki / gry
  showDaily();
}
on('start', () => setTimeout(maybeShowDaily, 1300));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(maybeShowDaily, 800); });

Object.assign(ACTIONS, {
  'dr-open': () => showDaily(),
  'dr-close': () => { document.querySelector('.dr-overlay')?.remove(); render(); },
  'dr-claim': () => {
    const got = claimLogin(); if (!got) return showDaily();
    showDaily(got);
    if (typeof CASE_SFX !== 'undefined') { try { fxUnlock?.(); CASE_SFX.reveal(got.n === 7 ? 'legendary' : got.n >= 5 ? 'epic' : 'rare'); } catch { /* */ } }
    if (got.sticker && typeof playStickerSound === 'function') setTimeout(() => playStickerSound(got.sticker), 900);
    confetti(got.n === 7 ? 200 : 80);
  },
});

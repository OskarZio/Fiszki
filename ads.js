'use strict';
/* 📺 Reklama nagradzana: „obejrzyj = +1 serce” (max 3 dziennie, tylko gdy brakuje serc – nigdy w trakcie nauki).
   Dostawca reklam podpina się w AD_CFG:
   • aplikacja na telefon (Capacitor): wtyczka AdMob (@capacitor-community/admob) + identyfikator reklamy z konta AdMob,
   • strona (PWA): Google Ad Manager – reklamy nagradzane (wymaga zatwierdzonego konta).
   Dopóki dostawca nie jest podpięty, pokazujemy własną planszę (zapowiedź funkcji / zaproszenie znajomych) z odliczaniem –
   nagroda działa tak samo, więc całość da się przetestować od razu. */
const AD_CFG = { admobRewardedId: '', perDay: 3, houseSeconds: 15 };
const adToday = () => { const k = dayKey(Date.now()); S.stats.adDay = S.stats.adDay === k ? k : (S.stats.adN = 0, k); return S.stats.adN || 0; };
const adCanHeart = () => typeof lives === 'function' && lives().n < LIVES_MAX && adToday() < AD_CFG.perDay;
async function showRewardedAd() {
  // 1) prawdziwa reklama (AdMob w aplikacji na telefon), jeśli jest skonfigurowana
  const AdMob = window.Capacitor?.Plugins?.AdMob;
  if (AdMob && AD_CFG.admobRewardedId) {
    try { await AdMob.prepareRewardVideoAd({ adId: AD_CFG.admobRewardedId }); const r = await AdMob.showRewardVideoAd(); return !!r; } catch { /* brak reklamy – plansza własna */ }
  }
  // 2) własna plansza z odliczaniem
  return new Promise(res => {
    const ov = document.createElement('div'); ov.className = 'ad-ov';
    const promos = [['🗼', 'Wieża duetu', 'Graj z kolegą – zapisy po każdym piętrze, nagrody drużyny rosną z wysokością.'], ['👑', 'Prestiż i skiny', 'Własne tło, motywy i skiny postaci znajdziesz w Kolekcji.'],
      ['🎁', 'Zaproś znajomego', 'On dostaje +500 💎 na start, Ty +200 💎 – i oboje darmową skrzynkę.'], ['🧠', 'Wieża wiedzy', 'Każda wspinaczka ma jedną losową kategorię – sprawdź, w czym jesteś najlepszy.']];
    const [ic, t, d] = promos[Math.random() * promos.length | 0]; let left = AD_CFG.houseSeconds;
    ov.innerHTML = `<div class="ad-box"><div class="ad-top"><small>Reklama · nagroda za ${left} s</small><button class="ad-x" disabled aria-label="Zamknij">✕</button></div>
      <div class="ad-body"><div class="ad-ic">${ic}</div><b>${t}</b><p>${d}</p></div><div class="ad-bar"><i></i></div></div>`;
    document.body.append(ov);
    const bar = ov.querySelector('.ad-bar i'), lbl = ov.querySelector('.ad-top small'), x = ov.querySelector('.ad-x');
    const tick = setInterval(() => { left--; bar.style.width = (100 * (1 - left / AD_CFG.houseSeconds)) + '%'; lbl.textContent = left > 0 ? `Reklama · nagroda za ${left} s` : 'Nagroda gotowa ✓';
      if (left <= 0) { clearInterval(tick); x.disabled = false; x.classList.add('ok'); } }, 1000);
    x.addEventListener('click', () => { if (x.disabled) return; ov.remove(); res(true); });
    ov.addEventListener('click', e => { if (e.target === ov && !x.disabled) { ov.remove(); res(true); } });
    document.addEventListener('visibilitychange', function v() { if (document.hidden) { clearInterval(tick); ov.remove(); document.removeEventListener('visibilitychange', v); res(false); } });
  });
}
ACTIONS['ad-heart'] = async () => {
  if (!adCanHeart()) return toast(lives().n >= LIVES_MAX ? 'Masz komplet serc ❤️' : 'Na dziś to już wszystkie reklamy – serca wrócą same albo za naukę', 3500);
  const ok = await showRewardedAd(); if (!ok) return toast('Reklama przerwana – bez nagrody');
  const L = lives(); L.n = Math.min(LIVES_MAX, L.n + 1); if (L.n >= LIVES_MAX) L.t = Date.now(); S.stats.adN = (S.stats.adN || 0) + 1; hero().mod = Date.now(); save();
  toast('❤️ +1 serce!', 2500); render();
};
// przycisk przy sercach (Przygoda / Bohater) – tylko gdy brakuje serc
setTimeout(() => { if (typeof livesHTML !== 'function') return; const lh0 = livesHTML;
  livesHTML = () => lh0() + (adCanHeart() ? `<button class="sm ad-heart-btn" data-act="ad-heart" title="Obejrzyj krótką reklamę">📺 +1 ❤️ <small>${AD_CFG.perDay - adToday()}/${AD_CFG.perDay}</small></button>` : ''); }, 0);

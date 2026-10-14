'use strict';
/* Zadania dnia – codziennie 3 zadania za kryształy 💎 (+ premia za komplet).
   Nagroda trafia do portfela z identyfikatorem dnia i zadania, więc odebranie na telefonie
   i na komputerze nie liczy się podwójnie (synchronizacja łączy wpisy po id). */

const todayLog = () => { const t0 = dayStart(); return S.log.filter(l => l.t >= t0); };
const todayPoints = () => Math.floor(todayLog().reduce((a, l) => a + studyPoints(l), 0));
const todayGood = () => todayLog().filter(l => l.m === 'type' && l.v === 'ok').length + (S.stats['quizok_' + dayKey(Date.now())] || 0);
const todayOf = arr => { const t0 = dayStart(); return (arr || []).filter(x => (x.t || x.created || 0) >= t0); };
const QUESTS = [
  { id: 'rev20', icon: '🔁', name: 'Zdobądź 20 pkt nauki', goal: 20, reward: 15, v: todayPoints },
  { id: 'rev50', icon: '🔥', name: 'Zdobądź 50 pkt nauki', goal: 50, reward: 30, v: todayPoints },
  { id: 'good15', icon: '✅', name: '15 poprawnie wpisanych lub w teście', goal: 15, reward: 15, v: todayGood },
  { id: 'new5', icon: '🌱', name: 'Naucz się 5 nowych kart', goal: 5, reward: 15, v: () => todayLog().filter(l => l.n).length },
  { id: 'add5', icon: '➕', name: 'Dodaj 5 nowych fiszek', goal: 5, reward: 15, v: () => todayOf(S.notes).length },
  { id: 'game', icon: '🧠', name: 'Zagraj w grę pamięciową', goal: 1, reward: 10, v: () => todayOf(S.games).length },
  { id: 'battle', icon: '⚔️', name: 'Stocz bitwę (może być z botem)', goal: 1, reward: 15, v: () => todayOf(S.battles).length },
  { id: 'win', icon: '🏆', name: 'Wygraj bitwę', goal: 1, reward: 25, v: () => todayOf(S.battles).filter(b => b.won === 1).length },
  { id: 'social', icon: '💬', name: 'Wyślij znajomemu przypomnienie lub prezent', goal: 1, reward: 10, v: () => S.stats['soc_' + dayKey(Date.now())] || 0,
    ok: () => typeof cloudOn === 'function' && cloudOn() && CLOUD_FRIENDS.length > 0 },
];
const QUEST_BONUS = 25;
// losowanie zestawu na dziś – takie samo na każdym urządzeniu (ziarno = data)
function todaysQuests() {
  const day = dayKey(Date.now());
  let seed = [...day].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
  const first = rnd() < .6 ? 'rev20' : 'rev50';
  const pool = QUESTS.filter(q => !q.id.startsWith('rev') && (!q.ok || q.ok()));
  for (let i = pool.length - 1; i > 0; i--) { const j = rnd() * (i + 1) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return [QUESTS.find(q => q.id === first), ...pool.slice(0, 2)];
}
const questWid = id => `q-${dayKey(Date.now())}-${id}`;
const questClaimed = id => S.wallet.some(w => w.id === questWid(id));
function questState() {
  const list = todaysQuests().map(q => { const cur = Math.min(q.goal, q.v()); return { ...q, cur, done: cur >= q.goal, claimed: questClaimed(q.id) }; });
  const allClaimed = list.every(q => q.claimed);
  return { list, claimable: list.filter(q => q.done && !q.claimed).length + (allClaimed && !questClaimed('all') ? 1 : 0), allClaimed, bonusClaimed: questClaimed('all') };
}
function questsCardHTML() {
  const st = questState();
  return `<div class="card" id="quests"><div class="row nowrap"><h2 class="grow" style="margin:0">📋 Zadania dnia</h2><span class="small muted">${st.list.filter(q => q.claimed).length}/3</span></div>
    <p class="small muted">Nowe zadania codziennie o północy. Za komplet: +${QUEST_BONUS} 💎.</p>
    <details class="small muted"><summary>Jak liczą się punkty nauki i 💎?</summary>
      <ul class="perks"><li><b>Wpisz</b> albo <b>test ABCD / pisemny</b>: 1 pkt za odpowiedź, 💎 za każdą poprawną.</li>
      <li><b>Przewijanie fiszek</b>: 10 fiszek = tyle co 1 wpisana. Przewinięte w mniej niż 1,5 s nie liczą się wcale.</li>
      <li>Testy: progi za wynik (np. 70% → 20 💎, 80% → 30 💎 na 10 pytań), max ${QUIZ_GEM_CAP} 💎 dziennie. Cel dzienny i jego premia liczą się w punktach nauki.</li></ul></details>
    ${st.list.map(q => `<div class="quest${q.claimed ? ' got' : ''}"><span class="qi">${q.icon}</span>
      <div class="grow"><div class="row nowrap"><b class="grow">${esc(q.name)}</b><small class="muted">${q.cur}/${q.goal}</small></div>${progress(q.cur / q.goal, true)}</div>
      ${q.claimed ? '<span class="c-rev">✓</span>' : `<button class="sm${q.done ? ' primary pulse' : ''}" data-act="quest-claim" data-id="${q.id}" ${q.done ? '' : 'disabled'}>+${q.reward} 💎</button>`}</div>`).join('')}
    ${st.allClaimed ? st.bonusClaimed ? '<p class="small c-rev center">✓ Komplet na dziś – wracaj jutro!</p>' : `<button class="primary block pulse" data-act="quest-claim" data-id="all">🎉 Odbierz premię +${QUEST_BONUS} 💎</button>` : ''}</div>`;
}
ROUTES.quests = () => ({ tab: 'home', html: `<div class="row nowrap"><button class="iconbtn" data-go="#/">‹</button><h1 class="grow">Zadania</h1>${typeof coinsHTML === 'function' ? coinsHTML() : ''}</div>${questsCardHTML()}` });

Object.assign(ACTIONS, {
  'quest-claim': el => {
    const id = el.dataset.id, st = questState();
    const q = id === 'all' ? (st.allClaimed ? { reward: QUEST_BONUS, name: 'Komplet zadań' } : null) : st.list.find(x => x.id === id && x.done);
    if (!q || questClaimed(id)) return;
    S.wallet.push({ id: questWid(id), n: q.reward, why: 'quest-' + id, t: Date.now() }); save();
    toast(`+${q.reward} 💎 · ${q.name}`); confetti(id === 'all' ? 120 : 40); render();
  },
});

// Start: skrót do zadań (pulsuje, gdy jest coś do odebrania)
const qHomeExtras0 = homeExtrasHTML;
homeExtrasHTML = function () {
  const base = qHomeExtras0(); if (S.settings.minimal) return base;
  const st = questState(), done = st.list.filter(q => q.claimed).length;
  return base + `<button class="block quest-cta${st.claimable ? ' primary pulse' : ''}" data-go="#/quests">📋 Zadania dnia ${done}/3${st.claimable ? ' · odbierz 💎' : ''}</button>`;
};
// Sklep: karta zadań na górze
// (zadania mają własną sekcję w zakładce Profil)

// Testy ABCD / pisemne: 💎 za poprawne odpowiedzi (min. 5 pytań, limit dzienny)
// Progi nagród za test (na 10 pytań ABCD). Więcej pytań = więcej (do 30), pisemny ×1,5, dzienny limit QUIZ_GEM_CAP.
const QUIZ_TIERS = [[100, 50], [90, 40], [80, 30], [70, 20], [60, 12], [50, 6]];
// wzór: (stawka z progu na 10 pytań) × (liczba pytań / 10)^1,15 – dłuższy test daje odrobinę więcej niż proporcjonalnie
const quizLenMul = total => Math.pow(Math.min(total, 60) / 10, 1.15);
function quizReward(pct, total, type) {
  if (total < 10) return { n: 0, why: 'kryształy od 10 pytań' };
  const tier = (QUIZ_TIERS.find(([p]) => pct >= p) || [0, 0])[1];
  const base = Math.round(tier * quizLenMul(total) * (type === 'type' ? 1.5 : 1));
  const t0 = dayStart(), already = S.wallet.filter(w => w.why === 'quiz' && w.t >= t0).reduce((a, w) => a + w.n, 0);
  const n = Math.max(0, Math.min(base, QUIZ_GEM_CAP - already));
  if (n > 0) { S.wallet.push({ id: uid(), n, why: 'quiz', t: Date.now() }); save(); }
  return { n, base, capped: n < base, tier };
}
const quizTiersHTML = type => `<div class="qtiers">${QUIZ_TIERS.slice().reverse().map(([p, g]) => `<span>${p}% → <b>${Math.round(g * (type === 'type' ? 1.5 : 1))}💎</b></span>`).join('')}</div>
  <p class="small muted" style="margin:6px 0 0">Stawki na 10 pytań${type === 'type' ? ' (pisemny ×1,5)' : ''}. Od 10 pytań w górę – np. 70% przy 20 pytaniach = ${Math.round(20 * quizLenMul(20) * (type === 'type' ? 1.5 : 1))} 💎, przy 30 = ${Math.round(20 * quizLenMul(30) * (type === 'type' ? 1.5 : 1))} 💎 · max ${QUIZ_GEM_CAP} 💎 dziennie z testów</p>`;
on('quiz', (pct, total) => {
  if (total < 5) return;
  const good = Math.round(pct * total / 100), day = dayKey(Date.now());
  S.stats['quizok_' + day] = (S.stats['quizok_' + day] || 0) + good; save();
});

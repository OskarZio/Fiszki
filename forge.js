'use strict';
/* 🔨 Kuźnia (jak w strategiach): ulepszanie przedmiotu trwa. Każdy przedmiot (broń, hełm, pancerz, talizman) do +10.
   – Każdy poziom kosztuje 💎 i czas (+1: 5 min … +10: 24 h). Na start 1 stanowisko, drugie do odblokowania.
   – Nauka przyspiesza kowala: dobra odpowiedź −1 min, wyklute jajko −30 min, materiał z duplikatu −1 h.
   – Progi +5 i +10 wymagają dodatkowo zadania (jajka / bossowie / powtórki).
   – Gotowe ulepszenie odbierasz w Kuźni; znaczek przy zakładce „Kowal” i powiadomienie, gdy coś czeka. */
const FORGE_T = [0, 5, 15, 30, 60, 120, 240, 480, 720, 1080, 1440].map(m => m * 60000);
const FORGE_BASE = { common: 40, rare: 70, epic: 110, legendary: 160, mythic: 220 };
const FORGE_SLOT2 = 1500, FORGE_CUT = { rev: 60000, egg: 30 * 60000, mat: 60 * 60000 };
const FORGE_TASKS = {
  egg: { n: [3, 5], txt: n => `Wykluj ${n} ${plural(n, 'jajko', 'jajka', 'jajek')}`, now: () => (typeof eggs === 'function' ? eggs() : []).filter(x => x.ok).length },
  boss: { n: [2, 5], txt: n => `Pokonaj ${n} ${plural(n, 'bossa', 'bossów', 'bossów')}`, now: () => S.stats.bossWins || 0 },
  rev: { n: [100, 300], txt: n => `Zrób ${n} dobrych odpowiedzi`, now: () => S.stats.forgeRev || 0 },
};
const forgeCost = (id, to) => Math.round((FORGE_BASE[GEAR[id]?.r] || 60) * to);
const forgeJobs = (h = hero()) => (h.forgeJob = Array.isArray(h.forgeJob) ? h.forgeJob.filter(j => GEAR[j?.id]) : []);
const forgeSlots = (h = hero()) => h.forgeSlots === 2 ? 2 : 1;
const forgeEnd = j => j.start + FORGE_T[j.to] - (j.cut || 0);
const forgeTaskLeft = j => { if (!j.task) return 0; const T = FORGE_TASKS[j.task.k]; return T ? Math.max(0, j.task.n - (T.now() - j.task.base)) : 0; };
const forgeDone = j => Date.now() >= forgeEnd(j) && !forgeTaskLeft(j);
const forgeReadyN = () => forgeJobs().filter(forgeDone).length;
const matCount = () => itemCount('forgemat', 'mat');
const fDur = ms => { const m = Math.round(ms / 60000); return (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`).replace(/ /g, '\u00a0'); };
const fClock = ms => { if (ms <= 0) return 'gotowe'; const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h} h ${m} min` : m ? `${m} min ${String(x).padStart(2, '0')} s` : `${x} s`; };

function forgeStart(id) {
  const h = hero(), g = GEAR[id], f = h.forge[id] || 0, to = f + 1, J = forgeJobs(h);
  if (!g || !ownsGear(id) || to > FORGE_MAX) return;
  if (J.some(j => j.id === id)) return toast('Ten przedmiot już jest w kuźni');
  if (J.length >= forgeSlots(h)) return toast(forgeSlots(h) < 2 ? `Kuźnia zajęta – odblokuj 2. stanowisko (${FORGE_SLOT2} 💎)` : 'Oba stanowiska są zajęte');
  if (!spend(forgeCost(id, to), 'forge')) return;
  const j = { id, to, start: Date.now(), cut: 0 };
  if (to === 5 || to === 10) { const ks = Object.keys(FORGE_TASKS), k = ks[Math.random() * ks.length | 0], T = FORGE_TASKS[k]; j.task = { k, n: T.n[to === 5 ? 0 : 1], base: T.now() }; }
  J.push(j); h.mod = Date.now(); save();
  toast(`🔨 Kowal zaczął: ${g.name} → +${to} (${fDur(FORGE_T[to])})${j.task ? ' · zadanie: ' + FORGE_TASKS[j.task.k].txt(j.task.n) : ''}`, 3500); render();
}
// ⏩ skrócenie czasu najstarszego niegotowego ulepszenia
function forgeCut(ms, why) {
  const h = hero(), j = forgeJobs(h).filter(x => Date.now() < forgeEnd(x)).sort((a, b) => a.start - b.start)[0]; if (!j) return false;
  j.cut = Math.min(FORGE_T[j.to], (j.cut || 0) + ms); h.mod = Date.now(); save(); return true;
}
function forgeCollect(id) {
  const h = hero(), J = forgeJobs(h), j = J.find(x => x.id === id); if (!j || !forgeDone(j)) return;
  h.forge[id] = Math.max(h.forge[id] || 0, j.to); h.forgeJob = J.filter(x => x !== j); h.mod = Date.now(); save();
  if (typeof celebrate === 'function') celebrate(`🔨 ${GEAR[id].name} +${j.to}!`, FORGE_BONUS[GEAR[id].slot](1) + ' za każdy poziom'); render();
}
const FORGE_BONUS = { w: n => `⚔️ +${6 * n}% ataku`, h: n => `❤️ +${5 * n} HP`, a: n => `🛡️ +${n}% obrony i +${3 * n} ❤️`, c: n => `🎯 +${n}% krytyka` };

// ---------- widok w zakładce „Kowal”
function forgeHTML() {
  const h = hero(), J = forgeJobs(h), slots = forgeSlots(h), now = Date.now(), mats = matCount();
  const own = Object.keys(GEAR).filter(id => ownsGear(id)).sort((a, b) => (h.eq[GEAR[b].slot] === b) - (h.eq[GEAR[a].slot] === a) || (h.forge[b] || 0) - (h.forge[a] || 0));
  const jobHTML = j => { const g = GEAR[j.id], end = forgeEnd(j), dur = FORGE_T[j.to], left = Math.max(0, end - now), tl = forgeTaskLeft(j), T = j.task && FORGE_TASKS[j.task.k], ready = !left && !tl;
    return `<div class="fj${ready ? ' ready' : ''}" style="--rc:${RARITY[g.r].color}"><div class="fj-top">${gearImg(j.id)}<div class="grow"><b>${esc(g.name)} → +${j.to}</b>
      <small class="fj-left" data-fend="${end}">${left ? 'zostało ' + fClock(left) : 'czas minął ✓'}</small></div></div>
      <div class="pbar"><i style="width:${(100 * Math.min(1, 1 - left / dur)).toFixed(1)}%"></i></div>
      ${T ? `<div class="fj-task${tl ? '' : ' ok'}">${tl ? '📋' : '✅'} ${T.txt(j.task.n)}${tl ? ` – zostało ${tl}` : ''}</div>` : ''}
      <div class="fj-btns">${ready ? `<button class="primary" data-act="forge-take" data-id="${j.id}">🎁 Odbierz +${j.to}</button>`
        : left && mats ? `<button data-act="forge-mat" data-id="${j.id}">🧱 Materiał −1 h (masz ${mats})</button>` : ''}</div></div>`; };
  const slotsHTML = [0, 1].map(i => i < slots ? (J[i] ? jobHTML(J[i]) : '<div class="fj empty"><b>Wolne stanowisko</b><small>Wybierz przedmiot niżej i stuknij „Ulepsz”.</small></div>')
    : `<div class="fj empty locked"><b>🔒 2. stanowisko</b><small>Dwa ulepszenia naraz.</small><button class="sm" data-act="forge-slot">Odblokuj · ${FORGE_SLOT2} 💎</button></div>`).join('');
  const rows = own.map(id => { const g = GEAR[id], f = h.forge[id] || 0, to = f + 1, busy = J.some(j => j.id === id), on = h.eq[g.slot] === id;
    return `<div class="fi" style="--rc:${RARITY[g.r].color}"><div class="fi-top">${gearImg(id)}<div class="grow"><b>${esc(g.name)}${f ? ` +${f}` : ''}${on ? ' <small class="fi-on">założone</small>' : ''}</b>
      <small>${f >= FORGE_MAX ? '🏆 maksymalny poziom' : `+${to}: ${FORGE_BONUS[g.slot](to)} łącznie · ⏳ ${fDur(FORGE_T[to])}${to === 5 || to === 10 ? ' · 📋 + zadanie' : ''}`}</small></div></div>
      ${f >= FORGE_MAX ? '' : busy ? '<span class="fi-busy">w kuźni</span>' : `<button class="primary" data-act="forge-go" data-id="${id}">Ulepsz do +${to} · ${forgeCost(id, to)} 💎</button>`}</div>`; }).join('');
  return `<div class="forge2"><div class="row nowrap"><b class="grow">🔨 Kuźnia</b><span class="fmat">🧱 ${mats}</span></div>
    <p class="small muted" style="margin:6px 0 12px">Ulepszenie trwa – kowal pracuje, a Ty się uczysz. <b>Każda dobra odpowiedź −1 min</b>, wyklute jajko −30 min, 🧱 materiał (z duplikatów w skrzyniach) −1 h. Poziomy +5 i +10 wymagają też zadania. Maksimum +${FORGE_MAX}.</p>
    <div class="fj-slots">${slotsHTML}</div>
    ${own.length ? `<h3 style="margin:18px 0 10px">Twoje przedmioty</h3><div class="fi-list">${rows}</div>` : '<p class="small muted">Nie masz jeszcze przedmiotów – kup u kowala niżej albo zdobądź w skrzyniach z bossów.</p>'}</div>`;
}

Object.assign(ACTIONS, {
  'forge-go': el => forgeStart(el.dataset.id),
  'forge-take': el => forgeCollect(el.dataset.id),
  'forge-mat': el => { const h = hero(), j = forgeJobs(h).find(x => x.id === el.dataset.id); if (!j || matCount() < 1) return;
    addItem('forgemat', 'mat', -1); j.cut = Math.min(FORGE_T[j.to], (j.cut || 0) + FORGE_CUT.mat); h.mod = Date.now(); save(); toast('🧱 −1 h'); render(); },
  'forge-slot': () => { const h = hero(); if (forgeSlots(h) >= 2) return; if (!confirm(`Odblokować 2. stanowisko w kuźni za ${FORGE_SLOT2} 💎?`)) return; if (!spend(FORGE_SLOT2, 'forge-slot')) return; h.forgeSlots = 2; h.mod = Date.now(); save(); toast('🔨 Drugie stanowisko gotowe!'); render(); },
  'hero-forge': () => { HERO_TAB = 'shop'; render(); },
});
// ⏩ nauka przyspiesza kowala
on('review', (c, g) => { if (g < 3) return; S.stats.forgeRev = (S.stats.forgeRev || 0) + 1; forgeCut(FORGE_CUT.rev); });
const forgeEgg0 = eggFinish;
eggFinish = function (E, ok, why) { const r = forgeEgg0(E, ok, why); if (ok && forgeCut(FORGE_CUT.egg)) setTimeout(() => toast('🔨 Jajko przyspieszyło kowala o 30 min', 3000), 3000); return r; };
// ⏱️ licznik na żywo + powiadomienie, gdy ulepszenie jest gotowe
setInterval(() => {
  for (const el of document.querySelectorAll('[data-fend]')) { const left = +el.dataset.fend - Date.now(); el.textContent = left > 0 ? 'zostało ' + fClock(left) : 'czas minął ✓'; }
  const h = S?.hero; if (!h) return; const ready = forgeJobs(h).filter(forgeDone);
  for (const j of ready) if (!j.told) { j.told = 1; toast(`🔨 Gotowe: ${GEAR[j.id].name} +${j.to} – odbierz w Kuźni (Bohater → Kowal)`, 5000); if (parseRoute().parts[0] === 'hero') render(); }
}, 1000);

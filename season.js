'use strict';
/* 🗓️ Sezony: co 4 tygodnie nowy sezon z własną ścieżką 25 poziomów nagród.
   Punkty sezonu liczą się z historii nauki (S.log – synchronizuje się, więc działa na każdym urządzeniu):
   fiszka wpisana dobrze = 2 pkt, inna wpisana / wybrana w teście = 1 pkt, przewinięta (min. 1,5 s) = 1 pkt, przeklikana = 0.
   40 pkt = 1 poziom → 1000 pkt na komplet (~36 fiszek dziennie). Na 25. poziomie czeka Skarbiec legend.
   Nagrody odbiera się ręcznie (stałe id → bez dublowania między urządzeniami). */
const SEASON_EPOCH = new Date('2026-11-02T00:00').getTime(), SEASON_LEN = 28, SEASON_STEP = 40, SEASON_TIERS = 25;
const SEASON_THEMES = [['🍂', 'Opadające liście', '#d97706'], ['❄️', 'Szron', '#0ea5e9'], ['🌸', 'Kwitnienie', '#ec4899'], ['🌊', 'Ocean', '#0891b2'],
  ['⚡', 'Burza', '#7c3aed'], ['🌋', 'Wulkan', '#dc2626'], ['🌌', 'Gwiazdy', '#4338ca'], ['🏔️', 'Szczyt', '#0f766e']];
// nagroda poziomu: g = złoto 🪙, d = kryształy 💎, c = skrzynka; co 5. poziom większa
function seasonReward(t) {
  const big = { 5: { c: 'forge' }, 10: { c: 'epic' }, 15: { c: 'weapon' }, 20: { c: 'skin' }, 25: { c: 'royal' } }[t];
  if (big) return big;
  return [{ g: 80 }, { d: 60 }, { c: 'daily' }, { g: 120 }][(t - 1) % 4];
}
const seasonRewardTxt = r => r.g ? `${r.g} 🪙` : r.d ? `${r.d} 💎` : (typeof CASES !== 'undefined' && CASES[r.c] ? `${CASES[r.c].icon} ${CASES[r.c].name}` : r.c);
const seasonIdx = (t = Date.now()) => Math.max(0, Math.floor((dayStart(t) - SEASON_EPOCH) / (SEASON_LEN * DAY)));
function seasonInfo() {
  const i = seasonIdx(), start = SEASON_EPOCH + i * SEASON_LEN * DAY, end = start + SEASON_LEN * DAY, th = SEASON_THEMES[i % SEASON_THEMES.length];
  const pts = logMemo('season' + i, () => { let p = 0; for (const l of S.log) if (l.t >= start && l.t < end) p += !l.m ? 1 : l.m === 'flip' ? (l.ms >= 1500 ? 1 : 0) : l.v === 'ok' ? 2 : 1; return p; });
  const tier = Math.min(SEASON_TIERS, Math.floor(pts / SEASON_STEP));
  const claimed = new Set(S.items.filter(x => String(x.id).startsWith(`season-${i}-`)).map(x => +String(x.id).split('-')[2]).concat(S.wallet.filter(w => String(w.id).startsWith(`season-${i}-`)).map(w => +String(w.id).split('-')[2])));
  const open = []; for (let t = 1; t <= tier; t++) if (!claimed.has(t)) open.push(t);
  return { i, n: i + 1, start, end, icon: th[0], name: th[1], color: th[2], pts, tier, into: pts - tier * SEASON_STEP, claimed, open, daysLeft: Math.ceil((end - Date.now()) / DAY) };
}
function seasonClaim(t) {
  const s = seasonInfo(); if (t > s.tier || s.claimed.has(t)) return null;
  const r = seasonReward(t), id = `season-${s.i}-${t}`;
  if (r.g) S.wallet.push({ id, n: r.g, why: 'sgold', t: Date.now() });
  else if (r.d) S.wallet.push({ id, n: r.d, why: 'season', t: Date.now() });
  else if (typeof CASES !== 'undefined' && CASES[r.c]) addItem('case', r.c, 1, id);
  return r;
}
if (typeof GOLD_WHY !== 'undefined') GOLD_WHY.add('sgold');
function seasonCardHTML(compact) {
  const s = seasonInfo(), full = s.tier >= SEASON_TIERS, nextR = full ? null : seasonReward(s.tier + 1);
  const bar = full ? 100 : Math.round(100 * s.into / SEASON_STEP);
  return `<div class="card season-cta" data-go="#/season" style="--sc:${s.color}"><div class="row nowrap" style="gap:12px"><span class="se-ic">${s.icon}</span>
    <div class="grow"><b>Sezon ${s.n}: ${esc(s.name)}</b><div class="small muted">poziom ${s.tier}/${SEASON_TIERS} · koniec za ${s.daysLeft} ${plural(s.daysLeft, 'dzień', 'dni', 'dni')}</div>
    <div class="se-bar"><i style="width:${bar}%"></i></div><div class="small muted">${full ? 'Komplet! Nowy sezon niedługo.' : `do poziomu ${s.tier + 1}: ${SEASON_STEP - s.into} pkt → ${seasonRewardTxt(nextR)}`}</div></div>
    ${s.open.length ? `<span class="se-open">${s.open.length}</span>` : '<span>›</span>'}</div>${compact ? '' : ''}</div>`;
}
ROUTES.season = () => {
  const s = seasonInfo();
  const rows = Array.from({ length: SEASON_TIERS }, (_, k) => k + 1).map(t => {
    const r = seasonReward(t), got = s.claimed.has(t), can = t <= s.tier && !got, big = t % 5 === 0;
    return `<div class="se-t${got ? ' got' : can ? ' can' : t === s.tier + 1 ? ' next' : ''}${big ? ' big' : ''}"><span class="se-n">${t}</span><span class="grow se-r">${seasonRewardTxt(r)}</span>
      ${got ? '<span class="small muted">✓ odebrane</span>' : can ? `<button class="sm primary" data-act="season-claim" data-t="${t}">Odbierz</button>` : `<small class="muted">${t * SEASON_STEP} pkt</small>`}</div>`;
  }).join('');
  return { tab: 'profile', html: `<div class="row nowrap"><button class="iconbtn" data-go="#/quests">‹</button><h1 class="grow">Sezon ${s.n}</h1></div>
    <div class="se-hero" style="--sc:${s.color}"><span class="se-big">${s.icon}</span><div><b>${esc(s.name)}</b><small>${new Date(s.start).toLocaleDateString('pl', { day: 'numeric', month: 'short' })} – ${new Date(s.end - DAY).toLocaleDateString('pl', { day: 'numeric', month: 'short' })} · zostało ${s.daysLeft} ${plural(s.daysLeft, 'dzień', 'dni', 'dni')}</small></div>
      <div class="se-pts"><b>${s.pts}</b><small>pkt sezonu</small></div></div>
    <p class="small muted">Punkty zdobywasz nauką: fiszka wpisana dobrze = 2 pkt, inna odpowiedź albo przewinięta fiszka = 1 pkt (przeklikane się nie liczą). Co ${SEASON_STEP} pkt nowy poziom. Na ${SEASON_TIERS}. poziomie: 👑 Skarbiec legend. Po 4 tygodniach ścieżka startuje od nowa z nowym motywem – nieodebrane nagrody przepadają.</p>
    ${s.open.length > 1 ? `<button class="primary block" data-act="season-claim" data-t="all">🎁 Odbierz wszystko (${s.open.length})</button><div class="spacer"></div>` : ''}
    <div class="card se-track">${rows}</div>` };
};
Object.assign(ACTIONS, {
  'season-claim': el => {
    const s = seasonInfo(), ts = el.dataset.t === 'all' ? s.open : [+el.dataset.t], got = ts.map(seasonClaim).filter(Boolean);
    if (!got.length) return; save();
    if (typeof celebrate === 'function') celebrate(`🗓️ Nagrody sezonu`, got.map(seasonRewardTxt).join(' · '));
    if (got.some(r => r.c === 'royal') && typeof confetti === 'function') confetti(160);
    render();
  },
});
// karta sezonu w Zadaniach, a na Starcie tylko gdy jest coś do odebrania
const seQuests0 = ROUTES.quests;
ROUTES.quests = (...a) => { const v = seQuests0(...a); if (!v?.html) return v; const i = v.html.indexOf('</div>'); return { ...v, html: v.html.slice(0, i + 6) + seasonCardHTML() + v.html.slice(i + 6) }; };
if (typeof homeExtrasHTML === 'function') { const seHome0 = homeExtrasHTML; homeExtrasHTML = function () { let h = seHome0(); try { if (appMode() === 'full' && seasonInfo().open.length) h = seasonCardHTML() + h; } catch { /* */ } return h; }; }

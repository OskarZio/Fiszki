'use strict';
/* 🏰 Strażnica – gra obronna na fiszkach (admin + testerzy z panelu admina).
   Drogą na pergaminowej mapie schodzą Kleksy (plamy atramentu = zapominanie); każdy niesie jedną fiszkę.
   Dobra odpowiedź = strzał piórem (wpisana trafia mocniej). Zła = Kleks wścieka się i przyspiesza, gra na chwilę staje
   i pokazuje poprawną odpowiedź, a ta fiszka wraca później w tej samej grze. Kleks przy bramie zabiera serce z murów.
   8 fal, w 4. i 8. Wielki Kleks (3 trafienia, każde inną fiszką). Między falami wybierasz 1 z 3 ulepszeń.
   Zaległe fiszki liczą się jak powtórki. Gra chodzi we własnej pętli – ekran nie jest rysowany od nowa co klatkę. */
const szOn = () => typeof testOn === 'function' ? testOn('straz') : typeof IS_ADMIN !== 'undefined' && IS_ADMIN === true;
const SZ_WAVES = 8, SZ_HEARTS = 5, SZ_HEARTS_MAX = 7;
const SZ_T = {
  n: { n: 'Kleks', hp: 1, sp: 1, pts: 10 },
  f: { n: 'Szybki kleks', hp: 1, sp: 1.45, pts: 14 },
  a: { n: 'Kleks pancerny', hp: 2, sp: .82, pts: 22 },
  b: { n: 'Wielki Kleks', hp: 3, sp: .5, pts: 60 },
};
// ulepszenia strażnicy (między falami wybierasz 1 z 3; max = ile razy można wziąć)
const SZ_PERKS = {
  wall:   { ic: '🧱', n: 'Wyższy mur', d: '+1 serce murów (teraz i na stałe)', max: 2 },
  tar:    { ic: '🛢️', n: 'Smoła na drodze', d: 'Kleksy idą o 12% wolniej', max: 3 },
  eye:    { ic: '🦅', n: 'Sokole oko', d: 'W ABCD znika jedna zła odpowiedź', max: 2 },
  ball:   { ic: '🏹', n: 'Balista', d: 'Co 5. dobra odpowiedź trafia też kolejnego Kleksa', max: 1 },
  bell:   { ic: '🔔', n: 'Mroźny dzwon', d: 'Po błędzie wszystkie Kleksy zamierają na 3 s', max: 1 },
  horn:   { ic: '📯', n: 'Róg zwycięstwa', d: 'Seria daje o połowę więcej punktów', max: 2 },
  scribe: { ic: '🪶', n: 'Skryba', d: 'Wpisana odpowiedź trafia za 3 i zamraża cel na 2 s', max: 1 },
  medic:  { ic: '🩹', n: 'Medyk', d: 'Fala bez straty serca oddaje 1 serce', max: 1 },
};
let SZ = null, SZ_RAF = 0, SZ_ELS = new Map(), SZ_OPT = { deck: 'all', typing: false };
const szStats = () => (S.stats.straz = S.stats.straz || { runs: 0, wins: 0, bestWave: 0, bestScore: 0 });
const szCard = id => typeof cardById === 'function' ? cardById(id) : S.cards.find(c => c.id === id);
const szPerk = k => SZ?.perks[k] || 0;
// droga: sinusoida od górnej krawędzi do bramy na dole (p = 0…1) – ta sama funkcja rysuje drogę i prowadzi Kleksy
const szPos = p => ({ x: 50 + 30 * Math.sin(p * Math.PI * 3), y: 11 + p * 75 });
const szTraverse = w => (34 - 1.6 * w) * (SZ.typing ? 1.5 : 1);            // sekundy na przejście całej drogi
const szGap = w => Math.max(3.4, 6 - .3 * w) * (SZ.typing ? 1.4 : 1);      // sekundy między Kleksami

function szPool(deckId) {
  const ok = c => !c.sus && (deckId === 'all' || c.deckId === deckId) && (() => { const a = cardView(c).ans; return a && a.trim() && a.length <= 160; })();
  const cs = S.cards.filter(ok), now = Date.now(), due = c => c.srs.state !== 'new' && c.srs.due <= now;
  return [...shuffle(cs.filter(due)), ...shuffle(cs.filter(c => !due(c)))].map(c => c.id);
}
function szStart(deckId, typing) {
  const pool = szPool(deckId);
  if (pool.length < 8) return toast('Za mało fiszek – potrzeba min. 8 (z krótką odpowiedzią)', 4000);
  SZ = { deckId, typing: !!typing, pool, queue: pool.slice(), retry: [], wave: 0, phase: 'play', enemies: [], target: null, hearts: SZ_HEARTS, maxHearts: SZ_HEARTS, score: 0, combo: 0, best: 0,
    ok: 0, bad: 0, okRun: 0, missed: [], perks: {}, plan: [], spawnT: 0, kills: 0, waveN: 0, lostInWave: 0, freeze: 0, uid: 0, spawned: 0, banner: null, paused: false, typeNow: !!typing, flash: null };
  szStats().runs++; save();
  szWaveStart(); render();
}
// następna fiszka: najpierw te, na których się pomyliłeś (po przerwie min. 3 innych), potem talia w kółko
function szNextCard() {
  const G = SZ, r = G.retry.findIndex(x => G.spawned - x.at >= 3), onField = new Set(G.enemies.map(e => e.card));
  if (r >= 0 && !onField.has(G.retry[r].id)) return { id: G.retry.splice(r, 1)[0].id, back: true };
  for (let k = 0; k < G.pool.length + 2; k++) { if (!G.queue.length) G.queue = shuffle(G.pool.slice()); const id = G.queue.shift(); if (!onField.has(id)) return { id }; }
  return { id: G.pool[0] };
}
function szGive(e) {   // przypisz Kleksowi fiszkę i (jeśli się da) 4 odpowiedzi
  const G = SZ, nx = szNextCard(), c = szCard(nx.id); e.card = nx.id; e.back = !!nx.back; G.spawned++;
  e.opts = G.typing || typeof kumOpts !== 'function' ? null : kumOpts(c); e.hidden = []; e.pick = null; e.since = performance.now();
  if (e.opts && szPerk('eye')) { const ans = cardView(c).ans; e.hidden = shuffle(e.opts.map((o, i) => i).filter(i => norm(e.opts[i]) !== norm(ans))).slice(0, szPerk('eye')); }
}
function szWaveStart() {
  const G = SZ; G.wave++; const w = G.wave, boss = w === 4 || w === SZ_WAVES, n = 4 + w - (boss ? 3 : 0), plan = [];
  for (let i = 0; i < n; i++) { const r = Math.random(); plan.push(w >= 3 && r < .2 ? 'a' : w >= 2 && r < .45 ? 'f' : 'n'); }
  if (boss) plan.push('b');
  G.plan = plan; G.waveN = plan.length; G.kills = 0; G.lostInWave = 0; G.spawnT = 1.4; G.phase = 'play';
  G.banner = { t: performance.now(), txt: `Fala ${w}/${SZ_WAVES}`, sub: boss ? 'Nadchodzi Wielki Kleks!' : `${plan.length} ${plural(plan.length, 'Kleks', 'Kleksy', 'Kleksów')} na drodze` };
}
function szSpawn() {
  const G = SZ, type = G.plan.shift(), T = SZ_T[type];
  const e = { id: ++G.uid, type, hp: T.hp, max: T.hp, p: 0, sp: T.sp, mad: false, frozen: 0, used: [] };
  szGive(e); G.enemies.push(e); szAddEl(e);
  if (!szTargetE()) szSetTarget(e.id);
}
const szTargetE = () => SZ.enemies.find(e => e.id === SZ.target) || null;
function szSetTarget(id) { const G = SZ; G.target = id; const e = szTargetE(); if (e) e.since = performance.now(); G.typeNow = G.typing || !(e && e.opts); szMarkTarget(); szPanel(); }
function szAutoTarget() { const G = SZ, e = G.enemies.slice().sort((a, b) => b.p - a.p)[0]; szSetTarget(e ? e.id : null); }

// ---------- pętla gry: tylko przesuwa Kleksy i pilnuje fal; nic nie przerysowuje
function szTick(ts) {
  const G = SZ; SZ_RAF = 0;
  if (!G || G.phase === 'end' || parseRoute().parts[0] !== 'straz' || !document.getElementById('sz-root')) return;
  const dt = Math.min(.05, (ts - (G.last || ts)) / 1000); G.last = ts;
  if (G.phase === 'play' && !G.paused && !document.hidden) {
    const frozenAll = ts < G.freeze, speed = Math.pow(.88, szPerk('tar')) / szTraverse(G.wave);
    if (G.plan.length) { G.spawnT -= dt; if (G.spawnT <= 0 && G.enemies.length < 6) { szSpawn(); G.spawnT = szGap(G.wave); } }
    for (const e of G.enemies.slice()) {
      if (!frozenAll && ts >= e.frozen) e.p += dt * speed * e.sp * (e.mad ? 1.3 : 1);
      if (e.p >= 1) { szLeak(e); continue; }
      const el = SZ_ELS.get(e.id); if (el) { const q = szPos(e.p); el.style.left = q.x + '%'; el.style.top = q.y + '%'; el.classList.toggle('ice', frozenAll || ts < e.frozen); }
    }
    if (!G.plan.length && !G.enemies.length && G.phase === 'play') szWaveEnd();
  }
  const b = document.getElementById('sz-banner'); if (b && G.banner && ts - G.banner.t > 1700) { b.remove(); G.banner = null; }
  SZ_RAF = requestAnimationFrame(szTick);
}
function szLoop() { if (!SZ_RAF && SZ && SZ.phase !== 'end') { SZ.last = 0; SZ_RAF = requestAnimationFrame(szTick); } }

// ---------- odpowiedź
function szAnswer(ok, how, verdict) {
  const G = SZ, e = szTargetE(); if (!G || !e || G.phase !== 'play') return;
  const c = szCard(e.card), now = Date.now(), ms = Math.min(60000, performance.now() - e.since);
  if (c && c.srs.due <= now && c.srs.state !== 'new') {   // zaległa fiszka = prawdziwa powtórka
    const g = ok ? (how === 'type' && verdict === 'close' ? 2 : 3) : 1;
    S.log.push({ id: uid(), c: c.id, d: c.deckId, t: now, g, n: 0, ms, m: how === 'type' ? 'type' : 'flip', sz: 1, ...(how === 'type' ? { v: verdict } : {}) });
    c.srs = schedule(c.srs, g); touch(c); emit('review', c, g, false);
  } else (S.tlog = S.tlog || []).push({ id: uid(), t: now, d: c?.deckId, ms });
  save();
  if (ok) {
    G.ok++; G.okRun++; G.combo++; G.best = Math.max(G.best, G.combo);
    const dmg = how === 'type' ? (szPerk('scribe') ? 3 : 2) : 1;
    if (how === 'type' && szPerk('scribe')) e.frozen = performance.now() + 2000;
    szShoot(e); szHit(e, dmg, how, ms);
    if (szPerk('ball') && G.okRun % 5 === 0) { const o = G.enemies.filter(x => x !== e && x.hp > 0).sort((a, b) => b.p - a.p)[0]; if (o) { szShoot(o, true); szHit(o, 1, 'ball', 9999); } }
    G.flash = 'ok';
    if (G.enemies.includes(e)) { e.used.push(e.card); szGive(e); szSetTarget(e.id); } else szAutoTarget();
    szHud();
  } else {
    G.bad++; G.combo = 0; G.missed.push(e.card); G.retry.push({ id: e.card, at: G.spawned });
    e.mad = true; e.p = Math.min(.97, e.p + .1); const el = SZ_ELS.get(e.id); if (el) el.classList.add('mad');
    if (szPerk('bell')) G.freeze = performance.now() + 3000 + 1700;
    // ⏸ gra staje na chwilę, żeby zdążyć przeczytać poprawną odpowiedź
    G.phase = 'reveal'; G.reveal = { ans: cardView(c).ans, typed: how === 'type' }; szHud(); szPanel();
    const me = G; setTimeout(() => { if (SZ !== me || me.phase !== 'reveal') return; me.phase = 'play'; me.reveal = null; if (me.enemies.includes(e)) { szGive(e); szSetTarget(e.id); } else szAutoTarget(); }, 1700);
  }
}
function szHit(e, dmg, how, ms) {
  const G = SZ, T = SZ_T[e.type]; e.hp -= dmg;
  const el = SZ_ELS.get(e.id);
  if (e.hp > 0) { if (el) { el.classList.remove('hurt'); void el.offsetWidth; el.classList.add('hurt'); el.querySelector('.sz-hp').textContent = '♦'.repeat(e.hp); } return; }
  const gain = Math.round((T.pts + (ms < 3000 ? 5 : 0)) * (1 + G.combo * (.1 + .05 * szPerk('horn'))) * (how === 'type' ? 1.5 : 1));
  G.score += gain; G.kills++; G.enemies = G.enemies.filter(x => x !== e); SZ_ELS.delete(e.id);
  if (el) { el.classList.add('dead'); el.removeAttribute('data-act'); el.insertAdjacentHTML('beforeend', `<b class="sz-gain">+${gain}</b>`); setTimeout(() => el.remove(), 520); }
}
function szLeak(e) {   // Kleks doszedł do bramy
  const G = SZ; G.enemies = G.enemies.filter(x => x !== e); const el = SZ_ELS.get(e.id); SZ_ELS.delete(e.id); if (el) el.remove();
  G.hearts--; G.lostInWave++; G.combo = 0; G.kills++; G.retry.push({ id: e.card, at: G.spawned }); G.missed.push(e.card);
  const root = document.getElementById('sz-root'); if (root) { root.classList.remove('leak'); void root.offsetWidth; root.classList.add('leak'); }
  if (G.hearts <= 0) return szEnd(false);
  if (G.target === e.id) szAutoTarget(); szHud();
}
function szWaveEnd() {
  const G = SZ;
  if (szPerk('medic') && !G.lostInWave && G.hearts < G.maxHearts) G.hearts++;
  if (G.wave >= SZ_WAVES) return szEnd(true);
  const opts = shuffle(Object.keys(SZ_PERKS).filter(k => szPerk(k) < SZ_PERKS[k].max && !(k === 'eye' && G.typing) && !(k === 'scribe' && false))).slice(0, 3);
  G.phase = 'pick'; G.pick = opts; szHud(); szOverlay();
}
function szEnd(win) {
  const G = SZ; cancelAnimationFrame(SZ_RAF); SZ_RAF = 0;
  const cleared = win ? SZ_WAVES : G.wave - 1, gold = Math.min(500, cleared * 20 + (win ? 120 : 0)), xp = Math.min(260, cleared * 12 + (win ? 60 : 0));
  if (gold) S.wallet.push({ id: 'sz-' + uid(), n: gold, why: 'boss-sz', t: Date.now() });
  if (xp && typeof giveXP === 'function') giveXP(xp, 'sz');
  const st = szStats(); if (win) st.wins = (st.wins || 0) + 1; st.bestWave = Math.max(st.bestWave || 0, cleared); st.bestScore = Math.max(st.bestScore || 0, G.score);
  G.phase = 'end'; G.result = { win, cleared, gold, xp, record: G.score >= st.bestScore && G.score > 0 }; save(); render();
}

// ---------- rysowanie (tylko to, co się zmieniło)
function szAddEl(e) {
  const f = document.getElementById('sz-field'); if (!f) return;
  const q = szPos(e.p), el = document.createElement('button');
  el.className = `sz-e t-${e.type}${e.mad ? ' mad' : ''}${e.back ? ' back' : ''}`; el.dataset.act = 'sz-pick'; el.dataset.e = e.id; el.style.left = q.x + '%'; el.style.top = q.y + '%';
  el.setAttribute('aria-label', SZ_T[e.type].n);
  el.innerHTML = `<i class="sz-blob"><i></i><i></i></i>${e.type === 'b' ? '<em class="sz-crown">👑</em>' : ''}<span class="sz-hp">${e.max > 1 ? '♦'.repeat(e.hp) : ''}</span>`;
  f.appendChild(el); SZ_ELS.set(e.id, el); szMarkTarget();
}
function szMarkTarget() { for (const [id, el] of SZ_ELS) el.classList.toggle('on', id === SZ.target); }
function szShoot(e, second) {   // pióro leci od bramy do Kleksa
  const f = document.getElementById('sz-field'); if (!f) return; const a = szPos(1.06), b = szPos(e.p), q = document.createElement('i');
  q.className = 'sz-quill' + (second ? ' two' : ''); q.style.left = a.x + '%'; q.style.top = a.y + '%'; q.style.setProperty('--dx', (b.x - a.x) * f.clientWidth / 100 + 'px'); q.style.setProperty('--dy', (b.y - a.y) * f.clientHeight / 100 + 'px');
  f.appendChild(q); setTimeout(() => q.remove(), 420);
}
function szHud() {
  const G = SZ, h = document.getElementById('sz-hud'); if (!h || !G) return;
  h.innerHTML = `<button class="sz-x" data-act="sz-quit" aria-label="Zakończ">✕</button>
    <div class="sz-wave"><b>Fala ${G.wave}/${SZ_WAVES}</b><span class="sz-wbar"><i style="width:${G.waveN ? Math.min(100, G.kills / G.waveN * 100) : 0}%"></i></span></div>
    <div class="sz-hearts" aria-label="Mury: ${G.hearts} z ${G.maxHearts}">${Array.from({ length: G.maxHearts }, (_, i) => `<i class="${i < G.hearts ? 'on' : ''}"></i>`).join('')}</div>
    <div class="sz-score"><b>${G.score.toLocaleString('pl')}</b>${G.combo >= 2 ? `<small>seria ×${G.combo}</small>` : '<small>pkt</small>'}</div>`;
  const pk = document.getElementById('sz-perks'); if (pk) pk.innerHTML = Object.keys(G.perks).map(k => `<span title="${esc(SZ_PERKS[k].n)}: ${esc(SZ_PERKS[k].d)}">${SZ_PERKS[k].ic}${G.perks[k] > 1 ? `<i>${G.perks[k]}</i>` : ''}</span>`).join('');
}
function szPanel() {
  const G = SZ, P = document.getElementById('sz-panel'); if (!P || !G) return;
  const e = szTargetE();
  if (!e) { P.innerHTML = `<div class="sz-q idle"><small>Strażnica</small><b>${G.plan.length ? 'Cisza przed burzą…' : 'Droga pusta.'}</b></div>`; return; }
  const c = szCard(e.card), v = cardView(c), ans = v.ans, d = deckById(c.deckId), R = G.phase === 'reveal' ? G.reveal : null, typing = G.typeNow || !e.opts;
  const head = `<div class="sz-q${R ? ' miss' : ''}${G.flash === 'ok' ? ' hit' : ''}"><small>${e.back ? '↩ wraca · ' : ''}${SZ_T[e.type].n}${e.max > 1 ? ` · jeszcze ${e.hp} ${plural(e.hp, 'trafienie', 'trafienia', 'trafień')}` : ''} · ${esc((d?.name || '').replace(/^🏫\s*/, '').slice(0, 24))}</small><div class="sz-qt">${v.q}</div></div>`;
  G.flash = null;
  if (R) { P.innerHTML = head + `<div class="sz-reveal"><small>Poprawna odpowiedź</small><b>${esc(ans)}</b><span>Ta fiszka jeszcze do Ciebie wróci.</span></div>`; return; }
  P.innerHTML = head + (typing
    ? `<div class="sz-type"><input id="sz-in" placeholder="Wpisz odpowiedź…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="send"><button data-act="sz-send" aria-label="Strzał">🪶</button></div>${e.opts && !G.typing ? '<button class="sz-sw" data-act="sz-mode">↩ Wróć do ABCD</button>' : '<span class="sz-note">Wpisana odpowiedź trafia za 2 i daje ×1,5 punktów</span>'}`
    : `<div class="sz-opts">${e.opts.map((o, i) => e.hidden.includes(i) ? '<span class="sz-o gone"></span>' : `<button class="sz-o" data-act="sz-opt" data-i="${i}"><i>${'ABCD'[i]}</i><span>${esc(o)}</span></button>`).join('')}</div><button class="sz-sw" data-act="sz-mode">⌨️ Wpiszę odpowiedź – trafia za 2</button>`);
  const inp = document.getElementById('sz-in'); if (inp) { inp.onkeydown = ev => { if (ev.key === 'Enter') ACTIONS['sz-send'](); }; if (G.typing || G.typeNow) inp.focus({ preventScroll: true }); }
}
function szOverlay() {
  const G = SZ, root = document.getElementById('sz-root'); if (!root) return; root.querySelector('.sz-ov')?.remove();
  if (G.phase !== 'pick') return;
  const d = document.createElement('div'); d.className = 'sz-ov';
  d.innerHTML = `<div class="sz-ov-in"><small>Fala ${G.wave} odparta${G.lostInWave ? '' : ' bez strat'}</small><h2>Ulepsz strażnicę</h2><div class="sz-picks">${G.pick.map(k => `<button class="sz-pk" data-act="sz-perk" data-k="${k}"><span class="sz-seal">${SZ_PERKS[k].ic}</span><b>${SZ_PERKS[k].n}</b><small>${SZ_PERKS[k].d}</small></button>`).join('')}</div></div>`;
  root.appendChild(d);
}
// osadzenie ekranu gry: odtwarza Kleksy z pamięci (także po przypadkowym przerysowaniu) i startuje pętlę
function szMount() {
  const G = SZ, f = document.getElementById('sz-field'); if (!G || !f) return;
  SZ_ELS = new Map(); f.querySelectorAll('.sz-e, .sz-quill').forEach(x => x.remove());
  for (const e of G.enemies) szAddEl(e);
  szHud(); szPanel(); szOverlay(); szLoop();
}
const szRoadSVG = () => { const pts = []; for (let i = 0; i <= 60; i++) { const q = szPos(i / 60 * 1.06); pts.push(q.x.toFixed(1) + ',' + q.y.toFixed(1)); }
  return `<svg class="sz-road" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline class="r1" points="${pts.join(' ')}"/><polyline class="r2" points="${pts.join(' ')}"/></svg>`; };
function szShellHTML() {
  const G = SZ, g = szPos(1.06), B = G.banner;
  return `<div class="sz" id="sz-root"><div class="sz-hud" id="sz-hud"></div>
    <div class="sz-field" id="sz-field">${szRoadSVG()}
      <span class="sz-deco d1">⛰️</span><span class="sz-deco d2">🌲</span><span class="sz-deco d3">🌲</span><span class="sz-deco d4">🧭</span>
      <div class="sz-gate" style="left:${g.x}%;top:${g.y}%"><span>🏰</span></div>
      <div class="sz-perks" id="sz-perks"></div>
      ${B ? `<div class="sz-banner" id="sz-banner"><b>${esc(B.txt)}</b><small>${esc(B.sub)}</small></div>` : ''}
    </div>
    <div class="sz-panel" id="sz-panel"></div></div>`;
}
function szIntroHTML() {
  const st = szStats(), decks = S.decks.filter(d => S.cards.some(c => c.deckId === d.id && !c.sus));
  return `<div class="row nowrap"><button class="iconbtn" data-go="#/boss">‹</button><h1 class="grow" style="margin:0">🏰 Strażnica</h1><span class="tag">${IS_ADMIN ? 'admin' : 'test'}</span></div>
  <div class="sz-intro"><div class="sz-intro-map">${szRoadSVG()}<i class="sz-blob demo b1"><i></i><i></i></i><i class="sz-blob demo b2"><i></i><i></i></i><span class="sz-gate demo"><span>🏰</span></span></div>
    <h2>Obroń strażnicę przed Kleksami</h2>
    <p>Plamy atramentu chcą zalać Twoje notatki. Każdy Kleks niesie <b>jedną fiszkę</b> – odpowiedz, zanim dojdzie do bramy.</p>
    <ul class="sz-how">
      <li><span>🪶</span><div><b>Dobra odpowiedź = strzał.</b> Wpisana trafia za 2 i daje więcej punktów.</div></li>
      <li><span>😡</span><div><b>Błąd rozwściecza Kleksa.</b> Gra na moment staje i pokazuje poprawną odpowiedź, a fiszka wróci do Ciebie później.</div></li>
      <li><span>❤️</span><div><b>Kleks przy bramie zabiera serce.</b> Masz ${SZ_HEARTS}. Stuknij dowolnego Kleksa, żeby wziąć go na cel.</div></li>
      <li><span>🧱</span><div><b>${SZ_WAVES} fal</b>, w 4. i 8. Wielki Kleks. Po każdej fali wybierasz ulepszenie.</div></li>
    </ul>
    <label class="small muted">Z jakich fiszek?</label>
    <select id="sz-deck"><option value="all">Wszystkie talie</option>${decks.map(d => `<option value="${d.id}" ${SZ_OPT.deck === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select>
    <label class="sz-check"><input type="checkbox" id="sz-typing" ${SZ_OPT.typing ? 'checked' : ''}><span><b>⌨️ Tylko wpisywanie</b><small>do języków – Kleksy idą wtedy wolniej</small></span></label>
    <button class="sz-start" data-act="sz-start">Na mury!</button>
    ${st.runs ? `<p class="small sz-rec">Obrony: ${st.runs} · wygrane: ${st.wins || 0} · najdalej: fala ${st.bestWave || 0} · rekord: ${(st.bestScore || 0).toLocaleString('pl')} pkt</p>` : ''}
    <p class="small sz-rec">Zaległe fiszki liczą się tu jak zwykłe powtórki.</p></div>`;
}
function szEndHTML() {
  const G = SZ, R = G.result, total = G.ok + G.bad, acc = total ? Math.round(G.ok / total * 100) : null, ids = [...new Set(G.missed)];
  const rows = ids.map(id => { const c = szCard(id); if (!c) return ''; const v = cardView(c); return `<li><span class="rq">${esc(stripHtml(v.label || v.q || '').slice(0, 110))}</span><span class="ra">${esc(stripHtml(v.ans || '').slice(0, 140))}</span></li>`; }).filter(Boolean);
  return `<div class="sz-intro sz-end"><div class="sz-endic">${R.win ? '🏰' : '🌊'}</div>
    <h2>${R.win ? 'Strażnica obroniona!' : `Mury padły w fali ${G.wave}`}</h2>
    <div class="sz-endscore"><b>${G.score.toLocaleString('pl')}</b><small>punktów${R.record ? ' · nowy rekord!' : ''}</small></div>
    <div class="sz-endstats"><span><b>${R.cleared}/${SZ_WAVES}</b>fal</span><span><b>${acc == null ? '–' : acc + '%'}</b>celność</span><span><b>×${G.best}</b>najdłuższa seria</span></div>
    <p class="small">Nagroda: <b>+${R.gold} 🪙 złota</b> · <b>+${R.xp} XP</b></p>
    ${rows.length ? `<details class="fr-miss" open><summary>📖 Do zapamiętania: ${rows.length} ${plural(rows.length, 'fiszka', 'fiszki', 'fiszek')}</summary><ul>${rows.slice(0, 12).join('')}</ul></details>` : total >= 5 ? '<div class="fr-clean">💯 Ani jednej pomyłki.</div>' : ''}
    <div class="row" style="margin-top:12px"><button class="sz-start grow" data-act="sz-again">Jeszcze raz</button><button class="grow" data-act="sz-leave">Wyjdź</button></div></div>`;
}
ROUTES.straz = () => {
  if (!szOn()) return { tab: 'arena', html: '<p class="muted center" style="padding:40px 0">Ten tryb jest jeszcze w testach.</p>' };
  if (!SZ) return { tab: 'arena', html: szIntroHTML() };
  if (SZ.phase === 'end') return { tab: 'arena', focus: true, html: szEndHTML() };
  onMount(szMount);
  return { tab: 'arena', focus: true, html: szShellHTML() };
};
// wejście w zakładce Przygoda – admin i testerzy
const szBoss0 = ROUTES.boss;
ROUTES.boss = (...a) => { const v = szBoss0(...a); if (!v?.html || !szOn() || (a[0] && a[0][1])) return v; const st = S.stats.straz || {};
  return { ...v, html: v.html.replace('<div class="card row nowrap coop-cta"', `<div class="card row nowrap sz-cta" data-go="#/straz"><span class="sz-cta-ic">🏰</span><div class="grow"><b>Strażnica <span class="tag">${IS_ADMIN ? 'admin' : 'test'}</span></b><div class="small muted">Obroń mury przed Kleksami – 8 fal, ulepszenia, Wielki Kleks${st.bestScore ? ` · rekord ${st.bestScore.toLocaleString('pl')} pkt` : ''}</div></div><span>›</span></div><div class="card row nowrap coop-cta"`) }; };
document.addEventListener('visibilitychange', () => { if (SZ) SZ.last = 0; });

Object.assign(ACTIONS, {
  'sz-start': () => { SZ_OPT = { deck: $('#sz-deck')?.value || 'all', typing: !!$('#sz-typing')?.checked }; szStart(SZ_OPT.deck, SZ_OPT.typing); },
  'sz-pick': el => { const G = SZ; if (!G || G.phase !== 'play') return; const id = +el.dataset.e; if (G.enemies.some(e => e.id === id) && id !== G.target) szSetTarget(id); },
  'sz-opt': el => { const G = SZ, e = G && szTargetE(); if (!e || !e.opts || G.phase !== 'play') return; const i = +el.dataset.i; szAnswer(norm(e.opts[i]) === norm(cardView(szCard(e.card)).ans), 'abcd'); },
  'sz-send': () => { const G = SZ, e = G && szTargetE(); if (!e || G.phase !== 'play') return; const t = $('#sz-in')?.value || ''; if (!t.trim()) return; const v = checkAnswer(t, cardView(szCard(e.card)).ans); szAnswer(v !== 'wrong', 'type', v); },
  'sz-mode': () => { const G = SZ; if (!G || G.typing || G.phase !== 'play') return; G.typeNow = !G.typeNow; szPanel(); },
  'sz-perk': el => { const G = SZ, k = el.dataset.k; if (!G || G.phase !== 'pick' || !SZ_PERKS[k]) return; G.perks[k] = (G.perks[k] || 0) + 1;
    if (k === 'wall') { G.maxHearts = Math.min(SZ_HEARTS_MAX, G.maxHearts + 1); G.hearts = Math.min(G.maxHearts, G.hearts + 1); }
    document.querySelector('#sz-root .sz-ov')?.remove(); szWaveStart();
    const f = document.getElementById('sz-field'); if (f && G.banner) f.insertAdjacentHTML('beforeend', `<div class="sz-banner" id="sz-banner"><b>${esc(G.banner.txt)}</b><small>${esc(G.banner.sub)}</small></div>`);
    szHud(); szPanel(); },
  'sz-quit': () => { const G = SZ; if (!G) return go('#/boss'); G.paused = true;
    askBox({ icon: '🏰', title: 'Opuścić mury?', intro: 'Dostaniesz nagrodę za odparte fale.', ok: 'Zakończ', cancel: 'Bronię dalej', danger: true }).then(ok => { if (SZ !== G) return; G.paused = false; G.last = 0; if (ok && G.phase !== 'end') szEnd(false); }); },
  'sz-again': () => { const o = SZ_OPT; SZ = null; szStart(o.deck, o.typing); },
  'sz-leave': () => { SZ = null; go('#/boss'); },
});

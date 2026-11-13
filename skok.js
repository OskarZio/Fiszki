'use strict';
/* 🐾 Wspinaczka – zręcznościowa gra beta (admin + testerzy z panelu admina), dla zabawy – bez fiszek.
   Bohater (z aktualnym skinem) sam odbija się od książek; sterujesz tylko w lewo / w prawo (dotyk po bokach ekranu albo strzałki).
   Książki: zwykłe, ruchome, kruche kartki (pękają po jednym skoku) i ze sprężyną (wysoki skok). Kryształy dają punkty.
   Im wyżej, tym trudniej i tym ciemniejsze niebo – od dnia, przez zachód słońca, po kosmos. Upadek poniżej ekranu kończy bieg.
   Nagroda: trochę złota za wynik, z dziennym limitem. Gra rysuje się na <canvas> we własnej pętli. */
const skOn = () => typeof testOn === 'function' ? testOn('skok') : typeof IS_ADMIN !== 'undefined' && IS_ADMIN === true;
const SK_P = { g: 1900, jump: 780, spring: 1260, vx: 340, acc: 2600, heroW: 34 };
const SK_DAILY_GOLD = 120, SK_RUN_GOLD = 40;
const SK_COLORS = ['#e5484d', '#f59e0b', '#22a06b', '#2f6fed', '#8b5cf6', '#ec4899', '#0ea5a4'];
let SKG = null, SK_RAF = 0, SK_KEYS = { l: false, r: false };
const skStats = () => (S.stats.skok = S.stats.skok || { runs: 0, best: 0, gems: 0 });
const skToday = () => { const d = dayKey(Date.now()), st = skStats(); if (st.day !== d) { st.day = d; st.dayGold = 0; } return st; };
const skRnd = (a, b) => a + Math.random() * (b - a);

function skNew(w, h) {
  const G = { phase: 'play', w, h, x: w / 2, y: 60, vx: 0, vy: SK_P.jump, cam: 0, top: 40, plats: [], maxY: 0, gems: 0, dir: 0, face: 1, t0: performance.now(), last: 0, score: 0, puffs: [], n: 0,
    clouds: Array.from({ length: 7 }, (_, i) => ({ x: Math.random() * w, y: i * 190 + Math.random() * 120, s: skRnd(.7, 1.5) })), stars: Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), r: skRnd(.6, 1.8) })) };
  G.plats.push({ x: w / 2 - 50, y: 40, w: 100, type: 'n', c: 3 });
  skGen(G); return G;
}
// dokładanie książek nad kamerą: odstępy rosną z wysokością, ale zawsze da się doskoczyć
function skGen(G) {
  while (G.top < G.cam + G.h * 1.6) {
    const H = G.top, hard = Math.min(1, H / 9000), gap = skRnd(52, 78 + 52 * hard), pw = Math.max(54, 92 - 34 * hard), r = Math.random();
    const y = H + gap, type = H > 1400 && r < .1 + .14 * hard ? 'f' : H > 600 && r < .3 + .25 * hard ? 'm' : 'n';
    const p = { x: skRnd(6, G.w - pw - 6), y, w: pw, type, c: G.n++ % SK_COLORS.length };
    if (type === 'm') { p.vx = skRnd(50, 90 + 80 * hard) * (Math.random() < .5 ? -1 : 1); }
    if (type !== 'f' && Math.random() < .08) p.spring = true;
    if (Math.random() < .16) p.gem = true;
    G.plats.push(p); G.top = y;
    // kruchą kartkę zawsze ubezpiecza zwykła książka w zasięgu skoku
    if (type === 'f' && Math.random() < .7) { G.plats.push({ x: skRnd(6, G.w - pw - 6), y: y + skRnd(8, 26), w: pw, type: 'n', c: G.n++ % SK_COLORS.length }); }
  }
  G.plats = G.plats.filter(p => p.y > G.cam - 80 && !(p.dead && p.fall < G.cam - 80));
}
function skTick(ts) {
  const G = SKG; SK_RAF = 0;
  const cv = document.getElementById('wsp-cv'); if (!G || !cv || parseRoute().parts[0] !== 'skok') return;
  const dt = Math.min(.033, (ts - (G.last || ts)) / 1000); G.last = ts;
  if (G.phase === 'play' && !document.hidden && !G.paused) {
    const P = SK_P, dir = (SK_KEYS.r ? 1 : 0) - (SK_KEYS.l ? 1 : 0) || G.dir;
    const want = dir * P.vx; G.vx += Math.max(-P.acc * dt, Math.min(P.acc * dt, want - G.vx)); if (dir) G.face = dir;
    const y0 = G.y; G.vy -= P.g * dt; G.x += G.vx * dt; G.y += G.vy * dt;
    if (G.x < -10) G.x += G.w + 20; else if (G.x > G.w + 10) G.x -= G.w + 20;
    for (const p of G.plats) {
      if (p.type === 'm') { p.x += p.vx * dt; if (p.x < 4 || p.x + p.w > G.w - 4) { p.vx = -p.vx; p.x = Math.max(4, Math.min(G.w - p.w - 4, p.x)); } }
      if (p.dead) { p.fall -= 520 * dt; continue; }
      if (G.vy < 0 && y0 >= p.y && G.y <= p.y && G.x > p.x - P.heroW * .35 && G.x < p.x + p.w + P.heroW * .35) {
        G.y = p.y; G.vy = p.spring ? P.spring : P.jump; G.puffs.push({ x: G.x, y: p.y, t: ts, big: !!p.spring }); p.hit = ts;
        if (p.type === 'f') { p.dead = true; p.fall = p.y; }
      }
      if (p.gem && Math.abs(G.x - (p.x + p.w / 2)) < 26 && Math.abs(G.y + 22 - (p.y + 34)) < 30) { p.gem = false; G.gems++; G.puffs.push({ x: p.x + p.w / 2, y: p.y + 34, t: ts, gem: true }); }
    }
    G.maxY = Math.max(G.maxY, G.y); if (G.y - G.cam > G.h * .56) G.cam = G.y - G.h * .56;
    G.score = Math.floor(G.maxY / 10) + G.gems * 25;
    skGen(G);
    if (G.y < G.cam - 70) skOver();
  }
  skDraw(G, cv, ts); skHero(G); skHud(G);
  if (G.phase === 'play') SK_RAF = requestAnimationFrame(skTick);
}
function skLoop() { if (!SK_RAF && SKG && SKG.phase === 'play') { SKG.last = 0; SK_RAF = requestAnimationFrame(skTick); } }
const skLerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const SK_SKY = [[0, [126, 205, 244], [222, 244, 250]], [2500, [70, 150, 230], [255, 214, 170]], [5500, [56, 44, 120], [240, 130, 140]], [9000, [12, 12, 40], [44, 30, 90]], [1e9, [6, 6, 22], [20, 14, 50]]];
function skSky(hh) { for (let i = 0; i < SK_SKY.length - 1; i++) { const a = SK_SKY[i], b = SK_SKY[i + 1]; if (hh < b[0]) { const t = (hh - a[0]) / (b[0] - a[0]); return [skLerp(a[1], b[1], t), skLerp(a[2], b[2], t)]; } } return [SK_SKY[4][1], SK_SKY[4][2]]; }
function skRR(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function skDraw(G, cv, ts) {
  const c = cv.getContext('2d'), d = G.dpr, W = G.w, H = G.h, sy = wy => H - (wy - G.cam);
  c.setTransform(d, 0, 0, d, 0, 0);
  const [top, bot] = skSky(G.cam), g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgb(${top})`); g.addColorStop(1, `rgb(${bot})`); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const night = Math.max(0, Math.min(1, (G.cam - 4200) / 3500));
  if (night > 0) { c.fillStyle = '#fff'; for (const s of G.stars) { c.globalAlpha = night * (.5 + .5 * Math.sin(ts / 600 + s.x * 40)); c.beginPath(); c.arc(s.x * W, (s.y * H + G.cam * .05) % H, s.r, 0, 7); c.fill(); } c.globalAlpha = 1; }
  c.fillStyle = `rgba(255,255,255,${.85 * (1 - night)})`;
  for (const cl of G.clouds) { const y = ((cl.y - G.cam * .35) % (H + 260) + H + 260) % (H + 260) - 130, x = cl.x, s = cl.s; for (const [ox, oy, rx, ry] of [[0, 0, 46, 18], [-30, 6, 28, 14], [32, 5, 30, 15]]) { c.beginPath(); c.ellipse(x + ox * s, y + oy * s, rx * s, ry * s, 0, 0, 7); c.fill(); } }
  for (const p of G.plats) {
    const y = sy(p.dead ? p.fall : p.y), bounce = p.hit && ts - p.hit < 140 ? 3 : 0; if (y < -30 || y > H + 30) continue;
    c.globalAlpha = p.dead ? Math.max(0, 1 - (p.y - p.fall) / 260) : 1;
    if (p.type === 'f') {   // krucha kartka
      c.fillStyle = '#fffaf0'; skRR(c, p.x, y + bounce, p.w, 11, 3); c.fill(); c.strokeStyle = 'rgba(43,42,74,.55)'; c.lineWidth = 1.2; c.setLineDash([4, 3]); c.stroke(); c.setLineDash([]);
      c.strokeStyle = 'rgba(43,42,74,.3)'; c.beginPath(); c.moveTo(p.x + 8, y + 5.5 + bounce); c.lineTo(p.x + p.w - 8, y + 5.5 + bounce); c.stroke();
    } else {                // książka: grzbiet, kartki, pasek
      const col = SK_COLORS[p.c];
      c.fillStyle = 'rgba(0,0,0,.18)'; skRR(c, p.x + 2, y + 4 + bounce, p.w, 15, 4); c.fill();
      c.fillStyle = col; skRR(c, p.x, y + bounce, p.w, 15, 4); c.fill();
      c.fillStyle = '#fffaf0'; c.fillRect(p.x + 5, y + 11 + bounce, p.w - 8, 3);
      c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(p.x + 9, y + bounce, 4, 11); c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(p.x + 18, y + 3 + bounce, p.w - 30, 2);
      if (p.type === 'm') { c.fillStyle = 'rgba(255,255,255,.9)'; const cx = p.x + p.w / 2, cy = y + 6 + bounce; c.beginPath(); c.moveTo(cx - 12, cy); c.lineTo(cx - 6, cy - 3.5); c.lineTo(cx - 6, cy + 3.5); c.moveTo(cx + 12, cy); c.lineTo(cx + 6, cy - 3.5); c.lineTo(cx + 6, cy + 3.5); c.fill(); }
      if (p.spring) { const sx = p.x + p.w * .5, k = p.hit && ts - p.hit < 160 ? 5 : 11; c.strokeStyle = '#444b6e'; c.lineWidth = 2.4; c.beginPath(); for (let i = 0; i <= 4; i++) c.lineTo(sx + (i % 2 ? 6 : -6), y - i * k / 4 + bounce); c.stroke(); c.fillStyle = '#e5484d'; skRR(c, sx - 9, y - k - 4 + bounce, 18, 5, 2); c.fill(); }
    }
    c.globalAlpha = 1;
    if (p.gem) { const gx = p.x + p.w / 2, gy = sy(p.y + 34) + Math.sin(ts / 260 + p.y) * 3; c.fillStyle = '#38bdf8'; c.beginPath(); c.moveTo(gx, gy - 11); c.lineTo(gx + 9, gy - 2); c.lineTo(gx, gy + 11); c.lineTo(gx - 9, gy - 2); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.moveTo(gx, gy - 11); c.lineTo(gx + 4, gy - 2); c.lineTo(gx, gy + 2); c.lineTo(gx - 9, gy - 2); c.closePath(); c.fill(); }
  }
  G.puffs = G.puffs.filter(p => ts - p.t < 380);
  for (const p of G.puffs) { const k = (ts - p.t) / 380, y = sy(p.y); c.globalAlpha = 1 - k;
    if (p.gem) { c.fillStyle = '#e0f2fe'; c.font = '800 15px Rubik, sans-serif'; c.textAlign = 'center'; c.fillText('+25', p.x, y - 16 * k); }
    else { c.fillStyle = '#fff'; for (const s of [-1, 1]) { c.beginPath(); c.arc(p.x + s * (8 + 18 * k) * (p.big ? 1.4 : 1), y - 2 - 4 * k, 5 * (1 - k) + 1, 0, 7); c.fill(); } } }
  c.globalAlpha = 1;
}
function skHero(G) {
  const el = document.getElementById('wsp-hero'); if (!el) return;
  const sq = G.vy > 520 ? 'scale(.92,1.1)' : G.vy < -700 ? 'scale(1.06,.94)' : '';
  el.style.transform = `translate(${G.x}px, ${G.h - (G.y - G.cam)}px) translate(-50%, -100%) scaleX(${G.face}) ${sq}`;
}
function skHud(G) { const s = document.getElementById('wsp-score'); if (s && s._v !== G.score) { s._v = G.score; s.textContent = G.score.toLocaleString('pl'); } const g = document.getElementById('wsp-gems'); if (g && g._v !== G.gems) { g._v = G.gems; g.textContent = G.gems; } }
function skOver() {
  const G = SKG; if (!G || G.phase !== 'play') return; G.phase = 'over';
  const st = skToday(), record = G.score > (st.best || 0), want = Math.min(SK_RUN_GOLD, Math.floor(G.score / 60)), gold = Math.max(0, Math.min(want, SK_DAILY_GOLD - (st.dayGold || 0)));
  st.runs = (st.runs || 0) + 1; st.best = Math.max(st.best || 0, G.score); st.gems = (st.gems || 0) + G.gems; st.dayGold = (st.dayGold || 0) + gold;
  if (gold) S.wallet.push({ id: 'wsp-' + uid(), n: gold, why: 'boss-sk', t: Date.now() });
  G.result = { gold, record, capped: want > gold, left: Math.max(0, SK_DAILY_GOLD - st.dayGold) }; save();
  const root = document.getElementById('wsp-root'); if (root) root.insertAdjacentHTML('beforeend', skOverHTML());
}
const skOverHTML = () => { const G = SKG, R = G.result, st = skStats();
  return `<div class="wsp-ov"><div class="wsp-card"><small>${R.record ? 'Nowy rekord!' : 'Koniec wspinaczki'}</small><b class="wsp-big">${G.score.toLocaleString('pl')}</b>
    <div class="wsp-row"><span><b>${Math.floor(G.maxY / 10)} m</b>wysokość</span><span><b>${G.gems}</b>kryształy</span><span><b>${(st.best || 0).toLocaleString('pl')}</b>rekord</span></div>
    <p>${R.gold ? `Nagroda: <b>+${R.gold} 🪙 złota</b>` : R.capped ? 'Dzienny limit złota z tej gry wyczerpany – grasz już tylko o rekord.' : 'Wejdź wyżej, żeby zarobić złoto (1 🪙 za każde 60 pkt).'}${R.gold && R.left ? ` <span>· dziś jeszcze do ${R.left} 🪙</span>` : ''}</p>
    <div class="wsp-btns"><button class="wsp-go" data-act="wsp-again">Jeszcze raz</button><button data-act="wsp-quit">Wyjdź</button></div></div></div>`; };
function skMount() {
  const root = document.getElementById('wsp-root'), cv = document.getElementById('wsp-cv'); if (!root || !cv) return;
  const w = Math.min(root.clientWidth, 520), h = root.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px';
  if (!SKG || SKG.w !== w || SKG.h !== h) SKG = skNew(w, h);
  SKG.dpr = dpr;
  const setDir = e => { if (e.target.closest('button')) return; const r = cv.getBoundingClientRect(); SKG.dir = e.clientX < r.left + r.width / 2 ? -1 : 1; };
  root.onpointerdown = e => { if (SKG?.phase === 'play') { setDir(e); if (!e.target.closest('button')) e.preventDefault(); } };
  root.onpointermove = e => { if (SKG?.phase === 'play' && e.buttons) setDir(e); };
  root.onpointerup = root.onpointercancel = root.onpointerleave = () => { if (SKG) SKG.dir = 0; };
  if (SKG.phase === 'over' && !root.querySelector('.wsp-ov')) root.insertAdjacentHTML('beforeend', skOverHTML());
  skDraw(SKG, cv, performance.now()); skHero(SKG); skLoop();
}
document.addEventListener('keydown', e => { if (!SKG || parseRoute().parts[0] !== 'skok') return; if (e.key === 'ArrowLeft' || e.key === 'a') SK_KEYS.l = true; if (e.key === 'ArrowRight' || e.key === 'd') SK_KEYS.r = true; });
document.addEventListener('keyup', e => { if (e.key === 'ArrowLeft' || e.key === 'a') SK_KEYS.l = false; if (e.key === 'ArrowRight' || e.key === 'd') SK_KEYS.r = false; });
document.addEventListener('visibilitychange', () => { if (SKG) SKG.last = 0; });
let SK_PLAY = false;
function skIntroHTML() {
  const st = skToday();
  return `<div class="row nowrap"><button class="iconbtn" data-go="#/boss">‹</button><h1 class="grow" style="margin:0">Wspinaczka</h1><span class="tag">${IS_ADMIN ? 'admin · beta' : 'beta'}</span></div>
  <div class="wsp-intro"><div class="wsp-intro-art"><i class="b b1"></i><i class="b b2"></i><i class="b b3"></i><span class="wsp-hero demo">${heroSVG('xs')}</span><i class="gem"></i></div>
    <h2>Jak wysoko doskoczysz?</h2>
    <p>Gra dla odpoczynku – bez fiszek. Twój bohater sam odbija się od książek, a Ty kierujesz nim <b>w lewo i w prawo</b>.</p>
    <ul><li><b>Dotknij lewej albo prawej strony ekranu</b> (na komputerze: strzałki).</li><li>Przez krawędź ekranu przechodzisz na drugą stronę.</li><li><b>Kruche kartki</b> pękają po jednym skoku, <b>sprężyny</b> wyrzucają wysoko, książki ze strzałkami się ruszają.</li><li><b>Kryształy</b> dają po 25 punktów. Im wyżej, tym ciaśniej.</li></ul>
    <button class="wsp-go" data-act="wsp-start">Skacz!</button>
    <p class="wsp-rec">${st.runs ? `Rekord: <b>${(st.best || 0).toLocaleString('pl')}</b> · biegi: ${st.runs} · ` : ''}złoto z gry dziś: ${st.dayGold || 0}/${SK_DAILY_GOLD} 🪙</p></div>`;
}
ROUTES.skok = () => {
  if (!skOn()) return { tab: 'arena', html: '<p class="muted center" style="padding:40px 0">Ten tryb jest jeszcze w testach.</p>' };
  if (!SK_PLAY) return { tab: 'arena', html: skIntroHTML() };
  onMount(skMount);
  return { tab: 'arena', focus: true, html: `<div class="wsp" id="wsp-root"><canvas id="wsp-cv"></canvas><div class="wsp-hero" id="wsp-hero"><span>${heroSVG('xs')}</span></div>
    <div class="wsp-hud"><button class="wsp-x" data-act="wsp-quit" aria-label="Wyjdź">✕</button><b id="wsp-score">0</b><span><i class="wsp-gemic"></i><em id="wsp-gems">0</em></span></div>
    <div class="wsp-hint">◀ dotknij lewej lub prawej strony ▶</div></div>` };
};
const skBoss0 = ROUTES.boss;
ROUTES.boss = (...a) => { const v = skBoss0(...a); if (!v?.html || !skOn() || (a[0] && a[0][1])) return v; const st = S.stats.skok || {};
  return { ...v, html: v.html.replace('<div class="card row nowrap coop-cta"', `<div class="card row nowrap wsp-cta" data-go="#/skok"><span class="wsp-cta-ic">🐾</span><div class="grow"><b>Wspinaczka <span class="tag">${IS_ADMIN ? 'admin · beta' : 'beta'}</span></b><div class="small muted">Gra dla odpoczynku: skacz po książkach coraz wyżej${st.best ? ` · rekord ${st.best.toLocaleString('pl')}` : ''}</div></div><span>›</span></div><div class="card row nowrap coop-cta"`) }; };
Object.assign(ACTIONS, {
  'wsp-start': () => { SK_PLAY = true; SKG = null; render(); },
  'wsp-again': () => { const G = SKG; if (!G) return; document.querySelector('#wsp-root .wsp-ov')?.remove(); SKG = skNew(G.w, G.h); SKG.dpr = G.dpr; skLoop(); },
  'wsp-quit': () => { cancelAnimationFrame(SK_RAF); SK_RAF = 0; if (SKG?.phase === 'play' && SKG.score > 30) { skOver(); return; } SKG = null; SK_PLAY = false; go('#/boss'); },
});

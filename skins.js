'use strict';
/* 🎨 Skiny postaci (assets/skins/{postać}-{ewolucja}-{rzadkość}.webp): dla każdej z 7 postaci 4 wersje – rzadki, epicki,
   legendarny, mityczny – a każda ma własny wygląd we wszystkich 4 ewolucjach. Zdobywanie:
   – 🎨 Skrzynka skinów (500 💎): 60% szans na postać, którą grasz; duplikat = kryształy,
   – darmowa skrzynka za każdą nową ewolucję postaci (i za start – 1 na powitanie).
   Założony skin widać na bohaterze wszędzie (Bohater, walki, pojedynek – także u przeciwnika). */
const SKIN_R = ['rare', 'epic', 'legendary', 'mythic'];
const SKIN_ODDS = { rare: 55, epic: 30, legendary: 12, mythic: 3 }, SKIN_DUP = { rare: 80, epic: 200, legendary: 600, mythic: 2000 }, SKIN_PRICE = 500;
const SKIN_NAME = { rare: 'Rzadki', epic: 'Epicki', legendary: 'Legendarny', mythic: 'Mityczny' };
const SKIN_COL = { rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b', mythic: '#ef4444' };
const SKIN_LINES = ['cat', 'frog', 'dog', 'owl', 'hamster', 'fox', 'beast'];   // postacie, które mają już narysowane skiny
const hasSkins = line => SKIN_LINES.includes(line);
const skinKey = (line, r) => `${line}-${r}`;
const skinOwned = (line, r) => hasItem('skin', skinKey(line, r));
const skinSrc = (line, f, r) => `assets/skins/${line}-${Math.max(0, Math.min(3, f))}-${r}.webp`;
const sSkin = r => SKIN_R.includes(r) ? r : null;
// założony skin własnej postaci (tylko posiadany)
function mySkin(line = heroLine()) { if (!hasSkins(line)) return null; const r = sSkin(hero().skin?.[line]); return r && skinOwned(line, r) ? r : null; }
const skinImg = (line, f, r) => `<img class="charpx skinpx" src="${skinSrc(line, f, r)}" alt="" draggable="false">`;
// figura z podmienionym obrazkiem (bez pozycjonowania sprite'u bazowego – skiny są wyrównane do dołu kwadratu)
const skinFig = (html, line, f, r) => html.replace(/ s8" style="[^"]*"/, ' skinned"').replace(/<img class="charpx[^>]*>|<svg class="charsvg[\s\S]*?<\/svg>/, skinImg(line, f, r));
const skHero0 = heroSVG;
heroSVG = function (cls = '', pr, h) {
  const html = skHero0(cls, pr, h), own = h === undefined || h === hero(); if (!own) return html;
  const line = heroLine(), r = mySkin(line); return r ? skinFig(html, line, heroForm(hero(), pr ?? (hero().pr || 0)), r) : html;
};

// ---------- 🎨 skrzynka skinów
function skinRoll() {
  let x = Math.random() * 100, r = 'rare'; for (const k of SKIN_R) { if ((x -= SKIN_ODDS[k]) < 0) { r = k; break; } }
  const lines = SKIN_LINES.filter(l => CHAR_LINES[l]), line = Math.random() < .6 && hasSkins(heroLine()) ? heroLine() : lines[Math.random() * lines.length | 0];
  return { line, r };
}
function skinOpen(free) {
  if (free) { if (itemCount('skincase', 'free') < 1) return; addItem('skincase', 'free', -1); }
  else if (!spend(SKIN_PRICE, 'skin-case')) return;
  const w = skinRoll(), dup = skinOwned(w.line, w.r);
  if (dup) S.wallet.push({ id: 'skindup-' + uid(), n: SKIN_DUP[w.r], why: 'skin-dup', t: Date.now() }); else addItem('skin', skinKey(w.line, w.r), 1);
  save();
  // 🎰 animacja: pasek skinów przewija się i zatrzymuje na wygranym
  const strip = Array.from({ length: 34 }, (_, i) => i === 29 ? w : skinRoll()), f = heroForm();
  const sp = document.createElement('div'); sp.className = 'cos-ov';
  sp.innerHTML = `<div class="skin-spin-wrap"><div class="skin-spin-t">🎨 Skrzynka skinów</div><div class="cos-spin"><div class="cos-strip">${strip.map(x => `<div class="cos-tile skin-tile r-${x.r}" style="--rc:${SKIN_COL[x.r]}"><img class="skinpx" src="${skinSrc(x.line, f, x.r)}" alt=""><small>${SKIN_NAME[x.r]}</small></div>`).join('')}</div><i class="cos-mark"></i></div></div>`;
  document.body.append(sp);
  const el = sp.querySelector('.cos-strip'), tw = sp.querySelector('.cos-tile')?.offsetWidth || 110;
  const stop = 29 * (tw + 10) - (sp.querySelector('.cos-spin').offsetWidth / 2 - tw / 2) + (Math.random() * tw * .5 - tw * .25);
  const anim = typeof cosAnimOn !== 'function' || cosAnimOn(), dur = anim ? 4200 : 300;
  requestAnimationFrame(() => { el.style.transition = `transform ${dur}ms cubic-bezier(.12,.75,.12,1)`; el.style.transform = `translateX(${-stop}px)`; });
  if (anim && typeof bossSfx === 'function') { let t = 0; const tick = () => { if (t > dur - 600) return; try { bossSfx('tick'); } catch { /* */ } t += 140 + t / 18; setTimeout(tick, 140 + t / 18); }; tick(); }
  setTimeout(() => { sp.remove(); skinReveal(w, dup); }, dur + 300);
}
function skinReveal(w, dup) {
  const big = w.r === 'legendary' || w.r === 'mythic', name = CHAR_LINES[w.line]?.name || w.line;
  const ov = document.createElement('div'); ov.className = 'cos-ov rev r-' + w.r; ov.style.setProperty('--rc', SKIN_COL[w.r]);
  ov.innerHTML = `<div class="cos-rev card r-${w.r}">${big ? '<i class="cos-rays"></i>' : ''}
    <small class="cos-rar" style="color:${SKIN_COL[w.r]}">${SKIN_NAME[w.r].toUpperCase()} SKIN · ${esc(name)}</small>
    <div class="cos-big skin-big">${[0, 1, 2, 3].map(f => `<img class="skinpx" src="${skinSrc(w.line, f, w.r)}" alt="">`).join('')}</div>
    <p class="small muted">Wygląd we wszystkich 4 ewolucjach.${dup ? ` Masz już ten skin – <b>+${SKIN_DUP[w.r]} 💎</b>.` : ''}</p>
    <div class="row nowrap">${dup ? '' : `<button class="primary grow" data-act="skin-eq" data-l="${w.line}" data-r="${w.r}" data-close="1">${w.line === heroLine() ? 'Załóż' : 'OK'}</button>`}<button class="grow" data-act="skin-close">${dup ? 'OK' : 'Później'}</button></div></div>`;
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  document.body.append(ov);
  if (typeof bossSfx === 'function') try { bossSfx(big ? 'win' : 'chest'); } catch { /* */ }
  if (big && typeof confetti === 'function') confetti(w.r === 'mythic' ? 240 : 140);
  render();
}
// darmowe skrzynki: 1 na start + 1 za każdą nową ewolucję postaci
function skinGrants() {
  const st = S.stats.skinForms = S.stats.skinForms || {}; let n = 0;
  if (!S.stats.skinWelcome) { S.stats.skinWelcome = 1; n++; }
  const line = heroLine(), f = heroForm(); if ((st[line] ?? f) < f) n += f - st[line]; st[line] = Math.max(st[line] ?? 0, f);
  if (n) { addItem('skincase', 'free', n, 'skinfree-' + uid()); save(); setTimeout(() => toast(`🎨 +${n} darmowa skrzynka skinów (Bohater → Postać)`, 4000), 1200); }
}
on('start', () => setTimeout(skinGrants, 1500));
on('review', () => { if (Math.random() < .2) skinGrants(); });

// ---------- karta skinów w zakładce „Postać”
// bazowy sprite zajmuje tylko część kwadratu – powiększamy go tak, żeby był tej samej wielkości co skiny
const skinBaseScale = (line, f) => { const b = typeof SPRITE_BOX !== 'undefined' && SPRITE_BOX[line]?.[f]; if (!b) return ''; const k = Math.min(94 / (b[2] - b[0]), 94 / (b[3] - b[1]), 3); return `--bs:${k.toFixed(2)}`; };
function skinCardHTML() {
  const line = heroLine(), f = heroForm(), cur = mySkin(line), free = itemCount('skincase', 'free');
  if (!hasSkins(line)) return `<div class="card skin-card"><h2 style="margin:0">🎨 Skiny – ${esc(CHAR_LINES[line]?.name || '')}</h2><p class="small muted" style="margin:8px 0 0">Ta postać jest nowa – jej skiny dopiero powstają. Skrzynka skinów działa dla pozostałych postaci.</p></div>`;
  return `<div class="card skin-card"><div class="row nowrap"><h2 class="grow" style="margin:0">🎨 Skiny – ${esc(CHAR_LINES[line]?.name || '')}</h2></div>
    <p class="small muted" style="margin:6px 0 12px">Każdy skin zmienia wygląd postaci we wszystkich ewolucjach. Widać go w walkach i pojedynkach.</p>
    <div class="skin-grid"><button class="skin-t${cur ? '' : ' on'}" data-act="skin-eq" data-l="${line}" data-r=""><span class="skin-pic base" style="${skinBaseScale(line, f)}">${heroArt(line, f, hero().g === 'm' ? 'm' : 'w')}</span><b>Podstawowy</b></button>
    ${SKIN_R.map(r => { const own = skinOwned(line, r); return `<button class="skin-t r-${r}${cur === r ? ' on' : ''}${own ? '' : ' locked'}" style="--rc:${SKIN_COL[r]}" data-act="${own ? 'skin-eq' : 'skin-lock'}" data-l="${line}" data-r="${r}"><span class="skin-pic"><img class="skinpx" src="${skinSrc(line, f, r)}" alt=""></span><b style="color:${SKIN_COL[r]}">${SKIN_NAME[r]}</b>${own ? '' : '<small>🔒</small>'}</button>`; }).join('')}</div>
    <div class="skin-case"><div class="grow"><b>🎨 Skrzynka skinów</b><div class="small muted">${SKIN_R.map(r => `<span style="color:${SKIN_COL[r]}">${SKIN_NAME[r]} ${SKIN_ODDS[r]}%</span>`).join(' · ')}<br>60% na postać, którą grasz · duplikat = 💎 · darmowa za każdą ewolucję</div></div></div>
    <div class="skin-btns">${free ? `<button class="primary" data-act="skin-open" data-free="1">🎁 Otwórz darmową (${free})</button>` : ''}<button class="${free ? '' : 'primary'}" data-act="skin-open">Otwórz za ${SKIN_PRICE} 💎</button></div></div>`;
}
const skRoute0 = ROUTES.hero;
ROUTES.hero = (...a) => { const v = skRoute0(...a); if (!v?.html || (typeof HERO_TAB !== 'undefined' && HERO_TAB !== 'char')) return v;
  return { ...v, html: v.html.replace('<div class="card"><h2 style="margin-top:0">🎭 Wybierz postać</h2>', skinCardHTML() + '<div class="card"><h2 style="margin-top:0">🎭 Wybierz postać</h2>') }; };

Object.assign(ACTIONS, {
  'skin-open': el => skinOpen(!!el.dataset.free),
  'skin-close': () => document.querySelector('.cos-ov')?.remove(),
  'skin-lock': () => toast('🔒 Ten skin wylosujesz w Skrzynce skinów', 2500),
  'skin-eq': el => {
    const line = el.dataset.l, r = sSkin(el.dataset.r), h = hero();
    if (el.dataset.close) document.querySelector('.cos-ov')?.remove();
    if (r && !skinOwned(line, r)) return;
    h.skin = { ...(h.skin || {}) }; if (r) h.skin[line] = r; else delete h.skin[line]; h.mod = Date.now(); save(); render();
    if (r) toast(`🎨 Skin: ${SKIN_NAME[r]}${line !== heroLine() ? ` (dla: ${CHAR_LINES[line]?.name})` : ''}`, 1800);
  },
});

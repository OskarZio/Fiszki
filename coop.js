'use strict';
/* 👥 Lobby i Hydra: 2–4 osoby walczą razem. Każdy uczy się SWOICH fiszek (wybrana talia albo wszystkie nauczone),
   każdy ma swoją głowę hydry – po jej ścięciu Twoje ciosy lecą w pozostałe. Kto padnie, leży: kolega reanimuje go
   3 dobrymi odpowiedziami, a leżący może wstać sam po 5 dobrych odpowiedziach. Przegrana = wszyscy leżą naraz.
   Komunikacja przez ten sam kanał co bitwy (Supabase Realtime / przekaźnik); wiadomości są sprawdzane (sanitize). */

let COOP_MODE = 'hydra', COOP = null, COOP_SRC = 'all', COOP_JOIN = '', COOP_SHARED = false, COOP_LASTSET = null;
// 🤝 wspólny zestaw: host wybiera talię, przy starcie wysyła karty (tekst) – kolega bije hydrę tymi samymi fiszkami.
// Kto ma tę talię u siebie (wspólna talia = te same id notatek), walczy własnymi kartami i zapisuje postęp; reszta – karty wirtualne tylko na walkę.
let COOP_V = new Map();
const coopVCard = id => COOP_V.get(id) || null;
function coopSetPack(d) {
  const cs = shuffle(S.cards.filter(c => c.deckId === d.id && fightable(c))).slice(0, 260);
  return { name: d.name.replace(/^👥\s*/, '').slice(0, 60), cards: cs.map(c => { const v = cardView(c); return { n: c.noteId, o: String(c.ord), q: stripHtml(v.q).slice(0, 300), a: String(v.ans || '').slice(0, 300) }; }).filter(x => x.q && x.a) };
}
function coopUseSet(set) {
  COOP_V = new Map(); const out = [], answers = [...new Set(set.cards.map(x => x.a))];
  set.cards.forEach((x, i) => {
    const own = S.cards.find(c => c.noteId === x.n && String(c.ord) === x.o && fightable(c)); if (own) return out.push(own);
    const same = [...new Set(set.cards.filter(y => y.o === x.o).map(y => y.a))].filter(a => norm(a) !== norm(x.a)), w = shuffle(same.length >= 3 ? same : answers.filter(a => norm(a) !== norm(x.a))).slice(0, 3), id = 'cv:' + i;
    const c = { id, gk: true, coopv: true, deckId: 'coop', cat: '', q: x.q, a: x.a, w, srs: GK_SRS }; COOP_V.set(id, c); out.push(c);
  });
  COOP_LASTSET = set; return out;
}
const HYDRA_TALK = { start: ['Dwie głowy, dwa razy więcej pytań!', 'Hsss… ilu was przyszło? Tym lepiej.'], hit: ['Hsss! Jedna głowa boli, druga się śmieje!', 'Uczycie się razem?! Nieuczciwe!'],
  miss: ['Hsss! Kolega Ci nie podpowie!', 'Jedna głowa zapomina, druga pamięta Twoje błędy.'], attack: ['Podwójny ukąszenie!', 'Ogon zapomnienia!'], low: ['Moje głowy… odrastają… wolniej…'], down: ['Wszystkie głowy… ścięte…'], win: ['Wracajcie, kiedy oboje powtórzycie materiał!'] };
const coopMe = () => { const h = hero(), st = heroStats(); return { nick: (S.profile.nick || 'Gracz').slice(0, 24), line: heroLine(h), g: h.g === 'm' ? 'm' : 'w', pr: h.pr || 0, lv: heroLv(), atk: +st.atk.toFixed(3), look: h.look | 0 }; };
// 🔒 tylko znane pola i rozsądne wartości od innych graczy
function sCoopMsg(m) {
  if (!m || typeof m !== 'object' || typeof m.t !== 'string' || typeof m.from !== 'string') return null;
  const o = { t: sStr(m.t, 12), from: sStr(m.from, 40) };
  if (m.to != null) o.to = sStr(m.to, 40);
  if (m.nick != null) o.nick = sStr(m.nick, 24); if (m.line != null) o.line = CHAR_LINES[m.line] ? m.line : 'cat'; if (m.g != null) o.g = m.g === 'm' ? 'm' : 'w';
  for (const k of ['pr', 'lv', 'look']) if (m[k] != null) o[k] = sInt(m[k], 0, 1e7);
  if (m.atk != null) o.atk = sNum(m.atk, .5, 10, 1);
  for (const k of ['hp', 'max', 'n', 'combo', 'seed', 'len']) if (m[k] != null) o[k] = sInt(m[k], 0, 1e6);
  if (m.down != null) o.down = !!m.down; if (m.won != null) o.won = !!m.won;
  if (m.h != null) o.h = sStr(m.h, 40);
  if (m.tw != null) o.tw = !!m.tw; if (m.gq != null) o.gq = !!m.gq; if (m.fl != null) o.fl = sInt(m.fl, 1, 999, 1); if (m.emo != null) o.emo = sInt(m.emo, 0, DUO_EMO.length - 1); if (m.bon != null) o.bon = DUO_BON[m.bon] ? m.bon : null; if (Array.isArray(m.ab)) o.ab = m.ab.slice(0, 25).filter(a => typeof a === 'string' && BOSS_ABIL[a]);
  if (m.sm != null) o.sm = sStr(m.sm, 60); if (m.sn != null) o.sn = sInt(m.sn, 0, 1000);
  if (m.set && typeof m.set === 'object' && Array.isArray(m.set.cards)) o.set = { name: sStr(m.set.name, 60), cards: m.set.cards.slice(0, 260).map(x => ({ n: sStr(x?.n, 64), o: sStr(x?.o, 8), q: sStr(x?.q, 300), a: sStr(x?.a, 300) })).filter(x => x.q && x.a) };
  if (Array.isArray(m.players)) o.players = m.players.slice(0, 4).map(p => ({ id: sStr(p?.id, 40), nick: sStr(p?.nick, 24), line: CHAR_LINES[p?.line] ? p.line : 'cat', g: p?.g === 'm' ? 'm' : 'w', pr: sInt(p?.pr, 0, 99), lv: sInt(p?.lv, 1, 99, 1), atk: sNum(p?.atk, .5, 10, 1), look: sInt(p?.look, 0, 1e7) }));
  if (Array.isArray(m.heads)) o.heads = m.heads.slice(0, 4).map(x => ({ id: sStr(x?.id, 40), max: sInt(x?.max, 50, 100000, 300) }));
  return o;
}
const coopSend = m => COOP?.ch?.send(m);
function coopOpen(code, host) {
  COOP?.ch?.close();
  COOP = { code, host, phase: 'lobby', players: { [MY_ID]: { id: MY_ID, ...coopMe(), seen: Date.now() } }, heads: [], rev: {}, ch: null };
  COOP.ch = channel('fiszki-coop-' + code, coopMsg);
  if (!host) { const hello = () => { if (COOP?.code === code && COOP.phase === 'lobby' && Object.keys(COOP.players).length < 2) { coopSend({ t: 'join', ...coopMe() }); COOP.tries = (COOP.tries || 0) + 1; if (COOP.tries < 8) setTimeout(hello, 2500); } }; hello(); }
  coopBeat();
}
// co 4 s: stan lobby (host) i bicie serca; gracz bez sygnału 25 s – wyszedł
function coopBeat() {
  const C = COOP; if (!C) return;
  if (C.host && C.phase === 'lobby') coopSend({ t: 'lobby', players: Object.values(C.players).map(({ seen, ...p }) => p), ...coopSetInfo() });
  if (C.phase === 'fight' && BOSS?.coop) coopSync();
  for (const p of Object.values(C.players)) if (p.id !== MY_ID && !p.gone && Date.now() - p.seen > 25000) { p.gone = true; coopGone(p); }
  clearTimeout(C.beat); C.beat = setTimeout(coopBeat, 4000);
}
function coopGone(p) {
  const C = COOP, hd = C.heads.find(x => x.id === p.id);
  if (hd && hd.hp > 0) hd.hp = Math.round(hd.hp / 2);
  if (BOSS?.coop) { BOSS.log.unshift(`🚪 ${p.nick} wyszedł – jego głowa słabnie`); softRender(); } else render();
}
function coopMsg(m0) {
  const m = sCoopMsg(m0), C = COOP; if (!m || !C) return;
  if (m.to && m.to !== MY_ID) return;
  const p = C.players[m.from]; if (p) { p.seen = Date.now(); p.gone = false; }
  if (m.t === 'join' && C.host && C.phase === 'lobby') {
    if (!p && Object.keys(C.players).length >= 4) return coopSend({ t: 'full', to: m.from });
    C.players[m.from] = { id: m.from, nick: m.nick, line: m.line, g: m.g, pr: m.pr, lv: m.lv, atk: m.atk, look: m.look, seen: Date.now() };
    coopSend({ t: 'lobby', players: Object.values(C.players).map(({ seen, ...x }) => x), ...coopSetInfo() }); return render();
  }
  if (m.t === 'full') { toast('Lobby jest pełne'); return coopLeave(); }
  if (m.t === 'lobby' && !C.host && m.players) {
    if (!m.players.some(x => x.id === MY_ID)) return;
    C.hostId = m.from; C.tower = !!m.tw; C.gq = !!m.gq; C.setInfo = m.sm ? { name: m.sm, n: m.sn || 0 } : null; for (const x of m.players) C.players[x.id] = { ...(C.players[x.id] || {}), ...x, seen: Date.now() }; return render();
  }
  if (m.t === 'start' && !C.host && m.from === C.hostId && ['lobby', 'floor'].includes(C.phase) && m.heads) { if (m.tw) { duoPrep(m.fl, m.bon, m.ab); C.gq = !!m.gq; } return coopBegin(m.heads, m.seed, m.set); }
  if (m.t === 'ok' && p) { C.mateOk = { id: m.from, t: Date.now() }; return; }
  if (m.t === 'emo' && p && m.emo != null) { p.emo = { i: m.emo, t: Date.now() }; setTimeout(softRender, 2600); return softRender(); }
  if (m.t === 'hit' && C.phase === 'fight') { const hd = C.heads.find(x => x.id === m.h); if (hd) { hd.hp = Math.max(0, hd.hp - m.n); syncMyHead(); if (BOSS?.phase === 'fight' && !coopAlive()) return bossEnd(true); softRender(); } return; }
  if (m.t === 'heal' && C.phase === 'fight') { const hd = C.heads.find(x => x.id === m.h); if (hd && hd.hp > 0) { hd.hp = Math.min(hd.max, hd.hp + m.n); softRender(); } return; }
  if (m.t === 'state' && p) { Object.assign(p, { hp: m.hp, max: m.max, down: m.down, combo: m.combo }); if (BOSS?.phase === 'fight' && coopLost()) return bossEnd(false, 'dead'); return softRender(); }
  if (m.t === 'revive' && BOSS?.coop && BOSS.down) { const B = BOSS; B.down = false; B.me = Math.round(B.meMax * .4); B.selfRev = 0; B.log.unshift(`💚 ${p?.nick || 'Kolega'} Cię reanimował!`); coopSync(); return softRender(); }
  if (m.t === 'leave' && p) { p.gone = true; coopGone(p); }
}
// przerysowanie bez gubienia wpisywanej odpowiedzi
function softRender() {
  const el = document.activeElement, keep = el?.id === 'boss-in' ? { v: el.value, s: el.selectionStart } : null;
  render();
  if (keep) { const i = $('#boss-in'); if (i) { i.value = keep.v; i.focus(); try { i.setSelectionRange(keep.s, keep.s); } catch { /* */ } } }
}
function coopStartHost() {
  const C = COOP; if (!C?.host) return;
  const ps = Object.values(C.players).filter(p => !p.gone);
  const heads = ps.map(p => ({ id: p.id, max: Math.round(30 * 10 * .85 * (.55 + .45 * (p.atk || 1)) * (1 + .15 * (p.pr || 0))) }));
  const seed = 1 + (Math.random() * 1e6 | 0);
  const d = COOP_SHARED && deckById(COOP_SRC), set = d ? coopSetPack(d) : null;
  if (COOP_SHARED && (!set || set.cards.length < 4)) return toast('Wybierz talię z co najmniej 4 fiszkami na wspólny zestaw');
  let tw = {};
  if (COOP_MODE === 'tower') { const fl = C.phase === 'floor' ? C.tw.floor : 1, keys = Object.keys(DUO_BON), bon = fl > 1 ? keys[Math.random() * keys.length | 0] : null;
    for (const h of heads) h.max = Math.round(h.max * .8 * (1 + .2 * (fl - 1)));
    const ab = [...(fl > 1 && C.tw?.abil || [])]; const nx = towerCurse(ab); if (nx) ab.push(nx);
    tw = { tw: true, fl, ab, ...(bon ? { bon } : {}), ...(COOP_SRC === 'gk' ? { gq: true } : {}) }; duoPrep(fl, bon, ab); C.gq = COOP_SRC === 'gk'; }
  coopSend({ t: 'start', heads, seed, ...(set ? { set } : {}), ...tw }); coopBegin(heads, seed, set);
}
const coopSetInfo = () => { const d = COOP_SHARED && deckById(COOP_SRC), tw = COOP_MODE === 'tower' ? { tw: true, ...(COOP_SRC === 'gk' ? { gq: true } : {}) } : {}; return d ? { ...tw, sm: d.name.replace(/^👥\s*/, '').slice(0, 60), sn: S.cards.filter(c => c.deckId === d.id && fightable(c)).length } : tw; };
function coopBegin(heads, seed, set) {
  const C = COOP; C.phase = 'fight'; C.heads = heads.map(h => ({ ...h, hp: h.max })); C.rev = {};
  let cs;
  if (C.tw?.on && C.gq && typeof gkPick === 'function') { const T0 = { floor: C.tw.floor * 2, used: C.gkUsed || [] }; cs = gkPick(T0, 30); C.gkUsed = T0.used; C.shared = null; BOSS_PICK.mode = 'abcd'; }
  else if (set?.cards?.length) { cs = coopUseSet(set); C.shared = set.name; toast(`🤝 Wspólny zestaw: „${set.name}” – ${cs.length} fiszek`, 3000); }
  else { COOP_V = new Map(); C.shared = null; cs = S.cards.filter(c => (COOP_SRC === 'all' ? mixFightable(c) : fightable(c)) && c.srs.state !== 'new' && (COOP_SRC === 'all' || c.deckId === COOP_SRC));
    if (cs.length < 10) { toast('Masz za mało nauczonych fiszek (min. 10) – walczysz tym, co jest', 3500); } }
  const n = Object.keys(C.players).length, diff = Math.min(4, 1 + Math.floor(heroLv() / 6));
  const T = C.tw?.on ? C.tw : null;
  const b = T ? { ...duoBoss(T.floor, seed, cs.length ? cs : S.cards.filter(fightable)), ...(C.gq ? { gk: true } : {}) } : { kind: 'hydra', id: 'hydra', name: n > 2 ? `Hydra ${n}-głowa` : 'Hydra', desc: 'Każdy z Was bije swoją głowę.', img: 'assets/bosses/hydra.webp', persona: HYDRA_TALK, diff, stars: 0, cards: cs.length ? cs : S.cards.filter(fightable), ok: true, repeat: false, pr: hero().pr || 0, len: 30, title: `Lobby ${C.code}`, seed };
  const p = bossParams(b); const mine = C.heads.find(h => h.id === MY_ID); p.hp = mine?.max || p.hp; if (T) { b.curses = true; p.abil = [...(T.abil || [])]; }
  bossBegin(b, { coop: true }, p);
  if (T) duoApply(BOSS, T);
  syncMyHead(); coopSync();
}
const myHead = () => COOP?.heads.find(h => h.id === MY_ID);
function syncMyHead() { const B = BOSS, h = myHead(); if (B?.coop && h) { B.hp = h.hp; B.max = h.max; } }
// Twój cios: we własną głowę, a gdy już ścięta – w najsłabszą żywą
function coopHit(n) {
  const C = COOP; if (!C) return 0;
  const alive = C.heads.filter(h => h.hp > 0); if (!alive.length) return 0;
  const t = alive.find(h => h.id === MY_ID) || alive.sort((a, b) => a.hp - b.hp)[0], d = Math.min(t.hp, n);
  t.hp -= d; coopSend({ t: 'hit', h: t.id, n: d }); syncMyHead(); return d;
}
const coopAlive = () => !!COOP?.heads.some(h => h.hp > 0);
function coopHeal(n) { const h = myHead(); if (h && h.hp > 0) { h.hp = Math.min(h.max, h.hp + n); coopSend({ t: 'heal', h: h.id, n }); syncMyHead(); } }
function coopDown() { const B = BOSS; B.me = 0; B.down = true; B.selfRev = 0; B.log.unshift('💀 Padłeś! Odpowiadaj dalej – 5 dobrych odpowiedzi i wstajesz'); coopSync(); }
function coopSelfRevive() { const B = BOSS; B.selfRev = (B.selfRev || 0) + 1; if (B.selfRev >= 5) { B.down = false; B.me = Math.round(B.meMax * .25); B.selfRev = 0; B.log.unshift('💪 Wstajesz o własnych siłach!'); } }
function coopOnCorrect() {
  const C = COOP; if (!C) return;
  coopSend({ t: 'ok' }); duoSynchro(C);
  const down = Object.values(C.players).find(p => p.id !== MY_ID && p.down && !p.gone); if (!down) return;
  C.rev[down.id] = (C.rev[down.id] || 0) + 1;
  if (C.rev[down.id] >= 3) { C.rev[down.id] = 0; coopSend({ t: 'revive', to: down.id }); BOSS.log.unshift(`💚 Reanimujesz: ${down.nick}!`); down.down = false; S.stats.coopRevives = (S.stats.coopRevives || 0) + 1; }
  else BOSS.log.unshift(`💚 Reanimacja ${down.nick}: ${C.rev[down.id]}/3`);
}
const coopMates = () => Object.values(COOP?.players || {}).filter(p => p.id !== MY_ID && !p.gone);
const coopLost = () => !!BOSS?.down && coopMates().every(p => p.down);
function coopSync() { const B = BOSS; if (B?.coop) coopSend({ t: 'state', hp: Math.max(0, Math.round(B.me)), max: B.meMax, down: !!B.down, combo: B.combo }); }
function coopEnd(won) { if (COOP?.tw?.on) return duoEnd(won); if (COOP) COOP.phase = 'end'; S.stats.coopFights = (S.stats.coopFights || 0) + 1; if (won) S.stats.coopWins = (S.stats.coopWins || 0) + 1; }
function coopLeave() { if (!COOP) return; coopSend({ t: 'leave' }); clearTimeout(COOP.beat); COOP.ch?.close(); COOP = null; }
const pHero = p => heroSVG('xs', p.pr, { eq: {}, line: p.line, g: p.g, pr: p.pr, look: p.look });
function coopHeadsHTML(fx, act) {
  const C = COOP; if (!C) return '';
  return `<div class="hydra">${C.heads.map(h => { const p = C.players[h.id], mine = h.id === MY_ID, dead = h.hp <= 0;
    return `<div class="hhead${mine ? ' mine' : ''}${dead ? ' dead' : ''}${mine && fx ? ' hit' : ''}${act ? ' attack' : ''}"><div class="boss-art world"><img src="${BOSS?.b?.duo && BOSS.b.img ? (BOSS.b.img.includes('/') ? BOSS.b.img : `assets/fluent/${BOSS.b.img}.webp`) : 'assets/bosses/hydra.webp'}" alt=""></div>${mine && fx ? `<b class="dmg${fx.crit ? ' crit' : ''}">${fx.n !== '' ? '−' + fx.n : ''}</b>` : ''}
      <small>${dead ? (BOSS?.b?.duo ? '✓ rozbita' : '✓ ścięta') : mine ? (BOSS?.b?.duo ? 'Twoja tarcza bossa' : 'Twoja głowa') : esc(p?.nick || 'kolega')}</small>${HP_BAR(h.hp, h.max, 'boss')}</div>`; }).join('')}</div>`;
}
function coopMatesHTML() {
  const ms = coopMates(); if (!ms.length) return '';
  return `<div class="mates">${ms.map(p => `<div class="mate${p.down ? ' down' : ''}">${p.emo && Date.now() - p.emo.t < 2500 ? `<span class="mate-emo">${DUO_EMO[p.emo.i]}</span>` : ''}${pHero(p)}<b>${esc(p.nick)}</b>${p.max ? HP_BAR(p.hp || 0, p.max, 'me') : ''}${p.down ? `<small>💀 leży · reanimuj: ${(COOP.rev[p.id] || 0)}/3</small>` : p.combo >= 2 ? `<small>🔥 ${p.combo}</small>` : ''}</div>`).join('')}</div>
    <div class="emo-bar">${DUO_EMO.map((e, i) => `<button data-act="duo-emo" data-i="${i}" aria-label="reakcja">${e}</button>`).join('')}</div>`;
}
ROUTES.coop = parts => {
  if (parts[1] && !COOP && /^[A-Z0-9]{6}$/i.test(parts[1])) { COOP_JOIN = parts[1].toUpperCase(); }
  if (BOSS?.coop && BOSS.phase === 'fight') return ROUTES.boss(['boss', 'fight']);
  const C = COOP, deckOpts = S.decks.map(d => `<option value="${d.id}" ${COOP_SRC === d.id ? 'selected' : ''}>${esc(d.name)} (${COOP_SHARED ? S.cards.filter(c => c.deckId === d.id && fightable(c)).length : deckLearned(d)})</option>`).join('');
  const own = `<select data-coop-src="1" class="grow">${COOP_SHARED ? '<option value="" disabled ' + (deckById(COOP_SRC) ? '' : 'selected') + '>Wybierz talię…</option>' : '<option value="all">Wszystkie nauczone fiszki</option>'}${COOP_MODE === 'tower' && !COOP_SHARED ? `<option value="gk" ${COOP_SRC === 'gk' ? 'selected' : ''}>🧠 Quiz z wiedzy ogólnej (${typeof GK_ALL !== 'undefined' ? GK_ALL.length : 0} pytań)</option>` : ''}${deckOpts}</select>`;
  const canPick = !C || C.host, guestSet = C && !C.host && C.setInfo;
  const src = guestSet ? `<div class="coop-set"><b>🤝 Wspólny zestaw: „${esc(C.setInfo.name)}”</b><small>${C.setInfo.n} fiszek – host wybrał, uczycie się tego samego. Jeśli masz tę talię, postęp zapisze się u Ciebie.</small></div>`
    : `${canPick ? `<div class="seg coop-mode"><button class="${COOP_SHARED ? '' : 'on'}" data-act="coop-shared" data-v="0">👤 Każdy swoje</button><button class="${COOP_SHARED ? 'on' : ''}" data-act="coop-shared" data-v="1">🤝 Wspólny zestaw</button></div>` : ''}
      <div class="row nowrap" style="margin-top:8px">${own}</div>${COOP_SHARED && canPick ? '<p class="small muted" style="margin:6px 0 0">Kolega dostanie te same fiszki na czas walki (i może je potem zapisać u siebie).</p>' : ''}`;
  const gameSeg = canPick ? `<div class="seg duo-seg"><button class="${COOP_MODE === 'hydra' ? 'on' : ''}" data-act="coop-game" data-v="hydra">🐍 Hydra</button><button class="${COOP_MODE === 'tower' ? 'on' : ''}" data-act="coop-game" data-v="tower">🗼 Wieża duetu</button></div>`
    : C?.tower ? `<div class="coop-set"><b>🗼 Wieża duetu${C.gq ? ' · 🧠 quiz' : ''}</b><small>${C.gq ? 'Pytania z biblioteki wiedzy ogólnej (ABCD).' : 'Host wybrał wspinaczkę we dwoje.'}</small></div>` : '';
  if (C?.phase === 'floor') return duoFloorView(C);
  const modes = `<div class="mode-pick">${Object.entries(MODES).map(([k, m]) => `<button class="${BOSS_PICK.mode === k ? 'on' : ''}" data-act="boss-mode" data-m="${k}"><span>${m.icon}</span><b>${m.name}</b><small>cios ${m.mul}</small></button>`).join('')}</div>`;
  if (!C || C.phase === 'end') return { tab: 'arena', html: `
    <div class="row nowrap"><button class="iconbtn" data-go="#/boss">‹</button><h1 class="grow" style="margin:0">👥 Lobby – Hydra</h1></div>
    <div class="card center"><img src="assets/bosses/hydra.webp" alt="" style="width:110px;height:110px;object-fit:contain"><p style="margin:6px 0">Ucz się z kolegą i bijcie razem hydrę. <b>Każdy swoje</b> – Ty anatomię, kolega angielski – albo <b>🤝 wspólny zestaw</b>: wybierasz talię i oboje walczycie tymi samymi fiszkami.</p>
      <ul class="small" style="text-align:left;margin:0"><li>Każdy ma swoją głowę hydry. Ściąłeś swoją? Pomagasz koledze.</li><li>Ktoś padł? 3 dobre odpowiedzi kolegi go reanimują (albo sam wstanie po 5).</li><li>Przegrana walka w lobby nie zabiera serc.</li></ul></div>
    <div class="card"><h3 style="margin-top:0">Gra</h3>${gameSeg}${COOP_MODE === 'tower' ? DUO_INFO : ''}<h3>Materiał</h3>${src}<h3>Tryb</h3>${modes}</div>
    ${COOP_LASTSET && !S.decks.some(d => d.name.replace(/^👥\s*/, '') === COOP_LASTSET.name) ? `<div class="card coop-set"><b>📥 Ostatni wspólny zestaw: „${esc(COOP_LASTSET.name)}”</b><small>${COOP_LASTSET.cards.length} fiszek z ostatniej walki</small><button class="sm primary" data-act="coop-save-set" style="margin-top:6px">💾 Zapisz u siebie jako talię</button></div>` : ''}
    <div class="card"><button class="primary block" data-act="coop-host">➕ Stwórz lobby</button>
      <div class="row nowrap" style="margin-top:10px"><input id="coop-code" class="grow" maxlength="6" placeholder="Kod lobby, np. K7P2QX" value="${esc(COOP_JOIN)}" autocapitalize="characters" autocomplete="off"><button data-act="coop-join">Dołącz</button></div>
      ${!window.BATTLE_LOCAL && !(typeof SB !== 'undefined' && SB) ? '<p class="small muted">Lobby działa przez internet (ten sam przekaźnik co bitwy).</p>' : ''}</div>` };
  const ps = Object.values(C.players).filter(p => !p.gone), link = `${location.origin}${location.pathname}#/coop/${C.code}`;
  return { tab: 'arena', html: `
    <div class="row nowrap"><button class="iconbtn" data-act="coop-leave">‹</button><h1 class="grow" style="margin:0">👥 Lobby ${esc(C.code)}</h1></div>
    <div class="card center"><div class="small muted">Kod dla kolegi</div><div class="coop-code">${esc(C.code)}</div>
      <div class="row" style="justify-content:center"><button class="sm" data-act="coop-share" data-link="${esc(link)}">📤 Wyślij zaproszenie</button></div></div>
    <div class="card"><h3 style="margin-top:0">Gracze (${ps.length}/4)</h3><div class="mates lobby">${ps.map(p => `<div class="mate">${pHero(p)}<b>${esc(p.nick)}${p.id === MY_ID ? ' (Ty)' : ''}</b><small>poz. ${p.lv}${p.id === (C.host ? MY_ID : C.hostId) ? ' · 👑 host' : ''}</small></div>`).join('')}</div>
      ${ps.length < 2 ? '<p class="small muted center">Czekam na kolegę… wyślij mu kod.</p>' : ''}</div>
    <div class="card"><h3 style="margin-top:0">Gra</h3>${gameSeg}${(C.host ? COOP_MODE === 'tower' : C.tower) ? DUO_INFO : ''}<h3>Materiał</h3>${src}<h3>Tryb</h3>${modes}</div>
    ${C.host ? `<button class="primary block boss-go" data-act="coop-start" ${ps.length < 2 ? 'disabled' : ''}>${COOP_MODE === 'tower' ? `🗼 Start – wieża duetu (${ps.length} graczy)` : `⚔️ Start – Hydra ${ps.length}-głowa`}</button>` : '<p class="center muted">Host rozpocznie walkę…</p>'}` };
};
document.addEventListener('change', e => { if (e.target.dataset?.coopSrc) { COOP_SRC = e.target.value; if (COOP?.host) coopBeat(); } });
Object.assign(ACTIONS, {
  'coop-host': () => { coopOpen(roomCode(), true); render(); },
  'coop-join': () => { const code = ($('#coop-code')?.value || '').trim().toUpperCase(); if (!/^[A-Z0-9]{6}$/.test(code)) return toast('Kod ma 6 znaków'); COOP_JOIN = ''; coopOpen(code, false); render(); },
  'coop-start': () => coopStartHost(),
  'coop-game': el => { COOP_MODE = el.dataset.v === 'tower' ? 'tower' : 'hydra'; if (COOP_MODE === 'hydra' && COOP_SRC === 'gk') COOP_SRC = 'all'; if (COOP?.host) coopBeat(); render(); },
  'duo-emo': el => { const i = +el.dataset.i; coopSend({ t: 'emo', emo: i }); toast(`${DUO_EMO[i]} wysłane`, 900); },
  'duo-next': () => coopStartHost(),
  'coop-shared': el => { COOP_SHARED = el.dataset.v === '1'; if (COOP_SHARED && !deckById(COOP_SRC)) COOP_SRC = (S.decks.find(d => S.cards.some(c => c.deckId === d.id)) || {}).id || ''; if (!COOP_SHARED && !deckById(COOP_SRC)) COOP_SRC = 'all'; if (COOP?.host) coopBeat(); render(); },
  'coop-save-set': () => { const L = COOP_LASTSET; if (!L) return; importPack({ deck: L.name, subject: '', reverse: false, items: L.cards.filter(x => x.o !== 'r').map(x => ({ front: x.q, back: x.a, hint: '' })), bad: 0 }); COOP_LASTSET = null; },
  'coop-leave': () => { coopLeave(); go('#/coop'); render(); },
  'coop-share': el => { const link = el.dataset.link, txt = `Chodź bić hydrę w Fiszkach! Kod lobby: ${COOP.code}`; if (navigator.share) navigator.share({ title: 'Fiszki – lobby', text: txt, url: link }).catch(() => {}); else { navigator.clipboard?.writeText(`${txt} ${link}`); toast('📋 Skopiowano zaproszenie'); } },
});
HUB_OF.coop = 'arena';
// pasek sekcji Przygody nad lobby
const coopRoute0 = ROUTES.coop;
ROUTES.coop = (...a) => { const v = coopRoute0(...a); return !v || v.focus ? v : { ...v, html: (typeof hubNav === 'function' ? hubNav('arena', 'coop') : '') + stripBack(v.html.replace('<button class="iconbtn" data-go="#/boss">‹</button>', '')) }; };

// ---------- 🗼 Wieża duetu: wspinaczka we dwoje (lub w 3–4) piętro za piętrem
// Każde piętro to boss z wieży; każdy bije swoją „tarczę” bossa. Synchro: dobra odpowiedź obu w ciągu 4 s = dodatkowy cios.
// Po piętrze: 35% ❤️ wraca i drużyna dostaje wspólną nagrodę. Boss co 4 pytania uczy się nowej mocy. Wszyscy padli = koniec.
const DUO_EMO = ['👏', '😂', '🔥', '😱', '💪', '🫡'];
const DUO_BON = { hp: ['❤️', '+20 maks. ❤️ dla drużyny'], dmg: ['⚔️', '+12% obrażeń dla drużyny'], crit: ['🎯', '+6% krytyka dla drużyny'], heal: ['💚', 'pełne leczenie drużyny'], ult: ['⚡', 'supercios naładowany na start'], time: ['⏱️', '+20% czasu do namysłu'] };
const DUO_INFO = `<ul class="small duo-info"><li>🗼 Piętro za piętrem, coraz silniejsi bossowie – każdy bije swoją tarczę bossa.</li><li>⚡ <b>Synchro</b>: gdy oboje odpowiecie dobrze w ciągu 4 s – dodatkowy wspólny cios!</li>
  <li>🎁 Po każdym piętrze <b>nagroda drużyny</b> (więcej ❤️, obrażeń, krytyka…) i 35% ❤️ wraca.</li><li>📈 Przed każdym piętrem boss losuje nową przeszkadzajkę – moce się sumują. 💀 Kolega reanimuje 3 dobrymi odpowiedziami.</li><li>👏 Wysyłaj reakcje koledze w trakcie walki. Przegrana nie zabiera serc.</li></ul>`;
function duoPrep(fl, bon, ab) {
  const C = COOP; if (!C) return;
  if (!C.tw?.on || fl === 1) C.tw = { on: true, floor: 1, buff: {}, hp: null, best: 0, abil: [] };
  C.tw.floor = fl; C.tw.bon = bon || null; const old = C.tw.abil || []; C.tw.abil = ab || old; C.tw.fresh = (ab || []).find(a => !old.includes(a)) || null;
  if (bon === 'heal') C.tw.hp = null; else if (bon) C.tw.buff[bon] = (C.tw.buff[bon] || 0) + 1;
}
function duoBoss(f, seed, cards) {
  const guard = f % TOWER_GUARD === 0, pool = guard ? FINAL_IDX : CHAPTER_IDX.concat(WORLD_IDX), bo = bossOf(pool[(f * 7 + seed) % pool.length]);
  return { kind: 'duo', duo: true, id: 'duo', i: f, name: `${bo.name}${guard ? ' – strażnik' : ''}`, desc: bo.desc, img: bo.img, persona: bo.persona, diff: Math.min(4, Math.floor((f + 1) / 2)), stars: 0,
    cards, ok: true, repeat: false, pr: hero().pr || 0, len: 30, title: `🗼 Wieża duetu · piętro ${f}${guard ? ' · strażnik' : ''}`, seed, final: guard };
}
function duoApply(B, T) {
  const u = T.buff;
  B.meMax += 20 * (u.hp || 0); B.hs.atk *= 1 + .12 * (u.dmg || 0); B.hs.crit = Math.min(.7, B.hs.crit + .06 * (u.crit || 0)); B.hs.time *= 1 + .2 * (u.time || 0);
  B.me = T.hp == null ? B.meMax : Math.min(B.meMax, Math.round(T.hp + B.meMax * .35));
  if (T.bon === 'ult') B.ult = B.hs.ultNeed;
  if (T.bon) { const [i, d] = DUO_BON[T.bon]; B.log.unshift(`🎁 Nagroda drużyny: ${i} ${d}`); }
  B.log.unshift(`🗼 Piętro ${T.floor} – razem dacie radę!`); coopSync(); towerIntro(B, T.fresh); render();
}
function duoSynchro(C) {
  const B = BOSS, m = C.mateOk; if (!B || !m || Date.now() - m.t > 4000) return;
  C.mateOk = null; const mate = C.players[m.id], n = dealBoss(Math.max(8, 9 * B.hs.atk * (1 + .1 * B.b.diff)), 'synchro');
  B.fx = { k: 'boss', n, crit: true, t: Date.now() }; B.syncFx = Date.now(); B.log.unshift(`⚡ SYNCHRO z ${mate?.nick || 'kolegą'}! −${n}`); S.stats.duoSync = (S.stats.duoSync || 0) + 1;
}
function duoEnd(won) {
  const C = COOP, T = C.tw;
  S.stats.coopFights = (S.stats.coopFights || 0) + 1;
  if (won) { T.best = T.floor; S.stats.duoBest = Math.max(S.stats.duoBest || 0, T.floor); T.hp = Math.max(1, Math.round(BOSS.me || BOSS.meMax * .25)); T.floor++; C.phase = 'floor'; C.heads = []; }
  else { C.phase = 'end'; T.on = false; S.stats.duoBest = Math.max(S.stats.duoBest || 0, T.floor - 1); }
  save();
}
function duoFloorView(C) {
  const T = C.tw, ps = Object.values(C.players).filter(p => !p.gone), buffs = Object.entries(T.buff).filter(([, n]) => n);
  return { tab: 'arena', html: `
    <div class="row nowrap"><button class="iconbtn" data-act="coop-leave">‹</button><h1 class="grow" style="margin:0">🗼 Wieża duetu</h1></div>
    <div class="card center duo-floor"><div class="duo-fl">Piętro ${T.floor - 1} zdobyte!</div>
      <div class="mates lobby">${ps.map(p => `<div class="mate">${pHero(p)}<b>${esc(p.nick)}${p.id === MY_ID ? ' (Ty)' : ''}</b></div>`).join('')}</div>
      <p class="small muted" style="margin:10px 0 4px">Rekord duetu: piętro ${S.stats.duoBest || 0}. Przed Wami piętro <b>${T.floor}</b>${T.floor % TOWER_GUARD === 0 ? ' – <b>strażnik!</b>' : ''}.</p>
      ${buffs.length ? `<div class="duo-buffs">${buffs.map(([k, n]) => `<span>${DUO_BON[k][0]} ${DUO_BON[k][1]}${n > 1 ? ` ×${n}` : ''}</span>`).join('')}</div>` : ''}
      <p class="small" style="margin:8px 0 0">🎁 Na starcie piętra wylosuje się nowa nagroda drużyny.</p></div>
    ${C.host ? `<button class="primary block boss-go" data-act="duo-next">⚔️ Piętro ${T.floor}</button>` : '<p class="center muted">Host prowadzi na kolejne piętro…</p>'}` };
}

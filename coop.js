'use strict';
/* 👥 Lobby i Hydra: 2–4 osoby walczą razem. Każdy uczy się SWOICH fiszek (wybrana talia albo wszystkie nauczone),
   każdy ma swoją głowę hydry – po jej ścięciu Twoje ciosy lecą w pozostałe. Kto padnie, leży: kolega reanimuje go
   3 dobrymi odpowiedziami, a leżący może wstać sam po 5 dobrych odpowiedziach. Przegrana = wszyscy leżą naraz.
   Komunikacja przez ten sam kanał co bitwy (Supabase Realtime / przekaźnik); wiadomości są sprawdzane (sanitize). */

let COOP = null, COOP_SRC = 'all', COOP_JOIN = '';
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
  if (C.host && C.phase === 'lobby') coopSend({ t: 'lobby', players: Object.values(C.players).map(({ seen, ...p }) => p) });
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
    coopSend({ t: 'lobby', players: Object.values(C.players).map(({ seen, ...x }) => x) }); return render();
  }
  if (m.t === 'full') { toast('Lobby jest pełne'); return coopLeave(); }
  if (m.t === 'lobby' && !C.host && m.players) {
    if (!m.players.some(x => x.id === MY_ID)) return;
    C.hostId = m.from; for (const x of m.players) C.players[x.id] = { ...(C.players[x.id] || {}), ...x, seen: Date.now() }; return render();
  }
  if (m.t === 'start' && !C.host && m.from === C.hostId && C.phase === 'lobby' && m.heads) return coopBegin(m.heads, m.seed);
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
  coopSend({ t: 'start', heads, seed }); coopBegin(heads, seed);
}
function coopBegin(heads, seed) {
  const C = COOP; C.phase = 'fight'; C.heads = heads.map(h => ({ ...h, hp: h.max })); C.rev = {};
  const cs = S.cards.filter(c => fightable(c) && c.srs.state !== 'new' && (COOP_SRC === 'all' || c.deckId === COOP_SRC));
  if (cs.length < 10) { toast('Masz za mało nauczonych fiszek (min. 10) – walczysz tym, co jest', 3500); }
  const n = Object.keys(C.players).length, diff = Math.min(4, 1 + Math.floor(heroLv() / 6));
  const b = { kind: 'hydra', id: 'hydra', name: n > 2 ? `Hydra ${n}-głowa` : 'Hydra', desc: 'Każdy z Was bije swoją głowę.', img: 'w_snake', persona: HYDRA_TALK, diff, stars: 0, cards: cs.length ? cs : S.cards.filter(fightable), ok: true, repeat: false, pr: hero().pr || 0, len: 30, title: `Lobby ${C.code}`, seed };
  const p = bossParams(b); const mine = C.heads.find(h => h.id === MY_ID); p.hp = mine?.max || p.hp;
  bossBegin(b, { coop: true }, p);
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
  const down = Object.values(C.players).find(p => p.id !== MY_ID && p.down && !p.gone); if (!down) return;
  C.rev[down.id] = (C.rev[down.id] || 0) + 1;
  if (C.rev[down.id] >= 3) { C.rev[down.id] = 0; coopSend({ t: 'revive', to: down.id }); BOSS.log.unshift(`💚 Reanimujesz: ${down.nick}!`); down.down = false; S.stats.coopRevives = (S.stats.coopRevives || 0) + 1; }
  else BOSS.log.unshift(`💚 Reanimacja ${down.nick}: ${C.rev[down.id]}/3`);
}
const coopMates = () => Object.values(COOP?.players || {}).filter(p => p.id !== MY_ID && !p.gone);
const coopLost = () => !!BOSS?.down && coopMates().every(p => p.down);
function coopSync() { const B = BOSS; if (B?.coop) coopSend({ t: 'state', hp: Math.max(0, Math.round(B.me)), max: B.meMax, down: !!B.down, combo: B.combo }); }
function coopEnd(won) { if (COOP) COOP.phase = 'end'; S.stats.coopFights = (S.stats.coopFights || 0) + 1; if (won) S.stats.coopWins = (S.stats.coopWins || 0) + 1; }
function coopLeave() { if (!COOP) return; coopSend({ t: 'leave' }); clearTimeout(COOP.beat); COOP.ch?.close(); COOP = null; }
const pHero = p => heroSVG('xs', p.pr, { eq: {}, line: p.line, g: p.g, pr: p.pr, look: p.look });
function coopHeadsHTML(fx, act) {
  const C = COOP; if (!C) return '';
  return `<div class="hydra">${C.heads.map(h => { const p = C.players[h.id], mine = h.id === MY_ID, dead = h.hp <= 0;
    return `<div class="hhead${mine ? ' mine' : ''}${dead ? ' dead' : ''}${mine && fx ? ' hit' : ''}${act ? ' attack' : ''}"><div class="boss-art world"><img src="assets/fluent/w_snake.webp" alt=""></div>${mine && fx ? `<b class="dmg${fx.crit ? ' crit' : ''}">${fx.n !== '' ? '−' + fx.n : ''}</b>` : ''}
      <small>${dead ? '✓ ścięta' : mine ? 'Twoja głowa' : esc(p?.nick || 'kolega')}</small>${HP_BAR(h.hp, h.max, 'boss')}</div>`; }).join('')}</div>`;
}
function coopMatesHTML() {
  const ms = coopMates(); if (!ms.length) return '';
  return `<div class="mates">${ms.map(p => `<div class="mate${p.down ? ' down' : ''}">${pHero(p)}<b>${esc(p.nick)}</b>${p.max ? HP_BAR(p.hp || 0, p.max, 'me') : ''}${p.down ? `<small>💀 leży · reanimuj: ${(COOP.rev[p.id] || 0)}/3</small>` : p.combo >= 2 ? `<small>🔥 ${p.combo}</small>` : ''}</div>`).join('')}</div>`;
}
ROUTES.coop = parts => {
  if (parts[1] && !COOP && /^[A-Z0-9]{6}$/i.test(parts[1])) { COOP_JOIN = parts[1].toUpperCase(); }
  if (BOSS?.coop && BOSS.phase === 'fight') return ROUTES.boss(['boss', 'fight']);
  const C = COOP, src = `<select data-coop-src="1" class="grow"><option value="all">Wszystkie nauczone fiszki</option>${S.decks.map(d => `<option value="${d.id}" ${COOP_SRC === d.id ? 'selected' : ''}>${esc(d.name)} (${deckLearned(d)})</option>`).join('')}</select>`;
  const modes = `<div class="mode-pick">${Object.entries(MODES).map(([k, m]) => `<button class="${BOSS_PICK.mode === k ? 'on' : ''}" data-act="boss-mode" data-m="${k}"><span>${m.icon}</span><b>${m.name}</b><small>cios ${m.mul}</small></button>`).join('')}</div>`;
  if (!C || C.phase === 'end') return { tab: 'arena', html: `
    <div class="row nowrap"><button class="iconbtn" data-go="#/boss">‹</button><h1 class="grow" style="margin:0">👥 Lobby – Hydra</h1></div>
    <div class="card center"><img src="assets/fluent/w_snake.webp" alt="" style="width:110px;height:110px"><p style="margin:6px 0">Ucz się z kolegą i bijcie razem hydrę. <b>Każdy odpowiada na swoje fiszki</b> – Ty możesz mieć anatomię, kolega angielski.</p>
      <ul class="small" style="text-align:left;margin:0"><li>Każdy ma swoją głowę hydry. Ściąłeś swoją? Pomagasz koledze.</li><li>Ktoś padł? 3 dobre odpowiedzi kolegi go reanimują (albo sam wstanie po 5).</li><li>Przegrana walka w lobby nie zabiera serc.</li></ul></div>
    <div class="card"><h3 style="margin-top:0">Twój materiał</h3><div class="row nowrap">${src}</div><h3>Tryb</h3>${modes}</div>
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
    <div class="card"><h3 style="margin-top:0">Twój materiał</h3><div class="row nowrap">${src}</div><h3>Tryb</h3>${modes}</div>
    ${C.host ? `<button class="primary block boss-go" data-act="coop-start" ${ps.length < 2 ? 'disabled' : ''}>⚔️ Start – Hydra ${ps.length}-głowa</button>` : '<p class="center muted">Host rozpocznie walkę…</p>'}` };
};
document.addEventListener('change', e => { if (e.target.dataset?.coopSrc) { COOP_SRC = e.target.value; } });
Object.assign(ACTIONS, {
  'coop-host': () => { coopOpen(roomCode(), true); render(); },
  'coop-join': () => { const code = ($('#coop-code')?.value || '').trim().toUpperCase(); if (!/^[A-Z0-9]{6}$/.test(code)) return toast('Kod ma 6 znaków'); COOP_JOIN = ''; coopOpen(code, false); render(); },
  'coop-start': () => coopStartHost(),
  'coop-leave': () => { coopLeave(); go('#/coop'); render(); },
  'coop-share': el => { const link = el.dataset.link, txt = `Chodź bić hydrę w Fiszkach! Kod lobby: ${COOP.code}`; if (navigator.share) navigator.share({ title: 'Fiszki – lobby', text: txt, url: link }).catch(() => {}); else { navigator.clipboard?.writeText(`${txt} ${link}`); toast('📋 Skopiowano zaproszenie'); } },
});
HUB_OF.coop = 'arena';

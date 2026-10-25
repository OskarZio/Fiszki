'use strict';
/* 🔒 Oczyszczanie danych od innych osób (bitwy na żywo, teleturniej, wiadomości, wspólne talie).
   Zasada: z cudzych danych bierzemy tylko znane pola, liczby jako liczby, teksty przycięte, id sprawdzone wzorcem.
   Dzięki temu nawet spreparowana wiadomość nie wstrzyknie kodu ani nie zawiesi aplikacji. */

const sStr = (v, max = 200) => typeof v === 'string' ? v.slice(0, max) : typeof v === 'number' && Number.isFinite(v) ? String(v).slice(0, max) : '';
const sNum = (v, min = 0, max = 1e9, def = 0) => { const x = +v; return Number.isFinite(x) ? Math.max(min, Math.min(max, x)) : def; };
const sInt = (v, min = 0, max = 1e9, def = 0) => Math.round(sNum(v, min, max, def));
const sId = (v, re = /^[A-Za-z0-9_-]{1,64}$/) => typeof v === 'string' && re.test(v) ? v : '';
const sBool = v => v === true || v === 1;
const sArr = (v, max, fn) => Array.isArray(v) ? v.slice(0, max).map(fn) : [];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sColor = v => typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : '#6366f1';

// profil przeciwnika / gracza (nick, awatar, poziom…)
function sPeer(p) {
  p = p && typeof p === 'object' ? p : {};
  return { nick: sStr(p.nick, 24) || 'Gracz', avatar: sStr(p.avatar, 16) || '🦊', avatarImg: typeof safeImg === 'function' ? safeImg(p.avatarImg) : null,
    level: sInt(p.level, 0, 1e4, 1), elo: sInt(p.elo, 0, 5000, 1000), showcase: sArr(p.showcase, 3, x => sId(x, /^[a-z0-9_-]{1,24}$/)).filter(Boolean),
    winGif: sId(p.winGif) || null };
}
// ustawienia bitwy od gospodarza
function sSetup(st) {
  if (!st || typeof st !== 'object') return null;
  const o = st.opts && typeof st.opts === 'object' ? st.opts : {};
  const opts = { learnSec: sInt(o.learnSec, 0, 3600), ansSec: sInt(o.ansSec, 0, 600), tol: ['strict', 'normal', 'lenient'].includes(o.tol) ? o.tol : 'normal',
    live: o.live !== false, sab: sBool(o.sab), abcd: sBool(o.abcd), dir: ['qa', 'aq', 'mix'].includes(o.dir) ? o.dir : 'qa' };
  if (st.mode === 'mem') {
    const disc = typeof DISC !== 'undefined' && Object.hasOwn(DISC, st.disc) ? st.disc : 'numbers';
    return { mode: 'mem', disc, seed: sInt(st.seed, 0, 2 ** 31), n: st.n == null ? undefined : sInt(st.n, 3, 200, 20), memo: st.memo == null ? undefined : sInt(st.memo, 0, 3600, 60), opts };
  }
  const cards = sArr(st.cards, 50, c => ({ q: sStr(c?.q, 600), a: sStr(c?.a, 200), ctx: sStr(c?.ctx, 400), ...(Array.isArray(c?.opts) ? { opts: c.opts.slice(0, 6).map(x => sStr(x, 200)) } : {}) })).filter(c => c.q && c.a);
  if (cards.length < 1) return null;
  return { mode: 'cards', deckId: sId(st.deckId) || undefined, deckName: sStr(st.deckName, 60), cards, opts };
}
// wiadomość w pokoju bitwy
function sBattleMsg(m) {
  if (!m || typeof m !== 'object' || typeof m.t !== 'string') return null;
  const out = { t: sStr(m.t, 20), from: sStr(m.from, 64), to: m.to == null ? undefined : sStr(m.to, 64), ...sPeer(m) };
  if ('setup' in m) out.setup = sSetup(m.setup);
  if ('host' in m) out.host = sPeer(m.host);
  for (const k of ['ms', 'total', 'ts']) if (k in m) out[k] = sNum(m[k], 0, 1e13);
  if ('i' in m) out.i = sInt(m.i, 0, 1000);
  if ('given' in m) out.given = sStr(m.given, 300);
  if ('k' in m) out.k = sId(m.k, /^[a-z0-9_-]{1,24}$/);
  if ('shiny' in m) out.shiny = sInt(m.shiny === true ? 1 : m.shiny, 0, 2);
  if ('answers' in m) out.answers = sArr(m.answers, 300, x => sStr(x, 40));
  if ('room' in m) out.room = sId(m.room, /^[A-Z0-9]{4,10}$/);
  return out;
}
// wiadomość z bazy (czat, prezent, wyzwanie, wspólna talia…): znane pola, typy, długości
function sMsgBody(b) {
  b = b && typeof b === 'object' && !Array.isArray(b) ? b : {};
  const out = {};
  if ('text' in b) out.text = sStr(b.text, 1000);
  if ('st' in b) out.st = sId(b.st, /^[a-z0-9_-]{1,24}$/);
  if ('shiny' in b) out.shiny = sInt(b.shiny === true ? 1 : b.shiny, 0, 2);
  if ('gif' in b) out.gif = sId(b.gif);
  if ('code' in b) out.code = sId(b.code, /^[A-Z0-9]{4,10}$/);
  if ('deck' in b) out.deck = sStr(b.deck, 80);
  for (const k of ['n', 'ref']) if (k in b) out[k] = sInt(b[k], 0, 1e6);
  if ('sd' in b) out.sd = sId(b.sd);
  if ('sdi' in b && b.sdi && typeof b.sdi === 'object') out.sdi = { id: sId(b.sdi.id), name: sStr(b.sdi.name, 60), owner: sId(b.sdi.owner, UUID_RE), members: sArr(b.sdi.members, 50, x => sId(x, UUID_RE)).filter(Boolean) };
  if ('members' in b) out.members = sArr(b.members, 50, x => sId(x, UUID_RE)).filter(Boolean);
  if ('del' in b) out.del = sArr(b.del, 200, x => sId(x)).filter(Boolean);
  if ('notes' in b) out.notes = sArr(b.notes, 100, sNote).filter(Boolean);
  return out;
}
// fiszka ze wspólnej talii: tylko pola tekstowe, bez typów z obrazami
function sNote(x) {
  if (!x || typeof x !== 'object') return null;
  const id = sId(x.id, /^[A-Za-z0-9_-]{1,40}$/); if (!id) return null;
  const type = ['basic', 'cloze'].includes(x.type) ? x.type : null; if (!type) return null;
  const n = { id, type, mod: sNum(x.mod, 0, 1e13), created: sNum(x.created, 0, 1e13) };
  for (const [k, max] of [['front', 2000], ['back', 2000], ['hint', 1000], ['extra', 2000], ['text', 4000], ['title', 200]]) if (typeof x[k] === 'string') n[k] = x[k].slice(0, max);
  if ('reverse' in x) n.reverse = sBool(x.reverse);
  return n;
}
// teleturniej: stan od gospodarza – tylko znane pola; liczby jako liczby, id tylko „bezpieczne” (litery/cyfry), kolory jako #hex
const sKey = v => typeof v === 'string' && /^[\w-]{1,64}$/.test(v) ? v : null;
const sFlat = o => o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).slice(0, 60).filter(([k]) => sKey(k)).map(([k, v]) =>
  [k, typeof v === 'number' ? sNum(v, -1e9, 1e13) : typeof v === 'boolean' ? v : v && typeof v === 'object' ? sFlat(v) : sKey(v)])) : null;
const sMsgRow = m => m && typeof m === 'object' ? { id: sInt(m.id, 0, 1e15), from_id: sId(m.from_id, UUID_RE), to_id: sId(m.to_id, UUID_RE),
  kind: ['text', 'gift', 'nudge', 'challenge'].includes(m.kind) ? m.kind : 'text', body: sMsgBody(m.body), created_at: sStr(m.created_at, 40), read_at: m.read_at ? sStr(m.read_at, 40) : null } : null;
function sShowState(m) {
  const ph = sKey(m.phase) || 'nohost';
  const rounds = Array.isArray(m.rounds) ? m.rounds.slice(0, 20).map(r => { const b = SHOW_ROUNDS.find(x => x.k === r?.k);
    return b ? { ...b, n: sInt(r.n, 1, 50, b.n), sec: sInt(r.sec, 3, 180, b.sec), desc: esc(sStr(r.desc, 400) || b.desc) } : null; }).filter(Boolean) : undefined;
  const q = m.q && typeof m.q === 'object' ? { q: sStr(m.q.q, 600), opts: sArr(m.q.opts, 6, x => sStr(x, 200)), ...('a' in m.q ? { a: sStr(m.q.a, 200) } : {}) } : null;
  return { t: 'state', phase: ph, pin: sId(m.pin, /^\d{6}$/), r: sInt(m.r, 0, 50), rq: sInt(m.rq, 0, 500), qi: sInt(m.qi, 0, 5000),
    players: sArr(m.players, 30, p => ({ id: sKey(p?.id) || '', name: sStr(p?.name, 24) || 'Gracz', av: sStr(p?.av, 16) || '🙂', color: sColor(p?.color),
      score: sInt(p?.score, -1e7, 1e7), bet: sInt(p?.bet, 0, 1e6), bot: !!p?.bot, left: !!p?.left, hp: sInt(p?.hp, -1e5, 1e5), out: !!p?.out, gif: sKey(p?.gif) })),
    ...(rounds ? { rounds } : {}), pace: sKey(m.pace) || 'normal', hpBase: sInt(m.hpBase, 1, 10000, 100), vamp: m.vamp !== false, shooter: sKey(m.shooter), hit: sFlat(m.hit),
    src: m.src === 'cat' ? 'cat' : 'deck', cat: sKey(m.cat), picker: sKey(m.picker), catOpts: sArr(m.catOpts, 12, sKey).filter(Boolean),
    pickLeft: sNum(m.pickLeft, 0, 1e6), aimEnd: sNum(m.aimEnd, 0, 1e6), q, left: sNum(m.left, 0, 1e6), ans: sFlat(m.ans) || {}, locked: sFlat(m.locked) || {}, gain: sFlat(m.gain) || {},
    host: sStr(m.host, 300), stealInfo: sStr(m.stealInfo, 300), winner: sKey(m.winner), dmg: sInt(m.dmg, 0, 1e5) };
}
// obrazki z importu / synchronizacji: tylko data:image;base64 (bez cudzysłowów – nie da się wyjść z atrybutu src)
const okImgData = d => typeof d === 'string' && d.length < 15e6 && /^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+$/i.test(d);
const okId = id => typeof id === 'string' && /^[A-Za-z0-9_:.-]{1,80}$/.test(id);

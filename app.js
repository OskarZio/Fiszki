'use strict';
/* Fiszki – lekka kopia Anki jako aplikacja webowa (PWA).
   Wszystko działa w przeglądarce; dane trzymane są w IndexedDB na urządzeniu,
   a opcjonalna synchronizacja telefon ⇄ komputer idzie przez prywatny GitHub Gist. */

// ============================================================ Narzędzia
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = s => esc(s).replace(/\n/g, '<br>');
const MIN = 60e3, HOUR = 36e5, DAY = 864e5;
const APP_VERSION = '53';   // podbijaj razem z CACHE w sw.js
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Dzień nauki zaczyna się o 4:00 (jak w Anki), żeby nocna nauka liczyła się do poprzedniego dnia.
function dayStart(t = Date.now()) {
  const d = new Date(t); d.setHours(4, 0, 0, 0);
  if (d.getTime() > t) d.setDate(d.getDate() - 1);
  return d.getTime();
}
function addDays(ts, n) { const d = new Date(ts); d.setDate(d.getDate() + n); return d.getTime(); }
function dayKey(t) {
  const d = new Date(dayStart(t));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function human(ms) {
  if (ms < HOUR) return Math.max(1, Math.round(ms / MIN)) + ' min';
  if (ms < DAY) return Math.round(ms / HOUR) + ' godz.';
  const d = ms / DAY;
  if (d < 30) return Math.round(d) + ' d';
  if (d < 365) return +(d / 30).toFixed(1) + ' mies.';
  return +(d / 365).toFixed(1) + ' lat';
}
function ago(t) {
  if (!t) return 'nigdy';
  const s = Date.now() - t;
  if (s < MIN) return 'przed chwilą';
  return human(s) + ' temu';
}
function plural(n, one, few, many) {
  if (n === 1) return one;
  const d = n % 10, dd = n % 100;
  return d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? few : many;
}
function toast(msg, ms = 2200) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), ms);
}
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
// iPhone/iPad nie zna typów takich jak .apkg – z filtrem takie pliki są wyszarzone w „Plikach”.
// Dlatego na iOS przy nietypowych plikach pokazujemy wszystkie, a typ sprawdzamy po wybraniu.
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function fixSafeTop() {
  const root = document.documentElement;
  if (!document.getElementById('sbar')) { const b = document.createElement('div'); b.id = 'sbar'; document.body.append(b); }
  if (!IS_IOS || !(navigator.standalone || matchMedia('(display-mode: standalone)').matches)) return root.style.removeProperty('--sat-fb');
  const t = document.createElement('div'); t.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top);visibility:hidden'; document.body.append(t);
  const h = t.getBoundingClientRect().height; t.remove();
  // zapas tylko, gdy iPhone naprawdę zgłasza 0 – inaczej używamy jego wartości (bez sumowania)
  const full = Math.abs(Math.max(innerHeight, document.documentElement.clientHeight) - (innerWidth < innerHeight ? Math.max(screen.height, screen.width) : Math.min(screen.height, screen.width))) < 8;
  if (h < 1 && full) root.style.setProperty('--sat-fb', (Math.max(screen.height, screen.width) >= 812 ? 50 : 20) + 'px'); else root.style.removeProperty('--sat-fb');
}
document.addEventListener('DOMContentLoaded', () => { fixSafeTop(); setTimeout(fixSafeTop, 700); setTimeout(fixSafeTop, 2000); });
window.addEventListener('orientationchange', () => setTimeout(fixSafeTop, 300));
window.addEventListener('scroll', () => document.documentElement.classList.toggle('scrolled', scrollY > 4), { passive: true });
function pickFile(accept) {
  if (IS_IOS && accept && !/(image|audio|video)\/\*/.test(accept)) accept = '';
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; if (accept) i.accept = accept; i.style.display = 'none';
    i.onchange = () => { res(i.files[0] || null); i.remove(); };
    document.body.append(i); i.click();
  });
}

// ============================================================ Baza danych (IndexedDB)
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('fiszki', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  tx(mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction('kv', mode); const req = fn(t.objectStore('kv'));
      t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error);
    });
  },
  get(k) { return this.tx('readonly', s => s.get(k)); },
  set(k, v) { return this.tx('readwrite', s => s.put(v, k)); },
  del(k) { return this.tx('readwrite', s => s.delete(k)); },
  keys() { return this.tx('readonly', s => s.getAllKeys()); },
};

// ============================================================ Stan aplikacji
const DEFAULT_SETTINGS = {
  newPerDay: 20, goal: 50, reminder: '19:00', hideAll: true,
  autoSync: true, sync: { token: '', gistId: '' }, lastSync: 0, lastDeck: null,
  aiKey: '', aiModel: 'claude-opus-5-5',
  minimal: false, mode: 'full', gradients: true, stickerAnim: true,
  cardSize: 1, cardFont: 'system', cardAlign: 'center', radius: 'soft', compact: false, showIvl: true, grade2: false, tts: false, tabLabels: true, steps: '1 10', relearn: '10', maxIvl: 36500, tolerance: 'normal', sound: true, anim: true, easyBonus: 1.3,
};
let S;            // wszystkie dane (bez obrazów)
const IMG = {};   // id -> dataURL
let saveTimer;

function blankState() {
  return { v: 1, decks: [], notes: [], cards: [], palaces: [], log: [], tomb: {}, settings: structuredClone(DEFAULT_SETTINGS), ...extraState() };
}
// pola dodane w kolejnych wersjach (tematy, znajomi, gry, osiągnięcia, system liczbowy)
function extraState() { return { topics: [], friends: [], games: [], ach: {}, stats: {}, major: { words: {}, mod: 0 }, profile: { nick: '', avatar: '🦊', mod: 0 }, wallet: [], items: [], battles: [], stickies: [], atlases: [], events: [], logins: [] }; }

// Proste zdarzenia, na które reagują moduły (osiągnięcia, ranking…)
const HOOKS = {};
const on = (name, fn) => (HOOKS[name] || (HOOKS[name] = [])).push(fn);
const emit = (name, ...a) => (HOOKS[name] || []).forEach(fn => { try { fn(...a); } catch (e) { console.error(e); } });
// Dodatkowe ekrany rejestrowane przez moduły: ROUTES.nazwa = parts => ({ html, tab, focus })
const ROUTES = {};
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { DB.set('state', S); updateBadge(); scheduleSync(); emit('save'); }, 200);
}
function touch(o) { o.mod = Date.now(); return o; }
async function putImage(dataUrl) {
  const id = 'i' + uid(); IMG[id] = dataUrl; await DB.set('img:' + id, dataUrl); return id;
}
function referencedImages() {
  const s = new Set();
  S.notes.forEach(n => { n.imageId && s.add(n.imageId); n.backImageId && s.add(n.backImageId); });
  S.palaces.forEach(p => p.stations.forEach(st => st.imageId && s.add(st.imageId)));
  (S.atlases || []).forEach(a => { a.imageId && s.add(a.imageId); (a.draws || []).forEach(d => s.add(d.imageId)); });
  (S.topics || []).forEach(t => t.items.forEach(it => (it.images || []).forEach(g => s.add(g.id))));
  return s;
}
// Obrazy usuwamy dopiero po 31 dniach od dodania – kosz i kopie lokalne mogą ich jeszcze potrzebować.
const imgTime = id => parseInt(String(id).slice(1, 9), 36) || 0;
async function gcImages() {
  const used = referencedImages(), old = Date.now() - 31 * DAY;
  for (const id of Object.keys(IMG)) if (!used.has(id) && imgTime(id) < old) { delete IMG[id]; await DB.del('img:' + id); }
}

// ============================================================ Talie, notatki, karty
const CLOZE_RE = /\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;
const deckById = id => S.decks.find(d => d.id === id);
const noteById = id => S.notes.find(n => n.id === id);
const palaceById = id => S.palaces.find(p => p.id === id);

function newDeck(name) {
  const d = touch({ id: uid(), name: (name || '').trim() || 'Nowa talia', created: Date.now() });
  S.decks.push(d); save(); return d;
}
function newSrs() { return { state: 'new', due: 0, ivl: 0, ease: 2.5, reps: 0, lapses: 0, step: 0 }; }

// Z jednej notatki powstaje kilka kart (np. każda luka = osobna karta).
function noteOrds(n) {
  if (n.type === 'cloze') {
    const s = new Set(); for (const m of n.text.matchAll(CLOZE_RE)) s.add(m[1]);
    return [...s].sort((a, b) => a - b);
  }
  if (n.type === 'occl') return n.boxes.map(b => b.id);
  return n.reverse ? ['f', 'r'] : ['f'];
}
function syncCards(n) {
  const ords = noteOrds(n);
  const existing = S.cards.filter(c => c.noteId === n.id);
  for (const c of existing) {
    if (!ords.includes(c.ord)) removeCard(c);
    else if (c.deckId !== n.deckId) touch(Object.assign(c, { deckId: n.deckId }));
  }
  ords.forEach((o, i) => {
    if (!existing.some(c => c.ord === o))
      S.cards.push(touch({ id: uid(), noteId: n.id, deckId: n.deckId, ord: o, pos: n.created + i / 1000, srs: newSrs() }));
  });
}
function removeCard(c) { S.cards = S.cards.filter(x => x !== c); S.tomb[c.id] = Date.now(); }
function addNote(fields) {
  const n = touch({ id: uid(), created: Date.now(), ...fields });
  S.notes.push(n); syncCards(n); return n;
}
function deleteNote(n, silent) {
  if (!silent) emit('deleting', 'note', { note: n, cards: S.cards.filter(c => c.noteId === n.id) });
  S.cards.filter(c => c.noteId === n.id).forEach(removeCard);
  S.notes = S.notes.filter(x => x !== n); S.tomb[n.id] = Date.now();
}
function deleteDeck(d) {
  const notes = S.notes.filter(n => n.deckId === d.id);
  emit('deleting', 'deck', { deck: d, notes: notes.map(n => ({ note: n, cards: S.cards.filter(c => c.noteId === n.id) })) });
  notes.forEach(n => deleteNote(n, true));
  S.decks = S.decks.filter(x => x !== d); S.tomb[d.id] = Date.now();
  save(); gcImages();
}

// ============================================================ Algorytm powtórek (SM-2 jak w Anki)
// kroki nauki w minutach – można je zmienić w ustawieniach (np. „1 10 60”)
const parseSteps = (str, def) => { const a = String(str || '').split(/[\s,;]+/).map(Number).filter(x => x > 0 && x < 1440 * 7); return a.length ? a : def; };
const LEARN_STEPS = () => parseSteps(S?.settings?.steps, [1, 10]);
const RELEARN_STEPS = () => parseSteps(S?.settings?.relearn, [10]);

function schedule(srs, g, now = Date.now(), fuzzy = true) {
  const s = { ...srs }; s.reps++;
  const sod = dayStart(now);
  const fuzz = ivl => !fuzzy || ivl < 3 ? ivl : Math.round(ivl * (0.95 + Math.random() * 0.1));
  const LEARN = LEARN_STEPS(), RELEARN = RELEARN_STEPS(), maxIvl = S?.settings?.maxIvl || 36500, easy = S?.settings?.easyBonus || 1.3;
  const toReview = ivl => { ivl = Math.min(ivl, maxIvl); s.state = 'review'; s.ivl = ivl; s.step = 0; s.due = addDays(sod, ivl); };
  if (s.state === 'new' || s.state === 'learning') {
    s.state = 'learning';
    if (g === 1) { s.step = 0; s.due = now + LEARN[0] * MIN; }
    else if (g === 2) s.due = now + (s.step === 0 ? (LEARN[0] + LEARN[1]) / 2 : LEARN[s.step]) * MIN;
    else if (g === 3) { s.step++; if (s.step >= LEARN.length) toReview(1); else s.due = now + LEARN[s.step] * MIN; }
    else toReview(4);
  } else if (s.state === 'relearn') {
    if (g === 1) { s.step = 0; s.due = now + RELEARN[0] * MIN; }
    else if (g === 2) s.due = now + RELEARN[0] * 1.5 * MIN;
    else toReview(g === 4 ? s.ivl + 1 : s.ivl);
  } else {
    const late = Math.max(0, Math.floor((now - s.due) / DAY));
    if (g === 1) {
      s.lapses++; s.ease = Math.max(1.3, s.ease - 0.2); s.ivl = Math.max(1, Math.round(s.ivl * 0.2));
      s.state = 'relearn'; s.step = 0; s.due = now + RELEARN[0] * MIN;
    } else if (g === 2) { s.ease = Math.max(1.3, s.ease - 0.15); toReview(Math.max(s.ivl + 1, fuzz(Math.round(s.ivl * 1.2)))); }
    else if (g === 3) toReview(Math.max(s.ivl + 1, fuzz(Math.round((s.ivl + late / 2) * s.ease))));
    else { s.ease += 0.15; toReview(Math.max(s.ivl + 2, fuzz(Math.round((s.ivl + late) * s.ease * easy)))); }
  }
  return s;
}
const isLearning = c => c.srs.state === 'learning' || c.srs.state === 'relearn';

function introducedToday() {
  const sod = dayStart(), out = {};
  for (let i = S.log.length - 1; i >= 0 && S.log[i].t >= sod; i--) if (S.log[i].n) out[S.log[i].d] = (out[S.log[i].d] || 0) + 1;
  return out;
}
function reviewsToday() {
  const sod = dayStart(); let n = 0;
  for (let i = S.log.length - 1; i >= 0 && S.log[i].t >= sod; i--) n++;
  return n;
}
function deckCounts(deckId, noLimit) {
  const eod = addDays(dayStart(), 1), intro = introducedToday();
  const per = {};
  for (const c of S.cards) {
    if (deckId !== 'all' && c.deckId !== deckId) continue;
    const p = per[c.deckId] || (per[c.deckId] = { n: 0, l: 0, r: 0 });
    if (c.srs.state === 'new') p.n++;
    else if (c.srs.due < eod) isLearning(c) ? p.l++ : p.r++;
  }
  let nw = 0, lrn = 0, rev = 0;
  for (const id in per) {
    nw += noLimit ? per[id].n : Math.min(per[id].n, Math.max(0, S.settings.newPerDay - (intro[id] || 0)));
    lrn += per[id].l; rev += per[id].r;
  }
  return { nw, lrn, rev, total: nw + lrn + rev };
}
function streak() {
  const days = new Set(S.log.map(l => dayKey(l.t)));
  let t = dayStart(), n = 0;
  if (!days.has(dayKey(t))) t = addDays(t, -1);
  while (days.has(dayKey(t))) { n++; t = addDays(t, -1); }
  return n;
}
const difficultCards = () => S.cards.filter(c => c.srs.lapses >= 2 || (c.srs.state === 'relearn'));

// ============================================================ Wygląd karty
function clozeHTML(text, ord, reveal) {
  let out = '', last = 0;
  for (const m of text.matchAll(CLOZE_RE)) {
    out += fmt(text.slice(last, m.index)); last = m.index + m[0].length;
    if (m[1] !== ord) out += fmt(m[2]);
    else if (reveal) out += `<span class="cloze">${fmt(m[2])}</span>`;
    else out += `<span class="cloze q">[${m[3] ? fmt(m[3]) : '…'}]</span>`;
  }
  return out + fmt(text.slice(last));
}
const clozePlain = text => text.replace(CLOZE_RE, (_, n, a) => a);

function occlHTML(n, targetId, reveal, extraCls = '') {
  const src = IMG[n.imageId];
  if (!src) return '<p class="muted">(brak obrazu – zsynchronizuj urządzenie)</p>';
  const pins = n.style === 'pin';
  const marks = n.boxes.map((b, i) => {
    const t = b.id === targetId;
    if (pins) {
      const cls = t ? (reveal ? 'pin rev' : 'pin target') : 'pin dim';
      return `<div class="${cls}" style="left:${b.x * 100}%;top:${b.y * 100}%">${t && !reveal ? '?' : i + 1}</div>`;
    }
    if (!t && !n.hideAll) return '';
    const cls = t ? (reveal ? 'ob rev' : 'ob target') : 'ob';
    return `<div class="${cls}" style="left:${b.x * 100}%;top:${b.y * 100}%;width:${b.w * 100}%;height:${b.h * 100}%">${t && !reveal ? '?' : ''}</div>`;
  }).join('');
  return `<div class="occl ${extraCls}"><img src="${src}" alt="">${marks}</div>`;
}

// Zwraca: q (pytanie), a (odpowiedź), ans (tekst odpowiedzi do wpisywania/testu), hints, label (krótki opis)
function cardView(c) {
  const n = noteById(c.noteId);
  if (!n) return { q: '', a: '', ans: '', hints: [], label: '?' };
  const extra = n.extra ? `<div class="extra">${fmt(n.extra)}</div>` : '';
  const hints = [];
  if (n.type === 'cloze') {
    const ms = [...n.text.matchAll(CLOZE_RE)].filter(m => m[1] === c.ord);
    ms.forEach(m => m[3] && hints.push(m[3]));
    if (n.hint) hints.push(n.hint);
    return {
      q: `<div class="ctext">${clozeHTML(n.text, c.ord, false)}</div>`,
      a: `<div class="ctext">${clozeHTML(n.text, c.ord, true)}</div>${extra}`,
      ans: ms.map(m => m[2].trim()).join(', '), hints, label: clozePlain(n.text),
    };
  }
  if (n.type === 'occl') {
    const i = n.boxes.findIndex(b => b.id === c.ord), b = n.boxes[i] || {};
    if (b.hint) hints.push(b.hint);
    if (n.hint) hints.push(n.hint);
    const title = n.title ? `<div class="qtitle">${fmt(n.title)}</div>` : '';
    return {
      q: title + occlHTML(n, c.ord, false),
      a: title + occlHTML(n, c.ord, true) + `<div class="ansline">${fmt(b.label || '')}</div>${extra}`,
      ans: (b.label || '').trim(), hints, label: `${n.title || 'Obraz'} – luka ${i + 1}`, noteId: n.id,
    };
  }
  const fwd = c.ord !== 'r';
  const img = n.imageId && IMG[n.imageId] ? `<img class="cimg" src="${IMG[n.imageId]}" alt="">` : '';
  const front = fwd ? n.front : n.back, back = fwd ? n.back : n.front;
  if (n.hint) hints.push(n.hint);
  const q = (fwd ? img : '') + `<div class="ctext">${fmt(front)}</div>`;
  const bimg = n.backImageId && IMG[n.backImageId] ? `<img class="cimg" src="${IMG[n.backImageId]}" alt="">` : '';
  const q2 = fwd ? q : bimg + `<div class="ctext">${fmt(front)}</div>`;
  return { q: q2, a: q2 + `<hr><div class="ctext">${fmt(back)}</div>${fwd ? bimg : img}${extra}`, ans: (back || '').trim(), hints, label: (front || '').trim() || '(obraz)' };
}

// ============================================================ Sprawdzanie wpisanej odpowiedzi
function norm(s) {
  return String(s).toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
// tol: 'strict' – tylko dokładnie (bez wielkości liter i interpunkcji), 'normal' – drobne literówki, 'lenient' – więcej literówek
function checkAnswer(input, correct, tol = S?.settings?.tolerance || 'normal') {
  const x = norm(input); if (!x) return 'wrong';
  const alts = [correct, ...String(correct).split(/[\/;|,]| lub | albo /)].map(norm).filter(Boolean);
  if (alts.includes(x)) return 'ok';
  if (tol === 'strict') return 'wrong';
  const f = tol === 'lenient' ? 0.34 : 0.2;
  const close = alts.some(a => lev(x, a) <= Math.max(1, Math.floor(a.length * f)));
  return close ? 'close' : 'wrong';
}

// ============================================================ Sesja nauki
let SESSION = null;

function startSession(deckId, mode, cramIds = null, all = false) {
  SESSION = { all,
    key: `${deckId}/${mode}/${cramIds ? 'cram' : ''}`, deckId, mode, cram: cramIds ? shuffle([...cramIds]) : null,
    done: 0, card: null, shown: false, hint: false, typed: null, verdict: null, undo: null, lastNote: null, shownAt: 0,
  };
  nextCard();
}
// Talia „mieszana”: nowe karty w losowej (ale stałej) kolejności – terminy, luki i obrazy przeplatają się
const idHash = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
function newOrderKey(cards) {
  const rng = {};
  for (const c of cards) { if (!deckById(c.deckId)?.mix) continue; const r = rng[c.deckId] = rng[c.deckId] || [Infinity, -Infinity]; r[0] = Math.min(r[0], c.pos); r[1] = Math.max(r[1], c.pos); }
  return c => { const r = rng[c.deckId]; return r ? r[0] + idHash(c.id) * (r[1] - r[0] + 1) : c.pos; };
}
function pickNext(sess) {
  if (sess.cram) return S.cards.find(c => c.id === sess.cram[0]) || null;
  const now = Date.now();
  const pool = sess.deckId === 'all' ? S.cards : S.cards.filter(c => c.deckId === sess.deckId);
  const choose = arr => arr.find(c => c.noteId !== sess.lastNote) || arr[0];
  const byDue = (a, b) => a.srs.due - b.srs.due;
  const lrn = pool.filter(c => isLearning(c) && c.srs.due <= now).sort(byDue);
  if (lrn.length) return lrn[0];
  const rev = pool.filter(c => c.srs.state === 'review' && c.srs.due <= now).sort(byDue);
  const intro = introducedToday();
  const nwAll = pool.filter(c => c.srs.state === 'new' && (sess.all || (intro[c.deckId] || 0) < S.settings.newPerDay)), key = newOrderKey(nwAll);   // sess.all: bez dziennego limitu
  const nw = nwAll.sort((a, b) => key(a) - key(b));
  if (rev.length && (!nw.length || sess.done % 3 !== 2)) return choose(rev);
  if (nw.length) return choose(nw);
  return pool.filter(c => isLearning(c) && c.srs.due <= now + 20 * MIN).sort(byDue)[0] || null;
}
// Czytanie na głos (pl-PL)
const stripHtml = h => new DOMParser().parseFromString(h, 'text/html').body.textContent.replace(/\s+/g, ' ').trim();
function speak(text) {
  if (!('speechSynthesis' in window) || !text) return;
  speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'pl-PL'; u.rate = 0.95; speechSynthesis.speak(u);
}
function nextCard() {
  const s = SESSION;
  s.card = pickNext(s); s.shown = false; s.spoken = false; s.hint = false; s.typed = null; s.verdict = null; s.shownAt = Date.now();
}
function answer(g) {
  const s = SESSION, c = s.card; if (!c) return;
  if (s.cram) {
    s.undo = null; s.cram.shift();
    if (g === 1) s.cram.splice(Math.min(3, s.cram.length), 0, c.id);
    else s.done++;
  } else {
    const wasNew = c.srs.state === 'new';
    const typed = s.mode === 'type' && s.verdict;   // m/v: tryb i wynik – wpisywane odpowiedzi są warte więcej niż przewijane
    const entry = { id: uid(), c: c.id, d: c.deckId, t: Date.now(), g, n: wasNew ? 1 : 0, ms: Math.min(60000, Date.now() - s.shownAt), m: typed ? 'type' : 'flip', ...(typed ? { v: s.verdict } : {}) };
    s.undo = { cardId: c.id, srs: c.srs, logId: entry.id, mod: c.mod };
    c.srs = schedule(c.srs, g); touch(c); S.log.push(entry); s.done++;
    save();
    emit('review', c, g, wasNew);
  }
  s.lastNote = c.noteId;
  nextCard(); render();
  if (!s.card) emit('sessionEnd', s);
}
function undo() {
  const s = SESSION, u = s && s.undo; if (!u) return;
  const c = S.cards.find(x => x.id === u.cardId); if (!c) return;
  c.srs = u.srs; touch(c); S.log = S.log.filter(l => l.id !== u.logId); s.done--; s.undo = null;
  s.card = c; s.shown = false; s.hint = false; s.typed = null; s.verdict = null; s.shownAt = Date.now();
  save(); render();
}
// nowe karty, które dziś nie zmieściły się w dziennym limicie
const hiddenNew = deckId => deckCounts(deckId, true).nw - deckCounts(deckId).nw;
function sessionRemaining(s) {
  if (s.cram) return s.cram.length;
  const k = deckCounts(s.deckId, s.all); return k.total;
}

// ============================================================ Router i renderowanie
let MOUNT = [];
const onMount = fn => MOUNT.push(fn);

function parseRoute() {
  const h = decodeURI(location.hash.slice(1)) || '/';
  const [path, qs] = h.split('?');
  return { parts: path.split('/').filter(Boolean), q: new URLSearchParams(qs || '') };
}
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

function render() {
  if (!S) return;
  const { parts, q } = parseRoute();
  MOUNT = [];
  const r = parts[0] || '';
  let html, tab = '', focus = false;
  try {
    switch (r) {
      case '': html = viewHome(); tab = 'home'; break;
      case 'deck': html = viewDeck(parts[1], q); tab = 'home'; break;
      case 'study': html = viewStudy(parts[1], parts[2] || 'flip', q); focus = true; break;
      case 'quiz': html = viewQuiz(parts[1], q); focus = true; break;
      case 'add': html = viewAdd(null, q); tab = 'add'; break;
      case 'edit': html = viewAdd(parts[1], q); tab = 'add'; break;
      case 'palaces': html = viewPalaces(); tab = palTab(); break;
      case 'palace': html = viewPalace(parts[1]); tab = palTab(); break;
      case 'station': html = viewStation(parts[1], parts[2]); tab = palTab(); break;
      case 'walk': html = viewWalk(parts[1]); focus = true; break;
      case 'more': html = viewMore(); onMount(mountMore); tab = 'more'; break;
      default:
        if (ROUTES[r]) { const v = ROUTES[r](parts, q); html = v.html; tab = v.tab || ''; focus = !!v.focus; }
        else { html = viewHome(); tab = 'home'; }
    }
  } catch (e) {
    console.error(e); html = `<div class="card"><h2>Ups, błąd</h2><p>${esc(e.message)}</p><a href="#/">Wróć na start</a></div>`;
  }
  document.body.classList.toggle('focus', focus);
  const mode = appMode();
  document.body.classList.toggle('minimal', mode !== 'full');
  document.body.classList.toggle('zen', mode === 'zen');
  document.body.classList.toggle('flat', S.settings.gradients === false);
  if (typeof applyPersonal === 'function') applyPersonal();
  document.body.classList.toggle('noanim', !S.settings.anim);
  $('#view').innerHTML = html;
  $$('#tabs a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
  MOUNT.forEach(fn => fn());
}

// Wspólne kawałki interfejsu
function countsHTML(k) {
  const z = v => v ? '' : ' c-zero';
  return `<span class="counts"><span class="c-new${z(k.nw)}">${k.nw}</span><span class="c-lrn${z(k.lrn)}">${k.lrn}</span><span class="c-rev${z(k.rev)}">${k.rev}</span></span>`;
}
function deckSelect(selected) {
  const opts = S.decks.map(d => `<option value="${d.id}" ${d.id === selected ? 'selected' : ''}>${esc(d.name)}</option>`).join('');
  return `<select data-act-change="deckpick">${opts}<option value="__new">➕ Nowa talia…</option></select>`;
}
const progress = (frac, thin) => `<div class="progress${thin ? ' thin' : ''}"><div style="width:${clamp(frac, 0, 1) * 100}%"></div></div>`;

// ------------------------------------------------------------ Start
// Tryby: 'full' – wszystko, 'minimal' – skupienie (bez grywalizacji, z pałacami), 'zen' – pełne skupienie
const appMode = () => S.settings.mode || (S.settings.minimal ? 'minimal' : 'full');
const palTab = () => appMode() === 'full' ? 'arena' : 'palaces';
function viewHomeZen() {
  const all = deckCounts('all');
  const decks = S.decks.slice().sort((a, b) => a.name.localeCompare(b.name, 'pl')).map(d => { const k = deckCounts(d.id);
    return `<div class="deck"><div class="name" data-go="#/deck/${d.id}">${esc(d.name)}</div><span class="muted small">${k.total || ''}</span>
      <button class="sm ${k.total ? 'primary' : ''}" data-go="#/study/${d.id}/flip" ${k.total ? '' : 'disabled'}>Ucz</button></div>`; }).join('');
  return `<div class="zen-hero"><div class="zen-n">${all.total}</div><div class="muted">${all.total ? 'kart na dziś' : 'Na dziś wszystko zrobione'}</div>
    ${all.total ? `<button class="primary block" data-go="#/study/all/flip" style="min-height:58px">Zacznij</button>` : ''}</div>
    ${typeof stickiesHTML === 'function' ? stickiesHTML() : ''}
    <div class="card">${decks || '<p class="muted">Brak talii.</p>'}</div>`;
}
// powitanie zależne od pory dnia
function greeting() {
  const h = new Date().getHours(), nick = (S.profile?.nick || '').trim();
  const g = h >= 5 && h < 11 ? 'Dzień dobry' : h < 18 && h >= 11 ? 'Cześć' : h < 23 && h >= 18 ? 'Dobry wieczór' : 'Nocna nauka 🦉';
  return `${g}${nick ? ', ' + esc(nick) : ''} 👋`;
}
function viewHome() {
  if (appMode() === 'zen') return viewHomeZen();
  const all = deckCounts('all'), today = reviewsToday(), st = streak(), hard = difficultCards().length;
  const goal = S.settings.goal || 50;
  const dayFrac = today / Math.max(1, today + all.total);
  const decks = S.decks.slice().sort((a, b) => a.name.localeCompare(b.name, 'pl')).map(d => {
    const k = deckCounts(d.id);
    return `<div class="deck">
      <div class="name" data-go="#/deck/${d.id}">${esc(d.name)}</div>
      ${countsHTML(k)}
      <button class="sm ${k.total ? 'primary' : ''}" data-go="#/study/${d.id}/flip" ${k.total ? '' : 'disabled'}>Ucz</button>
      <button class="sm" data-go="#/deck/${d.id}">⋯</button>
    </div>`;
  }).join('');
  const sync = S.settings.sync.token ? `<button class="iconbtn" data-act="sync" title="Synchronizuj">🔄</button>` : '';
  return `
  <div class="row nowrap home-head"><div class="grow"><div class="greet">${greeting()}</div><h1>Fiszki</h1></div>${sync}${typeof homeChipHTML === 'function' ? homeChipHTML() : ''}</div>
  <div class="card">
    <div class="hero">
      <div class="stat"><b>${st ? '🔥 ' + st : '0'}</b><small>${plural(st, 'dzień', 'dni', 'dni')} z rzędu</small></div>
      <div class="stat"><b>${today}</b><small>powtórek dziś</small></div>
      <div class="stat"><b>${all.total}</b><small>do zrobienia</small></div>
    </div>
    <div class="spacer"></div>
    <div class="row small muted"><span class="grow">Postęp dnia</span><span>${Math.round(dayFrac * 100)}%</span></div>
    ${progress(dayFrac)}
    <div class="spacer"></div>
    ${(() => { const pts = typeof studyPoints === 'function' ? Math.floor(S.log.filter(l => l.t >= dayStart()).reduce((a, l) => a + studyPoints(l), 0)) : today;
      return `<div class="row small muted"><span class="grow">Cel dzienny (${goal} pkt nauki)</span><span>${Math.min(pts, goal)}/${goal}</span></div>
    ${progress(pts / goal, true)}`; })()}
    <div class="spacer"></div>
    ${all.total
      ? `<button class="primary block" data-go="#/study/all/flip">▶ Ucz się wszystkiego (${all.total})</button>`
      : `<div class="center muted">${S.cards.length ? '🎉 Na dziś wszystko powtórzone!' + nextDueText() : 'Dodaj pierwsze fiszki, aby zacząć.'}</div>`}
    ${(() => { const h = hiddenNew('all'); return h ? `<button class="ghost block all-new-link" data-go="#/study/all/flip?all=1">📚 Ucz się też wszystkich nowych naraz (+${h})</button>` : ''; })()}
  </div>
  ${typeof stickiesHTML === 'function' ? stickiesHTML() : ''}
  ${typeof safetyBannerHTML === 'function' ? safetyBannerHTML() : ''}
  ${typeof homeExtrasHTML === 'function' ? homeExtrasHTML() : ''}
  ${hard ? `<div class="banner row nowrap"><span class="grow">🧠 <b>${hard}</b> ${plural(hard, 'trudna fiszka', 'trudne fiszki', 'trudnych fiszek')} – powtórz bez wpływu na harmonogram</span><button class="sm" data-act="cram-hard">Powtórz</button></div>` : ''}
  <div class="card">
    <div class="row nowrap"><h2 class="grow" style="margin:0">Talie</h2>
      <span class="small muted"><span class="c-new">nowe</span> · <span class="c-lrn">nauka</span> · <span class="c-rev">powt.</span></span></div>
    ${decks || '<p class="muted">Brak talii.</p>'}
    <div class="spacer"></div>
    <div class="row"><button data-act="new-deck">➕ Nowa talia</button><button data-go="#/add">✏️ Dodaj fiszki</button></div>
  </div>
  ${S.settings.sync.token ? `<p class="small muted center">Synchronizacja: ${ago(S.settings.lastSync)}</p>` : ''}`;
}
function nextDueText() {
  const next = S.cards.filter(c => c.srs.state !== 'new').map(c => c.srs.due).filter(d => d > Date.now()).sort((a, b) => a - b)[0];
  return next ? `<br><span class="small">Następna powtórka za ${human(next - Date.now())}.</span>` : '';
}

// ------------------------------------------------------------ Talia
function viewDeck(id, q) {
  const d = deckById(id);
  if (!d) return `<p>Nie ma takiej talii. <a href="#/">Wróć</a></p>`;
  const k = deckCounts(id);
  const cards = S.cards.filter(c => c.deckId === id);
  const notes = S.notes.filter(n => n.deckId === id).sort((a, b) => b.created - a.created);
  const mature = cards.filter(c => c.srs.ivl >= 21).length;
  const hard = cards.filter(c => c.srs.lapses >= 2 || c.srs.state === 'relearn');
  onMount(() => {
    const inp = $('#note-search');
    inp.addEventListener('input', () => { $('#notes').innerHTML = notesList(notes, inp.value); });
  });
  return `
  <div class="row nowrap"><button class="iconbtn" data-go="#/">‹</button><h1 class="grow">${esc(d.name)}</h1>
    <button class="iconbtn" data-act="rename-deck" data-id="${id}">✏️</button></div>
  <div class="card">
    <div class="row"><span class="grow">Dziś: ${countsHTML(k)}</span><span class="small muted">${cards.length} kart · ${mature} opanowanych</span></div>
    ${progress(cards.length ? mature / cards.length : 0, true)}
    <div class="spacer"></div>
    <div class="row">
      <button class="primary grow" data-go="#/study/${id}/flip" ${k.total ? '' : 'disabled'}>▶ Fiszki</button>
      <button class="grow" data-go="#/study/${id}/type" ${k.total ? '' : 'disabled'}>⌨️ Wpisywanie</button>
    </div>
    ${(() => { const h = hiddenNew(id); return h ? `<div class="spacer"></div><button class="block all-new" data-go="#/study/${id}/flip?all=1">📚 Wszystkie nowe naraz (+${h})</button>` : ''; })()}
    <div class="spacer"></div>
    <div class="row">
      <button class="grow" data-go="#/quiz/${id}?type=abcd" ${cards.length ? '' : 'disabled'}>📝 Test ABCD</button>
      <button class="grow" data-go="#/quiz/${id}?type=type" ${cards.length ? '' : 'disabled'}>✍️ Test pisemny</button>
    </div>
    <div class="spacer"></div>
    <div class="row">
      <button class="grow" data-act="cram-deck" data-id="${id}" ${cards.length ? '' : 'disabled'}>🔁 Przejrzyj całą talię</button>
      <button class="grow" data-act="cram-hard" data-id="${id}" ${hard.length ? '' : 'disabled'}>🧠 Trudne (${hard.length})</button>
    </div>
    <div class="spacer"></div>
    <button class="block sm${d.mix ? ' primary' : ''}" data-act="deck-mix" data-id="${id}">🔀 Przeplatanie: ${d.mix ? 'włączone – nowe karty w losowej kolejności' : 'wyłączone (stuknij, by mieszać terminy z obrazami)'}</button>
  </div>
  <div class="card">
    <div class="row nowrap"><h2 class="grow" style="margin:0;white-space:nowrap">Fiszki (${notes.length})</h2>
      ${notes.length ? `<button class="sm${NOTE_SEL ? ' primary' : ''}" data-act="note-selmode">${NOTE_SEL ? 'Anuluj' : '☑️ Zaznacz'}</button>` : ''}
      ${NOTE_SEL ? '' : `<button class="sm primary" data-go="#/add?deck=${id}">➕ Dodaj</button>`}</div>
    ${NOTE_SEL ? `<div class="selbar row nowrap"><span class="grow small"><b>${NOTE_SEL.size}</b> zaznaczonych</span>
      <button class="sm" data-act="note-selall" data-id="${id}">${NOTE_SEL.size === notes.length ? 'Odznacz' : 'Wszystkie'}</button>
      <button class="sm danger-fill" data-act="note-seldel" ${NOTE_SEL.size ? '' : 'disabled'}>🗑 Usuń</button></div>` : ''}
    <div class="spacer"></div>
    <input id="note-search" type="search" placeholder="Szukaj…">
    <div id="notes">${notesList(notes, '')}</div>
  </div>
  <div class="row"><button data-act="anki-export" data-deck="${id}">⬇️ Eksport do Anki</button></div>
  <div class="row"><button class="danger" data-act="reset-deck" data-id="${id}">Resetuj postęp</button>
    <button class="danger" data-act="delete-deck" data-id="${id}">Usuń talię</button></div>`;
}
let NOTE_SEL = null;   // tryb zaznaczania (Set id fiszek) w widoku talii
// pasek „Usunięto · Cofnij” – przywraca z kosza wpisy zrobione tym usunięciem
function undoBar(text, entries) {
  document.querySelector('.undobar')?.remove();
  const el = document.createElement('div'); el.className = 'undobar';
  el.innerHTML = `<span class="grow">${esc(text)}</span><button class="sm">↩ Cofnij</button>`;
  el.querySelector('button').onclick = () => {
    if (typeof restoreTrash === 'function') entries.forEach(e => restoreTrash(e));
    el.remove(); save(); toast('Przywrócono ✓'); render();
  };
  document.body.append(el); clearTimeout(undoBar.t); undoBar.t = setTimeout(() => el.remove(), 7000);
}
function deleteNotes(ids) {
  const before = typeof TRASH !== 'undefined' ? TRASH.length : 0;
  ids.forEach(id => { const n = noteById(id); if (n) deleteNote(n); });
  save();   // obrazów nie czyścimy od razu – „Cofnij” przywraca fiszkę razem z obrazem
  const entries = typeof TRASH !== 'undefined' ? TRASH.slice(before) : [];
  undoBar(`Usunięto ${ids.length} ${plural(ids.length, 'fiszkę', 'fiszki', 'fiszek')}`, entries);
}
function notesList(notes, query) {
  const qn = norm(query);
  const rows = notes.map(n => {
    let a, b, tag, img = '';
    if (n.type === 'cloze') { a = clozePlain(n.text); b = ''; tag = 'luki'; }
    else if (n.type === 'occl') { a = n.title || 'Obraz z lukami'; b = n.boxes.map(x => x.label).join(', '); tag = n.style === 'pin' ? 'pałac' : 'obraz'; img = IMG[n.imageId]; }
    else { a = n.front || '(obraz)'; b = n.back; tag = n.reverse ? '⇄' : ''; img = n.imageId && IMG[n.imageId]; }
    return { n, a, b, tag, img };
  }).filter(r => !qn || norm(r.a + ' ' + r.b + ' ' + (r.n.hint || '')).includes(qn)).slice(0, 300);
  if (!rows.length) return '<p class="muted">Brak fiszek.</p>';
  return rows.map(r => NOTE_SEL ? `<div class="note sel${NOTE_SEL.has(r.n.id) ? ' on' : ''}" data-act="note-sel" data-id="${r.n.id}">
    <span class="nsel">${NOTE_SEL.has(r.n.id) ? '✓' : ''}</span>${r.img ? `<img src="${r.img}" alt="">` : ''}
    <div class="t"><div><b>${esc(r.a)}</b></div><div class="muted small">${esc(r.b)}</div></div></div>`
    : `<div class="note" data-go="#/edit/${r.n.id}">
    ${r.img ? `<img src="${r.img}" alt="">` : ''}
    <div class="t"><div><b>${esc(r.a)}</b></div><div class="muted small">${esc(r.b)}</div></div>
    ${r.tag ? `<span class="tag">${esc(r.tag)}</span>` : ''}<button class="ghost sm note-del" data-act="note-del" data-id="${r.n.id}" title="Usuń fiszkę">🗑</button></div>`).join('');
}

// ------------------------------------------------------------ Nauka
function viewStudy(deckId, mode, q) {
  const all = q.get('all') === '1', key = `${deckId}/${mode}/${q.get('cram') ? 'cram' : ''}${all ? '/all' : ''}`;
  if (!SESSION || SESSION.key !== key) {
    let cram = null;
    if (q.get('cram') === 'hard') cram = difficultCards().filter(c => deckId === 'all' || c.deckId === deckId).map(c => c.id);
    else if (q.get('cram') === 'all') cram = S.cards.filter(c => c.deckId === deckId).map(c => c.id);
    else if (q.get('cram') === 'list') cram = (q.get('ids') || '').split(',').filter(Boolean);
    startSession(deckId, mode, cram, all);
  }
  const s = SESSION, c = s.card;
  const name = deckId === 'all' ? 'Wszystkie talie' : (deckById(deckId)?.name || '');
  const rem = sessionRemaining(s);
  const backHash = deckId === 'all' ? '#/' : `#/deck/${deckId}`;
  const qs = location.hash.includes('?') ? '?' + location.hash.split('?')[1] : '';
  const head = `
  <div class="studybar">
    <button class="iconbtn" data-act="end-study" data-href="${backHash}">✕</button>
    <div class="title">${esc(name)}${s.cram ? ' · bez harmonogramu' : s.all ? ' · wszystkie nowe' : ''}</div>
    <div class="seg">
      <button class="${mode === 'flip' ? 'on' : ''}" data-act="switch-mode" data-href="#/study/${deckId}/flip${qs}">Fiszki</button>
      <button class="${mode === 'type' ? 'on' : ''}" data-act="switch-mode" data-href="#/study/${deckId}/type${qs}">Wpisz</button>
    </div>
  </div>
  ${progress(s.done / Math.max(1, s.done + rem))}
  <div class="row small muted study-meta" style="margin-top:6px"><span class="grow">Zrobione: ${s.done}</span>
    ${s.cram ? `<span>Zostało: ${rem}</span>` : countsHTML(deckCounts(deckId))}
    ${s.undo ? '<button class="ghost sm" data-act="undo">↶ Cofnij</button>' : ''}</div>`;

  if (!c) {
    return head + `<div class="card flash"><div style="font-size:54px">🎉</div><h2>Gratulacje!</h2>
      <p class="muted">${s.done ? `Powtórzono ${s.done} ${plural(s.done, 'kartę', 'karty', 'kart')}.` : 'Na teraz nie ma nic do powtórki.'}</p>
      <p class="muted small">${nextDueText()}</p></div>
      ${!s.all && !s.cram && hiddenNew(deckId) ? `<button class="primary block" data-go="#/study/${deckId}/${mode}?all=1">📚 Ucz się dalej – wszystkie nowe (${hiddenNew(deckId)})</button><div class="spacer"></div>` : ''}
      <button class="${!s.all && !s.cram && hiddenNew(deckId) ? '' : 'primary '}block" data-act="end-study" data-href="${backHash}">Gotowe</button>`;
  }

  const v = cardView(c);
  const hints = v.hints.length && !s.shown
    ? (s.hint ? `<div class="hintbox">💡 ${v.hints.map(fmt).join('<br>')}</div>` : `<div><button class="ghost" data-act="hint">💡 Pokaż skojarzenie</button></div>`)
    : (s.shown && v.hints.length ? `<div class="hintbox">💡 ${v.hints.map(fmt).join('<br>')}</div>` : '');
  let typed = '';
  if (s.shown && s.typed !== null) {
    const cls = { ok: 'ok', close: 'close', wrong: 'bad' }[s.verdict];
    const msg = { ok: '✅ Dobrze!', close: '🟡 Prawie dobrze', wrong: '❌ Źle' }[s.verdict];
    typed = `<div class="typed">${msg}<br>Twoja odpowiedź: <span class="${cls}">${esc(s.typed || '(pusto)')}</span></div>`;
  }
  const tts = S.settings.tts && 'speechSynthesis' in window;
  if (tts && !s.spoken) { s.spoken = true; onMount(() => speak(s.shown ? stripHtml(v.a) : stripHtml(v.q))); }
  const body = `<div class="card flash">${tts ? `<button class="ghost sm speak" data-act="speak">🔊</button>` : ''}${s.shown ? v.a : v.q}${typed}${hints}</div>`;

  let bar;
  if (!s.shown) {
    if (mode === 'type' && v.ans.trim()) {
      onMount(() => { const i = $('#typein'); i.focus({ preventScroll: true }); i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); act('check'); } }); });
      bar = `<input id="typein" placeholder="Wpisz odpowiedź…" autocomplete="off" autocapitalize="off" spellcheck="false">
        <button class="primary block" data-act="check">Sprawdź</button>`;
    } else bar = `<button class="primary block" data-act="show" style="min-height:56px">Pokaż odpowiedź</button>`;
  } else {
    const suggest = { ok: 3, close: 2, wrong: 1 }[s.verdict] || 0;
    const labels = S.settings.grade2 ? ['Nie pamiętam', '', 'Pamiętam', ''] : ['Nie pamiętam', 'Trudne', 'Dobrze', 'Łatwe'];
    const now = Date.now(), gs = S.settings.grade2 ? [1, 3] : [1, 2, 3, 4];
    bar = `<div class="grades n${gs.length}">${gs.map(g => {
      const t = s.cram ? (g === 1 ? 'jeszcze raz' : 'dalej') : human(schedule(c.srs, g, now, false).due - now);
      return `<button class="g${g}${suggest === g ? ' suggest' : ''}" data-act="grade" data-g="${g}">${labels[g - 1]}${S.settings.showIvl !== false ? `<small>${t}</small>` : ''}</button>`;
    }).join('')}</div>`;
  }
  return head + body + `<div class="answerbar">${bar}</div>`;
}

// ------------------------------------------------------------ Test (ABCD / pisemny)
let QUIZ = null;

function buildQuiz(deckId, type, count) {
  const cards = shuffle(S.cards.filter(c => (deckId === 'all' || c.deckId === deckId) && cardView(c).ans.trim()));
  const pick = cards.slice(0, count || cards.length);
  const items = pick.map(c => {
    const v = cardView(c);
    let options = null;
    if (type === 'abcd') {
      const seen = new Set([norm(v.ans)]), opts = [];
      const sameNote = shuffle(cards.filter(x => x.noteId === c.noteId && x !== c));
      for (const x of [...sameNote, ...cards]) {
        if (opts.length >= 3) break;
        const a = cardView(x).ans, k = norm(a);
        if (!k || seen.has(k)) continue; seen.add(k); opts.push(a);
      }
      options = shuffle([v.ans, ...opts]);
    }
    return { cardId: c.id, options, given: null, ok: null };
  });
  return { deckId, type, items, i: 0 };
}
function viewQuiz(deckId, q) {
  const type = q.get('type') || 'abcd';
  if (!QUIZ || QUIZ.deckId !== deckId || QUIZ.type !== type) QUIZ = null;
  const back = deckId === 'all' ? '#/' : `#/deck/${deckId}`;
  if (!QUIZ) {
    const n = S.cards.filter(c => deckId === 'all' || c.deckId === deckId).length;
    return `<div class="studybar"><button class="iconbtn" data-go="${back}">✕</button><div class="title">${type === 'abcd' ? 'Test ABCD' : 'Test pisemny'}</div></div>
      <div class="card"><h2>Ile pytań?</h2><p class="muted">Test sprawdza wiedzę i nie zmienia harmonogramu powtórek. Błędne odpowiedzi możesz potem dodać do powtórki.</p>
      ${[10, 20, 50].some(x => x < n) ? `<div class="qcount">${[10, 20, 50].filter(x => x < n).map(x => `<button data-act="quiz-start" data-n="${x}" data-deck="${deckId}" data-type="${type}">${x} pytań</button>`).join('')}</div><div class="spacer"></div>` : ''}
      <button class="primary block" data-act="quiz-start" data-n="0" data-deck="${deckId}" data-type="${type}">Wszystkie (${n})</button>
      <div class="spacer"></div>
      <div class="row nowrap qcustom"><span class="small muted grow">Własna liczba:</span><input id="quiz-n" type="number" inputmode="numeric" min="1" max="${n}" value="${Math.min(15, n)}">
        <button data-act="quiz-start-custom" data-deck="${deckId}" data-type="${type}">Start</button></div>
      <p class="small muted" style="margin-bottom:0">💎 Kryształy od 10 pytań – im dłuższy test, tym więcej.</p></div>`;
  }
  const Z = QUIZ, total = Z.items.length;
  const head = `<div class="studybar"><button class="iconbtn" data-act="quiz-end" data-href="${back}">✕</button>
    <div class="title">${type === 'abcd' ? 'Test ABCD' : 'Test pisemny'}</div><span class="small muted">${Math.min(Z.i + 1, total)}/${total}</span></div>
    ${progress(Z.i / Math.max(1, total))}`;
  if (Z.i >= total) {
    const good = Z.items.filter(x => x.ok).length, pct = Math.round(good / Math.max(1, total) * 100);
    const wrong = Z.items.filter(x => !x.ok);
    if (!Z.reported) { Z.reported = true; Z.reward = typeof quizReward === 'function' ? quizReward(pct, total, type) : null; setTimeout(() => emit('quiz', pct, total)); }
    // pytanie nad odpowiedzią (długie odpowiedzi nie rozjeżdżają się w wąską kolumnę)
    const list = wrong.map(x => { const c = S.cards.find(y => y.id === x.cardId); if (!c) return ''; const v = cardView(c);
      return `<div class="qwrong"><div class="small">${esc(v.label).slice(0, 160)}</div><b class="c-rev">${esc(v.ans)}</b></div>`; }).join('');
    const R = Z.reward;
    return head + `<div class="card center"><div class="score">${pct}%</div><p>${good} / ${total} poprawnych ${pct >= 90 ? '🏆' : pct >= 60 ? '👍' : '💪'}</p>
      ${R ? `<div class="qreward${R.n ? '' : ' none'}">${R.n ? `+${R.n} 💎` : R.why ? `Bez nagrody (${R.why})` : R.capped ? 'Dzienny limit 💎 z testów osiągnięty' : 'Za mało na nagrodę – od 50% są kryształy'}${R.n && R.capped ? '<small> (dzienny limit)</small>' : ''}</div>` : ''}
      ${typeof quizTiersHTML === 'function' ? quizTiersHTML(type) : ''}</div>
      ${wrong.length ? `<div class="card"><h3>Do poprawy (${wrong.length})</h3>${list}<div class="spacer"></div>
        <div class="row"><button class="primary grow" data-act="quiz-cram">🔁 Powtórz błędne teraz</button>
        <button class="grow" data-act="quiz-due">📅 Dodaj do dzisiejszych powtórek</button></div></div>` : ''}
      <div class="row"><button class="grow" data-act="quiz-again">Nowy test</button><button class="grow" data-act="quiz-end" data-href="${back}">Zakończ</button></div>`;
  }
  const it = Z.items[Z.i], c = S.cards.find(x => x.id === it.cardId);
  if (!c) { Z.i++; return viewQuiz(deckId, q); }
  const v = cardView(c), answered = it.given !== null;
  let ui;
  if (type === 'abcd') {
    ui = `<div class="options">${it.options.map((o, k) => {
      let cls = ''; if (answered) { if (o === v.ans) cls = 'right'; else if (k === it.given) cls = 'wrong'; }
      return `<button class="${cls}" data-act="quiz-pick" data-k="${k}" ${answered ? 'disabled style="opacity:1"' : ''}><b class="ol">${'ABCD'[k]}</b><span>${esc(o)}</span></button>`;
    }).join('')}</div>`;
  } else if (!answered) {
    onMount(() => { const i = $('#quizin'); i.focus({ preventScroll: true }); i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); act('quiz-check'); } }); });
    ui = `<input id="quizin" placeholder="Wpisz odpowiedź…" autocomplete="off" autocapitalize="off" spellcheck="false"><div class="spacer"></div>
      <button class="primary block" data-act="quiz-check">Sprawdź</button>`;
  } else {
    ui = `<div class="card center">${it.ok ? '✅ Dobrze' : '❌ Źle'} – twoja odpowiedź: <b>${esc(it.given || '(pusto)')}</b><br>Poprawna: <b class="c-rev">${esc(v.ans)}</b>
      ${it.ok ? '' : `<br><button class="ghost sm" data-act="quiz-override">To była dobra odpowiedź</button>`}</div>`;
  }
  // ABCD: karta pytania tylko tak wysoka, jak treść – żeby zmieściły się wszystkie odpowiedzi
  // ABCD: po odpowiedzi zostaje samo pytanie – dobra odpowiedź świeci na zielono w przyciskach (bez przewijania)
  return head + `<div class="card flash${type === 'abcd' ? ' qfit' : ''}">${answered && type !== 'abcd' ? v.a : v.q}</div>${ui}
    ${answered ? '<div class="spacer"></div><button class="primary block" data-act="quiz-next">Dalej ›</button>' : ''}`;
}

// ------------------------------------------------------------ Dodawanie / edycja
let DRAFT = null;

function freshDraft(type, deckId) {
  return {
    editId: null, type: type || 'basic', deckId: deckId || S.settings.lastDeck || S.decks[0]?.id,
    front: '', back: '', hint: '', extra: '', reverse: false, text: '', imageId: null, boxes: [], title: '',
    hideAll: S.settings.hideAll, bulk: '', bulkSep: 'auto', bulkReverse: false, bulkSwap: false, sel: null, draw: true,
  };
}
function viewAdd(editId, q) {
  if (editId) {
    if (!DRAFT || DRAFT.editId !== editId) {
      const n = noteById(editId); if (!n) return `<p>Nie ma takiej fiszki. <a href="#/">Wróć</a></p>`;
      DRAFT = { ...freshDraft(n.type, n.deckId), ...structuredClone(n), editId };
      if (n.type === 'occl' && n.style === 'pin') DRAFT.type = 'occl';
    }
  } else if (!DRAFT || DRAFT.editId || ((q.get('type') || q.get('deck')) && DRAFT.fromHash !== location.hash)) {
    DRAFT = freshDraft(q.get('type') || DRAFT?.type, q.get('deck'));
    DRAFT.fromHash = location.hash;
  }
  if (!S.decks.length) newDeck('Moja talia');
  if (!deckById(DRAFT.deckId)) DRAFT.deckId = S.decks[0].id;
  const D = DRAFT;
  if (D.style === 'pin') {
    const pal = S.palaces.find(p => p.stations.some(st => st.id === D.src));
    return `<div class="row nowrap"><button class="iconbtn" data-act="cancel-edit">‹</button><h1 class="grow">${esc(D.title)}</h1></div>
      <div class="card">${occlHTML(D, null, false)}<p>Te fiszki powstały z pałacu pamięci. Zmień pinezki w pałacu i ponownie naciśnij „Zrób fiszki” – karty się zaktualizują, a postęp zostanie.</p>
      ${pal ? `<button class="primary block" data-go="#/palace/${pal.id}">🏛️ Otwórz pałac</button>` : ''}</div>
      <button class="danger block" data-act="delete-note">Usuń te fiszki</button>`;
  }
  const types = [['basic', 'Fiszka'], ['cloze', 'Luki'], ['occl', 'Obraz'], ['bulk', 'Lista'], ['mix', '🔀 Mix'], ['scan', '📷']];
  const tabs = editId ? '' : `<div class="seg" style="display:flex">${types.map(([t, l]) =>
    `<button class="grow ${D.type === t ? 'on' : ''}" data-act="draft-type" data-t="${t}">${l}</button>`).join('')}</div>`;
  let form = '';
  if (D.type === 'basic') form = formBasic(D);
  else if (D.type === 'cloze') form = formCloze(D);
  else if (D.type === 'occl') form = formOccl(D);
  else if (D.type === 'scan') { form = formScan(D); onMount(mountScan); }
  else if (D.type === 'mix') form = formMix(D);
  else form = formBulk(D);
  onMount(() => {
    $$('[data-bind]').forEach(el => el.addEventListener('input', () => {
      D[el.dataset.bind] = el.type === 'checkbox' ? el.checked : el.value;
      if (el.dataset.bind === 'text') $('#cloze-prev') && ($('#cloze-prev').innerHTML = clozePreview(D.text));
      if (el.dataset.bind === 'bulk' || el.dataset.bind === 'bulkSep' || el.dataset.bind === 'bulkSwap') $('#bulk-prev').innerHTML = bulkPreview(D);
    }));
    if (D.type === 'occl' && D.imageId) mountOcclEditor();
  });
  return `
  <div class="row nowrap">${editId ? `<button class="iconbtn" data-act="cancel-edit">‹</button>` : ''}
    <h1 class="grow">${editId ? 'Edycja' : 'Dodaj fiszki'}</h1></div>
  ${tabs}
  ${D.mixBack && D.type === 'occl' ? `<div class="banner row nowrap"><span class="grow">🔀 Dodajesz obraz do zestawu mieszanego – po „Dodaj” wrócisz do listy terminów.</span><button class="sm" data-act="mix-back">‹ Wróć</button></div>` : ''}
  <label class="field"><span>Talia</span>${deckSelect(D.deckId)}</label>
  ${form}
  <div class="spacer"></div>
  ${D.type === 'scan' ? '' : `<button class="primary block" data-act="save-draft">${editId ? 'Zapisz zmiany' : D.type === 'bulk' ? 'Importuj' : D.type === 'mix' ? '💾 Zapisz zestaw' : 'Dodaj'}</button>`}
  ${editId ? `<div class="spacer"></div><button class="danger block" data-act="delete-note">Usuń fiszkę</button>` : ''}`;
}
const field = (label, bind, val, opts = {}) => `<label class="field"><span>${label}</span>${opts.area
  ? `<textarea data-bind="${bind}" ${opts.id ? `id="${opts.id}"` : ''} placeholder="${esc(opts.ph || '')}" rows="${opts.rows || 3}">${esc(val)}</textarea>`
  : `<input data-bind="${bind}" value="${esc(val)}" placeholder="${esc(opts.ph || '')}">`}</label>`;

function formBasic(D) {
  return `
  ${field('Przód (pytanie)', 'front', D.front, { area: true, ph: 'np. Kość udowa po łacinie' })}
  <div class="row">${D.imageId && IMG[D.imageId] ? `<img src="${IMG[D.imageId]}" style="max-height:90px;border-radius:8px"> <button class="danger sm" data-act="basic-img-del">Usuń obraz</button>`
    : `<button class="sm" data-act="basic-img">🖼️ Dodaj obraz</button><button class="sm" data-act="basic-img-paste">📋 Wklej obraz</button>`}</div>
  ${field('Tył (odpowiedź)', 'back', D.back, { area: true, ph: 'np. Os femoris' })}
  ${field('💡 Skojarzenie / podpowiedź (opcjonalnie)', 'hint', D.hint, { ph: 'np. „FEMORIS – FEMme w RIS-ach” – pokazuje się na żądanie' })}
  ${field('Dodatkowe informacje (opcjonalnie)', 'extra', D.extra, { area: true, rows: 2 })}
  <label class="check"><input type="checkbox" data-bind="reverse" ${D.reverse ? 'checked' : ''}> Utwórz też kartę odwrotną (tył → przód)</label>`;
}
function clozePreview(text) {
  const ords = [...new Set([...text.matchAll(CLOZE_RE)].map(m => m[1]))];
  if (!ords.length) return '<span class="muted small">Zaznacz słowo i naciśnij „Zrób lukę”.</span>';
  return `<span class="small muted">Powstanie ${ords.length} ${plural(ords.length, 'karta', 'karty', 'kart')}. Podgląd 1.:</span><div>${clozeHTML(text, ords[0], false)}</div>`;
}
function formCloze(D) {
  return `
  <label class="field"><span>Tekst z lukami</span>
  <textarea id="cloze-ta" data-bind="text" rows="5" placeholder="np. Mięsień dwugłowy ramienia zgina staw łokciowy">${esc(D.text)}</textarea></label>
  <div class="row"><button class="sm primary" data-act="cloze" data-same="0">[…] Zrób lukę</button>
    <button class="sm" data-act="cloze" data-same="1">[…] Luka w tej samej karcie</button></div>
  <p class="small muted">Składnia jak w Anki: <code>{{c1::odpowiedź::podpowiedź}}</code>. Każdy numer to osobna karta.</p>
  <div class="card tight" id="cloze-prev">${clozePreview(D.text)}</div>
  ${field('💡 Skojarzenie / podpowiedź (opcjonalnie)', 'hint', D.hint)}
  ${field('Dodatkowe informacje (opcjonalnie)', 'extra', D.extra, { area: true, rows: 2 })}`;
}
function formOccl(D) {
  if (!D.imageId) return `
    <div class="dropzone"><p>Wklej zdjęcie (np. atlas anatomii, schemat, zrzut ekranu),<br>a potem zaznacz palcem prostokąty, które mają stać się lukami.</p>
    <div class="row" style="justify-content:center"><button class="primary" data-act="occl-pick">🖼️ Wybierz zdjęcie</button>
    <button data-act="occl-paste">📋 Wklej ze schowka</button></div>
    <p class="small">Na komputerze możesz też po prostu nacisnąć Ctrl/⌘+V.</p></div>`;
  return `
  ${field('Tytuł / pytanie (opcjonalnie)', 'title', D.title, { ph: 'np. Kości stopy – widok grzbietowy' })}
  <div class="row small"><span class="grow muted">${D.draw ? 'Rysuj palcem prostokąty na obrazie. Stuknij lukę, aby ją zaznaczyć, przeciągnij, aby przesunąć.' : 'Tryb przewijania – rysowanie wyłączone.'}</span>
    <button class="sm" data-act="occl-draw">${D.draw ? '✋ Przewijaj' : '✏️ Rysuj'}</button></div>
  <div class="editor-wrap"><div class="occl stage ${D.draw ? '' : 'scroll'}" id="stage"><img src="${IMG[D.imageId]}" alt=""><div id="stage-boxes"></div></div></div>
  <div id="boxlist"></div>
  <label class="check"><input type="checkbox" data-bind="hideAll" ${D.hideAll ? 'checked' : ''}> Ukryj wszystkie luki, pytaj o jedną (zalecane)</label>
  ${field('💡 Skojarzenie ogólne (opcjonalnie)', 'hint', D.hint)}
  ${field('Dodatkowe informacje (opcjonalnie)', 'extra', D.extra, { area: true, rows: 2 })}
  <button class="danger sm" data-act="occl-clear">Zmień obraz</button>`;
}

// Edytor luk na obrazie: rysowanie i przesuwanie prostokątów (mysz i dotyk)
function mountOcclEditor() {
  const D = DRAFT, stage = $('#stage');
  const relPos = e => { const r = stage.getBoundingClientRect(); return { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) }; };
  let drag = null;
  stage.addEventListener('pointerdown', e => {
    if (!D.draw) return;
    e.preventDefault();
    const p = relPos(e), hit = e.target.closest('.ob');
    if (hit) { const b = D.boxes.find(x => x.id === hit.dataset.id); drag = { kind: 'move', b, p0: p, x0: b.x, y0: b.y, moved: false }; D.sel = b.id; }
    else drag = { kind: 'new', p0: p, b: { x: p.x, y: p.y, w: 0, h: 0 } };
    stage.setPointerCapture(e.pointerId); drawBoxes();
  });
  stage.addEventListener('pointermove', e => {
    if (!drag) return;
    const p = relPos(e);
    if (drag.kind === 'move') {
      drag.b.x = clamp(drag.x0 + p.x - drag.p0.x, 0, 1 - drag.b.w); drag.b.y = clamp(drag.y0 + p.y - drag.p0.y, 0, 1 - drag.b.h); drag.moved = true;
    } else drag.b = { x: Math.min(p.x, drag.p0.x), y: Math.min(p.y, drag.p0.y), w: Math.abs(p.x - drag.p0.x), h: Math.abs(p.y - drag.p0.y) };
    drawBoxes(drag.kind === 'new' ? drag.b : null);
  });
  const end = () => {
    if (!drag) return;
    if (drag.kind === 'new' && drag.b.w > 0.015 && drag.b.h > 0.01) {
      const b = { id: uid(), ...drag.b, label: '', hint: '' }; D.boxes.push(b); D.sel = b.id;
    } else if (drag.kind === 'new') D.sel = null;
    drag = null; drawBoxes(); drawBoxList();
  };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
  drawBoxes(); drawBoxList();
}
function drawBoxes(draft) {
  const D = DRAFT, el = $('#stage-boxes'); if (!el) return;
  el.innerHTML = D.boxes.map((b, i) => `<div class="ob${D.sel === b.id ? ' sel' : ''}" data-id="${b.id}" style="left:${b.x * 100}%;top:${b.y * 100}%;width:${b.w * 100}%;height:${b.h * 100}%">${i + 1}</div>`).join('')
    + (draft ? `<div class="ob draft" style="left:${draft.x * 100}%;top:${draft.y * 100}%;width:${draft.w * 100}%;height:${draft.h * 100}%"></div>` : '');
}
function drawBoxList() {
  const D = DRAFT, el = $('#boxlist'); if (!el) return;
  el.innerHTML = D.boxes.length ? `<h3>Luki (${D.boxes.length}) – wpisz odpowiedzi</h3>` + D.boxes.map((b, i) => `
    <div class="boxrow${D.sel === b.id ? ' sel' : ''}"><span class="num">${i + 1}</span>
      <input data-box="${b.id}" data-f="label" value="${esc(b.label)}" placeholder="Odpowiedź">
      <input data-box="${b.id}" data-f="hint" value="${esc(b.hint)}" placeholder="💡 Skojarzenie">
      <button class="danger sm" data-act="box-del" data-id="${b.id}">✕</button></div>`).join('')
    : '<p class="muted small center">Brak luk – narysuj prostokąt na obrazie.</p>';
  $$('[data-box]', el).forEach(inp => inp.addEventListener('input', () => {
    const b = D.boxes.find(x => x.id === inp.dataset.box); if (b) b[inp.dataset.f] = inp.value;
  }));
  if (D.sel) { const r = el.querySelector(`[data-box="${D.sel}"][data-f="label"]`); if (r && !r.value) r.focus({ preventScroll: true }); }
}

// Import listy: „pytanie - odpowiedź” w każdej linii
const SEPS = { tab: '\t', ' - ': ' - ', ' – ': ' – ', ' — ': ' — ', ';': ';', ':': ':', '=': '=', '|': '|', ',': ',' };
function detectSep(lines) {
  let best = '\t', score = 0;
  for (const s of Object.values(SEPS)) { const n = lines.filter(l => l.includes(s)).length; if (n > score) { score = n; best = s; } }
  return best;
}
function parseBulk(D) {
  const lines = D.bulk.split(/\r?\n/).map(l => l.trim()).filter(l => l && !/^#(separator|html|tags|columns|notetype|deck|guid)/i.test(l));
  const sep = D.bulkSep === 'auto' ? detectSep(lines.filter(l => !/\{\{c\d+::/.test(l))) : SEPS[D.bulkSep];
  return { sep, items: lines.map(l => {
    if (/\{\{c\d+::/.test(l)) return { cloze: l };
    const i = l.indexOf(sep); if (i < 0) return { front: l, back: '', bad: true };
    let front = l.slice(0, i).trim(), rest = l.slice(i + sep.length).trim(), hint = '';
    const j = rest.indexOf(sep); if (sep !== ',' && j >= 0) { hint = rest.slice(j + sep.length).trim(); rest = rest.slice(0, j).trim(); }
    front = front.replace(/^(\d+[.)]|[-•*])\s+/, '');
    if (D.bulkSwap) [front, rest] = [rest, front];
    return { front, back: rest, hint, bad: !front || !rest };
  }) };
}
function bulkPreview(D) {
  if (!D.bulk.trim()) return '<p class="muted small">Podgląd pojawi się tutaj.</p>';
  const { sep, items } = parseBulk(D), ok = items.filter(x => !x.bad).length;
  const sepName = sep === '\t' ? 'tabulator' : `„${sep.trim() || sep}”`;
  return `<p class="small"><b>${ok}</b> ${plural(ok, 'fiszka', 'fiszki', 'fiszek')} · separator: ${sepName}${items.length - ok ? ` · <span class="c-lrn">${items.length - ok} pominiętych</span>` : ''}</p>
    <table class="preview">${items.slice(0, 30).map(x => x.cloze ? `<tr><td colspan="3">${clozeHTML(x.cloze, '1', true)} <span class="tag">luki</span></td></tr>`
    : `<tr style="${x.bad ? 'opacity:.4' : ''}"><td>${esc(x.front)}</td><td>${esc(x.back)}</td><td class="muted">${esc(x.hint)}</td></tr>`).join('')}</table>
    ${items.length > 30 ? `<p class="small muted">…i ${items.length - 30} więcej</p>` : ''}`;
}
// Zestaw mieszany: lista terminów + obrazy z lukami w jednej talii, przeplatane w nauce
function formMix(D) {
  const imgs = S.notes.filter(n => n.deckId === D.deckId && n.type === 'occl').slice(-12);
  return `<p class="small muted" style="margin-top:0">Terminy i obrazy z lukami w jednej talii. W nauce przeplatają się losowo – raz termin, a nagle obraz z lukami do uzupełnienia.</p>
  <label class="field"><span>📝 Terminy – jeden w linii (<code>termin - definicja</code>)</span>
  <textarea data-bind="bulk" rows="7" placeholder="kość udowa - os femoris
mięsień dwugłowy - biceps brachii
Stolicą Francji jest {{c1::Paryż}}">${esc(D.bulk)}</textarea></label>
  <div class="card tight" id="bulk-prev">${bulkPreview(D)}</div>
  <div class="row nowrap"><h3 class="grow" style="margin:6px 0">🖼️ Obrazy z lukami w tej talii</h3><span class="small muted">${S.notes.filter(n => n.deckId === D.deckId && n.type === 'occl').length}</span></div>
  ${imgs.length ? `<div class="mix-imgs">${imgs.map(n => `<div data-go="#/edit/${n.id}">${IMG[n.imageId] ? `<img src="${IMG[n.imageId]}" alt="">` : '🖼️'}<small>${n.boxes.length} ${plural(n.boxes.length, 'luka', 'luki', 'luk')}</small></div>`).join('')}</div>` : '<p class="small muted">Jeszcze żadnego – dodaj zdjęcie (atlas, schemat) i zaznacz luki.</p>'}
  <button class="block" data-act="mix-add-img">➕ Dodaj obraz z lukami</button>
  <label class="check"><input type="checkbox" data-bind="mixOn" ${D.mixOn !== false ? 'checked' : ''}> 🔀 Przeplataj w nauce (losowa kolejność nowych kart)</label>`;
}
function formBulk(D) {
  return `
  <label class="field"><span>Wklej listę – jedna fiszka w linii</span>
  <textarea data-bind="bulk" rows="9" placeholder="kość udowa - os femoris
kość ramienna - humerus - skojarzenie: HUMOR na ramieniu
Stolicą Francji jest {{c1::Paryż}}">${esc(D.bulk)}</textarea></label>
  <p class="small muted">Format: <code>przód - tył</code> albo <code>przód - tył - skojarzenie</code>. Separator wykrywa się sam (myślnik, tabulator z Excela, średnik, dwukropek, „=”). Linie z <code>{{c1::…}}</code> stają się lukami.</p>
  <div class="row"><label class="field grow"><span>Separator</span><select data-bind="bulkSep">
    ${[['auto', 'automatycznie'], ['tab', 'tabulator'], [' - ', 'myślnik  -'], [' – ', 'półpauza –'], [';', 'średnik ;'], [':', 'dwukropek :'], ['=', 'znak ='], ['|', 'kreska |'], [',', 'przecinek ,']]
      .map(([v, l]) => `<option value="${esc(v)}" ${D.bulkSep === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
  <label class="check"><input type="checkbox" data-bind="bulkSwap" ${D.bulkSwap ? 'checked' : ''}> Zamień stronami (tył ↔ przód)</label>
  <label class="check"><input type="checkbox" data-bind="bulkReverse" ${D.bulkReverse ? 'checked' : ''}> Ucz się w obie strony</label>
  <div class="card tight" id="bulk-prev">${bulkPreview(D)}</div>`;
}
async function saveDraft() {
  const D = DRAFT, deckId = D.deckId;
  S.settings.lastDeck = deckId;
  if (D.type === 'bulk' || D.type === 'mix') {
    const { items } = parseBulk(D); let n = 0; const t0 = Date.now();
    items.forEach((x, i) => {
      const base = { deckId, created: t0 + i };
      if (x.cloze) { addNote({ ...base, type: 'cloze', text: x.cloze, hint: '', extra: '' }); n++; }
      else if (!x.bad) { addNote({ ...base, type: 'basic', front: x.front, back: x.back, hint: x.hint, extra: '', reverse: D.bulkReverse }); n++; }
    });
    if (D.type === 'mix') {
      const deck = deckById(deckId), imgs = S.notes.filter(x => x.deckId === deckId && x.type === 'occl').length;
      if (!n && !imgs) return toast('Dodaj terminy albo obraz z lukami');
      if (deck) { deck.mix = D.mixOn !== false; touch(deck); }
      save(); if (n) emit('cardsAdded', n); DRAFT = null;
      toast(`Zestaw zapisany ✓ ${n ? `+${n} ${plural(n, 'termin', 'terminy', 'terminów')}` : ''}${deck?.mix ? ' · przeplatanie włączone 🔀' : ''}`, 3500); return go(`#/deck/${deckId}`);
    }
    if (!n) return toast('Nie rozpoznano żadnej fiszki');
    save(); emit('cardsAdded', n); DRAFT.bulk = ''; toast(`Dodano ${n} ${plural(n, 'fiszkę', 'fiszki', 'fiszek')} ✓`); return go(`#/deck/${deckId}`);
  }
  let fields;
  if (D.type === 'basic') {
    if (!D.front.trim() && !D.imageId) return toast('Uzupełnij przód fiszki');
    if (!D.back.trim()) return toast('Uzupełnij tył fiszki');
    fields = { type: 'basic', front: D.front.trim(), back: D.back.trim(), hint: D.hint.trim(), extra: D.extra.trim(), reverse: !!D.reverse, imageId: D.imageId };
  } else if (D.type === 'cloze') {
    if (!/\{\{c\d+::/.test(D.text)) return toast('Zrób przynajmniej jedną lukę');
    fields = { type: 'cloze', text: D.text.trim(), hint: D.hint.trim(), extra: D.extra.trim() };
  } else {
    if (!D.imageId) return toast('Najpierw wybierz obraz');
    if (!D.boxes.length) return toast('Narysuj przynajmniej jedną lukę');
    D.boxes.forEach((b, i) => { if (!b.label.trim()) b.label = `Luka ${i + 1}`; });
    fields = { type: 'occl', imageId: D.imageId, boxes: D.boxes.map(({ id, x, y, w, h, label, hint }) => ({ id, x, y, w, h, label: label.trim(), hint: (hint || '').trim() })),
      title: D.title.trim(), hideAll: !!D.hideAll, hint: D.hint.trim(), extra: D.extra.trim(), style: D.style };
  }
  if (D.editId) {
    const n = noteById(D.editId); if (!n) return;
    Object.assign(n, fields, { deckId }); touch(n); syncCards(n); save(); gcImages();
    DRAFT = null; toast('Zapisano ✓'); history.length > 1 ? history.back() : go(`#/deck/${deckId}`);
  } else {
    addNote({ ...fields, deckId }); save(); emit('cardsAdded', 1);
    const keep = { type: D.type, deckId, reverse: D.reverse, hideAll: D.hideAll };
    if (D.mixBack) {   // obraz do zestawu mieszanego → wracamy do listy terminów
      DRAFT = { ...freshDraft('mix', deckId), bulk: D.mixBack.bulk, mixOn: D.mixBack.mixOn };
      toast('Obraz dodany do zestawu ✓'); return render();
    }
    DRAFT = { ...freshDraft(D.type, deckId), ...keep };
    toast('Dodano ✓'); render();
    if (D.type !== 'occl') setTimeout(() => $('textarea[data-bind]')?.focus(), 50);
  }
}

// ------------------------------------------------------------ Obrazy
async function compressImage(blob, max = 1600) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Nie udało się wczytać obrazu')); i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  } finally { URL.revokeObjectURL(url); }
}
async function clipboardImage() {
  if (!navigator.clipboard?.read) throw new Error('Ta przeglądarka nie daje dostępu do schowka – użyj „Wybierz zdjęcie”.');
  for (const it of await navigator.clipboard.read()) {
    const t = it.types.find(t => t.startsWith('image/')); if (t) return it.getType(t);
  }
  throw new Error('W schowku nie ma obrazu');
}
async function getImage(source) {
  try {
    const blob = source === 'paste' ? await clipboardImage() : await pickFile('image/*');
    if (!blob) return null;
    return await putImage(await compressImage(blob));
  } catch (e) { toast(e.message, 3500); return null; }
}
// Ctrl/⌘+V z obrazem na ekranach, które przyjmują obrazy
document.addEventListener('paste', async e => {
  const file = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'))?.getAsFile();
  if (!file) return;
  const { parts } = parseRoute();
  const target = parts[0] === 'add' || parts[0] === 'edit' ? 'draft' : parts[0] === 'palace' ? 'palace' : null;
  if (!target) return;
  e.preventDefault();
  if (target === 'draft' && DRAFT?.type === 'scan') { await scanAddBlob(file, 'wklejony obraz'); return render(); }
  const id = await putImage(await compressImage(file));
  if (target === 'draft') {
    if (DRAFT.type !== 'occl' && DRAFT.type !== 'basic') DRAFT.type = 'occl';
    DRAFT.imageId = id; DRAFT.boxes = DRAFT.type === 'occl' ? [] : DRAFT.boxes;
  } else addStation(parts[1], id);
  render();
});

// ------------------------------------------------------------ Pałace pamięci
function viewPalaces() {
  const list = S.palaces.map(p => {
    const pins = p.stations.reduce((a, s) => a + s.pins.length, 0);
    const img = p.stations.find(s => IMG[s.imageId]);
    return `<div class="note" data-go="#/palace/${p.id}">${img ? `<img src="${IMG[img.imageId]}" alt="">` : '<span style="font-size:30px">🏛️</span>'}
      <div class="t"><div><b>${esc(p.name)}</b></div><div class="small muted">${p.stations.length} ${plural(p.stations.length, 'miejsce', 'miejsca', 'miejsc')} · ${pins} ${plural(pins, 'pinezka', 'pinezki', 'pinezek')}</div></div></div>`;
  }).join('');
  return `<h1>Pałace pamięci</h1>
  <div class="card"><p>Metoda loci: wybierz znaną trasę (np. drogę do szkoły w Street View), zrób zrzuty ekranu kolejnych miejsc
  i przypnij do nich obrazowe skojarzenia z tym, czego się uczysz. Potem „przejdź się” po pałacu albo zamień pinezki w fiszki.</p></div>
  <div class="card">${list || '<p class="muted">Nie masz jeszcze żadnego pałacu.</p>'}
  <div class="spacer"></div><button class="primary block" data-act="palace-new">➕ Nowy pałac</button></div>`;
}
function viewPalace(id) {
  const p = palaceById(id); if (!p) return `<p>Nie ma takiego pałacu. <a href="#/palaces">Wróć</a></p>`;
  let n = 0;
  const st = p.stations.map((s, i) => `<div class="note" data-go="#/station/${p.id}/${s.id}">
    ${IMG[s.imageId] ? `<img src="${IMG[s.imageId]}" alt="">` : ''}
    <div class="t"><div><b>${i + 1}. ${esc(s.name || 'Miejsce ' + (i + 1))}</b></div>
    <div class="small muted">${s.pins.map(x => `${++n}. ${esc(x.assoc || x.fact || '…')}`).join(' · ') || 'brak pinezek'}</div></div></div>`).join('');
  return `
  <div class="row nowrap"><button class="iconbtn" data-go="#/palaces">‹</button><h1 class="grow">${esc(p.name)}</h1>
    <button class="iconbtn" data-act="palace-rename" data-id="${id}">✏️</button></div>
  <div class="card">
    <h3 style="margin-top:0">1. Znajdź miejsce w Street View</h3>
    <div class="row nowrap"><input id="maps-q" class="grow" placeholder="np. Rynek Główny, Kraków" value="${esc(p.place || '')}">
      <button data-act="open-maps" data-id="${id}">🗺️ Otwórz</button></div>
    <p class="small muted">W Mapach Google przeciągnij ludzika (lub stuknij zdjęcie miejsca), zrób zrzut ekranu i wróć tutaj.</p>
    <h3>2. Dodaj miejsca trasy</h3>
    <div class="row"><button class="primary grow" data-act="station-add" data-src="file" data-id="${id}">🖼️ Dodaj zrzut</button>
      <button class="grow" data-act="station-add" data-src="paste" data-id="${id}">📋 Wklej</button></div>
  </div>
  <div class="card">${st || '<p class="muted">Brak miejsc. Dodaj pierwszy zrzut ekranu.</p>'}</div>
  ${p.stations.length >= 2 || p.stations.some(s => s.pins.length) ? `<button class="primary block big-btn" data-act="pt-open" data-id="${id}">🎯 Trenuj ten pałac</button><div class="spacer"></div>` : ''}
  ${p.stations.some(s => s.pins.length) ? `<div class="row">
    <button class="grow" data-go="#/walk/${id}">🚶 Spacer po pałacu</button>
    <button class="grow" data-act="palace-cards" data-id="${id}">🃏 Zrób fiszki</button></div>` : ''}
  <div class="spacer"></div><button class="danger" data-act="palace-del" data-id="${id}">Usuń pałac</button>`;
}
function addStation(pid, imageId) {
  const p = palaceById(pid); if (!p || !imageId) return;
  const s = { id: uid(), name: '', imageId, pins: [] };
  p.stations.push(s); touch(p); save(); go(`#/station/${pid}/${s.id}`);
}
let STATION_SEL = null;
function viewStation(pid, sid) {
  const p = palaceById(pid), s = p?.stations.find(x => x.id === sid);
  if (!s) return `<p>Nie ma takiego miejsca. <a href="#/palaces">Wróć</a></p>`;
  const idx = p.stations.indexOf(s);
  const offset = p.stations.slice(0, idx).reduce((a, x) => a + x.pins.length, 0);
  onMount(() => mountStation(p, s, offset));
  return `
  <div class="row nowrap"><button class="iconbtn" data-go="#/palace/${pid}">‹</button><h1 class="grow">Miejsce ${idx + 1}</h1></div>
  <label class="field"><span>Nazwa miejsca</span><input id="st-name" value="${esc(s.name)}" placeholder="np. Brama, fontanna, ławka…"></label>
  <p class="small muted">Stuknij w obraz, aby wbić pinezkę. Przeciągnij pinezkę, aby ją przesunąć.</p>
  <div class="editor-wrap"><div class="occl stage" id="stage"><img src="${IMG[s.imageId] || ''}" alt=""><div id="stage-boxes"></div></div></div>
  <div id="pinlist"></div>
  <div class="spacer"></div>
  <div class="row">${idx > 0 ? `<button class="grow" data-go="#/station/${pid}/${p.stations[idx - 1].id}">‹ Poprzednie</button>` : ''}
    ${idx < p.stations.length - 1 ? `<button class="grow" data-go="#/station/${pid}/${p.stations[idx + 1].id}">Następne ›</button>` : ''}</div>
  <div class="spacer"></div><button class="danger" data-act="station-del" data-pid="${pid}" data-id="${sid}">Usuń to miejsce</button>`;
}
function mountStation(p, s, offset) {
  const stage = $('#stage');
  const commit = () => { touch(p); save(); };
  $('#st-name').addEventListener('input', e => { s.name = e.target.value; commit(); });
  const draw = () => {
    $('#stage-boxes').innerHTML = s.pins.map((x, i) => `<div class="pin${STATION_SEL === x.id ? ' sel' : ''}" data-id="${x.id}" style="left:${x.x * 100}%;top:${x.y * 100}%">${offset + i + 1}</div>`).join('');
  };
  const list = () => {
    $('#pinlist').innerHTML = s.pins.length ? s.pins.map((x, i) => `<div class="card tight${STATION_SEL === x.id ? ' sel' : ''}" style="${STATION_SEL === x.id ? 'outline:2px solid var(--accent)' : ''}">
      <div class="row nowrap"><b class="c-new">📍 ${offset + i + 1}</b><span class="grow"></span><button class="danger sm" data-act="pin-del" data-id="${x.id}">Usuń</button></div>
      <label class="field"><span>Co mam zapamiętać (fakt)</span><input data-pin="${x.id}" data-f="fact" value="${esc(x.fact)}" placeholder="np. Nerw promieniowy"></label>
      <label class="field"><span>💡 Skojarzenie – obraz, który tu „stawiam”</span><input data-pin="${x.id}" data-f="assoc" value="${esc(x.assoc)}" placeholder="np. Promienne słońce siedzi na ławce"></label>
    </div>`).join('') : '<p class="muted center small">Brak pinezek.</p>';
    $$('[data-pin]').forEach(inp => inp.addEventListener('input', () => {
      const x = s.pins.find(y => y.id === inp.dataset.pin); if (x) { x[inp.dataset.f] = inp.value; commit(); }
    }));
  };
  const rel = e => { const r = stage.getBoundingClientRect(); return { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) }; };
  let drag = null;
  stage.addEventListener('pointerdown', e => {
    e.preventDefault();
    const hit = e.target.closest('.pin');
    if (hit) { drag = { pin: s.pins.find(x => x.id === hit.dataset.id), moved: false }; STATION_SEL = drag.pin.id; stage.setPointerCapture(e.pointerId); draw(); }
    else { const p0 = rel(e); const pin = { id: uid(), x: p0.x, y: p0.y, fact: '', assoc: '' }; s.pins.push(pin); STATION_SEL = pin.id; commit(); draw(); list();
      setTimeout(() => $(`[data-pin="${pin.id}"][data-f="fact"]`)?.focus(), 30); }
  });
  stage.addEventListener('pointermove', e => { if (!drag) return; const q = rel(e); drag.pin.x = q.x; drag.pin.y = q.y; drag.moved = true; draw(); });
  const end = () => { if (!drag) return; if (drag.moved) commit(); drag = null; list(); };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
  draw(); list();
}
let WALK = null;
function viewWalk(pid) {
  const p = palaceById(pid); if (!p) return `<p><a href="#/palaces">Wróć</a></p>`;
  const steps = []; p.stations.forEach(s => s.pins.forEach(pin => steps.push({ s, pin })));
  if (!WALK || WALK.pid !== pid) WALK = { pid, i: 0, assoc: false, fact: false };
  if (!steps.length) return `<p>Brak pinezek. <a href="#/palace/${pid}">Wróć</a></p>`;
  WALK.i = clamp(WALK.i, 0, steps.length - 1);
  const { s, pin } = steps[WALK.i];
  const fakeNote = { imageId: s.imageId, style: 'pin', boxes: s.pins };
  return `<div class="studybar"><button class="iconbtn" data-go="#/palace/${pid}">✕</button><div class="title">🚶 ${esc(p.name)}</div><span class="small muted">${WALK.i + 1}/${steps.length}</span></div>
  ${progress((WALK.i + 1) / steps.length)}
  <div class="card center">
    <div class="qtitle">${esc(s.name || 'Miejsce ' + (p.stations.indexOf(s) + 1))} · pinezka ${WALK.i + 1}</div>
    ${occlHTML(fakeNote, pin.id, WALK.fact)}
    <div class="spacer"></div>
    ${WALK.assoc ? `<div class="hintbox">💡 ${fmt(pin.assoc || '(brak skojarzenia)')}</div>` : `<button class="ghost" data-act="walk-assoc">💡 Pokaż skojarzenie</button>`}
    ${WALK.fact ? `<div class="ansline">${fmt(pin.fact || '(brak faktu)')}</div>` : `<div><button class="ghost" data-act="walk-fact">👁️ Pokaż fakt</button></div>`}
  </div>
  <div class="row nowrap"><button class="grow" data-act="walk-step" data-d="-1" ${WALK.i ? '' : 'disabled'}>‹ Wstecz</button>
    <button class="primary grow" data-act="walk-step" data-d="1" ${WALK.i < steps.length - 1 ? '' : 'disabled'}>Dalej ›</button></div>`;
}
function palaceToCards(p, deckId) {
  let made = 0;
  for (const [i, s] of p.stations.entries()) {
    const pins = s.pins.filter(x => x.fact.trim()); if (!pins.length) continue;
    const boxes = pins.map(x => ({ id: x.id, x: x.x, y: x.y, w: 0, h: 0, label: x.fact.trim(), hint: x.assoc.trim() }));
    const fields = { type: 'occl', style: 'pin', imageId: s.imageId, boxes, hideAll: false, title: `${p.name} – ${s.name || 'miejsce ' + (i + 1)}`, hint: '', extra: '', src: s.id };
    const existing = S.notes.find(n => n.src === s.id);
    if (existing) { Object.assign(existing, fields); touch(existing); syncCards(existing); }
    else addNote({ ...fields, deckId });
    made += pins.length;
  }
  save(); return made;
}

// ------------------------------------------------------------ Więcej: statystyki, przypomnienia, synchronizacja
function viewMore() {
  const st = S.settings, counts = {};
  S.log.forEach(l => { const k = dayKey(l.t); counts[k] = (counts[k] || 0) + 1; });
  const weeks = 17, today = dayStart(), dow = (new Date(today).getDay() + 6) % 7; // poniedziałek = 0
  let cells = '';
  for (let t = addDays(today, -dow - (weeks - 1) * 7), i = 0; i < weeks * 7; i++, t = addDays(t, 1)) {
    const n = t > today ? -1 : counts[dayKey(t)] || 0;
    const l = n <= 0 ? '' : n < 10 ? 'l1' : n < 30 ? 'l2' : n < 80 ? 'l3' : 'l4';
    cells += `<i class="${l}" title="${dayKey(t)}: ${Math.max(0, n)}" style="${n < 0 ? 'visibility:hidden' : ''}"></i>`;
  }
  const total = S.cards.length, nw = S.cards.filter(c => c.srs.state === 'new').length, mature = S.cards.filter(c => c.srs.ivl >= 21).length;
  const last30 = S.log.filter(l => l.t > Date.now() - 30 * DAY), acc = last30.length ? Math.round(last30.filter(l => l.g > 1).length / last30.length * 100) : 0;
  const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const modeCard = `<div class="card"><h2 style="margin-top:0">Tryb aplikacji</h2>
    <div class="modes three">${[['full', '🎮', 'Pełny', 'bitwy, osiągnięcia, skrzynki, ranking, gry'], ['minimal', '🧘', 'Skupienie', 'fiszki, materiały i pałace pamięci – bez grywalizacji'],
      ['zen', '🎯', 'Pełne skupienie', 'tylko nauka: zero liczników, statystyk i dodatków']].map(([m, i, n, d]) =>
      `<button class="mode${appMode() === m ? ' on' : ''}" data-act="set-mode" data-m="${m}"><span>${i}</span><b>${n}</b><small>${d}</small></button>`).join('')}</div></div>`;
  // w pełnym trybie konto i profil są w zakładce „Profil”, tu zostają ustawienia
  const full = appMode() === 'full';
  return `${full ? '<div class="row nowrap"><button class="iconbtn" data-go="#/me">‹</button><h1 class="grow">Ustawienia</h1></div>' : '<h1>Ustawienia</h1>'}
  ${!full && typeof accountCardHTML === 'function' ? accountCardHTML() : ''}
  ${!full && typeof profileCardHTML === 'function' ? profileCardHTML() : ''}
  ${modeCard}
  <div id="anki">${ankiSectionHTML()}</div>
  <div class="card"><h2 style="margin-top:0">📊 Statystyki</h2>
    <div class="heat">${cells}</div><div class="spacer"></div>
    <div class="kv"><span>Seria dni nauki</span><b>🔥 ${streak()}</b></div>
    <div class="kv"><span>Wszystkie karty</span><b>${total}</b></div>
    <div class="kv"><span>Nowe (nieruszone)</span><b>${nw}</b></div>
    <div class="kv"><span>Opanowane (odstęp ≥ 21 dni)</span><b>${mature}</b></div>
    <div class="kv"><span>Skuteczność (30 dni)</span><b>${acc}%</b></div>
    <div class="kv"><span>Powtórek łącznie</span><b>${S.log.length}</b></div>
  </div>

  ${typeof statsChartsHTML === 'function' ? statsChartsHTML() : ''}

  <div class="card row nowrap"><span style="font-size:30px">🛡️</span><div class="grow"><b>Bezpieczeństwo danych</b><div class="small muted">Kopie, kosz, wersje w chmurze</div></div><button class="primary sm" data-go="#/safety">Otwórz</button></div>

  <div class="card row nowrap"><span style="font-size:30px">🔑</span><div class="grow"><b>Panel hosta</b><div class="small muted">GIF-y dla wszystkich użytkowników (wymaga kodu hosta)</div></div><button class="sm" data-go="#/host">Otwórz</button></div>

  ${typeof reactionsSectionHTML === 'function' ? reactionsSectionHTML() : ''}

  ${typeof soundsSectionHTML === 'function' ? soundsSectionHTML() : ''}

  <div class="card row nowrap"><span style="font-size:30px">🎨</span><div class="grow"><b>Wygląd</b><div class="small muted">Motyw, kolor tła i akcentu (paleta lub HEX)</div></div><button class="primary sm" data-go="#/theme">Zmień</button></div>

  <div class="card"><h2 style="margin-top:0">⏰ Przypomnienia</h2>
    <p class="small muted">Przeglądarka na iPhonie nie może sama wysyłać powiadomień o stałej porze bez serwera, dlatego aplikacja dodaje codzienne przypomnienie do Kalendarza – iPhone przypomni Ci o nauce, a stuknięcie w wydarzenie otworzy aplikację.</p>
    <label class="field"><span>Godzina nauki</span><input type="time" id="rem-time" value="${esc(st.reminder)}"></label>
    <button class="primary block" data-act="ics">📅 Dodaj codzienne przypomnienie do kalendarza</button>
    <div class="spacer"></div>
    <button class="block" data-act="badge">🔴 Pokazuj liczbę powtórek na ikonie aplikacji</button>
    <p class="small muted">Liczba na ikonie działa po dodaniu aplikacji do ekranu początkowego (iOS 16.4+).</p>
  </div>

  <div class="card"><h2 style="margin-top:0">🎯 Nauka</h2>
    <label class="field"><span>Nowych kart dziennie (na talię)</span><input type="number" min="0" max="999" id="set-new" value="${st.newPerDay}"></label>
    <label class="field"><span>Cel dzienny (liczba powtórek)</span><input type="number" min="1" max="2000" id="set-goal" value="${st.goal}"></label>
    <label class="check"><input type="checkbox" id="set-hide" ${st.hideAll ? 'checked' : ''}> Obraz z lukami: domyślnie ukrywaj wszystkie luki</label>
    <details class="adv"><summary>Ustawienia zaawansowane</summary>
      <label class="field"><span>Kroki nauki nowych kart (minuty, oddzielone spacją)</span><input id="set-steps" value="${esc(st.steps)}" placeholder="1 10" inputmode="numeric"></label>
      <label class="field"><span>Kroki po zapomnieniu (minuty)</span><input id="set-relearn" value="${esc(st.relearn)}" placeholder="10" inputmode="numeric"></label>
      <label class="field"><span>Maksymalny odstęp między powtórkami (dni)</span><input type="number" id="set-maxivl" min="1" max="36500" value="${st.maxIvl}"></label>
      <label class="field"><span>Premia za „Łatwe” (mnożnik odstępu)</span><input type="number" id="set-easy" min="1" max="3" step="0.05" value="${st.easyBonus}"></label>
      <label class="field"><span>Sprawdzanie wpisanych odpowiedzi</span><select id="set-tol">
        ${[['strict', 'Dokładne – bez literówek'], ['normal', 'Normalne – drobne literówki OK'], ['lenient', 'Łagodne – więcej literówek OK']].map(([v, l]) => `<option value="${v}" ${st.tolerance === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" id="set-anim" ${st.anim ? 'checked' : ''}> Animacje i konfetti</label>
      <label class="check"><input type="checkbox" id="set-sound" ${st.sound ? 'checked' : ''}> Dźwięki</label>
    </details>
  </div>

  <div class="card"><h2 style="margin-top:0">🔄 Telefon ⇄ komputer</h2>
    <p class="small muted">Dane są zapisywane na urządzeniu. Żeby mieć te same fiszki na iPhonie i komputerze, połącz oba z tym samym kontem GitHub – fiszki zapiszą się w Twoim prywatnym „Gist” i będą się same synchronizować.</p>
    <ol class="steps small">
      <li>Zaloguj się na <a href="https://github.com/settings/tokens/new?scopes=gist&description=Fiszki" target="_blank" rel="noopener">github.com → nowy token</a> (zaznaczony tylko zakres <code>gist</code>, ważność np. „No expiration”).</li>
      <li>Skopiuj token i wklej poniżej – na każdym urządzeniu ten sam.</li>
      <li>Naciśnij „Synchronizuj”. Gotowe – dalej dzieje się to samo.</li>
    </ol>
    <label class="field"><span>Token GitHub</span><input id="sync-token" type="password" value="${esc(st.sync.token)}" placeholder="ghp_…" autocomplete="off"></label>
    <label class="check"><input type="checkbox" id="sync-auto" ${st.autoSync ? 'checked' : ''}> Synchronizuj automatycznie</label>
    <button class="primary block" data-act="sync">🔄 Synchronizuj teraz</button>
    <p class="small muted center">Ostatnio: ${ago(st.lastSync)}</p>
    <h3>Kopia zapasowa (bez konta)</h3>
    <div class="row"><button class="grow" data-act="export">⬇️ Eksportuj plik</button><button class="grow" data-act="import">⬆️ Importuj plik</button></div>
    <p class="small muted">Plik możesz przesłać AirDropem / mailem i zaimportować na drugim urządzeniu – zmiany zostaną połączone.</p>
  </div>

  ${isStandalone ? '' : `<div class="card"><h2 style="margin-top:0">📱 Zainstaluj na iPhonie</h2>
    <ol class="steps"><li>Otwórz tę stronę w <b>Safari</b>.</li><li>Stuknij <b>Udostępnij</b> (kwadrat ze strzałką).</li>
    <li>Wybierz <b>Do ekranu początkowego</b>.</li></ol>
    <p class="small muted">Aplikacja będzie działać jak zwykła apka – pełny ekran, offline, z własną ikoną.</p></div>`}

  ${aiSectionHTML()}


  <div class="card"><h2 style="margin-top:0">Dane</h2>
    <button class="danger" data-act="wipe">Usuń wszystkie dane z tego urządzenia</button></div>
  <div class="row" style="justify-content:center"><span class="small muted">Wersja aplikacji: ${APP_VERSION}</span>
    <button class="sm ghost" data-act="check-update">🔄 Sprawdź aktualizację</button></div>`;
}
function mountMore() {
  const st = S.settings;
  const bind = (id, fn) => $(id)?.addEventListener('change', e => { fn(e.target); save(); });
  bind('#rem-time', t => st.reminder = t.value || '19:00');
  bind('#set-new', t => st.newPerDay = clamp(+t.value || 0, 0, 999));
  bind('#set-goal', t => st.goal = clamp(+t.value || 1, 1, 2000));
  bind('#set-hide', t => st.hideAll = t.checked);
  bind('#set-steps', t => { st.steps = LEARN_STEPS().join(' ') && parseSteps(t.value, [1, 10]).join(' '); t.value = st.steps; });
  bind('#set-relearn', t => { st.relearn = parseSteps(t.value, [10]).join(' '); t.value = st.relearn; });
  bind('#set-maxivl', t => st.maxIvl = clamp(+t.value || 36500, 1, 36500));
  bind('#set-easy', t => st.easyBonus = clamp(+t.value || 1.3, 1, 3));
  bind('#set-tol', t => st.tolerance = t.value);
  bind('#set-anim', t => { st.anim = t.checked; document.body.classList.toggle('noanim', !st.anim); });
  bind('#set-sound', t => st.sound = t.checked);
  bind('#sync-token', t => { st.sync.token = t.value.trim(); });
  bind('#sync-auto', t => st.autoSync = t.checked);
  mountAiSettings();
}

function makeICS() {
  const [h, m] = (S.settings.reminder || '19:00').split(':').map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1);
  const p = n => String(n).padStart(2, '0');
  const dt = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(h)}${p(m)}00`;
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const url = location.href.split('#')[0];
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fiszki//PL', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:fiszki-przypomnienie-${uid()}@fiszki`, `DTSTAMP:${now}`, `DTSTART:${dt}`, 'DURATION:PT20M', 'RRULE:FREQ=DAILY',
    'SUMMARY:📚 Powtórki w Fiszkach', `URL:${url}`, `DESCRIPTION:Czas na codzienne powtórki! ${url}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Czas na powtórki!', 'TRIGGER:PT0M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
function updateBadge() {
  if (!S) return;
  const n = deckCounts('all').total;
  document.title = n ? `(${n}) Fiszki` : 'Fiszki';
  if ('setAppBadge' in navigator) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
}

// ============================================================ Synchronizacja (GitHub Gist)
const GIST_DESC = 'Fiszki – dane synchronizacji (nie usuwaj)';
let syncing = false, syncTimer;

async function gh(path, opt = {}) {
  const r = await fetch('https://api.github.com' + path, {
    ...opt, headers: { Authorization: 'Bearer ' + S.settings.sync.token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
  });
  if (!r.ok) throw new Error(r.status === 401 ? 'nieprawidłowy token' : r.status === 404 ? '404' : 'GitHub ' + r.status);
  return r.json();
}
async function gistText(f) {
  if (!f.truncated && f.content != null) return f.content;
  const r = await fetch(f.raw_url); if (!r.ok) throw new Error('pobieranie pliku ' + r.status); return r.text();
}
function exportData() { const { settings, ...rest } = S; return { ...rest, exportedAt: Date.now() }; }
function mergeState(R) {
  const tomb = { ...S.tomb };
  for (const k in R.tomb || {}) tomb[k] = Math.max(R.tomb[k], tomb[k] || 0);
  for (const key of ['decks', 'notes', 'cards', 'palaces', 'topics', 'friends', 'stickies', 'atlases', 'events']) {
    S[key] = S[key] || [];
    const map = new Map(S[key].map(x => [x.id, x]));
    for (const r of R[key] || []) { const l = map.get(r.id); if (!l || (r.mod || 0) > (l.mod || 0)) map.set(r.id, r); }
    S[key] = [...map.values()].filter(x => !tomb[x.id]);
  }
  // ta sama luka utworzona na dwóch urządzeniach – zostaw kartę z większą historią
  const seen = new Map();
  for (const c of [...S.cards].sort((a, b) => b.srs.reps - a.srs.reps)) {
    const k = c.noteId + '|' + c.ord; if (seen.has(k)) removeCard(c); else seen.set(k, c);
  }
  const ids = new Set(S.log.map(l => l.id));
  for (const l of R.log || []) if (!ids.has(l.id)) S.log.push(l);
  S.log.sort((a, b) => a.t - b.t);
  for (const key of ['games', 'wallet', 'items', 'battles', 'logins']) {
    S[key] = S[key] || []; const ids = new Set(S[key].map(x => x.id));
    for (const x of R[key] || []) if (!ids.has(x.id)) S[key].push(x);
  }
  for (const k in R.ach || {}) S.ach[k] = Math.min(R.ach[k], S.ach[k] || Infinity);
  for (const k in R.stats || {}) S.stats[k] = Math.max(R.stats[k] || 0, S.stats[k] || 0);
  if (R.major && (R.major.mod || 0) > (S.major.mod || 0)) S.major = R.major;
  if (R.profile && (R.profile.mod || 0) > (S.profile.mod || 0)) S.profile = R.profile;
  S.tomb = tomb;
}
async function syncNow(manual) {
  const cfg = S.settings.sync;
  if (!cfg.token) { if (manual) toast('Najpierw wklej token GitHub w zakładce Więcej'); return; }
  if (syncing || !navigator.onLine) { if (manual && !navigator.onLine) toast('Brak internetu'); return; }
  syncing = true; if (manual) toast('Synchronizuję…', 10000);
  try {
    let gist = null;
    if (cfg.gistId) try { gist = await gh('/gists/' + cfg.gistId); } catch (e) { if (e.message !== '404') throw e; }
    if (!gist) {
      const found = (await gh('/gists?per_page=100')).find(g => g.description === GIST_DESC);
      if (found) gist = await gh('/gists/' + found.id);
    }
    const files = gist ? gist.files : {};
    if (files['data.json']) mergeState(JSON.parse(await gistText(files['data.json'])));
    const used = referencedImages();
    for (const name in files) {
      const m = name.match(/^img_(.+)\.txt$/);
      if (m && used.has(m[1]) && !IMG[m[1]]) { const d = await gistText(files[name]); IMG[m[1]] = d; await DB.set('img:' + m[1], d); }
    }
    const data = { 'data.json': { content: JSON.stringify(exportData()) } };
    if (!gist) gist = await gh('/gists', { method: 'POST', body: JSON.stringify({ description: GIST_DESC, public: false, files: data }) });
    else await gh('/gists/' + gist.id, { method: 'PATCH', body: JSON.stringify({ files: data }) });
    const up = [...used].filter(id => IMG[id] && !files['img_' + id + '.txt']);
    for (let i = 0; i < up.length; i += 3) {
      const f = {}; up.slice(i, i + 3).forEach(id => { f['img_' + id + '.txt'] = { content: IMG[id] }; });
      await gh('/gists/' + gist.id, { method: 'PATCH', body: JSON.stringify({ files: f }) });
    }
    cfg.gistId = gist.id; S.settings.lastSync = Date.now();
    await DB.set('state', S); updateBadge();
    if (manual) toast('Zsynchronizowano ✓');
    emit('synced');
    const r = parseRoute().parts[0];
    if (!['study', 'quiz', 'add', 'edit', 'station', 'walk'].includes(r)) render();
  } catch (e) {
    console.error(e); if (manual) toast('Błąd synchronizacji: ' + e.message, 4000);
  } finally { syncing = false; }
}
function scheduleSync() {
  if (!S.settings.autoSync || !S.settings.sync.token) return;
  clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(false), 15000);
}

// ============================================================ Akcje (kliknięcia)
const ACTIONS = {
  'new-deck': () => { const n = prompt('Nazwa nowej talii:'); if (n) { newDeck(n); render(); } },
  'rename-deck': el => { const d = deckById(el.dataset.id); const n = prompt('Nowa nazwa talii:', d.name); if (n) { d.name = n.trim(); touch(d); save(); render(); } },
  'delete-deck': el => { const d = deckById(el.dataset.id); if (confirm(`Usunąć talię „${d.name}” razem ze wszystkimi fiszkami?`)) { deleteDeck(d); go('#/'); } },
  'reset-deck': el => {
    if (!confirm('Zresetować postęp nauki w tej talii? Fiszki zostaną, ale wszystkie będą znowu nowe.')) return;
    S.cards.filter(c => c.deckId === el.dataset.id).forEach(c => { c.srs = newSrs(); touch(c); }); save(); render();
  },
  'cram-hard': el => { const d = el.dataset.id || 'all'; SESSION = null; go(`#/study/${d}/flip?cram=hard`); },
  'cram-deck': el => { SESSION = null; go(`#/study/${el.dataset.id}/flip?cram=all`); },
  'end-study': el => { SESSION = null; go(el.dataset.href); },
  'switch-mode': el => { if (SESSION) { const [d, , c] = SESSION.key.split('/'); SESSION.key = `${d}/${el.dataset.href.split('/')[3].split('?')[0]}/${c}`; SESSION.mode = SESSION.key.split('/')[1]; } location.replace(el.dataset.href); },
  show: () => { SESSION.shown = true; SESSION.spoken = false; render(); },
  speak: () => { const v = cardView(SESSION.card); speak(stripHtml(SESSION.shown ? v.a : v.q)); },
  hint: () => { SESSION.hint = true; render(); },
  check: () => {
    const v = $('#typein').value, c = cardView(SESSION.card);
    SESSION.typed = v; SESSION.verdict = checkAnswer(v, c.ans); SESSION.shown = true; render();
  },
  grade: el => answer(+el.dataset.g),
  undo: () => undo(),

  'quiz-start-custom': el => { const v = Math.round(+$('#quiz-n').value); if (!(v >= 1)) return toast('Wpisz liczbę pytań'); el.dataset.n = v; ACTIONS['quiz-start'](el); },
  'quiz-start': el => { QUIZ = buildQuiz(el.dataset.deck, el.dataset.type, +el.dataset.n); if (!QUIZ.items.length) { QUIZ = null; toast('Brak kart z odpowiedziami'); } render(); },
  'quiz-pick': el => { const it = QUIZ.items[QUIZ.i], v = cardView(S.cards.find(c => c.id === it.cardId)); it.given = +el.dataset.k; it.ok = it.options[it.given] === v.ans; render(); },
  'quiz-check': () => { const it = QUIZ.items[QUIZ.i], v = cardView(S.cards.find(c => c.id === it.cardId)); it.given = $('#quizin').value; it.ok = checkAnswer(it.given, v.ans) !== 'wrong'; render(); },
  'quiz-override': () => { QUIZ.items[QUIZ.i].ok = true; render(); },
  'quiz-next': () => { QUIZ.i++; render(); window.scrollTo(0, 0); },
  'quiz-again': () => { QUIZ = null; render(); },
  'quiz-end': el => { QUIZ = null; go(el.dataset.href); },
  'quiz-cram': () => { const ids = QUIZ.items.filter(x => !x.ok).map(x => x.cardId); const d = QUIZ.deckId; SESSION = null; QUIZ = null; go(`#/study/${d}/flip?cram=list&ids=${ids.join(',')}`); },
  'quiz-due': () => {
    const now = Date.now(); let n = 0;
    QUIZ.items.filter(x => !x.ok).forEach(x => { const c = S.cards.find(y => y.id === x.cardId); if (c && c.srs.state !== 'new' && c.srs.due > now) { c.srs = { ...c.srs, due: dayStart(now) }; touch(c); n++; } });
    save(); toast(n ? `Dodano ${n} do dzisiejszych powtórek` : 'Te karty są nowe lub już czekają na powtórkę');
  },

  'draft-type': el => {
    if (DRAFT.type !== el.dataset.t) {
      if (el.dataset.t === 'mix' && DRAFT.mixBack) { DRAFT.bulk = DRAFT.mixBack.bulk; DRAFT.mixOn = DRAFT.mixBack.mixOn; }
      delete DRAFT.mixBack; DRAFT.type = el.dataset.t; DRAFT.imageId = null; DRAFT.boxes = [];
    }
    render();
  },
  'mix-add-img': () => { DRAFT.mixBack = { bulk: DRAFT.bulk, mixOn: DRAFT.mixOn }; DRAFT.type = 'occl'; DRAFT.imageId = null; DRAFT.boxes = []; render(); scrollTo(0, 0); },
  'mix-back': () => { const m = DRAFT.mixBack || {}; DRAFT = { ...freshDraft('mix', DRAFT.deckId), bulk: m.bulk || '', mixOn: m.mixOn }; render(); },
  'deck-mix': el => { const d = deckById(el.dataset.id); if (!d) return; d.mix = !d.mix; touch(d); save(); render(); toast(d.mix ? '🔀 Nowe karty będą się przeplatać losowo' : 'Nowe karty w kolejności dodania'); },
  'cancel-edit': () => { DRAFT = null; history.back(); },
  'save-draft': () => saveDraft(),
  'delete-note': () => { const n = noteById(DRAFT.editId); if (n && confirm('Usunąć tę fiszkę?')) { const d = n.deckId; deleteNote(n); save(); gcImages(); DRAFT = null; go(`#/deck/${d}`); } },
  cloze: el => {
    const ta = $('#cloze-ta'), v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
    const nums = [...v.matchAll(CLOZE_RE)].map(m => +m[1]), max = nums.length ? Math.max(...nums) : 0;
    const n = el.dataset.same === '1' ? Math.max(1, max) : max + 1;
    const sel = v.slice(s, e).trim();
    if (!sel) return toast('Najpierw zaznacz fragment tekstu');
    ta.value = v.slice(0, s) + `{{c${n}::${sel}}}` + v.slice(e); DRAFT.text = ta.value;
    $('#cloze-prev').innerHTML = clozePreview(DRAFT.text);
  },
  'basic-img': async () => { const id = await getImage('file'); if (id) { DRAFT.imageId = id; render(); } },
  'basic-img-paste': async () => { const id = await getImage('paste'); if (id) { DRAFT.imageId = id; render(); } },
  'basic-img-del': () => { DRAFT.imageId = null; render(); },
  'occl-pick': async () => { const id = await getImage('file'); if (id) { DRAFT.imageId = id; DRAFT.boxes = []; render(); } },
  'occl-paste': async () => { const id = await getImage('paste'); if (id) { DRAFT.imageId = id; DRAFT.boxes = []; render(); } },
  'occl-clear': () => { if (!DRAFT.boxes.length || confirm('Zmienić obraz? Narysowane luki zostaną usunięte.')) { DRAFT.imageId = null; DRAFT.boxes = []; render(); } },
  'occl-draw': () => { DRAFT.draw = !DRAFT.draw; render(); },
  'box-del': el => { DRAFT.boxes = DRAFT.boxes.filter(b => b.id !== el.dataset.id); drawBoxes(); drawBoxList(); },

  'palace-new': () => {
    const n = prompt('Nazwa pałacu (np. „Droga do szkoły – kości ręki”):'); if (!n) return;
    const p = touch({ id: uid(), name: n.trim(), place: '', stations: [], created: Date.now() }); S.palaces.push(p); save(); go(`#/palace/${p.id}`);
  },
  'palace-rename': el => { const p = palaceById(el.dataset.id); const n = prompt('Nazwa pałacu:', p.name); if (n) { p.name = n.trim(); touch(p); save(); render(); } },
  'palace-del': el => { const p = palaceById(el.dataset.id); if (confirm(`Usunąć pałac „${p.name}”?`)) { S.palaces = S.palaces.filter(x => x !== p); S.tomb[p.id] = Date.now(); save(); gcImages(); go('#/palaces'); } },
  'open-maps': el => {
    const p = palaceById(el.dataset.id), q = $('#maps-q').value.trim(); p.place = q; touch(p); save();
    window.open(q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : 'https://www.google.com/maps', '_blank');
  },
  'station-add': async el => { const id = await getImage(el.dataset.src); if (id) addStation(el.dataset.id, id); },
  'station-del': el => {
    const p = palaceById(el.dataset.pid); if (!confirm('Usunąć to miejsce razem z pinezkami?')) return;
    p.stations = p.stations.filter(s => s.id !== el.dataset.id); touch(p); save(); gcImages(); go(`#/palace/${p.id}`);
  },
  'pin-del': el => {
    const { parts } = parseRoute(); const p = palaceById(parts[1]), s = p.stations.find(x => x.id === parts[2]);
    s.pins = s.pins.filter(x => x.id !== el.dataset.id); touch(p); save(); render();
  },
  'palace-cards': el => {
    const p = palaceById(el.dataset.id);
    const names = S.decks.map((d, i) => `${i + 1}. ${d.name}`).join('\n');
    const ans = prompt(`Do której talii dodać fiszki z pałacu?\n${names}\n\nWpisz numer albo nazwę nowej talii:`, p.name);
    if (!ans) return;
    const deck = S.decks[+ans - 1] || S.decks.find(d => d.name === ans.trim()) || newDeck(ans);
    const n = palaceToCards(p, deck.id);
    toast(n ? `Gotowe: ${n} ${plural(n, 'karta', 'karty', 'kart')} w talii „${deck.name}”` : 'Uzupełnij pole „fakt” w pinezkach', 3500);
  },
  'walk-assoc': () => { WALK.assoc = true; render(); },
  'walk-fact': () => { WALK.fact = true; WALK.assoc = true; render(); },
  'walk-step': el => { WALK.i += +el.dataset.d; WALK.assoc = false; WALK.fact = false; render(); },

  sync: () => syncNow(true),
  'check-update': async () => {
    toast('Sprawdzam…');
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update();
      const r = await fetch('app.js?t=' + Date.now(), { cache: 'no-store' }), txt = await r.text();
      const v = (txt.match(/APP_VERSION = '(\d+)'/) || [])[1];
      if (v && v !== APP_VERSION) { toast(`Nowa wersja ${v} – wczytuję…`); setTimeout(() => location.reload(), 800); }
      else toast('Masz najnowszą wersję ✓');
    } catch { toast('Brak połączenia z internetem'); }
  },
  'set-mode': el => { const m = el.dataset.m; S.settings.mode = m; S.settings.minimal = m !== 'full'; save(); render();
    toast({ full: '🎮 Tryb pełny', minimal: '🧘 Tryb skupienia', zen: '🎯 Pełne skupienie – tylko nauka' }[m]); },
  ics: () => { download('fiszki-przypomnienie.ics', makeICS(), 'text/calendar'); toast('Otwórz pobrany plik i dodaj do kalendarza', 3500); },
  badge: async () => {
    if (!('setAppBadge' in navigator)) return toast('Ta przeglądarka nie obsługuje liczby na ikonie. Dodaj aplikację do ekranu początkowego.', 4000);
    if ('Notification' in window && Notification.permission !== 'granted') await Notification.requestPermission();
    updateBadge(); toast('Gotowe – liczba powtórek pokaże się na ikonie');
  },
  export: () => {
    S.settings.lastExport = Date.now(); save();
    const used = referencedImages(), images = {};
    used.forEach(id => { if (IMG[id]) images[id] = IMG[id]; });
    const blob = new Blob([JSON.stringify({ app: 'fiszki', data: exportData(), images })], { type: 'application/json' });
    shareOrDownload(blob, `fiszki-kopia-${dayKey(Date.now())}.json`);   // na iPhonie: „Zapisz w Plikach” / iCloud Drive
  },
  import: async () => {
    const f = await pickFile('.json,application/json'); if (!f) return;
    if (typeof snapshot === 'function') await snapshot('przed importem');
    try {
      const j = JSON.parse(await f.text()); if (j.app !== 'fiszki') throw new Error('to nie jest kopia Fiszek');
      for (const [id, d] of Object.entries(j.images || {})) { IMG[id] = d; await DB.set('img:' + id, d); }
      mergeState(j.data); save(); render(); toast('Zaimportowano ✓');
    } catch (e) { toast('Błąd importu: ' + e.message, 4000); }
  },
  wipe: async () => {
    if (!confirm('Na pewno usunąć WSZYSTKIE fiszki z tego urządzenia? (Dane w synchronizacji GitHub zostaną.)')) return;
    for (const k of await DB.keys()) await DB.del(k);
    location.reload();
  },
};
function act(name, el = document.body, e) { const fn = ACTIONS[name]; if (fn) fn(el, e); }

document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]'), a0 = e.target.closest('[data-act]');
  if (g && !(a0 && g.contains(a0) && a0 !== g)) { e.preventDefault(); go(g.dataset.go); return; }
  const a = a0;
  if (a && !a.disabled) { e.preventDefault(); act(a.dataset.act, a, e); }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.actChange === 'deckpick') {
    if (el.value === '__new') {
      const n = prompt('Nazwa nowej talii:');
      if (n) DRAFT.deckId = newDeck(n).id;
      render();
    } else DRAFT.deckId = el.value;
  }
});
// Skróty klawiszowe na komputerze: spacja = pokaż, 1–4 = ocena
document.addEventListener('keydown', e => {
  if (parseRoute().parts[0] !== 'study' || !SESSION?.card) return;
  if (e.target.matches('input, textarea')) return;
  if ((e.key === ' ' || e.key === 'Enter') && !SESSION.shown) { e.preventDefault(); act('show'); }
  else if (SESSION.shown && /^[1-4]$/.test(e.key)) answer(+e.key);
  else if (SESSION.shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); answer(3); }
  else if (e.key === 'h' && !SESSION.shown) act('hint');
  else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) undo();
});

// ============================================================ Start aplikacji
function seed() {
  const d = newDeck('Przykład – anatomia');
  const t = Date.now();
  addNote({ deckId: d.id, created: t, type: 'basic', front: 'Najdłuższa kość w ciele człowieka', back: 'Kość udowa (os femoris)', hint: 'FEMORIS – „FEMme” na długich nogach', extra: '' });
  addNote({ deckId: d.id, created: t + 1, type: 'cloze', text: 'Mięsień {{c1::dwugłowy ramienia::biceps}} zgina staw {{c2::łokciowy}}.', hint: '', extra: '' });
  addNote({ deckId: d.id, created: t + 2, type: 'basic', front: 'Ile kości ma dorosły człowiek?', back: '206', hint: '2 + 0 + 6 = 8 kończyn ośmiornicy', extra: '', reverse: false });
}

async function init() {
  try {
    await DB.open();
    S = await DB.get('state');
    const keys = await DB.keys();
    for (const k of keys) if (String(k).startsWith('img:')) IMG[k.slice(4)] = await DB.get(k);
  } catch (e) {
    console.error(e); $('#view').innerHTML = '<div class="card">Nie udało się otworzyć bazy danych. Wyłącz tryb prywatny w Safari.</div>'; return;
  }
  if (!S) { S = blankState(); seed(); await DB.set('state', S); }
  S.games = S.games || [];
  for (const [k, v] of Object.entries(extraState())) if (S[k] == null) S[k] = v;
  S.settings = { ...structuredClone(DEFAULT_SETTINGS), ...S.settings, sync: { ...DEFAULT_SETTINGS.sync, ...(S.settings?.sync || {}) } };
  navigator.storage?.persist?.();
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  if (typeof applyTheme === 'function') applyTheme();
  render();
  updateBadge();
  emit('start');
  if (S.settings.autoSync && S.settings.sync.token) syncNow(false);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { DB.set('state', S); if (S.settings.autoSync && S.settings.sync.token) { clearTimeout(syncTimer); syncNow(false); } }
    else { updateBadge(); const r = parseRoute().parts[0]; if (!r) render(); if (S.settings.autoSync && S.settings.sync.token && Date.now() - S.settings.lastSync > 5 * MIN) syncNow(false); }
  });
  if ('serviceWorker' in navigator) {
    // nowa wersja aplikacji: gdy nowy service worker przejmie kontrolę, przeładuj raz stronę
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    }).catch(() => {});
  }
}
// start po wczytaniu wszystkich skryptów (anki.js, scan.js)
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

Object.assign(ACTIONS, {
  'note-del': el => { deleteNotes([el.dataset.id]); render(); },
  'note-selmode': () => { NOTE_SEL = NOTE_SEL ? null : new Set(); render(); },
  'note-sel': el => { const id = el.dataset.id; NOTE_SEL.has(id) ? NOTE_SEL.delete(id) : NOTE_SEL.add(id); render(); },
  'note-selall': el => { const ids = S.notes.filter(n => n.deckId === el.dataset.id).map(n => n.id); NOTE_SEL = NOTE_SEL.size === ids.length ? new Set() : new Set(ids); render(); },
  'note-seldel': () => {
    const ids = [...NOTE_SEL]; if (!ids.length) return;
    if (ids.length > 1 && !confirm(`Usunąć ${ids.length} ${plural(ids.length, 'fiszkę', 'fiszki', 'fiszek')}? (Możesz cofnąć albo przywrócić z kosza.)`)) return;
    NOTE_SEL = null; deleteNotes(ids); render();
  },
});
window.addEventListener('hashchange', () => { NOTE_SEL = null; });

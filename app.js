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
const APP_VERSION = '204';   // podbijaj razem z CACHE w sw.js
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
function extraState() { return { topics: [], friends: [], games: [], ach: {}, stats: {}, major: { words: {}, mod: 0 }, profile: { nick: '', avatar: '🦊', mod: 0 }, wallet: [], items: [], battles: [], stickies: [], atlases: [], events: [], logins: [], tlog: [], eggs: [] }; }

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
  S.notes.forEach(n => { n.imageId && s.add(n.imageId); n.backImageId && s.add(n.backImageId); n.hintImg && s.add(n.hintImg); });
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
  return n.revOnly ? ['r'] : n.reverse ? ['f', 'r'] : ['f'];   // revOnly: tylko tył → przód (kierunek talii)
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
// ---------- 🎓 Tryb egzaminu: data egzaminu talii → tyle nowych dziennie, żeby zdążyć, i powtórka tuż przed egzaminem
const examDay = d => d?.exam ? new Date(d.exam + 'T00:00').getTime() : 0;
function examInfo(d) {
  const ex = examDay(d); if (!ex) return null;
  const today = dayStart(), daysLeft = Math.round((ex - today) / DAY);
  if (daysLeft < 0) return { past: true, date: ex, daysLeft };
  const cards = S.cards.filter(c => c.deckId === d.id), intro = introducedToday()[d.id] || 0;
  const newLeft = cards.filter(c => c.srs.state === 'new').length + intro;   // z dzisiejszymi już zaczętymi
  const newDays = Math.max(1, daysLeft - 2);                                 // ostatnie 2 dni = tylko powtórki
  const perDay = daysLeft <= 2 ? newLeft : Math.ceil(newLeft / newDays);
  const learned = cards.filter(c => c.srs.state !== 'new').length;
  return { date: ex, daysLeft, newLeft: newLeft - intro, perDay, total: cards.length, learned, ok: perDay <= Math.max(40, S.settings.newPerDay * 2) };
}
// dzienny limit nowych dla talii: ustawienie albo więcej, jeśli wymaga tego egzamin
const deckNewLimit = id => { const e = examInfo(deckById(id)); return e && !e.past ? Math.max(S.settings.newPerDay, e.perDay) : S.settings.newPerDay; };
const fmtDay = t => new Date(t).toLocaleDateString('pl', { weekday: 'short', day: 'numeric', month: 'short' });
const inDays = n => n === 0 ? 'dziś' : n === 1 ? 'jutro' : `za ${n} dni`;
function examCardHTML(d) {
  const e = examInfo(d);
  if (!e) return `<details class="exam-set"><summary>🎓 Mam egzamin / kolokwium z tej talii</summary>
    <label class="field"><span>Data egzaminu</span><input type="date" data-exam="${d.id}" min="${new Date().toISOString().slice(0, 10)}"></label>
    <p class="small muted">Aplikacja rozłoży nowe fiszki tak, żebyś zdążył, a każda karta wróci na powtórkę dzień przed egzaminem.</p></details>`;
  if (e.past) return `<div class="exam-box past"><span>🎓 Egzamin był ${fmtDay(e.date)}.</span><button class="sm" data-act="exam-clear" data-id="${d.id}">Usuń datę</button></div>`;
  const pct = e.total ? Math.round(e.learned / e.total * 100) : 0;
  return `<div class="exam-box${e.ok ? '' : ' warn'}"><div class="row nowrap"><b class="grow">🎓 Egzamin ${inDays(e.daysLeft)} · ${fmtDay(e.date)}</b><button class="sm ghost" data-act="exam-clear" data-id="${d.id}" title="Usuń datę">✕</button></div>
    ${progress(pct / 100)}<div class="small">${e.learned}/${e.total} kart rozpoczętych (${pct}%)</div>
    <div class="small">${e.newLeft > 0 ? `📅 Plan: <b>${e.perDay}</b> nowych dziennie${e.daysLeft > 2 ? ' · ostatnie 2 dni tylko powtórki' : ''}` : '✅ Wszystkie karty rozpoczęte – teraz już tylko powtórki'}</div>
    ${e.ok ? '' : `<div class="small c-hard">⚠️ Dużo na dzień – zacznij od razu albo przejrzyj całą talię kilka razy („Przejrzyj całą talię”).</div>`}</div>`;
}
function deckCounts(deckId, noLimit) {
  const eod = addDays(dayStart(), 1), intro = introducedToday();
  const per = {};
  for (const c of S.cards) {
    if ((deckId !== 'all' && c.deckId !== deckId) || c.sus) continue;
    const p = per[c.deckId] || (per[c.deckId] = { n: 0, l: 0, r: 0 });
    if (c.srs.state === 'new') p.n++;
    else if (c.srs.due < eod) isLearning(c) ? p.l++ : p.r++;
  }
  let nw = 0, lrn = 0, rev = 0;
  for (const id in per) {
    nw += noLimit ? per[id].n : Math.min(per[id].n, Math.max(0, deckNewLimit(id) - (intro[id] || 0)));
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
// 🧠 trudne: zapomniana min. 2 razy, w trakcie ponownej nauki albo w ostatnich 3 ocenach choć raz „Nie pamiętam” / „Trudne”
// (zostaje na liście, dopóki kilka razy z rzędu nie pójdzie dobrze – samo jedno zaliczenie jej nie usuwa)
let HARD_CACHE = { n: -1, set: null };
function recentHardSet() {
  if (HARD_CACHE.n === S.log.length && HARD_CACHE.set) return HARD_CACHE.set;
  const last = new Map();
  for (let i = S.log.length - 1; i >= 0; i--) { const l = S.log[i]; if (!l.c) continue; const a = last.get(l.c) || []; if (a.length < 3) { a.push(l.g); last.set(l.c, a); } }
  const set = new Set(); for (const [id, gs] of last) if (gs.some(g => g <= 2)) set.add(id);
  HARD_CACHE = { n: S.log.length, set }; return set;
}
// talia zdana (kolokwium zaliczone) – jej fiszki nie są już ani trudne, ani oznaczone do powtórki
const deckPassed = id => !!deckById(id)?.done;
const isHardCard = c => !deckPassed(c.deckId) && (c.srs.lapses >= 2 || c.srs.state === 'relearn' || recentHardSet().has(c.id));
const difficultCards = () => S.cards.filter(isHardCard);

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
  const ar = OCCL_AR[n.imageId];
  return `<div class="occl ${extraCls}"${ar ? ` style="--ar:${ar}"` : ''}><img src="${src}" alt="" data-ar="${n.imageId}">${marks}</div>`;
}
// proporcje obrazu: ramka z zasłonkami ma dokładnie szerokość obrazka (inaczej przy niskim ekranie obraz się zwęża, a zasłonki zostają na miejscu)
const OCCL_AR = {};
document.addEventListener('load', e => { const im = e.target; if (im.tagName !== 'IMG' || !im.parentElement?.classList.contains('occl') || !im.naturalHeight) return;
  const ar = +(im.naturalWidth / im.naturalHeight).toFixed(4); if (im.dataset.ar) OCCL_AR[im.dataset.ar] = ar; im.parentElement.style.setProperty('--ar', ar); }, true);

// Zwraca: q (pytanie), a (odpowiedź), ans (tekst odpowiedzi do wpisywania/testu), hints, label (krótki opis)
function cardView(c) {
  const n = noteById(c.noteId);
  if (!n) return { q: '', a: '', b: '', ans: '', hints: [], label: '?' };
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
      get b() { return this.a; },
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
      get b() { return this.a; },
    };
  }
  const fwd = c.ord !== 'r';
  const img = n.imageId && IMG[n.imageId] ? `<img class="cimg" src="${IMG[n.imageId]}" alt="">` : '';
  const front = fwd ? n.front : n.back, back = fwd ? n.back : n.front;
  if (n.hint) hints.push(n.hint);
  const q = (fwd ? img : '') + `<div class="ctext">${fmt(front)}</div>`;
  const bimg = n.backImageId && IMG[n.backImageId] ? `<img class="cimg" src="${IMG[n.backImageId]}" alt="">` : '';
  const q2 = fwd ? q : bimg + `<div class="ctext">${fmt(front)}</div>`;
  const backSide = `${fwd ? bimg : img}<div class="ctext">${fmt(back)}</div>${extra}`;
  return { q: q2, a: q2 + `<hr><div class="ctext">${fmt(back)}</div>${fwd ? bimg : img}${extra}`, b: backSide, ans: (back || '').trim(), hints, label: (front || '').trim() || '(obraz)' };
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
// „z sensem”: liczą się słowa kluczowe (bez spójników), w dowolnej kolejności i z dowolną końcówką (oddychanie ≈ oddychania)
const STOPW = new Set('i w z na do sie o od po a oraz lub albo czy ze to jest sa jak dla przez przy ten ta te tez jego jej ich nie tak the of and or an is in on'.split(' '));
const keyWords = s => norm(s).split(' ').filter(w => w.length > 2 && !STOPW.has(w));
const wordHit = (w, list) => list.some(x => x === w
  || (w.length >= 4 && x.length >= 4 && (x.startsWith(w.slice(0, Math.max(4, w.length - 3))) || w.startsWith(x.slice(0, Math.max(4, x.length - 3)))))
  || (w.length >= 5 && lev(w, x) <= (w.length > 8 ? 2 : 1)));
const NEG = /\b(not|no|never|nie|nigdy|bez)\b/;   // przeczenie zmienia sens: „lean back” ≠ „don't lean back”
function meaningMatch(input, correct) {
  if (NEG.test(norm(input)) !== NEG.test(norm(correct))) return false;
  const want = [...new Set(keyWords(correct))], got = keyWords(input);
  if (!want.length || !got.length) return false;
  const hit = want.filter(w => wordHit(w, got)).length;
  if (want.length <= 2) return hit === want.length;          // krótka odpowiedź: wszystkie słowa kluczowe
  // długie wyjaśnienie: wystarczą najważniejsze pojęcia (≥30%), ale większość wpisanych słów musi pasować (bez „sypania” słowami)
  if (want.length >= 10) return got.length >= 3 && hit / want.length >= .3 && got.filter(g => wordHit(g, want)).length / got.length >= .5;
  return hit / want.length >= (want.length >= 6 ? .5 : .6);  // średnia: większość sensu
}
// 🇬🇧 skróty angielskie liczą się jak pełna forma: don't = do not, can't = cannot, it's = it is…
const EN_CONTR = [[/\bcant\b/gi, 'cannot'], [/\bwont\b/gi, 'will not'], [/\b(do|does|did|is|are|was|were|has|have|had|could|would|should|must|need)nt\b/gi, '$1 not'], [/\bcan['’]t\b/gi, 'cannot'], [/\bcan not\b/gi, 'cannot'], [/\bwon['’]t\b/gi, 'will not'], [/\bshan['’]t\b/gi, 'shall not'], [/\b(\w+)n['’]t\b/gi, '$1 not'],
  [/\b(i)['’]m\b/gi, '$1 am'], [/\b(\w+)['’]re\b/gi, '$1 are'], [/\b(\w+)['’]ve\b/gi, '$1 have'], [/\b(\w+)['’]ll\b/gi, '$1 will'], [/\b(it|he|she|that|there|what|who|where|here)['’]s\b/gi, '$1 is'], [/\blet['’]s\b/gi, 'let us']];
const enExpand = t => EN_CONTR.reduce((a, [re, r]) => a.replace(re, r), String(t));
function checkAnswer(input, correct, tol = S?.settings?.tolerance || 'normal') {
  input = enExpand(input); correct = enExpand(correct);
  const x = norm(input); if (!x) return 'wrong';
  const paren = [...String(correct).matchAll(/\(([^)]+)\)/g)].map(m => m[1]);   // „Kość udowa (os femoris)” → też „kość udowa” i „os femoris”
  const alts = [correct, String(correct).replace(/\([^)]*\)/g, ' '), ...paren, ...String(correct).split(/[\/;|,]| lub | albo /)].map(norm).filter(Boolean);
  if (alts.includes(x)) return 'ok';
  if (tol === 'strict') return 'wrong';
  const f = tol === 'lenient' ? 0.34 : 0.2;
  const close = alts.some(a => lev(x, a) <= Math.max(1, Math.floor(a.length * f)) && NEG.test(a) === NEG.test(x));
  return close || meaningMatch(input, correct) ? 'close' : 'wrong';
}

// ============================================================ Sesja nauki
let SESSION = null;
setInterval(() => { const el = document.getElementById('sess-time'); if (el && SESSION && document.visibilityState === 'visible') el.textContent = fmtClock(sessLiveMs(SESSION)); }, 1000);
// ---------- zapamiętana sesja nauki: przejście na inną kartę/aplikację albo zamknięcie przez iOS nie kasuje postępu
const SESS_KEY = 'studySess', SESS_TTL = 12 * HOUR;
function saveSess() {
  const s = SESSION; if (!s?.key) return;
  try {
    if (!s.card) return localStorage.removeItem(SESS_KEY);   // skończona – nie ma czego wznawiać
    localStorage.setItem(SESS_KEY, JSON.stringify({ key: s.key, hash: location.hash, deckId: s.deckId, mode: s.mode, all: s.all, cram: s.cram, done: s.done, only: s.only ? [...s.only] : null,
      cardId: s.card.id, shown: !!s.shown, timeMs: s.timeMs || 0, t: Date.now() }));
  } catch { /* */ }
}
function loadSess() { try { const j = JSON.parse(localStorage.getItem(SESS_KEY) || 'null'); return j && Date.now() - j.t < SESS_TTL ? j : null; } catch { return null; } }
const dropSess = () => { try { localStorage.removeItem(SESS_KEY); } catch { /* */ } };
function restoreSess(key) {
  const j = loadSess(); if (!j || j.key !== key) return false;
  const card = S.cards.find(c => c.id === j.cardId);
  SESSION = { all: j.all, only: j.only ? new Set(j.only) : null, key: j.key, deckId: j.deckId, mode: j.mode, cram: j.cram ? j.cram.filter(id => S.cards.some(c => c.id === id)) : null,
    done: j.done || 0, timeMs: j.timeMs || 0, card: null, shown: false, hint: false, typed: null, verdict: null, undo: null, lastNote: null, shownAt: Date.now() };
  if (card && (!SESSION.cram || SESSION.cram[0] === card.id)) { SESSION.card = card; SESSION.shown = !!j.shown && j.mode === 'flip'; }
  else nextCard();
  return true;
}

function startSession(deckId, mode, cramIds = null, all = false, only = null) {
  SESSION = { all, only: only ? new Set(only) : null,
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
const LEARN_OPEN_MAX = 10;
function pickNext(sess) {
  if (sess.cram) return S.cards.find(c => c.id === sess.cram[0]) || null;
  const now = Date.now();
  const pool = S.cards.filter(c => !c.sus && (sess.deckId === 'all' || c.deckId === sess.deckId) && (!sess.only || sess.only.has(c.id)));
  const choose = arr => arr.find(c => c.noteId !== sess.lastNote) || arr[0];
  const byDue = (a, b) => a.srs.due - b.srs.due;
  const lrn = pool.filter(c => isLearning(c) && c.srs.due <= now).sort(byDue);
  if (lrn.length) return lrn[0];
  const rev = pool.filter(c => c.srs.state === 'review' && c.srs.due <= now).sort(byDue);
  const intro = introducedToday();
  const nwAll = pool.filter(c => c.srs.state === 'new' && (sess.all || (intro[c.deckId] || 0) < deckNewLimit(c.deckId))), key = newOrderKey(nwAll);   // sess.all: bez dziennego limitu
  const nw = nwAll.sort((a, b) => key(a) - key(b));
  // dużo kart „w nauce” naraz (np. 20× „Nie pamiętam”) → najpierw je utrwal, zanim dojdą kolejne nowe
  const open = pool.filter(isLearning);
  if (nw.length && !rev.length && open.length >= LEARN_OPEN_MAX) { const soon = open.filter(c => c.srs.due <= now + 20 * MIN).sort(byDue)[0]; if (soon) return soon; }
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
  s.card = pickNext(s); s.shown = false; s.peek = false; s.editHint = false; s.flipping = false; s.spoken = false; s.hint = false; s.typed = null; s.verdict = null; s.shownAt = Date.now();
}
function answer(g) {
  const s = SESSION, c = s.card; if (!c) return;
  const spent = Math.min(60000, Date.now() - (s.shownAt || Date.now())); s.timeMs = (s.timeMs || 0) + spent;
  // do nagrody za ukończony zestaw: wpisane karty liczą się zawsze, przewijane – tylko gdy nie były „przeklikane”
  const viaType = s.mode === 'type' && s.verdict;
  if (viaType || spent >= FLIP_MIN_MS) ((s.got = s.got || { flip: {}, type: {} })[viaType ? 'type' : 'flip'])[c.id] = 1;
  if (s.cram) {
    (S.tlog = S.tlog || []).push({ id: uid(), t: Date.now(), d: c.deckId, ms: spent }); save();
    s.undo = null; s.cram.shift();
    if (g === 1) s.cram.splice(Math.min(3, s.cram.length), 0, c.id);
    else s.done++;
  } else {
    const wasNew = c.srs.state === 'new';
    const typed = s.mode === 'type' && s.verdict;   // m/v: tryb i wynik – wpisywane odpowiedzi są warte więcej niż przewijane
    const entry = { id: uid(), c: c.id, d: c.deckId, t: Date.now(), g, n: wasNew ? 1 : 0, ms: Math.min(60000, Date.now() - s.shownAt), m: typed ? 'type' : 'flip', ...(typed ? { v: s.verdict } : {}) };
    s.undo = { cardId: c.id, srs: c.srs, logId: entry.id, mod: c.mod };
    const ivl0 = c.srs.ivl || 0;
    c.srs = schedule(c.srs, g); touch(c); S.log.push(entry); s.done++;
    proofGems(s, c, typed ? s.verdict : null, ivl0);
    // egzamin: każda karta wraca najpóźniej dzień przed egzaminem (powtórka „na świeżo”)
    const ex = examDay(deckById(c.deckId)), before = ex - DAY + 8 * 3600e3;
    if (ex > Date.now() + DAY && c.srs.due > before) c.srs = { ...c.srs, due: Math.max(Date.now() + 10 * MIN, before) };
    save();
    emit('review', c, g, wasNew);
  }
  // punkty: zapamiętujemy, które elementy uciekły – przy następnej powtórce są oznaczone 🔁
  if (s.pts) { const n = noteById(c.noteId), sp = n && splitPoints(n.back);
    if (sp && s.shown) { const m = sp.pts.map((_, i) => i).filter(i => !s.pts.has(i)); if (String(m) !== String(n.ptMiss || [])) { if (m.length) n.ptMiss = m; else delete n.ptMiss; touch(n); save(); } } }
  s.pts = null;
  s.lastNote = c.noteId;
  nextCard();
  if (!s.card) setDoneReward(s);
  render();
  if (!s.card) emit('sessionEnd', s);
}
// 💎 Dowód wiedzy (poza bossami): 🔥 seria 10 wpisanych dobrze z rzędu = +5 (max 8 serii dziennie),
// 🌳 karta pierwszy raz zapamiętana na 3 tygodnie = +3 (gdy wpisana) albo +1 (przewijana) – raz na kartę
const PROOF_STREAK = 10, PROOF_STREAK_GEMS = 5, PROOF_STREAK_MAX = 8, MATURE_IVL = 21;
function proofGems(s, c, verdict, ivl0) {
  const day = dayKey(Date.now());
  if (verdict) {
    s.tStreak = verdict === 'ok' ? (s.tStreak || 0) + 1 : verdict === 'close' ? (s.tStreak || 0) : 0;
    if (s.tStreak && s.tStreak % PROOF_STREAK === 0) {
      const k = S.wallet.filter(w => w.why === 'type-streak' && dayKey(w.t) === day).length;
      if (k < PROOF_STREAK_MAX) { S.wallet.push({ id: `tstreak-${day}-${k}`, n: PROOF_STREAK_GEMS, why: 'type-streak', t: Date.now() }); toast(`🔥 ${s.tStreak} wpisanych dobrze z rzędu! +${PROOF_STREAK_GEMS} 💎`, 2500); }
    }
  }
  if (ivl0 < MATURE_IVL && (c.srs.ivl || 0) >= MATURE_IVL) {
    const id = 'mature-' + c.id;
    if (!S.wallet.some(w => w.id === id)) { const n = verdict === 'ok' || verdict === 'close' ? 3 : 1; S.wallet.push({ id, n, why: 'mature', t: Date.now() }); toast(`🌳 Karta zapamiętana na długo! +${n} 💎`, 2200); }
  }
}

// 💎 Ukończony zestaw: im więcej fiszek, tym więcej kryształów; za wpisywanie ×2. Raz dziennie na talię i tryb (żeby nie farmić).
const SET_GEM = 0.25, SET_TYPE_MUL = 2, SET_MIN = 5, SET_CAP = 120;
function setDoneReward(s) {
  if (!s?.got || s.deckId === 'all' || s.reward) return;
  const day = dayKey(Date.now()); let n = 0; const parts = [];
  for (const m of ['flip', 'type']) {
    const k = Object.keys(s.got[m]).length, id = `setdone-${s.deckId}-${day}-${m}`;
    if (k < SET_MIN || S.wallet.some(w => w.id === id)) continue;
    const g = Math.min(SET_CAP, Math.max(3, Math.round(k * SET_GEM * (m === 'type' ? SET_TYPE_MUL : 1))));
    S.wallet.push({ id, n: g, why: 'set-done', t: Date.now() }); n += g; parts.push({ m, k, g });
  }
  if (!n) return;
  s.reward = { n, parts }; save();
}
const setRewardHTML = r => r ? `<div class="set-reward"><b>+${r.n} 💎</b> za ukończony zestaw<div class="small muted">${r.parts.map(p => `${p.m === 'type' ? '✍️ wpisane' : '🃏 fiszki'}: ${p.k} ${plural(p.k, 'karta', 'karty', 'kart')}${p.m === 'type' ? ` · mnożnik ×${SET_TYPE_MUL}` : ''} → ${p.g} 💎`).join('<br>')}</div></div>`
  : '';
function undo() {
  const s = SESSION, u = s && s.undo; if (!u) return;
  const c = S.cards.find(x => x.id === u.cardId); if (!c) return;
  if (u.sus) { delete c.sus; c.srs = u.srs; touch(c); s.undo = null; s.card = c; s.shown = false; s.shownAt = Date.now(); save(); return render(); }
  c.srs = u.srs; touch(c); S.log = S.log.filter(l => l.id !== u.logId); s.done--; s.undo = null;
  s.card = c; s.shown = false; s.peek = false; s.editHint = false; s.hint = false; s.typed = null; s.verdict = null; s.shownAt = Date.now();
  save(); render();
}
// nowe karty, które dziś nie zmieściły się w dziennym limicie
const hiddenNew = deckId => deckCounts(deckId, true).nw - deckCounts(deckId).nw;
function sessionRemaining(s) {
  if (s.cram) return s.cram.length;
  if (s.only) { const eod = addDays(dayStart(), 1); return S.cards.filter(c => s.only.has(c.id) && !c.sus && (c.srs.state === 'new' || c.srs.due < eod)).length; }
  const k = deckCounts(s.deckId, s.all); return k.total;
}

// ============================================================ Router i renderowanie
let MOUNT = [], LAST_VIEW_PATH = null;
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
  { const pth = parts.join('/'); $('#view').classList.toggle('enter', pth !== LAST_VIEW_PATH); LAST_VIEW_PATH = pth; }   // animacja wejścia tylko przy zmianie ekranu
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
  const deckRow = d => {
    const k = deckCounts(d.id);
    if (d.done) return `<div class="deck deck-done">
      <div class="name" data-go="#/deck/${d.id}">${esc(d.name)}</div><span class="small done-tag">🎓 zdane</span>
      <button class="sm" data-act="deck-menu" data-id="${d.id}" title="Opcje talii">⋯</button></div>`;
    return `<div class="deck">
      <div class="name" data-go="#/deck/${d.id}">${esc(d.name)}</div>
      ${countsHTML(k)}
      <button class="sm ${k.total ? 'primary' : ''}" data-go="#/study/${d.id}/flip" ${k.total ? '' : 'disabled'}>Ucz</button>
      <button class="sm" data-act="deck-menu" data-id="${d.id}" title="Opcje talii">⋯</button>
    </div>`;
  };
  // 📁 kategorie (tematy) na liście talii: nagłówek kategorii → jej talie; reszta „bez kategorii”
  const byName = (a, b) => a.name.localeCompare(b.name, 'pl');
  const cats = typeof topicDecks === 'function' && appMode() === 'full' ? S.topics.filter(t => !t.parentId).sort(byName) : [];
  const inCat = new Set();
  const catHTML = cats.map(t => { const ds = topicDecks(t, true).sort(byName); ds.forEach(d => inCat.add(d.id)); const k = ds.reduce((a, d) => a + deckCounts(d.id).total, 0);
    return `<div class="deck-cat" data-go="#/topic/${t.id}"><span class="dc-ic">${esc(t.emoji || '📁')}</span><b class="grow">${esc(t.name)}</b><small class="muted">${ds.length} ${plural(ds.length, 'talia', 'talie', 'talii')}${(t.items || []).length ? ` · ${(t.items || []).length} ${plural((t.items || []).length, 'materiał', 'materiały', 'materiałów')}` : ''}${k ? ` · <b class="c-new">${k}</b> na dziś` : ''}</small><span>›</span></div>
      ${ds.map(d => `<div class="deck-in">${deckRow(d)}</div>`).join('')}`; }).join('');
  const rest = S.decks.filter(d => !inCat.has(d.id)).sort(byName).map(deckRow).join('');
  const decks = catHTML + (catHTML && rest ? '<div class="deck-cat plain"><span class="dc-ic">🗂️</span><b class="grow">Bez kategorii</b></div>' : '') + rest;
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
  ${(() => {   // ▶ przerwana nauka (zapamiętana sesja)
    const j = loadSess(); if (!j || !(j.done > 0 || j.cram)) return '';
    const d = j.deckId === 'all' ? 'Wszystkie talie' : deckById(j.deckId)?.name; if (!d) return '';
    const left = j.cram ? j.cram.length : null;
    return `<div class="banner row nowrap resume-banner"><span class="grow">▶ Dokończ naukę: <b>${esc(d)}</b> · zrobione ${j.done}${left != null ? `, zostało ${left}` : ''}</span><button class="sm primary" data-go="${esc(j.hash)}">Wróć</button><button class="sm ghost" data-act="sess-drop" title="Zapomnij">✕</button></div>`; })()}
  ${(() => {   // 🎓 najbliższy egzamin
    const ex = S.decks.map(d => ({ d, e: examInfo(d) })).filter(x => x.e && !x.e.past && !x.d.done).sort((a, b) => a.e.date - b.e.date)[0];
    if (!ex) return '';
    const k = deckCounts(ex.d.id);
    return `<div class="banner row nowrap exam-banner"><span class="grow">🎓 <b>${esc(ex.d.name)}</b> – egzamin ${inDays(ex.e.daysLeft)}. Dziś: ${k.nw} nowych + ${k.lrn + k.rev} powtórek</span><button class="sm primary" data-go="#/study/${ex.d.id}/flip" ${k.total ? '' : 'disabled'}>Ucz się</button></div>`; })()}
  ${(() => {   // ⭐ oznaczone – osobno dla każdej talii (zestawu)
    const per = S.decks.map(d => ({ d, n: starredCards(d.id).length })).filter(x => x.n);
    return per.length ? `<div class="banner star-banner"><span>⭐ Oznaczone fiszki – powtórz osobno:</span>
      <div class="star-decks">${per.map(x => `<button class="sm" data-act="cram-star" data-id="${x.d.id}">${esc(x.d.name)} <b>${x.n}</b></button>`).join('')}</div></div>` : ''; })()}
  ${hard ? `<div class="banner row nowrap"><span class="grow">🧠 <b>${hard}</b> ${plural(hard, 'trudna fiszka', 'trudne fiszki', 'trudnych fiszek')} – powtórz bez wpływu na harmonogram</span><button class="sm" data-act="cram-hard">Powtórz</button></div>` : ''}
  <div class="card">
    <div class="row nowrap"><h2 class="grow" style="margin:0">Talie</h2>
      <span class="small muted"><span class="c-new">nowe</span> · <span class="c-lrn">nauka</span> · <span class="c-rev">powt.</span></span></div>
    ${decks || '<p class="muted">Brak talii.</p>'}
    <div class="spacer"></div>
    <div class="row"><button data-act="new-deck">➕ Nowa talia</button>${appMode() === 'full' && typeof topicDecks === 'function' ? '<button data-act="topic-new" title="Kategoria grupuje talie i materiały (notatki, linki, filmy)">📁 Nowa kategoria</button>' : ''}<button data-go="#/add">✏️ Dodaj fiszki</button></div>
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
  const hard = cards.filter(isHardCard);
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
      ${(() => {   // gdy na dziś nic nie zostało: nowe ponad limit albo swobodna powtórka całej talii (bez wpływu na harmonogram)
        const q = k.total ? '' : hiddenNew(id) ? '?all=1' : '?cram=all', extra = k.total ? '' : `<small class="study-extra">${hiddenNew(id) ? 'nowe ponad limit' : 'bez harmonogramu'}</small>`;
        return `<button class="primary grow study-go" data-go="#/study/${id}/flip${q}" ${cards.length ? '' : 'disabled'}><span>▶ Fiszki</span>${extra}</button>
      <button class="grow study-go" data-go="#/study/${id}/type${q}" ${cards.length ? '' : 'disabled'}><span>⌨️ Wpisywanie</span>${extra}</button>`; })()}
    </div>
    ${(() => { const h = hiddenNew(id); return h ? `<div class="spacer"></div><button class="block all-new" data-go="#/study/${id}/flip?all=1">📚 Wszystkie nowe naraz (+${h})</button>` : ''; })()}
    <div class="spacer"></div>
    <div class="row">
      <button class="grow" data-go="#/quiz/${id}?type=abcd" ${cards.length ? '' : 'disabled'}>📝 ABCD</button>
      <button class="grow" data-go="#/quiz/${id}?type=type" ${cards.length ? '' : 'disabled'}>✍️ Pisemny</button>
    </div>
    <div class="spacer"></div>
    <div class="cram-grid">
      <button class="grow" data-act="cram-deck" data-id="${id}" ${cards.length ? '' : 'disabled'}>🔁 Przejrzyj całą talię</button>
      <button class="grow" data-act="cram-hard" data-id="${id}" ${hard.length ? '' : 'disabled'}>🧠 Trudne (${hard.length})</button>
      <button class="grow" data-act="cram-star" data-id="${id}" ${starredCards(id).length ? '' : 'disabled'}>⭐ Oznaczone (${starredCards(id).length})</button>
      <button class="grow" data-go="#/weak?deck=${id}">📉 Słabe punkty</button>
      <button class="grow" data-act="cram-img" data-id="${id}" ${imageCards(id).length ? '' : 'disabled'}>🖼️ Obrazy (${imageCards(id).length})</button>
    </div>
    <div class="spacer"></div>
    ${(() => { const sus = cards.filter(c => c.sus); if (!sus.length) return ''; const kn = sus.filter(c => c.sus === 'known').length;
      return `<div class="sus-box row nowrap"><span class="grow small">🙈 Poza powtórkami: <b>${sus.length}</b>${kn ? ` · ✓ nauczone ${kn}` : ''}${sus.length - kn ? ` · 🚫 niepotrzebne ${sus.length - kn}` : ''}</span><button class="sm" data-act="sus-restore" data-id="${id}">Przywróć</button></div><div class="spacer"></div>`; })()}
    <button class="block sm${d.done ? ' primary' : ''}" data-act="deck-done" data-id="${id}" data-v="${d.done ? 0 : 1}">${d.done ? '↩️ Talia zdana – przywróć do nauki' : '🎓 Opanowane – zdałem, bez powtórek'}</button><div class="spacer"></div>
    ${examCardHTML(d)}
    <button class="block deck-link-btn" data-act="deck-link" data-id="${d.id}">🔗 Udostępnij talię linkiem</button>
    ${typeof shareCardHTML === 'function' ? shareCardHTML(d) : ''}
    ${(() => { const bn = notes.filter(n => n.type === 'basic'); if (!bn.length) return ''; const m = deckDirMode(d), ex = bn.find(n => n.front && n.back) || bn[0], sh = t => esc(String(t || '').replace(/\s+/g, ' ').slice(0, 22));
      const lbl = { f: `${sh(ex.front)} → ?`, r: `${sh(ex.back)} → ?`, both: '⇄ obie strony' }[m], nxt = { f: 'odwrotnie', r: 'obie strony', both: 'tylko przód → tył' }[m];
      return `<button class="block sm dir-btn" data-act="deck-dir" data-id="${id}"><span>↔️ Kierunek: <b>${lbl}</b></span><small>${S.cards.filter(c => c.deckId === id).length} kart · stuknij → ${nxt}</small></button>`; })()}
    <button class="block sm${d.mix ? ' primary' : ''}" data-act="deck-mix" data-id="${id}">🔀 Przeplatanie: ${d.mix ? 'włączone – nowe karty w losowej kolejności' : 'wyłączone (stuknij, by mieszać terminy z obrazami)'}</button>
  </div>
  <div class="card">
    <div class="notes-head"><h2 style="margin:0">Fiszki <span class="muted">(${notes.length})</span></h2><div class="notes-head-btns">
      ${notes.length ? `<button class="sm${NOTE_SEL ? ' primary' : ''}" data-act="note-selmode">${NOTE_SEL ? 'Anuluj' : '☑️ Zaznacz'}</button>` : ''}
      ${NOTE_SEL ? '' : `<button class="sm primary" data-go="#/add?deck=${id}">➕ Dodaj</button>`}</div></div>
    ${NOTE_SEL ? `<div class="selbar row nowrap"><span class="grow small"><b>${NOTE_SEL.size}</b> zaznaczonych</span>
      <button class="sm" data-act="note-selall" data-id="${id}">${NOTE_SEL.size === notes.length ? 'Odznacz' : 'Wszystkie'}</button>
      <button class="sm" data-act="note-selsus" ${NOTE_SEL.size ? '' : 'disabled'} title="Zaznaczone fiszki znikną z powtórek, ale liczą się jako nauczone">✓ Opanowane</button>
      <button class="sm danger-fill" data-act="note-seldel" ${NOTE_SEL.size ? '' : 'disabled'}>🗑 Usuń</button></div>` : ''}
    <div class="spacer"></div>
    <input id="note-search" type="search" placeholder="Szukaj…">
    <div id="notes">${notesList(notes, '')}</div>
  </div>
  <div class="deck-foot"><button data-act="anki-export" data-deck="${id}">⬇️ Eksport do Anki</button>
    <div class="row"><button class="danger grow" data-act="reset-deck" data-id="${id}">Resetuj postęp</button>
    <button class="danger grow" data-act="delete-deck" data-id="${id}">Usuń talię</button></div></div>`;
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
// ---------- ✅ Odpowiedź w punktach: długą odpowiedź dzielimy na elementy do odhaczenia
function splitTop(t, sepRe) {   // dzieli tylko poza nawiasami
  const out = []; let depth = 0, cur = '';
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]; if ('([{'.includes(ch)) depth++; if (')]}'.includes(ch)) depth = Math.max(0, depth - 1);
    const m = depth === 0 && t.slice(i).match(sepRe);
    if (m && m.index === 0) { out.push(cur); cur = ''; i += m[0].length - 1; continue; }
    cur += ch;
  }
  out.push(cur); return out.map(x => x.trim().replace(/[.;,]+$/, '')).filter(Boolean);
}
function splitPoints(raw) {
  const txt = String(raw || '').replace(/<br\s*\/?>|<\/(p|li|div)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
  const lines = txt.split(/\n+/).map(x => x.replace(/^\s*([-–•·*]|\d+[.)])\s*/, '').trim()).filter(Boolean);
  if (lines.length >= 3 && lines.length <= 10) return { lead: '', pts: lines };
  let t = txt.replace(/\s+/g, ' ').trim(), lead = '';
  const ci = t.indexOf(':'); if (ci > 0 && ci < 140 && ci < t.length - 10) { lead = t.slice(0, ci).trim(); t = t.slice(ci + 1).trim(); }
  let pts = splitTop(t, /^;\s*/);
  if (pts.length < 3) pts = splitTop(t, /^(,\s*| oraz | a także )/);
  if (pts.length < 3 || pts.length > 10 || pts.some(x => x.length > 110)) return null;
  return { lead, pts };
}
const ptSuggest = (got, n) => got >= n ? 3 : got / n >= .5 ? 2 : 1;
// ---------- 🖼️ fiszki z obrazem (obraz z lukami, zdjęcie na fiszce albo obrazek w treści z importu)
const noteHasImage = n => !!n && (n.type === 'occl' || !!n.imageId || !!n.backImageId || /<img/i.test((n.front || '') + (n.back || '') + (n.text || '')));
const imageCards = deckId => S.cards.filter(c => (deckId === 'all' || c.deckId === deckId) && noteHasImage(noteById(c.noteId)));
// ---------- ⏱ czas nauki: czas od pokazania karty do oceny (max 60 s na kartę, więc odłożony telefon nie nabija czasu)
// zwykłe powtórki – w S.log (ms), powtórki bez harmonogramu – w S.tlog (żeby nie zawyżały liczby powtórek / ligi / kryształów)
function studyMsBetween(from, to = Infinity) {
  let ms = 0;
  for (const l of S.log) if (l.t >= from && l.t < to) ms += Math.min(60000, l.ms || 0);
  for (const l of S.tlog || []) if (l.t >= from && l.t < to) ms += Math.min(60000, l.ms || 0);
  return ms;
}
const fmtDur = ms => { const m = Math.round(ms / MIN); if (m < 1) return ms > 0 ? '<1 min' : '0 min'; const h = Math.floor(m / 60); return h ? `${h} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}` : `${m} min`; };
const fmtClock = ms => { const t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), x = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const sessLiveMs = s => (s.timeMs || 0) + (s.card ? Math.min(60000, Date.now() - (s.shownAt || Date.now())) : 0);
// fiszki oznaczone gwiazdką (⭐ = „cięższe”) – gwiazdka jest na notatce, więc dotyczy obu kierunków
const starredCards = deckId => S.cards.filter(c => (deckId === 'all' || c.deckId === deckId) && !deckPassed(c.deckId) && noteById(c.noteId)?.star);
function viewStudy(deckId, mode, q) {
  const all = q.get('all') === '1', cq = q.get('cram') || '', only = q.get('only') || '', key = `${deckId}/${mode}/${cq}${cq === 'list' ? ':' + idHash(q.get('ids') || '') : ''}${all ? '/all' : ''}${only ? '/only:' + idHash(only) : ''}`;
  if (!SESSION || SESSION.key !== key) {
    let cram = null;
    if (q.get('cram') === 'hard') cram = difficultCards().filter(c => deckId === 'all' || c.deckId === deckId).map(c => c.id);
    else if (q.get('cram') === 'all') cram = S.cards.filter(c => c.deckId === deckId).map(c => c.id);
    else if (q.get('cram') === 'star') cram = starredCards(deckId).map(c => c.id);
    else if (q.get('cram') === 'img') cram = imageCards(deckId).map(c => c.id);
    else if (q.get('cram') === 'list') cram = (q.get('ids') || '').split(',').filter(Boolean);
    if (!restoreSess(key)) { startSession(deckId, mode, cram, all, only ? only.split(',') : null); SESSION.key = key; }
  }
  const s = SESSION, c = s.card;
  onMount(saveSess);
  const name = deckId === 'all' ? 'Wszystkie talie' : (deckById(deckId)?.name || '');
  const rem = sessionRemaining(s);
  const backHash = deckId === 'all' ? '#/' : `#/deck/${deckId}`;
  const qs = location.hash.includes('?') ? '?' + location.hash.split('?')[1] : '';
  const head = `
  <div class="studybar">
    <button class="iconbtn" data-act="end-study" data-href="${backHash}">✕</button>
    <div class="title">${esc(name)}${q.get('cram') === 'star' ? ' · ⭐ oznaczone' : q.get('cram') === 'img' ? ' · 🖼️ obrazy' : s.cram ? ' · bez harmonogramu' : s.all ? ' · wszystkie nowe' : ''}</div>
    <div class="seg">
      <button class="${mode === 'flip' ? 'on' : ''}" data-act="switch-mode" data-href="#/study/${deckId}/flip${qs}">Fiszki</button>
      <button class="${mode === 'type' ? 'on' : ''}" data-act="switch-mode" data-href="#/study/${deckId}/type${qs}">Wpisz</button>
    </div>
  </div>
  ${progress(s.done / Math.max(1, s.done + rem))}
  <div class="row small muted study-meta" style="margin-top:6px"><span class="grow">Zrobione: ${s.done} · ⏱ <span id="sess-time">${fmtClock(sessLiveMs(s))}</span></span>
    ${s.cram || s.only ? `<span>Zostało: ${rem}</span>` : countsHTML(deckCounts(deckId, s.all))}
    ${s.undo ? '<button class="ghost sm" data-act="undo">↶ Cofnij</button>' : ''}</div>`;

  if (!c) {
    return head + `<div class="card flash"><div style="font-size:54px">🎉</div><h2>Gratulacje!</h2>
      <p class="muted">${s.done ? `Powtórzono ${s.done} ${plural(s.done, 'kartę', 'karty', 'kart')} w ⏱ <b>${fmtDur(s.timeMs || 0)}</b>.` : 'Na teraz nie ma nic do powtórki.'}</p>
      ${setRewardHTML(s.reward)}
      <p class="small muted">Dziś uczysz się już ${fmtDur(studyMsBetween(dayStart()))}.</p>
      <p class="muted small">${nextDueText()}</p></div>
      ${deckId !== 'all' && !s.cram && starredCards(deckId).length ? `<button class="block" data-act="cram-star" data-id="${deckId}">⭐ Powtórz oznaczone z tej talii (${starredCards(deckId).length})</button><div class="spacer"></div>` : ''}
      ${!s.cram && difficultCards().filter(c => deckId === 'all' || c.deckId === deckId).length ? `<button class="block" data-act="cram-hard" data-id="${deckId}">🧠 Powtórz trudne (${difficultCards().filter(c => deckId === 'all' || c.deckId === deckId).length})</button><div class="spacer"></div>` : ''}
      ${!s.all && !s.cram && hiddenNew(deckId) ? `<button class="primary block" data-go="#/study/${deckId}/${mode}?all=1">📚 Ucz się dalej – wszystkie nowe (${hiddenNew(deckId)})</button><div class="spacer"></div>` : ''}
      <button class="${!s.all && !s.cram && hiddenNew(deckId) ? '' : 'primary '}block" data-act="end-study" data-href="${backHash}">Gotowe</button>`;
  }

  const v = cardView(c), note = noteById(c.noteId);
  // skojarzenie: tekst i/lub obrazek (wgrany albo narysowany)
  const himg = id => id && IMG[id] ? `<img class="hint-img" src="${IMG[id]}" alt="skojarzenie">` : '';
  const hasHint = v.hints.length > 0 || !!himg(note?.hintImg);
  const canEdit = !s.editHint && S.settings.hintEdit !== false;
  const hintBox = () => `<div class="hintbox"><div class="hb-h"><span>💡 Skojarzenie</span>${canEdit ? '<button class="hb-edit" data-act="hint-edit" aria-label="Zmień skojarzenie">✏️</button>' : ''}</div>${v.hints.length ? `<div class="hb-t">${v.hints.map(fmt).join('<br>')}</div>` : ''}${himg(note?.hintImg)}</div>`;
  const editHint = s.editHint ? `<div class="hint-edit"><textarea id="hint-in" rows="2" maxlength="300" placeholder="np. „FEMORIS – FEMme na długich nogach”">${esc(s.hintDraft ?? note?.hint ?? '')}</textarea>
      ${hintImgToolsHTML(s.hintImgDraft, 'study')}
      <div class="row nowrap"><button class="primary sm grow" data-act="hint-save">💾 Zapisz skojarzenie</button><button class="sm ghost" data-act="hint-cancel">Anuluj</button></div></div>` : '';
  const addHint = canEdit ? '<button class="hint-dot add" data-act="hint-edit" aria-label="Dodaj skojarzenie" title="Dodaj skojarzenie">✏️</button>' : '';
  const hintDots = `<div class="hint-row"><button class="hint-dot" data-act="hint" aria-label="Pokaż skojarzenie" title="Pokaż skojarzenie">💡</button>${canEdit ? '<button class="hint-dot" data-act="hint-edit" aria-label="Zmień skojarzenie" title="Zmień skojarzenie">✏️</button>' : ''}</div>`;
  const hints = s.editHint ? editHint : hasHint && !s.shown
    ? (s.hint ? hintBox() : hintDots)
    : (s.shown && hasHint ? hintBox() : s.shown ? `<div class="hint-row">${addHint}</div>` : '');
  let typed = '';
  if (s.shown && s.typed !== null) {
    const cls = { ok: 'ok', close: 'close', wrong: 'bad' }[s.verdict];
    const msg = { ok: '✅ Dobrze!', close: '🟡 Prawie dobrze', wrong: '❌ Źle' }[s.verdict];
    typed = `<div class="typed">${msg}<br>Twoja odpowiedź: <span class="${cls}">${esc(s.typed || '(pusto)')}</span></div>`;
  }
  const tts = S.settings.tts && 'speechSynthesis' in window;
  if (tts && !s.spoken) { s.spoken = true; onMount(() => speak(s.shown ? stripHtml(v.a) : stripHtml(v.q))); }
  const star = `<button class="iconbtn star-btn${note?.star ? ' on' : ''}" data-act="star" title="Oznacz jako trudną (⭐)">${note?.star ? '★' : '☆'}</button>`;
  // tryb „Fiszki”: stuknięcie w kartę ją obraca (pytanie ↔ odpowiedź)
  const tap = mode === 'flip' && !s.editHint && S.settings.flipCard !== false ? ' data-act="flip-card"' : '';
  const side = s.shown && !s.peek ? v.a : v.q;
  // jak w Quizlecie: jedna karta z dwiema stronami, stuknięcie obraca ją o 180°
  const flip3d = mode === 'flip' && S.settings.flipCard !== false;
  const hintBoxH = hasHint ? hintBox() : '';
  // odpowiedź w punktach (fiszki podstawowe z długą odpowiedzią)
  const sp = S.settings.points !== false && note?.type === 'basic' && c.ord !== 'r' ? splitPoints(note.back) : null;
  if (sp && !s.pts) s.pts = new Set();
  const miss = new Set(note?.ptMiss || []);
  const ptsHTML = sp ? `<div class="pts-box">${sp.lead ? `<div class="pts-lead">${fmt(sp.lead)}:</div>` : ''}
      <div class="pts-q small muted">Odhacz, co pamiętałeś:</div>
      ${sp.pts.map((x, i) => `<button class="pt${s.pts.has(i) ? ' on' : ''}${miss.has(i) ? ' miss' : ''}" data-act="pt-toggle" data-i="${i}"><i>${s.pts.has(i) ? '✓' : ''}</i><span>${fmt(x)}</span>${miss.has(i) ? '<em title="ostatnio zapomniane">🔁</em>' : ''}</button>`).join('')}
      <div class="pts-sum small">Pamiętam <b>${s.pts.size}/${sp.pts.length}</b> → proponuję: <b>${['', 'Nie pamiętam', 'Trudne', 'Dobrze'][ptSuggest(s.pts.size, sp.pts.length)]}</b></div></div>` : '';
  const body = flip3d ? `<div class="fc3d${s.shown && !s.peek ? ' flipped' : ''}"${s.editHint ? '' : ' data-act="flip-card"'}>${star}${tts ? `<button class="ghost sm speak" data-act="speak">🔊</button>` : ''}
    <div class="fc-inner">
      <div class="card flash face front">${v.q}${hasHint ? (s.hint ? hintBoxH : hintDots) : ''}<div class="flip-tip">↻ stuknij, aby obrócić<span class="kbd-tip"> · spacja</span></div></div>
      <div class="card flash face back">${sp ? ptsHTML + (v.b.match(/<img[^>]*>/g) || []).join('') + (note.extra ? `<div class="extra">${fmt(note.extra)}</div>` : '') : v.b}${s.editHint ? editHint : hintBoxH || `<div class="hint-row">${addHint}</div>`}<div class="flip-tip">↻ stuknij – pytanie<span class="kbd-tip"> · spacja – obróć · 1–4 – ocena</span></div></div>
    </div></div>`
  : `<div class="card flash${tap ? ' tappable' : ''}${s.flipAnim ? ' flip-in' : ''}${mode === 'type' ? ' typing' : ''}"${tap}>${star}${tts ? `<button class="ghost sm speak" data-act="speak">🔊</button>` : ''}${sp && s.shown && !s.peek ? v.q + '<hr>' + ptsHTML + (v.b.match(/<img[^>]*>/g) || []).join('') + (note.extra ? `<div class="extra">${fmt(note.extra)}</div>` : '') : side}${s.peek ? '' : typed}${hints}
    ${tap ? `<div class="flip-tip">${s.shown ? (s.peek ? '↻ stuknij – odpowiedź' : '↻ stuknij – pytanie') : '↻ stuknij, aby obrócić'}</div>` : ''}</div>`;
  s.flipAnim = false;

  let bar;
  if (!s.shown) {
    if (mode === 'type' && v.ans.trim()) {
      onMount(() => { const i = $('#typein'); i.focus({ preventScroll: true }); i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); act('check'); } }); });
      bar = `<div class="type-row"><input id="typein" placeholder="Wpisz odpowiedź…" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go">
        <button class="primary type-go" data-act="check" aria-label="Sprawdź">✓</button></div><button class="ghost type-skip" data-act="show">Nie wiem – pokaż odpowiedź</button>`;
    } else bar = `<button class="primary block" data-act="${S.settings.flipCard === false ? 'show' : 'flip-card'}" style="min-height:56px">Pokaż odpowiedź</button>`;
  } else {
    const suggest = { ok: 3, close: 2, wrong: 1 }[s.verdict] || (sp ? ptSuggest(s.pts.size, sp.pts.length) : 0);
    const labels = S.settings.grade2 ? ['Nie pamiętam', '', 'Pamiętam', ''] : ['Nie pamiętam', 'Trudne', 'Dobrze', 'Łatwe'];
    const now = Date.now(), gs = S.settings.grade2 ? [1, 3] : [1, 2, 3, 4];
    bar = `<div class="grades n${gs.length}">${gs.map(g => {
      const t = s.cram ? (g === 1 ? 'jeszcze raz' : 'dalej') : human(schedule(c.srs, g, now, false).due - now);
      return `<button class="g${g}${suggest === g ? ' suggest' : ''}" data-act="grade" data-g="${g}">${labels[g - 1]}${S.settings.showIvl !== false ? `<small>${t}</small>` : ''}</button>`;
    }).join('')}</div>`;
  }
  const susBar = s.shown && !s.cram ? `<div class="sus-bar"><button class="ghost sm" data-act="card-sus" data-k="known" title="Karta znika z powtórek, ale liczy się jako nauczona">✓ Umiem – bez powtórek</button><button class="ghost sm" data-act="card-sus" data-k="skip" title="Karta znika z nauki i walk z bossami">🚫 Niepotrzebna</button></div>` : '';
  return head + body + susBar + `<div class="answerbar">${bar}</div>`;
}
// ✓ nauczone / 🚫 niepotrzebne: karta wypada z powtórek (przywrócisz ją w widoku talii)
// przywrócenie z „opanowanych”: nowe karty wracają jako nowe, reszta – na powtórkę, jeśli była odłożona na rok
function unSus(c) { if (c.preSrs) { c.srs = c.preSrs; delete c.preSrs; } else if (c.srs.due > Date.now() + 300 * DAY) c.srs = { ...c.srs, due: Date.now(), ivl: Math.min(c.srs.ivl, 30) }; }
const SUS_NAME = { known: 'nauczona – bez powtórek', skip: 'niepotrzebna' };
function suspendCard(k) {
  const s = SESSION, c = s?.card; if (!c) return;
  s.undo = { cardId: c.id, sus: true, srs: c.srs }; c.sus = k; if (k === 'known' && c.srs.state === 'new') c.srs = { ...c.srs, state: 'review', due: Date.now() + 365 * DAY, ivl: 365, reps: 1 }; touch(c); save();
  toast(k === 'known' ? '✓ Oznaczona jako nauczona – nie wróci na powtórki' : '🚫 Karta pominięta – nie wróci na naukę', 2200);
  s.lastNote = c.noteId; nextCard(); render();
}

// ------------------------------------------------------------ Test (ABCD / pisemny)
let QUIZ = null;
// ---------- podobne złe odpowiedzi do ABCD (żeby nie dało się zgadnąć „po dziale”)
// pool: [{ a, q, ctx }] – a: odpowiedź, q: pytanie, ctx: dział/dodatek (np. „1. Środowisko wodne”)
const ansKind = a => /^\s*-?\d+([.,]\d+)?\s*[%°a-ząćęłńóśźż.]{0,6}\s*$/i.test(a) ? 'num' : /^[A-ZĄĆĘŁŃÓŚŹŻ][^\s]*(\s[A-ZĄĆĘŁŃÓŚŹŻ][^\s]*)*$/.test(a.trim()) ? 'name' : 'text';
function similarity(c, x) {
  let sc = 0;
  const wa = keyWords(c.a), wb = keyWords(x.a);
  sc += 3 * wa.filter(w => wordHit(w, wb)).length;                         // wspólne słowa w odpowiedzi (kość udowa ↔ kość piszczelowa)
  const qa = keyWords(c.q || ''), qb = keyWords(x.q || '');
  sc += 1.5 * Math.min(4, qa.filter(w => wordHit(w, qb)).length);          // pytania o podobnym temacie
  if (c.ctx && x.ctx && norm(c.ctx) === norm(x.ctx)) sc += 4;               // ten sam dział / rozdział
  if (ansKind(c.a) === ansKind(x.a)) sc += 2;                              // liczba ↔ liczba, nazwa ↔ nazwa
  else if (ansKind(c.a) === 'num' || ansKind(x.a) === 'num') sc -= 4;      // liczba wśród słów od razu odpada – unikamy
  const la = c.a.length, lb = x.a.length; sc += 2 * (1 - Math.min(1, Math.abs(la - lb) / Math.max(la, lb, 1)));   // podobna długość
  const na = norm(c.a), nb = norm(x.a);
  if (na.slice(-3) === nb.slice(-3) && na.length > 4) sc += 1;              // ta sama końcówka (łacina: -us, -is…)
  if (na[0] === nb[0]) sc += .5;
  return sc;
}
// liczby: jeśli w puli brakuje podobnych, dorabiamy wiarygodne sąsiednie wartości (206 → 204, 212, 196…)
function nearNumbers(a, n) {
  const m = String(a).match(/-?\d+([.,]\d+)?/); if (!m) return [];
  const v = parseFloat(m[0].replace(',', '.')), dec = (m[1] || '').length - 1, out = new Set();
  const steps = Math.abs(v) >= 1000 && Number.isInteger(v) ? [1, 2, 3, 5, 10, -1, -2, -5, -10] : Number.isInteger(v) ? [1, 2, 3, 4, 6, -1, -2, -3, -4] : [.1, .2, .3, -.1, -.2, -.3];
  for (const st of shuffle(steps)) {
    const delta = Number.isInteger(v) && Math.abs(v) > 20 ? Math.round(st * Math.max(1, Math.abs(v) * .03)) : st;
    const nv = v + delta; if (nv === v || (v > 0 && nv < 0)) continue;
    out.add(String(a).replace(m[0], dec > 0 ? nv.toFixed(dec).replace('.', m[0].includes(',') ? ',' : '.') : String(Math.round(nv))));
    if (out.size >= n) break;
  }
  return [...out];
}
function pickDistractors(c, pool, n = 3) {
  const seen = new Set([norm(c.a)]), cand = [];
  // odrobina losowości tylko między podobnie ocenionymi – najbardziej podobne zawsze wygrywają
  for (const x of pool) { const k = norm(x.a); if (!k || seen.has(k)) continue; seen.add(k); cand.push({ x, s: similarity(c, x) + Math.random() * 1.5 }); }
  cand.sort((p, q) => q.s - p.s);
  let out = cand.slice(0, n).map(o => o.x.a);
  if (ansKind(c.a) === 'num') {   // liczby: wolimy bliskie wartości niż inne liczby z talii
    const close = nearNumbers(c.a, n).filter(v => !seen.has(norm(v)) && !out.some(o => norm(o) === norm(v)));
    out = [...close.slice(0, Math.max(0, n - out.filter(o => ansKind(o) === 'num').length)), ...out.filter(o => ansKind(o) === 'num'), ...out].filter((v, i, arr) => arr.findIndex(z => norm(z) === norm(v)) === i).slice(0, n);
  }
  return out;
}
const distractorEntry = c => { const v = cardView(c), n = noteById(c.noteId); return { a: v.ans, q: stripHtml(v.label || ''), ctx: n?.extra || '' }; };

function buildQuiz(deckId, type, count) {
  const cards = shuffle(S.cards.filter(c => (deckId === 'all' || c.deckId === deckId) && cardView(c).ans.trim()));
  const pick = cards.slice(0, count || cards.length);
  const items = pick.map(c => {
    const v = cardView(c);
    let options = null;
    if (type === 'abcd') {
      // pula: cała talia (a przy „wszystkich” – też inne talie); wybieramy najbardziej podobne odpowiedzi
      const pool = (deckId === 'all' ? cards : S.cards.filter(x => x.deckId === deckId && cardView(x).ans.trim())).filter(x => x !== c).map(distractorEntry);
      options = shuffle([v.ans, ...pickDistractors(distractorEntry(c), pool, 3)]);
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
    front: '', back: '', hint: '', hintImg: null, extra: '', reverse: false, text: '', imageId: null, boxes: [], title: '',
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
  ${hintImgToolsHTML(D.hintImg, 'draft')}
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
  ${hintImgToolsHTML(D.hintImg, 'draft')}
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
  ${hintImgToolsHTML(D.hintImg, 'draft')}
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
    fields = { type: 'basic', front: D.front.trim(), back: D.back.trim(), hint: D.hint.trim(), hintImg: D.hintImg || null, extra: D.extra.trim(), reverse: !!D.reverse, imageId: D.imageId };
  } else if (D.type === 'cloze') {
    if (!/\{\{c\d+::/.test(D.text)) return toast('Zrób przynajmniej jedną lukę');
    fields = { type: 'cloze', text: D.text.trim(), hint: D.hint.trim(), hintImg: D.hintImg || null, extra: D.extra.trim() };
  } else {
    if (!D.imageId) return toast('Najpierw wybierz obraz');
    if (!D.boxes.length) return toast('Narysuj przynajmniej jedną lukę');
    D.boxes.forEach((b, i) => { if (!b.label.trim()) b.label = `Luka ${i + 1}`; });
    fields = { type: 'occl', imageId: D.imageId, boxes: D.boxes.map(({ id, x, y, w, h, label, hint }) => ({ id, x, y, w, h, label: label.trim(), hint: (hint || '').trim() })),
      title: D.title.trim(), hideAll: !!D.hideAll, hint: D.hint.trim(), hintImg: D.hintImg || null, extra: D.extra.trim(), style: D.style };
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

// ------------------------------------------------------------ Skojarzenie jako obrazek (zdjęcie albo rysunek)
function hintImgToolsHTML(id, scope) {
  const src = id && IMG[id];
  return `<div class="hint-img-tools">${src ? `<img class="hint-img" src="${src}" alt="">` : ''}
    <div class="row nowrap"><button type="button" class="sm" data-act="hintimg-pick" data-scope="${scope}">🖼️ ${src ? 'Zmień obrazek' : 'Obrazek'}</button>
      <button type="button" class="sm" data-act="hintimg-draw" data-scope="${scope}">✏️ ${src ? 'Dorysuj' : 'Narysuj'}</button>
      ${src ? `<button type="button" class="sm ghost" data-act="hintimg-del" data-scope="${scope}">🗑️</button>` : ''}</div></div>`;
}
// zapamiętuje wpisany tekst skojarzenia, żeby nie zniknął przy odświeżeniu widoku
const keepHintText = scope => { if (scope === 'study' && $('#hint-in')) SESSION.hintDraft = $('#hint-in').value; };
const setHintImg = (scope, id) => { if (scope === 'draft') DRAFT.hintImg = id; else SESSION.hintImgDraft = id; render(); };
const hintImgOf = scope => scope === 'draft' ? DRAFT?.hintImg : SESSION?.hintImgDraft;

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
    <div class="modes three">${[['full', '🎮', 'Pełny', 'bitwy, osiągnięcia, skrzynki, ranking, gry'], ['minimal', '🧘', 'Skupienie', 'fiszki, materiały i metody – bez grywalizacji'],
      ['zen', '🎯', 'Pełne skupienie', 'tylko nauka: zero liczników, statystyk i dodatków']].map(([m, i, n, d]) =>
      `<button class="mode${appMode() === m ? ' on' : ''}" data-act="set-mode" data-m="${m}"><span>${i}</span><b>${n}</b><small>${d}</small></button>`).join('')}</div></div>`;
  // w pełnym trybie konto i profil są w zakładce „Profil”, tu zostają ustawienia
  const full = appMode() === 'full';
  return `${full ? '<div class="row nowrap"><button class="iconbtn" data-go="#/me">‹</button><h1 class="grow">Ustawienia</h1></div>' : '<h1>Ustawienia</h1>'}
  ${!full && typeof accountCardHTML === 'function' ? accountCardHTML() : ''}
  ${!full && typeof profileCardHTML === 'function' ? profileCardHTML() : ''}
  ${modeCard}
  <div id="anki">${ankiSectionHTML()}</div>
  <div class="card"><div class="row nowrap"><h2 class="grow" style="margin:0">📊 Statystyki</h2><button class="sm" data-go="#/weak">📉 Słabe punkty</button></div>
    <div class="time-kpis">${[['dziś', studyMsBetween(dayStart())], ['ten tydzień', studyMsBetween(typeof weekStart === 'function' ? weekStart() : addDays(dayStart(), -6))], ['30 dni', studyMsBetween(addDays(dayStart(), -29))], ['łącznie', studyMsBetween(0)]].map(([l, v]) => `<div><b>${fmtDur(v)}</b><small>⏱ ${l}</small></div>`).join('')}</div>
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
    <div class="spacer"></div><button class="block" data-go="#/widget">📲 Skróty i widżet na ekran początkowy</button>
    <p class="small muted">Liczba na ikonie działa po dodaniu aplikacji do ekranu początkowego (iOS 16.4+).</p>
  </div>

  <div class="card"><h2 style="margin-top:0">🎯 Nauka</h2>
    <label class="field"><span>Nowych kart dziennie (na talię)</span><input type="number" min="0" max="999" id="set-new" value="${st.newPerDay}"></label>
    <label class="field"><span>Cel dzienny (liczba powtórek)</span><input type="number" min="1" max="2000" id="set-goal" value="${st.goal}"></label>
    <label class="check"><input type="checkbox" id="set-hide" ${st.hideAll ? 'checked' : ''}> Obraz z lukami: domyślnie ukrywaj wszystkie luki</label>
    <label class="check"><input type="checkbox" data-pers="flipCard" ${st.flipCard !== false ? 'checked' : ''}> 🔄 Obracanie fiszki stuknięciem (animacja) – wyłącz, by wrócić do przycisku „Pokaż odpowiedź”</label>
    <label class="check"><input type="checkbox" data-pers="hintEdit" ${st.hintEdit !== false ? 'checked' : ''}> 💡 Przycisk „Dodaj skojarzenie” w trakcie nauki</label>
    <label class="check"><input type="checkbox" data-pers="points" ${st.points !== false ? 'checked' : ''}> ✅ Długie odpowiedzi w punktach do odhaczenia</label>
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
    for (const r of R[key] || []) {
      if (!r || typeof r !== 'object' || !okId(r.id)) continue;   // 🔒 import / synchronizacja: tylko poprawne id
      if (Array.isArray(r.boxes)) r.boxes = r.boxes.filter(b => b && okId(String(b.id)));
      const l = map.get(r.id); if (!l || (r.mod || 0) > (l.mod || 0)) map.set(r.id, r);
    }
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
  for (const key of ['games', 'wallet', 'items', 'battles', 'logins', 'tlog', 'eggs']) {
    S[key] = S[key] || []; const ids = new Set(S[key].map(x => x.id));
    for (const x of R[key] || []) if (!ids.has(x.id)) S[key].push(x);
  }
  for (const k in R.ach || {}) S.ach[k] = Math.min(R.ach[k], S.ach[k] || Infinity);
  // liczby: większa wygrywa; teksty (np. data „nagroda za tydzień odebrana”, kod polecenia): późniejsza / istniejąca
  for (const k in R.stats || {}) {
    const a = S.stats[k], b = R.stats[k];
    if (typeof a === 'number' && typeof b === 'number') S.stats[k] = Math.max(a, b);
    else if (a == null || (typeof a === 'number' && isNaN(a))) S.stats[k] = b;
    else if (typeof a === 'string' && typeof b === 'string') S.stats[k] = a > b ? a : b;
  }
  if (R.major && (R.major.mod || 0) > (S.major.mod || 0)) S.major = R.major;
  if (R.profile && typeof R.profile === 'object') {
    // wygląd (zdjęcie/emoji) ma własny czas zmiany – np. wpisanie nicku przy ponownym logowaniu nie kasuje zdjęcia z konta
    const look = p => ({ avatar: p.avatar, avatarImg: p.avatarImg || null, imgMod: p.imgMod || 0 });
    const rl = look(R.profile), ll = look(S.profile);
    const remoteLook = rl.imgMod > ll.imgMod || (!ll.imgMod && !ll.avatarImg && rl.avatarImg);
    if ((R.profile.mod || 0) > (S.profile.mod || 0)) S.profile = { ...R.profile };
    Object.assign(S.profile, remoteLook ? rl : ll);
  }
  if (R.hero && typeof R.hero === 'object' && (R.hero.mod || 0) > (S.hero?.mod || 0)) S.hero = R.hero;   // bohater (RPG): nowszy wygrywa
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
      if (m && used.has(m[1]) && !IMG[m[1]]) { const d = await gistText(files[name]); if (!okImgData(d) || !okId(m[1])) continue; IMG[m[1]] = d; await DB.set('img:' + m[1], d); }
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
  'sess-drop': () => { dropSess(); render(); },
  'end-study': el => { SESSION = null; dropSess(); go(el.dataset.href); },
  'switch-mode': el => { if (SESSION) { const [d, , c] = SESSION.key.split('/'); SESSION.key = `${d}/${el.dataset.href.split('/')[3].split('?')[0]}/${c}`; SESSION.mode = SESSION.key.split('/')[1]; } location.replace(el.dataset.href); },
  show: () => { SESSION.shown = true; SESSION.spoken = false; render(); },
  // obrót karty z animacją (pierwsze stuknięcie = odpowiedź, kolejne = podgląd pytania i z powrotem)
  'flip-card': () => {
    const s = SESSION; if (!s?.card || s.editHint) return;
    if (s.flipping && Date.now() - (s.flipT || 0) < 450) return; s.flipT = Date.now();
    const box = document.querySelector('.fc3d');
    if (box) {
      if (!s.shown) {
        // stan od razu = odwrócona (gdyby coś w tle odświeżyło ekran w trakcie obrotu, karta zostaje odwrócona);
        // po obrocie dorysowujemy przyciski ocen
        const card = s.card; s.shown = true; s.spoken = false; s.peek = false;
        box.classList.add('flipped'); s.flipping = true;
        setTimeout(() => { s.flipping = false; if (SESSION === s && s.card === card) render(); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 430);
      } else { s.peek = !s.peek; box.classList.toggle('flipped', !s.peek); }
      return;
    }
    const el = document.querySelector('.card.flash');
    const turn = () => { if (!s.shown) { s.shown = true; s.spoken = false; s.peek = false; } else s.peek = !s.peek; s.flipAnim = true; render(); };
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return turn();
    el.classList.add('flip-out'); setTimeout(turn, 160);
  },
  'card-sus': el => suspendCard(el.dataset.k),
  'sus-restore': el => { let n = 0; S.cards.forEach(c => { if (c.deckId === el.dataset.id && c.sus) { delete c.sus; delete c.doneDeck; unSus(c); touch(c); n++; } }); const d = deckById(el.dataset.id); if (d?.done) { delete d.done; touch(d); } save(); toast(`↩️ Przywrócono ${n} ${plural(n, 'kartę', 'karty', 'kart')}`); render(); },
  star: () => {
    const n = SESSION?.card && noteById(SESSION.card.noteId); if (!n) return;
    n.star = !n.star; touch(n); save(); toast(n.star ? '⭐ Oznaczono – znajdziesz ją w „Oznaczone”' : 'Usunięto gwiazdkę', 1600); render();
  },
  'hint-edit': () => { const n = SESSION?.card && noteById(SESSION.card.noteId); Object.assign(SESSION, { editHint: true, hintDraft: null, hintImgDraft: n?.hintImg || null }); render(); onMount(() => $('#hint-in')?.focus()); },
  'hint-cancel': () => { SESSION.editHint = false; SESSION.hintDraft = null; render(); },
  'hint-save': () => {
    const n = SESSION?.card && noteById(SESSION.card.noteId); if (!n) return;
    n.hint = ($('#hint-in')?.value || '').trim().slice(0, 300);
    if (SESSION.hintImgDraft) n.hintImg = SESSION.hintImgDraft; else delete n.hintImg;
    touch(n); save();
    SESSION.editHint = false; SESSION.hintDraft = null; SESSION.hint = true; toast(n.hint || n.hintImg ? '💡 Skojarzenie zapisane' : 'Usunięto skojarzenie', 1600); render();
  },
  'exam-clear': el => { const d = deckById(el.dataset.id); if (!d) return; delete d.exam; touch(d); save(); render(); },
  'pt-toggle': el => { const s = SESSION; if (!s?.pts) return; const i = +el.dataset.i; s.pts.has(i) ? s.pts.delete(i) : s.pts.add(i); render(); },
  'cram-img': el => { const d = el.dataset.id || 'all'; SESSION = null; dropSess(); go(`#/study/${d}/flip?cram=img`); },
  'cram-star': el => { const d = el.dataset.id || 'all'; SESSION = null; go(`#/study/${d}/flip?cram=star`); },
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
  // ⋯ przy talii: menu (otwórz, dodaj, zdane – opanowane, przywróć)
  'deck-menu': el => {
    const d = deckById(el.dataset.id); if (!d) return;
    document.querySelector('.dmenu-ov')?.remove();
    const ov = document.createElement('div'); ov.className = 'dmenu-ov';
    ov.innerHTML = `<div class="dmenu" role="dialog" aria-label="Opcje talii"><b class="dmenu-t">${esc(d.name)}</b>
      <button data-go="#/deck/${d.id}">📂 Otwórz talię</button><button data-go="#/add?deck=${d.id}">➕ Dodaj fiszki</button>
      ${d.done ? `<button class="primary" data-act="deck-done" data-id="${d.id}" data-v="0">↩️ Przywróć do nauki</button>`
        : `<button class="primary" data-act="deck-done" data-id="${d.id}" data-v="1">🎓 Opanowane – zdałem, bez powtórek</button>`}
      <small class="muted">${d.done ? 'Talia wróci do powtórek (zaległe karty od razu).' : 'Wszystkie fiszki znikną z powtórek, a talia przestanie się liczyć do nauki na dziś. W każdej chwili przywrócisz.'}</small>
      <button class="ghost" data-act="dmenu-close">Anuluj</button></div>`;
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-go],[data-act]')) setTimeout(() => ov.remove()); });
    document.body.append(ov);
  },
  'dmenu-close': () => document.querySelector('.dmenu-ov')?.remove(),
  'deck-done': el => {
    const d = deckById(el.dataset.id); if (!d) return; const on = el.dataset.v === '1';
    if (on && !confirm(`Oznaczyć „${d.name}” jako zdaną? Wszystkie fiszki znikną z powtórek.`)) return;
    let n = 0;
    for (const c of S.cards) if (c.deckId === d.id) {
      if (on && !c.sus) { c.sus = 'known'; c.doneDeck = 1; if (c.srs.state === 'new') c.preSrs = c.srs, c.srs = { ...c.srs, state: 'review', due: Date.now() + 365 * DAY, ivl: 365, reps: 1 }; touch(c); n++; }
      if (!on && c.doneDeck) { delete c.sus; delete c.doneDeck; unSus(c); touch(c); n++; }
    }
    if (on) d.done = Date.now(); else delete d.done; touch(d); save();
    toast(on ? `🎓 „${d.name}” zdana – ${n} ${plural(n, 'fiszka', 'fiszki', 'fiszek')} bez powtórek. Gratulacje!` : `↩️ „${d.name}” wraca do nauki`, 3000); if (on) confetti(120); render();
  },
  'deck-mix': el => { const d = deckById(el.dataset.id); if (!d) return; d.mix = !d.mix; touch(d); save(); render(); toast(d.mix ? '🔀 Nowe karty będą się przeplatać losowo' : 'Nowe karty w kolejności dodania'); },
  'hintimg-pick': async el => {
    const sc = el.dataset.scope; keepHintText(sc);
    const f = await pickFile('image/*'); if (!f) return;
    try { setHintImg(sc, await putImage(await compressImage(f, 900))); } catch (e) { toast(e.message || 'Nie udało się wczytać obrazu'); }
  },
  'hintimg-draw': async el => {
    const sc = el.dataset.scope; keepHintText(sc);
    const url = await openDrawPad(IMG[hintImgOf(sc)] || null); if (!url) return;
    setHintImg(sc, await putImage(url));
  },
  'hintimg-del': el => { keepHintText(el.dataset.scope); setHintImg(el.dataset.scope, null); },
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
      for (const [id, d] of Object.entries(j.images || {})) { if (!okId(id) || !okImgData(d)) continue; IMG[id] = d; await DB.set('img:' + id, d); }
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
  if (el.dataset.exam) { const d = deckById(el.dataset.exam); if (d && el.value) { d.exam = el.value; touch(d); save(); toast('🎓 Plan nauki do egzaminu gotowy'); render(); } return; }
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
  if ((e.key === ' ' || e.key === 'Enter') && !SESSION.shown) { e.preventDefault(); act(parseRoute().parts[2] === 'type' || S.settings.flipCard === false ? 'show' : 'flip-card'); }
  else if (e.key === 's') act('star');
  else if (SESSION.shown && /^[1-4]$/.test(e.key)) answer(+e.key);
  // karta 3D (jak w Quizlecie): spacja / strzałki obracają kartę tam i z powrotem, oceny pod 1–4
  else if (SESSION.shown && document.querySelector('.fc3d') && [' ', 'ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); act('flip-card'); }
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

// ↔️ kierunek całej talii jednym przyciskiem: przód → tył · tył → przód · obie strony (postęp kart, które zostają, się nie zmienia)
const deckDirMode = d => { const ns = S.notes.filter(n => n.deckId === d.id && n.type === 'basic'); return ns.length && ns.every(n => n.revOnly) ? 'r' : ns.length && ns.every(n => n.reverse && !n.revOnly) ? 'both' : 'f'; };
function deckDir(d) {
  const cur = deckDirMode(d), next = { f: 'r', r: 'both', both: 'f' }[cur], ns = S.notes.filter(n => n.deckId === d.id && n.type === 'basic');
  const lose = S.cards.filter(c => c.deckId === d.id && c.srs.state !== 'new' && (next === 'f' ? c.ord === 'r' : next === 'r' ? c.ord === 'f' : false)).length;
  if (lose && !confirm(`Zmienić kierunek? ${lose} ${plural(lose, 'karta ma', 'karty mają', 'kart ma')} już postęp, który przepadnie (fiszki zostają).`)) return;
  for (const n of ns) { n.reverse = next !== 'f'; n.revOnly = next === 'r'; if (!n.revOnly) delete n.revOnly; touch(n); syncCards(n); }
  save(); toast(`↔️ ${{ f: 'Przód → tył', r: 'Tył → przód', both: 'Obie strony' }[next]} · ${S.cards.filter(c => c.deckId === d.id).length} kart`, 3000); render();
}
Object.assign(ACTIONS, {
  'deck-dir': el => { const d = deckById(el.dataset.id); if (d) deckDir(d); },
  'note-del': el => { deleteNotes([el.dataset.id]); render(); },
  'note-selmode': () => { NOTE_SEL = NOTE_SEL ? null : new Set(); render(); },
  'note-sel': el => { const id = el.dataset.id; NOTE_SEL.has(id) ? NOTE_SEL.delete(id) : NOTE_SEL.add(id); render(); },
  'note-selall': el => { const ids = S.notes.filter(n => n.deckId === el.dataset.id).map(n => n.id); NOTE_SEL = NOTE_SEL.size === ids.length ? new Set() : new Set(ids); render(); },
  'note-selsus': () => {
    const ids = NOTE_SEL; let n = 0;
    S.cards.forEach(c => { if (ids.has(c.noteId) && !c.sus) { c.sus = 'known'; if (c.srs.state === 'new') c.preSrs = c.srs, c.srs = { ...c.srs, state: 'review', due: Date.now() + 365 * DAY, ivl: 365, reps: 1 }; touch(c); n++; } });
    NOTE_SEL = null; save(); toast(`✓ ${n} ${plural(n, 'karta opanowana', 'karty opanowane', 'kart opanowanych')} – bez powtórek. Przywrócisz je w tej talii.`, 3500); render();
  },
  'note-seldel': () => {
    const ids = [...NOTE_SEL]; if (!ids.length) return;
    if (ids.length > 1 && !confirm(`Usunąć ${ids.length} ${plural(ids.length, 'fiszkę', 'fiszki', 'fiszek')}? (Możesz cofnąć albo przywrócić z kosza.)`)) return;
    NOTE_SEL = null; deleteNotes(ids); render();
  },
});
window.addEventListener('hashchange', () => { NOTE_SEL = null; });

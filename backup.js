'use strict';
/* Bezpieczeństwo danych:
   - codzienne kopie lokalne (ostatnie 14 dni) + kopia przed każdą ryzykowną operacją,
   - kosz: usunięte fiszki i talie można przywrócić przez 30 dni,
   - historia wersji w chmurze (każda synchronizacja z GitHub to osobna wersja),
   - pamięć trwała przeglądarki i przypomnienie, gdy dane nie są nigdzie zabezpieczone. */

const KEEP_SNAPSHOTS = 14, TRASH_DAYS = 30;
let SNAP_INDEX = [], TRASH = [], persisted = null;

async function snapshot(reason = 'codzienna') {
  const id = 'snap:' + Date.now();
  await DB.set(id, JSON.stringify({ ...S, settings: { ...S.settings, sync: { ...S.settings.sync, token: '' }, aiKey: '' } }));
  SNAP_INDEX.push({ id, t: Date.now(), reason, cards: S.cards.length, notes: S.notes.length });
  SNAP_INDEX.sort((a, b) => a.t - b.t);
  // zostaw jedną kopię na dzień przez 14 dni + ostatnie 5 kopii „przed operacją”
  const keep = new Set(); const byDay = {};
  for (const s of SNAP_INDEX) if (s.reason === 'codzienna') byDay[dayKey(s.t)] = s.id;
  Object.keys(byDay).sort().slice(-KEEP_SNAPSHOTS).forEach(d => keep.add(byDay[d]));
  SNAP_INDEX.filter(s => s.reason !== 'codzienna').slice(-5).forEach(s => keep.add(s.id));
  for (const s of SNAP_INDEX) if (!keep.has(s.id)) await DB.del(s.id);
  SNAP_INDEX = SNAP_INDEX.filter(s => keep.has(s.id));
  await DB.set('snapIndex', SNAP_INDEX);
}
on('start', async () => {
  SNAP_INDEX = (await DB.get('snapIndex')) || [];
  TRASH = ((await DB.get('trash')) || []).filter(x => Date.now() - x.t < TRASH_DAYS * DAY);
  const last = SNAP_INDEX.filter(s => s.reason === 'codzienna').pop();
  if (!last || dayKey(last.t) !== dayKey(Date.now())) snapshot('codzienna');
  try { persisted = await navigator.storage?.persisted?.(); if (!persisted) persisted = await navigator.storage?.persist?.(); } catch { /* */ }
});

// --- kosz: zapis kopii przed usunięciem
on('deleting', (kind, data) => {
  TRASH.push({ id: uid(), t: Date.now(), kind, data: structuredClone(data) });
  DB.set('trash', TRASH);
});
function restoreTrash(entry) {
  if (entry.kind === 'deck') {
    let d = S.decks.find(x => x.name === entry.data.deck.name);
    if (!d) d = newDeck(entry.data.deck.name);
    for (const n of entry.data.notes) restoreNote(n.note, n.cards, d.id);
  } else restoreNote(entry.data.note, entry.data.cards);
  TRASH = TRASH.filter(x => x !== entry); DB.set('trash', TRASH); save();
}
// przywracamy z nowymi identyfikatorami (stare są oznaczone jako usunięte także na innych urządzeniach)
function restoreNote(note, cards, deckId) {
  const did = deckId || (deckById(note.deckId) ? note.deckId : (S.decks.find(x => x.name === 'Przywrócone') || newDeck('Przywrócone')).id);
  const nn = touch({ ...structuredClone(note), id: uid(), deckId: did });
  S.notes.push(nn);
  for (const c of cards) S.cards.push(touch({ ...structuredClone(c), id: uid(), noteId: nn.id, deckId: did }));
  syncCards(nn);
}
const trashLabel = e => e.kind === 'deck' ? `📦 Talia „${e.data.deck.name}” (${e.data.notes.length} fiszek)`
  : `🃏 ${e.data.note.type === 'cloze' ? clozePlain(e.data.note.text) : e.data.note.type === 'occl' ? (e.data.note.title || 'Obraz z lukami') : e.data.note.front}`;

function safetyStatus() {
  const cloud = !!S.settings.sync.token && S.settings.lastSync && Date.now() - S.settings.lastSync < 7 * DAY;
  const exported = S.settings.lastExport && Date.now() - S.settings.lastExport < 14 * DAY;
  return { cloud, exported, safe: cloud || exported };
}
function safetyBannerHTML() {
  if (S.cards.length < 15 || safetyStatus().safe) return '';
  if (S.settings.safetySnooze && Date.now() - S.settings.safetySnooze < 3 * DAY) return '';
  return `<div class="banner warn row nowrap"><span class="grow">🛡️ <b>Zabezpiecz swoje fiszki</b> – są tylko na tym urządzeniu. Włącz synchronizację z chmurą albo pobierz kopię.</span>
    <button class="sm primary" data-go="#/safety">Zabezpiecz</button><button class="sm ghost" data-act="safety-snooze">✕</button></div>`;
}

ROUTES.safety = () => {
  const st = safetyStatus();
  const snaps = SNAP_INDEX.slice().reverse();
  const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (S.settings.sync.token && S.settings.sync.gistId && !CLOUD_VERS.loaded) loadCloudVersions();
  return { tab: 'more', html: `
  <div class="row nowrap"><button class="iconbtn" data-go="#/more">‹</button><h1 class="grow">Bezpieczeństwo danych</h1></div>
  <div class="card">
    <div class="kv"><span>☁️ Kopia w chmurze (GitHub)</span><b class="${st.cloud ? 'c-rev' : 'c-lrn'}">${S.settings.sync.token ? (st.cloud ? '✓ ' + ago(S.settings.lastSync) : '⚠️ dawno') : '✗ wyłączona'}</b></div>
    <div class="kv"><span>📁 Kopia w pliku</span><b>${S.settings.lastExport ? ago(S.settings.lastExport) : 'nigdy'}</b></div>
    <div class="kv"><span>💾 Kopie lokalne</span><b>${SNAP_INDEX.length}</b></div>
    <div class="kv"><span>🗑️ Kosz</span><b>${TRASH.length}</b></div>
    <div class="kv"><span>🔒 Pamięć trwała</span><b>${persisted ? '✓ włączona' : isStandalone ? '✓ aplikacja' : '⚠️ dodaj do ekranu głównego'}</b></div>
  </div>
  <div class="card small"><b>Jak nie stracić fiszek?</b><ol class="steps">
    <li><b>Dodaj aplikację do ekranu początkowego</b> – Safari może czyścić dane stron nieużywanych przez 7 dni, ale nie robi tego zainstalowanym aplikacjom.</li>
    <li><b>Włącz synchronizację z GitHub</b> (Więcej → Telefon ⇄ komputer) – fiszki są wtedy w Twojej prywatnej chmurze, a każda synchronizacja to wersja, do której możesz wrócić.</li>
    <li>Od czasu do czasu <b>pobierz kopię do pliku</b> (np. do iCloud Drive).</li></ol>
    <div class="row"><button class="primary grow" data-act="export">⬇️ Pobierz kopię teraz</button>${S.settings.sync.token ? '<button class="grow" data-act="sync">🔄 Synchronizuj</button>' : '<button class="grow" data-go="#/more">☁️ Włącz chmurę</button>'}</div></div>
  <div class="card"><h2 style="margin-top:0">🗑️ Kosz</h2><p class="small muted">Usunięte fiszki i talie z ostatnich ${TRASH_DAYS} dni.</p>
    ${TRASH.slice().reverse().map(e => `<div class="kv"><span class="grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(trashLabel(e))}<br><small class="muted">${ago(e.t)}</small></span>
      <button class="sm" data-act="trash-restore" data-id="${e.id}">↺ Przywróć</button></div>`).join('') || '<p class="muted small">Kosz jest pusty.</p>'}</div>
  <div class="card"><h2 style="margin-top:0">💾 Kopie na tym urządzeniu</h2><p class="small muted">Robione automatycznie codziennie i przed ryzykownymi operacjami.</p>
    ${snaps.map(s => `<div class="kv"><span>${new Date(s.t).toLocaleString('pl', { dateStyle: 'medium', timeStyle: 'short' })}<br><small class="muted">${esc(s.reason)} · ${s.cards} kart</small></span>
      <button class="sm" data-act="snap-restore" data-id="${s.id}">↺ Przywróć</button></div>`).join('') || '<p class="muted small">Brak kopii.</p>'}
    <button class="sm block" data-act="snap-now">➕ Zrób kopię teraz</button></div>
  ${S.settings.sync.gistId ? `<div class="card"><h2 style="margin-top:0">☁️ Wersje w chmurze</h2>
    ${CLOUD_VERS.list.map(v => `<div class="kv"><span>${new Date(v.t).toLocaleString('pl', { dateStyle: 'medium', timeStyle: 'short' })}</span><button class="sm" data-act="cloud-restore" data-v="${v.v}">↺ Przywróć</button></div>`).join('') || `<p class="muted small">${CLOUD_VERS.loading ? 'Wczytuję…' : 'Brak wersji.'}</p>`}</div>` : ''}` };
};
const CLOUD_VERS = { list: [], loaded: false, loading: false };
async function loadCloudVersions() {
  CLOUD_VERS.loaded = true; CLOUD_VERS.loading = true;
  try {
    const g = await gh('/gists/' + S.settings.sync.gistId);
    CLOUD_VERS.list = (g.history || []).slice(0, 20).map(h => ({ v: h.version, t: new Date(h.committed_at).getTime() }));
  } catch (e) { toast('Nie udało się wczytać wersji: ' + e.message); }
  CLOUD_VERS.loading = false; if (parseRoute().parts[0] === 'safety') render();
}
async function replaceState(data, label) {
  await snapshot('przed przywróceniem');
  const keepSettings = S.settings;
  S = { ...blankState(), ...data, settings: keepSettings };
  for (const [k, v] of Object.entries(extraState())) if (S[k] == null) S[k] = v;
  // przywrócone dane muszą „wygrać” z synchronizacją – oznaczamy je jako najnowsze
  const now = Date.now();
  for (const key of ['decks', 'notes', 'cards', 'palaces', 'topics', 'friends']) (S[key] || []).forEach(x => { x.mod = now; delete S.tomb[x.id]; });
  await DB.set('state', S); toast(`Przywrócono: ${label} ✓`, 3500); go('#/'); render();
}

Object.assign(ACTIONS, {
  'safety-snooze': () => { S.settings.safetySnooze = Date.now(); save(); render(); },
  'trash-restore': el => { const e = TRASH.find(x => x.id === el.dataset.id); if (e) { restoreTrash(e); toast('Przywrócono ✓'); render(); } },
  'snap-now': async () => { await snapshot('ręczna'); toast('Kopia zapisana ✓'); render(); },
  'snap-restore': async el => {
    const s = SNAP_INDEX.find(x => x.id === el.dataset.id); if (!s) return;
    if (!confirm(`Przywrócić stan z ${new Date(s.t).toLocaleString('pl')}? Obecny stan zostanie zapisany jako kopia.`)) return;
    const raw = await DB.get(s.id); if (!raw) return toast('Kopia niedostępna');
    replaceState(JSON.parse(raw), 'kopia lokalna');
  },
  'cloud-restore': async el => {
    if (!confirm('Przywrócić tę wersję z chmury? Obecny stan zostanie zapisany jako kopia lokalna.')) return;
    try {
      const g = await gh(`/gists/${S.settings.sync.gistId}/${el.dataset.v}`);
      const f = g.files['data.json']; if (!f) throw new Error('brak danych w tej wersji');
      replaceState(JSON.parse(await gistText(f)), 'wersja z chmury');
    } catch (e) { toast('Błąd: ' + e.message, 4000); }
  },
});

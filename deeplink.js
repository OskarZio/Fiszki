'use strict';
/* 🔗 deeplink.js – talia z linku dla osoby bez konta: link zapamiętujemy (urządzenie + konto przy rejestracji), pokazujemy ekran
   „Załóż konto / Zaloguj” z informacją o talii, a po zalogowaniu talia sama dodaje się do zestawów i otwiera.
   Działa też, gdy mail z potwierdzeniem otworzy się w innej przeglądarce (talia zapisana w danych konta). */
const PEND_KEY = 'pendingDeck';
const pendGet = () => { try { return JSON.parse(localStorage.getItem(PEND_KEY) || 'null'); } catch { return null; } };
const pendSet = p => { try { p ? localStorage.setItem(PEND_KEY, JSON.stringify(p)) : localStorage.removeItem(PEND_KEY); } catch { /* */ } };
const pendKey = p => p ? (p.t ? 't:' + p.t : p.f ? 'f:' + p.f : p.d ? 'd:' + p.d.length + p.d.slice(-16) : '') : '';
// konto potrzebne? (jest baza, brak zalogowanego, nie offline)
const needLogin = () => typeof SB !== 'undefined' && !!SB && !SB_USER && !(typeof SESS_NET_FAIL !== 'undefined' && SESS_NET_FAIL);
// czekamy, aż wystartuje połączenie z bazą (konfiguracja ładuje się chwilę po starcie)
const sbReady = async () => { for (let i = 0; i < 60 && (typeof SB === 'undefined' || !SB); i++) await new Promise(r => setTimeout(r, 200)); };

async function pendText(p) {
  if (p.t) { const r = await SB.rpc('get_deck_link', { p_id: p.t }); if (r.error || !r.data) throw new Error('brak'); return packUnzip(r.data); }
  if (p.d) return packUnzip(p.d);
  if (p.f) { const r = await fetch(p.f + '?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw new Error('brak'); return r.text(); }
  return '';
}
// zapamiętaj link i pokaż, co czeka (nazwa talii + liczba fiszek)
async function pendRemember(p) {
  const old = pendGet(); if (pendKey(old) === pendKey(p) && old.name) return;
  pendSet(p); authGate();
  try { const P = parsePack(await pendText(p)); pendSet({ ...p, name: P.deck || 'Talia', n: P.items.length }); authGate(); } catch { /* nazwa nieznana – i tak zadziała */ }
}
let PEND_BUSY = false;
// po zalogowaniu (i pierwszej synchronizacji): dodaj talię z linku (z urządzenia albo z danych konta)
async function pendProcess() {
  if (PEND_BUSY) return; const meta = SB_USER?.user_metadata?.pending_deck;
  const p = pendGet() || (meta && typeof meta === 'object' ? meta : null); if (!p) return;
  const k = pendKey(p), done = S.stats.linksDone || []; PEND_BUSY = true;
  const clear = () => { pendSet(null); if (meta) SB.auth.updateUser({ data: { pending_deck: null } }).catch(() => {}); };
  try {
    if (done.includes(k)) return clear();
    const t = await pendText(p), P = parsePack(t);
    if (!P.items.length) return clear();
    importPack(P); S.stats.linksDone = [...done, k].slice(-50); save(); clear();
    const d = S.decks.find(x => x.name.trim().toLowerCase() === (P.deck || 'Nowa talia').toLowerCase());
    if (d) { celebrate(`📚 Masz talię „${d.name}”!`, `${S.notes.filter(n => n.deckId === d.id).length} fiszek dodanych do Twoich zestawów`); location.replace(location.pathname + '#/deck/' + d.id); }
  } catch { toast('Nie udało się pobrać udostępnionej talii – otwórz link jeszcze raz', 5000); }
  finally { PEND_BUSY = false; }
}
// linki: krótki #/t/ID, długi #/import?d=…, pakiet #/import?f=…
const shareT0 = ROUTES.t, shareImp0 = ROUTES.import;
const PEND_HTML = '<div class="card center" style="padding:40px 16px"><div style="font-size:44px">📚</div><h2>Talia czeka na Ciebie</h2><p class="muted small">Załóż konto albo zaloguj się – talia od razu doda się do Twoich fiszek.</p></div>';
let SHARE_WAITED = false;
// wspólna obsługa: baza się łączy → czekamy; brak konta → zapamiętaj i pokaż ekran konta; zalogowany → zwykły import
function shareRoute(p, orig) {
  if ((typeof SB === 'undefined' || !SB) && !SHARE_WAITED) { sbReady().then(() => { SHARE_WAITED = true; render(); }); return { tab: 'home', html: PEND_HTML.replace('Talia czeka na Ciebie', 'Otwieram talię…') }; }
  if (needLogin()) { pendRemember(p); return { tab: 'home', html: PEND_HTML }; }
  return orig();
}
ROUTES.t = (parts, q) => {
  const id = (parts[1] || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 8);
  return id ? shareRoute({ t: id }, () => shareT0(parts, q)) : shareT0(parts, q);
};
ROUTES.import = (parts, q) => {
  const d = q.get('d') || '', f = q.get('f') || '';
  return d || /^assets\/imports\/[\w.-]+\.txt$/.test(f) ? shareRoute(d ? { d } : { f }, () => shareImp0(parts, q)) : shareImp0(parts, q);
};
// gdy ktoś zaloguje się później: dodaj czekającą talię po synchronizacji
const shareSync0 = cloudSync;
cloudSync = async function (...a) { const r = await shareSync0.apply(this, a); if (cloudOn() && (pendGet() || SB_USER?.user_metadata?.pending_deck)) setTimeout(pendProcess, 300); return r; };

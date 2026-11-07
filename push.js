'use strict';
/* 🔔 Przypomnienia o nauce (powiadomienia push, jak w aplikacjach do nauki języków): wybierasz godzinę, a jeśli tego dnia
   jeszcze się nie uczyłeś, telefon dostaje powiadomienie – nawet gdy aplikacja jest zamknięta.
   Subskrypcja (adres przeglądarki do powiadomień) trafia do tabeli push_subs; wysyła je co godzinę funkcja serwera
   supabase/functions/reminders (klucz prywatny VAPID jest tylko w sekretach Supabase). iPhone: działa po dodaniu aplikacji
   do ekranu początkowego (iOS 16.4+). */
const PUSH_VAPID = 'BL86moOlxbzfbM8uTWhxDDGjINtHnjilrUBci4Y5GgfEljd3uSr0v1HUHhPuptkVDiDvUEYE5eeyWN_UDpt6th4';
const pushOk = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const pushStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const pushIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const u8key = b => { const p = '='.repeat((4 - b.length % 4) % 4), s = atob((b + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, c => c.charCodeAt(0)); };
let PUSH_ST = { on: false, busy: false };
async function pushState() {
  if (!pushOk()) return; try { const r = await navigator.serviceWorker.ready, sub = await r.pushManager.getSubscription(); PUSH_ST.on = !!sub && Notification.permission === 'granted'; } catch { /* */ }
}
async function pushEnable() {
  if (!pushOk()) return toast(pushIOS() && !pushStandalone() ? 'Na iPhonie najpierw dodaj aplikację do ekranu początkowego (Udostępnij → Do ekranu początkowego), potem włącz przypomnienia tam' : 'Ta przeglądarka nie obsługuje powiadomień', 6000);
  if (!cloudOn()) return toast('Zaloguj się, żeby włączyć przypomnienia');
  PUSH_ST.busy = true; render();
  try {
    const perm = await Notification.requestPermission(); if (perm !== 'granted') throw new Error('Nie zezwolono na powiadomienia – zmień to w ustawieniach telefonu');
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8key(PUSH_VAPID) });
    const j = sub.toJSON(), hh = +(S.settings.pushHour ?? 18);
    const r = await SB.from('push_subs').upsert({ endpoint: j.endpoint, user_id: SB_USER.id, p256dh: j.keys.p256dh, auth: j.keys.auth, hour: hh, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Warsaw', updated_at: new Date().toISOString() }, { onConflict: 'endpoint' });
    if (r.error) throw new Error(/relation|does not exist|schema cache/i.test(r.error.message) ? 'Wgraj nowy supabase.sql (tabela push_subs)' : r.error.message);
    S.settings.pushOn = true; save(); PUSH_ST.on = true; toast(`🔔 Przypomnienia włączone – codziennie o ${hh}:00, jeśli jeszcze się nie uczyłeś`, 4500);
  } catch (e) { toast(e.message || String(e), 6000); }
  PUSH_ST.busy = false; render();
}
async function pushDisable() {
  try { const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    if (sub) { if (cloudOn()) await SB.from('push_subs').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); } } catch { /* */ }
  S.settings.pushOn = false; save(); PUSH_ST.on = false; toast('🔕 Przypomnienia wyłączone'); render();
}
async function pushHour(h) {
  S.settings.pushHour = h; save();
  try { const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription(); if (sub && cloudOn()) await SB.from('push_subs').update({ hour: h }).eq('endpoint', sub.endpoint); } catch { /* */ }
  toast(`🔔 Przypomnienie o ${h}:00`, 2000);
}
function pushCardHTML() {
  const h = +(S.settings.pushHour ?? 18), on = PUSH_ST.on;
  return `<div class="card push-card"><h2 style="margin-top:0">🔔 Przypomnienia o nauce</h2>
    <p class="small muted" style="margin:0 0 10px">Codziennie o wybranej godzinie – tylko gdy tego dnia jeszcze się nie uczyłeś. Przypomina też o serii dni i czekających powtórkach.</p>
    <label class="field"><span>Godzina</span><select data-push-hour="1">${Array.from({ length: 16 }, (_, i) => i + 7).map(x => `<option value="${x}" ${x === h ? 'selected' : ''}>${x}:00</option>`).join('')}</select></label>
    ${on ? '<button class="block" data-act="push-off">🔕 Wyłącz przypomnienia</button>' : `<button class="primary block" data-act="push-on" ${PUSH_ST.busy ? 'disabled' : ''}>🔔 Włącz przypomnienia</button>`}
    ${pushIOS() && !pushStandalone() ? '<p class="small muted" style="margin:8px 0 0">📱 iPhone: powiadomienia działają, gdy aplikacja jest dodana do ekranu początkowego (Udostępnij → Do ekranu początkowego).</p>' : ''}</div>`;
}
Object.assign(ACTIONS, { 'push-on': () => pushEnable(), 'push-off': () => pushDisable() });
document.addEventListener('change', e => { if (e.target.dataset?.pushHour) pushHour(+e.target.value); });
on('start', () => setTimeout(() => pushState().then(() => { if (parseRoute().parts[0] === 'more') render(); }), 1500));
// karta w Ustawieniach – na górze sekcji „Przypomnienia”
const pushViewMore0 = viewMore;
viewMore = function (...a) { const h = pushViewMore0(...a), i = h.indexOf('<div class="card"><h2 style="margin-top:0">⏰ Przypomnienia</h2>'); return i < 0 ? h + pushCardHTML() : h.slice(0, i) + pushCardHTML() + h.slice(i); };

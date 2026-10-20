'use strict';
/* 🎁 Zaproś znajomego: link z Twoim kodem (…?ref=KOD). Kto założy konto z tego linku:
   - automatycznie zostaje Twoim znajomym (ranking, czat, bitwy),
   - dostaje 100 💎 + darmową Skrzynkę nauki,
   - wysyła Ci wiadomość „dołączyłem z polecenia” – po jej odebraniu Ty też dostajesz 100 💎 + skrzynkę.
   Nagrody mają stałe id (synchronizacja ich nie dubluje). Polecający: max REF_MAX nagród; zaproszony: tylko nowe konto (do 3 dni). */

const REF_GEMS = 100, REF_CASE = 'basic', REF_CASE_ACC = 'Skrzynkę nauki', REF_MAX = 10, REF_NEW_DAYS = 3;
const refLink = () => SB_PROFILE?.code ? `${location.origin}${location.pathname}?ref=${SB_PROFILE.code}` : '';
const refRewards = () => S.wallet.filter(w => /^ref-out-/.test(w.id)).length;

// kod z linku zapamiętujemy do czasu założenia konta
(function catchRef() {
  try {
    const code = (new URLSearchParams(location.search).get('ref') || '').trim().toUpperCase();
    if (/^[A-Z0-9]{4,40}$/.test(code)) {
      localStorage.setItem('refCode', code);
      history.replaceState(null, '', location.pathname + location.hash);   // czysty adres (bez ?ref)
    }
  } catch { /* */ }
})();
const pendingRef = () => { try { return localStorage.getItem('refCode') || ''; } catch { return ''; } };
const dropRef = () => { try { localStorage.removeItem('refCode'); } catch { /* */ } };

// zaproszony: po zalogowaniu na nowe konto – znajomy + nagroda + wiadomość do polecającego
let refBusy = false;
async function refTryJoin() {
  const code = pendingRef();
  if (!code || refBusy || !cloudOn() || !SB_PROFILE?.code) return;
  if (S.stats.refJoined || code === SB_PROFILE.code) return dropRef();
  const born = Date.parse(SB_USER?.created_at || '') || Date.now();
  if (Date.now() - born > REF_NEW_DAYS * DAY) { dropRef(); return toast('Link polecający działa tylko dla nowych kont – możesz dodać znajomego kodem w rankingu', 5000); }
  refBusy = true;
  try {
    const host = await findProfileByCode(code);
    if (!host) { dropRef(); return; }
    if (!CLOUD_FRIENDS.some(f => f.id === host.id)) {
      const r = await addFriendByCode(code, host.id);
      if (r.error && !/duplicate|unique/i.test(r.error.message)) return console.warn(r.error);
    }
    S.stats.refJoined = code;
    if (!S.wallet.some(w => w.id === 'ref-in')) S.wallet.push({ id: 'ref-in', n: REF_GEMS, why: 'referral', t: Date.now() });
    addItem('case', REF_CASE, 1, 'ref-in-case');
    save(); dropRef();
    if (typeof sendMsg === 'function') await sendMsg(host.id, 'text', { text: '👋 Dołączyłem/am do Fiszek z Twojego zaproszenia!', ref: 1 });
    await loadCloudFriends();
    celebrate(`🎉 Witaj! +${REF_GEMS} 💎 i darmowa skrzynka`, `${host.nick || 'Znajomy'} jest już w Twoim rankingu`);
    confetti(120); render();
  } catch (e) { console.warn(e); } finally { refBusy = false; }
}
const refPub0 = publishCloudProfile;
publishCloudProfile = async (...a) => { const r = await refPub0(...a); setTimeout(refTryJoin, 300); return r; };

// polecający: wiadomości „ref” od znajomych = nagroda (raz za osobę, max REF_MAX)
function refScan() {
  if (typeof MSGS === 'undefined' || !cloudOn()) return;
  const me = myId();
  for (const m of MSGS) {
    if (m.to_id !== me || !m.body?.ref || m.from_id === me) continue;
    const id = 'ref-out-' + m.from_id;
    if (S.wallet.some(w => w.id === id) || refRewards() >= REF_MAX) continue;
    S.wallet.push({ id, n: REF_GEMS, why: 'referral', t: Date.now() });
    addItem('case', REF_CASE, 1, 'ref-case-' + m.from_id);
    S.stats.refCount = refRewards(); save();
    const who = typeof friendName === 'function' ? friendName(m.from_id) : 'Znajomy';
    setTimeout(() => { celebrate(`🎉 ${who} dołącza z Twojego polecenia!`, `+${REF_GEMS} 💎 i darmowa ${CASES[REF_CASE].icon} skrzynka`); confetti(120); }, 600);
  }
}
const refHandle0 = handleMsgs;
handleMsgs = (...a) => { const r = refHandle0(...a); refScan(); return r; };

// ---------- karta „Zaproś znajomego”
function inviteCardHTML() {
  const n = refRewards();
  const body = !cloudOn()
    ? `<p class="small muted">Załóż konto (Profil → Ja), żeby dostać swój link polecający.</p><button class="block" data-go="#/me">Załóż konto / zaloguj</button>`
    : `<div class="row nowrap"><button class="primary grow" data-act="ref-share">📤 Wyślij zaproszenie</button><button data-act="ref-copy">📋 Kopiuj link</button></div>
       <p class="small muted" style="margin:8px 0 0">Nagrodzone polecenia: <b>${n}/${REF_MAX}</b>${S.stats.refJoined ? ' · Ty dołączyłeś/aś z polecenia ✓' : ''}</p>`;
  return `<div class="card invite-card"><div class="row nowrap"><span class="inv-gift">🎁</span><div class="grow"><b>Zaproś i poleć znajomego</b>
      <div class="small muted">Gdy założy konto z Twojego linku, <b>oboje</b> dostajecie <b>+${REF_GEMS} 💎</b> i <b>darmową ${CASES[REF_CASE].icon} ${REF_CASE_ACC}</b>. Od razu jesteście znajomymi.</div></div></div>
    ${body}</div>`;
}
// zaproszony bez konta: przypomnienie na starcie
function refBannerHTML() {
  if (!pendingRef() || S.stats.refJoined || (cloudOn() && SB_PROFILE?.code)) return '';
  return `<div class="banner row nowrap invite-banner"><span class="grow">🎁 Znajomy zaprosił Cię do Fiszek! Załóż konto, a dostaniesz <b>+${REF_GEMS} 💎</b> i darmową skrzynkę.</span><button class="primary sm" data-go="#/me">Załóż konto</button></div>`;
}
const refHome0 = homeExtrasHTML;
homeExtrasHTML = function () { return refBannerHTML() + refHome0(); };
for (const r of ['inbox', 'rank', 'me']) {
  const r0 = ROUTES[r]; if (!r0) continue;
  ROUTES[r] = (...a) => { const v = r0(...a); if (!v?.html || (r === 'rank' && !cloudOn())) return v; return { ...v, html: v.html + inviteCardHTML() }; };
}

Object.assign(ACTIONS, {
  'ref-share': async () => {
    const url = refLink(); if (!url) return toast('Najpierw zaloguj się na konto');
    const text = `Uczę się z Fiszkami 📚 – dołącz z mojego linku, a oboje dostaniemy ${REF_GEMS} 💎 i darmową skrzynkę! Mój kod: ${SB_PROFILE.code}`;
    if (navigator.share) { try { await navigator.share({ title: 'Fiszki – zaproszenie', text, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    ACTIONS['ref-copy']();
  },
  'ref-copy': async () => {
    const url = refLink(); if (!url) return toast('Najpierw zaloguj się na konto');
    try { await navigator.clipboard.writeText(url); toast('Skopiowano link polecający ✓'); } catch { prompt('Skopiuj link:', url); }
  },
});

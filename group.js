'use strict';
/* 👥 Ucz się ze znajomymi – postęp grupy jak w Quizlecie. Grupa = wspólna talia (share.js): te same fiszki u wszystkich,
   każdy ma własny postęp. Postęp każdej osoby (nowe / w nauce / opanowane, dziś) trafia do jej profilu (stats.grp),
   który widzą znajomi – więc widać go też, gdy kolega jest offline. Na żywo (kto teraz się uczy) – przez kanał Realtime.
   Zaproszenie linkiem: kto go otworzy (zalogowany), dodaje Cię do znajomych i prosi o dołączenie; Twoja aplikacja
   sama wysyła mu talię. Postęp to tylko liczby – żadnych treści fiszek ani danych osobowych poza nickiem. */
const GRP_MASTER = 7;   // „opanowane” = w powtórkach z odstępem ≥ 7 dni
let GRP_LIVE = {}, GRP_CH = null, GRP_CH_ID = '', GRP_BEAT = 0, GRP_PUB = 0;
function grpProg(d) {
  const cs = S.cards.filter(c => c.deckId === d.id && c.sus !== 'skip'), sod = dayStart(), ids = new Set(cs.map(c => c.id));
  const m = cs.filter(c => c.srs.state === 'review' && c.srs.ivl >= GRP_MASTER).length, nw = cs.filter(c => c.srs.state === 'new').length;
  let today = 0; for (let i = S.log.length - 1; i >= 0 && S.log[i].t >= sod; i--) if (ids.has(S.log[i].c)) today++;
  return { n: cs.length, m, l: cs.length - m - nw, today, t: Date.now() };
}
const grpPct = p => p?.n ? Math.round((p.m + .4 * p.l) / p.n * 100) : 0;
// 🔒 postęp od innych: tylko liczby w rozsądnym zakresie
const sGrp = p => p && typeof p === 'object' ? { n: sInt(p.n, 0, 1e5), m: sInt(p.m, 0, 1e5), l: sInt(p.l, 0, 1e5), today: sInt(p.today, 0, 1e5), t: sInt(p.t, 0, 9e15) } : null;
// profil: postęp we wspólnych taliach (max 10)
const grpMyProfile0 = myProfile;
myProfile = function () { const p = grpMyProfile0(), g = {}; for (const d of sharedDecks().slice(0, 10)) g[d.share.id] = grpProg(d); return Object.keys(g).length ? { ...p, grp: g } : p; };
function grpPublishSoon() {
  if (!cloudOn()) return; clearTimeout(GRP_PUB);
  GRP_PUB = setTimeout(() => publishCloudProfile().catch(() => {}), 20000);
}
// ---------- na żywo
function grpLive(d) {
  const sh = d?.share; if (!sh || !cloudOn()) return;
  if (GRP_CH_ID !== sh.id) { GRP_CH?.close(); GRP_CH_ID = sh.id; GRP_LIVE = {}; GRP_CH = channel('fiszki-grp-' + sh.id, m => grpMsg(d, m)); }
  grpPing(d); clearInterval(GRP_BEAT); GRP_BEAT = setInterval(() => { const dd = deckByShare(GRP_CH_ID); if (dd && Date.now() - (GRP_LIVE._mine || 0) < 10 * MIN) grpPing(dd); else grpStop(); }, 20000);
}
function grpPing(d, studying) { GRP_CH?.send({ t: 'gp', uid: myId(), nick: (S.profile.nick || 'Gracz').slice(0, 24), av: String(S.profile.avatar || '🦊').slice(0, 8), p: grpProg(d), st: studying ? 1 : 0 }); if (studying) GRP_LIVE._mine = Date.now(); }
function grpStop() { clearInterval(GRP_BEAT); GRP_CH?.close(); GRP_CH = null; GRP_CH_ID = ''; }
function grpMsg(d, m) {
  if (m?.t !== 'gp') return; const uid = sStr(m.uid, 40), sh = d.share;
  if (!uid || uid === myId() || !(sh.members || []).includes(uid)) return;
  const p = sGrp(m.p); if (!p) return;
  GRP_LIVE[uid] = { nick: sStr(m.nick, 24), av: sStr(m.av, 8), p, seen: Date.now(), st: m.st ? Date.now() : (GRP_LIVE[uid]?.st || 0) };
  (sh.prog = sh.prog || {})[uid] = { ...p, nick: GRP_LIVE[uid].nick };   // ostatni znany stan zostaje u Ciebie
  if (parseRoute().parts[0] === 'group') render();
}
on('review', c => { const d = deckById(c.deckId); if (!d?.share) return; grpPublishSoon(); if (cloudOn()) { if (GRP_CH_ID !== d.share.id) grpLive(d); grpPing(d, true); } });
// ---------- zaproszenie linkiem
const grpLink = d => `${location.origin}${location.pathname}#/gjoin/${d.share.id}/${SB_PROFILE?.code || ''}/${encodeURIComponent(d.name.replace(/^👥\s*/, '').slice(0, 40))}`;
function grpEnsure(d) {
  if (!d.share) { d.share = { id: 'sd' + uid(), owner: myId(), members: [myId()], sent: {} }; touch(d); save(); }
  return d.share;
}
async function grpShare(d) {
  grpEnsure(d); const url = grpLink(d), text = `👥 Ucz się ze mną fiszek „${d.name.replace(/^👥\s*/, '')}” w Fiszkach – zobaczymy, kto szybciej opanuje!`;
  if (navigator.share) return navigator.share({ title: 'Fiszki – wspólna nauka', text, url }).catch(() => {});
  try { await navigator.clipboard.writeText(url); toast('🔗 Link skopiowany – wyślij go znajomemu'); } catch { prompt('Skopiuj link:', url); }
}
// ktoś otworzył link: dodaj zapraszającego do znajomych i poproś o talię
async function grpJoin(shid, code, name) {
  if (!cloudOn()) return toast('Zaloguj się (Więcej → Konto), żeby dołączyć do grupy', 4000);
  if (deckByShare(shid)) return go('#/group/' + deckByShare(shid).id);
  const p = await findProfileByCode(code); if (!p) return toast('Nie znaleziono osoby, która Cię zaprosiła', 4000);
  if (p.id === myId()) return toast('To Twoje własne zaproszenie 🙂');
  if (!(CLOUD_FRIENDS || []).some(f => f.id === p.id)) { const r = await addFriendByCode(code, p.id); if (r.error && !/duplicate|unique/i.test(r.error.message || '')) return toast('Błąd: ' + r.error.message, 4000); await loadCloudFriends(); }
  const r = await sendMsg(p.id, 'text', { sdj: shid, text: `👋 Dołączam do wspólnej nauki „${String(name || '').slice(0, 40)}”` });
  if (r?.error) return toast('Nie udało się wysłać prośby: ' + r.error.message, 4000);
  S.stats.grpJoin = { id: shid, at: Date.now(), name: String(name || '').slice(0, 40), by: p.nick || '' }; save();
  toast(`👥 Wysłano prośbę do ${p.nick || 'znajomego'} – talia przyjdzie, gdy otworzy aplikację`, 5000); go('#/gjoin/' + shid);
}
// prośba o dołączenie: gdy jestem w tej grupie, sam wysyłam talię (zaproszenie)
function grpScanJoins() {
  if (typeof MSGS === 'undefined' || !cloudOn()) return;
  const me = myId(), done = S.stats.grpDone = S.stats.grpDone || {};
  for (const m of MSGS) { const shid = m.body?.sdj; if (m.to_id !== me || !shid || done[m.id]) continue; done[m.id] = 1;
    const d = deckByShare(shid); if (d && !(d.share.members || []).includes(m.from_id)) loadCloudFriends().then(() => shareInvite(d, m.from_id)).catch(() => {}); }
  // zaproszenie z linku przyszło → otwieramy grupę
  const J = S.stats.grpJoin; if (J && deckByShare(J.id)) { delete S.stats.grpJoin; save(); toast('👥 Jesteś w grupie!'); go('#/group/' + deckByShare(J.id).id); }
}
const grpHandle0 = handleMsgs;
handleMsgs = (...a) => { const r = grpHandle0(...a); try { grpScanJoins(); } catch (e) { console.warn(e); } return r; };
// zaproszenie przez link przychodzi jako zwykłe zaproszenie do wspólnej talii – przyjmujemy je od razu
const grpAccept = () => { const J = S.stats.grpJoin; if (!J || typeof MSGS === 'undefined') return; const m = MSGS.find(x => x.body?.sdi?.id === J.id && x.to_id === myId()); if (m) shareAccept(m); };
const grpHandle1 = handleMsgs;
handleMsgs = (...a) => { const r = grpHandle1(...a); try { grpAccept(); } catch (e) { console.warn(e); } return r; };

// ---------- widok
function grpRows(d) {
  const sh = d.share, fr = CLOUD_FRIENDS || [], now = Date.now();
  return (sh.members || []).map(u => {
    if (u === myId()) return { me: true, nick: S.profile.nick || 'Ty', av: S.profile.avatar || '🦊', p: grpProg(d), live: true, st: now - (GRP_LIVE._mine || 0) < 2 * MIN };
    const f = fr.find(x => x.id === u), L = GRP_LIVE[u], prof = sGrp(f?.stats?.grp?.[sh.id]), cache = sh.prog?.[u];
    const p = [L?.p, prof, sGrp(cache)].filter(Boolean).sort((a, b) => b.t - a.t)[0] || null;
    return { nick: f?.nick || L?.nick || cache?.nick || 'Znajomy', av: f?.avatar || L?.av || '🙂', p, live: L && now - L.seen < 70e3, st: L && now - L.st < 2 * MIN };
  }).sort((a, b) => grpPct(b.p) - grpPct(a.p) || (b.p?.today || 0) - (a.p?.today || 0));
}
const agoTxt = t => { const s = (Date.now() - t) / 1000; return s < 90 ? 'przed chwilą' : s < 3600 ? `${Math.round(s / 60)} min temu` : s < 86400 ? `${Math.round(s / 3600)} h temu` : `${Math.round(s / 86400)} d temu`; };
function grpStatus(r) {
  if (!r.p) return '<span class="muted">czeka na pierwszą naukę</span>';
  if (r.st) return '<b class="g-now">🟢 uczy się teraz</b>';
  if (r.p.today) return `dziś ${r.p.today} ${plural(r.p.today, 'powtórka', 'powtórki', 'powtórek')}`;
  return `<span class="muted">${r.me ? 'dziś jeszcze nic' : 'ostatnio ' + agoTxt(r.p.t)}</span>`;
}
function groupView(d) {
  const sh = d.share, rows = grpRows(d), n = S.cards.filter(c => c.deckId === d.id).length, medal = ['🥇', '🥈', '🥉'];
  return `<div class="row nowrap"><button class="iconbtn" data-go="#/deck/${d.id}">‹</button><h1 class="grow" style="margin:0">👥 Ucz się ze znajomymi</h1></div>
  <div class="card g-head"><b>${esc(d.name.replace(/^👥\s*/, ''))}</b><div class="small muted">${n} ${plural(n, 'pojęcie', 'pojęcia', 'pojęć')} · ${rows.length} ${plural(rows.length, 'osoba', 'osoby', 'osób')} w grupie</div>
    <div class="row" style="margin-top:10px"><button class="primary grow" data-go="#/study/${d.id}/flip">📚 Ucz się</button><button class="grow" data-act="g-boss" data-id="${d.id}">⚔️ Boss talii</button></div></div>
  <h2 class="g-h">Postęp grupy</h2>
  <div class="card g-table"><div class="g-row g-th"><span>Imię</span><span>Status</span></div>
    ${rows.map((r, i) => { const p = r.p, pc = grpPct(p);
      return `<div class="g-row${r.me ? ' me' : ''}"><div class="g-who"><span class="g-av">${esc(r.av)}${r.live ? '<i class="g-dot"></i>' : ''}</span><div class="grow"><b>${esc(r.nick)}${r.me ? ' <small>(Ty)</small>' : ''}</b>
        <div class="g-bar" title="opanowane · w nauce · nowe">${p?.n ? `<i class="m" style="width:${(p.m / p.n * 100).toFixed(1)}%"></i><i class="l" style="width:${(p.l / p.n * 100).toFixed(1)}%"></i>` : ''}</div>
        <small class="muted">${p ? `${p.m} opanowane · ${p.l} w nauce · ${Math.max(0, p.n - p.m - p.l)} nowe` : '—'}</small></div></div>
        <div class="g-st"><b class="g-pct">${p ? pc + '%' : ''}${p && i < 3 && pc > 0 && rows.length > 1 ? ' ' + medal[i] : ''}</b><small>${grpStatus(r)}</small></div></div>`; }).join('')}</div>
  <p class="small muted center" style="margin:6px 0 14px">Opanowane = w powtórkach co ${GRP_MASTER}+ dni. Postęp odświeża się na żywo, a u osób offline – z ich ostatniej synchronizacji.</p>
  <div class="card center g-invite"><p style="margin:0 0 10px"><b>Udostępnij link</b> do wspólnej nauki i zobacz, jak wypadasz na tle grupy</p>
    <button class="primary block" data-act="g-share" data-id="${d.id}">📤 Zaproś znajomych</button>
    ${(CLOUD_FRIENDS || []).some(f => !(sh.members || []).includes(f.id)) ? `<div class="row nowrap" style="margin-top:8px"><select id="share-fid" class="grow">${(CLOUD_FRIENDS || []).filter(f => !(sh.members || []).includes(f.id)).map(f => `<option value="${f.id}">${esc(f.nick || 'Znajomy')}</option>`).join('')}</select><button class="sm" data-act="share-invite" data-id="${d.id}">Dodaj</button></div>` : ''}
    <p class="small muted" style="margin:8px 0 0">Znajomy otwiera link, loguje się i dostaje te same fiszki. Każdy uczy się u siebie, a postęp widzicie tutaj.</p></div>`;
}
ROUTES.group = parts => {
  const d = deckById(parts[1]);
  if (!d) return { tab: 'learn', html: '<p>Nie ma takiej talii.</p>' };
  if (!cloudOn()) return { tab: 'learn', html: `<div class="row nowrap"><button class="iconbtn" data-go="#/deck/${d.id}">‹</button><h1 class="grow" style="margin:0">👥 Ucz się ze znajomymi</h1></div>
    <div class="card center"><div style="font-size:54px">👥</div><p>Wspólna nauka i postęp grupy działają po zalogowaniu – wtedy znajomi widzą Twoje postępy, a Ty ich.</p><button class="primary block" data-go="#/more">🔑 Zaloguj się (Więcej → Konto)</button></div>` };
  grpEnsure(d); if (GRP_CH_ID !== d.share.id) setTimeout(() => grpLive(d), 0);
  return { tab: 'learn', html: groupView(d) };
};
ROUTES.gjoin = parts => {
  const [, shid, code, name] = parts, J = S.stats.grpJoin;
  if (shid && deckByShare(shid)) { setTimeout(() => go('#/group/' + deckByShare(shid).id), 0); return { tab: 'learn', html: '' }; }
  const nm = name ? decodeURIComponent(name) : J?.name || 'wspólna talia', waiting = J?.id === shid;
  return { tab: 'learn', html: `<div class="card center g-join"><div style="font-size:54px">👥</div><h2 style="margin:6px 0">Wspólna nauka: „${esc(nm)}”</h2>
    ${waiting ? `<p>⏳ Prośba wysłana${J.by ? ` do <b>${esc(J.by)}</b>` : ''}. Fiszki przyjdą automatycznie, gdy ta osoba otworzy aplikację – zostaw Fiszki otwarte albo zajrzyj później.</p>`
      : cloudOn() ? `<p>Dołącz, a dostaniesz te same fiszki i zobaczysz postęp całej grupy.</p><button class="primary block" data-act="g-join" data-s="${esc(shid || '')}" data-c="${esc(code || '')}" data-n="${esc(nm)}">👥 Dołącz do grupy</button>`
      : '<p>Żeby dołączyć, zaloguj się – to darmowe i zajmuje chwilę. Potem otwórz link jeszcze raz.</p><button class="primary block" data-go="#/more">🔑 Zaloguj się</button>'}</div>` };
};
HUB_OF.group = HUB_OF.gjoin = 'learn';
Object.assign(ACTIONS, {
  'g-share': el => { const d = deckById(el.dataset.id); if (d) grpShare(d); },
  'g-join': el => grpJoin(el.dataset.s, el.dataset.c, el.dataset.n),
  'g-boss': el => { BOSS_SEL = { kind: 'fin', id: el.dataset.id, i: null }; go('#/boss'); },
});
// w talii: duży przycisk zamiast samego rozwijanego pudełka
const grpShareCard0 = shareCardHTML;
shareCardHTML = d => {
  const sh = d.share, n = sh?.members?.length || 0;
  return `<button class="card row nowrap g-cta" data-go="#/group/${d.id}"><span class="g-cta-ic">👥</span><div class="grow" style="text-align:left"><b>${sh ? `Postęp grupy · ${n} ${plural(n, 'osoba', 'osoby', 'osób')}` : 'Ucz się ze znajomymi'}</b><div class="small muted">${sh ? 'zobacz, jak wypadasz na tle znajomych' : 'zaproś linkiem i porównujcie postępy jak w Quizlecie'}</div></div><span>›</span></button>${cloudOn() && sh ? grpShareCard0(d) : ''}`;
};

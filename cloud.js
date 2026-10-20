'use strict';
/* Konto w chmurze (Supabase): logowanie e-mailem i hasłem, synchronizacja fiszek na koncie,
   ranking znajomych z bazy oraz kanały Realtime do bitew (zamiast publicznego przekaźnika).
   Adres projektu i klucz „anon” ustawia host (Panel hosta → Supabase) – trafiają do assets/config.json,
   więc każdy użytkownik łączy się automatycznie. Klucz „anon” jest publiczny z założenia; dane chronią
   reguły RLS w bazie (supabase.sql). */

let SB = null, SB_USER = null, SB_CFG = null, SB_PROFILE = null, CLOUD_FRIENDS = [], cloudBusy = false, cloudTimer;
const cloudOn = () => !!(SB && SB_USER);

async function loadCloudConfig() {
  if (S.settings.sbUrl && S.settings.sbKey) return { url: S.settings.sbUrl, key: S.settings.sbKey, local: true };
  const get = url => fetch(url, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
  const repo = typeof hostRepo === 'function' ? hostRepo() : 'OskarZio/aa';
  const [a, b] = await Promise.all([get('assets/config.json?t=' + Date.now()), get(`https://raw.githubusercontent.com/${repo}/HEAD/assets/config.json?t=${Date.now()}`)]);
  const c = [a, b].filter(x => x?.supabaseUrl && x?.supabaseAnonKey).sort((x, y) => (y.updated || 0) - (x.updated || 0))[0];
  return c ? { url: c.supabaseUrl, key: c.supabaseAnonKey } : null;
}
async function initCloud() {
  try {
    const cfg = await loadCloudConfig(); if (!cfg) { SB_CFG = null; return; }
    if (SB && SB_CFG && SB_CFG.url === cfg.url && SB_CFG.key === cfg.key) return;   // już połączone
    SB_CFG = cfg;
    await loadScript('vendor/supabase.js');
    SB = supabase.createClient(SB_CFG.url, SB_CFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    const { data } = await SB.auth.getSession();
    setCloudUser(data?.session?.user || null);
    SB.auth.onAuthStateChange((_ev, session) => setCloudUser(session?.user || null));
    rerenderIf(['more', 'me', 'rank', '']);
  } catch (e) { console.warn('Supabase', e); SB = null; }
}
on('start', initCloud);
function rerenderIf(routes) { if (routes.includes(parseRoute().parts[0] || '')) render(); }
function setCloudUser(u) {
  const changed = (u?.id || null) !== (SB_USER?.id || null);
  SB_USER = u;
  if (changed && u) { cloudSync(false).then(loadCloudFriends); }
  if (changed) rerenderIf(['more', 'me', 'rank', '']);
}

// ---------- synchronizacja na koncie
async function cloudSync(manual) {
  if (!cloudOn() || cloudBusy) return;
  cloudBusy = true; if (manual) toast('Synchronizuję z kontem…', 15000);
  try {
    const uid = SB_USER.id;
    let r = await SB.from('user_data').select('data').eq('user_id', uid).maybeSingle();
    if (r.error) throw r.error;
    if (r.data?.data) mergeState(r.data.data);
    // obrazy: pobierz brakujące, wyślij nowe
    const used = referencedImages();
    r = await SB.from('user_images').select('id').eq('user_id', uid); if (r.error) throw r.error;
    const remote = new Set((r.data || []).map(x => x.id));
    const need = [...used].filter(id => !IMG[id] && remote.has(id));
    for (let i = 0; i < need.length; i += 8) {
      const g = await SB.from('user_images').select('id,data').eq('user_id', uid).in('id', need.slice(i, i + 8)); if (g.error) throw g.error;
      for (const row of g.data || []) { IMG[row.id] = row.data; await DB.set('img:' + row.id, row.data); }
    }
    const up = [...used].filter(id => IMG[id] && !remote.has(id));
    for (let i = 0; i < up.length; i += 4) {
      const u = await SB.from('user_images').upsert(up.slice(i, i + 4).map(id => ({ user_id: uid, id, data: IMG[id] }))); if (u.error) throw u.error;
    }
    r = await SB.from('user_data').upsert({ user_id: uid, data: exportData(), updated_at: new Date().toISOString() }); if (r.error) throw r.error;
    await publishCloudProfile();
    S.settings.lastSync = Date.now(); await DB.set('state', S); updateBadge();
    if (manual) toast('Zsynchronizowano z kontem ✓');
    rerenderIf(['', 'more', 'me', 'deck', 'rank', 'topics', 'palaces']);
  } catch (e) { console.error(e); if (manual) toast('Błąd synchronizacji: ' + (e.message || e), 5000); }
  finally { cloudBusy = false; }
}
async function publishCloudProfile() {
  if (!cloudOn()) return;
  const uid = SB_USER.id;
  const r = await SB.from('profiles').upsert({ id: uid, nick: (S.profile.nick || '').slice(0, 24) || 'Gracz',  // nigdy nie pokazujemy maila innym avatar: S.profile.avatar || '🦊',
    avatar_img: safeImg(S.profile.avatarImg), stats: myProfile(), updated_at: new Date().toISOString() });
  if (r.error) throw r.error;
  const p = await SB.from('profiles').select('*').eq('id', uid).maybeSingle();
  if (!p.error) SB_PROFILE = p.data;
}
// istniejąca synchronizacja (GitHub) zostaje dla osób bez konta; po zalogowaniu działa konto
const clSyncGist0 = syncNow;
syncNow = manual => cloudOn() ? cloudSync(manual) : clSyncGist0(manual);
const clSchedGist0 = scheduleSync;
scheduleSync = () => {
  if (!cloudOn()) return clSchedGist0();
  clearTimeout(cloudTimer); cloudTimer = setTimeout(() => cloudSync(false), 12000);
};
document.addEventListener('visibilitychange', () => {
  if (!cloudOn()) return;
  if (document.visibilityState === 'hidden') { clearTimeout(cloudTimer); cloudSync(false); }
  else if (Date.now() - (S.settings.lastSync || 0) > 3 * MIN) cloudSync(false).then(loadCloudFriends);
});

// ---------- znajomi i ranking z bazy
async function loadCloudFriends() {
  if (!cloudOn()) return;
  // obustronnie: ci, których dodałem, i ci, którzy dodali mnie
  const me = SB_USER.id;
  const f = await SB.from('friends').select('user_id,friend_id').or(`user_id.eq.${me},friend_id.eq.${me}`);
  if (f.error) return console.warn(f.error);
  const ids = [...new Set((f.data || []).map(x => x.user_id === me ? x.friend_id : x.user_id))].filter(id => id !== me);
  if (!ids.length) { CLOUD_FRIENDS = []; return rerenderIf(['rank', '']); }
  const p = await SB.from('profiles').select('*').in('id', ids);
  if (!p.error) CLOUD_FRIENDS = p.data || [];
  const rows = rankRows().sort((x, y) => y.today - x.today);
  if (rows.length > 1 && rows[0].me && rows[0].today > 0 && !S.stats.rankFirst) { S.stats.rankFirst = 1; save(); }
  rerenderIf(['rank', '']);
}
const clRankRows0 = rankRows;
rankRows = function () { return cloudOn() ? rowsFromProfiles(CLOUD_FRIENDS) : clRankRows0(); };
// 🌍 ranking wszystkich: aktywni w ostatnich 14 dniach (bez osób, które się ukryły)
let RANK_SCOPE = 'friends', GLOBAL_PROFILES = [], globalLoaded = 0, globalBusy = false;
const GLOBAL_TOP = 100;
async function loadGlobalRank() {
  if (!cloudOn() || globalBusy) return; globalBusy = true;
  try {
    const since = new Date(Date.now() - 14 * DAY).toISOString();
    const p = await SB.from('profiles').select('id,code,nick,avatar,avatar_img,stats,updated_at').gte('updated_at', since).order('updated_at', { ascending: false }).limit(500);
    if (p.error) return console.warn(p.error);
    GLOBAL_PROFILES = (p.data || []).filter(x => x.id !== SB_USER.id && x.stats?.showGlobal === 1);
    globalLoaded = Date.now(); rerenderIf(['rank']);
  } finally { globalBusy = false; }
}
const globalRows = () => rowsFromProfiles(GLOBAL_PROFILES);
function rowsFromProfiles(list) {
  // podstawiamy profile z bazy pod istniejące wyliczanie rankingu
  const keepF = S.friends, keepD = FRIEND_DATA;
  S.friends = list.map(p => ({ id: 'sb:' + p.id, code: 'sb:' + p.id, name: p.nick }));
  FRIEND_DATA = Object.fromEntries(list.map(p => ['sb:' + p.id, { ...(p.stats || {}), app: 'fiszki-profil', nick: p.nick || 'Gracz', avatar: p.avatar, avatarImg: p.avatar_img, updated: Date.parse(p.updated_at) }]));
  try { return clRankRows0(); } finally { S.friends = keepF; FRIEND_DATA = keepD; }
};
async function cloudAddFriend(code) {
  code = String(code || '').trim().toUpperCase().replace(/^.*FRIEND\//, '');
  if (!code) return toast('Wpisz kod znajomego');
  if (code === SB_PROFILE?.code) return toast('To Twój własny kod 🙂');
  const p = await SB.from('profiles').select('*').eq('code', code).maybeSingle();
  if (p.error || !p.data) return toast('Nie znaleziono gracza o tym kodzie', 3500);
  if (CLOUD_FRIENDS.some(f => f.id === p.data.id)) return toast('Ten znajomy już jest w rankingu');
  if (!confirm(`Dodać ${p.data.avatar || ''} ${p.data.nick || 'gracza'} do rankingu?`)) return;
  const r = await SB.from('friends').insert({ user_id: SB_USER.id, friend_id: p.data.id });
  if (r.error) return toast('Błąd: ' + r.error.message, 4000);
  S.stats.friendsAdded = (S.stats.friendsAdded || 0) + 1; save();
  toast(`Dodano ${p.data.nick} ✓`); await loadCloudFriends(); go('#/rank');
}

const clRankRoute0 = ROUTES.rank;
ROUTES.rank = (...a) => cloudOn() ? cloudRankRoute() : clRankRoute0(...a);
let cloudRankLoaded = 0;
function cloudRankRoute() {
  if (Date.now() - cloudRankLoaded > 60e3) { cloudRankLoaded = Date.now(); publishCloudProfile().then(loadCloudFriends).catch(() => {}); }
  const tabs = [['today', 'Dziś'], ['week', 'Tydzień'], ['time', '⏱ Czas'], ['streak', 'Seria'], ['xp', 'Poziom'], ['elo', 'Elo']];
  const key = r => RANK_TAB === 'xp' ? r.xp : RANK_TAB === 'elo' ? (r.elo || 1000) : RANK_TAB === 'time' ? r.weekMin || 0 : r[RANK_TAB];
  const val = r => RANK_TAB === 'time' ? `⏱ ${fmtDur((r.weekMin || 0) * MIN)} <small>w tym tyg.</small>` : RANK_TAB === 'today' ? `${r.today} <small>powt.</small>` : RANK_TAB === 'week' ? `${r.week} <small>powt.</small>` : RANK_TAB === 'streak' ? `🔥 ${r.streak}`
    : RANK_TAB === 'elo' ? eloHTML(r.elo || 1000) : `⭐ ${r.level} <small>${r.xp} XP</small>`;
  const all = RANK_SCOPE === 'all';
  if (all && Date.now() - globalLoaded > 60e3) loadGlobalRank();
  const sorted = (all ? globalRows() : rankRows()).sort((a, b) => key(b) - key(a) || (b.me ? 1 : 0) - (a.me ? 1 : 0));
  const myPos = sorted.findIndex(r => r.me);
  // ranking wszystkich: top 100 + Twoje miejsce, jeśli jesteś niżej
  const rows = all ? sorted.slice(0, GLOBAL_TOP).concat(myPos >= GLOBAL_TOP ? [sorted[myPos]] : []) : sorted;
  const posOf = r => sorted.indexOf(r), maxToday = Math.max(1, ...rows.map(r => r.today));
  const fids = new Set(CLOUD_FRIENDS.map(f => 'sb:' + f.id)), codeOf = id => GLOBAL_PROFILES.find(p => 'sb:' + p.id === id)?.code;
  const code = SB_PROFILE?.code;
  onMount(mountRank);
  return { tab: 'home', html: `
  <div class="row nowrap"><button class="iconbtn" data-go="#/">‹</button><h1 class="grow">Ranking</h1><button class="iconbtn" data-act="cloud-rank-refresh">🔄</button></div>
  <div class="seg rank-scope" style="display:flex"><button class="grow ${all ? '' : 'on'}" data-act="rank-scope" data-k="friends">👥 Znajomi</button><button class="grow ${all ? 'on' : ''}" data-act="rank-scope" data-k="all">🌍 Wszyscy</button></div>
  <div class="seg" style="display:flex">${tabs.map(([k, l]) => `<button class="grow ${RANK_TAB === k ? 'on' : ''}" data-act="rank-tab" data-k="${k}">${l}</button>`).join('')}</div>
  ${all ? `<p class="small muted center" style="margin:6px 0">${globalLoaded ? `Wszyscy aktywni w ostatnich 14 dniach · ${sorted.length} os. · Twoje miejsce: <b>#${myPos + 1}</b>` : 'Wczytywanie rankingu…'}${S.settings.showGlobal ? '' : ' · 🙈 inni Cię tu nie widzą'}</p>` : ''}
  <div class="card">${rows.map((r, i) => { const pos = posOf(r); return `${all && i === GLOBAL_TOP ? '<div class="rank-gap">⋯</div>' : ''}<div class="rankrow${r.me ? ' me' : ''}">
      <span class="medal">${['🥇', '🥈', '🥉'][pos] || pos + 1 + '.'}</span><span class="av">${avatarHTML(r, 34)}</span>
      <div class="grow"><div class="row nowrap"><b class="grow nickrow"><span class="nm">${esc(r.nick)}</span>${r.me ? '<span>(Ty)</span>' : ''}${typeof showcaseHTML === 'function' ? `<span>${showcaseHTML(r.showcase)}</span>` : ''}</b><span>${val(r)}</span></div>
        ${RANK_TAB === 'today' ? progress(r.today / maxToday, true) : ''}
        <div class="small muted">poziom ${r.level} · 🔥 ${r.streak}${r.me ? ` · ${r.total} powtórek łącznie` : r.updated ? ` · aktywność ${ago(r.updated)}` : ''}</div></div>
      ${r.me ? '' : all ? (fids.has(r.id) ? '<span class="small muted" title="Znajomy">👥</span>' : codeOf(r.id) ? `<button class="ghost sm" data-act="rank-add" data-code="${esc(codeOf(r.id))}" title="Dodaj do znajomych">➕</button>` : '')
        : `<button class="ghost sm" data-act="cloud-friend-del" data-id="${String(r.id).replace('sb:', '')}">✕</button>`}</div>`; }).join('')}
    ${all ? (globalLoaded && sorted.length < 2 ? '<p class="muted small center">Na razie nikogo więcej tu nie ma – zaproś znajomych! 🌍</p>' : '') : CLOUD_FRIENDS.length ? '' : '<p class="muted small center">Dodaj znajomych kodem, żeby się porównywać 💪</p>'}</div>
  ${all ? `<div class="card"><label class="row nowrap small" style="gap:10px"><input type="checkbox" data-act="rank-hide" ${S.settings.showGlobal ? 'checked' : ''}><span class="grow"><b>🌍 Pokazuj mnie w rankingu wszystkich</b><br><span class="muted">Domyślnie wyłączone. Po włączeniu Twój nick, awatar i statystyki zobaczą wszyscy zalogowani. Znajomi widzą Cię zawsze.</span></span></label></div>` : ''}
  <div class="card"><h3 style="margin-top:0">Znajomi</h3>
    <p class="small">Twój kod: <b class="code-sm">${code || '…'}</b></p>
    <button class="primary block" data-act="cloud-invite" ${code ? '' : 'disabled'}>📤 Zaproś znajomego</button>
    <div class="spacer"></div>
    <div class="row nowrap"><input id="friend-code" class="grow" placeholder="Kod znajomego (8 znaków)" maxlength="40" autocapitalize="characters" style="text-transform:uppercase"><button data-act="cloud-friend-add">Dodaj</button></div>
    <p class="small muted">Ranking pokazuje tylko nick i liczby (powtórki, serię, poziom, Elo) – fiszki zostają prywatne.</p></div>` };
}
Object.assign(ACTIONS, {
  'rank-scope': el => { RANK_SCOPE = el.dataset.k; render(); },
  'rank-add': el => cloudAddFriend(el.dataset.code),
  'rank-hide': el => { S.settings.showGlobal = el.checked; delete S.settings.hideGlobal; save(); publishCloudProfile().catch(() => {}); toast(el.checked ? '🌍 Jesteś widoczny w rankingu wszystkich' : '🙈 Nie widać Cię już w rankingu wszystkich'); render(); },
});
const clFriendRoute0 = ROUTES.friend;
ROUTES.friend = (parts, q) => {
  if (cloudOn() && /^[0-9A-Za-z]{8}$/.test(parts[1] || '')) { setTimeout(() => cloudAddFriend(parts[1]), 50); return cloudRankRoute(); }
  return clFriendRoute0(parts, q);
};

// ---------- kanał Realtime do bitew (używany przez battle.js, gdy Supabase jest podłączone)
function sbChannel(topic, recv) {
  const ch = SB.channel('fb-' + topic, { config: { broadcast: { self: false } } });
  let ready = false; const queue = [];
  ch.on('broadcast', { event: 'm' }, msg => recv(msg.payload));
  ch.subscribe(status => {
    if (status === 'SUBSCRIBED') { ready = true; queue.splice(0).forEach(p => ch.send({ type: 'broadcast', event: 'm', payload: p })); }
  });
  return {
    send: m => { const p = { ...m, from: MY_ID }; ready ? ch.send({ type: 'broadcast', event: 'm', payload: p }) : queue.push(p); },
    close: () => { try { SB.removeChannel(ch); } catch { /* */ } },
  };
}

// ---------- karta konta w zakładce „Więcej”
// nick z pola formularza → profil (zwraca, czy jakiś nick jest ustawiony)
function takeNick() {
  const v = ($('#acc-nick')?.value || '').trim().slice(0, 24);
  if (v && v !== S.profile.nick) { S.profile.nick = v; S.profile.mod = Date.now(); save(); }
  return !!S.profile.nick;
}
function accountCardHTML() {
  if (!SB) return `<div class="card row nowrap"><span style="font-size:30px">☁️</span><div class="grow"><b>Konto w chmurze</b>
      <div class="small muted">${SB_CFG === null ? 'Jeszcze nie podłączone – host musi dodać Supabase (instrukcja).' : 'Łączę…'}</div></div>
      <button class="sm" data-go="#/cloud-help">Instrukcja</button></div>`;
  if (!SB_USER) return `<div class="card"><h2 style="margin-top:0">☁️ Konto</h2>
      <p class="small muted">Zaloguj się, żeby mieć fiszki na każdym urządzeniu i widzieć ranking znajomych.</p>
      <input id="acc-nick" placeholder="Nick (widzą go znajomi)" maxlength="24" value="${esc(S.profile.nick || '')}">
      <div class="spacer"></div>
      <input id="acc-email" type="email" placeholder="E-mail" autocomplete="email" autocapitalize="off">
      <div class="spacer"></div>
      <input id="acc-pass" type="password" placeholder="Hasło (min. 6 znaków)" autocomplete="current-password">
      <div class="spacer"></div>
      <div class="row"><button class="primary grow" data-act="acc-login">Zaloguj</button><button class="grow" data-act="acc-signup">Załóż konto</button></div>
      <p class="small muted">Twoje obecne fiszki zostaną dołączone do konta przy pierwszym logowaniu.</p>
      <button class="ghost sm" data-act="cloud-check">🩺 Sprawdź połączenie z bazą</button>${cloudCheckHTML()}</div>`;
  return `<div class="card"><h2 style="margin-top:0">☁️ Konto</h2>
    <label class="small muted">Twój nick – tak widzą Cię znajomi w rankingu i bitwach</label>
    <div class="row nowrap"><input id="acc-nick" class="grow" maxlength="24" placeholder="Wpisz nick" value="${esc(S.profile.nick || '')}"><button class="${S.profile.nick ? '' : 'primary pulse'}" data-act="acc-nick">Zapisz</button></div>
    <div class="spacer"></div>
    <div class="kv"><span>Zalogowano jako</span><b class="nm">${esc(SB_USER.email || '')}</b></div>
    <div class="kv"><span>Ostatnia synchronizacja</span><b>${ago(S.settings.lastSync)}</b></div>
    ${SB_PROFILE?.code ? `<div class="kv"><span>Kod znajomego</span><b>${SB_PROFILE.code}</b></div>` : ''}
    <div class="spacer"></div>
    <button class="primary block" data-act="sync">🔄 Synchronizuj teraz</button>
    <div class="row" style="margin-top:8px"><button class="grow" data-go="#/rank">👥 Ranking znajomych</button><button class="ghost" data-act="acc-logout">Wyloguj</button></div>
    <button class="ghost sm" data-act="cloud-check">🩺 Sprawdź połączenie z bazą</button>${cloudCheckHTML()}</div>`;
}

ROUTES['cloud-help'] = () => {
  onMount(async () => { const t = $('#sql-box'); if (t && !t.value) t.value = await fetch('supabase.sql', { cache: 'no-store' }).then(r => r.text()).catch(() => 'Nie udało się wczytać supabase.sql'); });
  return { tab: 'more', html: `<div class="row nowrap"><button class="iconbtn" data-go="#/more">‹</button><h1 class="grow">☁️ Podłączenie Supabase</h1></div>
  <div class="card small"><ol class="steps">
    <li>Wejdź na <a href="https://supabase.com/dashboard" target="_blank" rel="noopener">supabase.com</a> i załóż konto (najprościej „Continue with GitHub”).</li>
    <li>Kliknij <b>New project</b>: nazwa np. <i>fiszki</i>, wymyśl hasło do bazy (zapisz je), region <b>Central EU (Frankfurt)</b> → <b>Create</b>. Poczekaj ok. 2 minuty.</li>
    <li>Po lewej otwórz <b>SQL Editor</b> → <b>New query</b>, wklej cały skrypt poniżej i kliknij <b>Run</b>. Ma się pojawić „Success”.</li>
    <li>Po lewej <b>Authentication → Sign In / Providers → Email</b>: zostaw włączone. Dla prostszego startu możesz wyłączyć <b>Confirm email</b> (wtedy konto działa od razu, bez klikania w link w mailu).</li>
    <li><b>Project Settings → API</b> (lub <b>API Keys</b>): skopiuj <b>Project URL</b> oraz klucz <b>anon / publishable</b>. <u>Nie</u> kopiuj klucza <i>service_role / secret</i>.</li>
    <li>W tej aplikacji: <b>Więcej → 🔑 Panel hosta → Supabase</b>: wklej URL i klucz → <b>Zapisz dla wszystkich</b>. Po 1–2 minutach każdy użytkownik zobaczy logowanie w <b>Więcej → Konto</b>.</li>
    <li>Ty i kolega: <b>Więcej → Konto → Załóż konto</b>. Potem w <b>Rankingu</b> wymieńcie się kodami znajomego.</li></ol></div>
  <div class="card"><div class="row nowrap"><h3 class="grow" style="margin:0">Skrypt SQL</h3><button class="sm primary" data-act="copy-sql">📋 Kopiuj</button></div>
    <textarea id="sql-box" rows="10" readonly style="font-family:ui-monospace,monospace;font-size:12px;margin-top:8px"></textarea></div>` };
};

// Diagnostyka: czy baza odpowiada, czy są tabele ze skryptu SQL i jak ustawione jest logowanie
let CLOUD_CHECK = null;
const cloudCheckHTML = () => CLOUD_CHECK ? `<div class="checklist">${CLOUD_CHECK.map(x => `<div class="${x.ok ? 'c-rev' : 'c-lrn'}">${x.ok ? '✓' : '✗'} ${esc(x.text)}</div>`).join('')}</div>` : '';
async function cloudCheck() {
  const res = []; const step = (ok, text) => { res.push({ ok, text }); CLOUD_CHECK = [...res]; render(); };
  CLOUD_CHECK = []; render();
  if (!SB) return step(false, 'Brak konfiguracji – host musi zapisać adres i klucz Supabase w Panelu hosta.');
  try {
    const r = await fetch(SB_CFG.url + '/auth/v1/settings', { headers: { apikey: SB_CFG.key } });
    if (!r.ok) return step(false, `Serwer Supabase odpowiada błędem ${r.status} – sprawdź adres i klucz (czy projekt nie jest wstrzymany).`);
    const st = await r.json();
    step(true, `Połączono z ${SB_CFG.url.replace('https://', '')}`);
    step(st.external?.email !== false, st.external?.email === false ? 'Logowanie e-mailem jest wyłączone – włącz Authentication → Providers → Email.' : 'Logowanie e-mailem włączone');
    step(true, st.mailer_autoconfirm ? 'Potwierdzanie e-maila wyłączone – konto działa od razu' : 'Po rejestracji trzeba kliknąć link w mailu (Confirm email włączone)');
  } catch (e) { return step(false, 'Brak połączenia z Supabase: ' + e.message); }
  for (const t of ['profiles', 'user_data', 'user_images', 'friends']) {
    const { error } = await SB.from(t).select('*', { count: 'exact', head: true });
    step(!error, error ? `Brak tabeli „${t}” (${error.message}) – uruchom skrypt SQL w SQL Editor.` : `Tabela „${t}” jest`);
  }
}

Object.assign(ACTIONS, {
  'cloud-check': () => cloudCheck(),
  'acc-login': async () => {
    takeNick();
    const email = $('#acc-email').value.trim(), password = $('#acc-pass').value;
    if (!email || !password) return toast('Wpisz e-mail i hasło');
    const { error } = await SB.auth.signInWithPassword({ email, password });
    if (error) return toast(/confirm/i.test(error.message) ? 'Najpierw potwierdź e-mail (link w skrzynce)' : /invalid/i.test(error.message) ? 'Zły e-mail lub hasło' : 'Błąd: ' + error.message, 4500);
    toast('Zalogowano ✓ Synchronizuję fiszki…');
  },
  'acc-nick': async () => {
    if (!takeNick()) return toast('Wpisz nick');
    try { await publishCloudProfile(); toast(`Nick zapisany: ${S.profile.nick} ✓`); } catch (e) { toast('Błąd: ' + (e.message || e), 4000); }
    render();
  },
  'acc-signup': async () => {
    const email = $('#acc-email').value.trim(), password = $('#acc-pass').value;
    if (!takeNick()) return toast('Wpisz nick – zobaczą go znajomi');
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast('Wpisz poprawny e-mail');
    if (password.length < 6) return toast('Hasło musi mieć min. 6 znaków');
    const { data, error } = await SB.auth.signUp({ email, password, options: { emailRedirectTo: APP_URL() } });
    if (error) return toast('Błąd: ' + error.message, 4500);
    if (!data.session) toast('Konto utworzone ✓ Kliknij link w mailu, a potem zaloguj się tutaj', 6000);
    else toast('Konto utworzone i zalogowano ✓');
  },
  'acc-logout': async () => {
    if (!confirm('Wylogować? Fiszki zostaną na tym urządzeniu.')) return;
    await cloudSync(false); await SB.auth.signOut(); SB_USER = null; SB_PROFILE = null; CLOUD_FRIENDS = []; render();
  },
  'cloud-rank-refresh': () => { cloudRankLoaded = 0; toast('Odświeżam…'); render(); },
  'cloud-friend-add': () => cloudAddFriend($('#friend-code').value),
  'cloud-friend-del': async el => {
    const f = CLOUD_FRIENDS.find(x => x.id === el.dataset.id);
    if (!confirm(`Usunąć ${f?.nick || 'znajomego'} z rankingu?`)) return;
    const me = SB_USER.id, id = el.dataset.id;
    await SB.from('friends').delete().or(`and(user_id.eq.${me},friend_id.eq.${id}),and(user_id.eq.${id},friend_id.eq.${me})`);
    CLOUD_FRIENDS = CLOUD_FRIENDS.filter(x => x.id !== el.dataset.id); render();
  },
  'cloud-invite': async () => {
    const url = APP_URL() + '#/friend/' + SB_PROFILE.code, text = `Uczę się w Fiszkach 🧠 Dodaj mnie do rankingu – mój kod: ${SB_PROFILE.code}`;
    if (navigator.share) { try { await navigator.share({ title: 'Fiszki', text, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(`${text}\n${url}`); toast('Skopiowano zaproszenie'); } catch { prompt('Skopiuj:', url); }
  },
  'copy-sql': async () => { const t = $('#sql-box'); try { await navigator.clipboard.writeText(t.value); toast('Skopiowano skrypt SQL ✓'); } catch { t.select(); document.execCommand('copy'); toast('Skopiowano'); } },
});

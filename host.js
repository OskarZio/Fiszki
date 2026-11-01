'use strict';
/* Panel hosta: po wpisaniu kodu hosta właściciel aplikacji może wgrać GIF-y reakcji, które dostaną wszyscy użytkownicy.
   Plik trafia do repozytorium na GitHubie (assets/global/…) razem z listą assets/global.json – GitHub Pages
   udostępnia je każdemu, a aplikacja wczytuje przy starcie. Zapis wymaga tokenu GitHub z prawem zapisu do repozytorium,
   więc nawet ktoś, kto pozna kod, nie podmieni plików bez tokenu właściciela. */

const HOST_HASH = 'c445ae5875d6a31cad713ed08ef1597bb31c4a818192671d1bc6774d80424209';   // SHA-256 kodu hosta
const sha256 = async t => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map(b => b.toString(16).padStart(2, '0')).join('');
// 🔒 kod sam nie wystarczy (da się go obejść w przeglądarce) – panel otwiera się tylko kontu właściciela potwierdzonemu przez serwer
const hostUnlocked = () => { try { return localStorage.getItem('hostOK') === HOST_HASH && typeof IS_ADMIN !== 'undefined' && IS_ADMIN === true; } catch { return false; } };
function hostRepo() {
  if (S.settings.hostRepo) return S.settings.hostRepo;
  if (location.hostname.endsWith('.github.io')) { const o = location.hostname.split('.')[0], r = location.pathname.split('/')[1]; return `${o}/${r || o + '.github.io'}`; }
  return 'OskarZio/aa';
}
async function ghRepo(path, opt = {}) {
  const r = await fetch(`https://api.github.com/repos/${hostRepo()}/contents/${path}`, {
    ...opt, headers: { Authorization: 'Bearer ' + S.settings.hostToken, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' } });
  if (r.status === 404 && (!opt.method || opt.method === 'GET')) return null;
  if (!r.ok) {
    const msg = (await r.json().catch(() => ({}))).message || '';
    throw new Error(r.status === 401 ? 'zły token (GitHub go nie rozpoznaje)' : r.status === 403 || r.status === 404 ? `token nie ma prawa zapisu do ${hostRepo()}${msg ? ' – ' + msg : ''}` : `GitHub ${r.status}${msg ? ' – ' + msg : ''}`);
  }
  return r.json();
}
// token i repozytorium bierzemy też prosto z pól (na iPhonie „change” przychodzi dopiero po opuszczeniu pola)
function syncHostFields() {
  const t = $('#host-token'), r = $('#host-repo');
  if (t) S.settings.hostToken = t.value.trim().replace(/\s+/g, '');
  if (r && r.value.trim()) S.settings.hostRepo = r.value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
  save();
}
let HOST_CHECK = null;   // wyniki sprawdzania tokenu
async function checkHostToken() {
  syncHostFields();
  const tok = S.settings.hostToken, repo = hostRepo(), res = [];
  const step = (ok, text) => { res.push({ ok, text }); HOST_CHECK = { res: [...res], running: true }; render(); };
  HOST_CHECK = { res: [], running: true }; render();
  const H = { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json' };
  try {
    if (!tok) return step(false, 'Pole tokenu jest puste – wklej token.');
    if (!/^(github_pat_|ghp_)/.test(tok)) step(false, 'Token zwykle zaczyna się od „github_pat_” albo „ghp_” – sprawdź, czy skopiowałeś cały.');
    let r = await fetch('https://api.github.com/user', { headers: H });
    if (r.status === 401) return step(false, '1. Token jest nieprawidłowy lub wygasł – wygeneruj nowy i wklej ponownie.');
    const user = await r.json();
    step(r.ok, r.ok ? `1. Token działa – konto: ${user.login}` : `1. Błąd GitHub ${r.status}`);
    r = await fetch(`https://api.github.com/repos/${repo}`, { headers: H });
    if (!r.ok) return step(false, `2. Token nie widzi repozytorium „${repo}”. W ustawieniach tokenu wybierz „Only select repositories” → ${repo.split('/')[1]}.`);
    const rp = await r.json();
    step(true, `2. Repozytorium widoczne: ${rp.full_name}${rp.private ? ' (prywatne)' : ''}, gałąź: ${rp.default_branch}`);
    // jedyny pewny test zapisu: zapisanie małego pliku kontrolnego
    const path = 'assets/global/.sprawdzenie.txt';
    r = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { headers: H });
    const sha = r.ok ? (await r.json()).sha : undefined;
    r = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { method: 'PUT', headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Sprawdzenie tokenu hosta', content: btoa('ok ' + new Date().toISOString()), ...(sha ? { sha } : {}) }) });
    if (!r.ok) {
      const msg = (await r.json().catch(() => ({}))).message || '';
      return step(false, `3. Brak prawa zapisu (${r.status}${msg ? ': ' + msg : ''}). W tokenie ustaw Repository permissions → Contents: „Read and write”.`);
    }
    step(true, '3. Zapis działa ✓ – możesz wgrywać GIF-y dla wszystkich.');
  } catch (e) { step(false, 'Brak połączenia z GitHub: ' + e.message); }
  finally { HOST_CHECK.running = false; render(); }
}
const b64utf8 = s => btoa(unescape(encodeURIComponent(s)));
const utf8b64 = s => decodeURIComponent(escape(atob(s.replace(/\n/g, ''))));
async function readGlobalJson() {
  const f = await ghRepo('assets/global.json');
  return f ? { sha: f.sha, data: JSON.parse(utf8b64(f.content)) } : { sha: null, data: { v: 1, reactions: {} } };
}
async function writeGlobalJson(data, sha, msg) {
  data.updated = Date.now();
  await ghRepo('assets/global.json', { method: 'PUT', body: JSON.stringify({ message: msg, content: b64utf8(JSON.stringify(data, null, 2)), ...(sha ? { sha } : {}) }) });
}

// 📊 statystyki aplikacji (tylko liczby) – pierwsze zalogowane konto, które otworzy Panel hosta, zostaje właścicielem
let HOST_ST = null, HOST_CHK = 0;
setTimeout(() => { ACTIONS['host-recheck'] = () => { HOST_CHK = 0; render(); };
  ACTIONS['adm-pick'] = el => { const i = $('#adm-code'); if (i) { i.value = el.dataset.code; i.scrollIntoView({ block: 'center', behavior: 'smooth' }); } };
  ACTIONS['adm-player'] = el => admPlayerPopup(el.dataset.code);
  ACTIONS['adm-show'] = () => { const c = ($('#adm-code')?.value || '').trim(); if (!c) return toast('Wpisz kod gracza'); admPlayerPopup(c); };
  ACTIONS['host-act'] = async el => { const k = el.dataset.k, code = (el.dataset.code || $('#adm-code')?.value || '').trim().toUpperCase(); if (!code) return toast('Wpisz kod gracza');
    let msg = null; if (k === 'msg') { msg = prompt('Treść wiadomości (gracz zobaczy ją w okienku):'); if (!msg) return; }
    if (['wallet', 'items', 'stickers', 'all'].includes(k) && !confirm(`${el.textContent} – gracz ${code}?\nTego nie da się cofnąć.`)) return;
    const r = await SB.rpc('admin_act', { p_code: code, p_what: k, p_msg: msg });
    if (r.error) return toast(/function|schema cache|does not exist/i.test(r.error.message || '') ? 'Wgraj nowy supabase.sql (Aktualizacja bazy)' : /no such/.test(r.error.message) ? 'Nie ma gracza o kodzie ' + code : 'Błąd: ' + r.error.message, 4000);
    toast(`✓ ${el.textContent} – ${r.data || code}`); hostStatsLoad(); if (el.dataset.code) admPlayerPopup(code); };
  ACTIONS['host-ban'] = async el => { const on = el.dataset.on === '1', code = el.dataset.code;
    if (on && !confirm(`🚫 Wyzerować i zablokować kryształy, złoto i przedmioty gracza ${code}?\nMożesz to potem cofnąć (Odblokuj), ale wyzerowanych rzeczy to nie przywróci.`)) return;
    const r = await SB.rpc('admin_ban', { p_code: code, p_on: on });
    if (r.error) return toast(/function|schema cache|does not exist/i.test(r.error.message || '') ? 'Wgraj nowy supabase.sql (Aktualizacja bazy)' : 'Błąd: ' + r.error.message, 4000);
    toast(on ? `🚫 Zablokowano ${code}` : `✅ Odblokowano ${code}`); hostStatsLoad(); if (el.closest('.adm-pop')) admPlayerPopup(code); }; }, 0);
async function hostStatsLoad() {
  HOST_ST = { loading: true };
  if (!(typeof cloudOn === 'function' && cloudOn())) { HOST_ST = { err: 'Zaloguj się na swoje konto, żeby zobaczyć statystyki.' }; return render(); }
  try {
    const c = await SB.rpc('claim_admin'); if (c.error) throw c.error;
    if (c.data !== true) { HOST_ST = { err: 'Statystyki widzi tylko konto właściciela aplikacji.' }; return render(); }
    const r = await SB.rpc('host_stats'); if (r.error) throw r.error;
    const a = await SB.rpc('admin_audit'); HOST_ST = { d: r.data, audit: a.error ? null : a.data, t: Date.now() };
  } catch (e) { HOST_ST = { err: /function|schema cache|does not exist/i.test(e.message || '') ? 'Wgraj nowy supabase.sql (Aktualizacja bazy niżej), żeby zobaczyć statystyki.' : 'Błąd: ' + (e.message || e) }; }
  render();
}
function hostStatsHTML() {
  const H = HOST_ST, d = H?.d, n = v => Number(v || 0).toLocaleString('pl');
  const tile = (v, l) => `<div><b>${n(v)}</b><small>${l}</small></div>`;
  return `<div class="card host-stats"><div class="row nowrap"><h3 class="grow" style="margin:0">📊 Statystyki aplikacji</h3><button class="sm" data-act="host-stats">🔄</button></div>
    ${!H || H.loading ? '<p class="small muted">Ładuję…</p>' : H.err ? `<p class="small muted">${esc(H.err)}</p>` : `
    <h4>👥 Konta</h4><div class="time-kpis">${tile(d.users, 'wszystkie')}${tile(d.new_today, 'nowe dziś')}${tile(d.new_7d, 'nowe 7 dni')}${tile(d.active_today, 'aktywne dziś')}</div>
    <h4>🔗 Linki do talii</h4><div class="time-kpis">${tile(d.links, 'udostępnione')}${tile(d.link_opens, 'otwarcia')}${tile(d.link_opens_today, 'otwarte dziś')}${tile(d.active_7d, 'aktywne 7 dni')}</div>
    ${H.audit ? `<h4>🛡️ Najbogatsi gracze</h4><div class="small">${(H.audit.rich || []).map(x => `<div class="row nowrap adm-row" data-act="adm-player" data-code="${esc(x.code || '')}" role="button" style="justify-content:space-between"><span>${esc(x.nick || '?')} <span class="muted">${esc(x.code || '')}</span></span><b>${n(x.gems)} 💎 · ${n(x.items)} przedm.${x.reviews != null ? ` · ${n(x.reviews)} powt.` : ''}</b>${x.code ? `<button class="sm ${x.banned ? '' : 'danger'}" data-act="host-ban" data-code="${esc(x.code)}" data-on="${x.banned ? 0 : 1}" title="${x.banned ? 'Odblokuj' : 'Wyzeruj i zablokuj kryształy/przedmioty'}">${x.banned ? '✅ Odblokuj' : '🚫 Zablokuj'}</button>` : ''}</div>`).join('') || '—'}</div>
      <p class="small muted">🚫 Zablokuj = kryształy, złoto i przedmioty gracza znikają i nie da się ich odbudować (każdy zapis jest czyszczony), dopóki nie odblokujesz.</p>
      <h4>🛡️ Kara dla gracza</h4><div class="adm-tools">
        <div class="row nowrap"><input id="adm-code" class="grow" placeholder="Kod gracza (np. A88BEB31)" maxlength="12" autocapitalize="characters" style="text-transform:uppercase;margin:0"><button class="primary" data-act="adm-show">🔎 Dane</button></div><div class="spacer"></div>
        <div class="adm-btns">${[['wallet', '💸 Zabierz kryształy i złoto'], ['items', '🎒 Zabierz przedmioty'], ['stickers', '🃏 Zabierz naklejki'], ['all', '🧹 Zabierz wszystko'],
          ['shadow', '👻 Cień (myśli, że ma)'], ['unshadow', '👻 Zdejmij cień'], ['clown', '🤡 Zrób klauna'], ['unclown', '🙂 Zdejmij klauna'], ['flip', '🙃 Ekran do góry nogami'], ['msg', '💬 Wyślij wiadomość']].map(([k, l]) => `<button class="sm${['wallet', 'items', 'stickers', 'all'].includes(k) ? ' danger' : ''}" data-act="host-act" data-k="${k}">${l}</button>`).join('')}</div>
        <p class="small muted">Stuknij gracza na liście wyżej, żeby zobaczyć jego dane i ukarać go w okienku. Zabrane rzeczy znikają też na jego telefonie przy najbliższej synchronizacji – nie da się ich odzyskać. Klaun = 🤡 przed nickiem w rankingu i czacie. 👻 Cień = gracz dalej widzi u siebie wszystko, ale w chmurze tego nie ma: inni nie widzą jego gabloty i prestiżu, a na innym urządzeniu (albo po reinstalacji) ma pusto.</p></div>
      <h4>🚨 Wykryte próby oszustwa</h4><div class="small">${(H.audit.cheats || []).map(x => `<div>${esc(x.nick || '?')}: ${esc(x.what)} <span class="muted">${new Date(x.t).toLocaleString('pl-PL')}</span></div>`).join('') || 'brak'}</div>` : ''}
    ${(d.top_links || []).length ? `<div class="small" style="margin-top:10px">${d.top_links.map(x => `<div class="row nowrap" style="justify-content:space-between"><span>${esc(x.name)}</span><b>${n(x.opens)}×</b></div>`).join('')}</div>` : ''}
    <p class="small muted" style="margin:10px 0 0">Same liczby – bez e-maili i nazw użytkowników. Odświeżone ${new Date(H.t).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}.</p>`}</div>`;
}
ROUTES.host = () => {
  if (typeof flagsLoad === 'function' && !HOST_CHK) { HOST_CHK = 1; flagsLoad(); }
  const back = `<div class="row nowrap"><button class="iconbtn" data-go="#/more">‹</button><h1 class="grow">🔑 Panel hosta</h1></div>`;
  if (!hostUnlocked()) return { tab: 'more', html: back + `<div class="card"><p class="small muted" style="margin-top:0">Panel tylko dla właściciela aplikacji. Musisz być <b>zalogowany na koncie właściciela</b> (dopisanym w bazie) i podać kod.${typeof ADMIN_ERR === 'undefined' || !ADMIN_ERR ? '' : ADMIN_ERR === 'not-logged' ? '<br><b>Najpierw zaloguj się na swoje konto</b> (Ustawienia → Konto).' : ADMIN_ERR === 'not-admin' ? '<br><b>To konto nie jest dopisane jako właściciel.</b> W Supabase → SQL Editor uruchom: <code>insert into public.app_admins select id from auth.users where email = \'TWÓJ EMAIL\';</code>' : `<br><b>Baza nie odpowiada poprawnie</b> (${esc(ADMIN_ERR)}) – wgraj nowy supabase.sql.`}<br><button class="sm" data-act="host-recheck" style="margin-top:8px">🔄 Sprawdź ponownie</button></p>
      <div class="row nowrap"><input id="host-code" class="grow" type="password" placeholder="Kod hosta" autocomplete="off" autocapitalize="off"><button class="primary" data-act="host-unlock">Odblokuj</button></div></div>` };
  const st = S.settings;
  if (!HOST_ST) hostStatsLoad();
  return { tab: 'more', html: back + hostStatsHTML() + `
    <div class="card"><h3 style="margin-top:0">Połączenie z repozytorium</h3>
      <label class="field"><span>Repozytorium (właściciel/nazwa)</span><input id="host-repo" value="${esc(hostRepo())}" autocapitalize="off"></label>
      <label class="field"><span>Token GitHub z prawem zapisu do tego repozytorium</span><input id="host-token" type="password" value="${esc(st.hostToken || '')}" placeholder="github_pat_…" autocomplete="off"></label>
      <p class="small muted">Utwórz <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">token „fine-grained”</a>:
        dostęp tylko do repozytorium <b>${esc(hostRepo())}</b>, uprawnienie <b>Contents: Read and write</b>. Token zostaje tylko na tym urządzeniu.</p>
      <button class="primary block" data-act="host-check" ${HOST_CHECK?.running ? 'disabled' : ''}>${HOST_CHECK?.running ? 'Sprawdzam…' : '✅ Sprawdź token'}</button>
      ${HOST_CHECK ? `<div class="checklist">${HOST_CHECK.res.map(x => `<div class="${x.ok ? 'c-rev' : 'c-lrn'}">${x.ok ? '✓' : '✗'} ${esc(x.text)}</div>`).join('')}</div>` : ''}</div>
    <div class="card"><h3 style="margin-top:0">☁️ Supabase (konta, ranking, bitwy)</h3>
      <p class="small muted">${typeof SB_CFG !== 'undefined' && SB_CFG ? `✓ Podłączone: <b>${esc(SB_CFG.url.replace(/^https?:\/\//, ''))}</b>${SB_CFG.local ? ' (tylko na tym urządzeniu)' : ''}` : 'Jeszcze nie podłączone.'}
        <a href="#/cloud-help">Instrukcja krok po kroku</a></p>
      <label class="field"><span>Project URL</span><input id="sb-url" placeholder="https://xxxx.supabase.co" autocapitalize="off" value="${esc(typeof SB_CFG !== 'undefined' && SB_CFG ? SB_CFG.url : '')}"></label>
      <label class="field"><span>Klucz anon / publishable</span><input id="sb-key" placeholder="eyJhbGciOi… lub sb_publishable_…" autocapitalize="off" autocomplete="off"></label>
      <div class="row"><button class="primary grow" data-act="host-sb-save">💾 Zapisz dla wszystkich</button><button class="grow" data-act="host-sb-local">Tylko to urządzenie</button></div>
      <p class="small muted">Nie wklejaj klucza <b>service_role / secret</b> – on daje pełny dostęp do bazy.</p></div>
    <div class="card"><h3 style="margin-top:0">🎬 GIF-y dla wszystkich</h3>
      <p class="small muted">Wgrany GIF zobaczą wszyscy, którzy nie ustawili własnego. Po wgraniu GitHub Pages potrzebuje ok. 1–2 minut na publikację.</p>
      ${Object.entries(REACT_SLOTS).map(([k, sl]) => { const g = globalSrcs(k); return `<div class="sndrow"><div class="row nowrap">
          <img class="rx-thumb" src="${g[0] || REACT_DEFAULT}" data-alt="${esc(JSON.stringify([...g.slice(1), REACT_DEFAULT]))}" alt="">
          <b class="grow">${sl.name}<br><small class="muted">${GLOBAL_RX[k]?.path ? 'globalny: ' + esc(GLOBAL_RX[k].name || '') : 'domyślny kot'}</small>
</b></div>
        <div class="row"><button class="sm primary" data-act="host-upload" data-k="${k}">📤 Wgraj dla wszystkich</button>
          ${GLOBAL_RX[k]?.path ? `<button class="sm" data-act="rx-test" data-k="${k}">▶ Podgląd</button><button class="sm ghost" data-act="host-clear" data-k="${k}">Przywróć kota</button>` : ''}</div></div>`; }).join('')}
    </div>
    ${betaCardHTML()}
    <div class="card"><h3 style="margin-top:0">🎞️ Skrzynka z GIF-ami</h3>
      <p class="small muted">Dodaj GIF-y, które gracze mogą wylosować (skrzynka pojawi się w sklepie, gdy będzie choć jeden). Rzadkość decyduje o szansie:
        ${Object.entries(CASES.gif.odds).map(([r, p]) => `<span style="color:${RARITY[r].color}">${RARITY[r].name} ${p}%</span>`).join(' · ')}. Duplikat zamienia się w kryształy.</p>
      <div class="gifgrid">${(typeof GIF_CASE !== 'undefined' ? GIF_CASE : []).map(g => `<div class="gifitem" style="--rc:${RARITY[g.r || 'common'].color}">${gifImg(g)}
        <small><b>${esc(g.name || 'GIF')}</b></small>
        <div class="row nowrap"><select class="grow" data-gcr="${g.id}">${Object.entries(RARITY).map(([r, x]) => `<option value="${r}" ${(g.r || 'common') === r ? 'selected' : ''}>${x.name}</option>`).join('')}</select>
          <button class="sm ghost" data-act="host-gc-del" data-id="${g.id}" title="Usuń ze skrzynki">🗑</button></div></div>`).join('') || '<p class="small muted">Jeszcze pusto.</p>'}</div>
      <div class="spacer"></div>
      <div class="row nowrap"><input id="gc-name" class="grow" placeholder="Nazwa GIF-a, np. Tańczący kot" maxlength="40">
        <select id="gc-r">${Object.entries(RARITY).map(([r, x]) => `<option value="${r}">${x.name}</option>`).join('')}</select></div>
      <div class="spacer"></div>
      <button class="primary block" data-act="host-gc-add">📤 Dodaj GIF do skrzynki</button></div>
    <div class="card"><h3 style="margin-top:0">🧪 Testowa skrzynka</h3>
      <p class="small muted">Pokaz otwierania – bez kosztu kryształów, nic nie trafia do albumu. Możesz wymusić rzadkość, np. legendarną.</p>
      <label class="field"><span>Wylosuj</span><select id="host-case-r"><option value="">losowo (normalne szanse)</option>${Object.entries(RARITY).map(([r, x]) => `<option value="${r}">Naklejka: ${x.name}</option>`).join('')}<option value="gems">💎 Kryształy</option><option value="jackpot">💰 Jackpot 1000 💎</option><option value="mega">🔴 Mega 10 000 💎 (0,1%)</option><option value="lgif">🎞️ GIF legendarny</option><option value="respin">🔁 Losuj jeszcze raz</option></select></label>
      <div class="cases">${Object.entries(CASES).map(([k, c]) => `<button class="case ${k}" data-act="host-test-case" data-k="${k}"><div class="ci">${c.icon}</div><b>${c.name}</b><small>🧪 testowo</small></button>`).join('')}</div></div>
    <button class="ghost" data-act="host-lock">Zablokuj panel na tym urządzeniu</button>` };
};
document.addEventListener('change', e => {
  if (e.target.id === 'host-token' || e.target.id === 'host-repo') { syncHostFields(); HOST_CHECK = null; }
  if (e.target.dataset?.gcr && hostUnlocked()) (async () => {   // zmiana rzadkości GIF-a
    try {
      const { sha, data } = await readGlobalJson(), g = (data.gifCase || []).find(x => x.id === e.target.dataset.gcr); if (!g) return;
      g.r = e.target.value; await writeGlobalJson(data, sha, `Skrzynka GIF: rzadkość ${g.name}`); GIF_CASE = data.gifCase; toast('Zapisano rzadkość ✓');
    } catch (err) { toast('Błąd: ' + err.message, 5000); }
  })();
});
const readB64 = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });

Object.assign(ACTIONS, {
  'host-stats': () => hostStatsLoad(),
  'host-test-case': el => { if (!hostUnlocked()) return; const r = $('#host-case-r')?.value; SPIN = null; go(`#/case/${el.dataset.k}?test=1${r ? '&r=' + r : ''}`); },
  'host-unlock': async () => {
    const ok = (await sha256($('#host-code').value.trim())) === HOST_HASH;
    if (!ok) return toast('Nieprawidłowy kod hosta');
    try { localStorage.setItem('hostOK', HOST_HASH); } catch { /* */ }
    toast(typeof IS_ADMIN !== 'undefined' && IS_ADMIN ? 'Panel hosta odblokowany ✓' : 'Kod poprawny – ale to konto nie jest potwierdzone jako właściciel (patrz opis niżej)', 4000); HOST_CHK = 0; render();
  },
  'host-check': () => checkHostToken(),
  'host-sb-save': async () => {
    const cfg = readSbFields(); if (!cfg) return;
    syncHostFields(); if (!S.settings.hostToken) return toast('Najpierw wklej token GitHub (wyżej) – potrzebny do zapisu dla wszystkich');
    try {
      toast('Zapisuję…', 20000);
      const f = await ghRepo('assets/config.json');
      const data = { ...(f ? JSON.parse(utf8b64(f.content)) : {}), supabaseUrl: cfg.url, supabaseAnonKey: cfg.key, updated: Date.now() };
      await ghRepo('assets/config.json', { method: 'PUT', body: JSON.stringify({ message: 'Konfiguracja Supabase', content: b64utf8(JSON.stringify(data, null, 2)), ...(f ? { sha: f.sha } : {}) }) });
      delete S.settings.sbUrl; delete S.settings.sbKey; save();
      toast('Zapisano ✓ Łączę… (u innych po odświeżeniu aplikacji)', 5000); await initCloud(); render();
    } catch (e) { toast('Błąd: ' + e.message, 5000); }
  },
  'host-sb-local': async () => { const cfg = readSbFields(); if (!cfg) return; S.settings.sbUrl = cfg.url; S.settings.sbKey = cfg.key; save(); await initCloud(); toast(SB ? 'Połączono ✓' : 'Nie udało się połączyć'); render(); },
  'host-lock': () => { try { localStorage.removeItem('hostOK'); } catch { /* */ } render(); },
  'host-upload': async el => {
    const k = el.dataset.k;
    syncHostFields();
    if (!S.settings.hostToken) return toast('Najpierw wklej token GitHub');
    const f = await pickFile('image/gif,image/webp,image/png,image/jpeg,image/*'); if (!f) return;
    if (f.size > 8e6) return toast('Plik jest za duży (max 8 MB) – wszyscy będą go pobierać');
    try {
      toast('Wysyłam do GitHub…', 30000);
      const ext = (f.name.split('.').pop() || 'gif').toLowerCase().replace(/[^a-z0-9]/g, '') || 'gif', t = Date.now();
      const path = `assets/global/${k}-${t}.${ext}`;
      await ghRepo(path, { method: 'PUT', body: JSON.stringify({ message: `Globalny GIF reakcji: ${k}`, content: await readB64(f) }) });
      const { sha, data } = await readGlobalJson();
      data.reactions = data.reactions || {}; data.reactions[k] = { path, name: f.name, t };
      await writeGlobalJson(data, sha, `Ustaw globalny GIF: ${k}`);
      GLOBAL_RX = data.reactions; GLOBAL_PREVIEW[k] = URL.createObjectURL(f); render();
      toast('Gotowe ✓ Wszyscy zobaczą nowy GIF po ok. 1–2 min (po odświeżeniu aplikacji)', 5000);
    } catch (e) { toast('Błąd: ' + e.message, 5000); }
  },
  'host-gc-add': async () => {
    syncHostFields(); if (!S.settings.hostToken) return toast('Najpierw wklej token GitHub (wyżej)');
    const name = ($('#gc-name').value || '').trim().slice(0, 40), r = $('#gc-r').value || 'common';
    const f = await pickFile('image/gif,image/webp,image/png,image/jpeg,image/*'); if (!f) return;
    if (f.size > 8e6) return toast('Plik jest za duży (max 8 MB) – wszyscy będą go pobierać');
    try {
      toast('Wysyłam do GitHub…', 30000);
      const ext = (f.name.split('.').pop() || 'gif').toLowerCase().replace(/[^a-z0-9]/g, '') || 'gif', t = Date.now(), id = 'g' + t.toString(36);
      const path = `assets/gifcase/${id}.${ext}`;
      await ghRepo(path, { method: 'PUT', body: JSON.stringify({ message: `Skrzynka GIF: ${name || f.name}`, content: await readB64(f) }) });
      const { sha, data } = await readGlobalJson();
      data.gifCase = [...(data.gifCase || []), { id, name: name || f.name.replace(/\.[^.]+$/, ''), path, r, t }];
      await writeGlobalJson(data, sha, `Skrzynka GIF: dodaj ${name || f.name}`);
      GIF_CASE = data.gifCase; GIFCASE_PREVIEW[id] = URL.createObjectURL(f); render();
      toast('Dodano ✓ Gracze zobaczą GIF po ok. 1–2 min (po odświeżeniu)', 5000);
    } catch (e) { toast('Błąd: ' + e.message, 5000); }
  },
  'host-gc-del': async el => {
    const g = GIF_CASE.find(x => x.id === el.dataset.id); if (!g || !confirm(`Usunąć „${g.name}” ze skrzynki? (kto go już ma – zachowa w kolekcji tylko, jeśli GIF wróci)`)) return;
    try {
      const { sha, data } = await readGlobalJson(); data.gifCase = (data.gifCase || []).filter(x => x.id !== g.id);
      await writeGlobalJson(data, sha, `Skrzynka GIF: usuń ${g.name}`); GIF_CASE = data.gifCase; render(); toast('Usunięto ✓');
    } catch (e) { toast('Błąd: ' + e.message, 5000); }
  },
  'host-clear': async el => {
    const k = el.dataset.k; if (!confirm('Przywrócić domyślnego kota dla wszystkich?')) return;
    try {
      const { sha, data } = await readGlobalJson(); delete data.reactions?.[k];
      await writeGlobalJson(data, sha, `Usuń globalny GIF: ${k}`); GLOBAL_RX = data.reactions || {}; render(); toast('Przywrócono ✓');
    } catch (e) { toast('Błąd: ' + e.message, 5000); }
  },
});
document.addEventListener('input', e => { if (e.target.id === 'host-token') S.settings.hostToken = e.target.value.trim().replace(/\s+/g, ''); });

function readSbFields() {
  const url = ($('#sb-url')?.value || '').trim().replace(/\/+$/, ''), key = ($('#sb-key')?.value || '').trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url)) { toast('URL ma wyglądać jak https://xxxx.supabase.co'); return null; }
  if (key.length < 20) { toast('Wklej klucz anon / publishable'); return null; }
  if (/service_role|sb_secret_/.test(key) || (() => { try { return JSON.parse(atob(key.split('.')[1])).role === 'service_role'; } catch { return false; } })()) {
    toast('To klucz service_role/secret – NIE wklejaj go! Użyj klucza anon/publishable.', 6000); return null; }
  return { url, key };
}

// ---------- 🧪 Beta – testy dźwięków i efektów (nic nie zmienia w danych)
const BETA_FX = {
  'case-open': ['📦 Otwarcie skrzynki', () => CASE_SFX.open()],
  'case-ticks': ['🎰 Stukanie ruletki', () => { for (let i = 0; i < 14; i++) setTimeout(() => CASE_SFX.tick(i), i * (60 + i * 9)); }],
  'rev-common': ['🔵 Wygrana: zwykła', () => CASE_SFX.reveal('common')],
  'rev-rare': ['🟣 Wygrana: rzadka', () => CASE_SFX.reveal('rare')],
  'rev-epic': ['🩷 Wygrana: epicka', () => CASE_SFX.reveal('epic')],
  'rev-legendary': ['🟡 Wygrana: legendarna', () => CASE_SFX.reveal('legendary')],
  'msg': ['💬 Nowa wiadomość', () => { tick(988, .12, .1); setTimeout(() => tick(1319, .18, .1), 110); }],
  'right': ['✅ Dobra odpowiedź', () => tick(1320, .08, .08)],
  'wrong': ['❌ Zła odpowiedź', () => tick(220, .15, .1)],
};
const BETA_VIS = {
  confetti: ['🎊 Konfetti', () => confetti(150)],
  celebrate: ['🏆 Osiągnięcie', () => celebrate('💀 🗂️ Komplet albumu', 'Zdobądź wszystkie naklejki · +150 💎')],
  level: ['⭐ Nowy poziom', () => celebrate('⭐ Poziom 7!', levelTitle(7))],
  xp: ['+XP nad kartą', () => floatText('+3 XP  🔥×10', true)],
  rxwin: ['🏆 GIF: wygrana', () => showReaction('win', true)],
  rxsession: ['✅ GIF: zestaw', () => showReaction('session', true)],
  rxgoal: ['🎯 GIF: cel dnia', () => showReaction('goal', true)],
  popup: ['🔔 Powiadomienie', () => typeof msgPopup === 'function' ? msgPopup({ id: 0, kind: 'nudge', from_id: 'x', body: {} }, '🔔 Kolega przypomina o nauce', 'Czas na fiszki! 📚') : toast('Brak modułu wiadomości')],
  toast: ['💬 Dymek (toast)', () => toast('To jest przykładowy komunikat ✓', 3000)],
};
function betaCardHTML() {
  const btn = (k, [l]) => `<button class="sm" data-act="beta" data-k="${k}">${l}</button>`;
  return `<details class="card beta"><summary><h3 style="margin:0;display:inline">🧪 Beta – testy dźwięków i efektów</h3></summary>
    <p class="small muted">Podgląd bez grania – nic nie zapisuje się na koncie. Dźwięki grają także przy wyciszonych dźwiękach naklejek.</p>
    <h4>🔊 Skrzynki i aplikacja</h4><div class="beta-row">${Object.entries(BETA_FX).map(([k, v]) => btn(k, v)).join('')}</div>
    <h4>🐐 Dźwięki naklejek <small class="muted">(z animacją)</small></h4>
    <div class="beta-row st">${STICKERS.map(x => `<button class="sm beta-st" data-act="beta-st" data-id="${x.id}" title="${esc(x.name)}" style="--rc:${RARITY[x.r].color}">${stE(x)}</button>`).join('')}</div>
    <h4>✨ Efekty na ekranie</h4><div class="beta-row">${Object.entries(BETA_VIS).map(([k, v]) => btn(k, v)).join('')}</div></details>`;
}
Object.assign(ACTIONS, {
  beta: el => {
    const f = BETA_FX[el.dataset.k] || BETA_VIS[el.dataset.k]; if (!f) return;
    // dźwięki testowe grają nawet przy wyłączonych dźwiękach naklejek, ale nie przy całkowicie wyłączonym dźwięku
    if (S.settings.sound === false && BETA_FX[el.dataset.k]) return toast('Dźwięki są wyłączone w Ustawieniach → Personalizacja');
    if (typeof fxUnlock === 'function') fxUnlock();
    try { f[1](); } catch (e) { toast('Błąd: ' + e.message, 4000); }
  },
  'beta-st': el => {
    if (typeof fxUnlock === 'function') fxUnlock();
    const keep = S.settings.stickerSound; S.settings.stickerSound = true;
    try { stickerFx(el.dataset.id, 'Test', false); } finally { S.settings.stickerSound = keep; }
  },
});

// 🔎 okienko z danymi gracza + kary (tylko właściciel; dane z funkcji admin_player)
const ADM_KIND = { sticker: '🃏 naklejki', gear: '⚔️ ekwipunek', potion: '🧪 mikstury', boost: '⚡ boostery', forgemat: '🧱 cegły', egg: '🥚 jajka', case: '📦 skrzynki', gif: '🎞️ GIF-y', cos: '👑 prestiż' };
async function admPlayerPopup(code) {
  document.querySelector('.adm-pop')?.remove(); const ov = document.createElement('div'); ov.className = 'dmenu-ov adm-pop';
  ov.innerHTML = '<div class="dmenu"><p class="muted center">Ładuję dane gracza…</p></div>'; document.body.append(ov);
  ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-x]')) ov.remove(); });
  const r = await SB.rpc('admin_player', { p_code: code });
  const box = ov.querySelector('.dmenu'); if (!box) return;
  if (r.error) { box.innerHTML = `<p>${/function|schema cache|does not exist/i.test(r.error.message || '') ? 'Wgraj nowy supabase.sql (Aktualizacja bazy).' : 'Błąd: ' + esc(r.error.message)}</p><button class="ghost" data-x="1">Zamknij</button>`; return; }
  const p = r.data || {}, st = p.stats || {}, n = v => Number(v || 0).toLocaleString('pl'), dt = t => t ? new Date(t).toLocaleString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const kv = (l, v) => `<div class="kv"><span>${l}</span><b>${v}</b></div>`;
  const sus = p.gems > 50000 + 100 * (p.reviews || 0);
  box.innerHTML = `<div class="row nowrap" style="gap:12px">${typeof avatarHTML === 'function' ? avatarHTML({ avatar: p.avatar, avatarImg: p.avatar_img, cos: st.cos }, 56) : ''}<div class="grow"><b style="font-size:19px">${esc(p.nick || '?')}</b><div class="small muted">${esc(p.code || '')}${p.banned ? ' · 🚫 zablokowany' : ''}${p.clown ? ' · 🤡 klaun' : ''}${p.shadow ? ' · 👻 cień' : ''}</div></div></div>
    ${sus ? '<div class="banner" style="margin-top:12px">⚠️ Podejrzane: dużo kryształów przy małej liczbie powtórek</div>' : ''}
    <div class="adm-data">
      ${kv('💎 Kryształy + złoto', n(p.gems))}${kv('Wpisów w portfelu / największy', `${n(p.wallet_n)} / ${n(p.biggest)}`)}
      ${kv('🔁 Powtórki', n(p.reviews))}${kv('🃏 Fiszki / talie', `${n(p.cards)} / ${n(p.decks)}`)}
      ${kv('⭐ Poziom / Elo', `${n(st.level)} / ${n(st.elo || 1000)}`)}${kv('🔥 Seria dni', n(st.streak))}
      ${Object.entries(p.items || {}).map(([k, v]) => kv(ADM_KIND[k] || k, n(v))).join('')}
      ${kv('Konto od', dt(p.created))}${kv('Ostatnia synchronizacja', dt(p.synced))}
    </div>
    ${(p.log || []).length ? `<b class="small">🚨 Dziennik</b><div class="small adm-log">${p.log.map(x => `<div>${esc(x.what)} <span class="muted">${dt(x.t)}</span></div>`).join('')}</div>` : ''}
    ${(p.actions || []).length ? `<b class="small">🛡️ Twoje kary</b><div class="small adm-log">${p.actions.map(x => `<div>${esc(x.what)}${x.msg ? ': „' + esc(x.msg) + '”' : ''} <span class="muted">${dt(x.t)}</span></div>`).join('')}</div>` : ''}
    <div class="adm-btns">${[['wallet', '💸 Zabierz kryształy'], ['items', '🎒 Zabierz przedmioty'], ['stickers', '🃏 Zabierz naklejki'], ['all', '🧹 Zabierz wszystko'],
      p.shadow ? ['unshadow', '👻 Zdejmij cień'] : ['shadow', '👻 Cień (myśli, że ma)'], p.clown ? ['unclown', '🙂 Zdejmij klauna'] : ['clown', '🤡 Zrób klauna'], ['flip', '🙃 Do góry nogami'], ['msg', '💬 Wiadomość']].map(([k, l]) => `<button class="sm${['wallet', 'items', 'stickers', 'all'].includes(k) ? ' danger' : ''}" data-act="host-act" data-k="${k}" data-code="${esc(p.code)}">${l}</button>`).join('')}
      <button class="sm ${p.banned ? '' : 'danger'}" data-act="host-ban" data-code="${esc(p.code)}" data-on="${p.banned ? 0 : 1}">${p.banned ? '✅ Odblokuj' : '🚫 Zablokuj'}</button></div>
    <button class="ghost" data-x="1">Zamknij</button>`;
}

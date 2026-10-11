'use strict';
/* Panel hosta: po wpisaniu kodu hosta właściciel aplikacji może wgrać GIF-y reakcji, które dostaną wszyscy użytkownicy.
   Plik trafia do repozytorium na GitHubie (assets/global/…) razem z listą assets/global.json – GitHub Pages
   udostępnia je każdemu, a aplikacja wczytuje przy starcie. Zapis wymaga tokenu GitHub z prawem zapisu do repozytorium,
   więc nawet ktoś, kto pozna kod, nie podmieni plików bez tokenu właściciela. */

const HOST_HASH = 'c445ae5875d6a31cad713ed08ef1597bb31c4a818192671d1bc6774d80424209';   // SHA-256 kodu hosta
const sha256 = async t => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map(b => b.toString(16).padStart(2, '0')).join('');
const hostUnlocked = () => { try { return localStorage.getItem('hostOK') === HOST_HASH; } catch { return false; } };
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

ROUTES.host = () => {
  const back = `<div class="row nowrap"><button class="iconbtn" data-go="#/more">‹</button><h1 class="grow">🔑 Panel hosta</h1></div>`;
  if (!hostUnlocked()) return { tab: 'more', html: back + `<div class="card"><p class="small muted" style="margin-top:0">Panel dla właściciela aplikacji – ustawianie GIF-ów dla wszystkich użytkowników.</p>
      <div class="row nowrap"><input id="host-code" class="grow" type="password" placeholder="Kod hosta" autocomplete="off" autocapitalize="off"><button class="primary" data-act="host-unlock">Odblokuj</button></div></div>` };
  const st = S.settings;
  return { tab: 'more', html: back + `
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
          <img class="rx-thumb" src="${g[0] || REACT_DEFAULT}" data-alt="${esc(JSON.stringify([...g.slice(1), REACT_DEFAULT]))}" onerror="rxFallback(this)" alt="">
          <b class="grow">${sl.name}<br><small class="muted">${GLOBAL_RX[k]?.path ? 'globalny: ' + esc(GLOBAL_RX[k].name || '') : 'domyślny kot'}</small>
          ${RX[k] ? '<br><small class="c-hard">Na tym urządzeniu masz własny GIF – zasłania GIF hosta (Więcej → Reakcje → „Użyj GIF-a hosta”)</small>' : ''}</b></div>
        <div class="row"><button class="sm primary" data-act="host-upload" data-k="${k}">📤 Wgraj dla wszystkich</button>
          ${GLOBAL_RX[k]?.path ? `<button class="sm" data-act="rx-test" data-k="${k}">▶ Podgląd</button><button class="sm ghost" data-act="host-clear" data-k="${k}">Przywróć kota</button>` : ''}</div></div>`; }).join('')}
    </div>
    <div class="card"><h3 style="margin-top:0">🧪 Testowa skrzynka</h3>
      <p class="small muted">Pokaz otwierania – bez kosztu kryształów, nic nie trafia do albumu. Możesz wymusić rzadkość, np. legendarną.</p>
      <label class="field"><span>Wylosuj</span><select id="host-case-r"><option value="">losowo (normalne szanse)</option>${Object.entries(RARITY).map(([r, x]) => `<option value="${r}">Naklejka: ${x.name}</option>`).join('')}<option value="gems">💎 Kryształy</option><option value="respin">🔁 Losuj jeszcze raz</option></select></label>
      <div class="cases">${Object.entries(CASES).map(([k, c]) => `<button class="case ${k}" data-act="host-test-case" data-k="${k}"><div class="ci">${c.icon}</div><b>${c.name}</b><small>🧪 testowo</small></button>`).join('')}</div></div>
    <button class="ghost" data-act="host-lock">Zablokuj panel na tym urządzeniu</button>` };
};
document.addEventListener('change', e => {
  if (e.target.id === 'host-token' || e.target.id === 'host-repo') { syncHostFields(); HOST_CHECK = null; }
});
const readB64 = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });

Object.assign(ACTIONS, {
  'host-test-case': el => { if (!hostUnlocked()) return; const r = $('#host-case-r')?.value; SPIN = null; go(`#/case/${el.dataset.k}?test=1${r ? '&r=' + r : ''}`); },
  'host-unlock': async () => {
    const ok = (await sha256($('#host-code').value.trim())) === HOST_HASH;
    if (!ok) return toast('Nieprawidłowy kod hosta');
    try { localStorage.setItem('hostOK', HOST_HASH); } catch { /* */ }
    toast('Panel hosta odblokowany ✓'); render();
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

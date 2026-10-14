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
    <div class="card row nowrap sh-cta" data-act="show-open"><span style="font-size:38px">🎤</span><div class="grow"><b>Teleturniej <small class="beta-tag">BETA</small></b>
      <div class="small muted">Fiszkowy Show w stylu Buzz! – 4 rundy, Ty kontra boty, pytania z Twojej talii</div></div><span style="font-size:22px">›</span></div>
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
      <label class="field"><span>Wylosuj</span><select id="host-case-r"><option value="">losowo (normalne szanse)</option>${Object.entries(RARITY).map(([r, x]) => `<option value="${r}">Naklejka: ${x.name}</option>`).join('')}<option value="gems">💎 Kryształy</option><option value="respin">🔁 Losuj jeszcze raz</option></select></label>
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
    <div class="beta-row st">${STICKERS.map(x => `<button class="sm beta-st" data-act="beta-st" data-id="${x.id}" title="${esc(x.name)}" style="--rc:${RARITY[x.r].color}">${x.e}</button>`).join('')}</div>
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

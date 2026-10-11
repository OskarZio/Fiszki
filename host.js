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
  if (!r.ok) throw new Error(r.status === 401 ? 'zły token' : r.status === 403 || r.status === 404 ? 'token nie ma prawa zapisu do repozytorium' : 'GitHub ' + r.status);
  return r.json();
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
        dostęp tylko do repozytorium <b>${esc(hostRepo())}</b>, uprawnienie <b>Contents: Read and write</b>. Token zostaje tylko na tym urządzeniu.</p></div>
    <div class="card"><h3 style="margin-top:0">🎬 GIF-y dla wszystkich</h3>
      <p class="small muted">Wgrany GIF zobaczą wszyscy, którzy nie ustawili własnego. Po wgraniu GitHub Pages potrzebuje ok. 1–2 minut na publikację.</p>
      ${Object.entries(REACT_SLOTS).map(([k, sl]) => `<div class="sndrow"><div class="row nowrap"><img class="rx-thumb" src="${GLOBAL_RX[k]?.path ? GLOBAL_RX[k].path + '?v=' + GLOBAL_RX[k].t : REACT_DEFAULT}" alt="">
          <b class="grow">${sl.name}<br><small class="muted">${GLOBAL_RX[k]?.path ? 'globalny: ' + esc(GLOBAL_RX[k].name || '') : 'domyślny kot'}</small></b></div>
        <div class="row"><button class="sm primary" data-act="host-upload" data-k="${k}">📤 Wgraj dla wszystkich</button>
          ${GLOBAL_RX[k]?.path ? `<button class="sm ghost" data-act="host-clear" data-k="${k}">Przywróć kota</button>` : ''}</div></div>`).join('')}
    </div>
    <button class="ghost" data-act="host-lock">Zablokuj panel na tym urządzeniu</button>` };
};
document.addEventListener('change', e => {
  if (e.target.id === 'host-token') { S.settings.hostToken = e.target.value.trim(); save(); }
  if (e.target.id === 'host-repo') { S.settings.hostRepo = e.target.value.trim(); save(); }
});
const readB64 = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });

Object.assign(ACTIONS, {
  'host-unlock': async () => {
    const ok = (await sha256($('#host-code').value.trim())) === HOST_HASH;
    if (!ok) return toast('Nieprawidłowy kod hosta');
    try { localStorage.setItem('hostOK', HOST_HASH); } catch { /* */ }
    toast('Panel hosta odblokowany ✓'); render();
  },
  'host-lock': () => { try { localStorage.removeItem('hostOK'); } catch { /* */ } render(); },
  'host-upload': async el => {
    const k = el.dataset.k;
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
      GLOBAL_RX = data.reactions; render();
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

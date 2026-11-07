// Offline: aplikacja działa bez internetu. Zmień numer wersji przy każdej aktualizacji plików.
const CACHE = 'fiszki-v333';
const ASSETS = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

// ⚡ szybki start: przy instalacji nowej wersji pobieramy od razu cały kod (skrypty z index.html),
// potem kod idzie z pamięci (bez ~60 zapytań do serwera przy każdym uruchomieniu). Nowa wersja = nowy sw.js = nowy CACHE.
// Grafiki leżą w osobnej, trwałej pamięci (nie pobieramy ich od nowa przy każdej aktualizacji) i odświeżają się w tle.
const ACACHE = 'fiszki-assets';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(ASSETS);
    try {
      const html = await (await fetch('index.html', { cache: 'no-cache' })).text();
      const code = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]).filter(u => !/^https?:/.test(u));
      await c.addAll(code.map(u => new Request(u, { cache: 'no-cache' })));
    } catch { /* bez sieci – dociągnie się przy użyciu */ }
  }).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== ACACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
  setTimeout(precacheIcons, 3000);   // ⚡ w tle: ikony i postacie trafiają do pamięci, zanim będą potrzebne
});
async function precacheIcons() {
  try {
    const list = await (await fetch('assets/precache.json', { cache: 'no-cache' })).json(), c = await caches.open(ACACHE), base = self.registration.scope;
    for (let i = 0; i < list.length; i += 6) await Promise.all(list.slice(i, i + 6).map(async p => {
      const key = new URL(p, base).href; if (await c.match(key)) return;
      try { const r = await fetch(key); if (r.ok) await c.put(key, r); } catch { /* */ } }));
  } catch { /* bez sieci – spróbujemy przy następnej aktualizacji */ }
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // grafiki, czcionki, dźwięki: od razu z pamięci, a w tle sprawdzamy, czy na serwerze nie ma nowszej wersji pliku
  if (/\/(assets|icons|vendor)\//.test(url.pathname) && !/\.(txt|json)$/.test(url.pathname)) {
    const key = url.origin + url.pathname;
    e.respondWith(caches.open(ACACHE).then(async c => {
      const hit = await c.match(key);
      const net = fetch(e.request).then(res => { if (res.ok) c.put(key, res.clone()); return res; }).catch(() => hit || Response.error());
      if (hit) { e.waitUntil(net.then(() => {}, () => {})); return hit; }
      return net;
    }));
    return;
  }
  // kod aplikacji (js/css) tej wersji: z pamięci, a gdy go brak – z sieci
  // strona startowa tej wersji też z pamięci (kod i strona zawsze z tej samej wersji); nowa wersja przychodzi z nowym sw.js
  if (e.request.mode === 'navigate') {
    e.respondWith(caches.open(CACHE).then(async c => (await c.match('index.html')) || fetch(e.request)).catch(() => fetch(e.request)));
    return;
  }
  if (/\.(js|css)$/.test(url.pathname) && !url.searchParams.has('t')) {
    e.respondWith(caches.open(CACHE).then(async c => (await c.match(url.origin + url.pathname)) || fetch(e.request, { cache: 'no-cache' }).then(res => {
      if (res.ok) c.put(url.origin + url.pathname, res.clone()); return res; })));
    return;
  }
  // strona i dane (json): najpierw sieć (świeże), bez internetu – kopia
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(url.search ? url.origin + url.pathname : e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});

// Kliknięcie w powiadomienie (np. nowa wiadomość od znajomego) otwiera aplikację na czacie
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '#/', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const c = list[0];
    if (c) { c.navigate ? c.navigate(url).catch(() => {}) : null; return c.focus(); }
    return self.clients.openWindow(url);
  }));
});

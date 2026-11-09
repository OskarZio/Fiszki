'use strict';
/* 📥 Pakiety fiszek: gotowa talia w prostym tekście – np. przygotowana przez Claude ze zdjęć slajdów / notatek.
   Format (jedna fiszka w linii, separator „ | ”):
     #fiszki
     #talia: Anatomia – kończyna dolna
     #przedmiot: medycyna            (opcjonalnie – podpowiada metody nauki)
     #odwrotne: tak                   (opcjonalnie – ucz się w obie strony)
     Pytanie | Odpowiedź | skojarzenie (opcjonalnie)
     Zdanie z {{c1::luką}} i {{c2::drugą luką}}
   Linie zaczynające się od „//” to komentarze. Import przez: Dodaj → 📥 Pakiet, link #/import?f=assets/imports/plik.txt
   albo wklejenie tekstu. Duplikaty (ta sama strona przednia w tej talii) są pomijane. */

const PACK_IMG_RE = /\[\s*obraz\s*:\s*([^\]]+)\]/gi, PACK_IMG_OK = /^assets\/[\w\-\/.]+\.(webp|png|jpe?g)$/i;
// pobiera obrazek pakietu (ta sama strona) i zapisuje go jak zdjęcie fiszki
async function packImage(src) { try { const r = await fetch(src); if (!r.ok) return null; const b = await r.blob();
  const url = await new Promise((ok, no) => { const f = new FileReader(); f.onload = () => ok(f.result); f.onerror = no; f.readAsDataURL(b); }); return await putImage(url); } catch { return null; } }
function parsePack(text) {
  const out = { deck: '', subject: '', reverse: false, items: [], bad: 0, loose: [] };
  for (let line of String(text || '').split(/\r?\n/)) {
    line = line.trim(); if (!line || line.startsWith('//')) continue;
    const h = line.match(/^#\s*(talia|deck|przedmiot|subject|odwrotne|reverse)\s*:\s*(.+)$/i);
    if (h) { const k = h[1].toLowerCase(), v = h[2].trim(); if (/talia|deck/.test(k)) out.deck = v.slice(0, 80); else if (/przedmiot|subject/.test(k)) out.subject = v.slice(0, 40); else out.reverse = /^(tak|yes|1|true)/i.test(v); continue; }
    if (line.startsWith('#')) continue;
    line = line.replace(/^(\d+[.)]|[-•*])\s+/, '');
    if (/\{\{c\d+::/.test(line)) { out.items.push({ cloze: line.slice(0, 4000) }); continue; }
    let parts = line.split(/\s+\|\s+|\t/);
    if (parts.length < 2) { const m = line.match(/^(.+?)\s+[-–—]\s+(.+)$/); if (m) parts = [m[1], m[2]]; }   // eksport Quizletu z „ - ” jako separatorem
    if (parts.length < 2 || !parts[0].trim() || !parts[1].trim()) { out.bad++; out.loose.push(line); continue; }
    // kolumna z błędnymi odpowiedziami ABCD: „✗ źle1; źle2; źle3” (albo „źle: …”) – w dowolnym miejscu po odpowiedzi
    const wi = parts.findIndex((x, i) => i >= 2 && /^\s*(✗|źle\s*:|zle\s*:|wrong\s*:)/i.test(x)), wrong = wi >= 0 ? parts[wi].replace(/^\s*(✗|źle\s*:|zle\s*:|wrong\s*:)\s*/i, '').trim().slice(0, 600) : '';
    const hint = (parts.find((x, i) => i >= 2 && i !== wi) || '').trim().slice(0, 1000);
    // obrazek z tej samej strony: „[obraz: assets/…/plik.webp]” na przodzie i/lub na tyle fiszki
    const takeImg = t => { let src = ''; t = t.replace(PACK_IMG_RE, (m, u) => { if (!src && PACK_IMG_OK.test(u.trim())) src = u.trim(); return ''; }).trim(); return [t, src]; };
    const [front, img] = takeImg(parts[0].trim()), [back, bimg] = takeImg(parts[1].trim());
    if (!front && !img) { out.bad++; continue; }
    out.items.push({ front: front.slice(0, 2000), back: back.replace(/\\n/g, '\n').slice(0, 2000), hint, ...(wrong ? { wrong } : {}), ...(img ? { img } : {}), ...(bimg ? { bimg } : {}) });
  }
  // skopiowana lista ze strony Quizletu: pojęcie i definicja w kolejnych liniach, bez separatora
  const QL_NOISE = /^(pojęcia w tym zestawie|terms in this set|\d+\s*\/\s*\d+|ucz się|fiszki|test|dopasowania|zagraj|udostępnij|zapisz|flashcards|learn|match|share|save)\b/i;
  const loose = out.loose.filter(l => !QL_NOISE.test(l));
  if (!out.items.length && loose.length >= 2) { for (let i = 0; i + 1 < loose.length; i += 2) out.items.push({ front: loose[i].slice(0, 2000), back: loose[i + 1].slice(0, 2000), hint: '' }); out.paired = true; out.bad = loose.length % 2; }
  return out;
}
function importPack(P) {
  if (!P.items.length) return toast('Brak fiszek do zaimportowania');
  const name = P.deck || 'Nowa talia';
  const d = S.decks.find(x => x.name.trim().toLowerCase() === name.toLowerCase()) || newDeck(name);
  if (P.subject && !d.subject) { d.subject = P.subject; touch(d); }
  const have = new Set(S.notes.filter(n => n.deckId === d.id).map(n => ((n.type === 'cloze' ? n.text : n.front).trim() + (n.imgSrc ? ' ' + n.imgSrc : '')).toLowerCase()));
  const imgJobs = [];
  let n = 0, skip = 0;
  for (const x of P.items) {
    const key = ((x.cloze || x.front).trim() + (x.img ? ' ' + x.img : '')).toLowerCase(); if (have.has(key)) { skip++; continue; } have.add(key);
    const created = Date.now() + n;
    if (x.cloze) addNote({ deckId: d.id, created, type: 'cloze', text: x.cloze, extra: '', hint: '' });
    else { const note = addNote({ deckId: d.id, created, type: 'basic', front: x.front, back: x.back, hint: x.hint, extra: '', ...(x.wrong ? { wrong: x.wrong } : {}), reverse: P.reverse, ...(x.img ? { imgSrc: x.img } : {}) });
      if (x.img || x.bimg) imgJobs.push([note, x.img, x.bimg]); }
    n++;
  }
  save(); emit('cardsAdded', n); IMPORT_TXT = '';
  if (imgJobs.length) (async () => { for (const [note, a, b] of imgJobs) { if (a) note.imageId = await packImage(a); if (b) note.backImageId = await packImage(b); touch(note); }
    save(); render(); })();
  toast(`📥 Dodano ${n} ${plural(n, 'fiszkę', 'fiszki', 'fiszek')} do „${d.name}”${skip ? ` · pominięto ${skip} powtórzonych` : ''}`, 4500);
  go('#/deck/' + d.id);
}
let IMPORT_TXT = '', IMPORT_SRC = '';
// 🔗 talia w linku: pakiet tekstowy skompresowany (deflate) w adresie – działa bez konta i bez serwera; zdjęcia nie wchodzą
const b64u = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = t => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function packZip(txt) { const cs = new CompressionStream('deflate-raw'); const w = cs.writable.getWriter(); w.write(new TextEncoder().encode(txt)); w.close(); return b64u(new Uint8Array(await new Response(cs.readable).arrayBuffer())); }
async function packUnzip(z) { const ds = new DecompressionStream('deflate-raw'); const w = ds.writable.getWriter(); w.write(unb64u(z)); w.close(); return new TextDecoder().decode(await new Response(ds.readable).arrayBuffer()); }
function deckPackText(d) {
  const cl = t => String(t || '').replace(/\s*\|\s*/g, ' / ').replace(/\r?\n/g, '\\n').trim();
  const ns = S.notes.filter(n => n.deckId === d.id), rev = ns.some(n => n.reverse);
  return ['#fiszki', `#talia: ${d.name.replace(/^(👥|🏫)\s*/, '')}`, ...(d.subject ? [`#przedmiot: ${d.subject}`] : []), ...(rev ? ['#odwrotne: tak'] : []),
    ...ns.map(n => n.type === 'cloze' ? cl(n.text) : n.front && n.back ? [cl(n.front), cl(n.back), ...(n.hint ? [cl(n.hint)] : []), ...(n.wrong ? ['✗ ' + cl(n.wrong).replace(/\\n/g, '; ')] : [])].join(' | ') : '').filter(Boolean)].join('\n');
}
async function deckLink(d) {
  const z = await packZip(deckPackText(d)), base = location.origin + location.pathname;
  // krótki link (#/t/ID) – talia zapisana w bazie; bez konta / stara baza → długi link z całą talią w adresie
  if (typeof cloudOn === 'function' && cloudOn()) {
    const key = 'dl:' + d.id, prev = S.stats.deckLinks?.[key];
    if (prev && prev.z === z.length + z.slice(-16)) return `${base}#/t/${prev.id}`;
    const AB = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', id = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => AB[b % AB.length]).join('');
    try { const r = await SB.from('deck_links').insert({ id, owner: SB_USER.id, name: d.name.slice(0, 80), data: z });
      if (!r.error) { (S.stats.deckLinks = S.stats.deckLinks || {})[key] = { id, z: z.length + z.slice(-16) }; save(); return `${base}#/t/${id}`; } } catch { /* stara baza */ }
  }
  return `${base}#/import?d=${z}`;
}
// otwarcie linku (krótkiego lub długiego): od razu cała talia u odbiorcy i strona talii gotowa do nauki
let PACK_DONE = '';
async function importZip(z) {
  const t = await packUnzip(z), P = parsePack(t);
  if (!P.items.length) { IMPORT_TXT = t; return go('#/import'); }
  importPack(P); const d = S.decks.find(x => x.name.trim().toLowerCase() === (P.deck || 'Nowa talia').toLowerCase());
  if (d) { celebrate(`📚 Masz talię „${d.name}”!`, `${S.notes.filter(n => n.deckId === d.id).length} fiszek – możesz od razu się uczyć`); location.replace(location.pathname + '#/deck/' + d.id); }
}
ROUTES.t = parts => {
  const id = (parts[1] || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 8);
  if (id && PACK_DONE !== id) {
    PACK_DONE = id;
    const tryGet = async (n = 0) => {
      if (typeof SB === 'undefined' || !SB) { if (n < 40) return setTimeout(() => tryGet(n + 1), 250); return toast('Brak połączenia z bazą – spróbuj za chwilę', 4000); }
      const r = await SB.rpc('get_deck_link', { p_id: id });
      if (r.error || !r.data) { PACK_DONE = ''; return toast('Nie znaleziono tej talii (link nieaktualny?)', 4500); }
      importZip(r.data).catch(() => toast('Nie udało się otworzyć talii', 4000));
    };
    tryGet();
  }
  return { tab: 'home', html: '<div class="card center" style="padding:40px 16px"><div style="font-size:44px">📚</div><h2>Pobieram talię…</h2><p class="muted small">Za chwilę będzie gotowa do nauki.</p></div>' };
};
ROUTES.import = (parts, q) => {
  const f = q.get('f') || '', fv = f + '#' + (q.get('v') || '');   // ?v=… wymusza ponowne pobranie (zaktualizowany pakiet)
  if (f && fv !== IMPORT_SRC && /^assets\/imports\/[\w.-]+\.txt$/.test(f)) {
    IMPORT_SRC = fv;
    fetch(f + '?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.text() : Promise.reject(r.status)).then(t => { IMPORT_TXT = t; render(); })
      .catch(() => toast('Nie udało się pobrać pakietu – spróbuj za 1–2 min (GitHub publikuje plik)', 5000));
  }
  const dz = q.get('d') || '';
  if (dz && 'z:' + dz.length + dz.slice(-12) !== IMPORT_SRC) { IMPORT_SRC = 'z:' + dz.length + dz.slice(-12); importZip(dz).catch(() => toast('Ten link do talii jest uszkodzony albo niepełny', 4500)); }
  const P = parsePack(IMPORT_TXT);
  return { tab: 'add', html: `
  <div class="row nowrap"><button class="iconbtn" data-go="#/add">‹</button><h1 class="grow" style="margin:0">📥 Pakiet fiszek</h1></div>
  <div class="card">
    <p class="small muted" style="margin-top:0">Wklej pakiet przygotowany np. przez Claude ze zdjęć slajdów albo notatek. Jedna fiszka w linii: <code>pytanie | odpowiedź</code> albo z tabulatorem (eksport z <b>Quizletu</b>), luki: <code>{{c1::…}}</code>, nazwa talii: <code>#talia: …</code>.</p>
    <textarea id="pack-in" rows="9" placeholder="#talia: Anatomia – kończyna dolna&#10;Najdłuższa kość człowieka | kość udowa (femur)&#10;Mięsień {{c1::czworogłowy}} prostuje staw kolanowy">${esc(IMPORT_TXT)}</textarea>
    <div class="row"><button class="grow" data-act="pack-paste">📋 Wklej ze schowka</button><button class="grow" data-act="pack-preview">👀 Podgląd</button></div>
  </div>
  ${P.items.length ? `<div class="card"><div class="row nowrap"><b class="grow">${esc(P.deck || 'Nowa talia')}</b><span class="small muted">${P.items.length} ${plural(P.items.length, 'fiszka', 'fiszki', 'fiszek')}${P.subject ? ' · ' + esc(P.subject) : ''}</span></div>
    <div class="pack-list">${P.items.slice(0, 40).map(x => x.cloze ? `<div class="pack-it"><span class="tag">luka</span>${fmt(x.cloze.replace(/\{\{c\d+::(.*?)(::.*?)?\}\}/g, '[$1]'))}</div>`
      : `<div class="pack-it"><b>${fmt(x.front)}</b><span>${fmt(x.back)}</span>${x.hint ? `<small>💡 ${fmt(x.hint)}</small>` : ''}</div>`).join('')}${P.items.length > 40 ? `<p class="small muted center">…i ${P.items.length - 40} więcej</p>` : ''}</div>
    ${P.paired ? '<p class="small" style="color:#ca8a04">Brak separatora – połączyłem kolejne linie w pary (pojęcie, definicja). Sprawdź podgląd!</p>' : ''}
    ${P.bad && !P.paired ? `<p class="small" style="color:#dc2626">Pominięto ${P.bad} ${plural(P.bad, 'linię', 'linie', 'linii')} bez separatora „ | ”.</p>` : ''}
    <button class="primary block" data-act="pack-import" style="min-height:54px">📥 Dodaj do aplikacji</button></div>` : ''}` };
};
Object.assign(ACTIONS, {
  'deck-link': async el => {
    const d = deckById(el.dataset.id); if (!d) return;
    try { const url = await deckLink(d), n = S.notes.filter(x => x.deckId === d.id).length, t = `📚 Talia „${d.name}” (${n} fiszek) – otwórz i dodaj do Fiszek:`;
      if (navigator.share) { try { await navigator.share({ title: d.name, text: t, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
      await navigator.clipboard.writeText(url); toast('🔗 Skopiowano link do talii', 2500);
    } catch { toast('Nie udało się przygotować linku', 3000); }
  },
  'pack-paste': async () => { try { IMPORT_TXT = await navigator.clipboard.readText(); render(); } catch { toast('Wklej ręcznie w pole (przytrzymaj → Wklej)'); } },
  'pack-preview': () => { IMPORT_TXT = $('#pack-in')?.value || ''; render(); },
  'pack-import': () => { IMPORT_TXT = $('#pack-in')?.value || IMPORT_TXT; importPack(parsePack(IMPORT_TXT)); },
});
document.addEventListener('input', e => { if (e.target.id === 'pack-in') IMPORT_TXT = e.target.value; });
// wejście w zakładce Dodaj
const impAdd0 = viewAdd;
viewAdd = function (editId, ...a) {
  const h = impAdd0(editId, ...a);
  return editId ? h : `<button class="card row nowrap pack-cta" data-act="link-paste"><span class="pack-ic">🔗</span><span class="grow"><b>Wklej link do talii</b><small class="muted">Znajomy wysłał Ci link? Skopiuj go i stuknij tutaj</small></span><span>›</span></button><button class="card row nowrap pack-cta" data-go="#/import"><span class="pack-ic">📥</span><span class="grow"><b>Pakiet fiszek</b><small class="muted">Gotowa talia z tekstu – np. ze zdjęć slajdów przerobionych przez Claude</small></span><span>›</span></button>` + h;
};

// jednorazowo: stare dopiski „literówka” z pakietu Angielski kolokwium → wyjaśnienia, na czym polegał błąd
const QL_HINT_FIX = {"w Quizlecie: „Adjust a footstraps” (literówka)": "Błąd w Quizlecie: „Adjust a footstraps”. Rodzajnik „a” (= jeden) nie stoi przed liczbą mnogą – footstraps to wiele pasków, więc „the footstraps”.", "w Quizlecie: „Grap the handle” (literówka)": "Błąd w Quizlecie: „Grap”. Takiego słowa nie ma – chwytać = grab. Skojarzenie: grab ≈ grabie, którymi chwytasz liście.", "w Quizlecie: „Joins” (literówka)": "Błąd w Quizlecie: „Joins”. Join = łączyć, dołączać. Staw to joint – z „t” na końcu (stawy = joints).", "w Quizlecie: „Chichen pox” (literówka)": "Błąd w Quizlecie: „Chichen pox”. Kurczak = chicken, ospa wietrzna = chickenpox (pisane razem).", "w Quizlecie było „Menrally handicapped” – to znaczy co innego (niepełnosprawny umysłowo); ruchowa = physically disabled": "W Quizlecie było „Mentally handicapped” – to znaczy niepełnosprawny umysłowo. Niepełnosprawność ruchowa = physically disabled.", "w Quizlecie: „rouing” (literówka)": "Błąd w Quizlecie: „rouing” – to zapis wymowy. Wiosłować = row [czyt. rou], wioślarstwo = rowing.", "w Quizlecie było „Recoverment” – takiego słowa nie ma": "Błąd w Quizlecie: „Recoverment” – takiego słowa nie ma. Recover = wyzdrowieć, recovery = wyzdrowienie.", "w Quizlecie było „Cycle” (= jeździć na rowerze); kolarstwo jako sport = cycling": "W Quizlecie było „Cycle” – to czasownik (jeździć na rowerze). Kolarstwo jako sport = cycling.", "w Quizlecie: „Achivemnet” (literówka)": "Błąd w Quizlecie: „Achivemnet” – przestawione litery. Achieve (osiągnąć) + -ment = achievement.", "w Quizlecie: „lin on your back” (literówka)": "Błąd w Quizlecie: „lin”. Lie = leżeć / połóż się. Nie myl z lay (= kłaść coś).", "w Quizlecie: „bent your knees” (literówka)": "Błąd w Quizlecie: „bent”. Polecenie to bend (zegnij); bent to forma przeszła – „knees bent” = ze zgiętymi kolanami."};
on('start', () => { let n = 0; for (const x of S.notes) if (x.hint && QL_HINT_FIX[x.hint]) { x.hint = QL_HINT_FIX[x.hint]; touch(x); n++; } if (n) save(); });
// 🔄 ponowny import talii, którą już masz (np. poprawiona wersja z linku): zamiast dokładać stare + nowe fiszki,
// pytamy „Zastąpić nową wersją?” – takie same pytania zachowują postęp nauki (dostają nową odpowiedź),
// fiszki, których nie ma w nowej wersji, są usuwane.
const packKey = (front, img) => (String(front || '').trim() + (img ? ' ' + img : '')).toLowerCase();
const importPack0 = importPack;
importPack = function (P) {
  if (!P || !P.items?.length || P.__upd) return importPack0(P);
  const name = P.deck || 'Nowa talia', d = S.decks.find(x => x.name.trim().toLowerCase() === name.toLowerCase());
  const ns = d ? S.notes.filter(n => n.deckId === d.id) : [];
  if (!ns.length) return importPack0(P);
  const byKey = new Map(P.items.map(x => [packKey(x.cloze || x.front, x.img), x]));
  const stale = ns.filter(n => !byKey.has(packKey(n.type === 'cloze' ? n.text : n.front, n.imgSrc)));
  const changed = ns.filter(n => { const x = byKey.get(packKey(n.type === 'cloze' ? n.text : n.front, n.imgSrc)); return x && !x.cloze && (x.back !== n.back || (x.wrong || '') !== (n.wrong || '')); });
  const add = P.items.length - (ns.length - stale.length);
  if (!stale.length && !changed.length) { P.__upd = 1; return importPack0(P); }
  askBox({ icon: '🔄', title: `Masz już talię „${d.name}”`, intro: `W aplikacji: ${ns.length} fiszek, w nowej wersji: ${P.items.length}.`,
    steps: [['🗑️', `${stale.length} starych fiszek nie ma w nowej wersji – zostaną usunięte`], ['✏️', `${changed.length} fiszek dostanie poprawioną odpowiedź (postęp nauki zostaje)`], ['➕', `${Math.max(0, add)} nowych fiszek`]],
    ok: 'Zastąp nową wersją', cancel: 'Dodaj tylko nowe' }).then(yes => {
    if (yes) {
      stale.forEach(n => deleteNote(n, true));
      for (const n of changed) { const x = byKey.get(packKey(n.front, n.imgSrc)); n.back = x.back; n.wrong = x.wrong || ''; if (x.hint) n.hint = x.hint; touch(n); }
    }
    P.__upd = 1; importPack0(P); render();
  });
};

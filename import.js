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
    out.items.push({ front: parts[0].trim().slice(0, 2000), back: parts[1].trim().replace(/\\n/g, '\n').slice(0, 2000), hint: (parts[2] || '').trim().slice(0, 1000) });
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
  const have = new Set(S.notes.filter(n => n.deckId === d.id).map(n => (n.type === 'cloze' ? n.text : n.front).trim().toLowerCase()));
  let n = 0, skip = 0;
  for (const x of P.items) {
    const key = (x.cloze || x.front).trim().toLowerCase(); if (have.has(key)) { skip++; continue; } have.add(key);
    const created = Date.now() + n;
    if (x.cloze) addNote({ deckId: d.id, created, type: 'cloze', text: x.cloze, extra: '', hint: '' });
    else addNote({ deckId: d.id, created, type: 'basic', front: x.front, back: x.back, hint: x.hint, extra: '', reverse: P.reverse });
    n++;
  }
  save(); emit('cardsAdded', n); IMPORT_TXT = '';
  toast(`📥 Dodano ${n} ${plural(n, 'fiszkę', 'fiszki', 'fiszek')} do „${d.name}”${skip ? ` · pominięto ${skip} powtórzonych` : ''}`, 4500);
  go('#/deck/' + d.id);
}
let IMPORT_TXT = '', IMPORT_SRC = '';
ROUTES.import = (parts, q) => {
  const f = q.get('f') || '', fv = f + '#' + (q.get('v') || '');   // ?v=… wymusza ponowne pobranie (zaktualizowany pakiet)
  if (f && fv !== IMPORT_SRC && /^assets\/imports\/[\w.-]+\.txt$/.test(f)) {
    IMPORT_SRC = fv;
    fetch(f + '?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.text() : Promise.reject(r.status)).then(t => { IMPORT_TXT = t; render(); })
      .catch(() => toast('Nie udało się pobrać pakietu – spróbuj za 1–2 min (GitHub publikuje plik)', 5000));
  }
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
  'pack-paste': async () => { try { IMPORT_TXT = await navigator.clipboard.readText(); render(); } catch { toast('Wklej ręcznie w pole (przytrzymaj → Wklej)'); } },
  'pack-preview': () => { IMPORT_TXT = $('#pack-in')?.value || ''; render(); },
  'pack-import': () => { IMPORT_TXT = $('#pack-in')?.value || IMPORT_TXT; importPack(parsePack(IMPORT_TXT)); },
});
document.addEventListener('input', e => { if (e.target.id === 'pack-in') IMPORT_TXT = e.target.value; });
// wejście w zakładce Dodaj
const impAdd0 = viewAdd;
viewAdd = function (editId, ...a) {
  const h = impAdd0(editId, ...a);
  return editId ? h : `<button class="card row nowrap pack-cta" data-go="#/import"><span class="pack-ic">📥</span><span class="grow"><b>Pakiet fiszek</b><small class="muted">Gotowa talia z tekstu – np. ze zdjęć slajdów przerobionych przez Claude</small></span><span>›</span></button>` + h;
};

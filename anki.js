'use strict';
/* Import i eksport talii Anki (.apkg / .colpkg) – w całości w przeglądarce.
   Biblioteki (JSZip, sql.js, fzstd) są w folderze vendor/ i wczytują się dopiero przy użyciu. */

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement('script'); s.src = src;
    s.onload = res; s.onerror = () => rej(new Error('Nie udało się wczytać ' + src));
    document.head.append(s);
  });
}
let sqlPromise;
async function getSQL() {
  await loadScript('vendor/sql-wasm.js');
  return sqlPromise || (sqlPromise = initSqlJs({ locateFile: f => 'vendor/' + f }));
}
const isZstd = b => b && b[0] === 0x28 && b[1] === 0xb5 && b[2] === 0x2f && b[3] === 0xfd;
async function unzstd(b) {
  if (!isZstd(b)) return b;
  await loadScript('vendor/fzstd.js');
  return fzstd.decompress(b);
}

// Minimalny czytnik protobuf (nowy format Anki trzyma tak listę mediów i typy notatek)
function* protoFields(buf) {
  let i = 0;
  const varint = () => { let r = 0, m = 1, b; do { b = buf[i++]; r += (b & 0x7f) * m; m *= 128; } while (b & 0x80); return r; };
  while (i < buf.length) {
    const key = varint(), field = Math.floor(key / 8), wt = key & 7;
    if (wt === 0) yield { field, value: varint() };
    else if (wt === 2) { const len = varint(); yield { field, bytes: buf.subarray(i, i + len) }; i += len; }
    else if (wt === 5) { i += 4; } else if (wt === 1) { i += 8; } else break;
  }
}

function htmlToText(html) {
  const doc = new DOMParser().parseFromString('<div>' + String(html || '').replace(/\[sound:[^\]]*\]/g, '') + '</div>', 'text/html');
  const imgs = [...doc.querySelectorAll('img')].map(i => i.getAttribute('src')).filter(Boolean);
  doc.querySelectorAll('br').forEach(b => b.replaceWith('\n'));
  doc.querySelectorAll('div, p, li, tr, h1, h2, h3').forEach(d => d.prepend('\n'));
  const text = doc.body.textContent.replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { text, imgs };
}
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp' };

// Kształty z wbudowanego w Anki „Image Occlusion”: {{c1::image-occlusion:rect:left=.1:top=.2:width=.3:height=.1:oi=1}}
function parseOcclusions(text) {
  const out = [];
  for (const m of text.matchAll(/\{\{c(\d+)::image-occlusion:(\w+):([^}]*)\}\}/g)) {
    const p = {}; m[3].split(':').forEach(kv => { const [k, ...v] = kv.split('='); p[k] = v.join('='); });
    let x, y, w, h;
    if (m[2] === 'ellipse') { const rx = +p.rx, ry = +p.ry; x = +p.left; y = +p.top; w = 2 * rx; h = 2 * ry; }
    else if (m[2] === 'polygon' && p.points) {
      const pts = p.points.trim().split(/\s+/).map(s => s.split(',').map(Number));
      const xs = pts.map(a => a[0]), ys = pts.map(a => a[1]);
      x = Math.min(...xs); y = Math.min(...ys); w = Math.max(...xs) - x; h = Math.max(...ys) - y;
    } else { x = +p.left; y = +p.top; w = +p.width; h = +p.height; }
    if ([x, y, w, h].some(v => !isFinite(v))) continue;
    out.push({ n: m[1], x, y, w, h, label: p.text || '' });
  }
  return out;
}

async function importAnki(file, keepProgress, report = () => {}) {
  report('Otwieram plik…');
  await loadScript('vendor/jszip.min.js');
  const zip = await JSZip.loadAsync(file);
  const dbFile = zip.file('collection.anki21b') || zip.file('collection.anki21') || zip.file('collection.anki2');
  if (!dbFile) throw new Error('to nie jest plik talii Anki (.apkg/.colpkg)');
  const SQL = await getSQL();
  const db = new SQL.Database(await unzstd(await dbFile.async('uint8array')));
  const q = sql => { const r = db.exec(sql); if (!r.length) return []; const { columns, values } = r[0]; return values.map(v => Object.fromEntries(columns.map((c, i) => [c, v[i]]))); };
  try {
    const tables = new Set(q("select name from sqlite_master where type='table'").map(r => r.name));
    const col = q('select * from col')[0] || {};
    const decks = {}, models = {};
    if (tables.has('decks')) q('select id, name from decks').forEach(r => { decks[r.id] = r.name.replace(/\x1f/g, '::'); });
    else Object.values(JSON.parse(col.decks || '{}')).forEach(d => { decks[d.id] = d.name; });
    if (tables.has('notetypes')) {
      q('select id, name, config from notetypes').forEach(r => {
        let kind = 0; for (const f of protoFields(r.config || new Uint8Array())) if (f.field === 1 && 'value' in f) kind = f.value;
        models[r.id] = { name: r.name, fields: [], kind };
      });
      q('select ntid, ord, name from fields order by ntid, ord').forEach(f => models[f.ntid]?.fields.push(f.name));
    } else Object.values(JSON.parse(col.models || '{}')).forEach(m => {
      models[m.id] = { name: m.name, kind: m.type, fields: m.flds.sort((a, b) => a.ord - b.ord).map(f => f.name) };
    });

    // media: stary format = JSON {"0": "plik.jpg"}, nowy = protobuf skompresowany zstd
    const media = {};
    const mf = zip.file('media');
    if (mf) {
      const raw = await mf.async('uint8array');
      try { const j = JSON.parse(new TextDecoder().decode(raw)); for (const k in j) media[j[k]] = k; }
      catch {
        let idx = 0;
        for (const e of protoFields(await unzstd(raw))) {
          if (e.field !== 1 || !e.bytes) continue;
          let name = '', legacy = null;
          for (const f of protoFields(e.bytes)) { if (f.field === 1) name = new TextDecoder().decode(f.bytes); if (f.field === 255) legacy = f.value; }
          media[name] = String(legacy ?? idx); idx++;
        }
      }
    }
    const imgCache = {};
    async function image(name) {
      if (!name) return null;
      name = decodeURIComponent(name);
      if (name in imgCache) return imgCache[name];
      const entry = media[name] != null ? zip.file(media[name]) : null;
      if (!entry) return (imgCache[name] = null);
      try {
        const bytes = await unzstd(await entry.async('uint8array'));
        const ext = name.split('.').pop().toLowerCase();
        const dataUrl = await compressImage(new Blob([bytes], { type: MIME[ext] || 'image/jpeg' }));
        return (imgCache[name] = await putImage(dataUrl));
      } catch { return (imgCache[name] = null); }
    }

    const cardsByNote = {};
    q('select id, nid, did, ord, type, queue, due, ivl, factor, reps, lapses from cards').forEach(c => (cardsByNote[c.nid] || (cardsByNote[c.nid] = [])).push(c));
    const notes = q('select id, mid, flds from notes');
    const today = Math.floor((Date.now() / 1000 - (col.crt || 0)) / 86400);
    const deckMap = {};
    const ourDeck = did => {
      const name = decks[did] || 'Import z Anki';
      if (!deckMap[name]) deckMap[name] = (S.decks.find(d => d.name === name) || newDeck(name)).id;
      return deckMap[name];
    };
    const srsFrom = c => {
      if (!keepProgress || !c) return newSrs();
      const s = { ...newSrs(), reps: c.reps || 0, lapses: c.lapses || 0, ease: c.factor ? c.factor / 1000 : 2.5 };
      if (c.type === 2) { s.state = 'review'; s.ivl = Math.max(1, c.ivl); s.due = addDays(dayStart(), clamp(c.due - today, -3650, 36500)); }
      else if (c.type === 1 || c.type === 3) { s.state = c.type === 3 ? 'relearn' : 'learning'; s.ivl = Math.max(1, c.ivl || 1); s.due = Date.now(); }
      return s;
    };

    let done = 0, skipped = 0; const t0 = Date.now();
    const exist = new Set(S.notes.map(n => n.ankiId).filter(Boolean));
    for (const [i, row] of notes.entries()) {
      if (i % 50 === 0) { report(`Importuję ${i}/${notes.length}…`); await new Promise(r => setTimeout(r)); }
      if (exist.has(String(row.id))) { skipped++; continue; }
      const model = models[row.mid] || { name: '', fields: [], kind: 0 };
      const raw = row.flds.split('\x1f');
      const fields = raw.map(htmlToText);
      const named = re => { const k = model.fields.findIndex(f => re.test(f)); return k >= 0 ? fields[k]?.text || '' : ''; };
      const cards = (cardsByNote[row.id] || []).sort((a, b) => a.ord - b.ord);
      const base = { id: uid(), deckId: ourDeck(cards[0]?.did), created: t0 + i, ankiId: String(row.id) };
      let note;
      const occl = raw.findIndex(f => f.includes('image-occlusion:'));
      if (occl >= 0) {
        const shapes = parseOcclusions(raw[occl]);
        const imgName = fields.flatMap(f => f.imgs)[0];
        const imageId = await image(imgName);
        if (!imageId || !shapes.length) { skipped++; continue; }
        if (shapes.some(s => s.x > 1.01 || s.w > 1.01)) { // stare wersje zapisywały piksele
          const im = await new Promise(r => { const x = new Image(); x.onload = () => r(x); x.onerror = () => r(null); x.src = IMG[imageId]; });
          if (im) shapes.forEach(s => { s.x /= im.naturalWidth; s.w /= im.naturalWidth; s.y /= im.naturalHeight; s.h /= im.naturalHeight; });
        }
        const groups = {};
        shapes.forEach(s => { const g = groups[s.n]; groups[s.n] = g ? { ...g, x: Math.min(g.x, s.x), y: Math.min(g.y, s.y), w: Math.max(g.x + g.w, s.x + s.w) - Math.min(g.x, s.x), h: Math.max(g.y + g.h, s.y + s.h) - Math.min(g.y, s.y) } : { ...s }; });
        const header = named(/header|nagł/i), extra = named(/back extra|extra|comment/i);
        note = { ...base, type: 'occl', imageId, title: header, hint: '', extra, hideAll: true,
          boxes: Object.values(groups).map(g => ({ id: 'c' + g.n, x: clamp(g.x, 0, 1), y: clamp(g.y, 0, 1), w: clamp(g.w, 0, 1), h: clamp(g.h, 0, 1), label: g.label, hint: '' })) };
        cards.forEach(c => { c._ord = 'c' + (c.ord + 1); });
      } else if (model.kind === 1 || /\{\{c\d+::/.test(raw[0])) {
        note = { ...base, type: 'cloze', text: fields[0].text, hint: named(/hint|podpow|skojarz|mnemo/i), extra: fields.slice(1).map(f => f.text).filter(Boolean).join('\n') };
        const img = await image(fields[0].imgs[0]); if (img) note.imageId = img;
        cards.forEach(c => { c._ord = String(c.ord + 1); });
      } else {
        const hintIdx = model.fields.findIndex(f => /hint|podpow|skojarz|mnemo/i.test(f));
        const rest = fields.slice(2).filter((_, k) => k + 2 !== hintIdx).map(f => f.text).filter(Boolean);
        note = { ...base, type: 'basic', front: fields[0]?.text || '', back: fields[1]?.text || '', hint: hintIdx >= 0 ? fields[hintIdx].text : '',
          extra: rest.join('\n'), reverse: cards.some(c => c.ord === 1) };
        const fi = await image(fields[0]?.imgs[0]); if (fi) note.imageId = fi;
        const bi = await image(fields[1]?.imgs[0]); if (bi) note.backImageId = bi;
        if (!note.front && !note.imageId) { skipped++; continue; }
        cards.forEach(c => { c._ord = c.ord === 1 ? 'r' : 'f'; });
      }
      touch(note); S.notes.push(note);
      // karty tworzymy od razu (szybciej niż syncCards przy dużych taliach)
      noteOrds(note).forEach((o, k) => {
        const ac = cards.find(c => c._ord === o);
        S.cards.push(touch({ id: uid(), noteId: note.id, deckId: note.deckId, ord: o, pos: note.created + k / 1000, srs: srsFrom(ac) }));
      });
      done++;
    }
    save();
    return { done, skipped, decks: Object.keys(deckMap) };
  } finally { db.close(); }
}

// ------------------------------------------------------------ Eksport do Anki (.apkg w starym formacie – otwiera każda wersja Anki, AnkiMobile i AnkiDroid)
async function sha1Int(text) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text)));
  return ((h[0] << 24) >>> 0) + (h[1] << 16) + (h[2] << 8) + h[3];
}
const ankiHtml = s => esc(s).replace(/\n/g, '<br>');
const plainField = s => String(s).replace(/<[^>]*>/g, '').trim();

// Obraz z lukami → dwa obrazki (pytanie i odpowiedź) z narysowanymi maskami
async function renderOcclImage(n, targetId, reveal) {
  const img = await new Promise((r, j) => { const x = new Image(); x.onload = () => r(x); x.onerror = j; x.src = IMG[n.imageId]; });
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const W = c.width, H = c.height, r = Math.max(12, W / 45);
  n.boxes.forEach((b, i) => {
    const t = b.id === targetId;
    if (n.style === 'pin') {
      g.beginPath(); g.arc(b.x * W, b.y * H, t ? r * 1.25 : r, 0, 7);
      g.fillStyle = t ? (reveal ? '#16a34a' : '#e11d48') : 'rgba(79,70,229,.6)'; g.fill();
      g.lineWidth = r / 6; g.strokeStyle = '#fff'; g.stroke();
      g.fillStyle = '#fff'; g.font = `bold ${r}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(t && !reveal ? '?' : String(i + 1), b.x * W, b.y * H);
      return;
    }
    if (!t && !n.hideAll) return;
    if (t && reveal) { g.lineWidth = Math.max(3, W / 250); g.strokeStyle = '#16a34a'; g.strokeRect(b.x * W, b.y * H, b.w * W, b.h * H); return; }
    g.fillStyle = t ? '#e11d48' : '#f59e0b'; g.fillRect(b.x * W, b.y * H, b.w * W, b.h * H);
    g.lineWidth = 1; g.strokeStyle = 'rgba(0,0,0,.3)'; g.strokeRect(b.x * W, b.y * H, b.w * W, b.h * H);
  });
  return c.toDataURL('image/jpeg', 0.85);
}
const dataUrlBytes = d => Uint8Array.from(atob(d.split(',')[1]), ch => ch.charCodeAt(0));

async function exportAnki(deckIds, withProgress, report = () => {}) {
  report('Przygotowuję…');
  await loadScript('vendor/jszip.min.js');
  const SQL = await getSQL();
  const db = new SQL.Database();
  db.run(`CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null, ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null, models text not null, decks text not null, dconf text not null, tags text not null);
    CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null, usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null, flags integer not null, data text not null);
    CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null, mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null, ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null, odue integer not null, odid integer not null, flags integer not null, data text not null);
    CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null, ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null);
    CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
    CREATE INDEX ix_notes_usn on notes (usn); CREATE INDEX ix_cards_usn on cards (usn); CREATE INDEX ix_cards_nid on cards (nid); CREATE INDEX ix_cards_sched on cards (did, queue, due);`);
  const nowS = Math.floor(Date.now() / 1000), crt = Math.floor(dayStart() / 1000);
  const MID = { basic: 1712345678001, cloze: 1712345678002, image: 1712345678003 };
  const css = '.card { font-family: -apple-system, Arial, sans-serif; font-size: 22px; text-align: center; color: black; background-color: white; }\n.extra { font-size: 16px; color: #666; }\nimg { max-width: 100%; }\n.cloze { font-weight: bold; color: #4f46e5; }';
  const fld = (name, ord) => ({ name, ord, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] });
  const tmpl = (name, ord, qfmt, afmt) => ({ name, ord, qfmt, afmt, did: null, bqfmt: '', bafmt: '' });
  const model = (id, name, type, flds, tmpls, req) => ({ id, name, type, mod: nowS, usn: -1, sortf: 0, did: 1, tmpls, flds, css, req,
    latexPre: '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
    latexPost: '\\end{document}', tags: [], vers: [] });
  const hintPart = '{{#Skojarzenie}}<br><br>{{hint:Skojarzenie}}{{/Skojarzenie}}', extraPart = '{{#Dodatkowe}}<br><br><div class="extra">{{Dodatkowe}}</div>{{/Dodatkowe}}';
  const models = {
    [MID.basic]: model(MID.basic, 'Fiszki – podstawowa', 0, ['Przód', 'Tył', 'Skojarzenie', 'Dodatkowe', 'Odwrotna'].map(fld), [
      tmpl('Karta 1', 0, '{{Przód}}' + hintPart, '{{Przód}}<hr id=answer>{{Tył}}' + extraPart),
      tmpl('Karta 2', 1, '{{#Odwrotna}}{{Tył}}{{/Odwrotna}}', '{{Tył}}<hr id=answer>{{Przód}}' + extraPart)], [[0, 'any', [0]], [1, 'all', [1, 4]]]),
    [MID.cloze]: model(MID.cloze, 'Fiszki – luki', 1, ['Tekst', 'Skojarzenie', 'Dodatkowe'].map(fld), [
      tmpl('Luka', 0, '{{cloze:Tekst}}' + hintPart, '{{cloze:Tekst}}' + extraPart)], [[0, 'any', [0]]]),
    [MID.image]: model(MID.image, 'Fiszki – obraz z lukami', 0, ['Pytanie', 'Odpowiedź', 'Skojarzenie', 'Dodatkowe'].map(fld), [
      tmpl('Obraz', 0, '{{Pytanie}}' + hintPart, '{{Odpowiedź}}' + extraPart)], [[0, 'any', [0]]]),
  };
  const deckJson = (id, name) => ({ id, name, mod: nowS, usn: -1, desc: '', dyn: 0, conf: 1, collapsed: false, browserCollapsed: false,
    newToday: [0, 0], revToday: [0, 0], lrnToday: [0, 0], timeToday: [0, 0], extendNew: 10, extendRev: 50 });
  const decks = { 1: deckJson(1, 'Default') }, deckIdMap = {};
  deckIds.forEach((id, i) => { const d = deckById(id); const aid = 1712345000000 + Math.floor((d.created || 0) % 1e9) + i; deckIdMap[id] = aid; decks[aid] = deckJson(aid, d.name); });
  const dconf = { 1: { id: 1, name: 'Default', mod: 0, usn: 0, maxTaken: 60, autoplay: true, timer: 0, replayq: true, dyn: false,
    new: { bury: false, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 0], order: 1, perDay: 20 },
    rev: { bury: false, ease4: 1.3, ivlFct: 1, maxIvl: 36500, perDay: 200, hardFactor: 1.2 },
    lapse: { delays: [10], leechAction: 1, leechFails: 8, minInt: 1, mult: 0 } } };
  const conf = { activeDecks: [1], curDeck: 1, newSpread: 0, collapseTime: 1200, timeLim: 0, estTimes: true, dueCounts: true, curModel: String(MID.basic), nextPos: 1, sortType: 'noteFld', sortBackwards: false, addToCur: true };
  db.run('INSERT INTO col VALUES (1,?,?,?,11,0,0,0,?,?,?,?,?)', [crt, Date.now(), Date.now(), JSON.stringify(conf), JSON.stringify(models), JSON.stringify(decks), JSON.stringify(dconf), '{}']);

  const files = []; const mediaName = {};
  const addMedia = (key, dataUrl) => { if (!mediaName[key]) { mediaName[key] = `fiszki_${key}.jpg`; files.push({ name: mediaName[key], bytes: dataUrlBytes(dataUrl) }); } return mediaName[key]; };
  const imgTag = id => id && IMG[id] ? `<img src="${addMedia(id, IMG[id])}">` : '';
  let nid = Date.now(), cid = Date.now(), pos = 0, count = 0;
  const insNote = async (guid, mid, flds) => {
    const id = nid++;
    const first = plainField(flds[0]);
    db.run('INSERT INTO notes VALUES (?,?,?,?,?,?,?,?,?,?,?)', [id, guid, mid, nowS, -1, 'fiszki', flds.join('\x1f'), first, await sha1Int(first), 0, '']);
    return id;
  };
  const insCard = (noteId, did, ord, c) => {
    const s = c?.srs; let type = 0, queue = 0, due = pos++, ivl = 0, factor = 0;
    if (withProgress && s && s.state === 'review') { type = 2; queue = 2; ivl = s.ivl; factor = Math.round(s.ease * 1000); due = Math.round((s.due - dayStart()) / DAY); }
    db.run('INSERT INTO cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [cid++, noteId, did, ord, nowS, -1, type, queue, due, ivl, factor, withProgress && s ? s.reps : 0, withProgress && s ? s.lapses : 0, 0, 0, 0, 0, '']);
  };
  const notes = S.notes.filter(n => deckIdMap[n.deckId]);
  for (const [i, n] of notes.entries()) {
    if (i % 25 === 0) report(`Eksportuję ${i}/${notes.length}…`);
    const did = deckIdMap[n.deckId];
    const cards = S.cards.filter(c => c.noteId === n.id);
    const card = ord => cards.find(c => c.ord === ord);
    if (n.type === 'cloze') {
      const id = await insNote(n.id, MID.cloze, [ankiHtml(n.text) + (n.imageId ? '<br>' + imgTag(n.imageId) : ''), ankiHtml(n.hint || ''), ankiHtml(n.extra || '')]);
      noteOrds(n).forEach(o => insCard(id, did, +o - 1, card(o)));
    } else if (n.type === 'occl') {
      if (!IMG[n.imageId]) continue;
      for (const b of n.boxes) {
        const q = await renderOcclImage(n, b.id, false), a = await renderOcclImage(n, b.id, true);
        const title = n.title ? `<div>${ankiHtml(n.title)}</div>` : '';
        const id = await insNote(n.id + '_' + b.id, MID.image, [
          title + `<img src="${addMedia(n.id + '_' + b.id + '_q', q)}">`,
          title + `<img src="${addMedia(n.id + '_' + b.id + '_a', a)}">` + (b.label ? `<br><b>${ankiHtml(b.label)}</b>` : ''),
          ankiHtml(b.hint || n.hint || ''), ankiHtml(n.extra || '')]);
        insCard(id, did, 0, card(b.id));
      }
    } else {
      const id = await insNote(n.id, MID.basic, [imgTag(n.imageId) + ankiHtml(n.front), ankiHtml(n.back) + imgTag(n.backImageId), ankiHtml(n.hint || ''), ankiHtml(n.extra || ''), n.reverse ? 'tak' : '']);
      insCard(id, did, 0, card('f'));
      if (n.reverse) insCard(id, did, 1, card('r'));
    }
    count++;
  }
  report('Pakuję…');
  const zip = new JSZip();
  zip.file('collection.anki2', db.export()); db.close();
  const mediaJson = {};
  files.forEach((f, i) => { zip.file(String(i), f.bytes); mediaJson[i] = f.name; });
  zip.file('media', JSON.stringify(mediaJson));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return { blob, count };
}

async function shareOrDownload(blob, name) {
  const file = new File([blob], name, { type: 'application/octet-stream' });
  if (navigator.canShare?.({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 20000);
}

Object.assign(ACTIONS, {
  'anki-import': async () => {
    const f = await pickFile('.apkg,.colpkg,application/octet-stream,application/zip'); if (!f) return;
    // sprawdź, czy to paczka Anki (ZIP zaczyna się od „PK”) – na iPhonie można wybrać dowolny plik
    const head = new Uint8Array(await f.slice(0, 2).arrayBuffer());
    if (!(head[0] === 0x50 && head[1] === 0x4b)) return toast(`„${f.name}” to nie plik z Anki. Wybierz plik .apkg (Anki → Eksportuj → Paczka talii).`, 5000);
    const keep = $('#anki-progress') ? $('#anki-progress').checked : true;
    try {
      const r = await importAnki(f, keep, msg => toast(msg, 60000));
      emit('ankiImport', r.done);
      toast(`Zaimportowano ${r.done} ${plural(r.done, 'notatkę', 'notatki', 'notatek')}${r.skipped ? ` (pominięto ${r.skipped})` : ''} ✓`, 4000);
      go('#/');
    } catch (e) { console.error(e); toast('Błąd importu z Anki: ' + e.message, 5000); }
  },
  'anki-export': async el => {
    const sel = $('#anki-deck')?.value || el.dataset.deck || 'all';
    const ids = sel === 'all' ? S.decks.map(d => d.id) : [sel];
    const keep = $('#anki-progress') ? $('#anki-progress').checked : false;
    try {
      const { blob, count } = await exportAnki(ids, keep, msg => toast(msg, 60000));
      const name = (sel === 'all' ? 'Fiszki' : deckById(sel).name).replace(/[\\/:*?"<>|]+/g, '_') + '.apkg';
      toast(`Gotowe: ${count} ${plural(count, 'notatka', 'notatki', 'notatek')}`, 3000);
      await shareOrDownload(blob, name);
    } catch (e) { console.error(e); toast('Błąd eksportu: ' + e.message, 5000); }
  },
});

function ankiSectionHTML() {
  return `<div class="card"><h2 style="margin-top:0">🔁 Anki</h2>
    <p class="small muted">Importuj talie z Anki (plik <code>.apkg</code> lub <code>.colpkg</code> – także obrazy i „Image Occlusion”) albo wyeksportuj swoje fiszki do Anki / AnkiMobile / AnkiDroid.</p>
    <label class="check"><input type="checkbox" id="anki-progress" checked> Przenoś postęp nauki (terminy powtórek)</label>
    <button class="primary block" data-act="anki-import">⬆️ Importuj z Anki</button>
    <div class="spacer"></div>
    <div class="row nowrap"><select id="anki-deck" class="grow"><option value="all">Wszystkie talie</option>${S.decks.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select>
      <button data-act="anki-export">⬇️ Eksportuj</button></div>
    <p class="small muted">W Anki: <i>Plik → Eksportuj → Talia (.apkg)</i>, a na iPhonie plik możesz otworzyć bezpośrednio stąd („Udostępnij” → AnkiMobile).</p></div>`;
}

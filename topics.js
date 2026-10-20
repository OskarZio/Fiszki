'use strict';
/* Tematy: katalogi (z podkatalogami) z materiałami do nauki – linki, filmy YouTube, notatki
   z zakreślaczem – oraz podpiętymi taliami. Z zaznaczonego tekstu notatki robi się fiszkę jednym stuknięciem. */

const topicById = id => S.topics.find(t => t.id === id);
const TOPIC_EMOJI = ['📚', '🧠', '🫀', '🦴', '💊', '🧬', '⚗️', '📐', '🌍', '🏛️', '💬', '🎵', '💻', '⚖️', '📈', '🎨'];

function ytId(url) { const m = String(url).match(/(?:youtu\.be\/|[?&]v=|shorts\/|embed\/|live\/)([\w-]{11})/); return m ? m[1] : null; }
function ytStart(url) {
  const m = String(url).match(/[?&#]t=([\dhms]+)/); if (!m) return 0;
  const t = m[1]; if (/^\d+$/.test(t)) return +t;
  const g = k => +((t.match(new RegExp('(\\d+)' + k)) || [])[1] || 0);
  return g('h') * 3600 + g('m') * 60 + g('s');
}
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

// Notatki są HTML-em – przy zapisie zostawiamy tylko bezpieczne znaczniki.
const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'MARK', 'H2', 'H3', 'UL', 'OL', 'LI', 'P', 'BR', 'DIV', 'BLOCKQUOTE']);
function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString('<div>' + (html || '') + '</div>', 'text/html');
  const walk = el => [...el.children].forEach(c => {
    walk(c);
    if (!ALLOWED_TAGS.has(c.tagName)) { c.replaceWith(...c.childNodes); return; }
    const cls = c.tagName === 'MARK' && /^hl-[ygpb]$/.test(c.className) ? c.className : '';
    [...c.attributes].forEach(a => c.removeAttribute(a.name));
    if (c.tagName === 'MARK') c.className = cls || 'hl-y';
  });
  const root = doc.body.firstChild; walk(root); return root.innerHTML;
}
const htmlText = html => new DOMParser().parseFromString(html || '', 'text/html').body.textContent || '';

function topicPath(t) { const p = []; for (let x = t; x; x = x.parentId && topicById(x.parentId)) p.unshift(x); return p; }
function topicDescendants(t) { const out = []; const rec = id => S.topics.filter(x => x.parentId === id).forEach(x => { out.push(x); rec(x.id); }); rec(t.id); return out; }
function topicDecks(t, deep) { const ts = deep ? [t, ...topicDescendants(t)] : [t]; return [...new Set(ts.flatMap(x => x.deckIds || []))].map(deckById).filter(Boolean); }
function topicStats(t) {
  const ids = new Set(topicDecks(t, true).map(d => d.id));
  const cards = S.cards.filter(c => ids.has(c.deckId));
  const due = [...ids].reduce((a, id) => a + deckCounts(id).total, 0);
  return { cards: cards.length, mature: cards.filter(c => c.srs.ivl >= 21).length, due };
}
const ITEM_ICON = { link: '🔗', yt: '▶️', note: '📝', gallery: '🖼️' };

function topicRow(t) {
  const st = topicStats(t), subs = S.topics.filter(x => x.parentId === t.id).length;
  return `<div class="note" data-go="#/topic/${t.id}"><span style="font-size:30px">${t.emoji || '📚'}</span>
    <div class="t"><div><b>${esc(t.name)}</b></div>
      <div class="small muted">${t.items.length} ${plural(t.items.length, 'materiał', 'materiały', 'materiałów')}${subs ? ` · ${subs} ${plural(subs, 'podtemat', 'podtematy', 'podtematów')}` : ''}${st.cards ? ` · ${st.cards} kart` : ''}</div>
      ${st.cards ? progress(st.mature / st.cards, true) : ''}</div>
    ${st.due ? `<span class="tag" style="background:var(--accent);color:#fff">${st.due}</span>` : ''}</div>`;
}

ROUTES.topics = () => {
  const roots = S.topics.filter(t => !t.parentId).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  return { tab: 'topics', html: `<h1>Tematy</h1>
    <div class="card row nowrap atlas-cta" data-go="#/atlas"><span style="font-size:34px">🫀</span><div class="grow"><b>Atlas – nauka z rycin</b>
      <div class="small muted">Twoje zdjęcie + nazwy struktur: przegląd, nazywanie i wskazywanie (np. anatomia)</div></div><span>›</span></div>
    <div class="card"><p class="small muted" style="margin-top:0">Katalogi z materiałami: strony, filmy z YouTube i notatki z zakreślaczem. Podepnij do tematu talie fiszek – zobaczysz postęp całego działu.</p>
    ${roots.map(topicRow).join('') || '<p class="muted">Nie masz jeszcze tematów.</p>'}
    <div class="spacer"></div><button class="primary block" data-act="topic-new">➕ Nowy temat</button></div>` };
};

ROUTES.topic = parts => {
  const t = topicById(parts[1]);
  if (!t) return { html: '<p>Nie ma takiego tematu. <a href="#/topics">Wróć</a></p>', tab: 'topics' };
  const path = topicPath(t);
  const back = t.parentId ? `#/topic/${t.parentId}` : '#/topics';
  const subs = S.topics.filter(x => x.parentId === t.id).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  const decks = topicDecks(t, false);
  const st = topicStats(t);
  const items = t.items.slice().sort((a, b) => (b.pin || 0) - (a.pin || 0) || b.created - a.created).map(it => {
    const yt = it.type === 'yt' && ytId(it.url);
    const thumb = yt ? `<img src="https://i.ytimg.com/vi/${yt}/mqdefault.jpg" alt="" style="width:64px;height:44px">`
      : it.type === 'link' ? `<img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostOf(it.url))}&sz=64" alt="" style="width:32px;height:32px;object-fit:contain">`
      : it.type === 'gallery' && IMG[it.images?.[0]?.id] ? `<img src="${IMG[it.images[0].id]}" alt="">`
      : `<span style="font-size:26px">${ITEM_ICON[it.type]}</span>`;
    const sub = it.type === 'note' ? htmlText(it.html).slice(0, 80) : it.type === 'gallery' ? `${(it.images || []).length} zdjęć` : hostOf(it.url) + (htmlText(it.html).trim() ? ' · 📝' : '');
    return `<div class="note" data-go="#/item/${t.id}/${it.id}">${thumb}<div class="t"><div><b>${esc(it.title)}</b></div><div class="small muted">${esc(sub)}</div></div><span class="tag">${ITEM_ICON[it.type]}</span><button class="iconbtn sm item-x" data-act="item-quickdel" data-tid="${t.id}" data-id="${it.id}" title="Usuń">🗑️</button></div>`;
  }).join('');
  const deckRows = decks.map(d => { const k = deckCounts(d.id); return `<div class="deck"><div class="name" data-go="#/deck/${d.id}">${esc(d.name)}</div>${countsHTML(k)}
      <button class="sm ${k.total ? 'primary' : ''}" data-go="#/study/${d.id}/flip" ${k.total ? '' : 'disabled'}>Ucz</button>
      <button class="sm ghost" data-act="topic-unlink" data-id="${t.id}" data-deck="${d.id}" title="Odepnij">✕</button></div>`; }).join('');
  const free = S.decks.filter(d => !(t.deckIds || []).includes(d.id));
  return { tab: 'topics', html: `
  <div class="row nowrap"><button class="iconbtn" data-go="${back}">‹</button>
    <h1 class="grow" style="font-size:22px">${t.emoji || '📚'} ${esc(t.name)}</h1>
    <button class="iconbtn" data-act="topic-edit" data-id="${t.id}">✏️</button></div>
  ${path.length > 1 ? `<p class="small muted" style="margin-top:-8px">${path.map(x => `<a href="#/topic/${x.id}">${esc(x.name)}</a>`).join(' › ')}</p>` : ''}
  ${st.cards ? `<div class="card tight"><div class="row small"><span class="grow">Opanowane: <b>${st.mature}/${st.cards}</b> kart</span><span>${st.due ? `do powtórki: <b>${st.due}</b>` : '✅ wszystko powtórzone'}</span></div>${progress(st.mature / st.cards)}</div>` : ''}
  <div class="card">
    <div class="row nowrap"><h2 class="grow" style="margin:0">Materiały</h2></div>
    <div class="spacer"></div>
    <div class="row"><button class="sm grow" data-act="item-add" data-type="link" data-id="${t.id}">🔗 Strona</button>
      <button class="sm grow" data-act="item-add" data-type="yt" data-id="${t.id}">▶️ YouTube</button>
      <button class="sm grow" data-act="item-add" data-type="gallery" data-id="${t.id}">🖼️ Galeria</button>
      <button class="sm grow primary" data-act="item-add" data-type="note" data-id="${t.id}">📝 Notatka</button></div>
    ${items || '<p class="muted small">Dodaj stronę, film albo notatkę.</p>'}
  </div>
  <div class="card">
    <h2 style="margin-top:0">Fiszki</h2>
    ${deckRows || '<p class="muted small">Brak podpiętych talii.</p>'}
    <div class="spacer"></div>
    <div class="row nowrap"><select id="topic-deck" class="grow"><option value="">Podepnij talię…</option>${free.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}<option value="__new">➕ Nowa talia</option></select>
      <button data-act="topic-link" data-id="${t.id}">Podepnij</button></div>
  </div>
  <div class="card">
    <h2 style="margin-top:0">Podtematy</h2>
    ${subs.map(topicRow).join('') || '<p class="muted small">Brak podtematów.</p>'}
    <div class="spacer"></div><button class="block" data-act="topic-new" data-parent="${t.id}">➕ Podtemat</button>
  </div>
  <button class="danger" data-act="topic-del" data-id="${t.id}">Usuń temat</button>` };
};

ROUTES.item = parts => {
  const t = topicById(parts[1]), it = t?.items.find(x => x.id === parts[2]);
  if (!it) return { html: '<p>Nie ma takiego materiału. <a href="#/topics">Wróć</a></p>', tab: 'topics' };
  const yt = it.type === 'yt' && ytId(it.url);
  onMount(() => mountEditor(t, it));
  return { tab: 'topics', html: `
  <div class="row nowrap"><button class="iconbtn" data-go="#/topic/${t.id}">‹</button>
    <h1 class="grow" style="font-size:20px">${ITEM_ICON[it.type]} ${esc(it.title)}</h1>
    <button class="iconbtn" data-act="item-rename" data-tid="${t.id}" data-id="${it.id}">✏️</button></div>
  ${yt ? `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${yt}?playsinline=1&rel=0${ytStart(it.url) ? '&start=' + ytStart(it.url) : ''}" title="YouTube" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>
     <div class="row"><a class="btn sm" href="${esc(it.url)}" target="_blank" rel="noopener">Otwórz w YouTube ↗</a></div>` : ''}
  ${it.type === 'gallery' ? galleryHTML(t, it) : ''}
  ${it.type === 'link' ? `<div class="card tight row nowrap"><span class="grow small" style="word-break:break-all">${esc(it.url)}</span>
     <a class="btn primary sm" href="${esc(it.url)}" target="_blank" rel="noopener">Otwórz ↗</a></div>` : ''}
  <div class="toolbar" id="ed-tools">
    <button data-cmd="hl-y" title="Zakreśl na żółto"><span class="sw hl-y"></span></button>
    <button data-cmd="hl-g" title="Zakreśl na zielono"><span class="sw hl-g"></span></button>
    <button data-cmd="hl-p" title="Zakreśl na różowo"><span class="sw hl-p"></span></button>
    <button data-cmd="hl-b" title="Zakreśl na niebiesko"><span class="sw hl-b"></span></button>
    <button data-cmd="unmark" title="Usuń zakreślenie">⌫</button>
    <button data-cmd="bold"><b>B</b></button>
    <button data-cmd="italic"><i>I</i></button>
    <button data-cmd="h3">H</button>
    <button data-cmd="list">•≡</button>
    <button data-cmd="cloze" title="Luka z zaznaczenia">[…]</button>
    <button data-cmd="qa" title="Pytanie z zaznaczenia">❓</button>
  </div>
  <div id="editor" class="editor" contenteditable="true" data-placeholder="${it.type === 'note' ? 'Pisz notatki… Zaznacz tekst i użyj zakreślacza albo zrób z niego fiszkę.' : 'Notatki do tego materiału…'}">${sanitizeHtml(it.html || '')}</div>
  <p class="small muted">Zaznacz fragment i stuknij <b>[…]</b> – powstanie fiszka z luką, albo <b>❓</b> – pytanie z odpowiedzią. Zapisuje się samo.</p>
  ${S.settings.aiKey ? `<button class="block" data-act="note-ai" data-tid="${t.id}" data-id="${it.id}">✨ Zrób fiszki z całej notatki (AI)</button><div class="spacer"></div>` : ''}
  <div class="row"><button class="danger" data-act="item-del" data-tid="${t.id}" data-id="${it.id}">Usuń materiał</button></div>` };
};

let edRange = null;
document.addEventListener('selectionchange', () => {
  const ed = $('#editor'), s = getSelection();
  if (ed && s.rangeCount && ed.contains(s.anchorNode)) edRange = s.getRangeAt(0).cloneRange();
});
function mountEditor(t, it) {
  const ed = $('#editor'); if (!ed) return;
  let timer;
  const persist = () => { it.html = sanitizeHtml(ed.innerHTML); it.mod = Date.now(); touch(t); save(); };
  ed.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(persist, 500); });
  ed.addEventListener('blur', () => { clearTimeout(timer); persist(); });
  edRange = null;
  const run = cmd => {
    if (edRange) { const s = getSelection(); s.removeAllRanges(); s.addRange(edRange); }
    const sel = getSelection(), r = sel.rangeCount ? sel.getRangeAt(0) : null;
    const inside = r && ed.contains(r.commonAncestorContainer);
    if (cmd.startsWith('hl-')) {
      if (!inside || r.collapsed) return toast('Najpierw zaznacz tekst');
      const m = document.createElement('mark'); m.className = cmd;
      m.appendChild(r.extractContents()); r.insertNode(m);
      m.querySelectorAll('mark').forEach(x => x.replaceWith(...x.childNodes));
      sel.removeAllRanges();
    } else if (cmd === 'unmark') {
      if (!inside) return;
      ed.querySelectorAll('mark').forEach(m => { if (r.intersectsNode(m)) m.replaceWith(...m.childNodes); });
    } else if (cmd === 'bold' || cmd === 'italic') document.execCommand(cmd);
    else if (cmd === 'h3') document.execCommand('formatBlock', false, document.queryCommandValue('formatBlock') === 'h3' ? 'div' : 'h3');
    else if (cmd === 'list') document.execCommand('insertUnorderedList');
    else if (cmd === 'cloze' || cmd === 'qa') {
      const text = inside ? sel.toString().trim() : '';
      if (!text) return toast('Zaznacz fragment, z którego ma powstać fiszka');
      let block = r.commonAncestorContainer; if (block.nodeType === 3) block = block.parentElement;
      block = block.closest('p,li,h2,h3,div,blockquote') || ed;
      // kontekst = linia (a jeśli długa – zdanie) zawierająca zaznaczenie
      const line = (block === ed ? ed.innerText : block.innerText).split('\n').find(l => l.includes(text)) || text;
      const sentence = line.length > 200 ? (line.match(/[^.!?]+[.!?]*/g) || [line]).find(x => x.includes(text)) || line : line;
      const context = sentence.trim();
      persist(); return noteToCard(t, it, cmd, text, context);
    }
    persist();
  };
  $$('#ed-tools button').forEach(b => {
    const h = e => { e.preventDefault(); run(b.dataset.cmd); };
    b.addEventListener('touchstart', h, { passive: false });
    b.addEventListener('mousedown', h);
  });
}
function noteToCard(t, it, kind, text, context) {
  const deckId = (t.deckIds || [])[0] || S.settings.lastDeck || S.decks[0]?.id;
  DRAFT = freshDraft(kind === 'cloze' ? 'cloze' : 'basic', deckId);
  DRAFT.fromHash = '#/add';
  if (kind === 'cloze') {
    const i = context.indexOf(text);
    DRAFT.text = i >= 0 ? context.slice(0, i) + `{{c1::${text}}}` + context.slice(i + text.length) : `{{c1::${text}}}`;
  } else { DRAFT.back = text; DRAFT.extra = context !== text ? context : ''; }
  DRAFT.extra = DRAFT.extra || `Źródło: ${t.name} – ${it.title}`;
  go('#/add');
  if (kind === 'qa') setTimeout(() => { $('[data-bind=front]')?.focus(); toast('Wpisz pytanie, odpowiedź jest już gotowa'); }, 80);
}

Object.assign(ACTIONS, {
  'topic-new': el => {
    const name = prompt(el.dataset.parent ? 'Nazwa podtematu:' : 'Nazwa tematu (np. „Anatomia – kończyna górna”):'); if (!name?.trim()) return;
    const t = touch({ id: uid(), name: name.trim(), emoji: TOPIC_EMOJI[S.topics.length % TOPIC_EMOJI.length], parentId: el.dataset.parent || null, deckIds: [], items: [], created: Date.now() });
    S.topics.push(t); save(); emit('topic'); go(`#/topic/${t.id}`);
  },
  'topic-edit': el => {
    const t = topicById(el.dataset.id);
    const name = prompt('Nazwa tematu:', t.name); if (name == null) return;
    const emoji = prompt(`Ikona (emoji), np. ${TOPIC_EMOJI.slice(0, 8).join(' ')}`, t.emoji || '📚');
    t.name = name.trim() || t.name; if (emoji?.trim()) t.emoji = [...emoji.trim()].slice(0, 2).join(''); touch(t); save(); render();
  },
  'topic-del': el => {
    const t = topicById(el.dataset.id), sub = topicDescendants(t);
    if (!confirm(`Usunąć temat „${t.name}”${sub.length ? ` i ${sub.length} podtematów` : ''}? Talie fiszek zostaną.`)) return;
    [t, ...sub].forEach(x => { S.tomb[x.id] = Date.now(); }); const del = new Set([t, ...sub].map(x => x.id));
    S.topics = S.topics.filter(x => !del.has(x.id)); save(); go(t.parentId ? `#/topic/${t.parentId}` : '#/topics');
  },
  'topic-link': el => {
    const t = topicById(el.dataset.id), sel = $('#topic-deck').value; if (!sel) return;
    const id = sel === '__new' ? newDeck(prompt('Nazwa nowej talii:', t.name) || t.name).id : sel;
    t.deckIds = [...new Set([...(t.deckIds || []), id])]; touch(t); save(); render();
  },
  'topic-unlink': el => { const t = topicById(el.dataset.id); t.deckIds = t.deckIds.filter(x => x !== el.dataset.deck); touch(t); save(); render(); },
  'item-add': async el => {
    const t = topicById(el.dataset.id), type = el.dataset.type;
    let url = '', title = '';
    if (type === 'gallery') {
      title = prompt('Nazwa galerii:', 'Zdjęcia ' + (t.items.filter(i => i.type === 'gallery').length + 1)); if (title == null) return;
      const item = { id: uid(), type: 'gallery', title: title.trim() || 'Galeria', url: '', html: '', images: [], created: Date.now(), mod: Date.now() };
      t.items.push(item); touch(t); save(); emit('material'); return go(`#/item/${t.id}/${item.id}`);
    }
    if (type !== 'note') {
      url = (prompt(type === 'yt' ? 'Wklej link do filmu YouTube:' : 'Wklej adres strony:') || '').trim(); if (!url) return;
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      const isYt = !!ytId(url);
      if (type === 'yt' && !isYt) return toast('To nie wygląda na link do YouTube', 3000);
      if (isYt) try { const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`); if (r.ok) title = (await r.json()).title; } catch { /* brak tytułu – zapytamy */ }
      title = prompt('Tytuł:', title || hostOf(url)) ?? hostOf(url);
      const item = { id: uid(), type: isYt ? 'yt' : 'link', title: title.trim() || hostOf(url), url, html: '', created: Date.now(), mod: Date.now() };
      t.items.push(item); touch(t); save(); emit('material'); return go(`#/item/${t.id}/${item.id}`);
    }
    title = prompt('Tytuł notatki:', 'Notatka ' + (t.items.filter(i => i.type === 'note').length + 1)); if (title == null) return;
    const item = { id: uid(), type: 'note', title: title.trim() || 'Notatka', url: '', html: '', created: Date.now(), mod: Date.now() };
    t.items.push(item); touch(t); save(); emit('material'); go(`#/item/${t.id}/${item.id}`);
    setTimeout(() => $('#editor')?.focus(), 80);
  },
  'item-rename': el => { const t = topicById(el.dataset.tid), it = t.items.find(x => x.id === el.dataset.id); const n = prompt('Tytuł:', it.title); if (n?.trim()) { it.title = n.trim(); touch(t); save(); render(); } },
  // usuwanie jednym stuknięciem z listy tematu (z możliwością cofnięcia przez kilka sekund)
  'item-quickdel': el => {
    const t = topicById(el.dataset.tid), i = t?.items.findIndex(x => x.id === el.dataset.id); if (!t || i < 0) return;
    const [it] = t.items.splice(i, 1); touch(t); save(); render();
    document.querySelector('.undobar')?.remove();
    const bar = document.createElement('div'); bar.className = 'undobar';
    bar.innerHTML = `<span class="grow">Usunięto: ${esc(it.title || 'materiał')}</span><button class="sm">↩ Cofnij</button>`;
    bar.querySelector('button').onclick = () => { if (!t.items.some(x => x.id === it.id)) t.items.splice(Math.min(i, t.items.length), 0, it); touch(t); save(); bar.remove(); toast('Przywrócono ✓'); render(); };
    document.body.append(bar); setTimeout(() => bar.remove(), 7000);
  },
  'item-del': el => {
    const t = topicById(el.dataset.tid); if (!confirm('Usunąć ten materiał razem z notatkami?')) return;
    t.items = t.items.filter(x => x.id !== el.dataset.id); touch(t); save(); go(`#/topic/${t.id}`);
  },
  'note-ai': async el => {
    const t = topicById(el.dataset.tid), it = t.items.find(x => x.id === el.dataset.id);
    const text = htmlText($('#editor')?.innerHTML || it.html).trim();
    if (text.length < 20) return toast('Notatka jest za krótka');
    const marked = [...new DOMParser().parseFromString(it.html || '', 'text/html').querySelectorAll('mark')].map(m => m.textContent.trim()).filter(Boolean);
    toast('✨ AI tworzy fiszki…', 60000);
    try {
      const cards = await aiCards([], { style: 'mix', count: 'auto', extra: marked.length ? `Szczególnie uwzględnij zakreślone fragmenty: ${marked.join(' | ')}` : '' }, `Tytuł: ${it.title}\n\n${text}`);
      SCAN = { files: [], cards, busy: '' };
      DRAFT = freshDraft('scan', (t.deckIds || [])[0]); DRAFT.fromHash = '#/add';
      toast(`Gotowe: ${cards.length} propozycji`); go('#/add');
    } catch (e) { toast('Błąd AI: ' + e.message, 5000); }
  },
});

// ============================================================ Galeria zdjęć w temacie
let LB = null;   // podgląd pełnoekranowy { tid, iid, i }
function galleryHTML(t, it) {
  const imgs = it.images || [];
  const lb = LB && LB.iid === it.id && imgs[LB.i] ? imgs[LB.i] : null;
  return `<div class="gallery">${imgs.map((g, i) => `<figure data-act="gal-open" data-i="${i}" data-iid="${it.id}" data-tid="${t.id}">
      ${IMG[g.id] ? `<img src="${IMG[g.id]}" alt="" loading="lazy">` : '<div class="muted small">brak obrazu</div>'}${g.cap ? `<figcaption>${esc(g.cap)}</figcaption>` : ''}</figure>`).join('')}
    <button class="gal-add" data-act="gal-add" data-tid="${t.id}" data-id="${it.id}">➕<small>Dodaj zdjęcia</small></button></div>
    ${lb ? `<div class="lightbox">
      <div class="row nowrap lb-top"><span class="grow small">${LB.i + 1} / ${imgs.length}</span><button class="iconbtn" data-act="gal-close" style="color:#fff">✕</button></div>
      <img src="${IMG[lb.id] || ''}" alt="">
      <input id="gal-cap" value="${esc(lb.cap || '')}" placeholder="Podpis zdjęcia…">
      <div class="row nowrap"><button class="grow" data-act="gal-nav" data-d="-1" ${LB.i ? '' : 'disabled'}>‹</button>
        <button class="grow" data-act="gal-occl">🖼️ Fiszka z lukami</button><button class="grow" data-act="gal-atlas">🫀 Atlas</button>
        <button class="grow" data-act="gal-nav" data-d="1" ${LB.i < imgs.length - 1 ? '' : 'disabled'}>›</button></div>
      <button class="danger sm" data-act="gal-del">Usuń zdjęcie</button></div>` : ''}`;
}
const lbCtx = () => { const t = topicById(LB.tid), it = t?.items.find(x => x.id === LB.iid); return { t, it, img: it?.images[LB.i] }; };
document.addEventListener('change', e => {
  if (e.target.id !== 'gal-cap' || !LB) return;
  const { t, img } = lbCtx(); if (img) { img.cap = e.target.value.trim(); touch(t); save(); }
});
Object.assign(ACTIONS, {
  'gal-add': el => {
    const t = topicById(el.dataset.tid), it = t?.items.find(x => x.id === el.dataset.id); if (!it) return;
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = true; i.style.display = 'none'; document.body.append(i);
    i.onchange = async () => {
      const files = [...i.files]; i.remove(); if (!files.length) return;
      toast(`Dodaję ${files.length} zdjęć…`, 20000);
      for (const f of files) { try { it.images.push({ id: await putImage(await compressImage(f)), cap: '' }); } catch { /* pomijamy uszkodzony plik */ } }
      touch(t); save(); toast(`Dodano ${files.length} ✓`); render();
    };
    i.click();
  },
  'gal-open': el => { LB = { tid: el.dataset.tid, iid: el.dataset.iid, i: +el.dataset.i }; render(); },
  'gal-close': () => { LB = null; render(); },
  'gal-nav': el => { LB.i += +el.dataset.d; render(); },
  'gal-del': () => {
    const { t, it } = lbCtx(); if (!confirm('Usunąć to zdjęcie z galerii?')) return;
    it.images.splice(LB.i, 1); touch(t); save(); LB = it.images.length ? { ...LB, i: Math.min(LB.i, it.images.length - 1) } : null; render();
  },
  'gal-occl': () => { const { img } = lbCtx(); LB = null; DRAFT = freshDraft('occl'); DRAFT.imageId = img.id; DRAFT.title = img.cap || ''; DRAFT.fromHash = '#/add'; go('#/add'); },
  'gal-atlas': () => {
    const { img } = lbCtx(); LB = null;
    const a = touch({ id: uid(), name: img.cap || 'Rycina z galerii', imageId: img.id, marks: [], created: Date.now() });
    S.atlases.push(a); save(); AT = null; go('#/atlas/' + a.id);
  },
});
window.addEventListener('hashchange', () => { LB = null; });

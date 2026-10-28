'use strict';
/* 🏫 Klasy: zakładasz klasę (albo dołączasz kodem), udostępniasz klasie swoje zestawy fiszek – każdy członek widzi
   zestawy wszystkich i może je dodać do siebie – a obok jest czat grupowy całej klasy.
   Dane w Supabase (tabele classes / class_members / class_decks / class_msgs, RLS: widzą tylko członkowie).
   Wszystko od innych osób przechodzi przez sanitize (sNote, sStr) zanim trafi do widoku albo do Twoich talii. */
let CLS = { list: null, cur: null, tab: 'decks', decks: [], msgs: [], members: [], prev: null, busy: false, err: '', join: '', poll: 0, ch: null };
const CLS_MISSING = 'Baza nie ma jeszcze klas – host musi uruchomić nowy supabase.sql (Panel hosta → Aktualizacja bazy).';
const clsErr = e => /does not exist|schema cache|relation|function/i.test(e?.message || '') ? CLS_MISSING : /class full/.test(e?.message || '') ? 'Klasa jest pełna (200 osób)' : /too many/.test(e?.message || '') ? 'Masz już 20 klas' : /rate limit/.test(e?.message || '') ? 'Za szybko – chwila przerwy' : 'Błąd: ' + (e?.message || e);
const clsNick = () => (S.profile.nick || 'Gracz').slice(0, 24);
const sClass = c => c && { id: sStr(c.id, 40), code: sStr(c.code, 6), name: sStr(c.name, 60) || 'Klasa', owner: sStr(c.owner, 40) };
async function clsLoad() {
  if (!cloudOn()) return; CLS.busy = true;
  try { const r = await SB.from('classes').select('id,code,name,owner').order('created_at'); if (r.error) throw r.error; CLS.list = (r.data || []).map(sClass); CLS.err = ''; }
  catch (e) { CLS.err = clsErr(e); CLS.list = []; }
  CLS.busy = false; if (parseRoute().parts[0] === 'class') render();
}
async function clsOpen(id) {
  CLS.cur = id; CLS.prev = null;
  const [m, d] = await Promise.all([SB.from('class_members').select('user_id,nick,joined_at').eq('class_id', id).order('joined_at'), SB.from('class_decks').select('id,owner,nick,name,n,updated_at').eq('class_id', id).order('updated_at', { ascending: false })]);
  if (m.error || d.error) { CLS.err = clsErr(m.error || d.error); return render(); }
  CLS.members = (m.data || []).map(x => ({ id: sStr(x.user_id, 40), nick: sStr(x.nick, 24) || 'Gracz' }));
  CLS.decks = (d.data || []).map(x => ({ id: sStr(x.id, 120), owner: sStr(x.owner, 40), nick: sStr(x.nick, 24) || 'Gracz', name: sStr(x.name, 80) || 'Zestaw', n: sInt(x.n, 0, 1e5), t: Date.parse(x.updated_at) || 0 }));
  await clsMsgs(); clsLive(id); render();
}
async function clsMsgs() {
  const id = CLS.cur; if (!id) return;
  const r = await SB.from('class_msgs').select('id,from_id,nick,body,created_at').eq('class_id', id).order('id', { ascending: false }).limit(100);
  if (r.error) return;
  const fresh = (r.data || []).map(x => ({ id: sInt(x.id, 0, 1e15), from: sStr(x.from_id, 40), nick: sStr(x.nick, 24) || 'Gracz', body: sStr(x.body, 1000), t: Date.parse(x.created_at) || 0 })).reverse();
  const changed = fresh.length !== CLS.msgs.length || fresh.at(-1)?.id !== CLS.msgs.at(-1)?.id; CLS.msgs = fresh;
  if (changed && parseRoute().parts[0] === 'class' && CLS.tab === 'chat') clsChatRefresh();
}
// nowe wiadomości: na żywo (Realtime) + zapasowo co 6 s, tylko gdy klasa jest otwarta
function clsLive(id) {
  try { if (CLS.ch) SB.removeChannel(CLS.ch); } catch { /* */ }
  try { CLS.ch = SB.channel('cls-' + id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'class_msgs', filter: 'class_id=eq.' + id }, () => clsMsgs()).subscribe(); } catch { CLS.ch = null; }
  clearInterval(CLS.poll); CLS.poll = setInterval(() => { if (parseRoute().parts[0] !== 'class' || CLS.cur !== id || document.hidden) return; clsMsgs(); }, 6000);
}
// czat odświeżany bez przerysowania całego ekranu (nie gubi wpisywanego tekstu)
function clsChatRefresh() {
  const box = document.querySelector('.cls-chat .gc-list'); if (!box) return render();
  const end = box.scrollHeight - box.scrollTop - box.clientHeight < 60; box.innerHTML = clsMsgsHTML(); if (end) box.scrollTop = box.scrollHeight;
}
async function clsCreate(name) {
  name = String(name || '').trim().slice(0, 60); if (!name) return toast('Podaj nazwę klasy');
  for (let i = 0; i < 4; i++) {
    const code = roomCode(), r = await SB.from('classes').insert({ code, name, owner: myId() }).select('id').single();
    if (r.error) { if (/duplicate|unique/i.test(r.error.message)) continue; return toast(clsErr(r.error), 5000); }
    const m = await SB.from('class_members').insert({ class_id: r.data.id, user_id: myId(), nick: clsNick() });
    if (m.error) return toast(clsErr(m.error), 5000);
    S.stats.classes = (S.stats.classes || 0) + 1; save(); toast(`🏫 Klasa „${name}” gotowa – kod: ${code}`, 4000); await clsLoad(); return go('#/class/' + r.data.id);
  }
}
async function clsJoin(code) {
  code = String(code || '').trim().toUpperCase(); if (!/^[A-Z0-9]{6}$/.test(code)) return toast('Kod klasy ma 6 znaków');
  const r = await SB.rpc('join_class', { p_code: code, p_nick: clsNick() });
  if (r.error) return toast(clsErr(r.error), 5000);
  if (!r.data) return toast('Nie ma klasy o tym kodzie');
  CLS.join = ''; toast('🏫 Dołączono do klasy!'); await clsLoad(); go('#/class/' + r.data);
}
// 📤 udostępnienie talii klasie (tylko tekst: podstawowe i z lukami, bez zdjęć) – kolejne udostępnienie aktualizuje zestaw
async function clsShareDeck(deckId) {
  const d = deckById(deckId), id = CLS.cur; if (!d || !id) return;
  const notes = S.notes.filter(n => n.deckId === d.id && (n.type === 'basic' || n.type === 'cloze')).slice(0, 3000).map(shareNote);
  if (!notes.length) return toast('Ta talia nie ma fiszek tekstowych');
  const r = await SB.from('class_decks').upsert({ id: `${id}:${d.id}`, class_id: id, owner: myId(), nick: clsNick(), name: d.name.replace(/^(👥|🏫)\s*/, '').slice(0, 80), notes, n: notes.length, updated_at: new Date().toISOString() });
  if (r.error) return toast(clsErr(r.error), 5000);
  toast(`📤 „${d.name}” udostępniona klasie (${notes.length} fiszek)`); CLS.pick = false; clsOpen(id);
}
async function clsDeckNotes(rowId) {
  const r = await SB.from('class_decks').select('notes,name').eq('id', rowId).maybeSingle();
  if (r.error || !r.data) { toast(clsErr(r.error || 'brak zestawu')); return null; }
  return { name: sStr(r.data.name, 80), notes: (Array.isArray(r.data.notes) ? r.data.notes : []).slice(0, 3000).map(sNote).filter(Boolean) };
}
// 📥 do moich talii: osobna talia „🏫 nazwa”; ponowne dodanie dokłada tylko nowe fiszki
async function clsAddDeck(rowId) {
  const x = await clsDeckNotes(rowId); if (!x) return;
  let d = S.decks.find(y => y.clsSrc === rowId); if (!d) { d = newDeck('🏫 ' + x.name); d.clsSrc = rowId; touch(d); }
  const have = new Set(S.notes.filter(n => n.deckId === d.id).map(n => (n.type === 'cloze' ? n.text : n.front || '').trim().toLowerCase()));
  let n = 0;
  for (const s of x.notes) { const key = (s.type === 'cloze' ? s.text : s.front || '').trim().toLowerCase(); if (!key || have.has(key)) continue; have.add(key);
    if (s.type === 'cloze') addNote({ deckId: d.id, type: 'cloze', text: s.text, extra: s.extra || '', hint: s.hint || '' });
    else addNote({ deckId: d.id, type: 'basic', front: s.front || '', back: s.back || '', hint: s.hint || '', extra: s.extra || '', reverse: !!s.reverse });
    n++; }
  save(); emit('cardsAdded', n); toast(n ? `📥 Dodano ${n} ${plural(n, 'fiszkę', 'fiszki', 'fiszek')} do „${d.name}”` : 'Masz już wszystkie fiszki z tego zestawu', 4000);
}
async function clsSend(text) {
  text = String(text || '').trim().slice(0, 1000); if (!text || !CLS.cur) return;
  const r = await SB.from('class_msgs').insert({ class_id: CLS.cur, from_id: myId(), nick: clsNick(), body: text });
  if (r.error) return toast(clsErr(r.error), 4000);
  S.stats.classMsgs = (S.stats.classMsgs || 0) + 1; clsMsgs();
}
// ---------- widoki
const clsHead = (t, back) => `<div class="row nowrap"><button class="iconbtn" data-go="${back}">‹</button><h1 class="grow" style="margin:0">${t}</h1></div>`;
const clsMsgsHTML = () => CLS.msgs.length ? CLS.msgs.map(x => `<div class="gc-m${x.from === myId() ? ' me' : ''}">${x.from === myId() ? '' : `<small>${esc(x.nick)}</small>`}<span>${esc(x.body)}</span><i>${new Date(x.t).toLocaleString('pl-PL', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</i></div>`).join('')
  : '<p class="small muted center" style="margin:18px 0">Napisz pierwszą wiadomość do klasy 👋</p>';
function clsListView() {
  if (!cloudOn()) return { tab: 'friends', html: `${clsHead('🏫 Klasa', '#/rank')}<div class="card center"><div style="font-size:54px">🏫</div><p>Klasy działają po zalogowaniu – wtedy koledzy widzą Twoje zestawy, a Ty ich, i macie wspólny czat.</p><button class="primary block" data-go="#/more">🔑 Zaloguj się</button></div>` };
  if (CLS.list === null && !CLS.busy) clsLoad();
  const L = CLS.list || [];
  return { tab: 'friends', html: `${clsHead('🏫 Klasa', '#/rank')}
  ${CLS.err ? `<div class="card"><p class="bad" style="margin:0">${esc(CLS.err)}</p></div>` : ''}
  ${L.length ? `<div class="list">${L.map(c => `<button class="card row nowrap cls-item" data-go="#/class/${c.id}"><span class="cls-ic">🏫</span><div class="grow" style="text-align:left"><b>${esc(c.name)}</b><div class="small muted">kod ${esc(c.code)}${c.owner === myId() ? ' · 👑 Twoja' : ''}</div></div><span>›</span></button>`).join('')}</div>`
    : CLS.list ? '<div class="card center"><div style="font-size:48px">🏫</div><p style="margin:4px 0">Nie masz jeszcze klasy. Załóż ją i wyślij kod kolegom – albo dołącz kodem od kogoś.</p></div>' : '<p class="center muted">Wczytuję…</p>'}
  <div class="card"><h3 style="margin-top:0">➕ Załóż klasę</h3><div class="row nowrap"><input id="cls-name" class="grow" maxlength="60" placeholder="np. 3B, Anatomia – grupa 4"><button class="primary" data-act="cls-create">Załóż</button></div></div>
  <div class="card"><h3 style="margin-top:0">🔑 Dołącz kodem</h3><div class="row nowrap"><input id="cls-code" class="grow" maxlength="6" placeholder="Kod klasy, np. K7P2QX" autocapitalize="characters" autocomplete="off" value="${esc(CLS.join)}"><button data-act="cls-join">Dołącz</button></div></div>` };
}
function clsView(id) {
  const c = (CLS.list || []).find(x => x.id === id);
  if (!c) { if (CLS.list === null) clsLoad(); else if (!CLS.busy) return clsListView(); return { tab: 'friends', html: `${clsHead('🏫 Klasa', '#/class')}<p class="center muted">Wczytuję…</p>` }; }
  if (CLS.cur !== id) { CLS.cur = id; CLS.decks = []; CLS.msgs = []; CLS.members = []; clsOpen(id); }
  const owner = c.owner === myId(), link = `${location.origin}${location.pathname}#/cjoin/${c.code}`, t = CLS.tab;
  const tabs = `<div class="seg cls-tabs">${[['decks', '📚', 'Zestawy'], ['chat', '💬', 'Czat'], ['people', '👥', 'Klasa']].map(([k, i, l]) => `<button class="${t === k ? 'on' : ''}" data-act="cls-tab" data-k="${k}"><i>${i}</i><span>${l}${k === 'decks' ? ` (${CLS.decks.length})` : k === 'people' ? ` (${CLS.members.length})` : ''}</span></button>`).join('')}</div>`;
  let body = '';
  if (t === 'decks') {
    const mine = S.decks.filter(d => S.notes.some(n => n.deckId === d.id && (n.type === 'basic' || n.type === 'cloze')) && !d.clsSrc);
    body = `${CLS.prev ? `<div class="card cls-prev"><div class="row nowrap"><b class="grow">👀 ${esc(CLS.prev.name)}</b><button class="sm ghost" data-act="cls-prev-close">✕</button></div><div class="pack-list">${CLS.prev.notes.slice(0, 60).map(n => n.type === 'cloze' ? `<div class="pack-it"><span class="tag">luka</span>${fmt(String(n.text).replace(/\{\{c\d+::(.*?)(::.*?)?\}\}/g, '[$1]'))}</div>` : `<div class="pack-it"><b>${fmt(n.front || '')}</b><span>${fmt(n.back || '')}</span></div>`).join('')}${CLS.prev.notes.length > 60 ? `<p class="small muted center">…i ${CLS.prev.notes.length - 60} więcej</p>` : ''}</div><button class="primary block" data-act="cls-add" data-id="${esc(CLS.prev.id)}">📥 Dodaj do moich talii</button></div>` : ''}
      ${CLS.decks.length ? CLS.decks.map(x => `<div class="card cls-deck"><div class="grow"><b>${esc(x.name)}</b><div class="small muted">${x.n} ${plural(x.n, 'fiszka', 'fiszki', 'fiszek')} · ${x.owner === myId() ? 'Ty' : esc(x.nick)} · ${new Date(x.t).toLocaleDateString('pl-PL')}</div></div>
        <div class="row nowrap"><button class="sm" data-act="cls-prev" data-id="${esc(x.id)}">👀</button><button class="sm primary" data-act="cls-add" data-id="${esc(x.id)}">📥 Do moich</button>${x.owner === myId() || owner ? `<button class="sm ghost" data-act="cls-unshare" data-id="${esc(x.id)}" aria-label="Usuń z klasy">🗑️</button>` : ''}</div></div>`).join('')
        : '<div class="card center"><p class="muted" style="margin:6px 0">Nikt jeszcze nie udostępnił zestawu. Bądź pierwszy!</p></div>'}
      <div class="card"><h3 style="margin-top:0">📤 Udostępnij swój zestaw</h3>${mine.length ? `<div class="row nowrap"><select id="cls-deck" class="grow">${mine.map(d => `<option value="${d.id}">${esc(d.name)} (${S.notes.filter(n => n.deckId === d.id).length})</option>`).join('')}</select><button class="primary" data-act="cls-share">Udostępnij</button></div><p class="small muted" style="margin:6px 0 0">Klasa widzi pytania i odpowiedzi (bez zdjęć). Udostępnij jeszcze raz, żeby zaktualizować.</p>` : '<p class="small muted" style="margin:0">Nie masz talii z fiszkami tekstowymi.</p>'}</div>`;
  } else if (t === 'chat') {
    body = `<div class="card cls-chat"><div class="gc-list">${clsMsgsHTML()}</div><div class="gc-quick">${['👍', '🔥', '📚 kto się uczy?', '🆘 pomocy', '✅ zrobione'].map(q => `<button data-act="cls-quick" data-q="${esc(q)}">${q}</button>`).join('')}</div>
      <form class="gc-form" onsubmit="return false"><input id="cls-in" maxlength="1000" placeholder="Napisz do klasy…" autocomplete="off" enterkeyhint="send"><button class="primary" data-act="cls-send">➤</button></form></div>`;
    setTimeout(() => { const b = document.querySelector('.cls-chat .gc-list'); if (b) b.scrollTop = b.scrollHeight; }, 0);
  } else {
    body = `<div class="card center"><div class="small muted">Kod klasy</div><div class="coop-code">${esc(c.code)}</div><button class="sm" data-act="cls-invite" data-link="${esc(link)}" data-code="${esc(c.code)}">📤 Zaproś do klasy</button></div>
      <div class="card"><h3 style="margin-top:0">Członkowie (${CLS.members.length})</h3>${CLS.members.map(m => `<div class="row nowrap cls-mem"><span class="g-av">🙂</span><b class="grow">${esc(m.nick)}${m.id === myId() ? ' <small>(Ty)</small>' : ''}${m.id === c.owner ? ' 👑' : ''}</b>${owner && m.id !== myId() ? `<button class="sm ghost" data-act="cls-kick" data-id="${esc(m.id)}">Usuń</button>` : ''}</div>`).join('')}</div>
      <button class="ghost block" data-act="cls-leave">${owner ? '🗑️ Usuń klasę' : '🚪 Opuść klasę'}</button>`;
  }
  return { tab: 'friends', html: `${clsHead('🏫 ' + esc(c.name), '#/class')}${CLS.err ? `<p class="bad small">${esc(CLS.err)}</p>` : ''}${tabs}${body}` };
}
ROUTES.class = (parts = []) => parts[1] ? clsView(parts[1]) : clsListView();
ROUTES.cjoin = (parts = []) => { if (parts[1]) CLS.join = parts[1].toUpperCase().slice(0, 6); if (cloudOn() && CLS.join) setTimeout(() => clsJoin(CLS.join), 0); return clsListView(); };
HUB_OF.class = HUB_OF.cjoin = 'friends';
if (Array.isArray(HUBS.friends) && !HUBS.friends.some(x => x[0] === 'class')) HUBS.friends.push(['class', '🏫', 'Klasa']);
const clsRoute0 = ROUTES.class;
ROUTES.class = (...a) => { const v = clsRoute0(...a); if (!v || v.focus || typeof hubNav !== 'function') return v; LAST_HUB.friends = 'class';
  return { ...v, tab: 'friends', html: hubNav('friends', 'class') + (typeof stripBack === 'function' ? stripBack(v.html) : v.html) }; };
document.addEventListener('keydown', e => { if (e.target.id === 'cls-in' && e.key === 'Enter') { e.preventDefault(); ACTIONS['cls-send'](); } });
Object.assign(ACTIONS, {
  'cls-create': () => clsCreate($('#cls-name')?.value),
  'cls-join': () => clsJoin($('#cls-code')?.value),
  'cls-tab': el => { CLS.tab = el.dataset.k; render(); if (CLS.tab === 'chat') clsMsgs(); },
  'cls-share': () => clsShareDeck($('#cls-deck')?.value),
  'cls-prev': async el => { const x = await clsDeckNotes(el.dataset.id); if (x) { CLS.prev = { id: el.dataset.id, ...x }; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } },
  'cls-prev-close': () => { CLS.prev = null; render(); },
  'cls-add': el => clsAddDeck(el.dataset.id),
  'cls-unshare': async el => { if (!confirm('Usunąć ten zestaw z klasy? (u osób, które go dodały, zostaje)')) return; const r = await SB.from('class_decks').delete().eq('id', el.dataset.id); if (r.error) return toast(clsErr(r.error)); clsOpen(CLS.cur); },
  'cls-send': () => { const i = $('#cls-in'); if (!i) return; const v = i.value; i.value = ''; clsSend(v); },
  'cls-quick': el => clsSend(el.dataset.q),
  'cls-invite': el => { const t = `🏫 Dołącz do mojej klasy w Fiszkach – kod: ${el.dataset.code}`; if (navigator.share) navigator.share({ title: 'Fiszki – klasa', text: t, url: el.dataset.link }).catch(() => {}); else { navigator.clipboard?.writeText(`${t} ${el.dataset.link}`); toast('📋 Skopiowano zaproszenie'); } },
  'cls-kick': async el => { if (!confirm('Usunąć tę osobę z klasy?')) return; const r = await SB.from('class_members').delete().eq('class_id', CLS.cur).eq('user_id', el.dataset.id); if (r.error) return toast(clsErr(r.error)); clsOpen(CLS.cur); },
  'cls-leave': async () => {
    const c = (CLS.list || []).find(x => x.id === CLS.cur); if (!c) return; const own = c.owner === myId();
    if (!confirm(own ? `Usunąć klasę „${c.name}” razem z czatem i zestawami? Tego nie da się cofnąć.` : `Opuścić klasę „${c.name}”?`)) return;
    const r = own ? await SB.from('classes').delete().eq('id', c.id) : await SB.from('class_members').delete().eq('class_id', c.id).eq('user_id', myId());
    if (r.error) return toast(clsErr(r.error)); clearInterval(CLS.poll); CLS.cur = null; await clsLoad(); go('#/class');
  },
});

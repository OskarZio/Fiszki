'use strict';
/* 👥 Wspólna talia: Ty i znajomi dodajecie fiszki do jednej talii, każdy uczy się z własnym postępem.
   Bez zmian w bazie: zmiany lecą jako ukryte wiadomości czatu między znajomymi (tabela messages, limit ~2 kB):
     {sdi: {id, name, owner, members}, text}  – zaproszenie (widoczne w czacie, z przyciskiem „Dołącz”)
     {sd: id, notes: [...]}                   – paczka nowych / zmienionych fiszek (ukryta)
     {sd: id, del: [noteId…]}                 – usunięte fiszki (ukryta)
     {sd: id, members: [...]}                 – nowa lista członków (ukryta)
   Fiszki zachowują swoje id u wszystkich, więc zmiana jednej osoby nadpisuje starszą wersję (nowsze „mod” wygrywa).
   Zdjęcia nie są przesyłane (za duże na wiadomość) – tekst, luki, skojarzenia tak. */

const SHARE_FIELDS = ['id', 'type', 'front', 'back', 'hint', 'extra', 'text', 'reverse', 'title', 'created', 'mod'];
const sharedDecks = () => S.decks.filter(d => d.share?.id);
const deckByShare = sid => S.decks.find(d => d.share?.id === sid);
const shareNote = n => Object.fromEntries(SHARE_FIELDS.filter(k => n[k] !== undefined && n[k] !== '').map(k => [k, n[k]]));

// paczki po ≤ 1700 znaków (limit wiadomości ~2 kB)
function shareBundles(notes) {
  const out = []; let cur = [], size = 0;
  for (const n of notes) {
    const j = JSON.stringify(shareNote(n)); if (j.length > 1700) continue;
    if (size + j.length > 1700 && cur.length) { out.push(cur); cur = []; size = 0; }
    cur.push(shareNote(n)); size += j.length + 1;
  }
  if (cur.length) out.push(cur);
  return out;
}
const friendIds = () => new Set((CLOUD_FRIENDS || []).map(f => f.id));
async function sendTo(uids, body) { for (const u of uids) if (u !== myId()) await sendMsg(u, 'text', body); }

// ---------- wysyłanie zmian (po zapisie, z opóźnieniem)
let shareTimer = null, sharePushing = false;
on('save', () => { if (!sharedDecks().length) return; clearTimeout(shareTimer); shareTimer = setTimeout(sharePush, 4000); });
async function sharePush() {
  if (sharePushing || !cloudOn()) return; sharePushing = true;
  try {
    const fr = friendIds();
    for (const d of sharedDecks()) {
      const sh = d.share, to = (sh.members || []).filter(u => u !== myId() && fr.has(u)); if (!to.length) continue;
      sh.sent = sh.sent || {};
      const notes = S.notes.filter(n => n.deckId === d.id && n.type !== 'occl');
      const changed = notes.filter(n => (n.mod || n.created || 0) > (sh.sent[n.id] || 0));
      const ids = new Set(notes.map(n => n.id)), gone = Object.keys(sh.sent).filter(id => !ids.has(id));
      if (!changed.length && !gone.length) continue;
      for (const b of shareBundles(changed)) await sendTo(to, { sd: sh.id, notes: b });
      if (gone.length) await sendTo(to, { sd: sh.id, del: gone.slice(0, 120) });
      changed.forEach(n => { sh.sent[n.id] = n.mod || n.created || Date.now(); }); gone.forEach(id => delete sh.sent[id]);
      touch(d);
    }
    DB.set('state', S);
  } catch (e) { console.warn('share push', e); } finally { sharePushing = false; }
}

// ---------- odbiór (wywoływane po każdym wczytaniu wiadomości)
function shareApply(m) {
  const b = m.body || {}, d = deckByShare(b.sd); if (!d) return false;
  const sh = d.share; sh.sent = sh.sent || {};
  if (b.members) sh.members = [...new Set([...(sh.members || []), ...b.members])];
  for (const x of b.notes || []) {
    if (!x?.id || (S.tomb[x.id] && S.tomb[x.id] >= (x.mod || 0))) continue;
    let n = noteById(x.id);
    if (n && (n.mod || 0) >= (x.mod || 0)) continue;
    if (!n) { n = { ...x, deckId: d.id }; S.notes.push(n); } else Object.assign(n, x, { deckId: d.id });
    n.mod = x.mod || Date.now(); syncCards(n); sh.sent[n.id] = n.mod;
  }
  for (const id of b.del || []) { const n = noteById(id); if (n && n.deckId === d.id) deleteNote(n, true); delete sh.sent[id]; }
  return true;
}
function shareScan() {
  if (typeof MSGS === 'undefined' || !cloudOn()) return;
  const me = myId(); let changed = false;
  for (const d of sharedDecks()) {   // każda wspólna talia ma własny „przeczytane do”
    const sh = d.share, last = +(sh.lastIn || 0);
    const list = MSGS.filter(m => m.to_id === me && m.body?.sd === sh.id && m.id > last).sort((a, b) => a.id - b.id);
    for (const m of list) { if (shareApply(m)) changed = true; sh.lastIn = m.id; }
    if (list.length) touch(d);
  }
  // ukryte wiadomości od razu „przeczytane”, żeby nie nabijały licznika
  const hidden = MSGS.filter(m => m.to_id === me && m.body?.sd && !m.read_at);
  if (hidden.length) { const now = new Date().toISOString(); hidden.forEach(m => { m.read_at = now; }); SB.from('messages').update({ read_at: now }).in('id', hidden.map(m => m.id)).then(() => {}, () => {}); }
  if (changed || hidden.length) { save(); if (['deck', '', 'chat', 'inbox'].includes(parseRoute().parts[0])) render(); }
}
const shHandle0 = handleMsgs;
handleMsgs = (...a) => { const r = shHandle0(...a); try { shareScan(); } catch (e) { console.warn(e); } return r; };

// ---------- zaproszenie / dołączenie / opuszczenie
async function shareInvite(d, fid) {
  if (!cloudOn()) return toast('Wspólna talia działa po zalogowaniu');
  if (!d.share) { d.share = { id: 'sd' + uid(), owner: myId(), members: [myId()], sent: {} }; }
  const sh = d.share;
  if (sh.members.includes(fid)) return toast('Ten znajomy już jest w tej talii');
  sh.members = [...sh.members, fid]; touch(d); save();
  const f = (CLOUD_FRIENDS || []).find(x => x.id === fid);
  await sendMsg(fid, 'text', { sdi: { id: sh.id, name: d.name, owner: sh.owner, members: sh.members }, text: `👥 Zapraszam Cię do wspólnej talii „${d.name}”` });
  // nowa osoba dostaje od razu wszystkie fiszki
  const notes = S.notes.filter(n => n.deckId === d.id && n.type !== 'occl');
  for (const b of shareBundles(notes)) await sendMsg(fid, 'text', { sd: sh.id, notes: b });
  notes.forEach(n => { sh.sent[n.id] = Math.max(sh.sent[n.id] || 0, n.mod || n.created || 0); });
  // pozostali członkowie dowiadują się o nowej osobie
  await sendTo(sh.members.filter(u => u !== fid && friendIds().has(u)), { sd: sh.id, members: sh.members });
  touch(d); save(); toast(`👥 Zaproszono ${f?.nick || 'znajomego'} do „${d.name}”`); render();
}
function shareAccept(m) {
  const inv = m.body?.sdi; if (!inv?.id) return;
  if (deckByShare(inv.id)) { toast('Już masz tę wspólną talię'); return go('#/deck/' + deckByShare(inv.id).id); }
  const d = newDeck('👥 ' + String(inv.name || 'Wspólna talia').replace(/^👥\s*/, '').slice(0, 60));
  d.share = { id: inv.id, owner: inv.owner, members: [...new Set([...(inv.members || []), myId()])], sent: {} };
  d.share.lastIn = m.id; touch(d); save();
  shareScan(); toast('👥 Dołączono do wspólnej talii'); go('#/deck/' + d.id);
}

// ---------- widok w talii
function shareCardHTML(d) {
  if (!cloudOn()) return '';
  const sh = d.share, fr = CLOUD_FRIENDS || [];
  const names = (sh?.members || []).map(u => u === myId() ? 'Ty' : fr.find(f => f.id === u)?.nick || 'znajomy');
  const can = fr.filter(f => !(sh?.members || []).includes(f.id));
  return `<details class="share-box"${sh ? ' open' : ''}><summary>👥 ${sh ? `Wspólna talia · ${names.length} os.` : 'Zrób z tego wspólną talię'}</summary>
    ${sh ? `<p class="small" style="margin:6px 0">Razem: <b>${names.map(esc).join(', ')}</b>. Nowe i zmienione fiszki trafiają do wszystkich (bez zdjęć), a każdy ma własny postęp nauki.</p>` : '<p class="small muted" style="margin:6px 0">Zaproś znajomych – wszyscy dodajecie fiszki do tej talii na kolokwium, a każdy uczy się po swojemu.</p>'}
    ${can.length ? `<div class="row nowrap"><select id="share-fid" class="grow">${can.map(f => `<option value="${f.id}">${esc(f.nick || 'Znajomy')}</option>`).join('')}</select><button class="sm primary" data-act="share-invite" data-id="${d.id}">Zaproś</button></div>`
      : `<p class="small muted" style="margin:0">${fr.length ? 'Wszyscy znajomi już są w tej talii.' : 'Dodaj znajomych w rankingu, żeby ich zaprosić.'}</p>`}
    ${sh ? `<button class="sm ghost" data-act="share-leave" data-id="${d.id}" style="margin-top:6px">Opuść wspólną talię (fiszki zostaną u Ciebie)</button>` : ''}</details>`;
}
Object.assign(ACTIONS, {
  'share-invite': el => { const d = deckById(el.dataset.id), fid = $('#share-fid')?.value; if (d && fid) shareInvite(d, fid); },
  'share-accept': el => { const m = MSGS.find(x => x.id === +el.dataset.id); if (m) shareAccept(m); },
  'share-leave': el => { const d = deckById(el.dataset.id); if (!d?.share || !confirm('Opuścić wspólną talię? Fiszki zostaną u Ciebie, ale przestaną się aktualizować.')) return; delete d.share; touch(d); save(); render(); },
});

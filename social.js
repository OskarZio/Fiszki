'use strict';
/* Znajomi: mini czat, prezenty (naklejki), przypomnienia o nauce i wyzwania na bitwę.
   Wiadomości leżą w Supabase (tabela messages, RLS: tylko między znajomymi). Nowe wiadomości przychodzą
   na żywo (Realtime) albo przy odpytywaniu co kilkadziesiąt sekund. Prezent: nadawca traci naklejkę,
   odbiorca ją dostaje – wpisy w ekwipunku mają id wiadomości, więc nic się nie dubluje między urządzeniami. */

let MSGS = [], INBOX_UID = null, INBOX_CH = null, inboxTimer = null, CHAT = { fid: null, pick: false, draft: '' }, msgBusy = false;
const MSG_TEXT_MAX = 300, CHALLENGE_TTL = 15 * MIN, NUDGE_GAP = 10 * MIN;
const myId = () => SB_USER?.id;
const friendById = id => CLOUD_FRIENDS.find(f => f.id === id);
const friendName = id => friendById(id)?.nick || 'Znajomy';
const unreadMsgs = fid => MSGS.filter(m => m.to_id === myId() && !m.read_at && (!fid || m.from_id === fid));
const seenKey = () => 'msgSeen-' + myId();
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* */ } };
const socialCount = () => { const k = 'soc_' + dayKey(Date.now()); S.stats[k] = (S.stats[k] || 0) + 1; save(); };

// ---------- wczytywanie i nasłuch
async function loadMsgs() {
  if (!cloudOn() || msgBusy) return; msgBusy = true;
  try {
    const me = myId();
    const r = await SB.from('messages').select('*').or(`from_id.eq.${me},to_id.eq.${me}`).order('id', { ascending: false }).limit(300);
    if (r.error) { if (!/does not exist|relation/i.test(r.error.message)) console.warn(r.error); return; }
    const fresh = (r.data || []).filter(m => !MSGS.some(x => x.id === m.id));
    MSGS = (r.data || []).slice().sort((a, b) => a.id - b.id);
    handleMsgs(fresh);
  } finally { msgBusy = false; }
}
function handleMsgs(fresh) {
  const me = myId(); let changed = false;
  // prezenty: przyznaj / odejmij naklejkę (idempotentnie, po id wiadomości)
  for (const m of MSGS) {
    if (m.kind !== 'gift' || !stickerById(m.body?.st)) continue;
    const n0 = S.items.length;
    if (m.to_id === me) addItem('sticker', m.body.st, 1, 'gift-in-' + m.id);
    if (m.from_id === me) addItem('sticker', m.body.st, -1, 'gift-out-' + m.id);
    changed ||= S.items.length !== n0;
  }
  if (changed) save();
  // powiadomienia tylko o nowych (przy pierwszym uruchomieniu nie zasypujemy starymi)
  const seen = +lsGet(seenKey()) || 0, maxId = Math.max(seen, ...MSGS.map(m => m.id));
  if (seen) for (const m of fresh.sort((x, y) => x.id - y.id)) if (m.to_id === me && m.id > seen && !m.read_at) notifyMsg(m);
  lsSet(seenKey(), maxId);
  updateMsgBadge();
  if (CHAT.fid && parseRoute().parts[0] === 'chat') markRead(CHAT.fid);
  rerenderIf(['chat', 'inbox', '', 'rank']);
}
function startInbox() {
  if (!cloudOn()) { INBOX_UID = null; return; }
  if (INBOX_UID === myId()) return;
  INBOX_UID = myId(); MSGS = [];
  try { if (INBOX_CH) SB.removeChannel(INBOX_CH); } catch { /* */ }
  try {
    INBOX_CH = SB.channel('inbox-' + INBOX_UID)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'to_id=eq.' + INBOX_UID }, () => loadMsgs())
      .subscribe();
  } catch (e) { console.warn('realtime', e); }
  loadMsgs();
}
// odpytywanie: szybko na otwartym czacie, rzadziej w tle (gdy Realtime nie działa)
function inboxTick() {
  clearTimeout(inboxTimer);
  if (cloudOn()) { startInbox(); if (document.visibilityState === 'visible') loadMsgs(); }
  inboxTimer = setTimeout(inboxTick, parseRoute().parts[0] === 'chat' ? 4000 : 30000);
}
on('start', () => setTimeout(inboxTick, 1500));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') inboxTick(); });

function updateMsgBadge() {
  const n = cloudOn() ? unreadMsgs().length : 0;
  // czerwony licznik wyzwań na zakładce „Bitwy”
  const ch = cloudOn() ? MSGS.filter(m => m.to_id === myId() && challengeOpen(m) && !m.read_at).length : 0, tab = document.querySelector('#tabs [data-tab=battles]');
  if (tab) { let bd = tab.querySelector('.unread'); if (ch) { if (!bd) { bd = document.createElement('i'); bd.className = 'unread tabbadge'; tab.append(bd); } bd.textContent = ch; } else bd?.remove(); }
  try { if (navigator.setAppBadge) n ? navigator.setAppBadge(n) : navigator.clearAppBadge(); } catch { /* */ }
}
async function markRead(fid) {
  const list = unreadMsgs(fid); if (!list.length) return;
  const now = new Date().toISOString(); list.forEach(m => { m.read_at = now; });
  updateMsgBadge();
  const r = await SB.from('messages').update({ read_at: now }).in('id', list.map(m => m.id));
  if (r.error) console.warn(r.error);
}

// ---------- powiadomienia
const msgSummary = m => {
  const who = friendName(m.from_id);
  if (m.kind === 'gift') { const s = stickerById(m.body.st); return [`🎁 ${who} podarował(a) Ci naklejkę!`, `${s?.e || ''} ${s?.name || ''} – jest już w Twoim albumie`]; }
  if (m.kind === 'nudge') return [`🔔 ${who} przypomina o nauce`, m.body?.text || 'Czas na fiszki! 📚'];
  if (m.kind === 'challenge') return [`⚔️ ${who} wyzywa Cię na bitwę!`, m.body?.deck ? `Talia: ${m.body.deck}` : 'Stuknij, żeby przyjąć'];
  return [`💬 ${who}`, m.body?.text || ''];
};
function notifyMsg(m) {
  const [title, body] = msgSummary(m);
  if (m.kind === 'gift') setTimeout(() => stickerFx(m.body.st, friendName(m.from_id)), 300);
  else if (typeof tick === 'function') { tick(988, .12, .1); setTimeout(() => tick(1319, .18, .1), 110); }
  msgPopup(m, title, body);
  if (document.visibilityState !== 'visible' && window.Notification?.permission === 'granted')
    navigator.serviceWorker?.ready.then(reg => reg.showNotification(title, { body, tag: 'msg-' + m.id, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: '#/chat/' + m.from_id } })).catch(() => {});
}
function msgPopup(m, title, body) {
  document.querySelector('.msgpop')?.remove();
  const el = document.createElement('div'); el.className = 'msgpop';
  const accept = m.kind === 'challenge' && challengeOpen(m);
  el.innerHTML = `<div class="grow"><b class="nm">${esc(title)}</b><div class="small muted nm">${esc(body)}</div></div>
    ${accept ? `<button class="sm primary" data-act="chat-accept" data-id="${m.id}">Przyjmij</button>` : ''}
    <button class="sm" data-go="#/chat/${esc(m.from_id)}">Otwórz</button><button class="iconbtn sm" data-act="msgpop-x">✕</button>`;
  document.body.append(el); setTimeout(() => el.remove(), accept ? 30000 : 9000);
}
async function askNotifications() {
  if (!window.Notification) return toast('Ta przeglądarka nie obsługuje powiadomień. Na iPhonie: dodaj aplikację do ekranu początkowego (Udostępnij → Do ekranu początkowego).', 6000);
  const p = await Notification.requestPermission();
  toast(p === 'granted' ? 'Powiadomienia włączone ✓' : 'Powiadomienia zablokowane – włącz je w ustawieniach telefonu', 4000); render();
}
const notifBtnHTML = () => window.Notification && Notification.permission === 'default'
  ? '<button class="sm block" data-act="notif-on">🔔 Włącz powiadomienia o wiadomościach</button>' : '';

// ---------- wysyłanie
async function sendMsg(fid, kind, body) {
  if (!cloudOn()) { toast('Zaloguj się na konto'); return null; }
  const r = await SB.from('messages').insert({ from_id: myId(), to_id: fid, kind, body }).select().single();
  if (r.error) {
    toast(/does not exist|relation/i.test(r.error.message) ? 'Baza nie ma jeszcze tabeli wiadomości – host musi ponownie uruchomić supabase.sql'
      : /row-level|policy/i.test(r.error.message) ? 'Możesz pisać tylko do znajomych z rankingu' : 'Błąd: ' + r.error.message, 5000);
    return null;
  }
  const m = r.data; if (m && !MSGS.some(x => x.id === m.id)) MSGS.push(m);
  return m;
}
const giftable = () => STICKERS.filter(s => itemCount('sticker', s.id) > 0);
const challengeOpen = m => m.kind === 'challenge' && Date.now() - Date.parse(m.created_at) < CHALLENGE_TTL && /^[A-Z0-9]{6}$/.test(m.body?.code || '');

// ---------- widoki
function msgBodyHTML(m, mine) {
  const b = m.body || {};
  if (m.kind === 'gift') {
    const s = stickerById(b.st); if (!s) return '🎁 Prezent';
    return `<div class="gift-st" style="--rc:${RARITY[s.r].color}"><span data-act="st-preview" data-id="${s.id}">${s.e}</span></div>
      <div>🎁 ${mine ? 'Podarowano' : 'Prezent dla Ciebie'}: <b>${esc(s.name)}</b> <small style="color:${RARITY[s.r].color}">${RARITY[s.r].name}</small></div>`;
  }
  if (m.kind === 'nudge') return `<div>🔔 <b>Przypomnienie:</b> ${esc(b.text || 'Czas na fiszki! 📚')}</div>${mine ? '' : '<button class="sm primary" data-go="#/study/all/flip">▶ Ucz się teraz</button>'}`;
  if (m.kind === 'challenge') {
    const open = challengeOpen(m);
    return `<div>⚔️ <b>Wyzwanie na bitwę</b>${b.deck ? ` · ${esc(b.deck)}` : ''}${b.n ? ` · ${+b.n} pytań` : ''}</div>
      ${!open ? '<small class="muted">wygasło</small>' : mine ? (typeof B !== 'undefined' && B?.code === b.code ? '<button class="sm" data-go="#/battle">Wróć do poczekalni</button>' : '<small class="muted">czeka na przeciwnika</small>')
        : `<button class="sm primary" data-act="chat-accept" data-id="${m.id}">⚔️ Przyjmij wyzwanie</button>`}`;
  }
  return esc(b.text || '');
}
const hhmm = t => { const d = new Date(t); return (dayKey(+d) === dayKey(Date.now()) ? '' : d.toLocaleDateString('pl', { day: 'numeric', month: 'short' }) + ' ') + d.toLocaleTimeString('pl', { hour: '2-digit', minute: '2-digit' }); };

ROUTES.chat = parts => {
  const fid = parts[1];
  if (!cloudOn()) return { tab: 'home', html: `<div class="card"><p>Czat działa po zalogowaniu na konto.</p><button class="primary" data-go="#/more">Zaloguj się</button></div>` };
  const f = friendById(fid);
  if (!f) { if (!CLOUD_FRIENDS.length) loadCloudFriends(); return { tab: 'home', html: `<div class="row nowrap"><button class="iconbtn" data-go="#/inbox">‹</button><h1 class="grow">Czat</h1></div><div class="card"><p class="muted">Ładuję znajomego…</p></div>` }; }
  if (CHAT.fid !== fid) CHAT = { fid, pick: false, draft: '' };
  const me = myId(), list = MSGS.filter(m => (m.from_id === me && m.to_id === fid) || (m.from_id === fid && m.to_id === me)).slice(-120);
  onMount(() => {
    markRead(fid); clearTimeout(inboxTimer); inboxTimer = setTimeout(inboxTick, 4000);
    const box = $('#chat-list'); if (box) box.scrollTop = box.scrollHeight;
    const inp = $('#chat-in'); if (!inp) return;
    inp.value = CHAT.draft;
    inp.addEventListener('input', () => { CHAT.draft = inp.value; });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); ACTIONS['chat-send'](); } });
  });
  const gifts = giftable();
  return { tab: 'home', html: `
  <div class="row nowrap"><button class="iconbtn" data-go="#/inbox">‹</button><span class="av">${avatarHTML({ avatar: f.avatar, avatarImg: f.avatar_img }, 36)}</span><h1 class="grow nm" style="font-size:24px">${esc(f.nick || 'Znajomy')}</h1></div>
  <div class="chat-tools">
    <button class="${CHAT.pick ? 'primary' : ''}" data-act="chat-pick">🎁 Podaruj</button>
    <button data-act="chat-nudge">🔔 Przypomnij</button>
    <button data-act="chat-challenge">⚔️ Wyzwij</button></div>
  ${CHAT.pick ? `<div class="card tight"><p class="small muted" style="margin-top:0">Wybierz naklejkę – zniknie z Twojego albumu i trafi do ${esc(f.nick || 'znajomego')}.</p>
    ${gifts.length ? `<div class="gift-pick">${gifts.map(s => `<button data-act="chat-gift" data-id="${s.id}" style="--rc:${RARITY[s.r].color}"><span>${s.e}</span><small>${esc(s.name)}</small><em>×${itemCount('sticker', s.id)}</em></button>`).join('')}</div>`
      : '<p class="small">Nie masz jeszcze naklejek do podarowania – zdobądź je w <a href="#/shop">skrzynkach</a>. (Startowe 👋👍😅 nie są do oddania.)</p>'}</div>` : ''}
  <div class="chat-list" id="chat-list">${list.length ? list.map(m => { const mine = m.from_id === me; return `<div class="msg ${mine ? 'me' : 'them'} k-${m.kind}">${msgBodyHTML(m, mine)}<small>${hhmm(m.created_at)}${mine && m.read_at ? ' · ✓✓' : ''}</small></div>`; }).join('')
    : `<p class="muted small center">Napisz pierwszą wiadomość, podaruj naklejkę albo wyzwij ${esc(f.nick || 'znajomego')} na bitwę 👋</p>`}</div>
  <div class="chat-input row nowrap"><input id="chat-in" class="grow" maxlength="${MSG_TEXT_MAX}" placeholder="Wiadomość…" autocomplete="off" enterkeyhint="send"><button class="primary" data-act="chat-send">➤</button></div>
  ${notifBtnHTML()}` };
};

ROUTES.inbox = () => {
  if (!cloudOn()) return { tab: 'home', html: `<div class="row nowrap"><button class="iconbtn" data-go="#/">‹</button><h1 class="grow">Wiadomości</h1></div><div class="card"><p>Wiadomości działają po zalogowaniu na konto.</p><button class="primary" data-go="#/more">Zaloguj się</button></div>` };
  const me = myId();
  const rows = CLOUD_FRIENDS.map(f => {
    const conv = MSGS.filter(m => m.from_id === f.id || m.to_id === f.id), last = conv[conv.length - 1];
    return { f, last, unread: unreadMsgs(f.id).length, t: last ? Date.parse(last.created_at) : 0 };
  }).sort((a, b) => b.t - a.t);
  const preview = m => { if (!m) return 'Brak wiadomości'; const [t, b] = msgSummary(m); return (m.from_id === me ? 'Ty: ' : '') + (m.kind === 'text' ? m.body?.text || '' : m.from_id === me ? t.replace(/^\S+\s/, '') : t); };
  return { tab: 'home', html: `
  <div class="row nowrap"><button class="iconbtn" data-go="#/">‹</button><h1 class="grow">Wiadomości</h1><button class="iconbtn" data-act="inbox-refresh">🔄</button></div>
  <div class="card">${rows.length ? rows.map(r => `<div class="rankrow" data-go="#/chat/${r.f.id}" style="cursor:pointer">
      <span class="av">${avatarHTML({ avatar: r.f.avatar, avatarImg: r.f.avatar_img }, 36)}</span>
      <div class="grow" style="min-width:0"><b class="nm" style="display:block">${esc(r.f.nick || 'Znajomy')}</b><div class="small muted nm">${esc(preview(r.last))}</div></div>
      ${r.unread ? `<span class="unread">${r.unread}</span>` : ''}</div>`).join('')
    : '<p class="muted small center">Dodaj znajomych w <a href="#/rank">rankingu</a>, żeby z nimi pisać.</p>'}</div>
  ${notifBtnHTML()}
  <p class="small muted">Prezent zabiera naklejkę z Twojego albumu i daje ją znajomemu. Przypomnienie i wyzwanie przychodzą jako powiadomienie.</p>` };
};

Object.assign(ACTIONS, {
  'msgpop-x': el => el.closest('.msgpop')?.remove(),
  'notif-on': askNotifications,
  'inbox-refresh': async () => { await loadCloudFriends(); await loadMsgs(); render(); },
  'chat-pick': () => { CHAT.pick = !CHAT.pick; render(); },
  'chat-send': async () => {
    const inp = $('#chat-in'), text = (inp?.value || '').trim().slice(0, MSG_TEXT_MAX); if (!text) return;
    inp.value = ''; CHAT.draft = '';
    const m = await sendMsg(CHAT.fid, 'text', { text });
    if (!m) { CHAT.draft = text; } render();
  },
  'chat-gift': async el => {
    const s = stickerById(el.dataset.id), f = friendById(CHAT.fid); if (!s || !f) return;
    if (itemCount('sticker', s.id) < 1) return toast('Nie masz już tej naklejki');
    if (!confirm(`Podarować ${s.e} ${s.name} dla ${f.nick || 'znajomego'}? Naklejka zniknie z Twojego albumu.`)) return;
    el.disabled = true;
    const m = await sendMsg(f.id, 'gift', { st: s.id }); if (!m) return render();
    addItem('sticker', s.id, -1, 'gift-out-' + m.id);
    if ((S.profile.showcase || []).includes(s.id) && !hasItem('sticker', s.id) && !isShiny(s.id)) { S.profile.showcase = S.profile.showcase.filter(x => x !== s.id); S.profile.mod = Date.now(); }
    socialCount(); CHAT.pick = false; save();
    stickerFx(s.id, `Dla ${f.nick || 'znajomego'}`); toast(`🎁 Wysłano ${s.name} ✓`); render();
  },
  'chat-nudge': async () => {
    const me = myId(), last = MSGS.filter(m => m.kind === 'nudge' && m.from_id === me && m.to_id === CHAT.fid).pop();
    if (last && Date.now() - Date.parse(last.created_at) < NUDGE_GAP) return toast('Przypomnienie już wysłane – daj znajomemu chwilę 😉');
    const texts = ['Czas na fiszki! 📚', 'Nie przerywaj serii 🔥', 'Powtórki czekają 🧠', 'Kto dziś więcej powtórek? 💪'];
    const m = await sendMsg(CHAT.fid, 'nudge', { text: texts[Math.random() * texts.length | 0] });
    if (m) { socialCount(); toast('🔔 Przypomnienie wysłane'); render(); }
  },
  'chat-challenge': async () => {
    const f = friendById(CHAT.fid); if (!f) return;
    if (typeof friendSetup !== 'function') return;
    const st = friendSetup(); if (!st) return;
    if (!confirm(`Wyzwać ${f.nick || 'znajomego'} na bitwę? (ustawienia jak w zakładce Bitwy${st.deckName ? ', talia: ' + st.deckName : ''})`)) return;
    hostRoom(st);
    const m = await sendMsg(f.id, 'challenge', { code: B.code, deck: st.deckName || (st.mode === 'mem' ? 'Gra pamięciowa' : ''), n: st.cards?.length || st.n || 0 });
    if (m) toast(`⚔️ Wyzwanie wysłane – czekaj na ${f.nick || 'znajomego'} w poczekalni`, 4000);
  },
  'chat-accept': el => {
    const m = MSGS.find(x => x.id === +el.dataset.id); el.closest('.msgpop')?.remove();
    if (!m || !challengeOpen(m)) return toast('To wyzwanie już wygasło');
    joinRoom(m.body.code);
  },
});

// ---------- wejścia: Start, ranking
const soHomeExtras0 = homeExtrasHTML;
homeExtrasHTML = function () {
  const base = soHomeExtras0(); if (!cloudOn() || S.settings.minimal) return base;
  const n = unreadMsgs().length;
  return base + `<button class="block quest-cta${n ? ' primary pulse' : ''}" data-go="#/inbox">💬 Wiadomości${n ? ` · ${n} ${plural(n, 'nowa', 'nowe', 'nowych')}` : ''}</button>`;
};
const soRank0 = ROUTES.rank;
ROUTES.rank = (...a) => {
  const r = soRank0(...a); if (!cloudOn() || !r?.html) return r;
  // przycisk czatu przy każdym znajomym
  const html = r.html.replace(/<button class="ghost sm" data-act="cloud-friend-del" data-id="([^"]+)">✕<\/button>/g, (all, id) => {
    const n = unreadMsgs(id).length;
    return `<div class="rk-btns"><button class="sm" data-go="#/chat/${id}">💬${n ? `<span class="unread">${n}</span>` : ''}</button>${all}</div>`;
  });
  return { ...r, html };
};

// Bitwy: znajomi z kontem – wyzwanie jednym kliknięciem
const soBattles0 = ROUTES.battles;
ROUTES.battles = (...a) => {
  const r = soBattles0(...a); if (!r?.html || !cloudOn()) return r;
  const open = MSGS.filter(m => m.to_id === myId() && challengeOpen(m));
  const card = `<div class="card"><div class="row nowrap"><h3 class="grow" style="margin:0">👥 Znajomi</h3><button class="sm ghost" data-go="#/inbox">💬 Wiadomości${unreadMsgs().length ? ` <span class="unread">${unreadMsgs().length}</span>` : ''}</button></div>
    ${open.map(m => `<div class="banner row nowrap"><span class="grow">⚔️ <b>${esc(friendName(m.from_id))}</b> wyzywa Cię${m.body?.deck ? ` · ${esc(m.body.deck)}` : ''}</span><button class="sm primary" data-act="chat-accept" data-id="${m.id}">Przyjmij</button></div>`).join('')}
    ${CLOUD_FRIENDS.length ? CLOUD_FRIENDS.map(f => `<div class="rankrow"><span class="av">${avatarHTML({ avatar: f.avatar, avatarImg: f.avatar_img }, 32)}</span>
        <b class="grow nm">${esc(f.nick || 'Znajomy')}</b><button class="sm" data-go="#/chat/${f.id}">💬</button><button class="sm primary" data-act="bt-challenge-friend" data-fid="${f.id}">⚔️ Wyzwij</button></div>`).join('')
      : '<p class="small muted">Dodaj znajomych w <a href="#/rank">rankingu</a> – potem wyzwiesz ich tutaj jednym kliknięciem.</p>'}
    <p class="small muted" style="margin-bottom:0">Wyzwanie używa zasad z „⚙️ Zasady bitwy” poniżej – znajomy dostanie powiadomienie.</p></div>`;
  const i = r.html.indexOf('<details class="card rules"');
  return { ...r, html: i < 0 ? r.html + card : r.html.slice(0, i) + card + r.html.slice(i) };
};
ACTIONS['bt-challenge-friend'] = el => { CHAT = { fid: el.dataset.fid, pick: false, draft: '' }; ACTIONS['chat-challenge'](); };

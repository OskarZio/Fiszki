'use strict';
/* 🍅 Zaczepki dla znajomych: jednym przyciskiem w czacie kupujesz (za 💎) pomidora, kwiatka, przytulasa, konfetti albo
   komunikat. Odbiorca widzi animację na cały ekran przy najbliższym wejściu do aplikacji (raz na zaczepkę).
   Wysyłane jako zwykła wiadomość czatu ({ fun, text }) – działa tylko między znajomymi (reguły bazy). */
const px8 = (rows, pal) => { const h = rows.length, w = rows[0].length; let r = '';
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${pal[ch]}"/>`; }));
  return `<svg class="px8" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${r}</svg>`; };
const TOMATO8 = px8(['....gg....', '...gGGg...', '..rrgrrr..', '.rRRrrrrr.', 'rRWRrrrrrd', 'rRRrrrrrrd', 'rrrrrrrrrd', 'rrrrrrrrdd', '.rrrrrrdd.', '..dddddd..'],
  { g: '#15803d', G: '#22c55e', r: '#dc2626', R: '#f87171', W: '#fff1f2', d: '#991b1b' });
const SPLAT8 = px8(['..r....r..r.', '.rrr..rrr...', 'r.rrrrrrrr.r', '..rrRrrrrr..', '.rrrrrrrRrr.', 'rrrRrrrrrrrr', '.rrrrrrrrrr.', '..rrrrRrrr..', 'r.rrrrrrrr.r', '.r..rrr..r..', '....r..r....'],
  { r: '#dc2626', R: '#f87171' });
const FUN = {
  tomato: { n: 'Pomidor', ic: () => '<img class="emo8 px" src="assets/e8/tomato.webp" alt="">', price: 25, txt: '🍅 Rzucam w Ciebie pomidorem!', say: n => `${n} rzucił(a) w Ciebie pomidorem!` },
  flower: { n: 'Kwiatek', ic: () => '<img class="emo8" src="assets/e8/sunflower.webp" alt="">', price: 25, txt: '🌻 Kwiatek dla Ciebie!', say: n => `${n} daje Ci kwiatka` },
  hug: { n: 'Przytulas', ic: () => '<img class="emo8" src="assets/e8/teddy.webp" alt="">', price: 25, txt: '🧸 Przytulas!', say: n => `${n} Cię przytula` },
  party: { n: 'Konfetti', ic: () => '<img class="emo8" src="assets/e8/popper.webp" alt="">', price: 40, txt: '🎉 Gratulacje!', say: n => `${n} świętuje z Tobą!` },
  shout: { n: 'Komunikat', ic: () => '<img class="emo8" src="assets/e8/megaphone.webp" alt="">', price: 60, txt: '', say: n => `${n} ma dla Ciebie komunikat` },
};
// wybór zaczepki (z czatu albo profilu znajomego)
function funPicker(fid, nick) {
  document.querySelector('.fun-pick')?.remove(); const ov = document.createElement('div'); ov.className = 'dmenu-ov fun-pick';
  ov.innerHTML = `<div class="dmenu" role="dialog"><h3 style="margin-top:0">🎯 Zaczep ${esc(nick || 'znajomego')}</h3><p class="small muted" style="margin:0 0 12px">Zobaczy animację na cały ekran przy najbliższym wejściu do aplikacji.</p>
    <div class="fun-grid">${Object.entries(FUN).map(([k, f]) => `<button class="fun-it" data-k="${k}"><span class="fun-ic">${f.ic()}</span><b>${f.n}</b><small>${f.price} 💎</small></button>`).join('')}</div>
    <div class="fun-shout" hidden><input id="fun-txt" maxlength="80" placeholder="Twój komunikat (max 80 znaków)…" autocomplete="off"><button class="primary" data-send="1">Wyślij · ${FUN.shout.price} 💎</button></div>
    <button class="ghost" data-x="1">Anuluj</button></div>`;
  const send = async (k, text) => { const f = FUN[k]; if (k === 'shout' && !text) return toast('Wpisz komunikat');
    if (typeof cleanNick === 'function' && typeof BAD_RE !== 'undefined' && BAD_RE.test(text || '')) return toast('Bez wulgaryzmów 🙂');
    if (!spend(f.price, 'fun-' + k)) return;
    const m = await sendMsg(fid, 'text', { fun: k, text: k === 'shout' ? `📣 ${text}` : f.txt });
    if (!m) { S.wallet.push({ id: uid(), n: f.price, why: 'fun-refund', t: Date.now() }); save(); return; }   // nie wysłano → zwrot
    ov.remove(); toast(`${f.n} wysłany ✓`, 2500); if (typeof render === 'function') render(); };
  ov.addEventListener('click', e => { const it = e.target.closest('.fun-it');
    if (it) { if (it.dataset.k === 'shout') { ov.querySelector('.fun-shout').hidden = false; ov.querySelector('#fun-txt').focus(); return; } return send(it.dataset.k); }
    if (e.target.closest('[data-send]')) return send('shout', (ov.querySelector('#fun-txt').value || '').trim());
    if (e.target === ov || e.target.closest('[data-x]')) ov.remove(); });
  document.body.append(ov);
}
// 🎬 animacja u odbiorcy – kolejka, każda zaczepka tylko raz (pamiętane id wiadomości)
const FUN_SEEN = () => { try { return new Set(JSON.parse(localStorage.getItem('funSeen') || '[]')); } catch { return new Set(); } };
let FUN_Q = [], FUN_ON = false;
function funShowNext() {
  if (FUN_ON || !FUN_Q.length) return; const m = FUN_Q.shift(), f = FUN[m.body.fun]; if (!f) return funShowNext(); FUN_ON = true;
  // obejrzana = przeczytana (nadawca nie cofnie jej już ze zwrotem kryształów)
  try { if (typeof SB !== 'undefined' && SB && m.id) SB.from('messages').update({ read_at: new Date().toISOString() }).eq('id', m.id).then(() => {}, () => {}); } catch { /* */ }
  const fr = (typeof CLOUD_FRIENDS !== 'undefined' ? CLOUD_FRIENDS : []).find(x => x.id === m.from_id), nick = fr?.nick || 'Znajomy';
  const ov = document.createElement('div'); ov.className = `fun-ov fun-${m.body.fun}`;
  ov.innerHTML = `${m.body.fun === 'tomato' ? `<div class="fun-fly"><img class="px" src="assets/e8/tomato.webp" alt="" style="width:100%;height:100%;image-rendering:pixelated"></div><div class="fun-splat">${SPLAT8}</div>` : `<div class="fun-big">${f.ic()}</div>`}
    <div class="fun-card"><b>${esc(f.say(nick))}</b>${m.body.fun === 'shout' ? `<p class="fun-msg">${esc((m.body.text || '').replace(/^📣\s*/, ''))}</p>` : ''}<button class="primary" data-x="1">${m.body.fun === 'tomato' ? '🧻 Wytrzyj się' : 'OK'}</button></div>`;
  const done = () => { ov.remove(); FUN_ON = false; setTimeout(funShowNext, 300); };
  ov.addEventListener('click', e => { if (e.target.closest('[data-x]')) done(); });
  document.body.append(ov);
  if (m.body.fun === 'party' && typeof confetti === 'function') setTimeout(() => confetti(220), 200);
  try { if (typeof bossSfx === 'function') bossSfx(m.body.fun === 'tomato' ? 'hit' : 'chest'); } catch { /* */ }
}
function funCheck() {
  if (typeof MSGS === 'undefined' || typeof myId !== 'function') return; const me = myId(), seen = FUN_SEEN(), weekAgo = Date.now() - 7 * 864e5;
  const fresh = MSGS.filter(m => m.to_id === me && m.body?.fun && FUN[m.body.fun] && !seen.has(m.id) && (Date.parse(m.created_at) || 0) > weekAgo);
  if (!fresh.length) return;
  fresh.forEach(m => seen.add(m.id)); try { localStorage.setItem('funSeen', JSON.stringify([...seen].slice(-300))); } catch { /* */ }
  FUN_Q.push(...fresh.sort((a, b) => a.id - b.id)); funShowNext();
}
if (typeof handleMsgs === 'function') { const hm0 = handleMsgs; handleMsgs = function (...a) { const r = hm0.apply(this, a); setTimeout(funCheck, 600); return r; }; }
ACTIONS['chat-fun'] = () => { const f = typeof friendById === 'function' && CHAT?.fid ? friendById(CHAT.fid) : null; funPicker(CHAT.fid, f?.nick); };

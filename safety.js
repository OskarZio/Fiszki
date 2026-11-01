'use strict';
/* 🛡️ Bezpieczeństwo społeczności: filtr wulgaryzmów (czat, nicki), zgłaszanie i blokowanie graczy.
   Te same reguły pilnuje baza (supabase.sql): brzydki nick → „Gracz”, zablokowany nie może pisać. */
const BAD_RE = /(k+u+r+w|ch+[uo]+j|(^|[^a-z])h+[uo]+j|p+i+e+r+d+o*l|j+e+b+a+[ćcnl]|j+e+b+i|p+i+z+d|s+k+u+r+w|d+z+i+w+k|p+e+d+a+[lł]|c+w+e+l|k+u+t+a+s|s+z+m+a+t+a|s+p+i+e+r+d|w+y+p+i+e+r+d|f+u+c+k|s+h+i+t|b+i+t+c+h|c+u+n+t|n+i+g+g|f+a+g+g?o?t|w+h+o+r+e|h+i+t+l+e+r)/i;
const normTxt = t => String(t || '').toLowerCase().replace(/[013457@$ąćęłńóśźż]/g, ch => ({ '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', 'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z' })[ch] || ch);
const isBad = t => BAD_RE.test(normTxt(t));
// maskuje całe słowa z wulgaryzmem (zostawia pierwszą literę)
const maskBad = t => String(t || '').replace(/[\p{L}\p{N}@$*]+/gu, w => isBad(w) ? w[0] + '*'.repeat(Math.max(2, w.length - 1)) : w);
const cleanNick = n => isBad(n) ? 'Gracz' : n;

// 🚫 blokowanie (lokalnie + w bazie, żeby zablokowany nie mógł pisać)
const blockedIds = () => (S.settings.blocked = Array.isArray(S.settings.blocked) ? S.settings.blocked : []);
const isBlocked = id => !!id && blockedIds().includes(String(id).replace(/^sb:/, ''));
async function blockPlayer(id, on = true) {
  const uid = String(id || '').replace(/^sb:/, ''); if (!uid) return;
  const L = blockedIds(); S.settings.blocked = on ? [...new Set([...L, uid])] : L.filter(x => x !== uid); save();
  try { if (typeof cloudOn === 'function' && cloudOn()) await (on ? SB.from('blocks').upsert({ user_id: SB_USER.id, blocked: uid }) : SB.from('blocks').delete().eq('user_id', SB_USER.id).eq('blocked', uid)); } catch { /* */ }
}
async function reportPlayer(id, reason, ctx) {
  const uid = String(id || '').replace(/^sb:/, ''); if (!uid || !(typeof cloudOn === 'function' && cloudOn())) return toast('Zgłaszanie działa po zalogowaniu');
  const r = await SB.from('reports').insert({ target: uid, reason, ctx: String(ctx || '').slice(0, 400) });
  toast(r.error ? (/rate/.test(r.error.message) ? 'Za dużo zgłoszeń – spróbuj później' : 'Nie udało się wysłać zgłoszenia') : '🚩 Zgłoszenie wysłane – dziękujemy!', 3500);
}
const REPORT_REASONS = [['nick', 'Wulgarny / obraźliwy nick'], ['chat', 'Obraźliwe wiadomości'], ['img', 'Nieodpowiednie zdjęcie'], ['cheat', 'Oszukiwanie'], ['spam', 'Spam / nękanie'], ['other', 'Inne']];
function reportDialog(id, nick) {
  document.querySelector('.rep-ov')?.remove(); const ov = document.createElement('div'); ov.className = 'dmenu-ov rep-ov';
  ov.innerHTML = `<div class="dmenu"><b style="font-size:18px">🚩 Zgłoś gracza ${esc(nick || '')}</b><p class="small muted" style="margin:0">Zgłoszenie trafia do twórcy aplikacji. Gracz nie wie, kto go zgłosił.</p>
    <div class="rep-reasons">${REPORT_REASONS.map(([k, l]) => `<label><input type="radio" name="rep" value="${k}"${k === 'nick' ? ' checked' : ''}> ${l}</label>`).join('')}</div>
    <textarea id="rep-ctx" rows="2" maxlength="400" placeholder="Opcjonalnie: co się stało?"></textarea>
    <label class="rep-also"><input type="checkbox" id="rep-block" checked> Zablokuj też tego gracza</label>
    <div class="row nowrap" style="gap:10px"><button class="grow ghost" data-x="1">Anuluj</button><button class="grow primary" data-send="1">Wyślij zgłoszenie</button></div></div>`;
  ov.addEventListener('click', async e => {
    if (e.target === ov || e.target.closest('[data-x]')) return ov.remove();
    if (e.target.closest('[data-send]')) { const reason = ov.querySelector('input[name=rep]:checked')?.value || 'other', ctx = ov.querySelector('#rep-ctx').value, bl = ov.querySelector('#rep-block').checked;
      ov.remove(); await reportPlayer(id, reason, ctx); if (bl) { await blockPlayer(id, true); render(); } }
  });
  document.body.append(ov);
}
setTimeout(() => {
  // profil gracza: przyciski Zgłoś / Zablokuj
  if (typeof playerView === 'function') { const pv0 = playerView; playerView = function (p) { pv0(p); const box = document.querySelector('.pl-ov .pl-card'); if (!box || p.me || !p.id) return;
    const b = isBlocked(p.id), row = document.createElement('div'); row.className = 'row nowrap pl-safety';
    row.innerHTML = `<button class="sm ghost grow" data-rep="1">🚩 Zgłoś</button><button class="sm ghost grow" data-blk="1">${b ? '✅ Odblokuj' : '🚫 Zablokuj'}</button>`;
    row.addEventListener('click', async e => { if (e.target.closest('[data-rep]')) reportDialog(p.id, p.nick);
      if (e.target.closest('[data-blk]')) { if (!b && !confirm(`Zablokować ${p.nick || 'gracza'}? Nie zobaczysz jego wiadomości, a on nie będzie mógł do Ciebie pisać.`)) return;
        await blockPlayer(p.id, !b); document.querySelector('.pl-ov')?.remove(); toast(b ? 'Odblokowano' : '🚫 Zablokowano', 2500); render(); } });
    box.insertBefore(row, box.lastElementChild); }; }
  // nicki: filtr przy wyświetlaniu
  if (typeof nickHTML === 'function') { const nk0 = nickHTML; nickHTML = (name, c, t) => nk0(cleanNick(name), c, t); }
  // czat: maskowanie wulgaryzmów przy wysyłaniu i wyświetlaniu, ukrywanie wiadomości od zablokowanych
  if (typeof msgBodyHTML === 'function') { const mb0 = msgBodyHTML; msgBodyHTML = (m, mine) => mb0(m?.body?.text ? { ...m, body: { ...m.body, text: maskBad(m.body.text) } } : m, mine); }
  if (typeof sendMsg === 'function') { const sm0 = sendMsg; sendMsg = (to, kind, body) => sm0(to, kind, body?.text ? { ...body, text: maskBad(body.text) } : body); }
  // czat z zablokowanym: zamiast rozmowy – informacja i przycisk odblokowania
  if (ROUTES.chat) { const ch0 = ROUTES.chat; ROUTES.chat = parts => isBlocked(parts[1]) ? { tab: 'home', html: `<div class="row nowrap"><button class="iconbtn" data-go="#/inbox">‹</button><h1 class="grow">Czat</h1></div>
    <div class="card center"><p>🚫 Ten gracz jest zablokowany – nie widzisz jego wiadomości, a on nie może do Ciebie pisać.</p><button data-act="unblock" data-id="${esc(parts[1])}">Odblokuj</button></div>` } : ch0(parts); }
  ACTIONS.unblock = async el => { await blockPlayer(el.dataset.id, false); toast('Odblokowano'); render(); };
  // ranking i czat: bez zablokowanych
  if (typeof rankRows === 'function') { const rr0 = rankRows; rankRows = (...a) => rr0(...a).filter(r => r.me || !isBlocked(r.id)); }
}, 0);

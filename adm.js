/* 🛡️ Narzędzia właściciela (statystyki, kary dla graczy). Wczytywane tylko na koncie właściciela – zwykły gracz nie pobiera tego pliku. */
// 📊 statystyki aplikacji (tylko liczby) – pierwsze zalogowane konto, które otworzy Panel hosta, zostaje właścicielem
let HOST_ST = null;
{
  ACTIONS['adm-pick'] = el => { const i = $('#adm-code'); if (i) { i.value = el.dataset.code; i.scrollIntoView({ block: 'center', behavior: 'smooth' }); } };
  ACTIONS['adm-player'] = el => admPlayerPopup(el.dataset.code);
  ACTIONS['adm-show'] = () => { const c = ($('#adm-code')?.value || '').trim(); if (!c) return toast('Wpisz kod gracza'); admPlayerPopup(c); };
  ACTIONS['host-act'] = async el => { const k = el.dataset.k, code = (el.dataset.code || $('#adm-code')?.value || '').trim().toUpperCase(); if (!code) return toast('Wpisz kod gracza');
    let msg = null; if (k === 'msg') { msg = prompt('Treść wiadomości (gracz zobaczy ją w okienku):'); if (!msg) return; }
    if (k === 'restore' && !confirm(`♻️ Przywrócić graczowi ${code} wszystko, co miał przed pierwszą karą?\nZdejmie też cień i blokadę.`)) return;
    if (['wallet', 'items', 'stickers', 'all'].includes(k) && !confirm(`${el.textContent} – gracz ${code}?\nTego nie da się cofnąć.`)) return;
    const pass = admPass(); if (!pass) return; const r = await SB.rpc('admin_act', { p_code: code, p_what: k, p_msg: msg, p_pass: pass }); if (admPassErr(r)) return;
    if (r.error) return toast(/function|schema cache|does not exist/i.test(r.error.message || '') ? 'Wgraj nowy supabase.sql (Aktualizacja bazy)' : /no such/.test(r.error.message) ? 'Nie ma gracza o kodzie ' + code : /no backup/.test(r.error.message) ? 'Brak kopii – ten gracz nie był karany od tej wersji bazy' : 'Błąd: ' + r.error.message, 4000);
    toast(`✓ ${el.textContent} – ${r.data || code}`); hostStatsLoad(); if (el.dataset.code) admPlayerPopup(code); };
  ACTIONS['host-ban'] = async el => { const on = el.dataset.on === '1', code = el.dataset.code;
    if (on && !confirm(`🚫 Wyzerować i zablokować kryształy, złoto i przedmioty gracza ${code}?\nMożesz to potem cofnąć (Odblokuj), ale wyzerowanych rzeczy to nie przywróci.`)) return;
    const pass = admPass(); if (!pass) return; const r = await SB.rpc('admin_ban', { p_code: code, p_on: on, p_pass: pass }); if (admPassErr(r)) return;
    if (r.error) return toast(/function|schema cache|does not exist/i.test(r.error.message || '') ? 'Wgraj nowy supabase.sql (Aktualizacja bazy)' : 'Błąd: ' + r.error.message, 4000);
    toast(on ? `🚫 Zablokowano ${code}` : `✅ Odblokowano ${code}`); hostStatsLoad(); if (el.closest('.adm-pop')) admPlayerPopup(code); }; }
async function hostStatsLoad() {
  HOST_ST = { loading: true };
  if (!(typeof cloudOn === 'function' && cloudOn())) { HOST_ST = { err: 'Zaloguj się na swoje konto, żeby zobaczyć statystyki.' }; return render(); }
  try {
    const c = await SB.rpc('claim_admin'); if (c.error) throw c.error;
    if (c.data !== true) { HOST_ST = { err: 'Statystyki widzi tylko konto właściciela aplikacji.' }; return render(); }
    const r = await SB.rpc('host_stats'); if (r.error) throw r.error;
    const a = await SB.rpc('admin_audit'); HOST_ST = { d: r.data, audit: a.error ? null : a.data, t: Date.now() };
  } catch (e) { HOST_ST = { err: /function|schema cache|does not exist/i.test(e.message || '') ? 'Wgraj nowy supabase.sql (Aktualizacja bazy niżej), żeby zobaczyć statystyki.' : 'Błąd: ' + (e.message || e) }; }
  render();
}
function admStatsHTML() {
  const H = HOST_ST, d = H?.d, n = v => Number(v || 0).toLocaleString('pl');
  const tile = (v, l) => `<div><b>${n(v)}</b><small>${l}</small></div>`;
  return `<div class="card host-stats"><div class="row nowrap"><h3 class="grow" style="margin:0">📊 Statystyki aplikacji</h3><button class="sm" data-act="host-stats">🔄</button></div>
    ${!H || H.loading ? '<p class="small muted">Ładuję…</p>' : H.err ? `<p class="small muted">${esc(H.err)}</p>` : `
    <h4>👥 Konta</h4><div class="time-kpis">${tile(d.users, 'wszystkie')}${tile(d.new_today, 'nowe dziś')}${tile(d.new_7d, 'nowe 7 dni')}${tile(d.active_today, 'aktywne dziś')}</div>
    <h4>🔗 Linki do talii</h4><div class="time-kpis">${tile(d.links, 'udostępnione')}${tile(d.link_opens, 'otwarcia')}${tile(d.link_opens_today, 'otwarte dziś')}${tile(d.active_7d, 'aktywne 7 dni')}</div>
    ${H.audit ? `<h4>🛡️ Najbogatsi gracze</h4><div class="small">${(H.audit.rich || []).map(x => `<div class="row nowrap adm-row" data-act="adm-player" data-code="${esc(x.code || '')}" role="button" style="justify-content:space-between"><span>${esc(x.nick || '?')} <span class="muted">${esc(x.code || '')}</span></span><b>${n(x.gems)} 💎 · ${n(x.items)} przedm.${x.reviews != null ? ` · ${n(x.reviews)} powt.` : ''}</b>${x.code ? `<button class="sm ${x.banned ? '' : 'danger'}" data-act="host-ban" data-code="${esc(x.code)}" data-on="${x.banned ? 0 : 1}" title="${x.banned ? 'Odblokuj' : 'Wyzeruj i zablokuj kryształy/przedmioty'}">${x.banned ? '✅ Odblokuj' : '🚫 Zablokuj'}</button>` : ''}</div>`).join('') || '—'}</div>
      <p class="small muted">🚫 Zablokuj = kryształy, złoto i przedmioty gracza znikają i nie da się ich odbudować (każdy zapis jest czyszczony), dopóki nie odblokujesz.</p>
      <h4>🛡️ Kara dla gracza</h4><div class="adm-tools">
        <div class="row nowrap"><input id="adm-code" class="grow" placeholder="Kod gracza (np. A88BEB31)" maxlength="12" autocapitalize="characters" style="text-transform:uppercase;margin:0"><button class="primary" data-act="adm-show">🔎 Dane</button></div><div class="spacer"></div>
        <div class="adm-btns">${[['wallet', '💸 Zabierz kryształy i złoto'], ['items', '🎒 Zabierz przedmioty'], ['stickers', '🃏 Zabierz naklejki'], ['all', '🧹 Zabierz wszystko'],
          ['shadow', '👻 Cień (myśli, że ma)'], ['unshadow', '👻 Zdejmij cień'], ['clown', '🤡 Zrób klauna'], ['unclown', '🙂 Zdejmij klauna'], ['flip', '🙃 Ekran do góry nogami'], ['msg', '💬 Wyślij wiadomość'], ['restore', '♻️ Przywróć wszystko']].map(([k, l]) => `<button class="sm${['wallet', 'items', 'stickers', 'all'].includes(k) ? ' danger' : ''}" data-act="host-act" data-k="${k}">${l}</button>`).join('')}</div>
        <p class="small muted">Stuknij gracza na liście wyżej, żeby zobaczyć jego dane i ukarać go w okienku. Zabrane rzeczy znikają też na jego telefonie przy najbliższej synchronizacji – nie da się ich odzyskać. Klaun = 🤡 przed nickiem w rankingu i czacie. ♻️ Przywróć = oddaje wszystko sprzed pierwszej kary (kopia robi się automatycznie) i zdejmuje cień oraz blokadę. 👻 Cień = gracz dalej widzi u siebie wszystko, ale w chmurze tego nie ma: inni nie widzą jego gabloty i prestiżu, a na innym urządzeniu (albo po reinstalacji) ma pusto.</p></div>
      <h4>🚨 Wykryte próby oszustwa</h4><div class="small">${(H.audit.cheats || []).map(x => `<div>${esc(x.nick || '?')}: ${esc(x.what)} <span class="muted">${new Date(x.t).toLocaleString('pl-PL')}</span></div>`).join('') || 'brak'}</div>` : ''}
    ${(d.top_links || []).length ? `<div class="small" style="margin-top:10px">${d.top_links.map(x => `<div class="row nowrap" style="justify-content:space-between"><span>${esc(x.name)}</span><b>${n(x.opens)}×</b></div>`).join('')}</div>` : ''}
    <p class="small muted" style="margin:10px 0 0">Same liczby – bez e-maili i nazw użytkowników. Odświeżone ${new Date(H.t).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}.</p>`}</div>`;
}
// 🔎 okienko z danymi gracza + kary (tylko właściciel; dane z funkcji admin_player)
const ADM_KIND = { sticker: '🃏 naklejki', gear: '⚔️ ekwipunek', potion: '🧪 mikstury', boost: '⚡ boostery', forgemat: '🧱 cegły', egg: '🥚 jajka', case: '📦 skrzynki', gif: '🎞️ GIF-y', cos: '👑 prestiż' };
async function admPlayerPopup(code) {
  document.querySelector('.adm-pop')?.remove(); const ov = document.createElement('div'); ov.className = 'dmenu-ov adm-pop';
  ov.innerHTML = '<div class="dmenu"><p class="muted center">Ładuję dane gracza…</p></div>'; document.body.append(ov);
  ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-x]')) ov.remove(); });
  const r = await SB.rpc('admin_player', { p_code: code });
  const box = ov.querySelector('.dmenu'); if (!box) return;
  if (r.error) { box.innerHTML = `<p>${/function|schema cache|does not exist/i.test(r.error.message || '') ? 'Wgraj nowy supabase.sql (Aktualizacja bazy).' : 'Błąd: ' + esc(r.error.message)}</p><button class="ghost" data-x="1">Zamknij</button>`; return; }
  const p = r.data || {}, st = p.stats || {}, n = v => Number(v || 0).toLocaleString('pl'), dt = t => t ? new Date(t).toLocaleString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const kv = (l, v) => `<div class="kv"><span>${l}</span><b>${v}</b></div>`;
  const sus = p.gems > 50000 + 100 * (p.reviews || 0);
  box.innerHTML = `<div class="row nowrap" style="gap:12px">${typeof avatarHTML === 'function' ? avatarHTML({ avatar: p.avatar, avatarImg: p.avatar_img, cos: st.cos }, 56) : ''}<div class="grow"><b style="font-size:19px">${esc(p.nick || '?')}</b><div class="small muted">${esc(p.code || '')}${p.banned ? ' · 🚫 zablokowany' : ''}${p.clown ? ' · 🤡 klaun' : ''}${p.shadow ? ' · 👻 cień' : ''}</div></div></div>
    ${sus ? '<div class="banner" style="margin-top:12px">⚠️ Podejrzane: dużo kryształów przy małej liczbie powtórek</div>' : ''}
    <div class="adm-data">
      ${kv('💎 Kryształy + złoto', n(p.gems))}${kv('Wpisów w portfelu / największy', `${n(p.wallet_n)} / ${n(p.biggest)}`)}
      ${kv('🔁 Powtórki', n(p.reviews))}${kv('🃏 Fiszki / talie', `${n(p.cards)} / ${n(p.decks)}`)}
      ${kv('⭐ Poziom / Elo', `${n(st.level)} / ${n(st.elo || 1000)}`)}${kv('🔥 Seria dni', n(st.streak))}
      ${Object.entries(p.items || {}).map(([k, v]) => kv(ADM_KIND[k] || k, n(v))).join('')}
      ${kv('Konto od', dt(p.created))}${kv('Ostatnia synchronizacja', dt(p.synced))}
    </div>
    ${(p.log || []).length ? `<b class="small">🚨 Dziennik</b><div class="small adm-log">${p.log.map(x => `<div>${esc(x.what)} <span class="muted">${dt(x.t)}</span></div>`).join('')}</div>` : ''}
    ${(p.actions || []).length ? `<b class="small">🛡️ Twoje kary</b><div class="small adm-log">${p.actions.map(x => `<div>${esc(x.what)}${x.msg ? ': „' + esc(x.msg) + '”' : ''} <span class="muted">${dt(x.t)}</span></div>`).join('')}</div>` : ''}
    <div class="adm-btns">${[['wallet', '💸 Zabierz kryształy'], ['items', '🎒 Zabierz przedmioty'], ['stickers', '🃏 Zabierz naklejki'], ['all', '🧹 Zabierz wszystko'],
      p.shadow ? ['unshadow', '👻 Zdejmij cień'] : ['shadow', '👻 Cień (myśli, że ma)'], p.clown ? ['unclown', '🙂 Zdejmij klauna'] : ['clown', '🤡 Zrób klauna'], ['flip', '🙃 Do góry nogami'], ['msg', '💬 Wiadomość'], ['restore', '♻️ Przywróć wszystko']].map(([k, l]) => `<button class="sm${['wallet', 'items', 'stickers', 'all'].includes(k) ? ' danger' : ''}" data-act="host-act" data-k="${k}" data-code="${esc(p.code)}">${l}</button>`).join('')}
      <button class="sm ${p.banned ? '' : 'danger'}" data-act="host-ban" data-code="${esc(p.code)}" data-on="${p.banned ? 0 : 1}">${p.banned ? '✅ Odblokuj' : '🚫 Zablokuj'}</button></div>
    <button class="ghost" data-x="1">Zamknij</button>`;
}

// 🔑 hasło do kar – pytamy raz na uruchomienie aplikacji (trzymane tylko w pamięci), sprawdza je baza
let ADM_PASS = null;
const admPass = () => ADM_PASS || (ADM_PASS = (prompt('🔑 Hasło do kar dla graczy:') || '').trim() || null);
const admPassErr = r => { const m = r?.error?.message || ''; if (/bad admin password/.test(m)) { ADM_PASS = null; toast('🔑 Złe hasło', 3000); return true; }
  if (/no admin password set/.test(m)) { toast('🔑 Najpierw ustaw hasło w Supabase (polecenie SQL od Claude)', 5000); return true; } return false; };

if (!HOST_ST) hostStatsLoad();

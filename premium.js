'use strict';
/* 💠 Waluta premium – saldo i zakupy liczy wyłącznie serwer (supabase.sql: premium_wallet / premium_buy).
   Aplikacja tylko pokazuje saldo i prosi serwer o zakup; kupione rzeczy wracają z serwera na każdym urządzeniu.
   Doładowanie: docelowo płatność (np. Lemon Squeezy / Paddle → webhook z kluczem serwisowym), na razie właściciel w Panelu hosta. */
let PREM = { bal: null, items: [], owned: [], t: 0 };
async function premLoad(force) {
  if (!(typeof cloudOn === 'function' && cloudOn())) return;
  if (!force && Date.now() - PREM.t < 60e3) return; PREM.t = Date.now();
  try {
    const [w, it, ow] = await Promise.all([SB.from('premium_wallet').select('balance').maybeSingle(), SB.from('premium_items').select('k,price,kind,key,name').order('price'), SB.from('premium_owned').select('k')]);
    if (it.error) return;   // stara baza – sklep premium ukryty
    PREM.bal = w.data?.balance ?? 0; PREM.items = it.data || []; PREM.owned = (ow.data || []).map(x => x.k);
    for (const k of PREM.owned) { const x = PREM.items.find(i => i.k === k); if (x && typeof hasItem === 'function' && !hasItem(x.kind, x.key)) addItem(x.kind, x.key, 1, 'prem-' + k); }
    if (['shop'].includes(parseRoute().parts[0])) render();
  } catch { /* */ }
}
function premiumHTML() {
  if (PREM.bal == null || !PREM.items.length) return '';
  return `<div class="card prem-shop"><div class="row nowrap"><h2 class="grow" style="margin:0">💠 Sklep premium</h2><span class="coins prem-bal">💠 ${PREM.bal}</span></div>
    <p class="small muted" style="margin:6px 0 10px">Rzeczy bez losowania – wiesz, co kupujesz. Kupione działają na każdym urządzeniu.</p>
    <div class="prem-list">${PREM.items.map(x => { const own = PREM.owned.includes(x.k); return `<div class="prem-it"><b>${esc(x.name)}</b>${own ? '<span class="muted small">✓ Masz</span>' : `<button class="sm${PREM.bal >= x.price ? ' primary' : ''}" data-act="prem-buy" data-k="${esc(x.k)}">💠 ${x.price}</button>`}</div>`; }).join('')}</div>
    <button class="block ghost" data-act="prem-topup" style="margin-top:10px">➕ Doładuj 💠</button></div>`;
}
Object.assign(ACTIONS, {
  'prem-buy': async el => { const x = PREM.items.find(i => i.k === el.dataset.k); if (!x) return;
    if (PREM.bal < x.price) return toast(`Brakuje ${x.price - PREM.bal} 💠`);
    if (!confirm(`Kupić „${x.name}” za ${x.price} 💠?`)) return;
    const r = await SB.rpc('premium_buy', { p_k: x.k });
    if (r.error) return toast(/already/.test(r.error.message) ? 'Już to masz' : /not enough/.test(r.error.message) ? 'Za mało 💠' : 'Błąd zakupu – spróbuj ponownie', 3500);
    PREM.bal = r.data.balance; PREM.owned.push(x.k); addItem(r.data.kind, r.data.key, 1, 'prem-' + x.k); if (typeof confetti === 'function') confetti(80); toast(`✓ Kupiono: ${x.name}`); render(); },
  'prem-topup': () => toast('💠 Doładowania będą dostępne wkrótce', 3500),
});
on('start', () => setTimeout(() => premLoad(true), 2500));
setTimeout(() => { const sh0 = ROUTES.shop; if (!sh0) return; ROUTES.shop = (...a) => { const v = sh0(...a); premLoad(); if (!v?.html) return v; const pm = premiumHTML(); if (!pm) return v;
  const i = v.html.indexOf('</div>', v.html.indexOf('<h1')) + 6; return { ...v, html: v.html.slice(0, i) + pm + v.html.slice(i) }; }; }, 0);

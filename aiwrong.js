'use strict';
/* 🎯 Błędne odpowiedzi ABCD dla całej talii – tylko konto admina. Dobór podobnych odpowiedzi z Twoich fiszek;
   lepsze (przemyślane) błędne odpowiedzi przygotowuje Claude w czacie i wkleja się je importem (kolumna „✗ …”). */
const aiwAdmin = () => typeof IS_ADMIN !== 'undefined' && IS_ADMIN === true;
let AIW = { busy: false, done: 0, total: 0, err: '' };

async function aiwRun(deckId, mode, onlyEmpty) {
  if (!aiwAdmin() || AIW.busy) return;
  const d = deckById(deckId); if (!d) return;
  const notes = S.notes.filter(n => n.deckId === deckId && n.type === 'basic' && n.front && n.back && (!onlyEmpty || !String(n.wrong || '').trim()));
  if (!notes.length) return toast(onlyEmpty ? 'Wszystkie fiszki mają już błędne odpowiedzi' : 'Brak fiszek pytanie–odpowiedź w tej talii');
  AIW = { busy: true, done: 0, total: notes.length, err: '' }; render();
  let ok = 0;
  try {
    {
      const pool = S.notes.filter(n => n.type === 'basic' && n.back).map(n => ({ a: stripHtml(n.back), q: stripHtml(n.front), ctx: '' }));
      for (const n of notes) { const e = { a: stripHtml(n.back), q: stripHtml(n.front), ctx: n.extra || '' };
        const w = pickDistractors(e, pool.filter(x => norm(x.a) !== norm(e.a)), 3);
        if (w.length) { n.wrong = w.join('; '); n.mod = Date.now(); ok++; } AIW.done++; }
      save();
    }
    toast(`🎯 Gotowe: błędne odpowiedzi dla ${ok} ${plural(ok, 'fiszki', 'fiszek', 'fiszek')}. Poprawisz je w edycji fiszki.`, 5000);
  } catch (e) { AIW.err = e.message || String(e); toast('Błąd: ' + AIW.err, 6000); save(); }
  AIW.busy = false; render();
}
function aiwCardHTML(d) {
  const ns = S.notes.filter(n => n.deckId === d.id && n.type === 'basic'), have = ns.filter(n => String(n.wrong || '').trim()).length;
  return `<div class="card aiw-card"><h3 style="margin-top:0">🎯 Błędne odpowiedzi ABCD <small class="muted">· tylko admin</small></h3>
    <p class="small muted" style="margin:0 0 10px">Do każdej fiszki 3 podobne, ale złe odpowiedzi – ABCD w hydrze, wieży, bossie i teście robi się dużo trudniejsze. Masz je w <b>${have}/${ns.length}</b> fiszkach.</p>
    ${AIW.busy ? `<div class="aiw-prog"><b>Generuję… ${AIW.done}/${AIW.total}</b><div class="pbar"><i style="width:${(AIW.done / Math.max(1, AIW.total) * 100).toFixed(0)}%"></i></div></div>` : `
    <label class="check small"><input type="checkbox" id="aiw-empty" checked> Tylko fiszki bez błędnych odpowiedzi</label>
    <button class="primary block" data-act="aiw-go" data-id="${d.id}" data-m="auto">⚙️ Dobierz z moich fiszek</button>
    <p class="small muted" style="margin:8px 0 0">💬 Najlepsze, przemyślane błędne odpowiedzi przygotuje Ci Claude w czacie – wklejasz je zwykłym importem w kolumnie <b>„✗ źle1; źle2; źle3”</b>.</p>`}
    ${AIW.err ? `<p class="small bad" style="margin:8px 0 0">${esc(AIW.err)}</p>` : ''}</div>`;
}
const aiwViewDeck0 = viewDeck;
viewDeck = function (id, q) { const html = aiwViewDeck0(id, q), d = deckById(id); return aiwAdmin() && d ? html + aiwCardHTML(d) : html; };
Object.assign(ACTIONS, {
  'aiw-go': el => aiwRun(el.dataset.id, el.dataset.m, !!$('#aiw-empty')?.checked),
});

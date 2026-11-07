'use strict';
/* 🎯 Błędne odpowiedzi ABCD dla całej talii – narzędzie tylko dla konta admina (IS_ADMIN z bazy).
   🤖 AI: Claude (Messages API) wymyśla 3 podobne, ale błędne odpowiedzi do każdej fiszki. Klucz API admina zostaje tylko
      na tym urządzeniu (localStorage) i idzie wyłącznie do api.anthropic.com – nigdy do bazy ani do innych graczy.
   ⚙️ Bez AI: dobór podobnych odpowiedzi z tej talii i reszty Twoich fiszek (ten sam algorytm co zwykłe ABCD).
   Wynik trafia do pola „wrong” fiszki – edytujesz go potem w edycji fiszki. Działa w nauce, teście, bossie, hydrze i wieży. */
const AIW_MODEL = 'claude-opus-5-5', AIW_BATCH = 20;
const aiwKey = () => { try { return localStorage.getItem('claudeKey') || ''; } catch { return ''; } };
const aiwAdmin = () => typeof IS_ADMIN !== 'undefined' && IS_ADMIN === true;
let AIW = { busy: false, done: 0, total: 0, err: '' };

// jedna paczka fiszek → { items: [{ i, wrong: [3 × string] }] } (wymuszony kształt JSON przez output_config.format)
async function aiwAsk(batch, deckName) {
  const list = batch.map((n, i) => `${i}. PYTANIE: ${stripHtml(n.front).slice(0, 400)}\n   POPRAWNA: ${stripHtml(n.back).slice(0, 300)}`).join('\n');
  const body = {
    model: AIW_MODEL, max_tokens: 16000,
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: { type: 'object', additionalProperties: false, required: ['items'],
        properties: { items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['i', 'wrong'],
          properties: { i: { type: 'integer' }, wrong: { type: 'array', items: { type: 'string' } } } } } } } },
    },
    fallbacks: 'default',
    messages: [{ role: 'user', content: `Tworzysz trudny quiz ABCD do nauki (talia: „${deckName}”). Do każdej fiszki podaj dokładnie 3 BŁĘDNE odpowiedzi, które brzmią wiarygodnie: ta sama kategoria, podobna długość, styl i forma co poprawna (np. inne kości, inne daty z tego okresu, podobne pojęcia). Żadna nie może być poprawna ani być synonimem poprawnej. Pisz w języku poprawnej odpowiedzi.\n\n${list}` }],
  };
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': aiwKey(), 'anthropic-version': '2026-10-21',
      'anthropic-beta': 'server-side-fallback-2026-07-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 401 ? 'Zły klucz API' : r.status === 429 ? 'Limit zapytań – spróbuj za chwilę' : (j.error?.message || 'HTTP ' + r.status));
  if (j.stop_reason === 'refusal') throw new Error('AI odmówiło dla tej paczki');
  if (j.stop_reason === 'max_tokens') throw new Error('Za długa odpowiedź – spróbuj mniejszej talii');
  const txt = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  const out = JSON.parse(txt);
  return Array.isArray(out.items) ? out.items : [];
}
async function aiwRun(deckId, mode, onlyEmpty) {
  if (!aiwAdmin() || AIW.busy) return;
  const d = deckById(deckId); if (!d) return;
  const notes = S.notes.filter(n => n.deckId === deckId && n.type === 'basic' && n.front && n.back && (!onlyEmpty || !String(n.wrong || '').trim()));
  if (!notes.length) return toast(onlyEmpty ? 'Wszystkie fiszki mają już błędne odpowiedzi' : 'Brak fiszek pytanie–odpowiedź w tej talii');
  if (mode === 'ai' && !aiwKey()) return toast('Najpierw wklej klucz API Claude (niżej)');
  AIW = { busy: true, done: 0, total: notes.length, err: '' }; render();
  let ok = 0;
  try {
    if (mode === 'ai') {
      for (let k = 0; k < notes.length; k += AIW_BATCH) {
        const batch = notes.slice(k, k + AIW_BATCH), res = await aiwAsk(batch, d.name);
        for (const it of res) { const n = batch[it.i], w = (it.wrong || []).map(x => String(x).trim()).filter(x => x && norm(x) !== norm(n?.back || '')).slice(0, 3);
          if (n && w.length) { n.wrong = w.join('; ').slice(0, 600); n.mod = Date.now(); ok++; } }
        AIW.done = Math.min(notes.length, k + batch.length); save(); render();
      }
    } else {
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
    <div class="row"><button class="primary grow" data-act="aiw-go" data-id="${d.id}" data-m="ai">🤖 Wygeneruj przez AI</button><button class="grow" data-act="aiw-go" data-id="${d.id}" data-m="auto">⚙️ Bez AI (szybko)</button></div>
    <details class="adv"><summary>🔑 Klucz API Claude ${aiwKey() ? '✓ zapisany na tym urządzeniu' : '(potrzebny do AI)'}</summary>
      <div class="row nowrap" style="margin-top:8px"><input id="aiw-key" class="grow" type="password" placeholder="sk-ant-…" autocomplete="off" value=""><button class="sm" data-act="aiw-key">Zapisz</button>${aiwKey() ? '<button class="sm ghost" data-act="aiw-key-del">Usuń</button>' : ''}</div>
      <p class="small muted" style="margin:6px 0 0">Klucz zostaje tylko w tej przeglądarce i idzie wyłącznie do api.anthropic.com. Koszt: ok. kilka groszy za 20 fiszek (model ${AIW_MODEL}).</p></details>`}
    ${AIW.err ? `<p class="small bad" style="margin:8px 0 0">${esc(AIW.err)}</p>` : ''}</div>`;
}
const aiwViewDeck0 = viewDeck;
viewDeck = function (id, q) { const html = aiwViewDeck0(id, q), d = deckById(id); return aiwAdmin() && d ? html + aiwCardHTML(d) : html; };
Object.assign(ACTIONS, {
  'aiw-go': el => aiwRun(el.dataset.id, el.dataset.m, !!$('#aiw-empty')?.checked),
  'aiw-key': () => { const v = ($('#aiw-key')?.value || '').trim(); if (!/^sk-ant-/.test(v)) return toast('To nie wygląda na klucz Claude (sk-ant-…)'); try { localStorage.setItem('claudeKey', v); } catch { /* */ } toast('🔑 Klucz zapisany na tym urządzeniu'); render(); },
  'aiw-key-del': () => { try { localStorage.removeItem('claudeKey'); } catch { /* */ } render(); },
});

'use strict';
/* 🦉 Mentor – wspierający „boss” treningowy do nauki NOWYCH fiszek. Nie bije, nie zabiera serc, nie ma limitu czasu.
   Cykl oparty na badaniach: kodowanie (fiszka + skojarzenie) → przypomnienie po chwili → odstęp w sesji → drugie,
   trudniejsze przypomnienie (wpisywanie). Pomyłka = fiszka wraca ze skojarzeniem i później jeszcze raz.
   Skojarzenia: Twoje (pole „Skojarzenie” w fiszce), od AI (własny klucz w Więcej → AI) albo podpowiedzi mentora. */
const MENTOR_N = 8, MENTOR_GROUP = 3, MENTOR_ART = 'assets/pixel/owl8-3.webp';
let MENTOR = null;
const MENTOR_SAY = {
  start: ['Hej! Dziś nie walczymy – uczymy się. Pokażę Ci nowe fiszki i sposoby, żeby zostały w głowie.', 'Spokojnie, tu nikt Cię nie bije. Zapamiętamy to razem!'],
  show: ['Przeczytaj i zatrzymaj się na skojarzeniu – to ono zrobi robotę.', 'Wyobraź to sobie jak najżywiej. Kolory, dźwięki, absurd!', 'Nowa fiszka! Połącz ją z czymś, co już znasz.'],
  ok: ['Brawo! Mózg właśnie zrobił ścieżkę.', 'Dokładnie tak!', 'Widzisz? Skojarzenie działa.', 'Super – zapamiętane!'],
  ok2: ['Drugi raz z pamięci – to już siedzi mocno!', 'Mistrzostwo. Ta fiszka jest Twoja.'],
  bad: ['Nic nie szkodzi – błąd to część nauki. Spójrz jeszcze raz na skojarzenie.', 'Prawie! Pomyłka teraz = lepsza pamięć później. Jeszcze raz.', 'Spokojnie, wrócimy do niej za chwilę.'],
  end: ['Świetna robota! Te fiszki wrócą w powtórkach, zanim zdążysz je zapomnieć.', 'Lekcja zaliczona! Jutro przypomnę Ci je w powtórkach.'],
};
const mSay = k => { const a = MENTOR_SAY[k]; MENTOR.say = a[Math.random() * a.length | 0]; };
const newCardsOf = d => S.cards.filter(c => c.deckId === d.id && c.srs.state === 'new' && fightable(c));
const mShort = (t, n = 40) => { t = String(t || '').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

// 💡 podpowiedzi mentora (bez AI): pierwsze litery, zaczepka, „nie myl z”, scenka
function mentorTips(c) {
  const v = cardView(c), ans = (v.ans || stripHtml(v.b || '')).trim(), label = stripHtml(v.label || '').trim(), d = deckById(c.deckId), tips = [];
  const words = ans.split(/[\s,;/]+/).filter(w => /\p{L}/u.test(w) && w.length > 1);
  if (words.length >= 3 && words.length <= 10) tips.push(['🔤', 'Pierwsze litery', `${words.map(w => w.match(/\p{L}/u)[0].toUpperCase()).join(' · ')} – ułóż z nich śmieszne zdanie`]);
  else if (ans.length >= 4 && ans.length <= 40) tips.push(['🔤', 'Zaczepka', `zaczyna się na „${ans.slice(0, Math.max(2, Math.ceil(ans.length / 3)))}…” · ${ans.replace(/\s/g, '').length} znaków`]);
  const others = S.cards.filter(x => x.deckId === c.deckId && x.id !== c.id && fightable(x)).slice(0, 300).map(distractorEntry).filter(e => e.a && e.a.length <= 120 && norm(e.a) !== norm(ans));
  const sim = others.length && pickDistractors(distractorEntry(c), others, 1)[0], o = sim && others.find(e => e.a === sim);
  if (o && o.q) tips.push(['⚖️', 'Nie myl z', `${mShort(o.q, 50)} → ${mShort(o.a, 50)}`]);
  tips.push(['🎬', 'Scenka', `Wyobraź sobie „${mShort(label)}”${d ? ` w świecie „${mShort(d.name, 24)}”` : ''} i wpleć w to „${mShort(ans)}”. Im dziwniej i śmieszniej, tym lepiej zostanie.`]);
  return tips;
}
// ✨ skojarzenie od AI – tylko z kluczem ucznia; zapamiętane w fiszce (aiHint), żeby nie pytać drugi raz
async function mentorAI(c) {
  const M = MENTOR, n = noteById(c.noteId); if (!M || !n || !S.settings.aiKey || M.ai[c.id] || n.aiHint) return;
  M.ai[c.id] = { busy: true };
  try {
    const { default: Anthropic } = await import('./vendor/anthropic-sdk.mjs');
    const client = new Anthropic({ apiKey: S.settings.aiKey, dangerouslyAllowBrowser: true });
    const v = cardView(c), d = deckById(c.deckId);
    const prompt = `Jesteś życzliwym mentorem nauki. Uczeń uczy się fiszki z talii „${d?.name || 'nauka'}”.\nPytanie: ${stripHtml(v.label || '')}\nOdpowiedź: ${v.ans || stripHtml(v.b || '')}\n\n` +
      'Wymyśl JEDNO krótkie (maks. 2 zdania), obrazowe i zabawne skojarzenie po polsku, które pomoże zapamiętać odpowiedź – najlepiej powiązane z tematem talii, brzmieniem słów albo scenką (mnemotechnika). Nie definiuj odpowiedzi od nowa. Zwróć tylko samo skojarzenie, bez wstępu.';
    const msg = await client.messages.create({ model: S.settings.aiModel || 'claude-opus-5-5', max_tokens: 400, messages: [{ role: 'user', content: prompt }] });
    const t = msg.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
    if (!t || msg.stop_reason === 'refusal') throw new Error('empty');
    n.aiHint = t; touch(n); save(); M.ai[c.id] = { ok: 1 };
  } catch (e) { M.ai[c.id] = { err: e.status === 401 ? 'nieprawidłowy klucz API' : e.status === 429 ? 'za dużo zapytań – spróbuj za chwilę' : 'AI chwilowo niedostępne' }; }
  if (MENTOR === M && parseRoute().parts[0] === 'mentor') render();
}

function mentorStart(deckId) {
  const d = deckById(deckId), cs = d ? newCardsOf(d).slice(0, MENTOR_N) : [];
  if (!cs.length) return toast('W tej talii nie ma już nowych fiszek 🎉');
  MENTOR = { d: d.id, cards: cs.map(c => ({ id: c.id, seen: false, ok: 0, miss: 0, last: 0 })), step: null, run: 0, lastId: null, ai: {}, t0: Date.now(), say: '' };
  mSay('start'); mentorNext(true); go('#/mentor/' + d.id); render();
}
// kolejny krok: pokaż do 3 nowych → odpytaj (najdawniej widziane najpierw) → gdy grupa umie raz, następne 3 → koniec, gdy każda 2× z pamięci
function mentorNext(first) {
  const M = MENTOR, shown = M.cards.filter(x => x.seen), unseen = M.cards.filter(x => !x.seen);
  if (unseen.length && M.run < MENTOR_GROUP && (M.run > 0 || shown.every(x => x.ok >= 1))) {
    const x = unseen[0]; x.seen = true; x.last = Date.now(); M.run++; M.step = { k: 'show', id: x.id }; if (!first) mSay('show');
    mentorAI(S.cards.find(c => c.id === x.id)); return;
  }
  M.run = 0;
  const pend = shown.filter(x => x.ok < 2);
  if (!pend.length) return unseen.length ? mentorNext() : mentorFinish();
  const x = [...pend].sort((a, b) => (a.id === M.lastId) - (b.id === M.lastId) || a.ok - b.ok || a.last - b.last)[0], c = S.cards.find(y => y.id === x.id), v = cardView(c);
  let cm = x.ok === 0 ? 'abcd' : textOk(v) ? 'type' : 'abcd', opts = null;
  if (cm === 'abcd') { opts = mentorOpts(c); if (!opts) cm = textOk(v) ? 'type' : 'flip'; }
  M.step = { k: 'quiz', id: x.id, cm, opts, picked: null, verdict: null, shown: false }; M.lastId = x.id;
}
function mentorOpts(c) {
  const e = distractorEntry(c); if (!e.a || !e.a.trim() || e.a.length > 400) return null;
  const pool = S.cards.filter(x => x.deckId === c.deckId && fightable(x)).map(distractorEntry).filter(x => x.a && x.a.trim() && x.a.length <= 400 && norm(x.a) !== norm(e.a));
  let wrong = pickDistractors(e, pool, 3);
  if (wrong.length < 3) wrong = [...wrong, ...pickDistractors(e, S.cards.filter(fightable).map(distractorEntry).filter(x => x.a && x.a.length <= 400 && norm(x.a) !== norm(e.a) && !wrong.includes(x.a)), 3 - wrong.length)];
  return wrong.length < 3 ? null : shuffle([e.a, ...wrong]);
}
function mentorResult(ok) {
  const M = MENTOR, st = M.step, x = M.cards.find(y => y.id === st.id); x.last = Date.now();
  if (ok) { x.ok++; mSay(x.ok >= 2 ? 'ok2' : 'ok'); if (typeof bossSfx === 'function') bossSfx('hit'); }
  else { x.miss++; x.ok = x.miss >= 3 ? Math.max(x.ok, 1) : 0; mSay('bad'); if (typeof bossSfx === 'function') bossSfx('tick'); }
  st.ok = ok;
}
function mentorAfter() {
  const M = MENTOR, st = M.step, x = M.cards.find(y => y.id === st.id);
  if (st.ok === false && x.ok < 2) { M.step = { k: 'show', id: x.id, again: true }; x.last = Date.now(); return render(); }   // ponowne kodowanie po błędzie
  mentorNext(); render();
}
// koniec: karty wchodzą do powtórek (jak po nauce w zwykłej sesji) + mała nagroda
function mentorFinish() {
  const M = MENTOR, now = Date.now();
  for (const x of M.cards) { const c = S.cards.find(y => y.id === x.id); if (!c || c.srs.state !== 'new') continue;
    const g = x.miss ? 2 : 3, entry = { id: uid(), c: c.id, d: c.deckId, t: now, g, n: 1, ms: Math.min(60000, Math.round((now - M.t0) / M.cards.length)), m: 'type', mentor: 1 };
    c.srs = schedule(c.srs, g); touch(c); S.log.push(entry); emit('review', c, g, true); }
  M.xp = Math.round((8 * M.cards.length + 10) * xpMul()); giveXP(M.xp, 'lekcja z mentorem');
  M.gems = 2 * M.cards.length; S.wallet.push({ id: 'mentor-' + uid(), n: M.gems, why: 'mentor', t: now });
  S.stats.mentorLessons = (S.stats.mentorLessons || 0) + 1; M.step = { k: 'done' }; mSay('end'); save();
}

const mentorHeadHTML = M => { const n = M.cards.length, done = M.cards.reduce((a, x) => a + Math.min(2, x.ok), 0);
  return `<div class="m-head"><div class="boss-art px m-art"><img src="${MENTOR_ART}" alt="Sowa Mentorka" draggable="false"></div>${M.say ? `<div class="m-say">${esc(M.say)}</div>` : ''}</div>
  <div class="m-prog"><i style="width:${(done / (2 * n) * 100).toFixed(1)}%"></i><span>Opanowane: ${M.cards.filter(x => x.ok >= 2).length} / ${n}</span></div>`; };
function mentorTipsHTML(c) {
  const n = noteById(c.noteId), M = MENTOR, ai = M.ai[c.id], tips = mentorTips(c);
  const mine = n?.hint ? `<div class="m-tip mine"><b>💡 Twoje skojarzenie</b><span>${esc(n.hint)}</span></div>` : '';
  const aiBox = n?.aiHint ? `<div class="m-tip ai"><b>✨ Skojarzenie od mentora (AI)</b><span>${esc(n.aiHint)}</span>${n.hint === n.aiHint ? '' : '<button class="sm ghost" data-act="m-keep">💾 Zapisz jako moje skojarzenie</button>'}</div>`
    : ai?.busy ? '<div class="m-tip ai"><b>✨ Mentor wymyśla skojarzenie…</b></div>' : ai?.err ? `<div class="m-tip ai"><b>✨ AI:</b><span>${esc(ai.err)}</span></div>` : '';
  return `<div class="m-tips">${mine}${aiBox}${tips.map(([i, t, d]) => `<div class="m-tip"><b>${i} ${t}</b><span>${esc(d)}</span></div>`).join('')}
    <button class="sm ghost block" data-act="m-own">✏️ ${n?.hint ? 'Zmień moje skojarzenie' : 'Wymyśl własne skojarzenie – działa najlepiej'}</button>
    ${S.settings.aiKey ? '' : '<p class="small muted" style="margin:2px 0 0">Z kluczem AI (Więcej → AI) mentor sam wymyśli skojarzenie do każdej fiszki.</p>'}</div>`;
}
function mentorView() {
  const M = MENTOR, st = M.step, c = st.id && S.cards.find(x => x.id === st.id), v = c ? cardView(c) : null, d = deckById(M.d);
  const bar = `<div class="studybar"><button class="iconbtn" data-act="m-quit">✕</button><div class="title">🦉 Lekcja z mentorem</div><span class="small muted">${esc(mShort(d?.name || '', 18))}</span></div>`;
  if (st.k === 'done') {
    const more = d ? newCardsOf(d).length : 0;
    return { tab: 'arena', focus: true, html: `${bar}${mentorHeadHTML(M)}<div class="card center"><h2 style="margin:4px 0">🎓 Lekcja zaliczona!</h2><p class="small">+${M.xp} XP · +${M.gems} 💎 · ${M.cards.length} ${plural(M.cards.length, 'nowa fiszka', 'nowe fiszki', 'nowych fiszek')} trafia do powtórek</p>
      <div class="m-sum">${M.cards.map(x => { const cc = S.cards.find(y => y.id === x.id), vv = cc && cardView(cc), nn = cc && noteById(cc.noteId); return vv ? `<div><b>${esc(mShort(stripHtml(vv.label || ''), 60))}</b><span>${esc(mShort(vv.ans, 60))}</span>${nn?.hint || nn?.aiHint ? `<small>💡 ${esc(mShort(nn.hint || nn.aiHint, 90))}</small>` : ''}${x.miss ? `<em>${x.miss}× pomyłka</em>` : ''}</div>` : ''; }).join('')}</div>
      <div class="row" style="margin-top:12px">${more ? `<button class="primary grow" data-act="m-start" data-id="${M.d}">🦉 Następna lekcja (${more})</button>` : ''}<button class="grow" data-act="m-close">🗺️ Mapa</button></div></div>` };
  }
  let body = '';
  if (st.k === 'show') body = `<div class="card flash m-card${st.again ? ' again' : ''}"><div class="m-lbl">${st.again ? '🔁 Jeszcze raz – zapamiętaj' : '🆕 Nowa fiszka'}</div>${v.a}</div>${mentorTipsHTML(c)}
    <button class="primary block boss-go" data-act="m-next">Zapamiętane, dalej ›</button>`;
  else {
    const right = o => norm(o) === norm(v.ans);
    let ctrl = '';
    if (st.cm === 'abcd') ctrl = `<div class="abcd-grid">${st.opts.map((o, k) => `<button class="abcd${o.length > 70 ? ' long' : ''}${st.picked != null ? right(o) ? ' right' : st.picked === k ? ' wrong' : '' : ''}" data-act="m-pick" data-k="${k}" ${st.picked != null ? 'disabled' : ''}><i>${'ABCD'[k]}</i><span>${esc(o)}</span></button>`).join('')}</div>`;
    else if (st.cm === 'type' && !st.shown) ctrl = `<div class="row nowrap"><input id="m-in" class="grow" placeholder="Wpisz z pamięci…" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="primary" data-act="m-check">✓</button></div><button class="ghost block small" data-act="m-dunno" style="margin-top:4px">Nie pamiętam – pokaż</button>`;
    else if (st.cm === 'flip' && !st.shown) ctrl = '<button class="primary block" data-act="m-reveal">Pokaż odpowiedź</button>';
    else if (st.cm === 'flip' && st.ok == null) ctrl = '<div class="tf-btns"><button class="tf-no" data-act="m-self" data-v="0">✗ Nie pamiętałem</button><button class="tf-yes" data-act="m-self" data-v="1">✓ Pamiętałem</button></div>';
    const fb = st.ok == null ? '' : `<p class="center small ${st.ok ? 'good' : 'bad'}" style="margin:6px 0">${st.ok ? (st.verdict === 'close' ? '≈ Prawie idealnie – liczę!' : '✓ Dobrze!') : `✗ Poprawnie: <b>${esc(v.ans)}</b>`}</p><button class="primary block" data-act="m-after">Dalej ›</button>`;
    body = `<div class="card flash m-card quiz"><div class="m-lbl">🧠 Sprawdźmy z pamięci${st.cm === 'type' ? ' – wpisz' : ''}</div>${st.shown && st.cm !== 'abcd' ? v.a : v.q}</div><div class="bf-ctrl">${ctrl}${fb}</div>`;
  }
  return { tab: 'arena', focus: true, html: `${bar}<div class="mentor">${mentorHeadHTML(M)}${body}</div>` };
}
// lista talii z nowymi fiszkami
function mentorListView() {
  const ds = S.decks.map(d => [d, newCardsOf(d).length]).filter(([, n]) => n > 0);
  return { tab: 'arena', html: `<div class="row nowrap"><button class="iconbtn" data-go="#/boss">‹</button><h1 class="grow" style="margin:0">🦉 Mentor</h1>${coinsHTML()}</div>
  <div class="card row nowrap m-intro"><div class="boss-art px m-art"><img src="${MENTOR_ART}" alt="" draggable="false"></div><div class="grow"><b>Sowa Mentorka nie walczy – uczy.</b><div class="small">Pokazuje nowe fiszki ze skojarzeniem, potem odpytuje Cię z pamięci (najpierw ABCD, potem wpisywanie). Pomyłka? Wraca ze skojarzeniem. Bez obrażeń, bez limitu czasu.</div></div></div>
  ${ds.length ? `<div class="list">${ds.map(([d, n]) => `<button class="card row nowrap m-deck" data-act="m-start" data-id="${d.id}"><div class="grow" style="text-align:left"><b>${esc(d.name)}</b><div class="small muted">${n} ${plural(n, 'nowa fiszka', 'nowe fiszki', 'nowych fiszek')} · lekcja: ${Math.min(MENTOR_N, n)}</div></div><span>🦉 ›</span></button>`).join('')}</div>`
    : '<div class="card center"><p>🎉 Nie masz nowych fiszek – wszystko już poznane!</p><p class="small muted">Dodaj fiszki do talii, a mentor pomoże Ci je zapamiętać.</p></div>'}` };
}
ROUTES.mentor = (parts = []) => { const id = parts[1]; if (MENTOR && (!id || MENTOR.d === id)) return mentorView(); return mentorListView(); };
HUB_OF.mentor = 'arena';
const mentorCheck = () => { const M = MENTOR, st = M?.step, c = st && S.cards.find(x => x.id === st.id); if (!c || st.k !== 'quiz') return;
  const given = ($('#m-in')?.value || '').trim(); if (!given) return toast('Wpisz odpowiedź albo stuknij „Nie pamiętam”');
  st.verdict = checkAnswer(given, cardView(c).ans); st.shown = true; mentorResult(st.verdict !== 'wrong'); save(); render(); };
document.addEventListener('keydown', e => { if (e.target.id === 'm-in' && e.key === 'Enter') { e.preventDefault(); mentorCheck(); } });
Object.assign(ACTIONS, {
  'm-start': el => mentorStart(el.dataset.id),
  'm-next': () => { if (!MENTOR) return; mentorNext(); render(); },
  'm-pick': el => { const st = MENTOR?.step; if (!st || st.picked != null) return; st.picked = +el.dataset.k; st.shown = true; const c = S.cards.find(x => x.id === st.id); mentorResult(norm(st.opts[st.picked]) === norm(cardView(c).ans)); render(); },
  'm-check': () => mentorCheck(),
  'm-dunno': () => { const st = MENTOR?.step; if (!st) return; st.shown = true; st.verdict = 'wrong'; mentorResult(false); render(); },
  'm-reveal': () => { const st = MENTOR?.step; if (!st) return; st.shown = true; render(); },
  'm-self': el => { mentorResult(el.dataset.v === '1'); render(); },
  'm-after': () => { if (MENTOR) mentorAfter(); },
  'm-own': () => { const c = S.cards.find(x => x.id === MENTOR?.step?.id), n = c && noteById(c.noteId); if (!n) return;
    const t = prompt('Twoje skojarzenie do tej fiszki (własne zapamiętuje się najlepiej):', n.hint || ''); if (t == null) return; n.hint = t.trim(); touch(n); save(); render(); },
  'm-keep': () => { const c = S.cards.find(x => x.id === MENTOR?.step?.id), n = c && noteById(c.noteId); if (!n?.aiHint) return; n.hint = n.aiHint; touch(n); save(); toast('💾 Zapisane w fiszce'); render(); },
  'm-quit': () => { if (MENTOR?.step?.k !== 'done' && !confirm('Przerwać lekcję? Fiszki zostaną nowe – możesz wrócić w każdej chwili.')) return; MENTOR = null; go('#/boss'); },
  'm-close': () => { MENTOR = null; go('#/boss'); },
});
// mapa bossów: mentor nad wieżami
const mtMap0 = ROUTES.boss;
ROUTES.boss = (...a) => { const v = mtMap0(...a); if (!v?.html || v.focus) return v; const n = S.decks.reduce((s, d) => s + newCardsOf(d).length, 0);
  return { ...v, html: v.html.replace('<div class="card row nowrap tower-cta" data-go="#/tower">', `<div class="card row nowrap tower-cta mentor-cta" data-go="#/mentor"><span class="tower-ic m-ic"><img src="${MENTOR_ART}" alt=""></span><div class="grow"><b>Mentor – nauka nowych fiszek</b><div class="small muted">${n ? `${n} ${plural(n, 'nowa fiszka czeka', 'nowe fiszki czekają', 'nowych fiszek czeka')} · wspierający boss ze skojarzeniami` : 'Wszystkie fiszki poznane 🎉'}</div></div><span>›</span></div><div class="card row nowrap tower-cta" data-go="#/tower">`) }; };

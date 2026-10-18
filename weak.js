'use strict';
/* 📉 Mapa słabych punktów: które działy i które fiszki najczęściej uciekają.
   Liczymy z historii odpowiedzi (S.log, ostatnie 60 dni) + liczba zapomnień karty (lapses).
   Dział = pole „Dodatkowe” fiszki (np. „1. Środowisko wodne”), a gdy go brak – talia. */

const WEAK_DAYS = 60;
function weakData(deckId) {
  const since = Date.now() - WEAK_DAYS * DAY, byCard = {};
  for (const l of S.log) {
    if (l.t < since || (deckId && l.d !== deckId)) continue;
    const r = byCard[l.c] || (byCard[l.c] = { n: 0, bad: 0, hard: 0, last: 0 });
    r.n++; if (l.g === 1) r.bad++; if (l.g === 2) r.hard++; r.last = Math.max(r.last, l.t);
  }
  const cards = [], secs = {};
  for (const c of S.cards) {
    if (deckId && c.deckId !== deckId) continue;
    const r = byCard[c.id], note = noteById(c.noteId); if (!note) continue;
    const lapses = c.srs?.lapses || 0;
    if (!r && !lapses) continue;
    const n = r?.n || 0, bad = r?.bad || 0, hard = r?.hard || 0;
    // słabość: odsetek błędów (z wygładzeniem) + zapomnienia; niedawne pomyłki ważą więcej
    const score = (bad * 2 + hard + lapses * 1.5) / (n + 2) + (r && Date.now() - r.last < 3 * DAY && bad ? .3 : 0);
    const sec = (note.extra || '').replace(/<[^>]+>/g, '').trim().slice(0, 50) || (deckById(c.deckId)?.name || 'Talia');
    const key = c.deckId + '|' + sec;
    const sd = secs[key] || (secs[key] = { name: sec, deck: deckById(c.deckId)?.name || '', n: 0, ok: 0, cards: 0, weak: 0, ids: [] });
    sd.n += n; sd.ok += n - bad - hard * .5; sd.cards++; sd.ids.push(c.id); if (score >= .5) sd.weak++;
    cards.push({ c, score, n, bad, lapses, label: stripHtml(cardView(c).label || '') });
  }
  const sections = Object.values(secs).filter(s => s.n).map(s => ({ ...s, acc: Math.max(0, Math.round(s.ok / s.n * 100)) })).sort((a, b) => a.acc - b.acc);
  cards.sort((a, b) => b.score - a.score);
  return { sections, cards: cards.filter(x => x.score > .25) };
}
ROUTES.weak = (parts, q) => {
  const deckId = q?.get('deck') || '', d = deckId && deckById(deckId), W = weakData(deckId);
  const top = W.cards.slice(0, 20);
  const bar = acc => `<div class="weak-bar"><i style="width:${acc}%;background:${acc >= 85 ? 'var(--rev)' : acc >= 65 ? 'var(--hard)' : 'var(--lrn)'}"></i></div>`;
  return { tab: 'home', html: `<div class="row nowrap"><button class="iconbtn" data-go="${d ? '#/deck/' + d.id : '#/'}">‹</button><h1 class="grow">📉 Słabe punkty</h1></div>
    <p class="small muted" style="margin-top:-6px">${d ? esc(d.name) + ' · ' : 'Wszystkie talie · '}ostatnie ${WEAK_DAYS} dni. Dział = pole „Dodatkowe” fiszki.</p>
    ${top.length ? `<button class="primary block" data-go="#/study/${deckId || 'all'}/flip?cram=list&ids=${top.map(x => x.c.id).join(',')}">🔁 Powtórz moje najsłabsze ${top.length}</button>` : ''}
    <div class="card"><h2 style="margin-top:0">Działy – od najsłabszego</h2>
      ${W.sections.length ? W.sections.map(s => `<div class="weak-sec"><div class="row nowrap"><b class="grow nm">${esc(s.name)}</b><span class="small">${s.acc}%</span></div>${bar(s.acc)}
        <div class="row nowrap small muted"><span class="grow">${d ? '' : esc(s.deck) + ' · '}${s.cards} kart · ${s.weak} słabych</span>${s.weak ? `<button class="sm ghost" data-go="#/study/all/flip?cram=list&ids=${s.ids.join(',')}">Powtórz dział</button>` : ''}</div></div>`).join('')
        : '<p class="muted small">Jeszcze za mało powtórek – ucz się kilka dni, a tu pojawi się mapa.</p>'}</div>
    ${top.length ? `<div class="card"><h2 style="margin-top:0">Najczęściej zapominane</h2>${top.map((x, i) => `<div class="weak-card"><span class="wk-n">${i + 1}</span><div class="grow" style="min-width:0"><div class="nm">${esc(x.label)}</div>
      <small class="muted">${x.bad ? `❌ ${x.bad}× nie pamiętam` : ''}${x.bad && x.lapses ? ' · ' : ''}${x.lapses ? `🔁 ${x.lapses}× zapomniana` : ''} · ${x.n} powt.</small></div></div>`).join('')}</div>` : ''}` };
};

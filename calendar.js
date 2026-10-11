'use strict';
/* Terminarz: kolokwia, egzaminy, zajęcia… Kalendarz miesiąca, lista najbliższych terminów (karta na Starcie
   w pełnym trybie), powiązanie z talią („ucz się do tego”) oraz eksport do Kalendarza Apple (plik .ics
   z przypomnieniami) i Kalendarza Google. Wydarzenia synchronizują się jak reszta danych (S.events). */

const EV_TYPES = {
  kolos: { name: 'Kolokwium', icon: '📝', color: '#f59e0b' },
  exam: { name: 'Egzamin', icon: '🎓', color: '#ef4444' },
  pass: { name: 'Zaliczenie', icon: '✅', color: '#10b981' },
  class: { name: 'Zajęcia', icon: '🏫', color: '#3b82f6' },
  due: { name: 'Termin oddania', icon: '⏰', color: '#8b5cf6' },
  other: { name: 'Inne', icon: '📌', color: '#64748b' },
};
const EV_REMIND = [['1w', 'tydzień przed'], ['1d', 'dzień przed'], ['1h', 'godzinę przed'], ['0', 'w chwili startu']];
const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const isoDay = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseDay = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const evType = e => EV_TYPES[e.type] || EV_TYPES.other;
const evStart = e => { const d = parseDay(e.date); if (e.time) { const [h, m] = e.time.split(':').map(Number); d.setHours(h, m); } return d; };
const daysTo = e => Math.round((parseDay(e.date) - parseDay(isoDay(new Date()))) / DAY);
const whenText = n => n === 0 ? 'dziś' : n === 1 ? 'jutro' : n === 2 ? 'pojutrze' : n > 0 ? `za ${n} dni` : n === -1 ? 'wczoraj' : `${-n} dni temu`;
const events = () => (S.events || []).slice().sort((a, b) => evStart(a) - evStart(b));
const upcoming = (limit = 99) => events().filter(e => daysTo(e) >= 0).slice(0, limit);
let CAL = { y: new Date().getFullYear(), m: new Date().getMonth(), sel: isoDay(new Date()), edit: null };

// ---------- eksport: Apple (.ics) i Google
const icsEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsLocal = d => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;
const icsDate = d => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
// linie .ics max 75 bajtów (polskie znaki i emoji zajmują po kilka) – dłuższe łamiemy ze spacją na początku
const icsFold = line => {
  const out = []; let cur = '', bytes = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (bytes + n > 73) { out.push(cur); cur = ' '; bytes = 1; }
    cur += ch; bytes += n;
  }
  out.push(cur); return out.join('\r\n');
};
const evDesc = e => [e.note, e.deckId && deckById(e.deckId) ? `Talia do nauki: ${deckById(e.deckId).name}` : '', 'Dodane w aplikacji Fiszki'].filter(Boolean).join('\n');
function icsEvent(e) {
  const t = evType(e), start = evStart(e), stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VEVENT', `UID:${e.id}@fiszki`, `DTSTAMP:${stamp}`];
  if (e.time) { const end = new Date(start.getTime() + (e.dur || 90) * MIN); lines.push(`DTSTART:${icsLocal(start)}`, `DTEND:${icsLocal(end)}`); }
  else { const end = new Date(start); end.setDate(end.getDate() + 1); lines.push(`DTSTART;VALUE=DATE:${icsDate(start)}`, `DTEND;VALUE=DATE:${icsDate(end)}`); }
  lines.push(`SUMMARY:${icsEsc(`${t.icon} ${e.title}`)}`, `DESCRIPTION:${icsEsc(evDesc(e))}`, `CATEGORIES:${icsEsc(t.name)}`);
  if (e.place) lines.push(`LOCATION:${icsEsc(e.place)}`);
  // przypomnienia; wydarzenie całodniowe: „godzinę przed” = 8:00 tego dnia
  const trig = { '1w': '-P7D', '1d': e.time ? '-P1D' : '-PT15H', '1h': e.time ? '-PT1H' : 'PT8H', '0': 'PT0M' };
  for (const r of e.remind || ['1d']) if (trig[r]) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(`${t.name}: ${e.title}`)}`, `TRIGGER:${trig[r]}`, 'END:VALARM');
  lines.push('END:VEVENT');
  return lines.map(icsFold).join('\r\n');
}
const icsFile = list => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fiszki//Terminarz//PL', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', ...list.map(icsEvent), 'END:VCALENDAR'].join('\r\n');
async function exportIcs(list, name) {
  const text = icsFile(list), fname = (name || 'terminarz').replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/\s+/g, '-').slice(0, 40) + '.ics';
  // iPhone: arkusz udostępniania → „Kalendarz”; gdzie indziej zwykłe pobranie pliku
  const file = new File([text], fname, { type: 'text/calendar' });
  if (/iPhone|iPad|iPod/.test(navigator.userAgent) && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(text); a.download = fname;
  document.body.append(a); a.click(); a.remove();
  toast('Otwórz pobrany plik .ics – kalendarz zapyta, czy dodać wydarzenie', 4500);
}
function googleUrl(e) {
  const start = evStart(e), t = evType(e);
  const dates = e.time ? `${icsLocal(start)}/${icsLocal(new Date(start.getTime() + (e.dur || 90) * MIN))}`
    : `${icsDate(start)}/${icsDate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1))}`;
  const p = new URLSearchParams({ action: 'TEMPLATE', text: `${t.icon} ${e.title}`, dates, details: evDesc(e) });
  if (e.place) p.set('location', e.place);
  try { p.set('ctz', Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { /* */ }
  return 'https://calendar.google.com/calendar/render?' + p;
}

// ---------- widoki
function evRowHTML(e, opts = {}) {
  const t = evType(e), n = daysTo(e), deck = e.deckId && deckById(e.deckId);
  const urgent = n >= 0 && n <= 2;
  return `<div class="evrow" style="--ec:${t.color}"><span class="evi">${t.icon}</span>
    <div class="grow" style="min-width:0"><b class="nm" style="display:block">${esc(e.title)}</b>
      <div class="small muted">${opts.date ? parseDay(e.date).toLocaleDateString('pl', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' : ''}${e.time ? e.time + ' · ' : ''}${t.name}${e.place ? ' · ' + esc(e.place) : ''}</div>
      ${e.note && !opts.compact ? `<div class="small">${esc(e.note)}</div>` : ''}
</div>
    <span class="evwhen${urgent ? ' urgent' : ''}">${whenText(n)}</span>
      ${!opts.compact ? `<div class="ev-actions">
        ${deck && n >= 0 ? `<button class="sm primary" data-go="#/study/${deck.id}/type">📚 Ucz się</button>` : ''}
        <button class="sm" data-act="ev-ics" data-id="${e.id}">🍎 Apple</button>
        <a class="btn sm" href="${esc(googleUrl(e))}" target="_blank" rel="noopener">📆 Google</a>
        <button class="sm ghost" data-act="ev-edit" data-id="${e.id}">✏️</button>
        <button class="sm ghost" data-act="ev-del" data-id="${e.id}">🗑</button></div>` : ''}</div>`;
}
function evFormHTML(e) {
  const t = e || { title: '', type: 'kolos', date: CAL.sel, time: '', dur: 90, remind: ['1d'], deckId: '', note: '', place: '' };
  return `<div class="card" id="ev-form"><h3 style="margin-top:0">${e ? 'Edytuj wydarzenie' : '➕ Nowe wydarzenie'}</h3>
    <input id="ev-title" placeholder="Np. Kolokwium z anatomii" maxlength="80" value="${esc(t.title)}">
    <div class="spacer"></div>
    <div class="evtypes">${Object.entries(EV_TYPES).map(([k, x]) => `<button class="${t.type === k ? 'on' : ''}" style="--ec:${x.color}" data-act="ev-type" data-k="${k}">${x.icon} ${x.name}</button>`).join('')}</div>
    <input type="hidden" id="ev-type" value="${t.type}">
    <div class="grid2">
      <label class="field"><span>Dzień</span><input type="date" id="ev-date" value="${t.date}"></label>
      <label class="field"><span>Godzina (opcjonalnie)</span><input type="time" id="ev-time" value="${t.time || ''}"></label>
      <label class="field"><span>Czas trwania</span><select id="ev-dur">${[[45, '45 min'], [60, '1 h'], [90, '1,5 h'], [120, '2 h'], [180, '3 h'], [240, '4 h']].map(([v, l]) => `<option value="${v}" ${+t.dur === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field"><span>Talia do nauki</span><select id="ev-deck"><option value="">— brak —</option>${S.decks.map(d => `<option value="${d.id}" ${t.deckId === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></label>
    </div>
    <input id="ev-place" placeholder="Miejsce / sala (opcjonalnie)" maxlength="80" value="${esc(t.place || '')}">
    <div class="spacer"></div>
    <textarea id="ev-note" rows="2" placeholder="Notatka: zakres materiału, co przynieść…" maxlength="500">${esc(t.note || '')}</textarea>
    <div class="small muted" style="margin:10px 0 4px">Przypomnienia w kalendarzu Apple:</div>
    <div class="evrem">${EV_REMIND.map(([k, l]) => `<label class="check"><input type="checkbox" class="ev-rem" value="${k}" ${(t.remind || []).includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div>
    <div class="spacer"></div>
    <div class="row"><button class="primary grow" data-act="ev-save" data-id="${e?.id || ''}">💾 Zapisz</button><button class="grow" data-act="ev-cancel">Anuluj</button></div></div>`;
}
function monthGridHTML() {
  const first = new Date(CAL.y, CAL.m, 1), start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
  const byDay = {}; for (const e of S.events || []) (byDay[e.date] = byDay[e.date] || []).push(e);
  const today = isoDay(new Date());
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const k = isoDay(d), evs = byDay[k] || [], out = d.getMonth() !== CAL.m;
    if (i === 35 && out) break;   // 5 tygodni wystarczy
    cells += `<button class="calday${out ? ' out' : ''}${k === today ? ' today' : ''}${k === CAL.sel ? ' sel' : ''}${evs.length ? ' has' : ''}" data-act="cal-day" data-d="${k}">
      <span>${d.getDate()}</span><i>${evs.slice(0, 3).map(e => `<em style="background:${evType(e).color}"></em>`).join('')}</i></button>`;
  }
  return `<div class="card cal"><div class="row nowrap"><button class="iconbtn" data-act="cal-nav" data-d="-1">‹</button>
      <b class="grow center" style="font-size:18px">${MONTHS[CAL.m]} ${CAL.y}</b><button class="iconbtn" data-act="cal-nav" data-d="1">›</button></div>
    <div class="calgrid">${['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'].map(x => `<small>${x}</small>`).join('')}${cells}</div>
    ${CAL.y !== new Date().getFullYear() || CAL.m !== new Date().getMonth() ? '<button class="sm ghost block" data-act="cal-today">Wróć do dziś</button>' : ''}</div>`;
}
ROUTES.calendar = () => {
  const dayEvs = events().filter(e => e.date === CAL.sel), up = upcoming(8);
  const editing = CAL.edit === 'new' ? evFormHTML(null) : CAL.edit ? evFormHTML((S.events || []).find(e => e.id === CAL.edit)) : '';
  if (CAL.edit) onMount(() => { $('#ev-form')?.scrollIntoView({ block: 'start' }); if (CAL.edit === 'new') $('#ev-title')?.focus({ preventScroll: true }); });
  return { tab: 'home', html: `
  <div class="row nowrap"><button class="iconbtn" data-go="#/">‹</button><h1 class="grow">Terminarz</h1><button class="iconbtn" data-act="ev-new" title="Dodaj">➕</button></div>
  ${monthGridHTML()}
  ${editing}
  <div class="card"><div class="row nowrap"><h3 class="grow" style="margin:0">${parseDay(CAL.sel).toLocaleDateString('pl', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
      ${CAL.edit ? '' : '<button class="sm primary" data-act="ev-new">➕ Dodaj</button>'}</div>
    ${dayEvs.length ? dayEvs.map(e => evRowHTML(e)).join('') : '<p class="small muted">Brak wydarzeń tego dnia.</p>'}</div>
  <div class="card"><div class="row nowrap"><h3 class="grow" style="margin:0">Najbliższe</h3>${up.length ? '<button class="sm" data-act="ev-ics-all">🍎 Wszystkie do Apple</button>' : ''}</div>
    ${up.length ? up.map(e => evRowHTML(e, { date: true })).join('') : '<p class="small muted">Nic nie zaplanowano. Dodaj kolokwium, egzamin albo termin oddania pracy.</p>'}</div>
  <p class="small muted">🍎 Apple: dodaje wydarzenie z przypomnieniami do Kalendarza na iPhonie/Macu. Google: otwiera Kalendarz Google z gotowym wydarzeniem (przypomnienie według ustawień konta Google).</p>` };
};

Object.assign(ACTIONS, {
  'cal-nav': el => { const d = new Date(CAL.y, CAL.m + +el.dataset.d, 1); CAL.y = d.getFullYear(); CAL.m = d.getMonth(); render(); },
  'cal-today': () => { const d = new Date(); CAL.y = d.getFullYear(); CAL.m = d.getMonth(); CAL.sel = isoDay(d); render(); },
  'cal-day': el => { CAL.sel = el.dataset.d; const d = parseDay(CAL.sel); CAL.y = d.getFullYear(); CAL.m = d.getMonth(); render(); },
  'cal-open': el => { const e = S.events.find(x => x.id === el.dataset.id); if (e) { CAL.sel = e.date; const d = parseDay(e.date); CAL.y = d.getFullYear(); CAL.m = d.getMonth(); } go('#/calendar'); },
  'ev-new': () => { CAL.edit = 'new'; render(); },
  'ev-edit': el => { const e = S.events.find(x => x.id === el.dataset.id); if (!e) return; CAL.edit = e.id; CAL.sel = e.date; render(); },
  'ev-cancel': () => { CAL.edit = null; render(); },
  'ev-type': el => { $('#ev-type').value = el.dataset.k; el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); },
  'ev-save': el => {
    const title = $('#ev-title').value.trim(), date = $('#ev-date').value;
    if (!title) return toast('Wpisz nazwę, np. „Kolokwium z anatomii”');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return toast('Wybierz dzień');
    const data = { title, date, type: $('#ev-type').value, time: $('#ev-time').value || '', dur: +$('#ev-dur').value || 90, deckId: $('#ev-deck').value || '',
      place: $('#ev-place').value.trim(), note: $('#ev-note').value.trim(), remind: [...document.querySelectorAll('.ev-rem:checked')].map(x => x.value) };
    S.events = S.events || [];
    const ex = el.dataset.id && S.events.find(x => x.id === el.dataset.id);
    if (ex) Object.assign(ex, data, { mod: Date.now() }); else S.events.push(touch({ id: uid(), ...data }));
    save(); CAL.edit = null; CAL.sel = date; const d = parseDay(date); CAL.y = d.getFullYear(); CAL.m = d.getMonth();
    toast(ex ? 'Zapisano zmiany ✓' : `Dodano: ${title} ✓ – możesz dodać je do kalendarza Apple lub Google`, 3500); render();
  },
  'ev-del': el => {
    const e = S.events.find(x => x.id === el.dataset.id); if (!e || !confirm(`Usunąć „${e.title}”?`)) return;
    S.events = S.events.filter(x => x.id !== e.id); S.tomb[e.id] = Date.now(); save(); render();
  },
  'ev-ics': el => { const e = S.events.find(x => x.id === el.dataset.id); if (e) exportIcs([e], e.title); },
  'ev-ics-all': () => { const up = upcoming(); if (up.length) exportIcs(up, 'terminarz'); },
});

// Start (tylko pełny tryb): najbliższe terminy
const calHome0 = homeExtrasHTML;
homeExtrasHTML = function () {
  const base = calHome0(); if (appMode() !== 'full') return base;
  const up = upcoming(3);
  return `<div class="card tight evhome"><div class="row nowrap"><h2 class="grow" style="margin:0;font-size:18px">📅 Terminarz</h2><button class="sm" data-go="#/calendar">Kalendarz ›</button></div>
    ${up.length ? up.map(e => `<div data-act="cal-open" data-id="${e.id}" style="cursor:pointer">${evRowHTML(e, { date: true, compact: true })}</div>`).join('')
      : '<p class="small muted" style="margin:8px 0 0">Dodaj kolokwium albo egzamin – przypomnę i podpowiem, co powtórzyć.</p>'}</div>` + base;
};
// raz dziennie: przypomnienie w aplikacji o jutrzejszych i dzisiejszych terminach
on('start', () => setTimeout(() => {
  const soon = upcoming().filter(e => daysTo(e) <= 1); if (!soon.length) return;
  const key = 'evNote-' + isoDay(new Date());
  try { if (localStorage.getItem(key)) return; localStorage.setItem(key, 1); } catch { /* */ }
  const e = soon[0];
  toast(`${evType(e).icon} ${whenText(daysTo(e)).replace(/^./, c => c.toUpperCase())}: ${e.title}${soon.length > 1 ? ` (+${soon.length - 1})` : ''}`, 5000);
}, 2500));

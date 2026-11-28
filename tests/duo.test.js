// Test duo mode: tryb publiczny, karty tylko z linku / lokalnie (repo nie zawiera kart); pełna sesja na neutralnych danych.
// Uruchom: python3 -m http.server 8765 (w katalogu repo), potem: node tests/duo.test.js
const { chromium } = require('playwright');
const URL = process.env.APP_URL || 'http://localhost:8765/';
let fails = 0; const check = (ok, msg) => { console.log((ok ? 'OK   ' : 'FAIL ') + msg); if (!ok) fails++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.route('**/config.json*', r => r.fulfill({ status: 404, body: '' }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForFunction(() => typeof S !== 'undefined' && !document.querySelector('#view .loading'));
  await p.evaluate(() => { S.stats.welcomed = 1; S.stats.modeChosen = 1; S.stats.tutDone = 1;
    for (const n of ['Talia A', 'Talia B']) { const d = newDeck(n); for (let i = 1; i <= 8; i++) addNote({ deckId: d.id, type: 'basic', front: `${n} pytanie ${i}`, back: `odpowiedź ${i}` }); } save(); });
  const clean = () => p.evaluate(() => document.querySelectorAll('.wl-overlay,.dr-overlay,.dmenu-ov').forEach(e => e.remove()));
  const view = () => p.evaluate(() => document.getElementById('view').innerText);
  const go = async h => { await p.evaluate(h => { location.hash = h; render(); }, h); await p.waitForTimeout(250); await clean(); };

  // 1) nie-admin (zwykły użytkownik i tester z wczytanym bundle-x): 404, brak linków
  for (const tester of [false, true]) {
    await p.evaluate(t => { IS_ADMIN = false; MY_TESTS = t ? ['kumul'] : []; }, tester);
    if (tester) { await p.evaluate(() => lazyLoad()); await p.waitForFunction(() => LAZY === 2, { timeout: 8000 }).catch(() => {}); }
    for (const h of ['#/duo', '#/duo/admin', '#/duo?d=abc']) { await go(h); check((await view()).includes('404'), `${tester ? 'tester' : 'użytkownik'}: ${h} → 404`); }
    const unknown = (await (go('#/nieistnieje'), view())); await go('#/duo'); check(unknown === await view(), `${tester ? 'tester' : 'użytkownik'}: #/duo wygląda jak nieistniejąca trasa`);
    for (const h of ['#/', '#/boss', '#/host', '#/more', '#/me', '#/shop']) { await go(h);
      const leak = await p.evaluate(() => [...document.querySelectorAll('[href],[data-go],[data-act]')].some(e => /duo/i.test((e.getAttribute('href') || '') + (e.dataset.go || '') + (e.dataset.act || ''))) || /\bDuo\b/.test(document.body.innerText));
      check(!leak, `${tester ? 'tester' : 'użytkownik'}: brak linku do trybu na ${h}`); }
  }
  // 2) admin
  await p.evaluate(() => { IS_ADMIN = true; lazyLoad(); localStorage.removeItem('duoCards'); });
  await p.waitForFunction(() => LAZY === 2 && typeof duoStart === 'function', { timeout: 8000 }); await p.evaluate(() => { DUO_CARDS = null; });
  await go('#/boss'); check(await p.evaluate(() => !!document.querySelector('[data-go="#/duo"]')), 'admin: kafelek trybu w Przygodzie');
  await go('#/duo'); check((await view()).includes('Brak kart'), 'admin: bez linku brak kart');
  await go('#/duo/xyz'); check((await view()).includes('404'), 'nieznana podstrona → 404');
  // link z kartami (neutralne dane) → zapis tylko lokalnie
  const link = await p.evaluate(async () => '#/duo?d=' + await packZip(JSON.stringify([[0, 1, 'Przykładowa nagroda', 1], [0, 2, 'Przykładowa nagroda 2', 1], [0, 3, 'Przykładowa nagroda 3', 1], [0, 4, 'Przykładowa nagroda 4', 1], [1, 0, 'Przykładowy fant', 1]])));
  await p.evaluate(h => { location.hash = h; }, link); await p.waitForSelector('.ask-ov [data-a="1"]', { timeout: 4000 }); await p.click('.ask-ov [data-a="1"]'); await p.waitForTimeout(300);
  check(await p.evaluate(() => JSON.parse(localStorage.getItem('duoCards') || '[]').length) === 5, 'link wczytuje karty na urządzenie');
  check(await p.evaluate(() => !JSON.stringify(S).includes('Przykładowy fant')), 'karty nie trafiają do synchronizowanych danych');
  await go('#/duo/admin'); check((await view()).includes('Przykładowa nagroda'), 'panel kart pokazuje wczytane karty');
  check(await p.evaluate(async () => (await duoLink()).includes('#/duo?d=')), 'panel generuje link do kart');
  await go('#/duo'); check((await view()).includes('Start'), 'ekran startowy');
  await p.evaluate(() => { const ds = S.decks.slice(-2).map(d => d.id); S.stats.duoPrefs = { ...duoPrefs(), mods: false }; duoStart(['A', 'B'], ds, [1, 1, 1]); ACTIONS['duo-round'](); });
  const st = () => p.evaluate(() => ({ r: DUO.round, ph: DUO.phase, k: DUO.step?.k, card: DUO.step?.card?.content || null, sc: DUO.score.join(':') }));
  await p.evaluate(() => { ACTIONS['duo-show'](); ACTIONS['duo-ans']({ dataset: { v: '1' } }); }); let s = await st(); check(s.k === 'card' && s.card === 'Przykładowa nagroda', 'dobrze → reward z rundy 1');
  await p.evaluate(() => ACTIONS['duo-done']()); await p.evaluate(() => { ACTIONS['duo-show'](); ACTIONS['duo-ans']({ dataset: { v: '0' } }); }); s = await st(); check(s.card === 'Przykładowy fant', 'źle → forfeit');
  await p.evaluate(() => ACTIONS['duo-pass']()); s = await st(); check(s.k === 'q' && s.sc === '1:0', 'pas pomija kartę bez kary');
  await p.evaluate(() => { DUO.timeUp = true; ACTIONS['duo-show'](); ACTIONS['duo-ans']({ dataset: { v: '1' } }); ACTIONS['duo-done'](); }); s = await st(); check(s.ph === 'roundEnd', 'koniec czasu → koniec rundy');
  await p.evaluate(() => { ACTIONS['duo-round'](); ACTIONS['duo-round'](); DUO.timeUp = true; ACTIONS['duo-show'](); ACTIONS['duo-ans']({ dataset: { v: '1' } }); ACTIONS['duo-done'](); ACTIONS['duo-round'](); ACTIONS['duo-round'](); });
  s = await st(); check(s.r === 3 && s.k === 'stake', 'runda 3: wybór stawki');
  await p.evaluate(() => { ACTIONS['duo-stake']({ dataset: { v: '1' } }); ACTIONS['duo-show'](); ACTIONS['duo-ans']({ dataset: { v: '1' } }); });
  s = await st(); check(s.card === 'Przykładowa nagroda 3' && s.sc === '5:0', 'va banque dobrze → +2 i karta z najwyższej puli');
  await p.evaluate(() => { ACTIONS['duo-done'](); ACTIONS['duo-stake']({ dataset: { v: '1' } }); ACTIONS['duo-show'](); ACTIONS['duo-ans']({ dataset: { v: '0' } }); });
  s = await st(); check(s.card === 'Przykładowy fant' && s.sc === '5:0', 'va banque źle → forfeit, punkty nie spadają poniżej 0');
  await p.evaluate(() => { ACTIONS['duo-done'](); ACTIONS['duo-stake']({ dataset: { v: '0' } }); ACTIONS['duo-show'](); ACTIONS['duo-ans']({ dataset: { v: '1' } }); });
  s = await st(); check(s.card === 'Przykładowa nagroda 2' && s.sc === '6:0', 'bezpiecznie → +1 i łagodniejsza pula');
  await p.evaluate(() => { DUO.timeUp = true; ACTIONS['duo-done'](); ACTIONS['duo-round'](); ACTIONS['duo-round'](); });
  s = await st(); check(s.r === 4 && s.k === 'q', 'runda 4: egzamin');
  await p.evaluate(() => { for (let i = 0; i < 5; i++) { ACTIONS['duo-show'](); ACTIONS['duo-ans']({ dataset: { v: i < 4 ? '1' : '0' } }); } }); s = await st(); check(s.card === 'Przykładowa nagroda 4', 'egzamin 4/5 → zaliczony');
  await p.evaluate(() => { ACTIONS['duo-done'](); for (let i = 0; i < 5; i++) { ACTIONS['duo-show'](); ACTIONS['duo-ans']({ dataset: { v: i < 3 ? '1' : '0' } }); } }); s = await st(); check(s.card === 'Przykładowy fant', 'egzamin 3/5 → niezaliczony');
  await p.evaluate(() => ACTIONS['duo-done']()); s = await st(); check(s.ph === 'end', 'koniec sesji');
  check(await p.evaluate(() => !!document.querySelector('[data-act="duo-review"]')) || (await view()).includes('Bez pomyłek'), 'podsumowanie: powtórka pomylonych fiszek');
  // 4) wyzwania dla pary i nauka
  const r4 = await p.evaluate(() => {
    const ds = S.decks.slice(-2).map(d => d.id);
    S.cards.filter(c => ds.includes(c.deckId)).forEach(c => { c.srs = { ...c.srs, state: 'review', ivl: 3, due: Date.now() - 864e5 }; });
    S.stats.duoPrefs = { ...duoPrefs(), mods: true, srs: true }; duoStart(['A', 'B'], ds, [5, 5, 5]); DUO.modRound = 1; DUO.mod = null; ACTIONS['duo-round']();
    const out = {}; const ans = ok => { ACTIONS['duo-show'](); ACTIONS['duo-ans']({ dataset: { v: ok ? '1' : '0' } }); };
    const id0 = DUO.step.id, due0 = cardById(id0).srs.due; ans(true); out.srs = cardById(id0).srs.due > Date.now() && cardById(id0).srs.due !== due0;
    // seria: gracz A 3 dobre z rzędu (tury się przeplatają)
    ACTIONS['duo-done'](); ans(true); ACTIONS['duo-done'](); ans(true); ACTIONS['duo-done'](); ans(true); ACTIONS['duo-done'](); ans(true);
    out.streak = DUO.step.streak === true; out.goal = DUO.goal;
    for (let i = 0; i < 6 && !DUO.goalHit; i++) { ACTIONS['duo-done'](); if (DUO.step.k === 'team') ACTIONS['duo-done'](); ans(true); }
    out.goalHit = DUO.goalHit; ACTIONS['duo-done'](); out.team = DUO.step.k === 'team' && DUO.step.cards.length === 2;
    ACTIONS['duo-done'](); DUO.mod = 'fast'; DUO.step.t0 = Date.now() - 999999; return out; });
  await p.waitForTimeout(600);
  const late = await p.evaluate(() => DUO.step.k === 'card' && DUO.step.late === true);
  check(r4.srs, 'odpowiedź na zaległą fiszkę zapisuje się jako powtórka');
  check(r4.streak, `seria ${3} dobrych → bonus`); check(r4.goalHit && r4.team, 'wspólny cel rundy → nagroda dla obojga');
  check(late, 'szybka runda: po czasie liczy się jako źle');
  await p.evaluate(() => { DUO.modRound = 1; DUO.mod = 'reverse'; DUO.phase = 'play'; DUO.step = { k: 'q', id: DUO.q[0][0], shown: false, t0: Date.now() }; render(); });
  check((await view()).includes('Podaj pytanie'), 'wyzwanie „odwrotnie” pokazuje odpowiedź jako pytanie');
  await go('#/duo/admin'); check((await view()).includes('Przykładowa nagroda'), 'lista kart');
  check(!errs.length, 'brak wyjątków JS' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); console.log(fails ? `${fails} błędów` : 'Wszystko OK'); process.exit(fails ? 1 : 0);
})();

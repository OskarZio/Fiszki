// Test duo mode: nie-admin dostaje 404 i nie widzi trybu w nawigacji; admin może rozegrać sesję.
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

  // 1) nie-admin (także tester z wczytanym bundle-x)
  for (const tester of [false, true]) {
    await p.evaluate(t => { IS_ADMIN = false; MY_TESTS = t ? ['kumul'] : []; }, tester);
    if (tester) { await p.evaluate(() => lazyLoad()); await p.waitForFunction(() => LAZY === 2, { timeout: 8000 }).catch(() => {}); }
    for (const h of ['#/duo', '#/duo/admin']) { await go(h); const t = await view(); check(t.includes('404') && !/Duo|karty/i.test(t.replace('404', '')), `${tester ? 'tester' : 'użytkownik'}: ${h} → 404`); }
    const unknown = (await (go('#/nieistnieje'), view())); await go('#/duo'); check(unknown === await view(), `${tester ? 'tester' : 'użytkownik'}: #/duo wygląda jak nieistniejąca trasa`);
    for (const h of ['#/', '#/boss', '#/host', '#/more', '#/me', '#/shop']) { await go(h);
      const leak = await p.evaluate(() => [...document.querySelectorAll('[href],[data-go],[data-act]')].some(e => /duo/i.test((e.getAttribute('href') || '') + (e.dataset.go || '') + (e.dataset.act || ''))) || /\bDuo\b/.test(document.body.innerText));
      check(!leak, `${tester ? 'tester' : 'użytkownik'}: brak linku do trybu na ${h}`); }
  }
  // 2) admin: atrapa bazy z neutralnymi kartami, cała sesja
  await p.evaluate(() => { IS_ADMIN = true; lazyLoad(); });
  await p.waitForFunction(() => LAZY === 2 && typeof duoStart === 'function', { timeout: 8000 });
  await p.evaluate(() => { DUO_CARDS = { list: [{ id: 1, type: 'reward', round: 1, content: 'Przykładowa nagroda', active: true }, { id: 2, type: 'reward', round: 2, content: 'Przykładowa nagroda 2', active: true },
    { id: 3, type: 'reward', round: 3, content: 'Przykładowa nagroda 3', active: true }, { id: 4, type: 'reward', round: 4, content: 'Przykładowa nagroda 4', active: true }, { id: 5, type: 'forfeit', round: null, content: 'Przykładowy fant', active: true }] }; });
  await go('#/host'); check(await p.evaluate(() => !!document.querySelector('[data-go="#/duo"]')), 'admin: link w Panelu hosta');
  await go('#/duo'); check((await view()).includes('Start'), 'admin: ekran startowy');
  await p.evaluate(() => { const ds = S.decks.slice(-2).map(d => d.id); duoStart(['A', 'B'], ds, [1, 1, 1]); ACTIONS['duo-round'](); });
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
  await go('#/duo/admin'); check((await view()).includes('Przykładowa nagroda'), 'admin: lista kart');
  check(!errs.length, 'brak wyjątków JS' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); console.log(fails ? `${fails} błędów` : 'Wszystko OK'); process.exit(fails ? 1 : 0);
})();

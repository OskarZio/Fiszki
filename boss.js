'use strict';
/* ⚔️ Bossowie: cała talia rozłożona na rozdziały (po 20 fiszek) – każdy rozdział ma bossa, finał to CAŁA talia.
   Boss rozdziału budzi się, gdy nauczysz się wszystkich jego fiszek. Do tego bossowie kategorii (kilka talii naraz) i świata.
   • 4 tryby: ABCD (cios ×0,5), Fiszki (×1), Wpisz (×1,5), Mix (losowo).
   • Uczciwość: za szybkie „Łatwo” bez czytania = słaby cios; boss robi sprawdziany ABCD z kart ocenionych jako łatwe –
     przyłapany tracisz zadane obrażenia i dostajesz kontrę, a mniej łupów.
   • Trudniejsi bossowie liczą czas (za długie myślenie = atak), mają przeszkadzajki: lód do rozbicia, robaki, truciznę, ciszę.
   • Seria lekko zwiększa obrażenia, dobre odpowiedzi ładują supercios postaci. Przegrana = −1 serce.
   • Skrzynia: stukasz, losuje się (widać szanse w %), duplikat ulepsza przedmiot. */

const BOSS_REQ = 15, WORLD_REQ = 40, CH_SIZE = 20, CH_MIN_LAST = 8, STARS_MAX = 3;
// ---------- 🎭 bossowie z charakterem (każdy dokucza po swojemu)
const BOSS_NAMES = [
  ['Prokrastynator', 'Szepcze: „zrobisz to jutro”.', { start: ['Ej, może jutro? Jutro jest lepsze.', 'Usiądź, odpocznij… nauka nie ucieknie. Ja też nie.'], hit: ['Auć! Kto się uczy przed terminem?!', 'Nie tak szybko, miało być „na ostatnią chwilę”!'], miss: ['Widzisz? Trzeba było odłożyć.', 'Haha, jutro też nie będziesz wiedział!'], attack: ['Fala odkładania!', 'Jeszcze 5 minut… i jeszcze 5…'], low: ['Dobra, dobra… może jednak dziś…'], down: ['Nieee… zrobiłeś to DZIŚ?!'], win: ['Wróć jutro. Albo pojutrze. Albo wcale.'] }],
  ['Krzywa Zapominania', 'Zjada wszystko, czego nie powtórzysz.', { start: ['Mmm, czuję świeżą wiedzę… niepowtórzoną.', 'Po 24 godzinach zostanie Ci 30%. Smacznego.'], hit: ['Powtórka?! Moja krzywa się wypłaszcza!', 'Ała, to było utrwalone!'], miss: ['Mniam, zapomniane!', 'Ta fiszka już jest moja.'], attack: ['Wykładnicze zapominanie!', 'Zjem Ci ostatni wykład!'], low: ['Za dużo powtórek… robi mi się płasko…'], down: ['Rozłożone powtórki… moja jedyna słabość…'], win: ['Za tydzień nie będziesz pamiętał tej walki.'] }],
  ['Pan Rozkojarzony', 'Kusi powiadomieniami.', { start: ['Ding! Masz nową wiadomość! …żartuję. Albo nie?', 'Zobacz, jaki śmieszny filmik!'], hit: ['Jak możesz się skupić?!', 'Wyłączyłeś powiadomienia?! Zdrajca!'], miss: ['Hehe, telefon zawibrował?', 'Skupienie poziom: złota rybka.'], attack: ['Bzzzt! 99+ powiadomień!', 'Scrolluj, scrolluj…'], low: ['Tryb skupienia?! Nieuczciwe!'], down: ['Jesteś… zbyt… skupiony…'], win: ['Idź pooglądać rolki, zasłużyłeś.'] }],
  ['Kolokwiusz', 'Strażnik pierwszego terminu.', { start: ['Proszę odłożyć notatki. Zaczynamy.', 'Pytanie pierwsze, za pół punktu…'], hit: ['Hmm, poprawnie. Podejrzanie poprawnie.', 'Pół punktu… dobrze, cały.'], miss: ['Niestety, zero punktów.', 'To było na wykładzie. Na którym pana nie było.'], attack: ['Pytanie dodatkowe!', 'Kolokwium poprawkowe – teraz!'], low: ['Dobrze, zaliczam… prawie.'], down: ['Zaliczone. Na piątkę. Niechętnie.'], win: ['Zapraszam na drugi termin.'] }],
  ['Mgła o 3 w nocy', 'Wymazuje pamięć przed egzaminem.', { start: ['Ziew… o tej porze nic nie zapamiętasz…', 'Kawa już nie działa, prawda?'], hit: ['Wyspałeś się?! Jak śmiesz!', 'Sen utrwalił Ci wiedzę… niesprawiedliwe!'], miss: ['Co to było? Nikt nie wie o 3 w nocy.', 'Zzz… pustka.'], attack: ['Fala senności!', 'Ciężkie powieki!'], low: ['Za dużo snu… robię się przejrzysta…'], down: ['Świt… nieee…'], win: ['Idź spać. Ale nie przed egzaminem, hehe.'] }],
  ['Lord Ściąga', 'Nienawidzi uczciwej nauki.', { start: ['Psst… mam ściągę. Chcesz?', 'Uczciwa nauka? Jakie to staromodne.'], hit: ['Nauczyłeś się NAPRAWDĘ?!', 'Bez ściągi?! Niemożliwe!'], miss: ['Trzeba było ode mnie ściągnąć!', 'Kłamczuch przyłapany!'], attack: ['Atak podejrzeń!', 'Zgłaszam Cię do dziekana!'], low: ['Moje ściągi… płoną…'], down: ['Wiedza… prawdziwa wiedza… aaa!'], win: ['Następnym razem weź ściągę.'] }],
  ['Sesjozaur', 'Budzi się raz na semestr.', { start: ['RAAAWR! Sesja przyszła!', 'Spałem cały semestr. A Ty?'], hit: ['Grrr! Uczyłeś się w semestrze?!', 'RAWR… to bolało!'], miss: ['HAHA! Wkuwanie na ostatnią chwilę!', 'Zjem Twoją średnią!'], attack: ['TUPNIĘCIE SESJI!', 'Ryk terminu!'], low: ['Wracam… do snu… na semestr…'], down: ['Wyginąłem… jak wszyscy dinozaury…'], win: ['Do zobaczenia we wrześniu!'] }],
  ['Wielki Prowadzący', 'Zadaje podchwytliwe pytania.', { start: ['Ciekawe… zobaczymy, co pan wie.', 'Proszę mi to wyjaśnić własnymi słowami.'], hit: ['Hmm, dobrze. Ale dlaczego?', 'Poprawnie. Następne będzie trudniejsze.'], miss: ['Przecież to podstawy!', 'Proszę wrócić do literatury.'], attack: ['Pytanie z gwiazdką!', 'A teraz proszę to samo – na odwrót!'], low: ['Widzę, że pan przygotowany…'], down: ['Gratuluję. Szczerze.'], win: ['Zapraszam na konsultacje.'] }],
];
const FINAL_BOSSES = [['Arcyegzaminator', 'Zna każde pytanie z całej talii.', 'w_lion'], ['Hydra Sesji', 'Za każde zapomnienie odrasta jej głowa.', 'w_snake'], ['Król Zaległości', 'Rządzi wszystkim, czego nie powtórzyłeś.', 'w_troll'],
  ['Skorpion Kolokwiów', 'Jad zapomnienia w ogonie.', 'w_scorpion'], ['Rekin Terminów', 'Wyczuwa strach przed egzaminem.', 'w_shark'], ['Wilk Wkuwacz', 'Wyje do księżyca w noc przed egzaminem.', 'w_wolf']];
const WORLD_BOSSES = [['Smok Sesji', 'Pożera całe semestry naraz.', 'w_dragon'], ['Ogr Zaległości', 'Rośnie z każdą odłożoną powtórką.', 'w_ogre'], ['Pajęczyca Rozproszeń', 'Oplata myśli powiadomieniami.', 'w_spider'],
  ['Kosmita Ściągawek', 'Przyleciał podejrzeć Twoje odpowiedzi.', 'w_alien'], ['Robot Wkuwacz', 'Zna tylko wkuwanie na pamięć.', 'w_robot'], ['Duch Zapomnienia', 'Przenika przez nieutrwaloną wiedzę.', 'w_ghost'], ['Ośmiornica Terminów', 'Osiem macek, osiem kolokwiów.', 'w_octo'], ['Kościej Egzaminator', 'Pytał już Twoich dziadków.', 'w_skull']];
const CAT_BOSSES = [['Goblin Działów', 'Miesza materiał z kilku talii.', 'w_goblin'], ['Kałamarnica Pojęć', 'Każda macka – inny przedmiot.', 'w_squid'], ['Nietoperz Skrótów', 'Lata między tematami.', 'w_bat']];
const BOSS_TALK = {
  start: ['Ha! Kolejny student, który „uczył się wczoraj”.', 'Twoje fiszki są moje!'], hit: ['Auć!', 'Hmpf. Szczęściarz.'], miss: ['HA! Na tyle Cię stać?', 'Pudło!'], attack: ['Przyjmij to!', 'Masz!'], low: ['N-nie… jeszcze nie skończyłem!'], down: ['Nieeee! Wrócę!'], win: ['Wróć, jak powtórzysz materiał!'],
  crit: ['KRYTYK?! Kto Cię tego nauczył?!', 'To nie fair, Ty masz FSRS!'], combo: ['Seria?! Przestań się uczyć regularnie!', 'Za dobrze Ci idzie… podejrzane.'],
  meLow: ['Jeszcze trochę i wracasz do zeszytu!', 'Słyszę już szelest poprawki…'], potion: ['Mikstura? Oszust!', 'Doping! Zgłaszam to dziekanowi!'],
  slow: ['Tik-tak! Za długo myślisz!', 'Halo? Jest tam kto?', 'Na egzaminie nikt nie będzie czekał!'], fast: ['Tak szybko? Nawet nie przeczytałeś!', 'Przeklikujesz? Sprawdzę Cię!'],
  verify: ['Hola! Sprawdźmy, czy naprawdę to wiesz.', 'Mówisz „łatwo”? Udowodnij!'], caught: ['PRZYŁAPANY! Wcale tego nie wiedziałeś!', 'Kłamczuch! Oddawaj obrażenia!'], proven: ['Grr… faktycznie wiesz.', 'No dobra, nie oszukiwałeś.'],
  ult: ['CO TO BYŁO?!', 'Nieee, tylko nie supercios!'], ice: ['Zamarznij! ❄️', 'Lodowa pustka w głowie!'], bugs: ['Moje robaczki zjedzą Ci odpowiedź!', 'Bzzz… 🐛'],
};
const BOSS_ABIL = { heal: ['💚', 'Regeneracja', 'leczy się'], shield: ['🛡️', 'Tarcza', 'osłabia Twój następny cios'], ice: ['❄️', 'Zamrożenie', 'skuwa kartę lodem – rozbij go stuknięciami'],
  bugs: ['🐛', 'Robaczki', 'oblepia odpowiedzi robakami – zabij je, zanim odpowiesz'], poison: ['☠️', 'Trucizna', '−4 ❤️ przez 3 tury'], silence: ['🔇', 'Cisza', 'blokuje mikstury i supercios na 2 tury'], rage: ['😡', 'Szał', 'poniżej połowy ❤️ bije mocniej'] };
const ABIL_ORDER = ['shield', 'ice', 'heal', 'bugs', 'poison', 'silence', 'rage'];
const BOSS_MOVES = ['Cios zapomnienia', 'Fala prokrastynacji', 'Podchwytliwe pytanie', 'Pustka w głowie', 'Atak terminu', 'Wir notatek'];
const THINK_S = [0, 25, 18, 14, 11];   // limit namysłu wg trudności (0 = bez limitu)
const MODES = { abcd: { name: 'ABCD', icon: '🔤', mul: '×0,5', desc: 'wybierasz z 4 odpowiedzi' }, flip: { name: 'Fiszki', icon: '🃏', mul: '×1', desc: 'odkrywasz i oceniasz' },
  type: { name: 'Wpisz', icon: '⌨️', mul: '×1,5', desc: 'wpisujesz odpowiedź' }, mix: { name: 'Mix', icon: '🔀', mul: 'losowo', desc: 'każda karta w innym trybie' } };
const MODE_HP = { abcd: .65, flip: 1, type: 1.1, mix: .95 }, MODE_REWARD = { abcd: .6, flip: 1, type: 1.3, mix: 1 };

// ---------- 📚 materiał: rozdziały talii (stałe – nowe fiszki dochodzą na koniec)
const fightable = c => c.sus !== 'skip' && noteById(c.noteId);
function deckChapters(d) {
  const cs = S.cards.filter(c => c.deckId === d.id && fightable(c)).sort((a, b) => a.pos - b.pos), out = [];
  for (let i = 0; i < cs.length; i += CH_SIZE) out.push(cs.slice(i, i + CH_SIZE));
  if (out.length > 1 && out[out.length - 1].length < CH_MIN_LAST) out[out.length - 2].push(...out.pop());
  return out;
}
const learnedN = cs => cs.filter(c => c.srs.state !== 'new').length;
const deckLearned = d => learnedN(S.cards.filter(c => c.deckId === d.id && fightable(c)));
const learnedAll = () => learnedN(S.cards.filter(fightable));
function deckRec(d) {
  const r = d.boss = d.boss || {};
  if (!r.ch) { r.ch = {}; for (let i = 0; i < (r.stage || 0); i++) r.ch[i] = 1; }   // stary zapis „etap N” → pierwsze rozdziały pokonane
  return r;
}
// rozdział właśnie nauczony (wywołuje hero.js po nauce nowej fiszki) → numer rozdziału albo null
function chapterJustLearned(c) {
  const d = deckById(c.deckId); if (!d) return null;
  const chs = deckChapters(d), i = chs.findIndex(ch => ch.some(x => x.id === c.id)); if (i < 0 || chs.length < 2) return null;
  if (learnedN(chs[i]) < chs[i].length) return null;
  const k = 'chl_' + d.id + '_' + i; if (S.stats[k]) return null; S.stats[k] = 1; return i;
}
// ---------- 🐉 definicje bossów
function bossFor(kind, id, i) {
  const pr = hero().pr || 0;
  if (kind === 'ch') {
    const d = deckById(id), chs = d ? deckChapters(d) : [], cs = chs[i] || []; if (!cs.length) return null;
    const rec = deckRec(d), stars = rec.ch[i] || 0, single = chs.length === 1, h = hashStr(d.id) + i, [name, desc, persona] = BOSS_NAMES[h % BOSS_NAMES.length];
    return { kind, id, i, cards: cs, stars, diff: Math.min(STARS_MAX, stars), name, desc, persona, seed: hashStr(d.id) % 100000 + i * 7919,
      title: single ? `Boss talii „${d.name}”` : `Rozdział ${i + 1}/${chs.length} · „${d.name}”`, ok: learnedN(cs) >= cs.length, learned: learnedN(cs), need: cs.length,
      lockMsg: `Naucz się wszystkich ${cs.length} fiszek rozdziału`, repeat: stars >= STARS_MAX, pr };
  }
  if (kind === 'fin') {
    const d = deckById(id), chs = d ? deckChapters(d) : []; if (chs.length < 2) return null;
    const rec = deckRec(d), stars = rec.fin || 0, cs = chs.flat(), [name, desc, img] = FINAL_BOSSES[hashStr(d.id) % FINAL_BOSSES.length], beaten = chs.filter((_, k) => (rec.ch[k] || 0) >= 1).length;
    return { kind, id, cards: cs, stars, diff: Math.min(4, 1 + stars), name, desc, img, persona: null, final: true, title: `👑 Finał – cała talia „${d.name}” (${cs.length} fiszek)`,
      ok: beaten >= chs.length && learnedN(cs) >= cs.length, learned: beaten, need: chs.length, lockMsg: `Pokonaj bossów wszystkich ${chs.length} rozdziałów`, repeat: stars >= STARS_MAX, pr };
  }
  if (kind === 'cat') {
    const t = typeof topicById === 'function' && topicById(id); if (!t) return null;
    const ds = topicDecks(t, true), cs = S.cards.filter(c => ds.some(d => d.id === c.deckId) && fightable(c)), stars = S.stats['cb_' + t.id] || 0, [name, desc, img] = CAT_BOSSES[hashStr(t.id) % CAT_BOSSES.length];
    return { kind, id, cards: cs.filter(c => c.srs.state !== 'new'), stars, diff: Math.min(4, 1 + stars), name, desc, img, persona: null, title: `${t.emoji || '📁'} Kategoria „${t.name}” – ${ds.length} talie`,
      ok: learnedN(cs) >= 30 && ds.length >= 2, learned: learnedN(cs), need: 30, lockMsg: 'Kategoria z min. 2 taliami i 30 nauczonymi fiszkami', repeat: false, len: 40, pr };
  }
  if (kind === 'world') {
    const st = S.stats.worldStage || 0, [name, desc, img] = WORLD_BOSSES[st % WORLD_BOSSES.length], cs = S.cards.filter(c => fightable(c) && c.srs.state !== 'new');
    return { kind, id: 'world', cards: cs, stars: st, diff: Math.min(4, 1 + Math.floor(st / 2)), name, desc, img, persona: null, title: `🌍 Boss świata · etap ${st + 1} – wszystkie talie`,
      ok: cs.length >= WORLD_REQ, learned: cs.length, need: WORLD_REQ, lockMsg: `Naucz się ${WORLD_REQ} fiszek z dowolnych talii`, repeat: false, len: 50, pr };
  }
  return null;
}
function bossParams(b, mode = BOSS_PICK.mode) {
  const hs = heroStats(), len = Math.min(b.len || 150, b.cards.length), diff = b.diff, big = b.kind !== 'ch';
  const scale = (.55 + .45 * hs.atk) * (1 + .15 * b.pr);
  const abil = (b.img ? ABIL_ORDER : [...ABIL_ORDER].sort((x, y) => (hashStr(b.seed + x) % 7) - (hashStr(b.seed + y) % 7))).slice(0, Math.min(5, diff + (big ? 1 : 0)));
  return { len, hp: Math.round(len * 10 * (.7 + .1 * diff) * (MODE_HP[mode] || 1) * scale), atk: Math.round((9 + 4 * diff + (big ? 4 : 0)) * (.75 + .25 * hs.hp / 100) * (1 + .12 * b.pr)),
    every: diff >= 2 ? 2 : 3, think: THINK_S[Math.min(4, diff)], abil };
}
const bossArt = (b, cls = '') => b.img ? `<div class="boss-art world ${cls}"><img src="assets/fluent/${b.img}.webp" alt="${esc(b.name)}" draggable="false"></div>`
  : `<div class="boss-art ${cls}">${creatureSVG(b.seed, b.diff >= 3 ? 'mythic' : 'epic', { boss: true, label: b.name })}</div>`;
const starsHTML = (n, max = STARS_MAX) => `<span class="bstars">${'★'.repeat(Math.min(n, max))}${'☆'.repeat(Math.max(0, max - n))}</span>`;

// ---------- ⚔️ walka
let BOSS = null, BOSS_PICK = { mode: 'flip' }, BOSS_SEL = null, LESSON_RUN = false;
on('sessionEnd', s => { if (LESSON_RUN && s.cram && S.stats.lesson) { const n = S.stats.lesson.name; delete S.stats.lesson; LESSON_RUN = false; save(); toast(`✅ Lekcja odrobiona – rewanż z ${n} odblokowany!`, 3500); } });
try { Object.assign(BOSS_PICK, JSON.parse(localStorage.getItem('bossPick') || '{}')); } catch { /* */ }
const bossPickSave = () => { try { localStorage.setItem('bossPick', JSON.stringify(BOSS_PICK)); } catch { /* */ } };
function bossSay(k) {
  const B = BOSS; if (!B) return;
  const own = B.b.persona?.[k], l = own && (Math.random() < .7 || !BOSS_TALK[k]) ? own : BOSS_TALK[k] || [];
  if (l.length) B.say = { txt: l[Math.random() * l.length | 0], t: Date.now(), k };
}
const bossKey = b => `${b.kind}:${b.id}:${b.i ?? ''}`;
const lessonFor = b => { const L = S.stats.lesson; return L && L.k === bossKey(b) && L.ids?.some(id => S.cards.some(c => c.id === id)) ? L : null; };
function bossStart(kind, id, i) {
  const b = bossFor(kind, id, i == null ? null : +i); if (!b) return;
  if (!b.ok) return toast(`🔒 ${b.lockMsg} (${b.learned}/${b.need})`, 4000);
  if (lessonFor(b)) return toast(`📚 Najpierw lekcja z porażki: powtórz ${lessonFor(b).ids.length} fiszek, na których ${b.name} Cię pokonał`, 4500);
  if (lives().n < 1) return toast(`🖤 Brak serc. Odzyskasz je za ${fmtLeft(LIFE_MS - (Date.now() - lives().t))} albo za ${LIFE_REV - (lives().rev || 0)} powtórek nauki.`, 5000);
  bossBegin(b);
}
// start walki z gotowym bossem (b.cards = pula fiszek); używa też lobby (hydra)
function bossBegin(b, extra = {}, p0 = null) {
  const kind = b.kind, mode = BOSS_PICK.mode, p = p0 || bossParams(b, mode), hs = heroStats(), now = Date.now();
  const due = shuffle(b.cards.filter(c => c.srs.state !== 'new' && c.srs.due <= now)), rest = shuffle(b.cards.filter(c => !due.includes(c)));
  const ids = [...due, ...rest].slice(0, p.len).map(c => c.id);
  const pool = S.cards.filter(c => (kind === 'world' || b.cards.some(x => x.deckId === c.deckId)) && fightable(c)).map(distractorEntry).filter(x => x.a && x.a.length <= 120);
  BOSS = { b: { ...b, ...p }, mode, ids, i: 0, hp: p.hp, max: p.hp, me: hs.hp, meMax: hs.hp, hs, cap: Math.max(12, Math.round(p.hp * .15)), combo: hs.combo0, best: 0, ok: 0, bad: 0, verOk: 0, caught: 0, fast: 0,
    phase: 'fight', lostHp: 0, timer: p.every, move: null, shield: false, power: 0, guard: 0, potUsed: 0, second: hs.second, ult: 0, poison: 0, silence: 0, timeFree: 0,
    verQ: [], pendIce: false, pendBugs: 0, log: [], pool, missed: [], dealt: {}, startedAt: now, ...extra };
  BOSS.move = pickMove(BOSS.b); BOSS_SEL = null;
  presentCard(); bossSay('start');
  go('#/boss/fight'); render();
}
const pickMove = b => { const opts = ['hit', 'hit', ...b.abil.filter(a => a !== 'rage')], k = opts[Math.random() * opts.length | 0], atk = b.atk;
  return k === 'hit' ? { k, name: BOSS_MOVES[Math.random() * BOSS_MOVES.length | 0], dmg: atk + (Math.random() * 6 | 0) } : { k, name: BOSS_ABIL[k][1], dmg: 0 }; };
const bossCard = () => BOSS?.cur && S.cards.find(c => c.id === BOSS.cur.id);
const textOk = v => v.ans && v.ans.trim() && v.ans.length <= 120;
function abcdOpts(c) {
  const B = BOSS, e = distractorEntry(c); if (!e.a || e.a.length > 120) return null;
  const wrong = pickDistractors(e, B.pool.filter(x => norm(x.a) !== norm(e.a)), 3); if (wrong.length < 3) return null;
  return shuffle([e.a, ...wrong]);
}
// kolejna karta: najpierw zaległy sprawdzian bossa, potem następna z puli
function presentCard() {
  const B = BOSS, vi = B.verQ.findIndex(v => v.at <= B.i || B.i >= B.ids.length);
  let id, ver = null;
  if (vi >= 0) { ver = B.verQ.splice(vi, 1)[0]; id = ver.id; } else if (B.i < B.ids.length) id = B.ids[B.i]; else { B.cur = null; return; }
  const c = S.cards.find(x => x.id === id); if (!c) { B.i++; return presentCard(); }
  const v = cardView(c);
  let cm = ver ? 'abcd' : B.mode === 'mix' ? ['abcd', 'flip', 'type'][Math.random() * 3 | 0] : B.mode, opts = null;
  if (cm === 'abcd') { opts = abcdOpts(c); if (!opts) cm = ver ? (textOk(v) ? 'type' : null) : textOk(v) ? 'type' : 'flip'; }
  if (cm === 'type' && !textOk(v)) cm = 'flip';
  if (ver && !cm) return presentCard();   // tej karty nie da się sprawdzić – pomijamy sprawdzian
  B.cur = { id, cm, opts, ver, hidden: [] };
  B.shown = false; B.typed = null; B.verdict = null; B.picked = null; B.qAt = Date.now(); B.revealAt = 0;
  const free = B.timeFree > 0;
  B.ice = B.pendIce && !free ? { n: B.hs.ice ? 3 : 6, max: B.hs.ice ? 3 : 6 } : null; B.pendIce = false;
  B.bugs = B.pendBugs && !free ? Array.from({ length: B.pendBugs }, (_, k) => ({ k, x: 8 + Math.random() * 78, y: 10 + Math.random() * 70, img: ['g_bug', 'g_ant', 'g_roach', 'g_ladybug', 'g_worm', 'g_mosq'][Math.random() * 6 | 0], d: (Math.random() * 2).toFixed(2) })) : []; B.pendBugs = 0;
  if (ver) bossSay('verify');
}
const bossHpLow = B => B.hp < B.max * .25;
function dealBoss(n, label) { const B = BOSS; n = Math.max(0, Math.round(n)); if (B.coop && typeof coopHit === 'function') return coopHit(n, label); B.hp = Math.max(0, B.hp - n); return n; }
const bossAlive = B => B.coop && typeof coopAlive === 'function' ? coopAlive() : B.hp > 0;
function hurtMe(n, label) {
  const B = BOSS; if (B.down) return;
  if (B.guard > 0) { B.guard--; B.fxMe = { k: 'block', t: Date.now() }; B.log.unshift(`🛡️ Zablokowałeś: ${label}`); return; }
  if (Math.random() < B.hs.dodge) { B.fxMe = { k: 'dodge', t: Date.now() }; B.log.unshift(`💨 Unik! ${label} chybia`); return; }
  const dmg = Math.round(n * (1 - B.hs.def) * (B.b.abil.includes('rage') && B.hp < B.max / 2 ? 1.4 : 1));
  B.me -= dmg; B.lostHp += dmg; B.fxMe = { k: 'hit', n: dmg, t: Date.now() }; B.log.unshift(`💥 ${label}: −${dmg} ❤️`);
  if (B.hs.thorns && bossAlive(B)) { const r = dealBoss(dmg * B.hs.thorns); if (r) B.log.unshift(`🌵 Odbicie: −${r} dla bossa`); }
  if (B.me <= 0 && B.second) { B.me = 1; B.second = false; B.log.unshift('✨ Drugie życie! Zostaje Ci 1 ❤️'); }
  if (B.me <= 0 && potionN('phoenix') > 0) { addItem('potion', 'phoenix', -1); B.me = Math.round(B.meMax / 2); B.log.unshift('🔥 Feniks! Wstajesz z połową ❤️'); }
  if (B.me <= 0 && B.coop && typeof coopDown === 'function') coopDown();
}
const healMe = n => { const B = BOSS; if (n > 0 && !B.down) B.me = Math.min(B.meMax, B.me + Math.round(n)); };
// minimalny czas na przeczytanie odpowiedzi – szybsze „Łatwo” to przeklikiwanie
const minRead = c => { const v = cardView(c); return Math.min(2600, 600 + 25 * (v.ans || stripHtml(v.b || '')).length); };
// how: 'flip' (g 1–3) · 'type' (werdykt) · 'abcd' (trafione?)
function bossAnswer(g, how) {
  const B = BOSS, c = bossCard(), cur = B?.cur; if (!B || !c || B.phase !== 'fight' || B.ice || B.bugs?.length) return;
  const now = Date.now(), ms = Math.min(60000, now - B.qAt);
  B.fx = null; B.fxMe = null; B.bossAct = null;
  if (cur.ver) return verifyResult(c, g >= 3);
  // harmonogram: zaległe karty liczą się jako powtórka (sprawdziany już nie)
  if (c.srs.due <= now && c.srs.state !== 'new' && !B.down) {
    const sg = Math.min(3, g), entry = { id: uid(), c: c.id, d: c.deckId, t: now, g: sg, n: 0, ms, m: how === 'flip' ? 'flip' : 'type', boss: 1, ...(how === 'type' ? { v: B.verdict } : {}) };
    c.srs = schedule(c.srs, sg); touch(c); S.log.push(entry); emit('review', c, sg, false);
  } else (S.tlog = S.tlog || []).push({ id: uid(), t: now, d: c.deckId, ms });
  if (B.down) { if (g >= 3 && typeof coopSelfRevive === 'function') coopSelfRevive(); return afterTurn(g); }
  const hs = B.hs;
  if (g >= 2) {
    const fast = how === 'flip' && g >= 3 && B.revealAt && now - B.revealAt < minRead(c);
    if (g >= 3 && !fast) { B.combo++; B.best = Math.max(B.best, B.combo); }
    else if (g === 2 && !hs.steady) B.combo = 0;
    B.ok++;
    const modeM = how === 'abcd' ? hs.abcdM : how === 'type' && B.verdict === 'ok' ? hs.typeM : 1;
    const comboM = Math.min(2.2, 1 + .06 * Math.min(15, B.combo) * hs.combo), crit = Math.random() < hs.crit && !fast;
    let dmg = 10 * hs.atk * modeM * comboM * (g === 2 ? .5 : 1) * (crit ? 2 : 1) * (bossHpLow(B) ? 1 + hs.exec : 1) * (B.power > 0 ? 2 : 1) * (B.ok === 1 ? hs.first : 1) * (fast ? .3 : 1);
    if (B.power > 0) B.power--;
    if (B.shield) { dmg *= .5; B.shield = false; B.log.unshift('🛡️ Tarcza bossa osłabia cios'); }
    dmg = dealBoss(Math.min(B.cap * (crit ? 1.3 : 1), dmg), 'cios');
    B.dealt[c.id] = (B.dealt[c.id] || 0) + dmg; B.fx = { k: 'boss', n: dmg, crit: crit || comboM >= 1.6, t: now };
    if (hs.vamp) healMe(dmg * hs.vamp);
    if (g >= 3 && hs.regen) healMe(hs.regen);
    if (!fast && g >= 3) B.ult = Math.min(hs.ultNeed, B.ult + (crit ? 2 : 1));
    if (g >= 3 && B.coop && typeof coopOnCorrect === 'function') coopOnCorrect();
    if (fast) { B.fast++; B.log.unshift('⚡ Za szybko – przeczytaj odpowiedź! Słaby cios'); bossSay('fast'); }
    else bossSay(crit ? 'crit' : B.combo >= 3 && B.combo % 4 === 0 ? 'combo' : bossHpLow(B) ? 'low' : 'hit');
    // sprawdzian: część kart ocenionych „Łatwo” wraca za chwilę jako ABCD (przy przeklikiwaniu – częściej)
    if (how === 'flip' && g >= 3 && Math.random() < (fast ? .7 : .3)) B.verQ.push({ id: c.id, at: B.i + 2 + (Math.random() * 3 | 0), dealt: dmg });
  } else {
    B.combo = 0; B.bad++; B.missed.push(c.id); hurtMe(Math.round(B.b.atk * .8), 'Kontra bossa'); bossSay(B.me < B.meMax * .35 ? 'meLow' : 'miss');
  }
  afterTurn(g);
}
function verifyResult(c, ok) {
  const B = BOSS, v = B.cur.ver, now = Date.now();
  if (ok) { const n = dealBoss(Math.max(6, v.dealt * .5 * B.hs.verify), 'sprawdzian'); B.verOk++; B.ult = Math.min(B.hs.ultNeed, B.ult + 1); B.fx = { k: 'boss', n, crit: true, t: now }; B.log.unshift(`🔍 Udowodnione! +${n} obrażeń`); bossSay('proven'); }
  else {
    if (!B.coop) B.hp = Math.min(B.max, B.hp + v.dealt);
    B.caught++; B.combo = 0; B.missed.push(c.id); B.log.unshift(`🕵️ Przyłapany! Boss odzyskuje ${v.dealt} ❤️`); hurtMe(Math.round(B.b.atk * 1.2), 'Kara za przeklikanie'); bossSay('caught');
    if (c.srs.state !== 'new') { c.srs = schedule(c.srs, 1); touch(c); }   // jednak nie umiesz – karta wraca szybciej
  }
  afterTurn(ok ? 3 : 1, true);
}
function afterTurn(g, isVer) {
  const B = BOSS, now = Date.now();
  if (B.poison > 0 && !B.down) { B.poison--; hurtMe(4, 'Trucizna'); }
  if (B.silence > 0) B.silence--;
  if (B.timeFree > 0) B.timeFree--;
  // tura bossa: odliczanie do zapowiedzianego ruchu
  if (bossAlive(B) && !B.down && --B.timer <= 0) {
    const mv = B.move; B.bossAct = { k: mv.k, t: now };
    if (mv.k === 'hit') { hurtMe(mv.dmg, mv.name); bossSay('attack'); }
    else if (mv.k === 'heal') { const h = Math.round(B.max * .08); if (!B.coop) B.hp = Math.min(B.max, B.hp + h); else if (typeof coopHeal === 'function') coopHeal(h); B.log.unshift(`💚 ${B.b.name} leczy się +${h}`); }
    else if (mv.k === 'shield') { B.shield = true; B.log.unshift(`🛡️ ${B.b.name} stawia tarczę`); }
    else if (mv.k === 'ice') { B.pendIce = true; B.log.unshift('❄️ Następna karta zamarznie!'); bossSay('ice'); }
    else if (mv.k === 'bugs') { B.pendBugs = 3 + Math.min(3, B.b.diff); B.log.unshift('🐛 Robaczki nadchodzą!'); bossSay('bugs'); }
    else if (mv.k === 'poison') { B.poison = 3; B.log.unshift('☠️ Trucizna: −4 ❤️ przez 3 tury'); }
    else if (mv.k === 'silence') { B.silence = 2; B.log.unshift('🔇 Cisza: bez mikstur i superciosu przez 2 tury'); }
    B.timer = B.b.every; B.move = pickMove(B.b);
  }
  if (!isVer) B.i++;
  B.log = B.log.slice(0, 4);
  if (B.coop && typeof coopSync === 'function') coopSync();
  save();
  if (!bossAlive(B)) return bossEnd(true);
  if (B.me <= 0 && !B.coop) return bossEnd(false, 'dead');
  if (B.coop && typeof coopLost === 'function' && coopLost()) return bossEnd(false, 'dead');
  presentCard();
  if (!B.cur) return bossEnd(false, 'cards');
  bossSfx(g >= 2 ? 'hit' : 'hurt'); render();
}
// ⚡ supercios postaci
const ULT_FX = {
  cat: B => { const n = ultHit(3); healMe(B.meMax * .3); return `+30% ❤️ · −${n}`; },
  frog: B => { B.shield = false; const n = ultHit(3.5); healMe(15); return `zerwana tarcza · −${n}`; },
  dog: B => { const n = ultHit(2.5); B.guard += 3; return `3 bloki · −${n}`; },
  owl: B => { const n = ultHit(2.5); B.timer += 2; B.ice = null; B.bugs = []; B.pendIce = false; B.pendBugs = 0; return `boss traci 2 tury · −${n}`; },
  hamster: B => { let n = 0; for (let k = 0; k < 4; k++) n += ultHit(.9); B.combo += 3; return `4 ciosy · −${n}`; },
  fox: B => { B.ice = null; B.bugs = []; B.poison = 0; B.silence = 0; B.shield = false; const n = ultHit(4); return `pewny krytyk · −${n}`; },
  beast: B => { const n = ultHit(4.5); B.me = Math.max(1, B.me - 10); return `−10 ❤️ dla Ciebie · −${n}`; },
};
function ultHit(m) { const B = BOSS; return dealBoss(Math.min(B.max * .35, 10 * B.hs.atk * m * B.hs.ultPow * (B.power > 0 ? 2 : 1)), 'ult'); }
function useUlt() {
  const B = BOSS; if (!B || B.phase !== 'fight' || B.ult < B.hs.ultNeed || B.down) return;
  if (B.silence > 0) return toast('🔇 Cisza – supercios zablokowany');
  const line = heroLine(), L = lineDef(line), txt = (ULT_FX[line] || ULT_FX.cat)(B);
  B.ult = 0; B.fx = { k: 'boss', n: '', crit: true, ult: true, t: Date.now() }; B.ultFx = { name: L.ult[0], t: Date.now() }; B.log.unshift(`⚡ ${L.ult[0]}: ${txt}`); bossSay('ult'); bossSfx('win'); save();
  if (!bossAlive(B)) return bossEnd(true);
  render();
}
function usePotion(k) {
  const B = BOSS; if (!B || B.phase !== 'fight' || potionN(k) < 1 || B.down) return;
  if (B.silence > 0) return toast('🔇 Cisza – mikstury zablokowane');
  if (k === 'phoenix') return toast('🔥 Feniks działa sam – gdy padniesz');
  if (B.potUsed >= POT_MAX + (B.hs.alch ? 1 : 0)) return toast('Limit mikstur w tej walce');
  addItem('potion', k, -1); B.potUsed++; S.stats.potions = (S.stats.potions || 0) + 1;
  const m = B.hs.alch ? 1.5 : 1, c = bossCard(), v = c && cardView(c);
  if (k === 'heal') { healMe(40 * m); B.log.unshift(`🧪 +${Math.round(40 * m)} ❤️`); }
  if (k === 'power') { B.power = Math.round(3 * m); B.log.unshift('🧪 Siła! Kolejne ciosy ×2'); }
  if (k === 'guard') { B.guard++; B.log.unshift('🧪 Tarcza gotowa'); }
  if (k === 'bomb') { const n = dealBoss(Math.min(B.max * .3, 30 * B.hs.atk * m), 'bomba'); B.fx = { k: 'boss', n, crit: true, t: Date.now() }; B.log.unshift(`💣 Mocny cios! −${n}`); }
  if (k === 'hint' && B.cur && v) {
    if (B.cur.opts) { const wrong = B.cur.opts.filter(o => norm(o) !== norm(v.ans)); B.cur.hidden = shuffle(wrong).slice(0, 2); }
    else B.cur.hint = v.ans.split(/\s+/).map(w => w[0] + '·'.repeat(Math.max(0, Math.min(8, w.length - 1)))).join(' ');
    B.log.unshift('🔮 Podpowiedź');
  }
  if (k === 'time') { B.timeFree = 5; B.qAt = Date.now(); B.ice = null; B.bugs = []; B.log.unshift('⏱️ 5 pytań bez limitu czasu i przeszkadzajek'); }
  B.fxMe = { k: 'potion', t: Date.now() }; bossSay('potion'); save();
  if (!bossAlive(B)) return bossEnd(true);
  render();
}

// ---------- 🎁 skrzynia: losowanie z widocznymi szansami, duplikaty ulepszają przedmiot
const TIER_ODDS = [{ common: 60, rare: 30, epic: 9, legendary: 1, mythic: 0 }, { common: 45, rare: 35, epic: 15, legendary: 4.5, mythic: .5 }, { common: 30, rare: 38, epic: 22, legendary: 8, mythic: 2 },
  { common: 18, rare: 35, epic: 30, legendary: 13, mythic: 4 }, { common: 10, rare: 30, epic: 35, legendary: 18, mythic: 7 }];
const LOOT_CAT = [['gear', 30, '⚔️ Przedmiot'], ['potion', 34, '🧪 Mikstura / power-up'], ['gems', 22, '💎 Kryształy'], ['boost', 10, '⏱️ Booster'], ['egg', 4, '👑 Złote jajo']];
const DUP_GEMS = { common: 30, rare: 80, epic: 200, legendary: 500, mythic: 1500 };
const RAR_ORDER = ['mythic', 'legendary', 'epic', 'rare', 'common'];
function rollTier(odds) { let r = Math.random() * 100; for (const k of RAR_ORDER) { if (r < odds[k]) return k; r -= odds[k]; } return 'common'; }
function rollLoot(tier) {
  const t = Math.max(0, Math.min(4, tier)), cat = (() => { let r = Math.random() * 100; for (const [k, w] of LOOT_CAT) { if (r < w) return k; r -= w; } return 'potion'; })();
  if (cat === 'gear') { const r = rollTier(TIER_ODDS[t]), pool = Object.keys(GEAR).filter(id => GEAR[id].r === r); return { k: 'gear', id: pool[Math.random() * pool.length | 0], r }; }
  if (cat === 'potion') { const ks = Object.keys(POTIONS), k = ks[Math.random() * ks.length | 0]; return { k: 'potion', id: k, n: 1 + (t >= 3 ? 1 : 0), r: k === 'phoenix' ? 'epic' : 'rare' }; }
  if (cat === 'gems') return { k: 'gems', n: Math.round((12 + 8 * t) * (.7 + Math.random() * .6)) * gemMul(), r: t >= 3 ? 'epic' : 'rare' };
  if (cat === 'boost') { const ks = Object.keys(BOOSTS); return { k: 'boost', id: ks[Math.random() * ks.length | 0], r: 'epic' }; }
  return { k: 'egg', r: 'legendary' };
}
function grantLoot(it, key) {
  if (it.k === 'gear') {
    if (ownsGear(it.id)) { it.dup = true; const h = hero(), f = h.forge[it.id] || 0;
      if (f < FORGE_MAX) { h.forge[it.id] = f + 1; h.mod = Date.now(); it.up = f + 1; } else { it.n = DUP_GEMS[it.r]; S.wallet.push({ id: key, n: it.n, why: 'loot-dup', t: Date.now() }); } }
    else addItem('gear', it.id, 1, key);
  }
  if (it.k === 'potion') addItem('potion', it.id, it.n, key);
  if (it.k === 'gems') S.wallet.push({ id: key, n: it.n, why: 'loot', t: Date.now() });
  if (it.k === 'egg') addItem('egg', 'boss', 1, key);
  if (it.k === 'boost') addItem('boost', it.id, 1, key);
}
const lootIcon = it => it.k === 'gear' ? gearImg(it.id) : it.k === 'potion' ? potionSVG(it.id) : it.k === 'boost' ? `<img class="gear-img" src="assets/fluent/${BOOSTS[it.id].img}.webp" alt="">` : it.k === 'egg' ? '<span class="loot-big">👑</span>' : '<span class="loot-big">💎</span>';
const lootHTML = it => `${lootIcon(it)}${it.k === 'gear' ? `<b>${esc(GEAR[it.id].name)}</b><small>${it.dup ? (it.up ? `DUPLIKAT → ulepszenie +${it.up}` : `DUPLIKAT → +${it.n} 💎`) : RARITY[it.r].name}</small>`
  : it.k === 'potion' ? `<b>${POTIONS[it.id].name}${it.n > 1 ? ' ×' + it.n : ''}</b><small>${POTIONS[it.id].desc}</small>` : it.k === 'boost' ? `<b>${BOOSTS[it.id].name}</b><small>30 min</small>`
  : it.k === 'egg' ? '<b>Złote jajo</b><small>do inkubatora</small>' : `<b>+${it.n}</b><small>kryształy</small>`}`;
const oddsHTML = tier => { const o = TIER_ODDS[Math.max(0, Math.min(4, tier))];
  return `<details class="odds"><summary>📊 Szanse w tej skrzyni</summary><div class="odds-grid">${LOOT_CAT.map(([, w, n]) => `<span>${n}</span><b>${w}%</b>`).join('')}</div>
    <div class="small muted" style="margin:6px 0 4px">Rzadkość przedmiotu:</div><div class="odds-grid">${['common', 'rare', 'epic', 'legendary', 'mythic'].map(r => `<span style="color:${RARITY[r].color}">${RARITY[r].name}</span><b>${o[r]}%</b>`).join('')}</div>
    <p class="small muted" style="margin:6px 0 0">Możesz trafić duplikat – wtedy przedmiot dostaje +1 ulepszenia (do +${FORGE_MAX}), potem zamienia się w 💎.</p></details>`; };
const chestSVG = () => `<svg viewBox="0 0 120 100"><defs><linearGradient id="chw" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#b45309"/><stop offset="1" stop-color="#78350f"/></linearGradient></defs>
  <g class="chest-lid"><path d="M14 40C14 18 34 10 60 10S106 18 106 40Z" fill="url(#chw)" stroke="#451a03" stroke-width="3"/><path d="M14 40H106" stroke="#fbbf24" stroke-width="5"/><path d="M54 12V40M66 12V40" stroke="#fbbf24" stroke-width="4"/></g>
  <rect x="14" y="40" width="92" height="50" rx="6" fill="url(#chw)" stroke="#451a03" stroke-width="3"/><path d="M54 40V90M66 40V90" stroke="#fbbf24" stroke-width="4"/><rect x="52" y="48" width="16" height="16" rx="3" fill="#fde047" stroke="#92400e" stroke-width="2.5"/></svg>`;

function bossEnd(won, why) {
  const B = BOSS, b = B.b, hs = B.hs; if (B.phase !== 'fight') return;
  if (b.kind === 'tower' && typeof towerEnd === 'function') { B.phase = won ? 'won' : 'lost'; B.me = Math.max(0, B.me); bossSay(won ? 'down' : 'win'); bossSfx(won ? 'win' : 'lose'); towerEnd(B, won); save(); return render(); }
  B.phase = won ? 'won' : 'lost'; B.me = Math.max(0, B.me); B.why = why; bossSay(won ? 'down' : 'win');
  const flawless = won && B.lostHp === 0, total = B.ok + B.bad, acc = total ? B.ok / total : 0, modeR = MODE_REWARD[B.mode] || 1, rep = b.repeat;
  const kindXP = { ch: 0, fin: 60, cat: 40, world: 50, hydra: 50 }[b.kind] || 0;
  B.xp = Math.round((B.ok * 2 + B.verOk * 2 + (won ? 40 + 20 * b.diff + kindXP : 5)) * modeR * xpMul() * (rep ? .5 : 1)); giveXP(B.xp, 'za walkę');
  if (won) {
    const base = { ch: 10 + 5 * b.diff, fin: 30 + 15 * b.diff, cat: 25 + 10 * b.diff, world: 30 + 10 * b.stars, hydra: 30 + 10 * b.diff }[b.kind] || 10;
    B.gems = Math.round(base * gemMul() * hs.gems * modeR * (rep ? .25 : 1)); S.wallet.push({ id: 'boss-' + uid(), n: B.gems, why: 'boss', t: Date.now() });
    let n = 1 + (b.diff >= 2 ? 1 : 0) + (b.kind !== 'ch' ? 1 : 0) + hs.loot + (flawless ? 1 : 0) + (boostOn('loot2') ? 1 : 0) - (B.caught >= 2 ? 1 : 0);
    if (rep) n = acc >= .8 ? 1 : 0;
    B.chest = { n: Math.max(0, n), tier: b.diff + (b.kind !== 'ch' ? 1 : 0) + Math.floor((hero().pr || 0) / 2), open: false };
    B.loot = Array.from({ length: B.chest.n }, () => rollLoot(B.chest.tier));
    B.loot.forEach((it, i) => grantLoot(it, `boss-l${i}-${uid()}`));
    if (B.loot.some(x => x.k === 'gear' && ['legendary', 'mythic'].includes(x.r) && !x.dup)) S.stats.lootLegend = 1;
    if (!rep) {
      if (b.kind === 'ch') { const d = deckById(b.id), r = deckRec(d); r.ch[b.i] = Math.min(STARS_MAX, (r.ch[b.i] || 0) + 1); r.wins = (r.wins || 0) + 1; touch(d); }
      if (b.kind === 'fin') { const d = deckById(b.id), r = deckRec(d); r.fin = Math.min(STARS_MAX, (r.fin || 0) + 1); touch(d); }
      if (b.kind === 'cat') S.stats['cb_' + b.id] = (S.stats['cb_' + b.id] || 0) + 1;
      if (b.kind === 'world') S.stats.worldStage = b.stars + 1;
    }
    S.stats.bossWins = (S.stats.bossWins || 0) + 1; S.stats.bossStageMax = Math.max(S.stats.bossStageMax || 0, b.diff + 1); if (flawless) S.stats.bossFlawless = (S.stats.bossFlawless || 0) + 1;
    B.flawless = flawless; bossSfx('win');
  } else {
    if (why === 'dead' && !B.coop) { loseLife(); B.lifeLost = true;
      // 📚 lekcja z porażki: rewanż dopiero po powtórzeniu fiszek, na których boss Cię pokonał
      const ids = [...new Set(B.missed)].slice(0, 15); if (ids.length >= 2) { S.stats.lesson = { k: bossKey(b), ids, name: b.name }; B.lesson = ids.length; } }
    bossSfx('lose');
  }
  save();
  if (typeof checkAchievements === 'function') checkAchievements();
  if (B.coop && typeof coopEnd === 'function') coopEnd(won);
  render();
}
function bossSfx(k) {
  try {
    if (S.settings.sound === false) return;
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const seq = { hit: [[520, .06], [780, .08]], hurt: [[180, .14], [120, .16]], win: [[523, .12], [659, .12], [784, .12], [1046, .3]], lose: [[392, .2], [330, .2], [262, .4]], chest: [[330, .08], [440, .08], [660, .2]], tick: [[880, .03]] }[k] || [];
    let t = audioCtx.currentTime;
    for (const [f, dd] of seq) { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = k === 'hurt' ? 'sawtooth' : 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + dd); o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + dd); t += dd * .9; }
  } catch { /* */ }
}
// ⏳ limit namysłu: pasek się kurczy, po czasie boss atakuje (bez pełnego przerysowania co tik)
const thinkMs = B => B.b.think * 1000 * B.hs.time * (B.cur?.cm === 'type' ? 1.6 : B.cur?.cm === 'abcd' ? .8 : 1);
let THINK_HIDDEN = 0;
document.addEventListener('visibilitychange', () => { if (document.hidden) THINK_HIDDEN = Date.now(); else if (BOSS && THINK_HIDDEN) { BOSS.qAt += Date.now() - THINK_HIDDEN; THINK_HIDDEN = 0; } });
setInterval(() => {
  const B = BOSS; if (!B || B.phase !== 'fight' || !B.b.think || B.shown || B.timeFree > 0 || B.down || document.hidden || parseRoute().parts[1] !== 'fight') return;
  const T = thinkMs(B), f = (Date.now() - B.qAt) / T, el = document.querySelector('.think-bar i');
  if (el) { el.style.width = Math.max(0, 100 - f * 100).toFixed(1) + '%'; el.parentElement.classList.toggle('late', f > .7); }
  if (f >= 1) { B.qAt = Date.now(); hurtMe(Math.round(B.b.atk * .5), 'Za długo myślisz'); bossSay('slow'); B.fx = null; save(); if (B.me <= 0 && !B.coop) return bossEnd(false, 'dead'); render(); }
}, 250);

// ---------- 🗺️ widok: wybór materiału (talie → rozdziały → finał, kategorie, świat)
const HP_BAR = (v, max, cls) => `<div class="hpbar ${cls}"><i style="width:${Math.max(0, v / max * 100).toFixed(1)}%"></i><span>${Math.max(0, Math.round(v))} / ${max}</span></div>`;
function nodeHTML(b, sel) {
  const on = sel && BOSS_SEL && BOSS_SEL.kind === b.kind && BOSS_SEL.id === b.id && (BOSS_SEL.i ?? null) === (b.i ?? null);
  return `<button class="bnode${b.ok ? '' : ' locked'}${b.stars ? ' beaten' : ''}${b.final ? ' final' : ''}${on ? ' on' : ''}" data-act="boss-sel" data-kind="${b.kind}" data-id="${b.id}" data-i="${b.i ?? ''}">
    <span class="bn-art">${b.ok || b.stars ? bossArt(b) : '<span class="mq">🔒</span>'}</span><small>${b.kind === 'ch' ? (b.final ? '👑' : `Rozdz. ${b.i + 1}`) : b.final ? '👑 Finał' : ''}</small>
    ${b.ok ? starsHTML(b.stars) : `<small class="bn-prog">${b.learned}/${b.need}</small>`}</button>`;
}
function setupSheetHTML() {
  const s = BOSS_SEL; if (!s) return ''; const b = bossFor(s.kind, s.id, s.i); if (!b) return '';
  const p = bossParams(b), d = s.kind === 'ch' || s.kind === 'fin' ? deckById(s.id) : null;
  const learnIds = b.kind === 'ch' ? b.cards.filter(c => c.srs.state === 'new').map(c => c.id) : [];
  return `<div class="bsheet-ov" data-act="boss-sel-close"></div><div class="bsheet">
    <div class="row nowrap" style="gap:12px">${bossArt(b, 'sheet')}<div class="grow"><b style="font-size:18px">${esc(b.name)}</b><div class="small muted">${esc(b.title)}</div><div class="small">${esc(b.desc)}</div>
      <div class="row nowrap" style="gap:6px;margin-top:4px">${b.kind === 'world' ? `<span class="boss-lv">Etap ${b.stars + 1}</span>` : starsHTML(b.stars)}<span class="small muted">${b.repeat ? 'opanowany – powtórka za mniejszą nagrodę' : `trudność ${b.diff + 1}`}</span></div></div>
      <button class="iconbtn" data-act="boss-sel-close">✕</button></div>
    <div class="boss-tags">${`<span>🃏 ${p.len} fiszek</span><span>❤️ ~${p.hp}</span><span>⚔️ ${p.atk}</span>${p.think ? `<span>⏱️ ${p.think} s na pytanie</span>` : '<span>⏱️ bez limitu</span>'}`}${p.abil.map(a => `<span title="${BOSS_ABIL[a][2]}">${BOSS_ABIL[a][0]} ${BOSS_ABIL[a][1]}</span>`).join('')}</div>
    ${b.ok && lessonFor(b) ? `<div class="lock-box"><b>📚 Lekcja z porażki</b><small>${esc(b.name)} pokonał Cię na tych fiszkach. Powtórz je (${lessonFor(b).ids.length}) – rewanż odblokuje się od razu.</small></div>
      <button class="primary block" data-act="boss-lesson">📚 Powtórz i wróć do walki</button>`
    : b.ok ? `<div class="mode-pick">${Object.entries(MODES).map(([k, m]) => `<button class="${BOSS_PICK.mode === k ? 'on' : ''}" data-act="boss-mode" data-m="${k}"><span>${m.icon}</span><b>${m.name}</b><small>cios ${m.mul}</small></button>`).join('')}</div>
      <p class="small muted center" style="margin:4px 0 8px">${MODES[BOSS_PICK.mode].desc} · nagrody ×${String(MODE_REWARD[BOSS_PICK.mode]).replace('.', ',')}</p>
      <button class="primary block boss-go" data-act="boss-start" data-kind="${b.kind}" data-id="${b.id}" data-i="${b.i ?? ''}" ${lives().n ? '' : 'disabled'}>${lives().n ? '⚔️ Walcz sam' : '🖤 Brak serc'}</button>
      <button class="block" data-go="#/coop">👥 Walcz z kolegą (lobby – Hydra)</button>`
    : `<div class="lock-box"><b>🔒 ${b.lockMsg}</b><div class="pbar"><i style="width:${Math.min(100, b.learned / b.need * 100)}%"></i></div><small class="muted">${b.learned}/${b.need}</small></div>
      ${learnIds.length && d ? `<button class="primary block" data-go="#/study/${d.id}/flip?all=1&only=${learnIds.join(',')}">📖 Naucz się rozdziału (${learnIds.length} nowych)</button>` : ''}`}
  </div>`;
}
ROUTES.boss = parts => {
  if (parts[1] === 'fight' && BOSS) return fightView();
  const decks = S.decks.map(d => ({ d, chs: deckChapters(d) })).filter(x => x.chs.length).sort((x, y) => deckLearned(y.d) - deckLearned(x.d));
  const cats = typeof topicDecks === 'function' ? S.topics.filter(t => !t.parentId && topicDecks(t, true).length >= 2) : [];
  const w = bossFor('world');
  return { tab: 'arena', html: `
  <div class="row nowrap"><h1 class="grow" style="margin:0">⚔️ Przygoda</h1>${coinsHTML()}</div>
  ${heroBarHTML()}
  ${boostChips() || freeBoostReady() ? `<div class="boost-row">${boostChips()}${freeBoostReady() ? '<button class="sm primary" data-act="boost-free">🎁 Darmowy booster</button>' : ''}</div>` : ''}
  <div class="card row nowrap coop-cta" data-go="#/coop"><img class="gear-img" src="assets/fluent/w_snake.webp" alt=""><div class="grow"><b>👥 Walcz z kolegą – Hydra</b><div class="small muted">Lobby na 2–4 osoby: każdy uczy się swoich fiszek, razem bijecie głowy hydry i reanimujecie się nawzajem</div></div><span>›</span></div>
  <h2 class="bm-h">📚 Twoje talie <small class="muted">rozdziały po ${CH_SIZE} fiszek · finał = cała talia</small></h2>
  ${decks.map(({ d, chs }, k) => { const nodes = chs.map((_, i) => bossFor('ch', d.id, i)), fin = bossFor('fin', d.id), beaten = nodes.filter(b => b.stars).length;
    return `<details class="card bregion"${k < 2 ? ' open' : ''}><summary class="row nowrap"><b class="grow">${esc(d.name)}</b><span class="small muted">${beaten}/${chs.length} ${plural(chs.length, 'rozdział', 'rozdziały', 'rozdziałów')}${fin?.stars ? ' · 👑' : ''}</span></summary>
      <div class="bpath">${nodes.map(b => nodeHTML(b, true)).join('<i class="mline"></i>')}${fin ? '<i class="mline"></i>' + nodeHTML(fin, true) : ''}</div></details>`; }).join('') || '<p class="muted">Dodaj fiszki do talii – każdy rozdział (20 fiszek) ma swojego bossa.</p>'}
  ${cats.length ? `<h2 class="bm-h">📁 Kategorie <small class="muted">kilka talii naraz</small></h2><div class="card"><div class="bpath">${cats.map(t => nodeHTML(bossFor('cat', t.id), true)).join('')}</div></div>` : ''}
  <h2 class="bm-h">🌍 Boss świata <small class="muted">wszystkie talie</small></h2><div class="card"><div class="bpath">${nodeHTML(w, true)}</div></div>
  <p class="small muted center">Boss skaluje się do siły bohatera. Przegrana zabiera serce ❤️ – wraca co 2 h albo za ${LIFE_REV} powtórek nauki.</p>
  ${setupSheetHTML()}` };
};
function fightView() {
  const B = BOSS, b = B.b;
  if (B.phase !== 'fight') return endView();
  const c = bossCard(), cur = B.cur, v = c ? cardView(c) : { q: '', a: '', ans: '' }, now = Date.now(), fresh = x => x && now - x.t < 900 ? x : null;
  const fx = fresh(B.fx), fm = fresh(B.fxMe), act = fresh(B.bossAct), ultFx = B.ultFx && now - B.ultFx.t < 1400 ? B.ultFx : null, mv = B.move, hs = B.hs;
  const blocked = B.ice || B.bugs?.length, cm = cur?.cm, dis = blocked ? 'disabled' : '';
  const q = cm === 'flip' && B.shown ? v.a : v.q;
  let ctrl = B.down ? `<div class="down-box">💀 Leżysz! ${B.coop ? 'Kolega może Cię reanimować – albo' : ''} odpowiedz dobrze 5×, żeby wstać (${B.selfRev || 0}/5)</div>` : '';
  if (cm === 'abcd') ctrl += `<div class="abcd-grid">${cur.opts.map((o, k) => { const hid = cur.hidden.includes(o), pk = B.picked != null, right = norm(o) === norm(v.ans);
      return `<button class="abcd${pk ? right ? ' right' : B.picked === k ? ' wrong' : '' : ''}${hid ? ' hid' : ''}" data-act="boss-pick" data-k="${k}" ${pk || hid || blocked ? 'disabled' : ''}><i>${'ABCD'[k]}</i><span>${esc(o)}</span></button>`; }).join('')}</div>
      ${B.picked != null ? '<button class="primary block" data-act="boss-next">Dalej ›</button>' : ''}`;
  else if (cm === 'type' && !B.shown) ctrl += `<div class="row nowrap"><input id="boss-in" class="grow" placeholder="Wpisz odpowiedź…" autocomplete="off" autocapitalize="off" spellcheck="false" ${dis}><button class="primary" data-act="boss-check" ${dis}>⚔️</button></div>
      <button class="ghost block small" data-act="boss-show" style="margin-top:4px" ${dis}>Nie wiem – pokaż</button>`;
  else if (cm === 'type') ctrl += `<p class="center small ${B.verdict === 'wrong' ? 'bad' : 'good'}" style="margin:4px 0">${B.verdict === 'wrong' ? `✗ Poprawnie: <b>${esc(v.ans)}</b>` : B.verdict === 'close' ? '≈ Prawie – liczę jako „Ledwo”' : '✓ Dobrze! Mocny cios ×' + hs.typeM.toFixed(2).replace('.', ',')}</p><button class="primary block" data-act="boss-next">Dalej ›</button>`;
  else if (!B.shown) ctrl += `<button class="primary block boss-go" data-act="boss-show" ${dis}>Pokaż odpowiedź</button>`;
  else ctrl += '<div class="boss-grades"><button class="g1" data-act="boss-g" data-g="1"><span>✗</span><small>Nie pamiętam</small></button><button class="g2" data-act="boss-g" data-g="2"><span>≈</span><small>Ledwo</small></button><button class="g3" data-act="boss-g" data-g="3"><span>⚡</span><small>Łatwo</small></button></div>';
  const ultReady = B.ult >= hs.ultNeed && !B.down, L = lineDef();
  const pots = Object.keys(POTIONS).filter(k => potionN(k) > 0);
  return { tab: 'arena', focus: true, html: `
  <div class="studybar"><button class="iconbtn" data-act="boss-quit">✕</button><div class="title">${esc(b.name)} ${b.kind === 'world' ? `· etap ${b.stars + 1}` : starsHTML(b.diff + 1, b.kind === 'ch' ? STARS_MAX : 5)}</div><span class="small muted">${Math.min(B.i + 1, B.ids.length)}/${B.ids.length}</span></div>
  <div class="bf${fm?.k === 'hit' ? ' shake-screen' : ''}${ultFx ? ' ult-on' : ''}">
    <div class="bf-top">
      ${B.say?.txt ? `<div class="boss-say" key="${B.say.t}">${esc(B.say.txt)}</div>` : ''}
      <div class="bf-boss">${B.coop && typeof coopHeadsHTML === 'function' ? coopHeadsHTML(fx, act) : `<div class="boss-stage${fx ? ' hit' : ''}${fx?.crit ? ' crit' : ''}${act ? ' attack' : ''}">${bossArt(b)}${B.shield ? '<span class="boss-shield">🛡️</span>' : ''}${fx ? `<b class="dmg${fx.crit ? ' crit' : ''}">${fx.n !== '' ? '−' + fx.n : ''}${fx.crit ? '!' : ''}</b><i class="slash"></i>` : ''}</div>`}
        <div class="boss-intent${B.timer === 1 ? ' soon' : ''}">${mv.k === 'hit' ? '⚔️' : BOSS_ABIL[mv.k][0]} <b>${esc(mv.name)}</b>${mv.dmg ? ` −${mv.dmg}` : ''}<small>${B.timer === 1 ? 'w następnej turze!' : `za ${B.timer} tury`}</small></div></div>
      ${B.coop ? '' : HP_BAR(B.hp, B.max, 'boss')}
      ${b.think && !B.shown && B.timeFree <= 0 && !B.down ? `<div class="think-bar"><i style="width:${Math.max(0, 100 - (now - B.qAt) / thinkMs(B) * 100).toFixed(1)}%"></i></div>` : ''}
    </div>
    <div class="row nowrap boss-me${fm?.k === 'hit' ? ' hurt' : ''}">${heroSVG('xs')}${HP_BAR(B.me, B.meMax, 'me')}
      ${B.combo >= 2 ? `<span class="chip combo">🔥 ${B.combo}</span>` : ''}${B.power ? `<span class="chip">💪 ${B.power}</span>` : ''}${B.guard ? `<span class="chip">🛡️${B.guard > 1 ? B.guard : ''}</span>` : ''}${B.poison ? `<span class="chip bad">☠️ ${B.poison}</span>` : ''}${B.silence ? `<span class="chip bad">🔇 ${B.silence}</span>` : ''}${B.timeFree > 0 ? `<span class="chip">⏱️ ${B.timeFree}</span>` : ''}</div>
    ${fm?.k === 'hit' ? `<b class="dmg me">−${fm.n}</b><i class="claw"></i>` : fm?.k === 'dodge' ? '<b class="dmg me dodge">Unik!</b>' : fm?.k === 'block' ? '<b class="dmg me dodge">Blok!</b>' : ''}
    ${B.coop && typeof coopMatesHTML === 'function' ? coopMatesHTML() : ''}
    ${B.log.length ? `<div class="boss-log">${B.log.slice(0, 2).map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
    ${ultFx ? `<div class="ult-banner">⚡ ${esc(ultFx.name)}!</div>` : ''}
    <div class="card flash boss-q${fm?.k === 'hit' ? ' shake' : ''}${cur?.ver ? ' ver' : ''}">
      ${cur?.ver ? '<div class="ver-tag">🔍 Sprawdzian bossa – udowodnij, że to wiesz!</div>' : ''}
      <div class="bq-in">${q}${cur?.hint && !B.shown ? `<div class="hintbox">🔮 ${esc(cur.hint)}</div>` : ''}</div>
      ${B.ice ? `<button class="ice" data-act="boss-ice" style="--crack:${(1 - B.ice.n / B.ice.max).toFixed(2)}"><img src="assets/fluent/g_ice.webp" alt=""><b>❄️ Zamrożone! Stukaj, by rozbić (${B.ice.n})</b></button>` : ''}
      ${(B.bugs || []).map(g => `<button class="bug" data-act="boss-bug" data-k="${g.k}" style="left:${g.x}%;top:${g.y}%;--d:${g.d}s" aria-label="robak"><img src="assets/fluent/${g.img}.webp" alt=""></button>`).join('')}
    </div>
    ${B.bugs?.length ? `<p class="center small bad" style="margin:0">🐛 Zabij robaczki (${B.bugs.length}), żeby odpowiedzieć!</p>` : ''}
    <div class="bf-ctrl">${ctrl}</div>
    <div class="bf-bottom">
      <button class="ult-btn${ultReady ? ' ready' : ''}" data-act="boss-ult" ${ultReady && !B.silence ? '' : 'disabled'} title="${esc(L.ult[1])}"><span class="ult-fill" style="--f:${(B.ult / hs.ultNeed).toFixed(2)}"></span><b>⚡ ${esc(L.ult[0])}</b><small>${ultReady ? 'GOTOWY!' : `${B.ult}/${hs.ultNeed}`}</small></button>
      <div class="pot-bar">${pots.map(k => `<button data-act="boss-pot" data-k="${k}" ${B.silence || k === 'phoenix' ? 'disabled' : ''} title="${POTIONS[k].name}: ${POTIONS[k].desc}">${potionSVG(k)}<i>${potionN(k)}</i></button>`).join('')}</div>
    </div>
  </div>` };
}
function endView() {
  const B = BOSS, b = B.b, won = B.phase === 'won';
  const chest = won && B.chest?.n ? (B.chest.open ? `<div class="loot">${B.loot.map((it, i) => `<div class="loot-it roll" style="--d:${i * .35}s;--rc:${RARITY[it.r || 'rare'].color}"><div class="roll-strip" style="--d:${i * .35}s">${Array.from({ length: 14 }, () => `<span>${lootIcon(rollLoot(B.chest.tier))}</span>`).join('')}<span>${lootIcon(it)}</span></div><div class="roll-res" style="--d:${1.6 + i * .35}s">${lootHTML(it)}</div></div>`).join('')}</div>`
      : `<button class="chest-btn" data-act="boss-chest"><div class="chest closed">${chestSVG()}</div><b>🎁 Skrzynia ×${B.chest.n} – stuknij, by otworzyć!</b></button>`) + oddsHTML(B.chest.tier) : '';
  const msg = won ? `+${B.gems} 💎 · +${B.xp} XP${b.repeat ? ' · boss opanowany – mniejsza nagroda' : ''}${B.caught ? ` · 🕵️ przyłapany ${B.caught}×${B.caught >= 2 ? ' (mniejsza skrzynia)' : ''}` : ''}`
    : B.why === 'cards' ? `Skończyły się fiszki – boss przetrwał. Serce zostaje. +${B.xp} XP` : `${B.lifeLost ? '🖤 Tracisz serce. ' : ''}+${B.xp} XP. Ulepsz bohatera, kup mikstury i spróbuj znowu.`;
  return { tab: 'arena', focus: true, html: `
  <div class="card center boss-end ${won ? 'won' : 'lost'}">
    <div class="boss-stage ${won ? 'dead' : 'gloat'}">${bossArt(b)}${won ? '<div class="boss-boom"></div>' : ''}</div>
    ${B.say?.txt ? `<div class="boss-say end">${esc(B.say.txt)}</div>` : ''}
    <h2 style="margin:6px 0">${won ? `🏆 ${esc(b.name)} pokonany!` : `💀 ${esc(b.name)} wygrywa…`}</h2>
    <p class="small muted">${B.ok} dobrych · ${B.bad} błędów · seria ${B.best}${B.verOk ? ` · 🔍 ${B.verOk} sprawdzianów` : ''}${won && B.flawless ? ' · <b>bez straty ❤️</b>' : ''}</p>
    <p class="small">${msg}</p>
    ${chest}
    ${B.lesson ? `<div class="lock-box" style="margin:8px 0"><b>📚 Lekcja z porażki</b><small>Rewanż odblokuje się, gdy powtórzysz ${B.lesson} ${plural(B.lesson, 'fiszkę', 'fiszki', 'fiszek')}, na których boss Cię pokonał.</small></div><button class="primary block" data-act="boss-lesson">📚 Powtórz teraz</button>` : ''}
    ${B.missed.length && !B.lesson ? `<button class="block" data-act="boss-cram">🔁 Powtórz ${B.missed.length} ${plural(B.missed.length, 'fiszkę', 'fiszki', 'fiszek')}, których nie pamiętałeś</button>` : ''}
    <div class="row" style="margin-top:10px">${B.coop ? '<button class="primary grow" data-go="#/coop">👥 Lobby</button>' : `<button class="primary grow" data-act="boss-again">${won ? 'Dalej ⚔️' : 'Spróbuj ponownie'}</button>`}<button class="grow" data-act="boss-map">🗺️ Mapa</button><button class="grow" data-go="#/hero">${heroIcon()} Bohater</button></div>
    ${livesHTML()}
  </div>` };
}
// po wpisaniu: werdykt → ocena (ok 3, prawie 2, źle 1)
function bossCheck() {
  const B = BOSS, c = bossCard(); if (!B || !c) return;
  const given = ($('#boss-in')?.value || '').trim(); if (!given) return toast('Wpisz odpowiedź albo stuknij „Nie wiem”');
  B.verdict = checkAnswer(given, cardView(c).ans); B.shown = true; B.pendingG = B.verdict === 'wrong' ? 1 : B.verdict === 'close' ? 2 : 3; render();
}
function bossPick(k) {
  const B = BOSS, c = bossCard(); if (!B?.cur?.opts || B.picked != null || B.ice || B.bugs?.length) return;
  B.picked = k; B.shown = true; B.pendingG = norm(B.cur.opts[k]) === norm(cardView(c).ans) ? 3 : 1; render();
}
const bossNext = () => { const B = BOSS; if (!B) return; bossAnswer(B.pendingG, B.cur.cm === 'abcd' ? 'abcd' : 'type'); };
document.addEventListener('keydown', e => {
  const B = BOSS; if (parseRoute().parts[0] !== 'boss' || !B || B.phase !== 'fight' || !B.cur) return;
  if (e.target.id === 'boss-in' && e.key === 'Enter') { e.preventDefault(); return bossCheck(); }
  if (e.target.tagName === 'INPUT') return;
  const cm = B.cur.cm;
  if (cm === 'abcd' && B.picked == null && '1234'.includes(e.key)) return bossPick(+e.key - 1);
  if ((B.picked != null || (cm === 'type' && B.shown)) && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); return bossNext(); }
  if (cm === 'flip' && !B.shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); ACTIONS['boss-show'](); }
  else if (cm === 'flip' && B.shown && '123'.includes(e.key)) bossAnswer(+e.key, 'flip');
  else if (e.key === 'u') useUlt();
});
Object.assign(ACTIONS, {
  'boss-sel': el => { BOSS_SEL = { kind: el.dataset.kind, id: el.dataset.id, i: el.dataset.i === '' ? null : +el.dataset.i }; render(); },
  'boss-sel-close': () => { BOSS_SEL = null; render(); },
  'boss-start': el => bossStart(el.dataset.kind, el.dataset.id, el.dataset.i === '' ? null : +el.dataset.i),
  'boss-mode': el => { BOSS_PICK.mode = el.dataset.m; bossPickSave(); render(); },
  'boss-show': () => { const B = BOSS; if (!B?.cur || B.ice || B.bugs?.length) return; B.shown = true; B.revealAt = Date.now(); if (B.cur.cm === 'type') { B.verdict = 'wrong'; B.pendingG = 1; } render(); },
  'boss-g': el => bossAnswer(+el.dataset.g, 'flip'),
  'boss-check': () => bossCheck(),
  'boss-pick': el => bossPick(+el.dataset.k),
  'boss-next': () => bossNext(),
  'boss-ult': () => useUlt(),
  'boss-pot': el => usePotion(el.dataset.k),
  'boss-ice': () => { const B = BOSS; if (!B?.ice) return; B.ice.n--; bossSfx('tick'); if (B.ice.n <= 0) { B.ice = null; B.log.unshift('🧊 Lód rozbity!'); } render(); },
  'boss-bug': el => { const B = BOSS; if (!B) return; B.bugs = B.bugs.filter(g => g.k !== +el.dataset.k); bossSfx('tick'); render(); },
  'boss-chest': () => { const B = BOSS; if (!B?.chest || B.chest.open) return; B.chest.open = true; bossSfx('chest'); render(); setTimeout(() => { if (B.loot.some(x => ['legendary', 'mythic'].includes(x.r))) confetti(160); }, 1800 + B.loot.length * 350); },
  'boss-quit': () => { if (!confirm(BOSS?.coop ? 'Opuścić walkę? Kolega walczy dalej sam.' : 'Uciec z walki? Serce zostaje, odpowiedzi do tej pory są zapisane, ale bez nagród.')) return; if (BOSS?.coop && typeof coopLeave === 'function') coopLeave(); BOSS = null; go('#/boss'); },
  'boss-again': () => { const b = BOSS?.b; BOSS = null; if (!b) return go('#/boss'); const nb = bossFor(b.kind, b.id, b.i); BOSS_SEL = nb ? { kind: b.kind, id: b.id, i: b.i ?? null } : null; go('#/boss'); render(); },
  'boss-map': () => { BOSS = null; go('#/boss'); },
  'boss-lesson': () => { const L = S.stats.lesson; if (!L) return; BOSS = null; BOSS_SEL = null; SESSION = null; LESSON_RUN = true; go(`#/study/all/flip?cram=list&ids=${L.ids.join(',')}`); },
  'boss-cram': () => { const ids = BOSS.missed || []; BOSS = null; SESSION = null; go(`#/study/all/flip?cram=list&ids=${[...new Set(ids)].join(',')}`); },
});
// karta na Starcie: najbliższy boss do pokonania
function bossHomeHTML() {
  let best = null;
  for (const d of S.decks) { const chs = deckChapters(d); for (let i = 0; i < chs.length; i++) { const b = bossFor('ch', d.id, i); if (b.ok && !b.stars) { best = b; break; } } if (best) break; }
  if (!best) { const w = bossFor('world'); if (w.ok) best = w; }
  if (!best) return '';
  return `<div class="card row nowrap boss-home" data-act="boss-sel" data-kind="${best.kind}" data-id="${best.id}" data-i="${best.i ?? ''}" data-go2="#/boss"><span class="boss-home-ic">${bossArt(best)}</span><div class="grow"><b>🐉 ${esc(best.name)} czeka</b>
    <div class="small muted">${esc(best.title)} – pokonaj go powtórkami</div></div><span>›</span></div>`;
}
const bossHome0 = homeExtrasHTML;
homeExtrasHTML = function () { return (appMode() === 'full' && featureOn('boss') ? bossHomeHTML() : '') + bossHome0(); };
const bossSel0 = ACTIONS['boss-sel'];
ACTIONS['boss-sel'] = el => { bossSel0(el); if (el.dataset.go2) go(el.dataset.go2); };
const bossRoute0 = ROUTES.boss;
ROUTES.boss = (...a) => { const v = bossRoute0(...a); return !v || v.focus ? v : { ...v, tab: 'arena', html: (typeof hubNav === 'function' ? hubNav('arena', 'boss') : '') + v.html }; };

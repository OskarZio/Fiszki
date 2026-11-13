'use strict';
/* ⚠️ PLIK GENEROWANY – nie edytuj. Źródła: pliki z scripts.txt, budowanie: python3 tools/bundle.py */

/* ===== kumul.js ===== */
'use strict';
/* 🃏 Kumulacja – tryb gry na fiszkach (admin + testerzy z panelu admina). Bieg przez 8 rund z rosnącym progiem punktów (+ tryb bez końca).
   Przed rundą: widać cel i egzaminatora; zwykłą rundę można pominąć za bilet (nagrodę).
   Runda: ręka fiszek, wybierasz 1–3 i odpowiadasz (ABCD albo wpisywanie). Zagranie ma TYP (Pojedyncza, Dwójka, Trójka,
   Jedna talia, Przekrój, Ciężka trójka) z podstawą i mnożnikiem; podręczniki podnoszą poziom typu.
   Punkty = (podstawa typu + wartości dobrze zagranych fiszek) × mnożnik. Atuty liczą się po kolei od lewej
   (kolejność ma znaczenie), część rośnie w trakcie biegu, niektóre mają wykończenie (Brokat, Neon, Złocenie, Duch).
   Sklep: atuty, koperty (wybierz 1 z 3), podręczniki, pomoce i pieczątki. Pieczątki zostają na fiszkach do końca biegu.
   🏆 Puchary: Brąz → Srebro → Złoto → Platyna → Diament → Rubin → Mistrz. Każdy kolejny dokłada utrudnienie,
   wygrana 8 rund zdobywa puchar i odblokowuje następny. Zaległe fiszki liczą się jak powtórki. */
var kumAdmin = () => typeof testOn === 'function' ? testOn('kumul') : typeof IS_ADMIN !== 'undefined' && IS_ADMIN === true;
var KUM_TARGETS = [300, 500, 900, 1300, 2000, 3200, 4500, 7000];
var KUM_HAND = 5, KUM_MAX_PLAY = 3, KUM_ITEM_SLOTS = 2, KUM_LAST = KUM_TARGETS.length;
// 🏆 puchary (poziomy trudności) – utrudnienia sumują się
var KUM_CUPS = [null,
  { n: 'Brąz', img: 'bronze', d: 'Zwykłe zasady' },
  { n: 'Srebro', img: 'silver', d: '📈 Progi punktów +20%' },
  { n: 'Złoto', img: 'silver', cls: 'gold', d: '💤 Senne atuty: część atutów w sklepie drzemie w co drugim zagraniu' },
  { n: 'Platyna', img: 'platinum', d: '⚔️ Egzaminator w każdej parzystej rundzie' },
  { n: 'Diament', img: 'diamond', d: '💸 Inflacja: wszystko w sklepie +1 🪙, odsetki najwyżej 3' },
  { n: 'Rubin', img: 'diamond', cls: 'ruby', d: '⚠️ Zdradliwe fiszki: zła odpowiedź zabiera 10% punktów rundy' },
  { n: 'Mistrz', img: 'diamond', cls: 'master', d: '🎒 Tylko 4 miejsca na atuty, a finał ma próg ×1,5' },
];
var KUM_TOP = KUM_CUPS.length - 1;
var kumCupImg = (t, cls = '') => t ? `<img class="kcup t${t} ${KUM_CUPS[t].cls || ''} ${cls}" src="assets/cups/${KUM_CUPS[t].img}.webp" alt="${KUM_CUPS[t].n}" title="Puchar: ${KUM_CUPS[t].n}">` : '<i class="kcup0"></i>';
var kumTier = () => KUM?.tier || 1;
function kumTarget(r) {
  const t = kumTier(), base = r <= KUM_LAST ? KUM_TARGETS[r - 1] : KUM_TARGETS[KUM_LAST - 1] * Math.pow(1.6, r - KUM_LAST);
  return Math.round(base * (t >= 2 ? 1.2 : 1) * (t >= 7 && r === KUM_LAST ? 1.5 : 1) / 10) * 10;
}
var kumIsBoss = r => [3, 6, 8].includes(r) || (r > KUM_LAST && r % 2 === 0) || (kumTier() >= 4 && r % 2 === 0);
// typy zagrań: podstawa, mnożnik; każdy poziom +10 podstawy i +1 mnożnika
var KUM_TYPES = {
  single: { n: 'Pojedyncza', c: 10, m: 1 },
  pair:   { n: 'Dwójka', c: 20, m: 2 },
  triple: { n: 'Trójka', c: 30, m: 3 },
  same:   { n: 'Jedna talia', c: 45, m: 3 },
  mix:    { n: 'Przekrój', c: 45, m: 4 },
  hard:   { n: 'Ciężka trójka', c: 60, m: 4 },
};
// egzaminatorzy – utrudnienia rund 3, 6, 8 (i więcej przy wyższych pucharach)
var KUM_BOSSES = {
  type:    { ic: '✍️', n: 'Pisemny', d: 'Tylko wpisywanie – bez ABCD' },
  nonew:   { ic: '🚫', n: 'Weteran', d: 'Nowe fiszki nie dają podstawy' },
  two:     { ic: '✌️', n: 'Skąpy', d: 'Najwyżej 2 fiszki na zagranie' },
  hand4:   { ic: '🤏', n: 'Ciasna ręka', d: 'Ręka ma o 1 fiszkę mniej' },
  discpay: { ic: '💸', n: 'Celnik', d: 'Każda wymiana kosztuje 1 monetę' },
  mute:    { ic: '🔇', n: 'Cisza', d: 'Pierwszy atut od lewej nie działa' },
  noplus:  { ic: '🧊', n: 'Mróz', d: 'Atuty dodające do mnożnika działają w połowie' },
  rush:    { ic: '⏱️', n: 'Stoper', d: 'Odpowiedź po 15 s to błąd' },
};
// atuty: r – rzadkość (c zwykły, r rzadki, l legendarny), f – działanie na mnożnik / podstawę (liczone od lewej)
var KUM_J = {
  risk:    { ic: '🎲', r: 'c', n: 'Ryzykant', d: 'Nowe i trudne fiszki ×2 wartości', p: 5 },
  writer:  { ic: '✍️', r: 'c', n: 'Pisarz', d: 'Wpisane odpowiedzi: +0,5 do mnożnika wartości (×1,5 → ×2)', p: 5 },
  miser:   { ic: '🪙', r: 'c', n: 'Skąpiec', d: '+1 moneta za każdą niewykorzystaną wymianę', p: 4 },
  banker:  { ic: '🏦', r: 'c', n: 'Bankier', d: 'Odsetki 2× wyższy limit', p: 5 },
  swap:    { ic: '🔄', r: 'c', n: 'Wymiennik', d: '+2 wymiany na rundę', p: 4 },
  quick:   { ic: '⚡', r: 'c', n: 'Szybkie palce', d: 'Dobra odpowiedź w < 5 s (wpisana: < 8 s): +15 wartości', p: 5 },
  elder:   { ic: '🐘', r: 'c', n: 'Pamięć słonia', d: 'Utrwalone fiszki ×2 wartości', p: 5 },
  owl:     { ic: '🦉', r: 'c', n: 'Sowa', d: 'Zaległe fiszki (do powtórki) ×3 wartości', p: 5 },
  magnet:  { ic: '🧲', r: 'c', n: 'Magnes', d: '+1 fiszka w ręce', p: 5 },
  tip:     { ic: '💵', r: 'c', n: 'Napiwek', d: '+2 monety za bezbłędne zagranie 3 fiszek', p: 4 },
  plus:    { ic: '➕', r: 'c', n: 'Plusik', d: '+4 do mnożnika', p: 4, f: (x) => { x.m += kumAdd(4); return '+' + kumAdd(4); } },
  sniper:  { ic: '🏹', r: 'c', n: 'Snajper', d: 'Pojedyncza: ×3 mnożnik', p: 5, f: (x) => { if (x.type === 'single') { x.m *= 3; return '×3'; } } },
  last:    { ic: '🎬', r: 'c', n: 'Ostatni dzwonek', d: 'Ostatnie zagranie w rundzie: ×3 mnożnik', p: 5, f: (x, K) => { if (K.plays === 1) { x.m *= 3; return '×3'; } } },
  zen:     { ic: '🧘', r: 'c', n: 'Minimalista', d: '+3 mnożnika za każde wolne miejsce na atut', p: 4, f: (x) => { const n = kumFree(); if (n > 0) { x.m += kumAdd(3 * n); return '+' + kumAdd(3 * n); } } },
  roll:    { ic: '🔥', r: 'r', n: 'Rozpęd', d: '+1 mnożnik za każdą dobrą odpowiedź z rzędu (błąd zeruje)', p: 7, f: (x, K) => { if (K.streak) { x.m += kumAdd(K.streak); return '+' + kumAdd(K.streak); } } },
  second:  { ic: '🛟', r: 'r', n: 'Druga szansa', d: 'Pierwszy błąd w rundzie liczy się jak dobra odpowiedź (połowa wartości)', p: 6 },
  spec:    { ic: '🎯', r: 'r', n: 'Specjalista', d: 'Jedna talia: +6 mnożnik', p: 6, f: (x) => { if (x.type === 'same') { x.m += kumAdd(6); return '+' + kumAdd(6); } } },
  trav:    { ic: '🧭', r: 'r', n: 'Podróżnik', d: 'Przekrój: ×2 mnożnik', p: 6, f: (x) => { if (x.type === 'mix') { x.m *= 2; return '×2'; } } },
  extra:   { ic: '▶️', r: 'r', n: 'Dodatkowe zagranie', d: '+1 zagranie na rundę', p: 7 },
  hoard:   { ic: '💎', r: 'r', n: 'Kolekcjoner', d: '+8 podstawy za każdy posiadany atut', p: 6, f: (x, K) => { const v = 8 * K.jokers.length; x.c += v; return '+' + v + ' pkt'; } },
  perfect: { ic: '💯', r: 'r', n: 'Perfekcjonista', d: 'Zagranie bez żadnego błędu: ×2 mnożnik', p: 7, f: (x) => { if (x.flawless) { x.m *= 2; return '×2'; } } },
  grow:    { ic: '🌱', r: 'r', n: 'Ziarenko', d: 'Rośnie: +1 mnożnik na stałe po każdej wygranej rundzie', p: 6, grows: true, f: (x, K, j) => { if (j.v) { x.m += kumAdd(j.v); return '+' + kumAdd(j.v); } } },
  piggy:   { ic: '🐷', r: 'r', n: 'Skarbonka', d: 'Rośnie: +3 podstawy za każdą monetę wydaną w sklepie', p: 6, grows: true, f: (x, K, j) => { if (j.v) { x.c += 3 * j.v; return '+' + 3 * j.v + ' pkt'; } } },
  lib:     { ic: '📚', r: 'r', n: 'Bibliotekarz', d: 'Rośnie: +15 podstawy za każdy podręcznik użyty w tym biegu', p: 6, grows: true, f: (x, K, j) => { if (j.v) { x.c += 15 * j.v; return '+' + 15 * j.v + ' pkt'; } } },
  turtle:  { ic: '🐢', r: 'r', n: 'Żółw', d: 'Rośnie: +0,5 mnożnika za każde bezbłędne zagranie z rzędu (błąd zeruje)', p: 6, grows: true, f: (x, K, j) => { if (j.v) { const v = kumAdd(j.v / 2); x.m += v; return '+' + String(v).replace('.', ','); } } },
  gold:    { ic: '👑', r: 'l', n: 'Złota rączka', d: 'Każde zagranie ×1,5 mnożnika', p: 9, f: (x) => { x.m *= 1.5; return '×1,5'; } },
  echo:    { ic: '🔁', r: 'l', n: 'Echo', d: 'Pierwsza fiszka w zagraniu liczy się podwójnie', p: 8 },
  prof:    { ic: '🎓', r: 'l', n: 'Profesor', d: 'Mnożnik ×(1 + 0,25 za każdy poziom typów zagrań)', p: 9, f: (x, K) => { const L = Object.values(K.levels).reduce((a, b) => a + b, 0); if (L) { const k = 1 + .25 * L; x.m *= k; return '×' + String(k).replace('.', ','); } } },
  phoenix: { ic: '🪶', r: 'l', n: 'Feniks', d: 'Gdy skończą się zagrania przed celem: +1 zagranie, a Feniks spala się', p: 8 },
  abc:     { ic: '🔠', r: 'c', n: 'Testowiec', d: 'Dobra odpowiedź w ABCD: +10 wartości', p: 4 },
  duo:     { ic: '👯', r: 'c', n: 'Bliźniaki', d: 'Dwójka: +4 mnożnik', p: 4, f: (x) => { if (x.type === 'pair') { x.m += kumAdd(4); return '+' + kumAdd(4); } } },
  first:   { ic: '🌅', r: 'c', n: 'Pierwszy dzwonek', d: 'Pierwsze zagranie w rundzie: +60 podstawy', p: 4, f: (x, K) => { if (!K.roundPlays) { x.c += 60; return '+60 pkt'; } } },
  poor:    { ic: '🪹', r: 'c', n: 'Asceta', d: 'Gdy masz najwyżej 3 monety: ×2 mnożnik', p: 5, f: (x, K) => { if (K.money <= 3) { x.m *= 2; return '×2'; } } },
  lucky:   { ic: '🍀', r: 'c', n: 'Fart', d: '1 szansa na 3: ×2 mnożnik', p: 4, f: (x) => { if (Math.random() < 1 / 3) { x.m *= 2; return '×2'; } } },
  rich:    { ic: '🤑', r: 'r', n: 'Bogacz', d: '+1 mnożnik za każde 5 monet (najwyżej +8)', p: 6, f: (x, K) => { const v = Math.min(8, Math.floor(K.money / 5)); if (v) { x.m += kumAdd(v); return '+' + kumAdd(v); } } },
  stampf:  { ic: '📮', r: 'r', n: 'Filatelista', d: '+25 podstawy za każdą dobrze zagraną fiszkę z pieczątką', p: 6, f: (x) => { if (x.stamped) { x.c += 25 * x.stamped; return '+' + 25 * x.stamped + ' pkt'; } } },
  skipper: { ic: '🏃', r: 'r', n: 'Wagarowicz', d: '+2 mnożnik za każdą pominiętą rundę w tym biegu', p: 6, f: (x, K) => { if (K.skips) { x.m += kumAdd(2 * K.skips); return '+' + kumAdd(2 * K.skips); } } },
  prymus:  { ic: '🎖️', r: 'r', n: 'Prymus', d: 'W rundzie Egzaminatora: ×2 mnożnik', p: 7, f: (x, K) => { if (K.boss) { x.m *= 2; return '×2'; } } },
  rainbow: { ic: '🎨', r: 'l', n: 'Erudyta', d: 'Mnożnik ×1,5 za 2 różne talie w zagraniu, ×2 za 3', p: 8, f: (x) => { if (x.decks >= 2) { const k = 1 + .5 * (x.decks - 1); x.m *= k; return '×' + String(k).replace('.', ','); } } },
  marathon:{ ic: '🏅', r: 'l', n: 'Maratończyk', d: 'Rośnie: mnożnik ×(1 + 0,1 za każde zagranie od zakupu)', p: 9, grows: true, f: (x, K, j) => { if (j.v) { const k = Math.round((1 + .1 * j.v) * 10) / 10; x.m *= k; return '×' + String(k).replace('.', ','); } } },
};
var kumAdd = v => KUM?.boss === 'noplus' ? Math.round(v / 2 * 10) / 10 : v;   // 🧊 Mróz: dodawanie do mnożnika w połowie
var KUM_RAR = { c: { n: 'zwykły', w: 70 }, r: { n: 'rzadki', w: 25 }, l: { n: 'legendarny', w: 5 } };
// wykończenia atutów (rzadko w sklepie, częściej w kopertach)
var KUM_ED = {
  shine: { ic: '✨', n: 'Brokat', d: '+30 podstawy', p: 2 },
  neon:  { ic: '🌈', n: 'Neon', d: '+5 mnożnika', p: 3 },
  gilt:  { ic: '🥇', n: 'Złocenie', d: '×1,5 mnożnika', p: 4 },
  ghost: { ic: '👻', n: 'Duch', d: 'nie zajmuje miejsca', p: 3 },
};
// pomoce (jednorazowe), podręczniki i pieczątki
var KUM_I = {
  half:   { ic: '✂️', n: '50/50', d: 'Usuwa 2 złe odpowiedzi z bieżącej fiszki (ABCD)', p: 2 },
  letter: { ic: '🔤', n: 'Pierwsza litera', d: 'Pokazuje początek odpowiedzi', p: 2 },
  disc:   { ic: '🃏', n: 'Dodatkowa wymiana', d: '+1 wymiana w tej rundzie', p: 2 },
  shield: { ic: '🛡️', n: 'Tarcza', d: 'Następny błąd liczy się jak dobra odpowiedź', p: 3 },
  st_gold:  { ic: '🟨', n: 'Złota pieczątka', d: 'Na fiszkę z ręki: +3 monety, gdy dobrze zagrana', p: 3, stamp: 'gold' },
  st_glass: { ic: '🔷', n: 'Szklana pieczątka', d: 'Na fiszkę z ręki: ×2 mnożnik zagrania, ale może pęknąć (1/4)', p: 4, stamp: 'glass' },
  st_stone: { ic: '🪨', n: 'Kamienna pieczątka', d: 'Na fiszkę z ręki: +50 wartości', p: 3, stamp: 'stone' },
};
for (const [k, T] of Object.entries(KUM_TYPES)) KUM_I['bk_' + k] = { ic: '📘', n: `Podręcznik: ${T.n}`, d: `Typ „${T.n}” +1 poziom (+10 podstawy, +1 mnożnik) na cały bieg`, p: 3, book: k };
var KUM_STAMPS = { gold: { ic: '🟨', n: 'złota' }, glass: { ic: '🔷', n: 'szklana' }, stone: { ic: '🪨', n: 'kamienna' } };
// koperty: otwierasz i wybierasz 1 z 3
var KUM_PACKS = {
  jok:  { ic: '✉️', n: 'Koperta atutów', d: 'Wybierz 1 z 3 atutów (większa szansa na wykończenie)', p: 5 },
  book: { ic: '📚', n: 'Koperta wiedzy', d: 'Wybierz 1 z 3 podręczników – działa od razu', p: 4 },
  aid:  { ic: '🎁', n: 'Koperta pomocy', d: 'Wybierz 1 z 3 pomocy lub pieczątek', p: 3 },
};
// bilety za pominięcie zwykłej rundy
var KUM_TICKETS = {
  cash:   { ic: '💰', n: 'Sakiewka', d: '+10 monet od razu' },
  rare:   { ic: '🎟️', n: 'Bilet VIP', d: 'W następnym sklepie darmowy rzadki atut' },
  pack:   { ic: '✉️', n: 'Darmowa koperta', d: 'Od razu otwierasz Kopertę atutów' },
  book:   { ic: '📘', n: 'Ściąga', d: '+1 poziom losowego typu zagrania' },
  reroll: { ic: '🎲', n: 'Kupon', d: '3 darmowe nowe oferty w następnym sklepie' },
  depo:   { ic: '🏦', n: 'Lokata', d: 'Podwójne odsetki po następnej wygranej rundzie' },
  play:   { ic: '▶️', n: 'Dogrywka', d: '+1 zagranie w następnej rundzie' },
  sale:   { ic: '🏷️', n: 'Wyprzedaż', d: 'W następnym sklepie wszystko tańsze o 2 monety' },
  pocket: { ic: '👝', n: 'Kieszonka', d: '+1 miejsce na pomoce do końca biegu' },
  stamps: { ic: '📬', n: 'Paczka pieczątek', d: '2 losowe fiszki z talii dostają losowe pieczątki' },
  lacq:   { ic: '💅', n: 'Lakier', d: 'Losowy atut dostaje losowe wykończenie (bez atutu: +5 monet)' },
};
var KUM_KITS = {
  classic: { ic: '🎒', n: 'Klasyczny', d: '4 monety, bez niespodzianek' },
  lang:    { ic: '⌨️', n: 'Poliglota', d: 'Tylko wpisywanie – do języków. Wpisanie ×2 wartości i +1 wymiana' },
  nerd:    { ic: '🤓', n: 'Kujon', d: '+1 zagranie w każdej rundzie, ale 1 wymiana mniej' },
  gamble:  { ic: '🎰', n: 'Hazardzista', d: 'Start z 12 monetami, ale tylko 2 wymiany' },
  pen:     { ic: '🖋️', n: 'Pisarz', d: 'Start z atutem „Pisarz”' },
  shelf:   { ic: '📦', n: 'Półka', d: '+1 miejsce na atut, ale start z 0 monet' },
  scholar: { ic: '🧑‍🏫', n: 'Belfer', d: 'Wszystkie typy zagrań od poziomu 2, ale tylko 3 miejsca na atuty' },
};
var KUM = null;
var kumAwake = j => !j.sleepy || (KUM.playNo % 2 === 0);   // 💤 senny atut działa w co drugim zagraniu (1., 3., 5.…)
var kumJ = id => KUM?.jokers.find(j => j.id === id && !(KUM.boss === 'mute' && KUM.jokers[0] === j) && kumAwake(j));
var kumHas = id => !!kumJ(id);
var kumIcon = s => `<span class="kum-ic">${s}</span>`;
var kumFree = () => KUM.slots - KUM.jokers.filter(j => j.e !== 'ghost').length;
var kumSell = j => Math.floor(KUM_J[j.id].p / 2) + (KUM_J[j.id].grows ? Math.floor((j.v || 0) / 2) : 0) + (j.e ? 1 : 0);
var kumJVal = j => j.id === 'grow' ? '+' + j.v : j.id === 'turtle' ? '+' + String(j.v / 2).replace('.', ',') : j.id === 'marathon' ? '×' + String(Math.round((1 + .1 * j.v) * 10) / 10).replace('.', ',') : j.v;
var kumStats = () => (S.stats.kum = S.stats.kum || { runs: 0, best: 0, bestPts: 0, wins: 0 });
var kumCupMax = () => kumStats().cup || 0;
var kumISlots = () => KUM_ITEM_SLOTS + (KUM?.xslot || 0);
var kumTyping = () => KUM.kit === 'lang' || KUM.boss === 'type';
function kumAddJoker(k, e, sleepy) {
  KUM.jokers.push({ id: k, ...(e ? { e } : {}), ...(sleepy ? { sleepy: true } : {}) });
  const st = kumStats(); (st.seen = st.seen || {})[k] = 1;
}
function kumLevelUp(t) { KUM.levels[t] = (KUM.levels[t] || 0) + 1; KUM.jokers.forEach(j => { if (j.id === 'lib') j.v = (j.v || 0) + 1; }); }

// ---------- pula fiszek
function kumPool(deckId) {
  const ok = c => !c.sus && (deckId === 'all' || c.deckId === deckId) && (() => { const a = cardView(c).ans; return a && a.trim() && a.length <= 200; })();
  const cs = S.cards.filter(ok), now = Date.now(), isDue = c => c.srs.state !== 'new' && c.srs.due <= now;
  return [...shuffle(cs.filter(isDue)), ...shuffle(cs.filter(c => !isDue(c)))].map(c => c.id);
}
var kumCard = id => cardById(id);
// 🎚️ fiszki, których jeszcze nikt się nie uczył, nie są warte tyle samo: trudność szacujemy z odpowiedzi
// (długość, liczba słów, liczby i daty, wyliczenia) i dzielimy pulę biegu na 4 równe progi – 12 / 16 / 20 / 25 pkt.
var KUM_NEW = [{ base: 12, t: 'nowa · łatwa' }, { base: 16, t: 'nowa · średnia' }, { base: 20, t: 'nowa · trudna' }, { base: 25, t: 'nowa · b. trudna' }];
function kumRawDiff(c) {
  const v = cardView(c), a = stripHtml(v.ans || '').trim(), q = stripHtml(v.label || '');
  return a.length + 6 * (a.split(/\s+/).length - 1) + (/\d/.test(a) ? 8 : 0) + (/[\n,;]/.test(v.ans || '') ? 6 : 0) + Math.min(10, q.length / 15);
}
function kumTiers(ids) {
  const rows = ids.map(id => { const c = kumCard(id); return [id, c ? kumRawDiff(c) : 0, hashStr(id)]; }).sort((a, b) => a[1] - b[1] || a[2] - b[2]), out = {};
  rows.forEach((r, i) => { out[r[0]] = Math.min(3, Math.floor(i / rows.length * 4)); });
  return out;
}
function kumKind(c) {
  if (!c) return { k: 'mid', base: 10, t: '' };
  if (c.srs.state === 'new') { const tr = KUM?.tierOf?.[c.id] ?? 1; return { k: 'new', base: KUM_NEW[tr].base, t: KUM_NEW[tr].t, heavy: tr >= 2, tr }; }
  if (isLearning(c) || (c.srs.lapses || 0) >= 2) return { k: 'hard', base: 25, t: 'trudna', heavy: true };
  if ((c.srs.ivl || 0) >= 7) return { k: 'mature', base: 10, t: 'utrwalona' };
  return { k: 'mid', base: 15, t: '' };
}
var kumHandSize = () => KUM_HAND - (KUM.boss === 'hand4' ? 1 : 0) + (kumHas('magnet') ? 1 : 0);
var kumMaxPlay = () => KUM.boss === 'two' ? 2 : KUM_MAX_PLAY;
function kumDraw() {
  const K = KUM; while (K.hand.length < kumHandSize()) { if (!K.deck.length) K.deck = shuffle(K.all.filter(id => !K.hand.includes(id))); const id = K.deck.shift(); if (id == null) break; if (!K.hand.includes(id)) K.hand.push(id); }
}
// typ zagrania z listy fiszek (dla podglądu: wszystkie wybrane; do punktów: tylko dobrze odpowiedziane)
function kumTypeOf(ids) {
  const n = ids.length; if (!n) return null;
  const cs = ids.map(kumCard), decks = new Set(cs.map(c => c?.deckId)), kinds = cs.map(kumKind);
  if (n === 3 && kinds.every(k => k.heavy)) return 'hard';
  if (n === 3 && decks.size === 3) return 'mix';
  if (n >= 2 && decks.size === 1) return 'same';
  return n === 3 ? 'triple' : n === 2 ? 'pair' : 'single';
}
var kumTypeVal = t => { const T = KUM_TYPES[t], L = KUM.levels[t] || 0; return { c: T.c + 10 * L, m: T.m + L, L }; };
// ---------- przed rundą: cel, egzaminator, bilet za pominięcie
function kumPrepRound() {
  const K = KUM;
  K.boss = kumIsBoss(K.round) ? shuffle(Object.keys(KUM_BOSSES).filter(b => !(K.kit === 'lang' && b === 'type')))[0] : null;
  K.ticket = K.boss ? null : shuffle(Object.keys(KUM_TICKETS))[0];
  K.phase = 'pre';
}
function kumStartRound() {
  const K = KUM;
  K.score = 0; K.plays = 3 + (K.kit === 'nerd' ? 1 : 0) + (kumHas('extra') ? 1 : 0) - (K.round === KUM_LAST ? 1 : 0) + (K.bonusPlay ? 1 : 0);
  K.bonusPlay = false; K.roundPlays = 0;
  K.disc = (K.kit === 'gamble' ? 2 : K.kit === 'nerd' ? 2 : K.kit === 'lang' ? 4 : 3) + (kumHas('swap') ? 2 : 0);
  K.usedSecond = false; K.sel = []; K.phase = 'pick'; K.hand = []; kumDraw();
}
function kumStart(deckId, kit, tier) {
  const all = kumPool(deckId);
  if (all.length < 12) return toast('Za mało fiszek – potrzeba min. 12 (z krótką odpowiedzią)', 4000);
  tier = Math.max(1, Math.min(tier || 1, kumCupMax() + 1, KUM_TOP));
  const slots = (tier >= 7 ? 4 : 5) + (kit === 'shelf' ? 1 : 0) - (kit === 'scholar' ? (tier >= 7 ? 1 : 2) : 0);
  KUM = { deckId, kit, tier, all, deck: all.slice(), hand: [], round: 1, money: kit === 'gamble' ? 12 : kit === 'shelf' ? 0 : 4, jokers: [], slots, items: [], levels: {}, stamps: {},
    streak: 0, total: 0, best: 0, spent: 0, shield: false, phase: 'pre', endless: false, slotBought: false, playNo: 0, skips: 0, freeRerolls: 0, freeRare: false, dblInt: false };
  KUM.tierOf = kumTiers(all);
  if (kit === 'pen') kumAddJoker('writer');
  if (kit === 'scholar') for (const t of Object.keys(KUM_TYPES)) KUM.levels[t] = 1;
  kumStats().runs++; save();
  kumPrepRound(); render();
}
function kumSkip() {
  const K = KUM, T = K.ticket; if (!T || K.phase !== 'pre') return;
  K.skips++; K.round++; kumPrepRound();
  if (T === 'cash') K.money += 10;
  else if (T === 'rare') K.freeRare = true;
  else if (T === 'reroll') K.freeRerolls += 3;
  else if (T === 'depo') K.dblInt = true;
  else if (T === 'play') K.bonusPlay = true;
  else if (T === 'sale') K.sale = true;
  else if (T === 'pocket') K.xslot = (K.xslot || 0) + 1;
  else if (T === 'stamps') shuffle(K.all.filter(id => !K.stamps[id])).slice(0, 2).forEach(id => { K.stamps[id] = shuffle(Object.keys(KUM_STAMPS))[0]; });
  else if (T === 'lacq') { const j = shuffle(K.jokers.filter(j => !j.e))[0]; if (j) { j.e = shuffle(Object.keys(KUM_ED).filter(e => e !== 'ghost'))[0]; toast(`💅 ${KUM_J[j.id].n} dostaje wykończenie: ${KUM_ED[j.e].n}`, 3000); return render(); } K.money += 5; }
  else if (T === 'book') { const t = shuffle(Object.keys(KUM_TYPES))[0]; kumLevelUp(t); toast(`📘 ${KUM_TYPES[t].n} – poziom ${K.levels[t] + 1}`, 2500); return render(); }
  else if (T === 'pack') return kumOpenPack('jok', 'pre');
  toast(`${KUM_TICKETS[T].ic} ${KUM_TICKETS[T].n}: ${KUM_TICKETS[T].d}`, 3000); render();
}
// ---------- odpowiadanie
function kumOpts(c) {
  const e = distractorEntry(c), pool = S.cards.filter(x => x.id !== c.id).slice(0, 2000).map(distractorEntry).filter(x => x.a && norm(x.a) !== norm(e.a));
  const wrong = pickDistractors(e, pool, 3); if (wrong.length < 3) return null;
  return shuffle([e.a, ...wrong]);
}
function kumPlay() {
  const K = KUM; if (!K.sel.length) return toast('Wybierz fiszki');
  K.q = K.sel.map(id => ({ id, res: null })); K.qi = 0; K.phase = 'answer'; kumAsk(); render();
}
function kumAsk() {
  const K = KUM, q = K.q[K.qi], c = kumCard(q.id);
  q.opts = kumTyping() ? null : kumOpts(c); q.mode = q.opts ? 'abcd' : 'type'; q.at = Date.now(); q.hidden = []; q.letter = false;
  q.due = !!c && c.srs.state !== 'new' && c.srs.due <= Date.now();
}
function kumAnswer(ok, how, typedVerdict) {
  const K = KUM, q = K.q[K.qi], c = kumCard(q.id); if (!q || q.res) return;
  const now = Date.now(), ms = Math.min(60000, now - q.at), late = K.boss === 'rush' && ms > 15000;
  if (late) ok = false;
  let good = ok, saved = false, lost = 0;
  if (!good && K.shield) { K.shield = false; good = true; saved = true; }
  else if (!good && kumHas('second') && !K.usedSecond) { K.usedSecond = true; good = true; saved = 'half'; }
  if (!good && K.tier >= 6) { lost = Math.floor(K.score * .1); K.score -= lost; K.total -= lost; }   // ⚠️ Rubin: zdradliwe fiszki
  if (c && c.srs.due <= now && c.srs.state !== 'new') {   // zaległa fiszka = powtórka (jak w walce z bossem)
    const g = ok ? (how === 'type' && typedVerdict === 'close' ? 2 : 3) : 1;
    S.log.push({ id: uid(), c: c.id, d: c.deckId, t: now, g, n: 0, ms, m: how === 'type' ? 'type' : 'flip', kum: 1, ...(how === 'type' ? { v: typedVerdict } : {}) });
    c.srs = schedule(c.srs, g); touch(c); emit('review', c, g, false);
  } else (S.tlog = S.tlog || []).push({ id: uid(), t: now, d: c?.deckId, ms });
  q.res = { good, ok, saved, how, fast: ms < (how === 'type' ? 8000 : 5000), lost, late, close: typedVerdict === 'close' };
  if (good && !saved) K.streak++; else if (!good) K.streak = 0;
  save();
  setTimeout(() => { if (KUM !== K || K.phase !== 'answer') return; if (K.qi < K.q.length - 1) { K.qi++; kumAsk(); render(); } else kumScore(); }, lost || late || (how === 'type' && !ok) ? 1500 : 700);
  render();
}
// ---------- liczenie: typ zagrania → wartości fiszek → pieczątki → atuty od lewej (z wykończeniami)
function kumScore() {
  const K = KUM, steps = [], goodQ = K.q.filter(q => q.res.good);
  const type = kumTypeOf(goodQ.map(q => q.id)), money0 = K.money;
  const flawless = K.q.every(q => q.res.good && !q.res.saved);
  const x = { type, c: 0, m: 0, flawless, stamped: goodQ.filter(q => K.stamps[q.id]).length, decks: new Set(goodQ.map(q => kumCard(q.id)?.deckId)).size };
  if (type) { const tv = kumTypeVal(type); x.c = tv.c; x.m = tv.m; steps.push({ ic: '📘', t: `${KUM_TYPES[type].n}${tv.L ? ` (poz. ${tv.L + 1})` : ''}`, v: `${tv.c} × ${tv.m}` }); }
  let glass = false;
  K.q.forEach((q, i) => {
    const c = kumCard(q.id), kd = kumKind(c), st = K.stamps[q.id];
    if (!q.res.good) { steps.push({ ic: '✗', t: stripHtml(cardView(c).label || '').slice(0, 36), v: q.res.lost ? `−${q.res.lost} pkt rundy` : '0', bad: 1 }); return; }
    let b = K.boss === 'nonew' && kd.k === 'new' ? 0 : kd.base;
    if (kumHas('risk') && (kd.k === 'new' || kd.k === 'hard')) b *= 2;
    if (kumHas('elder') && kd.k === 'mature') b *= 2;
    if (kumHas('owl') && q.due) b *= 3;
    if (q.res.how === 'type') b *= (K.kit === 'lang' ? 2 : 1.5) + (kumHas('writer') ? .5 : 0);
    if (kumHas('quick') && q.res.fast) b += 15;
    if (kumHas('abc') && q.res.how === 'abcd') b += 10;
    if (st === 'stone') b += 50;
    if (q.res.saved === 'half') b /= 2;
    if (kumHas('echo') && i === 0) b *= 2;
    b = Math.round(b); x.c += b;
    steps.push({ ic: st ? KUM_STAMPS[st].ic : '✓', t: stripHtml(cardView(c).label || '').slice(0, 36) + (q.res.close ? ' (literówka)' : ''), v: '+' + b });
    if (st === 'gold') { K.money += 3; steps.push({ ic: '🟨', t: 'Złota pieczątka', v: '+3 🪙' }); }
    if (st === 'glass') { glass = true; if (Math.random() < .25) { delete K.stamps[q.id]; steps.push({ ic: '💥', t: 'Szklana pieczątka pękła', v: '' }); } }
  });
  if (type) {
    if (glass) { x.m *= 2; steps.push({ ic: '🔷', t: 'Szklana pieczątka', v: '×2' }); }
    K.jokers.forEach((j, idx) => {
      const J = KUM_J[j.id];
      if (K.boss === 'mute' && idx === 0) return (J.f || j.e) && steps.push({ ic: '🔇', t: J.n + ' – wyciszony', v: '' });
      if (!kumAwake(j)) return (J.f || j.e) && steps.push({ ic: '💤', t: J.n + ' – drzemie', v: '' });
      if (J.f) { const r = J.f(x, K, j); if (r) steps.push({ ic: J.ic, t: J.n, v: r }); }
      if (j.e === 'shine') { x.c += 30; steps.push({ ic: '✨', t: J.n + ' · Brokat', v: '+30 pkt' }); }
      if (j.e === 'neon') { x.m += kumAdd(5); steps.push({ ic: '🌈', t: J.n + ' · Neon', v: '+' + kumAdd(5) }); }
      if (j.e === 'gilt') { x.m *= 1.5; steps.push({ ic: '🥇', t: J.n + ' · Złocenie', v: '×1,5' }); }
    });
  }
  if (kumHas('tip') && K.q.length === 3 && flawless) { K.money += 2; steps.push({ ic: '💵', t: 'Napiwek', v: '+2 🪙' }); }
  K.jokers.forEach(j => { if (j.id === 'turtle') j.v = flawless ? (j.v || 0) + 1 : 0; if (j.id === 'marathon') j.v = (j.v || 0) + 1; });
  K.roundPlays = (K.roundPlays || 0) + 1;
  const mult = Math.round(x.m * 10) / 10, pts = type ? Math.round(x.c * mult) : 0;
  K.score += pts; K.total += pts; K.best = Math.max(K.best, pts); K.plays--; K.playNo++;
  K.last = { chips: x.c, mult, pts, steps, good: goodQ.length, n: K.q.length, type, coins: K.money - money0 };
  K.hand = K.hand.filter(id => !K.sel.includes(id)); K.sel = []; kumDraw();
  K.phase = 'scored'; render();
}
function kumAfterPlay() {
  const K = KUM, target = kumTarget(K.round);
  if (K.score >= target) {
    const cap = (K.tier >= 5 ? 3 : 5) * (kumHas('banker') ? 2 : 1);
    const earn = 3 + K.plays + (kumHas('miser') ? K.disc : 0), interest = Math.min(cap, Math.floor(K.money / 5)) * (K.dblInt ? 2 : 1), bossBonus = K.boss ? 3 : 0;
    K.money += earn + interest + bossBonus; K.won = { earn, interest, bossBonus, dbl: K.dblInt }; K.dblInt = false;
    K.jokers.forEach(j => { if (j.id === 'grow') j.v = (j.v || 0) + 1; });
    if (K.round === KUM_LAST && !K.endless) { kumAward(); K.phase = 'victory'; return render(); }
    K.phase = 'shop'; K.shop = kumShopRoll(); K.rerolls = 0; return render();
  }
  if (K.plays <= 0) {
    const i = K.jokers.findIndex(j => j.id === 'phoenix');
    if (i >= 0) { K.jokers.splice(i, 1); K.plays = 1; K.phase = 'pick'; toast('🪶 Feniks spłonął – masz jeszcze 1 zagranie!', 3500); return render(); }
    return kumEnd(false);
  }
  K.phase = 'pick'; render();
}
// 🏆 puchar za wygranie 8 rund (raz, w chwili wygranej – tryb bez końca już go nie zabierze)
function kumAward() {
  const K = KUM, st = kumStats(); if (K.cupDone) return; K.cupDone = true;
  K.newCup = K.tier > (st.cup || 0); st.cup = Math.max(st.cup || 0, K.tier);
  st.kitCup = st.kitCup || {}; st.kitCup[K.kit] = Math.max(st.kitCup[K.kit] || 0, K.tier); save();
}
// ---------- sklep
function kumRollJoker(except, forceR) {
  const roll = Math.random() * 100, r = forceR || (roll < KUM_RAR.l.w ? 'l' : roll < KUM_RAR.l.w + KUM_RAR.r.w ? 'r' : 'c');
  let opts = Object.keys(KUM_J).filter(k => KUM_J[k].r === r && !except.has(k)); if (!opts.length) opts = Object.keys(KUM_J).filter(k => !except.has(k));
  return shuffle(opts)[0];
}
function kumJokerOffer(k, edChance) {
  const o = { t: 'j', k };
  if (Math.random() < edChance) o.e = shuffle(Object.keys(KUM_ED))[0];
  if (kumTier() >= 3 && Math.random() < 1 / 3) o.sleepy = true;
  return o;
}
function kumShopRoll() {
  const K = KUM, taken = new Set(K.jokers.map(j => j.id)), js = [];
  for (let i = 0; i < 2; i++) { const k = kumRollJoker(new Set([...taken, ...js])); if (k) js.push(k); }
  const offers = js.map(k => kumJokerOffer(k, .12));
  if (K.freeRare) { const k = kumRollJoker(new Set([...taken, ...js]), 'r'); if (k) offers.unshift({ ...kumJokerOffer(k, .12), free: true }); K.freeRare = false; }
  offers.push({ t: 'p', k: shuffle(Object.keys(KUM_PACKS))[0] });
  const books = shuffle(Object.keys(KUM_I).filter(k => k.startsWith('bk_'))).slice(0, 1);
  const rest = shuffle(Object.keys(KUM_I).filter(k => !k.startsWith('bk_') && !(K.kit === 'lang' && k === 'half'))).slice(0, 2);
  return [...offers, ...[...books, ...rest].map(k => ({ t: 'i', k }))];
}
var kumDef = o => o.t === 'j' ? KUM_J[o.k] : o.t === 'p' ? KUM_PACKS[o.k] : KUM_I[o.k];
var kumPrice = o => o.free ? 0 : Math.max(0, kumDef(o).p + (o.e ? KUM_ED[o.e].p : 0) - (o.sleepy ? 1 : 0) + (kumTier() >= 5 ? 1 : 0) - (KUM.sale ? 2 : 0));
var kumRerollCost = () => KUM.freeRerolls > 0 ? 0 : 2 + KUM.rerolls + (kumTier() >= 5 ? 1 : 0);
function kumSpend(n) { const K = KUM; K.money -= n; K.spent += n; K.jokers.forEach(j => { if (j.id === 'piggy') j.v = (j.v || 0) + n; }); }
function kumOpenPack(kind, ret) {
  const K = KUM, taken = new Set(K.jokers.map(j => j.id)); let opts = [];
  if (kind === 'jok') { const ks = []; for (let i = 0; i < 3; i++) { const k = kumRollJoker(new Set([...taken, ...ks])); if (k) ks.push(k); } opts = ks.map(k => kumJokerOffer(k, .3)); }
  else if (kind === 'book') opts = shuffle(Object.keys(KUM_I).filter(k => k.startsWith('bk_'))).slice(0, 3).map(k => ({ t: 'i', k }));
  else opts = shuffle(Object.keys(KUM_I).filter(k => !k.startsWith('bk_') && !(K.kit === 'lang' && k === 'half'))).slice(0, 3).map(k => ({ t: 'i', k }));
  K.pack = { kind, opts, ret }; K.phase = 'pack'; render();
}
function kumEnd(win) {
  const K = KUM, rounds = win ? K.round : K.round - 1, full = rounds >= KUM_LAST;
  if (full) kumAward();
  const mul = 1 + .2 * (K.tier - 1);
  const gold = Math.round(Math.min(600, rounds * 25 + (full ? 150 : 0)) * mul), xp = Math.round(Math.min(300, rounds * 15 + (full ? 60 : 0)) * mul);
  if (gold) S.wallet.push({ id: 'kum-' + uid(), n: gold, why: 'boss-kum', t: Date.now() });
  if (xp && typeof giveXP === 'function') giveXP(xp, 'kum');
  const st = kumStats();
  if (full) st.wins = (st.wins || 0) + 1;
  st.best = Math.max(st.best || 0, rounds); st.bestPts = Math.max(st.bestPts || 0, K.total); st.bestPlay = Math.max(st.bestPlay || 0, K.best);
  if (K.daily) { const D = st.daily = st.daily || {}, prev = D[K.daily]; D[K.daily] = { pts: Math.max(prev?.pts || 0, K.total), rounds: Math.max(prev?.rounds || 0, rounds) };
    for (const k of Object.keys(D)) if (k < dayKey(Date.now() - 30 * DAY)) delete D[k];
    if (rounds >= 3 && !S.wallet.some(w => w.id === 'kumd-' + K.daily)) S.wallet.push({ id: 'kumd-' + K.daily, n: 60, why: 'kumd', t: Date.now() }); }
  save(); kumUnlock(); K.phase = 'end'; K.result = { win: full, rounds, gold, xp, daily: K.daily }; render();
}
// 🗓️ Wyzwanie dnia: dla wszystkich ten sam plecak i to samo losowanie (atuty, bossowie, bilety, sklep) – ziarno z daty; fiszki Twoje.
// Jedna próba dziennie, nagroda 60 💎 za dojście do 3. rundy. Losowość podmieniamy tylko na czas akcji Kumulacji.
var kumDayKey = () => dayKey(Date.now());
var kumDailyKit = d => { const ks = Object.keys(KUM_KITS).filter(k => k !== 'lang'); return ks[hashStr('kd' + d) % ks.length]; };
function kumSeeded(fn) {
  const K = KUM; if (!K?.daily) return fn();
  const r0 = Math.random; let a = K.rs >>> 0;
  Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  try { return fn(); } finally { Math.random = r0; K.rs = a; if (KUM && KUM !== K && KUM.daily === K.daily) KUM.rs = a; }
}

// ---------- widoki
var KUM_KIT_SEL = 'classic', KUM_TIER_SEL = null;
function kumIntroHTML() {
  const st = kumStats(), decks = S.decks.filter(d => S.cards.some(c => c.deckId === d.id && !c.sus)), kit = KUM_KIT_SEL, max = Math.min(KUM_TOP, (st.cup || 0) + 1);
  const tier = Math.min(max, KUM_TIER_SEL || max), seen = st.seen || {}, nSeen = Object.keys(KUM_J).filter(k => seen[k]).length;
  const dd = kumDayKey(), dk = KUM_KITS[kumDailyKit(dd)], dres = st.daily?.[dd], played = st.dailyTry === dd;
  return `<div class="row nowrap"><button class="iconbtn" data-go="#/boss">‹</button><h1 class="grow" style="margin:0">🃏 Kumulacja</h1><span class="tag">${IS_ADMIN ? 'admin' : 'test'}</span></div>
  <div class="card kum-daily"><div class="row nowrap" style="gap:10px"><span style="font-size:30px">🗓️</span><div class="grow"><b>Wyzwanie dnia</b><div class="small muted">Plecak: ${kumIcon(dk.ic)} ${dk.n} · to samo losowanie dla wszystkich · 1 próba · 60 💎 za 3. rundę</div></div></div>
    ${played ? `<p class="small" style="margin:8px 0 0">Dzisiejszy wynik: <b>${(dres?.pts || 0).toLocaleString('pl')} pkt</b> · runda ${dres?.rounds || 0}. Nowe wyzwanie jutro.</p>` : `<button class="primary block" data-act="kum-daily" style="margin-top:8px">▶ Zagraj wyzwanie dnia</button>`}</div>
  <div class="card kum-intro"><p style="margin-top:0"><b>8 rund z rosnącym progiem.</b> Wybierz 1–3 fiszki z ręki, odpowiedz i zbieraj <b>(podstawa + wartości fiszek) × mnożnik</b>.</p>
    <details class="small kum-rules"${st.runs ? '' : ' open'}><summary><b>📖 Instrukcja gry</b></summary><ul>
      <li><b>Typ zagrania</b> daje podstawę i mnożnik: Pojedyncza, Dwójka, Trójka, Jedna talia (2–3 z tej samej), Przekrój (3 różne talie), Ciężka trójka (3 trudne). Liczą się tylko dobrze odpowiedziane fiszki.</li>
      <li>Fiszki mają wartość: trudna 25, zwykła 15, utrwalona 10. <b>Nowe, jeszcze nieuczone</b>: od 12 do 25 – gra szacuje trudność z odpowiedzi (długość, liczby, wyliczenia) i dzieli talię na cztery progi. Do „Ciężkiej trójki” liczą się trudne oraz nowe z dwóch górnych progów. Wpisanie zamiast ABCD: ×1,5.</li>
      <li><b>Atuty</b> liczą się po kolei od lewej – ustaw kolejność w sklepie (najpierw „+”, potem „×”). Niektóre rosną, niektóre mają wykończenie: ✨ Brokat +30 podstawy, 🌈 Neon +5 mnożnika, 🥇 Złocenie ×1,5, 👻 Duch nie zajmuje miejsca.</li>
      <li><b>Koperty</b> w sklepie: otwierasz i wybierasz 1 z 3. <b>Podręczniki</b> podnoszą poziom typu zagrania, <b>pieczątki</b> zostają na fiszce do końca biegu.</li>
      <li>Przed zwykłą rundą możesz ją <b>pominąć</b> i wziąć bilet (nagrodę) – ale tracisz zarobek z rundy i sklep.</li>
      <li>Rundy 3, 6 i 8 prowadzi <b>Egzaminator</b> z utrudnieniem (+3 monety za wygraną).</li>
      <li>Plecak <b>⌨️ Poliglota</b>: same wpisywanie – najlepszy do języków.</li>
      <li>Zaległe fiszki liczą się jak powtórki.</li></ul></details>
    <p class="small muted kum-rotnote">📱 Tu wybierasz ustawienia w pionie. Sam bieg toczy się <b>w poziomie</b> – po starcie obróć telefon.</p>
    <p class="small muted" style="margin:12px 0 6px">🏆 Puchar, o który grasz:</p>
    <div class="kum-cups">${KUM_CUPS.slice(1).map((C, i) => { const t = i + 1, lock = t > max;
      return `<button class="kum-cupb${t === tier ? ' on' : ''}${lock ? ' lock' : ''}${t <= (st.cup || 0) ? ' won' : ''}" data-act="kum-tier" data-t="${t}" ${lock ? 'disabled' : ''}>${kumCupImg(t)}<small>${C.n}</small></button>`; }).join('')}</div>
    <div class="kum-cupinfo small"><b>${KUM_CUPS[tier].n}</b>${tier <= (st.cup || 0) ? ' · ✓ zdobyty' : ''}<ul>${KUM_CUPS.slice(1, tier + 1).map(C => `<li>${C.d}</li>`).join('')}</ul>${tier > 1 ? `<span class="muted">Nagroda za bieg +${(tier - 1) * 20}%</span>` : ''}</div>
    <label class="small muted">Z jakich fiszek?</label>
    <select id="kum-deck"><option value="all">Wszystkie talie</option>${decks.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select>
    <p class="small muted" style="margin:12px 0 6px">Plecak na start:</p>
    <div class="kum-kits">${Object.entries(KUM_KITS).map(([k, K]) => `<button class="kum-kit${kit === k ? ' on' : ''}" data-act="kum-kit" data-k="${k}">${kumIcon(K.ic)}<b>${K.n} ${st.kitCup?.[k] ? kumCupImg(st.kitCup[k], 'xs') : ''}</b><small>${K.d}</small></button>`).join('')}</div>
    <div class="spacer"></div><button class="primary block" data-act="kum-start" style="min-height:52px">▶ Zacznij bieg · ${KUM_CUPS[tier].n}</button>
    ${st.runs ? `<p class="small muted center" style="margin:10px 0 0">Biegi: ${st.runs} · wygrane: ${st.wins || 0} · rekord: runda ${st.best || 0} · ${(st.bestPts || 0).toLocaleString('pl')} pkt · najlepsze zagranie ${(st.bestPlay || 0).toLocaleString('pl')}</p>` : ''}
    <details class="small kum-album"><summary><b>📖 Album atutów</b> · ${nSeen}/${Object.keys(KUM_J).length}</summary><div class="kum-albumg">${Object.entries(KUM_J).map(([k, J]) => seen[k]
      ? `<div class="kum-own r-${J.r}">${kumIcon(J.ic)}<div class="grow"><b>${esc(J.n)}</b><small>${esc(J.d)}</small></div></div>`
      : `<div class="kum-own unk">${kumIcon('❔')}<div class="grow"><b>???</b><small>Atut ${KUM_RAR[J.r].n} – zdobądź go, żeby poznać</small></div></div>`).join('')}</div></details></div>`;
}
// ---------- 🎲 stół gry (poziomo): lewy panel z wynikiem, u góry atuty i pomoce, na środku scena, na dole akcje
var KG_ACTIVE = ['pre', 'pick', 'answer', 'scored', 'shop', 'pack'];
var kgNum = n => Number(n).toLocaleString('pl');
var kgDeckHue = id => hashStr(String(id)) % 360;
var kgCanManage = () => ['pre', 'pick', 'shop'].includes(KUM.phase);
function kgPop() { const K = KUM, P = K.pop; if (!P || P.ph !== K.phase) return null; return (P.t === 'j' ? K.jokers[P.i] : K.items[P.i]) != null ? P : null; }
// lewy panel: runda, egzaminator, cel i wynik, podstawa × mnożnik (na żywo), liczniki
function kgSide() {
  const K = KUM, t = kumTarget(K.round), B = K.boss && KUM_BOSSES[K.boss], inRound = ['pick', 'answer', 'scored'].includes(K.phase);
  const selT = K.phase === 'pick' ? kumTypeOf(K.sel) : K.phase === 'answer' ? kumTypeOf(K.q.map(q => q.id)) : null, tv = selT && kumTypeVal(selT), L = K.phase === 'scored' ? K.last : null;
  const calc = L ? { n: L.type ? KUM_TYPES[L.type].n : 'Pudło', c: L.chips, m: String(L.mult).replace('.', ','), pts: L.pts }
    : tv ? { n: KUM_TYPES[selT].n + (tv.L ? ` · poz. ${tv.L + 1}` : ''), c: tv.c, m: tv.m } : { n: K.phase === 'pick' ? 'Wybierz fiszki' : '—', c: 0, m: 0 };
  const info = K.phase === 'shop' ? `<div class="kg-box kg-info win"><b>🏁 Runda ${K.round} wygrana</b><small>+${K.won.earn} 🪙 · odsetki +${K.won.interest}${K.won.dbl ? ' (×2)' : ''}${K.won.bossBonus ? ` · egzaminator +${K.won.bossBonus}` : ''}</small></div>`
    : B ? `<div class="kg-box kg-info boss"><b>${B.ic} ${B.n}</b><small>${B.d}</small></div>`
    : `<div class="kg-box kg-info"><b>📝 Zwykła runda</b><small>bez utrudnień</small></div>`;
  return `<aside class="kg-side">
    <div class="kg-round">${kumCupImg(K.tier, 'sm')}<div><b>Runda ${K.round}${K.round <= KUM_LAST ? '/' + KUM_LAST : ''}</b><small>${K.round > KUM_LAST ? 'bez końca · ' : ''}${KUM_CUPS[K.tier].n} · ${KUM_KITS[K.kit].n}</small></div></div>
    ${info}
    <div class="kg-two"><div class="kg-box"><small>Cel</small><b class="kg-goal">${kgNum(t)}</b></div>
      <div class="kg-box"><small>${inRound ? 'Wynik' : 'Łącznie'}</small><b class="kg-pts">${kgNum(inRound ? K.score : K.total)}</b></div></div>
    <div class="kg-prog"><i style="width:${inRound ? Math.min(100, K.score / t * 100) : 0}%"></i></div>
    <div class="kg-box kg-calc${L ? ' done' : ''}"><small>${esc(calc.n)}</small><div><b class="kg-chips">${calc.c}</b><i>×</i><b class="kg-mult">${calc.m}</b>${L ? `<i>=</i><b class="kg-res">${kgNum(calc.pts)}</b>` : ''}</div></div>
    <div class="kg-ctr"><div class="kg-box"><small>Zagrania</small><b class="c-play">${inRound ? K.plays : '–'}</b></div><div class="kg-box"><small>Wymiany</small><b class="c-disc">${inRound ? K.disc : '–'}</b></div><div class="kg-box"><small>Monety</small><b class="c-money">${K.money}</b></div></div>
    <div class="kg-sbtns"><button class="kg-b" data-act="kum-levels">📘 Typy</button><button class="kg-b" data-act="kum-quit">✕ Koniec</button></div>
  </aside>`;
}
// górny pasek: atuty (kolejność od lewej) i pomoce; stuknięcie pokazuje opis i akcje
function kgTop() {
  const K = KUM, inRound = ['pick', 'answer', 'scored'].includes(K.phase), P = kgPop(), used = K.jokers.filter(j => j.e !== 'ghost').length;
  return `<div class="kg-top"><div class="kg-jrow"><span class="kg-cap">Atuty ${used}/${K.slots}</span>
    ${K.jokers.map((j, i) => { const J = KUM_J[j.id], off = inRound && ((K.boss === 'mute' && i === 0) || !kumAwake(j));
      return `<button class="kg-j r-${J.r}${j.e ? ' ed-' + j.e : ''}${off ? ' off' : ''}${P?.t === 'j' && P.i === i ? ' on' : ''}" data-act="kum-info" data-i="${i}" aria-label="${esc(J.n)}">${kumIcon(J.ic)}<small>${esc(J.n)}</small>${J.grows && j.v ? `<i class="kg-jv">${kumJVal(j)}</i>` : ''}${j.sleepy ? `<i class="kg-zz">${off ? '💤' : 'z'}</i>` : ''}${j.e ? `<i class="kg-ed">${KUM_ED[j.e].ic}</i>` : ''}</button>`; }).join('')}
    ${Array(Math.max(0, kumFree())).fill('<span class="kg-j empty"></span>').join('')}</div>
    <div class="kg-irow"><span class="kg-cap">Pomoce ${K.items.length}/${kumISlots()}</span>
    ${K.items.map((k, i) => `<button class="kg-j it${P?.t === 'i' && P.i === i ? ' on' : ''}" data-act="kum-iteminfo" data-i="${i}" aria-label="${esc(KUM_I[k].n)}">${kumIcon(KUM_I[k].ic)}<small>${esc(KUM_I[k].n.replace('Podręcznik: ', '').replace(' pieczątka', ''))}</small></button>`).join('')}
    ${Array(Math.max(0, kumISlots() - K.items.length)).fill('<span class="kg-j it empty"></span>').join('')}</div></div>`;
}
// panel wybranego atutu / pomocy: opis + przesuń, sprzedaj, użyj
function kgPopHTML() {
  const K = KUM, P = kgPop(); if (!P) return '';
  if (P.t === 'j') { const j = K.jokers[P.i], J = KUM_J[j.id], can = kgCanManage();
    return `<div class="kg-pop r-${J.r}">${kumIcon(J.ic)}<div class="kg-pop-t"><b>${esc(J.n)} <em>${KUM_RAR[J.r].n}</em>${J.grows && j.v ? ` · ${kumJVal(j)}` : ''}</b><small>${esc(J.d)}${j.e ? ` · ${KUM_ED[j.e].ic} ${KUM_ED[j.e].n}: ${KUM_ED[j.e].d}` : ''}${j.sleepy ? ' · 💤 działa w co drugim zagraniu' : ''}</small></div>
      ${can ? `<button class="kg-b" data-act="kum-move" data-i="${P.i}" data-d="-1" ${P.i ? '' : 'disabled'} aria-label="W lewo">◀</button><button class="kg-b" data-act="kum-move" data-i="${P.i}" data-d="1" ${P.i < K.jokers.length - 1 ? '' : 'disabled'} aria-label="W prawo">▶</button><button class="kg-b kg-sell" data-act="kum-sell" data-i="${P.i}">Sprzedaj +${kumSell(j)} 🪙</button>` : ''}
      <button class="kg-b kg-x" data-act="kum-popx" aria-label="Zamknij">✕</button></div>`; }
  const k = K.items[P.i], D = KUM_I[k];
  return `<div class="kg-pop">${kumIcon(D.ic)}<div class="kg-pop-t"><b>${esc(D.n)}</b><small>${esc(D.d)}</small></div>
    ${K.phase !== 'scored' ? `<button class="kg-b kg-use" data-act="kum-use" data-i="${P.i}">Użyj</button>` : ''}${kgCanManage() ? `<button class="kg-b kg-sell" data-act="kum-sellitem" data-i="${P.i}">Sprzedaj +1 🪙</button>` : ''}
    <button class="kg-b kg-x" data-act="kum-popx" aria-label="Zamknij">✕</button></div>`;
}
var kgLevelsHTML = () => `<div class="kg-lv" data-act="kum-levels"><div class="kg-lv-in"><b>📘 Typy zagrań</b>${Object.entries(KUM_TYPES).map(([k, T]) => { const v = kumTypeVal(k); return `<div><span>${T.n}${v.L ? ` <em>poz. ${v.L + 1}</em>` : ''}</span><span><b class="kg-chips">${v.c}</b> × <b class="kg-mult">${v.m}</b></span></div>`; }).join('')}
  <small>Dwójka: 2 fiszki z różnych talii · Jedna talia: 2–3 z tej samej · Przekrój: 3 różne talie · Ciężka trójka: 3 trudne (też nowe z górnych progów). Liczą się tylko dobre odpowiedzi.</small><button class="kg-b">Zamknij</button></div></div>`;
// fiszka w ręce: kartka z zeszytu z kolorem talii i wartością w rogu
function kumCardHTML(id, sel) {
  const c = kumCard(id), v = c && cardView(c), kd = kumKind(c), d = c && deckById(c.deckId), st = KUM.stamps[id];
  return `<button class="kg-card${sel ? ' on' : ''} k-${kd.k}${kd.tr != null ? ' t' + kd.tr : ''}${st ? ' st-' + st : ''}" data-act="kum-sel" data-id="${id}" style="--dh:${kgDeckHue(c?.deckId)}"><span class="kg-val">${KUM.boss === 'nonew' && kd.k === 'new' ? 0 : kd.base}</span>${st ? `<span class="kg-stamp" title="Pieczątka ${KUM_STAMPS[st].n}">${KUM_STAMPS[st].ic}</span>` : ''}
    <span class="kg-qw"><span class="kg-q">${esc(stripHtml(v?.label || '').slice(0, 90))}</span></span><span class="kg-deck"><i></i>${esc((d?.name || '').replace(/^🏫\s*/, '').slice(0, 20))}${kd.t ? ` · ${kd.t}` : ''}</span></button>`;
}
function kumPreHTML() {
  const K = KUM, t = kumTarget(K.round), B = K.boss && KUM_BOSSES[K.boss], T = K.ticket && KUM_TICKETS[K.ticket];
  return { stage: `<div class="kg-pre"><button class="kg-tile go${B ? ' boss' : ''}" data-act="kum-go"><small>Runda ${K.round}${K.round === KUM_LAST ? ' · finał' : ''}</small><b>${B ? `${B.ic} Egzaminator: ${B.n}` : '📝 Zwykła runda'}</b>
      <span class="kg-tile-d">${B ? B.d + ' · +3 🪙 za wygraną' : 'Bez utrudnień'}</span><span class="kg-tile-goal">Cel <b>${kgNum(t)}</b> pkt</span><span class="kg-cta">▶ Graj</span></button>
    ${T ? `<button class="kg-tile skip" data-act="kum-skip"><small>Pomiń rundę</small><b>${T.ic} Bilet: ${T.n}</b><span class="kg-tile-d">${T.d}</span><span class="kg-tile-goal">Bez zarobku i bez sklepu</span><span class="kg-cta ghost">⏭ Pomiń</span></button>`
      : `<div class="kg-tile lock"><small>Pomiń rundę</small><b>🔒 Egzaminatora nie ominiesz</b><span class="kg-tile-d">Bilety są tylko przed zwykłą rundą.</span></div>`}</div>`, bar: '' };
}
function kumPickHTML() {
  const K = KUM, n = K.sel.length;
  return { stage: `${K.pendingStamp ? `<div class="kg-hint">${KUM_STAMPS[K.pendingStamp].ic} Stuknij fiszkę, na którą przybić pieczątkę (${KUM_STAMPS[K.pendingStamp].n})</div>` : `<div class="kg-hint">${n ? `Wybrane ${n}/${kumMaxPlay()}` : `Wybierz 1–${kumMaxPlay()} fiszki · liczba w rogu to wartość`}</div>`}
    <div class="kg-hand n${K.hand.length}">${K.hand.map(id => kumCardHTML(id, K.sel.includes(id))).join('')}</div>`,
    bar: `<button class="kg-b kg-play" data-act="kum-play" ${n ? '' : 'disabled'}>▶ Zagraj${n ? ` (${n})` : ''}</button><button class="kg-b kg-disc" data-act="kum-disc" ${n && K.disc > 0 ? '' : 'disabled'}>🔄 Wymień${K.boss === 'discpay' ? ' · 1 🪙' : ''}</button>` };
}
function kumAnswerHTML() {
  const K = KUM, q = K.q[K.qi], c = kumCard(q.id), v = cardView(c), ans = v.ans, typing = !(q.mode === 'abcd' && !q.typing);
  const opts = q.opts ? q.opts.map((o, i) => q.hidden.includes(i) ? '<span class="kg-opt gone"></span>' : `<button class="kg-opt${q.res ? (norm(o) === norm(ans) ? ' right' : q.pick === i ? ' wrong' : '') : ''}" data-act="kum-opt" data-i="${i}" ${q.res ? 'disabled' : ''}><b>${'ABCD'[i]}</b><span>${esc(o)}</span></button>`).join('') : '';
  const dots = K.q.map((x, i) => `<i class="${x.res ? (x.res.good ? 'ok' : 'bad') : i === K.qi ? 'cur' : ''}"></i>`).join('');
  const res = q.res ? `<div class="kg-res ${q.res.good ? 'ok' : 'bad'}">${q.res.saved === true ? '🛡️ Tarcza uratowała!' : q.res.saved === 'half' ? '🛟 Druga szansa – połowa wartości' : q.res.good ? (q.res.close ? `✓ Prawie – poprawnie: ${esc(ans)}` : '✓ Dobrze') : `${q.res.late ? '⏱️ Za późno! ' : '✗ '}Odpowiedź: ${esc(ans)}${q.res.lost ? ` · ⚠️ −${q.res.lost} pkt` : ''}`}</div>` : '';
  return { stage: `<div class="kg-ans${typing ? ' typing' : ''}"><div class="kg-qcard" style="--dh:${kgDeckHue(c?.deckId)}"><div class="kg-qmeta"><span class="kg-dots">${dots}</span>${K.streak ? `<span>🔥 ${K.streak}</span>` : ''}${K.shield ? '<span>🛡️</span>' : ''}${K.stamps[q.id] ? `<span>${KUM_STAMPS[K.stamps[q.id]].ic}</span>` : ''}${q.due ? '<span>🦉 zaległa</span>' : ''}${K.boss === 'rush' ? '<span>⏱️ 15 s</span>' : ''}</div>
      <div class="kg-qtext">${v.q}</div>${q.letter ? `<div class="kg-letter">Zaczyna się na: <b>${esc(ans.trim().slice(0, 1).toUpperCase())}…</b></div>` : ''}</div>
    <div class="kg-aside">${res}${typing ? (q.res ? '' : `<div class="kg-type"><input id="kum-in" placeholder="Wpisz odpowiedź…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"><button class="kg-b kg-play" data-act="kum-send">✓</button></div>`) : `<div class="kg-opts">${opts}</div>`}</div></div>`,
    bar: q.res ? '' : typing ? (q.opts ? '<button class="kg-b" data-act="kum-abcd">↩ Wróć do ABCD</button>' : `<span class="kg-note">Wpisanie: ×${K.kit === 'lang' ? 2 : '1,5'} wartości fiszki</span>`) : '<button class="kg-b" data-act="kum-type">✍️ Wpiszę odpowiedź · ×1,5 wartości</button>' };
}
function kumScoredHTML() {
  const K = KUM, L = K.last, t = kumTarget(K.round), won = K.score >= t;
  return { stage: `<div class="kg-scored"><ul class="kg-steps">${L.steps.map((s, i) => `<li class="${s.bad ? 'bad' : ''}" style="animation-delay:${i * 90}ms"><span>${s.ic}</span><span class="g">${esc(s.t)}</span><b>${esc(s.v)}</b></li>`).join('')}</ul>
    <div class="kg-total" style="animation-delay:${L.steps.length * 90}ms">${L.type ? `<b class="kg-chips">${L.chips}</b><i>×</i><b class="kg-mult">${String(L.mult).replace('.', ',')}</b>` : ''}<strong>${L.type ? '+' : ''}${kgNum(L.pts)}</strong><small>${L.good}/${L.n} dobrze${L.coins ? ` · +${L.coins} 🪙` : ''}${won ? ' · cel zdobyty!' : ` · brakuje ${kgNum(t - K.score)}`}</small></div></div>`,
    bar: `<button class="kg-b kg-play" data-act="kum-next">${won ? '🏁 Runda wygrana – dalej' : K.plays > 0 ? '▶ Następne zagranie' : K.jokers.some(j => j.id === 'phoenix') ? '🪶 Feniks…' : 'Koniec zagrań…'}</button>` };
}
function kumOfferHTML(o, i, act) {
  const K = KUM, D = kumDef(o), price = act === 'kum-buy' ? kumPrice(o) : 0;
  const full = o.t === 'j' ? kumFree() <= 0 && o.e !== 'ghost' : o.t === 'i' && !(D.book && act === 'kum-pack') ? K.items.length >= kumISlots() : false;
  const kind = o.t === 'j' ? KUM_RAR[D.r].n : o.t === 'p' ? 'koperta' : D.book ? 'podręcznik' : D.stamp ? 'pieczątka' : 'pomoc';
  return `<div class="kg-off ${o.t === 'j' ? 'j r-' + D.r + (o.e ? ' ed-' + o.e : '') : o.t === 'p' ? 'p' : D.book ? 'b' : D.stamp ? 's' : 'i'}"><span class="kg-kind">${kind}</span>${kumIcon(D.ic)}<b>${esc(D.book ? KUM_TYPES[D.book].n : D.n)}</b>
    <small>${o.e ? `<em>${KUM_ED[o.e].ic} ${KUM_ED[o.e].n}: ${KUM_ED[o.e].d}.</em> ` : ''}${o.sleepy ? '<em class="zz">💤 Senny (co drugie zagranie).</em> ' : ''}${esc(D.d)}</small>
    <button class="kg-b kg-buy" data-act="${act}" data-i="${i}" ${full || K.money < price ? 'disabled' : ''}>${full ? 'Brak miejsca' : act === 'kum-buy' ? (o.free ? '🎟️ Gratis' : `${price} 🪙`) : 'Biorę'}</button></div>`;
}
function kumShopHTML() {
  const K = KUM, rc = kumRerollCost(), slotP = 8 + (kumTier() >= 5 ? 1 : 0);
  return { stage: `<div class="kg-shop">${K.shop.map((o, i) => o.bought ? '<div class="kg-off sold">Kupione</div>' : kumOfferHTML(o, i, 'kum-buy')).join('')}
      ${!K.slotBought ? `<div class="kg-off i"><span class="kg-kind">ulepszenie</span>${kumIcon('🧳')}<b>Większy plecak</b><small>+1 miejsce na atut (raz na bieg)</small><button class="kg-b kg-buy" data-act="kum-slot" ${K.money >= slotP ? '' : 'disabled'}>${slotP} 🪙</button></div>` : ''}</div>`,
    bar: `<span class="kg-note">🛒 Sklep · stuknij swój atut u góry, żeby go przesunąć albo sprzedać</span><button class="kg-b" data-act="kum-reroll" ${K.money >= rc ? '' : 'disabled'}>🎲 Nowa oferta · ${rc ? rc + ' 🪙' : `gratis (${K.freeRerolls})`}</button><button class="kg-b kg-play" data-act="kum-nextround">▶ Runda ${K.round + 1}</button>` };
}
function kumPackHTML() {
  const K = KUM, P = K.pack, D = KUM_PACKS[P.kind];
  return { stage: `<div class="kg-hint">${D.ic} ${D.n} – wybierz jedno</div><div class="kg-shop pack">${P.opts.map((o, i) => kumOfferHTML(o, i, 'kum-pack')).join('')}</div>`,
    bar: '<button class="kg-b" data-act="kum-packskip">Pomiń kopertę</button>' };
}
function kgTableHTML() {
  const K = KUM, v = { pre: kumPreHTML, pick: kumPickHTML, answer: kumAnswerHTML, scored: kumScoredHTML, shop: kumShopHTML, pack: kumPackHTML }[K.phase]();
  return `<div class="kg ph-${K.phase}${K.boss && K.phase !== 'shop' ? ' is-boss' : ''}">${kgSide()}<section class="kg-main">${kgTop()}<div class="kg-stage">${v.stage}</div>${kgPopHTML() || (v.bar ? `<div class="kg-bar">${v.bar}</div>` : '')}</section>${K.showLv ? kgLevelsHTML() : ''}</div>`;
}
function kumVictoryHTML() {
  const K = KUM, C = KUM_CUPS[K.tier];
  return `<div class="card center kum-end"><div class="kum-bigcup">${kumCupImg(K.tier, 'big')}</div><h2>${K.newCup ? `Nowy puchar: ${C.n}!` : `8 rund zaliczone – ${C.n}`}</h2><p>Łącznie <b>${K.total.toLocaleString('pl')}</b> pkt · najlepsze zagranie ${K.best.toLocaleString('pl')}</p>
    ${K.newCup && K.tier < KUM_TOP ? `<p class="small">🔓 Odblokowany puchar <b>${KUM_CUPS[K.tier + 1].n}</b>: ${KUM_CUPS[K.tier + 1].d}</p>` : ''}
    <p class="small muted">Możesz odebrać nagrodę teraz albo grać dalej w trybie bez końca (progi ×1,6 co rundę, nagroda rośnie).</p>
    <div class="kum-actions"><button class="primary grow" data-act="kum-endless">♾️ Graj dalej</button><button class="grow" data-act="kum-claim">🏆 Odbierz nagrodę</button></div></div>`;
}
function kumEndHTML() {
  const K = KUM, R = K.result;
  return `<div class="card center kum-end">${R.win ? `<div class="kum-bigcup">${kumCupImg(K.tier, 'big')}</div>` : '<div style="font-size:52px">💥</div>'}<h2>${R.win ? `Bieg zakończony – ${R.rounds} ${plural(R.rounds, 'runda', 'rundy', 'rund')}` : `Koniec biegu w rundzie ${K.round}`}</h2>
    <p>Łącznie <b>${K.total.toLocaleString('pl')}</b> pkt · najlepsze zagranie ${K.best.toLocaleString('pl')}${K.skips ? ` · pominięte rundy: ${K.skips}` : ''}</p>
    <p class="small">Nagroda: <b>+${R.gold} 🪙 złota</b> · <b>+${R.xp} XP</b>${K.tier > 1 ? ` <span class="muted">(${KUM_CUPS[K.tier].n} +${(K.tier - 1) * 20}%)</span>` : ''}</p>
    <div class="kum-actions"><button class="primary grow" data-act="kum-again">▶ Jeszcze raz</button><button class="grow" data-act="kum-quit2">Wyjdź</button></div></div>`;
}
// 📱 tryb wymaga telefonu w poziomie: w pionie zasłania go plansza „Obróć telefon” (CSS: orientation: portrait)
var KUM_ROTATE = `<div class="kum-rotate" role="dialog" aria-label="Obróć telefon"><div class="kum-rot-ph"><span>🃏</span></div><b>Obróć telefon poziomo</b><small>Bieg toczy się na stole gry w poziomie. Obróć telefon, a gra pojawi się sama – nic nie przepadnie.</small><button class="ghost" data-act="kum-leave">‹ Wróć do Przygody</button></div>`;
function kumLock() { try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch { /* telefon nie pozwala – zostaje plansza */ } }
function kumUnlock() { try { screen.orientation?.unlock?.(); } catch { /* */ } }
ROUTES.kumul = () => {
  if (!kumAdmin()) return { tab: 'arena', html: '<p class="muted center" style="padding:40px 0">Ten tryb jest jeszcze w testach.</p>' };
  if (!KUM) return { tab: 'arena', html: kumIntroHTML() };
  const K = KUM;
  if (!KG_ACTIVE.includes(K.phase)) return { tab: 'arena', focus: true, html: `<div class="kum">${(K.phase === 'victory' ? kumVictoryHTML : kumEndHTML)()}</div>` };
  if (K.phase === 'answer') onMount(() => { const i = $('#kum-in'); if (i) { i.focus({ preventScroll: true }); i.onkeydown = e => { if (e.key === 'Enter') ACTIONS['kum-send'](); }; } });
  return { tab: 'arena', focus: true, html: KUM_ROTATE + kgTableHTML() };
};
// wejście w zakładce Przygoda – admin i testerzy
var kumBoss0 = ROUTES.boss;
ROUTES.boss = (...a) => { const v = kumBoss0(...a); if (typeof KUM_ROTATE !== 'undefined') kumUnlock(); if (!v?.html || !kumAdmin() || (a[0] && a[0][1])) return v; const st = S.stats.kum || {};
  return { ...v, html: v.html.replace('<div class="card row nowrap coop-cta"', `<div class="card row nowrap kum-cta" data-go="#/kumul"><span class="kum-cta-ic">🃏</span><div class="grow"><b>Kumulacja <span class="tag">${IS_ADMIN ? 'admin' : 'test'}</span></b><div class="small muted">8 rund · atuty, koperty, pieczątki · 7 pucharów${st.best ? ` · rekord: runda ${st.best}` : ''}</div></div>${st.cup ? kumCupImg(st.cup) : ''}<span>›</span></div><div class="card row nowrap coop-cta"`) }; };

Object.assign(ACTIONS, {
  'kum-kit': el => { KUM_KIT_SEL = el.dataset.k; render(); },
  'kum-tier': el => { KUM_TIER_SEL = +el.dataset.t; render(); },
  'kum-leave': () => { kumUnlock(); go('#/boss'); },
  'kum-daily': () => { const d = kumDayKey(), st = kumStats(); if (st.dailyTry === d) return toast('Wyzwanie dnia już rozegrane – kolejne jutro'); kumLock();
    KUM = { daily: d, rs: hashStr('kum' + d) }; const fake = KUM; kumSeeded(() => kumStart($('#kum-deck')?.value || 'all', kumDailyKit(d), 1));
    if (KUM && KUM !== fake && KUM.deckId) { KUM.daily = d; KUM.rs = fake.rs; st.dailyTry = d; save(); } else KUM = null; },
  'kum-start': () => { kumLock(); const max = Math.min(KUM_TOP, kumCupMax() + 1); kumStart($('#kum-deck')?.value || 'all', KUM_KIT_SEL, Math.min(max, KUM_TIER_SEL || max)); },
  'kum-go': () => { if (KUM?.phase === 'pre') { kumStartRound(); render(); } },
  'kum-skip': () => kumSkip(),
  'kum-sel': el => { const K = KUM, id = el.dataset.id; if (!K || K.phase !== 'pick') return;
    if (K.pendingStamp) { K.stamps[id] = K.pendingStamp; toast(`${KUM_STAMPS[K.pendingStamp].ic} Pieczątka ${KUM_STAMPS[K.pendingStamp].n} na fiszce`); K.pendingStamp = null; return render(); }
    const i = K.sel.indexOf(id); if (i >= 0) K.sel.splice(i, 1); else if (K.sel.length < kumMaxPlay()) K.sel.push(id); else return toast(`Maksymalnie ${kumMaxPlay()} fiszki na zagranie`); render(); },
  'kum-play': () => kumPlay(),
  'kum-disc': () => { const K = KUM; if (!K.sel.length || K.disc <= 0) return; if (K.boss === 'discpay') { if (K.money < 1) return toast('Wymiana kosztuje 1 monetę'); K.money--; }
    K.hand = K.hand.filter(id => !K.sel.includes(id)); K.sel = []; K.disc--; kumDraw(); render(); },
  'kum-opt': el => { const K = KUM, q = K?.q?.[K.qi]; if (!q || q.res) return; const i = +el.dataset.i; q.pick = i; kumAnswer(norm(q.opts[i]) === norm(cardView(kumCard(q.id)).ans), 'abcd'); },
  'kum-type': () => { const q = KUM?.q?.[KUM.qi]; if (q) { q.typing = true; q.mode = 'type'; render(); } },
  'kum-abcd': () => { const q = KUM?.q?.[KUM.qi]; if (q?.opts) { q.typing = false; q.mode = 'abcd'; render(); } },
  'kum-send': () => { const K = KUM, q = K?.q?.[K.qi]; if (!q || q.res) return; const t = $('#kum-in')?.value || ''; if (!t.trim()) return;
    const v = checkAnswer(t, cardView(kumCard(q.id)).ans); kumAnswer(v !== 'wrong', 'type', v); },
  'kum-next': () => kumAfterPlay(),
  'kum-buy': el => { const K = KUM, o = K.shop[+el.dataset.i]; if (!o || o.bought) return; const D = kumDef(o), price = kumPrice(o); if (K.money < price) return;
    if (o.t === 'j') { if (kumFree() <= 0 && o.e !== 'ghost') return; kumAddJoker(o.k, o.e, o.sleepy); }
    else if (o.t === 'i') { if (K.items.length >= kumISlots()) return; K.items.push(o.k); }
    kumSpend(price); o.bought = true;
    if (o.t === 'p') return kumOpenPack(o.k, 'shop');
    toast(`${D.ic} ${D.n}`, 1500); render(); },
  'kum-pack': el => { const K = KUM, P = K.pack, o = P?.opts[+el.dataset.i]; if (!o) return; const D = kumDef(o);
    if (o.t === 'j') { if (kumFree() <= 0 && o.e !== 'ghost') return toast('Brak miejsca na atut'); kumAddJoker(o.k, o.e, o.sleepy); }
    else if (D.book) { kumLevelUp(D.book); toast(`📘 ${KUM_TYPES[D.book].n} – poziom ${K.levels[D.book] + 1}`, 2000); }
    else { if (K.items.length >= kumISlots()) return toast('Brak miejsca na pomoc'); K.items.push(o.k); }
    K.phase = P.ret; K.pack = null; render(); },
  'kum-packskip': () => { const K = KUM; if (!K?.pack) return; K.phase = K.pack.ret; K.pack = null; render(); },
  'kum-slot': () => { const K = KUM, p = 8 + (kumTier() >= 5 ? 1 : 0); if (K.slotBought || K.money < p) return; kumSpend(p); K.slots++; K.slotBought = true; render(); },
  'kum-move': el => { const K = KUM, i = +el.dataset.i, j = i + +el.dataset.d; if (j < 0 || j >= K.jokers.length) return; [K.jokers[i], K.jokers[j]] = [K.jokers[j], K.jokers[i]]; if (K.pop?.t === 'j') K.pop.i = j; render(); },
  'kum-sell': el => { const K = KUM, i = +el.dataset.i, j = K.jokers[i]; if (!j) return; K.money += kumSell(j); K.jokers.splice(i, 1); K.pop = null; render(); },
  'kum-sellitem': el => { const K = KUM, i = +el.dataset.i; if (K.items[i] == null) return; K.items.splice(i, 1); K.money += 1; K.pop = null; render(); },
  'kum-reroll': () => { const K = KUM, rc = kumRerollCost(); if (K.money < rc) return; if (K.freeRerolls > 0) K.freeRerolls--; else { kumSpend(rc); K.rerolls++; } K.shop = kumShopRoll(); render(); },
  'kum-nextround': () => { KUM.sale = false; KUM.round++; kumPrepRound(); render(); },
  'kum-endless': () => { const K = KUM; K.endless = true; K.phase = 'shop'; K.shop = kumShopRoll(); K.rerolls = 0; render(); },
  'kum-claim': () => kumEnd(true),
  'kum-use': el => { const K = KUM, i = +el.dataset.i, k = K.items[i]; if (!k) return; const D = KUM_I[k], q = K.phase === 'answer' ? K.q[K.qi] : null; K.pop = null;
    if (k === 'half') { if (!q || q.res || !q.opts || q.mode !== 'abcd') return toast('Użyj podczas odpowiedzi ABCD'); const ans = cardView(kumCard(q.id)).ans; q.hidden = shuffle(q.opts.map((o, j) => j).filter(j => norm(q.opts[j]) !== norm(ans))).slice(0, 2); }
    else if (k === 'letter') { if (!q || q.res) return toast('Użyj podczas odpowiedzi'); q.letter = true; }
    else if (k === 'disc') { if (K.phase !== 'pick') return toast('Użyj przy wybieraniu fiszek'); K.disc++; }
    else if (k === 'shield') { if (K.shield) return toast('Tarcza już działa'); K.shield = true; }
    else if (D.book) { kumLevelUp(D.book); toast(`📘 ${KUM_TYPES[D.book].n} – poziom ${K.levels[D.book] + 1}`); K.items.splice(i, 1); return render(); }
    else if (D.stamp) { if (K.phase !== 'pick') return toast('Użyj przy wybieraniu fiszek – potem stuknij fiszkę'); K.pendingStamp = D.stamp; K.items.splice(i, 1); return render(); }
    K.items.splice(i, 1); toast(`${D.ic} ${D.n}`); render(); },
  'kum-info': el => { const K = KUM, i = +el.dataset.i, P = kgPop(); K.pop = P?.t === 'j' && P.i === i ? null : { t: 'j', i, ph: K.phase }; render(); },
  'kum-iteminfo': el => { const K = KUM, i = +el.dataset.i, P = kgPop(); K.pop = P?.t === 'i' && P.i === i ? null : { t: 'i', i, ph: K.phase }; render(); },
  'kum-popx': () => { if (KUM) { KUM.pop = null; render(); } },
  'kum-levels': () => { if (KUM) { KUM.showLv = !KUM.showLv; render(); } },
  'kum-quit': () => { if (!KUM) return go('#/boss'); askBox({ icon: '🃏', title: 'Zakończyć bieg?', intro: 'Dostaniesz nagrodę za ukończone rundy.', ok: 'Zakończ', cancel: 'Graj dalej', danger: true }).then(ok => { if (ok && KUM && KUM.phase !== 'end') kumEnd(KUM.round > KUM_LAST); }); },
  'kum-again': () => { const d = KUM?.deckId || 'all', kit = KUM?.kit || 'classic', t = KUM?.tier || 1; KUM = null; kumStart(d, kit, t); },
  'kum-quit2': () => { KUM = null; kumUnlock(); go('#/boss'); },
});
// 🗓️ w wyzwaniu dnia każda akcja Kumulacji losuje z ziarna dnia
for (const k of Object.keys(ACTIONS)) if (k.startsWith('kum-') && k !== 'kum-daily') { const f = ACTIONS[k]; ACTIONS[k] = (...a) => kumSeeded(() => f(...a)); }
;

/* ===== skoj.js ===== */
'use strict';
/* 💡 Powtórka skojarzeń (tylko konto admina): trening na samych skojarzeniach z fiszek.
   Kierunek „skojarzenie → fiszka”: widzisz tylko skojarzenie i przypominasz sobie pytanie i odpowiedź.
   Kierunek „fiszka → skojarzenie”: widzisz pytanie i przypominasz sobie swoje skojarzenie.
   To trening – nie zmienia terminów powtórek. Nietrafione wracają raz jeszcze na koniec. */
var skojAdmin = () => typeof testOn === 'function' ? testOn('skoj') : typeof IS_ADMIN !== 'undefined' && IS_ADMIN === true;
var SKOJ = null;
var skojHasHint = n => n && n.type !== 'occl' && (String(n.hint || '').trim() || (n.hintImg && IMG[n.hintImg]));
var skojNotes = deckId => S.notes.filter(n => (deckId === 'all' || n.deckId === deckId) && skojHasHint(n) && S.cards.some(c => c.noteId === n.id && !c.sus));
var skojImg = n => n.hintImg && IMG[n.hintImg] ? `<img class="hint-img" src="${IMG[n.hintImg]}" alt="skojarzenie">` : '';
var skojHintHTML = n => `<div class="hintbox skoj-hint"><div class="hb-h"><span>💡 Skojarzenie</span></div>${String(n.hint || '').trim() ? `<div class="hb-t">${fmt(n.hint)}</div>` : ''}${skojImg(n)}</div>`;
var skojCardHTML = n => n.type === 'cloze'
  ? `<div class="ctext">${typeof clozeHTML === 'function' ? clozeHTML(n.text, 'c1', true) : esc(n.text)}</div>`
  : `${n.imageId && IMG[n.imageId] ? `<img class="cimg" src="${IMG[n.imageId]}" alt="">` : ''}<div class="ctext"><b>${fmt(n.front || '')}</b></div><hr><div class="ctext">${fmt(n.back || '')}</div>`;
var skojFront = n => n.type === 'cloze' ? `<div class="ctext">${typeof clozeHTML === 'function' ? clozeHTML(n.text, 'c1', false) : esc(n.text)}</div>`
  : `${n.imageId && IMG[n.imageId] ? `<img class="cimg" src="${IMG[n.imageId]}" alt="">` : ''}<div class="ctext">${fmt(n.front || '')}</div>`;

function skojStart(deckId, dir) {
  const ns = skojNotes(deckId); if (!ns.length) return toast('W tej talii nie ma fiszek ze skojarzeniami');
  SKOJ = { deckId, dir, queue: shuffle(ns.map(n => n.id)), i: 0, shown: false, ok: 0, miss: 0, retry: new Set(), done: false };
  go('#/skoj/' + deckId); render();
}
ROUTES.skoj = parts => {
  if (!skojAdmin()) return { tab: 'home', html: '<p class="muted center" style="padding:40px 0">Ten tryb jest jeszcze w testach.</p>' };
  const deckId = parts[1] || 'all', d = deckId === 'all' ? null : deckById(deckId), name = d ? d.name : 'Wszystkie talie';
  const K = SKOJ && SKOJ.deckId === deckId ? SKOJ : null, cnt = skojNotes(deckId).length;
  if (!K) return { tab: 'home', html: `<div class="row nowrap"><button class="iconbtn" data-go="${d ? '#/deck/' + d.id : '#/'}">‹</button><h1 class="grow" style="margin:0">💡 Powtórka skojarzeń</h1><span class="tag">admin</span></div>
    <div class="card"><p style="margin-top:0"><b>${esc(name)}</b> · ${cnt} ${plural(cnt, 'fiszka', 'fiszki', 'fiszek')} ze skojarzeniem</p>
      <p class="small muted">Trening – nie zmienia terminów powtórek. Fiszki, których nie pamiętasz, wrócą jeszcze raz na końcu.</p>
      ${cnt ? `<button class="primary block" data-act="skoj-go" data-id="${deckId}" data-dir="h2c" style="min-height:52px">💡 → 🃏 Skojarzenie → fiszka</button>
      <p class="small muted" style="margin:4px 0 12px">Widzisz samo skojarzenie – przypomnij sobie pytanie i odpowiedź.</p>
      <button class="block" data-act="skoj-go" data-id="${deckId}" data-dir="c2h" style="min-height:52px">🃏 → 💡 Fiszka → skojarzenie</button>
      <p class="small muted" style="margin:4px 0 0">Widzisz pytanie – przypomnij sobie swoje skojarzenie.</p>` : '<p class="muted">Dodaj skojarzenia do fiszek (💡 w trakcie nauki albo w edycji fiszki), żeby z nich ćwiczyć.</p>'}</div>` };
  if (K.done) return { tab: 'home', html: `<div class="card center"><div style="font-size:48px">💡</div><h2>Koniec powtórki skojarzeń</h2>
    <p>Pamiętałeś <b>${K.ok}</b> z ${K.ok + K.miss}${K.miss ? ` · do poprawy: ${K.miss}` : ''}</p>
    <div class="row"><button class="primary grow" data-act="skoj-go" data-id="${deckId}" data-dir="${K.dir}">🔁 Jeszcze raz</button><button class="grow" data-act="skoj-dir" data-id="${deckId}" data-dir="${K.dir === 'h2c' ? 'c2h' : 'h2c'}">⇄ Odwrotnie</button></div>
    <button class="ghost block" data-act="skoj-quit" data-id="${deckId}" style="margin-top:8px">Wyjdź</button></div>` };
  const n = noteById(K.queue[K.i]); if (!n) { K.i++; if (K.i >= K.queue.length) K.done = true; return ROUTES.skoj(parts); }
  const total = K.queue.length, prompt = K.dir === 'h2c' ? skojHintHTML(n) : `<div class="card flash qfit">${skojFront(n)}</div>`;
  const reveal = K.dir === 'h2c' ? `<div class="card flash qfit">${skojCardHTML(n)}</div>` : skojHintHTML(n);
  return { tab: 'home', focus: true, html: `<div class="studybar"><button class="iconbtn" data-act="skoj-quit" data-id="${deckId}" aria-label="Zakończ">✕</button><div class="title">💡 ${K.dir === 'h2c' ? 'Skojarzenie → fiszka' : 'Fiszka → skojarzenie'}</div><small class="muted">${Math.min(K.i + 1, total)}/${total}</small></div>
    ${progress(K.i / total)}
    <p class="small muted center" style="margin:10px 0 6px">${K.dir === 'h2c' ? 'Do jakiej fiszki jest to skojarzenie?' : 'Jakie masz skojarzenie do tej fiszki?'}</p>
    ${prompt}
    ${K.shown ? `<div class="skoj-rev">${reveal}</div><div class="row" style="margin-top:12px"><button class="grow skoj-no" data-act="skoj-ans" data-v="0">✗ Nie wiedziałem</button><button class="primary grow" data-act="skoj-ans" data-v="1">✓ Wiedziałem</button></div>`
      : `<button class="primary block" data-act="skoj-show" style="margin-top:12px;min-height:52px">Pokaż ${K.dir === 'h2c' ? 'fiszkę' : 'skojarzenie'}</button>`}` };
};
// wejścia: strona talii i strona główna (tylko admin)
var skojDeck0 = viewDeck;
viewDeck = function (id, q) { const html = skojDeck0(id, q); if (!skojAdmin()) return html; const n = skojNotes(id).length;
  return html + `<div class="card row nowrap skoj-cta" data-go="#/skoj/${id}"><span style="font-size:26px">💡</span><div class="grow"><b>Powtórka skojarzeń <span class="tag">admin</span></b><div class="small muted">${n} ${plural(n, 'fiszka', 'fiszki', 'fiszek')} ze skojarzeniem</div></div><span>›</span></div>`; };
var skojHome0 = homeExtrasHTML;
homeExtrasHTML = function () { const base = skojHome0(); if (!skojAdmin()) return base; const n = skojNotes('all').length; if (!n) return base;
  return base + `<div class="card row nowrap skoj-cta" data-go="#/skoj/all"><span style="font-size:26px">💡</span><div class="grow"><b>Powtórka skojarzeń <span class="tag">admin</span></b><div class="small muted">${n} ${plural(n, 'fiszka', 'fiszki', 'fiszek')} ze skojarzeniem we wszystkich taliach</div></div><span>›</span></div>`; };
Object.assign(ACTIONS, {
  'skoj-go': el => skojStart(el.dataset.id, el.dataset.dir || 'h2c'),
  'skoj-dir': el => skojStart(el.dataset.id, el.dataset.dir),
  'skoj-show': () => { if (SKOJ) { SKOJ.shown = true; render(); } },
  'skoj-ans': el => { const K = SKOJ; if (!K) return; const id = K.queue[K.i], ok = el.dataset.v === '1';
    if (!K.retry.has(id)) { ok ? K.ok++ : K.miss++; }
    if (!ok && !K.retry.has(id)) { K.retry.add(id); K.queue.push(id); }   // raz jeszcze na koniec
    K.i++; K.shown = false; if (K.i >= K.queue.length) K.done = true; render(); },
  'skoj-quit': el => { const id = el.dataset.id; SKOJ = null; go(id && id !== 'all' ? '#/deck/' + id : '#/'); },
});
;

/* ===== rys.js ===== */
'use strict';
/* ✏️ Rysowanie fiszek (admin + testerzy z panelu admina): widzisz pytanie, rysujesz odpowiedź z pamięci,
   a potem porównujesz swój rysunek z obrazkiem z fiszki (obok siebie + przybliżona ocena podobieństwa kształtu).
   Biorą udział: zwykłe fiszki z obrazkiem na odpowiedzi (nowe pole w edytorze „Obrazek-odpowiedź”),
   fiszki odwrotne z obrazkiem na przodzie oraz obrazy z lukami (rysujesz cały obraz).
   Ocena własna: ✓ / ~ / ✗ – nietrafione wracają raz na koniec. To trening: nie zmienia terminów powtórek. */
var rysOn = () => typeof testOn === 'function' ? testOn('rys') : typeof IS_ADMIN !== 'undefined' && IS_ADMIN === true;
var RYS = null;

// elementy do rysowania: { key, q (HTML pytania), img (id obrazka-odpowiedzi), label }
function rysItems(deckId) {
  const out = [], seenOccl = new Set();
  for (const c of S.cards) {
    if (c.sus || (deckId !== 'all' && c.deckId !== deckId)) continue;
    const n = noteById(c.noteId); if (!n) continue;
    if (n.type === 'basic') {
      const fwd = c.ord !== 'r', img = fwd ? n.backImageId : n.imageId, txt = fwd ? n.front : n.back;
      if (!img || !IMG[img] || !(txt || '').trim()) continue;
      out.push({ key: c.id, q: `<div class="ctext">${fmt(txt)}</div>`, img, label: txt.trim(), ans: (fwd ? n.back : n.front) || '' });
    } else if (n.type === 'occl' && n.imageId && IMG[n.imageId] && !seenOccl.has(n.id)) {
      seenOccl.add(n.id);
      out.push({ key: 'o' + n.id, q: `<div class="ctext">${fmt(n.title || 'Narysuj cały obraz')}</div><div class="small muted">Zaznacz najważniejsze części: ${esc(n.boxes.map(b => b.label).filter(Boolean).slice(0, 8).join(', '))}</div>`, img: n.imageId, label: n.title || 'Obraz z lukami', ans: '' });
    }
  }
  return out;
}

// ---------- porównanie kształtu (przybliżone): maska „tuszu” obu obrazków → przycięcie do ramki → 32×32 → dopasowanie z tolerancją
var RYS_N = 32;
function rysLoad(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }
function rysMask(im) {
  const W = 96, H = 96, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  const k = Math.min(W / im.width, H / im.height), w = im.width * k, h = im.height * k; ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
  const d = ctx.getImageData(0, 0, W, H).data, L = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) L[i] = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2];
  // tusz = ciemne piksele albo wyraźne krawędzie (zdjęcia i kolorowe rysunki)
  const m = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, gx = L[i + 1] - L[i - 1], gy = L[i + W] - L[i - W];
    if (L[i] < 170 || Math.hypot(gx, gy) > 60) m[i] = 1;
  }
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y * W + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const out = new Uint8Array(RYS_N * RYS_N); if (x1 < 0) return out;
  const s = Math.max(x1 - x0 + 1, y1 - y0 + 1), ox = x0 - (s - (x1 - x0 + 1)) / 2, oy = y0 - (s - (y1 - y0 + 1)) / 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y * W + x]) {
    const u = Math.floor((x - ox) / s * RYS_N), v = Math.floor((y - oy) / s * RYS_N);
    if (u >= 0 && u < RYS_N && v >= 0 && v < RYS_N) out[v * RYS_N + u] = 1;
  }
  return out;
}
function rysDilate(m, r) {
  const o = new Uint8Array(m.length);
  for (let y = 0; y < RYS_N; y++) for (let x = 0; x < RYS_N; x++) if (m[y * RYS_N + x])
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const u = x + dx, v = y + dy; if (u >= 0 && u < RYS_N && v >= 0 && v < RYS_N) o[v * RYS_N + u] = 1; }
  return o;
}
async function rysCompare(drawUrl, refUrl) {
  const [a, b] = await Promise.all([rysLoad(drawUrl), rysLoad(refUrl)]).then(([x, y]) => [rysMask(x), rysMask(y)]);
  const na = a.reduce((s, v) => s + v, 0), nb = b.reduce((s, v) => s + v, 0); if (!na || !nb) return 0;
  const da = rysDilate(a, 2), db = rysDilate(b, 2);
  let pa = 0, pb = 0; for (let i = 0; i < a.length; i++) { if (a[i] && db[i]) pa++; if (b[i] && da[i]) pb++; }
  const prec = pa / na, rec = pb / nb, f = prec + rec ? 2 * prec * rec / (prec + rec) : 0;
  return Math.round(Math.min(1, f * 1.15) * 100);
}

// ---------- przebieg
function rysStart(deckId) {
  const items = shuffle(rysItems(deckId));
  if (!items.length) return toast('Brak fiszek do rysowania – dodaj „Obrazek-odpowiedź” w edytorze fiszki', 4500);
  RYS = { deckId, items: Object.fromEntries(items.map(x => [x.key, x])), queue: items.map(x => x.key), i: 0, retry: new Set(), ok: 0, half: 0, miss: 0, drawing: null, score: null, scores: [], done: false };
  render();
}
async function rysDraw() {
  const K = RYS; if (!K) return;
  const url = await openDrawPad(K.drawing || null, '✏️ Narysuj z pamięci', '✓ Porównaj');
  if (!url || RYS !== K) return;
  K.drawing = url; K.score = '…'; render();
  try { K.score = await rysCompare(url, IMG[K.items[K.queue[K.i]].img]); } catch { K.score = null; }
  if (RYS === K) render();
}
function rysHTML(deckId) {
  const K = RYS, d = deckId !== 'all' && deckById(deckId), back = `<button class="iconbtn" data-act="rys-quit" data-id="${deckId}" aria-label="Zakończ">✕</button>`;
  if (!K || K.deckId !== deckId) {
    const n = rysItems(deckId).length;
    return `<div class="row nowrap"><button class="iconbtn" data-go="${d ? '#/deck/' + d.id : '#/'}">‹</button><h1 class="grow" style="margin:0">✏️ Rysowanie fiszek</h1><span class="tag">${IS_ADMIN ? 'admin' : 'test'}</span></div>
    <div class="card"><p style="margin-top:0">Widzisz pytanie, <b>rysujesz odpowiedź z pamięci</b>, a potem porównujesz rysunek z obrazkiem z fiszki.</p>
      <p class="small muted">${d ? `Talia „${esc(d.name)}”` : 'Wszystkie talie'}: <b>${n}</b> ${plural(n, 'fiszka', 'fiszki', 'fiszek')} do rysowania.</p>
      <ul class="small muted"><li>Fiszki z <b>obrazkiem-odpowiedzią</b> (w edytorze fiszki: „🎨 Obrazek-odpowiedź”) – np. „Narysuj budowę serca”.</li><li>Fiszki odwrotne z obrazkiem na przodzie i obrazy z lukami (rysujesz cały obraz).</li><li>Ocena podobieństwa jest przybliżona – liczy się Twoja własna ocena. To trening: terminy powtórek się nie zmieniają.</li></ul>
      <button class="primary block" data-act="rys-start" data-id="${deckId}" ${n ? '' : 'disabled'} style="min-height:52px">▶ Zaczynamy</button></div>`;
  }
  if (K.done) {
    const avg = K.scores.length ? Math.round(K.scores.reduce((a, b) => a + b, 0) / K.scores.length) : null, total = K.ok + K.half + K.miss;
    return `<div class="card center"><div style="font-size:48px">🎨</div><h2>Koniec rysowania</h2>
      <p>✓ ${K.ok} · ~ ${K.half} · ✗ ${K.miss} <span class="muted">(z ${total})</span></p>${avg != null ? `<p class="small muted">Średnie podobieństwo kształtu: ${avg}%</p>` : ''}
      <div class="row"><button class="primary grow" data-act="rys-start" data-id="${deckId}">▶ Jeszcze raz</button><button class="grow" data-act="rys-quit" data-id="${deckId}">Wyjdź</button></div></div>`;
  }
  const it = K.items[K.queue[K.i]], total = K.queue.length, sc = K.score;
  const verdict = typeof sc === 'number' ? (sc >= 70 ? 'bardzo podobne' : sc >= 45 ? 'w miarę podobne' : sc >= 25 ? 'trochę podobne' : 'mało podobne') : '';
  return `<div class="studybar">${back}<div class="title">✏️ Rysowanie</div><small class="muted">${Math.min(K.i + 1, total)}/${total}</small></div>
    ${progress(K.i / total)}
    <p class="small muted center" style="margin:10px 0 6px">Narysuj z pamięci:</p>
    <div class="card flash qfit">${it.q}</div>
    ${K.drawing || K.peek ? `<div class="rys-cmp"><figure>${K.drawing ? `<img src="${K.drawing}" alt="Twój rysunek">` : '<div class="rys-empty">🙈</div>'}<figcaption>Twój rysunek</figcaption></figure><figure><img src="${IMG[it.img]}" alt="Obrazek z fiszki"><figcaption>Z fiszki${it.ans ? ': ' + esc(stripHtml(it.ans).slice(0, 40)) : ''}</figcaption></figure></div>
      <div class="rys-score">${sc === '…' ? 'Porównuję…' : !K.drawing ? '<span class="muted">Bez rysunku – zapamiętaj obrazek i spróbuj następnym razem</span>' : typeof sc === 'number' ? `<b>${sc}%</b> podobieństwa kształtu <span class="muted">· ${verdict} (ocena przybliżona)</span>` : '<span class="muted">Nie udało się porównać – oceń sam</span>'}</div>
      <p class="small muted center" style="margin:8px 0 4px">Jak Ci poszło?</p>
      <div class="row nowrap"><button class="grow skoj-no" data-act="rys-ans" data-v="0">✗ Nie</button><button class="grow" data-act="rys-ans" data-v="1">~ Częściowo</button><button class="primary grow" data-act="rys-ans" data-v="2">✓ Dobrze</button></div>
      <button class="ghost block" data-act="rys-draw" style="margin-top:6px">✏️ Popraw rysunek</button>`
    : `<button class="primary block" data-act="rys-draw" style="margin-top:12px;min-height:52px">✏️ Rysuj</button><button class="ghost block" data-act="rys-peek" style="margin-top:6px">🙈 Nie wiem – pokaż obrazek</button>`}`;
}
ROUTES.rys = parts => { const deckId = parts?.[1] || 'all';
  if (!rysOn()) return { tab: 'home', html: '<p class="muted center" style="padding:40px 0">Ten tryb jest jeszcze w testach.</p>' };
  return { tab: 'home', focus: !!RYS, html: rysHTML(deckId) };
};

// 🎨 edytor fiszki: obrazek-odpowiedź (narysuj albo z pliku) – tylko gdy tryb jest włączony dla tego konta
function rysBackImgHTML(D) {
  if (!rysOn()) return '';
  const src = D.backImageId && IMG[D.backImageId];
  return `<div class="field rys-back"><span>🎨 Obrazek-odpowiedź <span class="tag">${IS_ADMIN ? 'admin' : 'test'}</span> <small class="muted">– do rysowania z pamięci</small></span>
    ${src ? `<img src="${src}" alt="" style="max-height:110px;border-radius:8px;display:block;margin:4px 0">` : ''}
    <div class="row nowrap"><button type="button" class="sm" data-act="rys-bimg-draw">✏️ ${src ? 'Popraw' : 'Narysuj'}</button><button type="button" class="sm" data-act="rys-bimg-file">🖼️ Z pliku</button>${src ? '<button type="button" class="sm ghost" data-act="rys-bimg-del">🗑️</button>' : ''}</div></div>`;
}

// wejścia: strona talii i strona główna
var rysDeck0 = viewDeck;
viewDeck = function (id, q) { const html = rysDeck0(id, q); if (!rysOn()) return html; const n = rysItems(id).length;
  return html + `<div class="card row nowrap rys-cta" data-go="#/rys/${id}"><span style="font-size:26px">✏️</span><div class="grow"><b>Rysowanie fiszek <span class="tag">${IS_ADMIN ? 'admin' : 'test'}</span></b><div class="small muted">${n ? `${n} ${plural(n, 'fiszka', 'fiszki', 'fiszek')} do rysowania` : 'Dodaj fiszce „Obrazek-odpowiedź” w edytorze'}</div></div><span>›</span></div>`; };
var rysHome0 = homeExtrasHTML;
homeExtrasHTML = function () { const base = rysHome0(); if (!rysOn()) return base; const n = rysItems('all').length;
  return base + `<div class="card row nowrap rys-cta" data-go="#/rys/all"><span style="font-size:26px">✏️</span><div class="grow"><b>Rysowanie fiszek <span class="tag">${IS_ADMIN ? 'admin' : 'test'}</span></b><div class="small muted">${n ? `${n} ${plural(n, 'fiszka', 'fiszki', 'fiszek')} do rysowania we wszystkich taliach` : 'Narysuj odpowiedź z pamięci i porównaj z obrazkiem'}</div></div><span>›</span></div>`; };

Object.assign(ACTIONS, {
  'rys-start': el => rysStart(el.dataset.id || 'all'),
  'rys-draw': () => rysDraw(),
  'rys-peek': () => { const K = RYS; if (!K) return; K.score = null; K.peek = true; render(); },
  'rys-ans': el => { const K = RYS; if (!K) return; const key = K.queue[K.i], v = +el.dataset.v;
    if (!K.retry.has(key)) { if (v === 2) K.ok++; else if (v === 1) K.half++; else K.miss++; if (typeof K.score === 'number' && !K.peek) K.scores.push(K.score); }
    if (v < 2 && !K.retry.has(key)) { K.retry.add(key); K.queue.push(key); }   // raz jeszcze na koniec
    K.i++; K.drawing = null; K.score = null; K.peek = false; if (K.i >= K.queue.length) K.done = true; render(); },
  'rys-quit': el => { const id = el.dataset.id; RYS = null; go(id && id !== 'all' ? '#/deck/' + id : '#/'); },
  'rys-bimg-draw': async () => { const D = DRAFT; if (!D) return; const url = await openDrawPad(D.backImageId ? IMG[D.backImageId] : null, '🎨 Obrazek-odpowiedź', '✓ Zapisz'); if (!url || DRAFT !== D) return; D.backImageId = await putImage(url); render(); },
  'rys-bimg-file': async () => { const D = DRAFT; if (!D) return; const id = await getImage('file'); if (id && DRAFT === D) { D.backImageId = id; render(); } },
  'rys-bimg-del': () => { if (DRAFT) { DRAFT.backImageId = null; render(); } },
});
;

/* ===== idle.js ===== */
'use strict';
/* 🏛️ Akademia – gra beta typu idle / budowanie (admin + testerzy z panelu admina, cecha 'idle').
   Budujesz miasteczko nauki: budynki produkują 📜 wiedzę co sekundę, także gdy aplikacja jest zamknięta (do 8 h, z ulepszeniami dłużej).
   Nauka napędza grę: każda powtórka fiszki dziś = +1% produkcji (max +100%), a 🎓 stypendium dnia (złoto) wymaga 10 powtórek.
   Kamienie milowe (poz. 10, 25, 50, 100…) podwajają budynek, ulepszenia działają na całe miasto, a 📜 Dyplomy (reset) dają stały bonus.
   Stan w S.stats.idle (synchronizuje się). Licznik odświeża się własnym zegarem – bez przebudowy całego ekranu. */
var akOn = () => typeof testOn === 'function' ? testOn('idle') : typeof IS_ADMIN !== 'undefined' && IS_ADMIN === true;
var AK_B = [
  { id: 'desk', ic: '🪑', n: 'Ławka ucznia', d: 'Pierwsze notatki przy świecy', c: 12, p: .4, col: '#a16207' },
  { id: 'lib', ic: '📚', n: 'Biblioteka', d: 'Półki pełne podręczników', c: 140, p: 3, col: '#2563eb' },
  { id: 'lab', ic: '🧪', n: 'Laboratorium', d: 'Eksperymenty dają nowe odkrycia', c: 1500, p: 16, col: '#16a34a' },
  { id: 'garden', ic: '🌿', n: 'Ogród botaniczny', d: 'Żywe atlasy roślin', c: 16000, p: 85, col: '#059669' },
  { id: 'obs', ic: '🔭', n: 'Obserwatorium', d: 'Mapy gwiazd i komet', c: 175000, p: 460, col: '#7c3aed' },
  { id: 'aula', ic: '🏛️', n: 'Aula', d: 'Wykłady dla tłumów', c: 2e6, p: 2600, col: '#b91c1c' },
  { id: 'tower', ic: '🗼', n: 'Wieża mędrców', d: 'Najstarsze księgi świata', c: 2.4e7, p: 15000, col: '#0f766e' },
  { id: 'planet', ic: '🪐', n: 'Planetarium', d: 'Kosmos pod kopułą', c: 3e8, p: 90000, col: '#4338ca' },
  { id: 'rocket', ic: '🚀', n: 'Akademia kosmiczna', d: 'Nauka poza orbitą', c: 4e9, p: 560000, col: '#db2777' },
];
var AK_U = [
  { id: 'coffee', ic: '☕', n: 'Kawa', d: 'Stuknięcie w szkołę ×3', c: 60 },
  { id: 'marker', ic: '🖍️', n: 'Kolorowe zakreślacze', d: 'Ławki i biblioteki ×2', c: 2500 },
  { id: 'bookmark', ic: '🔖', n: 'Zakładki', d: 'Produkcja offline do 12 h', c: 9000 },
  { id: 'notes', ic: '🗂️', n: 'Fiszki w każdej sali', d: 'Całe miasto ×1,5', c: 120000 },
  { id: 'plan', ic: '📅', n: 'Plan zajęć', d: 'Produkcja offline do 24 h', c: 3e6 },
  { id: 'grant', ic: '💼', n: 'Grant badawczy', d: 'Całe miasto ×2', c: 6e7 },
  { id: 'wifi', ic: '📡', n: 'Szybki internet', d: 'Stuknięcie = 10% produkcji na sekundę', c: 8e8 },
  { id: 'nobel', ic: '🏅', n: 'Nagroda Nobla', d: 'Całe miasto ×3', c: 2e10 },
];
var AK_MILES = [10, 25, 50, 100, 150, 200, 300];
var AK_STIPEND_REV = 10;
var ak = () => { const I = S.stats.idle = S.stats.idle || {}; I.b = I.b || {}; I.u = I.u || {}; if (I.w == null) { I.w = 0; I.tot = 0; I.all = 0; I.dip = 0; I.t = Date.now(); } return I; };
function akFmt(x) {
  x = Math.floor(x); if (x < 1e4) return x.toLocaleString('pl');
  const u = [[1e15, 'bld'], [1e12, 'bln'], [1e9, 'mld'], [1e6, 'mln'], [1e3, 'tys.']];
  for (const [v, s] of u) if (x >= v) return (x / v).toLocaleString('pl', { maximumFractionDigits: x / v < 100 ? 2 : 1 }) + ' ' + s;
  return String(x);
}
var akRevToday = () => logMemo('akrev', () => S.log.filter(l => l.t >= dayStart()).length);
var akBoost = () => Math.min(100, akRevToday());
var akBuildMult = (b, lv) => 2 ** AK_MILES.filter(m => lv >= m).length * ((b.id === 'desk' || b.id === 'lib') && ak().u.marker ? 2 : 1);
function akCityMult() { const I = ak(); return (I.u.notes ? 1.5 : 1) * (I.u.grant ? 2 : 1) * (I.u.nobel ? 3 : 1) * (1 + .1 * (I.dip || 0)) * (1 + akBoost() / 100); }
var akBProd = b => { const lv = ak().b[b.id] || 0; return lv * b.p * akBuildMult(b, lv); };
var akRate = () => AK_B.reduce((a, b) => a + akBProd(b), 0) * akCityMult();
var akCost = (b, lv) => Math.ceil(b.c * 1.15 ** lv);
function akCostN(b, n) { const lv = ak().b[b.id] || 0; let s = 0; for (let i = 0; i < n; i++) s += akCost(b, lv + i); return s; }
function akMaxN(b) { const I = ak(), lv = I.b[b.id] || 0; let n = 0, s = 0; while (n < 500) { const c = akCost(b, lv + n); if (s + c > I.w) break; s += c; n++; } return n; }
var akClick = () => { const I = ak(), base = 1 + akRate() * (I.u.wifi ? .1 : .02); return base * (I.u.coffee ? 3 : 1); };
var akOfflineCap = () => (ak().u.plan ? 24 : ak().u.bookmark ? 12 : 8) * 3600;
var akLevels = () => Object.values(ak().b).reduce((a, x) => a + x, 0);
var akDipFor = all => Math.floor(Math.sqrt(all / 1e7));
function akGain(sec) { const I = ak(), g = akRate() * sec; I.w += g; I.tot += g; I.all = (I.all || 0) + g; return g; }
// produkcja od ostatniej wizyty (z limitem offline)
function akCatchUp() {
  const I = ak(), now = Date.now(), sec = Math.max(0, Math.min(akOfflineCap(), (now - (I.t || now)) / 1000)); I.t = now;
  return sec > 30 ? { sec, g: akGain(sec) } : (akGain(sec), null);
}
var AK_TIMER = 0, AK_BUY = 1, AK_SAVE = 0;
function akTick() {
  if (parseRoute().parts[0] !== 'akad' || !document.getElementById('ak-root')) { clearInterval(AK_TIMER); AK_TIMER = 0; akSync(); return; }
  if (document.hidden) return;
  const I = ak(), now = Date.now(); akGain(Math.min(5, (now - I.t) / 1000)); I.t = now;
  akPaint();
  if (now - AK_SAVE > 15000) { AK_SAVE = now; save(); }
}
var akSync = () => { const I = S.stats.idle; if (I) { I.t = Date.now(); save(); } };
document.addEventListener('visibilitychange', () => { if (!S?.stats?.idle) return; if (document.hidden) akSync(); else if (parseRoute().parts[0] === 'akad') { const r = akCatchUp(); if (r) akWelcome(r); } });
// lekkie odświeżenie: liczniki i dostępność przycisków bez render()
function akPaint() {
  const I = ak(), $w = document.getElementById('ak-w'); if (!$w) return;
  $w.textContent = akFmt(I.w);
  for (const el of document.querySelectorAll('[data-ak-cost]')) el.classList.toggle('can', I.w >= +el.dataset.akCost);
  const dp = document.getElementById('ak-dip'); if (dp) dp.textContent = Math.max(0, akDipFor(I.all) - (I.dip || 0));
}
function akWelcome(r) { toast(`🏛️ Pod Twoją nieobecność (${r.sec >= 3600 ? Math.floor(r.sec / 3600) + ' h ' : ''}${Math.floor(r.sec % 3600 / 60)} min) Akademia wyprodukowała ${akFmt(r.g)} 📜`, 4000); }
function akSceneHTML() {
  const I = ak(), h = new Date().getHours(), night = h < 6 || h >= 20, eve = !night && h >= 17;
  const town = AK_B.filter(b => I.b[b.id]).map((b, i) => { const lv = I.b[b.id], sz = Math.min(46, 22 + Math.log2(lv + 1) * 4);
    return `<span class="ak-house" style="--sz:${sz}px;--d:${i * .37}s" title="${esc(b.n)} · poz. ${lv}">${b.ic}</span>`; }).join('');
  return `<div class="ak-scene${night ? ' night' : eve ? ' eve' : ''}"><i class="ak-sun"></i><i class="ak-cloud c1"></i><i class="ak-cloud c2"></i>
    <div class="ak-count"><b id="ak-w">${akFmt(I.w)}</b><span>📜 wiedzy · <b>+${akFmt(akRate())}</b>/s</span></div>
    <div class="ak-town">${town || '<span class="ak-empty">Kup pierwszy budynek ↓</span>'}</div>
    <button class="ak-school" data-act="ak-tap" aria-label="Stuknij, żeby zdobyć wiedzę">🏫<small>+${akFmt(akClick())}</small></button><div class="ak-ground"></div></div>`;
}
function akBuildingsHTML() {
  const I = ak(); let hidden = 0;
  return AK_B.map(b => {
    const lv = I.b[b.id] || 0;
    if (!lv && I.tot < b.c * .4 && (I.all || 0) < b.c) { if (hidden++) return ''; return `<div class="ak-b lock"><span class="ak-bic">❔</span><div class="grow"><b>???</b><small>Odkryjesz przy ${akFmt(b.c * .4)} 📜</small></div></div>`; }
    const n = AK_BUY === 'max' ? Math.max(1, akMaxN(b)) : AK_BUY, cost = akCostN(b, n), next = AK_MILES.find(m => m > lv);
    const each = b.p * akBuildMult(b, Math.max(1, lv)) * akCityMult();
    return `<div class="ak-b" style="--bc:${b.col}"><span class="ak-bic">${b.ic}</span><div class="grow"><b>${esc(b.n)} <em>poz. ${lv}</em></b>
      <small>${lv ? `daje ${akFmt(akBProd(b) * akCityMult())}/s · ` : ''}+${akFmt(each)}/s za poziom</small>
      ${next ? `<span class="ak-mile"><i style="width:${Math.round(100 * (lv - (AK_MILES[AK_MILES.indexOf(next) - 1] || 0)) / (next - (AK_MILES[AK_MILES.indexOf(next) - 1] || 0)))}%"></i></span><small class="muted">poz. ${next}: produkcja ×2</small>` : ''}</div>
      <button class="ak-buy" data-act="ak-buy" data-id="${b.id}" data-n="${n}" data-ak-cost="${cost}">${n > 1 ? `×${n}<br>` : ''}${akFmt(cost)} 📜</button></div>`;
  }).join('');
}
function akUpgradesHTML() {
  const I = ak(), list = AK_U.filter(u => !I.u[u.id] && (I.all || 0) >= u.c * .2).slice(0, 3);
  if (!list.length) return '';
  return `<h3 class="ak-h">✨ Ulepszenia</h3><div class="ak-ups">${list.map(u => `<button class="ak-up" data-act="ak-up" data-id="${u.id}" data-ak-cost="${u.c}"><span>${u.ic}</span><b>${esc(u.n)}</b><small>${esc(u.d)}</small><em>${akFmt(u.c)} 📜</em></button>`).join('')}</div>`;
}
function akMetaHTML() {
  const I = ak(), rev = akRevToday(), boost = akBoost(), day = dayKey(Date.now()), got = I.stip === day, lvls = akLevels(), stip = Math.min(40, 8 + 4 * Math.floor(lvls / 15));
  const dipNow = Math.max(0, akDipFor(I.all || 0) - (I.dip || 0));
  return `<div class="ak-boost"><div class="row nowrap" style="gap:10px"><span style="font-size:26px">📖</span><div class="grow"><b>Natchnienie z nauki: +${boost}%</b><small>Każda powtórka fiszki dziś = +1% produkcji (max +100%). Dziś: ${rev}.</small></div>${boost < 100 ? '<button class="sm primary" data-go="#/study/all/flip">Ucz się</button>' : ''}</div>
      <div class="ak-bbar"><i style="width:${boost}%"></i></div></div>
    <div class="ak-stip"><span style="font-size:26px">🎓</span><div class="grow"><b>Stypendium dnia: ${stip} 🪙</b><small>${got ? 'Odebrane – wróć jutro.' : rev >= AK_STIPEND_REV ? 'Gotowe do odebrania!' : `Powtórz ${AK_STIPEND_REV - rev} ${plural(AK_STIPEND_REV - rev, 'fiszkę', 'fiszki', 'fiszek')}, żeby odblokować.`} Rośnie z poziomami budynków.</small></div>
      ${got ? '<span class="small muted">✓</span>' : `<button class="sm${rev >= AK_STIPEND_REV ? ' primary' : ''}" data-act="ak-stip" ${rev >= AK_STIPEND_REV ? '' : 'disabled'}>Odbierz</button>`}</div>
    ${(I.all || 0) >= 1e7 ? `<div class="ak-dip"><span style="font-size:26px">📜</span><div class="grow"><b>Dyplomy: ${I.dip || 0}</b> <small>(+${10 * (I.dip || 0)}% produkcji)</small><small>Obrona dyplomu zeruje budynki, ulepszenia i wiedzę, ale każdy nowy dyplom to na stałe +10%. Teraz zdobędziesz: <b id="ak-dip">${dipNow}</b>.</small></div>
      <button class="sm" data-act="ak-dip" ${dipNow ? '' : 'disabled'}>Obroń</button></div>` : ''}`;
}
ROUTES.akad = () => {
  if (!akOn()) return { tab: 'arena', html: '<p class="muted center" style="padding:40px 0">Ten tryb jest jeszcze w testach.</p>' };
  const first = !S.stats.idle; ak();
  onMount(() => {
    const r = akCatchUp(); if (r) akWelcome(r);
    if (!AK_TIMER) AK_TIMER = setInterval(akTick, 250);
    akPaint();
  });
  return { tab: 'arena', html: `<div id="ak-root" class="ak"><div class="row nowrap"><button class="iconbtn" data-go="#/boss">‹</button><h1 class="grow" style="margin:0">Akademia</h1><span class="tag">${IS_ADMIN ? 'admin · beta' : 'beta'}</span></div>
    ${first ? '<p class="small muted ak-intro">Zbuduj miasteczko nauki. Stukaj w szkołę, kupuj budynki – produkują wiedzę same, nawet gdy aplikacja jest zamknięta. Nauka fiszek przyspiesza całe miasto.</p>' : ''}
    ${akSceneHTML()}
    ${akMetaHTML()}
    ${akUpgradesHTML()}
    <div class="row nowrap ak-hrow"><h3 class="ak-h grow">🏗️ Budynki</h3><div class="seg ak-seg">${[1, 10, 'max'].map(n => `<button class="${AK_BUY === n ? 'on' : ''}" data-act="ak-mode" data-n="${n}">${n === 'max' ? 'max' : '×' + n}</button>`).join('')}</div></div>
    <div class="ak-list">${akBuildingsHTML()}</div>
    <p class="small muted center">Wiedza nie zamienia się w kryształy – za to stypendium dnia daje złoto. Gra jest w becie: liczby mogą się jeszcze zmienić.</p></div>` };
};
// zakładka Przygoda: wejście do Akademii + mniej kart – dodatkowe tryby jako kafelki „Więcej trybów” (nic nie znika)
var akBoss0 = ROUTES.boss;
ROUTES.boss = (...a) => {
  const v = akBoss0(...a); if (!v?.html || v.focus || (a[0] && a[0][1])) return v;
  const cta = akOn() ? `<div class="card row nowrap idle-cta" data-go="#/akad"><span class="ak-cta-ic">🏛️</span><div class="grow"><b>Akademia <span class="tag">beta</span></b><div class="small muted">Buduj miasteczko nauki${S.stats.idle ? ` · ${akFmt(akRate())} 📜/s` : ''}</div></div><span>›</span></div>` : '';
  return cta ? { ...v, html: v.html.replace('<div class="card row nowrap coop-cta"', cta + '<div class="card row nowrap coop-cta"') } : v;
};
Object.assign(ACTIONS, {
  'ak-tap': el => { const g = akClick(), I = ak(); I.w += g; I.tot += g; I.all = (I.all || 0) + g; I.taps = (I.taps || 0) + 1; akPaint();
    const f = document.createElement('i'); f.className = 'ak-pop'; f.textContent = '+' + akFmt(g); f.style.left = (35 + Math.random() * 30) + '%'; el.parentElement.append(f); setTimeout(() => f.remove(), 900);
    el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); },
  'ak-buy': el => { const b = AK_B.find(x => x.id === el.dataset.id), I = ak(); if (!b) return; const n = +el.dataset.n || 1, c = akCostN(b, n); if (I.w < c) return toast('Za mało wiedzy 📜');
    const lv0 = I.b[b.id] || 0; I.w -= c; I.b[b.id] = lv0 + n; const m = AK_MILES.find(x => lv0 < x && lv0 + n >= x); if (m) toast(`🎉 ${b.n}: poziom ${m} – produkcja ×2!`); save(); render(); },
  'ak-up': el => { const u = AK_U.find(x => x.id === el.dataset.id), I = ak(); if (!u || I.u[u.id]) return; if (I.w < u.c) return toast('Za mało wiedzy 📜'); I.w -= u.c; I.u[u.id] = 1; toast(`${u.ic} ${u.n}: ${u.d}`); save(); render(); },
  'ak-mode': el => { AK_BUY = el.dataset.n === 'max' ? 'max' : +el.dataset.n; render(); },
  'ak-stip': () => { const I = ak(), day = dayKey(Date.now()); if (I.stip === day || akRevToday() < AK_STIPEND_REV) return; I.stip = day;
    const n = Math.min(40, 8 + 4 * Math.floor(akLevels() / 15)); if (!S.wallet.some(w => w.id === 'ak-' + day)) S.wallet.push({ id: 'ak-' + day, n, why: 'idle', t: Date.now() }); save(); toast(`🎓 Stypendium: +${n} 🪙`); render(); },
  'ak-dip': async () => { const I = ak(), n = akDipFor(I.all || 0) - (I.dip || 0); if (n <= 0) return;
    if (!await askBox({ icon: '📜', title: `Obrona dyplomu: +${n}`, intro: 'Budynki, ulepszenia i wiedza wrócą do zera. W zamian każdy dyplom daje na stałe +10% produkcji.', ok: 'Bronię!' })) return;
    I.dip = (I.dip || 0) + n; I.w = 0; I.tot = 0; I.b = {}; I.u = {}; save(); if (typeof confetti === 'function') confetti(120); render(); },
});
if (typeof GOLD_WHY !== 'undefined') GOLD_WHY.add('idle');
;

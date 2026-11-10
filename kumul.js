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
const kumAdmin = () => typeof testOn === 'function' ? testOn('kumul') : typeof IS_ADMIN !== 'undefined' && IS_ADMIN === true;
const KUM_TARGETS = [300, 500, 900, 1300, 2000, 3200, 4500, 7000];
const KUM_HAND = 5, KUM_MAX_PLAY = 3, KUM_ITEM_SLOTS = 2, KUM_LAST = KUM_TARGETS.length;
// 🏆 puchary (poziomy trudności) – utrudnienia sumują się
const KUM_CUPS = [null,
  { n: 'Brąz', img: 'bronze', d: 'Zwykłe zasady' },
  { n: 'Srebro', img: 'silver', d: '📈 Progi punktów +20%' },
  { n: 'Złoto', img: 'silver', cls: 'gold', d: '💤 Senne atuty: część atutów w sklepie drzemie w co drugim zagraniu' },
  { n: 'Platyna', img: 'platinum', d: '⚔️ Egzaminator w każdej parzystej rundzie' },
  { n: 'Diament', img: 'diamond', d: '💸 Inflacja: wszystko w sklepie +1 🪙, odsetki najwyżej 3' },
  { n: 'Rubin', img: 'diamond', cls: 'ruby', d: '⚠️ Zdradliwe fiszki: zła odpowiedź zabiera 10% punktów rundy' },
  { n: 'Mistrz', img: 'diamond', cls: 'master', d: '🎒 Tylko 4 miejsca na atuty, a finał ma próg ×1,5' },
];
const KUM_TOP = KUM_CUPS.length - 1;
const kumCupImg = (t, cls = '') => t ? `<img class="kcup t${t} ${KUM_CUPS[t].cls || ''} ${cls}" src="assets/cups/${KUM_CUPS[t].img}.webp" alt="${KUM_CUPS[t].n}" title="Puchar: ${KUM_CUPS[t].n}">` : '<i class="kcup0"></i>';
const kumTier = () => KUM?.tier || 1;
function kumTarget(r) {
  const t = kumTier(), base = r <= KUM_LAST ? KUM_TARGETS[r - 1] : KUM_TARGETS[KUM_LAST - 1] * Math.pow(1.6, r - KUM_LAST);
  return Math.round(base * (t >= 2 ? 1.2 : 1) * (t >= 7 && r === KUM_LAST ? 1.5 : 1) / 10) * 10;
}
const kumIsBoss = r => [3, 6, 8].includes(r) || (r > KUM_LAST && r % 2 === 0) || (kumTier() >= 4 && r % 2 === 0);
// typy zagrań: podstawa, mnożnik; każdy poziom +10 podstawy i +1 mnożnika
const KUM_TYPES = {
  single: { n: 'Pojedyncza', c: 10, m: 1 },
  pair:   { n: 'Dwójka', c: 20, m: 2 },
  triple: { n: 'Trójka', c: 30, m: 3 },
  same:   { n: 'Jedna talia', c: 45, m: 3 },
  mix:    { n: 'Przekrój', c: 45, m: 4 },
  hard:   { n: 'Ciężka trójka', c: 60, m: 4 },
};
// egzaminatorzy – utrudnienia rund 3, 6, 8 (i więcej przy wyższych pucharach)
const KUM_BOSSES = {
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
const KUM_J = {
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
};
const kumAdd = v => KUM?.boss === 'noplus' ? Math.round(v / 2 * 10) / 10 : v;   // 🧊 Mróz: dodawanie do mnożnika w połowie
const KUM_RAR = { c: { n: 'zwykły', w: 70 }, r: { n: 'rzadki', w: 25 }, l: { n: 'legendarny', w: 5 } };
// wykończenia atutów (rzadko w sklepie, częściej w kopertach)
const KUM_ED = {
  shine: { ic: '✨', n: 'Brokat', d: '+30 podstawy', p: 2 },
  neon:  { ic: '🌈', n: 'Neon', d: '+5 mnożnika', p: 3 },
  gilt:  { ic: '🥇', n: 'Złocenie', d: '×1,5 mnożnika', p: 4 },
  ghost: { ic: '👻', n: 'Duch', d: 'nie zajmuje miejsca', p: 3 },
};
// pomoce (jednorazowe), podręczniki i pieczątki
const KUM_I = {
  half:   { ic: '✂️', n: '50/50', d: 'Usuwa 2 złe odpowiedzi z bieżącej fiszki (ABCD)', p: 2 },
  letter: { ic: '🔤', n: 'Pierwsza litera', d: 'Pokazuje początek odpowiedzi', p: 2 },
  disc:   { ic: '🃏', n: 'Dodatkowa wymiana', d: '+1 wymiana w tej rundzie', p: 2 },
  shield: { ic: '🛡️', n: 'Tarcza', d: 'Następny błąd liczy się jak dobra odpowiedź', p: 3 },
  st_gold:  { ic: '🟨', n: 'Złota pieczątka', d: 'Na fiszkę z ręki: +3 monety, gdy dobrze zagrana', p: 3, stamp: 'gold' },
  st_glass: { ic: '🔷', n: 'Szklana pieczątka', d: 'Na fiszkę z ręki: ×2 mnożnik zagrania, ale może pęknąć (1/4)', p: 4, stamp: 'glass' },
  st_stone: { ic: '🪨', n: 'Kamienna pieczątka', d: 'Na fiszkę z ręki: +50 wartości', p: 3, stamp: 'stone' },
};
for (const [k, T] of Object.entries(KUM_TYPES)) KUM_I['bk_' + k] = { ic: '📘', n: `Podręcznik: ${T.n}`, d: `Typ „${T.n}” +1 poziom (+10 podstawy, +1 mnożnik) na cały bieg`, p: 3, book: k };
const KUM_STAMPS = { gold: { ic: '🟨', n: 'złota' }, glass: { ic: '🔷', n: 'szklana' }, stone: { ic: '🪨', n: 'kamienna' } };
// koperty: otwierasz i wybierasz 1 z 3
const KUM_PACKS = {
  jok:  { ic: '✉️', n: 'Koperta atutów', d: 'Wybierz 1 z 3 atutów (większa szansa na wykończenie)', p: 5 },
  book: { ic: '📚', n: 'Koperta wiedzy', d: 'Wybierz 1 z 3 podręczników – działa od razu', p: 4 },
  aid:  { ic: '🎁', n: 'Koperta pomocy', d: 'Wybierz 1 z 3 pomocy lub pieczątek', p: 3 },
};
// bilety za pominięcie zwykłej rundy
const KUM_TICKETS = {
  cash:   { ic: '💰', n: 'Sakiewka', d: '+10 monet od razu' },
  rare:   { ic: '🎟️', n: 'Bilet VIP', d: 'W następnym sklepie darmowy rzadki atut' },
  pack:   { ic: '✉️', n: 'Darmowa koperta', d: 'Od razu otwierasz Kopertę atutów' },
  book:   { ic: '📘', n: 'Ściąga', d: '+1 poziom losowego typu zagrania' },
  reroll: { ic: '🎲', n: 'Kupon', d: '3 darmowe nowe oferty w następnym sklepie' },
  depo:   { ic: '🏦', n: 'Lokata', d: 'Podwójne odsetki po następnej wygranej rundzie' },
};
const KUM_KITS = {
  classic: { ic: '🎒', n: 'Klasyczny', d: '4 monety, bez niespodzianek' },
  lang:    { ic: '⌨️', n: 'Poliglota', d: 'Tylko wpisywanie – do języków. Wpisanie ×2 wartości i +1 wymiana' },
  nerd:    { ic: '🤓', n: 'Kujon', d: '+1 zagranie w każdej rundzie, ale 1 wymiana mniej' },
  gamble:  { ic: '🎰', n: 'Hazardzista', d: 'Start z 12 monetami, ale tylko 2 wymiany' },
  pen:     { ic: '🖋️', n: 'Pisarz', d: 'Start z atutem „Pisarz”' },
  shelf:   { ic: '📦', n: 'Półka', d: '+1 miejsce na atut, ale start z 0 monet' },
  scholar: { ic: '🧑‍🏫', n: 'Belfer', d: 'Wszystkie typy zagrań od poziomu 2, ale tylko 3 miejsca na atuty' },
};
let KUM = null;
const kumAwake = j => !j.sleepy || (KUM.playNo % 2 === 0);   // 💤 senny atut działa w co drugim zagraniu (1., 3., 5.…)
const kumJ = id => KUM?.jokers.find(j => j.id === id && !(KUM.boss === 'mute' && KUM.jokers[0] === j) && kumAwake(j));
const kumHas = id => !!kumJ(id);
const kumIcon = s => `<span class="kum-ic">${s}</span>`;
const kumFree = () => KUM.slots - KUM.jokers.filter(j => j.e !== 'ghost').length;
const kumSell = j => Math.floor(KUM_J[j.id].p / 2) + (KUM_J[j.id].grows ? Math.floor((j.v || 0) / 2) : 0) + (j.e ? 1 : 0);
const kumJVal = j => j.id === 'grow' ? '+' + j.v : j.id === 'turtle' ? '+' + String(j.v / 2).replace('.', ',') : j.v;
const kumStats = () => (S.stats.kum = S.stats.kum || { runs: 0, best: 0, bestPts: 0, wins: 0 });
const kumCupMax = () => kumStats().cup || 0;
const kumTyping = () => KUM.kit === 'lang' || KUM.boss === 'type';
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
const kumCard = id => S.cards.find(c => c.id === id);
function kumKind(c) {
  if (!c) return { k: 'mid', base: 10, t: '' };
  if (c.srs.state === 'new') return { k: 'new', base: 20, t: 'nowa' };
  if (isLearning(c) || (c.srs.lapses || 0) >= 2) return { k: 'hard', base: 25, t: 'trudna' };
  if ((c.srs.ivl || 0) >= 7) return { k: 'mature', base: 10, t: 'utrwalona' };
  return { k: 'mid', base: 15, t: '' };
}
const kumHandSize = () => KUM_HAND - (KUM.boss === 'hand4' ? 1 : 0) + (kumHas('magnet') ? 1 : 0);
const kumMaxPlay = () => KUM.boss === 'two' ? 2 : KUM_MAX_PLAY;
function kumDraw() {
  const K = KUM; while (K.hand.length < kumHandSize()) { if (!K.deck.length) K.deck = shuffle(K.all.filter(id => !K.hand.includes(id))); const id = K.deck.shift(); if (id == null) break; if (!K.hand.includes(id)) K.hand.push(id); }
}
// typ zagrania z listy fiszek (dla podglądu: wszystkie wybrane; do punktów: tylko dobrze odpowiedziane)
function kumTypeOf(ids) {
  const n = ids.length; if (!n) return null;
  const cs = ids.map(kumCard), decks = new Set(cs.map(c => c?.deckId)), kinds = cs.map(kumKind);
  if (n === 3 && kinds.every(k => k.k === 'new' || k.k === 'hard')) return 'hard';
  if (n === 3 && decks.size === 3) return 'mix';
  if (n >= 2 && decks.size === 1) return 'same';
  return n === 3 ? 'triple' : n === 2 ? 'pair' : 'single';
}
const kumTypeVal = t => { const T = KUM_TYPES[t], L = KUM.levels[t] || 0; return { c: T.c + 10 * L, m: T.m + L, L }; };
// ---------- przed rundą: cel, egzaminator, bilet za pominięcie
function kumPrepRound() {
  const K = KUM;
  K.boss = kumIsBoss(K.round) ? shuffle(Object.keys(KUM_BOSSES).filter(b => !(K.kit === 'lang' && b === 'type')))[0] : null;
  K.ticket = K.boss ? null : shuffle(Object.keys(KUM_TICKETS))[0];
  K.phase = 'pre';
}
function kumStartRound() {
  const K = KUM;
  K.score = 0; K.plays = 3 + (K.kit === 'nerd' ? 1 : 0) + (kumHas('extra') ? 1 : 0) - (K.round === KUM_LAST ? 1 : 0);
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
  const x = { type, c: 0, m: 0, flawless };
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
  K.jokers.forEach(j => { if (j.id === 'turtle') j.v = flawless ? (j.v || 0) + 1 : 0; });
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
const kumDef = o => o.t === 'j' ? KUM_J[o.k] : o.t === 'p' ? KUM_PACKS[o.k] : KUM_I[o.k];
const kumPrice = o => o.free ? 0 : kumDef(o).p + (o.e ? KUM_ED[o.e].p : 0) - (o.sleepy ? 1 : 0) + (kumTier() >= 5 ? 1 : 0);
const kumRerollCost = () => KUM.freeRerolls > 0 ? 0 : 2 + KUM.rerolls + (kumTier() >= 5 ? 1 : 0);
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
  save(); K.phase = 'end'; K.result = { win: full, rounds, gold, xp }; render();
}

// ---------- widoki
function kumHead() {
  const K = KUM, t = kumTarget(K.round), B = K.boss && KUM_BOSSES[K.boss], inRound = ['pick', 'answer', 'scored'].includes(K.phase);
  return `<div class="kum-top"><button class="iconbtn" data-act="kum-quit" aria-label="Zakończ bieg">✕</button>${kumCupImg(K.tier, 'sm')}
    <div class="grow"><b>Runda ${K.round}${K.round <= KUM_LAST ? '/' + KUM_LAST : ' · bez końca'}</b>${inRound ? `<div class="kum-prog"><i style="width:${Math.min(100, K.score / t * 100)}%"></i></div><small>${K.score.toLocaleString('pl')} / ${t.toLocaleString('pl')} pkt</small>` : `<small>${KUM_CUPS[K.tier].n} · ${KUM_KITS[K.kit].ic} ${KUM_KITS[K.kit].n}</small>`}</div>
    <div class="kum-stats">${inRound ? `<span title="Zagrania">▶ ${K.plays}</span><span title="Wymiany">🔄 ${K.disc}</span>` : ''}<span title="Monety">🪙 ${K.money}</span></div></div>
  ${B && inRound ? `<div class="kum-boss">${kumIcon(B.ic)}<div><b>Egzaminator: ${B.n}</b><small>${B.d}</small></div></div>` : ''}
  <div class="kum-jokers">${K.jokers.map((j, i) => { const J = KUM_J[j.id], off = inRound && ((K.boss === 'mute' && i === 0) || !kumAwake(j));
    return `<button class="kum-j r-${J.r}${j.e ? ' ed-' + j.e : ''}${off ? ' muted' : ''}" data-act="kum-info" data-i="${i}" title="${esc(J.n)}">${kumIcon(J.ic)}${J.grows && j.v ? `<i class="kum-jv">${kumJVal(j)}</i>` : ''}${j.sleepy ? `<i class="kum-zz">${inRound && !kumAwake(j) ? '💤' : 'z'}</i>` : ''}${j.e ? `<i class="kum-ed">${KUM_ED[j.e].ic}</i>` : ''}</button>`; }).join('')}${Array(Math.max(0, kumFree())).fill('<span class="kum-j empty"></span>').join('')}
    <span class="kum-sep"></span>${K.items.map((k, i) => `<button class="kum-j item" data-act="kum-use" data-i="${i}" title="${esc(KUM_I[k].n)} – użyj">${kumIcon(KUM_I[k].ic)}</button>`).join('')}${Array(Math.max(0, KUM_ITEM_SLOTS - K.items.length)).fill('<span class="kum-j empty item"></span>').join('')}</div>`;
}
function kumCardHTML(id, sel) {
  const c = kumCard(id), v = c && cardView(c), kd = kumKind(c), d = c && deckById(c.deckId), st = KUM.stamps[id];
  return `<button class="kum-card${sel ? ' on' : ''} k-${kd.k}${st ? ' st-' + st : ''}" data-act="kum-sel" data-id="${id}"><span class="kum-val">${KUM.boss === 'nonew' && kd.k === 'new' ? 0 : kd.base}</span>${st ? `<span class="kum-stamp" title="Pieczątka ${KUM_STAMPS[st].n}">${KUM_STAMPS[st].ic}</span>` : ''}<span class="kum-q">${esc(stripHtml(v?.label || '').slice(0, 90))}</span><small>${esc((d?.name || '').replace(/^🏫\s*/, '').slice(0, 22))}${kd.t ? ' · ' + kd.t : ''}</small></button>`;
}
let KUM_KIT_SEL = 'classic', KUM_TIER_SEL = null;
function kumIntroHTML() {
  const st = kumStats(), decks = S.decks.filter(d => S.cards.some(c => c.deckId === d.id && !c.sus)), kit = KUM_KIT_SEL, max = Math.min(KUM_TOP, (st.cup || 0) + 1);
  const tier = Math.min(max, KUM_TIER_SEL || max), seen = st.seen || {}, nSeen = Object.keys(KUM_J).filter(k => seen[k]).length;
  return `<div class="row nowrap"><button class="iconbtn" data-go="#/boss">‹</button><h1 class="grow" style="margin:0">🃏 Kumulacja</h1><span class="tag">${IS_ADMIN ? 'admin' : 'test'}</span></div>
  <div class="card kum-intro"><p style="margin-top:0"><b>8 rund z rosnącym progiem.</b> Wybierz 1–3 fiszki z ręki, odpowiedz i zbieraj <b>(podstawa + wartości fiszek) × mnożnik</b>.</p>
    <details class="small"><summary><b>Zasady w skrócie</b></summary><ul>
      <li><b>Typ zagrania</b> daje podstawę i mnożnik: Pojedyncza, Dwójka, Trójka, Jedna talia (2–3 z tej samej), Przekrój (3 różne talie), Ciężka trójka (3 nowe/trudne). Liczą się tylko dobrze odpowiedziane fiszki.</li>
      <li>Fiszki mają wartość: trudna 25, nowa 20, zwykła 15, utrwalona 10. Wpisanie zamiast ABCD: ×1,5.</li>
      <li><b>Atuty</b> liczą się po kolei od lewej – ustaw kolejność w sklepie (najpierw „+”, potem „×”). Niektóre rosną, niektóre mają wykończenie: ✨ Brokat +30 podstawy, 🌈 Neon +5 mnożnika, 🥇 Złocenie ×1,5, 👻 Duch nie zajmuje miejsca.</li>
      <li><b>Koperty</b> w sklepie: otwierasz i wybierasz 1 z 3. <b>Podręczniki</b> podnoszą poziom typu zagrania, <b>pieczątki</b> zostają na fiszce do końca biegu.</li>
      <li>Przed zwykłą rundą możesz ją <b>pominąć</b> i wziąć bilet (nagrodę) – ale tracisz zarobek z rundy i sklep.</li>
      <li>Rundy 3, 6 i 8 prowadzi <b>Egzaminator</b> z utrudnieniem (+3 monety za wygraną).</li>
      <li>Plecak <b>⌨️ Poliglota</b>: same wpisywanie – najlepszy do języków.</li>
      <li>Zaległe fiszki liczą się jak powtórki.</li></ul></details>
    <p class="small muted" style="margin:12px 0 6px">🏆 Puchar, o który grasz:</p>
    <div class="kum-cups">${KUM_CUPS.slice(1).map((C, i) => { const t = i + 1, lock = t > max;
      return `<button class="kum-cupb${t === tier ? ' on' : ''}${lock ? ' lock' : ''}${t <= (st.cup || 0) ? ' won' : ''}" data-act="kum-tier" data-t="${t}" ${lock ? 'disabled' : ''}>${kumCupImg(t)}<small>${lock ? '🔒 ' : ''}${C.n}</small></button>`; }).join('')}</div>
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
const kumLevelsHTML = () => `<details class="kum-levels small"><summary>📘 Poziomy typów zagrań</summary>${Object.entries(KUM_TYPES).map(([k, T]) => { const v = kumTypeVal(k); return `<div class="row nowrap"><span class="grow">${T.n}${v.L ? ` <b>poz. ${v.L + 1}</b>` : ''}</span><span>${v.c} × ${v.m}</span></div>`; }).join('')}</details>`;
function kumPreHTML() {
  const K = KUM, t = kumTarget(K.round), B = K.boss && KUM_BOSSES[K.boss], T = K.ticket && KUM_TICKETS[K.ticket];
  return `${kumHead()}<div class="card kum-pre${B ? ' boss' : ''}">
    <div class="kum-pre-r">${B ? kumIcon(B.ic) : kumIcon('📝')}<div class="grow"><small>Runda ${K.round}${K.round === KUM_LAST ? ' · finał' : ''}</small><b>${B ? 'Egzaminator: ' + B.n : 'Zwykła runda'}</b>${B ? `<small>${B.d}</small>` : ''}</div></div>
    <div class="kum-pre-t">Cel: <b>${t.toLocaleString('pl')}</b> pkt</div>
    <button class="primary block" data-act="kum-go" style="min-height:50px">▶ Graj rundę</button>
    ${T ? `<div class="kum-ticket">${kumIcon(T.ic)}<div class="grow"><b>Bilet: ${T.n}</b><small>${T.d}</small></div><button class="sm" data-act="kum-skip">⏭ Pomiń rundę</button></div>
      <p class="small muted" style="margin:6px 0 0">Pominięcie = bez zarobku za rundę i bez sklepu, ale bilet jest Twój.</p>` : ''}</div>
  ${kumLevelsHTML()}`;
}
function kumPickHTML() {
  const K = KUM, t = kumTypeOf(K.sel), tv = t && kumTypeVal(t);
  return `${kumHead()}
  ${K.pendingStamp ? `<div class="kum-boss">${kumIcon(KUM_STAMPS[K.pendingStamp].ic)}<div><b>Stuknij fiszkę</b><small>Przybijesz na nią pieczątkę ${KUM_STAMPS[K.pendingStamp].n}</small></div></div>` : ''}
  <div class="kum-preview">${t ? `<b>${KUM_TYPES[t].n}${tv.L ? ` · poz. ${tv.L + 1}` : ''}</b><span class="kum-chips sm">${tv.c}</span>×<span class="kum-mult sm">${tv.m}</span>` : `<span class="muted">Wybierz 1–${kumMaxPlay()} fiszki · wartość w rogu</span>`}</div>
  <div class="kum-hand">${K.hand.map(id => kumCardHTML(id, K.sel.includes(id))).join('')}</div>
  <div class="kum-actions"><button class="primary grow" data-act="kum-play" ${K.sel.length ? '' : 'disabled'}>▶ Zagraj (${K.sel.length})</button>
    <button class="grow" data-act="kum-disc" ${K.sel.length && K.disc > 0 ? '' : 'disabled'}>🔄 Wymień (${K.disc})${K.boss === 'discpay' ? ' · 1 🪙' : ''}</button></div>
  ${kumLevelsHTML()}`;
}
function kumAnswerHTML() {
  const K = KUM, q = K.q[K.qi], c = kumCard(q.id), v = cardView(c), ans = v.ans;
  const opts = q.opts ? q.opts.map((o, i) => q.hidden.includes(i) ? '' : `<button class="abcd${q.res ? (norm(o) === norm(ans) ? ' right' : q.pick === i ? ' wrong' : '') : ''}" data-act="kum-opt" data-i="${i}" ${q.res ? 'disabled' : ''}><b>${'ABCD'[i]}</b> ${esc(o)}</button>`).join('') : '';
  return `${kumHead()}<div class="kum-qn">Fiszka ${K.qi + 1}/${K.q.length}${K.streak ? ` · 🔥 seria ${K.streak}` : ''}${K.shield ? ' · 🛡️ tarcza' : ''}${K.stamps[q.id] ? ' · ' + KUM_STAMPS[K.stamps[q.id]].ic : ''}${q.due ? ' · 🦉 zaległa' : ''}${K.boss === 'rush' ? ' · ⏱️ 15 s' : ''}</div>
  <div class="card flash qfit">${v.q}${q.letter ? `<div class="small muted" style="margin-top:8px">Zaczyna się na: <b>${esc(ans.trim().slice(0, 1).toUpperCase())}…</b></div>` : ''}</div>
  ${q.res ? `<div class="kum-res ${q.res.good ? 'ok' : 'bad'}">${q.res.saved === true ? '🛡️ Tarcza uratowała!' : q.res.saved === 'half' ? '🛟 Druga szansa – połowa wartości' : q.res.good ? (q.res.close ? `✓ Prawie – poprawnie: ${esc(ans)}` : '✓ Dobrze') : `${q.res.late ? '⏱️ Za późno! ' : '✗ '}Odpowiedź: ${esc(ans)}${q.res.lost ? ` · ⚠️ −${q.res.lost} pkt` : ''}`}</div>` : ''}
  ${q.mode === 'abcd' && !q.typing ? `<div class="abcd-grid">${opts}</div>${q.res ? '' : '<button class="ghost block" data-act="kum-type">✍️ Wpiszę odpowiedź (×1,5 wartości)</button>'}`
    : q.res ? '' : `<div class="row nowrap"><input id="kum-in" class="grow" placeholder="Wpisz odpowiedź…" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="primary" data-act="kum-send">✓</button></div>${q.opts ? '<button class="ghost block" data-act="kum-abcd">Wróć do ABCD</button>' : ''}`}`;
}
function kumScoredHTML() {
  const K = KUM, L = K.last, t = kumTarget(K.round);
  return `${kumHead()}<div class="card kum-score">
    <ul class="kum-steps">${L.steps.map((s, i) => `<li class="${s.bad ? 'bad' : ''}" style="animation-delay:${i * 120}ms"><span>${s.ic}</span><span class="grow">${esc(s.t)}</span><b>${esc(s.v)}</b></li>`).join('')}</ul>
    <div class="kum-eq" style="animation-delay:${L.steps.length * 120}ms">${L.type ? `<span class="kum-chips">${L.chips}</span><span class="kum-x">×</span><span class="kum-mult">${String(L.mult).replace('.', ',')}</span><span class="kum-x">=</span><b>${L.pts.toLocaleString('pl')}</b>` : '<b>0</b>'}</div>
    <p class="small muted center" style="margin:4px 0 10px">${L.good}/${L.n} dobrze${L.coins ? ` · +${L.coins} 🪙` : ''}</p>
    <button class="primary block" data-act="kum-next">${K.score >= t ? '🏁 Runda wygrana – dalej' : K.plays > 0 ? '▶ Następne zagranie' : K.jokers.some(j => j.id === 'phoenix') ? '🪶 Feniks…' : 'Koniec zagrań…'}</button></div>`;
}
function kumOfferHTML(o, i, act) {
  const K = KUM, D = kumDef(o), price = act === 'kum-buy' ? kumPrice(o) : 0;
  const full = o.t === 'j' ? kumFree() <= 0 && o.e !== 'ghost' : o.t === 'i' && !(D.book && act === 'kum-pack') ? K.items.length >= KUM_ITEM_SLOTS : false;
  const kind = o.t === 'j' ? 'atut ' + KUM_RAR[D.r].n : o.t === 'p' ? 'koperta' : D.book ? 'podręcznik' : D.stamp ? 'pieczątka' : 'pomoc';
  return `<div class="kum-off ${o.t === 'j' ? 'j r-' + D.r + (o.e ? ' ed-' + o.e : '') : o.t === 'p' ? 'p' : D.book ? 'b' : D.stamp ? 's' : 'i'}">${kumIcon(D.ic)}<b>${esc(D.n)}</b>
    ${o.e ? `<span class="kum-edtag">${KUM_ED[o.e].ic} ${KUM_ED[o.e].n}: ${KUM_ED[o.e].d}</span>` : ''}${o.sleepy ? '<span class="kum-edtag zz">💤 Senny: działa w co drugim zagraniu</span>' : ''}
    <small>${esc(D.d)}</small><button class="sm primary" data-act="${act}" data-i="${i}" ${full || K.money < price ? 'disabled' : ''}>${full ? 'Brak miejsca' : act === 'kum-buy' ? (o.free ? '🎟️ Za darmo' : `Kup · ${price} 🪙`) : 'Biorę'}</button><span class="kum-type">${kind}</span></div>`;
}
function kumShopHTML() {
  const K = KUM, rc = kumRerollCost(), slotP = 8 + (kumTier() >= 5 ? 1 : 0);
  return `${kumHead()}<div class="card kum-won"><b>🏁 Runda ${K.round} wygrana!</b> <span class="small muted">+${K.won.earn} 🪙 · odsetki +${K.won.interest}${K.won.dbl ? ' (🏦 ×2)' : ''}${K.won.bossBonus ? ` · egzaminator +${K.won.bossBonus}` : ''} 🪙</span></div>
  <h2 style="margin:10px 0 6px">🛒 Sklep</h2>
  <div class="kum-shop">${K.shop.map((o, i) => o.bought ? '<div class="kum-off sold">Kupione</div>' : kumOfferHTML(o, i, 'kum-buy')).join('')}
    ${!K.slotBought ? `<div class="kum-off i">${kumIcon('🧳')}<b>Większy plecak</b><small>+1 miejsce na atut (raz na bieg)</small><button class="sm primary" data-act="kum-slot" ${K.money >= slotP ? '' : 'disabled'}>Kup · ${slotP} 🪙</button><span class="kum-type">ulepszenie</span></div>` : ''}</div>
  ${K.jokers.length ? `<p class="small muted" style="margin:12px 0 4px">Twoje atuty – liczą się od lewej; przesuń ◀ ▶ albo sprzedaj:</p><div class="kum-owned">${K.jokers.map((j, i) => { const J = KUM_J[j.id];
    return `<div class="kum-own r-${J.r}${j.e ? ' ed-' + j.e : ''}">${kumIcon(J.ic)}<div class="grow"><b>${esc(J.n)}${J.grows && j.v ? ` · ${kumJVal(j)}` : ''}${j.e ? ` ${KUM_ED[j.e].ic}` : ''}${j.sleepy ? ' 💤' : ''}</b><small>${esc(J.d)}${j.e ? ` · ${KUM_ED[j.e].n}: ${KUM_ED[j.e].d}` : ''}</small></div>
      <button class="sm ghost" data-act="kum-move" data-i="${i}" data-d="-1" ${i ? '' : 'disabled'} aria-label="W lewo">◀</button><button class="sm ghost" data-act="kum-move" data-i="${i}" data-d="1" ${i < K.jokers.length - 1 ? '' : 'disabled'} aria-label="W prawo">▶</button>
      <button class="sm" data-act="kum-sell" data-i="${i}">Sprzedaj +${kumSell(j)} 🪙</button></div>`; }).join('')}</div>` : ''}
  ${K.items.length ? `<div class="kum-owned" style="margin-top:6px">${K.items.map((k, i) => `<button class="sm ghost" data-act="kum-sellitem" data-i="${i}">${KUM_I[k].ic} ${esc(KUM_I[k].n)} · sprzedaj +1 🪙</button>`).join('')}</div>` : ''}
  <div class="kum-actions"><button class="grow" data-act="kum-reroll" ${K.money >= rc ? '' : 'disabled'}>🎲 Nowa oferta · ${rc ? rc + ' 🪙' : `za darmo (${K.freeRerolls})`}</button><button class="primary grow" data-act="kum-nextround">▶ Dalej: runda ${K.round + 1}</button></div>`;
}
function kumPackHTML() {
  const K = KUM, P = K.pack, D = KUM_PACKS[P.kind];
  return `${kumHead()}<h2 style="margin:10px 0 6px">${D.ic} ${D.n}</h2><p class="small muted" style="margin:0 0 8px">Wybierz jedno.</p>
  <div class="kum-shop">${P.opts.map((o, i) => kumOfferHTML(o, i, 'kum-pack')).join('')}</div>
  <button class="ghost block" data-act="kum-packskip" style="margin-top:10px">Pomiń kopertę</button>`;
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
const KUM_ROTATE = `<div class="kum-rotate" role="dialog" aria-label="Obróć telefon"><div class="kum-rot-ph"><span>🃏</span></div><b>Obróć telefon poziomo</b><small>Kumulacja gra się na szerokim ekranie – karty, atuty i sklep mieszczą się wtedy w jednym rzędzie.</small><button class="ghost" data-act="kum-leave">‹ Wróć do Przygody</button></div>`;
function kumLock() { try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch { /* telefon nie pozwala – zostaje plansza */ } }
function kumUnlock() { try { screen.orientation?.unlock?.(); } catch { /* */ } }
ROUTES.kumul = () => {
  if (!kumAdmin()) return { tab: 'arena', html: '<p class="muted center" style="padding:40px 0">Ten tryb jest jeszcze w testach.</p>' };
  if (!KUM) return { tab: 'arena', html: KUM_ROTATE + kumIntroHTML() };
  const K = KUM, html = { pre: kumPreHTML, pick: kumPickHTML, answer: kumAnswerHTML, scored: kumScoredHTML, shop: kumShopHTML, pack: kumPackHTML, victory: kumVictoryHTML, end: kumEndHTML }[K.phase]();
  if (K.phase === 'answer') onMount(() => { const i = $('#kum-in'); if (i) { i.focus(); i.onkeydown = e => { if (e.key === 'Enter') ACTIONS['kum-send'](); }; } });
  return { tab: 'arena', focus: true, html: KUM_ROTATE + `<div class="kum">${html}</div>` };
};
// wejście w zakładce Przygoda – admin i testerzy
const kumBoss0 = ROUTES.boss;
ROUTES.boss = (...a) => { const v = kumBoss0(...a); if (typeof KUM_ROTATE !== 'undefined') kumUnlock(); if (!v?.html || !kumAdmin() || (a[0] && a[0][1])) return v; const st = S.stats.kum || {};
  return { ...v, html: v.html.replace('<div class="card row nowrap coop-cta"', `<div class="card row nowrap kum-cta" data-go="#/kumul"><span class="kum-cta-ic">🃏</span><div class="grow"><b>Kumulacja <span class="tag">${IS_ADMIN ? 'admin' : 'test'}</span></b><div class="small muted">8 rund · atuty, koperty, pieczątki · 7 pucharów${st.best ? ` · rekord: runda ${st.best}` : ''}</div></div>${st.cup ? kumCupImg(st.cup) : ''}<span>›</span></div><div class="card row nowrap coop-cta"`) }; };

Object.assign(ACTIONS, {
  'kum-kit': el => { KUM_KIT_SEL = el.dataset.k; render(); },
  'kum-tier': el => { KUM_TIER_SEL = +el.dataset.t; render(); },
  'kum-leave': () => { kumUnlock(); go('#/boss'); },
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
    else if (o.t === 'i') { if (K.items.length >= KUM_ITEM_SLOTS) return; K.items.push(o.k); }
    kumSpend(price); o.bought = true;
    if (o.t === 'p') return kumOpenPack(o.k, 'shop');
    toast(`${D.ic} ${D.n}`, 1500); render(); },
  'kum-pack': el => { const K = KUM, P = K.pack, o = P?.opts[+el.dataset.i]; if (!o) return; const D = kumDef(o);
    if (o.t === 'j') { if (kumFree() <= 0 && o.e !== 'ghost') return toast('Brak miejsca na atut'); kumAddJoker(o.k, o.e, o.sleepy); }
    else if (D.book) { kumLevelUp(D.book); toast(`📘 ${KUM_TYPES[D.book].n} – poziom ${K.levels[D.book] + 1}`, 2000); }
    else { if (K.items.length >= KUM_ITEM_SLOTS) return toast('Brak miejsca na pomoc'); K.items.push(o.k); }
    K.phase = P.ret; K.pack = null; render(); },
  'kum-packskip': () => { const K = KUM; if (!K?.pack) return; K.phase = K.pack.ret; K.pack = null; render(); },
  'kum-slot': () => { const K = KUM, p = 8 + (kumTier() >= 5 ? 1 : 0); if (K.slotBought || K.money < p) return; kumSpend(p); K.slots++; K.slotBought = true; render(); },
  'kum-move': el => { const K = KUM, i = +el.dataset.i, j = i + +el.dataset.d; if (j < 0 || j >= K.jokers.length) return; [K.jokers[i], K.jokers[j]] = [K.jokers[j], K.jokers[i]]; render(); },
  'kum-sell': el => { const K = KUM, i = +el.dataset.i, j = K.jokers[i]; if (!j) return; K.money += kumSell(j); K.jokers.splice(i, 1); render(); },
  'kum-sellitem': el => { const K = KUM, i = +el.dataset.i; if (K.items[i] == null) return; K.items.splice(i, 1); K.money += 1; render(); },
  'kum-reroll': () => { const K = KUM, rc = kumRerollCost(); if (K.money < rc) return; if (K.freeRerolls > 0) K.freeRerolls--; else { kumSpend(rc); K.rerolls++; } K.shop = kumShopRoll(); render(); },
  'kum-nextround': () => { KUM.round++; kumPrepRound(); render(); },
  'kum-endless': () => { const K = KUM; K.endless = true; K.phase = 'shop'; K.shop = kumShopRoll(); K.rerolls = 0; render(); },
  'kum-claim': () => kumEnd(true),
  'kum-use': el => { const K = KUM, i = +el.dataset.i, k = K.items[i]; if (!k) return; const D = KUM_I[k], q = K.phase === 'answer' ? K.q[K.qi] : null;
    if (k === 'half') { if (!q || q.res || !q.opts || q.mode !== 'abcd') return toast('Użyj podczas odpowiedzi ABCD'); const ans = cardView(kumCard(q.id)).ans; q.hidden = shuffle(q.opts.map((o, j) => j).filter(j => norm(q.opts[j]) !== norm(ans))).slice(0, 2); }
    else if (k === 'letter') { if (!q || q.res) return toast('Użyj podczas odpowiedzi'); q.letter = true; }
    else if (k === 'disc') { if (K.phase !== 'pick') return toast('Użyj przy wybieraniu fiszek'); K.disc++; }
    else if (k === 'shield') { if (K.shield) return toast('Tarcza już działa'); K.shield = true; }
    else if (D.book) { kumLevelUp(D.book); toast(`📘 ${KUM_TYPES[D.book].n} – poziom ${K.levels[D.book] + 1}`); K.items.splice(i, 1); return render(); }
    else if (D.stamp) { if (K.phase !== 'pick') return toast('Użyj przy wybieraniu fiszek – potem stuknij fiszkę'); K.pendingStamp = D.stamp; K.items.splice(i, 1); return render(); }
    K.items.splice(i, 1); toast(`${D.ic} ${D.n}`); render(); },
  'kum-info': el => { const j = KUM?.jokers[+el.dataset.i]; const J = j && KUM_J[j.id]; if (J) toast(`${J.ic} ${J.n} (${KUM_RAR[J.r].n}): ${J.d}${j.e ? ` · ${KUM_ED[j.e].ic} ${KUM_ED[j.e].n}: ${KUM_ED[j.e].d}` : ''}${j.sleepy ? ' · 💤 działa w co drugim zagraniu' : ''}`, 5000); },
  'kum-quit': () => { if (!KUM) return go('#/boss'); askBox({ icon: '🃏', title: 'Zakończyć bieg?', intro: 'Dostaniesz nagrodę za ukończone rundy.', ok: 'Zakończ', cancel: 'Graj dalej', danger: true }).then(ok => { if (ok && KUM && KUM.phase !== 'end') kumEnd(KUM.round > KUM_LAST); }); },
  'kum-again': () => { const d = KUM?.deckId || 'all', kit = KUM?.kit || 'classic', t = KUM?.tier || 1; KUM = null; kumStart(d, kit, t); },
  'kum-quit2': () => { KUM = null; kumUnlock(); go('#/boss'); },
});

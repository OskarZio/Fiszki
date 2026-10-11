'use strict';
/* Trening pamięci: gry w stylu Memory League (liczby, słowa, obrazy, karty),
   fonetyczny system liczbowy 00–99 i wykorzystanie pałaców pamięci jako trasy do zapamiętywania. */

// ============================================================ Dane
const PL_WORDS = `jabłko gruszka banan cytryna arbuz truskawka wiśnia ogórek marchew ziemniak cebula czosnek grzyb orzech chleb ser jajko masło miód
mleko kawa herbata zupa pizza ciasto lody czekolada cukierek kanapka kiełbasa rower samochód autobus pociąg samolot statek łódka rakieta helikopter
motocykl hulajnoga traktor taksówka karetka czołg balon spadochron kotwica kierownica opona most wieża zamek kościół latarnia namiot dom okno drzwi
schody komin dach płot studnia fontanna pomnik ławka huśtawka zjeżdżalnia piaskownica parasol kapelusz korona okulary zegarek pierścionek naszyjnik
szalik rękawiczka but skarpeta sukienka koszula krawat plecak walizka portfel klucz kłódka młotek śrubokręt piła siekiera łopata grabie wiadro miotła
nożyczki igła nitka guzik lustro grzebień szczoteczka mydło ręcznik wanna poduszka kołdra łóżko krzesło stół szafa lampa świeca żarówka telewizor
telefon komputer aparat radio gitara skrzypce bęben trąbka pianino mikrofon słuchawki książka zeszyt ołówek długopis linijka globus mapa kompas
lupa teleskop mikroskop magnes bateria piłka rakietka bramka puchar medal latawiec lalka miś klocki kostka szachy karta kości balon prezent
choinka bałwan sanki narty łyżwy pies kot koń krowa świnia owca koza kura kaczka gęś indyk królik mysz wiewiórka jeż lis wilk niedźwiedź jeleń dzik
lew tygrys słoń żyrafa zebra małpa wielbłąd kangur pingwin foka delfin rekin wieloryb ośmiornica krab ślimak motyl pszczoła biedronka mrówka pająk
wąż żółw żaba krokodyl papuga sowa orzeł bocian łabędź paw kogut róża tulipan słonecznik kaktus dąb sosna palma liść kasztan grzybobranie
wulkan góra rzeka jezioro wodospad wyspa pustynia jaskinia tęcza chmura błyskawica śnieg słońce księżyc gwiazda kometa planeta ogień lód kamień
diament złoto perła muszla piórko kwiat drzewo trawa`.split(/\s+/).filter((w, i, a) => w && a.indexOf(w) === i);
const EMOJI_POOL = `🍎 🍌 🍇 🍉 🍓 🍒 🍍 🥥 🥝 🍅 🥕 🌽 🥦 🍄 🥜 🍞 🧀 🥚 🍕 🍔 🌭 🍟 🍩 🍪 🎂 🍫 🍭 🍯 🥛 ☕ 🍺 🍷 🥄 🔪 🌋 🗻 🏠 🏰 ⛪ 🗼 🗽 ⛲ ⛺ 🎡 🎢 🚂 🚑 🚒 🚓 🚕 🚌 🚲 🛴 🏍️ 🚁 ✈️ 🚀 🛸 ⛵ ⚓ ⛽ 🚦 🧳 ⌛ ⏰ 🌡️ 🌙 ⭐ ☀️ ☂️ ⚡ ❄️ ☃️ 🔥 💧 🌊 🎃 🎄 🎆 🎈 🎁 🏆 ⚽ 🏀 🏈 🎾 🎱 🎳 ⛳ 🎣 🥊 🎿 🛷 🎯 🎮 🎲 🧩 🧸 ♟️ 🎭 🎨 🧶 👓 👔 👕 👖 🧣 🧤 🧥 🧦 👗 👜 🎒 👟 👠 👑 🎩 🎓 💄 💍 💎 📢 🔔 🎸 🎺 🎻 🥁 📱 💻 🖨️ 💾 📷 🎥 📺 📻 🔦 🕯️ 💡 📚 ✏️ 🖌️ 📌 📎 ✂️ 🔒 🔑 🔨 ⛏️ 🔧 ⚙️ 🧲 🧪 🔭 🔬 💉 💊 🚪 🛏️ 🛋️ 🚽 🛁 🧹 🧺 🧻 🧼 🧯 🛒 🐶 🐱 🐭 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐜 🕷️ 🐢 🐍 🦎 🐙 🦀 🐬 🐳 🦈 🐊 🦓 🦒 🐘 🦏 🐪 🦘 🐑 🦌 🦃 🦚 🦜 🦢 🌵 🌴 🌱 🍀 🍁 🌷 🌹 🌻`.split(/\s+/).filter((w, i, a) => w && a.indexOf(w) === i);
const SUITS = [['♠', 0], ['♥', 1], ['♦', 1], ['♣', 0]];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const DECK = SUITS.flatMap(([s]) => RANKS.map(r => r + s));
const cardHTML = c => `<span class="pcard${/[♥♦]/.test(c) ? ' red' : ''}">${c.replace(/(.+)(.)$/, '<b>$1</b>$2')}</span>`;

// Fonetyczny system liczbowy (wersja polska): spółgłoski → cyfry, samogłoski i inne litery się nie liczą.
const MAJOR_TABLE = [['0', 's, z (ś, ź)'], ['1', 't, d'], ['2', 'n (ń)'], ['3', 'm'], ['4', 'r'], ['5', 'l'], ['6', 'j, sz, cz, ż, dż'], ['7', 'k, g'], ['8', 'w, f'], ['9', 'p, b']];
const MAJOR_SUGGEST = ('sos sad sen sum ser sól soja sok sowa zupa doza tata tona dom tor talia tuja dog diwa tuba nos nuty nana nemo nora nil naja noga nawa niebo ' +
  'mus miód mina mama mur mol maja mak mewa mop rosa rodeo rana rum rura rola raj rak rów ryba las lód lina lama lira lala olej lek lew lupa ' +
  'jaz jad jen jama jar jola jaja jak jawa jeep kosa kot koń guma kura kula kij kakao kawa kupa waza wata wino wymię wór fala wieża waga fifa fobia ' +
  'pies but pień puma pióro bal boja buk paw bobo').split(' ');
function wordDigits(word) {
  let w = String(word).toLowerCase().replace(/dż|dź/g, '6').replace(/sz|cz|ż|rz/g, '6').replace(/ch|h|c|ć|ł|x|q|v/g, '');
  const map = { s: 0, z: 0, ś: 0, ź: 0, t: 1, d: 1, n: 2, ń: 2, m: 3, r: 4, l: 5, j: 6, '6': 6, k: 7, g: 7, w: 8, f: 8, p: 9, b: 9 };
  let out = ''; for (const ch of w) if (ch in map) out += map[ch];
  return out;
}
const pad2 = n => String(n).padStart(2, '0');
const majorWord = nn => (S.major.words || {})[nn] || '';

// ============================================================ Dyscypliny
const DISC = {
  numbers: { name: 'Liczby', icon: '🔢', unit: 'cyfr', levels: [[20, 60], [40, 60], [80, 60], [120, 120]], group: 2,
    gen: n => Array.from({ length: n }, () => String(Math.random() * 10 | 0)), tile: x => x },
  words: { name: 'Słowa', icon: '📝', unit: 'słów', levels: [[10, 60], [25, 60], [50, 60], [50, 120]], group: 1,
    gen: n => shuffle([...PL_WORDS]).slice(0, n), tile: x => esc(x) },
  images: { name: 'Obrazy', icon: '🖼️', unit: 'obrazów', levels: [[10, 60], [20, 60], [30, 60], [60, 120]], group: 3,
    gen: n => shuffle([...EMOJI_POOL]).slice(0, n), tile: x => x },
  cards: { name: 'Karty', icon: '🃏', unit: 'kart', levels: [[13, 120], [26, 120], [52, 180], [52, 120]], group: 2,
    gen: n => shuffle([...DECK]).slice(0, n), tile: cardHTML },
};
const LEVEL_NAMES = ['Łatwy', 'Średni', 'Liga', 'Mistrz', 'Własny'];
const MAX_ITEMS = { numbers: 1000, words: PL_WORDS.length, images: EMOJI_POOL.length, cards: 52 };
// [liczba elementów, czas zapamiętywania w s (0 = bez limitu)] dla wybranego poziomu
function levelNT(d) {
  const ms = memSettings(), lv = ms[d] ?? 0, D = DISC[d];
  if (lv === 4) { const c = ms.custom?.[d] || {}; return [clamp(+c.n || D.levels[0][0], 1, MAX_ITEMS[d]), clamp(c.t ?? D.levels[0][1], 0, 3600)]; }
  return D.levels[lv];
}
let GAME = null, gameTimer = null;
const memSettings = () => (S.settings.mem = S.settings.mem || {});
const personalBest = (d, n) => S.games.filter(g => g.d === d && g.n === n && !g.practice)
  .sort((a, b) => b.correct - a.correct || a.memoMs - b.memoMs)[0];
const fmtTime = ms => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function palaceLoci(pid) {
  const p = palaceById(pid); if (!p) return [];
  return p.stations.flatMap((s, si) => s.pins.map((pin, pi) => ({ s, pin, label: pin.assoc || s.name || `Miejsce ${si + 1}`, n: pi })));
}

// ============================================================ Trening (ekran główny)
ROUTES.train = () => {
  const filled = Object.values(S.major.words || {}).filter(w => w?.trim()).length;
  const pins = S.palaces.reduce((a, p) => a + p.stations.reduce((b, s) => b + s.pins.length, 0), 0);
  const w = S.battles.filter(b => b.won === 1).length;
  return { tab: 'train', html: `<h1>Trening pamięci</h1>
  <div class="card hero-card battle-cta" data-go="#/battles"><div class="row nowrap"><span style="font-size:44px">⚔️</span>
    <div class="grow"><b style="font-size:19px">Bitwy 1 na 1</b><div class="small">Rywalizuj ze znajomymi lub losowym graczem · ${w} ${plural(w, 'wygrana', 'wygrane', 'wygranych')} · 💎 ${coins()}</div></div><span style="font-size:22px">›</span></div></div>
  <div class="card"><h2 style="margin-top:0">🎮 Gry pamięciowe</h2>
    <p class="small muted">Zapamiętaj jak najwięcej w krótkim czasie, potem odtwórz w tej samej kolejności – jak w Memory League.</p>
    <div class="discs">${Object.entries(DISC).map(([k, d]) => {
      const [n] = levelNT(k), pb = personalBest(k, n);
      return `<button class="disc" data-go="#/game/${k}"><span class="di">${d.icon}</span><b>${d.name}</b>
        <small>${pb ? `rekord: ${pb.correct}/${n} · ${fmtTime(pb.memoMs)}` : 'brak rekordu'}</small></button>`;
    }).join('')}</div></div>
  <div class="card"><h2 style="margin-top:0">🔢 System liczbowy</h2>
    <p class="small muted">Każdej liczbie 00–99 przypisz obraz (np. 37 = <b>mak</b>). Dzięki temu długi ciąg cyfr zamieniasz w historyjkę obrazów w pałacu pamięci.</p>
    <div class="row small"><span class="grow">Uzupełnione obrazy: <b>${filled}/100</b></span></div>${progress(filled / 100, true)}
    <div class="spacer"></div><div class="row"><button class="primary grow" data-go="#/major">Otwórz system</button><button class="grow" data-go="#/major?drill=1" ${filled ? '' : 'disabled'}>⚡ Szybki trening</button></div></div>
  <div class="card row nowrap" data-go="#/atlas" style="cursor:pointer"><span style="font-size:34px">🫀</span><div class="grow"><b>Atlas – ryciny</b>
    <div class="small muted">nazywanie, wskazywanie i rysowanie struktur z pamięci</div></div><span>›</span></div>
  <div class="card"><h2 style="margin-top:0">🏛️ Pałace pamięci</h2>
    <p class="small muted">${S.palaces.length} ${plural(S.palaces.length, 'pałac', 'pałace', 'pałaców')} · ${pins} ${plural(pins, 'pinezka', 'pinezki', 'pinezek')}. Pinezki możesz wykorzystać jako trasę (loci) w grach – w ustawieniach gry wybierz pałac.</p>
    <button class="block" data-go="#/palaces">Otwórz pałace</button></div>
  <div class="card small muted"><b>Jak trenować?</b><ol class="steps">
    <li>Naucz się systemu liczbowego (00–99) i zrób z niego fiszki.</li>
    <li>Zbuduj pałac z 20–40 pinezkami na znanej trasie.</li>
    <li>W grze „Liczby” zamieniaj pary cyfr na obrazy i kładź je kolejno na pinezkach.</li>
    <li>Codziennie jedna–dwie gry – rekordy rosną szybciej, niż myślisz.</li></ol></div>` };
};

// ============================================================ Gra
ROUTES.game = parts => {
  const d = parts[1], D = DISC[d];
  if (!D) return { html: '<p><a href="#/train">Wróć</a></p>', tab: 'train' };
  if (!GAME || GAME.d !== d) GAME = { d, phase: 'setup' };
  const G = GAME;
  if (G.phase === 'setup') return { tab: 'train', html: gameSetup(d, D) };
  if (G.phase === 'memo') { onMount(mountGameTimer); return { focus: true, html: gameMemo(G, D) }; }
  if (G.phase === 'recall') { onMount(mountGameTimer); return { focus: true, html: gameRecall(G, D) }; }
  return { tab: 'train', html: gameResult(G, D) };
};
function gameSetup(d, D) {
  const ms = memSettings(), lv = ms[d] ?? 0, [n, t] = levelNT(d), pb = personalBest(d, n), cu = ms.custom?.[d] || {};
  const hist = S.games.filter(g => g.d === d).slice(-8).reverse();
  const palId = ms.palace || '';
  return `<div class="row nowrap"><button class="iconbtn" data-go="#/train">‹</button><h1 class="grow">${D.icon} ${D.name}</h1></div>
  <div class="card">
    <h3 style="margin-top:0">Poziom</h3>
    <div class="lvlgrid">${[...D.levels, null].map((l, i) => `<button class="${i === lv ? 'on' : ''}" data-act="game-level" data-d="${d}" data-i="${i}"><b>${LEVEL_NAMES[i]}</b><small>${l ? `${l[0]} · ${l[1]} s` : 'ustaw sam'}</small></button>`).join('')}</div>
    ${lv === 4 ? `<div class="row nowrap"><label class="field grow"><span>Ile ${D.unit} (1–${MAX_ITEMS[d]})</span><input type="number" inputmode="numeric" min="1" max="${MAX_ITEMS[d]}" data-memcustom="n" value="${cu.n ?? n}"></label>
      <label class="field grow"><span>Czas (s, 0 = bez limitu)</span><input type="number" inputmode="numeric" min="0" max="3600" data-memcustom="t" value="${cu.t ?? t}"></label></div>` : ''}
    <p class="small muted">Zapamiętaj <b>${n} ${D.unit}</b> ${t ? `w <b>${t} s</b>` : '<b>bez limitu czasu</b> (liczy się, jak szybko skończysz)'}, potem odtwórz je w tej samej kolejności.</p>
    <details class="more-opts"><summary>Więcej opcji</summary>
    <label class="field"><span>Grupuj po (ile elementów na jeden obraz/locus)</span>
      <select data-memopt="group">${[1, 2, 3, 4, 6].map(g => `<option value="${g}" ${(ms.group?.[d] ?? D.group) === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
    <label class="field"><span>Trasa z pałacu pamięci (opcjonalnie)</span>
      <select data-memopt="palace"><option value="">— bez pałacu —</option>${S.palaces.map(p => `<option value="${p.id}" ${palId === p.id ? 'selected' : ''}>${esc(p.name)} (${palaceLoci(p.id).length} pinezek)</option>`).join('')}</select></label>
    ${d === 'numbers' ? `<label class="check"><input type="checkbox" data-memopt="hints" ${ms.hints ? 'checked' : ''}> Pokazuj podpowiedzi z systemu liczbowego (tryb nauki – bez rekordu)</label>` : ''}
    </details>
    <button class="primary block" data-act="game-start" data-d="${d}" style="min-height:54px">▶ Start</button>
    ${pb ? `<p class="center small">🏆 Rekord: <b>${pb.correct}/${n}</b> w ${fmtTime(pb.memoMs)}</p>` : ''}
  </div>
  ${hist.length ? `<div class="card"><h3 style="margin-top:0">Ostatnie gry</h3>${hist.map(g => `<div class="kv"><span>${new Date(g.t).toLocaleDateString('pl')} · ${g.n} ${D.unit}${g.practice ? ' · nauka' : ''}</span><b>${g.correct}/${g.n} · ${fmtTime(g.memoMs)}</b></div>`).join('')}</div>` : ''}`;
}
function groupsOf(G) { const out = []; for (let i = 0; i < G.items.length; i += G.group) out.push([i, Math.min(G.items.length, i + G.group)]); return out; }
function gameMemo(G, D) {
  const gs = groupsOf(G), [a, b] = gs[G.pos];
  const spot = G.items.slice(a, b);
  let hint = '';
  if (G.hints && G.d === 'numbers') {
    const pairs = []; for (let i = 0; i + 1 < spot.length; i += 2) pairs.push(spot[i] + spot[i + 1]);
    hint = pairs.map(p => `${p} = <b>${esc(majorWord(p) || MAJOR_SUGGEST[+p])}</b>`).join(' · ');
  }
  let locus = '';
  if (G.loci.length) {
    const L = G.loci[G.pos % G.loci.length];
    locus = `<div class="locus">${occlHTML({ imageId: L.s.imageId, style: 'pin', boxes: L.s.pins }, L.pin.id, false, 'mini')}<span>📍 ${G.pos + 1}. ${esc(L.label)}</span></div>`;
  }
  return `${G.battle ? '' : `<div class="studybar"><button class="iconbtn" data-act="game-quit">✕</button><div class="title">${D.icon} Zapamiętuj</div>
    <b id="gtimer" class="timer">${G.t ? G.t + "s" : "0:00"}</b></div>`}
    ${progress((G.pos + 1) / gs.length, true)}
    <div class="spot ${G.d}">${spot.map(D.tile).map(x => `<span>${x}</span>`).join('')}</div>
    ${hint ? `<div class="hintbox center">${hint}</div>` : ''}${locus}
    <div class="row nowrap"><button class="grow" data-act="game-nav" data-dlt="-1" ${G.pos ? '' : 'disabled'} style="min-height:56px">‹</button>
      <span class="small muted" style="min-width:70px;text-align:center">${G.pos + 1}/${gs.length}</span>
      <button class="primary grow" data-act="game-nav" data-dlt="1" ${G.pos < gs.length - 1 ? '' : 'disabled'} style="min-height:56px">›</button></div>
    <div class="grid-items ${G.d}">${gs.map(([x, y], gi) => `<span class="grp${gi === G.pos ? ' cur' : ''}" data-act="game-jump" data-g="${gi}">${G.items.slice(x, y).map(D.tile).join(G.d === 'numbers' ? '' : ' ')}</span>`).join('')}</div>
    <div class="spacer"></div><button class="block" data-act="game-recall">✅ Gotowe – przejdź do odtwarzania</button>`;
}
function gameRecall(G, D) {
  const head = G.battle ? '' : `<div class="studybar"><button class="iconbtn" data-act="game-quit">✕</button><div class="title">${D.icon} Odtwórz</div><b id="gtimer" class="timer">0:00</b></div>`;
  if (G.d === 'numbers') {
    return head + `<p class="small muted center">Wpisz cyfry po kolei. Stuknij pole, aby je poprawić.</p>
      <div class="digits">${G.answer.map((v, i) => `<span class="dg${i === G.cursor ? ' cur' : ''}${i % 10 === 9 ? ' brk' : ''}" data-act="rc-cursor" data-i="${i}">${v ?? ''}</span>`).join('')}</div>
      <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => `<button data-act="rc-key" data-k="${k}">${k}</button>`).join('')}
        <button data-act="rc-key" data-k="back">⌫</button><button data-act="rc-key" data-k="0">0</button><button data-act="rc-key" data-k="skip">→</button></div>
      <button class="primary block" data-act="game-finish">Zakończ i sprawdź</button>`;
  }
  const used = new Set(G.answer.filter(v => v != null));
  return head + `<p class="small muted center">Stuknij elementy w kolejności, w jakiej je widziałeś. Stuknij pozycję, aby ją wyczyścić.</p>
    <div class="slots ${G.d}">${G.answer.map((v, i) => `<span class="slot${i === G.cursor ? ' cur' : ''}" data-act="rc-slot" data-i="${i}"><i>${i + 1}</i>${v != null ? D.tile(G.pool[v]) : ''}</span>`).join('')}</div>
    <div class="pool ${G.d}">${G.pool.map((x, i) => `<button class="${used.has(i) ? 'used' : ''}" data-act="rc-pick" data-i="${i}" ${used.has(i) ? 'disabled' : ''}>${D.tile(x)}</button>`).join('')}</div>
    <div class="spacer"></div><button class="primary block" data-act="game-finish">Zakończ i sprawdź</button>`;
}
function gameResult(G, D) {
  const pb = personalBest(G.d, G.n);
  const isPB = !G.practice && pb && pb.id === G.saved?.id;
  const pct = Math.round(G.correct / G.n * 100);
  const cells = G.items.map((x, i) => {
    const given = G.d === 'numbers' ? G.answer[i] : G.answer[i] != null ? G.pool[G.answer[i]] : null;
    const ok = given === x;
    return `<span class="res ${ok ? 'ok' : 'bad'}" title="${i + 1}">${D.tile(x)}${ok ? '' : `<small>${given != null ? D.tile(given) : '–'}</small>`}</span>`;
  }).join('');
  return `<div class="row nowrap"><button class="iconbtn" data-act="game-again">‹</button><h1 class="grow">${D.icon} Wynik</h1></div>
    <div class="card center"><div class="score">${G.correct}<small style="font-size:24px">/${G.n}</small></div>
      <p>${pct === 100 ? '🏆 Bezbłędnie!' : pct >= 80 ? '🔥 Świetnie!' : pct >= 50 ? '👍 Dobrze!' : '💪 Ćwicz dalej!'} · zapamiętywanie ${fmtTime(G.memoMs)} · odtwarzanie ${fmtTime(G.recallMs)}</p>
      ${G.practice ? '<p class="small muted">Tryb nauki (z podpowiedziami) – wynik nie liczy się do rekordu.</p>' : isPB ? '<p><b>🎉 Nowy rekord!</b></p>' : pb ? `<p class="small muted">Rekord: ${pb.correct}/${G.n} w ${fmtTime(pb.memoMs)}</p>` : ''}</div>
    <div class="card"><h3 style="margin-top:0">Porównanie</h3><p class="small muted">Zielone – dobrze, czerwone – pod spodem Twoja odpowiedź.</p><div class="results ${G.d}">${cells}</div></div>
    <div class="row"><button class="primary grow" data-act="game-start" data-d="${G.d}">🔁 Jeszcze raz</button><button class="grow" data-act="game-again">Ustawienia</button></div>`;
}
function mountGameTimer() {
  clearInterval(gameTimer);
  const tick = () => {
    const G = GAME, el = $('#gtimer'); if (!G || !el) return clearInterval(gameTimer);
    if (G.phase === 'memo' && !G.t) el.textContent = fmtTime(Date.now() - G.start);
    else if (G.phase === 'memo') {
      const left = Math.max(0, G.t * 1000 - (Date.now() - G.start));
      el.textContent = Math.ceil(left / 1000) + 's'; el.classList.toggle('warn', left < 10000);
      if (left <= 0) ACTIONS['game-recall']();
    } else if (G.phase === 'recall') el.textContent = fmtTime(Date.now() - G.recallStart);
  };
  tick(); gameTimer = setInterval(tick, 250);
}
function finishGame() {
  if (GAME.battle) return battleMemFinish();
  const G = GAME; clearInterval(gameTimer);
  G.recallMs = Date.now() - G.recallStart;
  G.correct = G.items.reduce((a, x, i) => a + ((G.d === 'numbers' ? G.answer[i] : G.answer[i] != null ? G.pool[G.answer[i]] : null) === x ? 1 : 0), 0);
  G.saved = { id: uid(), d: G.d, n: G.n, correct: G.correct, memoMs: G.memoMs, recallMs: G.recallMs, t: Date.now(), practice: !!G.practice };
  S.games.push(G.saved); G.phase = 'result'; save(); emit('game', G.saved);
  if (G.correct === G.n) confetti(150);
  render(); scrollTo(0, 0);
}
document.addEventListener('keydown', e => {
  if (!GAME || !['game', 'battle'].includes(parseRoute().parts[0]) || e.target.matches('input, textarea, select')) return;
  if (GAME.phase === 'memo') {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); ACTIONS['game-nav']({ dataset: { dlt: 1 } }); }
    if (e.key === 'ArrowLeft') ACTIONS['game-nav']({ dataset: { dlt: -1 } });
  } else if (GAME.phase === 'recall' && GAME.d === 'numbers') {
    if (/^\d$/.test(e.key)) ACTIONS['rc-key']({ dataset: { k: e.key } });
    if (e.key === 'Backspace') ACTIONS['rc-key']({ dataset: { k: 'back' } });
    if (e.key === 'ArrowRight') ACTIONS['rc-key']({ dataset: { k: 'skip' } });
    if (e.key === 'ArrowLeft') { GAME.cursor = Math.max(0, GAME.cursor - 1); render(); }
    if (e.key === 'Enter') finishGame();
  }
});
document.addEventListener('change', e => {
  if (e.target.dataset?.memcustom) {
    const ms = memSettings(), d = parseRoute().parts[1]; ms.custom = ms.custom || {}; ms.custom[d] = ms.custom[d] || {};
    ms.custom[d][e.target.dataset.memcustom] = +e.target.value; save(); render(); return;
  }
  const k = e.target.dataset?.memopt; if (!k) return;
  const ms = memSettings(), d = parseRoute().parts[1];
  if (k === 'group') { ms.group = ms.group || {}; ms.group[d] = +e.target.value; }
  else if (k === 'hints') ms.hints = e.target.checked;
  else ms[k] = e.target.value;
  save();
});

Object.assign(ACTIONS, {
  'game-level': el => { memSettings()[el.dataset.d] = +el.dataset.i; save(); render(); },
  'game-start': el => {
    const d = el.dataset.d, D = DISC[d], ms = memSettings(), [n, t] = levelNT(d);
    const items = D.gen(n);
    GAME = { d, n, t, items, phase: 'memo', group: ms.group?.[d] ?? D.group, pos: 0, start: Date.now(),
      loci: ms.palace ? palaceLoci(ms.palace) : [], hints: d === 'numbers' && !!ms.hints, practice: d === 'numbers' && !!ms.hints };
    render(); scrollTo(0, 0);
  },
  'game-nav': el => { const gs = groupsOf(GAME); GAME.pos = clamp(GAME.pos + +el.dataset.dlt, 0, gs.length - 1); render(); },
  'game-jump': el => { GAME.pos = +el.dataset.g; render(); },
  'game-recall': () => {
    const G = GAME; if (!G || G.phase !== 'memo') return;
    G.memoMs = G.t ? Math.min(G.t * 1000, Date.now() - G.start) : Date.now() - G.start; G.phase = 'recall'; G.recallStart = Date.now(); G.cursor = 0;
    G.answer = Array(G.n).fill(null);
    if (G.d !== 'numbers') G.pool = shuffle([...G.items]);
    emit('gameRecallStart');
    render(); scrollTo(0, 0);
  },
  'rc-key': el => {
    const G = GAME, k = el.dataset.k;
    if (k === 'back') { if (G.answer[G.cursor] == null && G.cursor > 0) G.cursor--; G.answer[G.cursor] = null; }
    else if (k === 'skip') G.cursor = Math.min(G.n - 1, G.cursor + 1);
    else { G.answer[G.cursor] = k; G.cursor = Math.min(G.n - 1, G.cursor + 1); }
    render();
  },
  'rc-cursor': el => { GAME.cursor = +el.dataset.i; render(); },
  'rc-pick': el => {
    const G = GAME; G.answer[G.cursor] = +el.dataset.i;
    const next = G.answer.findIndex((v, i) => v == null && i > G.cursor);
    G.cursor = next >= 0 ? next : Math.max(0, G.answer.indexOf(null)); render();
  },
  'rc-slot': el => { const G = GAME, i = +el.dataset.i; G.answer[i] = null; G.cursor = i; render(); },
  'game-finish': () => {
    const empty = GAME.answer.filter(v => v == null).length;
    if (empty && !confirm(`Nie uzupełniono ${empty} ${plural(empty, 'pozycji', 'pozycji', 'pozycji')}. Zakończyć?`)) return;
    finishGame();
  },
  'game-quit': () => { if (confirm('Przerwać grę?')) { clearInterval(gameTimer); GAME.phase = 'setup'; render(); } },
  'game-again': () => { GAME.phase = 'setup'; render(); },
});

// ============================================================ System liczbowy 00–99
let DRILL = null;
ROUTES.major = (parts, q) => {
  if (q.get('drill')) return { tab: 'train', focus: true, html: majorDrill() };
  const words = S.major.words || {};
  onMount(() => {
    $$('[data-major]').forEach(inp => inp.addEventListener('input', () => {
      S.major.words = S.major.words || {}; S.major.words[inp.dataset.major] = inp.value.trim(); S.major.mod = Date.now(); save();
      const ok = !inp.value.trim() || wordDigits(inp.value) === inp.dataset.major;
      inp.classList.toggle('warn', !ok);
    }));
    const conv = $('#major-conv');
    conv?.addEventListener('input', () => {
      const v = conv.value.trim(); let out = '';
      if (/^\d+$/.test(v)) { const pairs = v.match(/\d{1,2}/g); out = pairs.map(p => `<b>${p}</b> ${esc(p.length === 2 ? majorWord(p) || MAJOR_SUGGEST[+p] : '…')}`).join(' → '); }
      else if (v) out = `„${esc(v)}” = <b>${wordDigits(v) || '—'}</b>`;
      $('#major-out').innerHTML = out;
    });
  });
  return { tab: 'train', html: `
  <div class="row nowrap"><button class="iconbtn" data-go="#/train">‹</button><h1 class="grow">System liczbowy</h1></div>
  <div class="card"><p class="small" style="margin-top:0">Każda cyfra to spółgłoska. Dokładasz dowolne samogłoski i tworzysz słowo-obraz. Np. <b>37</b> = m+k = <b>mak</b>, <b>71</b> = k+t = <b>kot</b>.</p>
    <div class="majtab">${MAJOR_TABLE.map(([d, l]) => `<span><b>${d}</b>${l}</span>`).join('')}</div>
    <p class="small muted">Samogłoski oraz h, ch, c, ł się nie liczą. Pola z ⚠️ nie pasują do systemu – to nic złego, jeśli obraz dobrze Ci się kojarzy.</p></div>
  <div class="card"><label class="field" style="margin-top:0"><span>Konwerter: wpisz liczbę albo słowo</span><input id="major-conv" placeholder="np. 3714 albo „makaron”"></label><div id="major-out" class="small"></div></div>
  <div class="row"><button class="grow" data-act="major-fill">✨ Uzupełnij propozycjami</button><button class="grow" data-act="major-deck">🃏 Zrób fiszki 00–99</button></div>
  <div class="spacer"></div>
  <button class="primary block" data-go="#/major?drill=1">⚡ Szybki trening</button>
  <div class="majgrid">${Array.from({ length: 100 }, (_, i) => { const k = pad2(i), w = words[k] || ''; const bad = w && wordDigits(w) !== k;
    return `<label><b>${k}</b><input data-major="${k}" class="${bad ? 'warn' : ''}" value="${esc(w)}" placeholder="${esc(MAJOR_SUGGEST[i])}" autocapitalize="off"></label>`; }).join('')}</div>` };
};
function majorDrill() {
  const words = S.major.words || {};
  const keys = Object.keys(words).filter(k => words[k]);
  if (!keys.length) return `<p>Najpierw uzupełnij obrazy. <a href="#/major">Wróć</a></p>`;
  if (!DRILL) DRILL = { mode: 'num', k: null, shown: false, n: 0, ok: 0, t0: Date.now(), times: [] };
  if (!DRILL.k) { DRILL.k = keys[Math.random() * keys.length | 0]; DRILL.shown = false; DRILL.t0 = Date.now(); }
  const q = DRILL.mode === 'num' ? DRILL.k : words[DRILL.k], a = DRILL.mode === 'num' ? words[DRILL.k] : DRILL.k;
  const avg = DRILL.times.length ? (DRILL.times.reduce((x, y) => x + y, 0) / DRILL.times.length / 1000).toFixed(1) : '–';
  return `<div class="studybar"><button class="iconbtn" data-act="drill-end">✕</button><div class="title">⚡ System liczbowy</div>
    <div class="seg"><button class="${DRILL.mode === 'num' ? 'on' : ''}" data-act="drill-mode" data-m="num">12→</button><button class="${DRILL.mode === 'word' ? 'on' : ''}" data-act="drill-mode" data-m="word">→12</button></div></div>
    <p class="small muted center">Wynik: ${DRILL.ok}/${DRILL.n} · średni czas: ${avg} s</p>
    <div class="card flash"><div style="font-size:64px;font-weight:800">${esc(q)}</div>${DRILL.shown ? `<hr><div style="font-size:30px">${esc(a)}</div>` : ''}</div>
    <div class="answerbar">${DRILL.shown
      ? `<div class="row nowrap"><button class="g1 grow" style="color:#fff;min-height:56px" data-act="drill-next" data-ok="0">Nie wiedziałem</button><button class="g3 grow" style="color:#fff;min-height:56px" data-act="drill-next" data-ok="1">Wiedziałem</button></div>`
      : `<button class="primary block" data-act="drill-show" style="min-height:56px">Pokaż</button>`}</div>`;
}

Object.assign(ACTIONS, {
  'major-fill': () => {
    S.major.words = S.major.words || {}; let n = 0;
    for (let i = 0; i < 100; i++) { const k = pad2(i); if (!S.major.words[k]) { S.major.words[k] = MAJOR_SUGGEST[i]; n++; } }
    S.major.mod = Date.now(); save(); render(); toast(n ? `Uzupełniono ${n} pól – zmień te, które Ci nie pasują` : 'Wszystko już uzupełnione');
  },
  'major-deck': () => {
    const words = S.major.words || {}, keys = Object.keys(words).filter(k => words[k]).sort();
    if (!keys.length) return toast('Najpierw uzupełnij obrazy');
    const deck = S.decks.find(d => d.name === 'System liczbowy 00–99') || newDeck('System liczbowy 00–99');
    let added = 0; const t0 = Date.now();
    keys.forEach((k, i) => {
      const n = S.notes.find(x => x.src === 'major-' + k);
      if (n) { if (n.back !== words[k]) { n.back = words[k]; touch(n); } }
      else { addNote({ deckId: deck.id, created: t0 + i, type: 'basic', front: k, back: words[k], hint: `${k.split('').map(d => MAJOR_TABLE[+d][1].split(',')[0]).join(' + ')}`, extra: '', reverse: true, src: 'major-' + k }); added++; }
    });
    save(); toast(`Talia „${deck.name}”: ${added} nowych, reszta zaktualizowana`); go('#/deck/' + deck.id);
  },
  'drill-show': () => { DRILL.shown = true; DRILL.times.push(Date.now() - DRILL.t0); render(); },
  'drill-next': el => { DRILL.n++; if (el.dataset.ok === '1') DRILL.ok++; DRILL.k = null; render(); },
  'drill-mode': el => { DRILL.mode = el.dataset.m; DRILL.k = null; render(); },
  'drill-end': () => { if (DRILL?.n) S.stats.majorDrills = (S.stats.majorDrills || 0) + DRILL.n; DRILL = null; save(); go('#/train'); },
});

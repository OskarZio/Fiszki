'use strict';
/* 📚 Gotowe talie (#/library): kilka sprawdzonych zestawów do dodania jednym stuknięciem – dla nowych osób i na szybki start.
   🚀 Pierwsze kroki: karta na Starcie dla nowych kont – dodaj talię → powtórz 10 fiszek → pokonaj bossa → nagroda.
   🔔 Przypomnienie o serii: po 3 dniach nauki z rzędu Start proponuje włączenie powiadomień (raz, można zamknąć). */
const LIB = [
  { id: 'en-irr', icon: '🇬🇧', name: 'Angielski – czasowniki nieregularne', desc: '30 najczęstszych: forma podstawowa → 2. i 3. forma. Najlepiej w trybie „Wpisz”.', cards: [
    ['be (być)', 'was/were – been'], ['have (mieć)', 'had – had'], ['do (robić)', 'did – done'], ['go (iść)', 'went – gone'], ['make (robić, tworzyć)', 'made – made'],
    ['take (brać)', 'took – taken'], ['come (przychodzić)', 'came – come'], ['see (widzieć)', 'saw – seen'], ['get (dostawać)', 'got – got'], ['give (dawać)', 'gave – given'],
    ['know (wiedzieć, znać)', 'knew – known'], ['think (myśleć)', 'thought – thought'], ['say (powiedzieć)', 'said – said'], ['tell (mówić komuś)', 'told – told'], ['find (znaleźć)', 'found – found'],
    ['leave (opuszczać)', 'left – left'], ['feel (czuć)', 'felt – felt'], ['bring (przynosić)', 'brought – brought'], ['begin (zaczynać)', 'began – begun'], ['keep (trzymać)', 'kept – kept'],
    ['write (pisać)', 'wrote – written'], ['buy (kupować)', 'bought – bought'], ['speak (mówić)', 'spoke – spoken'], ['eat (jeść)', 'ate – eaten'], ['drink (pić)', 'drank – drunk'],
    ['swim (pływać)', 'swam – swum'], ['run (biegać)', 'ran – run'], ['teach (uczyć)', 'taught – taught'], ['catch (łapać)', 'caught – caught'], ['choose (wybierać)', 'chose – chosen']] },
  { id: 'capitals', icon: '🌍', name: 'Stolice Europy', desc: '25 państw Europy i ich stolice.', cards: [
    ['Francja', 'Paryż'], ['Niemcy', 'Berlin'], ['Hiszpania', 'Madryt'], ['Portugalia', 'Lizbona'], ['Włochy', 'Rzym'], ['Wielka Brytania', 'Londyn'], ['Irlandia', 'Dublin'],
    ['Holandia', 'Amsterdam'], ['Belgia', 'Bruksela'], ['Szwajcaria', 'Berno'], ['Austria', 'Wiedeń'], ['Czechy', 'Praga'], ['Słowacja', 'Bratysława'], ['Węgry', 'Budapeszt'],
    ['Ukraina', 'Kijów'], ['Litwa', 'Wilno'], ['Łotwa', 'Ryga'], ['Estonia', 'Tallinn'], ['Finlandia', 'Helsinki'], ['Szwecja', 'Sztokholm'], ['Norwegia', 'Oslo'],
    ['Dania', 'Kopenhaga'], ['Grecja', 'Ateny'], ['Rumunia', 'Bukareszt'], ['Bułgaria', 'Sofia']] },
  { id: 'elements', icon: '⚗️', name: 'Chemia – symbole pierwiastków', desc: '25 najważniejszych pierwiastków: symbol → nazwa.', cards: [
    ['H', 'wodór'], ['He', 'hel'], ['Li', 'lit'], ['C', 'węgiel'], ['N', 'azot'], ['O', 'tlen'], ['F', 'fluor'], ['Na', 'sód'], ['Mg', 'magnez'], ['Al', 'glin'],
    ['Si', 'krzem'], ['P', 'fosfor'], ['S', 'siarka'], ['Cl', 'chlor'], ['K', 'potas'], ['Ca', 'wapń'], ['Fe', 'żelazo'], ['Cu', 'miedź'], ['Zn', 'cynk'], ['Ag', 'srebro'],
    ['Au', 'złoto'], ['Hg', 'rtęć'], ['Pb', 'ołów'], ['Sn', 'cyna'], ['I', 'jod']] },
  { id: 'cell', icon: '🧬', name: 'Biologia – budowa komórki', desc: '16 pytań o organella i ich funkcje.', cards: [
    ['Organellum, w którym zachodzi oddychanie komórkowe (powstaje najwięcej ATP)', 'mitochondrium'], ['Organellum, w którym zachodzi fotosynteza', 'chloroplast'],
    ['Struktury, na których zachodzi synteza białek', 'rybosomy'], ['Gdzie przechowywana jest większość DNA komórki eukariotycznej?', 'w jądrze komórkowym'],
    ['Organellum, które modyfikuje, sortuje i pakuje białka do wydzielenia', 'aparat Golgiego'], ['Pęcherzyki z enzymami trawiennymi wewnątrz komórki', 'lizosomy'],
    ['Siateczka śródplazmatyczna z rybosomami na powierzchni', 'szorstka (ziarnista)'], ['Funkcja gładkiej siateczki śródplazmatycznej', 'synteza lipidów i odtruwanie'],
    ['Z czego zbudowana jest ściana komórkowa roślin?', 'z celulozy'], ['Z czego zbudowana jest ściana komórkowa grzybów?', 'z chityny'],
    ['Duży pęcherz w komórce roślinnej, magazyn wody, odpowiada za turgor', 'wakuola'], ['W jakiej strukturze jądra powstają podjednostki rybosomów?', 'w jąderku'],
    ['Organizmy bez jądra komórkowego', 'prokarionty (np. bakterie)'], ['Sieć białkowych włókien nadająca komórce kształt i umożliwiająca ruch', 'cytoszkielet'],
    ['Struktury tworzące wrzeciono podziałowe w komórkach zwierzęcych', 'centriole'], ['Organellum rozkładające nadtlenek wodoru', 'peroksysom']] },
  { id: 'pl-hist', icon: '📜', name: 'Historia Polski – najważniejsze daty', desc: '20 wydarzeń od chrztu Polski do wejścia do Unii.', cards: [
    ['Chrzest Polski', '966'], ['Koronacja Bolesława Chrobrego', '1025'], ['Bitwa pod Grunwaldem', '1410'], ['II pokój toruński', '1466'], ['Hołd pruski', '1525'],
    ['Unia lubelska', '1569'], ['Odsiecz wiedeńska', '1683'], ['Konstytucja 3 maja', '1791'], ['III rozbiór Polski', '1795'], ['Wybuch powstania listopadowego', '1830'],
    ['Wybuch powstania styczniowego', '1863'], ['Odzyskanie niepodległości', '1918'], ['Bitwa Warszawska', '1920'], ['Wybuch II wojny światowej (atak Niemiec na Polskę)', '1 września 1939'],
    ['Wybuch powstania warszawskiego', '1 sierpnia 1944'], ['Porozumienia sierpniowe, powstanie „Solidarności”', '1980'], ['Wprowadzenie stanu wojennego', '13 grudnia 1981'],
    ['Wybory czerwcowe', '4 czerwca 1989'], ['Wejście Polski do NATO', '1999'], ['Wejście Polski do Unii Europejskiej', '1 maja 2004']] },
  { id: 'math', icon: '📐', name: 'Matematyka – wzory', desc: '16 wzorów, które trzeba mieć w głowie.', cards: [
    ['Pole koła', 'P = πr²'], ['Obwód koła', 'L = 2πr'], ['Pole trójkąta', 'P = ½ · a · h'], ['Twierdzenie Pitagorasa', 'a² + b² = c²'], ['Pole trapezu', 'P = ½ · (a + b) · h'],
    ['Pole rombu (z przekątnych)', 'P = ½ · d₁ · d₂'], ['Objętość walca', 'V = πr²h'], ['Objętość kuli', 'V = 4/3 · πr³'], ['Pole powierzchni kuli', 'P = 4πr²'],
    ['Delta równania ax² + bx + c = 0', 'Δ = b² − 4ac'], ['Pierwiastki równania kwadratowego (Δ > 0)', 'x = (−b ± √Δ) / 2a'], ['(a + b)²', 'a² + 2ab + b²'],
    ['a² − b²', '(a − b)(a + b)'], ['Wyraz ogólny ciągu arytmetycznego', 'aₙ = a₁ + (n − 1) · r'], ['Wyraz ogólny ciągu geometrycznego', 'aₙ = a₁ · qⁿ⁻¹'], ['sin²α + cos²α', '1']] },
];
const libAdded = id => S.decks.find(d => d.lib === id);
function libAdd(id) {
  const L = LIB.find(x => x.id === id); if (!L || libAdded(id)) return null;
  const d = newDeck(L.name); d.lib = id; touch(d);
  L.cards.forEach(([front, back]) => addNote({ deckId: d.id, type: 'basic', front, back }));
  save(); return d;
}
ROUTES.library = () => ({ tab: 'home', html: `<div class="row nowrap"><button class="iconbtn" data-go="#/">‹</button><h1 class="grow">Gotowe talie</h1></div>
  <p class="small muted">Sprawdzone zestawy do nauki od zaraz. Po dodaniu talia jest Twoja – możesz ją edytować, dopisywać fiszki i walczyć z jej bossami. Własne fiszki dodasz przyciskiem ✏️ albo zaimportujesz z Quizleta / Anki.</p>
  ${LIB.map(L => { const d = libAdded(L.id); return `<div class="card lib-card"><div class="row nowrap" style="gap:12px"><span class="lib-ic">${L.icon}</span><div class="grow"><b>${esc(L.name)}</b><div class="small muted">${esc(L.desc)}</div></div></div>
    <details class="lib-prev"><summary class="small">Podgląd (${L.cards.length} ${plural(L.cards.length, 'fiszka', 'fiszki', 'fiszek')})</summary>${L.cards.slice(0, 6).map(([a, b]) => `<div><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}${L.cards.length > 6 ? '<div class="muted">…</div>' : ''}</details>
    ${d ? `<button class="block" data-go="#/deck/${d.id}">✓ Dodana – otwórz</button>` : `<button class="primary block" data-act="lib-add" data-id="${L.id}">➕ Dodaj talię</button>`}</div>`; }).join('')}
  <button class="block" data-go="#/add">✏️ Wolę stworzyć własną talię</button>` });

// 🚀 Pierwsze kroki (nowe konta): 3 zadania i nagroda na koniec
const TUT_REWARD = 150;
function tutSteps() {
  const full = appMode() === 'full';
  return [
    { k: 'deck', t: 'Dodaj pierwszą talię', s: 'gotową albo własną', ok: S.decks.length > 0, go: '#/library', b: 'Wybierz' },
    { k: 'learn', t: 'Powtórz 10 fiszek', s: `${Math.min(10, S.log.length)}/10`, ok: S.log.length >= 10, go: '#/study/all/flip', b: 'Ucz się' },
    ...(full ? [{ k: 'boss', t: 'Pokonaj pierwszego bossa', s: 'Przygoda → boss Twojej talii', ok: (S.stats.bossWins || 0) >= 1, go: '#/boss', b: 'Walcz' }] : []),
  ];
}
const tutShow = () => !S.stats.tutDone && (S.log.length < 400 || !S.decks.length) && appMode() !== 'zen';
function tutCardHTML() {
  const st = tutSteps(), done = st.filter(x => x.ok).length, all = done === st.length, cur = st.find(x => !x.ok);
  return `<div class="card tut-card"><div class="row nowrap"><b class="grow">🚀 Pierwsze kroki · ${done}/${st.length}</b><button class="ghost sm" data-act="tut-hide" aria-label="Ukryj">✕</button></div>
    <div class="tut-steps">${st.map(x => `<div class="tut-s${x.ok ? ' ok' : x === cur ? ' cur' : ''}"><i>${x.ok ? '✓' : ''}</i><div class="grow"><b>${x.t}</b><small>${x.s}</small></div>${x === cur ? `<button class="sm primary" data-go="${x.go}">${x.b}</button>` : ''}</div>`).join('')}</div>
    ${all ? `<button class="primary block" data-act="tut-claim">🎁 Odbierz ${TUT_REWARD} 💎 + skrzynkę zapasów</button>` : `<small class="muted">Na koniec: ${TUT_REWARD} 💎 i skrzynka zapasów.</small>`}</div>`;
}
// 🔔 po 3 dniach serii: zaproponuj przypomnienia (tylko z kontem, gdy przypomnienia wyłączone)
const remindShow = () => typeof pushOk === 'function' && pushOk() && typeof cloudOn === 'function' && cloudOn() && typeof PUSH_ST !== 'undefined' && !PUSH_ST.on && !S.stats.remindAsked && streak() >= 3;
const remindHTML = () => `<div class="banner row nowrap remind-nudge"><span class="grow">🔔 Masz <b>${streak()} dni</b> serii. Włączyć przypomnienie, żeby jej nie stracić?</span><button class="sm primary" data-act="remind-yes">Włącz</button><button class="sm ghost" data-act="remind-no" aria-label="Nie teraz">✕</button></div>`;
if (typeof homeExtrasHTML === 'function') { const stHome0 = homeExtrasHTML; homeExtrasHTML = function () { let h = stHome0(); try { if (remindShow()) h = remindHTML() + h; if (tutShow()) h = tutCardHTML() + h; } catch (e) { console.warn(e); } return h; }; }
Object.assign(ACTIONS, {
  'lib-add': el => { const d = libAdd(el.dataset.id); if (!d) return; toast(`📚 Dodano: ${d.name}`); if (typeof confetti === 'function') confetti(50); render(); },
  'tut-hide': () => { S.stats.tutDone = 1; save(); render(); },
  'tut-claim': () => {
    if (S.stats.tutDone || !tutSteps().every(x => x.ok)) return; S.stats.tutDone = 1;
    if (!S.wallet.some(w => w.id === 'tut-reward')) S.wallet.push({ id: 'tut-reward', n: TUT_REWARD, why: 'tut', t: Date.now() });
    if (typeof CASES !== 'undefined' && CASES.basic) addItem('case', 'basic', 1, 'tut-case');
    save(); if (typeof celebrate === 'function') celebrate('🚀 Pierwsze kroki zaliczone!', `+${TUT_REWARD} 💎 · 📦 skrzynka zapasów w ekwipunku`); render();
  },
  'remind-yes': () => { S.stats.remindAsked = 1; save(); pushEnable(); },
  'remind-no': () => { S.stats.remindAsked = 1; save(); render(); },
});

// 🧭 Przygoda: dodatkowe tryby jako kafelki „Więcej trybów” (nic nie znika – mniej przewijania)
const stBoss0 = ROUTES.boss;
ROUTES.boss = (...a) => { const v = stBoss0(...a); if (v?.html && !v.focus && !(a[0] && a[0][1])) onMount(advGrid); return v; };
const ADV_TILES = '.kum-cta, .idle-cta, .coop-cta, .bestiary-cta, .hc-cta, .tower-cta';
function advGrid() {
  const v = document.getElementById('view'), cards = [...v.querySelectorAll(`:scope > :is(${ADV_TILES})`)];
  if (cards.length < 3 || v.querySelector('.adv-grid')) return;
  const box = document.createElement('div'); box.className = 'adv-wrap';
  box.innerHTML = '<div class="bm-h adv-h"><b>Więcej trybów</b></div><div class="adv-grid"></div>';
  cards[0].before(box); const wk = v.querySelector(':scope > .weekly-cta'); if (wk) box.before(wk); const g = box.querySelector('.adv-grid'); cards.forEach(c => { c.classList.add('adv-tile'); g.append(c); });
}

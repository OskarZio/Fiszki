'use strict';
/* 📖 Metody nauki: poradniki oparte na badaniach (raport „Skuteczne metody nauki na studiach”) + treningi „wypróbuj”.
   Każda metoda: co to jest, dlaczego działa (liczby z badań, siła dowodów), jak to robić krok po kroku, jak w Fiszkach,
   typowe błędy i poziomy opanowania (im częściej ćwiczysz, tym więcej wskazówek „doskonal”).
   Treningi (#/mtrain/<metoda>): douczanie do kryterium, „dlaczego?”, zgadywanie przed nauką, tłumaczenie innym,
   rysowanie z pamięci, pewność odpowiedzi. Pozostałe metody prowadzą do istniejących trybów aplikacji. */

const EV = { strong: ['SILNE', '#16a34a'], mod: ['UMIARKOWANE', '#ca8a04'], weak: ['SŁABE', '#ea580c'], op: ['OPINIA', '#64748b'] };
const METHODS = [
  { id: 'test', icon: '🎯', name: 'Testowanie się', sub: 'odpowiadaj z pamięci, zamiast czytać', ev: 'strong', all: true,
    why: 'Najlepiej zbadana technika nauki. W metaanalizie 222 badań (48 478 uczniów i studentów) samo odpowiadanie na pytania dało efekt <b>g ≈ 0,50</b> – i działa w 18 kategoriach przedmiotów. Każde przypomnienie wzmacnia ślad w pamięci bardziej niż ponowne przeczytanie. Warunek: poprawna odpowiedź musi się pojawić zaraz potem (informacja zwrotna).',
    how: ['Zanim odkryjesz odpowiedź, naprawdę spróbuj ją sobie przypomnieć – choćby w myślach, pełnym zdaniem.', 'Nowy, trudny materiał: zacznij od rozpoznawania (ABCD). Gdy idzie dobrze – przejdź na wpisywanie.', 'Od razu sprawdzaj odpowiedź i oceniaj się uczciwie („nie pamiętam” to też dane dla algorytmu).', 'Notatki zamieniaj w pytania – zamiast czytać slajd, zrób z niego 5 fiszek.'],
    app: 'Każda sesja fiszek to testowanie. Najmocniejsze są <b>Wpisywanie</b> i <b>Test pisemny</b>; Test ABCD – na start z nowym materiałem.',
    mistakes: ['Odkrywanie odpowiedzi po sekundzie („a, wiedziałem”) – to złudzenie wiedzy.', 'Ocena „pamiętam”, gdy odpowiedź była tylko podobna.'],
    tips: ['Mów odpowiedź na głos albo pisz – samo „wiem, wiem” w głowie działa słabiej.', 'Przy błędzie przeczytaj odpowiedź i powiedz ją sobie jeszcze raz własnymi słowami.', 'Mieszaj formaty: raz ABCD, raz wpisywanie, raz test pisemny z całej talii.', 'Twórz pytania wyższego rzędu: „dlaczego”, „porównaj”, „co by było, gdyby”.'],
    tryIt: { label: '⌨️ Ucz się wpisywaniem', go: d => `#/study/${d}/type` } },
  { id: 'spaced', icon: '📅', name: 'Powtórki rozłożone w czasie', sub: 'krótko, ale wiele razy w odstępach', ev: 'strong', all: true,
    why: 'Powtórki rozłożone wygrywają z nauką „na raz”: <b>g = 0,74</b>. Optymalny odstęp zależy od tego, kiedy egzamin – około <b>20–40% czasu do testu</b> przy horyzoncie tygodnia i <b>5–10%</b> przy horyzoncie roku. Zbyt krótki odstęp szkodzi bardziej niż zbyt długi. Ciekawostka: 90% osób uczyło się lepiej w odstępach, ale <b>72% było przekonanych, że lepiej działało wkuwanie</b> – dlatego harmonogram ma ustalać algorytm, nie przeczucie.',
    how: ['Codziennie rób powtórki zaplanowane na dziś – nawet 10 minut.', 'Nie powtarzaj w kółko tego samego dnia „dla pewności” – lepiej wróć jutro.', 'Ustaw datę egzaminu przy talii – aplikacja dopasuje odstępy i powtórzy wszystko dzień przed.'],
    app: 'Aplikacja planuje to sama. Włącz <b>FSRS</b> (Ustawienia → Algorytm powtórek) i wybierz, ile procent chcesz pamiętać – zobaczysz, ile minut dziennie to kosztuje.',
    mistakes: ['Nadrabianie tygodnia zaległości w jeden wieczór.', 'Dodawanie 100 nowych kart naraz – za tydzień będą setki powtórek.'],
    tips: ['Ustaw stałą porę powtórek (np. po śniadaniu) – nawyk ważniejszy niż długość sesji.', 'Retencja 85–90% to najlepszy kompromis; przed egzaminem podnieś do 95%.', 'Zaległości > 200: rób najpierw zaległe, nowe karty wstrzymaj na 2–3 dni.', 'Raz w tygodniu sprawdź prognozę obciążenia w ustawieniach FSRS.'],
    tryIt: { label: '🧮 Ustaw FSRS', go: () => '#/more' } },
  { id: 'relearn', icon: '🔁', name: 'Douczanie do skutku', sub: 'powtarzaj, aż odpowiesz 3× dobrze', ev: 'mod',
    why: 'Połączenie testowania i odstępów (successive relearning, Rawson i Dunlosky). Każdą informację ćwiczysz, aż przypomnisz ją sobie poprawnie, a potem wracasz do niej w kolejnych sesjach. Najczęstszy przepis: <b>3 poprawne przypomnienia na pierwszej sesji</b>, potem <b>3 sesje po 1 poprawnym</b>. Liczba powrotów waży więcej niż wyśrubowane kryterium na start.',
    how: ['Wybierz 10–20 fiszek (np. z dzisiejszego wykładu).', 'Każda musi trafić 3 razy dobrze – błędna wraca po kilku innych.', 'Za 2–3 dni, za tydzień i za 2 tygodnie: znowu, ale wystarczy 1 dobra odpowiedź.'],
    app: 'Trening <b>Douczanie</b> pilnuje kryterium 3× za Ciebie (nie zmienia harmonogramu). Kolejne „sesje po 1” to po prostu zwykłe powtórki.',
    mistakes: ['Kończenie po pierwszej poprawnej odpowiedzi – po godzinie i tak uleci.'],
    tips: ['Najlepiej w dniu wykładu – to Twoja pierwsza sesja.', 'Przy fiszkach, które sprawiają trudność, dopisz skojarzenie przed kolejną próbą.', 'Przed kolokwium: douczanie na najtrudniejszych (filtr „Trudne”).'],
    train: 'relearn' },
  { id: 'interleave', icon: '🔀', name: 'Przeplatanie', sub: 'mieszaj podobne typy zadań i pojęć', ev: 'strong', subj: ['math', 'med'],
    why: 'Zamiast 20 takich samych zadań pod rząd – mieszanka różnych typów. Średni efekt <b>g = 0,42</b>, największy przy podobnych kategoriach (np. obrazy: 0,67). W dużym badaniu w szkołach zadania przeplatane dały po miesiącu <b>61% wobec 38%</b> przy blokach – bo uczą <b>wyboru metody</b>. Uwaga: przy listach słówek blokowanie bywa lepsze.',
    how: ['W matematyce/fizyce: rozwiązuj zestawy, w których kolejne zadanie wymaga innej metody.', 'W anatomii/farmakologii: mieszaj podobne struktury (np. wszystkie nerwy ręki naraz, nie po jednym).', 'Zanim zaczniesz liczyć, nazwij metodę: „to jest zadanie na…”.'],
    app: 'W talii: <b>🔀 Przeplatanie</b> (losowa kolejność nowych kart). Dodawaj fiszki „Którą metodą rozwiązać…?”.',
    mistakes: ['Mieszanie zupełnie niepowiązanych przedmiotów w nadziei na efekt – nie ma na to dowodów.'],
    tips: ['Fiszka „rozpoznaj typ”: treść zadania → nazwa metody.', 'Zestaw z 3 ostatnich tematów + 1 starszy – jednocześnie przeplatasz i powtarzasz.'],
    tryIt: { label: '🔀 Włącz przeplatanie', act: 'm-mix' } },
  { id: 'why', icon: '❓', name: 'Samowyjaśnianie („dlaczego?”)', sub: 'tłumacz sobie, dlaczego to prawda', ev: 'strong', subj: ['law', 'chem', 'med'],
    why: 'Wyjaśnianie sobie „dlaczego” i „jak to się łączy z tym, co już wiem” daje <b>g = 0,55</b>. Ważny szczegół: działają <b>konkretne pytania-podpowiedzi</b> (g = 0,56), a ogólne „zastanów się” prawie nie (g = 0,19).',
    how: ['Po przeczytaniu odpowiedzi zadaj sobie jedno z pytań: „Dlaczego tak jest?”, „Co by się stało, gdyby…?”, „Czym to się różni od…?”.', 'Odpowiedz 1–2 zdaniami, własnymi słowami.', 'Dobre wyjaśnienie zapisz jako skojarzenie – wróci przy następnej powtórce.'],
    app: 'Trening <b>Dlaczego?</b> pokazuje fiszkę z odpowiedzią i konkretne pytanie; zapisane wyjaśnienie trafia do skojarzeń (💡).',
    mistakes: ['Przepisywanie definicji zamiast wyjaśniania.'],
    tips: ['Szukaj mechanizmu (przyczyna → skutek), nie tylko faktu.', 'Porównuj pary łatwe do pomylenia.', 'W prawie: zasada → uzasadnienie → przykład orzeczenia.'],
    train: 'why' },
  { id: 'pretest', icon: '🎲', name: 'Zgadnij przed nauką', sub: 'próba odpowiedzi, zanim poznasz materiał', ev: 'mod',
    why: 'Zgadywanie odpowiedzi <b>przed</b> nauką (pretesting) poprawia późniejsze zapamiętanie – mózg „przygotowuje miejsce” na odpowiedź. Warunek: zaraz potem musisz zobaczyć poprawną odpowiedź. Studenci systematycznie nie doceniają tej techniki.',
    how: ['Przed wykładem albo nowym rozdziałem przejrzyj pytania i zgadnij odpowiedzi (błędy są OK!).', 'Od razu sprawdź poprawną odpowiedź.', 'Potem ucz się normalnie – zapamiętasz więcej.'],
    app: 'Trening <b>Zgadnij</b> bierze nowe (jeszcze nieuczone) fiszki z talii. Nie zmienia harmonogramu.',
    mistakes: ['Zgadywanie bez sprawdzenia odpowiedzi – wtedy możesz utrwalić błąd.'],
    tips: ['Najlepiej 5–10 minut przed wykładem: 3–5 pytań z tematu.', 'Zapisz najbardziej zaskakującą odpowiedź – zaskoczenie wzmacnia pamięć.'],
    train: 'pretest' },
  { id: 'teach', icon: '🧑‍🏫', name: 'Tłumacz innym (Feynman)', sub: 'wyjaśnij jak 12-latkowi', ev: 'mod',
    why: 'Faktyczne tłumaczenie materiału – np. nagranie 5-minutowej lekcji – daje efekty <b>średnie do dużych</b>. Samo <b>oczekiwanie</b>, że będzie się kogoś uczyć, nie daje stabilnej korzyści: liczy się prawdziwe tłumaczenie. „Technika Feynmana” opiera się właśnie na tych badaniach.',
    how: ['Wybierz temat i wyjaśnij go prostymi słowami, bez żargonu (na głos, na kartce albo nagranie).', 'Gdzie się zacinasz – tam jest luka. Wróć do materiału.', 'Wyjaśnij jeszcze raz, krócej.'],
    app: 'Trening <b>Wytłumacz</b>: piszesz (albo dyktujesz) wyjaśnienie, potem porównujesz z odpowiedzią i odhaczasz listę kontrolną.',
    mistakes: ['Używanie trudnych słów, żeby ukryć, że czegoś nie rozumiesz.'],
    tips: ['Ucz się w parze: każdy tłumaczy drugiemu inny temat (wspólna talia!).', 'Dodaj przykład z życia albo analogię.', 'Nagraj 3-minutowe wyjaśnienie i odsłuchaj po tygodniu.'],
    train: 'teach' },
  { id: 'draw', icon: '✏️', name: 'Rysuj z pamięci, mapy pojęć', sub: 'szlaki, mechanizmy, schematy', ev: 'strong', subj: ['chem', 'med'],
    why: 'Samodzielne budowanie map pojęciowych: <b>g = 0,72</b> (studiowanie gotowych map: 0,43; 142 wyniki, ~11 800 osób). Rysowanie z pamięci też działa – zwłaszcza z lekką podpowiedzią na start.',
    how: ['Zamknij notatki i narysuj z pamięci: szlak, mechanizm, schemat, mapę pojęć.', 'Porównaj ze wzorem i popraw innym kolorem.', 'Następnym razem rysuj od zera – aż wyjdzie bez błędów.'],
    app: 'Trening <b>Rysuj</b>: przy każdej fiszce otwiera szkicownik, potem pokazuje odpowiedź do porównania. Rysunek możesz zapisać jako skojarzenie.',
    mistakes: ['Przerysowywanie z podręcznika – to bierne kopiowanie.'],
    tips: ['Początkujący: zacznij od szkieletu (np. tylko nazwy etapów), dopisuj szczegóły.', 'Fiszka typu „narysuj glikolizę od glukozy do pirogronianu z enzymami”.', 'Mapy łączące kilka wykładów – świetne przed egzaminem.'],
    train: 'draw' },
  { id: 'examples', icon: '🧩', name: 'Rozwiązane przykłady', sub: 'od pełnego rozwiązania do samodzielnego', ev: 'strong', subj: ['math', 'code'],
    why: 'Analizowanie rozwiązanych przykładów w matematyce: <b>g ≈ 0,48</b>. Najlepiej działa <b>stopniowe wygaszanie</b>: pełny przykład → przykład z lukami → samodzielne zadanie. Gdy już umiesz, pełne przykłady przestają pomagać (efekt odwrócenia ekspertyzy).',
    how: ['Przeanalizuj 1–2 rozwiązane przykłady: przy każdym kroku powiedz, dlaczego tak.', 'Rozwiąż przykład z zakrytym jednym krokiem, potem dwoma…', 'Na końcu: zadanie od zera.'],
    app: 'Zrób fiszkę z <b>lukami</b> z rozwiązania: zasłoń kolejne kroki ({{c1::…}}, {{c2::…}}) – każda luka to osobna karta.',
    mistakes: ['Czytanie 20 rozwiązań bez rozwiązania żadnego samodzielnie.'],
    tips: ['Fiszki „warunki stosowania wzoru” i „którą metodą?”.', 'Gdy przykłady stają się nudne – to sygnał, żeby przejść do samodzielnych zadań.'],
    tryIt: { label: '🧩 Dodaj fiszkę z lukami', go: () => '#/add?type=cloze' } },
  { id: 'confidence', icon: '💯', name: 'Pewność odpowiedzi', sub: 'wyłap błędy, których jesteś pewny', ev: 'mod',
    why: 'Błędy popełnione z dużą pewnością <b>częściej udaje się poprawić</b> po informacji zwrotnej (efekt hiperkorekty) – ale po tygodniu wracają. Dlatego takie fiszki trzeba powtórzyć szybciej. Ocena „czy umiem” tuż po nauce jest bardzo myląca – miarą jest wynik po czasie.',
    how: ['Przed odkryciem odpowiedzi oceń pewność: zgaduję / raczej wiem / jestem pewny.', 'Sprawdź, czy miałeś rację.', 'Pewne pomyłki – powtórz już jutro.'],
    app: 'Trening <b>Pewność</b> pokazuje na końcu, jak trafne były Twoje oceny, a pewne pomyłki przesuwa na jutro.',
    mistakes: ['Wierzenie poczuciu „umiem” zaraz po nauce.'],
    tips: ['Jeśli często jesteś pewny i się mylisz – zwolnij i mów odpowiedź pełnym zdaniem.', 'Przed egzaminem: sesja pewności na całej talii pokazuje, co tylko „wydaje się” znane.'],
    train: 'conf' },
  { id: 'palace', icon: '🏛️', name: 'Pałac pamięci', sub: 'do list i kolejności', ev: 'mod',
    why: 'Metoda loci ma średni efekt (95% CI 0,45–0,85) w 13 badaniach, ale głównie dla <b>list i kolejności</b>. U mistrzów pamięci trening wymagał 40 sesji po 30 minut. Do zrozumienia złożonych pojęć jest mało wydajna.',
    how: ['Wybierz znaną trasę (mieszkanie, droga na uczelnię).', 'Na każdym przystanku umieść dziwny, żywy obraz elementu listy.', 'Przejdź trasę w myślach i odtwórz listę – potem powtarzaj jak fiszki.'],
    app: 'Zakładka <b>Pałace pamięci</b>: stacje ze zdjęciami i skojarzeniami + spacer-quiz.',
    mistakes: ['Budowanie pałacu do pojęć, które trzeba rozumieć (np. mechanizmy) – lepiej „dlaczego?” albo rysowanie.'],
    tips: ['Idealne: nerwy czaszkowe, kolejność etapów, dynastie, artykuły po kolei.', 'Im dziwniejszy i bardziej ruchomy obraz, tym lepiej.'],
    tryIt: { label: '🏛️ Otwórz pałace', go: () => '#/palaces' } },
  { id: 'keyword', icon: '🔑', name: 'Słowo-klucz (języki)', sub: 'haczyk na oporne słówka', ev: 'weak', subj: ['lang'],
    why: 'Skojarzenie obcego słowa z podobnie brzmiącym polskim słowem i obrazem poprawia zapamiętanie <b>od razu</b>, ale bez powtórek zapomina się je <b>szybciej</b> niż zwykłą metodą. Działa jako dodatek do SRS, nie zamiast.',
    how: ['Znajdź polskie słowo, które brzmi podobnie (np. ang. „carpet” → „karp”).', 'Wyobraź sobie obraz łączący oba znaczenia (karp leżący na dywanie).', 'Zapisz go jako skojarzenie 💡 i powtarzaj fiszkę normalnie.'],
    app: 'Przy fiszce stuknij 💡 i dodaj skojarzenie – tekst albo rysunek.',
    mistakes: ['Wymyślanie słów-kluczy do wszystkich słówek – szkoda czasu na łatwe.'],
    tips: ['Kierunek fiszki: rozpoznawanie dla słów biernych, wpisywanie dla słów, których chcesz używać.', 'Dodawaj zdania z kontekstem – słowo w zdaniu zapamiętujesz lepiej (OPINIA).'],
    tryIt: { label: '📚 Ucz się z podpowiedziami', go: d => `#/study/${d}/flip` } },
  { id: 'lecture', icon: '🎓', name: 'Rytuał po wykładzie', sub: 'na bieżąco, zanim przyjdzie kolokwium', ev: 'mod', all: true,
    why: 'Quizy z wykładów w realnych zajęciach: <b>g ≈ 0,50</b>. 2–4 pytania z poprzedniego tygodnia na początku zajęć zmniejszały złudzenie wiedzy. Krótka próba odpowiedzi przed wykładem też pomaga. Badań o idealnym terminie pierwszej powtórki brak – zalecenie poniżej to wniosek z ogólnych zasad.',
    how: ['Dzień wykładu: 5–10 fiszek z najważniejszych slajdów (możesz wkleić zdjęcia Claude – zrobi pakiet).', 'Do 24 h: douczanie – każda fiszka 3× dobrze.', 'Po 1–3 dniach: pierwsza powtórka (zrobi się sama).', 'Przed kolejnym wykładem: 3 pytania „zgadnij” z nowego tematu.'],
    app: '<b>Dodaj → 📥 Pakiet fiszek</b> (gotowa talia z tekstu), potem trening <b>Douczanie</b>, a przed zajęciami <b>Zgadnij</b>.',
    mistakes: ['Odkładanie wszystkiego „na sesję” – wtedy przy kilku przedmiotach brakuje dni na odstępy.'],
    tips: ['Jedna talia na przedmiot, a w niej data kolokwium – aplikacja rozłoży naukę.', 'Rób fiszki od razu po zajęciach: 10 minut teraz zastępuje 2 godziny przed sesją.', 'Stała pora: np. 20:00 – fiszki z dzisiejszych zajęć.'],
    tryIt: { label: '📥 Dodaj pakiet z wykładu', go: () => '#/import' } },
  { id: 'sleep', icon: '😴', name: 'Sen i przerwy', sub: 'pamięć utrwala się w nocy', ev: 'mod', all: true,
    why: 'Regularny sen w tygodniach nauki wyjaśniał <b>ok. 25% różnic w ocenach</b> (sen w noc przed testem – nie). Przy niewyspaniu bardziej traci materiał wkuty niż rozłożony. U studentów medycyny ≥ 7 h snu wiązało się z lepszymi wynikami. Stałe przerwy (24 min nauki / 6 min przerwy) dawały mniej zmęczenia i lepszą koncentrację.',
    how: ['Śpij regularnie przez cały semestr – nie zarywaj nocy przed egzaminem.', 'Ucz się blokami 25 min z 5-minutową przerwą (bez telefonu).', 'Po nauce wieczorem – sen, nie scrollowanie.'],
    app: '<b>🥚 Inkubator</b> z przerwami pomodoro: 25 min skupienia, 5 min przerwy – i stworek na koniec.',
    mistakes: ['„Zarwę noc, bo mam zaległości” – tracisz więcej, niż zyskujesz.'],
    tips: ['Powtórka krótko przed snem + szybka powtórka rano.', 'Przerwa = ruch, woda, okno – nie media społecznościowe.'],
    tryIt: { label: '🥚 Sesja skupienia', go: () => '#/egg' } },
];
const AVOID = ['Ponowne czytanie notatek i podręcznika', 'Podkreślanie i zakreślanie', 'Streszczanie bez testowania się', 'Wkuwanie w ostatnią noc', 'Żonglowanie wieloma narzędziami naraz (≥ 3 metody wiązały się z gorszymi wynikami)'];
const SUBJECTS = [
  { k: 'med', icon: '🫀', name: 'Medycyna / anatomia', m: ['test', 'spaced', 'interleave', 'draw', 'palace'], cards: ['krótkie fiszki faktów i luki', 'zasłanianie fragmentów obrazu (atlas, schemat)', 'pytania w formie przypadku klinicznego', 'listy (nerwy, gałęzie) – pałac pamięci'], avoid: 'zarywania snu dla zaległych powtórek, wielu systemów naraz', note: 'Codzienna regularność liczyła się bardziej niż liczba kart (badania obserwacyjne, USMLE).' },
  { k: 'lang', icon: '🗣️', name: 'Języki obce', m: ['spaced', 'test', 'keyword'], cards: ['słówko → tłumaczenie (rozpoznawanie)', 'tłumaczenie → wpisz słówko (aktywne)', 'zdanie z luką {{c1::…}}'], avoid: 'polegania tylko na mnemotechnice bez powtórek', note: 'Kierunek fiszki dopasuj do celu: rozumienie czy mówienie/pisanie.' },
  { k: 'math', icon: '📐', name: 'Matematyka / fizyka', m: ['interleave', 'examples', 'test', 'why'], cards: ['„którą metodą rozwiązać…?”', 'warunki stosowania twierdzenia/wzoru', 'rozwiązanie z lukami w kolejnych krokach'], avoid: 'bloków „20 takich samych zadań”, wkuwania wzorów bez zastosowań', note: 'Fiszki są tu pomocnicze – główna nauka to rozwiązywanie mieszanych zadań.' },
  { k: 'chem', icon: '⚗️', name: 'Chemia / biochemia', m: ['draw', 'why', 'spaced', 'test'], cards: ['„narysuj szlak X z enzymami”', 'mechanizm reakcji krok po kroku', 'mapa pojęć łącząca wykłady'], avoid: 'biernego oglądania gotowych schematów', note: 'Własne mapy pojęć (g = 0,72) biją gotowe (0,43).' },
  { k: 'law', icon: '⚖️', name: 'Prawo / historia', m: ['why', 'test', 'spaced', 'palace'], cards: ['„dlaczego X doprowadziło do Y?”', 'stan faktyczny → rozstrzygnięcie', 'zasada → orzeczenie wiodące', 'kolejność wydarzeń/etapów'], avoid: 'ponownego czytania i podkreślania podręcznika', note: 'Formaty dziedzinowe to OPINIA – ale testowanie i odstępy działają wszędzie.' },
  { k: 'code', icon: '💻', name: 'Programowanie', m: ['examples', 'test', 'teach'], cards: ['„przewidź wynik kodu”', '„znajdź błąd”', 'składnia i API (krótko)'], avoid: 'zastępowania pisania kodu fiszkami', note: 'Główna aktywność to pisanie kodu; układanki z linii kodu (Parsons) – jako rusztowanie.' },
];
const mById = id => METHODS.find(m => m.id === id);
const mCount = id => S.stats['m_' + id] || 0;
const M_LEVELS = [1, 3, 7, 15, 30];
const mLevel = id => M_LEVELS.filter(x => mCount(id) >= x).length;
const evTag = e => `<span class="ev" style="--ev:${EV[e][1]}">${EV[e][0]}</span>`;
const mStars = id => `<span class="m-lv" title="Poziom opanowania ${mLevel(id)}/5">${'●'.repeat(mLevel(id))}${'○'.repeat(5 - mLevel(id))}</span>`;
const mDeck = () => (deckById(METHOD_DECK) || S.decks.find(d => S.cards.some(c => c.deckId === d.id)) || S.decks[0])?.id || 'all';
let METHOD_DECK = '';

ROUTES.methods = () => ({ tab: 'home', html: `
  <div class="row nowrap"><button class="iconbtn" data-go="#/">‹</button><h1 class="grow" style="margin:0">📖 Metody nauki</h1></div>
  <div class="card methods-intro"><p style="margin-top:0"><b>Dwie zasady działają w każdym przedmiocie:</b> odpowiadaj z pamięci (testowanie) i powtarzaj w odstępach. Reszta to dobór formatu do przedmiotu.</p>
    <p class="small muted" style="margin-bottom:0">Na podstawie przeglądu badań (metaanalizy, RCT). Przy każdej metodzie siła dowodów: ${Object.values(EV).map(([n, c]) => `<span class="ev" style="--ev:${c}">${n}</span>`).join(' ')}. Ćwicz metodę – rośnie jej poziom ●●●○○ i odblokowujesz wskazówki „doskonal”.</p></div>
  <h2>Według przedmiotu</h2>
  <div class="subj-grid">${SUBJECTS.map(s => `<button class="subj" data-go="#/subject/${s.k}"><span>${s.icon}</span><b>${s.name}</b></button>`).join('')}</div>
  <h2>Wszystkie metody</h2>
  <div class="m-list">${METHODS.map(m => `<button class="m-row" data-go="#/method/${m.id}"><span class="m-ic">${m.icon}</span><span class="grow"><b>${m.name}</b><small>${m.sub}</small><span class="m-meta">${evTag(m.ev)} ${mStars(m.id)}</span></span><span>›</span></button>`).join('')}</div>
  <div class="card avoid"><h3 style="margin-top:0">🚫 Co nie działa (choć wszyscy tak robią)</h3><ul class="small">${AVOID.map(a => `<li>${a}</li>`).join('')}</ul></div>` });

ROUTES.method = parts => {
  const m = mById(parts[1]); if (!m) return { html: '<a href="#/methods">Wróć</a>' };
  const lv = mLevel(m.id), next = M_LEVELS[lv];
  const deckSel = `<select data-mdeck="1" class="grow">${S.decks.map(d => `<option value="${d.id}" ${d.id === mDeck() ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select>`;
  const tryBtn = m.train ? `<button class="primary block" data-act="m-train" data-k="${m.train}">▶ Wypróbuj: trening „${m.name}”</button>`
    : m.tryIt?.act ? `<button class="primary block" data-act="${m.tryIt.act}">${m.tryIt.label}</button>` : m.tryIt ? `<button class="primary block" data-act="m-go" data-id="${m.id}">${m.tryIt.label}</button>` : '';
  return { tab: 'home', html: `
  <div class="row nowrap"><button class="iconbtn" data-go="#/methods">‹</button><h1 class="grow" style="margin:0">${m.icon} ${m.name}</h1></div>
  <div class="card m-head"><div class="row nowrap"><span class="grow small muted">${m.sub}</span>${evTag(m.ev)}</div>
    <div class="m-prog"><div class="row nowrap"><b class="grow">Twoje opanowanie: poziom ${lv}/5</b>${mStars(m.id)}</div>
      <div class="pbar"><i style="width:${next ? Math.min(100, mCount(m.id) / next * 100) : 100}%"></i></div>
      <small class="muted">${next ? `Ćwiczone ${mCount(m.id)}× · do poziomu ${lv + 1}: ${next - mCount(m.id)} ${plural(next - mCount(m.id), 'sesja', 'sesje', 'sesji')}` : 'Mistrzostwo! 🏆'}</small></div>
    ${S.decks.length > 1 && (m.train || m.tryIt?.go?.length) ? `<div class="row nowrap" style="margin-top:12px"><span class="small">Talia:</span>${deckSel}</div>` : ''}
    <div style="margin-top:12px">${tryBtn}</div></div>
  <div class="card"><h3 style="margin-top:0">🔬 Dlaczego działa</h3><p>${m.why}</p></div>
  <div class="card"><h3 style="margin-top:0">🪜 Jak to robić</h3><ol class="m-steps">${m.how.map(x => `<li>${x}</li>`).join('')}</ol>
    <p class="small m-app">📱 <b>W Fiszkach:</b> ${m.app}</p></div>
  <div class="card"><h3 style="margin-top:0">⚠️ Typowe błędy</h3><ul class="small">${m.mistakes.map(x => `<li>${x}</li>`).join('')}</ul></div>
  <div class="card"><h3 style="margin-top:0">🚀 Doskonal metodę</h3><div class="m-tips">${m.tips.map((t, i) => { const need = i === 0 ? 0 : M_LEVELS[i - 1], open = lv >= (i === 0 ? 0 : i);
      return `<div class="m-tip${open ? '' : ' locked'}"><b>${open ? '✓' : '🔒'} Poziom ${i + 1}</b><span>${open ? t : `Odblokujesz po ${need} ${plural(need, 'sesji', 'sesjach', 'sesjach')} tą metodą`}</span></div>`; }).join('')}</div></div>` };
};
ROUTES.subject = parts => {
  const s = SUBJECTS.find(x => x.k === parts[1]); if (!s) return { html: '<a href="#/methods">Wróć</a>' };
  return { tab: 'home', html: `
  <div class="row nowrap"><button class="iconbtn" data-go="#/methods">‹</button><h1 class="grow" style="margin:0">${s.icon} ${s.name}</h1></div>
  <div class="card"><h3 style="margin-top:0">Co działa najlepiej</h3><div class="m-list">${s.m.map(id => { const m = mById(id); return `<button class="m-row" data-go="#/method/${id}"><span class="m-ic">${m.icon}</span><span class="grow"><b>${m.name}</b><small>${m.sub}</small><span class="m-meta">${evTag(m.ev)} ${mStars(id)}</span></span><span>›</span></button>`; }).join('')}</div></div>
  <div class="card"><h3 style="margin-top:0">🃏 Jakie fiszki robić</h3><ul>${s.cards.map(c => `<li>${esc(c)}</li>`).join('')}</ul><p class="small muted" style="margin-bottom:0">${esc(s.note)}</p></div>
  <div class="card avoid"><h3 style="margin-top:0">🚫 Unikaj</h3><p style="margin:0">${esc(s.avoid)}</p></div>
  <div class="card"><h3 style="margin-top:0">🗓️ Tydzień z tym przedmiotem</h3><ol class="m-steps small">
    <li><b>Dzień wykładu:</b> 5–10 fiszek z najważniejszych slajdów + douczanie (3× dobrze).</li>
    <li><b>Codziennie:</b> powtórki zaplanowane na dziś (10–20 min na wszystkie przedmioty razem).</li>
    <li><b>Przed kolejnymi zajęciami:</b> 3 pytania „zgadnij” z nowego tematu.</li>
    <li><b>Raz w tygodniu:</b> ${s.k === 'math' ? 'zestaw mieszanych zadań z 3 ostatnich tematów' : s.k === 'chem' ? 'narysuj z pamięci najważniejszy szlak/mechanizm tygodnia' : s.k === 'law' ? 'konspekt odpowiedzi z pamięci na pytanie egzaminacyjne' : s.k === 'code' ? 'mały program wykorzystujący nowy materiał' : 'sesja pewności albo boss na całej talii'}.</li>
    <li><b>Ustaw datę kolokwium</b> przy talii – aplikacja rozłoży naukę i powtórzy wszystko dzień przed.</li></ol></div>` };
};

// ---------- treningi metod
let MT = null;
const MT_INFO = { relearn: ['🔁', 'Douczanie'], why: ['❓', 'Dlaczego?'], pretest: ['🎲', 'Zgadnij'], teach: ['🧑‍🏫', 'Wytłumacz'], draw: ['✏️', 'Rysuj z pamięci'], conf: ['💯', 'Pewność'] };
const MT_METHOD = { relearn: 'relearn', why: 'why', pretest: 'pretest', teach: 'teach', draw: 'draw', conf: 'confidence' };
const WHY_Q = ['Dlaczego tak jest?', 'Co by się stało, gdyby było inaczej?', 'Z czym to łączysz z tego, co już wiesz?', 'Czym to się różni od rzeczy łatwej do pomylenia?', 'Jaki jest mechanizm (przyczyna → skutek)?', 'Podaj przykład z życia.'];
function mtStart(k) {
  const d = mDeck(), cs = S.cards.filter(c => (d === 'all' || c.deckId === d) && noteById(c.noteId) && noteById(c.noteId).type !== 'occl');
  let pool = k === 'pretest' ? cs.filter(c => c.srs.state === 'new') : cs.filter(c => c.srs.state !== 'new');
  if (k !== 'pretest' && pool.length < 5) pool = cs;   // mało nauczonych – bierzemy wszystkie
  pool = shuffle(pool).slice(0, k === 'relearn' ? 15 : 10);
  if (!pool.length) return toast(k === 'pretest' ? 'W tej talii nie ma nowych fiszek – dodaj nowe albo wybierz inną talię' : 'W tej talii nie ma fiszek', 4000);
  MT = { k, deck: d, queue: pool.map(c => c.id), hits: {}, i: 0, done: 0, stats: { ok: 0, bad: 0 }, conf: [], phase: 'q', t0: Date.now() };
  go('#/mtrain/' + k);
}
const mtCard = () => MT && S.cards.find(c => c.id === MT.queue[0]);
function mtNext(ok) {
  const c = mtCard(); if (!c) return;
  (S.tlog = S.tlog || []).push({ id: uid(), t: Date.now(), d: c.deckId, ms: Math.min(60000, Date.now() - (MT.shownAt || Date.now())) });
  MT.stats[ok ? 'ok' : 'bad']++;
  const id = MT.queue.shift();
  if (MT.k === 'relearn') {
    if (ok) MT.hits[id] = (MT.hits[id] || 0) + 1; else MT.hits[id] = 0;
    if ((MT.hits[id] || 0) < 3) MT.queue.splice(Math.min(ok ? 4 : 2, MT.queue.length), 0, id); else MT.done++;
  } else MT.done++;
  MT.phase = 'q'; MT.txt = ''; MT.drawing = null; MT.shownAt = Date.now(); MT.whyQ = WHY_Q[Math.random() * WHY_Q.length | 0];
  if (!MT.queue.length) return mtFinish();
  save(); render();
}
function mtFinish() {
  const mid = MT_METHOD[MT.k], before = mLevel(mid);
  S.stats['m_' + mid] = mCount(mid) + 1; MT.phase = 'end'; save();
  if (mLevel(mid) > before) setTimeout(() => celebrate(`📖 ${mById(mid).name}: poziom ${mLevel(mid)}!`, 'Odblokowałeś nową wskazówkę „doskonal”'), 400);
  render();
}
ROUTES.mtrain = parts => {
  const k = parts[1], info = MT_INFO[k];
  if (!MT || MT.k !== k || !info) return { html: `<div class="card center"><p>Trening nie jest uruchomiony.</p><button class="primary" data-go="#/methods">Metody nauki</button></div>` };
  const mid = MT_METHOD[k];
  if (MT.phase === 'end') {
    const conf = MT.conf, byC = [0, 1, 2].map(l => { const x = conf.filter(c => c.l === l); return { n: x.length, ok: x.filter(c => c.ok).length }; });
    return { tab: 'home', focus: true, html: `<div class="card center"><div style="font-size:54px">${info[0]}</div><h2 style="margin:6px 0">Trening „${info[1]}” ukończony!</h2>
      <p class="muted">${MT.stats.ok} dobrze · ${MT.stats.bad} do poprawy · poziom metody ${mLevel(mid)}/5 ${mStars(mid)}</p>
      ${k === 'conf' && conf.length ? `<table class="fs-table"><thead><tr><th>Pewność</th><th>Odpowiedzi</th><th>Trafność</th></tr></thead><tbody>${['🤷 zgaduję', '🙂 raczej wiem', '💯 pewny'].map((l, i) => `<tr><td>${l}</td><td>${byC[i].n}</td><td>${byC[i].n ? Math.round(byC[i].ok / byC[i].n * 100) + '%' : '–'}</td></tr>`).join('')}</tbody></table>
        <p class="small muted">${byC[2].n && byC[2].ok < byC[2].n ? `Pomyłki przy „pewny” (${byC[2].n - byC[2].ok}) wrócą już jutro – tak szybko utrwalisz poprawkę.` : 'Twoje oceny pewności są trafne 👌'}</p>` : ''}
      ${k === 'pretest' ? '<p class="small">Teraz naucz się tych fiszek – zapamiętasz je lepiej, bo już próbowałeś odpowiedzieć.</p>' : ''}
      <div class="row" style="margin-top:12px"><button class="primary grow" data-act="m-train" data-k="${k}">Jeszcze raz</button><button class="grow" data-go="#/method/${mid}">Poradnik</button></div></div>` };
  }
  const c = mtCard(), n = c && noteById(c.noteId), v = c ? cardView(c) : { q: '', a: '' };
  const total = MT.k === 'relearn' ? Object.keys(MT.hits).length + MT.queue.filter(id => !(id in MT.hits)).length : MT.done + MT.queue.length;
  const prog = MT.k === 'relearn' ? `${MT.done}/${new Set([...MT.queue, ...Object.keys(MT.hits)]).size} opanowanych` : `${MT.done + 1}/${total}`;
  let body = '';
  if (k === 'why') body = `<div class="card flash">${v.q}<hr>${v.a}</div>
    <div class="card"><b>❓ ${MT.whyQ || WHY_Q[0]}</b><textarea id="mt-txt" rows="3" placeholder="1–2 zdania, własnymi słowami…">${esc(MT.txt || '')}</textarea>
    <div class="row"><button class="grow" data-act="mt-save-why">💡 Zapisz jako skojarzenie</button><button class="primary grow" data-act="mt-ok">Dalej ›</button></div></div>`;
  else if (MT.phase === 'q') {
    body = `<div class="card flash mt-q">${v.q}</div>` + ({
      pretest: `<input id="mt-txt" placeholder="Zgadnij – błędy są OK!" autocomplete="off"><button class="primary block" data-act="mt-show">Sprawdź</button>`,
      teach: `<p class="small muted">Wyjaśnij to prostymi słowami, jak 12-latkowi – bez żargonu. Możesz pisać albo dyktować 🎤 (klawiatura).</p><textarea id="mt-txt" rows="4" placeholder="To jest… działa tak, że… przykład:…">${esc(MT.txt || '')}</textarea><button class="primary block" data-act="mt-show">Porównaj z odpowiedzią</button>`,
      draw: `<p class="small muted">Narysuj z pamięci (schemat, szlak, strukturę), potem porównaj.</p><button class="primary block" data-act="mt-draw">✏️ Rysuj</button><button class="ghost block" data-act="mt-show">Pomiń rysowanie – pokaż</button>`,
      conf: `<p class="center small muted">Najpierw przypomnij sobie odpowiedź. Jak bardzo jesteś pewny?</p><div class="conf-row"><button data-act="mt-conf" data-l="0">🤷<small>zgaduję</small></button><button data-act="mt-conf" data-l="1">🙂<small>raczej wiem</small></button><button data-act="mt-conf" data-l="2">💯<small>pewny</small></button></div>`,
      relearn: `<button class="primary block" data-act="mt-show">Pokaż odpowiedź</button>`,
    }[k]);
  } else {
    body = `<div class="card flash">${v.q}<hr>${v.a}</div>` + ({
      pretest: `${MT.txt ? `<p class="small">Twoja odpowiedź: <b>${esc(MT.txt)}</b></p>` : ''}<div class="row"><button class="grow" data-act="mt-bad">✗ Nie zgadłem</button><button class="primary grow" data-act="mt-ok">✓ Zgadłem</button></div>`,
      teach: `<div class="card tight small"><b>Twoje wyjaśnienie:</b><p>${fmt(MT.txt || '—')}</p></div><div class="teach-check small"><label class="check"><input type="checkbox"> Bez trudnych słów</label><label class="check"><input type="checkbox"> Był przykład albo analogia</label><label class="check"><input type="checkbox"> Nic ważnego nie pominąłem</label></div>
        <div class="row"><button class="grow" data-act="mt-bad">Mam lukę – wrócę</button><button class="primary grow" data-act="mt-ok">Umiem to wytłumaczyć</button></div>`,
      draw: `${MT.drawing ? `<img class="mt-draw" src="${MT.drawing}" alt="Twój rysunek">` : ''}<div class="row">${MT.drawing ? '<button class="grow" data-act="mt-save-draw">💡 Zapisz rysunek jako skojarzenie</button>' : ''}</div>
        <div class="row" style="margin-top:8px"><button class="grow" data-act="mt-bad">✗ Dużo błędów</button><button class="primary grow" data-act="mt-ok">✓ Prawie wszystko</button></div>`,
      conf: `<div class="row"><button class="grow" data-act="mt-cbad">✗ Pomyliłem się</button><button class="primary grow" data-act="mt-cok">✓ Miałem rację</button></div>`,
      relearn: `<p class="center small muted">Ta fiszka: ${'●'.repeat(MT.hits[c.id] || 0)}${'○'.repeat(3 - (MT.hits[c.id] || 0))} (3 dobre = opanowana)</p><div class="row"><button class="grow" data-act="mt-bad">✗ Nie pamiętałem</button><button class="primary grow" data-act="mt-ok">✓ Pamiętałem</button></div>`,
    }[k]);
  }
  return { tab: 'home', focus: true, html: `
  <div class="studybar"><button class="iconbtn" data-act="mt-quit">✕</button><div class="title">${info[0]} ${info[1]}</div><span class="small muted">${prog}</span></div>
  ${body}` };
};
Object.assign(ACTIONS, {
  'm-train': el => mtStart(el.dataset.k),
  'm-go': el => { const m = mById(el.dataset.id); go(m.tryIt.go(mDeck())); S.stats['m_' + m.id] = mCount(m.id) + 1; save(); },
  'm-mix': () => { const d = deckById(mDeck()); if (!d) return; d.mix = true; touch(d); S.stats.m_interleave = mCount('interleave') + 1; save(); toast('🔀 Przeplatanie włączone w tej talii'); go('#/deck/' + d.id); },
  'mt-show': () => { MT.txt = $('#mt-txt')?.value || MT.txt || ''; MT.phase = 'a'; render(); },
  'mt-ok': () => mtNext(true), 'mt-bad': () => mtNext(false),
  'mt-conf': el => { MT.cl = +el.dataset.l; MT.phase = 'a'; render(); },
  'mt-cok': () => { MT.conf.push({ l: MT.cl, ok: true }); mtNext(true); },
  'mt-cbad': () => { MT.conf.push({ l: MT.cl, ok: false }); const c = mtCard(); if (MT.cl === 2 && c && c.srs.state === 'review') { c.srs = { ...c.srs, due: Math.min(c.srs.due, addDays(dayStart(), 1)) }; touch(c); } mtNext(false); },
  'mt-draw': async () => { const d = await openDrawPad(); if (d) { MT.drawing = d; MT.phase = 'a'; render(); } },
  'mt-save-draw': async () => { const c = mtCard(), n = c && noteById(c.noteId); if (!n || !MT.drawing) return; n.hintImg = await putImage(MT.drawing); touch(n); save(); toast('💡 Rysunek zapisany jako skojarzenie'); },
  'mt-save-why': () => { const c = mtCard(), n = c && noteById(c.noteId), t = ($('#mt-txt')?.value || '').trim(); if (!n || !t) return toast('Najpierw napisz wyjaśnienie'); n.hint = n.hint ? n.hint + ' · ' + t : t; touch(n); save(); toast('💡 Zapisano jako skojarzenie'); mtNext(true); },
  'mt-quit': () => { MT = null; history.length > 1 ? history.back() : go('#/methods'); },
});
document.addEventListener('input', e => { if (e.target.id === 'mt-txt' && MT) MT.txt = e.target.value; });
document.addEventListener('change', e => { if (e.target.dataset?.mdeck) { METHOD_DECK = e.target.value; render(); } });
// karta na Starcie
const mHome0 = homeExtrasHTML;
homeExtrasHTML = function () {
  const tip = METHODS[Math.floor(Date.now() / DAY) % METHODS.length];
  return mHome0() + `<div class="card row nowrap methods-home" data-go="#/method/${tip.id}"><span class="m-ic">${tip.icon}</span><div class="grow"><b>📖 Metoda dnia: ${tip.name}</b><div class="small muted">${tip.sub} · poradnik i trening</div></div><span>›</span></div>`;
};

'use strict';
/* 📚 Biblioteka Wieży wiedzy: duża pula pytań budowana z tabel danych (stolice, waluty, pierwiastki, lektury, obrazy,
   wynalazki, daty, słówka angielskie, województwa, matematyka). Każde pytanie ma stały klucz (z treści), dzięki czemu
   gk.js pamięta, o co już pytał – i nie wraca do niego, dopóki nie przerobisz całej puli danego poziomu.
   Złe odpowiedzi losowane deterministycznie (ziarno = klucz), więc to samo pytanie wygląda zawsze tak samo. */
const GKD = (() => {
  const h32 = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.codePointAt(0), 16777619); return h >>> 0; };
  const rng = seed => { let a = seed || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const out = [], seen = new Set();
  // 3 różne złe odpowiedzi z puli (bez poprawnej), stałe dla danego pytania
  const wrong = (key, ans, pool) => { const r = rng(h32(key)), p = [...new Set(pool.filter(x => x !== ans))], w = [];
    while (w.length < 3 && p.length) w.push(p.splice(Math.floor(r() * p.length), 1)[0]); return w; };
  const add = (type, lvl, cat, q, a, w, u = q) => { if (!w || w.length < 3 || seen.has(u)) return; seen.add(u); out.push({ k: type + '_' + h32(u).toString(36), lvl, cat, q, a: String(a), w: w.map(String) }); };

  // ---------- 🌍 państwa: mianownik | dopełniacz | stolica | kontynent | waluta | poziom
  const C = `Niemcy|Niemiec|Berlin|Europa|euro|1
Francja|Francji|Paryż|Europa|euro|1
Hiszpania|Hiszpanii|Madryt|Europa|euro|1
Włochy|Włoch|Rzym|Europa|euro|1
Portugalia|Portugalii|Lizbona|Europa|euro|1
Wielka Brytania|Wielkiej Brytanii|Londyn|Europa|funt szterling|1
Irlandia|Irlandii|Dublin|Europa|euro|2
Holandia|Holandii|Amsterdam|Europa|euro|2
Belgia|Belgii|Bruksela|Europa|euro|1
Szwajcaria|Szwajcarii|Berno|Europa|frank szwajcarski|2
Austria|Austrii|Wiedeń|Europa|euro|1
Czechy|Czech|Praga|Europa|korona czeska|1
Słowacja|Słowacji|Bratysława|Europa|euro|2
Węgry|Węgier|Budapeszt|Europa|forint|1
Rumunia|Rumunii|Bukareszt|Europa|lej rumuński|2
Bułgaria|Bułgarii|Sofia|Europa||2
Chorwacja|Chorwacji|Zagrzeb|Europa|euro|2
Słowenia|Słowenii|Lublana|Europa|euro|2
Serbia|Serbii|Belgrad|Europa|dinar serbski|2
Bośnia i Hercegowina|Bośni i Hercegowiny|Sarajewo|Europa||3
Czarnogóra|Czarnogóry|Podgorica|Europa||3
Macedonia Północna|Macedonii Północnej|Skopje|Europa||3
Albania|Albanii|Tirana|Europa||2
Grecja|Grecji|Ateny|Europa|euro|1
Turcja|Turcji|Ankara||lira turecka|2
Cypr|Cypru|Nikozja|||3
Malta|Malty|Valletta|Europa|euro|3
Dania|Danii|Kopenhaga|Europa|korona duńska|1
Norwegia|Norwegii|Oslo|Europa|korona norweska|1
Szwecja|Szwecji|Sztokholm|Europa|korona szwedzka|1
Finlandia|Finlandii|Helsinki|Europa|euro|1
Islandia|Islandii|Reykjavík|Europa|korona islandzka|2
Estonia|Estonii|Tallinn|Europa|euro|2
Łotwa|Łotwy|Ryga|Europa|euro|2
Litwa|Litwy|Wilno|Europa|euro|1
Białoruś|Białorusi|Mińsk|Europa||2
Ukraina|Ukrainy|Kijów|Europa|hrywna|1
Mołdawia|Mołdawii|Kiszyniów|Europa||3
Rosja|Rosji|Moskwa||rubel|1
Gruzja|Gruzji|Tbilisi|||3
Armenia|Armenii|Erywań|||3
Azerbejdżan|Azerbejdżanu|Baku|||3
Andora|Andory|Andora la Vella|Europa||3
Liechtenstein|Liechtensteinu|Vaduz|Europa||3
Chiny|Chin|Pekin|Azja|juan|1
Japonia|Japonii|Tokio|Azja|jen|1
Korea Południowa|Korei Południowej|Seul|Azja|won|2
Korea Północna|Korei Północnej|Pjongjang|Azja||2
Indie|Indii|Nowe Delhi|Azja|rupia indyjska|2
Pakistan|Pakistanu|Islamabad|Azja||3
Bangladesz|Bangladeszu|Dhaka|Azja||3
Tajlandia|Tajlandii|Bangkok|Azja|bat|2
Wietnam|Wietnamu|Hanoi|Azja|dong|2
Filipiny|Filipin|Manila|Azja||2
Malezja|Malezji|Kuala Lumpur|Azja||3
Mongolia|Mongolii|Ułan Bator|Azja||3
Kazachstan|Kazachstanu|Astana|||3
Uzbekistan|Uzbekistanu|Taszkent|Azja||3
Afganistan|Afganistanu|Kabul|Azja||3
Iran|Iranu|Teheran|Azja||2
Irak|Iraku|Bagdad|Azja||2
Syria|Syrii|Damaszek|Azja||2
Arabia Saudyjska|Arabii Saudyjskiej|Rijad|Azja|rial saudyjski|2
Zjednoczone Emiraty Arabskie|Zjednoczonych Emiratów Arabskich|Abu Zabi|Azja||3
Katar|Kataru|Doha|Azja||3
Jordania|Jordanii|Amman|Azja||3
Liban|Libanu|Bejrut|Azja||3
Nepal|Nepalu|Katmandu|Azja||3
Kambodża|Kambodży|Phnom Penh|Azja||3
Laos|Laosu|Wientian|Azja||3
Egipt|Egiptu|Kair|Afryka|funt egipski|1
Maroko|Maroka|Rabat|Afryka||2
Algieria|Algierii|Algier|Afryka||3
Tunezja|Tunezji|Tunis|Afryka||2
Libia|Libii|Trypolis|Afryka||3
Nigeria|Nigerii|Abudża|Afryka||3
Kenia|Kenii|Nairobi|Afryka||2
Etiopia|Etiopii|Addis Abeba|Afryka||2
Ghana|Ghany|Akra|Afryka||3
Senegal|Senegalu|Dakar|Afryka||3
Uganda|Ugandy|Kampala|Afryka||3
Angola|Angoli|Luanda|Afryka||3
Madagaskar|Madagaskaru|Antananarywa|Afryka||3
Zimbabwe|Zimbabwe|Harare|Afryka||3
Somalia|Somalii|Mogadiszu|Afryka||3
Sudan|Sudanu|Chartum|Afryka||3
Mali|Mali|Bamako|Afryka||3
Kamerun|Kamerunu|Jaunde|Afryka||3
Stany Zjednoczone|Stanów Zjednoczonych|Waszyngton|Ameryka Północna|dolar amerykański|1
Kanada|Kanady|Ottawa|Ameryka Północna|dolar kanadyjski|2
Brazylia|Brazylii|Brasília|Ameryka Południowa|real|2
Argentyna|Argentyny|Buenos Aires|Ameryka Południowa|peso argentyńskie|1
Chile|Chile|Santiago|Ameryka Południowa||2
Peru|Peru|Lima|Ameryka Południowa||2
Kolumbia|Kolumbii|Bogota|Ameryka Południowa||2
Wenezuela|Wenezueli|Caracas|Ameryka Południowa||2
Ekwador|Ekwadoru|Quito|Ameryka Południowa||3
Urugwaj|Urugwaju|Montevideo|Ameryka Południowa||3
Paragwaj|Paragwaju|Asunción|Ameryka Południowa||3
Kuba|Kuby|Hawana|Ameryka Północna||2
Jamajka|Jamajki|Kingston|Ameryka Północna||3
Kostaryka|Kostaryki|San José|Ameryka Północna||3
Haiti|Haiti|Port-au-Prince|Ameryka Północna||3
Dominikana|Dominikany|Santo Domingo|Ameryka Północna||3
Honduras|Hondurasu|Tegucigalpa|Ameryka Północna||3
Nikaragua|Nikaragui|Managua|Ameryka Północna||3
Australia|Australii|Canberra|Australia i Oceania|dolar australijski|2
Nowa Zelandia|Nowej Zelandii|Wellington|Australia i Oceania||2
Fidżi|Fidżi|Suva|Australia i Oceania||3
Papua-Nowa Gwinea|Papui-Nowej Gwinei|Port Moresby|Australia i Oceania||3`.split('\n').map(l => l.split('|'));
  const caps = C.map(c => c[2]), noms = C.map(c => c[0]), conts = ['Europa', 'Azja', 'Afryka', 'Ameryka Północna', 'Ameryka Południowa', 'Australia i Oceania'], curs = C.map(c => c[4]).filter(Boolean);
  for (const [nom, gen, cap, cont, cur, l] of C) {
    const lv = +l, sameCont = C.filter(c => c[3] && c[3] === cont).map(c => c[2]);
    const q1 = `Stolica ${gen} to:`; add('cap', lv, 'geo', q1, cap, wrong(q1, cap, sameCont.length > 6 ? sameCont : caps));
    const q2 = `${cap} to stolica którego państwa?`; add('capr', Math.min(3, lv + 1), 'geo', q2, nom, wrong(q2, nom, cont ? C.filter(c => c[3] === cont).map(c => c[0]) : noms));
    if (cont) { const q3 = `Na jakim kontynencie leży ${nom === 'Stany Zjednoczone' ? 'USA' : nom}?`; add('cont', lv, 'geo', q3, cont, wrong(q3, cont, conts)); }
    if (cur) { const q4 = `Waluta ${gen} to:`; add('cur', Math.min(3, lv + (cur === 'euro' ? 0 : 1)), 'geo', q4, cur, wrong(q4, cur, [...new Set(curs)])); }
  }
  // województwa
  const W = [['dolnośląskiego', 'Wrocław'], ['lubelskiego', 'Lublin'], ['łódzkiego', 'Łódź'], ['małopolskiego', 'Kraków'], ['mazowieckiego', 'Warszawa'], ['opolskiego', 'Opole'], ['podkarpackiego', 'Rzeszów'],
    ['podlaskiego', 'Białystok'], ['pomorskiego', 'Gdańsk'], ['śląskiego', 'Katowice'], ['świętokrzyskiego', 'Kielce'], ['warmińsko-mazurskiego', 'Olsztyn'], ['wielkopolskiego', 'Poznań'], ['zachodniopomorskiego', 'Szczecin']];
  for (const [w, c] of W) { const q = `Stolicą województwa ${w} jest:`; add('woj', ['Kraków', 'Warszawa', 'Gdańsk', 'Wrocław', 'Poznań'].includes(c) ? 1 : 2, 'geo', q, c, wrong(q, c, W.map(x => x[1]))); }

  // ---------- 🧪 pierwiastki: nazwa | symbol | liczba atomowa | poziom
  const E = `wodór|H|1|1
hel|He|2|1
lit|Li|3|2
beryl|Be|4|3
bor|B|5|3
węgiel|C|6|1
azot|N|7|1
tlen|O|8|1
fluor|F|9|2
neon|Ne|10|2
sód|Na|11|1
magnez|Mg|12|2
glin|Al|13|2
krzem|Si|14|2
fosfor|P|15|2
siarka|S|16|1
chlor|Cl|17|2
argon|Ar|18|2
potas|K|19|2
wapń|Ca|20|2
skand|Sc|21|3
tytan|Ti|22|2
wanad|V|23|3
chrom|Cr|24|2
mangan|Mn|25|3
żelazo|Fe|26|1
kobalt|Co|27|3
nikiel|Ni|28|2
miedź|Cu|29|1
cynk|Zn|30|2
gal|Ga|31|3
german|Ge|32|3
arsen|As|33|3
selen|Se|34|3
brom|Br|35|3
krypton|Kr|36|3
rubid|Rb|37|3
stront|Sr|38|3
pallad|Pd|46|3
srebro|Ag|47|1
kadm|Cd|48|3
cyna|Sn|50|2
antymon|Sb|51|3
jod|I|53|2
ksenon|Xe|54|3
cez|Cs|55|3
bar|Ba|56|3
wolfram|W|74|3
osm|Os|76|3
iryd|Ir|77|3
platyna|Pt|78|2
złoto|Au|79|1
rtęć|Hg|80|2
ołów|Pb|82|2
bizmut|Bi|83|3
polon|Po|84|2
radon|Rn|86|3
rad|Ra|88|2
uran|U|92|2
pluton|Pu|94|3`.split('\n').map(l => l.split('|'));
  for (const [n, s, z, l] of E) {
    const q1 = `Symbol chemiczny pierwiastka „${n}” to:`; add('el', +l, 'sci', q1, s, wrong(q1, s, E.map(e => e[1])));
    const q2 = `Pierwiastek o symbolu ${s} to:`; add('elr', +l, 'sci', q2, n, wrong(q2, n, E.map(e => e[0])));
    if (+z <= 30) { const q3 = `Liczba atomowa pierwiastka „${n}” to:`; add('elz', Math.min(3, +l + 1), 'sci', q3, z, wrong(q3, z, E.filter(e => +e[2] <= 36).map(e => e[2]))); }
  }

  // ---------- 📖 literatura: tytuł | autor | poziom
  const L = `Pan Tadeusz|Adam Mickiewicz|1
Dziady|Adam Mickiewicz|2
Lalka|Bolesław Prus|1
Faraon|Bolesław Prus|2
Kamizelka|Bolesław Prus|2
Antek|Bolesław Prus|3
Quo vadis|Henryk Sienkiewicz|1
W pustyni i w puszczy|Henryk Sienkiewicz|1
Krzyżacy|Henryk Sienkiewicz|2
Potop|Henryk Sienkiewicz|2
Ogniem i mieczem|Henryk Sienkiewicz|2
Pan Wołodyjowski|Henryk Sienkiewicz|2
Latarnik|Henryk Sienkiewicz|2
Janko Muzykant|Henryk Sienkiewicz|2
Chłopi|Władysław Reymont|2
Ziemia obiecana|Władysław Reymont|3
Wesele|Stanisław Wyspiański|2
Przedwiośnie|Stefan Żeromski|2
Syzyfowe prace|Stefan Żeromski|2
Ludzie bezdomni|Stefan Żeromski|3
Nad Niemnem|Eliza Orzeszkowa|2
Kordian|Juliusz Słowacki|2
Balladyna|Juliusz Słowacki|2
Zemsta|Aleksander Fredro|1
Śluby panieńskie|Aleksander Fredro|3
Ferdydurke|Witold Gombrowicz|3
Tango|Sławomir Mrożek|3
Solaris|Stanisław Lem|2
Cyberiada|Stanisław Lem|3
Wiedźmin|Andrzej Sapkowski|1
Treny|Jan Kochanowski|2
Odprawa posłów greckich|Jan Kochanowski|3
Inny świat|Gustaw Herling-Grudziński|3
Zdążyć przed Panem Bogiem|Hanna Krall|3
Kamienie na szaniec|Aleksander Kamiński|2
Granica|Zofia Nałkowska|3
Medaliony|Zofia Nałkowska|3
Sklepy cynamonowe|Bruno Schulz|3
Szewcy|Stanisław Ignacy Witkiewicz|3
Akademia pana Kleksa|Jan Brzechwa|1
Lokomotywa|Julian Tuwim|1
Dżuma|Albert Camus|2
Mały Książę|Antoine de Saint-Exupéry|1
Zbrodnia i kara|Fiodor Dostojewski|2
Mistrz i Małgorzata|Michaił Bułhakow|2
Romeo i Julia|William Szekspir|1
Hamlet|William Szekspir|1
Makbet|William Szekspir|2
Don Kichot|Miguel de Cervantes|2
Boska komedia|Dante Alighieri|2
Iliada|Homer|2
Odyseja|Homer|1
Antygona|Sofokles|2
Król Edyp|Sofokles|3
Władca Pierścieni|J.R.R. Tolkien|1
Hobbit|J.R.R. Tolkien|1
Rok 1984|George Orwell|2
Folwark zwierzęcy|George Orwell|2
Alicja w Krainie Czarów|Lewis Carroll|1
Przygody Tomka Sawyera|Mark Twain|2
Wojna i pokój|Lew Tołstoj|2
Anna Karenina|Lew Tołstoj|2
Duma i uprzedzenie|Jane Austen|2
Stary człowiek i morze|Ernest Hemingway|2
Proces|Franz Kafka|2
Przemiana|Franz Kafka|2
Faust|Johann Wolfgang von Goethe|2
Nędznicy|Wiktor Hugo|2
Trzej muszkieterowie|Aleksander Dumas (ojciec)|2
Robinson Crusoe|Daniel Defoe|2
Podróże Guliwera|Jonathan Swift|2
Frankenstein|Mary Shelley|2
Opowieść wigilijna|Charles Dickens|1
Sto lat samotności|Gabriel García Márquez|3
Buszujący w zbożu|J.D. Salinger|3
Wielki Gatsby|F. Scott Fitzgerald|3
Imię róży|Umberto Eco|3
Pinokio|Carlo Collodi|2
Kubuś Puchatek|A.A. Milne|1
Ania z Zielonego Wzgórza|Lucy Maud Montgomery|2
Chłopcy z Placu Broni|Ferenc Molnár|2
Dzieci z Bullerbyn|Astrid Lindgren|1
Pippi Pończoszanka|Astrid Lindgren|1`.split('\n').map(l => l.split('|'));
  for (const [t, a, l] of L) { const q = `Kto jest autorem utworu „${t}”?`; add('lit', +l, 'art', q, a, wrong(q, a, L.map(x => x[1]))); }

  for (const [t, a, l] of L) { const u = `litr:${t}`, other = L.filter(x => x[1] !== a).map(x => `„${x[0]}”`);
    add('litr', Math.min(3, +l + 1), 'art', `Który utwór napisał(a) ${a}?`, `„${t}”`, wrong(u, `„${t}”`, other), u); }
  // ---------- 🎨 obrazy i muzyka: dzieło | twórca | poziom
  const P = `Mona Lisa|Leonardo da Vinci|1
Ostatnia Wieczerza|Leonardo da Vinci|1
Dama z gronostajem|Leonardo da Vinci|1
Gwiaździsta noc|Vincent van Gogh|1
Słoneczniki|Vincent van Gogh|2
Krzyk|Edvard Munch|2
Dziewczyna z perłą|Jan Vermeer|2
Guernica|Pablo Picasso|2
Trwałość pamięci|Salvador Dalí|2
Narodziny Wenus|Sandro Botticelli|2
Stworzenie Adama|Michał Anioł|2
Bitwa pod Grunwaldem|Jan Matejko|1
Hołd pruski|Jan Matejko|2
Stańczyk|Jan Matejko|2
Rejtan|Jan Matejko|3
Pocałunek|Gustav Klimt|2
Impresja, wschód słońca|Claude Monet|3
Straż nocna|Rembrandt|3
Szał uniesień|Władysław Podkowiński|3
Babie lato|Józef Chełmoński|3
Czwórka|Józef Chełmoński|3
Wolność wiodąca lud na barykady|Eugène Delacroix|3
Tratwa Meduzy|Théodore Géricault|3
Ogród rozkoszy ziemskich|Hieronim Bosch|3
Panny dworskie (Las Meninas)|Diego Velázquez|3
Śniadanie na trawie|Édouard Manet|3
Melancholia|Jacek Malczewski|3`.split('\n').map(l => l.split('|'));
  for (const [t, a, l] of P) { const q = `Kto namalował obraz „${t}”?`; add('pnt', +l, 'art', q, a, wrong(q, a, P.map(x => x[1]))); }
  const M = `Cztery pory roku|Antonio Vivaldi|1
IX Symfonię z „Odą do radości”|Ludwig van Beethoven|1
Etiudę „Rewolucyjną”|Fryderyk Chopin|2
operę „Halka”|Stanisław Moniuszko|2
operę „Straszny dwór”|Stanisław Moniuszko|3
operę „Czarodziejski flet”|Wolfgang Amadeus Mozart|2
operę „Wesele Figara”|Wolfgang Amadeus Mozart|3
balet „Jezioro łabędzie”|Piotr Czajkowski|2
balet „Dziadek do orzechów”|Piotr Czajkowski|2
„Bolero”|Maurice Ravel|3
operę „Carmen”|Georges Bizet|3
„Toccatę i fugę d-moll”|Jan Sebastian Bach|2
operę „Aida”|Giuseppe Verdi|3
operę „Cyrulik sewilski”|Gioachino Rossini|3
cykl „Pierścień Nibelunga”|Richard Wagner|3`.split('\n').map(l => l.split('|'));
  for (const [t, a, l] of M) { const q = `Kto skomponował ${t}?`; add('mus', +l, 'art', q, a, wrong(q, a, M.map(x => x[1]))); }

  // ---------- 💡 odkrycia i wynalazki: co | kto | poziom
  const I = `wynalazł telefon (patent 1876)|Alexander Graham Bell|1
odkrył penicylinę|Alexander Fleming|2
stworzył teorię względności|Albert Einstein|1
sformułował prawo powszechnego ciążenia|Isaac Newton|1
stworzył model heliocentryczny|Mikołaj Kopernik|1
odkrył polon i rad (razem z mężem)|Maria Skłodowska-Curie|1
skonstruował lampę naftową|Ignacy Łukasiewicz|1
stworzył teorię ewolucji przez dobór naturalny|Karol Darwin|1
ułożył układ okresowy pierwiastków|Dmitrij Mendelejew|2
opracował szczepionkę przeciw wściekliźnie|Louis Pasteur|2
wynalazł druk ruchomą czcionką w Europie|Johannes Gutenberg|2
wynalazł dynamit|Alfred Nobel|2
skonstruował silnik wysokoprężny|Rudolf Diesel|2
odkrył promieniowanie rentgenowskie|Wilhelm Röntgen|2
stworzył World Wide Web|Tim Berners-Lee|2
stworzył psychoanalizę|Zygmunt Freud|2
odkrył prawo wyporu w cieczach|Archimedes|1
sformułował prawa ruchu planet|Johannes Kepler|3
odkrył grupy krwi|Karl Landsteiner|3
wynalazł logarytmy|John Napier|3
opisał elektromagnetyzm równaniami|James Clerk Maxwell|3
opracował pierwszą szczepionkę (przeciw ospie)|Edward Jenner|3
odkrył elektron|Joseph John Thomson|3
odkrył jądro atomowe|Ernest Rutherford|3
stworzył prawo zachowania masy w chemii|Antoine Lavoisier|3
wynalazł żarówkę, która podbiła świat (1879)|Thomas Edison|2`.split('\n').map(l => l.split('|'));
  for (const [t, a, l] of I) { const q = `Kto ${t}?`; add('inv', +l, 'tec', q, a, wrong(q, a, I.map(x => x[1]))); }

  // ---------- 📜 daty: wydarzenie | rok | poziom
  const H = `uchwalono Konstytucję 3 maja|1791|1
odbyła się odsiecz wiedeńska|1683|2
zawarto unię lubelską|1569|2
nastąpił I rozbiór Polski|1772|2
nastąpił II rozbiór Polski|1793|3
nastąpił III rozbiór Polski|1795|2
wybuchło powstanie listopadowe|1830|2
wybuchło powstanie styczniowe|1863|2
odbyła się Bitwa Warszawska („Cud nad Wisłą”)|1920|1
wybuchło powstanie warszawskie|1944|1
upadł mur berliński|1989|1
Polska weszła do Unii Europejskiej|2004|1
Polska weszła do NATO|1999|2
powstała „Solidarność”|1980|2
wprowadzono stan wojenny w Polsce|1981|2
zburzono Bastylię (rewolucja francuska)|1789|2
uchwalono Deklarację niepodległości USA|1776|2
upadł Konstantynopol|1453|3
wybuchła I wojna światowa|1914|1
wybuchła rewolucja październikowa w Rosji|1917|2
zaatakowano WTC w Nowym Jorku|2001|1
bracia Wright odbyli pierwszy lot samolotem|1903|3
człowiek wylądował na Księżycu|1969|1
odbyła się bitwa pod Hastings|1066|3
Karol Wielki został koronowany na cesarza|800|3
upadło cesarstwo zachodniorzymskie|476|3
zawarto pokój westfalski|1648|3
złożono hołd pruski|1525|2
założono Akademię Krakowską|1364|3
zawarto unię w Krewie|1385|3
odbyła się bitwa pod Cedynią|972|3
odbył się zjazd gnieźnieński|1000|2
koronowano Bolesława Chrobrego|1025|2
rozpoczął się potop szwedzki|1655|3
odbyła się bitwa pod Kircholmem|1605|3
zawiązano konfederację barską|1768|3
wybuchła insurekcja kościuszkowska|1794|2
utworzono Księstwo Warszawskie|1807|3
zakończył się kongres wiedeński|1815|3
wybuchła Wiosna Ludów|1848|2
zatonął Titanic|1912|2
doszło do katastrofy w Czarnobylu|1986|2
rozpadł się ZSRR|1991|2
Karol Wojtyła został wybrany na papieża|1978|2
zawarto II pokój toruński|1466|3
odbyła się bitwa pod Płowcami|1331|3
zmarł Kazimierz Wielki|1370|3
odbyła się pierwsza wolna elekcja|1573|3
zakończyła się II wojna światowa|1945|1
Jurij Gagarin poleciał w kosmos|1961|2`.split('\n').map(l => l.split('|'));
  for (const [t, y, l] of H) { const q = `W którym roku ${t}?`, Y = +y, r = rng(h32(q)), opts = new Set();
    while (opts.size < 3) { const d = (1 + Math.floor(r() * (Y > 1500 ? 12 : 40))) * (r() < .5 ? -1 : 1); if (Y + d > 0 && Y + d <= 2026 && d) opts.add(Y + d); }
    add('yr', +l, 'his', q, Y, [...opts]); }

  for (const [t, y, l] of H) { const q = `Co wydarzyło się w roku ${y}?`, A = t[0].toUpperCase() + t.slice(1), other = H.filter(x => x[1] !== y).map(x => x[0][0].toUpperCase() + x[0].slice(1));
    add('yrr', Math.min(3, +l + 1), 'his', q, A, wrong(q, A, other)); }
  // ---------- 🗣️ angielski: polski | angielski | poziom
  const V = `pies|dog|1
kot|cat|1
dom|house|1
jabłko|apple|1
książka|book|1
woda|water|1
chleb|bread|1
okno|window|1
drzwi|door|1
krzesło|chair|1
stół|table|1
samochód|car|1
szkoła|school|1
nauczyciel|teacher|1
kwiat|flower|1
drzewo|tree|1
słońce|sun|1
księżyc|moon|1
gwiazda|star|1
ręka|hand|1
oko|eye|1
ucho|ear|1
głowa|head|1
noga|leg|1
serce|heart|1
czerwony|red|1
zielony|green|1
żółty|yellow|1
mleko|milk|1
ser|cheese|1
jajko|egg|1
ryba|fish|1
ptak|bird|1
koń|horse|1
krowa|cow|1
świnia|pig|1
mysz|mouse|1
brat|brother|1
siostra|sister|1
przyjaciel|friend|1
miasto|city|1
ulica|street|1
morze|sea|1
góra|mountain|1
rzeka|river|1
deszcz|rain|1
śnieg|snow|1
zima|winter|1
lato|summer|1
jesień|autumn|1
poniedziałek|Monday|1
niedziela|Sunday|1
czwartek|Thursday|1
kuchnia|kitchen|1
łóżko|bed|1
pociąg|train|1
lotnisko|airport|1
szpital|hospital|1
pieniądze|money|1
herbata|tea|1
pielęgniarka|nurse|2
prawnik|lawyer|2
kierowca|driver|2
sąsiad|neighbour|2
ciotka|aunt|2
wujek|uncle|2
kolano|knee|2
łokieć|elbow|2
ramię|shoulder|2
wątroba|liver|2
płuca|lungs|2
nerka|kidney|2
czoło|forehead|2
broda|beard|2
wiewiórka|squirrel|2
sowa|owl|2
żaba|frog|2
motyl|butterfly|2
pszczoła|bee|2
mrówka|ant|2
pająk|spider|2
żółw|turtle|2
wąż|snake|2
marchewka|carrot|2
ziemniak|potato|2
cebula|onion|2
czosnek|garlic|2
truskawka|strawberry|2
gruszka|pear|2
śliwka|plum|2
kapusta|cabbage|2
ogórek|cucumber|2
grzyb|mushroom|2
młotek|hammer|2
nożyczki|scissors|2
poduszka|pillow|2
koc|blanket|2
lustro|mirror|2
schody|stairs|2
sufit|ceiling|2
dach|roof|2
piwnica|basement|2
wyspa|island|2
pustynia|desert|2
jezioro|lake|2
las|forest|2
chmura|cloud|2
mgła|fog|2
trzęsienie ziemi|earthquake|2
powódź|flood|2
odważny|brave|2
leniwy|lazy|2
zazdrosny|jealous|2
zmęczony|tired|2
głodny|hungry|2
dumny|proud|2
nieśmiały|shy|2
uprzejmy|polite|2
pożyczać (od kogoś)|borrow|2
zapominać|forget|2
pamiętać|remember|2
rozumieć|understand|2
płakać|cry|2
śmiać się|laugh|2
pływać|swim|2
budować|build|2
gotować|cook|2
wybaczać|forgive|2
obiecywać|promise|2
ostrzegać|warn|2
oddychać|breathe|2
przepis kulinarny|recipe|2
paragon|receipt|2
bagaż|luggage|2
rozkład jazdy|timetable|2
wynagrodzenie|salary|2
umowa|contract|2
pracodawca|employer|2
wytrwałość|perseverance|3
uprzedzenie|prejudice|3
sumienie|conscience|3
pobłażliwy|lenient|3
przebiegły|cunning|3
skrupulatny|meticulous|3
nieunikniony|inevitable|3
przewidywalny|predictable|3
zrównoważony (np. rozwój)|sustainable|3
ubóstwo|poverty|3
obfitość|abundance|3
przetrwanie|survival|3
przysięga|oath|3
oszczędności|savings|3
zysk|profit|3
dług|debt|3
wysiłek|effort|3
osiągnięcie|achievement|3
zaniedbanie|neglect|3
wyzwanie|challenge|3
przywilej|privilege|3
odpowiedzialność|responsibility|3
zaufanie|trust|3
zachęcać|encourage|3
unikać|avoid|3
przekonywać|persuade|3
przepraszać|apologise|3
zaprzeczać|deny|3
ujawniać|reveal|3
nalegać|insist|3
zasługiwać|deserve|3
wątpić|doubt|3
podziwiać|admire|3
sprzeciwiać się|oppose|3
przyspieszać|accelerate|3`.split('\n').map(l => l.split('|'));
  for (const [pl, en, l] of V) {
    const same = V.filter(v => v[2] === l);
    const q1 = `Jak po angielsku powiesz „${pl}”?`; add('en', +l, 'lan', q1, en, wrong(q1, en, same.map(v => v[1])));
    const q2 = `Co znaczy angielskie słowo „${en}”?`; add('enr', +l, 'lan', q2, pl, wrong(q2, pl, same.map(v => v[0])));
  }

  // ---------- 🧮 matematyka (generowana)
  const near = (key, a, spread, min = 0) => { const r = rng(h32(key)), s = new Set(); let g = 0;
    while (s.size < 3 && g++ < 200) { const d = (1 + Math.floor(r() * spread)) * (r() < .5 ? -1 : 1); if (a + d >= min && a + d !== a) s.add(a + d); } return [...s]; };
  for (let a = 3; a <= 12; a++) for (let b = a; b <= 12; b++) { const q = `Ile to jest ${a} × ${b}?`, v = a * b; add('mul', a <= 9 && b <= 9 ? 1 : 2, 'sci', q, v, near(q, v, Math.max(3, Math.round(v * .15)), 1)); }
  for (let n = 11; n <= 25; n++) { const q = `Ile to jest ${n}²?`; add('sq', n <= 15 ? 2 : 3, 'sci', q, n * n, near(q, n * n, 2 * n, 1)); }
  for (let n = 11; n <= 30; n++) { const q = `Pierwiastek kwadratowy z ${n * n} to:`; add('sqrt', n <= 20 ? 2 : 3, 'sci', q, n, near(q, n, 4, 2)); }
  for (let n = 5; n <= 12; n++) { const q = `Ile to jest 2 do potęgi ${n}?`; add('pow', n <= 8 ? 2 : 3, 'sci', q, 2 ** n, [2 ** (n - 1), 2 ** (n + 1), 2 ** n - 2 * n].filter(x => x !== 2 ** n)); }
  for (const p of [5, 10, 15, 20, 25, 50, 75]) for (const N of [40, 60, 80, 120, 200, 360, 500, 640]) { const v = N * p / 100; if (v % 1) continue;
    const q = `Ile to jest ${p}% z ${N}?`; add('pct', [10, 50].includes(p) ? 1 : p === 25 || p === 20 ? 2 : 3, 'sci', q, v, near(q, v, Math.max(3, Math.round(v * .3)), 1)); }
  const roman = n => [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']].reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, '');
  for (const n of [4, 9, 14, 19, 24, 29, 40, 44, 49, 59, 90, 99, 400, 444, 900, 966, 1410, 1683, 1791, 1918, 1999, 2024]) {
    const q = `Liczba rzymska ${roman(n)} to:`; add('rom', n < 50 ? 2 : 3, 'sci', q, n, near(q, n, n < 50 ? 6 : 30, 1));
    const q2 = `Jak zapisać ${n} cyframi rzymskimi?`; add('romr', n < 50 ? 2 : 3, 'sci', q2, roman(n), near(q2, n, n < 50 ? 6 : 30, 1).map(roman)); }
  const PR = [29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97], CO = [27, 33, 39, 49, 51, 57, 63, 69, 77, 81, 87, 91, 93, 95, 99];
  for (const p of PR) { const u = `prime:${p}`; add('prime', 3, 'sci', 'Która z tych liczb jest liczbą pierwszą?', p, wrong(u, p, CO), u); }
  { const r = rng(7);   // rachunki pamięciowe – stały zestaw (to samo ziarno = te same pytania)
    for (let i = 0; i < 90; i++) { const x = 12 + Math.floor(r() * 78), y = 11 + Math.floor(r() * 78), q = `Ile to jest ${x} + ${y}?`; add('add', 1, 'sci', q, x + y, near(q, x + y, 12, 1)); }
    for (let i = 0; i < 90; i++) { const x = 40 + Math.floor(r() * 150), y = 11 + Math.floor(r() * (x - 15)), q = `Ile to jest ${x} − ${y}?`; add('sub', 1, 'sci', q, x - y, near(q, x - y, 12, 0)); }
    for (let i = 0; i < 80; i++) { const b = 3 + Math.floor(r() * 10), v = 4 + Math.floor(r() * 16), q = `Ile to jest ${b * v} : ${b}?`; add('div', v > 10 ? 2 : 1, 'sci', q, v, near(q, v, 4, 1)); }
    for (let i = 0; i < 60; i++) { const x = 13 + Math.floor(r() * 30), y = 3 + Math.floor(r() * 7), q = `Ile to jest ${x} × ${y}?`; add('mul2', 2, 'sci', q, x * y, near(q, x * y, Math.max(6, Math.round(x * y * .1)), 1)); }
    for (let i = 0; i < 50; i++) { const d = [2, 3, 4, 5, 8, 10][Math.floor(r() * 6)], n = 1 + Math.floor(r() * (d - 1)), N = d * (2 + Math.floor(r() * 20)), q = `Ile to jest ${n}/${d} z ${N}?`; add('frac', 2, 'sci', q, N / d * n, near(q, N / d * n, 6, 1)); }
    for (let i = 0; i < 50; i++) { const a = 2 + Math.floor(r() * 9), x = 1 + Math.floor(r() * 12), b = 1 + Math.floor(r() * 20), q = `Rozwiąż: ${a}x + ${b} = ${a * x + b}. Ile wynosi x?`; add('eq', 3, 'sci', q, x, near(q, x, 4, 0)); }
  }
  // jednostki
  const U = [['Ile minut ma 2,5 godziny?', 150], ['Ile minut ma 1,5 godziny?', 90], ['Ile sekund ma 1 godzina?', 3600], ['Ile metrów ma 2,5 km?', 2500], ['Ile gramów ma 0,75 kg?', 750],
    ['Ile centymetrów ma 1,2 m?', 120], ['Ile mililitrów ma 1,5 litra?', 1500], ['Ile godzin ma tydzień?', 168], ['Ile minut ma doba?', 1440], ['Ile metrów kwadratowych ma 1 ar?', 100],
    ['Ile arów ma 1 hektar?', 100], ['Ile kilogramów ma 1 tona?', 1000], ['Ile milimetrów ma 1 metr?', 1000], ['Ile dni ma 6 tygodni?', 42], ['Ile miesięcy ma 2,5 roku?', 30]];
  for (const [q, v] of U) add('unit', v >= 1000 ? 2 : 1, 'sci', q, v, v === 100 ? [10, 1000, 50] : near(q, v, Math.max(5, Math.round(v * .25)), 1));
  return out;
})();

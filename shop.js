'use strict';
/* Kryształy 💎, sklep, skrzynki z ruletką (losowanie naklejek), album naklejek i efekty zwycięstwa.
   Saldo jest liczone z historii (osiągnięcia, cele dzienne, gry, bitwy) + zapis wydatków – dzięki temu
   synchronizacja między urządzeniami nie gubi ani nie dubluje kryształów. */

const RARITY = {
  common: { name: 'Zwykła', color: '#3b82f6', sell: 10 },
  rare: { name: 'Rzadka', color: '#8b5cf6', sell: 30 },
  epic: { name: 'Epicka', color: '#ec4899', sell: 90 },
  legendary: { name: 'Legendarna', color: '#f59e0b', sell: 300 },
  mythic: { name: 'Mityczna', color: '#dc2626', sell: 3000 },
};
const ST = (id, e, name, r, img) => ({ id, e, name, r, ...(img ? { img } : {}) });
// naklejka w HTML: obrazek (naklejki-obrazki, np. mityczna) albo emoji; w zwykłym tekście zostaje s.e
// ilustracje Fluent 3D (Microsoft, MIT) z białą „wyciętą” obwódką jak prawdziwa naklejka; brak pliku → emoji
const FLUENT_ST = new Set('thumb cool nerd books coffee monkey sleepy pizza turtle target muscle think phew wave clap fire brain zap rocket owl party angry mind goat clover crown gem unicorn dragon volcano ninja wizard trophy comet galaxy trident chick hatchling penguin parrot dino trex dragonling swan'.split(' '));
// styl naklejek (Ustawienia → Personalizacja): 'svg' – własne naklejki (domyślnie), '3d' – ilustracje Fluent, 'emoji'
const stStyle = () => S?.settings?.stStyle || 'svg';
const stE = s => s?.img ? `<img class="st-img" src="${s.img}" alt="${s.e}" draggable="false">`
  : !s ? '' : stStyle() === 'svg' && typeof stickerArt === 'function' && stickerArt(s) ? stickerArt(s)
  : stStyle() !== 'emoji' && FLUENT_ST.has(s.id) ? `<img class="st-img fl" src="assets/fluent/${s.id}.webp" alt="${s.e}" draggable="false">` : (s.e || '');
const caseIco = k => ['basic', 'epic', 'daily', 'gif'].includes(k) ? `<img class="case-img" src="assets/fluent/case_${k}.webp" alt="${CASES[k]?.icon || ''}" draggable="false">` : (CASES[k]?.icon || '');
const STICKERS = [
  ST('thumb', '👍', "Uśmiech", 'common', 'assets/stickers/px/157.webp'), ST('cool', '😎', "Kot szef", 'common', 'assets/stickers/px/057.webp'), ST('nerd', '🤓', "Panda w okularach", 'common', 'assets/stickers/px/033.webp'), ST('books', '📚', "Książka", 'common', 'assets/stickers/px/210.webp'),
  ST('coffee', '☕', "Kawa", 'common', 'assets/stickers/px/002.webp'), ST('monkey', '🙈', "Małpka", 'common', 'assets/stickers/px/201.webp'), ST('sleepy', '😴', "Śpioch", 'common', 'assets/stickers/px/072.webp'), ST('pizza', '🍕', "Pizza", 'common', 'assets/stickers/px/028.webp'),
  ST('turtle', '🐢', "Żółw", 'common', 'assets/stickers/px/095.webp'), ST('target', '🎯', "Zakaz", 'common', 'assets/stickers/px/163.webp'), ST('muscle', '💪', "Hantla", 'common', 'assets/stickers/px/108.webp'), ST('think', '🤔', "Mędrzec", 'common', 'assets/stickers/px/034.webp'),
  ST('phew', '😅', "Chmurka", 'common', 'assets/stickers/px/130.webp'), ST('wave', '👋', "Fala", 'common', 'assets/stickers/px/083.webp'), ST('clap', '👏', "Good Vibes", 'common', 'assets/stickers/px/019.webp'),
  ST('fire', '🔥', "Płomień", 'rare', 'assets/stickers/px/043.webp'), ST('brain', '🧠', "Mózg", 'rare', 'assets/stickers/px/101.webp'), ST('zap', '⚡', "Błyskawica", 'rare', 'assets/stickers/px/051.webp'), ST('rocket', '🚀', "Odrzutowiec", 'rare', 'assets/stickers/px/023.webp'),
  ST('owl', '🦉', "Drzemka", 'rare', 'assets/stickers/px/077.webp'), ST('party', '🎉', "Keep Going", 'rare', 'assets/stickers/px/038.webp'), ST('angry', '😤', "Zła żaba", 'rare', 'assets/stickers/px/171.webp'), ST('mind', '🤯', "Bobas w okularach", 'rare', 'assets/stickers/px/103.webp'),
  ST('goat', '🐐', "GOAT", 'rare', 'assets/stickers/px/000.webp'), ST('clover', '🍀', "Zielony motyl", 'rare', 'assets/stickers/px/148.webp'),
  ST('crown', '👑', "Korona", 'epic', 'assets/stickers/px/206.webp'), ST('gem', '💎', "Diament", 'epic', 'assets/stickers/px/044.webp'), ST('unicorn', '🦄', "Motyl", 'epic', 'assets/stickers/px/164.webp'), ST('dragon', '🐉', "Rekin z łapą", 'epic', 'assets/stickers/px/227.webp'),
  ST('volcano', '🌋', "Ogień", 'epic', 'assets/stickers/px/102.webp'), ST('ninja', '🥷', "Kot ninja", 'epic', 'assets/stickers/px/224.webp'), ST('wizard', '🧙', "Kapelusz czarodzieja", 'epic', 'assets/stickers/px/046.webp'),
  ST('trophy', '🏆', "Puchar", 'legendary', 'assets/stickers/px/058.webp'), ST('comet', '☄️', "Gwiezdny pył", 'legendary', 'assets/stickers/px/228.webp'), ST('galaxy', '🌌', "UFO", 'legendary', 'assets/stickers/px/209.webp'), ST('trident', '🔱', "Miecz", 'legendary', 'assets/stickers/px/205.webp'),
  // 👾 kolekcja 8-bit (pixel art)
  ST('px001', '👾', "Miś w czapce", 'common', 'assets/stickers/px/001.webp'), ST('px003', '👾', "Lizak", 'common', 'assets/stickers/px/003.webp'), ST('px004', '👾', "Leniwy kot", 'common', 'assets/stickers/px/004.webp'), ST('px005', '👾', "Żabka", 'rare', 'assets/stickers/px/005.webp'), ST('px006', '👾', "Kot w kapeluszu", 'common', 'assets/stickers/px/006.webp'), ST('px007', '👾', "Ognisko", 'common', 'assets/stickers/px/007.webp'), ST('px008', '👾', "Złota moneta", 'rare', 'assets/stickers/px/008.webp'), ST('px009', '👾', "Szop", 'common', 'assets/stickers/px/009.webp'), ST('px010', '👾', "Kot przebieraniec", 'common', 'assets/stickers/px/010.webp'), ST('px011', '👾', "Pies w okularach", 'rare', 'assets/stickers/px/011.webp'), ST('px012', '👾', "Wiedźma", 'rare', 'assets/stickers/px/012.webp'), ST('px013', '👾', "Serce", 'common', 'assets/stickers/px/013.webp'), ST('px014', '👾', "Kotek nocny", 'common', 'assets/stickers/px/014.webp'), ST('px016', '👾', "Kanapka", 'common', 'assets/stickers/px/016.webp'), ST('px017', '👾', "Kot w kubku", 'rare', 'assets/stickers/px/017.webp'), ST('px018', '👾', "Kotek", 'common', 'assets/stickers/px/018.webp'), ST('px020', '👾', "Koza", 'common', 'assets/stickers/px/020.webp'), ST('px021', '👾', "Płacząca żaba", 'rare', 'assets/stickers/px/021.webp'), ST('px024', '👾', "Diament z oczami", 'rare', 'assets/stickers/px/024.webp'), ST('px025', '👾', "Kot na czatach", 'common', 'assets/stickers/px/025.webp'), ST('px026', '👾', "Różowe serce", 'common', 'assets/stickers/px/026.webp'), ST('px027', '👾', "Kryształ", 'common', 'assets/stickers/px/027.webp'), ST('px029', '👾', "Czarny kot", 'common', 'assets/stickers/px/029.webp'), ST('px030', '👾', "Rudzielec", 'common', 'assets/stickers/px/030.webp'), ST('px031', '👾', "Kotek różowe uszy", 'common', 'assets/stickers/px/031.webp'), ST('px032', '👾', "Smutna żaba", 'rare', 'assets/stickers/px/032.webp'), ST('px035', '👾', "Pieseł", 'rare', 'assets/stickers/px/035.webp'), ST('px036', '👾', "Ziarno kawy", 'common', 'assets/stickers/px/036.webp'), ST('px037', '👾', "Kamera", 'common', 'assets/stickers/px/037.webp'), ST('px039', '👾', "Żabi król", 'epic', 'assets/stickers/px/039.webp'), ST('px040', '👾', "Kwiatek", 'common', 'assets/stickers/px/040.webp'), ST('px041', '👾', "Ziomek w czapce", 'common', 'assets/stickers/px/041.webp'), ST('px042', '👾', "Pręgowany kot", 'common', 'assets/stickers/px/042.webp'), ST('px045', '👾', "Gnom", 'common', 'assets/stickers/px/045.webp'), ST('px047', '👾', "Kot w smokingu", 'common', 'assets/stickers/px/047.webp'), ST('px048', '👾', "Zeszyt", 'common', 'assets/stickers/px/048.webp'), ST('px049', '👾', "Pióro", 'common', 'assets/stickers/px/049.webp'), ST('px050', '👾', "Fioletowy kot", 'rare', 'assets/stickers/px/050.webp'), ST('px052', '👾', "Wiewiórka", 'common', 'assets/stickers/px/052.webp'), ST('px053', '👾', "Plecak", 'common', 'assets/stickers/px/053.webp'), ST('px054', '👾', "Muchomor", 'common', 'assets/stickers/px/054.webp'), ST('px055', '👾', "Kot zrzęda", 'rare', 'assets/stickers/px/055.webp'), ST('px056', '👾', "Gogle", 'common', 'assets/stickers/px/056.webp'), ST('px059', '👾', "Księżycowy kot", 'common', 'assets/stickers/px/059.webp'), ST('px060', '👾', "Truskawka", 'common', 'assets/stickers/px/060.webp'), ST('px061', '👾', "Gwiazda", 'common', 'assets/stickers/px/061.webp'), ST('px062', '👾', "Just One More Rep", 'epic', 'assets/stickers/px/062.webp'), ST('px063', '👾', "Chili", 'common', 'assets/stickers/px/063.webp'), ST('px064', '👾', "Kawa na wynos", 'common', 'assets/stickers/px/064.webp'), ST('px065', '👾', "Kot o zielonych oczach", 'common', 'assets/stickers/px/065.webp'), ST('px066', '👾', "Śpiący lis", 'rare', 'assets/stickers/px/066.webp'), ST('px067', '👾', "Laptop z mocą", 'rare', 'assets/stickers/px/067.webp'), ST('px068', '👾', "No Signal", 'epic', 'assets/stickers/px/068.webp'), ST('px070', '👾', "Awokado", 'common', 'assets/stickers/px/070.webp'), ST('px071', '👾', "Chudy", 'rare', 'assets/stickers/px/071.webp'), ST('px073', '👾', "Kubek kawy", 'common', 'assets/stickers/px/073.webp'), ST('px074', '👾', "Namiot", 'common', 'assets/stickers/px/074.webp'), ST('px075', '👾', "Rogalik", 'common', 'assets/stickers/px/075.webp'), ST('px076', '👾', "Kalkulator", 'common', 'assets/stickers/px/076.webp'), ST('px078', '👾', "Złamane serce", 'common', 'assets/stickers/px/078.webp'), ST('px079', '👾', "Kubek z buźką", 'common', 'assets/stickers/px/079.webp'), ST('px080', '👾', "Fioletowy kryształ", 'common', 'assets/stickers/px/080.webp'), ST('px082', '👾', "Herbata", 'common', 'assets/stickers/px/082.webp'), ST('px084', '👾', "Kot w cylindrze", 'epic', 'assets/stickers/px/084.webp'), ST('px085', '👾', "Miś", 'common', 'assets/stickers/px/085.webp'), ST('px086', '👾', "Lisek", 'common', 'assets/stickers/px/086.webp'), ST('px087', '👾', "Niebieski kot", 'rare', 'assets/stickers/px/087.webp'), ST('px088', '👾', "Chomik", 'rare', 'assets/stickers/px/088.webp'), ST('px089', '👾', "Iskra", 'common', 'assets/stickers/px/089.webp'), ST('px090', '👾', "Sushi", 'common', 'assets/stickers/px/090.webp'), ST('px091', '👾', "Delfin", 'rare', 'assets/stickers/px/091.webp'), ST('px092', '👾', "Złoty puchar", 'rare', 'assets/stickers/px/092.webp'), ST('px093', '👾', "Brązowy kot", 'common', 'assets/stickers/px/093.webp'), ST('px094', '👾', "Ananas w koronie", 'rare', 'assets/stickers/px/094.webp'), ST('px096', '👾', "Rudy kot", 'common', 'assets/stickers/px/096.webp'), ST('px097', '👾', "Złota rybka", 'common', 'assets/stickers/px/097.webp'), ST('px098', '👾', "Kubek RIP", 'rare', 'assets/stickers/px/098.webp'), ST('px099', '👾', "Szary kot", 'common', 'assets/stickers/px/099.webp'), ST('px100', '👾', "Pochodnia", 'common', 'assets/stickers/px/100.webp'), ST('px104', '👾', "RIP", 'epic', 'assets/stickers/px/104.webp'), ST('px105', '👾', "Malina", 'common', 'assets/stickers/px/105.webp'), ST('px106', '👾', "404 Day", 'legendary', 'assets/stickers/px/106.webp'), ST('px107', '👾', "Pad", 'rare', 'assets/stickers/px/107.webp'), ST('px109', '👾', "Onigiri", 'common', 'assets/stickers/px/109.webp'), ST('px110', '👾', "Żaba DJ", 'epic', 'assets/stickers/px/110.webp'), ST('px111', '👾', "Żaba klasyk", 'rare', 'assets/stickers/px/111.webp'), ST('px112', '👾', "Pikselowe serce", 'common', 'assets/stickers/px/112.webp'), ST('px113', '👾', "Szop w okularach", 'rare', 'assets/stickers/px/113.webp'), ST('px114', '👾', "Game Boy", 'epic', 'assets/stickers/px/114.webp'), ST('px115', '👾', "Awokado ninja", 'common', 'assets/stickers/px/115.webp'), ST('px116', '👾', "Koi", 'common', 'assets/stickers/px/116.webp'), ST('px117', '👾', "Kot w berecie", 'rare', 'assets/stickers/px/117.webp'), ST('px118', '👾', "Latte", 'common', 'assets/stickers/px/118.webp'), ST('px119', '👾', "Energetyk", 'rare', 'assets/stickers/px/119.webp'), ST('px120', '👾', "Puszka", 'common', 'assets/stickers/px/120.webp'), ST('px121', '👾', "Nemo", 'common', 'assets/stickers/px/121.webp'), ST('px122', '👾', "Telewizor", 'common', 'assets/stickers/px/122.webp'), ST('px123', '👾', "Ser", 'common', 'assets/stickers/px/123.webp'), ST('px124', '👾', "Energetyk M", 'rare', 'assets/stickers/px/124.webp'), ST('px125', '👾', "Kanapka klubowa", 'common', 'assets/stickers/px/125.webp'), ST('px128', '👾', "Liść", 'common', 'assets/stickers/px/128.webp'), ST('px129', '👾', "Kot w kapturze", 'rare', 'assets/stickers/px/129.webp'), ST('px131', '👾', "Ćma", 'common', 'assets/stickers/px/131.webp'), ST('px132', '👾', "Żaba", 'common', 'assets/stickers/px/132.webp'), ST('px133', '👾', "Serce EKG", 'rare', 'assets/stickers/px/133.webp'), ST('px134', '👾', "Pręgus", 'common', 'assets/stickers/px/134.webp'), ST('px135', '👾', "Jeleń", 'common', 'assets/stickers/px/135.webp'), ST('px136', '👾', "Pióro feniksa", 'common', 'assets/stickers/px/136.webp'), ST('px137', '👾', "Gwiazdka", 'common', 'assets/stickers/px/137.webp'), ST('px138', '👾', "Pingwin zimowy", 'common', 'assets/stickers/px/138.webp'), ST('px139', '👾', "Płatek śniegu", 'common', 'assets/stickers/px/139.webp'), ST('px140', '👾', "Papryka", 'common', 'assets/stickers/px/140.webp'), ST('px141', '👾', "Kula", 'common', 'assets/stickers/px/141.webp'), ST('px142', '👾', "Winogrona", 'common', 'assets/stickers/px/142.webp'), ST('px143', '👾', "Lampa dżina", 'rare', 'assets/stickers/px/143.webp'), ST('px144', '👾', "Pełna bateria", 'common', 'assets/stickers/px/144.webp'), ST('px145', '👾', "Ognik", 'common', 'assets/stickers/px/145.webp'), ST('px146', '👾', "Kot w koszyku", 'rare', 'assets/stickers/px/146.webp'), ST('px147', '👾', "Burger", 'common', 'assets/stickers/px/147.webp'), ST('px149', '👾', "Ciastko", 'common', 'assets/stickers/px/149.webp'), ST('px150', '👾', "Słaba bateria", 'common', 'assets/stickers/px/150.webp'), ST('px151', '👾', "Napój", 'common', 'assets/stickers/px/151.webp'), ST('px152', '👾', "Delfinek", 'common', 'assets/stickers/px/152.webp'), ST('px153', '👾', "Pingwin szef", 'common', 'assets/stickers/px/153.webp'), ST('px154', '👾', "Aparat", 'common', 'assets/stickers/px/154.webp'), ST('px155', '👾', "Mapa skarbów", 'common', 'assets/stickers/px/155.webp'), ST('px156', '👾', "Szop bandyta", 'rare', 'assets/stickers/px/156.webp'), ST('px158', '👾', "Serduszka", 'common', 'assets/stickers/px/158.webp'), ST('px159', '👾', "Rybka", 'common', 'assets/stickers/px/159.webp'), ST('px160', '👾', "Kapelusz", 'common', 'assets/stickers/px/160.webp'), ST('px161', '👾', "Kawałek pizzy", 'common', 'assets/stickers/px/161.webp'), ST('px162', '👾', "Duszek wodny", 'rare', 'assets/stickers/px/162.webp'), ST('px165', '👾', "Wybuch", 'common', 'assets/stickers/px/165.webp'), ST('px166', '👾', "Galaretka", 'common', 'assets/stickers/px/166.webp'), ST('px167', '👾', "Lis drzemie", 'rare', 'assets/stickers/px/167.webp'), ST('px168', '👾', "Piłka", 'common', 'assets/stickers/px/168.webp'), ST('px169', '👾', "Precel", 'common', 'assets/stickers/px/169.webp'), ST('px170', '👾', "Ramen", 'common', 'assets/stickers/px/170.webp'), ST('px172', '👾', "Krab", 'common', 'assets/stickers/px/172.webp'), ST('px173', '👾', "Elf", 'rare', 'assets/stickers/px/173.webp'), ST('px174', '👾', "Bambus", 'common', 'assets/stickers/px/174.webp'), ST('px176', '👾', "Słońce", 'common', 'assets/stickers/px/176.webp'), ST('px177', '👾', "Wróżka", 'rare', 'assets/stickers/px/177.webp'), ST('px178', '👾', "Klepsydra", 'rare', 'assets/stickers/px/178.webp'), ST('px179', '👾', "Zombie", 'rare', 'assets/stickers/px/179.webp'), ST('px180', '👾', "Ogórek", 'common', 'assets/stickers/px/180.webp'), ST('px181', '👾', "Ciastko z czekoladą", 'common', 'assets/stickers/px/181.webp'), ST('px182', '👾', "Granat", 'common', 'assets/stickers/px/182.webp'), ST('px183', '👾', "Kot z sercem", 'rare', 'assets/stickers/px/183.webp'), ST('px184', '👾', "Słońce w okularach", 'rare', 'assets/stickers/px/184.webp'), ST('px185', '👾', "Rybka w słoiku", 'common', 'assets/stickers/px/185.webp'), ST('px186', '👾', "Pączek", 'common', 'assets/stickers/px/186.webp'), ST('px187', '👾', "Zielony kot", 'common', 'assets/stickers/px/187.webp'), ST('px188', '👾', "Frytki", 'common', 'assets/stickers/px/188.webp'), ST('px189', '👾', "Bilet", 'common', 'assets/stickers/px/189.webp'), ST('px190', '👾', "Ośmiornica", 'common', 'assets/stickers/px/190.webp'), ST('px191', '👾', "Retro komputer", 'rare', 'assets/stickers/px/191.webp'), ST('px192', '👾', "Kot skrzydlaty", 'common', 'assets/stickers/px/192.webp'), ST('px193', '👾', "Fioletowe serce", 'common', 'assets/stickers/px/193.webp'), ST('px194', '👾', "Butelka", 'common', 'assets/stickers/px/194.webp'), ST('px195', '👾', "Piesek", 'common', 'assets/stickers/px/195.webp'), ST('px196', '👾', "Ciasto", 'common', 'assets/stickers/px/196.webp'), ST('px197', '👾', "Różowy mózg", 'common', 'assets/stickers/px/197.webp'), ST('px198', '👾', "Kapelusz z piórem", 'common', 'assets/stickers/px/198.webp'), ST('px199', '👾', "Kubek z czaszką", 'rare', 'assets/stickers/px/199.webp'), ST('px200', '👾', "Wesołe słońce", 'common', 'assets/stickers/px/200.webp'), ST('px202', '👾', "Niebieskie serce", 'common', 'assets/stickers/px/202.webp'), ST('px203', '👾', "Pół awokado", 'common', 'assets/stickers/px/203.webp'), ST('px204', '👾', "Góry", 'common', 'assets/stickers/px/204.webp'), ST('px207', '👾', "Kalendarz", 'common', 'assets/stickers/px/207.webp'), ST('px208', '👾', "Złota gwiazdka", 'common', 'assets/stickers/px/208.webp'), ST('px211', '👾', "Kawa czarna", 'common', 'assets/stickers/px/211.webp'), ST('px213', '👾', "Bułka", 'common', 'assets/stickers/px/213.webp'), ST('px214', '👾', "Kot krowa", 'common', 'assets/stickers/px/214.webp'), ST('px215', '👾', "Księga zaklęć", 'rare', 'assets/stickers/px/215.webp'), ST('px216', '👾', "Mikrofon", 'common', 'assets/stickers/px/216.webp'), ST('px217', '👾', "Stek", 'common', 'assets/stickers/px/217.webp'), ST('px218', '👾', "Arbuz", 'common', 'assets/stickers/px/218.webp'), ST('px219', '👾', "Duszek", 'rare', 'assets/stickers/px/219.webp'), ST('px220', '👾', "Roślinka", 'common', 'assets/stickers/px/220.webp'), ST('px221', '👾', "Pingwin z szalikiem", 'common', 'assets/stickers/px/221.webp'), ST('px222', '👾', "Meduza", 'rare', 'assets/stickers/px/222.webp'), ST('px223', '👾', "Woda", 'common', 'assets/stickers/px/223.webp'), ST('px225', '👾', "Kot błękitny", 'common', 'assets/stickers/px/225.webp'), ST('px226', '👾', "Kot sierściuch", 'common', 'assets/stickers/px/226.webp'), ST('px229', '👾', "Kropla", 'common', 'assets/stickers/px/229.webp'),
  ST('soldiercat', '🪖', 'Kot żołnierz', 'mythic', 'assets/stickers/kot-zolnierz-cut.webp'),
  // 🥚 tylko z inkubatora (egg.js) – nie wypadają ze skrzynek
  ...[ST('chick', '🐣', "Pisklak", 'common', 'assets/stickers/px/069.webp'), ST('hatchling', '🐥', "Pingwinek", 'common', 'assets/stickers/px/022.webp'), ST('penguin', '🐧', "Pingwin", 'rare', 'assets/stickers/px/127.webp'), ST('parrot', '🦜', "Papuga", 'rare', 'assets/stickers/px/212.webp'),
    ST('dino', '🦕', "Kameleon", 'epic', 'assets/stickers/px/081.webp'), ST('trex', '🦖', "Rekin", 'epic', 'assets/stickers/px/175.webp'), ST('dragonling', '🐲', "Smoczy liść", 'legendary', 'assets/stickers/px/015.webp'), ST('swan', '🦢', "Kaczka", 'legendary', 'assets/stickers/px/126.webp')].map(s => ({ ...s, hatch: true })),
];
// 🔴 ultra rzadkie dropy w każdej skrzynce: mityczna naklejka i mega pula kryształów (po 0,1%)
const MYTHIC_P = .1, MEGA_GEMS_P = .1, MEGA_GEMS = 10000;
// mityczna naklejka nie wypada ze skrzynki z GIF-ami (tam tylko mega kryształy)
const mythicP = k => CASES[k]?.gif ? 0 : MYTHIC_P;
const FREE_STICKERS = ['wave', 'thumb', 'phew'];
const stickerById = id => STICKERS.find(s => s.id === id);
// cele osiągnięć kolekcjonerskich = aktualna liczba naklejek
if (typeof ACHIEVEMENTS !== 'undefined') for (const [id, n] of [['album_full', STICKERS.filter(x => x.r !== 'mythic' && !x.hatch).length], ['legends_all', STICKERS.filter(x => x.r === 'legendary' && !x.hatch).length], ['hatch_all', STICKERS.filter(x => x.hatch).length]]) { const a = ACHIEVEMENTS.find(x => x.id === id); if (a) a.goal = n; }
const CASES = {
  basic: { name: 'Skrzynka nauki', icon: '📦', price: 120, odds: { common: 70, rare: 22, epic: 6.5, legendary: 1.5 } },
  epic: { name: 'Skrzynka mistrza', icon: '🎁', price: 350, odds: { common: 38, rare: 36, epic: 20, legendary: 6 } },
  daily: { name: 'Codzienna skrzynka', icon: '🌞', price: 0, odds: { common: 45, rare: 33, epic: 16, legendary: 6 }, freeOnly: true },
  // GIF-y wgrywa host w panelu; skrzynka pokazuje się, gdy jest choć jeden
  gif: { name: 'Skrzynka z GIF-ami', icon: '🎞️', price: 250, odds: { common: 55, rare: 30, epic: 12, legendary: 3 }, gif: true },
};
// Komplet naklejek danej rzadkości = jednorazowa premia
const SET_BONUS = { common: 200, rare: 400, epic: 800, legendary: 2000 };
const setComplete = r => STICKERS.filter(s => s.r === r && !s.hatch).every(s => hasItem('sticker', s.id) || hasItem('shiny', s.id));
const isShiny = id => hasItem('shiny', id);
// 🌈 trzeci poziom: złota → holograficzna (za kryształy). Jedna waluta: dawny „pył gwiezdny” = kryształy (1 pył = 3 💎).
const isHolo = id => hasItem('holo', id);
const shinyLv = id => isHolo(id) ? 2 : isShiny(id) ? 1 : 0;
const fxCls = lv => lv >= 2 ? ' shiny holo' : lv ? ' shiny' : '';
const DUST_RATE = 3;
const dust = () => coins();
const addDust = (n, id) => { if (!S.wallet.some(w => w.id === (id || ''))) S.wallet.push({ id: id || uid(), n: Math.round(n * DUST_RATE), why: 'dust', t: Date.now() }); };
const HOLO_COST = { common: 60, rare: 120, epic: 240, legendary: 450, mythic: 1200 };
// przeniesienie starego pyłu na kryształy (raz; stałe id – synchronizacja nie dubluje)
on('start', () => { const n = itemCount('dust', 'dust'); if (n > 0) { addItem('dust', 'dust', -n, 'dust-mig-' + n); S.wallet.push({ id: 'dust-mig-' + n, n: n * DUST_RATE, why: 'dust', t: Date.now() }); save(); } });
const DUST_OF = { common: 2, rare: 5, epic: 12, legendary: 30, mythic: 150 };
const EFFECTS = [
  { id: 'classic', name: 'Konfetti', icon: '🎊', price: 0 },
  { id: 'stars', name: 'Gwiazdy', icon: '⭐', price: 150, chars: ['⭐', '✨', '🌟'] },
  { id: 'hearts', name: 'Serca', icon: '💖', price: 150, chars: ['💖', '💜', '💙'] },
  { id: 'gems', name: 'Deszcz diamentów', icon: '💎', price: 250, chars: ['💎', '💠'] },
  { id: 'fire', name: 'Płomienie', icon: '🔥', price: 250, chars: ['🔥', '💥'] },
  { id: 'brains', name: 'Mózgi', icon: '🧠', price: 300, chars: ['🧠', '⚡'] },
];

// ---------- saldo i ekwipunek
// Ochrona przed „przeklikiwaniem”: przewinięta fiszka (tryb Fiszki) jest warta 10× mniej niż odpowiedź
// wpisana albo wybrana w teście, a przewinięta szybciej niż w 1,5 s – nic. Stare wpisy (sprzed tej zmiany,
// bez pola m) liczą się po staremu, żeby nikomu nie zmalało saldo.
const FLIP_MIN_MS = 1500;
const studyPoints = l => !l.m ? 1 : l.m === 'flip' ? (l.ms >= FLIP_MIN_MS ? .1 : 0) : 1;                 // do celu dziennego
const studyGems = l => !l.m ? 0 : l.m === 'flip' ? (l.ms >= FLIP_MIN_MS ? .05 : 0) : ({ ok: .5, close: .3 }[l.v] ?? .1);   // 💎 za samą naukę
const QUIZ_GEM_CAP = 150;   // max 💎 dziennie z testów ABCD / pisemnych
function earnedCoins() {
  let c = Object.keys(S.ach).reduce((a, id) => a + (typeof achReward === 'function' ? achReward(id) : 30), 0);   // trudne osiągnięcia: 150
  const perDay = {}; let study = 0;
  for (const l of S.log) { const k = dayKey(l.t); perDay[k] = (perDay[k] || 0) + studyPoints(l); study += studyGems(l); }
  c += Object.values(perDay).filter(n => n >= (S.settings.goal || 50)).length * 20 + Math.floor(study);
  for (const g of S.games) if (!g.practice) c += Math.floor((g.correct || 0) / 4);
  for (const b of S.battles) c += battleReward(b);
  for (const r in SET_BONUS) if (setComplete(r)) c += SET_BONUS[r];
  return c;
}
function battleReward(b) { return b.bot ? ({ 1: 20, 0: 10, '-1': 5 }[b.won] || 0) : ({ 1: 50, 0: 25, '-1': 10 }[b.won] || 0); }
const coins = () => earnedCoins() + S.wallet.reduce((a, w) => a + w.n, 0);
function spend(n, why) {
  if (coins() < n) { toast(`Brakuje ${n - coins()} 💎`); return false; }
  S.wallet.push({ id: uid(), n: -n, why, t: Date.now() }); save(); return true;
}
const itemCount = (kind, key) => S.items.filter(i => i.kind === kind && i.key === key).reduce((a, i) => a + (i.q ?? 1), 0);
const hasItem = (kind, key) => itemCount(kind, key) > 0;
const addItem = (kind, key, q = 1, id = uid()) => { if (S.items.some(i => i.id === id)) return; S.items.push({ id, kind, key, q, t: Date.now() }); save(); };
const ownedStickers = () => [...new Set([...FREE_STICKERS, ...STICKERS.filter(s => hasItem('sticker', s.id) || hasItem('shiny', s.id)).map(s => s.id)])];
const stickerTile = (id, extra = '') => { const s = stickerById(id); if (!s) return ''; return `<span class="mini-st${fxCls(shinyLv(id))}" style="--rc:${RARITY[s.r].color}" title="${esc(s.name)}"${extra}>${stE(s)}</span>`; };
const showcaseHTML = ids => (ids || []).filter(id => stickerById(id)).slice(0, 3).map(id => stickerTile(id)).join('');
const coinsHTML = () => `<span class="coins">💎 ${coins()}</span>`;

function rollRarity(odds) {
  let r = Math.random() * 100;
  for (const k of ['legendary', 'epic', 'rare', 'common']) { if (r < odds[k]) return k; r -= odds[k]; }
  return 'common';
}
const rollSticker = odds => { const r = rollRarity(odds), pool = STICKERS.filter(s => s.r === r && !s.hatch); return pool[Math.random() * pool.length | 0]; };
// Poza naklejkami w skrzynce mogą wypaść kryształy (różne kwoty, rzadko „jackpot”) albo darmowe ponowne losowanie
const CASE_EXTRA = { gems: 20, respin: 7 };   // % szans
// progi kryształów (pospolite → legendarne); legendarny drop = 1000 💎
const GEM_PRIZES = { basic: [[20, 50], [50, 30], [150, 17], [1000, 3]], epic: [[60, 48], [150, 30], [400, 17], [1000, 5]], gif: [[40, 50], [100, 30], [250, 16], [1000, 4]] };
// w zwykłych skrzynkach (nie GIF-owej) może wypaść GIF – tylko legendarny; % szans
const CASE_GIF = { basic: 1, epic: 2, daily: 1.5 };
const legendGifReady = () => typeof GIF_CASE !== 'undefined' && GIF_CASE.some(g => g.r === 'legendary');
const GIF_DUP = { common: 25, rare: 60, epic: 150, legendary: 400 };   // duplikat GIF-a zamienia się w kryształy
const gifCaseReady = () => typeof GIF_CASE !== 'undefined' && GIF_CASE.length > 0;
function rollGif(odds, force) {
  const have = r => GIF_CASE.some(g => (g.r || 'common') === r);
  let r = force && RARITY[force] && have(force) ? force : null;
  if (!r) { const o = Object.fromEntries(Object.entries(odds).filter(([x]) => have(x))), sum = Object.values(o).reduce((a, b) => a + b, 0);
    let y = Math.random() * sum; for (const [x, p] of Object.entries(o)) { if (y < p) { r = x; break; } y -= p; } r = r || Object.keys(o)[0]; }
  const pool = GIF_CASE.filter(g => (g.r || 'common') === r), g = pool[Math.random() * pool.length | 0];
  return { kind: 'gif', id: g.id, g, e: '🎞️', name: g.name || 'GIF', r };
}
function rollPrize(k, odds, force) {
  if (force === 'mythic') return STICKERS.find(s => s.r === 'mythic');
  if (force === 'mega') return { kind: 'gems', id: 'gems' + MEGA_GEMS, n: MEGA_GEMS, e: '💎', name: `+${MEGA_GEMS} 💎`, r: 'mythic' };
  if (!force) { const y = Math.random() * 100, mp = mythicP(k); if (y < mp) return rollPrize(k, odds, 'mythic'); if (y < mp + MEGA_GEMS_P) return rollPrize(k, odds, 'mega'); }
  const x = Math.random() * 100;
  if (force === 'lgif') return legendGifReady() ? rollGif({ legendary: 100 }, 'legendary') : rollSticker({ legendary: 100 });
  if (force === 'gems' || force === 'jackpot' || (!force && x < CASE_EXTRA.gems)) {
    const t = GEM_PRIZES[k] || GEM_PRIZES.basic; let y = force === 'jackpot' ? 100 : Math.random() * 100;
    for (let i = 0; i < t.length; i++) { const [n, p] = t[i]; if (y < p || i === t.length - 1) return { kind: 'gems', id: 'gems' + n, n, e: '💎', name: `+${n} 💎`, r: ['common', 'rare', 'epic', 'legendary'][i] }; y -= p; }
  }
  if (force === 'respin' || (!force && x < CASE_EXTRA.gems + CASE_EXTRA.respin)) return { kind: 'respin', id: 'respin', e: '🔁', name: 'Jeszcze raz!', r: 'epic' };
  if (CASES[k]?.gif && gifCaseReady()) return rollGif(odds, force);
  if (!force && CASE_GIF[k] && legendGifReady() && Math.random() * 100 < CASE_GIF[k]) return rollGif({ legendary: 100 }, 'legendary');
  return rollSticker(force && RARITY[force] ? { [force]: 100 } : odds);
}
// ---------- zawartość skrzynki: dokładne szanse (te same reguły co rollPrize)
function caseDrops(k) {
  const c = CASES[k], f = (100 - mythicP(k) - MEGA_GEMS_P) / 100, out = [];
  const add = (p, x, group) => out.push({ p, x, group });
  if (mythicP(k)) add(mythicP(k), STICKERS.find(s => s.r === 'mythic'), 'ultra');
  add(MEGA_GEMS_P, { kind: 'gems', e: '💎', name: `${MEGA_GEMS} kryształów`, r: 'mythic' }, 'ultra');
  const t = GEM_PRIZES[k] || GEM_PRIZES.basic;
  t.forEach(([n, p], i) => add(f * CASE_EXTRA.gems * p / 100, { kind: 'gems', e: '💎', name: `${n} kryształów`, r: ['common', 'rare', 'epic', 'legendary'][i] }, 'gems'));
  add(f * CASE_EXTRA.respin, { kind: 'respin', e: '🔁', name: 'Losuj jeszcze raz', r: 'epic' }, 'gems');
  let rest = f * (100 - CASE_EXTRA.gems - CASE_EXTRA.respin);
  const perRarity = (odds, pool, group, toX) => {
    const o = Object.entries(odds).filter(([r]) => pool.some(x => (x.r || 'common') === r)), sum = o.reduce((a, [, p]) => a + p, 0);
    for (const [r, p] of o) { const items = pool.filter(x => (x.r || 'common') === r); items.forEach(x => add(rest * p / sum / items.length, toX(x, r), group)); }
  };
  if (c.gif && gifCaseReady()) { perRarity(c.odds, GIF_CASE, 'gif', (g, r) => ({ kind: 'gif', g, e: '🎞️', name: g.name || 'GIF', r })); return out; }
  if (CASE_GIF[k] && legendGifReady()) {
    const pool = GIF_CASE.filter(g => g.r === 'legendary');
    pool.forEach(g => add(rest * CASE_GIF[k] / 100 / pool.length, { kind: 'gif', g, e: '🎞️', name: g.name || 'GIF', r: 'legendary' }, 'gif'));
    rest *= 1 - CASE_GIF[k] / 100;
  }
  perRarity(c.odds, STICKERS.filter(s => s.r !== 'mythic' && !s.hatch), 'st', s => s);
  return out;
}
const pctFmt = p => (p >= 10 ? p.toFixed(1) : p >= 1 ? p.toFixed(2) : p >= .1 ? p.toFixed(2) : p.toFixed(3)).replace(/\.?0+$/, '').replace('.', ',') + '%';
function caseDropsHTML(k) {
  const c = CASES[k], d = caseDrops(k);
  const sum = g => d.filter(x => x.group === g).reduce((a, x) => a + x.p, 0);
  const row = ({ p, x }) => `<div class="drop-row" style="--rc:${RARITY[x.r].color}"><span class="drop-ic">${x.kind === 'gif' ? gifImg(x.g) : stE(x)}</span>
    <span class="grow"><b>${esc(x.name)}</b><small style="color:${RARITY[x.r].color}">${x.kind === 'respin' ? 'Darmowe losowanie' : RARITY[x.r].name}${x.kind === 'sticker' || !x.kind ? (hasItem('sticker', x.id) || hasItem('shiny', x.id) ? ' · ✓ masz' : ' · brak w albumie') : ''}</small></span><b class="drop-p">${pctFmt(p)}</b></div>`;
  const sec = (g, title) => d.some(x => x.group === g) ? `<h3>${title} <small class="muted">${pctFmt(sum(g))}</small></h3>${d.filter(x => x.group === g).sort((a, b) => b.p - a.p).map(row).join('')}` : '';
  return `<div class="drops-box"><div class="row nowrap"><span style="font-size:34px">${c.icon}</span><div class="grow"><b style="font-size:18px">${c.name}</b><div class="small muted">Zawartość skrzynki i szanse na każdy przedmiot</div></div><button class="iconbtn" data-act="drops-close">✕</button></div>
    <div class="drops-list">${sec('ultra', '🔴 Ultra rzadkie')}${sec('gems', '💎 Kryształy i bonusy')}${sec('gif', '🎞️ GIF-y')}${sec('st', '🏷️ Naklejki')}</div>
    <p class="small muted" style="margin:0">Szanse sumują się do 100%. Duplikat naklejki możesz sprzedać albo zebrać 3 i ulepszyć do złotej ✨.</p></div>`;
}
function showCaseDrops(k) {
  document.querySelector('.drops-ov')?.remove();
  const ov = document.createElement('div'); ov.className = 'drops-ov'; ov.innerHTML = caseDropsHTML(k);
  ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-act="drops-close"]')) { e.stopPropagation(); ov.remove(); } });
  document.body.append(ov);
}
const prizeTile = s => `<div class="tile${s.kind ? ' prize-' + s.kind : ''}" style="--rc:${RARITY[s.r].color}"><span>${s.kind === 'gif' ? gifImg(s.g) : stE(s)}</span><small>${esc(s.name)}</small></div>`;

// ---------- sklep
ROUTES.shop = () => {
  const freeKinds = Object.keys(CASES).filter(k => hasItem('case', k));
  const freeN = freeKinds.reduce((a, k) => a + itemCount('case', k), 0);
  const owned = STICKERS.filter(s => hasItem('sticker', s.id) || hasItem('shiny', s.id)).length;
  const showcase = S.profile.showcase || [];
  return { tab: 'train', html: `
  <div class="row nowrap"><button class="iconbtn" data-go="#/battles">‹</button><h1 class="grow">Sklep</h1>${coinsHTML()}</div>
  <details class="small muted shop-info"><summary>Skąd brać kryształy 💎?</summary>
    <p>Bitwy, osiągnięcia (od 30 💎 za łatwe do 600 💎 za legendarne, platyna 2000 💎), dni z celem dziennym (20 💎), zadania dnia, testy, gry pamięciowe – i skrzynki. 🌞 <b>Codzienna skrzynka</b> (lepsze szanse!) za ukończony zestaw fiszek albo cel dzienny.</p></details>
  ${freeN ? `<div class="banner row nowrap"><span class="grow">🎁 Masz <b>${freeN}</b> darmowe ${plural(freeN, 'skrzynkę', 'skrzynki', 'skrzynek')}: ${freeKinds.map(k => `${CASES[k].icon} ${CASES[k].name} ×${itemCount('case', k)}`).join(', ')}</span>
    <button class="primary sm" data-go="#/case/${freeKinds[0]}?free=1">Otwórz</button></div>` : ''}
  <div class="card"><h2 style="margin-top:0">Skrzynki z naklejkami</h2><div class="cases">${Object.entries(CASES).filter(([, c]) => !c.freeOnly && (!c.gif || gifCaseReady())).map(([k, c]) => `
    <div class="case ${k}"><div class="ci" data-act="case-drops" data-k="${k}" role="button" title="Zawartość i szanse">${caseIco(k)}</div><b data-act="case-drops" data-k="${k}">${c.name}</b>
      <div class="odds">${Object.entries(c.odds).map(([r, p]) => `<span style="color:${RARITY[r].color}">● ${RARITY[r].name} ${p}%</span>`).join('')}${CASE_GIF[k] && legendGifReady() ? `<span style="color:${RARITY.legendary.color}">🎞️ GIF legendarny ${CASE_GIF[k]}%</span>` : ''}<span style="color:#0369a1">💎 do ${(GEM_PRIZES[k] || GEM_PRIZES.basic).at(-1)[0]} · 🔁 jeszcze raz</span>${mythicP(k) ? `<span style="color:${RARITY.mythic.color};font-weight:700">🔴 Mityczna ${pctFmt(MYTHIC_P)}</span>` : ''}<span style="color:${RARITY.mythic.color};font-weight:700">🔴 ${MEGA_GEMS} 💎 ${pctFmt(MEGA_GEMS_P)}</span></div>
      <button class="sm ghost block" data-act="case-drops" data-k="${k}">📋 Zawartość i szanse</button><button class="primary block" data-go="#/case/${k}">Otwórz · ${c.price} 💎</button></div>`).join('')}</div></div>
  <div class="card"><div class="row nowrap"><h2 class="grow" style="margin:0">Album naklejek</h2><span class="small muted">${owned}/${STICKERS.length}</span></div>
    <ul class="small muted perks"><li>Wysyłasz je przeciwnikowi w bitwie albo <b>podarujesz znajomemu</b> (💬 w rankingu). Stuknij naklejkę, żeby zobaczyć animację i usłyszeć jej dźwięk.</li>
      <li><b>3 duplikaty → złota wersja ✨</b> – złoty połysk w albumie, profilu i bitwach.</li>
      <li><b>Złota + kryształy → hologram 🌈</b> – tęczowy połysk, który zmienia się przy przechylaniu telefonu. Kryształy zdobywasz m.in., pokonując <a href="#/boss">bossów</a> albo rozbijając duplikaty. Masz <b>${dust()} ✨</b>.</li>
      <li>Wystaw do 3 naklejek w <b>gablocie</b> – widzą je znajomi w rankingu i przeciwnicy w bitwie.</li>
      <li>Komplet danej rzadkości daje premię: ${Object.entries(SET_BONUS).map(([r, v]) => `<span style="color:${RARITY[r].color}">${RARITY[r].name.toLowerCase()} +${v}💎${setComplete(r) ? ' ✓' : ''}</span>`).join(', ')}.</li></ul>
    <div class="row small showcase-row"><b class="grow">Gablota:</b><span class="showcase">${showcaseHTML(showcase) || '<span class="muted">pusta – stuknij ☆ przy naklejce</span>'}</span></div>
    <div class="album">${STICKERS.map(s => { const n = itemCount('sticker', s.id), sh = isShiny(s.id), have = n || sh, inSc = showcase.includes(s.id);
      const lv = shinyLv(s.id);
      return `<div class="stk ${s.r}${have ? '' : ' locked'}${fxCls(lv)}" style="--rc:${RARITY[s.r].color}"><span${have ? ` data-act="st-preview" data-id="${s.id}" style="cursor:pointer" title="Stuknij – animacja i dźwięk"` : ''}>${have ? stE(s) : '❔'}</span><small>${have ? esc(s.name) + (lv >= 2 ? ' 🌈' : sh ? ' ✨' : '') : RARITY[s.r].name + (s.hatch ? ' · 🥚 z jajka' : '')}</small>
        ${have ? `<button class="sm ghost" data-act="showcase" data-id="${s.id}">${inSc ? '★ w gablocie' : '☆ do gabloty'}</button>` : ''}
        ${n >= 3 && !sh ? `<button class="sm primary" data-act="upgrade" data-id="${s.id}">✨ Ulepsz (3 szt.)</button>` : ''}
        ${sh && lv < 2 ? `<button class="sm holo-btn" data-act="holo-up" data-id="${s.id}">🌈 Hologram · ${HOLO_COST[s.r]} 💎</button>` : ''}
        ${n > 1 ? `<div class="dup-row"><button class="sm ghost" data-act="sell-dup" data-id="${s.id}">×${n} · sprzedaj +${RARITY[s.r].sell}💎</button></div>` : ''}</div>`; }).join('')}</div></div>
  <div class="card row nowrap inv-cta" data-go="#/inv"><span style="font-size:34px">🎒</span><div class="grow"><b>Ekwipunek</b>
    <div class="small muted">GIF-y (${typeof GIF_CASE !== 'undefined' ? GIF_CASE.filter(g => hasItem('gif', g.id)).length : 0}), naklejki (${owned}/${STICKERS.length}), skrzynki do otwarcia</div></div><span style="font-size:22px">›</span></div>
  <div class="card"><h2 style="margin-top:0">Efekty zwycięstwa</h2><div class="effects">${EFFECTS.map(e => {
    const own = !e.price || hasItem('effect', e.id), on = (S.settings.effect || 'classic') === e.id;
    return `<button class="eff${on ? ' on' : ''}" data-act="effect" data-id="${e.id}"><span>${e.icon}</span><b>${e.name}</b><small>${on ? '✓ aktywny' : own ? 'wybierz' : e.price + ' 💎'}</small></button>`; }).join('')}</div></div>
  <div class="card"><h2 style="margin-top:0">Motywy premium</h2><div class="themes">${THEMES.filter(t => t.price).map(t => `<button class="theme" style="background:${t.bg};background-image:${t.image}" data-act="buy-theme" data-id="${t.id}">
    <span class="dot" style="background:${t.accent}"></span><b style="color:${lum(t.bg) < .18 ? '#fff' : '#1b1d29'}">${t.name}</b><small class="lock">${hasItem('theme', t.id) ? '✓ masz' : t.price + ' 💎'}</small></button>`).join('')}</div></div>` };
};

// ---------- otwieranie skrzynki (ruletka)
let SPIN = null;
ROUTES.case = (parts, q) => {
  const k = parts[1], c = CASES[k]; if (!c) return { html: '<a href="#/shop">Wróć</a>' };
  // tryb testowy (panel hosta): bez kosztu, nic nie trafia do albumu
  const test = q.get('test') && typeof hostUnlocked === 'function' && hostUnlocked() ? (RARITY[q.get('r')] || ['gems', 'respin', 'jackpot', 'lgif', 'mega'].includes(q.get('r')) ? q.get('r') : 'any') : '';
  const free = !test && q.get('free') && hasItem('case', k);
  if (!SPIN || SPIN.k !== k) SPIN = { k, phase: 'ready' };
  const tiles = (SPIN.strip || (SPIN.idle = SPIN.idle || Array.from({ length: 9 }, () => rollPrize(k, c.odds)))).map(prizeTile).join('');
  const won = SPIN.won;
  return { focus: true, html: `
  <div class="studybar"><button class="iconbtn" data-act="case-close">✕</button><div class="title">${c.icon} ${c.name}</div>${coinsHTML()}</div>
  <div class="roulette"><div class="marker"></div><div class="strip" id="strip">${tiles}</div></div>
  ${SPIN.phase === 'done' && won ? `<div class="card center reveal" style="--rc:${RARITY[won.r].color}">
      <div class="big-st${won.kind === 'gif' ? ' gifprize' : ''}">${won.kind === 'gif' ? gifImg(won.g) : stE(won)}</div><b style="font-size:22px">${won.kind === 'gems' ? `+${won.n} kryształów` : won.kind === 'respin' ? 'Losuj jeszcze raz!' : esc(won.name)}</b>
      <div style="color:${RARITY[won.r].color};font-weight:700">${won.kind === 'gems' ? (won.r === 'legendary' ? '💰 JACKPOT' : 'Kryształy') : won.kind === 'respin' ? 'Darmowe losowanie' : RARITY[won.r].name}</div>
      <p class="small muted">${SPIN.test ? '🧪 Tryb testowy – nic nie trafia na konto.' : won.kind === 'gems' ? 'Kryształy dodane do salda 💎' : won.kind === 'gif' ? (SPIN.dup ? `Masz już ten GIF – dostajesz +${GIF_DUP[won.r]} 💎.` : 'Nowy GIF w ekwipunku 🎒! Ustaw go jako GIF wygranej albo wyślij na czacie.') : won.kind === 'respin' ? 'Otwierasz tę skrzynkę jeszcze raz – za darmo!' : SPIN.dup ? `Duplikat – masz już ${itemCount('sticker', won.id)} szt. ${itemCount('sticker', won.id) >= 3 ? 'Możesz ją ulepszyć do złotej wersji ✨ w albumie!' : `Przy 3 sztukach ulepszysz ją do złotej ✨ (albo sprzedasz za ${RARITY[won.r].sell} 💎).`}` : 'Nowa naklejka w albumie! Wyślij ją w następnej bitwie.'}</p>
      <div class="row"><button class="primary grow${won.kind === 'respin' ? ' pulse' : ''}" data-act="case-again" data-k="${k}" data-test="${SPIN.test || ''}">${won.kind === 'respin' ? '🔁 Losuj jeszcze raz' : 'Otwórz kolejną'}</button><button class="grow" data-go="${SPIN.test ? '#/host' : '#/shop'}">${SPIN.test ? 'Panel hosta' : 'Album'}</button></div></div>`
    : `<div class="odds center"><span>💎 Kryształy ${CASE_EXTRA.gems}% (do ${(GEM_PRIZES[k] || GEM_PRIZES.basic).at(-1)[0]} 💎)</span> <span>🔁 Jeszcze raz ${CASE_EXTRA.respin}%</span><br>
       <small class="muted">Naklejki (${100 - CASE_EXTRA.gems - CASE_EXTRA.respin}%):</small> ${Object.entries(c.odds).map(([r, p]) => `<span style="color:${RARITY[r].color}">● ${RARITY[r].name} ${p}%</span>`).join(' ')}<br><span style="color:${RARITY.mythic.color}">🔴 ${mythicP(k) ? `Mityczna naklejka ${pctFmt(MYTHIC_P)} · ` : ''}${MEGA_GEMS} 💎 ${pctFmt(MEGA_GEMS_P)}</span></div>
       <button class="ghost block" data-act="case-drops" data-k="${k}">📋 Zobacz cały drop i szanse</button>
       <button class="primary block" data-act="case-spin" data-k="${k}" data-free="${free ? 1 : ''}" data-test="${test}" ${SPIN.phase === 'spinning' ? 'disabled' : ''} style="min-height:58px;font-size:18px">
       ${SPIN.phase === 'spinning' ? 'Losowanie…' : test ? '🧪 Otwórz testowo' : free ? '🎁 Otwórz za darmo' : c.freeOnly ? 'Brak skrzynki – ucz się codziennie 🌞' : `Otwórz za ${c.price} 💎`}</button>`}` };
};
let audioCtx;
function tick(freq = 1400, dur = .03, vol = .08) {
  if (S.settings.sound === false) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = freq; o.type = 'square';
    g.gain.setValueAtTime(vol, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + dur);
  } catch { /* brak dźwięku */ }
}
function spinCase(k, free, test) {
  const c = CASES[k];
  if (test) { /* pokaz: bez opłaty */ }
  else if (c.freeOnly && !free) return toast('Tę skrzynkę dostajesz za codzienną naukę');
  else if (free) { if (!hasItem('case', k)) return; addItem('case', k, -1); }
  else if (!spend(c.price, 'case-' + k)) return;
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch { /* */ }
  const sfx = typeof CASE_SFX !== 'undefined' ? CASE_SFX : null;
  if (sfx) { if (typeof fxUnlock === 'function') fxUnlock(); sfx.open(); }
  const won = rollPrize(k, c.odds, test && test !== 'any' ? test : null), WIN = 52;
  const strip = Array.from({ length: 60 }, (_, i) => i === WIN ? won : rollPrize(k, c.odds));
  SPIN = { k, phase: 'spinning', strip, won, dup: won.kind === 'gif' ? hasItem('gif', won.id) : !won.kind && hasItem('sticker', won.id), test };
  render();
  const el = $('#strip'), tile = el.firstElementChild.getBoundingClientRect().width + 8, box = el.parentElement.getBoundingClientRect().width;
  const target = WIN * tile + tile / 2 - box / 2 + (Math.random() - .5) * tile * .7;
  el.style.transition = 'none'; el.style.transform = 'translateX(0)';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.transition = 'transform 6.2s cubic-bezier(.06,.72,.12,1)'; el.style.transform = `translateX(${-target}px)`;
  }));
  let last = -1;
  const watch = () => {
    if (SPIN.phase !== 'spinning') return;
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform), idx = Math.floor((-m.m41 + box / 2) / tile);
    if (idx !== last) { last = idx; sfx ? sfx.tick(idx) : tick(1200 + Math.random() * 400); }
    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);
  setTimeout(() => {
    if (!test) {
      if (won.kind === 'gems') { S.wallet.push({ id: uid(), n: won.n, why: 'case-gems', t: Date.now() }); if (won.r === 'legendary' || won.r === 'mythic') S.stats.jackpot = 1; if (won.r === 'mythic') S.stats.megaGems = 1; }
      else if (won.kind === 'respin') addItem('case', k, 1, 'respin-' + uid());   // darmowa skrzynka tego samego rodzaju
      else if (won.kind === 'gif') { if (SPIN.dup) S.wallet.push({ id: uid(), n: GIF_DUP[won.r], why: 'gif-dup', t: Date.now() }); else addItem('gif', won.id); }
      else { addItem('sticker', won.id); if (won.r === 'legendary' || won.r === 'mythic') S.stats.legendary = 1; }
      S.stats.cases = (S.stats.cases || 0) + 1;
    }
    SPIN.phase = 'done'; save(); render();
    const tr = $('#strip'); if (tr) { tr.style.transition = 'none'; tr.style.transform = `translateX(${-target}px)`; }
    if (sfx) sfx.reveal(won.r === 'mythic' ? 'legendary' : won.r); else { tick(880, .15, .12); setTimeout(() => tick(1320, .25, .12), 120); }
    if (!won.kind && typeof playStickerSound === 'function') setTimeout(() => playStickerSound(won.id), won.r === 'legendary' ? 1700 : 900);
    if (won.kind === 'gems' && typeof FX !== 'undefined') setTimeout(() => { const ac = fxCtxGet(); if (ac) FX.sparkle(ac); }, 500);
    if (won.kind === 'respin') celebrate('🔁 Losuj jeszcze raz!', 'Darmowe ponowne otwarcie skrzynki');
    else if (won.r === 'mythic') { celebrate(won.kind === 'gems' ? `💎 +${won.n} – MEGA JACKPOT!` : `🔴 MITYCZNA: ${won.name}!`, 'Szansa 0,1% – trafia się raz na 1000 skrzynek!'); confetti(300); setTimeout(() => confetti(300), 900); }
    else if (won.kind === 'gems') { if (won.r === 'legendary' || won.r === 'epic') celebrate(`💎 +${won.n}!`, won.r === 'legendary' ? 'JACKPOT!' : 'Kryształy'); else confetti(50); }
    else if (won.r === 'legendary' || won.r === 'epic') celebrate(`${won.e} ${RARITY[won.r].name}!`, won.name); else confetti(50);
  }, 6400);
}

Object.assign(ACTIONS, {
  'case-spin': el => spinCase(el.dataset.k, !!el.dataset.free, el.dataset.test || ''),
  'case-again': el => { SPIN = null; const k = el.dataset.k, t = el.dataset.test;
    go(`#/case/${k}${t ? `?test=1${t !== 'any' ? '&r=' + t : ''}` : hasItem('case', k) ? '?free=1' : ''}`); render(); },
  'case-close': () => { if (SPIN?.phase === 'spinning') return; const t = SPIN?.test; SPIN = null; go(t ? '#/host' : '#/shop'); },
  upgrade: el => {
    const s = stickerById(el.dataset.id); if (itemCount('sticker', s.id) < 3) return;
    addItem('sticker', s.id, -3); addItem('shiny', s.id); S.stats.shiny = (S.stats.shiny || 0) + 1; save();
    celebrate(`✨ Złota naklejka: ${s.e} ${s.name}`, 'Błyszczy w albumie, profilu i bitwach'); render();
  },
  'case-drops': el => showCaseDrops(el.dataset.k),
  showcase: el => {
    const id = el.dataset.id, sc = S.profile.showcase || [];
    S.profile.showcase = sc.includes(id) ? sc.filter(x => x !== id) : [...sc, id].slice(-3);
    S.profile.mod = Date.now(); save(); render();
  },
  'holo-up': el => {
    const s = stickerById(el.dataset.id), cost = HOLO_COST[s.r]; if (!isShiny(s.id) || isHolo(s.id)) return;
    if (!spend(cost, 'holo-' + s.id)) return;
    addItem('holo', s.id); S.stats.holo = (S.stats.holo || 0) + 1; save();
    celebrate(`🌈 Hologram: ${s.e} ${s.name}`, 'Przechyl telefon – tęcza się przesuwa'); render();
  },
  'dust-dup': el => {
    const s = stickerById(el.dataset.id); if (itemCount('sticker', s.id) < 2) return;
    addItem('sticker', s.id, -1); addDust(DUST_OF[s.r]); save(); toast(`💎 +${DUST_OF[s.r] * DUST_RATE}`); render();
  },
  'sell-dup': el => {
    const s = stickerById(el.dataset.id); if (itemCount('sticker', s.id) < 2) return;
    addItem('sticker', s.id, -1); S.wallet.push({ id: uid(), n: RARITY[s.r].sell, why: 'sell-' + s.id, t: Date.now() }); save();
    toast(`Sprzedano ${s.e} za ${RARITY[s.r].sell} 💎`); render();
  },
  effect: el => {
    const e = EFFECTS.find(x => x.id === el.dataset.id);
    if (e.price && !hasItem('effect', e.id)) { if (!confirm(`Kupić efekt „${e.name}” za ${e.price} 💎?`) || !spend(e.price, 'effect-' + e.id)) return; addItem('effect', e.id); }
    S.settings.effect = e.id; save(); render(); confetti(90);
  },
  'buy-theme': el => {
    const t = THEMES.find(x => x.id === el.dataset.id);
    if (!hasItem('theme', t.id)) { if (!confirm(`Kupić motyw „${t.name}” za ${t.price} 💎?`) || !spend(t.price, 'theme-' + t.id)) return; addItem('theme', t.id); }
    S.settings.theme = { id: t.id, bg: t.bg, accent: t.accent, image: t.image }; applyTheme(); save(); render(); confetti(90);
  },
});

// ---------- 🎒 Ekwipunek: GIF-y (tylko ze skrzynki), naklejki, nieotwarte skrzynki
function gifCollectionHTML() {
  const all = typeof GIF_CASE !== 'undefined' ? GIF_CASE : [], own = all.filter(g => hasItem('gif', g.id)), cfg = S.settings.reactions || {};
  const ready = gifCaseReady();
  return `<div class="card"><div class="row nowrap"><h2 class="grow" style="margin:0">🎞️ GIF-y</h2><span class="small muted">${own.length}/${all.length}</span></div>
    <p class="small muted">GIF-y zdobywasz <b>tylko</b> w 🎞️ skrzynce z GIF-ami. Ustaw GIF jako: 🏆 wygrana (widzą go wszyscy gracze, gdy wygrasz bitwę lub teleturniej), ✅ zestaw fiszek, 🎯 cel dzienny. Możesz go też wysłać znajomemu na czacie.</p>
    ${own.length ? `<div class="gifgrid">${own.map(g => { const r = g.r || 'common';
      return `<div class="gifitem" style="--rc:${RARITY[r].color}">${gifImg(g)}
        <small><b>${esc(g.name || 'GIF')}</b> · <span style="color:${RARITY[r].color}">${RARITY[r].name}</span></small>
        <div class="row nowrap gifuse">${Object.keys(REACT_SLOTS).map(k => `<button class="sm${cfg[k]?.gid === g.id ? ' primary' : ''}" data-act="gif-use" data-id="${g.id}" data-k="${k}" title="${esc(REACT_SLOTS[k].name)}">${REACT_SLOTS[k].name.split(' ')[0]}</button>`).join('')}</div></div>`; }).join('')}</div>`
      : `<div class="inv-empty"><span>🎞️</span><p>Nie masz jeszcze żadnego GIF-a.</p>${ready ? '<button class="primary" data-go="#/case/gif">Otwórz skrzynkę z GIF-ami · ' + CASES.gif.price + ' 💎</button>' : '<p class="small muted">Skrzynka z GIF-ami pojawi się w sklepie wkrótce 👀</p>'}</div>`}
    ${own.length && ready && own.length < all.length ? `<p class="small muted center" style="margin-bottom:0">Brakuje Ci ${all.length - own.length} – <a href="#/case/gif">losuj dalej</a></p>` : ''}</div>`;
}
ROUTES.inv = () => {
  const cases = Object.keys(CASES).filter(k => hasItem('case', k));
  const st = ownedStickers().map(stickerById).filter(Boolean);
  return { tab: 'profile', html: `<div class="row nowrap"><button class="iconbtn" data-go="#/me">‹</button><h1 class="grow">🎒 Ekwipunek</h1>${coinsHTML()}</div>
    ${gifCollectionHTML()}
    <div class="card"><div class="row nowrap"><h2 class="grow" style="margin:0">🃏 Naklejki</h2><span class="small muted">${st.length}</span></div>
      <p class="small muted">Wysyłasz je w bitwie i na czacie (nie znikają). „Podaruj” na czacie oddaje naklejkę znajomemu.</p>
      <div class="inv-st">${st.map(s => `<span class="${fxCls(shinyLv(s.id)).trim()}" style="--rc:${RARITY[s.r].color}" data-act="st-preview" data-id="${s.id}" title="${esc(s.name)}">${stE(s)}${itemCount('sticker', s.id) > 1 ? `<i>×${itemCount('sticker', s.id)}</i>` : ''}</span>`).join('')}</div>
      <button class="block" data-go="#/shop">📖 Album i skrzynki w sklepie</button></div>
    <div class="card"><h2 style="margin-top:0">🎁 Skrzynki do otwarcia</h2>
      ${cases.length ? cases.map(k => `<div class="row nowrap inv-case"><span style="font-size:30px">${CASES[k].icon}</span><b class="grow">${CASES[k].name} ×${itemCount('case', k)}</b><button class="primary sm" data-go="#/case/${k}?free=1">Otwórz</button></div>`).join('')
        : '<p class="small muted" style="margin:0">Brak – darmowe skrzynki dostajesz za wygrane bitwy, zestawy fiszek i nagrody dnia.</p>'}</div>` };
};
Object.assign(ACTIONS, {
  'gif-use': el => {
    const k = el.dataset.k, id = el.dataset.id, c = (S.settings.reactions = S.settings.reactions || {});
    c[k] = { ...(c[k] || {}) };
    if (c[k].gid === id) { delete c[k].gid; save(); render(); return toast('Przywrócono poprzednią reakcję'); }
    c[k].gid = id; c[k].on = true;
    save(); render(); showReaction(k, true);
  },
});

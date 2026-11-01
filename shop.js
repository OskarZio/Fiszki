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
  divine: { name: 'Boska', color: '#e879f9', sell: 10000 },   // 🌈 ponad mityczną – tęczowa, holograficzna
};
const ST = (id, e, name, r, img, t) => ({ id, e, name, r, ...(img ? { img } : {}), ...(t ? { t } : {}) });
// naklejka w HTML: obrazek (naklejki-obrazki, np. mityczna) albo emoji; w zwykłym tekście zostaje s.e
// ilustracje Fluent 3D (Microsoft, MIT) z białą „wyciętą” obwódką jak prawdziwa naklejka; brak pliku → emoji
const FLUENT_ST = new Set('thumb cool nerd books coffee monkey sleepy pizza turtle target muscle think phew wave clap fire brain zap rocket owl party angry mind goat clover crown gem unicorn dragon volcano ninja wizard trophy comet galaxy trident chick hatchling penguin parrot dino trex dragonling swan'.split(' '));
// styl naklejek (Ustawienia → Personalizacja): 'svg' – własne naklejki (domyślnie), '3d' – ilustracje Fluent, 'emoji'
const stStyle = () => S?.settings?.stStyle || 'svg';
const stE = s => s?.img ? `<img class="st-img" src="${s.img}" alt="${s.e}" draggable="false">`
  : !s ? '' : stStyle() === 'svg' && typeof stickerArt === 'function' && stickerArt(s) ? stickerArt(s)
  : stStyle() !== 'emoji' && FLUENT_ST.has(s.id) ? `<img class="st-img fl" src="assets/fluent/${s.id}.webp" alt="${s.e}" draggable="false">` : (s.e || '');
// 📦 skrzynki 8-bit (assets/crates): każdy rodzaj ma własną; boss, łup PvP i skrzynka do złapania w walce też
const CRATE_OF = { prest: 'gem', forge: 'bc_fire', skin: 'magic', basic: 'basic', epic: 'epic', daily: 'daily', cats: 'cats', animals: 'animals', food: 'food', magic: 'magic', gif: 'gif', hero: 'hero', boss: 'boss', pvp: 'ice', grab: 'gem' };
const crateImg = (k, cls = '') => `<img class="crate-img ${cls}" src="assets/crates/${CRATE_OF[k] || 'basic'}.webp" alt="" draggable="false">`;
const caseIco = k => crateImg(k, 'case-img');
const STICKERS = [
  ST('thumb', '👍', "Uśmiech", 'epic', 'assets/stickers/px/157.webp', 'magic'), ST('cool', '😎', "Kot szef", 'rare', 'assets/stickers/px/057.webp', 'cats'), ST('nerd', '🤓', "Panda w okularach", 'common', 'assets/stickers/px/033.webp', 'animals'), ST('books', '📚', "Książka", 'rare', 'assets/stickers/px/210.webp', 'magic'),
  ST('coffee', '☕', "Kawa", 'common', 'assets/stickers/px/002.webp', 'food'), ST('monkey', '🙈', "Małpka", 'rare', 'assets/stickers/px/201.webp', 'animals'), ST('sleepy', '😴', "Śpioch", 'common', 'assets/stickers/px/072.webp', 'cats'), ST('pizza', '🍕', "Pizza", 'rare', 'assets/stickers/px/028.webp', 'food'),
  ST('turtle', '🐢', "Żółw", 'rare', 'assets/stickers/px/095.webp', 'animals'), ST('target', '🎯', "Zakaz", 'common', 'assets/stickers/px/163.webp', 'magic'), ST('muscle', '💪', "Hantla", 'legendary', 'assets/stickers/px/108.webp', 'magic'), ST('think', '🤔', "Mędrzec", 'common', 'assets/stickers/px/034.webp', 'animals'),
  ST('phew', '😅', "Chmurka", 'rare', 'assets/stickers/px/130.webp', 'magic'), ST('wave', '👋', "Fala", 'rare', 'assets/stickers/px/083.webp', 'magic'), ST('clap', '👏', "Good Vibes", 'legendary', 'assets/stickers/px/019.webp', 'magic'),
  ST('fire', '🔥', "Płomień", 'rare', 'assets/stickers/px/043.webp', 'magic'), ST('brain', '🧠', "Mózg", 'epic', 'assets/stickers/px/101.webp', 'magic'), ST('zap', '⚡', "Błyskawica", 'epic', 'assets/stickers/px/051.webp', 'food'), ST('rocket', '🚀', "Odrzutowiec", 'legendary', 'assets/stickers/px/023.webp', 'animals'),
  ST('owl', '🦉', "Drzemka", 'epic', 'assets/stickers/px/077.webp', 'magic'), ST('party', '🎉', "Keep Going", 'legendary', 'assets/stickers/px/038.webp', 'magic'), ST('mind', '🤯', "Bobas w okularach", 'legendary', 'assets/stickers/px/103.webp', 'animals'),
  ST('goat', '🐐', "GOAT", 'mythic', 'assets/stickers/px/000.webp', 'cats'), ST('clover', '🍀', "Zielony motyl", 'rare', 'assets/stickers/px/148.webp', 'animals'),
  ST('crown', '👑', "Korona", 'legendary', 'assets/stickers/px/206.webp', 'magic'), ST('gem', '💎', "Diament", 'legendary', 'assets/stickers/px/044.webp', 'magic'), ST('unicorn', '🦄', "Motyl", 'legendary', 'assets/stickers/px/164.webp', 'animals'), ST('dragon', '🐉', "Rekin z łapą", 'mythic', 'assets/stickers/px/227.webp', 'animals'),
  ST('volcano', '🌋', "Ogień", 'mythic', 'assets/stickers/px/102.webp', 'magic'), ST('ninja', '🥷', "Kot ninja", 'legendary', 'assets/stickers/px/224.webp', 'cats'), ST('wizard', '🧙', "Kapelusz czarodzieja", 'legendary', 'assets/stickers/px/046.webp', 'magic'),
  ST('trophy', '🏆', "Puchar", 'mythic', 'assets/stickers/px/058.webp', 'magic'), ST('comet', '☄️', "Gwiezdny pył", 'mythic', 'assets/stickers/px/228.webp', 'magic'), ST('galaxy', '🌌', "UFO", 'mythic', 'assets/stickers/px/209.webp', 'magic'), ST('trident', '🔱', "Miecz", 'mythic', 'assets/stickers/px/205.webp', 'magic'),
  // 👾 kolekcja 8-bit (pixel art)
  ST('px001', '👾', "Miś w czapce", 'epic', 'assets/stickers/px/001.webp', 'animals'), ST('px003', '👾', "Lizak", 'rare', 'assets/stickers/px/003.webp', 'food'), ST('px004', '👾', "Leniwy kot", 'epic', 'assets/stickers/px/004.webp', 'cats'), ST('px006', '👾', "Kot w kapeluszu", 'epic', 'assets/stickers/px/006.webp', 'cats'), ST('px007', '👾', "Ognisko", 'common', 'assets/stickers/px/007.webp', 'magic'), ST('px008', '👾', "Złota moneta", 'epic', 'assets/stickers/px/008.webp', 'magic'), ST('px009', '👾', "Szop", 'common', 'assets/stickers/px/009.webp', 'animals'), ST('px010', '👾', "Kot przebieraniec", 'rare', 'assets/stickers/px/010.webp', 'cats'), ST('px011', '👾', "Pies w okularach", 'epic', 'assets/stickers/px/011.webp', 'animals'), ST('px012', '👾', "Wiedźma", 'rare', 'assets/stickers/px/012.webp', 'animals'), ST('px013', '👾', "Serce", 'epic', 'assets/stickers/px/013.webp', 'magic'), ST('px014', '👾', "Kotek nocny", 'rare', 'assets/stickers/px/014.webp', 'cats'), ST('px016', '👾', "Kanapka", 'epic', 'assets/stickers/px/016.webp', 'food'), ST('px017', '👾', "Kot w kubku", 'rare', 'assets/stickers/px/017.webp', 'cats'), ST('px018', '👾', "Kotek", 'rare', 'assets/stickers/px/018.webp', 'cats'), ST('px020', '👾', "Koza", 'common', 'assets/stickers/px/020.webp', 'animals'), ST('px024', '👾', "Diament z oczami", 'legendary', 'assets/stickers/px/024.webp', 'magic'), ST('px025', '👾', "Kot na czatach", 'rare', 'assets/stickers/px/025.webp', 'cats'), ST('px026', '👾', "Różowe serce", 'epic', 'assets/stickers/px/026.webp', 'magic'), ST('px027', '👾', "Kryształ", 'rare', 'assets/stickers/px/027.webp', 'magic'), ST('px029', '👾', "Czarny kot", 'common', 'assets/stickers/px/029.webp', 'cats'), ST('px030', '👾', "Rudzielec", 'common', 'assets/stickers/px/030.webp', 'cats'), ST('px031', '👾', "Kotek różowe uszy", 'rare', 'assets/stickers/px/031.webp', 'cats'), ST('px035', '👾', "Pieseł", 'rare', 'assets/stickers/px/035.webp', 'animals'), ST('px036', '👾', "Ziarno kawy", 'common', 'assets/stickers/px/036.webp', 'food'), ST('px037', '👾', "Kamera", 'epic', 'assets/stickers/px/037.webp', 'magic'), ST('px040', '👾', "Kwiatek", 'common', 'assets/stickers/px/040.webp', 'magic'), ST('px041', '👾', "Ziomek w czapce", 'common', 'assets/stickers/px/041.webp', 'animals'), ST('px042', '👾', "Pręgowany kot", 'epic', 'assets/stickers/px/042.webp', 'cats'), ST('px045', '👾', "Gnom", 'epic', 'assets/stickers/px/045.webp', 'animals'), ST('px047', '👾', "Kot w smokingu", 'common', 'assets/stickers/px/047.webp', 'cats'), ST('px048', '👾', "Zeszyt", 'rare', 'assets/stickers/px/048.webp', 'magic'), ST('px049', '👾', "Pióro", 'rare', 'assets/stickers/px/049.webp', 'magic'), ST('px050', '👾', "Fioletowy kot", 'rare', 'assets/stickers/px/050.webp', 'cats'), ST('px052', '👾', "Wiewiórka", 'epic', 'assets/stickers/px/052.webp', 'animals'), ST('px053', '👾', "Plecak", 'rare', 'assets/stickers/px/053.webp', 'magic'), ST('px054', '👾', "Muchomor", 'rare', 'assets/stickers/px/054.webp', 'magic'), ST('px055', '👾', "Kot zrzęda", 'legendary', 'assets/stickers/px/055.webp', 'cats'), ST('px056', '👾', "Gogle", 'epic', 'assets/stickers/px/056.webp', 'magic'), ST('px059', '👾', "Księżycowy kot", 'rare', 'assets/stickers/px/059.webp', 'cats'), ST('px060', '👾', "Truskawka", 'rare', 'assets/stickers/px/060.webp', 'food'), ST('px061', '👾', "Gwiazda", 'epic', 'assets/stickers/px/061.webp', 'magic'), ST('px062', '👾', "Just One More Rep", 'mythic', 'assets/stickers/px/062.webp', 'magic'), ST('px063', '👾', "Chili", 'rare', 'assets/stickers/px/063.webp', 'food'), ST('px064', '👾', "Kawa na wynos", 'common', 'assets/stickers/px/064.webp', 'food'), ST('px065', '👾', "Kot o zielonych oczach", 'rare', 'assets/stickers/px/065.webp', 'cats'), ST('px066', '👾', "Śpiący lis", 'rare', 'assets/stickers/px/066.webp', 'animals'), ST('px067', '👾', "Laptop z mocą", 'legendary', 'assets/stickers/px/067.webp', 'magic'), ST('px068', '👾', "No Signal", 'mythic', 'assets/stickers/px/068.webp', 'magic'), ST('px070', '👾', "Awokado", 'common', 'assets/stickers/px/070.webp', 'food'), ST('px071', '👾', "Chudy", 'mythic', 'assets/stickers/px/071.webp', 'cats'), ST('px073', '👾', "Kubek kawy", 'epic', 'assets/stickers/px/073.webp', 'food'), ST('px074', '👾', "Namiot", 'common', 'assets/stickers/px/074.webp', 'magic'), ST('px075', '👾', "Rogalik", 'rare', 'assets/stickers/px/075.webp', 'food'), ST('px076', '👾', "Kalkulator", 'epic', 'assets/stickers/px/076.webp', 'magic'), ST('px078', '👾', "Złamane serce", 'common', 'assets/stickers/px/078.webp', 'magic'), ST('px079', '👾', "Kubek z buźką", 'common', 'assets/stickers/px/079.webp', 'food'), ST('px080', '👾', "Fioletowy kryształ", 'rare', 'assets/stickers/px/080.webp', 'magic'), ST('px082', '👾', "Herbata", 'common', 'assets/stickers/px/082.webp', 'food'), ST('px084', '👾', "Kot w cylindrze", 'mythic', 'assets/stickers/px/084.webp', 'cats'), ST('px085', '👾', "Miś", 'epic', 'assets/stickers/px/085.webp', 'animals'), ST('px086', '👾', "Lisek", 'common', 'assets/stickers/px/086.webp', 'animals'), ST('px087', '👾', "Niebieski kot", 'rare', 'assets/stickers/px/087.webp', 'cats'), ST('px088', '👾', "Chomik", 'epic', 'assets/stickers/px/088.webp', 'animals'), ST('px089', '👾', "Iskra", 'epic', 'assets/stickers/px/089.webp', 'magic'), ST('px090', '👾', "Sushi", 'epic', 'assets/stickers/px/090.webp', 'food'), ST('px091', '👾', "Delfin", 'rare', 'assets/stickers/px/091.webp', 'animals'), ST('px092', '👾', "Złoty puchar", 'epic', 'assets/stickers/px/092.webp', 'magic'), ST('px093', '👾', "Brązowy kot", 'common', 'assets/stickers/px/093.webp', 'cats'), ST('px094', '👾', "Ananas w koronie", 'mythic', 'assets/stickers/px/094.webp', 'food'), ST('px096', '👾', "Rudy kot", 'common', 'assets/stickers/px/096.webp', 'cats'), ST('px097', '👾', "Złota rybka", 'common', 'assets/stickers/px/097.webp', 'animals'), ST('px098', '👾', "Kubek RIP", 'legendary', 'assets/stickers/px/098.webp', 'food'), ST('px099', '👾', "Szary kot", 'rare', 'assets/stickers/px/099.webp', 'cats'), ST('px100', '👾', "Pochodnia", 'common', 'assets/stickers/px/100.webp', 'magic'), ST('px104', '👾', "RIP", 'mythic', 'assets/stickers/px/104.webp', 'magic'), ST('px105', '👾', "Malina", 'common', 'assets/stickers/px/105.webp', 'food'), ST('px106', '👾', "404 Day", 'mythic', 'assets/stickers/px/106.webp', 'magic'), ST('px107', '👾', "Pad", 'epic', 'assets/stickers/px/107.webp', 'magic'), ST('px109', '👾', "Onigiri", 'common', 'assets/stickers/px/109.webp', 'food'), ST('px110', '👾', "Żaba DJ", 'mythic', 'assets/stickers/px/110.webp', 'animals'), ST('px112', '👾', "Pikselowe serce", 'rare', 'assets/stickers/px/112.webp', 'magic'), ST('px113', '👾', "Szop w okularach", 'legendary', 'assets/stickers/px/113.webp', 'animals'), ST('px114', '👾', "Game Boy", 'legendary', 'assets/stickers/px/114.webp', 'magic'), ST('px115', '👾', "Awokado ninja", 'rare', 'assets/stickers/px/115.webp', 'food'), ST('px116', '👾', "Koi", 'rare', 'assets/stickers/px/116.webp', 'animals'), ST('px117', '👾', "Kot w berecie", 'rare', 'assets/stickers/px/117.webp', 'cats'), ST('px118', '👾', "Latte", 'common', 'assets/stickers/px/118.webp', 'food'), ST('px120', '👾', "Puszka", 'rare', 'assets/stickers/px/120.webp', 'food'), ST('px121', '👾', "Nemo", 'rare', 'assets/stickers/px/121.webp', 'animals'), ST('px122', '👾', "Telewizor", 'rare', 'assets/stickers/px/122.webp', 'magic'), ST('px123', '👾', "Ser", 'common', 'assets/stickers/px/123.webp', 'food'), ST('px125', '👾', "Kanapka klubowa", 'common', 'assets/stickers/px/125.webp', 'food'), ST('px128', '👾', "Liść", 'common', 'assets/stickers/px/128.webp', 'food'), ST('px129', '👾', "Kot w kapturze", 'rare', 'assets/stickers/px/129.webp', 'cats'), ST('px131', '👾', "Ćma", 'common', 'assets/stickers/px/131.webp', 'animals'), ST('px133', '👾', "Serce EKG", 'epic', 'assets/stickers/px/133.webp', 'magic'), ST('px134', '👾', "Pręgus", 'rare', 'assets/stickers/px/134.webp', 'cats'), ST('px135', '👾', "Jeleń", 'common', 'assets/stickers/px/135.webp', 'animals'), ST('px136', '👾', "Pióro feniksa", 'common', 'assets/stickers/px/136.webp', 'magic'), ST('px137', '👾', "Gwiazdka", 'common', 'assets/stickers/px/137.webp', 'magic'), ST('px138', '👾', "Pingwin zimowy", 'common', 'assets/stickers/px/138.webp', 'animals'), ST('px139', '👾', "Płatek śniegu", 'rare', 'assets/stickers/px/139.webp', 'magic'), ST('px140', '👾', "Papryka", 'common', 'assets/stickers/px/140.webp', 'food'), ST('px141', '👾', "Kula", 'common', 'assets/stickers/px/141.webp', 'magic'), ST('px142', '👾', "Winogrona", 'common', 'assets/stickers/px/142.webp', 'food'), ST('px143', '👾', "Lampa dżina", 'legendary', 'assets/stickers/px/143.webp', 'magic'), ST('px144', '👾', "Pełna bateria", 'epic', 'assets/stickers/px/144.webp', 'magic'), ST('px145', '👾', "Ognik", 'common', 'assets/stickers/px/145.webp', 'magic'), ST('px146', '👾', "Kot w koszyku", 'epic', 'assets/stickers/px/146.webp', 'cats'), ST('px147', '👾', "Burger", 'rare', 'assets/stickers/px/147.webp', 'food'), ST('px149', '👾', "Ciastko", 'epic', 'assets/stickers/px/149.webp', 'food'), ST('px150', '👾', "Słaba bateria", 'common', 'assets/stickers/px/150.webp', 'magic'), ST('px151', '👾', "Napój", 'rare', 'assets/stickers/px/151.webp', 'food'), ST('px152', '👾', "Delfinek", 'epic', 'assets/stickers/px/152.webp', 'animals'), ST('px153', '👾', "Pingwin szef", 'epic', 'assets/stickers/px/153.webp', 'animals'), ST('px154', '👾', "Aparat", 'common', 'assets/stickers/px/154.webp', 'magic'), ST('px155', '👾', "Mapa skarbów", 'common', 'assets/stickers/px/155.webp', 'magic'), ST('px156', '👾', "Szop bandyta", 'epic', 'assets/stickers/px/156.webp', 'animals'), ST('px158', '👾', "Serduszka", 'epic', 'assets/stickers/px/158.webp', 'food'), ST('px159', '👾', "Rybka", 'common', 'assets/stickers/px/159.webp', 'animals'), ST('px160', '👾', "Kapelusz", 'common', 'assets/stickers/px/160.webp', 'magic'), ST('px161', '👾', "Kawałek pizzy", 'common', 'assets/stickers/px/161.webp', 'food'), ST('px162', '👾', "Duszek wodny", 'epic', 'assets/stickers/px/162.webp', 'animals'), ST('px165', '👾', "Wybuch", 'rare', 'assets/stickers/px/165.webp', 'magic'), ST('px166', '👾', "Galaretka", 'common', 'assets/stickers/px/166.webp', 'food'), ST('px167', '👾', "Lis drzemie", 'rare', 'assets/stickers/px/167.webp', 'animals'), ST('px168', '👾', "Piłka", 'rare', 'assets/stickers/px/168.webp', 'magic'), ST('px169', '👾', "Precel", 'common', 'assets/stickers/px/169.webp', 'food'), ST('px170', '👾', "Ramen", 'common', 'assets/stickers/px/170.webp', 'food'), ST('px172', '👾', "Krab", 'common', 'assets/stickers/px/172.webp', 'animals'), ST('px173', '👾', "Elf", 'rare', 'assets/stickers/px/173.webp', 'animals'), ST('px174', '👾', "Bambus", 'common', 'assets/stickers/px/174.webp', 'magic'), ST('px176', '👾', "Słońce", 'common', 'assets/stickers/px/176.webp', 'magic'), ST('px177', '👾', "Wróżka", 'legendary', 'assets/stickers/px/177.webp', 'animals'), ST('px178', '👾', "Klepsydra", 'legendary', 'assets/stickers/px/178.webp', 'magic'), ST('px179', '👾', "Zombie", 'rare', 'assets/stickers/px/179.webp', 'animals'), ST('px180', '👾', "Ogórek", 'rare', 'assets/stickers/px/180.webp', 'food'), ST('px181', '👾', "Ciastko z czekoladą", 'rare', 'assets/stickers/px/181.webp', 'food'), ST('px182', '👾', "Granat", 'common', 'assets/stickers/px/182.webp', 'food'), ST('px183', '👾', "Kot z sercem", 'rare', 'assets/stickers/px/183.webp', 'cats'), ST('px184', '👾', "Słońce w okularach", 'rare', 'assets/stickers/px/184.webp', 'magic'), ST('px185', '👾', "Rybka w słoiku", 'rare', 'assets/stickers/px/185.webp', 'animals'), ST('px186', '👾', "Pączek", 'common', 'assets/stickers/px/186.webp', 'food'), ST('px187', '👾', "Zielony kot", 'rare', 'assets/stickers/px/187.webp', 'cats'), ST('px188', '👾', "Frytki", 'rare', 'assets/stickers/px/188.webp', 'food'), ST('px189', '👾', "Bilet", 'epic', 'assets/stickers/px/189.webp', 'magic'), ST('px190', '👾', "Ośmiornica", 'common', 'assets/stickers/px/190.webp', 'animals'), ST('px191', '👾', "Retro komputer", 'legendary', 'assets/stickers/px/191.webp', 'magic'), ST('px192', '👾', "Kot skrzydlaty", 'epic', 'assets/stickers/px/192.webp', 'cats'), ST('px193', '👾', "Fioletowe serce", 'rare', 'assets/stickers/px/193.webp', 'magic'), ST('px194', '👾', "Butelka", 'common', 'assets/stickers/px/194.webp', 'food'), ST('px195', '👾', "Piesek", 'common', 'assets/stickers/px/195.webp', 'animals'), ST('px196', '👾', "Ciasto", 'epic', 'assets/stickers/px/196.webp', 'food'), ST('px197', '👾', "Różowy mózg", 'common', 'assets/stickers/px/197.webp', 'magic'), ST('px198', '👾', "Kapelusz z piórem", 'rare', 'assets/stickers/px/198.webp', 'magic'), ST('px199', '👾', "Kubek z czaszką", 'epic', 'assets/stickers/px/199.webp', 'food'), ST('px200', '👾', "Wesołe słońce", 'common', 'assets/stickers/px/200.webp', 'magic'), ST('px202', '👾', "Niebieskie serce", 'rare', 'assets/stickers/px/202.webp', 'magic'), ST('px203', '👾', "Pół awokado", 'rare', 'assets/stickers/px/203.webp', 'food'), ST('px204', '👾', "Góry", 'common', 'assets/stickers/px/204.webp', 'magic'), ST('px207', '👾', "Kalendarz", 'common', 'assets/stickers/px/207.webp', 'magic'), ST('px208', '👾', "Złota gwiazdka", 'rare', 'assets/stickers/px/208.webp', 'magic'), ST('px211', '👾', "Kawa czarna", 'rare', 'assets/stickers/px/211.webp', 'food'), ST('px213', '👾', "Bułka", 'rare', 'assets/stickers/px/213.webp', 'food'), ST('px214', '👾', "Kot krowa", 'epic', 'assets/stickers/px/214.webp', 'cats'), ST('px215', '👾', "Księga zaklęć", 'epic', 'assets/stickers/px/215.webp', 'magic'), ST('px216', '👾', "Mikrofon", 'common', 'assets/stickers/px/216.webp', 'magic'), ST('px217', '👾', "Stek", 'common', 'assets/stickers/px/217.webp', 'food'), ST('px218', '👾', "Arbuz", 'common', 'assets/stickers/px/218.webp', 'food'), ST('px219', '👾', "Duszek", 'legendary', 'assets/stickers/px/219.webp', 'animals'), ST('px220', '👾', "Roślinka", 'epic', 'assets/stickers/px/220.webp', 'magic'), ST('px221', '👾', "Pingwin z szalikiem", 'common', 'assets/stickers/px/221.webp', 'animals'), ST('px222', '👾', "Meduza", 'legendary', 'assets/stickers/px/222.webp', 'animals'), ST('px223', '👾', "Woda", 'common', 'assets/stickers/px/223.webp', 'food'), ST('px225', '👾', "Kot błękitny", 'rare', 'assets/stickers/px/225.webp', 'cats'), ST('px226', '👾', "Kot sierściuch", 'epic', 'assets/stickers/px/226.webp', 'cats'), ST('px229', '👾', "Kropla", 'epic', 'assets/stickers/px/229.webp', 'magic'),
  // 🌈 Boskie – ostateczne formy bohaterów, tęczowe i holograficzne (ponad mityczne)
  ST('dv_kitsune', '🦊', 'Kitsune', 'divine', 'assets/pixel/fox8-3.webp'), ST('dv_phoenix', '🔥', 'Feniks', 'divine', 'assets/pixel/phoenix8-3.webp'),
  ST('dv_dragon', '🐉', 'Smok Otchłani', 'divine', 'assets/pixel/dragon8-3.webp'), ST('dv_wolf', '🐺', 'Wilk Burzy', 'divine', 'assets/pixel/dog8-3.webp'),
  ST('dv_frog', '🐸', 'Król bagien', 'divine', 'assets/pixel/frog8-3.webp'), ST('dv_rabbit', '🐰', 'Księżycowy Królik', 'divine', 'assets/pixel/rabbit8-3.webp'),
  // 🥚 tylko z inkubatora (egg.js) – nie wypadają ze skrzynek
  ...[ST('chick', '🐣', "Pisklak", 'common', 'assets/stickers/px/069.webp'), ST('hatchling', '🐥', "Pingwinek", 'common', 'assets/stickers/px/022.webp'), ST('penguin', '🐧', "Pingwin", 'rare', 'assets/stickers/px/127.webp'), ST('parrot', '🦜', "Papuga", 'rare', 'assets/stickers/px/212.webp'),
    ST('dino', '🦕', "Kameleon", 'epic', 'assets/stickers/px/081.webp'), ST('trex', '🦖', "Rekin", 'epic', 'assets/stickers/px/175.webp'), ST('dragonling', '🐲', "Smoczy liść", 'legendary', 'assets/stickers/px/015.webp'), ST('swan', '🦢', "Kaczka", 'legendary', 'assets/stickers/px/126.webp'),
    // legendarne – tylko z jaj
    ST('eg_phoenix', '🔥', "Feniks", 'legendary', 'assets/stickers/egg/phoenix.webp'), ST('eg_dragon', '🐉', "Fioletowy smok", 'legendary', 'assets/stickers/egg/dragon.webp'),
    ST('eg_crown', '👑', "Korona królów", 'legendary', 'assets/stickers/egg/crown.webp'), ST('eg_scroll', '📜', "Zwój czarów", 'legendary', 'assets/stickers/egg/scroll.webp'),
    ST('eg_sword', '🗡️', "Lodowy miecz", 'legendary', 'assets/stickers/egg/sword.webp'), ST('eg_amulet', '😇', "Anielski amulet", 'legendary', 'assets/stickers/egg/amulet.webp'),
    ST('eg_void', '🌀', "Czarna dziura", 'legendary', 'assets/stickers/egg/void.webp'), ST('eg_claw', '🐾', "Smoczy pazur", 'legendary', 'assets/stickers/egg/claw.webp')].map(s => ({ ...s, hatch: true })),
];
// 🔴 ultra rzadkie dropy w każdej skrzynce: mityczna naklejka i mega pula kryształów (po 0,1%)
// 💎 w skrzynkach jako kryształ 8-bit
const GEM8 = 'assets/gear8/crystal128.webp';
const MYTHIC_P = .1, MEGA_GEMS_P = .1, MEGA_GEMS = 3000;
// mityczna naklejka nie wypada ze skrzynki z GIF-ami (tam tylko mega kryształy)
const mythicP = k => CASES[k]?.gif ? 0 : MYTHIC_P;
const FREE_STICKERS = ['wave', 'thumb', 'phew'];
const stickerById = id => STICKERS.find(s => s.id === id);
// cele osiągnięć kolekcjonerskich = aktualna liczba naklejek
if (typeof ACHIEVEMENTS !== 'undefined') for (const [id, n] of [['album_full', STICKERS.filter(x => !x.hatch && x.r !== 'divine').length], ['legends_all', STICKERS.filter(x => x.r === 'legendary' && !x.hatch).length], ['hatch_all', STICKERS.filter(x => x.hatch).length]]) { const a = ACHIEVEMENTS.find(x => x.id === id); if (a) a.goal = n; }
const CASES = {
  // 📦 skrzynki przedmiotów i skinów (dawne skrzynki z naklejkami). pool = szanse kategorii (%), gear/mat = rzadkość przedmiotu
  basic: { name: 'Skrzynka zapasów', icon: '📦', price: 120, pool: { potion: 34, mat: 20, gold: 15, boost: 12, gems: 11, gear: 8 },
    gear: { common: 60, rare: 32, epic: 7, legendary: 1 }, mat: { common: 55, rare: 30, epic: 12, legendary: 3 }, gold: [[40, 50], [80, 30], [160, 16], [400, 4]] },
  forge: { name: 'Skrzynka kowala', icon: '⚒️', price: 200, pool: { gear: 45, mat: 40, gold: 15 },
    gear: { common: 35, rare: 38, epic: 20, legendary: 6, mythic: 1 }, mat: { common: 28, rare: 32, epic: 22, legendary: 10, mythic: 4, ice: 2, void: 2 }, gold: [[60, 50], [120, 30], [250, 16], [600, 4]] },
  epic: { name: 'Skrzynka bohatera', icon: '🎁', price: 350, pool: { gear: 50, potion: 12, boost: 10, mat: 10, gold: 10, skin: 8 },
    gear: { common: 8, rare: 38, epic: 34, legendary: 16, mythic: 4 }, mat: { rare: 40, epic: 35, legendary: 18, mythic: 7 }, gold: [[100, 50], [200, 30], [400, 16], [1000, 4]] },
  skin: { name: 'Skrzynka skinów', icon: '🎨', price: 500, pool: { skin: 100 } },
  daily: { name: 'Codzienna skrzynka', icon: '🌞', price: 0, freeOnly: true, pool: { potion: 24, mat: 18, gold: 17, gear: 14, boost: 12, gems: 11, skin: 4 },
    gear: { common: 30, rare: 40, epic: 22, legendary: 7, mythic: 1 }, mat: { common: 40, rare: 35, epic: 18, legendary: 7 }, gold: [[60, 50], [120, 30], [250, 16], [500, 4]] },
};
// stare skrzynki tematyczne z naklejkami → zamieniają się w skrzynkę zapasów
const CASE_OLD = { cats: 'basic', animals: 'basic', food: 'basic', magic: 'basic', gif: 'basic' };
// Komplet naklejek danej rzadkości = jednorazowa premia
const SET_BONUS = { common: 200, rare: 400, epic: 800, legendary: 2000, mythic: 5000, divine: 15000 };
const setComplete = r => STICKERS.filter(s => s.r === r && !s.hatch).every(s => hasItem('sticker', s.id) || hasItem('shiny', s.id));
const isShiny = id => hasItem('shiny', id);
// 🌈 trzeci poziom: złota → holograficzna (za kryształy). Jedna waluta: dawny „pył gwiezdny” = kryształy (1 pył = 3 💎).
const isHolo = id => hasItem('holo', id);
const shinyLv = id => isHolo(id) ? 2 : isShiny(id) ? 1 : 0;
const fxCls = lv => lv >= 2 ? ' shiny holo' : lv ? ' shiny' : '';
const DUST_RATE = 3;
const dust = () => coins();
const addDust = (n, id) => { if (!S.wallet.some(w => w.id === (id || ''))) S.wallet.push({ id: id || uid(), n: Math.round(n * DUST_RATE), why: 'dust', t: Date.now() }); };
const HOLO_COST = { common: 60, rare: 120, epic: 240, legendary: 450, mythic: 1200, divine: 3000 };
// przeniesienie starego pyłu na kryształy (raz; stałe id – synchronizacja nie dubluje)
on('start', () => { const n = itemCount('dust', 'dust'); if (n > 0) { addItem('dust', 'dust', -n, 'dust-mig-' + n); S.wallet.push({ id: 'dust-mig-' + n, n: n * DUST_RATE, why: 'dust', t: Date.now() }); save(); } });
const DUST_OF = { common: 2, rare: 5, epic: 12, legendary: 30, mythic: 150, divine: 500 };
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
const studyGems = l => !l.m ? 0 : l.m === 'flip' ? (l.ms >= FLIP_MIN_MS ? .05 : 0) : ({ ok: 1, close: .6 }[l.v] ?? 0);   // 💎 za samą naukę: wpisana dobrze = 1 💎, prawie = 0,6, źle = nic
const QUIZ_GEM_CAP = 150;   // max 💎 dziennie z testów ABCD / pisemnych
function earnedCoins() {
  let c = Object.keys(S.ach).reduce((a, id) => a + (typeof achReward === 'function' ? achReward(id) : 30), 0);   // trudne osiągnięcia: 150
  const perDay = {}; let study = 0;
  for (const l of S.log) { const k = dayKey(l.t); perDay[k] = (perDay[k] || 0) + studyPoints(l); study += studyGems(l); }
  c += Object.values(perDay).filter(n => n >= (S.settings.goal || 50)).length * 20 + Math.floor(study);
  for (const g of S.games) if (!g.practice) c += Math.floor((g.correct || 0) / 4);
  for (const b of S.battles) c += battleReward(b);
  if (!S.stats?.stRetired) for (const r in SET_BONUS) if (setComplete(r)) c += SET_BONUS[r];   // po wycofaniu albumu premia jest w portfelu (st-set-bonus)
  return c;
}
function battleReward(b) { return b.bot ? ({ 1: 20, 0: 10, '-1': 5 }[b.won] || 0) : ({ 1: 50, 0: 25, '-1': 10 }[b.won] || 0); }
// 🪙 dwie waluty: 💎 kryształy (naklejki, skrzynki, skiny, motywy) i 🪙 złoto (bohater: broń, kuźnia, mikstury, boostery).
// Złoto zdobywasz w walkach (bossowie, wieża, łup). Starsze wpisy zostają kryształami (granica: S.stats.goldT).
const GOLD_WHY = new Set(['boss', 'tower', 'loot', 'loot-dup', 'boss-event', 'gold-start', 'forge', 'forge-slot', 'gear', 'potion', 'boost', 'hero', 'hero-case', 'sk-reset', 'weapon-case', 'duel']);
const goldWhy = why => GOLD_WHY.has(String(why || '').replace(/-[^-]*$/, '')) || GOLD_WHY.has(String(why || ''));
const isGold = w => goldWhy(w.why) && w.t >= (S.stats.goldT || Infinity);
const coins = () => earnedCoins() + S.wallet.reduce((a, w) => a + (isGold(w) ? 0 : w.n), 0);
const gold = () => S.wallet.reduce((a, w) => a + (isGold(w) ? w.n : 0), 0);
function spend(n, why) {
  if (goldWhy(why) && S.stats.goldT) { if (gold() < n) { toast(`Brakuje ${n - gold()} 🪙 złota – zdobywaj je w walkach z bossami`); return false; } S.wallet.push({ id: uid(), n: -n, why, t: Date.now() }); save(); return true; }
  if (coins() < n) { toast(`Brakuje ${n - coins()} 💎`); return false; }
  S.wallet.push({ id: uid(), n: -n, why, t: Date.now() }); save(); return true;
}
const itemCount = (kind, key) => S.items.filter(i => i.kind === kind && i.key === key).reduce((a, i) => a + (i.q ?? 1), 0);
const hasItem = (kind, key) => itemCount(kind, key) > 0;
const addItem = (kind, key, q = 1, id = uid()) => { if (S.items.some(i => i.id === id)) return; S.items.push({ id, kind, key, q, t: Date.now() }); save(); };
let ownedStickers = () => [...new Set([...FREE_STICKERS, ...STICKERS.filter(s => hasItem('sticker', s.id) || hasItem('shiny', s.id)).map(s => s.id)])];
const stickerTile = (id, extra = '') => { const s = stickerById(id); if (!s) return ''; return `<span class="mini-st${fxCls(shinyLv(id))}" style="--rc:${RARITY[s.r].color}" title="${esc(s.name)}"${extra}>${stE(s)}</span>`; };
const showcaseHTML = ids => (ids || []).filter(id => stickerById(id) || (typeof cosById === 'function' && cosById(id))).slice(0, 3).map(id => stickerById(id) ? stickerTile(id) : cosShowTile(id)).join('');
const cosShowTile = id => { const c = cosById(id); return `<span class="cos-sc r-${c.r}" style="--rc:${COS_R[c.r].c}" title="${esc(c.n)} · ${COS_R[c.r].n}">${cosIconHTML(c)}</span>`; };
const coinsHTML = () => `<span class="coins-pair"><span class="coins">💎 ${coins()}</span>${S.stats.goldT ? `<span class="coins gold">🪙 ${gold()}</span>` : ''}</span>`;

function rollRarity(odds) {
  let r = Math.random() * 100;
  for (const k of ['divine', 'mythic', 'legendary', 'epic', 'rare', 'common']) { if (r < (odds[k] || 0)) return k; r -= odds[k] || 0; }
  return 'common';
}
// pula skrzynki: bez naklejek z inkubatora i bez ultra-rzadkiego Kota żołnierza; skrzynka tematyczna – tylko swój dział
// 🔴 mityczny jackpot: losowa mityczna naklejka (wcześniej zdjęcie kota z mema – usunięte, prawa autorskie)
const mythicSt = () => { const L = STICKERS.filter(x => x.r === 'mythic' && !x.hatch); return L[Math.random() * L.length | 0]; };
const stPool = theme => STICKERS.filter(s => !s.hatch && (!theme || s.t === theme));
const rollSticker = (odds, theme) => { const r = rollRarity(odds), all = r === 'divine' ? stPool() : stPool(theme), pool = all.filter(s => s.r === r); const src = pool.length ? pool : all; return src[Math.random() * src.length | 0]; };
// 🎁 zawartość skrzynek: przedmioty bohatera, mikstury, boostery, cegły do kuźni, złoto, kryształy i skiny postaci
const CASE_CAT = { gear: ['⚔️', 'Przedmiot bohatera', '#f59e0b'], potion: ['🧪', 'Mikstura', '#ef4444'], boost: ['⏱️', 'Booster 30 min', '#a855f7'], mat: ['🧱', 'Cegła do kuźni', '#64748b'],
  gold: ['🪙', 'Złoto', '#eab308'], gems: ['💎', 'Kryształy', '#06b6d4'], skin: ['🎨', 'Skin postaci', '#ec4899'] };
const CASE_EXTRA = { respin: 5 };   // % szans na darmowe ponowne losowanie (poza skrzynką skinów)
const GEM_PRIZES = { basic: [[20, 50], [50, 30], [150, 17], [500, 3]], daily: [[30, 50], [60, 30], [150, 17], [500, 3]] };
const it8 = src => `<img class="st-img it8" src="${src}" alt="" draggable="false">`;
const RS5 = ['common', 'rare', 'epic', 'legendary', 'mythic'];
const pickW = o => { const e = Object.entries(o).filter(([, p]) => p > 0), sum = e.reduce((a, [, p]) => a + p, 0); let y = Math.random() * sum; for (const [k, p] of e) { if (y < p) return k; y -= p; } return e[0]?.[0]; };
const tierPick = t => { const y = Math.random() * 100; let a = 0; for (let i = 0; i < t.length; i++) { a += t[i][1]; if (y < a || i === t.length - 1) return [t[i][0], RS5[i]]; } };
const gearPool = r => typeof GEAR === 'undefined' ? [] : Object.keys(GEAR).filter(id => GEAR[id].r === r);
function casePrize(cat, c, k) {
  if (cat === 'gear') { let r = pickW(c.gear), pool = gearPool(r); for (let i = RS5.indexOf(r); !pool.length && i < RS5.length; i++) pool = gearPool(r = RS5[i]);
    if (!pool.length) return casePrize('gold', c, k); const id = pool[Math.random() * pool.length | 0], g = GEAR[id];
    return { kind: 'gear', id, r: g.r, e: '⚔️', name: g.name, ico: it8(fsrc(g.img)) }; }
  if (cat === 'potion') { const ks = Object.keys(POTIONS), id = ks[Math.random() * ks.length | 0], n = k === 'epic' ? 2 : 1;
    return { kind: 'potion', id, n, r: id === 'phoenix' ? 'epic' : 'rare', e: '🧪', name: POTIONS[id].name + (n > 1 ? ' ×' + n : ''), ico: it8(fsrc(POTIONS[id].img)) }; }
  if (cat === 'boost') { const ks = Object.keys(BOOSTS), id = ks[Math.random() * ks.length | 0]; return { kind: 'boost', id, r: 'epic', e: '⏱️', name: BOOSTS[id].name, ico: it8(fsrc(BOOSTS[id].img)) }; }
  if (cat === 'mat') { const id = pickW(c.mat), m = MATS[id], r = RARITY[id] ? id : 'epic', n = ['common', 'rare'].includes(id) ? 2 : 1;
    return { kind: 'mat', id, n, r, e: '🧱', name: m.n + (n > 1 ? ' ×' + n : ''), ico: it8(`assets/mat8/${m.img}.webp`) }; }
  if (cat === 'gold') { const [n, r] = tierPick(c.gold); return { kind: 'gold', id: 'gold' + n, n, r, e: '🪙', name: `+${n} 🪙`, ico: it8('assets/ui8b/gold.webp') }; }
  if (cat === 'gems') { const [n, r] = tierPick(GEM_PRIZES[k] || GEM_PRIZES.basic); return { kind: 'gems', id: 'gems' + n, n, r, e: '💎', name: `+${n} 💎`, img: GEM8 }; }
  if (cat === 'skin' && typeof skinRoll === 'function') { const w = skinRoll(); return { kind: 'skin', id: skinKey(w.line, w.r), line: w.line, r: w.r, e: '🎨', name: `${SKIN_NAME[w.r]} skin · ${CHAR_LINES[w.line]?.name || w.line}`,
    ico: `<img class="st-img it8 skin" src="${skinSrc(w.line, typeof heroForm === 'function' ? heroForm() : 3, w.r)}" alt="" draggable="false">` }; }
  return casePrize('gold', c, k);
}
function rollPrize(k, odds, force) {
  const c = CASES[k] || CASES.basic;
  if (force === 'mega' || (!force && Math.random() * 100 < MEGA_GEMS_P)) return { kind: 'gems', img: GEM8, id: 'gems' + MEGA_GEMS, n: MEGA_GEMS, e: '💎', name: `+${MEGA_GEMS} 💎`, r: 'mythic' };
  if (force === 'respin' || (!force && c.pool.skin !== 100 && Math.random() * 100 < CASE_EXTRA.respin)) return { kind: 'respin', id: 'respin', e: '🔁', name: 'Jeszcze raz!', r: 'epic' };
  if (force === 'jackpot') return casePrize('gems', { }, 'basic');
  if (force && CASE_CAT[force]) return casePrize(force, { ...CASES.epic, ...c }, k);
  if (force && RARITY[force] && typeof GEAR !== 'undefined') return casePrize('gear', { gear: { [force]: 100 } }, k);
  return casePrize(pickW(c.pool), c, k);
}
// ---------- zawartość skrzynki: dokładne szanse (te same reguły co rollPrize)
function caseDrops(k) {
  const c = CASES[k], out = [], add = (p, x, group) => p > 0 && out.push({ p, x, group });
  const resp = c.pool.skin === 100 ? 0 : CASE_EXTRA.respin, f = (100 - MEGA_GEMS_P) / 100;
  add(MEGA_GEMS_P, { kind: 'gems', img: GEM8, e: '💎', name: `${MEGA_GEMS} kryształów`, r: 'mythic' }, 'ultra');
  add(f * resp, { kind: 'respin', e: '🔁', name: 'Losuj jeszcze raz', r: 'epic' }, 'extra');
  const rest = f * (100 - resp) / 100, sum = Object.values(c.pool).reduce((a, b) => a + b, 0);
  for (const [cat, w] of Object.entries(c.pool)) {
    const P = rest * w / sum * 100, [ic, nm] = CASE_CAT[cat];
    const byR = (odds, name, ico) => { const s = Object.values(odds).reduce((a, b) => a + b, 0); for (const [r, p] of Object.entries(odds)) add(P * p / s, { kind: cat, e: ic, name: name(r), r: RARITY[r] ? r : 'epic', ico: ico(r) }, cat); };
    if (cat === 'gear') byR(c.gear, () => 'Losowy przedmiot', r => { const g = gearPool(r)[0]; return g ? it8(fsrc(GEAR[g].img)) : ic; });
    else if (cat === 'mat') byR(c.mat, r => MATS[r].n, r => it8(`assets/mat8/${MATS[r].img}.webp`));
    else if (cat === 'skin') byR(typeof SKIN_ODDS !== 'undefined' ? SKIN_ODDS : { rare: 100 }, r => `Skin ${(SKIN_NAME?.[r] || r).toLowerCase()}`, r => typeof skinSrc === 'function' ? `<img class="st-img it8 skin" src="${skinSrc(typeof heroLine === 'function' && hasSkins(heroLine()) ? heroLine() : 'cat', 3, r)}" alt="">` : ic);
    else if (cat === 'gold' || cat === 'gems') (cat === 'gold' ? c.gold : GEM_PRIZES[k] || GEM_PRIZES.basic).forEach(([n, p], i) => add(P * p / 100, { kind: cat, e: ic, name: `${n} ${cat === 'gold' ? 'złota' : 'kryształów'}`, r: RS5[i], ico: cat === 'gold' ? it8('assets/ui8b/gold.webp') : it8(GEM8) }, cat));
    else if (cat === 'potion') { const ks = Object.keys(POTIONS); ks.forEach(id => add(P / ks.length, { kind: cat, e: ic, name: POTIONS[id].name, r: id === 'phoenix' ? 'epic' : 'rare', ico: it8(fsrc(POTIONS[id].img)) }, cat)); }
    else if (cat === 'boost') { const ks = Object.keys(BOOSTS); ks.forEach(id => add(P / ks.length, { kind: cat, e: ic, name: BOOSTS[id].name, r: 'epic', ico: it8(fsrc(BOOSTS[id].img)) }, cat)); }
  }
  return out;
}
const pctFmt = p => (p >= 10 ? p.toFixed(1) : p >= 1 ? p.toFixed(2) : p >= .1 ? p.toFixed(2) : p.toFixed(3)).replace(/\.?0+$/, '').replace('.', ',') + '%';
const prIco = s => s.ico || stE(s);
function caseDropsHTML(k) {
  const c = CASES[k], d = caseDrops(k);
  const sum = g => d.filter(x => x.group === g).reduce((a, x) => a + x.p, 0);
  const row = ({ p, x }) => `<div class="drop-row" style="--rc:${RARITY[x.r].color}"><span class="drop-ic">${prIco(x)}</span>
    <span class="grow"><b>${esc(x.name)}</b><small style="color:${RARITY[x.r].color}">${x.kind === 'respin' ? 'Darmowe losowanie' : RARITY[x.r].name}</small></span><b class="drop-p">${pctFmt(p)}</b></div>`;
  const sec = (g, title) => d.some(x => x.group === g) ? `<h3>${title} <small class="muted">${pctFmt(sum(g))}</small></h3>${d.filter(x => x.group === g).sort((a, b) => b.p - a.p).map(row).join('')}` : '';
  return `<div class="drops-box"><div class="row nowrap"><span class="drops-crate">${crateImg(k)}</span><div class="grow"><b style="font-size:18px">${c.name}</b><div class="small muted">Zawartość skrzynki i szanse na każdą nagrodę</div></div><button class="iconbtn" data-act="drops-close">✕</button></div>
    <div class="drops-list">${sec('ultra', '🔴 Ultra rzadkie')}${Object.keys(CASE_CAT).map(g => sec(g, CASE_CAT[g][0] + ' ' + CASE_CAT[g][1])).join('')}${sec('extra', '🔁 Bonus')}</div>
    <p class="small muted" style="margin:0">Szanse sumują się do 100%. Duplikat przedmiotu zamienia się w cegłę do kuźni, duplikat skinu – w kryształy.</p></div>`;
}
function showCaseDrops(k) {
  document.querySelector('.drops-ov')?.remove();
  const ov = document.createElement('div'); ov.className = 'drops-ov'; ov.innerHTML = caseDropsHTML(k);
  ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-act="drops-close"]')) { e.stopPropagation(); ov.remove(); } });
  document.body.append(ov);
}
const prizeTile = s => `<div class="tile${s.kind ? ' prize-' + s.kind : ''}" style="--rc:${RARITY[s.r].color}"><span>${prIco(s)}</span><small>${esc(s.name)}</small></div>`;
// przyznanie nagrody ze skrzynki (zwraca true, gdy to duplikat)
function grantPrize(won, k) {
  const key = 'case-' + uid();
  if (won.kind === 'gems') { S.wallet.push({ id: key, n: won.n, why: 'case-gems', t: Date.now() }); if (won.r === 'legendary' || won.r === 'mythic') S.stats.jackpot = 1; if (won.r === 'mythic') S.stats.megaGems = 1; }
  else if (won.kind === 'gold') S.wallet.push({ id: key, n: won.n, why: 'loot', t: Date.now() });
  else if (won.kind === 'respin') addItem('case', k, 1, 'respin-' + uid());
  else if (won.kind === 'gear') { if (ownsGear(won.id)) { won.dup = 1; won.matK = MATS[won.r] ? won.r : 'common'; addItem('forgemat', won.matK, 1, key); } else addItem('gear', won.id, 1, key); }
  else if (won.kind === 'potion') addItem('potion', won.id, won.n || 1, key);
  else if (won.kind === 'boost') addItem('boost', won.id, 1, key);
  else if (won.kind === 'mat') addItem('forgemat', won.id, won.n || 1, key);
  else if (won.kind === 'skin') { if (skinOwned(won.line, won.r)) { won.dup = 1; S.wallet.push({ id: key, n: SKIN_DUP[won.r], why: 'skin-dup', t: Date.now() }); } else addItem('skin', won.id, 1, key); }
  if (['legendary', 'mythic'].includes(won.r) && won.kind !== 'gems') S.stats.legendary = 1;
  return !!won.dup;
}
const prizeMsg = won => won.kind === 'gems' ? 'Kryształy dodane do salda 💎' : won.kind === 'gold' ? 'Złoto dodane do sakiewki bohatera 🪙'
  : won.kind === 'respin' ? 'Otwierasz tę skrzynkę jeszcze raz – za darmo!'
  : won.kind === 'gear' ? (won.dup ? `Masz już ten przedmiot – dostajesz ${MATS[won.matK]?.n || 'cegłę'} do kuźni 🧱.` : 'Nowy przedmiot w ekwipunku bohatera – załóż go w zakładce Bohater ⚔️.')
  : won.kind === 'skin' ? (won.dup ? `Masz już ten skin – dostajesz +${SKIN_DUP[won.r]} 💎.` : 'Nowy skin postaci – załóż go w Bohater → Postać 🎨.')
  : won.kind === 'potion' ? 'Mikstura czeka w plecaku na walkę z bossem 🧪.' : won.kind === 'boost' ? 'Booster czeka w zakładce Bohater – włącz go, kiedy chcesz ⏱️.'
  : won.kind === 'mat' ? 'Cegła do kuźni – skraca ulepszanie broni 🧱.' : '';

// ---------- sklep
ROUTES.shop = () => {
  const freeKinds = Object.keys(CASES).filter(k => hasItem('case', k));
  const freeN = freeKinds.reduce((a, k) => a + itemCount('case', k), 0);
  return { tab: 'train', html: `
  <div class="row nowrap"><button class="iconbtn" data-go="#/battles">‹</button><h1 class="grow">Sklep</h1>${coinsHTML()}</div>
  <details class="small muted shop-info"><summary>Skąd brać kryształy 💎?</summary>
    <p><b>✍️ Udowodniona wiedza (najwięcej):</b> wpisana dobra odpowiedź = 1 💎 (prawie dobrze 0,6), 🔥 10 wpisanych dobrze z rzędu = +5 💎, 🌳 karta zapamiętana na 3 tygodnie = +3 💎 (przewijana +1), ukończony zestaw (wpisywanie ×2), testy ABCD / pisemne (do 150 💎 dziennie). Przewijanie bez wpisywania daje mało.</p>
    <p>Poza tym: bitwy, osiągnięcia (od 30 💎 za łatwe do 600 💎 za legendarne, platyna 2000 💎), dni z celem dziennym (20 💎), zadania dnia, testy, gry pamięciowe – i skrzynki. 🌞 <b>Codzienna skrzynka</b> (lepsze szanse!) za ukończony zestaw fiszek albo cel dzienny.</p></details>
  ${freeN ? `<div class="banner row nowrap"><span class="grow">🎁 Masz <b>${freeN}</b> darmowe ${plural(freeN, 'skrzynkę', 'skrzynki', 'skrzynek')}: ${freeKinds.map(k => `${crateImg(k, 'inline')} ${CASES[k].name} ×${itemCount('case', k)}`).join(', ')}</span>
    <button class="primary sm" data-go="#/case/${freeKinds[0]}?free=1">Otwórz</button></div>` : ''}
  <div class="card case-groups"><h2 style="margin-top:0">Skrzynki</h2>
    <p class="small muted" style="margin:0 0 10px">Broń i zbroja dla bohatera, mikstury, boostery, cegły do kuźni, złoto i skiny postaci. Stuknij skrzynkę, żeby zobaczyć dokładne szanse.</p>
    <div class="case-list">${['basic', 'forge', 'epic', 'skin'].filter(k => CASES[k]).map(k => { const c = CASES[k], sum = Object.values(c.pool).reduce((a, b) => a + b, 0);
      return `<div class="case-row ${k}"><div class="ci" data-act="case-drops" data-k="${k}" role="button" title="Zawartość i szanse">${caseIco(k)}</div>
        <div class="grow cr-mid"><b data-act="case-drops" data-k="${k}">${c.name}</b><div class="small muted cr-what">${Object.keys(c.pool).map(x => CASE_CAT[x][1]).join(' · ')}</div><div class="odds-bar" title="${Object.entries(c.pool).map(([x, p]) => `${CASE_CAT[x][1]} ${Math.round(p / sum * 100)}%`).join(' · ')}">${Object.entries(c.pool).map(([x, p]) => `<i style="flex:${p};background:${CASE_CAT[x][2]}"></i>`).join('')}</div></div>
        <div class="cr-btns"><button class="sm ghost" data-act="case-drops" data-k="${k}" title="Zawartość i szanse">📋</button><button class="primary sm" data-go="#/case/${k}">${c.price} 💎</button></div></div>`; }).join('')}</div></div>
  <div class="card row nowrap inv-cta" data-go="#/inv"><span style="font-size:34px">🎒</span><div class="grow"><b>Ekwipunek</b>
    <div class="small muted">Skrzynki do otwarcia i naklejki do czatu</div></div><span style="font-size:22px">›</span></div>
  <div class="card"><h2 style="margin-top:0">Efekty zwycięstwa</h2><div class="effects">${EFFECTS.map(e => {
    const own = !e.price || hasItem('effect', e.id), on = (S.settings.effect || 'classic') === e.id;
    return `<button class="eff${on ? ' on' : ''}" data-act="effect" data-id="${e.id}"><span>${e.icon}</span><b>${e.name}</b><small>${on ? '✓ aktywny' : own ? 'wybierz' : e.price + ' 💎'}</small></button>`; }).join('')}</div></div>
  <div class="card"><h2 style="margin-top:0">Motywy premium</h2><div class="themes">${THEMES.filter(t => t.price).map(t => `<button class="theme${t.fx ? ' th-fx' : ''}" style="background:${t.bg};background-image:${t.image}${themeFxVars(t)}" data-act="buy-theme" data-id="${t.id}">
    <span class="dot" style="background:${t.accent}"></span><b style="color:${lum(t.bg) < .18 ? '#fff' : '#1b1d29'}">${t.name}</b><small class="lock">${hasItem('theme', t.id) ? '✓ masz' : t.price + ' 💎'}</small></button>`).join('')}</div></div>` };
};

// ---------- otwieranie skrzynki (ruletka)
let SPIN = null;
ROUTES.case = (parts, q) => {
  const k = parts[1], c = CASES[k]; if (!c) return { html: '<a href="#/shop">Wróć</a>' };
  // tryb testowy (panel hosta): bez kosztu, nic nie trafia do albumu
  const test = q.get('test') && typeof hostUnlocked === 'function' && hostUnlocked() ? (RARITY[q.get('r')] || ['gems', 'respin', 'jackpot', 'mega', ...Object.keys(CASE_CAT)].includes(q.get('r')) ? q.get('r') : 'any') : '';
  const free = !test && q.get('free') && hasItem('case', k);
  if (!SPIN || SPIN.k !== k) SPIN = { k, phase: 'ready' };
  const tiles = (SPIN.strip || (SPIN.idle = SPIN.idle || Array.from({ length: 9 }, () => rollPrize(k, c.odds)))).map(prizeTile).join('');
  const won = SPIN.won;
  return { focus: true, html: `
  <div class="studybar"><button class="iconbtn" data-act="case-close">✕</button><div class="title">${c.icon} ${c.name}</div>${coinsHTML()}</div>
  <div class="roulette"><div class="marker"></div><div class="strip" id="strip">${tiles}</div></div>
  ${SPIN.phase === 'done' && won ? `<div class="card center reveal" style="--rc:${RARITY[won.r].color}">
      <div class="big-st">${prIco(won)}</div><b style="font-size:22px">${won.kind === 'gems' ? `+${won.n} kryształów` : won.kind === 'gold' ? `+${won.n} złota` : won.kind === 'respin' ? 'Losuj jeszcze raz!' : esc(won.name)}</b>
      <div style="color:${RARITY[won.r].color};font-weight:700">${won.kind === 'gems' ? (won.r === 'legendary' || won.r === 'mythic' ? '💰 JACKPOT' : 'Kryształy') : won.kind === 'respin' ? 'Darmowe losowanie' : `${CASE_CAT[won.kind]?.[1] || ''} · ${RARITY[won.r].name}`}</div>
      <p class="small muted">${SPIN.test ? '🧪 Tryb testowy – nic nie trafia na konto.' : prizeMsg(won)}</p>
      <div class="row"><button class="primary grow${won.kind === 'respin' ? ' pulse' : ''}" data-act="case-again" data-k="${k}" data-test="${SPIN.test || ''}">${won.kind === 'respin' ? '🔁 Losuj jeszcze raz' : 'Otwórz kolejną'}</button><button class="grow" data-go="${SPIN.test ? '#/host' : won.kind === 'skin' || won.kind === 'gear' || won.kind === 'boost' ? '#/hero' : '#/shop'}">${SPIN.test ? 'Panel hosta' : won.kind === 'skin' || won.kind === 'gear' || won.kind === 'boost' ? 'Do bohatera' : 'Sklep'}</button></div></div>`
    : `<div class="odds center">${(() => { const sum = Object.values(c.pool).reduce((a, b) => a + b, 0); return Object.entries(c.pool).map(([x, p]) => `<span style="color:${CASE_CAT[x][2]}">${CASE_CAT[x][0]} ${CASE_CAT[x][1]} ${Math.round(p / sum * 100)}%</span>`).join(' '); })()}<br>
       <span style="color:${RARITY.mythic.color}">🔴 ${MEGA_GEMS} 💎 ${pctFmt(MEGA_GEMS_P)}</span>${c.pool.skin === 100 ? '' : ` · <span>🔁 Jeszcze raz ${CASE_EXTRA.respin}%</span>`}</div>
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
  SPIN = { k, phase: 'spinning', strip, won, dup: false, test };
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
      SPIN.dup = grantPrize(won, k);
      S.stats.cases = (S.stats.cases || 0) + 1;
    }
    SPIN.phase = 'done'; save(); render();
    const tr = $('#strip'); if (tr) { tr.style.transition = 'none'; tr.style.transform = `translateX(${-target}px)`; }
    if (sfx) sfx.reveal(['mythic', 'divine'].includes(won.r) ? 'legendary' : won.r); else { tick(880, .15, .12); setTimeout(() => tick(1320, .25, .12), 120); }
    if (won.kind === 'gems' && typeof FX !== 'undefined') setTimeout(() => { const ac = fxCtxGet(); if (ac) FX.sparkle(ac); }, 500);
    if (won.kind === 'respin') celebrate('🔁 Losuj jeszcze raz!', 'Darmowe ponowne otwarcie skrzynki');
    else if (won.r === 'divine') { celebrate(`🌈 BOSKA: ${won.name}!`, 'Rzadsza niż mityczna – tęczowa naklejka z holograficznym blaskiem!'); confetti(400); setTimeout(() => confetti(400), 800); setTimeout(() => confetti(300), 1600); }
    else if (won.r === 'mythic') { celebrate(won.kind === 'gems' ? `💎 +${won.n} – MEGA JACKPOT!` : `🔴 MITYCZNA: ${won.name}!`, won.kind === 'gems' || won.mythicJackpot ? 'Szansa 0,1% – trafia się raz na 1000 skrzynek!' : 'Najrzadsza rzadkość w kolekcji!'); confetti(300); setTimeout(() => confetti(300), 900); }
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

// ---------- 🎒 Ekwipunek: nieotwarte skrzynki i naklejki do czatu
let gifCollectionHTML = function () {
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
    <div class="card"><h2 style="margin-top:0">🎁 Skrzynki do otwarcia</h2>
      ${cases.length ? cases.map(k => `<div class="row nowrap inv-case"><span class="inv-crate">${crateImg(k)}</span><b class="grow">${CASES[k].name} ×${itemCount('case', k)}</b><button class="primary sm" data-go="#/case/${k}?free=1">Otwórz</button></div>`).join('')
        : '<p class="small muted" style="margin:0">Brak – darmowe skrzynki dostajesz za wygrane bitwy, zestawy fiszek i nagrody dnia. <a href="#/shop">Sklep ›</a></p>'}</div>
    <div class="card"><div class="row nowrap"><h2 class="grow" style="margin:0">🃏 Naklejki</h2><span class="small muted">${st.length}</span></div>
      <p class="small muted">Stały zestaw dla każdego – wysyłasz je przeciwnikowi w bitwie, w duecie i na czacie ze znajomymi. Stuknij, żeby zobaczyć animację.</p>
      <div class="inv-st">${st.map(s => `<span style="--rc:${RARITY[s.r].color}" data-act="st-preview" data-id="${s.id}" title="${esc(s.name)}">${stE(s)}</span>`).join('')}</div></div>` };
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

on('start', () => { if (!S.stats.goldT) { S.stats.goldT = Date.now(); S.wallet.push({ id: 'gold-start', n: 300, why: 'gold-start', t: S.stats.goldT + 1 }); save(); setTimeout(() => toast('🪙 Nowa waluta: złoto na bohatera (broń, kuźnia, mikstury). Na start +300 🪙', 5000), 2500); } });

// ⚖️ treści z cudzymi prawami (żaby w stylu Pepe, puszki z logo, zdjęcie kota i GIF-y z memów) zostały usunięte – zwrot w kryształach
const COPY_GONE = { soldiercat: 500, angry: 120, px005: 50, px021: 120, px032: 50, px039: 250, px111: 50, px132: 50, px119: 50, px124: 120 };
on('start', () => {
  if (S.stats.copyRefund) return;
  let n = 0;
  S.items = (S.items || []).filter(i => {
    if (i.kind === 'sticker' && COPY_GONE[i.key] != null && !stickerById(i.key)) { n += COPY_GONE[i.key] * Math.max(1, i.q || 1); return false; }
    if (i.kind === 'gif') { n += 150; return false; }
    return true;
  });
  if (S.profile?.showcase) S.profile.showcase = S.profile.showcase.filter(id => !COPY_GONE[id]);
  if (S.settings?.reactions) S.settings.reactions = {};
  S.stats.copyRefund = 1;
  if (n > 0) { S.wallet.push({ id: 'copy-refund', n, why: 'refund', t: Date.now() }); setTimeout(() => toast(`💎 +${n} – zwrot za wycofane naklejki i GIF-y`, 5000), 1500); }
  save();
});

// 🎞️ GIF-y, skrzynka z GIF-ami i reakcje GIF zostały całkowicie usunięte (prawa autorskie do memów)
delete CASES.gif;
gifCollectionHTML = () => '';

// 🃏 Kolekcja naklejek wycofana: zostaje stały zestaw naklejek dla wszystkich – do wysyłania w bitwach, na czacie i w duecie.
// Skrzynki dają teraz przedmioty i skiny. Za posiadane naklejki jednorazowy zwrot w kryształach (stałe id – bez dubli przy synchronizacji).
const DEFAULT_ST = ['thumb', 'cool', 'think', 'sleepy', 'phew', 'clap', 'party', 'fire', 'brain', 'goat', 'coffee', 'px013', 'px078', 'px055', 'px035', 'px104'].filter(id => stickerById(id));
ownedStickers = () => DEFAULT_ST.slice();
const ST_RETIRED_ACH = ['legendary', 'shiny_1', 'holo_1', 'album_full', 'legends_all', 'shiny_10', 'shiny_legend', 'hatch_all', 'mythic', 'gifts_10'];
const ST_ACH_REWARD = {};
if (typeof ACHIEVEMENTS !== 'undefined') for (let i = ACHIEVEMENTS.length - 1; i >= 0; i--) if (ST_RETIRED_ACH.includes(ACHIEVEMENTS[i].id)) { ST_ACH_REWARD[ACHIEVEMENTS[i].id] = ACHIEVEMENTS[i].reward || 30; ACHIEVEMENTS.splice(i, 1); }
const ST_OLD_T = 1793554663000;   // wpisy „historyczne” (zarobione przed zmianą) – poza dziennym limitem serwera
const ST_REFUND = { common: 20, rare: 60, epic: 180, legendary: 600, mythic: 2500, divine: 5000 };
on('start', () => {
  let ch = 0;
  for (const i of S.items || []) if (i.kind === 'case' && CASE_OLD[i.key]) { i.key = CASE_OLD[i.key]; ch = 1; }   // nieotwarte stare skrzynki → zapasów
  const has = id => S.wallet.some(w => w.id === id);
  if (!S.stats.stRetired) {
    let set = 0; for (const r in SET_BONUS) if (setComplete(r)) set += SET_BONUS[r];
    let n = 0;
    for (const s of STICKERS) { const q = itemCount('sticker', s.id), v = ST_REFUND[s.r] || 20; if (q > 0) n += q * v; if (isShiny(s.id)) n += 3 * v; if (isHolo(s.id)) n += HOLO_COST[s.r] || 0; }
    n = Math.min(12000, n);
    if (set && !has('st-set-bonus')) S.wallet.push({ id: 'st-set-bonus', n: set, why: 'refund', t: ST_OLD_T });
    if (n && !has('st-refund')) S.wallet.push({ id: 'st-refund', n, why: 'refund', t: Date.now() });
    for (const id in ST_ACH_REWARD) if (S.ach?.[id] && ST_ACH_REWARD[id] > 30 && !has('achret-' + id)) S.wallet.push({ id: 'achret-' + id, n: ST_ACH_REWARD[id] - 30, why: 'refund', t: ST_OLD_T });
    if (S.profile?.showcase) { S.profile.showcase = S.profile.showcase.filter(id => !stickerById(id)); S.profile.mod = Date.now(); }
    S.stats.stRetired = 1; ch = 1;
    if (n + set) setTimeout(() => toast(`🃏 Album naklejek zamieniony na skrzynki przedmiotów i skinów – zwrot +${n + set} 💎`, 6000), 1800);
  }
  if (ch) save();
});

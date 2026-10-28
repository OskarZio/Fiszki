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
const CRATE_OF = { basic: 'basic', epic: 'epic', daily: 'daily', cats: 'cats', animals: 'animals', food: 'food', magic: 'magic', gif: 'gif', hero: 'hero', boss: 'boss', pvp: 'ice', grab: 'gem' };
const crateImg = (k, cls = '') => `<img class="crate-img ${cls}" src="assets/crates/${CRATE_OF[k] || 'basic'}.webp" alt="" draggable="false">`;
const caseIco = k => crateImg(k, 'case-img');
const STICKERS = [
  ST('thumb', '👍', "Uśmiech", 'epic', 'assets/stickers/px/157.webp', 'magic'), ST('cool', '😎', "Kot szef", 'rare', 'assets/stickers/px/057.webp', 'cats'), ST('nerd', '🤓', "Panda w okularach", 'common', 'assets/stickers/px/033.webp', 'animals'), ST('books', '📚', "Książka", 'rare', 'assets/stickers/px/210.webp', 'magic'),
  ST('coffee', '☕', "Kawa", 'common', 'assets/stickers/px/002.webp', 'food'), ST('monkey', '🙈', "Małpka", 'rare', 'assets/stickers/px/201.webp', 'animals'), ST('sleepy', '😴', "Śpioch", 'common', 'assets/stickers/px/072.webp', 'cats'), ST('pizza', '🍕', "Pizza", 'rare', 'assets/stickers/px/028.webp', 'food'),
  ST('turtle', '🐢', "Żółw", 'rare', 'assets/stickers/px/095.webp', 'animals'), ST('target', '🎯', "Zakaz", 'common', 'assets/stickers/px/163.webp', 'magic'), ST('muscle', '💪', "Hantla", 'legendary', 'assets/stickers/px/108.webp', 'magic'), ST('think', '🤔', "Mędrzec", 'common', 'assets/stickers/px/034.webp', 'animals'),
  ST('phew', '😅', "Chmurka", 'rare', 'assets/stickers/px/130.webp', 'magic'), ST('wave', '👋', "Fala", 'rare', 'assets/stickers/px/083.webp', 'magic'), ST('clap', '👏', "Good Vibes", 'legendary', 'assets/stickers/px/019.webp', 'magic'),
  ST('fire', '🔥', "Płomień", 'rare', 'assets/stickers/px/043.webp', 'magic'), ST('brain', '🧠', "Mózg", 'epic', 'assets/stickers/px/101.webp', 'magic'), ST('zap', '⚡', "Błyskawica", 'epic', 'assets/stickers/px/051.webp', 'food'), ST('rocket', '🚀', "Odrzutowiec", 'legendary', 'assets/stickers/px/023.webp', 'animals'),
  ST('owl', '🦉', "Drzemka", 'epic', 'assets/stickers/px/077.webp', 'magic'), ST('party', '🎉', "Keep Going", 'legendary', 'assets/stickers/px/038.webp', 'magic'), ST('angry', '😤', "Zła żaba", 'epic', 'assets/stickers/px/171.webp', 'animals'), ST('mind', '🤯', "Bobas w okularach", 'legendary', 'assets/stickers/px/103.webp', 'animals'),
  ST('goat', '🐐', "GOAT", 'mythic', 'assets/stickers/px/000.webp', 'cats'), ST('clover', '🍀', "Zielony motyl", 'rare', 'assets/stickers/px/148.webp', 'animals'),
  ST('crown', '👑', "Korona", 'legendary', 'assets/stickers/px/206.webp', 'magic'), ST('gem', '💎', "Diament", 'legendary', 'assets/stickers/px/044.webp', 'magic'), ST('unicorn', '🦄', "Motyl", 'legendary', 'assets/stickers/px/164.webp', 'animals'), ST('dragon', '🐉', "Rekin z łapą", 'mythic', 'assets/stickers/px/227.webp', 'animals'),
  ST('volcano', '🌋', "Ogień", 'mythic', 'assets/stickers/px/102.webp', 'magic'), ST('ninja', '🥷', "Kot ninja", 'legendary', 'assets/stickers/px/224.webp', 'cats'), ST('wizard', '🧙', "Kapelusz czarodzieja", 'legendary', 'assets/stickers/px/046.webp', 'magic'),
  ST('trophy', '🏆', "Puchar", 'mythic', 'assets/stickers/px/058.webp', 'magic'), ST('comet', '☄️', "Gwiezdny pył", 'mythic', 'assets/stickers/px/228.webp', 'magic'), ST('galaxy', '🌌', "UFO", 'mythic', 'assets/stickers/px/209.webp', 'magic'), ST('trident', '🔱', "Miecz", 'mythic', 'assets/stickers/px/205.webp', 'magic'),
  // 👾 kolekcja 8-bit (pixel art)
  ST('px001', '👾', "Miś w czapce", 'epic', 'assets/stickers/px/001.webp', 'animals'), ST('px003', '👾', "Lizak", 'rare', 'assets/stickers/px/003.webp', 'food'), ST('px004', '👾', "Leniwy kot", 'epic', 'assets/stickers/px/004.webp', 'cats'), ST('px005', '👾', "Żabka", 'legendary', 'assets/stickers/px/005.webp', 'animals'), ST('px006', '👾', "Kot w kapeluszu", 'epic', 'assets/stickers/px/006.webp', 'cats'), ST('px007', '👾', "Ognisko", 'common', 'assets/stickers/px/007.webp', 'magic'), ST('px008', '👾', "Złota moneta", 'epic', 'assets/stickers/px/008.webp', 'magic'), ST('px009', '👾', "Szop", 'common', 'assets/stickers/px/009.webp', 'animals'), ST('px010', '👾', "Kot przebieraniec", 'rare', 'assets/stickers/px/010.webp', 'cats'), ST('px011', '👾', "Pies w okularach", 'epic', 'assets/stickers/px/011.webp', 'animals'), ST('px012', '👾', "Wiedźma", 'rare', 'assets/stickers/px/012.webp', 'animals'), ST('px013', '👾', "Serce", 'epic', 'assets/stickers/px/013.webp', 'magic'), ST('px014', '👾', "Kotek nocny", 'rare', 'assets/stickers/px/014.webp', 'cats'), ST('px016', '👾', "Kanapka", 'epic', 'assets/stickers/px/016.webp', 'food'), ST('px017', '👾', "Kot w kubku", 'rare', 'assets/stickers/px/017.webp', 'cats'), ST('px018', '👾', "Kotek", 'rare', 'assets/stickers/px/018.webp', 'cats'), ST('px020', '👾', "Koza", 'common', 'assets/stickers/px/020.webp', 'animals'), ST('px021', '👾', "Płacząca żaba", 'epic', 'assets/stickers/px/021.webp', 'animals'), ST('px024', '👾', "Diament z oczami", 'legendary', 'assets/stickers/px/024.webp', 'magic'), ST('px025', '👾', "Kot na czatach", 'rare', 'assets/stickers/px/025.webp', 'cats'), ST('px026', '👾', "Różowe serce", 'epic', 'assets/stickers/px/026.webp', 'magic'), ST('px027', '👾', "Kryształ", 'rare', 'assets/stickers/px/027.webp', 'magic'), ST('px029', '👾', "Czarny kot", 'common', 'assets/stickers/px/029.webp', 'cats'), ST('px030', '👾', "Rudzielec", 'common', 'assets/stickers/px/030.webp', 'cats'), ST('px031', '👾', "Kotek różowe uszy", 'rare', 'assets/stickers/px/031.webp', 'cats'), ST('px032', '👾', "Smutna żaba", 'epic', 'assets/stickers/px/032.webp', 'animals'), ST('px035', '👾', "Pieseł", 'rare', 'assets/stickers/px/035.webp', 'animals'), ST('px036', '👾', "Ziarno kawy", 'common', 'assets/stickers/px/036.webp', 'food'), ST('px037', '👾', "Kamera", 'epic', 'assets/stickers/px/037.webp', 'magic'), ST('px039', '👾', "Żabi król", 'legendary', 'assets/stickers/px/039.webp', 'animals'), ST('px040', '👾', "Kwiatek", 'common', 'assets/stickers/px/040.webp', 'magic'), ST('px041', '👾', "Ziomek w czapce", 'common', 'assets/stickers/px/041.webp', 'animals'), ST('px042', '👾', "Pręgowany kot", 'epic', 'assets/stickers/px/042.webp', 'cats'), ST('px045', '👾', "Gnom", 'epic', 'assets/stickers/px/045.webp', 'animals'), ST('px047', '👾', "Kot w smokingu", 'common', 'assets/stickers/px/047.webp', 'cats'), ST('px048', '👾', "Zeszyt", 'rare', 'assets/stickers/px/048.webp', 'magic'), ST('px049', '👾', "Pióro", 'rare', 'assets/stickers/px/049.webp', 'magic'), ST('px050', '👾', "Fioletowy kot", 'rare', 'assets/stickers/px/050.webp', 'cats'), ST('px052', '👾', "Wiewiórka", 'epic', 'assets/stickers/px/052.webp', 'animals'), ST('px053', '👾', "Plecak", 'rare', 'assets/stickers/px/053.webp', 'magic'), ST('px054', '👾', "Muchomor", 'rare', 'assets/stickers/px/054.webp', 'magic'), ST('px055', '👾', "Kot zrzęda", 'legendary', 'assets/stickers/px/055.webp', 'cats'), ST('px056', '👾', "Gogle", 'epic', 'assets/stickers/px/056.webp', 'magic'), ST('px059', '👾', "Księżycowy kot", 'rare', 'assets/stickers/px/059.webp', 'cats'), ST('px060', '👾', "Truskawka", 'rare', 'assets/stickers/px/060.webp', 'food'), ST('px061', '👾', "Gwiazda", 'epic', 'assets/stickers/px/061.webp', 'magic'), ST('px062', '👾', "Just One More Rep", 'mythic', 'assets/stickers/px/062.webp', 'magic'), ST('px063', '👾', "Chili", 'rare', 'assets/stickers/px/063.webp', 'food'), ST('px064', '👾', "Kawa na wynos", 'common', 'assets/stickers/px/064.webp', 'food'), ST('px065', '👾', "Kot o zielonych oczach", 'rare', 'assets/stickers/px/065.webp', 'cats'), ST('px066', '👾', "Śpiący lis", 'rare', 'assets/stickers/px/066.webp', 'animals'), ST('px067', '👾', "Laptop z mocą", 'legendary', 'assets/stickers/px/067.webp', 'magic'), ST('px068', '👾', "No Signal", 'mythic', 'assets/stickers/px/068.webp', 'magic'), ST('px070', '👾', "Awokado", 'common', 'assets/stickers/px/070.webp', 'food'), ST('px071', '👾', "Chudy", 'mythic', 'assets/stickers/px/071.webp', 'cats'), ST('px073', '👾', "Kubek kawy", 'epic', 'assets/stickers/px/073.webp', 'food'), ST('px074', '👾', "Namiot", 'common', 'assets/stickers/px/074.webp', 'magic'), ST('px075', '👾', "Rogalik", 'rare', 'assets/stickers/px/075.webp', 'food'), ST('px076', '👾', "Kalkulator", 'epic', 'assets/stickers/px/076.webp', 'magic'), ST('px078', '👾', "Złamane serce", 'common', 'assets/stickers/px/078.webp', 'magic'), ST('px079', '👾', "Kubek z buźką", 'common', 'assets/stickers/px/079.webp', 'food'), ST('px080', '👾', "Fioletowy kryształ", 'rare', 'assets/stickers/px/080.webp', 'magic'), ST('px082', '👾', "Herbata", 'common', 'assets/stickers/px/082.webp', 'food'), ST('px084', '👾', "Kot w cylindrze", 'mythic', 'assets/stickers/px/084.webp', 'cats'), ST('px085', '👾', "Miś", 'epic', 'assets/stickers/px/085.webp', 'animals'), ST('px086', '👾', "Lisek", 'common', 'assets/stickers/px/086.webp', 'animals'), ST('px087', '👾', "Niebieski kot", 'rare', 'assets/stickers/px/087.webp', 'cats'), ST('px088', '👾', "Chomik", 'epic', 'assets/stickers/px/088.webp', 'animals'), ST('px089', '👾', "Iskra", 'epic', 'assets/stickers/px/089.webp', 'magic'), ST('px090', '👾', "Sushi", 'epic', 'assets/stickers/px/090.webp', 'food'), ST('px091', '👾', "Delfin", 'rare', 'assets/stickers/px/091.webp', 'animals'), ST('px092', '👾', "Złoty puchar", 'epic', 'assets/stickers/px/092.webp', 'magic'), ST('px093', '👾', "Brązowy kot", 'common', 'assets/stickers/px/093.webp', 'cats'), ST('px094', '👾', "Ananas w koronie", 'mythic', 'assets/stickers/px/094.webp', 'food'), ST('px096', '👾', "Rudy kot", 'common', 'assets/stickers/px/096.webp', 'cats'), ST('px097', '👾', "Złota rybka", 'common', 'assets/stickers/px/097.webp', 'animals'), ST('px098', '👾', "Kubek RIP", 'legendary', 'assets/stickers/px/098.webp', 'food'), ST('px099', '👾', "Szary kot", 'rare', 'assets/stickers/px/099.webp', 'cats'), ST('px100', '👾', "Pochodnia", 'common', 'assets/stickers/px/100.webp', 'magic'), ST('px104', '👾', "RIP", 'mythic', 'assets/stickers/px/104.webp', 'magic'), ST('px105', '👾', "Malina", 'common', 'assets/stickers/px/105.webp', 'food'), ST('px106', '👾', "404 Day", 'mythic', 'assets/stickers/px/106.webp', 'magic'), ST('px107', '👾', "Pad", 'epic', 'assets/stickers/px/107.webp', 'magic'), ST('px109', '👾', "Onigiri", 'common', 'assets/stickers/px/109.webp', 'food'), ST('px110', '👾', "Żaba DJ", 'mythic', 'assets/stickers/px/110.webp', 'animals'), ST('px111', '👾', "Żaba klasyk", 'epic', 'assets/stickers/px/111.webp', 'animals'), ST('px112', '👾', "Pikselowe serce", 'rare', 'assets/stickers/px/112.webp', 'magic'), ST('px113', '👾', "Szop w okularach", 'legendary', 'assets/stickers/px/113.webp', 'animals'), ST('px114', '👾', "Game Boy", 'legendary', 'assets/stickers/px/114.webp', 'magic'), ST('px115', '👾', "Awokado ninja", 'rare', 'assets/stickers/px/115.webp', 'food'), ST('px116', '👾', "Koi", 'rare', 'assets/stickers/px/116.webp', 'animals'), ST('px117', '👾', "Kot w berecie", 'rare', 'assets/stickers/px/117.webp', 'cats'), ST('px118', '👾', "Latte", 'common', 'assets/stickers/px/118.webp', 'food'), ST('px119', '👾', "Energetyk", 'epic', 'assets/stickers/px/119.webp', 'food'), ST('px120', '👾', "Puszka", 'rare', 'assets/stickers/px/120.webp', 'food'), ST('px121', '👾', "Nemo", 'rare', 'assets/stickers/px/121.webp', 'animals'), ST('px122', '👾', "Telewizor", 'rare', 'assets/stickers/px/122.webp', 'magic'), ST('px123', '👾', "Ser", 'common', 'assets/stickers/px/123.webp', 'food'), ST('px124', '👾', "Energetyk M", 'mythic', 'assets/stickers/px/124.webp', 'food'), ST('px125', '👾', "Kanapka klubowa", 'common', 'assets/stickers/px/125.webp', 'food'), ST('px128', '👾', "Liść", 'common', 'assets/stickers/px/128.webp', 'food'), ST('px129', '👾', "Kot w kapturze", 'rare', 'assets/stickers/px/129.webp', 'cats'), ST('px131', '👾', "Ćma", 'common', 'assets/stickers/px/131.webp', 'animals'), ST('px132', '👾', "Żaba", 'rare', 'assets/stickers/px/132.webp', 'animals'), ST('px133', '👾', "Serce EKG", 'epic', 'assets/stickers/px/133.webp', 'magic'), ST('px134', '👾', "Pręgus", 'rare', 'assets/stickers/px/134.webp', 'cats'), ST('px135', '👾', "Jeleń", 'common', 'assets/stickers/px/135.webp', 'animals'), ST('px136', '👾', "Pióro feniksa", 'common', 'assets/stickers/px/136.webp', 'magic'), ST('px137', '👾', "Gwiazdka", 'common', 'assets/stickers/px/137.webp', 'magic'), ST('px138', '👾', "Pingwin zimowy", 'common', 'assets/stickers/px/138.webp', 'animals'), ST('px139', '👾', "Płatek śniegu", 'rare', 'assets/stickers/px/139.webp', 'magic'), ST('px140', '👾', "Papryka", 'common', 'assets/stickers/px/140.webp', 'food'), ST('px141', '👾', "Kula", 'common', 'assets/stickers/px/141.webp', 'magic'), ST('px142', '👾', "Winogrona", 'common', 'assets/stickers/px/142.webp', 'food'), ST('px143', '👾', "Lampa dżina", 'legendary', 'assets/stickers/px/143.webp', 'magic'), ST('px144', '👾', "Pełna bateria", 'epic', 'assets/stickers/px/144.webp', 'magic'), ST('px145', '👾', "Ognik", 'common', 'assets/stickers/px/145.webp', 'magic'), ST('px146', '👾', "Kot w koszyku", 'epic', 'assets/stickers/px/146.webp', 'cats'), ST('px147', '👾', "Burger", 'rare', 'assets/stickers/px/147.webp', 'food'), ST('px149', '👾', "Ciastko", 'epic', 'assets/stickers/px/149.webp', 'food'), ST('px150', '👾', "Słaba bateria", 'common', 'assets/stickers/px/150.webp', 'magic'), ST('px151', '👾', "Napój", 'rare', 'assets/stickers/px/151.webp', 'food'), ST('px152', '👾', "Delfinek", 'epic', 'assets/stickers/px/152.webp', 'animals'), ST('px153', '👾', "Pingwin szef", 'epic', 'assets/stickers/px/153.webp', 'animals'), ST('px154', '👾', "Aparat", 'common', 'assets/stickers/px/154.webp', 'magic'), ST('px155', '👾', "Mapa skarbów", 'common', 'assets/stickers/px/155.webp', 'magic'), ST('px156', '👾', "Szop bandyta", 'epic', 'assets/stickers/px/156.webp', 'animals'), ST('px158', '👾', "Serduszka", 'epic', 'assets/stickers/px/158.webp', 'food'), ST('px159', '👾', "Rybka", 'common', 'assets/stickers/px/159.webp', 'animals'), ST('px160', '👾', "Kapelusz", 'common', 'assets/stickers/px/160.webp', 'magic'), ST('px161', '👾', "Kawałek pizzy", 'common', 'assets/stickers/px/161.webp', 'food'), ST('px162', '👾', "Duszek wodny", 'epic', 'assets/stickers/px/162.webp', 'animals'), ST('px165', '👾', "Wybuch", 'rare', 'assets/stickers/px/165.webp', 'magic'), ST('px166', '👾', "Galaretka", 'common', 'assets/stickers/px/166.webp', 'food'), ST('px167', '👾', "Lis drzemie", 'rare', 'assets/stickers/px/167.webp', 'animals'), ST('px168', '👾', "Piłka", 'rare', 'assets/stickers/px/168.webp', 'magic'), ST('px169', '👾', "Precel", 'common', 'assets/stickers/px/169.webp', 'food'), ST('px170', '👾', "Ramen", 'common', 'assets/stickers/px/170.webp', 'food'), ST('px172', '👾', "Krab", 'common', 'assets/stickers/px/172.webp', 'animals'), ST('px173', '👾', "Elf", 'rare', 'assets/stickers/px/173.webp', 'animals'), ST('px174', '👾', "Bambus", 'common', 'assets/stickers/px/174.webp', 'magic'), ST('px176', '👾', "Słońce", 'common', 'assets/stickers/px/176.webp', 'magic'), ST('px177', '👾', "Wróżka", 'legendary', 'assets/stickers/px/177.webp', 'animals'), ST('px178', '👾', "Klepsydra", 'legendary', 'assets/stickers/px/178.webp', 'magic'), ST('px179', '👾', "Zombie", 'rare', 'assets/stickers/px/179.webp', 'animals'), ST('px180', '👾', "Ogórek", 'rare', 'assets/stickers/px/180.webp', 'food'), ST('px181', '👾', "Ciastko z czekoladą", 'rare', 'assets/stickers/px/181.webp', 'food'), ST('px182', '👾', "Granat", 'common', 'assets/stickers/px/182.webp', 'food'), ST('px183', '👾', "Kot z sercem", 'rare', 'assets/stickers/px/183.webp', 'cats'), ST('px184', '👾', "Słońce w okularach", 'rare', 'assets/stickers/px/184.webp', 'magic'), ST('px185', '👾', "Rybka w słoiku", 'rare', 'assets/stickers/px/185.webp', 'animals'), ST('px186', '👾', "Pączek", 'common', 'assets/stickers/px/186.webp', 'food'), ST('px187', '👾', "Zielony kot", 'rare', 'assets/stickers/px/187.webp', 'cats'), ST('px188', '👾', "Frytki", 'rare', 'assets/stickers/px/188.webp', 'food'), ST('px189', '👾', "Bilet", 'epic', 'assets/stickers/px/189.webp', 'magic'), ST('px190', '👾', "Ośmiornica", 'common', 'assets/stickers/px/190.webp', 'animals'), ST('px191', '👾', "Retro komputer", 'legendary', 'assets/stickers/px/191.webp', 'magic'), ST('px192', '👾', "Kot skrzydlaty", 'epic', 'assets/stickers/px/192.webp', 'cats'), ST('px193', '👾', "Fioletowe serce", 'rare', 'assets/stickers/px/193.webp', 'magic'), ST('px194', '👾', "Butelka", 'common', 'assets/stickers/px/194.webp', 'food'), ST('px195', '👾', "Piesek", 'common', 'assets/stickers/px/195.webp', 'animals'), ST('px196', '👾', "Ciasto", 'epic', 'assets/stickers/px/196.webp', 'food'), ST('px197', '👾', "Różowy mózg", 'common', 'assets/stickers/px/197.webp', 'magic'), ST('px198', '👾', "Kapelusz z piórem", 'rare', 'assets/stickers/px/198.webp', 'magic'), ST('px199', '👾', "Kubek z czaszką", 'epic', 'assets/stickers/px/199.webp', 'food'), ST('px200', '👾', "Wesołe słońce", 'common', 'assets/stickers/px/200.webp', 'magic'), ST('px202', '👾', "Niebieskie serce", 'rare', 'assets/stickers/px/202.webp', 'magic'), ST('px203', '👾', "Pół awokado", 'rare', 'assets/stickers/px/203.webp', 'food'), ST('px204', '👾', "Góry", 'common', 'assets/stickers/px/204.webp', 'magic'), ST('px207', '👾', "Kalendarz", 'common', 'assets/stickers/px/207.webp', 'magic'), ST('px208', '👾', "Złota gwiazdka", 'rare', 'assets/stickers/px/208.webp', 'magic'), ST('px211', '👾', "Kawa czarna", 'rare', 'assets/stickers/px/211.webp', 'food'), ST('px213', '👾', "Bułka", 'rare', 'assets/stickers/px/213.webp', 'food'), ST('px214', '👾', "Kot krowa", 'epic', 'assets/stickers/px/214.webp', 'cats'), ST('px215', '👾', "Księga zaklęć", 'epic', 'assets/stickers/px/215.webp', 'magic'), ST('px216', '👾', "Mikrofon", 'common', 'assets/stickers/px/216.webp', 'magic'), ST('px217', '👾', "Stek", 'common', 'assets/stickers/px/217.webp', 'food'), ST('px218', '👾', "Arbuz", 'common', 'assets/stickers/px/218.webp', 'food'), ST('px219', '👾', "Duszek", 'legendary', 'assets/stickers/px/219.webp', 'animals'), ST('px220', '👾', "Roślinka", 'epic', 'assets/stickers/px/220.webp', 'magic'), ST('px221', '👾', "Pingwin z szalikiem", 'common', 'assets/stickers/px/221.webp', 'animals'), ST('px222', '👾', "Meduza", 'legendary', 'assets/stickers/px/222.webp', 'animals'), ST('px223', '👾', "Woda", 'common', 'assets/stickers/px/223.webp', 'food'), ST('px225', '👾', "Kot błękitny", 'rare', 'assets/stickers/px/225.webp', 'cats'), ST('px226', '👾', "Kot sierściuch", 'epic', 'assets/stickers/px/226.webp', 'cats'), ST('px229', '👾', "Kropla", 'epic', 'assets/stickers/px/229.webp', 'magic'),
  ST('soldiercat', '🪖', 'Kot żołnierz', 'mythic', 'assets/stickers/kot-zolnierz-cut.webp'),
  // 🥚 tylko z inkubatora (egg.js) – nie wypadają ze skrzynek
  ...[ST('chick', '🐣', "Pisklak", 'common', 'assets/stickers/px/069.webp'), ST('hatchling', '🐥', "Pingwinek", 'common', 'assets/stickers/px/022.webp'), ST('penguin', '🐧', "Pingwin", 'rare', 'assets/stickers/px/127.webp'), ST('parrot', '🦜', "Papuga", 'rare', 'assets/stickers/px/212.webp'),
    ST('dino', '🦕', "Kameleon", 'epic', 'assets/stickers/px/081.webp'), ST('trex', '🦖', "Rekin", 'epic', 'assets/stickers/px/175.webp'), ST('dragonling', '🐲', "Smoczy liść", 'legendary', 'assets/stickers/px/015.webp'), ST('swan', '🦢', "Kaczka", 'legendary', 'assets/stickers/px/126.webp')].map(s => ({ ...s, hatch: true })),
];
// 🔴 ultra rzadkie dropy w każdej skrzynce: mityczna naklejka i mega pula kryształów (po 0,1%)
// 💎 w skrzynkach jako kryształ 8-bit
const GEM8 = 'assets/stickers/px/044.webp';
const MYTHIC_P = .1, MEGA_GEMS_P = .1, MEGA_GEMS = 10000;
// mityczna naklejka nie wypada ze skrzynki z GIF-ami (tam tylko mega kryształy)
const mythicP = k => CASES[k]?.gif ? 0 : MYTHIC_P;
const FREE_STICKERS = ['wave', 'thumb', 'phew'];
const stickerById = id => STICKERS.find(s => s.id === id);
// cele osiągnięć kolekcjonerskich = aktualna liczba naklejek
if (typeof ACHIEVEMENTS !== 'undefined') for (const [id, n] of [['album_full', STICKERS.filter(x => x.id !== 'soldiercat' && !x.hatch).length], ['legends_all', STICKERS.filter(x => x.r === 'legendary' && !x.hatch).length], ['hatch_all', STICKERS.filter(x => x.hatch).length]]) { const a = ACHIEVEMENTS.find(x => x.id === id); if (a) a.goal = n; }
const CASES = {
  basic: { name: 'Skrzynka nauki', icon: '📦', price: 120, odds: { common: 42, rare: 34, epic: 16, legendary: 6.5, mythic: 1.5 } },
  epic: { name: 'Skrzynka mistrza', icon: '🎁', price: 350, odds: { common: 15, rare: 35, epic: 30, legendary: 15, mythic: 5 } },
  daily: { name: 'Codzienna skrzynka', icon: '🌞', price: 0, odds: { common: 28, rare: 36, epic: 22, legendary: 11, mythic: 3 }, freeOnly: true },
  // 🎯 skrzynki tematyczne: tylko naklejki z jednego działu kolekcji
  cats: { name: 'Kocia skrzynka', icon: '🐱', price: 200, theme: 'cats', odds: { common: 30, rare: 36, epic: 20, legendary: 11, mythic: 3 } },
  animals: { name: 'Zwierzyniec', icon: '🐸', price: 200, theme: 'animals', odds: { common: 30, rare: 36, epic: 20, legendary: 11, mythic: 3 } },
  food: { name: 'Przekąski', icon: '🍕', price: 200, theme: 'food', odds: { common: 30, rare: 36, epic: 20, legendary: 11, mythic: 3 } },
  magic: { name: 'Skarby i memy', icon: '🔮', price: 250, theme: 'magic', odds: { common: 24, rare: 34, epic: 24, legendary: 13, mythic: 5 } },
  // GIF-y wgrywa host w panelu; skrzynka pokazuje się, gdy jest choć jeden
  gif: { name: 'Skrzynka z GIF-ami', icon: '🎞️', price: 250, odds: { common: 55, rare: 30, epic: 12, legendary: 3 }, gif: true },
};
// Komplet naklejek danej rzadkości = jednorazowa premia
const SET_BONUS = { common: 200, rare: 400, epic: 800, legendary: 2000, mythic: 5000 };
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
  for (const k of ['mythic', 'legendary', 'epic', 'rare', 'common']) { if (r < (odds[k] || 0)) return k; r -= odds[k] || 0; }
  return 'common';
}
// pula skrzynki: bez naklejek z inkubatora i bez ultra-rzadkiego Kota żołnierza; skrzynka tematyczna – tylko swój dział
const stPool = theme => STICKERS.filter(s => !s.hatch && s.id !== 'soldiercat' && (!theme || s.t === theme));
const rollSticker = (odds, theme) => { const all = stPool(theme), r = rollRarity(odds), pool = all.filter(s => s.r === r); const src = pool.length ? pool : all; return src[Math.random() * src.length | 0]; };
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
  if (force === 'mythic') return stickerById('soldiercat');
  if (force === 'mega') return { kind: 'gems', img: GEM8, id: 'gems' + MEGA_GEMS, n: MEGA_GEMS, e: '💎', name: `+${MEGA_GEMS} 💎`, r: 'mythic' };
  if (!force) { const y = Math.random() * 100, mp = mythicP(k); if (y < mp) return rollPrize(k, odds, 'mythic'); if (y < mp + MEGA_GEMS_P) return rollPrize(k, odds, 'mega'); }
  const x = Math.random() * 100;
  if (force === 'lgif') return legendGifReady() ? rollGif({ legendary: 100 }, 'legendary') : rollSticker({ legendary: 100 });
  if (force === 'gems' || force === 'jackpot' || (!force && x < CASE_EXTRA.gems)) {
    const t = GEM_PRIZES[k] || GEM_PRIZES.basic; let y = force === 'jackpot' ? 100 : Math.random() * 100;
    for (let i = 0; i < t.length; i++) { const [n, p] = t[i]; if (y < p || i === t.length - 1) return { kind: 'gems', img: GEM8, id: 'gems' + n, n, e: '💎', name: `+${n} 💎`, r: ['common', 'rare', 'epic', 'legendary'][i] }; y -= p; }
  }
  if (force === 'respin' || (!force && x < CASE_EXTRA.gems + CASE_EXTRA.respin)) return { kind: 'respin', id: 'respin', e: '🔁', name: 'Jeszcze raz!', r: 'epic' };
  if (CASES[k]?.gif && gifCaseReady()) return rollGif(odds, force);
  if (!force && CASE_GIF[k] && legendGifReady() && Math.random() * 100 < CASE_GIF[k]) return rollGif({ legendary: 100 }, 'legendary');
  return rollSticker(force && RARITY[force] ? { [force]: 100 } : odds, CASES[k]?.theme);
}
// ---------- zawartość skrzynki: dokładne szanse (te same reguły co rollPrize)
function caseDrops(k) {
  const c = CASES[k], f = (100 - mythicP(k) - MEGA_GEMS_P) / 100, out = [];
  const add = (p, x, group) => out.push({ p, x, group });
  if (mythicP(k)) add(mythicP(k), stickerById('soldiercat'), 'ultra');
  add(MEGA_GEMS_P, { kind: 'gems', img: GEM8, e: '💎', name: `${MEGA_GEMS} kryształów`, r: 'mythic' }, 'ultra');
  const t = GEM_PRIZES[k] || GEM_PRIZES.basic;
  t.forEach(([n, p], i) => add(f * CASE_EXTRA.gems * p / 100, { kind: 'gems', img: GEM8, e: '💎', name: `${n} kryształów`, r: ['common', 'rare', 'epic', 'legendary'][i] }, 'gems'));
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
  perRarity(c.odds, stPool(c.theme), 'st', s => s);
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
  ${freeN ? `<div class="banner row nowrap"><span class="grow">🎁 Masz <b>${freeN}</b> darmowe ${plural(freeN, 'skrzynkę', 'skrzynki', 'skrzynek')}: ${freeKinds.map(k => `${crateImg(k, 'inline')} ${CASES[k].name} ×${itemCount('case', k)}`).join(', ')}</span>
    <button class="primary sm" data-go="#/case/${freeKinds[0]}?free=1">Otwórz</button></div>` : ''}
  <div class="card"><h2 style="margin-top:0">Skrzynki z naklejkami</h2><div class="cases">${Object.entries(CASES).filter(([, c]) => !c.freeOnly && (!c.gif || gifCaseReady())).map(([k, c]) => `
    <div class="case ${k}"><div class="ci" data-act="case-drops" data-k="${k}" role="button" title="Zawartość i szanse">${caseIco(k)}</div><b data-act="case-drops" data-k="${k}">${c.name}</b>
      <div class="odds">${Object.entries(c.odds).map(([r, p]) => `<span style="color:${RARITY[r].color}">● ${RARITY[r].name} ${p}%</span>`).join('')}${CASE_GIF[k] && legendGifReady() ? `<span style="color:${RARITY.legendary.color}">🎞️ GIF legendarny ${CASE_GIF[k]}%</span>` : ''}<span style="color:#0369a1"><img class="gem8" src="${GEM8}" alt="💎"> do ${(GEM_PRIZES[k] || GEM_PRIZES.basic).at(-1)[0]} · 🔁 jeszcze raz</span>${mythicP(k) ? `<span style="color:${RARITY.mythic.color};font-weight:700">🪖 Kot żołnierz ${pctFmt(MYTHIC_P)}</span>` : ''}<span style="color:${RARITY.mythic.color};font-weight:700">🔴 ${MEGA_GEMS} 💎 ${pctFmt(MEGA_GEMS_P)}</span></div>
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
    else if (won.r === 'mythic') { celebrate(won.kind === 'gems' ? `💎 +${won.n} – MEGA JACKPOT!` : `🔴 MITYCZNA: ${won.name}!`, won.kind === 'gems' || won.id === 'soldiercat' ? 'Szansa 0,1% – trafia się raz na 1000 skrzynek!' : 'Najrzadsza rzadkość w kolekcji!'); confetti(300); setTimeout(() => confetti(300), 900); }
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
      ${cases.length ? cases.map(k => `<div class="row nowrap inv-case"><span class="inv-crate">${crateImg(k)}</span><b class="grow">${CASES[k].name} ×${itemCount('case', k)}</b><button class="primary sm" data-go="#/case/${k}?free=1">Otwórz</button></div>`).join('')
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

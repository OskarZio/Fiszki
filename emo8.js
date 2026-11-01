'use strict';
/* 👾 Własne grafiki zamiast emotek systemowych: każdy tekst w aplikacji jest przeglądany i znane emotki zamieniają się
   na pikselowe obrazki (assets/px8, assets/gear8, assets/abil). Do tego tokeny ⟦a:postać:nr⟧ – ikony mocy bohaterów
   (umiejętność bierna, supercios, gałęzie drzewka) z arkusza assets/abil/{postać}{nr}.webp. Pola formularzy i opcje list zostają tekstem. */
const EMO8 = {
  '💚': 'dis8/heal', '❄️': 'dis8/ice', '❄': 'dis8/ice', '☠️': 'dis8/poison', '☠': 'dis8/poison', '🔇': 'dis8/silence', '🌫️': 'dis8/fog', '🌫': 'dis8/fog', '🪞': 'dis8/mirror', '🌀': 'dis8/whirl', '🌑': 'dis8/eclipse', '🙃': 'dis8/flip', '🌋': 'dis8/shake', '🔍': 'dis8/tiny', '🦑': 'dis8/ink', '🙈': 'dis8/blind', '🔦': 'dis8/spot', '🥀': 'dis8/weak', '🩸': 'dis8/drain',
  '👤': 'ui8b/p_profile', '📋': 'ui8b/p_quests', '🗃️': 'ui8b/p_coll', '🗃': 'ui8b/p_coll', '🥉': 'cups/bronze', '🥈': 'cups/silver', '🏆': 'cups/diamond', '📁': 'cups/c_book',
  '🔁': 'ui8b/sync', '💡': 'ui8b/bulb', '➕': 'ui8b/plus', '💀': 'ui8b/skull', '🎤': 'ui8b/mic', '📖': 'ui8b/book', '🖼️': 'ui8b/picture', '🖼': 'ui8b/picture', '🗼': 'ui8b/tower', '💬': 'ui8b/chat', '🎨': 'ui8b/palette', '▶️': 'ui8b/play', '▶': 'ui8b/play', '🏫': 'ui8b/school', '✍️': 'ui8b/write', '✍': 'ui8b/write', '🔄': 'ui8b/refresh',
  '🔀': 'dis8/scramble', '⏪': 'dis8/reverse', '💣': 'dis8/bomb',
  '🧛': 'ui8b/vamp', '💨': 'ui8b/dodge',
  '🔤': 'ui8b/m_abcd', '⌨️': 'ui8b/m_type', '⌨': 'ui8b/m_type', '🏅': 'ui8b/p_ach', '🎒': 'ui8b/p_coll',
  '🪙': 'ui8b/gold',
  '👾': 'e8/invader', '✅': 'e8/check', '💪': 'e8/muscle', '📤': 'e8/outbox', '🤖': 'e8/robot', '🎞️': 'e8/film', '🎞': 'e8/film', '📥': 'e8/inbox', '🏷️': 'e8/tag', '🏷': 'e8/tag', '🔑': 'e8/key', '☁️': 'e8/cloud', '☁': 'e8/cloud', '❌': 'e8/cross', '⚠️': 'e8/warn', '⚠': 'e8/warn', '📦': 'e8/box', '🥇': 'e8/medal', '👋': 'e8/wave',
  '💾': 'e8/floppy', '🏛️': 'e8/museum', '🏛': 'e8/museum', '📍': 'e8/pin', '🤝': 'e8/handshake', '🐾': 'e8/paw2', '🫀': 'e8/heartorg', '🔗': 'e8/link', '↔️': 'e8/lr', '↔': 'e8/lr', '🎮': 'e8/gamepad', '📊': 'e8/bars', '📲': 'e8/phone', '⚙️': 'e8/gear', '⚙': 'e8/gear', '🔔': 'e8/bell', '🥊': 'e8/glove', '👀': 'e8/eyes', '↩️': 'e8/back', '↩': 'e8/back',
  '🔴': 'e8/redball', '🎰': 'e8/slot', '💰': 'e8/moneybag', '🦉': 'e8/owl', '🚫': 'e8/noentry', '🚶': 'e8/walk', '🧘': 'e8/meditate', '💠': 'e8/diamond', '🅰️': 'e8/letterA', '🅰': 'e8/letterA', '❓': 'e8/question', '🗡️': 'e8/dagger', '🗡': 'e8/dagger', '⬇️': 'e8/down', '⬇': 'e8/down', '📉': 'e8/chartdown', '🔊': 'e8/speaker', '👍': 'e8/thumbup',
  '🗺️': 'e8/map', '🗺': 'e8/map', '⚖️': 'e8/scale', '⚖': 'e8/scale', '🧩': 'e8/puzzle', '🚀': 'e8/rocket', '🌟': 'e8/sparkstar', '📄': 'e8/doc', '🛠️': 'e8/tools', '🛠': 'e8/tools', '🛒': 'e8/cart', '⬆️': 'e8/up', '⬆': 'e8/up', '🗂️': 'e8/folder', '🗂': 'e8/folder', '📱': 'e8/mobile', '🌿': 'e8/leaf', '🎀': 'e8/bow', '📵': 'e8/nophone', '🌱': 'e8/sprout', '⏸️': 'e8/pause', '⏸': 'e8/pause',
  '🧮': 'e8/abacus', '🌞': 'e8/sun', '🧙': 'e8/wizhat', '💻': 'e8/laptop', '🐸': 'e8/frog', '🎬': 'e8/clapper', '👁️': 'e8/eye', '👁': 'e8/eye', '⏰': 'e8/alarm', '❔': 'e8/qmark2', '🔎': 'e8/magnify', '📌': 'e8/pushpin', '🍎': 'e8/apple', '📣': 'e8/megaphone', '🔢': 'e8/numpad', '🐱': 'e8/catface', '🐐': 'e8/goat',
  '🎵': 'e8/note', '🧹': 'e8/broom', '🧑': 'e8/person', '🖤': 'e8/blackheart', '💔': 'e8/broken', '🔡': 'e8/keyA', '🌵': 'e8/cactus', '🚪': 'e8/door', '🩺': 'e8/medkit', '🎆': 'e8/fireworks', '🟢': 'e8/greenorb', '🔬': 'e8/microscope', '🌐': 'e8/globestand', '🐶': 'e8/dogface', '🔓': 'e8/unlock',
  '🕊️': 'e8/dove', '🕊': 'e8/dove', '👆': 'e8/point', '🕵️': 'e8/spy', '🕵': 'e8/spy', '🧊': 'e8/icecube', '🔌': 'e8/plug', '🖋️': 'e8/pen', '🖋': 'e8/pen', '🌸': 'e8/blossom', '🏳️': 'e8/flag', '🏳': 'e8/flag', '⏩': 'e8/ff', '☀️': 'e8/sun2', '☀': 'e8/sun2', '🌲': 'e8/pine', '🏰': 'e8/castle', '🕹️': 'e8/joystick', '🕹': 'e8/joystick', '🌌': 'e8/galaxy',
  '🏃': 'e8/run', '🏃️': 'e8/run', '🐔': 'e8/chicken', '🐔️': 'e8/chicken', '⚽': 'e8/soccer', '⚽️': 'e8/soccer', '🗣': 'e8/speak', '🗣️': 'e8/speak', '🦴️': 'e8/bone', '🦴': 'e8/bone', '🌙️': 'e8/moon', '🌙': 'e8/moon', '🐰': 'e8/bunny', '🐰️': 'e8/bunny', '🎊': 'e8/popper', '🎊️': 'e8/popper', '🐧': 'e8/penguin', '🐧️': 'e8/penguin', '🐢': 'e8/turtle', '🐢️': 'e8/turtle', '🤓️': 'e8/nerd', '🤓': 'e8/nerd', '🧭️': 'e8/compass', '🧭': 'e8/compass', '📐️': 'e8/ruler', '📐': 'e8/ruler', '🤷': 'e8/shrug', '🤷️': 'e8/shrug', '🆓': 'e8/free', '🆓️': 'e8/free', '🧸️': 'e8/teddy', '🧸': 'e8/teddy',
  '↗': 'e8/nearr', '↗️': 'e8/nearr', '🔰': 'e8/beginner', '🔰️': 'e8/beginner', '🦸': 'e8/hero', '🦸️': 'e8/hero', '🧨️': 'e8/dynamite', '🧨': 'e8/dynamite', '🧽️': 'e8/sponge', '🧽': 'e8/sponge', '☑️': 'e8/checkbox', '☑': 'e8/checkbox', '✋️': 'e8/hand', '✋': 'e8/hand', '📂️': 'e8/folderopen', '📂': 'e8/folderopen', '🤫️': 'e8/shush', '🤫': 'e8/shush', '✔': 'e8/checkmark', '✔️': 'e8/checkmark', '💧': 'e8/drop', '💧️': 'e8/drop', '🖐️': 'e8/handsplay', '🖐': 'e8/handsplay', '📆': 'e8/calendar2', '📆️': 'e8/calendar2', '🆘': 'e8/sos', '🆘️': 'e8/sos', '🐍️': 'e8/snake', '🐍': 'e8/snake', '😱': 'e8/scream', '😱️': 'e8/scream',
  '🟡': 'e8/coin', '✒️': 'e8/pen', '✒': 'e8/pen', '💫': 'e8/glowstar',
  '🫡️': 'e8/salute', '🫡': 'e8/salute', '🗳': 'e8/ballot', '🗳️': 'e8/ballot', '🍒️': 'e8/cherry', '🍒': 'e8/cherry', '💕️': 'e8/hearts2', '💕': 'e8/hearts2', '🫧': 'e8/bubbles', '🫧️': 'e8/bubbles', '🙌': 'e8/raisehands', '🙌️': 'e8/raisehands', '👉️': 'e8/pointr', '👉': 'e8/pointr', '😶️': 'e8/nomouth', '😶': 'e8/nomouth', '🎖': 'e8/milmedal', '🎖️': 'e8/milmedal', '🗄️': 'e8/cabinet', '🗄': 'e8/cabinet', '🏔️': 'e8/mountain', '🏔': 'e8/mountain', '🌅️': 'e8/sunrise', '🌅': 'e8/sunrise', '🔟': 'e8/ten', '🔟️': 'e8/ten', '🌪️': 'e8/tornado', '🌪': 'e8/tornado', '💛️': 'e8/yellowheart', '💛': 'e8/yellowheart', '🤑': 'e8/moneyface', '🤑️': 'e8/moneyface',
  '🍄': 'e8/mushroom', '⛺': 'e8/tent', '⛺️': 'e8/tent', '🏕️': 'e8/campfire', '🏕': 'e8/campfire', '🛹': 'e8/skateboard',
  '♂': 'e8/male', '♂️': 'e8/male', '🆕': 'e8/new', '🆕️': 'e8/new', '😼': 'e8/catjoy', '😼️': 'e8/catjoy', '👅': 'e8/tongue', '👅️': 'e8/tongue', '🌊': 'e8/wave2', '🌊️': 'e8/wave2', '🪷': 'e8/lotus', '🪷️': 'e8/lotus', '🎾': 'e8/tennis', '🎾️': 'e8/tennis', '🌰': 'e8/chestnut', '🌰️': 'e8/chestnut', '🎡️': 'e8/ferris', '🎡': 'e8/ferris', '🌻️': 'e8/sunflower', '🌻': 'e8/sunflower', '💢️': 'e8/anger', '💢': 'e8/anger', '🪨': 'e8/rock', '🪨️': 'e8/rock', '🎟️': 'e8/ticket', '🎟': 'e8/ticket', '⛑': 'e8/helmet', '⛑️': 'e8/helmet', '🐹': 'e8/hamster', '🐹️': 'e8/hamster', '🚨': 'e8/siren', '🚨️': 'e8/siren',
  '🔵️': 'e8/blueball', '🔵': 'e8/blueball', '🟣️': 'e8/purpleball', '🟣': 'e8/purpleball', '🩷️': 'e8/pinkheart', '🩷': 'e8/pinkheart', '🐼️': 'e8/panda', '🐼': 'e8/panda', '🦁': 'e8/lion', '🦁️': 'e8/lion', '🐯️': 'e8/tiger', '🐯': 'e8/tiger', '🐵️': 'e8/monkey', '🐵': 'e8/monkey', '🐨': 'e8/koala', '🐨️': 'e8/koala', '🐙': 'e8/octopus', '🐙️': 'e8/octopus', '👻️': 'e8/ghost', '👻': 'e8/ghost', 'ℹ️': 'e8/info', 'ℹ': 'e8/info', '🪄': 'e8/wand', '🪄️': 'e8/wand', '🏁': 'e8/checkered', '🏁️': 'e8/checkered', '🧾': 'e8/receipt', '🧾️': 'e8/receipt', '🪜️': 'e8/ladder', '🪜': 'e8/ladder', '👌': 'e8/okhand', '👌️': 'e8/okhand', '🐈': 'e8/cat2', '🐈️': 'e8/cat2', '⬛️': 'e8/blacksq', '⬛': 'e8/blacksq', '💳': 'e8/card', '💳️': 'e8/card', '😤️': 'e8/huff', '😤': 'e8/huff', '🍀': 'e8/clover', '🍀️': 'e8/clover', '🥷️': 'e8/ninja', '🥷': 'e8/ninja', '🔱️': 'e8/trident', '🔱': 'e8/trident', '🪖️': 'e8/armyhelmet', '🪖': 'e8/armyhelmet', '🐺': 'e8/wolf', '🐺️': 'e8/wolf', '🐥️': 'e8/chick', '🐥': 'e8/chick', '🦜': 'e8/parrot', '🦜️': 'e8/parrot', '🦕': 'e8/sauropod', '🦕️': 'e8/sauropod', '🦖️': 'e8/trex', '🦖': 'e8/trex', '🦢': 'e8/swan', '🦢️': 'e8/swan', '💜': 'e8/purpleheart', '💜️': 'e8/purpleheart', '💙️': 'e8/blueheart', '💙': 'e8/blueheart', '🙏️': 'e8/pray', '🙏': 'e8/pray', '💊': 'e8/pill', '💊️': 'e8/pill', '🪓️': 'e8/axe', '🪓': 'e8/axe', '📘': 'e8/bookblue', '📘️': 'e8/bookblue',
  '📈': 'ui8/chart', '🌍': 'ui8/globe', '🌎': 'ui8/globe', '🌏': 'ui8/globe', '🧱': 'mat8/gray', '🐛': 'bugs8/caterpillar', '🐞': 'bugs8/ladybug', '🦋': 'bugs8/butterfly', '🐌': 'bugs8/snail', '🕷️': 'bugs8/spider', '🐝': 'bugs8/bee', '🦊': 'ui8/paw', '🎭': 'ui8/tab_postac', '🌳': 'ui8/tab_drzewko', '🎒': 'ui8/tab_plecak', '🔨': 'ui8/tab_kowal',
  '⚔️': 'px8/b_swords', '⚔': 'px8/b_swords', '🎯': 'px8/b_target', '🛡️': 'px8/b_shield', '🛡': 'px8/b_shield', '🔥': 'px8/b_fire', '⚡': 'px8/b_bolt',
  '👑': 'px8/b_crown2', '🧪': 'px8/b_potion', '⭐': 'px8/e_star', '✨': 'px8/b_sparkle', '💯': 'px8/e_hundred', '🔮': 'px8/b_orb', '📜': 'px8/b_scroll',
  '⏱️': 'px8/b_stopwatch', '⏱': 'px8/b_stopwatch', '⏳': 'px8/b_hourglass', '🎓': 'px8/b_gradcap', '🧲': 'px8/b_magnet', '🩹': 'px8/b_medkit',
  '🐉': 'px8/b_dragon', '🐲': 'px8/b_dragon', '☄️': 'px8/b_comet', '🪶': 'px8/b_feather', '🧬': 'px8/b_dna', '⚛️': 'px8/b_atom', '🧠': 'px8/b_brain',
  '💍': 'px8/b_ring', '🏹': 'px8/b_bow', '🪽': 'px8/b_wing', '💥': 'px8/e_nova', '🎉': 'px8/e_popper', '👏': 'px8/e_clap', '🌈': 'px8/e_rainbow',
  // emotki interfejsu (assets/ui8)
  '📚': 'ui8/r0_0', '🃏': 'ui8/r0_1', '🏠': 'ui8/r0_2', '👥': 'ui8/r0_3', '📅': 'ui8/r0_4', '🗓️': 'ui8/r0_4', '🗓': 'ui8/r0_4', '✏️': 'ui8/r0_5', '✏': 'ui8/r0_5', '📝': 'ui8/r0_5',
  '🗑️': 'ui8/r0_6', '🗑': 'ui8/r0_6', '📷': 'ui8/r0_7', '📸': 'ui8/r0_7', '🎁': 'ui8/r1_0', '🏆': 'ui8/r1_1', '🔒': 'ui8/r1_2', '🔐': 'ui8/r1_2', '🎲': 'ui8/r1_3', '🚩': 'ui8/r1_4',
  '😀': 'ui8/r2_0', '😃': 'ui8/r2_0', '😄': 'ui8/r2_0', '😊': 'ui8/r2_0', '🙂': 'ui8/r2_0', '😉': 'ui8/r2_1', '😍': 'ui8/r2_2', '🥰': 'ui8/r2_2', '😂': 'ui8/r2_3', '🤣': 'ui8/r2_3',
  '😎': 'ui8/r2_4', '😘': 'ui8/r2_5', '😮': 'ui8/r2_6', '😲': 'ui8/r2_6', '🤯': 'ui8/r2_6', '😡': 'ui8/r2_7', '😠': 'ui8/r2_7', '😭': 'ui8/r3_0', '😢': 'ui8/r3_0',
  '😴': 'ui8/r3_1', '💤': 'ui8/r3_1', '😁': 'ui8/r3_2', '😅': 'ui8/r3_2', '🤔': 'ui8/r3_3', '😕': 'ui8/r3_3', '😐': 'ui8/r3_4', '😑': 'ui8/r3_4', '🤩': 'ui8/r3_5', '😜': 'ui8/r3_6', '😛': 'ui8/r3_6', '😇': 'ui8/r3_7',
  '🥚': 'egg8/egg', '🪺': 'egg8/nest', '🐣': 'egg8/egg_green', '☕': 'stickers/px/002',
  '💖': 'px8/e_heartdark', '❤️': 'px8/e_heartbeat', '💗': 'px8/e_heartbeat', '🌠': 'px8/e_shootstar', '🦄': 'px8/e_unicorn', '⚗️': 'px8/b_flasks', '🧰': 'px8/b_chest',
};
const EMO8_RE = new RegExp(Object.keys(EMO8).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + '|⟦a:(\\w+):(\\d+)⟧', 'g');
const emo8Img = (src, alt) => `<img class="emo8" src="assets/${src}.webp" alt="${alt}" draggable="false">`;
function emo8Decorate(root = document.body) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => { EMO8_RE.lastIndex = 0; return EMO8_RE.test(n.nodeValue) && !n.parentElement?.closest('textarea, input, select, option, script, style, [contenteditable], svg, .no-emo8') ? 1 : 3; } });
  const hits = []; while (w.nextNode()) hits.push(w.currentNode);
  for (const t of hits) {
    const span = document.createElement('span');
    span.innerHTML = t.nodeValue.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]).replace(EMO8_RE, (m, l, i) => l ? `<img class="emo8 abil8" src="assets/abil/${l}${i}.webp" alt="" draggable="false">` : emo8Img(EMO8[m], m));
    t.replaceWith(...span.childNodes);
  }
}
let emo8Q = false;
new MutationObserver(() => { if (emo8Q) return; emo8Q = true; requestAnimationFrame(() => { emo8Q = false; emo8Decorate(); }); })
  .observe(document.body, { childList: true, subtree: true, characterData: true });
// ikony mocy bohaterów: [bierna, supercios, gałąź 1, 2, 3] – numery obrazków z arkusza danej postaci
const ABIL8 = { cat: [4, 6, 2, 3, 7], frog: [2, 5, 1, 8, 4], dog: [3, 5, 6, 1, 7], owl: [8, 6, 1, 4, 2], hamster: [6, 5, 3, 8, 4], fox: [1, 8, 2, 3, 5], beast: [1, 10, 9, 2, 4],
  rabbit: [1, 3, 5, 2, 7], phoenix: [2, 3, 7, 0, 6], dragon: [0, 1, 5, 3, 2] };
const abTok = (l, i) => `⟦a:${l}:${i}⟧`;
const stripEmo = s => String(s).replace(/^\S+\s/, '');
for (const [l, m] of Object.entries(ABIL8)) { const L = LINES[l]; if (!L) continue;
  L.passive[0] = `${abTok(l, m[0])} ${stripEmo(L.passive[0])}`; L.ult[0] = `${abTok(l, m[1])} ${stripEmo(L.ult[0])}`;
  L.tree.forEach((b, i) => { b[0] = `${abTok(l, m[2 + i])} ${stripEmo(b[0])}`; }); }
const charPortrait = l => `<img class="emo8 abil8" src="assets/abil/${l}0.webp" alt="" draggable="false">`;
emo8Decorate();

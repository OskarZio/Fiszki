'use strict';
/* 👾 Własne grafiki zamiast emotek systemowych: każdy tekst w aplikacji jest przeglądany i znane emotki zamieniają się
   na pikselowe obrazki (assets/px8, assets/gear8, assets/abil). Do tego tokeny ⟦a:postać:nr⟧ – ikony mocy bohaterów
   (umiejętność bierna, supercios, gałęzie drzewka) z arkusza assets/abil/{postać}{nr}.webp. Pola formularzy i opcje list zostają tekstem. */
const EMO8 = {
  '🎭': 'ui8/tab_postac', '🌳': 'ui8/tab_drzewko', '🎒': 'ui8/tab_plecak', '🔨': 'ui8/tab_kowal',
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
const ABIL8 = { cat: [4, 6, 2, 3, 7], frog: [2, 5, 1, 8, 4], dog: [3, 5, 6, 1, 7], owl: [8, 6, 1, 4, 2], hamster: [6, 5, 3, 8, 4], fox: [1, 8, 2, 3, 5], beast: [1, 10, 9, 2, 4] };
const abTok = (l, i) => `⟦a:${l}:${i}⟧`;
const stripEmo = s => String(s).replace(/^\S+\s/, '');
for (const [l, m] of Object.entries(ABIL8)) { const L = LINES[l]; if (!L) continue;
  L.passive[0] = `${abTok(l, m[0])} ${stripEmo(L.passive[0])}`; L.ult[0] = `${abTok(l, m[1])} ${stripEmo(L.ult[0])}`;
  L.tree.forEach((b, i) => { b[0] = `${abTok(l, m[2 + i])} ${stripEmo(b[0])}`; }); }
const charPortrait = l => `<img class="emo8 abil8" src="assets/abil/${l}0.webp" alt="" draggable="false">`;
emo8Decorate();

'use strict';
/* 🐣 Stworki: unikatowe stworzenia rysowane z „ziarna” (seed) – każdy jest jedyny w swoim rodzaju.
   Kształt, kolory, wzór, oczy, buzia i dodatki zależą od ziarna; rzadkość dokłada ozdoby (czułki, rogi, skrzydła, koronę, aurę).
   Ten sam generator rysuje bossów (flaga boss: kolce, groźne oczy, zęby). Wszystko w SVG – ostre na każdym ekranie, bez plików. */

const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const CR_SHAPES = ['kulka', 'gruszka', 'fasolka', 'kotek', 'ptaszek', 'meduza', 'duszek'];
const CR_RANK = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 };

function creatureParts(seed, r = 'common', boss = false) {
  const R = mulberry(seed), pick = a => a[R() * a.length | 0], rank = CR_RANK[r] ?? 0;
  const hue = Math.round(R() * 360), sat = 55 + R() * 25 | 0;
  return {
    hue, sat, shape: boss ? pick([0, 1, 3, 5, 6]) : R() * CR_SHAPES.length | 0,
    eyes: boss ? 'angry' : pick(['dot', 'big', 'big', 'sleepy', 'sparkle', 'cyclops', 'happy']),
    mouth: boss ? pick(['fang', 'teeth']) : pick(['smile', 'smile', 'open', 'fang', 'cat', 'tongue', 'o']),
    pattern: pick(['none', 'spots', 'stripes', 'belly', 'belly', 'freckles']),
    blush: !boss && R() < .6, rank,
    extra: !boss && rank >= 1 ? pick(['antenna', 'sprout', 'tuft', 'bow']) : null,
    horns: boss || (rank >= 2 && R() < .65), wings: rank >= 2 && R() < .5, crown: rank >= 3, aura: rank >= 3, flames: rank >= 4 || (boss && R() < .4),
    spikes: boss, tilt: (R() - .5) * 8,
  };
}
// kształt ciała (ścieżka w polu 0..120)
function crBody(shape) {
  return [
    'M60 22C88 22 100 44 100 68C100 94 82 106 60 106S20 94 20 68C20 44 32 22 60 22Z',
    'M60 24C80 24 88 42 92 60C98 86 86 106 60 106S22 86 28 60C32 42 40 24 60 24Z',
    'M60 16C82 16 92 36 92 62C92 92 78 108 60 108S28 92 28 62C28 36 38 16 60 16Z',
    'M24 30L38 44C44 40 52 38 60 38S76 40 82 44L96 30L98 64C100 92 82 106 60 106S20 92 22 64Z',
    'M60 26C86 26 100 46 100 70C100 94 82 106 60 106S20 94 20 70C20 46 34 26 60 26Z',
    'M60 22C88 22 102 42 102 66L98 70H22L18 66C18 42 32 22 60 22Z',
    'M60 18C86 18 98 40 98 66V104L88 96L78 106L68 96L60 106L52 96L42 106L32 96L22 104V66C22 40 34 18 60 18Z',
  ][shape];
}
function creatureSVG(seed, r = 'common', o = {}) {
  const p = creatureParts(seed, r, o.boss), id = 'c' + (seed >>> 0).toString(36) + (o.boss ? 'b' : '');
  const h = p.hue, main = `hsl(${h} ${p.sat}% ${o.boss ? 46 : 62}%)`, dark = `hsl(${h} ${p.sat}% ${o.boss ? 26 : 38}%)`, light = `hsl(${h} 80% ${o.boss ? 70 : 86}%)`;
  const acc = `hsl(${(h + 150) % 360} 75% 60%)`, gold = '#fbbf24';
  const eyeY = p.shape === 2 ? 56 : p.shape === 5 ? 48 : 60, parts = [];
  // aura (legendarne / mityczne) i płomienie
  if (p.aura) parts.push(`<circle cx="60" cy="64" r="56" fill="url(#${id}a)"/>`);
  if (p.flames) parts.push(`<g fill="${o.boss ? '#ef4444' : '#f97316'}" opacity=".85">${[20, 38, 60, 82, 100].map((x, i) => `<path d="M${x} ${70 - i % 2 * 8}c-8-14 2-22 0-36c10 12 14 22 4 36z" transform="rotate(${(x - 60) / 3} ${x} 70)"/>`).join('')}</g>`);
  if (p.wings) parts.push(`<g fill="${light}" stroke="${dark}" stroke-width="2.5" stroke-linejoin="round"><path d="M24 66C6 56 2 40 8 30C16 44 24 48 30 52Z"/><path d="M96 66C114 56 118 40 112 30C104 44 96 48 90 52Z"/></g>`);
  // tentacles (meduza)
  if (p.shape === 5) parts.push(`<g fill="none" stroke="${dark}" stroke-width="5" stroke-linecap="round">${[32, 46, 60, 74, 88].map((x, i) => `<path d="M${x} 70q${i % 2 ? 6 : -6} 14 0 26t${i % 2 ? -4 : 4} 14"/>`).join('')}</g>`);
  if (p.spikes) parts.push(`<g fill="${dark}">${[[30, 30, -30], [46, 20, -12], [60, 17, 0], [74, 20, 12], [90, 30, 30]].map(([x, y, a]) => `<path d="M${x - 7} ${y + 8}L${x} ${y - 10}L${x + 7} ${y + 8}Z" transform="rotate(${a} ${x} ${y})"/>`).join('')}</g>`);
  if (p.horns) parts.push(`<g fill="${o.boss ? '#e5e7eb' : light}" stroke="${dark}" stroke-width="2.5" stroke-linejoin="round"><path d="M38 34C30 24 30 12 36 6C38 18 44 24 48 28Z"/><path d="M82 34C90 24 90 12 84 6C82 18 76 24 72 28Z"/></g>`);
  // ciało
  parts.push(`<path d="${crBody(p.shape)}" fill="url(#${id}g)" stroke="${dark}" stroke-width="3" stroke-linejoin="round"/>`);
  if (p.pattern === 'belly') parts.push(`<ellipse cx="60" cy="${p.shape === 5 ? 58 : 84}" rx="22" ry="${p.shape === 5 ? 8 : 16}" fill="${light}" opacity=".9"/>`);
  if (p.pattern === 'spots') parts.push(`<g fill="${dark}" opacity=".35"><circle cx="36" cy="80" r="5"/><circle cx="84" cy="44" r="4"/><circle cx="80" cy="88" r="6"/><circle cx="44" cy="40" r="3.5"/></g>`);
  if (p.pattern === 'stripes') parts.push(`<g fill="none" stroke="${dark}" stroke-width="4" stroke-linecap="round" opacity=".35"><path d="M30 46q8 4 4 12"/><path d="M90 46q-8 4-4 12"/><path d="M26 74q10 2 8 10"/><path d="M94 74q-10 2-8 10"/></g>`);
  if (p.pattern === 'freckles') parts.push(`<g fill="${dark}" opacity=".5"><circle cx="40" cy="74" r="1.6"/><circle cx="44" cy="78" r="1.6"/><circle cx="37" cy="79" r="1.6"/><circle cx="80" cy="74" r="1.6"/><circle cx="76" cy="78" r="1.6"/><circle cx="83" cy="79" r="1.6"/></g>`);
  // ozdoby na głowie
  const top = p.shape === 2 ? 16 : p.shape === 6 ? 18 : 22;
  if (p.extra === 'antenna') parts.push(`<g stroke="${dark}" stroke-width="2.5" fill="${acc}"><path d="M52 ${top}Q46 ${top - 14} 40 ${top - 16}" fill="none"/><circle cx="40" cy="${top - 16}" r="4"/><path d="M68 ${top}Q74 ${top - 14} 80 ${top - 16}" fill="none"/><circle cx="80" cy="${top - 16}" r="4"/></g>`);
  if (p.extra === 'sprout') parts.push(`<g stroke="#15803d" stroke-width="2.5" fill="#4ade80" stroke-linejoin="round"><path d="M60 ${top}V${top - 10}" fill="none"/><path d="M60 ${top - 8}C52 ${top - 18} 44 ${top - 12} 46 ${top - 6}C52 ${top - 4} 58 ${top - 6} 60 ${top - 8}Z"/><path d="M60 ${top - 10}C66 ${top - 20} 76 ${top - 16} 74 ${top - 10}C68 ${top - 6} 62 ${top - 8} 60 ${top - 10}Z"/></g>`);
  if (p.extra === 'tuft') parts.push(`<path d="M50 ${top + 2}C52 ${top - 10} 58 ${top - 12} 60 ${top - 4}C62 ${top - 14} 70 ${top - 10} 70 ${top + 2}" fill="${main}" stroke="${dark}" stroke-width="2.5" stroke-linejoin="round"/>`);
  if (p.extra === 'bow') parts.push(`<g fill="${acc}" stroke="${dark}" stroke-width="2" stroke-linejoin="round"><path d="M74 ${top + 6}L62 ${top}L64 ${top + 14}Z"/><path d="M74 ${top + 6}L86 ${top}L84 ${top + 14}Z"/><circle cx="74" cy="${top + 7}" r="3"/></g>`);
  if (p.crown) parts.push(`<path d="M42 ${top + 2}L46 ${top - 14}L54 ${top - 4}L60 ${top - 18}L66 ${top - 4}L74 ${top - 14}L78 ${top + 2}Z" fill="${gold}" stroke="#b45309" stroke-width="2.5" stroke-linejoin="round"/><circle cx="60" cy="${top - 6}" r="2.5" fill="#ef4444"/>`);
  // oczy
  const eye = (x, big = 1) => {
    if (p.eyes === 'sleepy') return `<path d="M${x - 7} ${eyeY}q7 6 14 0" fill="none" stroke="#1f2937" stroke-width="3" stroke-linecap="round"/>`;
    if (p.eyes === 'happy') return `<path d="M${x - 7} ${eyeY + 2}q7 -9 14 0" fill="none" stroke="#1f2937" stroke-width="3" stroke-linecap="round"/>`;
    if (p.eyes === 'angry') return `<circle cx="${x}" cy="${eyeY}" r="7" fill="#fde047"/><circle cx="${x}" cy="${eyeY + 1}" r="3.4" fill="#111827"/><path d="M${x - 10} ${eyeY - 12}L${x + 9} ${eyeY - 6}" transform="${x < 60 ? '' : `scale(-1 1) translate(${-2 * x} 0)`}" stroke="#111827" stroke-width="4" stroke-linecap="round"/>`;
    const r = (p.eyes === 'big' ? 9 : p.eyes === 'dot' ? 4.5 : 7.5) * big;
    return `<circle cx="${x}" cy="${eyeY}" r="${r}" fill="${p.eyes === 'dot' ? '#1f2937' : '#fff'}" stroke="#1f2937" stroke-width="${p.eyes === 'dot' ? 0 : 2.5}"/>${p.eyes === 'dot' ? '' : `<circle cx="${x + 1.5}" cy="${eyeY + 1}" r="${r * .55}" fill="#1f2937"/><circle cx="${x + 3.5}" cy="${eyeY - 2.5}" r="${r * .22}" fill="#fff"/>`}${p.eyes === 'sparkle' ? `<path d="M${x - 2} ${eyeY + 3}l2 -3l2 3l-2 3z" fill="#fff"/>` : ''}`;
  };
  parts.push(p.eyes === 'cyclops' ? eye(60, 1.5) : eye(44) + eye(76));
  if (p.blush) parts.push(`<g fill="#fb7185" opacity=".45"><ellipse cx="34" cy="${eyeY + 12}" rx="6" ry="3.5"/><ellipse cx="86" cy="${eyeY + 12}" rx="6" ry="3.5"/></g>`);
  // buzia
  const my = eyeY + 16;
  parts.push({
    smile: `<path d="M50 ${my}q10 9 20 0" fill="none" stroke="#1f2937" stroke-width="3" stroke-linecap="round"/>`,
    open: `<path d="M50 ${my}q10 14 20 0z" fill="#7f1d1d" stroke="#1f2937" stroke-width="2.5" stroke-linejoin="round"/>`,
    fang: `<path d="M48 ${my}q12 10 24 0" fill="none" stroke="#1f2937" stroke-width="3" stroke-linecap="round"/><path d="M53 ${my + 2.5}l2.5 6l2.5 -5z" fill="#fff" stroke="#1f2937" stroke-width="1.5"/>${o.boss ? `<path d="M63 ${my + 2.5}l2.5 6l2.5 -6z" fill="#fff" stroke="#1f2937" stroke-width="1.5"/>` : ''}`,
    teeth: `<path d="M44 ${my - 2}h32q-2 14 -16 14t-16 -14z" fill="#450a0a" stroke="#1f2937" stroke-width="2.5"/><path d="M47 ${my - 2}l3 6l3 -6l3 6l3 -6l3 6l3 -6l3 6l3 -6l3 6l3 -6" fill="#fff" stroke="#1f2937" stroke-width="1.2" stroke-linejoin="round"/>`,
    cat: `<path d="M50 ${my}q5 6 10 0q5 6 10 0" fill="none" stroke="#1f2937" stroke-width="3" stroke-linecap="round"/>`,
    tongue: `<path d="M50 ${my}q10 9 20 0" fill="none" stroke="#1f2937" stroke-width="3" stroke-linecap="round"/><path d="M57 ${my + 4}q3 8 6 0" fill="#fb7185" stroke="#1f2937" stroke-width="2"/>`,
    o: `<ellipse cx="60" cy="${my + 2}" rx="4.5" ry="5.5" fill="#7f1d1d" stroke="#1f2937" stroke-width="2.5"/>`,
  }[p.mouth]);
  if (p.shape === 4) parts.push(`<path d="M55 ${eyeY + 8}L65 ${eyeY + 8}L60 ${eyeY + 15}Z" fill="#f59e0b" stroke="#92400e" stroke-width="2" stroke-linejoin="round"/>`);
  if (r === 'mythic' && !o.boss) parts.push(`<g fill="#fde68a">${[[18, 22], [100, 18], [104, 96], [14, 92]].map(([x, y]) => `<path d="M${x} ${y - 6}l2 4l4 2l-4 2l-2 4l-2 -4l-4 -2l4 -2z"/>`).join('')}</g>`);
  return `<svg class="creature${o.boss ? ' boss' : ''} r-${r}" viewBox="0 0 120 120" role="img" aria-label="${esc(o.label || 'stworek')}"><defs>
    <radialGradient id="${id}g" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="${light}"/><stop offset=".45" stop-color="${main}"/><stop offset="1" stop-color="${dark}"/></radialGradient>
    <radialGradient id="${id}a"><stop offset=".5" stop-color="${r === 'mythic' || o.boss ? '#ef4444' : gold}" stop-opacity=".55"/><stop offset="1" stop-color="${gold}" stop-opacity="0"/></radialGradient></defs>
    <g transform="rotate(${p.tilt.toFixed(1)} 60 64)">${parts.join('')}</g></svg>`;
}
// imię: sylaby + końcówka, np. „Bulisek”, „Mirak”
const CR_SYL = ['bu', 'mi', 'lo', 'ra', 'zu', 'fi', 'ko', 'pi', 'ne', 'ta', 'gu', 'wi', 'mo', 'chi', 'ba', 'du', 'fu', 'le', 'po', 'sza'];
const CR_END = ['sek', 'k', 'ś', 'uś', 'ka', 'lek', 'ruś', 'ny', 'ak', 'ek', 'cia', 'nio'];
function creatureName(seed) {
  const R = mulberry(seed * 7 + 3), n = 1 + (R() < .55 ? 1 : 0);
  let s = Array.from({ length: n }, () => CR_SYL[R() * CR_SYL.length | 0]).join('') + CR_END[R() * CR_END.length | 0];
  return s[0].toUpperCase() + s.slice(1);
}
const newSeed = () => (Math.random() * 2 ** 31) >>> 0;
const creatureDesc = (seed, r) => { const p = creatureParts(seed, r); return CR_SHAPES[p.shape]; };
// PNG (np. jako awatar): SVG → canvas
async function creaturePNG(seed, r, px = 128) {
  const svg = creatureSVG(seed, r).replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" `);
  const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const c = document.createElement('canvas'); c.width = c.height = px; const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, px, px); ctx.drawImage(img, 0, 0, px, px);
  return c.toDataURL('image/jpeg', .88);
}

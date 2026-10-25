'use strict';
/* 🏷️ Własne naklejki SVG: wycinany kształt (koło, gwiazda, tarcza, heksagon, plama, kafel; jajo dla naklejek z inkubatora),
   gradient dobrany do naklejki, ikona z game-icons.net (CC BY 3.0) z cieniem, podpis na wstążce i ozdoby wg rzadkości:
   rzadka – kropkowany pierścień, epicka – iskry, legendarna – złota obwódka i promienie. Białą obwódkę „wyciętej” naklejki daje CSS. */

const stHash = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const ST_SHAPES = {
  circle: 'M50 6A44 44 0 1 1 49.9 6Z',
  burst: Array.from({ length: 24 }, (_, i) => { const a = i / 24 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 38 : 46; return `${i ? 'L' : 'M'}${(50 + r * Math.cos(a)).toFixed(1)} ${(50 + r * Math.sin(a)).toFixed(1)}`; }).join('') + 'Z',
  shield: 'M50 5L88 18V48C88 72 70 88 50 95C30 88 12 72 12 48V18Z',
  hex: 'M50 4L90 27V73L50 96L10 73V27Z',
  blob: 'M52 6C74 4 94 20 94 46C94 74 76 94 50 94C24 94 6 76 8 50C10 24 28 8 52 6Z',
  tile: 'M24 8H76Q92 8 92 24V76Q92 92 76 92H24Q8 92 8 76V24Q8 8 24 8Z',
  egg: 'M50 4C74 4 90 36 90 60C90 82 72 96 50 96S10 82 10 60C10 36 26 4 50 4Z',
};
const ST_SHAPE_KEYS = ['circle', 'burst', 'shield', 'hex', 'blob', 'tile'];
function stickerArt(s) {
  const path = typeof GI_PATHS !== 'undefined' && GI_PATHS[s.id]; if (!path) return null;
  const h = stHash(s.id), hue = h % 360, rank = { common: 0, rare: 1, epic: 2, legendary: 3 }[s.r] ?? 0, id = 'sa' + s.id;
  const shape = ST_SHAPES[s.hatch ? 'egg' : ST_SHAPE_KEYS[(h >> 8) % ST_SHAPE_KEYS.length]];
  const c1 = `hsl(${hue} ${60 + rank * 8}% ${62 - rank * 3}%)`, c2 = `hsl(${(hue + 25 + rank * 30) % 360} ${65 + rank * 8}% ${40 - rank * 2}%)`;
  const rim = rank === 3 ? '#fbbf24' : rank === 2 ? `hsl(${(hue + 60) % 360} 90% 70%)` : 'rgba(255,255,255,.55)';
  const name = s.name.toUpperCase(), fs = name.length > 11 ? 7 : name.length > 8 ? 8.5 : 10;
  const parts = [];
  if (rank === 3) parts.push(`<g opacity=".55" fill="#fde047">${Array.from({ length: 12 }, (_, i) => `<path d="M50 50L${(50 + 60 * Math.cos(i / 6 * Math.PI)).toFixed(1)} ${(50 + 60 * Math.sin(i / 6 * Math.PI)).toFixed(1)}L${(50 + 60 * Math.cos((i + .45) / 6 * Math.PI)).toFixed(1)} ${(50 + 60 * Math.sin((i + .45) / 6 * Math.PI)).toFixed(1)}Z"/>`).join('')}</g>`);
  parts.push(`<path d="${shape}" fill="url(#${id}g)" stroke="${rim}" stroke-width="${rank === 3 ? 4 : 2.5}"/>`);
  parts.push(`<path d="${shape}" fill="url(#${id}s)" opacity=".9"/>`);   // połysk
  if (rank === 1) parts.push(`<circle cx="50" cy="48" r="34" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="1.5 4" opacity=".7"/>`);
  parts.push(`<g transform="translate(18 ${s.hatch ? 20 : 11}) scale(${64 / 512})"><path d="${path}" fill="#0005" transform="translate(18 26)"/><path d="${path}" fill="#fff"/></g>`);
  if (rank >= 2) parts.push(`<g fill="#fff">${[[20, 22, 4], [80, 18, 3], [84, 60, 2.5]].map(([x, y, r]) => `<path d="M${x} ${y - r * 2}L${x + r * .6} ${y - r * .6}L${x + r * 2} ${y}L${x + r * .6} ${y + r * .6}L${x} ${y + r * 2}L${x - r * .6} ${y + r * .6}L${x - r * 2} ${y}L${x - r * .6} ${y - r * .6}Z"/>`).join('')}</g>`);
  parts.push(`<g class="stk-cap"><path d="M10 74H90L86 82L90 90H10L14 82Z" fill="${rank === 3 ? '#b45309' : c2}" stroke="#fff" stroke-width="1.5"/><text x="50" y="${85 - (10 - fs) * .3}" text-anchor="middle" font-size="${fs}" font-weight="900" fill="#fff" font-family="system-ui,-apple-system,sans-serif" letter-spacing=".3">${esc(name)}</text></g>`);
  return `<svg class="st-img sv r-${s.r}" viewBox="-4 -4 108 108" role="img" aria-label="${esc(s.name)}"><defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
    <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>${parts.join('')}</svg>`;
}

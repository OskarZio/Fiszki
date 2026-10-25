'use strict';
/* 🎭 Postacie bohatera – rysowane w SVG (styl jak stworki), 4 formy ewolucji na gatunek (prestiż = ewolucja).
   Wersja „ona” (kokardka, rzęsy) albo „on” (brwi, zawadiacki wygląd). Kot ma legendarną formę z mema (Kot żołnierz).
   charSVG(line, form 0–3, g 'w'|'m') → <svg>. Bez plików i bez zewnętrznych grafik (poza zdjęciem kota z naklejki). */

const CHARS = {
  cat: { name: 'Kot Wojak', icon: '🐱', forms: ['Kociak', 'Kot w hełmie', 'Kot Generał', 'Legendarny Kot Żołnierz'], c: ['#f59e0b', '#b45309', '#fde68a'], desc: 'Prosto z legendarnego mema. Nigdy nie odpuszcza kolokwium.' },
  frog: { name: 'Żabson', icon: '🐸', forms: ['Kijanek', 'Żabson', 'Żabi Rycerz', 'Żabi Król'], c: ['#4ade80', '#15803d', '#dcfce7'], desc: 'Skacze z tematu na temat – i wszystko pamięta.' },
  dog: { name: 'Pieseł', icon: '🐶', forms: ['Szczeniak', 'Pieseł', 'Pies Detektyw', 'Wielki Pieseł'], c: ['#fb923c', '#c2410c', '#fff7ed'], desc: 'Such nauka. Very powtórki. Wow.' },
  owl: { name: 'Sowa Sesji', icon: '🦉', forms: ['Sówka', 'Sowa Nocna', 'Sowa Profesor', 'Sowa Arcymag'], c: ['#a78bfa', '#6d28d9', '#ede9fe'], desc: 'Uczy się po nocach, ale śpi 8 godzin. Zawsze.' },
  hamster: { name: 'Chomik Turbo', icon: '🐹', forms: ['Chomiczek', 'Chomik Kujon', 'Chomik na Energetyku', 'Chomik Turbo'], c: ['#fcd34d', '#b45309', '#fffbeb'], desc: 'Kręci kołem powtórek szybciej niż ktokolwiek.' },
  fox: { name: 'Lis Spryciarz', icon: '🦊', forms: ['Lisek', 'Lis w bluzie', 'Lis Ninja', 'Kitsune'], c: ['#f97316', '#9a3412', '#ffedd5'], desc: 'Zawsze znajdzie skojarzenie, którego nikt inny nie wymyśli.' },
};
function charSVG(line, form = 0, g = 'w') {
  const C = CHARS[line] || CHARS.cat, [main, dark, light] = C.c, f = Math.max(0, Math.min(3, form)), id = `h${line}${f}${g}`;
  // legendarna forma kota = zdjęcie z mema w złotej ramie z laurem
  if (line === 'cat' && f === 3) return `<svg class="charsvg" viewBox="0 0 120 120"><defs><clipPath id="${id}c"><circle cx="60" cy="56" r="40"/></clipPath><radialGradient id="${id}g"><stop offset=".6" stop-color="#fde047"/><stop offset="1" stop-color="#b45309"/></radialGradient></defs>
    <circle cx="60" cy="56" r="52" fill="#fde04733"/><g fill="#16a34a" stroke="#14532d" stroke-width="1.5">${[0, 1, 2, 3, 4, 5].map(i => `<ellipse cx="${18 + i * 3}" cy="${84 - i * 11}" rx="7" ry="3.5" transform="rotate(${-60 + i * 10} ${18 + i * 3} ${84 - i * 11})"/><ellipse cx="${102 - i * 3}" cy="${84 - i * 11}" rx="7" ry="3.5" transform="rotate(${60 - i * 10} ${102 - i * 3} ${84 - i * 11})"/>`).join('')}</g>
    <circle cx="60" cy="56" r="44" fill="url(#${id}g)" stroke="#92400e" stroke-width="3"/><image href="assets/stickers/kot-zolnierz.webp" x="20" y="16" width="80" height="80" clip-path="url(#${id}c)" preserveAspectRatio="xMidYMid slice"/>
    <circle cx="60" cy="56" r="40" fill="none" stroke="#fff7" stroke-width="2"/><path d="M34 102h52l-6 10H40z" fill="#dc2626" stroke="#7f1d1d" stroke-width="2"/><text x="60" y="110" text-anchor="middle" font-size="7.5" font-weight="900" fill="#fff" font-family="system-ui">LEGENDA</text>
    <path d="M60 4l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#fde047" stroke="#92400e" stroke-width="1.5"/></svg>`;
  const baby = f === 0, headR = baby ? 32 : 29, hy = baby ? 54 : 50, by = baby ? 92 : 90, bry = baby ? 16 : 21;
  const P = [];
  const stroke = `stroke="${dark}" stroke-width="2.5" stroke-linejoin="round"`;
  // cień + peleryna (forma 3)
  P.push(`<ellipse cx="60" cy="113" rx="30" ry="4" fill="#0002"/>`);
  if (f === 3) P.push(`<path d="M34 70Q20 100 26 112H94Q100 100 86 70Z" fill="${line === 'frog' ? '#7c3aed' : line === 'owl' ? '#1e3a8a' : '#dc2626'}" stroke="#0004" stroke-width="2"/>`);
  if (f === 3 && line === 'fox') P.push(`<g fill="${main}" stroke="${dark}" stroke-width="2">${[-50, -25, 0, 25, 50].map(a => `<path d="M60 92Q${60 + a} 60 ${60 + a * 1.2} 40Q${64 + a} 70 60 92Z" opacity=".9"/>`).join('')}</g>`);
  // ogon
  const tail = { cat: `<path d="M84 96q20-4 16-26q-2-8-6-4q2 18-14 22z" fill="${main}" ${stroke}/>`, dog: `<path d="M84 90q18-10 10-26q-6 2-4 8q2 8-10 12z" fill="${main}" ${stroke}/>`,
    fox: `<path d="M82 96q30 0 26-30q-12 4-12 14q-2 10-16 10z" fill="${main}" ${stroke}/><path d="M104 70q4 6 2 12q-6-2-8-8z" fill="#fff"/>`, hamster: '', frog: '', owl: '' }[line];
  if (f !== 3 || line !== 'fox') P.push(tail);
  // ciało, brzuszek, łapki, stopy
  P.push(`<ellipse cx="60" cy="${by}" rx="${baby ? 22 : 26}" ry="${bry}" fill="${main}" ${stroke}/><ellipse cx="60" cy="${by + 3}" rx="${baby ? 13 : 16}" ry="${bry - 6}" fill="${light}"/>`);
  if (line === 'owl') P.push(`<path d="M36 ${by - 6}q-8 12 2 22q4-10 6-18z" fill="${dark}"/><path d="M84 ${by - 6}q8 12-2 22q-4-10-6-18z" fill="${dark}"/>`);
  else P.push(`<ellipse cx="${baby ? 40 : 36}" cy="${by - 2}" rx="6" ry="8" fill="${main}" ${stroke} transform="rotate(20 ${baby ? 40 : 36} ${by - 2})"/><ellipse cx="${baby ? 80 : 84}" cy="${by - 2}" rx="6" ry="8" fill="${main}" ${stroke} transform="rotate(-20 ${baby ? 80 : 84} ${by - 2})"/>`);
  P.push(`<ellipse cx="48" cy="${by + bry - 2}" rx="8" ry="5" fill="${line === 'owl' ? '#f59e0b' : main}" ${stroke}/><ellipse cx="72" cy="${by + bry - 2}" rx="8" ry="5" fill="${line === 'owl' ? '#f59e0b' : main}" ${stroke}/>`);
  // szyja: szalik / łańcuch / bluza
  if (f === 1 && ['dog', 'cat'].includes(line)) P.push(`<path d="M38 ${hy + 24}q22 10 44 0v6q-22 10-44 0z" fill="#ef4444" stroke="#7f1d1d" stroke-width="2"/><path d="M74 ${hy + 28}l4 14l-8-2z" fill="#ef4444" stroke="#7f1d1d" stroke-width="2"/>`);
  if (f === 1 && line === 'fox') P.push(`<ellipse cx="60" cy="${by}" rx="27" ry="${bry + 1}" fill="#475569" stroke="#1e293b" stroke-width="2.5"/><path d="M48 ${by + 6}h24v8H48z" fill="#334155" rx="3"/><path d="M54 ${by - 16}v12M66 ${by - 16}v12" stroke="#f8fafc" stroke-width="2" stroke-linecap="round"/>`);
  if (f === 3 && line === 'dog') P.push(`<path d="M42 ${hy + 26}q18 14 36 0" fill="none" stroke="#fbbf24" stroke-width="4"/><circle cx="60" cy="${hy + 34}" r="5" fill="#fbbf24" stroke="#92400e" stroke-width="1.5"/>`);
  if (f === 2 && line === 'cat') P.push(`<g fill="#fbbf24" stroke="#92400e" stroke-width="1.2"><circle cx="52" cy="${by - 6}" r="3.5"/><circle cx="60" cy="${by - 4}" r="3.5"/></g><path d="M30 ${by - 16}h14v5H30zM76 ${by - 16}h14v5H76z" fill="#fbbf24" stroke="#92400e" stroke-width="1.2"/>`);
  if (f === 2 && line === 'hamster') P.push(`<path d="M30 ${by - 10}Q20 ${by + 10} 26 ${by + 18}L40 ${by}z" fill="#22d3ee" stroke="#0e7490" stroke-width="2"/><path d="M90 ${by - 10}Q100 ${by + 10} 94 ${by + 18}L80 ${by}z" fill="#22d3ee" stroke="#0e7490" stroke-width="2"/>`);
  // uszy (za głową)
  const ears = {
    cat: `<path d="M36 ${hy - 14}L34 ${hy - 40}L54 ${hy - 26}Z" fill="${main}" ${stroke}/><path d="M84 ${hy - 14}L86 ${hy - 40}L66 ${hy - 26}Z" fill="${main}" ${stroke}/><path d="M39 ${hy - 20}L38 ${hy - 33}L48 ${hy - 25}Z" fill="#fda4af"/><path d="M81 ${hy - 20}L82 ${hy - 33}L72 ${hy - 25}Z" fill="#fda4af"/>`,
    fox: `<path d="M34 ${hy - 10}L30 ${hy - 44}L56 ${hy - 24}Z" fill="${main}" ${stroke}/><path d="M86 ${hy - 10}L90 ${hy - 44}L64 ${hy - 24}Z" fill="${main}" ${stroke}/><path d="M36 ${hy - 18}L34 ${hy - 36}L48 ${hy - 25}Z" fill="#1f2937"/><path d="M84 ${hy - 18}L86 ${hy - 36}L72 ${hy - 25}Z" fill="#1f2937"/>`,
    dog: '',
    hamster: `<circle cx="38" cy="${hy - 22}" r="9" fill="${main}" ${stroke}/><circle cx="82" cy="${hy - 22}" r="9" fill="${main}" ${stroke}/><circle cx="38" cy="${hy - 22}" r="5" fill="#fda4af"/><circle cx="82" cy="${hy - 22}" r="5" fill="#fda4af"/>`,
    owl: `<path d="M36 ${hy - 18}L32 ${hy - 36}L50 ${hy - 26}Z" fill="${dark}"/><path d="M84 ${hy - 18}L88 ${hy - 36}L70 ${hy - 26}Z" fill="${dark}"/>`,
    frog: `<circle cx="42" cy="${hy - 22}" r="12" fill="${main}" ${stroke}/><circle cx="78" cy="${hy - 22}" r="12" fill="${main}" ${stroke}/>`,
  }[line];
  P.push(ears);
  // głowa
  P.push(`<circle cx="60" cy="${hy}" r="${headR}" fill="url(#${id}h)" ${stroke}/>`);
  if (line === 'dog') P.push(`<path d="M36 ${hy - 22}C22 ${hy - 20} 20 ${hy + 4} 26 ${hy + 14}C32 ${hy + 10} 36 ${hy - 2} 40 ${hy - 14}Z" fill="${dark}" ${stroke}/><path d="M84 ${hy - 22}C98 ${hy - 20} 100 ${hy + 4} 94 ${hy + 14}C88 ${hy + 10} 84 ${hy - 2} 80 ${hy - 14}Z" fill="${dark}" ${stroke}/><ellipse cx="60" cy="${hy + 10}" rx="15" ry="11" fill="${light}"/>`);
  if (line === 'fox') P.push(`<path d="M38 ${hy + 6}Q60 ${hy + 34} 82 ${hy + 6}Q72 ${hy + 22} 60 ${hy + 22}Q48 ${hy + 22} 38 ${hy + 6}Z" fill="${light}"/>`);
  if (line === 'owl') P.push(`<circle cx="47" cy="${hy}" r="13" fill="${light}"/><circle cx="73" cy="${hy}" r="13" fill="${light}"/>`);
  if (line === 'hamster') P.push(`<ellipse cx="40" cy="${hy + 12}" rx="11" ry="9" fill="${light}"/><ellipse cx="80" cy="${hy + 12}" rx="11" ry="9" fill="${light}"/>`);
  // oczy
  const ey = line === 'frog' ? hy - 22 : hy - 2, ex = line === 'frog' ? 18 : 12, er = baby ? 7 : 6;
  const eye = x => `<circle cx="${x}" cy="${ey}" r="${er}" fill="#1f2937"/><circle cx="${x + 2}" cy="${ey - 2.5}" r="${er * .38}" fill="#fff"/><circle cx="${x - 2}" cy="${ey + 2}" r="${er * .18}" fill="#fff"/>`;
  if (line === 'frog') P.push(`<circle cx="${60 - ex}" cy="${ey}" r="${er + 2}" fill="#fff"/><circle cx="${60 + ex}" cy="${ey}" r="${er + 2}" fill="#fff"/>`);
  P.push(eye(60 - ex) + eye(60 + ex));
  if (g === 'w') P.push(`<g stroke="#1f2937" stroke-width="2" stroke-linecap="round"><path d="M${60 - ex - er} ${ey - er + 1}l-4 -3M${60 - ex - er + 3} ${ey - er - 1}l-2 -4"/><path d="M${60 + ex + er} ${ey - er + 1}l4 -3M${60 + ex + er - 3} ${ey - er - 1}l2 -4"/></g>`);
  else P.push(`<g stroke="${dark}" stroke-width="3" stroke-linecap="round"><path d="M${60 - ex - 7} ${ey - er - 5}l12 3"/><path d="M${60 + ex + 7} ${ey - er - 5}l-12 3"/></g>`);
  P.push(`<g fill="#fb7185" opacity=".5"><ellipse cx="${60 - ex - 8}" cy="${hy + 10}" rx="6" ry="3.5"/><ellipse cx="${60 + ex + 8}" cy="${hy + 10}" rx="6" ry="3.5"/></g>`);
  // pyszczek / dziób
  const my = hy + 12;
  P.push({
    cat: `<path d="M57 ${my - 4}h6l-3 3z" fill="#fb7185"/><path d="M52 ${my}q4 4 8 0q4 4 8 0" fill="none" stroke="#1f2937" stroke-width="2.2" stroke-linecap="round"/><g stroke="#1f2937" stroke-width="1.3" opacity=".6"><path d="M36 ${my - 4}h-10M36 ${my}h-10M84 ${my - 4}h10M84 ${my}h10"/></g>`,
    fox: `<ellipse cx="60" cy="${my - 3}" rx="4" ry="3" fill="#1f2937"/><path d="M54 ${my + 2}q6 5 12 0" fill="none" stroke="#1f2937" stroke-width="2.2" stroke-linecap="round"/>`,
    dog: `<ellipse cx="60" cy="${my - 3}" rx="5" ry="3.6" fill="#1f2937"/><path d="M53 ${my + 2}q7 7 14 0" fill="none" stroke="#1f2937" stroke-width="2.2" stroke-linecap="round"/><path d="M58 ${my + 4}q2 6 4 0" fill="#fb7185"/>`,
    hamster: `<path d="M57 ${my - 4}h6l-3 3z" fill="#fb7185"/><path d="M60 ${my - 1}v3M55 ${my + 2}q5 4 10 0" fill="none" stroke="#1f2937" stroke-width="2" stroke-linecap="round"/><rect x="56" y="${my + 3}" width="8" height="5" rx="1.5" fill="#fff" stroke="#1f2937" stroke-width="1.2"/>`,
    owl: `<path d="M55 ${my - 6}L65 ${my - 6}L60 ${my + 3}Z" fill="#f59e0b" stroke="#92400e" stroke-width="1.8" stroke-linejoin="round"/>`,
    frog: `<path d="M40 ${hy + 6}q20 16 40 0" fill="none" stroke="#1f2937" stroke-width="2.5" stroke-linecap="round"/>`,
  }[line]);
  // akcesoria na głowie / twarzy wg formy
  const top = hy - headR;
  const A = {
    cat: [``, `<path d="M30 ${top + 14}Q60 ${top - 16} 90 ${top + 14}L94 ${top + 20}H26Z" fill="#4d7c0f" stroke="#1a2e05" stroke-width="2.5"/><path d="M36 ${top + 8}q24 -14 48 0" fill="none" stroke="#65a30d" stroke-width="3"/>`,
      `<path d="M28 ${top + 14}Q60 ${top - 18} 92 ${top + 14}L96 ${top + 20}H24Z" fill="#3f6212" stroke="#1a2e05" stroke-width="2.5"/><path d="M50 ${top}l3 6 6 1-4.5 4 1 6.5-5.5-3-5.5 3 1-6.5-4.5-4 6-1z" fill="#fde047" stroke="#92400e" stroke-width="1.2" transform="translate(7 0)"/>`],
    frog: [``, `<path d="M32 ${hy - 6}q28 -10 56 0v6q-28 -10 -56 0z" fill="#ef4444"/><path d="M88 ${hy - 4}l10 -6l-2 10z" fill="#ef4444"/>`, `<path d="M32 ${hy - 10}Q60 ${hy - 40} 88 ${hy - 10}V${hy - 2}H32Z" fill="#cbd5e1" stroke="#475569" stroke-width="2.5"/><path d="M40 ${hy - 6}h40" stroke="#475569" stroke-width="3"/><path d="M60 ${hy - 34}q10 -10 4 -20" fill="none" stroke="#ef4444" stroke-width="4" stroke-linecap="round"/>`,
      `<path d="M38 ${hy - 30}L42 ${hy - 50}L51 ${hy - 38}L60 ${hy - 54}L69 ${hy - 38}L78 ${hy - 50}L82 ${hy - 30}Z" fill="#fbbf24" stroke="#92400e" stroke-width="2.5" stroke-linejoin="round"/><circle cx="60" cy="${hy - 38}" r="3" fill="#ef4444"/>`],
    dog: [``, ``, `<path d="M28 ${top + 10}Q60 ${top - 14} 92 ${top + 10}L98 ${top + 14}H22Z" fill="#78350f" stroke="#451a03" stroke-width="2.5"/><path d="M40 ${top + 4}h40v4H40z" fill="#451a03"/><circle cx="94" cy="${hy + 22}" r="8" fill="#bae6fd88" stroke="#334155" stroke-width="3"/><path d="M88 ${hy + 28}l-8 8" stroke="#334155" stroke-width="4" stroke-linecap="round"/>`,
      `<rect x="38" y="${hy - 8}" width="18" height="10" rx="3" fill="#111827"/><rect x="64" y="${hy - 8}" width="18" height="10" rx="3" fill="#111827"/><path d="M56 ${hy - 4}h8" stroke="#111827" stroke-width="2.5"/>`],
    owl: [``, `<rect x="82" y="${by - 10}" width="16" height="20" rx="2" fill="#2563eb" stroke="#1e3a8a" stroke-width="2"/><path d="M84 ${by - 6}h12" stroke="#bfdbfe" stroke-width="1.5"/>`,
      `<g fill="none" stroke="#1f2937" stroke-width="2.5"><circle cx="48" cy="${hy - 2}" r="10"/><circle cx="72" cy="${hy - 2}" r="10"/><path d="M58 ${hy - 2}h4"/></g><path d="M30 ${top + 4}L60 ${top - 8}L90 ${top + 4}L60 ${top + 16}Z" fill="#111827"/><path d="M84 ${top + 6}v14" stroke="#fbbf24" stroke-width="2.5"/>`,
      `<path d="M34 ${top + 10}L62 ${top - 34}L88 ${top + 10}Z" fill="#4338ca" stroke="#1e1b4b" stroke-width="2.5" stroke-linejoin="round"/><g fill="#fde047"><circle cx="58" cy="${top - 6}" r="2.5"/><circle cx="70" cy="${top + 2}" r="2"/><circle cx="52" cy="${top + 4}" r="1.8"/></g><path d="M96 ${by + 18}V${by - 30}" stroke="#92400e" stroke-width="4" stroke-linecap="round"/><circle cx="96" cy="${by - 34}" r="6" fill="#22d3ee" stroke="#0e7490" stroke-width="2"/>`],
    hamster: [``, `<g fill="none" stroke="#1f2937" stroke-width="2.5"><circle cx="48" cy="${hy - 2}" r="9"/><circle cx="72" cy="${hy - 2}" r="9"/><path d="M57 ${hy - 2}h6"/></g>`,
      `<rect x="84" y="${by - 14}" width="11" height="20" rx="3" fill="#22c55e" stroke="#14532d" stroke-width="2"/><path d="M86 ${by - 8}h7" stroke="#fde047" stroke-width="2"/><g fill="none" stroke="#1f2937" stroke-width="2.5"><circle cx="48" cy="${hy - 2}" r="9"/><circle cx="72" cy="${hy - 2}" r="9"/><path d="M57 ${hy - 2}h6"/></g>`,
      `<path d="M30 ${hy - 26}q30 -16 60 0" fill="none" stroke="#111827" stroke-width="5"/><circle cx="30" cy="${hy - 14}" r="7" fill="#111827"/><circle cx="90" cy="${hy - 14}" r="7" fill="#111827"/><path d="M92 ${by - 40}l-8 16h7l-5 14l14-20h-8l6-10z" fill="#fde047" stroke="#b45309" stroke-width="1.5"/>`],
    fox: [``, ``,
      `<path d="M30 ${hy + 4}Q60 ${hy + 32} 90 ${hy + 4}V${hy + 14}Q60 ${hy + 40} 30 ${hy + 14}Z" fill="#111827"/><path d="M30 ${hy - 10}h60v6H30z" fill="#dc2626"/><path d="M90 ${hy - 8}l12 6l-12 2z" fill="#dc2626"/>`,
      `<circle cx="60" cy="${top + 2}" r="4" fill="#fde047"/><path d="M52 ${top - 2}q8 -10 16 0" fill="none" stroke="#fde047" stroke-width="2"/>`],
  }[line][f] || '';
  P.push(A);
  if (g === 'w' && !(line === 'cat' && f >= 1) && !(line === 'frog' && f >= 2)) P.push(`<g transform="translate(${line === 'frog' ? 72 : 76} ${hy - headR + (line === 'owl' ? 6 : 2)}) rotate(15)" fill="#ec4899" stroke="#9d174d" stroke-width="1.5"><path d="M0 0L-10 -6L-10 6Z"/><path d="M0 0L10 -6L10 6Z"/><circle r="3"/></g>`);
  if (f === 3) P.push(`<g fill="#fde68a">${[[14, 30], [106, 26], [18, 70], [104, 74]].map(([x, y]) => `<path d="M${x} ${y - 5}l1.6 3.4 3.4 1.6-3.4 1.6-1.6 3.4-1.6-3.4-3.4-1.6 3.4-1.6z"/>`).join('')}</g>`);
  return `<svg class="charsvg" viewBox="0 0 120 120" role="img" aria-label="${esc(C.forms[f])}"><defs><radialGradient id="${id}h" cx="38%" cy="32%" r="80%"><stop offset="0" stop-color="${light}"/><stop offset=".5" stop-color="${main}"/><stop offset="1" stop-color="${dark}"/></radialGradient></defs>${P.join('')}</svg>`;
}

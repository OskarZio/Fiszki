'use strict';
/* Dźwięki naklejek – syntezowane w przeglądarce (Web Audio), bez plików audio.
   Każda naklejka ma swój dźwięk (koza beczy, puchar gra fanfarę zwycięstwa…), pozostałe – dzwonek
   zależny od rzadkości. Grają przy wysłaniu naklejki w bitwie, prezencie, losowaniu i podglądzie w albumie. */

let fxCtx;
// iPhone: dźwięk ma grać także przy przełączniku wyciszenia (jak w grach), a kontekst audio
// trzeba „odblokować” pierwszym dotknięciem ekranu.
try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* */ }
function fxCtxGet() {
  if (S.settings.sound === false) return null;
  try {
    fxCtx = fxCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (fxCtx.state !== 'running') fxCtx.resume();
    return fxCtx;
  } catch { return null; }
}
const fxAudio = () => S.settings.stickerSound === false ? null : fxCtxGet();
function fxUnlock() {
  const ac = fxCtxGet(); if (!ac) return;
  try { const b = ac.createBuffer(1, 1, 22050), s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(0); } catch { /* */ }
  if (ac.state === 'running') ['touchend', 'pointerup', 'keydown'].forEach(e => document.removeEventListener(e, fxUnlock, true));
}
['touchend', 'pointerup', 'keydown'].forEach(e => document.addEventListener(e, fxUnlock, true));

// ---------- dźwięki skrzynek
const CASE_SFX = {
  open: () => { const ac = fxCtxGet(); if (!ac) return;            // zamek + rozpęd
    fxNoise(ac, { d: .08, f: 2500, q: 2, v: .25 }); fxTone(ac, { f: 220, f2: 330, type: 'square', t: .05, d: .09, v: .07 });
    fxNoise(ac, { t: .12, d: .6, f: 400, f2: 2400, q: 2, v: .12 }); },
  tick: (i = 0) => { const ac = fxCtxGet(); if (!ac) return;       // „klik” ruletki – drewniany stuk z lekkim dzwonkiem
    fxNoise(ac, { d: .025, f: 3200, q: 5, v: .35 }); fxTone(ac, { f: 1500 + (i % 3) * 120, f2: 900, type: 'triangle', d: .05, v: .07 }); },
  reveal: r => { const ac = fxCtxGet(); if (!ac) return;
    fxTone(ac, { f: 160, f2: 60, d: .35, v: .25 }); fxNoise(ac, { d: .3, f: 900, f2: 200, type: 'lowpass', v: .2 });   // „bum” otwarcia
    if (r === 'legendary') { FX.fanfare(ac, .15); setTimeout(() => FX.sparkle(ac), 900); setTimeout(() => FX.sparkle(ac), 1300); }
    else if (r === 'epic') { fxNotes(ac, [523, 659, 784, 1047, 1319], { t: .12, step: .09, type: 'triangle', v: .12, last: .7 }); setTimeout(() => FX.sparkle(ac), 500); }
    else if (r === 'rare') fxNotes(ac, [587, 784, 988, 1175], { t: .12, step: .09, type: 'triangle', v: .12, last: .55 });
    else fxNotes(ac, [659, 880, 1047], { t: .12, step: .09, type: 'sine', v: .14, last: .45 });
  },
};
// jeden ton: częstotliwość (z poślizgiem f→f2), obwiednia, vibrato, tremolo i filtr
function fxTone(ac, { f = 440, f2, type = 'sine', t = 0, d = .2, v = .14, vib = 0, vibF = 6, trem = 0, tremF = 18, filt, q = 1 }) {
  const t0 = ac.currentTime + t, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + .015); g.gain.exponentialRampToValueAtTime(.0001, t0 + d);
  let node = o;
  if (vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = vibF; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + d); }
  if (filt) { const b = ac.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = filt; b.Q.value = q; node.connect(b); node = b; }
  if (trem) {
    const tg = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain();
    tg.gain.value = 1 - trem / 2; l.frequency.value = tremF; lg.gain.value = trem / 2; l.connect(lg); lg.connect(tg.gain);
    node.connect(tg); node = tg; l.start(t0); l.stop(t0 + d);
  }
  node.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + d + .02);
}
function fxNoise(ac, { t = 0, d = .2, v = .12, f = 1000, f2, q = 1, type = 'bandpass' }) {
  const t0 = ac.currentTime + t, n = Math.ceil(ac.sampleRate * d), buf = ac.createBuffer(1, n, ac.sampleRate), data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(), b = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = buf; b.type = type; b.frequency.setValueAtTime(f, t0); if (f2) b.frequency.exponentialRampToValueAtTime(f2, t0 + d); b.Q.value = q;
  g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + d);
  s.connect(b); b.connect(g); g.connect(ac.destination); s.start(t0); s.stop(t0 + d);
}
const fxNotes = (ac, notes, { step = .11, type = 'triangle', v = .12, last = .45, t = 0 } = {}) =>
  notes.forEach((f, i) => fxTone(ac, { f, type, v, t: t + i * step, d: i === notes.length - 1 ? last : step * 1.6 }));

const FX = {
  // „Meeeee” – piłokształtny ton z drżeniem i formantem
  bleat: (ac, t = 0) => {
    fxTone(ac, { f: 620, f2: 500, type: 'sawtooth', t, d: .7, v: .16, vib: 30, vibF: 7, trem: .9, tremF: 16, filt: 1250, q: 2.2 });
    fxTone(ac, { f: 310, f2: 250, type: 'sawtooth', t, d: .7, v: .07, trem: .9, tremF: 16, filt: 700, q: 2 });
  },
  fanfare: (ac, t = 0) => {
    fxNotes(ac, [523, 659, 784], { t, step: .12, type: 'square', v: .06, last: .14 });
    fxNotes(ac, [1047, 988, 1047], { t: t + .38, step: .1, type: 'square', v: .07, last: .6 });
    fxNotes(ac, [262, 330, 392, 523], { t, step: .12, type: 'triangle', v: .1, last: .9 });
  },
  pop: (ac, t = 0) => fxTone(ac, { f: 500, f2: 1100, t, d: .09, v: .2 }),
  chime: (ac, n = 3) => fxNotes(ac, [784, 988, 1175, 1568, 1976, 2349].slice(0, n), { step: .08, type: 'sine', v: .12, last: .5 }),
  sparkle: ac => { for (let i = 0; i < 7; i++) fxTone(ac, { f: 1800 + Math.random() * 1600, t: i * .06, d: .18, v: .06 }); },
  whoosh: ac => { fxNoise(ac, { d: .9, f: 300, f2: 3000, q: 3, v: .2 }); fxTone(ac, { f: 180, f2: 1400, type: 'sawtooth', d: .9, v: .04 }); },
  zap: ac => { fxTone(ac, { f: 1600, f2: 90, type: 'sawtooth', d: .28, v: .1 }); fxNoise(ac, { d: .12, f: 4000, v: .08 }); },
  fire: ac => { fxNoise(ac, { d: .9, f: 500, f2: 200, type: 'lowpass', v: .25 }); fxNoise(ac, { t: .1, d: .5, f: 2500, q: 4, v: .05 }); },
  clap: ac => { for (let i = 0; i < 4; i++) fxNoise(ac, { t: i * .13, d: .07, f: 1500, q: .8, v: .3 }); },
  snore: ac => { fxTone(ac, { f: 95, f2: 80, type: 'sawtooth', d: .9, v: .1, trem: 1, tremF: 30, filt: 450, q: 1.5 }); fxTone(ac, { f: 700, f2: 1200, t: 1, d: .25, v: .04 }); },
  hmm: ac => fxTone(ac, { f: 170, f2: 150, type: 'triangle', d: .7, v: .16, vib: 8, vibF: 4 }),
  hoot: ac => { fxTone(ac, { f: 420, f2: 380, d: .25, v: .14, filt: 450, q: 3 }); fxTone(ac, { f: 400, f2: 350, t: .32, d: .45, v: .14, filt: 420, q: 3 }); },
  growl: ac => { fxTone(ac, { f: 110, f2: 60, type: 'sawtooth', d: 1, v: .14, trem: .8, tremF: 22, filt: 380, q: 1.2 }); fxNoise(ac, { d: 1, f: 300, type: 'lowpass', v: .12 }); },
  hey: ac => { fxTone(ac, { f: 440, f2: 520, type: 'triangle', d: .14, v: .14 }); fxTone(ac, { f: 660, f2: 760, type: 'triangle', t: .16, d: .22, v: .14 }); },
  boom: ac => { fxTone(ac, { f: 120, f2: 40, d: .8, v: .3 }); fxNoise(ac, { d: .8, f: 600, f2: 80, type: 'lowpass', v: .3 }); },
};
const STICKER_SFX = {
  goat: ac => { FX.bleat(ac); FX.fanfare(ac, .8); },          // GOAT = beczenie + fanfara zwycięstwa
  trophy: ac => FX.fanfare(ac), crown: ac => FX.fanfare(ac),
  clap: ac => FX.clap(ac), party: ac => { FX.clap(ac); FX.sparkle(ac); },
  rocket: ac => FX.whoosh(ac), comet: ac => { FX.whoosh(ac); FX.sparkle(ac); },
  zap: ac => FX.zap(ac), mind: ac => FX.boom(ac), volcano: ac => FX.boom(ac), fire: ac => FX.fire(ac),
  sleepy: ac => FX.snore(ac), think: ac => FX.hmm(ac), owl: ac => FX.hoot(ac), dragon: ac => FX.growl(ac),
  wave: ac => FX.hey(ac), unicorn: ac => FX.sparkle(ac), galaxy: ac => { FX.sparkle(ac); FX.chime(ac, 6); }, gem: ac => FX.sparkle(ac),
};
const RARITY_NOTES = { common: 2, rare: 3, epic: 4, legendary: 6 };
function playStickerSound(id, shiny) {
  const s = stickerById(id), ac = fxAudio(); if (!s || !ac) return;
  try {
    (STICKER_SFX[id] || (a => { FX.pop(a); FX.chime(a, RARITY_NOTES[s.r]); }))(ac);
    if (shiny) setTimeout(() => FX.sparkle(ac), 300);
  } catch (e) { console.warn(e); }
}

// każde wyświetlenie latającej naklejki (bitwa, prezent, podgląd) gra jej dźwięk
const fxStickerFx0 = stickerFx;
stickerFx = function (k, from, shiny) { fxStickerFx0(k, from, shiny); playStickerSound(k, shiny); };

Object.assign(ACTIONS, {
  'st-preview': el => stickerFx(el.dataset.id, 'Podgląd', isShiny(el.dataset.id)),
});

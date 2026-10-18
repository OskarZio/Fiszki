'use strict';
/* 🏆 Liga tygodnia: Ty + znajomi, punkty = powtórki od poniedziałku do niedzieli.
   Po zakończeniu tygodnia podium dostaje kryształy (raz, id tygodnia – bez dublowania między urządzeniami).
   Dane znajomych: perDay z ich profilu (ostatnie 14 dni), więc wynik poprzedniego tygodnia też da się policzyć. */

const LEAGUE_PRIZE = [50, 30, 15];
const weekStart = (t = Date.now()) => { const d = new Date(dayStart(t)), dow = (d.getDay() + 6) % 7; return addDays(d.getTime(), -dow); };   // poniedziałek
const weekKeyOf = t => dayKey(weekStart(t));
const weekDays = ws => Array.from({ length: 7 }, (_, i) => dayKey(addDays(ws, i)));
function leaguePeople() {
  const me = { me: true, nick: S.profile.nick || 'Ty', avatar: S.profile.avatar || '🦊', avatarImg: S.profile.avatarImg, perDay: myProfile().perDay };
  let fr = [];
  if (typeof cloudOn === 'function' && cloudOn()) fr = (CLOUD_FRIENDS || []).map(p => ({ id: p.id, nick: p.nick || 'Znajomy', avatar: p.avatar, avatarImg: p.avatar_img, perDay: p.stats?.perDay || {} }));
  else fr = (S.friends || []).map(f => FRIEND_DATA[f.code]).filter(x => x?.app).map(p => ({ nick: p.nick, avatar: p.avatar, avatarImg: p.avatarImg, perDay: p.perDay || {} }));
  return [me, ...fr];
}
function leagueTable(ws) {
  const days = weekDays(ws);
  return leaguePeople().map(p => ({ ...p, pts: days.reduce((a, k) => a + (+p.perDay?.[k] || 0), 0) }))
    .sort((a, b) => b.pts - a.pts || (b.me ? 1 : 0) - (a.me ? 1 : 0));
}
// nagroda za poprzedni tydzień (gdy było min. 2 grających z punktami)
function leagueAward() {
  const prev = addDays(weekStart(), -7), key = dayKey(prev);
  // raz na tydzień: znacznik albo już wypłacona nagroda (synchronizacja z innym urządzeniem)
  if (S.stats.leagueDone === key || (typeof S.stats.leagueDone === 'string' && S.stats.leagueDone > key)) return;
  if (S.wallet.some(w => w.id === 'league-' + key)) { S.stats.leagueDone = key; save(); return; }
  const people = leaguePeople(); if (people.length < 2) return;
  const tab = leagueTable(prev).filter(r => r.pts > 0);
  S.stats.leagueDone = key;
  const place = tab.findIndex(r => r.me);
  if (tab.length >= 2 && place >= 0 && place < 3) {
    const n = LEAGUE_PRIZE[place], id = 'league-' + key;
    if (!S.wallet.some(w => w.id === id)) S.wallet.push({ id, n, why: 'league', t: Date.now() });
    S.stats.leagueStreak = (S.stats.leagueLast === dayKey(addDays(prev, -7)) ? S.stats.leagueStreak || 0 : 0) + 1; S.stats.leagueLast = key;
    S.stats.leaguePodiums = (S.stats.leaguePodiums || 0) + 1;
    setTimeout(() => { celebrate(`🏆 Liga: ${['🥇 1.', '🥈 2.', '🥉 3.'][place]} miejsce w zeszłym tygodniu!`, `+${n} 💎${S.stats.leagueStreak > 1 ? ` · seria podium: ${S.stats.leagueStreak} tyg.` : ''}`); confetti(140); }, 700);
  }
  save();
}
function leagueCardHTML() {
  const ws = weekStart(), tab = leagueTable(ws), end = addDays(ws, 7) - Date.now();
  const dd = Math.floor(end / DAY), hh = Math.floor(end % DAY / HOUR);
  const prev = leagueTable(addDays(ws, -7)).filter(r => r.pts > 0).slice(0, 3);
  const solo = tab.length < 2;
  return `<div class="card league"><div class="row nowrap"><h2 class="grow" style="margin:0">🏆 Liga tygodnia</h2><span class="small muted">koniec za ${dd ? dd + ' d ' : ''}${hh} h</span></div>
    <p class="small muted" style="margin:4px 0 8px">Punkty = powtórki od poniedziałku. W niedzielę o północy podium dostaje ${LEAGUE_PRIZE.join(' / ')} 💎${S.stats.leagueStreak > 1 ? ` · Twoja seria podium: <b>${S.stats.leagueStreak} tyg.</b>` : ''}</p>
    ${solo ? '<p class="small">Dodaj znajomych (kod albo zaproszenie), żeby rywalizować w lidze.</p>' : tab.map((r, i) => `<div class="lg-row${r.me ? ' me' : ''}"><span class="lg-pl">${i < 3 && r.pts ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
      <span class="av">${avatarHTML({ avatar: r.avatar, avatarImg: r.avatarImg }, 30)}</span><b class="grow nm">${esc(r.nick)}${r.me ? ' (Ty)' : ''}</b><span class="lg-pts">${r.pts}</span></div>`).join('')}
    ${prev.length >= 2 ? `<p class="small muted" style="margin:8px 0 0">Zeszły tydzień: ${prev.map((r, i) => `${['🥇', '🥈', '🥉'][i]} ${esc(r.nick)} (${r.pts})`).join(' · ')}</p>` : ''}</div>`;
}
const lgRank0 = ROUTES.rank;
ROUTES.rank = (...a) => {
  const v = lgRank0(...a); if (!v?.html) return v;
  try { leagueAward(); } catch (e) { console.warn(e); }
  const i = v.html.indexOf('</div>');   // po nagłówku
  return { ...v, html: i < 0 ? leagueCardHTML() + v.html : v.html.slice(0, i + 6) + leagueCardHTML() + v.html.slice(i + 6) };
};
on('start', () => setTimeout(() => { try { leagueAward(); } catch { /* */ } }, 6000));

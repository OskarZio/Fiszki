// 🔔 Fiszki – codzienne przypomnienia o nauce (Supabase Edge Function, uruchamiana co godzinę przez Cron).
// Wysyła powiadomienie push osobom, u których właśnie wybiła wybrana godzina, a dziś jeszcze się nie uczyły.
// Sekrety (Edge Functions → Secrets): VAPID_PRIVATE (klucz prywatny), CRON_SECRET (dowolne hasło do wywołania).
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const VAPID_PUBLIC = 'BL86moOlxbzfbM8uTWhxDDGjINtHnjilrUBci4Y5GgfEljd3uSr0v1HUHhPuptkVDiDvUEYE5eeyWN_UDpt6th4';
const APP = 'https://oskarzio.github.io/Fiszki/';

// lokalna data i godzina w strefie użytkownika
function local(tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: +p.hour };
}
// teksty jak w aplikacjach do nauki języków – krótko, z serią dni i bossem
function message(streak: number, nick: string) {
  const n = nick ? `, ${nick}` : '';
  const withStreak = [
    { title: `🔥 ${streak} ${streak === 1 ? 'dzień' : 'dni'} z rzędu!`, body: `Nie przerywaj serii${n} – 5 minut fiszek wystarczy.` },
    { title: '⏳ Twoja seria czeka', body: `${streak} dni nauki pod rząd. Jedna sesja dziś i seria trwa dalej.` },
  ];
  const plain = [
    { title: '📚 Czas na fiszki', body: `Kilka powtórek dziennie robi różnicę${n}. Zajrzyj na chwilę!` },
    { title: '⚔️ Boss się nudzi', body: 'Twoje fiszki czekają na powtórkę – a boss na rewanż.' },
    { title: '🧠 Szybka powtórka?', body: '5 minut teraz = mniej nauki przed kolokwium.' },
  ];
  const L = streak > 0 ? withStreak : plain;
  return L[Math.floor(Math.random() * L.length)];
}

Deno.serve(async req => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return new Response('forbidden', { status: 403 });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  webpush.setVapidDetails(APP, VAPID_PUBLIC, Deno.env.get('VAPID_PRIVATE')!);
  const { data: subs, error } = await db.from('push_subs').select('*');
  if (error) return new Response(error.message, { status: 500 });
  let sent = 0, gone = 0;
  for (const s of subs ?? []) {
    let L; try { L = local(s.tz || 'Europe/Warsaw'); } catch { L = local('Europe/Warsaw'); }
    if (L.hour !== s.hour || s.last_sent === L.day) continue;
    const { data: p } = await db.from('profiles').select('nick,stats').eq('id', s.user_id).maybeSingle();
    const st = p?.stats ?? {}, studied = (st.day === L.day && st.today > 0) || (st.perDay?.[L.day] ?? 0) > 0;
    await db.from('push_subs').update({ last_sent: L.day }).eq('endpoint', s.endpoint);
    if (studied) continue;
    const m = message(st.streak ?? 0, p?.nick ?? '');
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...m, url: '#/', tag: 'remind' }), { TTL: 3600 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { await db.from('push_subs').delete().eq('endpoint', s.endpoint); gone++; }
    }
  }
  return Response.json({ sent, gone });
});

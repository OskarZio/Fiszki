# Przypomnienia o nauce (push) – jak włączyć

Aplikacja ma już przycisk **Ustawienia → 🔔 Przypomnienia o nauce**. Żeby powiadomienia faktycznie przychodziły, trzeba raz ustawić serwer w Supabase (ok. 10 minut).

## 1. Baza
SQL Editor → wklej cały `supabase.sql` → **Run** (wersja bazy `2026-11-08a`, dochodzi tabela `push_subs`).

## 2. Sekrety funkcji
Dashboard → **Edge Functions → Secrets** → dodaj:
- `VAPID_PRIVATE` – klucz prywatny VAPID (dostałeś go w czacie – **nie wklejaj go nigdzie indziej**, nie trafia do GitHuba),
- `CRON_SECRET` – dowolne długie hasło (np. wygenerowane w menedżerze haseł).

## 3. Wgranie funkcji
Najprościej w przeglądarce: **Edge Functions → Deploy a new function → Via Editor**, nazwa `reminders`, wklej zawartość pliku `supabase/functions/reminders/index.ts` → **Deploy**.
(Albo z komputera: `supabase functions deploy reminders`.)
W ustawieniach funkcji wyłącz **Enforce JWT verification** (funkcję chroni `CRON_SECRET`).

## 4. Uruchamianie co godzinę
**Integrations → Cron → Create job**:
- nazwa: `fiszki-reminders`, harmonogram: `5 * * * *` (co godzinę, 5 minut po pełnej),
- typ: **Supabase Edge Function** → `reminders`, metoda POST,
- nagłówek: `x-cron-secret` = to samo hasło co w `CRON_SECRET`.

## 5. Na telefonie
- **iPhone (iOS 16.4+):** otwórz aplikację w Safari → Udostępnij → **Do ekranu początkowego**, uruchom ją z ikony, potem Ustawienia → 🔔 Włącz przypomnienia.
- **Android / komputer:** Ustawienia → 🔔 Włącz przypomnienia i zezwól na powiadomienia.

Powiadomienie przychodzi raz dziennie o wybranej godzinie i tylko wtedy, gdy danego dnia nie było jeszcze nauki.

# Konta, ranking i bitwy przez Supabase

Supabase to darmowa baza danych z logowaniem. Po podłączeniu:
- każdy loguje się e-mailem i hasłem, a fiszki są zapisane na koncie (dostępne na każdym urządzeniu),
- w **Rankingu** dodajesz znajomych kodem i widzisz ich wyniki,
- bitwy idą przez Supabase Realtime (pewniej niż publiczny przekaźnik).

## Podłączenie (ok. 5 minut, robi to tylko host)

1. Wejdź na **https://supabase.com/dashboard** i załóż konto (najprościej „Continue with GitHub”).
2. **New project** → nazwa np. `fiszki`, wymyśl i zapisz hasło do bazy, region **Central EU (Frankfurt)** → **Create new project**. Poczekaj ok. 2 minuty.
3. Po lewej **SQL Editor** → **New query** → wklej całą zawartość pliku [`supabase.sql`](supabase.sql) → **Run**. Ma się pojawić „Success. No rows returned”.
4. Po lewej **Authentication → Sign In / Providers → Email** – zostaw włączone.
   Dla prostszego startu wyłącz **Confirm email** (konto działa od razu). Jeśli zostawisz włączone, po rejestracji trzeba kliknąć link w mailu.
5. **Project Settings → API** (albo **API Keys**): skopiuj
   - **Project URL** – np. `https://abcdefgh.supabase.co`,
   - klucz **anon** / **publishable** (publiczny z założenia – dane chronią reguły w bazie).
   ⚠️ Nigdy nie wklejaj klucza **service_role / secret**.
6. W aplikacji: **Więcej → 🔑 Panel hosta** (kod hosta) → sekcja **Supabase** → wklej URL i klucz → **Zapisz dla wszystkich**.
   (Do zapisu dla wszystkich potrzebny jest ten sam token GitHub co przy GIF-ach.)
7. Po 1–2 minutach każdy użytkownik zobaczy w **Więcej** kartę **☁️ Konto** → **Załóż konto** / **Zaloguj**.
8. Znajomi: **Ranking → Twój kod** → wyślij koledze („Zaproś znajomego”), a on wpisuje go w polu „Kod znajomego”. Żeby widzieć się nawzajem, dodajcie się oboje.

## Drugi projekt
Ten sam projekt Supabase może obsłużyć kolejną aplikację (np. mierzenie parametrów): wspólne konta, osobne tabele.

-- 1) Najpierw wklej i uruchom cały plik supabase.sql (Run).
-- 2) Potem wklej TO zapytanie. Zamień TWOJ@EMAIL na e-mail, którym logujesz się w aplikacji Fiszki
--    (ten sam, co w Ustawienia → Konto). Zostaw apostrofy ' ' dookoła.
delete from public.app_admins;
insert into public.app_admins select id from auth.users where email = 'TWOJ@EMAIL';
-- 3) Sprawdzenie – powinien pokazać się Twój e-mail:
select u.email from public.app_admins a join auth.users u on u.id = a.user_id;

-- 1) Kto ma dostęp do Panelu hosta (lista adminów)
select p.nick, p.code, u.email from public.app_admins a
  join auth.users u on u.id = a.user_id left join public.profiles p on p.id = a.user_id;

-- 2) Zabierz dostęp kumaczowi (każdemu kontu z „kumacz” w nicku, oprócz Twojego maila)
delete from public.app_admins
 where user_id in (select id from public.profiles where lower(nick) like '%kumacz%')
   and user_id not in (select id from auth.users where lower(email) = lower('TWÓJ_MAIL@gmail.com'));

-- 3) Sprawdź jeszcze raz – powinien zostać tylko Twój mail
select p.nick, u.email from public.app_admins a
  join auth.users u on u.id = a.user_id left join public.profiles p on p.id = a.user_id;

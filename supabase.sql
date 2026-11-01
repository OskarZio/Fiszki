-- ============================================================
-- Fiszki – baza danych Supabase
-- Wklej całość w Supabase: SQL Editor → New query → Run.
-- Skrypt można uruchomić ponownie (nie usuwa danych).
-- ============================================================

-- Profil gracza: nick, awatar, statystyki do rankingu, kod znajomego
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  code text unique not null default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  nick text,
  avatar text,
  avatar_img text,
  stats jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profile_read" on public.profiles;
drop policy if exists "profile_insert" on public.profiles;
drop policy if exists "profile_update" on public.profiles;
-- profile (nick + liczby) widzą zalogowani – potrzebne do rankingu znajomych
create policy "profile_read" on public.profiles for select to authenticated using (true);
create policy "profile_insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profile_update" on public.profiles for update to authenticated using (auth.uid() = id);

-- Wszystkie fiszki, talie, postęp itd. – tylko dla właściciela
create table if not exists public.user_data (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.user_data enable row level security;
drop policy if exists "data_own" on public.user_data;
create policy "data_own" on public.user_data for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Obrazy z fiszek (osobno, żeby nie przesyłać ich przy każdej synchronizacji)
create table if not exists public.user_images (
  user_id uuid not null references auth.users on delete cascade,
  id text not null,
  data text not null,
  primary key (user_id, id)
);
alter table public.user_images enable row level security;
drop policy if exists "images_own" on public.user_images;
create policy "images_own" on public.user_images for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Znajomi (kogo obserwujesz w rankingu)
create table if not exists public.friends (
  user_id uuid not null references auth.users on delete cascade,
  friend_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);
alter table public.friends enable row level security;
-- Znajomość jest obustronna: jeśli A doda B, to oboje widzą się w rankingu,
-- a każde z nich może ją usunąć.
drop policy if exists "friends_own" on public.friends;
drop policy if exists "friends_read" on public.friends;
drop policy if exists "friends_insert" on public.friends;
drop policy if exists "friends_delete" on public.friends;
create policy "friends_read" on public.friends for select to authenticated using (auth.uid() in (user_id, friend_id));
create policy "friends_insert" on public.friends for insert to authenticated with check (auth.uid() = user_id);
create policy "friends_delete" on public.friends for delete to authenticated using (auth.uid() in (user_id, friend_id));

-- Wiadomości między znajomymi: czat, prezenty (naklejki), przypomnienia o nauce, wyzwania na bitwę
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  from_id uuid not null default auth.uid() references auth.users on delete cascade,
  to_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('text', 'gift', 'nudge', 'challenge')),
  body jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists messages_to_idx on public.messages (to_id, created_at desc);
create index if not exists messages_from_idx on public.messages (from_id, created_at desc);
alter table public.messages enable row level security;
drop policy if exists "msg_read" on public.messages;
drop policy if exists "msg_send" on public.messages;
drop policy if exists "msg_mark" on public.messages;
drop policy if exists "msg_delete" on public.messages;
-- widzisz tylko swoje rozmowy
create policy "msg_read" on public.messages for select to authenticated using (auth.uid() in (from_id, to_id));
-- pisać można tylko do znajomych (w dowolną stronę znajomości), wiadomość max ~2 kB
create policy "msg_send" on public.messages for insert to authenticated with check (
  auth.uid() = from_id and to_id <> from_id and length(body::text) < 2000 and exists (
    select 1 from public.friends f
    where (f.user_id = auth.uid() and f.friend_id = to_id) or (f.user_id = to_id and f.friend_id = auth.uid())));
-- odbiorca może tylko oznaczyć wiadomość jako przeczytaną
create policy "msg_mark" on public.messages for update to authenticated using (auth.uid() = to_id) with check (auth.uid() = to_id);
revoke update on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;
create policy "msg_delete" on public.messages for delete to authenticated using (auth.uid() in (from_id, to_id));
-- powiadomienia na żywo (Realtime)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ============================================================
-- 🔒 ZABEZPIECZENIA (RODO + ochrona przed nadużyciami) – wersja 2026-10-20
-- Bezpiecznie uruchomić ponownie. Ograniczenia „not valid” nie sprawdzają starych wierszy, tylko nowe zapisy.
-- ============================================================

-- Limity rozmiarów (ochrona przed zapchaniem bazy / spowolnieniem innych)
alter table public.profiles drop constraint if exists p_nick, drop constraint if exists p_av, drop constraint if exists p_img, drop constraint if exists p_stats, drop constraint if exists p_upd;
alter table public.profiles
  add constraint p_nick check (nick is null or char_length(nick) <= 24) not valid,
  add constraint p_av check (avatar is null or char_length(avatar) <= 16) not valid,
  add constraint p_img check (avatar_img is null or avatar_img = '' or (octet_length(avatar_img) < 120000 and avatar_img ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$')) not valid,
  add constraint p_stats check (pg_column_size(stats) < 30000) not valid,
  add constraint p_upd check (updated_at <= now() + interval '5 minutes') not valid;
alter table public.user_data drop constraint if exists d_size;
alter table public.user_data add constraint d_size check (pg_column_size(data) < 8000000) not valid;
alter table public.user_images drop constraint if exists i_size;
alter table public.user_images add constraint i_size check (octet_length(data) < 3000000 and char_length(id) <= 64) not valid;
alter table public.friends drop constraint if exists f_self;
alter table public.friends add constraint f_self check (user_id <> friend_id) not valid;

-- Profil: kodu znajomego i id nie da się zmienić; data aktualizacji zawsze z serwera
create or replace function public.profile_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then new.id := old.id; new.code := old.code; end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists profile_guard on public.profiles;
create trigger profile_guard before insert or update on public.profiles for each row execute function public.profile_guard();

-- Profil widzą: właściciel, znajomi i – tylko jeśli ktoś sam włączył ranking wszystkich – inni zalogowani (RODO art. 25)
drop policy if exists "profile_read" on public.profiles;
create policy "profile_read" on public.profiles for select to authenticated using (
  id = auth.uid()
  or (stats ->> 'showGlobal') = '1'
  or exists (select 1 from public.friends f where (f.user_id = auth.uid() and f.friend_id = profiles.id) or (f.friend_id = auth.uid() and f.user_id = profiles.id)));
drop policy if exists "profile_delete" on public.profiles;
create policy "profile_delete" on public.profiles for delete to authenticated using (auth.uid() = id);

-- Dodawanie znajomego tylko przez znajomość kodu (funkcja), z limitem 30 na godzinę
create or replace function public.find_profile(p_code text) returns table (id uuid, nick text, avatar text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nick, p.avatar from public.profiles p where p.code = upper(trim(p_code)) and auth.uid() is not null limit 1;
$$;
create or replace function public.add_friend(p_code text) returns uuid language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select p.id into target from public.profiles p where p.code = upper(trim(p_code));
  if target is null then raise exception 'not found'; end if;
  if target = auth.uid() then raise exception 'self'; end if;
  if (select count(*) from public.friends where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 30 then raise exception 'rate limit'; end if;
  insert into public.friends (user_id, friend_id) values (auth.uid(), target) on conflict do nothing;
  return target;
end $$;
revoke all on function public.find_profile(text) from public, anon;
revoke all on function public.add_friend(text) from public, anon;
grant execute on function public.find_profile(text) to authenticated;
grant execute on function public.add_friend(text) to authenticated;
revoke insert on public.friends from authenticated;

-- Wiadomości: limit 30 na minutę, czas i „przeczytane” ustawia serwer
create or replace function public.msg_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.messages where from_id = new.from_id and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate limit';
  end if;
  new.created_at := now(); new.read_at := null;
  return new;
end $$;
drop trigger if exists msg_guard on public.messages;
create trigger msg_guard before insert on public.messages for each row execute function public.msg_guard();

-- RODO art. 17: użytkownik usuwa swoje konto sam (kaskadowo znikają profil, dane, obrazy, znajomi i wiadomości)
create or replace function public.delete_my_account() returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 🏫 Klasy: wspólne zestawy fiszek i czat grupowy. Klasę widzą tylko jej członkowie (dołączenie kodem przez join_class).
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  owner uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now());
create table if not exists public.class_members (
  class_id uuid not null references public.classes on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  nick text not null default 'Gracz',
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id));
create table if not exists public.class_decks (
  id text primary key,
  class_id uuid not null references public.classes on delete cascade,
  owner uuid not null references auth.users on delete cascade,
  nick text not null default 'Gracz',
  name text not null,
  notes jsonb not null default '[]'::jsonb,
  n int not null default 0,
  updated_at timestamptz not null default now());
create table if not exists public.class_msgs (
  id bigint generated always as identity primary key,
  class_id uuid not null references public.classes on delete cascade,
  from_id uuid not null references auth.users on delete cascade,
  nick text not null default 'Gracz',
  body text not null,
  created_at timestamptz not null default now());
create index if not exists class_msgs_cls on public.class_msgs (class_id, id desc);
create index if not exists class_decks_cls on public.class_decks (class_id);
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.class_decks enable row level security;
alter table public.class_msgs enable row level security;
alter table public.classes drop constraint if exists cls_chk;
alter table public.classes add constraint cls_chk check (code ~ '^[A-Z0-9]{6}$' and char_length(name) between 1 and 60) not valid;
alter table public.class_members drop constraint if exists clm_chk;
alter table public.class_members add constraint clm_chk check (char_length(nick) <= 24) not valid;
alter table public.class_decks drop constraint if exists cld_chk;
alter table public.class_decks add constraint cld_chk check (char_length(name) between 1 and 80 and char_length(id) <= 120 and pg_column_size(notes) < 3000000) not valid;
alter table public.class_msgs drop constraint if exists clmsg_chk;
alter table public.class_msgs add constraint clmsg_chk check (char_length(body) between 1 and 1000 and char_length(nick) <= 24) not valid;

create or replace function public.is_class_member(p uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.class_members m where m.class_id = p and m.user_id = auth.uid());
$$;
revoke all on function public.is_class_member(uuid) from public, anon;
grant execute on function public.is_class_member(uuid) to authenticated;
create or replace function public.is_class_owner(p uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.classes c where c.id = p and c.owner = auth.uid());
$$;
revoke all on function public.is_class_owner(uuid) from public, anon;
grant execute on function public.is_class_owner(uuid) to authenticated;

drop policy if exists "cls_read" on public.classes;
drop policy if exists "cls_insert" on public.classes;
drop policy if exists "cls_update" on public.classes;
drop policy if exists "cls_delete" on public.classes;
create policy "cls_read" on public.classes for select to authenticated using (owner = auth.uid() or public.is_class_member(id));
create policy "cls_insert" on public.classes for insert to authenticated with check (owner = auth.uid());
create policy "cls_update" on public.classes for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "cls_delete" on public.classes for delete to authenticated using (owner = auth.uid());
drop policy if exists "clm_read" on public.class_members;
drop policy if exists "clm_insert" on public.class_members;
drop policy if exists "clm_update" on public.class_members;
drop policy if exists "clm_delete" on public.class_members;
create policy "clm_read" on public.class_members for select to authenticated using (public.is_class_member(class_id) or public.is_class_owner(class_id));
-- sam wpisuje się tylko właściciel (przy zakładaniu); reszta dołącza funkcją join_class (kodem)
create policy "clm_insert" on public.class_members for insert to authenticated with check (user_id = auth.uid() and public.is_class_owner(class_id));
create policy "clm_update" on public.class_members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "clm_delete" on public.class_members for delete to authenticated using (user_id = auth.uid() or public.is_class_owner(class_id));
drop policy if exists "cld_read" on public.class_decks;
drop policy if exists "cld_insert" on public.class_decks;
drop policy if exists "cld_update" on public.class_decks;
drop policy if exists "cld_delete" on public.class_decks;
create policy "cld_read" on public.class_decks for select to authenticated using (public.is_class_member(class_id));
create policy "cld_insert" on public.class_decks for insert to authenticated with check (owner = auth.uid() and public.is_class_member(class_id));
create policy "cld_update" on public.class_decks for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid() and public.is_class_member(class_id));
create policy "cld_delete" on public.class_decks for delete to authenticated using (owner = auth.uid() or public.is_class_owner(class_id));
drop policy if exists "clmsg_read" on public.class_msgs;
drop policy if exists "clmsg_insert" on public.class_msgs;
drop policy if exists "clmsg_delete" on public.class_msgs;
create policy "clmsg_read" on public.class_msgs for select to authenticated using (public.is_class_member(class_id));
create policy "clmsg_insert" on public.class_msgs for insert to authenticated with check (from_id = auth.uid() and public.is_class_member(class_id));
create policy "clmsg_delete" on public.class_msgs for delete to authenticated using (from_id = auth.uid() or public.is_class_owner(class_id));
revoke update on public.class_msgs from authenticated;

-- dołączenie do klasy kodem (max 200 osób w klasie)
create or replace function public.join_class(p_code text, p_nick text) returns uuid language plpgsql security definer set search_path = '' as $$
declare c uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id into c from public.classes where code = upper(trim(p_code));
  if c is null then return null; end if;
  if (select count(*) from public.class_members where class_id = c) >= 200 then raise exception 'class full'; end if;
  insert into public.class_members (class_id, user_id, nick) values (c, auth.uid(), left(coalesce(nullif(trim(p_nick), ''), 'Gracz'), 24))
    on conflict (class_id, user_id) do update set nick = excluded.nick;
  return c;
end $$;
revoke all on function public.join_class(text, text) from public, anon;
grant execute on function public.join_class(text, text) to authenticated;
-- limity: 20 klas na osobę, 30 wiadomości na minutę, czas wiadomości ustawia serwer
create or replace function public.class_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.classes where owner = new.owner) >= 20 then raise exception 'too many classes'; end if;
  new.created_at := now(); return new;
end $$;
drop trigger if exists class_guard on public.classes;
create trigger class_guard before insert on public.classes for each row execute function public.class_guard();
create or replace function public.class_msg_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.class_msgs where from_id = new.from_id and created_at > now() - interval '1 minute') >= 30 then raise exception 'rate limit'; end if;
  new.created_at := now(); return new;
end $$;
drop trigger if exists class_msg_guard on public.class_msgs;
create trigger class_msg_guard before insert on public.class_msgs for each row execute function public.class_msg_guard();

-- profile (nick + zdjęcie) widzą też osoby z tej samej klasy
create or replace function public.shares_class(other uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.class_members a join public.class_members b on b.class_id = a.class_id
    where a.user_id = auth.uid() and b.user_id = other);
$$;
revoke all on function public.shares_class(uuid) from public, anon;
grant execute on function public.shares_class(uuid) to authenticated;
drop policy if exists "profile_read" on public.profiles;
create policy "profile_read" on public.profiles for select to authenticated using (
  id = auth.uid()
  or (stats ->> 'showGlobal') = '1'
  or exists (select 1 from public.friends f where (f.user_id = auth.uid() and f.friend_id = profiles.id) or (f.friend_id = auth.uid() and f.user_id = profiles.id))
  or public.shares_class(id));

-- 👑 Prestiż: ogłoszenia rzadkich dropów (legendarne/mityczne) widoczne dla wszystkich zalogowanych
-- oraz „Odkrywca” – kto pierwszy w całej aplikacji zdobył dany przedmiot (klucz główny = przedmiot, wygrywa pierwszy zapis)
create table if not exists public.cos_drops (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  nick text not null default 'Gracz',
  item text not null,
  rarity text not null,
  first boolean not null default false,
  created_at timestamptz not null default now());
create index if not exists cos_drops_time on public.cos_drops (created_at desc);
create table if not exists public.cos_firsts (
  item text primary key,
  user_id uuid not null references auth.users on delete cascade,
  nick text not null default 'Gracz',
  created_at timestamptz not null default now());
alter table public.cos_drops enable row level security;
alter table public.cos_firsts enable row level security;
alter table public.cos_drops drop constraint if exists cosd_chk;
alter table public.cos_drops add constraint cosd_chk check (char_length(nick) <= 24 and item ~ '^[a-z0-9_]{1,24}$' and rarity in ('legendary', 'mythic')) not valid;
alter table public.cos_firsts drop constraint if exists cosf_chk;
alter table public.cos_firsts add constraint cosf_chk check (char_length(nick) <= 24 and item ~ '^[a-z0-9_]{1,24}$') not valid;
drop policy if exists "cosd_read" on public.cos_drops;
drop policy if exists "cosd_insert" on public.cos_drops;
drop policy if exists "cosd_delete" on public.cos_drops;
create policy "cosd_read" on public.cos_drops for select to authenticated using (true);
create policy "cosd_insert" on public.cos_drops for insert to authenticated with check (user_id = auth.uid());
create policy "cosd_delete" on public.cos_drops for delete to authenticated using (user_id = auth.uid());
drop policy if exists "cosf_read" on public.cos_firsts;
drop policy if exists "cosf_insert" on public.cos_firsts;
create policy "cosf_read" on public.cos_firsts for select to authenticated using (true);
create policy "cosf_insert" on public.cos_firsts for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "cosf_delete" on public.cos_firsts;
create policy "cosf_delete" on public.cos_firsts for delete to authenticated using (user_id = auth.uid());
revoke update on public.cos_drops from authenticated;
revoke update on public.cos_firsts from authenticated;
-- czas ustawia serwer, max 20 ogłoszeń na osobę dziennie
create or replace function public.cos_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'cos_drops' and (select count(*) from public.cos_drops where user_id = new.user_id and created_at > now() - interval '1 day') >= 20 then raise exception 'rate limit'; end if;
  new.created_at := now(); return new;
end $$;
drop trigger if exists cos_drops_guard on public.cos_drops;
create trigger cos_drops_guard before insert on public.cos_drops for each row execute function public.cos_guard();
drop trigger if exists cos_firsts_guard on public.cos_firsts;
create trigger cos_firsts_guard before insert on public.cos_firsts for each row execute function public.cos_guard();

-- 🔗 Krótkie linki do talii: skompresowany pakiet fiszek pod krótkim id (#/t/ID). Zapisuje zalogowany autor,
-- odczyt tylko po znanym id przez funkcję (także bez konta) – nie da się przeglądać cudzych talii.
create table if not exists public.deck_links (
  id text primary key,
  owner uuid not null references auth.users on delete cascade,
  name text not null default 'Talia',
  data text not null,
  created_at timestamptz not null default now());
alter table public.deck_links enable row level security;
alter table public.deck_links drop constraint if exists dl_chk;
alter table public.deck_links add constraint dl_chk check (id ~ '^[A-Za-z0-9]{8}$' and char_length(name) <= 80 and octet_length(data) < 800000 and data ~ '^[A-Za-z0-9_-]+$') not valid;
drop policy if exists "dl_insert" on public.deck_links;
drop policy if exists "dl_own" on public.deck_links;
drop policy if exists "dl_delete" on public.deck_links;
create policy "dl_insert" on public.deck_links for insert to authenticated with check (owner = auth.uid());
create policy "dl_own" on public.deck_links for select to authenticated using (owner = auth.uid());
create policy "dl_delete" on public.deck_links for delete to authenticated using (owner = auth.uid());
revoke update on public.deck_links from authenticated;
create or replace function public.dl_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.deck_links where owner = new.owner and created_at > now() - interval '1 day') >= 30 then raise exception 'rate limit'; end if;
  new.created_at := now(); return new;
end $$;
drop trigger if exists dl_guard on public.deck_links;
create trigger dl_guard before insert on public.deck_links for each row execute function public.dl_guard();
create or replace function public.get_deck_link(p_id text) returns text language sql stable security definer set search_path = '' as $$
  select data from public.deck_links where id = p_id limit 1;
$$;
revoke all on function public.get_deck_link(text) from public;
grant execute on function public.get_deck_link(text) to anon, authenticated;

-- 📊 Statystyki dla właściciela (Panel hosta): same liczby, bez e-maili. Właściciel = pierwsze konto, które odbierze
-- uprawnienie (claim_admin) – potem nikt inny nie może. Licznik otwarć linków do talii zwiększa get_deck_link.
create table if not exists public.app_admins (user_id uuid primary key references auth.users on delete cascade);
alter table public.app_admins enable row level security;
drop policy if exists "adm_read" on public.app_admins;
create policy "adm_read" on public.app_admins for select to authenticated using (user_id = auth.uid());
alter table public.deck_links add column if not exists opens int not null default 0;
alter table public.deck_links add column if not exists opened_at timestamptz;
-- 🔒 nikt nie może „odebrać” uprawnień z aplikacji – właściciela dopisuje się ręcznie w SQL Editorze:
--    insert into public.app_admins select id from auth.users where email = 'TWOJ@EMAIL';
create or replace function public.claim_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;
revoke all on function public.claim_admin() from public, anon;
grant execute on function public.claim_admin() to authenticated;
create or replace function public.host_stats() returns json language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.app_admins where user_id = auth.uid()) then raise exception 'not admin'; end if;
  return json_build_object(
    'users', (select count(*) from auth.users),
    'new_today', (select count(*) from auth.users where created_at >= date_trunc('day', now())),
    'new_7d', (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'active_today', (select count(*) from public.profiles where updated_at >= date_trunc('day', now())),
    'active_7d', (select count(*) from public.profiles where updated_at >= now() - interval '7 days'),
    'links', (select count(*) from public.deck_links),
    'link_opens', (select coalesce(sum(opens), 0) from public.deck_links),
    'link_opens_today', (select count(*) from public.deck_links where opened_at >= date_trunc('day', now())),
    'top_links', (select coalesce(json_agg(t), '[]'::json) from (select name, opens, created_at from public.deck_links order by opens desc, created_at desc limit 5) t));
end $$;
revoke all on function public.host_stats() from public, anon;
grant execute on function public.host_stats() to authenticated;
-- otwarcie linku: zwraca talię i liczy otwarcie
create or replace function public.get_deck_link(p_id text) returns text language plpgsql volatile security definer set search_path = '' as $$
declare d text;
begin
  update public.deck_links set opens = opens + 1, opened_at = now() where id = p_id returning data into d;
  return d;
end $$;
revoke all on function public.get_deck_link(text) from public;
grant execute on function public.get_deck_link(text) to anon, authenticated;

-- Wersja skryptu – aplikacja sprawdza ją w Panelu hosta („Aktualizacja bazy”)
-- 🛠️ Flagi funkcji dla CAŁEJ aplikacji: czytają wszyscy, zmienia tylko właściciel (app_admins) przez set_flag
create table if not exists public.app_flags (k text primary key check (char_length(k) <= 24), off boolean not null default false, t timestamptz not null default now());
alter table public.app_flags enable row level security;
drop policy if exists "flags_read" on public.app_flags;
create policy "flags_read" on public.app_flags for select to anon, authenticated using (true);
grant select on public.app_flags to anon, authenticated;
create or replace function public.set_flag(p_k text, p_off boolean) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.app_admins where user_id = auth.uid()) then raise exception 'not admin'; end if;
  insert into public.app_flags (k, off, t) values (left(p_k, 24), p_off, now()) on conflict (k) do update set off = excluded.off, t = now();
  return true;
end $$;
revoke all on function public.set_flag(text, boolean) from public, anon;
grant execute on function public.set_flag(text, boolean) to authenticated;
create or replace function public.am_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;
revoke all on function public.am_admin() from public, anon;
grant execute on function public.am_admin() to authenticated;

-- 🛡️ Anty-oszustwo: serwer odrzuca nierealne wartości w profilu (ranking) i wycina z zapisu gry
-- „dopisane” kryształy i przedmioty (pojedyncza nagroda > 20 000 💎, przedmiot > 500 sztuk, sztuczne pola).
create or replace function public.profile_guard() returns trigger language plpgsql set search_path = '' as $$
declare st jsonb := coalesce(new.stats, '{}'::jsonb);
begin
  if (st->>'elo') ~ '^-?[0-9.]+$' and (st->>'elo')::numeric > 3000 then st := jsonb_set(st, '{elo}', '3000'); end if;
  if (st->>'level') ~ '^-?[0-9.]+$' and (st->>'level')::numeric > 300 then st := jsonb_set(st, '{level}', '300'); end if;
  if (st->>'weekMin') ~ '^-?[0-9.]+$' and (st->>'weekMin')::numeric > 10080 then st := jsonb_set(st, '{weekMin}', '10080'); end if;
  if (st->>'xp') ~ '^-?[0-9.]+$' and (st->>'xp')::numeric > 5000000 then st := jsonb_set(st, '{xp}', '5000000'); end if;
  if length(coalesce(new.avatar_img, '')) > 70000 then new.avatar_img := null; end if;
  new.nick := left(coalesce(new.nick, ''), 24); new.stats := st; new.updated_at := now();
  return new;
end $$;
drop trigger if exists profile_guard on public.profiles;
create trigger profile_guard before insert or update on public.profiles for each row execute function public.profile_guard();

create table if not exists public.cheat_log (id bigserial primary key, user_id uuid, t timestamptz not null default now(), what text);
alter table public.cheat_log enable row level security;
create or replace function public.data_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare w jsonb; it jsonb; bad int;
begin
  w := coalesce(new.data->'wallet', '[]'::jsonb); it := coalesce(new.data->'items', '[]'::jsonb);
  select count(*) into bad from jsonb_array_elements(w) e where jsonb_typeof(e->'n') <> 'number' or (e->>'n')::numeric > 20000;
  if bad > 0 then
    insert into public.cheat_log(user_id, what) values (new.user_id, 'wallet: ' || bad || ' wpisów > 20000 lub błędnych');
    new.data := jsonb_set(new.data, '{wallet}', coalesce((select jsonb_agg(e) from jsonb_array_elements(w) e where jsonb_typeof(e->'n') = 'number' and (e->>'n')::numeric <= 20000), '[]'::jsonb));
  end if;
  select count(*) into bad from jsonb_array_elements(it) e where jsonb_typeof(e->'q') <> 'number' or abs((e->>'q')::numeric) > 500;
  if bad > 0 then
    insert into public.cheat_log(user_id, what) values (new.user_id, 'items: ' || bad || ' przedmiotów > 500 szt.');
    new.data := jsonb_set(new.data, '{items}', coalesce((select jsonb_agg(e) from jsonb_array_elements(it) e where jsonb_typeof(e->'q') = 'number' and abs((e->>'q')::numeric) <= 500), '[]'::jsonb));
  end if;
  return new;
end $$;
drop trigger if exists data_guard on public.user_data;
create trigger data_guard before insert or update on public.user_data for each row execute function public.data_guard();

-- 🔎 audyt dla właściciela (Panel hosta): najbogatsi gracze i ostatnie wykryte próby
create or replace function public.admin_audit() returns json language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.app_admins where user_id = auth.uid()) then raise exception 'not admin'; end if;
  return json_build_object(
    'rich', (select coalesce(json_agg(x), '[]') from (select p.nick, p.code, (select coalesce(sum((e->>'n')::numeric), 0) from jsonb_array_elements(coalesce(d.data->'wallet', '[]')) e where jsonb_typeof(e->'n') = 'number') as gems,
        jsonb_array_length(coalesce(d.data->'items', '[]')) as items, d.updated_at from public.user_data d join public.profiles p on p.id = d.user_id order by 3 desc nulls last limit 15) x),
    'cheats', (select coalesce(json_agg(x), '[]') from (select p.nick, c.what, c.t from public.cheat_log c left join public.profiles p on p.id = c.user_id order by c.t desc limit 30) x));
end $$;
revoke all on function public.admin_audit() from public, anon;
grant execute on function public.admin_audit() to authenticated;

-- 🚫 blokada ekonomii oszusta: każdy zapis jego danych czyści kryształy i przedmioty (odblokowuje tylko właściciel)
create table if not exists public.econ_bans (user_id uuid primary key references auth.users on delete cascade, t timestamptz not null default now(), why text);
alter table public.econ_bans enable row level security;
create or replace function public.data_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare w jsonb; it jsonb; bad int; tot numeric;
begin
  if exists (select 1 from public.econ_bans where user_id = new.user_id) then
    new.data := new.data || jsonb_build_object('wallet', '[]'::jsonb, 'items', '[]'::jsonb, 'hcWallet', '[]'::jsonb, 'hcItems', '[]'::jsonb, 'econBan', true);
    return new;
  end if;
  new.data := new.data - 'econBan';
  w := coalesce(new.data->'wallet', '[]'::jsonb); it := coalesce(new.data->'items', '[]'::jsonb);
  select count(*) into bad from jsonb_array_elements(w) e where jsonb_typeof(e->'n') <> 'number' or (e->>'n')::numeric > 20000;
  if bad > 0 then
    insert into public.cheat_log(user_id, what) values (new.user_id, 'wallet: ' || bad || ' wpisów > 20000 lub błędnych');
    new.data := jsonb_set(new.data, '{wallet}', coalesce((select jsonb_agg(e) from jsonb_array_elements(w) e where jsonb_typeof(e->'n') = 'number' and (e->>'n')::numeric <= 20000), '[]'::jsonb));
  end if;
  select count(*) into bad from jsonb_array_elements(it) e where jsonb_typeof(e->'q') <> 'number' or abs((e->>'q')::numeric) > 500;
  if bad > 0 then
    insert into public.cheat_log(user_id, what) values (new.user_id, 'items: ' || bad || ' przedmiotów > 500 szt.');
    new.data := jsonb_set(new.data, '{items}', coalesce((select jsonb_agg(e) from jsonb_array_elements(it) e where jsonb_typeof(e->'q') = 'number' and abs((e->>'q')::numeric) <= 500), '[]'::jsonb));
  end if;
  -- podejrzanie bogaty przy małej liczbie powtórek → wpis do dziennika (raz na dobę), decyzja należy do właściciela
  select coalesce(sum((e->>'n')::numeric), 0) into tot from jsonb_array_elements(coalesce(new.data->'wallet', '[]'::jsonb)) e where jsonb_typeof(e->'n') = 'number';
  if tot > 50000 + 100 * jsonb_array_length(coalesce(new.data->'log', '[]'::jsonb))
     and not exists (select 1 from public.cheat_log where user_id = new.user_id and t > now() - interval '1 day') then
    insert into public.cheat_log(user_id, what) values (new.user_id, 'podejrzane: ' || tot || ' 💎 przy ' || jsonb_array_length(coalesce(new.data->'log', '[]'::jsonb)) || ' powtórkach');
  end if;
  return new;
end $$;
create or replace function public.admin_ban(p_code text, p_on boolean) returns boolean language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not exists (select 1 from public.app_admins where user_id = auth.uid()) then raise exception 'not admin'; end if;
  select id into uid from public.profiles where code = upper(trim(p_code)); if uid is null then raise exception 'no such player'; end if;
  if p_on then
    insert into public.econ_bans(user_id, why) values (uid, 'admin') on conflict (user_id) do nothing;
    insert into public.cheat_log(user_id, what) values (uid, 'zablokowano ekonomię (właściciel)');
  else delete from public.econ_bans where user_id = uid; end if;
  update public.user_data set data = data where user_id = uid;   -- trigger od razu czyści / zdejmuje znacznik
  return p_on;
end $$;
revoke all on function public.admin_ban(text, boolean) from public, anon;
grant execute on function public.admin_ban(text, boolean) to authenticated;
create or replace function public.admin_audit() returns json language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.app_admins where user_id = auth.uid()) then raise exception 'not admin'; end if;
  return json_build_object(
    'rich', (select coalesce(json_agg(x), '[]') from (select p.nick, p.code, (select coalesce(sum((e->>'n')::numeric), 0) from jsonb_array_elements(coalesce(d.data->'wallet', '[]')) e where jsonb_typeof(e->'n') = 'number') as gems,
        jsonb_array_length(coalesce(d.data->'items', '[]')) as items, jsonb_array_length(coalesce(d.data->'log', '[]')) as reviews, d.updated_at,
        exists (select 1 from public.econ_bans b where b.user_id = d.user_id) as banned
        from public.user_data d join public.profiles p on p.id = d.user_id order by 3 desc nulls last limit 15) x),
    'cheats', (select coalesce(json_agg(x), '[]') from (select p.nick, c.what, c.t from public.cheat_log c left join public.profiles p on p.id = c.user_id order by c.t desc limit 30) x));
end $$;
revoke all on function public.admin_audit() from public, anon;
grant execute on function public.admin_audit() to authenticated;

-- 🛡️ kary właściciela: zabranie kryształów / przedmiotów / naklejek, klaun, wiadomość, ekran do góry nogami
create table if not exists public.admin_actions (id bigserial primary key, user_id uuid not null references auth.users on delete cascade, what text not null, msg text, t timestamptz not null default now());
alter table public.admin_actions enable row level security;
create or replace function public.apply_admin_actions(d jsonb, uid uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare ack bigint; a record; ops jsonb := '[]'::jsonb;
begin
  ack := case when (d->'stats'->>'adminAck') ~ '^[0-9]+$' then (d->'stats'->>'adminAck')::bigint else 0 end;
  for a in select id, what, msg from public.admin_actions where user_id = uid and id > ack order by id loop
    ops := ops || jsonb_build_object('id', a.id, 'what', a.what, 'msg', a.msg);
    if a.what in ('wallet', 'all') then d := d || jsonb_build_object('wallet', '[]'::jsonb, 'hcWallet', '[]'::jsonb); end if;
    if a.what in ('items', 'all') then
      d := jsonb_set(d, '{items}', coalesce((select jsonb_agg(e) from jsonb_array_elements(coalesce(d->'items', '[]')) e where e->>'kind' = 'sticker' and a.what = 'items'), '[]'::jsonb));
      d := d || jsonb_build_object('hcItems', '[]'::jsonb);
    end if;
    if a.what = 'stickers' then
      d := jsonb_set(d, '{items}', coalesce((select jsonb_agg(e) from jsonb_array_elements(coalesce(d->'items', '[]')) e where coalesce(e->>'kind', '') <> 'sticker'), '[]'::jsonb));
    end if;
  end loop;
  return case when jsonb_array_length(ops) > 0 then d || jsonb_build_object('adminOps', ops) else d - 'adminOps' end;
end $$;
revoke all on function public.apply_admin_actions(jsonb, uuid) from public, anon, authenticated;
create or replace function public.data_guard_admin() returns trigger language plpgsql security definer set search_path = '' as $$
begin new.data := public.apply_admin_actions(new.data, new.user_id); return new; end $$;
drop trigger if exists data_guard_admin on public.user_data;
create trigger data_guard_admin before insert or update on public.user_data for each row execute function public.data_guard_admin();
create or replace function public.is_clown(uid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select what = 'clown' from public.admin_actions where user_id = uid and what in ('clown', 'unclown') order by id desc limit 1), false) $$;
revoke all on function public.is_clown(uuid) from public, anon, authenticated;
create or replace function public.profile_guard_admin() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.nick := regexp_replace(coalesce(new.nick, ''), '^🤡 ', '');
  if public.is_clown(new.id) then new.nick := left('🤡 ' || new.nick, 24); end if;
  return new;
end $$;
drop trigger if exists profile_guard_admin on public.profiles;
create trigger profile_guard_admin before insert or update on public.profiles for each row execute function public.profile_guard_admin();
create or replace function public.admin_act(p_code text, p_what text, p_msg text default null) returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid; nk text;
begin
  if not exists (select 1 from public.app_admins where user_id = auth.uid()) then raise exception 'not admin'; end if;
  if p_what not in ('wallet', 'items', 'stickers', 'all', 'clown', 'unclown', 'msg', 'flip') then raise exception 'bad action'; end if;
  select id, nick into uid, nk from public.profiles where code = upper(trim(p_code)); if uid is null then raise exception 'no such player'; end if;
  insert into public.admin_actions(user_id, what, msg) values (uid, p_what, left(p_msg, 300));
  if p_what in ('wallet', 'items', 'stickers', 'all') then insert into public.cheat_log(user_id, what) values (uid, 'właściciel zabrał: ' || p_what); end if;
  update public.user_data set data = data where user_id = uid;
  update public.profiles set nick = nick where id = uid;
  return nk;
end $$;
revoke all on function public.admin_act(text, text, text) from public, anon;
grant execute on function public.admin_act(text, text, text) to authenticated;

-- 🔎 szczegóły jednego gracza dla właściciela (okienko w Panelu hosta)
create or replace function public.admin_player(p_code text) returns json language plpgsql stable security definer set search_path = '' as $$
declare uid uuid;
begin
  if not exists (select 1 from public.app_admins where user_id = auth.uid()) then raise exception 'not admin'; end if;
  select id into uid from public.profiles where code = upper(trim(p_code)); if uid is null then raise exception 'no such player'; end if;
  return (select json_build_object(
    'nick', p.nick, 'code', p.code, 'avatar', p.avatar, 'avatar_img', p.avatar_img, 'stats', p.stats, 'updated', p.updated_at, 'created', u.created_at,
    'gems', (select coalesce(sum((e->>'n')::numeric), 0) from jsonb_array_elements(coalesce(d.data->'wallet', '[]')) e where jsonb_typeof(e->'n') = 'number'),
    'wallet_n', jsonb_array_length(coalesce(d.data->'wallet', '[]')),
    'biggest', (select coalesce(max((e->>'n')::numeric), 0) from jsonb_array_elements(coalesce(d.data->'wallet', '[]')) e where jsonb_typeof(e->'n') = 'number'),
    'items', (select coalesce(json_object_agg(k, n), '{}') from (select coalesce(e->>'kind', '?') k, count(*) n from jsonb_array_elements(coalesce(d.data->'items', '[]')) e group by 1) x),
    'reviews', jsonb_array_length(coalesce(d.data->'log', '[]')), 'cards', jsonb_array_length(coalesce(d.data->'cards', '[]')), 'decks', jsonb_array_length(coalesce(d.data->'decks', '[]')),
    'synced', d.updated_at, 'banned', exists (select 1 from public.econ_bans b where b.user_id = uid), 'clown', public.is_clown(uid),
    'log', (select coalesce(json_agg(x), '[]') from (select what, t from public.cheat_log where user_id = uid order by t desc limit 10) x),
    'actions', (select coalesce(json_agg(x), '[]') from (select what, msg, t from public.admin_actions where user_id = uid order by id desc limit 10) x))
    from public.profiles p left join public.user_data d on d.user_id = p.id left join auth.users u on u.id = p.id where p.id = uid);
end $$;
revoke all on function public.admin_player(text) from public, anon;
grant execute on function public.admin_player(text) to authenticated;

-- 👻 „cień”: oszust dalej WIDZI u siebie kryształy i przedmioty, ale w chmurze ich nie ma (inne urządzenie, ranking, gablota – pusto)
create or replace function public.is_shadow(uid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select what = 'shadow' from public.admin_actions where user_id = uid and what in ('shadow', 'unshadow') order by id desc limit 1), false) $$;
revoke all on function public.is_shadow(uuid) from public, anon, authenticated;
create or replace function public.apply_admin_actions(d jsonb, uid uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare ack bigint; a record; ops jsonb := '[]'::jsonb;
begin
  ack := case when (d->'stats'->>'adminAck') ~ '^[0-9]+$' then (d->'stats'->>'adminAck')::bigint else 0 end;
  for a in select id, what, msg from public.admin_actions where user_id = uid and id > ack and what not in ('shadow', 'unshadow') order by id loop
    ops := ops || jsonb_build_object('id', a.id, 'what', a.what, 'msg', a.msg);
    if a.what in ('wallet', 'all') then d := d || jsonb_build_object('wallet', '[]'::jsonb, 'hcWallet', '[]'::jsonb); end if;
    if a.what in ('items', 'all') then
      d := jsonb_set(d, '{items}', coalesce((select jsonb_agg(e) from jsonb_array_elements(coalesce(d->'items', '[]')) e where e->>'kind' = 'sticker' and a.what = 'items'), '[]'::jsonb));
      d := d || jsonb_build_object('hcItems', '[]'::jsonb);
    end if;
    if a.what = 'stickers' then
      d := jsonb_set(d, '{items}', coalesce((select jsonb_agg(e) from jsonb_array_elements(coalesce(d->'items', '[]')) e where coalesce(e->>'kind', '') <> 'sticker'), '[]'::jsonb));
    end if;
  end loop;
  -- cień: po cichu (bez komunikatu i bez czyszczenia na jego telefonie)
  if public.is_shadow(uid) then d := d || jsonb_build_object('wallet', '[]'::jsonb, 'items', '[]'::jsonb, 'hcWallet', '[]'::jsonb, 'hcItems', '[]'::jsonb); end if;
  return case when jsonb_array_length(ops) > 0 then d || jsonb_build_object('adminOps', ops) else d - 'adminOps' end;
end $$;
revoke all on function public.apply_admin_actions(jsonb, uuid) from public, anon, authenticated;
create or replace function public.profile_guard_admin() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.nick := regexp_replace(coalesce(new.nick, ''), '^🤡 ', '');
  if public.is_clown(new.id) then new.nick := left('🤡 ' || new.nick, 24); end if;
  if public.is_shadow(new.id) then new.stats := coalesce(new.stats, '{}'::jsonb) - 'showcase' - 'cos'; end if;
  return new;
end $$;
create or replace function public.admin_act(p_code text, p_what text, p_msg text default null) returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid; nk text;
begin
  if not exists (select 1 from public.app_admins where user_id = auth.uid()) then raise exception 'not admin'; end if;
  if p_what not in ('wallet', 'items', 'stickers', 'all', 'clown', 'unclown', 'msg', 'flip', 'shadow', 'unshadow') then raise exception 'bad action'; end if;
  select id, nick into uid, nk from public.profiles where code = upper(trim(p_code)); if uid is null then raise exception 'no such player'; end if;
  insert into public.admin_actions(user_id, what, msg) values (uid, p_what, left(p_msg, 300));
  if p_what in ('wallet', 'items', 'stickers', 'all', 'shadow') then insert into public.cheat_log(user_id, what) values (uid, 'właściciel: ' || p_what); end if;
  update public.user_data set data = data where user_id = uid;
  update public.profiles set nick = nick where id = uid;
  return nk;
end $$;
revoke all on function public.admin_act(text, text, text) from public, anon;
grant execute on function public.admin_act(text, text, text) to authenticated;
create or replace function public.admin_player(p_code text) returns json language plpgsql stable security definer set search_path = '' as $$
declare uid uuid;
begin
  if not exists (select 1 from public.app_admins where user_id = auth.uid()) then raise exception 'not admin'; end if;
  select id into uid from public.profiles where code = upper(trim(p_code)); if uid is null then raise exception 'no such player'; end if;
  return (select json_build_object(
    'nick', p.nick, 'code', p.code, 'avatar', p.avatar, 'avatar_img', p.avatar_img, 'stats', p.stats, 'updated', p.updated_at, 'created', u.created_at,
    'gems', (select coalesce(sum((e->>'n')::numeric), 0) from jsonb_array_elements(coalesce(d.data->'wallet', '[]')) e where jsonb_typeof(e->'n') = 'number'),
    'wallet_n', jsonb_array_length(coalesce(d.data->'wallet', '[]')),
    'biggest', (select coalesce(max((e->>'n')::numeric), 0) from jsonb_array_elements(coalesce(d.data->'wallet', '[]')) e where jsonb_typeof(e->'n') = 'number'),
    'items', (select coalesce(json_object_agg(k, n), '{}') from (select coalesce(e->>'kind', '?') k, count(*) n from jsonb_array_elements(coalesce(d.data->'items', '[]')) e group by 1) x),
    'reviews', jsonb_array_length(coalesce(d.data->'log', '[]')), 'cards', jsonb_array_length(coalesce(d.data->'cards', '[]')), 'decks', jsonb_array_length(coalesce(d.data->'decks', '[]')),
    'synced', d.updated_at, 'banned', exists (select 1 from public.econ_bans b where b.user_id = uid), 'clown', public.is_clown(uid), 'shadow', public.is_shadow(uid),
    'log', (select coalesce(json_agg(x), '[]') from (select what, t from public.cheat_log where user_id = uid order by t desc limit 10) x),
    'actions', (select coalesce(json_agg(x), '[]') from (select what, msg, t from public.admin_actions where user_id = uid order by id desc limit 10) x))
    from public.profiles p left join public.user_data d on d.user_id = p.id left join auth.users u on u.id = p.id where p.id = uid);
end $$;
revoke all on function public.admin_player(text) from public, anon;
grant execute on function public.admin_player(text) to authenticated;

-- 🔑 hasło do kar w Panelu hosta: w bazie jest tylko skrót (bcrypt), samo hasło ustawiasz osobnym poleceniem (nie ma go w tym pliku)
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.admin_secret (id int primary key default 1 check (id = 1), h text not null);
alter table public.admin_secret enable row level security;
create or replace function public.admin_pass_ok(p_pass text) returns boolean language plpgsql stable security definer set search_path = '' as $$
declare hh text;
begin
  select h into hh from public.admin_secret where id = 1;
  if hh is null then raise exception 'no admin password set'; end if;
  if p_pass is null or extensions.crypt(p_pass, hh) <> hh then raise exception 'bad admin password'; end if;
  return true;
end $$;
revoke all on function public.admin_pass_ok(text) from public, anon, authenticated;
drop function if exists public.admin_act(text, text, text);
drop function if exists public.admin_ban(text, boolean);
create or replace function public.admin_act(p_code text, p_what text, p_msg text default null, p_pass text default null) returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid; nk text;
begin
  if not exists (select 1 from public.app_admins where user_id = auth.uid()) then raise exception 'not admin'; end if;
  perform public.admin_pass_ok(p_pass);
  if p_what not in ('wallet', 'items', 'stickers', 'all', 'clown', 'unclown', 'msg', 'flip', 'shadow', 'unshadow') then raise exception 'bad action'; end if;
  select id, nick into uid, nk from public.profiles where code = upper(trim(p_code)); if uid is null then raise exception 'no such player'; end if;
  insert into public.admin_actions(user_id, what, msg) values (uid, p_what, left(p_msg, 300));
  if p_what in ('wallet', 'items', 'stickers', 'all', 'shadow') then insert into public.cheat_log(user_id, what) values (uid, 'właściciel: ' || p_what); end if;
  update public.user_data set data = data where user_id = uid;
  update public.profiles set nick = nick where id = uid;
  return nk;
end $$;
revoke all on function public.admin_act(text, text, text, text) from public, anon;
grant execute on function public.admin_act(text, text, text, text) to authenticated;
create or replace function public.admin_ban(p_code text, p_on boolean, p_pass text default null) returns boolean language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not exists (select 1 from public.app_admins where user_id = auth.uid()) then raise exception 'not admin'; end if;
  perform public.admin_pass_ok(p_pass);
  select id into uid from public.profiles where code = upper(trim(p_code)); if uid is null then raise exception 'no such player'; end if;
  if p_on then
    insert into public.econ_bans(user_id, why) values (uid, 'admin') on conflict (user_id) do nothing;
    insert into public.cheat_log(user_id, what) values (uid, 'zablokowano ekonomię (właściciel)');
  else delete from public.econ_bans where user_id = uid; end if;
  update public.user_data set data = data where user_id = uid;
  return p_on;
end $$;
revoke all on function public.admin_ban(text, boolean, text) from public, anon;
grant execute on function public.admin_ban(text, boolean, text) to authenticated;

-- ♻️ kopia przed karą + przywracanie wszystkiego (kryształy, złoto, przedmioty, naklejki; zdejmuje też cień i blokadę)
create table if not exists public.admin_backups (id bigserial primary key, user_id uuid not null references auth.users on delete cascade, t timestamptz not null default now(), data jsonb not null);
alter table public.admin_backups enable row level security;
create or replace function public.admin_backup(uid uuid) returns void language sql security definer set search_path = '' as $$
  insert into public.admin_backups(user_id, data)
  select uid, jsonb_build_object('wallet', coalesce(d.data->'wallet', '[]'), 'items', coalesce(d.data->'items', '[]'), 'hcWallet', coalesce(d.data->'hcWallet', '[]'), 'hcItems', coalesce(d.data->'hcItems', '[]'))
  from public.user_data d where d.user_id = uid
    and (jsonb_array_length(coalesce(d.data->'wallet', '[]')) + jsonb_array_length(coalesce(d.data->'items', '[]'))) > 0 $$;
revoke all on function public.admin_backup(uuid) from public, anon, authenticated;
create or replace function public.jarr_union(a jsonb, b jsonb) returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(a, '[]'::jsonb) || coalesce((select jsonb_agg(e) from jsonb_array_elements(coalesce(b, '[]'::jsonb)) e
    where not exists (select 1 from jsonb_array_elements(coalesce(a, '[]'::jsonb)) x where x->>'id' = e->>'id')), '[]'::jsonb) $$;
create or replace function public.apply_admin_actions(d jsonb, uid uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare ack bigint; a record; ops jsonb := '[]'::jsonb; lastr bigint;
begin
  ack := case when (d->'stats'->>'adminAck') ~ '^[0-9]+$' then (d->'stats'->>'adminAck')::bigint else 0 end;
  select coalesce(max(id), 0) into lastr from public.admin_actions where user_id = uid and what = 'restore';
  for a in select id, what, msg from public.admin_actions where user_id = uid and id > ack and what not in ('shadow', 'unshadow') order by id loop
    ops := ops || jsonb_build_object('id', a.id, 'what', case when a.id < lastr and a.what in ('wallet', 'items', 'stickers', 'all') then 'void' else a.what end, 'msg', a.msg);
    continue when a.id < lastr;   -- kara cofnięta przez późniejsze przywrócenie
    if a.what in ('wallet', 'all') then d := d || jsonb_build_object('wallet', '[]'::jsonb, 'hcWallet', '[]'::jsonb); end if;
    if a.what in ('items', 'all') then
      d := jsonb_set(d, '{items}', coalesce((select jsonb_agg(e) from jsonb_array_elements(coalesce(d->'items', '[]')) e where e->>'kind' = 'sticker' and a.what = 'items'), '[]'::jsonb));
      d := d || jsonb_build_object('hcItems', '[]'::jsonb);
    end if;
    if a.what = 'stickers' then
      d := jsonb_set(d, '{items}', coalesce((select jsonb_agg(e) from jsonb_array_elements(coalesce(d->'items', '[]')) e where coalesce(e->>'kind', '') <> 'sticker'), '[]'::jsonb));
    end if;
  end loop;
  if public.is_shadow(uid) then d := d || jsonb_build_object('wallet', '[]'::jsonb, 'items', '[]'::jsonb, 'hcWallet', '[]'::jsonb, 'hcItems', '[]'::jsonb); end if;
  return case when jsonb_array_length(ops) > 0 then d || jsonb_build_object('adminOps', ops) else d - 'adminOps' end;
end $$;
revoke all on function public.apply_admin_actions(jsonb, uuid) from public, anon, authenticated;
create or replace function public.admin_act(p_code text, p_what text, p_msg text default null, p_pass text default null) returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid; nk text; b jsonb;
begin
  if not exists (select 1 from public.app_admins where user_id = auth.uid()) then raise exception 'not admin'; end if;
  perform public.admin_pass_ok(p_pass);
  if p_what not in ('wallet', 'items', 'stickers', 'all', 'clown', 'unclown', 'msg', 'flip', 'shadow', 'unshadow', 'restore') then raise exception 'bad action'; end if;
  select id, nick into uid, nk from public.profiles where code = upper(trim(p_code)); if uid is null then raise exception 'no such player'; end if;
  if p_what in ('wallet', 'items', 'stickers', 'all', 'shadow') then perform public.admin_backup(uid); end if;
  if p_what = 'restore' then
    select data into b from public.admin_backups where user_id = uid order by id asc limit 1;   -- najstarsza kopia = stan sprzed pierwszej kary
    if b is null then raise exception 'no backup'; end if;
    delete from public.econ_bans where user_id = uid;
    insert into public.admin_actions(user_id, what) values (uid, 'unshadow');
  end if;
  insert into public.admin_actions(user_id, what, msg) values (uid, p_what, left(p_msg, 300));
  if p_what in ('wallet', 'items', 'stickers', 'all', 'shadow', 'restore') then insert into public.cheat_log(user_id, what) values (uid, 'właściciel: ' || p_what); end if;
  if p_what = 'restore' then
    update public.user_data set data = data || jsonb_build_object('wallet', public.jarr_union(data->'wallet', b->'wallet'), 'items', public.jarr_union(data->'items', b->'items'),
      'hcWallet', public.jarr_union(data->'hcWallet', b->'hcWallet'), 'hcItems', public.jarr_union(data->'hcItems', b->'hcItems')) where user_id = uid;
    delete from public.admin_backups where user_id = uid;
  else update public.user_data set data = data where user_id = uid; end if;
  update public.profiles set nick = nick where id = uid;
  return nk;
end $$;
revoke all on function public.admin_act(text, text, text, text) from public, anon;
grant execute on function public.admin_act(text, text, text, text) to authenticated;
create or replace function public.admin_ban(p_code text, p_on boolean, p_pass text default null) returns boolean language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not exists (select 1 from public.app_admins where user_id = auth.uid()) then raise exception 'not admin'; end if;
  perform public.admin_pass_ok(p_pass);
  select id into uid from public.profiles where code = upper(trim(p_code)); if uid is null then raise exception 'no such player'; end if;
  if p_on then
    perform public.admin_backup(uid);
    insert into public.econ_bans(user_id, why) values (uid, 'admin') on conflict (user_id) do nothing;
    insert into public.cheat_log(user_id, what) values (uid, 'zablokowano ekonomię (właściciel)');
  else delete from public.econ_bans where user_id = uid; end if;
  update public.user_data set data = data where user_id = uid;
  return p_on;
end $$;
revoke all on function public.admin_ban(text, boolean, text) from public, anon;
grant execute on function public.admin_ban(text, boolean, text) to authenticated;

-- 🔒 klucz „anon” jest publiczny z natury (musi być w aplikacji) – dlatego sam w sobie nic nie daje:
-- niezalogowany (anon) nie ma dostępu do żadnej tabeli poza listą wyłączonych funkcji; resztę i tak pilnuje RLS
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
grant select on public.app_flags to anon;

create or replace function public.db_version() returns text language sql stable set search_path = '' as $$ select '2026-11-01h'::text $$;
grant execute on function public.db_version() to anon, authenticated;

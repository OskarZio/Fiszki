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

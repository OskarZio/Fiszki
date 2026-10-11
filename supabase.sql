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

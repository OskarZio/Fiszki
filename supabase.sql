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
drop policy if exists "friends_own" on public.friends;
create policy "friends_own" on public.friends for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

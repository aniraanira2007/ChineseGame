-- Run once in the Supabase SQL Editor for this project.
-- Public student cards contain only fields users choose to share. Email,
-- XP, coins, streaks, and lesson history stay in the owner-only save table.

create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null default 'Little learner' check (char_length(username) between 1 and 18),
  country text check (country is null or char_length(country) <= 60),
  preferred_language text not null default 'English' check (char_length(preferred_language) <= 40),
  bio text not null default '' check (char_length(bio) <= 160),
  interests text[] not null default '{}',
  avatar jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.player_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.player_profiles enable row level security;
alter table public.player_saves enable row level security;

revoke all on table public.player_profiles from anon, authenticated;
revoke all on table public.player_saves from anon, authenticated;
grant select, insert, update on table public.player_profiles to authenticated;
grant select, insert, update on table public.player_saves to authenticated;

drop policy if exists "Signed-in players can view public student cards" on public.player_profiles;
create policy "Signed-in players can view public student cards"
  on public.player_profiles for select to authenticated using (true);

drop policy if exists "Players can create their own student card" on public.player_profiles;
create policy "Players can create their own student card"
  on public.player_profiles for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Players can update their own student card" on public.player_profiles;
create policy "Players can update their own student card"
  on public.player_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Players can read their own save" on public.player_saves;
create policy "Players can read their own save"
  on public.player_saves for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Players can create their own save" on public.player_saves;
create policy "Players can create their own save"
  on public.player_saves for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Players can update their own save" on public.player_saves;
create policy "Players can update their own save"
  on public.player_saves for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

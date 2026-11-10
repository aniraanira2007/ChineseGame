-- Run once in Supabase SQL Editor to enable signed-in plaza chat and reports.
-- Chat, opted-in presence, movement and voice-signaling events use Realtime
-- broadcasts and are not stored in a table. Reports are saved below.
-- Reports are private to the reporting player and project administrators.

create table if not exists public.player_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  room text not null default 'plaza' check (char_length(room) <= 40),
  category text not null default 'chat' check (category in ('chat','harassment','safety','other')),
  details text not null default '' check (char_length(details) <= 500),
  created_at timestamptz not null default now(),
  constraint reports_cannot_target_self check (reporter_id <> reported_user_id)
);

alter table public.player_reports enable row level security;
revoke all on table public.player_reports from anon, authenticated;
grant insert, select on table public.player_reports to authenticated;

drop policy if exists "Players can submit their own report" on public.player_reports;
create policy "Players can submit their own report"
  on public.player_reports for insert to authenticated
  with check (auth.uid() = reporter_id and reporter_id <> reported_user_id);

drop policy if exists "Players can read only their own reports" on public.player_reports;
create policy "Players can read only their own reports"
  on public.player_reports for select to authenticated
  using (auth.uid() = reporter_id);

-- Private Realtime channels authenticate both plaza presence and chat.
-- This intentionally grants only signed-in users access; never expose a service key.
drop policy if exists "Signed-in players can receive private room events" on realtime.messages;
create policy "Signed-in players can receive private room events"
  on realtime.messages for select to authenticated
  using (realtime.topic() = 'worldmates:plaza');

drop policy if exists "Signed-in players can send private room events" on realtime.messages;
create policy "Signed-in players can send private room events"
  on realtime.messages for insert to authenticated
  with check (realtime.topic() = 'worldmates:plaza');

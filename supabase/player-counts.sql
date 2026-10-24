-- Run this once in your Supabase project's SQL Editor.
-- Only this function can read or write the visitor table; no names are stored.
create table if not exists public.game_visitors (
  visitor_id uuid primary key,
  first_seen_at timestamptz not null default now()
);

alter table public.game_visitors enable row level security;
revoke all on table public.game_visitors from anon, authenticated;

create or replace function public.register_game_visit(p_visitor_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.game_visitors (visitor_id)
  values (p_visitor_id)
  on conflict (visitor_id) do nothing;

  return (select count(*) from public.game_visitors);
end;
$$;

revoke all on function public.register_game_visit(uuid) from public;
grant execute on function public.register_game_visit(uuid) to anon, authenticated;

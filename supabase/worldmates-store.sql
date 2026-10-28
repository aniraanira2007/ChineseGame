-- Run this in the Supabase SQL Editor before enabling paid membership.
-- Clients may only read their own billing state. Checkout and entitlement
-- writes are performed by server-side Edge Functions using a secret key.

create table if not exists public.store_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  product_key text not null default 'club-monthly',
  status text not null check (status in ('incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused')),
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.store_entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_key text not null,
  active boolean not null default false,
  source text not null default 'stripe',
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  stripe_session_id text,
  updated_at timestamptz not null default now(),
  primary key (user_id, product_key)
);

create table if not exists public.store_stripe_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.store_subscriptions enable row level security;
alter table public.store_entitlements enable row level security;
alter table public.store_stripe_events enable row level security;

revoke all on table public.store_subscriptions from anon, authenticated;
revoke all on table public.store_entitlements from anon, authenticated;
revoke all on table public.store_stripe_events from anon, authenticated;
grant select on table public.store_subscriptions to authenticated;
grant select on table public.store_entitlements to authenticated;

drop policy if exists "Players can read their own subscription" on public.store_subscriptions;
create policy "Players can read their own subscription"
  on public.store_subscriptions for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Players can read their own store entitlements" on public.store_entitlements;
create policy "Players can read their own store entitlements"
  on public.store_entitlements for select to authenticated using (auth.uid() = user_id);

-- No browser policy is created for billing events or client-side writes.

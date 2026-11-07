-- たびさいふ 初期スキーマ
-- 利用者の分離は画面ではなく DB の Row Level Security で強制する。

create table public.trips (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 60),
  country_code  char(2) not null,
  currency      char(3) not null,
  start_date    date,
  end_date      date,
  card_fee_pct  numeric(4,2) not null default 2.00 check (card_fee_pct between 0 and 20),
  created_at    timestamptz not null default now(),
  unique (id, user_id),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.expenses (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null,
  user_id       uuid not null default auth.uid(),
  spent_on      date not null default current_date,
  title         text not null default '' check (char_length(title) <= 80),
  category      text not null default 'other'
                check (category in ('food','shopping','transport','hotel','sightseeing','other')),
  payment       text not null default 'card' check (payment in ('card','cash')),
  amount_local  numeric(14,2) not null check (amount_local > 0),
  currency      char(3) not null,
  rate_to_jpy   numeric(16,6) not null check (rate_to_jpy > 0),
  rate_date     date,
  amount_jpy    numeric(16,0) generated always as (round(amount_local * rate_to_jpy)) stored,
  created_at    timestamptz not null default now(),
  -- 他人の旅行に明細をぶら下げることを DB の制約でも防ぐ
  foreign key (trip_id, user_id) references public.trips (id, user_id) on delete cascade
);

create index expenses_trip_idx on public.expenses (trip_id, spent_on desc, created_at desc);
create index trips_user_idx on public.trips (user_id, created_at desc);

alter table public.trips    enable row level security;
alter table public.trips    force  row level security;
alter table public.expenses enable row level security;
alter table public.expenses force  row level security;

-- 未ログインには一切の権限を与えない
revoke all on public.trips, public.expenses from anon, public;
grant select, insert, update, delete on public.trips, public.expenses to authenticated;

create policy trips_owner on public.trips
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy expenses_owner on public.expenses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 無料プランの自動休止を防ぐ定期アクセス用。データには触れない。
create function public.ping() returns text language sql stable as $$ select 'ok'::text $$;
grant execute on function public.ping() to anon;

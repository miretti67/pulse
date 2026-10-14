-- Pulse markets, points, and calls.
-- Draw: close == open at 2 decimals -> refund.
-- Fee: none. Lock: 60s before close. Empty side: void + refund.
-- Payouts floor to whole points. Rank uses prediction_points only.

create sequence if not exists market_code_seq;

create table if not exists profiles (
  user_id text primary key,
  member_no serial unique,
  display_name text not null,
  username text not null unique,
  image text,
  referral_code text not null unique,
  referred_by text,
  prediction_points integer not null default 10000,
  referral_points integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists markets (
  id serial primary key,
  code text not null unique,
  opens_at timestamptz not null unique,
  locks_at timestamptz not null,
  closes_at timestamptz not null,
  open_price numeric(18, 2),
  close_price numeric(18, 2),
  status text not null,
  result text,
  price_source text,
  created_at timestamptz not null default now()
);

create index if not exists markets_status_idx on markets (status, closes_at);

create table if not exists positions (
  id serial primary key,
  market_id integer not null references markets (id),
  user_id text not null references profiles (user_id),
  side text not null,
  stake integer not null,
  payout integer,
  net integer,
  outcome text,
  created_at timestamptz not null default now(),
  unique (market_id, user_id)
);

create index if not exists positions_user_idx on positions (user_id, created_at desc);
create index if not exists positions_market_idx on positions (market_id);

create table if not exists price_samples (
  market_id integer not null references markets (id),
  sampled_at timestamptz not null,
  price numeric(18, 2) not null,
  primary key (market_id, sampled_at)
);

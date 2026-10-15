-- Cloudflare D1 (SQLite) schema: equivalent of migrations/0001..0004 (Postgres).
-- Timestamps are ISO-8601 UTC text ('YYYY-MM-DDTHH:MM:SS.sssZ') so text comparison orders correctly.

create table if not exists "user" (
  "id" text not null primary key,
  "name" text not null,
  "email" text not null unique,
  "emailVerified" integer not null,
  "image" text,
  "createdAt" date not null default CURRENT_TIMESTAMP,
  "updatedAt" date not null default CURRENT_TIMESTAMP
);
create table if not exists "session" (
  "id" text not null primary key,
  "expiresAt" date not null,
  "token" text not null unique,
  "createdAt" date not null default CURRENT_TIMESTAMP,
  "updatedAt" date not null,
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references "user" ("id") on delete cascade
);
create table if not exists "account" (
  "id" text not null primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references "user" ("id") on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" date,
  "refreshTokenExpiresAt" date,
  "scope" text,
  "password" text,
  "createdAt" date not null default CURRENT_TIMESTAMP,
  "updatedAt" date not null
);
create table if not exists "verification" (
  "id" text not null primary key,
  "identifier" text not null,
  "value" text not null,
  "expiresAt" date not null,
  "createdAt" date not null default CURRENT_TIMESTAMP,
  "updatedAt" date not null default CURRENT_TIMESTAMP
);
create index if not exists "session_userId_idx" on "session" ("userId");
create index if not exists "account_userId_idx" on "account" ("userId");
create index if not exists "verification_identifier_idx" on "verification" ("identifier");

-- Stand-in for Postgres sequence market_code_seq.
create table if not exists market_code_seq (id integer primary key autoincrement, at text);

create table if not exists profiles (
  user_id text primary key,
  member_no integer unique,
  display_name text not null,
  username text not null unique,
  image text,
  referral_code text not null unique,
  referred_by text,
  prediction_points integer not null default 10000,
  referral_points integer not null default 0,
  topup_points integer not null default 0,
  broke_on text,
  referral_paid integer not null default 0,
  avatar text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
-- member_no (Postgres serial) is assigned by the app on insert (max + 1).

create table if not exists markets (
  id integer primary key autoincrement,
  code text not null unique,
  opens_at text not null,
  locks_at text not null,
  closes_at text not null,
  open_price real,
  close_price real,
  status text not null,
  result text,
  price_source text,
  length_min integer not null default 15,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create index if not exists markets_status_idx on markets (status, closes_at);
create unique index if not exists markets_length_open_uidx on markets (length_min, opens_at);

create table if not exists positions (
  id integer primary key autoincrement,
  market_id integer not null references markets (id),
  user_id text not null references profiles (user_id),
  side text not null,
  stake integer not null,
  payout integer,
  net integer,
  outcome text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  unique (market_id, user_id)
);
create index if not exists positions_user_idx on positions (user_id, created_at desc);
create index if not exists positions_market_idx on positions (market_id);

create table if not exists price_samples (
  market_id integer not null references markets (id),
  sampled_at text not null,
  price real not null,
  primary key (market_id, sampled_at)
);

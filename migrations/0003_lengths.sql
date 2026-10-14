-- 1M / 5M / 15M windows share a clock, so open time is unique per length.
alter table markets add column if not exists length_min integer not null default 15;
alter table markets drop constraint if exists markets_opens_at_key;
create unique index if not exists markets_length_open_uidx on markets (length_min, opens_at);

alter table profiles add column if not exists topup_points integer not null default 0;
alter table profiles add column if not exists broke_on date;
alter table profiles add column if not exists referral_paid boolean not null default false;

-- Referrals already credited stay credited. New ones wait for 3 settled calls.
update profiles set referral_paid = true where referred_by is not null;

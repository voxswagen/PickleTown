-- ============================================================
--  Pickle Town Sports Center — Supabase setup
--  Run this ONCE: dashboard → SQL Editor → New query → paste → Run
-- ============================================================

-- ---------- the table ----------
-- One row per key. The app stores everything as JSON strings:
--   court:day:2026-08-29   bookings for that date
--   court:openplay         the open play session in progress
--   court:receipt:<id>     a payment receipt photo
--   court:settings         rates and payment details      (staff only)
--   court:qr:bank          a payment QR image             (staff only)
--   court:staff            the staff accounts
--   court:log              the activity log
create table if not exists public.kv (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

create index if not exists kv_key_prefix on public.kv (key text_pattern_ops);
alter table public.kv enable row level security;

-- ---------- reading ----------
-- Everyone. Customers need the schedule and the open play queue.
drop policy if exists "anyone can read" on public.kv;
create policy "anyone can read" on public.kv for select using (true);

-- ---------- writing ----------
-- Customers aren't signed in, so the app writes as the anonymous role.
-- Everything the site owns is writable that way, rates and payment details
-- included: the app already shows those only to the super admin, and asking
-- the database for a second, separate Supabase login on top of that was more
-- trouble than it was worth. See "Worth knowing" in README.md for what that
-- does and does not protect.
drop policy if exists "public can add bookings" on public.kv;
create policy "public can add bookings" on public.kv for insert to anon
  with check (key like 'court:%');

drop policy if exists "public can update bookings" on public.kv;
create policy "public can update bookings" on public.kv for update to anon
  using (key like 'court:%');

-- Signed-in staff can do anything.
drop policy if exists "staff can write everything" on public.kv;
create policy "staff can write everything" on public.kv for all to authenticated
  using (true) with check (true);

-- ---------- realtime ----------
-- So the TV, the desk and players' phones all update instantly.
-- Adding a table twice is an error, and an error anywhere rolls the whole file
-- back — so check first. That makes this file safe to run again whenever you
-- change something above.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'kv'
  ) then
    alter publication supabase_realtime add table public.kv;
  end if;
end $$;

-- ---------- staff accounts ----------
-- superadmin / kitoliver (both super admins) and admin1 / admin2, all starting
-- on the password 1234. (Those are SHA-256 hashes, not the password itself.)
-- Change them from Settings > Your account on day one.
--
-- "locked": true marks the one account that can never be removed, so the club
-- can't lock itself out. It can still be renamed and re-passworded.
insert into public.kv (key, value)
values (
  'court:staff',
  '[{"key":"superadmin","role":"super","label":"Super admin","email":"","locked":true,"hash":"04bd7bd99f83f0668c4a104df295a6a0f5db7885750f4aead1a05c228198e0d6"},{"key":"kitoliver","role":"super","label":"Super admin","email":"","hash":"04bd7bd99f83f0668c4a104df295a6a0f5db7885750f4aead1a05c228198e0d6"},{"key":"admin1","role":"shift","label":"Morning shift","email":"","hash":"04bd7bd99f83f0668c4a104df295a6a0f5db7885750f4aead1a05c228198e0d6"},{"key":"admin2","role":"shift","label":"Evening shift","email":"","hash":"04bd7bd99f83f0668c4a104df295a6a0f5db7885750f4aead1a05c228198e0d6"}]'
)
on conflict (key) do nothing;

-- ---------- adding those two to a database that already exists ----------
-- The insert above only runs on a fresh install, so this brings an older
-- database up to date: it adds kitoliver if missing and marks the keyholder.
-- Safe to run twice; it won't touch passwords or accounts you've since added.
update public.kv set value = (
  case when value::jsonb @> '[{"key":"kitoliver"}]'::jsonb then value::jsonb
  else value::jsonb || jsonb_build_array(jsonb_build_object(
    'key','kitoliver', 'role','super', 'label','Super admin', 'email','',
    'hash','04bd7bd99f83f0668c4a104df295a6a0f5db7885750f4aead1a05c228198e0d6'))
  end
)::text
where key = 'court:staff';

update public.kv set value = (
  select jsonb_agg(
           case when a->>'key' = 'superadmin' then a || '{"locked":true}'::jsonb else a end
           order by ord)
  from jsonb_array_elements(value::jsonb) with ordinality as t(a, ord)
)::text
where key = 'court:staff'
  and not (value::jsonb @> '[{"locked":true}]'::jsonb);

-- ---------- optional: put the money back behind a login ----------
-- The one thing worth protecting is the payment QR images: swap those and a
-- customer pays the wrong account. If you ever want them staff-only again,
-- run this. Rates and payment details will then only save for a staff account
-- with a linked Supabase user (Settings > Your account > Linked email), so set
-- that up FIRST or you will lock yourself out of your own rates.
--
-- drop policy if exists "public can add bookings" on public.kv;
-- create policy "public can add bookings" on public.kv for insert to anon
--   with check (key like 'court:%' and key not like 'court:qr:%');
-- drop policy if exists "public can update bookings" on public.kv;
-- create policy "public can update bookings" on public.kv for update to anon
--   using (key like 'court:%' and key not like 'court:qr:%');

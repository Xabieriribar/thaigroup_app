create extension if not exists pgcrypto;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar text not null check (char_length(avatar) between 1 and 8),
  color text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.locations (
  id uuid primary key,
  member_id uuid not null references public.members(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  accuracy double precision check (accuracy is null or accuracy >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  source text not null check (source in ('gps', 'manual'))
);

create index if not exists idx_members_group_id on public.members(group_id);
create index if not exists idx_locations_group_id_created_at on public.locations(group_id, created_at desc);
create index if not exists idx_locations_member_id_created_at on public.locations(member_id, created_at desc);

create or replace view public.latest_locations as
select distinct on (member_id)
  id,
  member_id,
  group_id,
  lat,
  lon,
  accuracy,
  created_at,
  source
from public.locations
order by member_id, created_at desc;

alter table public.groups enable row level security;
alter table public.members enable row level security;
alter table public.locations enable row level security;

drop policy if exists "public read groups" on public.groups;
drop policy if exists "public insert groups" on public.groups;
drop policy if exists "public read members" on public.members;
drop policy if exists "public insert members" on public.members;
drop policy if exists "public read locations" on public.locations;
drop policy if exists "public write locations" on public.locations;

create policy "public read groups"
on public.groups
for select
using (true);

create policy "public insert groups"
on public.groups
for insert
with check (true);

create policy "public read members"
on public.members
for select
using (true);

create policy "public insert members"
on public.members
for insert
with check (true);

create policy "public read locations"
on public.locations
for select
using (true);

create policy "public write locations"
on public.locations
for insert
with check (true);

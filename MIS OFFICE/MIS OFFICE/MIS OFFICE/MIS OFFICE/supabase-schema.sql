-- Run this in Supabase: SQL Editor -> New query -> paste -> Run

-- 1) Table
create table if not exists public.activities (
  id text primary key,
  "dateOfApplication" text,
  "nameOfActivity" text,
  "dateOfActivity" text,
  organizer text,
  time text,
  "timeStart" text,
  "timeEnd" text,
  venue text,
  "requestedBy" text,
  "notedBy" text,
  objectives text,
  stage int default 1,
  status text default 'Upcoming',
  "statusNote" text,
  compliance jsonb,
  equipment jsonb default '[]'::jsonb,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now(),
  "hardCopyUrl" text
);

-- Add column if table already exists
alter table public.activities add column if not exists "hardCopyUrl" text;

-- 2) Allow the anon key to read/write (dev-friendly). Tighten later with auth.
alter table public.activities enable row level security;

drop policy if exists "anon read activities" on public.activities;
create policy "anon read activities" on public.activities for select using (true);

drop policy if exists "anon insert activities" on public.activities;
create policy "anon insert activities" on public.activities for insert with check (true);

drop policy if exists "anon update activities" on public.activities;
create policy "anon update activities" on public.activities for update using (true) with check (true);

drop policy if exists "anon delete activities" on public.activities;
create policy "anon delete activities" on public.activities for delete using (true);

-- Storage bucket for hard copy forms
insert into storage.buckets (id, name, public) values ('hard-copies','hard-copies',true)
on conflict (id) do nothing;

drop policy if exists "anon upload hard copies" on storage.objects;
create policy "anon upload hard copies" on storage.objects for insert
  with check (bucket_id = 'hard-copies');

drop policy if exists "anon read hard copies" on storage.objects;
create policy "anon read hard copies" on storage.objects for select
  using (bucket_id = 'hard-copies');
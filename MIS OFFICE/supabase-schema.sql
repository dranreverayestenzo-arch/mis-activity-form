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
  "updatedAt" timestamptz default now()
);

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

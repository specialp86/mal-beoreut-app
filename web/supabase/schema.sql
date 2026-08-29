-- 음어탐지기: recordings + accumulated per-user habit profile.
-- Run this once in Supabase's SQL Editor (Project -> SQL Editor -> New query).
-- Safe to re-run: uses "if not exists" / "or replace" throughout.

create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  duration_seconds integer not null,
  transcript_text text not null,
  stt_provider text not null,
  syllables_per_minute integer not null default 0,
  total_habit_mentions integer not null default 0,
  habit_summary text,
  detected_habits jsonb not null default '[]'::jsonb
);

create index if not exists recordings_user_id_created_at_idx
  on public.recordings (user_id, created_at desc);

create table if not exists public.habit_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expression text not null,
  category text not null,
  example text not null,
  occurrences integer not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, expression)
);

create index if not exists habit_profile_user_id_occurrences_idx
  on public.habit_profile (user_id, occurrences desc);

-- Row Level Security: every user can only ever see/write their own rows.
alter table public.recordings enable row level security;
alter table public.habit_profile enable row level security;

drop policy if exists "recordings_select_own" on public.recordings;
create policy "recordings_select_own" on public.recordings
  for select using (auth.uid() = user_id);

drop policy if exists "recordings_insert_own" on public.recordings;
create policy "recordings_insert_own" on public.recordings
  for insert with check (auth.uid() = user_id);

drop policy if exists "recordings_delete_own" on public.recordings;
create policy "recordings_delete_own" on public.recordings
  for delete using (auth.uid() = user_id);

drop policy if exists "habit_profile_select_own" on public.habit_profile;
create policy "habit_profile_select_own" on public.habit_profile
  for select using (auth.uid() = user_id);

drop policy if exists "habit_profile_insert_own" on public.habit_profile;
create policy "habit_profile_insert_own" on public.habit_profile
  for insert with check (auth.uid() = user_id);

drop policy if exists "habit_profile_update_own" on public.habit_profile;
create policy "habit_profile_update_own" on public.habit_profile
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Atomically merges one recording's detected habits into the running
-- profile. Called once per recording from the server (service role or the
-- authenticated user's own session both work since RLS allows own-row
-- upsert). Doing this as a single SQL function avoids a
-- select-then-update race if a user ever submits two recordings at once.
create or replace function public.merge_habit_profile(
  p_user_id uuid,
  p_habits jsonb, -- array of {expression, category, example, count}
  p_timestamp timestamptz
) returns void
language plpgsql
security invoker
as $$
declare
  habit jsonb;
begin
  for habit in select * from jsonb_array_elements(p_habits)
  loop
    insert into public.habit_profile (user_id, expression, category, example, occurrences, first_seen_at, last_seen_at)
    values (
      p_user_id,
      habit->>'expression',
      habit->>'category',
      habit->>'example',
      (habit->>'count')::integer,
      p_timestamp,
      p_timestamp
    )
    on conflict (user_id, expression) do update
      set occurrences = public.habit_profile.occurrences + excluded.occurrences,
          last_seen_at = excluded.last_seen_at,
          example = excluded.example;
  end loop;
end;
$$;

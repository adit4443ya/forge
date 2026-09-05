-- ════════════════════════════════════════════════════════════════════════════
--  Forge — database schema
--  Run once in the Supabase SQL editor (Dashboard > SQL Editor > New query).
--
--  Design note. Progress is ONE JSONB document per user rather than a dozen
--  normalized tables. That is deliberate: the client already owns a single
--  consistent state object, the whole document is a few kilobytes, every read
--  is "give me my state", and there are no cross-user queries. Normalising it
--  would buy nothing and cost a migration every time the client shape changes.
--  The one genuinely relational, append-only, unbounded thing — attempts — is
--  ALSO written to its own table so history survives and can be analysed.
-- ════════════════════════════════════════════════════════════════════════════

-- ── the state document ──────────────────────────────────────────────────────
create table if not exists public.progress (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  data        jsonb       not null default '{}'::jsonb,
  revision    bigint      not null default 1,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

comment on table  public.progress is 'One row per user: the whole client state object.';
comment on column public.progress.revision is 'Monotonic; bumped by the trigger so clients can detect a newer server copy.';

create or replace function public.touch_progress()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.revision   := coalesce(old.revision, 0) + 1;
  return new;
end $$;

drop trigger if exists progress_touch on public.progress;
create trigger progress_touch before update on public.progress
  for each row execute function public.touch_progress();

alter table public.progress enable row level security;

drop policy if exists progress_select on public.progress;
create policy progress_select on public.progress for select using (auth.uid() = user_id);
drop policy if exists progress_insert on public.progress;
create policy progress_insert on public.progress for insert with check (auth.uid() = user_id);
drop policy if exists progress_update on public.progress;
create policy progress_update on public.progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists progress_delete on public.progress;
create policy progress_delete on public.progress for delete using (auth.uid() = user_id);

-- ── append-only attempt history ─────────────────────────────────────────────
-- Every problem attempt, kept forever, so the Progress screen can show trends
-- and so a lost browser never loses the record of what you actually solved.
create table if not exists public.attempts (
  id          bigint generated always as identity primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  problem_id  integer     not null,
  attempted_on date       not null default (now() at time zone 'utc')::date,
  minutes     integer,
  result      text        not null check (result in ('solved', 'hint', 'failed')),
  mode        text        not null default 'drill' check (mode in ('drill', 'study', 'mock')),
  revealed    text[]      not null default '{}',
  note        text        not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists attempts_user_time on public.attempts (user_id, created_at desc);
create index if not exists attempts_user_problem on public.attempts (user_id, problem_id);

alter table public.attempts enable row level security;
drop policy if exists attempts_select on public.attempts;
create policy attempts_select on public.attempts for select using (auth.uid() = user_id);
drop policy if exists attempts_insert on public.attempts;
create policy attempts_insert on public.attempts for insert with check (auth.uid() = user_id);
drop policy if exists attempts_delete on public.attempts;
create policy attempts_delete on public.attempts for delete using (auth.uid() = user_id);

-- ── convenience view: solved counts per mode ────────────────────────────────
create or replace view public.attempt_summary
with (security_invoker = true) as
select user_id,
       problem_id,
       count(*)                                              as attempts,
       min(created_at)                                       as first_attempt,
       max(created_at)                                       as last_attempt,
       bool_or(result = 'solved')                            as ever_solved,
       bool_or(result = 'solved' and mode = 'mock')          as solved_under_mock,
       min(minutes) filter (where result = 'solved')         as best_minutes
from public.attempts
group by user_id, problem_id;

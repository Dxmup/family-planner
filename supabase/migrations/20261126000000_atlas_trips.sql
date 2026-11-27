-- Adventure Atlas: saved trips and per-city "visited" marks.
--
-- Lives in the planner's Supabase project (not the old Atlas one) so the
-- planner dashboard can show a countdown to the next trip.
--
--   * SELECT                 -> any signed-in family account
--   * INSERT/UPDATE/DELETE   -> parents only (public.is_parent())
--
-- Rollback:
--   drop table if exists public.atlas_trips;
--   drop table if exists public.atlas_city_marks;

begin;

create table if not exists public.atlas_trips (
  id          bigint generated always as identity primary key,
  name        text not null,
  start_date  date,                              -- null = "someday" trip
  stops       jsonb not null default '[]'::jsonb, -- [{ "city": "Asheville", "nights": 2 }, ...]
  mode        text not null default 'drive' check (mode in ('drive', 'fly')),
  est_cost    numeric,                           -- total estimate at save time, dollars
  notes       text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists public.atlas_city_marks (
  city        text primary key,                  -- matches the Atlas CITIES key
  visited     boolean not null default false,
  visited_on  date,
  updated_at  timestamptz not null default now()
);

alter table public.atlas_trips enable row level security;
alter table public.atlas_city_marks enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['atlas_trips', 'atlas_city_marks'] loop
    execute format('drop policy if exists "authenticated read" on public.%I', t);
    execute format('drop policy if exists "parent insert" on public.%I', t);
    execute format('drop policy if exists "parent update" on public.%I', t);
    execute format('drop policy if exists "parent delete" on public.%I', t);
    execute format(
      'create policy "authenticated read" on public.%I for select to authenticated using (true)', t);
    execute format(
      'create policy "parent insert" on public.%I for insert to authenticated with check (public.is_parent())', t);
    execute format(
      'create policy "parent update" on public.%I for update to authenticated using (public.is_parent()) with check (public.is_parent())', t);
    execute format(
      'create policy "parent delete" on public.%I for delete to authenticated using (public.is_parent())', t);
  end loop;
end $$;

grant select, insert, update, delete on public.atlas_trips, public.atlas_city_marks to authenticated;

commit;

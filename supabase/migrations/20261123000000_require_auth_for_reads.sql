-- Require a signed-in user for all reads, and for chore/routine completion taps.
--
-- Before: every table had a "public read" SELECT policy (anyone with the
-- publishable anon key could read the whole family's data), and
-- chore_completions / routine_completions let the anon role INSERT and DELETE.
--
-- After:
--   * SELECT        -> any authenticated user (parents AND the wall-tablet
--                      "display" user; neither is anonymous).
--   * INSERT/UPDATE/DELETE on everything else -> unchanged (is_parent()).
--   * Completion taps (insert + delete on the two completion tables)
--                   -> any authenticated user, so the tablet can still tap
--                      chores done without parent rights.
--   * member_calendars (secret iCal URLs) and parents -> unchanged
--                      (parents only / no policies).
--
-- BEFORE RUNNING: create the display user in the Supabase dashboard
-- (Authentication -> Users -> Add user, "Auto confirm"), e.g.
-- display@example.com with a long random password. Do NOT add it to
-- public.parents. Sign the tablet in once with it. Deploy the frontend change
-- that sends the tablet to a login screen first, or the app will show empty
-- data to anyone who is not signed in.
--
-- Rollback: see the bottom of this file.

begin;

-- 1. Reads: replace "public read" with an authenticated-only policy.
do $$
declare
  t text;
  tables text[] := array[
    'announcements', 'bonus_points', 'chore_completions', 'chores',
    'countdowns', 'events', 'gcal_events', 'list_items', 'lists',
    'meal_plan_items', 'meal_plans', 'meals', 'members', 'recipes',
    'redemptions', 'rewards', 'routine_completions', 'routine_items',
    'routines'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('drop policy if exists "authenticated read" on public.%I', t);
    execute format(
      'create policy "authenticated read" on public.%I for select to authenticated using (true)', t);
  end loop;
end $$;

-- 2. Completion taps: no more anonymous insert/delete.
do $$
declare
  t text;
begin
  foreach t in array array['chore_completions', 'routine_completions'] loop
    execute format('drop policy if exists "anyone insert" on public.%I', t);
    execute format('drop policy if exists "anyone delete" on public.%I', t);
    execute format('drop policy if exists "authenticated insert" on public.%I', t);
    execute format('drop policy if exists "authenticated delete" on public.%I', t);
    execute format(
      'create policy "authenticated insert" on public.%I for insert to authenticated with check (true)', t);
    execute format(
      'create policy "authenticated delete" on public.%I for delete to authenticated using (true)', t);
  end loop;
end $$;

-- 3. Sanity check: nothing may remain readable or writable by anon/public
--    on these tables. Aborts (rolls back) the whole migration if it does.
do $$
declare
  leftover int;
begin
  select count(*) into leftover
  from pg_policies
  where schemaname = 'public'
    and ('public' = any(roles) or 'anon' = any(roles))
    and tablename not in ('bonus_points');  -- bonus_points write policies are
                                            -- {public} but gated by is_parent()
  if leftover > 0 then
    raise exception 'anon/public policies still present on % policies', leftover;
  end if;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- Rollback (run manually if the tablet/app breaks and you need it back now):
--
--   do $$ declare t text; begin
--     foreach t in array array['announcements','bonus_points','chore_completions','chores',
--       'countdowns','events','gcal_events','list_items','lists','meal_plan_items','meal_plans',
--       'meals','members','recipes','redemptions','rewards','routine_completions',
--       'routine_items','routines'] loop
--       execute format('drop policy if exists "authenticated read" on public.%I', t);
--       execute format('create policy "public read" on public.%I for select using (true)', t);
--     end loop;
--   end $$;
--   create policy "anyone insert" on public.chore_completions for insert with check (true);
--   create policy "anyone delete" on public.chore_completions for delete using (true);
--   create policy "anyone insert" on public.routine_completions for insert with check (true);
--   create policy "anyone delete" on public.routine_completions for delete using (true);
-- ---------------------------------------------------------------------------

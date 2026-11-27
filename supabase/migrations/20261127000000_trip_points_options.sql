-- Adventure Atlas: award-flight ("points") options saved onto a trip.
--
-- A research tool run from Claude Code on the family's home PC writes this column through
-- PUT /api/trips/:id; the Trips page shows it. Shape: docs/atlas/points-options.md.
--
-- No policy changes: the existing atlas_trips policies already let any signed-in family
-- account read and only parents (public.is_parent()) update.
--
-- Rollback:
--   alter table public.atlas_trips drop column if exists points_options;

begin;

alter table public.atlas_trips add column if not exists points_options jsonb;

commit;

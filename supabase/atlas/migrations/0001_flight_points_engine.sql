-- Flight points-engine tables.
--
-- These let you tune the arbitrage brain (point valuations, live transfer bonuses)
-- WITHOUT a code redeploy: api/_lib/valuations.js overlays these rows on top of its
-- built-in defaults whenever SUPABASE_URL + SUPABASE_SERVICE_KEY are set.
--
-- Apply via the Supabase MCP (apply_migration) or the Supabase SQL editor.

-- Cents-per-point valuations. program = canonical key from valuations.js
-- (AMEX_MR, CHASE_UR, AEROPLAN, UA_MP, ...). cpp overrides the built-in default.
create table if not exists point_valuations (
  program    text primary key,
  cpp        numeric not null check (cpp >= 0),
  updated_at timestamptz not null default now()
);

-- Live transfer bonuses. When active, arbitrage.js applies bonus_pct on top of the
-- base bank->airline ratio, which is often the difference between a good and a
-- rock-bottom redemption.
create table if not exists transfer_bonuses (
  id           bigint generated always as identity primary key,
  from_program text not null,   -- bank currency, e.g. AMEX_MR
  to_program   text not null,   -- airline program, e.g. AF_KLM_FB
  bonus_pct    numeric not null check (bonus_pct >= 0),
  expires      date,
  active       boolean not null default true,
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_transfer_bonuses_active on transfer_bonuses (active);

-- OPTIONAL: your own point balances, so the engine knows what you can actually fund.
-- (You can also pass balances ad hoc via the ?held= query param.)
create table if not exists point_balances (
  program    text primary key,
  balance    integer not null default 0,
  updated_at timestamptz not null default now()
);

-- OPTIONAL: cache of recent searches, to avoid hammering paid APIs on repeat lookups.
create table if not exists flight_search_cache (
  cache_key   text primary key,          -- e.g. GSP-MCO-2026-08-15-2A2C-economy
  payload     jsonb not null,
  fetched_at  timestamptz not null default now()
);

-- Seed a couple of valuations as an example (edit freely; these mirror the defaults).
insert into point_valuations (program, cpp) values
  ('AMEX_MR', 2.0),
  ('CHASE_UR', 2.05),
  ('AEROPLAN', 1.5)
on conflict (program) do nothing;

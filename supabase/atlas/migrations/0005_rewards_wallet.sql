-- Rewards wallet: the household-specific benefits the decision layer reasons over.
--
-- 0001 gave the engine the ECONOMICS of points (valuations, transfer ratios, bonuses,
-- balances). These tables give it the household's BENEFITS — the certificates, credits,
-- Companion Pass, and elite status that decide the real family cost of a booking, plus
-- the behavioral weights that say how much this family will pay to avoid a connection.
--
-- Every table is optional. api/_lib/wallet.js reports `configured:false` for anything
-- it can't read and the engine degrades to pure cash-vs-points arbitrage, exactly as
-- it behaves today.
--
-- Like 0001's tables these are SERVER-ONLY: no anon policy is created, so the
-- publishable key cannot read them. /api/flights reaches them with SUPABASE_SERVICE_KEY.
--
-- Apply via the Supabase MCP (apply_migration) or the SQL editor.

-- ---------------------------------------------------------------------------
-- Free-night certificates, companion certificates, upgrade certificates.
-- `max_points` caps what the cert can cover (e.g. a 35k Marriott free-night night);
-- `cash_value` is used instead when the cert is denominated in dollars.
-- ---------------------------------------------------------------------------
create table if not exists reward_certificates (
  id          bigint generated always as identity primary key,
  kind        text not null,                  -- free_night | companion | upgrade | travel_credit
  program     text not null,                  -- canonical key: BONVOY, SW_RR, ...
  label       text,                           -- "Bonvoy 35k anniversary night"
  max_points  integer,                        -- cap in program points (free_night)
  cash_value  numeric,                        -- cap in USD (travel_credit style certs)
  expires     date,
  quantity    integer not null default 1 check (quantity >= 0),
  active      boolean not null default true,
  note        text,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Recurring / annual card credits with a remaining balance and a use-it-or-lose-it
-- date. `applies_to` scopes which candidates a credit may be subtracted from.
-- ---------------------------------------------------------------------------
create table if not exists reward_credits (
  id          bigint generated always as identity primary key,
  card        text not null,                  -- "Sapphire Preferred"
  kind        text not null,                  -- hotel_portal_credit | airline_incidental | ...
  applies_to  text not null default 'any_travel',
    -- any_travel | airfare | hotel | portal_travel | baggage
  amount_remaining numeric not null check (amount_remaining >= 0),
  period_expires   date,                      -- end of the current use-or-lose window
  active      boolean not null default true,
  note        text,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Companion Pass — deliberately a single on/off switch rather than a modeling
-- exercise. When enabled, one adult flies as the companion, so the adult share of
-- an airfare is halved. Set `program` to scope it (a Southwest pass shouldn't
-- discount a Delta fare); leave it null to apply to any carrier.
--
-- Seeded OFF: the household is working toward Southwest Companion Pass, so flip
-- enabled = true when it's earned.
-- ---------------------------------------------------------------------------
create table if not exists companion_pass (
  id          integer primary key default 1 check (id = 1), -- single-row settings table
  enabled     boolean not null default false,
  program     text,                                          -- SW_RR, or null for any
  note        text,
  updated_at  timestamptz not null default now()
);

insert into companion_pass (id, enabled, program, note) values
  (1, false, 'SW_RR', 'Flip enabled to true once Southwest Companion Pass is earned')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Elite status held, and where it comes from. Drives perks the scorer values
-- (free bags, free breakfast, waived resort fees).
-- ---------------------------------------------------------------------------
create table if not exists elite_status (
  program     text primary key,               -- BONVOY, HILTON_HONORS, SW_RR, ...
  level       text not null,                  -- Gold, Platinum, A-List
  source      text,                           -- "Amex Platinum"
  expires     date,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Card portfolio as DATA, so benefits can change without touching decision logic.
-- earn_rates: { "airfare_direct": 5, "general": 1 }
-- credits:    { "digital_entertainment_monthly": 25 }
-- statuses:   { "BONVOY": "Gold", "HILTON_HONORS": "Gold" }
-- transfer_partners: ["AEROPLAN", "AF_KLM_FB", ...]  (canonical keys)
-- ---------------------------------------------------------------------------
create table if not exists cards (
  id                bigint generated always as identity primary key,
  name              text not null unique,
  bank_currency     text,                     -- AMEX_MR, CHASE_UR, ... (what it earns)
  annual_fee        numeric not null default 0,
  earn_rates        jsonb not null default '{}'::jsonb,
  credits           jsonb not null default '{}'::jsonb,
  statuses          jsonb not null default '{}'::jsonb,
  transfer_partners jsonb not null default '[]'::jsonb,
  active            boolean not null default true,
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Behavioral weights: dollar-denominated statements of what this family will pay
-- to avoid friction. These are what make the engine recommend GSP over a cheaper
-- ATL itinerary on purpose rather than by accident. Edit freely.
-- See DEFAULT_BEHAVIORAL_WEIGHTS in api/_lib/wallet.js for the built-in values.
-- ---------------------------------------------------------------------------
create table if not exists behavioral_weights (
  key         text primary key,
  value       numeric not null,
  note        text,
  updated_at  timestamptz not null default now()
);

insert into behavioral_weights (key, value, note) values
  ('nonstop_bonus',                 80, 'USD this family will pay for a nonstop'),
  ('extra_connection_penalty',      60, 'USD penalty per connection'),
  ('airport_drive_penalty_per_hour',25, 'USD per hour of driving, applied each way'),
  ('red_eye_penalty',              100, 'USD penalty for a red-eye departure'),
  ('flexibility_penalty_pct',       12, 'Percent surcharge on spending transferable bank points'),
  ('urgency_window_days',           90, 'Benefits expiring inside this window get an urgency bonus'),
  ('urgency_max_bonus_pct',         25, 'Max discount applied to an about-to-expire benefit')
on conflict (key) do nothing;

create index if not exists idx_reward_certificates_active on reward_certificates (active);
create index if not exists idx_reward_credits_active on reward_credits (active);

-- Chase UR is valued at 1.75c: a realistic baseline rather than a best-case transfer,
-- so the engine doesn't recommend burning points on trips where cash was better.
insert into point_valuations (program, cpp) values ('CHASE_UR', 1.75)
on conflict (program) do update set cpp = excluded.cpp, updated_at = now();

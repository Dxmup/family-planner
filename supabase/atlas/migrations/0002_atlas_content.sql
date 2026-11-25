-- Adventure Atlas content schema.
--
-- Turns the hardcoded JS literals in index.html (CITIES, THEMES, A, PLAYBOOKS,
-- EVENTS, TRIP_EVENTS, PRESETS, COR) into real tables, plus saved trips — the
-- capability a static page can't have.
--
-- RLS: content tables are public-read (anon SELECT) so the browser can load them
-- directly with the publishable key. Writes happen server-side (service key) or via
-- API. Saved trips are readable/writable by anon for now (family app, no auth yet);
-- tighten when auth is added.

-- ---- Dimensions -----------------------------------------------------------

create table if not exists spokes (
  code  text primary key,          -- NW | N | NE | SE | S
  label text not null
);

create table if not exists themes (
  code  text primary key,          -- wa | sc | an | na | hi | tp | fo | wk
  label text not null
);

-- ---- Cities (destinations) ------------------------------------------------

create table if not exists cities (
  id          bigint generated always as identity primary key,
  name        text not null unique, -- display name; contains punctuation, so surrogate id
  spoke       text references spokes(code),
  drive       text,                 -- human-readable drive time, e.g. "~2.5h"
  overlook    text,                 -- "most overlook" tip
  hotel_rate  integer,              -- nightly USD default (from HOTELS)
  price_dates text,                 -- freshness stamp, e.g. "Jul 2026"
  lat         numeric,
  lng         numeric,
  is_home     boolean not null default false, -- Greenville = trip origin
  sort_order  integer
);

-- ---- Attractions / activities ---------------------------------------------

create table if not exists attractions (
  id       bigint generated always as identity primary key,
  name     text not null,
  city_id  bigint not null references cities(id) on delete cascade,
  type     text,   -- SIG | GEM | OFF | SOL
  age      text,   -- both | older | little
  why      text,
  price    text,   -- free-text price string (from PRICES)
  sort_order integer,
  unique (name, city_id)
);

create table if not exists attraction_themes (
  attraction_id bigint not null references attractions(id) on delete cascade,
  theme_code    text   not null references themes(code),
  primary key (attraction_id, theme_code)
);

-- ---- Playbooks ------------------------------------------------------------

create table if not exists playbooks (
  city_id   bigint primary key references cities(id) on delete cascade,
  pitch     text,
  signature text,
  rainy_day text,
  food_stop text,
  kid_tip   text,
  stay_area text
);

create table if not exists playbook_steps (
  id         bigint generated always as identity primary key,
  city_id    bigint not null references playbooks(city_id) on delete cascade,
  ordinal    integer not null,
  when_label text,   -- Morning | Midday | Afternoon | Evening
  stop       text,
  note       text
);

-- ---- Events ---------------------------------------------------------------

-- Evergreen calendar links (from EVENTS)
create table if not exists event_links (
  id          bigint generated always as identity primary key,
  city_id     bigint not null references cities(id) on delete cascade,
  name        text not null,
  url         text,
  description text
);

-- Perishable, dated, "baked" research (from TRIP_EVENTS). Also the natural home for
-- persisted /api/events results (source='live').
create table if not exists trip_events (
  id        bigint generated always as identity primary key,
  city_id   bigint not null references cities(id) on delete cascade,
  event_date date,             -- ISO date; null for ranges
  name      text not null,
  meta      text,              -- venue · time · price
  date_window text,            -- human date window
  expires   date,              -- auto-hide cutoff
  source    text not null default 'baked', -- baked | live
  found_at  date
);

-- ---- Routes / presets / corridors -----------------------------------------

create table if not exists presets (
  id   bigint generated always as identity primary key,
  name text not null unique
);

create table if not exists preset_stops (
  preset_id bigint not null references presets(id) on delete cascade,
  ordinal   integer not null,
  city_name text not null,     -- references cities.name informally (preset labels)
  primary key (preset_id, ordinal)
);

-- Corridor diagrams (from COR). nodes/segs are display data -> JSONB.
create table if not exists corridors (
  id     bigint generated always as identity primary key,
  title  text not null,
  tag    text,
  nodes  jsonb not null default '[]', -- [[label, kind], ...] kind: home|stay|pass
  segs   jsonb not null default '[]', -- ["2.5h", ...]
  branch text,
  sort_order integer
);

-- ---- Budget defaults (single row) -----------------------------------------

create table if not exists budget_settings (
  id             boolean primary key default true check (id), -- single-row guard
  gas            numeric not null default 3.15,
  mpg            numeric not null default 25,
  food_per_day   numeric not null default 90,
  hotel_fallback numeric not null default 150,
  nights         integer not null default 2,
  buffer_pct     numeric not null default 10
);

-- ---- Saved trips (new capability) -----------------------------------------

create table if not exists trips (
  id         bigint generated always as identity primary key,
  name       text not null default 'My Trip',
  trip_start date,
  created_at timestamptz not null default now()
);

create table if not exists trip_stops (
  id       bigint generated always as identity primary key,
  trip_id  bigint not null references trips(id) on delete cascade,
  ordinal  integer not null,
  city_id  bigint references cities(id),
  nights   integer not null default 2
);

-- ---- RLS ------------------------------------------------------------------

-- Public-read content
do $$
declare t text;
begin
  foreach t in array array[
    'spokes','themes','cities','attractions','attraction_themes','playbooks',
    'playbook_steps','event_links','trip_events','presets','preset_stops',
    'corridors','budget_settings'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists public_read on %I', t);
    execute format('create policy public_read on %I for select using (true)', t);
  end loop;
end $$;

-- Saved trips: anon read + write for now (no auth yet). Tighten when auth lands.
do $$
declare t text;
begin
  foreach t in array array['trips','trip_stops'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists public_all on %I', t);
    execute format('create policy public_all on %I for all using (true) with check (true)', t);
  end loop;
end $$;

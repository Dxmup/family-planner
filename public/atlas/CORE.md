# Atlas shared foundation (reference for page authors)

Every page under `/atlas/` loads `/atlas/atlas.css` and `/atlas/atlas-core.js`. The core is a plain script that exposes one global, `window.Atlas`. Do not edit the core or the stylesheet from a page task; if you need something new, put it in your own page.

## Page shell

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Plan · Hensel Family Adventure Atlas</title>
<link rel="stylesheet" href="/atlas/atlas.css">
</head>
<body>
<div id="atlas-chrome"></div>
<main id="app" class="wrap ac-main"></main>
<script src="/atlas/atlas-core.js"></script>
<script>
Atlas.mountChrome('plan');            // explore | plan | trips | tools | city
Atlas.onData(render);                 // runs now (baked-in data) and again after a successful hydrate
function render(){ document.getElementById('app').innerHTML = '...'; }
</script>
</body>
</html>
```

`plan.html`, `trips.html`, `tools.html`, `city.html` already exist in this shape with a placeholder line. Replace the placeholder inside `<main>` and add your script after `mountChrome`.

## Data rules

- Read data as `Atlas.data.CITIES` at call time. **Never cache** `const C = Atlas.data.CITIES` at page load: a successful hydrate from `/api/atlas/content` replaces whole collections (`Atlas.data.CITIES = d.CITIES`). Re-read inside `render()`.
- Render once immediately from baked-in data, then again when the data changes: `Atlas.onData(fn)` does both (calls `fn` now, and again after a successful hydrate). `Atlas.ready` is the underlying Promise (resolves after the hydrate attempt, success or failure); `Atlas.hydrated` says which.
- `/api/atlas/*` does not exist on the local server, so locally hydrate always fails and baked-in data stays. That is the normal local state.
- Escaping: use `Atlas.esc(s)` for any data placed in HTML. Two data fields intentionally hold HTML and must NOT be escaped: the attraction `why` text in `A[i][5]` (some contain `<span class='warn'>`) and the corridor `branch` text in `COR[i][4]` (contains `<b>`). Everything else is plain text. Prices (`PRICES` values) are plain text.
- `Atlas.HOME` is `"Greenville"`. `COORDS` has Greenville, but `CITIES` does not (CITIES keys are the 23 destinations).
- Cost functions throw if a city has no `COORDS` entry (same as the original code).

## `Atlas.*` surface

| Member | Signature / shape |
|---|---|
| `Atlas.data` | `{THEMES, SPOKES, CITIES, EVENTS, TRIP_EVENTS, PRICE_DATES, HOTELS, PRICES, A, COR, COORDS, PRESETS, PLAYBOOKS}` (shapes below) |
| `Atlas.HOME` | `"Greenville"` |
| `Atlas.fetch(url, opts)` | `fetch` with `Authorization: Bearer <fp_auth.access_token>`; on 401 refreshes once via `/api/auth/refresh` and retries. Returns the `Response`. |
| `Atlas.ready` | `Promise<void>`, resolves after the `/api/atlas/content` attempt. Never rejects. |
| `Atlas.hydrated` | `boolean`, true after a successful hydrate. |
| `Atlas.onData(fn)` | Calls `fn()` now and again after a successful hydrate. |
| `Atlas.settings.get()` | `{gas, mpg, food, hotel, nights, buffer, carRate, localMi, adults, kids}` (numbers, a copy). Defaults: 3.15, 25, 90, 150, 2, 10, 65, 30, 2, 2. |
| `Atlas.settings.set(partial)` | Merges, coerces to numbers (`parseFloat \|\| 0`), saves to `localStorage.atlas_settings`, notifies if anything changed. Returns the new settings. |
| `Atlas.settings.reset()` / `.defaults` / `.fields` | Restore defaults; the default values; `[key,label,prefix,step,min]` rows used by the drawer. |
| `Atlas.onSettings(fn)` | `fn(settingsSnapshot)` on every change (also from another tab). Returns an unsubscribe function. Re-run your cost maths here. |
| `Atlas.auth` | Getter, read live from `fp_auth`: `{signedIn: boolean, parent: boolean, email: string}`. |
| `Atlas.trips.list()` | `Promise<Trip[]>`, ordered by `start_date` (nulls last). |
| `Atlas.trips.create(trip)` | `Promise<Trip>`. `trip` = `{name, start_date?, stops?, mode?, est_cost?, notes?}`. |
| `Atlas.trips.update(id, patch)` | `Promise<Trip>`; patch holds only the fields to change. |
| `Atlas.trips.remove(id)` | `Promise<{deleted:true}>`. |
| `Atlas.marks.list()` | `Promise<[{city, visited, visited_on, updated_at}]>`. |
| `Atlas.marks.set(city, {visited, visited_on})` | `Promise<mark>` (upsert). `visited_on` is `YYYY-MM-DD` or null. |
| `Atlas.mountChrome(activeKey)` | Fills `#atlas-chrome` with the header (title, "← Planner", Explore / Plan / Trips / Tools-if-parent, gear button + settings drawer). `city` highlights Explore. |
| `Atlas.cityUrl(city)` | `"/atlas/city.html?c=" + encodeURIComponent(city)` |
| `Atlas.esc(str)` | HTML-escape (`& < > " '`). `null`/`undefined` become `""`. |
| `Atlas.hav(a, b)` | Great-circle miles between `[lat,lon]` pairs. |
| `Atlas.dist(cityA, cityB)` | Estimated road miles (`hav * 1.2`) using `COORDS`. |
| `Atlas.money(n)` | `"$1,234"` (rounded). |
| `Atlas.hotelRate(city)` | Researched `HOTELS[city]` if present, else `settings.hotel`. |
| `Atlas.isoDate(date)` | `"YYYY-MM-DD"` in local time. |
| `Atlas.fmtD(date)` / `Atlas.fmtRange(a, b)` | `"Aug 3"` / `"Aug 3–8"` or `"Aug 30 – Sep 2"`. |
| `Atlas.cityCost(city, nights?)` | One city, round trip from home. `nights` defaults to `settings.nights`. Returns `{city, nights, miles, fuel, hotelRate, hotelEstimated, lodge, foodDays, food, pct, total}`. `total = (fuel+lodge+food) * (1+pct/100)`. `miles` is the round trip. |
| `Atlas.tripMiles(seq)` | Loop miles Greenville → `seq` → Greenville. `seq` = array of city names (objects with `.city` are accepted). |
| `Atlas.tripCost(stops)` | `stops = [{city, nights}]`. Returns `{stops:[{city,nights,hotelRate,lodge,hotelEstimated}], miles, fuel, lodge, totalNights, days, food, subtotal, buffer, pct, total, gas, mpg}`. |
| `Atlas.recommendRoute(cities)` | Array of city names (or `{city}`) in, array of city names out: nearest-neighbour from home then 2-opt. |
| `Atlas.flyCost({stops, dep, airfare, trip?})` | Drive vs fly. `dep` is `"GSP"\|"ATL"\|"CLT"` (default GSP); `airfare` is the whole-party round trip in dollars (0 = unknown); `trip` is an optional precomputed `tripCost`. Returns `{far:{city,airport}\|null, dep, airfare, toAirport, carRate, rental, localGas, days, lodge, food, pct, driveTotal, flyTotal, winner:'fly'\|'drive'\|'' , delta}`. `winner` is `''` when `airfare` is 0. |
| `Atlas.findTrips({budget, nights})` | Trip Finder: up to 8 `{route, nightsArr, N, miles, fuel, lodge, foodc, tot, headroom, stops}` that fit the budget, most stops first then cheapest. |
| `Atlas.DEP_OPTS`, `Atlas.airportDriveFuel(code, gas, mpg)`, `Atlas.farthestStop(stops)` | Airport helpers used by `flyCost`. |
| `Atlas.toast(html)` | Shows the existing `.toast` pill for ~4s (creates `#toast` if missing). |
| `Atlas.copyText(str)` | `Promise<boolean>` clipboard copy with a textarea fallback. |

Trip API errors: `Atlas.trips.*` and `Atlas.marks.*` throw `Error` with a readable `message` (server `error` text, or "Please sign in on the Planner first." for an anonymous 401, or "Could not reach the server..." on network failure). `err.status` holds the HTTP status when there was a response. Writes need a parent login; for non-parents the API answers 401 "Parent login required". Gate write buttons on `Atlas.auth.parent`.

A `Trip` row is `{id, name, start_date: "YYYY-MM-DD"|null, stops: [{city, nights}], mode: "drive"|"fly", est_cost: number|null, notes: string, created_at}`. Server limits: name non-empty, at most 20 stops, nights integer 0-30, notes at most 2000 chars, est_cost non-negative.

## Data shapes (one real entry each)

```js
THEMES      { wa: ["Water", "var(--t-wa)"] }                      // key -> [label, css colour]
SPOKES      { NW: "NW · Tennessee Valley → Gateway West" }        // key = CITIES[x].spoke
CITIES      { Atlanta: { spoke: "S", drive: "~2h", overlook: "Doll's Head Trail — a free folk-art walk ..." } }
            // 23 destinations. Some hydrated payloads may add `airport` (IATA) and `isHome`.
A           [ ["Georgia Aquarium", "Atlanta", "an,wa,sc", "SIG", "both",
               "Top-5 world aquarium — whale sharks, belugas, otters; summer Glow Nights."] ]
            // [name, city, comma-separated theme keys, type SIG|SOL|GEM|OFF, age little|older|both, why (trusted HTML)]
COR         [ ["Tennessee Valley → Gateway West", "NW · Spoke 01",
               [["Greenville","home"],["Chattanooga","stay"],["Nashville","stay"],["St. Louis","stay"]],  // node kinds: home|stay|pass
               ["2.5h","2h","4.5h"],                               // drive time after each node
               "Branch: <b>Chattanooga</b> ▸ 1.5h ▸ <b>Huntsville</b> (Space & Rocket Center)"] ]  // branch (trusted HTML)
PRICES      { "Georgia Aquarium": "From $54.99/person dated" }    // attraction name -> text
PRICE_DATES { Atlanta: "Jul 2026" }                               // city -> when prices were researched
HOTELS      { Atlanta: 165 }                                      // city -> researched nightly rate ($)
EVENTS      { Atlanta: [ { n: "Time Out Atlanta", u: "https://www.timeout.com/atlanta/things-to-do",
                           d: "curated things-to-do & events" } ] }   // evergreen calendar links
TRIP_EVENTS { Charlotte: { window: "Aug 1–8, 2026", foundNice: "Jul 4, 2026", expires: "2026-08-08",
                           items: [ { d: "2026-08-03", n: "“Watermelon Day” @ Museum of Life & Science",
                                      m: "Durham · Mon Aug 3 · w/ admission · ..." } ] } }
            // baked research for specific dates; items with `d` before today should be hidden (all current ones are past)
PRESETS     { "Gateway West": ["Chattanooga", "Nashville", "St. Louis"] }   // named quick routes
COORDS      { Greenville: [34.85, -82.39], Atlanta: [33.75, -84.39] }       // 24 entries: home + 23 cities
PLAYBOOKS   [ { city: "Atlanta", pitch: "...",
                perfectDay: [ { when: "Morning", stop: "Georgia Aquarium", note: "..." } ],
                signature: "Georgia Aquarium", rainyDay: "Fernbank Museum", foodStop: "...",
                kidTip: "...", stayArea: "Midtown — ..." } ]                // 23 entries, one per city
```

Counts in the baked-in data: THEMES 8, SPOKES 5, CITIES 23, A 304, PRICES 304, EVENTS 23, PRICE_DATES 23, HOTELS 23, TRIP_EVENTS 2, COR 5, COORDS 24, PRESETS 6, PLAYBOOKS 23.

## CSS classes worth reusing (all in `atlas.css`)

Design tokens (`:root`): `--ink --pine --pine2 --paper --card --amber --amber-deep --border --muted --shadow`, fonts `--serif --sans --mono`, theme colours `--t-wa --t-sc --t-an --t-na --t-hi --t-tp --t-fo --t-wk`.

- Layout: `.wrap` (max 1180px, padded), `.ac-main` (page padding), `.page-title`, `.page-sub`, `.placeholder`, `.sec-head` / `.sec-num` / `.sec-desc`, `.sp` + `.sp-title` (labelled sub-panel), `.panel` (white card), `.split` (two columns, one on phones), `.grid` (auto-fill card grid), `.empty`.
- Cards and badges: `.card` (+ `.card-top`, `.why`, `.card-tags`, `.tg` theme tag with inline background, `.age`), `.badge.SIG|GEM|SOL|OFF`, `.price`, `.price.pending`, `.pb` playbook card family (`.pb-head .pb-pitch .pb-day .pb-meta`).
- Controls: `.chip` (+ `aria-pressed="true"` state, `.chip.type`, `.chip.age`, `.swatch`), `.search`, `.qrbtn` (outlined pill button; `.qrbtn.solid` filled), `.linkbtn`, `.reset`, `.updateBtn`, `.assume` + `.ip` (labelled numeric input with optional `<span>$</span>` prefix), `.tripdate`.
- Trip planning: `.itinerary`, `.itin-node.home`, `.itin-stop` (+ `.grip .nin .rm`, `.dragging .drop-before .drop-after`), `.itin-leg`, `.tripsummary` / `.ts-row` (`.sub`, `.total`), `.citybudget` / `.bb`, `.mc-grid` / `.mc-card` (`.win`) / `.mc-verdict` for drive-vs-fly, `.tf-card` family for finder results.
- Events: `.events` / `.ev`, `.tripevents` / `.te-stop` / `.te-dates` / `.te-copy`.
- Corridor diagram: `.corridor`, `.route`, `.node` (`.home .stay .pass`), `.seg`, `.branch`, `.legend`.
- Feedback: `.toast` (`.show`), `.rec` + `.move.add|up|watch`, `.flag`.
- Chrome (owned by `mountChrome`, do not restyle): `.ac-bar .ac-wrap .ac-back .ac-title .ac-nav .ac-link .ac-gear .ac-scrim .ac-drawer`.

The old index-only classes (`.mast`, `.site-nav`, `.toolbar`) are still in the stylesheet because `index.html` still uses them. New pages should use the shared header from `mountChrome` instead.

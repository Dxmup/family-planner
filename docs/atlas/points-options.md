# Points options on a saved trip

A saved Atlas trip can carry award-flight ("points") options. A local tool run from Claude Code on the
family's home PC researches them (point.me, PointsYeah) and writes them with one API call. The Trips page
shows them in the trip's expanded detail. Nothing is booked and nothing is compared with the cash estimate.

## Storage

`atlas_trips.points_options jsonb` (nullable), added by `supabase/migrations/20261127000000_trip_points_options.sql`.
Until that migration is applied, a write that includes `points_options` fails with a 400 that says so; reads and
every other trip operation are unaffected. `GET /api/trips` already returns all columns.

## Writing: `PUT /api/trips/:id`

Parent login required (`Authorization: Bearer <access token of a parent account>`), same as every trip write.
Send only the field(s) to change:

```
PUT /api/trips/12
Content-Type: application/json

{ "points_options": {
    "researchedAt": "2026-11-27",
    "options": [
      { "program": "United MileagePlus", "miles": 120000, "taxes": 45.6, "cabin": "economy",
        "airline": "United", "from": "GSP", "to": "LIS", "depart": "2027-03-05", "return": "2027-03-14",
        "stops": 1, "transferFrom": "Chase UR, Bilt", "source": "point.me",
        "url": "https://point.me/...", "note": "saver space on the outbound only" }
    ],
    "notes": "Business is 3x the miles this week." } }
```

`{ "points_options": null }` clears it. The response is the whole updated trip row.

| Field | Rule |
|---|---|
| `points_options` | An object, or `null` to clear. Anything else (array, string, number) is a 400. |
| `researchedAt` | `YYYY-MM-DD`, a real date. Omitted: today (UTC). Present but invalid: 400. |
| `options` | Array, at most 12 kept (the first 12 valid ones, in the order sent). Omitted: `[]`. A non-array is a 400. |
| `notes` | String, clipped to 600 characters. |

Each option is normalised; an option that is not an object, has no `program`, or has no usable `miles` is
silently dropped (the call still succeeds).

| Option field | Stored as |
|---|---|
| `program` | Required string, whitespace collapsed, at most 80 chars. E.g. `"United MileagePlus"`. |
| `miles` | Required whole number > 0 (max 10,000,000), the **total for the whole party**. Numeric strings (`"85,000"`) are accepted and rounded. |
| `taxes` | Number >= 0 in USD for the whole party, 2 decimals, or `null` (also used for anything unusable). |
| `cabin` | `"economy"`, `"premium"`, `"business"`, `"first"` or `""` (case-insensitive; `"premium economy"` and `"coach"` are mapped). |
| `airline` | String, at most 60. |
| `from`, `to` | 3-letter IATA code, upper-cased, else `""`. |
| `depart`, `return` | `YYYY-MM-DD` real date, else `""` (`return` is `""` for one-way). |
| `stops` | Integer 0 to 4, else `null`. |
| `transferFrom` | String, at most 120. Bank programs that transfer in, e.g. `"Chase UR, Amex MR"`. |
| `source` | String, at most 40. `"point.me"`, `"PointsYeah"` or another short name. |
| `url` | An `http(s)` URL of at most 800 chars, else `""`. Other schemes (`javascript:` and so on) are dropped. |
| `note` | String, at most 300. |

Unknown fields are dropped. The stored object is exactly
`{ researchedAt, options: [ {program, miles, taxes, cabin, airline, from, to, depart, return, stops, transferFrom, source, url, note} ], notes }`.

Errors are `{ "error": "<message>" }` with status 400 (invalid body, or the column is missing), 401 (not a parent
or signed out) or 404 (no such trip id).

## What the page shows

In a trip's expanded detail, a "Points options" section: the options sorted by miles ascending, each with program,
miles ("for the whole party"), taxes, cabin, airline and route, stops, transfer partners, source and a link out; then
`notes` and "found <date> on point.me / PointsYeah, check before booking". Parents also get "Clear points options"
(with a confirm). With nothing stored, non-parents see nothing and parents see one quiet line saying the options appear
after running the points check from Claude Code on the home PC. All text is escaped; only `http(s)` links render.

## Manual flow (Trips page, parents only)

No automation is involved; the owner uses his own logged-in browser. In an upcoming, dated trip's expanded detail:

1. **Check points** shows what to search (From GSP, also try ATL and CLT; To the farthest stop, with an airport code only
   when the Atlas data has one; depart and return dates; party size from the Atlas settings), each value with a Copy
   button, plus "Open point.me" and "Open PointsYeah" buttons that open the sites in new tabs.
2. **Add a points option** (collapsed form) saves what he found. He types miles and taxes **per person**; the page
   multiplies by the party size, stores the **whole-party totals**, fills `depart`/`return` from the trip, adds a note
   saying the totals are per-person figures times the party size, appends to the existing options (keeping `notes`)
   and sends the whole `points_options` object with `PUT /api/trips/:id`. At 12 options it refuses to send.
3. Each saved option has a **Remove** button (inline confirm). It writes the list without that option, or `null`
   when nothing (no options and no notes) would be left.

The two destination URL templates live in one constant, `POINTS_SITES`, at the top of the script in
`public/atlas/trips.html`. Today they are just the sites' front doors. To get pre-filled searches, run a search on the
site, copy the URL from the address bar, and replace the values with the placeholders `{from}`, `{to}`, `{depart}`,
`{return}`, `{adults}`, `{children}` (substituted URL-encoded).

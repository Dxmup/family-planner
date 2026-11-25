# Rock-bottom flight engine (`/api/flights`)

Finds the true cheapest way to fly a route — in **dollars or points** — by fanning
out to every configured price source and running cash-vs-points arbitrage.

## Why it exists

The Claude chat connectors (Kiwi, Otto) already do great **cash** search live in a
conversation. But:

- Those connectors are **chat-only** — a deployed web app can't call them.
- No connector exists for **award/points availability** or **transfer arbitrage**.

This engine fills both gaps: it's callable from the atlas app, and it adds the
points half — award seats (via seats.aero) plus the math to compare paying cash vs.
miles you hold vs. bank points transferred (bonus-aware) into the right program.

## Shape

```
/api/flights?from=GSP&to=MCO&depart=2026-08-15&return=2026-08-19
            &adults=2&children=2&cabin=economy
            &held=AMEX_MR:90000,AEROPLAN:12000
```

Fan-out (all parallel, all optional):

| Source | Module | Env key | Gives you |
|---|---|---|---|
| Kiwi / Tequila | `_lib/providers/kiwi.js` | `KIWI_API_KEY` | cash fares + virtual-interline routings |
| seats.aero | `_lib/providers/seatsaero.js` | `SEATS_AERO_API_KEY` | award seats across 20+ mileage programs |
| Valuations/bonuses | `_lib/valuations.js` | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (optional) | live overlay on built-in defaults |

The arbitrage brain (`_lib/arbitrage.js`) then converts every award to a
dollar-equivalent using your valuations + transfer map + live bonuses, and ranks
cash and award options together by real cost.

On top of that sits the **rewards decision layer** (`_lib/scoring.js` + `_lib/wallet.js`),
which turns "cheapest in dollars" into "best for this family": free-night certificates,
use-or-lose credits, Companion Pass, a surcharge for spending flexible currencies, and
travelling-with-kids convenience. See [decision-layer.md](./decision-layer.md).

**Graceful degradation:** any source without its key just reports
`configured:false` and is skipped. The endpoint is useful with a single key wired
up and gets stronger as you add the rest.

## Setup checklist

1. **Kiwi/Tequila key** → `KIWI_API_KEY` (Vercel env var). *If Tequila access is
   gated, swap `kiwi.js` for Duffel or SerpAPI Google Flights — same return shape.*
2. **seats.aero Pro** → `SEATS_AERO_API_KEY`. This is the single highest-leverage
   add for the points half. Verify the Partner API endpoint/fields in `seatsaero.js`
   against current docs.
3. **Supabase tables** (optional but recommended) → run
   `supabase/migrations/0001_flight_points_engine.sql`, then set `SUPABASE_URL` +
   `SUPABASE_SERVICE_KEY`. Lets you edit valuations / add transfer bonuses without a
   redeploy.
4. **Your balances** → pass `?held=` per request, or store in the `point_balances`
   table.
5. **Rewards wallet** (unlocks the decision layer) → run
   `supabase/migrations/0005_rewards_wallet.sql` and fill in your certificates,
   credits, cards, and status. Without it the engine skips the decision layer and
   behaves exactly as before.

## Tuning the brain

- **Valuations** (`point_valuations` table or `DEFAULT_VALUATIONS`): cents-per-point
  per program. Edit to match how *you* actually redeem.
- **Transfer map** (`TRANSFER_MAP`): which bank currency feeds which airline, at what
  ratio.
- **Transfer bonuses** (`transfer_bonuses` table or `DEFAULT_TRANSFER_BONUSES`): the
  live promos that often decide rock bottom. Keep these current.

## What still isn't automatable

- **Transferring points** (Amex/Chase/etc. → airline): no consumer API. The engine
  tells you exactly what to transfer; you click the button.
- **Booking award tickets**: manual on the airline site. Cash booking can be
  automated via Otto (in chat) or Duffel (in app).

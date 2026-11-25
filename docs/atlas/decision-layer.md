# Rewards decision layer

Sits between the search providers and the recommendation. Search finds inventory;
this decides **how the family should pay for it**.

```
Kiwi / SerpAPI / seats.aero      ← inventory
        ↓
   normalizer (providers/*.js)   ← one shape, decision inputs attached
        ↓
   arbitrage.js                  ← cash vs. points, in dollars
        ↓
   scoring.js                    ← this layer: benefits, flexibility, convenience
        ↓
   /api/flights response         ← ranked strategies + confidence
```

## Two numbers, deliberately

Conflating these is how a rewards optimizer starts reporting a booking that costs
minus a hundred dollars.

| Field | Meaning |
|---|---|
| `familyUsd` | **Money.** Cash owed plus the opportunity value of points spent, minus benefits that genuinely pay part of the bill. Floored at 0. |
| `decisionScore` | **Ranking.** `familyUsd` plus preference adjustments (flexibility surcharge, convenience). Can go negative — it is a score, not a price. |

Report `familyUsd` to a human. Sort on `decisionScore`.

Urgency is in neither. An expiring certificate is not worth more dollars — it just
wins ties. It rides along as `urgency` and is consumed by the tie-break ladder.

## The stages

**Certificates** (`applyCertificates`) — a free-night cert covers an award whose
points fit under its cap; a dollar-denominated cert covers up to its cash value.
Benefits are capped at the booking price: they can zero a booking out, never pay you.

**Credits** (`applyCredits`) — use-or-lose annual credits, scoped by `applies_to`,
spent most-urgent-first against whatever is still owed after a certificate.

**Companion Pass** (`applyCompanionPass`) — an on/off switch. When enabled, one adult
flies as the companion, so the adult share of an airfare is halved. Children still
pay. Scoped by `program` when set, so a Southwest pass doesn't discount a Delta fare.
Seeded **off** — flip `companion_pass.enabled` when the pass is earned.

**Flexibility** (`flexibilitySurcharge`) — spending a transferable bank currency costs
optionality that its cents-per-point doesn't capture. Charged as a percent surcharge
so that on a level comparison the restricted currency goes first.

**Convenience** (`convenienceAdjustment`) — the cheapest itinerary is not the best one
with two kids attached. Prices nonstop, connections, red-eyes, and drive time to the
departure airport. This is what makes the engine choose GSP over a cheaper ATL fare
*on purpose*.

> Note: the Drive vs. Fly panel already prices the **fuel** for the drive to ATL/CLT.
> These weights price the family's **time**, which is a separate and usually larger
> cost. They are complementary, not duplicates.

**Tie-break ladder** (`compareScored`) — within `$25`, prefer in order: most urgently
expiring benefit → least flexible currency (certificate → hotel points → airline miles
→ cash → bank points last) → the option the family can actually fund.

## Configuration

All of it is data. Nothing below requires a redeploy.

| Table | What it holds |
|---|---|
| `reward_certificates` | Free-night / companion / upgrade certs with caps and expiry |
| `reward_credits` | Annual credits with a remaining balance and use-or-lose date |
| `companion_pass` | Single-row on/off switch + optional program scope |
| `elite_status` | Status held and where it comes from |
| `cards` | Card portfolio as data — earn rates, credits, statuses, transfer partners |
| `behavioral_weights` | What this family will pay to avoid friction (see below) |

Defaults live in `DEFAULT_BEHAVIORAL_WEIGHTS` (`api/_lib/wallet.js`) and are overlaid
by the `behavioral_weights` table:

| Weight | Default | Meaning |
|---|---|---|
| `nonstop_bonus` | 80 | USD the family will pay for a nonstop |
| `extra_connection_penalty` | 60 | USD per connection |
| `airport_drive_penalty_per_hour` | 25 | USD per hour driving, applied each way |
| `red_eye_penalty` | 100 | USD penalty for a red-eye departure |
| `flexibility_penalty_pct` | 12 | % surcharge on spending transferable bank points |
| `urgency_window_days` | 90 | Benefits expiring inside this window get urgency |
| `urgency_max_bonus_pct` | 25 | Max urgency weight on the last day |

Chase UR is valued at **1.75¢** — a realistic baseline rather than a best-case
transfer. UR can beat that with a well-timed transfer, but not on demand, and pricing
every redemption at the peak makes the engine burn points on trips where cash was the
better call.

## Confidence

`/api/flights` returns a `confidence` object derived from what actually reported back
— never an assumption. It drops to `medium` when a source or the wallet is missing,
and `low` when neither cash nor award inventory was queried at all. Anything the layer
couldn't determine is listed in `unknowns` and folded into the reason string.

The engine must never imply it saw inventory it never queried.

## Graceful degradation

No wallet data → `rankOptions` skips the decision layer entirely and behaves exactly
as it did before: rank on raw economic cost. Every wallet table is read independently,
so a migration that hasn't been applied yet doesn't blank out the ones that have.

## Known gaps

- **Southwest is invisible.** Neither Kiwi, SerpAPI/Google Flights, nor seats.aero
  returns Southwest inventory. Once the Companion Pass is earned, the engine can score
  it but no configured provider will surface a fare to apply it to. A Southwest data
  path is the blocking dependency for that benefit.
- **No hotel candidates yet.** Certificates and portal credits are overwhelmingly
  hotel benefits, so `applyCertificates` and the hotel half of `applyCredits` are
  built but largely idle until a hotel provider lands.
- **No LLM narrative layer.** The layer emits ranked strategies with a `factors[]`
  explanation trail per option. Turning those into prose is a separate step.

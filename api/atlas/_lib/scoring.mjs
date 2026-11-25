// The decision layer: stages 5, 6 and 7 of the rewards optimizer.
//
// arbitrage.js answers the economic question — "what does this option really cost in
// dollars, once points are priced at what they're worth to us?". That number is
// necessary but not sufficient. Three things still separate it from a decision a
// family would actually make:
//
//   Stage 5  Expiration urgency  — a certificate that dies in three weeks is worth
//                                  more than its face value, because the alternative
//                                  is losing it outright.
//   Stage 6  Flexibility         — a Chase point is worth more than its cpp implies,
//                                  because it can still become eight other things.
//                                  Spend restricted currency first.
//   Stage 7  Convenience         — the cheapest itinerary is not the best itinerary
//                                  when two children are attached to it.
//
// Plus the household benefits no search provider can see: certificates, use-or-lose
// credits, and Companion Pass.
//
// Pure functions, no I/O. Everything is priced in dollars so it stays comparable to
// effectiveUsd, and every adjustment is recorded in `factors[]` so a recommendation
// can explain itself instead of asserting a number.

import { tierForCurrency, FLEXIBILITY_TIER } from "./wallet.mjs";

const DAY_MS = 86400000;

// Whole days from `today` until an ISO date. Negative when already past.
export function daysUntil(iso, today = new Date()) {
  if (!iso) return null;
  const then = new Date(`${iso}T00:00:00Z`).getTime();
  if (Number.isNaN(then)) return null;
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((then - now) / DAY_MS);
}

// ---------------------------------------------------------------------------
// Stage 5 — urgency.
// A benefit expiring inside the urgency window earns a discount that scales linearly
// from 0 at the window's edge to urgency_max_bonus_pct on its last day. Expired
// benefits return null so callers skip them entirely.
// ---------------------------------------------------------------------------
export function urgencyDiscountPct(expires, weights, today = new Date()) {
  const days = daysUntil(expires, today);
  if (days == null) return 0; // no expiry known -> no urgency, not an error
  if (days < 0) return null; // already gone
  const window = weights.urgency_window_days ?? 90;
  const max = weights.urgency_max_bonus_pct ?? 25;
  if (days >= window) return 0;
  return +((1 - days / window) * max).toFixed(2);
}

// ---------------------------------------------------------------------------
// Stage 6 — flexibility surcharge.
// Burning a transferable bank currency costs the family optionality that its
// cents-per-point valuation doesn't capture. Charge for it, so that when two options
// are economically level the restricted currency goes first.
// ---------------------------------------------------------------------------
export function flexibilitySurcharge(pay, weights) {
  if (!pay || pay.method !== "points") return { usd: 0, factors: [] };
  const currency = pay.pointsCurrency || pay.program;
  if (tierForCurrency(currency) !== FLEXIBILITY_TIER.bank_points) return { usd: 0, factors: [] };

  const pct = weights.flexibility_penalty_pct ?? 0;
  if (!pct) return { usd: 0, factors: [] };

  // Value of the points being spent, which is what we're surcharging.
  const pointsValueUsd = pay.dollarValueOfPoints ?? 0;
  const usd = +((pointsValueUsd * pct) / 100).toFixed(2);
  if (!usd) return { usd: 0, factors: [] };
  return {
    usd,
    factors: [{
      kind: "flexibility_penalty",
      usd,
      detail: `${currency} is transferable to multiple programs — ${pct}% surcharge for spending optionality`,
    }],
  };
}

// ---------------------------------------------------------------------------
// Stage 7 — convenience.
// Negative usd = this itinerary is worth paying more for. Positive = it costs the
// family something the fare doesn't show.
//
// ctx.originDriveHours maps an airport code to one-way driving time from home;
// the penalty applies in both directions.
// ---------------------------------------------------------------------------
export function convenienceAdjustment(option, weights, ctx = {}) {
  const factors = [];
  let usd = 0;

  // These are flight tolerances. A hotel candidate has no connections or red-eyes;
  // scoring one as though it did would invent preferences out of nothing.
  if (option.type === "hotel") return { usd: 0, factors, connectionsKnown: true };

  const connections = option.connections ?? (option.directOnly === true ? 0 : null);

  if (connections === 0) {
    const bonus = weights.nonstop_bonus ?? 0;
    if (bonus) {
      usd -= bonus;
      factors.push({ kind: "nonstop_bonus", usd: -bonus, detail: "Nonstop" });
    }
  } else if (connections > 0) {
    const penalty = (weights.extra_connection_penalty ?? 0) * connections;
    if (penalty) {
      usd += penalty;
      factors.push({
        kind: "connection_penalty",
        usd: penalty,
        detail: `${connections} connection${connections > 1 ? "s" : ""}`,
      });
    }
  }

  if (option.redEye) {
    const penalty = weights.red_eye_penalty ?? 0;
    if (penalty) {
      usd += penalty;
      factors.push({ kind: "red_eye_penalty", usd: penalty, detail: "Red-eye departure" });
    }
  }

  // Driving to a further airport is a real cost even when the fare is lower.
  const origin = originOf(option);
  const driveHours = origin ? ctx.originDriveHours?.[origin] : null;
  if (driveHours) {
    const perHour = weights.airport_drive_penalty_per_hour ?? 0;
    const penalty = +(driveHours * 2 * perHour).toFixed(2); // there and back
    if (penalty) {
      usd += penalty;
      factors.push({
        kind: "airport_drive_penalty",
        usd: penalty,
        detail: `${driveHours}h each way to ${origin}`,
      });
    }
  }

  return { usd: +usd.toFixed(2), factors, connectionsKnown: connections != null };
}

// First airport code in a normalized route string ("GSP->ATL, ATL->MCO").
function originOf(option) {
  const m = /^([A-Z]{3})/.exec(option.route || option.raw?.route || "");
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Companion Pass — an on/off switch.
//
// When it's on, one adult flies as the companion, so the adult half of the fare is
// cut in half. Children still pay. That's the whole rule: no per-passenger fare
// breakdown to chase, no expiry math, nothing for a provider to fail to report.
//
// Scoped by program when `program` is set on the wallet toggle (a Southwest pass
// shouldn't discount a Delta fare); unscoped if it's null.
// ---------------------------------------------------------------------------
export function applyCompanionPass(option, wallet, ctx = {}) {
  const pass = wallet.companionPass;
  if (!pass?.enabled) return { usd: 0, factors: [] };
  if (option.pay?.method !== "cash") return { usd: 0, factors: [] }; // airfare only
  if (pass.program && programOf(option) !== pass.program) return { usd: 0, factors: [] };

  const adults = ctx.adults ?? 0;
  const passengers = ctx.passengers ?? adults;
  if (adults < 2 || !passengers) return { usd: 0, factors: [] };

  // The adults' share of the party fare, halved.
  const adultShare = (option.effectiveUsd ?? 0) * (adults / passengers);
  const saved = +(adultShare / 2).toFixed(2);
  if (saved <= 0) return { usd: 0, factors: [] };

  return {
    usd: -saved,
    factors: [{
      kind: "companion_pass",
      usd: -saved,
      detail: `Companion Pass${pass.program ? ` (${pass.program})` : ""} — one adult flies as companion`,
    }],
  };
}

// ---------------------------------------------------------------------------
// Certificates. A free-night certificate covers an award night up to its points cap;
// a dollar-denominated cert covers up to its cash value. Urgency (stage 5) makes a
// soon-to-expire cert preferable even when the raw dollars are a wash.
// ---------------------------------------------------------------------------
export function applyCertificates(option, wallet, today = new Date()) {
  const certs = wallet.certificates || [];
  if (!certs.length) return { usd: 0, factors: [], usedTier: null };

  const program = programOf(option);
  let best = null;

  for (const cert of certs) {
    if (!cert.quantity) continue;
    const urgency = urgencyDiscountPct(cert.expires, wallet.weights, today);
    if (urgency === null) continue; // expired

    let coveredUsd = 0;
    if (cert.maxPoints != null && option.pay?.method === "points" && cert.program === program) {
      if ((option.pay.miles ?? Infinity) > cert.maxPoints) continue; // cert too small
      coveredUsd = option.pay.dollarValueOfPoints ?? 0;
    } else if (cert.cashValue != null && option.pay?.method === "cash") {
      coveredUsd = Math.min(cert.cashValue, option.effectiveUsd ?? 0);
    } else {
      continue;
    }
    if (coveredUsd <= 0) continue;

    if (!best || coveredUsd > best.coveredUsd) best = { cert, coveredUsd, urgency };
  }

  if (!best) return { usd: 0, factors: [], usedTier: null, urgency: 0 };

  const factors = [{
    kind: "certificate",
    usd: -best.coveredUsd,
    detail: `${best.cert.label} covers this booking`,
  }];
  // Urgency does NOT invent dollars — it's a preference signal that breaks near-ties
  // in favor of the thing that's about to expire. Kept out of the money figure.
  if (best.urgency > 0) {
    factors.push({
      kind: "expiry_urgency",
      usd: 0,
      urgency: best.urgency,
      detail: `Expires ${best.cert.expires} (${daysUntil(best.cert.expires, today)} days) — use it or lose it`,
    });
  }
  return {
    usd: -best.coveredUsd,
    factors,
    usedTier: FLEXIBILITY_TIER.certificate,
    urgency: best.urgency,
  };
}

// ---------------------------------------------------------------------------
// Credits. Use-or-lose annual credits scoped to a spend category. Same urgency rule.
// ---------------------------------------------------------------------------
const CREDIT_SCOPE = {
  airfare: (o) => o.kind === "cash" && o.type !== "hotel",
  hotel: (o) => o.type === "hotel",
  portal_travel: (o) => o.kind === "cash",
  baggage: (o) => o.kind === "cash",
  any_travel: () => true,
};

export function applyCredits(option, wallet, today = new Date()) {
  const credits = wallet.credits || [];
  if (!credits.length) return { usd: 0, factors: [] };

  const factors = [];
  let usd = 0;
  let maxUrgency = 0;
  // A credit can only offset money still owed — never below zero.
  let remainingCost = Math.max(0, option.effectiveUsd ?? 0);

  // Spend the most urgent credits first — that's the whole point of stage 5.
  const usable = credits
    .map((c) => ({ c, urgency: urgencyDiscountPct(c.expires, wallet.weights, today) }))
    .filter((x) => x.urgency !== null && x.c.remaining > 0)
    .filter((x) => (CREDIT_SCOPE[x.c.appliesTo] || CREDIT_SCOPE.any_travel)(option))
    .sort((a, b) => b.urgency - a.urgency);

  for (const { c, urgency } of usable) {
    if (remainingCost <= 0) break;
    const applied = Math.min(c.remaining, remainingCost);
    if (applied <= 0) continue;
    remainingCost -= applied;
    usd -= applied;
    factors.push({ kind: "credit", usd: -applied, detail: `${c.card} ${c.kind} — $${applied.toFixed(2)}` });
    if (urgency > 0) {
      maxUrgency = Math.max(maxUrgency, urgency);
      factors.push({
        kind: "expiry_urgency",
        usd: 0,
        urgency,
        detail: `${c.card} credit expires ${c.expires} (${daysUntil(c.expires, today)} days)`,
      });
    }
  }

  return { usd: +usd.toFixed(2), factors, urgency: maxUrgency };
}

// Canonical program key for an option, cash or award.
const CARRIER_TO_PROGRAM = {
  southwest: "SW_RR", delta: "DL_SKYMILES", united: "UA_MP", american: "AA_AADVANTAGE",
  alaska: "ALASKA", jetblue: "JETBLUE_TP", "air canada": "AEROPLAN",
};

function programOf(option) {
  if (option.pay?.program) return option.pay.program;
  if (option.program) return option.program;
  const airlines = String(option.airlines || option.raw?.airlines || "").toLowerCase();
  for (const [name, program] of Object.entries(CARRIER_TO_PROGRAM)) {
    if (airlines.includes(name)) return program;
  }
  return null;
}

// ---------------------------------------------------------------------------
// scoreOption — run every stage over one ranked option.
//
// It deliberately produces TWO numbers, because conflating them is how a rewards
// optimizer starts reporting nonsense like a booking that costs -$104:
//
//   familyUsd     MONEY. What the household actually gives up: cash owed plus the
//                 opportunity value of points spent, minus benefits that genuinely
//                 pay for part of it. Floored at 0 — nothing costs less than free.
//   decisionScore RANKING. familyUsd plus the preference adjustments (flexibility
//                 surcharge, convenience). Can go negative; it's a score, not a price.
//
// Urgency is in neither: an expiring certificate isn't worth more dollars, it just
// wins ties. It rides along as `urgency` and is consumed by compareScored.
// ---------------------------------------------------------------------------
export function scoreOption(option, { wallet, tripContext = {}, today = new Date() }) {
  const weights = wallet.weights || {};
  const factors = [];
  const unknowns = [];
  const baseUsd = option.effectiveUsd ?? 0;

  // --- Benefits: real money off the price, and never more than the price ---------
  let benefitUsd = 0;

  const certs = applyCertificates(option, wallet, today);
  benefitUsd += certs.usd;
  factors.push(...certs.factors);

  // Credits apply to whatever is still owed after a certificate.
  const credits = applyCredits({ ...option, effectiveUsd: baseUsd + benefitUsd }, wallet, today);
  benefitUsd += credits.usd;
  factors.push(...credits.factors);

  const companion = applyCompanionPass({ ...option, effectiveUsd: baseUsd + benefitUsd }, wallet, tripContext);
  benefitUsd += companion.usd;
  factors.push(...companion.factors);

  // Benefits can zero out a booking but can't make it pay you.
  const familyUsd = Math.max(0, +(baseUsd + benefitUsd).toFixed(2));

  // --- Preferences: how this family feels about the option, priced in dollars ----
  const flex = flexibilitySurcharge(option.pay, weights);
  factors.push(...flex.factors);

  const convenience = convenienceAdjustment(option, weights, tripContext);
  factors.push(...convenience.factors);
  if (!convenience.connectionsKnown) {
    unknowns.push(`${option.source} did not report connection count — convenience score is partial`);
  }

  const currency = option.pay?.pointsCurrency || option.pay?.program;
  const tier = certs.usedTier ?? (option.pay?.method === "points" ? tierForCurrency(currency) : FLEXIBILITY_TIER.cash);

  return {
    ...option,
    familyUsd,
    decisionScore: +(familyUsd + flex.usd + convenience.usd).toFixed(2),
    benefitUsd: +benefitUsd.toFixed(2),
    flexibilityUsd: flex.usd,
    convenienceUsd: convenience.usd,
    flexibilityTier: tier,
    urgency: Math.max(certs.urgency || 0, credits.urgency || 0),
    factors,
    unknowns,
  };
}

// ---------------------------------------------------------------------------
// The tie-break ladder. Sort by decision score, but when two options land within a
// few dollars of each other, prefer — in order — the one using the most urgently
// expiring benefit, then the least flexible currency (certificate, hotel points,
// airline miles, cash, bank points last), then the one the family can actually fund.
// ---------------------------------------------------------------------------
export function compareScored(a, b, tieBandUsd = 25) {
  const delta = a.decisionScore - b.decisionScore;
  if (Math.abs(delta) > tieBandUsd) return delta;
  if ((a.urgency || 0) !== (b.urgency || 0)) return (b.urgency || 0) - (a.urgency || 0);
  if (a.flexibilityTier !== b.flexibilityTier) return a.flexibilityTier - b.flexibilityTier;
  if (a.reachable !== b.reachable) return a.reachable === false ? 1 : -1;
  return delta;
}

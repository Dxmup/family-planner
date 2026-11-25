// The arbitrage brain: given cash itineraries and award itineraries for the same
// trip, plus your point valuations / transfer map / live bonuses, decide the
// true rock-bottom way to pay — straight cash, miles you already hold, or bank
// points transferred (with any bonus) into the right airline program.
//
// Pure functions, no I/O — feed it data, get ranked options back. This is what
// no connector gives you: the cash-vs-points comparison.
//
// Pass a `wallet` and it hands off to the decision layer in scoring.js, which turns
// "cheapest in dollars" into "best for this family" — certificates, use-or-lose
// credits, Companion Pass, currency flexibility, and travelling-with-kids convenience.

import { scoreOption, compareScored } from "./scoring.mjs";

// Best way to "fund" an award priced in `miles` of `program`, given the bank
// balances the user holds. Considers: already holding the program's miles, and
// transferring from each bank currency (applying live bonus). Returns the
// cheapest funding path in real dollars, or null if unreachable.
function cheapestFunding({ program, miles, taxes = 0 }, { valuations, transferMap, bonuses }, held) {
  const options = [];

  // 1. Directly hold the airline program's miles?
  if (held?.[program] != null) {
    options.push({
      path: `Redeem ${program} directly`,
      pointsSpent: miles, currency: program,
      dollarValueOfPoints: (miles * (valuations[program] || 0)) / 100,
      enough: held[program] >= miles,
    });
  }

  // 2. Transfer from each bank currency the user holds.
  for (const bank of Object.keys(transferMap)) {
    if (held?.[bank] == null) continue;
    const baseRatio = transferMap[bank][program];
    if (!baseRatio) continue; // no transfer path bank -> program
    const bonus = bonuses.find((b) => b.from === bank && b.to === program);
    const effRatio = baseRatio * (1 + (bonus?.bonusPct || 0) / 100);
    const bankPointsNeeded = Math.ceil(miles / effRatio);
    options.push({
      path: `Transfer ${bank} -> ${program}` + (bonus ? ` (+${bonus.bonusPct}% bonus)` : ""),
      pointsSpent: bankPointsNeeded, currency: bank,
      dollarValueOfPoints: (bankPointsNeeded * (valuations[bank] || 0)) / 100,
      enough: held[bank] >= bankPointsNeeded,
      bonus: bonus || null,
    });
  }

  if (!options.length) return null;
  // "Cost" of an award = the opportunity value of the points you burn + cash taxes.
  // Cheapest funding = lowest (dollarValueOfPoints + taxes), preferring paths you
  // can actually cover.
  options.sort((a, b) => {
    if (a.enough !== b.enough) return a.enough ? -1 : 1;
    return a.dollarValueOfPoints - b.dollarValueOfPoints;
  });
  const best = options[0];
  return { ...best, taxes, effectiveDollarCost: best.dollarValueOfPoints + taxes, alternatives: options };
}

// Fields the decision layer (scoring.js) needs but that live on the provider's raw
// item. Lifting them onto the ranked option keeps scoring.js from reaching into
// provider-specific shapes.
function carryOver(item) {
  return {
    id: item.id,
    connections: item.connections ?? null,
    directOnly: item.directOnly ?? null,
    redEye: item.redEye ?? false,
    passengers: item.passengers ?? null,
    airlines: item.airlines ?? null,
  };
}

// Rank a merged pool of options for one trip.
//   cash:   [{ id, source, priceUsd, route, ... }]
//   awards: [{ id, source, program, miles, taxesUsd, route, ... }]
//   held:   { AMEX_MR: 90000, AEROPLAN: 12000, ... }  (balances; presence = "have it")
//   config: output of loadValuations()
//   wallet: output of loadWallet() — optional. When present, each option is put
//           through the decision layer (certificates, credits, Companion Pass,
//           flexibility, convenience) and ranked on familyUsd instead of effectiveUsd.
//   tripContext: { originDriveHours, passengers } — household trip facts the
//           providers don't know about.
// Returns options sorted cheapest-first, each annotated with how to pay and why.
export function rankOptions({ cash = [], awards = [], held = {}, config, wallet = null, tripContext = {} }) {
  const ranked = [];

  for (const c of cash) {
    ranked.push({
      kind: "cash",
      source: c.source,
      route: c.route,
      effectiveUsd: c.priceUsd,
      pay: { method: "cash", cashUsd: c.priceUsd },
      ...carryOver(c),
      raw: c,
    });
  }

  for (const a of awards) {
    const funding = cheapestFunding(
      { program: a.program, miles: a.miles, taxes: a.taxesUsd || 0 },
      config, held
    );
    if (!funding) {
      // We can see the award seat but user has no path to fund it — still show it,
      // valued at the program's own cpp so it can be compared, flagged unreachable.
      const val = (a.miles * (config.valuations[a.program] || 0)) / 100 + (a.taxesUsd || 0);
      ranked.push({
        kind: "award",
        source: a.source, route: a.route,
        effectiveUsd: val,
        reachable: false,
        pay: { method: "points", program: a.program, miles: a.miles, taxesUsd: a.taxesUsd || 0,
               dollarValueOfPoints: val - (a.taxesUsd || 0),
               note: "No transfer path from your balances — value shown at program cpp." },
        ...carryOver(a),
        raw: a,
      });
      continue;
    }
    ranked.push({
      kind: "award",
      source: a.source, route: a.route,
      effectiveUsd: funding.effectiveDollarCost,
      reachable: funding.enough,
      pay: {
        method: "points",
        program: a.program, miles: a.miles, taxesUsd: a.taxesUsd || 0,
        fundingPath: funding.path, pointsSpent: funding.pointsSpent,
        pointsCurrency: funding.currency, coversBalance: funding.enough,
        dollarValueOfPoints: funding.dollarValueOfPoints,
        alternatives: funding.alternatives,
      },
      ...carryOver(a),
      raw: a,
    });
  }

  // --- Decision layer -------------------------------------------------------
  // Without a wallet this stays exactly the engine it has always been: rank on raw
  // economic cost. With one, every option is re-priced as what it costs THIS family
  // and sorted through the tie-break ladder.
  if (!wallet) {
    ranked.sort((x, y) => x.effectiveUsd - y.effectiveUsd);
    const best = ranked[0] || null;
    const bestCash = byCheapest(ranked, "cash", "effectiveUsd");
    const bestAward = byCheapest(ranked, "award", "effectiveUsd");
    return {
      best, bestCash, bestAward, bestConvenience: null,
      // How much cheaper the winning option is vs the best straight-cash fare.
      savingsVsCashUsd: best && bestCash ? +(bestCash.effectiveUsd - best.effectiveUsd).toFixed(2) : null,
      options: ranked,
      unknowns: [],
    };
  }

  const scored = ranked.map((o) => scoreOption(o, { wallet, tripContext }));
  scored.sort(compareScored);

  const best = scored[0] || null;
  const bestCash = byCheapest(scored, "cash", "decisionScore");
  const bestAward = byCheapest(scored, "award", "decisionScore");
  // The option the family would enjoy most, which is often not the cheapest: lowest
  // convenience cost, tie-broken by price. Only worth surfacing when it isn't `best`.
  const byConvenience = [...scored].sort(
    (a, b) => a.convenienceUsd - b.convenienceUsd || a.decisionScore - b.decisionScore
  )[0] || null;
  const bestConvenience = byConvenience && best && byConvenience.id !== best.id &&
    byConvenience.convenienceUsd < best.convenienceUsd ? byConvenience : null;

  return {
    best,
    bestCash,
    bestAward,
    bestConvenience,
    // Real dollars saved vs. the best straight-cash option — the money figure, not
    // the preference-adjusted score.
    savingsVsCashUsd: best && bestCash ? +(bestCash.familyUsd - best.familyUsd).toFixed(2) : null,
    options: scored,
    // Everything the layer could not determine, so a recommendation can say what it
    // doesn't know instead of implying it saw inventory it never queried.
    unknowns: [...new Set(scored.flatMap((o) => o.unknowns || []))],
  };
}

function byCheapest(list, kind, field) {
  return list.filter((r) => r.kind === kind).sort((a, b) => a[field] - b[field])[0] || null;
}

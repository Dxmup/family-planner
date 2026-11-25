// /api/flights — the rock-bottom flight engine for the Adventure Atlas.
//
// Fans out to every configured price source in parallel — cash (Kiwi/Tequila) and
// award (seats.aero) — then runs the cash-vs-points arbitrage brain against your
// point valuations, transfer map, and any live transfer bonuses to return the true
// cheapest way to pay for each trip: cash, miles you hold, or bank points
// transferred (bonus-aware) into the right program.
//
// It degrades gracefully: any source without its API key just reports
// configured:false and is skipped, so the endpoint is useful the moment ONE source
// is wired up, and gets stronger as you add keys.
//
// Query params:
//   ?from=GSP&to=MCO&depart=2026-08-15&return=2026-08-19
//   &adults=2&children=2&cabin=economy&currency=USD
//   &held=AMEX_MR:90000,AEROPLAN:12000     (optional; your point balances)
//
// Response: { query, sources, best, bestCash, bestAward, savingsVsCashUsd, options[] }
//
// Env (all optional — engine reports what's missing):
//   KIWI_API_KEY          cash fares (Tequila)
//   SEATS_AERO_API_KEY    award availability (seats.aero Pro)
//   SUPABASE_URL + SUPABASE_SERVICE_KEY   live valuation/bonus overlay

import { searchCash } from "./_lib/providers/kiwi.mjs";
import { searchCashSerp } from "./_lib/providers/serpapi.mjs";
import { searchAward } from "./_lib/providers/seatsaero.mjs";
import { loadValuations, loadBalances } from "./_lib/valuations.mjs";
import { loadWallet } from "./_lib/wallet.mjs";
import { rankOptions } from "./_lib/arbitrage.mjs";
import { requireLogin } from "./_lib/auth.mjs";

export const config = { maxDuration: 30 };

// One-way driving time from home (Greenville) to each departure airport we'd
// realistically use. The Drive vs. Fly panel already prices the FUEL for this drive;
// these hours price the family's TIME, which is a different (and often larger) cost.
// Override per request with ?driveHours=ATL:2.5,CLT:1.5
const DEFAULT_ORIGIN_DRIVE_HOURS = { GSP: 0.25, ATL: 2, CLT: 1.5 };

// "AMEX_MR:90000,AEROPLAN:12000" -> { AMEX_MR: 90000, AEROPLAN: 12000 }
function parseHeld(str) {
  const held = {};
  if (!str) return held;
  for (const pair of String(str).split(",")) {
    const [k, v] = pair.split(":");
    if (k) held[k.trim().toUpperCase()] = v != null ? Number(v) : 0;
  }
  return held;
}

// "ATL:2.5,CLT:1.5" -> { ATL: 2.5, CLT: 1.5 }
function parseDriveHours(str) {
  const out = {};
  if (!str) return out;
  for (const pair of String(str).split(",")) {
    const [k, v] = pair.split(":");
    const hours = Number(v);
    if (k && Number.isFinite(hours)) out[k.trim().toUpperCase()] = hours;
  }
  return out;
}

// How much to trust the answer. The engine must never imply it saw inventory it
// never queried, so confidence is derived from what actually reported back.
function assessConfidence({ sources, wallet, unknowns }) {
  const reasons = [];
  const cashUp = sources.kiwi.configured || sources.serpapi.configured;
  const awardUp = sources.seatsAero.configured;

  if (!cashUp) reasons.push("No cash-fare source configured — cash options were not queried.");
  if (!awardUp) reasons.push("seats.aero not configured — award availability was not queried.");
  for (const s of ["kiwi", "serpapi", "seatsAero"]) {
    if (sources[s].error) reasons.push(`${s} errored: ${sources[s].error}`);
  }
  if (!wallet.configured) {
    reasons.push("No rewards wallet data — certificates, credits and Companion Pass were not considered.");
  }
  reasons.push(...unknowns);

  let level = "high";
  if (!cashUp || !awardUp || !wallet.configured) level = "medium";
  if (!cashUp && !awardUp) level = "low";
  if (reasons.some((r) => r.includes("errored"))) level = level === "high" ? "medium" : level;

  return {
    level,
    reason: reasons.length
      ? reasons.join(" ")
      : "All cash and award sources returned results and wallet data is current.",
    queried: { cash: cashUp, award: awardUp, wallet: wallet.configured },
  };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!(await requireLogin(req, res))) return;

  const q = req.query || {};
  const { from, to, depart } = q;
  if (!from || !to || !depart) {
    return res.status(400).json({ error: "from, to, and depart (YYYY-MM-DD) are required" });
  }
  const args = {
    from: String(from).toUpperCase(),
    to: String(to).toUpperCase(),
    depart,
    ret: q.return || null,
    adults: Number(q.adults || 1),
    children: Number(q.children || 0),
    infants: Number(q.infants || 0),
    cabin: q.cabin || "economy",
    currency: (q.currency || "USD").toUpperCase(),
  };
  try {
    // Fan out: cash + award + valuation config + balances, all in parallel.
    // Balances precedence: ?held= (explicit) > Supabase point_balances > POINT_BALANCES env.
    const [cashRes, serpRes, awardRes, valConfig, wallet, dbBalances] = await Promise.all([
      searchCash(args),
      searchCashSerp(args),
      searchAward(args),
      loadValuations(),
      loadWallet(),
      q.held ? Promise.resolve(null) : loadBalances(),
    ]);
    const held = q.held
      ? parseHeld(q.held)
      : dbBalances || parseHeld(process.env.POINT_BALANCES);

    // Household trip facts the search providers can't know.
    const tripContext = {
      originDriveHours: { ...DEFAULT_ORIGIN_DRIVE_HOURS, ...parseDriveHours(q.driveHours) },
      adults: args.adults,
      passengers: args.adults + args.children,
    };

    const cashItems = [...cashRes.items, ...serpRes.items];
    const ranked = rankOptions({
      cash: cashItems,
      awards: awardRes.items,
      held,
      config: valConfig,
      // No wallet data -> the decision layer sits out and this stays pure arbitrage.
      wallet: wallet.configured ? wallet : null,
      tripContext,
    });

    const sources = {
      kiwi: { configured: cashRes.configured, count: cashRes.items.length, error: cashRes.error || null },
      serpapi: { configured: serpRes.configured, count: serpRes.items.length, error: serpRes.error || null },
      seatsAero: { configured: awardRes.configured, count: awardRes.items.length, error: awardRes.error || null },
      valuations: valConfig.source,
      wallet: wallet.source,
    };

    return res.status(200).json({
      query: args,
      heldCurrencies: Object.keys(held),
      tripContext,
      sources,
      confidence: assessConfidence({ sources, wallet, unknowns: ranked.unknowns || [] }),
      best: ranked.best,
      bestCash: ranked.bestCash,
      bestAward: ranked.bestAward,
      bestConvenience: ranked.bestConvenience,
      savingsVsCashUsd: ranked.savingsVsCashUsd,
      options: ranked.options.slice(0, 20),
    });
  } catch (err) {
    console.error("flights engine failed:", err);
    return res.status(502).json({ error: "flight search failed", detail: String(err?.message || err) });
  }
}

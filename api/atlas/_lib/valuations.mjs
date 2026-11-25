// Point valuations + transfer-partner map for the flight arbitrage engine.
//
// This is the "brain data" that lets us convert an award price (miles + taxes)
// into a dollar-equivalent, and figure out WHICH of your transferable-points
// currencies can feed a given airline program — and at what ratio, with any
// live transfer bonus applied.
//
// It ships with a sensible built-in table so the engine works with zero setup.
// If Supabase env vars are present it overlays live rows on top (see loadValuations),
// so you can tune valuations / add transfer bonuses without a redeploy.
//
// Everything here is an editable ESTIMATE. Cents-per-point (cpp) numbers are
// rough mid-2026 figures in the spirit of published valuations; treat them as
// starting points and adjust to how YOU actually redeem.

// ---------------------------------------------------------------------------
// Transferable "bank" currencies you might hold (from credit-card rewards).
// ---------------------------------------------------------------------------
import { SUPABASE_URL, SUPABASE_KEY, HAS_SERVICE_KEY } from "./supabase.mjs";

export const BANK_CURRENCIES = ["AMEX_MR", "CHASE_UR", "CITI_TYP", "CAP1", "BILT"];

// ---------------------------------------------------------------------------
// Default cents-per-point valuations. Airline/hotel programs + the bank
// currencies. cpp = dollars-of-value per point × 100.
// ---------------------------------------------------------------------------
export const DEFAULT_VALUATIONS = {
  // Transferable bank points (baseline value; real value = best transfer use)
  AMEX_MR: 2.0,
  // Baseline, not best-case. UR can beat this through a well-timed transfer, but that
  // isn't available on demand — pricing every redemption at the peak would make the
  // engine recommend burning points on trips where cash was the better call.
  CHASE_UR: 1.75,
  CITI_TYP: 1.7,
  CAP1: 1.85,
  BILT: 2.05,
  // Airline programs commonly reachable by transfer
  AEROPLAN: 1.5, // Air Canada
  UA_MP: 1.35, // United MileagePlus
  AA_AADVANTAGE: 1.5, // American
  DL_SKYMILES: 1.2, // Delta
  ALASKA: 1.5, // Alaska Mileage Plan
  AF_KLM_FB: 1.5, // Flying Blue
  AVIANCA_LM: 1.4, // LifeMiles
  ANA_MILEAGE: 1.5, // ANA
  VS_FLYING_CLUB: 1.5, // Virgin Atlantic
  BA_AVIOS: 1.4, // British Airways / Iberia / Qatar Avios
  TK_MILES: 1.3, // Turkish Miles&Smiles
  EK_SKYWARDS: 1.2, // Emirates
  JETBLUE_TP: 1.3,
  SW_RR: 1.35, // Southwest Rapid Rewards
  LH_MILES_AND_MORE: 1.4, // Lufthansa Miles & More
  // Hotel programs (used for hotel-side valuation / Bonvoy->airline transfers)
  BONVOY: 0.7, // Marriott Bonvoy
};

// ---------------------------------------------------------------------------
// Transfer map: bank currency -> { airlineProgram: ratio }.
// ratio is bankPoints:airlineMiles expressed as (airlineMiles / bankPoints).
// 1.0 == 1:1. 0.5 == 1,000 bank pts -> 500 miles. 1.5 == 1,000 -> 1,500.
// ---------------------------------------------------------------------------
export const TRANSFER_MAP = {
  AMEX_MR: {
    AEROPLAN: 1, AF_KLM_FB: 1, AVIANCA_LM: 1, ANA_MILEAGE: 1, VS_FLYING_CLUB: 1,
    BA_AVIOS: 1, DL_SKYMILES: 1, EK_SKYWARDS: 1, JETBLUE_TP: 0.8,
  },
  CHASE_UR: {
    AEROPLAN: 1, UA_MP: 1, AF_KLM_FB: 1, VS_FLYING_CLUB: 1, BA_AVIOS: 1,
    EK_SKYWARDS: 1, JETBLUE_TP: 1, SW_RR: 1,
  },
  CITI_TYP: {
    AVIANCA_LM: 1, AF_KLM_FB: 1, VS_FLYING_CLUB: 1, TK_MILES: 1, JETBLUE_TP: 1,
    EK_SKYWARDS: 1, BA_AVIOS: 1,
  },
  CAP1: {
    AEROPLAN: 1, AF_KLM_FB: 1, AVIANCA_LM: 1, TK_MILES: 1, BA_AVIOS: 1,
    EK_SKYWARDS: 1, VS_FLYING_CLUB: 1,
  },
  BILT: {
    AEROPLAN: 1, UA_MP: 1, AF_KLM_FB: 1, AVIANCA_LM: 1, TK_MILES: 1,
    ALASKA: 1, VS_FLYING_CLUB: 1,
  },
};

// ---------------------------------------------------------------------------
// Live transfer bonuses (e.g. "Amex -> Flying Blue +25%"). Empty by default;
// overlay from Supabase or edit here when a bonus is running. `bonusPct` stacks
// multiplicatively on the base ratio: effectiveRatio = ratio * (1 + bonusPct/100).
// `expires` is informational (ISO date).
// ---------------------------------------------------------------------------
export const DEFAULT_TRANSFER_BONUSES = [
  // { from: "AMEX_MR", to: "AF_KLM_FB", bonusPct: 25, expires: "2026-08-31" },
];

// ---------------------------------------------------------------------------
// loadValuations — returns { valuations, transferMap, bonuses, source }.
// Overlays Supabase rows when SUPABASE_URL + SUPABASE_SERVICE_KEY are set.
// Tables (see supabase/migrations): point_valuations, transfer_bonuses.
// Uses the REST endpoint so we add no dependency.
// ---------------------------------------------------------------------------
export async function loadValuations() {
  const base = {
    valuations: { ...DEFAULT_VALUATIONS },
    transferMap: TRANSFER_MAP,
    bonuses: [...DEFAULT_TRANSFER_BONUSES],
    source: "built-in defaults",
  };

  // Server-only tables — only readable with a service key. Without one, keep defaults.
  if (!HAS_SERVICE_KEY) return base;
  const url = SUPABASE_URL, key = SUPABASE_KEY;

  try {
    const headers = { apikey: key, Authorization: `Bearer ${key}` };
    const [valRes, bonusRes] = await Promise.all([
      fetch(`${url}/rest/v1/point_valuations?select=program,cpp`, { headers }),
      fetch(`${url}/rest/v1/transfer_bonuses?select=from_program,to_program,bonus_pct,expires&active=eq.true`, { headers }),
    ]);
    if (valRes.ok) {
      for (const row of await valRes.json()) {
        if (row.program && typeof row.cpp === "number") base.valuations[row.program] = row.cpp;
      }
    }
    if (bonusRes.ok) {
      base.bonuses = (await bonusRes.json()).map((r) => ({
        from: r.from_program, to: r.to_program, bonusPct: r.bonus_pct, expires: r.expires,
      }));
    }
    base.source = "supabase overlay";
  } catch (err) {
    console.error("valuations: supabase overlay failed, using defaults:", err?.message || err);
  }
  return base;
}

// loadBalances — reads the point_balances table (server-side, service key) and
// returns { AMEX_MR: 130000, ... }. Returns null when Supabase isn't configured or
// the read fails, so callers can fall back to ?held= / POINT_BALANCES.
export async function loadBalances() {
  // point_balances is server-only; needs a service key. Else caller falls back to env.
  if (!HAS_SERVICE_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/point_balances?select=program,balance`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) return null;
    const held = {};
    for (const r of rows) if (r.program) held[r.program] = Number(r.balance) || 0;
    return held;
  } catch (err) {
    console.error("loadBalances: supabase read failed:", err?.message || err);
    return null;
  }
}

// The rewards wallet: everything about THIS household that changes the real cost
// of a booking but isn't visible to any search provider.
//
// valuations.js answers "what is a point worth?". This file answers "what does this
// family already hold?" — free-night certificates, annual credits with a use-or-lose
// date, Companion Pass, elite status, the card portfolio, and the behavioral weights
// that say what they'll pay to avoid a connection or a two-hour drive.
//
// Same contract as valuations.js: ships with usable built-in defaults, overlays live
// Supabase rows when SUPABASE_SERVICE_KEY is set, and never throws — a wallet that
// can't be read degrades to `configured:false` and the engine falls back to plain
// cash-vs-points arbitrage.

import { SUPABASE_URL, SUPABASE_KEY, HAS_SERVICE_KEY } from "./supabase.mjs";
import { BANK_CURRENCIES } from "./valuations.mjs";

// ---------------------------------------------------------------------------
// Behavioral weights — dollar-denominated statements of this family's tolerances.
// A "bonus" is subtracted from effective cost; a "penalty" is added. These are the
// numbers that let the engine prefer a pricier nonstop ON PURPOSE.
// ---------------------------------------------------------------------------
export const DEFAULT_BEHAVIORAL_WEIGHTS = {
  nonstop_bonus: 80,
  extra_connection_penalty: 60,
  airport_drive_penalty_per_hour: 25,
  red_eye_penalty: 100,
  // Spending a transferable bank point costs more than its cpp implies, because you
  // give up optionality. Applied as a percent surcharge on the points' dollar value.
  flexibility_penalty_pct: 12,
  // A benefit expiring inside this window earns an urgency discount, scaling up to
  // urgency_max_bonus_pct as the expiry approaches. This is what stops the family
  // sitting on a $250 certificate while burning flexible Chase points.
  urgency_window_days: 90,
  urgency_max_bonus_pct: 25,
};

// ---------------------------------------------------------------------------
// Flexibility tiers — lower number = spend this first when value is a wash.
// Mirrors the tie-break ladder: expiring benefits, then restricted currencies,
// then cash, then transferable points.
// ---------------------------------------------------------------------------
export const FLEXIBILITY_TIER = {
  certificate: 1, // can only ever be one thing; use it or lose it
  credit: 1,
  hotel_points: 2, // BONVOY et al — restricted, poor transfer value
  airline_miles: 3, // already committed to one program
  cash: 4,
  bank_points: 5, // maximum optionality — spend last
};

// Which tier a currency key belongs to.
export function tierForCurrency(currency) {
  if (!currency) return FLEXIBILITY_TIER.cash;
  if (BANK_CURRENCIES.includes(currency)) return FLEXIBILITY_TIER.bank_points;
  if (currency === "BONVOY" || /HONORS|HYATT|IHG|WYNDHAM/.test(currency)) {
    return FLEXIBILITY_TIER.hotel_points;
  }
  return FLEXIBILITY_TIER.airline_miles;
}

// Empty-but-valid wallet, so every caller can assume the shape exists.
export function emptyWallet() {
  return {
    certificates: [],
    credits: [],
    // On/off switch: when enabled, one adult flies as companion and the adult share
    // of an airfare is halved. `program` scopes it; null applies to any carrier.
    companionPass: { enabled: false, program: null },
    eliteStatus: {},
    cards: [],
    weights: { ...DEFAULT_BEHAVIORAL_WEIGHTS },
    configured: false,
    source: "built-in defaults (no wallet data)",
  };
}

async function readTable(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

// ---------------------------------------------------------------------------
// loadWallet — reads the 0005 tables. Returns emptyWallet() (never throws) when
// Supabase isn't configured or a read fails, so /api/flights keeps working.
// ---------------------------------------------------------------------------
export async function loadWallet() {
  const wallet = emptyWallet();
  if (!HAS_SERVICE_KEY) return wallet;

  // Each table is read independently: a missing table (migration not yet applied)
  // shouldn't blank out the ones that ARE there.
  const [certs, credits, companions, status, cards, weights] = await Promise.allSettled([
    readTable("reward_certificates?select=*&active=eq.true"),
    readTable("reward_credits?select=*&active=eq.true"),
    readTable("companion_pass?select=*&id=eq.1"),
    readTable("elite_status?select=*"),
    readTable("cards?select=*&active=eq.true"),
    readTable("behavioral_weights?select=key,value"),
  ]);

  const ok = (r) => (r.status === "fulfilled" ? r.value : null);
  let any = false;

  const certRows = ok(certs);
  if (certRows) {
    any = true;
    wallet.certificates = certRows.map((r) => ({
      id: r.id,
      kind: r.kind,
      program: r.program,
      label: r.label || `${r.program} ${r.kind}`,
      maxPoints: r.max_points != null ? Number(r.max_points) : null,
      cashValue: r.cash_value != null ? Number(r.cash_value) : null,
      expires: r.expires || null,
      quantity: Number(r.quantity ?? 1),
    }));
  }

  const creditRows = ok(credits);
  if (creditRows) {
    any = true;
    wallet.credits = creditRows.map((r) => ({
      id: r.id,
      card: r.card,
      kind: r.kind,
      appliesTo: r.applies_to || "any_travel",
      remaining: Number(r.amount_remaining) || 0,
      expires: r.period_expires || null,
    }));
  }

  const companionRows = ok(companions);
  if (companionRows) {
    any = true;
    const row = companionRows[0];
    if (row) wallet.companionPass = { enabled: !!row.enabled, program: row.program || null };
  }

  const statusRows = ok(status);
  if (statusRows) {
    any = true;
    for (const r of statusRows) {
      if (r.program) wallet.eliteStatus[r.program] = { level: r.level, source: r.source || null };
    }
  }

  const cardRows = ok(cards);
  if (cardRows) {
    any = true;
    wallet.cards = cardRows.map((r) => ({
      name: r.name,
      bankCurrency: r.bank_currency || null,
      annualFee: Number(r.annual_fee) || 0,
      earnRates: r.earn_rates || {},
      credits: r.credits || {},
      statuses: r.statuses || {},
      transferPartners: r.transfer_partners || [],
    }));
  }

  const weightRows = ok(weights);
  if (weightRows) {
    any = true;
    for (const r of weightRows) {
      if (r.key && typeof Number(r.value) === "number") wallet.weights[r.key] = Number(r.value);
    }
  }

  wallet.configured = any;
  wallet.source = any ? "supabase wallet" : "built-in defaults (wallet tables unreadable)";
  return wallet;
}

// ---------------------------------------------------------------------------
// Which card earns the most on a given spend category, and how much that's worth.
// Used to credit a cash booking with the rewards it generates.
//   category: "airfare_direct" | "hotel_direct" | "portal_travel" | "general"
// Returns null when the portfolio is empty, so callers can omit the line entirely
// rather than pretend they know the earn rate.
// ---------------------------------------------------------------------------
export function bestEarningCard(wallet, category, amountUsd, valuations) {
  let best = null;
  for (const card of wallet.cards || []) {
    const rate = card.earnRates?.[category] ?? card.earnRates?.general;
    if (!rate) continue;
    const points = Math.round(amountUsd * rate);
    const cpp = valuations?.[card.bankCurrency] || 0;
    const valueUsd = (points * cpp) / 100;
    if (!best || valueUsd > best.valueUsd) {
      best = { card: card.name, currency: card.bankCurrency, rate, points, valueUsd: +valueUsd.toFixed(2) };
    }
  }
  return best;
}

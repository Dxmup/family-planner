// Cash-fare provider: SerpAPI Google Flights (https://serpapi.com/google-flights-api).
//
// Chosen because it's INSTANT self-serve (sign up → copy key → done), unlike Kiwi's
// Tequila which is gated behind partner approval. Returns Google Flights' cash fares
// (majors + budget carriers) in the engine's normalized shape.
//
// Env: SERPAPI_KEY. Without it -> { configured:false, items:[] } so the engine simply
// skips this source. Prices are per the whole party (adults+children passed through).
//
// Verify field names against current docs before heavy use; the response shape below
// maps SerpAPI's documented google_flights result.

import { isRedEye } from "./_util.mjs";

const SERP_BASE = "https://serpapi.com/search.json";

export async function searchCashSerp({ from, to, depart, ret, adults = 1, children = 0, currency = "USD" }) {
  const key = process.env.SERPAPI_KEY;
  if (!key) return { source: "serpapi", configured: false, items: [], note: "SERPAPI_KEY not set" };

  const params = new URLSearchParams({
    engine: "google_flights",
    departure_id: from,
    arrival_id: to,
    outbound_date: depart,
    currency,
    hl: "en",
    adults: String(adults),
    children: String(children),
    api_key: key,
  });
  if (ret) {
    params.set("return_date", ret);
    params.set("type", "1"); // 1 = round trip
  } else {
    params.set("type", "2"); // 2 = one way
  }

  try {
    const res = await fetch(`${SERP_BASE}?${params}`);
    if (!res.ok) return { source: "serpapi", configured: true, items: [], error: `serpapi ${res.status}` };
    const data = await res.json();
    if (data.error) return { source: "serpapi", configured: true, items: [], error: String(data.error) };

    const passengers = adults + children;
    const pool = [...(data.best_flights || []), ...(data.other_flights || [])];
    const items = pool
      .filter((o) => typeof o.price === "number")
      .map((o, i) => {
        const legs = o.flights || [];
        const route = legs.length
          ? [legs[0]?.departure_airport?.id, ...legs.map((l) => l.arrival_airport?.id)].filter(Boolean).join("->")
          : `${from}->${to}`;
        return {
          id: `serp_${i}_${o.price}`,
          source: "serpapi",
          priceUsd: o.price, // whole-party total in requested currency
          route,
          airlines: [...new Set(legs.map((l) => l.airline).filter(Boolean))].join(", "),
          durationSec: (o.total_duration || 0) * 60,
          deep_link: null, // SerpAPI returns a booking_token; build a link separately if needed
          // --- decision-layer inputs (see _lib/scoring.js) ---
          connections: Math.max(0, legs.length - 1),
          redEye: isRedEye(legs[0]?.departure_airport?.time),
          passengers,
        };
      });
    return { source: "serpapi", configured: true, items };
  } catch (err) {
    return { source: "serpapi", configured: true, items: [], error: String(err?.message || err) };
  }
}

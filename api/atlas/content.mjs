// /api/atlas — serves all Adventure Atlas content from Supabase.
//
// Returns the full dataset in the SAME shapes the front end already uses (CITIES,
// THEMES, A, PLAYBOOKS, EVENTS, TRIP_EVENTS, PRESETS, COR, COORDS, HOTELS, ...), so
// index.html can hydrate its existing variables from here instead of hardcoding them
// — and fall back to its baked-in copy if this endpoint is unreachable.
//
// Reads server-side. Content tables are public-read (RLS), but we use the service
// key if present (bypasses RLS, also lets one endpoint serve everything).
//
// Env: ATLAS_SUPABASE_URL + (ATLAS_SUPABASE_SERVICE_KEY | ATLAS_SUPABASE_ANON_KEY)

import { SUPABASE_URL, SUPABASE_KEY } from "./_lib/supabase.mjs";
import { requireLogin } from "./_lib/auth.mjs";

export const config = { maxDuration: 15 };

async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} on ${path}: ${await res.text()}`);
  return res.json();
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!(await requireLogin(req, res))) return;

  try {
    const [spokesR, themesR, citiesR, attractionsR, playbooksR, eventLinksR, tripEventsR, presetsR, corridorsR, budgetR] =
      await Promise.all([
        sb("spokes?select=code,label"),
        sb("themes?select=code,label"),
        sb("cities?select=*&order=sort_order"),
        sb("attractions?select=name,type,age,why,price,sort_order,cities(name),attraction_themes(theme_code)&order=sort_order"),
        sb("playbooks?select=pitch,signature,rainy_day,food_stop,kid_tip,stay_area,cities(name),playbook_steps(ordinal,when_label,stop,note)"),
        sb("event_links?select=name,url,description,cities(name)"),
        sb("trip_events?select=event_date,name,meta,date_window,expires,found_at,source,cities(name)"),
        sb("presets?select=name,preset_stops(ordinal,city_name)"),
        sb("corridors?select=title,tag,nodes,segs,branch&order=sort_order"),
        sb("budget_settings?select=*&limit=1"),
      ]);

    // --- reshape to the front end's existing structures ---
    const SPOKES = Object.fromEntries(spokesR.map((s) => [s.code, s.label]));
    const THEMES = Object.fromEntries(themesR.map((t) => [t.code, [t.label, `var(--t-${t.code})`]]));

    const CITIES = {}, COORDS = {}, HOTELS = {}, PRICE_DATES = {};
    for (const c of citiesR) {
      if (c.lat != null && c.lng != null) COORDS[c.name] = [Number(c.lat), Number(c.lng)];
      if (c.is_home) continue; // Greenville: origin only, not a destination card
      CITIES[c.name] = { spoke: c.spoke, drive: c.drive, overlook: c.overlook, airport: c.airport };
      if (c.hotel_rate != null) HOTELS[c.name] = c.hotel_rate;
      if (c.price_dates) PRICE_DATES[c.name] = c.price_dates;
    }

    // A = [name, city, tags, type, age, why]; PRICES = {name: price}
    const A = [], PRICES = {};
    for (const a of attractionsR) {
      const tags = (a.attraction_themes || []).map((t) => t.theme_code).join(",");
      A.push([a.name, a.cities?.name, tags, a.type, a.age, a.why]);
      if (a.price) PRICES[a.name] = a.price;
    }

    const PLAYBOOKS = playbooksR.map((p) => ({
      city: p.cities?.name,
      pitch: p.pitch,
      perfectDay: (p.playbook_steps || [])
        .sort((x, y) => x.ordinal - y.ordinal)
        .map((s) => ({ when: s.when_label, stop: s.stop, note: s.note })),
      signature: p.signature, rainyDay: p.rainy_day, foodStop: p.food_stop,
      kidTip: p.kid_tip, stayArea: p.stay_area,
    }));

    const EVENTS = {};
    for (const e of eventLinksR) {
      const city = e.cities?.name; if (!city) continue;
      (EVENTS[city] ||= []).push({ n: e.name, u: e.url, d: e.description });
    }

    const TRIP_EVENTS = {};
    for (const t of tripEventsR) {
      const city = t.cities?.name; if (!city) continue;
      const bucket = (TRIP_EVENTS[city] ||= { window: t.date_window, foundNice: t.found_at, expires: t.expires, items: [] });
      bucket.items.push({ d: t.event_date, n: t.name, m: t.meta });
    }

    const PRESETS = {};
    for (const p of presetsR) {
      PRESETS[p.name] = (p.preset_stops || []).sort((x, y) => x.ordinal - y.ordinal).map((s) => s.city_name);
    }

    const COR = corridorsR.map((c) => [c.title, c.tag, c.nodes, c.segs, c.branch]);
    const BUDGET = budgetR[0] || null;

    // Short cache: content changes rarely; this keeps the atlas snappy.
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.status(200).json({
      SPOKES, THEMES, CITIES, COORDS, HOTELS, PRICE_DATES, PRICES,
      A, PLAYBOOKS, EVENTS, TRIP_EVENTS, PRESETS, COR, BUDGET,
      _meta: { source: "supabase", cities: Object.keys(CITIES).length, attractions: A.length },
    });
  } catch (err) {
    console.error("atlas load failed:", err);
    return res.status(502).json({ error: "atlas load failed", detail: String(err?.message || err) });
  }
}

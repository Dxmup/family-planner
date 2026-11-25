// /api/events — live family-event lookup for the Adventure Atlas.
//
// Does server-side what the research agents used to do by hand: given a city and
// a date window, it web-searches for family-friendly events (tuned for two girls,
// ages 5 & 9) and returns clean JSON. CORS/allow-listing that blocked the static
// artifact doesn't apply here — a serverless function can fetch freely.
//
// Query params:  ?city=Charlotte&start=2026-08-06&end=2026-08-08[&ages=5,9]
// Response:      { city, window, researchedAt, items: [{ n, m, u, d }] }
//   n = event name, m = one-line detail (venue / dates / why it fits),
//   u = official URL, d = ISO date (YYYY-MM-DD) the event falls on, if known.
//
// Env:  ANTHROPIC_API_KEY (required)   ANTHROPIC_MODEL (optional override)

import Anthropic from "@anthropic-ai/sdk";
import { requireLogin } from "./_lib/auth.mjs";

// Web search can take a while; give the function room (Vercel caps Hobby at 60s).
export const config = { maxDuration: 60 };

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

export default async function handler(req, res) {
  // Basic CORS so the atlas page can call this from anywhere it's hosted.
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!(await requireLogin(req, res))) return;

  const { city, start, end, ages = "5 & 9" } = req.query || {};
  if (!city || !start || !end) {
    return res.status(400).json({ error: "city, start, and end are required" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured" });
  }

  const client = new Anthropic();

  const prompt =
    `Find family-friendly events happening in ${city} between ${start} and ${end}, ` +
    `suitable for two girls ages ${ages}. Use web search against official sources: ` +
    `the city/CVB event calendar, venue sites, and reputable family-event listings. ` +
    `Prefer things actually dated in that window (festivals, shows, sports, seasonal ` +
    `attractions, markets). Skip anything you can't reasonably confirm is on then.\n\n` +
    `Reply with ONLY a JSON array (no prose before or after) of up to 8 objects:\n` +
    `  { "n": "<event name>", "m": "<venue + date + one-line why it fits kids>", ` +
    `"u": "<official URL>", "d": "<YYYY-MM-DD or empty if a range/unknown>" }\n` +
    `If you find nothing solid for those dates, return [].`;

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      output_config: { effort: "low" }, // cheap, quick — this is extraction, not deep reasoning
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
      messages: [{ role: "user", content: prompt }],
    });

    // Pull the model's text (skip web_search_tool_result / server_tool_use blocks),
    // then extract the JSON array it was asked to emit.
    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    let items = [];
    const match = text.match(/\[[\s\S]*\]/); // first [...] block
    if (match) {
      try {
        items = JSON.parse(match[0]);
      } catch {
        items = [];
      }
    }
    if (!Array.isArray(items)) items = [];

    // Normalize + drop anything past the trip window (defensive; the model may
    // occasionally surface an out-of-range hit).
    const clean = items
      .filter((it) => it && it.n)
      .map((it) => ({
        n: String(it.n).slice(0, 200),
        m: it.m ? String(it.m).slice(0, 300) : "",
        u: typeof it.u === "string" && /^https?:\/\//.test(it.u) ? it.u : "",
        d: typeof it.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(it.d) ? it.d : "",
      }))
      .filter((it) => !it.d || (it.d >= start && it.d <= end));

    const now = new Date();
    return res.status(200).json({
      city,
      window: `${start} to ${end}`,
      researchedAt: now.toISOString().slice(0, 10),
      items: clean,
    });
  } catch (err) {
    console.error("events lookup failed:", err);
    const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 502;
    return res.status(status).json({ error: "live events lookup failed", detail: String(err?.message || err) });
  }
}

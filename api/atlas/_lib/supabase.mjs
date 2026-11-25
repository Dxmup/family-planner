// Shared Supabase connection config for the serverless functions.
//
// URL + the PUBLISHABLE (anon) key are safe to ship in code — that's what
// publishable keys are for. Data is protected by row-level security: content
// tables are public-read; point_balances / point_valuations / transfer_bonuses
// are server-only (no anon policy), so the publishable key can't read them.
//
// Env vars override the defaults:
//   ATLAS_SUPABASE_URL, ATLAS_SUPABASE_ANON_KEY  (public reads — content)
//   ATLAS_SUPABASE_SERVICE_KEY             (server-only reads — balances/valuations)
// Set ATLAS_SUPABASE_SERVICE_KEY in Vercel to let /api/flights read your stored
// balances/valuations from the DB; without it, it falls back to POINT_BALANCES
// and the built-in valuation defaults.

export const SUPABASE_URL = process.env.ATLAS_SUPABASE_URL || "https://gbjvmwkjhjachfdqzfxh.supabase.co";

// Publishable/anon key — public by design. Used for content reads.
export const SUPABASE_ANON_KEY =
  process.env.ATLAS_SUPABASE_ANON_KEY || "sb_publishable_fnE87N_2CTvJT60u6yFyQA_ggOiNCZK";

// Best available key for a given call: service key (bypasses RLS) if set, else anon.
export const SUPABASE_KEY =
  process.env.ATLAS_SUPABASE_SERVICE_KEY || process.env.ATLAS_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

// True only when a service key is configured (i.e. we can read server-only tables).
export const HAS_SERVICE_KEY = !!process.env.ATLAS_SUPABASE_SERVICE_KEY;

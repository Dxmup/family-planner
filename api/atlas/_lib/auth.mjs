// Login gate for the Atlas endpoints. The planner's Supabase project owns the
// family accounts, so a request is allowed only if its bearer token is a valid
// session there. Same project/anon key as api/index.js (the anon key is public).
const PLANNER_SUPABASE_URL = process.env.SUPABASE_URL || "https://jexcuvfqomzamtkkryqq.supabase.co";
const PLANNER_ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpleGN1dmZxb216YW10a2tyeXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTkxMzAsImV4cCI6MjEwMDczNTEzMH0.3MqbfOAgaBiX8f1SVRm7nLevWo2JMis9Ba6sW9-dJpk";

// Returns true if the caller is signed in; otherwise sends 401 and returns false.
export async function requireLogin(req, res) {
  const auth = req.headers.authorization || "";
  if (!/^Bearer\s+\S+/.test(auth)) {
    res.status(401).json({ error: "Login required" });
    return false;
  }
  try {
    const r = await fetch(`${PLANNER_SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: PLANNER_ANON_KEY, Authorization: auth },
    });
    if (r.ok) return true;
  } catch { /* fall through to 401 */ }
  res.status(401).json({ error: "Login required" });
  return false;
}

// Parents only. Same session check as requireLogin, then the planner's
// public.is_parent() RPC (the same call api/index.js makes as isParent()),
// run as the caller so it answers for their own token.
//   401 { error: "Login required" }         signed out / invalid session
//   403 { error: "Parents only" }           signed in, but not a parent
//   502 { error: "Could not verify ..." }   the planner's auth service is unreachable
// Returns true only for a signed-in parent; otherwise it has already responded.
export async function requireParent(req, res) {
  const auth = req.headers.authorization || "";
  if (!/^Bearer\s+\S+/.test(auth)) {
    res.status(401).json({ error: "Login required" });
    return false;
  }
  let userOk = false;
  try {
    const r = await fetch(`${PLANNER_SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: PLANNER_ANON_KEY, Authorization: auth },
    });
    userOk = r.ok;
  } catch {
    res.status(502).json({ error: "Could not verify your login right now" });
    return false;
  }
  if (!userOk) {
    res.status(401).json({ error: "Login required" });
    return false;
  }
  let parent = false;
  try {
    const r = await fetch(`${PLANNER_SUPABASE_URL}/rest/v1/rpc/is_parent`, {
      method: "POST",
      headers: { apikey: PLANNER_ANON_KEY, Authorization: auth, "Content-Type": "application/json" },
      body: "{}",
    });
    if (!r.ok) throw new Error("rpc " + r.status);
    parent = (await r.json()) === true;
  } catch {
    res.status(502).json({ error: "Could not verify your login right now" });
    return false;
  }
  if (!parent) {
    res.status(403).json({ error: "Parents only" });
    return false;
  }
  return true;
}

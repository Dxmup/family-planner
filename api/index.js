const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jexcuvfqomzamtkkryqq.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpleGN1dmZxb216YW10a2tyeXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTkxMzAsImV4cCI6MjEwMDczNTEzMH0.3MqbfOAgaBiX8f1SVRm7nLevWo2JMis9Ba6sW9-dJpk';

const app = express();
app.use(express.json({ limit: '12mb' }));   // photo uploads arrive as base64 JSON

// Reads run as the anonymous role; writes run as the caller so that
// row-level security decides who may change data (parents only).
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
app.use((req, res, next) => {
  const auth = req.headers.authorization;
  req.sb = auth
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } })
    : anon;
  next();
});

const ok = (res, data) => res.json(data);
const bad = (res, msg) => res.status(400).json({ error: msg });
const notFound = (res) => res.status(404).json({ error: 'not found' });

// Convert a Supabase error into an HTTP response; returns true if handled.
function sendErr(res, error) {
  if (!error) return false;
  const msg = error.message || 'database error';
  // PGRST116 ("Cannot coerce...") on a write means RLS filtered the row to
  // nothing — i.e. the caller isn't an authenticated parent.
  if (error.code === '42501' || error.code === 'PGRST116' ||
      /JWT|token|authoriz|row-level security|Cannot coerce/i.test(msg)) {
    res.status(401).json({ error: 'Parent login required' });
  } else {
    res.status(400).json({ error: msg });
  }
  return true;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

// ---------- Auth ----------

async function gotrue(path, body) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return bad(res, 'email and password are required');
  const { status, json } = await gotrue('/token?grant_type=password', { email, password });
  if (status !== 200) {
    return res.status(401).json({ error: json.error_description || json.msg || 'Login failed' });
  }
  ok(res, {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: json.expires_at,
    email: json.user?.email,
  });
});

app.post('/api/auth/refresh', async (req, res) => {
  const { refresh_token } = req.body || {};
  if (!refresh_token) return bad(res, 'refresh_token is required');
  const { status, json } = await gotrue('/token?grant_type=refresh_token', { refresh_token });
  if (status !== 200) return res.status(401).json({ error: 'Session expired — please log in again' });
  ok(res, {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: json.expires_at,
    email: json.user?.email,
  });
});

// ---------- Members ----------

app.get('/api/members', async (req, res) => {
  const { data, error } = await req.sb.from('members').select('*').order('id');
  if (sendErr(res, error)) return;
  ok(res, data);
});

app.post('/api/members', async (req, res) => {
  const { name, color, avatar } = req.body;
  if (!name || !name.trim()) return bad(res, 'name is required');
  const { data, error } = await req.sb.from('members')
    .insert({ name: name.trim(), color: color || '#4A90D9', avatar: avatar || '🙂' })
    .select().single();
  if (sendErr(res, error)) return;
  ok(res, data);
});

app.put('/api/members/:id', async (req, res) => {
  const { data: m } = await req.sb.from('members').select('*').eq('id', req.params.id).maybeSingle();
  if (!m) return notFound(res);
  const { name, color, avatar } = req.body;
  const { data, error } = await req.sb.from('members')
    .update({ name: name ?? m.name, color: color ?? m.color, avatar: avatar ?? m.avatar })
    .eq('id', m.id).select().single();
  if (sendErr(res, error)) return;
  ok(res, data);
});

app.delete('/api/members/:id', async (req, res) => {
  const { data, error } = await req.sb.from('members').delete().eq('id', req.params.id).select();
  if (sendErr(res, error)) return;
  data.length ? ok(res, { deleted: true }) : notFound(res);
});

// ---------- Events ----------
// GET /api/events?start=YYYY-MM-DD&end=YYYY-MM-DD expands recurring events
// into concrete occurrences within the range.

async function fetchExpandedEvents(sb, start, end) {
  const [{ data: events, error: e1 }, { data: members, error: e2 }] = await Promise.all([
    sb.from('events').select('*')
      .or(`and(recurrence.neq.none,date.lte.${end}),and(recurrence.eq.none,date.gte.${start},date.lte.${end})`),
    sb.from('members').select('id,name,color,avatar'),
  ]);
  if (e1 || e2) throw (e1 || e2);
  const byId = Object.fromEntries((members || []).map(m => [m.id, m]));
  const rows = (events || []).map(e => {
    const m = e.member_id ? byId[e.member_id] : null;
    return {
      ...e,
      member_name: m ? m.name : null,
      member_color: m ? m.color : null,
      member_avatar: m ? m.avatar : null,
    };
  });

  const out = [];
  const startD = new Date(start + 'T00:00:00Z');
  const endD = new Date(end + 'T00:00:00Z');

  for (const e of rows) {
    if (e.recurrence === 'none') {
      out.push({ ...e, occurs_on: e.date });
      continue;
    }
    const until = e.recurrence_until ? new Date(e.recurrence_until + 'T00:00:00Z') : null;
    const first = new Date(e.date + 'T00:00:00Z');
    let cur = new Date(Math.max(first.getTime(), startD.getTime()));

    if (e.recurrence === 'weekly') {
      const diff = (cur.getUTCDay() - first.getUTCDay() + 7) % 7;
      if (diff !== 0) cur.setUTCDate(cur.getUTCDate() + (7 - cur.getUTCDay() + first.getUTCDay()) % 7);
    } else if (e.recurrence === 'monthly') {
      cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), first.getUTCDate()));
      if (cur < startD) cur.setUTCMonth(cur.getUTCMonth() + 1);
      if (cur < first) cur = new Date(first);
    }

    let guard = 0;
    while (cur <= endD && guard++ < 400) {
      if (cur >= first && (!until || cur <= until)) {
        out.push({ ...e, occurs_on: cur.toISOString().slice(0, 10) });
      }
      if (e.recurrence === 'daily') cur.setUTCDate(cur.getUTCDate() + 1);
      else if (e.recurrence === 'weekly') cur.setUTCDate(cur.getUTCDate() + 7);
      else if (e.recurrence === 'monthly') {
        const day = first.getUTCDate();
        cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, day));
      } else break;
    }
  }

  out.sort((a, b) =>
    a.occurs_on.localeCompare(b.occurs_on) ||
    (a.start_time || '').localeCompare(b.start_time || ''));
  return out;
}

// Google Calendar events synced into the gcal_events cache by the sync-gcal
// edge function. Shaped like app events but read-only (source: 'google').
async function fetchGcalEvents(sb, start, end) {
  const [{ data: gevents, error: e1 }, { data: members, error: e2 }] = await Promise.all([
    sb.from('gcal_events').select('*').gte('date', start).lte('date', end),
    sb.from('members').select('id,name,color,avatar'),
  ]);
  if (e1 || e2) throw (e1 || e2);
  const byId = Object.fromEntries((members || []).map(m => [m.id, m]));
  return (gevents || []).map(g => {
    const m = g.member_id ? byId[g.member_id] : null;
    return {
      id: 'g' + g.id,
      source: 'google',
      title: g.title,
      member_id: g.member_id,
      date: g.date,
      occurs_on: g.date,
      start_time: g.start_time,
      end_time: g.end_time,
      location: g.location,
      notes: null,
      recurrence: 'none',
      recurrence_until: null,
      member_name: m ? m.name : null,
      member_color: m ? m.color : null,
      member_avatar: m ? m.avatar : null,
    };
  });
}

function sortOccurrences(list) {
  return list.sort((a, b) =>
    a.occurs_on.localeCompare(b.occurs_on) ||
    (a.start_time || '').localeCompare(b.start_time || ''));
}

app.get('/api/events', async (req, res) => {
  const { start, end } = req.query;
  if (!DATE_RE.test(start || '') || !DATE_RE.test(end || '')) {
    return bad(res, 'start and end (YYYY-MM-DD) are required');
  }
  try {
    const [own, google] = await Promise.all([
      fetchExpandedEvents(req.sb, start, end),
      fetchGcalEvents(req.sb, start, end),
    ]);
    ok(res, sortOccurrences(own.concat(google)));
  } catch (e) { sendErr(res, e); }
});

app.post('/api/events', async (req, res) => {
  const { title, member_id, date, start_time, end_time, location, notes,
          recurrence, recurrence_until, created_by } = req.body;
  if (!title || !title.trim()) return bad(res, 'title is required');
  if (!DATE_RE.test(date || '')) return bad(res, 'date (YYYY-MM-DD) is required');
  if (start_time && !TIME_RE.test(start_time)) return bad(res, 'start_time must be HH:MM');
  if (end_time && !TIME_RE.test(end_time)) return bad(res, 'end_time must be HH:MM');
  const rec = ['none', 'daily', 'weekly', 'monthly'].includes(recurrence) ? recurrence : 'none';
  const { data, error } = await req.sb.from('events').insert({
    title: title.trim(), member_id: member_id || null, date,
    start_time: start_time || null, end_time: end_time || null,
    location: location || null, notes: notes || null,
    recurrence: rec, recurrence_until: recurrence_until || null,
    created_by: created_by || null,
  }).select().single();
  if (sendErr(res, error)) return;
  ok(res, data);
});

app.put('/api/events/:id', async (req, res) => {
  const { data: e } = await req.sb.from('events').select('*').eq('id', req.params.id).maybeSingle();
  if (!e) return notFound(res);
  const b = req.body;
  if (b.date !== undefined && !DATE_RE.test(b.date)) return bad(res, 'date must be YYYY-MM-DD');
  const { data, error } = await req.sb.from('events').update({
    title: b.title ?? e.title,
    member_id: b.member_id !== undefined ? b.member_id : e.member_id,
    date: b.date ?? e.date,
    start_time: b.start_time !== undefined ? b.start_time : e.start_time,
    end_time: b.end_time !== undefined ? b.end_time : e.end_time,
    location: b.location !== undefined ? b.location : e.location,
    notes: b.notes !== undefined ? b.notes : e.notes,
    recurrence: b.recurrence ?? e.recurrence,
    recurrence_until: b.recurrence_until !== undefined ? b.recurrence_until : e.recurrence_until,
  }).eq('id', e.id).select().single();
  if (sendErr(res, error)) return;
  ok(res, data);
});

app.delete('/api/events/:id', async (req, res) => {
  const { data, error } = await req.sb.from('events').delete().eq('id', req.params.id).select();
  if (sendErr(res, error)) return;
  data.length ? ok(res, { deleted: true }) : notFound(res);
});

// ---------- Google Calendar links ----------
// Secret iCal URLs are parent-only (RLS blocks everyone else).

app.get('/api/member-calendars', async (req, res) => {
  const { data, error } = await req.sb.from('member_calendars').select('*').order('id');
  if (sendErr(res, error)) return;
  ok(res, data);
});

// Upsert the calendar URL for one member (member_id null = whole family).
// An empty url removes the link and its cached events.
app.put('/api/member-calendars', async (req, res) => {
  const { member_id, url } = req.body;
  const mid = member_id || null;
  const match = (q) => (mid === null ? q.is('member_id', null) : q.eq('member_id', mid));
  if (!url || !url.trim()) {
    const { error: e1 } = await match(req.sb.from('member_calendars').delete());
    if (sendErr(res, e1)) return;
    const { error: e2 } = await match(req.sb.from('gcal_events').delete());
    if (sendErr(res, e2)) return;
    return ok(res, { removed: true });
  }
  const clean = url.trim();
  if (!/^(https|webcal):\/\//i.test(clean)) return bad(res, 'url must start with https:// or webcal://');
  const { data: existing, error: selErr } = await match(
    req.sb.from('member_calendars').select('id')).maybeSingle();
  if (sendErr(res, selErr)) return;
  const q = existing
    ? req.sb.from('member_calendars').update({ url: clean, last_error: null }).eq('id', existing.id)
    : req.sb.from('member_calendars').insert({ member_id: mid, url: clean });
  const { data, error } = await q.select().single();
  if (sendErr(res, error)) return;
  ok(res, data);
});

// Trigger an immediate sync (also runs automatically every 10 minutes).
app.post('/api/gcal-sync', async (req, res) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/sync-gcal`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    res.status(r.status).json(await r.json().catch(() => ({})));
  } catch (e) {
    res.status(502).json({ error: 'sync failed: ' + e.message });
  }
});

// ---------- Meals ----------

app.get('/api/meals', async (req, res) => {
  const { start, end } = req.query;
  if (!DATE_RE.test(start || '') || !DATE_RE.test(end || '')) {
    return bad(res, 'start and end (YYYY-MM-DD) are required');
  }
  const { data, error } = await req.sb.from('meals').select('*')
    .gte('date', start).lte('date', end).order('date');
  if (sendErr(res, error)) return;
  ok(res, data);
});

// Upsert by (date, meal_type). Empty title clears the slot.
app.put('/api/meals', async (req, res) => {
  const { date, meal_type, title, notes, recipe_id } = req.body;
  if (!DATE_RE.test(date || '')) return bad(res, 'date (YYYY-MM-DD) is required');
  if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(meal_type)) {
    return bad(res, 'meal_type must be breakfast|lunch|dinner|snack');
  }
  if (!title || !title.trim()) {
    const { error } = await req.sb.from('meals').delete().eq('date', date).eq('meal_type', meal_type);
    if (sendErr(res, error)) return;
    return ok(res, { cleared: true });
  }
  const { data, error } = await req.sb.from('meals')
    .upsert({ date, meal_type, title: title.trim(), notes: notes || null, recipe_id: recipe_id || null },
            { onConflict: 'date,meal_type' })
    .select().single();
  if (sendErr(res, error)) return;
  ok(res, data);
});

// ---------- Recipes ----------
// The recipe box: created once, linked from meal slots by recipe_id.

const cleanIngredients = (list) =>
  (Array.isArray(list) ? list : []).map(s => String(s).trim()).filter(Boolean);

app.get('/api/recipes', async (req, res) => {
  const { data, error } = await req.sb.from('recipes').select('*').order('title');
  if (sendErr(res, error)) return;
  ok(res, data);
});

app.post('/api/recipes', async (req, res) => {
  const { title, notes, ingredients } = req.body;
  if (!title || !title.trim()) return bad(res, 'title is required');
  const { data, error } = await req.sb.from('recipes')
    .insert({ title: title.trim(), notes: notes || null, ingredients: cleanIngredients(ingredients) })
    .select().single();
  if (sendErr(res, error)) return;
  ok(res, data);
});

app.put('/api/recipes/:id', async (req, res) => {
  const { data: r } = await req.sb.from('recipes').select('*').eq('id', req.params.id).maybeSingle();
  if (!r) return notFound(res);
  const b = req.body;
  const { data, error } = await req.sb.from('recipes').update({
    title: b.title ?? r.title,
    notes: b.notes !== undefined ? b.notes : r.notes,
    ingredients: b.ingredients !== undefined ? cleanIngredients(b.ingredients) : r.ingredients,
  }).eq('id', r.id).select().single();
  if (sendErr(res, error)) return;
  ok(res, data);
});

app.delete('/api/recipes/:id', async (req, res) => {
  const { data, error } = await req.sb.from('recipes').delete().eq('id', req.params.id).select();
  if (sendErr(res, error)) return;
  data.length ? ok(res, { deleted: true }) : notFound(res);
});

// Push a recipe's ingredients onto the first grocery list.
app.post('/api/recipes/:id/to-grocery', async (req, res) => {
  const { data: recipe } = await req.sb.from('recipes').select('*').eq('id', req.params.id).maybeSingle();
  if (!recipe) return notFound(res);
  const { data: list } = await req.sb.from('lists').select('id')
    .eq('type', 'grocery').order('id').limit(1).maybeSingle();
  if (!list) return bad(res, 'no grocery list exists');
  const ingredients = cleanIngredients(recipe.ingredients);
  if (!ingredients.length) return ok(res, { added: 0 });
  const { data: existing } = await req.sb.from('list_items').select('text,position')
    .eq('list_id', list.id);
  const have = new Set((existing || []).map(i => i.text.toLowerCase()));
  let pos = Math.max(0, ...(existing || []).map(i => i.position));
  const rows = ingredients.filter(t => !have.has(t.toLowerCase()))
    .map(t => ({ list_id: list.id, text: t, added_by: recipe.title, position: ++pos }));
  if (rows.length) {
    const { error } = await req.sb.from('list_items').insert(rows);
    if (sendErr(res, error)) return;
  }
  ok(res, { added: rows.length, skipped: ingredients.length - rows.length });
});

// ---------- Rewards ----------
// Star balance = lifetime chore points earned minus stars spent on rewards.

async function fetchBalances(sb) {
  const [{ data: comps, error: e1 }, { data: chores, error: e2 }, { data: reds, error: e3 }] =
    await Promise.all([
      sb.from('chore_completions').select('chore_id'),
      sb.from('chores').select('id,member_id,points'),
      sb.from('redemptions').select('member_id,cost'),
    ]);
  if (e1 || e2 || e3) throw (e1 || e2 || e3);
  const byId = Object.fromEntries((chores || []).map(c => [c.id, c]));
  const earned = {}, spent = {};
  for (const cc of comps || []) {
    const c = byId[cc.chore_id];
    if (c && c.member_id != null) earned[c.member_id] = (earned[c.member_id] || 0) + c.points;
  }
  for (const r of reds || []) spent[r.member_id] = (spent[r.member_id] || 0) + r.cost;
  const ids = new Set([...Object.keys(earned), ...Object.keys(spent)]);
  return [...ids].map(id => ({
    member_id: Number(id),
    earned: earned[id] || 0,
    spent: spent[id] || 0,
    available: (earned[id] || 0) - (spent[id] || 0),
  }));
}

app.get('/api/rewards', async (req, res) => {
  try {
    const [{ data: rewards, error: e1 }, balances, { data: recent, error: e2 }] = await Promise.all([
      req.sb.from('rewards').select('*').eq('active', true).order('cost'),
      fetchBalances(req.sb),
      req.sb.from('redemptions').select('*').order('id', { ascending: false }).limit(10),
    ]);
    if (e1 || e2) throw (e1 || e2);
    ok(res, { rewards, balances, recent });
  } catch (e) { sendErr(res, e); }
});

app.post('/api/rewards', async (req, res) => {
  const { title, icon, cost } = req.body;
  if (!title || !title.trim()) return bad(res, 'title is required');
  const { data, error } = await req.sb.from('rewards')
    .insert({ title: title.trim(), icon: icon || '🎁', cost: Math.max(1, Number(cost) || 10) })
    .select().single();
  if (sendErr(res, error)) return;
  ok(res, data);
});

app.put('/api/rewards/:id', async (req, res) => {
  const { data: r } = await req.sb.from('rewards').select('*').eq('id', req.params.id).maybeSingle();
  if (!r) return notFound(res);
  const b = req.body;
  const { data, error } = await req.sb.from('rewards').update({
    title: b.title ?? r.title,
    icon: b.icon ?? r.icon,
    cost: b.cost !== undefined ? Math.max(1, Number(b.cost) || 1) : r.cost,
    active: b.active !== undefined ? !!b.active : r.active,
  }).eq('id', r.id).select().single();
  if (sendErr(res, error)) return;
  ok(res, data);
});

app.delete('/api/rewards/:id', async (req, res) => {
  const { data, error } = await req.sb.from('rewards').delete().eq('id', req.params.id).select();
  if (sendErr(res, error)) return;
  data.length ? ok(res, { deleted: true }) : notFound(res);
});

// Redeeming requires the parent login — that's the built-in approval step.
app.post('/api/rewards/:id/redeem', async (req, res) => {
  const { member_id } = req.body;
  if (!member_id) return bad(res, 'member_id is required');
  const { data: reward } = await req.sb.from('rewards').select('*').eq('id', req.params.id).maybeSingle();
  if (!reward) return notFound(res);
  try {
    const balances = await fetchBalances(req.sb);
    const bal = balances.find(b => b.member_id === Number(member_id));
    if (!bal || bal.available < reward.cost) {
      return bad(res, `Not enough stars (need ${reward.cost}, has ${bal ? bal.available : 0})`);
    }
  } catch (e) { return sendErr(res, e); }
  const { data, error } = await req.sb.from('redemptions').insert({
    reward_id: reward.id, member_id, title: reward.title, cost: reward.cost,
    date: new Date().toISOString().slice(0, 10),
  }).select().single();
  if (sendErr(res, error)) return;
  ok(res, data);
});

// ---------- Routines ----------
// Morning/bedtime checklists. Checking items off needs no login (the wall
// tablet is anonymous); managing routines is parent-only via RLS.

async function fetchRoutines(sb, date) {
  const [{ data: routines, error: e1 }, { data: items, error: e2 }, { data: comps, error: e3 }] =
    await Promise.all([
      sb.from('routines').select('*').eq('active', true).order('start_time'),
      sb.from('routine_items').select('*').order('position').order('id'),
      date ? sb.from('routine_completions').select('item_id').eq('date', date)
           : Promise.resolve({ data: [] }),
    ]);
  if (e1 || e2 || e3) throw (e1 || e2 || e3);
  const done = new Set((comps || []).map(c => c.item_id));
  return (routines || []).map(r => ({
    ...r,
    items: (items || []).filter(i => i.routine_id === r.id)
      .map(i => ({ ...i, done: done.has(i.id) })),
  }));
}

app.get('/api/routines', async (req, res) => {
  const date = DATE_RE.test(req.query.date || '') ? req.query.date : new Date().toISOString().slice(0, 10);
  try { ok(res, await fetchRoutines(req.sb, date)); } catch (e) { sendErr(res, e); }
});

async function replaceRoutineItems(sb, routineId, items) {
  await sb.from('routine_items').delete().eq('routine_id', routineId);
  const rows = (Array.isArray(items) ? items : [])
    .map(i => ({ text: String(i.text || '').trim(), icon: i.icon || '✅' }))
    .filter(i => i.text)
    .map((i, idx) => ({ ...i, routine_id: routineId, position: idx }));
  if (rows.length) {
    const { error } = await sb.from('routine_items').insert(rows);
    if (error) throw error;
  }
}

app.post('/api/routines', async (req, res) => {
  const { title, icon, member_id, start_time, end_time, days, items } = req.body;
  if (!title || !title.trim()) return bad(res, 'title is required');
  const { data, error } = await req.sb.from('routines').insert({
    title: title.trim(), icon: icon || '🌅', member_id: member_id || null,
    start_time: start_time || null, end_time: end_time || null,
    days: Array.isArray(days) && days.length ? days : [0, 1, 2, 3, 4, 5, 6],
  }).select().single();
  if (sendErr(res, error)) return;
  try { await replaceRoutineItems(req.sb, data.id, items); } catch (e) { return sendErr(res, e); }
  ok(res, data);
});

app.put('/api/routines/:id', async (req, res) => {
  const { data: r } = await req.sb.from('routines').select('*').eq('id', req.params.id).maybeSingle();
  if (!r) return notFound(res);
  const b = req.body;
  const { data, error } = await req.sb.from('routines').update({
    title: b.title ?? r.title,
    icon: b.icon ?? r.icon,
    member_id: b.member_id !== undefined ? b.member_id : r.member_id,
    start_time: b.start_time !== undefined ? b.start_time : r.start_time,
    end_time: b.end_time !== undefined ? b.end_time : r.end_time,
    days: b.days !== undefined ? b.days : r.days,
    active: b.active !== undefined ? !!b.active : r.active,
  }).eq('id', r.id).select().single();
  if (sendErr(res, error)) return;
  if (b.items !== undefined) {
    try { await replaceRoutineItems(req.sb, r.id, b.items); } catch (e) { return sendErr(res, e); }
  }
  ok(res, data);
});

app.delete('/api/routines/:id', async (req, res) => {
  const { data, error } = await req.sb.from('routines').delete().eq('id', req.params.id).select();
  if (sendErr(res, error)) return;
  data.length ? ok(res, { deleted: true }) : notFound(res);
});

app.post('/api/routine-items/:id/toggle', async (req, res) => {
  const { date } = req.body;
  if (!DATE_RE.test(date || '')) return bad(res, 'date (YYYY-MM-DD) is required');
  const { data: item } = await req.sb.from('routine_items').select('id').eq('id', req.params.id).maybeSingle();
  if (!item) return notFound(res);
  const { data: existing } = await req.sb.from('routine_completions')
    .select('id').eq('item_id', item.id).eq('date', date).maybeSingle();
  if (existing) {
    const { error } = await req.sb.from('routine_completions').delete().eq('id', existing.id);
    if (sendErr(res, error)) return;
    return ok(res, { item_id: item.id, date, done: false });
  }
  const { error } = await req.sb.from('routine_completions').insert({ item_id: item.id, date });
  if (sendErr(res, error)) return;
  ok(res, { item_id: item.id, date, done: true });
});

// ---------- Countdowns & Announcements ----------

app.get('/api/countdowns', async (req, res) => {
  const { data, error } = await req.sb.from('countdowns').select('*').order('date');
  if (sendErr(res, error)) return;
  ok(res, data);
});

app.post('/api/countdowns', async (req, res) => {
  const { title, icon, date } = req.body;
  if (!title || !title.trim()) return bad(res, 'title is required');
  if (!DATE_RE.test(date || '')) return bad(res, 'date (YYYY-MM-DD) is required');
  const { data, error } = await req.sb.from('countdowns')
    .insert({ title: title.trim(), icon: icon || '🎉', date }).select().single();
  if (sendErr(res, error)) return;
  ok(res, data);
});

app.delete('/api/countdowns/:id', async (req, res) => {
  const { data, error } = await req.sb.from('countdowns').delete().eq('id', req.params.id).select();
  if (sendErr(res, error)) return;
  data.length ? ok(res, { deleted: true }) : notFound(res);
});

app.get('/api/announcements', async (req, res) => {
  const { data, error } = await req.sb.from('announcements').select('*').order('id', { ascending: false });
  if (sendErr(res, error)) return;
  ok(res, data);
});

app.post('/api/announcements', async (req, res) => {
  const { text, icon } = req.body;
  if (!text || !text.trim()) return bad(res, 'text is required');
  const { data, error } = await req.sb.from('announcements')
    .insert({ text: text.trim(), icon: icon || '📣' }).select().single();
  if (sendErr(res, error)) return;
  ok(res, data);
});

app.delete('/api/announcements/:id', async (req, res) => {
  const { data, error } = await req.sb.from('announcements').delete().eq('id', req.params.id).select();
  if (sendErr(res, error)) return;
  data.length ? ok(res, { deleted: true }) : notFound(res);
});

// ---------- Photos (screensaver) ----------
// Stored in the public 'photos' bucket; uploads/deletes are parent-only
// (storage RLS), viewing is public.

app.get('/api/photos', async (req, res) => {
  const { data, error } = await req.sb.storage.from('photos').list('', { limit: 200 });
  if (sendErr(res, error)) return;
  const files = (data || []).filter(f => f.name && !f.name.startsWith('.'));
  ok(res, files.map(f => ({
    name: f.name,
    url: `${SUPABASE_URL}/storage/v1/object/public/photos/${encodeURIComponent(f.name)}`,
  })));
});

app.post('/api/photos', async (req, res) => {
  const { name, data, content_type } = req.body;
  if (!name || !data) return bad(res, 'name and data (base64) are required');
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
  const key = `${Date.now()}-${safe}`;
  const buf = Buffer.from(data, 'base64');
  if (buf.length > 8 * 1024 * 1024) return bad(res, 'photo too large (8 MB max)');
  const { error } = await req.sb.storage.from('photos')
    .upload(key, buf, { contentType: content_type || 'image/jpeg' });
  if (sendErr(res, error)) return;
  ok(res, { name: key, url: `${SUPABASE_URL}/storage/v1/object/public/photos/${encodeURIComponent(key)}` });
});

app.delete('/api/photos/:name', async (req, res) => {
  const { error } = await req.sb.storage.from('photos').remove([req.params.name]);
  if (sendErr(res, error)) return;
  ok(res, { deleted: true });
});

// ---------- Chores ----------

async function fetchChores(sb) {
  const [{ data: chores, error: e1 }, { data: members, error: e2 }] = await Promise.all([
    sb.from('chores').select('*').eq('active', true).order('member_id').order('id'),
    sb.from('members').select('id,name,color,avatar'),
  ]);
  if (e1 || e2) throw (e1 || e2);
  const byId = Object.fromEntries((members || []).map(m => [m.id, m]));
  return (chores || []).map(c => {
    const m = c.member_id ? byId[c.member_id] : null;
    return {
      ...c,
      member_name: m ? m.name : null,
      member_color: m ? m.color : null,
      member_avatar: m ? m.avatar : null,
    };
  });
}

app.get('/api/chores', async (req, res) => {
  try { ok(res, await fetchChores(req.sb)); } catch (e) { sendErr(res, e); }
});

app.post('/api/chores', async (req, res) => {
  const { title, icon, member_id, days, points } = req.body;
  if (!title || !title.trim()) return bad(res, 'title is required');
  const dayList = Array.isArray(days) && days.length
    ? days.filter(d => Number.isInteger(d) && d >= 0 && d <= 6)
    : [0, 1, 2, 3, 4, 5, 6];
  const { data, error } = await req.sb.from('chores')
    .insert({ title: title.trim(), icon: icon || '🧹', member_id: member_id || null, days: dayList, points: points || 1 })
    .select().single();
  if (sendErr(res, error)) return;
  ok(res, data);
});

app.put('/api/chores/:id', async (req, res) => {
  const { data: c } = await req.sb.from('chores').select('*').eq('id', req.params.id).maybeSingle();
  if (!c) return notFound(res);
  const b = req.body;
  const { data, error } = await req.sb.from('chores').update({
    title: b.title ?? c.title,
    icon: b.icon ?? c.icon,
    member_id: b.member_id !== undefined ? b.member_id : c.member_id,
    days: b.days !== undefined ? b.days : c.days,
    points: b.points ?? c.points,
    active: b.active !== undefined ? !!b.active : c.active,
  }).eq('id', c.id).select().single();
  if (sendErr(res, error)) return;
  ok(res, data);
});

app.delete('/api/chores/:id', async (req, res) => {
  const { data, error } = await req.sb.from('chores').delete().eq('id', req.params.id).select();
  if (sendErr(res, error)) return;
  data.length ? ok(res, { deleted: true }) : notFound(res);
});

// Completions for a date range, plus star totals per member for the same range.
app.get('/api/chores/completions', async (req, res) => {
  const { start, end } = req.query;
  if (!DATE_RE.test(start || '') || !DATE_RE.test(end || '')) {
    return bad(res, 'start and end (YYYY-MM-DD) are required');
  }
  const [{ data: completions, error: e1 }, { data: chores, error: e2 }] = await Promise.all([
    req.sb.from('chore_completions').select('*').gte('date', start).lte('date', end),
    req.sb.from('chores').select('id,member_id,points'),
  ]);
  if (sendErr(res, e1 || e2)) return;
  const byId = Object.fromEntries((chores || []).map(c => [c.id, c]));
  const starMap = {};
  for (const cc of completions || []) {
    const c = byId[cc.chore_id];
    if (c && c.member_id != null) starMap[c.member_id] = (starMap[c.member_id] || 0) + c.points;
  }
  const stars = Object.entries(starMap).map(([member_id, points]) => ({ member_id: Number(member_id), points }));
  ok(res, { completions, stars });
});

app.post('/api/chores/:id/toggle', async (req, res) => {
  const { date } = req.body;
  if (!DATE_RE.test(date || '')) return bad(res, 'date (YYYY-MM-DD) is required');
  const { data: chore } = await req.sb.from('chores').select('id').eq('id', req.params.id).maybeSingle();
  if (!chore) return notFound(res);
  const { data: existing } = await req.sb.from('chore_completions')
    .select('id').eq('chore_id', chore.id).eq('date', date).maybeSingle();
  if (existing) {
    const { error } = await req.sb.from('chore_completions').delete().eq('id', existing.id);
    if (sendErr(res, error)) return;
    return ok(res, { chore_id: chore.id, date, done: false });
  }
  const { error } = await req.sb.from('chore_completions').insert({ chore_id: chore.id, date });
  if (sendErr(res, error)) return;
  ok(res, { chore_id: chore.id, date, done: true });
});

// ---------- Lists ----------

async function fetchLists(sb, { openOnly = false } = {}) {
  let itemQuery = sb.from('list_items').select('*')
    .order('done').order('position').order('id');
  if (openOnly) itemQuery = sb.from('list_items').select('*').eq('done', false).order('position').order('id');
  const [{ data: lists, error: e1 }, { data: items, error: e2 }] = await Promise.all([
    sb.from('lists').select('*').order('id'),
    itemQuery,
  ]);
  if (e1 || e2) throw (e1 || e2);
  return (lists || []).map(l => ({ ...l, items: (items || []).filter(i => i.list_id === l.id) }));
}

app.get('/api/lists', async (req, res) => {
  try { ok(res, await fetchLists(req.sb)); } catch (e) { sendErr(res, e); }
});

app.post('/api/lists', async (req, res) => {
  const { name, type } = req.body;
  if (!name || !name.trim()) return bad(res, 'name is required');
  const { data, error } = await req.sb.from('lists')
    .insert({ name: name.trim(), type: type === 'grocery' ? 'grocery' : 'todo' })
    .select().single();
  if (sendErr(res, error)) return;
  ok(res, { ...data, items: [] });
});

app.delete('/api/lists/:id', async (req, res) => {
  const { data, error } = await req.sb.from('lists').delete().eq('id', req.params.id).select();
  if (sendErr(res, error)) return;
  data.length ? ok(res, { deleted: true }) : notFound(res);
});

app.post('/api/lists/:id/items', async (req, res) => {
  const { data: list } = await req.sb.from('lists').select('id').eq('id', req.params.id).maybeSingle();
  if (!list) return notFound(res);
  const { text, added_by, member_id, due_date, notes } = req.body;
  if (!text || !text.trim()) return bad(res, 'text is required');
  if (due_date && !DATE_RE.test(due_date)) return bad(res, 'due_date must be YYYY-MM-DD');
  const { data: top } = await req.sb.from('list_items').select('position')
    .eq('list_id', list.id).order('position', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await req.sb.from('list_items')
    .insert({ list_id: list.id, text: text.trim(), added_by: added_by || null,
              member_id: member_id || null, due_date: due_date || null,
              notes: (notes || '').trim() || null,
              position: (top?.position || 0) + 1 })
    .select().single();
  if (sendErr(res, error)) return;
  ok(res, data);
});

app.put('/api/list-items/:id', async (req, res) => {
  const { data: item } = await req.sb.from('list_items').select('*').eq('id', req.params.id).maybeSingle();
  if (!item) return notFound(res);
  const b = req.body;
  if (b.due_date !== undefined && b.due_date !== null && b.due_date !== '' && !DATE_RE.test(b.due_date)) {
    return bad(res, 'due_date must be YYYY-MM-DD');
  }
  if (b.list_id !== undefined && b.list_id !== item.list_id) {
    const { data: target } = await req.sb.from('lists').select('id').eq('id', b.list_id).maybeSingle();
    if (!target) return bad(res, 'target list not found');
  }
  const { data, error } = await req.sb.from('list_items')
    .update({
      text: b.text ?? item.text,
      done: b.done !== undefined ? !!b.done : item.done,
      member_id: b.member_id !== undefined ? b.member_id : item.member_id,
      due_date: b.due_date !== undefined ? (b.due_date || null) : item.due_date,
      notes: b.notes !== undefined ? ((b.notes || '').trim() || null) : item.notes,
      list_id: b.list_id !== undefined ? b.list_id : item.list_id,
    })
    .eq('id', item.id).select().single();
  if (sendErr(res, error)) return;
  ok(res, data);
});

app.delete('/api/list-items/:id', async (req, res) => {
  const { data, error } = await req.sb.from('list_items').delete().eq('id', req.params.id).select();
  if (sendErr(res, error)) return;
  data.length ? ok(res, { deleted: true }) : notFound(res);
});

// Clear all checked-off items in one tap (e.g. after a shopping trip).
app.post('/api/lists/:id/clear-done', (req, res) => {
  req.sb.from('list_items').delete().eq('list_id', req.params.id).eq('done', true).select()
    .then(({ data, error }) => {
      if (sendErr(res, error)) return;
      ok(res, { deleted: (data || []).length });
    });
});

// ---------- Dashboard ----------
// One call returning everything the tablet's today-view needs.

app.get('/api/dashboard', async (req, res) => {
  const date = DATE_RE.test(req.query.date || '') ? req.query.date : new Date().toISOString().slice(0, 10);
  try {
    const weekday = new Date(date + 'T00:00:00Z').getUTCDay();
    const [membersR, events, google, meals, chores, compsR, lists, routines, cdR, annR, dueR] = await Promise.all([
      req.sb.from('members').select('*').order('id'),
      fetchExpandedEvents(req.sb, date, date),
      fetchGcalEvents(req.sb, date, date),
      req.sb.from('meals').select('*').eq('date', date),
      fetchChores(req.sb),
      req.sb.from('chore_completions').select('chore_id').eq('date', date),
      fetchLists(req.sb, { openOnly: true }),
      fetchRoutines(req.sb, date),
      req.sb.from('countdowns').select('*').gte('date', date).order('date').limit(5),
      req.sb.from('announcements').select('*').order('id', { ascending: false }).limit(3),
      req.sb.from('list_items').select('*, lists(name)')
        .eq('done', false).not('due_date', 'is', null).lte('due_date', date)
        .order('due_date'),
    ]);
    if (membersR.error || meals.error || compsR.error || cdR.error || annR.error) {
      throw (membersR.error || meals.error || compsR.error || cdR.error || annR.error);
    }
    const completions = (compsR.data || []).map(r => r.chore_id);
    ok(res, {
      date,
      members: membersR.data,
      events: sortOccurrences(events.concat(google)),
      meals: meals.data,
      chores: chores.filter(c => c.days.includes(weekday)).map(c => ({ ...c, done: completions.includes(c.id) })),
      lists,
      routines: routines.filter(r => r.days.includes(weekday)),
      countdowns: cdR.data,
      announcements: annR.data,
      due_tasks: (dueR.data || []).map(t => ({ ...t, list_name: t.lists?.name, lists: undefined })),
    });
  } catch (e) { sendErr(res, e); }
});

module.exports = app;

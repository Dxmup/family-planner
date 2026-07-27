const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jexcuvfqomzamtkkryqq.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpleGN1dmZxb216YW10a2tyeXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTkxMzAsImV4cCI6MjEwMDczNTEzMH0.3MqbfOAgaBiX8f1SVRm7nLevWo2JMis9Ba6sW9-dJpk';

const app = express();
app.use(express.json());

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
  if (error.code === '42501' || /JWT|token|authoriz/i.test(msg)) {
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

app.get('/api/events', async (req, res) => {
  const { start, end } = req.query;
  if (!DATE_RE.test(start || '') || !DATE_RE.test(end || '')) {
    return bad(res, 'start and end (YYYY-MM-DD) are required');
  }
  try {
    ok(res, await fetchExpandedEvents(req.sb, start, end));
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
  const { date, meal_type, title, notes } = req.body;
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
    .upsert({ date, meal_type, title: title.trim(), notes: notes || null }, { onConflict: 'date,meal_type' })
    .select().single();
  if (sendErr(res, error)) return;
  ok(res, data);
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
  const { text, added_by } = req.body;
  if (!text || !text.trim()) return bad(res, 'text is required');
  const { data: top } = await req.sb.from('list_items').select('position')
    .eq('list_id', list.id).order('position', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await req.sb.from('list_items')
    .insert({ list_id: list.id, text: text.trim(), added_by: added_by || null, position: (top?.position || 0) + 1 })
    .select().single();
  if (sendErr(res, error)) return;
  ok(res, data);
});

app.put('/api/list-items/:id', async (req, res) => {
  const { data: item } = await req.sb.from('list_items').select('*').eq('id', req.params.id).maybeSingle();
  if (!item) return notFound(res);
  const { text, done } = req.body;
  const { data, error } = await req.sb.from('list_items')
    .update({ text: text ?? item.text, done: done !== undefined ? !!done : item.done })
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
    const [membersR, events, meals, chores, compsR, lists] = await Promise.all([
      req.sb.from('members').select('*').order('id'),
      fetchExpandedEvents(req.sb, date, date),
      req.sb.from('meals').select('*').eq('date', date),
      fetchChores(req.sb),
      req.sb.from('chore_completions').select('chore_id').eq('date', date),
      fetchLists(req.sb, { openOnly: true }),
    ]);
    if (membersR.error || meals.error || compsR.error) throw (membersR.error || meals.error || compsR.error);
    const completions = (compsR.data || []).map(r => r.chore_id);
    ok(res, {
      date,
      members: membersR.data,
      events,
      meals: meals.data,
      chores: chores.filter(c => c.days.includes(weekday)).map(c => ({ ...c, done: completions.includes(c.id) })),
      lists,
    });
  } catch (e) { sendErr(res, e); }
});

module.exports = app;

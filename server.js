const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ok = (res, data) => res.json(data);
const bad = (res, msg) => res.status(400).json({ error: msg });
const notFound = (res) => res.status(404).json({ error: 'not found' });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

// ---------- Members ----------

app.get('/api/members', (req, res) => {
  ok(res, db.prepare('SELECT * FROM members ORDER BY id').all());
});

app.post('/api/members', (req, res) => {
  const { name, color, avatar } = req.body;
  if (!name || !name.trim()) return bad(res, 'name is required');
  const info = db.prepare('INSERT INTO members (name, color, avatar) VALUES (?, ?, ?)')
    .run(name.trim(), color || '#4A90D9', avatar || '🙂');
  ok(res, db.prepare('SELECT * FROM members WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/members/:id', (req, res) => {
  const m = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!m) return notFound(res);
  const { name, color, avatar } = req.body;
  db.prepare('UPDATE members SET name = ?, color = ?, avatar = ? WHERE id = ?')
    .run(name ?? m.name, color ?? m.color, avatar ?? m.avatar, m.id);
  ok(res, db.prepare('SELECT * FROM members WHERE id = ?').get(m.id));
});

app.delete('/api/members/:id', (req, res) => {
  const info = db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);
  info.changes ? ok(res, { deleted: true }) : notFound(res);
});

// ---------- Events ----------
// GET /api/events?start=YYYY-MM-DD&end=YYYY-MM-DD expands recurring events
// into concrete occurrences within the range. Each occurrence carries the
// parent event id plus an `occurs_on` date.

function expandEvents(start, end) {
  const rows = db.prepare(`
    SELECT e.*, m.name AS member_name, m.color AS member_color, m.avatar AS member_avatar
    FROM events e LEFT JOIN members m ON m.id = e.member_id
    WHERE (e.recurrence != 'none' AND e.date <= ?)
       OR (e.recurrence = 'none' AND e.date >= ? AND e.date <= ?)
  `).all(end, start, end);

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

    // Align cur to the recurrence pattern relative to the first occurrence.
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

app.get('/api/events', (req, res) => {
  const { start, end } = req.query;
  if (!DATE_RE.test(start || '') || !DATE_RE.test(end || '')) {
    return bad(res, 'start and end (YYYY-MM-DD) are required');
  }
  ok(res, expandEvents(start, end));
});

app.post('/api/events', (req, res) => {
  const { title, member_id, date, start_time, end_time, location, notes,
          recurrence, recurrence_until, created_by } = req.body;
  if (!title || !title.trim()) return bad(res, 'title is required');
  if (!DATE_RE.test(date || '')) return bad(res, 'date (YYYY-MM-DD) is required');
  if (start_time && !TIME_RE.test(start_time)) return bad(res, 'start_time must be HH:MM');
  if (end_time && !TIME_RE.test(end_time)) return bad(res, 'end_time must be HH:MM');
  const rec = ['none', 'daily', 'weekly', 'monthly'].includes(recurrence) ? recurrence : 'none';
  const info = db.prepare(`
    INSERT INTO events (title, member_id, date, start_time, end_time, location, notes, recurrence, recurrence_until, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title.trim(), member_id || null, date, start_time || null, end_time || null,
         location || null, notes || null, rec, recurrence_until || null, created_by || null);
  ok(res, db.prepare('SELECT * FROM events WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/events/:id', (req, res) => {
  const e = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!e) return notFound(res);
  const b = req.body;
  if (b.date !== undefined && !DATE_RE.test(b.date)) return bad(res, 'date must be YYYY-MM-DD');
  db.prepare(`
    UPDATE events SET title = ?, member_id = ?, date = ?, start_time = ?, end_time = ?,
      location = ?, notes = ?, recurrence = ?, recurrence_until = ? WHERE id = ?
  `).run(
    b.title ?? e.title,
    b.member_id !== undefined ? b.member_id : e.member_id,
    b.date ?? e.date,
    b.start_time !== undefined ? b.start_time : e.start_time,
    b.end_time !== undefined ? b.end_time : e.end_time,
    b.location !== undefined ? b.location : e.location,
    b.notes !== undefined ? b.notes : e.notes,
    b.recurrence ?? e.recurrence,
    b.recurrence_until !== undefined ? b.recurrence_until : e.recurrence_until,
    e.id);
  ok(res, db.prepare('SELECT * FROM events WHERE id = ?').get(e.id));
});

app.delete('/api/events/:id', (req, res) => {
  const info = db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  info.changes ? ok(res, { deleted: true }) : notFound(res);
});

// ---------- Meals ----------

app.get('/api/meals', (req, res) => {
  const { start, end } = req.query;
  if (!DATE_RE.test(start || '') || !DATE_RE.test(end || '')) {
    return bad(res, 'start and end (YYYY-MM-DD) are required');
  }
  ok(res, db.prepare('SELECT * FROM meals WHERE date >= ? AND date <= ? ORDER BY date').all(start, end));
});

// Upsert by (date, meal_type). Empty title clears the slot.
app.put('/api/meals', (req, res) => {
  const { date, meal_type, title, notes } = req.body;
  if (!DATE_RE.test(date || '')) return bad(res, 'date (YYYY-MM-DD) is required');
  if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(meal_type)) {
    return bad(res, 'meal_type must be breakfast|lunch|dinner|snack');
  }
  if (!title || !title.trim()) {
    db.prepare('DELETE FROM meals WHERE date = ? AND meal_type = ?').run(date, meal_type);
    return ok(res, { cleared: true });
  }
  db.prepare(`
    INSERT INTO meals (date, meal_type, title, notes) VALUES (?, ?, ?, ?)
    ON CONFLICT(date, meal_type) DO UPDATE SET title = excluded.title, notes = excluded.notes
  `).run(date, meal_type, title.trim(), notes || null);
  ok(res, db.prepare('SELECT * FROM meals WHERE date = ? AND meal_type = ?').get(date, meal_type));
});

// ---------- Chores ----------

app.get('/api/chores', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, m.name AS member_name, m.color AS member_color, m.avatar AS member_avatar
    FROM chores c LEFT JOIN members m ON m.id = c.member_id
    WHERE c.active = 1 ORDER BY c.member_id, c.id
  `).all();
  ok(res, rows.map(r => ({ ...r, days: JSON.parse(r.days) })));
});

app.post('/api/chores', (req, res) => {
  const { title, icon, member_id, days, points } = req.body;
  if (!title || !title.trim()) return bad(res, 'title is required');
  const dayList = Array.isArray(days) && days.length
    ? days.filter(d => Number.isInteger(d) && d >= 0 && d <= 6)
    : [0, 1, 2, 3, 4, 5, 6];
  const info = db.prepare('INSERT INTO chores (title, icon, member_id, days, points) VALUES (?, ?, ?, ?, ?)')
    .run(title.trim(), icon || '🧹', member_id || null, JSON.stringify(dayList), points || 1);
  const row = db.prepare('SELECT * FROM chores WHERE id = ?').get(info.lastInsertRowid);
  ok(res, { ...row, days: JSON.parse(row.days) });
});

app.put('/api/chores/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM chores WHERE id = ?').get(req.params.id);
  if (!c) return notFound(res);
  const b = req.body;
  db.prepare('UPDATE chores SET title = ?, icon = ?, member_id = ?, days = ?, points = ?, active = ? WHERE id = ?')
    .run(
      b.title ?? c.title,
      b.icon ?? c.icon,
      b.member_id !== undefined ? b.member_id : c.member_id,
      b.days !== undefined ? JSON.stringify(b.days) : c.days,
      b.points ?? c.points,
      b.active !== undefined ? (b.active ? 1 : 0) : c.active,
      c.id);
  const row = db.prepare('SELECT * FROM chores WHERE id = ?').get(c.id);
  ok(res, { ...row, days: JSON.parse(row.days) });
});

app.delete('/api/chores/:id', (req, res) => {
  const info = db.prepare('DELETE FROM chores WHERE id = ?').run(req.params.id);
  info.changes ? ok(res, { deleted: true }) : notFound(res);
});

// Completions for a date range, plus star totals per member for the same range.
app.get('/api/chores/completions', (req, res) => {
  const { start, end } = req.query;
  if (!DATE_RE.test(start || '') || !DATE_RE.test(end || '')) {
    return bad(res, 'start and end (YYYY-MM-DD) are required');
  }
  const completions = db.prepare(
    'SELECT * FROM chore_completions WHERE date >= ? AND date <= ?').all(start, end);
  const stars = db.prepare(`
    SELECT c.member_id, SUM(c.points) AS points
    FROM chore_completions cc JOIN chores c ON c.id = cc.chore_id
    WHERE cc.date >= ? AND cc.date <= ? AND c.member_id IS NOT NULL
    GROUP BY c.member_id
  `).all(start, end);
  ok(res, { completions, stars });
});

app.post('/api/chores/:id/toggle', (req, res) => {
  const { date } = req.body;
  if (!DATE_RE.test(date || '')) return bad(res, 'date (YYYY-MM-DD) is required');
  const chore = db.prepare('SELECT id FROM chores WHERE id = ?').get(req.params.id);
  if (!chore) return notFound(res);
  const existing = db.prepare('SELECT id FROM chore_completions WHERE chore_id = ? AND date = ?')
    .get(chore.id, date);
  if (existing) {
    db.prepare('DELETE FROM chore_completions WHERE id = ?').run(existing.id);
    return ok(res, { chore_id: chore.id, date, done: false });
  }
  db.prepare('INSERT INTO chore_completions (chore_id, date) VALUES (?, ?)').run(chore.id, date);
  ok(res, { chore_id: chore.id, date, done: true });
});

// ---------- Lists ----------

app.get('/api/lists', (req, res) => {
  const lists = db.prepare('SELECT * FROM lists ORDER BY id').all();
  const items = db.prepare('SELECT * FROM list_items ORDER BY done, position, id').all();
  ok(res, lists.map(l => ({ ...l, items: items.filter(i => i.list_id === l.id) })));
});

app.post('/api/lists', (req, res) => {
  const { name, type } = req.body;
  if (!name || !name.trim()) return bad(res, 'name is required');
  const info = db.prepare('INSERT INTO lists (name, type) VALUES (?, ?)')
    .run(name.trim(), type === 'grocery' ? 'grocery' : 'todo');
  ok(res, { ...db.prepare('SELECT * FROM lists WHERE id = ?').get(info.lastInsertRowid), items: [] });
});

app.delete('/api/lists/:id', (req, res) => {
  const info = db.prepare('DELETE FROM lists WHERE id = ?').run(req.params.id);
  info.changes ? ok(res, { deleted: true }) : notFound(res);
});

app.post('/api/lists/:id/items', (req, res) => {
  const list = db.prepare('SELECT id FROM lists WHERE id = ?').get(req.params.id);
  if (!list) return notFound(res);
  const { text, added_by } = req.body;
  if (!text || !text.trim()) return bad(res, 'text is required');
  const pos = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM list_items WHERE list_id = ?')
    .get(list.id).p;
  const info = db.prepare('INSERT INTO list_items (list_id, text, added_by, position) VALUES (?, ?, ?, ?)')
    .run(list.id, text.trim(), added_by || null, pos);
  ok(res, db.prepare('SELECT * FROM list_items WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/list-items/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM list_items WHERE id = ?').get(req.params.id);
  if (!item) return notFound(res);
  const { text, done } = req.body;
  db.prepare('UPDATE list_items SET text = ?, done = ? WHERE id = ?')
    .run(text ?? item.text, done !== undefined ? (done ? 1 : 0) : item.done, item.id);
  ok(res, db.prepare('SELECT * FROM list_items WHERE id = ?').get(item.id));
});

app.delete('/api/list-items/:id', (req, res) => {
  const info = db.prepare('DELETE FROM list_items WHERE id = ?').run(req.params.id);
  info.changes ? ok(res, { deleted: true }) : notFound(res);
});

// Clear all checked-off items in one tap (e.g. after a shopping trip).
app.post('/api/lists/:id/clear-done', (req, res) => {
  const info = db.prepare('DELETE FROM list_items WHERE list_id = ? AND done = 1').run(req.params.id);
  ok(res, { deleted: info.changes });
});

// ---------- Dashboard ----------
// One call returning everything the tablet's today-view needs.

app.get('/api/dashboard', (req, res) => {
  const date = DATE_RE.test(req.query.date || '') ? req.query.date : new Date().toISOString().slice(0, 10);
  const members = db.prepare('SELECT * FROM members ORDER BY id').all();
  const events = expandEvents(date, date);
  const meals = db.prepare('SELECT * FROM meals WHERE date = ?').all(date);
  const weekday = new Date(date + 'T00:00:00Z').getUTCDay();
  const chores = db.prepare(`
    SELECT c.*, m.name AS member_name, m.color AS member_color, m.avatar AS member_avatar
    FROM chores c LEFT JOIN members m ON m.id = c.member_id WHERE c.active = 1
  `).all().map(r => ({ ...r, days: JSON.parse(r.days) }))
    .filter(c => c.days.includes(weekday));
  const completions = db.prepare('SELECT chore_id FROM chore_completions WHERE date = ?').all(date)
    .map(r => r.chore_id);
  const lists = db.prepare('SELECT * FROM lists ORDER BY id').all();
  const items = db.prepare('SELECT * FROM list_items WHERE done = 0 ORDER BY position, id').all();
  ok(res, {
    date, members, events, meals,
    chores: chores.map(c => ({ ...c, done: completions.includes(c.id) })),
    lists: lists.map(l => ({ ...l, items: items.filter(i => i.list_id === l.id) })),
  });
});

app.listen(PORT, () => {
  console.log(`Family Planner running at http://localhost:${PORT}`);
});

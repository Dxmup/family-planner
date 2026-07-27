/* Family Planner SPA */

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

// ---------- parent auth ----------
// Reading is open to everyone (the wall tablet never logs in); any change
// requires a parent session. Tokens live in localStorage and refresh silently.

const auth = {
  load() { try { return JSON.parse(localStorage.getItem('fp_auth')) || null; } catch { return null; } },
  save(s) { localStorage.setItem('fp_auth', JSON.stringify(s)); },
  clear() { localStorage.removeItem('fp_auth'); },
  get session() { return this.load(); },
  async refresh() {
    const s = this.load();
    if (!s?.refresh_token) return false;
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: s.refresh_token }),
      });
      if (!res.ok) { this.clear(); return false; }
      this.save(await res.json());
      return true;
    } catch { return false; }
  },
};

const api = {
  async req(method, url, body, retried) {
    const headers = body ? { 'Content-Type': 'application/json' } : {};
    const s = auth.session;
    if (s?.access_token) headers['Authorization'] = `Bearer ${s.access_token}`;
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 && method !== 'GET') {
      if (!retried && await auth.refresh()) return api.req(method, url, body, true);
      const loggedIn = await promptLogin();
      if (loggedIn) return api.req(method, url, body, true);
      throw new Error('Parent login required');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  },
  get: (url) => api.req('GET', url),
  post: (url, body) => api.req('POST', url, body),
  put: (url, body) => api.req('PUT', url, body),
  del: (url) => api.req('DELETE', url),
};

// ---------- date helpers (all local time) ----------

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d, n) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
function startOfWeek(d) { return addDays(d, -d.getDay()); }  // week starts Sunday
function todayStr() { return ymd(new Date()); }
function fmtTime(t) {
  if (!t) return '';
  let [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- app state ----------

const state = {
  view: 'today',
  members: [],
  calMonth: new Date(),          // any date within the displayed month
  calFilter: null,               // member id | 'family' | null (= everyone)
  mealsWeekStart: startOfWeek(new Date()),
  choresWeekStart: startOfWeek(new Date()),
};

const COLORS = ['#e07a3f', '#4A90D9', '#5a9e6f', '#b05fa3', '#c85454', '#c9a227', '#5b8a8f', '#7a6fd0'];
const AVATARS = ['😀', '😎', '🥰', '🦖', '🦄', '🐻', '🐱', '🐶', '👧', '👦', '👩', '👨', '👵', '👴', '🤖', '🌟'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const CHORE_ICONS = ['🧹', '🛏️', '🍽️', '🗑️', '🐕', '🧺', '📚', '🌱', '🚿', '🧸', '🥗', '♻️'];

// ---------- clock ----------

function tickClock() {
  const now = new Date();
  let h = now.getHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  $('#clock-time').textContent = `${h}:${String(now.getMinutes()).padStart(2, '0')}`;
  $('#clock-date').textContent = `${DOW[now.getDay()]}, ${MONTHS[now.getMonth()].slice(0, 3)} ${now.getDate()}`;
}
setInterval(tickClock, 1000);
tickClock();

// ---------- modal ----------

function openModal(html) {
  $('#modal').innerHTML = html;
  $('#modal-backdrop').classList.remove('hidden');
}
function closeModal() {
  $('#modal-backdrop').classList.add('hidden');
  $('#modal').innerHTML = '';
}
$('#modal-backdrop').addEventListener('click', (e) => {
  if (e.target.id === 'modal-backdrop') closeModal();
});

// ---------- login modal ----------

let loginResolve = null;

function promptLogin() {
  return new Promise(resolve => {
    loginResolve = resolve;
    openModal(`
      <h2>🔒 Parent Login</h2>
      <p class="view-sub" style="margin-bottom:12px">Log in to add or change things. Viewing never needs a login.</p>
      <div class="form-row"><label>Email</label><input id="f-email" type="email" autocomplete="username"></div>
      <div class="form-row"><label>Password</label><input id="f-password" type="password" autocomplete="current-password"></div>
      <div id="login-error" class="empty" style="display:none;color:#c85454"></div>
      <div class="modal-actions">
        <button class="btn ghost" id="f-cancel">Cancel</button>
        <button class="btn" id="f-login">Log in</button>
      </div>`);
    $('#f-email').focus();
    const finish = (val) => { const r = loginResolve; loginResolve = null; closeModal(); r?.(val); };
    $('#f-cancel').addEventListener('click', () => finish(false));
    const submit = async () => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: $('#f-email').value.trim(), password: $('#f-password').value }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const el = $('#login-error');
        el.textContent = err.error || 'Login failed';
        el.style.display = 'block';
        return;
      }
      auth.save(await res.json());
      updateParentBtn();
      finish(true);
    };
    $('#f-login').addEventListener('click', submit);
    $('#f-password').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  });
}

function updateParentBtn() {
  const s = auth.session;
  const btn = $('#parent-btn');
  if (!btn) return;
  btn.innerHTML = s
    ? `<span class="nav-icon">🔓</span><span>Parent</span>`
    : `<span class="nav-icon">🔒</span><span>Parent</span>`;
  btn.title = s ? `Logged in as ${s.email} — tap to log out` : 'Parent login';
}

$('#parent-btn')?.addEventListener('click', async () => {
  if (auth.session) {
    if (confirm(`Log out ${auth.session.email}?`)) { auth.clear(); updateParentBtn(); }
  } else {
    await promptLogin();
  }
});
updateParentBtn();

// ---------- navigation ----------

$$('.nav-btn').forEach(btn => btn.addEventListener('click', () => {
  state.view = btn.dataset.view;
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b === btn));
  render();
}));

async function render() {
  state.members = await api.get('/api/members');
  const views = {
    today: renderToday,
    calendar: renderCalendar,
    meals: renderMeals,
    chores: renderChores,
    lists: renderLists,
    family: renderFamily,
  };
  await views[state.view]();
}

// Refresh periodically so edits from phones show up on the tablet.
setInterval(() => {
  if ($('#modal-backdrop').classList.contains('hidden')) render().catch(() => {});
}, 30000);

function memberById(id) { return state.members.find(m => m.id === id); }

function memberSelectOptions(selectedId, familyLabel = 'Whole family') {
  return `<option value="">${esc(familyLabel)}</option>` + state.members.map(m =>
    `<option value="${m.id}" ${m.id === selectedId ? 'selected' : ''}>${esc(m.avatar)} ${esc(m.name)}</option>`
  ).join('');
}

// ---------- Today ----------

async function renderToday() {
  const d = await api.get('/api/dashboard');
  const day = fromYmd(d.date);

  const eventsHtml = d.events.length ? d.events.map(e => {
    const m = e.member_id ? memberById(e.member_id) : null;
    return `<div class="event-row">
      <span class="member-dot" style="background:${m ? m.color : 'var(--muted)'}"></span>
      <span class="event-time">${e.start_time ? esc(fmtTime(e.start_time)) : 'All day'}</span>
      <span class="event-title">${esc(e.title)}</span>
      ${e.location ? `<span class="event-loc">📍 ${esc(e.location)}</span>` : ''}
    </div>`;
  }).join('') : '<div class="empty">No events today — enjoy!</div>';

  const mealOrder = MEAL_TYPES.filter(t => d.meals.some(m => m.meal_type === t));
  const mealsHtml = mealOrder.length ? mealOrder.map(t => {
    const m = d.meals.find(x => x.meal_type === t);
    return `<div class="meal-line"><span class="meal-label">${t}</span><span>${esc(m.title)}</span></div>`;
  }).join('') : '<div class="empty">Nothing planned yet</div>';

  const choresHtml = d.chores.length ? d.chores.map(c => `
    <div class="chore-line ${c.done ? 'done' : ''}">
      <button class="chore-check ${c.done ? 'done' : ''}" data-chore="${c.id}">${c.done ? '✓' : ''}</button>
      <span>${esc(c.icon)}</span>
      <span class="chore-title">${esc(c.title)}</span>
      ${c.member_id ? `<span class="li-by" style="margin-left:auto">${esc(memberById(c.member_id)?.avatar || '')} ${esc(c.member_name || '')}</span>` : ''}
    </div>`).join('') : '<div class="empty">No chores today 🎉</div>';

  const grocery = d.lists.find(l => l.type === 'grocery');
  const groceryHtml = grocery && grocery.items.length
    ? grocery.items.slice(0, 8).map(i => `<div class="list-item"><span class="li-text">• ${esc(i.text)}</span></div>`).join('')
      + (grocery.items.length > 8 ? `<div class="empty">+${grocery.items.length - 8} more…</div>` : '')
    : '<div class="empty">List is empty</div>';

  $('#main').innerHTML = `
    <div class="view-header">
      <div>
        <div class="view-title">Good ${greeting()}!</div>
        <div class="view-sub">${DOW[day.getDay()]}, ${MONTHS[day.getMonth()]} ${day.getDate()}, ${day.getFullYear()}</div>
      </div>
      <button class="btn" id="quick-add-event">+ Add Event</button>
    </div>
    <div class="today-grid">
      <div class="card"><h3>📅 Today's Schedule</h3>${eventsHtml}</div>
      <div>
        <div class="card" style="margin-bottom:16px"><h3>🍽️ Meals</h3>${mealsHtml}</div>
        <div class="card"><h3>🛒 ${grocery ? esc(grocery.name) : 'Groceries'}</h3>${groceryHtml}</div>
      </div>
      <div class="card"><h3>⭐ Today's Chores</h3>${choresHtml}</div>
    </div>`;

  $('#quick-add-event').addEventListener('click', () => eventForm({ date: d.date }));
  $$('.chore-check').forEach(btn => btn.addEventListener('click', async () => {
    await api.post(`/api/chores/${btn.dataset.chore}/toggle`, { date: d.date });
    renderToday();
  }));
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

// ---------- Calendar ----------

async function renderCalendar() {
  const y = state.calMonth.getFullYear();
  const mo = state.calMonth.getMonth();
  const first = new Date(y, mo, 1);
  const gridStart = startOfWeek(first);
  const gridEnd = addDays(gridStart, 41);
  const events = await api.get(`/api/events?start=${ymd(gridStart)}&end=${ymd(gridEnd)}`);

  const filtered = events.filter(e => {
    if (state.calFilter === null) return true;
    if (state.calFilter === 'family') return e.member_id === null;
    return e.member_id === state.calFilter;
  });
  const byDay = {};
  for (const e of filtered) (byDay[e.occurs_on] ||= []).push(e);

  const chips = [
    { key: null, label: 'Everyone', color: 'var(--ink)' },
    { key: 'family', label: '👪 Family', color: 'var(--muted)' },
    ...state.members.map(m => ({ key: m.id, label: `${m.avatar} ${m.name}`, color: m.color })),
  ].map(c => `<button class="member-chip ${state.calFilter === c.key ? 'active' : ''}"
      data-filter="${c.key === null ? '' : c.key}" style="color:${c.color}">${esc(c.label)}</button>`).join('');

  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i);
    const ds = ymd(d);
    const evs = byDay[ds] || [];
    const shown = evs.slice(0, 3).map(e => {
      const m = e.member_id ? memberById(e.member_id) : null;
      return `<div class="cal-event" style="background:${m ? m.color : '#9a938a'}">${e.start_time ? esc(fmtTime(e.start_time)) + ' ' : ''}${esc(e.title)}</div>`;
    }).join('');
    cells += `<div class="cal-cell ${d.getMonth() !== mo ? 'other-month' : ''} ${ds === todayStr() ? 'today' : ''}" data-date="${ds}">
      <div class="cal-day-num">${d.getDate()}</div>${shown}
      ${evs.length > 3 ? `<div class="cal-more">+${evs.length - 3} more</div>` : ''}
    </div>`;
  }

  $('#main').innerHTML = `
    <div class="view-header">
      <div class="cal-controls">
        <button class="btn ghost small" id="cal-prev">‹</button>
        <div class="view-title" style="min-width:250px;text-align:center">${MONTHS[mo]} ${y}</div>
        <button class="btn ghost small" id="cal-next">›</button>
        <button class="btn ghost small" id="cal-today">Today</button>
      </div>
      <button class="btn" id="add-event">+ Add Event</button>
    </div>
    <div class="member-filter" style="margin-bottom:14px">${chips}</div>
    <div class="cal-grid">
      ${DOW.map(d => `<div class="cal-dow">${d}</div>`).join('')}
      ${cells}
    </div>`;

  $('#cal-prev').addEventListener('click', () => { state.calMonth = new Date(y, mo - 1, 1); renderCalendar(); });
  $('#cal-next').addEventListener('click', () => { state.calMonth = new Date(y, mo + 1, 1); renderCalendar(); });
  $('#cal-today').addEventListener('click', () => { state.calMonth = new Date(); renderCalendar(); });
  $('#add-event').addEventListener('click', () => eventForm({ date: todayStr() }));
  $$('.member-chip').forEach(chip => chip.addEventListener('click', () => {
    const v = chip.dataset.filter;
    state.calFilter = v === '' ? null : (v === 'family' ? 'family' : Number(v));
    renderCalendar();
  }));
  $$('.cal-cell').forEach(cell => cell.addEventListener('click', () => dayDetail(cell.dataset.date)));
}

async function dayDetail(dateStr) {
  const events = await api.get(`/api/events?start=${dateStr}&end=${dateStr}`);
  const d = fromYmd(dateStr);
  const rows = events.length ? events.map(e => {
    const m = e.member_id ? memberById(e.member_id) : null;
    return `<div class="event-row">
      <span class="member-dot" style="background:${m ? m.color : 'var(--muted)'}"></span>
      <span class="event-time">${e.start_time ? esc(fmtTime(e.start_time)) : 'All day'}</span>
      <span class="event-title">${esc(e.title)}${m ? ` <span class="li-by">(${esc(m.name)})</span>` : ''}</span>
      <button class="btn ghost small" data-edit="${e.id}">Edit</button>
      <button class="li-del" data-del="${e.id}">🗑️</button>
    </div>`;
  }).join('') : '<div class="empty">No events this day</div>';

  openModal(`
    <h2>${DOW[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}</h2>
    ${rows}
    <div class="modal-actions">
      <button class="btn ghost" id="m-close">Close</button>
      <button class="btn" id="m-add">+ Add Event</button>
    </div>`);

  $('#m-close').addEventListener('click', closeModal);
  $('#m-add').addEventListener('click', () => eventForm({ date: dateStr }));
  $$('#modal [data-edit]').forEach(b => b.addEventListener('click', async () => {
    const ev = events.find(e => e.id === Number(b.dataset.edit));
    eventForm(ev);
  }));
  $$('#modal [data-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this event?')) return;
    await api.del(`/api/events/${b.dataset.del}`);
    closeModal();
    render();
  }));
}

function eventForm(ev = {}) {
  const isEdit = !!ev.id;
  openModal(`
    <h2>${isEdit ? 'Edit Event' : 'New Event'}</h2>
    <div class="form-row"><label>Title</label><input id="f-title" value="${esc(ev.title || '')}" placeholder="Soccer practice"></div>
    <div class="form-row"><label>Who</label><select id="f-member">${memberSelectOptions(ev.member_id)}</select></div>
    <div class="form-cols">
      <div class="form-row"><label>Date</label><input id="f-date" type="date" value="${ev.date || todayStr()}"></div>
      <div class="form-row"><label>Start</label><input id="f-start" type="time" value="${ev.start_time || ''}"></div>
      <div class="form-row"><label>End</label><input id="f-end" type="time" value="${ev.end_time || ''}"></div>
    </div>
    <div class="form-row"><label>Location</label><input id="f-loc" value="${esc(ev.location || '')}" placeholder="(optional)"></div>
    <div class="form-cols">
      <div class="form-row"><label>Repeats</label>
        <select id="f-rec">
          ${['none', 'daily', 'weekly', 'monthly'].map(r =>
            `<option value="${r}" ${(ev.recurrence || 'none') === r ? 'selected' : ''}>${r === 'none' ? 'Does not repeat' : r[0].toUpperCase() + r.slice(1)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row"><label>Until (optional)</label><input id="f-until" type="date" value="${ev.recurrence_until || ''}"></div>
    </div>
    <div class="modal-actions">
      ${isEdit ? '<button class="btn danger" id="f-delete">Delete</button>' : ''}
      <span class="spacer"></span>
      <button class="btn ghost" id="f-cancel">Cancel</button>
      <button class="btn" id="f-save">Save</button>
    </div>`);

  $('#f-cancel').addEventListener('click', closeModal);
  if (isEdit) $('#f-delete').addEventListener('click', async () => {
    if (!confirm('Delete this event?')) return;
    await api.del(`/api/events/${ev.id}`);
    closeModal(); render();
  });
  $('#f-save').addEventListener('click', async () => {
    const body = {
      title: $('#f-title').value,
      member_id: $('#f-member').value ? Number($('#f-member').value) : null,
      date: $('#f-date').value,
      start_time: $('#f-start').value || null,
      end_time: $('#f-end').value || null,
      location: $('#f-loc').value || null,
      recurrence: $('#f-rec').value,
      recurrence_until: $('#f-until').value || null,
    };
    if (!body.title.trim()) { alert('Please enter a title'); return; }
    try {
      if (isEdit) await api.put(`/api/events/${ev.id}`, body);
      else await api.post('/api/events', body);
      closeModal(); render();
    } catch (e) { alert(e.message); }
  });
}

// ---------- Meals ----------

async function renderMeals() {
  const start = state.mealsWeekStart;
  const end = addDays(start, 6);
  const meals = await api.get(`/api/meals?start=${ymd(start)}&end=${ymd(end)}`);
  const find = (ds, type) => meals.find(m => m.date === ds && m.meal_type === type);

  const heads = ['<div></div>'];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    heads.push(`<div class="week-head ${ymd(d) === todayStr() ? 'today' : ''}">
      <div class="dow">${DOW[d.getDay()]}</div><div>${d.getDate()}</div></div>`);
  }

  const rows = MEAL_TYPES.map(type => {
    let cells = `<div class="week-row-label">${{ breakfast: '🥞', lunch: '🥪', dinner: '🍝', snack: '🍎' }[type]} ${type[0].toUpperCase() + type.slice(1)}</div>`;
    for (let i = 0; i < 7; i++) {
      const ds = ymd(addDays(start, i));
      const m = find(ds, type);
      cells += `<div class="meal-cell ${m ? '' : 'empty-slot'}" data-date="${ds}" data-type="${type}">${m ? esc(m.title) : '+'}</div>`;
    }
    return cells;
  }).join('');

  $('#main').innerHTML = `
    <div class="view-header">
      <div class="cal-controls">
        <button class="btn ghost small" id="wk-prev">‹</button>
        <div class="view-title" style="text-align:center">Meal Plan</div>
        <button class="btn ghost small" id="wk-next">›</button>
        <button class="btn ghost small" id="wk-today">This Week</button>
      </div>
      <div class="view-sub">${MONTHS[start.getMonth()].slice(0, 3)} ${start.getDate()} – ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getDate()}</div>
    </div>
    <div class="week-grid">${heads.join('')}${rows}</div>`;

  $('#wk-prev').addEventListener('click', () => { state.mealsWeekStart = addDays(start, -7); renderMeals(); });
  $('#wk-next').addEventListener('click', () => { state.mealsWeekStart = addDays(start, 7); renderMeals(); });
  $('#wk-today').addEventListener('click', () => { state.mealsWeekStart = startOfWeek(new Date()); renderMeals(); });

  $$('.meal-cell').forEach(cell => cell.addEventListener('click', () => {
    const { date, type } = cell.dataset;
    const existing = find(date, type);
    const d = fromYmd(date);
    openModal(`
      <h2>${type[0].toUpperCase() + type.slice(1)} · ${DOW[d.getDay()]} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}</h2>
      <div class="form-row"><label>What's cooking?</label>
        <input id="f-meal" value="${esc(existing?.title || '')}" placeholder="Spaghetti &amp; meatballs"></div>
      <div class="modal-actions">
        ${existing ? '<button class="btn danger" id="f-clear">Clear</button>' : ''}
        <span class="spacer"></span>
        <button class="btn ghost" id="f-cancel">Cancel</button>
        <button class="btn" id="f-save">Save</button>
      </div>`);
    $('#f-meal').focus();
    $('#f-cancel').addEventListener('click', closeModal);
    const save = async (title) => {
      await api.put('/api/meals', { date, meal_type: type, title });
      closeModal(); renderMeals();
    };
    if (existing) $('#f-clear').addEventListener('click', () => save(''));
    $('#f-save').addEventListener('click', () => save($('#f-meal').value));
    $('#f-meal').addEventListener('keydown', e => { if (e.key === 'Enter') save($('#f-meal').value); });
  }));
}

// ---------- Chores ----------

async function renderChores() {
  const start = state.choresWeekStart;
  const end = addDays(start, 6);
  const [chores, comp] = await Promise.all([
    api.get('/api/chores'),
    api.get(`/api/chores/completions?start=${ymd(start)}&end=${ymd(end)}`),
  ]);
  const doneSet = new Set(comp.completions.map(c => `${c.chore_id}|${c.date}`));
  const starsByMember = Object.fromEntries(comp.stars.map(s => [s.member_id, s.points]));

  const groups = [];
  for (const m of state.members) {
    const list = chores.filter(c => c.member_id === m.id);
    if (list.length) groups.push({ member: m, chores: list });
  }
  const unassigned = chores.filter(c => !c.member_id || !memberById(c.member_id));
  if (unassigned.length) groups.push({ member: null, chores: unassigned });

  const headRow = ['<div></div>'];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    headRow.push(`<div class="week-head ${ymd(d) === todayStr() ? 'today' : ''}">
      <div class="dow">${DOW[d.getDay()]}</div><div>${d.getDate()}</div></div>`);
  }

  const blocks = groups.map(g => {
    const rows = g.chores.map(c => {
      let cells = `<div class="chore-row-title"><span class="ic">${esc(c.icon)}</span> ${esc(c.title)}
        <button class="li-del" data-edit-chore="${c.id}" title="Edit">✏️</button></div>`;
      for (let i = 0; i < 7; i++) {
        const d = addDays(start, i);
        const ds = ymd(d);
        const applies = c.days.includes(d.getDay());
        const done = doneSet.has(`${c.id}|${ds}`);
        cells += applies
          ? `<div class="chore-grid-cell ${done ? 'done' : ''}" data-chore="${c.id}" data-date="${ds}">${done ? '⭐' : ''}</div>`
          : '<div class="chore-grid-cell na"></div>';
      }
      return cells;
    }).join('');
    const head = g.member
      ? `<div class="chore-member-head"><span class="avatar">${esc(g.member.avatar)}</span>
           <span class="name" style="color:${g.member.color}">${esc(g.member.name)}</span>
           <span class="star-count">⭐ ${starsByMember[g.member.id] || 0} this week</span></div>`
      : `<div class="chore-member-head"><span class="avatar">👪</span><span class="name">Anyone</span></div>`;
    return `<div class="chore-member-block">${head}<div class="week-grid">${headRow.join('')}${rows}</div></div>`;
  }).join('');

  $('#main').innerHTML = `
    <div class="view-header">
      <div class="cal-controls">
        <button class="btn ghost small" id="wk-prev">‹</button>
        <div class="view-title" style="text-align:center">Chore Chart</div>
        <button class="btn ghost small" id="wk-next">›</button>
        <button class="btn ghost small" id="wk-today">This Week</button>
      </div>
      <button class="btn" id="add-chore">+ Add Chore</button>
    </div>
    ${blocks || '<div class="empty" style="font-size:18px">No chores yet — tap "+ Add Chore" to set up your chart.</div>'}`;

  $('#wk-prev').addEventListener('click', () => { state.choresWeekStart = addDays(start, -7); renderChores(); });
  $('#wk-next').addEventListener('click', () => { state.choresWeekStart = addDays(start, 7); renderChores(); });
  $('#wk-today').addEventListener('click', () => { state.choresWeekStart = startOfWeek(new Date()); renderChores(); });
  $('#add-chore').addEventListener('click', () => choreForm());
  $$('[data-edit-chore]').forEach(b => b.addEventListener('click', () => {
    choreForm(chores.find(c => c.id === Number(b.dataset.editChore)));
  }));
  $$('.chore-grid-cell[data-chore]').forEach(cell => cell.addEventListener('click', async () => {
    await api.post(`/api/chores/${cell.dataset.chore}/toggle`, { date: cell.dataset.date });
    renderChores();
  }));
}

function choreForm(chore = {}) {
  const isEdit = !!chore.id;
  const days = chore.days || [0, 1, 2, 3, 4, 5, 6];
  openModal(`
    <h2>${isEdit ? 'Edit Chore' : 'New Chore'}</h2>
    <div class="form-row"><label>Chore</label><input id="f-title" value="${esc(chore.title || '')}" placeholder="Make bed"></div>
    <div class="form-row"><label>Icon</label>
      <div class="emoji-picker">${CHORE_ICONS.map(i =>
        `<button class="emoji-opt ${(chore.icon || '🧹') === i ? 'on' : ''}" data-emoji="${i}">${i}</button>`).join('')}</div>
    </div>
    <div class="form-row"><label>Assigned to</label><select id="f-member">${memberSelectOptions(chore.member_id, 'Anyone')}</select></div>
    <div class="form-row"><label>Days</label>
      <div class="day-picker">${DOW.map((d, i) =>
        `<button class="day-pick ${days.includes(i) ? 'on' : ''}" data-day="${i}">${d[0]}</button>`).join('')}</div>
    </div>
    <div class="form-row"><label>Stars (points)</label><input id="f-points" type="number" min="1" max="10" value="${chore.points || 1}"></div>
    <div class="modal-actions">
      ${isEdit ? '<button class="btn danger" id="f-delete">Delete</button>' : ''}
      <span class="spacer"></span>
      <button class="btn ghost" id="f-cancel">Cancel</button>
      <button class="btn" id="f-save">Save</button>
    </div>`);

  $$('#modal .emoji-opt').forEach(b => b.addEventListener('click', () => {
    $$('#modal .emoji-opt').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
  }));
  $$('#modal .day-pick').forEach(b => b.addEventListener('click', () => b.classList.toggle('on')));
  $('#f-cancel').addEventListener('click', closeModal);
  if (isEdit) $('#f-delete').addEventListener('click', async () => {
    if (!confirm('Delete this chore and its history?')) return;
    await api.del(`/api/chores/${chore.id}`);
    closeModal(); renderChores();
  });
  $('#f-save').addEventListener('click', async () => {
    const body = {
      title: $('#f-title').value,
      icon: $('#modal .emoji-opt.on')?.dataset.emoji || '🧹',
      member_id: $('#f-member').value ? Number($('#f-member').value) : null,
      days: $$('#modal .day-pick.on').map(b => Number(b.dataset.day)),
      points: Number($('#f-points').value) || 1,
    };
    if (!body.title.trim()) { alert('Please enter a chore name'); return; }
    if (!body.days.length) { alert('Pick at least one day'); return; }
    try {
      if (isEdit) await api.put(`/api/chores/${chore.id}`, body);
      else await api.post('/api/chores', body);
      closeModal(); renderChores();
    } catch (e) { alert(e.message); }
  });
}

// ---------- Lists ----------

async function renderLists() {
  const lists = await api.get('/api/lists');

  const cards = lists.map(l => `
    <div class="card">
      <h3>${l.type === 'grocery' ? '🛒' : '✅'} ${esc(l.name)}
        <span style="margin-left:auto;display:flex;gap:6px">
          ${l.items.some(i => i.done) ? `<button class="btn ghost small" data-clear="${l.id}">Clear done</button>` : ''}
          <button class="li-del" data-del-list="${l.id}">🗑️</button>
        </span></h3>
      ${l.items.map(i => `
        <div class="list-item ${i.done ? 'done' : ''}">
          <button class="chore-check ${i.done ? 'done' : ''}" data-toggle="${i.id}" data-done="${i.done ? 1 : 0}">${i.done ? '✓' : ''}</button>
          <span class="li-text">${esc(i.text)}</span>
          ${i.added_by ? `<span class="li-by">${esc(i.added_by)}</span>` : ''}
          <button class="li-del" data-del-item="${i.id}">✕</button>
        </div>`).join('') || '<div class="empty">Empty — add something below</div>'}
      <div class="add-item-row">
        <input placeholder="Add item…" data-input="${l.id}">
        <button class="btn small" data-add="${l.id}">Add</button>
      </div>
    </div>`).join('');

  $('#main').innerHTML = `
    <div class="view-header">
      <div class="view-title">Lists</div>
      <button class="btn" id="add-list">+ New List</button>
    </div>
    <div class="lists-grid">${cards}</div>`;

  const addItem = async (listId) => {
    const input = $(`[data-input="${listId}"]`);
    if (!input.value.trim()) return;
    await api.post(`/api/lists/${listId}/items`, { text: input.value });
    renderLists();
  };
  $$('[data-add]').forEach(b => b.addEventListener('click', () => addItem(b.dataset.add)));
  $$('[data-input]').forEach(inp => inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') addItem(inp.dataset.input);
  }));
  $$('[data-toggle]').forEach(b => b.addEventListener('click', async () => {
    await api.put(`/api/list-items/${b.dataset.toggle}`, { done: b.dataset.done !== '1' });
    renderLists();
  }));
  $$('[data-del-item]').forEach(b => b.addEventListener('click', async () => {
    await api.del(`/api/list-items/${b.dataset.delItem}`);
    renderLists();
  }));
  $$('[data-clear]').forEach(b => b.addEventListener('click', async () => {
    await api.post(`/api/lists/${b.dataset.clear}/clear-done`);
    renderLists();
  }));
  $$('[data-del-list]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this entire list?')) return;
    await api.del(`/api/lists/${b.dataset.delList}`);
    renderLists();
  }));
  $('#add-list').addEventListener('click', () => {
    openModal(`
      <h2>New List</h2>
      <div class="form-row"><label>Name</label><input id="f-name" placeholder="Costco run"></div>
      <div class="form-row"><label>Type</label>
        <select id="f-type"><option value="todo">To-do list</option><option value="grocery">Shopping list</option></select></div>
      <div class="modal-actions">
        <button class="btn ghost" id="f-cancel">Cancel</button>
        <button class="btn" id="f-save">Create</button>
      </div>`);
    $('#f-cancel').addEventListener('click', closeModal);
    $('#f-save').addEventListener('click', async () => {
      if (!$('#f-name').value.trim()) return;
      await api.post('/api/lists', { name: $('#f-name').value, type: $('#f-type').value });
      closeModal(); renderLists();
    });
  });
}

// ---------- Family ----------

async function renderFamily() {
  const cards = state.members.map(m => `
    <div class="card member-card" data-member="${m.id}">
      <div class="avatar">${esc(m.avatar)}</div>
      <div class="name">${esc(m.name)}</div>
      <div class="swatch" style="background:${m.color}"></div>
      <button class="btn ghost small">Edit</button>
    </div>`).join('');

  $('#main').innerHTML = `
    <div class="view-header">
      <div>
        <div class="view-title">Family</div>
        <div class="view-sub">Everyone gets a color for calendars and chores</div>
      </div>
    </div>
    <div class="family-grid">
      ${cards}
      <button class="card member-card-add" id="add-member">+ Add family member</button>
    </div>`;

  $('#add-member').addEventListener('click', () => memberForm());
  $$('[data-member]').forEach(card => card.addEventListener('click', () => {
    memberForm(state.members.find(m => m.id === Number(card.dataset.member)));
  }));
}

function memberForm(m = {}) {
  const isEdit = !!m.id;
  openModal(`
    <h2>${isEdit ? 'Edit' : 'Add'} Family Member</h2>
    <div class="form-row"><label>Name</label><input id="f-name" value="${esc(m.name || '')}" placeholder="First name"></div>
    <div class="form-row"><label>Avatar</label>
      <div class="emoji-picker">${AVATARS.map(a =>
        `<button class="emoji-opt ${(m.avatar || '😀') === a ? 'on' : ''}" data-emoji="${a}">${a}</button>`).join('')}</div>
    </div>
    <div class="form-row"><label>Color</label>
      <div class="color-picker">${COLORS.map(c =>
        `<button class="color-opt ${(m.color || COLORS[0]) === c ? 'on' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}</div>
    </div>
    <div class="modal-actions">
      ${isEdit ? '<button class="btn danger" id="f-delete">Remove</button>' : ''}
      <span class="spacer"></span>
      <button class="btn ghost" id="f-cancel">Cancel</button>
      <button class="btn" id="f-save">Save</button>
    </div>`);

  $$('#modal .emoji-opt').forEach(b => b.addEventListener('click', () => {
    $$('#modal .emoji-opt').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
  }));
  $$('#modal .color-opt').forEach(b => b.addEventListener('click', () => {
    $$('#modal .color-opt').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
  }));
  $('#f-cancel').addEventListener('click', closeModal);
  if (isEdit) $('#f-delete').addEventListener('click', async () => {
    if (!confirm(`Remove ${m.name}? Their chores will be deleted; their events stay as family events.`)) return;
    await api.del(`/api/members/${m.id}`);
    closeModal(); render();
  });
  $('#f-save').addEventListener('click', async () => {
    const body = {
      name: $('#f-name').value,
      avatar: $('#modal .emoji-opt.on')?.dataset.emoji || '😀',
      color: $('#modal .color-opt.on')?.dataset.color || COLORS[0],
    };
    if (!body.name.trim()) { alert('Please enter a name'); return; }
    try {
      if (isEdit) await api.put(`/api/members/${m.id}`, body);
      else await api.post('/api/members', body);
      closeModal(); render();
    } catch (e) { alert(e.message); }
  });
}

// ---------- boot ----------

render().catch(err => {
  $('#main').innerHTML = `<div class="empty">Could not reach the server: ${esc(err.message)}</div>`;
});

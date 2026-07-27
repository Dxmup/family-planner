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
    let s = auth.session;
    // Refresh proactively when the access token is about to expire, so a
    // phone that sat idle for an hour doesn't silently lose parent powers.
    if (s?.expires_at && s.expires_at * 1000 < Date.now() + 60000 && !retried) {
      await auth.refresh();
      s = auth.session;
    }
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
    if (res.status === 401 && method === 'GET' && s && !retried) {
      // Stale session on a read: refresh once, else fall back to anonymous.
      if (!await auth.refresh()) { auth.clear(); updateParentBtn(); }
      return api.req(method, url, body, true);
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
  todayFocus: null,              // member id: Today shows only their items
  todayFocusTimer: null,
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

// ---------- fullscreen (Fire tablet / Silk has no kiosk mode) ----------

if (document.documentElement.requestFullscreen) {
  $('#fullscreen-btn').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  });
  document.addEventListener('fullscreenchange', () => {
    $('#fullscreen-btn').querySelector('span:last-child').textContent =
      document.fullscreenElement ? 'Exit' : 'Full';
  });
} else {
  $('#fullscreen-btn').style.display = 'none';
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
    routines: renderRoutines,
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

// ---------- weather (Open-Meteo, no key needed; cached 30 min) ----------

const WEATHER_LAT = 34.85, WEATHER_LON = -82.40;   // Greenville, SC
const WMO_ICON = (c) =>
  c === 0 ? '☀️' : c <= 2 ? '🌤️' : c === 3 ? '☁️' : c <= 48 ? '🌫️' :
  c <= 57 ? '🌦️' : c <= 67 ? '🌧️' : c <= 77 ? '❄️' : c <= 82 ? '🌧️' :
  c <= 86 ? '🌨️' : '⛈️';
let weatherCache = { at: 0, html: '' };

async function weatherHtml() {
  if (Date.now() - weatherCache.at < 30 * 60 * 1000) return weatherCache.html;
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=1`);
    const w = await r.json();
    const cur = w.current, day = w.daily;
    weatherCache = {
      at: Date.now(),
      html: `<span class="weather">${WMO_ICON(cur.weather_code)} ${Math.round(cur.temperature_2m)}°
        <span class="li-by">H ${Math.round(day.temperature_2m_max[0])}° / L ${Math.round(day.temperature_2m_min[0])}°</span></span>`,
    };
  } catch { weatherCache = { at: Date.now(), html: '' }; }
  return weatherCache.html;
}

function inWindow(r) {
  const now = new Date();
  const cur = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return (!r.start_time || cur >= r.start_time) && (!r.end_time || cur <= r.end_time);
}

const FOCUS_MINUTES = 3;

function setTodayFocus(memberId) {
  state.todayFocus = memberId;
  clearTimeout(state.todayFocusTimer);
  if (memberId !== null) {
    // Snap back to the family overview automatically.
    state.todayFocusTimer = setTimeout(() => {
      state.todayFocus = null;
      if (state.view === 'today') renderToday().catch(() => {});
    }, FOCUS_MINUTES * 60 * 1000);
  }
  renderToday().catch(() => {});
}

async function renderToday() {
  const [d, weather] = await Promise.all([api.get('/api/dashboard'), weatherHtml()]);
  const day = fromYmd(d.date);

  // Focus mode: narrow everything to one member (family-wide events stay).
  const focus = state.todayFocus !== null ? memberById(state.todayFocus) : null;
  if (focus) {
    d.events = d.events.filter(e => e.member_id === focus.id || e.member_id === null);
    d.chores = d.chores.filter(c => c.member_id === focus.id);
    d.routines = (d.routines || []).filter(r => r.member_id === focus.id || r.member_id === null);
  }

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
    ? grocery.items.slice(0, 6).map(i => `<div class="list-item"><span class="li-text">• ${esc(i.text)}</span></div>`).join('')
      + (grocery.items.length > 6 ? `<div class="empty">+${grocery.items.length - 6} more…</div>` : '')
    : '<div class="empty">List is empty</div>';

  const annHtml = (d.announcements || []).length ? `
    <div class="card announce-card">
      ${d.announcements.map(a => `<div class="announce-line">
        <span>${esc(a.icon)}</span><span>${esc(a.text)}</span>
        <button class="li-del" data-del-ann="${a.id}">✕</button>
      </div>`).join('')}
    </div>` : '';

  const cds = (d.countdowns || []);
  const cdHtml = cds.length ? `
    <div class="countdown-row">
      ${cds.map(c => {
        const days = Math.round((fromYmd(c.date) - fromYmd(d.date)) / 86400000);
        return `<div class="countdown-chip" data-del-cd="${c.id}">
          <span class="cd-icon">${esc(c.icon)}</span>
          <span class="cd-days">${days === 0 ? 'Today!' : days === 1 ? 'Tomorrow' : days + ' days'}</span>
          <span class="cd-title">${esc(c.title)}</span>
        </div>`;
      }).join('')}
    </div>` : '';

  // Every dashboard card is drag-to-rearrange; the order lives in
  // localStorage, so the wall tablet and each phone keep their own layout.
  const HANDLE = '<span class="drag-handle" title="Drag to rearrange">✥</span>';
  const cards = [
    { key: 'schedule', html: `<h3>📅 ${focus ? esc(focus.name) + "'s Schedule" : "Today's Schedule"}${HANDLE}</h3>${eventsHtml}` },
    ...(focus ? [] : [
      { key: 'meals', html: `<h3>🍽️ Meals${HANDLE}</h3>${mealsHtml}` },
      { key: 'grocery', html: `<h3>🛒 ${grocery ? esc(grocery.name) : 'Groceries'}${HANDLE}</h3>${groceryHtml}` },
    ]),
    { key: 'chores', html: `<h3>⭐ ${focus ? esc(focus.name) + "'s Chores" : "Today's Chores"}${HANDLE}</h3>${choresHtml}` },
  ];
  for (const r of (d.routines || []).filter(r => r.items.length)) {
    const m = r.member_id ? memberById(r.member_id) : null;
    const doneCount = r.items.filter(i => i.done).length;
    const live = inWindow(r);
    cards.push({
      key: `routine-${r.id}`,
      cls: `routine-card ${live ? '' : 'routine-idle'}`,
      html: `<h3>${esc(r.icon)} ${esc(r.title)}${m ? ` · ${esc(m.avatar)} ${esc(m.name)}` : ''}
        <span style="margin-left:auto" class="li-by">${doneCount}/${r.items.length}${live ? '' : r.start_time ? ' · at ' + fmtTime(r.start_time) : ''}</span>${HANDLE}</h3>
      ${doneCount === r.items.length ? '<div class="routine-done-banner">🎉 All done!</div>' : ''}
      ${r.items.map(i => `
        <div class="chore-line ${i.done ? 'done' : ''}">
          <button class="chore-check ${i.done ? 'done' : ''}" data-ritem="${i.id}">${i.done ? '✓' : ''}</button>
          <span>${esc(i.icon)}</span><span class="chore-title">${esc(i.text)}</span>
        </div>`).join('')}`,
    });
  }

  let order = [];
  try { order = JSON.parse(localStorage.getItem('fp_today_order')) || []; } catch { /* ignore */ }
  cards.sort((a, b) => {
    const ia = order.indexOf(a.key), ib = order.indexOf(b.key);
    return (ia === -1 ? order.length + cards.indexOf(a) : ia) -
           (ib === -1 ? order.length + cards.indexOf(b) : ib);
  });
  const gridHtml = cards.map(c =>
    `<div class="card today-card ${c.cls || ''}" data-key="${c.key}">${c.html}</div>`).join('');

  const focusChips = `
    <div class="member-filter" style="margin-bottom:14px">
      <button class="member-chip ${!focus ? 'active' : ''}" data-focus="">👪 Everyone</button>
      ${state.members.map(m => `
        <button class="member-chip ${focus?.id === m.id ? 'active' : ''}" data-focus="${m.id}"
          style="color:${m.color}">${esc(m.avatar)} ${esc(m.name)}</button>`).join('')}
    </div>`;

  $('#main').innerHTML = `
    <div class="view-header">
      <div>
        <div class="view-title">${focus ? `${esc(focus.avatar)} ${esc(focus.name)}'s Day` : `Good ${greeting()}!`}</div>
        <div class="view-sub">${DOW[day.getDay()]}, ${MONTHS[day.getMonth()]} ${day.getDate()}, ${day.getFullYear()}${focus ? ` · back to everyone in ${FOCUS_MINUTES} min` : ''}</div>
      </div>
      <div class="header-actions">
        ${weather}
        <button class="btn ghost small" id="add-extra">+ 📣 / 🎉</button>
        <button class="btn" id="quick-add-event">+ Add Event</button>
      </div>
    </div>
    ${focusChips}
    ${focus ? '' : annHtml}
    ${focus ? '' : cdHtml}
    <div class="today-grid" id="today-grid">${gridHtml}</div>`;

  $$('[data-focus]').forEach(chip => chip.addEventListener('click', () => {
    const v = chip.dataset.focus;
    setTodayFocus(v === '' || Number(v) === state.todayFocus ? null : Number(v));
  }));
  $$('#today-grid .drag-handle').forEach(h => h.addEventListener('pointerdown', startCardDrag));
  $('#quick-add-event').addEventListener('click', () => eventForm({ date: d.date }));
  $('#add-extra').addEventListener('click', extrasForm);
  $$('.chore-check[data-chore]').forEach(btn => btn.addEventListener('click', async () => {
    await api.post(`/api/chores/${btn.dataset.chore}/toggle`, { date: d.date });
    renderToday();
  }));
  $$('[data-ritem]').forEach(btn => btn.addEventListener('click', async () => {
    await api.post(`/api/routine-items/${btn.dataset.ritem}/toggle`, { date: d.date });
    renderToday();
  }));
  $$('[data-del-ann]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Remove this announcement?')) return;
    await api.del(`/api/announcements/${b.dataset.delAnn}`);
    renderToday();
  }));
  $$('[data-del-cd]').forEach(chip => chip.addEventListener('click', async () => {
    if (!confirm('Remove this countdown?')) return;
    await api.del(`/api/countdowns/${chip.dataset.delCd}`);
    renderToday();
  }));
}

// Pointer-based card reordering (works for both mouse and touch).
function startCardDrag(e) {
  e.preventDefault();
  const card = e.target.closest('.today-card');
  const grid = card.parentElement;
  card.classList.add('dragging');
  card.setPointerCapture?.(e.pointerId);

  const move = (ev) => {
    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    const over = el && el.closest('.today-card:not(.dragging)');
    if (over && over.parentElement === grid) {
      const r = over.getBoundingClientRect();
      const before = ev.clientY < r.top + r.height / 2 ||
        (ev.clientY < r.bottom && ev.clientX < r.left + r.width / 2);
      grid.insertBefore(card, before ? over : over.nextSibling);
    }
  };
  const up = () => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    document.removeEventListener('pointercancel', up);
    card.classList.remove('dragging');
    // Don't persist while in single-member focus: hidden cards would lose
    // their saved slots in the family layout.
    if (state.todayFocus === null) {
      localStorage.setItem('fp_today_order',
        JSON.stringify($$('.today-card', grid).map(c => c.dataset.key)));
    }
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', up);
}

// Quick-add modal for announcements and countdowns (parent-gated by the API).
function extrasForm() {
  openModal(`
    <h2>Add to the board</h2>
    <div class="form-row"><label>📣 Announcement</label>
      <input id="f-ann" placeholder="Grandma arrives Friday!"></div>
    <hr style="border:none;border-top:1px solid var(--line);margin:16px 0">
    <div class="form-row"><label>🎉 Countdown</label>
      <input id="f-cd-title" placeholder="Beach trip"></div>
    <div class="form-cols">
      <div class="form-row"><label>Date</label><input id="f-cd-date" type="date"></div>
      <div class="form-row"><label>Icon</label>
        <div class="emoji-picker">${['🎉', '🎂', '✈️', '🏖️', '🎄', '🎓', '⚽'].map((e, i) =>
          `<button class="emoji-opt ${i === 0 ? 'on' : ''}" data-emoji="${e}">${e}</button>`).join('')}</div>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn ghost" id="f-cancel">Cancel</button>
      <button class="btn" id="f-save">Add</button>
    </div>`);
  $$('#modal .emoji-opt').forEach(b => b.addEventListener('click', () => {
    $$('#modal .emoji-opt').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
  }));
  $('#f-cancel').addEventListener('click', closeModal);
  $('#f-save').addEventListener('click', async () => {
    try {
      const ann = $('#f-ann').value.trim();
      const cdTitle = $('#f-cd-title').value.trim();
      if (ann) await api.post('/api/announcements', { text: ann });
      if (cdTitle) {
        if (!$('#f-cd-date').value) { alert('Pick a date for the countdown'); return; }
        await api.post('/api/countdowns', {
          title: cdTitle, date: $('#f-cd-date').value,
          icon: $('#modal .emoji-opt.on')?.dataset.emoji || '🎉',
        });
      }
      closeModal(); render();
    } catch (e) { alert(e.message); }
  });
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
    const isGoogle = e.source === 'google';
    return `<div class="event-row">
      <span class="member-dot" style="background:${m ? m.color : 'var(--muted)'}"></span>
      <span class="event-time">${e.start_time ? esc(fmtTime(e.start_time)) : 'All day'}</span>
      <span class="event-title">${esc(e.title)}${m ? ` <span class="li-by">(${esc(m.name)})</span>` : ''}${isGoogle ? ' <span class="li-by">📆 Google</span>' : ''}</span>
      ${isGoogle ? '' : `<button class="btn ghost small" data-edit="${e.id}">Edit</button>
      <button class="li-del" data-del="${e.id}">🗑️</button>`}
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
  const [meals, recipes] = await Promise.all([
    api.get(`/api/meals?start=${ymd(start)}&end=${ymd(end)}`),
    api.get('/api/recipes'),
  ]);
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
      <div class="header-actions">
        <div class="view-sub">${MONTHS[start.getMonth()].slice(0, 3)} ${start.getDate()} – ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getDate()}</div>
        <button class="btn ghost" id="recipe-box">📖 Recipe Box</button>
      </div>
    </div>
    <div class="week-grid">${heads.join('')}${rows}</div>`;

  $('#recipe-box').addEventListener('click', () => recipeBox(recipes));

  $('#wk-prev').addEventListener('click', () => { state.mealsWeekStart = addDays(start, -7); renderMeals(); });
  $('#wk-next').addEventListener('click', () => { state.mealsWeekStart = addDays(start, 7); renderMeals(); });
  $('#wk-today').addEventListener('click', () => { state.mealsWeekStart = startOfWeek(new Date()); renderMeals(); });

  $$('.meal-cell').forEach(cell => cell.addEventListener('click', () => {
    const { date, type } = cell.dataset;
    const existing = find(date, type);
    const d = fromYmd(date);
    const linked = existing?.recipe_id ? recipes.find(r => r.id === existing.recipe_id) : null;
    openModal(`
      <h2>${type[0].toUpperCase() + type.slice(1)} · ${DOW[d.getDay()]} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}</h2>
      <div class="form-row"><label>What's cooking?</label>
        <input id="f-meal" list="recipe-list" value="${esc(existing?.title || '')}" placeholder="Spaghetti &amp; meatballs">
        <datalist id="recipe-list">${recipes.map(r => `<option value="${esc(r.title)}">`).join('')}</datalist>
        ${recipes.length ? '<div class="li-by" style="margin-top:6px">Start typing to pick from the recipe box — its ingredients can go straight to the grocery list.</div>' : ''}
      </div>
      <div id="f-save-recipe-row" class="form-row" style="display:none">
        <label><input type="checkbox" id="f-save-recipe" style="width:auto;min-height:0;margin-right:8px">Save as a recipe for next time</label>
        <textarea id="f-ingredients" rows="4" placeholder="Ingredients, one per line" style="display:none;margin-top:8px"></textarea>
      </div>
      ${linked ? `<button class="btn ghost small" id="f-to-grocery">🛒 Add "${esc(linked.title)}" ingredients to Groceries</button>` : ''}
      <div class="modal-actions">
        ${existing ? '<button class="btn danger" id="f-clear">Clear</button>' : ''}
        <span class="spacer"></span>
        <button class="btn ghost" id="f-cancel">Cancel</button>
        <button class="btn" id="f-save">Save</button>
      </div>`);
    $('#f-meal').focus();
    $('#f-cancel').addEventListener('click', closeModal);

    const matchRecipe = () => recipes.find(r => r.title.toLowerCase() === $('#f-meal').value.trim().toLowerCase());
    const updateSaveRow = () => {
      const title = $('#f-meal').value.trim();
      $('#f-save-recipe-row').style.display = (title && !matchRecipe()) ? '' : 'none';
    };
    $('#f-meal').addEventListener('input', updateSaveRow);
    updateSaveRow();
    $('#f-save-recipe').addEventListener('change', () => {
      $('#f-ingredients').style.display = $('#f-save-recipe').checked ? '' : 'none';
    });

    if (linked) $('#f-to-grocery').addEventListener('click', async () => {
      try {
        const r = await api.post(`/api/recipes/${linked.id}/to-grocery`, {});
        $('#f-to-grocery').textContent = `✓ Added ${r.added} item${r.added === 1 ? '' : 's'}${r.skipped ? ` (${r.skipped} already on the list)` : ''}`;
      } catch (e) { alert(e.message); }
    });

    const save = async (title) => {
      try {
        let recipeId = null;
        if (title.trim()) {
          const m = matchRecipe();
          if (m) recipeId = m.id;
          else if ($('#f-save-recipe').checked) {
            const ing = $('#f-ingredients').value.split('\n').map(s => s.trim()).filter(Boolean);
            const created = await api.post('/api/recipes', { title: title.trim(), ingredients: ing });
            recipeId = created.id;
          }
        }
        await api.put('/api/meals', { date, meal_type: type, title, recipe_id: recipeId });
        closeModal(); renderMeals();
      } catch (e) { alert(e.message); }
    };
    if (existing) $('#f-clear').addEventListener('click', () => save(''));
    $('#f-save').addEventListener('click', () => save($('#f-meal').value));
    $('#f-meal').addEventListener('keydown', e => { if (e.key === 'Enter') save($('#f-meal').value); });
  }));
}

// ---------- Recipe box ----------

function recipeBox(recipes) {
  const rows = recipes.length ? recipes.map(r => `
    <div class="list-item">
      <span class="li-text"><b>${esc(r.title)}</b>
        <span class="li-by">${(r.ingredients || []).length} ingredient${(r.ingredients || []).length === 1 ? '' : 's'}</span></span>
      <button class="btn ghost small" data-edit-recipe="${r.id}">Edit</button>
      <button class="li-del" data-del-recipe="${r.id}">🗑️</button>
    </div>`).join('') : '<div class="empty">No recipes yet — save one from any meal slot, or add one here.</div>';

  openModal(`
    <h2>📖 Recipe Box</h2>
    ${rows}
    <div class="modal-actions">
      <button class="btn ghost" id="m-close">Close</button>
      <button class="btn" id="m-add">+ New Recipe</button>
    </div>`);
  $('#m-close').addEventListener('click', closeModal);
  $('#m-add').addEventListener('click', () => recipeForm());
  $$('#modal [data-edit-recipe]').forEach(b => b.addEventListener('click', () =>
    recipeForm(recipes.find(r => r.id === Number(b.dataset.editRecipe)))));
  $$('#modal [data-del-recipe]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this recipe? Planned meals keep their titles.')) return;
    await api.del(`/api/recipes/${b.dataset.delRecipe}`);
    closeModal(); renderMeals();
  }));
}

function recipeForm(r = {}) {
  const isEdit = !!r.id;
  openModal(`
    <h2>${isEdit ? 'Edit' : 'New'} Recipe</h2>
    <div class="form-row"><label>Name</label><input id="f-title" value="${esc(r.title || '')}" placeholder="Taco night"></div>
    <div class="form-row"><label>Ingredients (one per line)</label>
      <textarea id="f-ingredients" rows="6">${esc((r.ingredients || []).join('\n'))}</textarea></div>
    <div class="form-row"><label>Notes (optional)</label><input id="f-notes" value="${esc(r.notes || '')}"></div>
    <div class="modal-actions">
      <button class="btn ghost" id="f-cancel">Cancel</button>
      <button class="btn" id="f-save">Save</button>
    </div>`);
  $('#f-cancel').addEventListener('click', closeModal);
  $('#f-save').addEventListener('click', async () => {
    const body = {
      title: $('#f-title').value,
      ingredients: $('#f-ingredients').value.split('\n').map(s => s.trim()).filter(Boolean),
      notes: $('#f-notes').value || null,
    };
    if (!body.title.trim()) { alert('Please enter a name'); return; }
    try {
      if (isEdit) await api.put(`/api/recipes/${r.id}`, body);
      else await api.post('/api/recipes', body);
      closeModal(); renderMeals();
    } catch (e) { alert(e.message); }
  });
}

// ---------- Chores ----------

async function renderChores() {
  const start = state.choresWeekStart;
  const end = addDays(start, 6);
  const [chores, comp, rewardData] = await Promise.all([
    api.get('/api/chores'),
    api.get(`/api/chores/completions?start=${ymd(start)}&end=${ymd(end)}`),
    api.get('/api/rewards'),
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
    ${blocks || '<div class="empty" style="font-size:18px">No chores yet — tap "+ Add Chore" to set up your chart.</div>'}
    ${renderRewardsSection(rewardData)}`;

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
  wireRewardsSection(rewardData);
}

// ---------- Rewards (star store) ----------

function renderRewardsSection(rd) {
  const balanceChips = state.members.map(m => {
    const b = rd.balances.find(x => x.member_id === m.id);
    return `<span class="member-chip" style="color:${m.color}">${esc(m.avatar)} ${esc(m.name)}
      <b>⭐ ${b ? b.available : 0}</b></span>`;
  }).join('');

  const cards = rd.rewards.length ? rd.rewards.map(r => `
    <div class="card reward-card">
      <div class="reward-icon">${esc(r.icon)}</div>
      <div class="reward-title">${esc(r.title)}</div>
      <div class="reward-cost">⭐ ${r.cost}</div>
      <div style="display:flex;gap:6px;justify-content:center">
        <button class="btn small" data-redeem="${r.id}">Redeem</button>
        <button class="btn ghost small" data-edit-reward="${r.id}">✏️</button>
      </div>
    </div>`).join('') : '<div class="empty">No rewards yet — add something to spend stars on!</div>';

  const recent = rd.recent.length ? `
    <div class="li-by" style="margin-top:10px">Recent: ${rd.recent.slice(0, 5).map(x => {
      const m = memberById(x.member_id);
      return `${m ? esc(m.avatar) : ''} ${esc(x.title)} (−${x.cost}⭐)`;
    }).join(' · ')}</div>` : '';

  return `
    <div class="view-header" style="margin-top:26px">
      <div>
        <div class="view-title" style="font-size:24px">🎁 Reward Store</div>
        <div class="view-sub">Stars earned from chores — spend them here (a parent approves by logging in)</div>
      </div>
      <button class="btn" id="add-reward">+ Add Reward</button>
    </div>
    <div class="member-filter" style="margin-bottom:14px">${balanceChips}</div>
    <div class="family-grid">${cards}</div>
    ${recent}`;
}

function wireRewardsSection(rd) {
  $('#add-reward')?.addEventListener('click', () => rewardForm());
  $$('[data-edit-reward]').forEach(b => b.addEventListener('click', () =>
    rewardForm(rd.rewards.find(r => r.id === Number(b.dataset.editReward)))));
  $$('[data-redeem]').forEach(b => b.addEventListener('click', () => {
    const reward = rd.rewards.find(r => r.id === Number(b.dataset.redeem));
    openModal(`
      <h2>${esc(reward.icon)} Redeem: ${esc(reward.title)}</h2>
      <div class="form-row"><label>Who's spending ⭐ ${reward.cost}?</label>
        <div class="member-filter">${state.members.map(m => {
          const bal = rd.balances.find(x => x.member_id === m.id);
          const avail = bal ? bal.available : 0;
          return `<button class="member-chip" data-who="${m.id}" ${avail < reward.cost ? 'disabled style="opacity:.45"' : `style="color:${m.color}"`}>
            ${esc(m.avatar)} ${esc(m.name)} (⭐ ${avail})</button>`;
        }).join('')}</div></div>
      <div class="modal-actions"><button class="btn ghost" id="f-cancel">Cancel</button></div>`);
    $('#f-cancel').addEventListener('click', closeModal);
    $$('#modal [data-who]:not([disabled])').forEach(chip => chip.addEventListener('click', async () => {
      try {
        await api.post(`/api/rewards/${reward.id}/redeem`, { member_id: Number(chip.dataset.who) });
        closeModal(); renderChores();
      } catch (e) { alert(e.message); }
    }));
  }));
}

function rewardForm(r = {}) {
  const isEdit = !!r.id;
  const ICONS = ['🎁', '🍦', '📱', '🎬', '🧸', '🎮', '🍕', '💵', '🌙', '🎨'];
  openModal(`
    <h2>${isEdit ? 'Edit' : 'New'} Reward</h2>
    <div class="form-row"><label>Reward</label><input id="f-title" value="${esc(r.title || '')}" placeholder="Ice cream trip"></div>
    <div class="form-row"><label>Icon</label>
      <div class="emoji-picker">${ICONS.map(i =>
        `<button class="emoji-opt ${(r.icon || '🎁') === i ? 'on' : ''}" data-emoji="${i}">${i}</button>`).join('')}</div></div>
    <div class="form-row"><label>Cost (stars)</label><input id="f-cost" type="number" min="1" value="${r.cost || 10}"></div>
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
  $('#f-cancel').addEventListener('click', closeModal);
  if (isEdit) $('#f-delete').addEventListener('click', async () => {
    if (!confirm('Delete this reward? Past redemptions keep their history.')) return;
    await api.del(`/api/rewards/${r.id}`);
    closeModal(); renderChores();
  });
  $('#f-save').addEventListener('click', async () => {
    const body = {
      title: $('#f-title').value,
      icon: $('#modal .emoji-opt.on')?.dataset.emoji || '🎁',
      cost: Number($('#f-cost').value) || 10,
    };
    if (!body.title.trim()) { alert('Please enter a reward name'); return; }
    try {
      if (isEdit) await api.put(`/api/rewards/${r.id}`, body);
      else await api.post('/api/rewards', body);
      closeModal(); renderChores();
    } catch (e) { alert(e.message); }
  });
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

// ---------- Routines ----------

async function renderRoutines() {
  const routines = await api.get(`/api/routines?date=${todayStr()}`);
  const weekday = new Date().getDay();

  const cards = routines.map(r => {
    const m = r.member_id ? memberById(r.member_id) : null;
    const todayApplies = r.days.includes(weekday);
    const doneCount = r.items.filter(i => i.done).length;
    return `<div class="card">
      <h3>${esc(r.icon)} ${esc(r.title)}${m ? ` · ${esc(m.avatar)} ${esc(m.name)}` : ''}
        <span style="margin-left:auto;display:flex;gap:8px;align-items:center">
          ${todayApplies ? `<span class="li-by">${doneCount}/${r.items.length} today</span>` : '<span class="li-by">not today</span>'}
          <button class="li-del" data-edit-routine="${r.id}">✏️</button>
        </span></h3>
      <div class="li-by" style="margin-bottom:8px">
        ${r.start_time ? `${fmtTime(r.start_time)}${r.end_time ? ' – ' + fmtTime(r.end_time) : ''}` : 'Any time'}
        · ${r.days.length === 7 ? 'Every day' : r.days.map(d => DOW[d]).join(', ')}</div>
      ${r.items.map(i => `
        <div class="chore-line ${i.done ? 'done' : ''}">
          <button class="chore-check ${i.done ? 'done' : ''}" data-ritem="${i.id}" ${todayApplies ? '' : 'disabled'}>${i.done ? '✓' : ''}</button>
          <span>${esc(i.icon)}</span><span class="chore-title">${esc(i.text)}</span>
        </div>`).join('') || '<div class="empty">No steps yet</div>'}
    </div>`;
  }).join('');

  $('#main').innerHTML = `
    <div class="view-header">
      <div>
        <div class="view-title">Routines</div>
        <div class="view-sub">Morning and bedtime checklists — they pop up on the Today screen during their window</div>
      </div>
      <button class="btn" id="add-routine">+ Add Routine</button>
    </div>
    <div class="lists-grid">${cards || '<div class="empty" style="font-size:18px">No routines yet — try a Morning Routine: brush teeth, get dressed, pack backpack.</div>'}</div>`;

  $('#add-routine').addEventListener('click', () => routineForm());
  $$('[data-edit-routine]').forEach(b => b.addEventListener('click', () =>
    routineForm(routines.find(r => r.id === Number(b.dataset.editRoutine)))));
  $$('[data-ritem]:not([disabled])').forEach(btn => btn.addEventListener('click', async () => {
    await api.post(`/api/routine-items/${btn.dataset.ritem}/toggle`, { date: todayStr() });
    renderRoutines();
  }));
}

function routineForm(r = {}) {
  const isEdit = !!r.id;
  const days = r.days || [1, 2, 3, 4, 5];
  const ICONS = ['🌅', '🌙', '🎒', '🛁', '📚', '🏠'];
  openModal(`
    <h2>${isEdit ? 'Edit' : 'New'} Routine</h2>
    <div class="form-row"><label>Name</label><input id="f-title" value="${esc(r.title || '')}" placeholder="Morning routine"></div>
    <div class="form-row"><label>Icon</label>
      <div class="emoji-picker">${ICONS.map(i =>
        `<button class="emoji-opt ${(r.icon || '🌅') === i ? 'on' : ''}" data-emoji="${i}">${i}</button>`).join('')}</div></div>
    <div class="form-row"><label>Who</label><select id="f-member">${memberSelectOptions(r.member_id)}</select></div>
    <div class="form-cols">
      <div class="form-row"><label>Shows from</label><input id="f-start" type="time" value="${r.start_time || ''}"></div>
      <div class="form-row"><label>Until</label><input id="f-end" type="time" value="${r.end_time || ''}"></div>
    </div>
    <div class="form-row"><label>Days</label>
      <div class="day-picker">${DOW.map((d, i) =>
        `<button class="day-pick ${days.includes(i) ? 'on' : ''}" data-day="${i}">${d[0]}</button>`).join('')}</div></div>
    <div class="form-row"><label>Steps (one per line)</label>
      <textarea id="f-items" rows="6" placeholder="Brush teeth\nGet dressed\nPack backpack">${esc((r.items || []).map(i => i.text).join('\n'))}</textarea></div>
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
    if (!confirm('Delete this routine and its history?')) return;
    await api.del(`/api/routines/${r.id}`);
    closeModal(); renderRoutines();
  });
  $('#f-save').addEventListener('click', async () => {
    const body = {
      title: $('#f-title').value,
      icon: $('#modal .emoji-opt.on')?.dataset.emoji || '🌅',
      member_id: $('#f-member').value ? Number($('#f-member').value) : null,
      start_time: $('#f-start').value || null,
      end_time: $('#f-end').value || null,
      days: $$('#modal .day-pick.on').map(b => Number(b.dataset.day)),
      items: $('#f-items').value.split('\n').map(s => s.trim()).filter(Boolean).map(text => ({ text })),
    };
    if (!body.title.trim()) { alert('Please enter a name'); return; }
    if (!body.days.length) { alert('Pick at least one day'); return; }
    try {
      if (isEdit) await api.put(`/api/routines/${r.id}`, body);
      else await api.post('/api/routines', body);
      closeModal(); renderRoutines();
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
  let calendars = [];
  try { calendars = await api.get('/api/member-calendars'); } catch { /* not logged in */ }
  const calFor = (mid) => calendars.find(c => c.member_id === mid);

  const familyCal = calFor(null);
  const cards = state.members.map(m => `
    <div class="card member-card" data-member="${m.id}">
      <div class="avatar">${esc(m.avatar)}</div>
      <div class="name">${esc(m.name)}</div>
      <div class="swatch" style="background:${m.color}"></div>
      ${calFor(m.id) ? `<div class="li-by" style="margin-bottom:8px">📆 Google Calendar linked${calFor(m.id).last_error ? ' ⚠️' : ''}</div>` : ''}
      <button class="btn ghost small">Edit</button>
    </div>`).join('');

  $('#main').innerHTML = `
    <div class="view-header">
      <div>
        <div class="view-title">Family</div>
        <div class="view-sub">Everyone gets a color for calendars and chores</div>
      </div>
      <div class="header-actions">
        <button class="btn ghost" id="photo-mgr">🖼️ Photos</button>
        <button class="btn ghost" id="family-cal">📆 Family Google Calendar${familyCal ? ' ✓' : ''}</button>
      </div>
    </div>
    <div class="family-grid">
      ${cards}
      <button class="card member-card-add" id="add-member">+ Add family member</button>
    </div>`;

  $('#add-member').addEventListener('click', () => memberForm());
  $('#photo-mgr').addEventListener('click', photoManager);
  $('#family-cal').addEventListener('click', () => calendarForm(null, familyCal));
  $$('[data-member]').forEach(card => card.addEventListener('click', () => {
    memberForm(state.members.find(m => m.id === Number(card.dataset.member)), calFor(Number(card.dataset.member)));
  }));
}

const GCAL_HELP = 'In Google Calendar: Settings → your calendar → "Integrate calendar" → copy the <b>Secret address in iCal format</b>. Events sync automatically every 10 minutes.';

async function saveCalendarUrl(memberId, url, previous) {
  const oldUrl = previous?.url || '';
  if (url.trim() === oldUrl.trim()) return;
  await api.put('/api/member-calendars', { member_id: memberId, url: url.trim() });
  api.post('/api/gcal-sync', {}).catch(() => {});
}

// Standalone editor for the whole-family calendar (member_id null).
function calendarForm(memberId, existing) {
  openModal(`
    <h2>📆 Family Google Calendar</h2>
    <div class="form-row"><label>Secret iCal address</label>
      <input id="f-gcal" value="${esc(existing?.url || '')}" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"></div>
    <div class="view-sub" style="margin-bottom:10px">${GCAL_HELP}</div>
    ${existing?.last_error ? `<div class="empty" style="color:#c85454">Last sync failed: ${esc(existing.last_error)}</div>` : ''}
    <div class="modal-actions">
      <button class="btn ghost" id="f-cancel">Cancel</button>
      <button class="btn" id="f-save">Save</button>
    </div>`);
  $('#f-cancel').addEventListener('click', closeModal);
  $('#f-save').addEventListener('click', async () => {
    try {
      await saveCalendarUrl(memberId, $('#f-gcal').value, existing);
      closeModal(); render();
    } catch (e) { alert(e.message); }
  });
}

function memberForm(m = {}, cal = null) {
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
    ${isEdit ? `
    <div class="form-row"><label>📆 Google Calendar (secret iCal address)</label>
      <input id="f-gcal" value="${esc(cal?.url || '')}" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics">
      <div class="li-by" style="margin-top:6px">${GCAL_HELP}</div>
      ${cal?.last_error ? `<div class="li-by" style="color:#c85454;margin-top:4px">Last sync failed: ${esc(cal.last_error)}</div>` : ''}
    </div>` : ''}
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
      if (isEdit) {
        await api.put(`/api/members/${m.id}`, body);
        await saveCalendarUrl(m.id, $('#f-gcal')?.value ?? '', cal);
      } else {
        await api.post('/api/members', body);
      }
      closeModal(); render();
    } catch (e) { alert(e.message); }
  });
}

// ---------- photos & screensaver ----------

async function photoManager() {
  let photos = [];
  try { photos = await api.get('/api/photos'); } catch { /* ignore */ }
  openModal(`
    <h2>🖼️ Screensaver Photos</h2>
    <p class="view-sub" style="margin-bottom:12px">The tablet shows these full-screen after ${SCREENSAVER_IDLE_MIN} minutes idle. Tap anywhere to wake it.</p>
    <div class="photo-grid">
      ${photos.map(p => `<div class="photo-thumb"><img src="${p.url}" loading="lazy">
        <button class="li-del" data-del-photo="${esc(p.name)}">✕</button></div>`).join('')
      || '<div class="empty">No photos yet</div>'}
    </div>
    <div class="modal-actions">
      <input type="file" id="f-photo" accept="image/*" multiple style="display:none">
      <button class="btn ghost" id="m-close">Close</button>
      <button class="btn" id="m-upload">+ Upload Photos</button>
    </div>`);
  $('#m-close').addEventListener('click', closeModal);
  $('#m-upload').addEventListener('click', () => $('#f-photo').click());
  $('#f-photo').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    try {
      for (let i = 0; i < files.length; i++) {
        $('#m-upload').textContent = `Uploading ${i + 1}/${files.length}…`;
        const photo = await preparePhoto(files[i]);
        await api.post('/api/photos', photo);
      }
      photoCache = null;
      photoManager();
    } catch (err) { alert(err.message); $('#m-upload').textContent = '+ Upload Photos'; }
  });
  $$('#modal [data-del-photo]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Remove this photo?')) return;
    await api.del(`/api/photos/${encodeURIComponent(b.dataset.delPhoto)}`);
    photoCache = null;
    photoManager();
  }));
}

// Downscale on the client so multi-photo uploads from phones stay fast and
// under the API's size limit; falls back to the raw file if decoding fails.
async function preparePhoto(file) {
  const raw = () => new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => resolve({ name: file.name, data: rd.result.split(',')[1], content_type: file.type });
    rd.onerror = reject;
    rd.readAsDataURL(file);
  });
  try {
    const bmp = await createImageBitmap(file);
    const MAX = 1600;
    const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return {
      name: file.name.replace(/\.[^.]+$/, '') + '.jpg',
      data: dataUrl.split(',')[1],
      content_type: 'image/jpeg',
    };
  } catch { return raw(); }
}

const SCREENSAVER_IDLE_MIN = 3;
const SLIDE_SECONDS = 9;
let photoCache = null;
let idleSince = Date.now();
let ssOrder = [];
let ssIndex = 0;
let ssCycleTimer = null;

['click', 'touchstart', 'keydown'].forEach(evt =>
  document.addEventListener(evt, () => {
    idleSince = Date.now();
    if (!$('#screensaver').classList.contains('hidden')) hideScreensaver();
  }, { capture: true, passive: true }));

async function maybeScreensaver() {
  if (Date.now() - idleSince < SCREENSAVER_IDLE_MIN * 60 * 1000) return;
  if (!$('#screensaver').classList.contains('hidden')) return;
  if (!$('#modal-backdrop').classList.contains('hidden')) return;
  if (photoCache === null) {
    try { photoCache = await api.get('/api/photos'); } catch { photoCache = []; }
  }
  if (!photoCache.length) return;

  // Shuffled slideshow with two stacked layers crossfading between slides.
  ssOrder = photoCache.map((_, i) => i).sort(() => Math.random() - 0.5);
  ssIndex = -1;
  $('#screensaver').innerHTML = `
    <img class="ss-img" id="ss-a"><img class="ss-img" id="ss-b">
    <div class="ss-clock" id="ss-clock"></div>`;
  $('#screensaver').classList.remove('hidden');
  advanceSlide();
  ssCycleTimer = setInterval(advanceSlide, SLIDE_SECONDS * 1000);
}

let ssFront = 'a';

function advanceSlide() {
  ssIndex = (ssIndex + 1) % ssOrder.length;
  if (ssIndex === 0 && ssOrder.length > 2) ssOrder.sort(() => Math.random() - 0.5);
  const url = photoCache[ssOrder[ssIndex]].url;

  const back = $(ssFront === 'a' ? '#ss-b' : '#ss-a');
  const front = $(ssFront === 'a' ? '#ss-a' : '#ss-b');
  const img = new Image();
  img.onload = () => {
    back.src = url;
    back.classList.add('showing');   // fades in over the old slide
    front.classList.remove('showing');
    ssFront = ssFront === 'a' ? 'b' : 'a';
  };
  img.src = url;

  const now = new Date();
  let h = now.getHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  $('#ss-clock').textContent = `${h}:${String(now.getMinutes()).padStart(2, '0')} ${ap}`;
}

function hideScreensaver() {
  $('#screensaver').classList.add('hidden');
  clearInterval(ssCycleTimer);
  render().catch(() => {});
}

setInterval(maybeScreensaver, 20000);

// ---------- wake lock ----------
// Ask the OS to keep the screen on while the planner is in the foreground
// (belt-and-suspenders alongside Fire OS's "Stay awake" developer setting).

let wakeLock = null;
async function keepAwake() {
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { /* not granted — the OS setting still covers the tablet */ }
}
document.addEventListener('visibilitychange', keepAwake);
keepAwake();

// ---------- boot ----------

render().catch(err => {
  $('#main').innerHTML = `<div class="empty">Could not reach the server: ${esc(err.message)}</div>`;
});

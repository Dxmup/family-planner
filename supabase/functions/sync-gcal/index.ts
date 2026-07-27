// Syncs each family member's secret Google Calendar iCal feed into the
// gcal_events cache table. Runs every 10 minutes via pg_cron (see the
// google_calendar_sync migration) and on demand from the app after a
// calendar URL is added.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { RRule } from 'https://esm.sh/rrule@2.8.1';

const APP_TZ = 'America/New_York';
const WINDOW_PAST_DAYS = 60;
const WINDOW_FUTURE_DAYS = 400;
const MAX_SPAN_DAYS = 14; // cap for multi-day all-day events

// ---------- timezone helpers ----------
// Occurrences are handled as "floating" Dates: UTC fields hold the wall-clock
// time in APP_TZ, so formatting uses getUTC* and never the runtime timezone.

const tzCache = new Map<string, Intl.DateTimeFormat>();
function tzFormatter(tz: string) {
  let f = tzCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    tzCache.set(tz, f);
  }
  return f;
}

function epochToFloating(epochMs: number, tz: string): Date {
  const parts = Object.fromEntries(
    tzFormatter(tz).formatToParts(new Date(epochMs)).map(p => [p.type, p.value]));
  return new Date(Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour === '24' ? '0' : parts.hour), Number(parts.minute)));
}

// Wall-clock time in `tz` -> real epoch ms (two-pass offset correction).
function zonedToEpoch(y: number, mo: number, d: number, hh: number, mm: number, tz: string): number {
  let guess = Date.UTC(y, mo - 1, d, hh, mm);
  for (let i = 0; i < 2; i++) {
    const wall = epochToFloating(guess, tz).getTime();
    guess += Date.UTC(y, mo - 1, d, hh, mm) - wall;
  }
  return guess;
}

// ---------- ICS parsing ----------

interface IcsDate { floating: Date; allDay: boolean }

function parseIcsDate(value: string, tzid: string | null): IcsDate | null {
  let m = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) {
    return { floating: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])), allDay: true };
  }
  m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!m) return null;
  const [y, mo, d, hh, mm] = [+m[1], +m[2], +m[3], +m[4], +m[5]];
  if (m[7] === 'Z') {
    return { floating: epochToFloating(Date.UTC(y, mo - 1, d, hh, mm), APP_TZ), allDay: false };
  }
  if (tzid && tzid !== APP_TZ) {
    return { floating: epochToFloating(zonedToEpoch(y, mo, d, hh, mm, tzid), APP_TZ), allDay: false };
  }
  // Floating or already in the app timezone: take the wall time as-is.
  return { floating: new Date(Date.UTC(y, mo - 1, d, hh, mm)), allDay: false };
}

interface VEvent {
  uid: string; summary: string; location: string | null; cancelled: boolean;
  dtstart: IcsDate | null; dtend: IcsDate | null;
  rrule: string | null; exdates: Date[]; recurrenceId: IcsDate | null;
}

function parseICS(text: string): VEvent[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events: VEvent[] = [];
  let cur: VEvent | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      cur = { uid: '', summary: '', location: null, cancelled: false,
              dtstart: null, dtend: null, rrule: null, exdates: [], recurrenceId: null };
      continue;
    }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const left = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const [name, ...paramParts] = left.split(';');
    const params: Record<string, string> = {};
    for (const p of paramParts) {
      const eq = p.indexOf('=');
      if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
    }
    const tzid = params['TZID'] || null;
    switch (name.toUpperCase()) {
      case 'UID': cur.uid = value; break;
      case 'SUMMARY': cur.summary = value.replace(/\\([,;nN\\])/g, (_, c) => (c === 'n' || c === 'N') ? ' ' : c); break;
      case 'LOCATION': cur.location = value.replace(/\\([,;nN\\])/g, (_, c) => (c === 'n' || c === 'N') ? ' ' : c) || null; break;
      case 'STATUS': cur.cancelled = value.toUpperCase() === 'CANCELLED'; break;
      case 'DTSTART': cur.dtstart = parseIcsDate(value, tzid); break;
      case 'DTEND': cur.dtend = parseIcsDate(value, tzid); break;
      case 'RRULE': cur.rrule = value; break;
      case 'RECURRENCE-ID': cur.recurrenceId = parseIcsDate(value, tzid); break;
      case 'EXDATE':
        for (const v of value.split(',')) {
          const d = parseIcsDate(v.trim(), tzid);
          if (d) cur.exdates.push(d.floating);
        }
        break;
    }
  }
  return events;
}

// ---------- expansion ----------

interface Row {
  member_id: number | null; uid: string; title: string; date: string;
  start_time: string | null; end_time: string | null;
  location: string | null; all_day: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const hm = (d: Date) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;

function makeRow(memberId: number | null, ev: VEvent, start: Date, durMs: number, allDay: boolean): Row {
  const end = durMs > 0 ? new Date(start.getTime() + durMs) : null;
  return {
    member_id: memberId,
    uid: ev.uid,
    title: ev.summary || '(untitled)',
    date: ymd(start),
    start_time: allDay ? null : hm(start),
    end_time: (!allDay && end && ymd(end) === ymd(start)) ? hm(end) : null,
    location: ev.location,
    all_day: allDay,
  };
}

function expandCalendar(memberId: number | null, events: VEvent[], winStart: Date, winEnd: Date): Row[] {
  const rows: Row[] = [];
  // Recurrence overrides: uid -> set of overridden original start times.
  const overridden = new Map<string, Set<number>>();
  for (const ev of events) {
    if (ev.recurrenceId) {
      if (!overridden.has(ev.uid)) overridden.set(ev.uid, new Set());
      overridden.get(ev.uid)!.add(ev.recurrenceId.floating.getTime());
    }
  }

  for (const ev of events) {
    if (!ev.dtstart) continue;
    const allDay = ev.dtstart.allDay;
    const durMs = (ev.dtend && !allDay) ? ev.dtend.floating.getTime() - ev.dtstart.floating.getTime() : 0;

    if (ev.recurrenceId) {
      // A modified single occurrence of a recurring event.
      if (ev.cancelled) continue;
      const s = ev.dtstart.floating;
      if (s >= winStart && s <= winEnd) rows.push(makeRow(memberId, ev, s, durMs, allDay));
      continue;
    }
    if (ev.cancelled) continue;

    if (ev.rrule) {
      let occs: Date[] = [];
      try {
        const opts = RRule.parseString(ev.rrule);
        opts.dtstart = ev.dtstart.floating;
        occs = new RRule(opts).between(winStart, winEnd, true);
      } catch (_) { continue; }
      const skip = overridden.get(ev.uid) || new Set();
      const ex = new Set(ev.exdates.map(d => d.getTime()));
      for (const o of occs.slice(0, 1000)) {
        if (skip.has(o.getTime()) || ex.has(o.getTime())) continue;
        rows.push(makeRow(memberId, ev, o, durMs, allDay));
      }
      continue;
    }

    // Plain event. Multi-day all-day events get one row per day.
    const s = ev.dtstart.floating;
    if (allDay && ev.dtend) {
      const spanDays = Math.min(
        Math.round((ev.dtend.floating.getTime() - s.getTime()) / 86400000), MAX_SPAN_DAYS);
      for (let i = 0; i < Math.max(spanDays, 1); i++) {
        const day = new Date(s.getTime() + i * 86400000);
        if (day >= winStart && day <= winEnd) rows.push(makeRow(memberId, ev, day, 0, true));
      }
    } else if (s >= winStart && s <= winEnd) {
      rows.push(makeRow(memberId, ev, s, durMs, allDay));
    }
  }
  return rows;
}

// ---------- sync ----------

Deno.serve(async (_req: Request) => {
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: calendars, error } = await sb.from('member_calendars').select('*');
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const now = Date.now();
  const winStart = new Date(now - WINDOW_PAST_DAYS * 86400000);
  const winEnd = new Date(now + WINDOW_FUTURE_DAYS * 86400000);
  const results: Record<string, unknown>[] = [];

  for (const cal of calendars || []) {
    const label = cal.member_id === null ? 'family' : `member ${cal.member_id}`;
    try {
      const url = cal.url.replace(/^webcal:\/\//i, 'https://');
      const res = await fetch(url, { headers: { 'User-Agent': 'family-planner-sync' } });
      if (!res.ok) throw new Error(`feed returned HTTP ${res.status}`);
      const rows = expandCalendar(cal.member_id, parseICS(await res.text()), winStart, winEnd);

      await sb.from('gcal_events').delete()
        .filter('member_id', cal.member_id === null ? 'is' : 'eq', cal.member_id);
      for (let i = 0; i < rows.length; i += 500) {
        const { error: insErr } = await sb.from('gcal_events').insert(rows.slice(i, i + 500));
        if (insErr) throw new Error(insErr.message);
      }
      await sb.from('member_calendars')
        .update({ last_synced_at: new Date().toISOString(), last_error: null }).eq('id', cal.id);
      results.push({ calendar: label, events: rows.length });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await sb.from('member_calendars').update({ last_error: msg }).eq('id', cal.id);
      results.push({ calendar: label, error: msg });
    }
  }

  return new Response(JSON.stringify({ synced: results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

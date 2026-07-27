# Family Planner

A family hub — like a Skylight calendar you own. Hosted on **Vercel** with data in
**Supabase**, so it works from anywhere: display it full-screen on a tablet such as
an Amazon Fire 10, while parents add and edit from their phones.

## Features

- **Today dashboard** — clock, today's schedule, meals, chores, and grocery list at a glance (this is the view you leave up on the tablet)
- **Family calendar** — month view with color-coding per person, filter by family member, all-day and timed events, daily/weekly/monthly repeating events
- **Meal planning** — weekly breakfast/lunch/dinner/snack grid; tap any slot to fill it in
- **Chore charts** — per-person weekly charts with star points, tap-to-complete, and weekly star totals
- **Lists** — shared grocery and to-do lists with check-off and "clear done"
- **Family profiles** — each member gets a name, emoji avatar, and color used across the app
- **Parental login** — anyone with the link can view (the tablet never logs in), but adding or changing anything requires a parent account
- **Google Calendar sync** — link each member's (and the family's) Google Calendar via its secret iCal address; events appear color-coded and re-sync automatically every 10 minutes

Everything updates automatically: the tablet refreshes every 30 seconds, so items
added from a phone show up without touching the display.

## How auth works

Viewing is open. All writes go through Supabase row-level security: only accounts
whose email is in the `parents` table can change data. Tap the **🔒 Parent** button
(bottom of the sidebar) to log in — or just try to add something and the login
prompt appears. Sessions refresh silently, so you rarely re-enter the password.

To add another parent, insert their email into `public.parents` and create an auth
user for them in the Supabase dashboard (Authentication → Users → Add user).

## Google Calendar sync

Each family member (plus a whole-family slot) can be linked to a Google Calendar:

1. In Google Calendar (on the web), open **Settings → [the calendar] → Integrate calendar** and copy the **Secret address in iCal format**.
2. In the planner, log in as a parent, open the **Family** tab, tap the member (or the
   *Family Google Calendar* button) and paste the address.

The `sync-gcal` Supabase edge function fetches every linked feed, expands recurring
events, and caches them in `gcal_events`; pg_cron re-runs it every 10 minutes, and the
app triggers an immediate sync when a URL is saved. Google events are read-only in the
planner — edit them in Google Calendar and they update on the next sync. The secret
URLs are protected by RLS (parents + the service role only).

## Local development

Requires [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm start
```

This runs the same API (`api/index.js`) plus static files at `http://localhost:3000`,
talking to the live Supabase database. Set `SUPABASE_URL` / `SUPABASE_ANON_KEY` to
point elsewhere.

## Deployment

Vercel serves `public/` statically and runs `api/index.js` as a serverless function
(`vercel.json` rewrites `/api/*` to it). Deploy with `vercel --prod` or push to the
connected Git repo. The Supabase anon key is publishable by design; all protection
lives in row-level security.

## Setting up the Fire 10 tablet

1. Open the **Silk browser** on the tablet and go to the Vercel URL.
2. Add it to the home screen (menu → *Add to Home Screen*) so it launches like an app.
3. In Fire tablet **Settings → Display**, set the screen timeout to the longest value
   (or install a kiosk app such as *Fully Kiosk Browser* from the Amazon Appstore for
   a true always-on display).
4. Leave the **Today** tab up — it's designed as the wall display. It never needs to log in.

## First-run setup

1. Tap **🔒 Parent** and log in.
2. Go to the **Family** tab and add each family member with a color and avatar.
3. Add recurring events (practices, lessons) on the **Calendar** tab using the *Repeats* option.
4. Build the chore chart on the **Chores** tab — assign chores to people and days of the week.
5. Fill in the week on the **Meals** tab.

## API

All data is exposed over a simple JSON API (`/api/members`, `/api/events`,
`/api/meals`, `/api/chores`, `/api/lists`, `/api/dashboard`). Reads are public;
writes need a `Authorization: Bearer <token>` from `/api/auth/login`.

## Tech

Vanilla JS frontend with no build step; Express app running as a single Vercel
serverless function; Supabase (Postgres + Auth) with row-level security enforcing
the parent-only write rule at the database layer.

# Family Planner

A self-hosted family hub — like a Skylight calendar you own. Designed to run on a
home server (a spare laptop, Raspberry Pi, or NAS) and be displayed full-screen on a
tablet such as an Amazon Fire 10, while everyone in the family adds and edits from
their own phone or computer on the same Wi-Fi.

## Features

- **Today dashboard** — clock, today's schedule, meals, chores, and grocery list at a glance (this is the view you leave up on the tablet)
- **Family calendar** — month view with color-coding per person, filter by family member, all-day and timed events, daily/weekly/monthly repeating events
- **Meal planning** — weekly breakfast/lunch/dinner/snack grid; tap any slot to fill it in
- **Chore charts** — per-person weekly charts with star points, tap-to-complete, and weekly star totals
- **Lists** — shared grocery and to-do lists with check-off and "clear done"
- **Family profiles** — each member gets a name, emoji avatar, and color used across the app

Everything updates automatically: the tablet refreshes every 30 seconds, so items
added from a phone show up without touching the display.

## Quick start

Requires [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm start
```

Then open `http://<server-ip>:3000` from any device on your network.
Data is stored in a single SQLite file at `data/family-planner.db` — back that file
up and you've backed up everything.

Set `PORT` to change the port, `DB_PATH` to move the database file.

## Setting up the Fire 10 tablet

1. Open the **Silk browser** on the tablet and go to `http://<server-ip>:3000`.
2. Add it to the home screen (menu → *Add to Home Screen*) so it launches like an app.
3. In Fire tablet **Settings → Display**, set the screen timeout to the longest value
   (or install a kiosk app such as *Fully Kiosk Browser* from the Amazon Appstore for
   a true always-on display).
4. Leave the **Today** tab up — it's designed as the wall display.

## First-run setup

1. Go to the **Family** tab and add each family member with a color and avatar.
2. Add recurring events (practices, lessons) on the **Calendar** tab using the *Repeats* option.
3. Build the chore chart on the **Chores** tab — assign chores to people and days of the week.
4. Fill in the week on the **Meals** tab.

## API

All data is exposed over a simple JSON API (`/api/members`, `/api/events`,
`/api/meals`, `/api/chores`, `/api/lists`, `/api/dashboard`), so you can script
imports or hook it up to home automation if you like.

## Tech

Node.js + Express + SQLite (better-sqlite3) backend, dependency-free vanilla JS
frontend with no build step. Runs entirely on your LAN — no accounts, no cloud,
no subscription.

# Hensel Family Adventure Atlas

A family travel atlas — 23 drivable-from-Greenville destinations with attractions,
playbooks, a trip budget engine, evergreen event-calendar links, and a per-trip
event board. Now with **on-demand live events**: pick your trip dates and pull real
events for each stop, researched live, no copy-paste.

## How it's built

- **`index.html`** — the whole front end (all CSS/JS inline, no build step). It works
  as a plain static page in any browser, even offline. The live-events feature is an
  enhancement layered on top; if the API is unreachable it falls back to the old
  "Copy events request" workaround, so the atlas is never broken by a backend outage.
- **`api/events.js`** — one Vercel serverless function. Given `?city=&start=&end=`,
  it web-searches official calendars via the Anthropic API and returns family-event
  JSON (tuned for two girls, ages 5 & 9). CORS doesn't apply server-side, so it can
  research freely.
- **`package.json`** — declares the `@anthropic-ai/sdk` dependency; Vercel installs it
  automatically on deploy. No build/framework config needed (zero-config: static root
  + `/api` functions).

## Deploy (Vercel)

1. Push this repo to GitHub.
2. Import it into Vercel (Add New → Project → this repo). Framework preset: **Other**.
3. Add an environment variable **`ANTHROPIC_API_KEY`** (Project → Settings → Environment
   Variables). Optional: `ANTHROPIC_MODEL` to override the default (`claude-opus-4-8`).
4. Deploy. Every push produces a **preview deploy**; the production branch publishes live.

## Using live events

In the Trip Builder: add stops, set a **Trip start** date (this stamps each stop with
its exact dates), then hit **⚡ Load live events** on a stop. Results render inline with
links to official sources. **↻ Refresh** re-runs the search. Cost is a few cents per
lookup at most.

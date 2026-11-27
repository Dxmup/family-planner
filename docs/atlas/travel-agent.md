# Travel agent (Find hotels & flights)

A parent-only button on the Plan page (How step). One press makes Claude search the live web for hotel options at each stop and for round-trip flights, and shows the results as cards under the button. Results are suggestions: nothing is booked, and nothing changes the trip unless a parent presses **Use this rate** or **Use this fare**.

## What the button does

- Needs a trip start date (otherwise it says so and offers a jump to the When step) and at least one stop.
- Sends one `hotels` request per stop that has at least one night (check-in and check-out come from the start date and the nights per stop) and one `flights` request (the How step's "Depart from" airport to the farthest stop, from the trip start to start plus total nights). The page runs them concurrently, at most 3 at a time, and shows per-request progress.
- **Use this rate** sets that city's nightly hotel rate for this draft's estimate. Rates are stored beside the draft in `localStorage` key `atlas_draft_rates` (`{ city: { rate, name, source, url } }`); the documented `atlas_draft` shape is unchanged. The page passes them to `Atlas.tripCost(stops, { hotelRates })`. The How and Cost & save steps list the rates in use, each with a Clear button. A saved trip stores only its total (`est_cost`), not the per-city rates.
- **Use this fare** fills the airfare field (whole party), sets the departure airport to the fare's origin (GSP, ATL or CLT), and switches the comparison to Fly.
- Results are kept in memory and in `sessionStorage` (`atlas_agent_cache`, keyed by the exact request), so stepping around, pressing the button again or reloading the tab does not spend again. **Search again** re-runs everything on purpose; **Try again** re-runs one failed request.
- Failure states (plain wording, retry offered where it can help): not set up yet (503), parents only (403), signed out (401), timed out / busy / upstream error (retry), no results (notes plus a search-again button).

## Stops that are not in the Atlas

A trip can include any city (typed into "Add any city" on the Plan page). The agent treats those like any other stop: `city` is the display name, such as `"Montreal, Quebec"` or `"Paris, France"`, and the server's plain-name check (letters including accents, spaces, `.`, `'`, `,`, `-`, at most 60 characters, no markup, digits or newlines) accepts them. The flights request goes to the farthest stop that has coordinates (any stop if none do). A custom stop has no airport code in the Atlas, so "Look up fares" asks for the airfare by hand, but the agent's flight search works out the airports itself.

Award-flight (points) options are a separate feature: see `docs/atlas/points-options.md`.

## Endpoint

`POST /api/atlas/agent` (`api/atlas/agent.mjs`, a Vercel function, `maxDuration: 60`). It does not run under the local `node server.js`.

```
{ "task": "hotels",  "city": "Nashville", "checkin": "2027-03-07", "checkout": "2027-03-10", "adults": 2, "kids": 2, "budgetPerNight": 180 }
{ "task": "flights", "from": "GSP", "toCity": "St. Louis", "depart": "2027-03-05", "return": "2027-03-11", "adults": 2, "kids": 2 }
```

Both return `{ task, query, researchedAt, options: [...], notes }`, with up to 5 options.

- Hotel option: `{ name, area, nightly, total, why, url, source }`
- Flight option: `{ airline, from, to, depart, return, stops, duration, pricePerPerson, priceTotal, url, source, label }` (`label` says when an option uses a nearby alternative origin such as ATL or CLT; otherwise empty).

Inputs are validated strictly (real `YYYY-MM-DD` dates, not in the past on Eastern time, checkout after checkin, stays and trips up to 45 days, three-letter airport codes, plain short city names, party sizes 1-8 adults and 0-8 kids). Model output is parsed defensively and normalised: options without a name/airline or without an `http(s)` URL are dropped, prices become numbers or null (`"$189/night"` becomes 189), strings are clipped, and the list is capped at 5.

Status codes: 400 bad input, 401 signed out, 403 not a parent, 405 wrong method, 422 the model declined, 429 rate limited, 502 upstream or configuration trouble, 503 not set up (no API key) or Anthropic overloaded, 504 took too long. Error bodies never contain the API key or upstream error text.

## Environment variables

| Variable | Needed | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Without it the endpoint answers 503 `{ "error": "Travel agent is not set up yet", "detail": "ANTHROPIC_API_KEY is not configured" }` and the page shows a "not set up yet" message. |
| `ANTHROPIC_MODEL` | no | Model override. Default `claude-opus-5-5`. |
| `TRAVEL_FALLBACKS` | no | Set to `off` to stop sending the server-side refusal-fallback beta (`server-side-fallback-2026-07-01`, `fallbacks: "default"`), which is on by default for models that support it. |
| `TRAVEL_MCP_SERVERS` | no | JSON array of remote MCP servers the model may use as well as web search. |

`TRAVEL_MCP_SERVERS` example:

```json
[{"name":"hotels","url":"https://mcp.example.com/mcp","authorization_token":"secret-if-the-server-needs-one"}]
```

`name` is letters, digits, `_` or `-` (max 40, unique); `url` must be https; `authorization_token` is optional; up to 5 servers. When the variable is present and valid, each server goes into `mcp_servers` with a matching `mcp_toolset` tool and the `mcp-client-2025-11-20` beta. If it is missing or invalid (a warning is logged) the agent runs on web tools only. No MCP server is built in; verify a server before adding it, because its tool results are treated as untrusted text like web pages, and its calls cost whatever that service charges.

## What one press costs

Each press is one model request per stop that has nights, plus one for flights, so a three-stop trip is four requests. Each request is a single Messages API call with Anthropic-hosted web search (up to 6 searches) and web fetch (up to 4 fetches), thinking at `low` effort, and up to 8,000 output tokens, resumed up to 3 times if the server tool loop pauses. Cost is the model tokens (search results are read as input, so input dominates) plus Anthropic's per-search fee; expect a few cents to a few tens of cents per request on the default model, and measure it from the `travel-agent usage` log line the function writes (model, elapsed ms, input/output tokens, search and fetch counts) after the first real runs. The cache in the page prevents repeat spend within a session; **Search again** spends again by design.

## Limits and caveats

- **Parents only.** The function checks the bearer token against the planner's login and the `is_parent` RPC (`requireParent` in `api/atlas/_lib/auth.mjs`): 401 signed out, 403 signed in but not a parent.
- **60 seconds per request.** The function stops waiting at about 54 seconds and answers 504; the page offers a retry for that one request.
- **Prices are point-in-time and may be wrong.** The model is told to prefer prices it saw for those dates, to say in `notes` when it only found typical rates, and never to invent a URL, but it can still misread a page. Always check on the booking site. Each result block shows the date it was found.
- **Nothing is booked** and no payment details are handled.
- Text from web pages and from the request is passed to the model as data, with instructions to ignore any instructions found in it. The page escapes everything it displays and only renders `http(s)` links, opening them in a new tab with `rel="noopener"`.
- There is no per-user rate limit on the endpoint beyond the parent gate; if the key is shared widely, set a spend limit in the Anthropic console.

## Flights use Kiwi.com's MCP server by default

Since 2026-11-27 the `flights` task attaches Kiwi.com's public flight-search MCP server
(`https://mcp.kiwi.com`, no key) with only its `search-flight` tool enabled, alongside web
search. Hotels still use web tools only.

- `TRAVEL_MCP_SERVERS` unset: the default above.
- `TRAVEL_MCP_SERVERS=off`: no MCP servers for any task.
- `TRAVEL_MCP_SERVERS=[{"name":"...","url":"https://..."}]`: replaces the default for every task.

If the first request is rejected with MCP attached, the function retries once with web
tools only, so a Kiwi outage degrades to the web-search behaviour. The `travel-agent usage`
log line lists which MCP servers were attached.

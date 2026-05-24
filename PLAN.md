# PLAN.md — Implementation Plan

## Project: parkrun-mcp-v2

**Goal:** Build a local MCP server that exposes parkrun data to Claude by scraping the public parkrun website. No authentication or API key is required.

**Test values:** Mark Thomas / athlete ID `1708821` / home event `frimleylodge` / club Windle Valley Runners

---

## Decisions Log

| Date | Decision | Reason |
|---|---|---|
| 2026-05-24 | TypeScript + `@modelcontextprotocol/sdk` | Strong types, ecosystem fit |
| 2026-05-24 | stdio transport | Simplest local deployment with Claude Desktop / Claude Code |
| 2026-05-24 | HTML scraping via `cheerio` (no auth) | All required data is publicly available on parkrun.org.uk |
| 2026-05-24 | No authentication needed | Athlete history and event results are fully public |
| 2026-05-24 | `axios` for HTTP | Handles redirects automatically (needed for `/latestresults/`) |

---

## Phase 1: Discovery & Validation ✅ COMPLETE

Both public URLs confirmed working with no login:

| URL | Status | Notes |
|---|---|---|
| `https://www.parkrun.org.uk/parkrunner/1708821/all/` | ✅ | Full run history for athlete |
| `https://www.parkrun.org.uk/frimleylodge/results/latestresults/` | ✅ | Redirects to dated URL e.g. `/results/2026-05-23` |

See `docs/api-endpoints.md` for the full verified URL reference and data field documentation.

---

## Phase 2: Project Setup

- [ ] Initialise Node.js project with `package.json`
- [ ] Install dependencies:
  - `@modelcontextprotocol/sdk` — MCP server framework
  - `axios` — HTTP client (handles redirects)
  - `cheerio` — HTML parser (jQuery-like API)
  - `zod` — runtime input validation for MCP tool arguments
  - `dotenv` — load `.env` config
  - `typescript`, `ts-node`, `@types/node`, `@types/cheerio` — TypeScript toolchain
- [ ] Create `tsconfig.json` (strict mode, CommonJS output, target ES2020)
- [ ] Create `.env.example` and add `.env` to `.gitignore`
- [ ] Add `package.json` scripts: `build`, `start`, `dev`, `test:scraper`

---

## Phase 3: Scraper Modules

### 3.1 Shared HTTP client (`src/scraper/http.ts`)

- [ ] Create axios instance with:
  - Browser-like `User-Agent` header (required for parkrun pages)
  - `maxRedirects: 5` (follows `/latestresults/` → `/results/YYYY-MM-DD`)
  - Reasonable timeout (10s)
- [ ] Export as singleton

### 3.2 Athlete scraper (`src/scraper/athlete.ts`)

Target URL: `https://www.parkrun.org.uk/parkrunner/{athleteId}/all/`

- [ ] `scrapeAthleteHistory(athleteId: string): Promise<AthleteHistory>`
- Parse from HTML:
  - Runner name
  - Total run count
  - Per-run table: date, event name, event slug, finish time, position, gender position, age grade %, PB flag, cumulative run number
  - Event summary table: event name, run count, best time, first run date

**Validation:** Call with `1708821`, assert name contains `Mark Thomas`, run count > 0.

### 3.3 Event scraper (`src/scraper/event.ts`)

Target URLs:
- `https://www.parkrun.org.uk/{eventSlug}/results/latestresults/` (redirects)
- `https://www.parkrun.org.uk/{eventSlug}/results/{YYYY-MM-DD}/`
- `https://www.parkrun.org.uk/{eventSlug}/results/eventhistory/`
- `https://www.parkrun.org.uk/{eventSlug}/volunteer/futureroster/`

- [ ] `scrapeLatestResults(eventSlug: string): Promise<EventResults>`
- [ ] `scrapeResultsByDate(eventSlug: string, date: string): Promise<EventResults>`
- [ ] `scrapeEventHistory(eventSlug: string): Promise<EventHistoryEntry[]>`
- [ ] `scrapeVolunteerRoster(eventSlug: string): Promise<VolunteerRosterEntry[]>`
- Parse from results page:
  - Event name, date, event number (e.g. `#778`)
  - Finisher count, volunteer count
  - Per-finisher row: position, name, athlete ID, total finishes, gender position, milestone clubs, age group, age grade %, club name, finish time, PB status, first timer flag
  - Volunteer table: name, athlete ID, role

**Validation:** Call `scrapeLatestResults('frimleylodge')`, assert finisher count > 0, find `Mark Thomas` in results.

---

## Phase 4: TypeScript Types (`src/types/parkrun.ts`)

- [ ] `AthleteHistory` — name, totalRuns, runs[], eventSummary[]
- [ ] `RunRecord` — date, eventName, eventSlug, time, position, genderPosition, ageGrade, isPB, runNumber
- [ ] `EventResults` — eventName, date, eventNumber, finisherCount, volunteerCount, finishers[], volunteers[]
- [ ] `Finisher` — position, name, athleteId, totalFinishes, gender, genderPosition, milestones[], ageGroup, ageGrade, club, time, pbStatus
- [ ] `Volunteer` — name, athleteId, role
- [ ] `EventHistoryEntry` — date, eventNumber, finisherCount, firstFinisherName, firstFinisherTime
- [ ] `VolunteerRosterEntry` — date, roles[]

---

## Phase 5: Validation Script (`scripts/test-scraper.ts`)

A standalone script that runs every scraper function against live URLs and prints results. **Must pass before building the MCP server.**

- [ ] Test `scrapeAthleteHistory('1708821')` — assert name, run count
- [ ] Test `scrapeLatestResults('frimleylodge')` — assert finisher count, find athlete in list
- [ ] Test `scrapeResultsByDate('frimleylodge', '2026-05-23')` — assert same data
- [ ] Test `scrapeEventHistory('frimleylodge')` — assert list length > 0
- [ ] Test `scrapeVolunteerRoster('frimleylodge')` — assert roster returned
- [ ] Script exits non-zero if any test fails

Run with: `npx ts-node scripts/test-scraper.ts`

---

## Phase 6: MCP Server (`src/index.ts`)

### 6.1 Server Initialisation

- [ ] Create `Server` instance from `@modelcontextprotocol/sdk` with name `parkrun-mcp` and version
- [ ] Use `StdioServerTransport`
- [ ] Register all tools on startup
- [ ] Read `PARKRUN_DEFAULT_ATHLETE_ID` and `PARKRUN_DEFAULT_EVENT` from environment

### 6.2 MCP Tool Definitions

Each tool: name, description, Zod input schema, async handler returning text.

#### Athlete tools (`src/tools/athlete-tools.ts`)

| Tool | Inputs | Returns |
|---|---|---|
| `get_my_results` | `limit?: number` | Run history for default athlete |
| `get_athlete_results` | `athleteId: string`, `limit?: number` | Run history for any athlete |

#### Event tools (`src/tools/event-tools.ts`)

| Tool | Inputs | Returns |
|---|---|---|
| `get_event_latest_results` | `eventSlug: string` | Full finisher + volunteer list for latest run |
| `get_event_results_by_date` | `eventSlug: string`, `date: string (YYYY-MM-DD)` | Results for specific date |
| `get_event_history` | `eventSlug: string` | Index of all past events |
| `get_volunteer_roster` | `eventSlug: string` | Upcoming volunteer roster |

### 6.3 Error Handling

- [ ] Invalid event slug or athlete ID → clear "not found" message to the MCP client
- [ ] Network timeout → surface error message, do not crash server
- [ ] Unexpected HTML structure → surface parse error with URL for debugging

---

## Phase 7: Configuration Files

- [ ] `.env.example`:
  ```
  PARKRUN_DEFAULT_ATHLETE_ID=1708821
  PARKRUN_DEFAULT_EVENT=frimleylodge
  ```
- [ ] `claude_desktop_config.json` snippet in README:
  ```json
  {
    "mcpServers": {
      "parkrun": {
        "command": "node",
        "args": ["/path/to/parkrun-mcp-v2/dist/index.js"]
      }
    }
  }
  ```

---

## Phase 8: README & Documentation

- [ ] `README.md`: what it is, prerequisites (Node 18+), clone → install → `.env` → build → connect to Claude
- [ ] Update `docs/api-endpoints.md` if any new URLs discovered during build

---

## Phase 9: Integration Testing

- [ ] Connect to Claude Desktop or Claude Code
- [ ] Test each tool with natural language queries
- [ ] Verify `get_my_results` returns Mark Thomas's history from FrimleyLodge
- [ ] Verify `get_event_latest_results frimleylodge` returns this week's results
- [ ] Test graceful error: bad event slug, bad athlete ID

---

## Current Status

**Phase 1 ✅ complete.** Proceed from Phase 2.

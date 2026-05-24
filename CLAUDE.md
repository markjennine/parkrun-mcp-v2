# CLAUDE.md — Project Context for AI Assistants

## Project Overview

This project builds a **local MCP (Model Context Protocol) server** that exposes parkrun data to AI assistants such as Claude. Data is scraped from the public parkrun website — **no authentication or API key is required**.

The MCP server allows Claude (or any MCP-compatible client) to answer questions like:
- “What was my last parkrun time?”
- “How many parkruns have I done at FrimleyLodge?”
- “What are the latest results for FrimleyLodge parkrun?”
- “Who are the volunteers at my home run this Saturday?”

---

## Project Owner / Test Values

These values are used for all testing. Do not hardcode them into production code — use environment variables or a config file.

| Field | Value |
|---|---|
| Name | Mark Thomas |
| Barcode number | A1708821 |
| Numeric athlete ID | 1708821 (same, drop the A) |
| Home parkrun | FrimleyLodge |
| Club | Windle Valley Runners |

> **Always validate scraping against the above values before marking any task complete.**

---

## Architecture

```
Claude / MCP Client
       │
       ▼
parkrun-mcp-v2 (MCP Server, local stdio transport)
       │
       ▼
www.parkrun.org.uk  (public HTML pages — no auth needed)
  ├── /parkrunner/{id}/all/              — Athlete run history
  ├── /{event}/results/latestresults/    — Latest event results
  ├── /{event}/results/{YYYY-MM-DD}/     — Results by date
  ├── /{event}/results/eventhistory/     — All past events
  └── /{event}/volunteer/futureroster/   — Upcoming volunteer roster
```

### Technology Stack

- **Language:** TypeScript (Node.js)
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **HTTP client:** `axios`
- **HTML parser:** `cheerio` (jQuery-like HTML parsing, no headless browser needed)
- **Transport:** stdio (for local MCP use with Claude Desktop / Claude Code)

---

## Repository Structure

```
parkrun-mcp-v2/
├── CLAUDE.md              ← This file
├── PLAN.md                ← Implementation plan
├── README.md              ← User-facing setup guide
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── src/
│   ├── index.ts           ← MCP server entry point
│   ├── scraper/
│   │   ├── athlete.ts     ← Scrape athlete pages
│   │   ├── event.ts       ← Scrape event results pages
│   │   └── http.ts        ← Shared axios instance with UA header
│   ├── tools/
│   │   ├── athlete-tools.ts
│   │   ├── event-tools.ts
│   │   └── index.ts
│   └── types/
│       └── parkrun.ts     ← TypeScript interfaces
├── scripts/
│   └── test-scraper.ts    ← Standalone validation script
└── docs/
    └── api-endpoints.md   ← Verified URL patterns & data reference
```

---

## Verified URL Patterns

### Athlete page (full history)
```
https://www.parkrun.org.uk/parkrunner/{numericId}/all/
```
Example: `https://www.parkrun.org.uk/parkrunner/1708821/all/`

### Latest event results
```
https://www.parkrun.org.uk/{eventSlug}/results/latestresults/
```
Example: `https://www.parkrun.org.uk/frimleylodge/results/latestresults/`
→ Redirects to: `https://www.parkrun.org.uk/frimleylodge/results/2026-05-23`

### Results by date
```
https://www.parkrun.org.uk/{eventSlug}/results/{YYYY-MM-DD}/
```

### Event history index
```
https://www.parkrun.org.uk/{eventSlug}/results/eventhistory/
```

### Future volunteer roster
```
https://www.parkrun.org.uk/{eventSlug}/volunteer/futureroster/
```

**Both athlete and event pages confirmed working. No login required.**  
See `docs/api-endpoints.md` for full data field reference.

---

## MCP Tools

| Tool Name | Description |
|---|---|
| `get_athlete_results` | Full run history for any athlete by ID |
| `get_my_results` | Run history for the configured default athlete |
| `get_event_latest_results` | Most recent results for a named event |
| `get_event_results_by_date` | Results for a specific date and event |
| `get_event_history` | Index of all past events for an event |
| `get_volunteer_roster` | Upcoming volunteer slots for an event |

---

## Development Rules

1. **Test scraping with real URLs before committing.** Use `1708821` / `frimleylodge` as baseline.
2. **Never hardcode athlete IDs or event names.** Use env vars or config.
3. **Set a browser-like User-Agent** on all HTTP requests — required for parkrun pages.
4. **Follow redirects** — `/latestresults/` redirects to the dated URL; axios does this automatically.
5. **Parse the initial HTML only** — all data is in server-rendered HTML, no JS execution needed.
6. **TypeScript strict mode** enabled — no `any` without justification.
7. **Handle errors gracefully:** 404 (event/athlete not found), network timeouts, HTML structure changes.
8. **Be conservative with requests** — cache responses where sensible; don’t hammer the site.
9. **stdout is reserved for MCP protocol.** Use `process.stderr` for all logging in `src/index.ts`.

---

## Setup for Development

```bash
npm install
cp .env.example .env
# Edit .env with your preferred default event and athlete ID

# Validate scraping works
npm run test:scraper

# Start the MCP server
npm start
```

### Environment Variables

```
PARKRUN_DEFAULT_ATHLETE_ID=1708821
PARKRUN_DEFAULT_EVENT=frimleylodge
```

---

## Phase Completion Checklist

- [x] Phase 1: URL discovery & validation (both athlete and event pages confirmed ✅)
- [x] Phase 2: Project setup (package.json, tsconfig, deps, .env.example, .gitignore)
- [x] Phase 3: Scraper modules (athlete.ts, event.ts, http.ts)
- [x] Phase 4: TypeScript types (parkrun.ts)
- [x] Phase 5: MCP tool definitions (athlete-tools.ts, event-tools.ts)
- [x] Phase 6: MCP server entry point (index.ts)
- [x] Phase 7: Validation script (scripts/test-scraper.ts)
- [ ] Phase 8: Integration testing with Claude Desktop — run `npm run test:scraper` first
- [ ] Phase 9: Selector verification — CSS selectors in scraper may need tuning against live HTML

---
# Auto-Issue Workflow

## Command: /auto

When the user runs `/auto`, follow these steps exactly:

### Step 1 — Fetch issues
Run: `gh issue list --label auto --json number,title,body,url`
Present the results as a numbered list showing the issue number, title, and URL.
Ask the user: "Which issue would you like to implement? Enter the number."

### Step 2 — Confirm
Show the full title and body of the chosen issue.
Ask: "Shall I proceed with implementing this?"

### Step 3 — Implement
- Create a branch: `git checkout -b auto/issue-{NUMBER}`
- Read the issue carefully and implement the required changes
- Follow existing code conventions in the project
- Write or update tests if applicable

### Step 4 — Open PR
- Stage and commit all changes: `git add -A && git commit -m "feat: resolve issue #{NUMBER} - {TITLE}"`
- Push: `git push origin auto/issue-{NUMBER}`
- Open PR: `gh pr create --title "Auto: {TITLE}" --body "Closes #{NUMBER}\n\nImplemented via Claude Code." --base main`
- Share the PR URL with the user

# CLAUDE.md — Project Context for AI Assistants

## Project Overview

This project builds a **local MCP (Model Context Protocol) server** that exposes parkrun data to AI assistants such as Claude. The API is unofficial and reverse-engineered from the parkrun mobile app.

The MCP server allows Claude (or any MCP-compatible client) to answer questions like:
- "What was my last parkrun time?"
- "How many parkruns have I done at FrimleyLodge?"
- "What are the latest results for FrimleyLodge parkrun?"
- "Who are the volunteers at my home run this Saturday?"

---

## Project Owner / Test Credentials

These values are used for all API testing. Do not hardcode them into production code — use environment variables or a config file.

| Field | Value |
|---|---|
| Name | Mark Thomas |
| Runner number | A1708821 |
| Home parkrun | FrimleyLodge |
| Club | Windle Valley Runners |

> **Always validate API calls using the above credentials before marking any task complete.**

---

## Architecture

```
Claude / MCP Client
       │
       ▼
parkrun-mcp-v2 (MCP Server, local stdio transport)
       │
       ▼
parkrun API (reverse-engineered, unofficial)
  ├── auth.parkrun.com  — OAuth2 login / token refresh
  ├── api.parkrun.com   — Athlete & run data (authenticated)
  └── www.parkrun.org.uk — Public event/results pages (scraped)
```

### Technology Stack

- **Language**: TypeScript (Node.js)
- **MCP SDK**: `@modelcontextprotocol/sdk`
- **HTTP client**: `axios` with cookie/session support
- **Auth**: OAuth2 password grant (parkrun uses auth.parkrun.com)
- **Transport**: stdio (for local MCP use with Claude Desktop / Claude Code)

---

## Repository Structure

```
parkrun-mcp-v2/
├── CLAUDE.md              ← This file
├── PLAN.md                ← Implementation plan
├── README.md              ← User-facing setup guide
├── package.json
├── tsconfig.json
├── .env.example           ← Template for credentials
├── src/
│   ├── index.ts           ← MCP server entry point
│   ├── api/
│   │   ├── auth.ts        ← Login / token management
│   │   ├── athlete.ts     ← Athlete profile & run history
│   │   ├── event.ts       ← Event results & details
│   │   └── endpoints.ts   ← All API URL constants
│   ├── tools/
│   │   ├── athlete-tools.ts   ← MCP tool definitions for athlete data
│   │   ├── event-tools.ts     ← MCP tool definitions for event data
│   │   └── index.ts           ← Register all tools
│   └── types/
│       └── parkrun.ts     ← TypeScript types for API responses
├── scripts/
│   └── test-api.ts        ← Standalone API validation script
└── docs/
    └── api-endpoints.md   ← Discovered API endpoints reference
```

---

## API Details (Reverse-Engineered)

### Authentication

parkrun uses **OAuth2 with Resource Owner Password Credentials** grant:

```
POST https://auth.parkrun.com/auth/realms/parkrun/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

grant_type=password
&username=A1708821
&password=<password>
&client_id=parkunner-website
```

Response includes `access_token` and `refresh_token` (JWT).

Use `Authorization: Bearer <access_token>` on all subsequent API requests.

### Key API Endpoints

| Endpoint | Auth | Description |
|---|---|---|
| `GET https://api.parkrun.com/v1/me` | ✅ | Authenticated user profile |
| `GET https://api.parkrun.com/v1/me/results` | ✅ | Run results for logged-in user |
| `GET https://api.parkrun.com/v1/athletes/{id}` | ✅ | Athlete profile by ID |
| `GET https://api.parkrun.com/v1/athletes/{id}/results` | ✅ | Run history for athlete |
| `GET https://api.parkrun.com/v1/events` | ❌ | All events |
| `GET https://api.parkrun.com/v1/events/{eventName}/results` | ❌ | Event results |
| `GET https://api.parkrun.com/v1/events/{eventName}/results/latest` | ❌ | Latest results for event |

> **Note:** The numeric athlete ID differs from the barcode number (e.g. `A1708821`). The numeric ID is obtained from the profile endpoint after authentication.

### Public Scraping Fallback

Some data is available without auth via the parkrun website:

```
https://www.parkrun.org.uk/parkrunner/{athleteId}/all/
https://www.parkrun.org.uk/{eventName}/results/
https://www.parkrun.org.uk/{eventName}/results/latest/
```

These require a browser-like User-Agent and may require cookies.

---

## MCP Tools (Planned)

| Tool Name | Description |
|---|---|
| `get_athlete_profile` | Get name, run count, home run, club for an athlete |
| `get_athlete_results` | Get run history (all or N most recent) for an athlete |
| `get_my_profile` | Get profile for the configured default athlete |
| `get_my_results` | Get results for the configured default athlete |
| `get_event_latest_results` | Get most recent results for a named parkrun event |
| `get_event_results_by_date` | Get results for a specific date and event |
| `search_events` | Search for parkrun events by name or location |

---

## Development Rules

1. **Always test API calls with real credentials before committing.** Use `A1708821` / FrimleyLodge as the baseline.
2. **Never commit credentials to the repo.** Use `.env` and `.gitignore`.
3. **Validate API responses match expected schema** before building tool logic on top.
4. **Document every discovered endpoint** in `docs/api-endpoints.md` with: URL, method, auth required, request params, and a real response example.
5. **Token caching**: Store tokens in memory during a session; implement refresh before expiry.
6. **Handle HTTP errors gracefully**: 401 → re-auth, 404 → not found, 429 → rate limit.
7. **TypeScript strict mode** is enabled — no `any` without justification.
8. Use `zod` for runtime validation of API responses.

---

## Setup for Development

```bash
npm install
cp .env.example .env
# Fill in PARKRUN_USERNAME and PARKRUN_PASSWORD in .env

# Run the API test script to validate all endpoints
npx ts-node scripts/test-api.ts

# Start the MCP server (stdio mode)
npm start
```

### Environment Variables

```
PARKRUN_USERNAME=A1708821
PARKRUN_PASSWORD=<your password>
PARKRUN_DEFAULT_EVENT=FrimleyLodge
PARKRUN_DEFAULT_ATHLETE_ID=<numeric ID from profile endpoint>
```

---

## Important Caveats

- This is **unofficial** and Parkrun's API can change without notice.
- The API programme is officially on hold (as per parkrun.com/api).
- Rate limiting may apply — be conservative with requests.
- Some endpoints (e.g. freedom runs) can only be accessed for the authenticated user.
- Parkrun athlete IDs use two formats: barcode format (`A1708821`) and numeric (obtained via API).

---

## Phase Completion Checklist

- [ ] Phase 1: API reverse engineering & validation
- [ ] Phase 2: Auth module with token management
- [ ] Phase 3: API client modules (athlete, event)
- [ ] Phase 4: MCP server with tool definitions
- [ ] Phase 5: Integration testing with Claude Desktop
- [ ] Phase 6: README & documentation

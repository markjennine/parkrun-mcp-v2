# PLAN.md — Implementation Plan

## Project: parkrun-mcp-v2

**Goal:** Build a local MCP server that exposes parkrun data to Claude, by reverse-engineering the unofficial parkrun API.

**Test athlete:** Mark Thomas / A1708821 / FrimleyLodge / Windle Valley Runners

---

## Phase 1: API Reverse Engineering & Validation

> **Rule: Every endpoint must return a valid response before we move on.**

### 1.1 Understand Auth Flow

- [ ] Identify auth server: `auth.parkrun.com` (OAuth2 Keycloak)
- [ ] Perform password grant flow manually (curl/httpie)
- [ ] Confirm token structure (JWT access + refresh tokens)
- [ ] Test token refresh endpoint
- [ ] Document: client_id, realm, grant_type, scopes

**Auth endpoint:**
```
POST https://auth.parkrun.com/auth/realms/parkrun/protocol/openid-connect/token
```

**Validation:** Successfully obtain a bearer token for `A1708821`.

---

### 1.2 Discover & Validate API Endpoints

For each endpoint below, make a real HTTP call and confirm a valid JSON response.

#### Athlete Endpoints (Authenticated)

| # | Endpoint | Status |
|---|---|---|
| 1.2.1 | `GET /v1/me` — own profile | ⬜ |
| 1.2.2 | `GET /v1/me/results` — own run history | ⬜ |
| 1.2.3 | `GET /v1/athletes/{id}` — any athlete profile | ⬜ |
| 1.2.4 | `GET /v1/athletes/{id}/results` — athlete run history | ⬜ |
| 1.2.5 | `GET /v1/athletes/{id}/clubs` — milestone clubs | ⬜ |

#### Event Endpoints (May not require auth)

| # | Endpoint | Status |
|---|---|---|
| 1.2.6 | `GET /v1/events` — list all events | ⬜ |
| 1.2.7 | `GET /v1/events/{eventName}` — event details | ⬜ |
| 1.2.8 | `GET /v1/events/{eventName}/results` — event results | ⬜ |
| 1.2.9 | `GET /v1/events/{eventName}/results/latest` — latest results | ⬜ |

#### Global / Miscellaneous

| # | Endpoint | Status |
|---|---|---|
| 1.2.10 | `GET /v1/statistics` — global stats | ⬜ |
| 1.2.11 | `GET /v1/countries` — country list | ⬜ |

**Status legend:** ⬜ Not tested · ✅ Working · ❌ Broken/unavailable · 🔄 Needs auth

### 1.3 Document API Responses

- [ ] Create `docs/api-endpoints.md` with real response examples for each working endpoint
- [ ] Note any pagination patterns (`offset`, `limit`, `page`)
- [ ] Note any required query parameters
- [ ] Note rate limiting headers if present

### 1.4 Fallback: Web Scraping

If authenticated API endpoints are unavailable or incomplete:
- [ ] Test `https://www.parkrun.org.uk/parkrunner/A1708821/all/` — full results page
- [ ] Test `https://www.parkrun.org.uk/frimleylodge/results/latest/` — latest event results
- [ ] Assess HTML structure for reliable scraping
- [ ] Decide: scraping vs API for each data type

---

## Phase 2: Project Setup

- [ ] Initialise Node.js project: `npm init`
- [ ] Install dependencies:
  - `@modelcontextprotocol/sdk` — MCP server SDK
  - `axios` — HTTP client
  - `zod` — runtime schema validation
  - `dotenv` — environment config
  - `typescript`, `ts-node`, `@types/node` — TypeScript tooling
- [ ] Set up `tsconfig.json` (strict mode, ESM or CJS)
- [ ] Add `.env.example` (never commit `.env`)
- [ ] Add `.gitignore`
- [ ] Set up `package.json` scripts: `build`, `start`, `test:api`

---

## Phase 3: Auth Module

**File:** `src/api/auth.ts`

- [ ] Implement `login(username, password)` → `{ accessToken, refreshToken, expiresAt }`
- [ ] Implement `refresh(refreshToken)` → updated tokens
- [ ] Implement `getToken()` — returns valid token, refreshing if needed
- [ ] In-memory token cache (single session)
- [ ] Error handling: bad credentials (401), expired refresh (400)

**Validation:** Run against `A1708821` and confirm a valid JWT is returned.

---

## Phase 4: API Client Modules

### 4.1 Athlete Module (`src/api/athlete.ts`)

- [ ] `getMyProfile()` — `/v1/me`
- [ ] `getMyResults(limit?)` — `/v1/me/results`
- [ ] `getAthleteProfile(athleteId)` — `/v1/athletes/{id}`
- [ ] `getAthleteResults(athleteId, limit?)` — `/v1/athletes/{id}/results`
- [ ] `getAthleteClubs(athleteId)` — `/v1/athletes/{id}/clubs`

**Validation:** All methods return typed results for `A1708821` / FrimleyLodge.

### 4.2 Event Module (`src/api/event.ts`)

- [ ] `getEventLatestResults(eventName)` — latest parkrun results
- [ ] `getEventResultsByDate(eventName, date)` — results on a specific date
- [ ] `getEventDetails(eventName)` — event metadata
- [ ] `searchEvents(query)` — search by name

**Validation:** All methods return valid results for `FrimleyLodge`.

### 4.3 TypeScript Types (`src/types/parkrun.ts`)

Define interfaces for:
- [ ] `AthleteProfile`
- [ ] `RunResult`
- [ ] `EventResult`
- [ ] `EventDetails`
- [ ] `Club`
- [ ] `AuthTokens`

---

## Phase 5: MCP Server

**File:** `src/index.ts`

### 5.1 Server Initialisation

- [ ] Create MCP server with name `parkrun` and version
- [ ] Use stdio transport
- [ ] Register all tools on startup
- [ ] Load credentials from environment on startup

### 5.2 MCP Tool Definitions (`src/tools/`)

Each tool needs: name, description, input schema (Zod/JSON Schema), and handler.

#### Athlete Tools (`athlete-tools.ts`)

| Tool | Input | Output |
|---|---|---|
| `get_my_profile` | none | name, run count, home run, club |
| `get_my_results` | `limit?: number` | array of run results |
| `get_athlete_profile` | `athleteId: string` | athlete profile |
| `get_athlete_results` | `athleteId: string, limit?: number` | run results |

#### Event Tools (`event-tools.ts`)

| Tool | Input | Output |
|---|---|---|
| `get_event_latest_results` | `eventName: string` | most recent results |
| `get_event_results_by_date` | `eventName: string, date: string` | results on date |
| `search_events` | `query: string` | matching event names |

### 5.3 Error Handling

- [ ] Auth failures → re-auth once, then return clear error message
- [ ] Not found → helpful message (e.g. "event not found, check the name")
- [ ] Rate limit → retry after delay or return error
- [ ] Network errors → surface clearly to the MCP client

---

## Phase 6: API Test Script

**File:** `scripts/test-api.ts`

A standalone script (not MCP) that:
- [ ] Authenticates as `A1708821`
- [ ] Calls every API endpoint
- [ ] Prints results (or errors) for each
- [ ] Exits non-zero if any call fails

Run with: `npx ts-node scripts/test-api.ts`

This is the **gate** before Phase 3–5: all endpoints must pass this script.

---

## Phase 7: README & Documentation

- [ ] User-facing `README.md`:
  - What this is
  - Prerequisites (Node.js version)
  - Installation steps
  - `.env` setup
  - How to add to Claude Desktop config
  - Available MCP tools with examples
- [ ] `docs/api-endpoints.md`: full endpoint reference with real responses
- [ ] `docs/setup-claude-desktop.md`: step-by-step guide for connecting to Claude Desktop

---

## Phase 8: Integration Testing

- [ ] Add to Claude Desktop `claude_desktop_config.json`
- [ ] Test each MCP tool via Claude conversation
- [ ] Verify responses are correct for FrimleyLodge / Mark Thomas
- [ ] Test error cases (bad event name, unauthenticated)

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Parkrun changes API | Medium | Document all endpoints; add version pinning |
| Auth flow changes | Low–Medium | Token refresh logic; re-test auth on each session |
| Rate limiting | Low | Cache responses; limit tool call frequency |
| Scraping breaks | High (if used) | Prefer API over scraping; test weekly |
| Credentials in repo | — | `.gitignore` + `.env.example`; CI secret scan |

---

## Decisions Log

| Date | Decision | Reason |
|---|---|---|
| 2026-05-24 | TypeScript + MCP SDK | Strong types, ecosystem fit |
| 2026-05-24 | stdio transport | Simplest local deployment with Claude Desktop |
| 2026-05-24 | Zod for validation | Catches API changes at runtime |
| 2026-05-24 | Auth-first approach | Most athlete endpoints require auth |
| 2026-05-24 | Web scraping as fallback | Some public data may not be in the JSON API |

---

## Current Status

**Phase 1** — In progress (API reverse engineering)

Next step: Validate auth endpoint and obtain a bearer token for `A1708821`.

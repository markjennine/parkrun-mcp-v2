# Parkrun API Endpoints — Verified Reference

All endpoints below have been tested and confirmed working as of 2026-05-24.
**No authentication is required for any of these endpoints.**

---

## Base URLs

| Site | Base URL |
|---|---|
| UK parkrun | `https://www.parkrun.org.uk` |
| Global | `https://www.parkrun.com` |

---

## Athlete Endpoints

### Full run history for an athlete

```
GET https://www.parkrun.org.uk/parkrunner/{athleteId}/all/
```

- **Auth required:** No
- **`athleteId`:** Numeric ID. Same as the barcode number without the leading `A`. E.g. `A1708821` → `1708821`.
- **Returns:** HTML page with full run history table
- **Tested with:** `1708821` (Mark Thomas) ✅

**Example:**
```
https://www.parkrun.org.uk/parkrunner/1708821/all/
```

**Data available on this page:**
- Runner name
- Each run: date, event name, event URL, finish time, position, gender position, age grade %, PB flag, total runs to date
- Event summary: events attended, run counts, best times
- Volunteer summary

---

## Event Endpoints

### Latest results for an event

```
GET https://www.parkrun.org.uk/{eventName}/results/latestresults/
```

- **Auth required:** No
- **`eventName`:** Lowercase event slug (e.g. `frimleylodge`)
- **Returns:** HTML page. **Redirects** to the dated URL: `/{eventName}/results/{YYYY-MM-DD}`
- **Tested with:** `frimleylodge` ✅

**Example:**
```
https://www.parkrun.org.uk/frimleylodge/results/latestresults/
→ redirects to https://www.parkrun.org.uk/frimleylodge/results/2026-05-23
```

**Data available on the results page:**
- Event name and date
- Event number (e.g. `#778`)
- Total finishers and volunteers count
- Finishers table (per runner):
  - Position (overall)
  - Name + link to athlete page (`/frimleylodge/parkrunner/{athleteId}`)
  - Numeric athlete ID (in the URL)
  - Total finishes (lifetime)
  - Gender position (e.g. `Male 158/366`)
  - Milestone club badges (10, 25, 50, 100, 250, 500 etc.)
  - Volunteer milestone badges (v10, v25, v50, v100, v250)
  - Age group (e.g. `VM55-59`)
  - Age grade % (e.g. `59.29%`)
  - Club name + link
  - Finish time
  - PB status: `New PB!`, `PB HH:MM:SS` (previous best), or blank
  - First timer flag
- Volunteers table: name, role

### Results for a specific date

```
GET https://www.parkrun.org.uk/{eventName}/results/{YYYY-MM-DD}/
```

- **Auth required:** No
- **Returns:** Same HTML format as latest results
- **Example:** `https://www.parkrun.org.uk/frimleylodge/results/2026-05-23/`

### Event history (index of all past events)

```
GET https://www.parkrun.org.uk/{eventName}/results/eventhistory/
```

- **Auth required:** No
- **Returns:** HTML table of all events with date, number of finishers, first finisher details

### Future volunteer roster

```
GET https://www.parkrun.org.uk/{eventName}/volunteer/futureroster/
```

- **Auth required:** No  
- **Returns:** HTML page listing upcoming volunteer slots by date and role

### Club list for an event

```
GET https://www.parkrun.org.uk/{eventName}/results/clublist/
```

- **Auth required:** No
- **Returns:** HTML table of clubs represented at this event

---

## URL Patterns & Notes

### Athlete ID format
- Barcode: `A1708821`
- URL numeric ID: `1708821` (drop the `A`)
- The same numeric ID appears in the finishers table URL on event result pages: `/frimleylodge/parkrunner/1708821`
- This confirms the numeric ID = barcode number without the `A` prefix

### Event slug format
- All lowercase, no spaces or hyphens
- Examples: `frimleylodge`, `bushy`, `southwark`

### Date format
- `YYYY-MM-DD` in URLs (ISO 8601)
- Displayed as `YYYY-MM-DD` on the page header

### User-Agent
- Standard browser User-Agent required for scraping — the site returns content fine to curl with a modern UA
- No cookies or sessions required for public pages

---

## Data Not Available Without Authentication

The following require logging in with parkrun credentials (OAuth2 via `auth.parkrun.com`):

- Personal barcode image
- Account settings / profile edit
- Freedom runs (GPS routes)
- Push notification preferences

For the MCP server's intended use cases, **none of these are needed**. All results, event data, and athlete history are publicly accessible.

---

## Scraping Strategy

Since the data is in HTML, the MCP server will use **HTML parsing** (cheerio or similar) to extract structured data. Key selectors to identify:

- Results table: `table` with `id="results"` (consistent across parkrun pages)
- Athlete links: `a[href*="/parkrunner/"]`
- Event metadata: `h2` or page title elements
- Volunteer table: second `table#results` on results pages

> **Note:** The page uses JavaScript-enhanced sorting/filtering, but the full data is present in the initial HTML — no JS execution required for scraping.

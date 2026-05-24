# parkrun-mcp-v2

A local **MCP (Model Context Protocol) server** that exposes parkrun data to AI assistants such as Claude. Data is scraped from the public parkrun website — **no authentication or API key required**.

## What it does

Once connected, you can ask Claude questions like:

- “What was my last parkrun time?”
- “How many parkruns have I done at FrimleyLodge?”
- “What are the latest results for FrimleyLodge parkrun?”
- “Who are the volunteers at my home run this Saturday?”

## Prerequisites

- **Node.js 18+**
- **npm**
- Your numeric parkrun athlete ID (same as your barcode number, without the leading `A`)

## Setup

```bash
# 1. Clone the repo
git clone https://github.com/markjennine/parkrun-mcp-v2.git
cd parkrun-mcp-v2

# 2. Install dependencies
npm install

# 3. Configure your athlete ID and home event
cp .env.example .env
# Edit .env:
#   PARKRUN_DEFAULT_ATHLETE_ID=1708821   <- your numeric athlete ID
#   PARKRUN_DEFAULT_EVENT=frimleylodge   <- your home event slug

# 4. Build
npm run build

# 5. (Optional) Validate scraping against live data
npm run test:scraper
```

## Connecting to Claude Desktop

Add the following to your `claude_desktop_config.json` (usually at
`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "parkrun": {
      "command": "node",
      "args": ["/absolute/path/to/parkrun-mcp-v2/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop. You should see the parkrun tools available.

## Connecting to Claude Code

```bash
claude mcp add parkrun node /absolute/path/to/parkrun-mcp-v2/dist/index.js
```

## Available tools

| Tool | Description |
|---|---|
| `get_my_results` | Run history for your configured default athlete |
| `get_athlete_results` | Run history for any athlete by numeric ID |
| `get_event_latest_results` | Most recent results for any event |
| `get_event_results_by_date` | Results for a specific event and date |
| `get_event_history` | Index of all past events for a location |
| `get_volunteer_roster` | Upcoming volunteer roster for an event |

## Development

```bash
npm run dev          # Run directly with ts-node (no build step)
npm run build        # Compile TypeScript to dist/
npm run test:scraper # Validate scrapers against live URLs
npm run clean        # Delete dist/
```

## Notes

- All parkrun results pages are publicly accessible without login.
- The server sets a browser-like `User-Agent` header, which is required for parkrun pages.
- Athlete IDs are in the format `A1708821` on your barcode; drop the `A` for the numeric ID used here.

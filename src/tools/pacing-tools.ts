import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { scrapeAthleteHistory } from '../scraper/athlete.js';
import { scrapeResultsByDate } from '../scraper/event.js';
import type { PacingRecord } from '../types/parkrun.js';

const DEFAULT_ATHLETE_ID = process.env.PARKRUN_DEFAULT_ATHLETE_ID ?? '';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const pacingTools: Tool[] = [
  {
    name: 'get_pacing_history',
    description:
      'Find all occasions when an athlete volunteered as a pacer at parkrun. ' +
      'Cross-references the athlete\'s run history with the volunteer list on each results page. ' +
      'Use to answer questions like "when did I last pace?" or "show my run times when I was a pacer".',
    inputSchema: {
      type: 'object',
      properties: {
        athleteId: {
          type: 'string',
          description:
            'Numeric parkrun athlete ID. Omit to use the configured default athlete.',
        },
        eventSlug: {
          type: 'string',
          description:
            'Optional: restrict search to a specific event slug, e.g. "frimleylodge". ' +
            'Omitting checks across all events in the athlete\'s history.',
        },
        checkLimit: {
          type: 'number',
          description:
            'Maximum number of most-recent runs to check (default: 100). ' +
            'Each run requires one HTTP request, so higher values take longer.',
          minimum: 1,
          maximum: 500,
        },
      },
    },
  },
];

export async function handlePacingTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  if (toolName === 'get_pacing_history') {
    const { athleteId: rawId, eventSlug, checkLimit } = z
      .object({
        athleteId: z.string().optional(),
        eventSlug: z.string().optional(),
        checkLimit: z.number().optional(),
      })
      .parse(args);

    const athleteId = rawId ?? DEFAULT_ATHLETE_ID;
    if (!athleteId) {
      return 'PARKRUN_DEFAULT_ATHLETE_ID is not set. Provide athleteId or add it to your .env file.';
    }

    const limit = checkLimit ?? 100;
    const history = await scrapeAthleteHistory(athleteId);

    let runsToCheck = history.runs;
    if (eventSlug) {
      runsToCheck = runsToCheck.filter((r) => r.eventSlug === eventSlug);
    }
    // runs are newest-first from the scraper; take the most recent `limit` runs
    runsToCheck = runsToCheck.slice(0, limit);

    if (runsToCheck.length === 0) {
      const where = eventSlug ? ` at ${eventSlug}` : '';
      return `No runs found for athlete ${history.name}${where}.`;
    }

    const pacingRecords: PacingRecord[] = [];
    const athleteNameNorm = history.name.toLowerCase();

    for (const run of runsToCheck) {
      try {
        const results = await scrapeResultsByDate(run.eventSlug, run.date);
        const match = results.volunteers.find((v) => {
          if (!v.role.toLowerCase().includes('pacer')) return false;
          // prefer ID match; fall back to case-insensitive name match
          if (v.athleteId) return v.athleteId === athleteId;
          return v.name.toLowerCase() === athleteNameNorm;
        });
        if (match) {
          pacingRecords.push({
            date: run.date,
            eventName: run.eventName,
            eventSlug: run.eventSlug,
            runTime: run.time,
            position: run.position,
            pacerRole: match.role,
          });
        }
      } catch {
        // results page unavailable for this run — skip silently
      }
      await sleep(200);
    }

    if (pacingRecords.length === 0) {
      const where = eventSlug ? ` at ${eventSlug}` : '';
      return (
        `No pacing occasions found for ${history.name}` +
        `${where} in the last ${runsToCheck.length} run${runsToCheck.length === 1 ? '' : 's'} checked.`
      );
    }

    const lines = [
      `Pacing history for ${history.name} (${pacingRecords.length} occasion${pacingRecords.length === 1 ? '' : 's'} found, ${runsToCheck.length} runs checked):`,
      '',
      ...pacingRecords.map(
        (p) =>
          `  ${p.date}  ${p.eventName.padEnd(20)}  Time: ${p.runTime}  Pos: ${String(p.position).padStart(3)}  Role: ${p.pacerRole}`
      ),
    ];
    return lines.join('\n');
  }

  throw new Error(`Unknown pacing tool: ${toolName}`);
}

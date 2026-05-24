import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { scrapeAthleteHistory } from '../scraper/athlete.js';

const DEFAULT_ATHLETE_ID = process.env.PARKRUN_DEFAULT_ATHLETE_ID ?? '';

function formatAthleteHistory(
  history: Awaited<ReturnType<typeof scrapeAthleteHistory>>,
  limit?: number
): string {
  const runs = limit ? history.runs.slice(0, limit) : history.runs;
  const lines = [
    `Athlete: ${history.name} (ID: ${history.athleteId})`,
    `Total runs: ${history.totalRuns}`,
    '',
    'Recent runs:',
    ...runs.map(
      (r) =>
        `  ${r.date}  ${r.eventName.padEnd(20)}  ${r.time}  Pos ${r.position}${r.isPB ? '  *** PB ***' : ''}`
    ),
  ];
  return lines.join('\n');
}

export const athleteTools: Tool[] = [
  {
    name: 'get_my_results',
    description:
      'Get the run history for the configured default athlete. Returns recent parkrun results including times, positions, and PBs.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of recent runs to return (default: 10)',
          minimum: 1,
          maximum: 500,
        },
      },
    },
  },
  {
    name: 'get_athlete_results',
    description:
      'Get the run history for any parkrun athlete by their numeric ID.',
    inputSchema: {
      type: 'object',
      properties: {
        athleteId: {
          type: 'string',
          description:
            'Numeric parkrun athlete ID (e.g. "1708821"). Same as barcode without the leading A.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of recent runs to return (default: 10)',
          minimum: 1,
          maximum: 500,
        },
      },
      required: ['athleteId'],
    },
  },
];

export async function handleAthleteTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  if (toolName === 'get_my_results') {
    if (!DEFAULT_ATHLETE_ID) {
      return 'PARKRUN_DEFAULT_ATHLETE_ID is not set. Please add it to your .env file.';
    }
    const { limit } = z.object({ limit: z.number().optional() }).parse(args);
    const history = await scrapeAthleteHistory(DEFAULT_ATHLETE_ID);
    return formatAthleteHistory(history, limit ?? 10);
  }

  if (toolName === 'get_athlete_results') {
    const { athleteId, limit } = z
      .object({ athleteId: z.string(), limit: z.number().optional() })
      .parse(args);
    const history = await scrapeAthleteHistory(athleteId);
    return formatAthleteHistory(history, limit ?? 10);
  }

  throw new Error(`Unknown athlete tool: ${toolName}`);
}

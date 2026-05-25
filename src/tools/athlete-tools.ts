import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { scrapeAthleteHistory, scrapeAthleteVolunteerSummary } from '../scraper/athlete.js';

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

function timeToSeconds(time: string): number {
  const parts = time.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Infinity;
}

function formatPersonalBest(
  history: Awaited<ReturnType<typeof scrapeAthleteHistory>>
): string {
  if (history.runs.length === 0) {
    return `No runs found for athlete ${history.athleteId}.`;
  }
  const best = history.runs.reduce((a, b) =>
    timeToSeconds(a.time) <= timeToSeconds(b.time) ? a : b
  );
  return [
    `Athlete: ${history.name} (ID: ${history.athleteId})`,
    `Personal best: ${best.time}`,
    `Event: ${best.eventName}`,
    `Date: ${best.date}`,
  ].join('\n');
}

function formatVolunteerSummary(
  summary: Awaited<ReturnType<typeof scrapeAthleteVolunteerSummary>>
): string {
  const lines = [
    `Athlete: ${summary.name} (ID: ${summary.athleteId})`,
    `Total volunteer credits: ${summary.totalCredits}`,
    '',
    'Volunteer roles:',
    ...summary.roles.map((r) => `  ${r.role.padEnd(30)} ${r.occasions} occasion${r.occasions === 1 ? '' : 's'}`),
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
  {
    name: 'get_my_personal_best',
    description:
      'Get the personal best (fastest) parkrun time for the configured default athlete.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_personal_bests',
    description:
      'Get the personal best (fastest) parkrun time for any athlete by their numeric ID.',
    inputSchema: {
      type: 'object',
      properties: {
        athleteId: {
          type: 'string',
          description:
            'Numeric parkrun athlete ID (e.g. "1708821"). Same as barcode without the leading A.',
        },
      },
      required: ['athleteId'],
    },
  },
  {
    name: 'get_my_volunteer_history',
    description:
      'Get the volunteering history for the configured default athlete. Returns a summary of volunteer roles and total credits.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_volunteer_history',
    description:
      'Get the volunteering history for any parkrun athlete by their numeric ID. Returns a summary of volunteer roles and total credits.',
    inputSchema: {
      type: 'object',
      properties: {
        athleteId: {
          type: 'string',
          description:
            'Numeric parkrun athlete ID (e.g. "1708821"). Same as barcode without the leading A.',
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

  if (toolName === 'get_my_personal_best') {
    if (!DEFAULT_ATHLETE_ID) {
      return 'PARKRUN_DEFAULT_ATHLETE_ID is not set. Please add it to your .env file.';
    }
    const history = await scrapeAthleteHistory(DEFAULT_ATHLETE_ID);
    return formatPersonalBest(history);
  }

  if (toolName === 'get_personal_bests') {
    const { athleteId } = z.object({ athleteId: z.string() }).parse(args);
    const history = await scrapeAthleteHistory(athleteId);
    return formatPersonalBest(history);
  }

  if (toolName === 'get_my_volunteer_history') {
    if (!DEFAULT_ATHLETE_ID) {
      return 'PARKRUN_DEFAULT_ATHLETE_ID is not set. Please add it to your .env file.';
    }
    const summary = await scrapeAthleteVolunteerSummary(DEFAULT_ATHLETE_ID);
    return formatVolunteerSummary(summary);
  }

  if (toolName === 'get_volunteer_history') {
    const { athleteId } = z.object({ athleteId: z.string() }).parse(args);
    const summary = await scrapeAthleteVolunteerSummary(athleteId);
    return formatVolunteerSummary(summary);
  }

  throw new Error(`Unknown athlete tool: ${toolName}`);
}

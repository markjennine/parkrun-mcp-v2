import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { scrapeAthleteHistory, scrapeAthleteVolunteerSummary } from '../scraper/athlete.js';
import { scrapeResultsByDate } from '../scraper/event.js';

const DEFAULT_ATHLETE_ID = process.env.PARKRUN_DEFAULT_ATHLETE_ID ?? '';

function formatAthleteHistory(
  history: Awaited<ReturnType<typeof scrapeAthleteHistory>>,
  limit?: number,
  includeJunior = false
): string {
  const filtered = includeJunior ? history.runs : history.runs.filter((r) => !r.isJunior);
  const runs = limit ? filtered.slice(0, limit) : filtered;
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
  history: Awaited<ReturnType<typeof scrapeAthleteHistory>>,
  includeJunior = false,
  pbContext?: { position: number; fieldSize: number }
): string {
  const runs = includeJunior ? history.runs : history.runs.filter((r) => !r.isJunior);
  if (runs.length === 0) {
    return `No runs found for athlete ${history.athleteId}.`;
  }
  const best = runs.reduce((a, b) =>
    timeToSeconds(a.time) <= timeToSeconds(b.time) ? a : b
  );
  const lines = [
    `Athlete: ${history.name} (ID: ${history.athleteId})`,
    `Personal best: ${best.time}`,
    `Event: ${best.eventName}`,
    `Date: ${best.date}`,
  ];
  if (pbContext) {
    const fieldStr = pbContext.fieldSize > 0 ? ` of ${pbContext.fieldSize} finishers` : '';
    lines.push(`Position: ${pbContext.position}${fieldStr}`);
  }
  return lines.join('\n');
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
      'Get the run history for the configured default athlete. Returns recent adult parkrun results (5km events) including times, positions, and PBs. Junior parkruns are excluded by default.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of recent runs to return (default: 10)',
          minimum: 1,
          maximum: 500,
        },
        includeJunior: {
          type: 'boolean',
          description: 'Set to true to include junior parkrun (2km) results alongside adult results. Default: false.',
        },
      },
    },
  },
  {
    name: 'get_athlete_results',
    description:
      'Get the run history for any parkrun athlete by their numeric ID. Returns adult parkrun results (5km events) by default; junior parkruns excluded unless includeJunior is true.',
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
        includeJunior: {
          type: 'boolean',
          description: 'Set to true to include junior parkrun (2km) results alongside adult results. Default: false.',
        },
      },
      required: ['athleteId'],
    },
  },
  {
    name: 'get_my_personal_best',
    description:
      'Get the personal best (fastest) adult parkrun time for the configured default athlete, including finishing position and field size. Junior parkruns are excluded from the PB calculation by default.',
    inputSchema: {
      type: 'object',
      properties: {
        includeJunior: {
          type: 'boolean',
          description: 'Set to true to include junior parkrun results in the PB calculation. Default: false.',
        },
      },
    },
  },
  {
    name: 'get_personal_bests',
    description:
      'Get the personal best (fastest) adult parkrun time for any athlete by their numeric ID, including finishing position and field size. Junior parkruns are excluded from the PB calculation by default.',
    inputSchema: {
      type: 'object',
      properties: {
        athleteId: {
          type: 'string',
          description:
            'Numeric parkrun athlete ID (e.g. "1708821"). Same as barcode without the leading A.',
        },
        includeJunior: {
          type: 'boolean',
          description: 'Set to true to include junior parkrun results in the PB calculation. Default: false.',
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
  {
    name: 'get_my_club',
    description: 'Get the club affiliation for the configured default athlete, based on their most recent adult parkrun result.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_athlete_club',
    description: 'Get the club affiliation for any parkrun athlete by their numeric ID, based on their most recent adult parkrun result.',
    inputSchema: {
      type: 'object',
      properties: {
        athleteId: {
          type: 'string',
          description: 'Numeric parkrun athlete ID (e.g. "1708821"). Same as barcode without the leading A.',
        },
      },
      required: ['athleteId'],
    },
  },
];


async function getClubForAthlete(athleteId: string): Promise<string> {
  const history = await scrapeAthleteHistory(athleteId);
  const recentRun = history.runs.find((r) => !r.isJunior);

  if (!recentRun) {
    return `No adult parkrun results found for athlete ${athleteId}.`;
  }

  try {
    const eventResults = await scrapeResultsByDate(recentRun.eventSlug, recentRun.date);
    const finisher = eventResults.finishers.find((f) => f.athleteId === athleteId);

    if (!finisher) {
      return `Athlete ${athleteId} was not found in the finisher list for ${recentRun.eventName} on ${recentRun.date} (possible DNS/DNF).`;
    }

    const club = finisher.club.trim();
    return [
      `Athlete: ${history.name} (ID: ${athleteId})`,
      `Club: ${club || 'Unaffiliated'}`,
    ].join('\n');
  } catch {
    return `Could not retrieve results for ${recentRun.eventName} on ${recentRun.date} to determine club affiliation.`;
  }
}

export async function handleAthleteTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  if (toolName === 'get_my_results') {
    if (!DEFAULT_ATHLETE_ID) {
      return 'PARKRUN_DEFAULT_ATHLETE_ID is not set. Please add it to your .env file.';
    }
    const { limit, includeJunior } = z.object({ limit: z.number().optional(), includeJunior: z.boolean().optional() }).parse(args);
    const history = await scrapeAthleteHistory(DEFAULT_ATHLETE_ID);
    return formatAthleteHistory(history, limit ?? 10, includeJunior ?? false);
  }

  if (toolName === 'get_athlete_results') {
    const { athleteId, limit, includeJunior } = z
      .object({ athleteId: z.string(), limit: z.number().optional(), includeJunior: z.boolean().optional() })
      .parse(args);
    const history = await scrapeAthleteHistory(athleteId);
    return formatAthleteHistory(history, limit ?? 10, includeJunior ?? false);
  }

  if (toolName === 'get_my_personal_best') {
    if (!DEFAULT_ATHLETE_ID) {
      return 'PARKRUN_DEFAULT_ATHLETE_ID is not set. Please add it to your .env file.';
    }
    const { includeJunior } = z.object({ includeJunior: z.boolean().optional() }).parse(args);
    const history = await scrapeAthleteHistory(DEFAULT_ATHLETE_ID);
    const adultRuns = (includeJunior ?? false) ? history.runs : history.runs.filter((r) => !r.isJunior);
    const best = adultRuns.length > 0
      ? adultRuns.reduce((a, b) => (timeToSeconds(a.time) <= timeToSeconds(b.time) ? a : b))
      : null;
    let pbContext: { position: number; fieldSize: number } | undefined;
    if (best) {
      try {
        const eventResults = await scrapeResultsByDate(best.eventSlug, best.date);
        const finisher = eventResults.finishers.find((f) => f.athleteId === DEFAULT_ATHLETE_ID);
        pbContext = {
          position: finisher?.position ?? best.position,
          fieldSize: eventResults.finisherCount,
        };
      } catch {
        // If event results unavailable, fall back to position from history without field size
        pbContext = { position: best.position, fieldSize: 0 };
      }
    }
    return formatPersonalBest(history, includeJunior ?? false, pbContext ?? undefined);
  }

  if (toolName === 'get_personal_bests') {
    const { athleteId, includeJunior } = z.object({ athleteId: z.string(), includeJunior: z.boolean().optional() }).parse(args);
    const history = await scrapeAthleteHistory(athleteId);
    const adultRuns = (includeJunior ?? false) ? history.runs : history.runs.filter((r) => !r.isJunior);
    const best = adultRuns.length > 0
      ? adultRuns.reduce((a, b) => (timeToSeconds(a.time) <= timeToSeconds(b.time) ? a : b))
      : null;
    let pbContext: { position: number; fieldSize: number } | undefined;
    if (best) {
      try {
        const eventResults = await scrapeResultsByDate(best.eventSlug, best.date);
        const finisher = eventResults.finishers.find((f) => f.athleteId === athleteId);
        pbContext = {
          position: finisher?.position ?? best.position,
          fieldSize: eventResults.finisherCount,
        };
      } catch {
        pbContext = { position: best.position, fieldSize: 0 };
      }
    }
    return formatPersonalBest(history, includeJunior ?? false, pbContext ?? undefined);
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

  if (toolName === 'get_my_club') {
    if (!DEFAULT_ATHLETE_ID) {
      return 'PARKRUN_DEFAULT_ATHLETE_ID is not set. Please add it to your .env file.';
    }
    return getClubForAthlete(DEFAULT_ATHLETE_ID);
  }

  if (toolName === 'get_athlete_club') {
    const { athleteId } = z.object({ athleteId: z.string() }).parse(args);
    return getClubForAthlete(athleteId);
  }

  throw new Error(`Unknown athlete tool: ${toolName}`);
}

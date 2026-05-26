import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { scrapeAthleteHistory, scrapeAthleteVolunteerSummary } from '../scraper/athlete.js';
import { scrapeResultsByDate } from '../scraper/event.js';

const DEFAULT_ATHLETE_ID = process.env.PARKRUN_DEFAULT_ATHLETE_ID ?? '';

function toArray<T>(v: T | T[]): T[] {
  return Array.isArray(v) ? v : [v];
}

function formatAthleteHistory(
  history: Awaited<ReturnType<typeof scrapeAthleteHistory>>,
  limit?: number,
  includeJunior = false
): string {
  const filtered = includeJunior ? history.runs : history.runs.filter((r) => !r.isJunior);
  const runs = (limit ? filtered.slice(0, limit) : filtered).map((r) => ({
    date: r.date,
    eventName: r.eventName,
    eventSlug: r.eventSlug,
    time: r.time,
    position: r.position,
    isPB: r.isPB,
    runNumber: r.runNumber,
  }));
  return JSON.stringify(
    { athleteName: history.name, athleteId: history.athleteId, totalRuns: history.totalRuns, runs },
    null,
    2
  );
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
    return JSON.stringify({ athleteName: history.name, athleteId: history.athleteId, personalBest: null });
  }
  const best = runs.reduce((a, b) =>
    timeToSeconds(a.time) <= timeToSeconds(b.time) ? a : b
  );
  return JSON.stringify(
    {
      athleteName: history.name,
      athleteId: history.athleteId,
      personalBest: {
        time: best.time,
        eventName: best.eventName,
        eventSlug: best.eventSlug,
        date: best.date,
        position: pbContext?.position ?? best.position,
        fieldSize: pbContext?.fieldSize ?? 0,
      },
    },
    null,
    2
  );
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

const idOrIds = {
  oneOf: [
    { type: 'string' },
    { type: 'array', items: { type: 'string' }, minItems: 1 },
  ],
  description: 'Numeric parkrun athlete ID (e.g. "1708821"), or an array of IDs for batch lookup.',
} as const;

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
      'Get the run history for any parkrun athlete by their numeric ID. Pass an array of IDs for batch lookup. Returns adult parkrun results (5km events) by default; junior parkruns excluded unless includeJunior is true.',
    inputSchema: {
      type: 'object',
      properties: {
        athleteId: idOrIds,
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
      'Get the personal best (fastest) adult parkrun time for any athlete by their numeric ID, including finishing position and field size. Pass an array of IDs for batch lookup. Junior parkruns are excluded from the PB calculation by default.',
    inputSchema: {
      type: 'object',
      properties: {
        athleteId: idOrIds,
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
      'Get the volunteering history for any parkrun athlete by their numeric ID. Pass an array of IDs for batch lookup. Returns a summary of volunteer roles and total credits.',
    inputSchema: {
      type: 'object',
      properties: {
        athleteId: idOrIds,
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
    description: 'Get the club affiliation for any parkrun athlete by their numeric ID. Pass an array of IDs for batch lookup.',
    inputSchema: {
      type: 'object',
      properties: {
        athleteId: idOrIds,
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

async function getPersonalBestForAthlete(
  athleteId: string,
  includeJunior: boolean
): Promise<string> {
  const history = await scrapeAthleteHistory(athleteId);
  const adultRuns = includeJunior ? history.runs : history.runs.filter((r) => !r.isJunior);
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
  return formatPersonalBest(history, includeJunior, pbContext ?? undefined);
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
      .object({ athleteId: z.union([z.string(), z.array(z.string()).min(1)]), limit: z.number().optional(), includeJunior: z.boolean().optional() })
      .parse(args);
    const ids = toArray(athleteId);

    const settled = await Promise.all(
      ids.map(async (id) => {
        try {
          const history = await scrapeAthleteHistory(id);
          return { key: id, result: formatAthleteHistory(history, limit ?? 10, includeJunior ?? false), error: null };
        } catch (err) {
          return { key: id, result: null as string | null, error: err instanceof Error ? err.message : String(err) };
        }
      })
    );

    if (ids.length === 1) {
      const { result, error } = settled[0];
      if (error) return `Error fetching results for athlete ${ids[0]}: ${error}`;
      return result!;
    }

    return settled
      .map(({ key, result, error }) =>
        `=== ${key} ===\n${error ? `Error: ${error}` : result!}`
      )
      .join('\n\n');
  }

  if (toolName === 'get_my_personal_best') {
    if (!DEFAULT_ATHLETE_ID) {
      return 'PARKRUN_DEFAULT_ATHLETE_ID is not set. Please add it to your .env file.';
    }
    const { includeJunior } = z.object({ includeJunior: z.boolean().optional() }).parse(args);
    return getPersonalBestForAthlete(DEFAULT_ATHLETE_ID, includeJunior ?? false);
  }

  if (toolName === 'get_personal_bests') {
    const { athleteId, includeJunior } = z
      .object({ athleteId: z.union([z.string(), z.array(z.string()).min(1)]), includeJunior: z.boolean().optional() })
      .parse(args);
    const ids = toArray(athleteId);

    const settled = await Promise.all(
      ids.map(async (id) => {
        try {
          return { key: id, result: await getPersonalBestForAthlete(id, includeJunior ?? false), error: null };
        } catch (err) {
          return { key: id, result: null as string | null, error: err instanceof Error ? err.message : String(err) };
        }
      })
    );

    if (ids.length === 1) {
      const { result, error } = settled[0];
      if (error) return `Error fetching personal best for athlete ${ids[0]}: ${error}`;
      return result!;
    }

    return settled
      .map(({ key, result, error }) =>
        `=== ${key} ===\n${error ? `Error: ${error}` : result!}`
      )
      .join('\n\n');
  }

  if (toolName === 'get_my_volunteer_history') {
    if (!DEFAULT_ATHLETE_ID) {
      return 'PARKRUN_DEFAULT_ATHLETE_ID is not set. Please add it to your .env file.';
    }
    const summary = await scrapeAthleteVolunteerSummary(DEFAULT_ATHLETE_ID);
    return formatVolunteerSummary(summary);
  }

  if (toolName === 'get_volunteer_history') {
    const { athleteId } = z
      .object({ athleteId: z.union([z.string(), z.array(z.string()).min(1)]) })
      .parse(args);
    const ids = toArray(athleteId);

    const settled = await Promise.all(
      ids.map(async (id) => {
        try {
          const summary = await scrapeAthleteVolunteerSummary(id);
          return { key: id, result: formatVolunteerSummary(summary), error: null };
        } catch (err) {
          return { key: id, result: null as string | null, error: err instanceof Error ? err.message : String(err) };
        }
      })
    );

    if (ids.length === 1) {
      const { result, error } = settled[0];
      if (error) return `Error fetching volunteer history for athlete ${ids[0]}: ${error}`;
      return result!;
    }

    return settled
      .map(({ key, result, error }) =>
        `=== ${key} ===\n${error ? `Error: ${error}` : result!}`
      )
      .join('\n\n');
  }

  if (toolName === 'get_my_club') {
    if (!DEFAULT_ATHLETE_ID) {
      return 'PARKRUN_DEFAULT_ATHLETE_ID is not set. Please add it to your .env file.';
    }
    return getClubForAthlete(DEFAULT_ATHLETE_ID);
  }

  if (toolName === 'get_athlete_club') {
    const { athleteId } = z
      .object({ athleteId: z.union([z.string(), z.array(z.string()).min(1)]) })
      .parse(args);
    const ids = toArray(athleteId);

    const settled = await Promise.all(
      ids.map(async (id) => {
        try {
          return { key: id, result: await getClubForAthlete(id), error: null };
        } catch (err) {
          return { key: id, result: null as string | null, error: err instanceof Error ? err.message : String(err) };
        }
      })
    );

    if (ids.length === 1) {
      const { result, error } = settled[0];
      if (error) return `Error fetching club for athlete ${ids[0]}: ${error}`;
      return result!;
    }

    return settled
      .map(({ key, result, error }) =>
        `=== ${key} ===\n${error ? `Error: ${error}` : result!}`
      )
      .join('\n\n');
  }

  throw new Error(`Unknown athlete tool: ${toolName}`);
}

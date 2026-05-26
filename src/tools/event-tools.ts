import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  scrapeLatestResults,
  scrapeResultsByDate,
  scrapeEventHistory,
  scrapeVolunteerRoster,
} from '../scraper/event.js';
import type { EventResults } from '../types/parkrun.js';

const DEFAULT_EVENT = process.env.PARKRUN_DEFAULT_EVENT ?? '';

function toArray<T>(v: T | T[]): T[] {
  return Array.isArray(v) ? v : [v];
}

function formatResults(results: EventResults, limit = 10): string {
  const finishers = limit === 0 ? results.finishers : results.finishers.slice(0, limit);
  const heading = limit === 0 || limit >= results.finisherCount
    ? `All ${results.finisherCount} finishers:`
    : `Top ${limit} finishers:`;
  const lines = [
    `${results.eventName} — ${results.date} (Event #${results.eventNumber})`,
    `Finishers: ${results.finisherCount}  Volunteers: ${results.volunteerCount}`,
    '',
    heading,
    ...finishers.map(
      (f) =>
        `  ${String(f.position).padStart(3)}.  ${f.name.padEnd(25)}  ${f.time}  ${f.pbStatus ? `[${f.pbStatus}]  ` : ''}${f.athleteId ? `(ID: ${f.athleteId})` : ''}`
    ),
    '',
    'Volunteers:',
    ...results.volunteers.map((v) => `  ${v.role.padEnd(30)}  ${v.name.padEnd(25)}${v.athleteId ? `  (ID: ${v.athleteId})` : ''}`),
  ];
  return lines.join('\n');
}

const limitSchema = {
  type: 'number',
  description: 'Max finishers to return (default 10; use 0 for all).',
} as const;

const slugOrSlugsSchema = {
  oneOf: [
    { type: 'string' },
    { type: 'array', items: { type: 'string' }, minItems: 1 },
  ],
  description: 'Lowercase event slug, or an array of slugs for batch lookup.',
} as const;

export const eventTools: Tool[] = [
  {
    name: 'get_event_latest_results',
    description:
      'Get the most recent results for a named parkrun event, including finisher list and volunteers. Pass an array of slugs to batch-fetch multiple events.',
    inputSchema: {
      type: 'object',
      properties: {
        eventSlug: slugOrSlugsSchema,
        limit: limitSchema,
      },
      required: ['eventSlug'],
    },
  },
  {
    name: 'get_event_results_by_date',
    description: 'Get parkrun results for a specific event and date. Pass an array of slugs to fetch results for multiple events on the same date.',
    inputSchema: {
      type: 'object',
      properties: {
        eventSlug: slugOrSlugsSchema,
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format, e.g. "2026-05-23".',
        },
        limit: limitSchema,
      },
      required: ['eventSlug', 'date'],
    },
  },
  {
    name: 'get_event_history',
    description:
      'Get the full history of all past events for a parkrun location. Pass an array of slugs for batch lookup.',
    inputSchema: {
      type: 'object',
      properties: {
        eventSlug: slugOrSlugsSchema,
      },
      required: ['eventSlug'],
    },
  },
  {
    name: 'get_volunteer_roster',
    description:
      'Get the upcoming volunteer roster for a parkrun event. Pass an array of slugs for batch lookup.',
    inputSchema: {
      type: 'object',
      properties: {
        eventSlug: slugOrSlugsSchema,
      },
      required: ['eventSlug'],
    },
  },
  {
    name: 'find_athlete_id_by_name',
    description:
      'Search event results by runner name to find their athlete ID. Searches the latest results by default; pass a date (YYYY-MM-DD) to search a specific event.',
    inputSchema: {
      type: 'object',
      properties: {
        eventSlug: { type: 'string', description: 'Lowercase event slug, e.g. "frimleylodge".' },
        name: { type: 'string', description: 'Full or partial name to search for (case-insensitive).' },
        date: { type: 'string', description: 'Optional date YYYY-MM-DD; omit for latest results.' },
      },
      required: ['eventSlug', 'name'],
    },
  },
];

export async function handleEventTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  if (toolName === 'get_event_latest_results') {
    const { eventSlug, limit } = z
      .object({ eventSlug: z.union([z.string(), z.array(z.string()).min(1)]), limit: z.number().optional() })
      .parse(args);
    const slugs = toArray(eventSlug);

    const settled = await Promise.all(
      slugs.map(async (slug) => {
        try {
          return { key: slug, result: await scrapeLatestResults(slug), error: null };
        } catch (err) {
          return { key: slug, result: null as EventResults | null, error: err instanceof Error ? err.message : String(err) };
        }
      })
    );

    if (slugs.length === 1) {
      const { result, error } = settled[0];
      if (error) return `Error fetching results for ${slugs[0]}: ${error}`;
      return formatResults(result!, limit);
    }

    return settled
      .map(({ key, result, error }) =>
        `=== ${key} ===\n${error ? `Error: ${error}` : formatResults(result!, limit)}`
      )
      .join('\n\n');
  }

  if (toolName === 'get_event_results_by_date') {
    const { eventSlug, date, limit } = z
      .object({ eventSlug: z.union([z.string(), z.array(z.string()).min(1)]), date: z.string(), limit: z.number().optional() })
      .parse(args);
    const slugs = toArray(eventSlug);

    const settled = await Promise.all(
      slugs.map(async (slug) => {
        try {
          return { key: slug, result: await scrapeResultsByDate(slug, date), error: null };
        } catch (err) {
          return { key: slug, result: null as EventResults | null, error: err instanceof Error ? err.message : String(err) };
        }
      })
    );

    if (slugs.length === 1) {
      const { result, error } = settled[0];
      if (error) return `Error fetching results for ${slugs[0]} on ${date}: ${error}`;
      return formatResults(result!, limit);
    }

    return settled
      .map(({ key, result, error }) =>
        `=== ${key} ===\n${error ? `Error: ${error}` : formatResults(result!, limit)}`
      )
      .join('\n\n');
  }

  if (toolName === 'get_event_history') {
    const { eventSlug } = z
      .object({ eventSlug: z.union([z.string(), z.array(z.string()).min(1)]) })
      .parse(args);
    const slugs = toArray(eventSlug);

    const settled = await Promise.all(
      slugs.map(async (slug) => {
        try {
          return { key: slug, result: await scrapeEventHistory(slug), error: null };
        } catch (err) {
          return { key: slug, result: null as Awaited<ReturnType<typeof scrapeEventHistory>> | null, error: err instanceof Error ? err.message : String(err) };
        }
      })
    );

    if (slugs.length === 1) {
      const { key, result, error } = settled[0];
      if (error) return `Error fetching history for ${key}: ${error}`;
      const history = result!;
      const lines = [
        `Event history for ${key} (${history.length} events):`,
        ...history.slice(0, 20).map(
          (e) =>
            `  ${e.date}  Event #${e.eventNumber}  ${e.finisherCount} finishers  First: ${e.firstFinisherName} ${e.firstFinisherTime}`
        ),
      ];
      return lines.join('\n');
    }

    return settled
      .map(({ key, result, error }) => {
        if (error) return `=== ${key} ===\nError: ${error}`;
        const history = result!;
        const lines = [
          `=== ${key} ===`,
          `Event history for ${key} (${history.length} events):`,
          ...history.slice(0, 20).map(
            (e) =>
              `  ${e.date}  Event #${e.eventNumber}  ${e.finisherCount} finishers  First: ${e.firstFinisherName} ${e.firstFinisherTime}`
          ),
        ];
        return lines.join('\n');
      })
      .join('\n\n');
  }

  if (toolName === 'get_volunteer_roster') {
    const { eventSlug } = z
      .object({ eventSlug: z.union([z.string(), z.array(z.string()).min(1)]) })
      .parse(args);
    const slugs = toArray(eventSlug);

    const settled = await Promise.all(
      slugs.map(async (slug) => {
        try {
          return { key: slug, result: await scrapeVolunteerRoster(slug), error: null };
        } catch (err) {
          return { key: slug, result: null as Awaited<ReturnType<typeof scrapeVolunteerRoster>> | null, error: err instanceof Error ? err.message : String(err) };
        }
      })
    );

    if (slugs.length === 1) {
      const { key, result, error } = settled[0];
      if (error) return `Error fetching roster for ${key}: ${error}`;
      const roster = result!;
      if (roster.length === 0) return `No upcoming volunteer roster found for ${key}.`;
      const lines = [`Volunteer roster for ${key}:`];
      for (const entry of roster) {
        lines.push(`\n  ${entry.date}`);
        for (const slot of entry.roles) {
          lines.push(`    ${slot.role.padEnd(30)}  ${slot.name.padEnd(25)}${slot.athleteId ? `  (ID: ${slot.athleteId})` : ''}`);
        }
      }
      return lines.join('\n');
    }

    return settled
      .map(({ key, result, error }) => {
        if (error) return `=== ${key} ===\nError: ${error}`;
        const roster = result!;
        if (roster.length === 0) return `=== ${key} ===\nNo upcoming volunteer roster found for ${key}.`;
        const lines = [`=== ${key} ===`, `Volunteer roster for ${key}:`];
        for (const entry of roster) {
          lines.push(`\n  ${entry.date}`);
          for (const slot of entry.roles) {
            lines.push(`    ${slot.role.padEnd(30)}  ${slot.name.padEnd(25)}${slot.athleteId ? `  (ID: ${slot.athleteId})` : ''}`);
          }
        }
        return lines.join('\n');
      })
      .join('\n\n');
  }

  if (toolName === 'find_athlete_id_by_name') {
    const { eventSlug, name, date } = z
      .object({ eventSlug: z.string(), name: z.string(), date: z.string().optional() })
      .parse(args);
    const results = date
      ? await scrapeResultsByDate(eventSlug, date)
      : await scrapeLatestResults(eventSlug);
    const query = name.toLowerCase();
    const matches = results.finishers.filter((f) =>
      f.name.toLowerCase().includes(query)
    );
    if (matches.length === 0) {
      return `No runners matching "${name}" found in ${results.eventName} results for ${results.date}.`;
    }
    const lines = [
      `Runners matching "${name}" in ${results.eventName} — ${results.date}:`,
      ...matches.map(
        (f) =>
          `  ${String(f.position).padStart(3)}.  ${f.name.padEnd(25)}  ${f.time}  ${f.athleteId ? `(ID: ${f.athleteId})` : '(no ID)'}`
      ),
    ];
    return lines.join('\n');
  }

  throw new Error(`Unknown event tool: ${toolName}`);
}

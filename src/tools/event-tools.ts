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

function formatResults(results: EventResults): string {
  const lines = [
    `${results.eventName} — ${results.date} (Event #${results.eventNumber})`,
    `Finishers: ${results.finisherCount}  Volunteers: ${results.volunteerCount}`,
    '',
    'Top 10 finishers:',
    ...results.finishers.slice(0, 10).map(
      (f) =>
        `  ${String(f.position).padStart(3)}.  ${f.name.padEnd(25)}  ${f.time}  ${f.pbStatus ? `[${f.pbStatus}]  ` : ''}${f.athleteId ? `(ID: ${f.athleteId})` : ''}`
    ),
    '',
    'Volunteers:',
    ...results.volunteers.map((v) => `  ${v.role.padEnd(30)}  ${v.name.padEnd(25)}${v.athleteId ? `  (ID: ${v.athleteId})` : ''}`),
  ];
  return lines.join('\n');
}

export const eventTools: Tool[] = [
  {
    name: 'get_event_latest_results',
    description:
      'Get the most recent results for a named parkrun event, including finisher list and volunteers.',
    inputSchema: {
      type: 'object',
      properties: {
        eventSlug: {
          type: 'string',
          description:
            'Lowercase event slug, e.g. "frimleylodge", "bushy", "southwark".',
        },
      },
      required: ['eventSlug'],
    },
  },
  {
    name: 'get_event_results_by_date',
    description: 'Get parkrun results for a specific event and date.',
    inputSchema: {
      type: 'object',
      properties: {
        eventSlug: { type: 'string', description: 'Lowercase event slug.' },
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format, e.g. "2026-05-23".',
        },
      },
      required: ['eventSlug', 'date'],
    },
  },
  {
    name: 'get_event_history',
    description:
      'Get the full history of all past events for a parkrun location.',
    inputSchema: {
      type: 'object',
      properties: {
        eventSlug: { type: 'string', description: 'Lowercase event slug.' },
      },
      required: ['eventSlug'],
    },
  },
  {
    name: 'get_volunteer_roster',
    description:
      'Get the upcoming volunteer roster for a parkrun event.',
    inputSchema: {
      type: 'object',
      properties: {
        eventSlug: { type: 'string', description: 'Lowercase event slug.' },
      },
      required: ['eventSlug'],
    },
  },
];

export async function handleEventTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  if (toolName === 'get_event_latest_results') {
    const { eventSlug } = z.object({ eventSlug: z.string() }).parse(args);
    const results = await scrapeLatestResults(eventSlug);
    return formatResults(results);
  }

  if (toolName === 'get_event_results_by_date') {
    const { eventSlug, date } = z
      .object({ eventSlug: z.string(), date: z.string() })
      .parse(args);
    const results = await scrapeResultsByDate(eventSlug, date);
    return formatResults(results);
  }

  if (toolName === 'get_event_history') {
    const { eventSlug } = z.object({ eventSlug: z.string() }).parse(args);
    const history = await scrapeEventHistory(eventSlug);
    const lines = [
      `Event history for ${eventSlug} (${history.length} events):`,
      ...history.slice(0, 20).map(
        (e) =>
          `  ${e.date}  Event #${e.eventNumber}  ${e.finisherCount} finishers  First: ${e.firstFinisherName} ${e.firstFinisherTime}`
      ),
    ];
    return lines.join('\n');
  }

  if (toolName === 'get_volunteer_roster') {
    const { eventSlug } = z.object({ eventSlug: z.string() }).parse(args);
    const roster = await scrapeVolunteerRoster(eventSlug);
    if (roster.length === 0) return `No upcoming volunteer roster found for ${eventSlug}.`;
    const lines = [`Volunteer roster for ${eventSlug}:`];
    for (const entry of roster) {
      lines.push(`\n  ${entry.date}`);
      for (const slot of entry.roles) {
        lines.push(`    ${slot.role.padEnd(30)}  ${slot.name.padEnd(25)}${slot.athleteId ? `  (ID: ${slot.athleteId})` : ''}`);
      }
    }
    return lines.join('\n');
  }

  throw new Error(`Unknown event tool: ${toolName}`);
}

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { scrapeClubConsolidatedResults, scrapeClubMembers } from '../scraper/club.js';
import type { ClubConsolidatedResults, ClubMembersSummary } from '../types/parkrun.js';

function formatConsolidatedResults(results: ClubConsolidatedResults): string {
  const lines = [
    `Club ${results.clubNum} consolidated results — ${results.date}`,
    `Total runners: ${results.totalRunners} across ${results.eventGroups.length} event${results.eventGroups.length === 1 ? '' : 's'}`,
  ];

  for (const group of results.eventGroups) {
    lines.push('', `  ${group.eventName} (${group.results.length} runners):`);
    for (const r of group.results) {
      lines.push(
        `    ${String(r.position).padStart(4)}.  ${r.name.padEnd(25)}  ${r.time}`
      );
    }
  }

  return lines.join('\n');
}

function formatClubMembers(summary: ClubMembersSummary): string {
  const lines = [
    `${summary.clubName} at ${summary.eventSlug}`,
    `Members: ${summary.totalMembers}  Runs at this event: ${summary.totalRunsAtEvent}`,
    '',
    'Members:',
    ...summary.members.map(
      (m) =>
        `  ${m.name.padEnd(28)}  ${String(m.runsAtEvent).padStart(4)} here  ${String(m.totalRuns).padStart(4)} total` +
        (m.milestoneClub ? `  [${m.milestoneClub}]` : '')
    ),
  ];
  return lines.join('\n');
}

export const clubTools: Tool[] = [
  {
    name: 'get_club_results',
    description:
      'Get consolidated parkrun results for a club on a specific date, showing all club members ' +
      'who ran that day across every event worldwide.',
    inputSchema: {
      type: 'object',
      properties: {
        clubNum: {
          type: 'string',
          description: 'Numeric club ID (e.g. "1276" for Windle Valley Runners).',
        },
        eventDate: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format, e.g. "2026-05-16".',
        },
      },
      required: ['clubNum', 'eventDate'],
    },
  },
  {
    name: 'get_club_members',
    description:
      'Get a summary of all club members who have run at a specific parkrun event, including their ' +
      'run counts at that event and total parkrun runs.',
    inputSchema: {
      type: 'object',
      properties: {
        eventSlug: {
          type: 'string',
          description: 'Lowercase event slug, e.g. "frimleylodge".',
        },
        clubNum: {
          type: 'string',
          description: 'Numeric club ID (e.g. "1276" for Windle Valley Runners).',
        },
      },
      required: ['eventSlug', 'clubNum'],
    },
  },
];

export async function handleClubTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  if (toolName === 'get_club_results') {
    const { clubNum, eventDate } = z
      .object({ clubNum: z.string(), eventDate: z.string() })
      .parse(args);
    const results = await scrapeClubConsolidatedResults(clubNum, eventDate);
    if (results.totalRunners === 0) {
      return `No results found for club ${clubNum} on ${eventDate}.`;
    }
    return formatConsolidatedResults(results);
  }

  if (toolName === 'get_club_members') {
    const { eventSlug, clubNum } = z
      .object({ eventSlug: z.string(), clubNum: z.string() })
      .parse(args);
    const summary = await scrapeClubMembers(eventSlug, clubNum);
    if (summary.members.length === 0) {
      return `No club members found for club ${clubNum} at ${eventSlug}.`;
    }
    return formatClubMembers(summary);
  }

  throw new Error(`Unknown club tool: ${toolName}`);
}

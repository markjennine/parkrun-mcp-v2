import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { searchEventByName, findNearestEvents } from '../scraper/location.js';
import type { ParkrunEvent } from '../types/parkrun.js';

function eventPageUrl(slug: string): string {
  return `https://www.parkrun.org.uk/${slug}/`;
}

function mapUrl(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

function formatEventLocation(e: ParkrunEvent): string {
  return [
    `Event: ${e.longName}`,
    `Slug: ${e.eventSlug}`,
    `Location: ${e.location}`,
    `Coordinates: ${e.latitude}, ${e.longitude}`,
    `Map: ${mapUrl(e.latitude, e.longitude)}`,
    `Event page: ${eventPageUrl(e.eventSlug)}`,
  ].join('\n');
}

export const locationTools: Tool[] = [
  {
    name: 'search_event_location',
    description:
      'Search for a parkrun event by name and retrieve its location coordinates and map URL. ' +
      'Accepts a partial event name, slug, or location description.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Event name or partial name to search for (e.g. "frimleylodge", "Bushy", "Wigan").',
        },
        includeJunior: {
          type: 'boolean',
          description: 'Include junior parkrun events (2km, held on Sunday mornings) in results. Defaults to false.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_nearest_events',
    description:
      'Find the nearest parkrun events to a given latitude/longitude. ' +
      'Use this when the user asks "what is the nearest parkrun to [place]" — ' +
      'resolve the place name to coordinates first, then call this tool.',
    inputSchema: {
      type: 'object',
      properties: {
        latitude: {
          type: 'number',
          description: 'Latitude of the reference location.',
        },
        longitude: {
          type: 'number',
          description: 'Longitude of the reference location.',
        },
        limit: {
          type: 'number',
          description: 'Number of nearest events to return (default: 5, max: 20).',
          minimum: 1,
          maximum: 20,
        },
        includeJunior: {
          type: 'boolean',
          description: 'Include junior parkrun events (2km, held on Sunday mornings) in results. Defaults to false.',
        },
      },
      required: ['latitude', 'longitude'],
    },
  },
];

export async function handleLocationTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  if (toolName === 'search_event_location') {
    const { query, includeJunior } = z.object({ query: z.string(), includeJunior: z.boolean().optional() }).parse(args);
    const results = await searchEventByName(query, includeJunior ?? false);
    if (results.length === 0) {
      return `No parkrun events found matching "${query}".`;
    }
    if (results.length === 1) {
      return formatEventLocation(results[0]);
    }
    const lines = [`Found ${results.length} matching events:\n`];
    for (const e of results.slice(0, 10)) {
      lines.push(formatEventLocation(e));
      lines.push('');
    }
    if (results.length > 10) {
      lines.push(`... and ${results.length - 10} more. Refine your search for fewer results.`);
    }
    return lines.join('\n');
  }

  if (toolName === 'get_nearest_events') {
    const { latitude, longitude, limit, includeJunior } = z
      .object({
        latitude: z.number(),
        longitude: z.number(),
        limit: z.number().min(1).max(20).optional(),
        includeJunior: z.boolean().optional(),
      })
      .parse(args);
    const results = await findNearestEvents(latitude, longitude, limit ?? 5, includeJunior ?? false);
    const lines = [`Nearest parkrun events to ${latitude.toFixed(4)}, ${longitude.toFixed(4)}:\n`];
    for (const { event: e, distanceKm } of results) {
      lines.push(`${e.longName} — ${distanceKm.toFixed(1)} km`);
      lines.push(`  Location: ${e.location}`);
      lines.push(`  Event page: ${eventPageUrl(e.eventSlug)}`);
      lines.push(`  Map: ${mapUrl(e.latitude, e.longitude)}`);
      lines.push('');
    }
    return lines.join('\n').trimEnd();
  }

  throw new Error(`Unknown location tool: ${toolName}`);
}

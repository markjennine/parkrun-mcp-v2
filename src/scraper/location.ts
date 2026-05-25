import axios from 'axios';
import type { ParkrunEvent } from '../types/parkrun.js';

const EVENTS_URL = 'https://images.parkrun.com/events.json';

let cachedEvents: ParkrunEvent[] | null = null;

async function fetchAllEvents(): Promise<ParkrunEvent[]> {
  if (cachedEvents) return cachedEvents;

  const { data } = await axios.get<{ events: { features: unknown[] } }>(EVENTS_URL, {
    timeout: 15_000,
    headers: { 'User-Agent': 'parkrun-mcp/1.0' },
  });

  cachedEvents = (data.events.features as Array<{
    id: number;
    geometry: { coordinates: [number, number] };
    properties: {
      eventname: string;
      EventLongName: string;
      EventShortName: string;
      EventLocation: string;
      countrycode: number;
    };
  }>).map((f) => ({
    id: f.id,
    eventSlug: f.properties.eventname,
    longName: f.properties.EventLongName,
    shortName: f.properties.EventShortName,
    location: f.properties.EventLocation,
    longitude: f.geometry.coordinates[0],
    latitude: f.geometry.coordinates[1],
    countryCode: f.properties.countrycode,
    isJunior: f.properties.eventname.includes('junior'),
  }));

  return cachedEvents;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function searchEventByName(query: string, includeJunior = false): Promise<ParkrunEvent[]> {
  const events = await fetchAllEvents();
  const q = query.toLowerCase().trim();
  const pool = includeJunior ? events : events.filter((e) => !e.isJunior);
  return pool.filter(
    (e) =>
      e.eventSlug.includes(q) ||
      e.longName.toLowerCase().includes(q) ||
      e.shortName.toLowerCase().includes(q) ||
      e.location.toLowerCase().includes(q)
  );
}

export async function findNearestEvents(
  latitude: number,
  longitude: number,
  limit: number,
  includeJunior = false
): Promise<Array<{ event: ParkrunEvent; distanceKm: number }>> {
  const events = await fetchAllEvents();
  const pool = includeJunior ? events : events.filter((e) => !e.isJunior);
  return pool
    .map((event) => ({
      event,
      distanceKm: haversineKm(latitude, longitude, event.latitude, event.longitude),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

import * as cheerio from 'cheerio';
import http from './http.js';
import type {
  EventResults,
  EventHistoryEntry,
  VolunteerRosterDate,
  Finisher,
  Volunteer,
} from '../types/parkrun.js';

/** Parse the shared results page HTML into an EventResults object. */
function parseResultsPage(
  html: string,
  eventSlug: string
): EventResults {
  const $ = cheerio.load(html);

  // Event name and date from page header
  const headerText = $('h1, h2').first().text().trim();
  const eventName = headerText.split('\n')[0].trim();

  // Date: parkrun sets a <span class="format-date"> or the URL contains it
  const dateSpan = $('[class*="date"]').first().text().trim();
  // Fallback: extract from canonical link
  const canonical = $('link[rel="canonical"]').attr('href') ?? '';
  const dateMatch = canonical.match(/(\d{4}-\d{2}-\d{2})/);
  const date = dateSpan || (dateMatch ? dateMatch[1] : '');

  // Event number from text like "Event 778"
  const eventNumMatch = $('body').text().match(/[Ee]vent\s+#?(\d+)/);
  const eventNumber = eventNumMatch ? parseInt(eventNumMatch[1], 10) : 0;

  // Finishers table
  const finishers: Finisher[] = [];
  $('#results tbody tr').each((_i, row) => {
    const cells = $(row).find('td');
    if (cells.length < 10) return;

    const position = parseInt(cells.eq(0).text().trim(), 10) || 0;
    const nameLink = cells.eq(1).find('a');
    const name = nameLink.text().trim();
    const href = nameLink.attr('href') ?? '';
    const idMatch = href.match(/(\d+)$/);
    const athleteId = idMatch ? idMatch[1] : '';
    const totalFinishes = parseInt(cells.eq(2).text().trim(), 10) || 0;

    const genderText = cells.eq(3).text().trim(); // e.g. "Male 12/366"
    const genderParts = genderText.split(' ');
    const gender = genderParts[0] ?? '';
    const genderPos = parseInt((genderParts[1] ?? '0').split('/')[0], 10) || 0;

    const milestones: string[] = [];
    cells.eq(4).find('img, span').each((_j, el) => {
      const alt = $(el).attr('alt') ?? $(el).text();
      if (alt) milestones.push(alt.trim());
    });

    const ageGroup = cells.eq(5).text().trim();
    const ageGrade = parseFloat(cells.eq(6).text().replace('%', '').trim()) || 0;
    const club = cells.eq(7).find('a').text().trim() || cells.eq(7).text().trim();
    const time = cells.eq(8).text().trim();
    const pbStatus = cells.eq(9).text().trim();
    const isFirstTimer = cells.eq(10)?.text().toLowerCase().includes('first') ?? false;

    if (name) {
      finishers.push({
        position, name, athleteId, totalFinishes, gender,
        genderPosition: genderPos, milestones, ageGroup, ageGrade,
        club, time, pbStatus, isFirstTimer,
      });
    }
  });

  // Volunteers table (second #results table or a table further down)
  const volunteers: Volunteer[] = [];
  $('table').each((_i, table) => {
    const rows = $(table).find('tbody tr');
    // Identify the volunteer table by header text containing "Volunteer"
    const headerRow = $(table).find('thead th').first().text().toLowerCase();
    if (!headerRow.includes('volunteer') && !headerRow.includes('role')) return;
    rows.each((_j, row) => {
      const cells = $(row).find('td');
      if (cells.length < 2) return;
      const nameLink = cells.eq(0).find('a');
      const name = nameLink.text().trim();
      const href = nameLink.attr('href') ?? '';
      const idMatch = href.match(/(\d+)$/);
      const athleteId = idMatch ? idMatch[1] : '';
      const role = cells.eq(1).text().trim();
      if (name) volunteers.push({ name, athleteId, role });
    });
  });

  return {
    eventName,
    eventSlug,
    date,
    eventNumber,
    finisherCount: finishers.length,
    volunteerCount: volunteers.length,
    finishers,
    volunteers,
  };
}

/** Latest results for an event (follows the /latestresults/ redirect). */
export async function scrapeLatestResults(
  eventSlug: string
): Promise<EventResults> {
  const { data: html } = await http.get<string>(
    `/${eventSlug}/results/latestresults/`
  );
  return parseResultsPage(html, eventSlug);
}

/** Results for a specific date. */
export async function scrapeResultsByDate(
  eventSlug: string,
  date: string // YYYY-MM-DD
): Promise<EventResults> {
  const { data: html } = await http.get<string>(
    `/${eventSlug}/results/${date}/`
  );
  return parseResultsPage(html, eventSlug);
}

/** Index of all past events for an event. */
export async function scrapeEventHistory(
  eventSlug: string
): Promise<EventHistoryEntry[]> {
  const { data: html } = await http.get<string>(
    `/${eventSlug}/results/eventhistory/`
  );
  const $ = cheerio.load(html);
  const entries: EventHistoryEntry[] = [];

  $('table tbody tr').each((_i, row) => {
    const cells = $(row).find('td');
    if (cells.length < 4) return;
    const date = cells.eq(0).text().trim();
    const eventNumText = cells.eq(1).text().trim();
    const eventNumber = parseInt(eventNumText.replace('#', ''), 10) || 0;
    const finisherCount = parseInt(cells.eq(2).text().trim(), 10) || 0;
    const firstFinisherName = cells.eq(3).find('a').text().trim() || cells.eq(3).text().trim();
    const firstFinisherTime = cells.eq(4)?.text().trim() ?? '';
    if (date) {
      entries.push({ date, eventNumber, finisherCount, firstFinisherName, firstFinisherTime });
    }
  });

  return entries;
}

/** Upcoming volunteer roster for an event. */
export async function scrapeVolunteerRoster(
  eventSlug: string
): Promise<VolunteerRosterDate[]> {
  const { data: html } = await http.get<string>(
    `/${eventSlug}/volunteer/futureroster/`
  );
  const $ = cheerio.load(html);
  const roster: VolunteerRosterDate[] = [];

  // Roster page groups volunteer slots by date
  $('table tbody tr').each((_i, row) => {
    const cells = $(row).find('td');
    if (cells.length < 2) return;
    const date = cells.eq(0).text().trim();
    const role = cells.eq(1).text().trim();
    const name = cells.eq(2)?.text().trim() ?? 'Unfilled';
    if (!date) return;
    const existing = roster.find((r) => r.date === date);
    if (existing) {
      existing.roles.push({ role, name });
    } else {
      roster.push({ date, roles: [{ role, name }] });
    }
  });

  return roster;
}

import * as cheerio from 'cheerio';
import http from './http';
import type {
  EventResults,
  EventHistoryEntry,
  VolunteerRosterDate,
  Finisher,
  Volunteer,
} from '../types/parkrun';

/** Parse the shared results page HTML into an EventResults object. */
function parseResultsPage(
  html: string,
  eventSlug: string
): EventResults {
  const $ = cheerio.load(html);

  const eventName = $('h1').first().text().trim();

  // Date is in <span class="format-date">2026-05-23</span>
  const date = $('.format-date').first().text().trim();

  // Event number from text like "Event 778"
  const eventNumMatch = $('body').text().match(/[Ee]vent\s+#?(\d+)/);
  const eventNumber = eventNumMatch ? parseInt(eventNumMatch[1], 10) : 0;

  // Finishers: each <tr class="Results-table-row"> has data-* attributes
  const finishers: Finisher[] = [];
  $('tr.Results-table-row').each((_i, row) => {
    const $row = $(row);
    const name = $row.attr('data-name') ?? '';
    if (!name) return;

    const position = parseInt($row.attr('data-position') ?? '0', 10) || 0;
    const gender = $row.attr('data-gender') ?? '';
    const totalFinishes = parseInt($row.attr('data-runs') ?? '0', 10) || 0;
    const ageGroup = $row.attr('data-agegroup') ?? '';
    const club = $row.attr('data-club') ?? '';
    const ageGradeStr = ($row.attr('data-agegrade') ?? '').replace('%', '');
    const ageGrade = parseFloat(ageGradeStr) || 0;
    const pbStatus = $row.attr('data-achievement') ?? '';

    const nameLink = $row.find('.Results-table-td--name a').first();
    const href = nameLink.attr('href') ?? '';
    const idMatch = href.match(/(\d+)$/);
    const athleteId = idMatch ? idMatch[1] : '';

    const time = $row.find('.Results-table-td--time .compact').text().trim();

    finishers.push({
      position, name, athleteId, totalFinishes, gender,
      genderPosition: 0, milestones: [], ageGroup, ageGrade,
      club, time, pbStatus, isFirstTimer: false,
    });
  });

  // Volunteers: each <tr class="Volunteers-table-row"> has data-* attributes
  const volunteers: Volunteer[] = [];
  $('tr.Volunteers-table-row').each((_i, row) => {
    const $row = $(row);
    const name = $row.attr('data-name') ?? '';
    if (!name) return;
    const role = ($row.attr('data-role') ?? '').replace(/,$/, '').trim();
    const nameLink = $row.find('a').first();
    const href = nameLink.attr('href') ?? '';
    const idMatch = href.match(/(\d+)$/);
    const athleteId = idMatch ? idMatch[1] : '';
    volunteers.push({ name, athleteId, role });
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
    const nameCell = cells.eq(2);
    const nameLink = nameCell.find('a').first();
    const href = nameLink.attr('href') ?? '';
    const idMatch = href.match(/(\d+)$/);
    const athleteId = idMatch ? idMatch[1] : undefined;
    const name = nameCell.text().trim() || 'Unfilled';
    if (!date) return;
    const existing = roster.find((r) => r.date === date);
    if (existing) {
      existing.roles.push({ role, name, athleteId });
    } else {
      roster.push({ date, roles: [{ role, name, athleteId }] });
    }
  });

  return roster;
}

import axios from 'axios';
import * as cheerio from 'cheerio';

import http from './http';
import type {
  ClubConsolidatedResults,
  ClubMembersSummary,
  ClubMember,
} from '../types/parkrun';

// parkrun.com (global) hosts the consolidated club results endpoint
const httpGlobal = axios.create({
  baseURL: 'https://www.parkrun.com',
  timeout: 10_000,
  maxRedirects: 5,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/124.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9',
  },
});

/**
 * Scrape consolidated club results across all events for a given date.
 * URL: https://www.parkrun.com/results/consolidatedclub/?clubNum={clubNum}&eventdate={YYYY-MM-DD}
 */
export async function scrapeClubConsolidatedResults(
  clubNum: string,
  eventDate: string
): Promise<ClubConsolidatedResults> {
  const { data: html } = await httpGlobal.get<string>(
    `/results/consolidatedclub/?clubNum=${clubNum}&eventdate=${eventDate}`
  );
  const $ = cheerio.load(html);

  const eventGroups: ClubConsolidatedResults['eventGroups'] = [];
  let currentEventName = '';

  $('h2, table.sortable').each((_i, el) => {
    const tagName = (el as unknown as { tagName?: string }).tagName?.toLowerCase();
    if (tagName === 'h2') {
      currentEventName = $(el).text().trim();
      return;
    }
    if (tagName !== 'table' || !currentEventName) return;

    const results: ClubConsolidatedResults['eventGroups'][number]['results'] = [];
    $(el).find('tbody tr, tr').each((_j, row) => {
      const cells = $(row).find('td');
      if (cells.length < 5) return;

      const position = parseInt(cells.eq(0).text().trim(), 10) || 0;
      const genderPosition = parseInt(cells.eq(1).text().trim(), 10) || 0;

      const nameLink = cells.eq(2).find('a').first();
      const name = nameLink.text().trim();
      if (!name) return;

      const href = nameLink.attr('href') ?? '';
      const idMatch = href.match(/\/(\d+)$/);
      const athleteId = idMatch ? idMatch[1] : '';

      const club = cells.eq(3).find('a').text().trim() || cells.eq(3).text().trim();
      const time = cells.eq(4).text().trim();

      results.push({ position, genderPosition, name, athleteId, club, time });
    });

    if (results.length > 0) {
      eventGroups.push({ eventName: currentEventName, results });
      currentEventName = '';
    }
  });

  const totalRunners = eventGroups.reduce((sum, g) => sum + g.results.length, 0);
  return { clubNum, date: eventDate, eventGroups, totalRunners };
}

/**
 * Scrape club members summary at a specific event.
 * URL: https://www.parkrun.org.uk/{eventSlug}/groups/{clubNum}/
 */
export async function scrapeClubMembers(
  eventSlug: string,
  clubNum: string
): Promise<ClubMembersSummary> {
  const { data: html } = await http.get<string>(
    `/${eventSlug}/groups/${clubNum}/`
  );
  const $ = cheerio.load(html);

  const h2Text = $('h2').first().text().trim();
  const clubNameMatch = h2Text.match(/^(.+?) at /);
  const clubName = clubNameMatch ? clubNameMatch[1].trim() : h2Text.split('\n')[0].trim();

  const totalMembersMatch = h2Text.match(/(\d+)\s+parkrunners/);
  const totalRunsAtEventMatch = h2Text.match(/(\d+)\s+parkruns/);
  const totalMembers = totalMembersMatch ? parseInt(totalMembersMatch[1], 10) : 0;
  const totalRunsAtEvent = totalRunsAtEventMatch ? parseInt(totalRunsAtEventMatch[1], 10) : 0;

  const members: ClubMember[] = [];

  $('table#results tbody tr').each((_i, row) => {
    const cells = $(row).find('td');
    if (cells.length < 3) return;

    const nameLink = cells.eq(0).find('a').first();
    const name = nameLink.text().trim();
    if (!name) return;

    const href = nameLink.attr('href') ?? '';
    const idMatch = href.match(/(\d+)$/);
    const athleteId = idMatch ? idMatch[1] : '';

    const runsAtEvent = parseInt(cells.eq(2).text().trim(), 10) || 0;
    const totalRuns = parseInt(cells.eq(3).text().trim(), 10) || 0;

    const badgeSrc = cells.eq(4).find('img').attr('src') ?? '';
    const milestoneMatch = badgeSrc.match(/\/(\d+)_club_mini/);
    const milestoneClub = milestoneMatch ? milestoneMatch[1] + ' club' : '';

    members.push({ name, athleteId, runsAtEvent, totalRuns, milestoneClub });
  });

  const totalRunsOverall = members.reduce((sum, m) => sum + m.totalRuns, 0);

  return {
    clubName,
    eventSlug,
    totalMembers,
    totalRunsAtEvent,
    totalRunsOverall,
    members,
  };
}

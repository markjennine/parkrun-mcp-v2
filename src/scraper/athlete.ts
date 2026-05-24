import * as cheerio from 'cheerio';
import http from './http.js';
import type {
  AthleteHistory,
  RunRecord,
  EventSummaryEntry,
} from '../types/parkrun.js';

/**
 * Scrape full run history for an athlete.
 * URL: https://www.parkrun.org.uk/parkrunner/{athleteId}/all/
 */
export async function scrapeAthleteHistory(
  athleteId: string
): Promise<AthleteHistory> {
  const url = `/parkrunner/${athleteId}/all/`;
  const { data: html } = await http.get<string>(url);
  const $ = cheerio.load(html);

  // Runner name — typically in an <h2> or page <title>
  const name =
    $('h2.Athletics-profile--name').first().text().trim() ||
    $('h2').first().text().trim() ||
    $('title').text().split('|')[0].trim();

  // Run history table
  const runs: RunRecord[] = [];
  $('table#results tbody tr').each((_i, row) => {
    const cells = $(row).find('td');
    if (cells.length < 9) return;

    const date = cells.eq(0).text().trim();
    const eventLink = cells.eq(1).find('a');
    const eventName = eventLink.text().trim();
    const eventHref = eventLink.attr('href') ?? '';
    const eventSlug = eventHref.split('/').filter(Boolean)[0] ?? '';
    const time = cells.eq(2).text().trim();
    const position = parseInt(cells.eq(3).text().trim(), 10) || 0;
    const genderPosition = parseInt(cells.eq(4).text().trim(), 10) || 0;
    const ageGrade = parseFloat(cells.eq(5).text().replace('%', '').trim()) || 0;
    const pbCell = cells.eq(6).text().trim().toLowerCase();
    const isPB = pbCell.includes('pb') || pbCell.includes('best');
    const runNumber = parseInt(cells.eq(7).text().trim(), 10) || 0;

    if (date && eventName) {
      runs.push({ date, eventName, eventSlug, time, position, genderPosition, ageGrade, isPB, runNumber });
    }
  });

  const totalRuns = runs.length;

  // Event summary table (second table on page)
  const eventSummary: EventSummaryEntry[] = [];
  $('table').eq(1).find('tbody tr').each((_i, row) => {
    const cells = $(row).find('td');
    if (cells.length < 4) return;
    const eventLink = cells.eq(0).find('a');
    const eventName = eventLink.text().trim();
    const eventHref = eventLink.attr('href') ?? '';
    const eventSlug = eventHref.split('/').filter(Boolean)[0] ?? '';
    const runCount = parseInt(cells.eq(1).text().trim(), 10) || 0;
    const bestTime = cells.eq(2).text().trim();
    const firstRunDate = cells.eq(3).text().trim();
    if (eventName) {
      eventSummary.push({ eventName, eventSlug, runCount, bestTime, firstRunDate });
    }
  });

  return { athleteId, name, totalRuns, runs, eventSummary };
}

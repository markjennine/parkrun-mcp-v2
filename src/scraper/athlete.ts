import * as cheerio from 'cheerio';
import http from './http';
import type {
  AthleteHistory,
  RunRecord,
  EventSummaryEntry,
} from '../types/parkrun';

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

  // Name is in <h2>Mark THOMAS <span>(A1708821)</span></h2>
  // Extract just the text node before the span (the actual name)
  const nameRaw = $('h2').first().contents().filter((_i, el) => el.type === 'text').first().text().trim();
  const name = nameRaw || $('h2').first().text().replace(/\(A?\d+\)/g, '').trim();

  // Run history is in the table captioned "All Results"
  // Columns: Event(0), Run Date(1), Run Number/Event#(2), Pos(3), Time(4), Age Grade(5), PB?(6)
  const runs: RunRecord[] = [];

  const allResultsTable = $('table').filter((_i, el) => {
    const captionText = $(el).find('caption').text();
    return captionText.includes('All') && captionText.includes('Results');
  }).first();

  allResultsTable.find('tbody tr').each((_i, row) => {
    const cells = $(row).find('td');
    if (cells.length < 6) return;

    const eventLink = cells.eq(0).find('a');
    const eventName = eventLink.text().trim();
    const eventHref = eventLink.attr('href') ?? '';
    const eventSlug = eventHref.replace('https://www.parkrun.org.uk/', '').split('/').filter(Boolean)[0] ?? '';

    const dateEl = cells.eq(1).find('.format-date');
    const dateRaw = dateEl.text().trim() || cells.eq(1).text().trim();
    // Convert DD/MM/YYYY to YYYY-MM-DD
    const dateParts = dateRaw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    const date = dateParts ? `${dateParts[3]}-${dateParts[2]}-${dateParts[1]}` : dateRaw;

    const runNumber = parseInt(cells.eq(2).text().trim(), 10) || 0;
    const position = parseInt(cells.eq(3).text().trim(), 10) || 0;
    const time = cells.eq(4).text().trim();
    const ageGrade = parseFloat(cells.eq(5).text().replace('%', '').trim()) || 0;
    const pbText = (cells.length > 6 ? cells.eq(6).text() : '').trim().toLowerCase();
    const isPB = pbText.includes('pb') || pbText.includes('best') || pbText === 'yes';

    if (date && eventName) {
      runs.push({ date, eventName, eventSlug, time, position, genderPosition: 0, ageGrade, isPB, runNumber });
    }
  });

  const totalRuns = runs.length;
  const eventSummary: EventSummaryEntry[] = [];

  return { athleteId, name, totalRuns, runs, eventSummary };
}

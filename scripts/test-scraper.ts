#!/usr/bin/env ts-node
/**
 * Standalone validation script — run before building the MCP server.
 * Tests every scraper against live parkrun.org.uk URLs.
 *
 * Usage: npx ts-node scripts/test-scraper.ts
 * Exit code: 0 = all pass, 1 = at least one failure.
 */

import 'dotenv/config';
import { scrapeAthleteHistory, scrapeAthleteVolunteerSummary } from '../src/scraper/athlete';
import {
  scrapeLatestResults,
  scrapeResultsByDate,
  scrapeEventHistory,
  scrapeVolunteerRoster,
} from '../src/scraper/event';

const ATHLETE_ID = '1708821';
const EVENT_SLUG = 'frimleylodge';
const EXPECTED_NAME = 'Mark Thomas';
const TEST_DATE = '2026-05-23';

let failures = 0;

async function test(
  label: string,
  fn: () => Promise<void>
): Promise<void> {
  process.stdout.write(`\n[TEST] ${label} ... `);
  try {
    await fn();
    process.stdout.write('PASS\n');
  } catch (err) {
    process.stdout.write(`FAIL\n  ${err}\n`);
    failures++;
  }
}

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

async function run(): Promise<void> {
  await test('scrapeAthleteHistory', async () => {
    const history = await scrapeAthleteHistory(ATHLETE_ID);
    assert(history.name.toLowerCase().includes(EXPECTED_NAME.toLowerCase()), `name should contain "${EXPECTED_NAME}", got "${history.name}"`);
    assert(history.totalRuns > 0, `totalRuns should be > 0, got ${history.totalRuns}`);
    assert(history.runs.length > 0, 'runs array should not be empty');
    console.log(`  -> ${history.name}, ${history.totalRuns} total runs`);
  });

  await test('scrapeLatestResults', async () => {
    const results = await scrapeLatestResults(EVENT_SLUG);
    assert(results.finisherCount > 0, `finisherCount should be > 0, got ${results.finisherCount}`);
    assert(results.date !== '', 'date should not be empty');
    console.log(`  -> ${results.eventName} ${results.date}, ${results.finisherCount} finishers`);
  });

  await test('scrapeResultsByDate', async () => {
    const results = await scrapeResultsByDate(EVENT_SLUG, TEST_DATE);
    assert(results.finisherCount > 0, `finisherCount should be > 0, got ${results.finisherCount}`);
    assert(results.date.includes('2026'), `date should contain 2026, got ${results.date}`);
    console.log(`  -> ${results.date}, ${results.finisherCount} finishers`);
  });

  await test('scrapeEventHistory', async () => {
    const history = await scrapeEventHistory(EVENT_SLUG);
    assert(history.length > 0, `history should not be empty, got ${history.length}`);
    console.log(`  -> ${history.length} past events`);
  });

  await test('scrapeVolunteerRoster', async () => {
    const roster = await scrapeVolunteerRoster(EVENT_SLUG);
    // Roster may be empty if no future events are scheduled
    console.log(`  -> ${roster.length} upcoming dates in roster`);
  });

  await test('scrapeAthleteVolunteerSummary', async () => {
    const summary = await scrapeAthleteVolunteerSummary(ATHLETE_ID);
    assert(summary.name.toLowerCase().includes(EXPECTED_NAME.toLowerCase()), `name should contain "${EXPECTED_NAME}", got "${summary.name}"`);
    assert(summary.totalCredits > 0, `totalCredits should be > 0, got ${summary.totalCredits}`);
    assert(summary.roles.length > 0, 'roles array should not be empty');
    console.log(`  -> ${summary.name}, ${summary.totalCredits} volunteer credits, ${summary.roles.length} roles`);
  });

  console.log(`\n${'='.repeat(50)}`);
  if (failures === 0) {
    console.log('All tests passed ✅');
  } else {
    console.log(`${failures} test(s) FAILED ❌`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

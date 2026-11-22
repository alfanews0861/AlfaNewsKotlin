import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDailyActivitySeries,
  buildOccupiedMandalsMap,
  buildReportersCsv,
  deduplicateFormerReporters,
  escapeCsvCell,
  findMandalOccupant,
  formatDisplayPhone,
  getClean10DigitPhone,
  paginateItems,
  resolveSmartDefaultTab,
} from './reporterManagementHelpers.ts';

test('resolveSmartDefaultTab opens applications when pending > 0, otherwise reporters', () => {
  assert.equal(resolveSmartDefaultTab(3), 'applications');
  assert.equal(resolveSmartDefaultTab(1), 'applications');
  assert.equal(resolveSmartDefaultTab(0), 'reporters');
});

test('phone cleaning and formatting normalizes 91 / 0 / messy strings', () => {
  assert.equal(getClean10DigitPhone('+91 98480-12345'), '9848012345');
  assert.equal(getClean10DigitPhone('09848012345'), '9848012345');
  assert.equal(formatDisplayPhone('9848012345'), '+91 98480 12345');
  assert.equal(getClean10DigitPhone('12345'), '');
});

test('buildOccupiedMandalsMap and findMandalOccupant handle normalization and self-exclusion', () => {
  const map = buildOccupiedMandalsMap([
    { id: 'u1', name: 'రమేష్', phone: '9848012345', district: 'Siddipet', assignedMandal: 'Gajwel' },
    { id: 'u2', name: 'Suspended User', district: 'Siddipet', assignedMandal: 'Dubbak', suspended: true },
    { id: 'u3', name: 'Former User', district: 'Siddipet', assignedMandal: 'Husnabad', previouslyDowngraded: true },
  ]);

  const found = findMandalOccupant(map, ' siddipet ', 'gajwel');
  assert.ok(found);
  assert.equal(found?.userId, 'u1');

  // Self-exclusion when editing the same reporter's location
  assert.equal(findMandalOccupant(map, 'Siddipet', 'Gajwel', 'u1'), null);

  // Suspended & previously downgraded reporters must not occupy a mandal
  assert.equal(findMandalOccupant(map, 'Siddipet', 'Dubbak'), null);
  assert.equal(findMandalOccupant(map, 'Siddipet', 'Husnabad'), null);
});

test('paginateItems clamps out-of-range pages and computes exact bounds', () => {
  const data = Array.from({ length: 53 }, (_, i) => i + 1);
  const p1 = paginateItems(data, 1, 25);
  assert.equal(p1.totalPages, 3);
  assert.equal(p1.startIndex, 1);
  assert.equal(p1.endIndex, 25);
  assert.equal(p1.items.length, 25);

  const p3 = paginateItems(data, 99, 25);
  assert.equal(p3.currentPage, 3);
  assert.equal(p3.startIndex, 51);
  assert.equal(p3.endIndex, 53);
  assert.deepEqual(p3.items, [51, 52, 53]);

  const empty = paginateItems([], 2, 25);
  assert.equal(empty.currentPage, 1);
  assert.equal(empty.startIndex, 0);
  assert.equal(empty.endIndex, 0);
});

test('buildDailyActivitySeries generates 14 consecutive IST date buckets', () => {
  const nowMs = Date.UTC(2026, 4, 20, 10, 0, 0); // 2026-05-20 15:30 IST
  const series = buildDailyActivitySeries(
    {
      '2026-05-20': 4,
      '2026-05-18': 2,
    },
    14,
    nowMs
  );
  assert.equal(series.length, 14);
  assert.equal(series[13].dateKey, '2026-05-20');
  assert.equal(series[13].count, 4);
  assert.equal(series[11].dateKey, '2026-05-18');
  assert.equal(series[11].count, 2);
  assert.equal(series[12].count, 0);
});

test('deduplicateFormerReporters merges duplicates and orders by latest downgrade', () => {
  const list = deduplicateFormerReporters([
    { id: 'r1', downgradedAt: 1000, name: 'Older' },
    { id: 'r2', downgradedAt: 5000, name: 'Newer' },
    { id: 'r1', downgradedAt: 2000, name: 'Older Updated' },
  ]);
  assert.equal(list.length, 2);
  assert.equal(list[0].id, 'r2');
  assert.equal(list[1].id, 'r1');
  assert.equal(list[1].name, 'Older Updated');
});

test('buildReportersCsv includes UTF-8 BOM, escapes quotes/commas/formulas, and preserves Telugu', () => {
  assert.equal(escapeCsvCell('a, "b"'), '"a, ""b"""');
  assert.equal(escapeCsvCell('=SUM(A1:A2)'), "'=SUM(A1:A2)");

  const csv = buildReportersCsv([
    {
      name: 'సురేష్, కుమార్',
      role: 'REPORTER',
      phone: '9848012345',
      state: 'TS',
      district: 'Siddipet',
      assignedMandal: 'Gajwel',
      todayNewsCount: 2,
      lastWeekNewsCount: 9,
      last30DaysNewsCount: 24,
      totalNewsCount: 120,
      referralCount: 5,
      daysInactive: 0,
      inactivityStage: 'ACTIVE',
      lastPostTimestamp: Date.UTC(2026, 4, 20, 6, 0, 0),
    },
  ]);

  assert.ok(csv.startsWith('\uFEFF'), 'CSV should start with UTF-8 BOM');
  assert.ok(csv.includes('"సురేష్, కుమార్"'), 'Telugu name with comma should be quoted');
  assert.ok(csv.includes('+91 98480 12345'), 'Formatted phone should be exported');
  assert.ok(csv.includes('చురుకుగా'), 'Telugu stage label should be included');
});

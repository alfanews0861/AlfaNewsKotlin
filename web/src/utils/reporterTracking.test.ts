import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY_MS,
  DEFAULT_TRACKING_CONFIG,
  calculateDaysInactiveIst,
  computeWindowCounts,
  deriveDisplayStage,
  extractCanonicalReporterMetrics,
  getIstDateKey,
  parseEpochMs,
} from './reporterTracking.ts';

test('parseEpochMs handles epoch ms, seconds, Firestore Timestamps, and ISO strings', () => {
  const ts = Date.parse('2026-08-20T10:00:00Z');
  assert.equal(parseEpochMs(ts), ts);
  assert.equal(parseEpochMs(Math.floor(ts / 1000)), Math.floor(ts / 1000) * 1000);
  assert.equal(parseEpochMs({ toMillis: () => ts }), ts);
  assert.equal(parseEpochMs({ seconds: Math.floor(ts / 1000) }), Math.floor(ts / 1000) * 1000);
  assert.equal(parseEpochMs('2026-08-20T10:00:00Z'), ts);
  assert.equal(parseEpochMs(null), null);
});

test('computeWindowCounts aggregates Today, Last 7 Days, and Last 30 Days in IST', () => {
  const nowMs = Date.parse('2026-08-21T04:30:00Z'); // 2026-08-21 10:00 AM IST
  assert.equal(getIstDateKey(nowMs), '2026-08-21');

  const counts = computeWindowCounts(
    {
      '2026-08-21': 3,
      '2026-08-18': 2,
      '2026-08-15': 1, // 7th day inclusive
      '2026-08-14': 4, // 8th day (excluded from 7d, included in 30d)
      '2026-07-01': 9, // >30d ago
    },
    nowMs
  );

  assert.equal(counts.todayCount, 3);
  assert.equal(counts.last7DaysCount, 6);
  assert.equal(counts.last30DaysCount, 10);
});

test('extractCanonicalReporterMetrics uses reporterActivity and never guesses totalNewsCount from points/10', () => {
  const nowMs = Date.parse('2026-08-21T04:30:00Z');
  const metrics = extractCanonicalReporterMetrics(
    {
      points: 500, // e.g., from referral bonuses — must NOT be divided by 10!
      totalNewsCount: 0,
      promotedAt: nowMs - 4 * DAY_MS,
      reporterActivity: {
        totalApprovedPosts: 12,
        lastApprovedPostAt: nowMs - 4 * DAY_MS,
        dailyCounts: {
          '2026-08-17': 2,
        },
      },
    },
    nowMs,
    DEFAULT_TRACKING_CONFIG
  );

  assert.equal(metrics.totalNewsCount, 12);
  assert.equal(metrics.todayNewsCount, 0);
  assert.equal(metrics.lastWeekNewsCount, 2);
  assert.equal(metrics.daysInactive, 4);
  assert.equal(metrics.inactivityStage, 'REMINDED_3D');
});

test('deriveDisplayStage matches 3 / 7 / 10-day thresholds and EXEMPT state', () => {
  const nowMs = Date.parse('2026-08-21T04:30:00Z');
  assert.equal(deriveDisplayStage({}, 0, 5), 'ACTIVE');
  assert.equal(deriveDisplayStage({}, 2, 5), 'ACTIVE');
  assert.equal(deriveDisplayStage({}, 3, 5), 'REMINDED_3D');
  assert.equal(deriveDisplayStage({}, 7, 5), 'REMINDED_7D');
  assert.equal(deriveDisplayStage({}, 10, 5), 'ADMIN_ALERTED_10D');
  assert.equal(deriveDisplayStage({ exemptFromInactivity: true }, 25, 5), 'EXEMPT');
  assert.equal(deriveDisplayStage({}, 1, 0), 'NEW_NO_POSTS');

  // Rejoined reporter gets grace period
  assert.equal(
    calculateDaysInactiveIst({ lastPostTimestamp: null, promotedAt: nowMs - DAY_MS }, nowMs),
    1
  );
});

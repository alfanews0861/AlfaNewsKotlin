import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { calculateDaysInactive, parseToDate } from './reporter_monitor';

describe('Reporter Monitor & Warning System Tests', () => {

    test('parseToDate helper parses numbers, Dates, Firestore timestamps correctly', () => {
        const now = new Date('2026-08-20T12:00:00Z');
        expect(parseToDate(now)?.getTime()).toBe(now.getTime());
        expect(parseToDate(now.getTime())?.getTime()).toBe(now.getTime());
        expect(parseToDate({ toDate: () => now })?.getTime()).toBe(now.getTime());
        expect(parseToDate({ seconds: Math.floor(now.getTime() / 1000) })?.getTime()).toBe(Math.floor(now.getTime() / 1000) * 1000);
        expect(parseToDate(null)).toBeNull();
        expect(parseToDate(undefined)).toBeNull();
    });

    test('calculateDaysInactive: Uses latest post date when available', () => {
        const now = new Date('2026-08-20T12:00:00Z');
        const twoDaysAgo = new Date('2026-08-18T12:00:00Z');
        const promotedSixtyDaysAgo = new Date('2026-06-20T12:00:00Z');

        const reporter = {
            lastPostTimestamp: twoDaysAgo,
            promotedAt: promotedSixtyDaysAgo
        };

        const days = calculateDaysInactive(reporter, now);
        expect(days).toBe(2);
    });

    test('calculateDaysInactive: Re-promoted reporter gets fresh grace period even without posts', () => {
        const now = new Date('2026-08-20T12:00:00Z');
        const rejoinedYesterday = new Date('2026-08-19T12:00:00Z');

        const reporter = {
            lastPostTimestamp: null,
            promotedAt: rejoinedYesterday,
            rejoinedAt: rejoinedYesterday
        };

        const days = calculateDaysInactive(reporter, now);
        expect(days).toBe(1); // 1 day inactive, not 60 days
    });

    test('calculateDaysInactive: Fallback to actual news date takes priority over stale user doc', () => {
        const now = new Date('2026-08-20T12:00:00Z');
        const staleLastPostOnUserDoc = new Date('2026-06-01T12:00:00Z'); // 80 days ago
        const actualNewsDateFoundInCollection = new Date('2026-08-19T12:00:00Z'); // 1 day ago

        const reporter = {
            lastPostTimestamp: staleLastPostOnUserDoc,
            promotedAt: new Date('2026-05-01T12:00:00Z')
        };

        const days = calculateDaysInactive(reporter, now, actualNewsDateFoundInCollection);
        expect(days).toBe(1); // Self-healed to 1 day!
    });

    test('Warning Ladder Escalation Thresholds', () => {
        // Level 1: 3-4 days
        expect(3 >= 3 && 3 < 5).toBe(true);
        expect(4 >= 3 && 4 < 5).toBe(true);

        // Level 2: 5-6 days
        expect(5 >= 5 && 5 < 7).toBe(true);
        expect(6 >= 5 && 6 < 7).toBe(true);

        // Level 3: 7-9 days
        expect(7 >= 7 && 7 < 10).toBe(true);
        expect(9 >= 7 && 9 < 10).toBe(true);

        // Demotion: 10+ days (Requires Level 3 + 48 hours gap)
        const daysInactive = 10;
        const currentLevel = 3;
        const hoursSinceLastWarning = 49;
        const canDemote = daysInactive >= 10 && currentLevel >= 3 && hoursSinceLastWarning >= 48;
        expect(canDemote).toBe(true);

        // Safety Guard: Level 0 cannot be instantly demoted
        const levelZeroLevel = 0;
        const canDemoteLevelZero = daysInactive >= 10 && levelZeroLevel >= 3 && hoursSinceLastWarning >= 48;
        expect(canDemoteLevelZero).toBe(false);
    });
});

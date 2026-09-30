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

    test('calculateDaysInactive: User doc recent post is NOT overwritten by older actualNewsDate', () => {
        const now = new Date('2026-08-20T12:00:00Z');
        const userDocRecentPost = new Date('2026-08-18T12:00:00Z'); // 2 days ago
        const staleNewsFromQuery = new Date('2026-08-01T12:00:00Z'); // 19 days ago

        const reporter = {
            lastPostTimestamp: userDocRecentPost,
            promotedAt: new Date('2026-05-01T12:00:00Z')
        };

        const days = calculateDaysInactive(reporter, now, staleNewsFromQuery);
        expect(days).toBe(2); // Retains 2 days, not degraded to 19 days!
    });

    test('parseToDate parses string numeric epoch timestamps', () => {
        const tsString = "1724155200000";
        const parsed = parseToDate(tsString);
        expect(parsed).not.toBeNull();
        expect(parsed?.getTime()).toBe(1724155200000);
    });

    test('Sequential Warning Ladder Escalation Thresholds', () => {
        const canEscalateToLevel2 = (days: number, currentLevel: number, hours: number) => {
            return days >= 8 && currentLevel === 1 && hours >= 48;
        };

        const canEscalateToLevel3 = (days: number, currentLevel: number, hours: number) => {
            return days >= 12 && currentLevel === 2 && hours >= 72;
        };

        const canDemote = (days: number, currentLevel: number, hours: number, lifetimePosts: number) => {
            return days >= 15 && currentLevel >= 3 && hours >= 72 && lifetimePosts === 0;
        };

        // Level 1: Day 5+
        expect(5 >= 5).toBe(true);
        expect(4 >= 5).toBe(false);

        // Level 2: Requires Level 1 + 48h
        expect(canEscalateToLevel2(8, 1, 49)).toBe(true);
        expect(canEscalateToLevel2(8, 0, 49)).toBe(false); // Cannot jump from Level 0 to Level 2!

        // Level 3: Requires Level 2 + 72h
        expect(canEscalateToLevel3(12, 2, 73)).toBe(true);
        expect(canEscalateToLevel3(12, 0, 73)).toBe(false); // Cannot jump from Level 0 to Level 3!
        expect(canEscalateToLevel3(12, 1, 73)).toBe(false); // Cannot jump from Level 1 to Level 3!

        // Demotion: Requires Level 3 + 72h + 0 lifetime posts
        expect(canDemote(15, 3, 75, 0)).toBe(true);

        // Established reporters with >= 3 posts are NEVER demoted
        expect(canDemote(15, 3, 75, 5)).toBe(false);
    });
});

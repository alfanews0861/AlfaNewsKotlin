import * as fs from 'fs';
import * as path from 'path';
import { describe, test, expect } from '@jest/globals';
import { calculateDaysInactive, parseToDate } from './reporter_monitor';
import {
    DAY_MS,
    DEFAULT_REPORTER_TRACKING_CONFIG,
    calculateIstCalendarDaysInactive,
    computeWindowCounts,
    evaluateReporterInactivity,
    getIstDateKey,
    isCountableApprovedReporterPost,
    isQuietHoursIst,
    normalizeTrackingConfig,
    parseEpochMs,
    pruneDailyCounts,
    renderReminderTemplate,
    resolveCanonicalReporterId
} from './reporter_tracking';

describe('Reporter Tracking & Push-Only Inactivity Escalation Tests', () => {

    test('parseEpochMs & parseToDate parse numbers (ms/s), Dates, Firestore timestamps, and strings accurately', () => {
        const now = new Date('2026-08-20T12:00:00Z');
        expect(parseToDate(now)?.getTime()).toBe(now.getTime());
        expect(parseToDate(now.getTime())?.getTime()).toBe(now.getTime());
        expect(parseEpochMs(Math.floor(now.getTime() / 1000))).toBe(Math.floor(now.getTime() / 1000) * 1000);
        expect(parseToDate({ toDate: () => now })?.getTime()).toBe(now.getTime());
        expect(parseToDate({ toMillis: () => now.getTime() })?.getTime()).toBe(now.getTime());
        expect(parseToDate({ seconds: Math.floor(now.getTime() / 1000) })?.getTime()).toBe(Math.floor(now.getTime() / 1000) * 1000);
        expect(parseToDate({ _seconds: Math.floor(now.getTime() / 1000) })?.getTime()).toBe(Math.floor(now.getTime() / 1000) * 1000);
        expect(parseToDate('1724155200000')?.getTime()).toBe(1724155200000);
        expect(parseToDate('2026-08-20T12:00:00Z')?.getTime()).toBe(now.getTime());
        expect(parseToDate(null)).toBeNull();
        expect(parseToDate(undefined)).toBeNull();
        expect(parseToDate(0)).toBeNull();
        expect(parseToDate('')).toBeNull();
    });

    test('IST date key, quiet hours, rolling 35-day prune, and Today/7d/30d window counts', () => {
        // 2026-08-20 19:00 UTC == 2026-08-21 00:30 IST (already next day in IST & inside quiet hours)
        const lateUtcMs = Date.parse('2026-08-20T19:00:00Z');
        expect(getIstDateKey(lateUtcMs)).toBe('2026-08-21');
        expect(isQuietHoursIst(lateUtcMs)).toBe(true);

        // 2026-08-21 04:30 UTC == 2026-08-21 10:00 IST (outside quiet hours)
        const morningIstMs = Date.parse('2026-08-21T04:30:00Z');
        expect(getIstDateKey(morningIstMs)).toBe('2026-08-21');
        expect(isQuietHoursIst(morningIstMs)).toBe(false);

        const dailyCounts = {
            '2026-08-21': 2, // Today
            '2026-08-19': 3, // Within 7d
            '2026-08-15': 4, // Exactly 7th day inclusive (Aug 15..21 = 7 days)
            '2026-08-14': 5, // Outside 7d, inside 30d
            '2026-07-01': 9  // Older than 35d -> pruned
        };

        const pruned = pruneDailyCounts(dailyCounts, morningIstMs, 35);
        expect(pruned['2026-07-01']).toBeUndefined();
        expect(pruned['2026-08-21']).toBe(2);

        const windows = computeWindowCounts(dailyCounts, morningIstMs);
        expect(windows.todayCount).toBe(2);
        expect(windows.last7DaysCount).toBe(2 + 3 + 4);
        expect(windows.last30DaysCount).toBe(2 + 3 + 4 + 5);
    });

    test('Cross-mandal attribution: resolves originalReporterId even when public reporter is Alfa News Desk', () => {
        const crossMandalPost = {
            approved: true,
            isReporter: true,
            reporter: { id: 'ALFA_DESK', name: 'Alfa News Desk' },
            originalReporterId: 'rep_uid_123'
        };
        expect(resolveCanonicalReporterId(crossMandalPost)).toBe('rep_uid_123');
        expect(isCountableApprovedReporterPost(crossMandalPost)).toBe(true);

        const normalReporterPost = {
            approved: true,
            isReporter: true,
            reporter: { id: 'rep_uid_456', name: 'రమేష్' }
        };
        expect(resolveCanonicalReporterId(normalReporterPost)).toBe('rep_uid_456');
        expect(isCountableApprovedReporterPost(normalReporterPost)).toBe(true);

        // Unapproved draft must NOT be counted
        expect(isCountableApprovedReporterPost({ ...normalReporterPost, approved: false, status: 'PENDING' })).toBe(false);

        // Citizen and bot posts must NOT be counted
        expect(isCountableApprovedReporterPost({
            approved: true,
            isCitizen: true,
            isReporter: false,
            reporter: { id: 'citizen_1', name: 'సిటిజెన్ పోస్ట్' }
        })).toBe(false);

        expect(isCountableApprovedReporterPost({
            approved: true,
            isReporter: true,
            reporter: { id: 'BOT_RSS', name: 'Alfa News Desk' }
        })).toBe(false);
    });

    test('calculateDaysInactive: Uses latest of lastApprovedPostAt, lastPostTimestamp, and promotion grace period', () => {
        const now = new Date('2026-08-20T05:00:00Z'); // 10:30 AM IST

        // Recent post overrides older promotion date
        expect(calculateDaysInactive({
            reporterActivity: { lastApprovedPostAt: Date.parse('2026-08-18T05:00:00Z') },
            lastPostTimestamp: Date.parse('2026-08-10T05:00:00Z'),
            promotedAt: Date.parse('2026-06-01T05:00:00Z')
        }, now)).toBe(2);

        // Newly promoted / rejoined reporter gets fresh grace period
        expect(calculateDaysInactive({
            lastPostTimestamp: null,
            promotedAt: Date.parse('2026-08-19T05:00:00Z'),
            rejoinedAt: Date.parse('2026-08-19T05:00:00Z')
        }, now)).toBe(1);

        // Override news date heals stale doc timestamp without downgrading fresher doc timestamp
        expect(calculateDaysInactive(
            { lastPostTimestamp: Date.parse('2026-06-01T05:00:00Z') },
            now,
            new Date('2026-08-19T05:00:00Z')
        )).toBe(1);

        expect(calculateDaysInactive(
            { lastPostTimestamp: Date.parse('2026-08-18T05:00:00Z') },
            now,
            new Date('2026-08-01T05:00:00Z')
        )).toBe(2);
    });

    test('3 / 7 / 10-day deterministic state machine: push-only reminders, no repeats per streak, admin alert throttling, exempt handling', () => {
        const nowMs = Date.parse('2026-08-20T04:30:00Z'); // 10:00 AM IST
        const daysAgo = (d: number) => nowMs - d * DAY_MS;

        // 0-2 days -> ACTIVE, no action
        expect(evaluateReporterInactivity(
            { reporterActivity: { lastApprovedPostAt: daysAgo(0) } },
            DEFAULT_REPORTER_TRACKING_CONFIG,
            nowMs
        )).toMatchObject({ daysInactive: 0, nextStage: 'ACTIVE', action: 'NONE' });

        expect(evaluateReporterInactivity(
            { reporterActivity: { lastApprovedPostAt: daysAgo(2) } },
            DEFAULT_REPORTER_TRACKING_CONFIG,
            nowMs
        )).toMatchObject({ daysInactive: 2, nextStage: 'ACTIVE', action: 'NONE' });

        // Day 3 -> SEND_DAY_3_PUSH once
        expect(evaluateReporterInactivity(
            { reporterActivity: { lastApprovedPostAt: daysAgo(3), lastReminderStage: null } },
            DEFAULT_REPORTER_TRACKING_CONFIG,
            nowMs
        )).toMatchObject({ daysInactive: 3, nextStage: 'REMINDED_3D', action: 'SEND_DAY_3_PUSH' });

        // Day 4..6 with DAY_3 already sent -> NONE (no spam)
        expect(evaluateReporterInactivity(
            { reporterActivity: { lastApprovedPostAt: daysAgo(5), lastReminderStage: 'DAY_3' } },
            DEFAULT_REPORTER_TRACKING_CONFIG,
            nowMs
        )).toMatchObject({ daysInactive: 5, nextStage: 'REMINDED_3D', action: 'NONE' });

        // Day 7 with DAY_3 sent -> SEND_DAY_7_PUSH once
        expect(evaluateReporterInactivity(
            { reporterActivity: { lastApprovedPostAt: daysAgo(7), lastReminderStage: 'DAY_3' } },
            DEFAULT_REPORTER_TRACKING_CONFIG,
            nowMs
        )).toMatchObject({ daysInactive: 7, nextStage: 'REMINDED_7D', action: 'SEND_DAY_7_PUSH' });

        // Day 8..9 with DAY_7 already sent -> NONE
        expect(evaluateReporterInactivity(
            { reporterActivity: { lastApprovedPostAt: daysAgo(9), lastReminderStage: 'DAY_7' } },
            DEFAULT_REPORTER_TRACKING_CONFIG,
            nowMs
        )).toMatchObject({ daysInactive: 9, nextStage: 'REMINDED_7D', action: 'NONE' });

        // Day 10+ with no prior admin alert -> SEND_DAY_10_ADMIN_ALERT
        expect(evaluateReporterInactivity(
            { reporterActivity: { lastApprovedPostAt: daysAgo(10), lastReminderStage: 'DAY_7', lastAdminAlertAt: null } },
            DEFAULT_REPORTER_TRACKING_CONFIG,
            nowMs
        )).toMatchObject({ daysInactive: 10, nextStage: 'ADMIN_ALERTED_10D', action: 'SEND_DAY_10_ADMIN_ALERT' });

        // Day 12 with admin alert sent 2 days ago (< repeat 5d) -> throttled NONE
        expect(evaluateReporterInactivity(
            { reporterActivity: { lastApprovedPostAt: daysAgo(12), lastReminderStage: 'DAY_7', lastAdminAlertAt: daysAgo(2) } },
            DEFAULT_REPORTER_TRACKING_CONFIG,
            nowMs
        )).toMatchObject({ daysInactive: 12, nextStage: 'ADMIN_ALERTED_10D', action: 'NONE' });

        // Day 15 with admin alert sent 5 days ago (>= repeat 5d) -> re-alerts Admin
        expect(evaluateReporterInactivity(
            { reporterActivity: { lastApprovedPostAt: daysAgo(15), lastReminderStage: 'DAY_7', lastAdminAlertAt: daysAgo(5) } },
            DEFAULT_REPORTER_TRACKING_CONFIG,
            nowMs
        )).toMatchObject({ daysInactive: 15, nextStage: 'ADMIN_ALERTED_10D', action: 'SEND_DAY_10_ADMIN_ALERT' });

        // Exempt / paused reporter -> always EXEMPT & NONE
        expect(evaluateReporterInactivity(
            { exemptFromInactivity: true, reporterActivity: { lastApprovedPostAt: daysAgo(20) } },
            DEFAULT_REPORTER_TRACKING_CONFIG,
            nowMs
        )).toMatchObject({ nextStage: 'EXEMPT', action: 'NONE' });

        // Suspended / downgraded reporter -> skipped cleanly
        expect(evaluateReporterInactivity(
            { suspended: true, reporterActivity: { lastApprovedPostAt: daysAgo(20) } },
            DEFAULT_REPORTER_TRACKING_CONFIG,
            nowMs
        )).toMatchObject({ nextStage: 'EXEMPT', action: 'NONE' });
    });

    test('Template rendering and config threshold normalization', () => {
        const rendered = renderReminderTemplate(
            'నమస్కారం {name} గారు, {days} రోజులుగా {mandal} వార్తలు లేవు.',
            { name: 'సురేష్', days: 3, mandal: 'సిద్దిపేట' }
        );
        expect(rendered).toBe('నమస్కారం సురేష్ గారు, 3 రోజులుగా సిద్దిపేట వార్తలు లేవు.');

        // Out-of-order thresholds are strictly normalized so first < second < admin
        const normalized = normalizeTrackingConfig({
            firstReminderDays: 5,
            secondReminderDays: 4,
            adminAlertDays: 5,
            adminAlertRepeatDays: 0
        });
        expect(normalized.firstReminderDays).toBe(5);
        expect(normalized.secondReminderDays).toBe(6);
        expect(normalized.adminAlertDays).toBe(7);
        expect(normalized.adminAlertRepeatDays).toBe(5);
    });

    test('Push-Only guarantee: reporter_monitor.ts never writes to reporter_conversations or escalates warning levels', () => {
        const monitorSrc = fs.readFileSync(path.join(__dirname, 'reporter_monitor.ts'), 'utf8');
        expect(monitorSrc).not.toMatch(/collection\(\s*["']reporter_conversations["']\s*\)/);
        expect(monitorSrc).not.toMatch(/warningLevel:\s*[1-9]/);
        expect(monitorSrc).not.toMatch(/AUTO_INACTIVITY_DEMOTION/);
    });
});

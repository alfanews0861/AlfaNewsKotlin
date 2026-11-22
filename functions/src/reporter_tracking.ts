import * as admin from "firebase-admin";
import {
    ReporterActivityStats,
    ReporterInactivityStage,
    ReporterReminderStage,
    ReporterTrackingConfig,
    UserRole
} from "./types";

if (Array.isArray(admin.apps) && admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const DAILY_COUNTS_RETENTION_DAYS = 35;

export const REPORTER_ROLE_VALUES: (string | number)[] = [
    UserRole.REPORTER,
    'reporter',
    'STAFF_REPORTER',
    'staff_reporter',
    UserRole.REGIONAL_INCHARGE,
    'regional_incharge',
    2,
    '2',
    3,
    '3'
];

export const DEFAULT_REPORTER_TRACKING_CONFIG: ReporterTrackingConfig = {
    enabled: true,
    firstReminderDays: 3,
    secondReminderDays: 7,
    adminAlertDays: 10,
    adminAlertRepeatDays: 5,
    day3Title: "మీ ప్రాంత తాజా వార్తలు పంపండి",
    day3Body: "నమస్కారం {name} గారు, గత {days} రోజులుగా మీ మండలం ({mandal}) నుండి తాజా వార్తలు రాలేదు. స్థానిక విశేషాలు, ప్రజా సమస్యలను Alfa News లో పోస్ట్ చేయగలరని కోరుతున్నాము.",
    day7Title: "మీ మండల వార్తల అప్‌డేట్ కోసం ఎదురుచూస్తున్నాము",
    day7Body: "నమస్కారం {name} గారు, గత {days} రోజులుగా మీ ప్రాంతం ({mandal}) నుండి వార్తలు అందలేదు. ఏవైనా సాంకేతిక సమస్యలు ఉంటే ఎడిటోరియల్ డెస్క్‌ను సంప్రదించి తాజా వార్తలు పంపగలరు."
};

/**
 * Safely parses any Firestore Timestamp, Date, number (s or ms), or string into epoch milliseconds.
 */
export function parseEpochMs(val: any): number | null {
    if (val === null || val === undefined) return null;
    try {
        if (typeof val === "number") {
            if (!Number.isFinite(val) || val <= 0) return null;
            return val > 1e11 ? Math.floor(val) : Math.floor(val * 1000);
        }
        if (val instanceof Date) {
            const ms = val.getTime();
            return Number.isFinite(ms) && ms > 0 ? ms : null;
        }
        if (typeof val.toMillis === "function") {
            const ms = val.toMillis();
            return Number.isFinite(ms) && ms > 0 ? ms : null;
        }
        if (typeof val.toDate === "function") {
            const ms = val.toDate().getTime();
            return Number.isFinite(ms) && ms > 0 ? ms : null;
        }
        if (typeof val.seconds === "number") {
            return Math.floor(val.seconds * 1000);
        }
        if (typeof val._seconds === "number") {
            return Math.floor(val._seconds * 1000);
        }
        if (typeof val === "string") {
            const trimmed = val.trim();
            if (!trimmed) return null;
            if (/^\d+$/.test(trimmed)) {
                const num = Number(trimmed);
                if (!Number.isFinite(num) || num <= 0) return null;
                return num > 1e11 ? Math.floor(num) : Math.floor(num * 1000);
            }
            const parsed = Date.parse(trimmed);
            return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        }
        return null;
    } catch {
        return null;
    }
}

export function parseToDate(val: any): Date | null {
    const ms = parseEpochMs(val);
    return ms !== null ? new Date(ms) : null;
}

/**
 * Returns IST calendar date key in YYYY-MM-DD format.
 */
export function getIstDateKey(epochMs: number): string {
    const istDate = new Date(epochMs + IST_OFFSET_MS);
    const y = istDate.getUTCFullYear();
    const m = String(istDate.getUTCMonth() + 1).padStart(2, "0");
    const d = String(istDate.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/**
 * Converts an epoch ms timestamp to its IST day index (integer days since Unix epoch in IST).
 */
export function getIstDayNumber(epochMs: number): number {
    return Math.floor((epochMs + IST_OFFSET_MS) / DAY_MS);
}

/**
 * Checks whether current time in IST is within quiet hours (11:00 PM - 6:00 AM IST).
 */
export function isQuietHoursIst(nowMs: number = Date.now()): boolean {
    const istDate = new Date(nowMs + IST_OFFSET_MS);
    const istHour = istDate.getUTCHours();
    return istHour >= 23 || istHour < 6;
}

/**
 * Keeps only the last `keepDays` IST calendar days in dailyCounts so the user document stays tiny.
 */
export function pruneDailyCounts(
    dailyCounts: Record<string, number> | undefined | null,
    nowMs: number = Date.now(),
    keepDays: number = DAILY_COUNTS_RETENTION_DAYS
): Record<string, number> {
    if (!dailyCounts || typeof dailyCounts !== "object") return {};
    const cutoffKey = getIstDateKey(nowMs - (keepDays - 1) * DAY_MS);
    const pruned: Record<string, number> = {};
    for (const [key, val] of Object.entries(dailyCounts)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(key) && key >= cutoffKey) {
            const count = Number(val || 0);
            if (count > 0) {
                pruned[key] = Math.floor(count);
            }
        }
    }
    return pruned;
}

/**
 * Computes Today, Last 7 Days (inclusive of today), and Last 30 Days counts from IST dailyCounts.
 */
export function computeWindowCounts(
    dailyCounts: Record<string, number> | undefined | null,
    nowMs: number = Date.now()
): { todayCount: number; last7DaysCount: number; last30DaysCount: number } {
    if (!dailyCounts || typeof dailyCounts !== "object") {
        return { todayCount: 0, last7DaysCount: 0, last30DaysCount: 0 };
    }
    const todayKey = getIstDateKey(nowMs);
    const sevenDaysCutoff = getIstDateKey(nowMs - 6 * DAY_MS);
    const thirtyDaysCutoff = getIstDateKey(nowMs - 29 * DAY_MS);

    let todayCount = 0;
    let last7DaysCount = 0;
    let last30DaysCount = 0;

    for (const [dateKey, rawVal] of Object.entries(dailyCounts)) {
        const val = Number(rawVal || 0);
        if (!Number.isFinite(val) || val <= 0) continue;
        if (dateKey === todayKey) {
            todayCount += val;
        }
        if (dateKey >= sevenDaysCutoff && dateKey <= todayKey) {
            last7DaysCount += val;
        }
        if (dateKey >= thirtyDaysCutoff && dateKey <= todayKey) {
            last30DaysCount += val;
        }
    }

    return { todayCount, last7DaysCount, last30DaysCount };
}

/**
 * Identifies whether a candidate reporter ID belongs to a real human reporter (not a bot/desk/system ID).
 */
export function isRealReporterId(id: any): id is string {
    if (typeof id !== "string") return false;
    const trimmed = id.trim();
    if (!trimmed) return false;
    const upper = trimmed.toUpperCase();
    if (
        upper.startsWith("BOT_") ||
        upper.startsWith("SYSTEM_") ||
        upper === "ALFA_DESK" ||
        upper === "ALFA NEWS DESK" ||
        upper === "CITIZEN" ||
        upper === "ADMIN_AUTO" ||
        upper === "SCRAPER"
    ) {
        return false;
    }
    return true;
}

/**
 * Resolves the canonical submitting reporter UID for a news post.
 * Always prioritizes `originalReporterId` so cross-mandal posts attributed publicly
 * to "Alfa News Desk" are credited accurately to the submitting reporter.
 */
export function resolveCanonicalReporterId(postData: any): string | null {
    if (!postData || typeof postData !== "object") return null;

    // Exclude citizen submissions and pure automated scraper posts
    if (postData.isCitizen === true) return null;
    const reporterName = typeof postData.reporter === "object" ? String(postData.reporter?.name || "") : "";
    if (reporterName === "సిటిజెన్ పోస్ట్" || reporterName === "అజ్ఞాత పౌరుడు") return null;

    const candidates = [
        postData.originalReporterId,
        typeof postData.reporter === "object" ? postData.reporter?.id : (typeof postData.reporter === "string" ? postData.reporter : null),
        postData.reporterId,
        postData.userId
    ];

    for (const cand of candidates) {
        if (isRealReporterId(cand)) {
            return cand.trim();
        }
    }
    return null;
}

/**
 * Returns true if the news post should count toward reporter news tracking.
 * Counts all approved reporter posts (including cross-mandal posts).
 */
export function isCountableApprovedReporterPost(postData: any): boolean {
    if (!postData || typeof postData !== "object") return false;
    const isApproved = postData.approved === true || String(postData.status || "").toUpperCase() === "PUBLISHED";
    if (!isApproved) return false;
    if (postData.isCitizen === true) return false;

    const hasReporterFlag =
        postData.isReporter === true ||
        postData.processingType === "REPORTER_SUBMISSION" ||
        isRealReporterId(postData.originalReporterId);

    if (!hasReporterFlag) return false;
    return resolveCanonicalReporterId(postData) !== null;
}

/**
 * Computes exact IST calendar days since the reporter's latest approved post (or join/promotion grace date).
 * Never uses arbitrary fallback scans; relies on the canonical profile fields.
 */
export function calculateIstCalendarDaysInactive(
    reporter: any,
    nowMs: number = Date.now(),
    overrideLatestPostMs?: number | null
): number {
    if (!reporter || typeof reporter !== "object") return 0;

    const activityLastPost = parseEpochMs(reporter.reporterActivity?.lastApprovedPostAt);
    const docLastPost = parseEpochMs(reporter.lastPostTimestamp);
    const overridePost = overrideLatestPostMs !== undefined ? parseEpochMs(overrideLatestPostMs) : null;

    const postCandidates = [activityLastPost, docLastPost, overridePost].filter((v): v is number => v !== null);
    const latestPostMs = postCandidates.length > 0 ? Math.max(...postCandidates) : null;

    const promotionCandidates = [
        parseEpochMs(reporter.promotedAt),
        parseEpochMs(reporter.rejoinedAt),
        parseEpochMs(reporter.roleUpdatedAt)
    ].filter((v): v is number => v !== null);
    const latestPromotionMs = promotionCandidates.length > 0 ? Math.max(...promotionCandidates) : null;

    let referenceMs: number | null = null;
    if (latestPostMs !== null && latestPromotionMs !== null) {
        referenceMs = Math.max(latestPostMs, latestPromotionMs);
    } else if (latestPostMs !== null) {
        referenceMs = latestPostMs;
    } else if (latestPromotionMs !== null) {
        referenceMs = latestPromotionMs;
    } else {
        const createdMs =
            parseEpochMs(reporter.joinedAt) ??
            parseEpochMs(reporter.createdAt) ??
            parseEpochMs(reporter.timestamp);
        referenceMs = createdMs;
    }

    if (referenceMs === null) return 0;

    const nowDay = getIstDayNumber(nowMs);
    const refDay = getIstDayNumber(referenceMs);
    return Math.max(0, nowDay - refDay);
}

export type InactivityAction =
    | 'NONE'
    | 'SEND_DAY_3_PUSH'
    | 'SEND_DAY_7_PUSH'
    | 'SEND_DAY_10_ADMIN_ALERT';

export interface ReporterInactivityEvaluation {
    daysInactive: number;
    nextStage: ReporterInactivityStage;
    action: InactivityAction;
    reason: string;
}

/**
 * Pure deterministic state machine for reporter inactivity evaluation (3 / 7 / 10 days).
 * Enforces:
 * - Zero automated demotions, zero warning levels.
 * - Day 3 push sent once per inactivity streak.
 * - Day 7 follow-up push sent once per inactivity streak.
 * - Day 10+ admin alert sent and throttled every `adminAlertRepeatDays` (default 5 days).
 * - Exempt / suspended / downgraded reporters are skipped cleanly.
 */
export function evaluateReporterInactivity(
    reporter: any,
    config: ReporterTrackingConfig = DEFAULT_REPORTER_TRACKING_CONFIG,
    nowMs: number = Date.now()
): ReporterInactivityEvaluation {
    const daysInactive = calculateIstCalendarDaysInactive(reporter, nowMs);

    if (reporter?.suspended === true || reporter?.previouslyDowngraded === true) {
        return {
            daysInactive,
            nextStage: 'EXEMPT',
            action: 'NONE',
            reason: 'Account suspended or previously downgraded'
        };
    }

    if (reporter?.exemptFromInactivity === true) {
        return {
            daysInactive,
            nextStage: 'EXEMPT',
            action: 'NONE',
            reason: 'Paused / exempt by Admin'
        };
    }

    const firstDays = Math.max(1, Number(config.firstReminderDays || 3));
    const secondDays = Math.max(firstDays + 1, Number(config.secondReminderDays || 7));
    const adminDays = Math.max(secondDays + 1, Number(config.adminAlertDays || 10));
    const adminRepeatDays = Math.max(1, Number(config.adminAlertRepeatDays || 5));

    const activity: Partial<ReporterActivityStats> = reporter?.reporterActivity || {};
    const lastReminderStage: ReporterReminderStage | null = activity.lastReminderStage || null;
    const lastAdminAlertAt =
        parseEpochMs(activity.lastAdminAlertAt) ??
        parseEpochMs(reporter?.lastAdminInactivityAlertDate);

    // 1. Active (< Day 3)
    if (daysInactive < firstDays) {
        return {
            daysInactive,
            nextStage: 'ACTIVE',
            action: 'NONE',
            reason: 'Active within threshold'
        };
    }

    // 2. Day 10+ -> Admin Alert (throttled every adminRepeatDays)
    if (daysInactive >= adminDays) {
        const msSinceAdminAlert = lastAdminAlertAt !== null ? (nowMs - lastAdminAlertAt) : Number.POSITIVE_INFINITY;
        const repeatWindowMs = adminRepeatDays * DAY_MS;

        if (msSinceAdminAlert >= repeatWindowMs) {
            return {
                daysInactive,
                nextStage: 'ADMIN_ALERTED_10D',
                action: 'SEND_DAY_10_ADMIN_ALERT',
                reason: `Inactive ${daysInactive}d (>= ${adminDays}d); alerting Admins`
            };
        }
        return {
            daysInactive,
            nextStage: 'ADMIN_ALERTED_10D',
            action: 'NONE',
            reason: `Inactive ${daysInactive}d; Admin alert throttled (${Math.floor(msSinceAdminAlert / DAY_MS)}d ago)`
        };
    }

    // 3. Day 7..9 -> Second Follow-up Push (sent once per streak)
    if (daysInactive >= secondDays) {
        if (lastReminderStage !== 'DAY_7') {
            return {
                daysInactive,
                nextStage: 'REMINDED_7D',
                action: 'SEND_DAY_7_PUSH',
                reason: `Inactive ${daysInactive}d (>= ${secondDays}d); sending Day 7 follow-up push`
            };
        }
        return {
            daysInactive,
            nextStage: 'REMINDED_7D',
            action: 'NONE',
            reason: `Inactive ${daysInactive}d; Day 7 follow-up already sent for this streak`
        };
    }

    // 4. Day 3..6 -> First Reminder Push (sent once per streak)
    if (lastReminderStage !== 'DAY_3' && lastReminderStage !== 'DAY_7') {
        return {
            daysInactive,
            nextStage: 'REMINDED_3D',
            action: 'SEND_DAY_3_PUSH',
            reason: `Inactive ${daysInactive}d (>= ${firstDays}d); sending Day 3 reminder push`
        };
    }

    return {
        daysInactive,
        nextStage: 'REMINDED_3D',
        action: 'NONE',
        reason: `Inactive ${daysInactive}d; Day 3 reminder already sent for this streak`
    };
}

/**
 * Formats Telugu reminder template safely with `{name}`, `{days}`, `{mandal}` placeholders.
 */
export function renderReminderTemplate(
    template: string,
    vars: { name: string; days: number; mandal: string }
): string {
    return (template || "")
        .replace(/\{name\}/g, vars.name || "విలేకరి")
        .replace(/\{days\}/g, String(vars.days))
        .replace(/\{mandal\}/g, vars.mandal || "మీ ప్రాంతం");
}

/**
 * Sanitizes and merges stored Firestore config with defaults.
 */
export function normalizeTrackingConfig(raw?: any): ReporterTrackingConfig {
    const src = raw && typeof raw === "object" ? raw : {};
    const firstReminderDays = Math.max(1, Math.min(30, Number(src.firstReminderDays ?? DEFAULT_REPORTER_TRACKING_CONFIG.firstReminderDays) || 3));
    const secondReminderDays = Math.max(firstReminderDays + 1, Math.min(45, Number(src.secondReminderDays ?? DEFAULT_REPORTER_TRACKING_CONFIG.secondReminderDays) || 7));
    const adminAlertDays = Math.max(secondReminderDays + 1, Math.min(60, Number(src.adminAlertDays ?? DEFAULT_REPORTER_TRACKING_CONFIG.adminAlertDays) || 10));
    const adminAlertRepeatDays = Math.max(1, Math.min(30, Number(src.adminAlertRepeatDays ?? DEFAULT_REPORTER_TRACKING_CONFIG.adminAlertRepeatDays) || 5));

    return {
        enabled: src.enabled !== false,
        firstReminderDays,
        secondReminderDays,
        adminAlertDays,
        adminAlertRepeatDays,
        day3Title: typeof src.day3Title === "string" && src.day3Title.trim() ? src.day3Title.trim() : DEFAULT_REPORTER_TRACKING_CONFIG.day3Title,
        day3Body: typeof src.day3Body === "string" && src.day3Body.trim() ? src.day3Body.trim() : DEFAULT_REPORTER_TRACKING_CONFIG.day3Body,
        day7Title: typeof src.day7Title === "string" && src.day7Title.trim() ? src.day7Title.trim() : DEFAULT_REPORTER_TRACKING_CONFIG.day7Title,
        day7Body: typeof src.day7Body === "string" && src.day7Body.trim() ? src.day7Body.trim() : DEFAULT_REPORTER_TRACKING_CONFIG.day7Body,
        updatedAt: parseEpochMs(src.updatedAt) ?? undefined,
        updatedBy: typeof src.updatedBy === "string" ? src.updatedBy : undefined
    };
}

export async function getReporterTrackingConfig(): Promise<ReporterTrackingConfig> {
    try {
        const snap = await db.collection("settings").doc("reporterTracking").get();
        if (!snap.exists) return { ...DEFAULT_REPORTER_TRACKING_CONFIG };
        return normalizeTrackingConfig(snap.data());
    } catch (err: any) {
        console.warn("[REPORTER_TRACKING] Failed to load config, using defaults:", err.message);
        return { ...DEFAULT_REPORTER_TRACKING_CONFIG };
    }
}

export async function saveReporterTrackingConfig(
    updates: Partial<ReporterTrackingConfig>,
    adminUid: string
): Promise<ReporterTrackingConfig> {
    const existing = await getReporterTrackingConfig();
    const merged = normalizeTrackingConfig({ ...existing, ...updates });
    const payload: ReporterTrackingConfig = {
        ...merged,
        updatedAt: Date.now(),
        updatedBy: adminUid
    };
    await db.collection("settings").doc("reporterTracking").set(payload, { merge: true });
    return payload;
}

/**
 * Idempotent real-time approved news tracker.
 * Atomically marks `news/{postId}.activityCounted = true` and updates `users/{reporterId}.reporterActivity`
 * (including totalApprovedPosts, rolling IST dailyCounts, numeric lastApprovedPostAt & lastPostTimestamp,
 * and resetting inactivity reminder state back to ACTIVE).
 */
export async function recordApprovedNewsForReporter(
    postId: string,
    fallbackPostData?: any
): Promise<{ counted: boolean; reporterId?: string; reason?: string }> {
    if (!postId) return { counted: false, reason: "missing_post_id" };

    const postRef = db.collection("news").doc(postId);

    try {
        return await db.runTransaction(async (tx) => {
            const postSnap = await tx.get(postRef);
            const postData = postSnap.exists ? { ...fallbackPostData, ...postSnap.data() } : fallbackPostData;

            if (!postData) {
                return { counted: false, reason: "post_not_found" };
            }
            if (postData.activityCounted === true) {
                return { counted: false, reason: "already_counted" };
            }
            if (!isCountableApprovedReporterPost(postData)) {
                return { counted: false, reason: "not_countable_reporter_post" };
            }

            const reporterId = resolveCanonicalReporterId(postData);
            if (!reporterId) {
                return { counted: false, reason: "no_canonical_reporter_id" };
            }

            const userRef = db.collection("users").doc(reporterId);
            const userSnap = await tx.get(userRef);
            if (!userSnap.exists) {
                // Still mark post so we don't retry forever on orphan IDs
                if (postSnap.exists) {
                    tx.update(postRef, {
                        activityCounted: true,
                        activityCountedReporterId: reporterId
                    });
                }
                return { counted: false, reporterId, reason: "reporter_doc_missing" };
            }

            const userData = userSnap.data() || {};
            const nowMs = Date.now();
            const postEpochMs =
                parseEpochMs(postData.timestamp) ??
                parseEpochMs(postData.publishedAt) ??
                parseEpochMs(postData.createdAt) ??
                nowMs;

            const existingActivity: Partial<ReporterActivityStats> = userData.reporterActivity || {};
            const prevTotal = Number(existingActivity.totalApprovedPosts ?? userData.totalNewsCount ?? 0);
            const nextTotal = Math.max(0, Math.floor(prevTotal)) + 1;

            const prevLastPostMs =
                parseEpochMs(existingActivity.lastApprovedPostAt) ??
                parseEpochMs(userData.lastPostTimestamp) ??
                0;
            const nextLastPostMs = Math.max(prevLastPostMs, postEpochMs);

            const prunedDaily = pruneDailyCounts(existingActivity.dailyCounts, nowMs);
            const postDateKey = getIstDateKey(postEpochMs);
            const cutoffKey = getIstDateKey(nowMs - (DAILY_COUNTS_RETENTION_DAYS - 1) * DAY_MS);
            if (postDateKey >= cutoffKey) {
                prunedDaily[postDateKey] = (prunedDaily[postDateKey] || 0) + 1;
            }

            const nextActivity: ReporterActivityStats = {
                totalApprovedPosts: nextTotal,
                lastApprovedPostAt: nextLastPostMs,
                dailyCounts: prunedDaily,
                inactivityStage: userData.exemptFromInactivity === true ? "EXEMPT" : "ACTIVE",
                lastReminderSentAt: parseEpochMs(existingActivity.lastReminderSentAt) ?? null,
                lastReminderStage: null,
                lastAdminAlertAt: null,
                lastSyncedAt: parseEpochMs(existingActivity.lastSyncedAt) ?? nowMs
            };

            tx.set(
                userRef,
                {
                    totalNewsCount: nextTotal,
                    lastPostTimestamp: nextLastPostMs,
                    reporterActivity: nextActivity,
                    warningLevel: 0,
                    inProbation: false,
                    lastWarningDate: admin.firestore.FieldValue.delete()
                },
                { merge: true }
            );

            if (postSnap.exists) {
                tx.update(postRef, {
                    activityCounted: true,
                    activityCountedReporterId: reporterId
                });
            }

            return { counted: true, reporterId };
        });
    } catch (err: any) {
        console.error(`[REPORTER_TRACKING] recordApprovedNewsForReporter failed for ${postId}:`, err.message);
        return { counted: false, reason: err.message };
    }
}

/**
 * Bounded reconciliation backfill: computes exact approved post counts (including cross-mandal posts)
 * and rolling 35-day IST dailyCounts for active reporters using bounded Firestore queries.
 * Safe under Strict Read Bounds policy (capped to maxNewsScan approved reporter posts per invocation).
 */
export async function syncAllReporterActivityStats(options?: {
    maxNewsScan?: number;
}): Promise<{
    reportersUpdated: number;
    newsScanned: number;
    truncated: boolean;
}> {
    const nowMs = Date.now();
    const maxNewsScan = Math.max(100, Math.min(3000, Number(options?.maxNewsScan || 2000)));
    const cutoffKey = getIstDateKey(nowMs - (DAILY_COUNTS_RETENTION_DAYS - 1) * DAY_MS);

    // 1. Fetch active reporters (bounded)
    const reportersSnap = await db
        .collection("users")
        .where("role", "in", REPORTER_ROLE_VALUES.slice(0, 10))
        .limit(500)
        .get();

    const reporterMap = new Map<string, any>();
    for (const doc of reportersSnap.docs) {
        reporterMap.set(doc.id, doc.data());
    }

    if (reporterMap.size === 0) {
        return { reportersUpdated: 0, newsScanned: 0, truncated: false };
    }

    // 2. Scan approved reporter news in bounded pages of 500
    const statsByReporter = new Map<
        string,
        { total: number; lastPostMs: number | null; dailyCounts: Record<string, number> }
    >();

    for (const rId of reporterMap.keys()) {
        statsByReporter.set(rId, { total: 0, lastPostMs: null, dailyCounts: {} });
    }

    let scanned = 0;
    let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
    let truncated = false;
    const pageSize = 500;

    while (scanned < maxNewsScan) {
        let q: admin.firestore.Query = db
            .collection("news")
            .where("approved", "==", true)
            .where("isReporter", "==", true)
            .orderBy("timestamp", "desc")
            .limit(Math.min(pageSize, maxNewsScan - scanned));

        if (lastDoc) {
            q = q.startAfter(lastDoc);
        }

        const pageSnap = await q.get();
        if (pageSnap.empty) break;

        for (const doc of pageSnap.docs) {
            scanned++;
            const data = doc.data();
            const rId = resolveCanonicalReporterId(data);
            if (!rId || !statsByReporter.has(rId)) continue;

            const bucket = statsByReporter.get(rId)!;
            bucket.total += 1;

            const postMs =
                parseEpochMs(data.timestamp) ??
                parseEpochMs(data.publishedAt) ??
                parseEpochMs(data.createdAt);

            if (postMs !== null) {
                if (bucket.lastPostMs === null || postMs > bucket.lastPostMs) {
                    bucket.lastPostMs = postMs;
                }
                const key = getIstDateKey(postMs);
                if (key >= cutoffKey) {
                    bucket.dailyCounts[key] = (bucket.dailyCounts[key] || 0) + 1;
                }
            }
        }

        lastDoc = pageSnap.docs[pageSnap.docs.length - 1];
        if (pageSnap.size < Math.min(pageSize, maxNewsScan - scanned + pageSnap.size)) {
            break;
        }
        if (scanned >= maxNewsScan) {
            truncated = true;
            break;
        }
    }

    // 3. Commit reconciled stats in batches of 400
    let batch = db.batch();
    let opCount = 0;
    let reportersUpdated = 0;

    for (const [rId, repData] of reporterMap.entries()) {
        const computed = statsByReporter.get(rId)!;
        const existingActivity: Partial<ReporterActivityStats> = repData.reporterActivity || {};

        // If truncated, never shrink an already-higher lifetime count; otherwise use exact computed count
        const prevTotal = Number(existingActivity.totalApprovedPosts ?? repData.totalNewsCount ?? 0);
        const reconciledTotal = truncated ? Math.max(prevTotal, computed.total) : computed.total;

        const prevLastPost =
            parseEpochMs(existingActivity.lastApprovedPostAt) ??
            parseEpochMs(repData.lastPostTimestamp);
        const reconciledLastPost =
            computed.lastPostMs !== null && prevLastPost !== null
                ? Math.max(computed.lastPostMs, prevLastPost)
                : (computed.lastPostMs ?? prevLastPost ?? null);

        const nextActivity: ReporterActivityStats = {
            totalApprovedPosts: reconciledTotal,
            lastApprovedPostAt: reconciledLastPost,
            dailyCounts: pruneDailyCounts(computed.dailyCounts, nowMs),
            inactivityStage:
                repData.exemptFromInactivity === true
                    ? "EXEMPT"
                    : (existingActivity.inactivityStage || "ACTIVE"),
            lastReminderSentAt: parseEpochMs(existingActivity.lastReminderSentAt) ?? null,
            lastReminderStage: existingActivity.lastReminderStage || null,
            lastAdminAlertAt:
                parseEpochMs(existingActivity.lastAdminAlertAt) ??
                parseEpochMs(repData.lastAdminInactivityAlertDate) ??
                null,
            lastSyncedAt: nowMs
        };

        const userUpdate: Record<string, any> = {
            totalNewsCount: reconciledTotal,
            reporterActivity: nextActivity,
            warningLevel: 0,
            inProbation: false,
            lastWarningDate: admin.firestore.FieldValue.delete()
        };

        if (reconciledLastPost !== null) {
            userUpdate.lastPostTimestamp = reconciledLastPost;
        }

        batch.set(db.collection("users").doc(rId), userUpdate, { merge: true });
        opCount++;
        reportersUpdated++;

        if (opCount >= 400) {
            await batch.commit();
            batch = db.batch();
            opCount = 0;
        }
    }

    if (opCount > 0) {
        await batch.commit();
    }

    console.log(
        `[REPORTER_TRACKING] Synced ${reportersUpdated} reporters from ${scanned} approved reporter posts (truncated=${truncated}).`
    );

    return { reportersUpdated, newsScanned: scanned, truncated };
}

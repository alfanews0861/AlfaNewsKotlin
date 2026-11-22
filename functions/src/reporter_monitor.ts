import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { REGION } from "./utils";
import { ReporterReminderLog, ReporterTrackingConfig, UserRole } from "./types";
import {
    calculateIstCalendarDaysInactive,
    evaluateReporterInactivity,
    getReporterTrackingConfig,
    isQuietHoursIst,
    parseEpochMs,
    parseToDate,
    renderReminderTemplate,
    REPORTER_ROLE_VALUES,
    saveReporterTrackingConfig,
    syncAllReporterActivityStats
} from "./reporter_tracking";

if (Array.isArray(admin.apps) && admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();

export { parseToDate };

/**
 * Backwards-compatible wrapper for callers computing inactivity days.
 */
export function calculateDaysInactive(
    reporter: any,
    now: Date = new Date(),
    actualNewsDate?: Date | null
): number {
    const overrideMs = actualNewsDate ? actualNewsDate.getTime() : undefined;
    return calculateIstCalendarDaysInactive(reporter, now.getTime(), overrideMs);
}

/**
 * Verifies the caller is an Admin / Editor / Regional Incharge / Super Admin.
 */
async function assertAdminCaller(auth: any): Promise<string> {
    if (!auth || !auth.uid) {
        throw new HttpsError("unauthenticated", "మీరు లాగిన్ అవ్వాలి.");
    }
    const email = String(auth.token?.email || "").toLowerCase();
    if (email === "alfanews0861@gmail.com") return auth.uid;

    const userSnap = await db.collection("users").doc(auth.uid).get();
    const uData = userSnap.data() || {};
    const roleStr = String(uData.role || "").toUpperCase();
    const allowed = [
        "ADMIN",
        "SUPER_ADMIN",
        "EDITOR",
        "NEWS_DESK",
        "REGIONAL_INCHARGE",
        "3",
        "3.0",
        "4",
        "4.0",
        "5",
        "5.0",
        "6",
        "6.0",
        "7",
        "7.0"
    ];
    if (
        allowed.includes(roleStr) ||
        uData.role === UserRole.ADMIN ||
        uData.role === UserRole.EDITOR ||
        uData.role === UserRole.NEWS_DESK ||
        uData.role === UserRole.REGIONAL_INCHARGE
    ) {
        return auth.uid;
    }

    throw new HttpsError("permission-denied", "అడ్మిన్లకు మాత్రమే ఈ అనుమతి ఉంది.");
}

/**
 * Extracts unique valid FCM tokens from a user document.
 */
function extractUserTokens(userData: any): string[] {
    if (!userData) return [];
    if (userData.notificationsEnabled === false || userData.pushEnabled === false) {
        return [];
    }
    const raw: any[] = [
        ...(Array.isArray(userData.fcmTokens) ? userData.fcmTokens : []),
        userData.fcmToken
    ];
    return Array.from(
        new Set(raw.filter((t): t is string => typeof t === "string" && t.trim().length > 0))
    );
}

/**
 * Strictly Push-Only automated inactivity reminder for Reporters.
 * NEVER writes to `reporter_conversations` (Desk Chat) or `users/{uid}/messages`.
 */
export async function sendReporterReminderPushOnly(
    reporterId: string,
    reporterData: any,
    title: string,
    body: string,
    stage: "DAY_3" | "DAY_7",
    daysInactive: number
): Promise<{ tokensTargeted: number; sentCount: number; status: "SENT" | "NO_TOKENS" | "FAILED" }> {
    const tokens = extractUserTokens(reporterData);
    if (tokens.length === 0) {
        return { tokensTargeted: 0, sentCount: 0, status: "NO_TOKENS" };
    }

    const messages = tokens.map((token) => ({
        token,
        android: {
            priority: "high" as const,
            ttl: 12 * 60 * 60 * 1000,
            directBootOk: true,
            notification: {
                channelId: "general_news_v2",
                sound: "default",
                tag: `reporter_reminder_${stage.toLowerCase()}`
            }
        },
        notification: {
            title,
            body
        },
        data: {
            type: "REPORTER_INACTIVITY_REMINDER",
            stage,
            daysInactive: String(daysInactive),
            title,
            body,
            channelId: "general_news_v2"
        }
    }));

    try {
        const response = await admin.messaging().sendEach(messages);

        // Clean up invalid / unregistered FCM tokens cleanly
        const invalidTokens: string[] = [];
        response.responses.forEach((res, idx) => {
            if (!res.success && res.error) {
                const code = res.error.code;
                if (
                    code === "messaging/registration-token-not-registered" ||
                    code === "messaging/invalid-registration-token"
                ) {
                    invalidTokens.push(tokens[idx]);
                }
            }
        });

        if (invalidTokens.length > 0) {
            const cleanup: Record<string, any> = {
                fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens)
            };
            if (invalidTokens.includes(reporterData?.fcmToken)) {
                cleanup.fcmToken = admin.firestore.FieldValue.delete();
            }
            await db.collection("users").doc(reporterId).update(cleanup).catch(() => {});
        }

        const status = response.successCount > 0 ? "SENT" : "FAILED";
        return {
            tokensTargeted: tokens.length,
            sentCount: response.successCount,
            status
        };
    } catch (err: any) {
        console.error(`[REPORTER_REMINDER_PUSH_ERR] ${reporterId}:`, err.message);
        return { tokensTargeted: tokens.length, sentCount: 0, status: "FAILED" };
    }
}

/**
 * Notifies Admins (in-app notice + FCM push) when a reporter crosses Day 10+ inactivity.
 */
export async function sendAdminInactivityAlert(
    reporterId: string,
    reporter: any,
    daysInactive: number
): Promise<{ tokensTargeted: number; sentCount: number; status: "SENT" | "NO_TOKENS" | "FAILED" }> {
    try {
        const reporterName = reporter.name || "విలేకరి";
        const mandal = reporter.assignedMandal || reporter.mandal || "";
        const district = reporter.district || "";
        const locationStr =
            mandal && district
                ? `${mandal}, ${district}`
                : mandal || district || "జిల్లా/మండలం లేదు";

        const title = `రిపోర్టర్ నిష్క్రియా సమాచారం`;
        const body = `${reporterName} (${locationStr}) గత ${daysInactive} రోజులుగా వార్తలు పోస్ట్ చేయలేదు. దయచేసి పరిశీలించగలరు.`;
        const timestamp = admin.firestore.FieldValue.serverTimestamp();

        const adminSnap = await db
            .collection("users")
            .where("role", "in", ["ADMIN", "admin", "5", "5.0", "7", "7.0", 5, 7])
            .limit(10)
            .get();

        let tokensTargeted = 0;
        let sentCount = 0;

        for (const adminDoc of adminSnap.docs) {
            const adminId = adminDoc.id;
            const adminData = adminDoc.data();

            await db
                .collection("users")
                .doc(adminId)
                .collection("messages")
                .add({
                    title,
                    body,
                    senderName: "AlfaNews Editorial Desk",
                    senderRole: "ADMIN",
                    read: false,
                    timestamp,
                    importance: "HIGH",
                    type: "REPORTER_INACTIVITY_NOTICE",
                    reporterId,
                    reporterName,
                    mandal,
                    district,
                    daysInactive
                });

            const tokens = extractUserTokens(adminData);
            if (tokens.length > 0) {
                tokensTargeted += tokens.length;
                const messages = tokens.map((token) => ({
                    token,
                    android: {
                        priority: "high" as const,
                        notification: {
                            channelId: "general_news_v2",
                            sound: "default"
                        }
                    },
                    notification: { title, body },
                    data: {
                        type: "REPORTER_INACTIVITY_NOTICE",
                        reporterId,
                        daysInactive: String(daysInactive),
                        title,
                        body
                    }
                }));
                const res = await admin.messaging().sendEach(messages).catch(() => null);
                if (res) sentCount += res.successCount;
            }
        }

        const status =
            adminSnap.size === 0 ? "NO_TOKENS" : sentCount > 0 || adminSnap.size > 0 ? "SENT" : "FAILED";
        console.log(
            `[ADMIN_INACTIVITY_ALERT] Alerted ${adminSnap.size} admins for inactive reporter ${reporterName} (${daysInactive}d)`
        );
        return { tokensTargeted, sentCount, status };
    } catch (err: any) {
        console.error(`[ADMIN_INACTIVITY_ALERT_ERR]:`, err.message);
        return { tokensTargeted: 0, sentCount: 0, status: "FAILED" };
    }
}

export interface ScanPreviewItem {
    reporterId: string;
    reporterName: string;
    district: string;
    mandal: string;
    daysInactive: number;
    action: string;
    nextStage: string;
    reason: string;
}

export interface ReporterActivityScanResult {
    dryRun: boolean;
    configEnabled: boolean;
    reportersScanned: number;
    inactiveActedOn: number;
    day3Count: number;
    day7Count: number;
    day10AdminAlertCount: number;
    day3RemindersSent: number;
    day7RemindersSent: number;
    adminAlertsSent: number;
    skippedExempt: number;
    previewItems: ScanPreviewItem[];
    previewActions: ScanPreviewItem[];
}

function emptyScanResult(dryRun: boolean, configEnabled: boolean): ReporterActivityScanResult {
    return {
        dryRun,
        configEnabled,
        reportersScanned: 0,
        inactiveActedOn: 0,
        day3Count: 0,
        day7Count: 0,
        day10AdminAlertCount: 0,
        day3RemindersSent: 0,
        day7RemindersSent: 0,
        adminAlertsSent: 0,
        skippedExempt: 0,
        previewItems: [],
        previewActions: []
    };
}

/**
 * Core unified scanner: evaluates active reporters in a single bounded pass (ZERO news queries).
 * Dispatches Day 3 push, Day 7 follow-up push (Push-Only, never Desk Chat), and Day 10+ Admin alerts.
 */
export async function runReporterActivityScan(options?: {
    dryRun?: boolean;
    ignoreEnabledFlag?: boolean;
    nowMs?: number;
}): Promise<ReporterActivityScanResult> {
    const dryRun = options?.dryRun === true;
    const nowMs = options?.nowMs ?? Date.now();
    const config: ReporterTrackingConfig = await getReporterTrackingConfig();

    if (!config.enabled && !dryRun && !options?.ignoreEnabledFlag) {
        console.log("[REPORTER_MONITOR] Automated inactivity reminders are paused in settings.");
        return emptyScanResult(dryRun, false);
    }

    // Enforce night quiet hours (11 PM - 6 AM IST) for scheduled automated dispatches
    if (!dryRun && !options?.ignoreEnabledFlag && isQuietHoursIst(nowMs)) {
        console.log("[REPORTER_MONITOR] Skipping automated scan during night quiet hours (11 PM - 6 AM IST).");
        return emptyScanResult(dryRun, config.enabled);
    }

    const reportersSnap = await db
        .collection("users")
        .where("role", "in", REPORTER_ROLE_VALUES)
        .limit(500)
        .get();

    if (reportersSnap.empty) {
        return emptyScanResult(dryRun, config.enabled);
    }

    let day3Count = 0;
    let day7Count = 0;
    let day10AdminAlertCount = 0;
    let inactiveActedOn = 0;
    let skippedExempt = 0;
    const previewItems: ScanPreviewItem[] = [];

    for (const doc of reportersSnap.docs) {
        const reporterId = doc.id;
        const reporter = doc.data();

        if (reporter.suspended === true || reporter.previouslyDowngraded === true) {
            continue;
        }

        // Initialize fresh grace timestamp only if reporter has zero date markers at all
        const hasAnyDateMarker =
            parseEpochMs(reporter.reporterActivity?.lastApprovedPostAt) !== null ||
            parseEpochMs(reporter.lastPostTimestamp) !== null ||
            parseEpochMs(reporter.promotedAt) !== null ||
            parseEpochMs(reporter.rejoinedAt) !== null ||
            parseEpochMs(reporter.roleUpdatedAt) !== null ||
            parseEpochMs(reporter.joinedAt) !== null ||
            parseEpochMs(reporter.createdAt) !== null ||
            parseEpochMs(reporter.timestamp) !== null;

        if (!hasAnyDateMarker) {
            if (!dryRun) {
                await db
                    .collection("users")
                    .doc(reporterId)
                    .set(
                        {
                            promotedAt: nowMs,
                            warningLevel: 0,
                            inProbation: false,
                            reporterActivity: {
                                totalApprovedPosts: Number(reporter.totalNewsCount || 0),
                                lastApprovedPostAt: null,
                                dailyCounts: {},
                                inactivityStage: reporter.exemptFromInactivity === true ? "EXEMPT" : "ACTIVE",
                                lastReminderSentAt: null,
                                lastReminderStage: null,
                                lastAdminAlertAt: null,
                                lastSyncedAt: nowMs
                            }
                        },
                        { merge: true }
                    );
            }
            continue;
        }

        const evaluation = evaluateReporterInactivity(reporter, config, nowMs);
        const reporterName = reporter.name || "విలేకరి";
        const district = reporter.district || "";
        const mandal = reporter.assignedMandal || reporter.mandal || "";

        // Keep stored inactivityStage synchronized when it drifts (without sending messages)
        const currentStoredStage = reporter.reporterActivity?.inactivityStage;
        if (!dryRun && currentStoredStage !== evaluation.nextStage && evaluation.action === "NONE") {
            await db
                .collection("users")
                .doc(reporterId)
                .set(
                    {
                        warningLevel: 0,
                        inProbation: false,
                        reporterActivity: {
                            inactivityStage: evaluation.nextStage
                        }
                    },
                    { merge: true }
                )
                .catch(() => {});
        }

        if (evaluation.nextStage === "EXEMPT") {
            skippedExempt++;
        }

        if (evaluation.action === "NONE") {
            continue;
        }

        previewItems.push({
            reporterId,
            reporterName,
            district,
            mandal,
            daysInactive: evaluation.daysInactive,
            action: evaluation.action,
            nextStage: evaluation.nextStage,
            reason: evaluation.reason
        });

        if (evaluation.action === "SEND_DAY_3_PUSH") {
            day3Count++;
            inactiveActedOn++;
            if (!dryRun) {
                const title = renderReminderTemplate(config.day3Title, {
                    name: reporterName,
                    days: evaluation.daysInactive,
                    mandal: mandal || district || "మీ ప్రాంతం"
                });
                const body = renderReminderTemplate(config.day3Body, {
                    name: reporterName,
                    days: evaluation.daysInactive,
                    mandal: mandal || district || "మీ ప్రాంతం"
                });

                const delivery = await sendReporterReminderPushOnly(
                    reporterId,
                    reporter,
                    title,
                    body,
                    "DAY_3",
                    evaluation.daysInactive
                );

                await db
                    .collection("users")
                    .doc(reporterId)
                    .set(
                        {
                            warningLevel: 0,
                            inProbation: false,
                            reporterActivity: {
                                inactivityStage: "REMINDED_3D",
                                lastReminderSentAt: nowMs,
                                lastReminderStage: "DAY_3"
                            }
                        },
                        { merge: true }
                    );

                const logEntry: ReporterReminderLog = {
                    reporterId,
                    reporterName,
                    district,
                    mandal,
                    stage: "DAY_3",
                    daysInactive: evaluation.daysInactive,
                    channel: "PUSH",
                    tokensTargeted: delivery.tokensTargeted,
                    sentCount: delivery.sentCount,
                    status: delivery.status,
                    timestamp: nowMs
                };
                await db.collection("reporter_reminder_logs").add(logEntry);
            }
        } else if (evaluation.action === "SEND_DAY_7_PUSH") {
            day7Count++;
            inactiveActedOn++;
            if (!dryRun) {
                const title = renderReminderTemplate(config.day7Title, {
                    name: reporterName,
                    days: evaluation.daysInactive,
                    mandal: mandal || district || "మీ ప్రాంతం"
                });
                const body = renderReminderTemplate(config.day7Body, {
                    name: reporterName,
                    days: evaluation.daysInactive,
                    mandal: mandal || district || "మీ ప్రాంతం"
                });

                const delivery = await sendReporterReminderPushOnly(
                    reporterId,
                    reporter,
                    title,
                    body,
                    "DAY_7",
                    evaluation.daysInactive
                );

                await db
                    .collection("users")
                    .doc(reporterId)
                    .set(
                        {
                            warningLevel: 0,
                            inProbation: false,
                            reporterActivity: {
                                inactivityStage: "REMINDED_7D",
                                lastReminderSentAt: nowMs,
                                lastReminderStage: "DAY_7"
                            }
                        },
                        { merge: true }
                    );

                const logEntry: ReporterReminderLog = {
                    reporterId,
                    reporterName,
                    district,
                    mandal,
                    stage: "DAY_7",
                    daysInactive: evaluation.daysInactive,
                    channel: "PUSH",
                    tokensTargeted: delivery.tokensTargeted,
                    sentCount: delivery.sentCount,
                    status: delivery.status,
                    timestamp: nowMs
                };
                await db.collection("reporter_reminder_logs").add(logEntry);
            }
        } else if (evaluation.action === "SEND_DAY_10_ADMIN_ALERT") {
            day10AdminAlertCount++;
            inactiveActedOn++;
            if (!dryRun) {
                const delivery = await sendAdminInactivityAlert(
                    reporterId,
                    reporter,
                    evaluation.daysInactive
                );

                await db
                    .collection("users")
                    .doc(reporterId)
                    .set(
                        {
                            warningLevel: 0,
                            inProbation: false,
                            lastAdminInactivityAlertDate: nowMs,
                            reporterActivity: {
                                inactivityStage: "ADMIN_ALERTED_10D",
                                lastAdminAlertAt: nowMs
                            }
                        },
                        { merge: true }
                    );

                const logEntry: ReporterReminderLog = {
                    reporterId,
                    reporterName,
                    district,
                    mandal,
                    stage: "DAY_10_ADMIN",
                    daysInactive: evaluation.daysInactive,
                    channel: "ADMIN_ALERT",
                    tokensTargeted: delivery.tokensTargeted,
                    sentCount: delivery.sentCount,
                    status: delivery.status,
                    timestamp: nowMs
                };
                await db.collection("reporter_reminder_logs").add(logEntry);
            }
        }
    }

    console.log(
        `[REPORTER_MONITOR] Scan complete (dryRun=${dryRun}): scanned=${reportersSnap.size}, acted=${inactiveActedOn} (day3=${day3Count}, day7=${day7Count}, day10Admin=${day10AdminAlertCount})`
    );

    const cappedPreview = previewItems.slice(0, 100);

    return {
        dryRun,
        configEnabled: config.enabled,
        reportersScanned: reportersSnap.size,
        inactiveActedOn,
        day3Count,
        day7Count,
        day10AdminAlertCount,
        day3RemindersSent: day3Count,
        day7RemindersSent: day7Count,
        adminAlertsSent: day10AdminAlertCount,
        skippedExempt,
        previewItems: cappedPreview,
        previewActions: cappedPreview
    };
}

/**
 * Scheduled function to monitor reporter inactivity.
 * Runs once daily at 10:00 AM IST in asia-south1.
 */
export const monitorReporterActivity = onSchedule(
    {
        schedule: "0 10 * * *",
        timeZone: "Asia/Kolkata",
        region: REGION,
        memory: "256MiB",
        timeoutSeconds: 300
    },
    async () => {
        await runReporterActivityScan({ dryRun: false });
    }
);

/**
 * Admin callable to run a manual scan or dry-run preview.
 */
export const triggerReporterActivityCheck = onCall(
    {
        region: REGION,
        memory: "256MiB",
        timeoutSeconds: 120
    },
    async (request) => {
        await assertAdminCaller(request.auth);
        const dryRun = request.data?.dryRun === true;
        const result = await runReporterActivityScan({
            dryRun,
            ignoreEnabledFlag: true
        });
        return { success: true, ...result };
    }
);

/**
 * Admin callable to read central reporter tracking configuration.
 */
export const getReporterTrackingSettings = onCall(
    {
        region: REGION,
        memory: "256MiB",
        timeoutSeconds: 30
    },
    async (request) => {
        await assertAdminCaller(request.auth);
        const config = await getReporterTrackingConfig();
        return { success: true, config };
    }
);

/**
 * Admin callable to update central reporter tracking configuration.
 */
export const updateReporterTrackingSettings = onCall(
    {
        region: REGION,
        memory: "256MiB",
        timeoutSeconds: 30
    },
    async (request) => {
        const adminUid = await assertAdminCaller(request.auth);
        const updates = request.data?.config || request.data || {};
        const config = await saveReporterTrackingConfig(updates, adminUid);
        return { success: true, config };
    }
);

/**
 * Admin callable to run bounded historical reconciliation for all active reporters.
 */
export const syncReporterActivityStats = onCall(
    {
        region: REGION,
        memory: "512MiB",
        timeoutSeconds: 240
    },
    async (request) => {
        await assertAdminCaller(request.auth);
        const maxNewsScan = Number(request.data?.maxNewsScan || 2000);
        const result = await syncAllReporterActivityStats({ maxNewsScan });
        return { success: true, ...result };
    }
);

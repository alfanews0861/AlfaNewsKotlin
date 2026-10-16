import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall } from "firebase-functions/v2/https";
import { UserRole } from "./types";

if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();

/**
 * Helper to parse various timestamp formats into a valid Date object or null
 */
export function parseToDate(val: any): Date | null {
    if (!val) return null;
    try {
        if (typeof val.toDate === 'function') return val.toDate();
        if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
        if (typeof val === 'number') {
            const ms = val > 1e11 ? val : val * 1000;
            const d = new Date(ms);
            return isNaN(d.getTime()) ? null : d;
        }
        if (val.seconds && typeof val.seconds === 'number') {
            return new Date(val.seconds * 1000);
        }
        if (val._seconds && typeof val._seconds === 'number') {
            return new Date(val._seconds * 1000);
        }
        if (typeof val === 'string') {
            const trimmed = val.trim();
            if (/^\d+$/.test(trimmed)) {
                const num = Number(trimmed);
                const ms = num > 1e11 ? num : num * 1000;
                const d = new Date(ms);
                return isNaN(d.getTime()) ? null : d;
            }
            const parsed = new Date(trimmed);
            return isNaN(parsed.getTime()) ? null : parsed;
        }
        return null;
    } catch {
        return null;
    }
}

export interface ReporterNewsActivitySummary {
    latestDate: Date | null;
    totalPosts: number;
    recentPostsLast7Days: number;
    recentPostsLast30Days: number;
}

/**
 * Deep multi-field news activity inspection:
 * Queries all fields (reporter.id, originalReporterId, reporterId, userId, reporter.phone, reporter.name)
 * across the news collection without early-break, calculating:
 * - Latest post date
 * - Total lifetime posts
 * - Recent posts in the last 7 days
 * - Recent posts in the last 30 days
 */
export async function getReporterActivitySummary(
    reporterId: string, 
    reporterName?: string, 
    reporterPhone?: string
): Promise<ReporterNewsActivitySummary> {
    const summary: ReporterNewsActivitySummary = {
        latestDate: null,
        totalPosts: 0,
        recentPostsLast7Days: 0,
        recentPostsLast30Days: 0
    };

    if (!reporterId) return summary;

    const now = new Date();
    const sevenDaysAgoMs = now.getTime() - (7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgoMs = now.getTime() - (30 * 24 * 60 * 60 * 1000);

    const seenDocIds = new Set<string>();

    const checkDocs = (docs: admin.firestore.QueryDocumentSnapshot[]) => {
        for (const doc of docs) {
            if (seenDocIds.has(doc.id)) continue;
            seenDocIds.add(doc.id);

            const data = doc.data();
            const date = parseToDate(data.timestamp || data.createdAt || data.lastUpdated || data.publishedAt);
            if (date) {
                const time = date.getTime();
                if (!summary.latestDate || time > summary.latestDate.getTime()) {
                    summary.latestDate = date;
                }
                if (time >= sevenDaysAgoMs) {
                    summary.recentPostsLast7Days++;
                }
                if (time >= thirtyDaysAgoMs) {
                    summary.recentPostsLast30Days++;
                }
            }
        }
        summary.totalPosts = seenDocIds.size;
    };

    const queryPromises: Promise<void>[] = [];

    // 1. Direct ID fields across news posts
    const idFields = ['reporter.id', 'originalReporterId', 'reporterId', 'userId'];
    for (const field of idFields) {
        queryPromises.push((async () => {
            try {
                const snap = await db.collection('news')
                    .where(field, '==', reporterId)
                    .orderBy('timestamp', 'desc')
                    .limit(5)
                    .get();
                if (!snap.empty) checkDocs(snap.docs);
            } catch {
                try {
                    const snap = await db.collection('news')
                        .where(field, '==', reporterId)
                        .limit(25)
                        .get();
                    if (!snap.empty) checkDocs(snap.docs);
                } catch {}
            }
        })());
    }

    // 2. Match by reporter phone number if available
    if (reporterPhone && typeof reporterPhone === 'string' && reporterPhone.trim()) {
        const clean10 = reporterPhone.replace(/\D/g, '').slice(-10);
        const phonesToQuery = [reporterPhone.trim()];
        if (clean10.length === 10 && !phonesToQuery.includes(clean10)) {
            phonesToQuery.push(clean10);
            phonesToQuery.push(`+91${clean10}`);
        }
        for (const ph of phonesToQuery) {
            queryPromises.push((async () => {
                try {
                    const snap = await db.collection('news')
                        .where('reporter.phone', '==', ph)
                        .limit(20)
                        .get();
                    if (!snap.empty) checkDocs(snap.docs);
                } catch {}
            })());
        }
    }

    // 3. Match by reporter name if unique and not generic placeholder
    if (reporterName && typeof reporterName === 'string' && reporterName.trim() && 
        !['Reporter', 'విలేకరి', 'Admin', 'Alfa News Desk', 'AlfaNews Admin'].includes(reporterName.trim())) {
        queryPromises.push((async () => {
            try {
                const snap = await db.collection('news')
                    .where('reporter.name', '==', reporterName.trim())
                    .limit(20)
                    .get();
                if (!snap.empty) checkDocs(snap.docs);
            } catch {}
        })());
    }

    await Promise.allSettled(queryPromises);

    return summary;
}

/**
 * Robust verification: Returns the latest news post date for a reporter.
 * Backwards-compatible with callers expecting Date | null.
 */
export async function getActualLatestNewsDate(
    reporterId: string, 
    reporterName?: string,
    reporterPhone?: string
): Promise<Date | null> {
    const summary = await getReporterActivitySummary(reporterId, reporterName, reporterPhone);
    return summary.latestDate;
}

/**
 * Calculates days of inactivity for a reporter based on last post timestamp or promotion date.
 * Always takes the maximum (most recent) date between actual news collection date and user doc lastPostTimestamp.
 */
export function calculateDaysInactive(reporter: any, now: Date, actualNewsDate?: Date | null): number {
    const userDocLastPost = parseToDate(reporter.lastPostTimestamp);

    // Pick the most recent timestamp between actualNewsDate and userDocLastPost
    let lastPost: Date | null = null;
    if (actualNewsDate && userDocLastPost) {
        lastPost = actualNewsDate.getTime() > userDocLastPost.getTime() ? actualNewsDate : userDocLastPost;
    } else {
        lastPost = actualNewsDate || userDocLastPost;
    }

    const promotedAt = parseToDate(reporter.promotedAt) || parseToDate(reporter.rejoinedAt) || parseToDate(reporter.roleUpdatedAt);
    const createdAt = parseToDate(reporter.timestamp) || parseToDate(reporter.createdAt) || parseToDate(reporter.joinedAt);

    // 1. Pick the most recent activity marker between lastPost and promotedAt
    let referenceDate: Date | null = null;
    if (lastPost && promotedAt) {
        referenceDate = lastPost.getTime() > promotedAt.getTime() ? lastPost : promotedAt;
    } else if (lastPost) {
        referenceDate = lastPost;
    } else if (promotedAt) {
        referenceDate = promotedAt;
    }

    if (referenceDate) {
        const diffTime = Math.max(0, now.getTime() - referenceDate.getTime());
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    // 2. Fallback for accounts created recently without lastPost/promotedAt
    if (createdAt) {
        const diffTime = Math.max(0, now.getTime() - createdAt.getTime());
        const daysSinceCreation = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (daysSinceCreation < 14) {
            return daysSinceCreation;
        }
    }

    // Default to 0 (grace period) if timestamps are not yet populated
    return 0;
}

/**
 * Core scanner function to evaluate reporter activity.
 * Sends a polite request to reporters who haven't posted in 3+ days,
 * and notifies Admins if a reporter has been inactive for 10+ consecutive days.
 * 🛡️ Automated demotions, warning levels, and threatening alerts are completely disabled.
 */
export async function runReporterActivityScan() {
    console.log("[REPORTER_MONITOR] 🔍 Starting reporter activity scan...");

    const now = new Date();

    // Fetch all active reporters (handling string, numeric, and enum role formats)
    const reportersSnapshot = await db.collection('users')
        .where('role', 'in', [UserRole.REPORTER, 'REPORTER', 'reporter', 2, 2.0, '2'])
        .get();

    if (reportersSnapshot.empty) {
        console.log("[REPORTER_MONITOR] No reporters found in database.");
        return { reportersScanned: 0, inactiveActedOn: 0 };
    }

    console.log(`[REPORTER_MONITOR] Scanning ${reportersSnapshot.size} reporters for activity...`);
    let inactiveCount = 0;

    for (const doc of reportersSnapshot.docs) {
        const reporter = doc.data();
        const reporterId = doc.id;

        // Skip suspended or admin-demoted accounts
        if (reporter.suspended === true || reporter.previouslyDowngraded === true) {
            continue;
        }

        // Auto-fix for existing reporters lacking promotedAt and lastPostTimestamp
        if (!reporter.lastPostTimestamp && !reporter.promotedAt && !reporter.rejoinedAt && !reporter.roleUpdatedAt) {
            console.log(`[REPORTER_MONITOR] Auto-initializing 14-day grace period for reporter ${reporter.name || reporterId}...`);
            await db.collection('users').doc(reporterId).set({
                promotedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastPostTimestamp: admin.firestore.FieldValue.serverTimestamp(),
                rejoinedAt: admin.firestore.FieldValue.serverTimestamp(),
                warningLevel: 0,
                inProbation: false,
                previouslyDowngraded: false,
                suspended: false
            }, { merge: true });
            continue;
        }

        const acted = await handleReporterStatus(reporterId, reporter, now);
        if (acted) inactiveCount++;
    }

    console.log(`[REPORTER_MONITOR] Activity scan complete. Acted on ${inactiveCount} reporters.`);
    return { reportersScanned: reportersSnapshot.size, inactiveActedOn: inactiveCount };
}

/**
 * Scheduled function to monitor reporter activity.
 * Runs daily at 00:00 IST (18:30 UTC previous day).
 */
export const monitorReporterActivity = onSchedule({
    schedule: "0 0 * * *",
    timeZone: "Asia/Kolkata",
    memory: "512MiB",
    timeoutSeconds: 540
}, async (event) => {
    await runReporterActivityScan();
});

/**
 * Callable function to manually trigger reporter activity evaluation on demand.
 * Allows Admins or test scripts to run performance evaluation immediately.
 */
export const triggerReporterActivityCheck = onCall({
    memory: "256MiB",
    timeoutSeconds: 60
}, async (request) => {
    console.log("[REPORTER_MONITOR_MANUAL] Manual activity check triggered...");
    const result = await runReporterActivityScan();
    return { success: true, ...result };
});

/**
 * Sends notification and in-app message to Admins when a reporter has not posted
 * for more than 10 consecutive days.
 */
export async function sendAdminInactivityAlert(
    reporterId: string, 
    reporter: any, 
    daysInactive: number
) {
    try {
        const reporterName = reporter.name || "విలేకరి";
        const mandal = reporter.assignedMandal || reporter.mandal || "";
        const district = reporter.district || "";
        const locationStr = mandal && district ? `${mandal}, ${district}` : (mandal || district || "జిల్లా/మండలం లేదు");

        const title = `రిపోర్టర్ నిష్క్రియా సమాచారం ⚠️`;
        const body = `${reporterName} (${locationStr}) గత ${daysInactive} రోజులుగా ఎటువంటి వార్తలు పోస్ట్ చేయలేదు. దయచేసి పరిశీలించగలరు.`;
        const timestamp = admin.firestore.FieldValue.serverTimestamp();

        // Query all Admins and Super Admins
        const adminSnap = await db.collection('users')
            .where('role', 'in', ['ADMIN', 'admin', '5', '5.0', '7', '7.0', 5, 7])
            .limit(10)
            .get();

        for (const adminDoc of adminSnap.docs) {
            const adminId = adminDoc.id;
            const adminData = adminDoc.data();

            // 1. Add to admin's in-app messages subcollection
            await db.collection('users').doc(adminId).collection('messages').add({
                title,
                body,
                senderName: "AlfaNews System",
                senderRole: "SYSTEM",
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

            // 2. Send push to Admin if FCM token exists
            const rawTokens: any[] = [...(adminData?.fcmTokens || []), adminData?.fcmToken];
            const tokens = Array.from(new Set(rawTokens.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)));

            if (tokens.length > 0) {
                const messages = tokens.map(token => ({
                    token,
                    notification: { title, body },
                    data: {
                        type: "REPORTER_INACTIVITY_NOTICE",
                        reporterId,
                        daysInactive: String(daysInactive),
                        title,
                        body
                    }
                }));
                await admin.messaging().sendEach(messages).catch(() => {});
            }
        }
        console.log(`[ADMIN_INACTIVITY_ALERT] 📩 Alerted ${adminSnap.size} admins for inactive reporter ${reporterName} (${daysInactive} days)`);
    } catch (err: any) {
        console.error(`[ADMIN_INACTIVITY_ALERT_ERR]:`, err.message);
    }
}

export async function handleReporterStatus(
    reporterId: string, 
    reporter: any, 
    now: Date = new Date()
): Promise<boolean> {
    // Clean up any legacy warning levels or probation flags
    const currentLevel = Number(reporter.warningLevel || 0);
    const inProbation = reporter.inProbation === true;
    if (currentLevel > 0 || inProbation || reporter.lastWarningDate) {
        await db.collection('users').doc(reporterId).set({
            warningLevel: 0,
            inProbation: false,
            lastWarningDate: null
        }, { merge: true });
    }

    // 1. Fetch comprehensive news activity summary across all fields
    const summary = await getReporterActivitySummary(reporterId, reporter.name, reporter.phone);
    const userDocLastPost = parseToDate(reporter.lastPostTimestamp);

    // Take the maximum of summary.latestDate and userDocLastPost
    let actualNewsDate: Date | null = null;
    if (summary.latestDate && userDocLastPost) {
        actualNewsDate = summary.latestDate.getTime() > userDocLastPost.getTime() ? summary.latestDate : userDocLastPost;
    } else {
        actualNewsDate = summary.latestDate || userDocLastPost;
    }

    // Sync latest post timestamp back to users doc if newer
    if (actualNewsDate && (!userDocLastPost || actualNewsDate.getTime() > userDocLastPost.getTime())) {
        await db.collection('users').doc(reporterId).set({
            lastPostTimestamp: actualNewsDate
        }, { merge: true });
        reporter.lastPostTimestamp = actualNewsDate;
    }

    // 2. Calculate actual days inactive
    const daysInactive = calculateDaysInactive(reporter, now, actualNewsDate);

    // 3. Auto-heal reporter points if posts exist but points are 0
    let points = Number(reporter.points || 0);
    const totalNewsPosts = Math.max(summary.totalPosts, Math.floor(points / 10));
    if (totalNewsPosts > 0 && points === 0) {
        points = totalNewsPosts * 10;
        await db.collection('users').doc(reporterId).set({ points }, { merge: true });
        reporter.points = points;
    }

    // Exempt accounts check
    if (reporter.exemptFromInactivity === true) {
        return false;
    }

    // Rule 1: వరుసగా 10 రోజుల పైన ఎవరైనా రిపోర్టర్ వార్తలు పెట్టకపోతే అడ్మిన్‌కు సమాచారం పంపు
    if (daysInactive >= 10) {
        const lastAdminAlert = parseToDate(reporter.lastAdminInactivityAlertDate);
        const daysSinceAdminAlert = lastAdminAlert 
            ? (now.getTime() - lastAdminAlert.getTime()) / (1000 * 60 * 60 * 24) 
            : 999;

        // Throttle admin alert to once every 5 days per inactive reporter
        if (daysSinceAdminAlert >= 5) {
            await db.collection('users').doc(reporterId).set({
                lastAdminInactivityAlertDate: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            await sendAdminInactivityAlert(reporterId, reporter, daysInactive);
            return true;
        }
        return false;
    }

    // Rule 2: వరుసగా 3 రోజులు వార్తలు పెట్టకపోతే రిపోర్టర్‌కి వార్తలు పంపమని రిక్వెస్ట్ మాత్రమే పంపు (హెచ్చరికలు, వార్నింగ్‌లు లేకుండా)
    if (daysInactive >= 3) {
        const lastNewsRequest = parseToDate(reporter.lastNewsRequestDate);
        const daysSinceRequest = lastNewsRequest 
            ? (now.getTime() - lastNewsRequest.getTime()) / (1000 * 60 * 60 * 24) 
            : 999;

        // Throttle request to once every 3 days so reporter is not spammed daily
        if (daysSinceRequest >= 3) {
            console.log(`[REPORTER_MONITOR] 📰 Sending news request to reporter ${reporter.name || reporterId} (inactive: ${daysInactive}d).`);
            await db.collection('users').doc(reporterId).set({
                lastNewsRequestDate: admin.firestore.FieldValue.serverTimestamp(),
                warningLevel: 0,
                inProbation: false
            }, { merge: true });

            const reporterName = reporter.name || "విలేకరి";
            const reqTitle = "మీ ప్రాంత తాజా వార్తలు పంపండి 📰";
            const reqBody = `నమస్కారం ${reporterName} గారు, గత 3 రోజులుగా మీ మండల వార్తలు రాలేదు. మీ ప్రాంత తాజా విశేషాలు, ప్రజా సమస్యల వార్తలను Alfa News లో పోస్ట్ చేయగలరని కోరుతున్నాము. ధన్యవాదాలు!`;

            await sendInternalMessage(
                reporterId, 
                reqTitle, 
                reqBody, 
                "NORMAL", 
                reporter, 
                "REQUEST"
            );
            return true;
        }
    }

    return false;
}

export async function sendInternalMessage(
    userId: string, 
    title: string, 
    body: string, 
    importance: string, 
    userData?: any,
    msgType: string = "INTERNAL_MESSAGE"
) {
    try {
        const timestamp = admin.firestore.FieldValue.serverTimestamp();
        const isWarning = msgType === "WARNING" || importance === "HIGH" || importance === "CRITICAL";
        const messageData = {
            title,
            body,
            senderName: "AlfaNews Admin",
            senderRole: "ADMIN",
            read: false,
            timestamp,
            importance,
            type: msgType,
            isWarning
        };

        // 1. Add to user's personal messages subcollection
        await db.collection('users').doc(userId).collection('messages').add(messageData);

        // 2. Add to their reporter_conversations thread
        try {
            const icon = isWarning ? "⚠️ " : "📰 ";
            await db.collection('reporter_conversations').doc(userId).collection('messages').add({
                senderId: "SYSTEM_ADMIN",
                senderName: "AlfaNews Admin",
                senderRole: "ADMIN",
                text: `${icon}[${title}]\n${body}`,
                type: msgType === "WARNING" ? "WARNING" : "NOTICE",
                isWarning,
                importance,
                read: false,
                timestamp
            });

            await db.collection('reporter_conversations').doc(userId).set({
                reporterId: userId,
                reporterName: userData?.name || "Reporter",
                reporterPhone: userData?.phone || "",
                reporterDistrict: userData?.district || "",
                reporterMandal: userData?.assignedMandal || userData?.mandal || "",
                lastMessage: `${icon}${title}`,
                lastMessageTime: timestamp,
                lastSenderRole: "ADMIN",
                unreadCountForReporter: admin.firestore.FieldValue.increment(1),
                updatedAt: timestamp
            }, { merge: true });
        } catch (err: any) {
            console.error(`[CONV_WRITE_ERR] ${userId}:`, err.message);
        }

        // 3. Fetch tokens and send High-Priority FCM Push
        const data = userData || (await db.collection('users').doc(userId).get()).data();
        if (data && (data.notificationsEnabled === false || data.pushEnabled === false)) return;

        const rawTokens: any[] = [...(data?.fcmTokens || []), data?.fcmToken];
        const tokens = Array.from(new Set(rawTokens.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)));

        if (tokens.length > 0) {
            const messages = tokens.map(token => ({
                token,
                android: {
                    priority: 'high' as const,
                    ttl: 86400000,
                    directBootOk: true,
                    notification: {
                        channelId: 'general_news_v2',
                        sound: 'default'
                    }
                },
                notification: {
                    title,
                    body
                },
                data: {
                    type: "INTERNAL_MESSAGE",
                    title,
                    body,
                    importance,
                    channelId: 'general_news_v2'
                }
            }));
            await admin.messaging().sendEach(messages).catch(err => console.error(`[FCM_ERROR] User ${userId}:`, err));
        }
    } catch (err) {
        console.error(`[SEND_INTERNAL_MSG_ERROR] User ${userId}:`, err);
    }
}




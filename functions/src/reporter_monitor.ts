import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall } from "firebase-functions/v2/https";
import { UserRole } from "./types";

const db = admin.firestore();

/**
 * Helper to parse various timestamp formats into a valid Date object or null
 */
function parseToDate(val: any): Date | null {
    if (!val) return null;
    try {
        if (typeof val.toDate === 'function') return val.toDate();
        if (val instanceof Date) return val;
        if (typeof val === 'number') return new Date(val);
        if (val.seconds && typeof val.seconds === 'number') return new Date(val.seconds * 1000);
        const parsed = new Date(val);
        return isNaN(parsed.getTime()) ? null : parsed;
    } catch {
        return null;
    }
}

/**
 * Calculates days of inactivity for a reporter based on last post timestamp or promotion date.
 * Ensures newly promoted / re-upgraded reporters are NOT falsely downgraded using account creation date.
 */
function calculateDaysInactive(reporter: any, now: Date): number {
    const lastPost = parseToDate(reporter.lastPostTimestamp);
    const promotedAt = parseToDate(reporter.promotedAt) || parseToDate(reporter.roleUpdatedAt);
    const createdAt = parseToDate(reporter.timestamp);

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
        if (daysSinceCreation < 10) {
            return daysSinceCreation;
        }
    }

    // If createdAt is old (e.g., created months ago as guest/subscriber) and promotedAt is missing,
    // return 0 so the system does NOT falsely downgrade them immediately!
    return 0;
}

/**
 * Core scanner function to evaluate reporter activity and send warnings / admin copies.
 */
export async function runReporterActivityScan() {
    console.log("[REPORTER_MONITOR] Starting reporter activity scan...");

    const now = new Date();

    // Fetch all reporters (handling string, numeric, and enum role formats)
    const reportersSnapshot = await db.collection('users')
        .where('role', 'in', [UserRole.REPORTER, 'REPORTER', 'reporter', 2, 2.0, '2'])
        .select('name', 'lastPostTimestamp', 'promotedAt', 'roleUpdatedAt', 'timestamp', 'warningLevel', 'inProbation', 'fcmTokens', 'fcmToken', 'role', 'phone')
        .get();

    if (reportersSnapshot.empty) {
        console.log("[REPORTER_MONITOR] No reporters found in database.");
        return { reportersScanned: 0, inactiveActedOn: 0 };
    }

    console.log(`[REPORTER_MONITOR] Scanning ${reportersSnapshot.size} reporters for inactivity...`);
    let inactiveCount = 0;

    // Cache for admin list to avoid querying admins repeatedly inside loops
    let cachedAdmins: admin.firestore.QueryDocumentSnapshot[] | null = null;
    async function getAdmins() {
        if (!cachedAdmins) {
            // Include enum string, lowercase, and numeric legacy role representations
            const adminsSnapshot = await db.collection('users')
                .where('role', 'in', [UserRole.ADMIN, 'ADMIN', 'admin', 5, 5.0, '5', 7, 7.0, '7'])
                .select('name', 'fcmTokens', 'fcmToken', 'role')
                .get();
            cachedAdmins = adminsSnapshot.docs;
        }
        return cachedAdmins;
    }

    for (const doc of reportersSnapshot.docs) {
        const reporter = doc.data();
        const reporterId = doc.id;

        // Auto-fix for existing reporters lacking promotedAt and lastPostTimestamp
        if (!reporter.lastPostTimestamp && !reporter.promotedAt && !reporter.roleUpdatedAt) {
            console.log(`[REPORTER_MONITOR] Auto-initializing 10-day grace period for reporter ${reporter.name || reporterId}...`);
            await db.collection('users').doc(reporterId).update({
                promotedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastPostTimestamp: admin.firestore.FieldValue.serverTimestamp(),
                warningLevel: 0,
                inProbation: false
            });
            continue; // Skip this scan iteration, giving full 10-day grace period
        }

        const daysInactive = calculateDaysInactive(reporter, now);

        // Action needed if inactive for 3 or more days or warning needs reset
        if (daysInactive >= 3 || (reporter.warningLevel || 0) > 0) {
            const admins = await getAdmins();
            const acted = await handleReporterStatus(reporterId, reporter, daysInactive, admins);
            if (acted) inactiveCount++;
        }
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
    memory: "256MiB",
    timeoutSeconds: 60
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

async function handleReporterStatus(
    reporterId: string, 
    reporter: any, 
    daysInactive: number, 
    admins: admin.firestore.QueryDocumentSnapshot[]
): Promise<boolean> {
    const inProbation = reporter.inProbation || false;
    const currentLevel = reporter.warningLevel || 0;

    // Reset logic: If reporter posted recently
    if (daysInactive < 3) {
        if (currentLevel > 0) {
            await db.collection('users').doc(reporterId).update({
                warningLevel: 0,
                inProbation: true,
                lastWarningDate: null
            });
            console.log(`[REPORTER_MONITOR] Reset warning for reporter ${reporter.name || reporterId}.`);
            return true;
        }
        return false;
    }

    let nextLevel = 0;
    let title = "";
    let body = "";
    let shouldDowngrade = false;

    if (inProbation) {
        if (daysInactive >= 6) {
            shouldDowngrade = true;
            title = "రిపోర్టర్ హోదా తొలగించబడింది";
            body = "వార్తలు క్రమం తప్పకుండా పంపనందున మిమ్మల్ని రిపోర్టర్ హోదా నుండి తొలగించి సబ్‌స్క్రైబర్‌గా మార్చాము.";
        } else if (daysInactive >= 3 && currentLevel < 3) {
            nextLevel = 3;
            title = "తుది హెచ్చరిక (Final Warning)";
            body = "మీరు ప్రొబేషన్‌లో ఉన్నారు. రాబోయే 3 రోజుల్లో వార్తలు పంపకపోతే మీ రిపోర్టర్ హోదా రద్దు చేయబడుతుంది.";
        }
    } else {
        if (daysInactive >= 10) {
            shouldDowngrade = true;
            title = "రిపోర్టర్ హోదా తొలగించబడింది";
            body = "వార్తలు క్రమం తప్పకుండా పంపనందున మిమ్మల్ని రిపోర్టర్ హోదా నుండి తొలగించి సబ్‌స్క్రైబర్‌గా మార్చాము.";
        } else if (daysInactive >= 7 && currentLevel < 3) {
            nextLevel = 3;
            title = "తుది హెచ్చరిక (Final Warning)";
            body = "గత 7 రోజులుగా మీరు వార్తలు పంపడం లేదు. మరో 3 రోజుల్లో వార్తలు పంపకపోతే మీ రిపోర్టర్ హోదా రద్దు చేయబడుతుంది.";
        } else if (daysInactive >= 5 && currentLevel < 2) {
            nextLevel = 2;
            title = "షోకాజ్ నోటీసు (Show Cause Notice)";
            body = "మీరు గత 5 రోజులుగా వార్తలు పంపడం లేదు. ఎందుకు పంపడం లేదో తెలియజేయండి.";
        } else if (daysInactive >= 3 && currentLevel < 1) {
            nextLevel = 1;
            title = "వార్తలు పంపమని విన్నపం";
            body = "దయచేసి మీ ప్రాంత వార్తలను క్రమం తప్పకుండా పంపండి. మీ సహకారం మాకు ఎంతో అవసరం.";
        }
    }

    const reporterName = reporter.name || reporter.phone || reporterId;

    if (shouldDowngrade) {
        await db.collection('users').doc(reporterId).update({
            role: UserRole.SUBSCRIBER,
            warningLevel: 0,
            inProbation: false,
            lastWarningDate: admin.firestore.FieldValue.serverTimestamp()
        });
        await sendInternalMessage(reporterId, title, body, "CRITICAL", reporter);

        // Send copy of downgrade notice to all admins
        const copyTitle = `[రిపోర్టర్ కాపీ] ${reporterName}: ${title}`;
        const copyBody = `రిపోర్టర్ వివరాలు:\nపేరు: ${reporterName}\nID: ${reporterId}\nపరిస్థితి: సబ్‌స్క్రైబర్‌గా మార్చబడింది\nఅచేతన రోజులు: ${daysInactive} రోజులు\n\nపంపిన సందేశం:\n${body}`;
        for (const adminDoc of admins) {
            await sendInternalMessage(adminDoc.id, copyTitle, copyBody, "HIGH", adminDoc.data());
        }
        return true;
    } else if (nextLevel > currentLevel) {
        const importance = nextLevel === 3 ? "HIGH" : "NORMAL";
        await db.collection('users').doc(reporterId).update({
            warningLevel: nextLevel,
            lastWarningDate: admin.firestore.FieldValue.serverTimestamp()
        });
        await sendInternalMessage(reporterId, title, body, importance, reporter);

        // Send copy of warning to all admins
        const copyTitle = `[రిపోర్టర్ కాపీ] ${reporterName}: ${title}`;
        const copyBody = `రిపోర్టర్ వివరాలు:\nపేరు: ${reporterName}\nID: ${reporterId}\nహెచ్చరిక స్థాయి: Level ${nextLevel}\nఅచేతన రోజులు: ${daysInactive} రోజులు\n\nపంపిన సందేశం:\n${body}`;
        for (const adminDoc of admins) {
            await sendInternalMessage(adminDoc.id, copyTitle, copyBody, importance, adminDoc.data());
        }
        return true;
    }

    return false;
}

async function sendInternalMessage(userId: string, title: string, body: string, importance: string, userData?: any) {
    try {
        const messageData = {
            title,
            body,
            senderName: "AlfaNews Admin",
            read: false,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            importance
        };

        await db.collection('users').doc(userId).collection('messages').add(messageData);

        // Use passed userData to avoid redundant Firestore reads
        const data = userData || (await db.collection('users').doc(userId).get()).data();
        const rawTokens: any[] = [...(data?.fcmTokens || []), data?.fcmToken];
        const tokens = Array.from(new Set(rawTokens.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)));

        if (tokens.length > 0) {
            const payload = {
                notification: { title, body },
                data: { type: "INTERNAL_MESSAGE", title, body, importance }
            };
            const messages = tokens.map((token: string) => ({ ...payload, token }));
            await admin.messaging().sendEach(messages).catch(err => console.error(`[FCM_ERROR] User ${userId}:`, err));
        }
    } catch (err) {
        console.error(`[SEND_INTERNAL_MSG_ERROR] User ${userId}:`, err);
    }
}


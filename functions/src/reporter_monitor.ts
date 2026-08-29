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
        const parsed = new Date(val);
        return isNaN(parsed.getTime()) ? null : parsed;
    } catch {
        return null;
    }
}

/**
 * Robust verification: Query the news collection to check if the reporter
 * has submitted news (catches cases where users doc lastPostTimestamp was
 * missed, pending news, or reassigned news).
 * Does NOT restrict with an arbitrary 3-day cutoff.
 */
export async function getActualLatestNewsDate(reporterId: string): Promise<Date | null> {
    if (!reporterId) return null;
    let latestDate: Date | null = null;

    const checkDocs = (docs: admin.firestore.QueryDocumentSnapshot[]) => {
        for (const doc of docs) {
            const data = doc.data();
            const date = parseToDate(data.timestamp || data.createdAt || data.lastUpdated);
            if (date) {
                if (!latestDate || date.getTime() > latestDate.getTime()) {
                    latestDate = date;
                }
            }
        }
    };

    // 🚀 Primary query with index (ordered by timestamp desc)
    try {
        const primarySnap = await db.collection('news')
            .where('reporter.id', '==', reporterId)
            .orderBy('timestamp', 'desc')
            .limit(1)
            .get();
        if (!primarySnap.empty) {
            checkDocs(primarySnap.docs);
            if (latestDate) return latestDate; // 🚀 Early exit! Found latest post in 1 read.
        }
    } catch {
        // Fallback without composite index if orderBy failed
        try {
            const fallbackSnap = await db.collection('news').where('reporter.id', '==', reporterId).limit(5).get();
            if (!fallbackSnap.empty) {
                checkDocs(fallbackSnap.docs);
                if (latestDate) return latestDate;
            }
        } catch {}
    }

    // Only try legacy alternate field names if primary query returned nothing
    const alternateQueries = [
        () => db.collection('news').where('originalReporterId', '==', reporterId).limit(1).get(),
        () => db.collection('news').where('reporterId', '==', reporterId).limit(1).get(),
        () => db.collection('news').where('userId', '==', reporterId).limit(1).get(),
        () => db.collection('news').where('reporter', '==', reporterId).limit(1).get(),
    ];

    for (const attempt of alternateQueries) {
        try {
            const snap = await attempt();
            if (!snap.empty) {
                checkDocs(snap.docs);
                if (latestDate) break; // 🚀 Early exit once found
            }
        } catch {}
    }

    return latestDate;
}

/**
 * Calculates days of inactivity for a reporter based on last post timestamp or promotion date.
 * Ensures newly promoted / re-upgraded reporters are NOT falsely downgraded using account creation date.
 */
export function calculateDaysInactive(reporter: any, now: Date, actualNewsDate?: Date | null): number {
    const lastPost = actualNewsDate || parseToDate(reporter.lastPostTimestamp);
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
        if (daysSinceCreation < 10) {
            return daysSinceCreation;
        }
    }

    // Default to 0 (grace period) if timestamps are not yet populated
    return 0;
}

/**
 * Core scanner function to evaluate reporter activity and send warnings / admin copies.
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

    console.log(`[REPORTER_MONITOR] Scanning ${reportersSnapshot.size} reporters for inactivity...`);
    let inactiveCount = 0;

    for (const doc of reportersSnapshot.docs) {
        const reporter = doc.data();
        const reporterId = doc.id;

        // Auto-fix for existing reporters lacking promotedAt and lastPostTimestamp
        if (!reporter.lastPostTimestamp && !reporter.promotedAt && !reporter.rejoinedAt && !reporter.roleUpdatedAt) {
            console.log(`[REPORTER_MONITOR] Auto-initializing 10-day grace period for reporter ${reporter.name || reporterId}...`);
            await db.collection('users').doc(reporterId).set({
                promotedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastPostTimestamp: admin.firestore.FieldValue.serverTimestamp(),
                rejoinedAt: admin.firestore.FieldValue.serverTimestamp(),
                warningLevel: 0,
                inProbation: false,
                previouslyDowngraded: false,
                suspended: false
            }, { merge: true });
            continue; // Skip this scan iteration, giving full 10-day grace period
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

export async function handleReporterStatus(
    reporterId: string, 
    reporter: any, 
    now: Date = new Date()
): Promise<boolean> {
    const inProbation = reporter.inProbation === true;
    const currentLevel = Number(reporter.warningLevel || 0);

    // 1. Fetch actual latest news date (Skip query if user already posted in last 48h to save reads)
    const existingLastPost = parseToDate(reporter.lastPostTimestamp);
    let actualNewsDate: Date | null = null;
    if (existingLastPost && (now.getTime() - existingLastPost.getTime()) < 48 * 60 * 60 * 1000) {
        actualNewsDate = existingLastPost;
    } else {
        actualNewsDate = await getActualLatestNewsDate(reporterId);
        if (actualNewsDate) {
            const userLastPost = parseToDate(reporter.lastPostTimestamp);
            if (!userLastPost || actualNewsDate.getTime() > userLastPost.getTime()) {
                await db.collection('users').doc(reporterId).set({
                    lastPostTimestamp: actualNewsDate
                }, { merge: true });
                reporter.lastPostTimestamp = actualNewsDate;
            }
        }
    }

    // 2. Calculate actual days inactive
    const daysInactive = calculateDaysInactive(reporter, now, actualNewsDate);

    // 3. Reset logic: If reporter posted recently (within 3 days)
    if (daysInactive < 3) {
        if (currentLevel > 0 || inProbation || reporter.lastWarningDate) {
            await db.collection('users').doc(reporterId).set({
                warningLevel: 0,
                inProbation: false,
                lastWarningDate: null
            }, { merge: true });
            console.log(`[REPORTER_MONITOR] ✅ Reset warning to 0 for active reporter ${reporter.name || reporterId} (inactive: ${daysInactive}d).`);
            return true;
        }
        return false;
    }

    // Calculate hours since last warning to ensure progressive time gaps
    const lastWarningDate = parseToDate(reporter.lastWarningDate);
    const hoursSinceLastWarning = lastWarningDate 
        ? Math.max(0, (now.getTime() - lastWarningDate.getTime()) / (1000 * 60 * 60))
        : 999;

    let nextLevel = currentLevel;
    let title = "";
    let body = "";
    let shouldDowngrade = false;

    if (inProbation) {
        // Probation ladder (faster, but strictly requires final warning + 48h reaction time)
        if (daysInactive >= 6 && currentLevel >= 3 && hoursSinceLastWarning >= 48) {
            shouldDowngrade = true;
            title = "రిపోర్టర్ హోదా తొలగించబడింది";
            body = "ప్రొబేషన్ సమయంలో వార్తలు పంపనందున మిమ్మల్ని రిపోర్టర్ హోదా నుండి తొలగించి సబ్‌స్క్రైబర్‌గా మార్చాము.";
        } else if (daysInactive >= 3 && currentLevel < 3) {
            nextLevel = 3;
            title = "తుది హెచ్చరిక (Final Warning)";
            body = "మీరు ప్రొబేషన్‌లో ఉన్నారు. రాబోయే 3 రోజుల్లో వార్తలు పంపకపోతే మీ రిపోర్టర్ హోదా రద్దు చేయబడుతుంది.";
        }
    } else {
        // Standard progressive warning ladder:
        // Day 3+: Level 1 (Gentle reminder)
        // Day 5+: Level 2 (Show Cause notice)
        // Day 7+: Level 3 (Final Warning + Probation)
        // Day 10+: Demotion ONLY if already at Level 3 AND 48h elapsed since warning!

        if (daysInactive >= 10) {
            if (currentLevel >= 3 && hoursSinceLastWarning >= 48) {
                shouldDowngrade = true;
                title = "రిపోర్టర్ హోదా తొలగించబడింది";
                body = "వార్తలు క్రమం తప్పకుండా పంపనందున మరియు హెచ్చరికలకు స్పందించనందున మిమ్మల్ని రిపోర్టర్ హోదా నుండి తొలగించి సబ్‌స్క్రైబర్‌గా మార్చాము.";
            } else if (currentLevel < 3) {
                // Was not at level 3 yet -> Escalate to Level 3 first giving them 48h to submit news!
                nextLevel = 3;
                title = "తుది హెచ్చరిక (Final Warning)";
                body = "గత 7 రోజులుగా మీరు వార్తలు పంపడం లేదు. మరో 3 రోజుల్లో వార్తలు పంపకపోతే మీ రిపోర్టర్ హోదా రద్దు చేయబడుతుంది.";
            }
        } else if (daysInactive >= 7 && currentLevel < 3) {
            nextLevel = 3;
            title = "తుది హెచ్చరిక (Final Warning)";
            body = "గత 7 రోజులుగా మీరు వార్తలు పంపడం లేదు. మరో 3 రోజుల్లో వార్తలు పంపకపోతే మీ రిపోర్టర్ హోదా రద్దు చేయబడుతుంది.";
        } else if (daysInactive >= 5 && currentLevel < 2) {
            nextLevel = 2;
            title = "షోకాజ్ నోటీసు (Show Cause Notice)";
            body = "మీరు గత 5 రోజులుగా వార్తలు పంపడం లేదు. వార్తలు పంపకపోవడానికి గల కారణాన్ని తెలియజేయండి లేదా వెంటనే వార్తను పోస్ట్ చేయండి.";
        } else if (daysInactive >= 3 && currentLevel < 1) {
            nextLevel = 1;
            title = "వార్తలు పంపమని విన్నపం";
            body = "దయచేసి మీ ప్రాంత వార్తలను క్రమం తప్పకుండా పంపండి. మీ సహకారం Alfa News కు ఎంతో అవసరం.";
        }
    }

    const reporterName = reporter.name || reporter.phone || reporterId;
    const points = Number(reporter.points || 0);
    const isProtectedSenior = points >= 50 || reporter.isProtectedSenior === true || reporter.exemptFromInactivity === true;

    if (shouldDowngrade && isProtectedSenior) {
        console.log(`[REPORTER_MONITOR] 🛡️ Senior reporter protection active for ${reporterName} (${points} points). Skipping auto-demotion.`);
        shouldDowngrade = false;
        await sendInternalMessage(reporterId, "మీ వార్తల కోసం Alfa News వేచి చూస్తోంది! 📰", "నమస్కారం! మీరు చాలా కాలంగా వార్తలు పంపలేదు. మీ ప్రాంత తాజా విశేషాలను త్వరలోనే పంపగలరని ఆశిస్తున్నాము.", "NORMAL", reporter, "REMINDER");
        return false;
    }

    if (shouldDowngrade) {
        console.log(`[REPORTER_MONITOR] ⚠️ Downgrading reporter ${reporterName} (ID: ${reporterId}) due to ${daysInactive} days inactivity (Probation: ${inProbation}).`);
        
        await db.collection('users').doc(reporterId).set({
            role: UserRole.SUBSCRIBER,
            warningLevel: 0,
            inProbation: false,
            previouslyDowngraded: true,
            downgradedReason: "INACTIVITY",
            downgradedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastWarningDate: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Update applications to SUSPENDED so mandal is opened up
        try {
            const appSnap = await db.collection('reporter_applications')
                .where('userId', '==', reporterId)
                .where('status', '==', 'JOINED')
                .get();
            for (const appDoc of appSnap.docs) {
                await appDoc.ref.update({ 
                    status: 'SUSPENDED', 
                    suspendedAt: admin.firestore.FieldValue.serverTimestamp(),
                    reason: 'INACTIVITY' 
                });
            }
        } catch (appErr: any) {
            console.error(`[APP_SUSPEND_ERR] ${reporterId}:`, appErr.message);
        }

        await sendInternalMessage(reporterId, title, body, "CRITICAL", reporter, "WARNING");
        return true;
    } else if (nextLevel > currentLevel) {
        console.log(`[REPORTER_MONITOR] 📢 Warning level ${nextLevel} sent to reporter ${reporterName} (ID: ${reporterId}), inactive ${daysInactive} days.`);
        const importance = nextLevel === 3 ? "HIGH" : "NORMAL";
        const levelUpdates: any = {
            warningLevel: nextLevel,
            lastWarningDate: admin.firestore.FieldValue.serverTimestamp()
        };
        // Level 3 (Final Warning) sets inProbation: true
        if (nextLevel === 3) {
            levelUpdates.inProbation = true;
        }
        await db.collection('users').doc(reporterId).set(levelUpdates, { merge: true });
        await sendInternalMessage(reporterId, title, body, importance, reporter, "WARNING");
        return true;
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
        const messageData = {
            title,
            body,
            senderName: "AlfaNews Admin",
            read: false,
            timestamp,
            importance,
            type: msgType
        };

        // 1. Add to user's personal messages subcollection
        await db.collection('users').doc(userId).collection('messages').add(messageData);

        // 2. Add to their reporter_conversations thread
        try {
            await db.collection('reporter_conversations').doc(userId).collection('messages').add({
                senderId: "SYSTEM_ADMIN",
                senderName: "AlfaNews Admin",
                senderRole: "ADMIN",
                text: `⚠️ [${title}]\n${body}`,
                type: msgType === "WARNING" ? "WARNING" : "NOTICE",
                read: false,
                timestamp
            });

            await db.collection('reporter_conversations').doc(userId).set({
                reporterId: userId,
                reporterName: userData?.name || "Reporter",
                reporterPhone: userData?.phone || "",
                reporterDistrict: userData?.district || "",
                reporterMandal: userData?.assignedMandal || userData?.mandal || "",
                lastMessage: `⚠️ ${title}`,
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
        if (data && data.notificationsEnabled === false) return;

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
                        channelId: 'general_news',
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
                    channelId: 'general_news'
                }
            }));
            await admin.messaging().sendEach(messages).catch(err => console.error(`[FCM_ERROR] User ${userId}:`, err));
        }
    } catch (err) {
        console.error(`[SEND_INTERNAL_MSG_ERROR] User ${userId}:`, err);
    }
}




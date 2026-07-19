import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { UserRole } from "./types";

const db = admin.firestore();

/**
 * Scheduled function to monitor reporter activity.
 * Runs daily at 00:00 IST (18:30 UTC previous day).
 *
 * HIGHLY OPTIMIZED:
 * 1. Reduced memory/CPU allocation to 256MiB to save ~75% of Cloud Run container bill.
 * 2. Uses field projection (select) to fetch only required fields, saving bandwidth/memory.
 * 3. Caches admin list query to execute exactly once per run instead of repeatedly querying in loops.
 * 4. Passes cached doc data to avoid redundant Firestore document lookups in sendInternalMessage.
 */
export const monitorReporterActivity = onSchedule({
    schedule: "0 0 * * *",
    timeZone: "Asia/Kolkata",
    memory: "256MiB",
    timeoutSeconds: 60
}, async (event) => {
    console.log("[REPORTER_MONITOR] Starting optimized daily activity check...");

    const now = new Date();

    // Fetch all reporters - projecting only the fields we actually need
    const reportersSnapshot = await db.collection('users')
        .where('role', 'in', [UserRole.REPORTER, 2, 2.0, '2'])
        .select('name', 'lastPostTimestamp', 'timestamp', 'warningLevel', 'inProbation', 'fcmTokens', 'fcmToken', 'role')
        .get();

    if (reportersSnapshot.empty) {
        console.log("[REPORTER_MONITOR] No reporters found in database.");
        return;
    }

    console.log(`[REPORTER_MONITOR] Scanning ${reportersSnapshot.size} reporters for inactivity...`);
    let inactiveCount = 0;

    // Cache for admin list to avoid querying admins repeatedly inside loops
    let cachedAdmins: admin.firestore.QueryDocumentSnapshot[] | null = null;
    async function getAdmins() {
        if (!cachedAdmins) {
            const adminsSnapshot = await db.collection('users')
                .where('role', '==', UserRole.ADMIN)
                .select('name', 'fcmTokens', 'fcmToken', 'role')
                .get();
            cachedAdmins = adminsSnapshot.docs;
        }
        return cachedAdmins;
    }

    for (const doc of reportersSnapshot.docs) {
        const reporter = doc.data();
        const reporterId = doc.id;

        let daysInactive = 0;
        const lastPost = reporter.lastPostTimestamp;

        if (lastPost) {
            let lastPostDate: Date;
            if (typeof lastPost.toDate === 'function') {
                lastPostDate = lastPost.toDate();
            } else if (lastPost instanceof Date) {
                lastPostDate = lastPost;
            } else if (typeof lastPost === 'number') {
                lastPostDate = new Date(lastPost);
            } else if (lastPost.seconds) {
                lastPostDate = new Date(lastPost.seconds * 1000);
            } else {
                lastPostDate = new Date(lastPost);
            }
            
            const diffTime = Math.abs(now.getTime() - lastPostDate.getTime());
            daysInactive = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        } else {
            // No posts ever? Check account creation date or fallback to high value
            const createdAt = reporter.timestamp;
            let createdDate = now;
            if (createdAt) {
                if (typeof createdAt.toDate === 'function') {
                    createdDate = createdAt.toDate();
                } else if (createdAt instanceof Date) {
                    createdDate = createdAt;
                } else if (typeof createdAt === 'number') {
                    createdDate = new Date(createdAt);
                } else if (createdAt.seconds) {
                    createdDate = new Date(createdAt.seconds * 1000);
                } else {
                    createdDate = new Date(createdAt);
                }
            }
            const diffTime = Math.abs(now.getTime() - createdDate.getTime());
            daysInactive = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        }

        // Action needed if inactive for 3 or more days or warning needs reset
        if (daysInactive >= 3 || (reporter.warningLevel || 0) > 0) {
            const admins = await getAdmins();
            await handleReporterStatus(reporterId, reporter, daysInactive, admins);
            inactiveCount++;
        }
    }

    console.log(`[REPORTER_MONITOR] Daily activity check complete. Acted on ${inactiveCount} reporters.`);
});

async function handleReporterStatus(
    reporterId: string, 
    reporter: any, 
    daysInactive: number, 
    admins: admin.firestore.QueryDocumentSnapshot[]
) {
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
            console.log(`[REPORTER_MONITOR] Reset warning for ${reporter.name}.`);
        }
        return;
    }

    let nextLevel = 0;
    let title = "";
    let body = "";
    let shouldDowngrade = false;
    let shouldNotifyAdmin = false;

    if (inProbation) {
        if (daysInactive >= 6) {
            shouldDowngrade = true;
            title = "రిపోర్టర్ హోదా తొలగించబడింది";
            body = "వార్తలు క్రమం తప్పకుండా పంపనందున మిమ్మల్ని రిపోర్టర్ హోదా నుండి తొలగించి సబ్‌స్క్రైబర్‌గా మార్చాము.";
            shouldNotifyAdmin = true;
        } else if (daysInactive >= 3 && currentLevel < 3) {
            nextLevel = 3;
            title = "తుది హెచ్చరిక (Final Warning)";
            body = "మీరు ప్రొబేషన్‌లో ఉన్నారు. రాబోయే 3 రోజుల్లో వార్తలు పంపకపోతే మీ రిపోర్టర్ హోదా రద్దు చేయబడుతుంది.";
            shouldNotifyAdmin = true;
        }
    } else {
        if (daysInactive >= 10) {
            shouldDowngrade = true;
            title = "రిపోర్టర్ హోదా తొలగించబడింది";
            body = "వార్తలు క్రమం తప్పకుండా పంపనందున మిమ్మల్ని రిపోర్టర్ హోదా నుండి తొలగించి సబ్‌స్క్రైబర్‌గా మార్చాము.";
            shouldNotifyAdmin = true;
        } else if (daysInactive >= 7 && currentLevel < 3) {
            nextLevel = 3;
            title = "తుది హెచ్చరిక (Final Warning)";
            body = "గత 7 రోజులుగా మీరు వార్తలు పంపడం లేదు. మరో 3 రోజుల్లో వార్తలు పంపకపోతే మీ రిపోర్టర్ హోదా రద్దు చేయబడుతుంది.";
            shouldNotifyAdmin = true;
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

    if (shouldDowngrade) {
        await db.collection('users').doc(reporterId).update({
            role: UserRole.SUBSCRIBER,
            warningLevel: 0,
            inProbation: false,
            lastWarningDate: admin.firestore.FieldValue.serverTimestamp()
        });
        await sendInternalMessage(reporterId, title, body, "CRITICAL", reporter);
        if (shouldNotifyAdmin) await notifyAdminsAboutReporter(reporter.name, "DOWNGRADED", admins);
    } else if (nextLevel > currentLevel) {
        await db.collection('users').doc(reporterId).update({
            warningLevel: nextLevel,
            lastWarningDate: admin.firestore.FieldValue.serverTimestamp()
        });
        await sendInternalMessage(reporterId, title, body, nextLevel === 3 ? "HIGH" : "NORMAL", reporter);
        if (shouldNotifyAdmin && nextLevel === 3) await notifyAdminsAboutReporter(reporter.name, "FINAL_WARNING", admins);
    }
}

async function sendInternalMessage(userId: string, title: string, body: string, importance: string, userData?: any) {
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
    const tokens: string[] = data?.fcmTokens || [];
    if (data?.fcmToken) tokens.push(data.fcmToken);

    if (tokens.length > 0) {
        const payload = {
            notification: { title, body },
            data: { type: "INTERNAL_MESSAGE", title, body, importance }
        };
        const messages = tokens.map((token: string) => ({ ...payload, token }));
        await admin.messaging().sendEach(messages).catch(err => console.error("FCM Error:", err));
    }
}

async function notifyAdminsAboutReporter(
    reporterName: string, 
    action: "FINAL_WARNING" | "DOWNGRADED", 
    admins: admin.firestore.QueryDocumentSnapshot[]
) {
    const title = action === "FINAL_WARNING" ? "రిపోర్టర్ తుది హెచ్చరిక" : "రిపోర్టర్ తొలగింపు";
    const body = action === "FINAL_WARNING"
        ? `రిపోర్టర్ ${reporterName} కి తుది హెచ్చరిక పంపబడింది.`
        : `రిపోర్టర్ ${reporterName} ని సబ్‌స్క్రైబర్‌గా మార్చడం జరిగింది.`;

    for (const adminDoc of admins) {
        // Pass adminDoc.data() directly to avoid redundant admin document reads
        await sendInternalMessage(adminDoc.id, title, body, "HIGH", adminDoc.data());
    }
}

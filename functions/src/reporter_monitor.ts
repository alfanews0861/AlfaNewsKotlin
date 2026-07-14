import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { UserRole } from "./types";

const db = admin.firestore();

/**
 * Scheduled function to monitor reporter activity.
 * Runs daily at 00:00 IST (18:30 UTC previous day).
 *
 * OPTIMIZED: Queries only reporters who haven't posted within the 3-day threshold.
 */
export const monitorReporterActivity = onSchedule({
    schedule: "0 0 * * *",
    timeZone: "Asia/Kolkata",
    memory: "1GiB",
    timeoutSeconds: 540
}, async (event) => {
    console.log("[REPORTER_MONITOR] Starting optimized daily activity check...");

    const now = new Date();
    const thresholdDate = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000)); // 3 days ago

    // Find all reporters who haven't posted in at least 3 days
    // or who have never posted (lastPostTimestamp is null)
    const inactiveReportersSnapshot = await db.collection('users')
        .where('role', '==', UserRole.REPORTER)
        .where('lastPostTimestamp', '<', thresholdDate)
        .get();

    // Also need to check those who have never posted (lastPostTimestamp is missing)
    const neverPostedSnapshot = await db.collection('users')
        .where('role', '==', UserRole.REPORTER)
        .where('lastPostTimestamp', '==', null)
        .get();

    const allInactiveDocs = [...inactiveReportersSnapshot.docs, ...neverPostedSnapshot.docs];

    if (allInactiveDocs.length === 0) {
        console.log("[REPORTER_MONITOR] All reporters are active. No actions needed.");
        return;
    }

    console.log(`[REPORTER_MONITOR] Found ${allInactiveDocs.length} inactive reporters.`);

    for (const doc of allInactiveDocs) {
        const reporter = doc.data();
        const reporterId = doc.id;

        let daysInactive = 0;
        if (reporter.lastPostTimestamp) {
            const lastPostDate = reporter.lastPostTimestamp.toDate();
            const diffTime = Math.abs(now.getTime() - lastPostDate.getTime());
            daysInactive = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        } else {
            // No posts ever? Use account creation date or a default high value
            const createdAt = reporter.timestamp?.toDate() || now;
            const diffTime = Math.abs(now.getTime() - createdAt.getTime());
            daysInactive = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        }

        await handleReporterStatus(reporterId, reporter, daysInactive);
    }
});

async function handleReporterStatus(reporterId: string, reporter: any, daysInactive: number) {
    const inProbation = reporter.inProbation || false;
    const currentLevel = reporter.warningLevel || 0;

    // Reset logic: If reporter posted recently (handled by trigger, but double check here)
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
        if (shouldNotifyAdmin) await notifyAdminsAboutReporter(reporter.name, "DOWNGRADED");
    } else if (nextLevel > currentLevel) {
        await db.collection('users').doc(reporterId).update({
            warningLevel: nextLevel,
            lastWarningDate: admin.firestore.FieldValue.serverTimestamp()
        });
        await sendInternalMessage(reporterId, title, body, nextLevel === 3 ? "HIGH" : "NORMAL", reporter);
        if (shouldNotifyAdmin && nextLevel === 3) await notifyAdminsAboutReporter(reporter.name, "FINAL_WARNING");
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

    // ✅ Optimization: Use existing user data if provided to avoid redundant Firestore read
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

async function notifyAdminsAboutReporter(reporterName: string, action: "FINAL_WARNING" | "DOWNGRADED") {
    const adminsSnapshot = await db.collection('users').where('role', '==', UserRole.ADMIN).get();
    const title = action === "FINAL_WARNING" ? "రిపోర్టర్ తుది హెచ్చరిక" : "రిపోర్టర్ తొలగింపు";
    const body = action === "FINAL_WARNING"
        ? `రిపోర్టర్ ${reporterName} కి తుది హెచ్చరిక పంపబడింది.`
        : `రిపోర్టర్ ${reporterName} ని సబ్‌స్క్రైబర్‌గా మార్చడం జరిగింది.`;

    for (const adminDoc of adminsSnapshot.docs) {
        await sendInternalMessage(adminDoc.id, title, body, "HIGH");
    }
}

import * as admin from "firebase-admin";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { onDocumentWritten, onDocumentCreated } from "firebase-functions/v2/firestore";
import * as nodemailer from "nodemailer";
import { REGION } from "./utils";
import { extractDistrictAndMandal, areMandalsMatching } from "./location_data";

const db = admin.firestore();

const MILESTONE_SIZE = 500;
const POINTS_PER_MILESTONE = 50;

// ==========================================
// WELCOME NOTIFICATION MESSAGES
// App download చేసిన వెంటనే పంపాలి
// ==========================================
const WELCOME_MESSAGES = [
    { title: 'అల్ఫా న్యూస్‌కు సుస్వాగతం! 🌟', body: 'తెలుగు వార్తలు చదవడానికి స్వాగతం! తాజా వార్తలు మీ వార్తలు — అన్నీ ఒకేచోట చదవండి.' },
    { title: 'నమస్కారం! Alfa News లోకి క్రోస్ చేసినందుకు ధన్యవాదాలు 🙏', body: 'మీ జిల్లా వార్తలు, చుట్టుప్రక్కల వార్తలు — అన్నీ ఇక్కడే చదవండి!' },
    { title: 'Alfa News లో స్వాగతం! 📰', body: 'తెలంగాణ, ఆంధ్రప్రదేశ్ వార్తలు వేగంగా, నిజాయితిగా — మీకు ందిస్తాం!' },
];

/**
 * Helper: Notify reporter with human-friendly messages
 */
export async function notifyReporter(
    reporterId: string,
    postId: string,
    headline: string,
    type: 'SUCCESS' | 'INTERNAL_ERROR' | 'POLICY_VIOLATION' | 'DUPLICATE',
    imageUrl?: string,
    specificReason?: string
) {
    try {
        let targetUserId = reporterId ? reporterId.trim() : "";
        if (!targetUserId || targetUserId.startsWith('BOT_') || targetUserId.startsWith('SYSTEM_') || targetUserId === 'ALFA_DESK') {
            return;
        }

        let userRef = db.collection('users').doc(targetUserId);
        let userDoc = await userRef.get();

        // If doc doesn't exist by ID, search by name (handle legacy/cross-field matches)
        if (!userDoc.exists) {
            const nameQuery = await db.collection('users').where('name', '==', targetUserId).limit(1).get();
            if (!nameQuery.empty) {
                targetUserId = nameQuery.docs[0].id;
                userRef = db.collection('users').doc(targetUserId);
                userDoc = nameQuery.docs[0];
            }
        }

        if (!userDoc.exists) {
            console.log(`[NOTIFY_SKIP] User document not found for reporterId: ${reporterId}`);
            return;
        }

        const userData = userDoc.data();
        const reporterName = userData?.name || "రిపోర్టర్";

        // Helper to convert technical errors or raw strings into polite, human editorial reasons
        const toHumanEditorialReason = (rawReason?: string): string => {
            if (!rawReason || rawReason.trim().length === 0) {
                if (type === 'DUPLICATE') return "ఈ వార్తాంశం గత కొన్ని గంటల్లో మీ మండలంలో ఇప్పటికే మన యాప్‌లో ప్రచురితమైంది.";
                if (type === 'POLICY_VIOLATION') return "వార్తలోని అంశాలు మా ఎడిటోరియల్ మార్గదర్శకాలకు అనుగుణంగా లేనందున ప్రచురించలేకపోయాము.";
                if (type === 'INTERNAL_ERROR') return "సర్వర్ లేదా నెట్‌వర్క్ అంతరాయం వల్ల ఈ వార్త ప్రచురణ తాత్కాలికంగా నిలిచింది.";
                return "";
            }

            const lower = rawReason.toLowerCase();
            const hasTechnicalLeak = lower.includes('gemini') || lower.includes('ai') || lower.includes('model') ||
                lower.includes('quota') || lower.includes('resource_exhausted') || lower.includes('503') ||
                lower.includes('429') || lower.includes('json') || lower.includes('syntax') ||
                lower.includes('ffmpeg') || lower.includes('exit code') || lower.includes('stream specifier') ||
                lower.includes('http') || lower.includes('internal error') || lower.includes('abort');

            if (hasTechnicalLeak) {
                if (lower.includes('video') || lower.includes('ffmpeg') || lower.includes('youtube')) {
                    return "వీడియో ఫైల్ ప్రాసెసింగ్ సమయంలో సాంకేతిక అంతరాయం ఏర్పడింది. దయచేసి వీడియోను మళ్ళీ సరిచూసి పంపగలరు.";
                }
                return "సర్వర్ నెట్‌వర్క్ అంతరాయం వల్ల ప్రచురణ ప్రక్రియ నిలిచిపోయింది. దయచేసి కాసేపటి తర్వాత మళ్ళీ ప్రయత్నించండి.";
            }

            if (rawReason.includes("గత 6 గంటల్లో") || rawReason.includes("డూప్లికేట్")) {
                return "ఈ వార్తాంశం గత కొన్ని గంటల్లో మీ మండలంలో ఇప్పటికే మన యాప్‌లో ప్రచురితమైంది. ఒకే వార్త పాఠకులకు పునరావృతం కాకుండా ఉండేందుకు దీనిని ఆమోదించలేకపోయాము.";
            }

            return rawReason;
        };

        const humanReason = toHumanEditorialReason(specificReason);
        const truncatedHeadline = headline.length > 40 ? headline.substring(0, 40) + "..." : headline;

        let title = "";
        let body = "";
        let chatText = "";

        if (type === 'SUCCESS') {
            title = 'మీ వార్త లైవ్ అయ్యింది! 📰';
            body = `నమస్కారం! మీరు పంపిన "${truncatedHeadline}" వార్త విజయవంతంగా ప్రచురించబడింది.`;

            chatText = `నమస్కారం ${reporterName} గారు,\n\nమీరు పంపిన వార్త: "${headline}"\n\nఎడిటోరియల్ డెస్క్ పరిశీలన పూర్తయింది. ఈ వార్త విజయవంతంగా లైవ్‌లో ప్రచురించబడింది. ధన్యవాదాలు!\n\n- ఆల్ఫా న్యూస్ ఎడిటోరియల్ డెస్క్`;
        } else if (type === 'DUPLICATE') {
            title = 'ఎడిటోరియల్ డెస్క్ సమాచారం ℹ️';
            body = `నమస్కారం! "${truncatedHeadline}" వార్తాంశం మీ మండలంలో ఇప్పటికే కవర్ అయింది.`;

            chatText = `నమస్కారం ${reporterName} గారు,\n\nమీరు పంపిన వార్త: "${headline}"\n\nఎడిటోరియల్ డెస్క్ పరిశీలన:\nఈ వార్తాంశం మీ మండలంలో గత కొన్ని గంటల్లోనే ఇప్పటికే మన యాప్‌లో ప్రచురితమైంది. ఒకే వార్త పాఠకులకు పునరావృతం కాకుండా చూసేందుకు ఎడిటోరియల్ టీమ్ దీనిని ఆమోదించలేకపోయింది.\n\nదయచేసి మీ ప్రాంతంలోని ఇతర తాజా ప్రజా సమస్యలు లేదా కొత్త వార్తలను పంపగలరు. ధన్యవాదాలు!\n\n- ఎడిటోరియల్ డెస్క్ (ఆల్ఫా న్యూస్)`;
        } else if (type === 'POLICY_VIOLATION') {
            title = 'ఎడిటోరియల్ డెస్క్ పరిశీలన ⚠️';
            body = `"${truncatedHeadline}" వార్త ఎడిటోరియల్ నిబంధనల ప్రకారం ప్రచురించబడలేదు. డెస్క్ చాట్ చూడండి.`;

            chatText = `నమస్కారం ${reporterName} గారు,\n\nమీరు పంపిన వార్త: "${headline}"\n\nఎడిటోరియల్ డెస్క్ పరిశీలన:\n${humanReason}\n\nమా ప్రచురణ నిబంధనల ప్రకారం ప్రజా ప్రయోజనమున్న వార్తలకు ప్రాధాన్యత ఇస్తాము. భవిష్యత్తులో ఈ అంశాలను గమనించి వార్తలు పంపగలరు. ధన్యవాదాలు!\n\n- ఎడిటోరియల్ డెస్క్ (ఆల్ఫా న్యూస్)`;
        } else {
            title = 'వార్త ప్రచురణ సమాచారం ⚠️';
            body = `"${truncatedHeadline}" వార్త అప్‌లోడ్‌లో అంతరాయం ఏర్పడింది. దయచేసి మళ్ళీ ప్రయత్నించండి.`;

            chatText = `నమస్కారం ${reporterName} గారు,\n\nమీరు పంపిన వార్త: "${headline}"\n\nపరిశీలన వివరాలు:\n${humanReason}\n\nదయచేసి ఈ వార్తను కాసేపటి తర్వాత మళ్ళీ యాప్ ద్వారా పంపగలరు. అవసరమైతే నేరుగా డెస్క్‌ను సంప్రదించండి. కలిగిన అంతరాయానికి క్షమించండి.\n\n- ఆల్ఫా న్యూస్ డెస్క్`;
        }

        // 1. IN-APP DESK CHAT MESSAGE:
        // Always write to reporter_conversations so the reporter receives a personal 1-on-1 message in Desk Chat
        // from human editorial staff, even if push tokens are missing!
        try {
            await db.collection('reporter_conversations').doc(targetUserId).collection('messages').add({
                senderId: 'SYSTEM',
                senderName: 'ఆల్ఫా న్యూస్ ఎడిటోరియల్ డెస్క్',
                senderRole: 'ADMIN',
                text: chatText,
                type: type === 'SUCCESS' ? 'NOTICE' : 'WARNING',
                read: false,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            await db.collection('reporter_conversations').doc(targetUserId).set({
                reporterId: targetUserId,
                reporterName,
                unreadCountForReporter: admin.firestore.FieldValue.increment(1),
                lastMessage: chatText.substring(0, 100),
                lastMessageTimestamp: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            console.log(`[NOTIFY_DESK_CHAT] Added human editorial message to reporter_conversations for ${targetUserId}`);
        } catch (chatErr: any) {
            console.error(`[NOTIFY_DESK_CHAT_ERR] Could not write in-app message:`, chatErr.message);
        }

        // 2. FCM PUSH NOTIFICATION:
        if (userData && userData.notificationsEnabled === false) return;

        const tokens: string[] = [];
        if (userData?.fcmToken) tokens.push(userData.fcmToken);
        if (Array.isArray(userData?.fcmTokens)) {
            userData.fcmTokens.forEach((t: any) => {
                if (t && typeof t === 'string' && !tokens.includes(t)) tokens.push(t);
            });
        }

        if (tokens.length === 0) {
            console.log(`[NOTIFY_FCM_SKIP] No FCM tokens found for reporter ${targetUserId}`);
            return;
        }

        const message = {
            notification: { title, body },
            android: {
                priority: 'high' as const,
                notification: {
                    imageUrl: imageUrl || "",
                    channelId: 'general_news',
                    sound: 'default'
                }
            },
            data: {
                actionUrl: `alfanews://news/${postId}`,
                newsId: postId,
                type: `REPORTER_SUBMISSION_${type}`,
                title,
                body,
                channelId: 'general_news',
                rejectionReason: specificReason || "",
                imageUrl: imageUrl || ""
            }
        };

        const sendPromises = tokens.map(token =>
            admin.messaging().send({ ...message, token }).catch(async err => {
                if (err.code === 'messaging/registration-token-not-registered' ||
                    err.code === 'messaging/invalid-registration-token') {
                    const updates: any = {};
                    if (userData?.fcmToken === token) updates.fcmToken = admin.firestore.FieldValue.delete();
                    updates.fcmTokens = admin.firestore.FieldValue.arrayRemove(token);
                    await db.collection('users').doc(targetUserId).update(updates).catch(() => {});
                }
            })
        );

        await Promise.all(sendPromises);
        console.log(`[NOTIFY_FCM_SENT] Sent push notification (${type}) to ${tokens.length} tokens for reporter ${targetUserId}`);
    } catch (e: any) {
        console.error(`[NOTIFY] Error:`, e.message);
    }
}

/**
 * Award points to reporter and update badges
 */
export async function awardPointsToReporter(reporterId: string, points: number) {
    try {
        if (!reporterId || reporterId.startsWith('BOT_') || reporterId.startsWith('SYSTEM_') || reporterId === 'ALFA_DESK') {
            console.log(`[POINTS_SKIP] Skipping points for system account: ${reporterId}`);
            return;
        }

        let targetUserId = reporterId.trim();
        let userRef = db.collection('users').doc(targetUserId);
        let userDoc = await userRef.get();

        // If doc doesn't exist by ID, search by name
        if (!userDoc.exists) {
            const nameQuery = await db.collection('users').where('name', '==', targetUserId).limit(1).get();
            if (!nameQuery.empty) {
                targetUserId = nameQuery.docs[0].id;
                userRef = db.collection('users').doc(targetUserId);
                userDoc = nameQuery.docs[0];
            }
        }

        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(userRef);

            // --- MONTHLY LEADERBOARD TRACKING ---
            const now = new Date();
            const year = now.getFullYear();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const monthlyId = `${year}_${month}`;

            const monthlyRef = db.collection('monthly_leaderboard').doc(monthlyId)
                .collection('reporters').doc(targetUserId);

            const monthlyDoc = await transaction.get(monthlyRef);
            // ------------------------------------

            const data = doc.exists ? doc.data()! : {};
            const currentPoints = (data.points || 0) + points;

            // Calculate badges
            const badges: string[] = [];
            if (currentPoints >= 100) badges.push("BRONZE");
            if (currentPoints >= 500) badges.push("SILVER");
            if (currentPoints >= 2000) badges.push("GOLD");
            if (currentPoints >= 10000) badges.push("DIAMOND");

            const isSenior = currentPoints >= 50;
            const reporterUpdates: any = {
                points: currentPoints,
                badges: badges,
                lastPostTimestamp: Date.now(),
                warningLevel: 0,
                inProbation: false,
                role: data.role === 'ADMIN' || data.role === 'EDITOR' ? data.role : 'REPORTER',
                previouslyDowngraded: false
            };
            if (!doc.exists) {
                reporterUpdates.name = targetUserId;
            }
            if (isSenior) {
                reporterUpdates.isProtectedSenior = true;
            }

            transaction.set(userRef, reporterUpdates, { merge: true });

            if (monthlyDoc.exists) {
                transaction.update(monthlyRef, {
                    points: admin.firestore.FieldValue.increment(points),
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                transaction.set(monthlyRef, {
                    userId: targetUserId,
                    name: data.name || targetUserId,
                    photoUrl: data.photoUrl || "",
                    district: data.district || "",
                    assignedMandal: data.assignedMandal || "",
                    points: currentPoints,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        });
        console.log(`[POINTS] Awarded ${points} points to ${targetUserId}`);
    } catch (e: any) {
        console.error(`[POINTS_ERR] Error:`, e.message);
    }
}

/**
 * Backfill points for all reporters based on their existing news posts
 */
/**
 * Automatically restores and upgrades all mistakenly downgraded/inactive reporters
 * and recalculates their lifetime points, news count, badges, and mandal assignment.
 */
export async function performRestoreAllReporters(): Promise<{ restoredCount: number, details: any[] }> {
    console.log(`[RESTORE_REPORTERS] 🚀 Starting system-wide reporter restoration...`);
    const candidateUserIds = new Set<string>();

    // 1. Find all users with downgrade flags
    try {
        const downgradedSnap = await db.collection('users')
            .where('previouslyDowngraded', '==', true)
            .get();
        downgradedSnap.docs.forEach(d => candidateUserIds.add(d.id));
    } catch (e: any) {
        console.warn(`[RESTORE_WARN] Fetch previouslyDowngraded:`, e.message);
    }

    try {
        const inactivitySnap = await db.collection('users')
            .where('downgradedReason', '==', 'INACTIVITY')
            .get();
        inactivitySnap.docs.forEach(d => candidateUserIds.add(d.id));
    } catch (e: any) {
        console.warn(`[RESTORE_WARN] Fetch downgradedReason:`, e.message);
    }

    // 2. Find all approved/joined reporter applications
    try {
        const appSnap = await db.collection('reporter_applications').get();
        appSnap.docs.forEach(d => {
            const data = d.data();
            const uId = data.userId;
            if (uId && typeof uId === 'string' && uId.trim()) {
                candidateUserIds.add(uId.trim());
            }
        });
    } catch (e: any) {
        console.warn(`[RESTORE_WARN] Fetch reporter_applications:`, e.message);
    }

    // 3. Find all existing reporters
    try {
        const repSnap = await db.collection('users')
            .where('role', 'in', ['REPORTER', 'reporter', 'STAFF_REPORTER', 'REGIONAL_INCHARGE', 2, 2.0, '2', 3, 3.0])
            .get();
        repSnap.docs.forEach(d => candidateUserIds.add(d.id));
    } catch (e: any) {
        console.warn(`[RESTORE_WARN] Fetch active reporters:`, e.message);
    }

    // 4. Find all reporters from existing news posts in `news` collection
    try {
        const newsSnap = await db.collection('news').get();
        newsSnap.docs.forEach(d => {
            const data = d.data();
            const rep = data.reporter;
            const repId = (typeof rep === 'object' && rep?.id) ? rep.id : (typeof rep === 'string' ? rep : null);
            const origRepId = data.originalReporterId || data.userId;
            const repName = (typeof rep === 'object' && rep?.name) ? rep.name : null;

            [repId, origRepId, repName].forEach(cand => {
                if (cand && typeof cand === 'string' && cand.trim() && 
                    !cand.startsWith('BOT_') && !cand.startsWith('SYSTEM_') && 
                    cand !== 'ALFA_DESK' && cand !== 'సిటిజెన్ పోస్ట్' && cand !== 'అజ్ఞాత పౌరుడు') {
                    candidateUserIds.add(cand.trim());
                }
            });
        });
    } catch (e: any) {
        console.warn(`[RESTORE_WARN] Fetch news reporters:`, e.message);
    }

    // 0. Sanitize all users in `users` collection to guarantee number types for Android deserialization
    try {
        console.log(`[RESTORE_REPORTERS] Sanitizing users collection field types...`);
        const allUsersSnap = await db.collection('users').get();
        for (const doc of allUsersSnap.docs) {
            const d = doc.data();
            const updates: any = {};
            let needsUpdate = false;

            // Ensure lastPostTimestamp is a number, not Timestamp
            if (d.lastPostTimestamp) {
                if (typeof d.lastPostTimestamp !== 'number') {
                    const ts = d.lastPostTimestamp;
                    const millis = ts.toMillis ? ts.toMillis() : (ts._seconds ? ts._seconds * 1000 : (typeof ts === 'string' ? parseInt(ts, 10) : null));
                    if (millis && !isNaN(millis)) {
                        updates.lastPostTimestamp = millis;
                        needsUpdate = true;
                    } else {
                        updates.lastPostTimestamp = admin.firestore.FieldValue.delete();
                        needsUpdate = true;
                    }
                }
            }

            // Clean incompatible Timestamp from lastWarningDate
            if (d.lastWarningDate && typeof d.lastWarningDate !== 'number') {
                updates.lastWarningDate = admin.firestore.FieldValue.delete();
                needsUpdate = true;
            }

            // Clean incompatible Timestamp from lastTokenUpdate
            if (d.lastTokenUpdate && typeof d.lastTokenUpdate !== 'number') {
                updates.lastTokenUpdate = admin.firestore.FieldValue.delete();
                needsUpdate = true;
            }

            // Ensure name field exists for orderBy queries
            if (!d.name && d.displayName) {
                updates.name = d.displayName;
                needsUpdate = true;
            }

            if (needsUpdate) {
                await doc.ref.update(updates);
            }
        }
    } catch (e: any) {
        console.warn(`[SANITIZE_USERS_ERR]:`, e.message);
    }

    console.log(`[RESTORE_REPORTERS] Found ${candidateUserIds.size} potential reporter accounts to verify and restore.`);
    const results: any[] = [];

    for (const candId of candidateUserIds) {
        try {
            let userDoc = await db.collection('users').doc(candId).get();
            let userId = candId;
            let userData: any = userDoc.exists ? (userDoc.data() || {}) : null;

            // If userDoc not found by doc ID, search users collection by name
            if (!userData) {
                const userByNameQuery = await db.collection('users').where('name', '==', candId).limit(1).get();
                if (!userByNameQuery.empty) {
                    userDoc = userByNameQuery.docs[0];
                    userId = userDoc.id;
                    userData = userDoc.data() || {};
                }
            }

            // Don't overwrite Admins or Editors
            if (userData && (userData.role === 'ADMIN' || userData.role === 'EDITOR')) continue;

            // Fetch all news for this reporter across possible fields
            const newsDocsMap = new Map<string, any>();
            const [snapId, snapName, snapOrig] = await Promise.all([
                db.collection('news').where('reporter.id', '==', candId).get().catch(() => null),
                db.collection('news').where('reporter.name', '==', candId).get().catch(() => null),
                db.collection('news').where('originalReporterId', '==', candId).get().catch(() => null)
            ]);
            if (snapId) snapId.docs.forEach(d => newsDocsMap.set(d.id, d));
            if (snapName) snapName.docs.forEach(d => newsDocsMap.set(d.id, d));
            if (snapOrig) snapOrig.docs.forEach(d => newsDocsMap.set(d.id, d));

            if (userId !== candId) {
                const [snapUid, snapUName] = await Promise.all([
                    db.collection('news').where('reporter.id', '==', userId).get().catch(() => null),
                    db.collection('news').where('originalReporterId', '==', userId).get().catch(() => null)
                ]);
                if (snapUid) snapUid.docs.forEach(d => newsDocsMap.set(d.id, d));
                if (snapUName) snapUName.docs.forEach(d => newsDocsMap.set(d.id, d));
            }

            const newsDocs = Array.from(newsDocsMap.values());
            if (newsDocs.length === 0 && !userData) continue;

            // If userData is still null but newsDocs exist (e.g. Kola Mahesh):
            if (!userData) {
                const sampleDoc = newsDocs[0]?.data() || {};
                const repName = sampleDoc.reporter?.name || candId;
                const repDistrict = sampleDoc.district || (sampleDoc.categories && sampleDoc.categories.find((c: string) => !c.includes("వార్త") && c !== sampleDoc.category)) || "";
                const repMandal = sampleDoc.location || sampleDoc.mandal || "";

                userData = {
                    name: repName,
                    role: 'REPORTER',
                    district: repDistrict,
                    assignedMandal: repMandal,
                    mandal: repMandal,
                    points: 0,
                    badges: []
                };
            }

            // Find application info if mandal is missing
            let appMandal = userData.assignedMandal || userData.mandal || userData.mandalam || "";
            let appDistrict = userData.district || "";

            if (!appMandal || !appDistrict) {
                const appQuery = await db.collection('reporter_applications')
                    .where('userId', '==', userId)
                    .limit(1)
                    .get();
                if (!appQuery.empty) {
                    const aData = appQuery.docs[0].data();
                    if (!appMandal) appMandal = aData.mandal || aData.assignedMandal || aData.selectedMandal || "";
                    if (!appDistrict) appDistrict = aData.district || aData.state_district || "";
                }
            }

            if (!appMandal && newsDocs.length > 0) {
                const sample = newsDocs[0].data() || {};
                appMandal = sample.location || sample.mandal || "";
            }
            if (!appDistrict && newsDocs.length > 0) {
                const sample = newsDocs[0].data() || {};
                appDistrict = sample.district || (sample.categories && sample.categories.find((c: string) => !c.includes("వార్త") && c !== sample.category)) || "";
            }

            const cleanName = (userData.name || candId || "").trim().toUpperCase();
            if (cleanName.includes("KOLA MAHESH") || cleanName.includes("KOLA MOHAN") || (cleanName.includes("KOLA") && (cleanName.includes("MAHESH") || cleanName.includes("MOHAN")))) {
                appDistrict = "యాదాద్రి భువనగిరి";
                appMandal = "సంస్థాన్ నారాయణపూర్";
            } else if (cleanName === "K MOHAN" || cleanName === "K. MOHAN" || cleanName === "MOHAN" || (cleanName.includes("MOHAN") && !cleanName.includes("KOLA"))) {
                if (!appDistrict || !appMandal || appDistrict === "N/A" || appMandal === "N/A") {
                    appDistrict = "తిరుపతి";
                    appMandal = "తిరుపతి అర్బన్";
                }
            }

            let totalPoints = 0;
            const monthlyPointsMap: { [key: string]: number } = {};
            let latestNewsMillis = 0;

            newsDocs.forEach(doc => {
                const data = doc.data();
                const mediaType = data.mediaType?.toUpperCase() || "";
                const mediaTypes = (data.mediaTypes || []).map((t: string) => t.toUpperCase());
                const isVideo = mediaType === 'VIDEO' || mediaTypes.includes('VIDEO');
                const postPoints = isVideo ? 20 : 10;
                totalPoints += postPoints;

                const ts = data.timestamp || data.createdAt;
                let date: Date;
                if (ts && typeof ts.toDate === 'function') {
                    date = ts.toDate();
                } else if (ts && ts._seconds) {
                    date = new Date(ts._seconds * 1000);
                } else {
                    date = new Date();
                }

                const postTime = date.getTime();
                if (postTime > latestNewsMillis) {
                    latestNewsMillis = postTime;
                }

                const monthId = `${date.getFullYear()}_${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                monthlyPointsMap[monthId] = (monthlyPointsMap[monthId] || 0) + postPoints;

                const longViews = data.longViews || 0;
                const viewMilestones = Math.floor(longViews / MILESTONE_SIZE);
                const viewPoints = (viewMilestones * POINTS_PER_MILESTONE);
                totalPoints += viewPoints;
                monthlyPointsMap[monthId] = (monthlyPointsMap[monthId] || 0) + viewPoints;
            });

            // Calculate badges
            const badges: string[] = [];
            if (totalPoints >= 100) badges.push("BRONZE");
            if (totalPoints >= 500) badges.push("SILVER");
            if (totalPoints >= 2000) badges.push("GOLD");
            if (totalPoints >= 10000) badges.push("DIAMOND");

            const isSenior = newsDocs.length >= 5 || totalPoints >= 50;

            const userUpdates: any = {
                name: userData.name || candId,
                role: 'REPORTER',
                points: totalPoints,
                badges: badges,
                warningLevel: 0,
                inProbation: false,
                previouslyDowngraded: false,
                suspended: false,
                isProtectedSenior: isSenior,
                lastPostTimestamp: latestNewsMillis > 0 ? latestNewsMillis : Date.now(),
                downgradedReason: admin.firestore.FieldValue.delete(),
                downgradedAt: admin.firestore.FieldValue.delete(),
                lastWarningDate: admin.firestore.FieldValue.delete(),
                rejoinedAt: admin.firestore.FieldValue.serverTimestamp(),
                roleUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            if (appMandal) {
                userUpdates.assignedMandal = appMandal;
                userUpdates.mandal = appMandal;
            }
            if (appDistrict) {
                userUpdates.district = appDistrict;
            }

            await db.collection('users').doc(userId).set(userUpdates, { merge: true });

            // Sync Monthly Leaderboard
            for (const [monthId, pts] of Object.entries(monthlyPointsMap)) {
                const monthlyRef = db.collection('monthly_leaderboard').doc(monthId)
                    .collection('reporters').doc(userId);

                await monthlyRef.set({
                    userId: userId,
                    name: userData.name || candId,
                    photoUrl: userData.photoUrl || "",
                    district: appDistrict || userData.district || "",
                    assignedMandal: appMandal || userData.assignedMandal || "",
                    points: pts,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }

            results.push({
                userId,
                name: userData.name || candId,
                mandal: appMandal,
                district: appDistrict,
                points: totalPoints,
                posts: newsDocs.length,
                isProtectedSenior: isSenior
            });
        } catch (err: any) {
            console.error(`[RESTORE_USER_ERR] ${candId}:`, err.message);
        }
    }

    console.log(`[RESTORE_REPORTERS] ✅ Restored and updated ${results.length} reporters.`);
    return { restoredCount: results.length, details: results };
}

/**
 * Callable function to manually restore and upgrade all mistakenly downgraded reporters.
 */
export const restoreAllDowngradedReporters = onCall(async (request) => {
    const auth = request.auth;
    if (!auth || !auth.uid) {
        throw new HttpsError('unauthenticated', 'మీరు లాగిన్ అవ్వాలి.');
    }
    const adminDoc = await db.collection('users').doc(auth.uid).get();
    if (adminDoc.data()?.role !== 'ADMIN' && adminDoc.data()?.role !== 'EDITOR') {
        throw new HttpsError('permission-denied', 'అడ్మిన్లకు మాత్రమే ఈ అనుమతి ఉంది.');
    }

    const res = await performRestoreAllReporters();
    return { success: true, ...res };
});

export const backfillReporterPoints = onCall(async (request) => {
    // Only admins can trigger backfill
    const auth = request.auth;
    if (!auth || !auth.uid) {
        throw new HttpsError('unauthenticated', 'మీరు లాగిన్ అవ్వాలి.');
    }

    const adminDoc = await db.collection('users').doc(auth.uid).get();
    if (adminDoc.data()?.role !== 'ADMIN') {
        throw new HttpsError('permission-denied', 'అడ్మిన్లకు మాత్రమే ఈ అనుమతి ఉంది.');
    }

    console.log(`[BACKFILL] Starting points backfill & reporter restoration...`);
    const restoreResult = await performRestoreAllReporters();
    return { success: true, processed: restoreResult.restoredCount, details: restoreResult.details };
});

/**
 * Award points for view milestones
 * Triggered when longViews is updated
 */
export const onNewsViewCountUpdated = onDocumentWritten({
    document: "news/{postId}",
    region: REGION,
}, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after || !after.isReporter) return;

    const viewsBefore = before?.longViews || 0;
    const viewsAfter = after.longViews || 0;

    // ✅ Quick guard: exit if longViews hasn't increased (saves execution time)
    if (viewsAfter <= viewsBefore) return;
    const reporterId = after.reporter?.id || (typeof after.reporter === 'string' ? after.reporter : null);
    if (!reporterId || reporterId.startsWith('BOT_') || reporterId.startsWith('SYSTEM_')) return;

    // Award points for milestones
    const milestonesBefore = Math.floor(viewsBefore / MILESTONE_SIZE);
    const milestonesAfter = Math.floor(viewsAfter / MILESTONE_SIZE);

    if (milestonesAfter > milestonesBefore) {
        const newMilestones = milestonesAfter - milestonesBefore;
        const totalPointsToAdd = newMilestones * POINTS_PER_MILESTONE;

        console.log(`[MILESTONE] News ${event.params.postId} reached ${viewsAfter} views. Awarding ${totalPointsToAdd} points to ${reporterId}`);
        await awardPointsToReporter(reporterId, totalPointsToAdd);
    }
});

/**
 * 6.1 Process Reporter Submission
 */
export const processReporterSubmission = onCall(async (request) => {
    const { postId, headline: rawHeadline, content: rawContent, postData } = request.data;

    try {
        console.log(`[REPORTER_SUBMISSION] Quick acceptance for post: ${postId || 'new'}`);

        const headline = rawHeadline || postData?.headline?.telugu || "";
        const content = rawContent || postData?.content?.telugu || "";

        if (!headline || !content) {
            throw new HttpsError('invalid-argument', 'వార్త శీర్షిక మరియు వివరణ తప్పనిసరి.');
        }

        const mediaUrl = postData?.mediaUrl || "";
        const mediaUrls = postData?.mediaUrls || (mediaUrl ? [mediaUrl] : []);

        const finalData = {
            ...postData,
            headline: {
                telugu: headline,
                english: postData?.headline?.english || ""
            },
            content: {
                telugu: content,
                english: postData?.content?.english || ""
            },
            mediaUrl: mediaUrl,
            mediaUrls: mediaUrls,
            isReporter: true,
            isCitizen: false,
            aiProcessed: false,
            videoProcessed: false, // Explicit false so trigger guard detects changes reliably
            approved: false,
            status: "PENDING",
            processingType: "REPORTER_SUBMISSION",
            timestamp: postData?.timestamp || admin.firestore.FieldValue.serverTimestamp(),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        };

        const reporterId = request.auth?.uid || (typeof postData?.reporter === 'string' ? postData.reporter : postData?.reporter?.id);
        if (reporterId && !reporterId.startsWith('BOT_') && !reporterId.startsWith('SYSTEM_')) {
            await db.collection('users').doc(reporterId).set({
                lastPostTimestamp: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        if (postId) {
            const postRef = db.collection('news').doc(postId);
            const existingSnap = await postRef.get();
            if (!existingSnap.exists) {
                throw new HttpsError('not-found', 'వార్త లభించలేదు.');
            }
            const existingData = existingSnap.data() || {};
            const wasApproved = existingData.approved === true || (existingData.status || '').toUpperCase() === 'PUBLISHED';

            if (wasApproved) {
                // EDITING AN ALREADY PUBLISHED POST:
                // Keep it published and live! Do NOT unpublish, do NOT trigger AI rewrite or video re-encoding!
                const updatePayload: any = {
                    ...postData,
                    headline: {
                        telugu: headline,
                        english: postData?.headline?.english || existingData.headline?.english || ""
                    },
                    content: {
                        telugu: content,
                        english: postData?.content?.english || existingData.content?.english || ""
                    },
                    mediaUrl: mediaUrl || existingData.mediaUrl || "",
                    mediaUrls: mediaUrls.length > 0 ? mediaUrls : (existingData.mediaUrls || (existingData.mediaUrl ? [existingData.mediaUrl] : [])),
                    mediaType: postData?.mediaType || existingData.mediaType || "IMAGE",
                    mediaTypes: postData?.mediaTypes || existingData.mediaTypes || ["IMAGE"],
                    youtubeUrl: postData?.youtubeUrl !== undefined ? postData.youtubeUrl : (existingData.youtubeUrl || null),
                    location: postData?.location || existingData.location || "",
                    district: postData?.district || existingData.district || "State",
                    state: postData?.state || existingData.state || "TS",
                    category: postData?.category || existingData.category || "General News",
                    categories: postData?.categories || existingData.categories || [],
                    isGlobal: postData?.isGlobal !== undefined ? postData.isGlobal : (existingData.isGlobal || false),
                    approved: true,
                    status: "PUBLISHED",
                    aiProcessed: true,
                    videoProcessed: existingData.videoProcessed ?? true,
                    timestamp: existingData.timestamp || admin.firestore.FieldValue.serverTimestamp(),
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                };

                // Preserve user engagement metrics & reporter attribution
                if (existingData.likes !== undefined) updatePayload.likes = existingData.likes;
                if (existingData.comments !== undefined) updatePayload.comments = existingData.comments;
                if (existingData.shares !== undefined) updatePayload.shares = existingData.shares;
                if (existingData.views !== undefined) updatePayload.views = existingData.views;
                if (existingData.longViews !== undefined) updatePayload.longViews = existingData.longViews;
                if (existingData.reporter) updatePayload.reporter = existingData.reporter;
                if (existingData.originalReporterId) updatePayload.originalReporterId = existingData.originalReporterId;
                if (existingData.type) updatePayload.type = existingData.type;

                await postRef.update(updatePayload);
                console.log(`[REPORTER_EDIT_PUBLISHED] Post ${postId} updated directly without unpublishing.`);
                return { success: true, postId: postId, message: "వార్త విజయవంతంగా నవీకరించబడింది." };
            } else {
                // Editing a PENDING or REJECTED post:
                const updatePayload: any = {
                    ...finalData,
                    forceReprocess: true,
                    rejectionReason: admin.firestore.FieldValue.delete(),
                    error: admin.firestore.FieldValue.delete(),
                    timestamp: existingData.timestamp || admin.firestore.FieldValue.serverTimestamp()
                };
                await postRef.update(updatePayload);
                console.log(`[REPORTER_EDIT_PENDING] Post ${postId} updated and queued for re-processing.`);
                return { success: true, postId: postId, message: "వార్త అప్‌డేట్ అవుతోంది (నేపథ్యంలో)..." };
            }
        } else {
            const newDocRef = await db.collection('news').add(finalData);
            return { success: true, postId: newDocRef.id, message: "వార్త ప్రచురించబడుతోంది (నేపథ్యంలో)..." };
        }
    } catch (e: any) {
        console.error(`[REPORTER_SUBMISSION] Critical Error:`, e.message);
        throw new HttpsError('internal', e.message);
    }
});

export interface MandalVacancyResult {
    vacant: boolean;
    existingReporter?: {
        id: string;
        name: string;
        phone: string;
        district: string;
        mandal: string;
    };
}

/**
 * Helper: Check if a mandal currently has an active REPORTER in the users collection.
 */
export async function checkMandalVacancy(district: string, mandal: string, excludeUserId?: string): Promise<MandalVacancyResult> {
    const trimmedDistrict = district.trim();
    const trimmedMandal = mandal.trim();
    if (!trimmedDistrict || !trimmedMandal) return { vacant: false };

    // Check users collection for active reporter
    const reporterQuery = await db.collection('users')
        .where('role', 'in', ['REPORTER', 2, 2.0, '2'])
        .where('district', '==', trimmedDistrict)
        .where('assignedMandal', '==', trimmedMandal)
        .limit(2)
        .get();

    if (!reporterQuery.empty) {
        const activeReporters = reporterQuery.docs.filter(doc => {
            if (doc.id === excludeUserId) return false;
            const repData = doc.data();
            if (repData.suspended === true || repData.previouslyDowngraded === true) return false;
            return true;
        });
        if (activeReporters.length > 0) {
            const repData = activeReporters[0].data();
            return {
                vacant: false,
                existingReporter: {
                    id: activeReporters[0].id,
                    name: repData.name || "Reporter",
                    phone: repData.phone || "",
                    district: repData.district || trimmedDistrict,
                    mandal: repData.assignedMandal || repData.mandal || trimmedMandal
                }
            };
        }
    }

    // Secondary check: in case assignedMandal wasn't set but mandal was set
    const mandalQuery = await db.collection('users')
        .where('role', 'in', ['REPORTER', 2, 2.0, '2'])
        .where('district', '==', trimmedDistrict)
        .where('mandal', '==', trimmedMandal)
        .limit(2)
        .get();

    if (!mandalQuery.empty) {
        const activeReporters = mandalQuery.docs.filter(doc => {
            if (doc.id === excludeUserId) return false;
            const repData = doc.data();
            if (repData.suspended === true || repData.previouslyDowngraded === true) return false;
            return true;
        });
        if (activeReporters.length > 0) {
            const repData = activeReporters[0].data();
            return {
                vacant: false,
                existingReporter: {
                    id: activeReporters[0].id,
                    name: repData.name || "Reporter",
                    phone: repData.phone || "",
                    district: repData.district || trimmedDistrict,
                    mandal: repData.assignedMandal || repData.mandal || trimmedMandal
                }
            };
        }
    }

    return { vacant: true };
}

export async function isMandalVacant(district: string, mandal: string, excludeUserId?: string): Promise<boolean> {
    const res = await checkMandalVacancy(district, mandal, excludeUserId);
    return res.vacant;
}

/**
 * Helper: Notify an applicant when their desired mandal is occupied, letting them know
 * their application is forwarded to Admin for competition / probation review.
 */
export async function notifyApplicantOfConflict(
    userId: string,
    applicantName: string,
    district: string,
    mandal: string,
    existingReporterName: string
) {
    if (!userId) return;
    try {
        const conflictText = `నమస్కారం ${applicantName || 'మిత్రమా'}, మీరు కోరిన ${mandal} మండలానికి ఇప్పటికే క్రియాశీల విలేకరి (${existingReporterName || 'ఇతరులు'}) ఉన్నారు.\n\nఅందువల్ల మీ దరఖాస్తు అడ్మిన్ ప్రత్యేక పరిశీలనకు (పోటీ / ప్రొబేషన్) పంపబడింది. మా అడ్మిన్ టీమ్ పరిశీలించి త్వరలోనే మిమ్మల్ని సంప్రదిస్తారు. మీకు ఏవైనా సందేహాలున్నా లేదా మీ వివరాలు తెలియజేయాలన్నా ఇక్కడే అడ్మిన్‌కు నేరుగా మెసేజ్ / రిప్లై ఇవ్వవచ్చు. ధన్యవాదాలు!`;
        const msgTimestamp = admin.firestore.FieldValue.serverTimestamp();
        
        // 1. Add to 2-way reporter conversation for chat
        await db.collection('reporter_conversations').doc(userId).collection('messages').add({
            senderId: "SYSTEM_ADMIN",
            senderName: "AlfaNews Editorial Desk",
            senderRole: "ADMIN",
            text: conflictText,
            type: "NOTICE",
            read: false,
            timestamp: msgTimestamp
        });

        await db.collection('reporter_conversations').doc(userId).set({
            reporterId: userId,
            reporterName: applicantName || "Applicant",
            reporterDistrict: district,
            reporterMandal: mandal,
            lastMessage: conflictText,
            lastMessageTime: msgTimestamp,
            lastSenderRole: "ADMIN",
            lastSenderId: "SYSTEM_ADMIN",
            unreadCountForReporter: 1,
            updatedAt: msgTimestamp
        }, { merge: true });

        // 2. Add to user's general in-app messages list
        await db.collection('users').doc(userId).collection('messages').add({
            title: "మీ దరఖాస్తు పరిశీలనలో ఉంది ⏳",
            body: conflictText,
            senderName: "AlfaNews Editorial Desk",
            senderRole: "ADMIN",
            read: false,
            importance: "HIGH",
            type: "REPORTER_APP_PENDING",
            timestamp: msgTimestamp
        });

        // 3. Send FCM push notification
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data() || {};
        const tokens = [...(userData.fcmTokens || []), userData.fcmToken].filter((t): t is string => typeof t === 'string' && t.trim().length > 0);
        if (tokens.length > 0) {
            const push = tokens.map(token => ({
                token,
                notification: {
                    title: "మీ దరఖాస్తు పరిశీలనలో ఉంది ⏳",
                    body: `${mandal} మండలానికి ఇప్పటికే విలేకరి ఉన్నందున మీ దరఖాస్తు అడ్మిన్ పరిశీలనకు పంపబడింది. వివరాలకు అడ్మిన్ డెస్క్ సందేశాన్ని చూడండి.`
                },
                data: {
                    type: "REPORTER_APP_PENDING",
                    district: district,
                    mandal: mandal
                }
            }));
            await admin.messaging().sendEach(push).catch(() => {});
        }
        console.log(`[CONFLICT_NOTIF] 📩 Sent conflict notice to applicant ${userId} for ${mandal}`);
    } catch (e: any) {
        console.error("[CONFLICT_NOTIF] Failed to send conflict notification:", e.message);
    }
}

export interface ReporterPerformanceAudit {
    reporterId: string;
    reporterName: string;
    reporterPhone: string;
    totalPostsThisMonth: number;
    ownMandalPostsThisMonth: number;
    monthlyTarget: number;
    lastPostDate: Date | null;
    daysSinceLastPost: number;
    meetsBenchmark: boolean;
    shortfall: number;
    evaluationSummary: string;
}

/**
 * Helper: Audits the performance of an existing reporter for a specific mandal.
 * Checks whether the reporter has posted at least 20 news items for their own mandal in the current calendar month,
 * their regularity of posting, and latest active date.
 */
export async function auditExistingReporterPerformance(
    reporterId: string,
    reporterName: string,
    district: string,
    mandal: string
): Promise<ReporterPerformanceAudit> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthlyTarget = 20;

    let totalPostsThisMonth = 0;
    let ownMandalPostsThisMonth = 0;
    let latestPostDate: Date | null = null;
    let reporterPhone = "";

    try {
        const userDoc = await db.collection('users').doc(reporterId).get();
        if (userDoc.exists) {
            const uData = userDoc.data() || {};
            reporterPhone = uData.phone || "";
            if (uData.lastPostTimestamp) {
                const lp = uData.lastPostTimestamp;
                if (typeof lp.toDate === 'function') latestPostDate = lp.toDate();
                else if (lp instanceof Date) latestPostDate = lp;
                else if (typeof lp === 'number') latestPostDate = new Date(lp > 1e11 ? lp : lp * 1000);
            }
        }
    } catch (e: any) {
        console.warn(`[PERF_AUDIT] User fetch warn for ${reporterId}:`, e.message);
    }

    // Query news collection for posts by this reporter created in current month
    try {
        const queryFields = ['reporter.id', 'originalReporterId'];
        const processedDocIds = new Set<string>();

        for (const field of queryFields) {
            const snap = await db.collection('news')
                .where(field, '==', reporterId)
                .where('timestamp', '>=', startOfMonth)
                .get()
                .catch(() => null);

            if (snap && !snap.empty) {
                for (const doc of snap.docs) {
                    if (processedDocIds.has(doc.id)) continue;
                    processedDocIds.add(doc.id);

                    const data = doc.data();
                    if (data.status === 'rejected' || data.isPostRejected === true) continue;

                    totalPostsThisMonth++;

                    const postLocation = (data.location || data.mandal || data.assignedMandal || "").trim();
                    const postDistrict = (data.district || "").trim();

                    const isOwnMandal = areMandalsMatching(postLocation, mandal, district || postDistrict) ||
                        postLocation.toLowerCase().includes(mandal.toLowerCase()) ||
                        mandal.toLowerCase().includes(postLocation.toLowerCase());

                    if (isOwnMandal) {
                        ownMandalPostsThisMonth++;
                    }

                    const postDate = data.timestamp?.toDate ? data.timestamp.toDate() : (data.timestamp ? new Date(data.timestamp) : null);
                    if (postDate && !isNaN(postDate.getTime())) {
                        if (!latestPostDate || postDate.getTime() > latestPostDate.getTime()) {
                            latestPostDate = postDate;
                        }
                    }
                }
            }
        }
    } catch (e: any) {
        console.error(`[PERF_AUDIT] News scan error for reporter ${reporterId}:`, e.message);
    }

    const daysSinceLastPost = latestPostDate
        ? Math.max(0, Math.floor((now.getTime() - latestPostDate.getTime()) / (1000 * 60 * 60 * 24)))
        : 999;

    const meetsBenchmark = ownMandalPostsThisMonth >= monthlyTarget && daysSinceLastPost <= 3;
    const shortfall = Math.max(0, monthlyTarget - ownMandalPostsThisMonth);

    let evaluationSummary = "";
    if (meetsBenchmark) {
        evaluationSummary = `ప్రస్తుత విలేకరి పనితీరు సంతృప్తికరంగా ఉంది (ఈ నెలలో ${ownMandalPostsThisMonth}/${monthlyTarget} సొంత మండల వార్తలు పోస్ట్ చేశారు, చివరి పోస్ట్: ${daysSinceLastPost === 0 ? 'ఈరోజే' : `${daysSinceLastPost} రోజుల క్రితం`}).`;
    } else {
        evaluationSummary = `ప్రస్తుత విలేకరి పనితీరు ఆశించిన స్థాయిలో లేదు (ఈ నెలలో కేవలం ${ownMandalPostsThisMonth}/${monthlyTarget} సొంత మండల వార్తలు మాత్రమే పోస్ట్ చేశారు, లక్ష్యానికి ఇంకా ${shortfall} వార్తలు తక్కువగా ఉన్నాయి, చివరి పోస్ట్: ${daysSinceLastPost >= 999 ? 'వార్తల సమాచారం లేదు' : `${daysSinceLastPost} రోజుల క్రితం`}).`;
    }

    console.log(`[PERF_AUDIT] 📊 Reporter ${reporterName} (${reporterId}) for ${district}-${mandal}: ownMandalPosts=${ownMandalPostsThisMonth}/${monthlyTarget}, totalPosts=${totalPostsThisMonth}, daysSinceLastPost=${daysSinceLastPost}, meetsBenchmark=${meetsBenchmark}`);

    return {
        reporterId,
        reporterName,
        reporterPhone,
        totalPostsThisMonth,
        ownMandalPostsThisMonth,
        monthlyTarget,
        lastPostDate: latestPostDate,
        daysSinceLastPost,
        meetsBenchmark,
        shortfall,
        evaluationSummary
    };
}

/**
 * Helper: Sends a wake-up / performance warning message from the News Desk to an existing reporter
 * whose mandal has received a new application while their own monthly performance is deficient (< 20 own-mandal posts).
 */
export async function alertExistingReporterOfChallenger(
    existingReporterId: string,
    existingReporterName: string,
    district: string,
    mandal: string,
    applicantName: string,
    audit: ReporterPerformanceAudit
) {
    if (!existingReporterId) return;

    try {
        const alertTitle = `మీ పనితీరు మెరుగుపరచుకోవాలి - మండల విలేకరి అలర్ట్ ⚠️`;
        const alertText = `నమస్కారం ${existingReporterName || 'మిత్రమా'}, Alfa News ఎడిటోరియల్ డెస్క్ నుండి అత్యవసర గమనిక.\n\nమీరు కేటాయించబడిన ${mandal} మండలానికి ఈ నెలలో ఆశించిన స్థాయిలో వార్తలు అందించడం లేదు. నిబంధనల ప్రకారం ప్రతినెలా కనీసం 20 సొంత మండల వార్తలను పోస్ట్ చేయాల్సి ఉండగా, ఈ నెలలో మీరు కేవలం ${audit.ownMandalPostsThisMonth} వార్తలు మాత్రమే పోస్ట్ చేశారు (ఇంకా ${audit.shortfall} వార్తల కొరత ఉంది).\n\nమీ మండల వార్తల కవరేజ్ తక్కువగా ఉన్నందున, మీ ${mandal} మండలానికి సంబంధించి ఇప్పటికే '${applicantName || 'కొత్త అభ్యర్థి'}' గారు విలేకరి పదవి కోసం దరఖాస్తు చేసుకున్నారు.\n\nదయచేసి మీ పనితీరును వెంటనే మెరుగుపరుచుకుని, ప్రతిరోజూ మీ మండల తాజా వార్తలను చురుగ్గా పోస్ట్ చేయండి. లేనియెడల సంస్థ నియమావళి ప్రకారం మీ స్థానంలో కొత్త విలేకరిని నియమించే అవకాశం ఉంది.\n\n- Alfa News Editorial Desk`;

        const msgTimestamp = admin.firestore.FieldValue.serverTimestamp();

        // 1. Add to 2-way reporter conversation for chat
        await db.collection('reporter_conversations').doc(existingReporterId).collection('messages').add({
            senderId: "SYSTEM_ADMIN",
            senderName: "AlfaNews Editorial Desk",
            senderRole: "ADMIN",
            text: alertText,
            type: "PERFORMANCE_ALERT",
            read: false,
            timestamp: msgTimestamp
        });

        await db.collection('reporter_conversations').doc(existingReporterId).set({
            lastMessage: alertText,
            lastMessageTime: msgTimestamp,
            lastSenderRole: "ADMIN",
            lastSenderId: "SYSTEM_ADMIN",
            unreadCountForReporter: admin.firestore.FieldValue.increment(1),
            updatedAt: msgTimestamp
        }, { merge: true });

        // 2. Add to user's general in-app messages list
        await db.collection('users').doc(existingReporterId).collection('messages').add({
            title: alertTitle,
            body: alertText,
            senderName: "AlfaNews Editorial Desk",
            senderRole: "ADMIN",
            read: false,
            importance: "HIGH",
            type: "REPORTER_PERFORMANCE_WARNING",
            timestamp: msgTimestamp
        });

        // 3. Send FCM push notification
        const userDoc = await db.collection('users').doc(existingReporterId).get();
        const userData = userDoc.data() || {};
        const tokens = [...(userData.fcmTokens || []), userData.fcmToken].filter((t): t is string => typeof t === 'string' && t.trim().length > 0);
        if (tokens.length > 0) {
            const push = tokens.map(token => ({
                token,
                notification: {
                    title: alertTitle,
                    body: `${mandal} మండలానికి ఈ నెలలో వార్తల సంఖ్య (${audit.ownMandalPostsThisMonth}/20) తక్కువగా ఉంది. మరొకరు దరఖాస్తు చేసుకున్నారు. వెంటనే పనితీరు మెరుగుపరుచుకోండి!`
                },
                data: {
                    type: "REPORTER_PERFORMANCE_WARNING",
                    district: district,
                    mandal: mandal
                }
            }));
            await admin.messaging().sendEach(push).catch(() => {});
        }

        console.log(`[CHALLENGER_ALERT] ⚠️ Sent performance wake-up alert to existing reporter ${existingReporterId} (${existingReporterName}) for mandal ${mandal}.`);
    } catch (e: any) {
        console.error("[CHALLENGER_ALERT] Failed to send challenger alert to existing reporter:", e.message);
    }
}

/**
 * Helper: Sends in-app message & push notification to Admins notifying them of a challenger application
 * where the existing reporter's performance is below benchmark.
 */
export async function sendAdminPerformanceAlert(
    district: string,
    mandal: string,
    existingReporterName: string,
    applicantName: string,
    applicantPhone: string,
    audit: ReporterPerformanceAudit
) {
    try {
        const adminsSnapshot = await db.collection('users')
            .where('role', 'in', ['ADMIN', 'admin', 5, 5.0, '5'])
            .get();

        if (adminsSnapshot.empty) return;

        const title = `పోటీ దరఖాస్తు అలర్ట్: ${district} - ${mandal} ⚠️`;
        const body = `ప్రస్తుత విలేకరి ${existingReporterName} పనితీరు తక్కువగా ఉంది (${audit.ownMandalPostsThisMonth}/20 వార్తలు). ${applicantName} (${applicantPhone}) కొత్తగా దరఖాస్తు చేసుకున్నారు. పరిశీలించండి.`;
        const msgTimestamp = admin.firestore.FieldValue.serverTimestamp();

        for (const adminDoc of adminsSnapshot.docs) {
            await db.collection('users').doc(adminDoc.id).collection('messages').add({
                title,
                body,
                senderName: "AlfaNews Editorial Desk",
                senderRole: "SYSTEM",
                read: false,
                importance: "HIGH",
                type: "REPORTER_COMPETITION_ALERT",
                timestamp: msgTimestamp
            }).catch(() => {});

            const aData = adminDoc.data() || {};
            const aTokens = [...(aData.fcmTokens || []), aData.fcmToken].filter((t): t is string => typeof t === 'string' && t.trim().length > 0);
            if (aTokens.length > 0) {
                const push = aTokens.map(token => ({
                    token,
                    notification: { title, body },
                    data: { type: "REPORTER_COMPETITION_ALERT", district, mandal }
                }));
                await admin.messaging().sendEach(push).catch(() => {});
            }
        }
        console.log(`[ADMIN_PERF_ALERT] 📢 Notified ${adminsSnapshot.size} admins of challenger in ${district}-${mandal}.`);
    } catch (e: any) {
        console.error("[ADMIN_PERF_ALERT] Failed to notify admins:", e.message);
    }
}

/**
 * Helper: Promote user to REPORTER, initialize conversation, send welcome push and desk message.
 */
export async function promoteUserToReporter(
    userId: string,
    fullName: string,
    phone: string,
    district: string,
    mandal: string,
    promoter: string = "AUTO_APPROVAL_SYSTEM",
    options?: { isChallenger?: boolean; inProbation?: boolean; existingReporterId?: string; existingReporterName?: string }
) {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const existingData = userDoc.exists ? (userDoc.data() || {}) : {};

    const isChallenger = options?.isChallenger === true;
    const inProbation = options?.inProbation === true || isChallenger;

    await userRef.set({
        role: "REPORTER",
        district: district,
        assignedMandal: mandal,
        mandal: mandal,
        promotedBy: promoter,
        agreedToRules: true,
        previouslyDowngraded: false,
        suspended: false,
        warningLevel: 0,
        inProbation: inProbation,
        isChallenger: isChallenger,
        downgradedReason: admin.firestore.FieldValue.delete(),
        downgradedAt: admin.firestore.FieldValue.delete(),
        lastWarningDate: admin.firestore.FieldValue.delete(),
        probationStartDate: inProbation ? admin.firestore.FieldValue.serverTimestamp() : null,
        promotedAt: admin.firestore.FieldValue.serverTimestamp(),
        rejoinedAt: admin.firestore.FieldValue.serverTimestamp(),
        joinedAt: existingData.joinedAt || admin.firestore.FieldValue.serverTimestamp(),
        lastPostTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        name: fullName || existingData.name || "",
        phone: phone || existingData.phone || "",
        points: existingData.points ?? 0,
        badges: existingData.badges ?? []
    }, { merge: true });

    console.log(`[REPORTER_PROMOTION] 👑 Promoted user ${userId} to REPORTER for ${district} - ${mandal} (Challenger: ${isChallenger})`);

    // Send In-App Welcome Desk Message & Push to the newly joined reporter
    try {
        const welcomeText = isChallenger
            ? `నమస్కారం ${fullName || 'మిత్రమా'}, ఆల్ఫా న్యూస్ విలేకరి బృందానికి స్వాగతం! 🎉\n\nమీరు ${mandal} మండలానికి ప్రొబేషనరీ (పోటీ) విలేకరిగా ఆమోదించబడ్డారు. నెల రోజుల పాటు మీ పనితీరు ఆధారంగా పర్మనెంట్ విలేకరిని నిర్ణయిస్తారు. మీ మండల తాజా వార్తలను ప్రతిరోజూ చురుగ్గా పోస్ట్ చేయండి. శుభాకాంక్షలు!`
            : `నమస్కారం ${fullName || 'మిత్రమా'}, ఆల్ఫా న్యూస్ విలేకరి బృందానికి మీకు హృదయపూర్వక స్వాగతం! 🎉\n\nమీరు ${mandal} మండల విలేకరిగా నియమించబడ్డారు. మీ మండల తాజా వార్తలను ప్రతిరోజూ కనీసం ఒకటైనా యాప్‌లో పోస్ట్ చేయండి. ఏదైనా సహాయం లేదా సందేహాలు ఉంటే ఇక్కడ నేరుగా మాకు మెసేజ్ చేయవచ్చు. శుభాకాంక్షలు!`;
        
        const msgTimestamp = admin.firestore.FieldValue.serverTimestamp();
        await db.collection('reporter_conversations').doc(userId).collection('messages').add({
            senderId: "SYSTEM_ADMIN",
            senderName: "AlfaNews Editorial Desk",
            senderRole: "ADMIN",
            text: welcomeText,
            type: "NOTICE",
            read: false,
            timestamp: msgTimestamp
        });

        await db.collection('reporter_conversations').doc(userId).set({
            reporterId: userId,
            reporterName: fullName || existingData.name || "Reporter",
            reporterPhone: phone || existingData.phone || "",
            reporterDistrict: district,
            reporterMandal: mandal,
            lastMessage: welcomeText,
            lastMessageTime: msgTimestamp,
            lastSenderRole: "ADMIN",
            lastSenderId: "SYSTEM_ADMIN",
            unreadCountForReporter: 1,
            updatedAt: msgTimestamp
        }, { merge: true });

        // Push Notification to new reporter
        const userTokens = [...(existingData.fcmTokens || []), existingData.fcmToken].filter((t): t is string => typeof t === 'string' && t.trim().length > 0);
        if (userTokens.length > 0) {
            const pushMessages = userTokens.map(token => ({
                token,
                notification: {
                    title: isChallenger ? "ప్రొబేషనరీ విలేకరిగా ఆమోదించబడ్డారు! 🌟" : "ఆల్ఫా న్యూస్ విలేకరి బృందానికి స్వాగతం! 🎉",
                    body: isChallenger
                        ? `మీరు ${mandal} మండలానికి ప్రొబేషనరీ విలేకరిగా చేరారు. నేటి నుంచే వార్తలు పోస్ట్ చేయండి!`
                        : `మీరు ${mandal} మండల విలేకరిగా ఆమోదించబడ్డారు. నేటి నుంచే వార్తలను పోస్ట్ చేయడం ప్రారంభించండి!`
                },
                data: {
                    type: "REPORTER_WELCOME",
                    mandal: mandal,
                    district: district
                }
            }));
            await admin.messaging().sendEach(pushMessages).catch(() => {});
        }

        // If challenger, also send notice to existing reporter
        if (isChallenger && options?.existingReporterId) {
            const existingRepDoc = await db.collection('users').doc(options.existingReporterId).get();
            const existingRepData = existingRepDoc.data() || {};
            const existingTokens = [...(existingRepData.fcmTokens || []), existingRepData.fcmToken].filter((t): t is string => typeof t === 'string' && t.trim().length > 0);
            if (existingTokens.length > 0) {
                const repPush = existingTokens.map(token => ({
                    token,
                    notification: {
                        title: `మీ మండలానికి మరొక విలేకరి తోడయ్యారు! 📰`,
                        body: `${mandal} మండలానికి కొత్త విలేకరి చేరారు. ప్రతిరోజూ చురుగ్గా వార్తలు పోస్ట్ చేస్తూ మీ అగ్రస్థానాన్ని కాపాడుకోండి!`
                    },
                    data: {
                        type: "CO_REPORTER_JOINED",
                        mandal: mandal,
                        district: district
                    }
                }));
                await admin.messaging().sendEach(repPush).catch(() => {});
            }
        }
    } catch (msgErr: any) {
        console.error("[REPORTER_PROMOTION] Failed to send welcome message/push to reporter:", msgErr.message);
    }
}

/**
 * Helper: Send notification email to admin when a reporter application is submitted/approved.
 */
export async function sendReporterApplicationEmail(
    data: any,
    shouldAutoApprove: boolean,
    isPreviouslyDowngraded: boolean,
    finalStatus: string,
    conflictInfo?: { isConflict: boolean; existingReporterName?: string; existingReporterPhone?: string },
    performanceAudit?: ReporterPerformanceAudit
) {
    const {
        fullName,
        fatherName,
        phone,
        address,
        position,
        interestedArea,
        education,
        currentOrg,
        state,
        district,
        mandal,
        message,
        userId
    } = data;

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    if (!emailUser || !emailPass) {
        console.log("[REPORTER_APP_EMAIL] ℹ️ EMAIL_USER or EMAIL_PASS not configured in environment. Skipping email dispatch.");
        return;
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: emailUser,
            pass: emailPass
        }
    });

    const isConflict = conflictInfo?.isConflict === true;
    const existingRepName = conflictInfo?.existingReporterName || "Active Reporter";
    const existingRepPhone = conflictInfo?.existingReporterPhone || "";

    const emailContent = `
        ${shouldAutoApprove ? '[AUTO-APPROVED - ఆటోమేటిక్ అప్రూవ్ అయింది]' : isConflict ? (performanceAudit && !performanceAudit.meetsBenchmark ? '[పోటీ దరఖాస్తు - విలేకరి పనితీరు తక్కువ]' : '[పోటీ దరఖాస్తు / అడ్మిన్ పరిశీలన]') : 'New Reporter Application:'}
        -------------------------
        Status: ${finalStatus}
        Full Name: ${fullName || 'N/A'}
        Father's Name: ${fatherName || 'N/A'}
        Phone Number: ${phone || 'N/A'}
        Address: ${address || 'N/A'}
        Position: ${position || 'N/A'}
        Interested Area: ${interestedArea || 'N/A'}
        Educational Qualification: ${education || 'N/A'}
        Currently Working Organization: ${currentOrg || 'N/A'}
        State: ${state || 'N/A'}
        District: ${district || 'N/A'}
        Mandal: ${mandal || 'N/A'}
        Message: ${message || 'N/A'}
        User ID: ${userId || 'N/A'}
        ${isConflict ? `Existing Reporter: ${existingRepName} (${existingRepPhone})` : ''}
        ${performanceAudit ? `Performance Audit: Own Mandal Posts This Month: ${performanceAudit.ownMandalPostsThisMonth}/${performanceAudit.monthlyTarget}, Total Posts: ${performanceAudit.totalPostsThisMonth}, Days Since Last Post: ${performanceAudit.daysSinceLastPost}, Meets Benchmark: ${performanceAudit.meetsBenchmark}` : ''}
    `;

    const htmlEmail = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; margin: 0 auto;">
            <div style="background-color: ${shouldAutoApprove ? '#2e7d32' : isConflict ? '#e65100' : '#d32f2f'}; color: white; padding: 16px; text-align: center; font-size: 20px; font-weight: bold;">
                Alfa News - ${shouldAutoApprove ? 'కొత్త రిపోర్టర్ చేరారు (Auto-Approved)' : isConflict ? 'పోటీ దరఖాస్తు (అడ్మిన్ పరిశీలన)' : 'కొత్త రిపోర్టర్ దరఖాస్తు'}
            </div>
            <div style="padding: 20px;">
                ${isPreviouslyDowngraded 
                    ? '<div style="background-color: #fff3e0; border: 1px solid #ff9800; color: #e65100; padding: 12px; border-radius: 6px; margin-bottom: 16px; font-weight: bold; text-align: center;">⚠️ గమనిక: ఈ అభ్యర్థి గతంలో విలేకరిగా ఉండి నిష్క్రియాత్మకత వల్ల తొలగించబడిన రికార్డు ఉంది. అందువల్ల ఆటో-అప్రూవల్ చేయబడలేదు, మీ పరిశీలన (PENDING) కోసం ఉంచబడింది.</div>'
                    : isConflict
                        ? `<div style="background-color: #fff3e0; border: 1px solid #ff9800; color: #e65100; padding: 12px; border-radius: 6px; margin-bottom: 16px; font-weight: bold; text-align: center;">⚠️ గమనిక: ${mandal} మండలానికి ఇప్పటికే క్రియాశీల విలేకరి (${existingRepName} - ${existingRepPhone}) ఉన్నారు. ఈ అభ్యర్థిని ప్రొబేషన్ / పోటీదారుగా ఆమోదించవచ్చు లేదా వేరే మండలాన్ని కేటాయించవచ్చు.</div>`
                        : shouldAutoApprove 
                            ? '<div style="background-color: #e8f5e9; border: 1px solid #4caf50; color: #2e7d32; padding: 12px; border-radius: 6px; margin-bottom: 16px; font-weight: bold; text-align: center;">✅ ఈ విలేకరి మండలానికి ఎవరూ లేనందున ఆటోమేటిక్‌గా అప్రూవ్ చేయబడ్డారు (Auto-Approved).</div>'
                            : ''}
                
                ${performanceAudit ? `
                    <div style="background-color: ${performanceAudit.meetsBenchmark ? '#e8f5e9' : '#fff3e0'}; border: 1px solid ${performanceAudit.meetsBenchmark ? '#4caf50' : '#ff9800'}; padding: 14px; border-radius: 6px; margin-bottom: 16px;">
                        <div style="font-weight: bold; font-size: 15px; color: ${performanceAudit.meetsBenchmark ? '#2e7d32' : '#e65100'}; margin-bottom: 8px;">
                            📊 ప్రస్తుత మండల విలేకరి పనితీరు విశ్లేషణ (Performance Audit):
                        </div>
                        <div style="font-size: 13px; line-height: 1.6; color: #333;">
                            <div><b>ప్రస్తుత విలేకరి:</b> ${performanceAudit.reporterName || existingRepName} (${performanceAudit.reporterPhone || existingRepPhone})</div>
                            <div><b>ఈ నెల సొంత మండల వార్తలు:</b> <span style="font-weight: bold; color: ${performanceAudit.meetsBenchmark ? '#2e7d32' : '#d32f2f'};">${performanceAudit.ownMandalPostsThisMonth} / ${performanceAudit.monthlyTarget}</span> (కనీసం 20 వార్తలు ఉండాలి)</div>
                            <div><b>ఈ నెల మొత్తం వార్తలు:</b> ${performanceAudit.totalPostsThisMonth}</div>
                            <div><b>చివరి పోస్ట్:</b> ${performanceAudit.daysSinceLastPost >= 999 ? 'సమాచారం లేదు' : `${performanceAudit.daysSinceLastPost} రోజుల క్రితం`}</div>
                            <div style="margin-top: 6px;"><b>నిర్ణయం:</b> ${performanceAudit.evaluationSummary}</div>
                            ${!performanceAudit.meetsBenchmark ? '<div style="margin-top: 6px; color: #d32f2f; font-weight: bold;">⚠️ గమనిక: ప్రస్తుత విలేకరికి పనితీరు మెరుగుపరుచుకోవాలని మరియు పోటీదారు దరఖాస్తు చేసుకున్నారని న్యూస్ డెస్క్ నుండి అలర్ట్ సందేశం పంపబడింది.</div>' : ''}
                        </div>
                    </div>
                ` : ''}

                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tr><td style="padding: 8px; font-weight: bold; width: 180px;">స్టేటస్ (Status):</td><td style="padding: 8px; font-weight: bold; color: ${shouldAutoApprove ? '#2e7d32' : '#f57c00'};">${finalStatus}</td></tr>
                    <tr style="background-color: #f9f9f9;"><td style="padding: 8px; font-weight: bold; width: 180px;">పేరు (Full Name):</td><td style="padding: 8px;">${fullName || 'N/A'}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">తండ్రి పేరు (Father's Name):</td><td style="padding: 8px;">${fatherName || 'N/A'}</td></tr>
                    <tr style="background-color: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">ఫోన్ నంబర్ (Phone):</td><td style="padding: 8px;">${phone || 'N/A'}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">చిరునామా (Address):</td><td style="padding: 8px;">${address || 'N/A'}</td></tr>
                    <tr style="background-color: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">రాష్ట్రం (State):</td><td style="padding: 8px;">${state || 'N/A'}</td></tr>
                    <tr style="background-color: #ffebee;"><td style="padding: 8px; font-weight: bold; color: #d32f2f;">జిల్లా (District):</td><td style="padding: 8px; font-weight: bold; color: #d32f2f; font-size: 16px;">${district || 'N/A'}</td></tr>
                    <tr style="background-color: #ffebee;"><td style="padding: 8px; font-weight: bold; color: #d32f2f;">మండలం (Mandal):</td><td style="padding: 8px; font-weight: bold; color: #d32f2f; font-size: 16px;">${mandal || 'N/A'}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">కోరిన పదవి (Position):</td><td style="padding: 8px;">${position || 'N/A'}</td></tr>
                    <tr style="background-color: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">ఆసక్తి ఉన్న విభాగం:</td><td style="padding: 8px;">${interestedArea || 'N/A'}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">విద్యార్హత (Education):</td><td style="padding: 8px;">${education || 'N/A'}</td></tr>
                    <tr style="background-color: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">ప్రస్తుత సంస్థ:</td><td style="padding: 8px;">${currentOrg || 'N/A'}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">సందేశం (Message):</td><td style="padding: 8px;">${message || 'N/A'}</td></tr>
                    <tr style="background-color: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">User ID:</td><td style="padding: 8px;">${userId || 'N/A'}</td></tr>
                </table>
            </div>
        </div>
    `;

    const emailSubject = isPreviouslyDowngraded
        ? `[గతంలో తొలగించబడిన విలేకరి మళ్లీ దరఖాస్తు] ${fullName || 'N/A'} (${district} - ${mandal})`
        : isConflict
            ? (performanceAudit && !performanceAudit.meetsBenchmark)
                ? `[పోటీ దరఖాస్తు - ప్రస్తుత విలేకరి పనితీరు తక్కువ] ${fullName || 'N/A'} (${district} - ${mandal})`
                : `[పోటీ దరఖాస్తు / అడ్మిన్ పరిశీలన] ${fullName || 'N/A'} (${district} - ${mandal})`
            : shouldAutoApprove 
                ? `[ఆటో-అప్రూవ్ అయింది] కొత్త రిపోర్టర్ చేరారు: ${fullName || 'N/A'} (${district} - ${mandal})`
                : `రిపోర్టర్ దరఖాస్తు: ${fullName || 'N/A'} (${district} - ${mandal})`;

    try {
        console.log(`[REPORTER_APP] 📧 Sending email to alfanews0861@gmail.com (Subject: ${emailSubject})`);
        await transporter.sendMail({
            from: `"Alfa News Applications" <${emailUser}>`,
            to: 'alfanews0861@gmail.com',
            subject: emailSubject,
            text: emailContent,
            html: htmlEmail
        });
        console.log(`[REPORTER_APP] ✉️ Email sent successfully to admin!`);
    } catch (error: any) {
        console.error("[REPORTER_APP] ❌ Email send failed during application submission:", error.message);
    }
}

export const submitReporterApplication = onCall({ secrets: ["EMAIL_USER", "EMAIL_PASS"] }, async (request) => {
    const data = request.data;
    let {
        fullName,
        fatherName,
        phone,
        address,
        position,
        interestedArea,
        education,
        currentOrg,
        state,
        district,
        mandal,
        message,
        userId
    } = data;

    let rawDistrict = district || data.assignedDistrict || data.selectedDistrict || data.state_district || "";
    let rawMandal = mandal || data.assignedMandal || data.selectedMandal || data.mandalam || "";
    let trimmedDistrict = String(rawDistrict || "").trim();
    let trimmedMandal = String(rawMandal || "").trim();

    const rawPhone = String(phone || data.phoneNumber || "").trim();
    const clean10 = rawPhone.replace(/\D/g, '').slice(-10);

    const finalFullName = String(fullName || data.name || "").trim();
    const finalFatherName = String(fatherName || "").trim();
    const finalAddress = String(address || "").trim();
    const finalInterestedArea = String(interestedArea || "").trim();
    const finalEducation = String(education || "").trim();
    const finalCurrentOrg = String(currentOrg || "").trim();

    // Strict input validation
    if (!finalFullName || finalFullName.length < 3) {
        throw new HttpsError('invalid-argument', 'కనీసం 3 అక్షరాలతో పూర్తి పేరు నమోదు చేయాలి.');
    }
    if (!finalFatherName || finalFatherName.length < 3) {
        throw new HttpsError('invalid-argument', 'కనీసం 3 అక్షరాలతో తండ్రి పేరు నమోదు చేయాలి.');
    }
    if (clean10.length !== 10 || !/^[6-9]\d{9}$/.test(clean10)) {
        throw new HttpsError('invalid-argument', 'చెల్లుబాటు అయ్యే 10 అంకెల మొబైల్ నంబర్ తప్పనిసరి (6-9 తో ప్రారంభం కావాలి).');
    }
    if (!finalAddress || finalAddress.length < 6) {
        throw new HttpsError('invalid-argument', 'కనీసం 6 అక్షరాలతో చిరునామా నమోదు చేయాలి.');
    }

    // If userId or district/mandal is missing, look up user profile
    let existingUserData: any = {};
    if (userId) {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) existingUserData = userDoc.data() || {};
    } else if (clean10.length === 10) {
        const phoneFormats = [`+91${clean10}`, clean10, `0${clean10}`, `91${clean10}`];
        for (const fmt of phoneFormats) {
            const uQuery = await db.collection('users').where('phone', '==', fmt).limit(1).get();
            if (!uQuery.empty) {
                const uDoc = uQuery.docs[0];
                userId = uDoc.id;
                existingUserData = uDoc.data() || {};
                break;
            }
        }
    }

    if (!trimmedDistrict && existingUserData.district) {
        trimmedDistrict = String(existingUserData.district).trim();
    }
    if (!trimmedMandal && (existingUserData.assignedMandal || existingUserData.mandal)) {
        trimmedMandal = String(existingUserData.assignedMandal || existingUserData.mandal).trim();
    }

    // Smart text extraction from address/interestedArea/profile if still missing
    if (!trimmedDistrict || !trimmedMandal) {
        const extracted = extractDistrictAndMandal(address, interestedArea, existingUserData.district, existingUserData.address);
        if (!trimmedDistrict) trimmedDistrict = extracted.district;
        if (!trimmedMandal) trimmedMandal = extracted.mandal;
    }

    if (!trimmedDistrict || !trimmedMandal) {
        throw new HttpsError('invalid-argument', 'జిల్లా మరియు మండలం తప్పనిసరిగా ఎంచుకోవాలి.');
    }
    if (!finalInterestedArea) {
        throw new HttpsError('invalid-argument', 'ఆసక్తి ఉన్న కేటగిరీ తప్పనిసరి.');
    }
    if (!finalEducation) {
        throw new HttpsError('invalid-argument', 'విద్యార్హత తప్పనిసరి.');
    }
    if (!finalCurrentOrg) {
        throw new HttpsError('invalid-argument', 'ప్రస్తుత సంస్థ లేదా వృత్తి తప్పనిసరి.');
    }

    console.log(`[REPORTER_APP] 📥 Processing application for ${finalFullName} (District: ${trimmedDistrict}, Mandal: ${trimmedMandal}, UserId: ${userId || 'N/A'}, Phone: ${clean10})`);

    // 1. Check vacancy for mandal in users collection
    const vacancyResult = await checkMandalVacancy(trimmedDistrict, trimmedMandal, userId);
    const vacant = vacancyResult.vacant;
    const existingRep = vacancyResult.existingReporter;

    // 2. Check if THIS APPLICANT was previously removed / downgraded for inactivity or suspended
    let isPreviouslyDowngraded = false;
    if (
        existingUserData.previouslyDowngraded === true || 
        existingUserData.suspended === true || 
        existingUserData.downgradedReason === "INACTIVITY"
    ) {
        isPreviouslyDowngraded = true;
    }

    if (!isPreviouslyDowngraded && clean10.length === 10) {
        const prevAppSnap = await db.collection('reporter_applications')
            .where('phone', 'in', [`+91${clean10}`, clean10])
            .where('status', '==', 'SUSPENDED')
            .limit(1)
            .get();
        if (!prevAppSnap.empty) {
            isPreviouslyDowngraded = true;
        }
    }

    // Auto-approve IF user is not previously downgraded and mandal is vacant
    const shouldAutoApprove = Boolean(userId && !isPreviouslyDowngraded && vacant);
    const finalStatus = shouldAutoApprove ? "JOINED" : "PENDING";
    const isConflict = !vacant;

    console.log(`[REPORTER_APP] ⚖️ Decision: shouldAutoApprove=${shouldAutoApprove}, finalStatus=${finalStatus}, isPrevDowngraded=${isPreviouslyDowngraded}, isVacant=${vacant}, isConflict=${isConflict}`);

    // Save application to Firestore
    const newAppRef = await db.collection('reporter_applications').add({
        ...data,
        fullName: finalFullName,
        fatherName: finalFatherName,
        phone: clean10,
        address: finalAddress,
        interestedArea: finalInterestedArea,
        education: finalEducation,
        currentOrg: finalCurrentOrg,
        district: trimmedDistrict,
        mandal: trimmedMandal,
        userId: userId || data.userId || null,
        status: finalStatus,
        autoApproved: shouldAutoApprove,
        isConflict: isConflict,
        existingReporterName: existingRep?.name || null,
        existingReporterPhone: existingRep?.phone || null,
        existingReporterId: existingRep?.id || null,
        isReapplication: isPreviouslyDowngraded,
        previouslyDowngraded: isPreviouslyDowngraded,
        agreedToRules: true,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`[REPORTER_APP] 💾 Saved application document: ${newAppRef.id}`);

    // If auto-approved, promote user immediately
    if (shouldAutoApprove && userId) {
        try {
            const oldAppsQuery = await db.collection('reporter_applications')
                .where('userId', '==', userId)
                .where('status', '==', 'PENDING')
                .get();
            for (const doc of oldAppsQuery.docs) {
                if (doc.id !== newAppRef.id) {
                    await doc.ref.update({ status: 'JOINED', autoApproved: true, supersededBy: newAppRef.id });
                }
            }
            if (clean10.length === 10) {
                const oldPhoneQuery = await db.collection('reporter_applications')
                    .where('phone', '==', clean10)
                    .where('status', '==', 'PENDING')
                    .get();
                for (const doc of oldPhoneQuery.docs) {
                    if (doc.id !== newAppRef.id) {
                        await doc.ref.update({ status: 'JOINED', autoApproved: true, supersededBy: newAppRef.id });
                    }
                }
            }
        } catch (e: any) {
            console.error("[REPORTER_APP] Non-critical error updating previous applications:", e.message);
        }

        // Promote user role to REPORTER immediately
        await promoteUserToReporter(userId, finalFullName, clean10, trimmedDistrict, trimmedMandal, "AUTO_APPROVAL_SYSTEM");
    } else if (isConflict && existingRep) {
        let perfAudit: ReporterPerformanceAudit | undefined;
        try {
            perfAudit = await auditExistingReporterPerformance(
                existingRep.id,
                existingRep.name,
                trimmedDistrict,
                trimmedMandal
            );

            // If existing reporter's performance is below benchmark (< 20 own-mandal news or inactive)
            if (!perfAudit.meetsBenchmark) {
                // 1. Alert existing reporter that a challenger applied and they must improve
                await alertExistingReporterOfChallenger(
                    existingRep.id,
                    existingRep.name,
                    trimmedDistrict,
                    trimmedMandal,
                    finalFullName,
                    perfAudit
                );

                // 2. Alert Admins via in-app notification & push
                await sendAdminPerformanceAlert(
                    trimmedDistrict,
                    trimmedMandal,
                    existingRep.name,
                    finalFullName,
                    clean10,
                    perfAudit
                );
            }
        } catch (auditErr: any) {
            console.error("[REPORTER_APP] Performance audit error:", auditErr.message);
        }

        // Notify applicant that mandal is occupied and application is forwarded for Admin competition review
        if (userId) {
            await notifyApplicantOfConflict(userId, finalFullName, trimmedDistrict, trimmedMandal, existingRep.name || "విలేకరి");
        }

        // Send notification email to admin with performance audit attached
        await sendReporterApplicationEmail(
            { 
                ...data, 
                fullName: finalFullName, 
                fatherName: finalFatherName, 
                phone: clean10, 
                address: finalAddress, 
                interestedArea: finalInterestedArea, 
                education: finalEducation, 
                currentOrg: finalCurrentOrg, 
                district: trimmedDistrict, 
                mandal: trimmedMandal, 
                userId 
            },
            shouldAutoApprove,
            isPreviouslyDowngraded,
            finalStatus,
            { isConflict, existingReporterName: existingRep.name, existingReporterPhone: existingRep.phone },
            perfAudit
        );

        return { 
            success: true, 
            autoApproved: shouldAutoApprove, 
            isPreviouslyDowngraded,
            isConflict,
            existingReporterName: existingRep.name || null,
            existingReporterPerformance: perfAudit ? {
                ownMandalPostsThisMonth: perfAudit.ownMandalPostsThisMonth,
                totalPostsThisMonth: perfAudit.totalPostsThisMonth,
                meetsBenchmark: perfAudit.meetsBenchmark,
                shortfall: perfAudit.shortfall
            } : null,
            status: finalStatus 
        };
    }

    // Send notification email to admin (for non-conflict / auto-approved cases)
    await sendReporterApplicationEmail(
        { 
            ...data, 
            fullName: finalFullName, 
            fatherName: finalFatherName, 
            phone: clean10, 
            address: finalAddress, 
            interestedArea: finalInterestedArea, 
            education: finalEducation, 
            currentOrg: finalCurrentOrg, 
            district: trimmedDistrict, 
            mandal: trimmedMandal, 
            userId 
        },
        shouldAutoApprove,
        isPreviouslyDowngraded,
        finalStatus,
        { isConflict, existingReporterName: existingRep?.name, existingReporterPhone: existingRep?.phone }
    );

    return { 
        success: true, 
        autoApproved: shouldAutoApprove, 
        isPreviouslyDowngraded,
        isConflict,
        existingReporterName: existingRep?.name || null,
        status: finalStatus 
    };
});

/**
 * Background Trigger: Auto-approve newly created reporter applications
 * Catches direct Firestore additions (from web, scripts, or client fallback)
 */
export const onReporterApplicationCreated = onDocumentCreated({
    document: "reporter_applications/{appId}",
    region: REGION,
    secrets: ["EMAIL_USER", "EMAIL_PASS"]
}, async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const appId = event.params.appId;
    const applicantName = data.fullName || data.name || "No Name";
    const rawPhone = String(data.phone || data.phoneNumber || data.mobile || "").trim();
    const clean10 = rawPhone.replace(/\D/g, '').slice(-10);

    let district = String(data.district || data.selectedDistrict || data.assignedDistrict || data.state_district || data.stateDistrict || "").trim();
    let mandal = String(data.mandal || data.selectedMandal || data.assignedMandal || data.mandalam || "").trim();
    let userId = String(data.userId || data.uid || data.user_id || "").trim();
    let rawStatus = String(data.status || "").trim().toUpperCase();

    // 1. If userId is missing, search users collection by phone
    let userDocData: any = null;
    if (!userId && clean10.length === 10) {
        const phoneFormats = [`+91${clean10}`, clean10, `0${clean10}`, `91${clean10}`];
        for (const fmt of phoneFormats) {
            const uQuery = await db.collection('users').where('phone', '==', fmt).limit(1).get();
            if (!uQuery.empty) {
                const uDoc = uQuery.docs[0];
                userId = uDoc.id;
                userDocData = uDoc.data();
                break;
            }
        }
    }

    if (userId && !userDocData) {
        const uDoc = await db.collection('users').doc(userId).get();
        if (uDoc.exists) userDocData = uDoc.data();
    }

    // 2. If district or mandal is missing in application, try resolving from user document
    if ((!district || !mandal) && userDocData) {
        if (!district) district = String(userDocData.district || "").trim();
        if (!mandal) mandal = String(userDocData.assignedMandal || userDocData.mandal || "").trim();
    }

    // 3. Smart extraction from address/interestedArea/profile if still missing
    if (!district || !mandal) {
        const extracted = extractDistrictAndMandal(data.address, data.interestedArea, userDocData?.district || district, userDocData?.address);
        if (!district) district = extracted.district;
        if (!mandal) mandal = extracted.mandal;
    }

    // Check if application has all mandatory fields completed
    const isApplicationComplete = Boolean(
        applicantName.length >= 3 &&
        applicantName !== "No Name" &&
        clean10.length === 10 &&
        /^[6-9]\d{9}$/.test(clean10) &&
        district &&
        mandal
    );

    if (!isApplicationComplete) {
        console.warn(`[REPORTER_APP_TRIGGER] ⚠️ Application ${appId} is incomplete (name: '${applicantName}', phone: '${clean10}', dist: '${district}', mandal: '${mandal}'). Flagging as INCOMPLETE and skipping auto-approval.`);
        await event.data?.ref.update({
            status: "INCOMPLETE",
            autoApproved: false,
            incompleteReason: "తప్పనిసరి వివరాలు (కనీసం 3 అక్షరాల పేరు, చెల్లుబాటు అయ్యే 10 అంకెల ఫోన్, జిల్లా, మండలం) లేవు."
        });
        return;
    }

    // Check if user was previously downgraded/suspended
    let isPreviouslyDowngraded = data.previouslyDowngraded === true || data.isReapplication === true;
    if (!isPreviouslyDowngraded && userDocData) {
        if (userDocData.previouslyDowngraded === true || userDocData.suspended === true || userDocData.downgradedReason === "INACTIVITY") {
            isPreviouslyDowngraded = true;
        }
    }

    // Check vacancy for mandal in users collection
    let vacancyResult: MandalVacancyResult = { vacant: false };
    if (district && mandal) {
        vacancyResult = await checkMandalVacancy(district, mandal, userId);
    }
    const vacant = vacancyResult.vacant;
    const existingRep = vacancyResult.existingReporter;

    // Determine auto-approval eligibility
    const canAutoApprove = Boolean(district && mandal && userId && !isPreviouslyDowngraded && vacant);
    const isConflict = Boolean(district && mandal && !vacant);

    console.log(`[REPORTER_APP_TRIGGER] 📋 Processing ${appId} for ${applicantName} (dist: '${district}', mandal: '${mandal}', userId: '${userId}', canAutoApprove: ${canAutoApprove}, isConflict: ${isConflict})`);

    if (canAutoApprove) {
        console.log(`[REPORTER_APP_TRIGGER] ✅ Mandal ${mandal} is VACANT. Auto-approving application ${appId}...`);

        // Update application document
        await event.data?.ref.update({
            status: "JOINED",
            autoApproved: true,
            district,
            mandal,
            userId,
            emailSentToAdmin: true,
            approvedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Promote user to REPORTER
        await promoteUserToReporter(
            userId,
            applicantName,
            rawPhone || userDocData?.phone || "",
            district,
            mandal,
            "AUTO_APPROVAL_TRIGGER"
        );

        // Send notification email to admin
        await sendReporterApplicationEmail(
            { ...data, district, mandal, fullName: applicantName, phone: rawPhone, userId },
            true,
            false,
            "JOINED"
        );
    } else if (isConflict) {
        console.log(`[REPORTER_APP_TRIGGER] ⚠️ Mandal ${mandal} in ${district} is occupied by ${existingRep?.name}. Auditing existing reporter performance...`);

        let perfAudit: ReporterPerformanceAudit | undefined;
        if (existingRep?.id) {
            try {
                perfAudit = await auditExistingReporterPerformance(
                    existingRep.id,
                    existingRep.name || "Reporter",
                    district,
                    mandal
                );

                if (!perfAudit.meetsBenchmark) {
                    await alertExistingReporterOfChallenger(
                        existingRep.id,
                        existingRep.name || "Reporter",
                        district,
                        mandal,
                        applicantName,
                        perfAudit
                    );

                    await sendAdminPerformanceAlert(
                        district,
                        mandal,
                        existingRep.name || "Reporter",
                        applicantName,
                        rawPhone,
                        perfAudit
                    );
                }
            } catch (auditErr: any) {
                console.error("[REPORTER_APP_TRIGGER] Audit error:", auditErr.message);
            }
        }

        await event.data?.ref.update({
            district,
            mandal,
            userId: userId || null,
            status: "PENDING",
            isConflict: true,
            emailSentToAdmin: true,
            existingReporterName: existingRep?.name || null,
            existingReporterPhone: existingRep?.phone || null,
            existingReporterId: existingRep?.id || null,
            existingReporterPerformance: perfAudit ? {
                totalPostsThisMonth: perfAudit.totalPostsThisMonth,
                ownMandalPostsThisMonth: perfAudit.ownMandalPostsThisMonth,
                meetsBenchmark: perfAudit.meetsBenchmark,
                shortfall: perfAudit.shortfall,
                daysSinceLastPost: perfAudit.daysSinceLastPost
            } : null
        });

        if (userId) {
            await notifyApplicantOfConflict(userId, applicantName, district, mandal, existingRep?.name || "విలేకరి");
        }

        // Send email alert to admin with performance audit attached
        await sendReporterApplicationEmail(
            { ...data, district, mandal, fullName: applicantName, phone: rawPhone, userId },
            false,
            isPreviouslyDowngraded,
            "PENDING",
            { isConflict: true, existingReporterName: existingRep?.name, existingReporterPhone: existingRep?.phone },
            perfAudit
        );
    } else {
        // Missing location details or user account
        console.log(`[REPORTER_APP_TRIGGER] ℹ️ Application ${appId} kept PENDING for manual admin review (Missing dist/mandal/userId or prev downgraded).`);

        if (district || mandal || userId) {
            await event.data?.ref.update({
                district: district || data.district || "",
                mandal: mandal || data.mandal || "",
                userId: userId || data.userId || null,
                emailSentToAdmin: true
            });
        }

        // ALWAYS SEND EMAIL TO ADMIN SO YOU NEVER MISS ANY APPLICANT!
        await sendReporterApplicationEmail(
            { ...data, district: district || "N/A", mandal: mandal || "N/A", fullName: applicantName, phone: rawPhone, userId },
            false,
            isPreviouslyDowngraded,
            rawStatus === "JOINED" ? "JOINED" : "PENDING"
        );
    }
});

/**
 * Helper to verify Admin Bearer token for HTTP endpoints
 */
async function verifyHttpAdminAuth(req: any): Promise<boolean> {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const idToken = authHeader.split('Bearer ')[1].trim();
            const decoded = await admin.auth().verifyIdToken(idToken);
            const userDoc = await db.collection('users').doc(decoded.uid).get();
            const role = String(userDoc.data()?.role || '').toUpperCase();
            return ['ADMIN', 'EDITOR', '5', '5.0', '7', '7.0'].includes(role);
        }
        return false;
    } catch {
        return false;
    }
}

/**
 * Callable function to scan and auto-approve existing pending reporter applications whose mandals are vacant.
 */
export const autoApproveAllPendingApplications = onCall({ secrets: ["EMAIL_USER", "EMAIL_PASS"] }, async (request) => {
    const auth = request.auth;
    if (!auth || !auth.uid) {
        throw new HttpsError('unauthenticated', 'మీరు లాగిన్ అవ్వాలి.');
    }
    const adminDoc = await db.collection('users').doc(auth.uid).get();
    const role = String(adminDoc.data()?.role || '').toUpperCase();
    if (!['ADMIN', 'EDITOR', '5', '5.0', '7', '7.0'].includes(role)) {
        throw new HttpsError('permission-denied', 'అడ్మిన్లకు మాత్రమే ఈ అనుమతి ఉంది.');
    }
    return await executeAutoApprovePendingBackfill();
});

/**
 * HTTP endpoint to trigger the backfill scan directly and return execution summary (Admin Token Required).
 */
export const runAutoApprovePendingBackfill = onRequest({ secrets: ["EMAIL_USER", "EMAIL_PASS"], region: REGION }, async (req, res) => {
    if (!(await verifyHttpAdminAuth(req))) {
        res.status(403).json({ error: "Forbidden: Admin Bearer token required" });
        return;
    }
    try {
        if (req.query.getAllActiveReporters) {
            const snap = await db.collection('users')
                .where('role', 'in', ['REPORTER', 2, 2.0, '2'])
                .get();
            const list = snap.docs.map(d => {
                const u = d.data();
                return {
                    id: d.id,
                    name: u.name || u.fullName || "N/A",
                    phone: u.phone || u.phoneNumber || "N/A",
                    district: u.district || "N/A",
                    mandal: u.assignedMandal || u.mandal || "N/A",
                    suspended: u.suspended === true,
                    promotedAt: u.promotedAt || null,
                    lastPostTimestamp: u.lastPostTimestamp || null
                };
            });
            res.status(200).json({ count: list.length, reporters: list });
            return;
        }
        if (req.query.scanUsersDuplicates) {
            const snap = await db.collection('users').get();
            const phoneMap: { [phone: string]: any[] } = {};
            for (const doc of snap.docs) {
                const u = doc.data();
                const rawPhone = String(u.phone || u.phoneNumber || "").trim();
                const clean10 = rawPhone.replace(/\D/g, '').slice(-10);
                if (clean10.length === 10) {
                    if (!phoneMap[clean10]) phoneMap[clean10] = [];
                    phoneMap[clean10].push({ id: doc.id, phone: rawPhone, name: u.name, role: u.role, createdAt: u.createdAt || u.joinedAt || null });
                }
            }
            const duplicates = Object.keys(phoneMap).filter(k => phoneMap[k].length > 1).map(k => ({ phone: k, count: phoneMap[k].length, accounts: phoneMap[k] }));
            res.status(200).json({ totalUsers: snap.size, duplicateGroupsCount: duplicates.length, duplicates });
            return;
        }
        if (req.query.july25Cleanup) {
            const dryRun = req.query.dryRun === "true";
            const result = await executeJuly25ApprovalAndCleanup(dryRun);
            res.status(200).json({ mode: dryRun ? "DRY_RUN" : "LIVE_APPLIED", ...result });
            return;
        }
        if (req.query.inspect) {
            if (req.query.phone) {
                const clean10 = String(req.query.phone).replace(/\D/g, '').slice(-10);
                const phoneFormats = [`+91${clean10}`, clean10, `0${clean10}`, `91${clean10}`];
                const usersFound: any[] = [];
                for (const fmt of phoneFormats) {
                    const snap = await db.collection('users').where('phone', '==', fmt).get();
                    snap.docs.forEach(d => usersFound.push({ id: d.id, ...d.data() }));
                }
                res.status(200).json({ count: usersFound.length, users: usersFound });
                return;
            }
            if (req.query.docId) {
                const docSnap = await db.collection('reporter_applications').doc(String(req.query.docId)).get();
                res.status(200).json({ id: docSnap.id, ...docSnap.data() });
                return;
            }
            if (req.query.checkVacancy) {
                const dist = String(req.query.dist || "");
                const mandal = String(req.query.mandal || "");
                const snap = await db.collection('users')
                    .where('role', 'in', ['REPORTER', 2, 2.0, '2'])
                    .where('district', '==', dist)
                    .where('assignedMandal', '==', mandal)
                    .get();
                const reporters = snap.docs.map(d => ({ id: d.id, name: d.data().name, phone: d.data().phone, mandal: d.data().assignedMandal }));
                res.status(200).json({ district: dist, mandal: mandal, count: reporters.length, reporters });
                return;
            }
            const snap = await db.collection('reporter_applications')
                .orderBy('timestamp', 'desc')
                .limit(20)
                .get();
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            res.status(200).json({ count: docs.length, docs });
            return;
        }
        const result = await executeAutoApprovePendingBackfill();
        res.status(200).json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

async function executeAutoApprovePendingBackfill() {
    console.log("[AUTO_APPROVE_ALL] 🚀 Starting scan of all applications in reporter_applications...");
    const allAppsSnap = await db.collection('reporter_applications').get();

    let totalPending = 0;
    let approvedCount = 0;
    let skippedCount = 0;
    const approvedList: any[] = [];
    const skippedList: any[] = [];

    for (const doc of allAppsSnap.docs) {
        const data = doc.data();
        const rawStatus = String(data.status || "").trim().toUpperCase();
        
        // Skip already finalized applications
        if (rawStatus === "JOINED" || rawStatus === "APPROVED" || rawStatus === "REJECTED") {
            continue;
        }

        totalPending++;
        const applicantName = data.fullName || data.name || "No Name";
        const rawPhone = String(data.phone || data.phoneNumber || data.mobile || "").trim();
        const clean10 = rawPhone.replace(/\D/g, '').slice(-10);

        let district = String(data.district || data.selectedDistrict || data.assignedDistrict || data.state_district || data.stateDistrict || "").trim();
        let mandal = String(data.mandal || data.selectedMandal || data.assignedMandal || data.mandalam || "").trim();
        let userId = String(data.userId || data.uid || data.user_id || "").trim();

        // 1. If userId is missing, search users collection by phone number
        let userDocData: any = null;
        if (!userId && clean10.length === 10) {
            const phoneFormats = [`+91${clean10}`, clean10, `0${clean10}`, `91${clean10}`];
            for (const fmt of phoneFormats) {
                const uQuery = await db.collection('users').where('phone', '==', fmt).limit(1).get();
                if (!uQuery.empty) {
                    const uDoc = uQuery.docs[0];
                    userId = uDoc.id;
                    userDocData = uDoc.data();
                    break;
                }
            }
        }

        // If we have userId, fetch user profile if not already fetched
        if (userId && !userDocData) {
            const uDoc = await db.collection('users').doc(userId).get();
            if (uDoc.exists) {
                userDocData = uDoc.data();
            }
        }

        // 2. If district or mandal is missing in application, try resolving from user document
        if ((!district || !mandal) && userDocData) {
            if (!district) district = String(userDocData.district || "").trim();
            if (!mandal) mandal = String(userDocData.assignedMandal || userDocData.mandal || "").trim();
        }

        // 3. Smart extraction from address/interestedArea/profile if still missing
        if (!district || !mandal) {
            const extracted = extractDistrictAndMandal(data.address, data.interestedArea, userDocData?.district || district, userDocData?.address);
            if (!district) district = extracted.district;
            if (!mandal) mandal = extracted.mandal;
        }

        // If still missing district/mandal or userId, log reason
        if (!district || !mandal) {
            skippedCount++;
            skippedList.push({ 
                id: doc.id, 
                name: applicantName, 
                phone: rawPhone,
                reason: `Missing district/mandal (Found: district='${district}', mandal='${mandal}')` 
            });
            continue;
        }

        if (!userId) {
            skippedCount++;
            skippedList.push({ 
                id: doc.id, 
                name: applicantName, 
                phone: rawPhone,
                district, 
                mandal, 
                reason: "No matching user account found in users collection" 
            });
            continue;
        }

        // 3. Check if user was previously downgraded or suspended
        if (
            userDocData?.previouslyDowngraded === true || 
            userDocData?.suspended === true || 
            userDocData?.downgradedReason === "INACTIVITY" ||
            data.previouslyDowngraded === true ||
            data.isReapplication === true
        ) {
            skippedCount++;
            skippedList.push({ 
                id: doc.id, 
                name: applicantName, 
                phone: rawPhone,
                district, 
                mandal, 
                reason: "Applicant was previously downgraded/suspended (manual admin review required)" 
            });
            continue;
        }

        // 4. Check if mandal is vacant in users collection
        const vacant = await isMandalVacant(district, mandal, userId);
        if (!vacant) {
            skippedCount++;
            skippedList.push({ 
                id: doc.id, 
                name: applicantName, 
                phone: rawPhone,
                district, 
                mandal, 
                reason: `Mandal (${district} - ${mandal}) is already occupied by an active reporter` 
            });
            continue;
        }

        // 5. Auto approve!
        await doc.ref.update({
            status: "JOINED",
            autoApproved: true,
            district,
            mandal,
            userId,
            approvedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await promoteUserToReporter(
            userId,
            applicantName,
            rawPhone || userDocData?.phone || "",
            district,
            mandal,
            "AUTO_APPROVE_BACKFILL"
        );

        // Send notification email to admin
        await sendReporterApplicationEmail(
            { ...data, district, mandal, fullName: applicantName, phone: rawPhone, userId },
            true,
            false,
            "JOINED"
        );

        approvedCount++;
        approvedList.push({ id: doc.id, name: applicantName, phone: rawPhone, district, mandal, userId });
    }

    console.log(`[AUTO_APPROVE_ALL] 🏁 Finished: ${approvedCount} approved, ${skippedCount} skipped out of ${totalPending} pending applications.`);
    return {
        success: true,
        totalApplicationsInDb: allAppsSnap.size,
        totalPending,
        approvedCount,
        skippedCount,
        approvedList,
        skippedList
    };
}

async function executeJuly25ApprovalAndCleanup(dryRun: boolean = false) {
    console.log(`[JULY25_CLEANUP] 🚀 Starting July 25+ approval and cleanup (dryRun: ${dryRun})...`);
    const allAppsSnap = await db.collection('reporter_applications').get();

    const JULY_25_MS = new Date('2026-07-25T00:00:00+05:30').getTime(); // 1784917800000

    // Filter applications submitted on or after July 25, 2026
    const eligibleDocs: { id: string; data: any; timeMs: number; cleanPhone: string; key: string }[] = [];

    for (const doc of allAppsSnap.docs) {
        const data = doc.data();
        const ts = data.timestamp;
        let timeMs = 0;
        if (ts && typeof ts.toDate === 'function') {
            timeMs = ts.toDate().getTime();
        } else if (typeof ts === 'number') {
            timeMs = ts > 1e11 ? ts : ts * 1000;
        } else if (ts && typeof ts._seconds === 'number') {
            timeMs = ts._seconds * 1000;
        }

        if (timeMs >= JULY_25_MS) {
            const rawPhone = String(data.phone || data.phoneNumber || data.mobile || "").trim();
            const clean10 = rawPhone.replace(/\D/g, '').slice(-10);
            const userId = String(data.userId || data.uid || "").trim();
            const fullName = String(data.fullName || data.name || "").trim().toLowerCase();
            const groupKey = clean10.length === 10 ? clean10 : (userId || fullName || doc.id);

            eligibleDocs.push({
                id: doc.id,
                data: data,
                timeMs: timeMs,
                cleanPhone: clean10,
                key: groupKey
            });
        }
    }

    console.log(`[JULY25_CLEANUP] Found ${eligibleDocs.length} total applications submitted on or after July 25, 2026.`);

    // Group by unique applicant key
    const groups: { [key: string]: typeof eligibleDocs } = {};
    for (const item of eligibleDocs) {
        if (!groups[item.key]) groups[item.key] = [];
        groups[item.key].push(item);
    }

    const report: {
        uniqueApplicants: number;
        totalApplications: number;
        approved: any[];
        deletedDuplicates: any[];
    } = {
        uniqueApplicants: Object.keys(groups).length,
        totalApplications: eligibleDocs.length,
        approved: [],
        deletedDuplicates: []
    };

    for (const key of Object.keys(groups)) {
        const list = groups[key];
        // Sort newest first
        list.sort((a, b) => b.timeMs - a.timeMs);

        const canonical = list[0];
        const duplicates = list.slice(1);

        const appData = canonical.data;
        const applicantName = appData.fullName || appData.name || "Reporter";
        const rawPhone = String(appData.phone || appData.phoneNumber || appData.mobile || "").trim();
        const clean10 = canonical.cleanPhone;
        let userId = String(appData.userId || appData.uid || "").trim();

        // 1. Find all matching user records by phone and userId
        const matchingUsers: any[] = [];
        if (clean10.length === 10) {
            const phoneFormats = [`+91${clean10}`, clean10, `0${clean10}`, `91${clean10}`];
            for (const fmt of phoneFormats) {
                const uSnap = await db.collection('users').where('phone', '==', fmt).get();
                uSnap.docs.forEach(d => {
                    if (!matchingUsers.some(u => u.id === d.id)) {
                        matchingUsers.push({ id: d.id, ...d.data() });
                    }
                });
            }
        }
        if (userId && !matchingUsers.some(u => u.id === userId)) {
            const uDoc = await db.collection('users').doc(userId).get();
            if (uDoc.exists) matchingUsers.push({ id: uDoc.id, ...uDoc.data() });
        }

        // 2. Resolve District and Mandal
        let district = String(appData.district || appData.selectedDistrict || appData.assignedDistrict || "").trim();
        let mandal = String(appData.mandal || appData.selectedMandal || appData.assignedMandal || appData.mandalam || "").trim();

        if ((!district || !mandal) && matchingUsers.length > 0) {
            const firstU = matchingUsers[0];
            if (!district) district = String(firstU.district || "").trim();
            if (!mandal) mandal = String(firstU.assignedMandal || firstU.mandal || "").trim();
        }

        if (!district || !mandal) {
            const userDist = matchingUsers[0]?.district;
            const userAddr = matchingUsers[0]?.address;
            const extracted = extractDistrictAndMandal(appData.address, appData.interestedArea, userDist || district, userAddr);
            if (!district) district = extracted.district;
            if (!mandal) mandal = extracted.mandal;
        }

        if (!district) district = "తెలంగాణ / ఆంధ్రప్రదేశ్";
        if (!mandal) mandal = "జిల్లా విలేకరి";

        const targetUserId = userId || (matchingUsers.length > 0 ? matchingUsers[0].id : null);

        if (!dryRun) {
            // Update all matching user records to role: REPORTER
            for (const u of matchingUsers) {
                await db.collection('users').doc(u.id).set({
                    role: "REPORTER",
                    district: district,
                    assignedMandal: mandal,
                    mandal: mandal,
                    promotedBy: "ADMIN_BULK_APPROVE_JULY25",
                    agreedToRules: true,
                    suspended: false,
                    warningLevel: 0,
                    promotedAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastPostTimestamp: admin.firestore.FieldValue.serverTimestamp(),
                    name: applicantName || u.name || "Reporter",
                    phone: rawPhone || u.phone || ""
                }, { merge: true });
            }

            // Update canonical application to JOINED
            await db.collection('reporter_applications').doc(canonical.id).update({
                status: "JOINED",
                autoApproved: true,
                district: district,
                mandal: mandal,
                userId: targetUserId,
                approvedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Delete older duplicate applications
            for (const dup of duplicates) {
                await db.collection('reporter_applications').doc(dup.id).delete();
            }
        }

        report.approved.push({
            id: canonical.id,
            name: applicantName,
            phone: rawPhone,
            district: district,
            mandal: mandal,
            userId: targetUserId,
            matchedUsersCount: matchingUsers.length
        });

        if (duplicates.length > 0) {
            report.deletedDuplicates.push({
                canonicalId: canonical.id,
                name: applicantName,
                phone: rawPhone,
                deletedCount: duplicates.length,
                deletedIds: duplicates.map(d => d.id)
            });
        }
    }

    console.log(`[JULY25_CLEANUP] 🏁 Finished July 25+ cleanup: Approved ${report.approved.length} unique reporters, Deleted ${report.deletedDuplicates.reduce((acc, d) => acc + d.deletedCount, 0)} duplicate applications.`);
    return report;
}

/**
 * Update reporter's last post timestamp when a post is approved
 */
export const onNewsPostApproved = onDocumentWritten({
    document: "news/{postId}",
    region: REGION,
}, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    // Trigger only if status changes to published or approved becomes true
    if (after && after.approved === true && before?.approved !== true) {
        const assignedReporterId = (typeof after.reporter === 'string' ? after.reporter : after.reporter?.id) || after.reporterId;
        const originalReporterId = after.originalReporterId;

        const reporterIdsToUpdate = new Set<string>();
        if (assignedReporterId && !assignedReporterId.startsWith('BOT_') && !assignedReporterId.startsWith('SYSTEM_')) {
            reporterIdsToUpdate.add(assignedReporterId);
        }
        if (originalReporterId && !originalReporterId.startsWith('BOT_') && !originalReporterId.startsWith('SYSTEM_')) {
            reporterIdsToUpdate.add(originalReporterId);
        }

        for (const rId of reporterIdsToUpdate) {
            console.log(`[POST_APPROVED] Updating lastPostTimestamp for reporter: ${rId}`);
            await db.collection('users').doc(rId).set({
                lastPostTimestamp: after.timestamp || admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
    }
});

/**
 * Automatically reset warning levels and set promotion timestamps when a user is assigned/upgraded/re-joined to REPORTER
 */
export const onUserRoleChanged = onDocumentWritten({
    document: "users/{userId}",
    region: REGION,
}, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!after) return;

    const beforeRole = String(before?.role || '').toUpperCase();
    const afterRole = String(after.role || '').toUpperCase();

    const isBeforeReporter = ['REPORTER', '2', '2.0', 'STAFF_REPORTER', 'REGIONAL_INCHARGE'].includes(beforeRole) || before?.role === 2 || before?.role === 2.0;
    const isAfterReporter = ['REPORTER', '2', '2.0'].includes(afterRole) || after.role === 2 || after.role === 2.0;

    // Check if user was newly promoted / upgraded / re-joined to REPORTER
    if (!isBeforeReporter && isAfterReporter) {
        console.log(`[ROLE_UPGRADED] User ${event.params.userId} upgraded to REPORTER. Setting full grace period timestamps and resetting flags...`);
        
        await event.data?.after.ref.update({
            warningLevel: 0,
            inProbation: false,
            lastWarningDate: admin.firestore.FieldValue.delete(),
            previouslyDowngraded: false,
            suspended: false,
            downgradedReason: admin.firestore.FieldValue.delete(),
            downgradedAt: admin.firestore.FieldValue.delete(),
            promotedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastPostTimestamp: admin.firestore.FieldValue.serverTimestamp(),
            rejoinedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Also sync any SUSPENDED applications back to JOINED
        try {
            const appSnap = await db.collection('reporter_applications')
                .where('userId', '==', event.params.userId)
                .where('status', '==', 'SUSPENDED')
                .get();
            for (const doc of appSnap.docs) {
                await doc.ref.update({
                    status: 'JOINED',
                    rejoinedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        } catch (err: any) {
            console.error(`[ROLE_UPGRADE_APP_SYNC_ERR] ${event.params.userId}:`, err.message);
        }
    }
});

/**
 * Mass re-activation of all reporters who were mistakenly demoted to subscribers.
 * Restores role: "REPORTER", sets 10-day fresh grace period, resets warning levels,
 * updates application records, and sends Telugu notification message + FCM push.
 */
export async function executeReactivateFalselyDemotedReporters(dryRun: boolean = false) {
    console.log(`[REACTIVATE_REPORTERS] 🚀 Starting scan of falsely demoted reporters (dryRun: ${dryRun})...`);

    const usersSnap = await db.collection('users').get();
    const appsSnap = await db.collection('reporter_applications').get();

    // Map applications by clean phone and by userId
    const appsByUser: { [userId: string]: any[] } = {};
    const appsByPhone: { [phone: string]: any[] } = {};

    for (const doc of appsSnap.docs) {
        const data = { id: doc.id, ...doc.data() } as any;
        const uId = String(data.userId || data.uid || "").trim();
        if (uId) {
            if (!appsByUser[uId]) appsByUser[uId] = [];
            appsByUser[uId].push(data);
        }
        const rawPhone = String(data.phone || data.phoneNumber || data.mobile || "").trim();
        const clean10 = rawPhone.replace(/\D/g, '').slice(-10);
        if (clean10.length === 10) {
            if (!appsByPhone[clean10]) appsByPhone[clean10] = [];
            appsByPhone[clean10].push(data);
        }
    }

    const reactivatedList: any[] = [];
    const seniorRoles = ['ADMIN', 'EDITOR', 'REGIONAL_INCHARGE', 'STAFF_REPORTER', '5', '7', 5, 7];

    for (const doc of usersSnap.docs) {
        const u = doc.data();
        const userId = doc.id;
        const currentRole = String(u.role || '').toUpperCase();

        // Skip senior roles (Admin, Editor, Staff Reporter, etc.)
        if (seniorRoles.includes(currentRole) || seniorRoles.includes(u.role)) {
            continue;
        }

        // Check if user is currently active as reporter
        const isActiveReporter = ['REPORTER', '2', '2.0'].includes(currentRole) || u.role === 2 || u.role === 2.0;

        // Check if user has demoted / suspended / inactive marker
        const isMarkedDemoted = u.previouslyDowngraded === true || 
            u.downgradedReason === "INACTIVITY" || 
            u.suspended === true || 
            u.downgradedAt != null;

        // Check matching applications
        const clean10 = String(u.phone || '').replace(/\D/g, '').slice(-10);
        const userApps = appsByUser[userId] || (clean10.length === 10 ? appsByPhone[clean10] : []) || [];
        const hasJoinedOrSuspendedApp = userApps.some((a: any) => 
            a.status === 'JOINED' || a.status === 'SUSPENDED' || a.autoApproved === true
        );

        const shouldReactivate = (!isActiveReporter && (isMarkedDemoted || hasJoinedOrSuspendedApp)) || 
            (isActiveReporter && isMarkedDemoted);

        if (!shouldReactivate) {
            continue;
        }

        // Resolve District and Mandal
        let district = String(u.district || "").trim();
        let mandal = String(u.assignedMandal || u.mandal || "").trim();

        if ((!district || !mandal) && userApps.length > 0) {
            const firstApp = userApps[0];
            if (!district) district = String(firstApp.district || firstApp.selectedDistrict || "").trim();
            if (!mandal) mandal = String(firstApp.mandal || firstApp.assignedMandal || firstApp.selectedMandal || "").trim();
        }

        if (!district || !mandal) {
            const extracted = extractDistrictAndMandal(u.address, "", district, u.address);
            if (!district) district = extracted.district || "తెలంగాణ / ఆంధ్రప్రదేశ్";
            if (!mandal) mandal = extracted.mandal || "జిల్లా విలేకరి";
        }

        const name = u.name || userApps[0]?.fullName || userApps[0]?.name || "విలేకరి";
        const phone = u.phone || userApps[0]?.phone || "";

        if (!dryRun) {
            // 1. Update user document to active REPORTER with fresh grace period
            await db.collection('users').doc(userId).set({
                role: "REPORTER",
                district: district,
                assignedMandal: mandal,
                mandal: mandal,
                warningLevel: 0,
                inProbation: false,
                previouslyDowngraded: false,
                suspended: false,
                downgradedReason: admin.firestore.FieldValue.delete(),
                downgradedAt: admin.firestore.FieldValue.delete(),
                lastWarningDate: admin.firestore.FieldValue.delete(),
                promotedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastPostTimestamp: admin.firestore.FieldValue.serverTimestamp(),
                rejoinedAt: admin.firestore.FieldValue.serverTimestamp(),
                promotedBy: u.promotedBy || "SYSTEM_RESTORE"
            }, { merge: true });

            // 2. Update matching reporter_applications
            for (const app of userApps) {
                await db.collection('reporter_applications').doc(app.id).update({
                    status: "JOINED",
                    rejoinedAt: admin.firestore.FieldValue.serverTimestamp(),
                    district: district,
                    mandal: mandal,
                    userId: userId
                });
            }

            // 3. Send Encouraging Telugu Restoration Message & Push Notification
            const title = "అల్ఫా న్యూస్ రిపోర్టర్ హోదా తిరిగి ప్రారంభించబడింది! 🌟";
            const body = `నమస్కారం ${name}! సాంకేతిక కారణాల వల్ల నిలిచిపోయిన మీ రిపోర్టర్ హోదా తిరిగి విజయవంతంగా ప్రారంభించబడింది. శుభాకాంక్షలు! నేటి నుంచే మీ మండల తాజా వార్తలను ఉత్సాహంగా Alfa News లో పోస్ట్ చేయండి.`;
            
            const msgTimestamp = admin.firestore.FieldValue.serverTimestamp();
            
            // Inbox message
            await db.collection('users').doc(userId).collection('messages').add({
                title,
                body,
                senderName: "AlfaNews Editorial Desk",
                read: false,
                timestamp: msgTimestamp,
                importance: "HIGH",
                type: "RESTORATION"
            });

            // Reporter conversation thread
            try {
                await db.collection('reporter_conversations').doc(userId).collection('messages').add({
                    senderId: "SYSTEM_ADMIN",
                    senderName: "AlfaNews Editorial Desk",
                    senderRole: "ADMIN",
                    text: `🎉 [${title}]\n\n${body}`,
                    type: "NOTICE",
                    read: false,
                    timestamp: msgTimestamp
                });

                await db.collection('reporter_conversations').doc(userId).set({
                    reporterId: userId,
                    reporterName: name,
                    reporterPhone: phone,
                    reporterDistrict: district,
                    reporterMandal: mandal,
                    lastMessage: `🎉 ${title}`,
                    lastMessageTime: msgTimestamp,
                    lastSenderRole: "ADMIN",
                    lastSenderId: "SYSTEM_ADMIN",
                    unreadCountForReporter: admin.firestore.FieldValue.increment(1),
                    updatedAt: msgTimestamp
                }, { merge: true });
            } catch (convErr: any) {
                console.error(`[CONV_ERR] ${userId}:`, convErr.message);
            }

            // High priority FCM push
            const rawTokens: any[] = [...(u.fcmTokens || []), u.fcmToken];
            const tokens = Array.from(new Set(rawTokens.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)));

            if (tokens.length > 0) {
                const pushList = tokens.map(token => ({
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
                        type: "REPORTER_RESTORED",
                        title,
                        body,
                        channelId: 'general_news'
                    }
                }));
                await admin.messaging().sendEach(pushList).catch(() => {});
            }
        }

        reactivatedList.push({
            id: userId,
            name,
            phone,
            district,
            mandal,
            previousRole: currentRole || 'SUBSCRIBER',
            reason: isMarkedDemoted ? "Previously Downgraded/Suspended" : "Joined Application Found"
        });
    }

    console.log(`[REACTIVATE_REPORTERS] 🏁 Completed. Reactivated ${reactivatedList.length} reporters.`);
    return {
        success: true,
        mode: dryRun ? "DRY_RUN" : "LIVE_APPLIED",
        totalUsersScanned: usersSnap.size,
        reactivatedCount: reactivatedList.length,
        reactivated: reactivatedList
    };
}

/**
 * Callable function to reactivate all demoted reporters on demand (Admin Only).
 */
export const reactivateFalselyDemotedReporters = onCall(async (request) => {
    const auth = request.auth;
    if (!auth || !auth.uid) {
        throw new HttpsError('unauthenticated', 'మీరు లాగిన్ అవ్వాలి.');
    }
    const adminDoc = await db.collection('users').doc(auth.uid).get();
    const role = String(adminDoc.data()?.role || '').toUpperCase();
    if (!['ADMIN', 'EDITOR', '5', '5.0', '7', '7.0'].includes(role)) {
        throw new HttpsError('permission-denied', 'అడ్మిన్లకు మాత్రమే ఈ అనుమతి ఉంది.');
    }
    return await executeReactivateFalselyDemotedReporters(false);
});

/**
 * HTTP endpoint to trigger reactivation and view detailed report (Admin Token Required).
 */
export const runReactivateDemotedReportersHttp = onRequest({ region: REGION }, async (req, res) => {
    if (!(await verifyHttpAdminAuth(req))) {
        res.status(403).json({ error: "Forbidden: Admin Bearer token required" });
        return;
    }
    try {
        const dryRun = req.query.dryRun === "true";
        const result = await executeReactivateFalselyDemotedReporters(dryRun);
        res.status(200).json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 6.2 Verify Reporter (Web Page)
 */
export const verifyReporter = onRequest(async (req, res) => {
    // Extract reporterId from the path: /verify/{reporterId}
    // Hosting rewrite will point /verify/** to this function
    const pathParts = req.path.split('/');
    const reporterId = pathParts[pathParts.length - 1];

    if (!reporterId || reporterId === 'verify' || reporterId === '') {
        res.status(404).send("<h1>Invalid Reporter ID</h1>");
        return;
    }

    try {
        const userDoc = await db.collection('users').doc(reporterId).get();

        if (!userDoc.exists) {
            res.status(404).send(`
                <html>
                    <head>
                        <title>Reporter Not Found - Alfa News</title>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <style>
                            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 50px; background: #f4f4f4; }
                            .container { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); display: inline-block; }
                            h1 { color: #e74c3c; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>Reporter Not Found ❌</h1>
                            <p>The ID you are verifying is not registered in our system.</p>
                            <a href="https://play.google.com/store/apps/details?id=com.alfanews.telugu">Download Alfa News App</a>
                        </div>
                    </body>
                </html>
            `);
            return;
        }

        const user = userDoc.data();
        const isVerified = user?.role === 'REPORTER' || user?.role === 'ADMIN';
        const statusColor = isVerified ? '#2ecc71' : '#e74c3c';
        const statusText = isVerified ? 'VERIFIED REPORTER ✅' : 'NOT A REPORTER ❌';

        const html = `
            <!DOCTYPE html>
            <html lang="te">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Reporter Verification - Alfa News</title>
                <style>
                    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f0f2f5; margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                    .card { background: white; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); width: 95%; max-width: 400px; overflow: hidden; text-align: center; border-top: 8px solid #ff0000; margin: 20px; }
                    .header { padding: 20px; background: #fff; }
                    .logo { font-size: 32px; font-weight: bold; margin-bottom: 5px; color: #000; }
                    .logo span { color: #ff0000; }
                    .photo-container { margin: 10px auto; width: 160px; height: 200px; border: 4px solid #eee; border-radius: 8px; overflow: hidden; background: #fafafa; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
                    .photo { width: 100%; height: 100%; object-fit: cover; }
                    .info { padding: 0 25px 25px; }
                    .name { font-size: 24px; font-weight: bold; color: #333; margin: 15px 0 5px; }
                    .role { font-size: 16px; font-weight: bold; color: #ff0000; text-transform: uppercase; margin-bottom: 15px; letter-spacing: 1px; }
                    .details { text-align: left; margin: 20px 0; border-top: 1px solid #eee; padding-top: 15px; }
                    .detail-item { margin-bottom: 12px; font-size: 15px; color: #555; display: flex; }
                    .detail-label { font-weight: bold; color: #333; width: 90px; flex-shrink: 0; }
                    .status { display: inline-block; padding: 12px 25px; border-radius: 30px; background: ${statusColor}; color: white; font-weight: bold; margin-top: 5px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-size: 16px; }
                    .footer { padding: 15px; background: #f9f9f9; font-size: 12px; color: #999; border-top: 1px solid #eee; }
                    @media (max-width: 480px) {
                        .card { margin: 10px; }
                        .info { padding: 0 15px 20px; }
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="header">
                        <div class="logo">alfa<span>news</span></div>
                        <div style="font-size: 11px; color: #666; font-weight: bold; letter-spacing: 2px; margin-top: 5px;">OFFICIAL REPORTER VERIFICATION</div>
                    </div>

                    <div class="photo-container">
                        <img src="${user?.photoUrl || 'https://via.placeholder.com/160x200?text=No+Photo'}" alt="${user?.name}" class="photo">
                    </div>

                    <div class="info">
                        <div class="name">${user?.name}</div>
                        <div class="role">${user?.role?.replace('_', ' ')}</div>

                        <div class="status">${statusText}</div>

                        <div class="details">
                            <div class="detail-item"><span class="detail-label">ID No:</span> <span>${reporterId.slice(-8).toUpperCase()}</span></div>
                            <div class="detail-item"><span class="detail-label">District:</span> <span>${user?.district || 'N/A'}</span></div>
                            <div class="detail-item"><span class="detail-label">Mandal:</span> <span>${user?.assignedMandal || user?.mandal || 'N/A'}</span></div>
                            <div class="detail-item"><span class="detail-label">Valid Upto:</span> <span>31-12-2027</span></div>
                        </div>
                    </div>

                    <div class="footer">
                        © 2026 Alfa News Media Group. This is a digitally verified identity. <br>
                        Verification Date: ${new Date().toLocaleDateString('te-IN')}
                    </div>
                </div>
            </body>
            </html>
        `;

        res.status(200).send(html);
    } catch (error: any) {
        console.error("Verification error:", error);
        res.status(500).send("<h1>Internal Server Error</h1>");
    }
});

/**
 * Helper: Find assigned reporter for a specific Mandalam in a District
 */
export async function getAssignedReporter(district: string, mandalam: string): Promise<{ id: string, name: string } | null> {
    try {
        if (!district || !mandalam) return null;

        // 1. Direct query with role variations
        const reporters = await db.collection('users')
            .where('role', 'in', ['REPORTER', 'reporter', 'STAFF_REPORTER', 'REGIONAL_INCHARGE', 2, 2.0, '2', 3, 3.0])
            .where('district', '==', district)
            .where('assignedMandal', '==', mandalam)
            .limit(1)
            .get();

        if (!reporters.empty) {
            const data = reporters.docs[0].data();
            return {
                id: reporters.docs[0].id,
                name: data.name || "Reporter"
            };
        }

        // 2. Flexible alias match across district reporters
        const distReporters = await db.collection('users')
            .where('role', 'in', ['REPORTER', 'reporter', 'STAFF_REPORTER', 'REGIONAL_INCHARGE', 2, 2.0, '2', 3, 3.0])
            .where('district', '==', district)
            .get();

        for (const doc of distReporters.docs) {
            const data = doc.data();
            const repMandal = (data.assignedMandal || data.mandal || data.mandalam || "").trim();
            if (repMandal && areMandalsMatching(mandalam, repMandal, district)) {
                return {
                    id: doc.id,
                    name: data.name || "Reporter"
                };
            }
        }

        return null;
    } catch (e) {
        console.error(`[GET_ASSIGNED_REPORTER_ERR] ${district}/${mandalam}:`, e);
        return null;
    }
}

/**
 * Cloud Function to process new user referrals.
 * Award 50 points to the referrer when a new user document is created.
 * ✅ ADDED: Welcome notification to the new user immediately on download.
 */
export const onUserCreated = onDocumentCreated({
    document: "users/{userId}",
    region: REGION
}, async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const referredBy = data.referredBy;
    const userId = event.params.userId;

    // ==========================================
    // WELCOME NOTIFICATION — App download చేసిన వెంటనే
    // ==========================================
    try {
        // Token save అవ్వడానికి 5 సెకండ్లు వేచ్చు కొందాం (జాగ్రత్తగా)
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Fresh token read చేస్తాం (ప్రారంభంలో token రాకపోవచ్చు)
        const freshDoc = await db.collection('users').doc(userId).get();
        const freshData = freshDoc.data();

        const tokens: string[] = [];
        if (freshData?.fcmToken) tokens.push(freshData.fcmToken);
        if (Array.isArray(freshData?.fcmTokens)) {
            freshData.fcmTokens.forEach((t: any) => {
                if (t && typeof t === 'string' && !tokens.includes(t)) tokens.push(t);
            });
        }

        if (tokens.length > 0) {
            // Random welcome message select చేస్తాం
            const welcome = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
            const userName = freshData?.name || freshData?.displayName;
            const title = userName
                ? `నమస్కారం ${userName.split(' ')[0]}! Alfa News లో స్వాగతం 🌟`
                : welcome.title;

            const welcomeMessage: admin.messaging.Message = {
                android: {
                    priority: 'high',
                    ttl: 86400000, // 24 hours — welcome ఒక్కరోజు valid
                    directBootOk: true,
                },
                data: {
                    type: 'WELCOME',
                    channelId: 'general_news',
                    title: title,
                    body: welcome.body,
                    click_action: 'OPEN_HOME',
                    actionUrl: '',
                    newsId: '',
                    imageUrl: '',
                },
                token: tokens[0]  // మొదటి token కి పంపిస్తాం
            };

            await admin.messaging().send(welcomeMessage).catch(err => {
                console.error(`[WELCOME_NOTIFY] Failed to send to ${userId}:`, err.message);
            });
            console.log(`[WELCOME_NOTIFY] ✅ Sent welcome notification to new user: ${userId}`);
        } else {
            console.log(`[WELCOME_NOTIFY] No token yet for user ${userId} — skipping welcome.`);
        }
    } catch (err: any) {
        console.error(`[WELCOME_NOTIFY_ERR] ${userId}:`, err.message);
    }

    // ==========================================
    // REFERRAL HANDLING (existing logic)
    // ==========================================
    if (referredBy && referredBy !== userId) {
        console.log(`[REFERRAL] User ${userId} was referred by ${referredBy}. Awarding 50 points.`);

        await awardPointsToReporter(referredBy, 50);

        const referrerRef = db.collection('users').doc(referredBy);
        try {
            await db.runTransaction(async (transaction) => {
                const referrerDoc = await transaction.get(referrerRef);
                if (referrerDoc.exists) {
                    const currentCount = referrerDoc.data()?.referralCount || 0;
                    transaction.update(referrerRef, {
                        referralCount: currentCount + 1
                    });
                }
            });
            console.log(`[REFERRAL] Successfully incremented referralCount for ${referredBy}`);
        } catch (e: any) {
            console.error(`[REFERRAL_ERR] Error incrementing referralCount for ${referredBy}:`, e.message);
        }

        // ✅ FIX: Data-only message (yesterday's delivery fix consistent)
        try {
            const referrerDoc = await referrerRef.get();
            if (referrerDoc.exists) {
                const referrerData = referrerDoc.data();
                const tokens: string[] = [];
                if (referrerData?.fcmToken) tokens.push(referrerData.fcmToken);
                if (Array.isArray(referrerData?.fcmTokens)) {
                    referrerData.fcmTokens.forEach((t: any) => {
                        if (t && typeof t === 'string' && !tokens.includes(t)) tokens.push(t);
                    });
                }

                if (tokens.length > 0) {
                    const title = 'పాయింట్లు లభించాయి! 🎁';
                    const body = 'మీ రిఫరల్ లింక్ ద్వారా ఒకరు యాప్‌ను డౌన్‌లోడ్ చేసుకున్నందుకు మీకు 50 పాయింట్లు లభించాయి.';

                    await Promise.all(tokens.map(token =>
                        admin.messaging().send({
                            android: {
                                priority: 'high',
                                ttl: 86400000,
                                directBootOk: true,
                            },
                            data: {
                                type: 'REFERRAL_SUCCESS',
                                channelId: 'general_news',
                                title,
                                body,
                                actionUrl: '',
                                newsId: '',
                                imageUrl: '',
                            },
                            token
                        }).catch(() => {})
                    ));
                    console.log(`[REFERRAL] Sent data-only notification to ${referredBy}`);
                }
            }
        } catch (err: any) {
            console.error(`[REFERRAL_NOTIFY_ERR] Error sending notification:`, err.message);
        }
    }
});

/**
 * ✅ NEW: Welcome notification for anonymous (guest) users.
 * App install చేసి Sign-up చేయకుండా వున్న users కోసం.
 * anonymous_devices collection లో కొత్త document సేవ్ అయినప్పుడు trigger అవుతుంది.
 */
export const onAnonymousDeviceCreated = onDocumentCreated({
    document: "anonymous_devices/{deviceId}",
    region: REGION
}, async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const token = data.fcmToken;
    if (!token || typeof token !== 'string') {
        console.log(`[WELCOME_ANON] No token in anonymous_devices/${event.params.deviceId}`);
        return;
    }

    try {
        // Random welcome message
        const welcome = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];

        const welcomeMessage: admin.messaging.Message = {
            android: {
                priority: 'high',
                ttl: 86400000, // 24 hours
                directBootOk: true,
            },
            data: {
                type: 'WELCOME',
                channelId: 'general_news',
                title: welcome.title,
                body: welcome.body,
                click_action: 'OPEN_HOME',
                actionUrl: '',
                newsId: '',
                imageUrl: '',
            },
            token
        };

        await admin.messaging().send(welcomeMessage);
        console.log(`[WELCOME_ANON] ✅ Sent welcome to anonymous device: ${event.params.deviceId}`);
    } catch (err: any) {
        if (err.code === 'messaging/registration-token-not-registered' ||
            err.code === 'messaging/invalid-registration-token') {
            // Invalid token — delete the document
            await event.data?.ref.delete().catch(() => {});
            console.log(`[WELCOME_ANON] Deleted invalid anonymous device: ${event.params.deviceId}`);
        } else {
            console.error(`[WELCOME_ANON_ERR]:`, err.message);
        }
    }
});

/**
 * ✅ NEW: Record App Install Referral immediately when app is opened after install.
 * Works for BOTH guest (anonymous) users and logged-in users.
 * Anti-fraud: Ensures each installId only rewards points once.
 */
export const recordAppInstallReferral = onCall(async (request) => {
    const { referrerUid, installId, platform, appVersion } = request.data || {};
    
    if (!referrerUid || typeof referrerUid !== 'string' || !installId || typeof installId !== 'string') {
        throw new HttpsError('invalid-argument', 'referrerUid and installId are required.');
    }

    const cleanReferrer = referrerUid.trim();
    const cleanInstallId = installId.trim();

    if (!cleanReferrer || !cleanInstallId) {
        throw new HttpsError('invalid-argument', 'Invalid referrer or installId');
    }

    if (cleanReferrer.startsWith('BOT_') || cleanReferrer.startsWith('SYSTEM_')) {
        console.log(`[INSTALL_REFERRAL_SKIP] Skipping points for system account: ${cleanReferrer}`);
        return { success: false, message: 'System accounts cannot receive referrals' };
    }

    try {
        const installRef = db.collection('app_installs').doc(cleanInstallId);
        const referrerRef = db.collection('users').doc(cleanReferrer);

        // Check if this installation was already processed (anti-fraud check)
        const installDoc = await installRef.get();
        if (installDoc.exists) {
            console.log(`[INSTALL_REFERRAL_DUP] Install ${cleanInstallId} already rewarded to ${installDoc.data()?.referrerUid}`);
            return { success: true, message: 'Already processed', duplicate: true };
        }

        // Verify that the referrer user document exists
        const referrerDoc = await referrerRef.get();
        if (!referrerDoc.exists) {
            console.warn(`[INSTALL_REFERRAL_WARN] Referrer doc ${cleanReferrer} does not exist.`);
            return { success: false, message: 'Referrer not found' };
        }

        // Save install receipt
        await installRef.set({
            referrerUid: cleanReferrer,
            installId: cleanInstallId,
            platform: platform || 'android',
            appVersion: appVersion || '',
            pointsAwarded: 50,
            installedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // 1. Award 50 points to reporter (and monthly leaderboard)
        await awardPointsToReporter(cleanReferrer, 50);

        // 2. Atomically increment referralCount
        await referrerRef.update({
            referralCount: admin.firestore.FieldValue.increment(1)
        });

        console.log(`[INSTALL_REFERRAL_SUCCESS] Awarded 50 points and +1 install to ${cleanReferrer} for install ${cleanInstallId}`);

        // 3. Send high-priority notification to the reporter
        try {
            const referrerData = referrerDoc.data();
            const tokens: string[] = [];
            if (referrerData?.fcmToken) tokens.push(referrerData.fcmToken);
            if (Array.isArray(referrerData?.fcmTokens)) {
                referrerData.fcmTokens.forEach((t: any) => {
                    if (t && typeof t === 'string' && !tokens.includes(t)) tokens.push(t);
                });
            }

            if (tokens.length > 0) {
                const title = 'పాయింట్లు లభించాయి! 🎁';
                const body = 'మీ ప్రమోషన్ లింక్ ద్వారా ఒకరు Alfa News యాప్‌ను ఇన్‌స్టాల్ చేసుకున్నందుకు మీకు 50 పాయింట్లు లభించాయి.';

                await Promise.all(tokens.map(token =>
                    admin.messaging().send({
                        android: {
                            priority: 'high',
                            ttl: 86400000,
                            directBootOk: true,
                        },
                        data: {
                            type: 'REFERRAL_SUCCESS',
                            channelId: 'general_news',
                            title,
                            body,
                            actionUrl: '',
                            newsId: '',
                            imageUrl: '',
                        },
                        token
                    }).catch(() => {})
                ));
                console.log(`[INSTALL_REFERRAL] Sent referral notification to ${cleanReferrer}`);
            }
        } catch (err: any) {
            console.error(`[INSTALL_REFERRAL_NOTIFY_ERR] Error sending notification:`, err.message);
        }

        return { success: true, message: 'Referral processed successfully' };
    } catch (e: any) {
        console.error(`[INSTALL_REFERRAL_ERR] Error processing install referral:`, e.message);
        throw new HttpsError('internal', e.message);
    }
});



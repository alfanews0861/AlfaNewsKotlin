import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { REGION } from "./utils";
import { UserRole } from "./types";

const db = admin.firestore();

/**
 * Helper to get unique FCM tokens from a list of user docs
 */
function extractTokens(docs: admin.firestore.QueryDocumentSnapshot[]): string[] {
    const tokens: string[] = [];
    for (const doc of docs) {
        const data = doc.data();
        if (data.notificationsEnabled === false || data.pushEnabled === false) continue;
        const rawTokens: any[] = [...(data.fcmTokens || []), data.fcmToken];
        for (const t of rawTokens) {
            if (t && typeof t === 'string' && t.trim().length > 0 && !tokens.includes(t)) {
                tokens.push(t);
            }
        }
    }
    return tokens;
}

/**
 * Helper to broadcast FCM push to multiple tokens in chunks of 500
 */
async function sendPushToTokens(tokens: string[], title: string, body: string, type: string) {
    if (tokens.length === 0) return;

    for (let i = 0; i < tokens.length; i += 500) {
        const chunk = tokens.slice(i, i + 500);
        const messages = chunk.map(token => ({
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
                type,
                title,
                body,
                channelId: 'general_news_v2'
            }
        }));

        try {
            await admin.messaging().sendEach(messages);
        } catch (err: any) {
            console.error(`[OPERATING_RHYTHM_PUSH_ERR]`, err.message);
        }
    }
}

/**
 * Helper to record desk chat broadcast message in batches
 */
async function recordDeskChatBroadcast(
    reportersDocs: admin.firestore.QueryDocumentSnapshot[],
    title: string,
    body: string,
    messageType: string = 'BROADCAST'
) {
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const batchChunks: admin.firestore.WriteBatch[] = [];
    let currentBatch = db.batch();
    let opCount = 0;

    for (const doc of reportersDocs) {
        const reporterId = doc.id;
        const reporterData = doc.data();

        const msgDocRef = db.collection('reporter_conversations')
            .doc(reporterId)
            .collection('messages')
            .doc();

        currentBatch.set(msgDocRef, {
            senderId: 'SYSTEM_DESK',
            senderName: 'ఆల్ఫా న్యూస్ ఎడిటోరియల్ డెస్క్',
            senderRole: 'ADMIN',
            text: `${title}\n\n${body}`,
            type: messageType,
            read: false,
            timestamp
        });

        const convRef = db.collection('reporter_conversations').doc(reporterId);
        currentBatch.set(convRef, {
            reporterId,
            reporterName: reporterData.name || "Reporter",
            reporterPhone: reporterData.phone || "",
            reporterDistrict: reporterData.district || "",
            reporterMandal: reporterData.assignedMandal || reporterData.mandal || "",
            reporterPhotoUrl: reporterData.photoUrl || "",
            lastMessage: `[డెస్క్ బులెటిన్] ${body.substring(0, 60)}...`,
            lastMessageTime: timestamp,
            lastSenderRole: 'ADMIN',
            lastSenderId: 'SYSTEM_DESK',
            unreadCountForReporter: admin.firestore.FieldValue.increment(1),
            updatedAt: timestamp
        }, { merge: true });

        opCount += 2;
        if (opCount >= 400) {
            batchChunks.push(currentBatch);
            currentBatch = db.batch();
            opCount = 0;
        }
    }

    if (opCount > 0) {
        batchChunks.push(currentBatch);
    }

    for (const batch of batchChunks) {
        await batch.commit();
    }
}

// ============================================================================
// 1. ఉదయం 08:00 AM IST - మార్నింగ్ లీడ్స్ & డైలీ బీట్ (Morning Beat & Action Push)
// ============================================================================
export async function executeMorningReporterBeat(): Promise<{ count: number, tokensCount: number }> {
    console.log("[OPERATING_RHYTHM] 🌅 Morning Reporter Beat is disabled per user configuration.");
    return { count: 0, tokensCount: 0 };
}

export const morningReporterBeatNotification = onSchedule({
    schedule: "0 8 * * *",
    timeZone: "Asia/Kolkata",
    region: REGION,
    memory: "512MiB",
    timeoutSeconds: 300
}, async () => {
    await executeMorningReporterBeat();
});

// ============================================================================
// 2. మధ్యాహ్నం 01:30 PM IST - హాఫ్-డే రౌండప్ (Midday Reminder for Inactive Today)
// ============================================================================
export async function executeMiddayReporterReminder(): Promise<{ targetedCount: number, tokensCount: number }> {
    console.log("[OPERATING_RHYTHM] ⏳ Midday Reporter Reminder is disabled per user configuration.");
    return { targetedCount: 0, tokensCount: 0 };
}

export const middayReporterReminder = onSchedule({
    schedule: "30 13 * * *",
    timeZone: "Asia/Kolkata",
    region: REGION,
    memory: "512MiB",
    timeoutSeconds: 300
}, async () => {
    await executeMiddayReporterReminder();
});

// ============================================================================
// 3. సాయంత్రం 06:00 PM IST - ఈవెనింగ్ క్రైమ్ & స్థానిక సమస్యల రౌండప్ (Evening Local Beat)
// ============================================================================
export async function executeEveningReporterRoundup(): Promise<{ count: number, tokensCount: number }> {
    console.log("[OPERATING_RHYTHM] 🌇 Evening Reporter Roundup is disabled per user configuration.");
    return { count: 0, tokensCount: 0 };
}

export const eveningReporterRoundup = onSchedule({
    schedule: "0 18 * * *",
    timeZone: "Asia/Kolkata",
    region: REGION,
    memory: "512MiB",
    timeoutSeconds: 300
}, async () => {
    await executeEveningReporterRoundup();
});

// ============================================================================
// 4. రాత్రి 09:00 PM IST - డైలీ లీడర్‌బోర్డ్ & నేటి స్టార్ రిపోర్టర్లు (Night Leaderboard)
// ============================================================================
export async function executeNightLeaderboardAnnouncement(): Promise<{ topReporters: string[], tokensCount: number }> {
    console.log("[OPERATING_RHYTHM] 🌙 Night Leaderboard Announcement is disabled per user configuration.");
    return { topReporters: [], tokensCount: 0 };
}

export const nightReporterLeaderboardAnnouncement = onSchedule({
    schedule: "0 21 * * *",
    timeZone: "Asia/Kolkata",
    region: REGION,
    memory: "512MiB",
    timeoutSeconds: 300
}, async () => {
    await executeNightLeaderboardAnnouncement();
});

// ============================================================================
// Manual On-Demand Trigger for Admins (To test or trigger any rhythm beat anytime)
// ============================================================================
export const triggerOperatingRhythmBeat = onCall(async (request) => {
    const auth = request.auth;
    if (!auth || !auth.uid) {
        throw new HttpsError('unauthenticated', 'మీరు లాగిన్ అవ్వాలి.');
    }
    const adminDoc = await db.collection('users').doc(auth.uid).get();
    const role = String(adminDoc.data()?.role || '').toUpperCase();
    if (!['ADMIN', 'EDITOR', '5', '5.0', '7', '7.0'].includes(role)) {
        throw new HttpsError('permission-denied', 'అడ్మిన్లకు మాత్రమే ఈ అనుమతి ఉంది.');
    }

    const { beat } = request.data; // 'MORNING', 'MIDDAY', 'EVENING', 'NIGHT'
    switch (beat) {
        case 'MORNING':
            return await executeMorningReporterBeat();
        case 'MIDDAY':
            return await executeMiddayReporterReminder();
        case 'EVENING':
            return await executeEveningReporterRoundup();
        case 'NIGHT':
            return await executeNightLeaderboardAnnouncement();
        default:
            throw new HttpsError('invalid-argument', 'చెల్లుబాటు అయ్యే బీట్ ఎంచుకోండి (MORNING, MIDDAY, EVENING, NIGHT).');
    }
});

import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { UserRole } from "./types";

const db = admin.firestore();

/**
 * Helper to get all FCM tokens for a user
 */
async function getUserFcmTokens(userId: string): Promise<string[]> {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) return [];
        const data = userDoc.data();
        if (data && data.notificationsEnabled === false) return [];

        const rawTokens: any[] = [...(data?.fcmTokens || []), data?.fcmToken];
        return Array.from(new Set(rawTokens.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)));
    } catch {
        return [];
    }
}

/**
 * Helper to send high-priority data FCM push notification
 */
async function sendHighPriorityPush(tokens: string[], title: string, body: string, type: string, extraData: Record<string, string> = {}) {
    if (tokens.length === 0) return;

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
            type,
            title,
            body,
            channelId: 'general_news',
            ...extraData
        }
    }));

    try {
        await admin.messaging().sendEach(messages);
    } catch (err: any) {
        console.error(`[FCM_SEND_ERR] Failed to send push:`, err.message);
    }
}

/**
 * 1-on-1 Messaging between Admin and Reporter
 * - Admin to Reporter: Admin can message any reporter.
 * - Reporter to Admin: Reporter can message Admin/Desk.
 */
export const sendAdminReporterMessage = onCall(async (request) => {
    const auth = request.auth;
    if (!auth || !auth.uid) {
        throw new HttpsError('unauthenticated', 'మీరు లాగిన్ అవ్వాలి.');
    }

    const { reporterId, text, type = 'CHAT' } = request.data;
    if (!reporterId || !text || String(text).trim().length === 0) {
        throw new HttpsError('invalid-argument', 'రిపోర్టర్ ID మరియు సందేశం తప్పనిసరి.');
    }

    const senderId = auth.uid;
    const senderDoc = await db.collection('users').doc(senderId).get();
    const senderData = senderDoc.data();
    const senderRole = String(senderData?.role || '').toUpperCase();
    const isAdmin = ['ADMIN', 'EDITOR', '5', '5.0', '7', '7.0'].includes(senderRole) || senderData?.role === UserRole.ADMIN || senderData?.role === UserRole.EDITOR;

    // Security check: Either sender is an Admin/Editor, OR sender is the reporter themselves messaging the admin
    if (!isAdmin && senderId !== reporterId) {
        throw new HttpsError('permission-denied', 'మీకు ఇతర రిపోర్టర్లతో సంభాషించే అనుమతి లేదు.');
    }

    const cleanText = String(text).trim();
    const senderName = senderData?.name || (isAdmin ? "AlfaNews Admin" : "Reporter");

    // Fetch reporter profile to keep conversation metadata populated
    const reporterDoc = await db.collection('users').doc(reporterId).get();
    const reporterData = reporterDoc.data();
    const reporterName = reporterData?.name || "Reporter";
    const reporterPhone = reporterData?.phone || "";
    const reporterDistrict = reporterData?.district || "";
    const reporterMandal = reporterData?.assignedMandal || reporterData?.mandal || "";
    const reporterPhotoUrl = reporterData?.photoUrl || "";

    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    const messageData = {
        senderId,
        senderName,
        senderRole: isAdmin ? 'ADMIN' : 'REPORTER',
        text: cleanText,
        type: type || 'CHAT', // 'CHAT' | 'WARNING' | 'BROADCAST' | 'NOTICE'
        read: false,
        timestamp
    };

    // 1. Add message to reporter's dedicated conversation subcollection
    const msgRef = await db.collection('reporter_conversations')
        .doc(reporterId)
        .collection('messages')
        .add(messageData);

    // 2. Update parent conversation document summary
    const conversationRef = db.collection('reporter_conversations').doc(reporterId);
    const convUpdates: Record<string, any> = {
        reporterId,
        reporterName,
        reporterPhone,
        reporterDistrict,
        reporterMandal,
        reporterPhotoUrl,
        lastMessage: cleanText,
        lastMessageTime: timestamp,
        lastSenderRole: isAdmin ? 'ADMIN' : 'REPORTER',
        lastSenderId: senderId,
        updatedAt: timestamp
    };

    if (isAdmin) {
        convUpdates.unreadCountForReporter = admin.firestore.FieldValue.increment(1);
    } else {
        convUpdates.unreadCountForAdmin = admin.firestore.FieldValue.increment(1);
    }

    await conversationRef.set(convUpdates, { merge: true });

    // 3. Send Push Notification
    if (isAdmin) {
        // Send push to the Reporter
        const reporterTokens = await getUserFcmTokens(reporterId);
        const title = "అల్ఫా న్యూస్ అడ్మిన్ నుండి సందేశం 📩";
        await sendHighPriorityPush(reporterTokens, title, cleanText, "REPORTER_MESSAGE", {
            reporterId,
            messageId: msgRef.id
        });
    } else {
        // Reporter messaged Admin -> send push to all Admins
        const adminsSnapshot = await db.collection('users')
            .where('role', 'in', [UserRole.ADMIN, 'ADMIN', 'admin', 5, 5.0, '5'])
            .get();

        const allAdminTokens: string[] = [];
        for (const adminDoc of adminsSnapshot.docs) {
            const tokens = await getUserFcmTokens(adminDoc.id);
            allAdminTokens.push(...tokens);
        }

        const uniqueAdminTokens = Array.from(new Set(allAdminTokens));
        const title = `కొత్త రిపోర్టర్ సందేశం: ${reporterName} (${reporterDistrict})`;
        await sendHighPriorityPush(uniqueAdminTokens, title, cleanText, "REPORTER_MESSAGE", {
            reporterId,
            messageId: msgRef.id
        });
    }

    return { success: true, messageId: msgRef.id };
});

/**
 * Admin broadcasts an announcement/message to ALL active reporters
 */
export const broadcastToAllReporters = onCall(async (request) => {
    const auth = request.auth;
    if (!auth || !auth.uid) {
        throw new HttpsError('unauthenticated', 'మీరు లాగిన్ అవ్వాలి.');
    }

    const senderDoc = await db.collection('users').doc(auth.uid).get();
    const senderRole = String(senderDoc.data()?.role || '').toUpperCase();
    const isAdmin = ['ADMIN', 'EDITOR', '5', '5.0', '7', '7.0'].includes(senderRole) || senderDoc.data()?.role === UserRole.ADMIN;

    if (!isAdmin) {
        throw new HttpsError('permission-denied', 'అడ్మిన్లకు మాత్రమే ఈ అనుమతి ఉంది.');
    }

    const { title: rawTitle, body: rawBody } = request.data;
    const title = String(rawTitle || "అల్ఫా న్యూస్ రిపోర్టర్లకు ముఖ్య ప్రకటన 📢").trim();
    const body = String(rawBody || "").trim();

    if (!body) {
        throw new HttpsError('invalid-argument', 'సందేశం తప్పనిసరి.');
    }

    console.log(`[REPORTER_BROADCAST] Broadcasting to all reporters from ${auth.uid}...`);

    // Fetch all active reporters
    const reportersSnapshot = await db.collection('users')
        .where('role', 'in', [UserRole.REPORTER, 'REPORTER', 'reporter', 2, 2.0, '2'])
        .get();

    if (reportersSnapshot.empty) {
        return { success: true, count: 0, message: "రిపోర్టర్లు ఎవరూ లేరు." };
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const allTokens: string[] = [];
    let count = 0;

    // Batch writes for reporter conversation threads
    const batchChunks: admin.firestore.WriteBatch[] = [];
    let currentBatch = db.batch();
    let opCount = 0;

    for (const doc of reportersSnapshot.docs) {
        const reporterId = doc.id;
        const reporterData = doc.data();

        const msgDocRef = db.collection('reporter_conversations')
            .doc(reporterId)
            .collection('messages')
            .doc();

        currentBatch.set(msgDocRef, {
            senderId: auth.uid,
            senderName: senderDoc.data()?.name || "AlfaNews Admin",
            senderRole: 'ADMIN',
            text: `${title}\n\n${body}`,
            type: 'BROADCAST',
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
            lastMessage: `[ప్రకటన] ${body.substring(0, 60)}...`,
            lastMessageTime: timestamp,
            lastSenderRole: 'ADMIN',
            lastSenderId: auth.uid,
            unreadCountForReporter: admin.firestore.FieldValue.increment(1),
            updatedAt: timestamp
        }, { merge: true });

        opCount += 2;
        count++;

        // Collect FCM tokens
        const rawTokens: any[] = [...(reporterData.fcmTokens || []), reporterData.fcmToken];
        rawTokens.forEach((t: any) => {
            if (t && typeof t === 'string' && !allTokens.includes(t)) {
                allTokens.push(t);
            }
        });

        if (opCount >= 400) {
            batchChunks.push(currentBatch);
            currentBatch = db.batch();
            opCount = 0;
        }
    }

    if (opCount > 0) {
        batchChunks.push(currentBatch);
    }

    // Execute batch writes
    for (const batch of batchChunks) {
        await batch.commit();
    }

    // Send push notifications
    const uniqueTokens = Array.from(new Set(allTokens));
    if (uniqueTokens.length > 0) {
        await sendHighPriorityPush(uniqueTokens, title, body, "REPORTER_BROADCAST");
    }

    console.log(`[REPORTER_BROADCAST] Successfully sent broadcast to ${count} reporters.`);
    return { success: true, count, tokensTargeted: uniqueTokens.length };
});

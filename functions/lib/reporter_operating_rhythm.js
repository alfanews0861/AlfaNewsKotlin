"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerOperatingRhythmBeat = exports.nightReporterLeaderboardAnnouncement = exports.eveningReporterRoundup = exports.middayReporterReminder = exports.morningReporterBeatNotification = void 0;
exports.executeMorningReporterBeat = executeMorningReporterBeat;
exports.executeMiddayReporterReminder = executeMiddayReporterReminder;
exports.executeEveningReporterRoundup = executeEveningReporterRoundup;
exports.executeNightLeaderboardAnnouncement = executeNightLeaderboardAnnouncement;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const utils_1 = require("./utils");
const types_1 = require("./types");
const db = admin.firestore();
/**
 * Helper to get unique FCM tokens from a list of user docs
 */
function extractTokens(docs) {
    const tokens = [];
    for (const doc of docs) {
        const data = doc.data();
        if (data.notificationsEnabled === false || data.pushEnabled === false)
            continue;
        const rawTokens = [...(data.fcmTokens || []), data.fcmToken];
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
async function sendPushToTokens(tokens, title, body, type) {
    if (tokens.length === 0)
        return;
    for (let i = 0; i < tokens.length; i += 500) {
        const chunk = tokens.slice(i, i + 500);
        const messages = chunk.map(token => ({
            token,
            android: {
                priority: 'high',
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
        }
        catch (err) {
            console.error(`[OPERATING_RHYTHM_PUSH_ERR]`, err.message);
        }
    }
}
/**
 * Helper to record desk chat broadcast message in batches
 */
async function recordDeskChatBroadcast(reportersDocs, title, body, messageType = 'BROADCAST') {
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const batchChunks = [];
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
async function executeMorningReporterBeat() {
    console.log("[OPERATING_RHYTHM] 🌅 Running Morning Reporter Beat at 08:00 AM IST...");
    const reportersSnap = await db.collection('users')
        .where('role', 'in', [types_1.UserRole.REPORTER, 'REPORTER', 'reporter', 2, 2.0, '2'])
        .get();
    if (reportersSnap.empty)
        return { count: 0, tokensCount: 0 };
    const title = "శుభోదయం విలేకరి మిత్రమా! 🌅 నేటి వార్తా అప్‌డేట్స్";
    const body = "ఈరోజు మీ మండలంలో జరిగే ముఖ్య కార్యక్రమాలు, తహసీల్దార్/ప్రజావాణి వివరాలు, స్థానిక సమస్యలను కవర్ చేసి వెంటనే యాప్‌లో పోస్ట్ చేయండి.";
    const tokens = extractTokens(reportersSnap.docs);
    await Promise.all([
        sendPushToTokens(tokens, title, body, "REPORTER_MORNING_BEAT"),
        recordDeskChatBroadcast(reportersSnap.docs, title, body, "DAILY_BEAT")
    ]);
    console.log(`[OPERATING_RHYTHM] ✅ Morning Beat sent to ${reportersSnap.size} reporters (${tokens.length} tokens).`);
    return { count: reportersSnap.size, tokensCount: tokens.length };
}
exports.morningReporterBeatNotification = (0, scheduler_1.onSchedule)({
    schedule: "0 8 * * *",
    timeZone: "Asia/Kolkata",
    region: utils_1.REGION,
    memory: "512MiB",
    timeoutSeconds: 300
}, async () => {
    await executeMorningReporterBeat();
});
// ============================================================================
// 2. మధ్యాహ్నం 01:30 PM IST - హాఫ్-డే రౌండప్ (Midday Reminder for Inactive Today)
// ============================================================================
async function executeMiddayReporterReminder() {
    console.log("[OPERATING_RHYTHM] ⏳ Running Midday Reporter Reminder at 01:30 PM IST...");
    const reportersSnap = await db.collection('users')
        .where('role', 'in', [types_1.UserRole.REPORTER, 'REPORTER', 'reporter', 2, 2.0, '2'])
        .get();
    if (reportersSnap.empty)
        return { targetedCount: 0, tokensCount: 0 };
    // Find reporters who have ALREADY posted today
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayNewsSnap = await db.collection('news')
        .where('timestamp', '>=', startOfToday)
        .get()
        .catch(() => null);
    const activeReporterIdsToday = new Set();
    if (todayNewsSnap && !todayNewsSnap.empty) {
        for (const doc of todayNewsSnap.docs) {
            const data = doc.data();
            const rId = data.reporter?.id || data.originalReporterId || (typeof data.reporter === 'string' ? data.reporter : null);
            if (rId)
                activeReporterIdsToday.add(rId);
        }
    }
    // Filter reporters who have NOT submitted anything yet today
    const inactiveReportersToday = reportersSnap.docs.filter(doc => !activeReporterIdsToday.has(doc.id));
    if (inactiveReportersToday.length === 0) {
        console.log("[OPERATING_RHYTHM] 🌟 All reporters have already posted today! No midday reminder needed.");
        return { targetedCount: 0, tokensCount: 0 };
    }
    const title = "మధ్యాహ్నం రౌండప్: మీ మండల వార్త ఇంకా రాలేదు ⏳";
    const body = "నమస్కారం! నేడు మీ మండల తాజా వార్త ఇంకా యాప్‌లో రాలేదు. సాయంత్రం ఎడిషన్ కోసం తాజా ప్రజా సమస్యలు లేదా ముఖ్య సమాచారాన్ని వెంటనే పోస్ట్ చేయండి.";
    const tokens = extractTokens(inactiveReportersToday);
    await Promise.all([
        sendPushToTokens(tokens, title, body, "REPORTER_MIDDAY_REMINDER"),
        recordDeskChatBroadcast(inactiveReportersToday, title, body, "REMINDER")
    ]);
    console.log(`[OPERATING_RHYTHM] ✅ Midday reminder sent to ${inactiveReportersToday.length} inactive reporters.`);
    return { targetedCount: inactiveReportersToday.length, tokensCount: tokens.length };
}
exports.middayReporterReminder = (0, scheduler_1.onSchedule)({
    schedule: "30 13 * * *",
    timeZone: "Asia/Kolkata",
    region: utils_1.REGION,
    memory: "512MiB",
    timeoutSeconds: 300
}, async () => {
    await executeMiddayReporterReminder();
});
// ============================================================================
// 3. సాయంత్రం 06:00 PM IST - ఈవెనింగ్ క్రైమ్ & స్థానిక సమస్యల రౌండప్ (Evening Local Beat)
// ============================================================================
async function executeEveningReporterRoundup() {
    console.log("[OPERATING_RHYTHM] 🌇 Running Evening Reporter Roundup at 06:00 PM IST...");
    const reportersSnap = await db.collection('users')
        .where('role', 'in', [types_1.UserRole.REPORTER, 'REPORTER', 'reporter', 2, 2.0, '2'])
        .get();
    if (reportersSnap.empty)
        return { count: 0, tokensCount: 0 };
    const title = "సాయంత్రం వార్తా సంచిక 📰 నేటి ముఖ్య వార్తలు";
    const body = "మీ ప్రాంతంలో జరిగిన రోడ్డు ప్రమాదాలు, పోలీస్/క్రైమ్ సమాచారం, సాయంత్రం జరిగిన స్థానిక సభల వివరాలను పోస్ట్ చేసి నేటి మీ కోటాను పూర్తి చేయండి.";
    const tokens = extractTokens(reportersSnap.docs);
    await Promise.all([
        sendPushToTokens(tokens, title, body, "REPORTER_EVENING_ROUNDUP"),
        recordDeskChatBroadcast(reportersSnap.docs, title, body, "DAILY_BEAT")
    ]);
    console.log(`[OPERATING_RHYTHM] ✅ Evening Roundup sent to ${reportersSnap.size} reporters.`);
    return { count: reportersSnap.size, tokensCount: tokens.length };
}
exports.eveningReporterRoundup = (0, scheduler_1.onSchedule)({
    schedule: "0 18 * * *",
    timeZone: "Asia/Kolkata",
    region: utils_1.REGION,
    memory: "512MiB",
    timeoutSeconds: 300
}, async () => {
    await executeEveningReporterRoundup();
});
// ============================================================================
// 4. రాత్రి 09:00 PM IST - డైలీ లీడర్‌బోర్డ్ & నేటి స్టార్ రిపోర్టర్లు (Night Leaderboard)
// ============================================================================
async function executeNightLeaderboardAnnouncement() {
    console.log("[OPERATING_RHYTHM] 🌙 Running Night Leaderboard Announcement at 09:00 PM IST...");
    const reportersSnap = await db.collection('users')
        .where('role', 'in', [types_1.UserRole.REPORTER, 'REPORTER', 'reporter', 2, 2.0, '2'])
        .get();
    if (reportersSnap.empty)
        return { topReporters: [], tokensCount: 0 };
    // Find top 3 reporters by points
    const sortedReporters = reportersSnap.docs
        .map(d => ({ id: d.id, name: d.data().name || "Reporter", points: Number(d.data().points || 0), mandal: d.data().assignedMandal || "" }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 3);
    const topNames = sortedReporters.map((r, idx) => `${idx + 1}. ${r.name}${r.mandal ? ` (${r.mandal})` : ''}`).join('\n');
    const title = "నేటి అగ్రశ్రేణి విలేకరులు 🌟 ఆల్ఫా న్యూస్ లీడర్‌బోర్డ్";
    const body = `ఈరోజు చురుగ్గా వార్తలు అందించిన విలేకరి మిత్రులందరికీ అభినందనలు! 👏\n\nప్రస్తుత లీడర్‌బోర్డ్ అగ్రస్థానాలు:\n${topNames}\n\nరేపు కూడా మీ మండల వార్తలతో ముందంజలో ఉండండి!`;
    const tokens = extractTokens(reportersSnap.docs);
    await Promise.all([
        sendPushToTokens(tokens, title, body, "REPORTER_NIGHT_LEADERBOARD"),
        recordDeskChatBroadcast(reportersSnap.docs, title, body, "STAR_RECOGNITION")
    ]);
    console.log(`[OPERATING_RHYTHM] ✅ Night Leaderboard announcement sent.`);
    return { topReporters: sortedReporters.map(r => r.name), tokensCount: tokens.length };
}
exports.nightReporterLeaderboardAnnouncement = (0, scheduler_1.onSchedule)({
    schedule: "0 21 * * *",
    timeZone: "Asia/Kolkata",
    region: utils_1.REGION,
    memory: "512MiB",
    timeoutSeconds: 300
}, async () => {
    await executeNightLeaderboardAnnouncement();
});
// ============================================================================
// Manual On-Demand Trigger for Admins (To test or trigger any rhythm beat anytime)
// ============================================================================
exports.triggerOperatingRhythmBeat = (0, https_1.onCall)(async (request) => {
    const auth = request.auth;
    if (!auth || !auth.uid) {
        throw new https_1.HttpsError('unauthenticated', 'మీరు లాగిన్ అవ్వాలి.');
    }
    const adminDoc = await db.collection('users').doc(auth.uid).get();
    const role = String(adminDoc.data()?.role || '').toUpperCase();
    if (!['ADMIN', 'EDITOR', '5', '5.0', '7', '7.0'].includes(role)) {
        throw new https_1.HttpsError('permission-denied', 'అడ్మిన్లకు మాత్రమే ఈ అనుమతి ఉంది.');
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
            throw new https_1.HttpsError('invalid-argument', 'చెల్లుబాటు అయ్యే బీట్ ఎంచుకోండి (MORNING, MIDDAY, EVENING, NIGHT).');
    }
});

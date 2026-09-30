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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendInternalMessage = exports.handleReporterStatus = exports.triggerReporterActivityCheck = exports.monitorReporterActivity = exports.runReporterActivityScan = exports.calculateDaysInactive = exports.getActualLatestNewsDate = exports.getReporterActivitySummary = exports.parseToDate = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const types_1 = require("./types");
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
/**
 * Helper to parse various timestamp formats into a valid Date object or null
 */
function parseToDate(val) {
    if (!val)
        return null;
    try {
        if (typeof val.toDate === 'function')
            return val.toDate();
        if (val instanceof Date)
            return isNaN(val.getTime()) ? null : val;
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
    }
    catch {
        return null;
    }
}
exports.parseToDate = parseToDate;
/**
 * Deep multi-field news activity inspection:
 * Queries all fields (reporter.id, originalReporterId, reporterId, userId, reporter.phone, reporter.name)
 * across the news collection without early-break, calculating:
 * - Latest post date
 * - Total lifetime posts
 * - Recent posts in the last 7 days
 * - Recent posts in the last 30 days
 */
async function getReporterActivitySummary(reporterId, reporterName, reporterPhone) {
    const summary = {
        latestDate: null,
        totalPosts: 0,
        recentPostsLast7Days: 0,
        recentPostsLast30Days: 0
    };
    if (!reporterId)
        return summary;
    const now = new Date();
    const sevenDaysAgoMs = now.getTime() - (7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgoMs = now.getTime() - (30 * 24 * 60 * 60 * 1000);
    const seenDocIds = new Set();
    const checkDocs = (docs) => {
        for (const doc of docs) {
            if (seenDocIds.has(doc.id))
                continue;
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
    const queryPromises = [];
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
                if (!snap.empty)
                    checkDocs(snap.docs);
            }
            catch {
                try {
                    const snap = await db.collection('news')
                        .where(field, '==', reporterId)
                        .limit(25)
                        .get();
                    if (!snap.empty)
                        checkDocs(snap.docs);
                }
                catch { }
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
                    if (!snap.empty)
                        checkDocs(snap.docs);
                }
                catch { }
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
                if (!snap.empty)
                    checkDocs(snap.docs);
            }
            catch { }
        })());
    }
    await Promise.allSettled(queryPromises);
    return summary;
}
exports.getReporterActivitySummary = getReporterActivitySummary;
/**
 * Robust verification: Returns the latest news post date for a reporter.
 * Backwards-compatible with callers expecting Date | null.
 */
async function getActualLatestNewsDate(reporterId, reporterName, reporterPhone) {
    const summary = await getReporterActivitySummary(reporterId, reporterName, reporterPhone);
    return summary.latestDate;
}
exports.getActualLatestNewsDate = getActualLatestNewsDate;
/**
 * Calculates days of inactivity for a reporter based on last post timestamp or promotion date.
 * Always takes the maximum (most recent) date between actual news collection date and user doc lastPostTimestamp.
 */
function calculateDaysInactive(reporter, now, actualNewsDate) {
    const userDocLastPost = parseToDate(reporter.lastPostTimestamp);
    // Pick the most recent timestamp between actualNewsDate and userDocLastPost
    let lastPost = null;
    if (actualNewsDate && userDocLastPost) {
        lastPost = actualNewsDate.getTime() > userDocLastPost.getTime() ? actualNewsDate : userDocLastPost;
    }
    else {
        lastPost = actualNewsDate || userDocLastPost;
    }
    const promotedAt = parseToDate(reporter.promotedAt) || parseToDate(reporter.rejoinedAt) || parseToDate(reporter.roleUpdatedAt);
    const createdAt = parseToDate(reporter.timestamp) || parseToDate(reporter.createdAt) || parseToDate(reporter.joinedAt);
    // 1. Pick the most recent activity marker between lastPost and promotedAt
    let referenceDate = null;
    if (lastPost && promotedAt) {
        referenceDate = lastPost.getTime() > promotedAt.getTime() ? lastPost : promotedAt;
    }
    else if (lastPost) {
        referenceDate = lastPost;
    }
    else if (promotedAt) {
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
exports.calculateDaysInactive = calculateDaysInactive;
/**
 * Core scanner function to evaluate reporter activity and send warnings.
 */
async function runReporterActivityScan() {
    console.log("[REPORTER_MONITOR] 🔍 Starting reporter activity scan...");
    const now = new Date();
    // Fetch all active reporters (handling string, numeric, and enum role formats)
    const reportersSnapshot = await db.collection('users')
        .where('role', 'in', [types_1.UserRole.REPORTER, 'REPORTER', 'reporter', 2, 2.0, '2'])
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
            continue; // Skip this scan iteration, giving full grace period
        }
        const acted = await handleReporterStatus(reporterId, reporter, now);
        if (acted)
            inactiveCount++;
    }
    console.log(`[REPORTER_MONITOR] Activity scan complete. Acted on ${inactiveCount} reporters.`);
    return { reportersScanned: reportersSnapshot.size, inactiveActedOn: inactiveCount };
}
exports.runReporterActivityScan = runReporterActivityScan;
/**
 * Scheduled function to monitor reporter activity.
 * Runs daily at 00:00 IST (18:30 UTC previous day).
 */
exports.monitorReporterActivity = (0, scheduler_1.onSchedule)({
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
exports.triggerReporterActivityCheck = (0, https_1.onCall)({
    memory: "256MiB",
    timeoutSeconds: 60
}, async (request) => {
    console.log("[REPORTER_MONITOR_MANUAL] Manual activity check triggered...");
    const result = await runReporterActivityScan();
    return { success: true, ...result };
});
async function handleReporterStatus(reporterId, reporter, now = new Date()) {
    const inProbation = reporter.inProbation === true;
    const currentLevel = Number(reporter.warningLevel || 0);
    // 1. Fetch comprehensive news activity summary across all fields
    const summary = await getReporterActivitySummary(reporterId, reporter.name, reporter.phone);
    const userDocLastPost = parseToDate(reporter.lastPostTimestamp);
    // Take the maximum of summary.latestDate and userDocLastPost
    let actualNewsDate = null;
    if (summary.latestDate && userDocLastPost) {
        actualNewsDate = summary.latestDate.getTime() > userDocLastPost.getTime() ? summary.latestDate : userDocLastPost;
    }
    else {
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
    // 3. Reporter points & post count metrics
    let points = Number(reporter.points || 0);
    const totalNewsPosts = Math.max(summary.totalPosts, Math.floor(points / 10));
    // Self-heal points if reporter has posts but 0 points recorded
    if (totalNewsPosts > 0 && points === 0) {
        points = totalNewsPosts * 10;
        await db.collection('users').doc(reporterId).set({ points }, { merge: true });
        reporter.points = points;
    }
    // Determine if this is a Regular / Established / Senior Reporter
    const isRegularReporter = points >= 30 ||
        totalNewsPosts >= 3 ||
        summary.recentPostsLast7Days >= 1 ||
        summary.recentPostsLast30Days >= 3 ||
        reporter.isProtectedSenior === true ||
        reporter.exemptFromInactivity === true;
    // 🛡️ CRITICAL RULE: Active / Regular / Senior reporters must NEVER be in probation or receive deactivation threats!
    if (isRegularReporter) {
        // If they currently have any warning level or probation flag, immediately and silently heal them!
        if (currentLevel > 0 || inProbation || reporter.lastWarningDate) {
            await db.collection('users').doc(reporterId).set({
                warningLevel: 0,
                inProbation: false,
                lastWarningDate: null,
                isProtectedSenior: true
            }, { merge: true });
            console.log(`[REPORTER_MONITOR] 🛡️ Cleared warnings and probation for regular reporter ${reporter.name || reporterId} (${points} pts, ${totalNewsPosts} posts, ${summary.recentPostsLast7Days} recent).`);
            return true;
        }
        // If an established reporter hasn't posted in 14+ days, send ONLY a respectful friendly check-in reminder
        // (No warning level escalation, no probation, no threat of removal)
        if (daysInactive >= 14) {
            const lastFriendlyReminder = parseToDate(reporter.lastFriendlyReminderDate);
            const daysSinceReminder = lastFriendlyReminder ? (now.getTime() - lastFriendlyReminder.getTime()) / (1000 * 60 * 60 * 24) : 999;
            if (daysSinceReminder >= 14) {
                console.log(`[REPORTER_MONITOR] 📰 Sending friendly encouragement to established reporter ${reporter.name || reporterId}.`);
                await db.collection('users').doc(reporterId).set({
                    lastFriendlyReminderDate: admin.firestore.FieldValue.serverTimestamp(),
                    isProtectedSenior: true,
                    warningLevel: 0,
                    inProbation: false
                }, { merge: true });
                await sendInternalMessage(reporterId, "మీ వార్తల కోసం Alfa News వేచి చూస్తోంది! 📰", "నమస్కారం! గత కొద్ది రోజులుగా మీ మండల వార్తలు రాలేదు. మీ ప్రాంత తాజా విశేషాలను, ప్రజల సమస్యలను త్వరలోనే పోస్ట్ చేయగలరని ఆశిస్తున్నాము.", "NORMAL", reporter, "REMINDER");
            }
        }
        return false;
    }
    // 4. Auto-Reset logic: For ANY reporter who posted recently (within 5 days) or posted in last 7 days
    if (daysInactive < 5 || summary.recentPostsLast7Days > 0) {
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
    // 5. Progressive Warning Ladder for Inactive Non-Regular accounts (Strictly sequential, no level skipping)
    const lastWarningDate = parseToDate(reporter.lastWarningDate);
    const hoursSinceLastWarning = lastWarningDate
        ? Math.max(0, (now.getTime() - lastWarningDate.getTime()) / (1000 * 60 * 60))
        : 999;
    let nextLevel = currentLevel;
    let title = "";
    let body = "";
    let shouldDowngrade = false;
    // Strict sequential progression:
    // Level 0 -> Level 1 (after 5 days inactive)
    // Level 1 -> Level 2 (after 8 days inactive AND at least 48h since Level 1)
    // Level 2 -> Level 3 (after 12 days inactive AND at least 72h since Level 2)
    // Level 3 -> Demotion (after 15 days inactive AND at least 72h since Level 3 AND 0 lifetime posts)
    if (daysInactive >= 15 && currentLevel >= 3 && hoursSinceLastWarning >= 72 && totalNewsPosts === 0) {
        shouldDowngrade = true;
        title = "రిపోర్టర్ హోదా తొలగించబడింది";
        body = "వార్తలు పంపనందున మరియు పదే పదే పంపిన హెచ్చరికలకు స్పందించనందున మిమ్మల్ని రిపోర్టర్ హోదా నుండి తొలగించి సబ్‌స్క్రైబర్‌గా మార్చాము.";
    }
    else if (daysInactive >= 12 && currentLevel === 2 && hoursSinceLastWarning >= 72) {
        nextLevel = 3;
        title = "తుది హెచ్చరిక (Final Warning)";
        body = "గత 12 రోజులుగా మీరు వార్తలు పంపడం లేదు. రాబోయే 3 రోజుల్లో కనీసం ఒక వార్త అయినా పంపకపోతే మీ రిపోర్టర్ హోదా రద్దు చేయబడుతుంది.";
    }
    else if (daysInactive >= 8 && currentLevel === 1 && hoursSinceLastWarning >= 48) {
        nextLevel = 2;
        title = "షోకాజ్ నోటీసు (Show Cause Notice)";
        body = "మీరు గత 8 రోజులుగా వార్తలు పంపడం లేదు. వార్తలు పంపకపోవడానికి గల కారణాన్ని తెలియజేయండి లేదా వెంటనే మీ మండల వార్తను పోస్ట్ చేయండి.";
    }
    else if (daysInactive >= 5 && currentLevel === 0) {
        nextLevel = 1;
        title = "వార్తలు పంపమని విన్నపం";
        body = "దయచేసి మీ ప్రాంత వార్తలను క్రమం తప్పకుండా పంపండి. మీ సహకారం Alfa News కు ఎంతో అవసరం.";
    }
    if (shouldDowngrade) {
        console.log(`[REPORTER_MONITOR] ⚠️ Downgrading inactive account ${reporter.name || reporterId} due to ${daysInactive} days inactivity.`);
        await db.collection('users').doc(reporterId).set({
            role: types_1.UserRole.SUBSCRIBER,
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
        }
        catch (appErr) {
            console.error(`[APP_SUSPEND_ERR] ${reporterId}:`, appErr.message);
        }
        await sendInternalMessage(reporterId, title, body, "CRITICAL", reporter, "WARNING");
        return true;
    }
    else if (nextLevel > currentLevel) {
        console.log(`[REPORTER_MONITOR] 📢 Warning level ${nextLevel} sent to reporter ${reporter.name || reporterId}, inactive ${daysInactive} days.`);
        const importance = nextLevel === 3 ? "HIGH" : "NORMAL";
        await db.collection('users').doc(reporterId).set({
            warningLevel: nextLevel,
            lastWarningDate: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        await sendInternalMessage(reporterId, title, body, importance, reporter, "WARNING");
        return true;
    }
    return false;
}
exports.handleReporterStatus = handleReporterStatus;
async function sendInternalMessage(userId, title, body, importance, userData, msgType = "INTERNAL_MESSAGE") {
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
            await db.collection('reporter_conversations').doc(userId).collection('messages').add({
                senderId: "SYSTEM_ADMIN",
                senderName: "AlfaNews Admin",
                senderRole: "ADMIN",
                text: `⚠️ [${title}]\n${body}`,
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
                lastMessage: `⚠️ ${title}`,
                lastMessageTime: timestamp,
                lastSenderRole: "ADMIN",
                unreadCountForReporter: admin.firestore.FieldValue.increment(1),
                updatedAt: timestamp
            }, { merge: true });
        }
        catch (err) {
            console.error(`[CONV_WRITE_ERR] ${userId}:`, err.message);
        }
        // 3. Fetch tokens and send High-Priority FCM Push
        const data = userData || (await db.collection('users').doc(userId).get()).data();
        if (data && (data.notificationsEnabled === false || data.pushEnabled === false))
            return;
        const rawTokens = [...(data?.fcmTokens || []), data?.fcmToken];
        const tokens = Array.from(new Set(rawTokens.filter((t) => typeof t === 'string' && t.trim().length > 0)));
        if (tokens.length > 0) {
            const messages = tokens.map(token => ({
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
                    type: "INTERNAL_MESSAGE",
                    title,
                    body,
                    importance,
                    channelId: 'general_news_v2'
                }
            }));
            await admin.messaging().sendEach(messages).catch(err => console.error(`[FCM_ERROR] User ${userId}:`, err));
        }
    }
    catch (err) {
        console.error(`[SEND_INTERNAL_MSG_ERROR] User ${userId}:`, err);
    }
}
exports.sendInternalMessage = sendInternalMessage;

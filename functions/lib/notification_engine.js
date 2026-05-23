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
exports.sendPersonalizedNotification = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const v2_1 = require("firebase-functions/v2");
// Track sent notifications across runs (best effort via global variable)
const notificationSent = new Map();
exports.sendPersonalizedNotification = (0, scheduler_1.onSchedule)({
    schedule: "0 8,13,18,21 * * *",
    timeZone: "Asia/Kolkata",
    timeoutSeconds: 540, // 9 mins limit for processing
    memory: "1GiB"
}, async (event) => {
    const db = admin.firestore();
    // ✅ Get current hour in IST
    const istHour = parseInt(new Intl.DateTimeFormat('en-GB', {
        hour: 'numeric',
        hour12: false,
        timeZone: 'Asia/Kolkata'
    }).format(new Date()));
    v2_1.logger.log(`Notification run started at IST Hour: ${istHour}`);
    // 1. గత 12 గంటల్లో పోస్ట్ చేసిన వార్తలను తెచ్చుకోవడం
    const windowMillis = 12 * 60 * 60 * 1000;
    const sinceTime = new Date(Date.now() - windowMillis);
    // ✅ FIXED: Filter by approved: true in the query itself to avoid unapproved news crowding out top 100
    const newsSnapshot = await db.collection('news')
        .where('approved', '==', true)
        .where('timestamp', '>', sinceTime)
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();
    if (newsSnapshot.empty) {
        v2_1.logger.log(`[NOTIF] గత 12 గంటల్లో కొత్త ఆమోదించబడిన వార్తలు లేవు. (Since: ${sinceTime.toISOString()})`);
        return;
    }
    v2_1.logger.log(`[NOTIF] Found ${newsSnapshot.size} approved news docs in the last 12 hours.`);
    // 2. వార్తలను ఫిల్టర్ చేసి, కేటగిరీల వారీగా బెస్ట్ (లేటెస్ట్) వార్తను ఎంచుకోవడం
    const bestNewsByCategory = new Map();
    let overallBestNews = null;
    newsSnapshot.docs.forEach(doc => {
        const news = doc.data();
        news.id = doc.id;
        const status = (news.status || "").toUpperCase();
        // Since we filtered by approved:true in query, we check status/type for extra safety
        const isPublished = status === "published";
        const isAiProcessed = status === "AI_PROCESSED";
        const isSystemType = ["greeting", "history", "cartoon"].includes(news.type);
        if (news.approved !== true && !isPublished && !isAiProcessed && !isSystemType)
            return;
        // Skip duplicates in a single run based on our local map
        const lastSentTime = notificationSent.get(news.id) || 0;
        if (Date.now() - lastSentTime < 12 * 60 * 60 * 1000)
            return;
        const category = news.category || (news.categories && news.categories.length > 0 ? news.categories[0] : null);
        if (!category)
            return;
        if (!bestNewsByCategory.has(category)) {
            bestNewsByCategory.set(category, news);
        }
        // Track overall best to broadcast if needed
        if (!overallBestNews || (news.score || 0) > (overallBestNews.score || 0)) {
            overallBestNews = news;
        }
    });
    // --- 9 PM TOP 5 BROADCAST ---
    if (istHour === 21 && overallBestNews) {
        try {
            v2_1.logger.log("9 PM Slot: Sending Top 5 News to everyone via topic.");
            // Sort all recent news by score to get top 5
            const top5 = newsSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .slice(0, 5);
            for (const n of top5) {
                const headline = n.headline?.telugu || n.headline?.english || n.headline || "నేటి ముఖ్య వార్త";
                await admin.messaging().send({
                    notification: { title: '🌟 నేటి టాప్ 5 వార్తలు', body: (headline + "").substring(0, 150) },
                    data: { actionUrl: `alfanews://news/${n.id}`, newsId: n.id, channelId: "top_news", imageUrl: n.mediaUrl || "" },
                    topic: 'all_users'
                });
            }
        }
        catch (e) {
            v2_1.logger.error("[NOTIF] 9 PM Broadcast Error", e);
        }
    }
    else if (overallBestNews) {
        // --- REGULAR SLOT BROADCAST (Top 1 news to everyone) ---
        // Ensuring everyone gets at least the top news even if no personalized interest
        try {
            const headline = overallBestNews.headline?.telugu || overallBestNews.headline?.english || overallBestNews.headline || "తాజా వార్తలు";
            await admin.messaging().send({
                notification: { title: '🔔 తాజా వార్తలు (AlfaNews)', body: (headline + "").substring(0, 150) },
                data: { actionUrl: `alfanews://news/${overallBestNews.id}`, newsId: overallBestNews.id, channelId: "general_news", imageUrl: overallBestNews.mediaUrl || "" },
                topic: 'all_users'
            });
            v2_1.logger.log(`[NOTIF] Broadcasted top news (${overallBestNews.id}) to all_users topic.`);
        }
        catch (e) {
            v2_1.logger.error("[NOTIF] General Broadcast Error", e);
        }
    }
    // 3. Personalized Notifications based on categoryScores
    const notifiedUserIds = new Set();
    const messages = [];
    // --- A. REGISTERED USERS ---
    for (const [category, news] of bestNewsByCategory.entries()) {
        let startAfterDoc = null;
        let hasMoreUsers = true;
        let totalUsersProcessed = 0;
        const maxUsersPerCategory = 1000;
        while (hasMoreUsers && totalUsersProcessed < maxUsersPerCategory) {
            let query = db.collection('users')
                .where(`categoryScores.${category}`, '>', 0)
                .limit(500);
            if (startAfterDoc)
                query = query.startAfter(startAfterDoc);
            const usersSnapshot = await query.get();
            if (usersSnapshot.docs.length === 0) {
                hasMoreUsers = false;
                break;
            }
            usersSnapshot.docs.forEach(doc => {
                const userId = doc.id;
                const user = doc.data();
                if (user.shadowMode === true || user.notificationsEnabled === false)
                    return;
                if (notifiedUserIds.has(userId))
                    return;
                // Safe timestamp handling for throttle
                const lastNotif = user.lastNotificationTime;
                const lastTime = lastNotif ? (typeof lastNotif === 'number' ? lastNotif : (lastNotif.toMillis ? lastNotif.toMillis() : 0)) : 0;
                if (Date.now() - lastTime < 3600000)
                    return; // 1 hour throttle
                const tokens = [];
                if (user.fcmToken)
                    tokens.push(user.fcmToken);
                if (Array.isArray(user.fcmTokens)) {
                    user.fcmTokens.forEach((t) => { if (t && !tokens.includes(t))
                        tokens.push(t); });
                }
                if (tokens.length > 0) {
                    notifiedUserIds.add(userId);
                    const headline = news.headline?.telugu || news.headline?.english || news.headline || `${category} తాజా వార్త`;
                    tokens.forEach(token => {
                        messages.push({
                            token: token,
                            notification: { title: 'మీ కోసం ప్రత్యేక వార్త!', body: (headline + "").substring(0, 150) },
                            data: { actionUrl: `alfanews://news/${news.id}`, newsId: news.id, category: category, channelId: "personalized_news", imageUrl: news.mediaUrl || "" }
                        });
                    });
                }
                totalUsersProcessed++;
            });
            if (usersSnapshot.docs.length < 500)
                hasMoreUsers = false;
            else
                startAfterDoc = usersSnapshot.docs[usersSnapshot.docs.length - 1];
        }
        notificationSent.set(news.id, Date.now());
    }
    // --- B. GUEST USERS (NEW) ---
    // ఆ 3100 మంది రిజిస్టర్ అవ్వని గెస్ట్ యూజర్లకు టాప్ వార్తలను పంపడం
    try {
        const guestsSnapshot = await db.collection('anonymous_devices')
            .where('notificationsEnabled', '!=', false)
            .limit(1000) // గరిష్టంగా 1000 మంది గెస్ట్ లని ఒక రన్ లో ప్రాసెస్ చేస్తాం
            .get();
        if (!guestsSnapshot.empty && overallBestNews) {
            const headline = overallBestNews.headline?.telugu || "తాజా వార్తలు";
            guestsSnapshot.docs.forEach(doc => {
                const guest = doc.data();
                if (guest.fcmToken) {
                    messages.push({
                        token: guest.fcmToken,
                        notification: { title: 'AlfaNews తాజా వార్త', body: (headline + "").substring(0, 150) },
                        data: { actionUrl: `alfanews://news/${overallBestNews.id}`, newsId: overallBestNews.id }
                    });
                }
            });
            v2_1.logger.log(`[NOTIF] Added ${guestsSnapshot.size} guest devices to delivery queue.`);
        }
    }
    catch (e) {
        v2_1.logger.error("[NOTIF] Guest delivery error", e);
    }
    // 4. Send Batch Notifications
    if (messages.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < messages.length; i += batchSize) {
            const batch = messages.slice(i, i + batchSize);
            try {
                await admin.messaging().sendEach(batch);
            }
            catch (error) {
                v2_1.logger.error(`[NOTIF] Batch notification error: ${error}`);
            }
        }
        v2_1.logger.log(`[NOTIF] Personalized notifications sent to ${notifiedUserIds.size} users.`);
        // ✅ Update lastNotificationTime for notified users
        const updateBatchSize = 500;
        const uids = Array.from(notifiedUserIds);
        for (let i = 0; i < uids.length; i += updateBatchSize) {
            const batch = db.batch();
            uids.slice(i, i + updateBatchSize).forEach(uid => {
                batch.update(db.collection('users').doc(uid), { lastNotificationTime: Date.now() });
            });
            await batch.commit().catch(e => v2_1.logger.error("[NOTIF] User timestamp update failed", e));
        }
    }
});
//# sourceMappingURL=notification_engine.js.map
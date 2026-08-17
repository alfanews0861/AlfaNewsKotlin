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
exports.onNewsPostApprovedNotify = exports.sendPersonalizedNotification = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-functions/v2/firestore");
const v2_1 = require("firebase-functions/v2");
const utils_1 = require("./utils");
// ==========================================
// DESIGN PHILOSOPHY
// ==========================================
// 1. isBreaking, notificationWorthy → AI news_handler.ts లో process చేసేటప్పుడే set అవుతాయి
//    notification time లో ఏ content-based logic అవసరం లేదు
//
// 2. Notification ranking → notificationWorthy=true వార్తలలో
//    highest longViews వున్నది select చేయాలి — media bonus వద్దు
//
// 3. Breaking trigger → isBreaking=true లేదా tone=BREAKING/URGENT అయినప్పుడు వెంటనే push
// ==========================================
const DISTRICTS = [
    "హైదరాబాద్", "విశాఖపట్నం", "విజయవాడ", "గుంటూరు", "నెల్లూరు",
    "కర్నూలు", "వరంగల్", "ఖమ్మం", "కరీంనగర్", "నిజామాబాద్",
    "తిరుపతి", "అనంతపురం", "కడప", "కాకినాడ", "రాజమహేంద్రవరం"
];
const CATEGORY_TOPICS = {
    "రాజకీయం": "cat_politics",
    "వినోదం": "cat_cinema",
    "క్రైమ్": "cat_crime",
    "క్రీడలు": "cat_sports",
    "వ్యాపారం": "cat_business",
    "టెక్నాలజీ": "cat_technology",
    "ఆరోగ్యం": "cat_health",
    "విద్య": "cat_education",
    "భక్తి": "cat_spiritual",
    "వ్యవసాయం": "cat_agriculture",
    "జాతీయం": "cat_national",
    "ప్రపంచం": "cat_international",
    "జీవనశైలి": "cat_lifestyle",
};
// ==========================================
// TIME-BASED ENGAGING TITLES
// ==========================================
function getTitleForHour(hour, headline, curiosityTitle) {
    const raw = (curiosityTitle && curiosityTitle.trim()) ? curiosityTitle.trim() : headline.trim();
    const short = raw.length > 50 ? raw.substring(0, 50).trim() + "..." : raw;
    if (hour === 8)
        return `☀️ శుభోదయం! ${short}`;
    if (hour === 13)
        return `🔴 తాజా వార్త: ${short}`;
    if (hour === 18)
        return `🌆 సాయంత్రం అప్‌డేట్: ${short}`;
    if (hour === 21)
        return `🌙 రాత్రి వార్తలు: ${short}`;
    return `📰 ${short}`;
}
// ==========================================
// SHARED: Build FCM message with notification & data payloads
// ==========================================
function buildNewsMessage(news, title, channelId, imageUrl, ttlMs, topicOrToken) {
    const headline = news.headline?.telugu || news.headline?.english || news.headline || "";
    const body = (headline + "").substring(0, 150);
    // 🛡️ Cost & Egress Guard: Only attach image to system notification drawer if it is a lightweight CDN/YouTube thumbnail.
    // NEVER attach heavy raw Firebase Storage downloads to FCM broadcast payloads to prevent massive background download spikes.
    const isHeavyStorageUrl = imageUrl.includes('firebasestorage.googleapis.com') && !imageUrl.includes('thumbnails%2F') && !imageUrl.includes('_thumb');
    const safeDrawerImageUrl = (!isHeavyStorageUrl && imageUrl) ? imageUrl : undefined;
    return {
        notification: {
            title,
            body,
            ...(safeDrawerImageUrl ? { imageUrl: safeDrawerImageUrl } : {})
        },
        android: {
            priority: 'high',
            ttl: ttlMs,
            directBootOk: true,
            notification: {
                channelId,
                ...(safeDrawerImageUrl ? { imageUrl: safeDrawerImageUrl } : {}),
                defaultSound: true,
                priority: 'high'
            }
        },
        data: {
            actionUrl: `alfanews://news/${news.id}`,
            newsId: news.id,
            channelId,
            imageUrl: imageUrl || "",
            title,
            body,
        },
        ...topicOrToken,
    };
}
// ==========================================
// ATOMIC DAILY LIMIT CHECK FOR BREAKING NEWS
// ==========================================
async function checkAndIncrementLimitAtomic(db, docName, limit) {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const docRef = db.collection('settings').doc(docName);
    return await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);
        const data = doc.data();
        let currentCount = 0;
        if (doc.exists && data && data.date === today) {
            currentCount = data.count || 0;
        }
        if (currentCount >= limit) {
            return false;
        }
        transaction.set(docRef, {
            date: today,
            count: currentCount + 1
        }, { merge: true });
        return true;
    });
}
// ==========================================
// SCHEDULED NOTIFICATIONS — 4 times/day (8 AM, 1 PM, 6 PM, 9 PM IST)
// Ranking: notificationWorthy=true వార్తలలో highest longViews
// ==========================================
exports.sendPersonalizedNotification = (0, scheduler_1.onSchedule)({
    schedule: "0 8,13,18,21 * * *",
    timeZone: "Asia/Kolkata",
    timeoutSeconds: 540,
    memory: "1GiB"
}, async (event) => {
    const db = admin.firestore();
    const settingsRef = db.collection('settings').doc('notifications');
    const settingsDoc = await settingsRef.get();
    const lastSentMap = settingsDoc.exists ? (settingsDoc.data()?.lastSentNewsIdMap || {}) : {};
    const updatedMap = { ...lastSentMap };
    const istHour = parseInt(new Intl.DateTimeFormat('en-GB', {
        hour: 'numeric',
        hour12: false,
        timeZone: 'Asia/Kolkata'
    }).format(new Date()));
    v2_1.logger.log(`[NOTIF] Scheduled run started at IST Hour: ${istHour}`);
    const windowMillis = 24 * 60 * 60 * 1000;
    const sinceTime = new Date(Date.now() - windowMillis);
    // 1. Fetch news: notificationWorthy=true వార్తలు
    let allNews = [];
    const newsSnapshot = await db.collection('news')
        .where('approved', '==', true)
        .where('notificationWorthy', '==', true)
        .where('timestamp', '>', sinceTime)
        .get();
    if (newsSnapshot.empty) {
        // Fallback: If AI hasn't explicitly set notificationWorthy=true, check approved news in last 24h
        v2_1.logger.log(`[NOTIF] No explicit notificationWorthy=true news. Checking fallback approved news...`);
        const fallbackSnapshot = await db.collection('news')
            .where('approved', '==', true)
            .where('timestamp', '>', sinceTime)
            .get();
        const validDocs = fallbackSnapshot.docs.filter(d => d.data().notificationWorthy !== false);
        allNews = validDocs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    else {
        allNews = newsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    if (allNews.length === 0) {
        v2_1.logger.log(`[NOTIF] No approved news found in last 24h. Exiting.`);
        return;
    }
    // Ranking: pure longViews / views sort descending
    allNews.sort((a, b) => {
        const viewsA = a.longViews || a.views || 0;
        const viewsB = b.longViews || b.views || 0;
        return viewsB - viewsA;
    });
    // --- 1. General Notification — అన్ని 4 scheduled slots (8, 13, 18, 21) కి పంపు ---
    // Unsent news ని find చేస్తాం (ముందు పంపిన topNews కాకుండా next best news)
    const topNews = allNews.find((n) => lastSentMap['general'] !== n.id) || allNews[0];
    if (topNews && lastSentMap['general'] !== topNews.id) {
        const headline = topNews.headline?.telugu || topNews.headline?.english || topNews.headline || "నేటి ముఖ్య వార్తలు";
        const curiosityTitle = topNews.notificationTitle || "";
        let imageUrl = topNews.thumbnailUrl || "";
        if (!imageUrl && topNews.mediaUrl) {
            imageUrl = (await (0, utils_1.createAndSaveThumbnail)(topNews.mediaUrl, topNews.id)) || topNews.mediaUrl;
            if (imageUrl && imageUrl !== topNews.mediaUrl) {
                await db.collection('news').doc(topNews.id).update({ thumbnailUrl: imageUrl }).catch(() => { });
            }
        }
        try {
            const message = buildNewsMessage(topNews, getTitleForHour(istHour, headline, curiosityTitle), "general_news", imageUrl, 3600000, // 1 hour TTL
            { topic: 'all_users' });
            await admin.messaging().send(message);
            updatedMap['general'] = topNews.id;
            v2_1.logger.log(`[NOTIF] General sent: newsId=${topNews.id}, views=${topNews.longViews || 0}, hour=${istHour}`);
        }
        catch (e) {
            v2_1.logger.error(`[NOTIF] General send failed:`, e.message);
        }
    }
    else {
        v2_1.logger.log(`[NOTIF] General skipped — no new unsent news found. newsId=${topNews?.id}`);
    }
    // --- 2. District Notification — 13 PM మరియు 21 PM slots కి district push ---
    if (istHour === 13 || istHour === 21) {
        for (const district of DISTRICTS) {
            // ఆ జిల్లాలో ఇంతకుముందు పంపని best news కనుక్కోవడం
            const districtNews = allNews.find((n) => ((Array.isArray(n.categories) && n.categories.includes(district)) || n.district === district) &&
                lastSentMap[district] !== n.id);
            if (!districtNews)
                continue;
            const notifTitle = districtNews.notificationTitle || districtNews.headline?.telugu || `${district} తాజా వార్త`;
            const shortTitle = notifTitle.length > 45 ? notifTitle.substring(0, 45).trim() + "..." : notifTitle;
            let imageUrl = districtNews.thumbnailUrl || "";
            if (!imageUrl && districtNews.mediaUrl) {
                imageUrl = (await (0, utils_1.createAndSaveThumbnail)(districtNews.mediaUrl, districtNews.id)) || districtNews.mediaUrl;
                if (imageUrl && imageUrl !== districtNews.mediaUrl) {
                    await db.collection('news').doc(districtNews.id).update({ thumbnailUrl: imageUrl }).catch(() => { });
                }
            }
            const topicName = (0, utils_1.getTopicName)("district", district);
            try {
                const message = buildNewsMessage(districtNews, `📍 ${district}: ${shortTitle}`, "local_news", imageUrl, 7200000, // 2 hour TTL
                { topic: topicName });
                await admin.messaging().send(message);
                updatedMap[district] = districtNews.id;
                v2_1.logger.log(`[NOTIF] District ${district}: newsId=${districtNews.id}, views=${districtNews.longViews || 0}`);
            }
            catch (e) {
                v2_1.logger.error(`[NOTIF] Error in district topic ${topicName}:`, e.message);
            }
        }
    }
    // --- 3. Category Notification — 8 AM & 18 PM slots కి category-wise push ---
    if (istHour === 8 || istHour === 18) {
        for (const [teluguCat, topicName] of Object.entries(CATEGORY_TOPICS)) {
            const catKey = `cat_${topicName}`;
            // ఆ category లో ఇంతకుముందు general గాని category గాని పంపని best news కనుక్కోవడం
            const catNews = allNews.find((n) => (n.category === teluguCat || (Array.isArray(n.categories) && n.categories.includes(teluguCat))) &&
                lastSentMap['general'] !== n.id &&
                lastSentMap[catKey] !== n.id);
            if (!catNews)
                continue;
            const notifTitle = catNews.notificationTitle || catNews.headline?.telugu || catNews.headline?.english || "";
            const shortTitle = notifTitle.length > 45 ? notifTitle.substring(0, 45).trim() + "..." : notifTitle;
            const imageUrl = catNews.thumbnailUrl || catNews.mediaUrl || "";
            try {
                const message = buildNewsMessage(catNews, `📌 ${teluguCat}: ${shortTitle}`, "general_news", imageUrl, 3600000, // 1 hour TTL
                { topic: topicName });
                await admin.messaging().send(message);
                updatedMap[catKey] = catNews.id;
                v2_1.logger.log(`[NOTIF] Category ${teluguCat}: newsId=${catNews.id}, topic=${topicName}`);
            }
            catch (e) {
                v2_1.logger.error(`[NOTIF] Error in category topic ${topicName}:`, e.message);
            }
        }
    }
    await settingsRef.set({
        lastSentNewsIdMap: updatedMap,
        lastRunAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    // Update scheduled run record for monitoring
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    await db.collection('settings').doc('notif_daily_scheduled').set({
        date: today,
        lastRunHour: istHour,
        lastRunAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(() => { });
});
// ==========================================
// BREAKING NEWS INSTANT TRIGGER
// isBreaking=true లేదా tone=BREAKING/URGENT అయిన వెంటనే notification
// ==========================================
exports.onNewsPostApprovedNotify = (0, firestore_1.onDocumentWritten)({
    document: "news/{postId}",
    region: utils_1.REGION,
}, async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!after)
        return;
    const postId = event.params.postId;
    // Only fire when approved changes false → true
    const wasApproved = before?.approved === true;
    const isNowApproved = after.approved === true;
    if (wasApproved || !isNowApproved)
        return;
    // Breaking trigger: isBreaking=true OR tone=BREAKING/URGENT
    const tone = (after.tone || "").toUpperCase();
    const isBreakingOrUrgent = after.isBreaking === true || tone === 'BREAKING' || tone === 'URGENT';
    if (!isBreakingOrUrgent) {
        v2_1.logger.log(`[BREAKING] Not breaking/urgent: ${postId} (tone=${after.tone}, isBreaking=${after.isBreaking})`);
        return;
    }
    v2_1.logger.log(`[BREAKING] Triggered: ${postId} (tone=${after.tone}, isBreaking=${after.isBreaking})`);
    // Age check — 6 గంటల కంటే పాత news కి breaking send వద్దు
    const ts = after.timestamp;
    let ageHours = 0;
    if (ts && typeof ts.toDate === 'function') {
        ageHours = (Date.now() - ts.toDate().getTime()) / (1000 * 60 * 60);
    }
    else if (ts && ts._seconds) {
        ageHours = (Date.now() - ts._seconds * 1000) / (1000 * 60 * 60);
    }
    if (ageHours > 6) {
        v2_1.logger.log(`[BREAKING] Too old (${ageHours.toFixed(1)}h): ${postId}`);
        return;
    }
    // Daily limit check - atomic to prevent race conditions (max 5 breaking notifications per day)
    const db = admin.firestore();
    const canSend = await checkAndIncrementLimitAtomic(db, 'notif_daily_breaking', 5);
    if (!canSend) {
        v2_1.logger.log(`[BREAKING] Daily limit reached for breaking news. Skipping ${postId}`);
        return;
    }
    // Duplicate check
    const settingsRef = db.collection('settings').doc('notifications');
    const settingsDoc = await settingsRef.get();
    const lastSentMap = settingsDoc.exists ? (settingsDoc.data()?.lastSentNewsIdMap || {}) : {};
    if (lastSentMap['general'] === postId) {
        v2_1.logger.log(`[BREAKING] Already sent: ${postId}`);
        return;
    }
    const notifTitle = after.notificationTitle || after.headline?.telugu || after.headline?.english || after.headline || "తాజా వార్త";
    const shortBreaking = notifTitle.length > 50 ? notifTitle.substring(0, 50).trim() + "..." : notifTitle;
    const imageUrl = after.thumbnailUrl || after.mediaUrl || "";
    const breakingTitle = (tone === 'BREAKING' || after.isBreaking === true)
        ? `🔴 Breaking: ${shortBreaking}`
        : `⚡ ముఖ్య వార్త: ${shortBreaking}`;
    try {
        const news = { id: postId, ...after };
        // 1. Breaking news → all_users కి పంపు
        const message = buildNewsMessage(news, breakingTitle, "breaking_news", imageUrl, 1800000, // 30 min TTL
        { topic: 'all_users' });
        await admin.messaging().send(message);
        // 2. PERSONALIZATION: Category topic కి కూడా పంపు
        const category = after.category || after.categories?.[0] || "";
        if (category && category !== "జిల్లా వార్త") {
            const categoryTopic = getCategoryTopic(category);
            if (categoryTopic) {
                try {
                    const catTitle = notifTitle.length > 45 ? notifTitle.substring(0, 45).trim() + "..." : notifTitle;
                    const catMessage = buildNewsMessage(news, `📌 ${category}: ${catTitle}`, "general_news", imageUrl, 3600000, // 1 hour TTL for category
                    { topic: categoryTopic });
                    await admin.messaging().send(catMessage);
                    v2_1.logger.log(`[CAT_NOTIF] Sent to category topic: ${categoryTopic}`);
                }
                catch (catErr) {
                    v2_1.logger.error(`[CAT_NOTIF_ERR] ${categoryTopic}:`, catErr.message);
                }
            }
        }
        await settingsRef.set({
            lastSentNewsIdMap: { ...lastSentMap, general: postId },
            lastBreakingAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        v2_1.logger.log(`[BREAKING] ✅ Sent for ${postId} (tone=${after.tone}, age=${ageHours.toFixed(1)}h)`);
    }
    catch (err) {
        v2_1.logger.error(`[BREAKING_ERR] ${postId}:`, err.message);
    }
});
// ==========================================
// CATEGORY TOPIC NAME HELPER
// ==========================================
function getCategoryTopic(category) {
    return CATEGORY_TOPICS[category] || null;
}
//# sourceMappingURL=notification_engine.js.map
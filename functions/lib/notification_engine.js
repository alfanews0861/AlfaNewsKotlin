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
//    (Video ఉన్న చెత్త వార్త కంటే 100 views వున్న మంచి వార్త important)
//
// 3. Breaking trigger → isBreaking=true అయినప్పుడు వెంటనే push
// ==========================================
const DISTRICTS = [
    "హైదరాబాద్", "విశాఖపట్నం", "విజయవాడ", "గుంటూరు", "నెల్లూరు",
    "కర్నూలు", "వరంగల్", "ఖమ్మం", "కరీంనగర్", "నిజామాబాద్",
    "తిరుపతి", "అనంతపురం", "కడప", "కాకినాడ", "రాజమహేంద్రవరం"
];
// ==========================================
// TIME-BASED ENGAGING TITLES
// ==========================================
function getTitleForHour(hour, headline) {
    const short = headline.substring(0, 45).trim();
    if (hour === 8)
        return `☀️ శుభోదయం! ${short}...`;
    if (hour === 13)
        return `🔴 Breaking: ${short}...`;
    if (hour === 18)
        return `🌆 సాయంత్రం అప్‌డేట్: ${short}...`;
    if (hour === 21)
        return `🌙 రాత్రి వార్తలు: ${short}...`;
    return `📰 ${headline.substring(0, 60)}`;
}
// ==========================================
// SHARED: Build FCM data-only message
// ==========================================
function buildNewsMessage(news, title, channelId, imageUrl, ttlMs, topicOrToken) {
    const headline = news.headline?.telugu || news.headline?.english || news.headline || "";
    return {
        android: {
            priority: 'high',
            ttl: ttlMs,
            directBootOk: true,
        },
        data: {
            actionUrl: `alfanews://news/${news.id}`,
            newsId: news.id,
            channelId,
            imageUrl: imageUrl || "",
            title,
            body: (headline + "").substring(0, 150),
        },
        ...topicOrToken,
    };
}
// ==========================================
// DAILY NOTIFICATION LIMIT — max 4/day
// ==========================================
async function getDailySentCount(db) {
    const today = new Date().toISOString().split('T')[0];
    const doc = await db.collection('settings').doc('notif_daily').get();
    const data = doc.data();
    if (!data || data.date !== today)
        return 0;
    return data.count || 0;
}
async function incrementDailySentCount(db) {
    const today = new Date().toISOString().split('T')[0];
    await db.collection('settings').doc('notif_daily').set({
        date: today,
        count: admin.firestore.FieldValue.increment(1),
    }, { merge: true });
}
// ==========================================
// SCHEDULED NOTIFICATIONS — 4 times/day
// Ranking: notificationWorthy=true వార్తలలో highest longViews
// Media bonus వద్దు — views మాత్రమే ranking decide చేస్తాయి
// ==========================================
exports.sendPersonalizedNotification = (0, scheduler_1.onSchedule)({
    schedule: "0 8,13,18,21 * * *",
    timeZone: "Asia/Kolkata",
    timeoutSeconds: 540,
    memory: "1GiB"
}, async (event) => {
    const db = admin.firestore();
    // Daily limit check
    const dailyCount = await getDailySentCount(db);
    if (dailyCount >= 4) {
        v2_1.logger.log(`[NOTIF] Daily limit reached (${dailyCount}/4). Skipping.`);
        return;
    }
    const settingsRef = db.collection('settings').doc('notifications');
    const settingsDoc = await settingsRef.get();
    const lastSentMap = settingsDoc.exists ? (settingsDoc.data()?.lastSentNewsIdMap || {}) : {};
    const updatedMap = { ...lastSentMap };
    const istHour = parseInt(new Intl.DateTimeFormat('en-GB', {
        hour: 'numeric',
        hour12: false,
        timeZone: 'Asia/Kolkata'
    }).format(new Date()));
    v2_1.logger.log(`[NOTIF] Scheduled run at IST Hour: ${istHour}`);
    const windowMillis = 24 * 60 * 60 * 1000;
    const sinceTime = new Date(Date.now() - windowMillis);
    // ✅ Filter: notificationWorthy=true వార్తలు మాత్రమే fetch చేస్తాం
    // (AI processing time లోనే set అయింది)
    const newsSnapshot = await db.collection('news')
        .where('approved', '==', true)
        .where('notificationWorthy', '==', true)
        .where('timestamp', '>', sinceTime)
        .get();
    if (newsSnapshot.empty) {
        v2_1.logger.log(`[NOTIF] No notificationWorthy news found in last 24h.`);
        return;
    }
    // ✅ Ranking: pure longViews sort — media bonus వద్దు
    // Video ఉన్న చెత్త వార్త కంటే views ఎక్కువ వున్న మంచి వార్త ముందు వస్తుంది
    const allNews = newsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
        const viewsA = a.longViews || a.views || 0;
        const viewsB = b.longViews || b.views || 0;
        return viewsB - viewsA;
    });
    // --- 1. General Notification — అన్ని 4 scheduled slots (8, 13, 18, 21) కి పంపు ---
    // BUG FIX: ముందు `istHour % 2 === 0` వాడేవారు → 8 & 18 మాత్రమే వెళ్ళేవి, 13 & 21 skip అయ్యేవి
    const topNews = allNews[0];
    if (topNews && lastSentMap['general'] !== topNews.id) {
        const headline = topNews.headline?.telugu || topNews.headline?.english || topNews.headline || "నేటి ముఖ్య వార్తలు";
        let imageUrl = topNews.thumbnailUrl || "";
        if (!imageUrl && topNews.mediaUrl) {
            imageUrl = (await (0, utils_1.createAndSaveThumbnail)(topNews.mediaUrl, topNews.id)) || topNews.mediaUrl;
            if (imageUrl && imageUrl !== topNews.mediaUrl) {
                await db.collection('news').doc(topNews.id).update({ thumbnailUrl: imageUrl }).catch(() => { });
            }
        }
        const message = buildNewsMessage(topNews, getTitleForHour(istHour, headline), "general_news", imageUrl, 3600000, // 1 hour TTL
        { topic: 'all_users' });
        await admin.messaging().send(message);
        updatedMap['general'] = topNews.id;
        await incrementDailySentCount(db);
        v2_1.logger.log(`[NOTIF] General sent: newsId=${topNews.id}, views=${topNews.longViews || 0}, hour=${istHour}`);
    }
    else {
        v2_1.logger.log(`[NOTIF] General skipped — same news already sent or no news found. newsId=${topNews?.id}`);
    }
    // --- 2. District Notification — 13 PM మరియు 21 PM slots కి extra district push ---
    if (istHour === 13 || istHour === 21) {
        for (const district of DISTRICTS) {
            const districtNews = allNews.find((n) => (Array.isArray(n.categories) && n.categories.includes(district)) ||
                n.district === district);
            if (!districtNews || lastSentMap[district] === districtNews.id)
                continue;
            const headline = districtNews.headline?.telugu || `${district} తాజా వార్త`;
            let imageUrl = districtNews.thumbnailUrl || "";
            if (!imageUrl && districtNews.mediaUrl) {
                imageUrl = (await (0, utils_1.createAndSaveThumbnail)(districtNews.mediaUrl, districtNews.id)) || districtNews.mediaUrl;
                if (imageUrl && imageUrl !== districtNews.mediaUrl) {
                    await db.collection('news').doc(districtNews.id).update({ thumbnailUrl: imageUrl }).catch(() => { });
                }
            }
            const topicName = (0, utils_1.getTopicName)("district", district);
            try {
                const message = buildNewsMessage(districtNews, `📍 ${district}: ${headline.substring(0, 40)}...`, "local_news", imageUrl, 7200000, // 2 hour TTL
                { topic: topicName });
                await admin.messaging().send(message);
                updatedMap[district] = districtNews.id;
                v2_1.logger.log(`[NOTIF] District ${district}: newsId=${districtNews.id}, views=${districtNews.longViews || 0}`);
            }
            catch (e) {
                v2_1.logger.error(`[NOTIF] Error in topic ${topicName}:`, e);
            }
        }
    }
    await settingsRef.set({
        lastSentNewsIdMap: updatedMap,
        lastRunAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
});
// ==========================================
// BREAKING NEWS INSTANT TRIGGER
// isBreaking=true → news approved అయిన వెంటనే notification
// AI processing లోనే isBreaking set అయింది — ఇక్కడ recalculate వద్దు
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
    // ✅ Breaking trigger: isBreaking=true OR tone=BREAKING/URGENT అయినా notify చేయి
    // BUG FIX: ముందు isBreaking=true మాత్రమే trigger అయ్యేది — AI చాలా rarely true set చేస్తోంది
    // tone=URGENT వార్తలు కూడా important — users కి వెళ్ళాలి
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
    // Daily limit check
    const db = admin.firestore();
    const dailyCount = await getDailySentCount(db);
    if (dailyCount >= 4) {
        v2_1.logger.log(`[BREAKING] Daily limit reached (${dailyCount}/4). Skipping ${postId}`);
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
    const headline = after.headline?.telugu || after.headline?.english || after.headline || "తాజా వార్త";
    const imageUrl = after.thumbnailUrl || after.mediaUrl || "";
    // Title: tone బట్టి (tone already computed above)
    const breakingTitle = (tone === 'BREAKING' || after.isBreaking === true)
        ? `🔴 Breaking: ${headline.substring(0, 50)}...`
        : `⚡ ముఖ్య వార్త: ${headline.substring(0, 45)}...`;
    try {
        const news = { id: postId, ...after };
        // 1. Breaking news → all_users కి పంపు (everyone gets breaking news)
        const message = buildNewsMessage(news, breakingTitle, "breaking_news", imageUrl, 1800000, // 30 min TTL
        { topic: 'all_users' });
        await admin.messaging().send(message);
        // 2. ✅ PERSONALIZATION: Category topic కి కూడా పంపు
        // Users తమ interested categories subscribe చేసుకుంటారు (Android side)
        // cat_politics, cat_cinema, cat_sports, cat_crime... etc.
        const category = after.category || after.categories?.[0] || "";
        if (category && category !== "జిల్లా వార్త") {
            const categoryTopic = getCategoryTopic(category);
            if (categoryTopic) {
                try {
                    const catMessage = buildNewsMessage(news, `📌 ${category}: ${headline.substring(0, 45)}...`, "general_news", imageUrl, 3600000, // 1 hour TTL for category
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
        await incrementDailySentCount(db);
        v2_1.logger.log(`[BREAKING] ✅ Sent for ${postId} (tone=${after.tone}, age=${ageHours.toFixed(1)}h)`);
    }
    catch (err) {
        v2_1.logger.error(`[BREAKING_ERR] ${postId}:`, err.message);
    }
});
// ==========================================
// CATEGORY TOPIC NAME HELPER
// Telugu category → safe FCM topic name
// ==========================================
function getCategoryTopic(category) {
    const map = {
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
    return map[category] || null;
}
//# sourceMappingURL=notification_engine.js.map
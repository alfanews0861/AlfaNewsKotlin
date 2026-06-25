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
// Persistent tracking via Firestore instead of in-memory map
// settings/notifications { lastSentNewsIdMap: { districtName: newsId, general: newsId } }
const DISTRICTS = [
    "హైదరాబాద్", "విశాఖపట్నం", "విజయవాడ", "గుంటూరు", "నెల్లూరు",
    "కర్నూలు", "వరంగల్", "ఖమ్మం", "కరీంనగర్", "నిజామాబాద్",
    "తిరుపతి", "అనంతపురం", "కడప", "కాకినాడ", "రాజమహేంద్రవరం"
];
exports.sendPersonalizedNotification = (0, scheduler_1.onSchedule)({
    schedule: "0 8,13,18,21 * * *",
    timeZone: "Asia/Kolkata",
    timeoutSeconds: 540,
    memory: "1GiB"
}, async (event) => {
    const db = admin.firestore();
    // Fetch persistent tracking data
    const settingsRef = db.collection('settings').doc('notifications');
    const settingsDoc = await settingsRef.get();
    const lastSentMap = settingsDoc.exists ? (settingsDoc.data()?.lastSentNewsIdMap || {}) : {};
    const updatedMap = { ...lastSentMap };
    const istHour = parseInt(new Intl.DateTimeFormat('en-GB', {
        hour: 'numeric',
        hour12: false,
        timeZone: 'Asia/Kolkata'
    }).format(new Date()));
    v2_1.logger.log(`Notification run started at IST Hour: ${istHour}`);
    const windowMillis = 24 * 60 * 60 * 1000;
    const sinceTime = new Date(Date.now() - windowMillis);
    const newsSnapshot = await db.collection('news')
        .where('approved', '==', true)
        .where('timestamp', '>', sinceTime)
        .get();
    if (newsSnapshot.empty)
        return;
    const allNews = newsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // --- 1. జనరల్ నోటిఫికేషన్ (ప్రతి 2 గంటలకు - సరి గంటలలో) ---
    if (istHour % 2 === 0) {
        const topNews = allNews.sort((a, b) => (b.score || 0) - (a.score || 0))[0];
        if (topNews && lastSentMap['general'] !== topNews.id) {
            const headline = topNews.headline?.telugu || topNews.headline?.english || topNews.headline || "నేటి ముఖ్య వార్తలు";
            const imageUrl = topNews.mediaUrl || "";
            await admin.messaging().send({
                notification: {
                    title: '🌟 తాజా ముఖ్య వార్తలు (AlfaNews)',
                    body: (headline + "").substring(0, 150)
                },
                android: {
                    notification: {
                        imageUrl: imageUrl
                    }
                },
                data: {
                    actionUrl: `alfanews://news/${topNews.id}`,
                    newsId: topNews.id,
                    channelId: "general_news",
                    imageUrl: imageUrl,
                    title: '🌟 తాజా ముఖ్య వార్తలు (AlfaNews)',
                    body: (headline + "").substring(0, 150)
                },
                topic: 'all_users'
            });
            updatedMap['general'] = topNews.id;
            v2_1.logger.log(`[NOTIF] Broadcasted general top news.`);
        }
    }
    // --- 2. జిల్లా నోటిఫికేషన్ (ప్రతి 4 గంటలకు - 1, 5, 9, 13, 17, 21 గంటలలో) ---
    else if ((istHour - 1) % 4 === 0) {
        for (const district of DISTRICTS) {
            const districtNews = allNews
                .filter((n) => (Array.isArray(n.categories) && n.categories.includes(district)) || n.district === district)
                .sort((a, b) => (b.score || 0) - (a.score || 0))[0];
            if (!districtNews || lastSentMap[district] === districtNews.id)
                continue;
            const headline = districtNews.headline?.telugu || `${district} తాజా వార్త`;
            const imageUrl = districtNews.mediaUrl || "";
            // ✅ TOPIC BASED: జిల్లా టాపిక్ కి పంపుతాం
            const topicName = `district_${district.replace(/\s+/g, '_')}`;
            try {
                await admin.messaging().send({
                    notification: {
                        title: `📍 ${district} తాజా వార్త`,
                        body: (headline + "").substring(0, 150)
                    },
                    android: {
                        notification: {
                            imageUrl: imageUrl
                        }
                    },
                    data: {
                        actionUrl: `alfanews://news/${districtNews.id}`,
                        newsId: districtNews.id,
                        channelId: "local_news",
                        imageUrl: imageUrl,
                        title: `📍 ${district} తాజా వార్త`,
                        body: (headline + "").substring(0, 150)
                    },
                    topic: topicName
                });
                updatedMap[district] = districtNews.id;
                v2_1.logger.log(`[NOTIF] Sent to district topic: ${topicName}`);
            }
            catch (e) {
                v2_1.logger.error(`[NOTIF] Error in topic ${topicName}:`, e);
            }
        }
    }
    // Save updated tracking map to Firestore
    await settingsRef.set({
        lastSentNewsIdMap: updatedMap,
        lastRunAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
});
//# sourceMappingURL=notification_engine.js.map
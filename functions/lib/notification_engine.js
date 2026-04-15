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
// రోజుకు 4 సార్లు మాత్రమే రన్ అయ్యేలా షెడ్యూల్ చేయడం (ఉదయం 8, మధ్యాహ్నం 1, సాయంత్రం 6, రాత్రి 9)
exports.sendPersonalizedNotification = (0, scheduler_1.onSchedule)({
    schedule: "0 8,13,18,21 * * *",
    timeZone: "Asia/Kolkata",
    timeoutSeconds: 540, // 9 mins limit for processing
    memory: "1GiB"
}, async (event) => {
    const db = admin.firestore();
    // 1. గత 8 గంటల్లో పోస్ట్ చేసిన వార్తలను తెచ్చుకోవడం
    const eightHoursAgo = Date.now() - (8 * 60 * 60 * 1000);
    const newsSnapshot = await db.collection('news')
        .where('timestamp', '>', eightHoursAgo)
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();
    if (newsSnapshot.empty) {
        v2_1.logger.log("గత 8 గంటల్లో కొత్త వార్తలు లేవు.");
        return;
    }
    // 2. వార్తలను ఫిల్టర్ చేసి, కేటగిరీల వారీగా బెస్ట్ (లేటెస్ట్) వార్తను ఎంచుకోవడం
    const bestNewsByCategory = new Map();
    newsSnapshot.docs.forEach(doc => {
        const news = doc.data();
        news.id = doc.id;
        // నెగటివ్ సిగ్నల్స్ ఎక్కువగా ఉంటే స్కిప్ (ఉదా: రిపోర్ట్స్ వస్తే)
        if (news.negativeRatio && news.negativeRatio > 0.5)
            return;
        const category = news.category || (news.categories && news.categories.length > 0 ? news.categories[0] : null);
        if (!category)
            return;
        // కేటగిరీకి ఒక లేటెస్ట్ వార్తను మాత్రమే సేవ్ చేయడం
        if (!bestNewsByCategory.has(category)) {
            bestNewsByCategory.set(category, news);
        }
    });
    if (bestNewsByCategory.size === 0) {
        v2_1.logger.log("నోటిఫికేషన్ పంపడానికి తగిన వార్తలు లేవు.");
        return;
    }
    // 3. ఒక్కో యూజర్ కి ఒకే టైమ్ లో మల్టిపుల్ నోటిఫికేషన్లు వెళ్లకుండా (స్పామ్ అవ్వకుండా) ట్రాక్ చేయడానికి
    const notifiedUserIds = new Set();
    const messages = [];
    for (const [category, news] of bestNewsByCategory.entries()) {
        // ఆ కేటగిరీలో ఆసక్తి ఉన్న యూజర్లను కనుక్కోవడం
        const usersSnapshot = await db.collection('users')
            .where(`categoryScores.${category}`, '>', 0)
            .get();
        usersSnapshot.docs.forEach(doc => {
            const userId = doc.id;
            // ఈ సైకిల్ లో ఇప్పటికే ఆ యూజర్ కి నోటిఫికేషన్ సిద్ధం చేసి ఉంటే స్కిప్
            if (notifiedUserIds.has(userId))
                return;
            const user = doc.data();
            // షాడో మోడ్ చెక్ (యాక్టివ్ గా లేని వాళ్ళకి పంపకుండా)
            if (user.shadowMode === true)
                return;
            const tokens = [];
            if (user.fcmToken && !tokens.includes(user.fcmToken)) {
                tokens.push(user.fcmToken);
            }
            if (user.fcmTokens && Array.isArray(user.fcmTokens)) {
                for (const t of user.fcmTokens) {
                    if (t && typeof t === 'string' && !tokens.includes(t)) {
                        tokens.push(t);
                    }
                }
            }
            if (tokens.length > 0) {
                // యూజర్ ని పంపిన జాబితాలో చేర్చడం
                notifiedUserIds.add(userId);
                tokens.forEach(token => {
                    messages.push({
                        token: token,
                        notification: {
                            title: 'మీ కోసం ప్రత్యేక వార్త!',
                            body: news.headline?.telugu || 'మీకు నచ్చిన కేటగిరీలో తాజా వార్త.'
                        },
                        data: {
                            actionUrl: `alfanews://news/${news.id}`,
                            newsId: news.id,
                            channelId: "personalized_news"
                        }
                    });
                });
            }
        });
    }
    // 4. బ్యాచ్ ల వారీగా నోటిఫికేషన్లను పంపడం (FCM limit is 500 messages per batch)
    if (messages.length > 0) {
        const batchSize = 500;
        let successCount = 0;
        let failureCount = 0;
        for (let i = 0; i < messages.length; i += batchSize) {
            const batch = messages.slice(i, i + batchSize);
            const results = await admin.messaging().sendEach(batch);
            successCount += results.successCount;
            failureCount += results.failureCount;
        }
        v2_1.logger.log(`Notifications sent. Success: ${successCount}, Failures: ${failureCount}`);
    }
    else {
        v2_1.logger.log("నోటిఫికేషన్లు పంపడానికి యూజర్లు ఎవరూ లేరు.");
    }
});
//# sourceMappingURL=notification_engine.js.map
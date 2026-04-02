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
const firestore_1 = require("firebase-functions/v2/firestore");
const v2_1 = require("firebase-functions/v2");
// ఇంట్రెస్ట్ ఆధారంగా నోటిఫికేషన్ ట్రిగ్గర్ చేయడం
exports.sendPersonalizedNotification = (0, firestore_1.onDocumentCreated)('news/{newsId}', async (event) => {
    if (!event.data)
        return;
    const news = event.data.data();
    const category = news?.category;
    const categories = news?.categories || [];
    const newsId = event.params.newsId;
    // 1. నెగటివ్ రేషియో ఫిల్టర్ (50% కంటే ఎక్కువ నెగటివ్ సిగ్నల్స్ ఉంటే పంపకూడదు)
    if (news?.negativeRatio && news.negativeRatio > 0.5) {
        v2_1.logger.log(`News ${newsId} is skipped due to high negative ratio.`);
        return;
    }
    // 2. యూజర్ ఇంట్రెస్ట్ మ్యాపింగ్ మరియు షాడో మోడ్ చెక్
    const usersRef = admin.firestore().collection('users');
    // ఒకవేళ ప్రధాన కేటగిరీ ఉంటే దాంతో సెర్చ్ చేయాలి, లేదంటే లిస్ట్ లోని మొదటి దానితో
    const targetCategory = category || (categories.length > 0 ? categories[0] : null);
    if (!targetCategory) {
        v2_1.logger.log(`News ${newsId} has no categories. Skipping notification.`);
        return;
    }
    const users = await usersRef.where(`categoryScores.${targetCategory}`, '>', 0).get();
    const tokens = [];
    for (const doc of users.docs) {
        const userData = doc.data();
        // 3. షాడో మోడ్ చెక్ (వరుసగా క్లిక్ చేయకపోతే)
        if (userData.shadowMode === true) {
            v2_1.logger.log(`User ${doc.id} is in Shadow Mode. Skipping.`);
            continue;
        }
        if (userData.fcmToken && !tokens.includes(userData.fcmToken)) {
            tokens.push(userData.fcmToken);
        }
        if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
            for (const t of userData.fcmTokens) {
                if (t && typeof t === 'string' && !tokens.includes(t)) {
                    tokens.push(t);
                }
            }
        }
    }
    if (tokens.length > 0) {
        const message = {
            notification: {
                title: 'మీ కోసం ప్రత్యేక వార్త!',
                body: news?.headline?.telugu || 'మీకు నచ్చిన కేటగిరీలో తాజా వార్త.'
            },
            data: {
                actionUrl: `alfanews://news/${newsId}`,
                newsId: newsId
            },
            tokens: tokens
        };
        // 4. sendMulticast కి బదులుగా sendEachForMulticast వాడాలి
        return admin.messaging().sendEachForMulticast(message);
    }
    return;
});
//# sourceMappingURL=notification_engine.js.map
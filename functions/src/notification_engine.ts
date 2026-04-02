import * as admin from 'firebase-admin';
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";

// ఇంట్రెస్ట్ ఆధారంగా నోటిఫికేషన్ ట్రిగ్గర్ చేయడం
export const sendPersonalizedNotification = onDocumentCreated('news/{newsId}', async (event) => {
    if (!event.data) return;

    const news = event.data.data();
    const category = news?.category;
    const categories = news?.categories || [];
    const newsId = event.params.newsId;

    // 1. నెగటివ్ రేషియో ఫిల్టర్ (50% కంటే ఎక్కువ నెగటివ్ సిగ్నల్స్ ఉంటే పంపకూడదు)
    if (news?.negativeRatio && news.negativeRatio > 0.5) {
        logger.log(`News ${newsId} is skipped due to high negative ratio.`);
        return;
    }

    // 2. యూజర్ ఇంట్రెస్ట్ మ్యాపింగ్ మరియు షాడో మోడ్ చెక్
    const usersRef = admin.firestore().collection('users');

    // ఒకవేళ ప్రధాన కేటగిరీ ఉంటే దాంతో సెర్చ్ చేయాలి, లేదంటే లిస్ట్ లోని మొదటి దానితో
    const targetCategory = category || (categories.length > 0 ? categories[0] : null);

    if (!targetCategory) {
        logger.log(`News ${newsId} has no categories. Skipping notification.`);
        return;
    }

    const users = await usersRef.where(`categoryScores.${targetCategory}`, '>', 0).get();

    const tokens: string[] = [];
    for (const doc of users.docs) {
        const userData = doc.data();

        // 3. షాడో మోడ్ చెక్ (వరుసగా క్లిక్ చేయకపోతే)
        if (userData.shadowMode === true) {
            logger.log(`User ${doc.id} is in Shadow Mode. Skipping.`);
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

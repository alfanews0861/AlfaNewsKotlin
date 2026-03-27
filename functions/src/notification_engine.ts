import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

// ఇంట్రెస్ట్ ఆధారంగా నోటిఫికేషన్ ట్రిగ్గర్ చేయడం
export const sendPersonalizedNotification = functions.firestore
    .document('news/{newsId}')
    .onCreate(async (snap, context) => {
        const news = snap.data();
        const category = news.category;
        const newsId = context.params.newsId;

        // 1. నెగటివ్ రేషియో ఫిల్టర్ (50% కంటే ఎక్కువ నెగటివ్ సిగ్నల్స్ ఉంటే పంపకూడదు)
        if (news.negativeRatio && news.negativeRatio > 0.5) {
            console.log(`News ${newsId} is skipped due to high negative ratio.`);
            return null;
        }

        // 2. యూజర్ ఇంట్రెస్ట్ మ్యాపింగ్ మరియు షాడో మోడ్ చెక్
        const usersRef = admin.firestore().collection('users');
        // ఇక్కడ ఆప్టిమైజ్డ్ క్వెరీ వాడాలి, కానీ ఫైర్‌బేస్ పరిమితుల వల్ల అన్నింటినీ తెచ్చి క్లయింట్ సైడ్ ఫిల్టర్ చేస్తున్నాం
        const users = await usersRef.where(`interests.${category}`, '>', 0).get();

        const tokens: string[] = [];
        for (const doc of users.docs) {
            const userData = doc.data();

            // 3. షాడో మోడ్ చెక్ (వరుసగా క్లిక్ చేయకపోతే)
            if (userData.shadowMode === true) {
                console.log(`User ${doc.id} is in Shadow Mode. Skipping.`);
                continue;
            }

            if (userData.fcmToken) {
                tokens.push(userData.fcmToken);
            }
        }

        if (tokens.length > 0) {
            const message = {
                notification: {
                    title: 'మీ కోసం ప్రత్యేక వార్త!',
                    body: news.title || 'మీకు నచ్చిన కేటగిరీలో తాజా వార్త.'
                },
                tokens: tokens
            };
            return admin.messaging().sendMulticast(message);
        }
        return null;
    });

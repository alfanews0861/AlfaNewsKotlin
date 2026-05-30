import * as admin from 'firebase-admin';
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";

// చివరిగా పంపిన వార్తలను ట్రాక్ చేయడానికి
const lastSentNewsIdMap = new Map<string, string>();

const DISTRICTS = [
    "హైదరాబాద్", "విశాఖపట్నం", "విజయవాడ", "గుంటూరు", "నెల్లూరు",
    "కర్నూలు", "వరంగల్", "ఖమ్మం", "కరీంనగర్", "నిజామాబాద్",
    "తిరుపతి", "అనంతపురం", "కడప", "కాకినాడ", "రాజమహేంద్రవరం"
];

export const sendPersonalizedNotification = onSchedule({
    schedule: "0 0,1,2,4,5,6,8,9,10,12,13,14,16,17,18,20,21,22 * * *",
    timeZone: "Asia/Kolkata",
    timeoutSeconds: 540,
    memory: "1GiB"
}, async (event) => {
    const db = admin.firestore();

    const istHour = parseInt(new Intl.DateTimeFormat('en-GB', {
        hour: 'numeric',
        hour12: false,
        timeZone: 'Asia/Kolkata'
    }).format(new Date()));

    logger.log(`Notification run started at IST Hour: ${istHour}`);

    const windowMillis = 24 * 60 * 60 * 1000;
    const sinceTime = new Date(Date.now() - windowMillis);

    const newsSnapshot = await db.collection('news')
        .where('approved', '==', true)
        .where('timestamp', '>', sinceTime)
        .get();

    if (newsSnapshot.empty) return;
    const allNews = newsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

    // --- 1. జనరల్ నోటిఫికేషన్ (ప్రతి 2 గంటలకు - సరి గంటలలో) ---
    if (istHour % 2 === 0) {
        const topNews = allNews.sort((a: any, b: any) => (b.score || 0) - (a.score || 0))[0];
        if (topNews && lastSentNewsIdMap.get('general') !== topNews.id) {
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
            lastSentNewsIdMap.set('general', topNews.id);
            logger.log(`[NOTIF] Broadcasted general top news.`);
        }
    }
    // --- 2. జిల్లా నోటిఫికేషన్ (ప్రతి 4 గంటలకు - 1, 5, 9, 13, 17, 21 గంటలలో) ---
    else if ((istHour - 1) % 4 === 0) {
        for (const district of DISTRICTS) {
            const districtNews = allNews
                .filter((n: any) => (Array.isArray(n.categories) && n.categories.includes(district)) || n.district === district)
                .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))[0];

            if (!districtNews || lastSentNewsIdMap.get(district) === districtNews.id) continue;

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
                lastSentNewsIdMap.set(district, districtNews.id);
                logger.log(`[NOTIF] Sent to district topic: ${topicName}`);
            } catch (e) {
                logger.error(`[NOTIF] Error in topic ${topicName}:`, e);
            }
        }
    }
});

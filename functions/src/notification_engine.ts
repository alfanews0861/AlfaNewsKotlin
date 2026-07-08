import * as admin from 'firebase-admin';
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { getTopicName } from './utils';

// Persistent tracking via Firestore instead of in-memory map
// settings/notifications { lastSentNewsIdMap: { districtName: newsId, general: newsId } }

const DISTRICTS = [
    "హైదరాబాద్", "విశాఖపట్నం", "విజయవాడ", "గుంటూరు", "నెల్లూరు",
    "కర్నూలు", "వరంగల్", "ఖమ్మం", "కరీంనగర్", "నిజామాబాద్",
    "తిరుపతి", "అనంతపురం", "కడప", "కాకినాడ", "రాజమహేంద్రవరం"
];

export const sendPersonalizedNotification = onSchedule({
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
        // Rich Content ప్రాధాన్యత: స్కోరు ఎక్కువగా ఉండి, ఫోటో ఉన్న వార్తలను ముందుగా ఎంచుకుంటాం
        const topNews = allNews.sort((a: any, b: any) => {
            const scoreA = (a.score || 0) + (a.mediaUrl ? 100 : 0);
            const scoreB = (b.score || 0) + (b.mediaUrl ? 100 : 0);
            return scoreB - scoreA;
        })[0];

        if (topNews && lastSentMap['general'] !== topNews.id) {
            const headline = topNews.headline?.telugu || topNews.headline?.english || topNews.headline || "నేటి ముఖ్య వార్తలు";
            const imageUrl = topNews.mediaUrl || "";

            const message: admin.messaging.Message = {
                notification: {
                    title: '🌟 తాజా ముఖ్య వార్తలు (AlfaNews)',
                    body: (headline + "").substring(0, 150)
                },
                android: {
                    notification: {
                        imageUrl: imageUrl,
                        priority: 'high',
                        channelId: 'general_news',
                        clickAction: 'FLUTTER_NOTIFICATION_CLICK' // For consistency if needed, but we use actionUrl
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
            };

            await admin.messaging().send(message);
            updatedMap['general'] = topNews.id;
            logger.log(`[NOTIF] Broadcasted general top news with ID: ${topNews.id}`);
        }
    }
    // --- 2. జిల్లా నోటిఫికేషన్ (ప్రతి 4 గంటలకు - 1, 5, 9, 13, 17, 21 గంటలలో) ---
    else if ((istHour - 1) % 4 === 0) {
        for (const district of DISTRICTS) {
            const districtNews = allNews
                .filter((n: any) => (Array.isArray(n.categories) && n.categories.includes(district)) || n.district === district)
                .sort((a: any, b: any) => {
                    const scoreA = (a.score || 0) + (a.mediaUrl ? 100 : 0);
                    const scoreB = (b.score || 0) + (b.mediaUrl ? 100 : 0);
                    return scoreB - scoreA;
                })[0];

            if (!districtNews || lastSentMap[district] === districtNews.id) continue;

            const headline = districtNews.headline?.telugu || `${district} తాజా వార్త`;
            const imageUrl = districtNews.mediaUrl || "";

            // ✅ TOPIC BASED: జిల్లా టాపిక్ కి పంపుతాం (సురక్షితమైన పేరుతో)
            const topicName = getTopicName("district", district);

            try {
                const message: admin.messaging.Message = {
                    notification: {
                        title: `📍 ${district} తాజా వార్త`,
                        body: (headline + "").substring(0, 150)
                    },
                    android: {
                        notification: {
                            imageUrl: imageUrl,
                            priority: 'high',
                            channelId: 'local_news'
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
                };

                await admin.messaging().send(message);
                updatedMap[district] = districtNews.id;
                logger.log(`[NOTIF] Sent to district topic: ${topicName}, newsId: ${districtNews.id}`);
            } catch (e) {
                logger.error(`[NOTIF] Error in topic ${topicName}:`, e);
            }
        }
    }

    // Save updated tracking map to Firestore
    await settingsRef.set({
        lastSentNewsIdMap: updatedMap,
        lastRunAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
});

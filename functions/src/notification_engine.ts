import * as admin from 'firebase-admin';
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { getTopicName, createAndSaveThumbnail, REGION } from './utils';

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

const CATEGORY_TOPICS: Record<string, string> = {
    "రాజకీయం":    "cat_politics",
    "వినోదం":     "cat_cinema",
    "క్రైమ్":     "cat_crime",
    "క్రీడలు":    "cat_sports",
    "వ్యాపారం":   "cat_business",
    "టెక్నాలజీ": "cat_technology",
    "ఆరోగ్యం":   "cat_health",
    "విద్య":      "cat_education",
    "భక్తి":      "cat_spiritual",
    "వ్యవసాయం":  "cat_agriculture",
    "జాతీయం":    "cat_national",
    "ప్రపంచం":   "cat_international",
    "జీవనశైలి":  "cat_lifestyle",
};

// ==========================================
// TIME-BASED ENGAGING TITLES
// ==========================================
function getTitleForHour(hour: number, headline: string, curiosityTitle?: string): string {
    if (curiosityTitle && curiosityTitle.trim().length > 0) {
        const raw = curiosityTitle.trim();
        const short = raw.length > 55 ? raw.substring(0, 55).trim() + "..." : raw;
        if (hour === 8)  return `☀️ ${short}`;
        if (hour === 13) return `⚡ ${short}`;
        if (hour === 18) return `🌆 ${short}`;
        if (hour === 21) return `🌙 ${short}`;
        return `📰 ${short}`;
    }
    const raw = headline.trim();
    const short = raw.length > 45 ? raw.substring(0, 45).trim() + "..." : raw;
    if (hour === 8)  return `☀️ శుభోదయం: ${short}`;
    if (hour === 13) return `🔴 తాజా వార్త: ${short}`;
    if (hour === 18) return `🌆 సాయంత్రం అప్‌డేట్: ${short}`;
    if (hour === 21) return `🌙 రాత్రి వార్తలు: ${short}`;
    return `📰 ${short}`;
}

// ==========================================
// SHARED: Build FCM message with notification & data payloads
// ==========================================
function buildNewsMessage(
    news: any,
    title: string,
    channelId: string,
    imageUrl: string,
    ttlMs: number,
    topicOrToken: { topic: string } | { token: string }
): admin.messaging.Message {
    const headline = news.headline?.telugu || news.headline?.english || news.headline || "";
    const body = (headline + "").substring(0, 150);
    // 🛡️ 100% Ironclad Cost & Egress Guard:
    // 1. External CDN (Eenadu, Sakshi, YouTube, TV9) -> 0 Firebase egress cost (bandwidth is on external CDN).
    // 2. Firebase Storage -> Block completely from system drawer to guarantee EXACTLY ₹0 / $0 Firebase Storage egress bill!
    let safeDrawerImageUrl: string | undefined = undefined;
    if (imageUrl && imageUrl.trim()) {
        const isFirebaseStorage = imageUrl.includes('firebasestorage.googleapis.com');
        if (!isFirebaseStorage && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
            // External CDN: 100% Safe, ₹0 Firebase Cost
            safeDrawerImageUrl = imageUrl;
        } else {
            // Firebase Storage: Guaranteed ₹0 Egress by omitting from broadcast drawer
            safeDrawerImageUrl = undefined;
        }
    }

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
            newsId:    news.id,
            channelId,
            imageUrl:  imageUrl || "",
            title,
            body,
        },
        ...topicOrToken,
    };
}

// ==========================================
// ATOMIC DAILY LIMIT CHECK FOR BREAKING NEWS
// ==========================================
async function checkAndIncrementLimitAtomic(db: admin.firestore.Firestore, docName: string, limit: number): Promise<boolean> {
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
export const sendPersonalizedNotification = onSchedule({
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

    logger.log(`[NOTIF] Scheduled run started at IST Hour: ${istHour}`);

    const windowMillis = 24 * 60 * 60 * 1000;
    const sinceTime = new Date(Date.now() - windowMillis);

    // 1. Fetch news: notificationWorthy=true వార్తలు
    let allNews: any[] = [];
    const newsSnapshot = await db.collection('news')
        .where('approved', '==', true)
        .where('notificationWorthy', '==', true)
        .where('timestamp', '>', sinceTime)
        .get();

    if (newsSnapshot.empty) {
        // Fallback: If AI hasn't explicitly set notificationWorthy=true, check approved news in last 24h
        logger.log(`[NOTIF] No explicit notificationWorthy=true news. Checking fallback approved news...`);
        const fallbackSnapshot = await db.collection('news')
            .where('approved', '==', true)
            .where('timestamp', '>', sinceTime)
            .get();

        const validDocs = fallbackSnapshot.docs.filter(d => d.data().notificationWorthy !== false);
        allNews = validDocs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
        allNews = newsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    if (allNews.length === 0) {
        logger.log(`[NOTIF] No approved news found in last 24h. Exiting.`);
        return;
    }

    // Ranking: pure longViews / views sort descending
    allNews.sort((a: any, b: any) => {
        const viewsA = a.longViews || a.views || 0;
        const viewsB = b.longViews || b.views || 0;
        return viewsB - viewsA;
    });

    // --- 1. General Notification — అన్ని 4 scheduled slots (8, 13, 18, 21) కి పంపు ---
    // Unsent news ని find చేస్తాం (ముందు పంపిన topNews కాకుండా next best news)
    const topNews = allNews.find((n: any) => lastSentMap['general'] !== n.id) || allNews[0];

    if (topNews && lastSentMap['general'] !== topNews.id) {
        const headline = topNews.headline?.telugu || topNews.headline?.english || topNews.headline || "నేటి ముఖ్య వార్తలు";
        const curiosityTitle = topNews.notificationTitle || "";
        let imageUrl = topNews.thumbnailUrl || "";
        if (!imageUrl && topNews.mediaUrl) {
            imageUrl = (await createAndSaveThumbnail(topNews.mediaUrl, topNews.id)) || topNews.mediaUrl;
        }

        try {
            const message = buildNewsMessage(
                topNews,
                getTitleForHour(istHour, headline, curiosityTitle),
                "general_news_v2",
                imageUrl,
                21600000, // 6 hour TTL (better delivery for offline/doze devices)
                { topic: 'all_users' }
            );

            await admin.messaging().send(message);
            updatedMap['general'] = topNews.id;
            logger.log(`[NOTIF] General sent: newsId=${topNews.id}, views=${topNews.longViews || 0}, hour=${istHour}`);
        } catch (e: any) {
            logger.error(`[NOTIF] General send failed:`, e.message);
        }
    } else {
        logger.log(`[NOTIF] General skipped — no new unsent news found. newsId=${topNews?.id}`);
    }

    // --- 2. District Notification — 13 PM మరియు 21 PM slots కి district push ---
    if (istHour === 13 || istHour === 21) {
        for (const district of DISTRICTS) {
            // ఆ జిల్లాలో ఇంతకుముందు పంపని best news కనుక్కోవడం
            const districtNews = allNews.find((n: any) =>
                ((Array.isArray(n.categories) && n.categories.includes(district)) || n.district === district) &&
                lastSentMap[district] !== n.id
            );

            if (!districtNews) continue;

            const notifTitle = districtNews.notificationTitle || districtNews.headline?.telugu || `${district} తాజా వార్త`;
            const shortTitle = notifTitle.length > 45 ? notifTitle.substring(0, 45).trim() + "..." : notifTitle;
            let imageUrl = districtNews.thumbnailUrl || "";
            if (!imageUrl && districtNews.mediaUrl) {
                imageUrl = (await createAndSaveThumbnail(districtNews.mediaUrl, districtNews.id)) || districtNews.mediaUrl;
            }

            const topicName = getTopicName("district", district);

            try {
                const message = buildNewsMessage(
                    districtNews,
                    `📍 ${district}: ${shortTitle}`,
                    "local_news_v2",
                    imageUrl,
                    21600000, // 6 hour TTL
                    { topic: topicName }
                );

                await admin.messaging().send(message);
                updatedMap[district] = districtNews.id;
                logger.log(`[NOTIF] District ${district}: newsId=${districtNews.id}, views=${districtNews.longViews || 0}`);
            } catch (e: any) {
                logger.error(`[NOTIF] Error in district topic ${topicName}:`, e.message);
            }
        }
    }

    // --- 3. Category Notification — 8 AM & 18 PM slots కి category-wise push ---
    if (istHour === 8 || istHour === 18) {
        for (const [teluguCat, topicName] of Object.entries(CATEGORY_TOPICS)) {
            const catKey = `cat_${topicName}`;

            // ఆ category లో ఇంతకుముందు general గాని category గాని పంపని best news కనుక్కోవడం
            const catNews = allNews.find((n: any) =>
                (n.category === teluguCat || (Array.isArray(n.categories) && n.categories.includes(teluguCat))) &&
                lastSentMap['general'] !== n.id &&
                lastSentMap[catKey] !== n.id
            );

            if (!catNews) continue;

            const notifTitle = catNews.notificationTitle || catNews.headline?.telugu || catNews.headline?.english || "";
            const shortTitle = notifTitle.length > 45 ? notifTitle.substring(0, 45).trim() + "..." : notifTitle;
            const imageUrl = catNews.thumbnailUrl || catNews.mediaUrl || "";

            try {
                const message = buildNewsMessage(
                    catNews,
                    `📌 ${teluguCat}: ${shortTitle}`,
                    "general_news_v2",
                    imageUrl,
                    21600000, // 6 hour TTL
                    { topic: topicName }
                );
                await admin.messaging().send(message);
                updatedMap[catKey] = catNews.id;
                logger.log(`[NOTIF] Category ${teluguCat}: newsId=${catNews.id}, topic=${topicName}`);
            } catch (e: any) {
                logger.error(`[NOTIF] Error in category topic ${topicName}:`, e.message);
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
    }, { merge: true }).catch(() => {});
});

// ==========================================
// BREAKING NEWS INSTANT TRIGGER
// isBreaking=true లేదా tone=BREAKING/URGENT అయిన వెంటనే notification
// ==========================================
export const onNewsPostApprovedNotify = onDocumentWritten({
    document: "news/{postId}",
    region: REGION,
}, async (event) => {
    const before = event.data?.before?.data();
    const after  = event.data?.after?.data();
    if (!after) return;

    const postId = event.params.postId;

    // Only fire when approved changes false → true
    const wasApproved = before?.approved === true;
    const isNowApproved = after.approved === true;
    if (wasApproved || !isNowApproved) return;

    // Breaking trigger: isBreaking=true OR tone=BREAKING/URGENT
    const tone = (after.tone || "").toUpperCase();
    const isBreakingOrUrgent = after.isBreaking === true || tone === 'BREAKING' || tone === 'URGENT';
    if (!isBreakingOrUrgent) {
        logger.log(`[BREAKING] Not breaking/urgent: ${postId} (tone=${after.tone}, isBreaking=${after.isBreaking})`);
        return;
    }
    logger.log(`[BREAKING] Triggered: ${postId} (tone=${after.tone}, isBreaking=${after.isBreaking})`);

    // Age check — 6 గంటల కంటే పాత news కి breaking send వద్దు
    const ts = after.timestamp;
    let ageHours = 0;
    if (ts && typeof ts.toDate === 'function') {
        ageHours = (Date.now() - ts.toDate().getTime()) / (1000 * 60 * 60);
    } else if (ts && ts._seconds) {
        ageHours = (Date.now() - ts._seconds * 1000) / (1000 * 60 * 60);
    }
    if (ageHours > 6) {
        logger.log(`[BREAKING] Too old (${ageHours.toFixed(1)}h): ${postId}`);
        return;
    }

    // Daily limit check - atomic to prevent race conditions (max 5 breaking notifications per day)
    const db = admin.firestore();
    const canSend = await checkAndIncrementLimitAtomic(db, 'notif_daily_breaking', 5);
    if (!canSend) {
        logger.log(`[BREAKING] Daily limit reached for breaking news. Skipping ${postId}`);
        return;
    }

    // Duplicate check
    const settingsRef = db.collection('settings').doc('notifications');
    const settingsDoc = await settingsRef.get();
    const lastSentMap = settingsDoc.exists ? (settingsDoc.data()?.lastSentNewsIdMap || {}) : {};
    if (lastSentMap['general'] === postId) {
        logger.log(`[BREAKING] Already sent: ${postId}`);
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

        // 1. Breaking news → all_users కి పంపు (ఒకేసారి పంపడం ద్వారా డూప్లికేట్ నోటిఫికేషన్లు రాకుండా రక్షణ)
        const message = buildNewsMessage(
            news,
            breakingTitle,
            "breaking_news",
            imageUrl,
            1800000, // 30 min TTL
            { topic: 'all_users' }
        );
        await admin.messaging().send(message);

        const category = after.category || after.categories?.[0] || "";
        const catKey = category ? `cat_${category}` : "";

        const updatedHistory: any = {
            ...lastSentMap,
            general: postId
        };
        if (catKey) {
            updatedHistory[catKey] = postId;
        }

        await settingsRef.set({
            lastSentNewsIdMap: updatedHistory,
            lastBreakingAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        logger.log(`[BREAKING] ✅ Sent to all_users for ${postId} (tone=${after.tone}, age=${ageHours.toFixed(1)}h)`);
    } catch (err: any) {
        logger.error(`[BREAKING_ERR] ${postId}:`, err.message);
    }
});

// ==========================================
// CATEGORY TOPIC NAME HELPER
// ==========================================
function getCategoryTopic(category: string): string | null {
    return CATEGORY_TOPICS[category] || null;
}


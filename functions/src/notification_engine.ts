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
    // తెలంగాణ (33 జిల్లాలు)
    "ఆదిలాబాద్", "భద్రాద్రి కొత్తగూడెం", "హన్మకొండ", "హైదరాబాద్", "జగిత్యాల", "జనగాం", "జయశంకర్ భూపాలపల్లి",
    "జోగులాంబ గద్వాల", "కామారెడ్డి", "కరీంనగర్", "ఖమ్మం", "కుమ్రం భీమ్ ఆసిఫాబాద్", "మహబూబాబాద్", "మహబూబ్ నగర్",
    "మంచిర్యాల", "మెదక్", "మేడ్చల్ మల్కాజిగిరి", "ములుగు", "నాగర్ కర్నూల్", "నల్గొండ", "నారాయణపేట", "నిర్మల్",
    "నిజామాబాద్", "పెద్దపల్లి", "రాజన్న సిరిసిల్ల", "రంగారెడ్డి", "సంగారెడ్డి", "సిద్దిపేట", "సూర్యాపేట",
    "వికారాబాద్", "వనపర్తి", "వరంగల్", "యాదాద్రి భువనగిరి",
    // ఆంధ్రప్రదేశ్ (29 జిల్లాలు)
    "అల్లూరి సీతారామరాజు", "అనకాపల్లి", "అనంతపురం", "అన్నమయ్య", "బాపట్ల", "చిత్తూరు", "కోనసీమ",
    "తూర్పు గోదావరి", "ఏలూరు", "గుంటూరు", "కాకినాడ", "కృష్ణా", "కర్నూలు", "నంద్యాల", "ఎన్టీఆర్",
    "పల్నాడు", "పార్వతీపురం మన్యం", "ప్రకాశం", "మార్కాపురం", "పోలవరం", "మదనపల్లె", "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", "శ్రీ సత్యసాయి",
    "శ్రీకాకుళం", "తిరుపతి", "విశాఖపట్నం", "విజయనగరం", "పశ్చిమ గోదావరి", "వైఎస్ఆర్ కడప"
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
    // 🛡️ 100% Zero-Cost Rich Notification Architecture:
    // 1. External CDN (Eenadu, Sakshi, YouTube, TV9) -> 0 Firebase egress cost (bandwidth is on external CDN).
    // 2. Firebase Storage -> Route through Cloudflare-backed free edge cache proxy (wsrv.nl).
    //    First device hit caches the 25KB thumbnail on Cloudflare edge (1 single download from Firebase).
    //    All subsequent 10,000+ devices download from Cloudflare CDN cache (CF-Cache: HIT).
    //    Result: Rich BigPicture notifications on 100% of devices + EXACTLY ₹0 Firebase Storage egress bill!
    let safeDrawerImageUrl: string | undefined = undefined;
    if (imageUrl && imageUrl.trim()) {
        const isFirebaseStorage = imageUrl.includes('firebasestorage.googleapis.com') || imageUrl.includes('firebasestorage.app');
        if (!isFirebaseStorage && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
            // External CDN: 100% Safe, ₹0 Firebase Cost
            safeDrawerImageUrl = imageUrl;
        } else if (isFirebaseStorage) {
            // Cloudflare Edge Cache Proxy — 1 Firebase request, unlimited cached edge downloads
            safeDrawerImageUrl = `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}&w=640&output=webp&q=75`;
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
            district:  news.district || "",
            newsType:  ('topic' in topicOrToken && topicOrToken.topic?.startsWith("district_")) ? "DISTRICT" : "MAIN",
        },
        ...topicOrToken,
    };
}

// ==========================================
// MAIN / PRADHAANA NEWS FILTER
// Ensures only state, national, global, breaking or high-impact news goes to all_users
// Single-mandal or purely local district stories are excluded from all_users
// ==========================================
function isMainNews(n: any): boolean {
    if (n.isGlobal === true) return true;
    const tone = (n.tone || "").toUpperCase();
    if (n.isBreaking === true || tone === 'BREAKING' || tone === 'URGENT' || tone === 'IMPORTANT') return true;
    if ((n.score ?? 0) >= 75) return true;

    const category = n.category || "";
    const mainCategories = [
        "రాజకీయం", "జాతీయం", "ప్రపంచం", "క్రీడలు", "వినోదం",
        "వ్యాపారం", "టెక్నాలజీ", "ఆరోగ్యం", "విద్య", "వ్యవసాయం"
    ];
    if (mainCategories.includes(category)) {
        if (category === "జిల్లా వార్త") return false;
        return true;
    }

    const broadDistricts = ["State", "National", "International", "తెలంగాణ", "ఆంధ్రప్రదేశ్", "భారతదేశం", "ప్రపంచం", "General", "AP", "TS"];
    if (n.district && broadDistricts.some(d => d.toLowerCase() === (n.district + "").toLowerCase())) {
        return true;
    }

    return false;
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
    const settingsData = settingsDoc.exists ? settingsDoc.data() : {};
    const lastSentMap = settingsData?.lastSentNewsIdMap || {};
    const recentGeneralIds: string[] = Array.isArray(settingsData?.recentGeneralIds)
        ? settingsData.recentGeneralIds
        : (lastSentMap['general'] ? [lastSentMap['general']] : []);
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

    // --- 1. General Notification — అన్ని 4 scheduled slots (8, 13, 18, 21) కి ప్రధాన వార్త తప్పనిసరిగా పంపు ---
    // ప్రధాన వార్తలు (State / National / Global / Major) మాత్రమే all_users కి వెళ్లాలి, స్థానిక మండల/జిల్లా వార్తలు వెళ్లకూడదు.
    const mainNewsList = allNews.filter(isMainNews);
    const candidateMainNews = mainNewsList.length > 0 ? mainNewsList : allNews;

    // 1) గత 24 గంటల రీసెంట్ లిస్ట్ లో లేని సరికొత్త ప్రధాన వార్త
    let topNews = candidateMainNews.find((n: any) => !recentGeneralIds.includes(n.id));
    if (!topNews) {
        // 2) Fallback: రీసెంట్ లిస్ట్ లో ఉన్నప్పటికీ, వెంటనే మునుపటి రన్‌లో పంపని అత్యుత్తమ ప్రధాన వార్త
        topNews = candidateMainNews.find((n: any) => lastSentMap['general'] !== n.id) || candidateMainNews[0];
    }

    if (topNews) {
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
            recentGeneralIds.unshift(topNews.id);
            logger.log(`[NOTIF] Pradhaana Vaartha (General) sent: newsId=${topNews.id}, category=${topNews.category}, views=${topNews.longViews || 0}, hour=${istHour}`);
        } catch (e: any) {
            logger.error(`[NOTIF] General send failed:`, e.message);
        }
    } else {
        logger.log(`[NOTIF] General skipped — no candidate news found.`);
    }

    // --- 2. District Notification — 13 PM మరియు 21 PM slots కి district push ---
    if (istHour === 13 || istHour === 21) {
        for (const district of DISTRICTS) {
            // ఆ జిల్లాకు చెందిన వార్త మాత్రమే ఎంపిక చేస్తాం (ఇతర జిల్లాల వార్తలు లేదా ప్రధాన వార్తతో డూప్లికేట్ కాకుండా రక్షణ)
            const districtNews = allNews.find((n: any) =>
                (n.district === district || (n.category === "జిల్లా వార్త" && Array.isArray(n.categories) && n.categories.includes(district))) &&
                n.id !== topNews?.id &&
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
            const catKey = topicName;

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

    const updatedRecentGeneral = recentGeneralIds.slice(0, 30);
    await settingsRef.set({
        lastSentNewsIdMap: updatedMap,
        recentGeneralIds: updatedRecentGeneral,
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
// BREAKING / IMPORTANT NEWS INSTANT TRIGGER
// isBreaking=true లేదా tone=BREAKING/URGENT/IMPORTANT అయిన వెంటనే notification (గరిష్టంగా 5/రోజు)
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

    // Trigger: isBreaking=true OR tone=BREAKING/URGENT OR tone=IMPORTANT (with notificationWorthy or high score)
    const tone = (after.tone || "").toUpperCase();
    const isBreakingOrUrgent = after.isBreaking === true || tone === 'BREAKING' || tone === 'URGENT';
    const isImportantNews = tone === 'IMPORTANT' && (after.notificationWorthy === true || (after.score ?? 0) >= 70);

    if (!isBreakingOrUrgent && !isImportantNews) {
        logger.log(`[BREAKING] Not breaking/urgent/important: ${postId} (tone=${after.tone}, isBreaking=${after.isBreaking})`);
        return;
    }
    logger.log(`[BREAKING] Triggered: ${postId} (tone=${after.tone}, isBreaking=${after.isBreaking}, important=${isImportantNews})`);

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

    // Daily limit check - atomic to prevent race conditions (max 5 breaking/important notifications per day)
    const db = admin.firestore();
    const canSend = await checkAndIncrementLimitAtomic(db, 'notif_daily_breaking', 5);
    if (!canSend) {
        logger.log(`[BREAKING] Daily limit reached for breaking/important news. Skipping ${postId}`);
        return;
    }

    // Duplicate check
    const settingsRef = db.collection('settings').doc('notifications');
    const settingsDoc = await settingsRef.get();
    const settingsData = settingsDoc.exists ? settingsDoc.data() : {};
    const lastSentMap = settingsData?.lastSentNewsIdMap || {};
    const recentGeneralIds: string[] = Array.isArray(settingsData?.recentGeneralIds) ? settingsData.recentGeneralIds : [];

    if (lastSentMap['general'] === postId || recentGeneralIds.includes(postId)) {
        logger.log(`[BREAKING] Already sent: ${postId}`);
        return;
    }

    const notifTitle = after.notificationTitle || after.headline?.telugu || after.headline?.english || after.headline || "తాజా వార్త";
    const shortBreaking = notifTitle.length > 50 ? notifTitle.substring(0, 50).trim() + "..." : notifTitle;
    const imageUrl = after.thumbnailUrl || after.mediaUrl || "";

    const breakingTitle = (tone === 'BREAKING' || after.isBreaking === true)
        ? `🔴 Breaking: ${shortBreaking}`
        : (tone === 'URGENT')
            ? `⚡ అత్యవసరం: ${shortBreaking}`
            : `📌 ముఖ్యాంశం: ${shortBreaking}`;

    try {
        const news = { id: postId, ...after };

        // 1. Breaking/Important news → all_users కి పంపు (ఒకేసారి పంపడం ద్వారా డూప్లికేట్ నోటిఫికేషన్లు రాకుండా రక్షణ)
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

        const updatedRecentGeneral = [postId, ...recentGeneralIds.filter(id => id !== postId)].slice(0, 30);

        await settingsRef.set({
            lastSentNewsIdMap: updatedHistory,
            recentGeneralIds: updatedRecentGeneral,
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


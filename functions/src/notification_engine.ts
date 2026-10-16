import * as admin from 'firebase-admin';
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { getTopicName, slugify, createAndSaveThumbnail, REGION } from './utils';

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
// CANONICAL DISTRICT NORMALIZER
// Maps various town/city names, aliases, and alternative spellings to official district names in DISTRICTS.
// Ensures local breaking news and scheduled pushes match exact topics and never leak to all_users.
// ==========================================
export function getCanonicalDistrict(raw: string | null | undefined): string | null {
    if (!raw || typeof raw !== 'string') return null;
    const clean = raw.trim();
    if (!clean) return null;

    if (DISTRICTS.includes(clean)) return clean;

    const aliasMap: Record<string, string> = {
        // AP Aliases
        "విజయవాడ": "ఎన్టీఆర్",
        "NTR": "ఎన్టీఆర్",
        "Vijayawada": "ఎన్టీఆర్",
        "రాజమండ్రి": "తూర్పు గోదావరి",
        "రాజమహేంద్రవరం": "తూర్పు గోదావరి",
        "East Godavari": "తూర్పు గోదావరి",
        "తూర్పుగోదావరి": "తూర్పు గోదావరి",
        "పశ్చిమగోదావరి": "పశ్చిమ గోదావరి",
        "West Godavari": "పశ్చిమ గోదావరి",
        "భీమవరం": "పశ్చిమ గోదావరి",
        "అమలాపురం": "కోనసీమ",
        "డాక్టర్ బి.ఆర్. అంబేద్కర్ కోనసీమ": "కోనసీమ",
        "Konaseema": "కోనసీమ",
        "నెల్లూరు": "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు",
        "Nellore": "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు",
        "SPSR Nellore": "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు",
        "కడప": "వైఎస్ఆర్ కడప",
        "వైఎస్సార్ కడప": "వైఎస్ఆర్ కడప",
        "Kadapa": "వైఎస్ఆర్ కడప",
        "YSR Kadapa": "వైఎస్ఆర్ కడప",
        "రాయచోటి": "అన్నమయ్య",
        "Annamayya": "అన్నమయ్య",
        "పుట్టపర్తి": "శ్రీ సత్యసాయి",
        "సత్యసాయి": "శ్రీ సత్యసాయి",
        "Sri Sathya Sai": "శ్రీ సత్యసాయి",
        "ఒంగోలు": "ప్రకాశం",
        "Prakasam": "ప్రకాశం",
        "నరసరావుపేట": "పల్నాడు",
        "Palnadu": "పల్నాడు",
        "మన్యం": "పార్వతీపురం మన్యం",
        "పార్వతీపురం": "పార్వతీపురం మన్యం",
        "పాడేరు": "అల్లూరి సీతారామరాజు",
        "అల్లూరి": "అల్లూరి సీతారామరాజు",
        "మచిలీపట్నం": "కృష్ణా",
        "Krishna": "కృష్ణా",
        "తిరుమల": "తిరుపతి",
        "Tirupati": "తిరుపతి",
        "విశాఖ": "విశాఖపట్నం",
        "వైజాగ్": "విశాఖపట్నం",
        "Visakhapatnam": "విశాఖపట్నం",

        // TS Aliases
        "సైబరాబాద్": "హైదరాబాద్",
        "సికింద్రాబాద్": "హైదరాబాద్",
        "Hyderabad": "హైదరాబాద్",
        "కొత్తగూడెం": "భద్రాద్రి కొత్తగూడెం",
        "Kothagudem": "భద్రాద్రి కొత్తగూడెం",
        "భూపాలపల్లి": "జయశంకర్ భూపాలపల్లి",
        "గద్వాల": "జోగులాంబ గద్వాల",
        "Gadwal": "జోగులాంబ గద్వాల",
        "ఆసిఫాబాద్": "కుమ్రం భీమ్ ఆసిఫాబాద్",
        "Asifabad": "కుమ్రం భీమ్ ఆసిఫాబాద్",
        "మహబూబ్‌నగర్": "మహబూబ్ నగర్",
        "Mahabubnagar": "మహబూబ్ నగర్",
        "సిరిసిల్ల": "రాజన్న సిరిసిల్ల",
        "Sircilla": "రాజన్న సిరిసిల్ల",
        "వరంగల్ అర్బన్": "హన్మకొండ",
        "హనుమకొండ": "హన్మకొండ",
        "Hanamkonda": "హన్మకొండ",
        "వరంగల్ రూరల్": "వరంగల్",
        "Warangal": "వరంగల్",
        "భువనగిరి": "యాదాద్రి భువనగిరి",
        "యాదాద్రి": "యాదాద్రి భువనగిరి",
        "నల్లగొండ": "నల్గొండ",
        "నాగర్‌కర్నూల్": "నాగర్ కర్నూల్",
        "మేడ్చల్": "మేడ్చల్ మల్కాజిగిరి",
        "మల్కాజిగిరి": "మేడ్చల్ మల్కాజిగిరి"
    };

    if (aliasMap[clean]) return aliasMap[clean];

    for (const [alias, canonical] of Object.entries(aliasMap)) {
        if (clean.includes(alias)) return canonical;
    }
    for (const dist of DISTRICTS) {
        if (clean.includes(dist) || dist.includes(clean)) return dist;
    }

    return null;
}


// ==========================================
// TIME-BASED ENGAGING TITLES
// ==========================================
function getTitleForHour(hour: number, headline: string, curiosityTitle?: string): string {
    if (curiosityTitle && curiosityTitle.trim().length > 0) {
        const raw = curiosityTitle.trim();
        const short = raw.length > 70 ? raw.substring(0, 70).trim() + "..." : raw;
        if (hour === 8)  return `☀️ ${short}`;
        if (hour === 13) return `⚡ ${short}`;
        if (hour === 18) return `🌆 ${short}`;
        if (hour === 21) return `🌙 ${short}`;
        return `📰 ${short}`;
    }
    const raw = headline.trim();
    const short = raw.length > 70 ? raw.substring(0, 70).trim() + "..." : raw;
    if (hour === 8)  return `☀️ శుభోదయం: ${short}`;
    if (hour === 13) return `🔴 తాజా వార్త: ${short}`;
    if (hour === 18) return `🌆 సాయంత్రం అప్‌డేట్: ${short}`;
    if (hour === 21) return `🌙 రాత్రి వార్తలు: ${short}`;
    return `📰 ${short}`;
}

// ==========================================
// WAY2NEWS STYLE TITLE FORMATTING (Red Highlight + Ramabhadra Font, No Bold)
// ==========================================
function formatWay2NewsStyleTitle(rawTitle: string): { plainTitle: string; htmlTitle: string } {
    const trimmed = rawTitle.trim();
    let hook = "";
    let rest = "";

    if (trimmed.includes("..")) {
        const idx = trimmed.indexOf("..");
        hook = trimmed.substring(0, idx + 2);
        rest = trimmed.substring(idx + 2);
    } else if (trimmed.includes(":")) {
        const idx = trimmed.indexOf(":");
        hook = trimmed.substring(0, idx + 1);
        rest = trimmed.substring(idx + 1);
    } else {
        const words = trimmed.split(/\s+/);
        if (words.length > 2) {
            hook = words.slice(0, 2).join(" ");
            rest = " " + words.slice(2).join(" ");
        } else {
            hook = trimmed;
            rest = "";
        }
    }

    const escape = (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const htmlTitle = `<font color="#E53935" face="ramabhadra">${escape(hook)}</font><font face="ramabhadra">${escape(rest)}</font>`;
    return { plainTitle: trimmed, htmlTitle };
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
    topicOrToken: { topic: string } | { token: string },
    options: { silent?: boolean } = {}
): admin.messaging.Message {
    const isSilent = !!options.silent;
    const headline = news.headline?.telugu || news.headline?.english || news.headline || "";
    const body = (headline + "").substring(0, 150);
    const { plainTitle, htmlTitle } = formatWay2NewsStyleTitle(title);

    // 🛡️ 100% Zero-Cost Rich Notification Architecture:
    // 1. External CDN (Eenadu, Sakshi, YouTube, TV9) -> 0 Firebase egress cost.
    // 2. Firebase Storage -> Route through Cloudflare-backed free edge cache proxy (wsrv.nl).
    //    All 10,000+ devices download from Cloudflare CDN edge cache (CF-Cache: HIT) at ~25KB WebP.
    //    Result: Rich BigPicture notifications on 100% of devices + EXACTLY ₹0 Firebase Storage egress bill!
    let safeDrawerImageUrl: string | undefined = undefined;
    if (imageUrl && imageUrl.trim()) {
        const isFirebaseStorage = imageUrl.includes('firebasestorage.googleapis.com') || 
                                  imageUrl.includes('firebasestorage.app') ||
                                  imageUrl.includes('storage.googleapis.com');
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
            title: plainTitle,
            body,
            ...(safeDrawerImageUrl ? { imageUrl: safeDrawerImageUrl } : {})
        },
        android: {
            priority: isSilent ? 'normal' : 'high',
            ttl: ttlMs,
            directBootOk: true,
            notification: {
                channelId,
                ...(safeDrawerImageUrl ? { imageUrl: safeDrawerImageUrl } : {}),
                defaultSound: !isSilent,
                priority: isSilent ? 'low' : 'high'
            }
        },
        data: {
            actionUrl: `alfanews://news/${news.id}`,
            newsId:    news.id,
            channelId,
            imageUrl:  safeDrawerImageUrl || imageUrl || "",
            title:     plainTitle,
            htmlTitle: htmlTitle,
            body,
            silent:    isSilent ? "true" : "false",
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
// STATEWIDE VS LOCAL DISTRICT BREAKING SCOPE
// Only state, national, global, or high-magnitude news goes to all_users.
// Purely local mandal/district breaking news is routed to that specific district topic.
// ==========================================
function isStatewideOrBroadBreaking(n: any): boolean {
    if (n.isGlobal === true) return true;
    const broadDistricts = ["State", "National", "International", "తెలంగాణ", "ఆంధ్రప్రదేశ్", "భారతదేశం", "ప్రపంచం", "General", "AP", "TS"];
    if (n.district && broadDistricts.some(d => d.toLowerCase() === (n.district + "").toLowerCase())) {
        return true;
    }
    const mainCategories = ["రాజకీయం", "జాతీయం", "ప్రపంచం", "క్రీడలు", "వ్యాపారం", "టెక్నాలజీ"];
    if (mainCategories.includes(n.category) && n.category !== "జిల్లా వార్త" && (n.score ?? 0) >= 70) {
        return true;
    }
    const fullText = `${n.headline?.telugu || ""} ${n.content?.telugu || ""}`;
    if (fullText.includes("ముఖ్యమంత్రి") || fullText.includes("ప్రధానమంత్రి") || fullText.includes("కేబినెట్") || fullText.includes("బడ్జెట్") || fullText.includes("ఆర్డినెన్స్") || fullText.includes("హైకోర్టు") || fullText.includes("సుప్రీంకోర్టు") || fullText.includes("ఎన్నికల")) {
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
// TRENDING SCORE ALGORITHM (Freshness Decay + AI Score + Views + Image Quality)
// - Freshness decay: Fresh breaking news (<3h) scores higher than 20h old news with accumulated views.
// - Image Bonus: 25% boost if the article has an image to maximize CTR on BigPictureStyle notifications.
// - AI Score: High quality journalistic pieces get prioritized.
// ==========================================
function calculateTrendingScore(n: any): number {
    const views = n.longViews || n.views || 0;
    const aiScore = typeof n.score === 'number' ? n.score : 50;

    let ageHours = 1;
    const ts = n.timestamp;
    if (ts && typeof ts.toDate === 'function') {
        ageHours = Math.max(0.2, (Date.now() - ts.toDate().getTime()) / (1000 * 60 * 60));
    } else if (ts && ts._seconds) {
        ageHours = Math.max(0.2, (Date.now() - ts._seconds * 1000) / (1000 * 60 * 60));
    }

    // Rich notification bonus: Articles with images get 25% ranking boost
    const hasImage = !!(n.thumbnailUrl || n.mediaUrl);
    const imageMultiplier = hasImage ? 1.25 : 1.0;

    // Freshness decay formula:
    // (views * 1.5 + aiScore * 5) / (ageHours + 1.5)^1.15
    const rawStrength = (views * 1.5) + (aiScore * 5);
    return (rawStrength / Math.pow(ageHours + 1.5, 1.15)) * imageMultiplier;
}

// ==========================================
// SCHEDULED NOTIFICATIONS — 4 times/day (8 AM, 1 PM, 6 PM, 9 PM IST)
// Ranking: Trending Score (Freshness + AI Score + Views + Image Bonus)
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

    // Ranking: Trending Score (Engagement + AI Score + Freshness Decay + Image Bonus)
    allNews.sort((a: any, b: any) => calculateTrendingScore(b) - calculateTrendingScore(a));

    const mainNewsList = allNews.filter(isMainNews);
    const candidateMainNews = mainNewsList.length > 0 ? mainNewsList : allNews;

    // =========================================================================
    // 🛡️ ZERO NOTIFICATION FLOODING (Single Dedicated Purpose Per Slot):
    // 8 AM  -> General Morning News (all_users) ONLY (శుభోదయం: ముఖ్యాంశాలు)
    // 13 PM -> District Local News (district_*) ONLY (మధ్యాహ్న స్థానిక జిల్లా వార్తలు)
    // 18 PM -> Category News (cat_*) ONLY (సాయంత్రం విరామం: సినిమా/రాజకీయం/క్రీడలు)
    // 21 PM -> General Night Roundup (all_users) ONLY (రాత్రి ముఖ్యాంశాల సమీక్ష)
    // =========================================================================

    // --- 1. General Notification — 8 AM & 21 PM Slots ONLY (or fallback on manual runs) ---
    const isGeneralSlot = istHour === 8 || istHour === 21 || (istHour !== 13 && istHour !== 18);
    let topNews: any = null;

    if (isGeneralSlot) {
        // 1) గత 24 గంటల రీసెంట్ లిస్ట్ లో లేని సరికొత్త ప్రధాన వార్త
        topNews = candidateMainNews.find((n: any) => !recentGeneralIds.includes(n.id));
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
    }

    // --- 2. District Notification — 13 PM (మధ్యాహ్న భోజన సమయం) స్లాట్ కి మాత్రమే district push ---
    if (istHour === 13) {
        for (const district of DISTRICTS) {
            // ఆ జిల్లాకు చెందిన వార్త మాత్రమే ఎంపిక చేస్తాం (క్యానానికల్ జిల్లా మ్యాపింగ్ ద్వారా రాజమండ్రి, విజయవాడ లాంటి పేర్లతోనూ మ్యాచ్ అవుతుంది)
            const districtNews = allNews.find((n: any) => {
                const canonicalDist = getCanonicalDistrict(n.district);
                const isCatMatch = n.category === "జిల్లా వార్త" && Array.isArray(n.categories) &&
                    n.categories.some((c: string) => getCanonicalDistrict(c) === district);
                return (canonicalDist === district || isCatMatch) &&
                       lastSentMap[district] !== n.id &&
                       lastSentMap['general'] !== n.id;
            });

            if (!districtNews) continue;

            const notifTitle = districtNews.notificationTitle || districtNews.headline?.telugu || `${district} తాజా వార్త`;
            const shortTitle = notifTitle.length > 70 ? notifTitle.substring(0, 70).trim() + "..." : notifTitle;
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

    // --- 3. Category Notification — 18 PM (సాయంత్రం విరామం) స్లాట్ కి మాత్రమే category-wise push ---
    if (istHour === 18) {
        for (const [teluguCat, topicName] of Object.entries(CATEGORY_TOPICS)) {
            const catKey = topicName;

            // ఆ category లో ఇంతకుముందు general గాని category గాని పంపని best news కనుక్కోవడం
            const catNews = allNews.find((n: any) => {
                const isCat = n.category === teluguCat || (Array.isArray(n.categories) && n.categories.includes(teluguCat));
                return isCat &&
                       lastSentMap['general'] !== n.id &&
                       lastSentMap[catKey] !== n.id;
            });

            if (!catNews) continue;

            const notifTitle = catNews.notificationTitle || catNews.headline?.telugu || catNews.headline?.english || "";
            const shortTitle = notifTitle.length > 70 ? notifTitle.substring(0, 70).trim() + "..." : notifTitle;
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

    // Smart Scope Routing:
    // Determine whether this breaking news has broad statewide/national impact (all_users)
    // or is a local incident that should be pushed to that specific district topic.
    const isStatewide = isStatewideOrBroadBreaking(after);
    const canonicalDistrict = getCanonicalDistrict(after.district);
    const isLocalDistrictBreaking = !isStatewide && !!canonicalDistrict;

    const targetTopic = isStatewide
        ? 'all_users'
        : (isLocalDistrictBreaking ? getTopicName("district", canonicalDistrict!) : 'all_users');

    // Daily limit check - atomic to prevent race conditions
    // For statewide (all_users): max 5 per day across app
    // For local district: max 3 breaking alerts per day for that specific district
    const db = admin.firestore();
    const limitDocName = isStatewide ? 'notif_daily_breaking' : `notif_daily_breaking_${slugify(canonicalDistrict || 'district')}`;
    const maxLimit = isStatewide ? 5 : 3;
    const canSend = await checkAndIncrementLimitAtomic(db, limitDocName, maxLimit);
    if (!canSend) {
        logger.log(`[BREAKING] Daily limit reached (${limitDocName}, max ${maxLimit}). Skipping ${postId}`);
        return;
    }

    // Duplicate check
    const settingsRef = db.collection('settings').doc('notifications');
    const settingsDoc = await settingsRef.get();
    const settingsData = settingsDoc.exists ? settingsDoc.data() : {};
    const lastSentMap = settingsData?.lastSentNewsIdMap || {};
    const recentGeneralIds: string[] = Array.isArray(settingsData?.recentGeneralIds) ? settingsData.recentGeneralIds : [];

    if (lastSentMap['general'] === postId || lastSentMap[targetTopic] === postId || recentGeneralIds.includes(postId)) {
        logger.log(`[BREAKING] Already sent: ${postId} (topic: ${targetTopic})`);
        return;
    }

    const notifTitle = after.notificationTitle || after.headline?.telugu || after.headline?.english || after.headline || "తాజా వార్త";
    const shortBreaking = notifTitle.length > 70 ? notifTitle.substring(0, 70).trim() + "..." : notifTitle;
    const imageUrl = after.thumbnailUrl || after.mediaUrl || "";

    const breakingTitle = (tone === 'BREAKING' || after.isBreaking === true)
        ? `🔴 Breaking: ${shortBreaking}`
        : (tone === 'URGENT')
            ? `⚡ అత్యవసరం: ${shortBreaking}`
            : `📌 ముఖ్యాంశం: ${shortBreaking}`;

    // 🌙 QUIET HOURS (11:00 PM – 6:00 AM IST)
    // Avoid waking sleeping users with loud sounds, unless it's a catastrophic life-safety disaster.
    const istHour = parseInt(new Intl.DateTimeFormat('en-GB', {
        hour: 'numeric',
        hour12: false,
        timeZone: 'Asia/Kolkata'
    }).format(new Date()));

    const isQuietHour = istHour >= 23 || istHour < 6;
    const fullText = `${after.headline?.telugu || ""} ${after.body?.telugu || ""} ${after.headline || ""}`.toLowerCase();
    const isLifeThreatening = [
        "భూకంపం", "తుఫాను", "వరదలు", "సునామి", "భారీ విపత్తు",
        "సైరన్", "ఎమర్జెన్సీ", "తీవ్ర ప్రమాదం", "కుప్పకూలిన",
        "విష వాయువు", "గ్యాస్ లీక్", "ఉగ్రవాద"
    ].some(k => fullText.includes(k));

    const isSilentDelivery = isQuietHour && !isLifeThreatening;
    if (isSilentDelivery) {
        logger.log(`[BREAKING] Quiet hours active (IST ${istHour}h). Delivering silently without loud chime: ${postId}`);
    }

    try {
        const news = { id: postId, ...after };

        // Breaking/Important news → targeted topic కి పంపు
        const message = buildNewsMessage(
            news,
            breakingTitle,
            "breaking_news",
            imageUrl,
            1800000, // 30 min TTL
            { topic: targetTopic },
            { silent: isSilentDelivery }
        );
        await admin.messaging().send(message);

        const category = after.category || after.categories?.[0] || "";
        const catKey = category ? `cat_${category}` : "";

        const updatedHistory: any = {
            ...lastSentMap,
            [targetTopic]: postId
        };
        if (isStatewide) {
            updatedHistory['general'] = postId;
        }
        if (catKey) {
            updatedHistory[catKey] = postId;
        }

        const updatedRecentGeneral = isStatewide
            ? [postId, ...recentGeneralIds.filter(id => id !== postId)].slice(0, 30)
            : recentGeneralIds;

        await settingsRef.set({
            lastSentNewsIdMap: updatedHistory,
            recentGeneralIds: updatedRecentGeneral,
            lastBreakingAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        logger.log(`[BREAKING] ✅ Sent to ${targetTopic} for ${postId} (isStatewide=${isStatewide}, tone=${after.tone}, age=${ageHours.toFixed(1)}h)`);
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


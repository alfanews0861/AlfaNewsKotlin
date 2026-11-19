import * as admin from 'firebase-admin';
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { getTopicName, slugify, createAndSaveThumbnail, REGION, isTopTeluguLeaderStatement } from './utils';

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
// EDGE CACHE PROXY HELPER (ZERO FIREBASE EGRESS)
// Routes Firebase Storage URLs via Cloudflare wsrv.nl edge cache (~25KB WebP).
// External news CDNs (Eenadu, Sakshi, YouTube, TV9) pass through untouched at ₹0 cost.
// ==========================================
export function getEdgeProxiedImageUrl(imageUrl?: string | null): string | undefined {
    if (!imageUrl || typeof imageUrl !== 'string') return undefined;
    const trimmed = imageUrl.trim();
    if (!trimmed) return undefined;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return undefined;

    const isFirebaseStorage = trimmed.includes('firebasestorage.googleapis.com') ||
                              trimmed.includes('firebasestorage.app') ||
                              trimmed.includes('storage.googleapis.com');
    if (isFirebaseStorage) {
        return `https://wsrv.nl/?url=${encodeURIComponent(trimmed)}&w=640&output=webp&q=75`;
    }
    return trimmed;
}

// ==========================================
// STABLE NOTIFICATION TAG GENERATOR
// Replaces stale notifications in the same logical slot cleanly instead of piling clutter.
// ==========================================
export function getSlotNotificationTag(
    channelId: string,
    topicOrToken: { topic: string } | { token: string },
    explicitTag?: string
): string {
    if (explicitTag && explicitTag.trim()) return explicitTag.trim();
    const topic = 'topic' in topicOrToken ? (topicOrToken.topic || '') : '';
    if (channelId === 'breaking_news') {
        return topic.startsWith('district_') ? `alfa_breaking_${topic}` : 'alfa_breaking_state';
    }
    if (topic.startsWith('district_')) {
        return `alfa_local_${topic}`;
    }
    if (topic.startsWith('cat_')) {
        return `alfa_${topic}`;
    }
    return 'alfa_general_slot';
}

// ==========================================
// PAUSE WINDOW CHECKER (AUTO-EXPIRES CLEANLY)
// ==========================================
export function isPauseActive(pauseUntil: unknown, nowMs: number = Date.now()): boolean {
    const ts = Number(pauseUntil || 0);
    return Number.isFinite(ts) && ts > 0 && nowMs < ts;
}

// ==========================================
// SHARED: Build HYBRID FCM message (Android System Tray + Foreground Data + WebPush)
// ==========================================
export function buildNewsMessage(
    news: any,
    title: string,
    channelId: string,
    imageUrl: string,
    ttlMs: number,
    topicOrToken: { topic: string } | { token: string },
    options: { silent?: boolean; slotTag?: string } = {}
): admin.messaging.Message {
    const isSilent = !!options.silent;
    const headline = news.headline?.telugu || news.headline?.english || news.headline || "";
    const body = String(headline).trim().substring(0, 150) || "ఆల్ఫా న్యూస్ తాజా వార్త";
    const { plainTitle, htmlTitle } = formatWay2NewsStyleTitle(title);

    // 🛡️ 100% Zero-Cost Rich Notification Architecture via Cloudflare Edge Proxy
    const safeDrawerImageUrl = getEdgeProxiedImageUrl(imageUrl);
    const topic = 'topic' in topicOrToken ? (topicOrToken.topic || '') : '';
    const isDistrictTopic = topic.startsWith("district_");
    const canonicalDistrict = getCanonicalDistrict(news.district) || "";
    const slotTag = getSlotNotificationTag(channelId, topicOrToken, options.slotTag);
    const webLink = `https://alfanews.app/news/${news.id}`;
    const ttlSeconds = Math.max(60, Math.floor(ttlMs / 1000));

    // 🌟 HYBRID FCM ARCHITECTURE (100% Delivery on Xiaomi/Vivo/Oppo/Realme + Rich BigPicture):
    // - Background / Killed / Doze: Android Google Play Services displays `notification` + `android.notification`
    //   reliably with rich BigPicture image and stable tag, even when OEM battery savers block background wakes.
    // - Foreground: MyFirebaseMessagingService.onMessageReceived() renders Way2News Ramabhadra HTML styling
    //   and Read/Share actions using the rich `data` payload.
    // - Web: `webpush` delivers native browser notification with `/app_icon.png`, BigPicture image, and direct link.
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
                tag: slotTag,
                title: plainTitle,
                body,
                priority: isSilent ? 'low' : 'high',
                defaultSound: !isSilent,
                ...(safeDrawerImageUrl ? { imageUrl: safeDrawerImageUrl } : {})
            }
        },
        webpush: {
            headers: {
                Urgency: isSilent ? 'normal' : 'high',
                TTL: String(ttlSeconds)
            },
            notification: {
                title: plainTitle,
                body,
                icon: 'https://alfanews.app/app_icon.png',
                badge: 'https://alfanews.app/app_icon.png',
                tag: slotTag,
                renotify: !isSilent,
                ...(safeDrawerImageUrl ? { image: safeDrawerImageUrl } : {})
            },
            fcmOptions: {
                link: webLink
            }
        },
        data: {
            actionUrl: `alfanews://news/${news.id}`,
            webUrl: webLink,
            newsId: String(news.id || ""),
            channelId,
            imageUrl: safeDrawerImageUrl || "",
            title: plainTitle,
            htmlTitle,
            body,
            silent: isSilent ? "true" : "false",
            // Always send canonical district name so Android District Gatekeeper never mismatches aliases
            district: canonicalDistrict,
            rawDistrict: String(news.district || ""),
            newsType: isDistrictTopic ? "DISTRICT" : "MAIN",
            slotTag,
        },
        ...topicOrToken,
    };
}

// ==========================================
// UNIFIED QUALITY & ENGAGEMENT HELPERS
// Bridges `qualityScore` (0-10) written by news_handler & vps-scraper with legacy `score` (0-100),
// and reads engagement across `longViews`, `views`, and `viewCount`.
// ==========================================
export function getNormalizedQualityScore(n: any): number {
    if (!n || typeof n !== 'object') return 50;

    if (typeof n.qualityScore === 'number' && !isNaN(n.qualityScore)) {
        const scaled = n.qualityScore <= 10 ? n.qualityScore * 10 : n.qualityScore;
        return Math.max(0, Math.min(100, scaled));
    }
    if (typeof n.score === 'number' && !isNaN(n.score)) {
        const scaled = n.score <= 10 ? n.score * 10 : n.score;
        return Math.max(0, Math.min(100, scaled));
    }
    if (n.qualitySignals?.publicInterestScore !== undefined) {
        const pub = Number(n.qualitySignals.publicInterestScore) || 0.5;
        const inv = Number(n.qualitySignals.investigativeScore) || 0.0;
        return Math.max(0, Math.min(100, (pub * 6 + inv * 2 + 2) * 10));
    }
    return 50;
}

export function getEngagementViews(n: any): number {
    if (!n || typeof n !== 'object') return 0;
    return Math.max(
        Number(n.longViews) || 0,
        Number(n.views) || 0,
        Number(n.viewCount) || 0
    );
}

// ==========================================
// MAIN / PRADHAANA NEWS FILTER
// Ensures only state, national, global, breaking or high-impact news goes to all_users
// Single-mandal or purely local district stories are excluded from all_users
// ==========================================
export function isMainNews(n: any): boolean {
    const category = n.category || "";
    if (category === "జిల్లా వార్త" || category === "స్థానిక వార్తలు") {
        return false;
    }

    if (n.isGlobal === true) return true;
    const tone = (n.tone || "").toUpperCase();
    if (n.isBreaking === true || tone === 'BREAKING' || tone === 'URGENT' || tone === 'IMPORTANT') return true;
    if (getNormalizedQualityScore(n) >= 75) return true;

    const mainCategories = [
        "రాజకీయం", "జాతీయం", "ప్రపంచం", "క్రీడలు", "వినోదం",
        "వ్యాపారం", "టెక్నాలజీ", "ఆరోగ్యం", "విద్య", "వ్యవసాయం"
    ];
    if (mainCategories.includes(category)) {
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
export function isStatewideOrBroadBreaking(n: any): boolean {
    const fullText = `${n.headline?.telugu || ""} ${n.headline?.english || ""} ${n.headline || ""} ${n.content?.telugu || ""} ${n.content || ""} ${n.body?.telugu || ""}`;
    const headline = n.headline?.telugu || n.headline?.english || n.headline || "";
    const authorOrSource = n.sourceName || n.socialAuthorName || n.reporter?.name || "";
    const isLeader = isTopTeluguLeaderStatement(fullText, headline, authorOrSource);

    // Pure local district/mandal news must NEVER leak to all_users unless genuinely a top Telugu leader statement
    if ((n.category === "జిల్లా వార్త" || n.category === "స్థానిక వార్తలు") && !isLeader) {
        return false;
    }

    if (n.isGlobal === true && n.category !== "జిల్లా వార్త" && n.category !== "స్థానిక వార్తలు") return true;

    // 🏛️ Top Telugu Leaders direct statements/announcements are statewide breaking news
    if (isLeader) {
        return true;
    }

    const broadDistricts = ["State", "National", "International", "తెలంగాణ", "ఆంధ్రప్రదేశ్", "భారతదేశం", "ప్రపంచం", "General", "AP", "TS"];
    if (n.district && broadDistricts.some(d => d.toLowerCase() === (n.district + "").toLowerCase())) {
        return true;
    }
    const mainCategories = ["రాజకీయం", "జాతీయం", "ప్రపంచం", "క్రీడలు", "వ్యాపారం", "టెక్నాలజీ", "వినోదం", "విద్య", "ఆరోగ్యం"];
    if (mainCategories.includes(n.category) && n.category !== "జిల్లా వార్త" && getNormalizedQualityScore(n) >= 70) {
        return true;
    }
    if (fullText.includes("ముఖ్యమంత్రి") || fullText.includes("ప్రధానమంత్రి") || fullText.includes("కేబినెట్") || fullText.includes("బడ్జెట్") || fullText.includes("ఆర్డినెన్స్") || fullText.includes("హైకోర్టు") || fullText.includes("సుప్రీంకోర్టు") || fullText.includes("ఎన్నికల")) {
        if (n.category !== "జిల్లా వార్త" && n.category !== "స్థానిక వార్తలు") {
            return true;
        }
    }
    return false;
}

// ==========================================
// DAILY BREAKING NOTIFICATION ATOMIC LIMITER + ROLLBACK
// Caps statewide breaking alerts to max 6/day (and district breaking to 3/day)
// Incremented ONLY after all gates (Quiet Hours, Duplicate, Cooldown) pass!
// ==========================================
async function checkAndIncrementLimitAtomic(db: admin.firestore.Firestore, docName: string, maxLimit: number): Promise<boolean> {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const docRef = db.collection('settings').doc(docName);

    return await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);
        const data = doc.data();

        let currentCount = 0;
        if (doc.exists && data && data.date === today) {
            currentCount = Number(data.count || 0);
        }

        if (currentCount >= maxLimit) {
            return false;
        }

        const nextCount = currentCount + 1;
        transaction.set(docRef, {
            date: today,
            count: nextCount,
            lastSentAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return true;
    });
}

async function decrementLimitAtomic(db: admin.firestore.Firestore, docName: string): Promise<void> {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const docRef = db.collection('settings').doc(docName);

    await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);
        const data = doc.data();
        if (doc.exists && data && data.date === today && Number(data.count || 0) > 0) {
            transaction.set(docRef, {
                date: today,
                count: Number(data.count) - 1
            }, { merge: true });
        }
    }).catch(() => {});
}

// ==========================================
// TRENDING SCORE ALGORITHM (Quality-First + Real Engagement + Gentle Freshness Decay + Image Bonus)
// Guarantees a high-quality, engaging story (e.g. 3h old, qualityScore 9.0) cleanly beats 5m-old low-quality filler.
// ==========================================
export function calculateTrendingScore(n: any, nowMs: number = Date.now()): number {
    const views = getEngagementViews(n);
    const qualityScore100 = getNormalizedQualityScore(n);

    let ageHours = 1;
    const ts = n.timestamp;
    if (ts && typeof ts.toDate === 'function') {
        ageHours = Math.max(0.2, (nowMs - ts.toDate().getTime()) / (1000 * 60 * 60));
    } else if (ts && typeof ts._seconds === 'number') {
        ageHours = Math.max(0.2, (nowMs - ts._seconds * 1000) / (1000 * 60 * 60));
    } else if (typeof ts === 'number' && ts > 0) {
        ageHours = Math.max(0.2, (nowMs - ts) / (1000 * 60 * 60));
    }

    // Rich notification bonus: Articles with images get 20% ranking boost for BigPicture CTR
    const hasImage = !!(n.thumbnailUrl || n.mediaUrl);
    const imageMultiplier = hasImage ? 1.2 : 1.0;

    // Penalize low-quality or personal-praise filler stories so they never win over real journalism
    const isLowQualityOrPraise = qualityScore100 < 60 || n.qualitySignals?.isPersonalPraise === true;
    const qualityPenalty = isLowQualityOrPraise ? 0.65 : 1.0;

    // Quality-First + Engagement formula with gentle freshness decay:
    // (qualityScore100 * 6 + min(views * 1.5, 450)) / (ageHours + 2.5)^0.85
    const cappedEngagement = Math.min(views * 1.5, 450);
    const rawStrength = (qualityScore100 * 6) + cappedEngagement;
    return (rawStrength / Math.pow(ageHours + 2.5, 0.85)) * imageMultiplier * qualityPenalty;
}

// ==========================================
// DYNAMIC TTL PER SCHEDULED SLOT
// Avoids notifications lingering past their relevant time window or waking users at midnight
// ==========================================
export function getScheduledTTL(hour: number): number {
    if (hour === 8)  return 4 * 60 * 60 * 1000;   // 4h (valid till 12 PM)
    if (hour === 13) return 4 * 60 * 60 * 1000;   // 4h (valid till 5 PM)
    if (hour === 18) return 2.5 * 60 * 60 * 1000; // 2.5h (valid till 8:30 PM)
    if (hour === 21) return 1.5 * 60 * 60 * 1000; // 1.5h (valid till 10:30 PM, strictly expires before sleep hours!)
    return 2 * 60 * 60 * 1000;
}

// ==========================================
// TIMESTAMP NORMALIZER FOR COOLDOWNS
// ==========================================
function toEpochMillis(val: any): number {
    if (!val) return 0;
    if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
    if (typeof val.toMillis === 'function') return val.toMillis();
    if (typeof val.toDate === 'function') return val.toDate().getTime();
    if (typeof val._seconds === 'number') return val._seconds * 1000;
    const parsed = new Date(val).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
}

// ==========================================
// PURE BREAKING GATE EVALUATOR (Testable without Firestore)
// Enforces exact gate ordering BEFORE any daily quota is consumed:
//   1. Global enabled / auto-expiring pause
//   2. Eligibility + quality floor + age <= 6h
//   3. Quiet Hours (11 PM - 6 AM IST, unless life-threatening)
//   4. Duplicate postId & storyFingerprint
//   5. Independent Per-Scope Cooldown (Statewide 45m, District 30m)
// ==========================================
export interface BreakingGateContext {
    postId: string;
    after: any;
    settingsData: any;
    nowMs?: number;
    istHour?: number;
}

export interface BreakingGateResult {
    allowed: boolean;
    reason?: string;
    isStatewide: boolean;
    canonicalDistrict: string | null;
    targetTopic: string;
    limitDocName: string;
    maxLimit: number;
    isLifeThreatening: boolean;
    isLeaderBreaking: boolean;
    tone: string;
    ageHours: number;
    districtSlug: string;
}

export function evaluateBreakingGate(ctx: BreakingGateContext): BreakingGateResult {
    const nowMs = ctx.nowMs ?? Date.now();
    const istHour = ctx.istHour ?? parseInt(new Intl.DateTimeFormat('en-GB', {
        hour: 'numeric',
        hour12: false,
        timeZone: 'Asia/Kolkata'
    }).format(new Date(nowMs)));

    const { postId, after, settingsData = {} } = ctx;
    const baseFail = (reason: string, extra: Partial<BreakingGateResult> = {}): BreakingGateResult => ({
        allowed: false,
        reason,
        isStatewide: true,
        canonicalDistrict: null,
        targetTopic: 'all_users',
        limitDocName: 'notif_daily_breaking',
        maxLimit: 6,
        isLifeThreatening: false,
        isLeaderBreaking: false,
        tone: String(after?.tone || '').toUpperCase(),
        ageHours: 0,
        districtSlug: '',
        ...extra
    });

    // 1. Kill-switch & auto-expiring pause
    if (settingsData?.breakingNotificationsEnabled === false) {
        return baseFail('globally_disabled');
    }
    if (isPauseActive(settingsData?.pauseBreakingUntil, nowMs)) {
        return baseFail('paused_temporarily');
    }

    // 2. Eligibility, quality floor & age
    const fullText = `${after?.headline?.telugu || ""} ${after?.headline?.english || ""} ${after?.headline || ""} ${after?.content?.telugu || ""} ${after?.content || ""} ${after?.body?.telugu || ""}`;
    const headline = after?.headline?.telugu || after?.headline?.english || after?.headline || "";
    const authorOrSource = after?.sourceName || after?.socialAuthorName || after?.reporter?.name || "";
    const isLeaderBreaking = isTopTeluguLeaderStatement(fullText, headline, authorOrSource);

    const lowerFullText = fullText.toLowerCase();
    const isLifeThreatening = [
        "భూకంపం", "తుఫాను", "వరదలు", "సునామి", "భారీ విపత్తు",
        "సైరన్", "ఎమర్జెన్సీ", "తీవ్ర ప్రమాదం", "కుప్పకూలిన",
        "విష వాయువు", "గ్యాస్ లీక్", "ఉగ్రవాద"
    ].some(k => lowerFullText.includes(k));

    const quality100 = getNormalizedQualityScore(after);
    const tone = String(after?.tone || "").toUpperCase();
    const isExplicitBreaking = after?.isBreaking === true || tone === 'BREAKING' || tone === 'URGENT';
    const isImportantNews = tone === 'IMPORTANT' && (after?.notificationWorthy === true || quality100 >= 75);

    if (!isExplicitBreaking && !isLeaderBreaking && !isImportantNews) {
        return baseFail('not_breaking_eligible', { isLeaderBreaking, tone });
    }

    // Quality floor for breaking: protect users from low-quality spam tagged IMPORTANT/leader
    if (!isLifeThreatening && after?.isBreaking !== true && quality100 < 70) {
        return baseFail('below_breaking_quality_floor', { isLeaderBreaking, tone });
    }

    // Age check — 6 గంటల కంటే పాత news కి breaking send వద్దు
    const tsMillis = toEpochMillis(after?.timestamp);
    const ageHours = tsMillis > 0 ? Math.max(0, (nowMs - tsMillis) / (1000 * 60 * 60)) : 0;
    if (ageHours > 6) {
        return baseFail('too_old', { ageHours, isLeaderBreaking, tone });
    }

    // Scope resolution
    const isStatewide = isStatewideOrBroadBreaking(after);
    const canonicalDistrict = getCanonicalDistrict(after?.district);
    const isLocalDistrictBreaking = !isStatewide && !!canonicalDistrict;
    const districtSlug = canonicalDistrict ? slugify(canonicalDistrict) : 'district';

    const targetTopic = isStatewide
        ? 'all_users'
        : (isLocalDistrictBreaking ? getTopicName("district", canonicalDistrict!) : 'all_users');
    const limitDocName = isStatewide ? 'notif_daily_breaking' : `notif_daily_breaking_${districtSlug}`;
    const maxLimit = isStatewide ? 6 : 3;

    const scopeInfo = {
        isStatewide,
        canonicalDistrict,
        targetTopic,
        limitDocName,
        maxLimit,
        isLifeThreatening,
        isLeaderBreaking,
        tone,
        ageHours,
        districtSlug
    };

    // 3. 🌙 QUIET HOURS (11:00 PM – 6:00 AM IST) — checked BEFORE quota increment!
    const isQuietHour = istHour >= 23 || istHour < 6;
    if (isQuietHour && !isLifeThreatening) {
        return baseFail('quiet_hours', scopeInfo);
    }

    // 4. Duplicate ID & Story Fingerprint check — checked BEFORE quota increment!
    const lastSentMap = settingsData?.lastSentNewsIdMap || {};
    const recentGeneralIds: string[] = Array.isArray(settingsData?.recentGeneralIds) ? settingsData.recentGeneralIds : [];
    const recentFingerprints: string[] = Array.isArray(settingsData?.recentFingerprints) ? settingsData.recentFingerprints : [];
    const fp = typeof after?.storyFingerprint === 'string' && !after.storyFingerprint.startsWith('gen_')
        ? after.storyFingerprint.trim()
        : '';

    if (
        lastSentMap['general'] === postId ||
        lastSentMap[targetTopic] === postId ||
        recentGeneralIds.includes(postId) ||
        (fp && recentFingerprints.includes(fp))
    ) {
        return baseFail('duplicate_or_fingerprint', scopeInfo);
    }

    // 5. Independent Per-Scope Cooldown — checked BEFORE quota increment!
    // Statewide breaking: 45 min cooldown (`lastStateBreakingAt`, fallback `lastBreakingAt`)
    // District breaking: 30 min cooldown per district (`lastDistrictBreakingAt[districtSlug]`)
    if (!isLifeThreatening) {
        if (isStatewide) {
            const lastStateMs = toEpochMillis(settingsData?.lastStateBreakingAt) || toEpochMillis(settingsData?.lastBreakingAt);
            const elapsedMin = (nowMs - lastStateMs) / (60 * 1000);
            if (lastStateMs > 0 && elapsedMin < 45) {
                return baseFail('state_cooldown_active', scopeInfo);
            }
        } else {
            const distMap = settingsData?.lastDistrictBreakingAt || {};
            const lastDistMs = toEpochMillis(distMap[districtSlug]);
            const elapsedMin = (nowMs - lastDistMs) / (60 * 1000);
            if (lastDistMs > 0 && elapsedMin < 30) {
                return baseFail('district_cooldown_active', scopeInfo);
            }
        }
    }

    return {
        allowed: true,
        ...scopeInfo
    };
}

// ==========================================
// SCHEDULED NOTIFICATIONS — 4 times/day (8 AM, 1 PM, 6 PM, 9 PM IST)
// Ranking: Quality-First Trending Score (QualityScore + Real Views + Gentle Freshness + Image Bonus)
// ==========================================
export const sendPersonalizedNotification = onSchedule({
    schedule: "0 8,13,18,21 * * *",
    timeZone: "Asia/Kolkata",
    timeoutSeconds: 540,
    memory: "1GiB"
}, async () => {
    const db = admin.firestore();

    const settingsRef = db.collection('settings').doc('notifications');
    const settingsDoc = await settingsRef.get();
    const settingsData = settingsDoc.exists ? settingsDoc.data() : {};

    if (settingsData?.scheduledNotificationsEnabled === false) {
        logger.log(`[NOTIF] Scheduled notifications globally disabled in settings/notifications. Skipping run.`);
        return;
    }
    if (isPauseActive(settingsData?.pauseScheduledUntil)) {
        const remainingHours = ((Number(settingsData?.pauseScheduledUntil) - Date.now()) / (1000 * 60 * 60)).toFixed(1);
        logger.log(`[NOTIF] Scheduled notifications paused for next ${remainingHours}h via pauseScheduledUntil. Skipping run.`);
        return;
    }

    const lastSentMap = settingsData?.lastSentNewsIdMap || {};
    const recentGeneralIds: string[] = Array.isArray(settingsData?.recentGeneralIds)
        ? [...settingsData.recentGeneralIds]
        : (lastSentMap['general'] ? [lastSentMap['general']] : []);
    const recentFingerprints: string[] = Array.isArray(settingsData?.recentFingerprints)
        ? [...settingsData.recentFingerprints]
        : [];
    const updatedMap = { ...lastSentMap };

    const istHour = parseInt(new Intl.DateTimeFormat('en-GB', {
        hour: 'numeric',
        hour12: false,
        timeZone: 'Asia/Kolkata'
    }).format(new Date()));

    logger.log(`[NOTIF] Scheduled run started at IST Hour: ${istHour}`);

    // 🛡️ NIGHT-TIME SHIELD (10 PM to 7 AM IST):
    if (istHour >= 22 || istHour < 7) {
        logger.log(`[NOTIF] Night-time guard active (IST ${istHour}h). Skipping scheduled run.`);
        return;
    }

    // Only allow designated slots (8 AM, 1 PM, 6 PM, 9 PM)
    if (istHour !== 8 && istHour !== 13 && istHour !== 18 && istHour !== 21) {
        logger.log(`[NOTIF] Off-schedule hour: ${istHour}. Skipping run.`);
        return;
    }

    const windowMillis = 24 * 60 * 60 * 1000;
    const sinceTime = new Date(Date.now() - windowMillis);

    // 1. Fetch news: notificationWorthy=true వార్తలు (Strictly bounded to 100 reads)
    const newsMap = new Map<string, any>();
    const newsSnapshot = await db.collection('news')
        .where('approved', '==', true)
        .where('notificationWorthy', '==', true)
        .where('timestamp', '>', sinceTime)
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();

    for (const doc of newsSnapshot.docs) {
        newsMap.set(doc.id, { id: doc.id, ...doc.data() });
    }

    // Fallback if explicit notificationWorthy pool is sparse (<15)
    if (newsMap.size < 15) {
        logger.log(`[NOTIF] Worthy pool has ${newsMap.size} docs. Augmenting with bounded approved news (limit 100)...`);
        const fallbackSnapshot = await db.collection('news')
            .where('approved', '==', true)
            .where('timestamp', '>', sinceTime)
            .orderBy('timestamp', 'desc')
            .limit(100)
            .get();

        for (const doc of fallbackSnapshot.docs) {
            const d = doc.data();
            if (d.notificationWorthy !== false && !newsMap.has(doc.id)) {
                newsMap.set(doc.id, { id: doc.id, ...d });
            }
        }
    }

    // At 1 PM District Slot, also fetch bounded local district news (limit 100) so AP & TS districts aren't starved
    if (istHour === 13) {
        try {
            const districtSnapshot = await db.collection('news')
                .where('approved', '==', true)
                .where('category', '==', 'జిల్లా వార్త')
                .where('timestamp', '>', sinceTime)
                .orderBy('timestamp', 'desc')
                .limit(100)
                .get();

            for (const doc of districtSnapshot.docs) {
                const d = doc.data();
                if (d.notificationWorthy !== false && !newsMap.has(doc.id)) {
                    newsMap.set(doc.id, { id: doc.id, ...d });
                }
            }
        } catch (distQueryErr: any) {
            logger.warn(`[NOTIF] 1 PM supplemental district query skipped (index/fallback): ${distQueryErr.message}`);
        }
    }

    const allNews = Array.from(newsMap.values());
    if (allNews.length === 0) {
        logger.log(`[NOTIF] No approved news found in last 24h. Exiting.`);
        return;
    }

    // Ranking: Quality-First Trending Score
    allNews.sort((a: any, b: any) => calculateTrendingScore(b) - calculateTrendingScore(a));

    // Apply quality floor (>= 60 on 0-100 scale) for scheduled notifications, with graceful fallback
    const qualityFiltered = allNews.filter((n: any) => getNormalizedQualityScore(n) >= 60);
    const rankedPool = qualityFiltered.length > 0 ? qualityFiltered : allNews;

    const mainNewsList = rankedPool.filter(isMainNews);
    const candidateMainNews = mainNewsList.length > 0 ? mainNewsList : rankedPool;

    const isFreshFingerprint = (n: any) => {
        const fp = typeof n?.storyFingerprint === 'string' && !n.storyFingerprint.startsWith('gen_')
            ? n.storyFingerprint.trim()
            : '';
        return !fp || !recentFingerprints.includes(fp);
    };
    const recordFingerprint = (n: any) => {
        const fp = typeof n?.storyFingerprint === 'string' && !n.storyFingerprint.startsWith('gen_')
            ? n.storyFingerprint.trim()
            : '';
        if (fp && !recentFingerprints.includes(fp)) {
            recentFingerprints.unshift(fp);
        }
    };

    let sentTopicsCount = 0;
    let lastSentHeadline = "";
    let lastSentNewsId = "";

    // =========================================================================
    // 🛡️ SINGLE DEDICATED PURPOSE PER SLOT (Zero Flooding):
    // 8 AM  -> General Morning News (all_users)
    // 13 PM -> District Local News (district_*)
    // 18 PM -> Category News (cat_*)
    // 21 PM -> General Night Roundup (all_users)
    // =========================================================================

    // --- 1. General Notification — 8 AM & 21 PM Slots ONLY ---
    const isGeneralSlot = istHour === 8 || istHour === 21;
    if (isGeneralSlot) {
        let topNews = candidateMainNews.find((n: any) => !recentGeneralIds.includes(n.id) && isFreshFingerprint(n));
        if (!topNews) {
            topNews = candidateMainNews.find((n: any) => !recentGeneralIds.includes(n.id))
                || candidateMainNews.find((n: any) => lastSentMap['general'] !== n.id)
                || candidateMainNews[0];
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
                    getScheduledTTL(istHour),
                    { topic: 'all_users' },
                    { slotTag: istHour === 8 ? 'alfa_morning_slot' : 'alfa_night_slot' }
                );

                await admin.messaging().send(message);
                updatedMap['general'] = topNews.id;
                recentGeneralIds.unshift(topNews.id);
                recordFingerprint(topNews);
                sentTopicsCount++;
                lastSentHeadline = String(headline).substring(0, 120);
                lastSentNewsId = topNews.id;
                logger.log(`[NOTIF] Pradhaana Vaartha (General) sent: newsId=${topNews.id}, quality=${getNormalizedQualityScore(topNews)}, views=${getEngagementViews(topNews)}, hour=${istHour}`);
            } catch (e: any) {
                logger.error(`[NOTIF] General send failed:`, e.message);
            }
        }
    }

    // --- 2. District Notification — 13 PM Slot ONLY ---
    if (istHour === 13) {
        for (const district of DISTRICTS) {
            const districtNews = rankedPool.find((n: any) => {
                const canonicalDist = getCanonicalDistrict(n.district);
                const isCatMatch = n.category === "జిల్లా వార్త" && Array.isArray(n.categories) &&
                    n.categories.some((c: string) => getCanonicalDistrict(c) === district);
                return (canonicalDist === district || isCatMatch) &&
                       lastSentMap[district] !== n.id &&
                       lastSentMap['general'] !== n.id &&
                       isFreshFingerprint(n);
            }) || allNews.find((n: any) => {
                const canonicalDist = getCanonicalDistrict(n.district);
                return canonicalDist === district && lastSentMap[district] !== n.id && lastSentMap['general'] !== n.id;
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
                    { ...districtNews, district },
                    `📍 ${district}: ${shortTitle}`,
                    "local_news_v2",
                    imageUrl,
                    getScheduledTTL(istHour),
                    { topic: topicName }
                );

                await admin.messaging().send(message);
                updatedMap[district] = districtNews.id;
                recordFingerprint(districtNews);
                sentTopicsCount++;
                if (!lastSentHeadline) {
                    lastSentHeadline = `${district}: ${shortTitle}`;
                    lastSentNewsId = districtNews.id;
                }
                logger.log(`[NOTIF] District ${district}: newsId=${districtNews.id}, quality=${getNormalizedQualityScore(districtNews)}, views=${getEngagementViews(districtNews)}`);
            } catch (e: any) {
                logger.error(`[NOTIF] Error in district topic ${topicName}:`, e.message);
            }
        }
    }

    // --- 3. Category Notification — 18 PM Slot ONLY ---
    if (istHour === 18) {
        for (const [teluguCat, topicName] of Object.entries(CATEGORY_TOPICS)) {
            const catKey = topicName;

            const catNews = rankedPool.find((n: any) => {
                const isCat = n.category === teluguCat || (Array.isArray(n.categories) && n.categories.includes(teluguCat));
                return isCat &&
                       lastSentMap['general'] !== n.id &&
                       lastSentMap[catKey] !== n.id &&
                       isFreshFingerprint(n);
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
                    getScheduledTTL(istHour),
                    { topic: topicName }
                );
                await admin.messaging().send(message);
                updatedMap[catKey] = catNews.id;
                recordFingerprint(catNews);
                sentTopicsCount++;
                if (!lastSentHeadline) {
                    lastSentHeadline = `${teluguCat}: ${shortTitle}`;
                    lastSentNewsId = catNews.id;
                }
                logger.log(`[NOTIF] Category ${teluguCat}: newsId=${catNews.id}, topic=${topicName}`);
            } catch (e: any) {
                logger.error(`[NOTIF] Error in category topic ${topicName}:`, e.message);
            }
        }
    }

    const updatedRecentGeneral = Array.from(new Set(recentGeneralIds)).slice(0, 30);
    const updatedRecentFingerprints = Array.from(new Set(recentFingerprints)).slice(0, 30);

    await settingsRef.set({
        lastSentNewsIdMap: updatedMap,
        recentGeneralIds: updatedRecentGeneral,
        recentFingerprints: updatedRecentFingerprints,
        lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
        lastScheduledSummary: {
            slotHour: istHour,
            sentTopicsCount,
            candidateCount: allNews.length,
            headline: lastSentHeadline,
            newsId: lastSentNewsId,
            sentAt: admin.firestore.FieldValue.serverTimestamp()
        }
    }, { merge: true });

    // Update scheduled run record for monitoring
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    await db.collection('settings').doc('notif_daily_scheduled').set({
        date: today,
        lastRunHour: istHour,
        sentTopicsCount,
        lastRunAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(() => {});
});

// ==========================================
// BREAKING / IMPORTANT NEWS INSTANT TRIGGER
// Statewide max 6/day (45m cooldown) | District max 3/day (30m per-district cooldown)
// Quiet Hours, Duplicates & Cooldowns are strictly validated BEFORE consuming daily quota!
// ==========================================
export async function dispatchBreakingNotification(postId: string, after: any, _before?: any): Promise<boolean> {
    const db = admin.firestore();
    const settingsRef = db.collection('settings').doc('notifications');
    const settingsDoc = await settingsRef.get().catch(() => null);
    const settingsData = settingsDoc?.exists ? settingsDoc.data() : {};

    const gate = evaluateBreakingGate({ postId, after, settingsData });
    if (!gate.allowed) {
        logger.log(`[BREAKING] Suppressed ${postId}: reason=${gate.reason} (topic=${gate.targetTopic}, age=${gate.ageHours.toFixed(1)}h)`);
        return false;
    }

    // All non-quota gates passed (Enabled, Eligible, Quality, Age, Quiet Hours, Duplicate, Per-Scope Cooldown).
    // Now atomically reserve daily quota slot — rollback if FCM send fails!
    const quotaReserved = await checkAndIncrementLimitAtomic(db, gate.limitDocName, gate.maxLimit);
    if (!quotaReserved && !gate.isLifeThreatening) {
        logger.log(`[BREAKING] Daily cap reached (${gate.limitDocName}, max ${gate.maxLimit}). Suppressing ${postId}`);
        return false;
    }

    const notifTitle = after.notificationTitle || after.headline?.telugu || after.headline?.english || after.headline || "తాజా వార్త";
    const shortBreaking = notifTitle.length > 70 ? notifTitle.substring(0, 70).trim() + "..." : notifTitle;
    const imageUrl = after.thumbnailUrl || after.mediaUrl || "";

    const breakingTitle = (gate.tone === 'BREAKING' || after.isBreaking === true || gate.isLeaderBreaking)
        ? `🔴 Breaking: ${shortBreaking}`
        : (gate.tone === 'URGENT')
            ? `⚡ అత్యవసరం: ${shortBreaking}`
            : `📌 ముఖ్యాంశం: ${shortBreaking}`;

    try {
        const news = {
            id: postId,
            ...after,
            district: gate.canonicalDistrict || after.district || ""
        };

        const message = buildNewsMessage(
            news,
            breakingTitle,
            "breaking_news",
            imageUrl,
            1800000, // 30 min TTL
            { topic: gate.targetTopic },
            { silent: false }
        );
        await admin.messaging().send(message);

        const lastSentMap = settingsData?.lastSentNewsIdMap || {};
        const recentGeneralIds: string[] = Array.isArray(settingsData?.recentGeneralIds) ? settingsData.recentGeneralIds : [];
        const recentFingerprints: string[] = Array.isArray(settingsData?.recentFingerprints) ? settingsData.recentFingerprints : [];
        const category = after.category || after.categories?.[0] || "";
        const catKey = getCategoryTopic(category) || (category ? `cat_${category}` : "");

        const updatedHistory: any = {
            ...lastSentMap,
            [gate.targetTopic]: postId
        };
        if (gate.isStatewide) {
            updatedHistory['general'] = postId;
        }
        if (catKey) {
            updatedHistory[catKey] = postId;
        }

        const updatedRecentGeneral = gate.isStatewide
            ? [postId, ...recentGeneralIds.filter(id => id !== postId)].slice(0, 30)
            : recentGeneralIds;

        const fp = typeof after?.storyFingerprint === 'string' && !after.storyFingerprint.startsWith('gen_')
            ? after.storyFingerprint.trim()
            : '';
        const updatedFingerprints = fp
            ? [fp, ...recentFingerprints.filter(x => x !== fp)].slice(0, 30)
            : recentFingerprints;

        const nowMs = Date.now();
        const cooldownUpdate: Record<string, any> = {
            lastBreakingAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (gate.isStatewide) {
            cooldownUpdate.lastStateBreakingAt = admin.firestore.FieldValue.serverTimestamp();
        } else {
            const existingDistrictCooldowns = { ...(settingsData?.lastDistrictBreakingAt || {}) };
            existingDistrictCooldowns[gate.districtSlug] = nowMs;
            cooldownUpdate.lastDistrictBreakingAt = existingDistrictCooldowns;
        }

        await settingsRef.set({
            lastSentNewsIdMap: updatedHistory,
            recentGeneralIds: updatedRecentGeneral,
            recentFingerprints: updatedFingerprints,
            ...cooldownUpdate,
            lastBreakingSummary: {
                newsId: postId,
                headline: shortBreaking,
                topic: gate.targetTopic,
                isStatewide: gate.isStatewide,
                district: gate.canonicalDistrict || "",
                sentAt: admin.firestore.FieldValue.serverTimestamp()
            }
        }, { merge: true });

        logger.log(`[BREAKING] ✅ Sent Hybrid FCM to ${gate.targetTopic} for ${postId} (isStatewide=${gate.isStatewide}, tone=${gate.tone}, age=${gate.ageHours.toFixed(1)}h)`);
        return true;
    } catch (err: any) {
        if (quotaReserved) {
            await decrementLimitAtomic(db, gate.limitDocName);
        }
        logger.error(`[BREAKING_ERR] ${postId}:`, err.message);
        return false;
    }
}

export const onNewsPostApprovedNotify = onDocumentWritten({
    document: "news/{postId}",
    region: REGION,
    memory: "256MiB",
    timeoutSeconds: 60,
    maxInstances: 5
}, async (event) => {
    const before = event.data?.before?.data();
    const after  = event.data?.after?.data();
    if (!after) return;

    // Instant guard: if already handled directly by onNewsPostCreated pipeline, skip to avoid duplicate executions
    if (after.pipelineHandled === true || after.notificationHandled === true) return;

    const postId = event.params.postId;

    // Only fire when approved changes false → true
    const wasApproved = before?.approved === true;
    const isNowApproved = after.approved === true;
    if (wasApproved || !isNowApproved) return;

    await dispatchBreakingNotification(postId, after, before);
});

// ==========================================
// CATEGORY TOPIC NAME HELPER
// ==========================================
export function getCategoryTopic(category: string): string | null {
    return CATEGORY_TOPICS[category] || null;
}


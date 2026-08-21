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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupOldNews = exports.checkSevereWeatherAlerts = exports.generateDailyCartoon = exports.scheduleHistoryOfTheDay = exports.scheduleQuoteOfTheDay = exports.scheduleFestivalGreeting = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const genai_1 = require("@google/genai");
const utils_1 = require("./utils");
const db = admin.firestore();
/**
 * 2. Festival Greeting Function
 */
exports.scheduleFestivalGreeting = (0, scheduler_1.onSchedule)({ schedule: "0 5 * * *", timeZone: "Asia/Kolkata", memory: "1GiB", timeoutSeconds: 540 }, async (event) => {
    const dateStr = (0, utils_1.getISTDateString)();
    console.log(`[FESTIVAL] Checking festivals for ${dateStr}...`);
    const schema = {
        type: genai_1.Type.OBJECT,
        properties: { isFestival: { type: genai_1.Type.BOOLEAN }, festivalTe: { type: genai_1.Type.STRING }, greetingTe: { type: genai_1.Type.STRING }, greetingEn: { type: genai_1.Type.STRING }, imagePrompt: { type: genai_1.Type.STRING } },
        required: ["isFestival", "festivalTe", "greetingTe", "greetingEn", "imagePrompt"]
    };
    try {
        await (0, utils_1.runWithAIFallback)(async (ai, modelName) => {
            const checkRes = await ai.models.generateContent({
                model: modelName,
                contents: [{ role: "user", parts: [{ text: `Today's exact date is ${dateStr}.
                Check if there is ANY festival, important religious day, Jayanti (anniversary of a great person), or cultural event celebrated by Telugu people (Hindu, Muslim, Christian, or National holidays) on this date.
                Include not just major festivals, but also regional, minor, and community-specific events (like Ekadashi, Masa Shivaratri, specific Jayantis, or local Telugu traditions).
                Do not invent events. If there is absolutely no special day today, return isFestival: false. Otherwise, return the details in JSON.` }] }],
                config: {
                    systemInstruction: { role: "system", parts: [{ text: "Output JSON only. Be accurate with the Telugu calendar and regional events." }] },
                    temperature: 0.2,
                    responseMimeType: "application/json",
                    responseJsonSchema: schema
                }
            });
            const data = (0, utils_1.parseAIJson)(checkRes.text || "{}");
            if (!data.isFestival || !data.festivalTe || data.festivalTe === "None") {
                console.log(`[FESTIVAL] No major festival found for today (${dateStr}).`);
                return;
            }
            console.log(`[FESTIVAL] Found festival: ${data.festivalTe}. Generating greeting...`);
            let mediaUrl = "";
            const buffer = await (0, utils_1.generateImageWithRetry)(ai, `A stunning, high-quality traditional Indian spiritual art illustration for the festival of ${data.festivalTe}.
            Details: ${data.imagePrompt}.
            Style: Divine aesthetic, vibrant festival colors, rich textures, heavenly golden lighting, masterpiece quality.
            Note: Focus on cultural symbols and joyous atmosphere. No text, no human faces looking directly at camera.`, '9:16');
            if (buffer) {
                mediaUrl = await (0, utils_1.saveBufferToStorage)(buffer, "GREETING") || "";
            }
            await db.collection('news').add({
                type: 'greeting',
                postFormat: 'VERTICAL',
                likes: 0,
                comments: 0,
                shares: 0,
                headline: { telugu: `${data.festivalTe} శుభాకాంక్షలు!`, english: `Happy ${data.festivalTe}!` },
                content: { telugu: data.greetingTe, english: data.greetingEn },
                mediaUrl,
                category: 'పండుగలు',
                reporter: { id: 'system', name: 'AlfaNews Team' },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                status: "published",
                approved: true,
                aiProcessed: true
            });
            console.log(`[FESTIVAL] Successfully created greeting post for ${data.festivalTe}.`);
        });
    }
    catch (e) {
        console.error("[FESTIVAL] Error:", e.message);
    }
});
/**
 * 3. Quote of the Day Function
 */
exports.scheduleQuoteOfTheDay = (0, scheduler_1.onSchedule)({ schedule: "0 4 * * *", timeZone: "Asia/Kolkata", memory: "1GiB", timeoutSeconds: 540 }, async (event) => {
    const authorsAndThemes = ['Swami Vivekananda', 'APJ Abdul Kalam', 'Gautam Buddha', 'Mahatma Gandhi', 'Bhagavad Gita', 'Vemana', 'Sumathi Satakam', 'Chanakya', 'Socrates', 'Albert Einstein', 'Confucius', 'Telugu Proverbs', 'Rumi', 'Thirukkural', 'Jiddu Krishnamurti', 'Osho', 'Marcus Aurelius', 'Mother Teresa'];
    const todayStr = (0, utils_1.getISTDateString)();
    const randomSeed = Math.floor(Math.random() * authorsAndThemes.length);
    const selectedTheme = authorsAndThemes[randomSeed];
    const schema = {
        type: genai_1.Type.OBJECT,
        properties: { quoteTe: { type: genai_1.Type.STRING }, quoteEn: { type: genai_1.Type.STRING }, author: { type: genai_1.Type.STRING }, imagePrompt: { type: genai_1.Type.STRING } },
        required: ["quoteTe", "quoteEn", "author", "imagePrompt"]
    };
    try {
        await (0, utils_1.runWithAIFallback)(async (ai, modelName) => {
            const res = await ai.models.generateContent({
                model: modelName,
                contents: [{ role: "user", parts: [{ text: `Today is ${todayStr}. Provide a highly unique, rare, and deeply inspirational Telugu quote by ${selectedTheme}. Do NOT repeat common quotes. Make sure it is 100% unique for this specific date. Output JSON.` }] }],
                config: {
                    responseMimeType: "application/json",
                    responseJsonSchema: schema,
                    temperature: 0.8
                }
            });
            const data = (0, utils_1.parseAIJson)(res.text || "{}");
            if (!data.quoteTe)
                return;
            let mediaUrl = "";
            const buffer = await (0, utils_1.generateImageWithRetry)(ai, `A breathtakingly beautiful and artistic aesthetic background.
            Theme: ${data.imagePrompt}.
            Style: Digital art, soft bokeh, cinematic atmospheric lighting, peaceful, minimalist and inspirational.
            Quality: 8k resolution, harmonious colors. Absolutely no text, no words, no letters, no characters.`, '9:16');
            if (buffer) {
                mediaUrl = await (0, utils_1.saveBufferToStorage)(buffer, "QUOTE") || "";
            }
            await db.collection('news').add({
                type: 'greeting',
                postFormat: 'VERTICAL',
                likes: 1,
                comments: 0,
                shares: 0,
                headline: { telugu: "నేటి మంచి మాట", english: "Quote of the Day" },
                content: { telugu: `${data.quoteTe}\n\n- ${data.author}`, english: `${data.quoteEn}\n\n- ${data.author}` },
                mediaUrl,
                category: 'ప్రేరణ',
                reporter: { id: 'system', name: 'AlfaNews Team' },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                status: "published",
                approved: true,
                aiProcessed: true
            });
        });
    }
    catch (e) {
        console.error("[QUOTE] Error:", e.message);
    }
});
/**
 * 4. On This Day Function
 */
exports.scheduleHistoryOfTheDay = (0, scheduler_1.onSchedule)({ schedule: "30 4 * * *", timeZone: "Asia/Kolkata", memory: "1GiB", timeoutSeconds: 540 }, async (event) => {
    const dateStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long' });
    const schema = {
        type: genai_1.Type.OBJECT,
        properties: { headlineTe: { type: genai_1.Type.STRING }, contentTe: { type: genai_1.Type.STRING }, headlineEn: { type: genai_1.Type.STRING }, contentEn: { type: genai_1.Type.STRING }, imagePrompt: { type: genai_1.Type.STRING } },
        required: ["headlineTe", "contentTe", "headlineEn", "contentEn", "imagePrompt"]
    };
    try {
        await (0, utils_1.runWithAIFallback)(async (ai, modelName) => {
            const res = await ai.models.generateContent({
                model: modelName,
                contents: [{ role: "user", parts: [{ text: `Out of all historical events that happened on ${dateStr}, pick the single most important event. Write a 60 words detailed news about it.
                Also, provide a HIGHLY DETAILED, photorealistic, and safe image prompt that describes the scene without mentioning specific living people, modern politicians, or controversial figures. Focus on the era-appropriate architecture, clothing, and the general atmosphere.
                Generate a single-sentence Telugu headline (max 55 characters) and an English headline (max 12 words). Output JSON.` }] }],
                config: {
                    responseMimeType: "application/json",
                    responseJsonSchema: schema,
                    temperature: 0.5
                }
            });
            const data = (0, utils_1.parseAIJson)(res.text || "{}");
            if (!data.headlineTe)
                return;
            let mediaUrl = "";
            const buffer = await (0, utils_1.generateImageWithRetry)(ai, `A grand cinematic historical reconstruction of the following scene: ${data.imagePrompt}.
            Style: Epic historical movie scene, highly detailed environment, era-appropriate architecture and attire, dramatic atmospheric lighting, photorealistic digital masterpiece.
            Note: Capture the scale and gravity of the moment. No text, no modern objects.`, '16:9');
            if (buffer) {
                mediaUrl = await (0, utils_1.saveBufferToStorage)(buffer, "HISTORY") || "";
            }
            await db.collection('news').add({
                type: 'history',
                headline: { telugu: data.headlineTe, english: data.headlineEn },
                content: { telugu: data.contentTe, english: data.contentEn },
                mediaUrl,
                category: 'చరిత్ర',
                reporter: { id: 'system', name: 'AlfaNews Team' },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                status: "published",
                approved: true,
                aiProcessed: true
            });
        });
    }
    catch (e) {
        console.error("[HISTORY] Error:", e.message);
    }
});
/**
 * 5. Daily Cartoon Function
 */
exports.generateDailyCartoon = (0, scheduler_1.onSchedule)({ schedule: "0 6 * * *", timeZone: "Asia/Kolkata", memory: "1GiB", timeoutSeconds: 540 }, async (event) => {
    const states = ["Andhra Pradesh", "Telangana"];
    const todayStr = (0, utils_1.getISTDateString)();
    for (const state of states) {
        try {
            await (0, utils_1.runWithAIFallback)(async (ai, modelName) => {
                // 1. Fetch recent approved headlines for state context
                let recentNewsSummary = "";
                try {
                    const snap = await db.collection('news')
                        .where('approved', '==', true)
                        .orderBy('timestamp', 'desc')
                        .limit(20)
                        .get();
                    const headlines = snap.docs
                        .map(d => {
                        const data = d.data();
                        const loc = ((data.location || "") + " " + (data.district || "") + " " + (data.state || "")).toLowerCase();
                        const isAP = loc.includes("andhra") || loc.includes("ap") || loc.includes("ఆంధ్ర");
                        const isTS = loc.includes("telangana") || loc.includes("ts") || loc.includes("తెలంగాణ") || loc.includes("hyderabad") || loc.includes("హైదరాబాద్");
                        if ((state === "Andhra Pradesh" && (isAP || !isTS)) || (state === "Telangana" && (isTS || !isAP))) {
                            return data.headline?.telugu || "";
                        }
                        return "";
                    })
                        .filter(Boolean)
                        .slice(0, 5);
                    if (headlines.length > 0) {
                        recentNewsSummary = headlines.join("\n- ");
                    }
                }
                catch (e) {
                    console.warn(`[CARTOON] Could not fetch recent headlines for ${state}:`, e);
                }
                const stateContext = state === 'Andhra Pradesh'
                    ? `Government: NDA (TDP, Jana Sena, BJP). CM: Chandrababu Naidu, Deputy CM: Pawan Kalyan. Opposition: YSRCP (YS Jagan Mohan Reddy).
Key Ongoing Topics: Super Six welfare schemes, Amaravati capital construction, Polavaram project, Deepam free gas cylinders, Sand policy, welfare pensions distribution, assembly debates, central assistance.`
                    : `Government: Congress. CM: Revanth Reddy. Opposition: BRS (KCR, KTR, Harish Rao), BJP (Kishan Reddy, Bandi Sanjay).
Key Ongoing Topics: HYDRAA demolitions & lake rejuvenation, Musi riverfront project, Rythu Bharosa / farmer loan waivers, free RTC bus travel for women, 200 units free power (Gruha Jyothi), job notifications.`;
                const schema = {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        topic: { type: genai_1.Type.STRING, description: "Short topic in Telugu" },
                        visualPrompt: { type: genai_1.Type.STRING, description: "Detailed visual caricature scene description without politician names, words, or speech bubbles" },
                        teluguPunchline: { type: genai_1.Type.STRING, description: "Sharp, witty 1-2 line Telugu dialogue with natural humor" },
                        teluguHeadline: { type: genai_1.Type.STRING, description: "Catchy Telugu headline (max 50 chars)" }
                    },
                    required: ["topic", "visualPrompt", "teluguPunchline", "teluguHeadline"]
                };
                const topicRes = await ai.models.generateContent({
                    model: modelName,
                    contents: [{ role: "user", parts: [{ text: `You are a renowned master Telugu political cartoonist (in the style of legendary cartoonists Sridhar and Shankar).
State: ${state}
Today's Date: ${todayStr}

Political Context & Issues:
${stateContext}
${recentNewsSummary ? `\nRecent Trending News in ${state}:\n- ${recentNewsSummary}` : ''}

Task:
1. Identify a current hot topic or public mood in ${state} and create a clever, humorous satirical cartoon scenario.
2. "visualPrompt": Describe a funny caricature visual scene using symbolic metaphors (e.g. weighing scales, promises umbrella, empty pockets, giant magnifying glass, race track, tug of war, bridge, files pile).
   CRITICAL SAFETY & ART INSTRUCTION: DO NOT name specific real politicians. Describe figures by caricature traits and attire (e.g. 'a smiling politician in white kurta with yellow scarf', 'a leader wearing pink scarf looking puzzled', 'an expressive Indian common man in spectacles scratching his head while holding a grocery bag').
   DO NOT include any text, dialogue, letters, signs, or speech bubbles in the visual description.
3. "teluguPunchline": Write a sharp, witty, humorous Telugu punchline (1-2 lines) reflecting common people's perspective with authentic Telugu humor.
4. "teluguHeadline": A short, catchy Telugu title.

Output strict JSON.` }] }],
                    config: {
                        temperature: 0.85,
                        responseMimeType: "application/json",
                        responseJsonSchema: schema
                    }
                });
                const cartoonData = (0, utils_1.parseAIJson)(topicRes.text || "{}");
                const visual = cartoonData.visualPrompt || "Indian common man observing humorous political promises";
                const punchline = cartoonData.teluguPunchline || cartoonData.teluguHeadline || "నేటి రాజకీయ కార్టూన్";
                // Pure caricature art prompt without text/speech bubbles to prevent garbled letters
                const cartoonPrompt = `A masterpiece colorful 2D Indian political newspaper editorial cartoon illustration.
Scene: ${visual}.
Art Style: Hand-drawn classic Indian newspaper editorial cartoon caricature, vibrant watercolor and ink wash, bold expressive character expressions, clean linework, humorous satirical situation.
Framing: Clean vertical 9:16 composition with focused characters in an Indian city or village backdrop.
CRITICAL MANDATORY RULE: Pure visual illustration only. STRICTLY NO TEXT, NO WORDS, NO SPEECH BUBBLES, NO LETTERS, NO SIGNBOARDS, NO TYPOGRAPHY anywhere in the image.`;
                const buffer = await (0, utils_1.generateImageWithRetry)(ai, cartoonPrompt, '9:16');
                let mediaUrl = "";
                if (buffer) {
                    mediaUrl = await (0, utils_1.saveBufferToStorage)(buffer, `CARTOON_${state.replace(" ", "")}`) || "";
                }
                else {
                    console.warn(`[CARTOON] Image generation failed for ${state}. Posting text-only cartoon status.`);
                }
                await db.collection('news').add({
                    type: 'cartoon',
                    postFormat: 'VERTICAL',
                    likes: 0,
                    comments: 0,
                    shares: 0,
                    headline: {
                        telugu: `${state === 'Andhra Pradesh' ? 'ఆంధ్రప్రదేశ్' : 'తెలంగాణ'} కార్టూన్: ${cartoonData.teluguHeadline || cartoonData.topic || 'నేటి వ్యంగ్యం'}`,
                        english: `${state} Daily Cartoon`
                    },
                    content: {
                        telugu: punchline,
                        english: cartoonData.topic || 'Daily Political Satire'
                    },
                    mediaUrl, // Might be empty if buffer is null
                    category: 'కార్టూన్',
                    location: state,
                    district: state,
                    state: state,
                    reporter: { id: 'BOT_Cartoonist', name: 'Alfa Cartoonist' },
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    status: "published",
                    approved: true,
                    aiProcessed: true
                });
                console.log(`[CARTOON] Successfully created cartoon post for ${state}.`);
            });
        }
        catch (e) {
            console.error(`[CARTOON] Error for ${state}:`, e.message);
        }
    }
});
// ==========================================
// HYPER-LOCAL WEATHER ALERT SYSTEM — User-Driven Dynamic Grid
// ==========================================
// Design:
//   - No hardcoded seed points. Backend reads ONLY the grids where real users exist.
//   - Android writes user's grid key to Firestore settings/active_weather_grids on subscribe.
//   - Backend reads that doc once per run (1 Firestore read) → API call only for live grids.
//   - Schedule: 6AM–8PM IST, every 2 hours (8 runs/day)
//     → ~400 grids × 8 = 3,200 Open-Meteo calls/day (well within free tier)
//   - Sleep hours (8PM–6AM) skipped → no midnight disturbances
//   - Cooldown: 4h per grid key per alert type
//   - FCM topic per grid: "weather_grid_{latKey}_{lonKey}" (0.1° ≈ 10km)
// ==========================================
/**
 * ఒక grid cell కి unique FCM topic name తయారుచేస్తుంది.
 * lat/lon ను 0.1° (≈10km) కి round చేసి safe topic name తయారుచేస్తుంది.
 * Android లో getWeatherGridTopic() తో exactly match అవుతుంది.
 * Example: lat=14.44, lon=79.98 → "weather_grid_144_800"
 */
function getWeatherGridTopic(lat, lon) {
    const latKey = Math.round(lat * 10);
    const lonKey = Math.round(lon * 10);
    return `weather_grid_${latKey}_${lonKey}`;
}
/**
 * Weather code + forecast data బట్టి alert తయారుచేస్తుంది.
 * hoursFromNow: రాబోయే ఎన్ని గంటల్లో (0 = ఇప్పుడే)
 * precipitation: mm/hr
 * Returns { title, body, severity } or null (alert అవసరం లేకపోతే)
 */
function buildWeatherAlert(weatherCode, temp, windSpeed, hoursFromNow, precipitation) {
    const timeStr = hoursFromNow === 0
        ? "ఇప్పుడే"
        : hoursFromNow === 1
            ? "1 గంటలో"
            : `${hoursFromNow} గంటల్లో`;
    if (weatherCode === 95 || weatherCode === 96 || weatherCode === 99) {
        return {
            title: `⚡ పిడుగుల హెచ్చరిక — ${timeStr}`,
            body: `మీ ప్రాంతంలో ${timeStr} ఉరుములు మెరుపులతో కూడిన భారీ వర్షం పడే ప్రమాదం ఉంది. చెట్ల కింద, తెరిచిన ప్రదేశాల్లో నిలబడవద్దు — సురక్షితమైన భవనంలో ఉండండి.`,
            severity: "SEVERE"
        };
    }
    if ((weatherCode === 65 || weatherCode === 82) || precipitation >= 10) {
        return {
            title: `⛈️ భారీ వర్ష హెచ్చరిక — ${timeStr}`,
            body: `మీ ప్రాంతంలో ${timeStr} భారీ వర్షం పడే అవకాశం ఉంది. తక్కువ దృశ్యమానత వుంటుంది, వాహనచోదకులు జాగ్రత్తగా ఉండాలి. రైతు సోదరులు ధాన్యం నిల్వలు జాగ్రత్త పరుచుకోవాలి.`,
            severity: "SEVERE"
        };
    }
    if ((weatherCode >= 61 && weatherCode <= 82) || precipitation >= 2.5) {
        return {
            title: `🌧️ వర్ష సూచన — ${timeStr}`,
            body: `మీ ప్రాంతంలో ${timeStr} వర్షం పడే అవకాశం ఉంది. బయటకు వెళ్లేవారు గొడుగు వెంట ఉంచుకోండి.`,
            severity: "WARNING"
        };
    }
    if (windSpeed >= 60) {
        return {
            title: `🌪️ తీవ్ర గాలుల హెచ్చరిక — ${timeStr}`,
            body: `మీ ప్రాంతంలో ${timeStr} ${Math.round(windSpeed)} km/h వేగంతో తీవ్రమైన గాలులు వీచే అవకాశం ఉంది. బాహ్య నిర్మాణాలు, ఫ్లెక్సీలు జాగ్రత్తగా ఉంచుకోండి.`,
            severity: "WARNING"
        };
    }
    if (weatherCode === 45 || weatherCode === 48) {
        return {
            title: `🌫️ దట్టమైన పొగమంచు హెచ్చరిక — ${timeStr}`,
            body: `మీ ప్రాంతంలో ${timeStr} దట్టమైన పొగమంచు ఉంటుంది. వాహనదారులు ఫాగ్ లైట్లు వాడుతూ నెమ్మదిగా ప్రయాణించండి.`,
            severity: "WARNING"
        };
    }
    if (temp >= 42) {
        return {
            title: `🔥 తీవ్ర ఎండ హెచ్చరిక`,
            body: `మీ ప్రాంతంలో ఉష్ణోగ్రత ${Math.round(temp)}°C కి చేరింది. మధ్యాహ్నం బయటకు రాకండి, తగినంత నీరు తాగండి — వడదెబ్బ తగిలే ప్రమాదం ఉంది.`,
            severity: "SEVERE"
        };
    }
    if (weatherCode >= 51 && weatherCode <= 57) {
        return {
            title: `🌦️ చినుకుల సూచన — ${timeStr}`,
            body: `మీ ప్రాంతంలో ${timeStr} తేలికపాటి చినుకులు పడే అవకాశం ఉంది.`,
            severity: "INFO"
        };
    }
    return null;
}
/**
 * వాతావరణ హెచ్చరిక function.
 *
 * Schedule: ఉదయం 6 నుండి రాత్రి 8 వరకు, 2 గంటలకు ఒకసారి.
 *   Cron: "0 6,8,10,12,14,16,18,20 * * *" IST
 *   = రోజుకు 8 runs మాత్రమే (~3,200 API calls/day — free tier లో safe)
 *   రాత్రి 8 తర్వాత run అవ్వదు → నిద్రపోయే వేళ notification రాదు.
 *
 * Active grids: Firestore settings/active_weather_grids చదివి
 *   real users ఉన్న grid cells మాత్రమే check చేస్తాం.
 *   (Android user subscribe అయినప్పుడు తన gridKey ని ఆ doc లో save చేస్తుంది)
 */
exports.checkSevereWeatherAlerts = (0, scheduler_1.onSchedule)({
    schedule: "0 6,8,10,12,14,16,18,20 * * *",
    timeZone: "Asia/Kolkata",
    memory: "512MiB",
    timeoutSeconds: 540,
}, async (_event) => {
    console.log("[WEATHER_GRID] Starting user-driven hyper-local weather check...");
    // ── Step 1: Active grid keys fetch (1 Firestore read per run) ──────────
    // Structure: { "weather_grid_144_800": true, "weather_grid_174_785": true, ... }
    const activeGridsRef = db.collection('settings').doc('active_weather_grids');
    const activeGridsDoc = await activeGridsRef.get();
    if (!activeGridsDoc.exists) {
        console.log("[WEATHER_GRID] No active grids registered yet. Skipping.");
        return;
    }
    const activeGridsData = activeGridsDoc.data() || {};
    // Filter: only keys that map to `true` (active subscribers)
    const activeGridKeys = Object.keys(activeGridsData).filter(k => activeGridsData[k] === true);
    if (activeGridKeys.length === 0) {
        console.log("[WEATHER_GRID] active_weather_grids doc exists but no active keys.");
        return;
    }
    console.log(`[WEATHER_GRID] Checking ${activeGridKeys.length} active grid cells...`);
    // ── Step 2: Alert state fetch (1 Firestore read per run) ───────────────
    const alertStateRef = db.collection('settings').doc('weather_alerts_v2');
    const alertStateDoc = await alertStateRef.get();
    const alertState = alertStateDoc.exists ? alertStateDoc.data() || {} : {};
    const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 గంటలు — duplicate spam నివారణ
    const FORECAST_HOURS = 10; // రాబోయే 10 గంటల forecast చూస్తాం
    const updatedState = {};
    // ── Step 3: Per-grid weather check ─────────────────────────────────────
    // gridKey format: "weather_grid_{latKey}_{lonKey}"
    // e.g. "weather_grid_144_800" → lat=14.4, lon=80.0
    for (const gridKey of activeGridKeys) {
        try {
            // gridKey → lat/lon decode
            const parts = gridKey.split("_"); // ["weather","grid","144","800"]
            if (parts.length < 4)
                continue;
            const lat = parseInt(parts[2], 10) / 10; // 144 → 14.4
            const lon = parseInt(parts[3], 10) / 10; // 800 → 80.0
            if (isNaN(lat) || isNaN(lon))
                continue;
            // Open-Meteo hourly forecast — 1 API call per grid cell
            const url = [
                `https://api.open-meteo.com/v1/forecast`,
                `?latitude=${lat}&longitude=${lon}`,
                `&hourly=precipitation,weather_code,wind_speed_10m,temperature_2m`,
                `&current_weather=true`,
                `&timezone=Asia%2FKolkata`,
                `&forecast_hours=${FORECAST_HOURS}`
            ].join("");
            const res = await fetch(url);
            if (!res.ok) {
                console.warn(`[WEATHER_GRID] API ${res.status} for ${gridKey}`);
                continue;
            }
            const data = await res.json();
            const currentTemp = data.current_weather?.temperature ?? 0;
            const hourlyTimes = data.hourly?.time ?? [];
            const hourlyPrecip = data.hourly?.precipitation ?? [];
            const hourlyCodes = data.hourly?.weather_code ?? [];
            const hourlyWind = data.hourly?.wind_speed_10m ?? [];
            const hourlyTemp = data.hourly?.temperature_2m ?? [];
            let alertSent = false;
            // రాబోయే FORECAST_HOURS గంటల్లో first severe event detect చేస్తాం
            for (let h = 0; h < Math.min(hourlyTimes.length, FORECAST_HOURS); h++) {
                const code = hourlyCodes[h] ?? 0;
                const precip = hourlyPrecip[h] ?? 0;
                const wind = hourlyWind[h] ?? 0;
                const temp = hourlyTemp[h] ?? currentTemp;
                const alert = buildWeatherAlert(code, temp, wind, h, precip);
                if (!alert)
                    continue;
                // Cooldown: same grid + same alert title → skip (4h window)
                const cellState = alertState[gridKey] || {};
                const lastSentAt = cellState.lastSentAt ?? 0;
                const lastTitle = cellState.lastTitle ?? "";
                const now = Date.now();
                if (lastTitle === alert.title && (now - lastSentAt) < COOLDOWN_MS) {
                    console.log(`[WEATHER_GRID] Cooldown: ${gridKey} → ${alert.title.substring(0, 35)}`);
                    break;
                }
                // ✅ 1 FCM topic send → all users in this 10km cell receive it (free)
                const fcmMsg = {
                    notification: { title: alert.title, body: alert.body },
                    data: {
                        type: "WEATHER_ALERT",
                        gridKey,
                        title: alert.title,
                        body: alert.body,
                        channelId: "weather_alerts",
                        severity: alert.severity,
                        forecastHour: String(h),
                    },
                    android: {
                        notification: {
                            channelId: "weather_alerts",
                            priority: alert.severity === "SEVERE" ? "max" : "high",
                            defaultSound: true,
                        },
                        priority: "high"
                    },
                    topic: gridKey
                };
                try {
                    await admin.messaging().send(fcmMsg);
                    console.log(`[WEATHER_GRID] ✅ ${gridKey} — ${alert.title.substring(0, 40)} [h+${h}]`);
                    updatedState[gridKey] = {
                        lastSentAt: Date.now(),
                        lastTitle: alert.title,
                        severity: alert.severity,
                        forecastHour: h,
                    };
                    alertSent = true;
                }
                catch (e) {
                    console.error(`[WEATHER_GRID_ERR] ${gridKey}:`, e.message);
                }
                break; // ఒక grid కి ఒకే alert per run
            }
            // Current temp heat check (forecast-independent)
            if (!alertSent && currentTemp >= 42) {
                const alert = buildWeatherAlert(0, currentTemp, 0, 0, 0);
                if (alert) {
                    const cellState = alertState[gridKey] || {};
                    const now = Date.now();
                    if (!(cellState.lastTitle === alert.title && (now - (cellState.lastSentAt ?? 0)) < COOLDOWN_MS)) {
                        const fcmMsg = {
                            notification: { title: alert.title, body: alert.body },
                            data: { type: "WEATHER_ALERT", gridKey, title: alert.title, body: alert.body, channelId: "weather_alerts", severity: alert.severity, forecastHour: "0" },
                            android: { notification: { channelId: "weather_alerts", priority: "max", defaultSound: true }, priority: "high" },
                            topic: gridKey
                        };
                        try {
                            await admin.messaging().send(fcmMsg);
                            console.log(`[WEATHER_GRID] 🔥 Heat ${gridKey} (${Math.round(currentTemp)}°C)`);
                            updatedState[gridKey] = { lastSentAt: Date.now(), lastTitle: alert.title, severity: alert.severity };
                        }
                        catch (e) {
                            console.error(`[WEATHER_GRID_ERR] heat ${gridKey}:`, e.message);
                        }
                    }
                }
            }
        }
        catch (err) {
            console.error(`[WEATHER_GRID] Error for ${gridKey}:`, err.message);
        }
    }
    // ── Step 4: Batch write changed states ─────────────────────────────────
    if (Object.keys(updatedState).length > 0) {
        await alertStateRef.set(updatedState, { merge: true });
        console.log(`[WEATHER_GRID] State saved for ${Object.keys(updatedState).length} cells.`);
    }
    console.log(`[WEATHER_GRID] Done. ${activeGridKeys.length} grids checked.`);
});
/**
 * 6. Cleanup Old News (60 days old)
 * Runs every day at 3:00 AM IST to reduce Storage and Firestore costs.
 */
exports.cleanupOldNews = (0, scheduler_1.onSchedule)({
    schedule: "0 3 * * *",
    timeZone: "Asia/Kolkata",
    memory: "1GiB",
    timeoutSeconds: 540
}, async (event) => {
    console.log("[CLEANUP] Starting daily cleanup of old news...");
    const bucket = admin.storage().bucket();
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - 60);
    try {
        const MAX_CLEANUP = 2000;
        const BATCH_SIZE = 500;
        let totalCleanedDocs = 0;
        let totalDeletedFiles = 0;
        // Run in sub-batches to respect Free Tier and stay within memory limits
        for (let i = 0; i < MAX_CLEANUP; i += BATCH_SIZE) {
            const oldNewsQuery = await db.collection('news')
                .where('approved', '==', true) // Only clean active news
                .where('timestamp', '<', admin.firestore.Timestamp.fromDate(retentionDate))
                .orderBy('timestamp', 'asc') // Start from oldest to newest
                .limit(BATCH_SIZE)
                .get();
            if (oldNewsQuery.empty) {
                console.log(`[CLEANUP] No more active news found for retention period.`);
                break;
            }
            const deletePromises = oldNewsQuery.docs.map(async (doc) => {
                const data = doc.data();
                // Skip if already cleaned up
                if (data.mediaDeleted === true)
                    return null;
                const mediaUrls = data.mediaUrls || [];
                if (data.mediaUrl)
                    mediaUrls.push(data.mediaUrl);
                for (const url of mediaUrls) {
                    if (url && typeof url === 'string' && url.includes('firebasestorage.googleapis.com')) {
                        try {
                            // ROBUST PARSING: Handle both standard and token-based URLs
                            const decodedUrl = decodeURIComponent(url);
                            const pathParts = decodedUrl.split('/o/');
                            if (pathParts.length < 2)
                                continue;
                            const filePath = pathParts[1].split('?')[0];
                            console.log(`[CLEANUP] Deleting: ${filePath}`);
                            await bucket.file(filePath).delete();
                            totalDeletedFiles++;
                        }
                        catch (e) {
                            // Ignore 404s (already deleted)
                            const is404 = e.code === 404 || String(e.code) === "404" ||
                                e.message?.includes("404") ||
                                e.message?.includes("No such object");
                            if (!is404) {
                                console.warn(`[CLEANUP_WARN] Failed to delete ${url}:`, e.message);
                            }
                        }
                    }
                }
                return db.collection('news').doc(doc.id).update({
                    mediaUrl: "",
                    mediaUrls: [],
                    mediaDeleted: true,
                    approved: false,
                    status: "archived",
                    lastCleanupAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });
            const results = await Promise.all(deletePromises);
            const cleanedInThisBatch = results.filter(r => r !== null).length;
            totalCleanedDocs += cleanedInThisBatch;
            console.log(`[CLEANUP] Batch finished. Progress: ${totalCleanedDocs}/${MAX_CLEANUP} (Deleted ${totalDeletedFiles} files)`);
            // If we didn't find many files to delete in this batch, we might be hitting a wall of already-cleaned docs.
            // But we continue until MAX_CLEANUP to dig through them.
        }
        console.log(`[CLEANUP] Completed. Cleaned ${totalCleanedDocs} documents and deleted ${totalDeletedFiles} media files.`);
    }
    catch (error) {
        console.error("[CLEANUP] Error during cleanup:", error.message);
    }
});
//# sourceMappingURL=auto_content_handler.js.map
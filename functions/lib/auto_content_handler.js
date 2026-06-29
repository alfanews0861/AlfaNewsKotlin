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
                systemInstruction: { role: "system", parts: [{ text: "Output JSON only. Be accurate with the Telugu calendar and regional events." }] },
                generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: schema }
            });
            const data = (0, utils_1.parseAIJson)(checkRes.text || "{}");
            if (!data.isFestival || !data.festivalTe || data.festivalTe === "None") {
                console.log(`[FESTIVAL] No major festival found for today (${dateStr}).`);
                return;
            }
            console.log(`[FESTIVAL] Found festival: ${data.festivalTe}. Generating greeting...`);
            let mediaUrl = "";
            const buffer = await (0, utils_1.generateImageWithRetry)(ai, `A stunning traditional Indian spiritual art illustration of ${data.imagePrompt || data.festivalTe}.
            Style: Divine aesthetic, vibrant colors, oil painting on canvas, heavenly atmosphere, golden lighting.
            Note: Focus on the spiritual and cultural essence of the festival, beautiful composition, no text.`, '9:16');
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
                generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.8 }
            });
            const data = (0, utils_1.parseAIJson)(res.text || "{}");
            if (!data.quoteTe)
                return;
            let mediaUrl = "";
            const buffer = await (0, utils_1.generateImageWithRetry)(ai, `A very beautiful and artistic aesthetic background representing ${data.imagePrompt}.
            Style: Concept art, soft bokeh, cinematic lighting, peaceful and inspirational atmosphere.
            Quality: Masterpiece, 8k resolution, absolutely no text, no words, no letters.`, '9:16');
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
                generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.5 }
            });
            const data = (0, utils_1.parseAIJson)(res.text || "{}");
            if (!data.headlineTe)
                return;
            let mediaUrl = "";
            const buffer = await (0, utils_1.generateImageWithRetry)(ai, `A grand cinematic historical reconstruction of: ${data.imagePrompt}.
            Style: Epic movie scene, era-appropriate architecture and attire, dramatic atmospheric lighting, photorealistic digital art.
            Note: Focus on the historical event's scale and importance, masterpiece, no text.`, '16:9');
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
                const schema = {
                    type: genai_1.Type.OBJECT,
                    properties: { topic: { type: genai_1.Type.STRING }, visualDescription: { type: genai_1.Type.STRING }, teluguCaption: { type: genai_1.Type.STRING }, speechBubbleText: { type: genai_1.Type.STRING } },
                    required: ["topic", "visualDescription", "teluguCaption", "speechBubbleText"]
                };
                const topicRes = await ai.models.generateContent({
                    model: modelName,
                    contents: [{ role: "user", parts: [{ text: `Today's Date: ${todayStr}.
    Current Political Landscape:
    - Andhra Pradesh: NDA (TDP+JSP+BJP) in power. CM: Chandrababu Naidu, Deputy CM: Pawan Kalyan. Opposition: YSRCP (Jagan).
    - Telangana: Congress in power. CM: Revanth Reddy. Opposition: BRS (KCR).
    Task: 1. Identify a trending humor incident. 2. Create satire cartoon. 3. Detailed description without names. 4. Funny Telugu dialogue. Return JSON.` }] }],
                    generationConfig: { temperature: 0.95, responseMimeType: "application/json", responseSchema: schema }
                });
                const cartoonData = (0, utils_1.parseAIJson)(topicRes.text || "{}");
                const visual = cartoonData.visualDescription || "characters in a humorous situation";
                const bubbleText = cartoonData.speechBubbleText || "";
                const teluguText = cartoonData.teluguCaption || "నేటి రాజకీయ కార్టూన్";
                // Improved prompt for Cartoon generation to avoid safety triggers while maintaining humor
                const cartoonPrompt = `A high-quality, professional hand-drawn editorial cartoon sketch. Scene: ${visual}.
                The style should be clean line art with minimal shading.
                Include a speech bubble with this specific text: "${bubbleText}".
                Ensure the atmosphere is lighthearted and artistic. No realistic violence or sensitive content.`;
                const buffer = await (0, utils_1.generateImageWithRetry)(ai, cartoonPrompt, '9:16');
                if (buffer) {
                    const mediaUrl = await (0, utils_1.saveBufferToStorage)(buffer, `CARTOON_${state.replace(" ", "")}`) || "";
                    await db.collection('news').add({
                        type: 'cartoon',
                        postFormat: 'VERTICAL',
                        likes: 0,
                        comments: 0,
                        shares: 0,
                        headline: { telugu: `${state === 'Andhra Pradesh' ? 'ఆంధ్రప్రదేశ్' : 'తెలంగాణ'} కార్టూన్`, english: `${state} Cartoon` },
                        content: { telugu: teluguText, english: 'Daily Political Satire Cartoon' },
                        mediaUrl,
                        category: 'కార్టూన్',
                        location: state,
                        district: state,
                        reporter: { id: 'BOT_Cartoonist', name: 'Alfa Cartoonist' },
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        status: "published",
                        approved: true,
                        aiProcessed: true
                    });
                }
            });
        }
        catch (e) {
            console.error(`[CARTOON] Error for ${state}:`, e.message);
        }
    }
});
const DISTRICT_COORDS = {
    "హైదరాబాద్": { lat: 17.3850, lon: 78.4867 },
    "విశాఖపట్నం": { lat: 17.6868, lon: 83.2185 },
    "విజయవాడ": { lat: 16.5062, lon: 80.6480 },
    "గుంటూరు": { lat: 16.3067, lon: 80.4365 },
    "నెల్లూరు": { lat: 14.4426, lon: 79.9865 },
    "కర్నూలు": { lat: 15.8284, lon: 78.0331 },
    "వరంగల్": { lat: 17.9689, lon: 79.5941 },
    "ఖమ్మం": { lat: 17.2473, lon: 80.1514 },
    "కరీంనగర్": { lat: 18.4386, lon: 79.1288 },
    "నిజామాబాద్": { lat: 18.6725, lon: 78.0941 },
    "తిరుపతి": { lat: 13.6288, lon: 79.4192 },
    "అనంతపురం": { lat: 14.6819, lon: 77.6006 },
    "కడప": { lat: 14.4673, lon: 78.8242 },
    "కాకినాడ": { lat: 16.9891, lon: 82.2475 },
    "రాజమహేంద్రవరం": { lat: 17.0005, lon: 81.7774 }
};
exports.checkSevereWeatherAlerts = (0, scheduler_1.onSchedule)({
    schedule: "*/30 * * * *",
    timeZone: "Asia/Kolkata",
    memory: "512MiB"
}, async (event) => {
    console.log("[WEATHER_ALERT] Checking for severe weather conditions...");
    for (const [district, coords] of Object.entries(DISTRICT_COORDS)) {
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true`;
            const response = await fetch(url);
            if (!response.ok)
                continue;
            const data = await response.json();
            const weatherCode = data.current_weather.weathercode;
            const temp = data.current_weather.temperature;
            let alertTitle = "";
            let alertBody = "";
            let isSevere = false;
            if (weatherCode === 95 || weatherCode === 96 || weatherCode === 99) {
                alertTitle = `⚠️ పిడుగుల హెచ్చరిక - ${district}`;
                alertBody = `ప్రస్తుతం ${district} ప్రాంతంలో పిడుగులతో కూడిన భారీ వర్షం పడే అవకాశం ఉంది. సురక్షితంగా ఉండండి.`;
                isSevere = true;
            }
            else if (temp >= 42) {
                alertTitle = `🔥 ఎండ తీవ్రత హెచ్చరిక - ${district}`;
                alertBody = `జాగ్రత్త! ${district} లో ఉష్ణోగ్రత ${temp}°C కి చేరింది. వడగాల్పులు వీచే అవకాశం ఉంది.`;
                isSevere = true;
            }
            else if (weatherCode >= 51 && weatherCode <= 82) {
                alertTitle = `🌧️ వర్ష సూచన - ${district}`;
                alertBody = `రైతు సోదరులకు గమనిక: ${district} లో వర్షం పడే అవకాశం ఉంది.`;
                isSevere = true;
            }
            else if (weatherCode === 45 || weatherCode === 48) {
                alertTitle = `🌫️ దట్టమైన మంచు హెచ్చరిక - ${district}`;
                alertBody = `${district} లో దట్టమైన మంచు కురుస్తోంది. జాగ్రత్తగా ప్రయాణించండి.`;
                isSevere = true;
            }
            if (isSevere) {
                const registeredUsers = await db.collection('users').where('district', '==', district).where('notificationsEnabled', '!=', false).limit(500).get();
                const guestUsers = await db.collection('anonymous_devices').where('notificationsEnabled', '!=', false).limit(500).get();
                const messages = [];
                registeredUsers.docs.forEach(doc => {
                    const token = doc.data().fcmToken;
                    if (token)
                        messages.push({ notification: { title: alertTitle, body: alertBody }, data: { type: "WEATHER_ALERT", district, title: alertTitle, body: alertBody }, token });
                });
                guestUsers.docs.forEach(doc => {
                    const token = doc.data().fcmToken;
                    if (token)
                        messages.push({ notification: { title: alertTitle, body: alertBody }, data: { type: "WEATHER_ALERT", district, title: alertTitle, body: alertBody }, token });
                });
                if (messages.length > 0)
                    await admin.messaging().sendEach(messages);
            }
        }
        catch (err) {
            console.error(`[WEATHER_ALERT] Error:`, err.message);
        }
    }
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
                .where('timestamp', '<', admin.firestore.Timestamp.fromDate(retentionDate))
                .orderBy('timestamp', 'asc') // Start from oldest to newest
                .limit(BATCH_SIZE)
                .get();
            if (oldNewsQuery.empty)
                break;
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
                            if (!e.message?.includes("404")) {
                                console.warn(`[CLEANUP_WARN] Failed to delete ${url}:`, e.message);
                            }
                        }
                    }
                }
                return db.collection('news').doc(doc.id).update({
                    mediaUrl: "",
                    mediaUrls: [],
                    mediaDeleted: true,
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
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.youtubeAuthCallback = exports.youtubeAuthStart = exports.shareNews = exports.submitReporterApplication = exports.sendContactEmail = exports.triggerPushBroadcast = exports.onNewsPostCreated = exports.processReporterSubmission = exports.processNewsPost = exports.checkSevereWeatherAlerts = exports.generateDailyCartoon = exports.scheduleHistoryOfTheDay = exports.scheduleQuoteOfTheDay = exports.scheduleFestivalGreeting = void 0;
/**
 * Alfa News - Cloud Functions v17.7 (Optimized AI Models)
 */
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const nodemailer = __importStar(require("nodemailer"));
const genai_1 = require("@google/genai");
const buffer_1 = require("buffer");
const sharp = require('sharp');
const { google } = require('googleapis');
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const ffmpeg = require('fluent-ffmpeg');
const firestore_1 = require("firebase-functions/v2/firestore");
const categories_1 = require("./categories");
admin.initializeApp();
const db = admin.firestore();
function getISTDateString() {
    const now = new Date();
    const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const istDate = new Date(istString);
    return `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}-${String(istDate.getDate()).padStart(2, '0')}`;
}
const REGION = "asia-south1";
// Scheduled tasks (Quotes, Festivals etc.) use Flash for speed and stability
const SCHEDULED_MODEL = "gemini-3-flash-preview";
// Voice-over and high-reasoning tasks use Pro
const PRO_MODEL = "gemini-3.1-pro-preview";
// News processing uses Flash for speed
const FLASH_MODEL = "gemini-3-flash-preview";
const IMAGEN_MODEL = "imagen-4.0-generate-001";
(0, v2_1.setGlobalOptions)({
    region: REGION,
    maxInstances: 10,
    memory: "2GiB",
    timeoutSeconds: 300,
    concurrency: 40
});
const getAIInstance = () => new genai_1.GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY || "",
    apiVersion: "v1beta"
});
/**
 * Helper: Notify reporter with human-friendly messages (Hiding AI involvement)
 */
async function notifyReporter(reporterId, postId, headline, type) {
    try {
        const userDoc = await db.collection('users').doc(reporterId).get();
        if (!userDoc.exists)
            return;
        const userData = userDoc.data();
        if (userData && userData.notificationsEnabled === false)
            return;
        const tokens = [];
        if (userData?.fcmToken)
            tokens.push(userData.fcmToken);
        if (Array.isArray(userData?.fcmTokens)) {
            userData.fcmTokens.forEach((t) => {
                if (t && typeof t === 'string' && !tokens.includes(t))
                    tokens.push(t);
            });
        }
        if (tokens.length === 0)
            return;
        let title = "";
        let body = "";
        if (type === 'SUCCESS') {
            title = 'వార్త ప్రచురించబడింది! ✅';
            body = `మీ వార్త: "${headline.substring(0, 50)}..." విజయవంతంగా ప్రచురించబడింది.`;
        }
        else if (type === 'POLICY_VIOLATION') {
            title = 'వార్త తిరస్కరించబడింది! ⚠️';
            body = `మీ వార్తలోని అంశాలు మా నిబంధనలకు విరుద్ధంగా ఉన్నందున ప్రచురించబడలేదు.`;
        }
        else {
            title = 'వార్త ప్రచురణలో అంతరాయం! ❌';
            body = `సాంకేతిక కారణాల వల్ల మీ వార్త ప్రచురించబడలేదు. దయచేసి మళ్ళీ ప్రయత్నించండి.`;
        }
        const message = {
            notification: { title, body },
            data: {
                actionUrl: `alfanews://news/${postId}`,
                newsId: postId,
                type: `REPORTER_SUBMISSION_${type}`
            }
        };
        const sendPromises = tokens.map(token => admin.messaging().send({ ...message, token }).catch(async (err) => {
            console.error(`Failed to send to token: ${token}`, err);
            if (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-registration-token') {
                const updates = {};
                if (userData?.fcmToken === token)
                    updates.fcmToken = admin.firestore.FieldValue.delete();
                updates.fcmTokens = admin.firestore.FieldValue.arrayRemove(token);
                await db.collection('users').doc(reporterId).update(updates).catch(() => { });
            }
        }));
        await Promise.all(sendPromises);
    }
    catch (e) {
        console.error(`[NOTIFY] Error:`, e.message);
    }
}
/**
 * Helper: Perform AI enhancement on news content
 */
async function performAIProcessing(headline, content, actualPostData) {
    const ai = getAIInstance();
    const schema = {
        type: genai_1.Type.OBJECT,
        properties: {
            headline: { type: genai_1.Type.STRING },
            content: { type: genai_1.Type.STRING },
            headlineEn: { type: genai_1.Type.STRING },
            contentEn: { type: genai_1.Type.STRING },
            location: { type: genai_1.Type.STRING },
            storyFingerprint: { type: genai_1.Type.STRING },
            refinedCategory: { type: genai_1.Type.STRING },
            isSafeForYouTube: { type: genai_1.Type.BOOLEAN },
            rejectionReason: { type: genai_1.Type.STRING },
            tags: { type: genai_1.Type.ARRAY, items: { type: genai_1.Type.STRING } },
            entities: {
                type: genai_1.Type.OBJECT,
                properties: {
                    people: { type: genai_1.Type.ARRAY, items: { type: genai_1.Type.STRING } },
                    organizations: { type: genai_1.Type.ARRAY, items: { type: genai_1.Type.STRING } },
                    locations: { type: genai_1.Type.ARRAY, items: { type: genai_1.Type.STRING } }
                }
            }
        },
        required: ["headline", "content", "headlineEn", "contentEn", "location", "storyFingerprint", "refinedCategory", "isSafeForYouTube", "rejectionReason", "tags", "entities"]
    };
    const response = await ai.models.generateContent({
        model: FLASH_MODEL,
        contents: [{ role: "user", parts: [{ text: `Headline: ${headline}\nContent: ${content}` }] }],
        config: {
            systemInstruction: (0, categories_1.getCategorySystemInstruction)(),
            temperature: 0.4,
            responseMimeType: "application/json",
            responseSchema: schema,
        }
    });
    const aiRes = parseAIJson(response.text || "{}");
    const finalContent = aiRes.content || aiRes.contentTe || content;
    const finalHeadline = aiRes.headline || aiRes.headlineTe || headline;
    const finalHeadlineEn = aiRes.headlineEn || aiRes.headline_en || headline;
    const finalContentEn = aiRes.contentEn || aiRes.content_en || content;
    const normalizedEntities = {
        people: Array.isArray(aiRes.entities?.people) ? aiRes.entities.people : [],
        organizations: Array.isArray(aiRes.entities?.organizations) ? aiRes.entities.organizations : [],
        locations: Array.isArray(aiRes.entities?.locations) ? aiRes.entities.locations : []
    };
    // ✅ NORMALIZE the AI-returned category to canonical form
    const aiCategory = aiRes.refinedCategory || actualPostData?.category || "OTHER";
    const normalizedCategory = (0, categories_1.normalizeCategory)(aiCategory);
    // ✅ REPORTERS FIX: Primary category is ALWAYS "జిల్లా వార్తలు" for reporter submissions
    const isReporter = actualPostData?.isReporter === true || actualPostData?.processingType === "REPORTER_SUBMISSION";
    const primaryCategory = isReporter ? "జిల్లా వార్తలు" : normalizedCategory;
    // ✅ Build canonical categories array
    const canonicalCategories = Array.from(new Set([
        normalizedCategory,
        ...(0, categories_1.normalizeCategories)(actualPostData?.categories || []),
        ...(actualPostData?.district ? [actualPostData.district] : [])
    ])).filter(c => !!c && c !== "OTHER");
    console.log(`[AI_PROCESSING] Original category: "${aiCategory}" → Normalized: "${normalizedCategory}" (IsReporter: ${isReporter})`);
    console.log(`[AI_PROCESSING] Final primary category: "${primaryCategory}"`);
    console.log(`[AI_PROCESSING] Final categories: ${JSON.stringify(canonicalCategories)}`);
    return {
        headline: { telugu: finalHeadline, english: finalHeadlineEn },
        content: { telugu: finalContent, english: finalContentEn },
        location: aiRes.location || actualPostData?.location || "",
        category: primaryCategory,
        categories: canonicalCategories,
        tags: aiRes.tags || [],
        entities: normalizedEntities,
        isSafeForYouTube: aiRes.isSafeForYouTube ?? true,
        rejectionReason: aiRes.rejectionReason || "",
        storyFingerprint: aiRes.storyFingerprint || `gen_${Date.now()}`,
        aiProcessed: true,
        aiProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };
}
function parseAIJson(text) {
    try {
        let cleanText = text.trim();
        if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```(json)?\n/, '').replace(/\n```$/, '');
        }
        return JSON.parse(cleanText);
    }
    catch (e) {
        console.error("JSON parse error:", e);
        return {};
    }
}
const BOT_REPORTER_NAMES = [
    'రవి కుమార్', 'సునీల్ వర్మ', 'రాజేష్ యాదవ్', 'ప్రకాష్ రెడ్డి', 'సాయి కిరణ్',
    'విజయ్ భాస్కర్', 'శ్రీనివాస్ రావు', 'నరేష్ కుమార్', 'అరవింద్ స్వామి', 'కార్తీక్ రాజు',
    'సందీప్ శర్మ', 'లోకేష్ నాయుడు', 'వరుణ్ కుమార్', 'కృష్ణ చైతన్య', 'వెంకటేష్ బాబు',
    'ఆదిత్య వర్మ', 'రాహుల్ దేశ్‌ముఖ్', 'అజయ్ సింగ్', 'భరత్ చంద్ర', 'దీపక్ రాజ్',
    'పవన్ కుమార్', 'హరీష్ వర్మ', 'కిశోర్ బాబు', 'మనోజ్ కుమార్', 'సంతోష్ రెడ్డి'
];
function getRandomReporter() {
    const name = BOT_REPORTER_NAMES[Math.floor(Math.random() * BOT_REPORTER_NAMES.length)];
    return { id: `BOT_${name}`, name: name };
}
async function saveBufferToStorage(buffer, prefix) {
    try {
        const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();
        const bucket = admin.storage().bucket();
        const fileName = `news-media/${prefix}_${Date.now()}.webp`;
        await bucket.file(fileName).save(webpBuffer, { metadata: { contentType: 'image/webp' } });
        return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;
    }
    catch (e) {
        console.error("Buffer save error:", e);
        return null;
    }
}
async function saveImageLocally(externalUrl, prefix) {
    try {
        const response = await fetch(externalUrl);
        if (!response.ok)
            return null;
        const arrayBuffer = await response.arrayBuffer();
        return await saveBufferToStorage(buffer_1.Buffer.from(arrayBuffer), prefix);
    }
    catch (e) {
        console.error("External image save error:", e);
        return null;
    }
}
/**
 * Helper: Generate image with retry logic
 */
async function generateImageWithRetry(ai, prompt, aspectRatio = '9:16', retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`[AI_IMAGE] Attempt ${i + 1} for prompt: ${prompt.substring(0, 50)}...`);
            const imgRes = await ai.models.generateImages({
                model: IMAGEN_MODEL,
                prompt: prompt,
                config: { numberOfImages: 1, aspectRatio: aspectRatio }
            });
            if (imgRes.generatedImages?.[0]?.image?.imageBytes) {
                return buffer_1.Buffer.from(imgRes.generatedImages[0].image.imageBytes, 'base64');
            }
            console.warn(`[AI_IMAGE] Attempt ${i + 1} returned no images.`);
        }
        catch (err) {
            console.error(`[AI_IMAGE] Attempt ${i + 1} failed:`, err.message);
            if (i === retries - 1)
                return null;
            // Exponential backoff
            const delay = Math.pow(2, i) * 5000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return null;
}
/**
 * 2. Festival Greeting Function
 */
exports.scheduleFestivalGreeting = (0, scheduler_1.onSchedule)({ schedule: "0 5 * * *", timeZone: "Asia/Kolkata" }, async (event) => {
    const ai = getAIInstance();
    const dateStr = getISTDateString();
    console.log(`[FESTIVAL] Checking festivals for ${dateStr}...`);
    const schema = {
        type: genai_1.Type.OBJECT,
        properties: { isFestival: { type: genai_1.Type.BOOLEAN }, festivalTe: { type: genai_1.Type.STRING }, greetingTe: { type: genai_1.Type.STRING }, greetingEn: { type: genai_1.Type.STRING }, imagePrompt: { type: genai_1.Type.STRING } },
        required: ["isFestival", "festivalTe", "greetingTe", "greetingEn", "imagePrompt"]
    };
    try {
        const checkRes = await ai.models.generateContent({
            model: SCHEDULED_MODEL,
            contents: [{ role: "user", parts: [{ text: `Today's exact date is ${dateStr}. Strictly check if there is a major festival celebrated by Telugu people (Hindu, Muslim, Christian, or National holidays) exactly on this date. Do not invent festivals or hallucinate. If there is no festival today, return isFestival: false. JSON.` }] }],
            config: { systemInstruction: "Output JSON only. Be highly accurate with calendar dates.", temperature: 0.1, responseMimeType: "application/json", responseSchema: schema }
        });
        const data = parseAIJson(checkRes.text || "{}");
        if (!data.isFestival || !data.festivalTe || data.festivalTe === "None") {
            console.log(`[FESTIVAL] No major festival found for today (${dateStr}).`);
            return;
        }
        console.log(`[FESTIVAL] Found festival: ${data.festivalTe}. Generating greeting...`);
        let mediaUrl = "";
        const buffer = await generateImageWithRetry(ai, `Beautiful high quality aesthetic background for ${data.imagePrompt || data.festivalTe} festival greeting in India, warm atmosphere, space for text, no text.`, '9:16');
        if (buffer) {
            mediaUrl = await saveBufferToStorage(buffer, "GREETING") || "";
        }
        await db.collection('news').add({
            type: 'greeting',
            postFormat: 'VERTICAL', // Force 9:16 Full Screen Card UI
            likes: 0, // Required for Full Screen Special Card logic
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
    }
    catch (e) {
        console.error("[FESTIVAL] Error:", e.message);
    }
});
/**
 * 3. Quote of the Day Function
 */
exports.scheduleQuoteOfTheDay = (0, scheduler_1.onSchedule)({ schedule: "0 4 * * *", timeZone: "Asia/Kolkata" }, async (event) => {
    const ai = getAIInstance();
    // Add random author/theme based on the current day to ensure a unique quote every single day of the year
    const authorsAndThemes = ['Swami Vivekananda', 'APJ Abdul Kalam', 'Gautam Buddha', 'Mahatma Gandhi', 'Bhagavad Gita', 'Vemana', 'Sumathi Satakam', 'Chanakya', 'Socrates', 'Albert Einstein', 'Confucius', 'Telugu Proverbs', 'Rumi', 'Thirukkural', 'Jiddu Krishnamurti', 'Osho', 'Marcus Aurelius', 'Mother Teresa'];
    const todayStr = getISTDateString();
    const randomSeed = Math.floor(Math.random() * authorsAndThemes.length);
    const selectedTheme = authorsAndThemes[randomSeed];
    const schema = {
        type: genai_1.Type.OBJECT,
        properties: {
            quoteTe: { type: genai_1.Type.STRING },
            quoteEn: { type: genai_1.Type.STRING },
            author: { type: genai_1.Type.STRING },
            imagePrompt: { type: genai_1.Type.STRING }
        },
        required: ["quoteTe", "quoteEn", "author", "imagePrompt"]
    };
    try {
        const res = await ai.models.generateContent({
            model: SCHEDULED_MODEL,
            contents: [{ role: "user", parts: [{ text: `Today is ${todayStr}. Provide a highly unique, rare, and deeply inspirational Telugu quote by ${selectedTheme}. Do NOT repeat common quotes. Make sure it is 100% unique for this specific date. Output JSON.` }] }],
            config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.8 } // Higher temperature for more uniqueness
        });
        const data = parseAIJson(res.text || "{}");
        if (!data.quoteTe)
            return;
        let mediaUrl = "";
        const buffer = await generateImageWithRetry(ai, `Photorealistic aesthetic portrait or background of ${data.imagePrompt}, warm lighting, very beautiful, absolutely no text, no words.`, '9:16');
        if (buffer) {
            mediaUrl = await saveBufferToStorage(buffer, "QUOTE") || "";
        }
        await db.collection('news').add({
            type: 'greeting', // Changed from 'quote' to 'greeting' so the app treats it as a special full screen card
            postFormat: 'VERTICAL', // Force 9:16 Full Screen Card UI
            likes: 1, // 1 like identifies it as a Quote in your NewsFeedViewModel
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
    }
    catch (e) {
        console.error("[QUOTE] Error:", e.message);
    }
});
/**
 * 4. On This Day Function
 */
exports.scheduleHistoryOfTheDay = (0, scheduler_1.onSchedule)({ schedule: "30 4 * * *", timeZone: "Asia/Kolkata" }, async (event) => {
    const ai = getAIInstance();
    const dateStr = new Date().toLocaleDateString('te-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long' });
    const schema = {
        type: genai_1.Type.OBJECT,
        properties: {
            headlineTe: { type: genai_1.Type.STRING },
            contentTe: { type: genai_1.Type.STRING },
            headlineEn: { type: genai_1.Type.STRING },
            contentEn: { type: genai_1.Type.STRING },
            imagePrompt: { type: genai_1.Type.STRING }
        },
        required: ["headlineTe", "contentTe", "headlineEn", "contentEn", "imagePrompt"]
    };
    try {
        const res = await ai.models.generateContent({
            model: SCHEDULED_MODEL,
            contents: [{ role: "user", parts: [{ text: `Out of all historical events that happened on ${dateStr}, pick the single most important event. Write a 60 words detailed news about it and provide a generic historical image prompt. Generate a single-sentence Telugu headline (max 55 characters) and an English headline (max 12 words). The Telugu headline must be sharp and punchy. Output JSON.` }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
                temperature: 0.5
            }
        });
        const data = parseAIJson(res.text || "{}");
        if (!data.headlineTe)
            return;
        let mediaUrl = "";
        const buffer = await generateImageWithRetry(ai, `Historical photorealistic image: ${data.imagePrompt}, dramatic lighting, no text.`, '16:9');
        if (buffer) {
            mediaUrl = await saveBufferToStorage(buffer, "HISTORY") || "";
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
    }
    catch (e) {
        console.error("[HISTORY] Error:", e.message);
    }
});
/**
 * 5. Daily Cartoon Function
 */
exports.generateDailyCartoon = (0, scheduler_1.onSchedule)({ schedule: "0 6 * * *", timeZone: "Asia/Kolkata" }, async (event) => {
    const ai = getAIInstance();
    const states = ["Andhra Pradesh", "Telangana"];
    const todayStr = getISTDateString();
    for (const state of states) {
        try {
            const schema = {
                type: genai_1.Type.OBJECT,
                properties: {
                    topic: { type: genai_1.Type.STRING },
                    visualDescription: { type: genai_1.Type.STRING },
                    teluguCaption: { type: genai_1.Type.STRING }
                },
                required: ["topic", "visualDescription", "teluguCaption"]
            };
            const topicRes = await ai.models.generateContent({
                model: SCHEDULED_MODEL,
                contents: [{ role: "user", parts: [{ text: `Today's Date: ${todayStr}.
Role: You are an award-winning editorial and political cartoonist for a leading Telugu news daily.
Goal: Identify a highly relevant, satirical, and humorous current political topic in ${state} (India) from the last 24-48 hours.
Stance: Be critical of the ruling government's policies, failures, or ironies.

Task:
1. Choose a trending issue.
2. Design a visual scene.
3. IMPORTANT: For the politicians involved, provide a VERY DETAILED description of their physical features to ensure high likeness in AI generation. Describe their face shape, hair style, glasses, facial hair, and common clothing (e.g., specific colored scarf or shirt).
4. Create a punchy, funny Telugu caption.

Provide the output in JSON with fields: topic, visualDescription, teluguCaption.` }] }],
                config: { temperature: 0.9, responseMimeType: "application/json", responseSchema: schema }
            });
            const cartoonData = parseAIJson(topicRes.text || "{}");
            const topic = cartoonData.topic || "political irony";
            const visual = cartoonData.visualDescription || "politicians in a satirical situation";
            const teluguText = cartoonData.teluguCaption || "";
            const buffer = await generateImageWithRetry(ai, `A high-detail, professional editorial political caricature for a premium Telugu newspaper.
Topic: ${topic} in ${state}, India.
Visual: ${visual}.
Style: Clean ink line art with professional digital coloring, high-quality caricature style.
Likeness: The caricatures MUST have a strong likeness to the real-world politicians described. Focus on recognizable facial features.
Composition: Clean, NO TEXT, no speech bubbles, no gibberish letters. The image should be purely visual.
Quality: 4k, artistic, award-winning editorial style.`, '9:16');
            if (buffer) {
                const mediaUrl = await saveBufferToStorage(buffer, `CARTOON_${state.replace(" ", "")}`) || "";
                await db.collection('news').add({
                    type: 'cartoon',
                    postFormat: 'VERTICAL', // Force 9:16 Full Screen Card UI
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
        }
        catch (e) {
            console.error(`[CARTOON] Error for ${state}:`, e.message);
        }
    }
});
/**
 * 5.1 Severe Weather Alerts Function
 * ఈ ఫంక్షన్ ప్రతి 30 నిమిషాలకు వాతావరణాన్ని తనిఖీ చేసి, ప్రమాదకర పరిస్థితులు ఉంటే యూజర్లకు నోటిఫికేషన్ పంపుతుంది.
 */
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
            // 1. పిడుగుల హెచ్చరిక (Thunderstorm)
            if (weatherCode === 95 || weatherCode === 96 || weatherCode === 99) {
                alertTitle = `⚠️ పిడుగుల హెచ్చరిక - ${district}`;
                alertBody = `ప్రస్తుతం ${district} ప్రాంతంలో పిడుగులతో కూడిన భారీ వర్షం పడే అవకాశం ఉంది. సురక్షితంగా ఉండండి.`;
                isSevere = true;
            }
            // 2. ఎండ తీవ్రత / వడగాల్పులు (Heatwave - >42°C)
            else if (temp >= 42) {
                alertTitle = `🔥 ఎండ తీవ్రత హెచ్చరిక - ${district}`;
                alertBody = `జాగ్రత్త! ${district} లో ఉష్ణోగ్రత ${temp}°C కి చేరింది. వడగాల్పులు వీచే అవకాశం ఉంది, దయచేసి నీడన ఉండండి.`;
                isSevere = true;
            }
            // 3. వర్ష సూచన (Rain Expected - For Farmers)
            else if (weatherCode >= 51 && weatherCode <= 82) {
                alertTitle = `🌧️ వర్ష సూచన - ${district}`;
                alertBody = `రైతు సోదరులకు గమనిక: ${district} లో వర్షం/చినుకులు పడే అవకాశం ఉంది. మందులు కొట్టే వారు తగిన జాగ్రత్తలు తీసుకోండి.`;
                isSevere = true;
            }
            // 4. దట్టమైన మంచు (Dense Fog)
            else if (weatherCode === 45 || weatherCode === 48) {
                alertTitle = `🌫️ దట్టమైన మంచు హెచ్చరిక - ${district}`;
                alertBody = `${district} లో దట్టమైన మంచు కురుస్తోంది. వాహనదారులు లైట్లు వేసుకుని జాగ్రత్తగా ప్రయాణించండి.`;
                isSevere = true;
            }
            if (isSevere) {
                console.log(`[WEATHER_ALERT] Severe weather detected in ${district}. Sending notifications...`);
                // 1. రిజిస్టర్డ్ యూజర్లను కనుగొనడం
                const registeredUsers = await db.collection('users')
                    .where('district', '==', district)
                    .where('notificationsEnabled', '!=', false)
                    .limit(500)
                    .get();
                // 2. గెస్ట్ యూజర్లను కనుగొనడం (NEW: 3500 మందికి రీచ్ పెంచడానికి)
                const guestUsers = await db.collection('anonymous_devices')
                    .where('notificationsEnabled', '!=', false)
                    .limit(500)
                    .get();
                const messages = [];
                // రిజిస్టర్డ్ యూజర్ల టోకెన్లు
                registeredUsers.docs.forEach(doc => {
                    const token = doc.data().fcmToken;
                    if (token)
                        messages.push({
                            notification: { title: alertTitle, body: alertBody },
                            data: { type: "WEATHER_ALERT", district: district },
                            token: token
                        });
                });
                // గెస్ట్ యూజర్ల టోకెన్లు (జిల్లాల వారిగా ఫిల్టర్ లేకపోయినా అందరికీ పంపుతాం - Safe Side)
                guestUsers.docs.forEach(doc => {
                    const token = doc.data().fcmToken;
                    if (token)
                        messages.push({
                            notification: { title: alertTitle, body: alertBody },
                            data: { type: "WEATHER_ALERT", district: district },
                            token: token
                        });
                });
                if (messages.length > 0) {
                    await admin.messaging().sendEach(messages);
                    console.log(`[WEATHER_ALERT] Sent ${messages.length} alerts (Registered + Guests).`);
                }
            }
        }
        catch (err) {
            console.error(`[WEATHER_ALERT] Error checking weather for ${district}:`, err.message);
        }
    }
});
/**
 * 6. Main News Processing (Optimized: Background Processing)
 * Processes both Citizen and Reporter submissions through AI enhancement.
 * Returns immediately after saving raw data to Firestore.
 */
exports.processNewsPost = (0, https_1.onCall)(async (request) => {
    const { postId, headline: rawHeadline, content: rawContent, postData } = request.data;
    try {
        console.log(`[NEWS_POST] Entry for post: ${postId || 'new'}`);
        let headline = rawHeadline || postData?.headline?.telugu || "";
        let content = rawContent || postData?.content?.telugu || "";
        // ✅ IMPORTANT: If only postId is provided, recover data from Firestore
        if (postId && (!headline || !content)) {
            const doc = await db.collection('news').doc(postId).get();
            if (doc.exists) {
                const d = doc.data();
                headline = headline || d?.headline?.telugu || "";
                content = content || d?.content?.telugu || "";
            }
        }
        // ✅ ONLY CONTENT IS REQUIRED for Citizens. Headline will be refined by AI.
        if (!content) {
            throw new https_1.HttpsError('invalid-argument', 'వార్త వివరణ (Content) తప్పనిసరి.');
        }
        // If headline is missing, create a temporary one from content
        if (!headline) {
            headline = content.substring(0, 60).split('\n')[0] + "...";
            console.log(`[NEWS_POST] Generated placeholder headline for ${postId || 'new'}`);
        }
        const finalData = {
            ...postData,
            headline: { telugu: headline, english: postData?.headline?.english || "" },
            content: { telugu: content, english: postData?.content?.english || "" },
            isCitizen: postData?.isCitizen || true,
            isReporter: postData?.isReporter || false,
            aiProcessed: false, // Flag for background trigger to handle Gemini
            approved: false, // Ensure not visible until AI processes it
            status: "PENDING",
            timestamp: postData?.timestamp || admin.firestore.FieldValue.serverTimestamp(),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        };
        if (postId) {
            await db.collection('news').doc(postId).update(finalData);
            return { success: true, postId: postId, message: "వార్త అప్‌డేట్ అవుతోంది..." };
        }
        else {
            const newDocRef = await db.collection('news').add(finalData);
            return { success: true, postId: newDocRef.id, message: "వార్త పంపబడింది. త్వరలో ప్రచురించబడుతుంది." };
        }
    }
    catch (e) {
        console.error(`[NEWS_POST] Error:`, e.message);
        throw new https_1.HttpsError('internal', e.message);
    }
});
/**
 * 6.1 Process Reporter Submission (Optimized: Background Processing)
 * Dedicated function to ensure reporter news submissions are accepted quickly.
 * Heavy AI and Video processing moved to background trigger.
 */
exports.processReporterSubmission = (0, https_1.onCall)(async (request) => {
    const { postId, headline: rawHeadline, content: rawContent, postData } = request.data;
    try {
        console.log(`[REPORTER_SUBMISSION] Quick acceptance for post: ${postId || 'new'}`);
        let headline = rawHeadline || postData?.headline?.telugu || "";
        let content = rawContent || postData?.content?.telugu || "";
        if (!headline || !content) {
            console.error(`[REPORTER_SUBMISSION] Missing headline or content`);
            throw new https_1.HttpsError('invalid-argument', 'వార్త శీర్షిక మరియు వివరణ తప్పనిసరి.');
        }
        const isVideo = postData?.mediaType === "VIDEO" || (postData?.mediaUrls && postData.mediaUrls.some((u) => u.toLowerCase().includes('.mp4')));
        const finalData = {
            ...postData,
            headline: { telugu: headline, english: postData?.headline?.english || "" },
            content: { telugu: content, english: postData?.content?.english || "" },
            isReporter: true,
            isCitizen: false,
            aiProcessed: false, // Flag for background trigger to handle Gemini
            approved: false, // Ensure not visible until AI processes it
            status: "PENDING", // Initial status for tracking
            processingType: "REPORTER_SUBMISSION",
            timestamp: postData?.timestamp || admin.firestore.FieldValue.serverTimestamp(),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        };
        if (postId) {
            const postRef = db.collection('news').doc(postId);
            await postRef.update(finalData);
            console.log(`[REPORTER_SUBMISSION] Updated post (pending background AI): ${postId}`);
            return { success: true, postId: postId, message: "వార్త అప్‌డేట్ అవుతోంది (నేపథ్యంలో)..." };
        }
        else {
            const newDocRef = await db.collection('news').add(finalData);
            console.log(`[REPORTER_SUBMISSION] Created new post (pending background AI): ${newDocRef.id}`);
            return { success: true, postId: newDocRef.id, message: "వార్త ప్రచురించబడుతోంది (నేపథ్యంలో)..." };
        }
    }
    catch (e) {
        console.error(`[REPORTER_SUBMISSION] Critical Error:`, e.message);
        throw new https_1.HttpsError('internal', e.message);
    }
});
/**
 * 6.2 Background News Processing (AI + Video + YouTube)
 * Handles ALL background tasks after a news post is created.
 * Note: Uses YouTube Secrets from Secret Manager.
 */
exports.onNewsPostCreated = (0, firestore_1.onDocumentCreated)({
    document: "news/{postId}",
    secrets: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"],
    memory: "4GiB",
    timeoutSeconds: 540 // Increased to 9 minutes for long videos
}, async (event) => {
    const snapshot = event.data;
    if (!snapshot)
        return;
    let data = snapshot.data();
    const postId = event.params.postId;
    console.log(`[TRIGGER] Processing new post: ${postId}`);
    // 1. AI Processing (if not already done)
    if (data && data.aiProcessed === false) {
        console.log(`[TRIGGER] Running background AI processing for ${postId}`);
        try {
            await db.collection('news').doc(postId).update({ status: "PROCESSING_AI" });
            const headline = data.headline?.telugu || "";
            const content = data.content?.telugu || "";
            if (headline && content) {
                const aiProcessedData = await performAIProcessing(headline, content, data);
                // ✅ NEWS VALIDATION: Check if AI rejected the post for being personal or violating policies
                const isRejected = aiProcessedData.rejectionReason && aiProcessedData.rejectionReason.length > 0;
                await db.collection('news').doc(postId).update({
                    ...aiProcessedData,
                    status: isRejected ? "REJECTED" : "published",
                    approved: !isRejected // ✅ Only approve if NOT rejected
                });
                if (isRejected) {
                    console.warn(`[TRIGGER] Post ${postId} REJECTED: ${aiProcessedData.rejectionReason}`);
                    if (data.reporter?.id) {
                        await notifyReporter(data.reporter.id, postId, headline, 'POLICY_VIOLATION');
                    }
                    return; // Stop processing further (no video/YouTube)
                }
                data = { ...data, ...aiProcessedData, approved: true };
            }
        }
        catch (aiErr) {
            console.error(`[TRIGGER] AI Processing failed for ${postId}:`, aiErr.message);
            await db.collection('news').doc(postId).update({ status: "FAILED", error: `AI: ${aiErr.message}` });
            if (data.isReporter && data.reporter?.id) {
                await notifyReporter(data.reporter.id, postId, data.headline?.telugu || "", 'INTERNAL_ERROR');
            }
            return; // Stop if AI enhancement fails
        }
    }
    // 2. Video Processing (if applicable)
    const videoIndex = data.mediaTypes ? data.mediaTypes.indexOf('VIDEO') : (data.mediaType === 'VIDEO' ? 0 : -1);
    if (videoIndex !== -1 && !data.youtubeUrl && data.mediaUrls && data.mediaUrls[videoIndex]) {
        // Check if YouTube secrets are available
        if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_REFRESH_TOKEN) {
            console.error(`[VIDEO_PROCESS] YouTube secrets missing. Skipping upload.`);
        }
        else if (data.isSafeForYouTube === false) {
            console.warn(`[VIDEO_PROCESS] Rejected for YouTube: Policy violation detected for post ${postId}`);
            await db.collection('news').doc(postId).update({
                videoProcessed: false,
                videoProcessError: "Rejected by Policy Guard.",
                status: "REJECTED"
            });
            if (data.isReporter && data.reporter?.id) {
                await notifyReporter(data.reporter.id, postId, data.headline?.telugu || "", 'POLICY_VIOLATION');
            }
            return;
        }
        else {
            console.log(`[VIDEO_PROCESS] Starting background video processing for post: ${postId}`);
            await db.collection('news').doc(postId).update({ status: "PROCESSING_VIDEO" });
            const videoUrl = data.mediaUrls[videoIndex];
            let teluguNews = data.content?.telugu || data.headline?.telugu || "";
            const headline = data.headline?.telugu || "Alfa News";
            const reporterName = data.reporter?.name || "";
            const tags = data.tags || [];
            const people = data.entities?.people || [];
            const locations = data.entities?.locations || [];
            // Construct detailed description for YouTube
            let description = "";
            if (reporterName)
                description += `రిపోర్టర్: ${reporterName}\n\n`;
            description += `${teluguNews}\n\n`;
            if (tags && tags.length > 0) {
                description += tags.map((t) => t.startsWith('#') ? t : `#${t.replace(/\s+/g, '')}`).join(' ') + "\n\n";
            }
            description += `#AlfaNews #TeluguNews #BreakingNews\n\n`;
            if (people && people.length > 0) {
                description += `వ్యక్తులు: ${people.join(', ')}\n`;
            }
            if (locations && locations.length > 0) {
                description += `ప్రాంతాలు: ${locations.join(', ')}\n`;
            }
            const tempDir = os.tmpdir();
            const videoPath = path.join(tempDir, `input_${postId}.mp4`);
            const audioPath = path.join(tempDir, `audio_${postId}.mp3`);
            const outputPath = path.join(tempDir, `output_${postId}.mp4`);
            try {
                // 1. Download Video
                console.log(`[VIDEO_PROCESS] Downloading video from: ${videoUrl}`);
                const videoRes = await fetch(videoUrl);
                if (!videoRes.ok)
                    throw new Error(`Failed to download video: ${videoRes.statusText}`);
                const videoBuffer = await videoRes.arrayBuffer();
                fs.writeFileSync(videoPath, buffer_1.Buffer.from(videoBuffer));
                // 1.1 Visual & Contextual Analysis (Understand Video Content)
                const ai = getAIInstance();
                let videoAnalysis = { isSafe: true, reason: "", summary: "", extractedText: "" };
                try {
                    const metadata = await new Promise((resolve, reject) => {
                        ffmpeg.ffprobe(videoPath)
                            .on('error', reject)
                            .on('end', resolve)
                            .ffprobe((err, data) => { if (err)
                            reject(err);
                        else
                            resolve(data); });
                    });
                    const duration = metadata.format.duration || 0;
                    const frameCount = 5; // Extract 5 key frames to understand the scene
                    await new Promise((resolve, reject) => {
                        ffmpeg(videoPath)
                            .screenshots({ count: frameCount, folder: tempDir, filename: `frame-${postId}-%i.jpg`, size: '640x?' })
                            .on('end', resolve)
                            .on('error', reject);
                    });
                    const frames = Array.from({ length: frameCount }, (_, i) => path.join(tempDir, `frame-${postId}-${i + 1}.jpg`)).filter(p => fs.existsSync(p));
                    if (frames.length > 0) {
                        const frameParts = frames.map(p => ({ inlineData: { data: fs.readFileSync(p).toString('base64'), mimeType: 'image/jpeg' } }));
                        // Ask AI to analyze video content + reporter notes
                        const analysisRes = await ai.models.generateContent({
                            model: FLASH_MODEL,
                            contents: [{
                                    role: "user",
                                    parts: [
                                        ...frameParts,
                                        { text: `Analyze these video frames and the reporter notes below.
                                    Reporter Notes: ${teluguNews}

                                    Tasks:
                                    1. Safety: Check for YouTube Policy violations (Blood, Violence).
                                    2. Summary: Write a detailed Telugu news report based on the video and reporter notes. STICK TO LENGTH: The summary MUST be between 300 and 330 characters long. Do not exceed 330 or go below 300.
                                    3. Context: Identify any people, objects, or locations visible.

                                    Return JSON: {isSafe: boolean, reason: string, summary: string, locations: string[], people: string[]}` }
                                    ]
                                }],
                            config: { responseMimeType: "application/json" }
                        });
                        const analysisData = parseAIJson(analysisRes.text || "{}");
                        if (analysisData.summary) {
                            console.log(`[VIDEO_PROCESS] AI generated/refined summary from video analysis.`);
                            teluguNews = analysisData.summary; // Use AI-refined news
                        }
                        videoAnalysis = analysisData;
                    }
                }
                catch (vErr) {
                    console.warn(`[VIDEO_PROCESS] Video analysis failed, using reporter text:`, vErr.message);
                }
                const isSafe = videoAnalysis.isSafe !== false;
                const privacyStatus = isSafe ? 'public' : 'private';
                if (isSafe === false) {
                    console.warn(`[VIDEO_PROCESS] Safety check failed for ${postId}`);
                    // ... existing rejection logic ...
                }
                // 2. Generate Voice-over (Try High Quality Chirp HD first, fallback to Standard)
                console.log(`[VIDEO_PROCESS] Generating high-quality voice-over for ${teluguNews.length} characters...`);
                await db.collection('news').doc(postId).update({ status: "PROCESSING_VOICE_OVER" });
                const ttsAuth = new google.auth.GoogleAuth({
                    scopes: ['https://www.googleapis.com/auth/cloud-platform']
                });
                const ttsAuthClient = await ttsAuth.getClient();
                const ttsTokenResponse = await ttsAuthClient.getAccessToken();
                const accessToken = ttsTokenResponse.token;
                const ttsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize`;
                const generateTTS = async (voiceName) => {
                    return fetch(ttsUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`
                        },
                        body: JSON.stringify({
                            input: { text: teluguNews },
                            voice: { languageCode: 'te-IN', name: voiceName },
                            audioConfig: {
                                audioEncoding: 'MP3',
                                speakingRate: 1.15, // Faster news anchor style
                                effectsProfileId: ['telephony-class-application']
                            }
                        })
                    });
                };
                let ttsResponse = await generateTTS('te-IN-Chirp3-HD-Achernar'); // Premium HD Voice
                if (!ttsResponse.ok) {
                    console.warn(`[VIDEO_PROCESS] Premium voice failed, falling back to Standard-A...`);
                    ttsResponse = await generateTTS('te-IN-Standard-A');
                }
                if (!ttsResponse.ok) {
                    const errorText = await ttsResponse.text();
                    console.error(`[VIDEO_PROCESS] TTS API Error: ${ttsResponse.status} ${errorText}`);
                    throw new Error(`TTS API failed: ${ttsResponse.status}`);
                }
                const ttsData = await ttsResponse.json();
                const audioText = ttsData.audioContent || "";
                console.log(`[VIDEO_PROCESS] Voice-over response received (length: ${audioText.length})`);
                const isBase64 = /^[A-Za-z0-9+/=]+$/.test(audioText.trim().substring(0, 50));
                if (!isBase64 || audioText.length < 500) {
                    console.error(`[VIDEO_PROCESS] Invalid audio response. Base64: ${isBase64}, Length: ${audioText.length}`);
                    throw new Error("AI ద్వారా వాయిస్-ఓవర్ జనరేట్ కాలేదు. రెస్పాన్స్ సరిగ్గా లేదు.");
                }
                fs.writeFileSync(audioPath, buffer_1.Buffer.from(audioText, 'base64'));
                // 2.1 Get Voice-over Duration (needed for dynamic ducking)
                const voiceOverDuration = await new Promise((resolve) => {
                    ffmpeg.ffprobe(audioPath, (err, metadata) => {
                        if (err) {
                            console.warn(`[VIDEO_PROCESS] Failed to probe audio duration: ${err.message}`);
                            resolve(15); // Fallback to 15s if probe fails
                        }
                        else {
                            resolve(metadata.format.duration || 15);
                        }
                    });
                });
                console.log(`[VIDEO_PROCESS] Voice-over duration: ${voiceOverDuration}s`);
                // 3. Merge Audio and Video (Mixed with Background Ducking)
                console.log(`[VIDEO_PROCESS] Merging audio and video with dynamic background ducking...`);
                await db.collection('news').doc(postId).update({ status: "MERGING_MEDIA" });
                await new Promise((resolve, reject) => {
                    ffmpeg(videoPath)
                        .input(audioPath)
                        .complexFilter([
                        // Dynamic Ducking: 10% volume during voice-over, 250% volume after voice-over
                        // We use the calculated duration to transition volume
                        `[0:a]volume='if(lt(t,${voiceOverDuration}),0.1,2.5)':eval=frame[bg]`,
                        '[1:a]volume=1.5[voice]',
                        '[bg][voice]amix=inputs=2:duration=longest:dropout_transition=2[outa]'
                    ])
                        .outputOptions([
                        '-c:v', 'copy', // Copy original video without re-encoding
                        '-c:a', 'aac', // Encode output audio as AAC
                        '-b:a', '192k', // High quality audio
                        '-map', '0:v:0', // Map original video
                        '-map', '[outa]' // Map the mixed audio
                    ])
                        .save(outputPath)
                        .on('end', resolve)
                        .on('error', (err) => {
                        console.error(`[VIDEO_PROCESS] FFmpeg Error: ${err.message}`);
                        reject(err);
                    });
                });
                // 4. Upload to YouTube
                console.log(`[VIDEO_PROCESS] Uploading to YouTube...`);
                // Access secrets and clean them thoroughly (removing quotes and invisible characters)
                const cleanSecret = (val) => {
                    if (!val)
                        return "";
                    return val.trim().replace(/^["']|["']$/g, '').trim();
                };
                const clientID = cleanSecret(process.env.YOUTUBE_CLIENT_ID);
                const clientSecret = cleanSecret(process.env.YOUTUBE_CLIENT_SECRET);
                // 🚀 PRIORITIZE Firestore Token (to avoid stale secrets issue)
                const youtubeSettings = await db.collection('settings').doc('youtube').get();
                let refreshToken = youtubeSettings.exists ? youtubeSettings.data()?.refreshToken : null;
                if (!refreshToken) {
                    refreshToken = cleanSecret(process.env.YOUTUBE_REFRESH_TOKEN);
                    console.log(`[VIDEO_PROCESS] Using Refresh Token from Secret Manager.`);
                }
                else {
                    console.log(`[VIDEO_PROCESS] Using Refresh Token from Firestore.`);
                }
                if (!clientID || !clientSecret || !refreshToken) {
                    console.error(`[VIDEO_PROCESS] Missing YouTube credentials. ID=${!!clientID}, Secret=${!!clientSecret}, Token=${!!refreshToken}`);
                    throw new Error("YouTube credentials missing. Please set them using 'firebase functions:secrets:set' or use the Auth Flow.");
                }
                console.log(`[VIDEO_PROCESS] Using credentials: ID_Len=${clientID.length}, Secret_Len=${clientSecret.length}, Token_Len=${refreshToken.length}`);
                console.log(`[VIDEO_PROCESS] Token Check: Start=${refreshToken.substring(0, 10)}..., End=${refreshToken.substring(refreshToken.length - 5)}`);
                // Step 4.1: Manual token refresh test to get the real error message from Google
                try {
                    const params = new URLSearchParams();
                    params.append('client_id', clientID);
                    params.append('client_secret', clientSecret);
                    params.append('refresh_token', refreshToken);
                    params.append('grant_type', 'refresh_token');
                    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: params.toString()
                    });
                    const refreshData = await refreshRes.json();
                    if (!refreshRes.ok) {
                        console.error(`[VIDEO_PROCESS] Google API Rejection:`, JSON.stringify(refreshData));
                        // Special check for common mismatch issues
                        if (refreshData.error === 'invalid_grant') {
                            console.error(`[VIDEO_PROCESS] CRITICAL: Refresh Token is either expired, revoked, or doesn't match this Client ID/Secret.`);
                        }
                    }
                    else {
                        console.log(`[VIDEO_PROCESS] Google API accepted the token! Access Token generated.`);
                    }
                }
                catch (fetchErr) {
                    console.error(`[VIDEO_PROCESS] Manual Refresh Fetch Error:`, fetchErr.message);
                }
                const youtubeAuth = new google.auth.OAuth2(clientID, clientSecret);
                youtubeAuth.setCredentials({ refresh_token: refreshToken });
                // Ensure token is valid or refreshed
                try {
                    const tokenInfo = await youtubeAuth.getAccessToken();
                    if (!tokenInfo || !tokenInfo.token)
                        throw new Error("Could not retrieve access token.");
                    console.log(`[VIDEO_PROCESS] Access token retrieved successfully.`);
                }
                catch (authErr) {
                    console.error(`[VIDEO_PROCESS] YouTube Auth Error:`, authErr.message);
                    if (authErr.response && authErr.response.data) {
                        console.error(`[VIDEO_PROCESS] Auth Error Detail Data:`, JSON.stringify(authErr.response.data));
                    }
                    throw new Error(`YouTube ఆథెంటికేషన్ విఫలమైంది: ${authErr.message}`);
                }
                const youtube = google.youtube({ version: 'v3', auth: youtubeAuth });
                const youtubeRes = await youtube.videos.insert({
                    part: ['snippet', 'status'],
                    requestBody: {
                        snippet: { title: headline.substring(0, 100), description: description.substring(0, 5000), categoryId: '25' },
                        status: { privacyStatus: privacyStatus },
                    },
                    media: { body: fs.createReadStream(outputPath) },
                });
                const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeRes.data.id}`;
                console.log(`[VIDEO_PROCESS] Successfully uploaded to YouTube: ${youtubeUrl}`);
                await db.collection('news').doc(postId).update({
                    youtubeUrl: youtubeUrl,
                    videoProcessed: true,
                    status: "published",
                    approved: true, // ✅ Ensure approved is true
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                });
                // Success Notification
                if (data.isReporter && data.reporter?.id) {
                    await notifyReporter(data.reporter.id, postId, data.headline?.telugu || headline, 'SUCCESS');
                }
                // Update local data for notification
                data.youtubeUrl = youtubeUrl;
                // Cleanup storage
                if (videoUrl.includes('firebasestorage.googleapis.com')) {
                    try {
                        const urlObj = new URL(videoUrl);
                        const fullPath = decodeURIComponent(urlObj.pathname.split('/o/')[1].split('?')[0]);
                        await admin.storage().bucket().file(fullPath).delete();
                    }
                    catch (delErr) { }
                }
            }
            catch (e) {
                console.error(`[VIDEO_PROCESS] Error:`, e.message);
                await db.collection('news').doc(postId).update({
                    videoProcessError: e.message,
                    videoProcessed: false,
                    status: "FAILED",
                    error: `Technical: ${e.message}`
                });
                if (data.isReporter && data.reporter?.id) {
                    await notifyReporter(data.reporter.id, postId, data.headline?.telugu || "", 'INTERNAL_ERROR');
                }
            }
            finally {
                [videoPath, audioPath, outputPath].forEach(p => { if (fs.existsSync(p))
                    fs.unlinkSync(p); });
            }
        }
    }
    // 3. Notify Reporter (removed from end, handled in each step above)
});
exports.triggerPushBroadcast = (0, https_1.onCall)(async (request) => {
    const { title, body, actionUrl, topic, imageUrl, newsId, channelId, silent } = request.data;
    // Validate required fields
    if (!title || !body) {
        throw new https_1.HttpsError('invalid-argument', 'Title and Body are required for manual notification.');
    }
    const message = {
        notification: { title, body },
        data: {
            actionUrl: actionUrl || "",
            newsId: newsId || "",
            channelId: channelId || "general_news",
            imageUrl: imageUrl || ""
        },
        topic: topic || 'all_users'
    };
    // Add Android specific configuration if needed
    message.android = {
        notification: {
            channelId: channelId || "general_news",
            priority: silent ? "low" : "high",
            defaultSound: !silent
        }
    };
    try {
        const response = await admin.messaging().send(message);
        console.log(`[MANUAL_PUSH] Successfully sent message to topic ${topic || 'all_users'}:`, response);
        return { success: true, messageId: response };
    }
    catch (error) {
        console.error(`[MANUAL_PUSH] Error sending message:`, error);
        throw new https_1.HttpsError('internal', error.message || 'Failed to send notification');
    }
});
exports.sendContactEmail = (0, https_1.onCall)({ secrets: ["EMAIL_USER", "EMAIL_PASS"] }, async (request) => {
    const { name, phone, message } = request.data;
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
    await transporter.sendMail({ from: process.env.EMAIL_USER, to: 'alfanews0861@gmail.com', subject: `Contact: ${name}`, text: `Phone: ${phone}\n${message}` });
    return { success: true };
});
exports.submitReporterApplication = (0, https_1.onCall)({ secrets: ["EMAIL_USER", "EMAIL_PASS"] }, async (request) => {
    const data = request.data;
    await db.collection('reporter_applications').add({ ...data, timestamp: admin.firestore.FieldValue.serverTimestamp() });
    return { success: true };
});
__exportStar(require("./notification_engine"), exports);
exports.shareNews = (0, https_1.onRequest)(async (req, res) => {
    const id = req.path.split('/').pop();
    const playUrl = "https://play.google.com/store/apps/details?id=com.alfanews.telugu";
    if (!id || id === 'news')
        return res.redirect(playUrl);
    try {
        const doc = await db.collection('news').doc(id).get();
        if (!doc.exists)
            return res.redirect(playUrl);
        const data = doc.data();
        res.status(200).send(`<html><head><title>${data?.headline?.telugu}</title><meta property="og:image" content="${data?.mediaUrl}"></head><body><script>window.location.href="${playUrl}";</script></body></html>`);
    }
    catch (e) {
        res.redirect(playUrl);
    }
});
/**
 * 7. Manual YouTube Authentication Flow
 */
exports.youtubeAuthStart = (0, https_1.onRequest)({
    secrets: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"]
}, (req, res) => {
    const clientID = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    if (!clientID || !clientSecret) {
        res.status(500).send("YouTube Secrets (ID/Secret) missing in Secret Manager. Please set them first.");
        return;
    }
    const youtubeAuth = new google.auth.OAuth2(clientID, clientSecret, `https://${REGION}-alfa-news-31bf7.cloudfunctions.net/youtubeAuthCallback`);
    const authUrl = youtubeAuth.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: ['https://www.googleapis.com/auth/youtube.upload']
    });
    res.redirect(authUrl);
});
/**
 * 8. YouTube Auth Callback
 */
exports.youtubeAuthCallback = (0, https_1.onRequest)({
    secrets: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"]
}, async (req, res) => {
    const { code } = req.query;
    if (!code) {
        res.status(400).send("Authorization code missing.");
        return;
    }
    const clientID = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const youtubeAuth = new google.auth.OAuth2(clientID, clientSecret, `https://${REGION}-alfa-news-31bf7.cloudfunctions.net/youtubeAuthCallback`);
    try {
        const { tokens } = await youtubeAuth.getToken(code);
        if (tokens.refresh_token) {
            await db.collection('settings').doc('youtube').set({
                refreshToken: tokens.refresh_token,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            res.status(200).send("<h1>Success! ✅</h1><p>YouTube Refresh Token విజయవంతంగా Firestore లో సేవ్ చేయబడింది. మీరు ఇప్పుడు క్లోజ్ చేయవచ్చు.</p>");
        }
        else {
            res.status(400).send("Refresh token not received. Please try again or revoke access first.");
        }
    }
    catch (e) {
        res.status(500).send(`Error: ${e.message}`);
    }
});
//# sourceMappingURL=index.js.map
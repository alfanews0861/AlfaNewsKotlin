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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shareNews = exports.submitReporterApplication = exports.sendContactEmail = exports.triggerPushBroadcast = exports.processNewsPost = exports.generateDailyCartoon = exports.scheduleHistoryOfTheDay = exports.scheduleQuoteOfTheDay = exports.scheduleFestivalGreeting = exports.scheduleTrendingNews = void 0;
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
const sharp_1 = __importDefault(require("sharp"));
admin.initializeApp();
const db = admin.firestore();
const REGION = "asia-south1";
// Scheduled tasks (Quotes, Festivals etc.) use Flash for speed and stability
// Scheduled tasks (Quotes, Festivals etc.) use Lite for speed and cost-effectiveness
const SCHEDULED_MODEL = "gemini-3.1-flash-lite-preview";
// Main News/Reporter processing uses Pro for high quality journalistic output
const PRO_MODEL = "gemini-3-flash-preview";
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
    apiVersion: "v1beta",
    httpOptions: { apiVersion: "v1beta" }
});
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
        const webpBuffer = await (0, sharp_1.default)(buffer).webp({ quality: 80 }).toBuffer();
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
 * 1. Trending News Function
 */
exports.scheduleTrendingNews = (0, scheduler_1.onSchedule)({ schedule: "0 10,14,20 * * *", timeZone: "Asia/Kolkata" }, async (event) => {
    const ai = getAIInstance();
    try {
        const topicRes = await ai.models.generateContent({
            model: SCHEDULED_MODEL,
            contents: [{ role: "user", parts: [{ text: "Identify 2 major trending topics in AP and Telangana for news. Return JSON array of strings." }] }],
            config: { temperature: 0.5, responseMimeType: "application/json" }
        });
        const topics = parseAIJson(topicRes.text || "[]");
        if (Array.isArray(topics)) {
            for (const topic of topics) {
                const schema = {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        headline: { type: genai_1.Type.STRING },
                        content: { type: genai_1.Type.STRING },
                        headlineEn: { type: genai_1.Type.STRING },
                        contentEn: { type: genai_1.Type.STRING },
                        location: { type: genai_1.Type.STRING },
                        refinedCategory: { type: genai_1.Type.STRING }
                    },
                    required: ["headline", "content", "headlineEn", "contentEn", "location", "refinedCategory"]
                };
                const response = await ai.models.generateContent({
                    model: SCHEDULED_MODEL,
                    contents: [{ role: "user", parts: [{ text: `Write a news article about: ${topic}. Output JSON.` }] }],
                    config: {
                        systemInstruction: "You are a Senior Journalist. Write 60 words in Telugu. Output JSON.",
                        temperature: 0.4,
                        responseMimeType: "application/json",
                        responseSchema: schema
                    }
                });
                const aiRes = parseAIJson(response.text || "{}");
                if (!aiRes.headline)
                    continue;
                let mediaUrl = "";
                try {
                    const imgRes = await ai.models.generateImages({
                        model: IMAGEN_MODEL,
                        prompt: `Photorealistic news image for: ${topic}, 9:16 aspect ratio.`,
                        config: { numberOfImages: 1, aspectRatio: '9:16' }
                    });
                    if (imgRes.generatedImages?.[0]?.image?.imageBytes) {
                        const buffer = buffer_1.Buffer.from(imgRes.generatedImages[0].image.imageBytes, 'base64');
                        mediaUrl = await saveBufferToStorage(buffer, "TRENDING") || "";
                    }
                }
                catch (err) {
                    console.error("Trending Image Err:", err);
                }
                await db.collection('news').add({
                    type: 'news',
                    headline: { telugu: aiRes.headline, english: aiRes.headlineEn },
                    content: { telugu: aiRes.content, english: aiRes.contentEn },
                    mediaUrl,
                    category: aiRes.refinedCategory,
                    location: aiRes.location,
                    reporter: getRandomReporter(),
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        }
    }
    catch (e) {
        console.error("[TRENDING] Error:", e.message);
    }
});
/**
 * 2. Festival Greeting Function
 */
exports.scheduleFestivalGreeting = (0, scheduler_1.onSchedule)({ schedule: "0 5 * * *", timeZone: "Asia/Kolkata" }, async (event) => {
    const ai = getAIInstance();
    const dateStr = new Date().toISOString().split('T')[0];
    const schema = {
        type: genai_1.Type.OBJECT,
        properties: { isFestival: { type: genai_1.Type.BOOLEAN }, festivalTe: { type: genai_1.Type.STRING }, greetingTe: { type: genai_1.Type.STRING }, greetingEn: { type: genai_1.Type.STRING } },
        required: ["isFestival", "festivalTe", "greetingTe", "greetingEn"]
    };
    try {
        const checkRes = await ai.models.generateContent({
            model: SCHEDULED_MODEL,
            contents: [{ role: "user", parts: [{ text: `Today is ${dateStr}. Any Telugu festival? JSON.` }] }],
            config: { systemInstruction: "Output JSON only.", temperature: 0.3, responseMimeType: "application/json", responseSchema: schema }
        });
        const data = parseAIJson(checkRes.text || "{}");
        if (!data.isFestival || !data.festivalTe || data.festivalTe === "None")
            return;
        let mediaUrl = "";
        try {
            const imgRes = await ai.models.generateImages({
                model: IMAGEN_MODEL,
                prompt: "Peaceful nature aesthetic background for quote, no text.",
                config: { numberOfImages: 1, aspectRatio: '9:16' }
            });
            if (imgRes.generatedImages?.[0]?.image?.imageBytes) {
                const buffer = buffer_1.Buffer.from(imgRes.generatedImages[0].image.imageBytes, 'base64');
                mediaUrl = await saveBufferToStorage(buffer, "QUOTE") || "";
            }
        }
        catch (err) {
            console.error("Quote Image Err:", err);
        }
        await db.collection('news').add({
            type: 'greeting',
            headline: { telugu: `${data.festivalTe} శుభాకాంక్షలు!`, english: `Happy ${data.festivalTe}!` },
            content: { telugu: data.greetingTe, english: data.greetingEn },
            mediaUrl,
            category: 'పండుగలు',
            reporter: { id: 'system', name: 'AlfaNews Team' },
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
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
    try {
        const res = await ai.models.generateContent({
            model: SCHEDULED_MODEL,
            contents: [{ role: "user", parts: [{ text: "Telugu Quote of the Day. JSON: { \"quoteTe\": \"...\", \"quoteEn\": \"...\" }" }] }],
            config: { responseMimeType: "application/json" }
        });
        const data = parseAIJson(res.text || "{}");
        if (!data.quoteTe)
            return;
        let mediaUrl = "";
        try {
            const imgRes = await ai.models.generateImages({
                model: IMAGEN_MODEL,
                prompt: "Peaceful nature aesthetic background for quote, no text.",
                config: { numberOfImages: 1, aspectRatio: '9:16' }
            });
            if (imgRes.generatedImages?.[0]?.image?.imageBytes) {
                const buffer = buffer_1.Buffer.from(imgRes.generatedImages[0].image.imageBytes, 'base64');
                mediaUrl = await saveBufferToStorage(buffer, "QUOTE") || "";
            }
        }
        catch (err) {
            console.error("Quote Image Err:", err);
        }
        await db.collection('news').add({
            type: 'greeting',
            headline: { telugu: "నేటి మంచి మాట", english: "Quote of the Day" },
            content: { telugu: data.quoteTe, english: data.quoteEn },
            mediaUrl,
            category: 'ప్రేరణ',
            reporter: { id: 'system', name: 'AlfaNews Team' },
            timestamp: admin.firestore.FieldValue.serverTimestamp()
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
    const dateStr = new Date().toLocaleDateString('te-IN', { day: 'numeric', month: 'long' });
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
            contents: [{ role: "user", parts: [{ text: `Out of all historical events that happened on ${dateStr}, pick the single most important event. Write a brief news about it and provide a generic historical image prompt without any text in it. Output JSON.` }] }],
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
        try {
            const imgRes = await ai.models.generateImages({
                model: IMAGEN_MODEL,
                prompt: `Historical photorealistic image: ${data.imagePrompt}, dramatic lighting, no text.`,
                config: { numberOfImages: 1, aspectRatio: '9:16' }
            });
            if (imgRes.generatedImages?.[0]?.image?.imageBytes) {
                const buffer = buffer_1.Buffer.from(imgRes.generatedImages[0].image.imageBytes, 'base64');
                mediaUrl = await saveBufferToStorage(buffer, "HISTORY") || "";
            }
        }
        catch (err) {
            console.error("History Image Err:", err);
        }
        await db.collection('news').add({
            type: 'history',
            headline: { telugu: data.headlineTe, english: data.headlineEn },
            content: { telugu: data.contentTe, english: data.contentEn },
            mediaUrl,
            category: 'చరిత్ర',
            reporter: { id: 'system', name: 'AlfaNews Team' },
            timestamp: admin.firestore.FieldValue.serverTimestamp()
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
    try {
        const imgRes = await ai.models.generateImages({
            model: IMAGEN_MODEL,
            prompt: "Political satire cartoon about Indian current events, clean background, no text.",
            config: { numberOfImages: 1, aspectRatio: '9:16' }
        });
        if (imgRes.generatedImages?.[0]?.image?.imageBytes) {
            const buffer = buffer_1.Buffer.from(imgRes.generatedImages[0].image.imageBytes, 'base64');
            const mediaUrl = await saveBufferToStorage(buffer, "CARTOON") || "";
            await db.collection('news').add({
                type: 'cartoon',
                headline: { telugu: 'నేటి కార్టూన్', english: 'Daily Cartoon' },
                content: { telugu: 'నేటి ప్రత్యేక కార్టూన్', english: 'Daily Special Cartoon' },
                mediaUrl,
                category: 'Entertainment',
                reporter: { id: 'BOT_Cartoonist', name: 'Alfa Cartoonist' },
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    }
    catch (e) {
        console.error("[CARTOON] Error:", e.message);
    }
});
/**
 * 6. Main News Processing (USING HIGH QUALITY PRO MODEL)
 */
exports.processNewsPost = (0, https_1.onCall)(async (request) => {
    const { postId, headline: rawHeadline, content: rawContent, postData } = request.data;
    const ai = getAIInstance();
    try {
        let headline = rawHeadline || postData?.headline?.telugu || "";
        let content = rawContent || postData?.content?.telugu || "";
        let postRef = null;
        if (postId) {
            postRef = db.collection('news').doc(postId);
            const postDoc = await postRef.get();
            if (postDoc.exists) {
                const data = postDoc.data();
                headline = rawHeadline || data?.headline?.telugu || headline;
                content = rawContent || data?.content?.telugu || content;
            }
        }
        if (!headline || !content)
            throw new https_1.HttpsError('invalid-argument', 'Headline and content are required');
        const schema = {
            type: genai_1.Type.OBJECT,
            properties: {
                headline: { type: genai_1.Type.STRING },
                content: { type: genai_1.Type.STRING },
                headlineEn: { type: genai_1.Type.STRING },
                contentEn: { type: genai_1.Type.STRING },
                location: { type: genai_1.Type.STRING },
                storyFingerprint: { type: genai_1.Type.STRING },
                refinedCategory: { type: genai_1.Type.STRING }
            },
            required: ["headline", "content", "headlineEn", "contentEn", "location", "storyFingerprint", "refinedCategory"]
        };
        const response = await ai.models.generateContent({
            model: PRO_MODEL, // Using High Quality model for Journalist tasks
            contents: [{ role: "user", parts: [{ text: `Headline: ${headline}\nContent: ${content}` }] }],
            config: {
                systemInstruction: "You are a Senior Journalist. Write 70 words in Telugu. Output JSON.",
                temperature: 0.4,
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });
        const aiRes = parseAIJson(response.text || "{}");
        if (aiRes.content) {
            let finalMediaUrl = postData?.mediaUrl || "";
            if (finalMediaUrl && !finalMediaUrl.includes('firebasestorage.googleapis.com')) {
                const optimizedUrl = await saveImageLocally(finalMediaUrl, "POST");
                if (optimizedUrl)
                    finalMediaUrl = optimizedUrl;
            }
            const finalData = {
                ...postData,
                headline: { telugu: aiRes.headline, english: aiRes.headlineEn },
                content: { telugu: aiRes.content, english: aiRes.contentEn },
                mediaUrl: finalMediaUrl,
                location: aiRes.location,
                category: aiRes.refinedCategory,
                storyFingerprint: aiRes.storyFingerprint,
                reporter: postData?.reporter || getRandomReporter(),
                aiProcessed: true,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            };
            if (postRef) {
                await postRef.update(finalData);
                return { success: true, postId: postRef.id };
            }
            else {
                const newDocRef = await db.collection('news').add(finalData);
                return { success: true, postId: newDocRef.id };
            }
        }
        return { success: false };
    }
    catch (e) {
        throw new https_1.HttpsError('internal', e.message);
    }
});
exports.triggerPushBroadcast = (0, https_1.onCall)(async (request) => {
    const { title, body, actionUrl, topic } = request.data;
    const message = { notification: { title, body }, data: { actionUrl: actionUrl || "" }, topic: topic || 'all_users' };
    await admin.messaging().send(message);
    return { success: true };
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
//# sourceMappingURL=index.js.map
/**
 * Alfa News - Cloud Functions v17.7 (Optimized AI Models)
 */
import * as admin from "firebase-admin";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as nodemailer from "nodemailer";
import { GoogleGenAI, Type } from "@google/genai";
import { Buffer } from 'buffer';
import sharp from 'sharp';

admin.initializeApp();
const db = admin.firestore();

const REGION = "asia-south1";
// Scheduled tasks (Quotes, Festivals etc.) use Flash for speed and stability
const SCHEDULED_MODEL = "gemini-3.1-flash";
// Main News/Reporter processing uses Pro for high quality journalistic output
const PRO_MODEL = "gemini-3.1-flash";
const IMAGEN_MODEL = "imagen-3.0-generate-001";

setGlobalOptions({
    region: REGION,
    maxInstances: 10,
    memory: "2GiB",
    timeoutSeconds: 300,
    concurrency: 40
});

const getAIInstance = () => new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY || "",
    apiVersion: "v1",
    httpOptions: { apiVersion: "v1" }
});

function parseAIJson(text: string) {
    try {
        let cleanText = text.trim();
        if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```(json)?\n/, '').replace(/\n```$/, '');
        }
        return JSON.parse(cleanText);
    } catch(e) {
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

async function saveBufferToStorage(buffer: Buffer, prefix: string): Promise<string | null> {
    try {
        const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();
        const bucket = admin.storage().bucket();
        const fileName = `news-media/${prefix}_${Date.now()}.webp`;
        await bucket.file(fileName).save(webpBuffer, { metadata: { contentType: 'image/webp' } });
        return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;
    } catch (e) {
        console.error("Buffer save error:", e);
        return null;
    }
}

async function saveImageLocally(externalUrl: string, prefix: string): Promise<string | null> {
    try {
        const response = await fetch(externalUrl);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        return await saveBufferToStorage(Buffer.from(arrayBuffer), prefix);
    } catch (e) {
        console.error("External image save error:", e);
        return null;
    }
}

/**
 * 1. Trending News Function
 */
export const scheduleTrendingNews = onSchedule({ schedule: "0 10,14,20 * * *", timeZone: "Asia/Kolkata" }, async (event) => {
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
                    type: Type.OBJECT,
                    properties: {
                        headline: { type: Type.STRING },
                        content: { type: Type.STRING },
                        headlineEn: { type: Type.STRING },
                        contentEn: { type: Type.STRING },
                        location: { type: Type.STRING },
                        refinedCategory: { type: Type.STRING }
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
                if(!aiRes.headline) continue;

                let mediaUrl = "";
                try {
                    const imgRes = await ai.models.generateImages({
                        model: IMAGEN_MODEL,
                        prompt: `Photorealistic news image for: ${topic}, 9:16 aspect ratio.`,
                        config: { numberOfImages: 1, aspectRatio: '9:16' }
                    });
                    if (imgRes.generatedImages?.[0]?.image?.imageBytes) {
                        const buffer = Buffer.from(imgRes.generatedImages[0].image.imageBytes, 'base64');
                        mediaUrl = await saveBufferToStorage(buffer, "TRENDING") || "";
                    }
                } catch (err) { console.error("Trending Image Err:", err); }

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
    } catch (e: any) { console.error("[TRENDING] Error:", e.message); }
});

/**
 * 2. Festival Greeting Function
 */
export const scheduleFestivalGreeting = onSchedule({ schedule: "0 5 * * *", timeZone: "Asia/Kolkata" }, async (event) => {
    const ai = getAIInstance();
    const dateStr = new Date().toISOString().split('T')[0];
    const schema = {
        type: Type.OBJECT,
        properties: { isFestival: { type: Type.BOOLEAN }, festivalTe: { type: Type.STRING }, greetingTe: { type: Type.STRING }, greetingEn: { type: Type.STRING } },
        required: ["isFestival", "festivalTe", "greetingTe", "greetingEn"]
    };

    try {
        const checkRes = await ai.models.generateContent({
            model: SCHEDULED_MODEL,
            contents: [{ role: "user", parts: [{ text: `Today is ${dateStr}. Any Telugu festival? JSON.` }] }],
            config: { systemInstruction: "Output JSON only.", temperature: 0.3, responseMimeType: "application/json", responseSchema: schema }
        });
        const data = parseAIJson(checkRes.text || "{}");
        if (!data.isFestival || !data.festivalTe || data.festivalTe === "None") return;

        let mediaUrl = "";
        try {
            const imgRes = await ai.models.generateImages({
                model: IMAGEN_MODEL,
                prompt: `Traditional greeting card image for ${data.festivalTe} festival, no text.`,
                config: { numberOfImages: 1, aspectRatio: '9:16' }
            });
            if (imgRes.generatedImages?.[0]?.image?.imageBytes) {
                const buffer = Buffer.from(imgRes.generatedImages[0].image.imageBytes, 'base64');
                mediaUrl = await saveBufferToStorage(buffer, "FESTIVAL") || "";
            }
        } catch (err) { console.error("Festival Image Err:", err); }

        await db.collection('news').add({
            type: 'greeting',
            headline: { telugu: `${data.festivalTe} శుభాకాంక్షలు!`, english: `Happy ${data.festivalTe}!` },
            content: { telugu: data.greetingTe, english: data.greetingEn },
            mediaUrl,
            category: 'పండుగలు',
            reporter: { id: 'system', name: 'AlfaNews Team' },
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (e: any) { console.error("[FESTIVAL] Error:", e.message); }
});

/**
 * 3. Quote of the Day Function
 */
export const scheduleQuoteOfTheDay = onSchedule({ schedule: "0 4 * * *", timeZone: "Asia/Kolkata" }, async (event) => {
    const ai = getAIInstance();
    try {
        const res = await ai.models.generateContent({
            model: SCHEDULED_MODEL,
            contents: [{ role: "user", parts: [{ text: "Telugu Quote of the Day. JSON: { \"quoteTe\": \"...\", \"quoteEn\": \"...\" }" }] }],
            config: { responseMimeType: "application/json" }
        });
        const data = parseAIJson(res.text || "{}");
        if (!data.quoteTe) return;

        let mediaUrl = "";
        try {
            const imgRes = await ai.models.generateImages({
                model: IMAGEN_MODEL,
                prompt: "Peaceful nature aesthetic background for quote, no text.",
                config: { numberOfImages: 1, aspectRatio: '9:16' }
            });
            if (imgRes.generatedImages?.[0]?.image?.imageBytes) {
                const buffer = Buffer.from(imgRes.generatedImages[0].image.imageBytes, 'base64');
                mediaUrl = await saveBufferToStorage(buffer, "QUOTE") || "";
            }
        } catch (err) { console.error("Quote Image Err:", err); }

        await db.collection('news').add({
            type: 'greeting',
            headline: { telugu: "నేటి మంచి మాట", english: "Quote of the Day" },
            content: { telugu: data.quoteTe, english: data.quoteEn },
            mediaUrl,
            category: 'ప్రేరణ',
            reporter: { id: 'system', name: 'AlfaNews Team' },
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (e: any) { console.error("[QUOTE] Error:", e.message); }
});

/**
 * 4. On This Day Function
 */
export const scheduleHistoryOfTheDay = onSchedule({ schedule: "30 4 * * *", timeZone: "Asia/Kolkata" }, async (event) => {
    const ai = getAIInstance();
    const dateStr = new Date().toLocaleDateString('te-IN', { day: 'numeric', month: 'long' });
    try {
        const res = await ai.models.generateContent({
            model: SCHEDULED_MODEL,
            contents: [{ role: "user", parts: [{ text: `History of ${dateStr}? JSON: { "headlineTe": "...", "contentTe": "...", "headlineEn": "...", "contentEn": "..." }` }] }],
            config: { responseMimeType: "application/json" }
        });
        const data = parseAIJson(res.text || "{}");
        if (data.headlineTe) {
             await db.collection('news').add({
                type: 'history',
                headline: { telugu: data.headlineTe, english: data.headlineEn || "On This Day" },
                content: { telugu: data.contentTe, english: data.contentEn || "" },
                category: 'చరిత్ర',
                reporter: { id: 'system', name: 'AlfaNews Team' },
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (e: any) { console.error("[HISTORY] Error:", e.message); }
});

/**
 * 5. Daily Cartoon Function
 */
export const generateDailyCartoon = onSchedule({ schedule: "0 6 * * *", timeZone: "Asia/Kolkata" }, async (event) => {
    const ai = getAIInstance();
    try {
        const imgRes = await ai.models.generateImages({
            model: IMAGEN_MODEL,
            prompt: "Political satire cartoon about Indian current events, clean background, no text.",
            config: { numberOfImages: 1, aspectRatio: '9:16' }
        });

        if (imgRes.generatedImages?.[0]?.image?.imageBytes) {
            const buffer = Buffer.from(imgRes.generatedImages[0].image.imageBytes, 'base64');
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
    } catch (e: any) { console.error("[CARTOON] Error:", e.message); }
});

/**
 * 6. Main News Processing (USING HIGH QUALITY PRO MODEL)
 */
export const processNewsPost = onCall(async (request) => {
    const { postId, headline: rawHeadline, content: rawContent, postData } = request.data;
    const ai = getAIInstance();
    try {
        let headline = rawHeadline || postData?.headline?.telugu || "";
        let content = rawContent || postData?.content?.telugu || "";
        let postRef: admin.firestore.DocumentReference | null = null;

        if (postId) {
            postRef = db.collection('news').doc(postId);
            const postDoc = await postRef.get();
            if (postDoc.exists) {
                const data = postDoc.data();
                headline = rawHeadline || data?.headline?.telugu || headline;
                content = rawContent || data?.content?.telugu || content;
            }
        }

        if (!headline || !content) throw new HttpsError('invalid-argument', 'Headline and content are required');

        const schema = {
            type: Type.OBJECT,
            properties: {
                headline: { type: Type.STRING },
                content: { type: Type.STRING },
                headlineEn: { type: Type.STRING },
                contentEn: { type: Type.STRING },
                location: { type: Type.STRING },
                storyFingerprint: { type: Type.STRING },
                refinedCategory: { type: Type.STRING }
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
                if (optimizedUrl) finalMediaUrl = optimizedUrl;
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
            } else {
                const newDocRef = await db.collection('news').add(finalData);
                return { success: true, postId: newDocRef.id };
            }
        }
        return { success: false };
    } catch (e: any) { throw new HttpsError('internal', e.message); }
});

export const triggerPushBroadcast = onCall(async (request) => {
    const { title, body, actionUrl, topic } = request.data;
    const message = { notification: { title, body }, data: { actionUrl: actionUrl || "" }, topic: topic || 'all_users' };
    await admin.messaging().send(message);
    return { success: true };
});

export const sendContactEmail = onCall({ secrets: ["EMAIL_USER", "EMAIL_PASS"] }, async (request) => {
    const { name, phone, message } = request.data;
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
    await transporter.sendMail({ from: process.env.EMAIL_USER, to: 'alfanews0861@gmail.com', subject: `Contact: ${name}`, text: `Phone: ${phone}\n${message}` });
    return { success: true };
});

export const submitReporterApplication = onCall({ secrets: ["EMAIL_USER", "EMAIL_PASS"] }, async (request) => {
    const data = request.data;
    await db.collection('reporter_applications').add({ ...data, timestamp: admin.firestore.FieldValue.serverTimestamp() });
    return { success: true };
});

export const shareNews = onRequest(async (req, res) => {
    const id = req.path.split('/').pop();
    const playUrl = "https://play.google.com/store/apps/details?id=com.alfanews.telugu";
    if (!id || id === 'news') return res.redirect(playUrl);
    try {
        const doc = await db.collection('news').doc(id).get();
        if (!doc.exists) return res.redirect(playUrl);
        const data = doc.data();
        res.status(200).send(`<html><head><title>${data?.headline?.telugu}</title><meta property="og:image" content="${data?.mediaUrl}"></head><body><script>window.location.href="${playUrl}";</script></body></html>`);
    } catch (e) { res.redirect(playUrl); }
});

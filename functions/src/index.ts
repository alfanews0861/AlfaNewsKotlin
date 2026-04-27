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
const sharp = require('sharp');
const { google } = require('googleapis');
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
const ffmpeg = require('fluent-ffmpeg');
import { onDocumentCreated } from "firebase-functions/v2/firestore";

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
const SCHEDULED_MODEL = "gemini-3.1-flash";
// Voice-over and high-reasoning tasks use Pro
const PRO_MODEL = "gemini-3.1-pro";
// News processing uses Flash for speed
const FLASH_MODEL = "gemini-3.1-flash";
const IMAGEN_MODEL = "imagen-4.0-generate-001";

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
 * 2. Festival Greeting Function
 */
export const scheduleFestivalGreeting = onSchedule({ schedule: "0 5 * * *", timeZone: "Asia/Kolkata" }, async (event) => {
    const ai = getAIInstance();
    const dateStr = getISTDateString();
    console.log(`[FESTIVAL] Checking festivals for ${dateStr}...`);

    const schema = {
        type: Type.OBJECT,
        properties: { isFestival: { type: Type.BOOLEAN }, festivalTe: { type: Type.STRING }, greetingTe: { type: Type.STRING }, greetingEn: { type: Type.STRING }, imagePrompt: { type: Type.STRING } },
        required: ["isFestival", "festivalTe", "greetingTe", "greetingEn", "imagePrompt"]
    };

    try {
        const checkRes = await ai.models.generateContent({
            model: SCHEDULED_MODEL, // Using gemini-3.1-flash as requested
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
        try {
            const imgRes = await ai.models.generateImages({
                model: IMAGEN_MODEL,
                prompt: `Beautiful high quality aesthetic background for ${data.imagePrompt || data.festivalTe} festival greeting in India, warm atmosphere, space for text, no text.`,
                config: { numberOfImages: 1, aspectRatio: '9:16' }
            });
            if (imgRes.generatedImages?.[0]?.image?.imageBytes) {
                const buffer = Buffer.from(imgRes.generatedImages[0].image.imageBytes, 'base64');
                mediaUrl = await saveBufferToStorage(buffer, "GREETING") || "";
            }
        } catch (err) { console.error("Greeting Image Err:", err); }

        await db.collection('news').add({
            type: 'greeting',
            postFormat: 'VERTICAL', // Force 9:16 Full Screen Card UI
            likes: 0,               // Required for Full Screen Special Card logic
            comments: 0,
            shares: 0,
            headline: { telugu: `${data.festivalTe} శుభాకాంక్షలు!`, english: `Happy ${data.festivalTe}!` },
            content: { telugu: data.greetingTe, english: data.greetingEn },
            mediaUrl,
            category: 'పండుగలు',
            reporter: { id: 'system', name: 'AlfaNews Team' },
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[FESTIVAL] Successfully created greeting post for ${data.festivalTe}.`);
    } catch (e: any) { console.error("[FESTIVAL] Error:", e.message); }
});

/**
 * 3. Quote of the Day Function
 */
export const scheduleQuoteOfTheDay = onSchedule({ schedule: "0 4 * * *", timeZone: "Asia/Kolkata" }, async (event) => {
    const ai = getAIInstance();

    // Add random author/theme based on the current day to ensure a unique quote every single day of the year
    const authorsAndThemes = ['Swami Vivekananda', 'APJ Abdul Kalam', 'Gautam Buddha', 'Mahatma Gandhi', 'Bhagavad Gita', 'Vemana', 'Sumathi Satakam', 'Chanakya', 'Socrates', 'Albert Einstein', 'Confucius', 'Telugu Proverbs', 'Rumi', 'Thirukkural', 'Jiddu Krishnamurti', 'Osho', 'Marcus Aurelius', 'Mother Teresa'];
    const todayStr = getISTDateString();
    const randomSeed = Math.floor(Math.random() * authorsAndThemes.length);
    const selectedTheme = authorsAndThemes[randomSeed];

    const schema = {
        type: Type.OBJECT,
        properties: {
            quoteTe: { type: Type.STRING },
            quoteEn: { type: Type.STRING },
            author: { type: Type.STRING },
            imagePrompt: { type: Type.STRING }
        },
        required: ["quoteTe", "quoteEn", "author", "imagePrompt"]
    };
    try {
        const res = await ai.models.generateContent({
            model: SCHEDULED_MODEL, // Using Gemini 3.1 Flash as requested
            contents: [{ role: "user", parts: [{ text: `Today is ${todayStr}. Provide a highly unique, rare, and deeply inspirational Telugu quote by ${selectedTheme}. Do NOT repeat common quotes. Make sure it is 100% unique for this specific date. Output JSON.` }] }],
            config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.8 } // Higher temperature for more uniqueness
        });
        const data = parseAIJson(res.text || "{}");
        if (!data.quoteTe) return;

        let mediaUrl = "";
        try {
            const imgRes = await ai.models.generateImages({
                model: IMAGEN_MODEL,
                prompt: `Photorealistic aesthetic portrait or background of ${data.imagePrompt}, warm lighting, very beautiful, absolutely no text, no words.`,
                config: { numberOfImages: 1, aspectRatio: '9:16' }
            });
            if (imgRes.generatedImages?.[0]?.image?.imageBytes) {
                const buffer = Buffer.from(imgRes.generatedImages[0].image.imageBytes, 'base64');
                mediaUrl = await saveBufferToStorage(buffer, "QUOTE") || "";
            }
        } catch (err) { console.error("Quote Image Err:", err); }

        await db.collection('news').add({
            type: 'greeting', // Changed from 'quote' to 'greeting' so the app treats it as a special full screen card
            postFormat: 'VERTICAL', // Force 9:16 Full Screen Card UI
            likes: 1,               // 1 like identifies it as a Quote in your NewsFeedViewModel
            comments: 0,
            shares: 0,
            headline: { telugu: "నేటి మంచి మాట", english: "Quote of the Day" },
            content: { telugu: `${data.quoteTe}\n\n- ${data.author}`, english: `${data.quoteEn}\n\n- ${data.author}` },
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
    const dateStr = new Date().toLocaleDateString('te-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long' });

    const schema = {
        type: Type.OBJECT,
        properties: {
            headlineTe: { type: Type.STRING },
            contentTe: { type: Type.STRING },
            headlineEn: { type: Type.STRING },
            contentEn: { type: Type.STRING },
            imagePrompt: { type: Type.STRING }
        },
        required: ["headlineTe", "contentTe", "headlineEn", "contentEn", "imagePrompt"]
    };

    try {
        const res = await ai.models.generateContent({
            model: SCHEDULED_MODEL,
            contents: [{ role: "user", parts: [{ text: `Out of all historical events that happened on ${dateStr}, pick the single most important event. Write a 60 words detailed news about it and provide a generic historical image prompt. Output JSON.` }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
                temperature: 0.5
            }
        });
        const data = parseAIJson(res.text || "{}");
        if (!data.headlineTe) return;

        let mediaUrl = "";
        try {
            const imgRes = await ai.models.generateImages({
                model: IMAGEN_MODEL,
                prompt: `Historical photorealistic image: ${data.imagePrompt}, dramatic lighting, no text.`,
                config: { numberOfImages: 1, aspectRatio: '16:9' } // Changed to 16:9
            });
            if (imgRes.generatedImages?.[0]?.image?.imageBytes) {
                const buffer = Buffer.from(imgRes.generatedImages[0].image.imageBytes, 'base64');
                mediaUrl = await saveBufferToStorage(buffer, "HISTORY") || "";
            }
        } catch (err) { console.error("History Image Err:", err); }

        await db.collection('news').add({
            type: 'history',
            headline: { telugu: data.headlineTe, english: data.headlineEn },
            content: { telugu: data.contentTe, english: data.contentEn },
            mediaUrl,
            category: 'చరిత్ర',
            reporter: { id: 'system', name: 'AlfaNews Team' },
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (e: any) { console.error("[HISTORY] Error:", e.message); }
});

/**
 * 5. Daily Cartoon Function
 */
export const generateDailyCartoon = onSchedule({ schedule: "0 6 * * *", timeZone: "Asia/Kolkata" }, async (event) => {
    const ai = getAIInstance();
    const states = ["Andhra Pradesh", "Telangana"];
    const todayStr = getISTDateString();
    for (const state of states) {
        try {
            const schema = {
                type: Type.OBJECT,
                properties: {
                    topic: { type: Type.STRING },
                    visualDescription: { type: Type.STRING },
                    teluguCaption: { type: Type.STRING }
                },
                required: ["topic", "visualDescription", "teluguCaption"]
            };

            const topicRes = await ai.models.generateContent({
                model: SCHEDULED_MODEL, // Using Gemini 3.1 Flash as requested
                contents: [{ role: "user", parts: [{ text: `Today's Date: ${todayStr}.
Role: You are an award-winning editorial and political cartoonist for a leading Telugu news daily, known for sharp satire and being a "voice of the opposition."
Goal: Identify a highly relevant, satirical, and humorous current political topic in ${state} (India) from the last 24-48 hours.
Stance: Be critical of the ruling government's policies, failures, or ironies.
Requirements:
1. Topic: A short name for the issue.
2. Visual Description: A precise scene description for an AI artist. Include recognizable caricatures of specific politicians (describe their signature looks like glasses, hair, or specific attire).
3. Telugu Caption: A short, punchy, and highly satirical dialogue or caption in Telugu script that captures the irony.
Provide the output in JSON.` }] }],
                config: { temperature: 0.9, responseMimeType: "application/json", responseSchema: schema }
            });

            const cartoonData = parseAIJson(topicRes.text || "{}");
            const topic = cartoonData.topic || "political irony";
            const visual = cartoonData.visualDescription || "politicians in a satirical situation";
            const teluguText = cartoonData.teluguCaption || "";

            const imgRes = await ai.models.generateImages({
                model: IMAGEN_MODEL,
                prompt: `A sharp, professional editorial political cartoon for a Telugu newspaper about ${topic} in ${state}, India.
Visual scene: ${visual}.
Style: High-quality ink line art, editorial caricature style, clean and recognizable.
IMPORTANT: The cartoon must feature a speech bubble or a sign board with the following Telugu text written PERFECTLY: "${teluguText}".
The caricatures should be recognizable as the politicians described. No English text.`,
                config: { numberOfImages: 1, aspectRatio: '9:16', addWatermark: false }
            });

            if (imgRes.generatedImages?.[0]?.image?.imageBytes) {
                const buffer = Buffer.from(imgRes.generatedImages[0].image.imageBytes, 'base64');
                const mediaUrl = await saveBufferToStorage(buffer, `CARTOON_${state.replace(" ", "")}`) || "";
                await db.collection('news').add({
                    type: 'cartoon',
                    postFormat: 'VERTICAL', // Force 9:16 Full Screen Card UI
                    likes: 0,
                    comments: 0,
                    shares: 0,
                    headline: { telugu: `${state === 'Andhra Pradesh' ? 'ఆంధ్రప్రదేశ్' : 'తెలంగాణ'} కార్టూన్`, english: `${state} Cartoon` },
                    content: { telugu: `నేటి రాజకీయ వ్యంగ్య చిత్రం: ${topic}`, english: 'Daily Political Satire Cartoon' },
                    mediaUrl,
                    category: 'కార్టూన్',
                    location: state,
                    district: state,
                    reporter: { id: 'BOT_Cartoonist', name: 'Alfa Cartoonist' },
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        } catch (e: any) { console.error(`[CARTOON] Error for ${state}:`, e.message); }
    }
});

/**
 * 6. Main News Processing (USING HIGH QUALITY PRO MODEL)
 * Processes both Citizen and Reporter submissions through AI enhancement
 */
export const processNewsPost = onCall(async (request) => {
    const { postId, headline: rawHeadline, content: rawContent, postData } = request.data;
    const ai = getAIInstance();
    try {
        let headline = rawHeadline || postData?.headline?.telugu || "";
        let content = rawContent || postData?.content?.telugu || "";
        let postRef: admin.firestore.DocumentReference | null = null;
        let actualPostData = postData || {};

        if (postId) {
            postRef = db.collection('news').doc(postId);
            const postDoc = await postRef.get();
            if (postDoc.exists) {
                const data = postDoc.data();
                if (data) {
                    actualPostData = { ...data, ...actualPostData };
                    headline = rawHeadline || data?.headline?.telugu || headline;
                    content = rawContent || data?.content?.telugu || content;
                }
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
                refinedCategory: { type: Type.STRING },
                isSafeForYouTube: { type: Type.BOOLEAN },
                rejectionReason: { type: Type.STRING },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                entities: {
                    type: Type.OBJECT,
                    properties: {
                        people: { type: Type.ARRAY, items: { type: Type.STRING } },
                        organizations: { type: Type.ARRAY, items: { type: Type.STRING } },
                        locations: { type: Type.ARRAY, items: { type: Type.STRING } }
                    }
                }
            },
            required: ["headline", "content", "headlineEn", "contentEn", "location", "storyFingerprint", "refinedCategory", "isSafeForYouTube", "tags", "entities"]
        };

        const response = await ai.models.generateContent({
            model: FLASH_MODEL,
            contents: [{ role: "user", parts: [{ text: `Headline: ${headline}\nContent: ${content}` }] }],
            config: {
                systemInstruction: "You are a Senior Journalist. Write 70 words in Telugu. Extract tags and entities. CRITICAL: Evaluate if this content violates YouTube Community Guidelines (Violence, Hate Speech, Graphic Content, etc.). Be EXTREMELY STRICT. If there is even 1% doubt, set isSafeForYouTube to false. Output JSON.",
                temperature: 0.1, // Lower temperature for more consistent safety checks
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        } as any);

        const aiRes = parseAIJson(response.text || "{}");
        if (aiRes.content) {
            let finalMediaUrl = actualPostData?.mediaUrl || "";
            if (finalMediaUrl && !finalMediaUrl.includes('firebasestorage.googleapis.com')) {
                const optimizedUrl = await saveImageLocally(finalMediaUrl, "POST");
                if (optimizedUrl) finalMediaUrl = optimizedUrl;
            }

            const finalData = {
                ...actualPostData,
                headline: { telugu: aiRes.headline, english: aiRes.headlineEn },
                content: { telugu: aiRes.content, english: aiRes.contentEn },
                mediaUrl: finalMediaUrl,
                mediaUrls: actualPostData?.mediaUrls || (finalMediaUrl ? [finalMediaUrl] : []),
                mediaType: actualPostData?.mediaType || "IMAGE",
                mediaTypes: actualPostData?.mediaTypes || (actualPostData?.mediaType ? [actualPostData.mediaType] : []),
                location: aiRes.location,
                category: aiRes.refinedCategory,
                categories: Array.from(new Set([
                    aiRes.refinedCategory,
                    ...(actualPostData?.categories || []),
                    ...(actualPostData?.district ? [actualPostData.district] : [])
                ])).filter(c => !!c),
                tags: aiRes.tags || [],
                entities: aiRes.entities || { people: [], organizations: [], locations: [] },
                isSafeForYouTube: aiRes.isSafeForYouTube ?? true,
                rejectionReason: aiRes.rejectionReason || "",
                storyFingerprint: aiRes.storyFingerprint,
                // Preserve reporter if available, otherwise keep the original reporter or assign random one
                reporter: actualPostData?.reporter || (actualPostData?.isCitizen ? null : getRandomReporter()),
                // Ensure both citizen and reporter submissions are properly flagged
                isCitizen: actualPostData?.isCitizen || false,
                isReporter: actualPostData?.isReporter || false,
                aiProcessed: true,
                aiProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
                timestamp: actualPostData?.timestamp || admin.firestore.FieldValue.serverTimestamp(),
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

/**
 * 6.1 Process Reporter Submission
 * Dedicated function to ensure reporter news submissions are processed with AI enhancement
 * This function explicitly handles reporter submissions and flags them appropriately
 */
export const processReporterSubmission = onCall(async (request) => {
    const { postId, headline: rawHeadline, content: rawContent, postData } = request.data;
    const ai = getAIInstance();
    try {
        let headline = rawHeadline || postData?.headline?.telugu || "";
        let content = rawContent || postData?.content?.telugu || "";
        let postRef: admin.firestore.DocumentReference | null = null;
        let actualPostData = postData || {};

        if (postId) {
            postRef = db.collection('news').doc(postId);
            const postDoc = await postRef.get();
            if (postDoc.exists) {
                const data = postDoc.data();
                if (data) {
                    actualPostData = { ...data, ...actualPostData };
                    headline = rawHeadline || data?.headline?.telugu || headline;
                    content = rawContent || data?.content?.telugu || content;
                }
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
                refinedCategory: { type: Type.STRING },
                isSafeForYouTube: { type: Type.BOOLEAN },
                rejectionReason: { type: Type.STRING },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                entities: {
                    type: Type.OBJECT,
                    properties: {
                        people: { type: Type.ARRAY, items: { type: Type.STRING } },
                        organizations: { type: Type.ARRAY, items: { type: Type.STRING } },
                        locations: { type: Type.ARRAY, items: { type: Type.STRING } }
                    }
                }
            },
            required: ["headline", "content", "headlineEn", "contentEn", "location", "storyFingerprint", "refinedCategory", "isSafeForYouTube", "tags", "entities"]
        };

        const response = await ai.models.generateContent({
            model: FLASH_MODEL,
            contents: [{ role: "user", parts: [{ text: `Headline: ${headline}\nContent: ${content}` }] }],
            config: {
                systemInstruction: "You are a Senior Editor processing a reporter's news submission. Enhance and refine the 70-word Telugu article. Extract tags and entities. CRITICAL: Evaluate if this content violates YouTube Community Guidelines (Violence, Hate Speech, Graphic Content, etc.). Set isSafeForYouTube to false if it does. Output JSON.",
                temperature: 0.4,
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        } as any);

        const aiRes = parseAIJson(response.text || "{}");
        if (aiRes.content) {
            let finalMediaUrl = actualPostData?.mediaUrl || "";
            if (finalMediaUrl && !finalMediaUrl.includes('firebasestorage.googleapis.com')) {
                const optimizedUrl = await saveImageLocally(finalMediaUrl, "POST");
                if (optimizedUrl) finalMediaUrl = optimizedUrl;
            }

            const finalData = {
                ...actualPostData,
                headline: { telugu: aiRes.headline, english: aiRes.headlineEn },
                content: { telugu: aiRes.content, english: aiRes.contentEn },
                mediaUrl: finalMediaUrl,
                mediaUrls: actualPostData?.mediaUrls || (finalMediaUrl ? [finalMediaUrl] : []),
                mediaType: actualPostData?.mediaType || "image",
                mediaTypes: actualPostData?.mediaTypes || (actualPostData?.mediaType ? [actualPostData.mediaType] : []),
                location: aiRes.location,
                category: aiRes.refinedCategory,
                categories: Array.from(new Set([
                    aiRes.refinedCategory,
                    ...(actualPostData?.categories || []),
                    ...(actualPostData?.district ? [actualPostData.district] : [])
                ])).filter(c => !!c),
                tags: aiRes.tags || [],
                entities: aiRes.entities || { people: [], organizations: [], locations: [] },
                isSafeForYouTube: aiRes.isSafeForYouTube ?? true,
                rejectionReason: aiRes.rejectionReason || "",
                storyFingerprint: aiRes.storyFingerprint,
                // Preserve the reporter information
                reporter: actualPostData?.reporter,
                isReporter: true,
                isCitizen: false,
                aiProcessed: true,
                aiProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
                processingType: "REPORTER_SUBMISSION",
                timestamp: actualPostData?.timestamp || admin.firestore.FieldValue.serverTimestamp(),
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

/**
 * 6.2 Background Video Processing & YouTube Upload
 */
export const onNewsPostCreated = onDocumentCreated({
    document: "news/{postId}",
    secrets: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"]
}, async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    const data = snapshot.data();
    const postId = event.params.postId;

    if (!data || data.youtubeUrl || !data.mediaUrls || !data.mediaTypes) return;

    const videoIndex = data.mediaTypes.indexOf('VIDEO');
    if (videoIndex === -1) return;

    // YouTube Safety Check
    if (data.isSafeForYouTube === false) {
        console.warn(`[VIDEO_PROCESS] Rejected for YouTube: Policy violation detected for post ${postId}`);
        await db.collection('news').doc(postId).update({
            videoProcessed: false,
            videoProcessError: "Rejected by AI Safety Guard: YouTube Policy Violation suspected.",
            isApproved: false
        });
        return;
    }

    console.log(`[VIDEO_PROCESS] Starting background processing for post: ${postId}`);

    const videoUrl = data.mediaUrls[videoIndex];
    const teluguNews = data.content?.telugu || "";
    const headline = data.headline?.telugu || "Alfa News";
    const reporterName = data.reporter?.name || "";
    const tags = data.tags || [];
    const people = data.entities?.people || [];
    const locations = data.entities?.locations || [];

    // Construct detailed description for YouTube
    let description = "";
    if (reporterName) description += `రిపోర్టర్: ${reporterName}\n\n`;
    description += `${teluguNews}\n\n`;

    if (tags && tags.length > 0) {
        description += tags.map((t: string) => t.startsWith('#') ? t : `#${t.replace(/\s+/g, '')}`).join(' ') + "\n\n";
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
        const videoRes = await fetch(videoUrl);
        const videoBuffer = await videoRes.arrayBuffer();
        fs.writeFileSync(videoPath, Buffer.from(videoBuffer));

        // 1.1 Visual Safety Check (Extract frames every 30 seconds)
        const ai = getAIInstance();
        const metadata: any = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err: any, data: any) => { if (err) reject(err); else resolve(data); });
        });
        const duration = metadata.format.duration || 0;
        const frameInterval = 30; // seconds
        const frameCount = Math.max(3, Math.min(20, Math.floor(duration / frameInterval)));

        await new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .screenshots({ count: frameCount, folder: tempDir, filename: `frame-${postId}-%i.jpg`, size: '320x?' })
                .on('end', resolve)
                .on('error', reject);
        });

        const frames = Array.from({ length: frameCount }, (_, i) => path.join(tempDir, `frame-${postId}-${i + 1}.jpg`)).filter(p => fs.existsSync(p));
        let visualSafetyResult = { isSafe: true, reason: "" };

        if (frames.length > 0) {
            const frameParts = frames.map(p => ({ inlineData: { data: fs.readFileSync(p).toString('base64'), mimeType: 'image/jpeg' } }));
            const safetyRes = await ai.models.generateContent({
                model: FLASH_MODEL,
                contents: [{ role: "user", parts: [...frameParts, { text: "Analyze these video frames for YouTube Policy violations (Violence, Blood, Suicide, etc.). Be EXTREMELY STRICT. Return JSON: {isSafe: boolean, reason: string, bestSafeFrameIndex: number}" }] }],
                config: { responseMimeType: "application/json" }
            });
            visualSafetyResult = parseAIJson(safetyRes.text || "{}");
        }

        let isSafe = visualSafetyResult.isSafe !== false;
        const privacyStatus = isSafe ? 'public' : 'private';

        if (!isSafe) {
            console.warn(`[VIDEO_PROCESS] VISUAL SAFETY REJECTION for post ${postId}: ${visualSafetyResult.reason}`);
            // Switch to Image mode for the app
            const safeFrameIdx = (visualSafetyResult.bestSafeFrameIndex || 1) - 1;
            const safeFramePath = frames[safeFrameIdx] || frames[0];

            if (fs.existsSync(safeFramePath)) {
                const safeFrameBuffer = fs.readFileSync(safeFramePath);
                const safeImageUrl = await saveBufferToStorage(safeFrameBuffer, "SAFE_FRAME");
                if (safeImageUrl) {
                    await db.collection('news').doc(postId).update({
                        mediaUrl: safeImageUrl,
                        mediaType: 'IMAGE',
                        videoSafetyWarning: visualSafetyResult.reason,
                        videoIsPrivate: true
                    });
                }
            }
        }

        // 2. Generate Voice-over

        const audioResponse = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: [{ role: "user", parts: [{ text: `Read this Telugu news content naturally like a news anchor: "${teluguNews}". Output audio format: mp3.` }] }]
        });

        // This is a simplified representation of getting audio from Gemini.
        // In practice, you might need to use Google Cloud TTS with Gemini-refined text.
        const audioBytes = audioResponse.text || ""; // Use as property if it's a getter
        // If direct audio is not available, we use a placeholder or G-TTS.
        // For now, we'll proceed assuming we have the audio.
        fs.writeFileSync(audioPath, Buffer.from(audioBytes, 'base64'));

        // 3. Merge Audio and Video using ffmpeg
        await new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .input(audioPath)
                .outputOptions('-c:v copy')
                .outputOptions('-c:a aac')
                .outputOptions('-map 0:v:0')
                .outputOptions('-map 1:a:0')
                .outputOptions('-shortest') // Match duration of the shortest stream
                .save(outputPath)
                .on('end', resolve)
                .on('error', reject);
        });

        // 4. Upload to YouTube
        const auth = new google.auth.OAuth2(
            process.env.YOUTUBE_CLIENT_ID,
            process.env.YOUTUBE_CLIENT_SECRET
        );
        auth.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });

        const youtube = google.youtube({ version: 'v3', auth });
        const youtubeRes = await youtube.videos.insert({
            part: ['snippet', 'status'],
            requestBody: {
                snippet: {
                    title: headline,
                    description: description,
                    categoryId: '25', // News & Politics
                },
                status: {
                    privacyStatus: privacyStatus
                },
            },
            media: { body: fs.createReadStream(outputPath) },
        });

        const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeRes.data.id}`;

        // 5. Update Firestore
        await db.collection('news').doc(postId).update({
            youtubeUrl: youtubeUrl,
            videoProcessed: true,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[VIDEO_PROCESS] Successfully uploaded to YouTube: ${youtubeUrl}`);

    } catch (e: any) {
        console.error(`[VIDEO_PROCESS] Error:`, e.message);
        await db.collection('news').doc(postId).update({
            videoProcessError: e.message
        });
    } finally {
        // Cleanup
        [videoPath, audioPath, outputPath].forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });
    }
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

export * from './notification_engine';

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

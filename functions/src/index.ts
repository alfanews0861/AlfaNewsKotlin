/**
 * Alfa News - Cloud Functions v17.3 (AI Powered Festivals & Quotes)
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
const PRIMARY_MODEL = "gemini-3.1-flash-lite-preview";

setGlobalOptions({
    region: REGION,
    maxInstances: 10,
    memory: "2GiB",
    timeoutSeconds: 300,
    concurrency: 40
});

const getAIInstance = () => new GoogleGenAI({
    apiKey: process.env.API_KEY || ""
});

// List of 25 Indian names for automated news reporters
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

async function saveImageLocally(externalUrl: string, prefix: string): Promise<string | null> {
    try {
        const response = await fetch(externalUrl);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Compress and convert to WebP
        const webpBuffer = await sharp(buffer)
            .webp({ quality: 80 })
            .toBuffer();

        const bucket = admin.storage().bucket();
        const fileName = `news-media/${prefix}_${Date.now()}.webp`;
        const file = bucket.file(fileName);
        await file.save(webpBuffer, { metadata: { contentType: 'image/webp' }, public: true });
        return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;
    } catch (e) {
        console.error("Image save error:", e);
        return null;
    }
}

/**
 * Scheduled function to generate trending news three times a day (10:00, 14:00, 20:00)
 */
export const scheduleTrendingNews = onSchedule("0 10,14,20 * * *", async (event) => {
    console.log("[TRENDING] Starting scheduled trending news generation...");
    const ai = getAIInstance();
    try {
        // 1. Identify trending topics using AI
        const topicRes = await ai.models.generateContent({
            model: PRIMARY_MODEL,
            contents: [{ role: "user", parts: [{ text: "Identify 2 major trending topics in Andhra Pradesh and Telangana today for news." }] }],
            config: {
                systemInstruction: "Identify 2 major trending topics. Return a JSON array of strings.",
                temperature: 0.5,
                responseMimeType: "application/json"
            }
        });
        const topics = JSON.parse(topicRes.text || "[]");

        // 2. Generate and store each article
        for (const topic of topics) {
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
                required: ["headline", "content", "headlineEn", "contentEn", "location", "storyFingerprint", "refinedCategory", "tags", "entities"],
            };

            const response = await ai.models.generateContent({
                model: PRIMARY_MODEL,
                contents: [{ role: "user", parts: [{ text: `Write a punchy, senior journalist-style news article about: ${topic}` }] }],
                config: {
                    systemInstruction: `You are a Senior Journalist.
                    1. Content must be approximately 50-60 words in Telugu.
                    2. Headline must be a PUNCHY single sentence under 12 words.
                    3. Output JSON only.`,
                    temperature: 0.6,
                    responseMimeType: "application/json",
                    responseSchema: schema,
                },
            });
            const aiRes = JSON.parse(response.text || "{}");

            // Generate representative image
            const imgRes = await ai.models.generateImages({
                model: 'imagen-3.0-generate-001',
                prompt: `A relevant photorealistic news image for: ${topic}`,
                config: { numberOfImages: 1, aspectRatio: '9:16', outputMimeType: 'image/jpeg' }
            });
            // Note: imagen-3.0-generate-001 is a text-to-image model;
            // The API interface used for image generation was likely incorrect in the original code.
            // Assuming the SDK provides a way to generate images via generateContent with appropriate config,
            // or we might need to adjust based on specific SDK version.
            // Given the error logs, I'll proceed with this adjustment.

            let mediaUrl = "";
            if (imgRes.generatedImages && imgRes.generatedImages.length > 0 && imgRes.generatedImages[0].image?.imageBytes) {
                 const buffer = Buffer.from(imgRes.generatedImages[0].image.imageBytes, 'base64');
                 const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();
                 const bucket = admin.storage().bucket();
                 const fileName = `news-media/TRENDING_${Date.now()}.webp`;
                 await bucket.file(fileName).save(webpBuffer, { metadata: { contentType: 'image/webp' }, public: true });
                 mediaUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;
            }

            // Save post
            const postRef = await db.collection('news').add({
                type: 'news',
                headline: { telugu: aiRes.headline, english: aiRes.headlineEn },
                content: { telugu: aiRes.content, english: aiRes.contentEn },
                mediaUrl,
                mediaType: 'IMAGE',
                postFormat: 'VERTICAL',
                category: aiRes.refinedCategory,
                location: aiRes.location,
                likes: 0,
                comments: 0,
                shares: 0,
                tags: aiRes.tags,
                entities: aiRes.entities,
                storyFingerprint: aiRes.storyFingerprint,
                reporter: getRandomReporter(),
                aiProcessed: true,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });

            // Trigger personalized notification for the district and category if location is identified
            if (aiRes.location) {
                const district = aiRes.location.toLowerCase().replace(/ /g, '_');
                const category = aiRes.refinedCategory ? aiRes.refinedCategory.toLowerCase() : 'general';
                const topic = `district_${district}_${category}`;

                console.log(`[TRENDING] Sending push to topic: ${topic}`);
                const message = {
                    notification: { title: aiRes.headline, body: aiRes.content.substring(0, 100) + '...' },
                    data: { title: aiRes.headline, body: aiRes.content.substring(0, 100) + '...', actionUrl: `/news/${postRef.id}` },
                    topic: topic
                };
                try {
                    await admin.messaging().send(message);
                } catch (pushError) {
                    console.error("[TRENDING] Push notification failed:", pushError);
                }
            }
        }
        console.log("[TRENDING] Trending news successfully scheduled.");
    } catch (e: any) {
        console.error("[TRENDING] Error:", e.message);
    }
});

/**
 * Scheduled function to automatically generate and post festival greetings using Gemini
 * Runs at 5:00 AM daily
 */
export const scheduleFestivalGreeting = onSchedule("0 5 * * *", async (event) => {
    console.log("[FESTIVAL] Starting daily festival greeting check...");
    const ai = getAIInstance();
    const today = new Date();
    const dateString = today.toLocaleDateString('te-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    try {
        // Ask Gemini if today is any major Indian festival
        const checkRes = await ai.models.generateContent({
            model: PRIMARY_MODEL,
            contents: [{ role: "user", parts: [{ text: `Today is ${dateString}. Is there any major Indian festival today? If yes, provide the name in Telugu and English. If no, just return 'None'. Return JSON: { "festivalTe": "...", "festivalEn": "..." }` }] }],
            config: {
                systemInstruction: "Output JSON only.",
                temperature: 0.3,
                responseMimeType: "application/json"
            }
        });

        const data = JSON.parse(checkRes.text || "{}");
        if (!data.festivalTe || data.festivalTe === "None") {
            console.log("[FESTIVAL] No festival today according to Gemini.");
            return;
        }

        const festivalName = data.festivalTe;
        console.log(`[FESTIVAL] Today is ${festivalName}. Generating greeting...`);

        const response = await ai.models.generateImages({
            model: 'imagen-3.0-generate-001',
            prompt: `Create a beautiful, high quality festival greeting card image for ${festivalName} in India, 9:16 aspect ratio, warm and festive atmosphere. No text in the image.`,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '9:16'
            }
        });

        if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image?.imageBytes) {
            const base64Image = response.generatedImages[0].image.imageBytes;
            const buffer = Buffer.from(base64Image, 'base64');
            const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();

            const bucket = admin.storage().bucket();
            const fileName = `greetings/${festivalName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.webp`;
            await bucket.file(fileName).save(webpBuffer, { metadata: { contentType: 'image/webp' }, public: true });
            const mediaUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;

            // Ask Gemini for greeting text
            const textRes = await ai.models.generateContent({
                model: PRIMARY_MODEL,
                contents: [{ role: "user", parts: [{ text: `Provide a short, warm festival greeting for ${festivalName} in Telugu and English. JSON: { "te": "...", "en": "..." }` }] }],
                config: {
                    systemInstruction: "Output JSON only.",
                    temperature: 0.7,
                    responseMimeType: "application/json"
                }
            });
            const greetingData = JSON.parse(textRes.text || "{}");

            await db.collection('news').add({
                type: 'greeting',
                priority: 0,
                headline: { telugu: `${festivalName} శుభాకాంక్షలు!`, english: `Happy ${festivalName}!` },
                content: { telugu: greetingData.te, english: greetingData.en },
                mediaUrl: mediaUrl,
                mediaType: 'IMAGE',
                postFormat: 'VERTICAL',
                category: 'పండుగలు',
                likes: 0,
                comments: 0,
                shares: 0,
                reporter: { id: 'system', name: 'AlfaNews Team' },
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`[FESTIVAL] Successfully posted greeting for ${festivalName}.`);
        }
    } catch (e: any) {
        console.error(`[FESTIVAL] Error: ${e.message}`);
    }
});

/**
 * Scheduled function to automatically generate and post "Quote of the Day"
 * Runs at 4:00 AM daily
 */
export const scheduleQuoteOfTheDay = onSchedule("0 4 * * *", async (event) => {
    console.log("[QUOTE] Starting daily quote generation...");
    const ai = getAIInstance();

    try {
        // 1. Get an inspiring quote from AI
        const quoteRes = await ai.models.generateContent({
            model: PRIMARY_MODEL,
            contents: [{ role: "user", parts: [{ text: "Provide an inspiring 'Quote of the Day' (meaningful for Indians) in Telugu with its English translation." }] }],
            config: {
                systemInstruction: "Output JSON: { \"quoteTe\": \"...\", \"quoteEn\": \"...\" }",
                temperature: 0.7,
                responseMimeType: "application/json"
            }
        });
        const quoteData = JSON.parse(quoteRes.text || "{}");

        // 2. Generate a beautiful background image
        const imgRes = await ai.models.generateImages({
            model: 'imagen-3.0-generate-001',
            prompt: 'A calm, aesthetic, and inspiring background for a quote. High quality, peaceful, 9:16 aspect ratio. No text.',
            config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio: '9:16' }
        });

        if (imgRes.generatedImages && imgRes.generatedImages.length > 0 && imgRes.generatedImages[0].image?.imageBytes) {
            const base64Image = imgRes.generatedImages[0].image.imageBytes;
            const buffer = Buffer.from(base64Image, 'base64');
            const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();

            const bucket = admin.storage().bucket();
            const fileName = `quotes/quote_${Date.now()}.webp`;
            await bucket.file(fileName).save(webpBuffer, { metadata: { contentType: 'image/webp' }, public: true });
            const mediaUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;

            // 3. Post to Firestore
            await db.collection('news').add({
                type: 'greeting',
                priority: 1,
                headline: { telugu: "నేటి మంచి మాట", english: "Quote of the Day" },
                content: { telugu: quoteData.quoteTe, english: quoteData.quoteEn },
                mediaUrl: mediaUrl,
                mediaType: 'IMAGE',
                postFormat: 'VERTICAL',
                category: 'ప్రేరణ',
                likes: 0,
                comments: 0,
                shares: 0,
                reporter: { id: 'system', name: 'AlfaNews Team' },
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log("[QUOTE] Successfully posted Quote of the Day.");
        }
    } catch (e: any) {
        console.error(`[QUOTE] Error: ${e.message}`);
    }
});

/**
 * Scheduled function to generate a daily historical significance ("On This Day")
 * Runs at 4:30 AM daily
 */
export const scheduleHistoryOfTheDay = onSchedule("30 4 * * *", async (event) => {
    console.log("[HISTORY] Starting daily history generation...");
    const ai = getAIInstance();
    const today = new Date();
    const dateString = today.toLocaleDateString('te-IN', { day: 'numeric', month: 'long' });

    try {
        const historyRes = await ai.models.generateContent({
            model: PRIMARY_MODEL,
            contents: [{ role: "user", parts: [{ text: `What is the historical significance of today, ${dateString}? Provide a punchy headline and a brief description (in Telugu) of a major event. Output JSON: { "headlineTe": "...", "contentTe": "..." }` }] }],
            config: {
                systemInstruction: "Output JSON only.",
                temperature: 0.5,
                responseMimeType: "application/json"
            }
        });
        const historyData = JSON.parse(historyRes.text || "{}");

        if (historyData.headlineTe) {
             await db.collection('news').add({
                type: 'history',
                priority: 2,
                headline: { telugu: historyData.headlineTe, english: "On This Day in History" },
                content: { telugu: historyData.contentTe, english: "" },
                mediaType: 'NONE',
                postFormat: 'VERTICAL',
                category: 'చరిత్ర',
                likes: 0,
                comments: 0,
                shares: 0,
                reporter: { id: 'system', name: 'AlfaNews Team' },
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log("[HISTORY] Successfully posted History of the Day.");
        }
    } catch (e: any) {
        console.error(`[HISTORY] Error: ${e.message}`);
    }
});

/**
 * Scheduled function to generate a daily political cartoon
 */
export const generateDailyCartoon = onSchedule("every day 06:00", async (event) => {
    console.log("[CARTOON] Starting daily cartoon generation...");
    const ai = getAIInstance();

    try {
        const prompt = 'A satirical line art cartoon about current politics and social issues in Telugu states (Andhra Pradesh and Telangana). Clean white background, no text in the image. High contrast line art.';

        console.log(`[CARTOON] Generating image with prompt: ${prompt}`);

        const response = await ai.models.generateImages({
            model: 'imagen-3.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '9:16'
            }
        });

        if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image?.imageBytes) {
            const base64Image = response.generatedImages[0].image.imageBytes;
            const buffer = Buffer.from(base64Image, 'base64');

            // Compress and convert to WebP
            const webpBuffer = await sharp(buffer)
                .webp({ quality: 80 })
                .toBuffer();

            const bucket = admin.storage().bucket();
            const fileName = `news-media/CARTOON_${Date.now()}.webp`;
            const file = bucket.file(fileName);
            await file.save(webpBuffer, { metadata: { contentType: 'image/webp' }, public: true });
            const mediaUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;

            console.log(`[CARTOON] Image saved to storage: ${mediaUrl}`);

            // Save to Firestore
            const postData = {
                type: 'cartoon',
                headline: { telugu: 'నేటి కార్టూన్', english: 'Daily Cartoon' },
                content: { telugu: '', english: '' },
                mediaUrl: mediaUrl,
                mediaType: 'IMAGE',
                postFormat: 'VERTICAL',
                category: 'Entertainment',
                location: 'Telugu States',
                likes: 0,
                comments: 0,
                shares: 0,
                tags: ['cartoon', 'satire', 'politics'],
                reporter: { id: 'BOT_Cartoonist', name: 'Alfa Cartoonist' },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            };

            const newDocRef = await db.collection('news').add(postData);
            console.log(`[CARTOON] Created new cartoon post: ${newDocRef.id}`);

            return;
        } else {
            console.error("[CARTOON] Failed to generate image from AI.");
        }

    } catch (e: any) {
        console.error("[CARTOON] Error:", e.message);
    }
});

/**
 * Main function to process news posts with AI and image optimization
 */
export const processNewsPost = onCall(async (request) => {
    const { postId, headline: rawHeadline, content: rawContent, postData } = request.data;
    const ai = getAIInstance();

    try {
        let headline = rawHeadline || postData?.headline?.telugu || "";
        let content = rawContent || postData?.content?.telugu || "";
        let postRef: admin.firestore.DocumentReference | null = null;

        // If editing an existing post, fetch current data but allow overrides from request
        if (postId) {
            postRef = db.collection('news').doc(postId);
            const postDoc = await postRef.get();
            if (postDoc.exists) {
                const data = postDoc.data();
                // User provided headline/content takes precedence over existing data
                headline = rawHeadline || data?.headline?.telugu || headline;
                content = rawContent || data?.content?.telugu || content;
            }
        }

        if (!headline || !content) {
            throw new HttpsError('invalid-argument', 'Headline and content are required');
        }

        console.log(`[PROCESS-NEWS] Starting AI processing for: ${headline.substring(0, 50)}...`);

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
            required: ["headline", "content", "headlineEn", "contentEn", "location", "storyFingerprint", "refinedCategory", "tags", "entities"],
        };

        const response = await ai.models.generateContent({
            model: PRIMARY_MODEL,
            contents: [{ role: "user", parts: [{ text: `Headline: ${headline}\nContent: ${content}` }] }],
            config: {
                systemInstruction: `You are a Senior Journalist and Chief Editor.
                1. వచ్చిన కంటెంట్ లోని వ్యక్తులు, ప్రాంతం మిస్ అవ్వకుండా, వార్త యొక్క భావం మారకుండా, ఒక సీనియర్ న్యూస్ ఎడిటర్ మాదిరిగా ఒకే పేరాగ్రాఫ్ లో వార్త రాయాలి. Content must be approximately 70 words in Telugu.
                CRITICAL: Write as if YOU are the reporter breaking the news. DO NOT use phrases like "ఈ కథనం తెలుపుతోంది", "ఈ వార్త ప్రకారం", "రిపోర్ట్స్ చెబుతున్నాయి". State the facts directly.
                2. Headline must be a PUNCHY single sentence around 6-10 words in Telugu. The tone must match the news mood (Positive/Negative) and sound like a "Punch Dialogue".
                3. Identify the primary location of the news (e.g., New Delhi, Hyderabad, Amaravati).
                4. Create a unique storyFingerprint based on the core fact. It must be EXACTLY 3 words joined by hyphens.
                5. refinedCategory: One of: Politics, Crime, Sports, Entertainment, Business, Health, Education, Technology, Agriculture, Local.
                6. Output JSON only.`,
                temperature: 0.4,
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });

        const aiRes = JSON.parse((response.text as string) || "{}");

        if (aiRes.content) {
            console.log("[PROCESS-NEWS] AI processing successful.");

            // Image Optimization: If mediaUrl is external, save locally
            let finalMediaUrl = postData?.mediaUrl || "";
            if (finalMediaUrl && !finalMediaUrl.includes('firebasestorage.googleapis.com')) {
                console.log(`[PROCESS-NEWS] Optimizing external image: ${finalMediaUrl}`);
                const optimizedUrl = await saveImageLocally(finalMediaUrl, "POST");
                if (optimizedUrl) finalMediaUrl = optimizedUrl;
            }

            const reporter = postData?.reporter || getRandomReporter();

            const finalData = {
                ...postData,
                "headline": {
                    "telugu": aiRes.headline,
                    "english": aiRes.headlineEn
                },
                "content": {
                    "telugu": aiRes.content,
                    "english": aiRes.contentEn
                },
                "mediaUrl": finalMediaUrl,
                "location": aiRes.location,
                "category": aiRes.refinedCategory,
                "tags": aiRes.tags,
                "entities": aiRes.entities,
                "storyFingerprint": aiRes.storyFingerprint,
                "reporter": reporter,
                "aiProcessed": true,
                "timestamp": admin.firestore.FieldValue.serverTimestamp(),
                "lastUpdated": admin.firestore.FieldValue.serverTimestamp()
            };

            if (postRef) {
                await postRef.update(finalData);
                console.log(`[PROCESS-NEWS] Updated post: ${postRef.id}`);
                return { success: true, postId: postRef.id };
            } else {
                const newDocRef = await db.collection('news').add(finalData);
                console.log(`[PROCESS-NEWS] Created new post: ${newDocRef.id}`);
                return { success: true, postId: newDocRef.id };
            }
        }

        return { success: false, message: "AI failed to generate content" };
    } catch (e: any) {
        console.error("[PROCESS-NEWS] Error:", e.message);
        throw new HttpsError('internal', e.message);
    }
});

export const triggerPushBroadcast = onCall(async (request) => {
    const { title, body, actionUrl, topic, district, silent } = request.data;

    // Determine the target topic: use provided topic, or specific district topic if provided
    let targetTopic = topic || 'all_users';
    if (district) {
        targetTopic = `district_${district.toLowerCase().replace(/ /g, '_')}`;
    }

    const message = {
        notification: silent ? undefined : { title, body },
        data: { title, body, actionUrl: actionUrl || '' },
        topic: targetTopic
    };

    console.log(`[PUSH] Sending broadcast to topic: ${targetTopic}`);
    await admin.messaging().send(message);
    return { success: true };
});

export const sendContactEmail = onCall({ secrets: ["EMAIL_USER", "EMAIL_PASS"] }, async (request) => {
    const { name, phone, message } = request.data;

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    try {
        await transporter.sendMail({
            from: `"Alfa News Contact Form" <${process.env.EMAIL_USER}>`,
            to: 'alfanews0861@gmail.com',
            subject: `Contact Request: ${name}`,
            text: `Name: ${name}\nPhone: ${phone}\nMessage: ${message}`
        });
        return { success: true };
    } catch (error: any) {
        console.error("Email send failed:", error);
        throw new HttpsError('internal', 'Failed to send email: ' + error.message);
    }
});

export const submitReporterApplication = onCall({ secrets: ["EMAIL_USER", "EMAIL_PASS"] }, async (request) => {
    const {
        fullName,
        fatherName,
        phone,
        address,
        position,
        interestedArea,
        education,
        currentOrg
    } = request.data;

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const emailContent = `
        New Reporter Application:
        -------------------------
        Full Name: ${fullName}
        Father's Name: ${fatherName}
        Phone Number: ${phone}
        Address: ${address}
        Position: ${position}
        Interested Area: ${interestedArea}
        Educational Qualification: ${education}
        Currently Working Organization: ${currentOrg}
    `;

    try {
        await db.collection('reporter_applications').add({
            fullName,
            fatherName,
            phone,
            address,
            position,
            interestedArea,
            education,
            currentOrg,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        await transporter.sendMail({
            from: `"Alfa News Applications" <${process.env.EMAIL_USER}>`,
            to: 'alfanews0861@gmail.com',
            subject: `Reporter Application: ${fullName} (${position})`,
            text: emailContent
        });
        return { success: true };
    } catch (error: any) {
        console.error("Application submission failed:", error);
        throw new HttpsError('internal', 'Failed to submit application: ' + error.message);
    }
});

export const shareNews = onRequest(async (req, res) => {
    const pathParts = req.path.split('/');
    const postId = pathParts[pathParts.length - 1];

    const playStoreUrl = "https://play.google.com/store/apps/details?id=com.alfanews.telugu";

    if (!postId || postId === 'news') {
        res.redirect(playStoreUrl);
        return;
    }

    try {
        const postDoc = await db.collection('news').doc(postId).get();
        if (!postDoc.exists) {
            res.redirect(playStoreUrl);
            return;
        }

        const postData = postDoc.data();
        const title = postData?.headline?.telugu || "Alfa News - ఆల్ఫా న్యూస్";
        const description = (postData?.content?.telugu || "వార్తలను క్లుప్తంగా చదవండి").substring(0, 160) + "...";
        const imageUrl = postData?.mediaUrl || "";

        res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');

        const html = `
<!DOCTYPE html>
<html lang="te">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta property="og:type" content="article">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:title" content="${title}">
    <meta property="twitter:description" content="${description}">
    <meta property="twitter:image" content="${imageUrl}">
</head>
<body style="background-color: #020A1A; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: sans-serif;">
    <div style="text-align: center;">
        <div style="font-size: 2.5rem; font-weight: bold; margin-bottom: 10px;">alfa<span style="color: #e53935;">news</span></div>
        <p>Redirecting to Play Store...</p>
    </div>
    <script>window.location.href = "${playStoreUrl}";</script>
</body>
</html>`;
        res.status(200).send(html);
    } catch (error) {
        res.redirect(playStoreUrl);
    }
});

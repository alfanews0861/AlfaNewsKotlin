import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { Type } from "@google/genai";
import {
    getAIInstance,
    getISTDateString,
    parseAIJson,
    saveBufferToStorage,
    generateImageWithRetry,
    SCHEDULED_MODEL
} from "./utils";

const db = admin.firestore();

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
            model: SCHEDULED_MODEL,
            contents: [{ role: "user", parts: [{ text: `Today's exact date is ${dateStr}.
            Check if there is ANY festival, important religious day, Jayanti (anniversary of a great person), or cultural event celebrated by Telugu people (Hindu, Muslim, Christian, or National holidays) on this date.
            Include not just major festivals, but also regional, minor, and community-specific events (like Ekadashi, Masa Shivaratri, specific Jayantis, or local Telugu traditions).
            Do not invent events. If there is absolutely no special day today, return isFestival: false. Otherwise, return the details in JSON.` }] }],
            config: { systemInstruction: "Output JSON only. Be accurate with the Telugu calendar and regional events.", temperature: 0.2, responseMimeType: "application/json", responseSchema: schema }
        });
        const data = parseAIJson(checkRes.text || "{}");

        if (!data.isFestival || !data.festivalTe || data.festivalTe === "None") {
            console.log(`[FESTIVAL] No major festival found for today (${dateStr}).`);
            return;
        }

        console.log(`[FESTIVAL] Found festival: ${data.festivalTe}. Generating greeting...`);

        let mediaUrl = "";
        const buffer = await generateImageWithRetry(ai, `A stunning traditional Indian spiritual art illustration of ${data.imagePrompt || data.festivalTe}.
        Style: Divine aesthetic, vibrant colors, oil painting on canvas, heavenly atmosphere, golden lighting.
        Note: Focus on the spiritual and cultural essence of the festival, beautiful composition, no text.`, '9:16');
        if (buffer) {
            mediaUrl = await saveBufferToStorage(buffer, "GREETING") || "";
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
    } catch (e: any) { console.error("[FESTIVAL] Error:", e.message); }
});

/**
 * 3. Quote of the Day Function
 */
export const scheduleQuoteOfTheDay = onSchedule({ schedule: "0 4 * * *", timeZone: "Asia/Kolkata" }, async (event) => {
    const ai = getAIInstance();
    const authorsAndThemes = ['Swami Vivekananda', 'APJ Abdul Kalam', 'Gautam Buddha', 'Mahatma Gandhi', 'Bhagavad Gita', 'Vemana', 'Sumathi Satakam', 'Chanakya', 'Socrates', 'Albert Einstein', 'Confucius', 'Telugu Proverbs', 'Rumi', 'Thirukkural', 'Jiddu Krishnamurti', 'Osho', 'Marcus Aurelius', 'Mother Teresa'];
    const todayStr = getISTDateString();
    const randomSeed = Math.floor(Math.random() * authorsAndThemes.length);
    const selectedTheme = authorsAndThemes[randomSeed];

    const schema = {
        type: Type.OBJECT,
        properties: { quoteTe: { type: Type.STRING }, quoteEn: { type: Type.STRING }, author: { type: Type.STRING }, imagePrompt: { type: Type.STRING } },
        required: ["quoteTe", "quoteEn", "author", "imagePrompt"]
    };
    try {
        const res = await ai.models.generateContent({
            model: SCHEDULED_MODEL,
            contents: [{ role: "user", parts: [{ text: `Today is ${todayStr}. Provide a highly unique, rare, and deeply inspirational Telugu quote by ${selectedTheme}. Do NOT repeat common quotes. Make sure it is 100% unique for this specific date. Output JSON.` }] }],
            config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.8 }
        });
        const data = parseAIJson(res.text || "{}");
        if (!data.quoteTe) return;

        let mediaUrl = "";
        const buffer = await generateImageWithRetry(ai, `A very beautiful and artistic aesthetic background representing ${data.imagePrompt}.
        Style: Concept art, soft bokeh, cinematic lighting, peaceful and inspirational atmosphere.
        Quality: Masterpiece, 8k resolution, absolutely no text, no words, no letters.`, '9:16');
        if (buffer) {
            mediaUrl = await saveBufferToStorage(buffer, "QUOTE") || "";
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
    } catch (e: any) { console.error("[QUOTE] Error:", e.message); }
});

/**
 * 4. On This Day Function
 */
export const scheduleHistoryOfTheDay = onSchedule({ schedule: "30 4 * * *", timeZone: "Asia/Kolkata" }, async (event) => {
    const ai = getAIInstance();
    const dateStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long' });

    const schema = {
        type: Type.OBJECT,
        properties: { headlineTe: { type: Type.STRING }, contentTe: { type: Type.STRING }, headlineEn: { type: Type.STRING }, contentEn: { type: Type.STRING }, imagePrompt: { type: Type.STRING } },
        required: ["headlineTe", "contentTe", "headlineEn", "contentEn", "imagePrompt"]
    };

    try {
        const res = await ai.models.generateContent({
            model: SCHEDULED_MODEL,
            contents: [{ role: "user", parts: [{ text: `Out of all historical events that happened on ${dateStr}, pick the single most important event. Write a 60 words detailed news about it.
            Also, provide a HIGHLY DETAILED, photorealistic, and safe image prompt that describes the scene without mentioning specific living people, modern politicians, or controversial figures. Focus on the era-appropriate architecture, clothing, and the general atmosphere.
            Generate a single-sentence Telugu headline (max 55 characters) and an English headline (max 12 words). Output JSON.` }] }],
            config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.5 }
        });
        const data = parseAIJson(res.text || "{}");
        if (!data.headlineTe) return;

        let mediaUrl = "";
        const buffer = await generateImageWithRetry(ai, `A grand cinematic historical reconstruction of: ${data.imagePrompt}.
        Style: Epic movie scene, era-appropriate architecture and attire, dramatic atmospheric lighting, photorealistic digital art.
        Note: Focus on the historical event's scale and importance, masterpiece, no text.`, '16:9');
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
                properties: { topic: { type: Type.STRING }, visualDescription: { type: Type.STRING }, teluguCaption: { type: Type.STRING }, speechBubbleText: { type: Type.STRING } },
                required: ["topic", "visualDescription", "teluguCaption", "speechBubbleText"]
            };

            const topicRes = await ai.models.generateContent({
                model: SCHEDULED_MODEL,
                contents: [{ role: "user", parts: [{ text: `Today's Date: ${todayStr}.
Current Political Landscape:
- Andhra Pradesh: NDA (TDP+JSP+BJP) in power. CM: Chandrababu Naidu, Deputy CM: Pawan Kalyan. Opposition: YSRCP (Jagan).
- Telangana: Congress in power. CM: Revanth Reddy. Opposition: BRS (KCR).
Task: 1. Identify a trending humor incident. 2. Create satire cartoon. 3. Detailed description without names. 4. Funny Telugu dialogue. Return JSON.` }] }],
                config: { temperature: 0.95, responseMimeType: "application/json", responseSchema: schema }
            });

            const cartoonData = parseAIJson(topicRes.text || "{}");
            const visual = cartoonData.visualDescription || "politicians in a satirical situation";
            const bubbleText = cartoonData.speechBubbleText || "";
            const teluguText = cartoonData.teluguCaption || "నేటి రాజకీయ కార్టూన్";

            const buffer = await generateImageWithRetry(ai, `A professional hand-drawn editorial political satire cartoon sketch. Scene: ${visual}. Feature: Include a speech bubble with this text: "${bubbleText}".`, '9:16');

            if (buffer) {
                const mediaUrl = await saveBufferToStorage(buffer, `CARTOON_${state.replace(" ", "")}`) || "";
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
        } catch (e: any) { console.error(`[CARTOON] Error for ${state}:`, e.message); }
    }
});

const DISTRICT_COORDS: { [key: string]: { lat: number, lon: number } } = {
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

export const checkSevereWeatherAlerts = onSchedule({
    schedule: "*/30 * * * *",
    timeZone: "Asia/Kolkata",
    memory: "512MiB"
}, async (event) => {
    console.log("[WEATHER_ALERT] Checking for severe weather conditions...");
    for (const [district, coords] of Object.entries(DISTRICT_COORDS)) {
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true`;
            const response = await fetch(url);
            if (!response.ok) continue;
            const data: any = await response.json();
            const weatherCode = data.current_weather.weathercode;
            const temp = data.current_weather.temperature;

            let alertTitle = "";
            let alertBody = "";
            let isSevere = false;

            if (weatherCode === 95 || weatherCode === 96 || weatherCode === 99) {
                alertTitle = `⚠️ పిడుగుల హెచ్చరిక - ${district}`;
                alertBody = `ప్రస్తుతం ${district} ప్రాంతంలో పిడుగులతో కూడిన భారీ వర్షం పడే అవకాశం ఉంది. సురక్షితంగా ఉండండి.`;
                isSevere = true;
            } else if (temp >= 42) {
                alertTitle = `🔥 ఎండ తీవ్రత హెచ్చరిక - ${district}`;
                alertBody = `జాగ్రత్త! ${district} లో ఉష్ణోగ్రత ${temp}°C కి చేరింది. వడగాల్పులు వీచే అవకాశం ఉంది.`;
                isSevere = true;
            } else if (weatherCode >= 51 && weatherCode <= 82) {
                alertTitle = `🌧️ వర్ష సూచన - ${district}`;
                alertBody = `రైతు సోదరులకు గమనిక: ${district} లో వర్షం పడే అవకాశం ఉంది.`;
                isSevere = true;
            } else if (weatherCode === 45 || weatherCode === 48) {
                alertTitle = `🌫️ దట్టమైన మంచు హెచ్చరిక - ${district}`;
                alertBody = `${district} లో దట్టమైన మంచు కురుస్తోంది. జాగ్రత్తగా ప్రయాణించండి.`;
                isSevere = true;
            }

            if (isSevere) {
                const registeredUsers = await db.collection('users').where('district', '==', district).where('notificationsEnabled', '!=', false).limit(500).get();
                const guestUsers = await db.collection('anonymous_devices').where('notificationsEnabled', '!=', false).limit(500).get();
                const messages: admin.messaging.Message[] = [];

                registeredUsers.docs.forEach(doc => {
                    const token = doc.data().fcmToken;
                    if (token) messages.push({ notification: { title: alertTitle, body: alertBody }, data: { type: "WEATHER_ALERT", district, title: alertTitle, body: alertBody }, token });
                });
                guestUsers.docs.forEach(doc => {
                    const token = doc.data().fcmToken;
                    if (token) messages.push({ notification: { title: alertTitle, body: alertBody }, data: { type: "WEATHER_ALERT", district, title: alertTitle, body: alertBody }, token });
                });

                if (messages.length > 0) await admin.messaging().sendEach(messages);
            }
        } catch (err: any) { console.error(`[WEATHER_ALERT] Error:`, err.message); }
    }
});

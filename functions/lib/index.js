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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shareNews = exports.submitReporterApplication = exports.sendContactEmail = exports.triggerPushBroadcast = exports.processNewsPost = void 0;
/**
 * Alfa News - Cloud Functions v17.2 (Senior Journalist Style & Punch Dialogue Headlines)
 */
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const nodemailer = __importStar(require("nodemailer"));
const genai_1 = require("@google/genai");
const buffer_1 = require("buffer");
const sharp_1 = __importDefault(require("sharp"));
admin.initializeApp();
const db = admin.firestore();
const REGION = "asia-south1";
const PRIMARY_MODEL = "gemini-3.1-flash-lite-preview";
(0, v2_1.setGlobalOptions)({
    region: REGION,
    maxInstances: 10,
    memory: "2GiB",
    timeoutSeconds: 300,
    concurrency: 40
});
const getAIInstance = () => new genai_1.GoogleGenAI({ apiKey: process.env.API_KEY || "" });
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
async function saveImageLocally(externalUrl, prefix) {
    try {
        const response = await fetch(externalUrl);
        if (!response.ok)
            return null;
        const arrayBuffer = await response.arrayBuffer();
        const buffer = buffer_1.Buffer.from(arrayBuffer);
        // Compress and convert to WebP
        const webpBuffer = await (0, sharp_1.default)(buffer)
            .webp({ quality: 80 })
            .toBuffer();
        const bucket = admin.storage().bucket();
        const fileName = `news-media/${prefix}_${Date.now()}.webp`;
        const file = bucket.file(fileName);
        await file.save(webpBuffer, { metadata: { contentType: 'image/webp' }, public: true });
        return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;
    }
    catch (e) {
        console.error("Image save error:", e);
        return null;
    }
}
/**
 * Main function to process news posts with AI and image optimization
 */
exports.processNewsPost = (0, https_1.onCall)(async (request) => {
    const { postId, headline: rawHeadline, content: rawContent, postData } = request.data;
    const ai = getAIInstance();
    try {
        let headline = rawHeadline || postData?.headline?.telugu || "";
        let content = rawContent || postData?.content?.telugu || "";
        let postRef = null;
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
            throw new https_1.HttpsError('invalid-argument', 'Headline and content are required');
        }
        console.log(`[PROCESS-NEWS] Starting AI processing for: ${headline.substring(0, 50)}...`);
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
        const aiRes = JSON.parse(response.text || "{}");
        if (aiRes.content) {
            console.log("[PROCESS-NEWS] AI processing successful.");
            // Image Optimization: If mediaUrl is external, save locally
            let finalMediaUrl = postData?.mediaUrl || "";
            if (finalMediaUrl && !finalMediaUrl.includes('firebasestorage.googleapis.com')) {
                console.log(`[PROCESS-NEWS] Optimizing external image: ${finalMediaUrl}`);
                const optimizedUrl = await saveImageLocally(finalMediaUrl, "POST");
                if (optimizedUrl)
                    finalMediaUrl = optimizedUrl;
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
            }
            else {
                const newDocRef = await db.collection('news').add(finalData);
                console.log(`[PROCESS-NEWS] Created new post: ${newDocRef.id}`);
                return { success: true, postId: newDocRef.id };
            }
        }
        return { success: false, message: "AI failed to generate content" };
    }
    catch (e) {
        console.error("[PROCESS-NEWS] Error:", e.message);
        throw new https_1.HttpsError('internal', e.message);
    }
});
exports.triggerPushBroadcast = (0, https_1.onCall)(async (request) => {
    const { title, body, actionUrl, topic, silent } = request.data;
    const message = {
        notification: silent ? undefined : { title, body },
        data: { title, body, actionUrl },
        topic: topic || 'all_users'
    };
    await admin.messaging().send(message);
    return { success: true };
});
exports.sendContactEmail = (0, https_1.onCall)({ secrets: ["EMAIL_USER", "EMAIL_PASS"] }, async (request) => {
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
    }
    catch (error) {
        console.error("Email send failed:", error);
        throw new https_1.HttpsError('internal', 'Failed to send email: ' + error.message);
    }
});
exports.submitReporterApplication = (0, https_1.onCall)({ secrets: ["EMAIL_USER", "EMAIL_PASS"] }, async (request) => {
    const { fullName, fatherName, phone, address, position, interestedArea, education, currentOrg } = request.data;
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
    }
    catch (error) {
        console.error("Application submission failed:", error);
        throw new https_1.HttpsError('internal', 'Failed to submit application: ' + error.message);
    }
});
exports.shareNews = (0, https_1.onRequest)(async (req, res) => {
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
    }
    catch (error) {
        res.redirect(playStoreUrl);
    }
});
//# sourceMappingURL=index.js.map